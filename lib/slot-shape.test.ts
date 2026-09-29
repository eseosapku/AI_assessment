// lib/slot-shape.test.ts
import { describe, it, expect } from 'vitest'
import { enforceSlotShape, isCompositionQuestion, type SlotSpec } from './slot-shape'

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

// "Explain what is a fact in this sentence." shipped in an English paper's
// 25-mark composition slot. It carried two marking points, which was all the
// check asked of a composition.
describe('a composition slot holds a writing task', () => {
  const bands = ['content', 'structure', 'sentences', 'vocabulary']

  it('reports a comprehension question in a composition slot', () => {
    for (const question of [
      'Explain what is a fact in this sentence.',
      'In paragraph F, how does the writer describe the forest before Theo enters it?',
      "Describe Elara's feelings as she reached the Emerald Grove.",
    ]) {
      const out = enforceSlotShape([{ type: 'longform', question, marking_criteria: bands }], [{ marks: 25, format: 'composition' }])
      expect(out.wrong, question).toEqual([{ index: 0, wanted: 'composition', got: 'longform' }])
    }
  })

  it('accepts a writing task, including one that sets the scene first', () => {
    for (const question of [
      "Write a story called 'The Midnight Concert' for your school magazine. Write about 500 words.",
      'Your school is holding a competition. Write an article for the school website about a place you love.',
      'Write a letter to your head teacher suggesting one change to the school day.',
      'Write a description of a busy market for readers who have never visited one.',
    ]) {
      const out = enforceSlotShape([{ type: 'longform', question, marking_criteria: bands }], [{ marks: 25, format: 'composition' }])
      expect(out.wrong, question).toEqual([])
    }
  })
})

// The guards a composition was deleted by -- "Aim" read as a character, "400
// words" plus "difference" read as a sum, "picture it" read as a missing
// picture -- were all written for questions about a text, a figure or a
// number. The route knows which questions it wrote for a composition slot, so
// it says so on the question and the guards can ask.
describe('a question remembers the slot it was written for', () => {
  it('is stamped with its slot format', () => {
    const q: any = { type: 'longform', question: 'Write a story about a storm.', marking_criteria: ['a', 'b', 'c', 'd'] }
    enforceSlotShape([q], [{ marks: 25, format: 'composition' }])
    expect(q.slot_format).toBe('composition')
    expect(isCompositionQuestion(q)).toBe(true)
  })

  it('knows a composition by its wording when it has no stamp', () => {
    expect(isCompositionQuestion({ question: 'Your school is holding a competition. Write an article about a hobby you love.' })).toBe(true)
    expect(isCompositionQuestion({ question: 'In paragraph B, what did Elara find?' })).toBe(false)
    expect(isCompositionQuestion({ question: 'Explain what is a fact in this sentence.', slot_format: 'written' })).toBe(false)
  })
})

describe('the stamp is earned', () => {
  it('is not given to a one-liner kept in a composition slot', () => {
    const q: any = { type: 'longform', question: 'In paragraph E, where did Elara find Orion?', marking_criteria: ['a'] }
    enforceSlotShape([q], [{ marks: 25, format: 'composition' }])
    expect(q.slot_format).toBeUndefined()
    expect(isCompositionQuestion(q)).toBe(false)
  })

  it('knows the framing Cambridge often uses', () => {
    expect(isCompositionQuestion({ question: 'You have been asked to write an article for the school website about a place you love.' })).toBe(true)
  })
})
