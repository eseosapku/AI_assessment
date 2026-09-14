import { describe, it, expect } from 'vitest'
import { joinsToPlacement, placementToJoins } from './composePlacement'

describe('composePlacement', () => {
  it('round-trips joins through bond-* on s-joined', () => {
    const joins: [string, string][] = [['h1', 'o1'], ['h2', 'o1']]
    const placement = joinsToPlacement(joins)
    expect(placement).toEqual({
      'bond-h1-o1': 's-joined',
      'bond-h2-o1': 's-joined',
    })
    expect(placementToJoins(placement)).toEqual([
      ['h1', 'o1'],
      ['h2', 'o1'],
    ])
  })

  it('normalises pair order via joinId', () => {
    expect(joinsToPlacement([['o1', 'h1']])).toEqual({ 'bond-h1-o1': 's-joined' })
  })

  it('ignores s-pool and malformed bond ids', () => {
    expect(
      placementToJoins({
        'bond-h1-o1': 's-joined',
        'bond-h2-o1': 's-pool',
        'bond-bad': 's-joined',
        x: 's-joined',
      }),
    ).toEqual([['h1', 'o1']])
  })

  it('maps empty joins to empty placement', () => {
    expect(joinsToPlacement([])).toEqual({})
    expect(placementToJoins({})).toEqual([])
  })
})
