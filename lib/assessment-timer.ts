/**
 * Time-limit policy (WCAG 2.2.1 Timing Adjustable, Level A).
 *
 * The countdown used to submit the attempt at zero with no warning and no way
 * to extend or turn it off. WCAG 2.2.1 allows a time limit only when the timing
 * is *essential* — true for a proctored exam a teacher has set, not for a
 * self-directed practice quiz, where the limit is a convenience.
 *
 * So the rules differ by context:
 *   - practice quiz: the student may extend, or remove the limit entirely;
 *   - teacher-set assignment: the limit stands, but the student is warned in
 *     time to finish rather than cut off mid-sentence.
 *
 * Pure so the policy is testable without a running clock.
 */

/** Warn this far out. Comfortably over the 20 seconds WCAG requires. */
export const WARN_AT_SECONDS = 120

/** One extension step. */
export const EXTENSION_SECONDS = 5 * 60

/** Sentinel for "no limit". */
export const NO_LIMIT = Number.POSITIVE_INFINITY

export interface TimerPolicy {
  /** May the student add more time? */
  canExtend: boolean
  /** May the student remove the limit outright? */
  canDisable: boolean
}

/**
 * A teacher-set assignment keeps its limit — that timing is part of the task.
 * Everything else is the student's own practice and must be adjustable.
 */
export function timerPolicy(isAssignment: boolean): TimerPolicy {
  return isAssignment ? { canExtend: false, canDisable: false } : { canExtend: true, canDisable: true }
}

/** Should the "time is nearly up" warning be showing? */
export function shouldWarn(
  remainingSeconds: number,
  limitDisabled: boolean,
  warnAt: number = WARN_AT_SECONDS,
): boolean {
  if (limitDisabled) return false
  const r = Number(remainingSeconds)
  if (!Number.isFinite(r)) return false
  return r > 0 && r <= warnAt
}

/** Add time, guarding against a negative or non-finite starting point. */
export function extendRemaining(
  remainingSeconds: number,
  by: number = EXTENSION_SECONDS,
): number {
  const r = Number.isFinite(remainingSeconds) && remainingSeconds > 0 ? remainingSeconds : 0
  const add = Number.isFinite(by) && by > 0 ? by : EXTENSION_SECONDS
  return r + add
}

/**
 * Should the attempt be auto-submitted now?
 *
 * Kept as its own decision rather than inlined in the tick, so "the limit is
 * off" can never be forgotten at the one call site that matters.
 */
export function shouldAutoSubmit(remainingSeconds: number, limitDisabled: boolean): boolean {
  if (limitDisabled) return false
  const r = Number(remainingSeconds)
  return Number.isFinite(r) && r <= 0
}

/** "2:05" / "1:00:00" — mm:ss, growing to h:mm:ss past an hour. */
export function formatRemaining(totalSeconds: number): string {
  const t = Number.isFinite(totalSeconds) && totalSeconds > 0 ? Math.floor(totalSeconds) : 0
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const s = t % 60
  const two = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${two(m)}:${two(s)}` : `${m}:${two(s)}`
}

/** Spoken form for screen readers — "2 minutes 5 seconds remaining". */
export function describeRemaining(totalSeconds: number): string {
  const t = Number.isFinite(totalSeconds) && totalSeconds > 0 ? Math.floor(totalSeconds) : 0
  const m = Math.floor(t / 60)
  const s = t % 60
  const parts: string[] = []
  if (m > 0) parts.push(`${m} minute${m === 1 ? '' : 's'}`)
  if (s > 0 || m === 0) parts.push(`${s} second${s === 1 ? '' : 's'}`)
  return `${parts.join(' ')} remaining`
}
