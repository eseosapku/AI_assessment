import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * The two signals the dashboard cannot work out for itself.
 *
 * `dueCards` is a count the Recall page already owns but never surfaced
 * anywhere a student would see it — it sat four items down the menu.
 *
 * `studiedNotProven` is the important one: topics where a lesson was built and
 * no quiz has been taken since. That is a student who did the work and was
 * never told whether it landed, and closing that loop is the single most
 * motivating thing the product can offer.
 */
export async function GET(request: NextRequest) {
  const userId = String(request.nextUrl.searchParams.get('user_id') ?? '').trim()
  if (!UUID_RE.test(userId)) {
    return NextResponse.json({ error: 'Valid user_id required' }, { status: 400 })
  }

  let dueCards = 0
  let studiedNotProven: Array<{ label: string; subjectName: string; subtopic_id: number | null; topic_id: number | null }> = []

  // Each signal is optional. A dashboard that 500s because one table is missing
  // is worse than a dashboard offering one fewer suggestion.
  try {
    const res = await db.query(
      `SELECT COUNT(*)::int AS c FROM recall_cards WHERE user_id = $1 AND due_at <= NOW()`,
      [userId],
    )
    dueCards = Number(res.rows?.[0]?.c ?? 0)
  } catch {
    dueCards = 0
  }

  try {
    // A lesson built from a gap, with no assessment covering that subtopic
    // started after it. Oldest first: the longest-unproven study is the one
    // most likely to have been forgotten.
    const res = await db.query(
      `SELECT l.id, l.title, l.subject, l.topic_id, l.subtopic_id, l.created_at
         FROM learnspaces l
        WHERE l.user_id = $1
          AND l.origin = 'gap'
          AND l.subtopic_id IS NOT NULL
          AND NOT EXISTS (
                SELECT 1 FROM assessments a
                 WHERE a.user_id = l.user_id
                   AND a.created_at > l.created_at
                   AND a.subtopic_ids @> ARRAY[l.subtopic_id]::int[]
              )
        ORDER BY l.created_at ASC
        LIMIT 5`,
      [userId],
    )
    studiedNotProven = (res.rows ?? []).map((r: any) => ({
      // Lessons from a gap are titled "Mastering <topic>"; the student thinks
      // of it as the topic, not as the lesson's name.
      label: String(r.title ?? '').replace(/^Mastering\s+/i, '').trim() || String(r.subject ?? 'this topic'),
      subjectName: String(r.subject ?? ''),
      topic_id: Number.isFinite(Number(r.topic_id)) ? Number(r.topic_id) : null,
      subtopic_id: Number.isFinite(Number(r.subtopic_id)) ? Number(r.subtopic_id) : null,
    }))
  } catch {
    studiedNotProven = []
  }

  return NextResponse.json({ data: { dueCards, studiedNotProven } })
}
