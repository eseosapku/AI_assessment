// lib/subject-guidance.test.ts
import { describe, it, expect } from 'vitest'
import { subjectGuidance } from './subject-guidance'

describe('the subjects that need nothing extra', () => {
  it('says nothing for the ordinary ones', () => {
    // The prompt must not grow for subjects that were already fine: every
    // character here is spent on every generation of that subject.
    for (const subject of ['Biology', 'Mathematics', 'Chemistry', 'Geography', 'Physics']) {
      expect(subjectGuidance({ subject, grade: 9 }), subject).toBe('')
    }
  })

  it('says nothing for an empty or missing subject', () => {
    expect(subjectGuidance({ subject: '' })).toBe('')
    expect(subjectGuidance({ subject: '   ' })).toBe('')
  })
})

describe('music', () => {
  const g = subjectGuidance({ subject: 'Music', grade: 9 })

  it('forbids the two things that cannot be put on screen', () => {
    // Both were generated live, both were deleted by the filters, and the
    // paper came back short as a result.
    expect(g).toMatch(/listen to/i)
    expect(g).toMatch(/notation/i)
  })

  it('says what to ask instead, not only what to avoid', () => {
    // A prompt that only forbids leaves the model with nothing to write.
    expect(g).toMatch(/DO ask/)
    expect(g).toMatch(/instrument families/i)
  })

  it('spells out the note arithmetic that was got wrong', () => {
    // Live: "equivalent to two half notes?" marked "four eighth notes".
    expect(g).toMatch(/two half notes are 4 beats/i)
    expect(g).toMatch(/rest/i)
  })
})

describe('art and performance', () => {
  it('forbids looking and drawing, and bans the vague stem', () => {
    const g = subjectGuidance({ subject: 'Fine Art', grade: 8 })
    expect(g).toMatch(/look at this painting/i)
    expect(g).toMatch(/Which best describes/i)
  })

  it('covers drama and PE', () => {
    for (const subject of ['Drama', 'Physical Education', 'Dance']) {
      expect(subjectGuidance({ subject, grade: 9 }), subject).toMatch(/perform/i)
    }
  })
})

describe('literature', () => {
  it('forbids leaning on a book the learner does not have', () => {
    const g = subjectGuidance({ subject: 'Literature', grade: 11 })
    expect(g).toMatch(/in Chapter 3/i)
    expect(g).toMatch(/DO ask/)
  })

  it('stands down once an extract travels with the question', () => {
    // With a passage attached the questions SHOULD lean on it, and this rule
    // would forbid exactly what is wanted.
    expect(subjectGuidance({ subject: 'Literature', grade: 11, hasPassage: true }))
      .not.toMatch(/in Chapter 3/i)
  })
})

describe('early phonics', () => {
  it('applies low down, where the fault was found', () => {
    const g = subjectGuidance({ subject: 'English', grade: 1 })
    expect(g).toMatch(/rhyme/i)
    expect(g).toMatch(/four right answers/i)
  })

  it('does not follow the subject up the school', () => {
    // A senior English paper does not ask which word rhymes with cat.
    expect(subjectGuidance({ subject: 'English', grade: 11 })).toBe('')
  })

  it('stays quiet when the grade is unknown rather than guessing', () => {
    expect(subjectGuidance({ subject: 'English' })).toBe('')
  })
})

describe('more than one rule at a time', () => {
  it('accumulates rather than picking the first match', () => {
    // A Music paper for seven-year-olds is both a Music paper and a paper
    // where sound questions have to have one answer.
    const g = subjectGuidance({ subject: 'Music and English', grade: 2 })
    expect(g).toMatch(/listen to/i)
    expect(g).toMatch(/rhyme/i)
  })

  it('carries one header however many blocks apply', () => {
    const g = subjectGuidance({ subject: 'Music and English', grade: 2 })
    expect(g.match(/SUBJECT RULES/g)?.length).toBe(1)
  })
})
