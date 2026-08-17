/**
 * Whether an illustrated question actually needs its picture.
 *
 * The question that prompted this, verbatim from a generated paper:
 *
 *   "A map shows a backyard scene during a rainfall. The rain is visible as
 *    streaks on the image. What does this indicate about the weather
 *    conditions?"  →  "It is a rainy day with precipitation."
 *
 * It fails four ways at once. It calls a photograph a map. It *describes the
 * image in words*, so the picture adds nothing. It *states the answer in the
 * stem*. And the options are trivially guessable from the stem alone.
 *
 * The rule this encodes: a question carrying a figure must be unanswerable
 * without looking at it. Prompting alone can't enforce that — the model
 * cheerfully agrees and then does it anyway — so the paper is checked.
 */

/** What to do about a question that fails. */
export type ImageQuestionVerdict =
  | { ok: true }
  | { ok: false; action: 'drop-question'; reason: string }
  | { ok: false; action: 'drop-image'; reason: string }

const STOPWORDS = new Set([
  'the', 'a', 'an', 'of', 'to', 'in', 'is', 'are', 'was', 'were', 'and', 'or',
  'it', 'its', 'this', 'that', 'these', 'those', 'what', 'which', 'does', 'do',
  'on', 'at', 'as', 'for', 'from', 'with', 'by', 'be', 'been', 'about', 'has',
  'have', 'shown', 'show', 'shows', 'image', 'picture', 'figure', 'diagram',
  'photograph', 'photo', 'above', 'below', 'following', 'indicate', 'indicates',
])

function contentWords(text: string): string[] {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w))
}

/**
 * Does the stem already contain the answer?
 *
 * Measured over the correct option's *distinctive* words — those not shared
 * with the other options. That distinction is what makes this safe: a stem
 * about "the plant cell" with "Cell wall" as the answer shares the word "cell"
 * with every distractor, so it carries no information and must not count as a
 * leak. What matters is whether the stem hands over the part that separates
 * the right answer from the wrong ones.
 *
 * Comparison is loosely stemmed, because a generated stem paraphrases rather
 * than repeating: "rainfall" gives away "rainy".
 */
export function answerLeakage(stem: string, correctOption: string, otherOptions: readonly string[] = []): number {
  const shared = new Set(otherOptions.flatMap((o) => contentWords(o)))
  const distinctive = contentWords(correctOption).filter((w) => !shared.has(w))
  if (distinctive.length === 0) return 0

  const stemWords = new Set(contentWords(stem))
  const hit = distinctive.filter((w) =>
    [...stemWords].some((s) => s === w || s.startsWith(w) || w.startsWith(s)),
  )
  return hit.length / distinctive.length
}

/**
 * At or above this share of the answer's distinctive words restated in the
 * stem, the question gives itself away. Half is the right bar once shared
 * context is excluded: what remains is signal.
 */
export const LEAKAGE_LIMIT = 0.5

/**
 * Does the stem narrate the picture instead of pointing at it?
 *
 * Referring to a figure ("in the photograph…") is fine and often necessary.
 * Describing its contents ("the image shows a backyard during rainfall") makes
 * the figure decorative, which is the opposite of an image-based question.
 */
export function describesTheImage(stem: string): boolean {
  const s = String(stem ?? '')
  return /\b(?:the\s+)?(?:image|picture|photo|photograph|figure|diagram|map|graph)\s+(?:shows|depicts|displays|illustrates|contains|is\s+of)\b/i.test(s)
    || /\bis\s+visible\s+(?:as|in|on)\b/i.test(s)
}

/** Figure kinds a stem might name, mapped to the vision classifier's vocabulary. */
const TYPE_WORDS: Record<string, string[]> = {
  map: ['map'],
  graph: ['graph', 'chart'],
  diagram: ['diagram'],
  photograph: ['photo', 'photograph', 'image', 'picture'],
  table: ['table'],
}

/**
 * Does the stem call the figure something it is not?
 *
 * Calling a photograph "a map" is confusing on its own, and for a student
 * reading with a screen reader it is actively misleading.
 */
export function figureTypeMismatch(stem: string, visionType: string | undefined): boolean {
  const actual = String(visionType ?? '').toLowerCase().trim()
  if (!actual) return false // nothing reliable to compare against
  const s = String(stem ?? '').toLowerCase()

  for (const [kind, words] of Object.entries(TYPE_WORDS)) {
    const named = words.some((w) => new RegExp(`\\b${w}\\b`).test(s))
    if (!named) continue
    // "photograph" is the generic fallback; only flag a confident mismatch.
    if (kind === 'photograph') continue
    if (!actual.includes(kind)) return true
  }
  return false
}

/**
 * Judge one illustrated question.
 *
 * A leaked answer is the question's fault and no figure can rescue it, so the
 * question goes. A redundant or mislabelled figure is the *figure's* fault —
 * the question still works as text, so only the image is removed. Dropping a
 * whole question costs the student a mark's worth of practice; dropping an
 * image costs nothing.
 */
export function judgeImageQuestion(q: {
  question?: unknown
  options?: unknown
  correct_answer?: unknown
  visionType?: unknown
}): ImageQuestionVerdict {
  const stem = String(q?.question ?? '')
  const options = Array.isArray(q?.options) ? q.options : []
  const idx = Number(q?.correct_answer)
  const correct = Number.isInteger(idx) && idx >= 0 && idx < options.length ? String(options[idx] ?? '') : ''

  const others = options.filter((_, i) => i !== idx).map((o) => String(o ?? ''))
  if (correct && answerLeakage(stem, correct, others) >= LEAKAGE_LIMIT) {
    return { ok: false, action: 'drop-question', reason: 'the stem restates the answer' }
  }
  if (describesTheImage(stem)) {
    return { ok: false, action: 'drop-image', reason: 'the stem describes the figure, making it redundant' }
  }
  if (figureTypeMismatch(stem, q?.visionType as string | undefined)) {
    return { ok: false, action: 'drop-image', reason: 'the stem names the wrong kind of figure' }
  }
  return { ok: true }
}
