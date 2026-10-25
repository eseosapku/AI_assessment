import { describe, it, expect } from 'vitest'
import { isCalculationDemand } from './calculation-demand'

describe('isCalculationDemand', () => {
  it('recognises the stems that were drawn as essays', () => {
    for (const stem of [
      'Calculate 3 + 4 * 2 - 6 / 3 using the correct order of operations.',
      'Calculate the volume of the cuboid with the given base area.',
      'Calculate the mean number of shoes sold from the table.',
      'Calculate the probability of selecting a violin or a flute.',
      'Work out the perimeter of the rectangle.',
      'Calculate the average speed of a marble rolling down an inclined plane.',
    ]) {
      expect(isCalculationDemand(stem), stem).toBe(true)
    }
  })

  it('leaves a question that also wants prose', () => {
    // These earn their written box: the explanation IS the marks.
    expect(isCalculationDemand('Calculate the mean and explain why it is misleading.')).toBe(false)
    expect(isCalculationDemand('Work out the total and describe the pattern you notice.')).toBe(false)
    expect(isCalculationDemand('Calculate the speed. Explain why it increases.')).toBe(false)
  })

  it('treats a matrix problem as working, and a reading question as prose', () => {
    expect(isCalculationDemand('Find the determinant of A = [[4, 2], [1, 3]].')).toBe(true)
    expect(isCalculationDemand('Given the matrix A = [[4, 2], [1, 3]], find the eigenvalues of A.')).toBe(true)
    expect(isCalculationDemand('Perform LU decomposition on the matrix A = [[2, 1], [6, 5]].')).toBe(true)
    expect(isCalculationDemand('What is the geometric interpretation of the determinant of a matrix?')).toBe(false)
    expect(isCalculationDemand('Solve the equation 2x + 3 = 11.')).toBe(true)
    expect(isCalculationDemand('Find the information directly stated in the text.')).toBe(false)
  })

  it('is not fooled by an English comprehension demand', () => {
    expect(isCalculationDemand('Find the information directly stated in the text.')).toBe(false)
    expect(isCalculationDemand('Explain how the writer builds tension.')).toBe(false)
    expect(isCalculationDemand('Describe the water cycle.')).toBe(false)
  })

  it('handles empty input', () => {
    expect(isCalculationDemand('')).toBe(false)
    expect(isCalculationDemand(null)).toBe(false)
    expect(isCalculationDemand(undefined)).toBe(false)
  })
})
