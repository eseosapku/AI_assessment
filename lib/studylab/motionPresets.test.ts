import { describe, it, expect } from 'vitest'
import { MOTION, motionFor, countUpValue, type MotionName } from './motionPresets'

const NAMES = Object.keys(MOTION) as MotionName[]

function totalSeconds(t: { duration?: number; delay?: number } | undefined): number {
  return (t?.duration ?? 0) + (t?.delay ?? 0)
}

describe('motion presets', () => {
  it('names the whole vocabulary', () => {
    expect(NAMES.sort()).toEqual(['dim', 'fly', 'glow', 'pop', 'rise', 'settle', 'shakeSoft', 'slide', 'stagger'])
  })

  it('slides a piece to its new place, and under reduced motion puts it there at once', () => {
    expect(MOTION.slide.transition.duration).toBe(0.28)
    expect(motionFor('slide', true).transition).toEqual({ duration: 0 })
  })

  it('keeps every state change within 300 ms', () => {
    for (const name of NAMES) {
      const t = MOTION[name].transition as { duration?: number; delay?: number } | undefined
      expect(totalSeconds(t), name).toBeLessThanOrEqual(0.3)
    }
  })

  it('never moves, scales or turns anything under reduced motion', () => {
    for (const name of NAMES) {
      const m = motionFor(name, true)
      for (const frame of [m.initial, m.animate, m.exit]) {
        if (!frame || typeof frame !== 'object') continue
        for (const key of ['x', 'y', 'scale', 'rotate', 'scaleY', 'scaleX']) {
          expect(frame, `${name}.${key}`).not.toHaveProperty(key)
        }
      }
      expect(totalSeconds(m.transition as { duration?: number; delay?: number }), name).toBeLessThanOrEqual(0.15)
    }
  })

  it('gives the full preset when motion is allowed', () => {
    expect(motionFor('pop', false)).toBe(MOTION.pop)
  })

  it('counts up from the start to the end with easing', () => {
    expect(countUpValue(0, 95, 0)).toBe(0)
    expect(countUpValue(0, 95, 1)).toBe(95)
    const mid = countUpValue(0, 95, 0.5)
    expect(mid).toBeGreaterThan(60)
    expect(mid).toBeLessThan(95)
    expect(Number.isInteger(mid)).toBe(true)
  })

  it('clamps progress outside 0..1', () => {
    expect(countUpValue(20, 95, -1)).toBe(20)
    expect(countUpValue(20, 95, 4)).toBe(95)
  })
})
