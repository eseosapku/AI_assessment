/**
 * A Checkpoint result, read the way Cambridge reports one.
 *
 * Cambridge reports on a 0-50 scale within performance bands, and at strand and
 * sub-strand level as well as subject level — which is why a learner who misses
 * one of the two papers cannot make it up: scoring the biology strand needs
 * every biology-targeting question across both. A practice path whose output is
 * a single percentage is not Checkpoint, it is a quiz with a Cambridge label.
 *
 * Two rules do most of the work here, and both are about not claiming more than
 * is known:
 *
 *  - **A strand nobody was asked about reads "not assessed", never zero.** Zero
 *    is a finding about the learner; silence is a fact about the paper, and
 *    printing one as the other is the same class of lie as a citation that is
 *    not true.
 *  - **Only a matched tag counts toward a strand.** `lib/checkpoint-strands.ts`
 *    files every question somewhere so grouping needs no special cases, but
 *    flags whether it actually recognised the subject matter. An unmatched
 *    question still counts toward the overall score — the tag is uncertain, the
 *    answer is not — but it must not make a strand look assessed.
 */
import type { CheckpointSubject } from './cambridge-checkpoint'

export interface StrandResult {
  strand: string
  /** False when no matched question targeted it. Then `correct`/`total` are 0. */
  assessed: boolean
  correct: number
  total: number
}

export interface CheckpointResult {
  /** On Cambridge's published 0-50 reporting scale. */
  score: number
  outOf: 50
  /** Every strand of the subject, in syllabus order, assessed or not. */
  strands: StrandResult[]
  /** The assessed strand with the lowest proportion right, or null if none were. */
  weakest: string | null
}

/** The 0-50 scale Cambridge publishes. Not a paper's raw mark total. */
const REPORT_SCALE = 50

function strandOf(question: unknown): { strand: string; matched: boolean } | null {
  if (!question || typeof question !== 'object') return null
  const q = question as Record<string, unknown>
  if (typeof q.strand !== 'string' || q.strand.length === 0) return null
  return { strand: q.strand, matched: q.strand_matched === true }
}

export function checkpointReport(
  questions: unknown[],
  answers: boolean[],
  subject: CheckpointSubject,
): CheckpointResult {
  const asked = Array.isArray(questions) ? questions : []
  const given = Array.isArray(answers) ? answers : []

  // An answers array shorter than the paper means those questions went
  // unanswered, which is a wrong answer rather than a reason to throw.
  let correct = 0
  for (let i = 0; i < asked.length; i++) if (given[i] === true) correct += 1

  const tally = new Map<string, { correct: number; total: number }>()
  for (let i = 0; i < asked.length; i++) {
    const tag = strandOf(asked[i])
    if (!tag || !tag.matched) continue
    const row = tally.get(tag.strand) ?? { correct: 0, total: 0 }
    row.total += 1
    if (given[i] === true) row.correct += 1
    tally.set(tag.strand, row)
  }

  const strands: StrandResult[] = subject.strands.map((strand) => {
    const row = tally.get(strand)
    return {
      strand,
      assessed: (row?.total ?? 0) > 0,
      correct: row?.correct ?? 0,
      total: row?.total ?? 0,
    }
  })

  let weakest: string | null = null
  let worst = Infinity
  for (const s of strands) {
    if (!s.assessed) continue
    const share = s.correct / s.total
    if (share < worst) {
      worst = share
      weakest = s.strand
    }
  }

  return {
    score: asked.length === 0 ? 0 : Math.round((correct / asked.length) * REPORT_SCALE),
    outOf: REPORT_SCALE,
    strands,
    weakest,
  }
}
