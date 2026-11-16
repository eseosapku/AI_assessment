import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isMissingColumn, pgErrorMessage } from '@/lib/pg-errors'
import { jsonbParam } from '@/lib/pg-json'

import { writeMasteryBucket, scoreQuestions, legacyBuckets } from '@/lib/studylab/mastery-write'
import { isExamPrepCurriculumNumeric } from '@/lib/curriculum-registry'

type ResultRow = {
  id: string
  status: string | null
  attempt_count: number | null
  result_id: string | null
  completed_at: string | null
  started_at: string | null
  last_attempt_at: string | null
  student_id: string | null
  student_email: string | null
}

function statusWeight(status: string | null) {
  if (status === 'completed') return 3
  if (status === 'started') return 2
  if (status === 'pending') return 1
  return 0
}

function mostRecentTimestamp(row: ResultRow) {
  return row.last_attempt_at || row.completed_at || row.started_at || null
}

function pickBestResult(rows: ResultRow[]) {
  if (!rows || rows.length === 0) return null
  return rows.reduce<ResultRow | null>((best, current) => {
    if (!best) return current
    const weightDiff = statusWeight(current.status) - statusWeight(best.status)
    if (weightDiff !== 0) return weightDiff > 0 ? current : best

    const currentTs = mostRecentTimestamp(current)
    const bestTs = mostRecentTimestamp(best)
    if (!currentTs && !bestTs) return best
    if (!bestTs) return current
    if (!currentTs) return best
    return new Date(currentTs) > new Date(bestTs) ? current : best
  }, null)
}

function isSchemaColumnMissing(error: unknown) {
  return isMissingColumn(error)
}

// Incrementally upsert one mastery bucket (see lib/studylab/mastery-write.ts).
function upsertMasteryBucket(
  userId: string,
  textbookId: number,
  topicId: number,
  subtopicId: number,
  addCorrect: number,
  addTotal: number,
  nowIso: string
) {
  return writeMasteryBucket(db, userId, textbookId, topicId, subtopicId, addCorrect, addTotal, nowIso)
}

// Update per-subtopic mastery for the StudyLab Learning Gap Map. When questions
// carry a `subtopic_id` (tagged at generation time), we score each question
// individually and credit the exact subtopic — so mastery reflects real, per
// question performance and cascades accurately up the tree. If question-level
// data isn't available (legacy results) we fall back to the old assessment-level
// estimate. Best-effort and non-fatal.
async function updateTopicMastery(params: {
  userId: string
  assessmentId: string | null
  score: number
  totalQuestions: number
  answers?: any
  questionsData?: any
  longformGrades?: any
}) {
  const { userId, assessmentId, score, totalQuestions, answers, questionsData, longformGrades } = params
  if (!userId || !assessmentId) return

  try {
    const assessmentResult = await db.query(
      'SELECT textbook_id, topic_ids, subtopic_ids FROM assessments WHERE id = $1 LIMIT 1',
      [assessmentId]
    )
    const assessment = assessmentResult.rows[0]

    if (!assessment) return

    const textbookId = Number((assessment as any).textbook_id) || 0
    if (textbookId > 0) {
      const tbResult = await db.query(
        'SELECT curriculum FROM textbooks WHERE textbook_id = $1 LIMIT 1',
        [textbookId]
      )
      const tb = tbResult.rows[0]
      if (isExamPrepCurriculumNumeric(tb?.curriculum)) return
    }

    const nowIso = new Date().toISOString()

    // ── Precise path: score each tagged question and bucket per subtopic. ──────
    const { sections: subBuckets, chapters: topicBuckets, scoredAny } = scoreQuestions(questionsData, answers, longformGrades)

    if (scoredAny && (subBuckets.size > 0 || topicBuckets.size > 0)) {
      const tasks: Promise<void>[] = []
      for (const [sid, b] of subBuckets) tasks.push(upsertMasteryBucket(userId, textbookId, 0, sid, b.correct, b.total, nowIso))
      for (const [tid, b] of topicBuckets) tasks.push(upsertMasteryBucket(userId, textbookId, tid, 0, b.correct, b.total, nowIso))
      await Promise.all(tasks)
      return
    }

    // ── Fallback: legacy assessment-level estimate (no tagged questions). ──────
    for (const b of legacyBuckets(assessment, score, totalQuestions)) {
      await upsertMasteryBucket(userId, textbookId, b.topic_id, b.subtopic_id, b.correct, b.total, nowIso)
    }
  } catch (err) {
    console.error('Topic mastery update skipped:', err)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { user_id, score, grade, feedback } = body
    const isAssignment = Boolean(body?.assignment_id)
    const assessmentId = isAssignment ? null : body.assessment_id || null

    if (!user_id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    const payload = {
      user_id,
      assessment_id: assessmentId,
      answers: body.answers || {},
      score,
      total_questions: body.total_questions || 10,
      percentage: score,
      feedback: { text: feedback },
      grade: grade ?? null,
      time_taken: body.time_taken ?? null,
      questions_data: body.questions_data ?? null,
      longform_grades: body.longform_grades ?? null,
      submission_reason: body.submission_reason ?? 'manual',
      violation_count: body.violation_count ?? 0,
    }

    let resultId: string | null = null
    let insertError: unknown = null

    try {
      const insertResult = await db.query(
        `INSERT INTO results (
           user_id, assessment_id, answers, score, total_questions, percentage, feedback, grade,
           time_taken, questions_data, longform_grades, submission_reason, violation_count
         ) VALUES ($1,$2,$3::jsonb,$4,$5,$6,$7::jsonb,$8,$9,$10::jsonb,$11::jsonb,$12,$13)
         RETURNING id`,
        [
          payload.user_id,
          payload.assessment_id,
          jsonbParam(payload.answers),
          payload.score,
          payload.total_questions,
          payload.percentage,
          jsonbParam(payload.feedback),
          payload.grade,
          payload.time_taken,
          jsonbParam(payload.questions_data),
          jsonbParam(payload.longform_grades),
          payload.submission_reason,
          payload.violation_count,
        ]
      )
      resultId = insertResult.rows[0]?.id ?? null
    } catch (err) {
      insertError = err
      if (isSchemaColumnMissing(err)) {
        try {
          const retryResult = await db.query(
            `INSERT INTO results (user_id, assessment_id, answers, score, total_questions, percentage, feedback, submission_reason, violation_count)
             VALUES ($1,$2,$3::jsonb,$4,$5,$6,$7::jsonb,$8,$9)
             RETURNING id`,
            [
              payload.user_id,
              payload.assessment_id,
              jsonbParam(payload.answers),
              payload.score,
              payload.total_questions,
              payload.percentage,
              jsonbParam(payload.feedback),
              payload.submission_reason,
              payload.violation_count,
            ]
          )
          resultId = retryResult.rows[0]?.id ?? resultId
          insertError = null
        } catch (retryErr) {
          insertError = retryErr
        }
      }
    }

    if (insertError) {
      console.error('Results insert error:', insertError)
      throw insertError
    }

    // Update per-subtopic mastery (best-effort, non-fatal).
    await updateTopicMastery({
      userId: user_id,
      assessmentId,
      score: Number(score),
      totalQuestions: Number(body.total_questions || 0),
      answers: body.answers,
      questionsData: body.questions_data,
      longformGrades: body.longform_grades,
    })

    if (body?.assignment_id) {
      const assignmentId = String(body.assignment_id).trim()
      const studentEmail = body?.student_email ? String(body.student_email).trim().toLowerCase() : null
      let bestResultId = resultId
      let attemptCount = 1

      let lookupSql = `
        SELECT id, attempt_count, result_id, status, started_at, completed_at, last_attempt_at, student_id, student_email
        FROM assignment_results WHERE assignment_id = $1
      `
      const lookupValues: unknown[] = [assignmentId]
      let idx = 2

      if (user_id && studentEmail) {
        lookupSql += ` AND (student_id = $${idx++} OR student_email = $${idx++})`
        lookupValues.push(user_id, studentEmail)
      } else if (user_id) {
        lookupSql += ` AND student_id = $${idx++}`
        lookupValues.push(user_id)
      } else if (studentEmail) {
        lookupSql += ` AND student_email = $${idx++}`
        lookupValues.push(studentEmail)
      }

      const existingRowsResult = await db.query(lookupSql, lookupValues)
      const existingRows = existingRowsResult.rows

      const existingRow = pickBestResult((existingRows ?? []) as ResultRow[])

      if (user_id && studentEmail) {
        await db.query(
          `UPDATE assignment_results SET student_id = $1
           WHERE assignment_id = $2 AND student_email = $3 AND student_id IS NULL`,
          [user_id, assignmentId, studentEmail]
        )
      }

      if (existingRow) {
        attemptCount = Number(existingRow.attempt_count ?? 0) + 1
        if (existingRow.result_id) {
          try {
            const bestResult = await db.query(
              'SELECT percentage, score FROM results WHERE id = $1 LIMIT 1',
              [existingRow.result_id]
            )
            const bestRow = bestResult.rows[0]
            const bestScore = Number(bestRow?.percentage ?? bestRow?.score)
            const currentScore = Number(score)
            if (Number.isFinite(bestScore) && Number.isFinite(currentScore) && currentScore < bestScore) {
              bestResultId = existingRow.result_id
            }
          } catch (bestError) {
            console.error('Best result lookup error:', bestError)
          }
        }
      }

      try {
        const assignmentResult = await db.query(
          'SELECT max_attempts FROM assignments WHERE id = $1 LIMIT 1',
          [assignmentId]
        )
        const assignmentRow = assignmentResult.rows[0]
        const maxAttempts = Number(assignmentRow?.max_attempts ?? 1)
        if (Number.isFinite(maxAttempts) && maxAttempts > 0 && attemptCount > maxAttempts) {
          attemptCount = maxAttempts
        }
      } catch (assignmentError) {
        console.error('Assignment lookup error:', assignmentError)
      }

      const updatePayload: Record<string, any> = {
        status: 'completed',
        completed_at: new Date().toISOString(),
        result_id: bestResultId,
        attempt_count: attemptCount,
        last_attempt_at: new Date().toISOString(),
      }
      if (assessmentId) {
        updatePayload.assessment_id = assessmentId
      }

      if (existingRow?.id) {
        try {
          await db.query(
            `UPDATE assignment_results
             SET status = $1, completed_at = $2, result_id = $3, attempt_count = $4, last_attempt_at = $5, assessment_id = $6
             WHERE id = $7`,
            ['completed', updatePayload.completed_at, bestResultId, attemptCount, updatePayload.last_attempt_at, assessmentId, existingRow.id]
          )
        } catch (updateError) {
          console.error('Assignment result update error:', updateError)
        }
      } else {
        try {
          await db.query(
            `INSERT INTO assignment_results (
               assignment_id, student_id, student_email, status, completed_at, result_id, assessment_id, attempt_count, last_attempt_at
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
            [
              assignmentId,
              user_id ?? null,
              studentEmail,
              'completed',
              updatePayload.completed_at,
              bestResultId,
              assessmentId,
              attemptCount,
              updatePayload.last_attempt_at,
            ]
          )
        } catch (insertError) {
          console.error('Assignment result insert error:', insertError)
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Assessment result saved successfully',
      result_id: resultId,
    })

  } catch (error) {
    console.error('Error saving result:', error)
    return NextResponse.json(
      { error: 'Failed to save assessment result' },
      { status: 500 }
    )
  }
}
