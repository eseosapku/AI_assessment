import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { normalizeCountry } from '@/lib/countries'

function normalizeIds(value: unknown): number[] {
    if (!Array.isArray(value)) return []
    const ids = value
        .map((v) => Number(v))
        .filter((v) => Number.isFinite(v))
    return Array.from(new Set(ids))
}

export async function GET(request: NextRequest) {
    try {
        const country = normalizeCountry(request.nextUrl.searchParams.get('country') ?? 'RW')

        let query = supabase
            .from('classes')
            .select(`
        id,
        name,
        country,
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
            .order('name')

        if (country === 'NG') {
            query = query.eq('country', 'NG')
        } else {
            query = query.or('country.eq.RW,country.is.null')
        }

        const { data, error } = await query

        if (error) {
            console.error('Classes fetch error:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        const classes = (data ?? []).map((row: any) => {
            const links = Array.isArray(row.class_textbooks) ? row.class_textbooks : []
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

            return {
                id: row.id,
                name: row.name,
                country: row.country ?? 'RW',
                created_at: row.created_at,
                updated_at: row.updated_at,
                textbooks,
                textbook_ids: textbookIds,
            }
        })

        return NextResponse.json({ data: classes })
    } catch (err) {
        console.error('Classes fetch error:', err)
        return NextResponse.json({ error: 'Failed to load classes' }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const name = String(body?.name ?? '').trim()
        const textbookIds = normalizeIds(body?.textbook_ids)

        if (!name) {
            return NextResponse.json({ error: 'Class name is required' }, { status: 400 })
        }

        const country = normalizeCountry(body?.country ?? 'RW')

        const { data: created, error: createError } = await supabase
            .from('classes')
            .insert({ name, country })
            .select('id,name,country,created_at,updated_at')
            .single()

        if (createError) {
            const status = createError.code === '23505' ? 409 : 500
            console.error('Class create error:', createError)
            return NextResponse.json({ error: createError.message }, { status })
        }

        if (textbookIds.length > 0) {
            const { error: linkError } = await supabase
                .from('class_textbooks')
                .insert(textbookIds.map((id) => ({ class_id: created.id, textbook_id: id })))

            if (linkError) {
                console.error('Class textbook link error:', linkError)
                return NextResponse.json({ error: linkError.message }, { status: 500 })
            }
        }

        return NextResponse.json({
            data: {
                id: created.id,
                name: created.name,
                country: created.country ?? country,
                created_at: created.created_at,
                updated_at: created.updated_at,
                textbook_ids: textbookIds,
            },
        })
    } catch (err) {
        console.error('Class create error:', err)
        return NextResponse.json({ error: 'Failed to create class' }, { status: 500 })
    }
}
