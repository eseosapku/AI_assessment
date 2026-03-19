import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const {
      teacher_id,
      teacher_name,
      title,
      subject,
      topics,
      grade,
      curriculum,
      difficulty_level,
      question_count,
      style,
      question_type,
      student_emails,
      deadline,
    } = await request.json()

    if (!teacher_id || !subject || !topics || !grade || !student_emails?.length) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('assignments')
      .insert({
        teacher_id,
        teacher_name: teacher_name ?? 'Teacher',
        title: title || `${subject} — ${new Date().toLocaleDateString()}`,
        subject,
        topics,
        grade,
        curriculum,
        difficulty_level,
        question_count,
        style,
        question_type,
        student_emails: student_emails.map((e: string) => e.trim().toLowerCase()),
        deadline: deadline || null,
      })
      .select('id')
      .single()

    if (error) {
      console.error('Assignment create error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, assignment_id: data.id })
  } catch (err) {
    console.error('Assignment create error:', err)
    return NextResponse.json({ error: 'Failed to create assignment' }, { status: 500 })
  }
}
