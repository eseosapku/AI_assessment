export const FREE_ASSESSMENT_LIMIT = 2

export type SubscriptionStatus = 'free' | 'active' | 'expired' | 'cancelled'

export type SubscriptionUser = {
  id: string
  role?: string | null
  subscription_status?: string | null
  free_assessments_used?: number | null
  subscription_started_at?: string | null
  subscription_expires_at?: string | null
  email?: string | null
}

export type SubscriptionSnapshot = {
  isSubscribed: boolean
  freeAssessmentsUsed: number
  freeAssessmentsRemaining: number
  canGenerateAssessment: boolean
  canStartStudyPlan: boolean
  status: SubscriptionStatus
  expiresAt: string | null
}

export function normalizeSubscriptionStatus(value: unknown): SubscriptionStatus {
  const s = String(value ?? 'free').toLowerCase()
  if (s === 'active' || s === 'expired' || s === 'cancelled') return s
  return 'free'
}

export function isTeacherExempt(user: Pick<SubscriptionUser, 'role'> | null | undefined): boolean {
  return String(user?.role ?? '').toLowerCase() === 'teacher'
}

export function isSubscriptionActive(user: SubscriptionUser | null | undefined, now = Date.now()): boolean {
  if (!user) return false
  if (isTeacherExempt(user)) return true
  const status = normalizeSubscriptionStatus(user.subscription_status)
  if (status !== 'active') return false
  const exp = user.subscription_expires_at ? new Date(user.subscription_expires_at).getTime() : null
  if (Number.isFinite(exp) && exp! < now) return false
  return true
}

export function buildSubscriptionSnapshot(user: SubscriptionUser | null | undefined): SubscriptionSnapshot {
  if (!user || isTeacherExempt(user)) {
    return {
      isSubscribed: true,
      freeAssessmentsUsed: 0,
      freeAssessmentsRemaining: FREE_ASSESSMENT_LIMIT,
      canGenerateAssessment: true,
      canStartStudyPlan: true,
      status: 'active',
      expiresAt: null,
    }
  }

  const used = Math.max(0, Number(user.free_assessments_used) || 0)
  const subscribed = isSubscriptionActive(user)
  const remaining = Math.max(0, FREE_ASSESSMENT_LIMIT - used)
  const status = normalizeSubscriptionStatus(user.subscription_status)

  return {
    isSubscribed: subscribed,
    freeAssessmentsUsed: used,
    freeAssessmentsRemaining: subscribed ? FREE_ASSESSMENT_LIMIT : remaining,
    canGenerateAssessment: subscribed || used < FREE_ASSESSMENT_LIMIT,
    canStartStudyPlan: subscribed,
    status: subscribed ? 'active' : status,
    expiresAt: user.subscription_expires_at ?? null,
  }
}

import { getClientNardoPayLinkCode } from '@/lib/nardopay-client'

export function subscribeUrlForUser(email?: string | null, userId?: string | null): string {
  const code = getClientNardoPayLinkCode()
  const url = new URL(`https://nardopay.com/subscribe/${code}`)
  if (email) url.searchParams.set('email', email)
  if (userId) url.searchParams.set('metadata', JSON.stringify({ user_id: userId }))
  url.searchParams.set('redirect_url', '/subscription/success')
  return url.toString()
}

export function isPaymentRequiredResponse(status: number, data: { code?: string } | null | undefined): boolean {
  return status === 402 || data?.code === 'PAYMENT_REQUIRED'
}

export function subscriptionBlockedMessage(kind: 'assessment' | 'study'): string {
  if (kind === 'assessment') {
    return 'You have used your 2 free assessments. Subscribe to keep generating practice tests.'
  }
  return 'StudyLab LearnSpaces require an active subscription. Subscribe to start guided study plans.'
}
