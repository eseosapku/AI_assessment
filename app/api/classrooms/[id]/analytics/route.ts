import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

function parseId(value: string | undefined) {
    const id = String(value ?? '').trim()
    return id ? id : null
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const resolved = await params
    const classroomId = parseId(resolved?.id)
    if (!classroomId) {
        return NextResponse.json({ error: 'Invalid classroom id' }, { status: 400 })
    }

    try {
        const { data: members, error: membersError } = await supabase
            .from('classroom_members')
            .select('id,student_id,student_email,status,invited_at,responded_at, student:users!classroom_members_student_id_fkey(name,email)')
            .eq('classroom_id', classroomId)

        if (membersError) {
            console.error('Classroom members fetch error:', membersError)
            return NextResponse.json({ error: membersError.message }, { status: 500 })
        }

        const acceptedMembers = (members ?? []).filter((row: any) => row.status === 'accepted')
        const pendingInvites = (members ?? []).filter((row: any) => row.status === 'pending')

        const { data: assignments, error: assignmentsError } = await supabase
            .from('assignments')
            .select('id,deadline,created_at')
            .eq('classroom_id', classroomId)
            .eq('status', 'sent')

        if (assignmentsError) {
            console.error('Classroom assignments fetch error:', assignmentsError)
            return NextResponse.json({ error: assignmentsError.message }, { status: 500 })
        }

        const assignmentIds = (assignments ?? []).map((row: any) => row.id).filter(Boolean)
        let resultRows: any[] = []

        if (assignmentIds.length > 0) {
            const { data: results, error: resultsError } = await supabase
                .from('assignment_results')
                .select('assignment_id,student_id,student_email,status,completed_at, result:results!assignment_results_result_id_fkey(score,percentage,time_taken)')
                .in('assignment_id', assignmentIds)

            if (resultsError) {
                console.error('Assignment results fetch error:', resultsError)
                return NextResponse.json({ error: resultsError.message }, { status: 500 })
            }

            resultRows = results ?? []
        }

        const studentIds = acceptedMembers
            .map((row: any) => row.student_id)
            .filter((id: any) => id)

        let activityRows: any[] = []
        if (studentIds.length > 0) {
            const { data: activity, error: activityError } = await supabase
                .from('user_activity_daily')
                .select('user_id,seconds_active')
                .in('user_id', studentIds)

            if (activityError) {
                console.error('Activity fetch error:', activityError)
                return NextResponse.json({ error: activityError.message }, { status: 500 })
            }

            activityRows = activity ?? []
        }

        const activityMap = new Map<string, number>()
        for (const row of activityRows) {
            const current = activityMap.get(row.user_id) ?? 0
            activityMap.set(row.user_id, current + Number(row.seconds_active ?? 0))
        }

        const studentMetrics = new Map<string, any>()
        for (const member of acceptedMembers) {
            const studentRecord = Array.isArray(member.student) ? member.student[0] : member.student
            const key = member.student_id ?? member.student_email
            studentMetrics.set(key, {
                student_id: member.student_id ?? null,
                student_email: member.student_email,
                student_name: studentRecord?.name ?? null,
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
                const scoreValue = Number(row.result?.percentage ?? row.result?.score)
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
        return NextResponse.json({ error: 'Failed to load classroom analytics' }, { status: 500 })
    }
}
