import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

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
        const { data, error } = await supabase
            .from('textbooks')
            .select('textbook_id,textbook_name,filename,curriculum')
            .eq('textbook_id', textbookId)
            .single()

        if (error) {
            console.error('Textbook fetch error:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
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
        return NextResponse.json({ error: 'Failed to load textbook' }, { status: 500 })
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

        const updates: {
            textbook_name?: string
            filename?: string | null
            curriculum?: number | null
        } = {}

        if (name !== undefined) {
            updates.textbook_name = name
        }
        if (filenameResult.value !== undefined) {
            updates.filename = filenameResult.value
        }
        if (curriculumResult.value !== undefined) {
            updates.curriculum = curriculumResult.value
        }

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
        }

        const { error: updateError } = await supabase
            .from('textbooks')
            .update(updates)
            .eq('textbook_id', textbookId)

        if (updateError) {
            const status = updateError.code === '23505' ? 409 : 500
            console.error('Textbook update error:', updateError)
            return NextResponse.json({ error: updateError.message }, { status })
        }

        return NextResponse.json({ success: true })
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
        const { error: subtopicsError } = await supabase
            .from('subtopics')
            .delete()
            .eq('textbook_id', textbookId)

        if (subtopicsError) {
            console.error('Subtopics delete error:', subtopicsError)
            return NextResponse.json({ error: subtopicsError.message }, { status: 500 })
        }

        const { error: topicsError } = await supabase
            .from('topics')
            .delete()
            .eq('textbook_id', textbookId)

        if (topicsError) {
            console.error('Topics delete error:', topicsError)
            return NextResponse.json({ error: topicsError.message }, { status: 500 })
        }

        const { error: textbookError } = await supabase
            .from('textbooks')
            .delete()
            .eq('textbook_id', textbookId)

        if (textbookError) {
            console.error('Textbook delete error:', textbookError)
            return NextResponse.json({ error: textbookError.message }, { status: 500 })
        }

        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('Textbook delete error:', err)
        return NextResponse.json({ error: 'Failed to delete textbook' }, { status: 500 })
    }
}
