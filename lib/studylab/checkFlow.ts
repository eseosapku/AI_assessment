import type { CheckpointQuestion } from './types'

/**
 * One check flow for every answerable thing in a lesson: checkpoint questions,
 * practice problems, activities and materials.
 *
 * Learning and testing are different on purpose. While learning, a miss is
 * amber and leads somewhere -- a second try with feedback written for that
 * mistake, then help or the answer -- and costs nothing. In a test (a hard
 * checkpoint, a test-out) there is one try; a miss is shown as incorrect, the
 * answer is shown, and "Why?" is offered first.
 *
 * Pure: the components hold a `CheckFlowState`, send events, and persist
 * `attempts` on their cell so a reload comes back at the same try.
 */
export type CheckMode = 'learn' | 'test'

export type CheckPhase = 'idle' | 'ready' | 'checking' | 'correct' | 'retry' | 'wrong' | 'revealed'

export interface CheckFlowState {
  mode: CheckMode
  phase: CheckPhase
  attempts: number
  message?: string
}

export type CheckEvent =
  | { type: 'answer'; present: boolean }
  | { type: 'check' }
  | { type: 'result'; verdict: 'correct' | 'incorrect' | 'ungraded'; message?: string }
  | { type: 'tryAgain' }
  | { type: 'reveal' }

/** Tries allowed while learning before help and the answer take the lead. */
export const MAX_LEARN_TRIES = 2

const SETTLED: readonly CheckPhase[] = ['correct', 'wrong', 'revealed']

export function checkFlow(state: CheckFlowState, event: CheckEvent): CheckFlowState {
  // While learning, two misses hand the lead to help and the answer, but
  // another go is never taken away. In a test, a miss is final.
  // Another go waits for a new answer: the old one was the miss, and leaving
  // it armed under the same button let a double press mark it twice.
  if (state.phase === 'wrong' && state.mode === 'learn' && event.type === 'tryAgain') {
    return { ...state, phase: 'idle', message: undefined }
  }
  if (SETTLED.includes(state.phase)) {
    return event.type === 'reveal' && state.phase === 'wrong' ? { ...state, phase: 'revealed' } : state
  }
  switch (event.type) {
    case 'answer':
      if (state.phase === 'checking') return state
      if (state.phase === 'retry') return event.present ? { ...state, phase: 'ready', message: undefined } : state
      return { ...state, phase: event.present ? 'ready' : 'idle', message: undefined }
    case 'check':
      return state.phase === 'ready' ? { ...state, phase: 'checking', message: undefined } : state
    case 'result': {
      if (state.phase !== 'checking') return state
      if (event.verdict === 'ungraded') return { ...state, phase: 'ready', message: event.message }
      const attempts = state.attempts + 1
      if (event.verdict === 'correct') return { ...state, phase: 'correct', attempts, message: event.message }
      const final = state.mode === 'test' || attempts >= MAX_LEARN_TRIES
      return { ...state, phase: final ? 'wrong' : 'retry', attempts, message: event.message }
    }
    case 'tryAgain':
      return state.phase === 'retry' ? { ...state, phase: 'idle', message: undefined } : state
    case 'reveal':
      // Learning: the answer can be asked for after a miss, not before trying.
      return state.phase === 'retry' ? { ...state, phase: 'revealed' } : state
  }
}

/** Where a saved cell resumes. */
export function initialCheckFlow(
  mode: CheckMode,
  saved: { attempts?: number; settled?: 'correct' | 'incorrect'; revealed?: boolean } = {},
): CheckFlowState {
  const attempts = saved.attempts ?? (saved.settled ? 1 : 0)
  if (saved.settled === 'correct') return { mode, phase: 'correct', attempts }
  if (saved.revealed) return { mode, phase: 'revealed', attempts }
  // Learning settles a card as incorrect only through showing the answer, so
  // that is what a saved one is; coming back as 'wrong' offered Try again on a
  // question its check had already handed in.
  if (saved.settled === 'incorrect') return { mode, phase: mode === 'learn' ? 'revealed' : 'wrong', attempts }
  if (attempts <= 0) return { mode, phase: 'idle', attempts: 0 }
  const final = mode === 'test' || attempts >= MAX_LEARN_TRIES
  return { mode, phase: final ? 'wrong' : 'retry', attempts }
}

/**
 * What a card's own saved work means when it is reloaded: an answer ready to
 * check, but only if nothing has been marked yet. A card restored mid-retry
 * keeps its retry -- its old work is the answer that was missed, not a new one.
 */
export function restoreEvent(state: CheckFlowState, hasWork: boolean): CheckEvent | null {
  return state.phase === 'idle' && hasWork ? { type: 'answer', present: true } : null
}

/**
 * Whether a card's state just changed in front of the learner. The first state
 * a card renders (`prev` undefined) is where it already was -- a restored miss
 * must not shake, and a restored card must not take focus, as the lesson opens.
 */
export function isLiveChange(
  prev: Pick<CheckFlowState, 'phase' | 'attempts'> | undefined,
  next: Pick<CheckFlowState, 'phase' | 'attempts'>,
): boolean {
  return !!prev && (prev.phase !== next.phase || prev.attempts !== next.attempts)
}

/** Hard checkpoints and test-outs are tests; everything else is learning. */
export function modeForGate(
  gate: 'hard' | 'soft' | undefined,
  kind?: 'checkpoint' | 'testout',
): CheckMode {
  return gate === 'hard' || kind === 'testout' ? 'test' : 'learn'
}

/**
 * A question card's mode. Test-outs open with a soft gate -- a miss teaches
 * the step instead of blocking it -- so the gate alone would read them as
 * learning. Cards saved before `kind` was stamped are recognised by the id the
 * page gives test-outs, `to-<step>`.
 */
export function modeForCell(cell: { gate: 'hard' | 'soft'; kind?: 'testout'; checkpointId: string }): CheckMode {
  const testOut = cell.kind === 'testout' || cell.checkpointId.startsWith('to-')
  return modeForGate(cell.gate, testOut ? 'testout' : 'checkpoint')
}

/**
 * Whether marking an answer ends the question -- the point at which its
 * explanation may be shown. A test miss does. A learning miss never does, not
 * even the second: another go is still offered, and an explanation that names
 * the answer would make that go a formality.
 */
export function answerIsFinal(mode: CheckMode, verdict: 'correct' | 'incorrect'): boolean {
  return verdict === 'correct' || mode === 'test'
}

/**
 * What to say about an answer. A multiple-choice question with feedback
 * written per option speaks to the one chosen. Without it, the explanation is
 * shown only once the answer is final; a first miss gets no explanation, so the
 * second try is still a try.
 */
export function feedbackFor(
  q: CheckpointQuestion,
  given: unknown,
  verdict: 'correct' | 'incorrect',
  opts: { final?: boolean } = {},
): string | undefined {
  if (q.format !== 'mcq') return undefined
  const index = typeof given === 'number' ? given : Number(given)
  const written = Number.isInteger(index) ? q.optionFeedback?.[index] : undefined
  if (written) return written
  if (verdict === 'correct' || opts.final) return q.explain
  return undefined
}
