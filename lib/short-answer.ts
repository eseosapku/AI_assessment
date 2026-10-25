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

export type ShortAnswerReason = 'exact' | 'spelling' | 'numeric' | 'phrase' | 'no-match' | 'blank' | 'no-key'

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

/**
 * Drop a leading article: "the heart" is the same answer as "heart".
 *
 * Only before a word, never before a label: "A and C" names two labels, and
 * "a b" is two letters, not the letter b.
 */
function dropArticle(text: string): string {
  const m = /^(?:an?|the)\s+(\S+)/.exec(text)
  if (!m || !/^[a-z]{3,}/.test(m[1]) || /^(and|or)$/.test(m[1])) return text
  return text.slice(m[0].length - m[1].length)
}

/**
 * Drop the sentence around an answer: "Because its an insulator" is the answer
 * "insulator", "It's greater" is "greater". Students write the box as a
 * sentence, and a written question marked by a model gave the same words the
 * mark that exact matching withheld. An article goes only before a real word,
 * as in dropArticle, so "a and c" keeps its labels.
 */
const LEAD_IN = /^(?:because|since|as|so|it is|it's|its|it|they are|they're|theyre|this is|that is|the answer is|answer is|answer|i think that|i think|it would be|it will be)\s+/
function stripLeadIn(text: string): string {
  let out = text
  for (let i = 0; i < 6; i++) {
    const next = dropArticle(out.replace(LEAD_IN, ''))
    if (next === out || !next) break
    out = next
  }
  return out
}

/** A negation anywhere turns a phrase into a different answer: "not an insulator". */
const NEGATION = /\b(not|no|never|neither|nor|cannot|without)\b|n't\b/

/** Short sentences only: a long answer that mentions the word in passing has not given it. */
const MAX_PHRASE_WORDS = 8

/**
 * The answer contains an accepted one as whole words: "the height increases"
 * for "increases". Never for a number or a one- or two-letter label, which a
 * longer answer can contain without meaning it ("B and C" is not "C"), and
 * never past a negation.
 */
function containsAccepted(answer: string, accepted: readonly string[]): boolean {
  const words = (s: string) => s.replace(/[^a-z0-9°%]+/g, ' ').trim()
  const padded = ` ${words(answer)} `
  if (NEGATION.test(answer) || padded.trim().split(' ').length > MAX_PHRASE_WORDS) return false
  return accepted.some((a) => {
    const core = words(stripLeadIn(dropArticle(a)))
    // A real word in it, not labels joined by "and": "A and C" is not "and c".
    if (!core.split(' ').some((w) => /^[a-z]{4,}$/.test(w)) || toNumber(core) !== null) return false
    // "evaporation or condensation" contains the accepted word and is still a
    // guess. A connector the accepted answer does not itself use is a hedge.
    const connectors = (s: string) => (s.match(/\b(?:or|and|then)\b|[,/]/gi) ?? []).map((c) => c.toLowerCase())
    if (connectors(answer).some((c) => !connectors(core).includes(c))) return false
    return padded.includes(` ${core} `)
  })
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

/**
 * A misspelling of an accepted form, judged word by word. The slip allowance
 * once applied to the whole form, so a long form lent it to its numbers and
 * short words: "2 hydrogen bonds" passed for "3 hydrogen bonds", "5% increase
 * in mass" for "5% decrease in mass", "5'-CCA-3'" for "5'-CCU-3'". Now every
 * number and every short word must be exactly right, each long word may slip
 * only within its own allowance, and spacing or punctuation may differ.
 */
/**
 * Digits and the marks that change what they mean, with the words removed.
 *
 * A hyphen between two letters is a word break ("well-known"), not a minus,
 * so it is joined away first. What is left — signs, decimals, fractions,
 * inequalities, exponents — has to be identical. Spelling slack is only for
 * the words.
 */
function marksThatCount(s: string): string {
  return s.replace(/(\p{L})-(\p{L})/gu, '$1$2').replace(/\p{L}+/gu, '').replace(/\s+/g, '')
}

function isSlipOf(text: string, form: string): boolean {
  if (marksThatCount(text) !== marksThatCount(form)) return false
  const words = (s: string) => s.split(/[^\p{L}\p{N}]+/u).filter(Boolean)
  const numbers = (s: string) => (s.match(/\d+/g) ?? []).join(' ')
  if (numbers(text) !== numbers(form)) return false
  const mine = words(text)
  const theirs = words(form)
  if (mine.join('') === theirs.join('')) return true
  if (mine.length !== theirs.length) return false
  return mine.every((w, i) => w === theirs[i] || (!/\d/.test(theirs[i]) && levenshtein(w, theirs[i]) <= spellingAllowance(theirs[i])))
}

export function gradeShortAnswer(given: unknown, key: ShortAnswerKey): ShortAnswerResult {
  const accepted = (Array.isArray(key?.accepted) ? key.accepted : [])
    .map(normalizeAnswer)
    .filter(Boolean)
  if (accepted.length === 0) return { correct: false, reason: 'no-key' }

  const raw = normalizeAnswer(given)
  if (!raw) return { correct: false, reason: 'blank' }
  const answer = stripRestatedSubject(raw)

  const same = (text: string) => accepted.includes(text) || accepted.some((a) => dropArticle(a) === dropArticle(text))
  if (same(answer)) return { correct: true, reason: 'exact' }
  const bare = stripLeadIn(answer)
  if (bare !== answer && same(bare)) return { correct: true, reason: 'exact' }

  if (key.numeric) {
    const { value, unit } = splitUnit(bare)
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
    if (isSlipOf(answer, a) || isSlipOf(bare, a)) return { correct: true, reason: 'spelling' }
  }

  if (!key.numeric && containsAccepted(bare, accepted)) return { correct: true, reason: 'phrase' }

  return { correct: false, reason: 'no-match' }
}

/**
 * A short answer the key did not match, as a question a model can mark.
 *
 * Exact matching cannot know that "it goes up" means "it increases"; the
 * model marking the written questions can. Its one criterion is the key
 * itself, so it is held to the accepted answers rather than its own idea of
 * the right one.
 */
export function secondLookQuestion<T extends { marks?: number; short_answer?: ShortAnswerKey }>(q: T): T & { marking_criteria: string[]; model_answer: string } {
  const list = (q.short_answer?.accepted ?? []).map((a) => String(a ?? '').trim()).filter(Boolean).join(' / ')
  return {
    ...q,
    marks: Number(q.marks) || 1,
    marking_criteria: [`Gives an answer that means the same as one of these accepted answers: ${list}`],
    model_answer: list,
  }
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
