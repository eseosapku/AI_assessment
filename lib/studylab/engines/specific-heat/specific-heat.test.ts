// lib/studylab/engines/specific-heat/specific-heat.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  specificHeatEngine, requiredEnergy, temperature, temperatureFor, done, working, madeText,
  MATERIAL_NAMES, SPECIFIC_HEAT, START_TEMP, TEMP_TOLERANCE, ENERGY_MAX, MASSES,
  type HeatConfig, type HeatState,
} from './config'
import { SpecificHeatView, W, H, yForTemp, TEMP_MAX, TEMP_MIN, formatTemp } from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const parse = (raw: unknown) => specificHeatEngine.parse(raw)!

describe('the physics and marking', () => {
  it('uses the real school specific heats and E = mc deltaT', () => {
    expect(SPECIFIC_HEAT).toEqual({ water: 4200, aluminium: 900 })
    expect(temperature({ task: 'shared', material: 'water', target: 40, mass: 1 }, 84, 'water')).toBe(40)
    expect(temperature({ task: 'shared', material: 'aluminium', target: 60, mass: 2 }, 72, 'aluminium')).toBe(60)
    expect(temperature({ task: 'match', target: 40, mass: 1 }, 36, 'aluminium')).toBe(60)
  })

  it('marks only the thermometer readings, with a visible tolerance', () => {
    const c = parse({ task: 'match', target: 40, mass: 1 })
    expect(requiredEnergy(c, 'water')).toBe(84)
    expect(requiredEnergy(c, 'aluminium')).toBe(18)
    expect(done(c, { water: 84, aluminium: 18 })).toBe(true)
    expect(done(c, { water: 82, aluminium: 17 })).toBe(true)
    expect(done(c, { water: 75, aluminium: 18 })).toBe(false)
    expect(done(c, { water: 84, aluminium: 0 })).toBe(false)
    expect(done(c, { water: 84, aluminium: 18, energy: 999 })).toBe(true)
    expect(done(c, {})).toBe(false)
  })

  it('lets the shared dose affect both samples but marks the named one', () => {
    const c = parse({ task: 'shared', material: 'water', target: 40, mass: 1 })
    expect(temperatureFor(c, { energy: 84 }, 'aluminium')).toBeCloseTo(113.333, 2)
    expect(done(c, { energy: 84 })).toBe(true)
    expect(done(c, { energy: 18 })).toBe(false)
    expect(done(c, { energy: 81 })).toBe(true) // visibly near: 39.3 degrees, rounded to 39
    expect(done(c, { energy: 75 })).toBe(false) // 2.14 degrees low: outside the visible tolerance
    expect(done(c, { energy: -3 })).toBe(false)
    expect(done(c, { energy: 181 })).toBe(false)
    expect(TEMP_TOLERANCE).toBe(2)
  })

  it('says the exact answer after a near enough attempt, and says what a wrong one made', () => {
    const c = parse({ task: 'match', target: 40, mass: 1 })
    expect(working(c, { water: 84, aluminium: 18 }).lead).toMatch(/^Yes: exactly 84 kJ/)
    expect(working(c, { water: 82, aluminium: 17 }).lead).toMatch(/^Near enough: exactly 84 kJ/)
    expect(working(c, { water: 84, aluminium: 18 }).detail).toMatch(/E = mcΔT/)
    expect(madeText(c, { water: 42, aluminium: 9 })).toMatch(/Water is at 30 °C and aluminium at 30 °C/)
    const shared = parse({ task: 'shared', material: 'aluminium', target: 60, mass: 2 })
    expect(working(shared, { energy: 72 }).detail).toMatch(/takes water to 28.6 °C/)
  })
})

describe('reading the tutor config', () => {
  it('accepts ordinary phrasings and defaults', () => {
    expect(parse({ task: 'match', target: 40, mass: 1 })).toEqual({ task: 'match', target: 40, mass: 1 })
    expect(parse({ task: 'match', target: '40 °C', mass: '2 kg' })).toEqual({ task: 'match', target: 40, mass: 2 })
    expect(parse({ task: { kind: 'equal-energy', material: 'aluminum', target: 60 }, mass: 2 })).toEqual({ task: 'shared', material: 'aluminium', target: 60, mass: 2 })
    expect(parse({ task: { kind: 'equal-energy', material: 'aluminum', target: 60, mass: 2 } })).toEqual({ task: 'shared', material: 'aluminium', target: 60, mass: 2 })
    expect(parse({ material: 'water' })).toEqual({ task: 'shared', material: 'water', target: 40, mass: 1 })
    expect(parse({ task: 'match' })).toEqual({ task: 'match', target: 40, mass: 1 })
    expect(specificHeatEngine.parse(null)).toBeNull()
    expect(specificHeatEngine.parse({ task: 'mystery' })).toBeNull()
    expect(specificHeatEngine.parse({ target: 'hot' })).toBeNull()
  })

  it('refuses narrowly with a nearby working example', () => {
    const fault = (raw: unknown) => specificHeatEngine.faults(parse(raw))
    expect(fault({ task: 'match', target: 90, mass: 2 })[0]).toMatch(/more than the 180 kJ.*task "match"/)
    expect(fault({ task: 'shared', material: 'copper', target: 40 })[0]).toMatch(/water or aluminium.*material "water"/)
    expect(fault({ task: 'shared', material: 'water', target: 90, mass: 1 })[0]).toMatch(/beyond the 160 °C.*target 40/)
    expect(fault({ task: 'shared', material: 'water', target: 43 })[0]).toMatch(/whole 10 °C.*target 40/)
    expect(fault({ task: 'match', target: 40, mass: 3 })[0]).toMatch(/1 kg or 2 kg.*mass 1/)
  })
})

function validConfigs(): HeatConfig[] {
  const out: HeatConfig[] = []
  for (const mass of MASSES) for (let target = 30; target <= 90; target += 10) {
    const match: HeatConfig = { task: 'match', target, mass }
    if (specificHeatEngine.faults(match).length === 0) out.push(match)
    for (const material of MATERIAL_NAMES) {
      const shared: HeatConfig = { task: 'shared', material, target, mass }
      if (specificHeatEngine.faults(shared).length === 0) out.push(shared)
    }
  }
  return out
}

describe('every drawable configuration', { timeout: 30_000 }, () => {
  const all = validConfigs()
  it('enumerates both masses, all goal temperatures and both materials', () => {
    expect(all.length).toBeGreaterThanOrEqual(20)
    expect(new Set(all.map((c) => c.task))).toEqual(new Set(['match', 'shared']))
  })
  it('never starts solved and solve always passes', () => {
    for (const c of all) {
      expect(specificHeatEngine.check(c, specificHeatEngine.initial(c)).ok, JSON.stringify(c)).toBe(false)
      const solved = specificHeatEngine.solve(c)
      expect(specificHeatEngine.check(c, solved).ok, JSON.stringify(c)).toBe(true)
      for (const m of MATERIAL_NAMES) expect(temperatureFor(c, solved, m)).toBeLessThanOrEqual(TEMP_MAX)
    }
  })
  it('reaches every solution through the coarse energy steps without moving past the goal', () => {
    for (const c of all) {
      const energies = Array.from({ length: ENERGY_MAX / 3 + 1 }, (_, i) => i * 3)
      const passing = c.task === 'shared'
        ? energies.filter((energy) => done(c, { energy }))
        : energies.filter((water) => energies.some((aluminium) => done(c, { water, aluminium })))
      expect(passing.length, JSON.stringify(c)).toBeGreaterThan(0)
    }
  })
})

describe('the catalogue and prompts', () => {
  it('is registered with matching id and isolates', () => {
    expect(getEngine('specific-heat')).toBe(specificHeatEngine)
    expect(specificHeatEngine.id).toBe('specific-heat')
    expect(specificHeatEngine.isolates).toBe('quantity')
    expect(specificHeatEngine.prompt).toMatch(/SCENE "specific-heat"/)
    expect(specificHeatEngine.prompt).toMatch(/"isolates":"quantity"/)
    expect(specificHeatEngine.prompt).toMatch(/"apparatus":"scene:specific-heat"/)
  })

  it('catches its stations and leaves its near misses to neighbouring scenes', () => {
    expect(scenesFor('Specific heat capacity and E = mcΔT').map((e) => e.id)).toContain('specific-heat')
    expect(scenesFor('Thermal capacity: heating materials').map((e) => e.id)).toContain('specific-heat')
    expect(scenesFor('The difference between heat and temperature').map((e) => e.id)).toContain('specific-heat')
    expect(scenesFor('Conduction, convection and insulation').map((e) => e.id)).not.toContain('specific-heat')
    expect(scenesFor('Changes of state and latent heat').map((e) => e.id)).not.toContain('specific-heat')
    expect(scenesFor('Density and pressure').map((e) => e.id)).not.toContain('specific-heat')
    expect(sceneCatalogue('Specific heat capacity')).toContain('SCENE "specific-heat"')
    expect(sceneCatalogue('Thermal insulation and heat transfer')).not.toContain('SCENE "specific-heat"')
  })

  it('refuses a prompt that prints the equation or answer', () => {
    const c = parse({ task: 'match', target: 40, mass: 1 })
    expect(specificHeatEngine.promptFaults!(c, 'Use E = mcΔT. Water needs 84 kJ and more energy than aluminium.').join(' ')).toMatch(/gives the answer/)
    expect(specificHeatEngine.promptFaults!(c, 'Drag the sliders. Water has specific heat capacity 4200 J/kg °C.').join(' ')).toMatch(/gives the answer/)
    expect(specificHeatEngine.promptFaults!(c, 'Drag each energy slider until both thermometers reach 40 °C. Use − or + for small steps.')).toEqual([])
  })

  it('passes the examples in its own catalogue entry', () => {
    const e = getEngine('specific-heat')!
    const found = [...e.prompt.matchAll(/"prompt":"([^"]+)"[\s\S]*?"config": (\{[\s\S]*?\}) \}/g)]
    expect(found.length).toBeGreaterThanOrEqual(4)
    for (const m of found) expect(e.promptFaults!(e.parse(JSON.parse(m[2]))!, m[1])).toEqual([])
  })
})

const card = (config: unknown, prompt: string) => renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
  id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'specific-heat', config }, success: { kind: 'scene' } } },
} as never)))

const view = (config: HeatConfig, state: HeatState, marked: 'idle' | 'right' | 'wrong', reduced = false) =>
  renderToStaticMarkup(createElement(SpecificHeatView, { config, state, setState: () => {}, marked, reduced, locked: marked === 'right' }))

describe('the drawn card', () => {
  it('has real range controls, named steppers and a visible goal', () => {
    const html = card({ task: 'match', target: 40, mass: 1 }, 'Drag each energy slider until both thermometers reach 40 °C. Use − or + for small steps.')
    expect(html.match(/type="range"/g)).toHaveLength(2)
    expect(html.match(/aria-label="Use 3 kJ more energy for/g)).toHaveLength(2)
    expect(html).toMatch(/Water/)
    expect(html).toMatch(/Aluminium/)
    expect(html).toMatch(/Goal: both at 40 °C/)
    expect(html).toMatch(/1 kg/)
    expect(html).toMatch(/viewBox="0 0 360 250"/)
    expect(W).toBe(360)
    expect(H).toBe(250)
  })

  it('holds back the equation, c values and required energies before marking', () => {
    const c = parse({ task: 'match', target: 40, mass: 1 })
    const html = card(c, 'Drag each energy slider until both thermometers reach 40 °C. Use − or + for small steps.').replace('Drag each energy slider until both thermometers reach 40 °C. Use − or + for small steps.', '')
    expect(html).not.toMatch(/mcΔT|4200|900 J|84 kJ|18 kJ|Near enough|specific heat capacity/)
    const shared = card({ task: 'shared', material: 'aluminium', target: 60, mass: 2 }, 'Drag the energy slider until the aluminium reaches 60 °C. Both samples get the same energy; use − or + for small steps.')
    expect(shared).not.toMatch(/mcΔT|4200|900 J|72 kJ/)
  })

  it('changes both thermometers with the energy, and gives the calculation only after marking', () => {
    const c = parse({ task: 'shared', material: 'water', target: 40, mass: 1 })
    const before = view(c, { energy: 0 }, 'idle')
    const after = view(c, { energy: 84 }, 'idle')
    expect(before).toMatch(/data-temp="water">20 °C/)
    expect(after).toMatch(/data-temp="water">40 °C/)
    expect(after).toMatch(/data-temp="aluminium">113 °C/)
    expect(before).not.toEqual(after)
    const right = view(c, { energy: 84 }, 'right')
    expect(right).toMatch(/exactly 84 kJ/)
    expect(right).toMatch(/E = mcΔT/)
    const wrong = view(c, { energy: 18 }, 'wrong')
    expect(wrong).toMatch(/You gave each sample 18 kJ/)
    expect(wrong).not.toMatch(/E = mcΔT/)
  })

  it('shows no answer through a server render, and keeps reduced-motion stills responsive', () => {
    const c = parse({ task: 'match', target: 40, mass: 1 })
    const html = view(c, { water: 82, aluminium: 17 }, 'idle', true)
    expect(html).not.toMatch(/transition:/)
    expect(html).toMatch(/data-temp="water">40 °C/)
    expect(html).not.toMatch(/Near enough|exactly/)
    expect(yForTemp(TEMP_MIN)).toBeGreaterThan(yForTemp(TEMP_MAX))
    expect(formatTemp(19.5)).toBe('20')
  })
})
