import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

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

    const { data, error } = await supabase
      .from('assignments')
      .insert({
        teacher_id: teacherId,
        teacher_name: teacherName || 'Teacher',
        title: title || `${subject} — ${new Date().toLocaleDateString()}`,
        subject,
        topics,
        grade,
        curriculum,
        difficulty_level: difficultyLevel,
        question_count: questionCount,
        style,
        question_type: questionType,
        max_attempts: maxAttempts,
        classroom_id: status === 'sent' ? classroomId : null,
        status,
        questions_data: questionsData,
        estimated_time: Number.isFinite(estimatedTime) && estimatedTime > 0 ? estimatedTime : null,
        deadline,
      })
      .select('id')
      .single()

    if (error) {
      console.error('Assignment create error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (status === 'sent' && classroomIds.length > 0) {
      const classroomRows = classroomIds.map((id) => ({
        assignment_id: data.id,
        classroom_id: id,
      }))

      const { error: classroomError } = await supabase
        .from('assignment_classrooms')
        .upsert(classroomRows, { onConflict: 'assignment_id,classroom_id' })

      if (classroomError) {
        console.error('Assignment classrooms create error:', classroomError)
        return NextResponse.json({ error: classroomError.message }, { status: 500 })
      }

      const { data: members, error: memberError } = await supabase
        .from('classroom_members')
        .select('student_id,student_email')
        .in('classroom_id', classroomIds)
        .eq('status', 'accepted')

      if (memberError) {
        console.error('Assignment member lookup error:', memberError)
        return NextResponse.json({ error: memberError.message }, { status: 500 })
      }

      if ((members ?? []).length > 0) {
        const seenIds = new Set<string>()
        const seenEmails = new Set<string>()
        const rows = (members ?? []).flatMap((m: any) => {
          const studentId = m.student_id ? String(m.student_id).trim() : ''
          const studentEmail = normalizeEmail(m.student_email)
          if (studentId && seenIds.has(studentId)) return []
          if (studentEmail && seenEmails.has(studentEmail)) return []

          if (studentId) seenIds.add(studentId)
          if (studentEmail) seenEmails.add(studentEmail)

          if (!studentEmail) return []

          return [{
            assignment_id: data.id,
            student_id: studentId || null,
            student_email: studentEmail,
            status: 'pending',
          }]
        })

        if (rows.length > 0) {
          const { error: resultError } = await supabase
            .from('assignment_results')
            .insert(rows)

          if (resultError) {
            console.error('Assignment results create error:', resultError)
            return NextResponse.json({ error: resultError.message }, { status: 500 })
          }
        }
      }
    }

    return NextResponse.json({ success: true, assignment_id: data.id })
  } catch (err) {
    console.error('Assignment create error:', err)
    return NextResponse.json({ error: 'Failed to create assignment' }, { status: 500 })
  }
}
