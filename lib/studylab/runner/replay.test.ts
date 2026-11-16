import { describe, expect, it } from 'vitest'
import { replaySteps, MAX_TRACE } from './replay'

/**
 * A run played back a line at a time: where the marker is at each step, and
 * how many lines of output have been printed by then.
 */
describe('replaySteps', () => {
  const code = 'a = 1\nprint(a)\nprint(a + 1)'

  it('steps through the lines, counting the output printed so far', () => {
    expect(replaySteps([{ line: 1 }, { line: 2, out: '1\n' }, { line: 3, out: '2\n' }], code)).toEqual([
      { line: 1, outputLines: 0 },
      { line: 2, outputLines: 1 },
      { line: 3, outputLines: 2 },
    ])
  })

  it('drops a step outside the code, but still counts what it printed', () => {
    expect(replaySteps([{ line: 1 }, { line: 9, out: 'x\n' }, { line: 2, out: 'y\n' }], code)).toEqual([
      { line: 1, outputLines: 0 },
      { line: 2, outputLines: 2 },
    ])
  })

  it('counts every line of a print that wrote several', () => {
    expect(replaySteps([{ line: 2, out: 'a\nb\nc\n' }], code)).toEqual([{ line: 2, outputLines: 3 }])
  })

  it(`stops at ${MAX_TRACE} steps`, () => {
    const long = Array.from({ length: 900 }, (_, i) => ({ line: (i % 3) + 1 }))
    expect(replaySteps(long, code)).toHaveLength(MAX_TRACE)
  })

  it('has nothing to play for a trace that is not one', () => {
    expect(replaySteps(undefined, code)).toEqual([])
    expect(replaySteps([{ line: 'x' } as never, { line: 1.5 } as never], code)).toEqual([])
  })
})
