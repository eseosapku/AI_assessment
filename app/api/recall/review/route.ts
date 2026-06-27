import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { scheduleReview, type RecallRating } from '@/lib/recall/sm2'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const userId = String(body.userId ?? '').trim()
    const cardId = String(body.cardId ?? '').trim()
    const rating = Number(body.rating) as RecallRating

    if (!UUID_RE.test(userId) || !UUID_RE.test(cardId)) {
      return NextResponse.json({ error: 'Valid userId and cardId required' }, { status: 400 })
    }
    if (![1, 2, 3, 4].includes(rating)) {
      return NextResponse.json({ error: 'Rating must be 1–4' }, { status: 400 })
    }

    const existing = await db.query(
      `SELECT ease_factor, interval_days, repetitions, due_at FROM recall_cards WHERE id = $1 AND user_id = $2 LIMIT 1`,
      [cardId, userId],
    )
    const row = existing.rows[0]
    if (!row) return NextResponse.json({ error: 'Card not found' }, { status: 404 })

    const next = scheduleReview(
      {
        ease_factor: Number(row.ease_factor),
        interval_days: Number(row.interval_days),
        repetitions: Number(row.repetitions),
        due_at: row.due_at,
      },
      rating,
    )

    const updated = await db.query(
      `UPDATE recall_cards
       SET ease_factor = $1, interval_days = $2, repetitions = $3, due_at = $4, last_reviewed_at = NOW()
       WHERE id = $5 AND user_id = $6
       RETURNING *`,
      [next.ease_factor, next.interval_days, next.repetitions, next.due_at, cardId, userId],
    )

    return NextResponse.json({ card: updated.rows[0] })
  } catch (error: any) {
    if (String(error?.message ?? '').includes('recall_')) {
      return NextResponse.json({ fallback: true }, { status: 503 })
    }
    console.error('Recall review error:', error)
    return NextResponse.json({ error: 'Failed to save review' }, { status: 500 })
  }
}
