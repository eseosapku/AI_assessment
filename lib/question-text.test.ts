import { describe, expect, it } from 'vitest'
import { stripAppendedOptions } from './question-text'

describe('options the model typed into the question text', () => {
  it('come off when they are a real A, B, C list at the end of the stem', () => {
    expect(stripAppendedOptions('What is 2 + 2? (A) 3 (B) 4 (C) 5 (D) 6')).toBe('What is 2 + 2?')
    expect(stripAppendedOptions('Which gas is produced? [A] oxygen [B] nitrogen [C] carbon dioxide')).toBe('Which gas is produced?')
  })

  it('leave a stem alone that only mentions a panel or part (a)', () => {
    // Shipped as "Look at the diagram. In panel": everything from the first "(a)" was cut.
    const panel = 'Look at the diagram. In panel (a), the phasor V is the diagonal of the rectangle with sides V_R and V_L. Which complex-number expression gives its magnitude?'
    expect(stripAppendedOptions(panel)).toBe(panel)
    const twoPanels = 'In panel (a) the force is 3 N and in panel (b) it is 5 N. Which force is larger?'
    expect(stripAppendedOptions(twoPanels)).toBe(twoPanels)
  })

  it('turns a LaTeX-wrapped question mark back into a plain one', () => {
    expect(stripAppendedOptions('What is x$?$')).toBe('What is x?')
  })
})
