import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { assertSubscriptionAccess, subscriptionPaywallBody } from '@/lib/subscription-server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function missingTable(error: any): boolean {
  const msg = String(error?.message ?? '')
  return error?.code === '42P01' || /relation .* does not exist/i.test(msg) || /Could not find the table/i.test(msg)
}

// GET /api/studylab?user_id=... → list the user's LearnSpaces
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = String(searchParams.get('user_id') ?? '').trim()

    if (!userId || !UUID_RE.test(userId)) {
      return NextResponse.json({ data: [] })
    }

    const { data, error } = await supabase
      .from('learnspaces')
      .select('id,title,subject,origin,current_step,status,created_at,updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })

    if (error) {
      if (missingTable(error)) {
        return NextResponse.json({ data: [], warning: 'StudyLab tables not found. Run supabase-studylab-migration.sql.' })
      }
      console.error('LearnSpace list error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: data ?? [] })
  } catch (err) {
    console.error('LearnSpace list error:', err)
    return NextResponse.json({ error: 'Failed to load LearnSpaces' }, { status: 500 })
  }
}

// POST /api/studylab → create a LearnSpace
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const userId = String(body?.user_id ?? '').trim()
    const title = String(body?.title ?? '').trim()
    const subject = String(body?.subject ?? '').trim() || null
    const origin = body?.origin === 'gap' ? 'gap' : 'scratch'

    if (!userId || !UUID_RE.test(userId)) {
      return NextResponse.json({ error: 'A valid user_id is required' }, { status: 400 })
    }
    if (!title) {
      return NextResponse.json({ error: 'A topic/title is required' }, { status: 400 })
    }

    const gate = await assertSubscriptionAccess(userId, 'study')
    if (!gate.allowed) {
      return NextResponse.json(subscriptionPaywallBody(gate), { status: 402 })
    }

    const payload: Record<string, any> = {
      user_id: userId,
      title,
      subject,
      origin,
      canvas_state: { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } },
      current_step: 0,
      status: 'active',
    }
    if (Number.isFinite(Number(body?.textbook_id))) payload.textbook_id = Number(body.textbook_id)
    if (Number.isFinite(Number(body?.topic_id))) payload.topic_id = Number(body.topic_id)
    if (Number.isFinite(Number(body?.subtopic_id))) payload.subtopic_id = Number(body.subtopic_id)

    const { data, error } = await supabase
      .from('learnspaces')
      .insert([payload])
      .select('id,title,subject,origin,current_step,status,created_at,updated_at')
      .single()

    if (error) {
      if (missingTable(error)) {
        return NextResponse.json(
          { error: 'StudyLab tables not found. Run supabase-studylab-migration.sql in Supabase.' },
          { status: 503 }
        )
      }
      console.error('LearnSpace create error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (err) {
    console.error('LearnSpace create error:', err)
    return NextResponse.json({ error: 'Failed to create LearnSpace' }, { status: 500 })
  }
}
