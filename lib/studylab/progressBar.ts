// lib/studylab/progressBar.ts
import type { LessonPolicy } from './lessonPolicy'
import { STAGES, stageOf, type LessonRun, type Stage } from './lessonRun'
import { railSteps } from './planRail'

/** One station's stretch of the progress bar across the top of the lesson. */
export interface BarSegment {
  id: string
  title: string
  /** `known` was tested out of; `later` includes every station while the plan is still being agreed. */
  status: 'done' | 'known' | 'current' | 'later'
  /** How full the segment is, 0 to 1. */
  fill: number
  /** The current station's stage, for its pips in the steps list. */
  stage: Stage | null
  canTestOut: boolean
  /** Why it cannot be skipped, when it cannot. */
  lockedReason: string | null
  measured: number | null
}

/**
 * The lesson as segments: a finished station is full, the one being taught
 * fills by its four stages (halfway through each, so the bar moves on as soon
 * as a stage starts and is never full before the check is passed), and the
 * rest are empty. Nothing is filled while the plan is still being agreed.
 */
export function barSegments(run: LessonRun | null, policy: LessonPolicy): BarSegment[] {
  if (!run) return []
  const planning = run.phase === 'planning'
  const stage = run.phase === 'teaching' ? stageOf(run) : null
  return railSteps(run, policy).map((s) => {
    const settled = s.status === 'done' || s.status === 'known'
    const current = !planning && !settled && s.current
    const at = current && stage ? STAGES.indexOf(stage) : -1
    return {
      id: s.id,
      title: s.title,
      status: settled ? (s.status as 'done' | 'known') : current ? 'current' : 'later',
      fill: settled ? 1 : at >= 0 ? (at + 0.5) / STAGES.length : current ? 0.06 : 0,
      stage: current ? stage : null,
      canTestOut: s.canTestOut,
      lockedReason: s.lockedReason,
      measured: s.measured,
    }
  })
}

/** How much of the whole lesson is done, 0 to 1. */
export function barProgress(segments: Pick<BarSegment, 'fill'>[]): number {
  if (segments.length === 0) return 0
  return segments.reduce((sum, s) => sum + s.fill, 0) / segments.length
}
