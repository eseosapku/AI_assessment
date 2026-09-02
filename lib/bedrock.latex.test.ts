import { describe, it, expect } from 'vitest'
import { fixLatexInRawJson, parseJsonRobust } from '@/lib/bedrock'

// The model emits LaTeX with single backslashes inside JSON strings. Commands
// that start with b/f/n/r/t/u collide with JSON escape sequences and must be
// doubled so JSON.parse keeps them literal (and KaTeX can render them).
function parseSay(rawJson: string): string {
  return JSON.parse(fixLatexInRawJson(rawJson)).say
}

describe('fixLatexInRawJson preserves LaTeX commands', () => {
  it('keeps \\rightarrow intact (not turned into a carriage return)', () => {
    expect(parseSay('{"say":"$A \\rightarrow B$"}')).toBe('$A \\rightarrow B$')
  })

  it('keeps \\frac, \\times, \\theta, \\beta, \\nabla intact', () => {
    expect(parseSay('{"say":"$\\frac{a}{b}$"}')).toBe('$\\frac{a}{b}$')
    expect(parseSay('{"say":"$2 \\times 3$"}')).toBe('$2 \\times 3$')
    expect(parseSay('{"say":"$\\theta + \\beta$"}')).toBe('$\\theta + \\beta$')
    expect(parseSay('{"say":"$\\nabla f$"}')).toBe('$\\nabla f$')
  })

  it('still treats a real escape (\\n followed by non-letter) as a newline', () => {
    expect(parseSay('{"say":"line1\\n line2"}')).toBe('line1\n line2')
  })

  it('keeps \\n / \\t as real whitespace in code, even before a letter', () => {
    // "\ndef" is a newline + def, NOT the (non-existent) \ndef command.
    const code = JSON.parse(fixLatexInRawJson('{"code":"import cmath\\ndef solve(a):\\n\\treturn a"}')).code
    expect(code).toBe('import cmath\ndef solve(a):\n\treturn a')
  })

  it('still rescues \\n / \\t when they spell a real LaTeX command', () => {
    expect(parseSay('{"say":"$\\nabla f$ and $\\tan x$"}')).toBe('$\\nabla f$ and $\\tan x$')
  })
})

describe('parseJsonRobust rescues LaTeX the model never escaped', () => {
  it('keeps a command whose letter is not a JSON escape', () => {
    // Straight off a maths card: jsonrepair's answer to an invalid escape is
    // to drop the backslash, so the solution read "2 cdot x cdot 4 = 8x".
    const parsed = parseJsonRobust('{"say":"$2 \\cdot x \\cdot 4 = 8x$"}')
    expect(parsed.say).toBe('$2 \\cdot x \\cdot 4 = 8x$')
  })

  it('keeps a command whose letter IS a JSON escape', () => {
    expect(parseJsonRobust('{"say":"$\\frac{b}{2}$"}').say).toBe('$\\frac{b}{2}$')
  })

  it('leaves properly escaped JSON exactly as it is', () => {
    // Native parse wins first; nothing below it ever runs.
    expect(parseJsonRobust('{"say":"a\\nb","n":2}')).toEqual({ say: 'a\nb', n: 2 })
  })

  it('still repairs JSON that is broken for ordinary reasons', () => {
    expect(parseJsonRobust('{"a": 1,}')).toEqual({ a: 1 })
  })

  it('leaves a newline in a code card a newline', () => {
    // The repair pass runs on every response now, and code cards go through it.
    const code = parseJsonRobust('{"code":"import cmath\\ndef solve(a):\\n\\treturn a"}').code
    expect(code).toBe('import cmath\ndef solve(a):\n\treturn a')
  })
})
