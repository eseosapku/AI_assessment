// lib/studylab/engines/flower-reproduction/flower-reproduction.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  flowerReproductionEngine as E, land, reached, DEPOSIT, FLOWERS, GRAINS_MIN, GRAINS_MAX, OVULES_MIN, OVULES_MAX,
  type FlowerConfig, type FlowerState,
} from './config'
import { FlowerReproductionView, ZONES, zoneAt, ovulesAt, grainsAt, OVULE_R, tipFor, tubePoints } from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const render = (config: FlowerConfig, state: FlowerState, marked: 'idle' | 'right' | 'wrong' | 'shown' = 'idle') =>
  renderToStaticMarkup(createElement(FlowerReproductionView, { config, state, setState: () => {}, marked, reduced: true, locked: marked === 'right' }))

const pollinate = (flower = 'buttercup'): FlowerConfig => ({ task: 'pollinate', flower })
const fertilise = (grains = 2, ovules = 4, flower = 'poppy'): FlowerConfig => ({ task: 'fertilise', flower, grains, ovules })

const allConfigs = (): FlowerConfig[] => {
  const out: FlowerConfig[] = FLOWERS.map((f) => pollinate(f))
  for (const f of FLOWERS) for (let g = GRAINS_MIN; g <= GRAINS_MAX; g++) for (let o = OVULES_MIN; o <= OVULES_MAX; o++) if (g <= o) out.push(fertilise(g, o, f))
  return out
}

describe('the rules', () => {
  it('pollen sticks only when a loaded bee lands on the stigma', () => {
    let s: FlowerState = {}
    s = land(s, 'stigma')
    expect(s.grains).toBeUndefined()
    s = land(s, 'anther')
    expect(s.loaded).toBe(true)
    s = land(s, 'petal')
    expect(E.check(pollinate(), s).ok).toBe(false)
    s = land(s, 'stigma')
    expect(s.grains).toBe(DEPOSIT)
    expect(E.check(pollinate(), s).ok).toBe(true)
  })
  it('each ovule takes one tube, and every grain needs one', () => {
    const c = fertilise(2, 4) as Extract<FlowerConfig, { task: 'fertilise' }>
    expect(reached(c, { to: [1, 1] })).toEqual([1, null])
    expect(E.check(c, { to: [1, 1] }).ok).toBe(false)
    expect(E.check(c, { to: [1, 3] }).ok).toBe(true)
    expect(E.check(c, { to: [9, -1] }).ok).toBe(false)
    expect(E.check(c, E.initial(c)).wrongIds).toEqual(['grain-0', 'grain-1'])
  })
})

describe('every valid config', { timeout: 30_000 }, () => {
  it('starts unsolved, and its solve passes check', () => {
    const all = allConfigs()
    expect(all.length).toBeGreaterThan(30)
    for (const c of all) {
      expect(E.faults(c)).toEqual([])
      expect(E.check(c, E.initial(c)).ok).toBe(false)
      expect(E.check(c, E.solve(c)).ok).toBe(true)
      expect(render(c, E.initial(c)).length).toBeGreaterThan(500)
      expect(render(c, E.solve(c), 'right')).toContain('<svg')
    }
  })
  it('keeps the drawing apart: ovules inside the ovary and clear of each other, grains clear of each other', () => {
    for (let n = OVULES_MIN; n <= OVULES_MAX; n++) {
      const o = ovulesAt(n)
      expect(o).toHaveLength(n)
      for (const p of o) { expect(p.x - OVULE_R).toBeGreaterThan(148); expect(p.x + OVULE_R).toBeLessThan(212); expect(p.y - OVULE_R).toBeGreaterThan(186); expect(p.y + OVULE_R).toBeLessThan(250) }
      o.forEach((a, i) => o.slice(i + 1).forEach((b) => expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(2 * OVULE_R + 2)))
    }
    for (let n = GRAINS_MIN; n <= GRAINS_MAX; n++) {
      const g = grainsAt(n)
      g.forEach((a, i) => g.slice(i + 1).forEach((b) => expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(18)))
    }
  })
  it('lands the bee on the part it is dropped on, and nowhere in empty air', () => {
    for (const z of ZONES) expect(zoneAt(z.c)?.part).toBe(z.part)
    expect(zoneAt({ x: 56, y: 40 })).toBeNull()
    expect(zoneAt({ x: 180, y: 84 })?.part).toBe('stigma')
  })
  it('steers a tube down the style, then free in the ovary', () => {
    const tip = tipFor(0, 2, { x: 300, y: 130 })
    expect(Math.abs(tip.x - 180)).toBeLessThan(3)
    expect(tubePoints(0, 2, tip).length).toBeGreaterThan(1)
    expect(tipFor(0, 2, { x: 170, y: 210 }).y).toBe(210)
  })
})

describe('reading and refusing', () => {
  it('parses broadly', () => {
    expect(E.parse({ task: 'pollination' })).toEqual(pollinate())
    expect(E.parse({ task: 'bee', flower: 'Poppy' })).toEqual(pollinate('poppy'))
    expect(E.parse({ task: 'fertilisation', grains: '3', ovules: 5 })).toEqual({ task: 'fertilise', flower: 'buttercup', grains: 3, ovules: 5 })
    expect(E.parse({ task: { kind: 'pollen tube' } })).toMatchObject({ task: 'fertilise', grains: 2, ovules: 4 })
    expect(E.parse({ grains: 1 })).toMatchObject({ task: 'fertilise' })
    expect(E.parse({ task: 'zzz' })).toBeNull()
    expect(E.parse(null)).toBeNull()
    expect(E.parse({ task: 'fertilise', grains: 'lots' })).toBeNull()
  })
  it('refuses narrowly with a nearby example', () => {
    expect(E.faults(fertilise(4, 5))[0]).toMatch(/grains must be.*1 to 3.*use e\.g\. 2/)
    expect(E.faults(fertilise(2, 9))[0]).toMatch(/ovules must be.*2 to 5/)
    expect(E.faults(fertilise(3, 2))[0]).toMatch(/only 2.*grains 2 with ovules 4|grains 2/)
    expect(E.faults(pollinate('rose'))[0]).toMatch(/buttercup, poppy, geranium/)
    expect(() => render(pollinate('rose'), {})).not.toThrow()
  })
})

describe('prompts', () => {
  it('refuses prompts that give the answer away or promise what the card cannot do', () => {
    expect(E.promptFaults!(pollinate(), 'Move the bee from the anther to the stigma.')[0]).toMatch(/names the parts/)
    expect(E.promptFaults!(fertilise(), 'Send each tube to its own ovule.')[0]).toMatch(/names the part/)
    expect(E.promptFaults!(pollinate(), 'Drag the bee, then show how wind carries pollen.')[0]).toMatch(/promises/)
    expect(E.promptFaults!(pollinate(), 'Fertilise the flower with the bee.')[0]).toMatch(/pollination, not fertilisation/)
  })
  it('passes the examples in its own catalogue entry', () => {
    const prompts = [...E.prompt.matchAll(/"prompt":"([^"]+)"/g)].map((m) => m[1])
    expect(prompts).toHaveLength(2)
    const configs = [...E.prompt.matchAll(/"config": (\{[^}]+\})/g)].map((m) => JSON.parse(m[1]))
    expect(configs).toHaveLength(2)
    configs.forEach((raw, i) => {
      const c = E.parse(raw)!
      expect(c).not.toBeNull()
      expect(E.faults(c)).toEqual([])
      expect(E.promptFaults!(c, prompts[i])).toEqual([])
      expect(E.check(c, E.initial(c)).ok).toBe(false)
      expect(E.check(c, E.solve(c)).ok).toBe(true)
    })
    expect(E.prompt).toContain('"isolates":"structure"')
    expect(E.isolates).toBe('structure')
  })
})

describe('the card', () => {
  it('is registered by its module with the id the folder does not carry', () => {
    expect(getEngine('flower-reproduction')).toBe(E)
  })
  it('names the engine in the catalogue for flower stations only', () => {
    expect(sceneCatalogue('Pollination and the parts of a flower')).toContain('flower-reproduction')
    expect(sceneCatalogue('Fertilisation in plants')).toContain('flower-reproduction')
    expect(sceneCatalogue('Sexual reproduction in flowering plants')).toContain('flower-reproduction')
    for (const s of ['Seed dispersal', 'Photosynthesis in leaves', 'Water transport in plants', 'Human reproduction', 'Genetics and inheritance', 'Food chains', 'Mitosis and meiosis', 'Flower arranging']) {
      expect(sceneCatalogue(s)).not.toContain('flower-reproduction')
      expect(scenesFor(s).map((e) => e.id)).not.toContain('flower-reproduction')
    }
    expect(scenesFor('Parts of a flower').map((e) => e.id)).toContain('flower-reproduction')
  })
  it('says nothing of right or wrong before marking, and shows no answer words in text or ARIA', () => {
    const cases: [FlowerConfig, FlowerState][] = [
      [pollinate(), {}], [pollinate(), land({}, 'anther')], [pollinate(), land(land({}, 'anther'), 'stigma')],
      [fertilise(), E.initial(fertilise())], [fertilise(), { to: [0, 2] }],
    ]
    for (const [c, s] of cases) {
      const html = render(c, s)
      expect(html).not.toMatch(/Pollen is made|never touched|own ovule|becomes a seed|That is pollination|only sticks/)
      expect(html).not.toMatch(/>fruit<|>seed<|Well done|correct|wrong/i)
    }
  })
  it('names what was made once marked', () => {
    expect(render(pollinate(), {}, 'wrong')).toMatch(/never touched an anther/)
    expect(render(pollinate(), land(land({}, 'anther'), 'petal'), 'wrong')).toMatch(/never landed on the stigma/)
    expect(render(pollinate(), E.solve(pollinate()), 'right')).toMatch(/That is pollination/)
    expect(render(fertilise(3, 4), { to: [0, null, 2] }, 'wrong')).toMatch(/2 of 3 pollen tubes/)
    const right = render(fertilise(), E.solve(fertilise()), 'right')
    expect(right).toMatch(/becomes a seed/)
    expect(right).toContain('>seed<')
    expect(right).toContain('>fruit<')
  })
  it('changes the drawing after the smallest move', () => {
    expect(render(pollinate(), {})).not.toBe(render(pollinate(), land({}, 'anther')))
    expect(render(fertilise(), E.initial(fertilise()))).not.toBe(render(fertilise(), { to: [2, null] }))
  })
  it('keeps every label at least 12px and nothing in the markup but real buttons for controls', () => {
    const html = render(pollinate(), {})
    for (const m of html.matchAll(/font-size="([\d.]+)"/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(12)
    expect(html).toContain('<button')
    expect(html).toContain('aria-label="Start again')
  })
  it('renders through ActivityNode for both tasks', () => {
    for (const config of [pollinate(), fertilise()]) {
      const html = renderToStaticMarkup(
        createElement(ReactFlowProvider, null, createElement(ActivityNode, {
          id: 'n', type: 'activity', selected: false, dragging: false, zIndex: 0, isConnectable: false, positionAbsoluteX: 0, positionAbsoluteY: 0,
          data: { spec: { pattern: 'scene', prompt: 'x', payload: { engine: 'flower-reproduction', config }, success: { kind: 'scene' } } },
        } as never)),
      )
      expect(html).toContain('<svg')
    }
  })
})
