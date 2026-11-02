import type { CheckpointQuestion, QuizCell } from './types'
import { regionsFor } from './check/diagramRegions'

export type FillQuestion = Extract<CheckpointQuestion, { format: 'fill' }>
export type OrderQuestion = Extract<CheckpointQuestion, { format: 'order' }>
export type TapQuestion = Extract<CheckpointQuestion, { format: 'tap' }>

/** How a blank is written in a fill question's sentence. */
export const BLANK = '___'
const BLANKS = /_{3,}/g

/** The blanks in a sentence: each run of three or more underscores is one. */
export function blanksIn(text: string): number {
  return typeof text === 'string' ? (text.match(BLANKS) ?? []).length : 0
}

const same = (a: unknown, b: unknown) => typeof a === 'string' && typeof b === 'string' && a.trim().toLowerCase() === b.trim().toLowerCase()

/** Each blank holds its own tile; spacing and capitals do not count against it. */
export function gradeFill(q: FillQuestion, given: string[]): boolean {
  return given.length === q.answer.length && q.answer.every((a, i) => same(given[i], a))
}

export function gradeOrder(q: OrderQuestion, given: string[]): boolean {
  return given.length === q.items.length && q.items.every((item, i) => given[i] === item)
}

/** The same parts tapped, in any order. */
export function gradeTap(q: TapQuestion, given: string[]): boolean {
  const want = new Set(q.answer)
  const got = new Set(given)
  return got.size === want.size && [...want].every((id) => got.has(id))
}

/** One per clue: met once both of its items are placed and in that order. */
export function clueStates(q: OrderQuestion, arrangement: string[]): boolean[] {
  return (q.clues ?? []).map((c) => {
    const i = arrangement.indexOf(c.before)
    const j = arrangement.indexOf(c.after)
    return i >= 0 && j >= 0 && i < j
  })
}

const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0
const distinct = (xs: string[]) => new Set(xs.map((x) => x.trim().toLowerCase())).size === xs.length

/** What stops a fill from being answered: one answer a blank, every answer a tile, no tile twice, eight at most. */
function fillFault(q: any): string | null {
  const n = blanksIn(q.text)
  if (n < 1) return 'its "text" has no blank written as ___'
  if (!Array.isArray(q.answer) || q.answer.length !== n || !q.answer.every(text)) return `it has ${n} blank${n === 1 ? '' : 's'} but not one answer for each`
  if (!distinct(q.answer)) return 'two of its blanks have the same answer'
  if (!Array.isArray(q.tiles) || !q.tiles.every(text) || !distinct(q.tiles)) return 'its "tiles" must be different words'
  if (q.tiles.length > 8) return 'it has more than eight tiles'
  const missing = q.answer.find((a: string) => !q.tiles.some((t: string) => same(t, a)))
  return missing ? `its tiles do not include the answer "${missing}"` : null
}

/** What stops an order from being answered: three to six different items, and every clue true of the right order. */
function orderFault(q: any): string | null {
  if (!Array.isArray(q.items) || q.items.length < 3 || q.items.length > 6 || !q.items.every(text)) return 'it needs three to six "items"'
  if (!distinct(q.items)) return 'two of its items are the same'
  if (q.clues === undefined) return null
  if (!Array.isArray(q.clues) || q.clues.length > 4) return 'it has more than four clues'
  for (const c of q.clues) {
    if (!text(c?.text)) return 'a clue has no text'
    if (q.items.indexOf(c.before) < 0 || q.items.indexOf(c.after) < 0 || c.before === c.after) return `clue "${c.text}" must name two of its items, exactly as written`
    if (q.items.indexOf(c.before) > q.items.indexOf(c.after)) return `clue "${c.text}" is not true of the right order`
  }
  return null
}

/** What stops a tap from being answered: parts we have mapped on one of our own diagrams, each once, and never every part. */
function tapFault(q: any): string | null {
  const map = regionsFor(q.figure)
  if (!map) return `"${q.figure}" has no mapped parts; use a diagram from the list`
  if (!Array.isArray(q.answer) || q.answer.length === 0 || new Set(q.answer).size !== q.answer.length) return 'its "answer" must list the parts to tap, each once'
  const ids = new Set(map.regions.map((r) => r.id))
  const unknown = q.answer.find((id: unknown) => typeof id !== 'string' || !ids.has(id))
  if (unknown !== undefined) return `"${unknown}" is not a part of "${q.figure}"`
  return q.answer.length < ids.size ? null : 'it asks for every part of the figure'
}

/**
 * Why a fill, order or tap cannot be answered as written, in words a writer
 * can fix; null when it can, or when it is another format.
 */
export function questionFault(q: any): string | null {
  if (!q || typeof q !== 'object') return 'it is not a question'
  if (q.format === 'fill') return fillFault(q)
  if (q.format === 'order') return orderFault(q)
  if (q.format === 'tap') return tapFault(q)
  return null
}

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

/**
 * The writer changing its mind mid-sentence ("Wait -- actually this is also right,
 * so pick the first one"): it found its own question broken and shipped it anyway.
 */
const SECOND_THOUGHTS = /\bwait\s*[\u2014\u2013,:.!-]|\bactually,? (this|that|it|both)\b|\balso (correct|right)\b|\bboth (are |of these are |options are )?(correct|right)\b|\bpick the first\b|\bscratch that\b/i

/** Said of a wrong option, it means the option is right: a second right answer marked wrong. */
const ACTUALLY_WORKS = /\b(this|that|it) (also |does |would )?(works?|is valid|is also valid)\b/i

function hasSecondThoughts(q: any): boolean {
  const feedback: unknown[] = Array.isArray(q.optionFeedback) ? q.optionFeedback : []
  if ([q.explain, ...feedback].some((text) => typeof text === 'string' && SECOND_THOUGHTS.test(text))) return true
  return feedback.some((text, i) => i !== Number(q.answer) && typeof text === 'string' && ACTUALLY_WORKS.test(text))
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
      if (hasSecondThoughts(q)) return false
      return Number.isInteger(answer) && answer >= 0 && answer < q.options.length
    }
    case 'short':
      return true
    case 'code':
      return typeof q.goal === 'string'
    case 'match':
      return Array.isArray(q.pairs) && q.pairs.length > 0 && q.pairs.every((p: any) => typeof p?.left === 'string' && typeof p?.right === 'string')
    case 'fill':
      return fillFault(q) === null
    case 'order':
      return orderFault(q) === null
    case 'tap':
      return tapFault(q) === null
    default:
      return false
  }
}

// Normalise a question that passed isValidQuestion into the canonical shape
// (e.g. coerce a string mcq answer to an integer index).
export function coerceQuestion(q: CheckpointQuestion): CheckpointQuestion {
  if (q.format === 'mcq') {
    const { optionFeedback, ...rest } = q
    const linesUp =
      Array.isArray(optionFeedback) &&
      optionFeedback.length === q.options.length &&
      optionFeedback.every((f) => typeof f === 'string')
    return { ...rest, answer: Number(q.answer), ...(linesUp ? { optionFeedback } : {}) }
  }
  if (q.format === 'fill') return { ...q, tiles: q.tiles.map((t) => t.trim()), answer: q.answer.map((a) => a.trim()) }
  if (q.format === 'order') return { ...q, items: q.items.map((i) => i.trim()) }
  if (q.format === 'tap') return { ...q, figure: q.figure.trim() }
  return q
}

/**
 * A checkpoint's questions as the board will show them: missing ids filled
 * in, broken questions dropped, answers coerced. The board builds its quiz
 * from this and the tutor route keeps it to mark against, so both name the
 * same questions by the same ids.
 */
export function salvageQuestions(checkpointId: string, raw: unknown): CheckpointQuestion[] {
  return (Array.isArray(raw) ? raw : [])
    .map((q: any, i: number) => ({ ...q, id: typeof q?.id === 'string' && q.id ? q.id : `${checkpointId}-q${i}` }))
    .filter(isValidQuestion)
    .map(coerceQuestion)
}

/** What the page reports for each question of a check, by question id. */
export type CheckAnswers = Record<string, { given?: unknown; state?: unknown }>

/** A check's answers as the page reports them to the tutor. */
export function checkAnswers(cells: QuizCell[]): CheckAnswers {
  return Object.fromEntries(cells.map((c) => [c.question.id, { given: c.given, state: c.state }]))
}

/**
 * Whether a check was passed, marked against the questions the server wrote.
 *
 * The page used to send `passed: true` and the route took its word, so one
 * request cleared a hard check, including on a step locked by a measured
 * gap. Choice and matching questions are marked here from what was picked.
 * Written and code answers are marked by the grade route, which records
 * nothing this route can read, so their verdict is still the page's.
 */
export function markCheck(questions: CheckpointQuestion[], answers: CheckAnswers | undefined): boolean {
  const correct = questions.filter((q) => answeredRight(q, answers?.[q.id])).length
  return correct > questions.length / 2
}

/**
 * The prompts of the questions a check's answers got wrong, marked the way
 * `markCheck` marks them -- what the near-twin after a failed check is made
 * from. An unanswered question is a missed one.
 */
export function missedQuestions(questions: CheckpointQuestion[], answers: CheckAnswers | undefined): string[] {
  return questions.filter((q) => !answeredRight(q, answers?.[q.id])).map((q) => q.prompt)
}

function answeredRight(q: CheckpointQuestion, a: CheckAnswers[string] | undefined): boolean {
  if (q.format === 'mcq') return typeof a?.given === 'number' && gradeMcq(q, a.given)
  const given = a?.given
  const strings = Array.isArray(given) && given.every((g) => typeof g === 'string') ? (given as string[]) : null
  if (q.format === 'match') return !!strings && gradeMatch(q, strings)
  // Marked from what was given, never from the page's word that it was right.
  if (q.format === 'fill') return !!strings && gradeFill(q, strings)
  if (q.format === 'order') return !!strings && gradeOrder(q, strings)
  if (q.format === 'tap') return !!strings && gradeTap(q, strings)
  return a?.state === 'correct'
}
