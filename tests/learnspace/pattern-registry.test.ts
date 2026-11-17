import { describe, it, expect } from 'vitest'
import { getPatternModule, registeredPatterns } from '@/lib/studylab/activities/registry'

const PATTERNS = ['sort', 'threePeriod', 'sequence', 'compare', 'label', 'vary', 'balance', 'scenario', 'compose', 'scene']

describe('activity patterns', () => {
  it('registers each pattern once, including scenes', () => {
    expect(registeredPatterns()).toEqual(PATTERNS)
    for (const name of PATTERNS) expect(getPatternModule(name as never)?.pattern).toBe(name)
  })

  it('a model id that is not a pattern is not a pattern', () => {
    expect(getPatternModule('__proto__' as never)).toBeNull()
    expect(getPatternModule('constructor' as never)).toBeNull()
    expect(getPatternModule('quiz' as never)).toBeNull()
  })
})
