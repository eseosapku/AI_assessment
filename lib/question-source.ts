/**
 * Where a question came from.
 *
 * A student who thinks a question is wrong has nothing to check against, and a
 * teacher has no way to confirm a paper matches the syllabus. The textbook,
 * the page and the topic are all known at generation time and were simply
 * never carried through to the review screen.
 *
 * The rule here is that a citation must be true or absent. Two things make
 * that harder than it looks:
 *
 *  - The page is only known for questions that carry a figure, because that is
 *    the only part of the pipeline that tracks where content sat in the book.
 *  - The subtopic tag is a keyword match that falls back to round-robin when
 *    nothing matches, so for some questions it is an arbitrary assignment
 *    rather than a finding. Printing that as provenance would be inventing a
 *    source, which is worse than offering none.
 */

export interface QuestionSource {
  /** Textbook or past-paper name. */
  textbook?: string
  /** Known only where a figure fixes it. */
  page?: number
  /** Topic or subtopic name — only when it was actually matched. */
  area?: string
}

/**
 * One line for the review screen, or null when nothing is known well enough
 * to print. Never guesses, and never pads with an empty field.
 */
export function describeSource(source: QuestionSource | null | undefined): string | null {
  if (!source) return null
  const book = String(source.textbook ?? '').trim()
  const area = String(source.area ?? '').trim()
  const page = Number(source.page)
  const hasPage = Number.isInteger(page) && page > 0

  const parts: string[] = []
  if (book) parts.push(hasPage ? `${book}, page ${page}` : book)
  else if (hasPage) parts.push(`Page ${page}`)
  if (area) parts.push(area)

  return parts.length > 0 ? parts.join(' · ') : null
}

/** Builds the record, dropping anything blank so callers cannot print an empty field. */
export function buildSource(input: {
  textbook?: unknown
  page?: unknown
  area?: unknown
}): QuestionSource | null {
  const out: QuestionSource = {}
  const book = String(input.textbook ?? '').trim()
  if (book) out.textbook = book
  const area = String(input.area ?? '').trim()
  if (area) out.area = area
  const page = Number(input.page)
  if (Number.isInteger(page) && page > 0) out.page = page
  return Object.keys(out).length > 0 ? out : null
}
