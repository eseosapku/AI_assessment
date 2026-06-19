import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { pgErrorMessage } from '@/lib/pg-errors'

export async function GET(request: NextRequest) {
  try {
    const teacher_id = request.nextUrl.searchParams.get('teacher_id')
    if (!teacher_id) return NextResponse.json({ error: 'teacher_id required' }, { status: 400 })

    const assignmentsResult = await db.query(
      `SELECT a.id, a.title, a.subject, a.topics, a.grade, a.curriculum, a.difficulty_level,
              a.question_count, a.style, a.question_type, a.deadline, a.created_at, a.status,
              a.max_attempts, a.strict_mode, a.classroom_id,
              c.name AS classroom_name,
              (SELECT COUNT(*)::int FROM assignment_results ar WHERE ar.assignment_id = a.id) AS assigned_count
       FROM assignments a
       LEFT JOIN classrooms c ON c.id = a.classroom_id
       WHERE a.teacher_id = $1
       ORDER BY a.created_at DESC`,
      [teacher_id]
    )

    const data = assignmentsResult.rows ?? []
    const assignmentIds = data.map((row: any) => row.id).filter(Boolean)
    let classroomMap = new Map<string, { ids: string[]; names: string[] }>()

    if (assignmentIds.length > 0) {
      const linksResult = await db.query(
        `SELECT ac.assignment_id, ac.classroom_id, c.name AS classroom_name
         FROM assignment_classrooms ac
         LEFT JOIN classrooms c ON c.id = ac.classroom_id
         WHERE ac.assignment_id = ANY($1::uuid[])`,
        [assignmentIds]
      )

      for (const row of linksResult.rows ?? []) {
        const assignmentId = String(row.assignment_id ?? '').trim()
        const classroomId = String(row.classroom_id ?? '').trim()
        if (!assignmentId || !classroomId) continue

        const current = classroomMap.get(assignmentId) ?? { ids: [], names: [] }
        if (!current.ids.includes(classroomId)) current.ids.push(classroomId)
        const classroomName = String(row.classroom_name ?? '').trim()
        if (classroomName && !current.names.includes(classroomName)) current.names.push(classroomName)
        classroomMap.set(assignmentId, current)
      }
    }

    const assignments = data.map((row: any) => {
      const classroomInfo = classroomMap.get(row.id)
      const classroomIds = classroomInfo?.ids?.length
        ? classroomInfo.ids
        : (row.classroom_id ? [row.classroom_id] : [])
      const classroomNames = classroomInfo?.names?.length
        ? classroomInfo.names
        : (row.classroom_name ? [row.classroom_name] : [])
      const primaryName = classroomNames[0] ?? row.classroom_name ?? null

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
        assigned_count: Number(row.assigned_count ?? 0),
      }
    })

    return NextResponse.json({ assignments })
  } catch (err) {
    console.error('Teacher assignments fetch error:', err)
    return NextResponse.json({ error: pgErrorMessage(err, 'Failed to fetch assignments') }, { status: 500 })
  }
}
