import { describe, expect, it } from 'vitest'
import { briefKey, briefsFor, buildBriefBlock, type TopicBrief } from './topic-briefs'

const brief = (topic: string, over: Partial<TopicBrief> = {}): TopicBrief => ({
  book: 'CAMBRIDGE PRIMARY MATHEMATICS LEARNERS BOOK3', topic, level: 'Cambridge Primary, Stage 3 (age 8)', stage: 3,
  teaches: 'Perimeter by adding side lengths; area by counting squares.',
  notYet: 'No area formulae, no circles, no angles in degrees.',
  example: 'A rectangle has sides 4 cm and 2 cm. What is its perimeter? Answer: 12 cm.',
  ...over,
})
const briefs = { [briefKey(42, '6 Measurement, area and perimeter')]: brief('6 Measurement, area and perimeter') }

describe('briefsFor', () => {
  it('finds the brief for a chapter of a book', () => {
    expect(briefsFor(42, ['6 Measurement, area and perimeter'], briefs).map((b) => b.topic)).toEqual(['6 Measurement, area and perimeter'])
  })
  it('gives nothing for another book, a chapter without one, or no book', () => {
    expect(briefsFor(43, ['6 Measurement, area and perimeter'], briefs)).toEqual([])
    expect(briefsFor(42, ['8 Time'], briefs)).toEqual([])
    expect(briefsFor(undefined, ['6 Measurement, area and perimeter'], briefs)).toEqual([])
  })
})

describe('the prompt block', () => {
  it('says what the chapter teaches, what it does not yet, and outranks the generic level guidance', () => {
    const block = buildBriefBlock([brief('6 Measurement, area and perimeter')])
    expect(block).toContain('area by counting squares')
    expect(block).toContain('NOT taught yet')
    expect(block).toContain('No area formulae')
    expect(block).toContain('overrides any other level guidance')
  })
  it('is empty when there is no brief', () => {
    expect(buildBriefBlock([])).toBe('')
  })
})
