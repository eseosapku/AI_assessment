// lib/studylab/engines/periodic-groups/periodic-groups.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  periodicGroupsEngine, ALKALIS, ALKALI_IDS, HALOGENS, HALOGEN_IDS, HALIDES, HALIDE_IDS,
  displaces, neededHalogen, stageOf, addedOf, answerOf, equationOf, working, madeText,
  type PeriodicConfig, type PeriodicState, type HalideId,
} from './config'
import { PeriodicGroupsView, halideColours, W, H, METAL_CHOICES, HALOGEN_CHOICES } from './View'
import { CARD_WIDTH, CARD_HEIGHT } from './config'
import { getEngine, scenesFor, sceneCatalogue } from '../registry'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const valid: PeriodicConfig[] = [
  ...ALKALI_IDS.map((metal): PeriodicConfig => ({ task: 'water', metal })),
  ...HALIDE_IDS.filter((h) => !h.endsWith('chloride')).map((halide): PeriodicConfig => ({ task: 'halide', halide })),
]
const view = (config: PeriodicConfig, state: PeriodicState, marked: 'idle' | 'right' | 'wrong' | 'shown' = 'idle', reduced = false) =>
  renderToStaticMarkup(createElement(PeriodicGroupsView, { config, state, setState: () => {}, marked, reduced, locked: marked === 'right' }))

describe('the real group rules', () => {
  it('has the three distinct school observations and the correct hydroxides', () => {
    expect(ALKALI_IDS).toEqual(['lithium', 'sodium', 'potassium'])
    expect(ALKALIS.lithium.melts).toBe(false)
    expect(ALKALIS.sodium.melts).toBe(true)
    expect(ALKALIS.potassium.flame).toBe(true)
    expect(ALKALIS.potassium.bubbles).toBeGreaterThan(ALKALIS.sodium.bubbles)
    expect(ALKALIS.sodium.bubbles).toBeGreaterThan(ALKALIS.lithium.bubbles)
    expect(ALKALIS.lithium.hydroxide).toBe('lithium hydroxide')
    expect(ALKALIS.sodium.hydroxide).toBe('sodium hydroxide')
    expect(ALKALIS.potassium.hydroxide).toBe('potassium hydroxide')
    expect(equationOf({ task: 'water', metal: 'sodium' })).toBe('2Na + 2H₂O → 2NaOH + H₂')
  })

  it('ranks chlorine, bromine and iodine for displacement', () => {
    expect(HALOGEN_IDS).toEqual(['chlorine', 'bromine', 'iodine'])
    expect(displaces('chlorine', 'potassium-bromide')).toBe(true)
    expect(displaces('chlorine', 'sodium-iodide')).toBe(true)
    expect(displaces('bromine', 'sodium-iodide')).toBe(true)
    expect(displaces('iodine', 'sodium-bromide')).toBe(false)
    expect(displaces('bromine', 'potassium-chloride')).toBe(false)
    expect(displaces('chlorine', 'potassium-bromide')).toBe(true)
    expect(neededHalogen({ task: 'halide', halide: 'sodium-iodide' })).toBe('bromine')
    expect(neededHalogen({ task: 'halide', halide: 'potassium-bromide' })).toBe('chlorine')
    expect(equationOf({ task: 'halide', halide: 'potassium-bromide' }, 'chlorine')).toBe('Cl₂ + 2KBr → 2KCl + Br₂')
  })

  it('names the real halides, never chlorides for a solvable task', () => {
    expect(HALIDES['sodium-iodide'].formula).toBe('NaI')
    expect(HALIDES['potassium-bromide'].halogen).toBe('bromine')
    expect(valid.filter((c) => c.task === 'halide')).toHaveLength(4)
  })

  it('uses the water control to separate dilution from displacement', () => {
    const reacting: PeriodicConfig = { task: 'halide', halide: 'potassium-bromide' }
    expect(halideColours(reacting, 'chlorine', 0)).toEqual({ control: expect.any(String), test: expect.any(String), product: false })
    expect(halideColours(reacting, 'chlorine', 1).control).toBe(HALOGENS.chlorine.liquid)
    expect(halideColours(reacting, 'chlorine', 1).product).toBe(false)
    expect(halideColours(reacting, 'chlorine', 2).test).toBe(HALOGENS.bromine.liquid)
    expect(halideColours(reacting, 'chlorine', 2).product).toBe(true)
    expect(halideColours(reacting, 'bromine', 2).test).toBe(HALOGENS.bromine.liquid)
    expect(halideColours(reacting, 'bromine', 2).product).toBe(false)
  })
})

describe('reading what the tutor wrote', () => {
  it('reads names, symbols, task aliases and nested tasks', () => {
    const p = periodicGroupsEngine.parse
    expect(p({ task: 'water', metal: 'Na' })).toEqual({ task: 'water', metal: 'sodium' })
    expect(p({ task: { kind: 'alkali-metals', sample: 'Li' } })).toEqual({ task: 'water', metal: 'lithium' })
    expect(p({ task: 'group-1', metal: 'potassium' })).toEqual({ task: 'water', metal: 'potassium' })
    expect(p({ task: 'halogen-displacement', halide: 'KBr' })).toEqual({ task: 'halide', halide: 'potassium-bromide' })
    expect(p({ task: 'halides', salt: 'sodium iodide solution' })).toEqual({ task: 'halide', halide: 'sodium-iodide' })
    expect(p({ halide: 'NaI' })).toEqual({ task: 'halide', halide: 'sodium-iodide' })
    expect(p({ metal: 'sodium' })).toEqual({ task: 'water', metal: 'sodium' })
    expect(p({ task: 'nonsense' })).toBeNull()
    expect(p(null)).toBeNull()
    expect(p('sodium')).toBeNull()
  })

  it('refuses narrowly, with a nearby working example', () => {
    expect(periodicGroupsEngine.faults({ task: 'water', metal: 'rubidium' })).toEqual([
      'There is no "rubidium" water sample drawn here: use lithium, sodium or potassium, e.g. metal "sodium".',
    ])
    expect(periodicGroupsEngine.faults({ task: 'halide', halide: 'potassium-fluoride' })[0]).toMatch(/e.g. halide "potassium-bromide"/)
    expect(periodicGroupsEngine.faults({ task: 'halide', halide: 'sodium-chloride' })[0]).toMatch(/No halogen.*use a bromide or iodide.*potassium-bromide/)
    for (const c of valid) expect(periodicGroupsEngine.faults(c)).toEqual([])
  })
})

describe('every valid configuration', { timeout: 30_000 }, () => {
  it('starts unsolved and solve passes check', () => {
    for (const config of valid) {
      const start = periodicGroupsEngine.initial(config)
      const solved = periodicGroupsEngine.solve(config)
      expect(periodicGroupsEngine.check(config, start).ok, JSON.stringify(config)).toBe(false)
      expect(periodicGroupsEngine.check(config, solved), JSON.stringify(config)).toEqual({ ok: true, wrongIds: [] })
    }
  })

  it('cannot pass by naming the answer without doing the experiment', () => {
    for (const config of valid) {
      const answer = config.task === 'water' ? config.metal : config.task === 'halide' ? HALIDES[config.halide as HalideId].halogen : null
      expect(periodicGroupsEngine.check(config, { answer }).ok).toBe(false)
    }
  })

  it('accepts only the actual metal or halogen after the full successful test', () => {
    for (const config of valid) {
      const solved = periodicGroupsEngine.solve(config)
      for (const wrong of config.task === 'water' ? ALKALI_IDS : HALOGEN_IDS) {
        const state = { ...solved, answer: wrong }
        expect(periodicGroupsEngine.check(config, state).ok).toBe(config.task === 'water' ? wrong === config.metal : wrong === HALIDES[config.halide as HalideId].halogen)
      }
    }
  })

  it('rejects stored work outside the experiment', () => {
    const c: PeriodicConfig = { task: 'water', metal: 'sodium' }
    expect(periodicGroupsEngine.check(c, {} as PeriodicState).ok).toBe(false)
    expect(periodicGroupsEngine.check(c, { tested: true, stage: 99, answer: 'sodium' }).ok).toBe(true)
    expect(stageOf(c, { stage: 99 })).toBe(3)
    expect(stageOf(c, { stage: -4 })).toBe(0)
    expect(stageOf(c, { stage: NaN })).toBe(0)
    expect(addedOf({ added: 4 } as never)).toBeNull()
    expect(answerOf({ answer: false } as never)).toBeNull()
  })
})

describe('the prompt an experiment is written with', () => {
  const faults = (c: PeriodicConfig, p: string) => periodicGroupsEngine.promptFaults!(c, p)
  it('may not give away the water sample or its observation', () => {
    const c: PeriodicConfig = { task: 'water', metal: 'potassium' }
    expect(faults(c, 'Watch the potassium burn with a lilac flame.').join(' ')).toMatch(/gives.*away/)
    expect(faults(c, 'It melts into a ball; reactivity increases down Group I.').join(' ')).toMatch(/gives.*away/)
    expect(faults(c, 'Drop the sample in and watch each stage. Then name the unknown alkali metal from what you see.')).toEqual([])
  })

  it('may not give away the halogen reagent or displacement result', () => {
    const c: PeriodicConfig = { task: 'halide', halide: 'sodium-iodide' }
    expect(faults(c, 'Add bromine water; it is more reactive and displaces iodine.').join(' ')).toMatch(/names the reagent, result or explanation/)
    expect(faults(c, 'Watch it turn brown.').join(' ')).toMatch(/names the reagent, result or explanation/)
    expect(faults(c, 'Choose a halogen water, add drops to the water control and then to the sodium iodide. Compare the wells and name the halogen in the original halide.')).toEqual([])
  })

  it('passes the examples in its own catalogue entry', () => {
    const e = getEngine('periodic-groups')!
    const found = [...e.prompt.matchAll(/"prompt":"([^"]+)"[\s\S]*?"config":\s*(\{[^}]*\})/g)]
    expect(found.length).toBeGreaterThan(0)
    for (const m of found) {
      const config = e.parse(JSON.parse(m[2]))!
      expect(e.faults(config)).toEqual([])
      expect(e.check(config, e.initial(config)).ok).toBe(false)
      expect(e.check(config, e.solve(config)).ok).toBe(true)
      expect(e.promptFaults!(config, m[1])).toEqual([])
    }
  })
})

describe('registration and neighbouring stations', () => {
  it('uses the exact scene id and matching isolates in its examples', () => {
    expect(getEngine('periodic-groups')).toBe(periodicGroupsEngine)
    expect(periodicGroupsEngine.id).toBe('periodic-groups')
    expect(periodicGroupsEngine.isolates).toBe('consequence')
    expect(periodicGroupsEngine.prompt).toContain('"apparatus":"scene:periodic-groups"')
    expect(periodicGroupsEngine.prompt).toContain('"isolates":"consequence"')
  })

  it('catches its own stations, not its neighbours', async () => {
    await import('../reactivity-series/config')
    expect(scenesFor('Group I: the alkali metals').map((e) => e.id)).toContain('periodic-groups')
    expect(scenesFor('Group VII: halogen displacement reactions').map((e) => e.id)).toContain('periodic-groups')
    expect(scenesFor('Trends in groups in the Periodic Table').map((e) => e.id)).toContain('periodic-groups')
    expect(scenesFor('The noble gases').map((e) => e.id)).not.toContain('periodic-groups')
    expect(scenesFor('Transition elements: coloured compounds and catalysts').map((e) => e.id)).not.toContain('periodic-groups')
    expect(scenesFor('Reactivity series and metal displacement').map((e) => e.id)).not.toContain('periodic-groups')
    expect(scenesFor('Atomic structure and electron shells').map((e) => e.id)).not.toContain('periodic-groups')
    expect(sceneCatalogue('Group VII: the halogens')).toContain('SCENE "periodic-groups"')
  })
})

describe('the drawing and what it hides', () => {
  const card = (config: unknown, prompt: string) =>
    renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'periodic-groups', config }, success: { kind: 'scene' } } },
    } as never)))

  it('does not name the unknown, products or result before marking, even for a screen reader', () => {
    for (const metal of ALKALI_IDS) {
      const prompt = 'Drop the sample in and watch each stage. Then name the unknown alkali metal from what you see.'
      const html = card({ task: 'water', metal }, prompt).replace(prompt, '')
      expect(html).not.toMatch(/lithium|sodium|potassium|Li|Na|KOH|H₂|hydrogen|hydroxide|lilac|silvery ball/)
      expect(html).toContain('Unknown sample')
      expect(html).toContain('Drop it in')
    }
    const prompt = 'Choose a halogen water, add drops to the water control and then to the potassium bromide. Compare the wells and name the halogen in the original halide.'
    const html = card({ task: 'halide', halide: 'potassium-bromide' }, prompt).replace(prompt, '').replace(/potassium bromide/g, '').replace(/Potassium bromide/g, '')
    expect(html).not.toMatch(/displac|more reactive|Cl₂|Br₂|KCl/)
    expect(html).toContain('Water control')
    expect(html).toContain('Add to control')
  })

  it('draws the actual stages in full motion and reduced motion', () => {
    const sodium: PeriodicConfig = { task: 'water', metal: 'sodium' }
    expect(view(sodium, { tested: true, stage: 2 }, 'idle', true)).toContain('silvery ball')
    expect(view(sodium, { tested: true, stage: 2 }, 'idle', true)).not.toContain('<animate')
    expect(view(sodium, { tested: true, stage: 2 }, 'idle', false)).toContain('<animate')
    const potassium: PeriodicConfig = { task: 'water', metal: 'potassium' }
    const flame = view(potassium, { tested: true, stage: 2 }, 'idle', true)
    expect(flame).toContain('lilac flame')
    expect(flame).toContain('#9B78C6')
    expect(view(sodium, { tested: true, stage: 3 })).toContain('Name the sample')
    expect(view(sodium, { tested: true, stage: 3 })).toContain('data-choice="lithium"')
  })

  it('runs a halide experiment in two labelled stages, including no change', () => {
    const c: PeriodicConfig = { task: 'halide', halide: 'sodium-iodide' }
    expect(view(c, { added: 'bromine', stage: 1 })).toContain('Add to halide')
    expect(view(c, { added: 'bromine', stage: 1 })).toContain('Compare dilution')
    expect(view(c, { added: 'bromine', stage: 2 })).toContain('Name the halogen')
    expect(view(c, { added: 'iodine', stage: 2 })).toContain('Change reagent')
    expect(view(c, { added: 'iodine', stage: 2 })).toContain('Both wells look the same')
  })

  it('orders identification choices independently of the answer', () => {
    expect([...METAL_CHOICES].sort()).toEqual([...METAL_CHOICES])
    expect([...HALOGEN_CHOICES].sort()).toEqual([...HALOGEN_CHOICES])
    for (const c of valid) {
      const html = view(c, c.task === 'water' ? { tested: true, stage: 3 } : { added: neededHalogen(c), stage: 2 })
      const choices = [...html.matchAll(/data-choice="([^"]+)"/g)].map((m) => m[1])
      expect(choices).toEqual(c.task === 'water' ? [...METAL_CHOICES] : [...HALOGEN_CHOICES])
    }
  })

  it('says the science and equation only with a successful mark', () => {
    const c: PeriodicConfig = { task: 'water', metal: 'sodium' }
    const solved = periodicGroupsEngine.solve(c)
    const right = view(c, solved, 'right')
    expect(right).toContain('sodium hydroxide')
    expect(right).toContain('2Na + 2H₂O → 2NaOH + H₂')
    expect(view(c, solved, 'wrong')).not.toContain('2Na + 2H₂O')
    const h: PeriodicConfig = { task: 'halide', halide: 'sodium-iodide' }
    expect(view(h, periodicGroupsEngine.solve(h), 'right')).toContain('Br₂ + 2NaI → 2NaBr + I₂')
  })

  it('has accessible real buttons and no custom Check control', () => {
    const html = view({ task: 'water', metal: 'lithium' }, periodicGroupsEngine.initial({ task: 'water', metal: 'lithium' }))
    expect(html).toContain('aria-label="Drop the sample into the cold water"')
    expect(html).not.toContain('>Check<')
    expect(W).toBe(CARD_WIDTH)
    expect(H).toBe(CARD_HEIGHT)
  })
})

describe('the marked sentences', () => {
  it('says what was made or what remains to be done', () => {
    const c: PeriodicConfig = { task: 'water', metal: 'lithium' }
    expect(working(c, periodicGroupsEngine.solve(c))).toMatch(/sample was lithium.*lithium hydroxide/)
    expect(madeText(c, { tested: false, stage: 0 })).toMatch(/not finished/)
    expect(madeText(c, { tested: true, stage: 3, answer: 'potassium' })).toMatch(/You chose potassium.*identifies.*lithium/)
    const h: PeriodicConfig = { task: 'halide', halide: 'sodium-iodide' }
    expect(madeText(h, { added: 'iodine', stage: 2 })).toMatch(/cannot displace.*control.*diluted/)
    expect(madeText(h, { added: 'bromine', stage: 2, answer: 'chlorine' })).toMatch(/You chose chlorine, but the test well made brown iodine.*not chlorine/)
  })
})
