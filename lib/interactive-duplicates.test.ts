import { describe, expect, it } from 'vitest'
import { uniqueInteractiveExercises } from './interactive-duplicates'

describe('interactive content duplicates', () => {
  it('removes repeated odd-one-out choices even when a second answer key differs', () => {
    const q = { type: 'interactive', kind: 'odd_one_out', items: ['He walked.', 'She ran.', 'They were swimming.', 'The book was there.'], correct_index: 2 }
    expect(uniqueInteractiveExercises([q, { ...q, correct_index: 3 }])).toHaveLength(1)
  })
  it('recognises the same match despite new wording, display order and ratio spacing', () => {
    const q = { type: 'interactive', kind: 'match', question: 'Match the functions.', left_items: ['Sine', 'Cosine'], right_items: ['Opposite / Hypotenuse', 'Adjacent / Hypotenuse'] }
    expect(uniqueInteractiveExercises([q, { ...q, question: 'Match each term to its definition.', left_items: ['Cosine', 'Sine'], right_items: ['Adjacent/Hypotenuse', 'Opposite/Hypotenuse'] }])).toHaveLength(1)
  })
  it('removes paraphrased blank exercises testing exactly the same answers from the same word bank', () => {
    const q = { type: 'interactive', kind: 'fill_blank', template: 'Sine is {{0}} divided by {{1}}.', blanks: [{ correct: 'opposite' }, { correct: 'hypotenuse' }], word_bank: ['opposite', 'adjacent', 'hypotenuse'] }
    expect(uniqueInteractiveExercises([q, { ...q, template: 'The sine ratio equals the {{0}} side over the {{1}} side.' }])).toHaveLength(1)
  })
  it('retains computations with different given numbers and ordinary questions', () => {
    const q = { type: 'interactive', kind: 'fill_blank', template: '5 × {{0}} = 10.', blanks: [{ correct: '2' }], word_bank: ['1', '2', '3'] }
    expect(uniqueInteractiveExercises([q, { ...q, template: '6 × {{0}} = 12.' }, { type: 'mcq', question: 'What is 2 + 2?' }])).toHaveLength(3)
  })
})
