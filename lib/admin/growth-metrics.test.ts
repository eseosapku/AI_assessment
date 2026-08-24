import { describe, it, expect, vi } from 'vitest'
import {
  loadFunnel,
  loadRetentionCohorts,
  loadAssignmentHealth,
  loadTutorEngagement,
  loadCurriculumMix,
  loadRecallHealth,
  loadCollectionPoints,
} from './growth-metrics'
import type { Database } from '@/lib/db'

const dbWith = (rows: Record<string, unknown>[]): Database =>
  ({ query: vi.fn().mockResolvedValue({ rows }) }) as unknown as Database

const sqlOf = (db: Database): string => (db.query as ReturnType<typeof vi.fn>).mock.calls[0][0] as string

describe('loadFunnel', () => {
  it('measures each stage against the one above, not against the total', async () => {
    // Against the total, every late stage looks equally bad and the step that
    // actually loses people is invisible.
    const stages = await loadFunnel(
      dbWith([{ registered: '844', activated: '428', returned: '253', habitual: '55' }]),
    )
    expect(stages.map((s) => s.ofPrevious)).toEqual([100, 50.7, 59.1, 21.7])
  })

  it('names what reaching each stage actually means', async () => {
    const stages = await loadFunnel(dbWith([{}]))
    for (const s of stages) expect(s.meaning.length, s.label).toBeGreaterThan(5)
  })

  it('survives an empty platform without dividing by zero', async () => {
    const stages = await loadFunnel(dbWith([]))
    expect(stages.every((s) => s.count === 0)).toBe(true)
    expect(stages[1].ofPrevious).toBe(0)
  })

  it('counts students only, since teachers never sit papers', async () => {
    const db = dbWith([{}])
    await loadFunnel(db)
    expect(sqlOf(db)).toContain("u.role = 'student'")
  })
})

describe('loadRetentionCohorts', () => {
  it('flags cohorts too young to judge instead of dropping them', async () => {
    // A student who joined three weeks ago has had far less chance to return;
    // reading their rate as a decline is the standard misreading.
    const rows = await loadRetentionCohorts(
      dbWith([
        { cohort: '2026-05', students: '278', returned: '184', immature: false },
        { cohort: '2026-08', students: '3', returned: '1', immature: true },
      ]),
    )
    expect(rows[0].mature).toBe(true)
    expect(rows[1].mature).toBe(false)
    expect(rows[0].returnRate).toBe(66.2)
  })

  it('passes the window as a bound parameter', async () => {
    const db = dbWith([])
    await loadRetentionCohorts(db, 6)
    expect((db.query as ReturnType<typeof vi.fn>).mock.calls[0][1]).toEqual(['6'])
  })
})

describe('loadAssignmentHealth', () => {
  it('separates never opened from opened and abandoned', async () => {
    // Those are different failures: one is a delivery problem, the other is a
    // difficulty or motivation problem.
    const a = await loadAssignmentHealth(
      dbWith([{ set: '2123', completed: '422', started: '219', never_opened: '1482', teachers: '12', median_hours: '10.07' }]),
    )
    expect(a).toMatchObject({ set: 2123, completed: 422, started: 219, neverOpened: 1482 })
    expect(a.completionRate).toBe(19.9)
    expect(a.medianHoursToComplete).toBe(10.1)
  })

  it('qualifies the status column, which both joined tables define', async () => {
    const db = dbWith([{}])
    await loadAssignmentHealth(db)
    expect(sqlOf(db)).toContain('ar.status')
  })

  it('reports no median rather than zero when nothing has been handed in', async () => {
    const a = await loadAssignmentHealth(dbWith([{ set: '10', completed: '0', median_hours: null }]))
    expect(a.medianHoursToComplete).toBeNull()
    expect(a.completionRate).toBe(0)
  })
})

describe('loadTutorEngagement', () => {
  it('quotes the median, which a few very long sessions cannot distort', async () => {
    const t = await loadTutorEngagement(
      dbWith([{ lessons: '65', lessons_with_chat: '62', messages: '1181', median_messages: '7' }]),
    )
    expect(t.medianMessagesPerLesson).toBe(7)
    expect(t.conversationRate).toBe(95.4)
  })

  it('handles a platform with no lessons yet', async () => {
    const t = await loadTutorEngagement(dbWith([{}]))
    expect(t.conversationRate).toBe(0)
  })
})

describe('loadCurriculumMix', () => {
  it('turns the stored numeric code into the name people use', async () => {
    const rows = await loadCurriculumMix(dbWith([{ curriculum: 0, assessments: '115', papers: '63', avg_score: '44.15' }]))
    expect(rows[0].papers).toBe(63)
    expect(rows[0].avgScore).toBe(44)
    expect(rows[0].curriculum).not.toBe('0')
  })

  it('reports no average rather than zero for a curriculum nobody has sat', async () => {
    // JAMB has assessments built and none taken; a 0% average would read as
    // every student failing.
    const rows = await loadCurriculumMix(dbWith([{ curriculum: 4, assessments: '4', papers: '0', avg_score: null }]))
    expect(rows[0].avgScore).toBeNull()
  })
})

describe('loadRecallHealth', () => {
  it('reports how many cards were ever actually reviewed', async () => {
    const r = await loadRecallHealth(
      dbWith([{ cards: '398', decks: '83', students: '4', reviewed: '19', due_now: '397' }]),
    )
    expect(r.reviewRate).toBe(4.8)
    expect(r.dueNow).toBe(397)
  })

  it('does not divide by zero before any card exists', async () => {
    expect((await loadRecallHealth(dbWith([{}]))).reviewRate).toBe(0)
  })
})

describe('loadCollectionPoints', () => {
  it('calls a table nothing writes to silent, not zero', async () => {
    // Zero would read as "this is not happening"; silent says "we are not
    // watching", which is a different and fixable problem.
    const points = await loadCollectionPoints(
      dbWith([{ assessments: '1923', tagged: '178', usage_events: '0', question_reports: '0', jobs: '13', jobs_failed: '10', results: '1681', sessions: '2' }]),
    )
    expect(points.find((p) => p.key === 'cost')?.state).toBe('silent')
    expect(points.find((p) => p.key === 'quality')?.state).toBe('silent')
  })

  it('calls partial coverage partial rather than working', async () => {
    const points = await loadCollectionPoints(
      dbWith([{ assessments: '1923', tagged: '178', usage_events: '0', question_reports: '0', jobs: '13', jobs_failed: '10', results: '1681', sessions: '2' }]),
    )
    expect(points.find((p) => p.key === 'tagging')?.state).toBe('partial')
  })

  it('says why each missing measurement is worth having', async () => {
    const points = await loadCollectionPoints(dbWith([{}]))
    for (const p of points) expect(p.worth.length, p.key).toBeGreaterThan(20)
  })

  it('survives a database where none of these tables have rows', async () => {
    const points = await loadCollectionPoints(dbWith([{}]))
    expect(points.every((p) => p.state === 'silent')).toBe(true)
  })
})
