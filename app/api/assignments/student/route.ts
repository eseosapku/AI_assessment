import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { pgErrorMessage } from '@/lib/pg-errors'

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

    let membershipSql = `SELECT classroom_id FROM classroom_members WHERE status = 'accepted'`
    const membershipValues: unknown[] = []
    let idx = 1

    if (studentId && email) {
      membershipSql += ` AND (student_id = $${idx++} OR student_email = $${idx++})`
      membershipValues.push(studentId, email)
    } else if (studentId) {
      membershipSql += ` AND student_id = $${idx++}`
      membershipValues.push(studentId)
    } else {
      membershipSql += ` AND student_email = $${idx++}`
      membershipValues.push(email)
    }

    if (classroomIdFilter) {
      membershipSql += ` AND classroom_id = $${idx++}`
      membershipValues.push(classroomIdFilter)
    }

    const membershipsResult = await db.query(membershipSql, membershipValues)
    const classroomIds = (membershipsResult.rows ?? []).map((m: any) => m.classroom_id).filter(Boolean)
    if (classroomIds.length === 0) {
      return NextResponse.json({ assignments: [] })
    }

    const linksResult = await db.query(
      `SELECT ac.assignment_id, ac.classroom_id, c.name AS classroom_name
       FROM assignment_classrooms ac
       LEFT JOIN classrooms c ON c.id = ac.classroom_id
       WHERE ac.classroom_id = ANY($1::uuid[])`,
      [classroomIds]
    )

    const assignmentClassroomMap = new Map<string, { ids: string[]; names: string[] }>()
    const assignmentIdsFromLinks = new Set<string>()

    for (const row of linksResult.rows ?? []) {
      const assignmentId = String(row.assignment_id ?? '').trim()
      const classroomId = String(row.classroom_id ?? '').trim()
      if (!assignmentId || !classroomId) continue

      assignmentIdsFromLinks.add(assignmentId)
      const current = assignmentClassroomMap.get(assignmentId) ?? { ids: [], names: [] }
      if (!current.ids.includes(classroomId)) current.ids.push(classroomId)
      const classroomName = String(row.classroom_name ?? '').trim()
      if (classroomName && !current.names.includes(classroomName)) current.names.push(classroomName)
      assignmentClassroomMap.set(assignmentId, current)
    }

    const linkedIds = Array.from(assignmentIdsFromLinks)
    const [linkedAssignmentsResult, legacyAssignmentsResult] = await Promise.all([
      linkedIds.length > 0
        ? db.query(
            `SELECT a.id, a.title, a.subject, a.topics, a.grade, a.curriculum, a.difficulty_level,
                    a.question_count, a.style, a.question_type, a.deadline, a.created_at, a.status,
                    a.max_attempts, a.strict_mode, a.classroom_id, c.name AS classroom_name
             FROM assignments a
             LEFT JOIN classrooms c ON c.id = a.classroom_id
             WHERE a.status = 'sent' AND a.id = ANY($1::uuid[])`,
            [linkedIds]
          )
        : Promise.resolve({ rows: [] as any[] }),
      db.query(
        `SELECT a.id, a.title, a.subject, a.topics, a.grade, a.curriculum, a.difficulty_level,
                a.question_count, a.style, a.question_type, a.deadline, a.created_at, a.status,
                a.max_attempts, a.strict_mode, a.classroom_id, c.name AS classroom_name
         FROM assignments a
         LEFT JOIN classrooms c ON c.id = a.classroom_id
         WHERE a.status = 'sent' AND a.classroom_id = ANY($1::uuid[])`,
        [classroomIds]
      ),
    ])

    const assignmentMap = new Map<string, any>()
    for (const row of linkedAssignmentsResult.rows ?? []) {
      if (!row?.id) continue
      assignmentMap.set(row.id, row)
    }
    for (const row of legacyAssignmentsResult.rows ?? []) {
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

    let resultsSql = `
      SELECT id, assignment_id, status, started_at, completed_at, attempt_count, last_attempt_at, result_id, student_id, student_email
      FROM assignment_results
      WHERE assignment_id = ANY($1::uuid[])
    `
    const resultsValues: unknown[] = [assignmentIds]
    idx = 2

    if (studentId && email) {
      resultsSql += ` AND (student_id = $${idx++} OR student_email = $${idx++})`
      resultsValues.push(studentId, email)
    } else if (studentId) {
      resultsSql += ` AND student_id = $${idx++}`
      resultsValues.push(studentId)
    } else {
      resultsSql += ` AND student_email = $${idx++}`
      resultsValues.push(email)
    }

    const resultsResult = await db.query(resultsSql, resultsValues)
    const resultMap = new Map<string, ResultRow>()
    for (const row of (resultsResult.rows ?? []) as ResultRow[]) {
      const existing = resultMap.get(row.assignment_id)
      if (!existing) {
        resultMap.set(row.assignment_id, row)
        continue
      }
      const best = pickBestResult([existing, row])
      if (best) resultMap.set(row.assignment_id, best)
    }

    const normalized = assignments.map((row: any) => {
      const result = resultMap.get(row.id)
      const classroomInfo = assignmentClassroomMap.get(row.id)
      const classroomIdsForAssignment = classroomInfo?.ids?.length
        ? classroomInfo.ids
        : (row.classroom_id ? [row.classroom_id] : [])
      const classroomNamesForAssignment = classroomInfo?.names?.length
        ? classroomInfo.names
        : (row.classroom_name ? [row.classroom_name] : [])
      const primaryName = classroomNamesForAssignment[0] ?? row.classroom_name ?? null

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
          strict_mode: Boolean(row.strict_mode ?? false),
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
    return NextResponse.json({ error: pgErrorMessage(err, 'Failed to fetch assignments') }, { status: 500 })
  }
}
