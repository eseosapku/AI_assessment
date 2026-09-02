/**
 * Per-user and per-IP ceilings on the endpoints that cost money.
 *
 * Subscription gating decides *whether* someone may generate; nothing decided
 * how often. A scripted loop against /api/generate-assessment could run up an
 * unbounded Bedrock bill, and an honest user stuck in a retry loop could do it
 * by accident.
 *
 * In-memory and per-instance on purpose. A shared store (Redis) would be
 * stricter, but this needs no new infrastructure and still turns "unbounded"
 * into "bounded per instance", which is the difference that matters. The cap
 * is deliberately generous: it exists to stop runaway loops, not to ration
 * normal study.
 */

export interface RateLimitRule {
  /** Requests allowed inside the window. */
  limit: number
  windowMs: number
}

/** Generation is the expensive one; scoping and tutoring are far cheaper. */
export const RATE_LIMITS: Record<string, RateLimitRule> = {
  'generate-assessment': { limit: 30, windowMs: 60 * 60 * 1000 },
  'generate-feedback': { limit: 60, windowMs: 60 * 60 * 1000 },
  'grade-longform': { limit: 60, windowMs: 60 * 60 * 1000 },
  'studylab-tutor': { limit: 240, windowMs: 60 * 60 * 1000 },
  'quiz-topic-scope': { limit: 120, windowMs: 60 * 60 * 1000 },
  // Practice attempts are cheap and a learner may reasonably retry a problem
  // several times, so this sits well above the tutor's ceiling.
  'studylab-practice': { limit: 400, windowMs: 60 * 60 * 1000 },
}

export interface RateLimitResult {
  allowed: boolean
  /** Requests left in the current window. */
  remaining: number
  /** Seconds until the window resets — surfaced as Retry-After. */
  retryAfterSeconds: number
}

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

/** Stop the map growing without bound on a long-lived instance. */
function sweep(now: number): void {
  if (buckets.size < 5000) return
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}

/**
 * Count one request against a bucket.
 *
 * Keyed by user where known and by IP otherwise, so a signed-in student is not
 * throttled by a shared school connection, while an anonymous flood still is.
 */
export function checkRateLimit(
  action: string,
  identity: string,
  now: number = Date.now(),
): RateLimitResult {
  // Own-property guard: `action` is a literal at every call site today, but a
  // plain object lookup on a caller-supplied key reaches the prototype.
  const rule = Object.prototype.hasOwnProperty.call(RATE_LIMITS, action)
    ? RATE_LIMITS[action]
    : { limit: 60, windowMs: 60 * 60 * 1000 }

  const key = `${action}:${identity || 'anonymous'}`
  sweep(now)

  const existing = buckets.get(key)
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + rule.windowMs })
    return { allowed: true, remaining: rule.limit - 1, retryAfterSeconds: 0 }
  }

  existing.count += 1
  const remaining = rule.limit - existing.count
  if (remaining < 0) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    }
  }
  return { allowed: true, remaining, retryAfterSeconds: 0 }
}

/** Best-effort caller identity: the user if signed in, else the forwarded IP. */
export function identify(userId: unknown, headers: Headers): string {
  const id = String(userId ?? '').trim()
  if (id) return `u:${id}`
  const forwarded = headers.get('x-forwarded-for') ?? ''
  const ip = forwarded.split(',')[0]?.trim() || headers.get('x-real-ip') || 'unknown'
  return `ip:${ip}`
}

/** Reset state between tests. */
export function __resetRateLimits(): void {
  buckets.clear()
}
