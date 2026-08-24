import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  loadGapLifecycle,
  loadGapTimeline,
  loadTaggingCoverage,
  loadPerformanceLift,
  GAP_THRESHOLD,
} from './gap-metrics'
import type { Database } from '@/lib/db'

const dbWith = (rows: Record<string, unknown>[]): Database =>
  ({ query: vi.fn().mockResolvedValue({ rows }) }) as unknown as Database

const sqlOf = (db: Database, call = 0): string =>
  (db.query as ReturnType<typeof vi.fn>).mock.calls[call][0] as string

let error: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  error = vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => error.mockRestore())

describe('the gap threshold', () => {
  it('is the same line the learner-facing gap map draws', () => {
    // If these ever diverge, the dashboard and the student describe the same
    // subtopic in contradictory terms.
    expect(GAP_THRESHOLD).toBe(50)
  })
})

describe('loadGapLifecycle', () => {
  it('coerces the counts Postgres returns as strings', async () => {
    const g = await loadGapLifecycle(
      dbWith([{ identified: '21436', closed: '16091', students: '5617', subtopics: '2874', median_days: '1.83' }]),
    )
    expect(g.identified).toBe(21436)
    expect(g.closed).toBe(16091)
    expect(g.medianDaysToClose).toBe(1.8)
  })

  it('keeps enough precision to tell a same-day close from no close at all', async () => {
    // Live, the median is 68 minutes. One decimal place would report that as
    // 0 days, which reads as "never closed" — the opposite of the truth.
    const g = await loadGapLifecycle(dbWith([{ identified: '162', closed: '6', median_days: '0.0475' }]))
    expect(g.medianDaysToClose).toBe(0.048)
  })

  it('derives what is still open rather than trusting a separate count', async () => {
    const g = await loadGapLifecycle(dbWith([{ identified: '162', closed: '6' }]))
    expect(g.stillOpen).toBe(156)
  })

  it('reports a closure rate to one decimal', async () => {
    const g = await loadGapLifecycle(dbWith([{ identified: '162', closed: '6' }]))
    expect(g.closureRate).toBe(3.7)
  })

  it('says nothing rather than zero when no gap has ever closed', async () => {
    // A median of zero days would read as "closed instantly", which is the
    // opposite of "never closed".
    const g = await loadGapLifecycle(dbWith([{ identified: '10', closed: '0', median_days: null }]))
    expect(g.medianDaysToClose).toBeNull()
    expect(g.closureRate).toBe(0)
  })

  it('survives an empty platform without dividing by zero', async () => {
    const g = await loadGapLifecycle(dbWith([]))
    expect(g).toMatchObject({ identified: 0, closed: 0, stillOpen: 0, closureRate: 0 })
  })

  it('requires a later paper to count a gap as closed', async () => {
    const db = dbWith([{}])
    await loadGapLifecycle(db)
    // Studying a subtopic must not close it; only a subsequent measurement can.
    expect(sqlOf(db)).toContain('m2.created_at > o.opened_at')
    expect(sqlOf(db)).toContain(`m2.pct >= ${GAP_THRESHOLD}`)
  })

  it('excludes papers the proctor ended', async () => {
    const db = dbWith([{}])
    await loadGapLifecycle(db)
    expect(sqlOf(db)).toContain("submission_reason IS DISTINCT FROM 'violation'")
  })

  it('counts a gap once per student and subtopic, not once per wrong answer', async () => {
    const db = dbWith([{}])
    await loadGapLifecycle(db)
    expect(sqlOf(db)).toContain('GROUP BY 1, 2')
  })
})

describe('loadGapTimeline', () => {
  it('returns a point per month, oldest first', async () => {
    const points = await loadGapTimeline(
      dbWith([
        { month: '2026-06', identified: '80', closed: '6' },
        { month: '2026-07', identified: '47', closed: '0' },
      ]),
    )
    expect(points).toEqual([
      { month: '2026-06', identified: 80, closed: 6 },
      { month: '2026-07', identified: 47, closed: 0 },
    ])
  })

  it('generates the month spine so quiet months still appear', async () => {
    // Grouping on the data alone would silently drop months where nothing
    // happened, which is exactly the shape worth seeing.
    const db = dbWith([])
    await loadGapTimeline(db)
    expect(sqlOf(db)).toContain('generate_series')
  })

  it('passes the window as a bound parameter rather than interpolating it', async () => {
    const db = dbWith([])
    await loadGapTimeline(db, 6)
    expect((db.query as ReturnType<typeof vi.fn>).mock.calls[0][1]).toEqual(['6'])
  })
})

describe('loadTaggingCoverage', () => {
  it('reports coverage as a percentage of all papers', async () => {
    const c = await loadTaggingCoverage(dbWith([{ assessments: '1923', tagged: '178', identified: '162' }]))
    expect(c.coverage).toBe(9.3)
  })

  it('reports the per-paper gap rate any forecast has to be built on', async () => {
    const c = await loadTaggingCoverage(dbWith([{ assessments: '1923', tagged: '178', identified: '162' }]))
    expect(c.gapsPerTaggedPaper).toBe(0.91)
  })

  it('does not divide by zero before any paper is tagged', async () => {
    const c = await loadTaggingCoverage(dbWith([{ assessments: '100', tagged: '0', identified: '0' }]))
    expect(c.gapsPerTaggedPaper).toBe(0)
    expect(c.coverage).toBe(0)
  })
})

describe('loadPerformanceLift', () => {
  it('reports the gain between first and last papers in points and relative terms', async () => {
    const l = await loadPerformanceLift(dbWith([{ students: '56', first_three: '55.68', last_three: '67.14' }]))
    expect(l).toEqual({
      students: 56,
      firstThreeAvg: 55.7,
      lastThreeAvg: 67.1,
      deltaPoints: 11.4,
      // Derived from the rounded averages, not the raw ones, so the figure the
      // card shows is reproducible from the two figures beside it.
      deltaRelative: 20.5,
    })
  })

  it('reports a decline rather than hiding it', async () => {
    // A dashboard that can only go up is marketing, not measurement.
    const l = await loadPerformanceLift(dbWith([{ students: '10', first_three: '70', last_three: '58' }]))
    expect(l.deltaPoints).toBe(-12)
    expect(l.deltaRelative).toBeLessThan(0)
  })

  it('only counts students with enough papers for the windows not to overlap', async () => {
    const db = dbWith([{}])
    await loadPerformanceLift(db)
    expect(sqlOf(db)).toContain('total >= 6')
  })

  it('handles a platform where nobody qualifies yet', async () => {
    const l = await loadPerformanceLift(dbWith([{ students: '0', first_three: null, last_three: null }]))
    expect(l).toEqual({ students: 0, firstThreeAvg: 0, lastThreeAvg: 0, deltaPoints: 0, deltaRelative: 0 })
  })
})
