import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

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
            const { data, error } = await supabase
                .from('classrooms')
                .select('id,name,description,created_at,updated_at, classroom_members(id,status)')
                .eq('teacher_id', teacherId)
                .order('created_at', { ascending: false })

            if (error) {
                console.error('Classrooms fetch error:', error)
                return NextResponse.json({ error: error.message }, { status: 500 })
            }

            const classrooms = (data ?? []).map((row: any) => {
                const members = Array.isArray(row.classroom_members) ? row.classroom_members : []
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
            let query = supabase
                .from('classroom_members')
                .select('id,status,invited_at, responded_at, classroom:classrooms(id,name,description,teacher_id,created_at)')
                .eq('status', 'accepted')
                .order('invited_at', { ascending: false })

            if (studentId) {
                query = query.eq('student_id', studentId)
            } else {
                if (!studentEmail) {
                    return NextResponse.json({ error: 'student_email is required' }, { status: 400 })
                }
                query = query.eq('student_email', studentEmail)
            }

            const { data, error } = await query
            if (error) {
                console.error('Student classrooms fetch error:', error)
                return NextResponse.json({ error: error.message }, { status: 500 })
            }

            const classroomRows = (data ?? [])
                .map((row: any) => ({
                    membership_id: row.id,
                    classroom_id: row.classroom?.id,
                    name: row.classroom?.name,
                    description: row.classroom?.description,
                    teacher_id: row.classroom?.teacher_id,
                    created_at: row.classroom?.created_at,
                    joined_at: row.responded_at ?? row.invited_at,
                }))
                .filter((row: any) => row.classroom_id)

            const classroomIds = classroomRows.map((row: any) => row.classroom_id)
            if (classroomIds.length === 0) {
                return NextResponse.json({ data: [] })
            }

            const { data: assignments, error: assignmentsError } = await supabase
                .from('assignments')
                .select('id,classroom_id,deadline')
                .eq('status', 'sent')
                .in('classroom_id', classroomIds)

            if (assignmentsError) {
                console.error('Classroom assignments fetch error:', assignmentsError)
                return NextResponse.json({ error: assignmentsError.message }, { status: 500 })
            }

            let resultsQuery = supabase
                .from('assignment_results')
                .select('assignment_id,status')

            if (studentId) {
                resultsQuery = resultsQuery.eq('student_id', studentId)
            } else {
                resultsQuery = resultsQuery.eq('student_email', studentEmail)
            }

            const { data: results, error: resultsError } = await resultsQuery
            if (resultsError) {
                console.error('Assignment results fetch error:', resultsError)
                return NextResponse.json({ error: resultsError.message }, { status: 500 })
            }

            const resultMap = new Map((results ?? []).map((r: any) => [r.assignment_id, r.status]))
            const counts = new Map<string, { upcoming: number; open: number; finished: number }>()
            const now = Date.now()

            for (const assignment of assignments ?? []) {
                const classId = assignment.classroom_id
                const current = counts.get(classId) ?? { upcoming: 0, open: 0, finished: 0 }
                const status = resultMap.get(assignment.id)
                const isExpired = assignment.deadline ? new Date(assignment.deadline).getTime() < now : false

                if (status === 'completed' || isExpired) {
                    current.finished += 1
                } else if (status === 'started') {
                    current.open += 1
                } else {
                    current.upcoming += 1
                }

                counts.set(classId, current)
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
        return NextResponse.json({ error: 'Failed to load classrooms' }, { status: 500 })
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

        const { data, error } = await supabase
            .from('classrooms')
            .insert({ teacher_id: teacherId, name, description })
            .select('id,name,description,created_at,updated_at')
            .single()

        if (error) {
            const status = error.code === '23505' ? 409 : 500
            console.error('Classroom create error:', error)
            return NextResponse.json({ error: error.message }, { status })
        }

        return NextResponse.json({ data })
    } catch (err) {
        console.error('Classroom create error:', err)
        return NextResponse.json({ error: 'Failed to create classroom' }, { status: 500 })
    }
}
