import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { pgErrorMessage } from '@/lib/pg-errors'
import { lostMarksFrom } from '@/lib/studylab/lost-marks'

// Same pattern as the gap-map route (a route file may export only handlers, so it is repeated here).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams
  const userId = p.get('user_id')
  const topicId = Number(p.get('topic_id'))
  if (!userId || !UUID_RE.test(userId)) return NextResponse.json({ error: 'A valid user_id is required' }, { status: 400 })
  if (!Number.isInteger(topicId) || topicId <= 0) return NextResponse.json({ error: 'A valid topic_id is required' }, { status: 400 })
  const subtopicIds = (p.get('subtopic_ids') || '').split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 60)
  try {
    const { rows } = await db.query(
      'SELECT answers, questions_data FROM results WHERE user_id = $1 AND questions_data IS NOT NULL ORDER BY created_at DESC LIMIT 40',
      [userId],
    )
    return NextResponse.json({ data: lostMarksFrom(rows, { subtopicIds, topicId }) })
  } catch (e) {
    return NextResponse.json({ error: pgErrorMessage(e) }, { status: 500 })
  }
}
