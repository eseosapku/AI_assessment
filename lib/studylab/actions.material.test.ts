import { describe, it, expect } from 'vitest'
import { applyActions, isValidAction } from './actions'
import type { CanvasState, TutorAction } from './types'

const empty: CanvasState = { nodes: [], edges: [] }
const materialSpec = {
  prompt: 'Balance both sides.',
  pieces: [{ id: 'p1', label: 'H2', traits: { h: 2, o: 0 } }],
  groups: [{ id: 'g1', label: 'Left pan', ordered: false }],
  slots: [{ id: 's1', groupId: 'g1', x: 0, y: 0, capacity: 1 }],
  rules: [{ op: 'derive' as const, name: 'leftH', expr: 'sum_h_g1' }],
  goal: { kind: 'exactSet' as const, itemIds: ['p1'] },
}

describe('build_material action', () => {
  it('accepts a valid material action', () => {
    expect(isValidAction({ type: 'build_material', id: 'mat1', spec: materialSpec })).toBe(true)
  })

  it('rejects a material whose spec is malformed', () => {
    expect(isValidAction({ type: 'build_material', id: 'mat1', spec: { prompt: 'x' } })).toBe(false)
    expect(isValidAction({ type: 'build_material', id: 'mat1' })).toBe(false)
  })

  it('creates a material node carrying materialSpec and materialState', () => {
    const out = applyActions(empty, [{ type: 'build_material', id: 'mat1', spec: materialSpec, step: 2 } as TutorAction])
    expect(out.nodes).toHaveLength(1)
    expect(out.nodes[0].type).toBe('material')
    expect(out.nodes[0].data.kind).toBe('material')
    expect(out.nodes[0].data.materialSpec).toEqual(materialSpec)
    expect(out.nodes[0].data.materialState).toEqual({
      placement: {},
      controls: {},
      attempts: 0,
      rejectedMoves: [],
      status: 'untouched',
    })
    expect(out.nodes[0].data.step).toBe(2)
    expect(out.created).toEqual(['mat1'])
  })

  it('drops an invalid material instead of corrupting the canvas', () => {
    const out = applyActions(empty, [
      { type: 'build_material', id: 'bad', spec: { prompt: 'x' } } as unknown as TutorAction,
    ])
    expect(out.nodes).toHaveLength(0)
  })

  it('does not create a duplicate id', () => {
    const once = applyActions(empty, [{ type: 'build_material', id: 'mat1', spec: materialSpec } as TutorAction])
    const twice = applyActions(
      { nodes: once.nodes, edges: once.edges },
      [{ type: 'build_material', id: 'mat1', spec: materialSpec } as TutorAction],
    )
    expect(twice.nodes).toHaveLength(1)
  })

  it('does not create a second material with the same prompt (a fresh id), and zooms to the existing one instead', () => {
    const once = applyActions(empty, [{ type: 'build_material', id: 'mat1', spec: materialSpec } as TutorAction])
    const twice = applyActions(
      { nodes: once.nodes, edges: once.edges },
      [{ type: 'build_material', id: 'mat2', spec: { ...materialSpec, prompt: '  Balance both sides.  ' } } as TutorAction],
    )
    expect(twice.nodes).toHaveLength(1)
    expect(twice.created).toEqual([])
    expect(twice.effects).toContainEqual({ kind: 'zoom', target: 'node', nodeId: 'mat1' })
  })

  it('records a dropped invalid action so the caller can surface it', () => {
    const out = applyActions(empty, [
      { type: 'build_material', id: 'bad1', spec: { prompt: 'x' } } as unknown as TutorAction,
    ])
    expect(out.dropped).toEqual(['build_material:bad1'])
  })
})
