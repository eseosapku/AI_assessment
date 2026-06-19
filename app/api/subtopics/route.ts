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

async function getNextSubtopicId() {
    const result = await db.query<{ next_id: number }>(
        'SELECT COALESCE(MAX(subtopic_id), 0) + 1 AS next_id FROM subtopics'
    )
    const nextId = Number(result.rows[0]?.next_id ?? 1)
    if (!Number.isFinite(nextId)) {
        throw new Error('Failed to generate subtopic id')
    }
    return nextId
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const topicParam = searchParams.get('topic_id')
        const textbookParam = searchParams.get('textbook_id')

        if (!topicParam) {
            return NextResponse.json({ error: 'topic_id is required' }, { status: 400 })
        }

        const topicId = Number(topicParam)
        if (!Number.isFinite(topicId)) {
            return NextResponse.json({ error: 'Invalid topic_id' }, { status: 400 })
        }

        const values: unknown[] = [topicId]
        let sql = 'SELECT subtopic_id, textbook_id, topic_id, subtopic FROM subtopics WHERE topic_id = $1'

        if (textbookParam) {
            const textbookId = Number(textbookParam)
            if (!Number.isFinite(textbookId)) {
                return NextResponse.json({ error: 'Invalid textbook_id' }, { status: 400 })
            }
            values.push(textbookId)
            sql += ' AND textbook_id = $2'
        }

        const result = await db.query(sql, values)
        const sorted = sortBySyllabusOrder(result.rows ?? [], 'subtopic')
        const normalized = sorted.map((row: any) => ({
            id: row.subtopic_id,
            textbook_id: row.textbook_id,
            topic_id: row.topic_id,
            name: row.subtopic,
        }))

        return NextResponse.json({ data: normalized })
    } catch (err) {
        console.error('Subtopics fetch error:', err)
        return NextResponse.json({ error: pgErrorMessage(err, 'Failed to load subtopics') }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const name = String(body?.name ?? body?.subtopic ?? '').trim()
        const topicResult = parseOptionalId(body?.topic_id, 'topic_id')
        const textbookResult = parseOptionalId(body?.textbook_id, 'textbook_id')

        if (!name) {
            return NextResponse.json({ error: 'Subtopic name is required' }, { status: 400 })
        }
        if (topicResult.error) {
            return NextResponse.json({ error: topicResult.error }, { status: 400 })
        }
        if (textbookResult.error) {
            return NextResponse.json({ error: textbookResult.error }, { status: 400 })
        }
        if (topicResult.value === undefined) {
            return NextResponse.json({ error: 'topic_id is required' }, { status: 400 })
        }
        if (textbookResult.value === undefined) {
            return NextResponse.json({ error: 'textbook_id is required' }, { status: 400 })
        }

        let created: any = null
        let createError: unknown = null

        try {
            const result = await db.query(
                'INSERT INTO subtopics (topic_id, textbook_id, subtopic) VALUES ($1, $2, $3) RETURNING subtopic_id, textbook_id, topic_id, subtopic',
                [topicResult.value, textbookResult.value, name]
            )
            created = result.rows[0]
        } catch (err) {
            createError = err
            if (isNotNullViolation(err) && pgErrorMessage(err).includes('subtopic_id')) {
                try {
                    const nextId = await getNextSubtopicId()
                    const retry = await db.query(
                        'INSERT INTO subtopics (subtopic_id, topic_id, textbook_id, subtopic) VALUES ($1, $2, $3, $4) RETURNING subtopic_id, textbook_id, topic_id, subtopic',
                        [nextId, topicResult.value, textbookResult.value, name]
                    )
                    created = retry.rows[0]
                    createError = null
                } catch (retryErr) {
                    console.error('Subtopic id generation error:', retryErr)
                    return NextResponse.json({ error: 'Failed to create subtopic' }, { status: 500 })
                }
            }
        }

        if (createError) {
            console.error('Subtopic create error:', createError)
            return NextResponse.json({ error: pgErrorMessage(createError) }, { status: 500 })
        }

        if (!created) {
            console.error('Subtopic create error: no record returned')
            return NextResponse.json({ error: 'Failed to create subtopic' }, { status: 500 })
        }

        return NextResponse.json({
            data: {
                id: created.subtopic_id,
                textbook_id: created.textbook_id,
                topic_id: created.topic_id,
                name: created.subtopic,
            },
        })
    } catch (err) {
        console.error('Subtopic create error:', err)
        return NextResponse.json({ error: 'Failed to create subtopic' }, { status: 500 })
    }
}
