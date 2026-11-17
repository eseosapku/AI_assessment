// lib/studylab/engines/plant-growth/plant-growth.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { plantGrowthEngine, outcomeOf, conditionsOf, PANEL_WIDTH, PANEL_HEIGHT, type PlantKind, type PlantState } from './config'
import { PlantGrowthView, plantPanel } from './View'
import { getEngine, scenesFor, sceneCatalogue } from '../registry'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const kinds: PlantKind[] = ['germinate', 'healthy', 'nitrate', 'magnesium']
const config = (kind: PlantKind) => plantGrowthEngine.parse({ kind })!
const render = (kind: PlantKind, state: PlantState, marked: 'idle' | 'right' | 'wrong' | 'shown' = 'idle', reduced = false) =>
  renderToStaticMarkup(createElement(PlantGrowthView, { config: config(kind), state, setState: () => {}, marked, reduced, locked: marked === 'right' }))

describe('the plant-care rules', () => {
  it('distinguishes germination from later growth', () => {
    const germ = config('germinate')
    expect(outcomeOf(germ, { water: false, blind: true, warm: true })).toBe('dry-seed')
    expect(outcomeOf(germ, { water: true, blind: true, warm: true })).toBe('sprout-dark')
    expect(plantGrowthEngine.check(germ, { water: true, blind: true, warm: true }).ok).toBe(true)
    expect(plantGrowthEngine.check(germ, { water: true, blind: false, warm: true }).ok).toBe(true)
    expect(plantGrowthEngine.check(germ, { water: true, blind: true, warm: false }).wrongIds).toEqual(['warmth'])
    const healthy = config('healthy')
    expect(outcomeOf(healthy, { water: true, blind: true, warm: true })).toBe('etiolated')
    expect(plantGrowthEngine.check(healthy, { water: true, blind: true, warm: true }).ok).toBe(false)
    expect(plantGrowthEngine.check(healthy, { water: true, blind: false, warm: true }).ok).toBe(true)
    expect(plantGrowthEngine.check(healthy, { water: false, blind: false, warm: true }).wrongIds).toEqual(['water'])
  })

  it('distinguishes the two mineral shortages, including the wrong feed', () => {
    expect(outcomeOf(config('nitrate'), { water: true, blind: false, warm: true, feed: '' })).toBe('nitrate-deficient')
    expect(outcomeOf(config('magnesium'), { water: true, blind: false, warm: true, feed: '' })).toBe('magnesium-deficient')
    expect(plantGrowthEngine.check(config('nitrate'), { water: true, blind: false, warm: true, feed: 'magnesium' }).wrongIds).toEqual(['feed'])
    expect(plantGrowthEngine.check(config('magnesium'), { water: true, blind: false, warm: true, feed: 'nitrate' }).wrongIds).toEqual(['feed'])
    expect(plantGrowthEngine.check(config('nitrate'), plantGrowthEngine.solve(config('nitrate'))).ok).toBe(true)
    expect(plantGrowthEngine.check(config('magnesium'), plantGrowthEngine.solve(config('magnesium'))).ok).toBe(true)
  })

  it('reads malformed stored work safely', () => {
    for (const kind of kinds) {
      expect(conditionsOf(config(kind), {} as PlantState).water).toBe(false)
      expect(plantGrowthEngine.check(config(kind), null as unknown as PlantState).ok).toBe(false)
      expect(plantGrowthEngine.check(config(kind), { water: 'yes', warm: 1 } as unknown as PlantState).ok).toBe(false)
    }
  })
})

describe('reading the tutor config', () => {
  it('accepts semantic phrasings', () => {
    expect(plantGrowthEngine.parse({ task: 'conditions for germination' })).toEqual({ kind: 'germinate' })
    expect(plantGrowthEngine.parse({ task: 'healthy plants' })).toEqual({ kind: 'healthy' })
    expect(plantGrowthEngine.parse({ task: 'mineral deficiency', mineral: 'magnesium ions' })).toEqual({ kind: 'magnesium' })
    expect(plantGrowthEngine.parse({ task: { kind: 'nitrate' } })).toEqual({ kind: 'nitrate' })
    expect(plantGrowthEngine.parse({ task: 'nitrate-deficiency' })).toEqual({ kind: 'nitrate' })
    expect(plantGrowthEngine.parse(null)).toBeNull()
    expect(plantGrowthEngine.parse({ task: 'photosynthesis rate' })).toBeNull()
  })

  it('refuses an unknown mineral narrowly, with a working example', () => {
    const c = plantGrowthEngine.parse({ task: 'mineral', mineral: 'potassium' })!
    expect(plantGrowthEngine.faults(c)).toEqual(['There is no "potassium" plant-care card: use germinate, healthy, nitrate or magnesium, e.g. { "kind":"nitrate" }.'])
    for (const kind of kinds) expect(plantGrowthEngine.faults(config(kind))).toEqual([])
  })
})

describe('every valid configuration', { timeout: 30_000 }, () => {
  it('starts unsolved and can always be solved, with exact marking', () => {
    for (const kind of kinds) {
      const c = config(kind)
      const start = plantGrowthEngine.initial(c)
      const answer = plantGrowthEngine.solve(c)
      expect(plantGrowthEngine.check(c, start).ok, kind).toBe(false)
      expect(plantGrowthEngine.check(c, answer), kind).toEqual({ ok: true, wrongIds: [] })
      for (const water of [false, true]) for (const blind of [false, true]) for (const warm of [false, true]) for (const feed of ['', 'nitrate', 'magnesium']) {
        const state = { water, blind, warm, feed }
        expect(typeof plantGrowthEngine.check(c, state).ok).toBe('boolean')
        expect(plantGrowthEngine.check(c, state).ok).toBe(
          water && warm && (kind === 'germinate' || !blind) && (kind !== 'nitrate' || feed === 'nitrate') && (kind !== 'magnesium' || feed === 'magnesium'),
        )
      }
    }
  })

  it('keeps germination in the dark correct and shows no answer words before marking', () => {
    for (const kind of kinds) {
      const c = config(kind)
      const idle = render(kind, plantGrowthEngine.initial(c))
      expect(idle).not.toContain('Yes.')
      expect(idle).toContain('Aim:')
      const wrong = render(kind, plantGrowthEngine.initial(c), 'wrong')
      expect(wrong.length).toBeGreaterThan(idle.length)
      const right = render(kind, plantGrowthEngine.solve(c), 'right')
      expect(right).toContain('Yes.')
      const reduced = render(kind, plantGrowthEngine.solve(c), 'idle', true)
      expect(reduced).toContain('After')
    }
    const seed = render('germinate', { water: true, blind: true, warm: true })
    expect(seed).toContain('even in the dark')
    expect(seed).not.toContain('food stored')
  })
})

describe('the catalogue and prompts', () => {
  it('registers the right id, dimension and geometry', () => {
    expect(getEngine('plant-growth')).toBe(plantGrowthEngine)
    expect(plantGrowthEngine.isolates).toBe('membership')
    expect(plantGrowthEngine.prompt).toContain('"isolates":"membership"')
    expect(plantPanel.width).toBe(PANEL_WIDTH)
    expect(plantPanel.height).toBe(PANEL_HEIGHT)
    const source = readFileSync(join(process.cwd(), 'lib/studylab/engines/plant-growth/View.tsx'), 'utf8')
    expect(source).not.toContain('require(')
  })

  it('catches its stations and not the neighbouring scenes', () => {
    expect(scenesFor('Conditions for germination: what seeds need').map((e) => e.id)).toContain('plant-growth')
    expect(scenesFor('Healthy plants: what plants need to grow').map((e) => e.id)).toContain('plant-growth')
    expect(scenesFor('Mineral deficiencies in plants').map((e) => e.id)).toContain('plant-growth')
    expect(scenesFor('Rate of photosynthesis and limiting factors').map((e) => e.id)).not.toContain('plant-growth')
    expect(scenesFor('Water transport and transpiration in plants').map((e) => e.id)).not.toContain('plant-growth')
    expect(scenesFor('Flowers, pollination and seed dispersal').map((e) => e.id)).not.toContain('plant-growth')
    expect(scenesFor('Planning a fair test with plants').map((e) => e.id)).not.toContain('plant-growth')
    expect(sceneCatalogue('Food chains and food webs')).not.toContain('SCENE "plant-growth"')
    expect(sceneCatalogue('Sonnets and rhyme schemes')).not.toContain('SCENE "plant-growth"')
  })

  it('rejects prompts that reveal the hidden explanation', () => {
    expect(plantGrowthEngine.promptFaults!(config('germinate'), 'Water it; seeds do not need light.').join(' ')).toMatch(/gives the answer away/)
    expect(plantGrowthEngine.promptFaults!(config('healthy'), 'Open the blind because leaves make food.').join(' ')).toMatch(/gives the answer away/)
    expect(plantGrowthEngine.promptFaults!(config('nitrate'), 'Choose nitrate to make proteins.').join(' ')).toMatch(/gives the answer away/)
    expect(plantGrowthEngine.promptFaults!(config('healthy'), 'Measure the photosynthesis rate on a graph.').join(' ')).toMatch(/does not show/)
  })

  it('passes the examples in its own catalogue entry', () => {
    const e = getEngine('plant-growth')!
    const found = [...e.prompt.matchAll(/"prompt":"([^"]+)"[\s\S]*?"config": (\{[\s\S]*?\}) \}/g)]
    expect(found).toHaveLength(4)
    for (const m of found) expect(e.promptFaults!(e.parse(JSON.parse(m[2]))!, m[1])).toEqual([])
  })
})

describe('the scene on the board', () => {
  const card = (kind: PlantKind) => renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
    id: 'n1', data: { spec: { pattern: 'scene', prompt: 'Care for it. Drag to water and pull the cord.', payload: { engine: 'plant-growth', config: { kind } }, success: { kind: 'scene' } } },
  } as never)))

  it('has named real buttons for every action and no answer explanation', () => {
    for (const kind of kinds) {
      const html = card(kind)
      expect(html).toContain('button')
      if (kind === 'germinate' || kind === 'healthy') {
        expect(html).toContain('Blind cord')
        expect(html).toContain('Set cold air')
      } else {
        expect(html).not.toContain('Blind cord')
        expect(html).not.toContain('Set cold air')
      }
      expect(html).not.toContain('Yes.')
      expect(html).not.toContain('amino acids')
      expect(html).not.toContain('chlorophyll,')
      if (kind === 'germinate') expect(html).toContain('Watering can')
      if (kind === 'nitrate' || kind === 'magnesium') {
        expect(html).toContain('nitrate feed bottle')
        expect(html).toContain('magnesium feed bottle')
      }
    }
  })

  it('draws changed observables, never correctness, as the care changes', () => {
    const dry = render('healthy', { water: false, blind: true, warm: true })
    const watered = render('healthy', { water: true, blind: true, warm: true })
    const lit = render('healthy', { water: true, blind: false, warm: true })
    expect(dry).toContain('drooping')
    expect(watered).toContain('tall, thin, pale')
    expect(lit).toContain('upright')
    expect(dry).not.toContain('Yes.')
    expect(watered).not.toContain('Yes.')
    expect(lit).not.toContain('Yes.')
    const wrongFeed = render('nitrate', { water: true, blind: false, warm: true, feed: 'magnesium' }, 'wrong')
    expect(wrongFeed).toContain('Magnesium did not supply')
  })
})
