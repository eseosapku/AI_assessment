// lib/studylab/activities/patterns/compose.test.ts
import { describe, it, expect } from 'vitest'
import { composeModule, isAlgebra, joinCount, joinId } from './compose'
import type { ComposePayload } from '../types'

const payload: ComposePayload = {
  parts: [
    { id: 'h1', label: 'H', slots: 1 },
    { id: 'h2', label: 'H', slots: 1 },
    { id: 'o1', label: 'O', slots: 2 },
  ],
  validJoins: [{ a: 'H', b: 'O' }],
  target: { label: 'Water', formula: 'H2O' },
}
const success = { kind: 'exactSet', itemIds: ['h1-o1', 'h2-o1'] } as const

describe('composeModule', () => {
  it('starts with no joins', () => {
    expect(composeModule.initialWork(payload)).toEqual({ joins: [] })
  })

  it('counts how many bonds a part already has', () => {
    expect(joinCount([['h1', 'o1']], 'o1')).toBe(1)
    expect(joinCount([['h1', 'o1'], ['h2', 'o1']], 'o1')).toBe(2)
    expect(joinCount([['h1', 'o1'], ['h2', 'o1']], 'h1')).toBe(1)
  })

  it('passes when the target structure is built', () => {
    const work = { joins: [['h1', 'o1'], ['h2', 'o1']] as [string, string][] }
    const result = composeModule.validate(payload, work, success)
    expect(result.ok).toBe(true)
    expect(result.wrongIds).toEqual([])
  })

  it('an empty board is unfinished, not wrong — it must not report the answer as wrongIds', () => {
    const work = { joins: [] as [string, string][] }
    const result = composeModule.validate(payload, work, success)
    expect(result.ok).toBe(false)
    expect(result.wrongIds).toEqual([])
  })

  it('fails when a required bond is missing', () => {
    const work = { joins: [['h1', 'o1']] as [string, string][] }
    const result = composeModule.validate(payload, work, success)
    expect(result.ok).toBe(false)
    expect(result.wrongIds).toEqual(['h2-o1'])
  })

  it('fails when an extra bond is present beyond the target', () => {
    // exactSet, not a subset relation: an extra correct-looking bond still fails.
    const work = { joins: [['h1', 'o1'], ['h2', 'o1'], ['h1', 'h2']] as [string, string][] }
    const result = composeModule.validate(payload, work, success)
    expect(result.ok).toBe(false)
    expect(result.wrongIds).toEqual(['h1-h2'])
  })

  it('join ids are order-independent (sorted-and-hyphenated)', () => {
    const work = { joins: [['o1', 'h1'], ['o1', 'h2']] as [string, string][] }
    expect(composeModule.validate(payload, work, success).ok).toBe(true)
  })

  it('normalises a join id independently of argument order', () => {
    expect(joinId('o1', 'h1')).toBe('h1-o1')
    expect(joinId('h1', 'o1')).toBe('h1-o1')
    // Lexicographic sort, not numeric — this is the behaviour `validate` relies on.
    expect(joinId('h2', 'h10')).toBe(joinId('h10', 'h2'))
  })

  it('accepts a legal join between part types listed in validJoins', () => {
    expect(composeModule.accepts!(payload, { joins: [] }, { itemId: 'h1', targetId: 'o1' })).toBe(true)
    // Order of the pair does not matter.
    expect(composeModule.accepts!(payload, { joins: [] }, { itemId: 'o1', targetId: 'h1' })).toBe(true)
  })

  it('refuses a self-bond (a part cannot bond to itself)', () => {
    expect(composeModule.accepts!(payload, { joins: [] }, { itemId: 'h1', targetId: 'h1' })).toBe(false)
  })

  it('refuses a join to an unknown part id', () => {
    expect(composeModule.accepts!(payload, { joins: [] }, { itemId: 'h1', targetId: 'ghost' })).toBe(false)
    expect(composeModule.accepts!(payload, { joins: [] }, { itemId: 'ghost', targetId: 'h1' })).toBe(false)
  })

  it('refuses a join between part types that cannot bond', () => {
    expect(composeModule.accepts!(payload, { joins: [] }, { itemId: 'h1', targetId: 'h2' })).toBe(false)
  })

  it('refuses a duplicate bond (the same pair already joined)', () => {
    const work = { joins: [['h1', 'o1']] as [string, string][] }
    expect(composeModule.accepts!(payload, work, { itemId: 'h1', targetId: 'o1' })).toBe(false)
    // Reversed order is still the same bond.
    expect(composeModule.accepts!(payload, work, { itemId: 'o1', targetId: 'h1' })).toBe(false)
  })

  it('refuses a join once a part has used all its slots', () => {
    const full = { joins: [['h1', 'o1'], ['h2', 'o1']] as [string, string][] }
    expect(composeModule.accepts!(payload, full, { itemId: 'h1', targetId: 'o1' })).toBe(false)
    // o1 has slots:2 and both are used; a third H (hypothetically) would still be refused.
    expect(joinCount(full.joins, 'o1')).toBe(2)
  })

  it('validates payload shape', () => {
    expect(composeModule.isPayload(payload)).toBe(true)
    expect(composeModule.isPayload({ parts: [], validJoins: [], target: {} })).toBe(false)
  })

  it('rejects duplicate part ids (would make join ids ambiguous)', () => {
    const dupe: ComposePayload = {
      parts: [
        { id: 'h1', label: 'H', slots: 1 },
        { id: 'h1', label: 'H', slots: 1 },
      ],
      validJoins: [{ a: 'H', b: 'H' }],
      target: { label: 'Weird' },
    }
    expect(composeModule.isPayload(dupe)).toBe(false)
  })

  it('rejects a part with non-positive or non-integer slots', () => {
    const zeroSlots: ComposePayload = {
      parts: [
        { id: 'h1', label: 'H', slots: 0 },
        { id: 'o1', label: 'O', slots: 2 },
      ],
      validJoins: [{ a: 'H', b: 'O' }],
      target: { label: 'Water' },
    }
    expect(composeModule.isPayload(zeroSlots)).toBe(false)
  })

  describe('composeModule.isPayload — joins that can never happen', () => {
    // `validJoins` pairs are resolved against part LABELS, not ids — see
    // `accepts` above, which matches `j.a`/`j.b` to `from.label`/`to.label`.
    // Nothing checked that a validJoins label actually names a part, so one
    // mistyped label meant no bond was ever legal — the student sat in front
    // of a material that could not be completed, with no feedback at all.
    it('refuses a validJoins entry naming a part label that does not exist', () => {
      expect(
        composeModule.isPayload({
          parts: [{ id: 'h1', label: 'H', slots: 1 }, { id: 'o1', label: 'O', slots: 2 }],
          validJoins: [{ a: 'H', b: 'Oxygen' }],
          target: { label: 'Water' },
        }),
      ).toBe(false)
    })

    it('accepts joins whose labels all resolve', () => {
      expect(
        composeModule.isPayload({
          parts: [{ id: 'h1', label: 'H', slots: 1 }, { id: 'o1', label: 'O', slots: 2 }],
          validJoins: [{ a: 'H', b: 'O' }],
          target: { label: 'Water' },
        }),
      ).toBe(true)
    })

    it('refuses a payload with no legal join at all', () => {
      expect(
        composeModule.isPayload({
          parts: [{ id: 'h1', label: 'H', slots: 1 }, { id: 'o1', label: 'O', slots: 2 }],
          validJoins: [],
          target: { label: 'Water' },
        }),
      ).toBe(false)
    })
  })
})

describe('a build a learner can actually finish', () => {
  const parts = [{ id: 'x1', label: 'x', slots: 2 }, { id: 'x2', label: 'x', slots: 2 }, { id: 'three1', label: '3', slots: 2 }, { id: 'three2', label: '3', slots: 2 }]
  const payload = { parts, validJoins: [{ a: 'x', b: '3' }, { a: 'x', b: 'x' }], target: { label: 'T' } }
  it('refuses a rule that joins a part to itself', () => {
    expect(composeModule.canBeMet!(payload, { kind: 'exactSet', itemIds: ['x1-x1'] })).toBe(false)
  })
  it('refuses a rule that names a pair no one may join', () => {
    expect(composeModule.canBeMet!(payload, { kind: 'exactSet', itemIds: ['three1-three2'] })).toBe(false)
  })
  it('refuses a rule that asks more of a part than its slots', () => {
    const tight = { ...payload, parts: parts.map((p) => ({ ...p, slots: 1 })) }
    expect(composeModule.canBeMet!(tight, { kind: 'exactSet', itemIds: ['three1-x1', 'three2-x1'] })).toBe(false)
  })
  it('passes the water molecule', () => {
    const water = { parts: [{ id: 'h1', label: 'H', slots: 1 }, { id: 'h2', label: 'H', slots: 1 }, { id: 'o1', label: 'O', slots: 2 }], validJoins: [{ a: 'H', b: 'O' }], target: { label: 'Water' } }
    expect(composeModule.canBeMet!(water, { kind: 'exactSet', itemIds: ['h1-o1', 'h2-o1'] })).toBe(true)
  })
  it('marks by what was built: parts with one name are interchangeable', () => {
    const rule = { kind: 'exactSet', itemIds: ['three1-x1', 'three2-x2'] } as const
    expect(composeModule.validate(payload, { joins: [['x1', 'three2'], ['x2', 'three1']] }, rule).ok).toBe(true)
    expect(composeModule.validate(payload, { joins: [['x1', 'x2'], ['x2', 'three1']] }, rule).ok).toBe(false)
  })
})

describe('algebra is not bonding', () => {
  const withLabels = (...labels: string[]) => ({ parts: labels.map((label, i) => ({ id: `p${i}`, label, slots: 2 })), validJoins: [{ a: labels[0], b: labels[1] }], target: { label: 'T' } })
  it('refuses terms and numbers, however they are written', () => {
    for (const labels of [['x', '3'], ['$x$', '$5$'], ['x^2', 'y'], ['$5x$', 'y'], ['x\u00b2', 'y'], ['2.5', 'y']]) expect(isAlgebra(withLabels(...labels))).toBe(true)
  })
  it('leaves atoms, ions and components alone', () => {
    for (const labels of [['H', 'O'], ['Na', 'Cl'], ['resistor', 'battery'], ['C', 'H'], ['Fe3+', 'O2-']]) expect(isAlgebra(withLabels(...labels))).toBe(false)
  })
})
