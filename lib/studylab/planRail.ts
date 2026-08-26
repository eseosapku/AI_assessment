// lib/studylab/planRail.ts
import type { LessonPolicy } from './lessonPolicy'
import type { LessonRun, StepStatus } from './lessonRun'

/**
 * What each row of the plan rail offers.
 *
 * Kept out of the component so the policy branching can be tested without a
 * DOM. `measured` is populated whichever policy applies — an open lesson still
 * tells the learner what the measurement said, it just does not stop them.
 */
export interface RailStep {
  id: string
  title: string
  status: StepStatus
  /** Measured accuracy to display, or null when nothing was measured. */
  measured: number | null
  /** Whether to offer "I know this". */
  canTestOut: boolean
  /** Whether this is the step being taught. */
  current: boolean
}

export function railSteps(run: LessonRun | null, policy: LessonPolicy): RailStep[] {
  if (!run) return []
  return run.steps.map((step, i) => {
    const gated = Boolean(step.lockedBy) && policy.gaps === 'lock'
    return {
      id: step.id,
      title: step.title,
      status: step.status,
      measured: step.lockedBy?.accuracy ?? null,
      // Only a step still waiting can be tested out of: the current step is
      // already being taught, and a settled one has nothing left to prove.
      canTestOut: step.status === 'pending' && !gated,
      current: i === run.currentStep,
    }
  })
}
