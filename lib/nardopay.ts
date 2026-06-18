/**
 * NardoPay server integration — https://nardopay.com/docs
 * API key must stay server-side (NARDOPAY_API_KEY).
 */

export const NARDOPAY_API_BASE =
  'https://mczqwqsvumfsneoknlep.supabase.co/functions/v1'

export const NARDOPAY_DEFAULT_LINK_CODE = 'ca4ccd44ca22c6e0'
export const NARDOPAY_PRODUCT_NAME = 'Study Square'

export type NardoPayWebhookPayload = {
  event?: string
  transaction_id?: string
  subscription_id?: string
  amount?: number
  currency?: string
  status?: string
  subscription_status?: string
  payer_email?: string
  payer_name?: string
  link_code?: string
  // legacy / alternate shapes
  postback_secret?: string
  secret?: string
  label?: string
  customer_email?: string
  email?: string
  tx_hash?: string
  tx_id?: string
  id?: string
  expires_at?: string
  subscription_expires_at?: string
  metadata?: Record<string, unknown>
}

export type NardoPayCheckoutSuccess = {
  transaction_id?: string
  subscription_id?: string
  status?: string
  payer_email?: string
  payer_name?: string
  amount?: number
  currency?: string
}

export function getNardoPayApiKey(): string | null {
  const key = String(process.env.NARDOPAY_API_KEY ?? '').trim()
  return key || null
}

export function getNardoPayLinkCode(): string {
  return (
    process.env.NEXT_PUBLIC_NARDOPAY_LINK_CODE ||
    process.env.NARDOPAY_LINK_CODE ||
    NARDOPAY_DEFAULT_LINK_CODE
  ).trim()
}

export function getAppBaseUrl(fallbackOrigin?: string): string {
  const configured = String(process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? '').trim()
  if (configured) return configured.replace(/\/$/, '')
  if (fallbackOrigin) return fallbackOrigin.replace(/\/$/, '')
  const vercel = String(process.env.VERCEL_URL ?? '').trim()
  if (vercel) return `https://${vercel}`
  return 'http://localhost:3000'
}

export function nardoPayWebhookUrl(origin?: string): string {
  return `${getAppBaseUrl(origin)}/api/subscription/webhook`
}

export function nardoPayRedirectUrl(origin?: string): string {
  return `${getAppBaseUrl(origin)}/subscription/success`
}

export function nardoPaySubscribeUrl(params?: {
  email?: string | null
  userId?: string | null
  origin?: string
}): string {
  const code = getNardoPayLinkCode()
  const url = new URL(`https://nardopay.com/subscribe/${code}`)
  if (params?.email) url.searchParams.set('email', params.email)
  if (params?.userId) url.searchParams.set('metadata', JSON.stringify({ user_id: params.userId }))
  const redirect = nardoPayRedirectUrl(params?.origin)
  url.searchParams.set('redirect_url', redirect)
  return url.toString()
}

const PAID_STATUSES = new Set(['completed', 'paid', 'active', 'success', 'successful'])
const PAID_EVENTS = new Set([
  'payment.completed',
  'subscription.completed',
  'subscription.activated',
  'payment.success',
])

export function isNardoPayPaidPayload(body: NardoPayWebhookPayload): boolean {
  const event = String(body.event ?? '').toLowerCase()
  if (event && PAID_EVENTS.has(event)) return true
  const status = String(body.status ?? body.subscription_status ?? '').toLowerCase()
  return PAID_STATUSES.has(status)
}

export function extractNardoPayPayer(body: NardoPayWebhookPayload): {
  email: string | null
  userId: string | null
  ref: string | null
  expiresAt: string | null
} {
  const metaUserId =
    typeof body.metadata === 'object' && body.metadata && 'user_id' in body.metadata
      ? String((body.metadata as { user_id?: unknown }).user_id ?? '').trim() || null
      : null

  const label = String(body.label ?? '').trim()
  const userIdMatch = label.match(/user[:\s-]+([0-9a-f-]{36})/i)

  let email: string | null = null
  const payerEmail = String(body.payer_email ?? body.customer_email ?? body.email ?? '').trim()
  if (payerEmail.includes('@')) email = payerEmail.toLowerCase()
  else if (label.includes('@')) email = label.toLowerCase()

  const ref =
    String(
      body.transaction_id ??
        body.subscription_id ??
        body.tx_hash ??
        body.tx_id ??
        body.id ??
        '',
    ).trim() || null

  const expiresAt = body.expires_at ?? body.subscription_expires_at ?? null

  return {
    email,
    userId: metaUserId || (userIdMatch ? userIdMatch[1] : null),
    ref,
    expiresAt: expiresAt ? String(expiresAt) : null,
  }
}

export function verifyNardoPayWebhookAuth(request: Request, body: NardoPayWebhookPayload): boolean {
  const apiKey = getNardoPayApiKey()
  const auth = request.headers.get('authorization') ?? ''
  if (apiKey && auth === `Bearer ${apiKey}`) return true

  const webhookSecret = String(process.env.NARDOPAY_WEBHOOK_SECRET ?? process.env.NARDOPAY_POSTBACK_SECRET ?? '').trim()
  if (webhookSecret) {
    const incoming = String(body.postback_secret ?? body.secret ?? request.headers.get('x-nardopay-signature') ?? '')
    if (incoming && incoming === webhookSecret) return true
    return false
  }

  // Docs do not publish a signature scheme yet — allow when no secret configured (dev).
  return !webhookSecret
}

export type CreateSubscriptionLinkInput = {
  planName?: string
  amount: number
  currency: string
  billingCycle?: 'monthly' | 'yearly' | 'weekly'
  description?: string
  webhookUrl: string
  redirectUrl: string
  trialDays?: number
}

export type CreateSubscriptionLinkResult =
  | { ok: true; linkId: string; linkCode: string; url: string }
  | { ok: false; error: string }

/** Create a subscription payment link via NardoPay API (optional — use existing link code by default). */
export async function createNardoPaySubscriptionLink(
  input: CreateSubscriptionLinkInput,
): Promise<CreateSubscriptionLinkResult> {
  const apiKey = getNardoPayApiKey()
  if (!apiKey) return { ok: false, error: 'NARDOPAY_API_KEY not configured' }

  const res = await fetch(`${NARDOPAY_API_BASE}/create-payment-link-api`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      link_type: 'subscription',
      plan_name: input.planName ?? NARDOPAY_PRODUCT_NAME,
      product_name: input.planName ?? NARDOPAY_PRODUCT_NAME,
      amount: input.amount,
      currency: input.currency,
      billing_cycle: input.billingCycle ?? 'monthly',
      trial_days: input.trialDays ?? 0,
      description: input.description ?? 'StudySquare unlimited assessments and StudyLab access',
      webhook_url: input.webhookUrl,
      redirect_url: input.redirectUrl,
    }),
  })

  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = json?.message || json?.error || `NardoPay API error (${res.status})`
    return { ok: false, error: String(msg) }
  }

  const linkCode = String(json.link_code ?? '').trim()
  const url = String(json.url ?? '').trim()
  if (!linkCode || !url) return { ok: false, error: 'NardoPay API returned an incomplete link' }

  return {
    ok: true,
    linkId: String(json.link_id ?? linkCode),
    linkCode,
    url,
  }
}

export function isNardoPayCheckoutSuccess(data: NardoPayCheckoutSuccess | null | undefined): boolean {
  if (!data) return false
  const status = String(data.status ?? '').toLowerCase()
  if (PAID_STATUSES.has(status)) return true
  return Boolean(data.transaction_id || data.subscription_id)
}
