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
