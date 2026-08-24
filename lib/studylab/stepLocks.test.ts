// lib/studylab/stepLocks.test.ts
import { describe, it, expect, vi } from 'vitest'
import { applyLocks } from './stepLocks'
import { GAP_THRESHOLD } from '@/lib/admin/gap-metrics'
import type { Database } from '@/lib/db'
import type { LessonStep } from './lessonRun'

const dbWith = (rows: Record<string, unknown>[]): Database =>
  ({ query: vi.fn().mockResolvedValue({ rows }) }) as unknown as Database

const step = (id: string, subtopicId?: number): LessonStep => ({
  id, title: `Step ${id}`, goal: 'g', status: 'pending', cardIds: [], subtopicId,
})

describe('applyLocks', () => {
  it('locks a step whose subtopic was measured below the line', () => {
    return expect(
      applyLocks([step('a', 7)], 'u1', dbWith([{ subtopic_id: 7, accuracy: 38 }])),
    ).resolves.toMatchObject([{ lockedBy: { subtopicId: 7, accuracy: 38 } }])
  })

  it('leaves a step measured at or above the line alone', async () => {
    const [s] = await applyLocks([step('a', 7)], 'u1', dbWith([{ subtopic_id: 7, accuracy: 82 }]))
    expect(s.lockedBy).toBeUndefined()
  })

  it('uses the same threshold as the learner-facing gap map', async () => {
    // A second copy of 50 would drift, and the dashboard and the student would
    // describe the same subtopic in contradictory terms.
    const [s] = await applyLocks(
      [step('a', 7)], 'u1', dbWith([{ subtopic_id: 7, accuracy: GAP_THRESHOLD }]),
    )
    expect(s.lockedBy).toBeUndefined()
  })

  it('leaves a step with no subtopic unlocked', async () => {
    // Every scratch lesson is in this case: 47 of them, none with a subtopic.
    const [s] = await applyLocks([step('a')], 'u1', dbWith([{ subtopic_id: 7, accuracy: 10 }]))
    expect(s.lockedBy).toBeUndefined()
  })

  it('leaves a subtopic with no measurement unlocked', async () => {
    // Absence of evidence is not evidence of a gap.
    const [s] = await applyLocks([step('a', 9)], 'u1', dbWith([]))
    expect(s.lockedBy).toBeUndefined()
  })

  it('does not query at all when no step names a subtopic', async () => {
    const db = dbWith([])
    await applyLocks([step('a'), step('b')], 'u1', db)
    expect(db.query).not.toHaveBeenCalled()
  })

  it('returns the steps unlocked when the query fails', async () => {
    // A lesson that will not start because a lock query failed is worse than a
    // lesson that starts without locks.
    const broken = { query: vi.fn().mockRejectedValue(new Error('down')) } as unknown as Database
    const [s] = await applyLocks([step('a', 7)], 'u1', broken)
    expect(s.lockedBy).toBeUndefined()
  })
})
