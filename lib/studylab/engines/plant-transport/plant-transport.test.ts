// lib/studylab/engines/plant-transport/plant-transport.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  FACTORS, LEVELS, MATCH_TOLERANCE, baseOf, done, factorOf, goodPrompt, levelOf, madeText,
  nearestLevel, neededLevel, plantTransportEngine, rateAt, valueText, working,
  type PlantConfig,
} from './config'
import { PlantTransportView, bubbleX, streamPoint } from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const parse = (raw: unknown) => plantTransportEngine.parse(raw)

/** Every config that parse accepts and faults approves: all four factors, all exact match rates,
 * 0.05 either side of them, and every reachable limit from just above room conditions upwards. */
function everyValidConfig(): PlantConfig[] {
  const out: PlantConfig[] = []
  for (const factor of FACTORS) {
    for (const { rate } of LEVELS[factor]) {
      for (const target of [rate, Math.max(0.01, rate - 0.05), rate + 0.05]) {
        const c = parse({ task: 'match', factor, target })!
        if (plantTransportEngine.faults(c).length === 0) out.push(c)
      }
    }
    const base = LEVELS[factor][baseOf({ task: 'limit', factor, target: 1 })].rate
    const highest = Math.max(...LEVELS[factor].map((l) => l.rate))
    for (let target = Math.ceil((base + 0.05) * 20) / 20; target <= highest + 1e-9; target += 0.05) {
      const c = parse({ task: 'limit', factor, target: Number(target.toFixed(2)) })!
      if (plantTransportEngine.faults(c).length === 0) out.push(c)
    }
  }
  return out
}

describe('the water-uptake model and marking', () => {
  it('uses the syllabus direction for every environmental factor', () => {
    expect(LEVELS.wind.map((l) => l.rate)).toEqual([0.55, 0.75, 1, 1.3, 1.6])
    expect(LEVELS.temperature.map((l) => l.rate)).toEqual([0.35, 0.48, 0.65, 0.95, 1.25, 1.55, 1.9])
    expect(LEVELS.light.map((l) => l.rate)).toEqual([0.15, 0.45, 0.7, 0.95, 1.25])
    expect(LEVELS.humidity.map((l) => l.rate)).toEqual([1.5, 1, 0.75, 0.5, 0.3])
  })

  it('accepts a visible near match and gives the exact aim in the marked sentence', () => {
    const c = parse({ task: 'match', factor: 'temperature', target: 1 })!
    const level = nearestLevel(c)
    expect(rateAt(c, level)).toBe(0.95)
    expect(Math.abs(rateAt(c, level) - c.target)).toBeLessThanOrEqual(MATCH_TOLERANCE)
    expect(done(c, { level })).toBe(true)
    expect(working(c, { level })).toContain('Near enough')
    expect(working(c, { level })).toContain('the exact aim is 1.00 mm/min')
  })

  it('requires the least departure from room conditions for a limit task', () => {
    const c = parse({ task: 'limit', factor: 'temperature', target: 1.2 })!
    const need = neededLevel(c)
    expect(valueText(c, need)).toBe('30 °C')
    expect(done(c, { level: need })).toBe(true)
    expect(done(c, { level: need + 1 })).toBe(false)
    expect(done(c, { level: need - 1 })).toBe(false)
    expect(madeText(c, { level: need + 1 })).toContain('smaller change')
  })

  it('never marks unreadable stored work right', () => {
    const c = parse({ task: 'match', factor: 'wind', target: 1 })!
    for (const state of [{}, { level: -1 }, { level: 99 }, { level: 1.5 }, { level: NaN }, null]) {
      expect(plantTransportEngine.check(c, state as never).ok).toBe(false)
    }
  })
})

describe('reading what the tutor wrote', () => {
  it('reads broad task and factor phrasings, including nested tasks and units', () => {
    expect(parse({ task: 'potometer', factor: 'air movement', target: '1 mm/min' })).toEqual({ task: 'match', factor: 'wind', target: 1 })
    expect(parse({ task: { kind: 'factors affecting transpiration', factor: 'heater', target: '1.2 mm per min' } })).toEqual({ task: 'limit', factor: 'temperature', target: 1.2 })
    expect(parse({ factor: 'relative humidity' })).toEqual({ task: 'match', factor: 'humidity', target: 1 })
    expect(parse({ task: 'minimum change', factor: 'lamp' })).toEqual({ task: 'limit', factor: 'light', target: 1.2 })
    expect(parse(null)).toBeNull()
    expect(parse({ task: 'photosynthesis', factor: 'light' })).toBeNull()
    expect(parse({ task: 'match', factor: 3 })).toBeNull()
    expect(parse({ task: 'match', target: 'fast' })).toBeNull()
  })

  it('refuses narrowly, with a nearby target that works', () => {
    expect(plantTransportEngine.faults(parse({ task: 'match', factor: 'wind', target: 1 })!)).toEqual([])
    expect(plantTransportEngine.faults(parse({ task: 'match', factor: 'soil', target: 1 })!)[0]).toContain('factor "wind"')
    expect(plantTransportEngine.faults(parse({ task: 'match', factor: 'wind', target: 0.86 })!)[0]).toContain('target 1')
    expect(plantTransportEngine.faults(parse({ task: 'limit', factor: 'wind', target: 0.5 })!)[0]).toContain('already true')
    expect(plantTransportEngine.faults(parse({ task: 'limit', factor: 'wind', target: 9 })!)[0]).toContain('beyond')
  })

  it('is offered to plant-transport stations, not its near neighbours', () => {
    expect(scenesFor('Transport in plants: xylem and phloem').map((e) => e.id)).toContain('plant-transport')
    expect(scenesFor('Transpiration and the potometer').map((e) => e.id)).toContain('plant-transport')
    expect(scenesFor('Water uptake by roots and root hair cells').map((e) => e.id)).toContain('plant-transport')
    expect(scenesFor('The water cycle: evaporation and condensation').map((e) => e.id)).not.toContain('plant-transport')
    expect(scenesFor('Photosynthesis and its limiting factors').map((e) => e.id)).not.toContain('plant-transport')
    expect(scenesFor('Circulation of blood in humans').map((e) => e.id)).not.toContain('plant-transport')
    expect(sceneCatalogue('Osmosis in single cells')).not.toContain('SCENE "plant-transport"')
  })
})

describe('every valid configuration', { timeout: 30_000 }, () => {
  const all = everyValidConfig()

  it('enumerates a substantial set of both task kinds', () => {
    expect(all.length).toBeGreaterThan(130)
    expect(new Set(all.map((c) => c.task))).toEqual(new Set(['match', 'limit']))
    expect(new Set(all.map((c) => factorOf(c)))).toEqual(new Set(FACTORS))
  })

  it('starts unsolved, solves by real rules, and every solution is a level the stepper can reach', () => {
    for (const c of all) {
      const start = plantTransportEngine.initial(c)
      const answer = plantTransportEngine.solve(c)
      expect(plantTransportEngine.faults(c), JSON.stringify(c)).toEqual([])
      expect(plantTransportEngine.check(c, start).ok, `starts solved: ${JSON.stringify(c)}`).toBe(false)
      expect(plantTransportEngine.check(c, answer), `cannot solve: ${JSON.stringify(c)}`).toEqual({ ok: true, wrongIds: [] })
      expect(levelOf(c, answer)).toBeGreaterThanOrEqual(0)
      expect(levelOf(c, answer)).toBeLessThan(LEVELS[factorOf(c)].length)
      if (c.task === 'limit') {
        const distance = Math.abs(levelOf(c, answer) - baseOf(c))
        for (let level = 0; level < LEVELS[factorOf(c)].length; level++) {
          if (Math.abs(level - baseOf(c)) < distance) expect(done(c, { level })).toBe(false)
        }
      }
    }
  })
})

describe('the card and what it says', () => {
  const c = parse({ task: 'match', factor: 'wind', target: 1 })!
  const render = (config: PlantConfig, state: unknown, marked: 'idle' | 'right' | 'wrong' | 'shown', reduced = false) =>
    renderToStaticMarkup(createElement(PlantTransportView, { config, state: state as { level?: number }, setState: () => {}, marked, reduced, locked: marked === 'right' }))

  it('names the control, live measure and goal, with real accessible buttons', () => {
    const html = render(c, { level: 0 }, 'idle')
    expect(html).toContain('Wind speed')
    expect(html).toContain('Water uptake')
    expect(html).toContain('Aim 1.00 ± 0.10 mm/min')
    expect(html).toContain('aria-label="Increase wind speed"')
    expect(html).toContain('role="spinbutton"')
    expect(html).toContain('The bubble measures water uptake')
    expect(html).not.toContain('transpiration pull')
    expect(html).not.toContain('cohesion')
    expect(html).not.toContain('stomata')
  })

  it('changes its still drawing with one step, including under reduced motion', () => {
    const a = render(c, { level: 0 }, 'idle', true)
    const b = render(c, { level: 1 }, 'idle', true)
    expect(a).not.toBe(b)
    expect(a).toContain('0 <span')
    expect(b).toContain('1 <span')
    expect(b).toContain('0.75')
  })

  it('says what was made when wrong and the mechanism only after marking', () => {
    expect(render(c, { level: 0 }, 'wrong')).toContain('You set 0 m/s')
    const right = render(c, plantTransportEngine.solve(c), 'right')
    expect(right).toContain('Transpiration pull')
    expect(right).toContain('cohesion')
    expect(right).toContain('measures water uptake')
  })

  it('keeps every part of the water route and the bubble inside the picture', () => {
    for (let t = 0; t <= 1; t += 0.01) {
      const p = streamPoint(t)
      expect(p.x).toBeGreaterThan(0)
      expect(p.x).toBeLessThan(360)
      expect(p.y).toBeGreaterThan(0)
      expect(p.y).toBeLessThan(250)
    }
    expect(bubbleX(0)).toBe(264)
    expect(bubbleX(0.999)).toBeLessThan(348)
  })

  it('renders on the board without answer mechanism text before marking', () => {
    const html = renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1',
      data: { spec: { pattern: 'scene', prompt: goodPrompt(c), payload: { engine: 'plant-transport', config: c }, success: { kind: 'scene' } } },
    } as never)))
    const scene = html.replace(goodPrompt(c), '')
    expect(scene).toContain('Water uptake')
    expect(scene).not.toContain('transpiration pull')
    expect(scene).not.toContain('cohesion')
    expect(scene).not.toContain('stomata')
  })
})

describe('the prompt written above the card', () => {
  const faults = (c: PlantConfig, prompt: string) => plantTransportEngine.promptFaults!(c, prompt)

  it('allows the outcome and gesture, not the setting, direction, count or explanation', () => {
    const c = parse({ task: 'limit', factor: 'temperature', target: 1.2 })!
    expect(faults(c, goodPrompt(c))).toEqual([])
    expect(faults(c, 'Set it to 30 °C.').join(' ')).toContain('gives the answer away')
    expect(faults(c, 'Increase the temperature until it works.').join(' ')).toContain('gives the answer away')
    expect(faults(c, 'Take three steps because stomata open.').join(' ')).toContain('gives the answer away')
    expect(faults(c, 'Drag the slider and time the bubble.').join(' ')).toContain('does not show')
    expect(faults(c, 'Change the wind to reach the target.').join(' ')).toContain('this card changes temperature')
  })

  it('passes the examples in its own catalogue entry', () => {
    const e = getEngine('plant-transport')!
    const found = [...e.prompt.matchAll(/"prompt":"([^"]+)"[\s\S]*?"config": (\{[^\n]*\}) \}/g)]
    expect(found).toHaveLength(4)
    for (const m of found) {
      const c = e.parse(JSON.parse(m[2]))!
      expect(e.faults(c)).toEqual([])
      expect(e.check(c, e.initial(c)).ok).toBe(false)
      expect(e.check(c, e.solve(c)).ok).toBe(true)
      expect(e.promptFaults!(c, m[1])).toEqual([])
    }
  })

  it('is registered with the id and isolates its examples use', () => {
    expect(getEngine('plant-transport')).toBe(plantTransportEngine)
    expect(plantTransportEngine.id).toBe('plant-transport')
    expect(plantTransportEngine.isolates).toBe('magnitude')
    expect(plantTransportEngine.prompt).toContain('"apparatus":"scene:plant-transport"')
    expect(plantTransportEngine.prompt).toContain('"isolates":"magnitude"')
  })
})
