/**
 * The quiz page's layout, decided once for the whole quiz.
 *
 * A question with side content (a figure, an inline diagram or a reading passage) gets a pinned column
 * beside it on a wide screen. Deciding that per question switched the page between a narrow column and
 * a wide two-column grid as a learner moved from an image question to a text one, so the Next button
 * jumped sideways and up and down. The whole quiz now takes the wide layout if any question needs it.
 */
export interface SideContentFields {
  image_url?: string | null
  diagram_svg?: string | null
  passage?: unknown
  [key: string]: unknown
}

export function hasSideContent(q: SideContentFields): boolean {
  if (q.image_url || q.diagram_svg) return true
  return typeof q.passage === 'string' && q.passage.trim() !== ''
}

export function quizUsesWideLayout(questions: readonly SideContentFields[]): boolean {
  return questions.some(hasSideContent)
}
