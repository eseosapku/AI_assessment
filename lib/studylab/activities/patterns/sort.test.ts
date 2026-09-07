import { describe, it, expect } from 'vitest'
import { sortModule } from './sort'
import type { SortPayload } from '../types'

const payload: SortPayload = {
  bins: [{ id: 'acid', label: 'Acid' }, { id: 'base', label: 'Base' }],
  items: [
    { id: 'hcl', label: 'HCl', binId: 'acid' },
    { id: 'naoh', label: 'NaOH', binId: 'base' },
  ],
}
const success = { kind: 'binAssignment', assign: { hcl: 'acid', naoh: 'base' } } as const

describe('sortModule', () => {
  it('starts with nothing assigned', () => {
    expect(sortModule.initialWork(payload)).toEqual({ assign: {} })
  })

  it('passes when every item is in its correct bin', () => {
    const work = { assign: { hcl: 'acid', naoh: 'base' } }
    expect(sortModule.validate(payload, work, success)).toEqual({ ok: true, wrongIds: [] })
  })

  it('fails and names the misplaced item', () => {
    const work = { assign: { hcl: 'base', naoh: 'base' } }
    const r = sortModule.validate(payload, work, success)
    expect(r.ok).toBe(false)
    expect(r.wrongIds).toEqual(['hcl'])
  })

  it('fails while items remain unplaced', () => {
    expect(sortModule.validate(payload, { assign: { hcl: 'acid' } }, success).ok).toBe(false)
  })

  it('accepts only moves into a declared bin (control of error)', () => {
    expect(sortModule.accepts!(payload, { assign: {} }, { itemId: 'hcl', targetId: 'acid' })).toBe(true)
    expect(sortModule.accepts!(payload, { assign: {} }, { itemId: 'hcl', targetId: 'nope' })).toBe(false)
    expect(sortModule.accepts!(payload, { assign: {} }, { itemId: 'ghost', targetId: 'acid' })).toBe(false)
  })

  it('recognises a well-formed payload and rejects junk', () => {
    expect(sortModule.isPayload(payload)).toBe(true)
    expect(sortModule.isPayload({ bins: [], items: [] })).toBe(false)
    expect(sortModule.isPayload({ items: payload.items })).toBe(false)
    expect(sortModule.isPayload(null)).toBe(false)
  })

  it('rejects duplicate item ids (would collide in `assign`)', () => {
    const dupe: SortPayload = {
      bins: payload.bins,
      items: [
        { id: 'hcl', label: 'HCl', binId: 'acid' },
        { id: 'hcl', label: 'HCl again', binId: 'acid' },
      ],
    }
    expect(sortModule.isPayload(dupe)).toBe(false)
  })

  it('rejects an item whose binId matches no declared bin (unsolvable — no bin would ever accept it)', () => {
    const orphan: SortPayload = {
      bins: payload.bins,
      items: [
        { id: 'hcl', label: 'HCl', binId: 'acid' },
        { id: 'naoh', label: 'NaOH', binId: 'nonexistent' },
      ],
    }
    expect(sortModule.isPayload(orphan)).toBe(false)
  })
})
