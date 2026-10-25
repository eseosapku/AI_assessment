import { useEffect, useState } from 'react'
import type { Target, TargetAndTransition, Transition } from 'framer-motion'
import { prefersReducedMotion } from './activities/motion'

export { prefersReducedMotion }

/**
 * The lesson's motion vocabulary, in one place, so every card moves the same
 * way.
 *
 * Each preset is a state change of 150–300 ms that never blocks input: a badge
 * popping onto an answer, a new card rising into place, a tile stamping down.
 * Longer sequences (station complete, lesson complete) are built from these and
 * stay skippable. Every preset has a reduced-motion form that only fades, or
 * does nothing at all -- see `motionFor`.
 */
export interface MotionPreset {
  initial?: Target
  animate?: TargetAndTransition
  exit?: TargetAndTransition
  transition?: Transition
}

export const MOTION = {
  /** A badge or tick arriving. */
  pop: {
    initial: { scale: 0.6, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    exit: { scale: 0.6, opacity: 0 },
    transition: { type: 'spring', stiffness: 520, damping: 26, duration: 0.22 },
  },
  /** A new item entering the lesson. */
  rise: {
    initial: { y: 8, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: -4, opacity: 0 },
    transition: { duration: 0.2, ease: 'easeOut' },
  },
  /** A tile or card landing in its place. */
  settle: {
    initial: { scale: 1.08 },
    animate: { scale: 1 },
    transition: { duration: 0.25, ease: 'easeOut' },
  },
  /** A container whose children bounce in one after another. */
  stagger: {
    initial: { y: 0 },
    animate: { y: [0, -6, 0] },
    transition: { duration: 0.24, ease: 'easeOut', staggerChildren: 0.05 },
  },
  /** A wrong answer: a soft sway, never a violent shake. */
  shakeSoft: {
    initial: { x: 0 },
    animate: { x: [0, -6, 6, -4, 4, 0] },
    transition: { duration: 0.28, ease: 'easeOut' },
  },
  /** The ring around a part the tutor is pointing at. */
  glow: {
    initial: { opacity: 0, scale: 0.96 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.24, ease: 'easeOut' },
  },
  /** Everything outside the spotlight. */
  dim: {
    initial: { opacity: 1 },
    animate: { opacity: 0.35 },
    transition: { duration: 0.25, ease: 'easeOut' },
  },
  /** A progress chip lifting off towards the header. */
  fly: {
    initial: { y: 0, opacity: 1 },
    animate: { y: -24, opacity: 0 },
    transition: { duration: 0.3, ease: 'easeIn' },
  },
} satisfies Record<string, MotionPreset>

export type MotionName = keyof typeof MOTION

const TRANSFORM_KEYS = new Set(['x', 'y', 'scale', 'scaleX', 'scaleY', 'rotate'])

function stripTransforms<T extends Target | TargetAndTransition>(frame: T | undefined): T | undefined {
  if (!frame) return frame
  return Object.fromEntries(
    Object.entries(frame).filter(([key]) => !TRANSFORM_KEYS.has(key)),
  ) as T
}

/**
 * The preset to use. Under reduced motion it keeps only opacity changes, done
 * quickly; a preset that is nothing but movement (the sway, the bounce) becomes
 * no animation at all.
 */
export function motionFor(name: MotionName, reduced: boolean): MotionPreset {
  const preset: MotionPreset = MOTION[name]
  if (!reduced) return preset
  return {
    initial: stripTransforms(preset.initial),
    animate: stripTransforms(preset.animate),
    exit: stripTransforms(preset.exit),
    transition: { duration: 0.12 },
  }
}

/** Eased progress from `from` to `to`; `t` is clamped to 0..1. */
export function countUpValue(from: number, to: number, t: number): number {
  const p = Math.min(1, Math.max(0, t))
  const eased = 1 - (1 - p) ** 3
  return Math.round(from + (to - from) * eased)
}

/**
 * A number that counts up to `to` -- the minutes learned, the stations
 * mastered. Lands on `to` at once under reduced motion.
 */
export function useCountUp(to: number, opts: { from?: number; ms?: number } = {}): number {
  const from = opts.from ?? 0
  const ms = opts.ms ?? 900
  const [value, setValue] = useState(from)
  useEffect(() => {
    if (prefersReducedMotion() || typeof requestAnimationFrame !== 'function') {
      setValue(to)
      return
    }
    const start = performance.now()
    let frame = 0
    const step = (now: number) => {
      const t = (now - start) / ms
      setValue(countUpValue(from, to, t))
      if (t < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [from, to, ms])
  return value
}
