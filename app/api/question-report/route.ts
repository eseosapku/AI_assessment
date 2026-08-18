import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isMissingColumn } from '@/lib/pg-errors'
import { jsonbParam } from '@/lib/pg-json'
import { validateReport, normalizeDetail, questionSnapshot } from '@/lib/question-report'

/**
 * Record a student's report about a question, or a challenge to a mark.
 *
 * Deliberately forgiving about who is reporting: a report with no user id is
 * still a useful signal about generation quality, and refusing it would lose
 * exactly the feedback this exists to collect.
 *
 * Degrades to a no-op when the table is absent (migration not yet run) rather
 * than 500ing, so the button never appears broken to a student trying to help.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const asUuid = (v: unknown): string | null => {
  const s = String(v ?? '').trim()
  return UUID_RE.test(s) ? s : null
}

function isMissingTable(err: unknown): boolean {
  // 42P01 = undefined_table
  return (err as { code?: string })?.code === '42P01' || isMissingColumn(err)
}

/**
 * Read the queue.
 *
 * Reports were landing in a table nobody could read without SQL, which meant
 * the cheapest quality signal in the product was accumulating unseen.
 */
export async function GET(request: NextRequest) {
  const status = request.nextUrl.searchParams.get('status') ?? 'open'
  const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get('limit')) || 50, 1), 200)

  try {
    const valid = ['open', 'reviewed', 'actioned', 'dismissed']
    const rows = valid.includes(status)
      ? await db.query(
          `SELECT id, user_id, assessment_id, question_index, reason, detail,
                  question_snapshot, status, created_at
             FROM question_reports
            WHERE status = $1
            ORDER BY created_at DESC
            LIMIT $2`,
          [status, limit],
        )
      : await db.query(
          `SELECT id, user_id, assessment_id, question_index, reason, detail,
                  question_snapshot, status, created_at
             FROM question_reports
            ORDER BY created_at DESC
            LIMIT $1`,
          [limit],
        )

    const counts = await db.query(
      `SELECT status, COUNT(*)::int AS n FROM question_reports GROUP BY status`,
    )

    return NextResponse.json({
      reports: rows.rows,
      counts: Object.fromEntries(counts.rows.map((r: any) => [r.status, r.n])),
    })
  } catch (err) {
    if (isMissingTable(err)) return NextResponse.json({ reports: [], counts: {} })
    console.error('Question report list failed:', err)
    return NextResponse.json({ error: 'Could not load reports.' }, { status: 500 })
  }
}

/** Move a report through the queue. */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const id = asUuid(body?.id)
    const status = String(body?.status ?? '')
    if (!id) return NextResponse.json({ error: 'A report id is required' }, { status: 400 })
    if (!['open', 'reviewed', 'actioned', 'dismissed'].includes(status)) {
      return NextResponse.json({ error: 'Unknown status' }, { status: 400 })
    }

    const res = await db.query(
      'UPDATE question_reports SET status = $2 WHERE id = $1 RETURNING id, status',
      [id, status],
    )
    if (res.rowCount === 0) return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    return NextResponse.json({ ok: true, report: res.rows[0] })
  } catch (err) {
    if (isMissingTable(err)) return NextResponse.json({ ok: true, stored: false })
    console.error('Question report update failed:', err)
    return NextResponse.json({ error: 'Could not update that report.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))

    const check = validateReport({
      reason: body?.reason,
      detail: body?.detail,
      questionIndex: body?.question_index,
    })
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: 400 })
    }

    try {
      await db.query(
        `INSERT INTO question_reports
           (user_id, assessment_id, result_id, question_index, reason, detail, question_snapshot)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
        [
          asUuid(body?.user_id),
          asUuid(body?.assessment_id),
          asUuid(body?.result_id),
          Math.floor(Number(body.question_index)),
          String(body.reason),
          normalizeDetail(body?.detail) || null,
          jsonbParam(questionSnapshot(body?.question)),
        ],
      )
    } catch (err) {
      if (isMissingTable(err)) {
        // The student's action still succeeded from their point of view; the
        // report simply has nowhere to go yet.
        console.warn('question_reports table missing — report dropped')
        return NextResponse.json({ ok: true, stored: false })
      }
      throw err
    }

    return NextResponse.json({ ok: true, stored: true })
  } catch (err) {
    console.error('Question report failed:', err)
    return NextResponse.json({ error: 'Could not send your report.' }, { status: 500 })
  }
}
