import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { pgErrorMessage } from '@/lib/pg-errors'

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

        const assignmentResult = await db.query(
            'SELECT id, status, classroom_id FROM assignments WHERE id = $1 LIMIT 1',
            [assignmentId]
        )
        const assignment = assignmentResult.rows[0]
        if (!assignment) {
            return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
        }

        const linksResult = await db.query(
            'SELECT classroom_id FROM assignment_classrooms WHERE assignment_id = $1',
            [assignmentId]
        )

        const existingClassroomIds = new Set(
            [assignment.classroom_id, ...(linksResult.rows ?? []).map((row: any) => row.classroom_id)]
                .map((id) => String(id ?? '').trim())
                .filter(Boolean)
        )
        const newClassroomIds = classroomIds.filter((id) => !existingClassroomIds.has(id))

        if (!assignment.classroom_id && classroomIds.length > 0) {
            await db.query(
                `UPDATE assignments SET status = 'sent', deadline = $1, updated_at = NOW(), classroom_id = $2 WHERE id = $3`,
                [deadline, classroomIds[0], assignmentId]
            )
        } else {
            await db.query(
                `UPDATE assignments SET status = 'sent', deadline = $1, updated_at = NOW() WHERE id = $2`,
                [deadline, assignmentId]
            )
        }

        for (const cid of newClassroomIds) {
            await db.query(
                `INSERT INTO assignment_classrooms (assignment_id, classroom_id)
                 VALUES ($1, $2) ON CONFLICT (assignment_id, classroom_id) DO NOTHING`,
                [assignmentId, cid]
            )
        }

        const membersResult = await db.query(
            `SELECT student_id, student_email FROM classroom_members
             WHERE classroom_id = ANY($1::uuid[]) AND status = 'accepted'`,
            [classroomIds]
        )

        const existingResultsResult = await db.query(
            'SELECT student_id, student_email FROM assignment_results WHERE assignment_id = $1',
            [assignmentId]
        )

        const existingEmails = new Set((existingResultsResult.rows ?? []).map((r: any) => normalizeEmail(r.student_email)))
        const existingIds = new Set((existingResultsResult.rows ?? []).map((r: any) => String(r.student_id ?? '').trim()).filter(Boolean))
        const seenEmails = new Set<string>(existingEmails)
        const seenIds = new Set<string>(existingIds)

        const rows = (membersResult.rows ?? []).flatMap((m: any) => {
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

        for (const row of rows) {
            await db.query(
                `INSERT INTO assignment_results (assignment_id, student_id, student_email, status)
                 VALUES ($1, $2, $3, $4)`,
                [row.assignment_id, row.student_id, row.student_email, row.status]
            )
        }

        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('Assignment send error:', err)
        return NextResponse.json({ error: pgErrorMessage(err, 'Failed to send assignment') }, { status: 500 })
    }
}
