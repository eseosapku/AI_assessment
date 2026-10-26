import { describe, it, expect } from 'vitest'
import { summarizeCheckpoints, hideChecks } from '@/lib/studylab/checkpointState'
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

describe('hideChecks', () => {
  it('takes a superseded check off the board -- its questions, header and links -- and keeps the record', () => {
    const board: { nodes: StudyNode[]; edges: { id: string; source: string; target: string }[] } = {
      nodes: [
        { id: 'c1', type: 'concept' as const, position: { x: 0, y: 0 }, data: { kind: 'concept' as const, step: 1 } },
        { id: 'cp-1-hdr', type: 'checkpointHeader' as const, position: { x: 0, y: 0 }, data: { kind: 'checkpointHeader' as const, step: 1 } },
        { id: 'cp-1::q1', type: 'quiz' as const, position: { x: 0, y: 0 }, data: { kind: 'quiz' as const, step: 1, quiz: { checkpointId: 'cp-1', gate: 'hard' as const, state: 'incorrect' as const, question: { id: 'q1', format: 'mcq' as const, prompt: 'p', options: ['a', 'b'], answer: 0 } } } },
      ],
      edges: [
        { id: 'e-c1-cp-1-hdr', source: 'c1', target: 'cp-1-hdr' },
        { id: 'e-cp-1-hdr-cp-1::q1', source: 'cp-1-hdr', target: 'cp-1::q1' },
      ],
    }
    const next = hideChecks(board, ['cp-1'])
    expect(next.nodes.map((n) => `${n.id}:${n.hidden ? 'hidden' : 'shown'}`)).toEqual(['c1:shown', 'cp-1-hdr:hidden', 'cp-1::q1:hidden'])
    expect(next.edges).toEqual([])
    expect(hideChecks(board, [])).toBe(board)
  })
})
