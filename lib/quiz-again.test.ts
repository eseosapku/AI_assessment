import { describe, it, expect } from 'vitest'
import { questionTypeOf, deriveQuizAgainParams, canQuizAgain } from './quiz-again'

const mcq = { type: 'mcq' }
const longform = { type: 'longform' }
const interactive = { type: 'interactive' }

describe('questionTypeOf', () => {
  it('reads a single-format paper back as that format', () => {
    expect(questionTypeOf([mcq, mcq, mcq])).toBe('mcq')
    expect(questionTypeOf([longform, longform])).toBe('longform')
    expect(questionTypeOf([interactive])).toBe('interactive')
  })

  it('recognises the two mixes the wizard actually offers', () => {
    // Asking for "mcq" here would hand back a different kind of quiz from the
    // one being repeated.
    expect(questionTypeOf([mcq, mcq, longform])).toBe('mixed')
    expect(questionTypeOf([mcq, interactive])).toBe('study_mixed')
  })

  it('treats an untyped question as multiple choice, which is what it is', () => {
    expect(questionTypeOf([{}, {}])).toBe('mcq')
  })

  it('falls back rather than throwing on an unreadable paper', () => {
    expect(questionTypeOf(null)).toBe('mcq')
    expect(questionTypeOf([])).toBe('mcq')
    expect(questionTypeOf('not an array')).toBe('mcq')
  })
})

describe('deriveQuizAgainParams', () => {
  const stored = {
    subject: 'Biology S4 SB',
    difficulty: 'advanced',
    textbook_id: 42,
    topic_ids: [7, 8],
    subtopic_ids: [31],
    duration: 25,
  }

  it('carries the shape of the paper without asking the student again', () => {
    const p = deriveQuizAgainParams(stored, [mcq, mcq, mcq, mcq, mcq])!
    expect(p.subject).toBe('Biology S4 SB')
    expect(p.difficultyLevel).toBe('advanced')
    expect(p.count).toBe(5)
    expect(p.questionType).toBe('mcq')
    expect(p.textbook_id).toBe(42)
    expect(p.topic_ids).toEqual([7, 8])
    expect(p.subtopic_ids).toEqual([31])
    expect(p.customTime).toBe(25)
  })

  it('keeps the raw subject, not a cleaned one', () => {
    // The generator matches on the stored value; a display name would not
    // resolve to a textbook.
    expect(deriveQuizAgainParams(stored, [mcq])!.subject).toBe('Biology S4 SB')
  })

  it('falls back to the wizard defaults where a column is empty', () => {
    const p = deriveQuizAgainParams({ subject: 'Biology' }, [])!
    expect(p.count).toBe(10)
    expect(p.difficultyLevel).toBe('intermediate')
    expect(p.questionType).toBe('mcq')
    expect(p.textbook_id).toBeNull()
    expect(p.customTime).toBeUndefined()
  })

  it('caps a very long paper rather than repeating its length', () => {
    const long = Array.from({ length: 90 }, () => mcq)
    expect(deriveQuizAgainParams(stored, long)!.count).toBe(40)
  })

  it('drops malformed ids rather than passing them on', () => {
    const p = deriveQuizAgainParams({ ...stored, topic_ids: [7, null, 'x', -2, 9] }, [mcq])!
    expect(p.topic_ids).toEqual([7, 9])
  })

  it('returns nothing without a subject, since there is nothing to ask for', () => {
    expect(deriveQuizAgainParams({ difficulty: 'easy' }, [mcq])).toBeNull()
    expect(deriveQuizAgainParams(null, [mcq])).toBeNull()
  })
})

describe('canQuizAgain', () => {
  it('allows a repeat when there is curriculum behind the quiz', () => {
    expect(canQuizAgain(deriveQuizAgainParams({ subject: 'Biology', topic_ids: [3] }, [mcq]))).toBe(true)
    expect(canQuizAgain(deriveQuizAgainParams({ subject: 'Biology', textbook_id: 9 }, [mcq]))).toBe(true)
  })

  it('refuses for a typed topic with nothing behind it', () => {
    // Offering the button there would promise more than it can deliver.
    expect(canQuizAgain(deriveQuizAgainParams({ subject: 'How vaccines work' }, [mcq]))).toBe(false)
    expect(canQuizAgain(null)).toBe(false)
  })
})
