import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHmac } from 'node:crypto'

const originalEnv = { ...process.env }

beforeEach(() => {
  vi.restoreAllMocks()
  vi.resetModules()
  process.env.FLW_SECRET_KEY = 'FLWSECK_TEST-example'
  process.env.FLW_WEBHOOK_SECRET = 'webhook-secret'
  delete process.env.FLW_PLAN_ID
})

afterEach(() => {
  process.env = { ...originalEnv }
  vi.unstubAllGlobals()
})

describe('Flutterwave payment method configuration', () => {
  it('offers Card and the correct local wallet for every supported MoMo market', async () => {
    const { paymentOptionsForCurrency } = await import('./flutterwave')
    expect(paymentOptionsForCurrency('RWF')).toBe('card, mobilemoneyrwanda')
    expect(paymentOptionsForCurrency('UGX')).toBe('card, mobilemoneyuganda')
    expect(paymentOptionsForCurrency('KES')).toBe('card, mpesa')
    expect(paymentOptionsForCurrency('GHS')).toBe('card, mobilemoneyghana')
    expect(paymentOptionsForCurrency('USD')).toContain('card')
  })

  it('forces card when a recurring payment plan is attached', async () => {
    const calls: any[] = []
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      calls.push(JSON.parse(String(init?.body)))
      return Response.json({ status: 'success', data: { link: 'https://checkout.flutterwave.com/test' } })
    }))
    const { createFlutterwaveCheckout } = await import('./flutterwave')
    await createFlutterwaveCheckout({
      email: 'payer@example.com',
      amount: 5,
      currency: 'USD',
      planId: '42',
      txRef: 'sub_ref',
    })
    expect(calls[0]).toMatchObject({ payment_plan: '42', payment_options: 'card', amount: 5, currency: 'USD' })
  })
})

describe('Flutterwave verification and webhooks', () => {
  it('uses the dedicated verify-by-reference endpoint', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => Response.json({
      status: 'success',
      data: { id: 7, tx_ref: 'sub_ref', status: 'successful', amount: 1500, currency: 'RWF' },
    }))
    vi.stubGlobal('fetch', fetchMock)
    const { findTransactionByTxRef } = await import('./flutterwave')
    expect(await findTransactionByTxRef('sub ref')).toMatchObject({ id: '7', txRef: 'sub_ref', status: 'successful' })
    expect(String(fetchMock.mock.calls[0][0])).toContain('/v3/transactions/verify_by_reference?tx_ref=sub%20ref')
  })

  it('accepts the configured v3 secret hash and rejects missing secrets', async () => {
    const { verifyWebhookSignature } = await import('./flutterwave')
    expect(verifyWebhookSignature('{}', { verifHash: 'webhook-secret', flutterwaveSignature: null })).toBe(true)
    expect(verifyWebhookSignature('{}', { verifHash: 'wrong', flutterwaveSignature: null })).toBe(false)
    delete process.env.FLW_WEBHOOK_SECRET
    expect(verifyWebhookSignature('{}', { verifHash: 'webhook-secret', flutterwaveSignature: null })).toBe(false)
  })

  it('also validates a raw-body HMAC signature when supplied', async () => {
    const raw = '{"event":"charge.completed"}'
    const signature = createHmac('sha256', 'webhook-secret').update(raw).digest('base64')
    const { verifyWebhookSignature } = await import('./flutterwave')
    expect(verifyWebhookSignature(raw, { verifHash: null, flutterwaveSignature: signature })).toBe(true)
    expect(verifyWebhookSignature(`${raw} `, { verifHash: null, flutterwaveSignature: signature })).toBe(false)
  })

  it('parses metadata returned as either an object or an array', async () => {
    const { parseFlutterwaveTransaction } = await import('./flutterwave')
    expect(parseFlutterwaveTransaction({ meta: { user_id: 'user-a' } }).metaUserId).toBe('user-a')
    expect(parseFlutterwaveTransaction({ meta: [{ meta_name: 'user_id', meta_value: 'user-b' }] }).metaUserId).toBe('user-b')
  })
})

describe('payment plan reuse', () => {
  it('reuses a matching active plan instead of creating one on a cold instance', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      expect(url).toContain('/v3/payment-plans?')
      return Response.json({
        status: 'success',
        data: [{ id: 3807, amount: 5, currency: 'USD', interval: 'monthly', status: 'active' }],
      })
    })
    vi.stubGlobal('fetch', fetchMock)
    const { ensurePaymentPlan } = await import('./flutterwave')
    expect(await ensurePaymentPlan(5, 'USD', 'monthly')).toBe('3807')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
