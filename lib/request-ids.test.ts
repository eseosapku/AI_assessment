import { describe, expect, it } from 'vitest'
import { normalizeIds, positiveId } from './request-ids'

describe('positiveId', () => {
  it('reads a real id, as a number or a string', () => {
    expect(positiveId(34)).toBe(34)
    expect(positiveId('205')).toBe(205)
  })

  it('treats null, empty and zero as no id -- the form sends null for a typed topic', () => {
    expect(positiveId(null)).toBeNaN()
    expect(positiveId(undefined)).toBeNaN()
    expect(positiveId('')).toBeNaN()
    expect(positiveId(0)).toBeNaN()
    expect(positiveId(-3)).toBeNaN()
    expect(positiveId(false)).toBeNaN()
    expect(positiveId('abc')).toBeNaN()
  })
})

describe('normalizeIds', () => {
  it('keeps positive ids once and drops the rest', () => {
    expect(normalizeIds([3, '3', 0, null, 7, -1, 'x'])).toEqual([3, 7])
    expect(normalizeIds(null)).toEqual([])
  })
})
