import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { deriveQuizAgainParams, canQuizAgain } from '@/lib/quiz-again'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * The parameters for "another one like that".
 *
 * Reads them back off a finished assessment rather than asking the student to
 * walk the nine-step wizard again for a quiz of the same shape. Returns the
 * parameters only — generating is the caller's job, so this stays cheap and
 * the existing generation path keeps its single entry point.
 */
export async function GET(request: NextRequest) {
  const resultId = String(request.nextUrl.searchParams.get('result_id') ?? '').trim()
  if (!UUID_RE.test(resultId)) {
    return NextResponse.json({ error: 'Valid result_id required' }, { status: 400 })
  }

  try {
    const res = await db.query(
      `SELECT a.subject, a.difficulty, a.textbook_id, a.topic_ids, a.subtopic_ids, a.duration,
              r.questions_data
         FROM results r
         JOIN assessments a ON a.id = r.assessment_id
        WHERE r.id = $1
        LIMIT 1`,
      [resultId],
    )
    const row = res.rows?.[0]
    if (!row) {
      // A result with no assessment behind it — an assignment, or an older row.
      return NextResponse.json({ data: null })
    }

    const params = deriveQuizAgainParams(row, row.questions_data)
    return NextResponse.json({
      data: canQuizAgain(params) ? params : null,
    })
  } catch (error: any) {
    console.error('quiz-again lookup failed:', error)
    // The button simply does not appear; nothing here is worth a failed page.
    return NextResponse.json({ data: null })
  }
}
