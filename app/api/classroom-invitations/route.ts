import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

function normalizeEmail(value: string | null) {
    return String(value ?? '').trim().toLowerCase()
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const email = normalizeEmail(searchParams.get('email'))
        if (!email) {
            return NextResponse.json({ error: 'email is required' }, { status: 400 })
        }

        const { data, error } = await supabase
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
            .eq('student_email', email)
            .eq('status', 'pending')
            .order('invited_at', { ascending: false })

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
