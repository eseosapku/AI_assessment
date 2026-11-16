import { describe, it, expect } from 'vitest'
import { evaluateExpr } from './expr'

describe('evaluateExpr', () => {
  it('evaluates arithmetic with precedence', () => {
    expect(evaluateExpr('2 + 3 * 4', {})).toBe(14)
    expect(evaluateExpr('(2 + 3) * 4', {})).toBe(20)
    expect(evaluateExpr('2 ^ 3 ^ 2', {})).toBe(512) // right-assoc
    expect(evaluateExpr('-5 + 2', {})).toBe(-3)
    expect(evaluateExpr('10 / 4', {})).toBe(2.5)
  })

  it('substitutes variables', () => {
    expect(evaluateExpr('d * v', { d: 3, v: 4 })).toBe(12)
    expect(evaluateExpr('rho * g * h', { rho: 1000, g: 10, h: 2 })).toBe(20000)
  })

  it('supports whitelisted functions', () => {
    expect(evaluateExpr('sqrt(16)', {})).toBe(4)
    expect(evaluateExpr('max(3, 7)', {})).toBe(7)
    expect(evaluateExpr('round(2.6)', {})).toBe(3)
    expect(evaluateExpr('abs(0 - 5)', {})).toBe(5)
  })

  it('fails closed on unknown identifiers', () => {
    expect(evaluateExpr('missing + 1', {})).toBeNull()
    expect(evaluateExpr('nope(2)', {})).toBeNull()
  })

  it('fails closed on injection attempts', () => {
    for (const bad of [
      'constructor', 'this', 'process.exit(1)', 'globalThis',
      '(function(){return 1})()', 'import("fs")', '__proto__',
      'a=>1', '[].constructor', 'window.alert(1)',
    ]) {
      expect(evaluateExpr(bad, {})).toBeNull()
    }
  })

  it('fails closed on prototype-chain identifiers', () => {
    for (const bad of [
      '__proto__(1)', 'hasOwnProperty(1)', 'valueOf(1)', 'toString(1)',
      'constructor(1)', 'propertyIsEnumerable(1)', 'toLocaleString(1)', 'isPrototypeOf(1)',
      '__proto__', 'constructor', 'hasOwnProperty',
    ]) {
      expect(evaluateExpr(bad, {})).toBeNull()
    }
  })

  it('fails closed on malformed input', () => {
    expect(evaluateExpr('2 +', {})).toBeNull()
    expect(evaluateExpr('((2)', {})).toBeNull()
    expect(evaluateExpr('', {})).toBeNull()
    expect(evaluateExpr('1/0', {})).toBeNull() // non-finite rejected
  })

  // Piecewise curves are real science (an enzyme's optimum, a limiting factor's
  // plateau), and writers reach for ?: to draw them however they are told not to.
  it('compares, giving 1 or 0', () => {
    expect(evaluateExpr('t < 40', { t: 30 })).toBe(1)
    expect(evaluateExpr('t >= 40', { t: 30 })).toBe(0)
    expect(evaluateExpr('t == 40', { t: 40 })).toBe(1)
    expect(evaluateExpr('t != 40', { t: 40 })).toBe(0)
  })

  it('chooses with ?: and nests', () => {
    const enzyme = 'temp < 40 ? temp * 0.6 : max(0, 24 - (temp - 40) * 1.2)'
    expect(evaluateExpr(enzyme, { temp: 20 })).toBeCloseTo(12)
    expect(evaluateExpr(enzyme, { temp: 50 })).toBeCloseTo(12)
    expect(evaluateExpr(enzyme, { temp: 70 })).toBe(0)
    expect(evaluateExpr('x < 0 ? -1 : x == 0 ? 0 : 1', { x: 5 })).toBe(1)
    expect(evaluateExpr('min(x < 3 ? x : 3, 10)', { x: 7 })).toBe(3)
  })

  it('does not fail on the branch it does not take', () => {
    expect(evaluateExpr('x > 0 ? 1 / x : 0', { x: 0 })).toBe(0)
  })

  it('still fails closed on a broken conditional', () => {
    expect(evaluateExpr('x < ? 1 : 2', { x: 1 })).toBeNull()
    expect(evaluateExpr('x < 3 ? 1', { x: 1 })).toBeNull()
    expect(evaluateExpr('x < 3 ? y : 2', { x: 1 })).toBeNull()
  })
})
