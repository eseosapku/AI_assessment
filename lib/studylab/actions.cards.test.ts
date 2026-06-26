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

  it('drops a createCard whose title duplicates an existing AI card', () => {
    const state: CanvasState = {
      nodes: [{ id: 'a', type: 'concept', position: { x: 0, y: 0 }, data: { kind: 'concept', title: 'Properties of a BST' } }],
      edges: [],
    }
    const res = applyActions(state, [
      { type: 'createCard', id: 'b', card: 'concept', title: '  properties of a BST ', body: 'x', position: 'auto' },
    ])
    expect(res.created).toEqual([])
    expect(res.nodes).toHaveLength(1)
  })

  it('updateCard rewrites an existing card in place and only the sent fields', () => {
    const state: CanvasState = {
      nodes: [{ id: 'x', type: 'concept', position: { x: 5, y: 9 }, data: { kind: 'concept', title: 'Old', body: 'long body', step: 1 } }],
      edges: [],
    }
    const res = applyActions(state, [{ type: 'updateCard', id: 'x', body: 'simpler body' }])
    expect(res.nodes).toHaveLength(1)
    const data = res.nodes[0].data
    expect(data.body).toBe('simpler body')
    expect(data.title).toBe('Old') // untouched field preserved
    expect(res.nodes[0].position).toEqual({ x: 5, y: 9 }) // not moved
  })

  it('updateCard on a missing id is a no-op', () => {
    const res = applyActions(empty, [{ type: 'updateCard', id: 'nope', body: 'x' }])
    expect(res.nodes).toHaveLength(0)
  })

  it('accepts a web card and copies html/css/js into node data', () => {
    expect(isValidAction({ type: 'createCard', id: 'w', card: 'web' })).toBe(true)
    const res = applyActions(empty, [
      { type: 'createCard', id: 'w1', card: 'web', step: 1, html: '<h1>Hi</h1>', css: 'h1{color:red}', js: 'console.log(1)', position: 'auto' },
    ])
    const data = res.nodes.find((n) => n.id === 'w1')!.data
    expect(data.html).toBe('<h1>Hi</h1>')
    expect(data.css).toBe('h1{color:red}')
    expect(data.js).toBe('console.log(1)')
  })

  it('updateCard can rewrite a web card in place', () => {
    const state: CanvasState = {
      nodes: [{ id: 'w', type: 'web', position: { x: 0, y: 0 }, data: { kind: 'web', html: '<p>old</p>', css: '' } }],
      edges: [],
    }
    const res = applyActions(state, [{ type: 'updateCard', id: 'w', css: 'p{font-weight:bold}' }])
    const data = res.nodes[0].data
    expect(data.css).toBe('p{font-weight:bold}')
    expect(data.html).toBe('<p>old</p>') // untouched
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
