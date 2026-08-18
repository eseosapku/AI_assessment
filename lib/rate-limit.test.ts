import { describe, it, expect, beforeEach } from 'vitest'
import { checkRateLimit, identify, __resetRateLimits, RATE_LIMITS } from './rate-limit'

beforeEach(() => __resetRateLimits())

describe('checkRateLimit', () => {
  it('allows requests up to the limit and refuses the next', () => {
    const rule = RATE_LIMITS['generate-assessment']
    for (let i = 0; i < rule.limit; i++) {
      expect(checkRateLimit('generate-assessment', 'u:1').allowed, `request ${i + 1}`).toBe(true)
    }
    expect(checkRateLimit('generate-assessment', 'u:1').allowed).toBe(false)
  })

  it('counts down the remaining allowance', () => {
    const rule = RATE_LIMITS['generate-assessment']
    expect(checkRateLimit('generate-assessment', 'u:1').remaining).toBe(rule.limit - 1)
    expect(checkRateLimit('generate-assessment', 'u:1').remaining).toBe(rule.limit - 2)
  })

  it('keeps identities apart, so one user cannot exhaust another', () => {
    const rule = RATE_LIMITS['generate-assessment']
    for (let i = 0; i < rule.limit; i++) checkRateLimit('generate-assessment', 'u:1')
    expect(checkRateLimit('generate-assessment', 'u:1').allowed).toBe(false)
    expect(checkRateLimit('generate-assessment', 'u:2').allowed).toBe(true)
  })

  it('keeps actions apart, so generating does not throttle tutoring', () => {
    const rule = RATE_LIMITS['generate-assessment']
    for (let i = 0; i <= rule.limit; i++) checkRateLimit('generate-assessment', 'u:1')
    expect(checkRateLimit('studylab-tutor', 'u:1').allowed).toBe(true)
  })

  it('reopens once the window passes', () => {
    const rule = RATE_LIMITS['generate-assessment']
    const start = 1_000_000
    for (let i = 0; i <= rule.limit; i++) checkRateLimit('generate-assessment', 'u:1', start)
    expect(checkRateLimit('generate-assessment', 'u:1', start).allowed).toBe(false)
    expect(checkRateLimit('generate-assessment', 'u:1', start + rule.windowMs + 1).allowed).toBe(true)
  })

  it('reports a usable Retry-After', () => {
    const rule = RATE_LIMITS['generate-assessment']
    const start = 1_000_000
    for (let i = 0; i <= rule.limit; i++) checkRateLimit('generate-assessment', 'u:1', start)
    const res = checkRateLimit('generate-assessment', 'u:1', start + 60_000)
    expect(res.allowed).toBe(false)
    expect(res.retryAfterSeconds).toBeGreaterThan(0)
    expect(res.retryAfterSeconds).toBeLessThanOrEqual(rule.windowMs / 1000)
  })

  it('falls back to a default for an unknown action', () => {
    expect(checkRateLimit('something-new', 'u:1').allowed).toBe(true)
  })

  it('does not resolve prototype keys as rules', () => {
    // A caller-supplied action must not reach Object.prototype.
    expect(checkRateLimit('constructor', 'u:1').allowed).toBe(true)
    expect(checkRateLimit('__proto__', 'u:1').allowed).toBe(true)
  })

  it('is generous enough not to interrupt real study', () => {
    // This exists to stop runaway loops, not to ration normal use.
    expect(RATE_LIMITS['generate-assessment'].limit).toBeGreaterThanOrEqual(20)
    expect(RATE_LIMITS['studylab-tutor'].limit).toBeGreaterThanOrEqual(100)
  })
})

describe('identify', () => {
  const h = (init: Record<string, string>) => new Headers(init)

  it('prefers the signed-in user, so a shared school connection is not throttled as one', () => {
    expect(identify('abc', h({ 'x-forwarded-for': '1.2.3.4' }))).toBe('u:abc')
  })

  it('falls back to the forwarded IP', () => {
    expect(identify(null, h({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }))).toBe('ip:1.2.3.4')
    expect(identify('', h({ 'x-real-ip': '9.9.9.9' }))).toBe('ip:9.9.9.9')
  })

  it('still returns a key when nothing identifies the caller', () => {
    expect(identify(undefined, h({}))).toBe('ip:unknown')
  })
})
