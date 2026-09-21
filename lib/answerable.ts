/**
 * Questions a learner cannot answer as written, dropped before the paper is trimmed.
 *
 * `lib/question-audit.ts` reports these; it changes nothing, by design. That is
 * the right shape for a sweep and the wrong one for a learner, who gets the
 * paper either way. These two faults survived three rounds of prompt work and
 * kept reaching real papers, so they are removed rather than described:
 *
 *  - **A scenario with no question.** "During a school field trip, students
 *    observed that the temperature of a lake was 15 °C. They noticed that the
 *    air above the lake was warmer than the air above a nearby field." An
 *    answer box, a mark allocation, and nothing asked.
 *  - **Two demands in a one-word box.** "Write down the type of blood vessel
 *    that carries blood from the heart to the rest of the body. Write down the
 *    name of the blood cell that carries oxygen in the blood." One mark, one
 *    input, two answers wanted. A learner can only lose here.
 *
 * Dropping is what the prompt could not do. It runs where
 * `dropDanglingReferences` and `dropUnmarkable` run, so the top-up loop writes
 * a replacement and the paper keeps its length.
 *
 * The detection is shared with the auditor rather than reimplemented — two
 * copies of a rule drift, and then the sweep and the product disagree about
 * what shipped.
 */
import { asksNothing, asksTwoThings } from './question-audit'

export interface AnswerableQuestion {
  question?: unknown
  type?: unknown
  marks?: unknown
  options?: unknown
  short_answer?: unknown
  correct_indices?: unknown
  correct_category?: unknown
  /** Anything else a question carries; this reads only the fields above. */
  [key: string]: unknown
}

/** Why this question cannot be answered, or null when it can. */
export function unanswerableReason(q: AnswerableQuestion): string | null {
  if (!q || typeof q !== 'object') return null

  // Anything answered by selecting is out of scope: a tick list has no
  // command word and is not meant to.
  const selects =
    (Array.isArray(q.options) && q.options.length > 0) ||
    Array.isArray(q.correct_indices) ||
    Array.isArray(q.correct_category) ||
    q.type === 'interactive' ||
    q.type === 'mcq'
  if (selects) return null

  const stem = typeof q.question === 'string' ? q.question.trim() : ''
  if (!stem) return null

  if (asksNothing(stem)) return 'sets a scene and asks nothing'
  if (asksTwoThings(q)) return 'asks two things in a one-word answer box'
  return null
}

/** Remove them, reporting how many went and why. */
export function dropUnanswerable<T extends AnswerableQuestion>(questions: readonly T[]): {
  kept: T[]
  dropped: string[]
} {
  if (!Array.isArray(questions)) return { kept: [], dropped: [] }
  const kept: T[] = []
  const dropped: string[] = []
  for (const q of questions) {
    const why = unanswerableReason(q)
    if (why) dropped.push(why)
    else kept.push(q)
  }
  return { kept, dropped }
}
