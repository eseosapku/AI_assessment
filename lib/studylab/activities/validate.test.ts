// lib/studylab/activities/validate.test.ts
import { describe, it, expect } from 'vitest'
import { validateSpec } from './validate'
import { getPatternModule } from './registry'

const good = {
  pattern: 'sort',
  prompt: 'Put each substance in the right group.',
  payload: {
    bins: [{ id: 'acid', label: 'Acid' }, { id: 'base', label: 'Base' }],
    items: [{ id: 'hcl', label: 'HCl', binId: 'acid' }],
  },
  success: { kind: 'binAssignment', assign: { hcl: 'acid' } },
  reveal: 'Acids donate protons.',
}

describe('validateSpec', () => {
  it('accepts a well-formed spec', () => {
    expect(validateSpec(good)).toBe(true)
  })

  it('rejects an unknown pattern', () => {
    expect(validateSpec({ ...good, pattern: 'teleport' })).toBe(false)
  })

  it('rejects a payload that does not match the pattern', () => {
    expect(validateSpec({ ...good, payload: { items: [], bins: [] } })).toBe(false)
  })

  it('rejects a missing or malformed success rule', () => {
    expect(validateSpec({ ...good, success: undefined })).toBe(false)
    expect(validateSpec({ ...good, success: { kind: 'wat' } })).toBe(false)
  })

  it('rejects a missing prompt', () => {
    expect(validateSpec({ ...good, prompt: '' })).toBe(false)
  })

  it('rejects non-objects', () => {
    expect(validateSpec(null)).toBe(false)
    expect(validateSpec('sort')).toBe(false)
  })

  it('rejects prototype-chain pattern names without throwing', () => {
    for (const p of ['__proto__', 'constructor', 'toString', 'valueOf', 'hasOwnProperty', 'isPrototypeOf']) {
      expect(validateSpec({ ...good, pattern: p })).toBe(false)
    }
  })

  it('rejects non-string hint elements', () => {
    expect(validateSpec({ ...good, hints: [123] })).toBe(false)
    expect(validateSpec({ ...good, hints: ['ok'] })).toBe(true)
  })

  it('getPatternModule returns null for prototype-chain keys', () => {
    for (const p of ['__proto__', 'constructor', 'toString']) {
      expect(getPatternModule(p as never)).toBeNull()
    }
  })
})
