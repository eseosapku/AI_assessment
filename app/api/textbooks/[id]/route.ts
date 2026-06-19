import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isUniqueViolation, pgErrorMessage } from '@/lib/pg-errors'

function parseTextbookId(rawId: string | undefined): number | null {
    const parsed = Number(rawId)
    return Number.isFinite(parsed) ? parsed : null
}

function parseOptionalNumber(value: unknown, fieldName: string) {
    if (value === undefined) return { value: undefined as number | null | undefined }
    if (value === null || value === '') return { value: null as number | null }
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) {
        return { error: `Invalid ${fieldName}` }
    }
    return { value: parsed }
}

function parseOptionalString(value: unknown) {
    if (value === undefined) return { value: undefined as string | null | undefined }
    if (value === null) return { value: null as string | null }
    const trimmed = String(value).trim()
    return { value: trimmed ? trimmed : null }
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const resolved = await params
    const textbookId = parseTextbookId(resolved?.id)
    if (!textbookId) {
        return NextResponse.json({ error: 'Invalid textbook id' }, { status: 400 })
    }

    try {
        const result = await db.query(
            'SELECT textbook_id, textbook_name, filename, curriculum FROM textbooks WHERE textbook_id = $1 LIMIT 1',
            [textbookId]
        )
        const data = result.rows[0]
        if (!data) {
            return NextResponse.json({ error: 'Textbook not found' }, { status: 404 })
        }

        return NextResponse.json({
            data: {
                id: data.textbook_id,
                name: data.textbook_name,
                filename: data.filename,
                curriculum: data.curriculum,
            },
        })
    } catch (err) {
        console.error('Textbook fetch error:', err)
        return NextResponse.json({ error: pgErrorMessage(err, 'Failed to load textbook') }, { status: 500 })
    }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const resolved = await params
    const textbookId = parseTextbookId(resolved?.id)
    if (!textbookId) {
        return NextResponse.json({ error: 'Invalid textbook id' }, { status: 400 })
    }

    try {
        const body = await request.json()
        const nameValue = body?.name ?? body?.textbook_name
        const filenameResult = parseOptionalString(body?.filename)
        const curriculumResult = parseOptionalNumber(body?.curriculum, 'curriculum')

        if (curriculumResult.error) {
            return NextResponse.json({ error: curriculumResult.error }, { status: 400 })
        }

        let name: string | undefined
        if (nameValue !== undefined) {
            const trimmed = String(nameValue).trim()
            if (!trimmed) {
                return NextResponse.json({ error: 'Textbook name is required' }, { status: 400 })
            }
            name = trimmed
        }

        const sets: string[] = []
        const values: unknown[] = []
        let idx = 1

        if (name !== undefined) {
            sets.push(`textbook_name = $${idx++}`)
            values.push(name)
        }
        if (filenameResult.value !== undefined) {
            sets.push(`filename = $${idx++}`)
            values.push(filenameResult.value)
        }
        if (curriculumResult.value !== undefined) {
            sets.push(`curriculum = $${idx++}`)
            values.push(curriculumResult.value)
        }

        if (sets.length === 0) {
            return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
        }

        values.push(textbookId)
        try {
            await db.query(
                `UPDATE textbooks SET ${sets.join(', ')} WHERE textbook_id = $${idx}`,
                values
            )
            return NextResponse.json({ success: true })
        } catch (updateError) {
            const status = isUniqueViolation(updateError) ? 409 : 500
            console.error('Textbook update error:', updateError)
            return NextResponse.json({ error: pgErrorMessage(updateError) }, { status })
        }
    } catch (err) {
        console.error('Textbook update error:', err)
        return NextResponse.json({ error: 'Failed to update textbook' }, { status: 500 })
    }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const resolved = await params
    const textbookId = parseTextbookId(resolved?.id)
    if (!textbookId) {
        return NextResponse.json({ error: 'Invalid textbook id' }, { status: 400 })
    }

    try {
        await db.query('DELETE FROM subtopics WHERE textbook_id = $1', [textbookId])
        await db.query('DELETE FROM topics WHERE textbook_id = $1', [textbookId])
        await db.query('DELETE FROM textbooks WHERE textbook_id = $1', [textbookId])
        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('Textbook delete error:', err)
        return NextResponse.json({ error: pgErrorMessage(err, 'Failed to delete textbook') }, { status: 500 })
    }
}
