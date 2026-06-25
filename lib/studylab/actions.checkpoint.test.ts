import { describe, it, expect } from 'vitest'
import { applyActions, isValidAction } from '@/lib/studylab/actions'
import type { CanvasState } from '@/lib/studylab/types'

const empty: CanvasState = { nodes: [], edges: [] }
const checkpoint = {
  type: 'checkpoint' as const,
  id: 'cp1',
  step: 1,
  gate: 'hard' as const,
  questions: [
    { id: 'cp1-q1', format: 'mcq' as const, prompt: 'p', options: ['a', 'b'], answer: 0 },
    { id: 'cp1-q2', format: 'short' as const, prompt: 'explain' },
  ],
}

describe('isValidAction checkpoint', () => {
  it('accepts a well-formed checkpoint', () => {
    expect(isValidAction(checkpoint)).toBe(true)
  })
  it('rejects a checkpoint with a bad question', () => {
    expect(isValidAction({ ...checkpoint, questions: [{ id: 'x', format: 'mcq' }] })).toBe(false)
  })
})

describe('applyActions checkpoint', () => {
  it('creates a header node and one quiz node per question', () => {
    const res = applyActions(empty, [checkpoint])
    const header = res.nodes.find((n) => n.type === 'checkpointHeader')
    const quizzes = res.nodes.filter((n) => n.type === 'quiz')
    expect(header?.id).toBe('cp1-hdr')
    expect(quizzes.map((n) => n.id)).toEqual(['cp1-q1', 'cp1-q2'])
    expect(quizzes[0].data.quiz?.checkpointId).toBe('cp1')
    expect(quizzes[0].data.quiz?.gate).toBe('hard')
    expect(quizzes[0].data.quiz?.state).toBe('unanswered')
    expect(res.created).toContain('cp1-q1')
  })

  it('is idempotent on the same checkpoint id', () => {
    const once = applyActions(empty, [checkpoint])
    const twice = applyActions({ nodes: once.nodes, edges: once.edges }, [checkpoint])
    expect(twice.created).toEqual([])
    expect(twice.nodes.filter((n) => n.type === 'quiz')).toHaveLength(2)
  })
})
