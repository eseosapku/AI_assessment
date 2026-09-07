import { describe, it, expect } from 'vitest'
import { threePeriodModule } from './threePeriod'
import type { ThreePeriodPayload } from '../types'

const payload: ThreePeriodPayload = {
  items: [{ id: 'cu', label: 'Copper' }, { id: 'zn', label: 'Zinc' }],
  phases: ['present', 'identify', 'recall'],
}
const success = { kind: 'pairing', pairs: [['cu', 'Copper'], ['zn', 'Zinc']] } as const

describe('threePeriodModule', () => {
  it('starts at the first phase with no answers', () => {
    expect(threePeriodModule.initialWork(payload)).toEqual({ phase: 0, answers: {}, presentIdx: 0, identifyIdx: 0 })
  })
  it('passes when every item is named correctly', () => {
    const work = { phase: 2, answers: { cu: 'Copper', zn: 'Zinc' } }
    expect(threePeriodModule.validate(payload, work, success).ok).toBe(true)
  })
  it('fails and names the item got wrong', () => {
    const work = { phase: 2, answers: { cu: 'Zinc', zn: 'Zinc' } }
    const r = threePeriodModule.validate(payload, work, success)
    expect(r.ok).toBe(false)
    expect(r.wrongIds).toEqual(['cu'])
  })
  it('fails while answers are incomplete', () => {
    const r = threePeriodModule.validate(payload, { phase: 1, answers: { cu: 'Copper' } }, success)
    expect(r.ok).toBe(false)
    expect(r.wrongIds).toEqual([])
  })
  it('validates payload shape', () => {
    expect(threePeriodModule.isPayload(payload)).toBe(true)
    expect(threePeriodModule.isPayload({ items: [], phases: [] })).toBe(false)
  })
  it('rejects duplicate item ids (would collide in `answers`)', () => {
    const dupe = {
      items: [{ id: 'cu', label: 'Copper' }, { id: 'cu', label: 'Zinc' }],
      phases: ['present', 'identify', 'recall'],
    }
    expect(threePeriodModule.isPayload(dupe)).toBe(false)
  })
})
