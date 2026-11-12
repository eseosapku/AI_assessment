import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({ db: { query: vi.fn() } }))

import { db } from '@/lib/db'
import {
  discountedSubscriptionQuote,
  normalizeReferralCode,
  validateReferralCode,
} from './referrals'

const PAYER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OWNER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const validRow = {
  id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  code: 'SAVE40',
  owner_user_id: OWNER,
  discount_percentage: 40,
  active: true,
  expires_at: null,
  uses: 3,
  used_by_user: false,
}

beforeEach(() => vi.mocked(db.query).mockReset())

describe('referral code rules', () => {
  it('normalizes codes and calculates currency-safe discounts', () => {
    expect(normalizeReferralCode(' save-40 ')).toBe('SAVE-40')
    expect(discountedSubscriptionQuote({ amount: 1500, currency: 'RWF', converted: false }, 40).amount).toBe(900)
    expect(discountedSubscriptionQuote({ amount: 5, currency: 'USD', converted: false }, 33).amount).toBe(3.35)
  })

  it('accepts an active code owned by another user', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [validRow] } as any)
    await expect(validateReferralCode('save40', PAYER)).resolves.toEqual({
      ok: true,
      referral: expect.objectContaining({ code: 'SAVE40', discountPercentage: 40, uses: 3 }),
    })
  })

  it.each([
    [{ ...validRow, owner_user_id: PAYER }, 'own referral'],
    [{ ...validRow, used_by_user: true }, 'already used'],
    [{ ...validRow, active: false }, 'not found or inactive'],
    [{ ...validRow, expires_at: '2020-01-01T00:00:00Z' }, 'expired'],
  ])('rejects unsafe or unavailable referral state', async (row, message) => {
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [row] } as any)
    const result = await validateReferralCode('SAVE40', PAYER)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.toLowerCase()).toContain(message)
  })

  it('rejects malformed and unknown codes', async () => {
    expect((await validateReferralCode('x', PAYER)).ok).toBe(false)
    expect(db.query).not.toHaveBeenCalled()
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [] } as any)
    expect((await validateReferralCode('UNKNOWN', PAYER)).ok).toBe(false)
  })
})
