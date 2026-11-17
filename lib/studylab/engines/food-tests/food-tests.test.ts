// lib/studylab/engines/food-tests/food-tests.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  foodTestsEngine, NUTRIENTS, REAGENTS, REAGENT_FOR, NUTRIENT_NAMES, SAMPLE_NAMES,
  actionName, completed, goodPrompt, liquidColour, observation, positive, safeNutrient, safeReagent,
  stageOf, PANEL_HEIGHT, PANEL_WIDTH,
  type FoodConfig, type FoodState, type Nutrient,
} from './config'
import { FoodTestsView, H, W } from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const testConfig = (nutrient: string, sample: unknown = 'potato') => foodTestsEngine.parse({ task: 'test', nutrient, sample })!
const identifyConfig = (sample: unknown = { name: 'Food A', contains: ['starch', 'protein'], sugar: 0 }) => foodTestsEngine.parse({ task: 'identify', sample })!

/** Every custom unknown: all 32 nutrient sets, with each visible sugar level for the sets that contain sugar. */
function everyConfig(): { raw: unknown; config: FoodConfig }[] {
  const out: { raw: unknown; config: FoodConfig }[] = []
  for (let mask = 0; mask < 32; mask++) {
    const contains = NUTRIENTS.filter((_, i) => mask & (1 << i))
    const levels = contains.includes('reducing-sugar') ? [1, 2, 3, 4] : [0]
    for (const sugar of levels) {
      const raw = { task: 'identify', sample: { name: 'Food A', contains, sugar } }
      const config = foodTestsEngine.parse(raw)
      expect(config).not.toBeNull()
      out.push({ raw, config: config! })
      for (const nutrient of NUTRIENTS) {
        const one = { task: 'test', nutrient, sample: raw.sample }
        const parsed = foodTestsEngine.parse(one)
        expect(parsed).not.toBeNull()
        out.push({ raw: one, config: parsed! })
      }
    }
  }
  return out
}

const view = (config: FoodConfig, state: FoodState, marked: 'idle' | 'right' | 'wrong' | 'shown' = 'idle') =>
  renderToStaticMarkup(createElement(FoodTestsView, { config, state, setState: () => {}, marked, reduced: true, locked: marked === 'right' }))

const card = (config: unknown, prompt: string) =>
  renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
    id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'food-tests', config }, success: { kind: 'scene' } } },
  } as never)))

describe('the food-test science and observations', () => {
  it('uses the exact syllabus appearance for positive and negative tests', () => {
    const custom = (contains: Nutrient[], sugar = 0) => ({ name: 'Food A', nutrients: contains, sugar })
    const cases: [Nutrient, string, string, string][] = [
      ['starch', 'iodine', 'blue-black', 'orange-brown'],
      ['reducing-sugar', 'benedict', 'orange', 'blue'],
      ['protein', 'biuret', 'purple', 'blue'],
      ['fat', 'ethanol', 'cloudy white', 'clear'],
      ['vitamin-c', 'dcpip', 'colourless', 'blue'],
    ]
    for (const [nutrient, reagent, yes, no] of cases) {
      const r = REAGENT_FOR[nutrient]
      expect(r).toBe(reagent)
      expect(observation(custom([nutrient], nutrient === 'reducing-sugar' ? 3 : 0), r, 3)).toBe(yes)
      expect(observation(custom([]), r, 3)).toBe(no)
    }
  })

  it('makes the Benedict colour rise with reducing sugar, without claiming a concentration', () => {
    const levels = [0, 1, 2, 3, 4].map((sugar) => observation({ name: 'A', nutrients: sugar ? ['reducing-sugar'] : [], sugar }, 'benedict', 3))
    expect(levels).toEqual(['blue', 'green', 'yellow', 'orange', 'brick-red'])
    expect(foodTestsEngine.solve(testConfig('reducing-sugar', { name: 'A', contains: ['reducing-sugar'], sugar: 4 })).answer).toBe(true)
    const c = testConfig('reducing-sugar', { name: 'A', contains: ['reducing-sugar'], sugar: 2 })
    expect(foodTestsEngine.check(c, foodTestsEngine.solve(c)).ok).toBe(true)
  })

  it('requires heat and water in their real order, with no jump to the end', () => {
    expect([0, 1, 2].map((s) => actionName('benedict', s))).toEqual(['Add Benedict’s', 'Heat in water bath', 'Lift out & observe'])
    expect([0, 1].map((s) => actionName('ethanol', s))).toEqual(['Add ethanol', 'Add water'])
    expect(actionName('dcpip', 0)).toBe('Add food extract')
    const c = testConfig('reducing-sugar', 'glucose-solution')
    const partial: FoodState = { reagent: 'benedict', stages: { benedict: 2 }, answer: true }
    expect(foodTestsEngine.check(c, partial).ok).toBe(false)
    expect(observation(c.sample, 'benedict', 2)).toBe('warming at 80 °C')
  })

  it('renders the actual final liquid colours and emulsion, never the mark', () => {
    const iodine = testConfig('starch', 'potato')
    const iodineDone = foodTestsEngine.solve(iodine)
    expect(view(iodine, iodineDone)).toContain('#18243D')
    const fat = testConfig('fat', 'oil')
    expect(view(fat, foodTestsEngine.solve(fat))).toContain('data-emulsion="1"')
    const negative = testConfig('protein', 'water')
    expect(view(negative, foodTestsEngine.solve(negative))).toContain('Appearance')
    expect(liquidColour(negative.sample, 'biuret', 1)).toBe('#347EB5')
  })
})

describe('reading the tutor config broadly and refusing narrowly', () => {
  it('reads task aliases, prepared samples, sugar descriptions and custom unknowns', () => {
    expect(foodTestsEngine.parse({ task: 'iodine test', sample: 'potato' })).toEqual({ task: 'test', nutrient: 'starch', sample: { name: 'potato extract', nutrients: ['starch'], sugar: 0 } })
    expect(foodTestsEngine.parse({ task: 'test-for-starch', sample: 'potato' })).toMatchObject({ task: 'test', nutrient: 'starch' })
    expect(foodTestsEngine.parse({ test: 'biuret', sample: 'egg-white' })).toMatchObject({ task: 'test', nutrient: 'protein' })
    expect(testConfig('starch', 'potato').sample.nutrients).toEqual(['starch'])
    const single = (nutrient: string, sample: unknown) => {
      const config = testConfig(nutrient, sample)
      expect(config.task).toBe('test')
      return config as Extract<FoodConfig, { task: 'test' }>
    }
    expect(single('glucose', 'glucose').nutrient).toBe('reducing-sugar')
    expect(single('lipids', 'olive oil').nutrient).toBe('fat')
    expect(single('ascorbic acid', 'orange juice').nutrient).toBe('vitamin-c')
    expect(single('protein', 'egg white').sample.name).toBe('egg-white extract')
    expect(foodTestsEngine.parse({ task: 'test', nutrient: 'starch', sample: { sample: 'Food X', contains: ['starch'] } })).toBeNull()
    const custom = testConfig('starch', { name: 'Food X', contains: 'starch and protein', sugar: 'none' })
    expect(custom.sample).toEqual({ name: 'Food X', nutrients: ['starch', 'protein'], sugar: 0 })
    expect(identifyConfig('water').task).toBe('identify')
    expect(foodTestsEngine.parse(null)).toBeNull()
    expect(foodTestsEngine.parse({ task: 'taste', sample: 'milk' })).toBeNull()
  })

  it('gives actionable faults for unsupported names, nutrients and sugar levels', () => {
    expect(foodTestsEngine.faults(testConfig('carbohydrate'))[0]).toMatch(/use starch, reducing-sugar, protein, fat or vitamin-c/)
    expect(foodTestsEngine.faults(testConfig('starch', 'banana'))[0]).toMatch(/sample object/)
    expect(foodTestsEngine.faults(testConfig('starch', { name: 'A', contains: ['calcium'], sugar: 0 }))[0]).toMatch(/no test for calcium/)
    expect(foodTestsEngine.faults(testConfig('starch', { name: 'a very long sample name', contains: [], sugar: 0 }))[0]).toMatch(/1 to 18/)
    expect(foodTestsEngine.faults(testConfig('reducing-sugar', { name: 'A', contains: ['reducing-sugar'], sugar: 9 }))[0]).toMatch(/0 \(blue\).*4 \(brick-red\)/)
    expect(foodTestsEngine.faults(testConfig('reducing-sugar', { name: 'A', contains: [], sugar: 2 }))[0]).toMatch(/contradicts/)
    expect(foodTestsEngine.faults(testConfig('reducing-sugar', { name: 'A', contains: ['reducing-sugar'], sugar: 0 }))[0]).toMatch(/visible Benedict/)
    expect(SAMPLE_NAMES.every((name) => foodTestsEngine.faults(testConfig('starch', name)).length === 0)).toBe(true)
  })

  it('has the same panel dimensions in both modules, avoiding a load-time config constant', () => {
    expect(W).toBe(PANEL_WIDTH)
    expect(H).toBe(PANEL_HEIGHT)
  })
})

describe('every valid food-tests configuration', { timeout: 30_000 }, () => {
  const all = everyConfig()
  it('enumerates all 320 custom unknown/task combinations plus their single tests', () => {
    expect(all).toHaveLength(80 * 6)
    for (const { config } of all) expect(foodTestsEngine.faults(config)).toEqual([])
  })

  it('starts unsolved and always has a solve that check accepts', () => {
    for (const { raw, config } of all) {
      expect(foodTestsEngine.check(config, foodTestsEngine.initial(config)).ok, `initial ${JSON.stringify(raw)}`).toBe(false)
      expect(foodTestsEngine.check(config, foodTestsEngine.solve(config)), `solve ${JSON.stringify(raw)}`).toEqual({ ok: true, wrongIds: [] })
    }
  })

  it('rejects guessing without evidence, a wrong conclusion and an incomplete investigation', () => {
    for (const { config } of all) {
      if (config.task === 'test') {
        const n = safeNutrient(config.nutrient)
        const r = REAGENT_FOR[n]
        const done = foodTestsEngine.solve(config)
        expect(foodTestsEngine.check(config, { ...done, answer: !done.answer }).ok).toBe(false)
        expect(foodTestsEngine.check(config, { ...done, stages: { [r]: 0 } }).ok).toBe(false)
        expect(positive(config.sample, n)).toBe(done.answer)
      } else {
        const done = foodTestsEngine.solve(config)
        expect(done.found).toEqual(NUTRIENTS.filter((n) => positive(config.sample, n)))
        expect(foodTestsEngine.check(config, { ...done, stages: { iodine: 0 } }).ok).toBe(false)
        expect(foodTestsEngine.check(config, { ...done, found: NUTRIENTS.filter((n) => !done.found?.includes(n)) }).ok).toBe(false)
      }
    }
  })
})

describe('the scene on the board and before marking', () => {
  it('renders real apparatus and accessible reagent/action controls', () => {
    const c = testConfig('starch', 'potato')
    const html = card({ task: 'test', nutrient: 'starch', sample: 'potato' }, goodPrompt(c))
    expect(html).toContain('data-test-tube="1"')
    expect(view(testConfig('reducing-sugar', 'glucose-solution'), { reagent: 'benedict', stages: {}, found: [], answer: null })).toContain('data-water-bath="1"')
    expect(html).toContain('aria-label="Reagent"')
    expect(html).toContain('aria-label="Add Iodine"')
    expect(html).toContain('role="img"')
  })

  it('holds back positive/negative and the answer until marked, even in screen-reader text', () => {
    const raw = { task: 'test', nutrient: 'starch', sample: 'potato' }
    const c = foodTestsEngine.parse(raw)!
    const prompt = goodPrompt(c)
    const html = card(raw, prompt).replace(prompt, '')
    expect(html.toLowerCase()).not.toMatch(/positive|negative/)
    expect(html).not.toMatch(/starch is present|starch was not detected/)
    expect(html).not.toMatch(/No reducing sugar/)
    const done = view(c, foodTestsEngine.solve(c), 'right')
    expect(done).toContain('Iodine turned blue-black')
    expect(done).toContain('starch is present')
  })

  it('retains completed observations and shows all five only when completed', () => {
    const c = identifyConfig()
    const solved = foodTestsEngine.solve(c)
    const html = view(c, solved)
    expect(html).toContain('Results: tick each nutrient found')
    expect(html.match(/data-result=/g)).toHaveLength(5)
    expect(html).toContain('5 of 5')
    expect(html).not.toContain('Yes. The results show')
    const partial = { ...solved, stages: { iodine: 1 } }
    expect(view(c, partial).match(/data-result=/g)).toHaveLength(1)
  })

  it('draws the Benedict tube inside its bath and a holder during heating', () => {
    const c = testConfig('reducing-sugar', 'glucose-solution')
    const s: FoodState = { reagent: 'benedict', stages: { benedict: 2 }, answer: null, found: [] }
    const html = view(c, s)
    expect(html).toContain('data-tube-holder="1"')
    expect(html).toContain('80 °C')
    expect(html).toContain('Next: read the tube')
  })

  it('explains what was made when wrong', () => {
    const c = testConfig('starch', 'water')
    const wrong = view(c, { reagent: 'iodine', stages: { iodine: 1 }, answer: true, found: [] }, 'wrong')
    expect(wrong).toContain('The completed tube is orange-brown')
    expect(wrong).toContain('You chose Present')
  })
})

describe('prompts and station matching', () => {
  it('keeps its broad task and nutrient aliases readable', () => {
    expect(foodTestsEngine.parse({ task: 'single test', reagent: 'iodine', food: 'potato' })).toMatchObject({ task: 'test', nutrient: 'starch' })
    expect(foodTestsEngine.parse({ task: 'food test', nutrient: 'vitamin c', sample: 'orange juice' })).toMatchObject({ task: 'test', nutrient: 'vitamin-c' })
    expect(foodTestsEngine.parse({ task: 'unknown', sample: 'milk' })).toMatchObject({ task: 'identify' })
  })

  it('rejects stated results and unsupported actions, with a fix that fits each task', () => {
    const single = testConfig('starch', 'potato')
    expect(foodTestsEngine.promptFaults!(single, 'Test it; iodine will turn blue-black.').join(' ')).toMatch(/gives the experimental result away/)
    expect(foodTestsEngine.promptFaults!(single, 'Drag the food over a Bunsen flame.').join(' ')).toMatch(/promises something/)
    expect(foodTestsEngine.promptFaults!(single, 'Choose Present because starch is present.').join(' ')).toMatch(/gives the experimental result away/)
    expect(foodTestsEngine.promptFaults!(single, goodPrompt(single))).toEqual([])
    const unknown = identifyConfig()
    expect(foodTestsEngine.promptFaults!(unknown, 'Tick starch and protein because they are present.').join(' ')).toMatch(/gives the experimental result away/)
    expect(foodTestsEngine.promptFaults!(unknown, goodPrompt(unknown))).toEqual([])
  })

  it('passes the examples in its own catalogue entry', () => {
    const e = getEngine('food-tests')!
    const found = [...e.prompt.matchAll(/"prompt":"([^"]+)"[\s\S]*?"config": (\{[\s\S]*?\}) \},\n/g)]
    expect(found.length).toBeGreaterThan(0)
    for (const m of found) {
      const config = e.parse(JSON.parse(m[2]))
      expect(config).not.toBeNull()
      expect(e.faults(config!)).toEqual([])
      expect(e.promptFaults!(config!, m[1])).toEqual([])
      expect(e.check(config!, e.initial(config!)).ok).toBe(false)
      expect(e.check(config!, e.solve(config!)).ok).toBe(true)
    }
  })

  it('catches food-test stations and rules out their near misses', () => {
    for (const station of ['Food tests: testing foods for nutrients', 'Iodine test for starch', 'Benedict’s test for reducing sugars', 'Biuret test for protein', 'Ethanol emulsion test for fats', 'DCPIP test for vitamin C']) {
      expect(scenesFor(station).map((e) => e.id), station).toContain('food-tests')
      expect(sceneCatalogue(station), station).toContain('SCENE "food-tests"')
    }
    expect(scenesFor('Separating mixtures using chromatography').map((e) => e.id)).not.toContain('food-tests')
    expect(scenesFor('Enzymes and digestion').map((e) => e.id)).not.toContain('food-tests')
    expect(scenesFor('Testing a leaf for starch in photosynthesis').map((e) => e.id)).not.toContain('food-tests')
    expect(getEngine('food-tests')!.isolates).toBe('membership')
    expect(foodTestsEngine.prompt).toContain('"isolates":"membership"')
  })
})

describe('safe reading of stored work and stage data', () => {
  it('ignores invalid reagents, stages and nutrient selections', () => {
    expect(safeReagent('not-a-reagent')).toBe('iodine')
    expect(stageOf({ stages: { iodine: -4 } }, 'iodine')).toBe(0)
    expect(stageOf({ stages: { iodine: 99 } }, 'iodine')).toBe(1)
    expect(stageOf({ stages: { benedict: NaN } }, 'benedict')).toBe(0)
    expect(completed({ stages: { benedict: 3 } }, 'benedict')).toBe(true)
    expect(REAGENTS.map((r) => actionName(r, 0)).join(' ')).toContain('Add')
    expect(NUTRIENTS.map((n) => NUTRIENT_NAMES[n])).toContain('vitamin C')
  })
})
