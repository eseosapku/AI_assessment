/**
 * Which attempts should count towards what a student appears to know.
 *
 * Strict mode auto-submits a paper when the student leaves the tab. That is a
 * reasonable anti-cheating measure and a terrible measurement: the attempt ends
 * wherever they had got to, which is often nowhere.
 *
 * Measured on the live data — 1,672 results:
 *
 *     manual      1,532   average 60%
 *     violation     140   average 21%   ← 79 of them scored exactly zero
 *
 * Those 140 sit in every average the platform shows, permanently. A student who
 * switched tabs once carries it for good, and it is why a dashboard can read
 * "27% average" above a chart of five recent scores over 90%.
 *
 * They are not deleted or hidden — the attempt happened, and a teacher looking
 * at a pattern of them should see it. They just stop being evidence of what the
 * student knows, which is all an average is for.
 */

export interface CountableResult {
  submission_reason?: unknown
  answers?: unknown
  percentage?: unknown
  score?: unknown
}

/** True when the paper was ended by the proctor rather than by the student. */
export function wasAutoSubmitted(result: CountableResult): boolean {
  return String(result?.submission_reason ?? '').toLowerCase() === 'violation'
}

/** True when nothing was answered at all. */
export function wasUnanswered(result: CountableResult): boolean {
  const a = result?.answers
  if (a === null || a === undefined) return true
  if (typeof a === 'string') return a.trim() === '' || ['{}', '[]', 'null'].includes(a.trim())
  if (Array.isArray(a)) return a.length === 0
  if (typeof a === 'object') return Object.keys(a as object).length === 0
  return false
}

/**
 * Whether this attempt is evidence of what the student knows.
 *
 * An auto-submitted paper is not, and neither is one where nothing was
 * answered — a walk-away is a zero for the gradebook, not a measurement of
 * ability, and averaging it in makes every other number less true.
 */
export function countsTowardMastery(result: CountableResult): boolean {
  if (wasAutoSubmitted(result)) return false
  if (wasUnanswered(result)) return false
  return true
}

/** Why an attempt is excluded, for the student to read. Null when it counts. */
export function exclusionReason(result: CountableResult): string | null {
  if (wasAutoSubmitted(result)) return 'Ended early — not counted in your average'
  if (wasUnanswered(result)) return 'No answers given — not counted in your average'
  return null
}
