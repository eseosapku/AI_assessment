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

    const email = String(body.email ?? user.email ?? '').trim() || `user+${userId.slice(0, 8)}@studysquare.org`
    const currency = String(body.currency ?? process.env.FLW_SUBSCRIPTION_CURRENCY ?? 'USD').toUpperCase()
    if (!isSupportedCheckoutCurrency(currency)) {
      return NextResponse.json({ error: 'Unsupported currency' }, { status: 400 })
    }
    const interval = String(body.interval ?? 'monthly')

    // body.amount used to be charged as sent, so a subscription cost whatever
    // the caller typed. The price is the server's, and it is recorded so the
    // payment can be checked against it later.
    const quote = await quoteSubscription(currency)
    const amountToCharge = quote.amount

    const txRef = `sub_${user.id}_${randomBytes(4).toString('hex')}`
    await recordCheckout(txRef, String(user.id), quote)
    const meta = {
      user_id: userId,
      country: { USD: 'US', NGN: 'NG', UGX: 'UG', RWF: 'RW', KES: 'KE', GHS: 'GH' }[currency] ?? 'US',
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

    return NextResponse.json({ checkoutUrl: link, paymentReference: txRef })
  } catch (err: unknown) {
    console.error('Flutterwave initiate error:', err)
    const message = err instanceof Error ? err.message : 'Failed to initiate payment'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
