// lib/studylab/engines/rates-equilibrium/config.ts
import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { RatesEquilibriumView } from './View'

/**
 * One chamber of particles for two ideas that students get backwards.
 *
 *  1. Speed: a reaction goes faster not because particles "try harder" but
 *     because more of their collisions are hard enough. The learner sets one
 *     condition and watches which collisions succeed.
 *  2. Equilibrium: at balance the reaction has not stopped; both directions run
 *     at the same rate. The learner disturbs the balance and watches it shift.
 *
 * Sources (all named per fact below):
 *  - Cambridge IGCSE Chemistry 0620 (2023-2025): 6.2 Rate of reaction (collision
 *    theory; temperature, concentration/pressure, surface area, catalyst),
 *    6.3 Reversible reactions and equilibrium, 10.? Haber and Contact processes.
 *  - Collision theory and the Arrhenius law: Atkins, Physical Chemistry, ch. on
 *    reaction rates. The fraction of collisions whose line-of-centres energy is
 *    at least Ea is exp(-Ea/kT).
 *  - Le Chatelier's principle and the van 't Hoff equation: Atkins, ch. on
 *    chemical equilibrium.
 *
 * The animation is a depiction. Nothing here is marked by chance: the marks
 * come from the rules below, and the sims are seeded.
 */

// ---------------------------------------------------------------------------
// Task 1: make a reaction faster or slower
// ---------------------------------------------------------------------------

export type Goal = 'faster' | 'slower'
export type Condition = 'temperature' | 'concentration' | 'surface area' | 'catalyst'
export const CONDITIONS: readonly Condition[] = ['temperature', 'concentration', 'surface area', 'catalyst']

export type RateReactionId = 'marble' | 'magnesium' | 'thiosulfate' | 'haber' | 'contact'

export interface RateReaction {
  id: RateReactionId
  /** How a writer or learner would say it. */
  name: string
  phase: 'solid-liquid' | 'solution' | 'gas'
  /** The particles that move; a solid reactant is fixed and listed apart. */
  movers: string[]
  solid?: string
  catalyst?: string
  /** The five temperatures on the dial, in degrees C; the middle one is where it starts. */
  temps: number[]
}

/**
 * The reactions of 0620 6.2 and its practicals: marble chips with acid, magnesium
 * with acid, the thiosulfate "disappearing cross", and the two industrial gas
 * reactions that use a catalyst (Haber: iron; Contact: vanadium(V) oxide, 10.x).
 * The two gas reactions are drawn as one particle of each reactant meeting; the
 * picture is of the collision idea, not of the real stoichiometry or mechanism.
 */
export const RATE_REACTIONS: Record<RateReactionId, RateReaction> = {
  marble: { id: 'marble', name: 'marble chips and hydrochloric acid', phase: 'solid-liquid', movers: ['acid'], solid: 'marble chips', temps: [10, 25, 40, 55, 70] },
  magnesium: { id: 'magnesium', name: 'magnesium and hydrochloric acid', phase: 'solid-liquid', movers: ['acid'], solid: 'magnesium', temps: [10, 25, 40, 55, 70] },
  thiosulfate: { id: 'thiosulfate', name: 'sodium thiosulfate and hydrochloric acid', phase: 'solution', movers: ['thiosulfate', 'acid'], temps: [10, 25, 40, 55, 70] },
  haber: { id: 'haber', name: 'nitrogen and hydrogen', phase: 'gas', movers: ['nitrogen', 'hydrogen'], catalyst: 'iron', temps: [350, 400, 450, 500, 550] },
  contact: { id: 'contact', name: 'sulfur dioxide and oxygen', phase: 'gas', movers: ['sulfur dioxide', 'oxygen'], catalyst: 'vanadium(V) oxide', temps: [350, 400, 450, 500, 550] },
}

const R_GAS = 8.314
/**
 * An activation energy of 50 kJ/mol roughly doubles a rate for 10 degrees near
 * room temperature (the rule of thumb the syllabus uses); a catalyst's route
 * is easier. These round figures are for the picture; only ratios are used.
 */
const EA = 50_000
const EA_CAT = 30_000
/**
 * The picture's scale. Real activation energies are tens of kT, far too large
 * to see a collision succeed. The picture keeps the same law (the share of
 * collisions that are hard enough is exp(-needed/kT)) at a readable size, and
 * stretches temperature so the share changes by the factor the real Ea gives.
 */
export const EPS0 = 2

/** Particles of each kind on the concentration dial (the middle one is where it starts). */
export const COUNTS = [8, 14, 20, 28, 40]
/** The chamber the solid sits in, and the cells it is built of. */
export const FIELD = { w: 360, h: 200 }
export const CELL_R = 4
export interface Cell { x: number; y: number; exposed: boolean }

/**
 * The solid as 64 cells in all three states: one 8x8 lump, four 4x4 pieces,
 * sixteen 2x2 grains. A cell can be hit if it is on the outside of its piece
 * and not the underside of one standing on the floor.
 */
export function solidLayout(area: number): Cell[] {
  const pitch = CELL_R * 2
  const floor = FIELD.h - 2
  const blocks: { cx: number; bottom: number; s: number; onFloor: boolean }[] = []
  if (area <= 0) blocks.push({ cx: FIELD.w / 2, bottom: floor, s: 8, onFloor: true })
  else if (area === 1) for (let k = 0; k < 4; k++) blocks.push({ cx: (FIELD.w * (k + 1)) / 5, bottom: floor, s: 4, onFloor: true })
  else for (let row = 0; row < 2; row++) for (let k = 0; k < 8; k++) blocks.push({ cx: (FIELD.w * (k + 0.5)) / 8, bottom: floor - row * 50, s: 2, onFloor: row === 0 })
  const cells: Cell[] = []
  for (const b of blocks) {
    for (let i = 0; i < b.s; i++) {
      for (let j = 0; j < b.s; j++) {
        const edge = i === 0 || j === 0 || i === b.s - 1 || j === b.s - 1
        const underside = b.onFloor && j === 0
        cells.push({
          x: b.cx - (b.s * pitch) / 2 + CELL_R + i * pitch,
          y: b.bottom - CELL_R - j * pitch,
          exposed: edge && !underside,
        })
      }
    }
  }
  return cells
}

/** How many cells can be hit in the lump, the pieces and the grains. */
export const EXPOSED = [0, 1, 2].map((a) => solidLayout(a).filter((c) => c.exposed).length)
export interface Levels { temp: number; conc: number; area: number; cat: 0 | 1 }
export const DEFAULT_LEVELS: Levels = { temp: 2, conc: 2, area: 1, cat: 0 }

const kelvin = (c: number) => c + 273.15

/** The picture's temperature, relative to the start (1 = where it starts). */
export function simTemp(r: RateReaction, tempIdx: number): number {
  const inv = 1 + (EA / (R_GAS * EPS0)) * (1 / kelvin(r.temps[tempIdx]) - 1 / kelvin(r.temps[2]))
  return 1 / inv
}

/** How hard a hit must be, in units of the starting thermal energy. */
export function needed(cat: 0 | 1): number {
  return cat ? (EPS0 * EA_CAT) / EA : EPS0
}

/** The share of collisions that are hard enough. */
export function successShare(r: RateReaction, lv: Levels): number {
  return Math.exp(-needed(lv.cat) / simTemp(r, lv.temp))
}

/** How many collisions there are, relative to the start. */
export function collisionRate(r: RateReaction, lv: Levels): number {
  const n = COUNTS[lv.conc] / COUNTS[2]
  const base = r.solid ? n : n * n
  const expo = r.solid ? EXPOSED[lv.area] / EXPOSED[1] : 1
  return base * expo * Math.sqrt(simTemp(r, lv.temp))
}

/** Successful collisions per second, relative to the start of the scene (the rule the mark uses). */
export function rateOf(r: RateReaction, lv: Levels): number {
  return collisionRate(r, lv) * successShare(r, lv)
}

export interface SpeedTask { kind: 'speed'; reaction: RateReactionId; condition: Condition; goal: Goal }

/** The most positions the dial has for each condition. */
export const STOPS: Record<Condition, number> = { temperature: 5, concentration: 5, 'surface area': 3, catalyst: 2 }

export function startPos(t: SpeedTask): number {
  if (t.condition === 'surface area') return t.goal === 'faster' ? 0 : 2
  if (t.condition === 'catalyst') return t.goal === 'faster' ? 0 : 1
  return 2
}

export function levelsAt(t: SpeedTask, pos: number): Levels {
  const lv = { ...DEFAULT_LEVELS }
  const p = Math.max(0, Math.min(STOPS[t.condition] - 1, Math.round(pos)))
  if (t.condition === 'temperature') lv.temp = p
  else if (t.condition === 'concentration') lv.conc = p
  else if (t.condition === 'surface area') lv.area = p
  else lv.cat = p === 1 ? 1 : 0
  return lv
}

/** How much faster the reaction is at a dial position than where it started (below 1 is slower). */
export function speedRatio(t: SpeedTask, pos: number): number {
  const r = RATE_REACTIONS[t.reaction]
  return rateOf(r, levelsAt(t, pos)) / rateOf(r, levelsAt(t, startPos(t)))
}

/** A change smaller than this is not one a learner can tell by looking. */
export const SPEED_MIN = 1.7

const speedOk = (t: SpeedTask, pos: number) => {
  const ratio = speedRatio(t, pos)
  return t.goal === 'faster' ? ratio >= SPEED_MIN - 1e-9 : ratio <= 1 / SPEED_MIN + 1e-9
}

/** What the learner made, by the rules, in a word. */
export function speedMade(t: SpeedTask, pos: number): 'faster' | 'slower' | 'about the same' {
  const ratio = speedRatio(t, pos)
  return ratio > 1.15 ? 'faster' : ratio < 1 / 1.15 ? 'slower' : 'about the same'
}

/** The label of the dial: the same idea, said the way the reaction's phase says it. */
export function conditionLabel(r: RateReaction, c: Condition): string {
  if (c === 'concentration') return r.phase === 'gas' ? 'Pressure' : 'Concentration'
  return c === 'surface area' ? 'Surface area' : c === 'catalyst' ? 'Catalyst' : 'Temperature'
}

/** Why, once marked. Never shown before. */
export function explainSpeed(t: SpeedTask, pos: number): string {
  const up = pos > startPos(t)
  switch (t.condition) {
    case 'temperature':
      return up
        ? 'Hotter particles hit more often, and a bigger share of the hits are hard enough to react. They do not try harder: more of the hits are enough.'
        : 'Cooler particles hit less often, and a smaller share of the hits are hard enough to react.'
    case 'concentration':
      return up
        ? 'More particles in the same space means more collisions every second, so more of the hard enough ones.'
        : 'Fewer particles in the same space means fewer collisions every second, so fewer of the hard enough ones.'
    case 'surface area':
      return up
        ? 'Breaking the solid up shows more of it to be hit, so more collisions happen where they can react.'
        : 'A lump hides most of its particles inside, so fewer collisions can react.'
    default:
      return up
        ? 'A catalyst gives the reaction an easier route, so a hit does not need to be as hard. Particles have no more energy; more of their hits are enough.'
        : 'Without the catalyst a hit needs to be harder, so fewer of the hits are enough.'
  }
}

// ---------------------------------------------------------------------------
// Task 2: disturb an equilibrium
// ---------------------------------------------------------------------------

export type SpeciesId = 'n2o4' | 'no2' | 'n2' | 'h2' | 'nh3' | 'so2' | 'o2' | 'so3' | 'i2' | 'hi'

export interface Species {
  name: string
  formula: string
  /** Atoms in a molecule: the drawn size follows it. */
  atoms: number
  color: string
  shape: 'circle' | 'square' | 'triangle' | 'diamond'
  /** Other ways a writer says it, normalised (lower case, no spaces). */
  aliases: string[]
}

export const SPECIES: Record<SpeciesId, Species> = {
  n2o4: { name: 'dinitrogen tetroxide', formula: 'N2O4', atoms: 6, color: '#BFD9F2', shape: 'circle', aliases: ['n2o4', 'dinitrogentetroxide', 'dinitrogentetraoxide'] },
  no2: { name: 'nitrogen dioxide', formula: 'NO2', atoms: 3, color: '#E8893A', shape: 'square', aliases: ['no2', 'nitrogendioxide'] },
  n2: { name: 'nitrogen', formula: 'N2', atoms: 2, color: '#6FB1F2', shape: 'circle', aliases: ['n2', 'nitrogen', 'nitrogengas'] },
  h2: { name: 'hydrogen', formula: 'H2', atoms: 2, color: '#F2C94C', shape: 'square', aliases: ['h2', 'hydrogen', 'hydrogengas'] },
  nh3: { name: 'ammonia', formula: 'NH3', atoms: 4, color: '#7BD389', shape: 'triangle', aliases: ['nh3', 'ammonia'] },
  so2: { name: 'sulfur dioxide', formula: 'SO2', atoms: 3, color: '#6FB1F2', shape: 'circle', aliases: ['so2', 'sulfurdioxide', 'sulphurdioxide'] },
  o2: { name: 'oxygen', formula: 'O2', atoms: 2, color: '#F2C94C', shape: 'square', aliases: ['o2', 'oxygen', 'oxygengas'] },
  so3: { name: 'sulfur trioxide', formula: 'SO3', atoms: 4, color: '#7BD389', shape: 'triangle', aliases: ['so3', 'sulfurtrioxide', 'sulphurtrioxide'] },
  i2: { name: 'iodine', formula: 'I2', atoms: 2, color: '#C79BF2', shape: 'circle', aliases: ['i2', 'iodine', 'iodinevapour', 'iodinegas'] },
  hi: { name: 'hydrogen iodide', formula: 'HI', atoms: 2, color: '#F29B7B', shape: 'diamond', aliases: ['hi', 'hydrogeniodide'] },
}

export type EqReactionId = 'n2o4' | 'haber' | 'contact' | 'hi'
/** A term of the equation: negative for a reactant, positive for a product. */
export interface Term { id: SpeciesId; nu: number }

export interface EqReaction {
  id: EqReactionId
  name: string
  terms: Term[]
  /** Enthalpy change of the forward reaction as written, kJ/mol of reaction. */
  dH: number
  /** The temperature it starts at, kelvin, and the kelvin per step of the dial. */
  T0: number
  step: number
  /** The amounts at balance where it starts, in particles. K at T0 is set from these. */
  base: number[]
  aliases: string[]
}

/**
 * Each reaction's enthalpy sign and gas moles are checked against the named source.
 *
 * - N2O4(g) <=> 2NO2(g): dH = +57.2 kJ/mol. NIST/CRC standard enthalpies of formation:
 *   NO2(g) +33.18, N2O4(g) +9.16 kJ/mol, so 2(33.18) - 9.16 = +57.2. Gas moles 1 -> 2.
 * - N2 + 3H2 <=> 2NH3: dH = -92 kJ/mol. NH3(g) formation -46.1 kJ/mol, so 2(-46.1) = -92.2.
 *   0620 10.x (Haber process) gives it as exothermic. Gas moles 4 -> 2.
 * - 2SO2 + O2 <=> 2SO3: dH = -197 kJ/mol. SO2(g) -296.8, SO3(g) -395.7 kJ/mol,
 *   so 2(-395.7) - 2(-296.8) = -197.8. 0620 (Contact process) gives it as exothermic.
 *   Gas moles 3 -> 2.
 * - H2(g) + I2(g) <=> 2HI(g): dH = -9.5 kJ/mol. HI(g) +26.48, I2(g) +62.42 kJ/mol, so
 *   2(26.48) - 62.42 = -9.46. Gas moles 2 -> 2: pressure cannot shift it. I2 is a
 *   vapour above 457 K, which is why the dial stays above that.
 *
 * K at the starting temperature is set so the starting balance is a readable
 * mixture (the "base" counts). K then changes with temperature by the van 't Hoff
 * equation, ln(K2/K1) = -(dH/R)(1/T2 - 1/T1), using the real dH above, so the
 * direction of every shift is the real one.
 */
export const EQ_REACTIONS: Record<EqReactionId, EqReaction> = {
  n2o4: {
    id: 'n2o4', name: 'dinitrogen tetroxide and nitrogen dioxide',
    terms: [{ id: 'n2o4', nu: -1 }, { id: 'no2', nu: 2 }], dH: 57.2, T0: 350, step: 10, base: [10, 12],
    aliases: ['n2o4', 'no2', 'dinitrogentetroxide', 'nitrogendioxide', 'browngas'],
  },
  haber: {
    id: 'haber', name: 'the Haber process',
    terms: [{ id: 'n2', nu: -1 }, { id: 'h2', nu: -3 }, { id: 'nh3', nu: 2 }], dH: -92, T0: 723, step: 30, base: [6, 18, 8],
    aliases: ['haber', 'nh3', 'ammonia', 'ammoniasynthesis', 'n23h2'],
  },
  contact: {
    id: 'contact', name: 'the Contact process',
    terms: [{ id: 'so2', nu: -2 }, { id: 'o2', nu: -1 }, { id: 'so3', nu: 2 }], dH: -197, T0: 723, step: 20, base: [14, 7, 14],
    aliases: ['contact', 'so3', 'sulfurtrioxide', 'sulphurtrioxide', 'sulfuricacid', 'so2o2'],
  },
  hi: {
    id: 'hi', name: 'hydrogen and iodine',
    terms: [{ id: 'h2', nu: -1 }, { id: 'i2', nu: -1 }, { id: 'hi', nu: 2 }], dH: -9.5, T0: 700, step: 55, base: [8, 8, 12],
    aliases: ['hi', 'hydrogeniodide', 'hydrogenandiodine', 'h2i2', 'iodine'],
  },
}

export type Lever = 'temperature' | 'pressure' | 'concentration' | 'catalyst'
export const LEVERS: readonly Lever[] = ['temperature', 'pressure', 'concentration', 'catalyst']
export type Amount = 'more' | 'less'

export interface ShiftTask {
  kind: 'shift'
  reaction: EqReactionId
  lever: Lever
  /** The substance the learner is asked to make more or less of. */
  species: SpeciesId
  amount: Amount
  /** For the concentration lever: the substance to add or take out. */
  adjust?: SpeciesId
}

/** Dial positions run from -4 to 4; 0 is where the balance starts. */
export const SHIFT_RANGE = 4
/** The change in the mixture, in particles, that the eye can tell from the flicker. */
export const SHIFT_MIN = 2

const gasMoles = (r: EqReaction, side: 'reactants' | 'products') =>
  r.terms.filter((t) => (side === 'products' ? t.nu > 0 : t.nu < 0)).reduce((a, t) => a + Math.abs(t.nu), 0)

/** The change in gas moles, forward: negative when the forward reaction takes in gas. */
export const deltaMoles = (r: EqReaction) => gasMoles(r, 'products') - gasMoles(r, 'reactants')

export const volumeAt = (pos: number) => Math.exp(-0.2 * pos)

export function temperatureAt(r: EqReaction, pos: number): number {
  return r.T0 + r.step * pos
}

/** K at a temperature, from the starting balance and the van 't Hoff equation. */
export function equilibriumConstant(r: EqReaction, T: number): number {
  const K0 = r.terms.reduce((k, t, i) => k * Math.pow(r.base[i], t.nu), 1)
  return K0 * Math.exp(-((r.dH * 1000) / R_GAS) * (1 / T - 1 / r.T0))
}

/** The amounts at balance for some starting amounts, a volume and a temperature (bisection on the extent). */
export function settle(r: EqReaction, n0: number[], V: number, T: number): number[] {
  const lnK = Math.log(equilibriumConstant(r, T))
  let lo = -Infinity
  let hi = Infinity
  r.terms.forEach((t, i) => {
    const bound = -n0[i] / t.nu
    if (t.nu > 0) lo = Math.max(lo, bound)
    else hi = Math.min(hi, bound)
  })
  const f = (x: number) =>
    r.terms.reduce((s, t, i) => s + t.nu * Math.log(Math.max(1e-12, n0[i] + t.nu * x) / V), 0) - lnK
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2
    if (f(mid) > 0) hi = mid
    else lo = mid
  }
  const x = (lo + hi) / 2
  return r.terms.map((t, i) => Math.max(0, n0[i] + t.nu * x))
}

export function termIndex(r: EqReaction, id: SpeciesId): number {
  return r.terms.findIndex((t) => t.id === id)
}

/** How many particles of the adjusted substance the dial adds (or takes out, below 0). */
export function addedAt(r: EqReaction, adjust: SpeciesId, pos: number): number {
  const i = termIndex(r, adjust)
  return i < 0 ? 0 : (pos * r.base[i]) / 6
}

/** The mixture at balance after the lever is set to a position. */
export function amountsAt(t: ShiftTask, pos: number): number[] {
  const r = EQ_REACTIONS[t.reaction]
  const n0 = r.base.slice()
  let V = 1
  let T = r.T0
  if (t.lever === 'temperature') T = temperatureAt(r, pos)
  else if (t.lever === 'pressure') V = volumeAt(pos)
  else if (t.lever === 'concentration' && t.adjust) {
    const i = termIndex(r, t.adjust)
    if (i >= 0) n0[i] += addedAt(r, t.adjust, pos)
  }
  return settle(r, n0, V, T)
}

/** How much more (or less, below 0) of the asked substance there is than at the start. */
export function changeIn(t: ShiftTask, pos: number): number {
  const r = EQ_REACTIONS[t.reaction]
  const i = termIndex(r, t.species)
  if (i < 0) return 0
  return amountsAt(t, pos)[i] - amountsAt(t, 0)[i]
}

const sign = (a: Amount) => (a === 'more' ? 1 : -1)
const shiftOk = (t: ShiftTask, pos: number) => sign(t.amount) * changeIn(t, pos) >= SHIFT_MIN

function bestPos(t: ShiftTask): number {
  let best = 0
  let score = -Infinity
  for (let p = -SHIFT_RANGE; p <= SHIFT_RANGE; p++) {
    const s = sign(t.amount) * changeIn(t, p)
    if (s > score + 1e-9) { score = s; best = p }
  }
  return best
}

/** What the learner made, in a word. */
export function shiftMade(t: ShiftTask, pos: number): 'more' | 'less' | 'about the same amount of' {
  const c = changeIn(t, pos)
  return c >= 0.75 ? 'more' : c <= -0.75 ? 'less' : 'about the same amount of'
}

const names = (r: EqReaction, side: 'reactants' | 'products') =>
  r.terms.filter((x) => (side === 'products' ? x.nu > 0 : x.nu < 0)).map((x) => SPECIES[x.id].name).join(' and ')

/** Which side the balance moved toward, by the rules. */
export function shiftToward(t: ShiftTask, pos: number): 'products' | 'reactants' | 'neither' {
  const r = EQ_REACTIONS[t.reaction]
  const a = amountsAt(t, pos)
  const b = amountsAt(t, 0)
  const pi = r.terms.findIndex((x) => x.nu > 0)
  const d = (a[pi] - b[pi]) / Math.abs(r.terms[pi].nu)
  return d > 0.05 ? 'products' : d < -0.05 ? 'reactants' : 'neither'
}

/** Why it moved that way, once marked. Never shown before. */
export function explainShift(t: ShiftTask, pos: number): string {
  const r = EQ_REACTIONS[t.reaction]
  const toward = shiftToward(t, pos)
  if (toward === 'neither') {
    return t.lever === 'pressure' && deltaMoles(r) === 0
      ? 'Squeezing or stretching changes nothing here: the same number of gas molecules are on each side, so neither direction gains.'
      : 'The balance did not move.'
  }
  const into = names(r, toward)
  if (t.lever === 'temperature') {
    return `${pos > 0 ? 'Heating' : 'Cooling'} pushes the balance the way that ${pos > 0 ? 'takes in' : 'gives out'} heat. That is the reaction making ${into}. Both directions still run; one now runs faster until the balance settles again.`
  }
  if (t.lever === 'pressure') {
    return `${pos > 0 ? 'Squeezing' : 'Stretching'} the gas pushes the balance toward the side with ${pos > 0 ? 'fewer' : 'more'} gas molecules. Here that is ${into}.`
  }
  const a = t.adjust ? SPECIES[t.adjust].name : 'the substance'
  return pos > 0
    ? `Adding ${a} makes it collide more often, so the reaction that uses it up wins for a while: the balance moved toward ${into}.`
    : `Taking out ${a} makes the reaction that makes it the winner for a while: the balance moved toward ${into}.`
}

// ---------------------------------------------------------------------------
// Reading what a writer wrote
// ---------------------------------------------------------------------------

const SUB: Record<string, string> = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4' }
/** Lower case, subscripts as digits, no spaces, hyphens or "(g)". */
const norm = (raw: unknown) =>
  typeof raw === 'string'
    ? raw.toLowerCase().replace(/[₀-₄]/g, (c) => SUB[c]).replace(/\((g|aq|s|l)\)/g, '').replace(/[^a-z0-9]/g, '')
    : ''

function rateReactionOf(raw: unknown): RateReactionId | null {
  const s = norm(raw)
  if (!s) return null
  if (/marble|calciumcarbonate|limestone|chalk/.test(s)) return 'marble'
  if (/thiosulfate|thiosulphate|disappearingcross/.test(s)) return 'thiosulfate'
  if (/magnesium/.test(s)) return 'magnesium'
  if (/haber|ammonia|nitrogen/.test(s)) return 'haber'
  if (/contact|sulfurdioxide|sulphurdioxide|so2|sulfuric|sulphuric/.test(s)) return 'contact'
  return null
}

function eqReactionOf(raw: unknown): EqReactionId | null {
  const s = norm(raw)
  if (!s) return null
  if (/n2o4|dinitrogen|nitrogendioxide|no2/.test(s)) return 'n2o4'
  if (/haber|ammonia|nh3|nitrogenandhydrogen/.test(s)) return 'haber'
  if (/contact|so3|sulfur|sulphur/.test(s)) return 'contact'
  if (/iodine|hydrogeniodide|^hi$|h2i2/.test(s)) return 'hi'
  return null
}

function speciesOf(raw: unknown): SpeciesId | null {
  const s = norm(raw)
  if (!s) return null
  return (Object.keys(SPECIES) as SpeciesId[]).find((id) => SPECIES[id].aliases.includes(s)) ?? null
}

function conditionOf(raw: unknown): Condition | null {
  const s = norm(raw)
  if (/temp|heat|warm|hot/.test(s)) return 'temperature'
  if (/concentr|pressure/.test(s)) return 'concentration'
  if (/surface|size|powder|crush|particlesize/.test(s)) return 'surface area'
  if (/catal/.test(s)) return 'catalyst'
  return null
}

function leverOf(raw: unknown): Lever | null {
  const s = norm(raw)
  if (/temp|heat/.test(s)) return 'temperature'
  if (/press|volume|squeez|compress/.test(s)) return 'pressure'
  if (/concentr|amount|add/.test(s)) return 'concentration'
  if (/catal/.test(s)) return 'catalyst'
  return null
}

export interface RatesEquilibriumConfig { task: SpeedTask | ShiftTask }
/** The dial's position, an integer. */
export interface RatesEquilibriumState { pos: number }

const kindOf = (raw: unknown) => {
  const s = norm(raw)
  if (/^(speed|rate|changerate|makefaster|makeslower|faster|slower)/.test(s)) return 'speed'
  if (/^(shift|equilibrium|disturb|balance|lechatelier)/.test(s)) return 'shift'
  return null
}

// ---------------------------------------------------------------------------
// What a writer can fix
// ---------------------------------------------------------------------------

/** A shift that works on a reaction, said as a writer would put it, for a refusal to point to. */
function workingShift(r: EqReaction): { task: ShiftTask; says: string } | null {
  for (const lever of ['temperature', 'pressure', 'concentration'] as const) {
    for (const t of r.terms) {
      for (const amount of ['more', 'less'] as const) {
        for (const a of lever === 'concentration' ? r.terms.filter((x) => x.id !== t.id) : [undefined]) {
          const task: ShiftTask = { kind: 'shift', reaction: r.id, lever, species: t.id, amount, ...(a ? { adjust: a.id } : {}) }
          if (shiftOk(task, bestPos(task))) {
            const lv = lever === 'concentration' ? `the amount of ${SPECIES[a!.id].name}` : lever
            return { task, says: `"${amount} ${SPECIES[t.id].name}" with ${lv} as the lever` }
          }
        }
      }
    }
  }
  return null
}

function speedExample(): string {
  return 'e.g. { "reaction": "marble chips and hydrochloric acid", "condition": "surface area", "goal": "faster" }'
}

export function speedFaults(t: SpeedTask): string[] {
  const r = RATE_REACTIONS[t.reaction]
  if (t.condition === 'surface area' && !r.solid) {
    return [`${r.name} has no solid in it, so surface area changes nothing: choose a reaction with a solid (marble chips and hydrochloric acid, or magnesium and hydrochloric acid), or another condition. ${speedExample()}`]
  }
  if (t.condition === 'catalyst' && !r.catalyst) {
    return [`${r.name} has no catalyst in the syllabus: use "nitrogen and hydrogen" (iron) or "sulfur dioxide and oxygen" (vanadium(V) oxide), or another condition.`]
  }
  return []
}

export function shiftFaults(t: ShiftTask): string[] {
  const r = EQ_REACTIONS[t.reaction]
  const out: string[] = []
  const example = workingShift(r)
  const eg = example ? ` For example: ${example.says}.` : ''
  if (termIndex(r, t.species) < 0) {
    return [`${SPECIES[t.species].name} is not in ${r.name} (it has ${r.terms.map((x) => SPECIES[x.id].name).join(', ')}).${eg}`]
  }
  if (t.lever === 'catalyst') {
    return [`A catalyst speeds both directions equally, so it never moves where the balance settles and nothing the learner does could meet the goal. Use temperature, pressure or concentration.${eg}`]
  }
  if (t.lever === 'concentration') {
    if (!t.adjust) return [`The concentration lever needs "adjust": the substance the learner adds or takes out.${eg}`]
    if (termIndex(r, t.adjust) < 0) return [`${SPECIES[t.adjust].name} is not in ${r.name} (it has ${r.terms.map((x) => SPECIES[x.id].name).join(', ')}).${eg}`]
    if (t.adjust === t.species) return [`Adding or taking out ${SPECIES[t.species].name} itself would make the goal true by definition. Adjust a different substance.${eg}`]
  }
  if (t.lever === 'pressure' && deltaMoles(r) === 0) {
    out.push(`Pressure cannot shift ${r.name}: there are the same number of gas molecules on each side. Use temperature instead, or another reaction.${eg}`)
    return out
  }
  if (!shiftOk(t, bestPos(t))) {
    out.push(`With ${t.lever === 'concentration' ? `the amount of ${SPECIES[t.adjust!].name}` : t.lever} as the lever, ${r.name} cannot be made to have ${t.amount} ${SPECIES[t.species].name} by enough to see (${SHIFT_MIN} particles).${eg}`)
  }
  return out
}

// ---------------------------------------------------------------------------
// The engine
// ---------------------------------------------------------------------------

const clampPos = (t: SpeedTask | ShiftTask, raw: unknown, fallback: number) => {
  const lo = t.kind === 'shift' ? -SHIFT_RANGE : 0
  const hi = t.kind === 'shift' ? SHIFT_RANGE : STOPS[t.condition] - 1
  const n = typeof raw === 'number' && Number.isFinite(raw) ? Math.round(raw) : fallback
  return Math.max(lo, Math.min(hi, n))
}

/** The lowest and highest dial positions. */
export function posRange(t: SpeedTask | ShiftTask): [number, number] {
  return t.kind === 'shift' ? [-SHIFT_RANGE, SHIFT_RANGE] : [0, STOPS[t.condition] - 1]
}

export const ratesEquilibriumEngine: SceneEngine<RatesEquilibriumConfig, RatesEquilibriumState> = {
  id: 'rates-equilibrium',
  // Single, telling words: a station is matched on any word of a topic, so "rates" or "theory" or "energy"
  // would pull this entry into exchange rates, heart rates, atomic theory and energy stores.
  covers: ['catalysts', 'catalyst', 'Chatelier', 'kinetics', 'Haber'],
  phrases: ['rates of reaction', 'rate of reaction', 'reaction rates', 'reaction rate', 'speed of reaction', 'collision theory', 'activation energy', 'dynamic equilibrium', 'chemical equilibrium', 'reversible reactions', 'reversible reaction', 'position of equilibrium', 'equilibrium position'],
  isolates: 'consequence',

  parse(raw) {
    const r = raw as { task?: Record<string, unknown> } | null
    const k = kindOf(r?.task?.kind)
    const t = r?.task
    if (!t || !k) return null
    if (k === 'speed') {
      const reaction = rateReactionOf(t.reaction)
      const condition = conditionOf(t.condition)
      const g = norm(t.goal)
      const goal: Goal | null = /fast|quick|speed|increas|more/.test(g) ? 'faster' : /slow|decreas|less|reduc/.test(g) ? 'slower' : null
      if (!reaction || !condition || !goal) return null
      return { task: { kind: 'speed', reaction, condition, goal } }
    }
    const reaction = eqReactionOf(t.reaction)
    const lever = leverOf(t.lever)
    const species = speciesOf(t.species)
    const a = norm(t.amount)
    const amount: Amount | null = /more|increas|greater|higher|extra/.test(a) ? 'more' : /less|fewer|decreas|lower|reduc/.test(a) ? 'less' : null
    if (!reaction || !lever || !species || !amount) return null
    const adjust = t.adjust === undefined ? undefined : speciesOf(t.adjust)
    if (t.adjust !== undefined && !adjust) return null
    return { task: { kind: 'shift', reaction, lever, species, amount, ...(adjust ? { adjust } : {}) } }
  },

  faults(config) {
    return config.task.kind === 'speed' ? speedFaults(config.task) : shiftFaults(config.task)
  },

  promptFaults(config, prompt) {
    const p = prompt.toLowerCase()
    const t = config.task
    if (t.kind === 'speed') {
      const said: Record<Condition, RegExp> = {
        temperature: /\b(heat\w*|hot(ter)?|warm\w*|cool\w*|cold\w*|raise|lower|higher|boil\w*|ice)\b/,
        concentration: /\b(more|less|fewer|concentrated|dilut\w*|add|remove|squeez\w*|compress\w*|higher|lower)\b/,
        'surface area': /\b(crush\w*|grind\w*|ground|powder\w*|lumps?|smaller|finer|fine|break\w*|chop\w*|bigger|larger)\b/,
        catalyst: /\b(add|adding|remove|removing|take\s+away|use|using|with|without|put\s+in)\b[^.?!]*\bcatalyst/,
      }
      if (said[t.condition].test(p)) {
        return [`the prompt gives away which way to set the dial (it says to heat, crush, add or similar): ask for the speed only, e.g. "${t.condition === 'catalyst' ? 'Find out what the catalyst does: make this reaction go faster.' : `Change the ${t.condition} so the reaction goes faster.`}"`]
      }
      return []
    }
    const out: string[] = []
    if (/\b(shift\w*|favou?r\w*|left|right|forwards?|backwards?|reverse|endothermic|exothermic|le\s+chatelier|heat\w*|hot(ter)?|cool\w*|cold\w*|compress\w*|squeez\w*|add|remove|raise|lower|higher|increase|decrease)\b/.test(p)) {
      out.push('the prompt gives away which way the balance moves or how to set the lever (it says heat, cool, squeeze, add, a direction, or which reaction takes in heat): ask only for the result, e.g. "Use the lever to make more ammonia in the mixture."')
    }
    if (/(Δh|delta\s*h|kj|\bmoles?\b)/.test(p)) out.push('the prompt gives the enthalpy change or the gas moles, which the learner is to work out from what the chamber does: leave them out.')
    return out
  },

  initial(config) {
    const t = config.task
    return { pos: t.kind === 'speed' ? startPos(t) : 0 }
  },

  check(config, state) {
    const t = config.task
    const pos = clampPos(t, state?.pos, t.kind === 'speed' ? startPos(t) : 0)
    return { ok: t.kind === 'speed' ? speedOk(t, pos) : shiftOk(t, pos), wrongIds: [] }
  },

  solve(config) {
    const t = config.task
    if (t.kind === 'shift') return { pos: bestPos(t) }
    const stops = STOPS[t.condition]
    // The end of the dial that goes the asked way.
    let best = startPos(t)
    let score = t.goal === 'faster' ? -Infinity : Infinity
    for (let p = 0; p < stops; p++) {
      const s = speedRatio(t, p)
      if (t.goal === 'faster' ? s > score : s < score) { score = s; best = p }
    }
    return { pos: best }
  },

  View: RatesEquilibriumView,

  prompt: `SCENE "rates-equilibrium" -- one chamber of particles for the two ideas students get backwards. The learner
  handles ONE dial and watches the particles answer. Two task kinds:
  1. "speed" -- a reaction in the chamber (acid, marble, thiosulfate, nitrogen and hydrogen ...). The dial is ONE
     condition. Particles move; collisions that are hard enough flash and react, the rest bounce. A small energy
     ruler shows how hard hits are and how hard a hit must be. Before marking nothing says which way to turn the
     dial; the mark compares successful collisions with where the dial started.
  2. "shift" -- a reversible reaction at balance (N2O4 and NO2, the Haber process, the Contact process, hydrogen and
     iodine). Both directions keep running (rings of two kinds). The dial disturbs it: temperature, pressure (a
     lid) or the amount of one substance. The learner is asked to make MORE or LESS of one substance and works out
     the way by moving the dial and watching it shift and settle. The page never shows the enthalpy, gas moles or the
     direction of a shift before marking; the explanation (Le Chatelier) appears with the mark.
  For: rates of reaction, collision theory, activation energy, catalysts, dynamic equilibrium, Le Chatelier, Haber,
  Contact. Do NOT print in the prompt which way to turn the dial (heat it, crush it, add) or which way a balance
  shifts; ask for the result only.
  speed config: { "task": { "kind":"speed", "reaction":"<marble chips and hydrochloric acid | magnesium and
          hydrochloric acid | sodium thiosulfate and hydrochloric acid | nitrogen and hydrogen | sulfur dioxide and
          oxygen>", "condition":"<temperature | concentration | surface area | catalyst>", "goal":"<faster | slower>" } }
          surface area needs a solid (the first two reactions); catalyst needs nitrogen and hydrogen (iron) or sulfur
          dioxide and oxygen (vanadium(V) oxide). concentration is called pressure for the gas reactions.
  shift config: { "task": { "kind":"shift", "reaction":"<N2O4 and NO2 | Haber | Contact | hydrogen and iodine>",
          "lever":"<temperature | pressure | concentration>", "species":"<the substance to change, e.g. ammonia>",
          "amount":"<more | less>", "adjust":"<concentration lever only: another substance to add or take out>" } }
          Pressure cannot shift hydrogen and iodine (equal gas molecules); a catalyst cannot shift any balance.
          species and adjust are chosen from the reaction: N2O4/NO2; nitrogen/hydrogen/ammonia;
          sulfur dioxide/oxygen/sulfur trioxide; hydrogen/iodine/hydrogen iodide.
  A catalyst lesson may name the catalyst, but says only what to achieve, never to use it or leave it out:
  "Find out what the catalyst does: make this reaction go faster."
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Change the temperature so the reaction goes faster.",
    "payload": { "engine":"rates-equilibrium", "config": { "task": { "kind":"speed", "reaction":"sodium thiosulfate and hydrochloric acid", "condition":"temperature", "goal":"faster" } } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:rates-equilibrium", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Use the pressure lid to make more ammonia in the mixture.",
    "payload": { "engine":"rates-equilibrium", "config": { "task": { "kind":"shift", "reaction":"Haber", "lever":"pressure", "species":"ammonia", "amount":"more" } } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:rates-equilibrium", "why":"..." } }`,
}

registerEngine(ratesEquilibriumEngine as SceneEngine<unknown, unknown>)
