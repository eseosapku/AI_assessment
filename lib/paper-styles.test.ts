// lib/paper-styles.test.ts
import { describe, it, expect } from 'vitest'
import { styleExamplesFor, questionCopiesAStyle } from './paper-styles'

describe('real demand shapes from the papers', () => {
  it('offers shapes that suit the slot', () => {
    const short = styleExamplesFor('0893', 'short', { seed: 1 })
    expect(short.length).toBeGreaterThan(0)
    for (const s of short) expect(s.length).toBeGreaterThan(10)

    const select = styleExamplesFor('0862', 'select', { seed: 1 })
    expect(select.join(' ').toLowerCase()).toMatch(/ring|circle|choose/)
  })

  it('varies with the seed, so a paper is not three shapes repeated', () => {
    const a = styleExamplesFor('0893', 'written', { seed: 1 })
    const b = styleExamplesFor('0893', 'written', { seed: 9 })
    expect(a.join('|')).not.toBe(b.join('|'))
  })

  it('is empty rather than wrong for a paper it has never read', () => {
    expect(styleExamplesFor('9999', 'short')).toEqual([])
  })
})

describe('catching a shape handed straight back', () => {
  it('rejects a stem that IS one of the examples', () => {
    // These are verbatim from the corpus.
    expect(questionCopiesAStyle('Draw a ring around the statement that is true.')).toBe(true)
    expect(questionCopiesAStyle('Tick to show if each statement is true or false.')).toBe(true)
  })

  it('rejects one with a placeholder filled in', () => {
    // "Write no more than <n> words." and "Look at lines <n>-<n>." are real
    // corpus shapes; the placeholder stands for whatever was put in it.
    expect(questionCopiesAStyle('Write no more than 200 words.')).toBe(true)
    expect(questionCopiesAStyle('Look at the first paragraph (lines 4-9).')).toBe(true)
  })

  it('allows a short demand, which is just correct English', () => {
    // "Explain why." is not a borrowed phrase and rejecting it would reject
    // the very thing the examples exist to encourage.
    expect(questionCopiesAStyle('Explain why.')).toBe(false)
    expect(questionCopiesAStyle('Complete the table.')).toBe(false)
  })

  it('allows a real question that merely starts the same way', () => {
    for (const stem of [
      'Write down the name of the gas produced when magnesium burns in air.',
      'Explain why the reading at 30 seconds does not fit the pattern.',
      'Draw a ring around the prime number in this list.',
      'Suggest one reason why the plant in the dark box did not grow.',
    ]) {
      expect(questionCopiesAStyle(stem), stem).toBe(false)
    }
  })

  it('is quiet on nothing', () => {
    expect(questionCopiesAStyle('')).toBe(false)
    expect(questionCopiesAStyle(undefined)).toBe(false)
  })
})
