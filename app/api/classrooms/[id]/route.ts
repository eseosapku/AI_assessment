import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isUniqueViolation, pgErrorMessage } from '@/lib/pg-errors'

function parseId(value: string | undefined) {
    const id = String(value ?? '').trim()
    return id ? id : null
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const resolved = await params
    const classroomId = parseId(resolved?.id)
    if (!classroomId) {
        return NextResponse.json({ error: 'Invalid classroom id' }, { status: 400 })
    }

    try {
        const result = await db.query(
            'SELECT id, name, description, teacher_id, created_at, updated_at FROM classrooms WHERE id = $1 LIMIT 1',
            [classroomId]
        )
        const data = result.rows[0]
        if (!data) {
            return NextResponse.json({ error: 'Classroom not found' }, { status: 404 })
        }

        return NextResponse.json({ data })
    } catch (err) {
        console.error('Classroom fetch error:', err)
        return NextResponse.json({ error: pgErrorMessage(err, 'Failed to load classroom') }, { status: 500 })
    }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const resolved = await params
    const classroomId = parseId(resolved?.id)
    if (!classroomId) {
        return NextResponse.json({ error: 'Invalid classroom id' }, { status: 400 })
    }

    try {
        const body = await request.json()
        const name = body?.name !== undefined ? String(body.name).trim() : null
        const description = body?.description !== undefined ? String(body.description).trim() : null

        if (name === null && description === null) {
            return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
        }

        if (name !== null && !name) {
            return NextResponse.json({ error: 'Classroom name is required' }, { status: 400 })
        }

        const sets = ['updated_at = NOW()']
        const values: unknown[] = []
        let idx = 1

        if (name !== null) {
            sets.push(`name = $${idx++}`)
            values.push(name)
        }
        if (description !== null) {
            sets.push(`description = $${idx++}`)
            values.push(description)
        }

        values.push(classroomId)

        try {
            await db.query(
                `UPDATE classrooms SET ${sets.join(', ')} WHERE id = $${idx}`,
                values
            )
            return NextResponse.json({ success: true })
        } catch (error) {
            const status = isUniqueViolation(error) ? 409 : 500
            console.error('Classroom update error:', error)
            return NextResponse.json({ error: pgErrorMessage(error) }, { status })
        }
    } catch (err) {
        console.error('Classroom update error:', err)
        return NextResponse.json({ error: 'Failed to update classroom' }, { status: 500 })
    }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const resolved = await params
    const classroomId = parseId(resolved?.id)
    if (!classroomId) {
        return NextResponse.json({ error: 'Invalid classroom id' }, { status: 400 })
    }

    try {
        await db.query('DELETE FROM classrooms WHERE id = $1', [classroomId])
        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('Classroom delete error:', err)
        return NextResponse.json({ error: pgErrorMessage(err, 'Failed to delete classroom') }, { status: 500 })
    }
}
