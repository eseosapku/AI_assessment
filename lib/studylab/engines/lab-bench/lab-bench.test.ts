import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  labBenchEngine, rightMethods, run, gets, observe, explain, METHODS, MIXTURES, PHRASES, APPARATUS,
  type LabBenchConfig, type MethodId, type MixtureId, type SubstanceId,
} from './config'
import { LabBenchView } from './View'
import { getEngine } from '../registry'
import type { SceneMarked } from '../types'
import { checkIntent } from '../../activities/intent'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const MIXTURE_IDS = Object.keys(MIXTURES) as MixtureId[]
const PAIRS = MIXTURE_IDS.flatMap((mixture) => MIXTURES[mixture].wants.map((want) => ({ mixture, want })))
const config = (mixture: MixtureId, want: SubstanceId): LabBenchConfig => ({ task: { kind: 'separate', mixture, want } })

/** The words that name a method: none may show before the choice is marked. */
const METHOD_WORDS = /filtration|evaporation|crystallisation|simple distillation|fractional distillation|paper chromatography|you used/i

/**
 * Separating mixtures, worked out from the substances' properties: the tutor names a mixture and the part
 * it wants, the learner picks apparatus off the shelf, and the engine runs it and marks it.
 */
describe('the separations, as the engine works them out', () => {
  it('gets each wanted part by the method the syllabus names (0620 12.3 and 12.4), and by no other', () => {
    // The syllabus answers. Where two methods of one family both honestly work, both count.
    const syllabus: Record<string, MethodId[]> = {
      'sand-salt-water sand': ['filtration'],
      'sand-salt-water water': ['simple-distillation', 'fractional-distillation'],
      'salt-water salt': ['evaporation'],
      'salt-water water': ['simple-distillation', 'fractional-distillation'],
      'ethanol-water ethanol': ['fractional-distillation'],
      'ink dyes': ['chromatography'],
      'ink water': ['simple-distillation', 'fractional-distillation'],
      'iron-sulfur iron': ['magnet'],
      'iron-sulfur sulfur': ['magnet'],
    }
    expect(PAIRS).toHaveLength(Object.keys(syllabus).length)
    for (const { mixture, want } of PAIRS) expect(rightMethods(mixture, want), `${mixture} ${want}`).toEqual(syllabus[`${mixture} ${want}`])
  })

  it('lets dissolved salt through the filter paper, and keeps sand back', () => {
    expect(run('sand-salt-water', 'filtration')).toEqual({ method: 'filtration', dry: false, residue: ['sand'], filtrate: ['salt', 'water'] })
    expect(run('salt-water', 'filtration')).toMatchObject({ residue: [], filtrate: ['salt', 'water'] })
  })

  it('never boils a flask dry, so distilling leaves the salt in solution', () => {
    expect(run('salt-water', 'simple-distillation')).toMatchObject({ distillate: ['water'], flask: ['salt', 'water'], reading: 100 })
    expect(gets(run('salt-water', 'simple-distillation'))).toEqual(['water'])
  })

  it('boils ethanol over with water in one boiling, and on its own at 78 °C through a column', () => {
    expect(run('ethanol-water', 'simple-distillation')).toMatchObject({ distillate: ['ethanol', 'water'], reading: null })
    expect(run('ethanol-water', 'fractional-distillation')).toMatchObject({ distillate: ['ethanol'], flask: ['water'], reading: 78 })
  })

  it('makes iron(II) sulfide when iron and sulfur are heated, instead of separating them', () => {
    for (const m of ['evaporation', 'simple-distillation', 'fractional-distillation'] as const) {
      expect(run('iron-sulfur', m)).toMatchObject({ reacted: true })
      expect(gets(run('iron-sulfur', m))).toEqual([])
    }
    expect(run('iron-sulfur', 'magnet')).toEqual({ method: 'magnet', pulled: ['iron'], left: ['sulfur'] })
  })

  it('counts the dyes as got only when chromatography has parted them', () => {
    expect(gets(run('ink', 'evaporation'))).toEqual([])
    expect(gets(run('ink', 'chromatography'))).toEqual(['dyes'])
  })
})

describe('what the learner is told', () => {
  it('describes every run in looks only: no method, and no substance, named', () => {
    for (const mixture of MIXTURE_IDS) {
      for (const method of METHODS) {
        const seen = observe(mixture, method)
        expect(seen.length, `${mixture} ${method}`).toBeGreaterThan(20)
        expect(seen, `${mixture} ${method}`).not.toMatch(METHOD_WORDS)
        expect(seen, `${mixture} ${method}`).not.toMatch(/\b(water|ethanol|salt|sand|dyes?|iron|sulfur|sulfide)\b/i)
      }
    }
    expect(observe('salt-water', 'evaporation')).toBe('Steam rose from the basin until no liquid was left. Left in the basin: white crystals.')
    expect(observe('ethanol-water', 'fractional-distillation')).toMatch(/held at 78 °C/)
  })

  it('says honestly what a wrong method did, and where the wanted part went', () => {
    expect(explain('salt-water', 'filtration', 'salt')).toBe('Filtration let the dissolved salt through with the water; nothing was left on the paper.')
    expect(explain('salt-water', 'simple-distillation', 'salt')).toMatch(/salt stayed in the flask.*never boiled dry/)
    expect(explain('ethanol-water', 'simple-distillation', 'ethanol')).toMatch(/78 °C and 100 °C/)
    expect(explain('sand-salt-water', 'evaporation', 'sand')).toMatch(/sand and salt together/)
    expect(explain('ink', 'evaporation', 'dyes')).toMatch(/not separated/)
    expect(explain('iron-sulfur', 'evaporation', 'iron')).toMatch(/iron\(II\) sulfide, a new substance/)
    expect(explain('salt-water', 'magnet', 'salt')).toBe('Nothing in the salt water is magnetic, so the magnet picked nothing out.')
    expect(explain('salt-water', 'evaporation', 'water')).toMatch(/The water was lost\./)
  })

  it('explains every pair and method in words, naming crystallisation where it also works', () => {
    for (const { mixture, want } of PAIRS) for (const method of METHODS) expect(explain(mixture, method, want).length, `${mixture} ${want} ${method}`).toBeGreaterThan(30)
    expect(explain('salt-water', 'evaporation', 'salt')).toMatch(/Crystallisation/)
    expect(explain('salt-water', 'fractional-distillation', 'water')).toMatch(/column was not needed/)
  })
})

describe('the lab-bench engine', () => {
  it('reads a mixture and a part however they are written, and refuses pairs it cannot honestly mark', () => {
    expect(labBenchEngine.parse({ task: { kind: 'separate', mixture: 'salt water', want: 'salt' } })).toEqual(config('salt-water', 'salt'))
    expect(labBenchEngine.parse({ task: { kind: 'separate', mixture: 'Salt-Water', want: 'The salt' } })).toEqual(config('salt-water', 'salt'))
    expect(labBenchEngine.parse({ task: { kind: 'separate', mixture: 'sea water', want: 'pure water' } })).toEqual(config('salt-water', 'water'))
    expect(labBenchEngine.parse({ task: { kind: 'separate', mixture: 'Iron filings and sulphur', want: 'iron filings' } })).toEqual(config('iron-sulfur', 'iron'))
    expect(labBenchEngine.parse({ task: { kind: 'separate', mixture: 'water and ethanol', want: 'alcohol' } })).toEqual(config('ethanol-water', 'ethanol'))
    expect(labBenchEngine.parse({ task: { kind: 'separate', mixture: 'black ink', want: 'each dye on its own' } })).toEqual(config('ink', 'dyes'))
    // Evaporating sand and water leaves the sand too: two right answers, so it is not offered.
    expect(labBenchEngine.parse({ task: { kind: 'separate', mixture: 'sand and water', want: 'sand' } })).toBeNull()
    // Not in the table: the water left after ethanol distils is not collected on its own.
    expect(labBenchEngine.parse({ task: { kind: 'separate', mixture: 'ethanol and water', want: 'water' } })).toBeNull()
    expect(labBenchEngine.parse({ task: { kind: 'separate', mixture: 'salt water', want: 'sand' } })).toBeNull()
    expect(labBenchEngine.parse({ task: { kind: 'explore', mixture: 'salt water', want: 'salt' } })).toBeNull()
    expect(labBenchEngine.parse({ task: { kind: 'separate', mixture: 42, want: 'salt' } })).toBeNull()
    expect(labBenchEngine.parse(null)).toBeNull()
  })

  it('over every config it reads: starts unsolved, solves, has no faults, and passes exactly the right methods', () => {
    let configs = 0
    for (const phrase of PHRASES.mixtures) {
      for (const { p } of PHRASES.wants) {
        const c = labBenchEngine.parse({ task: { kind: 'separate', mixture: phrase, want: p } })
        if (!c) continue
        configs++
        const { mixture, want } = c.task
        expect(MIXTURES[mixture].wants).toContain(want)
        expect(labBenchEngine.faults(c)).toEqual([])
        expect(labBenchEngine.check(c, labBenchEngine.initial(c)).ok, `${phrase} / ${p} start`).toBe(false)
        expect(labBenchEngine.check(c, labBenchEngine.solve(c)).ok, `${phrase} / ${p} solve`).toBe(true)
        const right = rightMethods(mixture, want)
        for (const method of METHODS) expect(labBenchEngine.check(c, { method }).ok, `${phrase} / ${p} / ${method}`).toBe(right.includes(method))
      }
    }
    expect(configs).toBeGreaterThan(40)
  })

  it('reads no config from random words that is not in its table', () => {
    const words = ['sand', 'salt', 'water', 'sea', 'ink', 'black', 'iron', 'sulfur', 'ethanol', 'alcohol', 'dyes', 'oil', 'and', 'the', 'pure', 'chalk', 'copper', 'sulfate']
    let seed = 7
    const pick = () => words[(seed = (seed * 9301 + 49297) % 233280) % words.length]
    for (let i = 0; i < 400; i++) {
      const c = labBenchEngine.parse({ task: { kind: 'separate', mixture: `${pick()} ${pick()} ${pick()}`, want: pick() } })
      if (c) expect(MIXTURES[c.task.mixture].wants).toContain(c.task.want)
    }
  })

  it('isolates category, and is registered for the tutor with its config in its catalogue entry', () => {
    expect(getEngine('lab-bench')).toBe(labBenchEngine)
    expect(labBenchEngine.isolates).toBe('category')
    expect(labBenchEngine.prompt).toMatch(/SCENE "lab-bench"/)
    expect(labBenchEngine.prompt).toMatch(/"engine":"lab-bench"/)
    expect(labBenchEngine.prompt).toMatch(/"apparatus":"scene:lab-bench"/)
    const spec = { pattern: 'scene', prompt: 'Get the salt out of this salt water.', payload: { engine: 'lab-bench', config: { task: { kind: 'separate', mixture: 'salt water', want: 'salt' } } }, success: { kind: 'scene' } }
    expect(checkIntent({ goal: 'g', isolates: 'category', apparatus: 'scene:lab-bench', why: 'w' }, spec as never).ok).toBe(true)
  })
})

describe('the lab bench on the board', () => {
  const card = (cfg: unknown, prompt: string) =>
    renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'lab-bench', config: cfg }, success: { kind: 'scene' } } },
    } as never)))
  const view = (c: LabBenchConfig, method: MethodId | null, marked: SceneMarked) =>
    renderToStaticMarkup(createElement(LabBenchView, { config: c, state: { method }, setState: () => {}, marked, reduced: true, locked: false }))

  it('draws the mixture and a shelf of six apparatus the keyboard can reach, and names no method', () => {
    for (const { mixture, want } of PAIRS) {
      const prompt = `Separate the ${MIXTURES[mixture].name}.`
      const html = card({ task: { kind: 'separate', mixture, want } }, prompt)
      expect(html).toMatch(/role="group" aria-label="Apparatus shelf"/)
      expect(html.match(/<button[^>]*aria-pressed="false"/g) ?? []).toHaveLength(METHODS.length)
      for (const method of METHODS) expect(html).toContain(APPARATUS[method])
      expect(html.replace(prompt, ''), `${mixture} ${want}`).not.toMatch(METHOD_WORDS)
    }
  })

  it('runs a picked apparatus and shows what it did, without naming the method until it is marked', () => {
    for (const { mixture, want } of PAIRS) {
      for (const method of METHODS) {
        const html = view(config(mixture, want), method, 'idle')
        expect(html, `${mixture} ${want} ${method}`).not.toMatch(METHOD_WORDS)
        expect(html).toMatch(/aria-pressed="true"/)
        expect(html).toContain(observe(mixture, method).replace(/'/g, '&#x27;'))
      }
    }
  })

  it('says what the learner did once marked wrong, and names the method once right', () => {
    const c = config('salt-water', 'salt')
    const wrong = view(c, 'filtration', 'wrong')
    expect(wrong).toMatch(/You used filtration/)
    expect(wrong).toMatch(/Filtration let the dissolved salt through with the water/)
    expect(wrong).toMatch(/salt and water/) // the filtrate, named
    const right = view(c, 'evaporation', 'right')
    expect(right).toMatch(/>Evaporation</)
    expect(right).not.toMatch(/You used/)
  })
})

describe('the prompt a lab-bench card is written with', () => {
  const faults = (prompt: string) => {
    const e = getEngine('lab-bench')!
    return e.promptFaults!(e.parse({ task: { kind: 'separate', mixture: 'iron and sulfur', want: 'iron' } })!, prompt)
  }
  it('may not name the method the learner is to choose', () => {
    expect(faults('Use a magnet to get the iron out.').join(' ')).toMatch(/names the method/)
    expect(faults('Filter out the sand.').join(' ')).toMatch(/names the method/)
    expect(faults('Get the ethanol by distilling it.').join(' ')).toMatch(/names the method/)
    expect(faults('Separate the dyes by chromatography.').join(' ')).toMatch(/names the method/)
    expect(faults('Evaporate the water.').join(' ')).toMatch(/names the method/)
  })
  it('asks for the job instead', () => {
    expect(faults('Get the iron out of this mixture.')).toEqual([])
  })

  it('passes the examples in its own catalogue entry', () => {
    const e = getEngine('lab-bench')!
    const found = [...e.prompt.matchAll(/"prompt":"([^"]+)"[\s\S]*?"config": (\{[\s\S]*?\} \}) \}/g)]
    expect(found.length).toBeGreaterThan(0)
    for (const m of found) expect(e.promptFaults!(e.parse(JSON.parse(m[2]))!, m[1])).toEqual([])
  })
})
