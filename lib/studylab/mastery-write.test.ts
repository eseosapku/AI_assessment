import { describe, it, expect, vi } from 'vitest'
import type { Database } from '@/lib/db'
import { writeMasteryBucket, scoreQuestions, legacyBuckets } from './mastery-write'

function fakeDb(existing: Record<string, unknown> | null, updateError?: Error) {
  const query = vi.fn(async (sql: string, _params?: unknown[]) => {
    if (/^\s*SELECT/i.test(sql)) return { rows: existing ? [existing] : [] }
    if (/^\s*UPDATE/i.test(sql) && updateError) throw updateError
    return { rows: [] }
  })
  return { db: { query } as unknown as Database, query }
}
const callWith = (query: ReturnType<typeof vi.fn>, re: RegExp) => query.mock.calls.find((c) => re.test(String(c[0])))

describe('writeMasteryBucket', () => {
  it('writes the average as today, then the latest columns', async () => {
    const { db, query } = fakeDb({ attempts: 10, correct: 3, accuracy: '30.00' })
    await writeMasteryBucket(db, 'u1', 1, 0, 7, 10, 10, '2026-11-04T00:00:00Z')
    const insert = callWith(query, /INSERT/i)!
    expect(insert[1]).toEqual(expect.arrayContaining([20, 13, 65]))
    const update = callWith(query, /^s*UPDATE/i)!
    expect(update[1]).toEqual(expect.arrayContaining([100, 30]))
  })

  it('keeps the score when the new columns are missing', async () => {
    const { db, query } = fakeDb({ attempts: 10, correct: 3, accuracy: '30.00' }, new Error('column "last_accuracy" does not exist'))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await expect(writeMasteryBucket(db, 'u1', 1, 0, 7, 10, 10, 'now')).resolves.toBeUndefined()
    expect(callWith(query, /INSERT/i)).toBeTruthy()
    warn.mockRestore()
  })

  it('does nothing for zero questions', async () => {
    const { db, query } = fakeDb(null)
    await writeMasteryBucket(db, 'u1', 1, 0, 7, 0, 0, 'now')
    expect(query).not.toHaveBeenCalled()
  })
})

// Characterisation: these describe what scoreQuestions did before this review, and must pass unchanged.
describe('scoreQuestions (characterisation)', () => {
  const mcq = (o: Record<string, unknown> = {}) => ({ type: 'mcq', options: ['a', 'b'], correct_answer: 1, subtopic_id: 7, topic_id: 4, ...o })
  const match = (o: Record<string, unknown> = {}) => ({
    type: 'interactive', kind: 'match', question: 'Match', left_items: ['a', 'b', 'c'], right_items: ['1', '2', '3'],
    correct_pairs: [[0, 0], [1, 1], [2, 2]], subtopic_id: 7, topic_id: 4, ...o,
  })

  it('credits a graded longform by marks awarded over marks total', () => {
    const r = scoreQuestions([{ type: 'longform', subtopic_id: 7, topic_id: 4 }], {}, { 0: { marks_awarded: 3, marks_total: 4 } })
    expect(r.sections.get(7)).toEqual({ correct: 0.75, total: 1 })
    expect(r.scoredAny).toBe(true)
  })
  it('skips an ungraded longform', () => {
    const r = scoreQuestions([{ type: 'longform', subtopic_id: 7, topic_id: 4 }], {}, {})
    expect(r.sections.size).toBe(0)
    expect(r.scoredAny).toBe(false)
  })
  it('grades interactive questions by the fraction of pairs right', () => {
    const r = scoreQuestions([match()], { interactive: { 0: { kind: 'match', pairs: [0, 2, 1] } } }, null)
    expect(r.sections.get(7)?.correct).toBeCloseTo(1 / 3)
    expect(r.sections.get(7)?.total).toBe(1)
  })
  it('puts a chapter-keyed question in the chapter bucket', () => {
    const r = scoreQuestions([mcq({ subtopic_id: undefined })], { 0: 1 }, null)
    expect(r.sections.size).toBe(0)
    expect(r.chapters.get(4)).toEqual({ correct: 1, total: 1 })
  })
  it('ignores a question with no tag at all', () => {
    const r = scoreQuestions([mcq({ subtopic_id: undefined, topic_id: undefined })], { 0: 1 }, null)
    expect(r.scoredAny).toBe(false)
  })
  it('reads answers in the flat shape and in the { mcq } shape, by number or string key', () => {
    expect(scoreQuestions([mcq()], { 0: 1 }, null).sections.get(7)).toEqual({ correct: 1, total: 1 })
    expect(scoreQuestions([mcq()], { mcq: { 0: 1 } }, null).sections.get(7)).toEqual({ correct: 1, total: 1 })
    expect(scoreQuestions([mcq()], { mcq: { '0': 0 } }, null).sections.get(7)).toEqual({ correct: 0, total: 1 })
  })
  it('counts an unanswered mcq as wrong', () => {
    expect(scoreQuestions([mcq()], {}, null).sections.get(7)).toEqual({ correct: 0, total: 1 })
  })
})

describe('legacyBuckets', () => {
  it('splits an assessment-level score evenly across its sections', () => {
    expect(legacyBuckets({ subtopic_ids: [7, 8], topic_ids: [4] }, 50, 10)).toEqual([
      { topic_id: 0, subtopic_id: 7, correct: 2.5, total: 5 },
      { topic_id: 0, subtopic_id: 8, correct: 2.5, total: 5 },
    ])
  })
  it('falls back to chapters when there are no sections', () => {
    expect(legacyBuckets({ topic_ids: [4] }, 80, 5)).toEqual([{ topic_id: 4, subtopic_id: 0, correct: 4, total: 5 }])
  })
  it('gives nothing without ids or without questions', () => {
    expect(legacyBuckets({}, 80, 5)).toEqual([])
    expect(legacyBuckets({ topic_ids: [4] }, 80, 0)).toEqual([])
  })
  it('clamps the score to 0-100 and treats a non-number as 0', () => {
    expect(legacyBuckets({ topic_ids: [4] }, 250, 4)[0]).toMatchObject({ correct: 4 })
    expect(legacyBuckets({ topic_ids: [4] }, Number.NaN, 4)[0]).toMatchObject({ correct: 0 })
  })
})
