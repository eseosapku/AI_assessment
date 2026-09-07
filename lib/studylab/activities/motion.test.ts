import { describe, it, expect, afterEach, vi } from 'vitest'
import { prefersReducedMotion, shakeElement } from './motion'

afterEach(() => {
  // @ts-expect-error test-only global patch — restore the node test runner's
  // windowless environment between cases.
  delete globalThis.window
})

describe('prefersReducedMotion', () => {
  it('is false when there is no window (SSR / the node test runner)', () => {
    expect(prefersReducedMotion()).toBe(false)
  })

  it('reflects a matching media query', () => {
    // @ts-expect-error test-only global patch
    globalThis.window = { matchMedia: () => ({ matches: true }) }
    expect(prefersReducedMotion()).toBe(true)
  })

  it('is false when the media query does not match', () => {
    // @ts-expect-error test-only global patch
    globalThis.window = { matchMedia: () => ({ matches: false }) }
    expect(prefersReducedMotion()).toBe(false)
  })
})

describe('shakeElement', () => {
  it('does nothing when there is no element to animate', () => {
    expect(() => shakeElement(null, [{ transform: 'translateX(0)' }])).not.toThrow()
  })

  it('plays the animation when motion is not reduced', () => {
    const animate = vi.fn()
    shakeElement({ animate } as unknown as Element, [{ transform: 'translateX(0)' }])
    expect(animate).toHaveBeenCalledTimes(1)
  })

  it('skips the animation when the user prefers reduced motion', () => {
    // @ts-expect-error test-only global patch
    globalThis.window = { matchMedia: () => ({ matches: true }) }
    const animate = vi.fn()
    shakeElement({ animate } as unknown as Element, [{ transform: 'translateX(0)' }])
    expect(animate).not.toHaveBeenCalled()
  })
})
