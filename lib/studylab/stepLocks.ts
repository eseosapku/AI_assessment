// lib/studylab/stepLocks.ts
import { db as defaultDb, type Database } from '@/lib/db'
import { GAP_THRESHOLD } from '@/lib/admin/gap-metrics'
import type { LessonStep } from './lessonRun'

/**
 * Marks the steps a measurement says the learner is weak on.
 *
 * `lockedBy` is always computed and never conditionally set — what it *does* is
 * the policy's decision. Keeping the record either way costs nothing and lets
 * an open lesson tell the learner what the measurement said without turning it
 * into a gate.
 *
 * The threshold is imported rather than repeated. A second copy of 50 would
 * drift, and the dashboard and the learner's own gap map would end up
 * describing the same subtopic in contradictory terms.
 */
export async function applyLocks(
  steps: LessonStep[],
  userId: string,
  database: Database = defaultDb,
): Promise<LessonStep[]> {
  const subtopicIds = [...new Set(steps.map((s) => s.subtopicId).filter((id): id is number => !!id))]
  if (subtopicIds.length === 0 || !userId) return steps

  try {
    const { rows } = await database.query(
      `SELECT subtopic_id, accuracy
         FROM topic_mastery
        WHERE user_id = $1
          AND subtopic_id = ANY($2::int[])
          AND attempts > 0
          AND accuracy IS NOT NULL`,
      [userId, subtopicIds],
    )

    const measured = new Map<number, number>()
    for (const r of rows as Record<string, unknown>[]) {
      measured.set(Number(r.subtopic_id), Number(r.accuracy))
    }

    return steps.map((step) => {
      if (!step.subtopicId) return step
      const accuracy = measured.get(step.subtopicId)
      if (accuracy === undefined || accuracy >= GAP_THRESHOLD) return step
      return { ...step, lockedBy: { subtopicId: step.subtopicId, accuracy: Math.round(accuracy) } }
    })
  } catch (error) {
    // A lesson that will not start because a lock query failed is a worse
    // outcome than a lesson that starts without locks.
    console.error('Step locking failed:', (error as Error)?.message ?? error)
    return steps
  }
}

/**
 * Carries a measured gap through a re-draft of the plan.
 *
 * A gap lesson exists because something said the learner was weak on one
 * subtopic. The plan card lets them reshape it — "make it shorter", "I know
 * the basics" — and on a real lesson opened at 29% on "What is Classification",
 * pressing "I know the basics" came back with a plan that did not mention that
 * subtopic at all. The lesson carried on under a title about the gap, covering
 * everything except it.
 *
 * So the reshaping is honoured and the gap is put back: they get the shorter or
 * deeper plan they asked for, plus the step they were measured weak on, first,
 * because it is the reason the lesson exists. Kept by subtopic rather than by
 * asking the model to comply, which it cannot be relied on to do.
 *
 * Ids are renumbered across the result. Nothing has been taught yet — this only
 * ever runs while the plan is still being agreed — so no progress refers to them.
 */
export function keepMeasuredSteps(previous: LessonStep[], drafted: LessonStep[]): LessonStep[] {
  const covered = new Set(drafted.map((s) => s.subtopicId).filter(Boolean))
  const missing = previous.filter((s) => s.lockedBy && !covered.has(s.subtopicId))
  if (missing.length === 0) return drafted

  return [...missing, ...drafted].map((step, i) => ({
    ...step,
    id: `s${i + 1}`,
    status: 'pending' as const,
    cardIds: [],
    checkpointId: undefined,
  }))
}
