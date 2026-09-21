/**
 * Which real sittings a Checkpoint component can be built from.
 *
 * Split out from `/api/checkpoint-paper` because the form asked the wrong
 * question of it. Step 3 offers the year list and Step 4 lays the paper out,
 * and both were reading one response — so Step 3 could not appear until Step 4
 * had finished, and the learner watched an empty space while a paper they had
 * not asked for yet was assembled.
 *
 * This reads a static file and does no work. It answers in a millisecond, so
 * Step 3 is there as soon as a subject is picked.
 */
import { NextRequest, NextResponse } from 'next/server'
import { sittingsFor, sittingLabel, sittingId } from '@/lib/checkpoint-past-papers'
import { STRAND_FOCI } from '@/lib/checkpoint-paper'
import { CHECKPOINT_SUBJECTS } from '@/lib/cambridge-checkpoint'

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const code = params.get('code') ?? ''
  const component = params.get('component') ?? ''

  if (!/^\d{4}$/.test(code) || !/^\d{2}$/.test(component)) {
    return NextResponse.json({ sittings: [] })
  }

  const all = sittingsFor(code, component)

  // Every topic this subject can be examined on, so the learner can SEE them
  // and narrow the paper. "24 topics examined" told them a number and let them
  // pick nothing — which is a worse answer than not mentioning it.
  const subject = CHECKPOINT_SUBJECTS.find((s) => s.code === code)
  const syllabus = [...new Set((subject?.strands ?? []).flatMap((st) => STRAND_FOCI[st] ?? []))].sort()

  return NextResponse.json({
    syllabus,
    sittings: all.map((s) => ({
      id: sittingId(s),
      label: sittingLabel(s, all),
      year: s.year,
      // The topics themselves, not a count of them.
      topics: s.foci,
    })),
  })
}
