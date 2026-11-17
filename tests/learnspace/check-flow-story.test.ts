import { describe, it, expect } from 'vitest'
import {
  checkFlow, initialCheckFlow, restoreEvent, idleLine, isLiveChange, modeForCell, answerIsFinal, feedbackFor,
  type CheckFlowState,
} from '@/lib/studylab/checkFlow'

const learn = (phase: CheckFlowState['phase'], attempts = 0): CheckFlowState => ({ mode: 'learn', phase, attempts })

describe('learning a question', () => {
  it('two misses, then the answer, and another go is never taken away', () => {
    let state = checkFlow(learn('idle'), { type: 'answer', present: true })
    state = checkFlow(state, { type: 'check' })
    state = checkFlow(state, { type: 'result', verdict: 'incorrect', message: 'Not quite.' })
    expect(state).toMatchObject({ phase: 'retry', attempts: 1 })
    expect(answerIsFinal('learn', 'incorrect')).toBe(false)
    // A reload lands back on the retry, so the missed answer is not offered as a new one.
    expect(restoreEvent(state, true)).toBeNull()
    expect(restoreEvent(learn('idle'), true)).toEqual({ type: 'answer', present: true })

    state = checkFlow(state, { type: 'tryAgain' })
    expect(state.phase).toBe('idle')
    expect(idleLine(state)).toBe('Change your answer to check again.')

    state = checkFlow(state, { type: 'answer', present: true })
    state = checkFlow(state, { type: 'check' })
    state = checkFlow(state, { type: 'result', verdict: 'incorrect', message: 'Still not.' })
    expect(state).toMatchObject({ phase: 'wrong', attempts: 2 })
    expect(checkFlow(state, { type: 'tryAgain' }).phase).toBe('idle')
    expect(checkFlow(state, { type: 'reveal' }).phase).toBe('revealed')
  })

  it('a double press on the same wrong answer is not marked twice', () => {
    const ready = checkFlow(learn('retry', 1), { type: 'answer', present: false })
    expect(checkFlow(ready, { type: 'check' }).phase).toBe('retry')
  })

  it('the first thing a card shows is where it already was', () => {
    expect(isLiveChange(undefined, learn('wrong', 1))).toBe(false)
    expect(isLiveChange(learn('checking', 0), learn('wrong', 1))).toBe(true)
  })
})

describe('a test', () => {
  it('one miss is the end, including a test-out whose gate is soft', () => {
    expect(modeForCell({ gate: 'soft', kind: 'testout', checkpointId: 'to-step' })).toBe('test')
    expect(modeForCell({ gate: 'soft', checkpointId: 'to-old' })).toBe('test')
    expect(modeForCell({ gate: 'soft', checkpointId: 'check-1' })).toBe('learn')
    expect(modeForCell({ gate: 'hard', checkpointId: 'check-1' })).toBe('test')

    let state = initialCheckFlow('test')
    state = checkFlow(state, { type: 'answer', present: true })
    state = checkFlow(state, { type: 'check' })
    state = checkFlow(state, { type: 'result', verdict: 'incorrect', message: 'Incorrect' })
    expect(state.phase).toBe('wrong')
    expect(answerIsFinal('test', 'incorrect')).toBe(true)
    expect(checkFlow(state, { type: 'tryAgain' }).phase).toBe('wrong')
  })

  it('a saved learning miss comes back as shown, not as another try', () => {
    expect(initialCheckFlow('learn', { settled: 'incorrect' }).phase).toBe('revealed')
    expect(initialCheckFlow('test', { settled: 'incorrect' }).phase).toBe('wrong')
    expect(initialCheckFlow('learn', { settled: 'correct' }).phase).toBe('correct')
  })
})

describe('what is said about the choice', () => {
  const q = {
    id: 'q', format: 'mcq' as const, prompt: 'Pick.', options: ['A', 'B'], answer: 1,
    explain: 'B, because demand falls as price rises.',
    optionFeedback: ['That line is supply.', 'Yes, that is demand.'],
  }

  it('speaks to the option they chose, and withholds the explanation on a first miss', () => {
    expect(feedbackFor(q, 0, 'incorrect')).toBe('That line is supply.')
    expect(feedbackFor({ ...q, optionFeedback: undefined }, 0, 'incorrect')).toBeUndefined()
    expect(feedbackFor({ ...q, optionFeedback: undefined }, 0, 'incorrect', { final: true })).toContain('demand falls')
    expect(feedbackFor({ ...q, optionFeedback: undefined }, 1, 'correct')).toContain('demand falls')
  })
})
