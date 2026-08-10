import { describe, it, expect } from 'vitest'
import {
  summarizeWeakAreas,
  pickProblemAreas,
  allMissedQuestions,
  PROBLEM_AREA_THRESHOLD,
  UNLABELLED_AREA,
  creditFromMarks,
  type QuestionOutcome,
} from './assessment-weak-areas'

const o = (index: number, label: string, credit: number): QuestionOutcome => ({ index, label, credit })

describe('summarizeWeakAreas', () => {
  it('groups by area and reports accuracy', () => {
    const areas = summarizeWeakAreas([
      o(0, 'Shapes', 1), o(1, 'Shapes', 0),
      o(2, 'Fractions', 1), o(3, 'Fractions', 1),
    ])
    expect(areas.map((a) => [a.label, a.accuracy])).toEqual([
      ['Shapes', 50],
      ['Fractions', 100],
    ])
  })

  it('reports missed questions as one-based numbers', () => {
    const areas = summarizeWeakAreas([o(0, 'Shapes', 0), o(3, 'Shapes', 0), o(1, 'Shapes', 1)])
    expect(areas[0].missedQuestions).toEqual([1, 4])
  })

  it('sorts weakest first', () => {
    const areas = summarizeWeakAreas([
      o(0, 'Good', 1), o(1, 'Bad', 0), o(2, 'Middling', 1), o(3, 'Middling', 0),
    ])
    expect(areas.map((a) => a.label)).toEqual(['Bad', 'Middling', 'Good'])
  })

  it('breaks accuracy ties on sample size, since more questions is stronger evidence', () => {
    const areas = summarizeWeakAreas([
      o(0, 'Small', 1), o(1, 'Small', 0),
      o(2, 'Big', 1), o(3, 'Big', 0), o(4, 'Big', 1), o(5, 'Big', 0),
    ])
    expect(areas.map((a) => a.label)).toEqual(['Big', 'Small'])
  })

  it('counts part-marks proportionally rather than as a failure', () => {
    // A written answer worth 3 of 5 marks should drag the area to 60%, not 0%.
    const areas = summarizeWeakAreas([o(0, 'Essay', 0.6)])
    expect(areas[0].accuracy).toBe(60)
    expect(areas[0].missedQuestions).toEqual([1])
  })

  it('groups blank and whitespace labels under a single fallback', () => {
    const areas = summarizeWeakAreas([o(0, '', 1), o(1, '   ', 0)])
    expect(areas).toHaveLength(1)
    expect(areas[0].label).toBe(UNLABELLED_AREA)
    expect(areas[0].total).toBe(2)
  })

  it('normalises whitespace so the same area does not split in two', () => {
    const areas = summarizeWeakAreas([o(0, 'Right  angles', 1), o(1, 'Right angles', 0)])
    expect(areas).toHaveLength(1)
  })

  it('clamps out-of-range and non-numeric credit', () => {
    const areas = summarizeWeakAreas([
      o(0, 'A', 5), o(1, 'A', -2), o(2, 'A', NaN as number),
    ])
    expect(areas[0].correct).toBe(1)
    expect(areas[0].accuracy).toBe(33)
  })

  it('survives prototype-polluting area labels', () => {
    // Labels come from model-tagged question data, so they are untrusted.
    const areas = summarizeWeakAreas([
      o(0, '__proto__', 0), o(1, 'constructor', 1), o(2, '__proto__', 1),
    ])
    expect(areas.find((a) => a.label === '__proto__')?.total).toBe(2)
    expect(areas.find((a) => a.label === 'constructor')?.total).toBe(1)
    expect(({} as Record<string, unknown>).total).toBeUndefined()
  })

  it('ignores malformed entries instead of throwing', () => {
    const areas = summarizeWeakAreas([
      null as unknown as QuestionOutcome,
      undefined as unknown as QuestionOutcome,
      o(0, 'A', 1),
    ])
    expect(areas).toHaveLength(1)
  })

  it('returns nothing for an empty paper', () => {
    expect(summarizeWeakAreas([])).toEqual([])
  })
})

describe('pickProblemAreas', () => {
  it('offers only areas below the threshold', () => {
    const areas = summarizeWeakAreas([
      o(0, 'Weak', 0), o(1, 'Weak', 0),
      o(2, 'Strong', 1), o(3, 'Strong', 1),
    ])
    expect(pickProblemAreas(areas).map((a) => a.label)).toEqual(['Weak'])
  })

  it('offers nothing when the paper was aced', () => {
    // A student who got everything right must not be shown their best topic
    // under a "problem areas" heading.
    const areas = summarizeWeakAreas([o(0, 'A', 1), o(1, 'B', 1)])
    expect(pickProblemAreas(areas)).toEqual([])
  })

  it('treats the threshold as exclusive', () => {
    const areas = [{ label: 'Edge', total: 10, correct: 7, accuracy: PROBLEM_AREA_THRESHOLD, missedQuestions: [] }]
    expect(pickProblemAreas(areas)).toEqual([])
  })

  it('accepts a custom threshold', () => {
    const areas = summarizeWeakAreas([o(0, 'A', 1), o(1, 'A', 0)])
    expect(pickProblemAreas(areas, 40)).toEqual([])
    expect(pickProblemAreas(areas, 60).map((a) => a.label)).toEqual(['A'])
  })
})

describe('creditFromMarks', () => {
  it('converts part-marks to fractional credit', () => {
    expect(creditFromMarks(3, 5)).toBe(0.6)
    expect(creditFromMarks(5, 5)).toBe(1)
    expect(creditFromMarks(0, 5)).toBe(0)
  })

  it('scores an ungraded question as zero rather than skipping it', () => {
    // Skipping would inflate the area the question belongs to.
    expect(creditFromMarks(undefined, 5)).toBe(0)
    expect(creditFromMarks(null, 5)).toBe(0)
    expect(creditFromMarks(NaN, 5)).toBe(0)
  })

  it('treats a zero or missing total as no credit instead of dividing by zero', () => {
    expect(creditFromMarks(3, 0)).toBe(0)
    expect(creditFromMarks(3, undefined)).toBe(0)
    expect(creditFromMarks(3, -2)).toBe(0)
  })

  it('clamps marks awarded above the total', () => {
    expect(creditFromMarks(9, 5)).toBe(1)
  })
})

describe('allMissedQuestions', () => {
  it('merges and dedupes across areas, ascending', () => {
    const areas = summarizeWeakAreas([
      o(4, 'A', 0), o(0, 'B', 0), o(2, 'A', 0), o(1, 'B', 1),
    ])
    expect(allMissedQuestions(areas)).toEqual([1, 3, 5])
  })

  it('is empty when nothing was missed', () => {
    expect(allMissedQuestions(summarizeWeakAreas([o(0, 'A', 1)]))).toEqual([])
  })
})
