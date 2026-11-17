import { describe, it, expect } from 'vitest'
import { conditionsFor, pairText } from '@/lib/studylab/activities/conditions'

const heart = {
  items: [
    { id: 'atria', label: 'Atria' },
    { id: 'ventricles', label: 'Ventricles' },
  ],
  rules: [{ before: 'atria', after: 'ventricles' }],
}

describe('ticks the learner can see', () => {
  it('a sequence rule is one pair, and it ticks only when that pair is in order', () => {
    expect(pairText('Atria', 'Ventricles')).toBe('Atria before Ventricles')
    const wrong = conditionsFor('sequence', heart, { order: ['ventricles', 'atria'] })
    expect(wrong).toEqual([{ text: 'Atria before Ventricles', met: false }])
    const right = conditionsFor('sequence', heart, { order: ['atria', 'ventricles'] })
    expect(right[0].met).toBe(true)
  })

  it('a missing item does not count as in order', () => {
    expect(conditionsFor('sequence', heart, { order: ['atria'] })[0].met).toBe(false)
  })

  it('two empty pans are not a balance', () => {
    const beam = { left: [], right: [], pool: [{ id: 'a', label: '1', weight: 1 }], mode: 'weights' }
    expect(conditionsFor('balance', beam, { left: [], right: [] })[0]).toEqual({ text: 'Both sides weigh the same', met: false })
    expect(conditionsFor('balance', beam, { left: ['a'], right: ['a'] })[0].met).toBe(true)
  })

  it('patterns without a constraint give no ticks', () => {
    expect(conditionsFor('sort', {}, {})).toEqual([])
  })
})
