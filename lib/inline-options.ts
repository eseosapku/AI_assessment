/**
 * Rescuing questions whose options ended up inside the question.
 *
 * Exam-prep papers are generated from synced past-question banks, and those
 * banks store questions the way they are printed:
 *
 *     The shaded area in the diagram above is represented by
 *     A) {(x,y) : y - 3x < -6}
 *     B) {(x,y) : y + 3x < 6}
 *     ...
 *
 * Asked for a stem and four options, the model copies that block verbatim into
 * the stem and then has nothing left to put in the options array, so it emits
 * ["A", "B", "C", "D"]. Measured on WAEC Mathematics with a paper attached,
 * seven of ten questions came back like this — a paper where the only visible
 * choices are four bare letters, which is unusable.
 *
 * Telling the model not to do it helps and is done in the prompt, but a past
 * paper full of that shape will keep pulling it back. This repairs what
 * arrives, which is the difference between a broken paper and a working one.
 */

/** Options that carry no information: bare letters, or empty. */
export function optionsAreDegenerate(options: unknown): boolean {
  if (!Array.isArray(options) || options.length === 0) return true
  return options.every((o) => {
    const s = String(o ?? '').trim()
    return s === '' || /^\(?[A-Za-z]\)?[.)]?$/.test(s)
  })
}

export interface SplitQuestion {
  question: string
  options: string[]
}

/**
 * Pulls "A) …" style choices out of a stem.
 *
 * Requires at least two labelled lines in ascending order starting from the
 * first label, so a stem that merely mentions "A)" in passing is left alone —
 * mangling a good question is worse than leaving a bad one.
 */
export function splitInlineOptions(stem: unknown): SplitQuestion | null {
  const text = String(stem ?? '')
  if (!text.trim()) return null

  // Labels may sit on their own lines, or run together on one line.
  const normalised = text.replace(/\s+(?=\(?[A-Ha-h][.)]\s)/g, '\n')
  const lines = normalised.split('\n')

  const found: { letter: string; text: string; index: number }[] = []
  lines.forEach((line, i) => {
    const m = line.match(/^\s*\(?([A-Ha-h])\)?[.)]\s+(.*)$/)
    if (m && m[2].trim()) found.push({ letter: m[1].toUpperCase(), text: m[2].trim(), index: i })
  })

  if (found.length < 2) return null

  // Consecutive from the first label onwards: A,B,C,D — not A,C,F.
  const start = found[0].letter.charCodeAt(0)
  const run: typeof found = []
  for (let i = 0; i < found.length; i++) {
    if (found[i].letter.charCodeAt(0) === start + i) run.push(found[i])
    else break
  }
  if (run.length < 2) return null

  // The labelled block must be the tail of the stem; a run that starts halfway
  // through with prose after it is not an options list.
  const firstIdx = run[0].index
  const lastIdx = run[run.length - 1].index
  const trailing = lines.slice(lastIdx + 1).join(' ').trim()
  if (trailing) return null

  const question = lines.slice(0, firstIdx).join('\n').trim()
  if (!question) return null

  return { question, options: run.map((r) => r.text) }
}

export interface RepairableQuestion {
  question?: unknown
  options?: unknown
  correct_answer?: unknown
}

export interface RepairResult {
  question: string
  options: string[]
  correct_answer: number
  repaired: boolean
}

/**
 * Repairs one question, or returns it unchanged.
 *
 * The answer index is preserved: the model chose it against the letters it was
 * looking at, and those letters are in the same order as the extracted options.
 * When the extracted count differs from the original, the index is clamped
 * rather than dropped — a question with a slightly suspect key still beats a
 * question with four bare letters for options.
 */
export function repairInlineOptions(q: RepairableQuestion): RepairResult | null {
  if (!optionsAreDegenerate(q.options)) return null
  const split = splitInlineOptions(q.question)
  if (!split) return null

  const original = Number(q.correct_answer)
  const idx = Number.isInteger(original) ? original : 0
  return {
    question: split.question,
    options: split.options,
    correct_answer: Math.max(0, Math.min(split.options.length - 1, idx)),
    repaired: true,
  }
}

/** Repairs a whole paper in place, returning how many were fixed. */
export function repairPaper(questions: RepairableQuestion[]): number {
  let fixed = 0
  for (const q of questions) {
    const r = repairInlineOptions(q)
    if (!r) continue
    q.question = r.question
    q.options = r.options
    q.correct_answer = r.correct_answer
    fixed++
  }
  return fixed
}
