import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isUniqueViolation, pgErrorMessage } from '@/lib/pg-errors'

function normalizeEmail(value: string | null) {
    return String(value ?? '').trim().toLowerCase()
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const teacherId = searchParams.get('teacher_id')
        const studentId = searchParams.get('student_id')
        const studentEmail = normalizeEmail(searchParams.get('student_email'))

        if (teacherId) {
            const result = await db.query(
                `SELECT c.id, c.name, c.description, c.created_at, c.updated_at,
                        cm.id AS member_id, cm.status AS member_status
                 FROM classrooms c
                 LEFT JOIN classroom_members cm ON cm.classroom_id = c.id
                 WHERE c.teacher_id = $1
                 ORDER BY c.created_at DESC`,
                [teacherId]
            )

            const classroomMap = new Map<string, any>()
            for (const row of result.rows) {
                if (!classroomMap.has(row.id)) {
                    classroomMap.set(row.id, {
                        id: row.id,
                        name: row.name,
                        description: row.description,
                        created_at: row.created_at,
                        updated_at: row.updated_at,
                        members: [] as any[],
                    })
                }
                if (row.member_id) {
                    classroomMap.get(row.id).members.push({ id: row.member_id, status: row.member_status })
                }
            }

            const classrooms = Array.from(classroomMap.values()).map((row: any) => {
                const members = Array.isArray(row.members) ? row.members : []
                const memberCount = members.filter((m: any) => m.status === 'accepted').length
                const pendingCount = members.filter((m: any) => m.status === 'pending').length
                return {
                    id: row.id,
                    name: row.name,
                    description: row.description,
                    created_at: row.created_at,
                    updated_at: row.updated_at,
                    member_count: memberCount,
                    pending_count: pendingCount,
                }
            })

            return NextResponse.json({ data: classrooms })
        }

        if (studentId || studentEmail) {
            let memberSql = `
                SELECT cm.id, cm.status, cm.invited_at, cm.responded_at,
                       c.id AS classroom_id, c.name, c.description, c.teacher_id, c.created_at
                FROM classroom_members cm
                JOIN classrooms c ON c.id = cm.classroom_id
                WHERE cm.status = 'accepted'
            `
            const memberValues: unknown[] = []
            let idx = 1

            if (studentId && studentEmail) {
                memberSql += ` AND (cm.student_id = $${idx++} OR cm.student_email = $${idx++})`
                memberValues.push(studentId, studentEmail)
            } else if (studentId) {
                memberSql += ` AND cm.student_id = $${idx++}`
                memberValues.push(studentId)
            } else {
                if (!studentEmail) {
                    return NextResponse.json({ error: 'student_email is required' }, { status: 400 })
                }
                memberSql += ` AND cm.student_email = $${idx++}`
                memberValues.push(studentEmail)
            }

            memberSql += ' ORDER BY cm.invited_at DESC'

            const memberResult = await db.query(memberSql, memberValues)
            const classroomRows = (memberResult.rows ?? [])
                .map((row: any) => ({
                    membership_id: row.id,
                    classroom_id: row.classroom_id,
                    name: row.name,
                    description: row.description,
                    teacher_id: row.teacher_id,
                    created_at: row.created_at,
                    joined_at: row.responded_at ?? row.invited_at,
                }))
                .filter((row: any) => row.classroom_id)

            const classroomIds = classroomRows.map((row: any) => row.classroom_id)
            if (classroomIds.length === 0) {
                return NextResponse.json({ data: [] })
            }

            const linksResult = await db.query(
                `SELECT assignment_id, classroom_id FROM assignment_classrooms WHERE classroom_id = ANY($1::uuid[])`,
                [classroomIds]
            )

            const linkedAssignmentIds = Array.from(new Set(
                (linksResult.rows ?? [])
                    .map((row: any) => String(row.assignment_id ?? '').trim())
                    .filter(Boolean)
            ))
            const linkedAssignmentsMap = new Map<string, { status: string | null; deadline: string | null }>()

            if (linkedAssignmentIds.length > 0) {
                const assignmentsResult = await db.query(
                    `SELECT id, status, deadline FROM assignments WHERE id = ANY($1::uuid[])`,
                    [linkedAssignmentIds]
                )

                for (const row of assignmentsResult.rows ?? []) {
                    const assignmentId = String(row.id ?? '').trim()
                    if (!assignmentId) continue
                    linkedAssignmentsMap.set(assignmentId, {
                        status: row.status ?? null,
                        deadline: row.deadline ?? null,
                    })
                }
            }

            const legacyResult = await db.query(
                `SELECT id, classroom_id, deadline FROM assignments
                 WHERE status = 'sent' AND classroom_id = ANY($1::uuid[])`,
                [classroomIds]
            )

            let resultsSql = 'SELECT assignment_id, status FROM assignment_results WHERE 1=1'
            const resultsValues: unknown[] = []
            idx = 1

            if (studentId && studentEmail) {
                resultsSql += ` AND (student_id = $${idx++} OR student_email = $${idx++})`
                resultsValues.push(studentId, studentEmail)
            } else if (studentId) {
                resultsSql += ` AND student_id = $${idx++}`
                resultsValues.push(studentId)
            } else {
                resultsSql += ` AND student_email = $${idx++}`
                resultsValues.push(studentEmail)
            }

            const resultsResult = await db.query(resultsSql, resultsValues)
            const resultMap = new Map((resultsResult.rows ?? []).map((r: any) => [r.assignment_id, r.status]))
            const counts = new Map<string, { upcoming: number; open: number; finished: number }>()
            const now = Date.now()
            const seen = new Set<string>()

            const mappings: Array<{ assignment_id: string; classroom_id: string; deadline: string | null }> = []

            for (const row of linksResult.rows ?? []) {
                const assignmentId = String(row.assignment_id ?? '').trim()
                const classroomId = String(row.classroom_id ?? '').trim()
                if (!assignmentId || !classroomId) continue
                const assignment = linkedAssignmentsMap.get(assignmentId)
                if (assignment?.status !== 'sent') continue
                mappings.push({
                    assignment_id: assignmentId,
                    classroom_id: classroomId,
                    deadline: assignment?.deadline ?? null,
                })
            }

            for (const row of legacyResult.rows ?? []) {
                const assignmentId = String(row.id ?? '').trim()
                const classroomId = String(row.classroom_id ?? '').trim()
                if (!assignmentId || !classroomId) continue
                mappings.push({
                    assignment_id: assignmentId,
                    classroom_id: classroomId,
                    deadline: row.deadline ?? null,
                })
            }

            for (const mapping of mappings) {
                const key = `${mapping.classroom_id}:${mapping.assignment_id}`
                if (seen.has(key)) continue
                seen.add(key)

                const current = counts.get(mapping.classroom_id) ?? { upcoming: 0, open: 0, finished: 0 }
                const status = resultMap.get(mapping.assignment_id)
                const isExpired = mapping.deadline ? new Date(mapping.deadline).getTime() < now : false

                if (status === 'completed' || isExpired) {
                    current.finished += 1
                } else if (status === 'started') {
                    current.open += 1
                } else {
                    current.upcoming += 1
                }
                counts.set(mapping.classroom_id, current)
            }

            const classrooms = classroomRows.map((row: any) => ({
                ...row,
                upcoming_count: counts.get(row.classroom_id)?.upcoming ?? 0,
                open_count: counts.get(row.classroom_id)?.open ?? 0,
                finished_count: counts.get(row.classroom_id)?.finished ?? 0,
            }))

            return NextResponse.json({ data: classrooms })
        }

        return NextResponse.json({ error: 'teacher_id or student_id/student_email is required' }, { status: 400 })
    } catch (err) {
        console.error('Classrooms fetch error:', err)
        return NextResponse.json({ error: pgErrorMessage(err, 'Failed to load classrooms') }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const teacherId = String(body?.teacher_id ?? '').trim()
        const name = String(body?.name ?? '').trim()
        const description = body?.description ? String(body.description).trim() : null

        if (!teacherId) {
            return NextResponse.json({ error: 'teacher_id is required' }, { status: 400 })
        }
        if (!name) {
            return NextResponse.json({ error: 'Classroom name is required' }, { status: 400 })
        }

        try {
            const result = await db.query(
                `INSERT INTO classrooms (teacher_id, name, description)
                 VALUES ($1, $2, $3)
                 RETURNING id, name, description, created_at, updated_at`,
                [teacherId, name, description]
            )
            return NextResponse.json({ data: result.rows[0] })
        } catch (error) {
            const status = isUniqueViolation(error) ? 409 : 500
            console.error('Classroom create error:', error)
            return NextResponse.json({ error: pgErrorMessage(error) }, { status })
        }
    } catch (err) {
        console.error('Classroom create error:', err)
        return NextResponse.json({ error: 'Failed to create classroom' }, { status: 500 })
    }
}
