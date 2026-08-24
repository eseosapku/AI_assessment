/**
 * How strict a lesson is, decided by where it came from.
 *
 * A lesson opened from the gap map and a lesson a learner started on a whim
 * are not the same object. The gap lesson is remediation: a measurement said
 * they were weak, the plan is the contract for fixing that, and deleting the
 * step that addresses it defeats the reason the lesson exists. An open lesson
 * is exploration, where the plan is a suggestion and freezing it would be the
 * tutor overruling the person who asked for it.
 *
 * The live data makes it concrete rather than a matter of taste: there are 47
 * `scratch` LearnSpaces and not one carries a `subtopic_id`. In an open lesson
 * there is nothing to lock against — locking there is undefined, not strict.
 */

export type LessonOrigin = 'gap' | 'scratch' | 'homework'
export type Pace = 'step' | 'run'

export interface LessonPolicy {
  /** What a measured gap does: block the step, or just point it out. */
  gaps: 'lock' | 'advise'
  /** When the plan may be restructured. */
  planEditable: 'always' | 'planning-only'
  defaultPace: Pace
  /** What `finish()` requires. */
  completion: 'all-steps' | 'learner-says'
  planSize: { min: number; max: number }
}

export const POLICIES: Record<LessonOrigin, LessonPolicy> = {
  gap: {
    gaps: 'lock',
    planEditable: 'planning-only',
    defaultPace: 'step',
    completion: 'all-steps',
    planSize: { min: 3, max: 4 },
  },
  scratch: {
    gaps: 'advise',
    planEditable: 'always',
    defaultPace: 'run',
    completion: 'learner-says',
    planSize: { min: 4, max: 6 },
  },
  homework: {
    gaps: 'advise',
    planEditable: 'always',
    defaultPace: 'run',
    completion: 'learner-says',
    planSize: { min: 2, max: 4 },
  },
}

/**
 * The policy for a stored `learnspaces.origin`.
 *
 * Unknown origins get the permissive policy on purpose. `origin` is a free-text
 * column, so a typo or a value added later must not silently produce a lesson
 * that refuses to let a learner move on.
 */
export function policyFor(origin: string | null | undefined): LessonPolicy {
  const key = String(origin ?? '').trim().toLowerCase()
  return POLICIES[key as LessonOrigin] ?? POLICIES.scratch
}
