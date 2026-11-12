import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { db } from '@/lib/db'
import {
  createFlutterwaveCheckout,
  ensurePaymentPlan,
  getFlutterwaveRedirectUrl,
  isFlutterwaveConfigured,
  supportsFlutterwavePaymentPlan,
} from '@/lib/flutterwave'
import { isSupportedCheckoutCurrency } from '@/lib/subscription-pricing'
import { quoteSubscription, recordCheckout } from '@/lib/subscription-server'
import { discountedSubscriptionQuote, normalizeReferralCode, validateReferralCode } from '@/lib/referrals'

export async function POST(request: NextRequest) {
  try {
    if (!isFlutterwaveConfigured()) {
      return NextResponse.json({ error: 'Payment service is not configured. Please contact support.' }, { status: 503 })
    }

    const body = await request.json()
    const userId = String(body.user_id ?? '').trim()
    if (!userId) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
    }

    const userResult = await db.query(
      'SELECT id, email, role FROM users WHERE id = $1 LIMIT 1',
      [userId]
    )
    const user = userResult.rows[0]

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // A recurring Flutterwave subscription is permanently tied to this email.
    // Use the account record, never a caller-supplied email or a fake fallback.
    const email = String(user.email ?? '').trim()
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ error: 'A valid account email is required for payment.' }, { status: 400 })
    }
    const currency = String(body.currency ?? process.env.FLW_SUBSCRIPTION_CURRENCY ?? 'USD').toUpperCase()
    if (!isSupportedCheckoutCurrency(currency)) {
      return NextResponse.json({ error: 'Unsupported currency' }, { status: 400 })
    }
    // This product is monthly. Letting the browser choose this could create a
    // daily/yearly Flutterwave plan while the app still grants 30-day access.
    const interval = 'monthly'

    // body.amount used to be charged as sent, so a subscription cost whatever
    // the caller typed. The price is the server's, and it is recorded so the
    // payment can be checked against it later.
    const baseQuote = await quoteSubscription(currency)
    let quote = baseQuote
    let appliedReferral: { id: string; code: string; discountPercentage: number } | null = null
    const requestedReferralCode = normalizeReferralCode(body.referral_code)
    if (requestedReferralCode) {
      const validation = await validateReferralCode(requestedReferralCode, userId)
      if (!validation.ok) {
        return NextResponse.json({ error: validation.error }, { status: validation.status })
      }
      appliedReferral = {
        id: validation.referral.id,
        code: validation.referral.code,
        discountPercentage: validation.referral.discountPercentage,
      }
      quote = discountedSubscriptionQuote(baseQuote, appliedReferral.discountPercentage)
    }
    const amountToCharge = quote.amount

    const txRef = `sub_${user.id}_${randomBytes(4).toString('hex')}`
    await recordCheckout(
      txRef,
      String(user.id),
      quote,
      appliedReferral
        ? { id: appliedReferral.id, baseAmount: baseQuote.amount, discountPercentage: appliedReferral.discountPercentage }
        : null,
    )
    const meta = {
      user_id: userId,
      country: { USD: 'US', NGN: 'NG', UGX: 'UG', RWF: 'RW', KES: 'KE', GHS: 'GH' }[currency] ?? 'US',
      ...(appliedReferral ? { referral_code: appliedReferral.code } : {}),
    }

    const planId = supportsFlutterwavePaymentPlan(currency)
      ? await ensurePaymentPlan(amountToCharge, currency, interval)
      : undefined

    const { link } = await createFlutterwaveCheckout({
      email,
      amount: amountToCharge,
      currency,
      planId,
      txRef,
      redirectUrl: getFlutterwaveRedirectUrl(request.nextUrl.origin),
      meta,
    })

    return NextResponse.json({
      checkoutUrl: link,
      paymentReference: txRef,
      amount: amountToCharge,
      currency,
      referral: appliedReferral
        ? { code: appliedReferral.code, discountPercentage: appliedReferral.discountPercentage }
        : null,
    })
  } catch (err: unknown) {
    console.error('Flutterwave initiate error:', err)
    const message = err instanceof Error ? err.message : 'Failed to initiate payment'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
