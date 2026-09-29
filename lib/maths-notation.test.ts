import { describe, it, expect } from 'vitest'
import { prettyMaths } from './maths-notation'

describe('prettyMaths', () => {
  it('prints the stems that shipped the way a paper prints them', () => {
    expect(prettyMaths('Substitute x = 3 into the formula y = 2x^2 - 5x + 4.'))
      .toBe('Substitute x = 3 into the formula y = 2x² - 5x + 4.')
    expect(prettyMaths('Calculate 3 + 4 * 2 - 6 / 3 using the correct order of operations.'))
      .toBe('Calculate 3 + 4 × 2 - 6 / 3 using the correct order of operations.')
    expect(prettyMaths('Simplify the expression (10^4 * 10^3) / 10^5.'))
      .toBe('Simplify the expression (10⁴ × 10³) / 10⁵.')
  })

  it('leaves $...$ alone, since the page renders that as maths already', () => {
    const stem = 'Simplify the expression $2^3 * 2^4$. Show your working.'
    expect(prettyMaths(stem)).toBe(stem)
  })

  it('leaves code alone', () => {
    const stem = 'What does `total = price * 2` store in total?'
    expect(prettyMaths(stem)).toBe(stem)
  })

  it('does not guess at exponents it cannot print plainly', () => {
    expect(prettyMaths('Work out 2^10.')).toBe('Work out 2^10.')
    expect(prettyMaths('Write 2^(n+1) in another form.')).toBe('Write 2^(n+1) in another form.')
  })

  it('does not touch a fraction or a stray asterisk', () => {
    expect(prettyMaths('Convert 3/4 to a percentage.')).toBe('Convert 3/4 to a percentage.')
    expect(prettyMaths('Use the values marked *.')).toBe('Use the values marked *.')
  })

  it('handles empty input', () => {
    expect(prettyMaths('')).toBe('')
    expect(prettyMaths(null)).toBe('')
  })
})
