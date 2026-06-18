import { NextRequest, NextResponse } from 'next/server'
import { activateSubscription } from '@/lib/subscription-server'
import { findTransactionByTxRef } from '@/lib/flutterwave'
import { getSubscriptionSnapshot } from '@/lib/subscription-server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const userId = String(body.user_id ?? '').trim()
    const reference = String(body.reference ?? '').trim()

    if (!userId || !reference) {
      return NextResponse.json({ error: 'user_id and reference are required' }, { status: 400 })
    }

    let flwVerified = false
    let paymentId: string | undefined
    try {
      const txn = await findTransactionByTxRef(reference)
      if (txn?.status === 'successful') {
        flwVerified = true
        paymentId = txn.id
      }
    } catch (e) {
      console.warn('Flutterwave verify lookup failed, optimistic activation:', e)
    }

    const result = await activateSubscription({
      userId,
      ref: paymentId ?? reference,
      provider: 'flutterwave',
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? 'Activation failed' }, { status: 400 })
    }

    const snapshot = await getSubscriptionSnapshot(userId)
    return NextResponse.json({
      active: true,
      verified: flwVerified,
      expiresAt: snapshot?.expiresAt ?? undefined,
      lastPaymentId: paymentId ?? reference,
      subscription: snapshot,
    })
  } catch (err: unknown) {
    console.error('Flutterwave verify error:', err)
    const message = err instanceof Error ? err.message : 'Verification failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
