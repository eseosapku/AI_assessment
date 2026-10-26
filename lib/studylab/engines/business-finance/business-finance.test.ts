// lib/studylab/engines/business-finance/business-finance.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
// The engine first: it registers itself, and its view comes with it.
import {
  businessFinanceEngine as engine, atOutput, breakEven, chartFor, contribution, count, leverRange, leverStart,
  madeLever, madeMargin, money, moneyAxis, needed, neededContribution, outputAxis, promptFaults, readCount,
  totalCosts, totalRevenue, MAX_COLS, MAX_MONEY, MIN_COLS,
  type BusinessFinanceConfig, type BusinessFinanceState,
} from './config'
import { BusinessFinanceView, geometry, segment } from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import type { SceneMarked } from '../types'
import { meaningFaults } from '../../meaning'
import { validateSpec } from '../../activities/validate'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

/**
 * Break-even, computed exactly: the tutor names a price, a variable cost per
 * unit and the fixed costs; the engine draws the chart with break-even on a
 * gridline, and marks the marker, the margin of safety, or the price.
 */

const read = (raw: unknown): BusinessFinanceConfig => {
  const c = engine.parse(raw)
  if (!c) throw new Error(`did not parse: ${JSON.stringify(raw)}`)
  return c
}
const find = (price: number, variableCost: number, fixedCosts: number) => read({ task: { kind: 'find-break-even', price, variableCost, fixedCosts } })
const margin = (price: number, variableCost: number, fixedCosts: number, plannedOutput?: number) =>
  read({ task: { kind: 'margin-of-safety', price, variableCost, fixedCosts, plannedOutput } })
const reach = (price: number, variableCost: number, fixedCosts: number, targetOutput: number, change = 'price') =>
  read({ task: { kind: 'reach-break-even', price, variableCost, fixedCosts, targetOutput, change } })

/** Every fault is a sentence a writer can act on: it says what to do. */
const ACTIONABLE = /\b(choose|set|use|give|plan|keep|start)\b/i

describe('break-even as the engine works it out', () => {
  it('finds costs, revenue and break-even exactly', () => {
    const e = { price: 10, variableCost: 6, fixedCosts: 200 }
    expect(totalCosts(e, 40)).toBe(440)
    expect(totalRevenue(e, 40)).toBe(400)
    expect(contribution(e)).toBe(4)
    expect(breakEven(e)).toBe(50)
    expect(breakEven({ price: 25, variableCost: 15, fixedCosts: 4000 })).toBe(400)
    // Not whole, never, and not at all.
    expect(breakEven({ price: 10, variableCost: 7, fixedCosts: 500 })).toBeNull()
    expect(breakEven({ price: 6, variableCost: 6, fixedCosts: 500 })).toBeNull()
    expect(breakEven({ price: 5, variableCost: 6, fixedCosts: 500 })).toBeNull()
    expect(breakEven({ price: 10, variableCost: 6, fixedCosts: 0 })).toBeNull()
    expect(breakEven({ price: 10.5, variableCost: 6.5, fixedCosts: 200 })).toBeNull()
  })

  it('puts break-even on a gridline, at least three from 0, with room after it', () => {
    expect(outputAxis(50)).toEqual({ step: 10, cols: 8, max: 80 })
    expect(outputAxis(400)).toEqual({ step: 100, cols: 8, max: 800 })
    expect(outputAxis(45)).toEqual({ step: 5, cols: 14, max: 70 })
    expect(outputAxis(400, [650])).toEqual({ step: 50, cols: 14, max: 700 })
    expect(outputAxis(2)).toBeNull()
    expect(outputAxis(37)).toBeNull()
    expect(outputAxis(400, [10000])).toBeNull()
  })

  it('scales money in at most eight round steps', () => {
    expect(moneyAxis(800)).toEqual({ step: 100, rows: 8, max: 800 })
    expect(moneyAxis(20000)).toEqual({ step: 2500, rows: 8, max: 20000 })
    expect(moneyAxis(9600)).toEqual({ step: 2000, rows: 5, max: 10000 })
  })

  it('cuts a line where it leaves the top of the chart', () => {
    const g = geometry({ x: { step: 10, cols: 8, max: 80 }, y: { step: 100, rows: 8, max: 800 } })
    expect(segment(g, 0, 10)?.cut).toBe(false)
    const steep = segment(g, 0, 20)!
    expect(steep.cut).toBe(true)
    expect(steep.x2).toBeCloseTo(g.x(40))
    expect(steep.y2).toBeCloseTo(g.y(800))
    expect(segment(g, 900, 0)).toBeNull()
  })

  it('writes money and counts as a school does, and reads the counts a learner types', () => {
    expect(count(1200)).toBe('1,200')
    expect(count(40)).toBe('40')
    expect(money(1000000)).toBe('$1,000,000')
    expect(readCount('200')).toBe(200)
    expect(readCount(' 2,000 units ')).toBe(2000)
    expect(readCount('1 unit')).toBe(1)
    expect(readCount('-200')).toBeNull()
    expect(readCount('200.5')).toBeNull()
    expect(readCount('2,00')).toBeNull()
    expect(readCount('two hundred')).toBeNull()
    expect(readCount('')).toBeNull()
  })

  it('works out the price or variable cost that breaks even at a target', () => {
    const p = reach(9, 7, 2000, 400).task
    expect(neededContribution(p)).toBe(5)
    expect(needed(p)).toBe(12)
    const v = reach(12, 9, 2000, 400, 'variable-cost').task
    expect(needed(v)).toBe(7)
    expect(neededContribution(reach(9, 7, 1000, 300).task)).toBeNull()
  })
})

describe('reading a config', () => {
  it('reads the documented configs', () => {
    expect(engine.parse({ task: { kind: 'find-break-even', price: 25, variableCost: 15, fixedCosts: 4000 } }))
      .toEqual({ task: { kind: 'find-break-even', price: 25, variableCost: 15, fixedCosts: 4000 } })
    expect(engine.parse({ task: { kind: 'margin-of-safety', price: 5, variableCost: 3, fixedCosts: 800, plannedOutput: 600 } }))
      .toEqual({ task: { kind: 'margin-of-safety', price: 5, variableCost: 3, fixedCosts: 800, plannedOutput: 600 } })
    expect(engine.parse({ task: { kind: 'reach-break-even', price: 9, variableCost: 7, fixedCosts: 2000, targetOutput: 400, change: 'price' } }))
      .toEqual({ task: { kind: 'reach-break-even', price: 9, variableCost: 7, fixedCosts: 2000, targetOutput: 400, change: 'price' } })
  })

  it('reads reasonable phrasings of the task, the amounts and the lever', () => {
    expect(read({ task: { kind: 'Find the break-even point', sellingPrice: '$25', variable_cost: '15 per unit', fixed_costs: '$4,000' } }).task)
      .toEqual({ kind: 'find-break-even', price: 25, variableCost: 15, fixedCosts: 4000 })
    expect(read({ task: { kind: 'findBreakEven', price: 10, vc: 6, fc: 200 } }).task.kind).toBe('find-break-even')
    expect(read({ task: { kind: 'breakeven', price: 10, variableCost: 6, fixedCosts: 200 } }).task.kind).toBe('find-break-even')
    expect(read({ task: { kind: 'Margin of safety', price: 5, variableCost: 3, fixedCosts: 800, planned: '600 units' } }).task.plannedOutput).toBe(600)
    expect(read({ task: { kind: 'reach_break_even', price: 9, variableCost: 7, fixedCosts: 2000, target: 400 } }).task.change).toBe('price')
    expect(read({ task: { kind: 'reach-break-even', price: 12, variableCost: 9, fixedCosts: 2000, targetOutput: 400, change: 'Variable cost per unit' } }).task.change).toBe('variable-cost')
    // The amounts may sit beside the task.
    expect(read({ price: 10, variableCost: 6, fixedCosts: 200, task: { kind: 'find-break-even' } }).task.fixedCosts).toBe(200)
    // A margin task's planned output is kept; a find task's stray fields are not.
    expect(read({ task: { kind: 'find-break-even', price: 10, variableCost: 6, fixedCosts: 200, plannedOutput: 70 } }).task).not.toHaveProperty('plannedOutput')
  })

  it('reads nothing it cannot honestly draw', () => {
    expect(engine.parse(null)).toBeNull()
    expect(engine.parse({})).toBeNull()
    expect(engine.parse({ task: { kind: 'cash-flow', price: 10, variableCost: 6, fixedCosts: 200 } })).toBeNull()
    expect(engine.parse({ task: { kind: 'find-break-even', price: 10, variableCost: 6 } })).toBeNull()
    expect(engine.parse({ task: { kind: 'find-break-even', price: -10, variableCost: 6, fixedCosts: 200 } })).toBeNull()
    expect(engine.parse({ task: { kind: 'find-break-even', price: 'ten', variableCost: 6, fixedCosts: 200 } })).toBeNull()
    expect(engine.parse({ task: { kind: 'find-break-even', price: Infinity, variableCost: 6, fixedCosts: 200 } })).toBeNull()
    expect(engine.parse({ task: { kind: 'margin-of-safety', price: 5, variableCost: 3, fixedCosts: 800, plannedOutput: 'lots' } })).toBeNull()
    expect(engine.parse({ task: { kind: 'reach-break-even', price: 9, variableCost: 7, fixedCosts: 2000, targetOutput: 400, change: 'fixed costs' } })).toBeNull()
  })
})

describe('what the engine refuses, in words a writer can act on', () => {
  const said = (c: BusinessFinanceConfig) => engine.faults(c).join('\n')

  it('finds nothing wrong with the catalogue’s own configs', () => {
    const configs = [...engine.prompt.matchAll(/\{ "task": \{[^}]*\} \}/g)].map((m) => JSON.parse(m[0]))
    expect(configs.length).toBeGreaterThanOrEqual(6)
    for (const c of configs) expect(engine.faults(read(c)), JSON.stringify(c)).toEqual([])
  })

  it('refuses a business that never breaks even, or has nothing to break even on', () => {
    expect(said(find(6, 6, 200))).toMatch(/price \(\$6\) is not above the variable cost per unit \(\$6\).*never breaks even: set the price above/)
    expect(said(find(5, 6, 200))).toMatch(/never breaks even/)
    expect(said(find(10, 6, 0))).toMatch(/no fixed costs.*give it fixed costs/)
  })

  it('refuses break-even that is not a whole number of units, and suggests numbers that are', () => {
    const f = said(find(10, 7, 500))
    expect(f).toMatch(/\$500 ÷ \(\$10 − \$7\) per unit is 166.67 units, not a whole number/)
    const fixed = Number(/such as fixed costs of \$([\d,]+)/.exec(f)![1].replace(/,/g, ''))
    expect(engine.faults(find(10, 7, fixed))).toEqual([])
  })

  it('refuses break-even no gridline of the chart can show, and suggests one that can', () => {
    const f = said(find(10, 9, 37))
    expect(f).toMatch(/Break-even at 37 units cannot be read off a chart/)
    const fixed = Number(/such as fixed costs of \$([\d,]+)/.exec(f)![1].replace(/,/g, ''))
    expect(engine.faults(find(10, 9, fixed))).toEqual([])
    expect(said(find(10, 5, 10))).toMatch(/2 units cannot be read off a chart.*too close to 0/)
  })

  it('refuses amounts that are not whole, and charts too large to read', () => {
    expect(said(find(2.5, 1, 300))).toMatch(/whole dollars.*the price \(2.5\) is not whole/)
    expect(said(find(1000, 500, 4_000_000))).toMatch(/money axis would run to .*keep the numbers small/)
  })

  it('margin-of-safety: refuses a missing or unreadable plan, and suggests one', () => {
    expect(said(margin(5, 3, 800))).toMatch(/needs a plannedOutput.*such as 600 units/)
    expect(said(margin(5, 3, 800, 400))).toMatch(/planned output \(400 units\) is not above break-even.*plan an output above/)
    expect(said(margin(5, 3, 800, 350))).toMatch(/not above break-even/)
    expect(said(margin(5, 3, 800, 610))).toMatch(/cannot both fall on gridlines.*multiple of 100 units.*such as 600 units/)
    expect(said(margin(5, 3, 800, 9000))).toMatch(/cannot both fall on gridlines/)
  })

  it('reach-break-even: refuses a target no whole-dollar price reaches, one already reached, one out of reach', () => {
    expect(said(read({ task: { kind: 'reach-break-even', price: 9, variableCost: 7, fixedCosts: 2000 } }))).toMatch(/needs a targetOutput/)
    const odd = said(reach(9, 7, 1000, 300))
    expect(odd).toMatch(/No whole-dollar price makes the business break even at exactly 300 units.*such as 250 units/)
    expect(engine.faults(reach(9, 7, 1000, 250))).toEqual([])
    expect(said(reach(12, 7, 2000, 400))).toMatch(/already breaks even at 400 units.*start from a different price/)
    expect(said(reach(40, 30, 2000, 40, 'variable-cost'))).toMatch(/must contribute \$50, but the price is only \$40.*choose a larger target/)
    expect(said(reach(9, 7, 2000, 2))).toMatch(/too close to 0/)
    expect(said(reach(400, 7, 200000, 400))).toMatch(/too many to set by hand/)
  })

  it('is refused by the meaning gates when it would teach nothing, and passes them when sound', () => {
    const action = (config: unknown, prompt = 'Drag the marker along the output axis to where the business breaks even.') =>
      ({ type: 'createActivity', id: 'b1', spec: { pattern: 'scene', prompt, payload: { engine: 'business-finance', config }, success: { kind: 'scene' } } })
    const ok = { task: { kind: 'find-break-even', price: 25, variableCost: 15, fixedCosts: 4000 } }
    expect(meaningFaults(action(ok))).toEqual([])
    expect(validateSpec(action(ok).spec)).toBe(true)
    expect(meaningFaults(action({ task: { kind: 'find-break-even', price: 6, variableCost: 6, fixedCosts: 200 } })).join('\n')).toMatch(/never breaks even/)
    expect(meaningFaults(action(ok, 'The business breaks even at 400 units: drag the marker there.')).join('\n')).toMatch(/gives the break-even output away/)
  })
})

describe('the prompt a business-finance card is written with', () => {
  const f = find(25, 15, 4000)
  const m = margin(5, 3, 800, 600)
  const r = reach(9, 7, 2000, 400)

  it('may give the price, costs and planned or target output, and ask', () => {
    expect(promptFaults(f, 'A business sells each item for $25. Each costs $15 to make, and its fixed costs are $4,000. Drag the marker to where it breaks even.')).toEqual([])
    expect(promptFaults(m, 'The business plans to make 600 units. What is its margin of safety?')).toEqual([])
    expect(promptFaults(r, 'The price is $9. Change it until the business breaks even at 400 units.')).toEqual([])
  })

  it('may not state the break-even output, the margin of safety or the contribution', () => {
    expect(promptFaults(f, 'Break-even is 400 units. Drag the marker there.').join('\n')).toMatch(/gives the break-even output away/)
    expect(promptFaults(f, 'It breaks even at 400 -- check it on the chart.').join('\n')).toMatch(/gives the break-even output away/)
    expect(promptFaults(f, 'Find the output where 400 units of sales cover the costs.').join('\n')).toMatch(/gives the break-even output away/)
    expect(promptFaults(f, 'Each unit makes $10 towards fixed costs. Find break-even.').join('\n')).toMatch(/gives the contribution away/)
    expect(promptFaults(f, 'The contribution per unit is 10. Find break-even.').join('\n')).toMatch(/gives the contribution away/)
    expect(promptFaults(m, 'Break-even is at 400 units and the plan is 600. Find the margin of safety.').join('\n')).toMatch(/break-even output away/)
    expect(promptFaults(m, 'The plan is 600 units, so the margin of safety is 200 units. Check it.').join('\n')).toMatch(/margin of safety away/)
  })

  it('may not state the price, cost or contribution that reaches the target', () => {
    expect(promptFaults(r, 'Raise the price to $12 so the business breaks even at 400 units.').join('\n')).toMatch(/states \$12, the price/)
    expect(promptFaults(r, 'Each unit must contribute $5 to break even at 400 units. Set the price.').join('\n')).toMatch(/states \$5 per unit, the contribution needed/)
    const v = reach(12, 9, 2000, 400, 'variable-cost')
    expect(promptFaults(v, 'Cut the variable cost to $7 per unit.').join('\n')).toMatch(/the variable cost that makes/)
  })

  it('passes the examples in its own catalogue entry', () => {
    const e = getEngine('business-finance')!
    const found = [...e.prompt.matchAll(/"prompt":"([^"]+)"[\s\S]*?"config": (\{[\s\S]*?\} \}) \}/g)]
    expect(found.length).toBe(3)
    for (const ex of found) expect(e.promptFaults!(e.parse(JSON.parse(ex[2]))!, ex[1]), ex[1]).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Every config: enumerated over small numbers, and random over large ones.

const FIXED = [10, 12, 20, 24, 30, 36, 40, 45, 50, 60, 72, 80, 90, 100, 120, 150, 180, 200, 240, 250, 300, 360, 400, 450, 500, 600, 700, 750,
  800, 900, 1000, 1200, 1500, 1800, 2000, 2400, 2500, 3000, 3600, 4000, 4500, 5000, 6000, 7500, 8000, 10000, 12000, 15000, 20000]

/** The numbers a view may show before marking: the ones it was given, and the learner's own. */
function shownNumbers(html: string): number[] {
  const withoutTicks = html.replace(/<text[^>]*data-tick[^>]*>[^<]*<\/text>/g, '')
  const spoken = [...withoutTicks.matchAll(/aria-(?:label|valuetext)="([^"]*)"/g)].map((m) => m[1])
  const text = [withoutTicks.replace(/<[^>]+>/g, ' '), ...spoken].join(' ')
  return [...text.matchAll(/\d{1,3}(?:,\d{3})+|\d+/g)].map((m) => Number(m[0].replace(/,/g, '')))
}
const view = (config: BusinessFinanceConfig, state: BusinessFinanceState, marked: SceneMarked = 'idle') =>
  renderToStaticMarkup(createElement(BusinessFinanceView, { config, state, setState: () => {}, marked, reduced: false, locked: marked === 'right' }))

/**
 * A plain check for the property tests' inner loops: they run over a million
 * times, and vitest's `expect` is too slow for that. It throws with the config.
 */
function need(ok: boolean, why: string): void {
  if (!ok) throw new Error(why)
}

/** What every valid config must do, worked out independently of the engine's own sums where it can be. */
function holds(c: BusinessFinanceConfig) {
  const t = c.task
  const label = JSON.stringify(t)
  const start = engine.initial(c)
  const solved = engine.solve(c)
  need(!engine.check(c, start).ok, `${label} starts solved`)
  need(engine.check(c, solved).ok, `${label} cannot be solved`)
  const chart = chartFor(t)
  need(chart !== null, `${label} has no chart`)
  const { x, y } = chart!
  need(x.cols >= MIN_COLS && x.cols <= MAX_COLS, `${label} has ${x.cols} columns`)
  need(y.max <= MAX_MONEY && y.rows <= 8, `${label} has a money axis to ${y.max} in ${y.rows} rows`)

  if (t.kind === 'reach-break-even') {
    const n = needed(t)!
    const target = t.targetOutput!
    // At the needed value, revenue and costs at the target agree -- in floating point, separately.
    const e = t.change === 'variable-cost' ? { ...t, variableCost: n } : { ...t, price: n }
    need(Math.abs(e.price * target - (e.fixedCosts + e.variableCost * target)) < 1e-9, `${label}: ${n} does not break even at the target`)
    need(target % x.step === 0 && target / x.step >= 3 && target < x.max, `${label}: the target is not on a gridline inside the chart`)
    // The crossing at the answer is on the chart.
    need((t.change === 'variable-cost' ? t.price : n) * target <= y.max, `${label}: the answer's crossing is off the chart`)
    const { lo, hi } = leverRange(t)
    need(hi - lo <= 240, `${label}: the control has ${hi - lo} steps`)
    // Neither end of the control is the answer, and the start is inside it.
    need(lo < n && n < hi, `${label}: the control runs ${lo} to ${hi}, the answer is ${n}`)
    need(leverStart(t) >= lo && leverStart(t) <= hi, `${label}: the start is outside the control`)
    for (let v = lo; v <= hi; v++) need(engine.check(c, { value: v }).ok === (v === n), `${label} at ${v}`)
    // Said back at the start: the learner's own value, never one the engine worked out.
    need(madeLever(t, start.value!).startsWith(`With a ${t.change === 'variable-cost' ? 'variable cost' : 'price'} of ${money(start.value!)}`), `${label}: ${madeLever(t, start.value!)}`)
    return
  }

  const be = breakEven(t)!
  // Break-even, worked out in floating point: a whole number of units.
  need(t.fixedCosts / (t.price - t.variableCost) === be, `${label}: break-even is not ${be}`)
  need(be % x.step === 0 && be / x.step >= 3 && be < x.max, `${label}: break-even is not on a gridline inside the chart`)
  need(totalRevenue(t, be) <= y.max, `${label}: the crossing is above the chart`)
  if (t.kind === 'find-break-even') {
    // Every gridline the marker can stop on: right only at break-even, and said as a loss before it and a profit after.
    for (let q = 0; q <= x.max; q += x.step) {
      need(engine.check(c, { at: q }).ok === (q === be), `${label} at ${q}`)
      if (q !== be) need((q < be ? /still a loss of/ : /already a profit of/).test(atOutput(t, q)), `${label} at ${q}: ${atOutput(t, q)}`)
    }
  } else {
    const planned = t.plannedOutput!
    need(planned % x.step === 0 && planned > be && planned < x.max, `${label}: the plan is not on a gridline past break-even`)
    for (let n = 0; n <= planned + x.step; n += Math.max(1, Math.floor(x.step / 2))) {
      need(engine.check(c, { at: 0, answer: String(n) }).ok === (n === planned - be), `${label} typed ${n}`)
    }
  }
}

/** Before marking, every number the view shows or says is one it was given, or the learner's own. */
function hidesTheAnswer(c: BusinessFinanceConfig) {
  const t = c.task
  const html = view(c, engine.initial(c))
  // 1 is the reach control's own step ("Raise the price by $1").
  const given = new Set([t.price, t.variableCost, t.fixedCosts, t.plannedOutput, t.targetOutput, 0, ...(t.kind === 'reach-break-even' ? [1] : [])].filter((v) => v !== undefined))
  for (const n of shownNumbers(html)) need(given.has(n), `${JSON.stringify(t)} shows ${n}`)
  need(!/break-even|contribut|margin of safety =|÷/i.test(html), `${JSON.stringify(t)} names the answer`)
}

/** Every fault says what to do. */
const actionable = (faults: string[], label: string) => {
  for (const f of faults) need(ACTIONABLE.test(f), `${label}: "${f}" says nothing to do`)
}

describe('every config the engine reads', { timeout: 30_000 }, () => {
  it('find-break-even, over every price to $30, variable cost and fixed costs on the list: valid exactly when break-even is whole and on a gridline', () => {
    let valid = 0
    let all = 0
    for (let price = 1; price <= 30; price++) {
      for (let variableCost = 0; variableCost <= 31; variableCost++) {
        for (const fixedCosts of FIXED) {
          all++
          const c = find(price, variableCost, fixedCosts)
          const label = JSON.stringify(c.task)
          const faults = engine.faults(c)
          actionable(faults, label)
          const exact = fixedCosts / (price - variableCost)
          const axis = price > variableCost && Number.isInteger(exact) ? outputAxis(exact) : null
          // Revenue at the far end of the axis is the most the chart shows: it must stay readable.
          const honest = axis !== null && price * axis.max <= MAX_MONEY
          need((faults.length === 0) === honest, `${label}: faults ${JSON.stringify(faults)}`)
          if (!honest) continue
          valid++
          holds(c)
          if (valid % 10 === 0) hidesTheAnswer(c)
        }
      }
    }
    expect(all).toBe(30 * 32 * FIXED.length)
    expect(valid).toBeGreaterThan(1500)
  })

  it('margin-of-safety, over break-even and plans on the chart', () => {
    let valid = 0
    for (let price = 2; price <= 20; price++) {
      for (let variableCost = 0; variableCost < price; variableCost++) {
        for (const fixedCosts of FIXED) {
          const be = breakEven({ price, variableCost, fixedCosts })
          if (be === null || !outputAxis(be)) continue
          const step = outputAxis(be)!.step
          for (const plannedOutput of [be - step, be, be + step, be + 2 * step, Math.round(be * 1.5), be * 2, be * 3, be * 7, be + 1]) {
            if (plannedOutput <= 0) continue
            const c = margin(price, variableCost, fixedCosts, plannedOutput)
            const label = JSON.stringify(c.task)
            const faults = engine.faults(c)
            actionable(faults, label)
            const axis = plannedOutput > be ? outputAxis(be, [plannedOutput]) : null
            const honest = axis !== null && price * axis.max <= MAX_MONEY
            need((faults.length === 0) === honest, `${label}: faults ${JSON.stringify(faults)}`)
            if (!honest) continue
            valid++
            holds(c)
            if (valid % 10 === 0) hidesTheAnswer(c)
          }
        }
      }
    }
    expect(valid).toBeGreaterThan(1000)
  })

  it('reach-break-even, over prices, costs, targets and both levers', () => {
    let valid = 0
    for (const change of ['price', 'variable-cost']) {
      for (let price = 2; price <= 24; price++) {
        for (let variableCost = 0; variableCost < price; variableCost++) {
          for (const fixedCosts of [200, 600, 1200, 2000, 3000, 6000]) {
            for (const targetOutput of [30, 40, 50, 100, 150, 200, 300, 400, 600, 1000]) {
              const c = reach(price, variableCost, fixedCosts, targetOutput, change)
              const faults = engine.faults(c)
              actionable(faults, JSON.stringify(c.task))
              if (faults.length) continue
              valid++
              holds(c)
              if (valid % 10 === 0) hidesTheAnswer(c)
            }
          }
        }
      }
    }
    expect(valid).toBeGreaterThan(1000)
  })

  it('holds over 400 random configs with larger numbers, made to break even on a round output', () => {
    let seed = 20261026
    const rand = (n: number) => {
      seed = (seed * 1103515245 + 12345) % 2147483648
      return seed % n
    }
    let valid = 0
    for (let i = 0; i < 400; i++) {
      const price = 2 + rand(300)
      const variableCost = rand(price)
      const c0 = price - variableCost
      const be = [3, 4, 5, 6, 8, 12, 15, 25][rand(8)] * [1, 10, 100, 1000][rand(4)]
      const fixedCosts = c0 * be
      const kind = ['find-break-even', 'margin-of-safety', 'reach-break-even'][rand(3)]
      const raw = kind === 'find-break-even' ? { kind, price, variableCost, fixedCosts }
        : kind === 'margin-of-safety' ? { kind, price, variableCost, fixedCosts, plannedOutput: Math.round(be * 1.5) }
        : { kind, price: price + 1 + rand(5), variableCost, fixedCosts, targetOutput: be, change: rand(2) ? 'price' : 'variable-cost' }
      const c = read({ task: raw })
      const faults = engine.faults(c)
      actionable(faults, JSON.stringify(raw))
      if (faults.length) continue
      valid++
      holds(c)
      hidesTheAnswer(c)
    }
    expect(valid).toBeGreaterThan(200)
  })
})

// ---------------------------------------------------------------------------

describe('what the learner is told once it is marked', () => {
  const f = find(10, 6, 200)
  const m = margin(5, 3, 800, 600)
  const r = reach(9, 7, 2000, 400)

  it('says what the marker shows, never where break-even is', () => {
    expect(atOutput(f.task, 40)).toBe('At 40 units, costs are $440 and revenue is $400: still a loss of $40.')
    expect(atOutput(f.task, 60)).toBe('At 60 units, costs are $560 and revenue is $600: already a profit of $40.')
    expect(atOutput(f.task, 0)).toBe('At 0 units, costs are $200 and revenue is $0: still a loss of $200.')
    const wrong = view(f, { at: 40 }, 'wrong')
    expect(wrong).toContain('At 40 units, costs are $440 and revenue is $400: still a loss of $40.')
    expect(wrong).not.toMatch(/50 units|break-even/i)
  })

  it('says where the learner’s margin would put break-even, and what the chart shows there', () => {
    expect(madeMargin(m.task, '300')).toBe('You wrote 300 units, which puts break-even at 600 − 300 = 300 units. At 300 units, costs are $1,700 and revenue is $1,500: still a loss of $200.')
    expect(madeMargin(m.task, '100')).toMatch(/puts break-even at 600 − 100 = 500 units\. .*already a profit of \$200/)
    expect(madeMargin(m.task, '700')).toMatch(/more than the planned output of 600 units/)
    expect(madeMargin(m.task, '600')).toMatch(/the whole planned output.*fixed costs of \$800/)
    expect(madeMargin(m.task, '')).toMatch(/Write the margin of safety in the box first/)
    expect(madeMargin(m.task, 'lots')).toMatch(/"lots" is not a whole number of units/)
    for (const typed of ['300', '100', '700', '600', 'lots']) expect(madeMargin(m.task, typed)).not.toMatch(/\b200 units|400 units/)
  })

  it('says what the learner’s price does at the target, never the price that reaches it', () => {
    expect(madeLever(r.task, 9)).toBe('With a price of $9, costs at the target of 400 units are $4,800 and revenue is $3,600: a loss of $1,200, so the business has not yet broken even.')
    expect(madeLever(r.task, 14)).toMatch(/a profit of \$800, so the business breaks even before the target/)
    expect(madeLever(r.task, 7)).toMatch(/adds nothing towards the fixed costs, so the business never breaks even/)
    const v = reach(12, 9, 2000, 400, 'variable-cost')
    expect(madeLever(v.task, 9)).toMatch(/^With a variable cost of \$9 per unit, costs at the target/)
  })

  it('once right, works break-even out from the contribution, and shades the loss and profit', () => {
    const right = view(f, engine.solve(f), 'right')
    expect(right).toContain('Break-even output = fixed costs ÷ (price − variable cost per unit) = $200 ÷ ($10 − $6) = $200 ÷ $4 = 50 units.')
    expect(right).toContain('Each unit sold contributes $4 towards the fixed costs. At 50 units, costs and revenue are both $500.')
    expect(right).toMatch(/>Break-even<\/text>/)
    expect(right).toContain('loss: costs above revenue')
    expect(right).toContain('profit: revenue above costs')
    // Before marking, no shading is explained, because none is drawn.
    expect(view(f, { at: 40 }, 'wrong')).not.toMatch(/costs above revenue|<polygon/)
    const mos = view(m, engine.solve(m), 'shown')
    expect(mos).toContain('Margin of safety = planned output − break-even output = 600 − 400 = 200 units')
    expect(mos).toMatch(/>Margin of safety<\/text>/)
    const lever = view(r, engine.solve(r), 'right')
    expect(lever).toContain('Price = variable cost + fixed costs ÷ target output = $7 + $2,000 ÷ 400 = $7 + $5 = $12.')
    expect(lever).toContain('400 × $5 = $2,000 covers the fixed costs')
  })

  it('locks its controls once solved', () => {
    const html = view(f, engine.solve(f), 'right')
    expect(html).toMatch(/role="slider"[^>]*tabindex="-1"[^>]*aria-disabled="true"/)
    const mos = view(m, engine.solve(m), 'right')
    expect(mos).toMatch(/<input[^>]*disabled=""/)
    const lever = view(r, engine.solve(r), 'right')
    expect(lever.match(/disabled=""/g)!.length).toBeGreaterThanOrEqual(3)
  })
})

describe('the business-finance scene on the board', () => {
  const card = (config: unknown, prompt: string) =>
    renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'business-finance', config }, success: { kind: 'scene' } } },
    } as never)))

  it('find-break-even: a chart with three named lines, a marker the keyboard can move, and no break-even before marking', () => {
    const prompt = 'Drag the marker along the output axis to where the business breaks even.'
    const html = card({ task: { kind: 'find-break-even', price: 10, variableCost: 6, fixedCosts: 200 } }, prompt)
    expect(html).toMatch(/role="slider"[^>]*aria-valuenow="0"[^>]*aria-valuetext="0 units"/)
    expect(html).toContain(prompt)
    for (const name of ['>TR<', '>TC<', '>FC<', 'total revenue: $10 per unit', 'total costs: $200 + $6 per unit', 'fixed costs: $200', 'Output (units)']) expect(html).toContain(name)
    const shown = html.replace(prompt, '')
    expect(shown).not.toMatch(/break-even|contribut|÷|\$4\b/i)
    // 50 appears only as an axis number, never as a label, a reading or a sentence.
    expect(shownNumbers(shown).includes(50)).toBe(false)
    expect(shown).not.toMatch(/You wrote|still a loss|already a profit/)
  })

  it('margin-of-safety: the planned output drawn, a box for the margin, and neither break-even nor the margin before marking', () => {
    const prompt = 'The business plans to make 600 units. Read the chart, then write its margin of safety.'
    const html = card({ task: { kind: 'margin-of-safety', price: 5, variableCost: 3, fixedCosts: 800, plannedOutput: 600 } }, prompt)
    expect(html).toMatch(/<input[^>]*id="[^"]*-margin"/)
    expect(html).toContain('Planned output: 600 units')
    const shown = html.replace(prompt, '')
    const numbers = shownNumbers(shown)
    expect(numbers.includes(400)).toBe(false)
    expect(numbers.includes(200)).toBe(false)
    expect(shown).not.toMatch(/break-even|contribut|÷/i)
  })

  it('reach-break-even: the target drawn, a price control whose ends are not the answer, and no answer before marking', () => {
    const prompt = 'Change the price until the business breaks even at its target of 400 units.'
    const html = card({ task: { kind: 'reach-break-even', price: 9, variableCost: 7, fixedCosts: 2000, targetOutput: 400, change: 'price' } }, prompt)
    expect(html).toMatch(/<input[^>]*type="range"[^>]*min="7"[^>]*max="17"/)
    expect(html).toMatch(/aria-valuetext="\$9 per unit"/)
    expect(html).toContain('Target output: 400 units')
    const shown = html.replace(prompt, '')
    expect(shown).not.toMatch(/\$12\b|\$5\b|break-even|contribut|÷/i)
    expect(shownNumbers(shown).some((n) => n === 12 || n === 5)).toBe(false)
  })
})

describe('the business-finance engine for the tutor', () => {
  it('is registered, with every task kind and its example in its catalogue entry', () => {
    expect(getEngine('business-finance')).toBe(engine)
    expect(engine.isolates).toBe('magnitude')
    expect(engine.prompt).toMatch(/SCENE "business-finance"/)
    expect(engine.prompt).toMatch(/"pattern":"scene"/)
    expect(engine.prompt).toMatch(/"success": \{ "kind":"scene" \}/)
    expect(engine.prompt).toMatch(/"apparatus":"scene:business-finance"/)
    expect(engine.prompt).toMatch(/"isolates":"magnitude"/)
    for (const kind of ['find-break-even', 'margin-of-safety', 'reach-break-even']) expect(engine.prompt).toContain(`"kind":"${kind}"`)
  })

  it('is offered to stations on break-even and the margin of safety, and not to ones that merely share a word', () => {
    expect(sceneCatalogue('Break-even charts: where revenue meets costs')).toContain('SCENE "business-finance"')
    expect(sceneCatalogue('Equivalent fractions')).not.toContain('SCENE "business-finance"')
    expect(scenesFor('Costs, revenue and break-even analysis').map((e) => e.id)).toContain('business-finance')
    expect(scenesFor('The margin of safety').map((e) => e.id)).toContain('business-finance')
    expect(scenesFor('Odd and even numbers').map((e) => e.id)).not.toContain('business-finance')
    expect(scenesFor('Safety in the laboratory').map((e) => e.id)).not.toContain('business-finance')
  })
})
