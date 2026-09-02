// lib/studylab/lessonRun.ts
import type { LessonPolicy, Pace } from './lessonPolicy'

/**
 * The lesson's control flow, as data.
 *
 * Everything here is pure: no I/O, no model calls, no React. That is the point
 * of the module. The 353-line tutor prompt accumulated rules whose only job was
 * to police control flow — never skip a step, never repeat a checkpoint, only
 * finish after the last one — because a language model was being asked to run a
 * state machine. With the machine here, those rules have nothing left to
 * police, and a refusal becomes a branch rather than a request.
 *
 * `checking` is deliberately not a phase. Making it one forced a single
 * `currentStep` to mean both where teaching is and what is being answered,
 * which breaks the moment a learner tests out of a step ahead of the one they
 * are on. An open check names its own step instead.
 */

export type LessonPhase = 'planning' | 'teaching' | 'done'
export type StepStatus = 'pending' | 'teaching' | 'known' | 'done'

export interface LessonStep {
  id: string
  title: string
  goal: string
  status: StepStatus
  /** Curriculum subtopic this step covers, where one applies. */
  subtopicId?: number
  /**
   * Set whenever a measurement says the learner is weak here. Always computed;
   * what it *does* is the policy's decision, so an open lesson can still show
   * the number without turning it into a gate.
   */
  lockedBy?: { subtopicId: number; accuracy: number }
  cardIds: string[]
  checkpointId?: string
}

export interface OpenCheck {
  stepId: string
  checkpointId: string
  kind: 'checkpoint' | 'testout'
  gate: 'hard' | 'soft'
}

export interface LessonRun {
  phase: LessonPhase
  pace: Pace
  steps: LessonStep[]
  /** Index into `steps`. -1 while planning. */
  currentStep: number
  /** Beats spent on the current step. Resets when the current step changes. */
  beats: number
  awaiting: boolean
  openCheck?: OpenCheck
  /**
   * Whether this lesson teaches programming, decided once when the plan is
   * drafted.
   *
   * It gates the two card types that run code. Told only in prose that "code"
   * is for programming lessons, the tutor still produced a JavaScript card
   * wrapping film dialogue in console.log(...) — complete with a Run button —
   * in a lesson on screenwriting.
   *
   * Undefined on a run drafted before this existed, and treated as permissive:
   * an old lesson keeps behaving as it did rather than losing its code cards.
   */
  programming?: boolean
}

export type Transition =
  | { ok: true; run: LessonRun }
  | { ok: false; reason: string }

const ok = (run: LessonRun): Transition => ({ ok: true, run })
const no = (reason: string): Transition => ({ ok: false, reason })

/** Whether the policy turns this step's measurement into a gate. */
function isGated(step: LessonStep | undefined, policy: LessonPolicy): boolean {
  return Boolean(step?.lockedBy) && policy.gaps === 'lock'
}

function indexOf(run: LessonRun, stepId: string): number {
  return run.steps.findIndex((s) => s.id === stepId)
}

/** The next step that still needs attention, or -1 when none do. */
function nextUnsettled(steps: LessonStep[], from = 0): number {
  for (let i = from; i < steps.length; i += 1) {
    if (steps[i].status === 'pending' || steps[i].status === 'teaching') return i
  }
  return -1
}

/**
 * The next step still to be taught: ahead first, then round to the start.
 *
 * Looking only forwards ended the lesson at its last step whatever had been
 * left behind. Jump to step three, finish three, four and five, and the rail
 * read "3 of 5 done" beside "You've completed this topic. Great work!" — two
 * true-looking statements that cannot both be true. A step jumped over is
 * still a step nobody has done; a step deliberately skipped is marked 'known'
 * and this never comes back to it.
 */
function nextToTeach(steps: LessonStep[], from: number): number {
  const ahead = nextUnsettled(steps, from)
  return ahead === -1 ? nextUnsettled(steps, 0) : ahead
}

/**
 * Moves teaching to `index`, clearing any other step that was mid-teach.
 * Beats reset, because a beat count belongs to the step it was spent on.
 */
function focus(run: LessonRun, index: number): LessonRun {
  const steps = run.steps.map((s, i) => {
    // A settled step stays settled when you land on it. Marking it 'teaching'
    // again took the tick off a step the learner had finished — go back to
    // re-read step 1 of a completed lesson and the lesson was no longer
    // complete, and the rail counted 4 of 5.
    if (i === index) {
      return s.status === 'done' || s.status === 'known' ? s : { ...s, status: 'teaching' as StepStatus }
    }
    return s.status === 'teaching' ? { ...s, status: 'pending' as StepStatus } : s
  })
  return { ...run, steps, currentStep: index, beats: 0 }
}

export function emptyRun(policy: LessonPolicy): LessonRun {
  return {
    phase: 'planning',
    pace: policy.defaultPace,
    steps: [],
    currentStep: -1,
    beats: 0,
    awaiting: true,
  }
}

export function proposePlan(run: LessonRun, steps: LessonStep[]): Transition {
  return ok({ ...run, phase: 'planning', steps, currentStep: -1, beats: 0, awaiting: true })
}

export function acceptPlan(run: LessonRun): Transition {
  if (run.steps.length === 0) return no('There is no plan to start yet.')
  const first = nextUnsettled(run.steps)
  if (first === -1) return ok({ ...run, phase: 'done', currentStep: -1, awaiting: true })
  return ok({ ...focus({ ...run, phase: 'teaching' }, first), awaiting: false })
}

export interface PlanEdit {
  add?: LessonStep[]
  remove?: string[]
  /** Step ids in their new order. Ids not listed keep their relative position. */
  reorder?: string[]
}

export function editPlan(run: LessonRun, edit: PlanEdit, policy: LessonPolicy): Transition {
  if (run.phase === 'teaching' && policy.planEditable === 'planning-only') {
    return no('This lesson is set from what you were measured on, so the plan stays put.')
  }
  for (const id of edit.remove ?? []) {
    const step = run.steps[indexOf(run, id)]
    if (!step) return no('That step is not in the plan.')
    if (isGated(step, policy)) {
      return no(`${step.title} — measured at ${step.lockedBy!.accuracy}%. This one stays.`)
    }
  }

  let steps = run.steps.filter((s) => !(edit.remove ?? []).includes(s.id))
  steps = [...steps, ...(edit.add ?? [])]
  if (edit.reorder?.length) {
    const rank = new Map(edit.reorder.map((id, i) => [id, i]))
    steps = [...steps].sort(
      (a, b) => (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER),
    )
  }

  const current = run.currentStep >= 0 ? run.steps[run.currentStep] : undefined
  const moved = current ? steps.findIndex((s) => s.id === current.id) : -1
  return ok({ ...run, steps, currentStep: moved })
}

export function nextBeat(run: LessonRun): Transition {
  if (run.phase !== 'teaching') return no('The lesson is not running.')
  if (run.openCheck?.gate === 'hard') return no('Finish the check first.')
  return ok({ ...run, beats: run.beats + 1, awaiting: false })
}

export function beginCheck(
  run: LessonRun,
  stepId: string,
  checkpointId: string,
  kind: OpenCheck['kind'],
  gate: OpenCheck['gate'],
): Transition {
  if (run.openCheck) return no('There is already a check open.')
  if (indexOf(run, stepId) === -1) return no('That step is not in the plan.')
  return ok({ ...run, openCheck: { stepId, checkpointId, kind, gate }, awaiting: true })
}

export function requestTestOut(
  run: LessonRun,
  stepId: string,
  checkpointId: string,
  policy: LessonPolicy,
): Transition {
  if (run.phase === 'planning') return no('Start the lesson first — the plan is still up for changes.')
  // Not offered on a lesson someone started by naming what they wanted to
  // learn. The UI hides the control; this is the guarantee, since a stale
  // client can still send the action.
  if (policy.testOut === 'hide') return no('This lesson is yours to explore — skip a step from the plan instead.')
  const step = run.steps[indexOf(run, stepId)]
  if (!step) return no('That step is not in the plan.')
  if (isGated(step, policy)) {
    return no(`${step.title} — measured at ${step.lockedBy!.accuracy}%. This one gets taught.`)
  }
  return beginCheck(run, stepId, checkpointId, 'testout', 'soft')
}

/**
 * Resolves the open check.
 *
 * A checkpoint marks its step done and advances. A test-out marks its step
 * known and leaves teaching exactly where it was — which is the whole reason
 * the kind is recorded.
 */
export function passCheck(run: LessonRun): Transition {
  const check = run.openCheck
  if (!check) return no('There is no check open.')
  const index = indexOf(run, check.stepId)
  if (index === -1) return no('That step is not in the plan.')

  const settled: StepStatus = check.kind === 'testout' ? 'known' : 'done'
  const steps = run.steps.map((s, i) => (i === index ? { ...s, status: settled } : s))
  const cleared = { ...run, steps, openCheck: undefined }

  if (check.kind === 'testout') return ok({ ...cleared, awaiting: true })

  const next = nextToTeach(steps, index + 1)
  if (next === -1) {
    // Nothing left to teach is the end of the lesson. This used to leave the
    // phase on 'teaching' with no current step: the rail showed every step
    // ticked, Continue had nothing to advance to, and the completion panel —
    // with the quiz that actually moves the gap map — never appeared. `finish`
    // is for stopping EARLY; it is not a confirmation the learner has to give
    // after already doing everything.
    return ok({ ...cleared, phase: 'done', currentStep: -1, awaiting: true })
  }
  return ok({ ...focus(cleared, next), awaiting: false })
}

/**
 * A failed check teaches the step it was about.
 *
 * `missed` travels to the teaching job so the lesson narrows to what was
 * actually got wrong, which makes a failed test-out more useful than never
 * attempting one.
 */
export function failCheck(run: LessonRun, missed: string[]): Transition {
  const check = run.openCheck
  if (!check) return no('There is no check open.')
  const index = indexOf(run, check.stepId)
  if (index === -1) return no('That step is not in the plan.')
  void missed
  return ok({ ...focus({ ...run, openCheck: undefined, phase: 'teaching' }, index), awaiting: false })
}

export function skipStep(run: LessonRun, stepId: string, policy: LessonPolicy): Transition {
  const index = indexOf(run, stepId)
  const step = run.steps[index]
  if (!step) return no('That step is not in the plan.')
  if (isGated(step, policy)) {
    return no(`${step.title} — measured at ${step.lockedBy!.accuracy}%. This one gets taught.`)
  }

  const steps = run.steps.map((s, i) => (i === index ? { ...s, status: 'known' as StepStatus } : s))
  const cleared: LessonRun = { ...run, steps }
  if (run.currentStep !== index) return ok(cleared)

  const next = nextToTeach(steps, index + 1)
  if (next === -1) return ok({ ...cleared, currentStep: -1, beats: 0, awaiting: true })
  return ok(focus(cleared, next))
}

export function jumpTo(run: LessonRun, stepId: string, policy: LessonPolicy): Transition {
  // A plan that has not been agreed to cannot be navigated. Without this, a
  // click on the rail set phase to 'teaching' behind the plan card's back —
  // starting the lesson while the card was still asking which pace to use, and
  // discarding the answer.
  if (run.phase === 'planning') return no('Start the lesson first — the plan is still up for changes.')
  const index = indexOf(run, stepId)
  if (index === -1) return no('That step is not in the plan.')
  const blocking = run.steps
    .slice(0, index)
    .find((s) => isGated(s, policy) && s.status !== 'done')
  if (blocking) {
    return no(`${blocking.title} comes first — you were measured at ${blocking.lockedBy!.accuracy}%.`)
  }
  // A finished lesson stays finished. Jumping into one is browsing it, not
  // reopening it, and flipping the phase back to 'teaching' quietly undid the
  // completion the learner had just earned.
  const phase: LessonPhase = run.phase === 'done' ? 'done' : 'teaching'

  // Moving to a different step abandons the check you were on. Leaving it open
  // gated the whole lesson on a question belonging to a step the learner had
  // walked away from: Continue refused, the banner pointed back at it, and
  // going to another step changed nothing. Choosing to move on IS an answer.
  const leaving = index !== run.currentStep
  const cleared = leaving ? { ...run, phase, openCheck: undefined } : { ...run, phase }
  return ok(focus(cleared, index))
}

export function setPace(run: LessonRun, pace: Pace): Transition {
  return ok({ ...run, pace })
}

export function stop(run: LessonRun): Transition {
  return ok({ ...run, awaiting: true })
}

export function finish(run: LessonRun, policy: LessonPolicy): Transition {
  if (policy.completion === 'all-steps') {
    const outstanding = run.steps.find((s) => s.status === 'pending' || s.status === 'teaching')
    if (outstanding) return no(`${outstanding.title} is still open.`)
  }
  return ok({ ...run, phase: 'done', currentStep: -1, openCheck: undefined, awaiting: true })
}
