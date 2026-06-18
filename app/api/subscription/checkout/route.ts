import { NextRequest, NextResponse } from 'next/server'
import { getSubscriptionSnapshot } from '@/lib/subscription-server'
import { supabase } from '@/lib/supabase'
import {
  createNardoPaySubscriptionLink,
  getNardoPayLinkCode,
  nardoPayRedirectUrl,
  nardoPaySubscribeUrl,
  nardoPayWebhookUrl,
  NARDOPAY_PRODUCT_NAME,
} from '@/lib/nardopay'

/**
 * Returns checkout details for the subscribe modal / widget.
 * Uses the configured link code by default; can provision a new link via API when requested.
 */
export async function GET(request: NextRequest) {
  const userId = String(request.nextUrl.searchParams.get('user_id') ?? '').trim()
  if (!userId) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
  }

  const origin = request.nextUrl.origin
  const snapshot = await getSubscriptionSnapshot(userId)
  if (!snapshot) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const { data: user } = await supabase.from('users').select('email, name').eq('id', userId).maybeSingle()
  const email = user?.email ? String(user.email).toLowerCase() : null

  const linkCode = getNardoPayLinkCode()
  const subscribeUrl = nardoPaySubscribeUrl({ email, userId, origin })
  const redirectUrl = nardoPayRedirectUrl(origin)
  const webhookUrl = nardoPayWebhookUrl(origin)

  return NextResponse.json({
    data: {
      productName: NARDOPAY_PRODUCT_NAME,
      linkCode,
      subscribeUrl,
      redirectUrl,
      webhookUrl,
      email,
      alreadySubscribed: snapshot.isSubscribed,
      // NardoPay has no dashboard webhook field — webhooks only attach to API-created links.
      integrationNote:
        'Use the in-app Subscribe button (NardoPay widget) for instant access. Run scripts/setup-nardopay-link.js once to create an API link with webhooks.',
    },
  })
}

/** Optional: create a fresh subscription link with webhook + redirect wired (admin/setup). */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const origin = request.nextUrl.origin
    const amount = Number(body.amount)
    const currency = String(body.currency ?? 'RWF').trim().toUpperCase()

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'amount is required' }, { status: 400 })
    }

    const result = await createNardoPaySubscriptionLink({
      planName: String(body.plan_name ?? NARDOPAY_PRODUCT_NAME),
      amount,
      currency,
      billingCycle: body.billing_cycle === 'yearly' ? 'yearly' : 'monthly',
      description: String(body.description ?? 'StudySquare subscription'),
      webhookUrl: nardoPayWebhookUrl(origin),
      redirectUrl: nardoPayRedirectUrl(origin),
      trialDays: Number(body.trial_days) || 0,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 502 })
    }

    return NextResponse.json({ data: result })
  } catch (err) {
    console.error('NardoPay checkout provision error:', err)
    return NextResponse.json({ error: 'Failed to create NardoPay link' }, { status: 500 })
  }
}
