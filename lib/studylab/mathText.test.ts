// lib/studylab/mathText.test.ts
import { describe, it, expect } from 'vitest'
import { toDollarMath } from './mathText'

describe('toDollarMath', () => {
  it('converts the delimiters the renderer does not read', () => {
    // A check asked the learner to factor "\(x^2 + 10x + 25\)", brackets and all.
    expect(toDollarMath('Factor \\(x^2 + 10x + 25\\).')).toBe('Factor $x^2 + 10x + 25$.')
    expect(toDollarMath('\\[a^2 + b^2 = c^2\\]')).toBe('$$a^2 + b^2 = c^2$$')
  })

  it('handles both kinds in one string', () => {
    expect(toDollarMath('If \\(a = 2\\) then \\[a^2 = 4\\]')).toBe('If $a = 2$ then $$a^2 = 4$$')
  })

  it('leaves what is already in dollars alone', () => {
    expect(toDollarMath('$x^2 + 1$ and $$y = 2$$')).toBe('$x^2 + 1$ and $$y = 2$$')
  })

  it('leaves an unpaired delimiter as text', () => {
    // Turning a lone opener into a stray $ would put the rest of the card into
    // maths mode.
    expect(toDollarMath('the token \\( on its own')).toBe('the token \\( on its own')
    expect(toDollarMath('a \\) with no opener')).toBe('a \\) with no opener')
  })

  it('does not touch ordinary brackets or backslashes', () => {
    expect(toDollarMath('call foo(1, 2) then halve it')).toBe('call foo(1, 2) then halve it')
    expect(toDollarMath('a path C:\\Users\\x')).toBe('a path C:\\Users\\x')
  })

  it('spans the line breaks a display block is written across', () => {
    expect(toDollarMath('\\[\n  x = 1\n\\]')).toBe('$$\n  x = 1\n$$')
  })
})

/**
 * `$` is a currency symbol far more often than it is a maths delimiter, and a
 * transcribed homework table is full of them.
 */
describe('a dollar sign in transcribed homework', () => {
  it('is not treated as the start of a formula when a pipe follows it', () => {
    // "Initial Cost ($) | 200,000 |" put everything from that bracket to the
    // next dollar into maths mode, and the pump table came out as one run of
    // italics in the card the learner has to read most carefully.
    const row = '| Initial Cost ($) | 200,000 | 300,000 |'
    const span = row.slice(row.indexOf('$'))
    expect(/[|\n]/.test(span)).toBe(true)
  })

  it('leaves a real inline formula alone', () => {
    expect(/[|\n]/.test('$x^2 + 1$')).toBe(false)
  })
})
