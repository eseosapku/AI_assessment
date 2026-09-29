// lib/paper-styles.test.ts
import { describe, it, expect } from 'vitest'
import { styleExamplesFor, questionCopiesAStyle } from './paper-styles'
import fs from 'node:fs'
import path from 'node:path'

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

  // Every ESL ring-around slot -- fourteen a paper -- was shown one "real
  // demand": "Choose the correct picture and circle the letter A, B or C
  // below it." A Listening-paper shape, over a reading question with no
  // picture, in a prompt that goes on to say "There is NO diagram, picture".
  it('shows no shape that points at a picture when the question has none', () => {
    const POINTS = /picture|diagram|graph|chart|table|letter A|A, B or C/i
    for (const code of ['0876', '0057', '0893', '0097', '0862']) {
      for (const format of ['short', 'written', 'select', 'tick']) {
        for (const seed of [1, 2, 3, 4, 5, 6, 7]) {
          for (const s of styleExamplesFor(code, format, { seed, count: 3 })) {
            expect(s, `${code} ${format}`).not.toMatch(POINTS)
          }
        }
      }
    }
  })

  it('still shows them beside a question that has a figure', () => {
    const seen = new Set<string>()
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      for (const s of styleExamplesFor('0893', 'short', { seed, count: 3, figure: true })) seen.add(s)
    }
    expect([...seen].some((s) => /diagram|table|chart|graph/i.test(s))).toBe(true)
  })

  it('lets a table slot talk about its own table', () => {
    const seen = new Set<string>()
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      for (const s of styleExamplesFor('0862', 'table', { seed, count: 3 })) seen.add(s)
    }
    expect([...seen].some((s) => /table/i.test(s))).toBe(true)
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

describe('the corpus holds demands, not the cover page', () => {
  // "Write your name, centre number and candidate number in the boxes at the
  // top of the page." was extracted as a Cambridge demand -- it starts with a
  // command word and ends in a full stop -- and shown to English composition
  // slots as one of three "real demands from this paper".
  it('has no rubric line from the front of a paper', () => {
    const corpus = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'data/paper-styles.json'), 'utf8'))
    const RUBRIC = /candidate number|centre number|space provided|in the boxes at the top/i
    const found: string[] = []
    for (const byCommand of Object.values(corpus) as Record<string, string[]>[]) {
      for (const shapes of Object.values(byCommand)) for (const s of shapes) if (RUBRIC.test(s)) found.push(s)
    }
    expect(found).toEqual([])
  })
})

// A composition's demand IS its topic. Shown "Write a story called <name>
// <name> <name> about someone visiting an event held at night time.", four of
// six English papers set a story about a night-time event.
describe('a composition is shown no real example', () => {
  it('returns nothing for a composition slot', () => {
    for (const code of ['0861', '0876', '0057', '0058']) {
      for (const seed of [1, 2, 3, 4, 5]) expect(styleExamplesFor(code, 'composition', { seed })).toEqual([])
    }
  })
})
