import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const teacher_id = request.nextUrl.searchParams.get('teacher_id')
    if (!teacher_id) return NextResponse.json({ error: 'teacher_id required' }, { status: 400 })

    const { data, error } = await supabase
      .from('assignments')
      .select(`
        id,
        title,
        subject,
        topics,
        grade,
        curriculum,
        difficulty_level,
        question_count,
        style,
        question_type,
        deadline,
        created_at,
        status,
        max_attempts,
        classroom_id,
        classrooms(name),
        assignment_results(id)
      `)
      .eq('teacher_id', teacher_id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Teacher assignments fetch error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const assignments = (data ?? []).map((row: any) => ({
      id: row.id,
      title: row.title,
      subject: row.subject,
      topics: row.topics,
      grade: row.grade,
      curriculum: row.curriculum,
      difficulty_level: row.difficulty_level,
      question_count: row.question_count,
      style: row.style,
      question_type: row.question_type,
      deadline: row.deadline,
      created_at: row.created_at,
      status: row.status,
      max_attempts: row.max_attempts ?? 1,
      classroom_id: row.classroom_id,
      classroom_name: row.classrooms?.name ?? null,
      assigned_count: Array.isArray(row.assignment_results) ? row.assignment_results.length : 0,
    }))

    return NextResponse.json({ assignments })
  } catch (err) {
    console.error('Teacher assignments fetch error:', err)
    return NextResponse.json({ error: 'Failed to fetch assignments' }, { status: 500 })
  }
}
