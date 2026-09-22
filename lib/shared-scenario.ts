/**
 * The scenario belongs to the QUESTION, not to each of its parts.
 *
 * A real Checkpoint question is one situation with four or five demands
 * hanging off it:
 *
 *   12  When Galileo observed the night sky he saw four points of light
 *       moving around Jupiter.
 *       (a) Name the force that keeps them in orbit.          [1]
 *       (b) Explain why they change position each night.      [2]
 *       (c) Suggest why Galileo could not see them with his eyes alone. [1]
 *
 * The blueprint now builds papers that way -- five parts to a question,
 * counted off 46 real ones. But the screen shows one part at a time, so each
 * part arrived carrying the whole scenario, and a learner paging through saw:
 *
 *   "When Galileo observed the night sky ... Name the force ..."
 *   "When Galileo observed the night sky ... Explain why ..."
 *   "When Galileo observed the night sky ... Suggest why ..."
 *
 * Five questions that look identical for their first twenty words. That is
 * the reported "all the questions are basically the same", and stripping the
 * scenario is not the answer -- without it the demand cannot be answered.
 *
 * So the scenario is LIFTED OUT: off the stem, onto its own field, rendered
 * once as reference material beside the demand the way the figure and the
 * passage already are. The learner keeps the context; the question reads as
 * a question.
 *
 * Matched fuzzily, on content words, because the model does not restate a
 * scenario verbatim -- "When Galileo observed the night sky" and "When
 * Galileo observed the moons of Jupiter" are the same lead-in and an exact
 * comparison sees two different sentences.
 */

export interface ScenarioQuestion {
  question?: unknown
  /** Lifted here, off the stem. */
  scenario?: string
  [key: string]: unknown
}

/** The content words of a sentence, for comparing two lead-ins. */
function contentWords(sentence: string): string[] {
  return sentence
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3)
}

/** Do these two openings set up the same situation? */
function sameLeadIn(a: string, b: string): boolean {
  const wa = contentWords(a)
  const wb = contentWords(b)
  if (wa.length < 3 || wb.length < 3) return false
  const setB = new Set(wb)
  const shared = wa.filter((w) => setB.has(w)).length
  // Half the shorter one's content words in common.
  //
  // Measured against the real thing: "When Galileo observed the night sky he
  // saw four points of light near Jupiter" and "When Galileo observed the
  // moons of Jupiter he used a telescope" are the same question's parts and
  // score 0.57. The model never restates a scenario twice the same way, so a
  // two-thirds bar sees two different questions and leaves the repetition in.
  //
  // Safe at this level because it only ever compares ADJACENT questions:
  // two unrelated stems that happen to share half their content words AND sit
  // next to each other is not a thing a blueprint with a focus per slot
  // produces.
  return shared / Math.min(wa.length, wb.length) >= 0.5
}

/**
 * Command words that begin a demand. A comma in front of one of these is a
 * full stop the model got wrong.
 */
const DEMAND_START = [
  'write', 'explain', 'describe', 'give', 'name', 'state', 'calculate',
  'work out', 'find', 'complete', 'tick', 'circle', 'draw', 'suggest',
  'identify', 'match', 'choose', 'show', 'compare', 'list', 'order',
  'define', 'outline', 'predict', 'measure', 'use',
].join('|')

function sentencesOf(stem: string): string[] {
  // "Theo wandered into The Whispering Pages, Explain how Elara's demeanour
  // is described." -- six questions on one paper opened exactly that way. It
  // is one sentence to a splitter looking for a full stop, so the scenario
  // could never be lifted off it, and the comma-then-capital is ungrammatical
  // anyway. A comma before a capitalised command word is a sentence break.
  const normalised = stem.replace(
    new RegExp(String.raw`,\s+(?=(?:${DEMAND_START})\b)`, 'gi'),
    '. ',
  )
  return normalised.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean)
}

/**
 * Lift a shared opening off a run of questions.
 *
 * Only a RUN: parts of one numbered question are adjacent, and two questions
 * ten apart that happen to open alike are a different problem (see
 * `dropRepeatedScenarios`, which deletes those). Only where the opening is a
 * real sentence of setup, and never where removing it would leave the
 * question with nothing.
 */
export function liftSharedScenarios<T extends ScenarioQuestion>(questions: readonly T[]): T[] {
  if (!Array.isArray(questions) || questions.length < 2) return [...(questions ?? [])]

  const out = questions.map((q) => ({ ...q }))
  let i = 0
  while (i < out.length) {
    const first = sentencesOf(String(out[i].question ?? ''))
    // A lead-in is a sentence of setup followed by a demand. One sentence is
    // the demand itself.
    if (first.length < 2 || contentWords(first[0]).length < 3) { i++; continue }

    let j = i + 1
    while (j < out.length) {
      const next = sentencesOf(String(out[j].question ?? ''))
      if (next.length < 2 || !sameLeadIn(first[0], next[0])) break
      j++
    }

    // Two or more in a row sharing a lead-in is a question with parts.
    if (j - i >= 2) {
      const scenario = first[0]
      for (let k = i; k < j; k++) {
        const rest = sentencesOf(String(out[k].question ?? '')).slice(1).join(' ').trim()
        if (!rest) continue
        out[k].scenario = scenario
        out[k].question = rest
      }
      i = j
      continue
    }
    i++
  }
  return out
}
