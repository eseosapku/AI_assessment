import { describe, it, expect } from 'vitest'
import { questionLeaksInstructions } from './figure-request'

/**
 * Three stems that reached a learner with the prompt printed inside them.
 * Copied here exactly as they were shipped.
 */
describe('questionLeaksInstructions', () => {
  it('catches the prompt wording pasted into a stem', () => {
    expect(questionLeaksInstructions(
      "Work out the perimeter of the diagram. Refer to it as 'the diagram'. Do NOT restate what it shows.",
    )).toBe(true)
  })

  it('catches the label list pasted into a stem', () => {
    expect(questionLeaksInstructions(
      'Work out the area of the diagram. 10 cm | 15 cm | 10 cm | 15 cm',
    )).toBe(true)
    expect(questionLeaksInstructions(
      'Calculate the relative frequency. walk | bus | number of learners walk | 30 bus | 70',
    )).toBe(true)
  })

  it('leaves ordinary questions alone', () => {
    for (const stem of [
      'Look at the diagram. Work out the perimeter.',
      'Add 2/5 and 3/7.',
      'The table shows how learners travel to school. Calculate the relative frequency of walking.',
      'Explain why the reading at 30 s is anomalous.',
    ]) {
      expect(questionLeaksInstructions(stem), stem).toBe(false)
    }
  })

  it('does not fire on a single pipe, which is a maths symbol', () => {
    expect(questionLeaksInstructions('Work out |-8| + |3|.')).toBe(false)
  })
})
