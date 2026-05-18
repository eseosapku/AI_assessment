import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

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

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const curriculumParam = searchParams.get('curriculum')

        let query = supabase
            .from('textbooks')
            .select('textbook_id,textbook_name,filename,curriculum')
            .order('textbook_name')

        if (curriculumParam !== null && curriculumParam !== '') {
            const curriculum = Number(curriculumParam)
            if (!Number.isFinite(curriculum)) {
                return NextResponse.json({ error: 'Invalid curriculum' }, { status: 400 })
            }
            query = query.eq('curriculum', curriculum)
        }

        const { data, error } = await query
        if (error) {
            console.error('Textbooks fetch error:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        const normalized = (data ?? []).map((row: any) => ({
            id: row.textbook_id,
            name: row.textbook_name,
            filename: row.filename,
            curriculum: row.curriculum,
        }))

        return NextResponse.json({ data: normalized })
    } catch (err) {
        console.error('Textbooks fetch error:', err)
        return NextResponse.json({ error: 'Failed to load textbooks' }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const name = String(body?.name ?? body?.textbook_name ?? '').trim()
        const filenameResult = parseOptionalString(body?.filename)
        const curriculumResult = parseOptionalNumber(body?.curriculum, 'curriculum')

        if (!name) {
            return NextResponse.json({ error: 'Textbook name is required' }, { status: 400 })
        }
        if (curriculumResult.error) {
            return NextResponse.json({ error: curriculumResult.error }, { status: 400 })
        }

        const payload: {
            textbook_name: string
            filename?: string | null
            curriculum?: number | null
        } = {
            textbook_name: name,
        }

        if (filenameResult.value !== undefined) {
            payload.filename = filenameResult.value
        }
        if (curriculumResult.value !== undefined) {
            payload.curriculum = curriculumResult.value
        }

        const { data: created, error: createError } = await supabase
            .from('textbooks')
            .insert(payload)
            .select('textbook_id,textbook_name,filename,curriculum')
            .single()

        if (createError) {
            const status = createError.code === '23505' ? 409 : 500
            console.error('Textbook create error:', createError)
            return NextResponse.json({ error: createError.message }, { status })
        }

        return NextResponse.json({
            data: {
                id: created.textbook_id,
                name: created.textbook_name,
                filename: created.filename,
                curriculum: created.curriculum,
            },
        })
    } catch (err) {
        console.error('Textbook create error:', err)
        return NextResponse.json({ error: 'Failed to create textbook' }, { status: 500 })
    }
}
