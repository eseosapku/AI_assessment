/** Browser-side Flutterwave helpers — mirrors Brainink_afterskool/flutterwavePaymentService.ts */

export interface SubscriptionStatus {
  active: boolean
  expiresAt?: string
  lastPaymentId?: string
}

export interface InitiatePaymentResult {
  checkoutUrl: string
  paymentReference: string
}

export const CURRENCY_OPTIONS = [
  { code: 'USD', label: '$ USD (Card)' },
  { code: 'NGN', label: '₦ NGN (Card/Bank/USSD)' },
  { code: 'UGX', label: 'UGX (MTN/Airtel MoMo)' },
  { code: 'KES', label: 'KES (M-Pesa)' },
  { code: 'RWF', label: 'RWF (MTN MoMo)' },
  { code: 'GHS', label: 'GHS (MoMo)' },
] as const

export async function initiateMonthlySubscription(
  userId: string,
  userEmail?: string | null,
  currency?: string,
  amount?: number,
): Promise<InitiatePaymentResult> {
  const payload: Record<string, unknown> = {
    user_id: userId,
    email: userEmail ?? undefined,
    currency: currency ?? process.env.NEXT_PUBLIC_SUBSCRIPTION_CURRENCY ?? 'RWF',
    interval: 'monthly',
  }
  if (amount != null) payload.amount = amount

  const res = await fetch('/api/payments/flutterwave/initiate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(body || 'Failed to initiate subscription payment')
  }
  return res.json()
}

export async function verifyPayment(userId: string, reference: string): Promise<SubscriptionStatus> {
  const res = await fetch('/api/payments/flutterwave/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, reference }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(body || 'Failed to verify payment')
  }
  return res.json()
}

export async function getSubscriptionStatus(userId: string): Promise<SubscriptionStatus> {
  const res = await fetch(`/api/subscription/status?user_id=${encodeURIComponent(userId)}`)
  if (!res.ok) {
    if (res.status === 404) return { active: false }
    throw new Error('Failed to fetch subscription status')
  }
  const data = await res.json()
  return {
    active: Boolean(data?.subscription?.isSubscribed ?? data?.active),
    expiresAt: data?.subscription?.expiresAt ?? data?.expiresAt,
    lastPaymentId: data?.lastPaymentId,
  }
}
