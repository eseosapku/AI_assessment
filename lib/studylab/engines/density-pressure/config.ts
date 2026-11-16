// lib/studylab/engines/density-pressure/config.ts
//
// A real tank, real blocks and a real scale, for density, floating and pressure. The learner handles one thing per task and
// the picture answers at once:
//   load  -- a wooden (or ice, or plastic) block floats in a tank. Stack weights on it until it is about to go under:
//            the waterline climbs the block, the tank rises, and one weight too many sinks it to the floor;
//   press -- a brick stands on foam on a kitchen scale. Turn it onto another face, or stack a second brick, and the foam
//            dents deeper or shallower while the scale reading stays put. Match the dent to a dashed line with as few
//            bricks as you can;
//   dive  -- a pressure gauge on a tube, its capsule lowered into a liquid. Water gave a reading at some depth; find the
//            depth in another liquid that gives the same reading.
//
// The rules, all computed here and never read from the drawing:
//   floating: a block floats while its whole load (block + weights) is no more than the mass of liquid its volume could push
//   aside, which for the one fixed 1000 cm3 block is the liquid's density in kg/m3 read as grams; floating, it sinks into the
//   liquid until it has pushed aside its own mass (depth = mass / (density x footprint)); the tank rises by the volume pushed aside;
//   pressure in a solid: p = F / A with F = 20 N a brick (2 kg, g = 10 N/kg) and A the face it rests on (200, 100 or 50 cm2),
//   so p is 1, 2 or 4 kPa a brick;
//   pressure in a liquid: p = density x g x depth, gauge pressure, g = 10 N/kg.
//
// Data (typical values, every one a whole number of kg/m3 so the marking is exact integer arithmetic):
//   balsa 160, cork 240, pine 500, oak 700, ice 917 (at 0 C), polythene 950 (HDPE 940-970): the Engineering ToolBox's tables
//   of solids and the CRC Handbook's, rounded to a figure the syllabuses use;
//   water 1000, sea water 1030, saturated brine 1200 (NaCl, 20 C: 1.197 g/cm3), paraffin (kerosene) 800.
//   A wood's density varies a great deal with species and dryness, so each is a named typical figure printed on the card.
//
// Ideas taken, never code or art:
//   - the block you load until it goes under, and the density table beside the tank: PhET's Density simulation (the
//     "scale + tank + blocks" frame; I found classroom guides to it, not its research);
//   - a contrast of a heavy low-density block with a light dense one, to break "heavy things sink": the IOP SPARK page on
//     floating and sinking, and the Schwichow 2024 meta-analysis (density-based teaching works on the weight-or-size preconception);
//   - liquid pressure belongs to depth and the liquid, not to the shape or the amount of water: the Heliyon 4-tier study of
//     hydrostatic pressure (2024) and physicslens' hydrostatic paradox page; hence the dive task compares liquids at a fixed reading.
// Refused:
//   - container shapes, the hydrostatic paradox as a drawing, hydraulics, atmospheric pressure and gas pressure (`particles`
//     draws gas pressure): each is a different act;
//   - boats of hollow shape (ships float because of their shape): that needs a hull, and a fixed block says nothing about it;
//   - a free choice of mass and volume: every number is fixed so each answer is a whole number of weights, bricks or centimetres.

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { DensityPressureView } from './View'

// ---------------------------------------------------------------------------
// The things on the bench.

export const BLOCKS = {
  balsa: { rho: 160 },
  cork: { rho: 240 },
  pine: { rho: 500 },
  oak: { rho: 700 },
  ice: { rho: 917 },
  polythene: { rho: 950 },
} as const
export type BlockName = keyof typeof BLOCKS
export const BLOCK_NAMES = Object.keys(BLOCKS) as BlockName[]

/** Recognised, but denser than every liquid on the card: it sinks, so there is no load to find. */
const SINKERS = ['steel', 'iron', 'aluminium', 'aluminum', 'copper', 'brass', 'lead', 'gold', 'silver', 'glass', 'brick', 'concrete', 'granite', 'stone', 'rock', 'marble', 'rubber', 'ebony', 'zinc', 'tin', 'bronze']

export const LIQUIDS = {
  water: { rho: 1000 },
  'sea water': { rho: 1030 },
  brine: { rho: 1200 },
  paraffin: { rho: 800 },
} as const
export type LiquidName = keyof typeof LIQUIDS
export const LIQUID_NAMES = Object.keys(LIQUIDS) as LiquidName[]
/** The liquids a gauge can be lowered into: water is the reference, so it is not offered. */
export const DIVE_LIQUIDS = ['paraffin', 'brine'] as const

/** The block's footprint, and the tank it floats in, in cm. */
export const RAFT = { w: 20, d: 10, h: 5 }
export const RAFT_VOLUME = RAFT.w * RAFT.d * RAFT.h
export const TANK = { water: 12, section: 30 * 14, rim: 22, wide: 30 }
/** A floating block must stand this much of its height above the surface when empty, or one weight moves nothing you can see. */
export const MIN_FREEBOARD = 0.2

export const UNITS = [250, 200, 150, 125, 100, 80, 75, 60, 50, 40, 30, 25, 20, 15, 10]

export const BRICK = { l: 20, w: 10, h: 5, newtons: 20, kg: 2 }
/** The faces a brick can rest on: its footprint in cm2, how wide and deep it looks from the front, and how tall it stands. */
export const FACES = [
  { area: 200, wide: 20, deep: 10, high: 5, label: '20 × 10 cm' },
  { area: 100, wide: 20, deep: 5, high: 10, label: '20 × 5 cm' },
  { area: 50, wide: 10, deep: 5, high: 20, label: '10 × 5 cm' },
] as const
export const MAX_BRICKS = 2
export const TARGETS = [1, 2, 4, 8]
export const DENT_PER_KPA = 5 // px

export const DIVE_DEPTH = 32
export const DIAL_MAX = 4

// ---------------------------------------------------------------------------
// Configs and state.

export type DPConfig =
  /** load: the block that floats and the liquid it floats in. Names outside the lists still parse; faults says what would work. */
  | { task: 'load'; block: string; liquid: string }
  /** press: the pressure of the dashed dent, in kPa. */
  | { task: 'press'; target: number }
  /** dive: the liquid to dive in, and how deep (cm) the gauge went in water to set the marker. */
  | { task: 'dive'; liquid: string; reference: number }

/** What the learner has set: weights on the block, or the brick's face and count, or the gauge's depth. */
export type DPState = { weights?: number; face?: number; bricks?: number; depth?: number }

const has = (o: object, k: string | number) => Object.prototype.hasOwnProperty.call(o, k)
const whole = (v: unknown, lo: number, hi: number, fallback: number) => (typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi ? v : fallback)

// ---------------------------------------------------------------------------
// Floating.

/** Whole grams of load per weight, chosen so that between 3 and 6 fit and the last one leaves a clear margin. */
export function weightUnit(spare: number): number | null {
  for (const w of UNITS) {
    const n = Math.floor(spare / w)
    const rest = (spare - n * w) / w
    if (n >= 3 && n <= 6 && rest >= 0.15 && rest <= 0.85) return w
  }
  return null
}

export const blockOf = (c: { block: string }) => (has(BLOCKS, c.block) ? BLOCKS[c.block as BlockName] : BLOCKS.pine)
export const liquidOf = (name: string) => (has(LIQUIDS, name) ? LIQUIDS[name as LiquidName] : LIQUIDS.water)

/** The block's share of its height that stands clear of the liquid when it carries nothing. */
export const freeboard = (blockRho: number, liquidRho: number) => (liquidRho - blockRho) / liquidRho

/** What a load config sets out: the block's mass, the liquid's, the weight, and the most weights that float. Null when it cannot be drawn. */
export function loadPlan(c: { block: string; liquid: string }): { mass: number; liquid: number; unit: number; most: number } | null {
  if (!has(BLOCKS, c.block) || !has(LIQUIDS, c.liquid)) return null
  const mass = BLOCKS[c.block as BlockName].rho
  const liquid = LIQUIDS[c.liquid as LiquidName].rho
  if (mass >= liquid || freeboard(mass, liquid) < MIN_FREEBOARD) return null
  const unit = weightUnit(liquid - mass)
  return unit === null ? null : { mass, liquid, unit, most: Math.floor((liquid - mass) / unit) }
}

export const weightsOf = (state: DPState, most: number) => whole(state?.weights, 0, most + 2, 0)

/** Where the block and the water stand, in cm above the tank floor. */
export function loadFrame(plan: { mass: number; liquid: number; unit: number }, weights: number) {
  const total = plan.mass + weights * plan.unit
  const floats = total <= plan.liquid
  const pushed = floats ? (RAFT_VOLUME * total) / plan.liquid : RAFT_VOLUME
  const level = TANK.water + pushed / TANK.section
  const sunk = floats ? (RAFT.h * total) / plan.liquid : RAFT.h
  return { total, floats, level, sunk, bottom: floats ? level - sunk : 0 }
}

// ---------------------------------------------------------------------------
// Pressure in a solid.

export const bricksOf = (state: DPState) => whole(state?.bricks, 1, MAX_BRICKS, 1)
export const faceOf = (state: DPState) => whole(state?.face, 0, FACES.length - 1, 0)
/** kPa: 20 N a brick over the face in cm2 (1 N per cm2 is 10 kPa). */
export const pressureOf = (state: DPState) => (bricksOf(state) * BRICK.newtons * 10) / FACES[faceOf(state)].area

/** The fewest bricks that make this pressure, and the face to stand them on. */
export function pressAnswer(target: number): { face: number; bricks: number } | null {
  for (let bricks = 1; bricks <= MAX_BRICKS; bricks++) {
    const face = FACES.findIndex((f) => (bricks * BRICK.newtons * 10) / f.area === target)
    if (face >= 0) return { face, bricks }
  }
  return null
}

// ---------------------------------------------------------------------------
// Pressure in a liquid.

export const depthOf = (state: DPState) => whole(state?.depth, 0, DIVE_DEPTH, 0)
const rhoOfDive = (liquid: string) => (liquid === 'brine' ? LIQUIDS.brine.rho : LIQUIDS.paraffin.rho)
/** kPa read at a depth (cm) in a liquid of density rho: rho x 10 N/kg x depth. */
export const reading = (rho: number, depth: number) => (rho * depth) / 10000
/** The whole-centimetre depth in this liquid that reads what `reference` cm reads in water, or null when it is not a whole number in the tank. */
export function diveAnswer(liquid: string, reference: number): number | null {
  if (!(DIVE_LIQUIDS as readonly string[]).includes(liquid) || !Number.isInteger(reference)) return null
  const rho = rhoOfDive(liquid)
  const depth = (reference * LIQUIDS.water.rho) / rho
  return Number.isInteger(depth) && depth >= 4 && depth <= DIVE_DEPTH && reference >= 4 ? depth : null
}
export const stepOfReference = (liquid: string) => (liquid === 'brine' ? 6 : 4)
export const DEFAULT_REFERENCE: Record<string, number> = { paraffin: 16, brine: 18 }
export const validReferences = (liquid: string): number[] => {
  const out: number[] = []
  for (let r = 4; r <= 60; r++) if (diveAnswer(liquid, r) !== null) out.push(r)
  return out
}

// ---------------------------------------------------------------------------
// Marking: from the rule, always.

export function done(c: DPConfig, state: DPState): boolean {
  if (c.task === 'load') {
    const plan = loadPlan(c)
    return plan !== null && weightsOf(state, plan.most) === plan.most
  }
  if (c.task === 'press') {
    const want = pressAnswer(c.target)
    return want !== null && pressureOf(state) === c.target && bricksOf(state) === want.bricks
  }
  const answer = diveAnswer(c.liquid, c.reference)
  return answer !== null && depthOf(state) === answer
}

// ---------------------------------------------------------------------------
// What is said once marked. Before that the card holds only what the apparatus shows.

const say = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
const cm3 = (n: number) => `${n} cm³`
const kpa = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(2).replace(/0$/, '')} kPa`

export function working(c: DPConfig, state: DPState): string {
  if (c.task === 'load') {
    const plan = loadPlan(c)
    if (!plan) return `Yes.`
    const total = plan.mass + plan.most * plan.unit
    return `Yes. ${say(plan.most, 'weight', 'weights')} is the most, ${total} g in all. A floating block pushes aside its own weight of ${c.liquid}, and the most it can push aside is its whole volume: ${cm3(RAFT_VOLUME)} of ${c.liquid} weighs ${plan.liquid} g. One more weight of ${plan.unit} g would push the load past that, so it would sink.`
  }
  if (c.task === 'press') {
    const f = FACES[faceOf(state)]
    const n = bricksOf(state)
    const force = n * BRICK.newtons
    return `Yes. ${say(n, 'brick', 'bricks')} on the ${f.label} face is ${kpa(pressureOf(state))}. Pressure is force ÷ area: ${force} N on ${f.area} cm² is ${force / f.area} N for each cm², and 1 N per cm² is 10 kPa. A second brick doubles the force; a face half the size doubles the pressure.`
  }
  const answer = diveAnswer(c.liquid, c.reference)
  if (answer === null) return `Yes.`
  const rho = rhoOfDive(c.liquid)
  const denser = rho > LIQUIDS.water.rho
  return `Yes. That is the same reading as ${c.reference} cm in water. ${answer} cm in ${c.liquid} reads ${kpa(reading(rho, answer))}. Pressure is density × g × depth: ${rho} kg/m³ × 10 N/kg × ${answer / 100} m. ${c.liquid[0].toUpperCase()}${c.liquid.slice(1)} is ${denser ? 'denser' : 'less dense'} than water, so the same reading comes ${denser ? 'less deep' : 'deeper'}.`
}

/** What a wrong card says: what the learner made, never where the answer is. */
export function madeText(c: DPConfig, state: DPState): string {
  if (c.task === 'load') {
    const plan = loadPlan(c)
    if (!plan) return `Nothing is on the block yet.`
    const n = weightsOf(state, plan.most)
    const f = loadFrame(plan, n)
    if (n === 0) return `Nothing is on the ${c.block} block yet, and it floats high.`
    if (!f.floats) return `You put ${say(n, 'weight', 'weights')} on it, ${f.total} g in all, and the ${c.block} block has sunk.`
    return `You put ${say(n, 'weight', 'weights')} on it, ${f.total} g in all, and the ${c.block} block still floats with room to spare.`
  }
  if (c.task === 'press') {
    const n = bricksOf(state)
    const f = FACES[faceOf(state)]
    const p = pressureOf(state)
    if (p === c.target) return `${kpa(p)} reaches the line, but with ${say(n, 'brick', 'bricks')}. The same dent can be made with fewer.`
    return `You pressed with ${kpa(p)}: ${n * BRICK.newtons} N on ${f.area} cm². That ${p < c.target ? 'does not reach' : 'goes past'} the line.`
  }
  const d = depthOf(state)
  const rho = rhoOfDive(c.liquid)
  if (d === 0) return `The capsule is still at the surface, and the gauge reads 0.`
  return `At ${d} cm in ${c.liquid} the gauge reads ${kpa(reading(rho, d))}, which is not at the marker.`
}

// ---------------------------------------------------------------------------
// Reading the tutor's config.

const keyOf = (raw: unknown) => (typeof raw === 'string' ? raw.trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : '')
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)

const TASK_WORDS: Record<string, 'load' | 'press' | 'dive'> = {
  load: 'load', loads: 'load', loading: 'load', float: 'load', floats: 'load', floating: 'load', 'float-or-sink': 'load', 'sink-or-float': 'load', 'floating-and-sinking': 'load', sink: 'load', sinking: 'load',
  buoyancy: 'load', upthrust: 'load', flotation: 'load', capacity: 'load', 'load-the-block': 'load', density: 'load', raft: 'load', weights: 'load', predict: 'load', 'archimedes-principle': 'load', archimedes: 'load',
  press: 'press', pressure: 'press', 'solid-pressure': 'press', 'pressure-in-solids': 'press', 'pressure-on-solids': 'press', solid: 'press', solids: 'press', area: 'press', brick: 'press', bricks: 'press', dent: 'press', foam: 'press', force: 'press', 'force-and-area': 'press',
  dive: 'dive', depth: 'dive', gauge: 'dive', 'pressure-gauge': 'dive', 'liquid-pressure': 'dive', 'pressure-in-liquids': 'dive', 'pressure-in-fluids': 'dive', 'fluid-pressure': 'dive', 'pressure-and-depth': 'dive', 'pressure-at-depth': 'dive', liquid: 'dive', liquids: 'dive', fluid: 'dive', hydrostatic: 'dive', deep: 'dive', 'water-pressure': 'dive',
}

const BLOCK_WORDS: Record<string, string> = {
  pine: 'pine', 'pine-wood': 'pine', pinewood: 'pine', softwood: 'pine', 'soft-wood': 'pine', wood: 'pine', wooden: 'pine', timber: 'pine', 'wooden-block': 'pine', 'wood-block': 'pine', fir: 'pine', spruce: 'pine',
  oak: 'oak', 'oak-wood': 'oak', hardwood: 'oak', 'hard-wood': 'oak', 'oak-block': 'oak',
  balsa: 'balsa', 'balsa-wood': 'balsa',
  cork: 'cork', 'cork-block': 'cork',
  ice: 'ice', 'ice-block': 'ice', 'ice-cube': 'ice', 'block-of-ice': 'ice', iceberg: 'ice',
  polythene: 'polythene', polyethylene: 'polythene', plastic: 'polythene', hdpe: 'polythene', 'plastic-block': 'polythene', pe: 'polythene',
}

const LIQUID_WORDS: Record<string, string> = {
  water: 'water', 'fresh-water': 'water', freshwater: 'water', 'tap-water': 'water', 'pure-water': 'water',
  'sea-water': 'sea water', seawater: 'sea water', 'salt-water': 'sea water', 'salty-water': 'sea water', ocean: 'sea water', 'ocean-water': 'sea water', sea: 'sea water',
  brine: 'brine', 'saturated-brine': 'brine', 'concentrated-brine': 'brine', 'saturated-salt-solution': 'brine',
  paraffin: 'paraffin', kerosene: 'paraffin', 'paraffin-oil': 'paraffin', 'lamp-oil': 'paraffin', 'kerosine': 'paraffin',
}

function readBlock(raw: unknown): string {
  const key = keyOf(raw).replace(/^(?:a|an|the)-/, '')
  const bare = key.replace(/-(?:block|raft|cube|slab)$/, '')
  return has(BLOCK_WORDS, key) ? BLOCK_WORDS[key] : has(BLOCK_WORDS, bare) ? BLOCK_WORDS[bare] : bare.replace(/-/g, ' ')
}
function readLiquid(raw: unknown): string {
  const key = keyOf(raw).replace(/^(?:a|an|the)-/, '')
  return has(LIQUID_WORDS, key) ? LIQUID_WORDS[key] : key.replace(/-/g, ' ')
}
function readNumber(raw: unknown): number | null {
  const v = typeof raw === 'string' && raw.trim() !== '' ? Number(raw.trim().replace(/\s*(?:kpa|cm|centimetres?|centimeters?)$/i, '')) : raw
  return typeof v === 'number' && Number.isFinite(v) ? v + 0 : null
}

const nearestTarget = (t: number) => TARGETS.reduce((best, x) => (Math.abs(x - t) < Math.abs(best - t) ? x : best), TARGETS[0])

/** What a prompt can safely say: the gesture and the aim, with no number. */
const goodPrompt = (c: DPConfig) => {
  if (c.task === 'load') return `Tap + to stack weights on the ${c.block} block, and − to take one off. Load it with as many weights as it can carry and still float.`
  if (c.task === 'press') return 'Tap the arrows to turn the brick onto another face, and + or − to add or take away a brick. Press the foam in to the dashed line, using as few bricks as you can.'
  return `Tap + to lower the capsule into the ${c.liquid}, and − to raise it. In water the needle stopped at the orange tab: lower the capsule until the needle reaches it here.`
}

export const densityPressureEngine: SceneEngine<DPConfig, DPState> = {
  id: 'density-pressure',
  // Few and distinctive: `catalogue` offers a scene for any one word of a covers topic, so "pressure" here would catch gas
  // pressure and blood pressure. Everything else is a whole phrase, with the near misses ruled out below.
  covers: ['buoyancy', 'upthrust'],
  phrases: [
    'density', 'densities', 'relative density', 'density of materials', 'density of solids', 'density of liquids', 'mass and density', 'mass density', 'density and mass', 'density and volume', 'measuring density',
    'density and pressure', 'density pressure', 'pressure and density', 'floating and sinking', 'sinking and floating', 'float or sink', 'sink or float', 'float and sink', 'sink and float', 'floating objects', 'sinking objects',
    'things float', 'objects float', 'ships float', 'ship float', 'boats float', 'why objects float', 'law of flotation', 'archimedes principle', 'archimedes law', 'displacement of water', 'liquid displacement', 'fluid displacement',
    'pressure in liquids', 'pressure in liquid', 'pressure in fluids', 'pressure in a fluid', 'pressure in a liquid', 'liquid pressure', 'fluid pressure', 'water pressure', 'pressure and depth', 'pressure at depth', 'pressure under water', 'pressure beneath water',
    'hydrostatic pressure', 'pressure in solids', 'pressure in solid', 'pressure on solids', 'solid pressure', 'pressure in solids and liquids', 'pressure in solids and fluids', 'pressure of solids', 'pressure and area', 'area and pressure', 'force and pressure', 'pressure and force',
    'pressure on surfaces', 'pressure on a surface', 'pressure of liquids', 'pressure of a liquid', 'pressure exerted by liquids', 'pressure exerted by solids', 'calculating pressure', 'pressure calculations', 'pressure formula',
  ],
  // Near misses: "density" and "pressure" about something else, and what this card cannot draw.
  notFor: [
    'population density', 'population densities', 'urban density', 'housing density', 'building density', 'settlement density', 'traffic density', 'stocking density', 'planting density', 'density dependent', 'density independent', 'density dependence',
    'optical density', 'optical densities', 'charge density', 'current density', 'flux density', 'magnetic flux density', 'energy density', 'power density', 'spectral density', 'probability density', 'density function', 'density functions', 'density curve', 'density curves', 'density plot',
    'frequency density', 'frequency densities', 'density of states', 'electron density', 'electron densities', 'bone density', 'bone mineral density', 'cell density', 'stomatal density', 'bit density', 'data density', 'information density', 'kernel density',
    'gas density', 'gas densities', 'density of gases', 'density of a gas', 'vapour density', 'density of air', 'air density', 'atmospheric density', 'density of the atmosphere',
    'gas pressure', 'gas pressures', 'air pressure', 'atmospheric pressure', 'pressure of a gas', 'pressure of gases', 'pressure of the atmosphere', 'pressure of air', 'blood pressure', 'blood pressures', 'peer pressure', 'social pressure', 'exam pressure', 'pressure and stress', 'stress and pressure',
    'pressure group', 'pressure groups', 'pressure cooker', 'pressure cookers', 'pressure point', 'pressure points', 'pressure sore', 'pressure sores', 'pressure sensor', 'pressure sensors', 'pressure switch', 'pressure switches', 'pressure plate', 'pressure plates',
    'pressure law', 'pressure and temperature', 'pressure and volume', 'pressure volume', 'boyle', 'boyles', 'charles law', 'ideal gas', 'ideal gases', 'gas laws', 'gas law', 'partial pressure', 'partial pressures', 'vapour pressure', 'vapor pressure', 'osmotic pressure', 'turgor pressure',
    'effect of pressure', 'effects of pressure', 'changing pressure', 'pressure on equilibrium', 'pressure and equilibrium', 'pressure and rate', 'high pressure', 'low pressure', 'high pressure systems', 'low pressure systems', 'tyre pressure', 'tire pressure',
    'selection pressure', 'selection pressures', 'environmental pressure', 'environmental pressures', 'financial pressure', 'time pressure', 'work pressure', 'pressure to conform', 'pressure on resources', 'pressure on land',
    'sinking fund', 'sinking funds', 'sinking feeling', 'floating point', 'floating rate', 'floating exchange rate', 'floating exchange rates', 'floating voter', 'floating voters', 'floating charge', 'floating charges', 'stock market flotation', 'flotation of a company', 'share flotation', 'flotation of shares',
    'hydrostatic equilibrium', 'hydraulics', 'hydraulic systems', 'hydraulic press', 'hydraulic jack', 'hydraulic brakes', 'hydraulic machines', 'hydraulic pumps', 'sea level pressure', 'barometer', 'barometers', 'manometer', 'manometers',
  ],
  // The learner changes how much, how big, how deep.
  isolates: 'magnitude',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const nested = o.task && typeof o.task === 'object' ? (o.task as Record<string, unknown>) : null
    const src = nested ?? o
    const rawTask = first(src, nested ? ['kind', 'task', 'type'] : ['task', 'kind', 'type', 'mode'])
    const word = keyOf(rawTask)
    if (word && !has(TASK_WORDS, word)) return null
    const rawBlock = first(src, ['block', 'material', 'object', 'solid', 'raft'])
    const rawLiquid = first(src, ['liquid', 'fluid', 'tank'])
    const rawTarget = first(src, ['target', 'pressure', 'dent', 'kpa'])
    const rawRef = first(src, ['reference', 'water', 'waterDepth', 'refDepth', 'depth', 'cm'])
    const task = word ? TASK_WORDS[word] : rawBlock !== undefined ? 'load' : rawTarget !== undefined ? 'press' : rawLiquid !== undefined || rawRef !== undefined ? 'dive' : null
    if (!task) return null
    if (task === 'load') {
      if (rawBlock !== undefined && typeof rawBlock !== 'string') return null
      if (rawLiquid !== undefined && typeof rawLiquid !== 'string') return null
      return { task, block: rawBlock === undefined ? 'pine' : readBlock(rawBlock), liquid: rawLiquid === undefined ? 'water' : readLiquid(rawLiquid) }
    }
    if (task === 'press') {
      const target = rawTarget === undefined ? 4 : readNumber(rawTarget)
      return target === null ? null : { task, target }
    }
    if (rawLiquid !== undefined && typeof rawLiquid !== 'string') return null
    const liquid = rawLiquid === undefined ? 'brine' : readLiquid(rawLiquid)
    const reference = rawRef === undefined ? (has(DEFAULT_REFERENCE, liquid) ? DEFAULT_REFERENCE[liquid] : 18) : readNumber(rawRef)
    return reference === null ? null : { task, liquid, reference }
  },

  faults(c) {
    const out: string[] = []
    if (c.task === 'load') {
      const blocks = BLOCK_NAMES.join(', ')
      const liquids = LIQUID_NAMES.join(', ')
      if (!has(BLOCKS, c.block)) {
        if (SINKERS.includes(c.block)) out.push(`"${c.block}" is denser than every liquid on this card, so it sinks and there is no load to find: use a block that floats, e.g. block "pine".`)
        else out.push(`There is no "${c.block}" block drawn here: use one of ${blocks}, e.g. block "pine".`)
      }
      if (!has(LIQUIDS, c.liquid)) out.push(`There is no "${c.liquid}" liquid drawn here: use one of ${liquids}, e.g. liquid "water".`)
      if (has(BLOCKS, c.block) && has(LIQUIDS, c.liquid)) {
        const b = BLOCKS[c.block as BlockName].rho
        const l = LIQUIDS[c.liquid as LiquidName].rho
        if (b >= l) out.push(`${c.block} sinks in ${c.liquid}, so there is no load to find: use e.g. block "pine".`)
        else if (freeboard(b, l) < MIN_FREEBOARD) out.push(`${c.block} floats too low in ${c.liquid} to load (only ${Math.round(freeboard(b, l) * 100)}% of its height stands clear): use e.g. block "pine".`)
      }
    } else if (c.task === 'press') {
      if (pressAnswer(c.target) === null) out.push(`A dent of ${c.target} kPa cannot be made with one or two bricks: use ${TARGETS.slice(0, -1).join(', ')} or ${TARGETS[TARGETS.length - 1]}, e.g. target ${nearestTarget(c.target)}.`)
    } else {
      if (!(DIVE_LIQUIDS as readonly string[]).includes(c.liquid)) {
        out.push(c.liquid === 'water'
          ? 'Water is the reference the marker is set in, so there is nothing to find in it: use paraffin or brine, e.g. liquid "brine".'
          : `There is no "${c.liquid}" liquid to dive in: use paraffin or brine, e.g. liquid "brine".`)
      } else if (diveAnswer(c.liquid, c.reference) === null) {
        const ok = validReferences(c.liquid)
        const near = ok.reduce((best, x) => (Math.abs(x - c.reference) < Math.abs(best - c.reference) ? x : best), ok[0])
        out.push(`A reference of ${c.reference} cm in water gives no whole-centimetre depth in ${c.liquid} within the tank: use a multiple of ${stepOfReference(c.liquid)} from ${ok[0]} to ${ok[ok.length - 1]}, e.g. reference ${near}.`)
      }
    }
    return out
  },

  promptFaults(c, prompt) {
    const text = prompt.replace(/\s+/g, ' ')
    const example = goodPrompt(c)
    const out: string[] = []
    let gives = false
    if (c.task === 'load') {
      const plan = loadPlan(c)
      const count = /\b(?:\d+|one|two|three|four|five|six|seven|eight)\s+(?:\w+\s+)?weights?\b/i.test(text)
      const grams = [...text.matchAll(/\b(\d+(?:\.\d+)?)\s*g\b/g)].map((m) => Number(m[1]))
      const cap = plan ? grams.includes(plan.liquid) || grams.includes(plan.mass + plan.most * plan.unit) || grams.includes(plan.liquid - plan.mass) : false
      const rule = /\bequal(?:s)?\s+(?:to\s+)?the\s+weight\b|\bdisplace|\bpush(?:es)?\s+aside|\bdensit(?:y|ies)\s+(?:is|are)\s+(?:less|lower|greater|higher)|\bless\s+dense\b|\bdenser\b/i.test(text)
      gives = count || cap || rule
    } else if (c.task === 'press') {
      const unit = /\b\d+(?:\.\d+)?\s*(?:kPa|Pa|N\/cm|N\b)/i.test(text)
      const count = /\b(?:\d+|one|two)\s+bricks?\b/i.test(text)
      const face = /\b(?:smallest|largest|biggest|narrowest|widest|thinnest|flat|end|edge|side|upright|on its)\b.*\b(?:face|end|edge|side)\b|\b(?:stand|balance|rest|lay|lie)\s+(?:it\s+)?(?:on|upright|flat)\b/i.test(text)
      const rule = /\bsmaller\s+area\b|\blarger\s+area\b|\bhalv|\bdoubl|\bmore\s+pressure\b|\bless\s+pressure\b|\bforce\s*(?:÷|\/|divided)/i.test(text)
      gives = unit || count || face || rule
    } else {
      const answer = diveAnswer(c.liquid, c.reference)
      const depths = [...text.matchAll(/\b(\d+(?:\.\d+)?)\s*(?:cm|centimet)/gi)].map((m) => Number(m[1]))
      const exact = answer !== null && depths.includes(answer)
      const direction = /\b(?:shallower|less\s+deep|not\s+as\s+deep|not\s+so\s+deep|deeper\s+than|further\s+down|higher\s+up|nearer\s+the\s+top|closer\s+to\s+the\s+surface)\b/i.test(text)
      const rule = /\bdenser\b|\bless\s+dense\b|\brho\b|ρ|\bdensity\s*×|\bpgh\b/i.test(text)
      gives = exact || direction || rule
    }
    if (gives) out.push(`the prompt gives the answer away: it says how many, how big, how deep or why, which the learner is to find by handling the apparatus -- ask for the outcome only ("${example}")`)
    if (/\bdrag\b|\bslide\b|\bpour\b|\bchange\s+the\s+(?:liquid|block|brick|material|shape)\b|\bhydraulic|\batmospher|\bbarometer|\bair\s+pressure|\bpressure\s+of\s+(?:the\s+)?air|\bgas(?:es)?\b|\bblood\b|\bsubmarine|\bballast|\bhull\b|\bship\b|\bboat\b|\bcontainer\b|\bshape of the|\btemperature\b/i.test(text)) {
      out.push(`the prompt promises something the card does not show: it draws one block, one brick or one gauge, and the learner taps arrows and + and − -- ask for that ("${example}")`)
    }
    return out
  },

  initial(c) {
    if (c.task === 'load') return { weights: 0 }
    if (c.task === 'press') return c.target === 1 ? { face: 2, bricks: 1 } : { face: 0, bricks: 1 }
    return { depth: 0 }
  },

  check(c, state) {
    return { ok: done(c, state), wrongIds: [] }
  },

  solve(c) {
    if (c.task === 'load') return { weights: loadPlan(c)!.most }
    if (c.task === 'press') return pressAnswer(c.target)!
    return { depth: diveAnswer(c.liquid, c.reference)! }
  },

  View: DensityPressureView,

  prompt: `SCENE "density-pressure" -- real lab apparatus on a quiet light panel, one idea a card. It has three tasks, each a different picture.
  load: a glass tank of liquid with a block of a named material floating in it (20 x 10 x 5 cm, 1000 cm3, its name and mass written on it) and a stack of identical steel weights that the learner builds on top of it with + and −. The waterline climbs the block and the tank level rises as weights go on, and one weight too many sends the block to the floor of the tank. Under the picture are the liquid's density and the total mass on the water.
  press: a brick (20 x 10 x 5 cm, 2 kg, edges labelled) standing on a slab of foam on a kitchen scale. The learner turns it onto another face with the arrows and adds or takes away a second brick with + and −. The foam dents deeper or shallower, and a dashed line across the foam marks the dent to match. The scale shows the mass on it, which does not change with the face.
  dive: a pressure gauge (a dial in kPa) on a tube whose capsule hangs in a tank of liquid with a depth ruler in cm. The learner lowers the capsule with + and −; the needle and the digital reading move. An orange tab on the dial marks the reading the capsule gave at a set depth in water.
  For: density (mass and volume, why some things float and others sink, including heavy things that float and light things that sink), upthrust and buoyancy, floating and sinking in different liquids, pressure on a solid (force and area, why a narrow face presses harder), and pressure in a liquid (it grows with depth and with the liquid's density). It answers "heavy things sink", "bigger things sink" and "pressure depends on how much liquid there is". g is 10 N/kg.
  load config: { "task":"load", "block":"pine", "liquid":"water" } -- block is one of balsa, cork, pine, oak, ice or polythene; liquid is water, sea water, brine (saturated salt solution) or paraffin. A block must float with a fifth of its height clear: ice and polythene work only in brine, oak not in paraffin. The weight size is chosen for you so that 3 to 6 fit. The learner loads it with as many weights as it can carry and still float (pine in water: 3 weights of 150 g). Use two liquids in turn to compare.
  press config: { "task":"press", "target":4 } -- the pressure of the dashed dent in kPa: 1, 2, 4 or 8. The learner presses the foam to the line with as few bricks as they can (4 kPa: one brick on its smallest face; 8 kPa: two on it). A dent that reaches the line with more bricks than needed is marked wrong, with what was made.
  dive config: { "task":"dive", "liquid":"brine", "reference":18 } -- liquid is paraffin or brine; reference is the depth in cm at which the gauge stopped at the marker in water: a multiple of 4 in paraffin (4 to 24) or of 6 in brine (6 to 36), optional, with a default. The learner lowers the capsule until the needle reaches the marker (brine, 18 cm in water: 15 cm).
  Not drawn: gas pressure (use the particles scene), atmospheric pressure, hydraulics, the shape or width of the container, boats and hulls, and a free choice of mass or volume. Do not use it for population density, blood pressure, peer pressure or the gas laws.
  Before marking the card shows the apparatus and its readings (the scale mass, the gauge reading, the total mass on the water) and what the learner's handling does. It holds back the number of weights or bricks, the depth, and any verdict. Marking says the count and why. The prompt must ask for the outcome and give the gesture: do NOT say how many weights or bricks, which face, how deep, that a denser liquid reads at less depth, or any rule such as "floats when its density is less" or "force ÷ area".
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Tap + to stack weights on the pine block, and − to take one off. Load it with as many weights as it can carry and still float.",
    "payload": { "engine":"density-pressure", "config": { "task":"load", "block":"pine", "liquid":"water" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"magnitude", "apparatus":"scene:density-pressure", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Tap + to stack weights on the ice block, and − to take one off. Load it with as many weights as it can carry and still float.",
    "payload": { "engine":"density-pressure", "config": { "task":"load", "block":"ice", "liquid":"brine" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"magnitude", "apparatus":"scene:density-pressure", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Tap the arrows to turn the brick onto another face, and + or − to add or take away a brick. Press the foam in to the dashed line, using as few bricks as you can.",
    "payload": { "engine":"density-pressure", "config": { "task":"press", "target":4 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"magnitude", "apparatus":"scene:density-pressure", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Tap + to lower the capsule into the brine, and − to raise it. In water the needle stopped at the orange tab: lower the capsule until the needle reaches it here.",
    "payload": { "engine":"density-pressure", "config": { "task":"dive", "liquid":"brine", "reference":18 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"magnitude", "apparatus":"scene:density-pressure", "why":"..." } }`,
}

registerEngine(densityPressureEngine as SceneEngine<unknown, unknown>)
