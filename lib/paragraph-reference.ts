/**
 * "In paragraph C", where the answer is in paragraph D.
 *
 * Shipped, on a live English paper whose passage is lettered A to K:
 *
 *   Q3  "In paragraph C, give the name of the person who taught Mira the art
 *        of laughter in the face of danger."     -- that is paragraph D
 *   Q4  "In paragraph C, write down the name of the person who shared the
 *        secrets of the ancient world with Mira." -- also paragraph D
 *   Q5  "In paragraph C, name the type of book Mira discovered in the
 *        marketplace."                            -- paragraph B
 *   Q6  "In paragraph C, give the colour of the rivers in the hidden realm."
 *                                                 -- paragraph E
 *
 * Four questions in a row, all citing C, none of them about C. The locator is
 * the most useful thing a comprehension question has -- it is how Cambridge
 * points a learner at the right place -- and a wrong one sends them to read
 * the wrong paragraph and find nothing.
 *
 * The model is writing good questions and guessing the letter. So the letter
 * is CORRECTED rather than the question dropped: the answer key says what the
 * answer is, the passage says which paragraph contains it, and those two
 * facts settle it without asking anyone.
 *
 * Only where the answer lands in exactly ONE paragraph. An answer appearing
 * in two is ambiguous and is left alone, and an answer appearing in none is
 * left alone too -- an inference question ("respected", "curious") is
 * answered from the text without being quoted in it, and rewriting those
 * would be guessing.
 */
import { splitIntoParagraphs } from './passage-paragraphs'

export interface ParagraphReferencingQuestion {
  question?: unknown
  passage?: unknown
  short_answer?: unknown
  [key: string]: unknown
}

/** The paragraph letter this stem cites, or ''. */
export function citedParagraph(stem: unknown): string {
  const m = String(stem ?? '').match(/\bparagraph\s+([A-Z])\b/)
  return m ? m[1] : ''
}

/** Each lettered paragraph as its own label plus its lower-cased text. */
function lettered(passage: unknown): { label: string; text: string }[] {
  // The label comes from the splitter, not from the index -- this reads back
  // exactly what the reader printed beside the paragraph.
  return splitIntoParagraphs(String(passage ?? ''))
    .filter((p) => p.label)
    .map((p) => ({ label: p.label, text: p.text.toLowerCase().replace(/\s+/g, ' ') }))
}

/** The longest accepted answer worth searching for, or ''. */
function answerToFind(q: ParagraphReferencingQuestion): string {
  const accepted = (q?.short_answer as { accepted?: unknown })?.accepted
  if (!Array.isArray(accepted)) return ''
  const usable = accepted
    .filter((a): a is string => typeof a === 'string' && a.trim().length > 2)
    .sort((a, b) => b.length - a.length)
  return usable[0] ?? ''
}

/**
 * The stem with its paragraph letter corrected, or the stem unchanged.
 *
 * Unchanged is the common case and the safe one: no citation, no passage, no
 * answer key, an answer in several paragraphs, or an answer in none.
 */
export function correctParagraphLetter(q: ParagraphReferencingQuestion): string {
  const stem = String(q?.question ?? '')
  const letter = citedParagraph(stem)
  if (!letter) return stem

  const paragraphs = lettered(q?.passage)
  if (paragraphs.length < 2) return stem

  const answer = answerToFind(q).toLowerCase().replace(/\s+/g, ' ')
  if (!answer) return stem

  const cited = paragraphs.find((p) => p.label === letter)
  if (cited && cited.text.includes(answer)) return stem

  const holders = paragraphs.filter((p) => p.text.includes(answer))
  if (holders.length !== 1) return stem

  return stem.replace(/\b(paragraph\s+)[A-Z]\b/, `$1${holders[0].label}`)
}

/**
 * Does this stem cite a paragraph the passage does not have?
 *
 * "In paragraph K" on a passage lettered A to F points at nothing at all, and
 * unlike a wrong letter there is nothing here to correct it to.
 */
export function citesAMissingParagraph(q: ParagraphReferencingQuestion): boolean {
  const letter = citedParagraph(q?.question)
  if (!letter) return false
  const paragraphs = lettered(q?.passage)
  if (paragraphs.length === 0) return false
  return !paragraphs.some((p) => p.label === letter)
}
