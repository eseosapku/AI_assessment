import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

function parseId(value: string | undefined) {
    const id = String(value ?? '').trim()
    return id ? id : null
}

function normalizeEmail(value: string | null) {
    return String(value ?? '').trim().toLowerCase()
}

function getStudentName(row: any): string | null {
    const student = row?.student
    if (Array.isArray(student)) return student[0]?.name ?? null
    return student?.name ?? null
}

function normalizeResultRow(raw: any): ResultRow {
    const result = Array.isArray(raw?.result) ? raw.result[0] ?? null : raw?.result ?? null
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
        result: result
            ? {
                id: String(result?.id ?? ''),
                score: result?.score ?? null,
                percentage: result?.percentage ?? null,
                feedback: result?.feedback ?? null,
                answers: result?.answers ?? null,
                created_at: result?.created_at ?? null,
                time_taken: result?.time_taken ?? null,
                longform_grades: result?.longform_grades ?? null,
                questions_data: result?.questions_data ?? null,
                submission_reason: result?.submission_reason ?? null,
                violation_count: result?.violation_count ?? null,
            }
            : null,
    }
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

        let memberQuery = supabase
            .from('classroom_members')
            .select('student_id,student_email, student:users!classroom_members_student_id_fkey(name,email)')
            .eq('classroom_id', classroomId)

        if (studentId && studentEmail) {
            memberQuery = memberQuery.or(`student_id.eq.${studentId},student_email.eq.${studentEmail}`)
        } else if (studentId) {
            memberQuery = memberQuery.eq('student_id', studentId)
        } else {
            memberQuery = memberQuery.eq('student_email', studentEmail)
        }

        const { data: memberRow } = await memberQuery.maybeSingle()

        const { data: assignments, error: assignmentsError } = await supabase
            .from('assignments')
            .select('id,title,subject,grade,deadline,max_attempts,question_count,status,created_at')
            .eq('classroom_id', classroomId)
            .eq('status', 'sent')
            .order('created_at', { ascending: false })

        if (assignmentsError) {
            console.error('Classroom assignments fetch error:', assignmentsError)
            return NextResponse.json({ error: assignmentsError.message }, { status: 500 })
        }

        const assignmentIds = (assignments ?? []).map((row: any) => row.id).filter(Boolean)
        if (assignmentIds.length === 0) {
            return NextResponse.json({
                student: {
                    student_id: memberRow?.student_id ?? studentId,
                    student_email: memberRow?.student_email ?? studentEmail,
                    student_name: getStudentName(memberRow),
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

        let resultsQuery = supabase
            .from('assignment_results')
            .select('id,assignment_id,status,attempt_count,completed_at,started_at,last_attempt_at,student_id,student_email,result_id, result:results!assignment_results_result_id_fkey(id,score,percentage,feedback,answers,created_at,time_taken,longform_grades,questions_data,submission_reason,violation_count)')
            .in('assignment_id', assignmentIds)

        if (studentId && studentEmail) {
            resultsQuery = resultsQuery.or(`student_id.eq.${studentId},student_email.eq.${studentEmail}`)
        } else if (studentId) {
            resultsQuery = resultsQuery.eq('student_id', studentId)
        } else {
            resultsQuery = resultsQuery.eq('student_email', studentEmail)
        }

        const { data: results, error: resultsError } = await resultsQuery
        if (resultsError) {
            console.error('Assignment results fetch error:', resultsError)
            return NextResponse.json({ error: resultsError.message }, { status: 500 })
        }

        const resultMap = new Map<string, ResultRow>()
        const normalizedResults = (results ?? []).map(normalizeResultRow)
        for (const row of normalizedResults) {
            const existing = resultMap.get(row.assignment_id)
            if (!existing) {
                resultMap.set(row.assignment_id, row)
                continue
            }
            const best = pickBestResult([existing, row])
            if (best) resultMap.set(row.assignment_id, best)
        }

        const rows = (assignments ?? []).map((assignment: any) => {
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
                student_name: getStudentName(memberRow),
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
        return NextResponse.json({ error: 'Failed to load student analytics' }, { status: 500 })
    }
}
