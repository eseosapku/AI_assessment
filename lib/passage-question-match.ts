/**
 * Holding a comprehension question to the text it claims to be about.
 *
 * Shipped, on a Cambridge English paper, with no passage anywhere on screen:
 *
 *   "Emily entered The Literary Haven because she wanted to find a book that
 *    would take her on an adventure. Write down the title of the book Mr.
 *    Hawthorne recommended to Emily."
 *   "Clara stumbled upon an ancient oak tree. Write down the name of the woman
 *    who guided Clara in the garden."
 *
 * Three questions of forty-two opened on that same sentence about Clara, and
 * the learner was never shown a word of the story any of them asked about.
 * The model had comprehension foci, no text, and did the only thing left: it
 * invented one per question and asked about the invention.
 *
 * The prompt already says "ask about THIS text". That is trust, and trust has
 * not once been enough in this codebase. A name in the question that is not in
 * the passage is a question with no answer, and that is checkable.
 *
 * Deliberately narrow: it looks for PROPER NOUNS, which is what an invented
 * story brings with it. It says nothing about whether the answer is really
 * findable — only that the thing being asked about exists on the page.
 */

/**
 * Capitalised words that are not somebody's name.
 *
 * Days, months, subjects and the like are legitimately capitalised in a stem
 * about a text that never mentions them, and flagging those would delete good
 * questions to catch bad ones.
 */
const NOT_A_NAME = new Set([
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august',
  'september', 'october', 'november', 'december',
  'english', 'mathematics', 'maths', 'science', 'biology', 'chemistry', 'physics',
  'history', 'geography', 'art', 'music', 'write', 'give', 'name', 'state',
  'explain', 'describe', 'complete', 'tick', 'circle', 'choose', 'look', 'read',
  'which', 'what', 'who', 'where', 'when', 'why', 'how', 'the', 'a', 'an',
  'in', 'on', 'at', 'to', 'from', 'for', 'this', 'that', 'these', 'those',
  'one', 'two', 'three', 'four', 'five', 'both', 'each', 'use', 'using',
  'find', 'work', 'put', 'add', 'draw', 'answer', 'question', 'text', 'passage',
  'yes', 'no', 'true', 'false',
])

/** Titles that attach to a name and should travel with it. */
const TITLE = /^(?:mr|mrs|ms|miss|dr|prof|sir|lady|lord|aunt|uncle|captain|doctor)\.?$/i

/**
 * Proper nouns a question names.
 *
 * A word is a candidate when it is capitalised and is NOT the first word of a
 * sentence — a sentence-initial capital says nothing. "Mr. Hawthorne" is taken
 * whole, so a passage naming "Hawthorne" alone still satisfies it.
 */
export function properNounsIn(stem: unknown): string[] {
  const text = String(stem ?? '')
  if (!text.trim()) return []

  const found: string[] = []
  // Split into sentences — but NOT on the full stop in "Mr.", which split
  // "What did Mr. Hawthorne say?" in two and left the name stranded as the
  // first word of the second half, where it was then skipped.
  const sentences = text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|Prof|St|Sr|Jr|Capt)\.)(?<=[.!?])\s+/)
  for (const sentence of sentences) {
    const words = sentence.trim().split(/\s+/)
    // The first word IS considered.
    //
    // Skipping it was the safe-looking choice and it missed the exact stem
    // that shipped: "Clara stumbled upon an ancient oak tree, what was hidden
    // within its trunk?" — the whole invented story is the first word. A
    // sentence-initial capital is weak evidence on its own, which is what
    // NOT_A_NAME is for; and this only ever runs on a paper that HAS a
    // passage, where an ordinary capitalised word ("Water", "Iron") is almost
    // always in the passage too and so is never reported absent.
    for (let i = 0; i < words.length; i++) {
      const raw = words[i]
      const bare = raw.replace(/^[^A-Za-z]+|[^A-Za-z.]+$/g, '')
      if (!bare || !/^[A-Z]/.test(bare)) continue
      if (NOT_A_NAME.has(bare.toLowerCase().replace(/\.$/, ''))) continue
      // A title takes the word after it as one name.
      if (TITLE.test(bare) && words[i + 1]) {
        const next = words[i + 1].replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, '')
        if (next && /^[A-Z]/.test(next)) {
          if (!found.includes(next)) found.push(next)
          i++
          continue
        }
      }
      const clean = bare.replace(/\.$/, '')
      if (clean.length < 2) continue
      if (!found.includes(clean)) found.push(clean)
    }
  }
  return found
}

/**
 * Which names in this question do not appear in the passage?
 *
 * An empty passage means every one of them is absent, which is the exact case
 * that shipped: comprehension questions with no text at all.
 */
export function namesAbsentFromPassage(stem: unknown, passage: unknown): string[] {
  const names = properNounsIn(stem)
  if (names.length === 0) return []

  const text = String(passage ?? '')
  if (!text.trim()) return names

  const haystack = text.toLowerCase()
  return names.filter((n) => !haystack.includes(n.toLowerCase()))
}

/**
 * Is this question about a story nobody wrote?
 *
 * True when the question names people or places the passage does not contain.
 * The caller deletes it and the retry loop writes a replacement.
 */
export function questionInventsItsOwnText(stem: unknown, passage: unknown): boolean {
  return namesAbsentFromPassage(stem, passage).length > 0
}
