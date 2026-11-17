// lib/studylab/engines/international-trade/international-trade.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  IMPORTS, PRODUCTION, TARIFF_STEPS, WORKERS, bestRevenue, internationalTradeEngine, madeText, marketAt, marketOf, outputOf,
  type TradeConfig,
} from './config'
import { InternationalTradeView } from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const clean: TradeConfig[] = [
  ...Object.keys(PRODUCTION).map((scenario): TradeConfig => ({ task: 'specialise', scenario })),
  ...Object.keys(IMPORTS).flatMap((scenario): TradeConfig[] => [
    { task: 'tariff', scenario, aim: 'half-imports' },
    { task: 'tariff', scenario, aim: 'max-revenue' },
  ]),
]

describe('the international trade arithmetic', () => {
  it('computes production from workers, including the country best at both goods', () => {
    const c = internationalTradeEngine.parse({ task: 'specialise', scenario: 'workshop' })!
    expect(outputOf(c, { a: 6, b: 3 })).toEqual([42, 9])
    // 3 workers on tables in each country: 6×3 + 2×3 = 24 tables; 4×3 + 3×3 = 21 chairs.
    expect(outputOf(c, { a: 3, b: 3 })).toEqual([24, 21])
    expect(outputOf(c, { a: 7, b: 3 })).toBeNull()
    expect(outputOf(c, { a: 2.5, b: 3 })).toBeNull()
    expect(PRODUCTION.workshop.rates[0][0]).toBeGreaterThan(PRODUCTION.workshop.rates[1][0])
    expect(PRODUCTION.workshop.rates[0][1]).toBeGreaterThan(PRODUCTION.workshop.rates[1][1])
  })

  it('uses the small-country tariff model consistently at every step', () => {
    for (const scenario of Object.keys(IMPORTS)) {
      const c: TradeConfig = { task: 'tariff', scenario, aim: 'half-imports' }
      expect(marketAt(c, 0)).toEqual({ tariff: 0, price: 40, homeMade: 60, bought: 100, imports: 40, revenue: 0 })
      expect(marketAt(c, 10)).toEqual({ tariff: 10, price: 50, homeMade: 70, bought: 90, imports: 20, revenue: 200 })
      for (const tariff of TARIFF_STEPS) {
        const m = marketAt(c, tariff)
        expect(m.price).toBe(40 + tariff)
        expect(m.bought).toBe(140 - m.price)
        expect(m.homeMade).toBe(20 + m.price)
        expect(m.imports).toBe(m.bought - m.homeMade)
        expect(m.revenue).toBe(tariff * m.imports)
      }
      expect(bestRevenue(c).tariff).toBe(10)
      expect(bestRevenue(c).revenue).toBe(200)
    }
  })

  it('says back what was made, without pretending a tariff bans trade', () => {
    const c: TradeConfig = { task: 'tariff', scenario: 'bicycles', aim: 'half-imports' }
    // Imports are 40 − 2 × tariff in this model, so a $15 tariff leaves 10.
    expect(marketOf(c, { tariff: 15 })?.imports).toBe(10)
    expect(madeText(c, { tariff: 5 })).toMatch(/imports are 30/)
    expect(madeText(c, { tariff: 0 })).toMatch(/revenue is \$0/)
  })
})

describe('reading the tutor config and refusing usefully', () => {
  it('reads reasonable task and scenario phrasings', () => {
    expect(internationalTradeEngine.parse({ task: 'comparative advantage', goods: 'tables and chairs' })).toEqual({ task: 'specialise', scenario: 'workshop' })
    expect(internationalTradeEngine.parse({ task: { kind: 'specialization', example: 'wheat farming' } })).toEqual({ task: 'specialise', scenario: 'farm' })
    expect(internationalTradeEngine.parse({ task: 'import tariff', product: 'footwear', goal: 'government revenue' })).toEqual({ task: 'tariff', scenario: 'shoes', aim: 'max-revenue' })
    expect(internationalTradeEngine.parse({ kind: 'protectionism', good: 'bikes', objective: 'halve imports' })).toEqual({ task: 'tariff', scenario: 'bicycles', aim: 'half-imports' })
    expect(internationalTradeEngine.parse(null)).toBeNull()
    expect(internationalTradeEngine.parse({})).toBeNull()
    expect(internationalTradeEngine.parse({ task: 'exchange rates' })).toBeNull()
  })

  it('refuses only configs it cannot draw, with a nearby working example', () => {
    expect(internationalTradeEngine.faults({ task: 'specialise', scenario: 'cars' })[0]).toMatch(/use workshop.*farm.*clothing.*scenario "workshop"/)
    expect(internationalTradeEngine.faults({ task: 'tariff', scenario: 'cars', aim: 'half-imports' })[0]).toMatch(/use bicycles, shoes or chairs/)
    expect(internationalTradeEngine.faults({ task: 'tariff', scenario: 'bicycles', aim: 'zero-imports' })[0]).toMatch(/use "half-imports" or "max-revenue"/)
    for (const c of clean) expect(internationalTradeEngine.faults(c)).toEqual([])
  })
})

describe('every clean configuration', { timeout: 30_000 }, () => {
  it('starts unsolved and can always be solved', () => {
    expect(clean).toHaveLength(9)
    for (const config of clean) {
      const initial = internationalTradeEngine.initial(config)
      const solved = internationalTradeEngine.solve(config)
      expect(internationalTradeEngine.check(config, initial).ok, JSON.stringify(config)).toBe(false)
      expect(internationalTradeEngine.check(config, solved), JSON.stringify(config)).toEqual({ ok: true, wrongIds: [] })
    }
  })

  it('accepts every whole-worker allocation and marks only the exact orders', () => {
    for (const config of clean.filter((c) => c.task === 'specialise')) {
      const order = PRODUCTION[config.scenario].order
      const solutions: string[] = []
      for (let a = 0; a <= WORKERS; a++) {
        for (let b = 0; b <= WORKERS; b++) {
          const made = outputOf(config, { a, b })!
          const ok = internationalTradeEngine.check(config, { a, b }).ok
          expect(ok).toBe(made[0] === order[0] && made[1] === order[1])
          if (ok) solutions.push(`${a},${b}`)
        }
      }
      expect(solutions).toHaveLength(1)
    }
  })

  it('never accepts malformed saved work', () => {
    for (const config of clean) {
      expect(internationalTradeEngine.check(config, {}).ok).toBe(false)
      expect(internationalTradeEngine.check(config, { a: -1, b: 99, tariff: 3 }).ok).toBe(false)
    }
  })
})

describe('prompts and catalogue matching', () => {
  const special: TradeConfig = { task: 'specialise', scenario: 'workshop' }
  const tariff: TradeConfig = { task: 'tariff', scenario: 'bicycles', aim: 'max-revenue' }
  it('stops a prompt printing the answer or promising another model', () => {
    expect(internationalTradeEngine.promptFaults!(special, 'Put 6 Avenia workers on tables and 3 Bordia workers on tables.').join(' ')).toMatch(/gives the allocation/)
    expect(internationalTradeEngine.promptFaults!(special, 'Avenia has the comparative advantage in tables.').join(' ')).toMatch(/gives the allocation/)
    expect(internationalTradeEngine.promptFaults!(special, 'Draw a production possibility curve.').join(' ')).toMatch(/does not show/)
    expect(internationalTradeEngine.promptFaults!(tariff, 'Set the tariff to $10 per bicycle.').join(' ')).toMatch(/gives the tariff/)
    expect(internationalTradeEngine.promptFaults!(tariff, 'Raise the price until producers gain.').join(' ')).toMatch(/gives the tariff/)
    expect(internationalTradeEngine.promptFaults!(tariff, 'Add a quota and drag the supply curve.').join(' ')).toMatch(/does not show/)
    expect(internationalTradeEngine.promptFaults!(special, 'Tap minus or plus to move workers between the two goods. Fill the order of 42 tables and 9 chairs exactly, with nobody idle.')).toEqual([])
    expect(internationalTradeEngine.promptFaults!(tariff, 'Tap minus or plus on the tariff per bicycle. Find the rate that gives the government the most revenue.')).toEqual([])
  })

  it('passes the examples in its own catalogue entry', () => {
    const e = getEngine('international-trade')!
    const found = [...e.prompt.matchAll(/"prompt":"([^"]+)"[\s\S]*?"config": (\{[\s\S]*?\}) \}/g)]
    expect(found.length).toBeGreaterThanOrEqual(4)
    for (const m of found) {
      const config = e.parse(JSON.parse(m[2]))!
      expect(e.faults(config)).toEqual([])
      expect(e.promptFaults!(config, m[1])).toEqual([])
    }
    expect(e.isolates).toBe('consequence')
    expect(e.prompt).toMatch(/"isolates":"consequence"/)
  })

  it('catches trade stations and leaves near misses to their own scenes', () => {
    expect(scenesFor('International trade: comparative advantage and specialisation of countries').map((e) => e.id)).toContain('international-trade')
    expect(scenesFor('Tariffs and protectionism').map((e) => e.id)).toContain('international-trade')
    expect(sceneCatalogue('Absolute advantage and gains from trade')).toContain('SCENE "international-trade"')
    expect(sceneCatalogue('Exchange rates and the current account')).not.toContain('SCENE "international-trade"')
    expect(sceneCatalogue('Division of labour inside a firm')).not.toContain('SCENE "international-trade"')
    expect(sceneCatalogue('The history of trade routes')).not.toContain('SCENE "international-trade"')
    expect(sceneCatalogue('Break-even and business costs')).not.toContain('SCENE "international-trade"')
  })
})

describe('the card on the board', () => {
  const card = (config: unknown, prompt: string) =>
    renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'international-trade', config }, success: { kind: 'scene' } } },
    } as never)))

  it('has real labelled stepper controls and changing computed readouts', () => {
    const html = card({ task: 'specialise', scenario: 'workshop' }, 'Move the workers to fill both orders.')
    expect(html).toMatch(/Move an Avenia worker/)
    expect(html).toMatch(/Move a Bordia worker/)
    expect(html).toMatch(/24 tables/)
    expect(html).toMatch(/21 chairs/)
    expect(html).toMatch(/42 tables/)
    expect(html).toMatch(/9 chairs/)
    expect(html.match(/<button/g)?.length).toBe(4)
  })

  it('shows no solution, comparative-advantage verdict or revenue answer before marking', () => {
    const prompt = 'Tap minus or plus to move workers between the two goods. Fill the order of 42 tables and 9 chairs exactly, with nobody idle.'
    const html = card({ task: 'specialise', scenario: 'workshop' }, prompt).replace(prompt, '')
    expect(html).not.toMatch(/comparative advantage/i)
    expect(html).not.toMatch(/opportunity cost/i)
    expect(html).not.toMatch(/42 tables<\/text>/)
    expect(html).not.toMatch(/consume beyond/i)
    const tPrompt = 'Tap minus or plus on the tariff per bicycle. Find the rate that gives the government the most revenue.'
    const t = card({ task: 'tariff', scenario: 'bicycles', aim: 'max-revenue' }, tPrompt).replace(tPrompt, '')
    expect(t).not.toMatch(/highest revenue|efficiency loss|Home producers and government gain/i)
    expect(t).toMatch(/The gate stays open/)
  })

  it('renders right, wrong, shown and reduced-motion stills', () => {
    for (const config of clean) {
      for (const marked of ['right', 'wrong', 'shown'] as const) {
        const state = marked === 'wrong' ? internationalTradeEngine.initial(config) : internationalTradeEngine.solve(config)
        const html = renderToStaticMarkup(createElement(InternationalTradeView, {
          config, state, setState: () => {}, marked, reduced: true, locked: marked !== 'wrong',
        }))
        expect(html).toMatch(/<svg/)
        expect(html).toMatch(/Yes\.|You /)
      }
    }
  })
})
