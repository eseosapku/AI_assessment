import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isNotNullViolation, pgErrorMessage } from '@/lib/pg-errors'
import { sortBySyllabusOrder } from '@/lib/syllabus-order'

function parseOptionalId(value: unknown, fieldName: string) {
    if (value === undefined) return { value: undefined as number | undefined }
    if (value === null || value === '') return { error: `Invalid ${fieldName}` }
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) {
        return { error: `Invalid ${fieldName}` }
    }
    return { value: parsed }
}

async function getNextTopicId() {
    const result = await db.query<{ next_id: number }>(
        'SELECT COALESCE(MAX(topic_id), 0) + 1 AS next_id FROM topics'
    )
    const nextId = Number(result.rows[0]?.next_id ?? 1)
    if (!Number.isFinite(nextId)) {
        throw new Error('Failed to generate topic id')
    }
    return nextId
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const textbookParam = searchParams.get('textbook_id')

        if (!textbookParam) {
            return NextResponse.json({ error: 'textbook_id is required' }, { status: 400 })
        }

        const textbookId = Number(textbookParam)
        if (!Number.isFinite(textbookId)) {
            return NextResponse.json({ error: 'Invalid textbook_id' }, { status: 400 })
        }

        const result = await db.query(
            'SELECT topic_id, textbook_id, topic FROM topics WHERE textbook_id = $1',
            [textbookId]
        )

        const sorted = sortBySyllabusOrder(result.rows ?? [], 'topic')
        const normalized = sorted.map((row: any) => ({
            id: row.topic_id,
            textbook_id: row.textbook_id,
            name: row.topic,
        }))

        return NextResponse.json({ data: normalized })
    } catch (err) {
        console.error('Topics fetch error:', err)
        return NextResponse.json({ error: 'Failed to load topics' }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const name = String(body?.name ?? body?.topic ?? '').trim()
        const textbookResult = parseOptionalId(body?.textbook_id, 'textbook_id')

        if (!name) {
            return NextResponse.json({ error: 'Topic name is required' }, { status: 400 })
        }
        if (textbookResult.error) {
            return NextResponse.json({ error: textbookResult.error }, { status: 400 })
        }
        if (textbookResult.value === undefined) {
            return NextResponse.json({ error: 'textbook_id is required' }, { status: 400 })
        }

        let created: any = null
        let createError: unknown = null

        try {
            const result = await db.query(
                'INSERT INTO topics (textbook_id, topic) VALUES ($1, $2) RETURNING topic_id, textbook_id, topic',
                [textbookResult.value, name]
            )
            created = result.rows[0]
        } catch (err) {
            createError = err
            if (isNotNullViolation(err) && pgErrorMessage(err).includes('topic_id')) {
                try {
                    const nextId = await getNextTopicId()
                    const retry = await db.query(
                        'INSERT INTO topics (topic_id, textbook_id, topic) VALUES ($1, $2, $3) RETURNING topic_id, textbook_id, topic',
                        [nextId, textbookResult.value, name]
                    )
                    created = retry.rows[0]
                    createError = null
                } catch (retryErr) {
                    console.error('Topic id generation error:', retryErr)
                    return NextResponse.json({ error: 'Failed to create topic' }, { status: 500 })
                }
            }
        }

        if (createError) {
            console.error('Topic create error:', createError)
            return NextResponse.json({ error: pgErrorMessage(createError) }, { status: 500 })
        }

        if (!created) {
            console.error('Topic create error: no record returned')
            return NextResponse.json({ error: 'Failed to create topic' }, { status: 500 })
        }

        return NextResponse.json({
            data: {
                id: created.topic_id,
                textbook_id: created.textbook_id,
                name: created.topic,
            },
        })
    } catch (err) {
        console.error('Topic create error:', err)
        return NextResponse.json({ error: 'Failed to create topic' }, { status: 500 })
    }
}
