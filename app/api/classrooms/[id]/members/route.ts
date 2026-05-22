import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

function parseId(value: string | undefined) {
    const id = String(value ?? '').trim()
    return id ? id : null
}

function normalizeEmail(value: string) {
    return String(value ?? '').trim().toLowerCase()
}

function normalizeStudentId(value: string) {
    const trimmed = String(value ?? '').trim()
    return trimmed ? trimmed.toUpperCase() : ''
}

function uniqueStrings(values: string[]) {
    return Array.from(new Set(values.map((v) => String(v ?? '').trim()).filter(Boolean)))
}

function splitIdentifiers(values: string[]) {
    const emails: string[] = []
    const studentIds: string[] = []

    values.forEach((value) => {
        const trimmed = String(value ?? '').trim()
        if (!trimmed) return
        if (trimmed.includes('@')) {
            emails.push(normalizeEmail(trimmed))
        } else {
            const normalizedId = normalizeStudentId(trimmed)
            if (normalizedId) studentIds.push(normalizedId)
        }
    })

    return {
        emails: uniqueStrings(emails).filter((e) => e.includes('@')),
        studentIds: uniqueStrings(studentIds),
    }
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
        const identifiers = uniqueStrings([
            ...(Array.isArray(body?.identifiers) ? body.identifiers : [body?.identifiers]),
            ...(Array.isArray(body?.emails) ? body.emails : [body?.email]),
            ...(Array.isArray(body?.student_ids) ? body.student_ids : [body?.student_id]),
        ])
        const { emails, studentIds } = splitIdentifiers(identifiers)

        if (!teacherId) {
            return NextResponse.json({ error: 'teacher_id is required' }, { status: 400 })
        }
        if (emails.length === 0 && studentIds.length === 0) {
            return NextResponse.json({ error: 'At least one email or student ID is required' }, { status: 400 })
        }

        const acceptedEmails = new Set<string>()
        const acceptedStudentIds = new Set<string>()
        const existingStudentUserIds = new Set<string>()

        const missingStudentIds: string[] = []
        const studentIdUserMap = new Map<string, { id: string; email: string | null }>()
        const userIdToStudentId = new Map<string, string>()
        if (studentIds.length > 0) {
            const { data: studentUsers, error: studentError } = await supabase
                .from('users')
                .select('id,email,student_id')
                .in('student_id', studentIds)

            if (studentError) {
                console.error('User lookup error:', studentError)
                return NextResponse.json({ error: studentError.message }, { status: 500 })
            }

            for (const row of studentUsers ?? []) {
                const studentId = normalizeStudentId(String(row.student_id ?? ''))
                if (!studentId) continue
                const userId = String(row.id)
                studentIdUserMap.set(studentId, { id: userId, email: row.email ? String(row.email).toLowerCase() : null })
                userIdToStudentId.set(userId, studentId)
            }

            for (const studentId of studentIds) {
                if (!studentIdUserMap.has(studentId)) {
                    missingStudentIds.push(studentId)
                }
            }
        }

        if (emails.length > 0) {
            const { data: existing, error: existingError } = await supabase
                .from('classroom_members')
                .select('student_email,status')
                .eq('classroom_id', classroomId)
                .in('student_email', emails)

            if (existingError) {
                console.error('Classroom members lookup error:', existingError)
                return NextResponse.json({ error: existingError.message }, { status: 500 })
            }

            for (const row of existing ?? []) {
                if (row.status === 'accepted' && row.student_email) {
                    acceptedEmails.add(String(row.student_email).toLowerCase())
                }
            }
        }

        const studentUserIds = Array.from(studentIdUserMap.values()).map((row) => row.id)
        if (studentUserIds.length > 0) {
            const { data: existingIds, error: existingIdsError } = await supabase
                .from('classroom_members')
                .select('student_id,status')
                .eq('classroom_id', classroomId)
                .in('student_id', studentUserIds)

            if (existingIdsError) {
                console.error('Classroom members lookup error:', existingIdsError)
                return NextResponse.json({ error: existingIdsError.message }, { status: 500 })
            }

            for (const row of existingIds ?? []) {
                if (row.student_id) {
                    const userId = String(row.student_id)
                    existingStudentUserIds.add(userId)
                    if (row.status === 'accepted') {
                        const studentId = userIdToStudentId.get(userId)
                        if (studentId) acceptedStudentIds.add(studentId)
                    }
                }
            }
        }
        const emailsToInvite = emails.filter((email) => !acceptedEmails.has(email))
        const studentIdsToInvite = studentIds.filter((studentId) => studentIdUserMap.has(studentId) && !acceptedStudentIds.has(studentId))

        if (emailsToInvite.length === 0 && studentIdsToInvite.length === 0) {
            return NextResponse.json({ data: [], skipped_emails: emails, skipped_student_ids: studentIds })
        }

        const { data: emailUsers, error: userError } = await supabase
            .from('users')
            .select('id,email')
            .in('email', emailsToInvite)

        if (userError) {
            console.error('User lookup error:', userError)
            return NextResponse.json({ error: userError.message }, { status: 500 })
        }

        const emailUserMap = new Map((emailUsers ?? []).map((u: any) => [String(u.email).toLowerCase(), u.id]))

        if (missingStudentIds.length > 0 && studentIdsToInvite.length === 0 && emailsToInvite.length === 0) {
            return NextResponse.json({ data: [], missing_student_ids: missingStudentIds })
        }

        const now = new Date().toISOString()
        const rowsToInvite: any[] = []
        const seenIdentifiers = new Set<string>()

        for (const email of emailsToInvite) {
            if (seenIdentifiers.has(email)) continue
            seenIdentifiers.add(email)
            rowsToInvite.push({
                classroom_id: classroomId,
                student_email: email,
                student_id: emailUserMap.get(email) ?? null,
                status: 'accepted',
                invited_by: teacherId,
                invited_at: now,
                responded_at: now,
            })
        }

        for (const studentId of studentIdsToInvite) {
            const userRow = studentIdUserMap.get(studentId)
            if (!userRow) continue
            if (existingStudentUserIds.has(userRow.id)) continue
            const userEmail = userRow.email
            const identifier = userEmail ?? studentId
            if (seenIdentifiers.has(identifier)) continue
            seenIdentifiers.add(identifier)
            rowsToInvite.push({
                classroom_id: classroomId,
                student_email: identifier,
                student_id: userRow.id,
                status: 'accepted',
                invited_by: teacherId,
                invited_at: now,
                responded_at: now,
            })
        }

        const combined: any[] = []

        if (rowsToInvite.length > 0) {
            const { data, error } = await supabase
                .from('classroom_members')
                .upsert(rowsToInvite, { onConflict: 'classroom_id,student_email' })
                .select('id,student_email,student_id,status,invited_at')

            if (error) {
                console.error('Classroom invite error:', error)
                return NextResponse.json({ error: error.message }, { status: 500 })
            }

            combined.push(...(data ?? []))
        }

        return NextResponse.json({ data: combined, missing_student_ids: missingStudentIds })
    } catch (err) {
        console.error('Classroom invite error:', err)
        return NextResponse.json({ error: 'Failed to invite members' }, { status: 500 })
    }
}
