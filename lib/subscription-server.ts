import { supabase } from '@/lib/supabase'
import { getSupabaseAdmin, hasSupabaseAdmin } from '@/lib/supabase-admin'
import {
  buildSubscriptionSnapshot,
  FREE_ASSESSMENT_LIMIT,
  isSubscriptionActive,
  isTeacherExempt,
  type SubscriptionSnapshot,
  type SubscriptionUser,
} from '@/lib/subscription'

export async function fetchSubscriptionUser(userId: string): Promise<SubscriptionUser | null> {
  const client = hasSupabaseAdmin() ? getSupabaseAdmin() : supabase
  const { data, error } = await client
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

  const client = hasSupabaseAdmin() ? getSupabaseAdmin() : supabase
  await client
    .from('users')
    .update({ free_assessments_used: used + 1 })
    .eq('id', userId)
}

export function userIdFromTxRef(txRef: string): string | null {
  const match = /^sub_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})_/i.exec(String(txRef).trim())
  return match?.[1] ?? null
}

export async function resolveUserIdFromTxRef(txRef: string): Promise<string | null> {
  return userIdFromTxRef(txRef)
}

export async function activateSubscription(params: {
  userId?: string | null
  email?: string | null
  ref?: string | null
  expiresAt?: string | null
  provider?: string
}): Promise<{ ok: boolean; userId?: string; error?: string }> {
  if (!hasSupabaseAdmin()) {
    return { ok: false, error: 'Server misconfigured: SUPABASE_SERVICE_ROLE_KEY is missing on Vercel.' }
  }

  const db = getSupabaseAdmin()
  let query = db.from('users').select('id, email')
  if (params.userId) {
    query = query.eq('id', params.userId)
  } else if (params.email) {
    query = query.eq('email', params.email.toLowerCase())
  } else {
    return { ok: false, error: 'userId or email required' }
  }

  const { data: user, error } = await query.maybeSingle()
  if (error || !user) return { ok: false, error: 'User not found' }

  const expiresAt = params.expiresAt ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  const payload: Record<string, unknown> = {
    subscription_status: 'active',
    subscription_started_at: new Date().toISOString(),
    subscription_expires_at: expiresAt,
    flutterwave_ref: params.ref ?? null,
  }

  const { error: updErr } = await db.from('users').update(payload).eq('id', user.id).select('id').maybeSingle()
  if (updErr) return { ok: false, error: updErr.message }
  if (!updErr && payload.subscription_status) {
    // RLS / missing columns can fail silently without service role — confirm row updated
    const { data: check } = await db.from('users').select('subscription_status').eq('id', user.id).maybeSingle()
    if (check?.subscription_status !== 'active') {
      return {
        ok: false,
        error:
          'Subscription columns missing or not writable. Run supabase-subscription-migration.sql in Supabase.',
      }
    }
  }

  return { ok: true, userId: user.id }
}
