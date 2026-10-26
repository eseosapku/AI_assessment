import { describe, expect, it } from 'vitest'
import { masteryNumber, sumAccuracies } from './mastery-numbers'

describe('adding mastery scores the database returned as text', () => {
  it('reads a decimal string as a number', () => {
    expect(masteryNumber('90.00')).toBe(90)
    expect(masteryNumber(null)).toBeNull()
    expect(masteryNumber('nope')).toBeNull()
  })

  // 0 + "90.00" + "85.00" used to be the string "090.0085.00", and that
  // average classified as a gap instead of 87.5 mastered.
  it('adds two scores instead of concatenating them', () => {
    expect(sumAccuracies(['90.00', '85.00'])).toBe(175)
    expect(Math.round((sumAccuracies(['90.00', '85.00']) / 2) * 100) / 100).toBe(87.5)
  })

  it('still adds real numbers', () => {
    expect(sumAccuracies([90, 85])).toBe(175)
  })
})
