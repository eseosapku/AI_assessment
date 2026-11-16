import { describe, it, expect } from 'vitest'
import './index'
import { sceneCatalogue, scenesFor } from './registry'

const offered = (id: string, station: string) => sceneCatalogue(station).includes(`SCENE "${id}"`)
const madeFor = (id: string, station: string) => scenesFor(station).some((e) => e.id === id)

describe('a phrase that rules a scene out', () => {
  it.each([
    ['bar-model', 'Partial fractions'],
    ['bar-model', 'Simplifying algebraic fractions'],
    ['bar-model', 'Percentage yield'],
    ['waves', 'Heat waves'],
    ['waves', 'Ocean waves and coastal erosion'],
    ['timeline', 'Causes of the First World War'],
    ['timeline', 'Empires and trade'],
  ])('%s is not offered for %s', (id, station) => {
    expect(offered(id, station)).toBe(false)
    expect(madeFor(id, station)).toBe(false)
  })
  it.each([
    ['bar-model', 'Equivalent fractions'],
    ['bar-model', 'Percentages'],
    ['waves', 'Waves'],
    ['waves', 'Sound waves and hearing'],
    ['timeline', 'The Industrial Revolution'],
    ['timeline', 'The Roman Empire'],
    ['timeline', 'The ancient Greeks'],
  ])('%s is still made for %s', (id, station) => {
    expect(madeFor(id, station)).toBe(true)
  })
})

describe('a topic offered only as a phrase', () => {
  it.each([
    ['area-grid', 'Completing the square'],
    ['area-grid', 'Expanding double brackets'],
    ['area-grid', 'Expanding brackets with the grid method'],
    ['motion', 'Distance-time graphs'],
    ['motion', 'Speed, distance and time'],
    ['motion', 'Speed and velocity'],
    ['calculus-grapher', 'The gradient of a curve'],
    ['calculus-grapher', 'Area under a curve'],
    ['calculus-grapher', 'Stationary points'],
  ])('%s is offered on "%s", and is made for it', (id, station) => {
    expect(offered(id, station)).toBe(true)
    expect(madeFor(id, station)).toBe(true)
  })

  it.each([
    ['area-grid', 'Square numbers and square roots'],
    ['area-grid', 'Double bonds in alkenes'],
    ['area-grid', 'The scientific method'],
    ['area-grid', 'Coordinate grids'],
    ['motion', 'Telling the time'],
    ['motion', 'Speed of reaction'],
    ['motion', 'Line graphs'],
    ['calculus-grapher', 'Gradient of a straight line'],
    ['calculus-grapher', 'Area of a circle'],
    ['calculus-grapher', 'Stationary waves'],
    ['calculus-grapher', 'Tangents to a circle'],
    ['rates-equilibrium', 'Reaction time and reflexes'],
    ['rates-equilibrium', 'Action and reaction forces'],
    ['rates-equilibrium', 'Market equilibrium'],
    ['rates-equilibrium', 'Reversible changes in the kitchen'],
  ])('%s is not offered on "%s"', (id, station) => {
    expect(offered(id, station)).toBe(false)
    expect(madeFor(id, station)).toBe(false)
  })

  it('a phrase needs its words side by side, not just somewhere in the station', () => {
    expect(offered('area-grid', 'Which method fits: a box of data')).toBe(false)
  })
})

describe('a word the catalogue would ignore', () => {
  it('"differentiation" is an idea, though "different" is not', () => {
    expect(offered('calculus-grapher', 'Differentiation of polynomials')).toBe(true)
    expect(offered('calculus-grapher', 'Differentiating polynomials')).toBe(true)
    expect(offered('calculus-grapher', 'Different kinds of rock')).toBe(false)
  })
})
