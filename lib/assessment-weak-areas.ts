/**
 * Turn a finished attempt into "where you struggled", the bridge from a score
 * to a next action.
 *
 * A percentage tells a student they did badly but not what to do about it.
 * Grouping questions by the area they came from turns one number into a short
 * list of named weak spots, which is what the review page offers to study and
 * what the gap map opens onto.
 *
 * Pure: no DB, no network, no React. The caller decides how a question earns
 * credit (MCQ right/wrong, part-marks on written answers) and hands the result
 * over already normalised.
 */

/** Below this an area is worth offering as something to go and study. */
export const PROBLEM_AREA_THRESHOLD = 70

/** Shown when a question carries no area of its own. */
export const UNLABELLED_AREA = 'General'

export interface QuestionOutcome {
  /** Zero-based position in the paper; surfaced to the student as index + 1. */
  index: number
  /** The area this question belongs to. Blank is tolerated and grouped. */
  label: string
  /**
   * Fractional credit, 0..1. MCQs are 0 or 1; a written answer worth 3 of 5
   * marks is 0.6, so part-marks pull an area down proportionally instead of
   * counting as an outright failure.
   */
  credit: number
}

export interface WeakArea {
  label: string
  /** Questions in this area. */
  total: number
  /** Credit earned across them, rounded for display. */
  correct: number
  /** 0..100. */
  accuracy: number
  /** One-based question numbers that lost credit, ascending. */
  missedQuestions: number[]
}

const clampCredit = (n: unknown): number => {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : 0
  return v < 0 ? 0 : v > 1 ? 1 : v
}

function areaLabel(raw: unknown): string {
  const s = String(raw ?? '').replace(/\s+/g, ' ').trim()
  return s || UNLABELLED_AREA
}

/**
 * Group outcomes by area, weakest first.
 *
 * Uses a Map rather than an object literal: labels come from model-tagged
 * question data, so a label of `__proto__` or `constructor` indexing a plain
 * object would resolve to something truthy off the prototype and corrupt the
 * grouping.
 */
export function summarizeWeakAreas(outcomes: readonly QuestionOutcome[]): WeakArea[] {
  const groups = new Map<string, { total: number; credit: number; missed: number[] }>()

  for (const o of outcomes) {
    if (!o || typeof o !== 'object') continue
    const label = areaLabel(o.label)
    const credit = clampCredit(o.credit)
    let g = groups.get(label)
    if (!g) {
      g = { total: 0, credit: 0, missed: [] }
      groups.set(label, g)
    }
    g.total += 1
    g.credit += credit
    // Anything short of full credit is worth revisiting, including a written
    // answer that only picked up half its marks.
    if (credit < 1) g.missed.push(Number(o.index) + 1)
  }

  const areas: WeakArea[] = []
  for (const [label, g] of groups) {
    areas.push({
      label,
      total: g.total,
      correct: Math.round(g.credit),
      accuracy: g.total > 0 ? Math.round((g.credit / g.total) * 100) : 0,
      missedQuestions: g.missed.sort((a, b) => a - b),
    })
  }

  // Weakest first, then the area with most questions — a 50% on six questions
  // is stronger evidence of a gap than a 50% on two.
  areas.sort((a, b) => a.accuracy - b.accuracy || b.total - a.total || a.label.localeCompare(b.label))
  return areas
}

/**
 * The areas worth offering as directed study.
 *
 * Returns nothing when everything is above the threshold — a student who aced
 * the paper should not be shown a "problem areas" panel with their best topic
 * in it, which is what taking "the weakest N" unconditionally would do.
 */
export function pickProblemAreas(
  areas: readonly WeakArea[],
  threshold: number = PROBLEM_AREA_THRESHOLD,
): WeakArea[] {
  return areas.filter((a) => a.accuracy < threshold)
}

/**
 * Credit for a part-marked question (written answers, interactive items).
 *
 * Ungraded questions score 0 rather than being skipped: a written answer still
 * awaiting marking has demonstrably not earned its marks yet, and dropping it
 * would quietly inflate the area it belongs to.
 */
export function creditFromMarks(awarded: unknown, total: unknown): number {
  const t = Number(total)
  if (!Number.isFinite(t) || t <= 0) return 0
  const a = Number(awarded)
  if (!Number.isFinite(a)) return 0
  return clampCredit(a / t)
}

/** Every question the student lost credit on, ascending, across all areas. */
export function allMissedQuestions(areas: readonly WeakArea[]): number[] {
  const out = new Set<number>()
  for (const a of areas) for (const q of a.missedQuestions) out.add(q)
  return [...out].sort((a, b) => a - b)
}
