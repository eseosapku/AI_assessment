/**
 * Read-only inspection of a generated paper.
 *
 * `lib/assessment-quality.ts` is the cleaner: it removes duplicates and fixes
 * explanations on the way out. This is the opposite — it changes nothing and
 * reports what is wrong, so a sweep across every curriculum and question type
 * can say WHICH faults appear WHERE rather than leaving a person to read a
 * thousand questions.
 *
 * Two severities, and the distinction matters more than the list of checks:
 *
 *  - **broken** — the question cannot be answered or cannot be marked. An MCQ
 *    whose `correct_answer` points past the end of its options marks every
 *    learner wrong. These are launch blockers.
 *  - **poor** — the question works but a teacher would wince. "All of the
 *    above", an explanation that addresses the marker rather than the learner,
 *    a stem three times longer than the paper it imitates. These are polish.
 *
 * Nothing here calls a model. A check that needs judgement about whether an
 * answer is factually right is out of scope on purpose: it would need the same
 * machinery it is meant to be auditing.
 */
import { isPlaceholderKey, type ShortAnswerKey } from './short-answer'
import { bookReference } from './book-reference'

export type AuditSeverity = 'broken' | 'poor'

export interface AuditFinding {
  code: string
  severity: AuditSeverity
  /** 0-based position in the paper. -1 for a fault about the paper itself. */
  index: number
  detail: string
}

export interface AuditOptions {
  /** How many questions were asked for, when the paper should be exact. */
  expectedCount?: number
  /** Set when the paper is allowed to carry figures. */
  figuresAvailable?: boolean
}

const VISUAL_PROMISE =
  /\b(look at|as shown|shown (?:above|below|here)|in the (?:diagram|figure|graph|table|picture|image|map)|the (?:diagram|figure|graph|picture|image) (?:above|below|shows)|refer(?:ring)? to the (?:diagram|figure|graph|map|table))\b/i

const EXAMINER_VOICE = /\b(this question tests|the student should|candidates should|the learner should|tests the student)/i

const CATCH_ALL_OPTION = /^(all|none) of the (above|these)$/i

/**
 * A question leaning on a text the learner has not been given.
 *
 * The failure mode of Literature above all others: "In Chapter 3, why does
 * Okonkwo…". The learner is reading a quiz, not the novel. A comprehension
 * question is fine when the extract travels with it — that is what `passage`
 * is for — and unanswerable when it does not.
 *
 * Deliberately anchored on "the passage/extract/poem" as a thing being
 * referred to, not on the bare words: "the passage of water through a
 * membrane" is osmosis, and a check that fires on it is noise nobody reads.
 */
const UNSEEN_TEXT = new RegExp(
  [
    'in (?:the )?(?:chapter|act|scene|stanza|extract) \\d*',
    'according to the (?:passage|extract|author|poet|writer|text)',
    'the (?:passage|extract|poem|author|poet|playwright|narrator) (?:above|below|describes|states|says|suggests|uses)',
    '(?:in|from) the (?:extract|poem|novel|play)\\b',
    '\\bline \\d+',
  ].join('|'),
  'i',
)

/** Something the learner would have to hear, which nothing here can play. */
const NEEDS_AUDIO = /\b(listen to|the recording|the audio|as you hear|played aloud|the clip)\b/i

function text(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function words(v: unknown): number {
  const t = text(v)
  return t ? t.split(/\s+/).length : 0
}

/**
 * Loose key for spotting the same question twice. Mirrors the cleaner's intent.
 *
 * Numbers are kept however short they are. Dropping them made every question
 * in a Primary 1 Maths paper identical — "What is 3 plus 4?" and "What is 5
 * plus 2?" both reduce to "plus what" — and the sweep reported six duplicates
 * in a paper that had none. A fault in the report reads exactly like a fault
 * in the product, which is the more expensive kind of wrong.
 */
function stemKey(q: Record<string, unknown>): string {
  return text(q.question)
    .toLowerCase()
    .replace(/\[\d+\]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 3 || /\d/.test(w))
    .sort()
    .join(' ')
}

/**
 * Does the explanation name a different option from the one marked correct?
 *
 * Found in a real Primary 1 paper: "What is the total of 3 and 4?" with the
 * answer marked A (6), and its own explanation reading "The total of 3 and 4
 * is 7. Option B (7) is correct." A six-year-old answers 7, is told they are
 * wrong, and then reads a paragraph explaining that 7 is right.
 *
 * Nothing else catches this. The index is in range, the options are four and
 * distinct, and the paper looks perfect in every structural check. It is only
 * visible by reading the explanation against the key -- which is exactly the
 * sort of thing a person stops doing at question thirty.
 */
const CLAIMS_ANOTHER = new RegExp(
  [
    // "Option B (7) is correct", "answer C is the correct one"
    String.raw`\b(?:option|answer)\s*\(?([A-D])\)?\s*(?:\([^)]*\)\s*)?(?:is|was)?\s*(?:the\s+)?correct\b`,
    // "the correct answer is B"
    String.raw`\bcorrect\s+(?:answer|option|choice)\s+is\s*\(?([A-D])\)?\b`,
  ].join('|'),
  'i',
)

function explanationNamesAnotherOption(
  q: Record<string, unknown>,
  options: unknown[],
  answer: number,
): string | null {
  const explanation = text(q.explanation)
  if (!explanation || !Number.isInteger(answer) || answer < 0 || answer >= options.length) return null

  // Deliberately does not fire on "option B is incorrect" or "option B is not
  // correct": an explanation ruling an option OUT is the normal, healthy shape,
  // and a check that fires on it is noise nobody reads.
  const claim = CLAIMS_ANOTHER.exec(explanation)
  const letter = (claim?.[1] ?? claim?.[2] ?? '').toUpperCase()
  if (!letter) return null

  const claimed = letter.charCodeAt(0) - 65
  if (claimed === answer || claimed >= options.length) return null
  return `explanation says ${letter} is correct; the key says ${String.fromCharCode(65 + answer)}`
}

/**
 * A sound-pattern question where more than one option fits.
 *
 * From a real Primary 1 English paper: "Which word has the same sound as
 * 'cat'?" -- bat, hat, mat, sat. All four rhyme. One is marked right and three
 * children who answered correctly are told they were wrong. The same paper
 * asked which word "ends with the sound 'at'" over cat/bat/dog/pen, with two
 * right answers, and which has the middle sound 'a' over four words that all do.
 *
 * Only fires on single-word options, and only when the target is quoted -- the
 * shape early-phonics items actually take. Anything looser starts flagging
 * ordinary vocabulary questions, which is how a check becomes noise.
 */
const SOUND_STEM = new RegExp(
  [
    String.raw`(?:same|matching)\s+(?:\w+\s+)?sound\s+as`,
    String.raw`rhymes?\s+with`,
    String.raw`(?:ends?|finish(?:es)?)\s+with\s+the\s+sound`,
    String.raw`(?:begins?|starts?)\s+with\s+the\s+sound`,
    String.raw`middle\s+sound`,
  ].join('|'),
  'i',
)

/**
 * The part of the target the question is actually asking about.
 *
 * A stem quotes a whole word — "the same middle sound as 'cat'" — but asks
 * about one piece of it. Comparing against the whole word finds nothing, which
 * is how a paper asking for the middle sound of 'cat' shipped with fat, hat,
 * bat and rat as its four options and every one of them correct.
 *
 * Only the target is reduced; the option is matched on the same footing below.
 */
function targetSound(stem: string, t: string): { part: string; where: 'start' | 'end' | 'middle' } {
  // A stem may quote the sound itself ("ends with the sound 'at'") rather than
  // a word. One or two letters is a sound; more is a word to take apart.
  const isWord = t.length > 2

  // "begins with the sound", and also "the same STARTING sound as", which is
  // how the stem is actually worded more often than not.
  if (/\b(?:starts?|starting|begins?|beginning|first|initial)\s+(?:sound|letter|with)\b/i.test(stem)) {
    return { part: isWord ? (/^[^aeiou]+/.exec(t)?.[0] ?? t[0]) : t, where: 'start' }
  }
  if (/middle\s+sound/i.test(stem)) {
    return { part: isWord ? (/[aeiou]+/.exec(t)?.[0] ?? t.slice(1, -1)) : t, where: 'middle' }
  }
  // "ends with", and rhyme, both compare the rime: the target from its first
  // vowel onward. "cat" -> "at", so bat, hat, mat and sat all fit.
  return { part: isWord ? (/[aeiou].*$/.exec(t)?.[0] ?? t) : t, where: 'end' }
}

function fitsSoundPattern(stem: string, target: string, option: string): boolean {
  const o = option.toLowerCase().replace(/[^a-z]/g, '')
  const t = target.toLowerCase().replace(/[^a-z]/g, '')
  if (!o || !t) return false

  const { part, where } = targetSound(stem, t)
  if (!part) return false

  if (where === 'start') return o.startsWith(part)
  if (where === 'middle') return (/[aeiou]+/.exec(o)?.[0] ?? '') === part
  // A word never rhymes with itself in a question that asks which word rhymes.
  return o !== t && o.endsWith(part)
}

function auditSoundPattern(q: Record<string, unknown>, i: number, options: unknown[], out: AuditFinding[]): void {
  const stem = text(q.question)
  if (!SOUND_STEM.test(stem)) return
  const target = /['\u2018\u2019"\u201c\u201d]([a-z]{1,12})['\u2018\u2019"\u201c\u201d]/i.exec(stem)?.[1]
  if (!target) return
  const single = options.map(text).filter((o) => o && !/\s/.test(o))
  if (single.length !== options.length) return

  const fitting = single.filter((o) => fitsSoundPattern(stem, target, o))
  if (fitting.length > 1) {
    out.push({
      code: 'several-options-fit',
      severity: 'broken',
      index: i,
      detail: `${fitting.length} options fit "${target}": ${fitting.join(', ')}`,
    })
  }
  if (fitting.length === 0) {
    // The mirror fault, and it arrives the same way. A paper asked "Which word
    // has the same STARTING sound as 'cat'?" over hat, dog, sun and pen —
    // distractors built for a rhyme question — and marked 'hat' correct, with
    // an explanation asserting that hat and cat begin alike. They do not, and
    // the right answer is not on the page at all.
    out.push({
      code: 'no-option-fits',
      severity: 'broken',
      index: i,
      detail: `no option fits "${target}": ${single.join(', ')}`,
    })
  }
}

function auditMcq(q: Record<string, unknown>, i: number, out: AuditFinding[]): void {
  const options = Array.isArray(q.options) ? q.options : []
  if (options.length !== 4) {
    out.push({ code: 'mcq-option-count', severity: 'broken', index: i, detail: `${options.length} options, expected 4` })
  }
  const answer = q.correct_answer
  if (typeof answer !== 'number' || !Number.isInteger(answer) || answer < 0 || answer >= options.length) {
    // Marks every learner wrong, silently, and looks fine in a list.
    out.push({ code: 'mcq-answer-out-of-range', severity: 'broken', index: i, detail: `correct_answer=${String(answer)} against ${options.length} options` })
  }
  const contradiction = explanationNamesAnotherOption(q, options, answer as number)
  if (contradiction) {
    out.push({ code: 'explanation-contradicts-key', severity: 'broken', index: i, detail: contradiction })
  }

  auditSoundPattern(q, i, options, out)

  const seen = new Set<string>()
  for (const o of options) {
    const k = text(o).toLowerCase()
    if (!k) {
      out.push({ code: 'mcq-empty-option', severity: 'broken', index: i, detail: 'an option is empty' })
      continue
    }
    if (seen.has(k)) {
      out.push({ code: 'mcq-duplicate-option', severity: 'broken', index: i, detail: `option repeated: "${text(o).slice(0, 40)}"` })
    }
    seen.add(k)
    if (CATCH_ALL_OPTION.test(k)) {
      out.push({ code: 'mcq-catch-all-option', severity: 'poor', index: i, detail: `"${text(o)}" is guessable and untestable` })
    }
    if (/^[A-D][).:]\s/.test(text(o))) {
      out.push({ code: 'mcq-lettered-option', severity: 'poor', index: i, detail: 'option carries its own letter; the UI adds one' })
    }
  }
}

/**
 * A one-word answer box under a question that asks for two things.
 *
 * Live, on a Checkpoint Science paper, beside a table of the speed of sound:
 * "State the medium where the speed of sound is the highest. Explain why this
 * is the case in terms of pressure in solids, liquids, and gases." — under a
 * box labelled "One answer — a word, a phrase or a number", worth one mark.
 *
 * Either demand alone is a fair question. Together they cannot be answered in
 * the space given, cannot be marked against a single key, and tell the learner
 * the paper was not read before it was set.
 *
 * Scoped to questions that actually carry a one-mark key, so a genuine
 * two-part written answer is untouched.
 */
const SECOND_DEMAND =
  /\b(?:and\s+)?(?:explain|describe|justify|discuss|comment on|give\s+(?:a\s+)?reason|say\s+why|suggest\s+why)\b/i

/**
 * Imperatives that are not demands.
 *
 * "Show your working", "Write your answer to one decimal place" and "Use the
 * diagram below" are how a real paper tells a learner HOW to answer, not what
 * else to answer. Counting them as demands flagged
 *
 *   "Calculate the mean number of borrows from the table. Write your answer."
 *
 * as two questions in one box. It is one question (2.6) followed by a
 * sentence that says nothing -- badly written, but answerable, and deleting
 * it would cost a good question to remove a stray full stop.
 */
const HOUSEKEEPING =
  /^(?:show\s+(?:your|all)\b|write\s+your\s+answer\b|give\s+your\s+answer\b|round\s+your\s+answer\b|use\s+(?:the|your)\b|look\s+at\b|refer\s+to\b|read\s+the\b)/i

/**
 * Does this one-mark question ask for two answers?
 *
 * Two shapes, and the second was missed for a long time because it never uses
 * the word "explain":
 *
 *   "State the medium where the speed of sound is highest. Explain why."
 *   "Write down the blood vessel that carries blood from the heart. Write
 *    down the name of the blood cell that carries oxygen."
 *
 * The second is two flat imperatives, so counting sentences that OPEN with a
 * command catches it where a vocabulary list never could.
 */
export function asksTwoThings(q: Record<string, unknown> | unknown): boolean {
  const rec = (q ?? {}) as Record<string, unknown>
  const key = rec.short_answer as ShortAnswerKey | undefined
  if (!key || !Array.isArray(key.accepted)) return false
  // No marks gate.
  //
  // There used to be one -- anything above a mark was waved through, on the
  // reasoning that two marks can pay for two answers. That reasoning does not
  // apply HERE: this function only ever runs on a question with a
  // `short_answer` key, which is a SINGLE input box. Two demands into one box
  // is broken at any mark value, and the gate let one through on a live
  // paper: "Calculate the mean number of borrows from the table. Write your
  // answer to one decimal place." arrived claiming more than a mark, was
  // waved past, and was stamped back down to the slot's one on the way out.
  //
  // Marks are provisional until the very end of the route, so a guard that
  // depends on them is a guard that fires or does not fire by accident.

  const stem = text(rec.question)
  if (!stem) return false

  const sentences = stem
    .split(/(?<=[.!?])\s+/)
    .map((x) => x.trim())
    .filter(Boolean)
    .filter((x) => !HOUSEKEEPING.test(x))
  // Two imperatives is two questions, however politely they are worded.
  if (sentences.filter((x) => COMMAND_AT_START.test(x)).length >= 2) return true

  // The first sentence may legitimately open with a command; a second demand
  // after it is the fault.
  const after = sentences.slice(1).join(' ')
  const target = after || stem.replace(/^[^.!?]*[.!?]\s*/, '')
  return Boolean(target.trim()) && SECOND_DEMAND.test(target)
}

/** Things with a numeric value, for spotting a stem that wants two of them. */
const QUANTITY_NOUN =
  'value|amount|number|total|sum|difference|product|area|perimeter|circumference|' +
  'volume|capacity|mass|weight|length|width|height|distance|speed|time|angle|' +
  'probability|percentage|fraction|ratio|mean|median|mode|range|average|root|' +
  'cube|square|term|gradient|coordinate'

const TWO_QUANTITIES = new RegExp(
  String.raw`\b(${QUANTITY_NOUN})\b[^.?]{0,40}\band\b[^.?]{0,40}\b(${QUANTITY_NOUN})\b`,
  'i',
)

/** One computation over two operands is ONE demand: "the difference between x and y". */
const OPERANDS_OF_ONE = /\b(?:between|difference|sum of|total of|ratio of|product of|compare|combined|altogether)\b/i

/** A chain producing ONE answer: "...and square the result". */
const CHAINED = /\b(?:the result|this answer|your answer|the answer|then)\b/i

/**
 * A one-mark question wanting two separate numbers.
 *
 * `asksTwoThings` above covers the short-answer case and stops at its first
 * line for anything else, because it requires a `short_answer` key. A live
 * Mathematics paper put these in one-mark WRITTEN slots, which have marking
 * criteria and no key, so none of them were seen:
 *
 *   "Calculate the circumference and area of a circle with a radius of 7 cm."
 *   "Find the square root of 81 and the cube of 3."
 *   "Find the median and range of the list of values: 3, 5, 7, 9, 11."
 *
 * One mark, one box, two numbers wanted. The learner can only lose.
 *
 * Two exclusions, both from real stems on the same paper: "the difference
 * between the mean and the median" is one computation over two operands, and
 * "Calculate the cube root of 64 and square the result" is a chain with a
 * single answer.
 */
export function asksTwoQuantities(q: Record<string, unknown> | unknown): boolean {
  const rec = (q ?? {}) as Record<string, unknown>
  const marks = typeof rec.marks === 'number' ? rec.marks : 1
  if (marks > 1) return false

  const stem = text(rec.question)
  if (!stem) return false
  if (OPERANDS_OF_ONE.test(stem) || CHAINED.test(stem)) return false

  const m = TWO_QUANTITIES.exec(stem)
  // The same noun twice ("the total number") is one thing named twice.
  if (!m || m[1].toLowerCase() === m[2].toLowerCase()) return false

  // An "and" inside a clause of GIVENS joins data, not demands.
  //
  // "Calculate the area of the parallelogram with base 8 cm and height 6 cm"
  // asks for one thing and is told two. What separates it from "Calculate the
  // circumference and area of a circle with a radius of 7 cm" is position:
  // there, the "with" comes after the "and".
  const andAt = stem.toLowerCase().indexOf(' and ', m.index)
  const givensAt = stem.toLowerCase().search(/\b(?:with|given|where|measuring)\b/)
  return !(givensAt >= 0 && andAt >= 0 && givensAt < andAt)
}

function auditShortAnswerScope(q: Record<string, unknown>, i: number, out: AuditFinding[]): void {
  if (!asksTwoThings(q)) return
  const stem = text(q.question)

  out.push({
    code: 'short-answer-asks-two-things',
    severity: 'broken',
    index: i,
    detail: `one-mark short answer asks for two answers: "${stem.slice(0, 70)}"`,
  })
}

function auditLongform(q: Record<string, unknown>, i: number, out: AuditFinding[]): void {
  const marks = typeof q.marks === 'number' ? q.marks : 0
  if (!Number.isInteger(marks) || marks < 1) {
    out.push({ code: 'longform-marks-missing', severity: 'broken', index: i, detail: `marks=${String(q.marks)}` })
  }

  const key = q.short_answer as ShortAnswerKey | undefined
  if (key) {
    auditShortAnswerScope(q, i, out)
    if (isPlaceholderKey(key)) {
      // Marks every learner wrong while looking like a marked question.
      out.push({ code: 'answer-key-unusable', severity: 'broken', index: i, detail: `key is not an answer: ${JSON.stringify(key.accepted?.[0] ?? null)}` })
    }
    if (marks > 1) {
      out.push({ code: 'answer-key-on-extended', severity: 'broken', index: i, detail: `${marks}-mark question matched against a single key` })
    }
    return
  }

  const criteria = Array.isArray(q.marking_criteria) ? q.marking_criteria.filter((c) => text(c)) : []
  if (criteria.length === 0) {
    out.push({ code: 'longform-no-criteria', severity: 'broken', index: i, detail: 'nothing to mark against' })
  } else if (marks >= 10 && criteria.length <= 6) {
    // A composition is banded, not itemised: four descriptors against a
    // 25-mark essay is the shape Cambridge actually uses, and reporting it as
    // a mismatch would flag every English paper on its best question.
  } else if (marks > 0 && criteria.length !== marks) {
    out.push({ code: 'longform-criteria-mismatch', severity: 'poor', index: i, detail: `${criteria.length} criteria for ${marks} marks` })
  }
}

function auditInteractive(q: Record<string, unknown>, i: number, out: AuditFinding[]): void {
  const kind = text(q.kind)
  if (kind === 'multi_select') {
    const options = Array.isArray(q.options) ? q.options : []
    const correct = Array.isArray(q.correct_indices) ? q.correct_indices : []
    if (options.length < 3) out.push({ code: 'tick-too-few-options', severity: 'broken', index: i, detail: `${options.length} options` })
    if (correct.length === 0) out.push({ code: 'tick-no-correct', severity: 'broken', index: i, detail: 'nothing is correct' })
    if (correct.length === options.length && options.length > 0) {
      out.push({ code: 'tick-all-correct', severity: 'poor', index: i, detail: 'every option is correct, so nothing is tested' })
    }
    for (const c of correct) {
      if (typeof c !== 'number' || c < 0 || c >= options.length) {
        out.push({ code: 'tick-index-out-of-range', severity: 'broken', index: i, detail: `index ${String(c)} against ${options.length} options` })
      }
    }
    return
  }
  if (kind === 'categorize') {
    const cats = Array.isArray(q.categories) ? q.categories : []
    const items = Array.isArray(q.items) ? q.items : []
    const assign = Array.isArray(q.correct_category) ? q.correct_category : []
    if (cats.length < 2) out.push({ code: 'table-too-few-columns', severity: 'broken', index: i, detail: `${cats.length} categories` })
    if (items.length < 2) out.push({ code: 'table-too-few-rows', severity: 'broken', index: i, detail: `${items.length} items` })
    if (assign.length !== items.length) {
      out.push({ code: 'table-assignment-mismatch', severity: 'broken', index: i, detail: `${assign.length} assignments for ${items.length} rows` })
    }
    for (const a of assign) {
      if (typeof a !== 'number' || a < 0 || a >= cats.length) {
        out.push({ code: 'table-column-out-of-range', severity: 'broken', index: i, detail: `column ${String(a)} against ${cats.length}` })
      }
    }
    return
  }
  if (!kind) out.push({ code: 'interactive-no-kind', severity: 'broken', index: i, detail: 'interactive question with no kind' })
}

/** Every fault worth knowing about, in the order the questions appear. */
/**
 * A stem that sets a scene and then asks nothing.
 *
 * Live, in a Checkpoint Science paper: question 8 of 34 read, in full, "Iron
 * chains are left outside in the rain." There is no question. The learner is
 * shown an answer box and a mark allocation and has nothing to answer.
 *
 * A real question either ends in a question mark or opens with a command word
 * — the papers are written in exactly those two shapes, and Cambridge prints a
 * closed list of command words for precisely this reason. Anything with
 * neither is a scenario that lost its question.
 */
const COMMANDS =
  '(?:write down|write|state|name|give|identify|list|calculate|work out|find|determine|explain|describe|compare|suggest|show|draw|tick|complete|convert|estimate|measure|label|choose|select|match|order|sort|solve|simplify|expand|factorise|plot|sketch|predict|evaluate|justify|discuss|outline|define|classify' +
  // The arithmetic imperatives a Mathematics paper is mostly made of. Without
  // them "Add 2/5 and 3/7. Show your working." was reported as asking nothing
  // -- a perfectly good question, called broken by the check meant to protect
  // it. A false alarm here costs more than the fault: it sends someone to
  // read a question that was fine.
  '|add|subtract|multiply|divide|round|express|shade|circle|underline|fill in|rearrange|substitute|prove|construct|count|arrange)'

/** A command opening a sentence: "Write the number in expanded form." */
const COMMAND_AT_START = new RegExp(String.raw`^${COMMANDS}\b`, 'i')

/**
 * A command following the clause that sets it up: "If you use 15 cups of
 * orange juice, calculate how many cups of pineapple juice you need."
 *
 * Requiring the command to OPEN the sentence was too strict and called both
 * of those unanswerable. It still excludes a command word buried in narration
 * -- "the students were discussing human reproduction" is not an instruction
 * to discuss -- because nothing there opens a sentence or follows a comma.
 */
const COMMAND_AFTER_CLAUSE = new RegExp(String.raw`[,;]\s+${COMMANDS}\b`, 'i')

/** Nothing but a command word: "Explain", "Name." */
const BARE_COMMAND = new RegExp(String.raw`^\s*${COMMANDS}\s*[.!:]?\s*$`, 'i')

export function asksNothing(stem: string): boolean {
  // The command word the prompt said to open with, and nothing after it.
  // Three of these on one Science paper -- "Explain", "Name", "Describe" --
  // passed, because "Explain" does open a sentence.
  if (BARE_COMMAND.test(stem)) return true
  if (/\?/.test(stem)) return false
  // The command word has to START a sentence, or "the students were discussing
  // human reproduction" would read as a command to discuss.
  return !stem
    .split(/(?<=[.!])\s+/)
    .some((sentence) => {
      const t = sentence.trim()
      return COMMAND_AT_START.test(t) || COMMAND_AFTER_CLAUSE.test(t)
    })
}

/**
 * One scenario sentence spread across the whole paper.
 *
 * A real numbered question may share a scenario between its parts -- that is
 * how Checkpoint is written, and at most three parts share one. What is not
 * legitimate is the same sentence opening questions scattered through the
 * paper, bolted onto unrelated topics.
 *
 * Live, and the reason this check exists: "Iron chains are left outside in the
 * rain." opened eight questions across a Mathematics paper -- on coordinates,
 * on sequences, on lowest common multiple, on the area of a compound shape,
 * even appended AFTER the question. It turned out to be an example sentence in
 * the prompt, which the model copied instead of reading as an illustration.
 *
 * Checking the symptom rather than the cause is deliberate: the next leak will
 * be a different sentence from a different prompt, and this still catches it.
 */
function auditRepeatedScenario(list: unknown[], out: AuditFinding[]): void {
  const openings = new Map<string, number[]>()

  list.forEach((raw, i) => {
    if (typeof raw !== 'object' || raw === null) return
    const stem = text((raw as Record<string, unknown>).question)
    // The first sentence, which is where a shared scenario sits.
    const first = /^[^.!?]{12,120}[.!?]/.exec(stem)?.[0]?.trim()
    if (!first) return
    // "Look at the diagram." is a pointer, not a scenario. Five questions in
    // one paper opened with it and were reported as sharing a scenario, which
    // is exactly the kind of false alarm that sends someone to read five
    // perfectly good questions.
    if (/^(?:look at|study|examine|refer to|consider)\s+(?:the|this)\s+\w+\.?$/i.test(first)) return
    const key = first.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ')
    if (!openings.has(key)) openings.set(key, [])
    openings.get(key)!.push(i)
  })

  for (const [, where] of openings) {
    // Four is past what any numbered question's parts could explain.
    if (where.length < 4) continue
    const stem = text((list[where[0]] as Record<string, unknown>).question)
    out.push({
      code: 'scenario-repeated-across-paper',
      severity: 'broken',
      index: where[0],
      detail: `${where.length} questions open with the same sentence (${where.map((n) => n + 1).join(', ')}): "${stem.slice(0, 50)}"`,
    })
  }
}

export function auditPaper(questions: unknown, options: AuditOptions = {}): AuditFinding[] {
  const out: AuditFinding[] = []
  const list = Array.isArray(questions) ? questions : []

  if (list.length === 0) {
    out.push({ code: 'paper-empty', severity: 'broken', index: -1, detail: 'no questions at all' })
    return out
  }
  if (typeof options.expectedCount === 'number' && list.length !== options.expectedCount) {
    out.push({ code: 'paper-wrong-length', severity: 'broken', index: -1, detail: `${list.length} questions, asked for ${options.expectedCount}` })
  }

  auditRepeatedScenario(list, out)

  const seenStems = new Map<string, number>()

  list.forEach((raw, i) => {
    if (typeof raw !== 'object' || raw === null) {
      out.push({ code: 'question-not-an-object', severity: 'broken', index: i, detail: String(raw) })
      return
    }
    const q = raw as Record<string, unknown>
    const stem = text(q.question)

    if (!stem) {
      out.push({ code: 'stem-empty', severity: 'broken', index: i, detail: 'no question text' })
      return
    }
    if (words(stem) < 4) {
      out.push({ code: 'stem-too-short', severity: 'poor', index: i, detail: `${words(stem)} words: "${stem}"` })
    }
    if (asksNothing(stem)) {
      // Worth more than a wince: the learner cannot answer at all.
      out.push({ code: 'no-question-asked', severity: 'broken', index: i, detail: `no question mark and no command word: "${stem.slice(0, 60)}"` })
    }
    if (words(stem) > 45) {
      out.push({ code: 'stem-too-long', severity: 'poor', index: i, detail: `${words(stem)} words` })
    }

    // A stem promising a picture that is not there cannot be answered. This is
    // the single most common way a generated paper breaks.
    const hasImage = Boolean(text(q.image_url))
    if (!hasImage && VISUAL_PROMISE.test(stem)) {
      out.push({ code: 'visual-promised-not-attached', severity: 'broken', index: i, detail: `"${stem.slice(0, 70)}"` })
    }

    // The book the question was written from is not in front of the learner.
    const ref = bookReference(stem)
    if (ref) {
      out.push({ code: 'cites-the-source-book', severity: 'broken', index: i, detail: `${ref}: "${stem.slice(0, 60)}"` })
    }

    if (/\*\*|^#{1,6}\s/m.test(stem)) {
      out.push({ code: 'markdown-in-stem', severity: 'poor', index: i, detail: 'markdown leaked into the question text' })
    }

    // A text-dependent question with no text attached.
    const hasPassage = Boolean(text(q.passage))
    if (!hasPassage && UNSEEN_TEXT.test(stem)) {
      out.push({ code: 'assumes-unseen-text', severity: 'broken', index: i, detail: `"${stem.slice(0, 70)}"` })
    }
    if (NEEDS_AUDIO.test(stem)) {
      out.push({ code: 'needs-audio', severity: 'broken', index: i, detail: `"${stem.slice(0, 70)}"` })
    }

    const explanation = text(q.explanation)
    if (!explanation) {
      out.push({ code: 'explanation-missing', severity: 'poor', index: i, detail: 'nothing shown after answering' })
    } else if (EXAMINER_VOICE.test(explanation)) {
      out.push({ code: 'explanation-addresses-the-marker', severity: 'poor', index: i, detail: explanation.slice(0, 60) })
    }

    const key = stemKey(q)
    if (key) {
      const first = seenStems.get(key)
      if (first !== undefined) {
        out.push({ code: 'duplicate-question', severity: 'poor', index: i, detail: `same as question ${first + 1}` })
      } else {
        seenStems.set(key, i)
      }
    }

    const type = text(q.type).toLowerCase() || 'mcq'
    if (type === 'longform') auditLongform(q, i, out)
    else if (type === 'interactive') auditInteractive(q, i, out)
    else auditMcq(q, i, out)
  })

  return out
}

/** Counts by code, worst first — what a sweep prints. */
export function summariseFindings(findings: readonly AuditFinding[]): {
  broken: number
  poor: number
  byCode: { code: string; severity: AuditSeverity; count: number }[]
} {
  const tally = new Map<string, { severity: AuditSeverity; count: number }>()
  for (const f of findings) {
    const row = tally.get(f.code) ?? { severity: f.severity, count: 0 }
    row.count += 1
    tally.set(f.code, row)
  }
  return {
    broken: findings.filter((f) => f.severity === 'broken').length,
    poor: findings.filter((f) => f.severity === 'poor').length,
    byCode: [...tally.entries()]
      .map(([code, v]) => ({ code, severity: v.severity, count: v.count }))
      .sort((a, b) => (a.severity === b.severity ? b.count - a.count : a.severity === 'broken' ? -1 : 1)),
  }
}
