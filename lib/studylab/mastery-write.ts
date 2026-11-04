import type { Database } from '@/lib/db'
import { masteryNumber } from './mastery-numbers'
import { nextLatest } from './mastery-latest'

/**
 * Incrementally upserts one mastery bucket (a chapter-level or section-level
 * row): the running average as always, then the latest-attempt columns.
 */
export async function writeMasteryBucket(
  database: Database,
  userId: string,
  textbookId: number,
  topicId: number,
  subtopicId: number,
  addCorrect: number,
  addTotal: number,
  nowIso: string,
): Promise<void> {
  if (addTotal <= 0) return
  // SELECT * so this still works before the latest-attempt columns exist.
  const existingResult = await database.query(
    `SELECT * FROM topic_mastery
     WHERE user_id = $1 AND textbook_id = $2 AND topic_id = $3 AND subtopic_id = $4 LIMIT 1`,
    [userId, textbookId, topicId, subtopicId],
  )
  const existing = existingResult.rows[0] as Record<string, unknown> | undefined

  const attempts = Number(existing?.attempts ?? 0) + addTotal
  const correct = Number(existing?.correct ?? 0) + Math.round(addCorrect)
  const accuracy = attempts > 0 ? Math.round((correct / attempts) * 10000) / 100 : 0

  await database.query(
    `INSERT INTO topic_mastery (user_id, textbook_id, topic_id, subtopic_id, attempts, correct, accuracy, last_assessed, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (user_id, textbook_id, topic_id, subtopic_id) DO UPDATE SET
       attempts = EXCLUDED.attempts,
       correct = EXCLUDED.correct,
       accuracy = EXCLUDED.accuracy,
       last_assessed = EXCLUDED.last_assessed,
       updated_at = EXCLUDED.updated_at`,
    [userId, textbookId, topicId, subtopicId, attempts, correct, accuracy, nowIso, nowIso],
  )

  // Separate statement in its own try/catch on purpose: a deploy that lands
  // before the migration must not lose a student's score. If the new columns
  // are missing, the average above is already saved and we only warn.
  try {
    const latest = nextLatest(existing, masteryNumber(existing?.accuracy), addCorrect, addTotal)
    await database.query(
      `UPDATE topic_mastery
          SET last_accuracy = $5, lowest_accuracy = $6, pending_correct = $7, pending_total = $8
        WHERE user_id = $1 AND textbook_id = $2 AND topic_id = $3 AND subtopic_id = $4`,
      [userId, textbookId, topicId, subtopicId, latest.last_accuracy, latest.lowest_accuracy, latest.pending_correct, latest.pending_total],
    )
  } catch (err) {
    console.warn('Latest-score columns not written:', (err as Error)?.message ?? err)
  }
}
