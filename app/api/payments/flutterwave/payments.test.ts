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
import { createFlutterwaveCheckout, verifyTransactionById } from '@/lib/flutterwave'
import { POST as initiate } from './initiate/route'
import { POST as verify } from './verify/route'
import { POST as webhook } from './webhook/route'

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

/** Just enough Postgres for these routes: checkouts, spent payments, extensions. */
function fakeDatabase() {
  const users = new Set([A, B])
  const checkouts = new Map<string, { user_id: string; amount: number; currency: string }>()
  const payments = new Map<string, string>()
  const extended: string[] = []
  vi.mocked(db.query).mockImplementation((async (sql: string, params: any[] = []) => {
    if (/SELECT id, email, role FROM users/.test(sql)) {
      return { rows: users.has(params[0]) ? [{ id: params[0], email: 'p@example.com', role: 'student' }] : [] }
    }
    if (/INSERT INTO subscription_checkouts/.test(sql)) {
      checkouts.set(params[0], { user_id: params[1], amount: params[2], currency: params[3] })
      return { rows: [] }
    }
    if (/FROM subscription_checkouts/.test(sql)) {
      const row = checkouts.get(params[0])
      return { rows: row ? [row] : [] }
    }
    if (/WITH claimed AS/.test(sql)) {
      if (payments.has(params[0])) return { rows: [] }
      payments.set(params[0], params[1])
      extended.push(params[1])
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
  return { checkouts, extended }
}

const post = (handler: (r: NextRequest) => Promise<Response>, path: string, body: unknown, headers = {}) =>
  handler(new NextRequest(`http://localhost${path}`, { method: 'POST', body: JSON.stringify(body), headers }))

let store: ReturnType<typeof fakeDatabase>
beforeEach(() => {
  vi.mocked(db.query).mockReset()
  vi.mocked(verifyTransactionById).mockReset()
  vi.mocked(createFlutterwaveCheckout).mockClear()
  store = fakeDatabase()
})

describe('opening a checkout', () => {
  // body.amount was charged as sent.
  it('charges the server price, not the amount in the request', async () => {
    const res = await post(initiate, '/api/payments/flutterwave/initiate', { user_id: A, currency: 'RWF', amount: 1 })
    expect(res.status).toBe(200)
    const charged = vi.mocked(createFlutterwaveCheckout).mock.calls[0][0]
    expect(charged.amount).toBeGreaterThan(1)
    expect([...store.checkouts.values()][0]).toMatchObject({ user_id: A, amount: charged.amount, currency: 'RWF' })
  })

  it('refuses a currency there is no price for', async () => {
    const res = await post(initiate, '/api/payments/flutterwave/initiate', { user_id: A, currency: 'XYZ' })
    expect(res.status).toBe(400)
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
})
