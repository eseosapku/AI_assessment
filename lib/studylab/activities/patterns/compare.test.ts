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
})
