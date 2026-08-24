import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isMissingColumn, pgErrorMessage } from '@/lib/pg-errors'
import { prepareLongformQuestionsForStudent } from '@/lib/longform-hints'

function parseId(value: string | undefined) {
    const id = String(value ?? '').trim()
    return id ? id : null
}

function normalizeEmail(value: string | null) {
    return String(value ?? '').trim().toLowerCase()
}

type ResultRow = {
    id: string
    status: string | null
    attempt_count: number | null
    result_id: string | null
    assessment_id: string | null
    started_at: string | null
    completed_at: string | null
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
    return row.last_attempt_at || row.completed_at || row.started_at || null
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

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const resolved = await params
    const assignmentId = parseId(resolved?.id)
    if (!assignmentId) {
        return NextResponse.json({ error: 'Invalid assignment id' }, { status: 400 })
    }

    try {
        const body = await request.json()
        const studentId = body?.student_id ? String(body.student_id).trim() : null
        const studentEmail = normalizeEmail(body?.student_email ?? null)

        if (!studentId && !studentEmail) {
            return NextResponse.json({ error: 'student_id or student_email is required' }, { status: 400 })
        }

        let assignmentResult
        try {
            assignmentResult = await db.query(
                `SELECT id, title, subject, topics, curriculum, question_type, questions_data,
                        estimated_time, question_count, classroom_id, status, deadline, max_attempts, strict_mode, hints_enabled
                 FROM assignments WHERE id = $1 LIMIT 1`,
                [assignmentId]
            )
        } catch (err) {
            if (!isMissingColumn(err)) throw err
            assignmentResult = await db.query(
                `SELECT id, title, subject, topics, curriculum, question_type, questions_data,
                        estimated_time, question_count, classroom_id, status, deadline, max_attempts, strict_mode
                 FROM assignments WHERE id = $1 LIMIT 1`,
                [assignmentId]
            )
        }
        const assignment = assignmentResult.rows[0]

        if (!assignment) {
            return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
        }

        if (assignment.status !== 'sent') {
            return NextResponse.json({ error: 'Assignment is not available' }, { status: 400 })
        }

        if (!Array.isArray(assignment.questions_data) || assignment.questions_data.length === 0) {
            return NextResponse.json({ error: 'Assignment questions are missing' }, { status: 400 })
        }

        const linksResult = await db.query(
            'SELECT classroom_id FROM assignment_classrooms WHERE assignment_id = $1',
            [assignmentId]
        )

        const classroomIds = (linksResult.rows ?? [])
            .map((row: any) => String(row.classroom_id ?? '').trim())
            .filter(Boolean)

        if (classroomIds.length === 0 && assignment.classroom_id) {
            classroomIds.push(String(assignment.classroom_id))
        }

        const maxAttempts = Number(assignment.max_attempts ?? 1)
        const hasLimit = Number.isFinite(maxAttempts) && maxAttempts > 0

        let resultsSql = `
            SELECT id, status, attempt_count, result_id, assessment_id, started_at, completed_at,
                   last_attempt_at, student_id, student_email
            FROM assignment_results WHERE assignment_id = $1
        `
        const resultsValues: unknown[] = [assignmentId]
        let idx = 2

        if (studentId && studentEmail) {
            resultsSql += ` AND (student_id = $${idx++} OR student_email = $${idx++})`
            resultsValues.push(studentId, studentEmail)
        } else if (studentId) {
            resultsSql += ` AND student_id = $${idx++}`
            resultsValues.push(studentId)
        } else if (studentEmail) {
            resultsSql += ` AND student_email = $${idx++}`
            resultsValues.push(studentEmail)
        }

        const resultRowsResult = await db.query(resultsSql, resultsValues)
        const resultRow = pickBestResult((resultRowsResult.rows ?? []) as ResultRow[])
        const attemptCount = Number(resultRow?.attempt_count ?? 0)

        if (resultRow && resultRow.status === 'started' && Boolean(assignment.strict_mode)) {
            return NextResponse.json({ error: 'This strict assessment cannot be re-entered once started' }, { status: 400 })
        }

        if (resultRow && resultRow.status === 'completed' && hasLimit && attemptCount >= maxAttempts) {
            return NextResponse.json({ error: 'No attempts remaining for this assignment' }, { status: 400 })
        }

        if (studentId && studentEmail) {
            await db.query(
                `UPDATE assignment_results SET student_id = $1
                 WHERE assignment_id = $2 AND student_email = $3 AND student_id IS NULL`,
                [studentId, assignmentId, studentEmail]
            )
        }

        if (!resultRow) {
            if (classroomIds.length === 0) {
                return NextResponse.json({ error: 'Assignment is not assigned to a classroom' }, { status: 400 })
            }

            let memberSql = `
                SELECT id FROM classroom_members
                WHERE classroom_id = ANY($1::uuid[]) AND status = 'accepted'
            `
            const memberValues: unknown[] = [classroomIds]

            if (studentId) {
                memberSql += ' AND student_id = $2'
                memberValues.push(studentId)
            } else {
                memberSql += ' AND student_email = $2'
                memberValues.push(studentEmail)
            }

            memberSql += ' LIMIT 1'
            const membershipResult = await db.query(memberSql, memberValues)

            if (!membershipResult.rows[0]) {
                return NextResponse.json({ error: 'You are not enrolled in this classroom' }, { status: 403 })
            }

            const now = new Date().toISOString()
            await db.query(
                `INSERT INTO assignment_results (assignment_id, student_id, student_email, status, started_at, attempt_count, last_attempt_at)
                 VALUES ($1, $2, $3, 'started', $4, 0, $4)`,
                [assignmentId, studentId ?? null, studentEmail, now]
            )
        } else if (resultRow.status === 'pending' || resultRow.status === 'completed') {
            const now = new Date().toISOString()
            await db.query(
                `UPDATE assignment_results
                 SET status = 'started', started_at = $1, last_attempt_at = $1, assessment_id = NULL
                 WHERE id = $2`,
                [now, resultRow.id]
            )
        }

        const estimatedTime = Number.isFinite(assignment.estimated_time)
            ? assignment.estimated_time
            : Math.max(10, Math.round(Number(assignment.question_count ?? 10) * 1.5))

        const hintsEnabled = assignment.hints_enabled !== false
        const questions = prepareLongformQuestionsForStudent(
            assignment.questions_data,
            hintsEnabled,
        )

        return NextResponse.json({
            data: {
                assessment_id: assignment.id,
                assignment_id: assignment.id,
                estimated_time: estimatedTime,
                questions,
                subject: assignment.subject,
                topics: assignment.topics ?? [],
                curriculum: assignment.curriculum,
                questionType: assignment.question_type,
                strict_mode: Boolean(assignment.strict_mode ?? false),
                hints_enabled: hintsEnabled,
            },
        })
    } catch (err) {
        console.error('Assignment start error:', err)
        return NextResponse.json({ error: pgErrorMessage(err, 'Failed to start assignment') }, { status: 500 })
    }
}
