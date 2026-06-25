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
