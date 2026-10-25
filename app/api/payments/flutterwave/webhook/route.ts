import { NextRequest, NextResponse } from 'next/server'
import { settleSubscriptionPayment } from '@/lib/subscription-server'
import { verifyTransactionById, verifyWebhookSignature } from '@/lib/flutterwave'

/**
 * Flutterwave webhook (V3 + V4):
 * URL: https://studysquare.org/api/payments/flutterwave/webhook
 */
export async function POST(request: NextRequest) {
  try {
    if (!process.env.DATABASE_URL) {
      console.error('Webhook: DATABASE_URL missing')
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 503 })
    }

    const rawBody = await request.text()
    const verifHash = request.headers.get('verif-hash')
    const flutterwaveSignature = request.headers.get('flutterwave-signature')

    if (!verifyWebhookSignature(rawBody, { verifHash, flutterwaveSignature })) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const payload = rawBody ? JSON.parse(rawBody) : {}
    const eventType = payload?.type ?? payload?.event ?? payload?.['event.type']
    const data = payload?.data ?? {}

    const isChargeEvent =
      !eventType ||
      eventType === 'charge.completed' ||
      eventType === 'subscription.charge.completed' ||
      String(eventType).toLowerCase().includes('charge')
    if (!isChargeEvent) {
      return NextResponse.json({ ignored: true, event: eventType })
    }

    const transactionId = data?.id != null ? String(data.id) : ''
    if (!transactionId) {
      return NextResponse.json({ skipped: true, reason: 'no transaction id' })
    }

    // The payload's status, amount and user were trusted as posted. Flutterwave's
    // own record of the transaction is what gets checked.
    const txn = await verifyTransactionById(transactionId)
    if (!txn) {
      // Lookup failed rather than said no; a 5xx makes Flutterwave retry.
      return NextResponse.json({ error: 'Could not confirm the transaction' }, { status: 502 })
    }
    const settled = await settleSubscriptionPayment(txn)
    if (!settled.ok) {
      // 2xx so Flutterwave stops retrying a payment that will never qualify.
      return NextResponse.json({ ignored: true, reason: settled.error })
    }
    return NextResponse.json({ updated: settled.applied, user_id: settled.userId })
  } catch (err) {
    console.error('Flutterwave webhook error:', err)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
