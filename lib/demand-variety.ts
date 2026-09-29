/**
 * Two questions that ask the same thing, and a pointer written the same way.
 *
 * Counted off live papers rather than guessed at. The repeats that survived
 * every other guard:
 *
 *   x9  "referring to the diagram"     an unvaried pointer at a figure that
 *                                      is printed beside the question anyway
 *   x2  "Write the name of the village where Elara lived."
 *       "Write the name of the village where Elara lives."
 *   x2  "In paragraph E, what did Elara find at the base of the ancient oak?"
 *       "In paragraph G, what did Elara find at the base of the ancient oak?"
 *
 * The last two are the same question twice. The existing deduplicator compares
 * stems and sees three differences -- a tense, a paragraph letter, a word --
 * so both go through. What makes them duplicates is the DEMAND: strip the
 * pointer and the paragraph reference, and they are identical.
 *
 * The prompt was told not to write "Referring to the diagram" and wrote it
 * nine times, which is the lesson this codebase keeps relearning: an
 * instruction the model can ignore is not a rule.
 */

export interface DemandQuestion {
  question?: unknown
  [key: string]: unknown
}

/**
 * The pointer sentences a question uses to send the reader to a figure.
 *
 * Removed for COMPARISON only -- "Look at the diagram" is good writing and
 * stays in the question. It just says nothing about whether two demands are
 * the same demand.
 */
const POINTER = new RegExp(
  String.raw`^\s*(?:referring to|look at|use|using|read(?:ing)? off|according to|based on|from)\s+` +
  String.raw`(?:the|this|your)\s+(?:diagram|figure|picture|graph|chart|table|circuit|apparatus|grid|text|passage)\s*[,.:]?\s*`,
  'i',
)

/** "In paragraph E," — a location, not part of what is being asked. */
const PARAGRAPH = new RegExp(String.raw`\b(?:in|from)\s+paragraph\s+[a-z0-9]+\s*[,.]?\s*`, 'i')
const PARAGRAPH_TAIL = new RegExp(String.raw`\s*\(\s*paragraph\s+[a-z0-9]+\s*\)\s*\.?\s*$`, 'i')

/** What this question actually asks, with the scaffolding taken off. */
export function demandOf(stem: unknown): string {
  let text = String(stem ?? '').trim()
  text = text.replace(PARAGRAPH_TAIL, '')
  // A pointer may open either the stem or the sentence after the scenario.
  for (let i = 0; i < 2; i++) text = text.replace(POINTER, '')
  text = text.replace(PARAGRAPH, '')
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Do these two ask the same thing?
 *
 * Content words, because a tense is not a difference: "where Elara lived" and
 * "where Elara lives" are one question asked twice.
 */
export function sameDemand(a: unknown, b: unknown, bySubject = true): boolean {
  const stem = (s: unknown) => {
    const words = demandOf(s).split(' ').filter((w) => w.length > 3)
    // Crude stemming: the tense is exactly the difference to ignore.
    return new Set(words.map((w) => w.replace(/(?:ed|ing|s)$/, '')))
  }
  const wa = stem(a)
  const wb = stem(b)
  if (wa.size < 3 || wb.size < 3) return false
  let shared = 0
  for (const w of wa) if (wb.has(w)) shared++
  if (shared / Math.min(wa.size, wb.size) >= 0.8) return true
  if (sameNumbers(a, b)) return true
  return bySubject && sameSubjectAsked(a, b)
}

/** The last sentence of a stem -- the demand, once any scenario is set aside. */
function lastSentence(stem: unknown): string {
  const sentences = String(stem ?? '')
    .split(/(?<=[.!?])\s+/)
    .map((x) => x.trim())
    .filter(Boolean)
  return sentences[sentences.length - 1] ?? ''
}

/**
 * The opening sentence of a stem that has a scenario still attached, or ''.
 *
 * Normalised, so the same scenario written into two parts compares equal
 * whatever the punctuation. A one-sentence stem has no lead-in.
 */
function leadIn(stem: unknown): string {
  const sentences = String(stem ?? '')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (sentences.length < 2) return ''
  return sentences[0].toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * The same data, asked about twice.
 *
 * "Work out the nth term of the sequence 3, 7, 11, 15" at Q9 and "Determine
 * the nth term of the sequence: 3, 7, 11, 15... Explain your reasoning" at Q29
 * on one live paper: different verbs, 40% of words in common, the same four
 * numbers in the same order. Three or more numbers, identical and in order,
 * is the same data set -- and parts of one question that genuinely share it
 * are exempted by the caller, since they share a scenario.
 */
function sameNumbers(a: unknown, b: unknown): boolean {
  const nums = (s: unknown) => (String(s ?? '').match(/-?\d+(?:\.\d+)?/g) ?? []).join(',')
  const na = nums(a)
  const nb = nums(b)
  return na !== '' && na === nb && na.split(',').length >= 3
}

/**
 * The same thing asked about, in different words.
 *
 * One live Science paper asked, as three separate questions:
 *
 *   "Explain how the Arctic hare's fur colour helps it survive."
 *   "Explain how the Arctic hare's fur colour aids in its survival."
 *   "Explain how the Arctic hare's fur colour is an adaptation to its habitat."
 *
 * 67% of content words in common against an 80% bar, because the words that
 * differ -- survive, survival, aids, adaptation -- are exactly the ones that do
 * not matter. What matters is the command and the SUBJECT, and those match.
 *
 * So: same opening command, and at least three subject words in common
 * making up most of the smaller stem, once the command and the generic
 * predicate words are set aside. The caller exempts parts of one question,
 * which share a scenario and a subject on purpose.
 */
const COMMAND_WORDS = new Set([
  'explain', 'describe', 'state', 'name', 'give', 'write', 'down', 'suggest',
  'identify', 'compare', 'discuss', 'calculate', 'work', 'find', 'show', 'tick',
  'draw', 'complete', 'choose', 'using', 'look', 'what', 'which', 'does', 'this',
  'that', 'with', 'from', 'into', 'their', 'there', 'about',
  // "Draw a ring around" is the ESL multiple-choice frame, not a subject.
  'ring', 'around', 'through',
])
const PREDICATE_WORDS = new Set([
  'help', 'helps', 'aid', 'aids', 'assist', 'surviv', 'survive', 'survival',
  'adapt', 'adaptation', 'adapted', 'role', 'import', 'importance', 'important',
  'affect', 'affects', 'effect', 'effects', 'impact', 'impacts', 'contribut',
  'relat', 'relationship', 'used', 'use', 'work', 'works', 'function',
  'environment', 'habitat', 'each', 'other', 'main', 'purpose',
])

function subjectWordsOf(stem: unknown): Set<string> {
  return new Set(
    demandOf(stem)
      .split(' ')
      .filter((w) => w.length > 3 && !COMMAND_WORDS.has(w))
      .map((w) => w.replace(/(?:ation|ing|ed|al|s)$/, ''))
      .filter((w) => w.length > 2 && !PREDICATE_WORDS.has(w)),
  )
}

export function sameSubjectAsked(a: unknown, b: unknown): boolean {
  // The DEMAND, not the whole stem: a scenario in front of it would otherwise
  // make the "command" whatever word the scenario starts with.
  const da = lastSentence(a)
  const db = lastSentence(b)
  const verb = (s: string) => demandOf(s).split(' ')[0] ?? ''
  if (!verb(da) || verb(da) !== verb(db)) return false
  const sa = subjectWordsOf(da)
  const sb = subjectWordsOf(db)
  let shared = 0
  for (const w of sa) if (sb.has(w)) shared++
  // Against the LARGER set, so what differs has to be small as well as what
  // matches being large. "Name the heat transfer method occurring between the
  // sun and the ground" and "... occurring as warm air rises" share four
  // subject words and are two different questions -- radiation and
  // convection -- and it is the two words each has alone that say so.
  return shared >= 3 && shared / Math.max(sa.size, sb.size) >= 0.75
}

/**
 * Drop questions that repeat a demand already on the paper.
 *
 * Keeps the FIRST, which is the one the blueprint placed.
 */
export function dropRepeatedDemands<T extends DemandQuestion>(
  questions: readonly T[],
  options: { bySubject?: boolean } = {},
): { questions: T[]; removed: number } {
  const bySubject = options.bySubject !== false
  if (!Array.isArray(questions)) return { questions: [], removed: 0 }
  const kept: T[] = []
  let removed = 0
  for (const q of questions) {
    // Parts of one question share a scenario and a subject by design --
    // "(a) name the force, (b) explain its effect" -- and are not repeats.
    //
    // Recognised two ways, because the scenario is lifted onto its own field
    // AFTER this runs: before that, parts carry their shared lead-in at the
    // front of the stem. Matching only the field never fired in the route, and
    // on a Primary Science paper eleven parts were removed in one pass as
    // repeats of each other -- same lead-in, and for "Sam measured 4, 7 and 9"
    // the same numbers too. That paper came back 22 of 31.
    const scenario = String((q as { scenario?: unknown }).scenario ?? '').trim()
    const lead = leadIn(q.question)
    const partOf = (k: T) =>
      (scenario !== '' && String((k as { scenario?: unknown }).scenario ?? '').trim() === scenario) ||
      (lead !== '' && leadIn(k.question) === lead)
    if (kept.some((k) => !partOf(k) && sameDemand(k.question, q.question, bySubject))) {
      removed++
      continue
    }
    kept.push(q)
  }
  return { questions: kept, removed }
}

/**
 * Take the dead pointer off a stem.
 *
 * "Referring to the diagram, name the structure." becomes "Name the
 * structure." The figure is printed in its own column beside the question, so
 * the pointer was never doing any work -- and written the same way nine times
 * on one paper it is the thing that makes a paper read as one question.
 *
 * "Look at the diagram." is left alone: it is how the real papers open, and
 * it is only a problem when it is the ONLY way they open.
 */
/**
 * The mark allocation a printed paper puts at the end of a question.
 *
 * A real Cambridge paper prints "[2]" in the right margin, and the style
 * examples this generator learns from are lifted from real papers, so the
 * model writes it into the stem. The screen already shows the marks in their
 * own chip beside the question number, so the learner reads:
 *
 *   Question 14 of 34    [2 marks]
 *   Calculate the average speed of a marble rolling down an inclined
 *   plane. [2]
 *
 * Only a trailing allocation is removed, and only when the stem has something
 * left. A bracketed number INSIDE a question is content -- "the value at [3]
 * on the number line", "element [2] of the array" -- and is left alone.
 */
export function stripPrintedMarks(stem: unknown): string {
  const text = String(stem ?? '').trim()
  if (!text) return text
  const stripped = text
    .replace(/\s*[[(]\s*\d{1,2}\s*(?:marks?)?\s*[\])]\s*$/i, '')
    .replace(/\s*[-–—]\s*\d{1,2}\s*marks?\s*$/i, '')
    .trim()
  return stripped.split(/\s+/).filter(Boolean).length >= 3 ? stripped : text
}

/**
 * "Write your answer." — a sentence that says nothing.
 *
 * A real paper writes "Write your answer to one decimal place" or "Give your
 * answer in its simplest form": the instruction is the qualifier. Without one
 * it is an imperative with no object, sitting after a question that already
 * has an answer box:
 *
 *   "Calculate the mean number of borrows from the table. Write your answer."
 *
 * Only the bare form is removed, and only from the end. Anything carrying a
 * qualifier is left exactly as it is.
 */
export function stripEmptyAnswerInstruction(stem: unknown): string {
  const text = String(stem ?? '').trim()
  if (!text) return text
  const stripped = text
    .replace(/\s*(?:write|give|state)\s+(?:your|the)\s+answer\s*[.!]?\s*$/i, '')
    .trim()
  // Never leave a stem that is not still a question.
  return stripped.split(/\s+/).filter(Boolean).length >= 3 ? stripped : text
}

export function stripDeadPointer(stem: unknown): string {
  const text = String(stem ?? '').trim()
  const stripped = text.replace(
    new RegExp(String.raw`^\s*referring to\s+(?:the|this|your)\s+(\w+)\s*[,.:]?\s*`, 'i'),
    '',
  )
  if (stripped === text || !stripped.trim()) return text
  // Recapitalise, since the sentence just lost its opening.
  return stripped.charAt(0).toUpperCase() + stripped.slice(1)
}
