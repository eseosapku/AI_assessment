import { db } from '@/lib/db'
import { roundForCurrency } from '@/lib/fx-rates'
import type { SubscriptionQuote } from '@/lib/subscription-payment'

export const REFERRAL_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{2,31}$/

export function normalizeReferralCode(value: unknown): string {
  return String(value ?? '').trim().toUpperCase()
}

export function isValidReferralCodeFormat(code: string): boolean {
  return REFERRAL_CODE_PATTERN.test(code)
}

export function discountedSubscriptionQuote(
  quote: SubscriptionQuote,
  discountPercentage: number,
): SubscriptionQuote {
  const percent = Number(discountPercentage)
  if (!Number.isFinite(percent) || percent <= 0 || percent >= 100) return quote
  const amount = roundForCurrency(quote.amount * (1 - percent / 100), quote.currency)
  return { ...quote, amount: Math.max(amount, quote.currency.toUpperCase() === 'RWF' ? 1 : 0.01) }
}

export type ValidReferral = {
  id: string
  code: string
  ownerUserId: string
  discountPercentage: number
  uses: number
}

export type ReferralValidation =
  | { ok: true; referral: ValidReferral }
  | { ok: false; status: number; error: string }

export async function validateReferralCode(codeInput: unknown, payerUserId: string): Promise<ReferralValidation> {
  const code = normalizeReferralCode(codeInput)
  if (!isValidReferralCodeFormat(code)) {
    return { ok: false, status: 400, error: 'Enter a valid referral code.' }
  }

  const { rows } = await db.query<{
    id: string
    code: string
    owner_user_id: string
    discount_percentage: string | number
    active: boolean
    expires_at: string | null
    uses: string | number
    used_by_user: boolean
  }>(
    `SELECT rc.id, rc.code, rc.owner_user_id, rc.discount_percentage,
            rc.active, rc.expires_at,
            COUNT(rr.id)::int AS uses,
            EXISTS (
              SELECT 1 FROM referral_redemptions mine
               WHERE mine.referred_user_id = $2
            ) AS used_by_user
       FROM referral_codes rc
       LEFT JOIN referral_redemptions rr ON rr.referral_code_id = rc.id
      WHERE rc.code = $1
      GROUP BY rc.id
      LIMIT 1`,
    [code, payerUserId],
  )
  const row = rows[0]
  if (!row || !row.active) return { ok: false, status: 404, error: 'Referral code not found or inactive.' }
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) {
    return { ok: false, status: 410, error: 'This referral code has expired.' }
  }
  if (String(row.owner_user_id).toLowerCase() === payerUserId.toLowerCase()) {
    return { ok: false, status: 400, error: 'You cannot use your own referral code.' }
  }
  if (row.used_by_user) {
    return { ok: false, status: 409, error: 'Your account has already used a referral code.' }
  }
  const uses = Number(row.uses) || 0
  return {
    ok: true,
    referral: {
      id: String(row.id),
      code: String(row.code),
      ownerUserId: String(row.owner_user_id),
      discountPercentage: Number(row.discount_percentage),
      uses,
    },
  }
}
