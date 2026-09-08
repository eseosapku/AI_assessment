// lib/studylab/activities/patterns/balance.test.ts
import { describe, it, expect } from 'vitest'
import { balanceModule, sideTotal } from './balance'
import type { BalancePayload } from '../types'

const payload: BalancePayload = {
  left: [{ id: 'l1', label: 'H2', weight: 2 }],
  right: [],
  pool: [{ id: 'p1', label: 'H2O', weight: 1 }, { id: 'p2', label: 'O2', weight: 1 }],
  mode: 'equation',
}
const success = { kind: 'numericWithin', target: 0, tolerance: 0 } as const

describe('balanceModule', () => {
  it('starts with the authored sides', () => {
    expect(balanceModule.initialWork(payload)).toEqual({ left: ['l1'], right: [] })
  })
  it('sums a side by weight', () => {
    expect(sideTotal(payload, ['l1', 'p1'])).toBe(3)
    expect(sideTotal(payload, [])).toBe(0)
  })
  it('passes when both sides weigh the same', () => {
    // left 2 vs right p1+p2 = 2 -> difference 0
    expect(balanceModule.validate(payload, { left: ['l1'], right: ['p1', 'p2'] }, success).ok).toBe(true)
  })
  it('fails when the sides differ', () => {
    expect(balanceModule.validate(payload, { left: ['l1'], right: ['p1'] }, success).ok).toBe(false)
  })
  it('validates payload shape', () => {
    expect(balanceModule.isPayload(payload)).toBe(true)
    expect(balanceModule.isPayload({ left: [], right: [], pool: [], mode: 'x' })).toBe(false)
  })

  it('sums a side including a negative weight (e.g. a debit)', () => {
    const debits: BalancePayload = {
      left: [{ id: 'a', label: 'Income', weight: 100 }],
      right: [{ id: 'b', label: 'Rent', weight: -60 }, { id: 'c', label: 'Refund', weight: -40 }],
      pool: [],
      mode: 'weights',
    }
    expect(sideTotal(debits, ['b', 'c'])).toBe(-100)
    expect(sideTotal(debits, ['a'])).toBe(100)
    // Difference is 200, not 0 - confirms negative weights are summed, not dropped or absolute-valued.
    expect(balanceModule.validate(debits, { left: ['a'], right: ['b', 'c'] }, success).ok).toBe(false)
  })

  it('treats an unknown id in the work state as contributing 0, not NaN', () => {
    expect(sideTotal(payload, ['l1', 'ghost'])).toBe(2)
    const result = balanceModule.validate(payload, { left: ['l1', 'ghost'], right: ['p1', 'p2'] }, success)
    expect(result.ok).toBe(true)
    expect(Number.isNaN(sideTotal(payload, ['ghost']))).toBe(false)
  })

  it('accepts a group right at the 3-item cap (fills a pan without scrolling)', () => {
    const threeItems = [
      { id: 'a', label: 'One', weight: 1 },
      { id: 'b', label: 'Two', weight: 2 },
      { id: 'c', label: 'Three', weight: 3 },
    ]
    expect(balanceModule.isPayload({ left: threeItems, right: [], pool: [], mode: 'weights' })).toBe(true)
  })

  it('rejects a pan one item over the cap (a pan the student cannot see across without scrolling)', () => {
    const fourItems = [
      { id: 'a', label: 'One', weight: 1 },
      { id: 'b', label: 'Two', weight: 2 },
      { id: 'c', label: 'Three', weight: 3 },
      { id: 'd', label: 'Four', weight: 4 },
    ]
    expect(balanceModule.isPayload({ left: fourItems, right: [], pool: [], mode: 'weights' })).toBe(false)
    // The cap applies to right too, not only left - a student can drag items
    // onto either pan, so either group could end up rendered there unchanged.
    expect(balanceModule.isPayload({ left: [], right: fourItems, pool: [], mode: 'weights' })).toBe(false)
  })

  it('does not cap `pool` - it renders as an ordinary unbounded strip, not a pan', () => {
    // The most ordinary balance lesson there is: every item starts unsorted
    // in the pool, nothing pre-placed on either pan. `pool` has no `absolute`
    // positioning and no `max-height` to overflow (see BalanceActivity.tsx),
    // so a large pool is not the risk this cap exists for - capping it would
    // reject this common, well-formed lesson for a risk it doesn't carry.
    const fiveItems = [
      { id: 'a', label: 'One', weight: 1 },
      { id: 'b', label: 'Two', weight: 2 },
      { id: 'c', label: 'Three', weight: 3 },
      { id: 'd', label: 'Four', weight: 4 },
      { id: 'e', label: 'Five', weight: 5 },
    ]
    expect(balanceModule.isPayload({ left: [], right: [], pool: fiveItems, mode: 'weights' })).toBe(true)
  })
})
