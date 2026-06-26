import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { initialCardState } from '@/lib/recall/sm2'
import type { RecallCardInput } from '@/lib/recall/types'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// Import a batch of already-built recall cards directly (e.g. the questions a
// student missed in a LearnSpace checkpoint), with no assessment "result" row.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const userId = String(body.userId ?? '').trim()
    const subject = String(body.subject ?? 'StudyLab').trim() || 'StudyLab'
    const sourceRef = body.sourceRef ? String(body.sourceRef).slice(0, 64) : null
    const cards: RecallCardInput[] = Array.isArray(body.cards)
      ? body.cards.filter((c: any) => c && typeof c.front === 'string' && typeof c.back === 'string')
      : []

    if (!UUID_RE.test(userId)) {
      return NextResponse.json({ error: 'Valid userId required' }, { status: 400 })
    }
    if (cards.length === 0) {
      return NextResponse.json({ added: 0, message: 'No cards to import' })
    }

    const deckInsert = await db.query(
      `INSERT INTO recall_decks (user_id, title, subject, source, source_ref)
       VALUES ($1, $2, $3, 'studylab', $4)
       RETURNING *`,
      [userId, `${subject} — missed in checkpoint`, subject, sourceRef]
    )
    const deck = deckInsert.rows[0]
    const init = initialCardState()

    let added = 0
    for (const card of cards) {
      await db.query(
        `INSERT INTO recall_cards (
           deck_id, user_id, front, back, hint, subject,
           ease_factor, interval_days, repetitions, due_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          deck.id,
          userId,
          card.front.slice(0, 4000),
          card.back.slice(0, 8000),
          card.hint ?? null,
          subject,
          init.ease_factor,
          init.interval_days,
          init.repetitions,
          init.due_at,
        ]
      )
      added += 1
    }

    return NextResponse.json({ deck, added, storage: 'database' })
  } catch (error: any) {
    if (String(error?.message ?? '').includes('recall_')) {
      return NextResponse.json({ fallback: true }, { status: 503 })
    }
    console.error('Recall import-cards error:', error)
    return NextResponse.json({ error: 'Failed to import cards' }, { status: 500 })
  }
}
