import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { normalizeCountry } from '@/lib/countries'

function normalizeStudentId(value: unknown) {
    const trimmed = String(value ?? '').trim()
    return trimmed ? trimmed.toUpperCase() : null
}

function parseSubjects(input: unknown): string[] | null {
    if (input == null) return null
    if (Array.isArray(input)) {
        const cleaned = input
            .map(subject => String(subject ?? '').trim())
            .filter(Boolean)
        return cleaned.length ? cleaned : []
    }

    const asString = String(input).trim()
    if (!asString) return []

    return asString
        .split(',')
        .map(subject => subject.trim())
        .filter(Boolean)
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()

        const userId = String(body.userId ?? '').trim()
        const studentId = normalizeStudentId(body.studentId)
        const name = String(body.name ?? '').trim()
        const className = String(body.className ?? '').trim()
        const subjects = parseSubjects(body.subjects)
        const currentPassword = String(body.currentPassword ?? '')
        const newPassword = String(body.newPassword ?? '')
        const confirmPassword = String(body.confirmPassword ?? '')

        if (!userId && !studentId) {
            return NextResponse.json({ error: 'User ID or student ID is required' }, { status: 400 })
        }

        const userResult = userId
            ? await db.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [userId])
            : await db.query('SELECT * FROM users WHERE student_id = $1 LIMIT 1', [studentId])
        const userData = userResult.rows[0]

        if (!userData) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        const updatePayload: Record<string, unknown> = {}

        if (Object.prototype.hasOwnProperty.call(body, 'name')) {
            if (!name) {
                return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 })
            }
            updatePayload.name = name
        }

        if (Object.prototype.hasOwnProperty.call(body, 'className')) {
            if (!className) {
                return NextResponse.json({ error: 'Class cannot be empty' }, { status: 400 })
            }
            updatePayload.class = className
        }

        if (subjects !== null) {
            updatePayload.subjects = subjects
        }

        if (Object.prototype.hasOwnProperty.call(body, 'country')) {
            updatePayload.country = normalizeCountry(body.country)
        }

        const wantsPasswordChange = Boolean(newPassword || currentPassword || confirmPassword)

        if (wantsPasswordChange) {
            if (!currentPassword || !newPassword) {
                return NextResponse.json(
                    { error: 'Current password and new password are required' },
                    { status: 400 }
                )
            }

            if (newPassword.length < 6) {
                return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
            }

            if (confirmPassword && newPassword !== confirmPassword) {
                return NextResponse.json({ error: 'Passwords do not match' }, { status: 400 })
            }

            const isValidPassword = await bcrypt.compare(currentPassword, userData.password_hash)
            if (!isValidPassword) {
                return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 })
            }

            updatePayload.password_hash = await bcrypt.hash(newPassword, 10)
        }

        if (!Object.keys(updatePayload).length) {
            return NextResponse.json({ error: 'No updates provided' }, { status: 400 })
        }

        const entries = Object.entries(updatePayload)
        const setClause = entries.map(([key], idx) => `"${key}" = $${idx + 2}`).join(', ')
        const values = [userData.id, ...entries.map(([, value]) => value)]
        const updateResult = await db.query(
            `UPDATE users
             SET ${setClause}, updated_at = NOW()
             WHERE id = $1
             RETURNING id, name, email, student_id, class, subjects, role, country`,
            values,
        )
        const updatedUser = updateResult.rows[0]

        if (!updatedUser) {
            return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
        }

        const user = {
            id: updatedUser.id,
            name: updatedUser.name,
            email: updatedUser.email,
            studentId: updatedUser.student_id,
            class: updatedUser.class,
            subjects: updatedUser.subjects,
            role: updatedUser.role ?? 'student',
            country: normalizeCountry(updatedUser.country),
        }

        return NextResponse.json({ success: true, user, message: 'Profile updated successfully' })
    } catch (error) {
        console.error('Update profile error:', error)
        return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
    }
}
