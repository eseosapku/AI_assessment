import { describe, it, expect } from 'vitest'
import {
  recordGenerationTime,
  typicalGenerationTime,
  progressFor,
  shouldAnnounce,
  FALLBACK_TYPICAL_SECONDS,
  type TimeStore,
} from './generation-progress'

function memoryStore(initial: number[] = []): TimeStore {
  let times = [...initial]
  return { read: () => times, write: (t) => { times = t } }
}

describe('typicalGenerationTime', () => {
  it('falls back until there is enough history to mean anything', () => {
    expect(typicalGenerationTime(memoryStore([]))).toBe(FALLBACK_TYPICAL_SECONDS)
    expect(typicalGenerationTime(memoryStore([30]))).toBe(FALLBACK_TYPICAL_SECONDS)
  })

  it('uses the median so one slow run does not poison the estimate', () => {
    // A single 200s outlier would drag a mean to 62; the median ignores it.
    expect(typicalGenerationTime(memoryStore([30, 35, 40, 45, 200]))).toBe(40)
  })

  it('averages the middle pair when the sample is even', () => {
    expect(typicalGenerationTime(memoryStore([30, 40]))).toBe(35)
  })
})

describe('recordGenerationTime', () => {
  it('keeps a rolling window so the estimate follows a change in model speed', () => {
    const store = memoryStore([1, 2, 3, 4, 5, 6, 7])
    recordGenerationTime(8, store)
    expect(store.read()).toEqual([2, 3, 4, 5, 6, 7, 8])
  })

  it('ignores nonsense rather than storing it', () => {
    const store = memoryStore([])
    recordGenerationTime(0, store)
    recordGenerationTime(-5, store)
    recordGenerationTime(NaN, store)
    expect(store.read()).toEqual([])
  })
})

describe('progressFor', () => {
  it('never reaches 100, because the bar must not finish before the paper', () => {
    for (const elapsed of [0, 10, 45, 90, 300, 10_000]) {
      expect(progressFor(elapsed, 45).pct).toBeLessThanOrEqual(95)
    }
  })

  it('rises monotonically', () => {
    let last = -1
    for (let t = 0; t <= 200; t += 5) {
      const pct = progressFor(t, 45).pct
      expect(pct).toBeGreaterThanOrEqual(last)
      last = pct
    }
  })

  it('says how long it usually takes while the run is still normal', () => {
    const p = progressFor(20, 45)
    expect(p.overdue).toBe(false)
    expect(p.message).toContain('45 seconds')
  })

  it('admits when a run has gone past normal instead of claiming it is nearly done', () => {
    const p = progressFor(90, 45)
    expect(p.overdue).toBe(true)
    expect(p.message).toMatch(/longer than usual/i)
    expect(p.message).not.toMatch(/almost|nearly/i)
  })

  it('survives a nonsense estimate without dividing by zero', () => {
    expect(progressFor(10, 0).pct).toBeLessThanOrEqual(95)
    expect(Number.isFinite(progressFor(10, 0).pct)).toBe(true)
  })
})

describe('shouldAnnounce', () => {
  it('speaks periodically rather than every second', () => {
    // Announcing each tick reads the whole line aloud every second.
    expect(shouldAnnounce(1)).toBe(false)
    expect(shouldAnnounce(15)).toBe(true)
    expect(shouldAnnounce(16)).toBe(false)
    expect(shouldAnnounce(30)).toBe(true)
  })

  it('stays quiet at zero, before anything has happened', () => {
    expect(shouldAnnounce(0)).toBe(false)
  })
})
