import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

function parseId(value: string | undefined) {
    const id = String(value ?? '').trim()
    return id ? id : null
}

function normalizeEmail(value: string | null) {
    return String(value ?? '').trim().toLowerCase()
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const resolved = await params
    const invitationId = parseId(resolved?.id)
    if (!invitationId) {
        return NextResponse.json({ error: 'Invalid invitation id' }, { status: 400 })
    }

    try {
        const body = await request.json()
        const status = String(body?.status ?? '').trim().toLowerCase()
        let studentId = body?.student_id ? String(body.student_id).trim() : null
        const studentEmail = normalizeEmail(body?.student_email ?? null)

        if (!['accepted', 'declined'].includes(status)) {
            return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
        }

        if (status === 'accepted' && !studentId) {
            if (!studentEmail) {
                return NextResponse.json({ error: 'student_id or student_email is required to accept' }, { status: 400 })
            }

            const { data: userRow, error: userError } = await supabase
                .from('users')
                .select('id')
                .eq('email', studentEmail)
                .maybeSingle()

            if (userError) {
                console.error('Invitation lookup error:', userError)
                return NextResponse.json({ error: userError.message }, { status: 500 })
            }

            if (!userRow?.id) {
                return NextResponse.json({ error: 'Student account not found for this email' }, { status: 400 })
            }

            studentId = String(userRow.id)
        }

        const updatePayload: Record<string, any> = {
            status,
            responded_at: new Date().toISOString(),
        }
        if (status === 'accepted') {
            updatePayload.student_id = studentId
        }

        let query = supabase
            .from('classroom_members')
            .update(updatePayload)
            .eq('id', invitationId)
            .eq('status', 'pending')

        if (studentEmail) {
            query = query.eq('student_email', studentEmail)
        }

        const { error } = await query
        if (error) {
            console.error('Invitation update error:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('Invitation update error:', err)
        return NextResponse.json({ error: 'Failed to update invitation' }, { status: 500 })
    }
}
