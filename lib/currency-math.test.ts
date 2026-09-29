import { describe, it, expect } from 'vitest'
import { protectCurrency, hasCurrency } from './currency-math'

describe('protectCurrency', () => {
  it('leaves every price in the stem that shipped as a price', () => {
    const stem =
      'Calculate the total amount of change from a $50 bill after buying three items costing $12.45, $8.99, and $15.75.'
    // No dollar is turned into a maths delimiter, so nothing is italicised.
    expect(protectCurrency(stem)).toBe(stem)
    expect(protectCurrency(stem)).not.toContain('\\(')
  })

  it('keeps real maths as maths when money is also present', () => {
    expect(protectCurrency('A pen costs $3. Simplify $2^3 \\times 2^4$.'))
      .toBe('A pen costs $3. Simplify \\(2^3 \\times 2^4\\).')
    expect(protectCurrency('Tickets cost $5 each. Work out $2 + 3$.'))
      .toBe('Tickets cost $5 each. Work out \\(2 + 3\\).')
  })

  it('leaves text with no money exactly as it was', () => {
    for (const s of ['Simplify $2^3 * 2^4$.', 'Find $\\frac{2}{9}$ of 45.', 'Name the gas.']) {
      expect(protectCurrency(s)).toBe(s)
    }
  })

  it('knows money when it sees it', () => {
    expect(hasCurrency('costs $12.45')).toBe(true)
    expect(hasCurrency('a $1,200 bike')).toBe(true)
    expect(hasCurrency('Simplify $2^3$')).toBe(false)
    expect(hasCurrency('')).toBe(false)
  })
})
