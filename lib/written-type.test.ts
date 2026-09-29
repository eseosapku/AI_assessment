// lib/written-type.test.ts
import { describe, it, expect } from 'vitest'
import { normaliseWrittenType } from './written-type'

describe('a written answer under another name', () => {
  it('is a longform when it carries a key', () => {
    const q = { type: 'short', question: 'Give the name of the girl who found the book.', short_answer: { accepted: ['Elara'] } }
    normaliseWrittenType(q)
    expect(q.type).toBe('longform')
  })

  it('is a longform when it carries a mark scheme', () => {
    const q = { type: 'composition', question: 'Write a story.', marking_criteria: ['a', 'b', 'c', 'd'] }
    normaliseWrittenType(q)
    expect(q.type).toBe('longform')
  })

  it('is left alone with nothing to mark it by', () => {
    const q = { type: 'short', question: 'Give the name.' }
    normaliseWrittenType(q)
    expect(q.type).toBe('short')
  })

  it('never touches a question that is not a written answer', () => {
    const mcq = { type: 'mcq', question: 'Draw a ring around ...', options: ['a', 'b', 'c', 'd'], correct_answer: 1, short_answer: { accepted: ['b'] } }
    normaliseWrittenType(mcq)
    expect(mcq.type).toBe('mcq')
    const tick = { type: 'interactive', kind: 'multi_select', marking_criteria: ['x'] }
    normaliseWrittenType(tick)
    expect(tick.type).toBe('interactive')
  })
})
