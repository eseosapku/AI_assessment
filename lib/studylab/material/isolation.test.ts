// lib/studylab/material/isolation.test.ts
import { describe, it, expect } from 'vitest'
import { varyingTraits, checkIsolation } from './isolation'
import type { MaterialSpec } from './types'

const of = (pieces: { id: string; label: string; traits: Record<string, number | string> }[]) =>
  ({ prompt: 'p', pieces, groups: [], slots: [], rules: [],
     goal: { kind: 'exactSet' as const, itemIds: [] } }) as MaterialSpec

describe('varyingTraits', () => {
  it('names the one trait that differs', () => {
    expect(varyingTraits(of([
      { id: 'a', label: 'A', traits: { size: 1, colour: 'red' } },
      { id: 'b', label: 'B', traits: { size: 2, colour: 'red' } },
    ]))).toEqual(['size'])
  })

  it('names all of them when a material varies several at once', () => {
    expect(varyingTraits(of([
      { id: 'a', label: 'A', traits: { size: 1, colour: 'red', shape: 'cube' } },
      { id: 'b', label: 'B', traits: { size: 2, colour: 'blue', shape: 'ball' } },
    ])).sort()).toEqual(['colour', 'shape', 'size'])
  })

  it('says a material where every piece is identical varies nothing', () => {
    expect(varyingTraits(of([
      { id: 'a', label: 'A', traits: { size: 1 } },
      { id: 'b', label: 'B', traits: { size: 1 } },
    ]))).toEqual([])
  })

  it('treats a trait missing from some pieces as varying', () => {
    expect(varyingTraits(of([
      { id: 'a', label: 'A', traits: { size: 1 } },
      { id: 'b', label: 'B', traits: {} },
    ]))).toEqual(['size'])
  })

  it('does not read a trait named after an Object.prototype member up the chain', () => {
    // `'toString' in {}` is true for every plain object — a piece whose own
    // traits omit it must still be treated as MISSING that trait, not as
    // silently inheriting Object.prototype.toString's value. Trait names
    // come from model output, so this must not be reachable.
    expect(varyingTraits(of([
      { id: 'a', label: 'A', traits: { toString: 'x' } },
      { id: 'b', label: 'B', traits: {} },
    ]))).toEqual(['toString'])
  })
})

describe('checkIsolation', () => {
  const twoTraits = of([
    { id: 'a', label: 'A', traits: { size: 1, colour: 'red' } },
    { id: 'b', label: 'B', traits: { size: 2, colour: 'blue' } },
  ])

  it('passes a material varying exactly what it is allowed to', () => {
    expect(checkIsolation(twoTraits, 2)).toEqual({ ok: true })
  })

  it('refuses one varying more than its apparatus allows, and names them', () => {
    const r = checkIsolation(twoTraits, 1)
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.reason).toContain('size')
    expect(r.ok === false && r.reason).toContain('colour')
  })

  it('refuses a material that varies nothing at all', () => {
    // Nothing to notice means nothing to learn — the same fault as a sorting
    // frame whose items all land in one bin.
    const r = checkIsolation(of([
      { id: 'a', label: 'A', traits: { size: 1 } },
      { id: 'b', label: 'B', traits: { size: 1 } },
    ]), 1)
    expect(r.ok).toBe(false)
  })
})
