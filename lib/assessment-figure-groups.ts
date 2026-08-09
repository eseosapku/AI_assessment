/**
 * Reorders generated assessment questions so that questions sharing the same
 * attached figure (`image_url`) are contiguous, and annotates each question
 * in a resulting group with metadata the UI can use to render a shared
 * "Questions X–Y refer to the figure below" label instead of repeating (or
 * scattering) the same image at random positions.
 *
 * Pure and side-effect free: returns a new array of shallow-cloned question
 * objects; never mutates the input.
 */

export interface FigureGroupMeta {
  /** The shared image_url (or other grouping key) for this run of questions. */
  key: string
  /** 0-based index of the first question in the group, in the OUTPUT order. */
  startIndex: number
  /** 0-based index of the last question in the group, in the OUTPUT order. */
  endIndex: number
  /** Number of questions in the group (endIndex - startIndex + 1). */
  size: number
}

export interface QuestionWithFigureGroup {
  image_url?: string
  figureGroup?: FigureGroupMeta
  [key: string]: unknown
}

/**
 * Reorder questions so all questions sharing an image_url become contiguous,
 * preserving relative order within each group and leaving image-less (or
 * uniquely-figured) questions in their original relative position wherever
 * a group doesn't need to displace them.
 *
 * Algorithm: stable sort keyed by "the original index of the first question
 * that used this image_url" (or the question's own original index when it
 * has no image_url, or is the sole user of one). Ties — i.e. members of the
 * same group — are broken by original index, which preserves within-group
 * order. This pulls every later occurrence of a reused figure back to sit
 * beside its first occurrence, while never moving an image-less question
 * unless a group needs to pass through its original slot.
 *
 * Only groups with 2+ members get `figureGroup` metadata — a single question
 * with a unique figure renders exactly as before (no "Questions X-Y" label).
 */
export function groupQuestionsByFigure<T extends QuestionWithFigureGroup>(
  questions: readonly T[],
): T[] {
  if (!questions.length) return []

  const firstIndexByUrl = new Map<string, number>()
  questions.forEach((q, i) => {
    const url = typeof q.image_url === 'string' ? q.image_url.trim() : ''
    if (url && !firstIndexByUrl.has(url)) firstIndexByUrl.set(url, i)
  })

  const withKeys = questions.map((q, origIndex) => {
    const url = typeof q.image_url === 'string' ? q.image_url.trim() : ''
    const sortKey = url ? (firstIndexByUrl.get(url) as number) : origIndex
    return { q, origIndex, sortKey }
  })

  // Array.prototype.sort is stable (ES2019+), so equal sortKeys preserve
  // relative input order — but we break ties on origIndex explicitly anyway
  // to make the ordering rule legible and independent of engine guarantees.
  withKeys.sort((a, b) => a.sortKey - b.sortKey || a.origIndex - b.origIndex)

  const ordered: T[] = withKeys.map(({ q }) => {
    const clone = { ...q } as T
    delete clone.figureGroup
    return clone
  })

  let i = 0
  while (i < ordered.length) {
    const url = typeof ordered[i].image_url === 'string' ? (ordered[i].image_url as string).trim() : ''
    if (!url) {
      i++
      continue
    }
    let j = i + 1
    while (
      j < ordered.length &&
      typeof ordered[j].image_url === 'string' &&
      (ordered[j].image_url as string).trim() === url
    ) {
      j++
    }
    const size = j - i
    if (size > 1) {
      const meta: FigureGroupMeta = { key: url, startIndex: i, endIndex: j - 1, size }
      for (let k = i; k < j; k++) {
        ordered[k].figureGroup = { ...meta }
      }
    }
    i = j
  }

  return ordered
}
