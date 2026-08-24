import { describe, it, expect, vi } from 'vitest'
import { loadLearningCurve, loadSubjectImprovement, loadMasteryMix } from './improvement-metrics'
import type { Database } from '@/lib/db'

const dbWith = (rows: Record<string, unknown>[]): Database =>
  ({ query: vi.fn().mockResolvedValue({ rows }) }) as unknown as Database

const sqlOf = (db: Database): string => (db.query as ReturnType<typeof vi.fn>).mock.calls[0][0] as string

describe('loadLearningCurve', () => {
  it('returns a point per position, in order', async () => {
    const c = await loadLearningCurve(
      dbWith([
        { nth: '1', students: '431', avg_score: '63.62' },
        { nth: '2', students: '254', avg_score: '58.61' },
      ]),
    )
    expect(c).toEqual([
      { nth: 1, students: 431, avgScore: 63.6 },
      { nth: 2, students: 254, avgScore: 58.6 },
    ])
  })

  it('keeps the student count, since the tail is thinner evidence', async () => {
    // A point backed by 22 students should not be read as firmly as one backed
    // by 431, and the chart can only show that if the count survives.
    const c = await loadLearningCurve(dbWith([{ nth: '9', students: '25', avg_score: '74.2' }]))
    expect(c[0].students).toBe(25)
  })

  it('excludes proctor-ended papers', async () => {
    const db = dbWith([])
    await loadLearningCurve(db)
    expect(sqlOf(db)).toContain("submission_reason IS DISTINCT FROM 'violation'")
  })

  it('passes the depth as a bound parameter', async () => {
    const db = dbWith([])
    await loadLearningCurve(db, 8)
    expect((db.query as ReturnType<typeof vi.fn>).mock.calls[0][1]).toEqual([8])
  })
})

describe('loadSubjectImprovement', () => {
  it('reports the change between a first and most recent paper', async () => {
    const rows = await loadSubjectImprovement(
      dbWith([{ subject: 'Geography S1 S.B', students: '9', first_paper: '68.33', last_paper: '80.44' }]),
    )
    expect(rows[0]).toEqual({
      subject: 'Geography S1 S.B',
      students: 9,
      firstPaper: 68.3,
      lastPaper: 80.4,
      deltaPoints: 12.1,
    })
  })

  it('reports a fall as a fall', async () => {
    // A table that can only go up is not evidence of anything.
    const rows = await loadSubjectImprovement(
      dbWith([{ subject: 'Entrepreneurship S2', students: '7', first_paper: '85.7', last_paper: '64.3' }]),
    )
    expect(rows[0].deltaPoints).toBeLessThan(0)
  })

  it('keeps the raw subject for the caller to canonicalise', async () => {
    // Cleaning it in SQL would encode the same rules twice, in two languages.
    const rows = await loadSubjectImprovement(dbWith([{ subject: 'Mathematics-S1-SB', students: '7' }]))
    expect(rows[0].subject).toBe('Mathematics-S1-SB')
  })

  it('needs two papers in the subject before comparing anything', async () => {
    const db = dbWith([])
    await loadSubjectImprovement(db)
    expect(sqlOf(db)).toContain('total >= 2')
  })
})

describe('loadMasteryMix', () => {
  it('bands at the same thresholds the learner-facing gap map uses', async () => {
    const m = await loadMasteryMix(dbWith([{ gap: '150', developing: '51', mastered: '104' }]))
    expect(m).toEqual({ gap: 150, developing: 51, mastered: 104, total: 305, masteredShare: 34.1 })
  })

  it('counts only subtopics that have actually been attempted', async () => {
    // An unattempted subtopic is not a gap, it is an unknown, and counting it
    // as either would misstate the picture.
    const db = dbWith([{}])
    await loadMasteryMix(db)
    expect(sqlOf(db)).toContain('attempts > 0')
  })

  it('survives a platform where nothing has been measured yet', async () => {
    const m = await loadMasteryMix(dbWith([]))
    expect(m.total).toBe(0)
    expect(m.masteredShare).toBe(0)
  })
})
