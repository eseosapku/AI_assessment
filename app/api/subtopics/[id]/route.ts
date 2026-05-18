import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

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
        const { data, error } = await supabase
            .from('subtopics')
            .select('subtopic_id,textbook_id,topic_id,subtopic')
            .eq('subtopic_id', subtopicId)
            .single()

        if (error) {
            console.error('Subtopic fetch error:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
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
        return NextResponse.json({ error: 'Failed to load subtopic' }, { status: 500 })
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

        const updates: { subtopic?: string; topic_id?: number; textbook_id?: number } = {}
        if (name !== undefined) {
            updates.subtopic = name
        }
        if (topicResult.value !== undefined) {
            updates.topic_id = topicResult.value
        }
        if (textbookResult.value !== undefined) {
            updates.textbook_id = textbookResult.value
        }

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
        }

        const { error: updateError } = await supabase
            .from('subtopics')
            .update(updates)
            .eq('subtopic_id', subtopicId)

        if (updateError) {
            console.error('Subtopic update error:', updateError)
            return NextResponse.json({ error: updateError.message }, { status: 500 })
        }

        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('Subtopic update error:', err)
        return NextResponse.json({ error: 'Failed to update subtopic' }, { status: 500 })
    }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const resolved = await params
    const subtopicId = parseSubtopicId(resolved?.id)
    if (!subtopicId) {
        return NextResponse.json({ error: 'Invalid subtopic id' }, { status: 400 })
    }

    try {
        const { error } = await supabase
            .from('subtopics')
            .delete()
            .eq('subtopic_id', subtopicId)

        if (error) {
            console.error('Subtopic delete error:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('Subtopic delete error:', err)
        return NextResponse.json({ error: 'Failed to delete subtopic' }, { status: 500 })
    }
}
