// lib/unmarkable.test.ts
import { describe, it, expect } from 'vitest'
import { isUnmarkable, dropUnmarkable } from './unmarkable'

describe('what nobody can mark', () => {
  it('catches a written answer with no mark scheme at all', () => {
    // The shape the generator returns when it omits the field: complete on
    // the page, worth two marks, and none of them awardable.
    expect(isUnmarkable({ type: 'longform', question: 'Explain why the chain rusts.', marks: 2 } as never))
      .toBe(true)
  })

  it('catches one whose only key is a placeholder', () => {
    // "Plant name" rather than a plant marks every learner wrong. The
    // blueprint drops the key and cannot put anything in its place, so the
    // question has to be caught here, while the paper can still be refilled.
    expect(isUnmarkable({ type: 'longform', marks: 1, short_answer: { accepted: ['Plant name'] } }))
      .toBe(true)
  })

  it('accepts a real mark scheme', () => {
    expect(isUnmarkable({ type: 'longform', marks: 2, marking_criteria: ['names rust', 'names oxygen'] }))
      .toBe(false)
  })

  it('accepts a real short-answer key', () => {
    expect(isUnmarkable({ type: 'longform', marks: 1, short_answer: { accepted: ['iron oxide', 'rust'] } }))
      .toBe(false)
  })

  it('ignores blank criteria rather than counting them as a mark scheme', () => {
    expect(isUnmarkable({ type: 'longform', marks: 2, marking_criteria: ['', '   '] })).toBe(true)
  })
})

describe('the questions that mark themselves', () => {
  it('leaves multiple choice alone', () => {
    // Marked by its index. Asking it for criteria would delete the paper.
    expect(isUnmarkable({ type: 'mcq', options: ['a', 'b', 'c', 'd'], correct_answer: 1 } as never)).toBe(false)
  })

  it('leaves tick lists and tables alone', () => {
    expect(isUnmarkable({ type: 'interactive', kind: 'multi_select', correct_indices: [0, 2] } as never)).toBe(false)
    expect(isUnmarkable({ type: 'interactive', kind: 'categorize', correct_category: [0, 1] } as never)).toBe(false)
  })
})

describe('dropping them', () => {
  it('removes only the unmarkable and counts what went', () => {
    const { kept, dropped } = dropUnmarkable([
      { type: 'longform', marks: 2, marking_criteria: ['a', 'b'] },
      { type: 'longform', marks: 2 },
      { type: 'mcq', options: ['a', 'b', 'c', 'd'] },
      { type: 'longform', marks: 1, short_answer: { accepted: ['Plant name'] } },
    ])
    expect(dropped).toBe(2)
    expect(kept).toHaveLength(2)
  })

  it('keeps order', () => {
    const { kept } = dropUnmarkable([
      { type: 'longform', marks: 1, marking_criteria: ['first'] },
      { type: 'longform', marks: 2 },
      { type: 'longform', marks: 1, marking_criteria: ['third'] },
    ])
    expect(kept.map((q) => (q.marking_criteria as string[])[0])).toEqual(['first', 'third'])
  })

  it('survives junk', () => {
    for (const junk of [null, undefined, 'x', 42, [null], [42]]) {
      expect(() => dropUnmarkable(junk as never)).not.toThrow()
    }
  })
})
