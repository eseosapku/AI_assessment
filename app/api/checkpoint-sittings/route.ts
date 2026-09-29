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
import { fociFor } from '@/lib/checkpoint-paper'
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
  // Grouped by the area they belong to, not flattened into one wall.
  //
  // Ninety topics in a single run of chips is a list nobody reads: there is no
  // way in, no way to find one, and no way to tell a Biology topic from a
  // Physics one. The areas are Cambridge's own; the UI names them plainly
  // rather than calling them strands.
  const subject = CHECKPOINT_SUBJECTS.find((s) => s.code === code)
  // The topics THIS programme examines. The picker used to offer the Lower
  // Secondary list to Primary learners, so a ten-year-old could tick
  // "atomic structure" and get a paper about it.
  const groups = (subject?.strands ?? [])
    .map((st) => ({ area: st, topics: subject ? [...fociFor(subject, st)].sort() : [] }))
    .filter((g) => g.topics.length > 0)
  const syllabus = [...new Set(groups.flatMap((g) => g.topics))]

  return NextResponse.json({
    syllabus,
    groups,
    sittings: all.map((s) => ({
      id: sittingId(s),
      label: sittingLabel(s, all),
      year: s.year,
      // The topics themselves, not a count of them.
      topics: s.foci,
    })),
  })
}
