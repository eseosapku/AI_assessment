import { describe, it, expect } from 'vitest'
import {
  registerViolation,
  violationsRemaining,
  DEFAULT_MAX_VIOLATIONS,
  BLUR_GRACE_MS,
} from './assessment-proctor'

describe('registerViolation', () => {
  it('never submits on the first violation', () => {
    // The whole point: losing an exam to one stray focus change was the bug.
    for (const kind of ['hidden', 'blur'] as const) {
      const d = registerViolation(kind, 0)
      expect(d.action).toBe('warn')
      expect(d.count).toBe(1)
    }
  })

  it('warns up to the threshold, then submits', () => {
    expect(registerViolation('hidden', 0).action).toBe('warn')
    expect(registerViolation('hidden', 1).action).toBe('warn')
    expect(registerViolation('hidden', 2).action).toBe('warn')
    expect(registerViolation('hidden', 3).action).toBe('submit')
  })

  it('counts the violation that submits', () => {
    expect(registerViolation('hidden', 3).count).toBe(4)
  })

  it('tells the student how many warnings remain', () => {
    expect(registerViolation('hidden', 0).message).toMatch(/2 more warnings/)
    expect(registerViolation('hidden', 1).message).toMatch(/1 more warning\b/)
    expect(registerViolation('hidden', 2).message).toMatch(/One more/)
    expect(registerViolation('hidden', 3).message).toMatch(/last warning/)
  })

  it('describes the two signals differently', () => {
    expect(registerViolation('hidden', 0).message).toMatch(/switched away/)
    expect(registerViolation('blur', 0).message).toMatch(/lost focus/)
  })

  it('honours a custom threshold', () => {
    expect(registerViolation('hidden', 0, 1).action).toBe('warn')
    expect(registerViolation('hidden', 1, 1).action).toBe('submit')
  })

  it('refuses a threshold that would restore submit-on-first', () => {
    // A zero or negative max is exactly the behaviour being removed, so it
    // falls back to the default rather than being honoured.
    for (const bad of [0, -3, NaN, undefined, null, 'x']) {
      expect(registerViolation('hidden', 0, bad as never).action).toBe('warn')
    }
  })

  it('handles a malformed previous count', () => {
    for (const bad of [NaN, -5, undefined, null]) {
      expect(registerViolation('hidden', bad as never).count).toBe(1)
    }
  })
})

describe('violationsRemaining', () => {
  it('counts down to zero and stops', () => {
    expect(violationsRemaining(0)).toBe(3)
    expect(violationsRemaining(1)).toBe(2)
    expect(violationsRemaining(3)).toBe(0)
    expect(violationsRemaining(9)).toBe(0)
  })

  it('handles malformed input', () => {
    expect(violationsRemaining(NaN as never)).toBe(DEFAULT_MAX_VIOLATIONS)
    expect(violationsRemaining(-2)).toBe(DEFAULT_MAX_VIOLATIONS)
  })
})

describe('constants', () => {
  it('gives blur a grace window long enough for assistive tech', () => {
    // A notification, on-screen keyboard or screen reader taking focus must
    // not cost a warning.
    expect(BLUR_GRACE_MS).toBeGreaterThanOrEqual(5000)
  })

  it('allows more than one violation by default', () => {
    expect(DEFAULT_MAX_VIOLATIONS).toBeGreaterThan(1)
  })
})
