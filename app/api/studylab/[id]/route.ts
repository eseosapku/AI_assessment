import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isMissingTable } from '@/lib/pg-errors'
import { jsonbParam } from '@/lib/pg-json'
import { policyFor } from '@/lib/studylab/lessonPolicy'
import { runFromLegacy } from '@/lib/studylab/lessonRunMigrate'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Whose lesson this is. Every handler here looked a LearnSpace up by its id
 * alone, and a student's ids are listed by GET /api/studylab?user_id=, so
 * anyone holding a student's user id could read, overwrite or delete their
 * lessons. A request must now name the owner, and a lesson that is not theirs
 * reads as not found.
 *
 * This is the app's own trust model -- the caller's user id, as every route
 * here takes it -- not a session check; that needs login to issue tokens.
 */
function ownerOf(value: unknown): string | null {
  const id = String(value ?? '').trim()
  return UUID_RE.test(id) ? id : null
}

const NOT_FOUND = () => NextResponse.json({ error: 'LearnSpace not found' }, { status: 404 })
const NO_OWNER = () => NextResponse.json({ error: 'Sign in again to open this LearnSpace.' }, { status: 401 })
const TABLES_MISSING = () =>
  NextResponse.json({ error: 'StudyLab tables not found. Run migrations/full-platform-schema.sql on RDS.' }, { status: 503 })

// GET /api/studylab/[id]?user_id= → LearnSpace + its message transcript
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!id || !UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid LearnSpace id' }, { status: 400 })
  }
  const owner = ownerOf(request.nextUrl.searchParams.get('user_id'))
  if (!owner) return NO_OWNER()

  try {
    let space: any
    try {
      const spaceResult = await db.query('SELECT * FROM learnspaces WHERE id = $1 AND user_id::text = $2 LIMIT 1', [id, owner])
      space = spaceResult.rows[0]
    } catch (error) {
      if (isMissingTable(error)) return TABLES_MISSING()
      console.error('LearnSpace fetch error:', error)
      return NextResponse.json({ error: 'Failed to load LearnSpace' }, { status: 500 })
    }

    if (!space) return NOT_FOUND()

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

    // Rows saved before runs existed derive one here rather than in a batch
    // job: no downtime, and a lesson nobody opens again costs nothing. The
    // derived run is written back on the next save, so each space converts once.
    const policy = policyFor(space.origin)
    const lessonRun =
      space.lesson_run ??
      runFromLegacy(
        {
          plan: space.canvas_state?.plan ?? null,
          currentStep: space.current_step,
          status: space.status,
        },
        policy,
      )

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

    return NextResponse.json({ data: space, messages, focus, lesson_run: lessonRun })
  } catch (err) {
    console.error('LearnSpace fetch error:', err)
    return NextResponse.json({ error: 'Failed to load LearnSpace' }, { status: 500 })
  }
}

// PUT /api/studylab/[id] → persist canvas_state / current_step / status / title,
// and optionally append chat messages. One statement, so the save and its
// messages land together or not at all: they were separate, and a failed
// message insert was only logged while the route reported success.
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!id || !UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid LearnSpace id' }, { status: 400 })
  }

  try {
    const body = await request.json()
    const owner = ownerOf(body?.user_id)
    if (!owner) return NO_OWNER()

    const sets = ['updated_at = NOW()']
    const values: unknown[] = []
    let idx = 1

    if (body.canvas_state !== undefined) {
      sets.push(`canvas_state = $${idx++}::jsonb`)
      values.push(jsonbParam(body.canvas_state))
    }
    if (body.lesson_run !== undefined) {
      sets.push(`lesson_run = $${idx++}::jsonb`)
      values.push(jsonbParam(body.lesson_run))
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
      values.push(String(body.title).slice(0, 200))
    }

    const messages = (Array.isArray(body.messages) ? body.messages : [])
      .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant'))
      .map((m: any) => ({ role: m.role, content: String(m.content ?? ''), actions: m.actions ?? null }))

    const idParam = idx++
    const ownerParam = idx++
    values.push(id, owner)
    const update = `UPDATE learnspaces SET ${sets.join(', ')} WHERE id = $${idParam} AND user_id::text = $${ownerParam} RETURNING id`

    let updated = 0
    try {
      if (messages.length === 0) {
        const res = await db.query(update, values)
        updated = res.rowCount ?? res.rows.length
      } else {
        // In order: each message a millisecond after the one before, since the
        // transcript is read back by created_at and these share one NOW().
        values.push(JSON.stringify(messages))
        const res = await db.query(
          `WITH upd AS (${update}),
                ins AS (
                  INSERT INTO learnspace_messages (learnspace_id, role, content, actions, created_at)
                  SELECT upd.id, m.elem->>'role', COALESCE(m.elem->>'content', ''), m.elem->'actions',
                         NOW() + (m.ord * interval '1 millisecond')
                    FROM upd, jsonb_array_elements($${idx}::jsonb) WITH ORDINALITY AS m(elem, ord)
                  RETURNING 1
                )
           SELECT (SELECT COUNT(*) FROM upd)::int AS updated, (SELECT COUNT(*) FROM ins)::int AS inserted`,
          values,
        )
        updated = Number(res.rows[0]?.updated ?? 0)
      }
    } catch (error) {
      if (isMissingTable(error)) return TABLES_MISSING()
      console.error('LearnSpace update error:', error)
      return NextResponse.json({ error: 'Failed to save LearnSpace' }, { status: 500 })
    }

    if (!updated) return NOT_FOUND()
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('LearnSpace update error:', err)
    return NextResponse.json({ error: 'Failed to save LearnSpace' }, { status: 500 })
  }
}

// DELETE /api/studylab/[id]?user_id=
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!id || !UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid LearnSpace id' }, { status: 400 })
  }
  const owner = ownerOf(request.nextUrl.searchParams.get('user_id'))
  if (!owner) return NO_OWNER()
  try {
    const res = await db.query('DELETE FROM learnspaces WHERE id = $1 AND user_id::text = $2', [id, owner])
    if (!(res.rowCount ?? 0)) return NOT_FOUND()
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('LearnSpace delete error:', err)
    return NextResponse.json({ error: 'Failed to delete LearnSpace' }, { status: 500 })
  }
}
