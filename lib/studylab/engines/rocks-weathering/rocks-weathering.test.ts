import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  rocksWeatheringEngine as e, SAMPLE_IDS, SAMPLES, GRAIN_AT, TARGET_STOP, START_STOP, STOP_NAMES, STOP_COOLING, grainAcceptsStop,
  type Grain, type RocksConfig, type RocksState,
} from './config'
import { RocksWeatheringView, STOP_Y, W, H, ROW_X, ROW_W, ROW_H, BLOB_X, CIRCLE, grainCells } from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const crystals = (target: Grain): RocksConfig => ({ task: 'crystals', target })
const fizz = (...samples: string[]): RocksConfig => ({ task: 'fizz', samples })
const render = (config: RocksConfig, state: RocksState, marked: 'idle' | 'right' | 'wrong' | 'shown' = 'idle', reduced = false) =>
  renderToStaticMarkup(createElement(RocksWeatheringView, { config, state, setState: () => {}, marked, reduced, locked: marked === 'right' }))

function everyConfig(): RocksConfig[] {
  const out: RocksConfig[] = (['fine', 'medium', 'coarse'] as Grain[]).map(crystals)
  // Every subset of the six rocks of size 3 to 6, in tray order.
  for (let mask = 0; mask < 64; mask++) {
    const s = SAMPLE_IDS.filter((_, i) => mask & (1 << i))
    if (s.length >= 3) out.push(fizz(...s))
  }
  return out
}

describe('the facts', () => {
  it('has the right rocks fizzing and the right crystal sizes', () => {
    expect(SAMPLES.limestone.fizz && SAMPLES.chalk.fizz && SAMPLES.marble.fizz).toBe(true)
    expect(SAMPLES.granite.fizz || SAMPLES.basalt.fizz || SAMPLES.slate.fizz).toBe(false)
    expect(GRAIN_AT).toEqual(['fine', 'fine', 'medium', 'coarse', 'coarse'])
    expect(STOP_NAMES).toHaveLength(5)
    expect(STOP_COOLING).toHaveLength(5)
  })
  it('keeps each target apart from its start, and its stand-in depth inside its band', () => {
    for (const g of ['fine', 'medium', 'coarse'] as Grain[]) {
      expect(grainAcceptsStop(g, START_STOP[g])).toBe(false)
      expect(grainAcceptsStop(g, TARGET_STOP[g])).toBe(true)
    }
  })
})

describe('reading and refusing configs', () => {
  it('reads broad phrasings', () => {
    expect(e.parse({ task: 'crystals', target: 'granite' })).toEqual(crystals('coarse'))
    expect(e.parse({ task: 'cooling', rock: 'Basalt' })).toEqual(crystals('fine'))
    expect(e.parse({ task: 'crystals', grain: 'medium' })).toEqual(crystals('medium'))
    expect(e.parse({ task: 'acid test', samples: ['Limestone', 'granite', 'Marble'] })).toEqual(fizz('limestone', 'granite', 'marble'))
    expect(e.parse({ rocks: ['chalk', 'slate', 'basalt'] })).toEqual(fizz('chalk', 'slate', 'basalt'))
    expect(e.parse(null)).toBeNull()
    expect(e.parse({ task: 'crystals' })).toBeNull()
  })
  it('refuses with a nearby example that works', () => {
    expect(e.faults(fizz('limestone', 'sandstone', 'granite'))[0]).toMatch(/sandstone.*use e\.g\./)
    expect(e.faults(fizz('limestone', 'granite'))[0]).toMatch(/3 to 6/)
    expect(e.faults(fizz('limestone', 'limestone', 'granite'))[0]).toMatch(/once/)
    expect(e.faults(fizz('limestone', 'granite', 'marble'))).toEqual([])
  })
})

describe('every valid config starts unsolved and solves', { timeout: 30_000 }, () => {
  it('enumerates every crystals target and every tray', () => {
    const all = everyConfig()
    expect(all.length).toBe(45)
    for (const c of all) {
      expect(e.faults(c), JSON.stringify(c)).toEqual([])
      expect(e.check(c, e.initial(c)).ok, `starts solved ${JSON.stringify(c)}`).toBe(false)
      expect(e.check(c, e.solve(c)).ok, `cannot solve ${JSON.stringify(c)}`).toBe(true)
      for (const marked of ['idle', 'right', 'wrong', 'shown'] as const) {
        const html = render(c, marked === 'idle' || marked === 'wrong' ? e.initial(c) : e.solve(c), marked, marked === 'shown')
        expect(html).toContain('<svg')
      }
    }
  })
  it('needs every rock tested, and only tested rocks can be marked', () => {
    const c = fizz('limestone', 'granite', 'marble')
    expect(e.check(c, { tested: ['limestone', 'granite', 'marble'], tagged: ['limestone'] }).ok).toBe(false)
    expect(e.check(c, { tested: ['limestone', 'granite'], tagged: ['limestone', 'marble'] }).ok).toBe(false)
    expect(e.check(c, { tested: ['limestone', 'granite', 'marble'], tagged: ['limestone', 'marble'] }).ok).toBe(true)
    expect(e.check(c, { tested: ['limestone', 'granite', 'marble'], tagged: ['limestone', 'marble', 'granite'] }).wrongIds).toEqual(['granite'])
    expect(e.check(fizz('granite', 'basalt', 'slate'), { tested: ['granite', 'basalt', 'slate'], tagged: [] }).ok).toBe(true)
    expect(e.check(crystals('coarse'), { stop: 3 }).ok).toBe(true)
    expect(e.check(crystals('coarse'), { stop: 2 }).ok).toBe(false)
    expect(e.check(crystals('coarse'), {} as RocksState).ok).toBe(false)
  })
})

describe('the drawing', () => {
  it('keeps rows apart, the magma level with its row, and the grains finer to coarser', () => {
    for (let i = 1; i < STOP_Y.length; i++) expect(STOP_Y[i] - STOP_Y[i - 1]).toBeGreaterThanOrEqual(ROW_H + 2)
    expect(ROW_X + ROW_W).toBeLessThanOrEqual(W - 10)
    expect(BLOB_X + 62).toBeLessThan(ROW_X)
    expect(CIRCLE.y + CIRCLE.r).toBeLessThan(H - 20)
    expect(W).toBe(360)
    expect(H).toBe(372)
    const counts = [7, 10, 16, 24, 34].map((s) => grainCells(s, CIRCLE.r).length)
    for (let i = 1; i < counts.length; i++) expect(counts[i]).toBeLessThan(counts[i - 1])
  })
  it('moves the magma and the grains with each depth', () => {
    const a = render(crystals('coarse'), { stop: 0 })
    const b = render(crystals('coarse'), { stop: 4 })
    expect(a).not.toEqual(b)
    expect(a).toMatch(/translateY\(40px\)/)
    expect(b).toMatch(/translateY\(200px\)/)
  })
  it('has real buttons and a keyboard slider', () => {
    const c = render(crystals('fine'), { stop: 4 })
    expect(c).toMatch(/role="slider"/)
    expect(c.match(/<button/g)).toHaveLength(5)
    const f = render(fizz('limestone', 'granite', 'marble'), e.initial(fizz('limestone', 'granite', 'marble')))
    expect(f.match(/aria-label="Add acid to/g)).toHaveLength(3)
    expect(f).toMatch(/disabled=""[^>]*aria-pressed="false"[^>]*aria-label="Mark limestone/)
  })
  it('shows a fizz only once a rock is tested', () => {
    const c = fizz('limestone', 'granite', 'marble')
    expect(render(c, e.initial(c))).not.toMatch(/Fizzes|No fizz/)
    const t = render(c, { tested: ['limestone', 'granite'], tagged: [] })
    expect(t).toMatch(/Fizzes/)
    expect(t).toMatch(/No fizz/)
    expect(t).toMatch(/Not tested/)
  })
  it('keeps answers out of the card before marking', () => {
    const card = (config: RocksConfig, prompt: string) => renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'rocks-weathering', config }, success: { kind: 'scene' } } },
    } as never))).replace(prompt, '')
    for (const c of [crystals('coarse'), fizz('limestone', 'granite', 'marble')]) {
      const s = card(c, 'Do it.')
      expect(s).not.toMatch(/dolerite|chemical weathering|calcium carbonate|You made|You marked|Yes\./)
    }
  })
  it('says what was made and what is needed when wrong, and why when right', () => {
    expect(render(crystals('coarse'), { stop: 0 }, 'wrong')).toMatch(/You made tiny crystals, like basalt.*large crystals.*slower cooling/)
    expect(render(crystals('fine'), { stop: 4 }, 'wrong')).toMatch(/You made large crystals, like granite.*faster cooling/)
    expect(render(crystals('coarse'), { stop: 4 }, 'right')).toMatch(/granite/)
    const c = fizz('limestone', 'granite', 'marble')
    expect(render(c, { tested: ['limestone'], tagged: [] }, 'wrong')).toMatch(/not tested granite and marble/)
    expect(render(c, { tested: ['limestone', 'granite', 'marble'], tagged: ['granite'] }, 'wrong')).toMatch(/Granite did not fizz.*Limestone and marble fizzed/)
    expect(render(c, e.solve(c), 'right')).toMatch(/chemical weathering/)
  })
})

describe('catalogue matching and prompts', () => {
  it('matches rock stations and rules out the near misses', () => {
    expect(getEngine('rocks-weathering')).toBe(e)
    for (const s of ['Types of rock', 'Igneous, sedimentary and metamorphic rocks', 'Weathering', 'Chemical weathering', 'How rocks form']) {
      expect(scenesFor(s).map((x) => x.id), s).toContain('rocks-weathering')
      expect(sceneCatalogue(s), s).toContain('SCENE "rocks-weathering"')
    }
    for (const s of ['Weather and climate', 'The rock cycle', 'Freeze-thaw weathering', 'River erosion', 'Plate tectonics', 'Rock climbing', 'Sediment transport', 'Metamorphosis of butterflies', 'Soil and fossils']) {
      expect(sceneCatalogue(s), s).not.toContain('SCENE "rocks-weathering"')
      expect(scenesFor(s).map((x) => x.id), s).not.toContain('rocks-weathering')
    }
  })
  it('catches prompts that give the answer or promise something else', () => {
    expect(e.promptFaults!(crystals('coarse'), 'Make a granite.').join(' ')).toMatch(/names the rock/)
    expect(e.promptFaults!(crystals('coarse'), 'Put the magma deep so large crystals grow.').join(' ')).toMatch(/how deep/)
    expect(e.promptFaults!(crystals('fine'), 'Let the magma cool slowly.').join(' ')).toMatch(/how deep/)
    expect(e.promptFaults!(fizz('limestone', 'granite', 'marble'), 'Limestone fizzes, so mark it.').join(' ')).toMatch(/which rocks react/)
    expect(e.promptFaults!(fizz('limestone', 'granite', 'marble'), 'Find the calcium carbonate rocks.').join(' ')).toMatch(/which rocks react/)
    expect(e.promptFaults!(fizz('limestone', 'granite', 'marble'), 'Freeze the rocks and watch the ice.').join(' ')).toMatch(/does not show/)
  })
  it('passes the examples in its own catalogue entry', () => {
    const found = [...e.prompt.matchAll(/"prompt":"([^"]+)"[\s\S]*?"config": (\{[\s\S]*?\}) \}/g)]
    expect(found.length).toBe(2)
    for (const m of found) {
      const c = e.parse(JSON.parse(m[2]))!
      expect(e.faults(c)).toEqual([])
      expect(e.promptFaults!(c, m[1])).toEqual([])
      expect(e.check(c, e.initial(c)).ok).toBe(false)
      expect(e.check(c, e.solve(c)).ok).toBe(true)
    }
    expect(e.prompt).toMatch(/"isolates":"consequence"/)
  })
})
