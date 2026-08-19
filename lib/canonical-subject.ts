/**
 * One name per subject, whatever the book was called.
 *
 * `assessments.subject` stores the textbook filename at ingest, so a student
 * taught Biology from four books has four "subjects". On the live corpus that
 * is 137 distinct values for roughly twenty real subjects, and it is upstream
 * of almost everything that looks wrong elsewhere: Progress lists
 * near-duplicates, the gap map splits one weakness across them, Recall decks
 * fragment, and every label truncates.
 *
 * This maps a stored value to the name a student would use. It is a *display
 * and grouping* key — the raw value stays the identifier everything else
 * matches on, so nothing here can change which quiz belongs to which book.
 *
 * Deliberately conservative: a value it cannot confidently resolve is returned
 * cleaned but unmerged. Wrongly merging two subjects would corrupt a student's
 * progress in a way that is invisible and hard to undo, which is far worse than
 * leaving two entries that should have been one.
 */

import { subjectLabel } from './subject-label'

/**
 * Publisher and programme prefixes that sit in front of the real subject.
 * "GENERAL EDU-Chemistry-S3-SB" is a Rwandan general-education series.
 */
const PREFIX_NOISE = /^\s*(?:general\s+edu(?:cation)?|core|adapted)\s*[-–:]?\s*/i

/**
 * Book-type markers. SB is Student Book, PB Pupil's Book, TG Teacher's Guide —
 * they describe the artefact, never the subject.
 */
const BOOK_MARKER = /\b(?:sb|pb|tb|tg|lb|student ?book|pupils? ?book|learners? ?book|teachers? ?guide)\b/gi

/**
 * Edition markers. "Cambridge IGCSE Biology MARRY JONES 4th Ed" is a real
 * stored value; the edition describes the book, never the subject.
 */
const EDITION_MARKER = /\b(?:\d+(?:st|nd|rd|th)\s*(?:ed|edn|edition)|edition|revised|updated)\b/gi

/**
 * Level markers that survive `subjectLabel`, which only lifts the first one.
 * Rwandan primary books are P1–P7, secondary S1–S6.
 */
const LEVEL_MARKER = /\b(?:[SP][1-7]|grade\s*\d+|form\s*\d+|primary\s*\d+|stage\s*\d+)\b/gi

/**
 * National abbreviations that are genuinely a subject, expanded so a student
 * reads a subject rather than a code. Only unambiguous ones belong here.
 */
const ALIASES: ReadonlyArray<[RegExp, string]> = [
  [/^set$/i, 'Science and Elementary Technology'],
  [/^sst$/i, 'Social Studies'],
  [/^agric$/i, 'Agriculture'],
  [/^crs$/i, 'Christian Religious Studies'],
  [/^irs$/i, 'Islamic Religious Studies'],
  [/^ict$/i, 'ICT'],
  [/^maths?$/i, 'Mathematics'],
  [/^eng$/i, 'English'],
  [/^kiny(?:arwanda)?$/i, 'Kinyarwanda'],
]

/**
 * The name to show and to group by.
 *
 * Returns the cleaned original when nothing resolves — never an empty string,
 * and never a guess.
 */
export function canonicalSubject(raw: unknown): string {
  const original = String(raw ?? '').trim()
  if (!original) return 'Untitled'

  // subjectLabel already handles separators, edition markers and the first
  // level marker; this strips what it leaves behind.
  let text = subjectLabel(original).name

  text = text
    .replace(PREFIX_NOISE, ' ')
    .replace(BOOK_MARKER, ' ')
    .replace(EDITION_MARKER, ' ')
    .replace(LEVEL_MARKER, ' ')
    .replace(/[-–—_]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s,.;:-]+|[\s,.;:-]+$/g, '')
    .trim()

  if (!text) return subjectLabel(original).name || original

  for (const [pattern, expanded] of ALIASES) {
    if (pattern.test(text)) return expanded
  }

  // Title case only when the whole thing is shouting, so ICT and MicroPython
  // survive but AGRICULTURE does not.
  if (text === text.toUpperCase() && /[A-Z]{4,}/.test(text)) {
    text = text.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase())
  }

  return text
}

/**
 * Groups rows by canonical subject, keeping every raw value that fed each one.
 *
 * The raw list matters: a screen that merges four books into "Biology" still
 * needs to be able to say which books, and anything writing back has to use a
 * raw value rather than the display name.
 */
export function groupBySubject<T>(
  rows: readonly T[],
  getSubject: (row: T) => unknown,
): Map<string, { rows: T[]; rawSubjects: string[] }> {
  const out = new Map<string, { rows: T[]; rawSubjects: string[] }>()
  for (const row of rows) {
    // Kept verbatim, including trailing spaces: the stored value is the key
    // anything writing back has to match on, and "Biology S5 SB  " is a real
    // row. Trimmed only to decide whether it is empty.
    const raw = String(getSubject(row) ?? '')
    if (!raw.trim()) continue
    const key = canonicalSubject(raw)
    const entry = out.get(key) ?? { rows: [], rawSubjects: [] }
    entry.rows.push(row)
    if (!entry.rawSubjects.includes(raw)) entry.rawSubjects.push(raw)
    out.set(key, entry)
  }
  return out
}
