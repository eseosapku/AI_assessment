// lib/slot-shape.test.ts
import { describe, it, expect } from 'vitest'
import { enforceSlotShape, type SlotSpec } from './slot-shape'

const mcq = () => ({ type: 'mcq', question: 'Draw a ring around the prime number.', options: ['4', '7', '9', '12'], correct_answer: 1 })
const tick = () => ({ type: 'interactive', kind: 'multi_select', question: 'Tick all the correct statements.', options: ['a', 'b', 'c', 'd', 'e'], correct_indices: [0, 2] })
const table = () => ({ type: 'interactive', kind: 'categorize', question: 'Complete the table.', categories: ['regular', 'not regular'], items: ['square', 'kite', 'rhombus'] })
const short = () => ({ type: 'longform', question: 'Name the gas.', short_answer: { accepted: ['oxygen'] } })
const written = () => ({ type: 'longform', question: 'Explain why.', marking_criteria: ['one', 'two'] })

describe('the blueprint outranks the model', () => {
  it('stamps the slot marks over whatever came back', () => {
    // An ESL paper printed as 42 awarded 86: a one-mark tick came back
    // claiming five.
    const slots: SlotSpec[] = [{ marks: 1, format: 'tick' }, { marks: 2, format: 'written' }]
    const qs = [{ ...tick(), marks: 5 }, { ...written(), marks: 6 }]
    const out = enforceSlotShape(qs, slots)
    expect(out.questions.map((q: any) => q.marks)).toEqual([1, 2])
    expect(out.wrong).toEqual([])
  })

  it('reports a ring-around slot that came back as a written answer', () => {
    const out = enforceSlotShape([written()], [{ marks: 1, format: 'select' }])
    expect(out.wrong).toEqual([{ index: 0, wanted: 'select', got: 'longform' }])
  })

  it('reports a tick slot with no options and a table slot with no columns', () => {
    const slots: SlotSpec[] = [{ marks: 1, format: 'tick' }, { marks: 2, format: 'table' }]
    const out = enforceSlotShape([{ type: 'interactive', kind: 'multi_select' }, { type: 'longform' }], slots)
    expect(out.wrong.map((w) => w.wanted)).toEqual(['tick', 'table'])
  })

  it('reports a short-answer slot with no key, which cannot be marked', () => {
    const out = enforceSlotShape([{ type: 'longform', question: 'Name the gas.' }], [{ marks: 1, format: 'short' }])
    expect(out.wrong.map((w) => w.wanted)).toEqual(['short'])
  })

  it('accepts every format when the shape is right', () => {
    const slots: SlotSpec[] = [
      { marks: 1, format: 'select' }, { marks: 1, format: 'tick' },
      { marks: 2, format: 'table' }, { marks: 1, format: 'short' },
      { marks: 2, format: 'written' },
    ]
    const out = enforceSlotShape([mcq(), tick(), table(), short(), written()], slots)
    expect(out.wrong).toEqual([])
    expect(out.questions.map((q: any) => q.marks)).toEqual([1, 1, 2, 1, 2])
  })

  it('leaves a batch with no slot plan completely alone', () => {
    const q = { type: 'longform', marks: 9 }
    const out = enforceSlotShape([q], undefined)
    expect(out.questions[0].marks).toBe(9)
    expect(out.wrong).toEqual([])
  })
})
