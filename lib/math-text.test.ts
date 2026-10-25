import { describe, expect, it } from 'vitest'
import { mathText } from './math-text'

describe('mathText', () => {
  it('leaves a sentence alone', () => {
    expect(mathText('Find the eigenvalues.')).toBe('Find the eigenvalues.')
  })

  it('draws a matrix option instead of crashing on it', () => {
    expect(mathText([[1, 2], [3, 4]])).toBe('$\\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}$')
  })

  it('reads a number and an empty value', () => {
    expect(mathText(12)).toBe('12')
    expect(mathText(null)).toBe('')
    expect(mathText({ text: 'L has 1s on the diagonal' })).toBe('L has 1s on the diagonal')
  })
})
