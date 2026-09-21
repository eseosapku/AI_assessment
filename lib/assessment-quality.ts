/**
 * Post-generation clean-up for model-written question papers.
 *
 * Two faults show up repeatedly and neither is fixable by prompting alone,
 * because both are only visible once the whole paper exists:
 *
 *  - the same question asked twice in different words ("Which shape has one
 *    curved side?" / "Which shape has a curved edge?"), which wastes questions
 *    and makes a short paper feel broken;
 *  - explanations written to the teacher rather than the student ("This
 *    question tests the student's understanding of..."), which tells the
 *    student nothing about why they were wrong.
 *
 * Pure and shape-agnostic: it reads only `question`, `options`,
 * `correct_answer` and `explanation`, so it works on MCQ papers without
 * knowing anything about the other question types.
 */
import {
  balanceAnswerPositions,
  delexicaliseExplanation,
  reconcileKeyWithExplanation,
  stripOptionLabels,
  type PositionedQuestion,
} from './answer-position'


/** Words carrying no topical signal when comparing two questions. */
const STOPWORDS = new Set([
  'the', 'a', 'an', 'of', 'to', 'in', 'is', 'are', 'was', 'were', 'and', 'or',
  'which', 'what', 'who', 'whom', 'whose', 'that', 'this', 'these', 'those',
  'has', 'have', 'had', 'does', 'do', 'did', 'for', 'from', 'with', 'by', 'on',
  'at', 'as', 'it', 'its', 'be', 'been', 'following', 'best', 'most', 'one',
  // Question-stem verbs. "Which shape has four right angles?" and "Name the
  // shape that has four right angles." are the same question; without these
  // the stem wording alone makes them look distinct.
  'name', 'identify', 'choose', 'select', 'pick', 'state', 'give', 'find',
  'tell', 'say', 'write', 'shown', 'below', 'above', 'correct',
])

/**
 * Containment at or above which two questions asking for the same answer are
 * treated as the same question.
 *
 * Measured against the shorter question rather than the union: after stopwords,
 * a primary-school question is three or four words, so "which shape has one
 * curved side" and "which shape has a curved edge" share two of three content
 * words — obviously the same question, yet only 0.5 by union overlap. Union
 * overlap only separates them at a threshold low enough to catch real pairs
 * too, so containment plus the same-answer guard does the work instead.
 */
export const DUPLICATE_SIMILARITY = 0.6

/** Below this a question has too few content words for overlap to mean anything. */
const MIN_TOKENS_FOR_COMPARISON = 2

function contentTokens(text: string): Set<string> {
  const out = new Set<string>()
  for (const w of String(text ?? '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/)) {
    if (w.length > 1 && !STOPWORDS.has(w)) out.add(w)
  }
  return out
}

/** Shared content words as a fraction of the shorter question, 0..1. */
function similarity(a: Set<string>, b: Set<string>): number {
  if (a.size < MIN_TOKENS_FOR_COMPARISON || b.size < MIN_TOKENS_FOR_COMPARISON) return 0
  let shared = 0
  for (const w of a) if (b.has(w)) shared++
  return shared / Math.min(a.size, b.size)
}

interface QuestionLike {
  question?: unknown
  options?: unknown
  correct_answer?: unknown
  explanation?: unknown
}

/**
 * A comparable form of the answer a question expects, or null.
 *
 * Normalised rather than compared verbatim. A real paper produced "It
 * increases the speed of nerve impulses" and "It increases the speed of the
 * nerve impulse" as the answers to two near-identical questions; on exact
 * text those look like different answers and both survived. Reducing to
 * sorted content words with a crude plural trim makes them match.
 */
function answerText(q: QuestionLike): string | null {
  if (!Array.isArray(q.options)) return null
  const idx = Number(q.correct_answer)
  if (!Number.isInteger(idx) || idx < 0 || idx >= q.options.length) return null
  const raw = String(q.options[idx] ?? '')
  const words = [...contentTokens(raw)]
    .map((w) => (w.length > 4 && w.endsWith('s') ? w.slice(0, -1) : w))
    .sort()
  return words.length > 0 ? words.join(' ') : null
}

/**
 * Drop questions that repeat an earlier one.
 *
 * A pair counts as duplicate only when the wording is highly similar AND both
 * expect the same answer — similar wording alone is a normal way to probe two
 * different facts ("which shape has four sides" vs "which shape has four equal
 * sides"), and those must survive.
 *
 * Order is preserved and the first of each duplicate set is kept.
 */
export function dedupeQuestions<T extends QuestionLike>(questions: readonly T[]): T[] {
  if (!Array.isArray(questions)) return []
  const kept: T[] = []
  const keptTokens: { tokens: Set<string>; answer: string | null }[] = []

  for (const q of questions) {
    if (!q || typeof q !== 'object') continue
    const tokens = contentTokens(String(q.question ?? ''))
    const answer = answerText(q)

    const isDuplicate = keptTokens.some(
      (prev) =>
        prev.answer !== null &&
        answer !== null &&
        prev.answer === answer &&
        similarity(prev.tokens, tokens) >= DUPLICATE_SIMILARITY,
    )
    if (isDuplicate) continue

    kept.push(q)
    keptTokens.push({ tokens, answer })
  }
  return kept
}

/**
 * Examiner-voice openers. These describe the question's purpose to a marker;
 * the student needs the reasoning that follows them.
 */
const EXAMINER_OPENER =
  /^\s*(?:this\s+)?(?:question|item|task)\s+(?:tests?|assesses|evaluates|checks?|examines|measures|is\s+designed\s+to\s+test|aims\s+to\s+test)\b[^.!?]*[.!?]\s*/i

/**
 * The other examiner voice: instructions about the candidate rather than to
 * them. "The student should measure the volume of gas produced over time."
 *
 * Turned up 21 times in a Checkpoint sweep and survived every pass, because
 * the opener above only looks for "this question tests". Rewritten rather
 * than removed: what follows it is the actual answer, and the student needs
 * it — they just need it addressed to them.
 */
const CANDIDATE_VOICE =
  /^\s*(?:the\s+)?(?:student|learner|candidate|pupil)s?\s+(?:should|must|needs?\s+to|is\s+expected\s+to|are\s+expected\s+to|has\s+to|have\s+to)\s+/i

/**
 * Strip an examiner-facing preamble from an explanation.
 *
 * Only ever removes a leading sentence of that exact shape, and never returns
 * an empty string — if the preamble was the whole explanation, the original is
 * kept, because a wrong-but-present explanation beats a blank one.
 */
export function stripExaminerVoice(explanation: unknown): string {
  const text = String(explanation ?? '').trim()
  if (!text) return ''

  let out = text
  // Papers occasionally stack two of these before getting to the point.
  for (let i = 0; i < 2; i++) {
    const next = out.replace(EXAMINER_OPENER, '').trim()
    if (next === out) break
    out = next
  }

  // "The student should measure the volume" becomes "Measure the volume":
  // the same instruction, turned to face the person reading it.
  const turned = out.replace(CANDIDATE_VOICE, '')
  if (turned !== out && turned.trim()) out = turned

  if (!out) return text
  // Re-capitalise if the cut left the sentence starting mid-flow.
  return out.charAt(0).toUpperCase() + out.slice(1)
}

/**
 * Make a long-form question's marks match the mark scheme it actually carries.
 *
 * Measured: 15 of 18 long-form questions in a sample were worth more marks
 * than they gave a marker anything to award — "3 criteria for 8 marks" three
 * times over. The prompt says one point per mark and has said so for a while;
 * the model picks the marks first and then writes however many criteria the
 * question naturally has.
 *
 * The criteria ARE the mark scheme, so they win. A question offering three
 * markable points is a 3-mark question, and calling it 8 marks does not create
 * five more things to say — it just guarantees no student can score full marks.
 *
 * Deliberately narrow: only acts when there is a real list to count, and
 * leaves the marks alone otherwise. Papers with a fixed mark budget — a
 * Checkpoint component — have their marks reset from the blueprint afterwards,
 * so this cannot fight them.
 */
export function reconcileMarksWithCriteria<T extends QuestionLike & { marks?: unknown; marking_criteria?: unknown }>(
  questions: readonly T[],
): T[] {
  if (!Array.isArray(questions)) return []
  return questions.map((q) => {
    if (!q || typeof q !== 'object') return q
    const criteria = Array.isArray(q.marking_criteria)
      ? q.marking_criteria.filter((c: unknown) => String(c ?? '').trim().length > 0)
      : null
    if (!criteria || criteria.length === 0) return q

    const marks = Number(q.marks)
    if (!Number.isInteger(marks) || marks === criteria.length) return q
    return { ...q, marks: criteria.length }
  })
}

/** Are two questions worded identically once stems and filler are removed? */
function sameQuestion(a: Set<string>, b: Set<string>): boolean {
  if (a.size === 0 || a.size !== b.size) return false
  for (const w of a) if (!b.has(w)) return false
  return true
}

/**
 * Drop questions that contradict an earlier one.
 *
 * A paper genuinely produced "Which shape has four right angles?" answered
 * Square and "Name the shape that has four right angles." answered Rectangle.
 * Both cannot be right: the property is ambiguous, and whichever the student
 * picks they are marked wrong somewhere. `dedupeQuestions` deliberately keeps
 * differing-answer pairs, so this catches the case it must let through.
 *
 * Only exact content-word matches count. A question that merely narrows an
 * earlier one ("four sides" vs "four EQUAL sides") legitimately has a different
 * answer, and the extra word keeps the sets distinct so it survives.
 */
export function dropContradictions<T extends QuestionLike>(questions: readonly T[]): T[] {
  if (!Array.isArray(questions)) return []
  const kept: T[] = []
  const seen: { tokens: Set<string>; answer: string | null }[] = []

  for (const q of questions) {
    if (!q || typeof q !== 'object') continue
    const tokens = contentTokens(String(q.question ?? ''))
    const answer = answerText(q)

    const contradicts = seen.some(
      (prev) =>
        prev.answer !== null &&
        answer !== null &&
        prev.answer !== answer &&
        sameQuestion(prev.tokens, tokens),
    )
    if (contradicts) continue

    kept.push(q)
    seen.push({ tokens, answer })
  }
  return kept
}

/**
 * Apply every clean-up to a paper, in order.
 *
 * The order carries the argument:
 *
 *  1. **Repair the key first.** `dedupeQuestions` and `dropContradictions`
 *     both reason about which option is correct, so they need the true answer
 *     rather than the one a miscounted index points at.
 *  2. **Then dedupe and drop contradictions**, on questions whose keys mean
 *     what they say.
 *  3. **Balance the positions last**, over the questions that actually ship —
 *     balancing before the drops would leave the survivors lopsided again.
 */
export function cleanQuestionPaper<T extends QuestionLike>(questions: readonly T[]): T[] {
  const keyed = (Array.isArray(questions) ? questions : []).map((q) =>
    q && typeof q === 'object'
      ? (stripOptionLabels(
          delexicaliseExplanation(reconcileKeyWithExplanation(q as PositionedQuestion)),
        ) as unknown as T)
      : q,
  )

  const cleaned = dropContradictions(dedupeQuestions(keyed)).map((q) => {
    const fixed = stripExaminerVoice(q.explanation)
    return fixed && fixed !== q.explanation ? { ...q, explanation: fixed } : q
  })

  return reconcileMarksWithCriteria(
    balanceAnswerPositions(cleaned as unknown as PositionedQuestion[]) as unknown as T[],
  )
}
