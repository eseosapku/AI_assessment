// lib/studylab/engines/macro-board/macro-board.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  AIMS, BAND, BASE, COST_MARK, COST_SHOCKS, DEMAND_SHOCKS, FULL_CAPACITY, LEVERS, LEVER_INFO, MAX_LEVEL, MAX_STEPS, MIN_LEVEL, SHOCK_INFO, WORKER_RUNGS,
  flowsOf, inflation, leaking, levelOf, macroBoardEngine as engine, madeText, onMark, pouring, priceMark, stepOf, stepRange, tagRungs, tagsLit, targetMark, unemployment, working, workersOut,
} from './config'
import type { MacroConfig, MacroState } from './config'
import {
  BOTTOM_LABEL_Y, COLUMNS, H, MacroBoardView, TAG_X, TANK_B, TANK_L, TANK_R, TANK_T, TOP_LABEL_Y, W, WORKER_X, labelBoxes, yOf,
} from './View'
import { sceneCatalogue, scenesFor } from '../registry'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const steer = (shock: string, lever: string): MacroConfig => ({ task: 'steer', shock, lever, aim: 'prices' })
const conflict = (shock: string, lever: string, aim: string): MacroConfig => ({ task: 'conflict', shock, lever, aim })

/** Every config the tutor can write that faults accepts. */
const STEER = DEMAND_SHOCKS.flatMap((s) => LEVERS.map((l) => steer(s, l)))
const CONFLICT = COST_SHOCKS.flatMap((s) => LEVERS.flatMap((l) => AIMS.map((a) => conflict(s, l, a))))
const ALL = [...STEER, ...CONFLICT]
const name = (c: MacroConfig) => `${c.task} ${c.shock} ${c.lever} ${c.aim}`
const stepsOf = (c: MacroConfig) => {
  const { min, max } = stepRange(c)
  return Array.from({ length: max - min + 1 }, (_, i) => min + i)
}
const levelAt = (c: MacroConfig, k: number) => levelOf(flowsOf(c, k))

describe('the machine', () => {
  it('starts in balance at full capacity, with a multiplier of 2.5', () => {
    expect(pouring(BASE)).toBe(40)
    expect(leaking(BASE)).toBe(40)
    expect(levelOf(BASE)).toBe(FULL_CAPACITY)
    expect(levelOf({ ...BASE, government: BASE.government + 4 }) - FULL_CAPACITY).toBe(10)
  })

  it('settles exactly where what leaks out matches what pours in', () => {
    for (const c of ALL) for (const k of stepsOf(c)) {
      const f = flowsOf(c, k)
      expect((leaking(f) * levelOf(f)) / 100).toBeCloseTo(pouring(f), 9)
    }
  })

  it('moves each lever the way the economics says', () => {
    const c = (lever: string) => steer('investment-rise', lever)
    const up = (lever: string) => levelAt(c(lever), 1) - levelAt(c(lever), 0)
    // Dearer borrowing, better saving: less investment, more leak.
    expect(flowsOf(c('interest'), 1).investment).toBeLessThan(flowsOf(c('interest'), 0).investment)
    expect(flowsOf(c('interest'), 1).saving).toBeGreaterThan(flowsOf(c('interest'), 0).saving)
    expect(up('interest')).toBeLessThan(0)
    // More tax: more leak, nothing else.
    expect(flowsOf(c('tax'), 1).tax).toBeGreaterThan(flowsOf(c('tax'), 0).tax)
    expect(flowsOf(c('tax'), 1).investment).toBe(flowsOf(c('tax'), 0).investment)
    expect(up('tax')).toBeLessThan(0)
    // More spending: more poured in.
    expect(flowsOf(c('spending'), 1).government).toBeGreaterThan(flowsOf(c('spending'), 0).government)
    expect(up('spending')).toBeGreaterThan(0)
    // A stronger exchange rate: exports dearer abroad, imports cheaper here.
    expect(flowsOf(c('exchange'), 1).exports).toBeLessThan(flowsOf(c('exchange'), 0).exports)
    expect(flowsOf(c('exchange'), 1).imports).toBeGreaterThan(flowsOf(c('exchange'), 0).imports)
    expect(up('exchange')).toBeLessThan(0)
  })

  it('never gives a pipe less than nothing, and keeps the lever values real', () => {
    for (const c of ALL) for (const k of stepsOf(c)) for (const v of Object.values(flowsOf(c, k))) expect(v).toBeGreaterThanOrEqual(0)
    expect(LEVER_INFO.interest.value(-4)).toBe('1%')
    expect(LEVER_INFO.tax.value(0)).toBe('20%')
    expect(LEVER_INFO.spending.value(2)).toBe('$28bn')
    expect(LEVER_INFO.exchange.value(-2)).toBe('$0.80')
  })

  it('stops each lever at the end of its travel, or where the tank runs dry or brims', () => {
    for (const c of ALL) {
      const { min, max } = stepRange(c)
      expect(min).toBeGreaterThanOrEqual(-MAX_STEPS)
      expect(max).toBeLessThanOrEqual(MAX_STEPS)
      for (const k of stepsOf(c)) {
        expect(levelAt(c, k)).toBeGreaterThanOrEqual(MIN_LEVEL)
        expect(levelAt(c, k)).toBeLessThanOrEqual(MAX_LEVEL)
      }
    }
  })

  it('reads a state safely', () => {
    const c = steer('investment-fall', 'interest')
    expect(stepOf(c, { step: -2 })).toBe(-2)
    expect(stepOf(c, { step: 99 })).toBe(stepRange(c).max)
    expect(stepOf(c, { step: -99 })).toBe(stepRange(c).min)
    for (const bad of [{}, null, undefined, { step: 'two' }, { step: 1.5 }, { step: NaN }]) {
      expect(stepOf(c, bad as unknown as MacroState)).toBe(0)
      expect(engine.check(c, bad as unknown as MacroState).ok).toBe(false)
    }
  })
})

describe('one level, two results', () => {
  it('counts the workers and tags the readouts report', () => {
    const c = steer('investment-fall', 'interest')
    // A worker out for each $10bn under the mark's band; 4 points of unemployment each.
    for (const rung of WORKER_RUNGS) expect(unemployment(rung)).toBe(4 + 4 * workersOut(rung))
    // A tag lit for each $10bn over; 3 points of inflation each.
    for (const rung of tagRungs(c)) expect(inflation(c, rung)).toBeCloseTo(2 + 3 * tagsLit(c, rung), 9)
  })

  it('has no worker out and no tag lit inside the band when the marks are together', () => {
    const c = steer('investment-fall', 'interest')
    for (let v = FULL_CAPACITY - BAND; v <= FULL_CAPACITY + BAND; v++) {
      expect(workersOut(v)).toBe(0)
      expect(tagsLit(c, v)).toBe(0)
      expect(unemployment(v)).toBe(4)
      expect(inflation(c, v)).toBe(2)
    }
  })

  it('has no level at all that fixes both once costs have jumped', () => {
    for (const c of CONFLICT) {
      expect(priceMark(c)).toBe(COST_MARK)
      for (let v = MIN_LEVEL; v <= MAX_LEVEL; v++) expect(workersOut(v) + tagsLit(c, v)).toBeGreaterThan(0)
    }
    // Between the marks every step down swaps a tag for a worker: three problems whichever way it goes.
    const c = CONFLICT[0]
    for (const v of [68, 72, 78, 82, 88, 92, 98]) expect(workersOut(v) + tagsLit(c, v)).toBe(3)
  })

  it('reaches either mark in a conflict, each at a real cost', () => {
    for (const shock of COST_SHOCKS) for (const lever of LEVERS) {
      const prices = conflict(shock, lever, 'prices')
      const jobs = conflict(shock, lever, 'jobs')
      expect(targetMark(prices)).toBe(COST_MARK)
      expect(targetMark(jobs)).toBe(FULL_CAPACITY)
      const atPrices = levelAt(prices, engine.solve(prices).step)
      const atJobs = levelAt(jobs, engine.solve(jobs).step)
      expect(inflation(prices, atPrices)).toBe(2)
      expect(unemployment(atPrices)).toBeGreaterThanOrEqual(12)
      expect(unemployment(atJobs)).toBe(4)
      expect(inflation(jobs, atJobs)).toBeGreaterThanOrEqual(7)
    }
  })

  it('starts a conflict between the marks, with both problems showing', () => {
    for (const c of CONFLICT) {
      expect(levelAt(c, 0)).toBeGreaterThan(COST_MARK + BAND)
      expect(levelAt(c, 0)).toBeLessThan(FULL_CAPACITY - BAND)
      expect(workersOut(levelAt(c, 0))).toBeGreaterThan(0)
      expect(tagsLit(c, levelAt(c, 0))).toBeGreaterThan(0)
    }
  })
})

describe('every config the tutor can write', { timeout: 30_000 }, () => {
  it('enumerates forty', () => {
    expect(STEER.length).toBe(24)
    expect(CONFLICT.length).toBe(16)
  })

  it.each(ALL.map((c) => [name(c), c] as const))('%s is valid, starts unsolved and can be solved', (_, c) => {
    expect(engine.parse(c)).toEqual(c)
    expect(engine.faults(c)).toEqual([])
    const start = engine.initial(c)
    expect(start).toEqual({ step: 0 })
    expect(engine.check(c, start).ok).toBe(false)
    const solved = engine.solve(c)
    expect(engine.check(c, solved).ok).toBe(true)
    expect(solved.step).not.toBe(0)
    const { min, max } = stepRange(c)
    expect(solved.step).toBeGreaterThanOrEqual(min)
    expect(solved.step).toBeLessThanOrEqual(max)
  })

  it('marks every step of the lever by the level, never the drawing', () => {
    for (const c of ALL) for (const k of stepsOf(c)) {
      const inside = Math.abs(levelAt(c, k) - targetMark(c)) <= BAND
      expect(onMark(c, k)).toBe(inside)
      expect(engine.check(c, { step: k }).ok).toBe(inside)
    }
  })

  it('brings a steer back exactly to balance: what pours in equals what leaks out at the mark', () => {
    for (const c of STEER) {
      const f = flowsOf(c, engine.solve(c).step)
      expect(pouring(f)).toBe(leaking(f))
      expect(levelOf(f)).toBe(FULL_CAPACITY)
    }
  })

  it('needs more than one click, so the answer is not found by accident', () => {
    for (const c of STEER) expect(Math.abs(engine.solve(c).step)).toBeGreaterThanOrEqual(2)
  })

  it('makes a clear change with the smallest move', () => {
    // On the plate the water moves at least 8 px on the first tap, and at least 4 px even once a valve has shut.
    for (const c of ALL) {
      const steps = stepsOf(c)
      for (let i = 1; i < steps.length; i++) {
        const moved = Math.abs(yOf(levelAt(c, steps[i])) - yOf(levelAt(c, steps[i - 1])))
        expect(moved, name(c)).toBeGreaterThanOrEqual(steps[i] === 0 || steps[i - 1] === 0 ? 8 : 4)
      }
    }
  })

  it('says what was made, and something true, for every state', () => {
    for (const c of ALL) for (const k of stepsOf(c)) {
      const said = onMark(c, k) ? working(c, { step: k }) : madeText(c, { step: k })
      expect(said).not.toMatch(/undefined|NaN/)
      if (onMark(c, k)) expect(said).toMatch(/^Yes\. /)
      else {
        expect(said).not.toMatch(/^Yes/)
        expect(said).toMatch(/below|above/)
        expect(said).not.toMatch(/\b(?:raise|lower|cut|reduce|increase)\b/i)
      }
    }
  })

  it('explains the lever in the right direction', () => {
    const say = (c: MacroConfig) => working(c, engine.solve(c))
    expect(say(steer('investment-fall', 'interest'))).toContain('You cut the interest rate from 5% to 3%')
    expect(say(steer('investment-rise', 'interest'))).toContain('You raised the interest rate from 5% to 7%')
    expect(say(steer('investment-fall', 'tax'))).toContain('You cut tax from 20% to 12%')
    expect(say(steer('investment-rise', 'tax'))).toContain('You raised tax from 20% to 28%')
    expect(say(steer('investment-fall', 'spending'))).toContain('from $20bn to $28bn, and income rose $20bn: the multiplier')
    expect(say(steer('investment-rise', 'spending'))).toContain('from $20bn to $12bn, and income fell $20bn')
    expect(say(steer('exports-fall', 'exchange'))).toContain('lowered the exchange rate from $1.00 to $0.80')
    expect(say(steer('exports-rise', 'exchange'))).toContain('raised the exchange rate from $1.00 to $1.30')
    expect(say(conflict('oil', 'interest', 'prices'))).toContain('but unemployment is')
    expect(say(conflict('oil', 'interest', 'jobs'))).toContain('but prices are rising at')
    expect(say(conflict('oil', 'interest', 'jobs'))).toContain('cannot reach both')
  })
})

describe('reading the tutor', () => {
  it('reads the many ways a writer names things', () => {
    const read = (raw: unknown) => engine.parse(raw)
    expect(read({ shock: 'recession', lever: 'Interest Rates' })).toMatchObject({ task: 'steer', shock: 'investment-fall', lever: 'interest' })
    expect(read({ problem: 'High inflation', policy: 'monetary policy' })).toMatchObject({ task: 'steer', shock: 'saving-fall', lever: 'interest' })
    expect(read({ event: 'demand-pull inflation', tool: 'income tax' })).toMatchObject({ shock: 'saving-fall', lever: 'tax' })
    expect(read({ situation: 'cost-push inflation', instrument: 'government spending' })).toMatchObject({ task: 'conflict', shock: 'oil', lever: 'spending', aim: 'prices' })
    expect(read({ shock: 'a rise in oil prices', lever: 'exchange rate', aim: 'unemployment' })).toMatchObject({ task: 'conflict', shock: 'oil', lever: 'exchange', aim: 'jobs' })
    expect(read({ shock: 'failed harvest', lever: 'tax', aim: 'inflation' })).toMatchObject({ task: 'conflict', shock: 'harvest', aim: 'prices' })
    expect(read({ shock: 'drought' })).toMatchObject({ shock: 'harvest' })
    expect(read({ shock: 'world recession', lever: 'the currency' })).toMatchObject({ shock: 'exports-fall', lever: 'exchange' })
    expect(read({ shock: 'exports collapse' })).toMatchObject({ shock: 'exports-fall' })
    expect(read({ shock: 'export boom' })).toMatchObject({ shock: 'exports-rise' })
    expect(read({ shock: 'firms stop investing' })).toMatchObject({ shock: 'investment-fall' })
    expect(read({ shock: 'loss of confidence' })).toMatchObject({ shock: 'investment-fall' })
    expect(read({ shock: 'households save more' })).toMatchObject({ shock: 'saving-rise' })
    expect(read({ shock: 'households save less' })).toMatchObject({ shock: 'saving-fall' })
    expect(read({ shock: 'overheating' })).toMatchObject({ shock: 'saving-fall' })
    expect(read({ task: 'trade-off' })).toMatchObject({ task: 'conflict', shock: 'oil' })
    expect(read({ task: 'Stagflation', lever: 'fiscal policy' })).toMatchObject({ task: 'conflict', shock: 'oil', lever: 'spending' })
    expect(read({ task: { kind: 'steer', shock: 'exportsFall', lever: 'bank rate' } })).toMatchObject({ task: 'steer', shock: 'exports-fall', lever: 'interest' })
    expect(read({})).toEqual({ task: 'steer', shock: 'investment-fall', lever: 'interest', aim: 'prices' })
  })

  it('returns null only for what cannot be read at all', () => {
    for (const raw of [null, undefined, 3, 'steer', { lever: 5 }, { shock: true }, { aim: 1 }, { task: 2 }]) expect(engine.parse(raw)).toBeNull()
  })

  it('parses what it cannot draw, and refuses it with an example that works', () => {
    const refuse = (raw: unknown) => engine.faults(engine.parse(raw)!)
    const lever = refuse({ shock: 'recession', lever: 'tariffs' })
    expect(lever).toHaveLength(1)
    expect(lever[0]).toContain('"tariffs"')
    expect(lever[0]).toContain('lever "interest"')
    expect(refuse({ lever: 'supply-side policy' })[0]).toContain('no "supply-side-policy" lever')
    expect(refuse({ lever: 'minimum wage' })[0]).toContain('no "minimum-wage" lever')
    const shock = refuse({ shock: 'alien invasion' })
    expect(shock[0]).toContain('"alien-invasion"')
    expect(shock[0]).toContain('shock "investment-fall"')
    const task = refuse({ task: 'ppf' })
    expect(task[0]).toContain('task "steer"')
    const mixed = refuse({ task: 'conflict', shock: 'exports-fall' })
    expect(mixed[0]).toContain('shock "oil"')
    const aim = refuse({ shock: 'oil', aim: 'happiness' })
    expect(aim[0]).toContain('aim "prices"')
  })

  it('still draws a config it refuses, so nothing can crash on it', () => {
    for (const raw of [{ lever: 'tariffs' }, { shock: 'alien invasion' }, { task: 'ppf' }, { shock: 'oil', aim: 'happiness' }]) {
      const c = engine.parse(raw)!
      expect(engine.faults(c).length).toBeGreaterThan(0)
      expect(() => renderToStaticMarkup(createElement(MacroBoardView, { config: c, state: engine.initial(c), setState: () => {}, marked: 'idle', reduced: true, locked: false }))).not.toThrow()
    }
  })
})

describe('what the prompt may say', () => {
  const good = (c: MacroConfig) => (c.task === 'steer'
    ? `Tap the minus or plus on ${LEVER_INFO[c.lever as keyof typeof LEVER_INFO].name} and watch the water settle. Bring it back to the full-capacity mark.`
    : c.aim === 'prices'
      ? `Tap the minus or plus on ${LEVER_INFO[c.lever as keyof typeof LEVER_INFO].name} and watch the water settle. Bring it to the prices-steady mark, and see what happens to the workers.`
      : `Tap the minus or plus on ${LEVER_INFO[c.lever as keyof typeof LEVER_INFO].name} and watch the water settle. Bring it to the full-capacity mark, and see what happens to the price tags.`)

  it('passes the examples in its own catalogue entry', () => {
    const found = [...engine.prompt.matchAll(/"prompt":"([^"]*)",\s*"payload": \{ "engine":"macro-board", "config": (\{[^}]*\})/g)]
    expect(found.length).toBe(3)
    for (const f of found) {
      const c = engine.parse(JSON.parse(f[2]))!
      expect(engine.faults(c)).toEqual([])
      expect(engine.promptFaults!(c, f[1])).toEqual([])
    }
  })

  it('names the isolates it is registered with, and the catalogue format', () => {
    expect(engine.prompt).toContain('SCENE "macro-board"')
    const said = [...engine.prompt.matchAll(/"isolates":"(\w+)"/g)].map((m) => m[1])
    expect(said.length).toBe(3)
    for (const s of said) expect(s).toBe(engine.isolates)
    expect(engine.prompt).toContain('"apparatus":"scene:macro-board"')
    expect(engine.prompt).toContain('"success": { "kind":"scene" }')
  })

  it('passes a prompt that says the gesture and the mark, for every config', () => {
    for (const c of ALL) expect(engine.promptFaults!(c, good(c))).toEqual([])
  })

  it('offers a fix that itself passes, whatever it refuses', () => {
    const asks = ['Cut the interest rate to bring it back.', 'Raise taxes to bring it back.', 'Raise government spending to get there.', 'Let the currency depreciate to get there.', 'Use two clicks.', 'Drag the slider.', 'It is a trade-off.']
    for (const c of ALL) for (const ask of asks) {
      for (const fault of engine.promptFaults!(c, ask)) {
        const example = fault.match(/"([^"]+)"\)$/)?.[1]
        expect(example, fault).toBeTruthy()
        expect(engine.promptFaults!(c, example!)).toEqual([])
      }
    }
  })

  it('refuses a prompt that says which way to move the lever', () => {
    const faultsOf = (lever: string, text: string) => engine.promptFaults!(steer('investment-fall', lever), text)
    for (const text of ['Cut the interest rate until the water is back.', 'Lower interest rates to help.', 'Interest rates need to go down.', 'Lowering the rates will help.']) expect(faultsOf('interest', text).length, text).toBe(1)
    for (const text of ['Cut taxes until the water is back.', 'Reduce income tax to help.']) expect(faultsOf('tax', text).length, text).toBe(1)
    for (const text of ['Raise government spending until the water is back.', 'Increase public spending.', 'The government spends more.']) expect(faultsOf('spending', text).length, text).toBe(1)
    for (const text of ['Let the currency depreciate.', 'A weaker currency will help.', 'Lower the exchange rate.', 'Devalue it.']) expect(faultsOf('exchange', text).length, text).toBe(1)
    expect(faultsOf('interest', 'Use expansionary policy.').length).toBe(1)
  })

  it('refuses a prompt that says how far', () => {
    const c = steer('investment-fall', 'interest')
    expect(engine.promptFaults!(c, 'Set the interest rate to 3%.').length).toBeGreaterThan(0)
    expect(engine.promptFaults!(c, 'It takes two clicks.').length).toBeGreaterThan(0)
    expect(engine.promptFaults!(c, 'It takes 2 steps.').length).toBeGreaterThan(0)
  })

  it('leaves alone what is not the answer: the event, the mark, and another lever', () => {
    const c = steer('investment-fall', 'interest')
    expect(engine.promptFaults!(c, 'Firms have stopped investing. Tap the minus or plus and bring the water back to the full-capacity mark.')).toEqual([])
    expect(engine.promptFaults!(c, 'People have cut their spending. Use the interest rate lever to bring the water to the mark.')).toEqual([])
    // Spending words are no giveaway on an interest-rate card.
    expect(engine.promptFaults!(c, 'Consumer spending is falling. Bring the water to the mark.')).toEqual([])
    expect(engine.promptFaults!(steer('investment-rise', 'interest'), 'Inflation should come back to 2%. Bring the water to the full-capacity mark.')).toEqual([])
  })

  it('refuses a prompt that tells a conflict before it is found', () => {
    const c = conflict('oil', 'interest', 'prices')
    for (const text of ['This is a trade-off.', 'You cannot have both.', 'It will cost jobs.', 'Bring prices down at the expense of work.', 'See the conflict.']) expect(engine.promptFaults!(c, text).length, text).toBeGreaterThan(0)
    // The same word is fine when there is no conflict to give away.
    expect(engine.promptFaults!(steer('investment-fall', 'interest'), 'There is no trade-off here. Tap the minus or plus.')).toEqual([])
  })

  it('refuses the multiplier’s size, and a promise the card cannot keep', () => {
    const c = steer('investment-fall', 'spending')
    expect(engine.promptFaults!(c, 'The multiplier is 2.5.').length).toBeGreaterThan(0)
    for (const text of ['Drag the slider.', 'Read the AD/AS graph.', 'Turn the dial.', 'Watch the budget deficit.', 'See the current account.']) expect(engine.promptFaults!(c, text).length, text).toBeGreaterThan(0)
    // Naming the multiplier is fine.
    expect(engine.promptFaults!(c, 'Tap the minus or plus on Government spending and watch how far the multiplier carries the water.')).toEqual([])
  })
})

describe('the stations it is offered for', () => {
  const offered = (st: string) => sceneCatalogue(st).includes('SCENE "macro-board"')
  const madeFor = (st: string) => scenesFor(st).some((e) => e.id === 'macro-board')

  it('is offered for the stations it is made for, by the names the books use', () => {
    for (const st of [
      'Unit 4: Government and the macroeconomy', 'Macroeconomics', 'Monetary policy: how the central bank uses interest rates', 'Chapter 22: Fiscal policy and the budget',
      'Chapter 23: What is monetary policy?', 'Inflation: demand-pull and cost-push', 'Unemployment', 'Chapter 16: The circular flow of income', 'Chapter 17: Aggregate demand',
      'Chapter 9: External economic influences on business activity', 'Exchange rates and the economy', 'National income', 'Chapter 21: Price stability', 'The multiplier effect',
      'Recession and recovery', 'Injections and leakages', 'Government spending and taxation', 'Conflicts between macroeconomic aims', 'Stagflation', 'The business cycle',
    ]) {
      expect(offered(st), st).toBe(true)
      expect(madeFor(st), st).toBe(true)
    }
  })

  it('is kept from the near misses', () => {
    for (const st of [
      // Same words, other subjects.
      'Inflammation and the immune system', 'Recessive alleles', 'Macromolecules: proteins and fats', 'Macronutrients in a balanced diet', 'Gas exchange in the lungs', 'Ion exchange', 'Cultural exchange',
      'Cliff recession and coastal erosion', 'Flood hydrographs: the recession limb', 'Glacial recession', 'Cosmic inflation', 'Tyre inflation', 'Weimar Germany: inflation and the Ruhr',
      'Circular flow of blood', 'Circular flow of water in the ocean', 'Fiscal year accounts', 'Simple machines', 'Employment law',
      // Maths and money that is not macroeconomics.
      'Compound interest: the interest rate per year', 'Simple interest and interest rates', 'Percentage multipliers', 'Using a multiplier to increase by a percentage', 'Converting currency using exchange rates', 'Exchange rates and conversion',
      'Calculating income tax', 'Savings accounts and interest rates',
      // Economics this card does not draw.
      'Production possibility curve', 'The basic economic problem', 'Opportunity cost and scarcity', 'Measuring inflation: the consumer price index', 'Types of unemployment: frictional, structural and seasonal',
      'Measuring national income: the output, income and expenditure methods', 'Aggregate demand and aggregate supply', 'Money and banking', 'Supply and demand', 'Indirect taxes and subsidies', 'Break-even analysis', 'Determination of exchange rates',
      'Floating exchange rates', 'International trade', 'The multiplier effect of tourism', 'Government spending on healthcare',
    ]) {
      expect(offered(st), st).toBe(false)
      expect(madeFor(st), st).toBe(false)
    }
  })
})

describe('the view', () => {
  const raw = (c: MacroConfig, state: MacroState, marked: 'idle' | 'right' | 'wrong' | 'shown' = 'idle', reduced = true, locked = false) =>
    renderToStaticMarkup(createElement(MacroBoardView, { config: c, state, setState: () => {}, marked, reduced, locked }))
  const node = (c: MacroConfig, prompt = 'Tap the minus or plus and bring the water to the mark.') =>
    renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'macro-board', config: c }, success: { kind: 'scene' } } },
    } as never)))
  const text = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')
  const attrs = (html: string) => [...html.matchAll(/aria-[a-z]+="([^"]*)"/g)].map((m) => m[1]).join(' ')

  it('holds back every verdict before marking, in the text and the ARIA', () => {
    for (const c of ALL) {
      const html = node(c)
      for (const seen of [text(html), attrs(html)]) {
        expect(seen, name(c)).not.toMatch(/\bYes\b|You cut|You raised|You lowered|the multiplier|cannot reach both|must choose|\bsettled\b|\bexpansionary\b|\bcontractionary\b/i)
      }
    }
  })

  it('never prints where the lever has to go before marking', () => {
    for (const c of ALL) {
      const solved = LEVER_INFO[c.lever as keyof typeof LEVER_INFO].value(engine.solve(c).step)
      const html = raw(c, engine.initial(c))
      // The lever shows where it stands, and the labels say nothing of where it is going.
      expect(html, name(c)).toContain(`data-lever="0">${LEVER_INFO[c.lever as keyof typeof LEVER_INFO].value(0)}<`)
      expect(attrs(html), name(c)).not.toContain(solved)
    }
  })

  it('offers the lever both ways with real buttons, in the same words on every card', () => {
    for (const c of ALL) {
      const html = raw(c, engine.initial(c))
      const info = LEVER_INFO[c.lever as keyof typeof LEVER_INFO]
      expect(html).toContain(`aria-label="${info.less}"`)
      expect(html).toContain(`aria-label="${info.more}"`)
      expect(html.match(/<button/g)?.length).toBe(2)
      expect(html).toContain('type="button"')
    }
  })

  it('locks the buttons once solved, and at the end of the lever’s travel', () => {
    const c = steer('investment-fall', 'interest')
    const locked = raw(c, engine.solve(c), 'right', true, true)
    expect(locked.match(/<button[^>]*\sdisabled=""/g)?.length).toBe(2)
    expect(raw(c, { step: 0 }).match(/<button[^>]*\sdisabled=""/g)).toBeNull()
    expect(raw(c, { step: stepRange(c).max }).match(/<button[^>]*\sdisabled=""/g)?.length).toBe(1)
  })

  it('says what was made once marked, and shows the answer when asked', () => {
    const c = steer('investment-fall', 'interest')
    expect(text(raw(c, engine.solve(c), 'right'))).toContain('Yes. Back at full capacity.')
    expect(text(raw(c, { step: 1 }, 'wrong'))).toContain('The water settled below full capacity')
    const shown = raw(c, { step: 1 }, 'shown')
    expect(text(shown)).toContain('Yes. Back at full capacity.')
    expect(shown).toContain(`data-lever="${engine.solve(c).step}"`)
  })

  it('changes the still frame with each move, under reduced motion', () => {
    for (const c of ALL) {
      const before = raw(c, { step: 0 }, 'idle', true)
      const k = stepRange(c).max > 0 ? 1 : -1
      const after = raw(c, { step: k }, 'idle', true)
      expect(after, name(c)).not.toBe(before)
      const water = (h: string) => h.match(/data-water="([^"]+)"/)![1]
      expect(Number(water(after)), name(c)).not.toBe(Number(water(before)))
      expect(after.match(/data-wheel="([^"]+)"/g)!.join(), name(c)).not.toBe(before.match(/data-wheel="([^"]+)"/g)!.join())
      // Nothing animates.
      expect(after).not.toMatch(/style="[^"]*transition/)
    }
  })

  it('colours the valves the lever turns, and only those', () => {
    const count = (lever: string) => raw(steer('investment-fall', lever), { step: 0 }).match(/data-valve="driven"/g)?.length
    expect(count('interest')).toBe(2)
    expect(count('tax')).toBe(1)
    expect(count('spending')).toBe(1)
    expect(count('exchange')).toBe(2)
  })

  it('draws the workers and tags as they are counted', () => {
    const c = steer('investment-fall', 'interest')
    const k = 0
    const html = raw(c, { step: k })
    const level = levelAt(c, k)
    expect(html.match(/data-worker="out"/g)?.length ?? 0).toBe(workersOut(level))
    expect(html.match(/data-tag="lit"/g)?.length ?? 0).toBe(tagsLit(c, level))
    expect(html.match(/data-worker=/g)?.length).toBe(WORKER_RUNGS.length)
    expect(html.match(/data-tag=/g)?.length).toBe(5)
  })

  it('draws one mark for a steer, and two with the asked one bolder for a conflict', () => {
    expect(raw(steer('investment-fall', 'tax'), { step: 0 }).match(/data-mark=/g)?.length).toBe(1)
    const prices = raw(conflict('oil', 'tax', 'prices'), { step: 0 })
    expect(prices.match(/data-mark=/g)?.length).toBe(2)
    expect(prices).toContain(`data-mark="${COST_MARK}" data-target="1"`)
    expect(prices).toContain(`data-mark="${FULL_CAPACITY}" data-target="0"`)
    expect(raw(conflict('oil', 'tax', 'jobs'), { step: 0 })).toContain(`data-mark="${FULL_CAPACITY}" data-target="1"`)
  })
})

describe('the drawing keeps its parts apart', () => {
  const overlap = (a: { left: number; right: number; top: number; bottom: number }, b: { left: number; right: number; top: number; bottom: number }) =>
    a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom

  it('agrees with the numbers in config, which it writes out because the two import each other', () => {
    expect(yOf(MIN_LEVEL)).toBeLessThan(TANK_B)
    expect(yOf(MAX_LEVEL)).toBeGreaterThan(TANK_T)
    expect(yOf(50)).toBe(TANK_B)
    expect(FULL_CAPACITY).toBe(100)
    expect(BAND).toBe(5)
    expect(W).toBe(360)
    expect(H).toBeLessThanOrEqual(300)
  })

  it('leaves room in the water for its name, even at the lowest level', () => {
    // The words sit 7 px over the floor and stand about 9 px tall.
    expect(TANK_B - yOf(MIN_LEVEL)).toBeGreaterThanOrEqual(16)
  })

  it('keeps every word inside the plate, and clear of every other', () => {
    for (const c of ALL) {
      const boxes = labelBoxes(c)
      for (const b of boxes) {
        expect(b.left, b.text).toBeGreaterThanOrEqual(2)
        expect(b.right, b.text).toBeLessThanOrEqual(W - 2)
        expect(b.top, b.text).toBeGreaterThanOrEqual(2)
        expect(b.bottom, b.text).toBeLessThanOrEqual(H - 2)
      }
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        expect(overlap(boxes[i], boxes[j]), `${boxes[i].text} on ${boxes[j].text}`).toBe(false)
      }
    }
  })

  it('keeps every word off the tank', () => {
    const tank = { left: TANK_L - 6, right: TANK_R + 6, top: TANK_T - 2, bottom: TANK_B + 2 }
    for (const c of ALL) for (const b of labelBoxes(c)) expect(overlap(b, tank), b.text).toBe(false)
  })

  it('puts the workers and tags in rows that do not touch', () => {
    const pitch = yOf(0) - yOf(10)
    expect(pitch).toBeGreaterThanOrEqual(15)
    expect(WORKER_X + 7).toBeLessThan(TANK_L)
    expect(TAG_X - 12).toBeGreaterThan(TANK_R)
    expect(WORKER_RUNGS.every((rung) => yOf(rung) > yOf(FULL_CAPACITY))).toBe(true)
  })

  it('runs the marks between the tags, never through one', () => {
    const halfTag = 7
    for (const c of ALL) for (const rung of tagRungs(c)) {
      for (const mark of [FULL_CAPACITY, priceMark(c)]) expect(Math.abs(yOf(rung) - yOf(mark)), `${name(c)} tag ${rung} mark ${mark}`).toBeGreaterThanOrEqual(halfTag)
    }
    expect(Object.keys(SHOCK_INFO).length).toBe(DEMAND_SHOCKS.length + COST_SHOCKS.length)
  })

  it('pairs the columns: the two valves of a lever, or the pair of a sector, stand one above the other', () => {
    expect(COLUMNS.investment).toBe(COLUMNS.saving)
    expect(COLUMNS.government).toBe(COLUMNS.tax)
    expect(COLUMNS.exports).toBe(COLUMNS.imports)
    expect(TOP_LABEL_Y).toBeLessThan(TANK_T)
    expect(BOTTOM_LABEL_Y).toBeGreaterThan(TANK_B)
  })
})
