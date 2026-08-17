/**
 * Strict-mode (proctored) violation policy.
 *
 * The previous behaviour submitted the entire attempt on the FIRST window
 * blur, with no warning. That is unfair and, worse, discriminatory: assistive
 * technology takes focus routinely, so a screen-reader or magnifier user could
 * lose an exam without doing anything wrong. An on-screen keyboard, a system
 * notification, or clicking the browser's address bar did the same.
 *
 * The policy here separates two very different signals and gives the student
 * warnings before anything is taken away:
 *
 *  - `hidden` (the tab genuinely went to the background) is a real switch-away
 *    and counts immediately.
 *  - `blur` alone is weak evidence — it fires for browser chrome, notifications
 *    and AT — so it only counts if focus has not come back within a grace
 *    window.
 *
 * Nothing here submits on its own; it returns a decision the caller acts on.
 */

/** Violations tolerated before the attempt is submitted. The Nth exceeds it. */
export const DEFAULT_MAX_VIOLATIONS = 3

/**
 * How long focus may be away before a blur counts. Long enough to cover a
 * notification, an on-screen keyboard, or a screen reader grabbing focus;
 * short enough that reading another tab is still caught by `hidden` anyway.
 */
export const BLUR_GRACE_MS = 10_000

export type ViolationKind = 'hidden' | 'blur'

export type ProctorAction = 'ignore' | 'warn' | 'submit'

export interface ProctorDecision {
  /** Violation count after this event. */
  count: number
  action: ProctorAction
  /** Student-facing sentence. Empty when the action is 'ignore'. */
  message: string
}

const clampMax = (max: unknown): number => {
  const n = Number(max)
  // A zero or negative threshold would mean "submit on the first event", which
  // is the behaviour this module exists to remove.
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : DEFAULT_MAX_VIOLATIONS
}

/** Warnings left before the next violation ends the attempt. */
export function violationsRemaining(count: number, max: number = DEFAULT_MAX_VIOLATIONS): number {
  const limit = clampMax(max)
  const used = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0
  return Math.max(0, limit - used)
}

function describe(kind: ViolationKind): string {
  return kind === 'hidden'
    ? 'You switched away from the assessment.'
    : 'The assessment window lost focus for a while.'
}

/**
 * Decide what to do about one violation.
 *
 * `previousCount` is the count before this event. The attempt is submitted
 * only once the count has passed the threshold — so with the default of 3, a
 * student gets three warnings and the fourth event ends it.
 */
export function registerViolation(
  kind: ViolationKind,
  previousCount: number,
  max: number = DEFAULT_MAX_VIOLATIONS,
): ProctorDecision {
  const limit = clampMax(max)
  const count = (Number.isFinite(previousCount) && previousCount > 0 ? Math.floor(previousCount) : 0) + 1

  if (count > limit) {
    return {
      count,
      action: 'submit',
      message: `${describe(kind)} That was your last warning, so your answers have been submitted.`,
    }
  }

  const left = limit - count
  return {
    count,
    action: 'warn',
    message:
      left === 0
        ? `${describe(kind)} This is recorded. One more and your answers will be submitted automatically.`
        : `${describe(kind)} This is recorded. ${left} more warning${left === 1 ? '' : 's'} before your answers are submitted automatically.`,
  }
}
