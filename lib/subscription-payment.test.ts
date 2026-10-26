import { describe, expect, it } from 'vitest'
import { checkSubscriptionPayment, userIdFromTxRef, type FlutterwaveTransaction } from './subscription-payment'

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const checkout = { userId: A, amount: 1500, currency: 'RWF' }
const paid = (over: Partial<FlutterwaveTransaction> = {}): FlutterwaveTransaction => ({
  status: 'successful',
  id: '9001',
  txRef: `sub_${A}_ab12cd34`,
  amount: 1500,
  currency: 'RWF',
  ...over,
})

describe('which account a payment activates', () => {
  it('activates the account named in the reference', () => {
    expect(checkSubscriptionPayment(paid(), { claimedUserId: A, checkout })).toEqual({
      ok: true,
      userId: A,
      transactionId: '9001',
    })
  })

  // /verify applied any paid transaction to whatever user_id the body named.
  it("refuses to activate someone else's account with my payment", () => {
    const check = checkSubscriptionPayment(paid(), { claimedUserId: B, checkout })
    expect(check).toMatchObject({ ok: false, status: 403 })
  })

  it('refuses a reference whose user disagrees with the recorded checkout', () => {
    const check = checkSubscriptionPayment(paid(), { checkout: { ...checkout, userId: B } })
    expect(check).toMatchObject({ ok: false, status: 403 })
  })

  it('falls back to the payer email when the reference names nobody', () => {
    const check = checkSubscriptionPayment(paid({ txRef: 'rave-renewal-1', currency: 'USD', amount: 5 }), {
      fallbackQuote: { amount: 5, currency: 'USD', converted: false },
      emailUserId: B,
    })
    expect(check).toMatchObject({ ok: true, userId: B })
  })

  it('matches ids regardless of case', () => {
    expect(userIdFromTxRef(`sub_${A.toUpperCase()}_ff`)).toBe(A)
    expect(checkSubscriptionPayment(paid(), { claimedUserId: A.toUpperCase(), checkout }).ok).toBe(true)
  })
})

describe('what a payment must be worth', () => {
  // The checkout charged body.amount, so 1 RWF bought a month.
  it('refuses a payment below the recorded price', () => {
    const check = checkSubscriptionPayment(paid({ amount: 1 }), { claimedUserId: A, checkout })
    expect(check).toMatchObject({ ok: false, status: 402 })
  })

  it('refuses a payment in another currency', () => {
    const check = checkSubscriptionPayment(paid({ currency: 'UGX', amount: 1500 }), { claimedUserId: A, checkout })
    expect(check).toMatchObject({ ok: false, status: 402 })
  })

  it('refuses when there is no price to compare against', () => {
    expect(checkSubscriptionPayment(paid(), { claimedUserId: A })).toMatchObject({ ok: false, status: 402 })
  })

  it('allows FX drift on a converted fallback price but not a large shortfall', () => {
    const fallbackQuote = { amount: 1000, currency: 'KES', converted: true }
    const near = paid({ currency: 'KES', amount: 950 })
    const far = paid({ currency: 'KES', amount: 500 })
    expect(checkSubscriptionPayment(near, { claimedUserId: A, fallbackQuote }).ok).toBe(true)
    expect(checkSubscriptionPayment(far, { claimedUserId: A, fallbackQuote }).ok).toBe(false)
  })

  it('refuses unpaid and id-less transactions', () => {
    expect(checkSubscriptionPayment(paid({ status: 'pending' }), { checkout }).ok).toBe(false)
    expect(checkSubscriptionPayment(paid({ id: undefined }), { checkout }).ok).toBe(false)
    expect(checkSubscriptionPayment(null, { checkout }).ok).toBe(false)
  })
})
