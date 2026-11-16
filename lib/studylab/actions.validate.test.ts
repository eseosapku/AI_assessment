import { describe, it, expect } from 'vitest'
import { isValidAction } from '@/lib/studylab/actions'

describe('isValidAction createCard', () => {
  it('accepts AI card kinds', () => {
    expect(isValidAction({ type: 'createCard', id: 'x', card: 'concept' })).toBe(true)
  })

  it('rejects freeform block types as createCard cards', () => {
    expect(isValidAction({ type: 'createCard', id: 'x', card: 'sticky' })).toBe(false)
    expect(isValidAction({ type: 'createCard', id: 'x', card: 'scratchpad' })).toBe(false)
  })

  it('rejects unknown card kinds', () => {
    expect(isValidAction({ type: 'createCard', id: 'x', card: 'nonsense' })).toBe(false)
  })
})

describe('isValidAction point', () => {
  it('accepts a card, or a named part of one', () => {
    expect(isValidAction({ type: 'point', nodeId: 'n1' })).toBe(true)
    expect(isValidAction({ type: 'point', nodeId: 'n1', part: 'option-2' })).toBe(true)
  })
  it('refuses a point with no card, or a part that is not a part', () => {
    expect(isValidAction({ type: 'point' })).toBe(false)
    expect(isValidAction({ type: 'point', nodeId: 'n1', part: 'x"] *' })).toBe(false)
  })
})
