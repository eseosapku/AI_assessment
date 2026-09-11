// lib/studylab/material/sequencePlacement.test.ts
import { describe, it, expect } from 'vitest'
import {
  indexFromSlot,
  orderToPlacement,
  placementToOrder,
  slotIdForIndex,
} from './sequencePlacement'

describe('sequencePlacement', () => {
  it('uses s-${index} slots', () => {
    expect(slotIdForIndex(0)).toBe('s-0')
    expect(slotIdForIndex(2)).toBe('s-2')
    expect(indexFromSlot('s-0')).toBe(0)
    expect(indexFromSlot('s-12')).toBe(12)
    expect(indexFromSlot('s-warm')).toBeNull()
    expect(indexFromSlot('pool')).toBeNull()
    expect(indexFromSlot('s-')).toBeNull()
  })

  it('round-trips a full order', () => {
    const order = ['a', 'b', 'c']
    expect(placementToOrder(orderToPlacement(order), 3)).toEqual(order)
  })

  it('skips empty slots when building order', () => {
    expect(
      placementToOrder({ a: 's-0', c: 's-2' }, 3),
    ).toEqual(['a', 'c'])
  })

  it('ignores non-index slot ids', () => {
    expect(
      placementToOrder({ a: 's-0', b: 'pool', c: 's-warm' }, 2),
    ).toEqual(['a'])
  })
})
