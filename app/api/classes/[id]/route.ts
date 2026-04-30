import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

function normalizeIds(value: unknown): number[] {
    if (!Array.isArray(value)) return []
    const ids = value
        .map((v) => Number(v))
        .filter((v) => Number.isFinite(v))
    return Array.from(new Set(ids))
}

function parseClassId(rawId: string | undefined): number | null {
    const id = Number(rawId)
    return Number.isFinite(id) ? id : null
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const resolved = await params
    const classId = parseClassId(resolved?.id)
    if (!classId) {
        return NextResponse.json({ error: 'Invalid class id' }, { status: 400 })
    }

    try {
        const { data, error } = await supabase
            .from('classes')
            .select(`
        id,
        name,
        created_at,
        updated_at,
        class_textbooks (
          textbook_id,
          textbooks (
                        textbook_id,
                        textbook_name,
            curriculum,
            filename
          )
        )
      `)
            .eq('id', classId)
            .single()

        if (error) {
            console.error('Class fetch error:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        const links = Array.isArray(data?.class_textbooks) ? data.class_textbooks : []
        const textbooks = links
            .map((link: any) => link.textbooks)
            .filter(Boolean)
            .map((textbook: any) => ({
                id: textbook.textbook_id,
                name: textbook.textbook_name,
                curriculum: textbook.curriculum,
                filename: textbook.filename,
            }))
        const textbookIds = links
            .map((link: any) => link.textbook_id)
            .filter((id: any) => Number.isFinite(id))

        return NextResponse.json({
            data: {
                id: data.id,
                name: data.name,
                created_at: data.created_at,
                updated_at: data.updated_at,
                textbooks,
                textbook_ids: textbookIds,
            },
        })
    } catch (err) {
        console.error('Class fetch error:', err)
        return NextResponse.json({ error: 'Failed to load class' }, { status: 500 })
    }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const resolved = await params
    const classId = parseClassId(resolved?.id)
    if (!classId) {
        return NextResponse.json({ error: 'Invalid class id' }, { status: 400 })
    }

    try {
        const body = await request.json()
        const name = body?.name !== undefined ? String(body.name).trim() : null
        const textbookIds = body?.textbook_ids !== undefined ? normalizeIds(body.textbook_ids) : null

        if (name !== null && !name) {
            return NextResponse.json({ error: 'Class name is required' }, { status: 400 })
        }

        if (name === null && textbookIds === null) {
            return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
        }

        if (name !== null) {
            const { error: updateError } = await supabase
                .from('classes')
                .update({ name, updated_at: new Date().toISOString() })
                .eq('id', classId)

            if (updateError) {
                const status = updateError.code === '23505' ? 409 : 500
                console.error('Class update error:', updateError)
                return NextResponse.json({ error: updateError.message }, { status })
            }
        }

        if (textbookIds !== null) {
            const { error: deleteError } = await supabase
                .from('class_textbooks')
                .delete()
                .eq('class_id', classId)

            if (deleteError) {
                console.error('Class textbooks delete error:', deleteError)
                return NextResponse.json({ error: deleteError.message }, { status: 500 })
            }

            if (textbookIds.length > 0) {
                const { error: linkError } = await supabase
                    .from('class_textbooks')
                    .insert(textbookIds.map((id) => ({ class_id: classId, textbook_id: id })))

                if (linkError) {
                    console.error('Class textbooks update error:', linkError)
                    return NextResponse.json({ error: linkError.message }, { status: 500 })
                }
            }
        }

        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('Class update error:', err)
        return NextResponse.json({ error: 'Failed to update class' }, { status: 500 })
    }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const resolved = await params
    const classId = parseClassId(resolved?.id)
    if (!classId) {
        return NextResponse.json({ error: 'Invalid class id' }, { status: 400 })
    }

    try {
        const { error } = await supabase
            .from('classes')
            .delete()
            .eq('id', classId)

        if (error) {
            console.error('Class delete error:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('Class delete error:', err)
        return NextResponse.json({ error: 'Failed to delete class' }, { status: 500 })
    }
}
