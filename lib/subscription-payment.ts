/**
 * Whether a Flutterwave transaction may activate a subscription, and for whom.
 *
 * Kept free of the database and the network so the rules can be tested on
 * their own. The routes fetch the transaction from Flutterwave, look up the
 * checkout the server recorded, and hand both here.
 */

export interface FlutterwaveTransaction {
  status: string
  id?: string
  txRef?: string
  amount?: number
  currency?: string
  /** `meta.user_id` as Flutterwave stored it when our server opened the checkout. */
  metaUserId?: string
  customerEmail?: string
}

/** The price a checkout was opened at. `converted` prices came through an FX rate. */
export interface SubscriptionQuote {
  amount: number
  currency: string
  converted: boolean
}

export interface RecordedCheckout {
  userId: string
  amount: number
  currency: string
}

export type PaymentCheck =
  | { ok: true; userId: string; transactionId: string }
  | { ok: false; status: number; error: string }

/** An FX-converted fallback price can drift between quoting and paying. */
const CONVERTED_PRICE_TOLERANCE = 0.9

export function isPaidFlutterwaveStatus(status: string | undefined | null): boolean {
  const s = String(status ?? '').toLowerCase()
  return s === 'successful' || s === 'succeeded' || s === 'completed'
}

export function userIdFromTxRef(txRef: string | undefined | null): string | null {
  const match = /^sub_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})_/i.exec(String(txRef ?? '').trim())
  return match?.[1]?.toLowerCase() ?? null
}

function sameId(a: string | null | undefined, b: string | null | undefined): boolean {
  return Boolean(a) && Boolean(b) && String(a).trim().toLowerCase() === String(b).trim().toLowerCase()
}

export function checkSubscriptionPayment(
  txn: FlutterwaveTransaction | null,
  opts: {
    /** The account asking to be activated. Absent for the webhook. */
    claimedUserId?: string | null
    checkout?: RecordedCheckout | null
    /** Used only when no checkout was recorded: renewals and pre-migration checkouts. */
    fallbackQuote?: SubscriptionQuote | null
    /** The account whose email paid, for charges whose reference names nobody. */
    emailUserId?: string | null
  },
): PaymentCheck {
  if (!txn || !isPaidFlutterwaveStatus(txn.status)) {
    return { ok: false, status: 402, error: 'Payment not confirmed.' }
  }
  const transactionId = String(txn.id ?? '').trim()
  if (!transactionId) return { ok: false, status: 402, error: 'Payment has no transaction id.' }

  const refUser = userIdFromTxRef(txn.txRef)
  const checkout = opts.checkout ?? null
  if (refUser && checkout && !sameId(refUser, checkout.userId)) {
    return { ok: false, status: 403, error: 'This payment belongs to a different account.' }
  }
  const owner = refUser ?? checkout?.userId ?? txn.metaUserId ?? opts.emailUserId ?? null
  if (!owner) return { ok: false, status: 400, error: 'Could not tell which account this payment is for.' }

  if (opts.claimedUserId && !sameId(opts.claimedUserId, owner)) {
    return { ok: false, status: 403, error: 'This payment belongs to a different account.' }
  }

  const expected = checkout
    ? { amount: Number(checkout.amount), currency: checkout.currency, converted: false }
    : opts.fallbackQuote ?? null
  if (!expected || !Number.isFinite(expected.amount) || expected.amount <= 0) {
    return { ok: false, status: 402, error: 'No price on record for this payment.' }
  }
  const paidCurrency = String(txn.currency ?? '').toUpperCase()
  if (paidCurrency !== String(expected.currency).toUpperCase()) {
    return { ok: false, status: 402, error: 'Payment was made in the wrong currency.' }
  }
  const minimum = expected.converted ? expected.amount * CONVERTED_PRICE_TOLERANCE : expected.amount
  const paid = Number(txn.amount)
  if (!Number.isFinite(paid) || paid + 0.005 < minimum) {
    return { ok: false, status: 402, error: 'Payment amount is below the subscription price.' }
  }

  return { ok: true, userId: String(owner).toLowerCase(), transactionId }
}
