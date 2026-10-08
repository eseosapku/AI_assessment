/**
 * Map each generated question to the subtopic it fits, so the Learning Gap
 * Map records real per-subtopic mastery. Done locally, with no AI call.
 *
 * A tag is a claim about where a question came from, and save-result scores
 * it as one. Two rules from what the Gap Map showed:
 *
 * - One shared word is not a match for a longer section name. "data
 *   minimization" went to "Adding Data to a Map", "irrational number" to
 *   "Number of members in a set". A match needs two shared words, or every
 *   word of a one-word name ("Fractions").
 * - An unmatched question is not handed a section in turn. It used to be,
 *   for "coverage", and that guess coloured a section the student was never
 *   tested on. It is left untagged, or tagged to the chapter when every
 *   candidate section sits in one chapter -- that much is known.
 */
import { tagTokens } from './tag-tokens'

export interface CandidateSubtopic { id: number; name: string; topic_id: number | null }

/** Tags the questions in place; returns the ids of the subtopics matched. */
export function tagQuestionsWithSubtopics(questions: any[], subtopics: readonly CandidateSubtopic[]): number[] {
  if (!Array.isArray(questions) || questions.length === 0 || subtopics.length === 0) return []
  const candidates = subtopics.map((s) => ({ ...s, tokens: new Set(tagTokens(s.name)) }))
  const chapters = new Set(candidates.map((c) => c.topic_id))
  const oneChapter = chapters.size === 1 ? candidates[0].topic_id : null
  const used = new Set<number>()
  for (const q of questions) {
    if (!q || typeof q !== 'object') continue
    const qTokens = new Set(tagTokens(`${q.question ?? ''} ${Array.isArray(q.options) ? q.options.join(' ') : ''} ${q.explanation ?? ''}`))
    // A one-word name has to be in the question itself: a lever question went
    // to "Speed" on an option reading "to increase speed".
    const stemTokens = new Set(tagTokens(String(q.question ?? '')))
    let best: (typeof candidates)[number] | null = null
    let bestScore = 0
    for (const c of candidates) {
      let score = 0
      for (const tok of c.tokens) if (qTokens.has(tok)) score += 1
      if (score > bestScore) { bestScore = score; best = c }
    }
    // The student asked for exactly one subtopic: every question is from it.
    const strong = best && bestScore >= 2
    const wholeOneWord = best && best.tokens.size === 1 && bestScore === 1 && [...best.tokens].every((t) => stemTokens.has(t))
    const chosen = candidates.length === 1 ? candidates[0] : strong || wholeOneWord ? best : null
    if (chosen) {
      q.subtopic_id = chosen.id
      q.topic_id = chosen.topic_id ?? null
      q.topic_label_matched = true
      // Readable counterpart to subtopic_id, for the review page's weak areas.
      q.topic_label = chosen.name
      used.add(chosen.id)
    } else if (oneChapter !== null) {
      q.topic_id = oneChapter
    }
  }
  return [...used]
}
