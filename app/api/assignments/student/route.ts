import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

function normalizeEmail(value: string | null) {
  return String(value ?? '').trim().toLowerCase()
}

type ResultRow = {
  id: string
  assignment_id: string
  result_id: string | null
  status: string | null
  started_at: string | null
  completed_at: string | null
  attempt_count: number | null
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
  return (
    row.last_attempt_at ||
    row.completed_at ||
    row.started_at ||
    null
  )
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

export async function GET(request: NextRequest) {
  try {
    const rawEmail = request.nextUrl.searchParams.get('email')
    const studentId = request.nextUrl.searchParams.get('student_id')
    const classroomIdFilter = request.nextUrl.searchParams.get('classroom_id')
    const email = normalizeEmail(rawEmail)
    if (!email && !studentId) {
      return NextResponse.json({ error: 'email or student_id required' }, { status: 400 })
    }

    let membershipQuery = supabase
      .from('classroom_members')
      .select('classroom_id')
      .eq('status', 'accepted')

    if (studentId && email) {
      membershipQuery = membershipQuery.or(`student_id.eq.${studentId},student_email.eq.${email}`)
    } else if (studentId) {
      membershipQuery = membershipQuery.eq('student_id', studentId)
    } else {
      membershipQuery = membershipQuery.eq('student_email', email)
    }

    if (classroomIdFilter) {
      membershipQuery = membershipQuery.eq('classroom_id', classroomIdFilter)
    }

    const { data: memberships, error: membershipError } = await membershipQuery
    if (membershipError) {
      console.error('Student classrooms lookup error:', membershipError)
      return NextResponse.json({ error: membershipError.message }, { status: 500 })
    }

    const classroomIds = (memberships ?? []).map((m: any) => m.classroom_id).filter(Boolean)
    if (classroomIds.length === 0) {
      return NextResponse.json({ assignments: [] })
    }

    const { data: classroomLinks, error: classroomLinksError } = await supabase
      .from('assignment_classrooms')
      .select('assignment_id,classroom_id,classrooms(name)')
      .in('classroom_id', classroomIds)

    if (classroomLinksError) {
      console.error('Assignment classrooms fetch error:', classroomLinksError)
      return NextResponse.json({ error: classroomLinksError.message }, { status: 500 })
    }

    const assignmentClassroomMap = new Map<string, { ids: string[]; names: string[] }>()
    const assignmentIdsFromLinks = new Set<string>()

    for (const row of classroomLinks ?? []) {
      const assignmentId = String(row.assignment_id ?? '').trim()
      const classroomId = String(row.classroom_id ?? '').trim()
      if (!assignmentId || !classroomId) continue

      assignmentIdsFromLinks.add(assignmentId)
      const current = assignmentClassroomMap.get(assignmentId) ?? { ids: [], names: [] }
      if (!current.ids.includes(classroomId)) current.ids.push(classroomId)
      const classroom = Array.isArray(row.classrooms) ? row.classrooms[0] : row.classrooms
      const classroomName = String(classroom?.name ?? '').trim()
      if (classroomName && !current.names.includes(classroomName)) current.names.push(classroomName)
      assignmentClassroomMap.set(assignmentId, current)
    }

    const selectAssignments = `
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
        classrooms(name)
      `

    const [linkedAssignmentsRes, legacyAssignmentsRes] = await Promise.all([
      assignmentIdsFromLinks.size > 0
        ? supabase
          .from('assignments')
          .select(selectAssignments)
          .eq('status', 'sent')
          .in('id', Array.from(assignmentIdsFromLinks))
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from('assignments')
        .select(selectAssignments)
        .eq('status', 'sent')
        .in('classroom_id', classroomIds),
    ])

    if (linkedAssignmentsRes.error) {
      console.error('Assignments fetch error:', linkedAssignmentsRes.error)
      return NextResponse.json({ error: linkedAssignmentsRes.error.message }, { status: 500 })
    }
    if (legacyAssignmentsRes.error) {
      console.error('Assignments fetch error:', legacyAssignmentsRes.error)
      return NextResponse.json({ error: legacyAssignmentsRes.error.message }, { status: 500 })
    }

    const assignmentMap = new Map<string, any>()
    for (const row of linkedAssignmentsRes.data ?? []) {
      if (!row?.id) continue
      assignmentMap.set(row.id, row)
    }
    for (const row of legacyAssignmentsRes.data ?? []) {
      if (!row?.id) continue
      if (!assignmentMap.has(row.id)) assignmentMap.set(row.id, row)
    }

    const assignments = Array.from(assignmentMap.values()).sort((a: any, b: any) => {
      const aTime = new Date(a.created_at ?? 0).getTime()
      const bTime = new Date(b.created_at ?? 0).getTime()
      return bTime - aTime
    })
    const assignmentIds = assignments.map((row: any) => row.id).filter(Boolean)
    if (assignmentIds.length === 0) {
      return NextResponse.json({ assignments: [] })
    }

    let resultsQuery = supabase
      .from('assignment_results')
      .select('id,assignment_id,status,started_at,completed_at,attempt_count,last_attempt_at,result_id,student_id,student_email')
      .in('assignment_id', assignmentIds)

    if (studentId && email) {
      resultsQuery = resultsQuery.or(`student_id.eq.${studentId},student_email.eq.${email}`)
    } else if (studentId) {
      resultsQuery = resultsQuery.eq('student_id', studentId)
    } else {
      resultsQuery = resultsQuery.eq('student_email', email)
    }

    const { data: results, error: resultsError } = await resultsQuery
    if (resultsError) {
      console.error('Assignment results fetch error:', resultsError)
      return NextResponse.json({ error: resultsError.message }, { status: 500 })
    }

    const resultMap = new Map<string, ResultRow>()
    for (const row of (results ?? []) as ResultRow[]) {
      const existing = resultMap.get(row.assignment_id)
      if (!existing) {
        resultMap.set(row.assignment_id, row)
        continue
      }
      const best = pickBestResult([existing, row])
      if (best) resultMap.set(row.assignment_id, best)
    }

    const normalized = (assignments ?? []).map((row: any) => {
      const result = resultMap.get(row.id)
      const classroomInfo = assignmentClassroomMap.get(row.id)
      const classroomIdsForAssignment = classroomInfo?.ids?.length
        ? classroomInfo.ids
        : (row.classroom_id ? [row.classroom_id] : [])
      const classroomNamesForAssignment = classroomInfo?.names?.length
        ? classroomInfo.names
        : (row.classrooms?.name ? [row.classrooms.name] : [])
      const primaryName = classroomNamesForAssignment[0] ?? row.classrooms?.name ?? null

      return {
        status: result?.status ?? 'pending',
        started_at: result?.started_at ?? null,
        completed_at: result?.completed_at ?? null,
        attempt_count: result?.attempt_count ?? 0,
        result_id: result?.result_id ?? null,
        assignment: {
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
          classroom_ids: classroomIdsForAssignment,
          classroom_name: primaryName,
          classroom_names: classroomNamesForAssignment,
        },
      }
    })

    return NextResponse.json({ assignments: normalized })
  } catch (err) {
    console.error('Assignment fetch error:', err)
    return NextResponse.json({ error: 'Failed to fetch assignments' }, { status: 500 })
  }
}
