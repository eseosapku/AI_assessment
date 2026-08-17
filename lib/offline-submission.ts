/**
 * Holding a finished attempt when the network isn't there.
 *
 * Submission used to be a bare `await fetch('/api/save-result')` with no error
 * handling. A student who lost signal at the moment they finished lost the
 * whole attempt, silently — no retry, no message, no local copy. On the
 * connections this product actually runs on, that is not an edge case.
 *
 * The result is now written to a local queue first and drained in the
 * background, so the work survives the network. Pure helpers live here so the
 * retry policy and the queue rules can be tested without a browser.
 */

export const QUEUE_KEY = 'ss-pending-results'

/** Give up after this many attempts and leave it queued for the next session. */
export const MAX_ATTEMPTS = 6

/** Beyond this age a queued result is stale enough to drop. */
export const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

/** Never hold more than this many attempts; oldest are dropped first. */
export const MAX_QUEUED = 10

export interface PendingSubmission {
  /** Stable id so a retry can't create duplicates. */
  id: string
  /** The exact body to POST to /api/save-result. */
  payload: unknown
  queuedAt: number
  attempts: number
}

/**
 * Exponential backoff with jitter.
 *
 * Jitter matters here beyond politeness: when a classroom of students loses
 * wifi together, they come back together too, and a fixed schedule would send
 * every retry in the same instant.
 */
export function nextBackoffMs(attempt: number, random: () => number = Math.random): number {
  const n = Number.isFinite(attempt) && attempt > 0 ? Math.floor(attempt) : 0
  const base = Math.min(1000 * 2 ** n, 60_000)
  return Math.round(base * (0.7 + random() * 0.6))
}

/** Should this attempt be retried, or has it exhausted its chances? */
export function shouldRetry(item: Pick<PendingSubmission, 'attempts'>): boolean {
  return (item?.attempts ?? 0) < MAX_ATTEMPTS
}

/** Drop stale entries and cap the queue, newest kept. */
export function pruneQueue(
  queue: readonly PendingSubmission[],
  now: number = Date.now(),
): PendingSubmission[] {
  if (!Array.isArray(queue)) return []
  return queue
    .filter((i) => i && typeof i === 'object' && typeof i.id === 'string' && i.id.length > 0)
    .filter((i) => {
      const age = now - (Number(i.queuedAt) || 0)
      return age >= 0 ? age <= MAX_AGE_MS : true
    })
    .slice(-MAX_QUEUED)
}

/**
 * Add or replace an entry.
 *
 * Replacing by id is what makes a retry safe: re-queuing the same attempt after
 * a failed send updates it in place rather than stacking duplicate results the
 * server would have to reconcile.
 */
export function upsert(
  queue: readonly PendingSubmission[],
  item: PendingSubmission,
): PendingSubmission[] {
  const rest = (Array.isArray(queue) ? queue : []).filter((i) => i?.id !== item.id)
  return pruneQueue([...rest, item])
}

export function removeById(
  queue: readonly PendingSubmission[],
  id: string,
): PendingSubmission[] {
  return (Array.isArray(queue) ? queue : []).filter((i) => i?.id !== id)
}

/**
 * Is this failure worth retrying?
 *
 * Network errors and 5xx are transient. A 4xx means the server understood and
 * refused, so retrying just burns the queue — except 408 and 429, which are
 * explicitly "try again".
 */
export function isRetryableStatus(status: number | null | undefined): boolean {
  if (status === null || status === undefined) return true // network failure
  if (status === 408 || status === 429) return true
  return status >= 500
}

// ── browser-side storage (thin wrappers; the logic above is what's tested) ──

export function readQueue(): PendingSubmission[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return pruneQueue(Array.isArray(parsed) ? parsed : [])
  } catch {
    return []
  }
}

export function writeQueue(queue: readonly PendingSubmission[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(pruneQueue(queue)))
  } catch {
    // Quota or private mode. The in-flight submission still proceeds; we just
    // lose the ability to retry it later, which is strictly better than
    // throwing here and losing the attempt outright.
  }
}

export function isOnline(): boolean {
  if (typeof navigator === 'undefined') return true
  return navigator.onLine !== false
}
