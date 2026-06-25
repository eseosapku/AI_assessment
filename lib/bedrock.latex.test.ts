import { describe, it, expect } from 'vitest'
import { fixLatexInRawJson } from '@/lib/bedrock'

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
})
