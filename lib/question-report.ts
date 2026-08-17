/**
 * Reporting a bad question, or challenging a mark.
 *
 * Nothing in the product let a student say "this question is wrong", and
 * nothing let them contest an AI-awarded mark on a written answer. Both matter
 * for trust — being marked wrong by a machine with no recourse is the fastest
 * way to lose a learner — and both are the cheapest quality signal available.
 *
 * Pure: the reason list and validation live here so the client and the API
 * cannot disagree about what a valid report is.
 */

export interface ReportReason {
  id: string
  /** Shown to the student, in their words rather than ours. */
  label: string
}

/**
 * Ordered by how often students actually hit them. "The answer marked correct
 * is wrong" is first because it is the complaint that most damages trust.
 */
export const REPORT_REASONS: readonly ReportReason[] = [
  { id: 'wrong_answer', label: 'The answer marked correct is wrong' },
  { id: 'confusing', label: "The question doesn't make sense" },
  { id: 'irrelevant_image', label: "The picture doesn't match the question" },
  { id: 'duplicate', label: "I've already answered this exact question" },
  { id: 'grading', label: 'I think my answer was marked unfairly' },
  { id: 'offensive', label: 'Something here is inappropriate' },
  { id: 'other', label: 'Something else' },
]

const REASON_IDS = new Set(REPORT_REASONS.map((r) => r.id))

/** Long enough to be useful, short enough to store inline. */
export const DETAIL_MAX_LENGTH = 1000

export function isValidReason(reason: unknown): boolean {
  return typeof reason === 'string' && REASON_IDS.has(reason)
}

export function normalizeDetail(detail: unknown): string {
  return String(detail ?? '').replace(/\s+/g, ' ').trim().slice(0, DETAIL_MAX_LENGTH)
}

export interface ReportValidation {
  ok: boolean
  /** Present when ok is false; safe to show the student. */
  error?: string
}

/**
 * Validate a report before it is stored.
 *
 * "Something else" demands a description — without one the report says nothing
 * and cannot be acted on. Every other reason is self-describing, so detail
 * stays optional and the student is not made to justify themselves.
 */
export function validateReport(input: {
  reason?: unknown
  detail?: unknown
  questionIndex?: unknown
}): ReportValidation {
  if (!isValidReason(input?.reason)) {
    return { ok: false, error: 'Choose what went wrong.' }
  }
  const index = Number(input?.questionIndex)
  if (!Number.isInteger(index) || index < 0) {
    return { ok: false, error: 'That question could not be identified.' }
  }
  if (input.reason === 'other' && normalizeDetail(input?.detail).length < 3) {
    return { ok: false, error: 'Tell us a little about what went wrong.' }
  }
  return { ok: true }
}

/**
 * Trim a question down to what a reviewer needs.
 *
 * A snapshot is kept because a report is unusable once the paper has been
 * regenerated — but the whole object carries passages and figure metadata that
 * would bloat every row, so only the fields a human reads are stored.
 */
export function questionSnapshot(question: unknown): Record<string, unknown> | null {
  if (!question || typeof question !== 'object') return null
  const q = question as Record<string, unknown>
  const snapshot: Record<string, unknown> = {}
  for (const field of ['question', 'options', 'correct_answer', 'explanation', 'type', 'kind', 'image_url', 'topic_label']) {
    if (q[field] !== undefined) snapshot[field] = q[field]
  }
  return Object.keys(snapshot).length > 0 ? snapshot : null
}
