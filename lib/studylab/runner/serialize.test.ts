import { describe, it, expect } from 'vitest'
import { serializeArg } from '@/lib/studylab/runner/serialize'

describe('serializeArg', () => {
  it('passes strings through', () => {
    expect(serializeArg('hi')).toBe('hi')
  })
  it('stringifies numbers and booleans', () => {
    expect(serializeArg(42)).toBe('42')
    expect(serializeArg(true)).toBe('true')
  })
  it('handles undefined and null', () => {
    expect(serializeArg(undefined)).toBe('undefined')
    expect(serializeArg(null)).toBe('null')
  })
  it('pretty-prints objects and arrays', () => {
    expect(serializeArg({ a: 1 })).toBe('{\n  "a": 1\n}')
    expect(serializeArg([1, 2])).toBe('[\n  1,\n  2\n]')
  })
  it('labels functions', () => {
    expect(serializeArg(() => {})).toBe('[Function]')
  })
  it('survives circular references', () => {
    const o: any = {}
    o.self = o
    expect(serializeArg(o)).toBe('[Circular]')
  })
})
