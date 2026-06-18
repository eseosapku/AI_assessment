import { NextRequest, NextResponse } from 'next/server'
import { activateSubscription } from '@/lib/subscription-server'
import {
  extractNardoPayPayer,
  isNardoPayPaidPayload,
  type NardoPayWebhookPayload,
  verifyNardoPayWebhookAuth,
} from '@/lib/nardopay'

/**
 * NardoPay webhook — https://nardopay.com/docs#webhooks
 *
 * Expected payload:
 * {
 *   "event": "payment.completed",
 *   "transaction_id": "uuid",
 *   "status": "completed",
 *   "payer_email": "customer@example.com",
 *   ...
 * }
 *
 * Configure webhook URL in NardoPay dashboard (or via create-payment-link-api):
 *   https://YOUR_DOMAIN/api/subscription/webhook
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as NardoPayWebhookPayload

    if (!verifyNardoPayWebhookAuth(request, body)) {
      console.warn('NardoPay webhook: unauthorized')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isNardoPayPaidPayload(body)) {
      return NextResponse.json({ ok: true, ignored: true, event: body.event, status: body.status })
    }

    const { email, userId, ref, expiresAt } = extractNardoPayPayer(body)
    if (!email && !userId) {
      console.error('NardoPay webhook: no payer email or user id', body)
      return NextResponse.json({ error: 'payer_email or user_id required' }, { status: 422 })
    }

    const result = await activateSubscription({ userId, email, ref, expiresAt })
    if (!result.ok) {
      console.error('NardoPay webhook activation failed:', result.error, body)
      return NextResponse.json({ error: result.error ?? 'Activation failed' }, { status: 422 })
    }

    console.log('NardoPay subscription activated for user', result.userId, 'event=', body.event)
    return NextResponse.json({ ok: true, user_id: result.userId })
  } catch (err) {
    console.error('NardoPay webhook error:', err)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}
