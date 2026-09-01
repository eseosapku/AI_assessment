import { describe, it, expect } from 'vitest'
import { gradeMcq, gradeMatch, checkpointResultText, isValidQuestion } from '@/lib/studylab/quiz'
import type { CheckpointQuestion, QuizCell } from '@/lib/studylab/types'

const mcq: CheckpointQuestion = { id: 'q1', format: 'mcq', prompt: 'p', options: ['a', 'b'], answer: 1 }
const match: CheckpointQuestion = {
  id: 'q2',
  format: 'match',
  prompt: 'p',
  pairs: [{ left: 'L1', right: 'R1' }, { left: 'L2', right: 'R2' }],
}

describe('gradeMcq', () => {
  it('is correct only for the answer index', () => {
    expect(gradeMcq(mcq as any, 1)).toBe(true)
    expect(gradeMcq(mcq as any, 0)).toBe(false)
  })
})

describe('gradeMatch', () => {
  it('is correct when every left maps to its right', () => {
    expect(gradeMatch(match as any, ['R1', 'R2'])).toBe(true)
    expect(gradeMatch(match as any, ['R2', 'R1'])).toBe(false)
    expect(gradeMatch(match as any, ['R1'])).toBe(false)
  })
})

describe('isValidQuestion', () => {
  it('accepts well-formed questions', () => {
    expect(isValidQuestion(mcq)).toBe(true)
    expect(isValidQuestion(match)).toBe(true)
    expect(isValidQuestion({ id: 's', format: 'short', prompt: 'p' })).toBe(true)
    expect(isValidQuestion({ id: 'c', format: 'code', prompt: 'p', goal: 'g' })).toBe(true)
  })
  it('rejects malformed questions', () => {
    expect(isValidQuestion({ format: 'mcq', prompt: 'p' })).toBe(false)
    expect(isValidQuestion({ id: 'x', format: 'rune' })).toBe(false)
    expect(isValidQuestion(null)).toBe(false)
  })
})

describe('checkpointResultText', () => {
  const cell = (id: string, state: QuizCell['state']): QuizCell => ({
    checkpointId: 'c', gate: 'hard', question: { ...mcq, id }, state,
  })

  // It used to read `CHECKPOINT RESULT: 1/2 correct. Missed: "tricky".` —
  // written to be parsed by the model. The tutor now gets the result as
  // structured data on the action and never sees this string, so there is
  // nobody left for the protocol wording to serve.
  it('speaks to the learner, not to the model', () => {
    const text = checkpointResultText([cell('q1', 'correct'), cell('q2', 'incorrect')])
    expect(text).toBe('1 of 2 right — we will go back over the rest.')
    expect(text).not.toContain('CHECKPOINT')
  })

  it('keeps a single question singular', () => {
    expect(checkpointResultText([cell('q1', 'correct')])).toBe('Correct.')
    expect(checkpointResultText([cell('q1', 'incorrect')]))
      .toBe('Not quite — we will go back over that.')
  })

  it('counts a clean sweep', () => {
    const all = [cell('q1', 'correct'), cell('q2', 'correct'), cell('q3', 'correct')]
    expect(checkpointResultText(all)).toBe('All 3 correct.')
  })

  it('does not quote the questions back — the marked card on the board already shows them', () => {
    const text = checkpointResultText([
      cell('q1', 'correct'),
      { checkpointId: 'c', gate: 'hard', question: { ...mcq, id: 'q2', prompt: 'tricky' }, state: 'incorrect' },
    ])
    expect(text).not.toContain('tricky')
  })
})
