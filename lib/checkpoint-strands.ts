/**
 * Which strand a Checkpoint question belongs to — and whether we actually know.
 *
 * Checkpoint reports at strand level, so the breakdown IS the product. That
 * makes the honesty of a tag matter more here than anywhere else: a question
 * filed under Physics because nothing matched, and then reported as a Physics
 * finding, is wrong in the way that looks right.
 *
 * The subtopic tagger in `app/api/generate-assessment/route.ts` already drew
 * this line — it round-robins unmatched questions so scoring stays distributed,
 * but records on `topic_label_matched` that it did, with the comment "an
 * assignment, not a finding. Only a real match may be shown to the student as
 * where the question came from." This keeps the same line, under the name
 * `strand_matched`.
 *
 * `lib/checkpoint-report.ts` is what enforces it: only a matched question counts
 * toward a strand, and a strand with none reads "not assessed in this paper".
 */
import { tagTokens } from './tag-tokens'
import { strandSignals, type CheckpointSubject } from './cambridge-checkpoint'

export interface StrandTag {
  strand: string
  /** True only on a real keyword hit. False means "filed somewhere, not known". */
  matched: boolean
}

/** Stem plus options plus explanation, guarded — this is model output. */
function questionText(question: unknown): string {
  if (!question || typeof question !== 'object') return ''
  const q = question as Record<string, unknown>
  const stem = typeof q.question === 'string' ? q.question : ''
  const options = Array.isArray(q.options) ? q.options.filter((o) => typeof o === 'string').join(' ') : ''
  const explanation = typeof q.explanation === 'string' ? q.explanation : ''
  return `${stem} ${options} ${explanation}`
}

/**
 * The strand whose name shares the most words with the question.
 *
 * On no overlap this still returns a strand — the field is always populated so
 * the report can group without special cases — but with `matched: false`, which
 * is the flag that stops it being counted as a finding.
 */
export function tagQuestionToStrand(question: unknown, strands: string[]): StrandTag | null {
  const candidates = strands.filter((s) => typeof s === 'string' && s.length > 0)
  if (candidates.length === 0) return null

  const words = new Set(tagTokens(questionText(question)))
  let best = candidates[0]
  let bestScore = 0

  for (const strand of candidates) {
    let score = 0
    // The strand's own name plus the vocabulary a question in it would use.
    // Matching the name alone finds almost nothing: a chemistry question says
    // "reaction" and "compound", not "chemistry".
    for (const token of new Set(tagTokens(strandSignals(strand).join(' ')))) {
      if (words.has(token)) score += 1
    }
    if (score > bestScore) {
      bestScore = score
      best = strand
    }
  }

  return { strand: best, matched: bestScore > 0 }
}

/**
 * Tags a whole component in place, writing `strand` and `strand_matched`.
 *
 * In place, and under those names, to match how `tagQuestionsWithSubtopics`
 * writes `subtopic_id` onto the same objects — the results page only has
 * `questions_data` to work from, so what is not written here cannot be read
 * later.
 *
 * The cross-cutting strand is a candidate alongside the content strands: a
 * question really can be about thinking and working mathematically rather than
 * about number or algebra.
 */
export function tagQuestionsWithStrands(questions: unknown[], subject: CheckpointSubject): void {
  if (!Array.isArray(questions) || questions.length === 0) return

  const candidates = subject.crossCuttingStrand
    ? [...subject.strands, subject.crossCuttingStrand]
    : subject.strands

  for (const question of questions) {
    if (!question || typeof question !== 'object') continue
    const tag = tagQuestionToStrand(question, candidates)
    if (!tag) continue
    const q = question as Record<string, unknown>
    q.strand = tag.strand
    q.strand_matched = tag.matched
  }
}
