/**
 * A Checkpoint result, read the way Cambridge reports one.
 *
 * Cambridge reports on a 0-50 scale within performance bands, and at strand and
 * sub-strand level as well as subject level — which is why a learner who misses
 * one of the two papers cannot make it up: scoring the biology strand needs
 * every biology-targeting question across both. A practice path whose output is
 * a single percentage is not Checkpoint, it is a quiz with a Cambridge label.
 *
 * ## Marks, not questions
 *
 * Everything here counts marks. A paper built by `lib/checkpoint-paper.ts` is
 * fifty marks made of one-mark multiple-choice items and two- and three-mark
 * written answers, so "you got 28 of 34 questions" and "you scored 38" are
 * different numbers and only the second is the one Cambridge reports. Counting
 * questions would also throw away every part mark a written answer earned,
 * which is the main thing a written answer is for.
 *
 * A written answer is graded out of its own marks, so `answers` takes a number
 * — the marks awarded — as readily as a boolean. A boolean still works and
 * means all of that question's marks or none of them, which is exactly what a
 * multiple-choice item is.
 *
 * ## Two rules, both about not claiming more than is known
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
  /** False when no matched question targeted it. Then the marks are 0. */
  assessed: boolean
  /** Marks the learner earned in this strand. */
  earned: number
  /** Marks this paper put in this strand. */
  available: number
  /** How many questions targeted it — context for the marks, not the score. */
  questions: number
}

export interface CheckpointResult {
  /** Marks earned. On a full paper this is Cambridge's 0-50 scale directly. */
  score: number
  /** Marks the paper carried. 50 for a full component, less for a drill. */
  outOf: number
  /** Every strand of the subject, in syllabus order, assessed or not. */
  strands: StrandResult[]
  /** The assessed strand with the lowest share of its marks, or null. */
  weakest: string | null
}

/** A question is worth one mark unless it says otherwise. */
function marksOf(question: unknown): number {
  if (!question || typeof question !== 'object') return 1
  const marks = (question as Record<string, unknown>).marks
  return typeof marks === 'number' && Number.isFinite(marks) && marks > 0 ? marks : 1
}

/** Marks earned: a number is taken as awarded, a boolean as all or nothing. */
function earnedOn(answer: unknown, available: number): number {
  if (typeof answer === 'number' && Number.isFinite(answer)) {
    return Math.max(0, Math.min(available, answer))
  }
  return answer === true ? available : 0
}

function strandOf(question: unknown): { strand: string; matched: boolean } | null {
  if (!question || typeof question !== 'object') return null
  const q = question as Record<string, unknown>
  if (typeof q.strand !== 'string' || q.strand.length === 0) return null
  return { strand: q.strand, matched: q.strand_matched === true }
}

export function checkpointReport(
  questions: unknown[],
  answers: Array<boolean | number>,
  subject: CheckpointSubject,
): CheckpointResult {
  const asked = Array.isArray(questions) ? questions : []
  const given = Array.isArray(answers) ? answers : []

  let score = 0
  let outOf = 0
  const tally = new Map<string, { earned: number; available: number; questions: number }>()

  for (let i = 0; i < asked.length; i++) {
    const available = marksOf(asked[i])
    // An answers array shorter than the paper means those questions went
    // unanswered, which is zero marks rather than a reason to throw.
    const earned = earnedOn(given[i], available)
    outOf += available
    score += earned

    const tag = strandOf(asked[i])
    if (!tag || !tag.matched) continue
    const row = tally.get(tag.strand) ?? { earned: 0, available: 0, questions: 0 }
    row.earned += earned
    row.available += available
    row.questions += 1
    tally.set(tag.strand, row)
  }

  const strands: StrandResult[] = subject.strands.map((strand) => {
    const row = tally.get(strand)
    return {
      strand,
      assessed: (row?.questions ?? 0) > 0,
      earned: row?.earned ?? 0,
      available: row?.available ?? 0,
      questions: row?.questions ?? 0,
    }
  })

  let weakest: string | null = null
  let worst = Infinity
  for (const s of strands) {
    if (!s.assessed || s.available === 0) continue
    const share = s.earned / s.available
    if (share < worst) {
      worst = share
      weakest = s.strand
    }
  }

  return { score, outOf, strands, weakest }
}
