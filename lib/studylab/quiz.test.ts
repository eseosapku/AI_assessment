import { describe, it, expect } from 'vitest'
import { gradeMcq, gradeMatch, checkpointResultText, isValidQuestion, readGradeReply, settleStaleCell } from '@/lib/studylab/quiz'
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

describe('a multiple-choice question with a bad answer key', () => {
  // Number(null) and Number('') are 0, so a missing key passed as "option A",
  // and an index past the options made a question nobody could get right.
  const mcq = (answer: unknown) => ({ id: 'q', prompt: 'Which?', format: 'mcq', options: ['a', 'b', 'c'], answer })
  it('is refused when the key is missing', () => {
    expect(isValidQuestion(mcq(null))).toBe(false)
    expect(isValidQuestion(mcq(''))).toBe(false)
    expect(isValidQuestion(mcq(undefined))).toBe(false)
  })
  it('is refused when the key is past the options', () => {
    expect(isValidQuestion(mcq(3))).toBe(false)
    expect(isValidQuestion(mcq(-1))).toBe(false)
  })
  it('still takes a numeric-string key the model sometimes sends', () => {
    expect(isValidQuestion(mcq('2'))).toBe(true)
    expect(isValidQuestion(mcq(0))).toBe(true)
  })
})

describe('reading the marker\'s reply', () => {
  it('takes a clear verdict', () => {
    expect(readGradeReply(true, { correct: true, feedback: 'Yes.' })).toEqual({ verdict: 'correct', feedback: 'Yes.' })
    expect(readGradeReply(true, { correct: false, feedback: 'No.' })).toEqual({ verdict: 'incorrect', feedback: 'No.' })
  })
  it('never turns a failure into a wrong answer', () => {
    // An AWS blip, a paywall or a server error came back as `incorrect`, and
    // the answer locked -- a mark lost to something the student did not do.
    expect(readGradeReply(false, { error: 'Server error' }).verdict).toBe('ungraded')
    expect(readGradeReply(true, { error: 'Subscription required' }).verdict).toBe('ungraded')
    expect(readGradeReply(true, { feedback: 'hm' }).verdict).toBe('ungraded')
    expect(readGradeReply(true, { correct: false, feedback: 'Could not grade right now — try again.' }).verdict).toBe('ungraded')
    expect(readGradeReply(true, null).verdict).toBe('ungraded')
  })
})

describe('a check question saved while it was being marked', () => {
  it('is put back to unanswered so the student can try again', () => {
    expect(settleStaleCell({ state: 'pending', given: 'x' } as QuizCell)).toEqual({ state: 'unanswered', given: 'x' })
    expect(settleStaleCell({ state: 'correct', given: 'x' } as QuizCell)).toBeNull()
  })
})
