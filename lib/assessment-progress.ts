/**
 * Which questions are answered, and which the student has walked past.
 *
 * From the tester report (U1): "the quiz does not allow for users to be
 * notified that a question had not been answered. The user then goes through
 * all questions and might have missed one but will never know until they reach
 * the end and see there's something left."
 *
 * The distinction that matters is between *not reached yet* and *seen and left
 * blank*. Marking an untouched question red would nag a student on question two
 * about question nine; marking a skipped one grey would hide the thing they
 * need to fix. Pure so both rules are testable.
 */

export type QuestionState = 'answered' | 'skipped' | 'unseen' | 'current'

export interface ProgressInput {
  total: number
  /** Zero-based index the student is on now. */
  current: number
  /** Zero-based indices with an answer recorded. */
  answered: ReadonlySet<number>
  /** Zero-based indices the student has landed on at least once. */
  visited: ReadonlySet<number>
}

const has = (set: ReadonlySet<number> | undefined, i: number): boolean =>
  set instanceof Set ? set.has(i) : false

/** State of one question, for the number strip. */
export function questionState(index: number, input: ProgressInput): QuestionState {
  if (has(input.answered, index)) return 'answered'
  if (index === input.current) return 'current'
  // Seen and left blank: this is the one worth colouring as a problem.
  if (has(input.visited, index)) return 'skipped'
  return 'unseen'
}

/** Every question the student has seen and not answered, ascending, one-based. */
export function skippedQuestions(input: ProgressInput): number[] {
  const total = Number.isFinite(input?.total) && input.total > 0 ? Math.floor(input.total) : 0
  const out: number[] = []
  for (let i = 0; i < total; i++) {
    if (questionState(i, input) === 'skipped') out.push(i + 1)
  }
  return out
}

/** Every unanswered question, whether or not it was reached — used at submit. */
export function unansweredQuestions(input: ProgressInput): number[] {
  const total = Number.isFinite(input?.total) && input.total > 0 ? Math.floor(input.total) : 0
  const out: number[] = []
  for (let i = 0; i < total; i++) {
    if (!has(input.answered, i)) out.push(i + 1)
  }
  return out
}

/**
 * Message for the pre-submit check.
 *
 * Names the questions rather than only counting them, so the student can act
 * without hunting. Beyond a handful the list becomes noise, so it truncates.
 */
export function unansweredSummary(numbers: readonly number[], maxListed = 8): string {
  if (numbers.length === 0) return ''
  if (numbers.length === 1) return `Question ${numbers[0]} is still blank.`
  const shown = numbers.slice(0, maxListed)
  const rest = numbers.length - shown.length
  const list = shown.join(', ')
  return rest > 0
    ? `${numbers.length} questions are still blank: ${list} and ${rest} more.`
    : `${numbers.length} questions are still blank: ${list}.`
}

/** Progress for the bar and the "x of y" label — answered, not merely visited. */
export function answeredCount(input: ProgressInput): number {
  const total = Number.isFinite(input?.total) && input.total > 0 ? Math.floor(input.total) : 0
  let n = 0
  for (let i = 0; i < total; i++) if (has(input.answered, i)) n++
  return n
}
