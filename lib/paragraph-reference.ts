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
 * "paragraph 3" turned into the letter the screen shows.
 *
 * The reader letters paragraphs A, B, C; a question that numbers them sends
 * the learner counting, and "paragraph 3" on one ESL paper meant three
 * different things to three readers. Only where the passage has that many.
 */
export function paragraphNumberToLetter(stem: unknown, passage: unknown): string {
  const text = String(stem ?? '')
  const paragraphs = lettered(passage)
  if (paragraphs.length < 2) return text
  return text.replace(/\bparagraph\s+(\d{1,2})\b/gi, (whole, n: string) => {
    const i = Number(n) - 1
    return i >= 0 && i < paragraphs.length ? `paragraph ${paragraphs[i].label}` : whole
  })
}

/** A demand to find a word or phrase in the text, not to infer something. */
const FIND_A_WORD =
  /\b(?:write|copy|find|give|underline|ring|circle|identify|name)\b[^.?]*\b(?:word|words|phrase|verb|verbs|adjective|adverb|noun|pronoun|preposition|connective|modal|conjunction|article|synonym|antonym|expression)\b/i

const contentWordsOf = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 3)

/**
 * A question whose answer is not in the paragraph it sends the learner to.
 *
 * Two shapes, both common on ESL papers in review and both beyond
 * `correctParagraphLetter`, which can only move a letter when the answer
 * sits in exactly one other paragraph:
 *
 *  - "Write the preposition that shows direction in paragraph B." keyed
 *    "into", which is in C and nowhere in B. Only for a find-a-word demand;
 *    "How does Elara feel in paragraph B?" -> "excited" is an inference and
 *    is not expected to be quoted.
 *  - "Tick all the correct statements about paragraph D." whose ticked
 *    statements come from B and C. A ticked statement whose words are far
 *    more at home in another paragraph than in the cited one is about that
 *    other paragraph.
 */
export function paragraphMismatch(q: ParagraphReferencingQuestion): boolean {
  const stem = String(q?.question ?? '')
  const letter = citedParagraph(stem)
  if (!letter) return false
  const paragraphs = lettered(q?.passage)
  const cited = paragraphs.find((p) => p.label === letter)
  if (!cited || paragraphs.length < 2) return false

  const options = Array.isArray((q as Record<string, unknown>).options) ? ((q as Record<string, unknown>).options as unknown[]).map(String) : []
  const ticked = (q as Record<string, unknown>).correct_indices
  if (Array.isArray(ticked) && options.length) {
    const share = (words: string[], text: string) => words.length ? words.filter((w) => text.includes(w)).length / words.length : 0
    for (const i of ticked as number[]) {
      const words = contentWordsOf(options[i] ?? '')
      if (words.length < 3) continue
      const here = share(words, cited.text)
      const best = Math.max(...paragraphs.filter((p) => p !== cited).map((p) => share(words, p.text)))
      if (best >= 0.6 && here < 0.4) return true
    }
    return false
  }

  if (!FIND_A_WORD.test(stem)) return false
  const accepted = (q as { short_answer?: { accepted?: unknown } }).short_answer?.accepted
  if (!Array.isArray(accepted) || accepted.length === 0) return false
  const found = accepted
    .map((a) => String(a ?? '').toLowerCase().trim())
    .filter((a) => a && a.split(/\s+/).length <= 4)
  if (found.length === 0) return false
  const has = (text: string, a: string) => new RegExp(`(?:^|[^a-z])${a.replace(/[^a-z0-9 ]/g, '')}(?:[^a-z]|$)`).test(text)
  return !found.some((a) => has(cited.text, a))
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
