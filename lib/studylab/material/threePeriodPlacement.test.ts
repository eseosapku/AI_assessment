import { describe, it, expect } from 'vitest'
import { answersToPlacement, placementToAnswers } from './threePeriodPlacement'

const items = [
  { id: 'sun', label: 'Sun' },
  { id: 'moon', label: 'Moon' },
]

describe('threePeriodPlacement', () => {
  it('round-trips answers through s-answer-* slots', () => {
    const answers = { sun: 'Sun', moon: 'Moon' }
    const placement = answersToPlacement(answers, items)
    expect(placement).toEqual({
      sun: 's-answer-sun',
      moon: 's-answer-moon',
    })
    expect(placementToAnswers(placement, items)).toEqual(answers)
  })

  it('maps wrong pairing', () => {
    expect(answersToPlacement({ sun: 'Moon' }, items)).toEqual({
      sun: 's-answer-moon',
    })
  })

  it('skips unknown labels and non-answer slots', () => {
    expect(answersToPlacement({ sun: 'Nope' }, items)).toEqual({})
    expect(
      placementToAnswers({ sun: 's-answer-sun', x: 'pool', y: 's-warm' }, items),
    ).toEqual({ sun: 'Sun' })
  })

  it('maps empty', () => {
    expect(answersToPlacement({}, items)).toEqual({})
    expect(placementToAnswers({}, items)).toEqual({})
  })
})
