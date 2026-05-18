import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

function parseId(value: string | undefined) {
    const id = String(value ?? '').trim()
    return id ? id : null
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const resolved = await params
    const assignmentId = parseId(resolved?.id)
    if (!assignmentId) {
        return NextResponse.json({ error: 'Invalid assignment id' }, { status: 400 })
    }

    try {
        const body = await request.json()
        const classroomId = String(body?.classroom_id ?? '').trim()
        const deadline = body?.deadline ? String(body.deadline) : null

        if (!classroomId) {
            return NextResponse.json({ error: 'classroom_id is required' }, { status: 400 })
        }

        const { data: assignment, error: assignmentError } = await supabase
            .from('assignments')
            .select('id,status,classroom_id')
            .eq('id', assignmentId)
            .single()

        if (assignmentError) {
            console.error('Assignment lookup error:', assignmentError)
            return NextResponse.json({ error: assignmentError.message }, { status: 500 })
        }

        if (assignment.status === 'sent' && assignment.classroom_id === classroomId) {
            return NextResponse.json({ success: true })
        }

        const { error: updateError } = await supabase
            .from('assignments')
            .update({
                status: 'sent',
                classroom_id: classroomId,
                deadline,
                updated_at: new Date().toISOString(),
            })
            .eq('id', assignmentId)

        if (updateError) {
            console.error('Assignment send error:', updateError)
            return NextResponse.json({ error: updateError.message }, { status: 500 })
        }

        const { data: members, error: memberError } = await supabase
            .from('classroom_members')
            .select('student_id,student_email')
            .eq('classroom_id', classroomId)
            .eq('status', 'accepted')

        if (memberError) {
            console.error('Assignment members error:', memberError)
            return NextResponse.json({ error: memberError.message }, { status: 500 })
        }

        const { data: existingResults, error: existingError } = await supabase
            .from('assignment_results')
            .select('student_email')
            .eq('assignment_id', assignmentId)

        if (existingError) {
            console.error('Assignment results lookup error:', existingError)
            return NextResponse.json({ error: existingError.message }, { status: 500 })
        }

        const existingEmails = new Set((existingResults ?? []).map((r: any) => r.student_email))
        const rows = (members ?? [])
            .filter((m: any) => !existingEmails.has(m.student_email))
            .map((m: any) => ({
                assignment_id: assignmentId,
                student_id: m.student_id ?? null,
                student_email: m.student_email,
                status: 'pending',
            }))

        if (rows.length > 0) {
            const { error: resultError } = await supabase
                .from('assignment_results')
                .insert(rows)

            if (resultError) {
                console.error('Assignment results create error:', resultError)
                return NextResponse.json({ error: resultError.message }, { status: 500 })
            }
        }

        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('Assignment send error:', err)
        return NextResponse.json({ error: 'Failed to send assignment' }, { status: 500 })
    }
}
