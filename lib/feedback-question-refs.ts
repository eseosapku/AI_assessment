/**
 * Find question references inside AI feedback so they can be tapped.
 *
 * Feedback routinely says "review questions 4, 6 and 9" — useful advice that
 * the student then has to act on by scrolling and counting. Detecting those
 * references lets the review turn each one into a button that jumps straight
 * to the question.
 *
 * Pure and UI-free: it returns segments, and the caller decides what a
 * reference looks like on screen.
 */

export interface TextSegment {
  type: 'text'
  value: string
}

export interface RefSegment {
  type: 'ref'
  /** The matched phrase, preserved verbatim so the sentence still reads right. */
  value: string
  /** One-based question numbers the phrase points at, ascending and deduped. */
  questions: number[]
}

export type FeedbackSegment = TextSegment | RefSegment

/**
 * Matches "question 4", "questions 4, 6 and 9", "Q3", "Qs 2-4".
 * The number list deliberately allows commas, "and", "&" and dash ranges,
 * because feedback writes all of them.
 */
const REF_PATTERN = /\b(?:questions?|qs?)\s*\.?\s*(\d+(?:\s*(?:,|and|&|to|-|–|—)\s*\d+)*)\b/gi

/** Expand "4-6" to 4,5,6; leave a plain list as-is. */
function expandRange(from: number, to: number, out: Set<number>): void {
  // Guard against a reversed or absurd range producing thousands of entries.
  if (to < from || to - from > 50) {
    out.add(from)
    out.add(to)
    return
  }
  for (let n = from; n <= to; n++) out.add(n)
}

function parseNumbers(list: string): number[] {
  const out = new Set<number>()
  // Split on separators but keep dashes attached so ranges survive.
  for (const chunk of list.split(/\s*(?:,|and|&)\s*/i)) {
    const range = chunk.match(/^(\d+)\s*(?:to|-|–|—)\s*(\d+)$/i)
    if (range) {
      expandRange(Number(range[1]), Number(range[2]), out)
      continue
    }
    const single = chunk.match(/\d+/)
    if (single) out.add(Number(single[0]))
  }
  return [...out].sort((a, b) => a - b)
}

/**
 * Split feedback text into plain runs and question references.
 *
 * `maxQuestion` drops references the paper can't satisfy — feedback sometimes
 * invents a question number, and a button that scrolls nowhere is worse than
 * plain text. A reference whose numbers are all out of range stays as text.
 */
export function splitQuestionRefs(text: string, maxQuestion: number): FeedbackSegment[] {
  const source = String(text ?? '')
  if (!source || !Number.isFinite(maxQuestion) || maxQuestion < 1) {
    return source ? [{ type: 'text', value: source }] : []
  }

  const segments: FeedbackSegment[] = []
  let last = 0
  let match: RegExpExecArray | null
  // Fresh regex per call: the shared literal is stateful with /g.
  const re = new RegExp(REF_PATTERN.source, REF_PATTERN.flags)

  while ((match = re.exec(source)) !== null) {
    const questions = parseNumbers(match[1]).filter((n) => n >= 1 && n <= maxQuestion)
    if (questions.length === 0) continue // leave an unusable reference as plain text

    if (match.index > last) segments.push({ type: 'text', value: source.slice(last, match.index) })
    segments.push({ type: 'ref', value: match[0], questions })
    last = match.index + match[0].length
  }

  if (last < source.length) segments.push({ type: 'text', value: source.slice(last) })
  return segments.length > 0 ? segments : [{ type: 'text', value: source }]
}
