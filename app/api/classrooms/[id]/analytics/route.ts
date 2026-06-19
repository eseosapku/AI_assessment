import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { pgErrorMessage } from '@/lib/pg-errors'

function parseId(value: string | undefined) {
    const id = String(value ?? '').trim()
    return id ? id : null
}

function parseRange(value: string | null) {
    const normalized = String(value ?? '').toLowerCase()
    if (normalized === 'day' || normalized === 'week' || normalized === 'month') return normalized
    return 'all'
}

function formatDateOnly(date: Date) {
    return date.toISOString().slice(0, 10)
}

function getRangeStart(range: string) {
    if (range === 'all') return null
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const start = new Date(today)
    if (range === 'day') {
        return { start, end: today }
    }
    if (range === 'week') {
        start.setDate(start.getDate() - 6)
        return { start, end: today }
    }
    start.setDate(start.getDate() - 29)
    return { start, end: today }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const resolved = await params
    const classroomId = parseId(resolved?.id)
    if (!classroomId) {
        return NextResponse.json({ error: 'Invalid classroom id' }, { status: 400 })
    }

    const range = parseRange(request.nextUrl.searchParams.get('range'))
    const dateRange = getRangeStart(range)

    try {
        const membersResult = await db.query(
            `SELECT cm.id, cm.student_id, cm.student_email, cm.status, cm.invited_at, cm.responded_at,
                    u.name AS student_name
             FROM classroom_members cm
             LEFT JOIN users u ON u.id = cm.student_id
             WHERE cm.classroom_id = $1`,
            [classroomId]
        )

        const members = membersResult.rows ?? []
        const acceptedMembers = members.filter((row: any) => row.status === 'accepted')
        const pendingInvites = members.filter((row: any) => row.status === 'pending')

        const assignmentsResult = await db.query(
            `SELECT id, deadline, created_at FROM assignments
             WHERE classroom_id = $1 AND status = 'sent'`,
            [classroomId]
        )

        const assignmentIds = (assignmentsResult.rows ?? []).map((row: any) => row.id).filter(Boolean)
        let resultRows: any[] = []

        if (assignmentIds.length > 0) {
            const resultsResult = await db.query(
                `SELECT ar.assignment_id, ar.student_id, ar.student_email, ar.status, ar.completed_at,
                        r.score, r.percentage, r.time_taken
                 FROM assignment_results ar
                 LEFT JOIN results r ON r.id = ar.result_id
                 WHERE ar.assignment_id = ANY($1::uuid[])`,
                [assignmentIds]
            )
            resultRows = resultsResult.rows ?? []
        }

        const studentIds = acceptedMembers
            .map((row: any) => row.student_id)
            .filter((id: any) => id)

        let activityRows: any[] = []
        if (studentIds.length > 0) {
            let activitySql = 'SELECT user_id, seconds_active FROM user_activity_daily WHERE user_id = ANY($1::uuid[])'
            const activityValues: unknown[] = [studentIds]

            if (dateRange) {
                activitySql += ' AND activity_date >= $2 AND activity_date <= $3'
                activityValues.push(formatDateOnly(dateRange.start), formatDateOnly(dateRange.end))
            }

            const activityResult = await db.query(activitySql, activityValues)
            activityRows = activityResult.rows ?? []
        }

        const activityMap = new Map<string, number>()
        for (const row of activityRows) {
            const current = activityMap.get(row.user_id) ?? 0
            activityMap.set(row.user_id, current + Number(row.seconds_active ?? 0))
        }

        const studentMetrics = new Map<string, any>()
        for (const member of acceptedMembers) {
            const key = member.student_id ?? member.student_email
            studentMetrics.set(key, {
                student_id: member.student_id ?? null,
                student_email: member.student_email,
                student_name: member.student_name ?? null,
                completed: 0,
                started: 0,
                pending: 0,
                avg_score: null as number | null,
                last_completed_at: null as string | null,
                seconds_active: member.student_id ? activityMap.get(member.student_id) ?? 0 : 0,
                _score_sum: 0,
                _score_count: 0,
            })
        }

        for (const row of resultRows) {
            const key = row.student_id ?? row.student_email
            if (!studentMetrics.has(key)) continue
            const target = studentMetrics.get(key)

            if (row.status === 'completed') {
                target.completed += 1
                if (row.completed_at) {
                    target.last_completed_at = target.last_completed_at
                        ? (new Date(row.completed_at) > new Date(target.last_completed_at) ? row.completed_at : target.last_completed_at)
                        : row.completed_at
                }
                const scoreValue = Number(row.percentage ?? row.score)
                if (Number.isFinite(scoreValue)) {
                    target._score_sum += scoreValue
                    target._score_count += 1
                }
            } else if (row.status === 'started') {
                target.started += 1
            } else {
                target.pending += 1
            }
        }

        const students = Array.from(studentMetrics.values()).map((row) => {
            const avg = row._score_count > 0 ? Math.round(row._score_sum / row._score_count) : null
            return {
                student_id: row.student_id,
                student_email: row.student_email,
                student_name: row.student_name,
                completed: row.completed,
                started: row.started,
                pending: row.pending,
                avg_score: avg,
                last_completed_at: row.last_completed_at,
                seconds_active: row.seconds_active,
            }
        })

        const totals = students.reduce(
            (acc, row) => {
                acc.completed += row.completed
                acc.started += row.started
                acc.pending += row.pending
                if (Number.isFinite(row.avg_score)) {
                    acc.scoreSum += row.avg_score as number
                    acc.scoreCount += 1
                }
                acc.secondsActive += row.seconds_active ?? 0
                return acc
            },
            { completed: 0, started: 0, pending: 0, scoreSum: 0, scoreCount: 0, secondsActive: 0 }
        )

        const totalResults = totals.completed + totals.started + totals.pending
        const completionRate = totalResults > 0 ? Math.round((totals.completed / totalResults) * 100) : 0
        const averageScore = totals.scoreCount > 0 ? Math.round(totals.scoreSum / totals.scoreCount) : null

        return NextResponse.json({
            summary: {
                student_count: acceptedMembers.length,
                pending_invites: pendingInvites.length,
                assignments_sent: assignmentIds.length,
                completion_rate: completionRate,
                average_score: averageScore,
                seconds_active: totals.secondsActive,
            },
            students,
        })
    } catch (err) {
        console.error('Classroom analytics error:', err)
        return NextResponse.json({ error: pgErrorMessage(err, 'Failed to load classroom analytics') }, { status: 500 })
    }
}
