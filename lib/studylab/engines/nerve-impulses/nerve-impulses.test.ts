// lib/studylab/engines/nerve-impulses/nerve-impulses.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  nerveImpulsesEngine as engine, VESICLES, RECEPTORS, releasedOf, blockedOf, firing, madeText, working,
  type NerveConfig,
} from './config'
import { NerveImpulsesView, VESICLE_IDS, RECEPTOR_IDS, VESICLE_POSITIONS, RECEPTOR_X, moleculesFor } from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const allConfigs: NerveConfig[] = [
  ...[1, 2, 3].map((target) => ({ task: 'transmit' as const, target })),
  ...[1, 2, 3, 4].map((target) => ({ task: 'block' as const, target })),
]
const view = (config: NerveConfig, state: { released?: string[]; blocked?: string[] }, marked: 'idle' | 'right' | 'wrong' | 'shown' = 'idle', reduced = true) =>
  renderToStaticMarkup(createElement(NerveImpulsesView, { config, state, setState: () => {}, marked, reduced, locked: marked === 'right' }))

describe('reading a nerve-impulses config', () => {
  it('reads ordinary task wordings, nested tasks and numeric strings', () => {
    expect(engine.parse({ task: 'synaptic transmission', target: '2' })).toEqual({ task: 'transmit', target: 2 })
    expect(engine.parse({ task: { kind: 'release neurotransmitter', threshold: 1 } })).toEqual({ task: 'transmit', target: 1 })
    expect(engine.parse({ task: 'drugs', available: 3 })).toEqual({ task: 'block', target: 3 })
    expect(engine.parse({ task: 'receptor blocker' })).toEqual({ task: 'block', target: 2 })
    expect(engine.parse({ task: 'release' })).toEqual({ task: 'transmit', target: 2 })
    expect(engine.parse(null)).toBeNull()
    expect(engine.parse({ task: 'reflex arc' })).toBeNull()
    expect(engine.parse({ task: 'transmit', target: 'many' })).toBeNull()
  })

  it('refuses only thresholds that cannot be drawn, with a working nearby config', () => {
    for (const target of [0, -1, 1.5, 4, 99]) {
      const c = engine.parse({ task: 'transmit', target })!
      expect(engine.faults(c).join(' ')).toMatch(/whole number from 1 to 3/)
    }
    expect(engine.faults(engine.parse({ task: 'block', target: 5 })!).join(' ')).toMatch(/from 1 to 4/)
    expect(allConfigs.every((c) => engine.faults(c).length === 0)).toBe(true)
  })
})

describe('every valid configuration', { timeout: 30_000 }, () => {
  it('starts unsolved and solve passes; every set of learner taps is marked by the same rule', () => {
    expect(allConfigs).toHaveLength(7)
    for (const c of allConfigs) {
      expect(engine.check(c, engine.initial(c)).ok).toBe(false)
      expect(engine.check(c, engine.solve(c))).toEqual({ ok: true, wrongIds: [] })
      const ids = c.task === 'transmit' ? VESICLES : RECEPTORS
      for (let mask = 0; mask < 2 ** ids.length; mask++) {
        const chosen = ids.filter((_, i) => mask & (1 << i))
        const s = c.task === 'transmit' ? { released: chosen } : { blocked: chosen }
        // The next neurone fires with enough vesicles released, or while enough receptors stay free; block is right once it stops.
        const fires = c.task === 'transmit' ? chosen.length >= c.target : RECEPTORS.length - chosen.length >= c.target
        expect(engine.check(c, s).ok, JSON.stringify({ c, s })).toBe(c.task === 'transmit' ? fires : !fires)
        expect(firing(c, s)).toBe(fires)
      }
    }
  })

  it('reads only known ids and tolerates incomplete stored work', () => {
    expect(releasedOf({ released: ['v3', 'bogus', 'v1', 'v1'] })).toEqual(['v1', 'v3'])
    expect(blockedOf({ blocked: ['r4', 'bogus'] })).toEqual(['r4'])
    expect(releasedOf(undefined)).toEqual([])
    expect(blockedOf({})).toEqual([])
    expect(engine.check(allConfigs[1], {}).ok).toBe(false)
  })
})

describe('the drawn model', () => {
  it('keeps its view constants in agreement with the config (they cannot be imported at module load)', () => {
    expect([...VESICLE_IDS]).toEqual([...VESICLES])
    expect([...RECEPTOR_IDS]).toEqual([...RECEPTORS])
    expect(VESICLE_POSITIONS).toHaveLength(VESICLES.length)
    expect(RECEPTOR_X).toHaveLength(RECEPTORS.length)
  })

  it('changes from unreleased to diffusing/bound molecules, without overlapping receptor pairs', () => {
    const c: NerveConfig = { task: 'transmit', target: 2 }
    expect(moleculesFor(c, []).every((m) => m.receptor === -1)).toBe(true)
    expect(moleculesFor(c, ['v1']).filter((m) => m.receptor >= 0)).toHaveLength(2)
    const full = moleculesFor(c, ['v1', 'v2']).filter((m) => m.receptor >= 0)
    expect(full).toHaveLength(4)
    expect(full.filter((m) => m.receptor === 0)).toHaveLength(2)
    expect(Math.abs(full[0].x - full[1].x)).toBeGreaterThanOrEqual(8)
    for (let a = 0; a < full.length; a++) for (let b = a + 1; b < full.length; b++) {
      expect(Math.hypot(full[a].x - full[b].x, full[a].y - full[b].y)).toBeGreaterThanOrEqual(8)
    }
    expect(moleculesFor(c, ['v1', 'v2', 'v3'])).toHaveLength(9)
  })

  it('places labels near their own structures and controls directly on those structures', () => {
    expect(VESICLE_POSITIONS.every((p) => p.y < 141)).toBe(true)
    expect(RECEPTOR_X.every((x) => x > 30 && x < 330)).toBe(true)
    expect(VESICLE_POSITIONS.map((p) => p.x)).toEqual([91, 180, 269])
    expect(RECEPTOR_X).toEqual([78, 146, 214, 282])
  })
})

describe('the card before and after marking', () => {
  const transmit = engine.parse({ task: 'transmit', target: 2 })!
  const block = engine.parse({ task: 'block', target: 2 })!

  it('shows real vesicle and receptor buttons, and observable state without the answer', () => {
    const a = view(transmit, engine.initial(transmit))
    expect(a).toContain('Release vesicle 1')
    expect(a).toContain('Neurotransmitter')
    expect(a).toContain('Next neurone quiet')
    expect(a).not.toContain('at least two')
    expect(a).not.toContain('This model needs')
    const b = view(block, engine.initial(block))
    expect(b).toContain('Occupy receptor 1 with drug')
    expect(b).toContain('Blocking drug')
    expect(b).toContain('New impulse')
    expect(b).not.toContain('leaving too few')
  })

  it('changes the picture after one move, and gives no correctness wording', () => {
    const before = view(transmit, { released: [] })
    const after = view(transmit, { released: ['v1'] })
    expect(after).not.toEqual(before)
    expect(after).toContain('Refill vesicle 1')
    expect(after).not.toMatch(/correct|right answer|well done/i)
    const stopped = view(block, { blocked: ['r1', 'r2', 'r3'] })
    expect(stopped).toContain('Next neurone quiet')
    expect(stopped).not.toMatch(/correct|well done/i)
  })

  it('says what was made when wrong, and the exact model rule when right', () => {
    expect(madeText(transmit, { released: [] })).toMatch(/No vesicle/)
    expect(madeText(transmit, { released: ['v1'] })).toMatch(/One vesicle has released/)
    expect(madeText(block, { blocked: [] })).toMatch(/No receptor/)
    expect(working(transmit, engine.solve(transmit))).toMatch(/at least two/)
    expect(working(block, engine.solve(block))).toMatch(/three receptors/)
    expect(view(transmit, { released: ['v1'] }, 'wrong')).toContain('One vesicle has released')
    expect(view(transmit, engine.solve(transmit), 'right')).toContain('This model needs at least two')
    expect(view(transmit, { released: [] }, 'shown')).toContain('This model needs at least two')
  })

  it('server-renders through ActivityNode with no answer text before marking', () => {
    const prompt = 'An impulse has reached the sending neurone. Tap vesicles to release neurotransmitter and start a new impulse in the receiving neurone.'
    const html = renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'nerve-impulses', config: transmit }, success: { kind: 'scene' } } },
    } as never))).replace(prompt, '')
    expect(html).toContain('sending neurone')
    expect(html).toContain('Release vesicle 1')
    expect(html).not.toMatch(/This model needs|at least two|two vesicles|Yes\./i)
  })
})

describe('prompts, catalogue and neighbouring scenes', () => {
  const transmit = engine.parse({ task: 'transmit', target: 2 })!
  const block = engine.parse({ task: 'block', target: 2 })!
  it('refuses threshold answers and promises the card cannot draw', () => {
    expect(engine.promptFaults!(transmit, 'Tap two vesicles; at least two are needed.').join(' ')).toMatch(/gives the answer away/)
    expect(engine.promptFaults!(block, 'Block two receptors.').join(' ')).toMatch(/gives the answer away/)
    expect(engine.promptFaults!(transmit, 'Drag sodium through the reflex arc.').join(' ')).toMatch(/does not show/)
    expect(engine.promptFaults!(transmit, 'An impulse has reached the sending neurone. Tap vesicles to release neurotransmitter and start a new impulse in the receiving neurone.')).toEqual([])
    expect(engine.promptFaults!(block, 'Tap receptors to occupy them with the drug. Stop the new impulse in the receiving neurone.')).toEqual([])
  })

  it('passes the examples in its own catalogue entry', () => {
    const e = getEngine('nerve-impulses')!
    const found = [...e.prompt.matchAll(/"prompt":"([^"]+)"[\s\S]*?"config": (\{[\s\S]*?\}) \}/g)]
    expect(found.length).toBeGreaterThan(0)
    for (const m of found) expect(e.promptFaults!(e.parse(JSON.parse(m[2]))!, m[1])).toEqual([])
  })

  it('is registered with the same isolates its examples advertise', () => {
    expect(getEngine('nerve-impulses')).toBe(engine)
    expect(engine.isolates).toBe('consequence')
    expect(engine.prompt).toContain('"isolates":"consequence"')
    expect(engine.prompt).toContain('"engine":"nerve-impulses"')
    expect(engine.prompt).toContain('"apparatus":"scene:nerve-impulses"')
  })

  it('catches synapse stations, not reflex routes or near misses', () => {
    expect(scenesFor('Synapses and synaptic transmission').map((e) => e.id)).toContain('nerve-impulses')
    expect(scenesFor('The reflex arc and reflex actions').map((e) => e.id)).not.toContain('nerve-impulses')
    expect(scenesFor('Hormones and the endocrine system').map((e) => e.id)).not.toContain('nerve-impulses')
    expect(scenesFor('Phototropism in plant shoots').map((e) => e.id)).not.toContain('nerve-impulses')
    expect(sceneCatalogue('Neurotransmitter release at synapses')).toContain('SCENE "nerve-impulses"')
    expect(sceneCatalogue('The heart pacemaker')).not.toContain('SCENE "nerve-impulses"')
  })
})
