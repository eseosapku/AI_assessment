import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

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
