import { describe, it, expect } from 'vitest'
import { legacyBuckets, scoreQuestions } from '@/lib/studylab/mastery-write'
import { bandFor, nextLatest, readLatest } from '@/lib/studylab/mastery-latest'

const mcq = (subtopic: number, correct: number, topic = 0) => ({
  type: 'mcq', subtopic_id: subtopic, topic_id: topic, options: ['A', 'B'], correct_answer: correct,
})

describe('a saved quiz becomes section scores', () => {
  it('buckets a right and a wrong answer by section, and a chapter-only question by chapter', () => {
    const scored = scoreQuestions(
      [mcq(11, 0), mcq(11, 1), mcq(0, 1, 7)],
      { 0: 0, 1: 0, 2: 1 },
      {},
    )
    expect(scored.scoredAny).toBe(true)
    expect(scored.sections.get(11)).toEqual({ correct: 1, total: 2 })
    expect(scored.chapters.get(7)).toEqual({ correct: 1, total: 1 })
  })

  it('reads answers saved under string keys, and skips a long answer that has not been marked', () => {
    const scored = scoreQuestions(
      [{ type: 'mcq', subtopic_id: 4, options: ['A', 'B'], correct_answer: 1 }, { type: 'longform', subtopic_id: 4, question: 'Explain.' }],
      { mcq: { '0': 1 } },
      {},
    )
    expect(scored.sections.get(4)).toEqual({ correct: 1, total: 1 })
  })

  it('counts a long answer by the marks it was given', () => {
    const scored = scoreQuestions(
      [{ type: 'longform', subtopic_id: 4 }],
      {},
      { 0: { marks_awarded: 1, marks_total: 4 } },
    )
    expect(scored.sections.get(4)).toEqual({ correct: 0.25, total: 1 })
  })

  it('a quiz with no tags spreads its score, and a split that does not divide stays fractional', () => {
    expect(legacyBuckets({ topic_ids: [3], subtopic_ids: [] }, 80, 5)).toEqual([
      { topic_id: 3, subtopic_id: 0, correct: 4, total: 5 },
    ])
    expect(legacyBuckets({ subtopic_ids: [1, 2] }, 50, 1)).toEqual([
      { topic_id: 0, subtopic_id: 1, correct: 0.5, total: 0.5 },
      { topic_id: 0, subtopic_id: 2, correct: 0.5, total: 0.5 },
    ])
    expect(legacyBuckets({}, 80, 5)).toEqual([])
  })
})

describe('those scores are what the gap map colours', () => {
  it('a section under 50, then a retake of 80 or more, is gold', () => {
    const first = scoreQuestions([mcq(4, 1), mcq(4, 1), mcq(4, 1)], { 0: 1, 1: 0, 2: 0 }, {})
    const bucket = first.sections.get(4)!
    const failed = nextLatest(null, null, bucket.correct, bucket.total)
    expect(bandFor(failed.last_accuracy, failed.lowest_accuracy)).toBe('gap')

    const retake = scoreQuestions([mcq(4, 1), mcq(4, 1), mcq(4, 1), mcq(4, 1), mcq(4, 1)], { 0: 1, 1: 1, 2: 1, 3: 1, 4: 0 }, {})
    const again = retake.sections.get(4)!
    const latest = nextLatest(failed, failed.last_accuracy, again.correct, again.total)
    expect(bandFor(latest.last_accuracy, latest.lowest_accuracy)).toBe('gold')
  })

  it('a row from before the new columns is judged on its average', () => {
    const read = readLatest({ attempts: 8, accuracy: '62.00' })
    expect(bandFor(read.score, read.lowest)).toBe('shaky')
  })
})
