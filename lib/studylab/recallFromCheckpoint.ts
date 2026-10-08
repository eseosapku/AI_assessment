import type { QuizCell } from './types'
import type { RecallCardInput } from '@/lib/recall/types'

// Turn the questions a student got WRONG in a LearnSpace checkpoint into
// spaced-repetition cards (front = the question, back = the correct answer).
export function buildCheckpointRecallCards(cells: QuizCell[]): RecallCardInput[] {
  const out: RecallCardInput[] = []
  for (const c of cells) {
    if (c.state !== 'incorrect') continue
    const q = c.question
    const front = (q.prompt ?? '').trim()
    let back = ''
    switch (q.format) {
      case 'mcq':
        back = q.options[q.answer] ?? ''
        if (q.explain) back += (back ? '\n\n' : '') + q.explain
        break
      case 'short':
        back = q.rubric ?? 'Review this concept.'
        break
      case 'code':
        back = q.goal
        break
      case 'match':
        back = q.pairs.map((p) => `${p.left} → ${p.right}`).join('\n')
        break
    }
    back = back.trim()
    if (front && back) out.push({ front, back })
  }
  return out
}

/**
 * What the student is told once their missed questions are saved to Recall.
 *
 * They were always saved, and nobody was told: a deck appeared in Recall with
 * no account of where it came from, and the review that makes a miss worth
 * something never happened.
 */
export function recallNotice(saved: number): string {
  if (saved <= 0) return ''
  return saved === 1
    ? 'The question you missed is saved to Recall, so it comes back for review.'
    : `The ${saved} questions you missed are saved to Recall, so they come back for review.`
}
