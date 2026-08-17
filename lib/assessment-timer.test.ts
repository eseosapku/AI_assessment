import { describe, it, expect } from 'vitest'
import {
  timerPolicy,
  shouldWarn,
  extendRemaining,
  shouldAutoSubmit,
  formatRemaining,
  describeRemaining,
  WARN_AT_SECONDS,
  EXTENSION_SECONDS,
} from './assessment-timer'

describe('timerPolicy', () => {
  it('lets a student adjust their own practice quiz', () => {
    expect(timerPolicy(false)).toEqual({ canExtend: true, canDisable: true })
  })

  it('keeps a teacher-set limit fixed', () => {
    // Timing is part of the task there, which is WCAG's "essential" exception.
    expect(timerPolicy(true)).toEqual({ canExtend: false, canDisable: false })
  })
})

describe('shouldWarn', () => {
  it('warns inside the threshold', () => {
    expect(shouldWarn(WARN_AT_SECONDS, false)).toBe(true)
    expect(shouldWarn(30, false)).toBe(true)
  })

  it('stays quiet outside it', () => {
    expect(shouldWarn(WARN_AT_SECONDS + 1, false)).toBe(false)
  })

  it('never warns once the limit is off', () => {
    expect(shouldWarn(5, true)).toBe(false)
  })

  it('stops warning at zero, where the submit decision takes over', () => {
    expect(shouldWarn(0, false)).toBe(false)
    expect(shouldWarn(-10, false)).toBe(false)
  })

  it('gives well over the 20 seconds WCAG requires to react', () => {
    expect(WARN_AT_SECONDS).toBeGreaterThanOrEqual(20)
  })

  it('handles non-finite input', () => {
    expect(shouldWarn(NaN, false)).toBe(false)
    expect(shouldWarn(Infinity, false)).toBe(false)
  })
})

describe('extendRemaining', () => {
  it('adds the default step', () => {
    expect(extendRemaining(60)).toBe(60 + EXTENSION_SECONDS)
  })

  it('can be extended repeatedly', () => {
    // WCAG asks for at least ten extensions; nothing here caps it.
    let t = 30
    for (let i = 0; i < 12; i++) t = extendRemaining(t)
    expect(t).toBe(30 + 12 * EXTENSION_SECONDS)
  })

  it('recovers from a spent or malformed clock', () => {
    expect(extendRemaining(0)).toBe(EXTENSION_SECONDS)
    expect(extendRemaining(-5)).toBe(EXTENSION_SECONDS)
    expect(extendRemaining(NaN)).toBe(EXTENSION_SECONDS)
  })

  it('ignores a nonsense step size', () => {
    expect(extendRemaining(10, -1)).toBe(10 + EXTENSION_SECONDS)
    expect(extendRemaining(10, NaN)).toBe(10 + EXTENSION_SECONDS)
  })
})

describe('shouldAutoSubmit', () => {
  it('submits at zero', () => {
    expect(shouldAutoSubmit(0, false)).toBe(true)
    expect(shouldAutoSubmit(-1, false)).toBe(true)
  })

  it('does not submit while time remains', () => {
    expect(shouldAutoSubmit(1, false)).toBe(false)
  })

  it('never submits when the limit is off, whatever the clock says', () => {
    // The one rule that must not be forgotten at the call site.
    expect(shouldAutoSubmit(0, true)).toBe(false)
    expect(shouldAutoSubmit(-999, true)).toBe(false)
  })
})

describe('formatRemaining', () => {
  it('formats mm:ss', () => {
    expect(formatRemaining(125)).toBe('2:05')
    expect(formatRemaining(59)).toBe('0:59')
  })

  it('grows to h:mm:ss past an hour', () => {
    expect(formatRemaining(3661)).toBe('1:01:01')
  })

  it('floors at zero', () => {
    expect(formatRemaining(-5)).toBe('0:00')
    expect(formatRemaining(NaN)).toBe('0:00')
  })
})

describe('describeRemaining', () => {
  it('speaks the time rather than showing a colon', () => {
    expect(describeRemaining(125)).toBe('2 minutes 5 seconds remaining')
    expect(describeRemaining(60)).toBe('1 minute remaining')
    expect(describeRemaining(1)).toBe('1 second remaining')
  })

  it('says zero rather than nothing', () => {
    expect(describeRemaining(0)).toBe('0 seconds remaining')
  })
})
