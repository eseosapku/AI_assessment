import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

function parseOptionalId(value: unknown, fieldName: string) {
    if (value === undefined) return { value: undefined as number | undefined }
    if (value === null || value === '') return { error: `Invalid ${fieldName}` }
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) {
        return { error: `Invalid ${fieldName}` }
    }
    return { value: parsed }
}

async function getNextId(table: 'subtopics', idColumn: 'subtopic_id') {
    const { data, error } = await supabase
        .from(table)
        .select(idColumn)
        .order(idColumn, { ascending: false })
        .limit(1)
        .maybeSingle()

    if (error) {
        throw error
    }

    const current = data ? Number((data as any)[idColumn]) : 0
    const nextId = Number.isFinite(current) && current > 0 ? current + 1 : 1

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

        let query = supabase
            .from('subtopics')
            .select('subtopic_id,textbook_id,topic_id,subtopic')
            .eq('topic_id', topicId)
            .order('subtopic')

        if (textbookParam) {
            const textbookId = Number(textbookParam)
            if (!Number.isFinite(textbookId)) {
                return NextResponse.json({ error: 'Invalid textbook_id' }, { status: 400 })
            }
            query = query.eq('textbook_id', textbookId)
        }

        const { data, error } = await query
        if (error) {
            console.error('Subtopics fetch error:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        const normalized = (data ?? []).map((row: any) => ({
            id: row.subtopic_id,
            textbook_id: row.textbook_id,
            topic_id: row.topic_id,
            name: row.subtopic,
        }))

        return NextResponse.json({ data: normalized })
    } catch (err) {
        console.error('Subtopics fetch error:', err)
        return NextResponse.json({ error: 'Failed to load subtopics' }, { status: 500 })
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

        const insertPayload = {
            topic_id: topicResult.value,
            textbook_id: textbookResult.value,
            subtopic: name,
        }

        let { data: created, error: createError } = await supabase
            .from('subtopics')
            .insert(insertPayload)
            .select('subtopic_id,textbook_id,topic_id,subtopic')
            .single()

        if (createError?.code === '23502' && createError.message?.includes('subtopic_id')) {
            try {
                const nextId = await getNextId('subtopics', 'subtopic_id')
                const retry = await supabase
                    .from('subtopics')
                    .insert({ ...insertPayload, subtopic_id: nextId })
                    .select('subtopic_id,textbook_id,topic_id,subtopic')
                    .single()
                created = retry.data ?? created
                createError = retry.error ?? null
            } catch (err) {
                console.error('Subtopic id generation error:', err)
                return NextResponse.json({ error: 'Failed to create subtopic' }, { status: 500 })
            }
        }

        if (createError) {
            console.error('Subtopic create error:', createError)
            return NextResponse.json({ error: createError.message }, { status: 500 })
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
