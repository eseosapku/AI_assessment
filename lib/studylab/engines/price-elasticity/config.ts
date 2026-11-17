// lib/studylab/engines/price-elasticity/config.ts
//
// Price elasticity as two decisions, for Cambridge IGCSE Economics 0455:
//   revenue -- move a shop's price. Shoppers leave or return and the price x quantity
//              revenue rectangle changes shape. Find the price with most total revenue.
//   supply  -- a higher price has brought a larger order. Release stored boxes and switch
//              on spare machines to fill it exactly.
//
// The economic rules, all computed here and never read from the drawing:
//   PED = percentage change in quantity demanded / percentage change in price;
//   PES = percentage change in quantity supplied / percentage change in price;
//   total revenue = price x quantity demanded. PED is reported as an absolute value.
//   Percentages use the midpoint (average) base, so a rise and its reverse agree.
// Sources: OpenStax Principles of Economics 3e, sections 5.1 and 5.2 (definitions,
// midpoint method, slope is not elasticity); Cambridge IGCSE 0455 syllabus; the PES
// determinants summarised by MathsGenie's CIE revision guide. URLs are in research.md.
//
// The two demand models are fictional teaching models, not measured market data:
//   Q = round(Q0 * (P0 / P)^e), P0 = 6; cinema Q0 = 2, e = 1.5; petrol Q0 = 6, e = 0.5.
// A constant-e model avoids the misconception that slope is elasticity. Quantities are
// rounded because the shoppers drawn are whole people, and marking uses those visible
// quantities. Cinema's many substitutes and petrol's necessity/few substitutes are
// explanations of these models, not claims that every real market has the same PED.
//
// Ideas taken, never code or art: GeoGebra's gain/loss revenue rectangle; SERC's
// predict-the-revenue consequence in a familiar setting. The physical move is the
// seller's own decision: change the price tag and watch both shoppers and revenue.
// Perfectly elastic/perfectly inelastic curves and formula-entry drills are deliberately
// not forced into these models.

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { PriceElasticityView } from './View'

export type ElasticityConfig =
  | { task: 'revenue'; good: string }
  | { task: 'supply'; order: number }

export type ElasticityState = { price?: number; stock?: number; machines?: number }

export const PRICE_MIN = 2
export const PRICE_MAX = 10
export const BASE_PRICE = 6
export const STOCK_MAX = 4
export const MACHINE_MAX = 3
export const BASE_OUTPUT = 4
export const OLD_PRICE = 5
export const NEW_PRICE = 8
export const ORDER_MIN = 5
export const ORDER_MAX = 14

export const GOODS = ['cinema', 'petrol'] as const
export type Good = (typeof GOODS)[number]

const has = (o: object, k: string | number) => Object.prototype.hasOwnProperty.call(o, k)
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))
export const money = (n: number) => `$${n}`

/** Whole shoppers at a whole-dollar price, from the disclosed demand model. */
export function quantityDemanded(good: string, price: number): number {
  const g = good === 'petrol' ? 'petrol' : 'cinema'
  const q0 = g === 'cinema' ? 2 : 6
  const e = g === 'cinema' ? 1.5 : 0.5
  return Math.round(q0 * Math.pow(BASE_PRICE / price, e))
}

export const totalRevenue = (good: string, price: number) => price * quantityDemanded(good, price)
export const PRICES = Array.from({ length: PRICE_MAX - PRICE_MIN + 1 }, (_, i) => PRICE_MIN + i)

/** Every price tied for highest revenue is accepted. */
export function bestPrices(good: string): number[] {
  const best = Math.max(...PRICES.map((p) => totalRevenue(good, p)))
  return PRICES.filter((p) => totalRevenue(good, p) === best)
}

export function readPrice(state: ElasticityState | null | undefined): number {
  const p = state?.price
  return typeof p === 'number' && Number.isInteger(p) && p >= PRICE_MIN && p <= PRICE_MAX ? p : BASE_PRICE
}
export function readStock(state: ElasticityState | null | undefined): number {
  const n = state?.stock
  return typeof n === 'number' && Number.isInteger(n) ? clamp(n, 0, STOCK_MAX) : 0
}
export function readMachines(state: ElasticityState | null | undefined): number {
  const n = state?.machines
  return typeof n === 'number' && Number.isInteger(n) ? clamp(n, 0, MACHINE_MAX) : 0
}
export const quantitySupplied = (state: ElasticityState | null | undefined) =>
  BASE_OUTPUT + readStock(state) + 2 * readMachines(state)

/** Percentage change on the average of the old and new values. */
export function midpointChange(from: number, to: number): number {
  return (200 * (to - from)) / (from + to)
}
export function elasticity(fromQuantity: number, toQuantity: number, fromPrice: number, toPrice: number): number {
  return Math.abs(midpointChange(fromQuantity, toQuantity) / midpointChange(fromPrice, toPrice))
}
export const rounded = (n: number) => Math.round(n)
export const fixed2 = (n: number) => n.toFixed(2)
export const category = (e: number) => (Math.abs(e - 1) < 0.005 ? 'unitary' : e > 1 ? 'elastic' : 'inelastic')

export function revenuePED(config: ElasticityConfig, state: ElasticityState): number {
  if (config.task !== 'revenue') return 0
  const p = readPrice(state)
  return elasticity(quantityDemanded(config.good, BASE_PRICE), quantityDemanded(config.good, p), BASE_PRICE, p)
}
export function supplyPES(config: ElasticityConfig, state: ElasticityState): number {
  if (config.task !== 'supply') return 0
  return elasticity(BASE_OUTPUT, quantitySupplied(state), OLD_PRICE, NEW_PRICE)
}

/** A correct revenue card: the decision, its measured PED, and why revenue won. */
export function revenueWorking(config: ElasticityConfig, state: ElasticityState): string {
  if (config.task !== 'revenue') return ''
  const p = readPrice(state)
  const q = quantityDemanded(config.good, p)
  const r = totalRevenue(config.good, p)
  const ped = revenuePED(config, state)
  const pq = rounded(Math.abs(midpointChange(quantityDemanded(config.good, BASE_PRICE), q)))
  const pp = rounded(Math.abs(midpointChange(BASE_PRICE, p)))
  const reason = config.good === 'cinema'
    ? 'The extra tickets sold more than made up for the lower price. In this model, many substitutes make cinema demand responsive to price.'
    : 'The higher price added more revenue than the lost sales took away. In this model, petrol is a necessity with few close substitutes, so quantity demanded responds less.'
  return `Yes. ${money(r)} is the highest total revenue on the card: ${money(p)} x ${q} shoppers. Quantity changed by ${pq}% while price changed by ${pp}%, so PED = ${fixed2(ped)}: ${category(ped)}. ${reason}`
}

/** What the learner's present price does, without pointing towards the best one. */
export function revenueMade(config: ElasticityConfig, state: ElasticityState): string {
  if (config.task !== 'revenue') return ''
  const p = readPrice(state)
  const q = quantityDemanded(config.good, p)
  return `At ${money(p)}, ${q} shoppers bring total revenue of ${money(totalRevenue(config.good, p))}. That is not the highest on the card: try another price and compare both shoppers and revenue.`
}

export function supplyWorking(config: ElasticityConfig, state: ElasticityState): string {
  if (config.task !== 'supply') return ''
  const q = quantitySupplied(state)
  const pes = supplyPES(config, state)
  const pq = rounded(midpointChange(BASE_OUTPUT, q))
  const pp = rounded(midpointChange(OLD_PRICE, NEW_PRICE))
  return `Yes. Exactly ${q} boxes supplied. Quantity supplied rose ${pq}% while price rose ${pp}%, so PES = ${fixed2(pes)}: ${category(pes)}. Stored boxes and spare machines let the firm increase output quickly: both make supply more elastic.`
}

export function supplyMade(config: ElasticityConfig, state: ElasticityState): string {
  if (config.task !== 'supply') return ''
  const q = quantitySupplied(state)
  const gap = config.order - q
  const detail = gap > 0 ? `${gap} ${gap === 1 ? 'box' : 'boxes'} short` : `${-gap} ${gap === -1 ? 'box' : 'boxes'} too many`
  return `You supplied ${q} boxes against an order for ${config.order}: ${detail}. Stored boxes count one each; each spare machine makes two.`
}

// ---------------------------------------------------------------------------
// Reading the tutor's semantic config broadly. Values outside the drawable range
// still parse; faults gives a nearby example that works.

const keyOf = (raw: unknown) => (typeof raw === 'string' ? raw.trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : '')
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)

function readTask(raw: unknown): 'revenue' | 'supply' | null {
  const k = keyOf(raw)
  if (/^(revenue|total-revenue|max-revenue|maximise-revenue|maximize-revenue|ped|demand|price-elasticity|price-elasticity-of-demand|elastic-demand|inelastic-demand|shop|pricing)$/.test(k)) return 'revenue'
  if (/^(supply|pes|price-elasticity-of-supply|production|factory|spare-capacity|stocks|supply-response)$/.test(k)) return 'supply'
  return null
}
function readGood(raw: unknown): string {
  const k = keyOf(raw)
  if (!k) return 'cinema'
  if (/cinema|film|movie|ticket/.test(k)) return 'cinema'
  if (/petrol|gasoline|fuel|gas$/.test(k)) return 'petrol'
  return k
}
function readOrder(raw: unknown): number | null {
  if (raw === undefined) return 10
  const n = typeof raw === 'string' && raw.trim() !== '' ? Number(raw.trim().replace(/\s*(?:boxes|units|crates)$/i, '')) : raw
  return typeof n === 'number' && Number.isFinite(n) ? n : null
}

function goodPrompt(config: ElasticityConfig): string {
  return config.task === 'revenue'
    ? `Tap minus or plus on Price to move the ${config.good === 'petrol' ? 'petrol' : 'cinema'} price tag. Find the price that earns the most total revenue.`
    : `Tap minus or plus on Stored boxes and Spare machines. Supply exactly ${config.order} boxes to fill the order.`
}

export const priceElasticityEngine: SceneEngine<ElasticityConfig, ElasticityState> = {
  id: 'price-elasticity',
  // Distinctive words only in covers; common words such as demand, supply and price
  // belong to the neighbouring supply-demand scene unless the whole phrase matches.
  covers: ['price elasticity', 'PED', 'PES', 'elastic demand', 'inelastic demand'],
  phrases: [
    'price elasticity of demand', 'price elasticity of supply', 'price elasticities',
    'elasticity of demand', 'elasticity of supply', 'elastic and inelastic demand',
    'elastic and inelastic supply', 'elastic or inelastic', 'demand elasticity', 'supply elasticity',
    'PED and total revenue', 'total revenue and elasticity', 'elasticity and total revenue',
    'determinants of elasticity', 'determinants of PED', 'determinants of PES',
    'factors affecting PED', 'factors affecting PES', 'responsiveness of demand', 'responsiveness of supply',
    'unitary elasticity', 'unit elastic demand', 'unit elastic supply',
  ],
  notFor: [
    'market equilibrium', 'price determination', 'shifts in demand', 'shifts in supply',
    'maximum price', 'minimum price', 'price ceiling', 'price floor', 'shortages and surpluses',
    "Hooke's law", 'Hookes law', 'elasticity of materials', 'elastic deformation', 'spring constant', 'springs and oscillations',
    'break-even', 'breakeven', 'margin of safety', 'business finance',
    'inflation', 'macroeconomics', 'international trade', 'tariffs', 'comparative advantage',
    'income elasticity', 'cross elasticity', 'elasticity of substitution',
  ],
  isolates: 'consequence',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const nested = o.task && typeof o.task === 'object' ? (o.task as Record<string, unknown>) : null
    const src = nested ?? o
    const rawTask = first(src, nested ? ['kind', 'task', 'type'] : ['task', 'kind', 'type', 'mode'])
    const rawGood = first(src, ['good', 'product', 'scenario', 'market'])
    const rawOrder = first(src, ['order', 'target', 'quantity'])
    let task = rawTask === undefined ? null : readTask(rawTask)
    if (!task && rawOrder !== undefined) task = 'supply'
    if (!task && rawGood !== undefined) task = 'revenue'
    if (!task) return null
    if (task === 'supply') {
      const order = readOrder(rawOrder)
      return order === null ? null : { task, order }
    }
    if (rawGood !== undefined && typeof rawGood !== 'string') return null
    return { task, good: readGood(rawGood) }
  },

  faults(config) {
    if (config.task === 'revenue') {
      return has({ cinema: 1, petrol: 1 }, config.good) ? [] : [
        `There is no "${config.good}" demand model drawn here: use good "cinema" (responsive demand) or "petrol" (less responsive demand), e.g. { "task":"revenue", "good":"cinema" }.`,
      ]
    }
    if (!Number.isInteger(config.order) || config.order < ORDER_MIN || config.order > ORDER_MAX) {
      const near = clamp(Math.round(config.order), ORDER_MIN, ORDER_MAX)
      return [`An order for ${config.order} boxes cannot be filled exactly: choose a whole order from ${ORDER_MIN} to ${ORDER_MAX} boxes, using at most ${STOCK_MAX} stored boxes and ${MACHINE_MAX} spare machines, e.g. order ${near}.`]
    }
    return []
  },

  promptFaults(config, prompt) {
    const text = prompt.replace(/\s+/g, ' ')
    const example = goodPrompt(config)
    const out: string[] = []
    if (config.task === 'revenue') {
      const direction = /\b(?:raise|higher|lower|cut|increase|decrease|reduce|cheap\w*|expensive)\b[^.?!]{0,25}\bprice\b|\bprice\b[^.?!]{0,25}\b(?:raise|higher|lower|fall|rise|increase|decrease|reduce|up|down)\b/i.test(text)
      const answer = /\b(?:elastic|inelastic|unitary|PED\s*=)\b|\$\s*\d+|\b(?:two|ten)\s+dollars?\b/i.test(text)
      if (direction || answer) out.push(`the prompt gives the pricing decision or its elasticity away, which the learner is to discover from shoppers and revenue -- ask for the aim only ("${example}")`)
      if (/\bdrag\b|\bspare machines?\b|\bstored boxes\b|\bPES\b|\bsupply curve\b|\bdemand curve\b|\bgraph\b/i.test(text)) out.push(`the prompt promises something the card does not show: it has a price stepper, shoppers and a revenue rectangle, not curves or factory controls -- ask for that ("${example}")`)
    } else {
      const answer = /\bPES\s*=|\b(?:elastic|inelastic|unitary)\b|\b\d+(?:\.\d+)?%\b|\buse\s+(?:all|only|\d+)\b|\b(?:switch on|add)\s+\d+\b/i.test(text)
      if (answer) out.push(`the prompt gives the supply response or its elasticity away, which the learner is to make and measure -- ask for the order only ("${example}")`)
      if (/\bdrag\b|\bshoppers?\b|\btotal revenue\b|\bPED\b|\bsupply curve\b|\bgraph\b|\btime machine\b/i.test(text)) out.push(`the prompt promises something the card does not show: it uses stock and spare-machine steppers to fill an order, not shoppers, revenue or curves -- ask for that ("${example}")`)
    }
    return out
  },

  initial(config) {
    return config.task === 'revenue' ? { price: BASE_PRICE } : { stock: 0, machines: 0 }
  },

  check(config, state) {
    if (config.task === 'revenue') {
      const p = state?.price
      const valid = typeof p === 'number' && Number.isInteger(p) && p >= PRICE_MIN && p <= PRICE_MAX
      return { ok: valid && bestPrices(config.good).includes(p), wrongIds: valid ? [] : ['price'] }
    }
    return { ok: quantitySupplied(state) === config.order, wrongIds: quantitySupplied(state) === config.order ? [] : ['supply'] }
  },

  solve(config) {
    if (config.task === 'revenue') return { price: bestPrices(config.good)[0] }
    // Use the fewest spare machines that stock alone cannot replace, then fill with stock.
    const extra = config.order - BASE_OUTPUT
    const machines = Math.ceil(Math.max(0, extra - STOCK_MAX) / 2)
    const stock = extra - 2 * machines
    return { stock, machines }
  },

  View: PriceElasticityView,

  prompt: `SCENE "price-elasticity" -- price elasticity as two hands-on decisions on quiet light panels, for Cambridge IGCSE Economics 0455.
  revenue: a real small cinema or petrol shop, a movable price tag, whole shoppers who leave or return, and a price-times-quantity revenue rectangle. One minus/plus price stepper ($2 to $10, start $6). Live readouts name price, shoppers and total revenue. The learner finds the highest total revenue; every price tied for highest passes. Marking gives midpoint percentage changes, PED and elastic/inelastic, and explains the revenue trade-off and this model's substitutes/necessity determinant. good: cinema (more responsive demand) or petrol (less responsive demand). These are fictional constant-elasticity demand models with whole rounded shoppers, not claims about every real market.
  supply: a cutaway factory with four stored boxes and three spare machines. A higher price ($5 to $8) has brought an order. Stored boxes count one each and each spare machine adds two boxes to the four already made. Two steppers release stock and switch on machines; the output crates change immediately. The learner fills the order exactly; every exact stock/machine combination passes. order: a whole number 5 to 14, default 10. Marking gives midpoint percentage changes and PES, and explains how stocks and spare capacity make supply more elastic.
  For: PED, elastic and inelastic demand, total revenue and pricing, substitutes and necessity as determinants; PES, stocks and spare capacity. Not drawn: market equilibrium, shifting demand/supply curves, numerical formula entry, perfectly elastic or perfectly inelastic curves, tax-incidence diagrams, Hooke's law, break-even, inflation or tariffs. Do not claim that unitary elasticity leaves revenue unchanged for every finite change.
  Before marking each card shows its goal, live quantities and the consequence of every move. It holds back the best price, the PED/PES value and classification, and the determinant explanation. The prompt must name the gesture and aim only: do NOT say which way to move price, name a best price/revenue, state elastic/inelastic/unitary or a PED/PES value, or prescribe a stock/machine combination.
  config: { "task":"revenue", "good":"cinema" }  -- the prompt says "Tap minus or plus on Price to move the cinema price tag. Find the price that earns the most total revenue."
       or { "task":"revenue", "good":"petrol" }  -- the prompt says "Tap minus or plus on Price to move the petrol price tag. Find the price that earns the most total revenue."
       or { "task":"supply", "order":10 }  -- the prompt says "Tap minus or plus on Stored boxes and Spare machines. Supply exactly 10 boxes to fill the order."
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Tap minus or plus on Price to move the cinema price tag. Find the price that earns the most total revenue.",
    "payload": { "engine":"price-elasticity", "config": { "task":"revenue", "good":"cinema" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:price-elasticity", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Tap minus or plus on Price to move the petrol price tag. Find the price that earns the most total revenue.",
    "payload": { "engine":"price-elasticity", "config": { "task":"revenue", "good":"petrol" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:price-elasticity", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Tap minus or plus on Stored boxes and Spare machines. Supply exactly 10 boxes to fill the order.",
    "payload": { "engine":"price-elasticity", "config": { "task":"supply", "order":10 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:price-elasticity", "why":"..." } }`,
}

registerEngine(priceElasticityEngine as SceneEngine<unknown, unknown>)
