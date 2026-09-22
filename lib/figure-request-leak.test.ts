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

describe('the figure description pasted into the stem', () => {
  it('catches the bracketed description that shipped', () => {
    expect(questionLeaksInstructions(
      'Look at the diagram. State the importance of using a graduated scale for measuring the liquid column accurately. [Diagram: A cylinder containing a graduated scale and a measuring liquid, with a ruler beside it, labelled Measurement Scale, Liquid Column, Base.]',
    )).toBe(true)
  })

  it('catches the other bracket labels', () => {
    for (const stem of [
      'Work out the mean. [Table: day, water used]',
      'Describe the trend. [Graph: temperature against time]',
      'Name part A. [Figure: a cross-section of a leaf]',
    ]) {
      expect(questionLeaksInstructions(stem), stem).toBe(true)
    }
  })

  it('leaves ordinary brackets alone', () => {
    for (const stem of [
      'Work out the value of x. [3 marks]',
      'Give the formula for speed. [distance and time are both given]',
      'The mass of the marble (in grams) is shown. Write it down.',
    ]) {
      expect(questionLeaksInstructions(stem), stem).toBe(false)
    }
  })
})
