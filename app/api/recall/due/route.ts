import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(request: NextRequest) {
  const userId = String(request.nextUrl.searchParams.get('user_id') ?? '').trim()
  const limit = Math.min(50, Math.max(1, Number(request.nextUrl.searchParams.get('limit') ?? 30)))

  if (!UUID_RE.test(userId)) {
    return NextResponse.json({ error: 'Valid user_id required' }, { status: 400 })
  }

  try {
    const result = await db.query(
      `SELECT id, deck_id, user_id, front, back, front_image_url, front_diagram_svg,
              hint, subject, ease_factor, interval_days, repetitions, due_at,
              last_reviewed_at, created_at
       FROM recall_cards
       WHERE user_id = $1 AND due_at <= NOW()
       ORDER BY due_at ASC
       LIMIT $2`,
      [userId, limit],
    )
    return NextResponse.json({ cards: result.rows, storage: 'database' })
  } catch (error: any) {
    if (String(error?.message ?? '').includes('recall_')) {
      return NextResponse.json({ fallback: true }, { status: 503 })
    }
    console.error('Recall due error:', error)
    return NextResponse.json({ error: 'Failed to load due cards' }, { status: 500 })
  }
}
