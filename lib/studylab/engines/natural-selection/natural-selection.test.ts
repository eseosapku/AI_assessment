// lib/studylab/engines/natural-selection/natural-selection.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  naturalSelectionEngine, POPULATION, HUNT_LIMIT, offspringColourCounts, parentColour, cellResistant, cellAlive,
  countsNow, easiestColour, working, madeText, type NaturalSelectionConfig, type SelectionState,
} from './config'
import { NaturalSelectionView, W, H } from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const hunt = (bark: 'light' | 'dark' = 'dark') => naturalSelectionEngine.parse({ task: 'hunt', bark })! as Extract<NaturalSelectionConfig, { task: 'hunt' }>
const dish = (resistant = 3) => naturalSelectionEngine.parse({ task: 'resistance', resistant })! as Extract<NaturalSelectionConfig, { task: 'resistance' }>
const view = (config: NaturalSelectionConfig, state: SelectionState, marked: 'idle' | 'right' | 'wrong' | 'shown' = 'idle', reduced = false) =>
  renderToStaticMarkup(createElement(NaturalSelectionView, { config, state, setState: () => {}, marked, reduced, locked: marked === 'right' }))

describe('selection, inheritance and marking use exact population rules', () => {
  it('starts with variation and inherits only from survivors', () => {
    expect(POPULATION).toBe(10)
    expect(HUNT_LIMIT).toBe(4)
    expect([...Array(POPULATION)].filter((_, i) => parentColour(`m${i}`) === 'dark')).toHaveLength(4)
    expect(offspringColourCounts([])).toEqual({ pale: 6, dark: 4 })
    expect(offspringColourCounts(['m4', 'm5', 'm6', 'm7'])).toEqual({ pale: 3, dark: 7 })
    expect(offspringColourCounts(['m0', 'm1', 'm2', 'm3'])).toEqual({ pale: 10, dark: 0 })
    for (let n = 0; n <= 4; n++) {
      const counts = offspringColourCounts([`m${n}`, `m${n + 4}`, 'm8', 'm9'])
      expect(counts.pale + counts.dark).toBe(POPULATION)
    }
  })

  it('treats contrast against each bark as the visible selection pressure', () => {
    expect(easiestColour(hunt('light'))).toBe('dark')
    expect(easiestColour(hunt('dark'))).toBe('pale')
    const good = naturalSelectionEngine.solve(hunt('dark'))
    expect(good.eaten).toEqual(['m4', 'm5', 'm6', 'm7'])
    expect(naturalSelectionEngine.check(hunt('dark'), good).ok).toBe(true)
    const wrong = naturalSelectionEngine.solve(hunt('light'))
    expect(naturalSelectionEngine.check(hunt('dark'), wrong).ok).toBe(false)
    expect(naturalSelectionEngine.check(hunt('dark'), wrong).wrongIds).toContain('moths')
  })

  it('kills only susceptible cells; resistant cells are present before treatment', () => {
    const c = dish(3)
    expect(cellResistant(c, 'b0')).toBe(true)
    expect(cellResistant(c, 'b5')).toBe(true)
    expect(cellResistant(c, 'b2')).toBe(true)
    expect(cellResistant(c, 'b8')).toBe(false)
    expect(countsNow(c, { dose: 0, generation: 0 })).toMatchObject({ resistant: 3, susceptible: 7, alive: 10 })
    expect(cellAlive(c, 'b0', { dose: 1, generation: 0 })).toBe(true)
    expect(cellAlive(c, 'b8', { dose: 1, generation: 0 })).toBe(false)
    expect(countsNow(c, { dose: 1, generation: 0 })).toMatchObject({ resistant: 3, susceptible: 0, alive: 3 })
    expect(countsNow(c, { dose: 1, generation: 1 })).toMatchObject({ resistant: 10, alive: 10 })
  })

  it('explains a wrong hunt by what the learner actually made', () => {
    const c = hunt('light')
    expect(madeText(c, { eaten: [], generation: 0 })).toMatch(/Eat exactly 4/)
    expect(madeText(c, { eaten: ['m0', 'm1', 'm2', 'm3'], generation: 0 })).toMatch(/have not reproduced/)
    expect(madeText(c, { eaten: ['m0', 'm1', 'm2', 'm3'], generation: 1 })).toMatch(/10 pale and 0 dark/)
    expect(working(c, naturalSelectionEngine.solve(c))).toMatch(/population changed/i)
    expect(working(dish(), naturalSelectionEngine.solve(dish()))).toMatch(/did not create it/)
  })

  it('never accepts malformed stored work', () => {
    expect(naturalSelectionEngine.check(hunt(), {} as SelectionState).ok).toBe(false)
    expect(naturalSelectionEngine.check(dish(), null as unknown as SelectionState).ok).toBe(false)
    expect(naturalSelectionEngine.check(hunt(), { eaten: ['bogus', 'm4'], dose: 0, generation: 1 }).ok).toBe(false)
  })
})

describe('reading and refusing tutor configs', () => {
  it('reads the task, environment and initial variation in ordinary lesson language', () => {
    expect(naturalSelectionEngine.parse({ task: 'peppered moth', environment: 'sooty' })).toEqual({ task: 'hunt', bark: 'dark' })
    expect(naturalSelectionEngine.parse({ task: 'camouflage', tree: 'clean birch' })).toEqual({ task: 'hunt', bark: 'light' })
    expect(naturalSelectionEngine.parse({ task: 'antibiotic resistance', resistant: '5 cells' })).toEqual({ task: 'resistance', resistant: 5 })
    expect(naturalSelectionEngine.parse({ kind: 'bacteria', initialResistant: 2 })).toEqual({ task: 'resistance', resistant: 2 })
    expect(naturalSelectionEngine.parse({ task: 'hunt' })).toEqual({ task: 'hunt', bark: 'light' })
    expect(naturalSelectionEngine.parse({ task: 'resistance' })).toEqual({ task: 'resistance', resistant: 3 })
    expect(naturalSelectionEngine.parse(null)).toBeNull()
    expect(naturalSelectionEngine.parse({ task: 'selective breeding' })).toBeNull()
  })

  it('refuses only configurations that cannot give a clear event, with a nearby example', () => {
    expect(naturalSelectionEngine.faults(hunt('light'))).toEqual([])
    expect(naturalSelectionEngine.faults(hunt('dark'))).toEqual([])
    expect(naturalSelectionEngine.faults(naturalSelectionEngine.parse({ task: 'hunt', bark: 'striped' })!)[0]).toMatch(/use light.*or dark.*bark "dark"/)
    for (const n of [0, -1, 8, 20, 2.5]) {
      const c = naturalSelectionEngine.parse({ task: 'resistance', resistant: n })!
      expect(c).not.toBeNull()
      expect(naturalSelectionEngine.faults(c)[0]).toMatch(/use 1 to 7.*resistant 3/)
    }
    for (let n = 1; n <= 7; n++) expect(naturalSelectionEngine.faults(dish(n))).toEqual([])
  })
})

describe('every valid configuration', { timeout: 30_000 }, () => {
  const all: NaturalSelectionConfig[] = [
    ...(['light', 'dark'] as const).map((bark) => hunt(bark)),
    ...Array.from({ length: 7 }, (_, i) => dish(i + 1)),
  ]

  it('starts unsolved, always solves, and has a population of ten', () => {
    expect(all).toHaveLength(9)
    for (const config of all) {
      const start = naturalSelectionEngine.initial(config)
      const solved = naturalSelectionEngine.solve(config)
      expect(naturalSelectionEngine.check(config, start).ok, JSON.stringify(config)).toBe(false)
      expect(naturalSelectionEngine.check(config, solved), JSON.stringify(config)).toEqual({ ok: true, wrongIds: [] })
      expect(countsNow(config, solved).alive).toBe(POPULATION)
      expect(naturalSelectionEngine.faults(config)).toEqual([])
    }
  })
})

describe('the prompt and station catalogue', () => {
  it('may not print the outcome the learner is meant to discover', () => {
    const h = hunt('dark')
    expect(naturalSelectionEngine.promptFaults!(h, 'Eat the pale moths because they are easiest to spot.').join(' ')).toMatch(/gives the answer away/)
    expect(naturalSelectionEngine.promptFaults!(h, 'The survivors have 7 dark and 3 pale offspring.').join(' ')).toMatch(/gives the answer away/)
    const d = dish()
    expect(naturalSelectionEngine.promptFaults!(d, 'Resistant bacteria survive and all ten are resistant.').join(' ')).toMatch(/gives the answer away/)
    expect(naturalSelectionEngine.promptFaults!(d, 'Drag to start a timed graph with dice.').join(' ')).toMatch(/promises something/)
  })

  it('passes the examples in its own catalogue entry', () => {
    const e = getEngine('natural-selection')!
    const found = [...e.prompt.matchAll(/"prompt":"([^"]+)"[\s\S]*?"config": (\{[\s\S]*?\}) \}/g)]
    expect(found.length).toBeGreaterThan(0)
    for (const m of found) expect(e.promptFaults!(e.parse(JSON.parse(m[2]))!, m[1])).toEqual([])
  })

  it('catches its stations, not genetics, keys, probability or selective breeding', () => {
    expect(scenesFor('Natural selection and evolution').map((e) => e.id)).toContain('natural-selection')
    expect(scenesFor('Antibiotic resistance in bacteria').map((e) => e.id)).toContain('natural-selection')
    expect(scenesFor('Survival of the fittest').map((e) => e.id)).toContain('natural-selection')
    expect(scenesFor('Monohybrid crosses and Punnett squares').map((e) => e.id)).not.toContain('natural-selection')
    expect(scenesFor('Continuous and discontinuous variation').map((e) => e.id)).not.toContain('natural-selection')
    expect(scenesFor('Selective breeding and artificial selection').map((e) => e.id)).not.toContain('natural-selection')
    expect(sceneCatalogue('Natural selection and evolution')).toContain('SCENE "natural-selection"')
    expect(sceneCatalogue('Classification keys')).not.toContain('SCENE "natural-selection"')
    expect(getEngine('natural-selection')!.isolates).toBe('consequence')
    expect(getEngine('natural-selection')!.prompt).toMatch(/"isolates":"consequence"/)
  })
})

describe('the drawing on the board', () => {
  const card = (config: unknown, prompt: string) =>
    renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'natural-selection', config }, success: { kind: 'scene' } } },
    } as never)))

  it('has real buttons with accessible gesture names, and no smaller text in its own scene', () => {
    const html = view(hunt(), { eaten: [], dose: 0, generation: 0 })
    expect(html.match(/aria-label="Eat (?:pale|dark) moth \d+"/g)).toHaveLength(10)
    expect(html).not.toMatch(/Let the surviving moths reproduce/)
    expect(view(hunt(), { eaten: ['m4', 'm5', 'm6', 'm7'], generation: 0 })).toMatch(/Let the surviving moths reproduce/)
    expect(html).toMatch(/Soot-dark bark/)
    const d = view(dish(), { eaten: [], dose: 0, generation: 0 })
    expect(d).toMatch(/Give the antibiotic dose/)
    expect(d).toMatch(/Resistant/)
    expect(d).toMatch(/Susceptible/)
  })

  it('shows no outcome or explanation before marking, including screen-reader text', () => {
    const prompt = 'On soot-dark bark, be the bird. Tap 4 moths to eat them, then let the survivors reproduce. Eat the four that are easiest to spot.'
    const html = card({ task: 'hunt', bark: 'dark' }, prompt).replace(prompt, '')
    expect(html).not.toMatch(/easier for the bird|population changed|did not change colour|did not create|selected resistance/)
    const dPrompt = 'Tap the antibiotic dose, then let the survivors reproduce. Watch what the next generation is made of.'
    const d = card({ task: 'resistance', resistant: 3 }, dPrompt).replace(dPrompt, '')
    expect(d).not.toMatch(/did not create|selected resistance|were already present|all 10 bacteria/)
  })

  it('changes the picture with each action, and the marked sentence with the result', () => {
    const c = hunt('dark')
    const before = view(c, { eaten: [], generation: 0 })
    const after = view(c, { eaten: ['m4'], generation: 0 })
    expect(after).not.toBe(before)
    const next = view(c, naturalSelectionEngine.solve(c), 'right')
    expect(next).toMatch(/next generation has 7 dark moths/)
    const wrong = view(c, { eaten: ['m0', 'm1', 'm2', 'm3'], generation: 1 }, 'wrong')
    expect(wrong).toMatch(/You ate 0 pale moths and 4 dark moths/)
    const d = view(dish(), { eaten: [], dose: 1, generation: 1 }, 'right')
    expect(d).toMatch(/antibiotic selected resistance/)
  })

  it('keeps a still, state-dependent frame under reduced motion', () => {
    const c = hunt('dark')
    const a = view(c, { eaten: [], generation: 0 }, 'idle', true)
    const b = view(c, { eaten: ['m4', 'm5', 'm6', 'm7'], generation: 1 }, 'idle', true)
    expect(a).not.toBe(b)
    expect(a).not.toMatch(/transition:/)
    expect(b).not.toMatch(/transition:/)
    const d = view(dish(), { eaten: [], dose: 1, generation: 1 }, 'idle', true)
    expect(d).not.toMatch(/transition:/)
  })

  it('uses the same panel geometry in the view and its expected compact design', () => {
    expect(W).toBe(360)
    expect(H).toBe(244)
  })
})
