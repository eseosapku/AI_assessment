// lib/studylab/engines/chemical-tests/chemical-tests.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import { readFileSync } from 'node:fs'
import {
  chemicalTestsEngine, CATIONS, ANIONS, FLAMES, GASES, CATION_REAGENTS, ANION_REAGENTS, DETECTORS,
  SOLUTION_RESULTS, candidates, resultOf, observationAt, gasEvent, CORRECT_DETECTOR,
  type ChemicalConfig, type ChemicalState, type SolutionId, type GasId,
} from './config'
import { ChemicalTestsView } from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const raws: unknown[] = [
  ...CATIONS.map((sample) => ({ task: 'solution', sample })),
  ...ANIONS.map((sample) => ({ task: { kind: 'solution', sample } })),
  ...FLAMES.map((sample) => ({ task: 'flame', sample })),
  ...GASES.map((sample) => ({ task: 'gas', sample })),
]

const board = (config: unknown, prompt = 'Perform the test and identify the unknown.') => renderToStaticMarkup(createElement(
  ReactFlowProvider, null, createElement(ActivityNode as never, {
    id: 'ct', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'chemical-tests', config }, success: { kind: 'scene' } } },
  } as never),
))

describe('the qualitative-analysis facts', () => {
  it('has the required cation results, including the two stages', () => {
    expect(resultOf('copper', 'sodium-hydroxide')).toMatchObject({ precipitate: 'light blue', dissolves: false })
    expect(resultOf('copper', 'ammonia')).toMatchObject({ precipitate: 'light blue', dissolves: true, solution: 'dark blue' })
    expect(resultOf('iron-2', 'ammonia')).toMatchObject({ precipitate: 'green', dissolves: false })
    expect(resultOf('iron-3', 'sodium-hydroxide')).toMatchObject({ precipitate: 'red-brown', dissolves: false })
    expect(resultOf('aluminium', 'sodium-hydroxide')).toMatchObject({ precipitate: 'white', dissolves: true })
    expect(resultOf('aluminium', 'ammonia')).toMatchObject({ precipitate: 'white', dissolves: false })
    expect(resultOf('zinc', 'ammonia')).toMatchObject({ precipitate: 'white', dissolves: true })
    expect(resultOf('calcium', 'ammonia')).toMatchObject({ precipitate: null })
  })

  it('has the required anion results', () => {
    expect(resultOf('chloride', 'silver-nitrate').precipitate).toBe('white')
    expect(resultOf('bromide', 'silver-nitrate').precipitate).toBe('cream')
    expect(resultOf('iodide', 'silver-nitrate').precipitate).toBe('yellow')
    expect(resultOf('sulfate', 'barium-nitrate').precipitate).toBe('white')
    expect(resultOf('carbonate', 'dilute-acid').gas).toBe('carbon dioxide')
  })

  it('keeps observation and conclusion separate, with acidification first', () => {
    expect(observationAt('zinc', 'sodium-hydroxide', 1)).toBe('A white precipitate forms.')
    expect(observationAt('zinc', 'sodium-hydroxide', 3)).toMatch(/dissolves in excess/)
    expect(observationAt('chloride', 'silver-nitrate', 1)).toBe('Acidified with dilute nitric acid.')
    expect(observationAt('chloride', 'silver-nitrate', 2)).toBe('A white precipitate forms.')
  })

  it('gives each gas its real positive event and does not invent positives', () => {
    expect(gasEvent('hydrogen', 'glowing-splint')).toBe('pop')
    expect(gasEvent('oxygen', 'glowing-splint')).toBe('relights')
    expect(gasEvent('carbon-dioxide', 'limewater')).toBe('milky')
    expect(gasEvent('ammonia', 'damp-red-litmus')).toBe('blue-litmus')
    expect(gasEvent('chlorine', 'damp-red-litmus')).toBe('bleached-litmus')
    expect(gasEvent('carbon-dioxide', 'glowing-splint')).toBe('splint-out')
    expect(gasEvent('oxygen', 'limewater')).toBe('no-change')
  })
})

describe('reading semantic configs', () => {
  it('reads tasks, aliases, nested tasks and chemical formulae', () => {
    expect(chemicalTestsEngine.parse({ task: 'cation', sample: 'Zn2+' })).toEqual({ task: 'solution', sample: 'zinc' })
    expect(chemicalTestsEngine.parse({ task: { kind: 'anion', sample: 'sulphate ions' } })).toEqual({ task: 'solution', sample: 'sulfate' })
    expect(chemicalTestsEngine.parse({ task: 'flame test', sample: 'K+' })).toEqual({ task: 'flame', sample: 'potassium' })
    expect(chemicalTestsEngine.parse({ task: 'gas test', sample: 'CO2' })).toEqual({ task: 'gas', sample: 'carbon-dioxide' })
    expect(chemicalTestsEngine.parse({ sample: 'oxygen' })).toEqual({ task: 'gas', sample: 'oxygen' })
    expect(chemicalTestsEngine.parse(null)).toBeNull()
    expect(chemicalTestsEngine.parse({ task: 'electrolysis', sample: 'zinc' })).toBeNull()
  })

  it('parses unknown samples but faults them with a nearby usable example', () => {
    const c = chemicalTestsEngine.parse({ task: 'solution', sample: 'ammonium' })!
    expect(chemicalTestsEngine.faults(c)[0]).toMatch(/e\.g\. sample "zinc"/)
    expect(chemicalTestsEngine.faults({ task: 'flame', sample: 'iron-3' })[0]).toMatch(/e\.g\. sample "potassium"/)
    expect(chemicalTestsEngine.faults({ task: 'gas', sample: 'nitrogen' })[0]).toMatch(/e\.g\. sample "oxygen"/)
  })
})

describe('the whole valid config space', { timeout: 30_000 }, () => {
  const configs = raws.map((raw) => chemicalTestsEngine.parse(raw)!).filter(Boolean)
  it('has every sample and no faults', () => {
    expect(configs).toHaveLength(CATIONS.length + ANIONS.length + FLAMES.length + GASES.length)
    for (const c of configs) expect(chemicalTestsEngine.faults(c)).toEqual([])
  })

  it('starts unsolved, solves every card, and never accepts a malformed state', () => {
    for (const config of configs) {
      expect(chemicalTestsEngine.check(config, chemicalTestsEngine.initial(config)).ok, JSON.stringify(config)).toBe(false)
      expect(chemicalTestsEngine.check(config, chemicalTestsEngine.solve(config)), JSON.stringify(config)).toEqual({ ok: true, wrongIds: [] })
      expect(chemicalTestsEngine.check(config, {} as ChemicalState).ok).toBe(false)
      expect(chemicalTestsEngine.check(config, { tests: null, answer: ['bad'] } as unknown as ChemicalState).ok).toBe(false)
    }
  })

  it('does not accept a correct name without the discriminating experiment', () => {
    for (const sample of [...CATIONS, ...ANIONS] as SolutionId[]) {
      const config: ChemicalConfig = { task: 'solution', sample }
      const reagents = ANIONS.includes(sample as never) ? ANION_REAGENTS : CATION_REAGENTS
      const tests = Object.fromEntries(reagents.map((r) => [r, 3]))
      // Every reagent tried is always enough; solve uses only the necessary subset.
      expect(chemicalTestsEngine.check(config, { tests, answer: sample }).ok).toBe(true)
      expect(chemicalTestsEngine.check(config, { tests: {}, answer: sample }).ok).toBe(false)
    }
  })

  it('makes aluminium and zinc genuinely need excess ammonia', () => {
    for (const sample of ['aluminium', 'zinc'] as const) {
      const config: ChemicalConfig = { task: 'solution', sample }
      const naoh = { tests: { 'sodium-hydroxide': 3 }, answer: sample }
      expect(candidates(sample, naoh)).toEqual(['aluminium', 'zinc'])
      expect(chemicalTestsEngine.check(config, naoh).ok).toBe(false)
      expect(chemicalTestsEngine.check(config, chemicalTestsEngine.solve(config)).ok).toBe(true)
    }
  })

  it('does not pass a non-unique gas observation', () => {
    const config: ChemicalConfig = { task: 'gas', sample: 'carbon-dioxide' }
    expect(chemicalTestsEngine.check(config, { detector: 'glowing-splint', stage: 2, answer: 'carbon-dioxide' }).ok).toBe(false)
    expect(chemicalTestsEngine.check(config, { detector: 'limewater', stage: 2, answer: 'carbon-dioxide' }).ok).toBe(true)
  })
})

describe('the catalogue and prompt gates', () => {
  it('registers under the exact id and catches its stations, not its neighbours', () => {
    expect(getEngine('chemical-tests')).toBe(chemicalTestsEngine)
    expect(chemicalTestsEngine.id).toBe('chemical-tests')
    expect(chemicalTestsEngine.isolates).toBe('identity')
    expect(scenesFor('Tests for ions: identifying cations and anions').map((e) => e.id)).toContain('chemical-tests')
    expect(sceneCatalogue('Flame tests for metal ions')).toContain('SCENE "chemical-tests"')
    expect(sceneCatalogue('Paper chromatography and purity')).not.toContain('SCENE "chemical-tests"')
    expect(sceneCatalogue('Titration with acids and alkalis')).not.toContain('SCENE "chemical-tests"')
    expect(sceneCatalogue('Products of electrolysis')).not.toContain('SCENE "chemical-tests"')
  })

  it('rejects prompts that name the unknown or its result', () => {
    expect(chemicalTestsEngine.promptFaults!({ task: 'solution', sample: 'zinc' }, 'Identify the zinc ions.').join(' ')).toMatch(/names the unknown/)
    expect(chemicalTestsEngine.promptFaults!({ task: 'flame', sample: 'potassium' }, 'Watch for a lilac flame.').join(' ')).toMatch(/result away/)
    expect(chemicalTestsEngine.promptFaults!({ task: 'gas', sample: 'oxygen' }, 'See the glowing splint relight.').join(' ')).toMatch(/result away/)
    expect(chemicalTestsEngine.promptFaults!({ task: 'solution', sample: 'chloride' }, 'Find the white precipitate.').join(' ')).toMatch(/result away/)
    expect(chemicalTestsEngine.promptFaults!({ task: 'gas', sample: 'ammonia' }, 'Smell the gas and warm it.').join(' ')).toMatch(/does not provide/)
  })

  it('passes the examples in its own catalogue entry', () => {
    const e = getEngine('chemical-tests')!
    const found = [...e.prompt.matchAll(/"prompt":"([^"]+)"[\s\S]*?"config": (\{[\s\S]*?\}) \}/g)]
    expect(found).toHaveLength(3)
    for (const m of found) {
      const config = e.parse(JSON.parse(m[2]))!
      expect(config).not.toBeNull()
      expect(e.promptFaults!(config, m[1])).toEqual([])
      expect(e.check(config, e.initial(config)).ok).toBe(false)
      expect(e.check(config, e.solve(config)).ok).toBe(true)
    }
  })
})

describe('the card before and after marking', () => {
  it('draws apparatus and real controls for all three task kinds', () => {
    const solution = board({ task: 'solution', sample: 'zinc' })
    expect(solution).toContain('Sodium hydroxide')
    expect(solution).toContain('Add a drop')
    expect(solution).toContain('Select the ion present')
    expect(solution).toContain('unknown')
    const flame = board({ task: 'flame', sample: 'sodium' })
    expect(flame).toContain('Bunsen burner')
    expect(flame).toContain('Wire loop')
    const gas = board({ task: 'gas', sample: 'oxygen' })
    expect(gas).toContain('Glowing splint')
    expect(gas).toContain('Use glowing splint')
  })

  it('shows no answer words before marking, including ARIA and hidden text', () => {
    const tests: { config: ChemicalConfig; answers: RegExp[] }[] = [
      { config: { task: 'solution', sample: 'zinc' }, answers: [/zinc/i, /Zn²⁺/] },
      { config: { task: 'flame', sample: 'potassium' }, answers: [/potassium/i, /lilac/i, /K⁺/] },
      { config: { task: 'gas', sample: 'oxygen' }, answers: [/bursts into flame/i, /relights/i, /O₂/] },
    ]
    for (const { config, answers } of tests) {
      const html = board(config)
      // Answer choices necessarily include all species; inspect everything except the native select.
      const visible = html.replace(/<select[\s\S]*?<\/select>/g, '')
      for (const answer of answers) expect(visible).not.toMatch(answer)
    }
  })

  it('changes the observable as stages are completed, without saying right or wrong', () => {
    const config: ChemicalConfig = { task: 'solution', sample: 'zinc' }
    const view = (state: ChemicalState) => renderToStaticMarkup(createElement(ChemicalTestsView, { config, state, setState: () => {}, marked: 'idle', reduced: true, locked: false }))
    expect(view({ tests: {}, reagent: 'sodium-hydroxide' })).toContain('Nothing added yet')
    const little = view({ tests: { 'sodium-hydroxide': 1 }, reagent: 'sodium-hydroxide' })
    expect(little).toContain('A white precipitate forms.')
    expect(little).not.toContain('dissolves in excess')
    const excess = view({ tests: { 'sodium-hydroxide': 3 }, reagent: 'sodium-hydroxide' })
    expect(excess).toContain('dissolves in excess')
    expect(excess).not.toContain('PrecipitateLayer')
  })

  it('draws each completed gas event', () => {
    for (const gas of GASES) {
      const config: ChemicalConfig = { task: 'gas', sample: gas }
      const html = renderToStaticMarkup(createElement(ChemicalTestsView, {
        config, state: { detector: CORRECT_DETECTOR[gas as GasId], stage: 2, answer: null }, setState: () => {}, marked: 'idle', reduced: true, locked: false,
      }))
      expect(html).not.toContain('No visible change.')
      expect(html).toMatch(/squeaky pop|bursts into flame|turns milky|turns blue|bleached white/)
    }
  })

  it('names the answer and the evidence only once marked', () => {
    const config: ChemicalConfig = { task: 'solution', sample: 'aluminium' }
    const state = chemicalTestsEngine.solve(config)
    const html = renderToStaticMarkup(createElement(ChemicalTestsView, { config, state, setState: () => {}, marked: 'right', reduced: true, locked: true }))
    expect(html).toContain('aluminium ions')
    expect(html).toContain('Al³⁺')
    expect(html).toContain('excess ammonia')
  })

  it('keeps every completed test result in the rule table, for both reagent sets', () => {
    for (const sample of [...CATIONS, ...ANIONS]) {
      const reagents = CATIONS.includes(sample as never) ? CATION_REAGENTS : ANION_REAGENTS
      for (const reagent of reagents) expect(SOLUTION_RESULTS[sample][reagent]).toBeDefined()
    }
    expect(DETECTORS).toHaveLength(4)
  })
})

describe('module loading and reduced motion', () => {
  it('uses literals rather than config constants in top-level view initialisers', () => {
    const source = readFileSync(`${process.cwd()}/lib/studylab/engines/chemical-tests/View.tsx`, 'utf8')
    const top = source.slice(0, source.indexOf('function Plate'))
    expect(top).not.toMatch(/= .*\b(?:MAX_DROPS|CATIONS|ANIONS|FLAMES|GASES|FLAME_COLOURS|REAGENT_NAMES|DETECTOR_NAMES)\b/)
  })

  it('has no animation under reduced motion and still changes with state', () => {
    const config: ChemicalConfig = { task: 'flame', sample: 'copper' }
    const make = (heated: boolean) => renderToStaticMarkup(createElement(ChemicalTestsView, { config, state: { heated, answer: null }, setState: () => {}, marked: 'idle', reduced: true, locked: false }))
    expect(make(false)).toContain('The flame is blue')
    expect(make(true)).toContain('The flame is blue-green')
  })
})
