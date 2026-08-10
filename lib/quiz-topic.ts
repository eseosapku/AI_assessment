/**
 * Free-topic ("quiz me on anything") support.
 *
 * The guided wizard builds a quiz from the curriculum database: a textbook row
 * gives us a subject, topic rows give us `topics[]`. Self-directed quizzes have
 * none of that — the student types a phrase. This module turns that phrase into
 * the same shape the generator already consumes, so `/api/generate-assessment`
 * needs no new concept of a "custom" quiz: it still receives a subject and a
 * list of topics, they just came from a model instead of from Postgres.
 *
 * Everything here is pure so it can be tested without Bedrock or a browser.
 */

/** Below this a phrase can't be scoped into anything meaningful. */
export const TOPIC_MIN_LENGTH = 2
/** Long enough for "the causes of the first world war", short enough to stay a topic. */
export const TOPIC_MAX_LENGTH = 120
/** Enough focus areas to shape a quiz, few enough to pick from at a glance. */
export const MAX_FOCUS_AREAS = 8
export const FOCUS_AREA_MAX_LENGTH = 80

/** Pasted revision material. Beyond this the model's context is the binding limit anyway. */
export const NOTES_MAX_LENGTH = 20000
/** Under this there isn't enough substance to write questions from. */
export const NOTES_MIN_LENGTH = 120

export interface QuizScope {
  /** Broad subject the topic belongs to, e.g. "History". */
  subject: string
  /** Cleaned display title, e.g. "The French Revolution". */
  topic: string
  /** Sub-areas the student can include or exclude. */
  focusAreas: string[]
  /**
   * False when the model could not read the input as something studiable. The
   * UI surfaces this as a nudge, NOT a wall — the student can always proceed
   * with their raw phrase, because a model shrugging is not proof that a topic
   * is invalid.
   */
  teachable: boolean
}

/** Collapse whitespace and clip to the maximum. Never throws. */
export function normalizeTopic(raw: unknown): string {
  return String(raw ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, TOPIC_MAX_LENGTH)
}

/** A phrase is usable if it has real characters, not just punctuation or digits. */
export function isUsableTopic(raw: unknown): boolean {
  const t = normalizeTopic(raw)
  if (t.length < TOPIC_MIN_LENGTH) return false
  // Requires at least one letter: "..." and "123" are not topics.
  return /\p{L}/u.test(t)
}

export function normalizeNotes(raw: unknown): string {
  return String(raw ?? '').trim().slice(0, NOTES_MAX_LENGTH)
}

export function isUsableNotes(raw: unknown): boolean {
  return normalizeNotes(raw).length >= NOTES_MIN_LENGTH
}

/**
 * Strip a leading list marker the model sometimes emits inside the string
 * itself ("1. Causes", "- Causes") despite being asked for a bare array.
 */
function stripListMarker(s: string): string {
  return s.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '')
}

/** Clean one focus area, or null if nothing usable survives. */
function cleanFocusArea(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const cleaned = stripListMarker(raw).replace(/\s+/g, ' ').trim().slice(0, FOCUS_AREA_MAX_LENGTH)
  if (cleaned.length < 2 || !/\p{L}/u.test(cleaned)) return null
  return cleaned
}

/**
 * Coerce a raw model response into a `QuizScope`.
 *
 * The model is untrusted input: fields may be missing, wrongly typed, or
 * duplicated. Rather than reject the whole response and lose a usable turn,
 * every field degrades independently and `fallbackTopic` backfills whatever is
 * missing — a scope with zero focus areas is still a working quiz, just a
 * broader one.
 */
export function sanitizeScope(raw: unknown, fallbackTopic: string): QuizScope {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const topicFallback = normalizeTopic(fallbackTopic)

  const topic = normalizeTopic(src.topic) || topicFallback
  const subject = normalizeTopic(src.subject) || 'General knowledge'

  const seen = new Set<string>()
  const focusAreas: string[] = []
  const rawAreas = Array.isArray(src.focusAreas) ? src.focusAreas : []
  for (const item of rawAreas) {
    const cleaned = cleanFocusArea(item)
    if (!cleaned) continue
    const dedupeKey = cleaned.toLowerCase()
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)
    focusAreas.push(cleaned)
    if (focusAreas.length >= MAX_FOCUS_AREAS) break
  }

  return {
    subject,
    topic,
    focusAreas,
    // Only an explicit `false` marks a topic unteachable. A missing field means
    // the model didn't answer the question, which is not a rejection.
    teachable: src.teachable !== false,
  }
}

/**
 * Build the `topics[]` the generator expects.
 *
 * The selected focus areas ARE the topics — they're what keeps questions on
 * target and what the figure lookup matches against. When nothing is selected
 * (the student skipped the step, or the model returned no areas) the topic
 * itself stands in, so the payload is never empty: `/api/generate-assessment`
 * rejects a request with no topics at all.
 */
export function buildTopicsPayload(scope: QuizScope, selected: string[]): string[] {
  const chosen = selected.map((s) => normalizeTopic(s)).filter(Boolean)
  if (chosen.length > 0) return chosen.slice(0, MAX_FOCUS_AREAS)
  return scope.topic ? [scope.topic] : []
}

/** Prompt for the scoping turn. Kept here so it is covered by the same tests. */
export function buildScopePrompt(topic: string): string {
  return `A student wants to be quizzed on: "${topic}"

Break this into study scope. Reply with ONLY a JSON object, no prose, no code fences:

{
  "subject": "the broad school subject this belongs to, e.g. Biology, History, Mathematics",
  "topic": "a clean, properly capitalised title for what they asked about",
  "focusAreas": ["5 to 8 distinct sub-areas that together cover the topic"],
  "teachable": true
}

Rules:
- Each focus area is a short noun phrase (2-6 words). No numbering, no full sentences.
- Focus areas must not overlap and must together cover the topic fairly.
- Interpret casual or misspelled input generously; correct it in "topic".
- Set "teachable" to false ONLY if this cannot be studied or quizzed at all
  (e.g. random characters, or a request for personal advice). A niche, informal
  or non-academic subject is still teachable.`
}
