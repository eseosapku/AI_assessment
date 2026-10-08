/**
 * What a student has already been shown, so their next quiz on a chapter
 * does not hand them the same figure questions again.
 *
 * Most chapters have six figures or fewer with a vetted question, and a quiz
 * takes up to six: every quiz on such a chapter showed the same figures with
 * the same questions. Seen figures now go to the back of the line, not out of
 * it -- seeing a picture again is fine when its question is new, and a few
 * repeats are better than a thin chapter losing its pictures altogether.
 */
import { questionKey } from './figure-question-bank'

export interface SeenFigures {
  /** Figure images (their public paths) the student was shown. */
  images: Set<string>
  /** questionKey() of every question the student was asked. */
  questions: Set<string>
}

export const NO_HISTORY: SeenFigures = { images: new Set(), questions: new Set() }

/** From rows of {image, text}: one per figure question in the student's recent quizzes. */
export function seenFromRows(rows: readonly { image?: unknown; text?: unknown }[]): SeenFigures {
  const seen: SeenFigures = { images: new Set(), questions: new Set() }
  for (const r of rows) {
    const image = String(r.image ?? '').trim()
    if (image) seen.images.add(image)
    const key = questionKey(r.text)
    if (key) seen.questions.add(key)
  }
  return seen
}

/**
 * Figures in the order a quiz should take them: ones the student has not
 * seen, then seen ones that still have a question for them, then at most
 * `maxRepeats` whose questions they have all had. Order within each group is
 * kept, so the caller's shuffle still decides among equals.
 */
export function orderForStudent<T extends { localPath: string }>(
  figures: readonly T[], seen: SeenFigures, hasFresh: (f: T) => boolean, maxRepeats = 2,
): T[] {
  if (!seen.images.size) return [...figures]
  const unseen = figures.filter((f) => !seen.images.has(f.localPath))
  const again = figures.filter((f) => seen.images.has(f.localPath))
  return [...unseen, ...again.filter(hasFresh), ...again.filter((f) => !hasFresh(f)).slice(0, maxRepeats)]
}
