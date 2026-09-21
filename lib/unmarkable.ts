/**
 * Questions nobody can mark.
 *
 * A written answer earns its marks against a mark scheme: a list of points, or
 * a short-answer key the grader can match. With neither, the student writes an
 * answer into a box and there is nothing to compare it to. The question looks
 * complete on the page and is worth however many marks the paper says, and
 * none of them can be awarded.
 *
 * Measured across a Checkpoint sweep of all eight buildable components: 11 of
 * these survived to the learner-facing paper. They arrive by two roads.
 *
 *  1. **The generator omits it.** The model returns `{"type":"longform",
 *     "question":..., "marks":2}` with no `marking_criteria` and no
 *     `short_answer`. Putting the field inside the object template rather than
 *     in a line underneath it cut this down but did not end it.
 *
 *  2. **A key is removed for being unusable, and nothing is left.** A key
 *     reading "Plant name" rather than an actual plant marks every learner
 *     wrong, so `applyBlueprint` drops it — correctly. What it cannot do is
 *     put a mark scheme there instead, so the question arrives at the paper
 *     carrying neither. This is the road the sweep could not see, because the
 *     question leaves the route looking marked.
 *
 * Both are closed the same way and in the same place as
 * `dropDanglingReferences`: the question is dropped while the top-up loop can
 * still refill the gap. Dropping is the only honest option — a marking point
 * invented here would be marked against the student, and a wrong mark scheme
 * is worse than a missing question.
 */
import { isPlaceholderKey, type ShortAnswerKey } from './short-answer'

export interface MarkableQuestion {
  type?: unknown
  options?: unknown
  marks?: unknown
  marking_criteria?: unknown
  short_answer?: unknown
  correct_indices?: unknown
  correct_category?: unknown
}

/**
 * Can this question be marked at all?
 *
 * Only written answers are in scope. Multiple choice is marked by its index,
 * a tick list by its indices and a table by its assignments, and none of them
 * carries a mark scheme — asking one for criteria would delete the whole
 * paper.
 */
export function isUnmarkable(q: MarkableQuestion): boolean {
  if (!q || typeof q !== 'object') return false

  // Anything answered by selecting rather than writing marks itself.
  if (Array.isArray(q.options) && q.options.length > 0) return false
  if (Array.isArray(q.correct_indices) || Array.isArray(q.correct_category)) return false
  if (q.type === 'interactive' || q.type === 'mcq') return false

  const criteria = Array.isArray(q.marking_criteria)
    ? q.marking_criteria.filter((c) => String(c ?? '').trim().length > 0)
    : []
  if (criteria.length > 0) return false

  // The same usability test the blueprint applies, run here where the paper
  // can still be refilled — so a key it would reject never reaches it.
  const key = q.short_answer as ShortAnswerKey | undefined
  if (key && Array.isArray(key.accepted) && !isPlaceholderKey(key)) return false

  return true
}

/**
 * Remove the questions nothing can mark, reporting how many went.
 *
 * Mirrors `dropDanglingReferences`: same shape, same place in the pipeline,
 * same reason — a promise the paper cannot keep.
 */
export function dropUnmarkable<T extends MarkableQuestion>(questions: readonly T[]): {
  kept: T[]
  dropped: number
} {
  if (!Array.isArray(questions)) return { kept: [], dropped: 0 }
  const kept: T[] = []
  let dropped = 0
  for (const q of questions) {
    if (isUnmarkable(q)) dropped++
    else kept.push(q)
  }
  return { kept, dropped }
}
