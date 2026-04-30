import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

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
