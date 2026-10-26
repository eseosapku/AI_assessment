import { describe, it, expect } from 'vitest'
import {
  checkFlow, initialCheckFlow, modeForGate, modeForCell, feedbackFor, MAX_LEARN_TRIES,
  type CheckFlowState, type CheckEvent,
} from './checkFlow'
import type { CheckpointQuestion } from './types'

function run(state: CheckFlowState, events: CheckEvent[]): CheckFlowState {
  return events.reduce(checkFlow, state)
}

const answer = { type: 'answer', present: true } as const
const check = { type: 'check' } as const
const wrong = { type: 'result', verdict: 'incorrect' } as const
const right = { type: 'result', verdict: 'correct' } as const

describe('the check flow', () => {
  it('allows two tries while learning, then waits for help or the answer', () => {
    let s = initialCheckFlow('learn')
    s = run(s, [answer])
    expect(s.phase).toBe('ready')
    s = run(s, [check])
    expect(s.phase).toBe('checking')
    s = run(s, [wrong])
    expect(s).toMatchObject({ phase: 'retry', attempts: 1 })
    s = run(s, [{ type: 'tryAgain' }])
    expect(s.phase).toBe('ready')
    s = run(s, [check, wrong])
    expect(s).toMatchObject({ phase: 'wrong', attempts: 2 })
    expect(MAX_LEARN_TRIES).toBe(2)
    s = run(s, [{ type: 'reveal' }])
    expect(s.phase).toBe('revealed')
  })

  it('still lets a learner have another go after the second miss, but not in a test', () => {
    const learnWrong = run(initialCheckFlow('learn'), [answer, check, wrong, { type: 'tryAgain' }, check, wrong])
    const again = checkFlow(learnWrong, { type: 'tryAgain' })
    expect(again).toMatchObject({ phase: 'ready', attempts: 2 })
    expect(run(again, [check, wrong])).toMatchObject({ phase: 'wrong', attempts: 3 })
    expect(run(again, [check, right])).toMatchObject({ phase: 'correct', attempts: 3 })
    const testWrong = run(initialCheckFlow('test'), [answer, check, wrong])
    expect(checkFlow(testWrong, { type: 'tryAgain' })).toBe(testWrong)
  })

  it('accepts a right answer on either try', () => {
    expect(run(initialCheckFlow('learn'), [answer, check, right])).toMatchObject({ phase: 'correct', attempts: 1 })
    expect(
      run(initialCheckFlow('learn'), [answer, check, wrong, { type: 'tryAgain' }, check, right]),
    ).toMatchObject({ phase: 'correct', attempts: 2 })
  })

  it('gives one try in a test, and the answer may be shown at once', () => {
    const s = run(initialCheckFlow('test'), [answer, check, wrong])
    expect(s).toMatchObject({ phase: 'wrong', attempts: 1 })
    expect(checkFlow(s, { type: 'reveal' }).phase).toBe('revealed')
  })

  it('never spends a try when the marking fails', () => {
    const s = run(initialCheckFlow('learn'), [answer, check, { type: 'result', verdict: 'ungraded', message: 'Couldn’t mark that — try again.' }])
    expect(s).toMatchObject({ phase: 'ready', attempts: 0, message: 'Couldn’t mark that — try again.' })
  })

  it('goes back to idle when the answer is cleared, and ignores Check with nothing given', () => {
    const ready = run(initialCheckFlow('learn'), [answer])
    expect(checkFlow(ready, { type: 'answer', present: false }).phase).toBe('idle')
    const idle = initialCheckFlow('learn')
    expect(checkFlow(idle, check)).toBe(idle)
  })

  it('ignores events once settled, except asking for the answer after a miss', () => {
    const correct = run(initialCheckFlow('learn'), [answer, check, right])
    expect(checkFlow(correct, { type: 'tryAgain' })).toBe(correct)
    expect(checkFlow(correct, check)).toBe(correct)
    const revealed = run(initialCheckFlow('test'), [answer, check, wrong, { type: 'reveal' }])
    expect(checkFlow(revealed, answer)).toBe(revealed)
  })

  it('comes back after a reload at the same try', () => {
    expect(initialCheckFlow('learn', { attempts: 1 })).toMatchObject({ phase: 'retry', attempts: 1 })
    expect(initialCheckFlow('learn', { attempts: 2 })).toMatchObject({ phase: 'wrong', attempts: 2 })
    expect(initialCheckFlow('test', { settled: 'incorrect' })).toMatchObject({ phase: 'wrong' })
    expect(initialCheckFlow('learn', { settled: 'correct', attempts: 1 })).toMatchObject({ phase: 'correct' })
    expect(initialCheckFlow('learn', { attempts: 2, revealed: true })).toMatchObject({ phase: 'revealed' })
    expect(initialCheckFlow('learn', {})).toMatchObject({ phase: 'idle', attempts: 0 })
    // A learning card is only ever saved as incorrect once its answer has
    // been shown, so that is how it comes back -- never with Try again, which
    // would reopen a question its check has already handed in. Old cards
    // saved without `revealed` included.
    expect(initialCheckFlow('learn', { settled: 'incorrect' })).toMatchObject({ phase: 'revealed' })
    expect(initialCheckFlow('learn', { settled: 'incorrect', attempts: 1 })).toMatchObject({ phase: 'revealed', attempts: 1 })
  })

  it('makes hard checks and test-outs tests, everything else learning', () => {
    expect(modeForGate('hard')).toBe('test')
    expect(modeForGate('soft')).toBe('learn')
    expect(modeForGate(undefined)).toBe('learn')
    expect(modeForGate(undefined, 'testout')).toBe('test')
    expect(modeForGate('soft', 'testout')).toBe('test')
  })

  it('reads a question card as a test when it belongs to a test-out', () => {
    // Test-outs open with a soft gate, so the gate alone said "learn": two
    // tries and the explanation, and a step passed after being shown the answer.
    expect(modeForCell({ gate: 'soft', kind: 'testout', checkpointId: 'x' })).toBe('test')
    // Cards saved before the kind was stamped: the page names test-outs `to-<step>`.
    expect(modeForCell({ gate: 'soft', checkpointId: 'to-s2' })).toBe('test')
    expect(modeForCell({ gate: 'soft', checkpointId: 'cp-1' })).toBe('learn')
    expect(modeForCell({ gate: 'hard', checkpointId: 'cp-1' })).toBe('test')
  })
})

describe('feedback for an answer', () => {
  const mcq: CheckpointQuestion = {
    id: 'q', format: 'mcq', prompt: 'Which?', options: ['A', 'B', 'C'], answer: 1, explain: 'B because…',
    optionFeedback: ['A misses the constant.', 'Yes — B.', 'C doubles it.'],
  }
  const bare: CheckpointQuestion = { id: 'q2', format: 'mcq', prompt: 'Which?', options: ['A', 'B'], answer: 0, explain: 'A because…' }

  it('speaks to the option the learner chose', () => {
    expect(feedbackFor(mcq, 0, 'incorrect')).toBe('A misses the constant.')
    expect(feedbackFor(mcq, 1, 'correct')).toBe('Yes — B.')
  })

  it('falls back to the explanation once the answer is final, and to nothing on a first miss', () => {
    expect(feedbackFor(bare, 1, 'correct')).toBe('A because…')
    expect(feedbackFor(bare, 1, 'incorrect', { final: true })).toBe('A because…')
    expect(feedbackFor(bare, 1, 'incorrect')).toBeUndefined()
  })

  it('says nothing for formats without written feedback', () => {
    const short: CheckpointQuestion = { id: 's', format: 'short', prompt: 'Why?' }
    expect(feedbackFor(short, 'because', 'incorrect')).toBeUndefined()
  })
})
