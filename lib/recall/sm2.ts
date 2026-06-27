/** Simplified SM-2 spaced repetition scheduling */

export type RecallRating = 1 | 2 | 3 | 4

export type RecallCardState = {
  ease_factor: number
  interval_days: number
  repetitions: number
  due_at: string
}

export function initialCardState(now = new Date()): RecallCardState {
  return {
    ease_factor: 2.5,
    interval_days: 0,
    repetitions: 0,
    due_at: now.toISOString(),
  }
}

export function scheduleReview(
  state: RecallCardState,
  rating: RecallRating,
  now = new Date(),
): RecallCardState {
  let { ease_factor, interval_days, repetitions } = state

  if (rating === 1) {
    repetitions = 0
    interval_days = 0
  } else {
    const q = rating
    if (repetitions === 0) {
      interval_days = q === 2 ? 1 : q === 3 ? 3 : 6
      repetitions = 1
      ease_factor = Math.max(
        1.3,
        ease_factor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)),
      )
    } else {
      if (repetitions === 1) interval_days = 6
      else interval_days = Math.max(1, Math.round(interval_days * ease_factor))

      repetitions += 1
      ease_factor = Math.max(
        1.3,
        ease_factor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)),
      )
    }
  }

  const due = new Date(now)
  due.setDate(due.getDate() + interval_days)

  return {
    ease_factor: Math.round(ease_factor * 100) / 100,
    interval_days,
    repetitions,
    due_at: due.toISOString(),
  }
}

export function isDue(dueAt: string, now = new Date()) {
  return new Date(dueAt).getTime() <= now.getTime()
}

export function previewIntervalDays(state: RecallCardState, rating: RecallRating): number {
  return scheduleReview(state, rating).interval_days
}

export function formatReviewIn(days: number): string {
  if (days <= 0) return 'Later today'
  if (days === 1) return 'Tomorrow'
  if (days < 7) return `In ${days} days`
  if (days < 30) {
    const weeks = Math.round(days / 7)
    return weeks === 1 ? 'In ~1 week' : `In ~${weeks} weeks`
  }
  const months = Math.round(days / 30)
  return months === 1 ? 'In ~1 month' : `In ~${months} months`
}

const FIRST_REVIEW_LABELS: Record<RecallRating, string> = {
  1: 'Later today',
  2: 'Tomorrow',
  3: 'In 3 days',
  4: 'In 6 days',
}

export function previewReviewLabel(state: RecallCardState, rating: RecallRating): string {
  if (state.repetitions === 0) return FIRST_REVIEW_LABELS[rating]
  return formatReviewIn(previewIntervalDays(state, rating))
}
