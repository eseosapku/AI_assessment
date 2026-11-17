import { describe, it, expect } from 'vitest'
import { nextLatest, readLatest, bandFor, type LatestColumns } from '@/lib/studylab/mastery-latest'

/** Replays a sequence of quiz saves for one section, as save-result would. */
function replay(saves: [correct: number, total: number][], startAverage: number | null = null) {
  let cols: LatestColumns | null = null
  let correct = 0
  let total = 0
  for (const [c, t] of saves) {
    const avg = total ? (correct / total) * 100 : startAverage
    cols = nextLatest(cols, avg, c, t)
    correct += c
    total += t
  }
  const row = { attempts: total, accuracy: total ? (correct / total) * 100 : null, ...cols }
  return { cols: cols!, row, ...readLatest(row) }
}

describe('latest-attempt mastery, end to end', () => {
  it('a failing quiz then a strong retake turns the section gold', () => {
    const r = replay([[1, 5], [5, 5]])
    expect(r.score).toBe(100)
    expect(r.lowest).toBe(20)
    expect(bandFor(r.score, r.lowest)).toBe('gold')
  })

  it('a strong first attempt is solid, not gold', () => {
    const r = replay([[5, 5]])
    expect(bandFor(r.score, r.lowest)).toBe('solid')
  })

  it('the latest score wins over the average', () => {
    const r = replay([[5, 5], [5, 5], [0, 5]])
    expect(r.score).toBe(0)
    expect(bandFor(r.score, r.lowest)).toBe('gap')
  })

  it('tiny saves pile up until three questions are counted', () => {
    let cols = nextLatest(null, null, 1, 1)
    expect(cols.last_accuracy).toBeNull()
    expect(cols.pending_total).toBe(1)
    cols = nextLatest(cols, 100, 0, 1)
    expect(cols.last_accuracy).toBeNull()
    cols = nextLatest(cols, 50, 1, 1)
    expect(cols.last_accuracy).toBeCloseTo(66.67, 1)
    expect(cols.pending_total).toBe(0)
  })

  it('rows from before the migration fall back to the average', () => {
    const r = readLatest({ attempts: 10, accuracy: 62 })
    expect(r.score).toBe(62)
    expect(bandFor(r.score, r.lowest)).toBe('shaky')
  })

  it('an untried section has no band', () => {
    expect(readLatest({ attempts: 0, accuracy: 0 }).score).toBeNull()
    expect(bandFor(null, null)).toBe('none')
  })

  it('band edges: 49.99 gap, 50 shaky, 79.99 shaky, 80 solid', () => {
    expect(bandFor(49.99, null)).toBe('gap')
    expect(bandFor(50, null)).toBe('shaky')
    expect(bandFor(79.99, null)).toBe('shaky')
    expect(bandFor(80, null)).toBe('solid')
  })

  it('string values from Postgres DECIMAL columns are read as numbers', () => {
    const r = readLatest({ attempts: '6', accuracy: '40.00', last_accuracy: '85.00', lowest_accuracy: '30.00' })
    expect(r.score).toBe(85)
    expect(bandFor(r.score, r.lowest)).toBe('gold')
  })
})
