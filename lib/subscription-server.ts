import { supabase } from '@/lib/supabase'
import {
  buildSubscriptionSnapshot,
  FREE_ASSESSMENT_LIMIT,
  isSubscriptionActive,
  isTeacherExempt,
  type SubscriptionSnapshot,
  type SubscriptionUser,
} from '@/lib/subscription'

export async function fetchSubscriptionUser(userId: string): Promise<SubscriptionUser | null> {
  const { data, error } = await supabase
    .from('users')
    .select('id, role, email, subscription_status, free_assessments_used, subscription_started_at, subscription_expires_at')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    console.error('Subscription user lookup error:', error)
    return null
  }
  return data as SubscriptionUser | null
}

export async function getSubscriptionSnapshot(userId: string): Promise<SubscriptionSnapshot | null> {
  const user = await fetchSubscriptionUser(userId)
  if (!user) return null
  return buildSubscriptionSnapshot(user)
}

export type SubscriptionGateResult =
  | { allowed: true; snapshot: SubscriptionSnapshot }
  | { allowed: false; snapshot: SubscriptionSnapshot; reason: 'assessment' | 'study' }

export async function assertSubscriptionAccess(
  userId: string,
  action: 'assessment' | 'study',
): Promise<SubscriptionGateResult> {
  const user = await fetchSubscriptionUser(userId)
  if (!user) {
    const snapshot = buildSubscriptionSnapshot(null)
    return { allowed: false, snapshot, reason: action }
  }

  const snapshot = buildSubscriptionSnapshot(user)
  if (isTeacherExempt(user)) return { allowed: true, snapshot }

  if (action === 'assessment') {
    if (snapshot.canGenerateAssessment) return { allowed: true, snapshot }
    return { allowed: false, snapshot, reason: 'assessment' }
  }

  if (snapshot.canStartStudyPlan) return { allowed: true, snapshot }
  return { allowed: false, snapshot, reason: 'study' }
}

export function subscriptionPaywallBody(gate: Extract<SubscriptionGateResult, { allowed: false }>) {
  const message =
    gate.reason === 'assessment'
      ? 'You have used your free assessments. Subscribe to continue.'
      : 'Subscribe to start StudyLab study plans.'
  return {
    error: message,
    code: 'PAYMENT_REQUIRED' as const,
    reason: gate.reason,
    subscription: gate.snapshot,
  }
}

export async function incrementFreeAssessmentUsage(userId: string): Promise<void> {
  const user = await fetchSubscriptionUser(userId)
  if (!user || isTeacherExempt(user) || isSubscriptionActive(user)) return

  const used = Math.max(0, Number(user.free_assessments_used) || 0)
  if (used >= FREE_ASSESSMENT_LIMIT) return

  await supabase
    .from('users')
    .update({ free_assessments_used: used + 1 })
    .eq('id', userId)
}

export async function activateSubscription(params: {
  userId?: string | null
  email?: string | null
  ref?: string | null
  expiresAt?: string | null
}): Promise<{ ok: boolean; userId?: string; error?: string }> {
  let query = supabase.from('users').select('id, email')
  if (params.userId) {
    query = query.eq('id', params.userId)
  } else if (params.email) {
    query = query.eq('email', params.email.toLowerCase())
  } else {
    return { ok: false, error: 'userId or email required' }
  }

  const { data: user, error } = await query.maybeSingle()
  if (error || !user) return { ok: false, error: 'User not found' }

  const payload: Record<string, unknown> = {
    subscription_status: 'active',
    subscription_started_at: new Date().toISOString(),
    nardopay_ref: params.ref ?? null,
  }
  if (params.expiresAt) payload.subscription_expires_at = params.expiresAt

  const { error: updErr } = await supabase.from('users').update(payload).eq('id', user.id)
  if (updErr) return { ok: false, error: updErr.message }

  return { ok: true, userId: user.id }
}
