// app/api/studylab/tutor/dispatch.intent.test.ts
import { describe, it, expect } from 'vitest'
import { refuseUnjustifiedActivities } from './dispatch'

// Two items split across two bins: dimensionsOf refuses a sorting frame where
// every item lands in the same place, since there is no decision to make.
const spec = {
  pattern: 'sort',
  prompt: 'Sort the elements',
  payload: {
    bins: [{ id: 'b1', label: 'Metal' }, { id: 'b2', label: 'Non-metal' }],
    items: [
      { id: 'i1', label: 'Iron', binId: 'b1', imageUrl: 'iron' },
      { id: 'i2', label: 'Sulfur', binId: 'b2', imageUrl: 'sulfur' },
    ],
  },
  success: { kind: 'binAssignment', assign: { i1: 'b1', i2: 'b2' } },
}

const intent = {
  goal: 'Tell metals from non-metals.',
  isolates: 'category',
  apparatus: 'sorting-frame',
  why: 'Sorting makes the grouping decision the whole of the work.',
}

describe('refuseUnjustifiedActivities', () => {
  it('lets a justified material through', () => {
    const { kept, refused } = refuseUnjustifiedActivities([{ type: 'createActivity', id: 'a1', intent, spec }])
    expect(kept).toHaveLength(1)
    expect(refused).toEqual([])
  })

  it('refuses a material with no intent at all', () => {
    const { kept, refused } = refuseUnjustifiedActivities([{ type: 'createActivity', id: 'a1', spec }])
    expect(kept).toEqual([])
    expect(refused[0]).toMatch(/intent/i)
  })

  it('refuses a reason the material does not support', () => {
    const { kept, refused } = refuseUnjustifiedActivities([
      { type: 'createActivity', id: 'a1', intent: { ...intent, isolates: 'quantity' }, spec },
    ])
    expect(kept).toEqual([])
    expect(refused[0]).toContain('quantity')
  })

  it('refuses a structurally invalid spec before it reaches the intent check', () => {
    const { kept, refused } = refuseUnjustifiedActivities([
      { type: 'createActivity', id: 'a1', intent, spec: { pattern: 'sort' } },
    ])
    expect(kept).toEqual([])
    expect(refused[0]).toMatch(/spec/i)
  })

  it('refuses words where the catalogue holds pictures', () => {
    // Two items with different labels: dimensionsOf refuses a three-period
    // deck that names only one thing, since a single label is not identity.
    const wordy = {
      ...spec,
      pattern: 'threePeriod',
      payload: {
        items: [{ id: 'i1', label: 'Neuron' }, { id: 'i2', label: 'Photosynthesis' }],
        phases: ['present'],
      },
      success: { kind: 'exactSet', itemIds: ['i1', 'i2'] },
    }
    const { kept, refused } = refuseUnjustifiedActivities([
      { type: 'createActivity', id: 'a1', intent: { ...intent, isolates: 'identity' }, spec: wordy },
    ])
    expect(kept).toEqual([])
    expect(refused[0]).toContain('Neuron')
  })

  it('leaves every other action untouched', () => {
    const others = [{ type: 'createCard', card: 'concept', id: 'c1' }, { type: 'connect', source: 'a', target: 'b' }]
    expect(refuseUnjustifiedActivities(others).kept).toEqual(others)
  })

  it('strips the intent before the action reaches the board', () => {
    // The intent is why the material exists, not part of it. Leaving it on the
    // action would put it in the node's data and eventually on screen.
    const { kept } = refuseUnjustifiedActivities([{ type: 'createActivity', id: 'a1', intent, spec }])
    expect(kept[0]).not.toHaveProperty('intent')
  })
})
