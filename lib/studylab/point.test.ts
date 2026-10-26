// lib/studylab/point.test.ts
import { describe, it, expect } from 'vitest'
import { isValidPart, pointSelector } from './point'

describe('isValidPart -- the parts a card names', () => {
  it('takes list items, worked steps, table cells, options, pieces and slots', () => {
    for (const part of ['item-1', 'step-3', 'r0c2', 'r12c3', 'option-4', 'piece-p_1', 'slot-s-2', 'piece-enzyme']) {
      expect(isValidPart(part), part).toBe(true)
    }
  })
  it('refuses anything else -- a part is pasted into a selector', () => {
    for (const part of ['', 'item-', 'item-x', 'r1', 'piece-', 'foo', 'item-1"]', '<b>', 'option-1 .x', 'slot-a b']) {
      expect(isValidPart(part), part).toBe(false)
    }
  })
})

describe('pointSelector', () => {
  it('finds the card on the board, then the part inside it', () => {
    expect(pointSelector('n1')).toBe('.react-flow__node[data-id="n1"]')
    expect(pointSelector('n1', 'r1c2')).toBe('.react-flow__node[data-id="n1"] [data-part="r1c2"]')
  })
  it('escapes the card id, and points at the whole card when the part is not one', () => {
    expect(pointSelector('a"b\\c')).toBe('.react-flow__node[data-id="a\\"b\\\\c"]')
    expect(pointSelector('n1', 'x"] *')).toBe('.react-flow__node[data-id="n1"]')
  })
})
