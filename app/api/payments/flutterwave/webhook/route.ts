import { NextRequest, NextResponse } from 'next/server'
import { activateSubscription } from '@/lib/subscription-server'
import { verifyWebhookSignature } from '@/lib/flutterwave'

/**
 * Flutterwave webhook (V3 + V4):
 * URL: https://studysquare.org/api/payments/flutterwave/webhook
 * Secret hash: your chosen 36-char string (same value as FLW_WEBHOOK_SECRET on Vercel)
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    const verifHash = request.headers.get('verif-hash')
    const flutterwaveSignature = request.headers.get('flutterwave-signature')

    if (!verifyWebhookSignature(rawBody, { verifHash, flutterwaveSignature })) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const payload = rawBody ? JSON.parse(rawBody) : {}
    const eventType = payload?.type ?? payload?.event ?? payload?.['event.type']
    const data = payload?.data ?? {}
    const meta = data?.meta ?? {}
    let userId = meta?.user_id != null ? String(meta.user_id) : ''

    if (!userId) {
      const email = data?.customer?.email
      if (email) {
        const { supabase } = await import('@/lib/supabase')
        const { data: user } = await supabase.from('users').select('id').eq('email', String(email).toLowerCase()).maybeSingle()
        if (user?.id) userId = user.id
      }
    }

    if (!userId) {
      return NextResponse.json({ skipped: true, reason: 'could not resolve user' })
    }

    const status = String(data?.status ?? '').toLowerCase()
    const paid = status === 'successful' || status === 'succeeded'
    const isChargeEvent =
      eventType === 'charge.completed' ||
      eventType === 'subscription.charge.completed'

    if (isChargeEvent && paid) {
      const cycleEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      await activateSubscription({
        userId,
        ref: data?.id != null ? String(data.id) : undefined,
        expiresAt: cycleEnd,
        provider: 'flutterwave',
      })
      return NextResponse.json({ updated: true, user_id: userId, expires: cycleEnd })
    }

    return NextResponse.json({ ignored: true, event: eventType, status })
  } catch (err) {
    console.error('Flutterwave webhook error:', err)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
