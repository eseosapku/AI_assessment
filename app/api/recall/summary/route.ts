import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(request: NextRequest) {
  const userId = String(request.nextUrl.searchParams.get('user_id') ?? '').trim()
  if (!UUID_RE.test(userId)) {
    return NextResponse.json({ error: 'Valid user_id required' }, { status: 400 })
  }

  try {
    const dueRes = await db.query(
      `SELECT COUNT(*)::int AS c FROM recall_cards WHERE user_id = $1 AND due_at <= NOW()`,
      [userId],
    )
    const totalRes = await db.query(
      `SELECT COUNT(*)::int AS c FROM recall_cards WHERE user_id = $1`,
      [userId],
    )
    const decksRes = await db.query(
      `SELECT d.id, d.user_id, d.title, d.subject, d.created_at,
              COUNT(c.id)::int AS card_count,
              COUNT(c.id) FILTER (WHERE c.due_at <= NOW())::int AS due_count
       FROM recall_decks d
       LEFT JOIN recall_cards c ON c.deck_id = d.id
       WHERE d.user_id = $1
       GROUP BY d.id
       ORDER BY d.created_at DESC`,
      [userId],
    )

    return NextResponse.json({
      due_today: dueRes.rows[0]?.c ?? 0,
      total_cards: totalRes.rows[0]?.c ?? 0,
      decks: decksRes.rows,
      storage: 'database',
    })
  } catch (error: any) {
    if (String(error?.message ?? '').includes('recall_')) {
      return NextResponse.json({ fallback: true, error: 'Recall tables not migrated' }, { status: 503 })
    }
    console.error('Recall summary error:', error)
    return NextResponse.json({ error: 'Failed to load recall summary' }, { status: 500 })
  }
}
