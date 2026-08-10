import { describe, it, expect } from 'vitest'
import { buildRetakePayload, CURRENT_ASSESSMENT_KEY } from './assessment-retake'

const q = (topic_label?: string) => ({ question: 'Q', options: ['a'], correct_answer: 0, topic_label })

describe('buildRetakePayload', () => {
  it('rebuilds the player payload from a finished attempt', () => {
    const p = buildRetakePayload({
      assessment_id: 'abc', subject: 'Mathematics', topics: ['Shapes'],
      questions: [q(), q()], duration: 20,
    })
    expect(p).toEqual({
      assessment_id: 'abc', estimated_time: 20, questions: [q(), q()],
      subject: 'Mathematics', topics: ['Shapes'],
    })
  })

  it('prefers estimated_time over duration', () => {
    expect(buildRetakePayload({ assessment_id: 'a', questions: [q()], estimated_time: 5, duration: 30 })!.estimated_time).toBe(5)
  })

  it('falls back to a sane duration when neither is usable', () => {
    for (const bad of [undefined, null, 0, -5, 'abc', NaN]) {
      const p = buildRetakePayload({ assessment_id: 'a', questions: [q()], duration: bad })
      expect(p!.estimated_time).toBe(15)
    }
  })

  it('derives topics from question labels when the attempt carried none', () => {
    // Self-directed quizzes have no curriculum topics behind them.
    const p = buildRetakePayload({
      assessment_id: 'a', questions: [q('Volcanic Formation'), q('Magma'), q('Volcanic Formation')],
    })
    expect(p!.topics).toEqual(['Volcanic Formation', 'Magma'])
  })

  it('ignores an empty topics array in favour of labels', () => {
    const p = buildRetakePayload({ assessment_id: 'a', topics: [], questions: [q('Shapes')] })
    expect(p!.topics).toEqual(['Shapes'])
  })

  it('tolerates questions with no labels at all', () => {
    expect(buildRetakePayload({ assessment_id: 'a', questions: [q()] })!.topics).toEqual([])
  })

  it('refuses to build a paper with no questions', () => {
    // An empty player is a dead end, so returning null lets the UI hide the button.
    expect(buildRetakePayload({ assessment_id: 'a', questions: [] })).toBeNull()
    expect(buildRetakePayload({ assessment_id: 'a', questions: [null, undefined] })).toBeNull()
    expect(buildRetakePayload({ assessment_id: 'a' })).toBeNull()
  })

  it('refuses to build without an assessment id', () => {
    expect(buildRetakePayload({ questions: [q()] })).toBeNull()
    expect(buildRetakePayload({ assessment_id: '   ', questions: [q()] })).toBeNull()
  })

  it('survives malformed input rather than throwing', () => {
    for (const bad of [null, undefined, 'string', 42]) {
      expect(buildRetakePayload(bad as never)).toBeNull()
    }
  })

  it('falls back to a readable subject', () => {
    expect(buildRetakePayload({ assessment_id: 'a', questions: [q()] })!.subject).toBe('Quiz')
  })

  it('carries questionType through only when present', () => {
    expect(buildRetakePayload({ assessment_id: 'a', questions: [q()] })).not.toHaveProperty('questionType')
    expect(buildRetakePayload({ assessment_id: 'a', questions: [q()], questionType: 'mixed' })!.questionType).toBe('mixed')
  })

  it('uses the key the assessment player actually reads', () => {
    expect(CURRENT_ASSESSMENT_KEY).toBe('currentAssessment')
  })
})
