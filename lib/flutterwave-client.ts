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

export { CURRENCY_OPTIONS } from '@/lib/subscription-pricing'

export async function initiateMonthlySubscription(
  userId: string,
  userEmail?: string | null,
  currency?: string,
): Promise<InitiatePaymentResult> {
  const payload: Record<string, unknown> = {
    user_id: userId,
    email: userEmail ?? undefined,
    currency: (currency ?? 'USD').toUpperCase(),
    interval: 'monthly',
  }

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

export async function verifyPayment(
  userId: string,
  reference: string,
  transactionId?: string,
): Promise<SubscriptionStatus> {
  const res = await fetch('/api/payments/flutterwave/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: userId,
      reference,
      transaction_id: transactionId,
    }),
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
