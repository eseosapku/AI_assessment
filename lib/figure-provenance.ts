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
import { subjectOfBook, figureFitsSubject, type FigureSubject } from './figure-subject'

let byPath: Map<string, string> | null = null

/** Built once. The manifest is 17,008 entries and does not change at runtime. */
function index(): Map<string, string> {
  if (byPath) return byPath
  const map = new Map<string, string>()
  try {
    for (const img of getDescribedImages()) {
      if (img?.localPath && img.textbookName) map.set(img.localPath, img.textbookName)
    }
  } catch {
    // A missing or unreadable manifest must not take generation down with it.
    // An empty index simply means every figure is allowed through, which is
    // the behaviour that existed before this gate.
  }
  byPath = map
  return map
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
export function figureAllowedOnPaper(localPath: unknown, paperSubject: unknown): boolean {
  return figureFitsSubject(bookNameForFigure(localPath), paperSubject)
}

/** Test seam: forget the index so a fixture can be indexed instead. */
export function resetFigureProvenance(): void {
  byPath = null
}
