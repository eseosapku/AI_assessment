import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const query = vi.fn()
vi.mock('@/lib/db', () => ({ db: { query: (...a: unknown[]) => query(...a) } }))
const artPathFor = vi.fn((_id: number) => null as string | null)
vi.mock('@/lib/studylab/gap-art', () => ({ artPathFor: (id: number) => artPathFor(id) }))

import { GET } from './route'

const USER = '11111111-1111-4111-8111-111111111111'

function route(mastery: Record<string, unknown>[]) {
  query.mockImplementation(async (sql: string) => {
    if (/assessment_id IS NULL/.test(sql)) return { rows: [] }
    if (/FROM results/.test(sql)) return { rows: [{ assessment_id: 'a1', percentage: 65, score: 6, total_questions: 10, created_at: '2026-11-01T10:00:00Z' }] }
    if (/FROM assessments/.test(sql)) return { rows: [{ id: 'a1', subject: 'Mathematics', difficulty: 'medium', textbook_id: 1, topic_ids: [4], subtopic_ids: [7] }] }
    if (/FROM textbooks/.test(sql)) return { rows: [{ textbook_id: 1, textbook_name: 'Mathematics', curriculum: 1 }] }
    if (/FROM topic_mastery/.test(sql)) return { rows: mastery.map((m) => ({ textbook_id: 1, ...m })) }
    if (/FROM topics/.test(sql)) return { rows: [{ topic_id: 4, topic: 'Algebra', textbook_id: 1 }, { topic_id: 5, topic: 'Geometry', textbook_id: 1 }] }
    if (/FROM subtopics/.test(sql)) return { rows: [
      { subtopic_id: 7, subtopic: 'Factorising', topic_id: 4 },
      { subtopic_id: 8, subtopic: 'Simultaneous equations', topic_id: 4 },
    ] }
    return { rows: [] }
  })
  return GET(new NextRequest(`http://localhost/api/studylab/gap-map?user_id=${USER}`)).then((r) => r.json())
}
const topic = (body: any, id: number) => body.data.textbooks[0].topics.find((t: any) => t.id === id)
const section = (body: any, id: number) => topic(body, 4).subtopics.find((s: any) => s.id === id)

beforeEach(() => { query.mockReset(); artPathFor.mockReset(); artPathFor.mockReturnValue(null) })

describe('gap map route', () => {
  it('orders chapters and sections by id, not name', async () => {
    await route([])
    const sqls = query.mock.calls.map((c) => String(c[0]))
    expect(sqls.find((s) => /FROM topics/.test(s))).toContain('ORDER BY topic_id')
    expect(sqls.find((s) => /FROM subtopics/.test(s))).toContain('ORDER BY subtopic_id')
  })

  it('reads a section from its latest score', async () => {
    const body = await route([{ topic_id: 0, subtopic_id: 7, attempts: 13, correct: 8, accuracy: '65', last_accuracy: '100', lowest_accuracy: '30', last_assessed: '2026-11-01' }])
    expect(section(body, 7)).toMatchObject({ score: 100, lowest: 30, accuracy: 65, status: 'developing' })
  })

  it('still works before the migration', async () => {
    const body = await route([{ topic_id: 0, subtopic_id: 7, attempts: 10, correct: 6, accuracy: '65', last_assessed: '2026-11-01' }])
    expect(section(body, 7)).toMatchObject({ score: 65, lowest: 65 })
  })

  it('keeps a whole-chapter score even when the chapter has sections', async () => {
    const body = await route([{ topic_id: 4, subtopic_id: 0, attempts: 10, correct: 4, accuracy: '40', last_assessed: '2026-11-01' }])
    expect(topic(body, 4)).toMatchObject({ score: 40 })
  })

  it('gives an untried section null scores', async () => {
    const body = await route([])
    expect(section(body, 8)).toMatchObject({ score: null, lowest: null })
    expect(topic(body, 5)).toMatchObject({ score: null, lowest: null })
  })

  it('keeps the old fields', async () => {
    const body = await route([{ topic_id: 0, subtopic_id: 7, attempts: 10, correct: 6, accuracy: '65', last_assessed: '2026-11-01' }])
    expect(body.data.summary).toHaveProperty('overall_mastery')
    expect(topic(body, 4)).toHaveProperty('topic_level_only')
    expect(body.data.textbooks[0].assessments).toHaveLength(1)
  })

  it('gives a chapter its picture', async () => {
    artPathFor.mockImplementation((id) => (id === 4 ? '/gap-art/x.v1.svg' : null))
    const body = await route([])
    expect(topic(body, 4).art).toBe('/gap-art/x.v1.svg')
    expect(topic(body, 5).art).toBeNull()
  })
})
