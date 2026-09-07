/**
 * Questions that cite the book the student is not holding.
 *
 * Measured on the live site: 34 of 11,826 saved stems, and every one of them
 * the same shape — *"Describe the process of diffraction … Use the diagram on
 * page 286 to support your explanation."*, *"Using the Python Shell window
 * shown on page 255, describe how a simple 'Hello World!' program is
 * executed."*, *"the anti-social behaviors described in Unit 9"*.
 *
 * The cause is one omission in the prompt. Textbook-sourced generation hands
 * the model a chapter and says "use ONLY the source material"; nothing ever
 * said the student cannot see it. So the book's own furniture — page numbers,
 * Figure 28.3, "in Unit 9" — is copied into the stem, where it points at
 * nothing on screen.
 *
 * `dangling-reference.ts` misses all of them, and correctly so by its own
 * terms: it looks for a promise of *attached* content ("the diagram above"),
 * and a page number is neither one of its nouns nor one of its deictics.
 *
 * Three outcomes, in this order:
 *
 *  1. The reference sits in a sentence whose only job is to send the student to
 *     the book — "Use the diagram on page 286 to support your explanation."
 *     The sentence goes and the question stands.
 *  2. The reference is load-bearing but the figure is attached anyway. The
 *     locator goes: "Using the table on page 23, calculate…" becomes "Using the
 *     table, calculate…", and the student reads it off the picture.
 *  3. Neither. The question cannot be answered on this screen, and
 *     `danglingReference` drops it so the top-up can replace it.
 */

export type BookReferenceKind = 'page' | 'figure-number' | 'chapter' | 'book'

interface Locator {
  kind: BookReferenceKind
  /**
   * Written to swallow the preposition in front of it, so removing a match
   * leaves a sentence rather than a hole: " on page 23" goes, "page 23" alone
   * still matches for detection.
   */
  pattern: RegExp
}

const LOCATORS: readonly Locator[] = [
  { kind: 'page', pattern: /(?:\s*\b(?:on|in|from|at|see|of)\b)?\s*\bpages?\s+\d{1,4}(?:\s*[–—-]\s*\d{1,4})?\b/i },
  { kind: 'page', pattern: /(?:\s*\b(?:on|in|from|at|see)\b)?\s*\bpp?\.\s*\d{1,4}(?:\s*[–—-]\s*\d{1,4})?\b/i },
  { kind: 'page', pattern: /\s*\b(?:on|in)\s+the\s+(?:previous|next|opposite|facing|following)\s+page\b/i },
  // "the book" on its own is an ordinary noun — a book rests on a table, a
  // book costs 3.75 francs, Eliza wants to pawn a book. Only the study book,
  // or a plain book reached through a deictic verb, is the one they cannot see.
  { kind: 'book', pattern: /\s*\b(?:of|in|from|to)\s+(?:the|your|our)\s+(?:text\s?books?|coursebooks?|student'?s?\s+books?)\b(?!\s+(?:figure|diagram|table|graph|chart|image|photo|illustration|example|page|chapter|section)\b)/i },
  { kind: 'book', pattern: /\s*\b(?:as\s+)?(?:described|discussed|explained|outlined|stated|mentioned|listed|covered|presented|shown|set\s+out|given)\s+in\s+(?:the|your|our)\s+books?\b/i },
  // "the textbook figure" — the book used as an adjective. Only the word
  // "textbook" is the problem here, so only it is taken: what is left is "the
  // figure", which is what the student is actually looking at.
  // "example" is deliberately absent: "a textbook example of erosion" is an
  // idiom about how typical something is, and has nothing to do with a book.
  { kind: 'book', pattern: /\btext\s?books?\s+(?=(?:figure|diagram|table|graph|chart|image|photo|illustration|page|chapter|section)\b)/i },
  // A dotted number is how a textbook labels its own figures: "Figure 28.3",
  // "Activity 12.2". A bare "Table 3" is far more often the student's own data.
  { kind: 'figure-number', pattern: /(?:\s*\b(?:in|on|of|from|see|to)\b)?\s*\b(?:fig|figure|table|diagram|chart|activity|exercise|box|photo(?:graph)?)\s*\.?\s*\d+\.\d+\b/i },
  { kind: 'figure-number', pattern: /(?:\s*\b(?:in|on|from|see|to)\b)?\s*\bfig\.\s*\d+\b/i },
  { kind: 'chapter', pattern: /(?:\s*\b(?:in|from|see|of)\b)?\s*\b(?:chapters?|units?|sections?|modules?|topics?)\s+\d+\b/i },
]

/**
 * A real document cited by chapter — "Chapter 4 of the Constitution", "Section
 * 3 of the Companies Act" — is the subject of the question, not the book it was
 * set from. The capital letter is what separates it from "of the textbook".
 */
const CITES_A_NAMED_DOCUMENT = /^\s*of\s+(?:the\s+)?[A-Z]/

/** What the stem points at outside this screen, or null when nothing does. */
export function bookReference(text: unknown): BookReferenceKind | null {
  const s = String(text ?? '')
  if (!s.trim()) return null

  for (const { kind, pattern } of LOCATORS) {
    const m = s.match(pattern)
    if (!m || m.index === undefined) continue
    if (CITES_A_NAMED_DOCUMENT.test(s.slice(m.index + m[0].length))) continue
    return kind
  }
  return null
}

function tidy(s: string): string {
  return s
    .replace(/\(\s*\)/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([,.;:?!])/g, '$1')
    .replace(/,\s*,/g, ',')
    .trim()
}

/**
 * The same text with every locator removed.
 *
 * Safe on anything the student reads that is not the question itself — a hint
 * saying "look at the diagram on page 286" loses nothing by losing the page.
 * On a stem it is only safe once the figure is known to be attached, which is
 * why the caller decides rather than this function.
 */
export function stripBookLocators(text: string): string {
  let out = text
  for (const { pattern } of LOCATORS) {
    const global = new RegExp(pattern.source, 'gi')
    // None of the patterns capture, so the second argument is the offset.
    out = out.replace(global, (match: string, offset: number) =>
      CITES_A_NAMED_DOCUMENT.test(out.slice(offset + match.length)) ? match : '',
    )
  }
  return tidy(out)
}

/**
 * Attribution rather than direction: "According to the textbook, what is a
 * constellation?", "…is most sustainable according to the textbook?", "the
 * sources of wealth discussed in Unit 10".
 *
 * These carry no content. Nothing is on the far end of the pointer that the
 * question needs — it is saying where the answer came from, to a student who
 * cannot go and look. Cutting it leaves the question whole, so it is cut
 * wherever it sits, first clause included.
 *
 * Only the study book qualifies. A plain "in the book" is left to be dropped,
 * because a question that leans on "the book" is usually leaning on it for real
 * — "Which of these is mentioned in the book?" survives this cut as "Which of
 * these is mentioned?", which is worse, not better.
 */
const ATTRIBUTIONS: readonly RegExp[] = [
  // The lookahead keeps "Referring to the textbook figure" out of this: there,
  // the book is an adjective on a noun the student can see, not the place the
  // answer lives, and cutting the phrase leaves "Referring figure".
  /(?:^|[\s,])\s*(?:as\s+)?(?:according\s+to|described\s+in|discussed\s+in|explained\s+in|outlined\s+in|stated\s+in|mentioned\s+in|listed\s+in|covered\s+in|presented\s+in|set\s+out\s+in|given\s+in|found\s+in|taught\s+in|based\s+on|in|from)\s+(?:the|your|our)\s+(?:text\s?books?|coursebooks?|student'?s?\s+books?)(?!\s+(?:figure|diagram|table|graph|chart|image|photo|illustration|example|page|chapter|section)\b)(?:\s*,)?/gi,
  /(?:^|[\s,])\s*(?:as\s+)?(?:described|discussed|explained|outlined|stated|mentioned|listed|covered|presented|taught|introduced)\s+in\s+(?:chapters?|units?|sections?|modules?|topics?)\s+\d+(?:\s*,)?/gi,
]

/**
 * Restores the capital a removed opening clause took with it.
 *
 * "According to the textbook, what is a constellation?" loses its only capital
 * along with the clause, and so does the second sentence of "…magnesium oxide.
 * According to the textbook, what type of oxide is this?" — which is why this
 * looks at every sentence rather than only the first.
 */
function restoreSentenceCase(text: string): string {
  return text
    .replace(/^([a-z])/, (c) => c.toUpperCase())
    .replace(/([.?!]\s+)([a-z])/g, (_, gap: string, c: string) => `${gap}${c.toUpperCase()}`)
}

function dropAttributions(text: string): string {
  let out = text
  for (const pattern of ATTRIBUTIONS) out = out.replace(pattern, '')
  return out === text ? text : restoreSentenceCase(tidy(out))
}

/**
 * Opens a run of words that exists only to send the reader somewhere else.
 *
 * The bracket in the character class is for "(Refer to the diagram on page
 * 143)", which is the same pointer wearing a different hat.
 */
const CONSULT_OPENER =
  /^[\s([]*(?:and\s+)?(?:you\s+(?:should|can|may|must)\s+)?(?:use|using|refer(?:ring)?\s+to|see|consult|study|look\s+at|read|examine|base\s+your\s+answer\s+on|(?:as\s+)?(?:described|discussed|explained|outlined|stated|mentioned|listed|covered|presented|shown|seen|illustrated|set\s+out|given)\s+in|according\s+to|based\s+on|with\s+reference\s+to|(?:provide|provides?|providing|give|giving|include|including|quote|cite)?\s*(?:an?|one|two|three|some|several|specific|relevant|suitable|appropriate|\d+)?\s*examples?\s+from)\b/i

/**
 * The consult verb is doing real work, not pointing: "Use the graph on page 12
 * to determine the gradient" is the question, and deleting it deletes the task.
 */
const ASKS_FOR_WORK =
  /\bto\s+(?:calculate|determine|find|work\s+out|compute|derive|estimate|measure|identify|name|label|list|complete|draw|plot|compare|state|describe|explain)\b/i

/**
 * True when this sentence is only a pointer at the book.
 *
 * The comma test carries most of the weight. "Using the Python Shell window
 * shown on page 255, describe how…" opens with a consult verb but the clause
 * after the comma is the whole question — deleting the sentence would leave
 * "Explain the role of each line of code in the subroutine 'Main'", which is
 * unanswerable in a different way. A genuine pointer is one clause long.
 */
function isPointerSentence(sentence: string): boolean {
  if (!bookReference(sentence)) return false
  if (!CONSULT_OPENER.test(sentence)) return false
  if (sentence.includes(',') || sentence.includes('?')) return false
  return !ASKS_FOR_WORK.test(sentence)
}

/** The same judgement on a fragment, where a comma is the boundary, not a tell. */
function isPointerClause(clause: string): boolean {
  if (!clause.trim()) return false
  if (!bookReference(clause)) return false
  if (!CONSULT_OPENER.test(clause)) return false
  return !ASKS_FOR_WORK.test(clause)
}

/**
 * Sends the reader to the book from inside a sentence that is otherwise fine.
 *
 * "Describe the process of preparing carbon dioxide in the laboratory, as
 * outlined in the textbook." and "Explain, using examples from the textbook,
 * how a substance conducts electricity." The clause is decoration; the question
 * around it is real, and dropping the whole question over it would be a waste.
 *
 * The first clause is never touched — in "Using the table on page 23, calculate
 * the time…" the pointer is the half carrying the data, and what follows it
 * cannot stand up alone.
 */
function dropPointerClauses(sentence: string): string {
  const withoutBrackets = sentence.replace(/[([][^()[\]]*[)\]]/g, (group) =>
    isPointerClause(group) ? '' : group,
  )

  const parts = withoutBrackets.split(',')
  if (parts.length < 2) return withoutBrackets

  // An aside takes both of its commas with it. Keeping one leaves "Explain,
  // how the ability of a substance to conduct electricity…", which reads worse
  // than the sentence it replaced.
  let out = parts[0]
  let separatorAbsorbed = false
  for (let i = 1; i < parts.length; i++) {
    if (isPointerClause(parts[i])) {
      separatorAbsorbed = true
      continue
    }
    out += separatorAbsorbed ? parts[i] : `,${parts[i]}`
    separatorAbsorbed = false
  }

  // The last clause carries the full stop, so dropping it runs two sentences
  // together: "…in the laboratory Include the reactants".
  const ending = withoutBrackets.match(/[.?!]+["')\]]*\s*$/)
  if (ending && !/[.?!]["')\]]*\s*$/.test(out)) return `${out.trimEnd()}${ending[0].trim()}`
  return out
}

/**
 * Enough left to be a question, and nothing in it still pointing off-screen.
 *
 * The floor is low because real questions are short: "What is a constellation?"
 * is 24 characters. It is there to catch a repair that gutted the stem, not to
 * hold a minimum length.
 */
function standsAlone(text: string): boolean {
  return text.trim().length >= 15 && bookReference(text) === null
}

/**
 * A stem with the book taken out of it, or null when it cannot be repaired.
 *
 * `hasImage` is the difference between rewriting and giving up: a locator that
 * names data the student can actually see is just bad phrasing, while the same
 * locator with nothing on screen is a question with a missing half.
 */
export function repairBookReference(stem: string, hasImage: boolean): string | null {
  if (!bookReference(stem)) return null

  // Whole sentences, then what is left of the survivors: a stem can carry one
  // of each — "Explain X, as described in the textbook. Use the diagram on page
  // 12 to support your answer."
  const trimmed = stem
    .split(/(?<=[.?!])\s+/)
    .filter((s) => !isPointerSentence(s))
    .map((s) => dropPointerClauses(s))
    .join(' ')

  // Attribution comes after them, not before: inside a pointer clause the same
  // words are load-bearing grammar, and cutting "from the textbook" out of
  // "Explain, using examples from the textbook, how…" leaves "using examples
  // how…". Once the clause has gone there is nothing left to break.
  const cut = dropAttributions(trimmed)
  if (standsAlone(cut)) return restoreSentenceCase(tidy(cut))

  if (hasImage) {
    const stripped = stripBookLocators(cut)
    if (standsAlone(stripped)) return restoreSentenceCase(stripped)
  }
  return null
}

interface RepairableQuestion {
  question?: unknown
  image_url?: unknown
  diagram_svg?: unknown
  hints?: unknown
  marking_criteria?: unknown
  model_answer?: unknown
  explanation?: unknown
}

const SUPPORTING_TEXT = ['model_answer', 'explanation'] as const
const SUPPORTING_LISTS = ['hints', 'marking_criteria'] as const

/**
 * Repairs a whole paper in place, returning how many stems were rewritten.
 *
 * Must run before `dropDanglingReferences`, which is what removes whatever is
 * left, and before the trim, so a dropped question can still be replaced.
 */
export function repairBookReferences(questions: RepairableQuestion[]): number {
  let fixed = 0
  for (const q of questions) {
    // A hint or a model answer never carries the data the question needs, so
    // the locator there is noise whether or not a figure is attached.
    for (const field of SUPPORTING_TEXT) {
      const value = q[field]
      if (typeof value === 'string' && bookReference(value)) q[field] = stripBookLocators(value)
    }
    for (const field of SUPPORTING_LISTS) {
      const value = q[field]
      if (!Array.isArray(value)) continue
      q[field] = value.map((entry) =>
        typeof entry === 'string' && bookReference(entry) ? stripBookLocators(entry) : entry,
      )
    }

    const stem = q.question
    if (typeof stem !== 'string') continue
    const hasImage = Boolean(String(q.image_url ?? '').trim() || String(q.diagram_svg ?? '').trim())
    const repaired = repairBookReference(stem, hasImage)
    if (repaired === null) continue
    q.question = repaired
    fixed++
  }
  return fixed
}
