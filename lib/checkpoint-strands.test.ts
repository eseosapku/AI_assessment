// lib/checkpoint-strands.test.ts
import { describe, it, expect } from 'vitest'
import { tagQuestionToStrand, tagQuestionsWithStrands } from './checkpoint-strands'
import { checkpointSubject, STRAND_KEYWORDS } from './cambridge-checkpoint'

const SCIENCE = checkpointSubject('lower-secondary', 'Science')!

describe('tagQuestionToStrand', () => {
  it('matches a question to the strand its words belong to', () => {
    const tag = tagQuestionToStrand(
      { question: 'Describe how a chemical reaction changes the substances involved.' },
      SCIENCE.strands,
    )
    expect(tag).toEqual({ strand: 'Chemistry', matched: true })
  })

  it('reads the options and explanation too, not just the stem', () => {
    const tag = tagQuestionToStrand(
      { question: 'Which is correct?', options: ['A biology cell'], explanation: 'Cells are biology.' },
      SCIENCE.strands,
    )
    expect(tag?.strand).toBe('Biology')
  })

  it('says so when nothing matches, rather than picking one', () => {
    // The report counts only real matches. A fallback here would score a
    // strand the question may have nothing to do with.
    const tag = tagQuestionToStrand({ question: 'What is 2 + 2?' }, SCIENCE.strands)
    expect(tag?.matched).toBe(false)
  })

  it('returns null when there are no strands to match against', () => {
    expect(tagQuestionToStrand({ question: 'Anything.' }, [])).toBeNull()
  })

  it('never throws on whatever the generator produced', () => {
    expect(() => tagQuestionToStrand(null, SCIENCE.strands)).not.toThrow()
    expect(() => tagQuestionToStrand({ question: 42 }, SCIENCE.strands)).not.toThrow()
    expect(() => tagQuestionToStrand({ options: 'not an array' }, SCIENCE.strands)).not.toThrow()
  })
})

describe('tagQuestionsWithStrands', () => {
  it('writes the strand and whether it was matched onto every question', () => {
    const questions: any[] = [
      { question: 'Explain how a plant cell differs from an animal cell in biology.' },
      { question: 'What is 2 + 2?' },
    ]
    tagQuestionsWithStrands(questions, SCIENCE)
    expect(questions[0].strand).toBe('Biology')
    expect(questions[0].strand_matched).toBe(true)
    expect(questions[1].strand_matched).toBe(false)
  })

  it('never tags a strand from another subject', () => {
    const questions: any[] = [{ question: 'Describe an algebra expression and its statistics.' }]
    tagQuestionsWithStrands(questions, SCIENCE)
    expect(SCIENCE.strands).toContain(questions[0].strand)
  })

  it('can tag to the cross-cutting strand where the subject has one', () => {
    // "Thinking and Working Mathematically" runs through the content strands,
    // so a question can be tagged to it even though it is not one of them.
    const maths = checkpointSubject('lower-secondary', 'Mathematics')!
    const questions: any[] = [
      { question: 'Explain your thinking and justify the conjecture mathematically.' },
    ]
    tagQuestionsWithStrands(questions, maths)
    expect([...maths.strands, maths.crossCuttingStrand]).toContain(questions[0].strand)
  })

  it('leaves an empty paper alone', () => {
    expect(() => tagQuestionsWithStrands([], SCIENCE)).not.toThrow()
  })
})

describe('a strand is matched by the words a question actually uses', () => {
  // The flaw this pins: strand names are abstract. A real chemistry question
  // says "reaction" and "compound" and never the word "chemistry", so matching
  // on the name alone reported every strand as "not assessed" — a failure of
  // the tagger that reads as a finding about the paper.
  const cases: { text: string; strand: string }[] = [
    { text: 'When an acid reacts with a metal, what gas is produced?', strand: 'Chemistry' },
    { text: 'A lamp in a series circuit dims when another lamp is added. Why?', strand: 'Physics' },
    { text: 'Which part of the plant cell captures light for photosynthesis?', strand: 'Biology' },
    { text: 'Why does the Moon appear to change shape over a month?', strand: 'Earth and Space' },
    { text: 'In a fair test, which variable must be kept the same?', strand: 'Thinking and Working Scientifically' },
  ]

  for (const { text, strand } of cases) {
    it(`reads "${text.slice(0, 34)}…" as ${strand}`, () => {
      const tag = tagQuestionToStrand({ question: text }, SCIENCE.strands)
      expect(tag).toEqual({ strand, matched: true })
    })
  }

  it('matches a maths question to its content strand', () => {
    const maths = checkpointSubject('lower-secondary', 'Mathematics')!
    const tag = tagQuestionToStrand(
      { question: 'Find the area of a triangle with base 8 cm and height 5 cm.' },
      maths.strands,
    )
    expect(tag).toEqual({ strand: 'Algebra, Geometry and Measure', matched: true })
  })

  it('gives every strand of a built subject something to match on', () => {
    // A strand with no signals can never be matched, so it would always read
    // "not assessed" — silently unreportable rather than visibly missing.
    for (const programme of ['primary', 'lower-secondary'] as const) {
      for (const name of ['Mathematics', 'Science']) {
        const subject = checkpointSubject(programme, name)!
        const all = subject.crossCuttingStrand
          ? [...subject.strands, subject.crossCuttingStrand]
          : subject.strands
        for (const strand of all) {
          expect(STRAND_KEYWORDS[strand]?.length ?? 0, `${name} / ${strand}`).toBeGreaterThan(0)
        }
      }
    }
  })
})
