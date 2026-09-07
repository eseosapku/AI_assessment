import { describe, it, expect } from 'vitest'
import { applyActions, isValidAction } from './actions'
import type { CanvasState, TutorAction } from './types'

const empty: CanvasState = { nodes: [], edges: [] }
const spec = {
  pattern: 'sort' as const,
  prompt: 'Sort these.',
  payload: {
    bins: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
    items: [{ id: 'i1', label: 'One', binId: 'a' }],
  },
  success: { kind: 'binAssignment' as const, assign: { i1: 'a' } },
}

describe('createActivity action', () => {
  it('accepts a valid activity action', () => {
    expect(isValidAction({ type: 'createActivity', id: 'act1', spec })).toBe(true)
  })

  it('rejects an activity whose spec is malformed', () => {
    expect(isValidAction({ type: 'createActivity', id: 'act1', spec: { pattern: 'nope' } })).toBe(false)
    expect(isValidAction({ type: 'createActivity', id: 'act1' })).toBe(false)
  })

  it('creates an activity node carrying the spec', () => {
    const out = applyActions(empty, [{ type: 'createActivity', id: 'act1', spec, step: 2 } as TutorAction])
    expect(out.nodes).toHaveLength(1)
    expect(out.nodes[0].type).toBe('activity')
    expect(out.nodes[0].data.kind).toBe('activity')
    expect(out.nodes[0].data.spec).toEqual(spec)
    expect(out.nodes[0].data.step).toBe(2)
    expect(out.created).toEqual(['act1'])
  })

  it('drops an invalid activity instead of corrupting the canvas', () => {
    const out = applyActions(empty, [
      { type: 'createActivity', id: 'bad', spec: { pattern: 'nope' } } as unknown as TutorAction,
    ])
    expect(out.nodes).toHaveLength(0)
  })

  it('does not create a duplicate id', () => {
    const once = applyActions(empty, [{ type: 'createActivity', id: 'act1', spec } as TutorAction])
    const twice = applyActions(
      { nodes: once.nodes, edges: once.edges },
      [{ type: 'createActivity', id: 'act1', spec } as TutorAction],
    )
    expect(twice.nodes).toHaveLength(1)
  })

  it('does not create a second activity with the same prompt (a fresh id), and zooms to the existing one instead', () => {
    const once = applyActions(empty, [{ type: 'createActivity', id: 'act1', spec } as TutorAction])
    const twice = applyActions(
      { nodes: once.nodes, edges: once.edges },
      [{ type: 'createActivity', id: 'act2', spec: { ...spec, prompt: '  Sort these.  ' } } as TutorAction],
    )
    expect(twice.nodes).toHaveLength(1)
    expect(twice.created).toEqual([])
    expect(twice.effects).toContainEqual({ kind: 'zoom', target: 'node', nodeId: 'act1' })
  })

  it('records a dropped invalid action so the caller can surface it', () => {
    const out = applyActions(empty, [
      { type: 'createActivity', id: 'bad1', spec: { pattern: 'nope' } } as unknown as TutorAction,
    ])
    expect(out.dropped).toEqual(['createActivity:bad1'])
  })
})
