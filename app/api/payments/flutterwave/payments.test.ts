import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/db', () => ({ db: { query: vi.fn() } }))
vi.mock('@/lib/flutterwave', async (importActual) => ({
  ...(await importActual<typeof import('@/lib/flutterwave')>()),
  isFlutterwaveConfigured: () => true,
  ensurePaymentPlan: vi.fn(async () => 'plan-1'),
  createFlutterwaveCheckout: vi.fn(async (opts: { txRef: string }) => ({ link: 'https://pay', txRef: opts.txRef })),
  verifyTransactionById: vi.fn(),
  findTransactionByTxRef: vi.fn(),
}))

import { db } from '@/lib/db'
import { createFlutterwaveCheckout, ensurePaymentPlan, verifyTransactionById } from '@/lib/flutterwave'
import { POST as initiate } from './initiate/route'
import { POST as verify } from './verify/route'
import { POST as webhook } from './webhook/route'

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

/** Just enough Postgres for these routes: checkouts, spent payments, extensions. */
function fakeDatabase() {
  const users = new Set([A, B])
  const checkouts = new Map<string, {
    user_id: string
    amount: number
    currency: string
    base_amount: number
    discount_percentage: number | null
    referral_code_id: string | null
  }>()
  const payments = new Map<string, string>()
  const extended: string[] = []
  const creditedReferralIds: string[] = []
  vi.mocked(db.query).mockImplementation((async (sql: string, params: any[] = []) => {
    if (/SELECT id, email, role FROM users/.test(sql)) {
      return { rows: users.has(params[0]) ? [{ id: params[0], email: 'p@example.com', role: 'student' }] : [] }
    }
    if (/INSERT INTO subscription_checkouts/.test(sql)) {
      checkouts.set(params[0], {
        user_id: params[1], amount: params[2], currency: params[3],
        base_amount: params[4], discount_percentage: params[5], referral_code_id: params[6],
      })
      return { rows: [] }
    }
    if (/FROM referral_codes rc/.test(sql)) {
      return {
        rows: params[0] === 'SAVE40'
          ? [{
              id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', code: 'SAVE40', owner_user_id: B,
              discount_percentage: 40, active: true, expires_at: null,
              uses: 0, used_by_user: false,
            }]
          : [],
      }
    }
    if (/FROM subscription_checkouts/.test(sql)) {
      const row = checkouts.get(params[0])
      return { rows: row ? [row] : [] }
    }
    if (/WITH claimed AS/.test(sql)) {
      if (payments.has(params[0])) return { rows: [] }
      payments.set(params[0], params[1])
      extended.push(params[1])
      if (params[5]) creditedReferralIds.push(params[5])
      return { rows: [{ subscription_status: 'active' }] }
    }
    if (/FROM subscription_payments/.test(sql)) {
      const owner = payments.get(params[0])
      return { rows: owner ? [{ user_id: owner }] : [] }
    }
    if (/subscription_status, free_assessments_used/.test(sql)) {
      return { rows: [{ id: params[0], role: 'student', subscription_status: 'active' }] }
    }
    return { rows: [] }
  }) as any)
  return { checkouts, extended, creditedReferralIds }
}

const post = (handler: (r: NextRequest) => Promise<Response>, path: string, body: unknown, headers = {}) =>
  handler(new NextRequest(`http://localhost${path}`, { method: 'POST', body: JSON.stringify(body), headers }))

let store: ReturnType<typeof fakeDatabase>
beforeEach(() => {
  vi.mocked(db.query).mockReset()
  vi.mocked(verifyTransactionById).mockReset()
  vi.mocked(createFlutterwaveCheckout).mockClear()
  vi.mocked(ensurePaymentPlan).mockClear()
  store = fakeDatabase()
})

describe('opening a checkout', () => {
  // body.amount was charged as sent.
  it('charges the server price, not the amount in the request', async () => {
    const res = await post(initiate, '/api/payments/flutterwave/initiate', { user_id: A, currency: 'RWF', amount: 1 })
    expect(res.status).toBe(200)
    const charged = vi.mocked(createFlutterwaveCheckout).mock.calls[0][0]
    expect(charged.amount).toBe(1500)
    expect([...store.checkouts.values()][0]).toMatchObject({ user_id: A, amount: charged.amount, currency: 'RWF' })
  })

  it('refuses a currency there is no price for', async () => {
    const res = await post(initiate, '/api/payments/flutterwave/initiate', { user_id: A, currency: 'XYZ' })
    expect(res.status).toBe(400)
    expect(createFlutterwaveCheckout).not.toHaveBeenCalled()
  })

  it('uses the account email and a monthly plan, ignoring browser overrides', async () => {
    const res = await post(initiate, '/api/payments/flutterwave/initiate', {
      user_id: A,
      currency: 'USD',
      email: 'attacker@example.com',
      interval: 'daily',
    })
    expect(res.status).toBe(200)
    expect(ensurePaymentPlan).toHaveBeenCalledWith(5, 'USD', 'monthly')
    expect(createFlutterwaveCheckout).toHaveBeenCalledWith(expect.objectContaining({ email: 'p@example.com' }))
  })

  it('requires a real account email instead of inventing one', async () => {
    vi.mocked(db.query).mockImplementationOnce(async () => ({ rows: [{ id: A, email: null, role: 'student' }] }) as any)
    const res = await post(initiate, '/api/payments/flutterwave/initiate', { user_id: A, currency: 'RWF' })
    expect(res.status).toBe(400)
    expect(createFlutterwaveCheckout).not.toHaveBeenCalled()
  })

  it('applies a valid referral to the server price and records its source', async () => {
    const res = await post(initiate, '/api/payments/flutterwave/initiate', {
      user_id: A,
      currency: 'RWF',
      referral_code: 'save40',
    })
    expect(res.status).toBe(200)
    const charged = vi.mocked(createFlutterwaveCheckout).mock.calls[0][0]
    expect(charged.amount).toBe(900)
    expect(charged.meta).toMatchObject({ referral_code: 'SAVE40' })
    expect([...store.checkouts.values()][0]).toMatchObject({
      amount: 900,
      base_amount: 1500,
      discount_percentage: 40,
      referral_code_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    })
  })

  it('rejects unknown referral codes instead of silently charging full price', async () => {
    const res = await post(initiate, '/api/payments/flutterwave/initiate', {
      user_id: A,
      currency: 'RWF',
      referral_code: 'UNKNOWN',
    })
    expect(res.status).toBe(404)
    expect(createFlutterwaveCheckout).not.toHaveBeenCalled()
  })
})

async function openCheckout(userId: string) {
  await post(initiate, '/api/payments/flutterwave/initiate', { user_id: userId, currency: 'RWF' })
  const { txRef, amount } = vi.mocked(createFlutterwaveCheckout).mock.calls.at(-1)![0]
  return { txRef, amount }
}

describe('confirming a payment from the success page', () => {
  it('activates the payer once, and a refresh is not an error', async () => {
    const { txRef, amount } = await openCheckout(A)
    vi.mocked(verifyTransactionById).mockResolvedValue({ status: 'successful', id: '77', txRef, amount, currency: 'RWF' })
    const first = await post(verify, '/api/payments/flutterwave/verify', { user_id: A, transaction_id: '77' })
    const again = await post(verify, '/api/payments/flutterwave/verify', { user_id: A, transaction_id: '77' })
    expect(first.status).toBe(200)
    expect(again.status).toBe(200)
    expect(store.extended).toEqual([A])
  })

  // One payment used to activate any user_id, any number of times.
  it("will not spend A's payment on B", async () => {
    const { txRef, amount } = await openCheckout(A)
    vi.mocked(verifyTransactionById).mockResolvedValue({ status: 'successful', id: '78', txRef, amount, currency: 'RWF' })
    const res = await post(verify, '/api/payments/flutterwave/verify', { user_id: B, transaction_id: '78' })
    expect(res.status).toBe(403)
    expect(store.extended).toEqual([])
  })

  it('refuses a payment for less than the recorded price', async () => {
    const { txRef } = await openCheckout(A)
    vi.mocked(verifyTransactionById).mockResolvedValue({ status: 'successful', id: '79', txRef, amount: 1, currency: 'RWF' })
    const res = await post(verify, '/api/payments/flutterwave/verify', { user_id: A, transaction_id: '79' })
    expect(res.status).toBe(402)
    expect(store.extended).toEqual([])
  })

  it('refuses the wrong currency and a transaction that is still pending', async () => {
    const { txRef, amount } = await openCheckout(A)
    vi.mocked(verifyTransactionById).mockResolvedValueOnce({ status: 'successful', id: '82', txRef, amount, currency: 'UGX' })
    const wrongCurrency = await post(verify, '/api/payments/flutterwave/verify', { user_id: A, transaction_id: '82' })
    expect(wrongCurrency.status).toBe(402)

    vi.mocked(verifyTransactionById).mockResolvedValueOnce({ status: 'pending', id: '83', txRef, amount, currency: 'RWF' })
    const pending = await post(verify, '/api/payments/flutterwave/verify', { user_id: A, transaction_id: '83' })
    expect(pending.status).toBe(402)
    expect(store.extended).toEqual([])
  })

  it('credits a referral only after a verified successful payment and only once', async () => {
    await post(initiate, '/api/payments/flutterwave/initiate', { user_id: A, currency: 'RWF', referral_code: 'SAVE40' })
    const { txRef, amount } = vi.mocked(createFlutterwaveCheckout).mock.calls.at(-1)![0]
    expect(store.creditedReferralIds).toEqual([])
    vi.mocked(verifyTransactionById).mockResolvedValue({ status: 'successful', id: '84', txRef, amount, currency: 'RWF' })
    await post(verify, '/api/payments/flutterwave/verify', { user_id: A, transaction_id: '84' })
    await post(verify, '/api/payments/flutterwave/verify', { user_id: A, transaction_id: '84' })
    expect(store.creditedReferralIds).toEqual(['cccccccc-cccc-4ccc-8ccc-cccccccccccc'])
  })
})

describe('the Flutterwave webhook', () => {
  const secret = process.env.FLW_WEBHOOK_SECRET
  const dbUrl = process.env.DATABASE_URL
  beforeEach(() => {
    process.env.DATABASE_URL = 'postgres://test'
  })
  afterEach(() => {
    if (secret === undefined) delete process.env.FLW_WEBHOOK_SECRET
    else process.env.FLW_WEBHOOK_SECRET = secret
    if (dbUrl === undefined) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = dbUrl
  })

  // With the secret unset, any POST naming a user activated them.
  it('rejects everything when no secret is configured', async () => {
    delete process.env.FLW_WEBHOOK_SECRET
    const res = await post(webhook, '/api/payments/flutterwave/webhook', {
      event: 'charge.completed',
      data: { id: 1, status: 'successful', meta: { user_id: A } },
    })
    expect(res.status).toBe(401)
    expect(store.extended).toEqual([])
  })

  it("checks Flutterwave's record, not the posted status", async () => {
    process.env.FLW_WEBHOOK_SECRET = 'hook-secret'
    const { txRef } = await openCheckout(A)
    vi.mocked(verifyTransactionById).mockResolvedValue({ status: 'failed', id: '80', txRef, amount: 1500, currency: 'RWF' })
    const res = await post(
      webhook,
      '/api/payments/flutterwave/webhook',
      { event: 'charge.completed', data: { id: 80, status: 'successful', tx_ref: txRef } },
      { 'verif-hash': 'hook-secret' },
    )
    expect(res.status).toBe(200)
    expect(store.extended).toEqual([])
  })

  it('does not extend twice when the webhook follows /verify', async () => {
    process.env.FLW_WEBHOOK_SECRET = 'hook-secret'
    const { txRef, amount } = await openCheckout(A)
    vi.mocked(verifyTransactionById).mockResolvedValue({ status: 'successful', id: '81', txRef, amount, currency: 'RWF' })
    await post(verify, '/api/payments/flutterwave/verify', { user_id: A, transaction_id: '81' })
    await post(
      webhook,
      '/api/payments/flutterwave/webhook',
      { event: 'charge.completed', data: { id: 81 } },
      { 'verif-hash': 'hook-secret' },
    )
    expect(store.extended).toEqual([A])
  })

  it('ignores non-charge events and rejects an invalid secret', async () => {
    process.env.FLW_WEBHOOK_SECRET = 'hook-secret'
    const ignored = await post(
      webhook,
      '/api/payments/flutterwave/webhook',
      { event: 'transfer.completed', data: { id: 99 } },
      { 'verif-hash': 'hook-secret' },
    )
    expect(ignored.status).toBe(200)
    expect(verifyTransactionById).not.toHaveBeenCalled()

    const invalid = await post(
      webhook,
      '/api/payments/flutterwave/webhook',
      { event: 'charge.completed', data: { id: 99 } },
      { 'verif-hash': 'wrong-secret' },
    )
    expect(invalid.status).toBe(401)
  })
})
