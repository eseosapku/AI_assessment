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
  it('summarises score and lists missed prompts', () => {
    const cells: QuizCell[] = [
      { checkpointId: 'c', gate: 'hard', question: mcq, state: 'correct' },
      { checkpointId: 'c', gate: 'hard', question: { ...mcq, id: 'q3', prompt: 'tricky' }, state: 'incorrect' },
    ]
    const text = checkpointResultText(cells)
    expect(text).toContain('1/2')
    expect(text).toContain('tricky')
  })
})
