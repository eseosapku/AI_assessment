// lib/studylab/engines/particles/particles.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import { particlesEngine, stateAt, meanSpeed, SUBSTANCES, range } from './config'
import { getEngine } from '../registry'
import { simulate, BOX } from './View'
import '..'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

/**
 * States of matter, computed from real melting and boiling points: the tutor
 * names a substance and a state, the engine draws its particles at the
 * temperature the learner sets and marks the state they reach.
 */
describe('a substance as the engine works it out', () => {
  it('is solid below its melting point, liquid up to its boiling point, gas above', () => {
    expect(stateAt('water', -5)).toBe('solid')
    expect(stateAt('water', 0)).toBe('liquid')
    expect(stateAt('water', 99)).toBe('liquid')
    expect(stateAt('water', 100)).toBe('gas')
    expect(stateAt('nitrogen', -200)).toBe('liquid')
    expect(stateAt('iron', 1000)).toBe('solid')
  })

  it('moves its particles faster as it warms, by the square root of absolute temperature', () => {
    expect(meanSpeed(-273.15)).toBeCloseTo(0)
    expect(meanSpeed(4 * 273.15 - 273.15) / meanSpeed(0)).toBeCloseTo(2)
  })
})

describe('the particles engine', () => {
  it('reads a substance and a state, and nothing it does not know', () => {
    expect(particlesEngine.parse({ substance: 'Water', task: { kind: 'make-state', state: 'Gas' } })).toEqual({ substance: 'water', task: { kind: 'make-state', state: 'gas' } })
    expect(particlesEngine.parse({ substance: 'unobtainium', task: { kind: 'make-state', state: 'gas' } })).toBeNull()
    expect(particlesEngine.parse({ substance: 'water', task: { kind: 'make-state', state: 'plasma' } })).toBeNull()
    expect(particlesEngine.parse({ substance: 'water', task: { kind: 'explore' } })).toEqual({ substance: 'water', task: { kind: 'explore' } })
  })

  it('never starts in the asked state, and every substance can reach every state within its range', () => {
    for (const substance of Object.keys(SUBSTANCES)) {
      for (const state of ['solid', 'liquid', 'gas'] as const) {
        const c = particlesEngine.parse({ substance, task: { kind: 'make-state', state } })!
        expect(particlesEngine.check(c, particlesEngine.initial(c)).ok, `${substance} ${state} start`).toBe(false)
        const solved = particlesEngine.solve(c)
        const [lo, hi] = range(substance as keyof typeof SUBSTANCES)
        expect(solved.temp).toBeGreaterThanOrEqual(lo)
        expect(solved.temp).toBeLessThanOrEqual(hi)
        expect(particlesEngine.check(c, solved).ok, `${substance} ${state} solve`).toBe(true)
        expect(particlesEngine.faults(c)).toEqual([])
      }
    }
  })

  it('is registered for the tutor, with its config in its catalogue entry', () => {
    expect(getEngine('particles')).toBe(particlesEngine)
    expect(particlesEngine.prompt).toMatch(/"engine":"particles"/)
  })
})

describe('the particle scene on the board', () => {
  const card = (config: unknown, prompt = 'Heat the wax until it is a liquid.') =>
    renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'particles', config }, success: { kind: 'scene' } } },
    } as never)))

  it('has a temperature the keyboard can set, and names no state before it is marked', () => {
    const html = card({ substance: 'wax', task: { kind: 'make-state', state: 'liquid' } })
    expect(html).toMatch(/type="range"/)
    expect(html).toMatch(/Temperature/)
    const shown = html.replace('Heat the wax until it is a liquid.', '')
    expect(shown.toLowerCase()).not.toMatch(/\b(solid|liquid|gas)\b/)
  })
})

describe('the box as it is drawn', () => {
  // The scene eval caught still frames with particles clipped by the box's
  // floor and piled over one another, where a liquid's particles touch and a
  // gas's are far apart.
  it('keeps every particle inside the box, clear of its edge, in every state', () => {
    for (const state of ['solid', 'liquid', 'gas'] as const) {
      for (const speed of [0, 0.5, 1]) {
        for (const p of simulate(state, speed, 120)) {
          expect(p.x - BOX.r).toBeGreaterThanOrEqual(BOX.inset - 1e-9)
          expect(p.y - BOX.r).toBeGreaterThanOrEqual(BOX.inset - 1e-9)
          expect(p.x + BOX.r).toBeLessThanOrEqual(BOX.w - BOX.inset + 1e-9)
          expect(p.y + BOX.r).toBeLessThanOrEqual(BOX.h - BOX.inset + 1e-9)
        }
      }
    }
  })

  it('never draws a liquid or a gas with one particle over another', () => {
    for (const state of ['liquid', 'gas'] as const) {
      for (const speed of [0, 0.5, 1]) {
        const ps = simulate(state, speed, 120)
        let closest = Infinity
        for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) closest = Math.min(closest, Math.hypot(ps[i].x - ps[j].x, ps[i].y - ps[j].y))
        // Touching, as a liquid's particles do; never more than a sliver over.
        expect(closest).toBeGreaterThanOrEqual(2 * BOX.r - 2)
      }
    }
  })
})
