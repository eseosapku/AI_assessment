// lib/studylab/activities/telemetry.ts
import type { ActivityOutcome, ActivityPattern, ActivityState, ValidateResult } from './types'

/** Compact result the canvas feeds back to the tutor on the next turn. */
export function buildOutcome(
  activityId: string,
  pattern: ActivityPattern,
  state: ActivityState,
  result: ValidateResult,
): ActivityOutcome {
  return {
    activityId,
    pattern,
    solved: result.ok,
    attempts: state.attempts,
    hintsUsed: state.hintsUsed,
    elapsedMs: state.elapsedMs,
    wrongIds: result.wrongIds,
    // Refused moves are the misconception signal for accepts()-guarded patterns,
    // where a wrong arrangement can never survive to check time.
    rejectedIds: [...new Set((state.rejectedMoves ?? []).map((m) => m.itemId))],
  }
}

/** One-line summary injected into the tutor prompt. */
export function describeOutcome(o: ActivityOutcome): string {
  const base = `Activity ${o.activityId} (${o.pattern}): ${o.solved ? 'SOLVED' : 'not solved'} after ${o.attempts} attempt(s), ${o.hintsUsed} hint(s)`
  const parts: string[] = []
  if (o.wrongIds.length) parts.push(`wrong at check: ${o.wrongIds.join(', ')}`)
  if (o.rejectedIds.length) parts.push(`tried to misplace: ${o.rejectedIds.join(', ')}`)
  return parts.length ? `${base}; ${parts.join('; ')}` : base
}
