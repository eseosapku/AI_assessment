import { describe, expect, it } from 'vitest'
import { shortfallTolerance } from './quiz-shortfall'

describe('how short a quiz may ship', () => {
  it('is one question for an ordinary quiz of eight or more, as before', () => {
    expect(shortfallTolerance(20, { checkpoint: false, outOfTime: false })).toBe(1)
    expect(shortfallTolerance(5, { checkpoint: false, outOfTime: false })).toBe(0)
  })

  it('is a quarter when the 30 seconds, not the model, stopped the retries', () => {
    // "No retry pass: 21s in, 17 of 20" was answered "Please try again".
    expect(shortfallTolerance(20, { checkpoint: false, outOfTime: true })).toBe(5)
    expect(shortfallTolerance(10, { checkpoint: false, outOfTime: true })).toBe(2)
    expect(shortfallTolerance(8, { checkpoint: false, outOfTime: true })).toBe(2)
  })

  it('keeps a Checkpoint paper to its own rule', () => {
    expect(shortfallTolerance(40, { checkpoint: true, outOfTime: true })).toBe(3)
    expect(shortfallTolerance(20, { checkpoint: true, outOfTime: false })).toBe(2)
  })
})
