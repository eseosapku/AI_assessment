import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(request: NextRequest) {
  try {
    const userId = String(request.nextUrl.searchParams.get('user_id') ?? '').trim()
    if (!userId || !UUID_RE.test(userId)) {
      return NextResponse.json({ error: 'A valid user_id is required' }, { status: 400 })
    }

    const result = await db.query(
      `SELECT r.*,
              a.subject AS assessment_subject,
              a.difficulty AS assessment_difficulty
       FROM results r
       LEFT JOIN assessments a ON a.id = r.assessment_id
       WHERE r.user_id = $1
       ORDER BY r.created_at DESC`,
      [userId],
    )

    const data = result.rows.map((row: any) => ({
      ...row,
      assessments: {
        subject: row.assessment_subject,
        difficulty: row.assessment_difficulty,
        topics: [],
      },
    }))

    return NextResponse.json({ data })
  } catch (err) {
    console.error('Results list fetch error:', err)
    return NextResponse.json({ error: 'Failed to load results' }, { status: 500 })
  }
}
