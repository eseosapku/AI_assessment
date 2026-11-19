import { canonicalSubject } from './canonical-subject'

export type AssignmentBucket = 'upcoming' | 'open' | 'finished'

export function assignmentBucket(
  status: string | null | undefined,
  deadline: string | null | undefined,
  now = Date.now(),
): AssignmentBucket {
  if (status === 'completed') return 'finished'
  const deadlineTime = deadline ? new Date(deadline).getTime() : NaN
  if (status === 'started' || (Number.isFinite(deadlineTime) && deadlineTime < now)) return 'open'
  return 'upcoming'
}

export function assignmentDisplayTitle(title: unknown, subject: unknown): string {
  const raw = String(title ?? '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
  const looksLikeBookFile = /\b(?:student|pupil|learner)?\s*book\b|\b(?:sb|pb|tb)\b|\bgeneral\s+edu\b|\.(?:pdf|docx?)$/i.test(raw)
  if (raw && !looksLikeBookFile) return raw
  return `${canonicalSubject(subject || title)} assignment`
}
