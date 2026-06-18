import { NextRequest, NextResponse } from 'next/server'
import { activateSubscription, resolveUserIdFromTxRef } from '@/lib/subscription-server'
import { verifyWebhookSignature } from '@/lib/flutterwave'
import { getSupabaseAdmin, hasSupabaseAdmin } from '@/lib/supabase-admin'

function extractMetaUserId(meta: unknown): string {
  if (!meta || typeof meta !== 'object') return ''
  const record = meta as Record<string, unknown>
  if (record.user_id != null) return String(record.user_id)
  if (Array.isArray(meta)) {
    for (const item of meta) {
      if (item && typeof item === 'object') {
        const row = item as Record<string, unknown>
        if (row.meta_name === 'user_id' || row.name === 'user_id') {
          return String(row.meta_value ?? row.value ?? '')
        }
      }
    }
  }
  return ''
}

/**
 * Flutterwave webhook (V3 + V4):
 * URL: https://studysquare.org/api/payments/flutterwave/webhook
 */
export async function POST(request: NextRequest) {
  try {
    if (!hasSupabaseAdmin()) {
      console.error('Webhook: SUPABASE_SERVICE_ROLE_KEY missing')
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
    const meta = data?.meta ?? {}
    let userId = extractMetaUserId(meta)

    if (!userId) {
      const txRef = data?.tx_ref != null ? String(data.tx_ref) : ''
      if (txRef) userId = (await resolveUserIdFromTxRef(txRef)) ?? ''
    }

    if (!userId) {
      const email = data?.customer?.email
      if (email) {
        const db = getSupabaseAdmin()
        const { data: user } = await db.from('users').select('id').eq('email', String(email).toLowerCase()).maybeSingle()
        if (user?.id) userId = user.id
      }
    }

    if (!userId) {
      return NextResponse.json({ skipped: true, reason: 'could not resolve user' })
    }

    const status = String(data?.status ?? '').toLowerCase()
    const paid = status === 'successful' || status === 'succeeded'
    const isChargeEvent =
      !eventType ||
      eventType === 'charge.completed' ||
      eventType === 'subscription.charge.completed' ||
      String(eventType).toLowerCase().includes('charge')

    if (isChargeEvent && paid) {
      const cycleEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      const result = await activateSubscription({
        userId,
        ref: data?.id != null ? String(data.id) : undefined,
        expiresAt: cycleEnd,
        provider: 'flutterwave',
      })
      if (!result.ok) {
        console.error('Webhook activation failed:', result.error)
        return NextResponse.json({ error: result.error ?? 'Activation failed' }, { status: 500 })
      }
      return NextResponse.json({ updated: true, user_id: userId, expires: cycleEnd })
    }

    return NextResponse.json({ ignored: true, event: eventType, status })
  } catch (err) {
    console.error('Flutterwave webhook error:', err)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
