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
        strict_mode,
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

    const assignmentIds = (data ?? []).map((row: any) => row.id).filter(Boolean)
    let classroomMap = new Map<string, { ids: string[]; names: string[] }>()

    if (assignmentIds.length > 0) {
      const { data: classroomLinks, error: classroomError } = await supabase
        .from('assignment_classrooms')
        .select('assignment_id,classroom_id,classrooms(name)')
        .in('assignment_id', assignmentIds)

      if (classroomError) {
        console.error('Assignment classrooms fetch error:', classroomError)
        return NextResponse.json({ error: classroomError.message }, { status: 500 })
      }

      for (const row of classroomLinks ?? []) {
        const assignmentId = String(row.assignment_id ?? '').trim()
        const classroomId = String(row.classroom_id ?? '').trim()
        if (!assignmentId || !classroomId) continue

        const current = classroomMap.get(assignmentId) ?? { ids: [], names: [] }
        if (!current.ids.includes(classroomId)) current.ids.push(classroomId)
        const classroom = Array.isArray(row.classrooms) ? row.classrooms[0] : row.classrooms
        const classroomName = String(classroom?.name ?? '').trim()
        if (classroomName && !current.names.includes(classroomName)) current.names.push(classroomName)
        classroomMap.set(assignmentId, current)
      }
    }

    const assignments = (data ?? []).map((row: any) => {
      const classroomInfo = classroomMap.get(row.id)
      const classroom = Array.isArray(row.classrooms) ? row.classrooms[0] : row.classrooms
      const classroomIds = classroomInfo?.ids?.length
        ? classroomInfo.ids
        : (row.classroom_id ? [row.classroom_id] : [])
      const classroomNames = classroomInfo?.names?.length
        ? classroomInfo.names
        : (classroom?.name ? [classroom.name] : [])
      const primaryName = classroomNames[0] ?? classroom?.name ?? null

      return {
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
        strict_mode: Boolean(row.strict_mode ?? false),
        classroom_id: row.classroom_id,
        classroom_ids: classroomIds,
        classroom_name: primaryName,
        classroom_names: classroomNames,
        assigned_count: Array.isArray(row.assignment_results) ? row.assignment_results.length : 0,
      }
    })

    return NextResponse.json({ assignments })
  } catch (err) {
    console.error('Teacher assignments fetch error:', err)
    return NextResponse.json({ error: 'Failed to fetch assignments' }, { status: 500 })
  }
}
