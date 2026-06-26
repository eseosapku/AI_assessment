import type { StudyNode } from './types'

export interface CheckpointSummary {
  id: string
  step: number
  total: number
  answered: number
  correct: number
  /** Every question answered (regardless of score) — the gate is satisfied. */
  done: boolean
}

// Roll the per-question quiz nodes up into one row per checkpoint, so the tutor
// can be told which checks already exist (and not re-announce/re-emit them).
export function summarizeCheckpoints(nodes: StudyNode[]): CheckpointSummary[] {
  const byId = new Map<string, CheckpointSummary>()
  for (const n of nodes) {
    const q = n.data.quiz
    if (!q) continue
    const row = byId.get(q.checkpointId) ?? {
      id: q.checkpointId,
      step: n.data.step ?? 0,
      total: 0,
      answered: 0,
      correct: 0,
      done: true,
    }
    row.total += 1
    const answered = q.state === 'correct' || q.state === 'incorrect'
    if (answered) row.answered += 1
    else row.done = false
    if (q.state === 'correct') row.correct += 1
    byId.set(q.checkpointId, row)
  }
  return [...byId.values()].sort((a, b) => a.step - b.step)
}
