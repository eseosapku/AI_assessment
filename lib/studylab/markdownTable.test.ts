// lib/studylab/markdownTable.test.ts
import { describe, it, expect } from 'vitest'
import { splitMarkdownTable } from './markdownTable'

const PUMP = `An engineer must choose between two pumps. Data are as follows:

| | Pump A | Pump B |
|:---|:---|:---|
| Initial Cost ($) | 200,000 | 300,000 |
| Operating Cost per year | 30,000 | 23,000 |
| Lifetime (yrs) | 12 years | 16 years |

The interest rate is 7%. Find the best pump.`

describe('splitMarkdownTable', () => {
  it('separates the prose from the table it wraps', () => {
    const split = splitMarkdownTable(PUMP)!
    expect(split.before).toContain('two pumps')
    expect(split.after).toContain('interest rate is 7%')
    expect(split.rows[0]).toEqual(['', 'Pump A', 'Pump B'])
    expect(split.rows[1]).toEqual(['Initial Cost ($)', '200,000', '300,000'])
    expect(split.rows).toHaveLength(4)
  })

  it('drops the alignment row, which is punctuation not data', () => {
    const split = splitMarkdownTable(PUMP)!
    expect(split.rows.some((r) => r.join('').includes('---'))).toBe(false)
  })

  it('says nothing when there is no table', () => {
    expect(splitMarkdownTable('Find the best pump.')).toBeNull()
    expect(splitMarkdownTable('')).toBeNull()
  })

  it('does not mistake one line of pipes for a table', () => {
    // "| x | is the absolute value" is a sentence, not two columns.
    expect(splitMarkdownTable('Evaluate | x | for x = -3.')).toBeNull()
  })

  it('handles a table with no prose around it', () => {
    const split = splitMarkdownTable('| a | b |\n| 1 | 2 |')!
    expect(split.before).toBe('')
    expect(split.after).toBe('')
    expect(split.rows).toEqual([['a', 'b'], ['1', '2']])
  })

  it('keeps the cells empty rather than dropping them', () => {
    // The pump table's first header cell is blank, and the columns only line
    // up if it survives.
    const split = splitMarkdownTable('| | A | B |\n| x | 1 | 2 |')!
    expect(split.rows[0]).toHaveLength(3)
    expect(split.rows[0][0]).toBe('')
  })
})
