// lib/studylab/engines/supply-demand/config.ts
import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { SupplyDemandView } from './View'

/**
 * A market diagram, as Cambridge IGCSE Economics 0455 and AS Level 9708 draw
 * it: price up the side, quantity along the bottom, a straight demand curve
 * and a straight supply curve. The tutor names an event or a price control;
 * the engine draws the curves, works out every equilibrium, shortage and
 * surplus exactly, and marks what the learner does.
 *
 * The market (whole numbers throughout, so every crossing is a grid point):
 *   demand  P = 11 - Q + d,  that is  Qd = 11 + d - P
 *   supply  P = 1 + Q - s,   that is  Qs = P - 1 + s
 * where d and s are the learner's shifts, in units of quantity (right is
 * positive). Unshifted, they cross at a price of $6 and a quantity of 5.
 * Shifts move in notches of 2, so with both slopes 1 the crossing is always a
 * whole price and a whole quantity: Q = (10 + d + s) / 2, P = 6 + (d - s) / 2.
 * Every shift either curve may take keeps every crossing inside the grid
 * (pinned by the tests).
 *
 * Sources for the events and the price controls:
 * - Cambridge IGCSE Economics 0455 syllabus, "Demand" (the conditions of
 *   demand: income, the prices of substitutes and complements, advertising,
 *   tastes and fashion, population), "Supply" (the conditions of supply: costs
 *   of production, technology, indirect taxes, subsidies, weather, the number
 *   of firms), "Price determination" (equilibrium; disequilibrium as excess
 *   demand and excess supply) and "Mixed economic system" (maximum and
 *   minimum prices).
 * - Cambridge International AS & A Level Economics 9708, "Price elasticity,
 *   income elasticity and cross elasticity of demand" (an inferior good: demand
 *   falls as income rises) and "Government microeconomic intervention"
 *   (maximum and minimum prices, indirect taxes and subsidies).
 */

/** The grid runs from 0 to MAX on both axes. */
export const MAX = 12
/** Demand meets the price axis at $11, supply at $1 (unshifted). */
export const DEMAND_TOP = 11
export const SUPPLY_FOOT = 1
/** A curve moves in notches of this many units of quantity. */
export const NOTCH = 2
/** How far either curve may move, either way. */
export const MAX_SHIFT = 4
/** How far the asked curve must move to count as moved. */
export const MIN_SHIFT = 2
/** How far a price control may sit from the equilibrium price, in dollars. */
export const BY = [1, 2, 3] as const

export type Curve = 'demand' | 'supply'
/** +1 is a shift to the right (an increase), -1 to the left (a decrease). */
export type Way = 1 | -1

export interface MarketEvent {
  /** As shown on the scene, in sentence case once capitalised: "a rise in incomes". */
  text: string
  /** What the scene says under the event, when it is needed to read it rightly. */
  note?: string
  /** As said inside a sentence, with anything the note adds: "a rise in incomes for a normal good". */
  said: string
  curve: Curve
  way: Way
  /** Why, once marked: a sentence of its own. */
  why: string
  /** Other ways a writer names it (articles and punctuation are ignored). */
  also: string[]
}

const NORMAL = 'It is a normal good.'
const INFERIOR = 'It is an inferior good.'

/** The events the engine knows, each with the curve it moves and which way (sources above). */
export const EVENTS = {
  'income-rise': {
    text: 'a rise in incomes', note: NORMAL, said: 'a rise in incomes for a normal good', curve: 'demand', way: 1,
    why: 'Buyers have more to spend, so they want more of a normal good at every price.',
    also: ['rise in income', 'incomes rise', 'income rises', 'higher incomes', 'higher income', 'increase in income', 'increase in incomes', 'rising incomes', 'income rise', 'incomes increase'],
  },
  'income-fall': {
    text: 'a fall in incomes', note: NORMAL, said: 'a fall in incomes for a normal good', curve: 'demand', way: -1,
    why: 'Buyers have less to spend, so they want less of a normal good at every price.',
    also: ['fall in income', 'incomes fall', 'income falls', 'lower incomes', 'lower income', 'decrease in income', 'decrease in incomes', 'falling incomes', 'income fall', 'incomes decrease'],
  },
  'income-rise-inferior': {
    text: 'a rise in incomes', note: INFERIOR, said: 'a rise in incomes for an inferior good', curve: 'demand', way: -1,
    why: 'With more to spend, buyers switch to better goods, so they want less of an inferior good at every price.',
    also: [],
  },
  'income-fall-inferior': {
    text: 'a fall in incomes', note: INFERIOR, said: 'a fall in incomes for an inferior good', curve: 'demand', way: 1,
    why: 'With less to spend, buyers switch to cheaper goods, so they want more of an inferior good at every price.',
    also: [],
  },
  'substitute-price-rise': {
    text: 'a rise in the price of a substitute', said: 'a rise in the price of a substitute', curve: 'demand', way: 1,
    why: 'The substitute now costs more, so some buyers switch to this good instead.',
    also: ['substitute price rise', 'price of a substitute rises', 'higher price of a substitute', 'increase in the price of a substitute', 'substitute becomes more expensive', 'substitute becomes dearer'],
  },
  'substitute-price-fall': {
    text: 'a fall in the price of a substitute', said: 'a fall in the price of a substitute', curve: 'demand', way: -1,
    why: 'The substitute now costs less, so some buyers switch away from this good.',
    also: ['substitute price fall', 'price of a substitute falls', 'lower price of a substitute', 'decrease in the price of a substitute', 'substitute becomes cheaper'],
  },
  'complement-price-rise': {
    text: 'a rise in the price of a complement', said: 'a rise in the price of a complement', curve: 'demand', way: -1,
    why: 'The good bought with it now costs more, so buyers want less of the pair, this good included.',
    also: ['complement price rise', 'price of a complement rises', 'higher price of a complement', 'increase in the price of a complement', 'complement becomes more expensive', 'complement becomes dearer'],
  },
  'complement-price-fall': {
    text: 'a fall in the price of a complement', said: 'a fall in the price of a complement', curve: 'demand', way: 1,
    why: 'The good bought with it now costs less, so buyers want more of the pair, this good included.',
    also: ['complement price fall', 'price of a complement falls', 'lower price of a complement', 'decrease in the price of a complement', 'complement becomes cheaper'],
  },
  'advertising': {
    text: 'a successful advertising campaign', said: 'a successful advertising campaign', curve: 'demand', way: 1,
    why: 'More buyers hear of the good and want it, so more is demanded at every price.',
    also: ['advertising campaign', 'more advertising', 'successful advertising', 'increase in advertising', 'advertising'],
  },
  'tastes-for': {
    text: 'a change in tastes in favour of the good', said: 'a change in tastes in favour of the good', curve: 'demand', way: 1,
    why: 'The good has become more popular, so buyers want more of it at every price.',
    also: ['tastes for', 'tastes in favour', 'tastes in favor', 'change in tastes in favor of the good', 'change in tastes towards the good', 'becomes fashionable', 'becomes more fashionable', 'becomes more popular', 'good becomes fashionable', 'good becomes more popular'],
  },
  'tastes-against': {
    text: 'a change in tastes away from the good', said: 'a change in tastes away from the good', curve: 'demand', way: -1,
    why: 'The good has become less popular, so buyers want less of it at every price.',
    also: ['tastes against', 'tastes away', 'change in tastes against the good', 'goes out of fashion', 'out of fashion', 'becomes less popular', 'good goes out of fashion', 'good becomes less popular'],
  },
  'population-rise': {
    text: 'a rise in population', said: 'a rise in population', curve: 'demand', way: 1,
    why: 'There are more buyers, so more is demanded at every price.',
    also: ['population rise', 'population rises', 'population growth', 'increase in population', 'larger population', 'growing population'],
  },
  'population-fall': {
    text: 'a fall in population', said: 'a fall in population', curve: 'demand', way: -1,
    why: 'There are fewer buyers, so less is demanded at every price.',
    also: ['population fall', 'population falls', 'decrease in population', 'smaller population', 'shrinking population'],
  },
  'costs-rise': {
    text: 'a rise in costs of production', said: 'a rise in costs of production', curve: 'supply', way: -1,
    why: 'Each unit costs more to make, so firms supply less at every price.',
    also: ['rise in costs', 'costs rise', 'cost rise', 'higher costs', 'higher costs of production', 'increase in costs', 'increase in costs of production', 'rise in production costs', 'higher production costs', 'rise in cost of production', 'rise in the cost of raw materials', 'rise in the price of raw materials'],
  },
  'costs-fall': {
    text: 'a fall in costs of production', said: 'a fall in costs of production', curve: 'supply', way: 1,
    why: 'Each unit costs less to make, so firms supply more at every price.',
    also: ['fall in costs', 'costs fall', 'cost fall', 'lower costs', 'lower costs of production', 'decrease in costs', 'decrease in costs of production', 'fall in production costs', 'lower production costs', 'fall in cost of production', 'fall in the cost of raw materials', 'fall in the price of raw materials', 'cheaper raw materials'],
  },
  'technology': {
    text: 'an improvement in technology', said: 'an improvement in technology', curve: 'supply', way: 1,
    why: 'Firms can make more for the same cost, so they supply more at every price.',
    also: ['better technology', 'improved technology', 'new technology', 'technological improvement', 'technological advance', 'advance in technology', 'advances in technology', 'technology improves'],
  },
  'subsidy': {
    text: 'a subsidy to producers', said: 'a subsidy to producers', curve: 'supply', way: 1,
    why: 'The government pays firms for each unit, which lowers their costs, so they supply more at every price.',
    also: ['subsidy', 'producer subsidy', 'subsidy to firms', 'subsidy for producers', 'government subsidy', 'subsidy on the good'],
  },
  'indirect-tax': {
    text: 'an indirect tax on the good', said: 'an indirect tax on the good', curve: 'supply', way: -1,
    why: 'Firms must pay the government for each unit they sell, which raises their costs, so they supply less at every price.',
    also: ['indirect tax', 'tax on the good', 'new indirect tax', 'specific tax', 'sales tax', 'excise tax', 'excise duty', 'ad valorem tax', 'vat'],
  },
  'good-weather': {
    text: 'good weather for the harvest', said: 'good weather for the harvest', curve: 'supply', way: 1,
    why: 'The crop grows well, so farmers have more to sell at every price.',
    also: ['good weather', 'good harvest', 'bumper harvest', 'favourable weather', 'favorable weather'],
  },
  'bad-weather': {
    text: 'bad weather that damages the harvest', said: 'bad weather that damages the harvest', curve: 'supply', way: -1,
    why: 'Much of the crop is lost, so farmers have less to sell at every price.',
    also: ['bad weather', 'poor weather', 'poor harvest', 'bad harvest', 'drought', 'floods', 'bad weather damages the harvest'],
  },
  'more-firms': {
    text: 'more firms entering the market', said: 'more firms entering the market', curve: 'supply', way: 1,
    why: 'There are more sellers, so more is supplied at every price.',
    also: ['more firms', 'firms enter', 'firms enter the market', 'new firms enter the market', 'entry of new firms', 'more producers', 'increase in the number of firms'],
  },
  'fewer-firms': {
    text: 'firms leaving the market', said: 'firms leaving the market', curve: 'supply', way: -1,
    why: 'There are fewer sellers, so less is supplied at every price.',
    also: ['fewer firms', 'firms leave', 'firms leave the market', 'firms exit', 'firms exit the market', 'fewer producers', 'decrease in the number of firms'],
  },
} satisfies Record<string, MarketEvent>

export type EventId = keyof typeof EVENTS
export const EVENT_IDS = Object.keys(EVENTS) as EventId[]
export const eventOf = (id: EventId): MarketEvent => EVENTS[id]

/** The event said back to a learner who made this shift: the plainest one that does it. */
const EXAMPLE: Record<Curve, Record<'1' | '-1', EventId>> = {
  demand: { '1': 'income-rise', '-1': 'income-fall' },
  supply: { '1': 'technology', '-1': 'costs-rise' },
}

export const CONTROLS = ['maximum', 'minimum'] as const
export type Control = (typeof CONTROLS)[number]
export const SIDES = ['below', 'above'] as const
export type Side = (typeof SIDES)[number]
export const ANSWERS = ['shortage', 'surplus', 'none'] as const
export type Answer = (typeof ANSWERS)[number]

export type ShiftTask = { kind: 'shift'; event: EventId }
export type ControlTask = { kind: 'price-control'; control: Control; side: Side; by: (typeof BY)[number] }
export type SupplyDemandConfig = { task: ShiftTask | ControlTask }
/**
 * shift: how far each curve has been moved, in units of quantity (right is
 * positive), in notches of 2 from -4 to 4.
 * price-control: where the learner has set the price line, in whole dollars;
 * what they say happens there; and how big, in units.
 */
export type SupplyDemandState = { demand?: number; supply?: number; price?: number; answer?: Answer | null; size?: number }

// ---------------------------------------------------------------------------
// The market, worked out exactly.

/** How much buyers want at a price, with demand moved `d` units. */
export const quantityDemanded = (price: number, d = 0) => DEMAND_TOP + d - price
/** How much sellers offer at a price, with supply moved `s` units. */
export const quantitySupplied = (price: number, s = 0) => price - SUPPLY_FOOT + s

/** Where the curves cross, with demand moved `d` and supply `s` (each a whole number of notches). */
export function equilibrium(d = 0, s = 0): { price: number; quantity: number } {
  const quantity = (DEMAND_TOP - SUPPLY_FOOT + d + s) / 2
  return { price: SUPPLY_FOOT - s + quantity, quantity }
}

/** The equilibrium before anything changes: a price of $6 and a quantity of 5. */
export const BASE = equilibrium()

/** A shift read from state: a whole notch from -4 to 4, 0 when absent, null when it is not one. */
export function readShift(raw: unknown): number | null {
  if (raw === undefined || raw === null) return 0
  if (typeof raw !== 'number' || !Number.isInteger(raw) || raw % NOTCH !== 0 || Math.abs(raw) > MAX_SHIFT) return null
  return raw + 0
}

/** A price line read from state: a whole dollar on the grid, or null. */
export function readPrice(raw: unknown): number | null {
  return typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 && raw <= MAX ? raw + 0 : null
}

/** The price a control sets: its distance from the equilibrium price, on its side. */
export function controlPrice(task: ControlTask): number {
  return BASE.price + (task.side === 'above' ? task.by : -task.by)
}

/**
 * What a price control does. A maximum price binds only below the
 * equilibrium price, and a minimum price only above it; one that does not
 * bind leaves the market at its equilibrium, with no shortage or surplus.
 */
export function controlOutcome(task: ControlTask): { price: number; binds: boolean; answer: Answer; size: number; demanded: number; supplied: number } {
  const price = controlPrice(task)
  const binds = task.control === 'maximum' ? price < BASE.price : price > BASE.price
  const demanded = quantityDemanded(price)
  const supplied = quantitySupplied(price)
  if (!binds) return { price, binds, answer: 'none', size: 0, demanded, supplied }
  return demanded > supplied
    ? { price, binds, answer: 'shortage', size: demanded - supplied, demanded, supplied }
    : { price, binds, answer: 'surplus', size: supplied - demanded, demanded, supplied }
}

// ---------------------------------------------------------------------------
// In words: what the learner made, and once marked, why.

const units = (n: number) => `${n} ${n === 1 ? 'unit' : 'units'}`
const dollars = (n: number) => `$${n}`
export const sentenceCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const sideOf = (shift: number) => (shift > 0 ? 'to the right' : 'to the left')

/** "demand to the right", "supply to the left". */
export function shiftWords(curve: Curve, shift: number): string {
  return `${curve} ${sideOf(shift)}`
}

/** "The price rises from $6 to $7, and the quantity rises from 5 to 6." */
export function changeWords(d: number, s: number): string {
  const a = BASE
  const b = equilibrium(d, s)
  const move = (what: string, from: number, to: number, show: (n: number) => string) =>
    from === to ? `the ${what} stays at ${show(from)}` : `the ${what} ${to > from ? 'rises' : 'falls'} from ${show(from)} to ${show(to)}`
  return `${sentenceCase(move('price', a.price, b.price, dollars))}, and ${move('quantity', a.quantity, b.quantity, String)}.`
}

/** shift, marked wrong: what the learner did, and what it is the effect of -- never which curve the event moves. */
export function madeShift(config: SupplyDemandConfig, state: SupplyDemandState | null | undefined): string {
  if (config.task.kind !== 'shift') return ''
  const asked = EVENTS[config.task.event]
  const d = readShift(state?.demand)
  const s = readShift(state?.supply)
  if (d === null || s === null) return 'Move a curve by dragging it sideways, or Tab to it and use the arrow keys.'
  if (d === 0 && s === 0) return 'You have not moved either curve yet: drag one sideways, or Tab to it and use the arrow keys.'
  if (d !== 0 && s !== 0) {
    return `You shifted ${shiftWords('demand', d)} and ${shiftWords('supply', s)}: ${asked.said} moves one curve, not both.`
  }
  const curve: Curve = d !== 0 ? 'demand' : 'supply'
  const shift = d !== 0 ? d : s
  const example = EVENTS[EXAMPLE[curve][shift > 0 ? '1' : '-1']]
  return `You shifted ${shiftWords(curve, shift)}: that is what ${example.said} does, not ${asked.said}.`
}

/** shift, marked right or shown: the curve, the way, why, and what it does to price and quantity. */
export function namedShift(config: SupplyDemandConfig, state: SupplyDemandState | null | undefined): string {
  if (config.task.kind !== 'shift') return ''
  const e = EVENTS[config.task.event]
  const d = readShift(state?.demand) ?? 0
  const s = readShift(state?.supply) ?? 0
  const change = d === 0 && s === 0 ? '' : ` ${changeWords(d, s)}`
  return `${sentenceCase(e.curve)} shifts ${e.way > 0 ? 'to the right, an increase' : 'to the left, a decrease'} in ${e.curve}. ${e.why}${change}`
}

/** price-control, marked wrong: what the learner set or said, never what happens. */
export function madeControl(config: SupplyDemandConfig, state: SupplyDemandState | null | undefined): string {
  if (config.task.kind !== 'price-control') return ''
  const task = config.task
  const level = controlPrice(task)
  const price = readPrice(state?.price)
  if (price !== level) {
    return `You set the ${task.control} price at ${price === null ? 'no price' : dollars(price)}, not ${dollars(level)}: move the line to ${dollars(level)} first.`
  }
  const answer = state?.answer
  if (answer !== 'shortage' && answer !== 'surplus' && answer !== 'none') {
    return `Say what happens with the ${task.control} price at ${dollars(level)} first: a shortage, a surplus, or neither.`
  }
  const right = controlOutcome(task)
  const size = typeof state?.size === 'number' ? state.size : 0
  if (answer === 'none') return 'You said neither: that is when the market can still settle where demand meets supply.'
  if (size < 1) return `You said a ${answer}: say how big it is too, in units.`
  if (answer === right.answer && size !== right.size) {
    return `You said a ${answer} of ${units(size)}, but the gap between the curves at ${dollars(level)} is not ${size}: read down from where the line meets each curve to the quantity axis, and take the smaller from the larger.`
  }
  return answer === 'shortage'
    ? `You said a shortage of ${units(size)}: that means buyers want ${size} more than sellers offer, at the price the market ends up at.`
    : `You said a surplus of ${units(size)}: that means sellers offer ${size} more than buyers want, at the price the market ends up at.`
}

/** price-control, marked right or shown: what the control does, and why. */
export function namedControl(config: SupplyDemandConfig): string {
  if (config.task.kind !== 'price-control') return ''
  const task = config.task
  const o = controlOutcome(task)
  const name = `A ${task.control} price of ${dollars(o.price)}`
  const where = `${task.side} the equilibrium price of ${dollars(BASE.price)}`
  if (!o.binds) {
    return `${name} is ${where}, so it does not bind: the price stays at ${dollars(BASE.price)}, where buyers want ${BASE.quantity} and sellers offer ${BASE.quantity}. There is no shortage or surplus.`
  }
  return o.answer === 'shortage'
    ? `${name} is ${where}. At ${dollars(o.price)} buyers want ${o.demanded} but sellers offer only ${o.supplied}: a shortage, or excess demand, of ${units(o.size)}.`
    : `${name} is ${where}. At ${dollars(o.price)} sellers offer ${o.supplied} but buyers want only ${o.demanded}: a surplus, or excess supply, of ${units(o.size)}.`
}

// ---------------------------------------------------------------------------
// Reading what the tutor writes.

/** Lower case, words only, with the articles dropped: "A rise in the price of a substitute" -> "rise in price of substitute". */
export function plain(raw: string): string {
  return raw
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((w) => w && w !== 'a' && w !== 'an' && w !== 'the')
    .join(' ')
}

/**
 * Every phrase that names each event, plain, each owned by the first event to
 * use it: "a rise in incomes" is the normal good's, and its inferior twin is
 * reached through the word "inferior".
 */
const PHRASE_OF = new Map<string, EventId>()
for (const id of EVENT_IDS) {
  for (const p of [id.replace(/-/g, ' '), EVENTS[id].text, EVENTS[id].said, ...EVENTS[id].also]) {
    if (!PHRASE_OF.has(plain(p))) PHRASE_OF.set(plain(p), id)
  }
}
/** The phrases that name an event inside a prompt: those of two words or more, as one word alone ("technology") says too little. */
const PROMPT_PHRASES = [...PHRASE_OF].filter(([p]) => p.includes(' '))

const INFERIOR_TWIN: Partial<Record<EventId, EventId>> = { 'income-rise': 'income-rise-inferior', 'income-fall': 'income-fall-inferior' }

/** An event however it is reasonably written; null for one the engine does not know or that is not a shift. */
export function readEvent(raw: unknown): EventId | null {
  if (typeof raw !== 'string') return null
  let p = plain(raw)
  if (PHRASE_OF.has(p)) return PHRASE_OF.get(p)!
  // "A rise in incomes (an inferior good)", "income rise, normal good".
  const inferior = /\binferior\b/.test(p)
  const normal = /\bnormal\b/.test(p)
  if (inferior === normal) return null
  p = p.replace(/\b(for |it is |which is |of )?(inferior|normal)( good)?\b/g, ' ').replace(/\s+/g, ' ').trim()
  const base = PHRASE_OF.get(p)
  if (!base) return null
  if (normal) return INFERIOR_TWIN[base] ? base : null
  return INFERIOR_TWIN[base] ?? null
}

function readKind(raw: unknown): 'shift' | 'price-control' | Control | null {
  if (typeof raw !== 'string') return null
  const k = plain(raw)
  if (['shift', 'shift curve', 'shift curves', 'shift a curve', 'event'].includes(k)) return 'shift'
  if (['price control', 'price controls', 'control'].includes(k)) return 'price-control'
  if (['maximum price', 'max price', 'price ceiling'].includes(k)) return 'maximum'
  if (['minimum price', 'min price', 'price floor'].includes(k)) return 'minimum'
  return null
}

function readControl(raw: unknown): Control | null {
  if (typeof raw !== 'string') return null
  const k = plain(raw)
  if (['maximum', 'max', 'maximum price', 'max price', 'price ceiling', 'ceiling'].includes(k)) return 'maximum'
  if (['minimum', 'min', 'minimum price', 'min price', 'price floor', 'floor'].includes(k)) return 'minimum'
  return null
}

function readSide(raw: unknown): Side | null {
  if (typeof raw !== 'string') return null
  const k = plain(raw).replace(/\b(equilibrium|price|market|equilibrium price)\b/g, '').trim()
  if (k === 'below' || k === 'under' || k === 'beneath') return 'below'
  if (k === 'above' || k === 'over') return 'above'
  return null
}

/** How far from the equilibrium price: 1, 2 or 3 dollars ("2", "$2", 2); 2 when it is not said. */
function readBy(raw: unknown): ControlTask['by'] | null {
  if (raw === undefined || raw === null) return 2
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' && /^\s*\$?\s*\d+\s*$/.test(raw) ? Number(raw.replace(/[$\s]/g, '')) : NaN
  return (BY as readonly number[]).includes(n) ? (n as ControlTask['by']) : null
}

const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)

// ---------------------------------------------------------------------------
// The card's prompt.

/** The events a prompt names, by their phrases; an income phrase stands for both twins unless the good is named. */
export function eventsIn(prompt: string): Set<EventId> {
  const text = ` ${plain(prompt)} `
  const found = new Set<EventId>()
  for (const [p, id] of PROMPT_PHRASES) if (text.includes(` ${p} `)) found.add(id)
  const inferior = /\binferior\b/.test(text)
  const normal = /\bnormal good\b/.test(text)
  for (const [base, twin] of Object.entries(INFERIOR_TWIN) as [EventId, EventId][]) {
    if (!found.has(base)) continue
    if (!normal || inferior) found.add(twin)
    if (inferior && !normal) found.delete(base)
  }
  return found
}

/** Which curve and which way a shift prompt gives away, as the words it uses. */
function shiftGiveaway(prompt: string): string | null {
  const text = prompt.toLowerCase().replace(/[‐-―]/g, '-').replace(/\s+/g, ' ')
  // "demand and supply" names no one curve.
  const named = text.replace(/\b(demand|supply)(-| )and(-| )(supply|demand)\b/g, ' ')
  const curve = /\b(demand|supply)\b/.exec(named) ?? /\b(the )?[ds][12]? curve\b|\bcurve [ds][12]?\b/.exec(named)
  if (curve) return curve[0].trim()
  const way = /\bto the (left|right)\b|\b(left|right)-?wards?\b|\b(in|out)wards?\b|\b(shift|move|drag|push|slide)\w*( \w+){0,3} (left|right|up|down|upwards|downwards)\b/.exec(text)
  return way ? way[0].trim() : null
}

/** Why a card's prompt would give away what the scene keeps hidden until it is marked, or contradict the scene. */
export function promptFaults(config: SupplyDemandConfig, prompt: string): string[] {
  const out: string[] = []
  const text = prompt.toLowerCase().replace(/\s+/g, ' ')
  if (config.task.kind === 'shift') {
    const giveaway = shiftGiveaway(prompt)
    if (giveaway) {
      out.push(`the prompt gives the answer away: it says "${giveaway}", which tells the learner which curve moves or which way -- the scene shows the event, so ask without it ("What does this event do to the market? Shift the curve it moves.")`)
    }
    const asked = EVENTS[config.task.event]
    const named = [...eventsIn(prompt)]
    const other = named.find((id) => EVENTS[id].curve !== asked.curve || EVENTS[id].way !== asked.way)
    if (other && !named.includes(config.task.event)) {
      out.push(`the prompt names ${EVENTS[other].said}, but the scene's event is ${asked.said}: name the same event, or leave it to the scene`)
    }
    return out
  }
  const task = config.task
  const said = /\b(shortages?|surplus(es)?|excess (demand|supply)|no effect|(non|not)[- ]?binding|binding|binds?|does not bind|doesn'?t bind|stays? at|unchanged)\b/.exec(text)
  if (said) {
    out.push(`the prompt gives the answer away: it says "${said[0]}", which the learner is to work out from the diagram -- ask what happens at that price, and how much ("Set the line there, then say what happens and by how much.")`)
  }
  const other: Control = task.control === 'maximum' ? 'minimum' : 'maximum'
  const otherWords = other === 'maximum' ? /\b(maximum|max|ceiling)\b/ : /\b(minimum|min|floor)\b/
  const ownWords = task.control === 'maximum' ? /\b(maximum|max|ceiling)\b/ : /\b(minimum|min|floor)\b/
  if (otherWords.test(text) && !ownWords.test(text)) {
    out.push(`the prompt names a ${other} price, but the scene sets a ${task.control} price: write "${task.control} price", or set "control" to "${other}"`)
  }
  const level = controlPrice(task)
  for (const m of text.matchAll(/\$\s?(\d+(?:\.\d+)?)/g)) {
    if (Number(m[1]) !== level) {
      out.push(`the prompt names $${m[1]}, but the scene's ${task.control} price is $${level}: leave the price to the scene, or write $${level}`)
      break
    }
  }
  const side = /\b(above|below|under|over)( the)? (equilibrium|market)/.exec(text)
  if (side) {
    const says: Side = side[1] === 'above' || side[1] === 'over' ? 'above' : 'below'
    if (says !== task.side) out.push(`the prompt says the price is ${says} the equilibrium, but the scene sets it ${task.side}: make them agree`)
  }
  return out
}

// ---------------------------------------------------------------------------

export const supplyDemandEngine: SceneEngine<SupplyDemandConfig, SupplyDemandState> & { promptFaults(config: SupplyDemandConfig, prompt: string): string[] } = {
  id: 'supply-demand',
  covers: [
    'demand and supply', 'shifts in demand and supply', 'price determination', 'disequilibrium',
    'shortages and surpluses', 'maximum and minimum prices', 'indirect taxes and subsidies',
  ],
  isolates: 'consequence',

  parse(raw) {
    const task = (raw as { task?: unknown } | null)?.task
    if (!task || typeof task !== 'object') return null
    const t = task as Record<string, unknown>
    const kind = readKind(t.kind)
    if (kind === 'shift') {
      const event = readEvent(first(t, ['event', 'change', 'cause']))
      return event ? { task: { kind: 'shift', event } } : null
    }
    if (kind === 'price-control' || kind === 'maximum' || kind === 'minimum') {
      const control = kind === 'price-control' ? readControl(first(t, ['control', 'type', 'price'])) : kind
      const side = readSide(first(t, ['side', 'where', 'relative', 'position']))
      const by = readBy(first(t, ['by', 'distance', 'gap']))
      if (!control || !side || by === null) return null
      return { task: { kind: 'price-control', control, side, by } }
    }
    return null
  },

  // Every event the engine knows moves one curve one way, and every price
  // control sits on the grid, a whole dollar or more from the equilibrium:
  // anything parse reads is solvable and starts unsolved (the tests enumerate them all).
  faults() {
    return []
  },

  promptFaults,

  initial(config) {
    if (config.task.kind === 'shift') return { demand: 0, supply: 0 }
    // The line starts at the equilibrium price, where nothing is short or left over.
    return { price: BASE.price, answer: null, size: 0 }
  },

  check(config, state) {
    if (config.task.kind === 'shift') {
      const { curve, way } = EVENTS[config.task.event]
      const d = readShift(state?.demand)
      const s = readShift(state?.supply)
      if (d === null || s === null) return { ok: false, wrongIds: [] }
      const mine = curve === 'demand' ? d : s
      const theirs = curve === 'demand' ? s : d
      const wrongIds = [
        ...(Math.sign(mine) !== way && mine !== 0 ? [curve] : []),
        ...(theirs !== 0 ? [curve === 'demand' ? 'supply' : 'demand'] : []),
      ]
      return { ok: Math.sign(mine) === way && Math.abs(mine) >= MIN_SHIFT && theirs === 0, wrongIds }
    }
    const o = controlOutcome(config.task)
    const price = readPrice(state?.price)
    const sizeOk = o.answer === 'none' || state?.size === o.size
    return { ok: price === o.price && state?.answer === o.answer && sizeOk, wrongIds: [] }
  },

  solve(config) {
    if (config.task.kind === 'shift') {
      const { curve, way } = EVENTS[config.task.event]
      return curve === 'demand' ? { demand: way * MAX_SHIFT, supply: 0 } : { demand: 0, supply: way * MAX_SHIFT }
    }
    const o = controlOutcome(config.task)
    return { price: o.price, answer: o.answer, size: o.size }
  },

  View: SupplyDemandView,

  prompt: `SCENE "supply-demand" -- a market diagram: price ($) up the side, quantity along the bottom, a straight
  demand curve D and supply curve S crossing at a price of $6 and a quantity of 5. The engine works out every
  equilibrium, shortage and surplus exactly. For: demand and supply, the conditions of demand and supply, shifts in
  demand and supply, price determination, shortages and surpluses, maximum and minimum prices (IGCSE 0455, AS 9708).
  config: { "task": { "kind":"shift", "event":"<event>" } }  -- the scene shows the event; the learner drags the
            curve it moves sideways (or uses the arrow keys) and sees the new equilibrium, price and quantity.
            Marked on the right curve, moved the right way, with the other left alone.
            event: income-rise | income-fall (a normal good) | income-rise-inferior | income-fall-inferior (AS) |
              substitute-price-rise | substitute-price-fall | complement-price-rise | complement-price-fall |
              advertising | tastes-for | tastes-against | population-rise | population-fall |
              costs-rise | costs-fall | technology | subsidy | indirect-tax | good-weather | bad-weather |
              more-firms | fewer-firms
            The prompt must NOT say which curve moves or which way (no "demand", "supply", "left", "right").
       or { "task": { "kind":"price-control", "control":"<maximum | minimum>", "side":"<below | above>", "by":<1 | 2 | 3> } }
            -- the scene shows the government's price, "by" dollars (default 2) from the $6 equilibrium; the learner
            sets the price line there, then says shortage, surplus or neither, and how many units, read off the
            diagram. A maximum price above equilibrium (or a minimum below it) does not bind: a good test.
            The prompt must NOT say shortage, surplus, excess demand or excess supply.
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"What does this event do to the market? Shift the curve it moves.",
    "payload": { "engine":"supply-demand", "config": { "task": { "kind":"shift", "event":"costs-rise" } } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:supply-demand", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"The government sets this price. Set the line there, then say what happens and by how much.",
    "payload": { "engine":"supply-demand", "config": { "task": { "kind":"price-control", "control":"maximum", "side":"below", "by":2 } } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:supply-demand", "why":"..." } }`,
}

registerEngine(supplyDemandEngine as SceneEngine<unknown, unknown>)
