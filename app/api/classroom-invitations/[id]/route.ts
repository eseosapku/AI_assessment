import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { pgErrorMessage } from '@/lib/pg-errors'

function parseId(value: string | undefined) {
    const id = String(value ?? '').trim()
    return id ? id : null
}

function normalizeEmail(value: string | null) {
    return String(value ?? '').trim().toLowerCase()
}

function normalizeStudentId(value: string | null) {
    const trimmed = String(value ?? '').trim()
    return trimmed ? trimmed : null
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
        let studentId = normalizeStudentId(body?.student_id ?? null)
        const studentEmail = normalizeEmail(body?.student_email ?? null)

        if (!['accepted', 'declined'].includes(status)) {
            return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
        }

        if (status === 'accepted' && !studentId) {
            if (!studentEmail) {
                return NextResponse.json({ error: 'student_id or student_email is required to accept' }, { status: 400 })
            }

            const userResult = await db.query(
                'SELECT id FROM users WHERE email = $1 LIMIT 1',
                [studentEmail]
            )
            const userRow = userResult.rows[0]

            if (!userRow?.id) {
                return NextResponse.json({ error: 'Student account not found for this email' }, { status: 400 })
            }

            studentId = String(userRow.id)
        }

        const sets = ['status = $1', 'responded_at = $2']
        const values: unknown[] = [status, new Date().toISOString()]
        let idx = 3

        if (status === 'accepted') {
            sets.push(`student_id = $${idx++}`)
            values.push(studentId)
        }

        let sql = `UPDATE classroom_members SET ${sets.join(', ')} WHERE id = $${idx++} AND status = 'pending'`
        values.push(invitationId)

        if (studentId && studentEmail) {
            sql += ` AND (student_id = $${idx++} OR student_email = $${idx++})`
            values.push(studentId, studentEmail)
        } else if (studentId) {
            sql += ` AND student_id = $${idx++}`
            values.push(studentId)
        } else if (studentEmail) {
            sql += ` AND student_email = $${idx++}`
            values.push(studentEmail)
        }

        await db.query(sql, values)
        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('Invitation update error:', err)
        return NextResponse.json({ error: pgErrorMessage(err, 'Failed to update invitation') }, { status: 500 })
    }
}
