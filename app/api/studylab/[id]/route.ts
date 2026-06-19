import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isMissingTable, pgErrorMessage } from '@/lib/pg-errors'
import { jsonbParam } from '@/lib/pg-json'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// GET /api/studylab/[id] → LearnSpace + its message transcript
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!id || !UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid LearnSpace id' }, { status: 400 })
  }

  try {
    let space: any
    try {
      const spaceResult = await db.query('SELECT * FROM learnspaces WHERE id = $1 LIMIT 1', [id])
      space = spaceResult.rows[0]
    } catch (error) {
      if (isMissingTable(error)) {
        return NextResponse.json(
          { error: 'StudyLab tables not found. Run migrations/full-platform-schema.sql on RDS.' },
          { status: 503 }
        )
      }
      console.error('LearnSpace fetch error:', error)
      return NextResponse.json({ error: pgErrorMessage(error) }, { status: 500 })
    }

    if (!space) {
      return NextResponse.json({ error: 'LearnSpace not found' }, { status: 404 })
    }

    let messages: any[] = []
    try {
      const msgResult = await db.query(
        `SELECT role, content, actions, created_at FROM learnspace_messages
         WHERE learnspace_id = $1 ORDER BY created_at ASC`,
        [id]
      )
      messages = msgResult.rows ?? []
    } catch (msgError) {
      console.error('LearnSpace messages fetch error:', msgError)
    }

    let focus: Record<string, any> | null = null
    if (space.origin === 'gap') {
      focus = {
        textbook_id: space.textbook_id ?? null,
        topic_id: space.topic_id ?? null,
        subtopic_id: space.subtopic_id ?? null,
        topic_name: null,
        subtopic_name: null,
      }
      try {
        if (focus.topic_id) {
          const tResult = await db.query('SELECT topic FROM topics WHERE topic_id = $1 LIMIT 1', [focus.topic_id])
          focus.topic_name = tResult.rows[0]?.topic ?? null
        }
        if (focus.subtopic_id) {
          const stResult = await db.query('SELECT subtopic FROM subtopics WHERE subtopic_id = $1 LIMIT 1', [focus.subtopic_id])
          focus.subtopic_name = stResult.rows[0]?.subtopic ?? null
        }
      } catch (e) {
        console.error('Focus resolve error:', e)
      }
    }

    return NextResponse.json({ data: space, messages, focus })
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
    const sets = ['updated_at = NOW()']
    const values: unknown[] = []
    let idx = 1

    if (body.canvas_state !== undefined) {
      sets.push(`canvas_state = $${idx++}::jsonb`)
      values.push(jsonbParam(body.canvas_state))
    }
    if (body.current_step !== undefined) {
      sets.push(`current_step = $${idx++}`)
      values.push(Number(body.current_step) || 0)
    }
    if (body.status !== undefined) {
      sets.push(`status = $${idx++}`)
      values.push(String(body.status))
    }
    if (body.title !== undefined) {
      sets.push(`title = $${idx++}`)
      values.push(String(body.title))
    }

    values.push(id)

    try {
      await db.query(`UPDATE learnspaces SET ${sets.join(', ')} WHERE id = $${idx}`, values)
    } catch (error) {
      if (isMissingTable(error)) {
        return NextResponse.json(
          { error: 'StudyLab tables not found. Run migrations/full-platform-schema.sql on RDS.' },
          { status: 503 }
        )
      }
      console.error('LearnSpace update error:', error)
      return NextResponse.json({ error: pgErrorMessage(error) }, { status: 500 })
    }

    if (Array.isArray(body.messages) && body.messages.length > 0) {
      const rows = body.messages
        .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant'))
        .map((m: any) => ({
          learnspace_id: id,
          role: m.role,
          content: String(m.content ?? ''),
          actions: m.actions ?? null,
        }))
      for (const row of rows) {
        try {
          await db.query(
            `INSERT INTO learnspace_messages (learnspace_id, role, content, actions)
             VALUES ($1, $2, $3, $4::jsonb)`,
            [row.learnspace_id, row.role, row.content, jsonbParam(row.actions)]
          )
        } catch (msgError) {
          console.error('LearnSpace message insert error:', msgError)
        }
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
    await db.query('DELETE FROM learnspaces WHERE id = $1', [id])
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('LearnSpace delete error:', err)
    return NextResponse.json({ error: pgErrorMessage(err, 'Failed to delete LearnSpace') }, { status: 500 })
  }
}
