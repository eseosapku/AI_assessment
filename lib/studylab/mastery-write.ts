import type { Database } from '@/lib/db'
import { masteryNumber } from './mastery-numbers'
import { nextLatest } from './mastery-latest'
import { gradeInteractiveQuestion } from '@/lib/grade-interactive'
import { normalizeInteractiveQuestion } from '@/lib/interactive-assessment-plan'

type Bucket = { correct: number; total: number }

/**
 * Scores each tagged question and buckets it per section (`sections`) or, for
 * questions with only a chapter tag, per chapter (`chapters`).
 */
export function scoreQuestions(
  questionsData: unknown,
  answers: unknown,
  longformGrades: unknown,
): { sections: Map<number, Bucket>; chapters: Map<number, Bucket>; scoredAny: boolean } {
  const questions: any[] = Array.isArray(questionsData) ? questionsData : []
  const a: any = answers
  const mcqAnswers = (a && typeof a === 'object' && a.mcq) ? a.mcq : (a ?? {})
  const interactiveAnswers = (a && typeof a === 'object' && a.interactive) ? a.interactive : {}
  const lfGrades: any = longformGrades ?? {}
  const sections = new Map<number, Bucket>()
  const chapters = new Map<number, Bucket>()
  let scoredAny = false

  questions.forEach((q: any, idx: number) => {
    const sid = Number(q?.subtopic_id) || 0
    const tid = Number(q?.topic_id) || 0
    if (sid <= 0 && tid <= 0) return

    let frac: number | null = null
    if (q?.type === 'longform') {
      const g = lfGrades?.[idx] ?? lfGrades?.[String(idx)]
      const totalMarks = Number(g?.marks_total)
      if (g && Number.isFinite(totalMarks) && totalMarks > 0) {
        frac = Math.max(0, Math.min(1, Number(g.marks_awarded ?? 0) / totalMarks))
      }
    } else if (q?.type === 'interactive') {
      const normalized = normalizeInteractiveQuestion(q)
      if (normalized) {
        const ans = interactiveAnswers?.[idx] ?? interactiveAnswers?.[String(idx)]
        const grade = gradeInteractiveQuestion(normalized, ans)
        if (grade.marks_total > 0) {
          frac = Math.max(0, Math.min(1, grade.marks_awarded / grade.marks_total))
        }
      }
    } else if (q?.type === 'mcq' || Array.isArray(q?.options)) {
      const ua = mcqAnswers?.[idx] ?? mcqAnswers?.[String(idx)]
      frac = ua !== undefined && ua !== null && Number(ua) === Number(q?.correct_answer) ? 1 : 0
    } else {
      return
    }
    if (frac === null) return // ungraded long-form: skip rather than misattribute

    scoredAny = true
    const bucket = sid > 0 ? sections : chapters
    const key = sid > 0 ? sid : tid
    const b = bucket.get(key) ?? { correct: 0, total: 0 }
    b.correct += frac
    b.total += 1
    bucket.set(key, b)
  })

  return { sections, chapters, scoredAny }
}

/**
 * The legacy fallback for a quiz with no tagged questions: spreads the whole
 * assessment's score evenly over the sections it covered (or the chapters when
 * it named no sections). Moved unchanged out of the save-result route.
 */
export function legacyBuckets(
  assessment: unknown,
  score: unknown,
  totalQuestions: unknown,
): Array<{ topic_id: number; subtopic_id: number; correct: number; total: number }> {
  const topicIds: number[] = Array.isArray((assessment as any)?.topic_ids) ? (assessment as any).topic_ids.map(Number).filter(Number.isFinite) : []
  const subtopicIds: number[] = Array.isArray((assessment as any)?.subtopic_ids) ? (assessment as any).subtopic_ids.map(Number).filter(Number.isFinite) : []
  const keys: Array<{ topic_id: number; subtopic_id: number }> = []
  if (subtopicIds.length > 0) subtopicIds.forEach((sid) => keys.push({ topic_id: 0, subtopic_id: sid }))
  else if (topicIds.length > 0) topicIds.forEach((tid) => keys.push({ topic_id: tid, subtopic_id: 0 }))
  if (keys.length === 0) return []

  const pct = Number.isFinite(score) ? Math.max(0, Math.min(100, Number(score))) : 0
  const total = Number.isFinite(totalQuestions) && Number(totalQuestions) > 0 ? Number(totalQuestions) : 0
  if (total === 0) return []
  const correctCount = Math.round((pct / 100) * total)
  return keys.map((key) => ({ ...key, correct: correctCount / keys.length, total: total / keys.length }))
}

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
