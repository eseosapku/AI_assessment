// lib/studylab/engines/thermal-transfer/config.ts
//
// Heat on the move, with the real apparatus of the school bench. Two tasks, each one thing to handle:
//   beads -- the wax-and-rod test. Rods of different metals stand in a bath of boiling water, each with a ball bearing
//            stuck on by a dab of wax. The learner slides each ball along its rod so that every wax dab melts at
//            the same moment. The rods colour as the heat creeps along; each ball drops when its wax lets go.
//   wrap  -- a cup of hot water, or of cold, beside a thermometer. The learner dresses the cup (layers of wool, a lid,
//            shiny foil) so that it holds its temperature, with as few parts as they can. Orange arrows show the three
//            ways heat leaves a hot cup, or enters a cold one: through the wall (conduction), over the top
//            (convection) and as rays (radiation), each thickening and thinning with what the learner has done.
//
// The rules, all computed here and never read from the drawing.
//   beads: a rod end held at the bath's temperature, a bead of wax melting at a fixed temperature, so a bead at x
//          cm melts after t = x^2 / (K a), where a is the metal's thermal diffusivity (the 1-D heat equation, a
//          semi-infinite rod; the wax-melt fraction 0.5 gives K = (2 * 0.4769)^2 = 0.9099). The beads "drop together"
//          when the slowest is no more than 10% later than the quickest, compared in whole numbers (x^2 over a).
//   wrap:  Newton's cooling: the gap between water and room shrinks as exp(-L t). The three ways out are parallel, so
//          their rates add: wall L1 = 210 / (1 + 2 wool), top L2 = 180 (30 with a lid), rays L3 = 70 (14 under foil),
//          per 10 000 minutes. A bare cup then halves its gap in 15 minutes, about a mug of tea. Wool layers add
//          resistance in series, so the wall rate falls as 1 / (1 + 2n).
//
// Facts and where they come from:
//   - thermal diffusivities, in 1e-6 m^2/s: copper 111, aluminium 97, brass 34, iron 23 (rounded textbook values, e.g.
//     Incropera and DeWitt, Fundamentals of Heat and Mass Transfer, appendix A). Written from general knowledge of those
//     tables, not checked against a specification in this build;
//   - wax drops from rods heated at one end: Ingen-Housz (1789), after Franklin's suggestion. The order he found, silver and
//     copper first, then tin, iron and lead last, is the same order as here for the metals this card uses. The rods are
//     taken as long, thin and lagged, which the real test only approximates;
//   - metal feels colder than wood at the same temperature because it carries heat out of a warmer hand faster: Erickson
//     (UBC, 1985) had students see it with a thermal camera; the two-way version, with ice, is on the Institute for
//     Future Intelligence's conduction page.
// The magnitudes of the wrap task are teaching values chosen to match a beaker on a bench, not measurements.
//
// Ideas taken, never code or art:
//   - the learner as the experimenter who sets up the test and then watches it run, and a clock they can wind back: the
//     PhET heat-transfer lessons (Energy Forms and Changes) where students design the investigation;
//   - the same wrapping working both ways: the ice-cube half of the metal-and-wood ruler test, which shows heat moving
//     faster through metal in both directions. Hence a cold cup: insulation does not keep the cold in, it slows the
//     heat getting in;
//   - Ingen-Housz's rods, made into a puzzle: the beads that fall together.
// Refused:
//   - a "which is the better conductor" pick list, which is recognition, and a vacuum flask built part by part, whose
//     three gaps would be three more buttons;
//   - ice cubes in the cold cup, which hold the water at 0 degrees until they melt and so would break the maths;
//   - wood and glass rods: their diffusivities are 100 times smaller than a metal's, so no bead on the same rod
//     length can be made to drop with them.

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { ThermalTransferView } from './View'

// ---------------------------------------------------------------------------
// The rods.

export const MATERIALS = ['aluminium', 'brass', 'copper', 'iron'] as const
export type MaterialName = (typeof MATERIALS)[number]
/** Thermal diffusivity, 1e-6 m^2/s. */
export const DIFFUSIVITY: Record<MaterialName, number> = { aluminium: 97, brass: 34, copper: 111, iron: 23 }
export const ROD_MIN = 2
export const ROD_MAX = 3
/** Beads sit on whole centimetres from the bath, on a rod 15 cm long. */
export const BEAD_MIN = 1
export const BEAD_MAX = 14
export const BEAD_START = 7
export const ROD_CM = 15
/** Wax melts (60 C) when a rod end held at 100 C has warmed a point from 20 C to half way: 2 * erfc^-1(0.5) squared. */
export const MELT_K = 0.9099
/** "Together" means the last is at most 11/10 of the first. */
export const TOGETHER = { num: 11, den: 10 }
/** Two rods whose diffusivity differs by less than this ratio would give the same answer: refused. */
export const MIN_SPREAD = 1.4

export type BeadsConfig = { task: 'beads'; rods: string[] }

const has = (o: object, k: string | number) => Object.prototype.hasOwnProperty.call(o, k)
const isMaterial = (m: string): m is MaterialName => has(DIFFUSIVITY, m)

/** Seconds for the wax at x cm to melt, on a rod of this metal. */
export function dropSeconds(x: number, material: string): number {
  const a = isMaterial(material) ? DIFFUSIVITY[material] : DIFFUSIVITY.iron
  return (x / 100) ** 2 / (MELT_K * a * 1e-6)
}

/** The bath's reach at x cm after t seconds, as a fraction of its excess over the rod's start (1 at the bath, 0 far off). */
export function heatFraction(x: number, material: string, t: number): number {
  if (t <= 0) return x <= 0 ? 1 : 0
  const a = isMaterial(material) ? DIFFUSIVITY[material] : DIFFUSIVITY.iron
  return erfc(x / 100 / (2 * Math.sqrt(a * 1e-6 * t)))
}

/** Abramowitz and Stegun 7.1.26, good to 1.5e-7: for the colours only, never for marking. */
export function erfc(z: number): number {
  const s = z < 0 ? -1 : 1
  const x = Math.abs(z)
  const k = 1 / (1 + 0.3275911 * x)
  const poly = k * (0.254829592 + k * (-0.284496736 + k * (1.421413741 + k * (-1.453152027 + k * 1.061405429))))
  const erf = 1 - poly * Math.exp(-x * x)
  return 1 - s * erf
}

export const clampBead = (n: unknown): number => (typeof n === 'number' && Number.isFinite(n) ? Math.max(BEAD_MIN, Math.min(BEAD_MAX, Math.round(n))) : BEAD_START)

/** Where each bead sits, one for each rod, whatever the state holds. */
export function beadsOf(config: BeadsConfig, state: ThermalState): Record<string, number> {
  const out: Record<string, number> = {}
  for (const r of config.rods) out[r] = clampBead(state?.beads?.[r])
  return out
}

/** Every pair of beads falls within the tolerance of each other, by whole-number cross products of x^2 and a. */
export function together(rods: string[], at: Record<string, number>): boolean {
  for (const p of rods) {
    for (const q of rods) {
      if (p === q) continue
      const ap = isMaterial(p) ? DIFFUSIVITY[p] : 1
      const aq = isMaterial(q) ? DIFFUSIVITY[q] : 1
      // time(p) <= tolerance * time(q): x_p^2 / a_p <= (num/den) * x_q^2 / a_q
      if (TOGETHER.den * at[p] ** 2 * aq > TOGETHER.num * at[q] ** 2 * ap) return false
    }
  }
  return true
}

/** The positions with the smallest spread of drop times, found by trying every one. */
const bestMemo = new Map<string, Record<string, number>>()
export function bestBeads(rods: string[]): Record<string, number> {
  const key = rods.join(',')
  const known = bestMemo.get(key)
  if (known) return { ...known }
  let best: Record<string, number> | null = null
  let bestSpread = Infinity
  const at: Record<string, number> = {}
  const go = (i: number) => {
    if (i === rods.length) {
      const times = rods.map((r) => dropSeconds(at[r], r))
      const spread = Math.max(...times) / Math.min(...times)
      if (spread < bestSpread - 1e-9) {
        bestSpread = spread
        best = { ...at }
      }
      return
    }
    for (let x = BEAD_MIN; x <= BEAD_MAX; x++) {
      at[rods[i]] = x
      go(i + 1)
    }
  }
  go(0)
  const found = best ?? Object.fromEntries(rods.map((r) => [r, BEAD_START]))
  bestMemo.set(key, found)
  return { ...found }
}

/** The longest any bead on these rods could take, rounded up to the half minute: the end of the clock. */
export function horizonOf(rods: string[]): number {
  const longest = Math.max(...rods.map((r) => dropSeconds(BEAD_MAX, r)))
  return Math.ceil(longest / 30) * 30
}

/** m:ss, for a clock. */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

// ---------------------------------------------------------------------------
// The cup.

export const PARTS = ['wool', 'lid', 'foil'] as const
export type PartName = (typeof PARTS)[number]
export const DRINKS = ['hot', 'cold'] as const
export type DrinkName = (typeof DRINKS)[number]
export const WOOL_MAX = 3
export const ROOM = 20
export const START: Record<DrinkName, number> = { hot: 80, cold: 5 }
/** Loss rates per 10 000 minutes of a bare cup: through the wall, over the open top, as rays. */
export const LOSS = { wall: 210, top: 180, rays: 70 }
export const LID_TOP = 30
export const FOIL_RAYS = 14
export const MINUTES_MIN = 10
export const MINUTES_MAX = 60
export const TARGETS: Record<DrinkName, { min: number; max: number }> = { hot: { min: 30, max: 75 }, cold: { min: 6, max: 15 } }

export type WrapConfig = { task: 'wrap'; drink: string; minutes: number; target: number; parts: string[] }
export type ThermalConfig = BeadsConfig | WrapConfig
/** What the learner has done: bead positions by rod, or the cup's wrapping. */
export type ThermalState = { beads?: Record<string, number>; wool?: number; lid?: boolean; foil?: boolean }
export type Wrapping = { wool: number; lid: boolean; foil: boolean }

const isDrink = (d: string): d is DrinkName => d === 'hot' || d === 'cold'
const isPart = (p: string): p is PartName => (PARTS as readonly string[]).includes(p)

/** The wrapping the state holds, limited to the parts the card offers. */
export function wrappingOf(config: WrapConfig, state: ThermalState): Wrapping {
  const w = typeof state?.wool === 'number' && Number.isFinite(state.wool) ? Math.max(0, Math.min(WOOL_MAX, Math.round(state.wool))) : 0
  return {
    wool: config.parts.includes('wool') ? w : 0,
    lid: config.parts.includes('lid') && state?.lid === true,
    foil: config.parts.includes('foil') && state?.foil === true,
  }
}

export const partsUsed = (w: Wrapping) => w.wool + (w.lid ? 1 : 0) + (w.foil ? 1 : 0)

/** The three rates, per 10 000 minutes. */
export function lossOf(w: Wrapping): { wall: number; top: number; rays: number; all: number } {
  const wall = LOSS.wall / (1 + 2 * w.wool)
  const top = w.lid ? LID_TOP : LOSS.top
  const rays = w.foil ? FOIL_RAYS : LOSS.rays
  return { wall, top, rays, all: wall + top + rays }
}

const drinkOf = (config: WrapConfig): DrinkName => (isDrink(config.drink) ? config.drink : 'hot')

/** The temperature after t minutes: the gap to the room shrinks by exp(-L t). */
export function tempAt(config: WrapConfig, w: Wrapping, t: number): number {
  const start = START[drinkOf(config)]
  return ROOM + (start - ROOM) * Math.exp((-lossOf(w).all * t) / 10000)
}

/** What the thermometer reads at the end, to the tenth: marking uses what the learner sees, so a card never reads 50.0 and fails. */
export const readingAt = (config: WrapConfig, w: Wrapping): number => Math.round(tempAt(config, w, config.minutes) * 10) / 10

/** Hot: the water is still at or above the target at the end. Cold: still at or below it. */
export const holds = (config: WrapConfig, w: Wrapping): boolean => (drinkOf(config) === 'hot' ? readingAt(config, w) >= config.target : readingAt(config, w) <= config.target)

/** Every wrapping the card allows. */
export function wrappings(config: WrapConfig): Wrapping[] {
  const out: Wrapping[] = []
  const wools = config.parts.includes('wool') ? WOOL_MAX : 0
  for (let wool = 0; wool <= wools; wool++) {
    for (const lid of config.parts.includes('lid') ? [false, true] : [false]) {
      for (const foil of config.parts.includes('foil') ? [false, true] : [false]) out.push({ wool, lid, foil })
    }
  }
  return out
}

/** The fewest parts that hold, or null when nothing does. */
export function fewestParts(config: WrapConfig): number | null {
  const ok = wrappings(config).filter((w) => holds(config, w)).map(partsUsed)
  return ok.length ? Math.min(...ok) : null
}

/** A wrapping that holds with the fewest parts: the one the card shows when it shows the answer. */
export function bestWrapping(config: WrapConfig): Wrapping {
  const least = fewestParts(config)
  return wrappings(config).find((w) => holds(config, w) && partsUsed(w) === least) ?? { wool: 0, lid: false, foil: false }
}

export const BARE: Wrapping = { wool: 0, lid: false, foil: false }

// ---------------------------------------------------------------------------
// Marking: from the rules, always.

export function done(config: ThermalConfig, state: ThermalState): boolean {
  if (config.task === 'beads') return together(config.rods, beadsOf(config, state))
  const w = wrappingOf(config, state)
  return holds(config, w) && partsUsed(w) === fewestParts(config)
}

// ---------------------------------------------------------------------------
// What is said once marked. Before that the card holds no verdict at all.

const say = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

const PHRASE: Record<PartName, string> = { wool: 'wool', lid: 'lid', foil: 'foil' }
function listParts(w: Wrapping): string {
  const out: string[] = []
  if (w.wool) out.push(say(w.wool, 'layer of wool', 'layers of wool'))
  if (w.lid) out.push(`a ${PHRASE.lid}`)
  if (w.foil) out.push(`shiny ${PHRASE.foil}`)
  if (out.length < 2) return out[0] ?? 'nothing'
  return `${out.slice(0, -1).join(', ')} and ${out[out.length - 1]}`
}

export const degrees = (t: number) => `${t.toFixed(1)} °C`

/** What a correct card says: what the learner found, and the misconception it answers. */
export function working(config: ThermalConfig, state: ThermalState): string {
  if (config.task === 'beads') {
    const at = beadsOf(config, state)
    const times = config.rods.map((r) => dropSeconds(at[r], r))
    const quick = [...config.rods].sort((a, b) => DIFFUSIVITY[b as MaterialName] - DIFFUSIVITY[a as MaterialName])[0]
    const slow = [...config.rods].sort((a, b) => DIFFUSIVITY[a as MaterialName] - DIFFUSIVITY[b as MaterialName])[0]
    const mean = times.reduce((a, b) => a + b, 0) / times.length
    return `Yes. The wax let go at about ${clock(mean)} on every rod. The ${quick} bead sits ${at[quick]} cm from the bath and the ${slow} bead only ${at[slow]} cm: heat runs along ${quick} much faster than along ${slow}, so it has to be farther along to take the same time. Metals are good conductors, which is also why a metal rail feels colder than wood at the same temperature: it carries heat out of your hand faster.`
  }
  const w = wrappingOf(config, state)
  const d = drinkOf(config)
  const t = tempAt(config, w, config.minutes)
  const why: string[] = []
  if (w.wool) why.push('wool slows conduction through the wall')
  if (w.lid) why.push('the lid slows convection over the top')
  if (w.foil) why.push('foil reflects radiation')
  const idea = d === 'cold'
    ? 'Insulation does not keep the cold in: it slows the heat getting in from the warm room.'
    : 'Insulation does not make cold: it slows heat moving from the warmer place to the cooler.'
  return `Yes. ${sentence(listParts(w))} left the ${d === 'hot' ? 'water' : 'drink'} at ${degrees(t)} after ${config.minutes} minutes. ${sentence(why.join(', '))}. ${idea}`
}

/** What a wrong card says: what the learner made, never where the answer is. */
export function madeText(config: ThermalConfig, state: ThermalState): string {
  if (config.task === 'beads') {
    const at = beadsOf(config, state)
    const order = [...config.rods].sort((a, b) => dropSeconds(at[a], a) - dropSeconds(at[b], b))
    const first = order[0]
    const last = order[order.length - 1]
    return `The ${first} bead dropped first, at ${clock(dropSeconds(at[first], first))}, and the ${last} bead last, at ${clock(dropSeconds(at[last], last))}: they did not fall together.`
  }
  const w = wrappingOf(config, state)
  const t = tempAt(config, w, config.minutes)
  const d = drinkOf(config)
  const held = holds(config, w)
  const where = d === 'hot' ? 'below' : 'above'
  if (!held) return `${sentence(listParts(w))} left the ${d === 'hot' ? 'water' : 'drink'} at ${degrees(t)} after ${config.minutes} minutes, ${where} the target.`
  return `It held, at ${degrees(t)} after ${config.minutes} minutes, but with ${say(partsUsed(w), 'part', 'parts')}, and fewer would do.`
}

// ---------------------------------------------------------------------------
// Reading the tutor's config.

const keyOf = (raw: unknown) => (typeof raw === 'string' ? raw.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : '')
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)

const TASK_WORDS: Record<string, 'beads' | 'wrap'> = {
  beads: 'beads', bead: 'beads', rods: 'beads', rod: 'beads', wax: 'beads', 'wax-beads': 'beads', 'wax-and-rods': 'beads', conduction: 'beads', conductors: 'beads', 'ingenhousz': 'beads',
  'ball-bearings': 'beads', 'metal-rods': 'beads', 'heat-along-rods': 'beads', 'conductivity': 'beads',
  wrap: 'wrap', cup: 'wrap', cups: 'wrap', insulation: 'wrap', insulate: 'wrap', insulating: 'wrap', insulator: 'wrap', insulators: 'wrap', cooling: 'wrap', 'keep-warm': 'wrap', 'keep-hot': 'wrap',
  'keep-cold': 'wrap', thermos: 'wrap', flask: 'wrap', drink: 'wrap', 'hot-drink': 'wrap', 'cold-drink': 'wrap', 'wrap-the-cup': 'wrap', 'heat-loss': 'wrap', 'cup-of-water': 'wrap',
}

const MATERIAL_WORDS: Record<string, string> = { aluminum: 'aluminium', 'aluminium-rod': 'aluminium', 'copper-rod': 'copper', 'iron-rod': 'iron', 'brass-rod': 'brass', 'aluminum-rod': 'aluminium' }
const readMaterial = (raw: unknown): string | null => {
  if (typeof raw !== 'string') return null
  const k = keyOf(raw)
  if (!k) return null
  return has(MATERIAL_WORDS, k) ? MATERIAL_WORDS[k] : k
}

function readRods(raw: unknown): string[] | null {
  if (raw === undefined) return ['brass', 'copper', 'iron']
  const items = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(/\s*(?:,|;|\band\b|&|\/|\+)\s*/i) : null
  if (!items) return null
  const out: string[] = []
  for (const it of items) {
    const m = readMaterial(it)
    if (m === null) {
      if (typeof it === 'string' && keyOf(it) === '') continue
      return null
    }
    out.push(m)
  }
  const order = (m: string) => (isMaterial(m) ? MATERIALS.indexOf(m) : 99)
  return out.sort((a, b) => order(a) - order(b) || (a < b ? -1 : a > b ? 1 : 0))
}

const DRINK_WORDS: Record<string, DrinkName> = {
  hot: 'hot', warm: 'hot', tea: 'hot', coffee: 'hot', 'hot-water': 'hot', 'hot-drink': 'hot', 'hot-tea': 'hot', 'hot-coffee': 'hot', 'cup-of-tea': 'hot', 'a-hot-drink': 'hot', 'a-cup-of-hot-water': 'hot', boiling: 'hot',
  cold: 'cold', iced: 'cold', ice: 'cold', chilled: 'cold', cool: 'cold', 'iced-water': 'cold', 'cold-water': 'cold', 'cold-drink': 'cold', 'iced-drink': 'cold', 'ice-cold': 'cold', fridge: 'cold', 'cold-drink-from-the-fridge': 'cold',
}
function readDrink(raw: unknown): string | null {
  if (raw === undefined) return 'hot'
  if (typeof raw !== 'string') return null
  const k = keyOf(raw)
  return has(DRINK_WORDS, k) ? DRINK_WORDS[k] : k || 'hot'
}

const PART_WORDS: Record<string, string> = {
  wool: 'wool', woollen: 'wool', woolen: 'wool', layers: 'wool', layer: 'wool', 'wool-layers': 'wool', 'wool-wrap': 'wool', wrap: 'wool', jumper: 'wool', insulation: 'wool', 'insulating-layers': 'wool', 'wool-layer': 'wool', felt: 'wool', fabric: 'wool',
  lid: 'lid', cap: 'lid', cover: 'lid', top: 'lid', 'the-lid': 'lid', stopper: 'lid',
  foil: 'foil', 'shiny-foil': 'foil', 'aluminium-foil': 'foil', 'aluminum-foil': 'foil', silver: 'foil', shiny: 'foil', reflector: 'foil', 'silver-foil': 'foil', reflective: 'foil',
}
function readParts(raw: unknown): string[] | null {
  if (raw === undefined) return [...PARTS]
  const items = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(/\s*(?:,|;|\band\b|&|\/|\+)\s*/i) : null
  if (!items) return null
  const out: string[] = []
  for (const it of items) {
    if (typeof it !== 'string') return null
    const k = keyOf(it)
    if (!k) continue
    const p = has(PART_WORDS, k) ? PART_WORDS[k] : k
    if (!out.includes(p)) out.push(p)
  }
  const order = (p: string) => (isPart(p) ? PARTS.indexOf(p) : 99)
  return out.sort((a, b) => order(a) - order(b))
}

function readNumber(raw: unknown, unit: RegExp): number | null | undefined {
  if (raw === undefined) return undefined
  const v = typeof raw === 'string' && raw.trim() !== '' ? Number(raw.trim().replace(unit, '').trim()) : raw
  return typeof v === 'number' && Number.isFinite(v) ? v + 0 : null
}

const defaultTarget = (d: string) => (d === 'cold' ? 10 : 50)

/** The nearest wrap config that has no fault: the example a refusal gives. */
function nearbyWrap(config: WrapConfig): WrapConfig {
  const d = isDrink(config.drink) ? config.drink : 'hot'
  const range = TARGETS[d]
  const minutes = Math.max(MINUTES_MIN, Math.min(MINUTES_MAX, Math.round(config.minutes)))
  const parts = config.parts.filter(isPart).length ? config.parts.filter(isPart) : [...PARTS]
  const from = Math.max(range.min, Math.min(range.max, Math.round(config.target)))
  for (let dt = 0; dt <= range.max - range.min; dt++) {
    for (const target of [from - dt, from + dt]) {
      if (target < range.min || target > range.max) continue
      const c: WrapConfig = { task: 'wrap', drink: d, minutes, target, parts }
      if (trouble(c) === null) return c
    }
  }
  return { task: 'wrap', drink: d, minutes: 30, target: defaultTarget(d), parts: [...PARTS] }
}

/** Why a cup in range still teaches nothing: a bare cup that holds, or nothing that does. */
function trouble(c: WrapConfig): 'bare' | 'cannot' | null {
  if (holds(c, BARE)) return 'bare'
  if (fewestParts(c) === null) return 'cannot'
  return null
}

function wrapFaults(config: WrapConfig): string[] {
  const out: string[] = []
  const d = config.drink
  if (!isDrink(d)) {
    out.push(`There is no "${d}" drink here: use hot or cold, e.g. drink "hot".`)
    return out
  }
  const range = TARGETS[d]
  const bad = config.parts.filter((p) => !isPart(p))
  if (bad.length) out.push(`There is no "${bad[0]}" part: use wool, lid or foil, e.g. parts ["wool","lid","foil"].`)
  if (config.parts.filter(isPart).length === 0 && !bad.length) out.push('No parts are offered, so there is nothing to do: use e.g. parts ["wool","lid","foil"].')
  if (!Number.isInteger(config.minutes) || config.minutes < MINUTES_MIN || config.minutes > MINUTES_MAX) {
    out.push(`${config.minutes} minutes is outside what the clock shows (${MINUTES_MIN} to ${MINUTES_MAX}, whole minutes): use e.g. minutes 30.`)
  }
  if (!Number.isInteger(config.target) || config.target < range.min || config.target > range.max) {
    const sample = Math.max(range.min, Math.min(range.max, Math.round(config.target || defaultTarget(d))))
    out.push(`A target of ${config.target} °C is outside what a ${d} cup can be asked to hold (${range.min} to ${range.max} °C, whole degrees): use e.g. target ${sample === config.target ? defaultTarget(d) : sample}.`)
  }
  if (out.length) return out
  const all = config.parts.filter(isPart)
  const c: WrapConfig = { ...config, parts: all }
  const near = () => {
    const n = nearbyWrap(c)
    return `target ${n.target}${n.minutes !== c.minutes ? `, minutes ${n.minutes}` : ''}`
  }
  const why = trouble(c)
  if (why === 'bare') {
    out.push(`A bare cup already holds ${d === 'hot' ? 'above' : 'below'} ${config.target} °C for ${config.minutes} minutes, so nothing needs doing: ask for more, e.g. ${near()}.`)
  } else if (why === 'cannot') {
    out.push(`Even with every part offered, the cup cannot hold ${config.target} °C for ${config.minutes} minutes: ask for less, e.g. ${near()}.`)
  }
  return out
}

function beadsFaults(config: BeadsConfig): string[] {
  const out: string[] = []
  const bad = config.rods.filter((r) => !isMaterial(r))
  if (bad.length) out.push(`There is no "${bad[0]}" rod here: use ${MATERIALS.join(', ')}, e.g. rods ["copper","iron"].`)
  if (config.rods.length < ROD_MIN || config.rods.length > ROD_MAX) {
    out.push(`${config.rods.length} rods is not what the card shows (${ROD_MIN} or ${ROD_MAX}): use e.g. rods ["copper","brass","iron"].`)
  }
  if (new Set(config.rods).size !== config.rods.length) out.push('Two rods are the same metal, so their beads would fall together wherever they sit: use e.g. rods ["copper","iron"].')
  if (out.length) return out
  for (const p of config.rods) {
    for (const q of config.rods) {
      if (p >= q) continue
      const ratio = Math.max(DIFFUSIVITY[p as MaterialName], DIFFUSIVITY[q as MaterialName]) / Math.min(DIFFUSIVITY[p as MaterialName], DIFFUSIVITY[q as MaterialName])
      if (ratio < MIN_SPREAD) out.push(`${p} and ${q} pass heat along so alike that their beads would sit almost together: use e.g. rods ["copper","iron"].`)
    }
  }
  if (out.length) return out
  if (!together(config.rods, bestBeads(config.rods))) out.push('These rods cannot be made to drop together on a rod this long: use e.g. rods ["copper","iron"].')
  return out
}

/** What a prompt can safely say: the gesture and the aim. */
export const goodPrompt = (config: ThermalConfig): string => {
  if (config.task === 'beads') return 'Slide each ball along its rod so that all the balls drop at the same moment. Touching a ball puts it back, and the clock runs again when you let go.'
  const d = config.drink
  const parts = config.parts.filter(isPart)
  const names = parts.map((p) => (p === 'wool' ? 'wool' : p === 'lid' ? 'a lid' : 'foil'))
  const add = names.length > 1 ? `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}` : names[0] ?? 'wool'
  const aim = d === 'cold' ? `Keep the drink below ${config.target} °C` : `Keep the water above ${config.target} °C`
  return `Add ${add} to the cup. ${aim} for ${config.minutes} minutes, with as few parts as you can.`
}

export const thermalTransferEngine: SceneEngine<ThermalConfig, ThermalState> = {
  id: 'thermal-transfer',
  // Everything is a whole phrase: "conduction" alone is a nerve and a wire, "radiation" is nuclear, "convection" is a plate
  // boundary, "insulation" is on cables, and a five-letter stem would catch "convex".
  covers: [],
  phrases: [
    'heat transfer', 'heat transfers', 'thermal transfer', 'thermal transfers', 'transfer of heat', 'transfer of thermal energy', 'thermal energy transfer', 'thermal energy transfers', 'transfers of thermal energy',
    'conduction convection and radiation', 'conduction convection radiation', 'conduction and convection', 'convection and radiation', 'conduction and radiation', 'three ways heat travels', 'how heat travels',
    'heat conduction', 'thermal conduction', 'conduction of heat', 'conduction in metals', 'heat flow', 'conduction in solids', 'good conductors of heat', 'conductors of heat',
    'thermal insulation', 'heat insulation', 'insulating materials', 'insulation and heat', 'thermal conductors', 'thermal insulators', 'thermal conductivity', 'heat loss', 'reducing heat loss', 'preventing heat loss', 'heat and insulation',
    'vacuum flask', 'thermos flask', 'keeping hot', 'keeping warm', 'keeping cool', 'keeping cold', 'heat and temperature', 'rate of cooling',
    'thermal energy', 'heat energy', 'thermal physics', 'thermal properties', 'thermal properties of matter', 'thermal energy and heat', 'heat and thermal energy', 'infrared and heat', 'thermal radiation', 'heat radiation',
    'convection currents in fluids', 'convection in fluids', 'convection in liquids', 'convection in gases', 'insulators and heat', 'house insulation', 'insulating a house', 'insulating a home',
  ],
  // Near misses: the same words for something else.
  notFor: [
    'electrical conduction', 'electrical conductors', 'electrical insulation', 'electrical insulators', 'electric conduction', 'conduction of electricity', 'electrical conductivity', 'conductors and semiconductors', 'insulators and semiconductors', 'electrical conductors and insulators', 'static electricity',
    'nerve conduction', 'conduction of impulses', 'conduction of nerve impulses', 'conduction system', 'cardiac conduction', 'heart conduction', 'impulse conduction', 'saltatory conduction', 'neuron',
    'nuclear radiation', 'radiation dose', 'radiation safety', 'ionising radiation', 'ionizing radiation', 'background radiation', 'radioactive', 'radioactivity', 'radioactive decay', 'radiotherapy', 'alpha beta and gamma', 'electromagnetic radiation', 'electromagnetic spectrum', 'electromagnetic waves', 'ultraviolet radiation', 'microwave radiation', 'x rays', 'solar radiation', 'cosmic radiation', 'insolation', 'adaptive radiation',
    'mantle convection', 'plate tectonics', 'tectonic plates', 'convectional rainfall', 'convection rainfall', 'convectional rain', 'convection cells', 'atmospheric convection', 'ocean convection',
    'cable insulation', 'wire insulation', 'insulation of wires', 'wiring', 'mains cables', 'sound insulation', 'noise insulation', 'soundproofing', 'insulin', 'insulation resistance',
    'greenhouse effect', 'global warming', 'climate change', 'carbon cycle', 'heat island', 'urban heat', 'heatwave', 'heat waves', 'heat stroke', 'body temperature', 'thermoregulation', 'homeostasis',
    'heat exchanger', 'heat exchangers', 'heat pump', 'heat pumps', 'heat engine', 'heat engines', 'latent heat', 'specific heat', 'specific latent heat', 'specific heat capacity', 'enthalpy', 'calorimetry', 'calorimeter', 'energy changes in reactions', 'exothermic', 'endothermic', 'thermodynamics', 'entropy', 'gas laws',
    'heat loss from the body', 'heat loss in animals',
  ],
  // The learner changes an amount: how far along a rod, how many layers.
  isolates: 'magnitude',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const rawTask = first(o, ['task', 'kind', 'type', 'mode'])
    const word = keyOf(rawTask)
    if (rawTask !== undefined && (typeof rawTask !== 'string' || !has(TASK_WORDS, word))) return null
    const rodsGiven = first(o, ['rods', 'materials', 'metals', 'metal'])
    const task = word ? TASK_WORDS[word] : rodsGiven !== undefined ? 'beads' : first(o, ['drink', 'target', 'parts', 'minutes']) !== undefined ? 'wrap' : null
    if (!task) return null
    if (task === 'beads') {
      const rods = readRods(rodsGiven)
      return rods ? { task, rods } : null
    }
    const drink = readDrink(first(o, ['drink', 'contents', 'liquid', 'water']))
    if (drink === null) return null
    const minutes = readNumber(first(o, ['minutes', 'time', 'duration', 'mins']), /\s*(?:minutes?|mins?|min)$/i)
    const target = readNumber(first(o, ['target', 'temperature', 'hold', 'holdAt', 'goal']), /\s*(?:°\s*c|degrees?(?:\s*celsius)?|c)$/i)
    const parts = readParts(first(o, ['parts', 'options', 'available', 'controls']))
    if (minutes === null || target === null || parts === null) return null
    return { task, drink, minutes: minutes ?? 30, target: target ?? defaultTarget(drink), parts }
  },

  faults(config) {
    return config.task === 'beads' ? beadsFaults(config) : wrapFaults(config)
  },

  promptFaults(config, prompt) {
    const text = prompt.replace(/\s+/g, ' ')
    const example = goodPrompt(config)
    const out: string[] = []
    if (config.task === 'beads') {
      const where = /\b\d+(?:\.\d+)?\s*(?:cm|centimet(?:re|er)s?|mm)\b|\b(?:far(?:ther|thest)|further|furthest|closer|closest|nearer|nearest|halfway|half way|middle|end of the rod|near the bath|from the bath)\b|\bsquare(?:d)?\b|\btwice as\b|\bdouble\b|\bfaster\b|\bslower\b|\bbetter conductor|\bpoor conductor|\bgood conductor|\bconductivity\b|\bdiffusivity\b|\binsulator\b/i.test(text)
      if (where) {
        out.push(`the prompt gives the answer away: it says where a ball goes or which metal is quicker, which the learner is to find by trying -- ask for the outcome only ("${example}")`)
      }
      if (/\bthermal camera|\binfra-?red|\bthermometer|\bflame|\bbunsen|\btouch the rod|\bfeel\b|\btemperature of the (?:wax|rod)|\bdegrees?\b|\b°C/i.test(text)) {
        out.push(`the prompt promises something the card does not show: it draws rods in a boiling bath, wax dabs and balls, and the learner slides the balls -- ask for that ("${example}")`)
      }
      return out
    }
    const method = /\bkeeps? (?:the )?(?:cold|heat|warmth|warm|hot) (?:in|out)\b|\btraps? (?:the )?heat|\b(?:wool|lid|foil)\b[^.]*\b(?:works?|stops?|traps?|reflects?|blocks?|slows?|is (?:the )?best|helps?)\b|\b(?:use|add|need|try)\s+(?:a\s+|the\s+)?(?:\d+|one|two|three)\s+layers?\b|\b(?:one|two|three|\d+)\s+(?:layers?|parts?)\s+(?:is|are|will|would|should|enough)\b|\bbest insulat|\bgood insulat|\bpoor conduct|\bshiny\b[^.]*\breflect|\bconduction\b|\bconvection\b|\bradiation\b|\bheat (?:flows|escapes|leaves|enters|gets in|gets out)\b|\bcool(?:s|ing)? (?:down|faster|slower)\b/i.test(text)
    if (method) {
      out.push(`the prompt gives the answer away: it says which part works, how many to use or how heat moves, which the learner is to find with the cup -- ask for the outcome only ("${example}")`)
    }
    if (/\bvacuum|\bthermos|\bflask|\bdouble[- ]wall|\bsilvered|\bice cubes?|\bthermal camera|\binfra-?red|\bsteam\b|\bevaporat|\bsoup|\btea\b|\bcoffee\b|\bkettle/i.test(text)) {
      out.push(`the prompt promises something the card does not show: it draws a beaker of hot or cold water with a thermometer, and wool, a lid and foil to add -- ask for that ("${example}")`)
    }
    // Numbers must be the card's own.
    for (const m of text.matchAll(/(\d+(?:\.\d+)?)\s*(?:°\s*C|degrees?(?:\s*Celsius)?)/gi)) {
      if (Number(m[1]) !== config.target) out.push(`the prompt says ${m[1]} °C but the card's target is ${config.target} °C ("${example}")`)
    }
    for (const m of text.matchAll(/(\d+)\s*(?:minutes?|mins?)\b/gi)) {
      if (Number(m[1]) !== config.minutes) out.push(`the prompt says ${m[1]} minutes but the card runs ${config.minutes} ("${example}")`)
    }
    return out
  },

  initial(config) {
    if (config.task === 'beads') return { beads: Object.fromEntries(config.rods.map((r) => [r, BEAD_START])) }
    return { wool: 0, lid: false, foil: false }
  },

  check(config, state) {
    return { ok: done(config, state), wrongIds: [] }
  },

  solve(config) {
    if (config.task === 'beads') return { beads: bestBeads(config.rods) }
    const w = bestWrapping(config)
    return { wool: w.wool, lid: w.lid, foil: w.foil }
  },

  View: ThermalTransferView,

  prompt: `SCENE "thermal-transfer" -- heat on the move, drawn as the real bench apparatus on a quiet light panel. Two tasks.
  beads: rods of different metals (brass, copper, iron, aluminium) stand in a bath of boiling water, each with a small ball bearing hanging from it by a dab of wax. The rods colour from the bath outward as heat creeps along them; a ball drops into the tray under its rod when its wax melts. The learner slides each ball along its rod (drag, tap on the rod, or the arrow keys) so that every ball drops at the same moment. Touching a ball puts the experiment back to the start, and the clock runs again when they let go; a slider winds the clock, and "Run again" repeats it.
  wrap: a beaker of hot or cold water in cross-section beside a thermometer, with a bare cup's reading beside it. The learner dresses the cup: layers of wool (0 to 3), a lid, shiny foil. Orange arrows show heat leaving a hot cup, or entering a cold one, three ways: through the wall (conduction), over the top (convection) and as rays (radiation); each arrow thickens and thins with what the cup wears, and all thin as the water nears room temperature. A slider winds the clock; the thermometer shows the water, with the target marked.
  For: heat transfer, conduction, convection and radiation, thermal insulation, vacuum flasks, keeping things hot or cold, rate of cooling, good and poor conductors of heat. It answers "insulation keeps the cold in" (a cold cup is wrapped too, and the arrows go inward), "heat and cold are different things that flow", and "metal is colder than wood" (the beads show metals carrying heat fast; the result says so).
  beads config: rods: 2 or 3 of "aluminium","brass","copper","iron" (default brass, copper, iron). Not both copper and aluminium: they conduct too alike. Wood and glass rods are not drawn.
  wrap config: drink: "hot" (80 °C start) or "cold" (5 °C start); the room is 20 °C. minutes: 10 to 60 (default 30). target: hot 30 to 75 °C (default 50), cold 6 to 15 °C (default 10): the water must stay above (hot) or below (cold) it for the whole time. parts: any of "wool","lid","foil" the learner may use (default all three), so a lesson on conduction alone can offer only wool. A target a bare cup already holds, or that nothing can hold, is refused with one that works.
  Marking: beads is right when the last bead drops no more than a tenth later than the first. wrap is right when the water holds the target AND the cup wears as few parts as will do it (each layer, the lid and the foil count one). A cup that holds with more parts is marked wrong, with what was made.
  Not drawn: wood, glass or plastic rods, ice cubes, steam clouds, vacuum flasks, thermal cameras, conduction of electricity, nuclear radiation, the Sun, the greenhouse effect, or anything on heat capacity and Q = mc dT. Do not use it for electrical conduction, nerve impulses, radiation from atoms, or convection in the mantle.
  Before marking the card shows the experiment running and what the learner has built: the colours, the balls, the thermometer's reading and the arrows. It holds back whether the beads fell together enough, the fewest parts, and why. The prompt must ask for the outcome only: do NOT say where to put a ball, which metal is quicker, how many layers, which part works, or how heat moves (no "conduction", "convection", "radiation", "keeps the heat in").
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Slide each ball along its rod so that all the balls drop at the same moment. Touching a ball puts it back, and the clock runs again when you let go.",
    "payload": { "engine":"thermal-transfer", "config": { "task":"beads", "rods":["brass","copper","iron"] } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"magnitude", "apparatus":"scene:thermal-transfer", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Add wool, a lid or foil to the cup. Keep the water above 50 °C for 30 minutes, with as few parts as you can.",
    "payload": { "engine":"thermal-transfer", "config": { "task":"wrap", "drink":"hot", "minutes":30, "target":50, "parts":["wool","lid","foil"] } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"magnitude", "apparatus":"scene:thermal-transfer", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Add wool, a lid or foil to the cup. Keep the drink below 10 °C for 30 minutes, with as few parts as you can.",
    "payload": { "engine":"thermal-transfer", "config": { "task":"wrap", "drink":"cold", "minutes":30, "target":10, "parts":["wool","lid","foil"] } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"magnitude", "apparatus":"scene:thermal-transfer", "why":"..." } }`,
}

registerEngine(thermalTransferEngine as SceneEngine<unknown, unknown>)
