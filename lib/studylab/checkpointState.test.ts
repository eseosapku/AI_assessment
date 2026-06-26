import { describe, it, expect } from 'vitest'
import { summarizeCheckpoints } from '@/lib/studylab/checkpointState'
import type { StudyNode, QuizCell } from '@/lib/studylab/types'

function quizNode(id: string, cpId: string, step: number, state: QuizCell['state']): StudyNode {
  return {
    id,
    type: 'quiz',
    position: { x: 0, y: 0 },
    data: { kind: 'quiz', step, quiz: { checkpointId: cpId, gate: 'hard', question: { id, format: 'short', prompt: 'q' }, state } },
  }
}

describe('summarizeCheckpoints', () => {
  it('groups quiz nodes into one row per checkpoint with counts', () => {
    const nodes = [
      quizNode('q1', 'cp-3', 3, 'correct'),
      quizNode('q2', 'cp-3', 3, 'incorrect'),
      quizNode('q3', 'cp-4', 4, 'unanswered'),
    ]
    const out = summarizeCheckpoints(nodes)
    expect(out).toHaveLength(2)
    const cp3 = out.find((c) => c.id === 'cp-3')!
    expect(cp3).toMatchObject({ step: 3, total: 2, answered: 2, correct: 1, done: true })
    const cp4 = out.find((c) => c.id === 'cp-4')!
    expect(cp4).toMatchObject({ total: 1, answered: 0, done: false })
  })

  it('returns nothing when there are no quiz nodes', () => {
    expect(summarizeCheckpoints([{ id: 'c', type: 'concept', position: { x: 0, y: 0 }, data: { kind: 'concept' } }])).toEqual([])
  })
})
