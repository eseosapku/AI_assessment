/**
 * What a student has already been shown, so their next quiz does not hand them the same figure
 * with the same question again.
 *
 * A repeat is a (figure, question) PAIR, not a wording: a drawn family asks "What is the median?"
 * of a thousand different figures, and a bank figure with one multiple-choice question brought that
 * question back every time it came back. Seen figures now go to the back of the line, and come back
 * only with a question the student has not had on that figure (spec 2026-10-16 3.4).
 */
import type { Database } from './db'
import { questionKey } from './figure-question-bank'

export interface SeenFigures {
  /** Figure images (their public paths) the student was shown. */
  images: Set<string>
  /** questionKey() of every question the student was asked. */
  questions: Set<string>
  /** questionKey()s asked with each figure image: the pairs a student must not be shown again. */
  askedWith: Map<string, Set<string>>
}

export const NO_HISTORY: SeenFigures = { images: new Set(), questions: new Set(), askedWith: new Map() }
const NONE: ReadonlySet<string> = new Set()

/** From rows of {image, text}: one per figure question in the student's recent quizzes. */
export function seenFromRows(rows: readonly { image?: unknown; text?: unknown }[]): SeenFigures {
  const seen: SeenFigures = { images: new Set(), questions: new Set(), askedWith: new Map() }
  for (const r of rows) {
    const image = String(r.image ?? '').trim()
    const key = questionKey(r.text)
    if (image) seen.images.add(image)
    if (key) seen.questions.add(key)
    if (image && key) seen.askedWith.set(image, (seen.askedWith.get(image) ?? new Set<string>()).add(key))
  }
  return seen
}

/** The questions (questionKey form) a student has already been asked with this figure. */
export function askedWith(seen: SeenFigures, image: string): ReadonlySet<string> {
  return seen.askedWith.get(image) ?? NONE
}

/** Whether asking this question with this figure would show the student a pair they have had. */
export function isSeenPair(seen: SeenFigures, image: string, text: unknown): boolean {
  return askedWith(seen, image).has(questionKey(text))
}

/**
 * The figure questions a student had in their last `limit` quizzes of any kind and any book. A
 * lookup that fails gives no history: the quiz is built as it would be for a new student.
 */
export async function readSeenFigures(db: Database, userId: string, limit = 50): Promise<SeenFigures> {
  try {
    const { rows } = await db.query(
      `SELECT q->>'image_url' AS image, q->>'question' AS text
         FROM (SELECT questions_data FROM assessments
                WHERE user_id::text = $1 AND jsonb_typeof(questions_data) = 'array'
                ORDER BY created_at DESC LIMIT $2) a,
              jsonb_array_elements(a.questions_data) q
        WHERE q->>'image_url' IS NOT NULL`,
      [userId, limit],
    )
    return seenFromRows(rows ?? [])
  } catch (error) {
    console.error('Recent quizzes lookup for figures failed:', error)
    return { images: new Set(), questions: new Set(), askedWith: new Map() }
  }
}

/**
 * Figures in the order a quiz should take them: ones the student has not seen, then seen ones that
 * still have a question new to them on that figure, then -- only if asked for -- at most `maxRepeats`
 * whose questions were all asked with them. Order within each group is kept, so the caller's shuffle
 * still decides among equals.
 */
export function orderForStudent<T extends { localPath: string }>(
  figures: readonly T[], seen: SeenFigures, hasFresh: (f: T) => boolean, maxRepeats = 0,
): T[] {
  if (!seen.images.size) return [...figures]
  const unseen = figures.filter((f) => !seen.images.has(f.localPath))
  const again = figures.filter((f) => seen.images.has(f.localPath))
  return [...unseen, ...again.filter(hasFresh), ...again.filter((f) => !hasFresh(f)).slice(0, maxRepeats)]
}
