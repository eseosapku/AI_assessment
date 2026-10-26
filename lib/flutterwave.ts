/**
 * Flutterwave server integration — ported from BrainInk-Backend-1/users_micro/services/flutterwave_client.py
 * Docs: https://developer.flutterwave.com/docs
 */

import { createHmac, timingSafeEqual } from 'crypto'
import type { FlutterwaveTransaction } from '@/lib/subscription-payment'

export { convertUsd, roundForCurrency } from '@/lib/fx-rates'

// Read at call time so Amplify/runtime env vars are not baked in as empty at build.
function flwBase(): string {
  return process.env.FLW_BASE?.trim() || 'https://api.flutterwave.com'
}

function flwSecretKey(): string {
  return process.env.FLW_SECRET_KEY?.trim() ?? ''
}

function flwPublicKey(): string {
  return process.env.FLW_PUBLIC_KEY?.trim() ?? ''
}

function flwPlanId(): string {
  return process.env.FLW_PLAN_ID?.trim() ?? ''
}

let cachedPlanId = ''

export function getFlutterwaveRedirectUrl(origin?: string | null): string {
  const configured = (process.env.FLW_REDIRECT_URL ?? '').trim().replace(/\/$/, '')
  if (configured) return configured

  const base = (process.env.NEXT_PUBLIC_APP_URL ?? origin ?? 'http://localhost:3000').replace(/\/$/, '')
  return `${base}/subscription/success`
}

export function getFlutterwaveWebhookUrl(origin?: string | null): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? origin ?? 'http://localhost:3000').replace(/\/$/, '')
  return `${base}/api/payments/flutterwave/webhook`
}

export function isFlutterwaveConfigured(): boolean {
  return Boolean(flwSecretKey())
}

const MOMO_ONLY: Record<string, string> = {
  UGX: 'mobilemoneyuganda',
  KES: 'mpesa',
  GHS: 'mobilemoneyghana',
  ZMW: 'mobilemoneyzambia',
  TZS: 'mobilemoneytanzania',
  XAF: 'mobilemoneyfranco',
  XOF: 'mobilemoneyfranco',
}

/**
 * Flutterwave payment_options per currency (comma + space separated).
 * Lists match methods commonly enabled on merchant dashboards.
 */
const CURRENCY_PAYMENT_OPTIONS: Record<string, readonly string[]> = {
  NGN: ['card', 'banktransfer', 'ussd', 'account', 'nqr', 'enaira', 'applepay'],
  RWF: ['card', 'mobilemoneyrwanda'],
  UGX: ['card', 'mobilemoneyuganda'],
  KES: ['card', 'mpesa'],
  GHS: ['card', 'mobilemoneyghana'],
  USD: ['card', 'account', 'applepay', 'googlepay'],
}

export function paymentOptionsForCurrency(currency: string): string {
  const cur = currency.toUpperCase()
  const options = CURRENCY_PAYMENT_OPTIONS[cur]
  if (options) return options.join(', ')
  if (cur in MOMO_ONLY) return MOMO_ONLY[cur]
  return 'card'
}

/** Recurring payment_plans only work with cards — we grant 30-day access manually after one-time pay. */
export function supportsFlutterwavePaymentPlan(currency: string): boolean {
  return currency.toUpperCase() === 'USD'
}

async function flwFetch(path: string, init?: RequestInit) {
  const secret = flwSecretKey()
  if (!secret) {
    throw new Error('Payment service not configured. FLW_SECRET_KEY is required.')
  }
  const res = await fetch(`${flwBase()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secret}`,
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

export async function ensurePaymentPlan(amount: number, currency: string, interval: string, name = 'StudySquare Monthly'): Promise<string> {
  const cur = currency.toUpperCase()
  const iv = interval.toLowerCase()
  const envPlanId = flwPlanId() || cachedPlanId

  if (envPlanId) {
    try {
      const data = await flwFetch(`/v3/payment-plans/${envPlanId}`)
      const plan = data?.data ?? {}
      if (
        String(plan.currency ?? '').toUpperCase() === cur &&
        Math.abs(Number(plan.amount) - amount) < 0.0001 &&
        String(plan.interval ?? '').toLowerCase() === iv
      ) {
        cachedPlanId = envPlanId
        return envPlanId
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
  cachedPlanId = planId
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
  const paymentOptions = paymentOptionsForCurrency(currency)

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
    payment_options: paymentOptions,
  }

  if (supportsFlutterwavePaymentPlan(currency) && opts.planId) {
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

function metaUserId(meta: unknown): string | undefined {
  if (!meta || typeof meta !== 'object') return undefined
  if (Array.isArray(meta)) {
    for (const item of meta) {
      if (item && typeof item === 'object') {
        const row = item as Record<string, unknown>
        if (row.meta_name === 'user_id' || row.name === 'user_id') {
          const value = String(row.meta_value ?? row.value ?? '').trim()
          return value || undefined
        }
      }
    }
    return undefined
  }
  const value = (meta as Record<string, unknown>).user_id
  return value != null && String(value).trim() ? String(value).trim() : undefined
}

export function parseFlutterwaveTransaction(txn: any, fallbackId?: string): FlutterwaveTransaction {
  const amount = Number(txn?.amount)
  return {
    status: String(txn?.status ?? ''),
    id: txn?.id != null ? String(txn.id) : fallbackId,
    txRef: txn?.tx_ref != null ? String(txn.tx_ref) : undefined,
    amount: Number.isFinite(amount) ? amount : undefined,
    currency: txn?.currency != null ? String(txn.currency).toUpperCase() : undefined,
    metaUserId: metaUserId(txn?.meta),
    customerEmail: txn?.customer?.email != null ? String(txn.customer.email).toLowerCase() : undefined,
  }
}

export async function findTransactionByTxRef(txRef: string): Promise<FlutterwaveTransaction | null> {
  const data = await flwFetch(`/v3/transactions?tx_ref=${encodeURIComponent(txRef)}`)
  const rows = Array.isArray(data?.data) ? data.data : []
  if (!rows.length) return null
  return parseFlutterwaveTransaction(rows[0])
}

export async function verifyTransactionById(transactionId: string): Promise<FlutterwaveTransaction | null> {
  const id = String(transactionId).trim()
  if (!id) return null
  try {
    const data = await flwFetch(`/v3/transactions/${encodeURIComponent(id)}/verify`)
    return parseFlutterwaveTransaction(data?.data ?? {}, id)
  } catch {
    return null
  }
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

export function verifyWebhookSignature(
  rawBody: string,
  headers: { verifHash: string | null; flutterwaveSignature: string | null },
): boolean {
  // An unset secret used to accept every request, so anyone could POST a
  // "successful" charge naming any user.
  const secret = process.env.FLW_WEBHOOK_SECRET ?? ''
  if (!secret) return false

  // V3: plain verif-hash header matches secret
  if (headers.verifHash) {
    return safeEqual(headers.verifHash, secret)
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
    base: flwBase(),
    public_key_present: Boolean(flwPublicKey()),
    secret_key_present: Boolean(flwSecretKey()),
    plan_id: flwPlanId() || cachedPlanId || null,
    redirect_url: getFlutterwaveRedirectUrl(),
    webhook_url: getFlutterwaveWebhookUrl(),
  }
}
