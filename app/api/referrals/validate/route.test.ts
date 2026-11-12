import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/referrals', async (importActual) => ({
  ...(await importActual<typeof import('@/lib/referrals')>()),
  validateReferralCode: vi.fn(),
}))
vi.mock('@/lib/subscription-server', () => ({ quoteSubscription: vi.fn() }))

import { validateReferralCode } from '@/lib/referrals'
import { quoteSubscription } from '@/lib/subscription-server'
import { POST } from './route'

const request = (body: unknown) => new NextRequest('http://localhost/api/referrals/validate', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

beforeEach(() => {
  vi.mocked(validateReferralCode).mockReset()
  vi.mocked(quoteSubscription).mockReset()
})

describe('referral price preview', () => {
  it('shows the same discounted RWF amount checkout will charge', async () => {
    vi.mocked(validateReferralCode).mockResolvedValue({
      ok: true,
      referral: {
        id: 'code-id', code: 'SAVE40', ownerUserId: 'owner', discountPercentage: 40, uses: 0,
      },
    })
    vi.mocked(quoteSubscription).mockResolvedValue({ amount: 1500, currency: 'RWF', converted: false })
    const response = await POST(request({ user_id: 'payer', code: 'save40', currency: 'RWF' }))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      code: 'SAVE40', discountPercentage: 40, originalAmount: 1500, amount: 900,
      originalFormatted: 'FRw 1,500', formatted: 'FRw 900',
    })
  })

  it('passes validation failures through without quoting a price', async () => {
    vi.mocked(validateReferralCode).mockResolvedValue({ ok: false, status: 400, error: 'You cannot use your own referral code.' })
    const response = await POST(request({ user_id: 'payer', code: 'MINE', currency: 'RWF' }))
    expect(response.status).toBe(400)
    expect(quoteSubscription).not.toHaveBeenCalled()
  })
})
