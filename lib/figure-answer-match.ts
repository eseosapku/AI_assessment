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
export function answerContradictsFigure(
  q: AnswerableQuestion,
  spec: FigureSpec | null | undefined,
): string | null {
  if (!spec) return null
  const stem = String(q?.question ?? '')
  if (!stem.trim()) return null

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
