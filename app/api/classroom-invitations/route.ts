import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { pgErrorMessage } from '@/lib/pg-errors'

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

        let sql = `
            SELECT cm.id, cm.status, cm.invited_at,
                   c.id AS classroom_id, c.name, c.description, c.teacher_id,
                   u.name AS teacher_name, u.email AS teacher_email
            FROM classroom_members cm
            JOIN classrooms c ON c.id = cm.classroom_id
            LEFT JOIN users u ON u.id = c.teacher_id
            WHERE cm.status = 'pending'
        `
        const values: unknown[] = []
        let idx = 1

        if (studentId && studentEmail) {
            sql += ` AND (cm.student_id = $${idx++} OR cm.student_email = $${idx++})`
            values.push(studentId, studentEmail)
        } else if (studentId) {
            sql += ` AND cm.student_id = $${idx++}`
            values.push(studentId)
        } else {
            sql += ` AND cm.student_email = $${idx++}`
            values.push(studentEmail)
        }

        sql += ' ORDER BY cm.invited_at DESC'

        const result = await db.query(sql, values)
        const invitations = (result.rows ?? []).map((row: any) => ({
            id: row.id,
            invited_at: row.invited_at,
            classroom: {
                id: row.classroom_id,
                name: row.name,
                description: row.description,
                teacher_id: row.teacher_id,
                teacher_name: row.teacher_name ?? null,
                teacher_email: row.teacher_email ?? null,
            },
        }))

        return NextResponse.json({ data: invitations })
    } catch (err) {
        console.error('Classroom invitations fetch error:', err)
        return NextResponse.json({ error: pgErrorMessage(err, 'Failed to load invitations') }, { status: 500 })
    }
}
