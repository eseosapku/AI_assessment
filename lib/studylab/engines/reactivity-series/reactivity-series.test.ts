// lib/studylab/engines/reactivity-series-kimi31/reactivity-series.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  reactivitySeriesEngine, METALS, SOLUTIONS, METAL_IDS, SOLUTION_IDS,
  reactionOf, done, dippedOf, rubbedOf, observationOf, working, madeText,
  CARD_WIDTH, CARD_HEIGHT,
  type ReactivityConfig, type ReactivityState,
} from './config'
import { ReactivitySeriesView, W, H, coatingGrains, bubbles, observationOrder, solutionColour } from './View'
import { getEngine, scenesFor, sceneCatalogue } from '../registry'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const displace = (metal: string, solution: string): ReactivityConfig => ({ task: 'displace', metal, solution })
const allValid: ReactivityConfig[] = [
  ...METAL_IDS.flatMap((metal) => SOLUTION_IDS.filter((solution) => SOLUTIONS[solution].metal !== metal).map((solution) => displace(metal, solution))),
  { task: 'aluminium' },
]

describe('the chemistry, worked out from reactivity', () => {
  it('allows a more reactive metal to displace a less reactive one, and not the reverse', () => {
    expect(reactionOf(displace('zinc', 'copper-sulfate'))?.product).toBe('copper')
    expect(reactionOf(displace('zinc', 'iron-sulfate'))?.product).toBe('iron')
    expect(reactionOf(displace('copper', 'silver-nitrate'))?.product).toBe('silver')
    expect(reactionOf(displace('copper', 'zinc-sulfate'))).toBeNull()
    expect(reactionOf(displace('silver', 'copper-sulfate'))).toBeNull()
    expect(reactionOf(displace('iron', 'copper-sulfate'))?.after).toBe('pale green')
  })

  it('writes real symbol and net ionic equations, including silver nitrate stoichiometry', () => {
    expect(reactionOf(displace('zinc', 'copper-sulfate'))?.equation).toBe('Zn + CuSO₄ → ZnSO₄ + Cu')
    expect(reactionOf(displace('zinc', 'copper-sulfate'))?.ionic).toBe('Zn + Cu²⁺ → Zn²⁺ + Cu')
    expect(reactionOf(displace('copper', 'silver-nitrate'))?.equation).toBe('Cu + 2AgNO₃ → Cu(NO₃)₂ + 2Ag')
    expect(reactionOf(displace('copper', 'silver-nitrate'))?.ionic).toBe('Cu + 2Ag⁺ → Cu²⁺ + 2Ag')
  })

  it('does not claim a reaction for the same metal or a less reactive strip', () => {
    for (const solution of SOLUTION_IDS) expect(reactionOf(displace(SOLUTIONS[solution].metal, solution))).toBeNull()
    expect(METALS.zinc.rank).toBeGreaterThan(METALS.iron.rank)
    expect(METALS.iron.rank).toBeGreaterThan(METALS.copper.rank)
    expect(METALS.copper.rank).toBeGreaterThan(METALS.silver.rank)
  })
})

describe('reading what the tutor wrote', () => {
  it('reads names, symbols, formulae and common task forms', () => {
    expect(reactivitySeriesEngine.parse({ task: 'displace', metal: 'Zn', solution: 'CuSO4' })).toEqual(displace('zinc', 'copper-sulfate'))
    expect(reactivitySeriesEngine.parse({ task: { kind: 'displacement reaction', metal: 'copper strip', solution: 'aqueous silver nitrate solution' } })).toEqual(displace('copper', 'silver-nitrate'))
    expect(reactivitySeriesEngine.parse({ task: 'reactivity series', metal: 'Fe', solution: 'copper(II) sulphate solution' })).toEqual(displace('iron', 'copper-sulfate'))
    expect(reactivitySeriesEngine.parse({ metal: 'iron', solution: 'iron(II) sulfate' })).toEqual(displace('iron', 'iron-sulfate'))
    expect(reactivitySeriesEngine.parse({ task: 'oxide layer' })).toEqual({ task: 'aluminium' })
    expect(reactivitySeriesEngine.parse({ task: 'aluminum oxide layer' })).toEqual({ task: 'aluminium' })
    expect(reactivitySeriesEngine.parse(null)).toBeNull()
    expect(reactivitySeriesEngine.parse({ task: 'order the series' })).toBeNull()
    expect(reactivitySeriesEngine.parse({})).toBeNull()
  })

  it('refuses narrowly, with a working nearby example', () => {
    expect(reactivitySeriesEngine.faults(displace('magnesium', 'copper-sulfate'))[0]).toMatch(/use zinc, iron, copper or silver, e.g. metal "zinc"/)
    expect(reactivitySeriesEngine.faults(displace('zinc', 'lead nitrate'))[0]).toMatch(/use zinc sulfate.*e.g. solution "copper-sulfate"/)
    expect(reactivitySeriesEngine.faults(displace('zinc', 'zinc-sulfate'))[0]).toMatch(/cannot compare two metals: use e.g. metal "copper"/)
    expect(reactivitySeriesEngine.faults(displace('zinc', 'copper-sulfate'))).toEqual([])
    expect(reactivitySeriesEngine.faults({ task: 'aluminium' })).toEqual([])
  })
})

describe('every valid configuration', { timeout: 30_000 }, () => {
  it('enumerates all 12 unequal pairs and aluminium: starts unsolved and always solves', () => {
    expect(allValid).toHaveLength(13)
    for (const config of allValid) {
      expect(reactivitySeriesEngine.faults(config), JSON.stringify(config)).toEqual([])
      const start = reactivitySeriesEngine.initial(config)
      expect(reactivitySeriesEngine.check(config, start).ok, JSON.stringify(config)).toBe(false)
      const solved = reactivitySeriesEngine.solve(config)
      expect(done(config, solved), JSON.stringify(config)).toBe(true)
      expect(reactivitySeriesEngine.check(config, solved), JSON.stringify(config)).toEqual({ ok: true, wrongIds: [] })
      expect(dippedOf(solved)).toBe(true)
      if (config.task === 'aluminium') expect(rubbedOf(solved)).toBe(3)
      else expect(observationOf(solved)).toBe(reactionOf(config) ? 'coating' : 'none')
    }
  })

  it('marks the observation, not a guess at the product; malformed work never passes', () => {
    for (const config of allValid.filter((c) => c.task === 'displace')) {
      const correct = reactionOf(config) ? 'coating' : 'none'
      const incorrect = correct === 'coating' ? 'none' : 'coating'
      expect(done(config, { dipped: false, observed: correct })).toBe(false)
      expect(done(config, { dipped: true, observed: incorrect })).toBe(false)
      expect(done(config, { dipped: true, observed: correct })).toBe(true)
      expect(done(config, {} as ReactivityState)).toBe(false)
    }
    expect(done({ task: 'aluminium' }, { dipped: true, rubbed: 0 })).toBe(false)
    expect(done({ task: 'aluminium' }, { dipped: false, rubbed: 3 })).toBe(false)
    expect(done({ task: 'aluminium' }, { dipped: true, rubbed: 3 })).toBe(true)
    expect(rubbedOf({ rubbed: 99 })).toBe(3)
    expect(rubbedOf({ rubbed: -4 })).toBe(0)
  })

  it('says what was observed or what still needs doing', () => {
    const reacting = displace('zinc', 'copper-sulfate')
    expect(working(reacting, reactivitySeriesEngine.solve(reacting))).toMatch(/loses electrons more readily than copper/)
    expect(madeText(reacting, { dipped: true, observed: 'none' })).toMatch(/You said no change, but a reddish-brown coating formed/)
    const still = displace('copper', 'zinc-sulfate')
    expect(working(still, reactivitySeriesEngine.solve(still))).toMatch(/no visible change is right/)
    expect(madeText(still, { dipped: true, observed: 'coating' })).toMatch(/You said a coating formed, but the strip and solution are unchanged/)
    expect(madeText(reacting, { dipped: false })).toMatch(/has not been dipped yet/)
    expect(madeText({ task: 'aluminium' }, { dipped: true, rubbed: 0 })).toMatch(/Lift it out and rub/)
  })
})

describe('the drawing answers each move', () => {
  it('grows grains only after immersion and bubbles only after rubbing and immersion', () => {
    expect(coatingGrains(false)).toEqual([])
    expect(coatingGrains(true).length).toBeGreaterThan(20)
    expect(coatingGrains(true).every((g) => g.y >= 181 && g.y <= 228)).toBe(true)
    expect(bubbles({ task: 'aluminium' }, { dipped: true, rubbed: 0 })).toEqual([])
    expect(bubbles({ task: 'aluminium' }, { dipped: false, rubbed: 3 })).toEqual([])
    expect(bubbles({ task: 'aluminium' }, { dipped: true, rubbed: 3 })).toHaveLength(9)
  })

  it('fades copper sulfate only when there really is a reaction', () => {
    expect(solutionColour(displace('zinc', 'copper-sulfate'), false)).toBe(SOLUTIONS['copper-sulfate'].liquid)
    expect(solutionColour(displace('copper', 'zinc-sulfate'), true)).toBe(SOLUTIONS['zinc-sulfate'].liquid)
    expect(solutionColour(displace('zinc', 'copper-sulfate'), true)).not.toBe(SOLUTIONS['copper-sulfate'].liquid)
  })

  it('keeps the observation button order independent of correctness', () => {
    const reacting = displace('zinc', 'copper-sulfate')
    const still = displace('zinc', 'iron-sulfate')
    expect(observationOrder(reacting)).toEqual(observationOrder(still))
    expect(new Set(observationOrder(reacting))).toEqual(new Set(['coating', 'none']))
  })

  it('uses literals for its dimensions that agree with the config', () => {
    expect(W).toBe(CARD_WIDTH)
    expect(H).toBe(CARD_HEIGHT)
  })
})

const view = (config: ReactivityConfig, state: ReactivityState, marked: 'idle' | 'right' | 'wrong' | 'shown' = 'idle') =>
  renderToStaticMarkup(createElement(ReactivitySeriesView, { config, state, setState: () => {}, marked, reduced: true, locked: marked === 'right' }))

const card = (config: unknown, prompt: string) =>
  renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
    id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'reactivity-series', config }, success: { kind: 'scene' } } },
  } as never)))

describe('nothing is answered before marking', () => {
  it('shows reactants and observables, but no reactivity judgement or equations', () => {
    const prompt = 'Drag the zinc strip into the copper(II) sulfate, or tap it. Watch what happens, then choose the observation that matches.'
    const html = card({ task: 'displace', metal: 'zinc', solution: 'copper-sulfate' }, prompt).replace(prompt, '')
    expect(html).toMatch(/Zinc strip/)
    expect(html).toMatch(/copper\(II\) sulfate/)
    expect(html).not.toMatch(/more reactive|less reactive|displaces|ZnSO₄|Zn²⁺|reddish-brown/)
    expect(html).not.toMatch(/role="button"/)
    const dipped = view(displace('zinc', 'copper-sulfate'), { dipped: true, observed: null })
    expect(dipped).toMatch(/A coating/)
    expect(dipped).toMatch(/No change/)
    expect(dipped).not.toMatch(/more reactive|less reactive|displaces|ZnSO₄|Zn²⁺|→/)
  })

  it('does not reveal the oxide explanation before the aluminium experiment is marked', () => {
    const prompt = 'Tap the emery paper to rub the aluminium strip, then drag it into the dilute hydrochloric acid, or tap it. Make gas bubbles appear.'
    const html = card({ task: 'aluminium' }, prompt).replace(prompt, '')
    expect(html).toMatch(/Emery paper/)
    expect(html).not.toMatch(/oxide layer|protective|AlCl₃|3H₂|more reactive/)
    const dipped = view({ task: 'aluminium' }, { dipped: true, rubbed: 0 })
    expect(dipped).not.toMatch(/data-bubble/)
    expect(dipped).not.toMatch(/oxide layer|AlCl₃/)
  })

  it('names the chemistry only with the mark, including a no-reaction result', () => {
    const reacting = displace('zinc', 'copper-sulfate')
    const right = view(reacting, reactivitySeriesEngine.solve(reacting), 'right')
    expect(right).toMatch(/loses electrons more readily than copper/)
    expect(right).toMatch(/Zn \+ CuSO₄ → ZnSO₄ \+ Cu/)
    expect(right).toMatch(/Zn \+ Cu²⁺ → Zn²⁺ \+ Cu/)
    const wrong = view(reacting, { dipped: true, observed: 'none' }, 'wrong')
    expect(wrong).toMatch(/You said no change/)
    const still = displace('copper', 'zinc-sulfate')
    const noReaction = view(still, reactivitySeriesEngine.solve(still), 'right')
    expect(noReaction).toMatch(/less reactive than zinc/)
    expect(noReaction).not.toMatch(/→/)
    const al = view({ task: 'aluminium' }, { dipped: true, rubbed: 3 }, 'right')
    expect(al).toMatch(/aluminium oxide layer/)
    expect(al).toMatch(/2Al \+ 6HCl → 2AlCl₃ \+ 3H₂/)
    expect(al.match(/data-bubble/g)).toHaveLength(9)
  })
})

describe('the catalogue and its prompts', () => {
  it('is registered with consequence as its isolated dimension', () => {
    expect(getEngine('reactivity-series')).toBe(reactivitySeriesEngine)
    expect(reactivitySeriesEngine.isolates).toBe('consequence')
    expect(reactivitySeriesEngine.prompt).toMatch(/SCENE "reactivity-series"/)
    expect(reactivitySeriesEngine.prompt).toMatch(/"apparatus":"scene:reactivity-series"/)
    expect(reactivitySeriesEngine.prompt).toMatch(/"isolates":"consequence"/)
  })

  it('catches its stations and rules out the near misses', () => {
    expect(scenesFor('The reactivity series: ordering metals').map((e) => e.id)).toContain('reactivity-series')
    expect(scenesFor('Displacement reactions in salt solutions').map((e) => e.id)).toContain('reactivity-series')
    expect(sceneCatalogue('Why aluminium seems unreactive: its oxide layer')).toContain('SCENE "reactivity-series"')
    for (const station of ['Extraction of metals by electrolysis', 'The blast furnace', 'Distance and displacement', 'Rates of reaction', 'Corrosion and sacrificial protection', 'Reactions of metals with water and steam']) {
      expect(scenesFor(station).map((e) => e.id), station).not.toContain('reactivity-series')
      expect(sceneCatalogue(station), station).not.toContain('SCENE "reactivity-series"')
    }
  })

  it('refuses prompts that state the hidden result or promise another experiment', () => {
    const reacting = displace('zinc', 'copper-sulfate')
    expect(reactivitySeriesEngine.promptFaults!(reacting, 'Zinc is more reactive and displaces copper.').join(' ')).toMatch(/gives the experimental result/)
    expect(reactivitySeriesEngine.promptFaults!(reacting, 'Watch the reddish-brown coating form.').join(' ')).toMatch(/gives the experimental result/)
    expect(reactivitySeriesEngine.promptFaults!(reacting, 'Order the metals in the series.').join(' ')).toMatch(/does not show/)
    expect(reactivitySeriesEngine.promptFaults!({ task: 'aluminium' }, 'Rub away the protective oxide layer.').join(' ')).toMatch(/explains the hidden result/)
  })

  it('passes the examples in its own catalogue entry', () => {
    const e = getEngine('reactivity-series')!
    const found = [...e.prompt.matchAll(/"prompt":"([^"]+)"[\s\S]*?"config": (\{.*?\}) \},\n/g)]
    expect(found).toHaveLength(4)
    for (const m of found) {
      const raw = JSON.parse(m[2]) as { task: unknown }
      const config = e.parse(typeof raw.task === 'object' ? { task: raw.task } : raw)!
      expect(e.promptFaults!(config, m[1])).toEqual([])
    }
  })
})
