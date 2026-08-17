/**
 * How-to text for the interactive question types, plus first-run tracking.
 *
 * These are unfamiliar interaction patterns that shipped with no instruction
 * at all: a student met "drag these into groups" with no idea that tapping was
 * the way, and no worked example. The report's C2, and the direct request for
 * "directions and first-time tutorials… question mark buttons, first time
 * hints".
 *
 * Copy is written to be read in one breath, in the second person, and to name
 * the first physical action rather than describe the concept.
 */

export interface InteractiveHelp {
  /** Short label for the type, used as the dialog heading. */
  title: string
  /** One line under the question, always visible on first encounter. */
  hint: string
  /** Numbered walkthrough shown by the "?" button. */
  steps: string[]
}

const HELP: Record<string, InteractiveHelp> = {
  match: {
    title: 'Matching',
    hint: 'Tap a term on the left, then tap the match that goes with it.',
    steps: [
      'Tap a term in the left column. It lights up to show it is held.',
      'Tap the match on the right that belongs with it.',
      'The pair shows a number and a letter so you can read it back at a glance.',
      'Tap the ✕ on a pair to undo it and choose again.',
    ],
  },
  order: {
    title: 'Putting things in order',
    hint: 'Use the up and down arrows to move each item into the right position.',
    steps: [
      'Read all the items first — the order they start in is scrambled.',
      'Use the ▲ and ▼ buttons on an item to move it up or down.',
      'The number on the left shows its current position.',
      'On a computer you can also drag items by the handle.',
    ],
  },
  categorize: {
    title: 'Sorting into groups',
    hint: 'Tap an item, then tap the group it belongs to.',
    steps: [
      'Tap an item in the "Items to sort" box. It lights up to show it is held.',
      'Tap the group you want to put it in.',
      'The counter tells you how many are still to sort.',
      'Tap an item already in a group to send it back and try again.',
    ],
  },
  fill_blank: {
    title: 'Filling the blanks',
    hint: 'Choose a word from the bank for each gap.',
    steps: [
      'Read the whole sentence first, including the gaps.',
      'Pick a word from the bank for each blank.',
      'Every word is used once unless the question says otherwise.',
      'Change a choice any time before you submit.',
    ],
  },
  true_false: {
    title: 'True or false',
    hint: 'Mark each statement true or false. Every one needs an answer.',
    steps: [
      'Read each statement on its own — they are judged separately.',
      'Tap True or False for each.',
      'Your choice stays highlighted so you can see what is left.',
    ],
  },
  multi_select: {
    title: 'Select all that apply',
    hint: 'More than one answer is correct here — tap every one that applies.',
    steps: [
      'This is not a single-answer question: several options can be right.',
      'Tap each option that applies. Tap again to unselect.',
      'Partial marks are given, so choose what you are sure of.',
    ],
  },
  odd_one_out: {
    title: 'Odd one out',
    hint: 'Three of these belong together. Tap the one that does not.',
    steps: [
      'Work out what most of the items have in common.',
      'Tap the single item that breaks the pattern.',
      'Only one answer can be chosen.',
    ],
  },
}

/** Help for a question kind, or null when the kind has none. */
export function helpFor(kind: unknown): InteractiveHelp | null {
  const key = String(kind ?? '')
  // Own-property check: `kind` comes from model-authored question data, so a
  // value like "constructor" must not resolve to something off the prototype.
  return Object.prototype.hasOwnProperty.call(HELP, key) ? HELP[key] : null
}

const SEEN_KEY = 'ss-interactive-seen'

/** Kinds this browser has already shown the first-run hint for. */
export function readSeen(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(SEEN_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((k) => typeof k === 'string') : []
  } catch {
    return []
  }
}

/** True the first time a student meets this kind of question. */
export function isFirstEncounter(kind: unknown, seen: readonly string[]): boolean {
  const key = String(kind ?? '')
  return helpFor(key) !== null && !seen.includes(key)
}

export function markSeen(kind: unknown): string[] {
  const key = String(kind ?? '')
  const next = Array.from(new Set([...readSeen(), key]))
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify(next))
    } catch {
      // Private mode: the hint simply shows again, which is harmless.
    }
  }
  return next
}
