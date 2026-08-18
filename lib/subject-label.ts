/**
 * Turning a stored subject into something worth showing a student.
 *
 * `assessments.subject` is not a subject — it is whatever the textbook file was
 * called when it was ingested. The live data holds "Advanced Mathematics S6 SB
 * (1)", "Biology S4  SB", "AGRIC S2 SB", "Apply javscript", and at least one
 * document that is somebody's filename outright.
 *
 * Rendered straight into a dashboard those become "Cambridge Primary…",
 * "Impact of Agricultu…" — a column of truncated ellipses that reads as broken
 * software long before anyone questions the layout around it.
 *
 * This cleans the label only. The stored value stays the key everything else
 * matches on, so nothing here can change which quiz belongs to which subject.
 */

/** Trailing ingest noise: "SB", "Student Book", a duplicate marker, a stray extension. */
const TRAILING_NOISE =
  /\s*(?:\((?:\d+)\)|student\s*book|learners?\s*book|\bSB\b|\bTB\b|\bpdf\b|\bdocx?\b|adapted)\s*$/gi
/** A grade or stage marker: S1-S6, Grade 4, Form 2, Primary 5. */
const LEVEL = /\b(?:S[1-6]|Grade\s*\d+|Form\s*\d+|Primary\s*\d+|P[1-7])\b/i

export interface SubjectLabel {
  /** What to show. */
  name: string
  /** The level, when one was found — worth keeping, just not in the name. */
  level?: string
}

export function subjectLabel(raw: unknown): SubjectLabel {
  let text = String(raw ?? '').trim()
  if (!text) return { name: 'Untitled' }

  // Filenames arrive with separators instead of spaces.
  text = text.replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim()

  let level: string | undefined
  const lvl = text.match(LEVEL)
  if (lvl) {
    level = lvl[0].toUpperCase().replace(/\s+/g, ' ')
    text = text.replace(LEVEL, ' ')
  }

  // Strip trailing noise repeatedly: "Biology S4 SB (1)" sheds two things.
  let previous: string
  do {
    previous = text
    text = text.replace(TRAILING_NOISE, '').trim()
  } while (text !== previous && text)

  text = text.replace(/\s+/g, ' ').replace(/[-–—,]+$/, '').trim()
  if (!text) return { name: level ?? 'Untitled', level: undefined }

  // ALL CAPS reads as shouting in a list; leave mixed case alone, since
  // "MicroPython" and "ICT" are written that way on purpose.
  if (text === text.toUpperCase() && /[A-Z]{4,}/.test(text)) {
    text = text
      .toLowerCase()
      .replace(/\b[a-z]/g, (c) => c.toUpperCase())
  }

  return { name: text, level }
}

/** One string for tight spaces: the name, with the level only if it fits. */
export function subjectLabelText(raw: unknown, maxLength = 28): string {
  const { name, level } = subjectLabel(raw)
  if (!level) return name
  const combined = `${name} · ${level}`
  return combined.length <= maxLength ? combined : name
}
