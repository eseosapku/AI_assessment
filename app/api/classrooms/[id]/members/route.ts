import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

function parseId(value: string | undefined) {
    const id = String(value ?? '').trim()
    return id ? id : null
}

function normalizeEmail(value: string) {
    return String(value ?? '').trim().toLowerCase()
}

function uniqueEmails(emails: string[]) {
    return Array.from(new Set(emails.map(normalizeEmail).filter((e) => e && e.includes('@'))))
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const resolved = await params
    const classroomId = parseId(resolved?.id)
    if (!classroomId) {
        return NextResponse.json({ error: 'Invalid classroom id' }, { status: 400 })
    }

    try {
        const { searchParams } = new URL(request.url)
        const status = searchParams.get('status')

        let query = supabase
            .from('classroom_members')
            .select('id,student_id,student_email,status,invited_at,responded_at, student:users!classroom_members_student_id_fkey(name,email)')
            .eq('classroom_id', classroomId)
            .order('invited_at', { ascending: false })

        if (status) {
            query = query.eq('status', status)
        }

        const { data, error } = await query
        if (error) {
            console.error('Classroom members fetch error:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        const members = (data ?? []).map((row: any) => ({
            id: row.id,
            student_id: row.student_id,
            student_email: row.student_email,
            status: row.status,
            invited_at: row.invited_at,
            responded_at: row.responded_at,
            student_name: row.student?.name ?? null,
        }))

        return NextResponse.json({ data: members })
    } catch (err) {
        console.error('Classroom members fetch error:', err)
        return NextResponse.json({ error: 'Failed to load members' }, { status: 500 })
    }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const resolved = await params
    const classroomId = parseId(resolved?.id)
    if (!classroomId) {
        return NextResponse.json({ error: 'Invalid classroom id' }, { status: 400 })
    }

    try {
        const body = await request.json()
        const teacherId = String(body?.teacher_id ?? '').trim()
        const emails = Array.isArray(body?.emails) ? body.emails : [body?.email]
        const normalized = uniqueEmails(emails.map((e: any) => String(e ?? '')))

        if (!teacherId) {
            return NextResponse.json({ error: 'teacher_id is required' }, { status: 400 })
        }
        if (normalized.length === 0) {
            return NextResponse.json({ error: 'At least one valid email is required' }, { status: 400 })
        }

        const { data: existing, error: existingError } = await supabase
            .from('classroom_members')
            .select('student_email,status')
            .eq('classroom_id', classroomId)
            .in('student_email', normalized)

        if (existingError) {
            console.error('Classroom members lookup error:', existingError)
            return NextResponse.json({ error: existingError.message }, { status: 500 })
        }

        const accepted = new Set(
            (existing ?? [])
                .filter((row: any) => row.status === 'accepted')
                .map((row: any) => row.student_email)
        )

        const toInvite = normalized.filter((email) => !accepted.has(email))
        if (toInvite.length === 0) {
            return NextResponse.json({ data: [], skipped: normalized })
        }

        const { data: users, error: userError } = await supabase
            .from('users')
            .select('id,email')
            .in('email', toInvite)

        if (userError) {
            console.error('User lookup error:', userError)
            return NextResponse.json({ error: userError.message }, { status: 500 })
        }

        const userMap = new Map((users ?? []).map((u: any) => [String(u.email).toLowerCase(), u.id]))

        const now = new Date().toISOString()
        const rows = toInvite.map((email) => ({
            classroom_id: classroomId,
            student_email: email,
            student_id: userMap.get(email) ?? null,
            status: 'pending',
            invited_by: teacherId,
            invited_at: now,
            responded_at: null,
        }))

        const { data, error } = await supabase
            .from('classroom_members')
            .upsert(rows, { onConflict: 'classroom_id,student_email' })
            .select('id,student_email,status,invited_at')

        if (error) {
            console.error('Classroom invite error:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ data })
    } catch (err) {
        console.error('Classroom invite error:', err)
        return NextResponse.json({ error: 'Failed to invite members' }, { status: 500 })
    }
}
