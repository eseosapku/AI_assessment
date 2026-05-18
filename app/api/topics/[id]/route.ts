import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

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
        const { data, error } = await supabase
            .from('topics')
            .select('topic_id,textbook_id,topic')
            .eq('topic_id', topicId)
            .single()

        if (error) {
            console.error('Topic fetch error:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
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
        return NextResponse.json({ error: 'Failed to load topic' }, { status: 500 })
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

        const updates: { topic?: string; textbook_id?: number } = {}
        if (name !== undefined) {
            updates.topic = name
        }
        if (textbookResult.value !== undefined) {
            updates.textbook_id = textbookResult.value
        }

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
        }

        const { error: updateError } = await supabase
            .from('topics')
            .update(updates)
            .eq('topic_id', topicId)

        if (updateError) {
            console.error('Topic update error:', updateError)
            return NextResponse.json({ error: updateError.message }, { status: 500 })
        }

        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('Topic update error:', err)
        return NextResponse.json({ error: 'Failed to update topic' }, { status: 500 })
    }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const resolved = await params
    const topicId = parseTopicId(resolved?.id)
    if (!topicId) {
        return NextResponse.json({ error: 'Invalid topic id' }, { status: 400 })
    }

    try {
        const { error } = await supabase
            .from('topics')
            .delete()
            .eq('topic_id', topicId)

        if (error) {
            console.error('Topic delete error:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('Topic delete error:', err)
        return NextResponse.json({ error: 'Failed to delete topic' }, { status: 500 })
    }
}
