/**
 * Which book a figure came from, looked up by the path it is served at.
 *
 * The catalogue entries the generator works with carry a key, a path, a
 * category and a description — not the book. The book is the one field that
 * says what SUBJECT a figure belongs to, and without it a Business Studies
 * pyramid can be printed beside a Science question, which is exactly what
 * happened. See `lib/figure-subject.ts` for the case.
 *
 * Kept separate from the catalogue builder deliberately: that module is shared
 * with StudyLab and is not ours to reshape for this.
 *
 * Server-only — it reads the image manifest from disk.
 */
import { getDescribedImages } from './textbook-source-images'
import { subjectOfBook, figureFitsSubject, figureFitsLevel, type FigureSubject } from './figure-subject'

let byPath: Map<string, string> | null = null
/** Paths that came out of a real exam paper rather than a textbook. */
let fromExam: Set<string> | null = null

/** Built once. The manifest is 17,008 entries and does not change at runtime. */
function index(): Map<string, string> {
  if (byPath) return byPath
  const map = new Map<string, string>()
  const exam = new Set<string>()
  try {
    for (const img of getDescribedImages()) {
      if (!img?.localPath) continue
      if (img.textbookName) map.set(img.localPath, img.textbookName)
      if (img.source === 'pastpaper') exam.add(img.localPath)
    }
  } catch {
    // A missing or unreadable manifest must not take generation down with it.
    // An empty index simply means every figure is allowed through, which is
    // the behaviour that existed before this gate.
  }
  byPath = map
  fromExam = exam
  return map
}

/**
 * Was this figure drawn for an exam paper?
 *
 * The difference is visible at a glance and it matters. A past-paper figure is
 * purpose-drawn line art with every part labelled -- a ruler, a marble, a
 * container of sand, "before" and "after" -- built so a question can be asked
 * about it. A textbook figure is a photograph, a stock illustration or a
 * decorative diagram that happens to sit near the right words.
 *
 * Both are in the library and only one looks like an exam. So where a question
 * could take either, it takes the exam one.
 */
export function isExamFigure(localPath: unknown): boolean {
  const path = String(localPath ?? '')
  if (!path) return false
  index()
  return fromExam!.has(path)
}

/** The book a figure at this path came from, or '' when unknown. */
export function bookNameForFigure(localPath: unknown): string {
  const path = String(localPath ?? '')
  return path ? index().get(path) ?? '' : ''
}

/** The subject a figure at this path belongs to. */
export function subjectForFigure(localPath: unknown): FigureSubject {
  return subjectOfBook(bookNameForFigure(localPath))
}

/**
 * May a figure at this path be printed beside a question in this paper?
 *
 * Unknown provenance is allowed through, so this can only ever remove figures
 * we can positively identify as belonging to another subject.
 */
export function figureAllowedOnPaper(localPath: unknown, paperSubject: unknown, stage?: number): boolean {
  const book = bookNameForFigure(localPath)
  if (!figureFitsSubject(book, paperSubject) || !figureFitsLevel(book, stage)) return false

  // On a Checkpoint paper, a figure with no nameable subject is refused.
  //
  // `subjectOfBook` returning 'other' used to be a blanket pass, and three
  // quarters of the library resolved to 'other' -- so the SAME 8,163 figures
  // were on offer to Science and to Mathematics, and the matcher picked
  // between them on two shared words. Reading the syllabus code out of the
  // filename took that pool from 8,163 to 3,644, which is the point at which
  // refusing the remainder costs a slice rather than the library: Science
  // keeps about 6,800 and Mathematics about 1,270, on top of 1,278 drawn
  // figures that cannot be wrong at all.
  //
  // Only at Checkpoint. Elsewhere an unlabelled figure is still better than
  // none, and no one has reported it going wrong there.
  if (typeof stage === 'number' && stage <= 9 && subjectOfBook(book) === 'other') return false

  // On an English paper, a textbook illustration is never the right picture.
  //
  // Elsewhere a figure only has to be ABOUT the topic, and a coursebook
  // drawing of a lever is about levers. English has no such licence: its
  // figures belong to the PASSAGE, and the passage was written for this paper
  // minutes ago, so no illustration in any library can belong to it. What
  // survives that rule is the one thing that works — the notices, signs and
  // adverts printed in the Cambridge ESL reading papers, which carry a
  // question on their own ("Look at the notice. Where must you not park?").
  //
  // 150 pieces of course-book clipart are refused here. That is the intent.
  if (/\benglish\b/i.test(String(paperSubject ?? '')) && !isExamFigure(localPath)) return false

  return true
}

/** Test seam: forget the index so a fixture can be indexed instead. */
export function resetFigureProvenance(): void {
  byPath = null
  fromExam = null
}
