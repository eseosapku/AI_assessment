// lib/studylab/point.test.ts
import { describe, it, expect } from 'vitest'
import { isValidPart, pointSelector, pointerTakesCamera } from './point'

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

describe('pointSelector and control characters (M9)', () => {
  it('escapes a newline in a card id rather than writing a selector that throws', () => {
    expect(pointSelector('a\nb')).toBe('.react-flow__node[data-id="a\\a b"]')
  })
})

describe('the parts of the new question formats', () => {
  it('names a blank, a slot and a region of a diagram', () => {
    for (const part of ['blank-1', 'blank-12', 'slot-3', 'region-nucleus', 'region-optic-nerve']) expect(isValidPart(part), part).toBe(true)
    for (const part of ['blank-', 'region-', 'region-Nucleus Bad', 'region-a"b']) expect(isValidPart(part), part).toBe(false)
  })
})

// The owner's Sonder lesson, 2026-11-16: a turn built a new card and pointed at
// the sort before it. The camera set off for the new card, Kana's pointer sent
// it to the sort 150 ms later, it settled between them and "Back to my card"
// came up although the learner had not moved the board.
describe('pointerTakesCamera', () => {
  const base = { pointerMoved: true, focusMoved: false, pointNode: 'sort', focusId: 'card', placed: true, away: false }
  it('goes to a card pointed at in a turn that kept the learner where they were', () => expect(pointerTakesCamera(base)).toBe(true))
  it('stays on a new card the same turn built, and lets the pointed one glow', () => expect(pointerTakesCamera({ ...base, focusMoved: true })).toBe(false))
  it('does not fly back to an old pointer when the learner moves along the queue', () => expect(pointerTakesCamera({ ...base, pointerMoved: false, focusMoved: true })).toBe(false))
  it('has nowhere to go for the card already in focus, one not placed, or while looking back', () => {
    expect(pointerTakesCamera({ ...base, pointNode: 'card' })).toBe(false)
    expect(pointerTakesCamera({ ...base, placed: false })).toBe(false)
    expect(pointerTakesCamera({ ...base, away: true })).toBe(false)
    expect(pointerTakesCamera({ ...base, pointNode: null })).toBe(false)
  })
})
