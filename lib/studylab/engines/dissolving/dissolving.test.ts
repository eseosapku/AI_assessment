// lib/studylab/engines/dissolving/dissolving.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  dissolvingEngine, strokesNeeded, strokeCount, solidLeft, capacityG, coldSpoons, done, working, madeText,
  TEMPERATURES, WATERS, VIEW_W, VIEW_H, SPOON_G, type DissolvingConfig, type DissolvingState,
} from './config'
import { DissolvingView, W, H } from './View'
import { getEngine, scenesFor, sceneCatalogue } from '../registry'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const stir = (substance = 'sugar', temperature = 20, pieces = 'grains') => dissolvingEngine.parse({ task: 'stir', substance, temperature, pieces })!
const saturate = (water = 20) => dissolvingEngine.parse({ task: 'saturate', water })!

/** Every fault-free config the tutor can write. */
function everyConfig(): DissolvingConfig[] {
  const out: DissolvingConfig[] = []
  for (const substance of ['sugar', 'salt', 'sand', 'chalk']) {
    for (const temperature of TEMPERATURES) {
      for (const pieces of ['grains', 'lumps']) {
        const c = stir(substance, temperature, pieces)
        expect(dissolvingEngine.faults(c)).toEqual([])
        out.push(c)
      }
    }
  }
  for (const water of WATERS) {
    const c = saturate(water)
    expect(dissolvingEngine.faults(c)).toEqual([])
    out.push(c)
  }
  return out
}

describe('the dissolving science and marking', () => {
  it('uses the real sucrose limits that make the cold residue disappear on warming', () => {
    const c = saturate(20)
    expect(capacityG(c, 20)).toBeCloseTo(40.8)
    expect(capacityG(c, 60)).toBeCloseTo(57.6)
    expect(coldSpoons(c)).toBe(5)
    expect(solidLeft(c, { spoons: 5, temperature: 20, sawCold: true })).toBeCloseTo(9.2)
    expect(solidLeft(c, { spoons: 5, temperature: 60, sawCold: true })).toBe(0)
  })

  it('changes the rate with warmth and piece size, without changing an insoluble solid', () => {
    expect(strokesNeeded(stir('sugar', 20, 'grains'))).toBeGreaterThan(strokesNeeded(stir('sugar', 60, 'grains')))
    expect(strokesNeeded(stir('salt', 20, 'lumps'))).toBeGreaterThan(strokesNeeded(stir('salt', 20, 'grains')))
    for (const substance of ['sand', 'chalk']) {
      const c = stir(substance)
      expect(strokesNeeded(c)).toBe(4)
      expect(solidLeft(c, dissolvingEngine.solve(c))).toBe(10)
      expect(done(c, { strokes: 3 })).toBe(false)
      expect(done(c, dissolvingEngine.solve(c))).toBe(true)
    }
  })

  it('reads the learner state safely and never marks malformed work right', () => {
    const c = stir()
    expect(strokeCount(c, {})).toBe(0)
    expect(strokeCount(c, { strokes: -100 })).toBe(0)
    expect(strokeCount(c, { strokes: 1000 })).toBe(strokesNeeded(c))
    expect(dissolvingEngine.check(c, {} as DissolvingState).ok).toBe(false)
    expect(dissolvingEngine.check(saturate(), { spoons: 5, temperature: 60, sawCold: false }).ok).toBe(false)
    expect(dissolvingEngine.check(saturate(), { spoons: 4, temperature: 60, sawCold: true }).ok).toBe(false)
  })

  it('says what was made, and explains the result only with a mark', () => {
    expect(madeText(stir(), {})).toMatch(/Nothing has been stirred/)
    expect(madeText(stir(), { strokes: 2 })).toMatch(/still visible/)
    expect(madeText(stir('sand'), { strokes: 2 })).toMatch(/settle/)
    expect(madeText(saturate(), {})).toMatch(/No sugar/)
    expect(working(stir(), dissolvingEngine.solve(stir()))).toMatch(/mass is still 30 g/)
    expect(working(saturate(), dissolvingEngine.solve(saturate()))).toMatch(/40.8 g/)
  })
})

describe('reading and refusing the tutor config', () => {
  it('reads broad phrasings and nested task objects', () => {
    expect(dissolvingEngine.parse({ task: { kind: 'dissolve', solute: 'sodium chloride', temp: '60 °C', particleSize: 'fine powder' } })).toEqual({ task: 'stir', substance: 'salt', pieces: 'grains', temperature: 60 })
    expect(dissolvingEngine.parse({ task: 'rate of dissolving', material: 'chalk', pieces: 'large pieces' })).toEqual({ task: 'stir', substance: 'chalk', pieces: 'lumps', temperature: 20 })
    expect(dissolvingEngine.parse({ task: 'solubility limit', waterMass: '20 g' })).toEqual({ task: 'saturate', water: 20 })
    expect(dissolvingEngine.parse({ substance: 'sand' })).toEqual({ task: 'stir', substance: 'sand', pieces: 'grains', temperature: 20 })
    expect(dissolvingEngine.parse({ task: 'filter', substance: 'sand' })).toBeNull()
    expect(dissolvingEngine.parse(null)).toBeNull()
    expect(dissolvingEngine.parse({ task: 'stir', substance: 3 })).toBeNull()
  })

  it('refuses narrowly, with a nearby working example', () => {
    expect(dissolvingEngine.faults(stir('pepper'))[0]).toMatch(/use sugar, salt, sand or chalk/)
    expect(dissolvingEngine.faults(stir('sugar', 25))[0]).toMatch(/20, 40 or 60 °C/)
    expect(dissolvingEngine.faults(stir('sugar', 20, 'dust'))[0]).toMatch(/grains.*lumps/)
    expect(dissolvingEngine.faults(saturate(22))[0]).toMatch(/use e.g. water 20/)
    expect(dissolvingEngine.faults(saturate(10))[0]).toMatch(/10 g cannot dissolve.*use e.g. water 15/)
    expect(dissolvingEngine.faults(saturate(100))[0]).toMatch(/use e.g. water 30/)
  })
})

describe('every valid configuration', { timeout: 30_000 }, () => {
  it('starts unsolved, solve passes, and invalid extra values cannot invent a solution', () => {
    const all = everyConfig()
    expect(all).toHaveLength(28)
    for (const c of all) {
      const initial = dissolvingEngine.initial(c)
      const solved = dissolvingEngine.solve(c)
      expect(dissolvingEngine.check(c, initial).ok, JSON.stringify(c)).toBe(false)
      expect(dissolvingEngine.check(c, solved).ok, JSON.stringify(c)).toBe(true)
      expect(done(c, solved)).toBe(true)
    }
  })
})

describe('the catalogue and prompts', () => {
  it('registers the scene and catches its own stations, not its neighbours', () => {
    expect(getEngine('dissolving')).toBe(dissolvingEngine)
    expect(scenesFor('Dissolving: soluble and insoluble substances').map((e) => e.id)).toContain('dissolving')
    expect(scenesFor('Solute and solvent: making solutions').map((e) => e.id)).toContain('dissolving')
    expect(scenesFor('Solubility and saturated solutions').map((e) => e.id)).toContain('dissolving')
    expect(scenesFor('Speeding up dissolving').map((e) => e.id)).toContain('dissolving')
    expect(scenesFor('Filtration and evaporation').map((e) => e.id)).not.toContain('dissolving')
    expect(scenesFor('Rates of reaction').map((e) => e.id)).not.toContain('dissolving')
    expect(sceneCatalogue('Acids and pH')).not.toContain('SCENE "dissolving"')
    expect(sceneCatalogue('Solubility and saturated solutions')).toContain('SCENE "dissolving"')
    expect(dissolvingEngine.isolates).toBe('consequence')
    expect(dissolvingEngine.prompt).toMatch(/"apparatus":"scene:dissolving"/)
  })

  it('faults prompts that give the hidden result away', () => {
    expect(dissolvingEngine.promptFaults!(stir(), 'Stir it. Sugar is soluble and mass stays the same.').join(' ')).toMatch(/gives the result away/)
    expect(dissolvingEngine.promptFaults!(stir('sand'), 'Stir four times. Sand is insoluble and will settle.').join(' ')).toMatch(/gives the result away/)
    expect(dissolvingEngine.promptFaults!(saturate(), 'Add five spoonfuls to make a saturated solution.').join(' ')).toMatch(/gives away the limit/)
    expect(dissolvingEngine.promptFaults!(stir(), 'Type in the total mass.').join(' ')).toMatch(/does not do/)
  })

  it('passes the examples in its own catalogue entry', () => {
    const e = getEngine('dissolving')!
    const found = [...e.prompt.matchAll(/"prompt":"([^"]+)"[\s\S]*?"config": (\{[^\n]+\}) \}/g)]
    expect(found).toHaveLength(3)
    for (const m of found) {
      const c = e.parse(JSON.parse(m[2]))!
      expect(e.promptFaults!(c, m[1])).toEqual([])
      expect(e.check(c, e.initial(c)).ok).toBe(false)
      expect(e.check(c, e.solve(c)).ok).toBe(true)
    }
  })
})

describe('the card in the page', () => {
  const card = (config: unknown, prompt: string, marked: 'idle' | 'right' | 'wrong' = 'idle', state?: DissolvingState) =>
    renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'dissolving', config }, success: { kind: 'scene' } }, work: state, marked },
    } as never)))

  it('uses the same panel size in the view and config', () => {
    expect(W).toBe(VIEW_W)
    expect(H).toBe(VIEW_H)
    expect(W).toBe(360)
    expect(H).toBe(232)
  })

  it('has real buttons, a named draggable spoon, and live observables', () => {
    const html = card({ task: 'stir', substance: 'sugar', temperature: 20, pieces: 'grains' }, 'Drag the spoon sideways.')
    expect(html).toContain('data-spoon-handle')
    expect(html).toContain('aria-label="Stir once"')
    expect(html).toContain('Total mass')
    expect(html).toContain('Solid left')
    expect(html).toContain('30 g')
    const sat = card({ task: 'saturate', water: 20 }, 'Add spoonfuls, then warm the water.')
    expect(sat).toContain('aria-label="Add a 10 g spoonful of sugar"')
    expect(sat).toContain('aria-label="Warm the water"')
    expect(sat).toContain('aria-label="Cool the water"')
  })

  it('shows no answer words or needed numbers before marking', () => {
    const raw = { task: 'stir', substance: 'sugar', temperature: 20, pieces: 'grains' }
    const html = card(raw, 'Drag the spoon sideways to stir.').replace('Drag the spoon sideways to stir.', '').toLowerCase()
    expect(html).not.toMatch(/soluble|insoluble|saturated|solute|solvent|solution|melt/)
    expect(html).not.toMatch(/6 strokes|six strokes/)
    const sand = card({ ...raw, substance: 'sand' }, 'Drag the spoon sideways to stir.').replace('Drag the spoon sideways to stir.', '').toLowerCase()
    expect(sand).not.toMatch(/insoluble|will settle/)
    const sat = card({ task: 'saturate', water: 20 }, 'Add spoonfuls.').replace('Add spoonfuls.', '').toLowerCase()
    expect(sat).not.toMatch(/saturated|solubility|40.8|57.6|maximum/)
  })

  it('keeps a changed still frame under reduced motion, without a moving swirl', () => {
    const c = stir()
    const view = (state: DissolvingState) => renderToStaticMarkup(createElement(DissolvingView, { config: c, state, setState: () => {}, marked: 'idle', reduced: true, locked: false }))
    const before = view({ strokes: 0 })
    const after = view({ strokes: 1 })
    expect(before).toContain('10 g')
    expect(after).toContain('8.3 g')
    expect(after).not.toContain('data-swirl=')
    expect(before).not.toEqual(after)
  })

  it('names and explains the result only once marked', () => {
    const c = stir()
    const html = renderToStaticMarkup(createElement(DissolvingView, { config: c, state: dissolvingEngine.solve(c), setState: () => {}, marked: 'right', reduced: true, locked: true }))
    expect(html).toMatch(/has dissolved/)
    expect(html).toMatch(/solute/)
    expect(html).toMatch(/mass is still 30 g/)
    const wrong = renderToStaticMarkup(createElement(DissolvingView, { config: c, state: { strokes: 1 }, setState: () => {}, marked: 'wrong', reduced: true, locked: false }))
    expect(wrong).toMatch(/still visible/)
  })
})
