import { NextRequest, NextResponse } from 'next/server'

import { db } from '@/lib/db'

import { buildMissedRecallCards } from '@/lib/recall/build-missed-cards'

import { initialCardState } from '@/lib/recall/sm2'



const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i



export async function POST(request: NextRequest) {

  try {

    const body = await request.json()

    const userId = String(body.userId ?? '').trim()

    const resultId = String(body.resultId ?? '').trim()



    if (!UUID_RE.test(userId) || !UUID_RE.test(resultId)) {

      return NextResponse.json({ error: 'Valid userId and resultId required' }, { status: 400 })

    }



    const result = await db.query(

      `SELECT r.questions_data, r.answers, r.longform_grades,

              a.subject AS assessment_subject

       FROM results r

       LEFT JOIN assessments a ON a.id = r.assessment_id

       WHERE r.id = $1 AND r.user_id = $2

       LIMIT 1`,

      [resultId, userId],

    )

    const row = result.rows[0]

    if (!row) return NextResponse.json({ error: 'Result not found' }, { status: 404 })



    const questions = Array.isArray(row.questions_data) ? row.questions_data : []

    const answers = row.answers && typeof row.answers === 'object' ? row.answers : {}

    const subject = String(row.assessment_subject ?? 'Assessment')



    const missed = buildMissedRecallCards(questions, answers, subject)



    if (missed.length === 0) {

      return NextResponse.json({ added: 0, message: 'No missed multiple-choice items to import' })

    }



    // Idempotent: don't create a second deck for a result already imported.

    const existing = await db.query(

      `SELECT 1 FROM recall_decks WHERE user_id = $1 AND source = 'assessment' AND source_ref = $2 LIMIT 1`,

      [userId, resultId],

    )

    if (existing.rows.length > 0) {

      return NextResponse.json({ added: 0, alreadyImported: true })

    }



    const deckInsert = await db.query(

      `INSERT INTO recall_decks (user_id, title, subject, source, source_ref)

       VALUES ($1, $2, $3, 'assessment', $4)

       RETURNING *`,

      [userId, `${subject} — missed items`, subject, resultId],

    )

    const deck = deckInsert.rows[0]

    const init = initialCardState()



    let added = 0

    for (const card of missed) {

      await db.query(

        `INSERT INTO recall_cards (

           deck_id, user_id, front, back, front_image_url, front_diagram_svg,

           hint, subject, ease_factor, interval_days, repetitions, due_at

         )

         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,

        [

          deck.id,

          userId,

          card.front.slice(0, 4000),

          card.back.slice(0, 8000),

          card.front_image_url ?? null,

          card.front_diagram_svg ?? null,

          card.hint ?? null,

          subject,

          init.ease_factor,

          init.interval_days,

          init.repetitions,

          init.due_at,

        ],

      )

      added += 1

    }



    return NextResponse.json({ deck, added, storage: 'database' })

  } catch (error: any) {

    if (String(error?.message ?? '').includes('recall_')) {

      return NextResponse.json({ fallback: true }, { status: 503 })

    }

    console.error('Recall import error:', error)

    return NextResponse.json({ error: 'Failed to import cards' }, { status: 500 })

  }

}

