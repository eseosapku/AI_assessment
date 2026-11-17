// lib/studylab/engines/organic-chemistry/organic-chemistry.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import { organicChemistryEngine as engine, targetMolecule, moleculeOf, connected, carbonValence, type OrganicConfig, type OrganicState } from './config'
import { carbonPoints, moleculeDrawing } from './View'
import { getEngine, scenesFor, sceneCatalogue } from '../registry'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const good: OrganicConfig[] = [
  { task: 'build', family: 'alkane', carbons: 1, isomer: 0 },
  { task: 'build', family: 'alkane', carbons: 2, isomer: 0 },
  { task: 'build', family: 'alkane', carbons: 3, isomer: 0 },
  { task: 'build', family: 'alkane', carbons: 4, isomer: 0 },
  { task: 'build', family: 'alkane', carbons: 4, isomer: 1 },
  { task: 'build', family: 'alkene', carbons: 2, isomer: 0 },
  { task: 'build', family: 'alkene', carbons: 3, isomer: 0 },
  { task: 'build', family: 'alkene', carbons: 4, isomer: 0 },
  { task: 'build', family: 'alkene', carbons: 4, isomer: 1 },
  { task: 'build', family: 'alcohol', carbons: 1, isomer: 0 },
  { task: 'build', family: 'alcohol', carbons: 2, isomer: 0 },
  { task: 'build', family: 'alcohol', carbons: 3, isomer: 0 },
  { task: 'build', family: 'alcohol', carbons: 3, isomer: 1 },
  { task: 'build', family: 'alcohol', carbons: 4, isomer: 3 },
  { task: 'build', family: 'acid', carbons: 1, isomer: 0 },
  { task: 'build', family: 'acid', carbons: 2, isomer: 0 },
  { task: 'build', family: 'acid', carbons: 3, isomer: 0 },
  { task: 'build', family: 'acid', carbons: 4, isomer: 0 },
  ...(['bromine', 'hydrogen', 'steam'] as const).flatMap((reagent) => [2, 3, 4].filter((n) => reagent !== 'steam' || n === 2).map((carbons) => ({ task: 'add', carbons, reagent }) as OrganicConfig)),
  ...['ethene', 'propene', 'chloroethene'].map((monomer) => ({ task: 'polymer', monomer }) as OrganicConfig),
]

describe('the molecular graph, not its drawing, is marked', () => {
  it('connects carbons and counts all four bonds', () => {
    const m = targetMolecule({ task: 'build', family: 'alkene', carbons: 2, isomer: 0 })
    expect(connected(m)).toBe(true)
    expect(carbonValence(m, 0)).toBe(2)
    expect(moleculeDrawing(m).atoms.filter((a) => a.label === 'H')).toHaveLength(4)
    const acid = targetMolecule({ task: 'build', family: 'acid', carbons: 2, isomer: 0 })
    expect(carbonValence(acid, 0)).toBe(4)
    expect(moleculeDrawing(acid).atoms.filter((a) => a.label === 'O')).toHaveLength(2)
  })

  it('accepts a target with its atoms renumbered and construction order changed', () => {
    const c: OrganicConfig = { task: 'build', family: 'alkene', carbons: 4, isomer: 1 }
    const s: OrganicState = { n: 4, edges: [[0, 3, 1], [3, 2, 2], [2, 1, 1]], groups: {} }
    expect(engine.check(c, s).ok).toBe(true)
  })

  it('recognises the branched butane isomer, and rejects an unconnected graph', () => {
    const c: OrganicConfig = { task: 'build', family: 'alkane', carbons: 4, isomer: 1 }
    expect(engine.check(c, { n: 4, edges: [[0, 2, 1], [2, 1, 1], [2, 3, 1]], groups: {} }).ok).toBe(true)
    expect(engine.check(c, { n: 4, edges: [[0, 1, 1], [1, 2, 1]], groups: {} }).ok).toBe(false)
    expect(engine.check(c, { n: 4, edges: [[0, 1, 1], [1, 2, 1], [2, 3, 1]], groups: {} }).ok).toBe(false)
  })

  it('never accepts impossible valence or corrupt stored work', () => {
    const c: OrganicConfig = { task: 'build', family: 'alkane', carbons: 2, isomer: 0 }
    expect(engine.check(c, {} as OrganicState).ok).toBe(false)
    expect(engine.check(c, { n: 2, edges: [[0, 1, 2]], groups: {} }).ok).toBe(false)
    expect(moleculeOf(null, { n: 1, edges: [], groups: {} }).n).toBe(1)
  })
})

describe('reading the tutor config', () => {
  it('reads ordinary names, nested tasks and numeric strings', () => {
    expect(engine.parse({ task: { kind: 'displayed formula', family: 'alcohols', carbons: '3', isomer: '1' } })).toEqual({ task: 'build', family: 'alcohol', carbons: 3, isomer: 1 })
    expect(engine.parse({ task: 'bromine water', carbons: 2 })).toEqual({ task: 'add', carbons: 2, reagent: 'bromine' })
    expect(engine.parse({ task: 'addition polymerisation', monomer: 'PVC' })).toEqual({ task: 'polymer', monomer: 'pvc' })
    expect(engine.parse({ monomer: 'poly-propene' })).toEqual({ task: 'polymer', monomer: 'propene' })
    expect(engine.parse(null)).toBeNull()
  })

  it('refuses narrowly, with a working nearby example', () => {
    expect(engine.faults({ task: 'build', family: 'alkyne', carbons: 2, isomer: 0 }).join(' ')).toMatch(/family "alkene"/)
    expect(engine.faults({ task: 'build', family: 'alkane', carbons: 9, isomer: 0 }).join(' ')).toMatch(/1 to 4/)
    expect(engine.faults({ task: 'build', family: 'alkene', carbons: 1, isomer: 0 }).join(' ')).toMatch(/at least two/)
    expect(engine.faults({ task: 'add', carbons: 3, reagent: 'steam' }).join(' ')).toMatch(/carbons 2/)
    expect(engine.faults({ task: 'polymer', monomer: 'styrene' }).join(' ')).toMatch(/ethene, propene or chloroethene/)
  })
})

describe('every valid configuration', { timeout: 30_000 }, () => {
  it('starts unsolved and always has a connected, valence-correct solution', () => {
    expect(good.length).toBeGreaterThanOrEqual(25)
    for (const config of good) {
      expect(engine.faults(config), JSON.stringify(config)).toEqual([])
      expect(engine.check(config, engine.initial(config)).ok, JSON.stringify(config)).toBe(false)
      expect(engine.check(config, engine.solve(config)), JSON.stringify(config)).toEqual({ ok: true, wrongIds: [] })
      if (config.task === 'build') {
        const m = moleculeOf(engine.solve(config), targetMolecule(config))
        expect(connected(m)).toBe(true)
        expect(Array.from({ length: m.n }, (_, i) => carbonValence(m, i)).every((v) => v <= 4)).toBe(true)
      }
    }
  })
})

describe('the picture and its accessible controls', () => {
  const view = (config: OrganicConfig, state: OrganicState, marked: 'idle' | 'right' | 'wrong' = 'idle') => renderToStaticMarkup(createElement(engine.View, { config, state, setState: () => {}, marked, reduced: true, locked: marked === 'right' }))

  it('builds real displayed formula controls and hides the target name before marking', () => {
    const c = good[1]
    const idle = view(c, engine.initial(c))
    expect(idle).not.toMatch(/ethane|Alkanes share|CnH2n/)
    expect(idle).toMatch(/Add a carbon|Change bond|C has 4 bonds/)
    expect(view(c, engine.solve(c), 'right')).toMatch(/Yes: ethane/)
    expect(view(c, engine.initial(c), 'wrong')).toMatch(/do not match|not all joined/)
  })

  it('shows the bromine-water event and names the product idea only after it happens', () => {
    const c: OrganicConfig = { task: 'add', carbons: 2, reagent: 'bromine' }
    expect(view(c, { added: false })).toMatch(/orange/)
    expect(view(c, { added: false })).not.toMatch(/decolourised|addition reaction/)
    expect(view(c, { added: true })).toMatch(/colourless/)
    expect(view(c, { added: true }, 'right')).toMatch(/decolourised|decolorized|colourless because/)
    expect(view(c, { added: true })).toMatch(/new bonds to both carbons/)
  })

  it('changes the polymer drawing and reveals its repeat unit only when marked', () => {
    const c: OrganicConfig = { task: 'polymer', monomer: 'ethene' }
    expect(view(c, { joined: [] })).toMatch(/Three monomers/)
    expect(view(c, { joined: [] })).not.toMatch(/repeat unit/)
    expect(view(c, { joined: [0, 1, 2] })).toMatch(/One polymer chain/)
    expect(view(c, { joined: [0, 1, 2] }, 'right')).toMatch(/repeat unit|Repeat unit/)
  })

  it('keeps every carbon in its panel and all displayed-formula atoms apart', () => {
    for (const config of good.filter((c) => c.task === 'build')) {
      const d = moleculeDrawing(moleculeOf(engine.solve(config), targetMolecule(config)))
      for (const a of d.atoms) {
        expect(a.x).toBeGreaterThan(20)
        expect(a.x).toBeLessThan(340)
        expect(a.y).toBeGreaterThan(35)
        expect(a.y).toBeLessThan(194)
      }
    }
    expect(carbonPoints(4)).toHaveLength(4)
  })

  it('renders through ActivityNode with no answer words before marking', () => {
    const prompt = 'Build ethene. Select a carbon and tap + carbon to join another, then tap the bond to change single/double.'
    const html = renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, { id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'organic-chemistry', config: good[5] }, success: { kind: 'scene' } } } } as never))).replace(prompt, '')
    expect(html).not.toMatch(/CnH2n|makes this an alkene|Yes:/)
    expect(html).toMatch(/Displayed formula/)
  })
})

describe('prompts and station matching', () => {
  it('passes the examples in its own catalogue entry', () => {
    const e = getEngine('organic-chemistry')!
    const examples = [...e.prompt.matchAll(/"prompt":"([^"]+)"[\s\S]*?"payload": \{ "engine":"organic-chemistry", "config": (\{[^}]+\}) \}/g)]
    expect(examples.length).toBeGreaterThan(0)
    for (const m of examples) expect(e.promptFaults!(e.parse(JSON.parse(m[2]))!, m[1])).toEqual([])
  })

  it('catches organic stations and leaves near misses to their own scenes', () => {
    expect(scenesFor('Organic chemistry: alkanes and alkenes').map((e) => e.id)).toContain('organic-chemistry')
    expect(scenesFor('Structural isomers and displayed formulae').map((e) => e.id)).toContain('organic-chemistry')
    expect(scenesFor('Addition polymers and polymerisation').map((e) => e.id)).toContain('organic-chemistry')
    expect(scenesFor('Covalent bonding and dot-and-cross diagrams').map((e) => e.id)).not.toContain('organic-chemistry')
    expect(scenesFor('Proteins and DNA as biological polymers').map((e) => e.id)).not.toContain('organic-chemistry')
    expect(sceneCatalogue('Fractional distillation of crude oil')).not.toContain('SCENE "organic-chemistry"')
    expect(sceneCatalogue('Alkanes and alkenes')).toContain('SCENE "organic-chemistry"')
  })

  it('rejects prompts that print the answer or promise another experiment', () => {
    expect(engine.promptFaults!(good[0], 'Build methane, CH4.').join(' ')).toMatch(/gives away/)
    expect(engine.promptFaults!(good.find((c) => c.task === 'add')!, 'Watch orange bromine water become colourless.').join(' ')).toMatch(/gives away/)
    expect(engine.promptFaults!({ task: 'polymer', monomer: 'ethene' }, 'Draw the repeat unit of poly(ethene).').join(' ')).toMatch(/answer/)
  })
})
