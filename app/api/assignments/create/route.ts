import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

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
    const classroomId = body?.classroom_id ? String(body.classroom_id).trim() : null
    const questionsData = body?.questions_data ?? null
    const estimatedTime = Number(body?.estimated_time ?? 0)
    const deadline = body?.deadline ? String(body.deadline) : null
    const rawStatus = String(body?.status ?? '').trim().toLowerCase()
    const status = rawStatus || (classroomId ? 'sent' : 'draft')

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
    if (status === 'sent' && !classroomId) {
      return NextResponse.json({ error: 'classroom_id is required to send' }, { status: 400 })
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
        classroom_id: classroomId,
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

    if (status === 'sent' && classroomId) {
      const { data: members, error: memberError } = await supabase
        .from('classroom_members')
        .select('student_id,student_email')
        .eq('classroom_id', classroomId)
        .eq('status', 'accepted')

      if (memberError) {
        console.error('Assignment member lookup error:', memberError)
        return NextResponse.json({ error: memberError.message }, { status: 500 })
      }

      if ((members ?? []).length > 0) {
        const rows = (members ?? []).map((m: any) => ({
          assignment_id: data.id,
          student_id: m.student_id ?? null,
          student_email: m.student_email,
          status: 'pending',
        }))

        const { error: resultError } = await supabase
          .from('assignment_results')
          .insert(rows)

        if (resultError) {
          console.error('Assignment results create error:', resultError)
          return NextResponse.json({ error: resultError.message }, { status: 500 })
        }
      }
    }

    return NextResponse.json({ success: true, assignment_id: data.id })
  } catch (err) {
    console.error('Assignment create error:', err)
    return NextResponse.json({ error: 'Failed to create assignment' }, { status: 500 })
  }
}
