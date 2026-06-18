import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function missingTable(error: any): boolean {
  const msg = String(error?.message ?? '')
  return error?.code === '42P01' || /relation .* does not exist/i.test(msg) || /Could not find the table/i.test(msg)
}

// GET /api/studylab/[id] → LearnSpace + its message transcript
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!id || !UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid LearnSpace id' }, { status: 400 })
  }

  try {
    const { data: space, error } = await supabase
      .from('learnspaces')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) {
      if (missingTable(error)) {
        return NextResponse.json(
          { error: 'StudyLab tables not found. Run supabase-studylab-migration.sql.' },
          { status: 503 }
        )
      }
      console.error('LearnSpace fetch error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!space) {
      return NextResponse.json({ error: 'LearnSpace not found' }, { status: 404 })
    }

    const { data: messages, error: msgError } = await supabase
      .from('learnspace_messages')
      .select('role,content,actions,created_at')
      .eq('learnspace_id', id)
      .order('created_at', { ascending: true })

    if (msgError) console.error('LearnSpace messages fetch error:', msgError)

    // For gap-origin spaces, resolve the focus topic/subtopic names so the
    // tutor can run a directed remediation session.
    let focus: Record<string, any> | null = null
    if ((space as any).origin === 'gap') {
      focus = {
        textbook_id: (space as any).textbook_id ?? null,
        topic_id: (space as any).topic_id ?? null,
        subtopic_id: (space as any).subtopic_id ?? null,
        topic_name: null,
        subtopic_name: null,
      }
      try {
        if (focus.topic_id) {
          const { data: t } = await supabase
            .from('topics')
            .select('topic')
            .eq('topic_id', focus.topic_id)
            .maybeSingle()
          focus.topic_name = (t as any)?.topic ?? null
        }
        if (focus.subtopic_id) {
          const { data: st } = await supabase
            .from('subtopics')
            .select('subtopic')
            .eq('subtopic_id', focus.subtopic_id)
            .maybeSingle()
          focus.subtopic_name = (st as any)?.subtopic ?? null
        }
      } catch (e) {
        console.error('Focus resolve error:', e)
      }
    }

    return NextResponse.json({ data: space, messages: messages ?? [], focus })
  } catch (err) {
    console.error('LearnSpace fetch error:', err)
    return NextResponse.json({ error: 'Failed to load LearnSpace' }, { status: 500 })
  }
}

// PUT /api/studylab/[id] → persist canvas_state / current_step / status,
// and optionally append one chat message.
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!id || !UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid LearnSpace id' }, { status: 400 })
  }

  try {
    const body = await request.json()
    const updates: Record<string, any> = { updated_at: new Date().toISOString() }
    if (body.canvas_state !== undefined) updates.canvas_state = body.canvas_state
    if (body.current_step !== undefined) updates.current_step = Number(body.current_step) || 0
    if (body.status !== undefined) updates.status = String(body.status)
    if (body.title !== undefined) updates.title = String(body.title)

    const { error } = await supabase.from('learnspaces').update(updates).eq('id', id)
    if (error) {
      if (missingTable(error)) {
        return NextResponse.json(
          { error: 'StudyLab tables not found. Run supabase-studylab-migration.sql.' },
          { status: 503 }
        )
      }
      console.error('LearnSpace update error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Append messages if provided (array of {role, content, actions?}).
    if (Array.isArray(body.messages) && body.messages.length > 0) {
      const rows = body.messages
        .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant'))
        .map((m: any) => ({
          learnspace_id: id,
          role: m.role,
          content: String(m.content ?? ''),
          actions: m.actions ?? null,
        }))
      if (rows.length > 0) {
        const { error: msgError } = await supabase.from('learnspace_messages').insert(rows)
        if (msgError) console.error('LearnSpace message insert error:', msgError)
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('LearnSpace update error:', err)
    return NextResponse.json({ error: 'Failed to update LearnSpace' }, { status: 500 })
  }
}

// DELETE /api/studylab/[id]
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!id || !UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid LearnSpace id' }, { status: 400 })
  }
  try {
    const { error } = await supabase.from('learnspaces').delete().eq('id', id)
    if (error) {
      console.error('LearnSpace delete error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('LearnSpace delete error:', err)
    return NextResponse.json({ error: 'Failed to delete LearnSpace' }, { status: 500 })
  }
}
