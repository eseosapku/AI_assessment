import { describe, it, expect } from 'vitest'
import { placementToSides, sidesToPlacement } from './balancePlacement'

describe('balancePlacement', () => {
  it('round-trips pans (order-normalized)', () => {
    const work = { left: ['b', 'a'], right: ['c'] }
    const placement = sidesToPlacement(work)
    expect(placement).toEqual({ a: 's-left', b: 's-left', c: 's-right' })
    expect(placementToSides(placement)).toEqual({ left: ['a', 'b'], right: ['c'] })
  })

  it('ignores s-pool and non-pan slots when building work', () => {
    expect(
      placementToSides({ a: 's-left', b: 's-pool', c: 's-right', d: 'pool' }),
    ).toEqual({ left: ['a'], right: ['c'] })
  })

  it('leaves pool ids out of placement on hydrate', () => {
    expect(sidesToPlacement({ left: ['a'], right: [] })).toEqual({ a: 's-left' })
  })
})
