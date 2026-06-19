import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: resultId } = await params
    if (!resultId || !UUID_RE.test(resultId)) {
      return NextResponse.json({ error: 'A valid result id is required' }, { status: 400 })
    }

    const userId = request.nextUrl.searchParams.get('user_id')
    const isTeacher = request.nextUrl.searchParams.get('teacher') === '1'

    let query = `
      SELECT r.*,
             a.subject AS assessment_subject,
             a.difficulty AS assessment_difficulty,
             a.questions_data AS assessment_questions_data
      FROM results r
      LEFT JOIN assessments a ON a.id = r.assessment_id
      WHERE r.id = $1
    `
    const values: unknown[] = [resultId]

    if (!isTeacher && userId && UUID_RE.test(userId)) {
      query += ` AND r.user_id = $2`
      values.push(userId)
    }

    query += ` LIMIT 1`

    const result = await db.query(query, values)
    const row = result.rows[0]

    if (!row) {
      return NextResponse.json({ error: 'Result not found' }, { status: 404 })
    }

    const data = {
      ...row,
      assessments: {
        subject: row.assessment_subject,
        difficulty: row.assessment_difficulty,
        questions_data: row.assessment_questions_data,
      },
    }

    return NextResponse.json({ data })
  } catch (err) {
    console.error('Result fetch error:', err)
    return NextResponse.json({ error: 'Failed to load result' }, { status: 500 })
  }
}
