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
  it('accepts a checkpoint with at least one question (salvaged in the reducer)', () => {
    expect(isValidAction({ ...checkpoint, questions: [{ id: 'x', format: 'mcq' }] })).toBe(true)
  })
  it('rejects a checkpoint with no questions', () => {
    expect(isValidAction({ ...checkpoint, questions: [] })).toBe(false)
  })
})

describe('applyActions checkpoint salvage', () => {
  it('keeps valid questions and drops the malformed one', () => {
    const cp = {
      type: 'checkpoint' as const,
      id: 'cp9',
      step: 1,
      gate: 'hard' as const,
      questions: [
        { id: 'cp9-a', format: 'mcq' as const, prompt: 'p', options: ['x', 'y'], answer: '1' }, // string answer → coerced
        { format: 'short' as const, prompt: 'explain' }, // missing id → backfilled
        { id: 'cp9-c', format: 'mcq' as const, prompt: 'bad' }, // no options → dropped
      ],
    }
    const res = applyActions(empty, [cp as any])
    const quizzes = res.nodes.filter((n) => n.type === 'quiz')
    expect(quizzes).toHaveLength(2)
    const mcq = quizzes.find((n) => n.id === 'cp9::cp9-a')!
    expect(mcq.data.quiz?.question).toMatchObject({ format: 'mcq', answer: 1 })
  })
})

describe('applyActions checkpoint', () => {
  it('creates a header node and one quiz node per question', () => {
    const res = applyActions(empty, [checkpoint])
    const header = res.nodes.find((n) => n.type === 'checkpointHeader')
    const quizzes = res.nodes.filter((n) => n.type === 'quiz')
    expect(header?.id).toBe('cp1-hdr')
    expect(quizzes.map((n) => n.id)).toEqual(['cp1::cp1-q1', 'cp1::cp1-q2'])
    expect(quizzes[0].data.quiz?.checkpointId).toBe('cp1')
    expect(quizzes[0].data.quiz?.gate).toBe('hard')
    expect(quizzes[0].data.quiz?.state).toBe('unanswered')
    expect(res.created).toContain('cp1::cp1-q1')
  })

  it('is idempotent on the same checkpoint id', () => {
    const once = applyActions(empty, [checkpoint])
    const twice = applyActions({ nodes: once.nodes, edges: once.edges }, [checkpoint])
    expect(twice.created).toEqual([])
    expect(twice.nodes.filter((n) => n.type === 'quiz')).toHaveLength(2)
  })
})

/**
 * Two checks on one board, both using the ids the check-writing prompt shows.
 *
 * The prompt spells out an example with "q1", "q2", "q3", so every
 * automatically written check comes back with exactly those. Using them as node
 * ids meant the second check on a board had all of its questions skipped as
 * duplicates, leaving a header with nothing under it and an open check that
 * could never be answered — the lesson could not be continued or finished.
 */
describe('two checkpoints whose questions share ids', () => {
  const check = (id: string, step: number) => ({
    type: 'checkpoint' as const,
    id,
    step,
    gate: 'hard' as const,
    questions: [
      { id: 'q1', format: 'mcq' as const, prompt: `Q for ${id}?`, options: ['a', 'b'], answer: 0 },
      { id: 'q2', format: 'short' as const, prompt: `Short for ${id}?` },
    ],
  })

  it('renders both, rather than dropping the second', () => {
    let state = applyActions({ nodes: [], edges: [] }, [check('cp-s1-auto', 1)])
    state = applyActions({ nodes: state.nodes, edges: state.edges }, [check('cp-s3-auto', 3)])

    const cells = state.nodes.filter((n) => n.type === 'quiz')
    expect(cells).toHaveLength(4)
    expect(new Set(cells.map((n) => n.id)).size).toBe(4)
  })

  it('keeps each cell pointing at its own checkpoint', () => {
    let state = applyActions({ nodes: [], edges: [] }, [check('cp-a', 1)])
    state = applyActions({ nodes: state.nodes, edges: state.edges }, [check('cp-b', 2)])

    const byCp = state.nodes
      .filter((n) => n.type === 'quiz')
      .reduce<Record<string, number>>((acc, n) => {
        const id = n.data.quiz!.checkpointId
        acc[id] = (acc[id] ?? 0) + 1
        return acc
      }, {})
    expect(byCp).toEqual({ 'cp-a': 2, 'cp-b': 2 })
  })

  it('never leaves a header with no questions under it', () => {
    let state = applyActions({ nodes: [], edges: [] }, [check('cp-a', 1)])
    state = applyActions({ nodes: state.nodes, edges: state.edges }, [check('cp-b', 2)])

    for (const header of state.nodes.filter((n) => n.type === 'checkpointHeader')) {
      const cpId = header.id.replace(/-hdr$/, '')
      const cells = state.nodes.filter((n) => n.data.quiz?.checkpointId === cpId)
      expect(cells.length, `${cpId} has a header and no questions`).toBeGreaterThan(0)
    }
  })

  it('still ignores the same checkpoint arriving twice', () => {
    let state = applyActions({ nodes: [], edges: [] }, [check('cp-a', 1)])
    const before = state.nodes.length
    state = applyActions({ nodes: state.nodes, edges: state.edges }, [check('cp-a', 1)])
    expect(state.nodes).toHaveLength(before)
  })
})
