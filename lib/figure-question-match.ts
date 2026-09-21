/**
 * Does the question actually match the picture beside it?
 *
 * The generator never sees the image. It is handed a written description and
 * told to ask a question about it, and that gap is the single largest source
 * of broken exam questions. Every one of these shipped:
 *
 *  - A stock illustration of a road between houses, asked "Work out the size
 *    of angle C if angle D is 120 degrees." There is no angle C. There is no
 *    angle D. There are no labels on the picture at all.
 *  - A mitochondrion diagram labelled "Outer membrane", "Cristae", "DNA",
 *    asked "Name the part labelled A". There is no A.
 *  - A pattern of fifteen painted flowers, described as a pattern, asked about
 *    "the number of cubes" — the learner counted twelve cubes that are not
 *    there.
 *  - A pie chart printing "Mathematics 90°", asked "the percentage of total
 *    exam time spent on Mathematics if the angle for Mathematics is 108
 *    degrees." The stem contradicts the picture it points at.
 *
 * Each is invented detail: a label, an object or a value the model needed and
 * the description did not give it. So the rule is the same in every case — a
 * question may only name what the description actually contains.
 *
 * Nothing here calls a vision model. Generating questions WITH the image is
 * the other way to close this gap, and a bigger change than the fault
 * warrants: the descriptions are good, and refusing to invent is enough.
 */

export interface FigureQuestion {
  question?: unknown
  image_url?: unknown
  options?: unknown
}

/** "the part labelled A", "angle C", "point B", "the region marked X". */
const LABEL_REFERENCE =
  /\b(?:part|point|angle|region|line|side|vertex|section|area|label|arrow|axis|bar|slice|segment)s?\s+(?:labell?ed\s+|marked\s+|named\s+)?([A-Z])\b|\blabell?ed\s+([A-Z])\b/g

/**
 * Letters that are words, units or ordinary capitals rather than labels.
 *
 * "point A" in a diagram is a label; the "A" of "Vitamin A" is not, and
 * neither is the "I" of a sentence beginning with it.
 */
const NOT_A_LABEL = new Set(['I', 'A'])

/**
 * Labels the question names that the description never mentions.
 *
 * Returns them rather than a boolean so the caller can say which, because a
 * log line naming "C, D" is what makes this diagnosable at three in the
 * morning; "figure mismatch" is not.
 */
/**
 * Does the description present this letter AS A LABEL?
 *
 * Not "does the letter appear". Nearly every description begins "A diagram
 * showing…", and taking that article as evidence of a label called A is how
 * the first version of this check passed a mitochondrion asked to name "the
 * part labelled A". The letter has to be doing a label's job.
 */
function descriptionNamesLabel(desc: string, letter: string): boolean {
  if (!desc.trim()) return false
  const L = letter.toUpperCase()
  return (
    // "labelled A", "point A", "the region marked A"
    new RegExp(`\\b(?:labell?ed|marked|named|point|part|angle|region|vertex|line|side|axis|bar|slice|segment)\\s+${L}\\b`, 'i').test(desc) ||
    // "(A)" or "A:" or "A =" or "A –"
    new RegExp(`\\(\\s*${L}\\s*\\)`).test(desc) ||
    new RegExp(`\\b${L}\\s*[:=–—-]\\s`).test(desc) ||
    // "A is the nucleus", "A the nucleus", "A shows the chloroplast"
    new RegExp(`\\b${L}\\s+(?:is|are|the|shows?|represents?|indicates?|points? to)\\b`).test(desc)
  )
}

export function absentLabels(stem: unknown, description: unknown): string[] {
  const text = String(stem ?? '')
  const desc = String(description ?? '')
  if (!text.trim()) return []

  const missing: string[] = []
  for (const m of text.matchAll(LABEL_REFERENCE)) {
    const letter = (m[1] ?? m[2] ?? '').trim()
    if (!letter) continue
    // "A" alone is too common a word to treat as a label UNLESS the stem
    // spells out that it is one: "the part labelled A".
    if (NOT_A_LABEL.has(letter) && !/labell?ed\s+[A-Z]\b/.test(m[0])) continue
    if (descriptionNamesLabel(desc, letter)) continue
    if (!missing.includes(letter)) missing.push(letter)
  }
  return missing
}

/**
 * A question that asks about a labelled part of a figure that has no labels.
 *
 * Deliberately narrow: only fires when the stem points AT the figure and names
 * a label the description does not have. A question that merely mentions the
 * letter A in passing is left alone.
 */
export function namesAbsentLabel(q: FigureQuestion, description: unknown): boolean {
  if (!String(q?.image_url ?? '').trim()) return false
  return absentLabels(q?.question, description).length > 0
}

/**
 * Nouns the question treats as the subject of the picture.
 *
 * "Sam counted the number of cubes in the pattern" against a description of
 * painted flowers. The model needed countable things and invented them.
 */
const COUNTED_THING =
  /\b(?:(?:count(?:ed|ing)?|how\s+many|find)\s+(?:the\s+)?(?:number\s+of\s+)?|number\s+of\s+)([a-z]{3,15})\b/gi

/**
 * Things the question counts that the description does not contain.
 *
 * Only reported when the description is substantial: a two-word description
 * cannot be expected to name everything, and demanding it would strip figures
 * from questions that are perfectly sound.
 */
export function absentCountedNouns(stem: unknown, description: unknown): string[] {
  const text = String(stem ?? '')
  const desc = String(description ?? '').toLowerCase()
  if (!text.trim() || desc.split(/\s+/).length < 8) return []

  const missing: string[] = []
  for (const m of text.matchAll(COUNTED_THING)) {
    const noun = (m[1] ?? '').toLowerCase()
    if (!noun || noun.length < 4) continue
    // Singular or plural, and a crude stem so "cubes" matches "cube".
    const root = noun.replace(/(?:es|s)$/, '')
    if (desc.includes(root)) continue
    if (!missing.includes(noun)) missing.push(noun)
  }
  return missing
}

/**
 * Everything wrong between this question and its figure, as reasons.
 *
 * Empty means the pair is sound as far as this can tell.
 */
export function figureMismatchReasons(q: FigureQuestion, description: unknown): string[] {
  const reasons: string[] = []
  if (!String(q?.image_url ?? '').trim()) return reasons

  const labels = absentLabels(q?.question, description)
  if (labels.length) reasons.push(`names ${labels.join(', ')}, which the figure does not label`)

  const nouns = absentCountedNouns(q?.question, description)
  if (nouns.length) reasons.push(`counts ${nouns.join(', ')}, which the figure does not show`)

  return reasons
}
