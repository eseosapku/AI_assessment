/**
 * Three marks the generator leaves on a finished paper.
 *
 * None of them makes a question unanswerable, so nothing above drops them, and
 * all three reached real papers:
 *
 *  1. **The same sentence twice.** "Look at the graph. During a lesson, Sam
 *     noticed that the graph shows a peak at a certain element. Look at the
 *     graph. Sam noticed that the graph shows a peak at a certain element.
 *     Write down the name of the element where the peak occurs." The scenario
 *     is pasted in twice because every part is told to begin with it and this
 *     part already had it.
 *
 *  2. **A part label inside the stem.** "Explain why earthquakes often occur
 *     near volcanoes. (b) Write down one reason why earthquakes often occur
 *     near volcanoes." The "(b)" belongs to the paper's numbering, not to the
 *     sentence, and the learner sees a stray marker mid-question.
 *
 *  3. **One figure on two unrelated questions.** A clean-up illustration
 *     appeared on question 11 and again on question 25; a mitochondrion on 12
 *     and 26. Parts of ONE question sharing a figure is correct and expected —
 *     that is how a real paper is laid out — so only a repeat that is not
 *     adjacent counts as a fault.
 */

export interface TidyQuestion {
  question?: unknown
  image_url?: unknown
  [key: string]: unknown
}

/**
 * Remove a sentence the stem already said.
 *
 * Compared on content words so "Sam noticed that the graph shows a peak" and
 * "During a lesson, Sam noticed that the graph shows a peak" count as the same
 * sentence. The FIRST occurrence is kept, because the scenario belongs at the
 * front.
 */
export function dropRepeatedSentences(stem: unknown): string {
  const text = String(stem ?? '').trim()
  if (!text) return ''

  const sentences = text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean)
  if (sentences.length < 2) return text

  const content = (s: string) =>
    new Set(
      s.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/).filter((w) => w.length > 3),
    )

  const keptText: string[] = []
  const keptWords: Set<string>[] = []

  for (const s of sentences) {
    const words = content(s)

    // Few content words ("Look at the graph.") — only a repeat word for word,
    // or two different short demands would collapse into one.
    if (words.size < 3) {
      if (keptText.some((k) => k.toLowerCase() === s.toLowerCase())) continue
      keptText.push(s)
      keptWords.push(words)
      continue
    }

    // Otherwise a sentence whose content words are all already present is the
    // same sentence said again. "Sam noticed the graph shows a peak" against
    // "During a lesson, Sam noticed the graph shows a peak" is a subset, and
    // that is precisely the shape the pasted-in scenario takes.
    const already = keptWords.some((k) => {
      const [small, large] = k.size <= words.size ? [k, words] : [words, k]
      return [...small].every((w) => large.has(w))
    })
    if (already) continue
    keptText.push(s)
    keptWords.push(words)
  }
  return keptText.join(' ')
}

/** "(b)" and "(ii)" belong to the paper's numbering, not inside a sentence. */
export function stripPartLabels(stem: unknown): string {
  return String(stem ?? '')
    // Only mid-stem: a leading "(a)" is the renderer's business, and by the
    // time this runs the stem should carry none at all.
    .replace(/(?<=[.!?])\s*\((?:[a-z]|i{1,3}|iv|v)\)\s*/gi, ' ')
    .replace(/^\s*\((?:[a-z]|i{1,3}|iv|v)\)\s*/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/**
 * Remove a figure that already appeared on an earlier, non-adjacent question.
 *
 * Adjacency is the whole test. Parts of one numbered question share a figure
 * by design; question 11 and question 25 sharing one is the generator reusing
 * an image it had already spent.
 */
export function dropRepeatedFigures<T extends TidyQuestion>(questions: readonly T[]): {
  questions: T[]
  removed: number
} {
  if (!Array.isArray(questions)) return { questions: [], removed: 0 }

  const lastSeenAt = new Map<string, number>()
  let removed = 0
  const out = questions.map((q, i) => {
    const path = String(q?.image_url ?? '').trim()
    if (!path) return q
    const previous = lastSeenAt.get(path)
    if (previous !== undefined && i - previous > 1) {
      removed++
      const { image_url, ...rest } = q
      return rest as T
    }
    lastSeenAt.set(path, i)
    return q
  })
  return { questions: out, removed }
}

/** Every tidy-up, in the order they have to run. */
export function tidyPaper<T extends TidyQuestion>(questions: readonly T[]): { questions: T[]; removed: number } {
  if (!Array.isArray(questions)) return { questions: [], removed: 0 }
  const cleaned = questions.map((q) => {
    if (!q || typeof q !== 'object') return q
    const stem = typeof q.question === 'string' ? q.question : ''
    if (!stem) return q
    const next = stripPartLabels(dropRepeatedSentences(stem))
    return next && next !== stem ? { ...q, question: next } : q
  })
  return dropRepeatedFigures(cleaned)
}
