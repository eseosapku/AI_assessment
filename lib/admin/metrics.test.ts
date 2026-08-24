import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  loadHeadline,
  loadImprovement,
  loadActivity,
  loadSubjects,
  loadEngagement,
  loadStudyLoop,
  loadAdminMetrics,
  metricWarnings,
} from './metrics'
import type { Database } from '@/lib/db'

const dbWith = (rows: Record<string, unknown>[]): Database =>
  ({ query: vi.fn().mockResolvedValue({ rows }) }) as unknown as Database

const failing = (message = 'relation does not exist'): Database =>
  ({ query: vi.fn().mockRejectedValue(new Error(message)) }) as unknown as Database

let error: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  error = vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => error.mockRestore())

describe('loadHeadline', () => {
  it('coerces the counts Postgres returns as strings', () => {
    // COUNT(*) comes back as a string from pg; a raw pass-through would put
    // "845" through arithmetic later and produce nonsense.
    return expect(
      loadHeadline(dbWith([{ students: '845', teachers: '84', quizzes: '1672' }])),
    ).resolves.toMatchObject({ students: 845, teachers: 84, quizzes: 1672 })
  })

  it('returns zeroes rather than NaN when a column is absent', async () => {
    const h = await loadHeadline(dbWith([{}]))
    expect(h.students).toBe(0)
    expect(h.recallCards).toBe(0)
  })

  it('survives an empty result set', async () => {
    await expect(loadHeadline(dbWith([]))).resolves.toMatchObject({ students: 0 })
  })

  it('excludes proctor-ended attempts from the quiz count', async () => {
    const db = dbWith([{}])
    await loadHeadline(db)
    expect((db.query as ReturnType<typeof vi.fn>).mock.calls[0][0]).toContain("submission_reason IS DISTINCT FROM 'violation'")
  })
})

describe('loadImprovement', () => {
  it('reports the gain between a student’s first and last attempts', async () => {
    const m = await loadImprovement(dbWith([{ students: '56', first_three: '55.6', last_three: '67.4' }]))
    expect(m).toEqual({ students: 56, firstThreeAvg: 56, lastThreeAvg: 67, delta: 11 })
  })

  it('reports a decline rather than hiding it', async () => {
    // A platform that only reports improvement is marketing, not measurement.
    const m = await loadImprovement(dbWith([{ students: '10', first_three: '70', last_three: '58' }]))
    expect(m.delta).toBe(-12)
  })

  it('only counts students with enough attempts for the windows not to overlap', async () => {
    const db = dbWith([{}])
    await loadImprovement(db)
    // Below six, first-three and last-three share attempts, which compares a
    // student against themselves and reports zero however well they did.
    expect((db.query as ReturnType<typeof vi.fn>).mock.calls[0][0]).toContain('total >= 6')
  })

  it('handles a platform with nobody eligible yet', async () => {
    await expect(loadImprovement(dbWith([{ students: '0', first_three: null, last_three: null }])))
      .resolves.toEqual({ students: 0, firstThreeAvg: 0, lastThreeAvg: 0, delta: 0 })
  })
})

describe('loadActivity', () => {
  it('returns a point per month, oldest first so a chart reads left to right', async () => {
    const points = await loadActivity(
      dbWith([
        { month: '2026-05', active_students: '282', quizzes: '798', avg_score: '55.7' },
        { month: '2026-06', active_students: '213', quizzes: '602', avg_score: '63.2' },
      ]),
    )
    expect(points.map((p) => p.month)).toEqual(['2026-05', '2026-06'])
    expect(points[1]).toEqual({ month: '2026-06', activeStudents: 213, quizzes: 602, avgScore: 63 })
  })

  it('passes the window as a bound parameter rather than interpolating it', async () => {
    const db = dbWith([])
    await loadActivity(db, 6)
    const [, values] = (db.query as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(values).toEqual(['6'])
  })
})

describe('loadSubjects', () => {
  it('keeps the stored subject value for the caller to canonicalise', async () => {
    // Cleaning it in SQL would encode the same rules twice, in two languages,
    // and let them drift.
    const s = await loadSubjects(dbWith([{ subject: 'Biology S4  SB', attempts: '94', avg_score: '61.5', students: '12' }]))
    expect(s[0]).toEqual({ subject: 'Biology S4  SB', attempts: 94, avgScore: 62, students: 12 })
  })

  it('recovers the subject of teacher-set work from the assignment', async () => {
    const db = dbWith([])
    await loadSubjects(db)
    expect((db.query as ReturnType<typeof vi.fn>).mock.calls[0][0]).toContain('assignment_results')
  })
})

describe('loadEngagement', () => {
  it('converts seconds into the units a person reads', async () => {
    const e = await loadEngagement(dbWith([{
      days_with_activity: '1155', active_students: '300',
      total_hours: '412.7', median_minutes: '18.4',
    }]))
    expect(e).toEqual({
      daysWithActivity: 1155, activeStudents: 300, totalHours: 413, medianMinutesPerActiveDay: 18,
    })
  })
})

describe('loadStudyLoop', () => {
  it('counts gap lessons that were actually followed by a quiz', async () => {
    const s = await loadStudyLoop(dbWith([{ from_gaps: '18', from_scratch: '47', proven: '5' }]))
    expect(s).toEqual({ lessonsFromGaps: 18, lessonsFromScratch: 47, provenLessons: 5 })
  })
})

describe('loadAdminMetrics', () => {
  it('contains a single failure instead of losing the whole page', async () => {
    // Eight working panels and one named failure beats a stack trace.
    const metrics = await loadAdminMetrics(failing())
    expect(metrics.headline.data).toBeNull()
    expect(metrics.headline.error).toBe('Headline counts unavailable')
    expect(metrics.improvement.error).toBe('Improvement unavailable')
  })

  it('lists every failure as a warning for the envelope', async () => {
    expect(metricWarnings(await loadAdminMetrics(failing()))).toHaveLength(6)
  })

  it('reports no warnings when everything loads', async () => {
    expect(metricWarnings(await loadAdminMetrics(dbWith([{}])))).toEqual([])
  })
})
