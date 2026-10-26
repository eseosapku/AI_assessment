import { describe, it, expect } from 'vitest'
import { sequenceModule } from './sequence'
import type { SequencePayload } from '../types'
import { conditionsFor } from '../conditions'

const payload: SequencePayload = {
  items: [{ id: 'a', label: 'Prophase' }, { id: 'b', label: 'Metaphase' }, { id: 'c', label: 'Anaphase' }],
}
const success = { kind: 'exactOrder', itemIds: ['a', 'b', 'c'] } as const

describe('sequenceModule', () => {
  it('shuffles deterministically into initial work', () => {
    const w1 = sequenceModule.initialWork(payload, 7)
    const w2 = sequenceModule.initialWork(payload, 7)
    expect(w1).toEqual(w2)
    expect([...w1.order].sort()).toEqual(['a', 'b', 'c'])
  })
  it('passes on the correct order', () => {
    expect(sequenceModule.validate(payload, { order: ['a', 'b', 'c'] }, success).ok).toBe(true)
  })
  it('fails and reports misplaced items', () => {
    const r = sequenceModule.validate(payload, { order: ['b', 'a', 'c'] }, success)
    expect(r.ok).toBe(false)
    expect(r.wrongIds).toEqual(['b', 'a'])
  })
  it('validates payload shape', () => {
    expect(sequenceModule.isPayload(payload)).toBe(true)
    expect(sequenceModule.isPayload({ items: [] })).toBe(false)
  })
  it('rejects duplicate item ids (would collide in `order`)', () => {
    const dupe = { items: [{ id: 'a', label: 'Prophase' }, { id: 'a', label: 'Metaphase' }] }
    expect(sequenceModule.isPayload(dupe)).toBe(false)
  })
  it('never starts in the solved order', () => {
    const solved = payload.items.map((i) => i.id)
    for (let seed = 1; seed <= 50; seed++) {
      const { order } = sequenceModule.initialWork(payload, seed)
      expect(order).not.toEqual(solved)
      expect([...order].sort()).toEqual([...solved].sort())
    }
  })
  it('leaves a single-item sequence alone', () => {
    const one = { items: [{ id: 'only', label: 'Only' }] }
    expect(sequenceModule.initialWork(one as never, 3).order).toEqual(['only'])
  })
  it('refuses rules that are not true of the right order, name an item it lacks, or say nothing', () => {
    const rule = (before: string, after: string, text = 'A rule') => ({ ...payload, rules: [{ text, before, after }] })
    expect(sequenceModule.isPayload(rule('a', 'c'))).toBe(true)
    expect(sequenceModule.isPayload(rule('c', 'a'))).toBe(false)
    expect(sequenceModule.isPayload(rule('a', 'z'))).toBe(false)
    expect(sequenceModule.isPayload(rule('a', 'a'))).toBe(false)
    expect(sequenceModule.isPayload(rule('a', 'c', ' '))).toBe(false)
    const five = { ...payload, rules: Array.from({ length: 5 }, () => ({ text: 'A rule', before: 'a', after: 'b' })) }
    expect(sequenceModule.isPayload(five)).toBe(false)
  })
})

describe('a sequence ticks its rules', () => {
  const ruled: SequencePayload = {
    ...payload,
    rules: [
      { text: 'Prophase comes before anaphase', before: 'a', after: 'c' },
      { text: 'Metaphase comes before anaphase', before: 'b', after: 'c' },
    ],
  }
  const met = (order: string[]) => conditionsFor('sequence', ruled, { order }).map((c) => c.met)

  it('ticks each rule only while it holds in the arrangement', () => {
    expect(met(['c', 'a', 'b'])).toEqual([false, false])
    expect(met(['a', 'c', 'b'])).toEqual([true, false])
    expect(met(['a', 'b', 'c'])).toEqual([true, true])
    expect(conditionsFor('sequence', ruled, { order: ['a', 'b', 'c'] })[0].text).toBe('Prophase before Anaphase')
  })

  it('words each rule as the one pair it checks, whatever its writer said', () => {
    // A real heart lesson ticked "Each chamber relaxes after it contracts" for the atria
    // alone, with the ventricles still out of order.
    const broad: SequencePayload = { ...payload, rules: [{ text: 'Each phase follows the one before it', before: 'a', after: 'c' }] }
    expect(conditionsFor('sequence', broad, { order: ['c', 'a', 'b'] })).toEqual([{ text: 'Prophase before Anaphase', met: false }])
  })

  it('leaves a rule unticked while one of its items is not placed', () => {
    expect(met(['a'])).toEqual([false, false])
  })

  it('shows no rules for a sequence written without them', () => {
    expect(conditionsFor('sequence', payload, { order: ['a', 'b', 'c'] })).toEqual([])
  })
})
