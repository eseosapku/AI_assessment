import { describe, it, expect } from 'vitest'
import { chosenToPlacement, placementToChosen } from './scenarioPlacement'

describe('scenarioPlacement', () => {
  it('round-trips a chosen id', () => {
    expect(chosenToPlacement('safe')).toEqual({ safe: 's-chosen' })
    expect(placementToChosen({ safe: 's-chosen' })).toBe('safe')
  })

  it('maps null / empty to empty placement', () => {
    expect(chosenToPlacement(null)).toEqual({})
    expect(chosenToPlacement('')).toEqual({})
    expect(placementToChosen({})).toBeNull()
  })

  it('ignores s-pool and non-chosen slots', () => {
    expect(
      placementToChosen({ safe: 's-pool', unsafe: 's-chosen', x: 'pool' }),
    ).toBe('unsafe')
  })

  it('picks lexicographically smallest if multiple on s-chosen', () => {
    expect(placementToChosen({ b: 's-chosen', a: 's-chosen' })).toBe('a')
  })
})
