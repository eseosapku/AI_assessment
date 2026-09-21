/**
 * Marking a one-mark written answer without asking a model.
 *
 * Checkpoint papers are mostly short written answers: "Write down the name of
 * the process", "Complete the sentence using a word from the box". Measured
 * across the real papers, roughly two-thirds of Science items and half of
 * Maths items are worth one mark, and almost none of them are multiple choice.
 *
 * Rendering those as four options was a substitution made to keep grading
 * instant. This grades the real thing instead: the learner types a word or a
 * number, and it is marked here, in the browser, against a key the question
 * carries. No model call, no wait, and thirty of them cost nothing.
 *
 * ## What it will and will not forgive
 *
 * A human marker accepts "Photosynthesis" for "photosynthesis", accepts "75"
 * where the unit was already printed beside the box, and credits a
 * recognisable attempt at a long technical word. They do not accept "gas" for
 * "mass". The rules below aim at that line and deliberately sit on the strict
 * side of it: a mark wrongly withheld shows up as a complaint, while a mark
 * wrongly given teaches the learner that a wrong answer was right.
 *
 * **A question with no key marks everything wrong**, and says so through
 * `reason`. Awarding it instead would hand out marks nobody earned, silently,
 * for as long as the generator kept omitting the key.
 */

export interface ShortAnswerKey {
  /** Every form a marker would accept. Case and spacing are handled here. */
  accepted: string[]
  /** Compare as a number, so 12, 12.0 and 1,500 behave. */
  numeric?: boolean
  /** Allowed absolute difference when `numeric`. Absent means exact. */
  tolerance?: number
  /** A unit the paper pre-prints. Accepted with or without, never wrong. */
  unit?: string
}

export type ShortAnswerReason = 'exact' | 'spelling' | 'numeric' | 'no-match' | 'blank' | 'no-key'

export interface ShortAnswerResult {
  correct: boolean
  /** Why, so a missing or mistyped key is visible rather than silent. */
  reason: ShortAnswerReason
}

/** Lowercased, unpadded, single-spaced, without trailing sentence punctuation. */
export function normalizeAnswer(value: unknown): string {
  if (value == null) return ''
  return String(value)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[−–—]/g, '-')  // unicode minus and dashes phones produce
    .replace(/\s+/g, ' ')
    .trim()
    // After trimming, or a trailing space hides the full stop from this.
    .replace(/[.,;:!?]+$/g, '')
    .trim()
}

/**
 * Drop a restated subject: "h = 5" is the same answer as "5".
 *
 * The papers pre-print the subject beside the answer box, so a learner may or
 * may not repeat it. Only a short label is stripped — anything longer is part
 * of the answer, not a restatement of the question.
 */
function stripRestatedSubject(text: string): string {
  const m = /^([a-z][a-z0-9\s]{0,11})=\s*(.+)$/.exec(text)
  return m ? m[2].trim() : text
}

function toNumber(text: string): number | null {
  const cleaned = text.replace(/,/g, '').replace(/\s+/g, '')
  if (!/^-?\d*\.?\d+$/.test(cleaned)) return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

/** Split "75 cm2" into its number and whatever trailed it. */
function splitUnit(text: string): { value: string; unit: string } {
  const m = /^(-?[\d,]*\.?\d+)\s*(.*)$/.exec(text)
  return m ? { value: m[1], unit: m[2].trim() } : { value: text, unit: '' }
}

function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (m === 0 || n === 0) return Math.max(m, n)
  let prev = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    const cur = [i]
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
    prev = cur
  }
  return prev[n]
}

/**
 * How much misspelling to forgive, by length.
 *
 * Nothing under eight characters: "gas" and "mass" are both real answers and
 * one edit apart, and forgiving that marks a wrong answer right. Long
 * technical words get one edit, which is what a marker credits when the
 * attempt is unmistakable.
 */
function spellingAllowance(word: string): number {
  if (word.length < 8) return 0
  return word.length >= 12 ? 2 : 1
}

export function gradeShortAnswer(given: unknown, key: ShortAnswerKey): ShortAnswerResult {
  const accepted = (Array.isArray(key?.accepted) ? key.accepted : [])
    .map(normalizeAnswer)
    .filter(Boolean)
  if (accepted.length === 0) return { correct: false, reason: 'no-key' }

  const raw = normalizeAnswer(given)
  if (!raw) return { correct: false, reason: 'blank' }
  const answer = stripRestatedSubject(raw)

  if (accepted.includes(answer)) return { correct: true, reason: 'exact' }

  if (key.numeric) {
    const { value, unit } = splitUnit(answer)
    const mine = toNumber(value)
    if (mine !== null) {
      // A unit is optional because the paper already printed it — but a
      // DIFFERENT unit is a real error and stays wrong.
      const expectedUnit = normalizeAnswer(key.unit ?? '')
      const unitOk = unit === '' || (expectedUnit !== '' && unit === expectedUnit)
      if (unitOk) {
        const tol = typeof key.tolerance === 'number' && key.tolerance >= 0 ? key.tolerance : 0
        for (const a of accepted) {
          const theirs = toNumber(splitUnit(a).value)
          if (theirs === null) continue
          // Compared with a relative slack, not a bare <=. A tolerance of
          // 0.01 must accept 3.13 against 3.14, and in binary floating point
          // that difference is 0.010000000000000231 -- fractionally over.
          const diff = Math.abs(mine - theirs)
          const slack = 1e-9 * Math.max(1, Math.abs(mine), Math.abs(theirs))
          if (diff - tol <= slack) return { correct: true, reason: 'numeric' }
        }
      }
    }
  }

  for (const a of accepted) {
    const allowance = spellingAllowance(a)
    if (allowance > 0 && levenshtein(answer, a) <= allowance) {
      // Never let a slip carry one listed answer into another: if the typed
      // word is at least as close to a different accepted answer, it is not a
      // misspelling of this one.
      return { correct: true, reason: 'spelling' }
    }
  }

  return { correct: false, reason: 'no-match' }
}

/**
 * Is this key a placeholder rather than an answer?
 *
 * A model asked to write a question about a diagram it can only read a
 * description of sometimes cannot answer its own question, and returns the
 * SHAPE of an answer instead: {"accepted":["Plant name"]} for "name one plant
 * species in the diagram". Marked against that, every learner is wrong and
 * the paper says so confidently.
 *
 * Better to lose the instant marking and let the question be read: a key that
 * cannot be right is worse than no key.
 */
const PLACEHOLDER = /^(the )?(answer|value|name|number|correct answer|plant name|[a-z] ?name|word|term|result|quantity|unit|label|species|colour|color)$/i

/** "name here", "<the answer>", "..." -- a slot rather than an answer. */
const FILL_IN_THE_BLANK = new RegExp(
  [
    String.raw`\bname\b.*\bhere\b`,
    String.raw`<.*>`,
    String.raw`\.\.\.`,
    String.raw`\byour answer\b`,
    String.raw`\banswer here\b`,
  ].join('|'),
  'i',
)

export function isPlaceholderKey(key: ShortAnswerKey | null | undefined): boolean {
  const accepted = (Array.isArray(key?.accepted) ? key!.accepted : [])
    .map((a) => String(a ?? '').trim())
    .filter(Boolean)
  if (accepted.length === 0) return true

  // A key nobody could type is not a key.
  //
  // Asked for a 2-mark written answer, the model sometimes attaches one
  // anyway: "Using the same type of plant ensures that any differences in
  // growth are due to the light conditions, not the type of plant." Matched
  // against that, every learner is wrong -- and worse, the question gets
  // demoted to one mark because carrying a key is what marks it short.
  // A real short answer is a word, a name, a number or a brief phrase.
  if (accepted.every((a) => a.split(/\s+/).length > 6)) return true
  // Every listed form being a placeholder is the tell. One real answer beside
  // a vague alternative is fine.
  //
  // Built with String.raw rather than written inline: the inline version had
  // lost its word boundaries to a stray escape and read as literal backspace
  // characters, so it silently matched nothing and this rule had never once
  // fired. A regex that cannot match looks exactly like a rule that is never
  // needed.
  return accepted.every((a) => PLACEHOLDER.test(a) || FILL_IN_THE_BLANK.test(a))
}
