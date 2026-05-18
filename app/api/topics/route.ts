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

async function getNextId(table: 'topics', idColumn: 'topic_id') {
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

        const { data, error } = await supabase
            .from('topics')
            .select('topic_id,textbook_id,topic')
            .eq('textbook_id', textbookId)
            .order('topic')

        if (error) {
            console.error('Topics fetch error:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        const normalized = (data ?? []).map((row: any) => ({
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

        const insertPayload = { textbook_id: textbookResult.value, topic: name }
        let { data: created, error: createError } = await supabase
            .from('topics')
            .insert(insertPayload)
            .select('topic_id,textbook_id,topic')
            .single()

        if (createError?.code === '23502' && createError.message?.includes('topic_id')) {
            try {
                const nextId = await getNextId('topics', 'topic_id')
                const retry = await supabase
                    .from('topics')
                    .insert({ ...insertPayload, topic_id: nextId })
                    .select('topic_id,textbook_id,topic')
                    .single()
                created = retry.data ?? created
                createError = retry.error ?? null
            } catch (err) {
                console.error('Topic id generation error:', err)
                return NextResponse.json({ error: 'Failed to create topic' }, { status: 500 })
            }
        }

        if (createError) {
            console.error('Topic create error:', createError)
            return NextResponse.json({ error: createError.message }, { status: 500 })
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
