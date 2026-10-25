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
  // DECIMAL columns come back as text. "2.50" + -0.14 is the string "2.50-0.14",
  // and the ease factor becomes NaN for every review after that.
  let ease_factor = Number(state.ease_factor)
  let interval_days = Number(state.interval_days)
  let repetitions = Number(state.repetitions)
  if (!Number.isFinite(ease_factor)) ease_factor = 2.5
  if (!Number.isFinite(interval_days)) interval_days = 0
  if (!Number.isFinite(repetitions)) repetitions = 0

  if (rating === 1) {
    repetitions = 0
    interval_days = 0
  } else {
    // The buttons are 2, 3 and 4. Fed straight into the SM-2 formula, "Got it"
    // always lowers the ease and "Too easy" never raises it, and after the
    // first review all three buttons were given the same next day.
    const quality = rating === 2 ? 3 : rating === 3 ? 4 : 5
    const easeDelta = 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)
    if (repetitions === 0) {
      interval_days = rating === 2 ? 1 : rating === 3 ? 3 : 6
      repetitions = 1
    } else {
      if (repetitions === 1) interval_days = 6
      else interval_days = Math.max(1, Math.round(interval_days * ease_factor))
      const scale = rating === 2 ? 0.5 : rating === 4 ? 1.3 : 1
      interval_days = Math.max(1, Math.round(interval_days * scale))
      repetitions += 1
    }
    ease_factor = Math.max(1.3, ease_factor + easeDelta)
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
