// lib/studylab/scenes.ts
import type { LessonRun, LessonStep } from './lessonRun'
import type { StudyNode } from './types'

/**
 * The moments worth marking: a station finished, the lesson finished, and what
 * the learner did along the way.
 *
 * Each is read off two consecutive runs rather than set as a flag, so a reload
 * (no previous run) never replays a scene the learner already saw.
 */

const isSettled = (s: LessonStep) => s.status === 'done' || s.status === 'known'

/** Steps passed or tested out of between `prev` and `next`. */
export function settledSince(prev: LessonRun | null, next: LessonRun | null): LessonStep[] {
  if (!prev || !next) return []
  const before = new Map(prev.steps.map((s) => [s.id, s]))
  return next.steps.filter((s) => {
    const was = before.get(s.id)
    return !!was && isSettled(s) && !isSettled(was)
  })
}

/** True only on the change into `done`. */
export function lessonFinished(prev: LessonRun | null, next: LessonRun | null): boolean {
  return !!prev && !!next && prev.phase !== 'done' && next.phase === 'done'
}

export interface LessonSummary {
  /** Steps taught and passed. */
  stations: number
  /** Steps tested out of. */
  known: number
  /** Questions, problems, activities and materials got right. */
  practised: number
  minutes: number
}

/**
 * The end-of-lesson numbers. Hidden cards count: finishing a step folds its
 * cards into the station node, and what was done there was still done.
 */
export function lessonSummary(run: LessonRun, nodes: StudyNode[], activeMs: number): LessonSummary {
  const practised = nodes.filter((n) => {
    const d = n.data
    return (
      d.quiz?.state === 'correct' ||
      d.practice?.state === 'correct' ||
      d.activityState?.status === 'solved' ||
      d.materialState?.status === 'solved'
    )
  }).length
  return {
    stations: run.steps.filter((s) => s.status === 'done').length,
    known: run.steps.filter((s) => s.status === 'known').length,
    practised,
    minutes: Math.round(activeMs / 60_000),
  }
}

/** After this long without a key or a pointer, the learner has stepped away. */
export const IDLE_CAP_MS = 120_000

/**
 * Time learning since the last commit at `sinceMs`, added to the total. A tab
 * left open over lunch counts two minutes, not the hour.
 */
export function addActive(totalMs: number, sinceMs: number, nowMs: number, lastInputMs: number): number {
  const until = Math.min(nowMs, lastInputMs + IDLE_CAP_MS)
  return totalMs + Math.max(0, until - sinceMs)
}
