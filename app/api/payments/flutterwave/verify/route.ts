import { NextRequest, NextResponse } from 'next/server'
import { getSubscriptionSnapshot, settleSubscriptionPayment } from '@/lib/subscription-server'
import { findTransactionByTxRef, verifyTransactionById } from '@/lib/flutterwave'
import { isPaidFlutterwaveStatus, type FlutterwaveTransaction } from '@/lib/subscription-payment'

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

    let txn: FlutterwaveTransaction | null = transactionId ? await verifyTransactionById(transactionId) : null

    if (!isPaidFlutterwaveStatus(txn?.status) && reference) {
      try {
        txn = await findTransactionByTxRef(reference)
      } catch (e) {
        console.warn('Flutterwave verify lookup failed:', e)
      }
    }

    if (!txn || !isPaidFlutterwaveStatus(txn.status)) {
      return NextResponse.json(
        {
          error:
            'Payment not confirmed. If you completed payment, wait a minute and refresh — webhook confirmation may still be pending.',
        },
        { status: 402 },
      )
    }

    // The transaction used to be applied to whichever user_id the body named,
    // and as many times as it was posted.
    const settled = await settleSubscriptionPayment(txn, userId)
    if (!settled.ok) {
      return NextResponse.json({ error: settled.error }, { status: settled.status })
    }

    const snapshot = await getSubscriptionSnapshot(settled.userId)
    return NextResponse.json({
      active: true,
      verified: true,
      expiresAt: snapshot?.expiresAt ?? undefined,
      lastPaymentId: settled.transactionId,
      subscription: snapshot,
    })
  } catch (err: unknown) {
    console.error('Flutterwave verify error:', err)
    const message = err instanceof Error ? err.message : 'Verification failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
