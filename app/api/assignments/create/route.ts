import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { pgErrorMessage } from '@/lib/pg-errors'
import { jsonbParam } from '@/lib/pg-json'

function normalizeEmail(value: string | null) {
  return String(value ?? '').trim().toLowerCase()
}

function normalizeClassroomIds(value: unknown, fallback?: unknown): string[] {
  const raw = Array.isArray(value) ? value : (value ? [value] : (fallback ? [fallback] : []))
  const ids = raw.map((id) => String(id ?? '').trim()).filter(Boolean)
  return Array.from(new Set(ids))
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const teacherId = String(body?.teacher_id ?? '').trim()
    const teacherName = String(body?.teacher_name ?? 'Teacher').trim()
    const title = String(body?.title ?? '').trim()
    const subject = String(body?.subject ?? '').trim()
    const topics = Array.isArray(body?.topics)
      ? body.topics.map((t: any) => String(t ?? '').trim()).filter(Boolean)
      : []
    const grade = String(body?.grade ?? '').trim()
    const curriculum = String(body?.curriculum ?? '').trim()
    const difficultyLevel = String(body?.difficulty_level ?? '').trim()
    const questionCount = Number(body?.question_count ?? 0)
    const style = String(body?.style ?? '').trim()
    const questionType = String(body?.question_type ?? '').trim()
    const rawMaxAttempts = Number(body?.max_attempts ?? 1)
    const maxAttempts = Number.isFinite(rawMaxAttempts) ? Math.max(1, Math.floor(rawMaxAttempts)) : 1
    const classroomIds = normalizeClassroomIds(body?.classroom_ids, body?.classroom_id)
    const classroomId = classroomIds.length > 0 ? classroomIds[0] : null
    const questionsData = body?.questions_data ?? null
    const estimatedTime = Number(body?.estimated_time ?? 0)
    const deadline = body?.deadline ? String(body.deadline) : null
    const rawStatus = String(body?.status ?? '').trim().toLowerCase()
    const status = rawStatus || (classroomIds.length > 0 ? 'sent' : 'draft')
    const strictMode = Boolean(body?.strict_mode ?? false)

    if (!teacherId || !subject || topics.length === 0 || !grade) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    if (!curriculum || !difficultyLevel || !style || !questionType || !Number.isFinite(questionCount) || questionCount <= 0) {
      return NextResponse.json({ error: 'Invalid assessment details' }, { status: 400 })
    }
    if (Array.isArray(body?.student_emails) && body.student_emails.length > 0) {
      return NextResponse.json({ error: 'Send assignments to a classroom instead of individual emails.' }, { status: 400 })
    }
    if (!['draft', 'sent'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }
    if (status === 'sent' && classroomIds.length === 0) {
      return NextResponse.json({ error: 'classroom_ids is required to send' }, { status: 400 })
    }

    const insertResult = await db.query(
      `INSERT INTO assignments (
         teacher_id, teacher_name, title, subject, topics, grade, curriculum,
         difficulty_level, question_count, style, question_type, max_attempts,
         classroom_id, status, questions_data, estimated_time, deadline, strict_mode
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16,$17,$18)
       RETURNING id`,
      [
        teacherId,
        teacherName || 'Teacher',
        title || `${subject} — ${new Date().toLocaleDateString()}`,
        subject,
        topics,
        grade,
        curriculum,
        difficultyLevel,
        questionCount,
        style,
        questionType,
        maxAttempts,
        status === 'sent' ? classroomId : null,
        status,
        questionsData != null ? jsonbParam(questionsData) : null,
        Number.isFinite(estimatedTime) && estimatedTime > 0 ? estimatedTime : null,
        deadline,
        strictMode,
      ]
    )

    const assignmentId = insertResult.rows[0]?.id
    if (!assignmentId) {
      return NextResponse.json({ error: 'Failed to create assignment' }, { status: 500 })
    }

    if (status === 'sent' && classroomIds.length > 0) {
      for (const cid of classroomIds) {
        await db.query(
          `INSERT INTO assignment_classrooms (assignment_id, classroom_id)
           VALUES ($1, $2)
           ON CONFLICT (assignment_id, classroom_id) DO NOTHING`,
          [assignmentId, cid]
        )
      }

      const membersResult = await db.query(
        `SELECT student_id, student_email FROM classroom_members
         WHERE classroom_id = ANY($1::uuid[]) AND status = 'accepted'`,
        [classroomIds]
      )

      if ((membersResult.rows ?? []).length > 0) {
        const seenIds = new Set<string>()
        const seenEmails = new Set<string>()
        const rows = (membersResult.rows ?? []).flatMap((m: any) => {
          const studentId = m.student_id ? String(m.student_id).trim() : ''
          const studentEmail = normalizeEmail(m.student_email)
          if (studentId && seenIds.has(studentId)) return []
          if (studentEmail && seenEmails.has(studentEmail)) return []

          if (studentId) seenIds.add(studentId)
          if (studentEmail) seenEmails.add(studentEmail)
          if (!studentEmail) return []

          return [{
            assignment_id: assignmentId,
            student_id: studentId || null,
            student_email: studentEmail,
            status: 'pending',
          }]
        })

        for (const row of rows) {
          await db.query(
            `INSERT INTO assignment_results (assignment_id, student_id, student_email, status)
             VALUES ($1, $2, $3, $4)`,
            [row.assignment_id, row.student_id, row.student_email, row.status]
          )
        }
      }
    }

    return NextResponse.json({ success: true, assignment_id: assignmentId })
  } catch (err) {
    console.error('Assignment create error:', err)
    return NextResponse.json({ error: pgErrorMessage(err, 'Failed to create assignment') }, { status: 500 })
  }
}
