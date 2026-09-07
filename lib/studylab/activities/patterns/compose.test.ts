// lib/studylab/activities/patterns/compose.test.ts
import { describe, it, expect } from 'vitest'
import { composeModule, joinCount, joinId } from './compose'
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
})
