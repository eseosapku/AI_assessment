// lib/studylab/material/interpreter.test.ts
import { describe, it, expect } from 'vitest'
import { tick, allowsMove, applyMove, hasCycle } from './interpreter'
import type { MaterialSpec, MaterialState } from './types'

/** A balance that weighs a chemical equation — the spec's own worked example. */
const balance = {
  prompt: 'Balance both sides.',
  pieces: [
    { id: 'h2', label: 'H₂', traits: { h: 2, o: 0, kind: 'reactant' } },
    { id: 'o2', label: 'O₂', traits: { h: 0, o: 2, kind: 'reactant' } },
    { id: 'w', label: 'H₂O', traits: { h: 2, o: 1, kind: 'product' } },
    // A second reactant, distinct from `w`, so the capacity test below can
    // refuse a move for capacity alone rather than for `allow` also being
    // satisfied. `w` is a product and the `allow` rules already forbid
    // products on the left, so using it for that case would pass even with
    // no capacity logic at all.
    { id: 'h2b', label: 'H₂', traits: { h: 2, o: 0, kind: 'reactant' } },
  ],
  groups: [
    { id: 'left', label: 'Left', ordered: false },
    { id: 'right', label: 'Right', ordered: false },
  ],
  slots: [
    { id: 'l1', groupId: 'left', x: 0, y: 0, capacity: 2 },
    { id: 'r1', groupId: 'right', x: 0, y: 0, capacity: 2 },
  ],
  displays: [{ id: 'beam', kind: 'beam' as const, min: -10, max: 10 }],
  rules: [
    { op: 'derive' as const, name: 'diff', expr: '(sum_h_left + sum_o_left) - (sum_h_right + sum_o_right)' },
    { op: 'bind' as const, target: 'beam', expr: 'diff' },
    { op: 'when' as const, predicate: { cmp: '==' as const, left: 'diff', right: '0' }, then: [{ say: 'Both sides weigh the same.' }] },
    { op: 'allow' as const, selector: { trait: 'kind', equals: 'reactant' }, groupId: 'left' },
    { op: 'allow' as const, selector: { trait: 'kind', equals: 'product' }, groupId: 'right' },
  ],
  goal: { kind: 'numericWithin' as const, target: 0, tolerance: 0 },
} as MaterialSpec

const st = (placement: Record<string, string>): MaterialState => ({
  placement, controls: {}, attempts: 0, rejectedMoves: [], status: 'in_progress',
})

describe('tick', () => {
  it('derives a value from the board and binds a display to it', () => {
    const r = tick(balance, st({ h2: 'l1', w: 'r1' }))
    expect(r.scope.diff).toBe(2 - 3)          // (2+0) - (2+1)
    expect(r.displays.beam).toBe(-1)
  })

  it('fires a when-rule only while its predicate holds', () => {
    expect(tick(balance, st({ h2: 'l1', o2: 'l1' })).says).toEqual([])
    // 4 on the left against nothing is not equal; place nothing on the right.
    const balanced = tick(balance, st({}))     // 0 - 0 === 0
    expect(balanced.says).toEqual(['Both sides weigh the same.'])
  })

  it('reports solved through the existing success algebra', () => {
    expect(tick(balance, st({})).solved).toBe(true)
    expect(tick(balance, st({ h2: 'l1' })).solved).toBe(false)
  })

  it('reads an expression naming nothing as a failed evaluation, not zero', () => {
    const bad = { ...balance, rules: [{ op: 'derive' as const, name: 'x', expr: 'sum_mass_left' }] } as MaterialSpec
    expect(tick(bad, st({})).scope.x).toBeUndefined()
  })

  it('reports a pairing goal unsolved rather than accidentally succeeding', () => {
    // No `pairs` conversion exists yet (see buildSuccessInput) — a `pairing`
    // goal must fail closed through evaluateSuccess's own length check, not
    // pass open because nothing was supplied. Every piece is placed, so this
    // exercises evaluateSuccess itself rather than the unplaced-pieces guard.
    const paired = {
      ...balance,
      goal: { kind: 'pairing' as const, pairs: [['h2', 'o2'] as [string, string]] },
    } as MaterialSpec
    const full = st({ h2: 'l1', o2: 'l1', w: 'r1', h2b: 'r1' })
    expect(tick(paired, full).solved).toBe(false)
  })
})

describe('allowsMove — control of error at the moment of action', () => {
  it('permits a piece whose trait matches the group it is offered to', () => {
    expect(allowsMove(balance, st({}), { pieceId: 'h2', slotId: 'l1' })).toBe(true)
  })

  it('refuses a product onto the reactant side', () => {
    expect(allowsMove(balance, st({}), { pieceId: 'w', slotId: 'l1' })).toBe(false)
  })

  it('refuses a move into a slot already at capacity', () => {
    // h2b is a reactant — `allow` permits it on the left — so this can only
    // fail for capacity. l1's capacity is 2 and is already full.
    const full = st({ h2: 'l1', o2: 'l1' })
    expect(allowsMove(balance, full, { pieceId: 'h2b', slotId: 'l1' })).toBe(false)
  })

  it('permits anything into a group with no allow rule naming it', () => {
    // A group nobody constrained is open. Silence is not a prohibition.
    const open = { ...balance, rules: balance.rules.filter((r) => r.op !== 'allow') } as MaterialSpec
    expect(allowsMove(open, st({}), { pieceId: 'w', slotId: 'l1' })).toBe(true)
  })
})

describe('applyMove', () => {
  it('records a refused move rather than discarding it', () => {
    // The piece springs back so the student self-corrects, but the attempt is
    // the clearest misconception signal available.
    const next = applyMove(balance, st({}), { pieceId: 'w', slotId: 'l1' })
    expect(next.placement.w).toBeUndefined()
    expect(next.rejectedMoves).toEqual([{ pieceId: 'w', slotId: 'l1' }])
  })

  it('places a legal move and counts the attempt', () => {
    const next = applyMove(balance, st({}), { pieceId: 'h2', slotId: 'l1' })
    expect(next.placement.h2).toBe('l1')
    expect(next.attempts).toBe(1)
  })
})

describe('hasCycle', () => {
  it('accepts rules that settle in one pass', () => {
    expect(hasCycle(balance)).toBe(false)
  })

  it('rejects a derive that reads its own output', () => {
    const looped = { ...balance, rules: [{ op: 'derive' as const, name: 'x', expr: 'x + 1' }] } as MaterialSpec
    expect(hasCycle(looped)).toBe(true)
  })

  it('rejects a pair of derives that read each other', () => {
    const pair = { ...balance, rules: [
      { op: 'derive' as const, name: 'x', expr: 'y + 1' },
      { op: 'derive' as const, name: 'y', expr: 'x + 1' },
    ] } as MaterialSpec
    expect(hasCycle(pair)).toBe(true)
  })
})
