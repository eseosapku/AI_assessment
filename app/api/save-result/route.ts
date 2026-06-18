import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
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

function isSchemaColumnMissing(error: any) {
  const message = String(error?.message ?? '')
  return error?.code === 'PGRST204' || /column .* does not exist/i.test(message) || /Could not find the .* column/i.test(message)
}

// Incrementally upsert one mastery bucket (a topic-level or subtopic-level row).
async function upsertMasteryBucket(
  userId: string,
  textbookId: number,
  topicId: number,
  subtopicId: number,
  addCorrect: number,
  addTotal: number,
  nowIso: string
) {
  if (addTotal <= 0) return
  const { data: existing } = await supabase
    .from('topic_mastery')
    .select('attempts,correct')
    .eq('user_id', userId)
    .eq('textbook_id', textbookId)
    .eq('topic_id', topicId)
    .eq('subtopic_id', subtopicId)
    .maybeSingle()

  const attempts = Number(existing?.attempts ?? 0) + addTotal
  const correct = Number(existing?.correct ?? 0) + Math.round(addCorrect)
  const accuracy = attempts > 0 ? Math.round((correct / attempts) * 10000) / 100 : 0

  await supabase.from('topic_mastery').upsert(
    {
      user_id: userId,
      textbook_id: textbookId,
      topic_id: topicId,
      subtopic_id: subtopicId,
      attempts,
      correct,
      accuracy,
      last_assessed: nowIso,
      updated_at: nowIso,
    },
    { onConflict: 'user_id,textbook_id,topic_id,subtopic_id' }
  )
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
    const { data: assessment, error: aErr } = await supabase
      .from('assessments')
      .select('textbook_id,topic_ids,subtopic_ids')
      .eq('id', assessmentId)
      .maybeSingle()

    if (aErr || !assessment) return

    const textbookId = Number((assessment as any).textbook_id) || 0
    if (textbookId > 0) {
      const { data: tb } = await supabase
        .from('textbooks')
        .select('curriculum')
        .eq('textbook_id', textbookId)
        .maybeSingle()
      if (isExamPrepCurriculumNumeric(tb?.curriculum)) return
    }

    const nowIso = new Date().toISOString()

    // ── Precise path: score each tagged question and bucket per subtopic. ──────
    const questions: any[] = Array.isArray(questionsData) ? questionsData : []
    const mcqAnswers = (answers && typeof answers === 'object' && answers.mcq) ? answers.mcq : (answers ?? {})
    const lfGrades = longformGrades ?? {}
    const subBuckets = new Map<number, { correct: number; total: number }>()
    const topicBuckets = new Map<number, { correct: number; total: number }>()
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
      } else {
        const ua = mcqAnswers?.[idx] ?? mcqAnswers?.[String(idx)]
        frac = ua !== undefined && ua !== null && Number(ua) === Number(q?.correct_answer) ? 1 : 0
      }
      if (frac === null) return // ungraded long-form — skip rather than misattribute

      scoredAny = true
      const bucket = sid > 0 ? subBuckets : topicBuckets
      const key = sid > 0 ? sid : tid
      const b = bucket.get(key) ?? { correct: 0, total: 0 }
      b.correct += frac
      b.total += 1
      bucket.set(key, b)
    })

    if (scoredAny && (subBuckets.size > 0 || topicBuckets.size > 0)) {
      const tasks: Promise<void>[] = []
      for (const [sid, b] of subBuckets) tasks.push(upsertMasteryBucket(userId, textbookId, 0, sid, b.correct, b.total, nowIso))
      for (const [tid, b] of topicBuckets) tasks.push(upsertMasteryBucket(userId, textbookId, tid, 0, b.correct, b.total, nowIso))
      await Promise.all(tasks)
      return
    }

    // ── Fallback: legacy assessment-level estimate (no tagged questions). ──────
    const topicIds: number[] = Array.isArray((assessment as any).topic_ids) ? (assessment as any).topic_ids.map(Number).filter(Number.isFinite) : []
    const subtopicIds: number[] = Array.isArray((assessment as any).subtopic_ids) ? (assessment as any).subtopic_ids.map(Number).filter(Number.isFinite) : []
    const keys: Array<{ topic_id: number; subtopic_id: number }> = []
    if (subtopicIds.length > 0) subtopicIds.forEach((sid) => keys.push({ topic_id: 0, subtopic_id: sid }))
    else if (topicIds.length > 0) topicIds.forEach((tid) => keys.push({ topic_id: tid, subtopic_id: 0 }))
    if (keys.length === 0) return

    const pct = Number.isFinite(score) ? Math.max(0, Math.min(100, Number(score))) : 0
    const total = Number.isFinite(totalQuestions) && totalQuestions > 0 ? Number(totalQuestions) : 0
    if (total === 0) return
    const correctCount = Math.round((pct / 100) * total)
    const perCorrect = correctCount / keys.length
    const perTotal = total / keys.length
    for (const key of keys) {
      await upsertMasteryBucket(userId, textbookId, key.topic_id, key.subtopic_id, perCorrect, perTotal, nowIso)
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
    let { data, error } = await supabase
      .from('results')
      .insert([payload])
      .select('id')
      .single()

    resultId = data?.id ?? null

    if (error && isSchemaColumnMissing(error)) {
      const { grade: _grade, questions_data: _questions, longform_grades: _grades, time_taken: _timeTaken, ...fallback } = payload
      const retry = await supabase
        .from('results')
        .insert([fallback])
        .select('id')
        .single()
      error = retry.error
      resultId = retry.data?.id ?? resultId
    }

    if (error) {
      console.error('Supabase insert error:', error)
      throw error
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

      let lookupQuery = supabase
        .from('assignment_results')
        .select('id,attempt_count,result_id,status,started_at,completed_at,last_attempt_at,student_id,student_email')
        .eq('assignment_id', assignmentId)

      if (user_id && studentEmail) {
        lookupQuery = lookupQuery.or(`student_id.eq.${user_id},student_email.eq.${studentEmail}`)
      } else if (user_id) {
        lookupQuery = lookupQuery.eq('student_id', user_id)
      } else if (studentEmail) {
        lookupQuery = lookupQuery.eq('student_email', studentEmail)
      }

      const { data: existingRows, error: existingError } = await lookupQuery
      if (existingError) {
        console.error('Assignment result lookup error:', existingError)
      }

      const existingRow = pickBestResult((existingRows ?? []) as ResultRow[])

      if (user_id && studentEmail) {
        await supabase
          .from('assignment_results')
          .update({ student_id: user_id })
          .eq('assignment_id', assignmentId)
          .eq('student_email', studentEmail)
          .is('student_id', null)
      }

      if (existingRow) {
        attemptCount = Number(existingRow.attempt_count ?? 0) + 1
        if (existingRow.result_id) {
          const { data: bestRow, error: bestError } = await supabase
            .from('results')
            .select('percentage,score')
            .eq('id', existingRow.result_id)
            .maybeSingle()

          if (bestError) {
            console.error('Best result lookup error:', bestError)
          } else {
            const bestScore = Number(bestRow?.percentage ?? bestRow?.score)
            const currentScore = Number(score)
            if (Number.isFinite(bestScore) && Number.isFinite(currentScore) && currentScore < bestScore) {
              bestResultId = existingRow.result_id
            }
          }
        }
      }

      const { data: assignmentRow, error: assignmentError } = await supabase
        .from('assignments')
        .select('max_attempts')
        .eq('id', assignmentId)
        .maybeSingle()

      if (assignmentError) {
        console.error('Assignment lookup error:', assignmentError)
      }

      const maxAttempts = Number(assignmentRow?.max_attempts ?? 1)
      if (Number.isFinite(maxAttempts) && maxAttempts > 0 && attemptCount > maxAttempts) {
        attemptCount = maxAttempts
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
        const { error: updateError } = await supabase
          .from('assignment_results')
          .update(updatePayload)
          .eq('id', existingRow.id)

        if (updateError) {
          console.error('Assignment result update error:', updateError)
        }
      } else {
        const { error: insertError } = await supabase
          .from('assignment_results')
          .insert({
            assignment_id: assignmentId,
            student_id: user_id ?? null,
            student_email: studentEmail,
            status: 'completed',
            completed_at: updatePayload.completed_at,
            result_id: bestResultId,
            assessment_id: assessmentId,
            attempt_count: attemptCount,
            last_attempt_at: updatePayload.last_attempt_at,
          })

        if (insertError) {
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
