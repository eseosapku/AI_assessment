import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

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

        const { data: assignment, error: assignmentError } = await supabase
            .from('assignments')
            .select(`
        id,
        title,
        subject,
        topics,
        curriculum,
        question_type,
        questions_data,
        estimated_time,
        question_count,
        classroom_id,
        status,
                deadline,
                max_attempts
      `)
            .eq('id', assignmentId)
            .single()

        if (assignmentError) {
            console.error('Assignment lookup error:', assignmentError)
            return NextResponse.json({ error: assignmentError.message }, { status: 500 })
        }

        if (assignment.status !== 'sent') {
            return NextResponse.json({ error: 'Assignment is not available' }, { status: 400 })
        }

        if (!Array.isArray(assignment.questions_data) || assignment.questions_data.length === 0) {
            return NextResponse.json({ error: 'Assignment questions are missing' }, { status: 400 })
        }

        const { data: classroomLinks, error: classroomError } = await supabase
            .from('assignment_classrooms')
            .select('classroom_id')
            .eq('assignment_id', assignmentId)

        if (classroomError) {
            console.error('Assignment classrooms fetch error:', classroomError)
            return NextResponse.json({ error: classroomError.message }, { status: 500 })
        }

        const classroomIds = (classroomLinks ?? [])
            .map((row: any) => String(row.classroom_id ?? '').trim())
            .filter(Boolean)

        if (classroomIds.length === 0 && assignment.classroom_id) {
            classroomIds.push(String(assignment.classroom_id))
        }

        const maxAttempts = Number(assignment.max_attempts ?? 1)
        const hasLimit = Number.isFinite(maxAttempts) && maxAttempts > 0

        let resultQuery = supabase
            .from('assignment_results')
            .select('id,status,attempt_count,result_id,assessment_id,started_at,completed_at,last_attempt_at,student_id,student_email')
            .eq('assignment_id', assignmentId)

        if (studentId && studentEmail) {
            resultQuery = resultQuery.or(`student_id.eq.${studentId},student_email.eq.${studentEmail}`)
        } else if (studentId) {
            resultQuery = resultQuery.eq('student_id', studentId)
        } else if (studentEmail) {
            resultQuery = resultQuery.eq('student_email', studentEmail)
        }

        const { data: resultRows, error: resultError } = await resultQuery
        if (resultError) {
            console.error('Assignment result lookup error:', resultError)
            return NextResponse.json({ error: resultError.message }, { status: 500 })
        }

        const resultRow = pickBestResult((resultRows ?? []) as ResultRow[])
        const attemptCount = Number(resultRow?.attempt_count ?? 0)

        if (resultRow && resultRow.status === 'completed' && hasLimit && attemptCount >= maxAttempts) {
            return NextResponse.json({ error: 'No attempts remaining for this assignment' }, { status: 400 })
        }

        if (studentId && studentEmail) {
            await supabase
                .from('assignment_results')
                .update({ student_id: studentId })
                .eq('assignment_id', assignmentId)
                .eq('student_email', studentEmail)
                .is('student_id', null)
        }

        if (!resultRow) {
            if (classroomIds.length === 0) {
                return NextResponse.json({ error: 'Assignment is not assigned to a classroom' }, { status: 400 })
            }

            const memberQuery = supabase
                .from('classroom_members')
                .select('id')
                .in('classroom_id', classroomIds)
                .eq('status', 'accepted')

            if (studentId) {
                memberQuery.eq('student_id', studentId)
            } else {
                memberQuery.eq('student_email', studentEmail)
            }

            const { data: membership, error: memberError } = await memberQuery.maybeSingle()
            if (memberError) {
                console.error('Membership lookup error:', memberError)
                return NextResponse.json({ error: memberError.message }, { status: 500 })
            }

            if (!membership) {
                return NextResponse.json({ error: 'You are not enrolled in this classroom' }, { status: 403 })
            }

            const { error: insertError } = await supabase
                .from('assignment_results')
                .insert({
                    assignment_id: assignmentId,
                    student_id: studentId ?? null,
                    student_email: studentEmail,
                    status: 'started',
                    started_at: new Date().toISOString(),
                    attempt_count: 0,
                    last_attempt_at: new Date().toISOString(),
                })

            if (insertError) {
                console.error('Assignment result create error:', insertError)
                return NextResponse.json({ error: insertError.message }, { status: 500 })
            }
        } else if (resultRow.status === 'pending' || resultRow.status === 'completed') {
            const { error: updateError } = await supabase
                .from('assignment_results')
                .update({
                    status: 'started',
                    started_at: new Date().toISOString(),
                    last_attempt_at: new Date().toISOString(),
                    assessment_id: null,
                })
                .eq('id', resultRow.id)

            if (updateError) {
                console.error('Assignment result update error:', updateError)
                return NextResponse.json({ error: updateError.message }, { status: 500 })
            }
        }

        const estimatedTime = Number.isFinite(assignment.estimated_time)
            ? assignment.estimated_time
            : Math.max(10, Math.round(Number(assignment.question_count ?? 10) * 1.5))

        return NextResponse.json({
            data: {
                assessment_id: assignment.id,
                assignment_id: assignment.id,
                estimated_time: estimatedTime,
                questions: assignment.questions_data,
                subject: assignment.subject,
                topics: assignment.topics ?? [],
                curriculum: assignment.curriculum,
                questionType: assignment.question_type,
            },
        })
    } catch (err) {
        console.error('Assignment start error:', err)
        return NextResponse.json({ error: 'Failed to start assignment' }, { status: 500 })
    }
}
