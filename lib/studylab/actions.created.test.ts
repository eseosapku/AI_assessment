import { describe, it, expect } from 'vitest'
import { applyActions } from '@/lib/studylab/actions'
import type { CanvasState } from '@/lib/studylab/types'

const empty: CanvasState = { nodes: [], edges: [] }

describe('applyActions created ids', () => {
  it('reports the id of a newly created card', () => {
    const res = applyActions(empty, [
      { type: 'createCard', id: 's1-a', card: 'concept', title: 'A', step: 1, position: 'auto' },
    ])
    expect(res.created).toEqual(['s1-a'])
  })

  it('does not report an id that already exists', () => {
    const state: CanvasState = {
      nodes: [{ id: 's1-a', type: 'concept', position: { x: 0, y: 0 }, data: { kind: 'concept', step: 1 } }],
      edges: [],
    }
    const res = applyActions(state, [
      { type: 'createCard', id: 's1-a', card: 'concept', title: 'dup', step: 1, position: 'auto' },
    ])
    expect(res.created).toEqual([])
  })
})
