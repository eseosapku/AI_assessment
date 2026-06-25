import { describe, it, expect } from 'vitest'
import { applyActions, isValidAction } from '@/lib/studylab/actions'
import type { CanvasState } from '@/lib/studylab/types'

const empty: CanvasState = { nodes: [], edges: [] }

describe('new card kinds', () => {
  it('isValidAction accepts the new card kinds', () => {
    expect(isValidAction({ type: 'createCard', id: 'm', card: 'mermaid' })).toBe(true)
    expect(isValidAction({ type: 'createCard', id: 'w', card: 'worked' })).toBe(true)
    expect(isValidAction({ type: 'createCard', id: 't', card: 'table' })).toBe(true)
    expect(isValidAction({ type: 'createCard', id: 'c', card: 'callout' })).toBe(true)
  })

  it('reducer copies mermaid/steps/rows/variant into node data', () => {
    const res = applyActions(empty, [
      { type: 'createCard', id: 'm1', card: 'mermaid', step: 1, mermaid: 'graph TD; A-->B', position: 'auto' },
      { type: 'createCard', id: 'w1', card: 'worked', step: 1, steps: ['s1', 's2'], position: 'auto' },
      { type: 'createCard', id: 't1', card: 'table', step: 1, rows: [['a', 'b'], ['1', '2']], position: 'auto' },
      { type: 'createCard', id: 'c1', card: 'callout', step: 1, variant: 'tip', body: 'remember', position: 'auto' },
    ])
    const byId = (id: string) => res.nodes.find((n) => n.id === id)!.data
    expect(byId('m1').mermaid).toBe('graph TD; A-->B')
    expect(byId('w1').steps).toEqual(['s1', 's2'])
    expect(byId('t1').rows).toEqual([['a', 'b'], ['1', '2']])
    expect(byId('c1').variant).toBe('tip')
  })
})
