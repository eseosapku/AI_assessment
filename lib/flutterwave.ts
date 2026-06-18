/**
 * Flutterwave server integration — ported from BrainInk-Backend-1/users_micro/services/flutterwave_client.py
 * Docs: https://developer.flutterwave.com/docs
 */

const FLW_BASE = process.env.FLW_BASE ?? 'https://api.flutterwave.com'
const FLW_SECRET_KEY = process.env.FLW_SECRET_KEY ?? ''
const FLW_PUBLIC_KEY = process.env.FLW_PUBLIC_KEY ?? ''
let FLW_PLAN_ID = process.env.FLW_PLAN_ID ?? ''

export function getFlutterwaveRedirectUrl(origin?: string | null): string {
  const base = (process.env.FLW_REDIRECT_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? origin ?? 'http://localhost:3000').replace(/\/$/, '')
  return `${base}/subscription/success`
}

export function getFlutterwaveWebhookUrl(origin?: string | null): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? origin ?? 'http://localhost:3000').replace(/\/$/, '')
  return `${base}/api/payments/flutterwave/webhook`
}

export function isFlutterwaveConfigured(): boolean {
  return Boolean(FLW_SECRET_KEY)
}

const MOMO_MAP: Record<string, string> = {
  UGX: 'mobilemoneyuganda',
  KES: 'mpesa',
  RWF: 'mobilemoneyrwanda',
  GHS: 'mobilemoneyghana',
  ZMW: 'mobilemoneyzambia',
  TZS: 'mobilemoneytanzania',
  XAF: 'mobilemoneyfranco',
  XOF: 'mobilemoneyfranco',
}

async function flwFetch(path: string, init?: RequestInit) {
  if (!FLW_SECRET_KEY) {
    throw new Error('Payment service not configured. FLW_SECRET_KEY is required.')
  }
  const res = await fetch(`${FLW_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${FLW_SECRET_KEY}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(json?.message ?? json?.error ?? `Flutterwave error ${res.status}`)
  }
  return json
}

export async function convertUsd(amountUsd: number, toCurrency: string): Promise<number> {
  const currency = (toCurrency || 'USD').toUpperCase()
  if (currency === 'USD') return amountUsd
  try {
    const url = new URL('https://api.exchangerate.host/convert')
    url.searchParams.set('from', 'USD')
    url.searchParams.set('to', currency)
    url.searchParams.set('amount', String(amountUsd))
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10_000) })
    const data = await res.json()
    const result = data?.result
    if (result == null) throw new Error('no conversion result')
    return Number(result)
  } catch {
    const fallback: Record<string, number> = { NGN: 1500, UGX: 3800, RWF: 1300, KES: 130 }
    const rate = fallback[currency]
    return rate ? amountUsd * rate : amountUsd
  }
}

export function roundForCurrency(amount: number, currency: string): number {
  const zeroDecimal = new Set(['UGX', 'RWF'])
  return zeroDecimal.has(currency.toUpperCase()) ? Math.round(amount) : Math.round(amount * 100) / 100
}

export async function ensurePaymentPlan(amount: number, currency: string, interval: string, name = 'StudySquare Monthly'): Promise<string> {
  const cur = currency.toUpperCase()
  const iv = interval.toLowerCase()

  if (FLW_PLAN_ID) {
    try {
      const data = await flwFetch(`/v3/payment-plans/${FLW_PLAN_ID}`)
      const plan = data?.data ?? {}
      if (
        String(plan.currency ?? '').toUpperCase() === cur &&
        Math.abs(Number(plan.amount) - amount) < 0.0001 &&
        String(plan.interval ?? '').toLowerCase() === iv
      ) {
        return FLW_PLAN_ID
      }
    } catch {
      // create fresh plan below
    }
  }

  const created = await flwFetch('/v3/payment-plans', {
    method: 'POST',
    body: JSON.stringify({ amount, name, interval: iv, currency: cur }),
  })
  const planId = String(created?.data?.id ?? '')
  if (!planId) throw new Error('Flutterwave did not return a payment plan id')
  FLW_PLAN_ID = planId
  return planId
}

export async function createFlutterwaveCheckout(opts: {
  email: string
  amount: number
  currency: string
  planId?: string
  txRef: string
  meta?: Record<string, unknown>
  redirectUrl?: string
}): Promise<{ link: string; txRef: string }> {
  const currency = opts.currency.toUpperCase()
  const isMomo = currency in MOMO_MAP
  const paymentOptions = isMomo
    ? [MOMO_MAP[currency]]
    : currency === 'NGN'
      ? ['card', 'banktransfer', 'ussd']
      : ['card']

  const payload: Record<string, unknown> = {
    tx_ref: opts.txRef,
    amount: opts.amount,
    currency,
    redirect_url: opts.redirectUrl ?? getFlutterwaveRedirectUrl(),
    customer: { email: opts.email },
    customizations: {
      title: 'StudySquare Subscription',
      description: 'Monthly access to assessments and exam prep',
    },
    meta: opts.meta ?? {},
    payment_options: paymentOptions.join(','),
  }

  if (!isMomo && opts.planId) {
    payload.payment_plan = opts.planId
  }

  const res = await flwFetch('/v3/payments', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  const link = res?.data?.link
  if (!link) throw new Error('Flutterwave did not return a checkout link')
  return { link, txRef: opts.txRef }
}

export async function findTransactionByTxRef(txRef: string): Promise<{ status: string; id?: string } | null> {
  const data = await flwFetch(`/v3/transactions?tx_ref=${encodeURIComponent(txRef)}`)
  const rows = Array.isArray(data?.data) ? data.data : []
  if (!rows.length) return null
  const txn = rows[0]
  return { status: String(txn?.status ?? ''), id: txn?.id != null ? String(txn.id) : undefined }
}

import { createHmac, timingSafeEqual } from 'crypto'

export async function verifyTransactionById(transactionId: string): Promise<{ status: string; id?: string; txRef?: string } | null> {
  const id = String(transactionId).trim()
  if (!id) return null
  try {
    const data = await flwFetch(`/v3/transactions/${encodeURIComponent(id)}/verify`)
    const txn = data?.data ?? {}
    return {
      status: String(txn?.status ?? ''),
      id: txn?.id != null ? String(txn.id) : id,
      txRef: txn?.tx_ref != null ? String(txn.tx_ref) : undefined,
    }
  } catch {
    return null
  }
}

export function verifyWebhookSignature(
  rawBody: string,
  headers: { verifHash: string | null; flutterwaveSignature: string | null },
): boolean {
  const secret = process.env.FLW_WEBHOOK_SECRET ?? ''
  if (!secret) return true

  // V3: plain verif-hash header matches secret
  if (headers.verifHash) {
    return headers.verifHash === secret
  }

  // V4: HMAC-SHA256 of raw body, base64, in flutterwave-signature header
  if (headers.flutterwaveSignature) {
    const expected = createHmac('sha256', secret).update(rawBody).digest('base64')
    try {
      const a = Buffer.from(expected)
      const b = Buffer.from(headers.flutterwaveSignature)
      return a.length === b.length && timingSafeEqual(a, b)
    } catch {
      return false
    }
  }

  return false
}

export function flutterwaveDebugConfig() {
  return {
    base: FLW_BASE,
    public_key_present: Boolean(FLW_PUBLIC_KEY),
    secret_key_present: Boolean(FLW_SECRET_KEY),
    plan_id: FLW_PLAN_ID || null,
    redirect_url: getFlutterwaveRedirectUrl(),
    webhook_url: getFlutterwaveWebhookUrl(),
  }
}
