// Scores a section on its latest attempt. No server imports: the client uses it.
import { masteryNumber } from './mastery-numbers'

export const SOLID_FROM = 80
export const GAP_BELOW = 50
export const MIN_COUNTED_QUESTIONS = 3

export type SectionBand = 'none' | 'gap' | 'shaky' | 'solid' | 'gold'

export interface LatestColumns {
  last_accuracy: number | null
  lowest_accuracy: number | null
  pending_correct: number
  pending_total: number
}

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Folds one save into the latest-attempt columns. An attempt of 3 or more
 * questions counts by itself and clears the pile; smaller amounts gather in
 * the pile and count together once it reaches 3.
 */
export function nextLatest(
  prev: Partial<LatestColumns> | null | undefined,
  previousAverage: number | null,
  addCorrect: number,
  addTotal: number,
): LatestColumns {
  const last = masteryNumber(prev?.last_accuracy)
  const lowest = masteryNumber(prev?.lowest_accuracy)
  const pc = masteryNumber(prev?.pending_correct) ?? 0
  const pt = masteryNumber(prev?.pending_total) ?? 0

  let counted: number | null = null
  let pendingCorrect = pc
  let pendingTotal = pt
  if (addTotal >= MIN_COUNTED_QUESTIONS) {
    counted = round2((addCorrect / addTotal) * 100)
    pendingCorrect = 0
    pendingTotal = 0
  } else if (addTotal > 0) {
    pendingCorrect = pc + addCorrect
    pendingTotal = pt + addTotal
    if (pendingTotal >= MIN_COUNTED_QUESTIONS) {
      counted = round2((pendingCorrect / pendingTotal) * 100)
      pendingCorrect = 0
      pendingTotal = 0
    }
  }

  if (counted === null) {
    return { last_accuracy: last, lowest_accuracy: lowest, pending_correct: pendingCorrect, pending_total: pendingTotal }
  }
  return {
    last_accuracy: counted,
    lowest_accuracy: Math.min(lowest ?? previousAverage ?? counted, counted),
    pending_correct: pendingCorrect,
    pending_total: pendingTotal,
  }
}

/** The score a section is judged on: the latest attempt, else the average. */
export function readLatest(row: { attempts?: unknown; accuracy?: unknown; last_accuracy?: unknown; lowest_accuracy?: unknown }): { score: number | null; lowest: number | null } {
  const attempts = masteryNumber(row.attempts) ?? 0
  if (attempts <= 0) return { score: null, lowest: null }
  const score = masteryNumber(row.last_accuracy) ?? masteryNumber(row.accuracy)
  if (score === null) return { score: null, lowest: null }
  return { score, lowest: masteryNumber(row.lowest_accuracy) ?? score }
}

export function bandFor(score: number | null, lowest: number | null): SectionBand {
  if (score === null) return 'none'
  if (score >= SOLID_FROM) return lowest !== null && lowest < GAP_BELOW ? 'gold' : 'solid'
  if (score >= GAP_BELOW) return 'shaky'
  return 'gap'
}
