/**
 * What subject a figure belongs to, and whether it may be used on a paper.
 *
 * The figure library is 17,008 images drawn from 1,164 books, and nothing in
 * it records a SUBJECT. Matching was done by counting shared words between the
 * question's focus and the figure's description, and two shared words was
 * enough. That produced, live, on a Stage 9 Science paper:
 *
 *   focus   "human reproduction"
 *   figure  Maslow's Hierarchy of Needs, from "Cambridge IGCSE and O Level
 *           Business Studies 5th edition"
 *   asked   "Look at the diagram. Name the part labelled A that represents
 *           physiological needs."
 *
 * The pyramid's own caption lists "reproduction" under physiological needs, so
 * it scored two and won. Nothing was wrong with the description — it says
 * plainly that it is "a psychological theory" — and nothing read it. The same
 * mechanism put a Doppler-effect truck-and-cyclist figure from an AS Level
 * Physics coursebook into a MATHEMATICS paper, and a project-network chart
 * onto an order-of-operations sum.
 *
 * The book title is the signal that was there all along. A Business Studies
 * coursebook cannot illustrate a Science question, whatever words it shares.
 *
 * Level started as a preference rather than a gate, on the grounds that most
 * of the library is IGCSE and A Level and refusing it would empty the papers
 * of figures. Half of that held: IGCSE at Stage 9 is a stretch a good question
 * can carry. A Level was not — a first-ionisation-energy graph from an A Level
 * Chemistry coursebook reached a fourteen-year-old's paper, and the prompt's
 * instruction that "the topic governs, not the diagram" did not save it. See
 * `figureFitsLevel`.
 */

export type FigureSubject =
  | 'biology' | 'chemistry' | 'physics' | 'science'
  | 'mathematics' | 'geography' | 'english' | 'history'
  | 'business' | 'economics' | 'accounting' | 'computing'
  | 'agriculture' | 'other'

export type FigureLevel = 'primary' | 'lower-secondary' | 'igcse' | 'a-level' | null

/**
 * Ordered: the first match wins, so the specific beats the general.
 *
 * "Additional Mathematics" must match mathematics before "Cambridge
 * International" matches anything, and "Environmental Management" must not be
 * read as plain Science when Geography is closer.
 */
const SUBJECT_PATTERNS: readonly [RegExp, FigureSubject][] = [
  // Ahead of business: "Environmental Management" is a Geography book, and
  // matching it on "Management" would hand its figures to Business papers and
  // withhold them from Science ones.
  [/\benvironmental\b/i, 'geography'],
  [/\bbusiness\b|\bmanagement\b|\bmarketing\b|\benterprise\b/i, 'business'],
  [/\beconomics?\b/i, 'economics'],
  [/\baccounting\b|\bfinance\b/i, 'accounting'],
  [/\b(?:ict|information and communication|computer science|computing|programming)\b/i, 'computing'],
  [/\bagricultur/i, 'agriculture'],
  [/\bbiolog/i, 'biology'],
  [/\bchemist/i, 'chemistry'],
  [/\bphysics\b/i, 'physics'],
  [/\bmathemat|\bmaths?\b/i, 'mathematics'],
  [/\bgeograph|\benvironmental\b/i, 'geography'],
  [/\bhistor/i, 'history'],
  [/\benglish\b|\bliterature\b|\blanguage\b/i, 'english'],
  [/\bscience\b/i, 'science'],
]

const LEVEL_PATTERNS: readonly [RegExp, FigureLevel][] = [
  [/\bAS\b|\bA Level\b|\bA-Level\b|\bAS & A\b|\bAS _ A\b|\bAdvanced\b/i, 'a-level'],
  [/\bIGCSE\b|\bO Level\b|\bGCSE\b/i, 'igcse'],
  [/\b(?:S[1-6]|senior|secondary|lower secondary|stage [7-9])\b/i, 'lower-secondary'],
  [/\b(?:P[1-6]|primary|stage [1-6])\b/i, 'primary'],
]

/** The subject a book teaches, from its title. 'other' when nothing matches. */
export function subjectOfBook(bookName: unknown): FigureSubject {
  const name = String(bookName ?? '')
  if (!name.trim()) return 'other'
  for (const [pattern, subject] of SUBJECT_PATTERNS) {
    if (pattern.test(name)) return subject
  }
  return 'other'
}

/** Roughly how advanced a book is, or null when the title does not say. */
export function levelOfBook(bookName: unknown): FigureLevel {
  const name = String(bookName ?? '')
  if (!name.trim()) return null
  for (const [pattern, level] of LEVEL_PATTERNS) {
    if (pattern.test(name)) return level
  }
  return null
}

/**
 * Which figure subjects may illustrate a paper in this subject.
 *
 * Science is the one that takes several: a Checkpoint Science paper covers
 * Biology, Chemistry, Physics and Earth and Space, so a figure from any of
 * them is legitimately on-topic. Mathematics takes only Mathematics — a
 * physics figure in a Maths paper is how the Doppler question happened.
 */
const ACCEPTS: Record<string, readonly FigureSubject[]> = {
  science: ['science', 'biology', 'chemistry', 'physics', 'geography', 'agriculture'],
  biology: ['biology', 'science', 'agriculture'],
  chemistry: ['chemistry', 'science'],
  physics: ['physics', 'science'],
  mathematics: ['mathematics'],
  geography: ['geography', 'science'],
  history: ['history'],
  english: ['english'],
  business: ['business', 'economics', 'accounting'],
  economics: ['economics', 'business', 'accounting'],
  computing: ['computing', 'mathematics'],
  agriculture: ['agriculture', 'biology', 'science'],
}

/**
 * May this figure be printed beside a question in this paper?
 *
 * Unknown on either side is allowed through: 'other' covers a third of the
 * library, and refusing everything unlabelled would cost far more good figures
 * than it saves bad ones. The gate is for the cases we can actually name.
 */
/**
 * Subjects where an unidentified book is NOT good enough.
 *
 * 'other' is a third of the library and letting it through is right for most
 * papers: a lever, a beaker or a bar chart from a book we cannot name is still
 * plausibly about the question. English is the subject where that reasoning
 * collapses. Its figures have to belong to the PASSAGE, and a passage this
 * platform generated has no illustrations anywhere in any library. So the
 * blanket pass shipped, on a Cambridge English paper:
 *
 *   a wedding party   from "SOCIAL STUDIES AND RELIGIOUS EDUCATION"
 *   a clown           from "Creative Arts P2 TG"
 *   a school hall     from "P5-SET-PB"
 *
 * all of them 'other', all of them admitted, none of them Cambridge and none
 * of them related to the story the learner had just read. The reader's
 * question was the right one: what is this doing here?
 *
 * History is in for the same reason — a photograph has to be OF the period.
 */
const STRICT: ReadonlySet<string> = new Set(['english', 'history'])

export function figureFitsSubject(bookName: unknown, paperSubject: unknown): boolean {
  const figure = subjectOfBook(bookName)

  const paper = String(paperSubject ?? '').toLowerCase().trim()
  if (!paper) return true

  const key = Object.keys(ACCEPTS).find((k) => paper.includes(k))
  if (!key) return true

  if (figure === 'other') return !STRICT.has(key)

  return ACCEPTS[key].includes(figure)
}

/**
 * May a figure from this book appear on a paper at this stage?
 *
 * Subject was the gate that mattered first, and level was deliberately left
 * open: most of the library is IGCSE and A Level, and refusing it would have
 * emptied the papers of figures. That judgement was half right. An IGCSE
 * figure at Stage 9 is a stretch a good question can carry; an AS/A Level one
 * is not, and a first-ionisation-energy graph from an A Level Chemistry
 * coursebook reached a fourteen-year-old's Checkpoint paper.
 *
 * So A Level is refused for Checkpoint and everything else is allowed. It
 * costs the smallest slice of the library that removes the observed fault.
 */
export function figureFitsLevel(bookName: unknown, stage: number | undefined): boolean {
  if (typeof stage !== 'number' || stage > 9) return true
  return levelOfBook(bookName) !== 'a-level'
}
