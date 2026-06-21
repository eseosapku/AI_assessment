import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { db } from '@/lib/db'
import {
  convertUsd,
  createFlutterwaveCheckout,
  createRwandaMobileMoneyCharge,
  ensurePaymentPlan,
  getFlutterwaveRedirectUrl,
  isFlutterwaveConfigured,
  roundForCurrency,
  type RwandaMoMoNetwork,
} from '@/lib/flutterwave'
import { fixedLocalAmount } from '@/lib/subscription-pricing'

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
    const interval = String(body.interval ?? 'monthly')
    const fixedCurrency = (process.env.FLW_SUBSCRIPTION_CURRENCY ?? '').toUpperCase()
    const fixedAmount = process.env.FLW_SUBSCRIPTION_AMOUNT ? Number(process.env.FLW_SUBSCRIPTION_AMOUNT) : null
    const amountUsd = Number(process.env.FLW_SUBSCRIPTION_AMOUNT_USD ?? 5)

    let amountToCharge: number
    const fixedLocal = fixedLocalAmount(currency as 'RWF' | 'USD' | 'NGN' | 'UGX' | 'KES' | 'GHS')
    if (body.amount != null && body.amount !== '') {
      amountToCharge = Number(body.amount)
    } else if (fixedLocal != null) {
      amountToCharge = fixedLocal
    } else if (fixedAmount != null && currency === fixedCurrency) {
      amountToCharge = fixedAmount
    } else if (currency === 'USD') {
      amountToCharge = amountUsd
    } else {
      amountToCharge = roundForCurrency(await convertUsd(amountUsd, currency), currency)
    }
    amountToCharge = roundForCurrency(amountToCharge, currency)

    const txRef = `sub_${userId}_${randomBytes(4).toString('hex')}`
    const meta = {
      user_id: userId,
      country: { USD: 'US', NGN: 'NG', UGX: 'UG', RWF: 'RW', KES: 'KE', GHS: 'GH' }[currency] ?? 'US',
    }

    if (currency === 'RWF') {
      const phoneNumber = String(body.phone_number ?? '').trim()
      if (!phoneNumber) {
        return NextResponse.json({ error: 'MoMo phone number is required for Rwanda payments' }, { status: 400 })
      }
      const networkRaw = String(body.network ?? 'MTN').toUpperCase()
      const network: RwandaMoMoNetwork = networkRaw === 'AIRTEL' ? 'AIRTEL' : 'MTN'
      const { link } = await createRwandaMobileMoneyCharge({
        email,
        amount: amountToCharge,
        txRef,
        phoneNumber,
        network,
        meta,
      })
      return NextResponse.json({ checkoutUrl: link, paymentReference: txRef })
    }

    const planId = await ensurePaymentPlan(amountToCharge, currency, interval)

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
