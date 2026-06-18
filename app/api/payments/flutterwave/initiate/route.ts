import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { supabase } from '@/lib/supabase'
import {
  convertUsd,
  createFlutterwaveCheckout,
  ensurePaymentPlan,
  getFlutterwaveRedirectUrl,
  isFlutterwaveConfigured,
  roundForCurrency,
} from '@/lib/flutterwave'

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

    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, role')
      .eq('id', userId)
      .maybeSingle()

    if (error || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const email = String(body.email ?? user.email ?? '').trim() || `user+${userId.slice(0, 8)}@studysquare.org`
    const amountUsd = Number(body.amount ?? process.env.FLW_SUBSCRIPTION_AMOUNT_USD ?? 5)
    const currency = String(body.currency ?? 'USD').toUpperCase()
    const interval = String(body.interval ?? 'monthly')

    let amountToCharge = amountUsd
    if (currency !== 'USD') {
      amountToCharge = roundForCurrency(await convertUsd(amountUsd, currency), currency)
    }

    const planId = await ensurePaymentPlan(amountToCharge, currency, interval)
    const txRef = `sub_${userId.replace(/-/g, '').slice(0, 12)}_${randomBytes(5).toString('hex')}`

    const { link } = await createFlutterwaveCheckout({
      email,
      amount: amountToCharge,
      currency,
      planId,
      txRef,
      redirectUrl: getFlutterwaveRedirectUrl(request.nextUrl.origin),
      meta: {
        user_id: userId,
        country: { USD: 'US', NGN: 'NG', UGX: 'UG', RWF: 'RW', KES: 'KE', GHS: 'GH' }[currency] ?? 'US',
      },
    })

    return NextResponse.json({ checkoutUrl: link, paymentReference: txRef })
  } catch (err: unknown) {
    console.error('Flutterwave initiate error:', err)
    const message = err instanceof Error ? err.message : 'Failed to initiate payment'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
