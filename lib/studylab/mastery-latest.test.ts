import { describe, it, expect } from 'vitest'
import { GAP_THRESHOLD } from '@/lib/admin/gap-metrics'
import { nextLatest, readLatest, bandFor, GAP_BELOW } from './mastery-latest'

const fresh = { last_accuracy: 30, lowest_accuracy: 30, pending_correct: 0, pending_total: 0 }

describe('nextLatest', () => {
  it('a retake counts on its own', () => expect(nextLatest(fresh, 30, 10, 10)).toEqual({ last_accuracy: 100, lowest_accuracy: 30, pending_correct: 0, pending_total: 0 }))
  it('one or two questions do not count yet', () => expect(nextLatest(fresh, 30, 1, 1)).toEqual({ last_accuracy: 30, lowest_accuracy: 30, pending_correct: 1, pending_total: 1 }))
  it('small amounts gather, then count together', () => expect(nextLatest({ pending_correct: 2, pending_total: 2 }, null, 0, 1)).toEqual({ last_accuracy: 66.67, lowest_accuracy: 66.67, pending_correct: 0, pending_total: 0 }))
  it('a real attempt ignores and clears the pile', () => expect(nextLatest({ pending_correct: 0, pending_total: 2 }, null, 10, 10)).toMatchObject({ last_accuracy: 100, pending_total: 0 }))
  it('an old row takes its average as the lowest so far', () => expect(nextLatest(null, 42, 9, 10)).toMatchObject({ last_accuracy: 90, lowest_accuracy: 42 }))
  it('a later bad attempt lowers both', () => expect(nextLatest({ last_accuracy: 90, lowest_accuracy: 42 }, 60, 3, 10)).toMatchObject({ last_accuracy: 30, lowest_accuracy: 30 }))
})

describe('readLatest', () => {
  it('reads pg strings', () => expect(readLatest({ attempts: 13, accuracy: '65.00', last_accuracy: '100.00', lowest_accuracy: '30.00' })).toEqual({ score: 100, lowest: 30 }))
  it('falls back to the average', () => expect(readLatest({ attempts: 10, accuracy: '65.00' })).toEqual({ score: 65, lowest: 65 }))
  it('no attempts means no score', () => expect(readLatest({ attempts: 0, accuracy: 0 })).toEqual({ score: null, lowest: null }))
})

describe('bandFor', () => {
  it.each([[null, null, 'none'], [49, 49, 'gap'], [50, 50, 'shaky'], [79, 42, 'shaky'], [80, 80, 'solid'], [80, 50, 'solid'], [88, 42, 'gold'], [60, 42, 'shaky']])('band %s %s', (s, l, b) => expect(bandFor(s as number | null, l as number | null)).toBe(b))
  it('stays in step with the admin line', () => expect(GAP_BELOW).toBe(GAP_THRESHOLD))
})
