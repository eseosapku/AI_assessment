import { describe, it, expect } from 'vitest'
import {
  optionsAreDegenerate,
  splitInlineOptions,
  repairInlineOptions,
  repairPaper,
} from './inline-options'

describe('optionsAreDegenerate', () => {
  it('spots options that are only letters', () => {
    expect(optionsAreDegenerate(['A', 'B', 'C', 'D'])).toBe(true)
    expect(optionsAreDegenerate(['A)', 'B)', 'C)', 'D)'])).toBe(true)
    expect(optionsAreDegenerate(['(a)', '(b)'])).toBe(true)
  })

  it('spots missing or empty options', () => {
    expect(optionsAreDegenerate(undefined)).toBe(true)
    expect(optionsAreDegenerate([])).toBe(true)
    expect(optionsAreDegenerate(['', '  '])).toBe(true)
  })

  it('leaves real options alone', () => {
    expect(optionsAreDegenerate(['Nucleus', 'Ribosome'])).toBe(false)
    // A single-letter answer is legitimate in some questions, so one real
    // option among letters is enough to call the set real.
    expect(optionsAreDegenerate(['A', 'The nucleus'])).toBe(false)
  })
})

describe('splitInlineOptions', () => {
  it('pulls a printed options block out of the stem', () => {
    const stem = [
      'The shaded area in the diagram is represented by',
      'A) {(x,y) : y - 3x < -6}',
      'B) {(x,y) : y + 3x < 6}',
      'C) {(x,y) : y + 3x < -6}',
      'D) {(x,y) : y - 3x < 6}',
    ].join('\n')
    expect(splitInlineOptions(stem)).toEqual({
      question: 'The shaded area in the diagram is represented by',
      options: ['{(x,y) : y - 3x < -6}', '{(x,y) : y + 3x < 6}', '{(x,y) : y + 3x < -6}', '{(x,y) : y - 3x < 6}'],
    })
  })

  it('handles full stops and brackets as label styles', () => {
    expect(splitInlineOptions('Pick one\nA. Red\nB. Blue')?.options).toEqual(['Red', 'Blue'])
    expect(splitInlineOptions('Pick one\n(A) Red\n(B) Blue')?.options).toEqual(['Red', 'Blue'])
  })

  it('handles a block that ran together on one line', () => {
    const r = splitInlineOptions('Which is a metal? A) Sodium B) Oxygen C) Neon')
    expect(r?.question).toBe('Which is a metal?')
    expect(r?.options).toEqual(['Sodium', 'Oxygen', 'Neon'])
  })

  it('refuses a stem that only mentions a letter in passing', () => {
    // Mangling a good question is worse than leaving a bad one.
    expect(splitInlineOptions('If A) is chosen, what follows?')).toBeNull()
    expect(splitInlineOptions('Plain question with no options at all')).toBeNull()
  })

  it('requires the labels to run consecutively', () => {
    expect(splitInlineOptions('Question\nA) one\nC) three\nF) six')).toBeNull()
  })

  it('refuses when prose follows the labelled block', () => {
    // Then it is not an options list, it is a worked example inside the stem.
    expect(splitInlineOptions('Question\nA) one\nB) two\nExplain your reasoning.')).toBeNull()
  })

  it('refuses when there is no stem left over', () => {
    expect(splitInlineOptions('A) one\nB) two')).toBeNull()
  })

  it('handles nothing gracefully', () => {
    expect(splitInlineOptions('')).toBeNull()
    expect(splitInlineOptions(null)).toBeNull()
    expect(splitInlineOptions(undefined)).toBeNull()
  })
})

describe('repairInlineOptions', () => {
  const broken = {
    question: 'Which of these is a noble gas?\nA) Sodium\nB) Neon\nC) Iron\nD) Sulphur',
    options: ['A', 'B', 'C', 'D'],
    correct_answer: 1,
  }

  it('rebuilds the options and keeps the answer pointing at the same choice', () => {
    const r = repairInlineOptions(broken)!
    expect(r.question).toBe('Which of these is a noble gas?')
    expect(r.options).toEqual(['Sodium', 'Neon', 'Iron', 'Sulphur'])
    // The model picked B against the letters it was reading, and the extracted
    // options are in that same order.
    expect(r.options[r.correct_answer]).toBe('Neon')
  })

  it('does nothing when the options are already real', () => {
    expect(repairInlineOptions({ ...broken, options: ['Sodium', 'Neon', 'Iron', 'Sulphur'] })).toBeNull()
  })

  it('does nothing when there is nothing to extract', () => {
    expect(repairInlineOptions({ question: 'A plain question', options: ['A', 'B'] })).toBeNull()
  })

  it('clamps an answer index that falls outside the extracted options', () => {
    const r = repairInlineOptions({ ...broken, correct_answer: 9 })!
    expect(r.correct_answer).toBe(3)
    expect(r.options[r.correct_answer]).toBe('Sulphur')
  })

  it('survives a missing answer index', () => {
    expect(repairInlineOptions({ ...broken, correct_answer: undefined })!.correct_answer).toBe(0)
  })
})

describe('repairPaper', () => {
  it('fixes what it can and counts it, leaving the rest untouched', () => {
    const paper = [
      { question: 'Pick one\nA) Red\nB) Blue', options: ['A', 'B'], correct_answer: 0 },
      { question: 'Already fine?', options: ['Yes', 'No'], correct_answer: 0 },
      { question: 'Unfixable', options: ['A', 'B'], correct_answer: 0 },
    ]
    expect(repairPaper(paper)).toBe(1)
    expect(paper[0].options).toEqual(['Red', 'Blue'])
    expect(paper[1].options).toEqual(['Yes', 'No'])
    expect(paper[2].options).toEqual(['A', 'B'])
  })

  it('handles an empty paper', () => {
    expect(repairPaper([])).toBe(0)
  })
})
