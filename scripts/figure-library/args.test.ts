// scripts/figure-library/args.test.ts
import { describe, it, expect } from 'vitest'
import { parseArgs } from './args'

const spec = { limit: 'int', subject: 'string', redo: 'flag' } as const

describe('reading a script\'s options', () => {
  it('reads flags, values and whole numbers', () => {
    expect(parseArgs(['--limit=20', '--subject=biology', '--redo'], spec)).toEqual({ limit: 20, subject: 'biology', redo: true })
    expect(parseArgs([], spec)).toEqual({})
  })

  it('refuses "--limit 20", which used to drop the limit and map every topic', () => {
    // Parsed loosely, Number("true") was NaN, NaN is falsy, and no LIMIT applied: ~$20 instead of a $0.10 trial.
    expect(() => parseArgs(['--limit', '20'], spec)).toThrow(/--limit needs a value/)
    expect(() => parseArgs(['20'], spec)).toThrow(/Unexpected argument "20"/)
  })

  it('refuses a misspelt option rather than ignoring it', () => {
    // "--subjet=biology --redo" rebuilt every subject's concepts.
    expect(() => parseArgs(['--subjet=biology', '--redo'], spec)).toThrow(/Unknown option --subjet/)
  })

  it('refuses a limit that is not a whole number above zero, and a value on a flag', () => {
    expect(() => parseArgs(['--limit=0'], spec)).toThrow(/whole number above 0/)
    expect(() => parseArgs(['--limit=2.5'], spec)).toThrow(/whole number above 0/)
    expect(() => parseArgs(['--redo=yes'], spec)).toThrow(/takes no value/)
  })
})
