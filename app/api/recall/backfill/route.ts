import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { buildMissedRecallCards } from '@/lib/recall/build-missed-cards'
import { initialCardState } from '@/lib/recall/sm2'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// POST /api/recall/backfill { userId } — pull missed items from every past
// assessment result that doesn't yet have a recall deck, so Recall stays fed
// from the student's real work. Idempotent: a result is skipped once it has a
// deck (matched on source_ref), so this is safe to call on every Recall open.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const userId = String(body.userId ?? '').trim()
    if (!UUID_RE.test(userId)) {
      return NextResponse.json({ error: 'Valid userId required' }, { status: 400 })
    }

    const pending = await db.query(
      `SELECT r.id, r.questions_data, r.answers, a.subject AS assessment_subject
         FROM results r
         LEFT JOIN assessments a ON a.id = r.assessment_id
        WHERE r.user_id = $1
          AND NOT EXISTS (
            SELECT 1 FROM recall_decks d
             WHERE d.user_id = $1 AND d.source = 'assessment' AND d.source_ref = r.id::text
          )
        ORDER BY r.created_at DESC
        LIMIT 40`,
      [userId]
    )

    const init = initialCardState()
    let decksAdded = 0
    let cardsAdded = 0

    for (const row of pending.rows) {
      const questions = Array.isArray(row.questions_data) ? row.questions_data : []
      const answers = row.answers && typeof row.answers === 'object' ? row.answers : {}
      const subject = String(row.assessment_subject ?? 'Assessment')
      const missed = buildMissedRecallCards(questions, answers, subject)
      if (missed.length === 0) continue

      const deckInsert = await db.query(
        `INSERT INTO recall_decks (user_id, title, subject, source, source_ref)
         VALUES ($1, $2, $3, 'assessment', $4) RETURNING id`,
        [userId, `${subject} — missed items`, subject, String(row.id)]
      )
      const deckId = deckInsert.rows[0].id
      decksAdded += 1

      for (const card of missed) {
        await db.query(
          `INSERT INTO recall_cards (
             deck_id, user_id, front, back, front_image_url, front_diagram_svg,
             hint, subject, ease_factor, interval_days, repetitions, due_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [
            deckId,
            userId,
            card.front.slice(0, 4000),
            card.back.slice(0, 8000),
            card.front_image_url ?? null,
            card.front_diagram_svg ?? null,
            card.hint ?? null,
            subject,
            init.ease_factor,
            init.interval_days,
            init.repetitions,
            init.due_at,
          ]
        )
        cardsAdded += 1
      }
    }

    return NextResponse.json({ decksAdded, cardsAdded })
  } catch (error: any) {
    if (String(error?.message ?? '').includes('recall_')) {
      return NextResponse.json({ fallback: true }, { status: 503 })
    }
    console.error('Recall backfill error:', error)
    return NextResponse.json({ error: 'Failed to backfill recall' }, { status: 500 })
  }
}
