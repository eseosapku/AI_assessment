import { describe, it, expect } from 'vitest'
import { sequenceModule } from './sequence'
import type { SequencePayload } from '../types'

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
})
