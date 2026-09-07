// lib/studylab/activities/success.test.ts
import { describe, it, expect } from 'vitest'
import { evaluateSuccess } from './success'
import { seededShuffle } from './shuffle'

describe('evaluateSuccess', () => {
  it('exactSet ignores order but requires identical membership', () => {
    const r = { kind: 'exactSet', itemIds: ['a', 'b'] } as const
    expect(evaluateSuccess(r, { set: ['b', 'a'] }).ok).toBe(true)
    expect(evaluateSuccess(r, { set: ['a'] }).ok).toBe(false)
    expect(evaluateSuccess(r, { set: ['a', 'b', 'c'] }).wrongIds).toEqual(['c'])
  })

  it('exactOrder requires the exact sequence and reports misplaced ids', () => {
    const r = { kind: 'exactOrder', itemIds: ['a', 'b', 'c'] } as const
    expect(evaluateSuccess(r, { order: ['a', 'b', 'c'] }).ok).toBe(true)
    const bad = evaluateSuccess(r, { order: ['a', 'c', 'b'] })
    expect(bad.ok).toBe(false)
    expect(bad.wrongIds).toEqual(['c', 'b'])
  })

  it('binAssignment reports only the wrongly-binned items', () => {
    const r = { kind: 'binAssignment', assign: { a: 'x', b: 'y' } } as const
    expect(evaluateSuccess(r, { assign: { a: 'x', b: 'y' } }).ok).toBe(true)
    const bad = evaluateSuccess(r, { assign: { a: 'y', b: 'y' } })
    expect(bad.ok).toBe(false)
    expect(bad.wrongIds).toEqual(['a'])
  })

  it('binAssignment fails when an item is unplaced', () => {
    const r = { kind: 'binAssignment', assign: { a: 'x', b: 'y' } } as const
    expect(evaluateSuccess(r, { assign: { a: 'x' } }).ok).toBe(false)
  })

  it('numericWithin honours tolerance', () => {
    const r = { kind: 'numericWithin', target: 10, tolerance: 0.5 } as const
    expect(evaluateSuccess(r, { value: 10.4 }).ok).toBe(true)
    expect(evaluateSuccess(r, { value: 10.6 }).ok).toBe(false)
    expect(evaluateSuccess(r, {}).ok).toBe(false)
  })

  it('pairing is order-insensitive within and across pairs', () => {
    const r = { kind: 'pairing', pairs: [['a', '1'], ['b', '2']] } as const
    expect(evaluateSuccess(r, { pairs: [['b', '2'], ['a', '1']] }).ok).toBe(true)
    expect(evaluateSuccess(r, { pairs: [['a', '2'], ['b', '1']] }).ok).toBe(false)
  })

  it('allSubgoals requires every subgoal and merges wrongIds', () => {
    const r = {
      kind: 'allSubgoals',
      subgoals: [
        { kind: 'exactSet', itemIds: ['a'] },
        { kind: 'numericWithin', target: 5, tolerance: 0 },
      ],
    } as const
    expect(evaluateSuccess(r, { set: ['a'], value: 5 }).ok).toBe(true)
    expect(evaluateSuccess(r, { set: ['z'], value: 4 }).ok).toBe(false)
  })
})

describe('seededShuffle', () => {
  it('is deterministic for a given seed', () => {
    const a = seededShuffle([1, 2, 3, 4, 5], 42)
    const b = seededShuffle([1, 2, 3, 4, 5], 42)
    expect(a).toEqual(b)
  })
  it('preserves membership', () => {
    expect([...seededShuffle([1, 2, 3, 4, 5], 7)].sort()).toEqual([1, 2, 3, 4, 5])
  })
})
