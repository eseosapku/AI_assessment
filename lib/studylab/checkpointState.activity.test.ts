// lib/studylab/checkpointState.activity.test.ts
import { describe, it, expect } from 'vitest'
import { summarizeCheckpoints } from './checkpointState'
import type { StudyNode } from './types'

const activityNode = (id: string, checkpointId: string, solved: boolean): StudyNode => ({
  id,
  type: 'activity',
  position: { x: 0, y: 0 },
  data: {
    kind: 'activity',
    spec: {
      pattern: 'sort',
      prompt: 'Sort.',
      payload: { bins: [{ id: 'b', label: 'B' }], items: [{ id: 'i', label: 'I', binId: 'b' }] },
      success: { kind: 'binAssignment', assign: { i: 'b' } },
      satisfiesCheckpoint: checkpointId,
    },
    activityState: {
      status: solved ? 'solved' : 'in_progress',
      attempts: 1, hintsUsed: 0, elapsedMs: 100, rejectedMoves: [], work: {},
    },
  },
})

describe('summarizeCheckpoints with activities', () => {
  it('marks a checkpoint done when its activity is solved', () => {
    const out = summarizeCheckpoints([activityNode('a1', 'cp1', true)])
    const cp = out.find((c) => c.id === 'cp1')
    expect(cp).toBeDefined()
    expect(cp!.done).toBe(true)
    expect(cp!.total).toBe(1)
    expect(cp!.correct).toBe(1)
  })

  it('leaves a checkpoint not done while its activity is unsolved', () => {
    const out = summarizeCheckpoints([activityNode('a1', 'cp1', false)])
    const cp = out.find((c) => c.id === 'cp1')
    expect(cp!.done).toBe(false)
    expect(cp!.correct).toBe(0)
  })

  it('ignores activities with no checkpoint binding', () => {
    const node = activityNode('a1', '', true)
    delete (node.data.spec as { satisfiesCheckpoint?: string }).satisfiesCheckpoint
    expect(summarizeCheckpoints([node])).toEqual([])
  })

  it('does not disturb existing quiz-only checkpoints', () => {
    const quizNode: StudyNode = {
      id: 'q1', type: 'quiz', position: { x: 0, y: 0 },
      data: {
        kind: 'quiz', step: 1,
        quiz: {
          checkpointId: 'cpQ', gate: 'hard', state: 'correct',
          question: { id: 'q', format: 'mcq', prompt: 'p', options: ['a'], answer: 0 },
        },
      },
    }
    const out = summarizeCheckpoints([quizNode])
    expect(out.find((c) => c.id === 'cpQ')!.done).toBe(true)
  })

  it('merges an activity into an existing quiz checkpoint id instead of duplicating the row', () => {
    const quizNode: StudyNode = {
      id: 'q1', type: 'quiz', position: { x: 0, y: 0 },
      data: {
        kind: 'quiz', step: 2,
        quiz: {
          checkpointId: 'cp-shared', gate: 'hard', state: 'correct',
          question: { id: 'q', format: 'mcq', prompt: 'p', options: ['a'], answer: 0 },
        },
      },
    }
    const out = summarizeCheckpoints([quizNode, activityNode('a1', 'cp-shared', true)])
    expect(out).toHaveLength(1)
    const cp = out.find((c) => c.id === 'cp-shared')!
    expect(cp.total).toBe(2)
    expect(cp.answered).toBe(2)
    expect(cp.correct).toBe(2)
    expect(cp.done).toBe(true)
  })
})
