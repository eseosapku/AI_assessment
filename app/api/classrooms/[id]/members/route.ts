import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { pgErrorMessage } from '@/lib/pg-errors'

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

        let sql = `
            SELECT cm.id, cm.student_id, cm.student_email, cm.status, cm.invited_at, cm.responded_at,
                   u.name AS student_name
            FROM classroom_members cm
            LEFT JOIN users u ON u.id = cm.student_id
            WHERE cm.classroom_id = $1
        `
        const values: unknown[] = [classroomId]

        if (status) {
            values.push(status)
            sql += ` AND cm.status = $${values.length}`
        }

        sql += ' ORDER BY cm.invited_at DESC'

        const result = await db.query(sql, values)
        const members = (result.rows ?? []).map((row: any) => ({
            id: row.id,
            student_id: row.student_id,
            student_email: row.student_email,
            status: row.status,
            invited_at: row.invited_at,
            responded_at: row.responded_at,
            student_name: row.student_name ?? null,
        }))

        return NextResponse.json({ data: members })
    } catch (err) {
        console.error('Classroom members fetch error:', err)
        return NextResponse.json({ error: pgErrorMessage(err, 'Failed to load members') }, { status: 500 })
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
            const studentUsersResult = await db.query(
                'SELECT id, email, student_id FROM users WHERE student_id = ANY($1::varchar[])',
                [studentIds]
            )

            for (const row of studentUsersResult.rows ?? []) {
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
            const existingResult = await db.query(
                'SELECT student_email, status FROM classroom_members WHERE classroom_id = $1 AND student_email = ANY($2::varchar[])',
                [classroomId, emails]
            )

            for (const row of existingResult.rows ?? []) {
                if (row.status === 'accepted' && row.student_email) {
                    acceptedEmails.add(String(row.student_email).toLowerCase())
                }
            }
        }

        const studentUserIds = Array.from(studentIdUserMap.values()).map((row) => row.id)
        if (studentUserIds.length > 0) {
            const existingIdsResult = await db.query(
                'SELECT student_id, status FROM classroom_members WHERE classroom_id = $1 AND student_id = ANY($2::uuid[])',
                [classroomId, studentUserIds]
            )

            for (const row of existingIdsResult.rows ?? []) {
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

        const emailUsersResult = await db.query(
            'SELECT id, email FROM users WHERE email = ANY($1::varchar[])',
            [emailsToInvite]
        )
        const emailUserMap = new Map((emailUsersResult.rows ?? []).map((u: any) => [String(u.email).toLowerCase(), u.id]))

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

        for (const row of rowsToInvite) {
            const upsertResult = await db.query(
                `INSERT INTO classroom_members (classroom_id, student_email, student_id, status, invited_by, invited_at, responded_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 ON CONFLICT (classroom_id, student_email) DO UPDATE SET
                   student_id = EXCLUDED.student_id,
                   status = EXCLUDED.status,
                   invited_by = EXCLUDED.invited_by,
                   invited_at = EXCLUDED.invited_at,
                   responded_at = EXCLUDED.responded_at
                 RETURNING id, student_email, student_id, status, invited_at`,
                [row.classroom_id, row.student_email, row.student_id, row.status, row.invited_by, row.invited_at, row.responded_at]
            )
            combined.push(...(upsertResult.rows ?? []))
        }

        return NextResponse.json({ data: combined, missing_student_ids: missingStudentIds })
    } catch (err) {
        console.error('Classroom invite error:', err)
        return NextResponse.json({ error: pgErrorMessage(err, 'Failed to invite members') }, { status: 500 })
    }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const resolved = await params
    const classroomId = parseId(resolved?.id)
    if (!classroomId) {
        return NextResponse.json({ error: 'Invalid classroom id' }, { status: 400 })
    }

    let body: any = {}
    try {
        body = await request.json()
    } catch {
        body = {}
    }

    const memberId = parseId(body?.member_id)
    const teacherId = parseId(body?.teacher_id)

    if (!memberId) {
        return NextResponse.json({ error: 'member_id is required' }, { status: 400 })
    }
    if (!teacherId) {
        return NextResponse.json({ error: 'teacher_id is required' }, { status: 400 })
    }

    try {
        const classroomResult = await db.query(
            'SELECT id FROM classrooms WHERE id = $1 AND teacher_id = $2 LIMIT 1',
            [classroomId, teacherId]
        )

        if (!classroomResult.rows[0]) {
            return NextResponse.json({ error: 'Not authorized to remove members' }, { status: 403 })
        }

        const deleteResult = await db.query(
            'DELETE FROM classroom_members WHERE id = $1 AND classroom_id = $2 RETURNING id',
            [memberId, classroomId]
        )

        if (!deleteResult.rows || deleteResult.rows.length === 0) {
            return NextResponse.json({ error: 'Member not found' }, { status: 404 })
        }

        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('Classroom member removal error:', err)
        return NextResponse.json({ error: pgErrorMessage(err, 'Failed to remove member') }, { status: 500 })
    }
}
