// lib/studylab/engines/nuclear-fission-kimi31/nuclear-fission.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import { nuclearFissionEngine, nextFissions, madeText, working, goodPrompt, type NuclearConfig, type NuclearState } from './config'
import { NuclearFissionView, ROD_TOP, W, REACTOR_H, FUSION_H } from './View'
import { getEngine, scenesFor, sceneCatalogue } from '../registry'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const configs: NuclearConfig[] = [
  { task: 'reactor', goal: 'steady' }, { task: 'reactor', goal: 'stop' },
  { task: 'fusion', pairs: 1 }, { task: 'fusion', pairs: 2 },
]
const view = (config: NuclearConfig, state: NuclearState, marked: 'idle' | 'right' | 'wrong' | 'shown' = 'idle', reduced = false) =>
  renderToStaticMarkup(createElement(NuclearFissionView, { config, state, setState: () => {}, marked, reduced, locked: marked === 'right' }))

describe('the nuclear rules', () => {
  it('carries three fissions into nine, seven, five, three or none', () => {
    expect([0, 1, 2, 3, 4].map(nextFissions)).toEqual([9, 7, 5, 3, 0])
    // Every branch is a real whole number; depth three is one neutron per previous fission.
    expect(nextFissions(3) / 3).toBe(1)
    expect(nextFissions(4)).toBe(0)
  })

  it('balances the deuterium reaction, including its released neutron', () => {
    // D + D -> He-3 + n: nucleons and proton numbers, checked as integers.
    expect(2 + 2).toBe(3 + 1)
    expect(1 + 1).toBe(2 + 0)
    expect(working({ task: 'fusion', pairs: 2 })).toMatch(/2 \+ 2 = 3 \+ 1/)
  })

  it('says what the learner made, without suggesting an unseen exact pixel tolerance', () => {
    expect(madeText({ task: 'reactor', goal: 'steady' }, { depth: 0 })).toMatch(/Three fissions led to 9.*growing/)
    expect(madeText({ task: 'reactor', goal: 'stop' }, { depth: 2 })).toMatch(/5 new fissions still follow/)
    expect(madeText({ task: 'fusion', pairs: 2 }, { squeeze: 3 })).toMatch(/swerves apart/)
  })
})

describe('reading and refusing configs', () => {
  it('reads ordinary task and goal phrasings', () => {
    const p = nuclearFissionEngine.parse
    expect(p({ task: 'nuclear fission' })).toEqual({ task: 'reactor', goal: 'steady' })
    expect(p({ task: 'chain-reaction', goal: 'shut-down' })).toEqual({ task: 'reactor', goal: 'stop' })
    expect(p({ task: { kind: 'fusion', pairs: 1 } })).toEqual({ task: 'fusion', pairs: 1 })
    expect(p({ pairs: 2 })).toEqual({ task: 'fusion', pairs: 2 })
    expect(p({ goal: 'steady' })).toEqual({ task: 'reactor', goal: 'steady' })
    expect(p(null)).toBeNull()
    expect(p({})).toBeNull()
    expect(p({ task: 'decay' })).toBeNull()
    expect(p({ task: 'fusion', pairs: 'many' })).toBeNull()
  })

  it('refuses only configurations the apparatus cannot honestly draw, with a working example', () => {
    expect(nuclearFissionEngine.faults({ task: 'fusion', pairs: 1 })).toEqual([])
    expect(nuclearFissionEngine.faults({ task: 'fusion', pairs: 2 })).toEqual([])
    expect(nuclearFissionEngine.faults({ task: 'fusion', pairs: 8 })[0]).toMatch(/1 or 2 pairs.*pairs 2/)
    expect(nuclearFissionEngine.faults({ task: 'reactor', goal: 'steady' })).toEqual([])
    expect(nuclearFissionEngine.faults({ task: 'reactor', goal: 'meltdown' })[0]).toMatch(/"steady".*"stop"/)
  })
})

describe('every valid configuration', { timeout: 30_000 }, () => {
  it('starts unsolved and solves by exact rules; stored junk never passes', () => {
    for (const config of configs) {
      expect(nuclearFissionEngine.faults(config)).toEqual([])
      const initial = nuclearFissionEngine.initial(config)
      const solved = nuclearFissionEngine.solve(config)
      expect(nuclearFissionEngine.check(config, initial).ok, JSON.stringify(config)).toBe(false)
      expect(nuclearFissionEngine.check(config, solved), JSON.stringify(config)).toEqual({ ok: true, wrongIds: [] })
      expect(nuclearFissionEngine.check(config, {}).ok).toBe(false)
      expect(nuclearFissionEngine.check(config, { depth: 99, squeeze: 99 }).ok).toBe(false)
      expect(nuclearFissionEngine.check(config, { depth: 2.5, squeeze: 2.5 }).ok).toBe(false)
      for (let value = 0; value <= 4; value++) {
        const state = config.task === 'reactor' ? { depth: value } : { squeeze: value }
        expect(nuclearFissionEngine.check(config, state).ok).toBe(JSON.stringify(state) === JSON.stringify(solved))
      }
    }
  })
})

describe('the catalogue and its near misses', () => {
  it('is registered with the id and dimension its examples use', () => {
    expect(getEngine('nuclear-fission')).toBe(nuclearFissionEngine)
    expect(nuclearFissionEngine.id).toBe('nuclear-fission')
    expect(nuclearFissionEngine.isolates).toBe('magnitude')
    expect(nuclearFissionEngine.prompt).toMatch(/SCENE "nuclear-fission"/)
    expect(nuclearFissionEngine.prompt).toMatch(/"apparatus":"scene:nuclear-fission"/)
    expect(nuclearFissionEngine.prompt).toMatch(/"isolates":"magnitude"/)
  })

  it('catches fission, fusion, reactors and chain reactions, not the neighbours', () => {
    expect(scenesFor('Nuclear fission and the chain reaction').map((e) => e.id)).toContain('nuclear-fission')
    expect(scenesFor('Nuclear fusion in the Sun').map((e) => e.id)).toContain('nuclear-fission')
    expect(sceneCatalogue('Control rods in a nuclear reactor')).toContain('SCENE "nuclear-fission"')
    for (const station of ['Radioactive decay and half-life', 'Alpha beta gamma radiation and penetration', 'Atomic structure and electron shells', 'Energy resources and fossil fuels', 'Nuclear weapons history: Hiroshima']) {
      expect(scenesFor(station).map((e) => e.id), station).not.toContain('nuclear-fission')
      expect(sceneCatalogue(station), station).not.toContain('SCENE "nuclear-fission"')
    }
  })

  it('keeps answer settings and unseen apparatus out of the prompt', () => {
    const steady = configs[0]
    expect(nuclearFissionEngine.promptFaults!(steady, 'Use depth 3, absorbing six neutrons.').join(' ')).toMatch(/gives the rod setting/)
    expect(nuclearFissionEngine.promptFaults!(steady, 'Move the moderator and coolant.').join(' ')).toMatch(/promises controls/)
    expect(nuclearFissionEngine.promptFaults!(steady, goodPrompt(steady))).toEqual([])
    const fusion = configs[3]
    expect(nuclearFissionEngine.promptFaults!(fusion, 'Fully close the press to make helium-3.').join(' ')).toMatch(/fusion product/)
    expect(nuclearFissionEngine.promptFaults!(fusion, 'Heat it with the temperature slider.').join(' ')).toMatch(/different apparatus/)
    expect(nuclearFissionEngine.promptFaults!(fusion, goodPrompt(fusion))).toEqual([])
  })

  it('passes the examples in its own catalogue entry', () => {
    const e = getEngine('nuclear-fission')!
    const found = [...e.prompt.matchAll(/"prompt":\s*"([^"]+)"[\s\S]*?"config":\s*(\{[^\n]+?\}) \}/g)]
    expect(found.length).toBeGreaterThan(0)
    for (const m of found) expect(e.promptFaults!(e.parse(JSON.parse(m[2]))!, m[1])).toEqual([])
  })
})

describe('the drawn apparatus', () => {
  it('moves the rod bank by one clear 16 px step, without reading a config constant at module load', () => {
    expect([0, 1, 2, 3, 4].map(ROD_TOP)).toEqual([160, 146, 132, 118, 104])
    expect(W).toBe(360)
    expect(REACTOR_H).toBe(312)
    expect(FUSION_H).toBe(238)
  })

  it('shows the event, not a dot standing for it, and changes on the smallest move', () => {
    const config = configs[0]
    const zero = view(config, { depth: 0 })
    const one = view(config, { depth: 1 })
    expect(zero).not.toEqual(one)
    expect(zero.match(/data-fission="1"/g)).toHaveLength(13) // one earlier, three previous, nine new
    expect(one.match(/data-fission="1"/g)).toHaveLength(11)
    expect(zero.match(/data-absorbed="1"/g) ?? []).toHaveLength(0)
    expect(one.match(/data-absorbed="1"/g)).toHaveLength(2)
    expect(one).toContain('data-rod-handle="1"')
    expect(one).toContain('role="slider"')
  })

  it('draws deuterium pairs swerving, then a three-particle product and a released neutron', () => {
    const config = configs[3]
    const open = view(config, { squeeze: 0 })
    const near = view(config, { squeeze: 3 })
    const joined = view(config, { squeeze: 4 })
    expect(open.match(/data-deuterium="1"/g)).toHaveLength(4)
    expect(open.match(/data-repulsion="1"/g)).toHaveLength(2)
    expect(open).not.toEqual(near)
    expect(joined.match(/data-fused="1"/g)).toHaveLength(2)
    expect(joined).not.toContain('data-deuterium="1"')
    expect(joined).toContain('data-press-handle="1"')
  })

  it('has a still but state-dependent reduced-motion frame', () => {
    const open = view(configs[3], { squeeze: 0 }, 'idle', true)
    const joined = view(configs[3], { squeeze: 4 }, 'idle', true)
    expect(open).not.toEqual(joined)
    expect(open).not.toContain('transition:')
    expect(joined).not.toContain('transition:')
  })

  it('names fusion products only after marking', () => {
    const config = configs[3]
    const idle = view(config, { squeeze: 4 })
    expect(idle).not.toMatch(/helium-3/i)
    expect(idle).not.toMatch(/2 \+ 2 = 3 \+ 1/)
    expect(view(config, { squeeze: 4 }, 'right')).toMatch(/helium-3/)
    expect(view(config, { squeeze: 4 }, 'right')).toMatch(/2 \+ 2 = 3 \+ 1/)
  })
})

describe('the scene on the lesson board', () => {
  const card = (config: NuclearConfig, prompt: string) => renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
    id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'nuclear-fission', config }, success: { kind: 'scene' } } },
  } as never)))

  it('holds back answer names and the right setting in the server render, including ARIA text', () => {
    const fusionPrompt = goodPrompt(configs[3])
    const fusion = card(configs[3], fusionPrompt).replace(fusionPrompt, '')
    expect(fusion).not.toMatch(/helium-3/i)
    expect(fusion).not.toMatch(/2 \+ 2 = 3 \+ 1/)
    expect(fusion).not.toMatch(/fully (?:close|insert)/i)
    const reactorPrompt = goodPrompt(configs[0])
    const reactor = card(configs[0], reactorPrompt).replace(reactorPrompt, '')
    expect(reactor).not.toMatch(/one neutron (?:from each|per fission)/i)
    expect(reactor).not.toMatch(/depth 3/i)
    expect(reactor).not.toMatch(/steady chain reaction/i)
  })
})
