import { db } from '@/lib/db'
import {
  buildSubscriptionSnapshot,
  FREE_ASSESSMENT_LIMIT,
  isSubscriptionActive,
  isTeacherExempt,
  type SubscriptionSnapshot,
  type SubscriptionUser,
} from '@/lib/subscription'

export async function fetchSubscriptionUser(userId: string): Promise<SubscriptionUser | null> {
  const result = await db.query<SubscriptionUser>(
    `SELECT id, role, email, subscription_status, free_assessments_used,
            subscription_started_at, subscription_expires_at
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [userId],
  )
  return result.rows[0] ?? null
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

  await db.query(
    `UPDATE users SET free_assessments_used = $2, updated_at = NOW() WHERE id = $1`,
    [userId, used + 1],
  )
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
  let userId = params.userId ?? null

  if (!userId && params.email) {
    const lookup = await db.query<{ id: string }>(
      `SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
      [params.email],
    )
    userId = lookup.rows[0]?.id ?? null
  }

  if (!userId) {
    return { ok: false, error: 'userId or email required' }
  }

  const userCheck = await db.query<{ id: string }>(`SELECT id FROM users WHERE id = $1 LIMIT 1`, [userId])
  if (!userCheck.rows[0]) {
    return { ok: false, error: 'User not found' }
  }

  const expiresAt = params.expiresAt ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  const update = await db.query<{ subscription_status: string }>(
    `UPDATE users
     SET subscription_status = 'active',
         subscription_started_at = NOW(),
         subscription_expires_at = $2,
         flutterwave_ref = $3,
         updated_at = NOW()
     WHERE id = $1
     RETURNING subscription_status`,
    [userId, expiresAt, params.ref ?? null],
  )

  const status = update.rows[0]?.subscription_status
  if (status !== 'active') {
    return {
      ok: false,
      error: 'Subscription columns missing or not writable. Run migrations/full-platform-schema.sql on RDS.',
    }
  }

  return { ok: true, userId }
}
