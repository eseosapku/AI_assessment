// lib/studylab/turnBoard.test.ts
import { describe, it, expect } from 'vitest'
import { boardAfterTurn } from './turnBoard'
import { applyActions } from './actions'
import { layoutGraph } from './layout'
import type { CanvasState, TutorAction } from './types'

/**
 * A failed check comes off the board with the turn that answers it. Taken off
 * after the board was laid out, it left a hole the next re-layout closed: the
 * near-twin practice the camera had just framed moved 600px up, off screen.
 */
describe('boardAfterTurn', () => {
  const question = (id: string) => ({ id, format: 'mcq', prompt: `${id}?`, options: ['a', 'b'], answer: 0 })
  const before = (): CanvasState => {
    const built = applyActions({ nodes: [], edges: [] }, [
      { type: 'createCard', id: 'c1', card: 'concept', title: 'Denominators', body: 'b', step: 1 },
      { type: 'createCard', id: 'p1', card: 'practice', title: 'Bigger pieces', body: 'b', answer: '1/5', step: 1 },
      { type: 'checkpoint', id: 'cp-1', step: 1, gate: 'hard', questions: [question('q1'), question('q2')] },
    ] as TutorAction[])
    const layout = layoutGraph(built.nodes, built.edges)
    return { nodes: built.nodes.map((n) => (layout[n.id] ? { ...n, position: layout[n.id] } : n)), edges: built.edges }
  }
  const twin: TutorAction[] = [
    { type: 'createCard', id: 'p2', card: 'practice', title: 'Which slices are bigger', body: 'b', answer: '6', step: 1 },
    { type: 'connect', from: 'p1', to: 'p2' },
  ] as TutorAction[]

  it('lays the board out without the check it takes off, so the new card stays where it is put', () => {
    const out = boardAfterTurn({ canvas: before(), actions: twin, hide: ['cp-1'] })
    const p2 = out.canvas.nodes.find((n) => n.id === 'p2')!
    expect(out.canvas.nodes.filter((n) => n.id.startsWith('cp-1')).every((n) => n.hidden)).toBe(true)
    // Laying it out again -- what the board does once sizes settle -- moves nothing.
    expect(layoutGraph(out.canvas.nodes, out.canvas.edges).p2).toEqual(p2.position)
    expect(out.created).toEqual(['p2'])
  })

  it('takes the check off even on a turn that built nothing', () => {
    const out = boardAfterTurn({ canvas: before(), actions: [], hide: ['cp-1'] })
    expect(out.canvas.nodes.filter((n) => n.id.startsWith('cp-1')).every((n) => n.hidden)).toBe(true)
  })
})
