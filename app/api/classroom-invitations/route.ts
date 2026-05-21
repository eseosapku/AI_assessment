import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

function normalizeEmail(value: string | null) {
    return String(value ?? '').trim().toLowerCase()
}

function normalizeStudentId(value: string | null) {
    const trimmed = String(value ?? '').trim()
    return trimmed ? trimmed : null
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const studentId = normalizeStudentId(searchParams.get('student_id'))
        const studentEmail = normalizeEmail(searchParams.get('student_email') ?? searchParams.get('email'))
        if (!studentId && !studentEmail) {
            return NextResponse.json({ error: 'student_id or student_email is required' }, { status: 400 })
        }

        let query = supabase
            .from('classroom_members')
            .select(`
                id,
                status,
                invited_at,
                classroom:classrooms(
                    id,
                    name,
                    description,
                    teacher_id,
                    teacher:users!classrooms_teacher_id_fkey(name,email)
                )
            `)
            .eq('status', 'pending')
            .order('invited_at', { ascending: false })

        if (studentId && studentEmail) {
            query = query.or(`student_id.eq.${studentId},student_email.eq.${studentEmail}`)
        } else if (studentId) {
            query = query.eq('student_id', studentId)
        } else {
            query = query.eq('student_email', studentEmail)
        }

        const { data, error } = await query

        if (error) {
            console.error('Classroom invitations fetch error:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        const invitations = (data ?? []).map((row: any) => ({
            id: row.id,
            invited_at: row.invited_at,
            classroom: {
                id: row.classroom?.id,
                name: row.classroom?.name,
                description: row.classroom?.description,
                teacher_id: row.classroom?.teacher_id,
                teacher_name: row.classroom?.teacher?.name ?? null,
                teacher_email: row.classroom?.teacher?.email ?? null,
            },
        }))

        return NextResponse.json({ data: invitations })
    } catch (err) {
        console.error('Classroom invitations fetch error:', err)
        return NextResponse.json({ error: 'Failed to load invitations' }, { status: 500 })
    }
}
