import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

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
