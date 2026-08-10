import { describe, it, expect } from 'vitest'
import { splitQuestionRefs, type FeedbackSegment } from './feedback-question-refs'

const refs = (segs: FeedbackSegment[]) => segs.filter((s) => s.type === 'ref')
const text = (segs: FeedbackSegment[]) => segs.map((s) => s.value).join('')

describe('splitQuestionRefs', () => {
  it('finds a single question reference', () => {
    const segs = splitQuestionRefs('Review question 4 again.', 10)
    expect(refs(segs)).toEqual([{ type: 'ref', value: 'question 4', questions: [4] }])
  })

  it('preserves the original sentence exactly', () => {
    // The phrase stays verbatim so the feedback still reads as written.
    const input = 'You slipped on questions 4, 6 and 9 — revisit those.'
    expect(text(splitQuestionRefs(input, 10))).toBe(input)
  })

  it('parses comma and "and" lists', () => {
    const segs = splitQuestionRefs('questions 4, 6 and 9', 10)
    expect(refs(segs)[0].questions).toEqual([4, 6, 9])
  })

  it('expands dash and "to" ranges', () => {
    expect(refs(splitQuestionRefs('questions 4-6', 10))[0].questions).toEqual([4, 5, 6])
    expect(refs(splitQuestionRefs('questions 2 to 4', 10))[0].questions).toEqual([2, 3, 4])
    expect(refs(splitQuestionRefs('questions 4–6', 10))[0].questions).toEqual([4, 5, 6])
  })

  it('matches the short Q forms', () => {
    expect(refs(splitQuestionRefs('See Q3.', 10))[0].questions).toEqual([3])
    expect(refs(splitQuestionRefs('See Qs 2, 5', 10))[0].questions).toEqual([2, 5])
    expect(refs(splitQuestionRefs('See Q. 7', 10))[0].questions).toEqual([7])
  })

  it('is case-insensitive', () => {
    expect(refs(splitQuestionRefs('QUESTION 2', 10))[0].questions).toEqual([2])
  })

  it('drops references the paper cannot satisfy', () => {
    // Feedback occasionally invents a number; a button that scrolls nowhere is
    // worse than plain text.
    const segs = splitQuestionRefs('Look at question 99.', 10)
    expect(refs(segs)).toEqual([])
    expect(text(segs)).toBe('Look at question 99.')
  })

  it('keeps only the in-range numbers of a mixed reference', () => {
    expect(refs(splitQuestionRefs('questions 2 and 99', 10))[0].questions).toEqual([2])
  })

  it('handles several references in one line', () => {
    const segs = splitQuestionRefs('Nail question 1, then question 5.', 10)
    expect(refs(segs).map((r) => r.questions)).toEqual([[1], [5]])
  })

  it('returns plain text when there is nothing to link', () => {
    const segs = splitQuestionRefs('Good work overall.', 10)
    expect(segs).toEqual([{ type: 'text', value: 'Good work overall.' }])
  })

  it('does not match bare numbers or unrelated words', () => {
    expect(refs(splitQuestionRefs('You scored 7 out of 10.', 10))).toEqual([])
    expect(refs(splitQuestionRefs('The quarterly figure was 4.', 10))).toEqual([])
  })

  it('is not affected by regex state across calls', () => {
    // A shared /g literal would silently skip matches on the second call.
    const input = 'question 3'
    expect(refs(splitQuestionRefs(input, 10))).toHaveLength(1)
    expect(refs(splitQuestionRefs(input, 10))).toHaveLength(1)
  })

  it('caps absurd ranges instead of generating thousands of entries', () => {
    expect(refs(splitQuestionRefs('questions 1-9999', 10000))[0].questions).toEqual([1, 9999])
  })

  it('handles empty and malformed input', () => {
    expect(splitQuestionRefs('', 10)).toEqual([])
    expect(splitQuestionRefs('question 1', 0)).toEqual([{ type: 'text', value: 'question 1' }])
    expect(splitQuestionRefs('question 1', NaN)).toEqual([{ type: 'text', value: 'question 1' }])
  })
})
