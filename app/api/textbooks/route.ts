import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

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
