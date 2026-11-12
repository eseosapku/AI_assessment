import { afterEach, describe, expect, it, vi } from 'vitest'
import { getSubscriptionStatus, initiateMonthlySubscription, verifyPayment } from './flutterwave-client'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('browser payment payloads', () => {
  it('opens a monthly checkout with the selected currency', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      Response.json({ checkoutUrl: 'https://pay', paymentReference: 'ref' }))
    vi.stubGlobal('fetch', fetchMock)
    await initiateMonthlySubscription('user-1', 'payer@example.com', 'rwf')
    const [, init] = fetchMock.mock.calls[0]
    expect(JSON.parse(String(init?.body))).toEqual({
      user_id: 'user-1',
      email: 'payer@example.com',
      currency: 'RWF',
      interval: 'monthly',
    })
  })

  it('includes an applied referral code in the checkout request', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      Response.json({ checkoutUrl: 'https://pay', paymentReference: 'ref' }))
    vi.stubGlobal('fetch', fetchMock)
    await initiateMonthlySubscription('user-1', 'payer@example.com', 'RWF', 'SAVE40')
    const [, init] = fetchMock.mock.calls[0]
    expect(JSON.parse(String(init?.body))).toMatchObject({ referral_code: 'SAVE40' })
  })

  it('sends both redirect identifiers to server-side verification', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => Response.json({ active: true }))
    vi.stubGlobal('fetch', fetchMock)
    await verifyPayment('user-1', 'tx-ref', '99')
    const [, init] = fetchMock.mock.calls[0]
    expect(JSON.parse(String(init?.body))).toMatchObject({ user_id: 'user-1', reference: 'tx-ref', transaction_id: '99' })
  })

  it('reads the current status route response shape', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({
      data: { isSubscribed: true, expiresAt: '2030-01-01T00:00:00.000Z' },
    })))
    await expect(getSubscriptionStatus('user-1')).resolves.toEqual({
      active: true,
      expiresAt: '2030-01-01T00:00:00.000Z',
      lastPaymentId: undefined,
    })
  })
})
