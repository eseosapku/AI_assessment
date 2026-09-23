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
export function sameDemand(a: unknown, b: unknown): boolean {
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
  return shared / Math.min(wa.size, wb.size) >= 0.8
}

/**
 * Drop questions that repeat a demand already on the paper.
 *
 * Keeps the FIRST, which is the one the blueprint placed.
 */
export function dropRepeatedDemands<T extends DemandQuestion>(
  questions: readonly T[],
): { questions: T[]; removed: number } {
  if (!Array.isArray(questions)) return { questions: [], removed: 0 }
  const kept: T[] = []
  let removed = 0
  for (const q of questions) {
    if (kept.some((k) => sameDemand(k.question, q.question))) {
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
