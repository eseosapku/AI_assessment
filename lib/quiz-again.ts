/**
 * Building another quiz like the last one.
 *
 * The wizard is nine steps — curriculum, class, difficulty, subject, topics,
 * count, style, format, generate. That is a good first run and a poor tenth
 * one: a returning student re-answers eight questions they answered
 * identically yesterday, to get a quiz of the same shape on a different topic.
 *
 * Everything needed is already on the finished assessment. Difficulty, topics,
 * subtopics and the textbook are stored columns; the count and the question
 * format can be read back off the paper itself. So "another like that one" is
 * derivable rather than something the student has to re-specify.
 *
 * Distinct from a retake, which replays the *same* questions to see whether
 * studying moved the score. This asks for new questions of the same shape.
 */

export interface StoredAssessment {
  subject?: unknown
  difficulty?: unknown
  textbook_id?: unknown
  topic_ids?: unknown
  subtopic_ids?: unknown
  duration?: unknown
}

export interface QuizAgainParams {
  subject: string
  difficultyLevel: string
  questionType: string
  count: number
  textbook_id: number | null
  topic_ids: number[]
  subtopic_ids: number[]
  /** Names taken off the paper, so a repeat still has a topic when the ids were not stored. */
  topics: string[]
  customTime?: number
}

/** Sensible when the paper is unreadable — matches the wizard's own defaults. */
const DEFAULT_COUNT = 10
const DEFAULT_TYPE = 'mcq'
const DEFAULT_DIFFICULTY = 'intermediate'
/** Above this a repeat becomes a different kind of ask, so it is not carried. */
const MAX_COUNT = 40

function intArray(value: unknown): number[] {
  // node-pg usually hands back a real array. A text form ("{7,8}" or a JSON
  // array) used to be dropped, and the repeat then went out with no topics.
  let items: unknown[] = []
  if (Array.isArray(value)) {
    items = value
  } else if (typeof value === 'string') {
    const text = value.trim()
    if (text.startsWith('[')) {
      try {
        const parsed = JSON.parse(text)
        items = Array.isArray(parsed) ? parsed : []
      } catch {
        items = []
      }
    } else {
      items = text.replace(/[{}]/g, '').split(',')
    }
  }
  return items.map((v) => Number(v)).filter((n) => Number.isInteger(n) && n > 0)
}

function topicNames(questions: unknown): string[] {
  if (!Array.isArray(questions)) return []
  const names = new Set<string>()
  for (const q of questions) {
    if (!q || typeof q !== 'object') continue
    const row = q as Record<string, unknown>
    for (const key of ['topic_label', 'topic', 'focus']) {
      const name = String(row[key] ?? '').trim()
      if (name) names.add(name)
    }
  }
  return [...names]
}

/**
 * The mix of question types on the paper, expressed as the wizard would.
 *
 * A paper of MCQs and written answers came from "mixed"; asking for "mcq"
 * would quietly hand back a different kind of quiz from the one being
 * repeated.
 */
export function questionTypeOf(questions: unknown): string {
  if (!Array.isArray(questions) || questions.length === 0) return DEFAULT_TYPE
  const kinds = new Set<string>()
  for (const q of questions) {
    const t = String((q as { type?: unknown })?.type ?? 'mcq').toLowerCase()
    kinds.add(t === 'interactive' ? 'interactive' : t === 'longform' ? 'longform' : 'mcq')
  }
  if (kinds.size === 1) return [...kinds][0]
  if (kinds.has('longform') && kinds.has('mcq') && !kinds.has('interactive')) return 'mixed'
  if (kinds.has('interactive') && kinds.has('mcq') && !kinds.has('longform')) return 'study_mixed'
  // Three kinds at once is not a wizard option; the commonest is the honest answer.
  return 'mixed'
}

export function deriveQuizAgainParams(
  assessment: StoredAssessment | null | undefined,
  questions: unknown,
): QuizAgainParams | null {
  const subject = String(assessment?.subject ?? '').trim()
  if (!subject) return null

  const asked = Array.isArray(questions) ? questions.length : 0
  const duration = Number(assessment?.duration)
  const textbookId = Number(assessment?.textbook_id)
  // Number(null) is 0, and 0 is an integer. A missing book was being sent as
  // textbook 0, which is not a book, and the generator then refused the quiz.

  return {
    subject,
    difficultyLevel: String(assessment?.difficulty ?? '').trim() || DEFAULT_DIFFICULTY,
    questionType: questionTypeOf(questions),
    count: asked > 0 ? Math.min(asked, MAX_COUNT) : DEFAULT_COUNT,
    textbook_id: Number.isInteger(textbookId) && textbookId > 0 ? textbookId : null,
    topic_ids: intArray(assessment?.topic_ids),
    subtopic_ids: intArray(assessment?.subtopic_ids),
    topics: topicNames(questions),
    ...(Number.isFinite(duration) && duration > 0 ? { customTime: Math.round(duration) } : {}),
  }
}

/**
 * Whether repeating this paper would produce anything meaningful.
 *
 * A quiz with no curriculum behind it — a typed topic, or pasted notes — has
 * nothing to regenerate from beyond its subject string, and offering the
 * button there would promise more than it can deliver.
 */
export function canQuizAgain(params: QuizAgainParams | null): boolean {
  if (!params) return false
  return (
    params.topic_ids.length > 0 ||
    params.subtopic_ids.length > 0 ||
    params.topics.length > 0 ||
    params.textbook_id !== null
  )
}
