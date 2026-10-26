// lib/studylab/engines/business-finance/config.ts
import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { BusinessFinanceView } from './View'

/**
 * Break-even analysis, as Cambridge IGCSE Business Studies (0450) teaches it in
 * section 4.2, "Costs, scale of production and break-even analysis":
 *
 *   total costs   = fixed costs + variable cost per unit × output
 *   total revenue = selling price per unit × output
 *   break-even output = fixed costs ÷ (price − variable cost per unit),
 *     the price less the variable cost being the contribution each unit makes
 *     towards the fixed costs;
 *   margin of safety = planned (or actual) output − break-even output.
 *
 * The tutor names a price, a variable cost per unit and the fixed costs; the
 * engine draws the chart, chooses its axes so that break-even falls on a
 * gridline, and marks. All arithmetic is in whole dollars and whole units, so
 * every comparison is between integers.
 *
 * Version 1 is break-even only. Cash-flow forecasts, income statements,
 * statements of financial position and ratios are left for later versions.
 */

export const KINDS = ['find-break-even', 'margin-of-safety', 'reach-break-even'] as const
export type Kind = (typeof KINDS)[number]
/** What the learner changes in reach-break-even. */
export const LEVERS = ['price', 'variable-cost'] as const
export type Lever = (typeof LEVERS)[number]

/** A business's numbers: dollars per unit, and dollars in all for the fixed costs. */
export type Economics = { price: number; variableCost: number; fixedCosts: number }
export type BusinessFinanceTask = Economics & {
  kind: Kind
  /** margin-of-safety: the output the business plans to make. */
  plannedOutput?: number
  /** reach-break-even: the output at which it is to break even. */
  targetOutput?: number
  /** reach-break-even: what the learner changes. */
  change?: Lever
}
export type BusinessFinanceConfig = { task: BusinessFinanceTask }
/**
 * find-break-even: where the marker is on the output axis (`at`, in units).
 * margin-of-safety: the marker, a reading aid, and the margin the learner typed.
 * reach-break-even: the price or variable cost the learner has set (`value`, in dollars).
 */
export type BusinessFinanceState = { at?: number; answer?: string; value?: number }

/** The output axis has between these many gridlines' worth of columns. */
export const MIN_COLS = 8
export const MAX_COLS = 20
/** The money axis runs to no more than this: larger numbers are not small enough to read. */
export const MAX_MONEY = 1_000_000
/** The most $1 steps the reach-break-even control may span. */
export const MAX_LEVER_STEPS = 240
/** Above this, a number is not one anyone meant for a school chart: parse gives up. */
const PARSE_MAX = 100_000_000

/** Gridline steps for the output axis, largest first: round numbers a learner can count along. */
const OUTPUT_STEPS = [10000, 5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5, 2, 1]
/** Gridline steps for the money axis, smallest first. */
const MONEY_STEPS = [
  1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000,
  10000, 20000, 25000, 50000, 100000, 200000, 250000, 500000,
]

const whole = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v)

// ---------------------------------------------------------------------------
// The maths.

export const contribution = (e: Economics) => e.price - e.variableCost
export const totalCosts = (e: Economics, q: number) => e.fixedCosts + e.variableCost * q
export const totalRevenue = (e: Economics, q: number) => e.price * q

/** The break-even output when the business breaks even at a whole number of units; null otherwise. */
export function breakEven(e: Economics): number | null {
  const c = contribution(e)
  if (!whole(e.price) || !whole(e.variableCost) || !whole(e.fixedCosts) || c <= 0 || e.fixedCosts <= 0) return null
  return e.fixedCosts % c === 0 ? e.fixedCosts / c : null
}

/** reach-break-even: the contribution per unit that breaks even at the target, when it is whole dollars. */
export function neededContribution(task: BusinessFinanceTask): number | null {
  const t = task.targetOutput
  if (!whole(t) || t <= 0 || !whole(task.fixedCosts) || task.fixedCosts <= 0 || task.fixedCosts % t !== 0) return null
  return task.fixedCosts / t
}

/** reach-break-even: the price (or variable cost) that breaks even at the target. */
export function needed(task: BusinessFinanceTask): number | null {
  const c = neededContribution(task)
  if (c === null) return null
  return task.change === 'variable-cost' ? task.price - c : task.variableCost + c
}

/** The business with the learner's price or variable cost in place of the config's. */
export function withLever(task: BusinessFinanceTask, value: number): Economics {
  return task.change === 'variable-cost'
    ? { price: task.price, variableCost: value, fixedCosts: task.fixedCosts }
    : { price: value, variableCost: task.variableCost, fixedCosts: task.fixedCosts }
}

export const leverStart = (task: BusinessFinanceTask) => (task.change === 'variable-cost' ? task.variableCost : task.price)

/**
 * How far the reach-break-even control goes, in $1 steps. Each end is a value
 * that never breaks even at the target, so neither end gives the answer away:
 * the price runs from the variable cost (each unit then adds nothing) to past
 * the price needed; the variable cost from $0 to the price.
 */
export function leverRange(task: BusinessFinanceTask): { lo: number; hi: number } {
  if (task.change === 'variable-cost') return { lo: 0, hi: task.price }
  const c = neededContribution(task) ?? Math.max(1, contribution(task))
  const n = needed(task) ?? task.price
  return { lo: task.variableCost, hi: Math.max(task.price, n) + Math.max(5, c) }
}

// ---------------------------------------------------------------------------
// The chart's axes.

export type OutputAxis = { step: number; cols: number; max: number }
export type MoneyAxis = { step: number; rows: number; max: number }
export type Chart = { x: OutputAxis; y: MoneyAxis }

/**
 * An output axis on which `key` (break-even, or the target) and every one of
 * `also` (the planned output) fall on gridlines, with `key` at least three
 * gridlines from 0 and room after it, in 8 to 20 columns. The largest round
 * step that does it; null when none does.
 */
export function outputAxis(key: number, also: number[] = []): OutputAxis | null {
  if (!whole(key) || key <= 0 || also.some((a) => !whole(a) || a <= 0)) return null
  for (const step of OUTPUT_STEPS) {
    if (key % step !== 0 || key / step < 3) continue
    if (also.some((a) => a % step !== 0)) continue
    const need = Math.max(Math.ceil(key * 1.5), ...also.map((a) => a + step))
    const cols = Math.max(MIN_COLS, Math.ceil(need / step))
    if (cols > MAX_COLS) continue
    return { step, cols, max: step * cols }
  }
  return null
}

/** A money axis from $0 past `top`, in at most eight round steps. */
export function moneyAxis(top: number): MoneyAxis {
  const t = Math.max(1, Math.ceil(top))
  const step = MONEY_STEPS.find((s) => Math.ceil(t / s) <= 8) ?? Math.ceil(t / 8)
  const rows = Math.ceil(t / step)
  return { step, rows, max: step * rows }
}

/** The output that sits on a gridline: break-even, or the target. */
function keyOutput(task: BusinessFinanceTask): number | null {
  return task.kind === 'reach-break-even' ? (whole(task.targetOutput) ? task.targetOutput : null) : breakEven(task)
}

/** Both axes of the chart, or null when the task cannot be drawn on gridlines. */
export function chartFor(task: BusinessFinanceTask): Chart | null {
  const key = keyOutput(task)
  if (key === null) return null
  const also = task.kind === 'margin-of-safety' && whole(task.plannedOutput) ? [task.plannedOutput] : []
  const x = outputAxis(key, also)
  if (!x) return null
  const shown: Economics[] = [task]
  if (task.kind === 'reach-break-even') {
    const n = needed(task)
    if (n === null) return null
    shown.push(withLever(task, n))
  }
  // Revenue at the far end, or costs if they are higher: lines that leave the top are cut there.
  const top = Math.max(...shown.map((e) => Math.max(totalRevenue(e, x.max), totalCosts(e, x.max))))
  return { x, y: moneyAxis(top) }
}

// ---------------------------------------------------------------------------
// Numbers in words.

/** "1,200". */
export const count = (n: number) => {
  const [int, frac] = String(Math.abs(n)).split('.')
  return `${n < 0 ? '−' : ''}${int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${frac ? `.${frac}` : ''}`
}
/** "$1,200". */
export const money = (n: number) => (n < 0 ? `−$${count(-n)}` : `$${count(n)}`)
/** "1 unit", "40 units". */
export const units = (n: number) => `${count(n)} ${n === 1 ? 'unit' : 'units'}`

/** A whole number of units the learner typed: "200", "2,000", "200 units". Null for anything else. */
export function readCount(raw: unknown): number | null {
  if (typeof raw === 'number') return whole(raw) && raw >= 0 ? raw : null
  if (typeof raw !== 'string') return null
  const s = raw.trim().toLowerCase().replace(/\s*units?$/, '').trim()
  if (!/^(\d{1,3}(,\d{3})+|\d{1,12})$/.test(s)) return null
  const n = Number(s.replace(/,/g, ''))
  return whole(n) ? n : null
}

// ---------------------------------------------------------------------------
// What the learner made, in words: said once it is marked, never before.

/** What the chart shows at an output: costs, revenue, and the loss or profit between them. */
export function atOutput(e: Economics, q: number): string {
  const tc = totalCosts(e, q)
  const tr = totalRevenue(e, q)
  const head = `At ${units(q)}, costs are ${money(tc)} and revenue is ${money(tr)}`
  if (tr < tc) return `${head}: still a loss of ${money(tc - tr)}.`
  if (tr > tc) return `${head}: already a profit of ${money(tr - tc)}.`
  return `${head}: costs and revenue are equal.`
}

/** margin-of-safety, marked wrong: where the learner's margin would put break-even, and what the chart shows there. */
export function madeMargin(task: BusinessFinanceTask, answer: unknown): string {
  const typed = typeof answer === 'string' ? answer.trim() : typeof answer === 'number' ? String(answer) : ''
  if (!typed) return 'Write the margin of safety in the box first, as a number of units.'
  const n = readCount(typed)
  if (n === null) return `"${typed}" is not a whole number of units: write the margin of safety as a number of units.`
  const planned = task.plannedOutput ?? 0
  const implied = planned - n
  if (implied < 0) {
    return `You wrote ${units(n)}, more than the planned output of ${units(planned)}: the margin of safety is how far output could fall from the plan before the business makes a loss.`
  }
  if (implied === 0) {
    return `You wrote ${units(n)}, the whole planned output: that would put break-even at 0 units, but at 0 units the business still has fixed costs of ${money(task.fixedCosts)} to pay.`
  }
  return `You wrote ${units(n)}, which puts break-even at ${count(planned)} − ${count(n)} = ${units(implied)}. ${atOutput(task, implied)}`
}

/** reach-break-even, marked wrong: what the learner's price or cost does at the target. */
export function madeLever(task: BusinessFinanceTask, value: number): string {
  const e = withLever(task, value)
  const target = task.targetOutput ?? 0
  const what = task.change === 'variable-cost' ? `With a variable cost of ${money(value)} per unit` : `With a price of ${money(value)}`
  const c = contribution(e)
  if (c <= 0) {
    return `${what}, each unit sold ${c === 0 ? 'adds nothing towards' : 'takes money away from'} the fixed costs, so the business never breaks even.`
  }
  const tc = totalCosts(e, target)
  const tr = totalRevenue(e, target)
  const head = `${what}, costs at the target of ${units(target)} are ${money(tc)} and revenue is ${money(tr)}`
  if (tr < tc) return `${head}: a loss of ${money(tc - tr)}, so the business has not yet broken even.`
  return `${head}: a profit of ${money(tr - tc)}, so the business breaks even before the target.`
}

// ---------------------------------------------------------------------------
// The answer, in words: shown once it is marked.

/** break-even = fixed costs ÷ (price − variable cost per unit), worked through. */
export function revealBreakEven(e: Economics): string {
  const be = breakEven(e) ?? 0
  const c = contribution(e)
  return `Break-even output = fixed costs ÷ (price − variable cost per unit) = ${money(e.fixedCosts)} ÷ (${money(e.price)} − ${money(e.variableCost)}) = ${money(e.fixedCosts)} ÷ ${money(c)} = ${units(be)}.`
}

/** What the contribution does, and what the chart shows at break-even. */
export function revealContribution(e: Economics): string {
  const be = breakEven(e) ?? 0
  return `Each unit sold contributes ${money(contribution(e))} towards the fixed costs. At ${units(be)}, costs and revenue are both ${money(totalRevenue(e, be))}.`
}

export function revealMargin(task: BusinessFinanceTask): string {
  const be = breakEven(task) ?? 0
  const planned = task.plannedOutput ?? 0
  const m = planned - be
  return `Margin of safety = planned output − break-even output = ${count(planned)} − ${count(be)} = ${units(m)}: output could fall by ${units(m)} before the business makes a loss.`
}

export function revealLever(task: BusinessFinanceTask): string {
  const c = neededContribution(task) ?? 0
  const n = needed(task) ?? 0
  const target = task.targetOutput ?? 0
  const how = task.change === 'variable-cost'
    ? `Variable cost = price − fixed costs ÷ target output = ${money(task.price)} − ${money(task.fixedCosts)} ÷ ${count(target)} = ${money(task.price)} − ${money(c)} = ${money(n)}.`
    : `Price = variable cost + fixed costs ÷ target output = ${money(task.variableCost)} + ${money(task.fixedCosts)} ÷ ${count(target)} = ${money(task.variableCost)} + ${money(c)} = ${money(n)}.`
  return `${how} Each unit then contributes ${money(c)}, and ${count(target)} × ${money(c)} = ${money(task.fixedCosts)} covers the fixed costs.`
}

// ---------------------------------------------------------------------------
// Reading what the tutor writes.

/** "$1,200", "1200", "6 per unit", 10: a non-negative amount. Null for anything else. */
function readAmount(raw: unknown): number | null {
  let v: number
  if (typeof raw === 'number') v = raw
  else if (typeof raw === 'string') {
    const s = raw.trim().toLowerCase().replace(/[$£€]/g, '').replace(/\b(dollars?|units?|per|each|a)\b/g, ' ').replace(/\s+/g, '')
    if (!/^(\d{1,3}(,\d{3})+|\d+)(\.\d+)?$/.test(s)) return null
    v = Number(s.replace(/,/g, ''))
  } else return null
  return Number.isFinite(v) && v >= 0 && v <= PARSE_MAX ? v + 0 : null
}

/** "findBreakEven", "Find the break-even point", "margin_of_safety": the key every way of writing it shares. */
const keyOf = (raw: string) =>
  raw.trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/breakeven/g, 'break-even')
    .split(/[\s_-]+/).filter((w) => w && !['the', 'a', 'an', 'its', 'to'].includes(w)).join('-')

const KIND_ALIASES: Record<string, Kind> = {
  'find-break-even': 'find-break-even', 'break-even': 'find-break-even', 'find-break-even-point': 'find-break-even',
  'find-break-even-output': 'find-break-even', 'break-even-point': 'find-break-even', 'break-even-output': 'find-break-even',
  'mark-break-even': 'find-break-even', 'read-break-even': 'find-break-even',
  'margin-of-safety': 'margin-of-safety', 'find-margin-of-safety': 'margin-of-safety', 'read-margin-of-safety': 'margin-of-safety',
  'margin-safety': 'margin-of-safety',
  'reach-break-even': 'reach-break-even', 'reach-break-even-at-target': 'reach-break-even', 'break-even-at-target': 'reach-break-even',
  'hit-break-even': 'reach-break-even', 'set-break-even': 'reach-break-even', 'reach-target': 'reach-break-even',
}
const LEVER_ALIASES: Record<string, Lever> = {
  'price': 'price', 'selling-price': 'price', 'price-per-unit': 'price', 'selling-price-per-unit': 'price', 'unit-price': 'price',
  'variable-cost': 'variable-cost', 'variable-costs': 'variable-cost', 'variable-cost-per-unit': 'variable-cost', 'vc': 'variable-cost',
  'unit-variable-cost': 'variable-cost',
}
const lookup = <T,>(table: Record<string, T>, raw: unknown): T | null =>
  typeof raw === 'string' && Object.prototype.hasOwnProperty.call(table, keyOf(raw)) ? table[keyOf(raw)] : null

const first = (objs: Record<string, unknown>[], keys: string[]) => {
  for (const o of objs) for (const k of keys) if (o[k] !== undefined) return o[k]
  return undefined
}
const PRICE_KEYS = ['price', 'sellingPrice', 'selling-price', 'selling_price', 'pricePerUnit', 'price-per-unit', 'price_per_unit', 'unitPrice']
const VC_KEYS = ['variableCost', 'variable-cost', 'variable_cost', 'variableCostPerUnit', 'variable-cost-per-unit', 'variable_cost_per_unit', 'unitVariableCost', 'vc']
const FC_KEYS = ['fixedCosts', 'fixedCost', 'fixed-costs', 'fixed-cost', 'fixed_costs', 'fixed_cost', 'totalFixedCosts', 'fc']
const PLANNED_KEYS = ['plannedOutput', 'planned-output', 'planned_output', 'planned', 'plannedSales', 'planned-sales', 'actualOutput', 'expectedOutput', 'output']
const TARGET_KEYS = ['targetOutput', 'target-output', 'target_output', 'target', 'breakEvenTarget']
const LEVER_KEYS = ['change', 'lever', 'vary', 'adjust']

// ---------------------------------------------------------------------------
// What the card's prompt may not say.

type Said = { value: number; money: boolean }

/** The numbers in a prompt, and whether each is written as money ("$1,200", "4 dollars", "$4 per unit"). */
function numbersIn(prompt: string): Said[] {
  const out: Said[] = []
  for (const m of prompt.matchAll(/([$£€]\s?)?(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?/g)) {
    const after = prompt.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 16).toLowerCase()
    out.push({ value: Number(`${m[2].replace(/,/g, '')}${m[3] ?? ''}`), money: !!m[1] || /^\s*(dollars?\b|per unit\b|a unit\b|each\b)/.test(after) })
  }
  return out
}

/** "break-even is 400", "breaks even at 400", "break-even point: 400". */
const BREAK_EVEN_SAID = /\bbreaks?[\s-]?even(?:\s+(?:output|point|quantity|level))?\s*(?:is|of|=|:|equals|will be|occurs at|is at|at)\s*[$£€]?\s?\d/i
/** "contribution of $4", "contribution per unit is 4". */
const CONTRIBUTION_SAID = /\bcontribution(?:\s+per\s+unit)?\s*(?:is|of|=|:|equals|will be)\s*[$£€]?\s?\d/i
/** "margin of safety is 200". */
const MARGIN_SAID = /\bmargin of safety\s*(?:is|of|=|:|equals|will be)\s*\d/i

/**
 * What the card's prompt gives away that the scene hides until it is marked:
 * the break-even output, the margin of safety, the contribution per unit, or
 * the price (or cost) that reaches the target. The numbers the learner is
 * given -- price, costs, planned or target output -- are fine.
 */
export function promptFaults(config: BusinessFinanceConfig, prompt: string): string[] {
  const t = config.task
  const said = numbersIn(prompt)
  const given = new Set([t.price, t.variableCost, t.fixedCosts])
  const out: string[] = []
  if (t.kind !== 'reach-break-even') {
    const be = breakEven(t)
    if (be === null) return []
    if (BREAK_EVEN_SAID.test(prompt) || said.some((s) => !s.money && s.value === be)) {
      out.push(`The prompt gives the break-even output away: it states ${units(be)} or a break-even figure, which the learner is to find on the chart. Ask without it ("Drag the marker to where the business breaks even."), and write money with a $ sign.`)
    }
    const c = contribution(t)
    if (CONTRIBUTION_SAID.test(prompt) || (!given.has(c) && said.some((s) => s.money && s.value === c))) {
      out.push(`The prompt gives the contribution away: it states ${money(c)} per unit (the price less the variable cost), which the scene shows once it is marked. Give the price and the costs, never their difference.`)
    }
    if (t.kind === 'margin-of-safety' && whole(t.plannedOutput)) {
      const m = t.plannedOutput - be
      if (MARGIN_SAID.test(prompt) || (m !== be && said.some((s) => !s.money && s.value === m))) {
        out.push(`The prompt gives the margin of safety away: it states ${units(m)}, which the learner is to read off the chart. Name the planned output and ask.`)
      }
    }
    return out
  }
  const n = needed(t)
  const c = neededContribution(t)
  const target = t.targetOutput ?? 0
  const word = t.change === 'variable-cost' ? 'variable cost' : 'price'
  if (n !== null && !given.has(n) && n !== target && said.some((s) => s.value === n)) {
    out.push(`The prompt gives the answer away: it states ${money(n)}, the ${word} that makes the business break even at ${units(target)}, which the learner is to find. Name the target output and ask ("Change the ${word} until the business breaks even at ${units(target)}.").`)
  }
  if (c !== null && (CONTRIBUTION_SAID.test(prompt) || (!given.has(c) && c !== n && said.some((s) => s.money && s.value === c)))) {
    out.push(`The prompt gives the answer away: it states ${money(c)} per unit, the contribution needed to break even at ${units(target)}. Name the target output and ask.`)
  }
  return out
}

// ---------------------------------------------------------------------------
// What a writer is told when a config would teach nothing, or wrongly.

/** A round break-even output near `q` that a chart can show, for a writer's next try. */
function roundNear(q: number): number {
  for (const r of [100, 50, 10, 5]) {
    const n = Math.max(r, Math.round(q / r) * r)
    if (outputAxis(n)) return n
  }
  return 40
}

/** A target near `target` that divides the fixed costs and a chart can show, or null. */
function targetNear(task: BusinessFinanceTask): number | null {
  const fc = task.fixedCosts
  const target = whole(task.targetOutput) ? task.targetOutput : 0
  let best: number | null = null
  for (let d = 1; d * d <= fc; d++) {
    if (fc % d !== 0) continue
    for (const q of [d, fc / d]) {
      const c = fc / q
      const ok = outputAxis(q) && (task.change !== 'variable-cost' || task.price - c >= 1)
      if (ok && (best === null || Math.abs(q - target) < Math.abs(best - target))) best = q
    }
  }
  return best
}

function faultsOf(t: BusinessFinanceTask): string[] {
  const amounts: [string, number | undefined][] = [
    ['the price', t.price], ['the variable cost per unit', t.variableCost], ['the fixed costs', t.fixedCosts],
    ['the planned output', t.plannedOutput], ['the target output', t.targetOutput],
  ]
  const notWhole = amounts.filter(([, v]) => v !== undefined && !Number.isInteger(v))
  if (notWhole.length) {
    return [`Use whole dollars and whole units: ${notWhole.map(([name, v]) => `${name} (${v})`).join(' and ')} ${notWhole.length > 1 ? 'are' : 'is'} not whole. Choose whole numbers, such as a price of $10 and fixed costs of $2,000.`]
  }
  if (t.fixedCosts < 1) return ['With no fixed costs the business breaks even at 0 units, so there is nothing to find: give it fixed costs, such as $2,000.']
  const c = contribution(t)
  if (c <= 0) {
    return [`The price (${money(t.price)}) is not above the variable cost per unit (${money(t.variableCost)}), so each unit sold adds nothing towards the fixed costs and the business never breaks even: set the price above the variable cost.`]
  }
  const out: string[] = []

  if (t.kind === 'reach-break-even') {
    const word = t.change === 'variable-cost' ? 'variable cost' : 'price'
    const target = t.targetOutput
    if (target === undefined) return ['reach-break-even needs a targetOutput: the output at which the business should break even, a round number of units such as 400.']
    if (target < 1) return ['The target output must be at least 1 unit: choose a round number of units, such as 400.']
    const cn = neededContribution(t)
    if (cn === null) {
      const near = targetNear(t)
      return [`No whole-dollar ${word} makes the business break even at exactly ${units(target)}: fixed costs of ${money(t.fixedCosts)} ÷ ${units(target)} is not a whole number of dollars. Choose a target that divides ${money(t.fixedCosts)} exactly${near ? `, such as ${units(near)}` : ''}.`]
    }
    if (t.change === 'variable-cost' && t.price - cn < 1) {
      return [`To break even at ${units(target)} each unit must contribute ${money(cn)}, but the price is only ${money(t.price)}, so no variable cost of $1 or more would do: choose a larger target output, or set "change" to "price".`]
    }
    if (cn === c) out.push(`The business already breaks even at ${units(target)}, with a price of ${money(t.price)} and a variable cost of ${money(t.variableCost)}, so there is nothing to change: start from a different ${word}.`)
    if (!outputAxis(target)) out.push(`A target of ${units(target)} cannot be read off a chart that fits the card${target < 3 ? ' (it is too close to 0)' : ''}: choose a round target that divides the fixed costs, such as ${units(targetNear(t) ?? 400)}.`)
    const { lo, hi } = leverRange(t)
    if (hi - lo > MAX_LEVER_STEPS) out.push(`The ${word} would move in $1 steps from ${money(lo)} to ${money(hi)}, too many to set by hand: keep the price and the contribution needed under about $100.`)
  } else {
    const be = breakEven(t)
    if (be === null) {
      const exact = t.fixedCosts / c
      const q = roundNear(exact)
      return [`Fixed costs of ${money(t.fixedCosts)} ÷ (${money(t.price)} − ${money(t.variableCost)}) per unit is ${Number(exact.toFixed(2))} units, not a whole number, so the learner could not find it on the chart: choose numbers where the fixed costs divide exactly by the price less the variable cost, such as fixed costs of ${money(c * q)} (break-even at ${units(q)}).`]
    }
    const alone = outputAxis(be)
    if (!alone) {
      const q = roundNear(be)
      return [`Break-even at ${units(be)} cannot be read off a chart that fits the card${be < 3 ? ' (it is too close to 0)' : ''}: choose numbers that make it a round number of units, such as fixed costs of ${money(c * q)} (break-even at ${units(q)}).`]
    }
    if (t.kind === 'margin-of-safety') {
      const p = t.plannedOutput
      const suggest = () => {
        const s = Math.max(be + alone.step, Math.round((1.5 * be) / alone.step) * alone.step)
        return outputAxis(be, [s]) ? s : be + alone.step
      }
      if (p === undefined) return [`margin-of-safety needs a plannedOutput: the output the business plans to make, a round number above break-even (here, such as ${units(suggest())}).`]
      if (p <= be) return [`The planned output (${units(p)}) is not above break-even (${units(be)}), so there is no margin of safety to read: plan an output above break-even, such as ${units(suggest())}.`]
      if (!outputAxis(be, [p])) out.push(`The planned output (${units(p)}) and break-even (${units(be)}) cannot both fall on gridlines of one chart: plan an output that is a multiple of ${units(alone.step)} and no more than about three times break-even, such as ${units(suggest())}.`)
    }
  }
  const chart = chartFor(t)
  if (chart && chart.y.max > MAX_MONEY) {
    out.push(`The chart's money axis would run to ${money(chart.y.max)}, too large for numbers a learner can read: keep the numbers small, so revenue at the end of the output axis stays under ${money(MAX_MONEY)}.`)
  }
  return out
}

// ---------------------------------------------------------------------------

export const businessFinanceEngine: SceneEngine<BusinessFinanceConfig, BusinessFinanceState> & {
  promptFaults(config: BusinessFinanceConfig, prompt: string): string[]
} = {
  id: 'business-finance',
  covers: ['break-even', 'breakeven', 'margin of safety'],
  isolates: 'magnitude',

  parse(raw) {
    const root = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null
    const task = root?.task
    if (!root || !task || typeof task !== 'object') return null
    const t = task as Record<string, unknown>
    const from = [t, root]
    const kind = lookup(KIND_ALIASES, t.kind)
    const price = readAmount(first(from, PRICE_KEYS))
    const variableCost = readAmount(first(from, VC_KEYS))
    const fixedCosts = readAmount(first(from, FC_KEYS))
    if (!kind || price === null || variableCost === null || fixedCosts === null) return null
    const out: BusinessFinanceTask = { kind, price, variableCost, fixedCosts }
    if (kind === 'margin-of-safety') {
      const rawPlanned = first(from, PLANNED_KEYS)
      if (rawPlanned !== undefined) {
        const planned = readAmount(rawPlanned)
        if (planned === null) return null
        out.plannedOutput = planned
      }
    }
    if (kind === 'reach-break-even') {
      const rawTarget = first(from, TARGET_KEYS)
      if (rawTarget !== undefined) {
        const target = readAmount(rawTarget)
        if (target === null) return null
        out.targetOutput = target
      }
      const rawLever = first(from, LEVER_KEYS)
      const lever = rawLever === undefined ? 'price' : lookup(LEVER_ALIASES, rawLever)
      if (!lever) return null
      out.change = lever
    }
    return { task: out }
  },

  faults(config) {
    return faultsOf(config.task)
  },

  promptFaults,

  initial(config) {
    const t = config.task
    // Break-even is at least three gridlines from 0, and the start price is
    // never the one that reaches the target (a fault), so no start is solved.
    if (t.kind === 'find-break-even') return { at: 0 }
    if (t.kind === 'margin-of-safety') return { at: 0, answer: '' }
    return { value: leverStart(t) }
  },

  check(config, state) {
    const t = config.task
    if (t.kind === 'find-break-even') {
      const be = breakEven(t)
      return { ok: be !== null && state?.at === be, wrongIds: [] }
    }
    if (t.kind === 'margin-of-safety') {
      const be = breakEven(t)
      const typed = readCount(state?.answer)
      return { ok: be !== null && whole(t.plannedOutput) && typed !== null && typed === t.plannedOutput - be, wrongIds: [] }
    }
    const n = needed(t)
    return { ok: n !== null && state?.value === n, wrongIds: [] }
  },

  solve(config) {
    const t = config.task
    const be = breakEven(t) ?? 0
    if (t.kind === 'find-break-even') return { at: be }
    if (t.kind === 'margin-of-safety') return { at: be, answer: String((t.plannedOutput ?? be) - be) }
    return { value: needed(t) ?? leverStart(t) }
  },

  View: BusinessFinanceView,

  prompt: `SCENE "business-finance" -- a break-even chart (Cambridge IGCSE Business Studies 0450): the fixed costs,
  total costs and total revenue lines against output, drawn by the engine from a selling price per unit, a
  variable cost per unit and the fixed costs. The learner drags a marker along the output axis (or steps it with
  the arrow keys) and watches where it meets each line, or changes the price until the lines cross at a target.
  Nothing is labelled where the lines cross until it is marked; then the engine shows break-even = fixed costs ÷
  (price − variable cost per unit), the contribution per unit, and shades the loss and profit.
  For: break-even charts, the break-even point, the margin of safety, contribution.
  numbers: whole dollars, price above the variable cost, and fixed costs that divide exactly by (price − variable
  cost) to give a round break-even output, such as 40, 250 or 400 units.
  config: { "task": { "kind":"find-break-even", "price":25, "variableCost":15, "fixedCosts":4000 } }
            -- drag the marker to the break-even output
       or { "task": { "kind":"margin-of-safety", "price":5, "variableCost":3, "fixedCosts":800, "plannedOutput":600 } }
            -- the planned output (a round number above break-even) is drawn; the learner types the margin of safety
       or { "task": { "kind":"reach-break-even", "price":9, "variableCost":7, "fixedCosts":2000, "targetOutput":400, "change":"price" } }
            -- the learner changes the price ("change":"price") or the variable cost ("change":"variable-cost") until the
            business breaks even at the target; fixed costs ÷ target must be whole dollars, and the start must not already do it
  The card's prompt may give the price, costs and planned or target output; it never states the break-even output,
  the margin of safety, the contribution, or the price or cost that reaches the target.
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drag the marker along the output axis to where the business breaks even.",
    "payload": { "engine":"business-finance", "config": { "task": { "kind":"find-break-even", "price":25, "variableCost":15, "fixedCosts":4000 } } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"magnitude", "apparatus":"scene:business-finance", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"The business plans to make 600 units. Read the chart, then write its margin of safety.",
    "payload": { "engine":"business-finance", "config": { "task": { "kind":"margin-of-safety", "price":5, "variableCost":3, "fixedCosts":800, "plannedOutput":600 } } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"magnitude", "apparatus":"scene:business-finance", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Change the price until the business breaks even at its target of 400 units.",
    "payload": { "engine":"business-finance", "config": { "task": { "kind":"reach-break-even", "price":9, "variableCost":7, "fixedCosts":2000, "targetOutput":400, "change":"price" } } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"magnitude", "apparatus":"scene:business-finance", "why":"..." } }`,
}

registerEngine(businessFinanceEngine as SceneEngine<unknown, unknown>)
