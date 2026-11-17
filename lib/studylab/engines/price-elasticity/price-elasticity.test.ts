// lib/studylab/engines/price-elasticity/price-elasticity.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  priceElasticityEngine, quantityDemanded, totalRevenue, bestPrices, midpointChange, elasticity,
  quantitySupplied, revenuePED, supplyPES, GOODS, ORDER_MIN, ORDER_MAX, BASE_PRICE,
  type ElasticityConfig,
} from './config'
import { DRAW_LIMITS, PriceElasticityView, W, H } from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import '..'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const engine = priceElasticityEngine
const revenue = (good = 'cinema') => engine.parse({ task: 'revenue', good })!
const supply = (order = 10) => engine.parse({ task: 'supply', order })!

describe('the economics', () => {
  it('uses price times quantity and the disclosed constant-elasticity demand models', () => {
    expect(quantityDemanded('cinema', 6)).toBe(2)
    expect(quantityDemanded('petrol', 6)).toBe(6)
    expect(totalRevenue('cinema', 6)).toBe(12)
    expect(totalRevenue('petrol', 6)).toBe(36)
    for (const good of GOODS) {
      for (let p = 2; p <= 10; p++) expect(quantityDemanded(good, p)).toBe(Math.round((good === 'cinema' ? 2 : 6) * Math.pow(6 / p, good === 'cinema' ? 1.5 : 0.5)))
    }
    expect(bestPrices('cinema')).toEqual([2])
    expect(bestPrices('petrol')).toEqual([10])
  })

  it('uses midpoint percentage changes, reports PED as a magnitude, and distinguishes slope from elasticity', () => {
    expect(midpointChange(5, 8)).toBeCloseTo(600 / 13)
    expect(midpointChange(8, 5)).toBeCloseTo(-600 / 13)
    expect(elasticity(10, 15, 10, 8)).toBeCloseTo(40 / (200 / 9))
    expect(revenuePED(revenue(), { price: 2 })).toBeGreaterThan(1)
    expect(revenuePED(revenue('petrol'), { price: 10 })).toBeLessThan(1)
    expect(supplyPES(supply(), { stock: 4, machines: 3 })).toBeGreaterThan(1)
    expect(supplyPES(supply(), { stock: 1, machines: 0 })).toBeLessThan(1)
  })

  it('counts four base boxes, one per stored box and two per spare machine', () => {
    expect(quantitySupplied({ stock: 0, machines: 0 })).toBe(4)
    expect(quantitySupplied({ stock: 4, machines: 3 })).toBe(14)
    expect(quantitySupplied({ stock: 99, machines: -2 })).toBe(8)
  })
})

describe('reading configs and refusing only what cannot be drawn', () => {
  it('reads natural task names and aliases', () => {
    expect(engine.parse({ task: 'PED', good: 'cinema tickets' })).toEqual({ task: 'revenue', good: 'cinema' })
    expect(engine.parse({ task: { kind: 'total-revenue', product: 'fuel' } })).toEqual({ task: 'revenue', good: 'petrol' })
    expect(engine.parse({ task: 'PES', order: '8 boxes' })).toEqual({ task: 'supply', order: 8 })
    expect(engine.parse({ task: 'spare-capacity' })).toEqual({ task: 'supply', order: 10 })
    expect(engine.parse({ good: 'cinema' })).toEqual({ task: 'revenue', good: 'cinema' })
    expect(engine.parse(null)).toBeNull()
    expect(engine.parse({ task: 'cross-elasticity' })).toBeNull()
    expect(engine.parse({ task: 'supply', order: 'many' })).toBeNull()
  })

  it('gives actionable faults for unknown goods and impossible orders', () => {
    expect(engine.faults(revenue())).toEqual([])
    expect(engine.faults(revenue('petrol'))).toEqual([])
    expect(engine.faults(revenue('bread')).join(' ')).toMatch(/use good "cinema".*"petrol"/)
    expect(engine.faults(supply(5))).toEqual([])
    expect(engine.faults(supply(14))).toEqual([])
    expect(engine.faults(supply(15)).join(' ')).toMatch(/5 to 14.*order 14/)
    expect(engine.faults(supply(4)).join(' ')).toMatch(/order 5/)
    expect(engine.faults(supply(9.5)).join(' ')).toMatch(/whole order/)
  })
})

/** Every valid config: both goods, and every whole order the factory can fill. */
function everyConfig(): ElasticityConfig[] {
  return [...GOODS.map((good) => revenue(good)), ...Array.from({ length: ORDER_MAX - ORDER_MIN + 1 }, (_, i) => supply(ORDER_MIN + i))]
}

describe('the engine over every valid configuration', { timeout: 30_000 }, () => {
  it('starts unsolved, solves, and has no faults', () => {
    for (const config of everyConfig()) {
      expect(engine.faults(config)).toEqual([])
      expect(engine.check(config, engine.initial(config)).ok, JSON.stringify(config)).toBe(false)
      expect(engine.check(config, engine.solve(config)), JSON.stringify(config)).toEqual({ ok: true, wrongIds: [] })
    }
  })

  it('accepts every tied best price and every exact stock/machine combination', () => {
    for (const good of GOODS) {
      const c = revenue(good)
      const best = Math.max(...Array.from({ length: 9 }, (_, i) => totalRevenue(good, i + 2)))
      for (let price = 2; price <= 10; price++) expect(engine.check(c, { price }).ok).toBe(totalRevenue(good, price) === best)
      expect(engine.check(c, { price: 2.5 }).ok).toBe(false)
    }
    for (let order = ORDER_MIN; order <= ORDER_MAX; order++) {
      const c = supply(order)
      let combinations = 0
      for (let stock = 0; stock <= 4; stock++) for (let machines = 0; machines <= 3; machines++) {
        const exact = 4 + stock + 2 * machines === order
        expect(engine.check(c, { stock, machines }).ok).toBe(exact)
        if (exact) combinations++
      }
      expect(combinations).toBeGreaterThan(0)
    }
  })
})

describe('prompts and the catalogue', () => {
  const faults = (config: ElasticityConfig, prompt: string) => engine.promptFaults!(config, prompt)

  it('allows the gesture and goal, but not the economic answer', () => {
    expect(faults(revenue(), 'Tap minus or plus on Price to move the cinema price tag. Find the price that earns the most total revenue.')).toEqual([])
    expect(faults(revenue(), 'Lower the price to $2; demand is elastic and PED = 1.5.').join(' ')).toMatch(/gives.*away/)
    expect(faults(revenue(), 'Drag the demand curve to find the best price.').join(' ')).toMatch(/does not show/)
    expect(faults(supply(), 'Tap minus or plus on Stored boxes and Spare machines. Supply exactly 10 boxes to fill the order.')).toEqual([])
    expect(faults(supply(), 'Use all 4 stored boxes and switch on 3 machines for elastic supply.').join(' ')).toMatch(/gives.*away/)
    expect(faults(supply(), 'Drag shoppers to maximise total revenue.').join(' ')).toMatch(/does not show/)
  })

  it('passes the examples in its own catalogue entry', () => {
    const e = getEngine('price-elasticity')!
    const found = [...e.prompt.matchAll(/"prompt":"([^"]+)"[\s\S]*?"config": (\{[\s\S]*?\}) \}/g)]
    expect(found.length).toBeGreaterThanOrEqual(3)
    for (const m of found) {
      const config = e.parse(JSON.parse(m[2]))!
      expect(e.faults(config)).toEqual([])
      expect(e.check(config, e.initial(config)).ok).toBe(false)
      expect(e.check(config, e.solve(config)).ok).toBe(true)
      expect(e.promptFaults!(config, m[1])).toEqual([])
    }
  })

  it('catches elasticity stations and leaves its neighbours alone', () => {
    expect(scenesFor('Price elasticity of demand and total revenue').map((e) => e.id)).toContain('price-elasticity')
    expect(scenesFor('Price elasticity of supply: spare capacity and stocks').map((e) => e.id)).toContain('price-elasticity')
    expect(sceneCatalogue('Determinants of PED')).toContain('SCENE "price-elasticity"')
    expect(sceneCatalogue('Market equilibrium: shortages and surpluses')).not.toContain('SCENE "price-elasticity"')
    expect(sceneCatalogue("Hooke's law and elasticity of materials")).not.toContain('SCENE "price-elasticity"')
    expect(sceneCatalogue('Break-even analysis')).not.toContain('SCENE "price-elasticity"')
    expect(sceneCatalogue('International trade and tariffs')).not.toContain('SCENE "price-elasticity"')
    expect(engine.isolates).toBe('consequence')
    expect(engine.prompt).toMatch(/"isolates":"consequence"/)
    expect(engine.prompt).toMatch(/"apparatus":"scene:price-elasticity"/)
  })
})

describe('the card before and after marking', () => {
  const card = (config: unknown, prompt: string) => renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
    id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'price-elasticity', config }, success: { kind: 'scene' } } },
  } as never)))

  it('shows the goal, controls and live measures, with real button names', () => {
    const html = card({ task: 'revenue', good: 'cinema' }, 'Set the price for the most revenue.')
    expect(html).toContain('aria-label="Raise the price by one dollar"')
    expect(html).toContain('aria-label="Lower the price by one dollar"')
    expect(html).toContain('Total revenue')
    expect(html).toContain('Shoppers')
    expect(html).toContain('price x shoppers')
    const made = card({ task: 'supply', order: 10 }, 'Fill the order exactly.')
    expect(made).toContain('aria-label="Switch on one spare machine"')
    expect(made).toContain('order')
    expect(made).toContain('10 boxes')
  })

  it('names no elasticity category or coefficient before marking, even to a screen reader', () => {
    const demand = card({ task: 'revenue', good: 'cinema' }, 'Find the price with most revenue.').replace('Find the price with most revenue.', '')
    expect(demand.toLowerCase()).not.toMatch(/elastic|inelastic|unitary|ped\s*=|highest total/)
    const supplyHtml = card({ task: 'supply', order: 10 }, 'Fill the order exactly.').replace('Fill the order exactly.', '')
    expect(supplyHtml.toLowerCase()).not.toMatch(/elastic|inelastic|unitary|pes\s*=|percentage/)
    expect(supplyHtml).not.toContain('60.87')
  })

  it('reveals exact measurements and the explanation only after marking', () => {
    const view = (config: ElasticityConfig, marked: 'right' | 'wrong' | 'shown') => renderToStaticMarkup(createElement(PriceElasticityView, {
      config, state: engine.solve(config), setState: () => {}, marked, reduced: false, locked: marked === 'right',
    }))
    const right = view(revenue(), 'right')
    expect(right).toMatch(/Yes\. \$20 is the highest total revenue/)
    expect(right).toMatch(/PED = 1\.33: elastic/)
    expect(right).toMatch(/substitutes/)
    const wrong = renderToStaticMarkup(createElement(PriceElasticityView, { config: revenue(), state: { price: 6 }, setState: () => {}, marked: 'wrong', reduced: false, locked: false }))
    expect(wrong).toMatch(/At \$6, 2 shoppers bring total revenue of \$12/)
    expect(wrong).not.toMatch(/PED =/)
    expect(view(supply(), 'right')).toMatch(/PES = 1\.86: elastic/)
    expect(view(supply(), 'right')).toMatch(/Stored boxes and spare machines/)
  })

  it('shows the solved state on shown and keeps a still frame under reduced motion', () => {
    const html = renderToStaticMarkup(createElement(PriceElasticityView, { config: revenue(), state: { price: 6 }, setState: () => {}, marked: 'shown', reduced: true, locked: true }))
    expect(html).toMatch(/\$20 is the highest/)
    expect(html).not.toMatch(/transition:/)
    const factory = renderToStaticMarkup(createElement(PriceElasticityView, { config: supply(14), state: engine.solve(supply(14)), setState: () => {}, marked: 'right', reduced: true, locked: true }))
    expect(factory).not.toMatch(/transition:/)
  })

  it('keeps view geometry in the same range as the config and plate', () => {
    expect(DRAW_LIMITS).toEqual({ minX: 0, maxX: W, minY: 0, maxY: H, orderMin: ORDER_MIN, orderMax: ORDER_MAX, priceMin: 2, priceMax: 10 })
    expect(W).toBe(360)
    expect(H).toBe(246)
  })
})
