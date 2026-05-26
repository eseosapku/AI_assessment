import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

function normalizeEmail(value: string | null) {
    return String(value ?? '').trim().toLowerCase()
}

function normalizeClassroomIds(value: unknown, fallback?: unknown): string[] {
    const raw = Array.isArray(value) ? value : (value ? [value] : (fallback ? [fallback] : []))
    const ids = raw.map((id) => String(id ?? '').trim()).filter(Boolean)
    return Array.from(new Set(ids))
}

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
        const classroomIds = normalizeClassroomIds(body?.classroom_ids, body?.classroom_id)
        const deadline = body?.deadline ? String(body.deadline) : null

        if (classroomIds.length === 0) {
            return NextResponse.json({ error: 'classroom_ids is required' }, { status: 400 })
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

        const { data: existingLinks, error: linkError } = await supabase
            .from('assignment_classrooms')
            .select('classroom_id')
            .eq('assignment_id', assignmentId)

        if (linkError) {
            console.error('Assignment classroom lookup error:', linkError)
            return NextResponse.json({ error: linkError.message }, { status: 500 })
        }

        const existingClassroomIds = new Set(
            [assignment.classroom_id, ...(existingLinks ?? []).map((row: any) => row.classroom_id)]
                .map((id) => String(id ?? '').trim())
                .filter(Boolean)
        )
        const newClassroomIds = classroomIds.filter((id) => !existingClassroomIds.has(id))

        const updatePayload: Record<string, any> = {
            status: 'sent',
            deadline,
            updated_at: new Date().toISOString(),
        }

        if (!assignment.classroom_id && classroomIds.length > 0) {
            updatePayload.classroom_id = classroomIds[0]
        }

        const { error: updateError } = await supabase
            .from('assignments')
            .update(updatePayload)
            .eq('id', assignmentId)

        if (updateError) {
            console.error('Assignment send error:', updateError)
            return NextResponse.json({ error: updateError.message }, { status: 500 })
        }

        if (newClassroomIds.length > 0) {
            const classroomRows = newClassroomIds.map((id) => ({
                assignment_id: assignmentId,
                classroom_id: id,
            }))

            const { error: classroomError } = await supabase
                .from('assignment_classrooms')
                .upsert(classroomRows, { onConflict: 'assignment_id,classroom_id' })

            if (classroomError) {
                console.error('Assignment classroom insert error:', classroomError)
                return NextResponse.json({ error: classroomError.message }, { status: 500 })
            }
        }

        const { data: members, error: memberError } = await supabase
            .from('classroom_members')
            .select('student_id,student_email')
            .in('classroom_id', classroomIds)
            .eq('status', 'accepted')

        if (memberError) {
            console.error('Assignment members error:', memberError)
            return NextResponse.json({ error: memberError.message }, { status: 500 })
        }

        const { data: existingResults, error: existingError } = await supabase
            .from('assignment_results')
            .select('student_id,student_email')
            .eq('assignment_id', assignmentId)

        if (existingError) {
            console.error('Assignment results lookup error:', existingError)
            return NextResponse.json({ error: existingError.message }, { status: 500 })
        }

        const existingEmails = new Set((existingResults ?? []).map((r: any) => normalizeEmail(r.student_email)))
        const existingIds = new Set((existingResults ?? []).map((r: any) => String(r.student_id ?? '').trim()).filter(Boolean))
        const seenEmails = new Set<string>(existingEmails)
        const seenIds = new Set<string>(existingIds)

        const rows = (members ?? []).flatMap((m: any) => {
            const studentId = m.student_id ? String(m.student_id).trim() : ''
            const studentEmail = normalizeEmail(m.student_email)
            if (studentId && seenIds.has(studentId)) return []
            if (studentEmail && seenEmails.has(studentEmail)) return []
            if (!studentEmail) return []

            if (studentId) seenIds.add(studentId)
            if (studentEmail) seenEmails.add(studentEmail)

            return [{
                assignment_id: assignmentId,
                student_id: studentId || null,
                student_email: studentEmail,
                status: 'pending',
            }]
        })

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
