// lib/studylab/check/placement.ts
import { seededShuffle } from '@/lib/studylab/activities/shuffle'

/**
 * Where things go in a fill, an order or a tap: tap-to-select then
 * tap-to-place, by mouse or keyboard. An empty place is ''.
 */

/**
 * Puts a piece in a place. A piece already placed elsewhere moves (and the
 * piece it lands on goes to where it came from, so an order rearranges in one
 * move); a piece from the bank sends whatever it replaces back to the bank.
 */
export function placeInto(value: string[], at: number, piece: string): string[] {
  const next = [...value]
  const from = next.indexOf(piece)
  const displaced = next[at] ?? ''
  next[at] = piece
  if (from >= 0 && from !== at) next[from] = displaced
  return next
}

export function clearAt(value: string[], at: number): string[] {
  const next = [...value]
  next[at] = ''
  return next
}

/** The bank in its own order, less what has been placed. */
export function unplaced(pool: string[], value: string[]): string[] {
  return pool.filter((p) => !value.includes(p))
}

/** A tapped part in or out. */
export function toggle(value: string[], id: string): string[] {
  return value.includes(id) ? value.filter((v) => v !== id) : [...value, id]
}

function seedOf(text: string): number {
  return [...text].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7) || 1
}

/** An order's items as shown: shuffled the same way every time, and never in the right order. */
export function shuffledItems(items: string[], seed: string): string[] {
  const shown = seededShuffle(items, seedOf(seed))
  if (items.length > 1 && shown.every((item, i) => item === items[i])) return [...shown.slice(1), shown[0]]
  return shown
}

export type SentencePart = { text: string } | { blank: number }

/** A fill sentence as text and numbered blanks, in order. */
export function sentenceParts(text: string): SentencePart[] {
  const parts: SentencePart[] = []
  let blank = 0
  for (const [i, chunk] of text.split(/_{3,}/).entries()) {
    if (i > 0) parts.push({ blank: blank++ })
    if (chunk) parts.push({ text: chunk })
  }
  return parts
}

/** The sentence with what was placed, and a gap where nothing was. */
export function filledSentence(text: string, values: string[]): string {
  return sentenceParts(text).map((p) => ('text' in p ? p.text : values[p.blank]?.trim() || '___')).join('')
}
