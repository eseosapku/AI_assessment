// lib/studylab/trail/action.ts
import { stageOf, type LessonRun } from '../lessonRun'
import { settledSince } from '../scenes'
import { continueFor, type ContinueTarget, type DockView } from '../spotlight'

/**
 * The one button on the Trail, and what it says. It is worked out in one place,
 * so whatever the lesson is doing there is one thing to press and its label
 * matches the moment.
 */
export type TrailAction =
  | { kind: 'none' }
  | { kind: 'bar' }
  | { kind: 'working' }
  | { kind: 'summary' }
  | { kind: 'start' }
  | { kind: 'retry'; label: string }
  | { kind: 'continue'; label: string; target: ContinueTarget }
  | { kind: 'goToStation'; label: string; station: number }
  | { kind: 'tryAgain'; label: 'Try it again' }

/** Cards with nothing to answer: reading one and moving on is "Got it". */
const READ_ONLY = new Set(['concept', 'worked', 'table', 'callout', 'mermaid', 'diagram', 'question', 'image', 'resources'])

export function trailAction(input: {
  view: DockView
  claimed: boolean
  run: LessonRun | null
  focusType: string | null
  /** The next card of the burst, when there is one. */
  nextInQueue: string | null
  /** Between stations: the one just finished, and the one the button goes to. */
  interlude: { done: number; next: number } | null
  /** Looking back at a finished card: the lesson's own button stands aside. */
  lookBack: { canRetry: boolean } | null
  /** A detour card's own three answers stand where the button would. */
  detourFooter: boolean
}): TrailAction {
  const { view, claimed, run, focusType, nextInQueue, interlude, lookBack, detourFooter } = input
  if (lookBack) return lookBack.canRetry ? { kind: 'tryAgain', label: 'Try it again' } : { kind: 'none' }
  if (view.kind === 'retry') return { kind: 'retry', label: view.label }
  if (view.kind === 'done') return { kind: 'summary' }
  if (interlude) return { kind: 'goToStation', label: `Go to station ${interlude.next + 1}`, station: interlude.next }
  if (detourFooter) return { kind: 'none' }
  if (claimed) return { kind: 'bar' }
  if (nextInQueue) {
    const label = focusType && READ_ONLY.has(focusType) ? 'Got it' : 'Continue'
    return { kind: 'continue', label, target: { kind: 'focus', label, nodeId: nextInQueue, hint: '' } }
  }
  if (view.kind === 'working') return { kind: 'working' }
  if (run?.phase === 'planning' && run.steps.length > 0) return { kind: 'start' }
  if (view.kind === 'continue') {
    const { target } = view
    const finishing = target.kind === 'advance' && !!run && stageOf(run) === 'check'
    return { kind: 'continue', label: finishing ? 'Finish station' : target.label, target }
  }
  return { kind: 'none' }
}

/** A card's own Continue: along the burst while there is more of it, then whatever it always meant. */
export function trailContinue(nodeId: string | null, input: Parameters<typeof continueFor>[1], nextInQueue: string | null): ContinueTarget | null {
  if (nextInQueue) return { kind: 'focus', label: 'Continue', nodeId: nextInQueue, hint: '' }
  return continueFor(nodeId, input)
}

/**
 * The pause after a station: its cards file, and the button goes to the next
 * one. Read off the run changing, so a reload, with no earlier run, never replays it.
 */
export function interludeFrom(prev: LessonRun | null, next: LessonRun | null): { done: number; next: number } | null {
  if (!next || next.phase !== 'teaching' || next.currentStep < 0) return null
  const settled = settledSince(prev, next)
  const last = settled[settled.length - 1]
  if (!last) return null
  const done = next.steps.findIndex((s) => s.id === last.id)
  return done === next.currentStep ? null : { done, next: next.currentStep }
}
