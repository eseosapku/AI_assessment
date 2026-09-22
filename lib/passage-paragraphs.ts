/**
 * Splitting a reading text into lettered paragraphs.
 *
 * Two reasons, and the second is a correctness bug rather than a polish one.
 *
 * A real Cambridge ESL Reading and Usage paper letters the paragraphs of its
 * text, because a whole exercise depends on it: "Match each heading to the
 * correct paragraph." The generator now writes those questions — and on a
 * passage with no labels the question cannot be answered at all, because
 * there is nothing on the page called A.
 *
 * And a 460-word text read forty times needs somewhere for the eye to land.
 * A letter in the margin is what a printed paper gives you.
 *
 * Pure, so it can be tested without a DOM — this project runs vitest in node
 * and has no jsdom.
 */

export interface PassageParagraph {
  /** 'A', 'B', 'C' … in reading order. */
  label: string
  text: string
}

/**
 * Break a passage on blank lines, falling back to single newlines.
 *
 * A model asked for "natural paragraph breaks (blank line between
 * paragraphs)" mostly obliges, and sometimes returns single newlines
 * instead. Both read as paragraphs to a person, so both are treated as
 * paragraphs here rather than showing one unbroken wall.
 */
export function splitIntoParagraphs(passage: unknown): PassageParagraph[] {
  const text = String(passage ?? '').replace(/\r\n/g, '\n').trim()
  if (!text) return []

  let parts = text.split(/\n\s*\n+/).map((p) => p.trim()).filter(Boolean)
  if (parts.length < 2) {
    parts = text.split(/\n+/).map((p) => p.trim()).filter(Boolean)
  }
  // Still one block: a single paragraph is a paragraph, and lettering it "A"
  // alone would be a label with nothing to distinguish it from.
  if (parts.length < 2) return [{ label: '', text }]

  return parts.map((p, i) => ({ label: letterFor(i), text: p }))
}

/** A, B … Z, then AA, AB — though no passage here will ever reach it. */
export function letterFor(index: number): string {
  let n = index
  let out = ''
  do {
    out = String.fromCharCode(65 + (n % 26)) + out
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return out
}

/** Words in the passage, for the reader's header. */
export function wordCount(passage: unknown): number {
  return String(passage ?? '').split(/\s+/).filter(Boolean).length
}

/**
 * Roughly how long this will take to read, in minutes.
 *
 * 180 words a minute is a reasonable pace for a twelve-year-old reading a
 * text they have to answer questions on, which is slower than silent reading
 * for pleasure. Never zero: "0 min" beside a paragraph of text reads as a bug.
 */
export function readingMinutes(passage: unknown): number {
  return Math.max(1, Math.round(wordCount(passage) / 180))
}
