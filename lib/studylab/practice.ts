// lib/studylab/practice.ts

/**
 * Marking a learner's attempt at a practice problem.
 *
 * Two stages, in this order for a reason. Anything that can be settled here —
 * a number, an answer written the same way it was expected — is settled here:
 * it is free, it is instant, and a sub-second response is the difference
 * between practice feeling like a conversation and feeling like submitting
 * homework. Everything else goes to the model, which is the only thing that can
 * read someone's working.
 *
 * The local pass never returns "wrong". It returns "correct" or "I don't know",
 * and "I don't know" escalates. Being told you are wrong when you are right is
 * far more damaging to a learner than a tenth of a second and a hundredth of a
 * penny, so the cheap path is only ever allowed to award marks, never withhold
 * them.
 */

export type PracticeVerdict = 'correct' | 'close' | 'incorrect'
export type PracticeState = 'unattempted' | 'marking' | PracticeVerdict

/** What the canvas stores against a practice card. */
export interface PracticeCell {
  attempt?: string
  state: PracticeState
  feedback?: string
  /** True once the learner has asked to see the worked solution. */
  revealed?: boolean
}

/**
 * Strips the ways the same answer gets written differently.
 *
 * LaTeX delimiters, "x =" prefixes, trailing punctuation and spacing all vary
 * between what the tutor wrote and what a learner types, and none of them
 * changes the answer.
 */
export function normaliseAnswer(raw: unknown): string {
  // Takes unknown, not string. `answer` comes off a card the model wrote, and
  // it happily returns a number for a problem it framed as multiple choice —
  // which crashed the whole card on `raw.toLowerCase`. Anything that is not
  // text simply has no normalised form.
  if (typeof raw === 'number') return String(raw)
  if (typeof raw !== 'string') return ''
  return raw
    .toLowerCase()
    .replace(/\$/g, '')
    .replace(/\\[a-z]+/g, ' ')
    // Only a number after the equals sign is a restated subject ("x = 12" is
    // "12"). "a = b" is a different answer from "b", and stripping it marked
    // the equation correct.
    .replace(/^[a-z]\s*=\s*(?=-?\d)/, '')
    .replace(/[)(,;:!?]/g, ' ')
    .replace(/\s+/g, ' ')
    // Trimmed before the full stop is stripped: with trailing spaces still
    // present the period is not at the end, and "The Sun." kept its dot.
    .trim()
    .replace(/\.$/, '')
    .trim()
}

/** The single number in a string, or null when it is not just a number. */
function soleNumber(s: string): number | null {
  // Words mean this is working, not an answer. Stripping them out and reading
  // whatever digit survived marked "I substituted and got 12" as a correct
  // answer of 12 — which it may well be, but only the model can say so.
  if (!s.trim() || /[a-z]/i.test(s)) return null

  const cleaned = s.replace(/[^0-9.\-+/\s]/g, ' ').trim()
  if (!cleaned) return null

  // A fraction written as a/b is one number.
  const fraction = cleaned.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)$/)
  if (fraction) {
    const d = Number(fraction[2])
    return d === 0 ? null : Number(fraction[1]) / d
  }

  const numbers = cleaned.match(/-?\d+(?:\.\d+)?/g)
  if (!numbers || numbers.length !== 1) return null
  const n = Number(numbers[0])
  return Number.isFinite(n) ? n : null
}

/**
 * What can be decided without spending anything.
 *
 * `'unknown'` means "ask the model", not "wrong".
 */
export function localVerdict(expected: unknown, attempt: unknown): 'correct' | 'unknown' {
  const want = normaliseAnswer(expected)
  const got = normaliseAnswer(attempt)
  if (!want || !got) return 'unknown'

  if (want === got) return 'correct'

  const a = soleNumber(want)
  const b = soleNumber(got)
  if (a !== null && b !== null) {
    const tolerance = Math.max(Math.abs(a), 1) * 1e-9
    if (Math.abs(a - b) <= tolerance) return 'correct'
    // Both are plainly numbers and they differ — but a learner who wrote
    // working around the number may still be right, so this is not a refusal.
    return 'unknown'
  }

  return 'unknown'
}

/** Whether an attempt is substantial enough to be worth marking at all. */
export function isAttemptable(attempt: string): boolean {
  return attempt.trim().length > 0
}

/** Narrows a verdict off the wire without trusting it. */
export function parseVerdict(raw: unknown): PracticeVerdict {
  return raw === 'correct' || raw === 'close' ? raw : 'incorrect'
}
