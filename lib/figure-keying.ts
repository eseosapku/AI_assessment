/**
 * How a figure is keyed, and therefore what it can honestly be asked about.
 *
 * Measured against the manifest, 55% of described figures carry visible
 * labels. That matters because a fully labelled diagram makes identification
 * worthless: asking which part carries the impulse away from the cell body,
 * against a diagram with "Axon" printed on it, is a find-the-word exercise.
 * It passes every check in image-question-quality.ts — the stem neither
 * narrates the figure nor restates the answer — while testing nothing.
 *
 * This is a property of the figure, known before any question is written, so
 * it routes what we ask for rather than judging what came back.
 */

export type FigureKeying =
  /** Parts are named in the image. Naming them back is reading, not knowledge. */
  | 'word-labelled'
  /** Parts carry letters or numbers pointing at unnamed features. */
  | 'letter-keyed'
  /** Nothing is labelled. */
  | 'unlabelled'

export interface KeyingGuidance {
  keying: FigureKeying
  /** What the model should be asked to write for this figure. */
  ask: string
  /** What it must not write. Empty when nothing is off-limits. */
  avoid: string
}

/**
 * A/B/C or 1/2/3 pointing at parts. Matched before the word-label test,
 * because a letter-keyed figure is often *described* as "labelled A to D" and
 * would otherwise be misread as naming its parts.
 */
const LETTER_KEYED =
  /\b(?:labell?ed|marked|numbered|keyed)\s+(?:from\s+)?(?:[A-Z]\s*(?:,|-|–|to|and|through)\s*[A-Z]|\d\s*(?:,|-|–|to|and|through)\s*\d)\b/i

/** The figure names its parts in words. */
const WORD_LABELLED =
  /\b(?:labell?ed|labels?|annotated|captioned)\b|\bkey\s+labels?\b|\blegend\b|\bwith\s+labels\b/i

export function classifyFigure(description: unknown): FigureKeying {
  const text = String(description ?? '')
  if (!text.trim()) return 'unlabelled'
  if (LETTER_KEYED.test(text)) return 'letter-keyed'
  if (WORD_LABELLED.test(text)) return 'word-labelled'
  return 'unlabelled'
}

/**
 * Instructions for the model, per keying.
 *
 * Phrased as a demand for a kind of thinking rather than a ban on a phrase:
 * telling a model not to ask naming questions produces naming questions with
 * different wording, whereas asking for a consequence produces a consequence.
 */
export function guidanceFor(keying: FigureKeying): KeyingGuidance {
  switch (keying) {
    case 'word-labelled':
      return {
        keying,
        ask: 'Ask what the labels do NOT give away: what a part does, how two parts relate, what happens if one changes, the order events occur in, or why the arrangement matters.',
        avoid: 'Do NOT ask the student to name, identify or pick out any part — every name is printed on this figure, so that tests reading, not knowledge.',
      }
    case 'letter-keyed':
      return {
        keying,
        ask: 'Ask the student to name what a letter or number points at, or to say what the marked part does. The names are not written on the figure, so they must supply them.',
        avoid: '',
      }
    default:
      return {
        keying,
        ask: 'Ask the student to read a value, compare two regions, describe what is happening, or draw a conclusion from what is shown.',
        avoid: '',
      }
  }
}

/** One catalogue line for the prompt, carrying its keying and instructions. */
export function describeForPrompt(entry: {
  key: string
  page: number
  category: string
  description: string
}): string {
  const keying = classifyFigure(entry.description)
  const g = guidanceFor(keying)
  const avoid = g.avoid ? ` ${g.avoid}` : ''
  return `- image_key: "${entry.key}" | page ${entry.page} | ${entry.category} | ${keying}\n  Shows: ${entry.description}\n  For this figure: ${g.ask}${avoid}`
}
