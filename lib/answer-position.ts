/**
 * Three faults that all come from the same place: the model keeps the answer
 * in its head as a VALUE, and is careless with the letter and the index.
 *
 * Measured over a sample of real generations at the grade extremes:
 *
 *  1. **The key points at the wrong option.** "What is 3 plus 4?" with options
 *     6, 7, 8, 5 and `correct_answer: 0`, explained "The correct answer is 7
 *     because when you add 3 and 4, you get 7. Option B (7) is correct. Option
 *     A (6) is incorrect." The reasoning is right; the index is off by one.
 *     Every structural check passes it, and a six-year-old who answers 7 is
 *     marked wrong and then shown a paragraph explaining that 7 is right.
 *
 *  2. **The letter is wrong while the key is right.** Same paper: options 7,
 *     6, 8, 4 with `correct_answer: 0` — correct — but explained "Option B (7)
 *     is correct." The letter is noise, and it survives into the review page.
 *
 *  3. **The answer is nearly always A.** 26 of 48, against 2 for D. In Primary
 *     Maths it was 5 of 6. A child who always picks A scores 54% without
 *     reading the paper, which makes the mark meaningless.
 *
 * The order here matters and is the whole design:
 *
 *   reconcile  — fix the index, trusting the VALUE the explanation asserts
 *                rather than the letter, because the value is the thing the
 *                model actually reasoned about
 *   delexicalise — drop "Option B" from the prose, since a letter is
 *                presentation and is about to stop being true anyway
 *   balance    — spread the answers across the four positions
 *
 * Reconciling after shuffling, or delexicalising before reconciling, both
 * destroy the evidence the next step needs.
 */

export interface PositionedQuestion {
  question?: unknown
  options?: unknown
  correct_answer?: unknown
  explanation?: unknown
  [key: string]: unknown
}

function optionTexts(q: PositionedQuestion): string[] | null {
  if (!Array.isArray(q.options)) return null
  const opts = q.options.map((o) => String(o ?? '').trim())
  return opts.length === 4 && opts.every(Boolean) ? opts : null
}

/** Compare the way a reader would: case and surrounding punctuation are noise. */
function sameValue(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}.\-/]/gu, '')
  return norm(a) === norm(b) && norm(a).length > 0
}

/**
 * The value the explanation asserts is correct, if it states one plainly.
 *
 * Reads "The correct answer is 7", "Option B (7) is correct", "the answer is
 * carbon dioxide". Returns null on anything hedged or absent, because a wrong
 * repair is worse than no repair.
 */
export function assertedAnswer(explanation: unknown): string | null {
  const t = String(explanation ?? '').trim()
  if (!t) return null

  // A parenthesised value beside the word "correct" is the strongest signal:
  // "Option B (7) is correct".
  const paren = /\b(?:option|answer)\s*\(?[A-D]\)?\s*\(([^)]{1,60})\)\s*(?:is|was)?\s*(?:the\s+)?correct\b/i.exec(t)
  if (paren) return paren[1].trim()

  // "The correct answer is 7 because…", "the answer is carbon dioxide."
  const stated = /\b(?:the\s+)?correct\s+(?:answer|option|choice)\s+is\s+(?!option\b)([^.,;]{1,60}?)(?=\s+because\b|[.,;]|$)/i.exec(t)
  if (stated) {
    const v = stated[1].trim()
    // A bare letter is the unreliable half; it tells us nothing about value.
    return /^\(?[A-D]\)?$/i.test(v) ? null : v
  }
  return null
}

/**
 * Point the key at the option the explanation says is right.
 *
 * Trusts the VALUE and never the letter. In "options 7, 6, 8, 4 … Option B (7)
 * is correct" the letter says B and the value says 7, which is option A — and
 * A is what the key already said. Following the letter there would break a
 * question that was right. Following the value leaves it alone.
 *
 * Only acts when the asserted value matches exactly one option, so an
 * explanation that mentions several of them changes nothing.
 */
export function reconcileKeyWithExplanation<T extends PositionedQuestion>(q: T): T {
  const opts = optionTexts(q)
  if (!opts) return q

  const asserted = assertedAnswer(q.explanation)
  if (!asserted) return q

  const matches = opts.map((o, i) => (sameValue(o, asserted) ? i : -1)).filter((i) => i >= 0)
  if (matches.length !== 1) return q

  const fixed = matches[0]
  return fixed === q.correct_answer ? q : { ...q, correct_answer: fixed }
}

/**
 * Replace "Option B" with what option B actually says.
 *
 * A letter is presentation: the UI draws it, the paper may reorder, and the
 * model gets it wrong often enough that it is not worth keeping. "Option B (7)
 * is correct" becomes "7 is correct" — which is what the learner needed to
 * read in the first place.
 */
export function delexicaliseExplanation<T extends PositionedQuestion>(q: T): T {
  const opts = optionTexts(q)
  const t = String(q.explanation ?? '')
  if (!opts || !t.trim()) return q

  const next = t
    // "Option B (7)" — the value is already there, so just drop the label.
    .replace(/\b(?:option|answer)\s*\(?([A-D])\)?\s*\(([^)]{1,60})\)/gi, (_m, _l, val) => String(val).trim())
    // "Option C is incorrect" — substitute what C says.
    .replace(/\b(?:option|answer)\s*\(?([A-D])\)?(?=\s|,|\.|$)/gi, (m, letter) => {
      const i = String(letter).toUpperCase().charCodeAt(0) - 65
      return i >= 0 && i < opts.length ? opts[i] : m
    })
    .replace(/\s{2,}/g, ' ')
    .trim()

  return next && next !== t ? { ...q, explanation: next } : q
}

/**
 * Take the letter off an option that labels itself.
 *
 * A Literature paper came back with options "A. Opening a book", "B.
 * Unwrapping a precious gift" and so on. The UI draws its own letters, so the
 * student reads "A. A. Opening a book" — untidy on its own, and actively
 * wrong once the paper is balanced, because rotating the options leaves the
 * text "A. Opening a book" sitting in position B.
 *
 * Only strips when EVERY option is labelled and the labels run A, B, C, D in
 * order. One option beginning "A." is far more likely to be an answer about
 * vitamin A than a label.
 */
export function stripOptionLabels<T extends PositionedQuestion>(q: T): T {
  const opts = optionTexts(q)
  if (!opts) return q

  const stripped: string[] = []
  for (let i = 0; i < opts.length; i++) {
    const m = /^([A-D])\s*[).:\-]\s+([\s\S]*)$/.exec(opts[i])
    if (!m || m[1].toUpperCase() !== String.fromCharCode(65 + i) || !m[2].trim()) return q
    stripped.push(m[2].trim())
  }
  return { ...q, options: stripped }
}

/**
 * Spread the correct answers across the four positions.
 *
 * Walks the paper and, whenever a position is already over-used, rotates that
 * question's options so the answer lands on the position used least so far.
 * Rotation rather than a shuffle because it keeps any deliberate ordering of
 * the distractors intact — ascending numbers stay ascending, which matters in
 * a Maths paper and costs nothing elsewhere.
 *
 * Deterministic: the same paper always balances the same way, so a regenerated
 * paper does not quietly differ from the one a teacher reviewed.
 */
export function balanceAnswerPositions<T extends PositionedQuestion>(questions: readonly T[]): T[] {
  if (!Array.isArray(questions)) return []
  const used = [0, 0, 0, 0]

  return questions.map((q) => {
    if (!q || typeof q !== 'object') return q
    const opts = optionTexts(q)
    const at = q.correct_answer
    if (!opts || !Number.isInteger(at) || (at as number) < 0 || (at as number) > 3) return q
    const from = at as number

    // Already the least-used position, or tied for it: leave it alone.
    const fewest = Math.min(...used)
    if (used[from] === fewest) {
      used[from]++
      return q
    }

    const to = used.indexOf(fewest)
    const shift = (to - from + 4) % 4
    const rotated = opts.map((_, i) => opts[(i - shift + 4) % 4])
    used[to]++
    return { ...q, options: rotated, correct_answer: to }
  })
}

/**
 * The whole repair, in the one order that works.
 *
 * Safe to run on any paper: questions that are not four-option multiple choice
 * pass through untouched.
 */
export function repairAnswerKeys<T extends PositionedQuestion>(questions: readonly T[]): T[] {
  if (!Array.isArray(questions)) return []
  return balanceAnswerPositions(
    questions.map((q) =>
      q && typeof q === 'object'
        ? // Labels come off BEFORE balancing: rotating a self-labelled option
          // is how "A. Opening a book" ends up in position B.
          stripOptionLabels(delexicaliseExplanation(reconcileKeyWithExplanation(q)))
        : q,
    ),
  )
}
