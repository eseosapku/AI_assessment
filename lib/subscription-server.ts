import { db } from '@/lib/db'
import {
  buildSubscriptionSnapshot,
  FREE_ASSESSMENT_LIMIT,
  isSubscriptionActive,
  isTeacherExempt,
  type SubscriptionSnapshot,
  type SubscriptionUser,
} from '@/lib/subscription'
import { convertUsd, roundForCurrency } from '@/lib/fx-rates'
import { fixedLocalAmount, isSupportedCheckoutCurrency, type SubscriptionCurrency } from '@/lib/subscription-pricing'
import {
  checkSubscriptionPayment,
  isPaidFlutterwaveStatus,
  userIdFromTxRef,
  type FlutterwaveTransaction,
  type RecordedCheckout,
  type SubscriptionQuote,
} from '@/lib/subscription-payment'

export async function fetchSubscriptionUser(userId: string): Promise<SubscriptionUser | null> {
  const result = await db.query<SubscriptionUser>(
    `SELECT id, role, email, subscription_status, free_assessments_used,
            subscription_started_at, subscription_expires_at
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [userId],
  )
  return result.rows[0] ?? null
}

export async function getSubscriptionSnapshot(userId: string): Promise<SubscriptionSnapshot | null> {
  const user = await fetchSubscriptionUser(userId)
  if (!user) return null
  return buildSubscriptionSnapshot(user)
}

export type SubscriptionGateResult =
  | { allowed: true; snapshot: SubscriptionSnapshot }
  | { allowed: false; snapshot: SubscriptionSnapshot; reason: 'assessment' | 'study' }

export async function assertSubscriptionAccess(
  userId: string,
  action: 'assessment' | 'study',
): Promise<SubscriptionGateResult> {
  const user = await fetchSubscriptionUser(userId)
  if (!user) {
    const snapshot = buildSubscriptionSnapshot(null)
    return { allowed: false, snapshot, reason: action }
  }

  const snapshot = buildSubscriptionSnapshot(user)
  if (isTeacherExempt(user)) return { allowed: true, snapshot }

  if (action === 'assessment') {
    if (snapshot.canGenerateAssessment) return { allowed: true, snapshot }
    return { allowed: false, snapshot, reason: 'assessment' }
  }

  if (snapshot.canStartStudyPlan) return { allowed: true, snapshot }
  return { allowed: false, snapshot, reason: 'study' }
}

export function subscriptionPaywallBody(gate: Extract<SubscriptionGateResult, { allowed: false }>) {
  const message =
    gate.reason === 'assessment'
      ? 'You have used your free assessments. Subscribe to continue.'
      : 'Subscribe to start StudyLab study plans.'
  return {
    error: message,
    code: 'PAYMENT_REQUIRED' as const,
    reason: gate.reason,
    subscription: gate.snapshot,
  }
}

export async function incrementFreeAssessmentUsage(userId: string): Promise<void> {
  const user = await fetchSubscriptionUser(userId)
  if (!user || isTeacherExempt(user) || isSubscriptionActive(user)) return

  const used = Math.max(0, Number(user.free_assessments_used) || 0)
  if (used >= FREE_ASSESSMENT_LIMIT) return

  await db.query(
    `UPDATE users SET free_assessments_used = $2, updated_at = NOW() WHERE id = $1`,
    [userId, used + 1],
  )
}

/** The monthly price the server charges in `currency`. Never taken from the request. */
export async function quoteSubscription(currency: SubscriptionCurrency): Promise<SubscriptionQuote> {
  const fixedCurrency = (process.env.FLW_SUBSCRIPTION_CURRENCY ?? '').toUpperCase()
  const fixedAmount = process.env.FLW_SUBSCRIPTION_AMOUNT ? Number(process.env.FLW_SUBSCRIPTION_AMOUNT) : null
  const amountUsd = Number(process.env.FLW_SUBSCRIPTION_AMOUNT_USD ?? 5)

  const fixedLocal = fixedLocalAmount(currency)
  if (fixedLocal != null) return { amount: roundForCurrency(fixedLocal, currency), currency, converted: false }
  if (fixedAmount != null && currency === fixedCurrency) {
    return { amount: roundForCurrency(fixedAmount, currency), currency, converted: false }
  }
  if (currency === 'USD') return { amount: roundForCurrency(amountUsd, currency), currency, converted: false }
  return { amount: roundForCurrency(await convertUsd(amountUsd, currency), currency), currency, converted: true }
}

export async function recordCheckout(txRef: string, userId: string, quote: SubscriptionQuote): Promise<void> {
  await db.query(
    `INSERT INTO subscription_checkouts (tx_ref, user_id, amount, currency) VALUES ($1, $2, $3, $4)`,
    [txRef, userId, quote.amount, quote.currency],
  )
}

export async function findCheckout(txRef: string | undefined | null): Promise<RecordedCheckout | null> {
  const ref = String(txRef ?? '').trim()
  if (!ref) return null
  const { rows } = await db.query<{ user_id: string; amount: string | number; currency: string }>(
    `SELECT user_id, amount, currency FROM subscription_checkouts WHERE tx_ref = $1 LIMIT 1`,
    [ref],
  )
  const row = rows[0]
  return row ? { userId: String(row.user_id), amount: Number(row.amount), currency: String(row.currency) } : null
}

export async function userIdForEmail(email: string | undefined | null): Promise<string | null> {
  const value = String(email ?? '').trim()
  if (!value) return null
  const { rows } = await db.query<{ id: string }>(`SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`, [value])
  return rows[0]?.id ? String(rows[0].id) : null
}

/** A fallback price for charges with no recorded checkout, or null for an unsupported currency. */
export async function fallbackQuoteFor(currency: string | undefined | null): Promise<SubscriptionQuote | null> {
  const code = String(currency ?? '').toUpperCase()
  return isSupportedCheckoutCurrency(code) ? quoteSubscription(code) : null
}

/**
 * Check a transaction Flutterwave reported as paid, then spend it. Shared by
 * /verify (which names the account asking) and the webhook (which does not).
 */
export async function settleSubscriptionPayment(
  txn: FlutterwaveTransaction | null,
  claimedUserId?: string | null,
): Promise<{ ok: true; userId: string; transactionId: string; applied: boolean } | { ok: false; status: number; error: string }> {
  if (!txn || !isPaidFlutterwaveStatus(txn.status)) {
    return { ok: false, status: 402, error: 'Payment not confirmed.' }
  }
  const checkout = await findCheckout(txn.txRef)
  const fallbackQuote = checkout ? null : await fallbackQuoteFor(txn.currency)
  const needsEmail = !checkout && !userIdFromTxRef(txn.txRef) && !txn.metaUserId
  const emailUserId = needsEmail ? await userIdForEmail(txn.customerEmail) : null

  const check = checkSubscriptionPayment(txn, { claimedUserId, checkout, fallbackQuote, emailUserId })
  if (!check.ok) return check

  const result = await applySubscriptionPayment({
    userId: check.userId,
    transactionId: check.transactionId,
    txRef: txn.txRef,
    amount: txn.amount,
    currency: txn.currency,
  })
  if (!result.ok) return result
  return { ok: true, userId: check.userId, transactionId: check.transactionId, applied: result.applied }
}

export type ApplyPaymentResult =
  | { ok: true; applied: boolean }
  | { ok: false; status: number; error: string }

/**
 * Spend one Flutterwave transaction on one account, once.
 *
 * The claim and the extension are one statement so a /verify and a webhook
 * for the same payment cannot both extend. Renewing early adds 30 days to
 * what is left instead of resetting the clock.
 */
export async function applySubscriptionPayment(params: {
  userId: string
  transactionId: string
  txRef?: string | null
  amount?: number | null
  currency?: string | null
}): Promise<ApplyPaymentResult> {
  const update = await db.query<{ subscription_status: string }>(
    `WITH claimed AS (
       INSERT INTO subscription_payments (transaction_id, user_id, tx_ref, amount, currency)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (transaction_id) DO NOTHING
       RETURNING user_id
     )
     UPDATE users
        SET subscription_status = 'active',
            subscription_started_at = NOW(),
            subscription_expires_at = GREATEST(COALESCE(subscription_expires_at, NOW()), NOW()) + INTERVAL '30 days',
            flutterwave_ref = $1,
            updated_at = NOW()
      WHERE id = (SELECT user_id FROM claimed)
      RETURNING subscription_status`,
    [params.transactionId, params.userId, params.txRef ?? null, params.amount ?? null, params.currency ?? null],
  )
  if (update.rows[0]?.subscription_status === 'active') return { ok: true, applied: true }

  const prior = await db.query<{ user_id: string }>(
    `SELECT user_id FROM subscription_payments WHERE transaction_id = $1 LIMIT 1`,
    [params.transactionId],
  )
  const spentBy = prior.rows[0]?.user_id
  if (!spentBy) return { ok: false, status: 500, error: 'Activation failed' }
  if (String(spentBy).toLowerCase() !== params.userId.toLowerCase()) {
    return { ok: false, status: 409, error: 'This payment has already been used.' }
  }
  return { ok: true, applied: false }
}
