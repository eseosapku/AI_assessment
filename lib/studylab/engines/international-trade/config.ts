// lib/studylab/engines/international-trade-kimi31/config.ts
//
// International trade as two things the learner can change:
//   specialise -- move six workers in each of two fictional countries between two goods. Both orders must be
//                 filled exactly. One country is better at BOTH goods, so absolute-advantage intuition fails;
//   tariff     -- charge a tax on each imported unit. The ship's cargo, the home price, home production,
//                 purchases and government revenue all respond in one small, linear, competitive-market model.
//
// The economics is computed here, never read from the drawing. Productivities and market schedules are fictional
// teaching examples, not claims about real countries. The specialisation arithmetic follows Ricardo's comparative
// advantage (lower opportunity cost), including the WTO's warning that it is not absolute advantage:
// https://www.wto.org/english/res_e/reser_e/cadv_e.htm
// The tariff model is the standard small-country partial-equilibrium model: the home price is world price + tariff
// while imports remain, Qd = 140 - P and Qs = 20 + P. It stops at the prohibitive tariff. It does not claim to
// describe a large country, retaliation, exchange rates or every real market. Sources and design choices: research.md.

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { InternationalTradeView } from './View'

export const WORKERS = 6
export const TARIFF_STEPS = [0, 5, 10, 15, 20] as const

export type TradeConfig =
  | { task: 'specialise'; scenario: string }
  | { task: 'tariff'; scenario: string; aim: string }
export type TradeState = { a?: number; b?: number; tariff?: number }

export type Good = { name: string; short: string; unit: string }
export type ProductionScenario = {
  goods: [Good, Good]
  /** Units per worker per day in [Avenia, Bordia], for [first good, second good]. */
  rates: [[number, number], [number, number]]
  order: [number, number]
  solution: [number, number]
  /** One unit of the first good costs this much of the second, in each country. */
  firstCost: [string, string]
  /** One unit of the second good costs this much of the first, in each country. */
  secondCost: [string, string]
}
export const PRODUCTION: Record<string, ProductionScenario> = {
  workshop: {
    goods: [
      { name: 'tables', short: 'Tables', unit: 'tables' },
      { name: 'chairs', short: 'Chairs', unit: 'chairs' },
    ],
    rates: [[6, 4], [2, 3]],
    order: [42, 9], solution: [6, 3],
    firstCost: ['2/3 of a chair', '3/2 chairs'], secondCost: ['3/2 tables', '2/3 of a table'],
  },
  farm: {
    goods: [
      { name: 'tonnes of wheat', short: 'Wheat', unit: 'tonnes' },
      { name: 'tonnes of vegetables', short: 'Vegetables', unit: 'tonnes' },
    ],
    rates: [[8, 6], [3, 5]],
    order: [48, 30], solution: [6, 0],
    firstCost: ['3/4 of a tonne of vegetables', '5/3 tonnes of vegetables'],
    secondCost: ['4/3 tonnes of wheat', '3/5 of a tonne of wheat'],
  },
  clothing: {
    goods: [
      { name: 'rolls of denim', short: 'Denim', unit: 'rolls' },
      { name: 'shirts', short: 'Shirts', unit: 'shirts' },
    ],
    rates: [[5, 4], [2, 3]],
    order: [24, 20], solution: [4, 2],
    firstCost: ['4/5 of a shirt', '3/2 shirts'], secondCost: ['5/4 rolls of denim', '2/3 of a roll of denim'],
  },
}

export type TariffScenario = { good: string; singular: string; container: string; worldPrice: number }
export const IMPORTS: Record<string, TariffScenario> = {
  bicycles: { good: 'bicycles', singular: 'bicycle', container: 'crate', worldPrice: 40 },
  shoes: { good: 'pairs of shoes', singular: 'pair of shoes', container: 'crate', worldPrice: 40 },
  chairs: { good: 'chairs', singular: 'chair', container: 'crate', worldPrice: 40 },
}

const has = (o: object, k: string | number) => Object.prototype.hasOwnProperty.call(o, k)
export const productionOf = (config: TradeConfig): ProductionScenario =>
  config.task === 'specialise' && has(PRODUCTION, config.scenario) ? PRODUCTION[config.scenario] : PRODUCTION.workshop
export const importOf = (config: TradeConfig): TariffScenario =>
  config.task === 'tariff' && has(IMPORTS, config.scenario) ? IMPORTS[config.scenario] : IMPORTS.bicycles

// ---------------------------------------------------------------------------
// Specialisation: exact integer production, and exact orders.

const allocation = (v: unknown): number | null => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= WORKERS ? v : null

export function outputOf(config: TradeConfig, state: TradeState | null | undefined): [number, number] | null {
  if (config.task !== 'specialise') return null
  const a = allocation(state?.a)
  const b = allocation(state?.b)
  if (a === null || b === null) return null
  const p = productionOf(config)
  return [p.rates[0][0] * a + p.rates[1][0] * b, p.rates[0][1] * (WORKERS - a) + p.rates[1][1] * (WORKERS - b)]
}

export function countryOutput(config: TradeConfig, country: 0 | 1, workersOnFirst: number): [number, number] {
  const p = productionOf(config)
  return [p.rates[country][0] * workersOnFirst, p.rates[country][1] * (WORKERS - workersOnFirst)]
}

// ---------------------------------------------------------------------------
// Tariff: all quantities are units per day. A crate drawn on the ship holds five units.

export type Market = { tariff: number; price: number; homeMade: number; bought: number; imports: number; revenue: number }
export const tariffValue = (v: unknown): number | null => typeof v === 'number' && (TARIFF_STEPS as readonly number[]).includes(v) ? v : null

export function marketAt(config: TradeConfig, tariff: number): Market {
  const world = importOf(config).worldPrice
  const price = world + tariff
  const homeMade = 20 + price
  const bought = 140 - price
  const imports = Math.max(0, bought - homeMade)
  return { tariff, price, homeMade, bought, imports, revenue: tariff * imports }
}
export function marketOf(config: TradeConfig, state: TradeState | null | undefined): Market | null {
  if (config.task !== 'tariff') return null
  const t = tariffValue(state?.tariff)
  return t === null ? null : marketAt(config, t)
}
export const bestRevenue = (config: TradeConfig): Market =>
  TARIFF_STEPS.map((t) => marketAt(config, t)).reduce((best, m) => m.revenue > best.revenue ? m : best)

// ---------------------------------------------------------------------------
// What marking says. Before marking there are counts and observations, never a verdict or the economic name.

const signed = (n: number, noun: string) => `${Math.abs(n)} ${noun}${Math.abs(n) === 1 && !/s$/.test(noun) ? '' : ''} ${n > 0 ? 'extra' : 'short'}`

export function madeText(config: TradeConfig, state: TradeState | null | undefined): string {
  if (config.task === 'specialise') {
    const made = outputOf(config, state)
    const p = productionOf(config)
    if (!made) return 'The worker allocation is incomplete: use the minus and plus buttons to place every worker.'
    const differences = made.map((n, i) => n - p.order[i])
    if (differences.every((d) => d === 0)) return `You made exactly ${made[0]} ${p.goods[0].name} and ${made[1]} ${p.goods[1].name}.`
    const detail = differences.map((d, i) => d === 0 ? `${p.goods[i].short} exactly filled` : `${signed(d, p.goods[i].name)}`).join('; ')
    return `You made ${made[0]} ${p.goods[0].name} and ${made[1]} ${p.goods[1].name}: ${detail}.`
  }
  const m = marketOf(config, state)
  const good = importOf(config)
  if (!m) return 'The tariff is not set to one of the steps on the card.'
  const facts = `You set a tariff of $${m.tariff} per ${good.singular}. The home price is $${m.price}; home producers sell ${m.homeMade} and imports are ${m.imports}. Government revenue is $${m.revenue}.`
  if (config.aim === 'max-revenue') return `${facts} Compare the other rates: revenue depends on both the charge per unit and how many units still enter.`
  return `${facts} The task is imports of 20, half the free-trade level of 40.`
}

export function working(config: TradeConfig, state: TradeState | null | undefined): string {
  if (config.task === 'specialise') {
    const p = productionOf(config)
    // Kept short so the marked card stays under 520 px: the costs carry the idea, the swap is one sentence.
    return `Yes. Both orders are filled exactly. Avenia has the comparative advantage in ${p.goods[0].name} (each costs ${p.firstCost[0]}, against ${p.firstCost[1]} in Bordia); Bordia has it in ${p.goods[1].name}. Specialising and swapping lets both have more.`
  }
  const m = marketOf(config, state) ?? bestRevenue(config)
  const good = importOf(config)
  const revenue = config.aim === 'max-revenue' ? ' That is the most on the card: a higher charge leaves too few imports to tax.' : ''
  return `Yes. A $${m.tariff} tariff lifts the price from $${good.worldPrice} to $${m.price}, so imports fall from 40 to ${m.imports} and the government collects $${m.revenue}.${revenue} Home producers gain; consumers lose, and the lost trade is an efficiency loss.`
}

// ---------------------------------------------------------------------------
// Reading the tutor's semantic config broadly; faults carries actionable fixes.

const keyOf = (raw: unknown) => typeof raw === 'string' ? raw.trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : ''
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)

function readScenario(raw: unknown, task: 'specialise' | 'tariff'): string {
  const k = keyOf(raw)
  if (!k) return task === 'specialise' ? 'workshop' : 'bicycles'
  if (task === 'specialise') {
    if (/farm|wheat|vegetable|agricultur|food/.test(k)) return 'farm'
    if (/cloth|denim|shirt|textile/.test(k)) return 'clothing'
    if (/workshop|furniture|table|chair|wood/.test(k)) return 'workshop'
    return k
  }
  if (/shoe|footwear|trainer/.test(k)) return 'shoes'
  if (/chair|furniture/.test(k)) return 'chairs'
  if (/bicycle|bike|cycle/.test(k)) return 'bicycles'
  return k
}
function readAim(raw: unknown): string {
  const k = keyOf(raw)
  if (!k || /half|halve|imports|reduce-imports|cut-imports/.test(k)) return 'half-imports'
  if (/revenue|government-income|tax-income|most-money|maximise-revenue|maximize-revenue/.test(k)) return 'max-revenue'
  return k
}

function goodPrompt(config: TradeConfig): string {
  if (config.task === 'specialise') {
    const p = productionOf(config)
    return `Tap minus or plus to move workers between the two goods. Fill the order of ${p.order[0]} ${p.goods[0].name} and ${p.order[1]} ${p.goods[1].name} exactly, with nobody idle.`
  }
  const good = importOf(config)
  return config.aim === 'max-revenue'
    ? `Tap minus or plus on the tariff per ${good.singular}. Find the rate that gives the government the most revenue.`
    : `Tap minus or plus on the tariff per ${good.singular}. Make imports half their free-trade level.`
}

export const internationalTradeEngine: SceneEngine<TradeConfig, TradeState> = {
  id: 'international-trade',
  covers: ['international trade', 'comparative advantage', 'free trade', 'tariffs', 'protectionism', 'specialisation of countries'],
  phrases: [
    'absolute advantage', 'gains from trade', 'trade restrictions', 'import tariffs', 'tariff', 'imports and exports', 'exports and imports',
    'specialisation', 'specialization', 'countries specialise', 'countries specialize', 'imports', 'exports', 'protection', 'trade protection',
  ],
  notFor: [
    'exchange rates', 'exchange rate', 'current account', 'balance of payments', 'balance of trade', 'supply and demand', 'single market',
    'business finance', 'business costs', 'division of labour', 'division of labor', 'trade routes', 'history of trade', 'multinational corporations',
  ],
  isolates: 'consequence',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const nested = o.task && typeof o.task === 'object' ? o.task as Record<string, unknown> : null
    const src = nested ?? o
    const rawTask = first(src, nested ? ['kind', 'task', 'type'] : ['task', 'kind', 'type', 'mode'])
    if (rawTask !== undefined && typeof rawTask !== 'string') return null
    const k = keyOf(rawTask)
    let task: 'specialise' | 'tariff' | null = null
    if (/speciali[sz]|comparative|absolute|advantage|gains-from-trade|production|workers|allocate/.test(k)) task = 'specialise'
    if (/tariff|protection|customs|import-tax|duty|revenue/.test(k)) task = 'tariff'
    if (!task && first(src, ['tariff', 'duty']) !== undefined) task = 'tariff'
    if (!task) return null
    const scenario = readScenario(first(src, ['scenario', 'example', 'goods', 'good', 'product', 'industry']), task)
    if (task === 'specialise') return { task, scenario }
    return { task, scenario, aim: readAim(first(src, ['aim', 'goal', 'objective', 'target'])) }
  },

  faults(config) {
    const out: string[] = []
    if (config.task === 'specialise' && !has(PRODUCTION, config.scenario)) {
      out.push(`There is no production scenario "${config.scenario}": use workshop (tables and chairs), farm (wheat and vegetables) or clothing (denim and shirts), e.g. scenario "workshop".`)
    }
    if (config.task === 'tariff') {
      if (!has(IMPORTS, config.scenario)) out.push(`There is no import scenario "${config.scenario}": use bicycles, shoes or chairs, e.g. scenario "bicycles".`)
      if (!['half-imports', 'max-revenue'].includes(config.aim)) out.push(`There is no tariff aim "${config.aim}": use "half-imports" or "max-revenue", e.g. aim "max-revenue".`)
    }
    return out
  },

  promptFaults(config, prompt) {
    const text = prompt.toLowerCase().replace(/\s+/g, ' ')
    const example = goodPrompt(config)
    const out: string[] = []
    if (config.task === 'specialise') {
      const p = productionOf(config)
      const assignment = new RegExp(`\\b(?:avenia|bordia)\\b[^.?!]{0,45}\\b(?:${p.goods[0].name.replace(/ /g, '\\s*')}|${p.goods[1].name.replace(/ /g, '\\s*')}|first|second|all\\s+\\d|${p.solution[0]}|${p.solution[1]})`, 'i').test(text)
      const counts = /\b(?:[0-6]|one|two|three|four|five|six)\s+workers?\s+(?:on|in|to|making|growing|producing)\b/i.test(text)
      const costs = /\b(?:lower|lowest|comparative advantage|opportunity costs?)\b[^.?!]{0,60}\b(?:avenia|bordia|\d+\s*\/\s*\d+)/i.test(text)
      if (assignment || counts || costs) out.push(`the prompt gives the allocation or opportunity costs away, which the learner is to discover by moving the workers -- ask for the orders only ("${example}")`)
      if (/\b(?:ppf|ppc|production possibility|draw a graph|terms of trade|exchange rate|tariff|quota)\b/i.test(text)) out.push(`the prompt promises something this card does not show: it draws workers, output and two fixed orders, not curves, trade prices or barriers -- ask for the allocation ("${example}")`)
    } else {
      const solved = internationalTradeEngine.solve(config)
      const answer = marketOf(config, solved)?.tariff ?? 10
      const rate = new RegExp(`\\$\\s*${answer}\\b|\\b${answer}\\s+dollars?\\b|\\b(?:ten|10)\\s+(?:per\\s+${importOf(config).singular}|steps?|taps?)`, 'i').test(text)
      const outcome = /\b(?:raise|increase|higher|lower|reduce|fall|cuts?)\b[^.?!]{0,30}\b(?:price|home-made|home production|consumer|producer|imports|revenue)\b/i.test(text)
      const winners = /\bconsumers?\s+(?:lose|gain|benefit)|\bproducers?\s+(?:lose|gain|benefit)|\bdeadweight\b/i.test(text)
      if (rate || outcome || winners) out.push(`the prompt gives the tariff or its effects away, which the learner is to find at the customs gate -- ask for the aim only ("${example}")`)
      if (/\b(?:quota|subsidy|embargo|exchange rate|current account|supply curve|demand curve|consumer surplus|drag)\b/i.test(text)) out.push(`the prompt promises something this card does not show: it models a tariff with steppers, a ship, output and revenue, not another barrier, curves or currency -- ask for the tariff ("${example}")`)
    }
    return out
  },

  initial(config) { return config.task === 'specialise' ? { a: 3, b: 3 } : { tariff: 0 } },

  check(config, state) {
    if (config.task === 'specialise') {
      const made = outputOf(config, state)
      const order = productionOf(config).order
      return { ok: !!made && made[0] === order[0] && made[1] === order[1], wrongIds: [] }
    }
    const m = marketOf(config, state)
    return { ok: !!m && (config.aim === 'max-revenue' ? m.revenue === bestRevenue(config).revenue : m.imports === 20), wrongIds: [] }
  },

  solve(config) {
    if (config.task === 'specialise') {
      const s = productionOf(config).solution
      return { a: s[0], b: s[1] }
    }
    if (config.aim === 'max-revenue') return { tariff: bestRevenue(config).tariff }
    const found = TARIFF_STEPS.map((t) => marketAt(config, t)).find((m) => m.imports === 20)
    return { tariff: found?.tariff ?? 10 }
  },

  View: InternationalTradeView,

  prompt: `SCENE "international-trade" -- two hands-on international-trade models on quiet light panels, for Cambridge IGCSE Economics 0455.
  specialise: Avenia and Bordia each have six workers, split between two workplaces. Avenia is more productive in BOTH goods. Each workplace shows its output per worker; each minus/plus step visibly moves one worker and changes both goods' output. Two order dockets give exact quantities. The learner fills both exactly with nobody idle. Marking reveals opportunity costs, which country has each comparative advantage, and how suitable trade can let both consume beyond their own production. It does not claim countries always fully specialise.
  tariff: a small-country market with a cargo ship, home factory, shop and customs gate. One stepper sets the tariff at $0, $5, $10, $15 or $20 per unit. Every step changes the cargo (one crate = 5 units), home price, home output, purchases and government revenue. A tariff is a tax, not a ban. Marking says exactly who gains and loses. The disclosed linear model is Qd = 140 - price and Qs = 20 + price, with world price $40 and price = world price + tariff; it is fictional, not a forecast.
  For: specialisation by countries, absolute and comparative advantage, opportunity cost, gains from trade, free trade, tariffs, who gains and loses from a tariff, protectionism. Not drawn: PPFs, terms-of-trade numbers, quotas, subsidies, embargoes, exchange rates, the current account, trade-route history, surplus/deadweight-loss graphs, or division of labour inside a firm.
  config: { "task":"specialise", "scenario":"workshop" } -- workshop (6 tables or 4 chairs per Avenia worker; 2 tables or 3 chairs per Bordia worker; order 42 tables and 9 chairs), farm (wheat and vegetables; order 48 tonnes and 30 tonnes), or clothing (denim and shirts; order 24 rolls and 20 shirts).
       or { "task":"tariff", "scenario":"bicycles", "aim":"half-imports" } -- scenario bicycles, shoes or chairs; aim half-imports (from 40 to 20) or max-revenue (find the highest government revenue).
  Before marking the card shows productivity, current output, orders, or current tariff and market quantities. It holds back the solution, opportunity-cost comparison and economic verdict. Prompts must name the gesture and aim only: do NOT assign a country to a good, give worker counts or opportunity-cost ratios, state the tariff rate, or say its effects in advance.
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Tap minus or plus to move workers between the two goods. Fill the order of 42 tables and 9 chairs exactly, with nobody idle.",
    "payload": { "engine":"international-trade", "config": { "task":"specialise", "scenario":"workshop" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:international-trade", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Tap minus or plus to move workers between the two goods. Fill the order of 48 tonnes of wheat and 30 tonnes of vegetables exactly, with nobody idle.",
    "payload": { "engine":"international-trade", "config": { "task":"specialise", "scenario":"farm" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:international-trade", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Tap minus or plus on the tariff per bicycle. Make imports half their free-trade level.",
    "payload": { "engine":"international-trade", "config": { "task":"tariff", "scenario":"bicycles", "aim":"half-imports" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:international-trade", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Tap minus or plus on the tariff per bicycle. Find the rate that gives the government the most revenue.",
    "payload": { "engine":"international-trade", "config": { "task":"tariff", "scenario":"bicycles", "aim":"max-revenue" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:international-trade", "why":"..." } }`,
}

registerEngine(internationalTradeEngine as SceneEngine<unknown, unknown>)
