import type { CheckpointQuestion, QuizCell } from './types'

export function gradeMcq(q: Extract<CheckpointQuestion, { format: 'mcq' }>, given: number): boolean {
  return given === q.answer
}

export function gradeMatch(q: Extract<CheckpointQuestion, { format: 'match' }>, given: string[]): boolean {
  return q.pairs.length === given.length && q.pairs.every((p, i) => given[i] === p.right)
}

/**
 * How a check went, in the learner's language.
 *
 * This used to read `CHECKPOINT RESULT: 1/1 correct. All correct.` — which was
 * correct, because it was written to be parsed by the model rather than read by
 * a person. The tutor now receives the result as structured data on the
 * `answer_check` action and never sees this string, so there is nothing left
 * for the protocol wording to serve.
 */
export function checkpointResultText(cells: QuizCell[]): string {
  const total = cells.length
  const correct = cells.filter((c) => c.state === 'correct').length

  if (correct === total) {
    return total === 1 ? 'Correct.' : `All ${total} correct.`
  }
  if (correct === 0) {
    return total === 1 ? 'Not quite — we will go back over that.' : `None right this time — we will go back over it.`
  }
  return `${correct} of ${total} right — we will go back over the rest.`
}

export type GradeVerdict = 'correct' | 'incorrect' | 'ungraded'

/**
 * What the marker's reply means. Only a clear true or false is a verdict.
 *
 * Everything else was read as wrong: a dropped connection, a server error, a
 * paywall, and the marker's own "Could not grade right now" all locked the
 * answer as incorrect and could fail a check the student had passed. Those
 * are `ungraded` -- try again -- and never cost a mark.
 */
export function readGradeReply(ok: boolean, body: unknown): { verdict: GradeVerdict; feedback: string } {
  const b = (body && typeof body === 'object' ? body : {}) as { correct?: unknown; feedback?: unknown; error?: unknown }
  const feedback = typeof b.feedback === 'string' ? b.feedback : ''
  if (!ok || b.error || typeof b.correct !== 'boolean' || /could not grade/i.test(feedback)) {
    return { verdict: 'ungraded', feedback: "Couldn't check that just now. Try again." }
  }
  return { verdict: b.correct ? 'correct' : 'incorrect', feedback }
}

/**
 * A question saved while it was being marked. `pending` is autosaved with
 * the board, so a dropped connection or a closed tab left it spinning on
 * every reload with its buttons disabled -- and a hard check that could
 * never close. Null when the cell is fine as it is.
 */
export function settleStaleCell(cell: QuizCell): Partial<QuizCell> | null {
  return cell.state === 'pending' ? { state: 'unanswered', given: cell.given } : null
}

export function isValidQuestion(q: any): q is CheckpointQuestion {
  if (!q || typeof q !== 'object' || typeof q.id !== 'string' || typeof q.prompt !== 'string') return false
  switch (q.format) {
    case 'mcq': {
      // Accept a numeric-string answer too (the model sometimes sends "0"),
      // but not a missing one: Number(null) and Number('') are 0, which made
      // option A silently right; and not one past the options, which made a
      // question nobody could get right.
      if (!Array.isArray(q.options) || q.options.length < 2 || !q.options.every((o: any) => typeof o === 'string')) return false
      if (q.answer === null || q.answer === undefined || String(q.answer).trim() === '') return false
      const answer = Number(q.answer)
      return Number.isInteger(answer) && answer >= 0 && answer < q.options.length
    }
    case 'short':
      return true
    case 'code':
      return typeof q.goal === 'string'
    case 'match':
      return Array.isArray(q.pairs) && q.pairs.length > 0 && q.pairs.every((p: any) => typeof p?.left === 'string' && typeof p?.right === 'string')
    default:
      return false
  }
}

// Normalise a question that passed isValidQuestion into the canonical shape
// (e.g. coerce a string mcq answer to an integer index).
export function coerceQuestion(q: CheckpointQuestion): CheckpointQuestion {
  if (q.format === 'mcq') return { ...q, answer: Number(q.answer) }
  return q
}
