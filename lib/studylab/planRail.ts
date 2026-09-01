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
  /**
   * Why this step cannot be tested out of, in the learner's words. Null when
   * it can be, or when there is nothing to explain.
   *
   * A locked step used to show its percentage and simply omit the button,
   * which reads as the control being missing rather than withheld. Saying why
   * is the difference between a rule and a bug.
   */
  lockedReason: string | null
  /** Whether this is the step being taught. */
  current: boolean
}

/**
 * Whether the rail's rows can be acted on at all.
 *
 * A plan still being negotiated is a preview: jumping into it would start the
 * lesson behind the plan card's back, and testing out of a step nobody has
 * agreed to teach makes no sense. Both transitions refuse in that phase; this
 * keeps the UI from offering controls that only exist to be refused.
 */
export function railIsLive(run: LessonRun | null): boolean {
  return !!run && run.phase !== 'planning'
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
      // Nothing can be tested out of a plan that has not been accepted.
      canTestOut:
        policy.testOut === 'offer' && run.phase !== 'planning' && step.status === 'pending' && !gated,
      lockedReason: gated
        ? `You were measured at ${step.lockedBy!.accuracy}% here, so this one gets taught.`
        : null,
      current: i === run.currentStep,
    }
  })
}
