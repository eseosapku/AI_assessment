import { describe, it, expect } from 'vitest'
import { labelAssignToPlacement, placementToLabelAssign } from './labelPlacement'

describe('labelPlacement', () => {
  it('flips hotspot→label assign into label→slot placement', () => {
    expect(
      labelAssignToPlacement({ nucleus: 'Nucleus', membrane: 'Membrane' }),
    ).toEqual({ Nucleus: 's-nucleus', Membrane: 's-membrane' })
  })

  it('flips placement back to hotspot→label assign', () => {
    expect(
      placementToLabelAssign({ Nucleus: 's-nucleus', Membrane: 's-membrane' }),
    ).toEqual({ nucleus: 'Nucleus', membrane: 'Membrane' })
  })

  it('round-trips', () => {
    const assign = { nucleus: 'Nucleus', membrane: 'Membrane' }
    expect(placementToLabelAssign(labelAssignToPlacement(assign))).toEqual(assign)
  })

  it('drops non-s-* slots and empty labels', () => {
    expect(
      placementToLabelAssign({ Nucleus: 's-nucleus', X: 'pool', Y: 'nucleus' }),
    ).toEqual({ nucleus: 'Nucleus' })
    expect(labelAssignToPlacement({ nucleus: '', membrane: 'Membrane' })).toEqual({
      Membrane: 's-membrane',
    })
  })
})
