// lib/studylab/material/sortPlacement.test.ts
import { describe, it, expect } from 'vitest'
import {
  assignToPlacement,
  binIdFromSlot,
  placementToAssign,
  slotIdForBin,
} from './sortPlacement'

describe('sortPlacement', () => {
  it('uses the s-${binId} convention', () => {
    expect(slotIdForBin('warm')).toBe('s-warm')
    expect(binIdFromSlot('s-warm')).toBe('warm')
    expect(binIdFromSlot('warm')).toBeNull()
    expect(binIdFromSlot('pool')).toBeNull()
  })

  it('round-trips assign through placement', () => {
    const assign = { a: 'warm', b: 'cool' }
    expect(placementToAssign(assignToPlacement(assign))).toEqual(assign)
  })

  it('drops placement entries that are not s-* slots', () => {
    expect(
      placementToAssign({
        a: 's-warm',
        b: 'pool',
        c: 'warm',
      }),
    ).toEqual({ a: 'warm' })
  })

  it('omits empty assign keys rather than writing empty strings', () => {
    expect(assignToPlacement({})).toEqual({})
    expect(placementToAssign({})).toEqual({})
  })
})
