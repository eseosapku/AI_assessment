// lib/studylab/meaning/startState.test.ts
import { describe, it, expect } from 'vitest'
import { startStateFaults } from './startState'

/** Nothing is served already solved: a card a learner can only look at teaches nothing. */
const activity = (spec: Record<string, unknown>) => ({ type: 'createActivity', id: 'm1', spec })

const BALANCE = {
  pattern: 'balance', prompt: 'Balance the scale.', seed: 1,
  payload: { left: [{ id: 'l1', label: 'Box', weight: 5 }], right: [], pool: [{ id: 'p1', label: 'Bag', weight: 3 }, { id: 'p2', label: 'Tin', weight: 2 }], mode: 'weights' },
  success: { kind: 'numericWithin', target: 0, tolerance: 0 },
}
const SORT = {
  pattern: 'sort', prompt: 'Sort the elements.', seed: 7,
  payload: { bins: [{ id: 'b1', label: 'Metal' }, { id: 'b2', label: 'Non-metal' }], items: [{ id: 'i1', label: 'Iron', binId: 'b1' }, { id: 'i2', label: 'Sulfur', binId: 'b2' }] },
  success: { kind: 'binAssignment', assign: { i1: 'b1', i2: 'b2' } },
}

describe('startStateFaults', () => {
  it('refuses a balance that is balanced before anything is moved', () => {
    const preBalanced = { ...BALANCE, payload: { ...BALANCE.payload, right: [{ id: 'r1', label: 'Bag', weight: 3 }, { id: 'r2', label: 'Tin', weight: 2 }], pool: [{ id: 'p3', label: 'Jar', weight: 4 }] } }
    expect(startStateFaults(activity(preBalanced)).join(' ')).toMatch(/solved before anything is moved/)
  })

  it('refuses a material the solver finds solved in no moves', () => {
    const dialAtZero = {
      prompt: 'Set the dial.', pieces: [], groups: [], slots: [],
      controls: [{ id: 'dial', label: 'Dial', min: 0, max: 25, step: 1 }],
      rules: [{ op: 'bind', target: 'reading', expr: 'dial' }],
      goal: { kind: 'numericWithin', target: 0, tolerance: 0 },
    }
    expect(startStateFaults({ type: 'build_material', id: 'm2', spec: dialAtZero }).join(' ')).toMatch(/solved before anything is moved/)
    expect(startStateFaults({ type: 'build_material', id: 'm2', spec: { ...dialAtZero, goal: { kind: 'numericWithin', target: 13, tolerance: 0 } } })).toEqual([])
  })

  it('passes cards that start unsolved', () => {
    expect(startStateFaults(activity(BALANCE))).toEqual([])
    expect(startStateFaults(activity(SORT))).toEqual([])
  })

  it('has nothing to say about a card to read, or an action it cannot read', () => {
    expect(startStateFaults({ type: 'createCard', id: 'c1', card: 'concept' })).toEqual([])
    expect(startStateFaults(null)).toEqual([])
  })
})
