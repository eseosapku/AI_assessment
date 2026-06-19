import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { pgErrorMessage } from '@/lib/pg-errors'

function parseTopicId(rawId: string | undefined): number | null {
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
    const topicId = parseTopicId(resolved?.id)
    if (!topicId) {
        return NextResponse.json({ error: 'Invalid topic id' }, { status: 400 })
    }

    try {
        const result = await db.query(
            'SELECT topic_id, textbook_id, topic FROM topics WHERE topic_id = $1 LIMIT 1',
            [topicId]
        )
        const data = result.rows[0]
        if (!data) {
            return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
        }

        return NextResponse.json({
            data: {
                id: data.topic_id,
                textbook_id: data.textbook_id,
                name: data.topic,
            },
        })
    } catch (err) {
        console.error('Topic fetch error:', err)
        return NextResponse.json({ error: pgErrorMessage(err, 'Failed to load topic') }, { status: 500 })
    }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const resolved = await params
    const topicId = parseTopicId(resolved?.id)
    if (!topicId) {
        return NextResponse.json({ error: 'Invalid topic id' }, { status: 400 })
    }

    try {
        const body = await request.json()
        const nameValue = body?.name ?? body?.topic
        const textbookResult = parseOptionalId(body?.textbook_id, 'textbook_id')

        if (textbookResult.error) {
            return NextResponse.json({ error: textbookResult.error }, { status: 400 })
        }

        let name: string | undefined
        if (nameValue !== undefined) {
            const trimmed = String(nameValue).trim()
            if (!trimmed) {
                return NextResponse.json({ error: 'Topic name is required' }, { status: 400 })
            }
            name = trimmed
        }

        const sets: string[] = []
        const values: unknown[] = []
        let idx = 1

        if (name !== undefined) {
            sets.push(`topic = $${idx++}`)
            values.push(name)
        }
        if (textbookResult.value !== undefined) {
            sets.push(`textbook_id = $${idx++}`)
            values.push(textbookResult.value)
        }

        if (sets.length === 0) {
            return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
        }

        values.push(topicId)
        await db.query(
            `UPDATE topics SET ${sets.join(', ')} WHERE topic_id = $${idx}`,
            values
        )

        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('Topic update error:', err)
        return NextResponse.json({ error: pgErrorMessage(err, 'Failed to update topic') }, { status: 500 })
    }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const resolved = await params
    const topicId = parseTopicId(resolved?.id)
    if (!topicId) {
        return NextResponse.json({ error: 'Invalid topic id' }, { status: 400 })
    }

    try {
        await db.query('DELETE FROM topics WHERE topic_id = $1', [topicId])
        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('Topic delete error:', err)
        return NextResponse.json({ error: pgErrorMessage(err, 'Failed to delete topic') }, { status: 500 })
    }
}
