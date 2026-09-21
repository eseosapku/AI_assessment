// lib/checkpoint-past-papers.test.ts
import { describe, it, expect } from 'vitest'
import {
  sittingsFor, sittingLabel, sittingId, sittingById, hasSittings, fociForSitting,
} from './checkpoint-past-papers'

describe('what was actually supplied', () => {
  it('has sittings for the components whose papers we were given', () => {
    // Lower Secondary Mathematics is the best covered: four years.
    expect(sittingsFor('0862', '01').length).toBeGreaterThan(0)
    expect(sittingsFor('0862', '02').length).toBeGreaterThan(0)
    expect(sittingsFor('0893', '01').length).toBeGreaterThan(0)
    expect(sittingsFor('0097', '01').length).toBeGreaterThan(0)
  })

  it('has none for Primary Mathematics, and says so rather than pretending', () => {
    // No 0096 papers were supplied. The form must not offer a year picker it
    // cannot fill; an empty list would read as a loading failure.
    expect(hasSittings('0096', '01')).toBe(false)
    expect(hasSittings('0096', '02')).toBe(false)
  })

  it('orders newest first', () => {
    const years = sittingsFor('0862', '01').map((s) => s.year)
    expect(years).toEqual([...years].sort((a, b) => b - a))
  })

  it('records real topic coverage, not a token amount', () => {
    for (const s of sittingsFor('0862', '01')) {
      expect(s.foci.length, `${s.year}`).toBeGreaterThan(5)
    }
  })

  it('stores no question text', () => {
    // Cambridge's questions are theirs. Only coverage is kept.
    for (const s of [...sittingsFor('0862', '01'), ...sittingsFor('0893', '01')]) {
      expect(Object.keys(s)).not.toContain('questions')
      expect(Object.keys(s)).not.toContain('text')
    }
  })
})

describe('naming a sitting', () => {
  it('is the year, and only the year', () => {
    // "May 2025" beside "2026" beside "May 2024" reads as three different
    // kinds of thing, and the month answers a question nobody revising asks.
    for (const s of sittingsFor('0862', '01')) {
      expect(sittingLabel(s), String(s.year)).toMatch(/^\d{4}$/)
    }
    expect(sittingLabel({ year: 2026, session: null } as never, [])).toBe('2026')
  })

  it('adds the month only when two sittings of one component share a year', () => {
    // The session is kept in the data for exactly this case; across
    // everything supplied, no component has two sittings in one year.
    const may = { code: '0893', component: '01', year: 2025, session: 'May' } as never
    const october = { code: '0893', component: '01', year: 2025, session: 'October' } as never
    expect(sittingLabel(may, [may, october])).toBe('May 2025')
    expect(sittingLabel(may, [may])).toBe('2025')
  })

  it('round-trips through its id', () => {
    for (const s of sittingsFor('0893', '02')) {
      expect(sittingById(sittingId(s))).toEqual(s)
    }
  })

  it('returns nothing for an id that names no sitting', () => {
    expect(sittingById('0000-01-1999-x')).toBeUndefined()
  })
})

describe('choosing the foci to build from', () => {
  const fallback = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']

  it('uses the sitting when it covered enough ground', () => {
    const s = { foci: ['photosynthesis', 'forces', 'acids', 'cells', 'energy', 'circuits', 'magnets', 'rocks', 'gases'] }
    expect(fociForSitting(s as never, fallback, 8)).toContain('photosynthesis')
  })

  it('falls back when the sitting recorded too little to fill a paper', () => {
    // A paper of six repeated topics is worse than the general spread.
    expect(fociForSitting({ foci: ['x', 'y'] } as never, fallback, 20)).toEqual(fallback)
  })

  it('falls back when nothing was chosen', () => {
    expect(fociForSitting(undefined, fallback, 20)).toEqual(fallback)
  })
})
