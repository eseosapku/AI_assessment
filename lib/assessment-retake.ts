/**
 * Retaking a finished quiz.
 *
 * The assessment player loads whatever sits in `sessionStorage` under
 * `currentAssessment`, so a retake needs no new endpoint and no regeneration:
 * rebuild that payload from the finished attempt and navigate. The student gets
 * the same paper with a clean slate, the new attempt saves as its own result,
 * and `topic_mastery` picks it up — which is what makes the gap map move.
 *
 * Re-serving the same questions (rather than generating fresh ones) is
 * deliberate: it is instant, costs nothing, and makes the before/after directly
 * comparable, which is the point of proving mastery after a study session.
 */

/** Key the assessment player reads its current paper from. */
export const CURRENT_ASSESSMENT_KEY = 'currentAssessment'

/** Minutes allowed when the source attempt recorded no duration. */
const DEFAULT_MINUTES = 15

export interface RetakePayload {
  assessment_id: string
  estimated_time: number
  questions: unknown[]
  subject: string
  topics: string[]
  questionType?: string
}

export interface RetakeSource {
  assessment_id?: unknown
  subject?: unknown
  topics?: unknown
  questions?: unknown
  estimated_time?: unknown
  duration?: unknown
  questionType?: unknown
}

function toMinutes(...candidates: unknown[]): number {
  for (const c of candidates) {
    const n = Number(c)
    if (Number.isFinite(n) && n > 0) return Math.round(n)
  }
  return DEFAULT_MINUTES
}

/**
 * Derive the topic list when the attempt didn't carry one.
 *
 * Falls back to the per-question labels added at generation time, so a
 * self-directed quiz — which has no curriculum topics behind it — still shows
 * what it covered rather than an empty subtitle.
 */
function deriveTopics(src: RetakeSource, questions: unknown[]): string[] {
  if (Array.isArray(src.topics)) {
    const explicit = src.topics.map((t) => String(t ?? '').trim()).filter(Boolean)
    if (explicit.length > 0) return explicit
  }
  const seen = new Set<string>()
  for (const q of questions) {
    const label = String((q as { topic_label?: unknown })?.topic_label ?? '').trim()
    if (label) seen.add(label)
  }
  return [...seen]
}

/**
 * Build the payload for a retake, or null when the attempt can't be replayed.
 *
 * Returns null rather than a half-built paper: an assessment with no questions
 * would drop the student into an empty player with no way forward.
 */
export function buildRetakePayload(src: RetakeSource | null | undefined): RetakePayload | null {
  if (!src || typeof src !== 'object') return null

  const questions = Array.isArray(src.questions) ? src.questions.filter(Boolean) : []
  if (questions.length === 0) return null

  const assessmentId = String(src.assessment_id ?? '').trim()
  if (!assessmentId) return null

  return {
    assessment_id: assessmentId,
    estimated_time: toMinutes(src.estimated_time, src.duration),
    questions,
    subject: String(src.subject ?? '').trim() || 'Quiz',
    topics: deriveTopics(src, questions),
    ...(typeof src.questionType === 'string' && src.questionType
      ? { questionType: src.questionType }
      : {}),
  }
}
