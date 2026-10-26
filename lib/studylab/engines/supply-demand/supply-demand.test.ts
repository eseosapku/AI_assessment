// lib/studylab/engines/supply-demand/supply-demand.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  supplyDemandEngine as engine, BASE, BY, CONTROLS, DEMAND_TOP, EVENTS, EVENT_IDS, MAX, MAX_SHIFT, NOTCH, SIDES, SUPPLY_FOOT,
  controlOutcome, controlPrice, equilibrium, eventsIn, madeControl, madeShift, namedControl, namedShift, promptFaults,
  quantityDemanded, quantitySupplied, readEvent,
  type Answer, type ControlTask, type EventId, type SupplyDemandConfig, type SupplyDemandState,
} from './config'
import { SupplyDemandView, VIEW, segment } from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import '..'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

/**
 * A market diagram, worked out exactly: the tutor names an event or a price
 * control, the engine draws straight demand and supply curves, every
 * equilibrium, shortage and surplus, and marks what the learner does.
 */

const SHIFTS = [-4, -2, 0, 2, 4]
const ANSWERS: (Answer | null)[] = [null, 'shortage', 'surplus', 'none']
const shiftConfig = (event: EventId): SupplyDemandConfig => ({ task: { kind: 'shift', event } })
const controlConfigs: SupplyDemandConfig[] = CONTROLS.flatMap((control) => SIDES.flatMap((side) => BY.map((by) => ({ task: { kind: 'price-control' as const, control, side, by } }))))
const ALL: SupplyDemandConfig[] = [...EVENT_IDS.map(shiftConfig), ...controlConfigs]

/**
 * What each event does to the equilibrium, as a textbook states it (price, then
 * quantity): written out here, apart from the engine's own table of curves, so
 * the two check each other.
 */
const EFFECT: Record<EventId, [1 | -1, 1 | -1]> = {
  'income-rise': [1, 1], 'income-fall': [-1, -1], 'income-rise-inferior': [-1, -1], 'income-fall-inferior': [1, 1],
  'substitute-price-rise': [1, 1], 'substitute-price-fall': [-1, -1], 'complement-price-rise': [-1, -1], 'complement-price-fall': [1, 1],
  'advertising': [1, 1], 'tastes-for': [1, 1], 'tastes-against': [-1, -1], 'population-rise': [1, 1], 'population-fall': [-1, -1],
  'costs-rise': [1, -1], 'costs-fall': [-1, 1], 'technology': [-1, 1], 'subsidy': [-1, 1], 'indirect-tax': [1, -1],
  'good-weather': [-1, 1], 'bad-weather': [1, -1], 'more-firms': [-1, 1], 'fewer-firms': [1, -1],
}

describe('the market as the engine works it out', () => {
  it('crosses at a price of $6 and a quantity of 5, and the view draws the same market', () => {
    expect(BASE).toEqual({ price: 6, quantity: 5 })
    expect(quantityDemanded(6)).toBe(5)
    expect(quantitySupplied(6)).toBe(5)
    expect(VIEW).toEqual({ max: MAX, demandTop: DEMAND_TOP, supplyFoot: SUPPLY_FOOT, notch: NOTCH, maxShift: MAX_SHIFT })
  })

  it('finds a whole-number crossing inside the grid for every shift either curve can take', () => {
    for (const d of SHIFTS) {
      for (const s of SHIFTS) {
        const e = equilibrium(d, s)
        expect(Number.isInteger(e.price) && Number.isInteger(e.quantity), `${d} ${s}`).toBe(true)
        // An independent check: at the crossing, buyers want exactly what sellers offer.
        expect(quantityDemanded(e.price, d), `${d} ${s}`).toBe(e.quantity)
        expect(quantitySupplied(e.price, s), `${d} ${s}`).toBe(e.quantity)
        expect(e.price).toBeGreaterThan(0)
        expect(e.price).toBeLessThan(MAX)
        expect(e.quantity).toBeGreaterThan(0)
        expect(e.quantity).toBeLessThan(MAX)
      }
    }
    expect(equilibrium(4, 0)).toEqual({ price: 8, quantity: 7 })
    expect(equilibrium(0, -4)).toEqual({ price: 8, quantity: 3 })
  })

  it('draws each curve along its own equation, inside the grid, at every shift', () => {
    for (const shift of SHIFTS) {
      for (const curve of ['demand', 'supply'] as const) {
        const seg = segment(curve, shift)!
        expect(seg, `${curve} ${shift}`).not.toBeNull()
        for (const [q, p] of seg) {
          expect(q >= 0 && q <= MAX && p >= 0 && p <= MAX, `${curve} ${shift}`).toBe(true)
          expect(curve === 'demand' ? quantityDemanded(p, shift) : quantitySupplied(p, shift)).toBe(q)
        }
      }
    }
  })

  it('works out a price control: a maximum binds only below the equilibrium, a minimum only above it', () => {
    const t = (control: 'maximum' | 'minimum', side: 'below' | 'above', by: 1 | 2 | 3): ControlTask => ({ kind: 'price-control', control, side, by })
    expect(controlPrice(t('maximum', 'below', 2))).toBe(4)
    expect(controlOutcome(t('maximum', 'below', 2))).toMatchObject({ price: 4, binds: true, answer: 'shortage', size: 4, demanded: 7, supplied: 3 })
    expect(controlOutcome(t('minimum', 'above', 3))).toMatchObject({ price: 9, binds: true, answer: 'surplus', size: 6, demanded: 2, supplied: 8 })
    expect(controlOutcome(t('maximum', 'above', 1))).toMatchObject({ price: 7, binds: false, answer: 'none', size: 0 })
    expect(controlOutcome(t('minimum', 'below', 2))).toMatchObject({ price: 4, binds: false, answer: 'none', size: 0 })
  })
})

describe('the supply-demand engine', () => {
  it('reads every event by its id, its words and the other ways it is written', () => {
    for (const id of EVENT_IDS) {
      const e = EVENTS[id]
      expect(readEvent(id), id).toBe(id)
      expect(readEvent(e.said), id).toBe(id)
      for (const also of e.also) expect(readEvent(also), `${id}: ${also}`).toBe(id)
    }
    expect(readEvent('A rise in incomes')).toBe('income-rise')
    expect(readEvent('a rise in incomes (an inferior good)')).toBe('income-rise-inferior')
    expect(readEvent('Incomes fall, inferior good')).toBe('income-fall-inferior')
    expect(readEvent('income rise, normal good')).toBe('income-rise')
    expect(readEvent('Higher costs of production')).toBe('costs-rise')
    expect(readEvent('Indirect_Tax')).toBe('indirect-tax')
    expect(readEvent('incomeRise')).toBe('income-rise')
    // A change in the good's own price is a movement along the curves, not a shift.
    expect(readEvent('a rise in the price of the good')).toBeNull()
    expect(readEvent('a tax')).toBeNull()
    expect(readEvent('a subsidy, inferior good')).toBeNull()
    expect(readEvent('incomes rise for a normal inferior good')).toBeNull()
    expect(readEvent(7)).toBeNull()
  })

  it('reads a task however it is reasonably written, and nothing it cannot draw', () => {
    expect(engine.parse({ task: { kind: 'shift', event: 'a rise in costs of production' } })).toEqual({ task: { kind: 'shift', event: 'costs-rise' } })
    expect(engine.parse({ task: { kind: 'Shift', event: 'technology' } })).toEqual({ task: { kind: 'shift', event: 'technology' } })
    expect(engine.parse({ task: { kind: 'price control', control: 'Price ceiling', side: 'below equilibrium' } }))
      .toEqual({ task: { kind: 'price-control', control: 'maximum', side: 'below', by: 2 } })
    expect(engine.parse({ task: { kind: 'priceControl', control: 'min', side: 'Above the equilibrium price', by: '$3' } }))
      .toEqual({ task: { kind: 'price-control', control: 'minimum', side: 'above', by: 3 } })
    expect(engine.parse({ task: { kind: 'minimum-price', side: 'below', by: 1 } }))
      .toEqual({ task: { kind: 'price-control', control: 'minimum', side: 'below', by: 1 } })
    expect(engine.parse({ task: { kind: 'shift', event: 'a rise in the price of the good' } })).toBeNull()
    expect(engine.parse({ task: { kind: 'shift' } })).toBeNull()
    expect(engine.parse({ task: { kind: 'price-control', control: 'maximum', side: 'below', by: 4 } })).toBeNull()
    expect(engine.parse({ task: { kind: 'price-control', control: 'maximum', side: 'sideways' } })).toBeNull()
    expect(engine.parse({ task: { kind: 'price-control', control: 'quota', side: 'below' } })).toBeNull()
    expect(engine.parse({ task: { kind: 'elasticity', event: 'subsidy' } })).toBeNull()
    expect(engine.parse(null)).toBeNull()
  })

  it('moves the curve each event names the way a textbook says, judged by what happens to price and quantity', () => {
    for (const id of EVENT_IDS) {
      const s = engine.solve(shiftConfig(id))
      const e = equilibrium(s.demand, s.supply)
      expect([Math.sign(e.price - BASE.price), Math.sign(e.quantity - BASE.quantity)], id).toEqual(EFFECT[id])
    }
  })

  describe('over every config it can read, and every state of each', { timeout: 30_000 }, () => {
    it('starts unsolved, can be solved, and marks exactly what an independent working says', () => {
      let states = 0
      for (const c of ALL) {
        const label = JSON.stringify(c.task)
        expect(engine.parse(c), label).toEqual(c)
        expect(engine.faults(c), label).toEqual([])
        expect(engine.check(c, engine.initial(c)).ok, `${label} starts solved`).toBe(false)
        expect(engine.check(c, engine.solve(c)).ok, `${label} cannot be solved`).toBe(true)

        if (c.task.kind === 'shift') {
          const [dp, dq] = EFFECT[c.task.event]
          for (const d of SHIFTS) {
            for (const s of SHIFTS) {
              // Right when one curve, and only one, has moved so that price and quantity go the textbook's way.
              const e = equilibrium(d, s)
              const expected = (d === 0) !== (s === 0) && Math.sign(e.price - BASE.price) === dp && Math.sign(e.quantity - BASE.quantity) === dq
              expect(engine.check(c, { demand: d, supply: s }).ok, `${label} ${d} ${s}`).toBe(expected)
              states++
            }
          }
          // Shifts that are not whole notches on the grid are never right.
          for (const bad of [1, 6, -6, 2.5, Number.NaN, '2']) expect(engine.check(c, { demand: bad as number, supply: bad as number }).ok).toBe(false)
          continue
        }

        // The market price under the control, then what is left short or over at it, from the curves' own equations.
        const { control, side, by } = c.task
        const level = 6 + (side === 'above' ? by : -by)
        const market = control === 'maximum' ? Math.min(6, level) : Math.max(6, level)
        const wanted = 11 - market
        const offered = market - 1
        const kind: Answer = wanted > offered ? 'shortage' : offered > wanted ? 'surplus' : 'none'
        const amount = Math.abs(wanted - offered)
        for (let price = 0; price <= MAX; price++) {
          for (const answer of ANSWERS) {
            for (let size = 0; size <= MAX; size++) {
              const expected = price === level && answer === kind && (kind === 'none' || size === amount)
              expect(engine.check(c, { price, answer, size }).ok, `${label} ${price} ${answer} ${size}`).toBe(expected)
              states++
            }
          }
        }
      }
      expect(ALL).toHaveLength(22 + 12)
      expect(states).toBe(22 * 25 + 12 * 13 * 4 * 13)
    })
  })

  it('says what the learner made when it is wrong, never which curve the event moves or which way', () => {
    const costs = shiftConfig('costs-rise')
    expect(madeShift(costs, { demand: 2, supply: 0 })).toBe('You shifted demand to the right: that is what a rise in incomes for a normal good does, not a rise in costs of production.')
    expect(madeShift(costs, { demand: 0, supply: 4 })).toBe('You shifted supply to the right: that is what an improvement in technology does, not a rise in costs of production.')
    expect(madeShift(costs, { demand: -2, supply: -2 })).toBe('You shifted demand to the left and supply to the left: a rise in costs of production moves one curve, not both.')
    expect(madeShift(costs, { demand: 0, supply: 0 })).toMatch(/^You have not moved either curve yet/)
    expect(madeShift(shiftConfig('income-rise-inferior'), { demand: 2, supply: 0 }))
      .toBe('You shifted demand to the right: that is what a rise in incomes for a normal good does, not a rise in incomes for an inferior good.')
    for (const id of EVENT_IDS) {
      const { curve, way } = EVENTS[id]
      const answer = `${curve} to the ${way > 0 ? 'right' : 'left'}`
      for (const d of SHIFTS) {
        for (const s of SHIFTS) {
          if ((d === 0) === (s === 0)) continue
          const c = shiftConfig(id)
          if (engine.check(c, { demand: d, supply: s }).ok) continue
          const said = madeShift(c, { demand: d, supply: s })
          expect(said, `${id} ${d} ${s}`).toMatch(/^You shifted /)
          expect(said, `${id} ${d} ${s}`).not.toContain(answer)
          expect(said, `${id} ${d} ${s}`).not.toMatch(/increase in|decrease in/)
        }
      }
    }
  })

  it('names the curve, the way and why once marked right, with what happens to price and quantity', () => {
    const costs = shiftConfig('costs-rise')
    expect(namedShift(costs, engine.solve(costs))).toBe(
      'Supply shifts to the left, a decrease in supply. Each unit costs more to make, so firms supply less at every price. The price rises from $6 to $8, and the quantity falls from 5 to 3.',
    )
    const incomes = shiftConfig('income-rise')
    expect(namedShift(incomes, { demand: 2, supply: 0 })).toBe(
      'Demand shifts to the right, an increase in demand. Buyers have more to spend, so they want more of a normal good at every price. The price rises from $6 to $7, and the quantity rises from 5 to 6.',
    )
  })

  it('says what the learner set or said about a price control, never what happens', () => {
    const max = (side: 'below' | 'above'): SupplyDemandConfig => ({ task: { kind: 'price-control', control: 'maximum', side, by: 2 } })
    expect(madeControl(max('below'), { price: 5, answer: 'shortage', size: 4 })).toBe('You set the maximum price at $5, not $4: move the line to $4 first.')
    expect(madeControl(max('below'), { price: 4, answer: null, size: 0 })).toMatch(/^Say what happens with the maximum price at \$4 first/)
    expect(madeControl(max('below'), { price: 4, answer: 'shortage', size: 3 })).toMatch(/^You said a shortage of 3 units, but the gap between the curves at \$4 is not 3/)
    expect(madeControl(max('below'), { price: 4, answer: 'surplus', size: 4 })).toBe('You said a surplus of 4 units: that means sellers offer 4 more than buyers want, at the price the market ends up at.')
    expect(madeControl(max('below'), { price: 4, answer: 'none', size: 0 })).toBe('You said neither: that is when the market can still settle where demand meets supply.')
    expect(madeControl(max('above'), { price: 8, answer: 'surplus', size: 4 })).toMatch(/^You said a surplus of 4 units: that means/)
    for (const c of controlConfigs) {
      const right = controlOutcome(c.task as ControlTask)
      for (const answer of ANSWERS) {
        for (let size = 0; size <= MAX; size++) {
          const state = { price: right.price, answer, size }
          if (engine.check(c, state).ok) continue
          const said = madeControl(c, state)
          expect(said).not.toMatch(/excess|does not bind|stays at/)
          if (right.answer !== 'none' && answer !== right.answer) expect(said).not.toContain(`${right.answer} of`)
        }
      }
    }
  })

  it('explains the price control once marked right', () => {
    expect(namedControl({ task: { kind: 'price-control', control: 'maximum', side: 'below', by: 2 } })).toBe(
      'A maximum price of $4 is below the equilibrium price of $6. At $4 buyers want 7 but sellers offer only 3: a shortage, or excess demand, of 4 units.',
    )
    expect(namedControl({ task: { kind: 'price-control', control: 'minimum', side: 'above', by: 1 } })).toBe(
      'A minimum price of $7 is above the equilibrium price of $6. At $7 sellers offer 6 but buyers want only 4: a surplus, or excess supply, of 2 units.',
    )
    expect(namedControl({ task: { kind: 'price-control', control: 'maximum', side: 'above', by: 3 } })).toBe(
      'A maximum price of $9 is above the equilibrium price of $6, so it does not bind: the price stays at $6, where buyers want 5 and sellers offer 5. There is no shortage or surplus.',
    )
  })

  it('is registered for the tutor, with its config in its catalogue entry', () => {
    expect(getEngine('supply-demand')).toBe(engine)
    expect(engine.isolates).toBe('consequence')
    expect(engine.prompt).toMatch(/SCENE "supply-demand"/)
    expect(engine.prompt).toMatch(/"engine":"supply-demand"/)
    expect(engine.prompt).toMatch(/"pattern":"scene"/)
    expect(engine.prompt).toMatch(/"success": \{ "kind":"scene" \}/)
    expect(engine.prompt).toMatch(/"apparatus":"scene:supply-demand"/)
    expect(engine.prompt).toMatch(/"isolates":"consequence"/)
    for (const kind of ['shift', 'price-control']) expect(engine.prompt).toContain(`"kind":"${kind}"`)
    // Every event the engine knows is listed for the tutor, by the id it parses.
    for (const id of EVENT_IDS) expect(engine.prompt, id).toMatch(new RegExp(`\\b${id}\\b`))
    const examples = [...engine.prompt.matchAll(/"config": (\{ "task": \{[^}]*\} \})/g)].map((m) => JSON.parse(m[1]))
    expect(examples.length).toBeGreaterThanOrEqual(2)
    for (const ex of examples) expect(engine.faults(engine.parse(ex)!)).toEqual([])
  })

  it('is offered to stations on markets, and not to others', () => {
    for (const station of ['Demand and supply', 'Maximum and minimum prices', 'Price determination: equilibrium and disequilibrium', 'Shortages and surpluses']) {
      expect(sceneCatalogue(station), station).toContain('SCENE "supply-demand"')
    }
    for (const station of ['Equivalent fractions', 'Rates of reaction', 'Photosynthesis', 'The circulatory system']) {
      expect(sceneCatalogue(station), station).not.toContain('SCENE "supply-demand"')
    }
    expect(scenesFor('Shortages and surpluses in a market').map((e) => e.id)).toContain('supply-demand')
  })
})

describe('the supply-demand scene on the board', () => {
  const card = (config: unknown, prompt: string) =>
    renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'supply-demand', config }, success: { kind: 'scene' } } },
    } as never)))
  const view = (config: SupplyDemandConfig, state: SupplyDemandState, marked: 'idle' | 'right' | 'wrong' | 'shown') =>
    renderToStaticMarkup(createElement(SupplyDemandView, { config, state, setState: () => {}, marked, reduced: false, locked: marked === 'right' }))
  /** What a learner can see or hear: the markup without its classes, styles and the board's data attributes, which say nothing. */
  const shown = (html: string, ...remove: string[]) =>
    remove.reduce((h, r) => h.split(r).join(''), html.replace(/\s(class|style|data-[a-z-]+)="[^"]*"/g, ''))

  it('shift: shows the event, a grid with both curves the keyboard can move, and names no curve or way before marking', () => {
    const prompt = 'What does this event do to the market? Shift the curve it moves.'
    for (const id of EVENT_IDS) {
      const html = card({ task: { kind: 'shift', event: id } }, prompt)
      const text = EVENTS[id].text
      expect(html, id).toContain(text.charAt(0).toUpperCase() + text.slice(1))
      expect(html.match(/role="slider"/g), id).toHaveLength(2)
      expect(html, id).toMatch(/aria-label="The demand curve[^"]*"[^>]*aria-valuetext="not moved"/)
      expect(html, id).toMatch(/aria-label="The supply curve[^"]*"[^>]*aria-valuetext="not moved"/)
      const seen = shown(html, prompt, text)
      expect(seen, id).not.toMatch(/\b(left|right|increase|decrease|shifts|rises|falls|D2|S2)\b/i)
      expect(seen, id).not.toMatch(/You shifted/)
    }
    const html = card({ task: { kind: 'shift', event: 'income-rise' } }, prompt)
    expect(html).toContain('It is a normal good.')
    expect(html).toContain('Price $6')
    expect(html).toContain('Quantity 5')
    for (let t = 0; t <= MAX; t++) expect(html).toContain(`>${t}</text>`)
  })

  it('price-control: shows the government’s price, a line the keyboard can move, three choices, and no answer before marking', () => {
    const prompt = 'The government sets this price. Set the line there, then say what happens and by how much.'
    for (const c of controlConfigs) {
      const task = c.task as ControlTask
      const html = card(c, prompt)
      expect(html).toContain(`The government sets a ${task.control} price of $${controlPrice(task)}.`)
      expect(html).toMatch(/role="slider"[^>]*aria-valuenow="6"[^>]*aria-valuetext="\$6"/)
      for (const choice of ['Shortage', 'Surplus', 'Neither']) expect(html).toMatch(new RegExp(`aria-pressed="false"[^>]*>${choice}</button>`))
      const seen = shown(html, prompt)
      expect(seen).not.toMatch(/(shortage|surplus) of|excess|does not bind|stays at|You said|You set/i)
    }
  })

  it('once marked, says what the learner did when wrong, and names the answer when right', () => {
    const costs = shiftConfig('costs-rise')
    const wrong = view(costs, { demand: 2, supply: 0 }, 'wrong')
    expect(wrong).toContain('You shifted demand to the right: that is what a rise in incomes for a normal good does, not a rise in costs of production.')
    expect(wrong).toContain('D2')
    expect(wrong).not.toContain('Supply shifts')
    const right = view(costs, engine.solve(costs), 'right')
    expect(right).toContain('Supply shifts to the left, a decrease in supply.')
    expect(right).toContain('S2')
    expect(right).toContain('Price $6 → $8')
    expect(right).toContain('Quantity 5 → 3')

    const max = (side: 'below' | 'above'): SupplyDemandConfig => ({ task: { kind: 'price-control', control: 'maximum', side, by: 2 } })
    const said = view(max('below'), { price: 4, answer: 'surplus', size: 4 }, 'wrong')
    expect(said).toContain('You said a surplus of 4 units')
    expect(said).not.toMatch(/Shortage of|excess demand/)
    expect(view(max('below'), engine.solve(max('below')), 'right')).toContain('Shortage of 4')
    const loose = view(max('above'), engine.solve(max('above')), 'shown')
    expect(loose).toContain('The price stays at $6')
    expect(loose).toContain('so it does not bind')
  })

  it('locks its controls once solved', () => {
    const costs = shiftConfig('costs-rise')
    const html = view(costs, engine.solve(costs), 'right')
    expect(html.match(/tabindex="-1"/g)).toHaveLength(2)
    expect(html).toMatch(/aria-disabled="true"/)
    const c: SupplyDemandConfig = { task: { kind: 'price-control', control: 'minimum', side: 'above', by: 2 } }
    const locked = view(c, engine.solve(c), 'right')
    expect(locked).toMatch(/role="slider"[^>]*tabindex="-1"/)
    expect(locked.match(/<button[^>]*disabled=""/g)!.length).toBeGreaterThanOrEqual(3)
  })
})

describe('the prompt a supply-demand card is written with', () => {
  const shift = (prompt: string, event: EventId = 'costs-rise') => promptFaults(shiftConfig(event), prompt)
  const control = (prompt: string, task: Partial<ControlTask> = {}) =>
    promptFaults({ task: { kind: 'price-control', control: 'maximum', side: 'below', by: 2, ...task } }, prompt)

  it('may not say which curve an event moves, or which way', () => {
    for (const prompt of [
      'Shift the supply curve to show this event.',
      'Show the decrease in supply.',
      'Show the effect on demand.',
      'Move the S curve to show what happens.',
      'Show the curve moving to the left.',
      'Drag it right to show the effect.',
      'Shift the curve leftwards.',
      'Shift the curve inwards.',
    ]) expect(shift(prompt).join(' '), prompt).toMatch(/gives the answer away/)
  })

  it('asks plainly, and may name the same event the scene shows', () => {
    expect(shift('What does this event do to the market? Shift the curve it moves.')).toEqual([])
    expect(shift('Use the demand and supply diagram to show what this event does.')).toEqual([])
    expect(shift('Costs of production rise for coffee farmers. Show the effect on the market.')).toEqual([])
    expect(shift('Incomes rise. Show the effect on the market.', 'income-rise')).toEqual([])
    expect(shift('Incomes rise, and bus travel is an inferior good. Show the effect.', 'income-rise-inferior')).toEqual([])
    expect(shift('Incomes rise. Show the effect.', 'income-rise-inferior')).toEqual([])
  })

  it('may not name a different event from the scene’s', () => {
    expect(shift('Incomes rise. Show the effect on the market.').join(' ')).toMatch(/names a rise in incomes for a normal good, but the scene's event is a rise in costs of production/)
    expect(eventsIn('A drought hits, and new firms enter the market.')).toEqual(new Set(['more-firms']))
    expect(eventsIn('Incomes rise, and it is an inferior good.')).toEqual(new Set(['income-rise-inferior']))
  })

  it('may not say what a price control does', () => {
    expect(control('Set the price, then find the shortage.').join(' ')).toMatch(/gives the answer away/)
    expect(control('How big is the excess demand?').join(' ')).toMatch(/gives the answer away/)
    expect(control('This maximum price does not bind.', { side: 'above' }).join(' ')).toMatch(/gives the answer away/)
    expect(control('The government sets this price. Set the line there, then say what happens and by how much.')).toEqual([])
    expect(control('The government sets a maximum price of $4, below the equilibrium. What happens?')).toEqual([])
  })

  it('may not contradict the scene’s control, price or side', () => {
    expect(control('The government sets a minimum price. What happens?').join(' ')).toMatch(/names a minimum price, but the scene sets a maximum price/)
    expect(control('The government sets a maximum price of $5. What happens?').join(' ')).toMatch(/names \$5, but the scene's maximum price is \$4/)
    expect(control('A maximum price is set above the equilibrium. What happens?').join(' ')).toMatch(/says the price is above the equilibrium, but the scene sets it below/)
  })

  it('passes the examples in its own catalogue entry', () => {
    const e = getEngine('supply-demand')!
    const found = [...e.prompt.matchAll(/"prompt":"([^"]+)"[\s\S]*?"config": (\{[\s\S]*?\} \}) \}/g)]
    expect(found.length).toBeGreaterThan(0)
    for (const m of found) expect(e.promptFaults!(e.parse(JSON.parse(m[2]))!, m[1])).toEqual([])
  })
})
