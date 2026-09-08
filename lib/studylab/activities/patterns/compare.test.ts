import { describe, it, expect } from 'vitest'
import { compareModule } from './compare'
import type { ComparePayload } from '../types'

const payload: ComparePayload = {
  sets: [{ id: 'left', label: 'Mitosis' }, { id: 'right', label: 'Meiosis' }],
  items: [
    { id: 'i1', label: 'Produces gametes', belongs: 'right' },
    { id: 'i2', label: 'Involves DNA replication', belongs: 'both' },
  ],
}
const success = { kind: 'binAssignment', assign: { i1: 'right', i2: 'both' } } as const

describe('compareModule', () => {
  it('starts empty', () => {
    expect(compareModule.initialWork(payload)).toEqual({ assign: {} })
  })
  it('passes when every item is in the right region', () => {
    expect(compareModule.validate(payload, { assign: { i1: 'right', i2: 'both' } }, success).ok).toBe(true)
  })
  it('fails and names the wrong item', () => {
    const r = compareModule.validate(payload, { assign: { i1: 'left', i2: 'both' } }, success)
    expect(r.ok).toBe(false)
    expect(r.wrongIds).toEqual(['i1'])
  })
  it('fails while incomplete', () => {
    expect(compareModule.validate(payload, { assign: { i1: 'right' } }, success).ok).toBe(false)
  })
  it('validates payload shape', () => {
    expect(compareModule.isPayload(payload)).toBe(true)
    expect(compareModule.isPayload({ sets: [], items: [] })).toBe(false)
  })
  it('rejects duplicate item ids (would collide in `assign`)', () => {
    const dupe: ComparePayload = {
      sets: payload.sets,
      items: [
        { id: 'i1', label: 'Produces gametes', belongs: 'right' },
        { id: 'i1', label: 'Involves DNA replication', belongs: 'both' },
      ],
    }
    expect(compareModule.isPayload(dupe)).toBe(false)
  })

  it('accepts a belongs bucket right at the 4-item cap (fills a zone without scrolling)', () => {
    const fourRight: ComparePayload = {
      sets: payload.sets,
      items: [
        { id: 'a', label: 'A', belongs: 'right' },
        { id: 'b', label: 'B', belongs: 'right' },
        { id: 'c', label: 'C', belongs: 'right' },
        { id: 'd', label: 'D', belongs: 'right' },
      ],
    }
    expect(compareModule.isPayload(fourRight)).toBe(true)
  })

  it('rejects a belongs bucket one item over the cap (a zone the student cannot see across without scrolling)', () => {
    const fiveRight: ComparePayload = {
      sets: payload.sets,
      items: [
        { id: 'a', label: 'A', belongs: 'right' },
        { id: 'b', label: 'B', belongs: 'right' },
        { id: 'c', label: 'C', belongs: 'right' },
        { id: 'd', label: 'D', belongs: 'right' },
        { id: 'e', label: 'E', belongs: 'right' },
      ],
    }
    expect(compareModule.isPayload(fiveRight)).toBe(false)
    // The cap applies per bucket, not to the total - four 'left' plus four
    // 'both' is fine even though nine items together would not fit in one zone.
    const eightAcrossTwoBuckets: ComparePayload = {
      sets: payload.sets,
      items: [
        { id: 'a', label: 'A', belongs: 'left' },
        { id: 'b', label: 'B', belongs: 'left' },
        { id: 'c', label: 'C', belongs: 'left' },
        { id: 'd', label: 'D', belongs: 'left' },
        { id: 'e', label: 'E', belongs: 'both' },
        { id: 'f', label: 'F', belongs: 'both' },
        { id: 'g', label: 'G', belongs: 'both' },
        { id: 'h', label: 'H', belongs: 'both' },
      ],
    }
    expect(compareModule.isPayload(eightAcrossTwoBuckets)).toBe(true)
  })
})
