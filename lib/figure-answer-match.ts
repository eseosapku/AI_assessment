/**
 * Does the marked answer agree with the figure the question points at?
 *
 * Shipped, on a Stage 9 Mathematics paper, with a pie chart drawn beside it:
 *
 *   question     "Calculate the percentage of the total that Arts represents
 *                 in the pie chart."
 *   drawn        Non-fiction 35%, Fiction 45%, Science 10%, Arts 10%
 *   accepted     "25%", "0.25"
 *   explanation  "Arts represents one-fourth of the total, which is 25%."
 *
 * A learner who reads the chart correctly answers 10 and is marked wrong. This
 * is the reported "some of these questions are just downright wrong", and it
 * is the most checkable fault in the whole pipeline: the figure is a set of
 * numbers this code drew itself, and the answer is a number. Nothing had to be
 * inferred and nothing was compared.
 *
 * Only where the answer is genuinely derivable from the drawing — a named
 * slice of a pie chart, a named bar of a bar chart. Everywhere else this
 * returns null and says nothing, because a figure that merely illustrates a
 * question has no arithmetic to disagree with.
 *
 * Returns a sentence naming the disagreement, or null when there is none. The
 * caller drops the figure and asks again; it must never quietly rewrite the
 * answer to match, because which of the two is wrong is not knowable here.
 */
import type { FigureSpec } from './figure-spec'

/** Accepted answers, however the question happens to carry them. */
function acceptedNumbers(q: AnswerableQuestion): number[] {
  const raw: unknown[] = []
  const sa = q?.short_answer as { accepted?: unknown } | undefined
  if (Array.isArray(sa?.accepted)) raw.push(...sa!.accepted!)
  if (Array.isArray(q?.correct_answers)) raw.push(...q.correct_answers)
  if (q?.correct_answer !== undefined) raw.push(q.correct_answer)

  const out: number[] = []
  for (const item of raw) {
    const text = String(item ?? '').trim()
    if (!text) continue
    // "25%", "0.25", "25 %", "approximately 25%" — the number is what matters.
    const m = text.match(/-?\d+(?:\.\d+)?/)
    if (!m) continue
    const n = Number(m[0])
    if (!Number.isFinite(n)) continue
    out.push(n)
    // A bare fraction of one is the same claim as a percentage. Both forms
    // are offered by the model as alternatives to each other, so both are
    // compared and only a disagreement with EVERY form is reported.
    if (n > 0 && n <= 1) out.push(n * 100)
  }
  return out
}

/**
 * Which single named part of the figure is this question about?
 *
 * Null when it names none, and null when it names SEVERAL — "How many more
 * learners walk than cycle?" is about two bars and its answer is neither
 * bar's height. A stem mentioning two parts is asking for a comparison, a
 * difference or a total, and this check has nothing useful to say about any
 * of those. Structural rather than a list of comparison words, which is what
 * the first version tried: `\bmore than\b` does not match "more learners walk
 * than cycle", and a good question was reported as wrong for it.
 */
function namedPart<T extends { label: string; value: number }>(
  stem: string,
  parts: readonly T[],
): T | null {
  const text = stem.toLowerCase()
  const hits: T[] = []
  for (const part of parts) {
    const label = String(part.label ?? '').trim().toLowerCase()
    if (label.length < 3 || !text.includes(label)) continue
    hits.push(part)
  }
  if (hits.length === 0) return null
  // The longest matching label wins, so "Science fiction" is not read as
  // "Science" when both are slices of the same chart -- but only where the
  // shorter one is a SUBSTRING of it, which is the case that needs deciding.
  // Two genuinely different labels means a comparison, and no verdict.
  const longest = hits.reduce((a, b) => (String(b.label).length > String(a.label).length ? b : a))
  const longLabel = String(longest.label).toLowerCase()
  const distinct = hits.filter((h) => !longLabel.includes(String(h.label).toLowerCase()))
  return distinct.length === 0 ? longest : null
}

/** Is this question asking for a share rather than a count? */
function asksForAShare(stem: string): boolean {
  return /\bpercentage\b|\bpercent\b|\bper cent\b|%|\bfraction\b|\bproportion\b/i.test(stem)
}

export interface AnswerableQuestion {
  question?: unknown
  short_answer?: unknown
  correct_answer?: unknown
  correct_answers?: unknown
  [key: string]: unknown
}

/**
 * The disagreement between this question's answer and its figure, or null.
 *
 * Tolerant on purpose. A pie chart is read by eye, so an answer within a
 * couple of points of the drawn share is a correct reading, not a fault — the
 * check exists to catch 25 against 10, never 33 against 33.3.
 */
const HIGHEST = /\b(?:highest|most|largest|greatest|tallest|biggest|maximum|most popular)\b/i
const LOWEST = /\b(?:lowest|least|smallest|fewest|shortest|minimum|least popular)\b/i

/**
 * "Which ... is the highest / the fewest?" keyed to a bar that is not.
 *
 * "Write down the language with the highest number of speakers." was keyed
 * Mandarin beside a chart whose tallest bar was English, and "the lowest" was
 * keyed English on the same chart. Every check here compared numbers, and a
 * word answer passed untouched. The chart is a set of numbers this code drew
 * itself, so which bar is tallest is known, not guessed.
 *
 * Every accepted answer that names a bar must name an extreme one: a key that
 * also accepts a wrong bar marks a wrong answer right. Ties accept any of the
 * tied bars.
 */
function extremeContradiction(q: AnswerableQuestion, spec: FigureSpec, stem: string): string | null {
  const parts: { label: string; value: unknown }[] | null =
    spec.kind === 'barchart' ? spec.bars : spec.kind === 'piechart' ? spec.slices : null
  if (!parts || parts.length < 2) return null
  const wantsHigh = HIGHEST.test(stem)
  const wantsLow = LOWEST.test(stem)
  if (wantsHigh === wantsLow) return null

  const values = parts.map((p) => Number(p.value)).filter((v) => Number.isFinite(v))
  if (values.length !== parts.length) return null
  const target = wantsHigh ? Math.max(...values) : Math.min(...values)
  const right = parts.filter((p) => Number(p.value) === target).map((p) => p.label.toLowerCase().trim())

  const accepted = ((q as { short_answer?: { accepted?: unknown } })?.short_answer?.accepted ?? []) as unknown[]
  const named = accepted
    .map((a) => String(a ?? '').toLowerCase().trim())
    .map((a) => parts.find((p) => {
      const label = p.label.toLowerCase().trim()
      return a === label || a.includes(label) || label.includes(a)
    }))
    .filter((p): p is { label: string; value: unknown } => Boolean(p))
  if (named.length === 0) return null

  const wrong = named.find((p) => !right.includes(p.label.toLowerCase().trim()))
  if (!wrong) return null
  return `the key accepts "${wrong.label}" but the ${wantsHigh ? 'highest' : 'lowest'} on the chart is ${right.map((r) => `"${parts.find((p) => p.label.toLowerCase().trim() === r)!.label}"`).join(' or ')}`
}

export function answerContradictsFigure(
  q: AnswerableQuestion,
  spec: FigureSpec | null | undefined,
): string | null {
  if (!spec) return null
  const stem = String(q?.question ?? '')
  if (!stem.trim()) return null

  const extreme = extremeContradiction(q, spec, stem)
  if (extreme) return extreme

  const answers = acceptedNumbers(q)
  if (answers.length === 0) return null

  if (spec.kind === 'piechart') {
    const total = spec.slices.reduce((t, s) => t + (Number(s.value) || 0), 0)
    if (total <= 0) return null
    const slice = namedPart(stem, spec.slices)
    if (!slice) return null

    if (asksForAShare(stem)) {
      const share = (Number(slice.value) / total) * 100
      // Within 2 points is a reading of the chart, not a contradiction.
      if (answers.some((a) => Math.abs(a - share) <= 2)) return null
      return `the answer says ${answers[0]} but "${slice.label}" is ${share.toFixed(1)}% of the pie chart`
    }

    // Not a share — the raw value, where the chart is drawn from counts.
    if (answers.some((a) => Math.abs(a - Number(slice.value)) <= 0.01)) return null
    return `the answer says ${answers[0]} but "${slice.label}" is ${slice.value} on the pie chart`
  }

  if (spec.kind === 'barchart') {
    const bar = namedPart(stem, spec.bars)
    if (!bar) return null
    // A bar chart is read off an axis, so half a gridline either way.
    const step = Math.abs(Number(spec.y?.step) || 1)
    if (answers.some((a) => Math.abs(a - Number(bar.value)) <= step / 2)) return null
    // An aggregate over the whole chart is a legitimate answer that is not
    // any single bar's height, even when only one bar is named by name.
    if (/\bdifference\b|\btotal\b|\baltogether\b|\bcombined\b|\bsum\b|\bmean\b|\baverage\b|\brange\b/i.test(stem)) {
      return null
    }
    return `the answer says ${answers[0]} but "${bar.label}" measures ${bar.value} on the bar chart`
  }

  return null
}

/**
 * "The highest", where the figure has no highest.
 *
 * Shipped on the same Mathematics paper, beside a drawn table:
 *
 *   Outcomes of Two Spinners
 *   Spinner 1: White, Spinner 2: White    1/4
 *   Spinner 1: White, Spinner 2: Grey     1/4
 *   Spinner 1: Grey,  Spinner 2: White    1/4
 *   Spinner 1: Grey,  Spinner 2: Grey     1/4
 *
 *   "Draw a ring around the outcome with the highest probability."
 *
 * All four are a quarter. There is no highest, and whichever option the
 * learner rings is as right as the mark scheme's. The figure is correct and
 * the demand is correct; only together are they impossible, which is why
 * checking either alone found nothing.
 *
 * A tie anywhere in the middle is fine — "which is smallest" is answerable
 * with two equal values at the top. Only a tie AT the extreme being asked for
 * makes the question unanswerable.
 */
const SUPERLATIVE =
  /\b(?:highest|greatest|largest|biggest|most|maximum|lowest|smallest|least|fewest|minimum)\b/i

/** Numbers in a table column, including the fractions a probability uses. */
function columnValues(rows: readonly string[][], col: number): number[] {
  const out: number[] = []
  for (const row of rows) {
    const cell = String(row?.[col] ?? '').trim()
    if (!cell) continue
    const frac = cell.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/)
    if (frac) {
      const d = Number(frac[2])
      if (d) out.push(Number(frac[1]) / d)
      continue
    }
    const m = cell.match(/-?\d+(?:\.\d+)?/)
    if (m) out.push(Number(m[0]))
  }
  return out
}

/** Is the extreme of these values shared by more than one of them? */
function extremeIsTied(values: readonly number[], wantsHighest: boolean): boolean {
  if (values.length < 2) return false
  const extreme = wantsHighest ? Math.max(...values) : Math.min(...values)
  return values.filter((v) => Math.abs(v - extreme) < 1e-9).length > 1
}

/**
 * Why this question cannot be answered from its figure, or null.
 *
 * Separate from `answerContradictsFigure` because the fault is different: the
 * answer is not wrong, there is no answer at all.
 */
export function figureCannotAnswer(
  q: AnswerableQuestion,
  spec: FigureSpec | null | undefined,
): string | null {
  if (!spec) return null
  const stem = String(q?.question ?? '')
  if (!SUPERLATIVE.test(stem)) return null
  const wantsHighest = /\b(?:highest|greatest|largest|biggest|most|maximum)\b/i.test(stem)

  let values: number[] = []
  let what = ''
  if (spec.kind === 'piechart') {
    values = spec.slices.map((s) => Number(s.value) || 0)
    what = 'pie chart'
  } else if (spec.kind === 'barchart') {
    values = spec.bars.map((b) => Number(b.value) || 0)
    what = 'bar chart'
  } else if (spec.kind === 'datatable') {
    // The column the question is about is not named, so every numeric column
    // is considered and a tie in ANY of them is reported. A table whose only
    // numeric column is tied at the extreme cannot answer a superlative.
    for (let c = 0; c < spec.columns.length; c++) {
      const col = columnValues(spec.rows, c)
      if (col.length >= 2 && col.length === spec.rows.length) {
        if (!extremeIsTied(col, wantsHighest)) return null
        values = col
        what = 'table'
      }
    }
    if (!values.length) return null
  } else {
    return null
  }

  if (!extremeIsTied(values, wantsHighest)) return null
  const extreme = wantsHighest ? Math.max(...values) : Math.min(...values)
  return `asks for the ${wantsHighest ? 'highest' : 'lowest'} but ${
    values.filter((v) => Math.abs(v - extreme) < 1e-9).length
  } values on the ${what} are equal at ${extreme}`
}
