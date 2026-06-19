import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { pgErrorMessage } from '@/lib/pg-errors'

function parseSubtopicId(rawId: string | undefined): number | null {
    const parsed = Number(rawId)
    return Number.isFinite(parsed) ? parsed : null
}

function parseOptionalId(value: unknown, fieldName: string) {
    if (value === undefined) return { value: undefined as number | undefined }
    if (value === null || value === '') return { error: `Invalid ${fieldName}` }
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) {
        return { error: `Invalid ${fieldName}` }
    }
    return { value: parsed }
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const resolved = await params
    const subtopicId = parseSubtopicId(resolved?.id)
    if (!subtopicId) {
        return NextResponse.json({ error: 'Invalid subtopic id' }, { status: 400 })
    }

    try {
        const result = await db.query(
            'SELECT subtopic_id, textbook_id, topic_id, subtopic FROM subtopics WHERE subtopic_id = $1 LIMIT 1',
            [subtopicId]
        )
        const data = result.rows[0]
        if (!data) {
            return NextResponse.json({ error: 'Subtopic not found' }, { status: 404 })
        }

        return NextResponse.json({
            data: {
                id: data.subtopic_id,
                textbook_id: data.textbook_id,
                topic_id: data.topic_id,
                name: data.subtopic,
            },
        })
    } catch (err) {
        console.error('Subtopic fetch error:', err)
        return NextResponse.json({ error: pgErrorMessage(err, 'Failed to load subtopic') }, { status: 500 })
    }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const resolved = await params
    const subtopicId = parseSubtopicId(resolved?.id)
    if (!subtopicId) {
        return NextResponse.json({ error: 'Invalid subtopic id' }, { status: 400 })
    }

    try {
        const body = await request.json()
        const nameValue = body?.name ?? body?.subtopic
        const topicResult = parseOptionalId(body?.topic_id, 'topic_id')
        const textbookResult = parseOptionalId(body?.textbook_id, 'textbook_id')

        if (topicResult.error) {
            return NextResponse.json({ error: topicResult.error }, { status: 400 })
        }
        if (textbookResult.error) {
            return NextResponse.json({ error: textbookResult.error }, { status: 400 })
        }

        let name: string | undefined
        if (nameValue !== undefined) {
            const trimmed = String(nameValue).trim()
            if (!trimmed) {
                return NextResponse.json({ error: 'Subtopic name is required' }, { status: 400 })
            }
            name = trimmed
        }

        const sets: string[] = []
        const values: unknown[] = []
        let idx = 1

        if (name !== undefined) {
            sets.push(`subtopic = $${idx++}`)
            values.push(name)
        }
        if (topicResult.value !== undefined) {
            sets.push(`topic_id = $${idx++}`)
            values.push(topicResult.value)
        }
        if (textbookResult.value !== undefined) {
            sets.push(`textbook_id = $${idx++}`)
            values.push(textbookResult.value)
        }

        if (sets.length === 0) {
            return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
        }

        values.push(subtopicId)
        await db.query(
            `UPDATE subtopics SET ${sets.join(', ')} WHERE subtopic_id = $${idx}`,
            values
        )

        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('Subtopic update error:', err)
        return NextResponse.json({ error: pgErrorMessage(err, 'Failed to update subtopic') }, { status: 500 })
    }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const resolved = await params
    const subtopicId = parseSubtopicId(resolved?.id)
    if (!subtopicId) {
        return NextResponse.json({ error: 'Invalid subtopic id' }, { status: 400 })
    }

    try {
        await db.query('DELETE FROM subtopics WHERE subtopic_id = $1', [subtopicId])
        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('Subtopic delete error:', err)
        return NextResponse.json({ error: pgErrorMessage(err, 'Failed to delete subtopic') }, { status: 500 })
    }
}
