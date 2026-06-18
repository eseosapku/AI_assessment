import { NextRequest, NextResponse } from 'next/server'
import { activateSubscription, getSubscriptionSnapshot } from '@/lib/subscription-server'
import { findTransactionByTxRef, verifyTransactionById } from '@/lib/flutterwave'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const userId = String(body.user_id ?? '').trim()
    const reference = String(body.reference ?? body.tx_ref ?? '').trim()
    const transactionId = String(body.transaction_id ?? '').trim()

    if (!userId) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
    }
    if (!reference && !transactionId) {
      return NextResponse.json({ error: 'reference or transaction_id is required' }, { status: 400 })
    }

    let flwVerified = false
    let paymentId: string | undefined
    let txRef = reference

    if (transactionId) {
      const txn = await verifyTransactionById(transactionId)
      if (txn?.status === 'successful') {
        flwVerified = true
        paymentId = txn.id
        if (txn.txRef) txRef = txn.txRef
      }
    }

    if (!flwVerified && txRef) {
      try {
        const txn = await findTransactionByTxRef(txRef)
        if (txn?.status === 'successful') {
          flwVerified = true
          paymentId = txn.id
        }
      } catch (e) {
        console.warn('Flutterwave verify lookup failed, optimistic activation:', e)
      }
    }

    const result = await activateSubscription({
      userId,
      ref: paymentId ?? txRef ?? transactionId,
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
      lastPaymentId: paymentId ?? txRef ?? transactionId,
      subscription: snapshot,
    })
  } catch (err: unknown) {
    console.error('Flutterwave verify error:', err)
    const message = err instanceof Error ? err.message : 'Verification failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
