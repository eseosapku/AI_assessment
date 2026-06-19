import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { pgErrorMessage } from '@/lib/pg-errors'

function parseId(value: string | undefined) {
    const id = String(value ?? '').trim()
    return id ? id : null
}

function normalizeEmail(value: string | null) {
    return String(value ?? '').trim().toLowerCase()
}

type ResultRow = {
    id: string
    assignment_id: string
    status: string | null
    attempt_count: number | null
    completed_at: string | null
    started_at: string | null
    last_attempt_at: string | null
    student_id: string | null
    student_email: string | null
    result_id: string | null
    result?: {
        id: string
        score: number | null
        percentage: number | null
        feedback: unknown
        answers?: unknown
        created_at: string | null
        time_taken: number | null
        longform_grades: unknown
        questions_data: unknown
        submission_reason: string | null
        violation_count: number | null
    } | null
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

function normalizeResultRow(raw: any): ResultRow {
    return {
        id: String(raw?.id ?? ''),
        assignment_id: String(raw?.assignment_id ?? ''),
        status: raw?.status ?? null,
        attempt_count: raw?.attempt_count ?? null,
        completed_at: raw?.completed_at ?? null,
        started_at: raw?.started_at ?? null,
        last_attempt_at: raw?.last_attempt_at ?? null,
        student_id: raw?.student_id ?? null,
        student_email: raw?.student_email ?? null,
        result_id: raw?.result_id ?? null,
        result: raw?.result_id
            ? {
                id: String(raw?.result_row_id ?? raw?.result_id ?? ''),
                score: raw?.score ?? null,
                percentage: raw?.percentage ?? null,
                feedback: raw?.feedback ?? null,
                answers: raw?.answers ?? null,
                created_at: raw?.result_created_at ?? null,
                time_taken: raw?.time_taken ?? null,
                longform_grades: raw?.longform_grades ?? null,
                questions_data: raw?.questions_data ?? null,
                submission_reason: raw?.submission_reason ?? null,
                violation_count: raw?.violation_count ?? null,
            }
            : null,
    }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const resolved = await params
    const classroomId = parseId(resolved?.id)
    if (!classroomId) {
        return NextResponse.json({ error: 'Invalid classroom id' }, { status: 400 })
    }

    try {
        const { searchParams } = new URL(request.url)
        const studentId = searchParams.get('student_id') || null
        const studentEmail = normalizeEmail(searchParams.get('student_email'))

        if (!studentId && !studentEmail) {
            return NextResponse.json({ error: 'student_id or student_email is required' }, { status: 400 })
        }

        let memberSql = `
            SELECT cm.student_id, cm.student_email, u.name AS student_name
            FROM classroom_members cm
            LEFT JOIN users u ON u.id = cm.student_id
            WHERE cm.classroom_id = $1
        `
        const memberValues: unknown[] = [classroomId]
        let idx = 2

        if (studentId && studentEmail) {
            memberSql += ` AND (cm.student_id = $${idx++} OR cm.student_email = $${idx++})`
            memberValues.push(studentId, studentEmail)
        } else if (studentId) {
            memberSql += ` AND cm.student_id = $${idx++}`
            memberValues.push(studentId)
        } else {
            memberSql += ` AND cm.student_email = $${idx++}`
            memberValues.push(studentEmail)
        }

        memberSql += ' LIMIT 1'
        const memberResult = await db.query(memberSql, memberValues)
        const memberRow = memberResult.rows[0]

        const assignmentsResult = await db.query(
            `SELECT id, title, subject, grade, deadline, max_attempts, question_count, status, created_at
             FROM assignments
             WHERE classroom_id = $1 AND status = 'sent'
             ORDER BY created_at DESC`,
            [classroomId]
        )

        const assignments = assignmentsResult.rows ?? []
        const assignmentIds = assignments.map((row: any) => row.id).filter(Boolean)

        if (assignmentIds.length === 0) {
            return NextResponse.json({
                student: {
                    student_id: memberRow?.student_id ?? studentId,
                    student_email: memberRow?.student_email ?? studentEmail,
                    student_name: memberRow?.student_name ?? null,
                },
                summary: {
                    assignments_total: 0,
                    completed: 0,
                    started: 0,
                    pending: 0,
                    average_score: null,
                    last_completed_at: null,
                },
                assignments: [],
            })
        }

        let resultsSql = `
            SELECT ar.id, ar.assignment_id, ar.status, ar.attempt_count, ar.completed_at, ar.started_at,
                   ar.last_attempt_at, ar.student_id, ar.student_email, ar.result_id,
                   r.id AS result_row_id, r.score, r.percentage, r.feedback, r.answers, r.created_at AS result_created_at,
                   r.time_taken, r.longform_grades, r.questions_data, r.submission_reason, r.violation_count
            FROM assignment_results ar
            LEFT JOIN results r ON r.id = ar.result_id
            WHERE ar.assignment_id = ANY($1::uuid[])
        `
        const resultsValues: unknown[] = [assignmentIds]
        idx = 2

        if (studentId && studentEmail) {
            resultsSql += ` AND (ar.student_id = $${idx++} OR ar.student_email = $${idx++})`
            resultsValues.push(studentId, studentEmail)
        } else if (studentId) {
            resultsSql += ` AND ar.student_id = $${idx++}`
            resultsValues.push(studentId)
        } else {
            resultsSql += ` AND ar.student_email = $${idx++}`
            resultsValues.push(studentEmail)
        }

        const resultsResult = await db.query(resultsSql, resultsValues)
        const resultMap = new Map<string, ResultRow>()
        const normalizedResults = (resultsResult.rows ?? []).map(normalizeResultRow)

        for (const row of normalizedResults) {
            const existing = resultMap.get(row.assignment_id)
            if (!existing) {
                resultMap.set(row.assignment_id, row)
                continue
            }
            const best = pickBestResult([existing, row])
            if (best) resultMap.set(row.assignment_id, best)
        }

        const rows = assignments.map((assignment: any) => {
            const result = resultMap.get(assignment.id) ?? null
            const scoreValue = Number(result?.result?.percentage ?? result?.result?.score)
            const score = Number.isFinite(scoreValue) ? Math.round(scoreValue) : null
            return {
                assignment_id: assignment.id,
                title: assignment.title,
                subject: assignment.subject,
                grade: assignment.grade,
                question_count: assignment.question_count,
                deadline: assignment.deadline,
                max_attempts: assignment.max_attempts ?? 1,
                status: result?.status ?? 'pending',
                completed_at: result?.completed_at ?? null,
                attempt_count: result?.attempt_count ?? 0,
                last_attempt_at: result?.last_attempt_at ?? null,
                score,
                result_id: result?.result_id ?? null,
                result: result?.result ?? null,
                submission_reason: result?.result?.submission_reason ?? null,
                violation_count: result?.result?.violation_count ?? null,
            }
        })

        const summary = rows.reduce(
            (acc, row) => {
                if (row.status === 'completed') {
                    acc.completed += 1
                    if (row.score !== null) {
                        acc.scoreSum += row.score
                        acc.scoreCount += 1
                    }
                    if (row.completed_at) {
                        acc.lastCompletedAt = acc.lastCompletedAt
                            ? (new Date(row.completed_at) > new Date(acc.lastCompletedAt) ? row.completed_at : acc.lastCompletedAt)
                            : row.completed_at
                    }
                } else if (row.status === 'started') {
                    acc.started += 1
                } else {
                    acc.pending += 1
                }
                return acc
            },
            { completed: 0, started: 0, pending: 0, scoreSum: 0, scoreCount: 0, lastCompletedAt: null as string | null }
        )

        const averageScore = summary.scoreCount > 0 ? Math.round(summary.scoreSum / summary.scoreCount) : null

        return NextResponse.json({
            student: {
                student_id: memberRow?.student_id ?? studentId,
                student_email: memberRow?.student_email ?? studentEmail,
                student_name: memberRow?.student_name ?? null,
            },
            summary: {
                assignments_total: rows.length,
                completed: summary.completed,
                started: summary.started,
                pending: summary.pending,
                average_score: averageScore,
                last_completed_at: summary.lastCompletedAt,
            },
            assignments: rows,
        })
    } catch (err) {
        console.error('Classroom student analytics error:', err)
        return NextResponse.json({ error: pgErrorMessage(err, 'Failed to load student analytics') }, { status: 500 })
    }
}
