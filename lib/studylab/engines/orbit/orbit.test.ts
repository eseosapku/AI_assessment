// lib/studylab/engines/orbit/orbit.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import { orbitEngine, litFraction, phaseAt, PHASES } from './config'
import { getEngine } from '../registry'
import '..'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

/**
 * The Moon's phases, computed: the tutor names a phase, the engine lights the
 * half facing the Sun and draws what Earth sees. It replaces a slider whose
 * bar read 50% at every angle.
 */
describe('the Moon as the engine works it out', () => {
  it('is dark at new moon, full at full moon, half lit at both quarters', () => {
    expect(litFraction(0)).toBeCloseTo(0)
    expect(litFraction(180)).toBeCloseTo(1)
    expect(litFraction(90)).toBeCloseTo(0.5)
    expect(litFraction(270)).toBeCloseTo(0.5)
  })

  it('names the eight phases by 45-degree bands', () => {
    expect(phaseAt(0)).toBe('new')
    expect(phaseAt(22.4)).toBe('new')
    expect(phaseAt(22.6)).toBe('waxing-crescent')
    expect(phaseAt(90)).toBe('first-quarter')
    expect(phaseAt(180)).toBe('full')
    expect(phaseAt(270)).toBe('third-quarter')
    expect(phaseAt(350)).toBe('new')
    expect(PHASES).toHaveLength(8)
  })
})

describe('the orbit engine', () => {
  it('reads a phase however it is written, and nothing else', () => {
    expect(orbitEngine.parse({ task: { kind: 'make-phase', phase: 'First quarter' } })).toEqual({ task: { kind: 'make-phase', phase: 'first-quarter' } })
    expect(orbitEngine.parse({ task: { kind: 'make-phase', phase: 'waning-gibbous' } })).toEqual({ task: { kind: 'make-phase', phase: 'waning-gibbous' } })
    expect(orbitEngine.parse({ task: { kind: 'make-phase', phase: 'blue moon' } })).toBeNull()
    expect(orbitEngine.parse({ task: { kind: 'explore' } })).toEqual({ task: { kind: 'explore' } })
    expect(orbitEngine.parse(null)).toBeNull()
  })

  it('never starts where the asked phase already is', () => {
    for (const phase of PHASES) {
      const c = orbitEngine.parse({ task: { kind: 'make-phase', phase } })!
      expect(orbitEngine.check(c, orbitEngine.initial(c)).ok, phase).toBe(false)
      expect(orbitEngine.faults(c)).toEqual([])
    }
  })

  it('marks the Moon right within 15 degrees of the phase, across the new-moon wrap too', () => {
    const quarter = orbitEngine.parse({ task: { kind: 'make-phase', phase: 'first quarter' } })!
    expect(orbitEngine.check(quarter, { moon: 105 }).ok).toBe(true)
    expect(orbitEngine.check(quarter, { moon: 75 }).ok).toBe(true)
    expect(orbitEngine.check(quarter, { moon: 106 }).ok).toBe(false)
    expect(orbitEngine.check(quarter, { moon: 74 }).ok).toBe(false)
    const fresh = orbitEngine.parse({ task: { kind: 'make-phase', phase: 'new' } })!
    expect(orbitEngine.check(fresh, { moon: 345 }).ok).toBe(true)
    expect(orbitEngine.check(fresh, { moon: 344 }).ok).toBe(false)
  })

  it('can always be solved', () => {
    for (const phase of PHASES) {
      const c = orbitEngine.parse({ task: { kind: 'make-phase', phase } })!
      expect(orbitEngine.check(c, orbitEngine.solve(c)).ok, phase).toBe(true)
    }
    const explore = orbitEngine.parse({ task: { kind: 'explore' } })!
    expect(orbitEngine.check(explore, orbitEngine.initial(explore)).ok).toBe(false)
    expect(orbitEngine.check(explore, orbitEngine.solve(explore)).ok).toBe(true)
  })

  it('is registered for the tutor, with its config in its catalogue entry', () => {
    expect(getEngine('orbit')).toBe(orbitEngine)
    expect(orbitEngine.prompt).toMatch(/"engine":"orbit"/)
    expect(orbitEngine.prompt).toMatch(/first quarter/)
  })
})

describe('the orbit scene on the board', () => {
  const card = (config: unknown, prompt = 'Move the Moon to where we see a first quarter.') =>
    renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'orbit', config }, success: { kind: 'scene' } } },
    } as never)))

  it('draws the view from above and from Earth, with a Moon the keyboard can move', () => {
    const html = card({ task: { kind: 'make-phase', phase: 'first quarter' } })
    expect(html).toMatch(/role="slider"[^>]*aria-valuenow="\d+"/)
    expect(html).toMatch(/Seen from Earth/)
  })

  it('names no phase before the Moon is marked, beyond what the prompt asks', () => {
    const html = card({ task: { kind: 'make-phase', phase: 'first quarter' } })
    const shown = html.replace('Move the Moon to where we see a first quarter.', '')
    expect(shown.toLowerCase()).not.toMatch(/new moon|crescent|quarter|gibbous|full moon/)
  })
})
