import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isMissingTable, pgErrorMessage } from '@/lib/pg-errors'
import { jsonbParam } from '@/lib/pg-json'
import { assertSubscriptionAccess, subscriptionPaywallBody } from '@/lib/subscription-server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// GET /api/studylab?user_id=... → list the user's LearnSpaces
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = String(searchParams.get('user_id') ?? '').trim()

    if (!userId || !UUID_RE.test(userId)) {
      return NextResponse.json({ data: [] })
    }

    try {
      const result = await db.query(
        // The thumbnail is pulled only for homework rows. It is the one column
        // that could be large, and it is the only origin that has one — reading
        // every space's whole canvas to find out would cost the grid its speed
        // for nothing.
        //
        // Of the run, only where the lesson stands: step titles and statuses, never
        // a step's goal or a homework question's answer. A run with no steps array
        // must not fail the whole list.
        `SELECT id, title, subject, origin, current_step, status, created_at, updated_at,
                CASE WHEN origin = 'homework' THEN canvas_state->>'thumb' END AS thumb,
                lesson_run->>'phase' AS phase,
                lesson_run->'currentStep' AS step_index,
                (SELECT jsonb_agg(jsonb_build_object('title', step->>'title', 'status', step->>'status') ORDER BY place)
                   FROM jsonb_array_elements(
                     CASE WHEN jsonb_typeof(lesson_run->'steps') = 'array' THEN lesson_run->'steps' ELSE '[]'::jsonb END
                   ) WITH ORDINALITY AS listed(step, place)) AS steps
         FROM learnspaces WHERE user_id = $1 ORDER BY updated_at DESC`,
        [userId]
      )
      return NextResponse.json({ data: result.rows ?? [] })
    } catch (error) {
      if (isMissingTable(error)) {
        return NextResponse.json({ data: [], warning: 'StudyLab tables not found. Run migrations/full-platform-schema.sql on RDS.' })
      }
      console.error('LearnSpace list error:', error)
      return NextResponse.json({ error: pgErrorMessage(error) }, { status: 500 })
    }
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
    // Every origin the policy knows about. 'homework' was missing, so the
    // homework modal's spaces were all stored as 'scratch' — which meant the
    // homework policy had never applied to anything, and the branch that hands
    // a photo to the lesson had never once run. A LearnSpace opened from a
    // homework photo was, in the database, indistinguishable from one somebody
    // typed a topic into.
    const origin =
      body?.origin === 'gap' ? 'gap' : body?.origin === 'homework' ? 'homework' : 'scratch'

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

    const columns = ['user_id', 'title', 'subject', 'origin', 'canvas_state', 'current_step', 'status']
    const values: unknown[] = [
      userId,
      title,
      subject,
      origin,
      jsonbParam({ nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } }),
      0,
      'active',
    ]

    // Which tutor teaches this space, fixed when it is created. The space owns
    // it, not the request that happens to be running — a later turn reads it
    // back off this row, so nothing a client sends mid-lesson can switch a
    // lesson's mode out from under it.
    //
    // Montessori is built but unfinished, so the product does not create
    // spaces in it. The LearnSpace page offers no choice; this stops a request
    // that asks for it anyway, because a missing control is a product decision
    // and not a guard. Existing montessori spaces are untouched — they read
    // their mode back off their own row.
    //
    // Phase 2 lifts this, and gives the page's question a way to choose.
    const OFFER_MONTESSORI = false
    if (OFFER_MONTESSORI && body?.mode === 'montessori') {
      columns.push('mode')
      values.push('montessori')
    }

    if (Number.isFinite(Number(body?.textbook_id))) {
      columns.push('textbook_id')
      values.push(Number(body.textbook_id))
    }
    if (Number.isFinite(Number(body?.topic_id))) {
      columns.push('topic_id')
      values.push(Number(body.topic_id))
    }
    if (Number.isFinite(Number(body?.subtopic_id))) {
      columns.push('subtopic_id')
      values.push(Number(body.subtopic_id))
    }

    const jsonColumns = new Set(['canvas_state'])
    const placeholders = columns
      .map((col, i) => (jsonColumns.has(col) ? `$${i + 1}::jsonb` : `$${i + 1}`))
      .join(', ')

    try {
      const result = await db.query(
        `INSERT INTO learnspaces (${columns.join(', ')})
         VALUES (${placeholders})
         RETURNING id, title, subject, origin, current_step, status, created_at, updated_at`,
        values
      )
      return NextResponse.json({ data: result.rows[0] })
    } catch (error) {
      if (isMissingTable(error)) {
        return NextResponse.json(
          { error: 'StudyLab tables not found. Run migrations/full-platform-schema.sql on RDS.' },
          { status: 503 }
        )
      }
      console.error('LearnSpace create error:', error)
      return NextResponse.json({ error: pgErrorMessage(error) }, { status: 500 })
    }
  } catch (err) {
    console.error('LearnSpace create error:', err)
    return NextResponse.json({ error: 'Failed to create LearnSpace' }, { status: 500 })
  }
}
