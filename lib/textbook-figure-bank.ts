/**
 * Textbook figures that are up to the standard of the past-paper ones: each
 * one is a figure the book itself asks a question about, judged to be
 * purpose-drawn (a labelled diagram, apparatus, a chart, a graph, a table)
 * rather than illustration, and filed under one of the book's own topics.
 *
 * The ordinary quiz path matched library figures to questions on shared words
 * after the questions were written, and attached one picture in eight -- a
 * photo of charcoal to a question about fuels, one circuit to two questions.
 * A figure from here is chosen BEFORE its question is written, and the
 * question is written to it, with the book's own exercise as the model -- the
 * same arrangement that fixed the Checkpoint figures.
 *
 * Built offline: scripts/build_textbook_question_figures.py (digital books),
 * scripts/locate-scanned-figures.ts (scanned books), scripts/tag-textbook-figures.ts
 * (the standard), scripts/merge-textbook-figure-bank.ts. Server-only.
 */
import fs from 'node:fs'
import path from 'node:path'

export interface TextbookFigure {
  id: string
  /** Every database row that is this book (some books are listed twice). */
  textbookIds: number[]
  textbookName: string
  page: number
  localPath: string
  noun: string
  shows: string
  labels: string[]
  /** One of the book's own topics, exactly as the database names it. */
  topic: string
  /** The book's exercise about this figure. */
  original: string
  /**
   * Judged from the text of its page, not picked for an exercise about it
   * (build_textbook_question_figures.py --any): `original` may be empty.
   */
  pageText?: boolean
}

const BANK_PATH = path.join(process.cwd(), 'data', 'textbook-figure-bank.json')
let cache: TextbookFigure[] | null = null

/**
 * A book's self-assessment chart -- "When writing a blog post I can:" with
 * faces to tick, a success-criteria table. Apparatus for the learner, not a
 * figure about the subject: "What is a learner doing when they tick one of
 * the faces?" reached an English quiz from one.
 */
const SELF_ASSESSMENT = /self[- ]assessment|I fully understand|I think I do|not really sure|success criteria|How did my work show|\b(when|while) (writing|reading)[^.]{0,40}\bI can\b/i
export function isSelfAssessmentChart(f: Pick<TextbookFigure, 'shows' | 'labels'>): boolean {
  return SELF_ASSESSMENT.test(String(f.shows ?? '')) || SELF_ASSESSMENT.test((f.labels ?? []).join(' '))
}

export function loadTextbookFigureBank(): TextbookFigure[] {
  if (cache) return cache
  try {
    const raw = JSON.parse(fs.readFileSync(BANK_PATH, 'utf8'))
    cache = (Array.isArray(raw?.figures) ? raw.figures : []).filter((f: TextbookFigure) => !isSelfAssessmentChart(f))
  } catch {
    cache = []
  }
  return cache!
}

/** Test seam. */
export function resetTextbookFigureBank(figures?: TextbookFigure[]): void {
  cache = figures ?? null
}

export type BookFamily = 'science' | 'mathematics' | 'computing' | 'other'

/** What a book teaches, from its name. Biology, chemistry and physics are science. */
export function familyOf(name: unknown): BookFamily {
  const n = String(name ?? '').toLowerCase()
  if (/\b(science|biology|chemistry|physics)\b/.test(n)) return 'science'
  if (/\b(math|maths|mathematics)\b/.test(n)) return 'mathematics'
  if (/\b(computing|computer|ict)\b/.test(n)) return 'computing'
  return 'other'
}

/** The stage a book is written for: Primary 1-6, Lower Secondary 7-9, IGCSE 10, AS and A Level 12. */
export function stageOfBook(name: unknown): number | null {
  const n = String(name ?? '').toLowerCase()
  if (/\bigcse\b|\bo level\b/.test(n)) return 10
  if (/\bas\b.*\blevel\b|\ba level\b/.test(n)) return 12
  const num = n.match(/\b(?:stage|book)\s*(\d{1,2})\b/)?.[1]
    ?? n.match(/\b(?:science|computing|mathematics)\s+(\d{1,2})\b/)?.[1]
  return num ? Number(num) : null
}

const STOP = new Set([
  'the', 'and', 'for', 'with', 'from', 'into', 'about', 'their', 'what', 'how', 'why', 'unit', 'chapter', 'topic',
  'part', 'using', 'use', 'some', 'more', 'other', 'different', 'things', 'thing', 'make', 'making', 'work', 'working',
  // Words every Mathematics figure description and topic is full of. A
  // "Number" quiz matched a clock ("the numbers on the clock face") and a
  // set of packages ("reading the scale") on these alone.
  'number', 'numbers', 'reading', 'writing', 'shows', 'shown', 'drawn', 'labelled', 'printed', 'figure', 'diagram',
])
/** A light stem, so "partitioning" meets "partitioned" and "rounding" meets "rounded". */
const stem = (w: string) => w.length > 6 ? w.replace(/(ing|ed|ions?|ies|es|s)$/, '') : w.replace(/(ies|es|s)$/, '')
const words = (s: unknown) => new Set(String(s ?? '').toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/)
  .filter((w) => w.length > 3 && !STOP.has(w)).map(stem))

function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Trim a quiz to `count`, keeping every question in `keep` and spreading them
 * through it rather than leaving them where they were generated.
 *
 * The figure questions are generated after the ordinary ones, which ask for a
 * surplus, so a plain slice to `count` cut exactly the figure questions.
 */
export function keepAndSpread<T>(all: readonly T[], keep: readonly T[], count: number): T[] {
  const figured = keep.filter((q) => all.includes(q)).slice(0, count)
  const plain = all.filter((q) => !figured.includes(q)).slice(0, Math.max(0, count - figured.length))
  if (!figured.length) return plain
  const total = plain.length + figured.length
  const gap = total / figured.length
  const out: T[] = []
  let fi = 0
  let pi = 0
  for (let pos = 0; pos < total; pos++) {
    const due = fi < figured.length && pos >= Math.floor(gap * fi + gap / 2)
    out.push(due || pi >= plain.length ? figured[fi++] : plain[pi++])
  }
  return out
}

/**
 * Figures for one quiz.
 *
 * The quiz's own book first, on the quiz's own topics -- by the topic the
 * figure was filed under, which is the book's own name for it. Failing that,
 * books of the same family at a neighbouring stage, on figures whose topic and
 * content share at least two real words with the quiz's topics: a Stage 8
 * quiz on photosynthesis may use the Stage 7 or 9 book's photosynthesis
 * figures, never a Stage 6 rock cycle or an IGCSE enzyme graph.
 */
/**
 * Whether the bank holds any figure from this book. Such a book takes its
 * pictures from the bank or goes without: the library's other figures for it
 * are the ones the bank was built to leave out.
 */
export function bookInBank(
  textbookId: unknown,
  bank: readonly TextbookFigure[] = loadTextbookFigureBank(),
  /** Only figures a quiz can use count -- one with a vetted question, say. */
  usable: (f: TextbookFigure) => boolean = () => true,
): boolean {
  const id = Number(textbookId)
  return Number.isFinite(id) && bank.some((f) => f.textbookIds.includes(id) && usable(f))
}

/** Biology, chemistry or physics, where a book name says which. */
const scienceOf = (name: unknown) => String(name ?? '').toLowerCase().match(/\b(biology|chemistry|physics)\b/)?.[1] ?? null

/** Another book on the same shelf: the same subject at exactly the same stage. */
function sameShelf(a: unknown, b: unknown): boolean {
  const stage = stageOfBook(a)
  if (stage == null || stage !== stageOfBook(b) || familyOf(a) !== familyOf(b) || familyOf(a) === 'other') return false
  const sa = scienceOf(a), sb = scienceOf(b)
  return !sa || !sb || sa === sb
}

export function figuresForQuiz(opts: {
  textbookId?: number
  textbookName?: string
  topics: readonly string[]
  /**
   * The sections of a topic chosen without them. They match by content only:
   * "Unit 2B: Geometry" is the quiz's topic, and its sections ("2D shapes",
   * "Angles and turning") are words for what its figures show, not topics a
   * figure must be filed under.
   */
  sections?: readonly string[]
  stage?: number
  max: number
  seed: number
  bank?: readonly TextbookFigure[]
}): TextbookFigure[] {
  const bank = opts.bank ?? loadTextbookFigureBank()
  if (!bank.length || opts.max <= 0) return []
  const topics = opts.topics.map((t) => String(t).trim().toLowerCase()).filter(Boolean)
  if (!topics.length) return []
  const next = rng(opts.seed)
  const shuffle = <T,>(xs: T[]): T[] => {
    for (let i = xs.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [xs[i], xs[j]] = [xs[j], xs[i]] }
    return xs
  }

  const want = words([...topics, ...(opts.sections ?? [])].join(' '))
  /** Figures from `pool` whose topic and content match the quiz's words, best first. */
  const byContent = (pool: readonly TextbookFigure[]): TextbookFigure[] => {
    if (!want.size) return []
    const scored = pool.map((f) => {
      // A word in the figure's TOPIC counts double. "Rounding" in the topic
      // "Place value and rounding" is what the figure is about; "rounded" in
      // "a rounded rectangle" is how a shape happens to look, and on equal
      // terms the shape beat the place value chart for a rounding quiz.
      const inTopic = words(f.topic)
      const inShows = words(f.shows)
      let score = 0
      let distinctive = false
      for (const w of want) {
        if (inTopic.has(w)) score += 2
        else if (inShows.has(w)) score += 1
        else continue
        if (w.length >= 6) distinctive = true
      }
      // Two shared words -- or, for a topic only one or two words long, one
      // that says something on its own. "Photosynthesis" is one word, and two
      // was a bar it could never clear; "food" or "cells" alone still cannot.
      return { f, score: score >= 2 || (want.size <= 2 && distinctive) ? Math.max(score, 2) : score }
    }).filter((x) => x.score >= 2)
    if (!scored.length) return []
    const best = Math.max(...scored.map((x) => x.score))
    // The strongest matches only, shuffled among themselves.
    return shuffle(scored.filter((x) => x.score >= Math.max(2, best - 1)).map((x) => x.f))
  }

  const id = Number(opts.textbookId)
  if (Number.isFinite(id)) {
    const own = bank.filter((f) => f.textbookIds.includes(id))
    const onTopic = own.filter((f) => topics.includes(f.topic.trim().toLowerCase()))
    // A book whose database topics never came out properly -- Primary
    // Mathematics 3 has one topic, "Introduction", and 4 and 5 one each,
    // "Number" -- files every figure under that one name, so matching on
    // the topic picks at random from the whole book: a clock for a place
    // value quiz. There the figure is chosen by what it shows instead.
    const catchAll = own.length > 30 && new Set(own.map((f) => f.topic)).size === 1
    // The quiz's own book by content next -- its own figures on the subject,
    // before any other book's. A book filed by content (the ones whose
    // database topics failed) is matched this way on every quiz.
    const ownPick = onTopic.length && !catchAll ? shuffle([...onTopic]) : byContent(own)
    if (ownPick.length) {
      // Then a sister book's on the same content: the same subject at the
      // same stage, so its vetted questions are at the quiz's level. Most
      // chapters have three figures or fewer of their own, and every quiz on
      // one showed the same three; IGCSE Physics, Chemistry and Biology each
      // have a second book on the same syllabus.
      const sisters = byContent(bank.filter((f) => !f.textbookIds.includes(id) && sameShelf(f.textbookName, opts.textbookName)))
      return [...ownPick, ...sisters.filter((f) => !ownPick.includes(f))].slice(0, opts.max)
    }
  }

  const family = familyOf(opts.textbookName ?? '')
  // Only the subjects the bank holds. An English or History quiz borrowing a
  // science figure on two shared words is the old fault in a new place.
  if (family === 'other') return []
  const stage = opts.stage ?? stageOfBook(opts.textbookName ?? '')
  const neighbours = bank
    .filter((f) => familyOf(f.textbookName) === family)
    .filter((f) => {
      const s = stageOfBook(f.textbookName)
      return stage == null || s == null || Math.abs(s - stage) <= 1
    })
  return byContent(neighbours).slice(0, opts.max)
}
