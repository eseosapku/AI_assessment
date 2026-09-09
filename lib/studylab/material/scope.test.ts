// lib/studylab/material/scope.test.ts
import { describe, it, expect } from 'vitest'
import { buildScope, scopeNames, collidingNames } from './scope'
import type { MaterialSpec, MaterialState } from './types'

const spec = {
  prompt: 'p',
  pieces: [
    { id: 'a', label: 'H2', traits: { h: 2, o: 0 } },
    { id: 'b', label: 'O2', traits: { h: 0, o: 2 } },
  ],
  groups: [{ id: 'left', label: 'Left', ordered: false }, { id: 'pool', label: 'Pool', ordered: false }],
  slots: [
    { id: 's1', groupId: 'left', x: 0, y: 0, capacity: 1 },
    { id: 's2', groupId: 'left', x: 1, y: 0, capacity: 1 },
    { id: 's3', groupId: 'pool', x: 0, y: 0, capacity: 4 },
  ],
  controls: [
    { id: 'drops', label: 'Drops', min: 0, max: 50, step: 1 },
    // A non-zero min so "defaults to the minimum" is distinguishable from
    // "defaults to zero" — `drops` alone (min: 0) can't tell the two apart.
    { id: 'temp', label: 'Temp', min: 5, max: 100, step: 1 },
  ],
  rules: [],
  goal: { kind: 'exactSet' as const, itemIds: [] },
} as MaterialSpec

const state = (placement: Record<string, string>, controls: Record<string, number> = {}): MaterialState => ({
  placement, controls, attempts: 0, rejectedMoves: [], status: 'in_progress',
})

describe('buildScope', () => {
  it('sums a trait over the pieces in a group', () => {
    const s = buildScope(spec, state({ a: 's1', b: 's2' }))
    expect(s.sum_h_left).toBe(2)
    expect(s.sum_o_left).toBe(2)
  })

  it('counts the pieces in a group', () => {
    expect(buildScope(spec, state({ a: 's1' })).count_left).toBe(1)
    expect(buildScope(spec, state({})).count_left).toBe(0)
  })

  it('ignores pieces that are not placed', () => {
    const s = buildScope(spec, state({ a: 's3' }))   // a is in the pool
    expect(s.sum_h_left).toBe(0)
    expect(s.sum_h_pool).toBe(2)
  })

  it('excludes a piece whose placement names a slot that does not exist', () => {
    const s = buildScope(spec, state({ a: 'no-such-slot' }))
    expect(s.count_left).toBe(0)
    expect(s.count_pool).toBe(0)
    expect(s.sum_h_left).toBe(0)
    expect(s.sum_h_pool).toBe(0)
  })

  it('exposes each control by its id', () => {
    expect(buildScope(spec, state({}, { drops: 24 })).drops).toBe(24)
  })

  it('defaults a control the student has not touched to its minimum', () => {
    expect(buildScope(spec, state({})).drops).toBe(0)
  })

  it('defaults a control with a non-zero minimum to that minimum, not zero', () => {
    expect(buildScope(spec, state({})).temp).toBe(5)
  })

  it('lists every legal name, so an expression can be checked against it', () => {
    const names = scopeNames(spec)
    expect(names).toContain('sum_h_left')
    expect(names).toContain('count_pool')
    expect(names).toContain('drops')
    // A trait no piece carries is not a name, so naming it is a mistake worth
    // catching at validation rather than silently reading zero.
    expect(names).not.toContain('sum_mass_left')
  })
})

describe('collidingNames', () => {
  it('reports nothing for a clean spec', () => {
    expect(collidingNames(spec)).toEqual([])
  })

  it('reports a derive name that shadows an aggregate the board already generates', () => {
    const withCollision: MaterialSpec = {
      ...spec,
      rules: [{ op: 'derive', name: 'count_left', expr: '1' }],
    }
    expect(collidingNames(withCollision)).toEqual(['count_left'])
  })

  it('reports a derive name that shadows a control id', () => {
    const withCollision: MaterialSpec = {
      ...spec,
      rules: [{ op: 'derive', name: 'drops', expr: '1' }],
    }
    expect(collidingNames(withCollision)).toEqual(['drops'])
  })
})
