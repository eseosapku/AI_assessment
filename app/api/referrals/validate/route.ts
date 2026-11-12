import { NextRequest, NextResponse } from 'next/server'
import { discountedSubscriptionQuote, validateReferralCode } from '@/lib/referrals'
import { quoteSubscription } from '@/lib/subscription-server'
import {
  formatSubscriptionPrice,
  isSupportedCheckoutCurrency,
} from '@/lib/subscription-pricing'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const userId = String(body?.user_id ?? '').trim()
    const currency = String(body?.currency ?? '').trim().toUpperCase()
    if (!userId) return NextResponse.json({ error: 'Sign in to apply a referral code.' }, { status: 400 })
    if (!isSupportedCheckoutCurrency(currency)) {
      return NextResponse.json({ error: 'Unsupported currency.' }, { status: 400 })
    }

    const validation = await validateReferralCode(body?.code, userId)
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: validation.status })
    }

    const base = await quoteSubscription(currency)
    const discounted = discountedSubscriptionQuote(base, validation.referral.discountPercentage)
    return NextResponse.json({
      code: validation.referral.code,
      discountPercentage: validation.referral.discountPercentage,
      currency,
      originalAmount: base.amount,
      amount: discounted.amount,
      originalFormatted: formatSubscriptionPrice(currency, base.amount, base.amount),
      formatted: formatSubscriptionPrice(currency, discounted.amount, discounted.amount),
    })
  } catch (error) {
    console.error('Referral validation error:', error)
    return NextResponse.json({ error: 'Could not validate that referral code.' }, { status: 500 })
  }
}
