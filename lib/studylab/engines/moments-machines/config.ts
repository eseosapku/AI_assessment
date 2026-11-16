// lib/studylab/engines/moments-machines/config.ts
//
// Machines trade force for distance. Four real things on a quiet plate, each with one move that shows it:
//   balance -- a wooden rule on a stand, with slotted discs on hangers. Slide the brass stack along the rule, change its
//              discs, or slide the stand itself, and the rule tips and settles. A small stack far out beats a big one close in;
//   lever   -- a crowbar under a rock. Slide the fulcrum: the rock lifts the moment your push is enough, and the nearer the
//              fulcrum is to the rock, the further your hand has to travel for less rise;
//   pulley  -- a block and tackle. Add strands until your arm can move the crate, then haul it to the shelf a metre of
//              rope at a time, so the extra rope is felt in the number of pulls;
//   gears   -- a real meshing train. Change the output gear, add an idler, and turn the handle by hand.
//
// The rules, all computed here and never read from the drawing:
//   a rule sits level exactly when the sum of force x distance is the same on both sides of the pivot;
//   a rock lifts when load x (fulcrum to rock) <= push x (fulcrum to hand);
//   a block and tackle shares the load among the strands holding the moving block, so pull = load / strands, and the
//   rope pulled = strands x the lift;
//   a gear pair turns the output driver teeth / output teeth times per turn, and each meshing reverses the direction.
// All are ideal machines: light ropes and bars, no friction, and that is said in the catalogue entry.
//
// Facts: the principle of moments, and the mechanical advantage of a pulley system as the number of rope segments
// supporting the load, as in any school physics text; here checked against Kontinua's "Simple Machines" chapter (the force
// falls by the factor the distance rises by; MA = N supporting segments). The Cambridge IGCSE value g = 10 N/kg is used only
// to read a force written in kg. Gear teeth: meshing direction and the idler as in Ciechanowski's "Gears".
//
// Ideas taken, never code or art:
//   - start on a conflict: Siegler's balance-scale rules (as reviewed in Frontiers in Psychology, 2021), where children read
//     weight first and distance only when the weights are equal. So the brass stack is lighter than the load and starts close
//     in, and the rule tips against it until it goes further out;
//   - "moment" is taken for time: Oak National Academy's levers lesson, which uses "turning effect" while the idea forms, and
//     whose crowbar shows force multipliers. Hence "tips" on the card, with "moment" arriving at the mark;
//   - the rule, stack and marks on wheels: Siemens' "Gears and Levers" teacher notes (a ruler with lab weights, a mark on each
//     wheel to count turns, pivots that can be moved);
//   - the rule that tilts to answer every move: PhET's Balancing Act, and "Adding Moments" from Brilliant's Mobiles;
//   - a painted mark, an idler that only reverses, a handle you turn yourself: Ciechanowski's "Gears".
//   - the misconceptions: machines make energy, and mechanical advantage equals the number of pulleys (teaching guides, which cite
//     no study). Hence the strands numbered on the rope, with the one in your hand left out.
// Refused:
//   - lever classes (a labelling exercise with no act), wheelbarrows and arms: a learner would be reading labels;
//   - ramps, screws, wheel and axle, hydraulics, belts, compound gear trains, efficiency and friction: other ideas, or a row of
//     numbers, and not drawn here;
//   - force at an angle and couples: they need force arrows, which the `forces` scene has.

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { MomentsMachinesView } from './View'

export const MOVES = ['weight', 'discs', 'both', 'pivot'] as const
export type Move = (typeof MOVES)[number]
export type Unit = 'cm' | 'm'
export type Side = 'left' | 'right'
/** at: the distance from the pivot, on `side`; on a rule with a pivot set or moved, the distance along it from its left end. */
export type Load = { force: number; at: number; side?: Side }

export type BalanceConfig = {
  task: 'balance'
  move: Move
  loads: Load[]
  /** The brass stack's force, when the learner only moves it. */
  weight?: number
  /** Where the brass stack hangs, when the learner only changes its discs. */
  at?: number
  /** Where the stand is, along the rule from its left end, when it is not at the middle and does not move. */
  pivot?: number
  /** The rule's own weight, acting at its middle. */
  beam?: number
  unit: Unit
}
export type LeverConfig = { task: 'lever'; load: number; push: number }
export type PulleyConfig = { task: 'pulley'; load: number; pull: number; height: number }
export type Direction = 'same' | 'opposite' | 'any'
export type GearsConfig = { task: 'gears'; teeth: number; turns: number; direction: Direction }
export type MachineConfig = BalanceConfig | LeverConfig | PulleyConfig | GearsConfig

/** at: a mark on the rule, -5 to 5 from its middle, or the fulcrum's marks from the rock. */
export type MachineState = { at?: number; discs?: number; strands?: number; pulled?: number; teeth?: number; idler?: boolean }

const has = (o: object, k: string | number) => Object.prototype.hasOwnProperty.call(o, k)
const say = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : Number(n.toFixed(2)).toString())

// ---------------------------------------------------------------------------
// The rule. Its marks run -5 to 5 from its middle, each 10 cm or 1 m; everything is whole numbers, so nothing compares floats.

export const HALF_MARKS = 5
export const MAX_DISCS = 12
export const MAX_LOADS = 3
/** Each disc is one of these, the first that draws every stack in whole discs: 60 N is 6 discs of 10 N. */
const DISC_SIZES = [1, 10, 100, 1000, 2, 5, 20, 50, 200, 500]

const stepOf = (c: BalanceConfig) => (c.unit === 'm' ? 1 : 10)
export const isAbsolute = (c: BalanceConfig) => c.move === 'pivot' || c.pivot !== undefined

function givenForces(c: BalanceConfig): number[] {
  return [...c.loads.map((l) => l.force), ...(c.move === 'weight' && c.weight !== undefined ? [c.weight] : [])]
}

export function discUnit(c: BalanceConfig): number {
  const forces = givenForces(c)
  return DISC_SIZES.find((u) => forces.every((f) => f > 0 && f % u === 0 && f / u <= MAX_DISCS)) ?? 1
}

export function markOfLoad(c: BalanceConfig, l: Load): number {
  return isAbsolute(c) ? l.at / stepOf(c) - HALF_MARKS : (l.side === 'right' ? 1 : -1) * (Math.abs(l.at) / stepOf(c))
}

export const fixedPivot = (c: BalanceConfig) => (c.pivot !== undefined ? c.pivot / stepOf(c) - HALF_MARKS : 0)

/** Clockwise is positive: a weight to the right of the pivot takes the right end down. */
function momentOfFixed(c: BalanceConfig, p: number): number {
  return c.loads.reduce((sum, l) => sum + l.force * (markOfLoad(c, l) - p), 0) + (c.beam ?? 0) * (0 - p)
}

/** The side the brass stack hangs on: the one that can answer what is there. */
const freeSide = (c: BalanceConfig) => (momentOfFixed(c, fixedPivot(c)) > 0 ? -1 : 1)

function hangerMark(c: BalanceConfig): number {
  const given = c.at ?? 2 * stepOf(c)
  return isAbsolute(c) ? given / stepOf(c) - HALF_MARKS : fixedPivot(c) + freeSide(c) * (Math.abs(given) / stepOf(c))
}

/** Where the learner's thing can go, nearest the pivot first; the stand goes left to right. */
export function freeMarks(c: BalanceConfig): number[] {
  if (c.move === 'pivot') return [-4, -3, -2, -1, 0, 1, 2, 3, 4]
  if (c.move === 'discs') return [hangerMark(c)]
  const p = fixedPivot(c)
  const taken = new Set(c.loads.map((l) => markOfLoad(c, l)))
  // The rule's own weight is drawn at its middle mark, so no stack hangs there.
  if (c.beam) taken.add(0)
  const out: number[] = []
  for (let k = 1; k <= 2 * HALF_MARKS; k++) {
    const x = p + freeSide(c) * k
    if (Math.abs(x) > HALF_MARKS) break
    if (Number.isInteger(x) && !taken.has(x)) out.push(x)
  }
  return out.length ? out : [p + freeSide(c)]
}

function netWith(c: BalanceConfig, x: number, force: number): number {
  if (c.move === 'pivot') return momentOfFixed(c, x)
  const p = fixedPivot(c)
  return momentOfFixed(c, p) + force * (x - p)
}

const discRange = () => Array.from({ length: MAX_DISCS }, (_, k) => k + 1)

/** Every place the stack can be level: for `both`, the lightest are first. */
export function solutions(c: BalanceConfig): { at: number; discs: number }[] {
  const u = discUnit(c)
  const out: { at: number; discs: number }[] = []
  if (c.move === 'pivot') {
    for (const x of freeMarks(c)) if (netWith(c, x, 0) === 0) out.push({ at: x, discs: 0 })
    return out
  }
  if (c.move === 'weight') {
    const discs = (c.weight ?? u) / u
    for (const x of freeMarks(c)) if (netWith(c, x, c.weight ?? u) === 0) out.push({ at: x, discs })
    return out
  }
  for (const x of freeMarks(c)) for (const d of discRange()) if (netWith(c, x, d * u) === 0) out.push({ at: x, discs: d })
  return out.sort((a, b) => a.discs - b.discs)
}

/** The frame the card opens on: never level, and nearest the pivot, so the rule tips against the stack. */
function balanceStart(c: BalanceConfig): { at: number; discs: number } {
  const u = discUnit(c)
  const marks = freeMarks(c)
  // The stand starts at the middle, unless the arrow for the rule's own weight is drawn there.
  if (c.move === 'pivot') return { at: (c.beam ? [-2, 2, -1, 1, -3, 3, -4, 4, 0] : [0, ...marks]).find((x) => netWith(c, x, 0) !== 0) ?? 0, discs: 0 }
  if (c.move === 'weight') {
    const f = c.weight ?? u
    return { at: marks.find((x) => netWith(c, x, f) !== 0) ?? marks[0], discs: f / u }
  }
  const at = marks[0]
  return { at, discs: discRange().find((d) => netWith(c, at, d * u) !== 0) ?? 1 }
}

export function readAt(c: BalanceConfig, s: MachineState): number {
  const at = s?.at
  return typeof at === 'number' && freeMarks(c).includes(at) ? at : balanceStart(c).at
}

export function readDiscs(c: BalanceConfig, s: MachineState): number {
  if (c.move === 'weight') return balanceStart(c).discs
  const d = s?.discs
  return typeof d === 'number' && Number.isInteger(d) && d >= 1 && d <= MAX_DISCS ? d : balanceStart(c).discs
}

export function netMoment(c: BalanceConfig, s: MachineState): number {
  return netWith(c, readAt(c, s), c.move === 'pivot' ? 0 : readDiscs(c, s) * discUnit(c))
}

/** How far the rule leans, in degrees: enough to see at the smallest imbalance, and growing with it, as a balance's pointer does. */
export function tiltOf(c: BalanceConfig, s: MachineState): number {
  const n = netMoment(c, s) / discUnit(c)
  if (n === 0) return 0
  return Math.sign(n) * Math.min(isAbsolute(c) ? 7 : 12, 3 + 0.7 * Math.abs(n))
}

export const leanOf = (c: BalanceConfig, s: MachineState): 'left' | 'right' | 'level' => {
  const n = netMoment(c, s)
  return n === 0 ? 'level' : n > 0 ? 'right' : 'left'
}

/** Both sums, in newtons and the rule's own unit. */
function sides(c: BalanceConfig, s: MachineState) {
  const step = stepOf(c)
  const p = c.move === 'pivot' ? readAt(c, s) : fixedPivot(c)
  const all = c.loads.map((l) => ({ force: l.force, x: markOfLoad(c, l) }))
  if (c.beam) all.push({ force: c.beam, x: 0 })
  if (c.move !== 'pivot') all.push({ force: readDiscs(c, s) * discUnit(c), x: readAt(c, s) })
  const sideOf = (sign: number) => {
    const here = all.filter((a) => Math.sign(a.x - p) === sign).map((a) => ({ f: a.force, d: Math.abs(a.x - p) * step }))
    return { terms: here.map((t) => `${t.f} N × ${t.d} ${c.unit}`).join(' + '), sum: here.reduce((n, t) => n + t.f * t.d, 0) }
  }
  return { anti: sideOf(-1), clock: sideOf(1) }
}

// ---------------------------------------------------------------------------
// The lever. The bar has ten equal parts; the fulcrum sits on one of the nine marks between, counted from the rock.

export const LEVER_MARKS = 10
export const leverHolds = (c: LeverConfig, p: number) => c.load * p <= c.push * (LEVER_MARKS - p)

/** The fulcrum as far from the rock as your push allows, which lifts it highest. */
export function leverBest(c: LeverConfig): number | null {
  for (let p = LEVER_MARKS - 1; p >= 1; p--) if (leverHolds(c, p)) return p
  return null
}

export const pushNeeded = (c: LeverConfig, p: number) => (c.load * p) / (LEVER_MARKS - p)

export function readFulcrum(c: LeverConfig, s: MachineState): number {
  const p = s?.at
  return typeof p === 'number' && Number.isInteger(p) && p >= 1 && p < LEVER_MARKS ? p : leverStart(c)
}

/** Far enough from the rock that it will not lift. */
const leverStart = (c: LeverConfig) => (leverBest(c) === LEVER_MARKS - 2 ? LEVER_MARKS - 1 : LEVER_MARKS - 2)

// ---------------------------------------------------------------------------
// The block and tackle.

export const MAX_STRANDS = 6
export const MAX_ROPE = 12

/** The fewest strands that bring the pull within your arm. */
export function strandsNeeded(c: PulleyConfig): number {
  let n = 1
  while (n * c.pull < c.load && n <= MAX_STRANDS) n++
  return n
}

export const canPull = (c: PulleyConfig, strands: number) => strands * c.pull >= c.load
export const pullNeeded = (c: PulleyConfig, strands: number) => c.load / strands

export function readStrands(s: MachineState): number {
  const n = s?.strands
  return typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= MAX_STRANDS ? n : 1
}

/** Rope pulled, in metres: none if the crate will not move, and it stops at the shelf. */
export function readPulled(c: PulleyConfig, s: MachineState): number {
  const n = readStrands(s)
  const pulled = s?.pulled
  if (!canPull(c, n) || typeof pulled !== 'number' || !Number.isInteger(pulled) || pulled < 0) return 0
  return Math.min(pulled, n * c.height)
}

// ---------------------------------------------------------------------------
// The gears.

export const GEAR_TEETH = [8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48]
export const HANDLE_TEETH = [16, 20, 24, 28, 32, 36, 40, 44, 48]
export const IDLER_TEETH = 12

/** The output gear that makes this many turns, or null if none is drawn. */
export function gearTarget(c: GearsConfig): number | null {
  const t = c.teeth / c.turns
  const r = Math.round(t)
  return Math.abs(t - r) < 1e-6 && GEAR_TEETH.includes(r) ? r : null
}

export function readTeeth(c: GearsConfig, s: MachineState): number {
  const t = s?.teeth
  return typeof t === 'number' && GEAR_TEETH.includes(t) ? t : gearStart(c)
}

function gearStart(c: GearsConfig): number {
  const target = gearTarget(c)
  if (target !== c.teeth && GEAR_TEETH.includes(c.teeth)) return c.teeth
  return GEAR_TEETH.find((t) => t !== target && t >= c.teeth) ?? GEAR_TEETH.find((t) => t !== target) ?? 24
}

export const readIdler = (s: MachineState) => s?.idler === true
export const gearTurns = (c: GearsConfig, teeth: number) => c.teeth / teeth
const wayOf = (idler: boolean): Exclude<Direction, 'any'> => (idler ? 'same' : 'opposite')

/** "3 times", "once", "half a turn": for the catalogue, the prompt and the marks. */
export function turnsText(turns: number): string {
  if (turns === 1) return 'once'
  if (turns === 2) return 'twice'
  if (Number.isInteger(turns)) return `${turns} times`
  if (Math.abs(turns - 0.5) < 1e-9) return 'half a turn'
  if (Math.abs(turns - 1 / 3) < 1e-9) return 'a third of a turn'
  if (Math.abs(turns - 0.25) < 1e-9) return 'a quarter of a turn'
  if (turns > 1 && Number.isInteger(turns * 2)) return `${fmt(turns)} times`
  for (let d = 2; d <= 12; d++) {
    const n = Math.round(turns * d)
    if (Math.abs(n / d - turns) < 1e-9) return turns < 1 ? `${n}/${d} of a turn` : `${n}/${d} times`
  }
  return `${fmt(turns)} times`
}

// ---------------------------------------------------------------------------
// Marking, from the rule, always.

function solved(c: MachineConfig, s: MachineState): boolean {
  switch (c.task) {
    case 'balance': {
      if (netMoment(c, s) !== 0) return false
      if (c.move === 'both') return readDiscs(c, s) === solutions(c)[0]?.discs
      return solutions(c).length > 0
    }
    case 'lever':
      return readFulcrum(c, s) === leverBest(c)
    case 'pulley': {
      const n = readStrands(s)
      return n === strandsNeeded(c) && readPulled(c, s) === n * c.height && canPull(c, n)
    }
    case 'gears': {
      if (readTeeth(c, s) !== gearTarget(c)) return false
      return c.direction === 'any' || wayOf(readIdler(s)) === c.direction
    }
  }
}

function start(c: MachineConfig): MachineState {
  switch (c.task) {
    case 'balance':
      return { ...balanceStart(c) }
    case 'lever':
      return { at: leverStart(c) }
    case 'pulley':
      return { strands: 1, pulled: 0 }
    case 'gears':
      return { teeth: gearStart(c), idler: false }
  }
}

function answer(c: MachineConfig): MachineState {
  switch (c.task) {
    case 'balance':
      return { ...(solutions(c)[0] ?? balanceStart(c)) }
    case 'lever':
      return { at: leverBest(c) ?? leverStart(c) }
    case 'pulley': {
      const n = strandsNeeded(c)
      return { strands: n, pulled: n * c.height }
    }
    case 'gears':
      return { teeth: gearTarget(c) ?? gearStart(c), idler: c.direction === 'same' }
  }
}

// ---------------------------------------------------------------------------
// What is said once marked. Before that the card holds no sum at all.

/** What a correct card says: the sum, and the idea it stands for. */
export function working(c: MachineConfig, s: MachineState): string {
  switch (c.task) {
    case 'balance': {
      const { anti, clock } = sides(c, s)
      const sums = `Anticlockwise: ${anti.terms} = ${anti.sum} N ${c.unit}. Clockwise: ${clock.terms} = ${clock.sum} N ${c.unit}.`
      const heaviest = c.loads.reduce((big, l) => (l.force > big.force ? l : big), c.loads[0])
      const mine = readDiscs(c, s) * discUnit(c)
      if (c.move === 'pivot') {
        const total = c.loads.reduce((n, l) => n + l.force, 0) + (c.beam ?? 0)
        return `Yes. The rule sits level. ${sums} The stand now holds up all ${total} N, and this point is the centre of gravity of the rule and its loads.`
      }
      if (c.move === 'both') return `Yes. The rule sits level. ${sums} ${mine} N is the lightest that can do it: the further out a force acts, the less of it you need.`
      if (c.beam) return `Yes. The rule sits level. ${sums} The rule's own weight turns it too, acting at its middle.`
      const p = fixedPivot(c)
      if (mine < heaviest.force && Math.abs(readAt(c, s) - p) > Math.abs(markOfLoad(c, heaviest) - p)) return `Yes. The rule sits level. ${sums} A lighter weight balances a heavier one by acting further from the pivot: force and distance both count.`
      return `Yes. The rule sits level. ${sums} Force and distance both count, not the weight alone.`
    }
    case 'lever': {
      const p = readFulcrum(c, s)
      const ratio = (LEVER_MARKS - p) / p
      const travel = ratio === 1 ? 'Your hand and the rock move the same distance' : ratio > 1 ? `Your hand moves ${fmt(ratio)} times as far as the rock` : `The rock moves ${fmt(1 / ratio)} times as far as your hand`
      const need = fmt(pushNeeded(c, p))
      const within = Number(need) === c.push ? '' : `, within your ${c.push} N`
      return `Yes. The rock lifts, as high as your push allows. ${c.load} N × ${p * 10} cm = ${need} N × ${(LEVER_MARKS - p) * 10} cm${within}. ${travel}: a lever trades distance for force and makes no extra energy.`
    }
    case 'pulley': {
      const n = readStrands(s)
      const pull = pullNeeded(c, n)
      if (n === 1) return `Yes. One strand holds the crate, so you pull its full ${c.load} N and it rises as far as you pull. A single fixed pulley changes the direction of the force, not its size.`
      return `Yes. ${n} strands share the ${c.load} N, so you pull ${fmt(pull)} N. You hauled ${n * c.height} m of rope to raise it ${c.height} m: less force, more rope, the same work. Only the strands holding the crate count.`
    }
    case 'gears': {
      const t = readTeeth(c, s)
      const way = readIdler(s) ? 'the same way' : 'the opposite way'
      const trade = t < c.teeth ? 'Faster, with less turning force: a machine trades one for the other.' : t > c.teeth ? 'Slower, with more turning force: a machine trades one for the other.' : 'Same teeth, same speed.'
      const idle = readIdler(s) ? ' The idler changes the direction, not the speed.' : ''
      return `Yes. The output gear turns ${turnsText(gearTurns(c, t))} for each turn of the handle, ${way}. ${c.teeth} teeth ÷ ${t} teeth = ${fmt(gearTurns(c, t))}.${idle} ${trade}`
    }
  }
}

/** What a wrong card says: what the learner made, never where the answer is. */
export function madeText(c: MachineConfig, s: MachineState): string {
  switch (c.task) {
    case 'balance': {
      const { anti, clock } = sides(c, s)
      const lean = leanOf(c, s)
      if (lean !== 'level') return `The rule tips ${lean}: ${anti.sum} N ${c.unit} anticlockwise against ${clock.sum} N ${c.unit} clockwise.`
      return `The rule sits level with ${say(readDiscs(c, s), 'disc', 'discs')}, but fewer discs can do it.`
    }
    case 'lever': {
      const p = readFulcrum(c, s)
      if (!leverHolds(c, p)) return `The rock has not moved: with the fulcrum ${p * 10} cm from the rock it takes more than your ${c.push} N.`
      return `The rock lifts, but your ${c.push} N has force to spare, so it could go higher.`
    }
    case 'pulley': {
      const n = readStrands(s)
      const pulled = readPulled(c, s)
      if (!canPull(c, n)) return `The crate has not moved: ${say(n, 'strand holds', 'strands hold')} it, and that takes more than your ${c.pull} N.`
      if (pulled < n * c.height) return `The crate is on its way, but it has not reached the shelf: ${say(pulled, 'metre', 'metres')} of rope pulled so far.`
      return `The crate is on the shelf, but with ${n} strands you hauled ${n * c.height} m of rope, and fewer strands would do.`
    }
    case 'gears': {
      const t = readTeeth(c, s)
      const way = readIdler(s) ? 'the same way as the handle' : 'the opposite way to the handle'
      return `You made an output gear that turns ${turnsText(gearTurns(c, t))} for each turn of the handle, ${way}.`
    }
  }
}

// ---------------------------------------------------------------------------
// Reading the tutor's config.

const keyOf = (raw: unknown) => (typeof raw === 'string' ? raw.trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : '')
const firstOf = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)

function readNumber(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw + 0 : null
  if (typeof raw !== 'string') return null
  const m = raw.trim().match(/^[-+]?\d+(?:\.\d+)?/)
  return m ? Number(m[0]) : null
}

function readForce(raw: unknown): number | null {
  const n = readNumber(raw)
  if (n === null) return null
  // 2 kg on a hanger, at the g = 10 N/kg of the school syllabuses.
  return typeof raw === 'string' && /kg\b/i.test(raw) ? n * 10 : n
}

/** A distance, with the unit if it says one; a fraction of a metre is read in centimetres. */
function readDistance(raw: unknown): { value: number; unit?: Unit } | null {
  const n = readNumber(raw)
  if (n === null) return null
  if (typeof raw !== 'string') return { value: n }
  if (/\d\s*cm\b/i.test(raw)) return { value: n, unit: 'cm' }
  if (/\d\s*m(?:et(?:er|re)s?)?\b/i.test(raw)) return Number.isInteger(n) ? { value: n, unit: 'm' } : { value: Math.round(n * 1000) / 10, unit: 'cm' }
  return { value: n }
}

const TASK_WORDS: Record<string, MachineConfig['task']> = {
  balance: 'balance', moment: 'balance', moments: 'balance', 'principle-of-moments': 'balance', 'law-of-moments': 'balance', 'turning-effect': 'balance', 'turning-effects': 'balance', turning: 'balance',
  beam: 'balance', rule: 'balance', 'metre-rule': 'balance', 'meter-rule': 'balance', seesaw: 'balance', 'see-saw': 'balance', hang: 'balance', 'hang-weights': 'balance', weights: 'balance', torque: 'balance', equilibrium: 'balance',
  pivot: 'balance', 'move-pivot': 'balance', 'move-the-pivot': 'balance', 'centre-of-gravity': 'balance', 'center-of-gravity': 'balance', 'centre-of-mass': 'balance', 'center-of-mass': 'balance', 'balance-point': 'balance',
  lever: 'lever', levers: 'lever', crowbar: 'lever', fulcrum: 'lever', 'force-multiplier': 'lever', 'lift-the-rock': 'lever', rock: 'lever',
  pulley: 'pulley', pulleys: 'pulley', 'pulley-system': 'pulley', 'block-and-tackle': 'pulley', strands: 'pulley', hoist: 'pulley', rope: 'pulley', crate: 'pulley', 'mechanical-advantage': 'pulley',
  gear: 'gears', gears: 'gears', 'gear-train': 'gears', 'gear-ratio': 'gears', gearing: 'gears', cogs: 'gears', idler: 'gears',
}
const PIVOT_WORDS = new Set(['pivot', 'move-pivot', 'move-the-pivot', 'centre-of-gravity', 'center-of-gravity', 'centre-of-mass', 'center-of-mass', 'balance-point'])

const MOVE_WORDS: Record<string, Move> = {
  weight: 'weight', slide: 'weight', position: 'weight', distance: 'weight', 'slide-weight': 'weight', 'move-weight': 'weight', 'move-the-weight': 'weight',
  discs: 'discs', disc: 'discs', force: 'discs', stack: 'discs', 'add-discs': 'discs', load: 'discs',
  both: 'both', free: 'both', lightest: 'both', least: 'both', fewest: 'both', 'fewest-discs': 'both', 'force-multiplier': 'both',
  pivot: 'pivot', stand: 'pivot', fulcrum: 'pivot', 'move-pivot': 'pivot', 'move-the-pivot': 'pivot', 'centre-of-gravity': 'pivot', 'center-of-gravity': 'pivot', 'centre-of-mass': 'pivot', 'center-of-mass': 'pivot',
}

function readSide(raw: unknown): Side | undefined {
  const k = keyOf(raw)
  return k === 'left' ? 'left' : k === 'right' ? 'right' : undefined
}

type RawLoad = { force: number; at?: { value: number; unit?: Unit }; side?: Side }

function readLoad(raw: unknown, side?: Side): RawLoad | null {
  if (typeof raw === 'number' || typeof raw === 'string') {
    const force = readForce(raw)
    return force === null ? null : { force, side }
  }
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const force = readForce(firstOf(o, ['force', 'weight', 'newtons', 'n', 'load', 'size']))
  if (force === null) return null
  const rawAt = firstOf(o, ['at', 'distance', 'position', 'd', 'from', 'x', 'mark'])
  const at = rawAt === undefined ? undefined : readDistance(rawAt)
  if (at === null) return null
  return { force, at, side: readSide(o.side) ?? side }
}

function readLoads(src: Record<string, unknown>): RawLoad[] | null {
  const out: RawLoad[] = []
  const list = firstOf(src, ['loads', 'load', 'weights'])
  if (list !== undefined) {
    for (const item of Array.isArray(list) ? list : [list]) {
      const l = readLoad(item)
      if (!l) return null
      out.push(l)
    }
  }
  for (const side of ['left', 'right'] as const) {
    if (src[side] === undefined) continue
    for (const item of Array.isArray(src[side]) ? (src[side] as unknown[]) : [src[side]]) {
      const l = readLoad(item, side)
      if (!l) return null
      out.push(l)
    }
  }
  return out
}

function readBalance(src: Record<string, unknown>, word: string): BalanceConfig | null {
  const moveKey = keyOf(firstOf(src, ['move', 'moves', 'learner', 'handle', 'find']))
  if (moveKey && !has(MOVE_WORDS, moveKey)) return null
  const weight = src.weight === undefined || typeof src.weight === 'object' ? undefined : readForce(src.weight)
  if (weight === null) return null
  const rawHanger = firstOf(src, ['at', 'distance', 'hangAt'])
  const hanger = rawHanger === undefined ? undefined : readDistance(rawHanger)
  if (hanger === null) return null
  const rawPivot = firstOf(src, ['pivot', 'pivotAt', 'fulcrum'])
  const pivotRead = rawPivot === undefined ? undefined : readDistance(rawPivot)
  if (pivotRead === null) return null
  const rawBeam = firstOf(src, ['beam', 'beamWeight', 'ownWeight', 'ruleWeight'])
  const beam = rawBeam === undefined ? undefined : readForce(rawBeam)
  if (beam === null) return null

  const move: Move = moveKey ? MOVE_WORDS[moveKey] : PIVOT_WORDS.has(word) ? 'pivot' : weight !== undefined ? 'weight' : hanger !== undefined ? 'discs' : 'both'
  const rawLoads = readLoads(src)
  if (!rawLoads) return null
  // The first card a tutor could ask for, when it names only the idea.
  const given: RawLoad[] = rawLoads.length
    ? rawLoads
    : move === 'pivot'
      ? [{ force: 1, at: { value: 0, unit: 'cm' } }, { force: 4, at: { value: 100, unit: 'cm' } }]
      : [{ force: 6, at: { value: 20, unit: 'cm' }, side: 'left' }]
  const absolute = move === 'pivot' || pivotRead !== undefined

  const seen = [...given.map((l) => l.at), hanger, pivotRead].filter((d): d is { value: number; unit?: Unit } => !!d)
  const named = keyOf(src.unit) === 'm' || keyOf(src.unit) === 'metres' || keyOf(src.unit) === 'meters' ? 'm' : keyOf(src.unit) === 'cm' || keyOf(src.unit) === 'centimetres' || keyOf(src.unit) === 'centimeters' ? 'cm' : undefined
  const unit: Unit = named ?? seen.find((d) => d.unit)?.unit ?? (seen.some((d) => d.value !== 0 && Math.abs(d.value) < 10) ? 'm' : 'cm')
  const step = unit === 'm' ? 1 : 10
  const fix = (d: { value: number; unit?: Unit }) => (d.unit && d.unit !== unit ? (d.unit === 'cm' ? d.value / 100 : d.value * 100) : d.value)
  const loads: Load[] = given.map((l) => {
    // A rule read from its left end: a load named only by its side goes at that end.
    if (absolute) return { force: l.force, at: l.at ? fix(l.at) : l.side === 'right' ? 2 * HALF_MARKS * step : 0 }
    return { force: l.force, at: Math.abs(l.at ? fix(l.at) : 2 * step), side: l.side ?? 'left' }
  })
  const out: BalanceConfig = { task: 'balance', move, loads, unit }
  if (move === 'weight' && weight !== undefined) out.weight = weight
  if (move === 'discs' && hanger) out.at = fix(hanger)
  if (move !== 'pivot' && pivotRead) out.pivot = fix(pivotRead)
  if (beam !== undefined && beam !== 0) out.beam = beam
  return out
}

function readTurns(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw + 0 : null
  if (typeof raw !== 'string') return null
  const text = raw.trim().toLowerCase()
  const ratio = text.match(/^(\d+(?:\.\d+)?)\s*[:/]\s*(\d+(?:\.\d+)?)/)
  if (ratio) return Number(ratio[2]) === 0 ? null : Number(ratio[1]) / Number(ratio[2])
  const k = keyOf(text)
  const WORDS: Record<string, number> = { once: 1, twice: 2, half: 0.5, 'a-half': 0.5, 'one-half': 0.5, 'half-a-turn': 0.5, third: 1 / 3, 'a-third': 1 / 3, 'one-third': 1 / 3, quarter: 0.25, 'a-quarter': 0.25, 'one-quarter': 0.25, thrice: 3, 'three-times': 3, 'two-times': 2, 'four-times': 4, 'one-time': 1 }
  if (has(WORDS, k)) return WORDS[k]
  return readNumber(text)
}

function readDirection(raw: unknown): Direction | null {
  const k = keyOf(raw)
  if (k === '' || k === 'any' || k === 'either') return 'any'
  if (k === 'same' || k === 'same-way' || k === 'same-direction' || k === 'the-same-way' || k === 'same-as-handle') return 'same'
  if (k === 'opposite' || k === 'opposite-way' || k === 'opposite-direction' || k === 'the-opposite-way' || k === 'reverse' || k === 'reversed') return 'opposite'
  return null
}

function readConfig(raw: unknown): MachineConfig | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const nested = o.task && typeof o.task === 'object' ? (o.task as Record<string, unknown>) : null
  const src = nested ?? o
  const word = keyOf(firstOf(src, nested ? ['kind', 'task', 'type'] : ['task', 'kind', 'type', 'mode']))
  if (word && !has(TASK_WORDS, word)) return null
  const task: MachineConfig['task'] | null = word
    ? TASK_WORDS[word]
    : src.push !== undefined || src.effort !== undefined || src.rock !== undefined ? 'lever'
      : src.strands !== undefined || src.pull !== undefined || src.height !== undefined || src.crate !== undefined ? 'pulley'
        : src.teeth !== undefined || src.turns !== undefined || src.driver !== undefined ? 'gears'
          : src.loads !== undefined || src.load !== undefined || src.left !== undefined || src.right !== undefined ? 'balance'
            : null
  if (!task) return null

  if (task === 'balance') return readBalance(src, word)
  if (task === 'lever') {
    const load = readForce(firstOf(src, ['load', 'rock', 'weight', 'resistance']) ?? 600)
    const push = readForce(firstOf(src, ['push', 'effort', 'force', 'limit']) ?? (load !== null ? load / 4 : 150))
    return load === null || push === null ? null : { task, load, push }
  }
  if (task === 'pulley') {
    const load = readForce(firstOf(src, ['load', 'crate', 'weight']) ?? 600)
    const pull = readForce(firstOf(src, ['pull', 'effort', 'force', 'limit']) ?? (load !== null ? load / 3 : 200))
    const height = readNumber(firstOf(src, ['height', 'lift', 'shelf', 'rise']) ?? 2)
    return load === null || pull === null || height === null ? null : { task, load, pull, height }
  }
  const teeth = readNumber(firstOf(src, ['teeth', 'driver', 'input', 'handle']) ?? 24)
  const turns = readTurns(firstOf(src, ['turns', 'output', 'ratio', 'outputTurns']) ?? 2)
  const direction = readDirection(firstOf(src, ['direction', 'way', 'sense']))
  return teeth === null || turns === null || direction === null ? null : { task: 'gears', teeth, turns, direction }
}

// ---------------------------------------------------------------------------
// What a config cannot be drawn as, with a nearby example that works.

function balanceFaults(c: BalanceConfig): string[] {
  const out: string[] = []
  const step = stepOf(c)
  const u = c.unit
  const last = 2 * HALF_MARKS * step
  const reach = HALF_MARKS * step
  const absolute = isAbsolute(c)
  if (!c.loads.length) out.push(`A rule with nothing on it teaches nothing: give it a load, e.g. loads [{ "force":6, "at":${2 * step}, "side":"left" }].`)
  if (c.loads.length > MAX_LOADS) out.push(`${c.loads.length} loads crowd the rule (${MAX_LOADS} at most): use e.g. loads [{ "force":6, "at":${2 * step}, "side":"left" }].`)
  for (const l of c.loads) {
    if (!(l.force > 0) || !Number.isInteger(l.force)) out.push(`A load of ${l.force} N cannot be stacked in whole discs: use whole newtons, e.g. force ${Math.max(1, Math.round(l.force))}.`)
    const limit = absolute ? last : reach
    if (!Number.isInteger(l.at / step) || Math.abs(l.at) > limit || (!absolute && l.at === 0) || l.at < 0) {
      const near = Math.max(absolute ? 0 : step, Math.min(limit, Math.round(Math.abs(l.at) / step) * step))
      out.push(`A load at ${l.at} ${u} is not on a mark: the marks are ${step} ${u} apart, ${absolute ? `from 0 to ${last} ${u} along the rule` : `up to ${reach} ${u} from the pivot`}. Use e.g. at ${near}.`)
    }
  }
  if (new Set(c.loads.map((l) => markOfLoad(c, l))).size < c.loads.length) out.push(`Two loads on one mark cannot be told apart: use different marks, or add their forces, e.g. one load of ${c.loads.reduce((n, l) => n + l.force, 0)} N.`)
  if (c.beam && c.loads.some((l) => markOfLoad(c, l) === 0)) out.push(`A load at the rule's middle would hang on the arrow for its own weight: use another mark, e.g. at ${absolute ? 4 * step : step}.`)
  if (c.pivot !== undefined && c.move !== 'pivot') {
    if (!Number.isInteger(c.pivot / step) || c.pivot <= 0 || c.pivot >= last) out.push(`A stand at ${c.pivot} ${u} is not on a mark inside the rule: use e.g. pivot ${3 * step}.`)
  }
  if (c.beam !== undefined && (!(c.beam > 0) || !Number.isInteger(c.beam))) out.push(`A rule weighing ${c.beam} N cannot be used: use whole newtons, e.g. beam 2.`)
  if (out.length) return out

  const u1 = discUnit(c)
  const forces = givenForces(c)
  if (!DISC_SIZES.some((x) => forces.every((f) => f % x === 0 && f / x <= MAX_DISCS))) {
    return [`These forces (${forces.map((f) => `${f} N`).join(', ')}) do not stack in ${MAX_DISCS} equal discs or fewer: use forces like 2 N and 6 N, or 200 N and 600 N.`]
  }
  if (c.move === 'pivot') {
    if (momentOfFixed(c, 0) === 0) return [`These loads already balance with the stand at the middle, so sliding it teaches nothing: change one, e.g. force ${c.loads[0].force + u1}.`]
    if (solutions(c).length) return []
    const lastLoad = c.loads[c.loads.length - 1]
    const fixes = discRange().map((d) => d * u1).filter((f) => {
      const test = { ...c, loads: [...c.loads.slice(0, -1), { ...lastLoad, force: f }] }
      return momentOfFixed(test, 0) !== 0 && solutions(test).length > 0
    }).sort((a, b) => Math.abs(a - lastLoad.force) - Math.abs(b - lastLoad.force))
    return [`No mark balances these loads: the balance point falls between marks, or off the rule. ${fixes.length ? `Change the last load, e.g. force ${fixes[0]}.` : 'Use loads that share a mark, e.g. 1 N at 0 and 4 N at 100.'}`]
  }
  if (momentOfFixed(c, fixedPivot(c)) === 0) return [`These loads already balance, so there is nothing for the brass stack to do: change one, e.g. force ${c.loads[0].force + u1}.`]
  if (c.move === 'weight') {
    if (c.weight === undefined) return [`Moving a stack needs its size: give it one, e.g. weight ${Math.max(1, Math.ceil(c.loads[0].force / 2))}.`]
    if (!(c.weight > 0) || !Number.isInteger(c.weight)) return [`A weight of ${c.weight} N cannot be stacked in whole discs: use whole newtons, e.g. weight ${Math.max(1, Math.round(c.weight))}.`]
    if (solutions(c).length) return []
    const fixes = discRange().map((d) => d * u1).filter((w) => solutions({ ...c, weight: w }).length > 0).sort((a, b) => Math.abs(a - c.weight!) - Math.abs(b - c.weight!))
    return [`A ${c.weight} N weight does not balance this on any mark. ${fixes.length ? `Use a weight that does, e.g. weight ${fixes[0]}.` : 'Use a smaller load, e.g. 6 N at 20 cm with weight 3.'}`]
  }
  if (c.move === 'discs') {
    if (c.at === undefined) return [`Adding discs needs a place to hang them: give it one, e.g. at ${3 * step}.`]
    const limit = absolute ? last : reach
    if (!Number.isInteger(c.at / step) || c.at < 0 || (!absolute && c.at === 0) || c.at > limit) return [`A stack at ${c.at} ${u} is not on a mark: use e.g. at ${3 * step}.`]
    const taken = c.loads.some((l) => markOfLoad(c, l) === hangerMark(c)) || (!!c.beam && hangerMark(c) === 0)
    if (taken) return [`The brass stack would share a mark with a load: use e.g. at ${absolute ? (fixedPivot(c) + freeSide(c) + HALF_MARKS) * step : step}.`]
    if (hangerMark(c) === fixedPivot(c)) return [`A stack on the pivot turns nothing: use e.g. at ${absolute ? (fixedPivot(c) + freeSide(c) + HALF_MARKS) * step : step}.`]
    if (solutions(c).length) return []
    const fixes = Array.from({ length: 2 * HALF_MARKS + 1 }, (_, k) => k * step).filter((a) => (absolute || a > 0) && a <= limit && solutions({ ...c, at: a }).length > 0 && !c.loads.some((l) => markOfLoad(c, l) === hangerMark({ ...c, at: a })) && !(c.beam && hangerMark({ ...c, at: a }) === 0))
    fixes.sort((a, b) => Math.abs(a - c.at!) - Math.abs(b - c.at!))
    return [`No whole number of ${u1} N discs (up to ${MAX_DISCS}) balances this from ${c.at} ${u}. ${fixes.length ? `Hang them elsewhere, e.g. at ${fixes[0]}.` : 'Use a smaller load, e.g. 6 N at 20 cm with at 40.'}`]
  }
  if (!solutions(c).length) return [`No stack of up to ${MAX_DISCS} discs balances this on any mark: use a smaller load, e.g. 6 N at ${2 * step}.`]
  return []
}

function leverFaults(c: LeverConfig): string[] {
  if (!(c.load > 0) || !(c.push > 0)) return ['A lever needs a load and a push above zero: use e.g. load 600 and push 150.']
  if (leverBest(c) === null) return [`A ${c.push} N push cannot lift ${c.load} N even with the fulcrum against the rock (9 times at most): use e.g. push ${Math.ceil(c.load / 4)}.`]
  if (leverHolds(c, LEVER_MARKS - 1)) return [`A ${c.push} N push lifts ${c.load} N with the fulcrum anywhere, so sliding it teaches nothing: use e.g. push ${Math.ceil(c.load / 4)}.`]
  return []
}

function pulleyFaults(c: PulleyConfig): string[] {
  const out: string[] = []
  if (!(c.load > 0) || !(c.pull > 0)) return ['A pulley needs a load and a pull above zero: use e.g. load 600 and pull 200.']
  if (strandsNeeded(c) > MAX_STRANDS) out.push(`${c.load} N needs more than ${MAX_STRANDS} strands (the most drawn here) at a ${c.pull} N pull: use e.g. pull ${Math.ceil(c.load / 4)}.`)
  if (!Number.isInteger(c.height) || c.height < 1 || c.height > 3) out.push(`A shelf ${c.height} m up is not drawn: the shelf can be 1, 2 or 3 m up, e.g. height ${Math.max(1, Math.min(3, Math.round(c.height)))}.`)
  else if (strandsNeeded(c) <= MAX_STRANDS && strandsNeeded(c) * c.height > MAX_ROPE) out.push(`That takes ${strandsNeeded(c) * c.height} m of rope, more than the card can coil (${MAX_ROPE} m): use e.g. height ${Math.floor(MAX_ROPE / strandsNeeded(c))}.`)
  return out
}

function gearFaults(c: GearsConfig): string[] {
  if (!HANDLE_TEETH.includes(c.teeth)) {
    // The nearest that also makes the turns asked for, so the example given is one that works.
    const works = HANDLE_TEETH.filter((t) => gearTarget({ ...c, teeth: t }) !== null)
    const near = [...(works.length ? works : HANDLE_TEETH)].sort((a, b) => Math.abs(a - c.teeth) - Math.abs(b - c.teeth))[0]
    return [`A handle gear of ${c.teeth} teeth is not drawn: use ${HANDLE_TEETH[0]} to ${HANDLE_TEETH[HANDLE_TEETH.length - 1]} in fours, e.g. teeth ${near}.`]
  }
  if (!(c.turns > 0)) return [`The output cannot turn ${c.turns} times: use e.g. turns 2.`]
  if (gearTarget(c) === null) {
    const near = GEAR_TEETH.map((t) => c.teeth / t).sort((a, b) => Math.abs(a - c.turns) - Math.abs(b - c.turns))[0]
    return [`With ${c.teeth} teeth on the handle gear, ${fmt(c.turns)} turns needs an output gear that is not drawn (${GEAR_TEETH[0]} to ${GEAR_TEETH[GEAR_TEETH.length - 1]} teeth, in fours): use e.g. turns ${fmt(near)}.`]
  }
  return []
}

// ---------------------------------------------------------------------------
// What a prompt can safely say, and what it must leave to the hands.

export function goodPrompt(c: MachineConfig): string {
  switch (c.task) {
    case 'balance':
      if (c.move === 'weight') return 'Drag the brass stack along the rule, or use the buttons, until the rule sits level.'
      if (c.move === 'discs') return 'Add or take off brass discs with the buttons until the rule sits level.'
      if (c.move === 'both') return 'Drag the brass stack along the rule and change its discs with the buttons, until the rule sits level with as few discs as you can.'
      return 'Drag the stand along the bench, or use the buttons, until the rule sits level.'
    case 'lever':
      return `Drag the fulcrum along the ground, or use the buttons. Lift the ${c.load} N rock with your ${c.push} N push, as high as it will go.`
    case 'pulley':
      return `Use the buttons to change the strands and to pull the rope. Raise the crate to the shelf without pulling harder than ${c.pull} N, using as little rope as you can.`
    case 'gears': {
      const way = c.direction === 'any' ? '' : c.direction === 'same' ? ', the same way as the handle' : ', the opposite way to the handle'
      return `Change the output gear with the buttons, then drag the handle round or press Turn once to watch it. Make the output gear turn ${turnsText(c.turns)} for each turn of the handle${way}.`
    }
  }
}

const NUM_WORDS: Record<number, string> = { 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine', 10: 'ten', 11: 'eleven', 12: 'twelve' }
const countOf = (n: number) => `(?:${n}|${NUM_WORDS[n] ?? n})`

/** Which words the prompt is using to give the answer away, and what it promises that the card does not show. */
function promptLeaks(c: MachineConfig, text: string): { leak: boolean; absent: boolean } {
  const test = (r: RegExp) => r.test(text)
  const lost = /\bfriction\b|\befficien|\bfirst[- ]class\b|\bsecond[- ]class\b|\bthird[- ]class\b/i
  switch (c.task) {
    case 'balance': {
      const best = solutions(c)[0]
      const hints = /\b(?:further|farther)\s+(?:out|away|along|from)\b|\b(?:closer|nearer)\s+(?:to\s+)?(?:the\s+)?(?:pivot|cent(?:re|er)|middle|end|heavier|lighter|heavy|light)\b|\btowards?\s+the\s+(?:heavier|lighter|heavy|light)\b|\btwice\s+as\b|\bhalf\s+(?:the|as)\b|\bdouble\s+the\b|\d\s*N\s*(?:cm|m)\b|\bN\s*[·.]?\s*(?:cm|m)\b/i
      let leak = test(hints)
      if (best) {
        const step = stepOf(c)
        const given = givenForces(c)
        const dist = c.move === 'pivot' || isAbsolute(c) ? (best.at + HALF_MARKS) * step : Math.abs(best.at - fixedPivot(c)) * step
        const said = c.loads.some((l) => Math.abs(l.at) === dist)
        if (c.move !== 'discs' && !said) leak = leak || new RegExp(`\\b${dist}\\s*(?:${c.unit}|cent|met)|\\bmark\\s+${dist}\\b`, 'i').test(text)
        if (c.move === 'discs' || c.move === 'both') {
          const force = best.discs * discUnit(c)
          if (!given.includes(force)) leak = leak || new RegExp(`\\b${force}\\s*(?:N\\b|newton)`, 'i').test(text)
          leak = leak || new RegExp(`\\b${countOf(best.discs)}\\s+(?:brass\\s+)?(?:discs?|weights?)\\b`, 'i').test(text)
        }
      }
      const elsewhere = /\bpulleys?\b|\bropes?\b|\bgears?\b|\bteeth\b|\bcrowbar\b|\brock\b|\bangle\b|\bcouples?\b/i
      const noDrag = c.move === 'discs' && /\bdrag\b|\bslide\b/i.test(text)
      const noDiscs = (c.move === 'weight' || c.move === 'pivot') && /\b(?:add|take\s+off|remove)\b[^.]*\bdiscs?\b/i.test(text)
      return { leak, absent: test(elsewhere) || test(lost) || noDrag || noDiscs }
    }
    case 'lever': {
      const best = leverBest(c)
      const hints = /\b(?:close|closer|near|nearer|next)\s+(?:to\s+)?the\s+rock\b|\btowards?\s+the\s+rock\b|\baway\s+from\s+your\s+hand\b|\b(?:short|shorter|long|longer)\s+(?:arm|side|end)\b|\bfurther\s+your\s+hand\b/i
      let leak = test(hints)
      if (best !== null) {
        leak = leak || new RegExp(`\\b${best * 10}\\s*(?:cm|cent)`, 'i').test(text)
        const need = fmt(pushNeeded(c, best))
        if (Number(need) !== c.push && Number(need) !== c.load) leak = leak || new RegExp(`\\b${need}\\s*(?:N\\b|newton)`, 'i').test(text)
      }
      return { leak, absent: test(/\bpulleys?\b|\bropes?\b|\bgears?\b|\bteeth\b|\bdiscs?\b|\bhanger\b|\bwheelbarrow\b|\bscissors\b|\btweezers\b/i) || test(lost) }
    }
    case 'pulley': {
      const best = strandsNeeded(c)
      const hints = /\bcount\b|\bshar(?:e|es|ed|ing)\b|\beach\s+strand\b|\bmore\s+(?:strands|pulleys)\b|\bmechanical\s+advantage\s+(?:of|is)\b|\bdoes\s*n[o']?t\s+count\b/i
      const leak = test(hints)
        || new RegExp(`\\b${countOf(best)}\\s+(?:strands?|pulleys?|ropes?|wheels?)\\b`, 'i').test(text)
        || new RegExp(`\\b${best * c.height}\\s*(?:m\\b|met)`, 'i').test(text)
      return { leak, absent: test(/\bgears?\b|\bteeth\b|\blevers?\b|\bdrag\b|\bslide\b/i) || test(lost) }
    }
    case 'gears': {
      const target = gearTarget(c)
      const hints = /\b(?:add|use|put|fit|need|needs)\b[^.]*\bidler\b|\bodd\s+number\b|\beven\s+number\b|\b(?:smaller|bigger|larger|third|extra)\s+(?:output\s+)?gears?\b|\bfewer\s+teeth\b|\bmore\s+teeth\b/i
      const leak = test(hints) || (target !== null && target !== c.teeth && new RegExp(`\\b${target}[-\\s]*teeth\\b|\\b${target}[-\\s]*tooth\\b`, 'i').test(text))
      return { leak, absent: test(/\bpulleys?\b|\bropes?\b|\blevers?\b|\bbelts?\b|\bchains?\b|\bcompound\b|\bbevel\b|\bworm\b|\brack\b|\bdrag\s+(?:the\s+)?(?:\w+\s+)?gears?\b/i) || test(lost) }
    }
  }
}

export const momentsMachinesEngine: SceneEngine<MachineConfig, MachineState> = {
  id: 'moments-machines',
  // Few and distinctive: `scenesFor` matches a covers word by its first five letters, so "moments" here would catch "momentum",
  // "levers" would catch "leverage" and "pulleys" would catch "pulled". Everything else is a whole phrase.
  covers: ['fulcrum', 'fulcrums', 'torque', 'torques'],
  phrases: [
    'moments', 'turning moment', 'turning moments', 'moment of a force', 'moments of forces', 'moments of a force', 'taking moments', 'principle of moments', 'law of moments', 'clockwise moment', 'clockwise moments', 'anticlockwise moment', 'anticlockwise moments', 'moment of a couple',
    'turning effect', 'turning effects', 'turning force', 'turning forces', 'lever', 'levers', 'pivot', 'pivots', 'crowbar', 'seesaw', 'seesaws', 'see-saw', 'see-saws',
    'centre of gravity', 'center of gravity', 'centre of mass', 'center of mass', 'equilibrium of a rigid body', 'equilibrium of rigid bodies', 'rigid body equilibrium', 'equilibrium of bodies', 'statics',
    'pulley', 'pulleys', 'pulley system', 'pulley systems', 'block and tackle', 'gears', 'gear ratio', 'gear ratios', 'gear train', 'gear trains', 'gear wheel', 'gear wheels', 'gearwheel', 'gearwheels', 'toothed wheel', 'toothed wheels',
    'simple machine', 'simple machines', 'forces and machines', 'work and machines', 'energy and machines', 'work energy power and machines', 'mechanical advantage', 'velocity ratio', 'force multiplier', 'force multipliers', 'force magnifier', 'force magnifiers', 'distance multiplier', 'distance multipliers',
  ],
  // Near misses. `words` drops anything under three letters and small words like "about", so each of these keeps two real words.
  notFor: [
    // A moment in time, in a story, in history.
    'key moments', 'defining moments', 'historic moments', 'historical moments', 'memorable moments', 'special moments', 'proud moments', 'dramatic moments', 'critical moments', 'important moments', 'pivotal moments', 'great moments', 'magic moments', 'tense moments', 'final moments', 'last moments', 'first moments', 'teachable moments',
    'moments history', 'moments time', 'moments truth', 'moments silence', 'moments being', 'moments life', 'moments story', 'moments text', 'moments play', 'moments novel', 'moments poem', 'moments film', 'moments reflection', 'moments joy', 'moments crisis', 'moments change', 'moments war', 'moments decision',
    // Moment as other physics and mathematics.
    'moment inertia', 'moments inertia', 'dipole moment', 'dipole moments', 'magnetic moment', 'magnetic moments', 'bending moment', 'bending moments', 'moment generating', 'moments distribution', 'method moments', 'probability moments', 'sample moments', 'statistical moments', 'central moments', 'raw moments', 'moment area', 'moments area', 'second moment', 'second moments', 'moment magnitude',
    // Torque this card cannot draw.
    'torque coil', 'torque current', 'torque magnetic', 'torque motor', 'motor torque', 'angular acceleration', 'engine torque',
    // Pivot elsewhere.
    'pivot table', 'pivot tables', 'pivot chart', 'pivot charts', 'pivot joint', 'pivot joints', 'pivot foot', 'pivot turn', 'pivot turns', 'pivot shot', 'pivot element', 'pivot row', 'pivot column', 'centre pivot', 'center pivot', 'pivot irrigation', 'pivot asia', 'business pivot', 'startup pivot', 'pivot business',
    // Lever and gear elsewhere.
    'lever arch', 'policy levers', 'policy lever', 'economic levers', 'levers power', 'levers government', 'levers change', 'tyre lever', 'tyre levers', 'lever action', 'fishing gears', 'landing gears', 'gears war',
    // Centre of gravity as a figure of speech.
    'economic centre gravity', 'demographic centre gravity', 'political centre gravity', 'cultural centre gravity',
    // Simple machines that are only the ones not drawn.
    'machines inclined plane', 'machines inclined planes', 'machines wedges', 'machines screws',
  ],
  // The learner varies a size (how far out, how many discs, how many strands, how many teeth) and sees what it does to the machine.
  isolates: 'magnitude',

  parse: readConfig,

  faults(c) {
    switch (c.task) {
      case 'balance':
        return balanceFaults(c)
      case 'lever':
        return leverFaults(c)
      case 'pulley':
        return pulleyFaults(c)
      case 'gears':
        return gearFaults(c)
    }
  },

  promptFaults(c, prompt) {
    const text = prompt.replace(/\s+/g, ' ')
    const { leak, absent } = promptLeaks(c, text)
    const example = goodPrompt(c)
    const out: string[] = []
    if (leak) out.push(`the prompt gives the answer away: it says how much, where to go or what will happen, which the learner is to find with their hands -- ask for the outcome only ("${example}")`)
    if (absent) out.push(`the prompt promises something this card does not show or let the learner do -- ask for what it does ("${example}")`)
    return out
  },

  initial: start,

  check(c, s) {
    return { ok: solved(c, s), wrongIds: [] }
  },

  solve: answer,

  View: MomentsMachinesView,

  prompt: `SCENE "moments-machines" -- real machines on a quiet light panel, each with one move that makes the trade between force and distance obvious. All are ideal: no friction, light bars and ropes.
  For: moments and the principle of moments, turning effects, levers and fulcrums, force multipliers, centre of gravity of a loaded beam, equilibrium of a beam, pulley systems and mechanical advantage, velocity ratio, gear ratios and gear direction. It answers "the heavier side always goes down", "the pivot must be in the middle", "machines make extra energy" and "mechanical advantage is the number of pulleys".
  balance: a wooden rule on a stand, with iron and brass slotted discs on hangers. The rule tips and settles at once with each move, further the more it is out of balance, so the learner can feel the way there; the card holds back every sum until marked.
    loads: up to 3 fixed iron stacks, each { "force":<newtons>, "at":<distance from the pivot>, "side":"left"|"right" }. unit: "cm" (marks 10 cm apart, to 50 cm) or "m" (marks 1 m apart, to 5 m). Forces stack in up to 12 discs, so 6 N, 60 N or 600 N all draw.
    move: "weight" -- the learner drags a brass stack of the given "weight" along the rule. The load can be heavier: give a lighter weight, so the sum, not the size, wins. It needs a mark that balances: 6 N at 20 cm with weight 3.
    move: "discs" -- the brass stack hangs at the given "at", and the learner adds or takes off discs.
    move: "both" -- the learner moves the stack and changes its discs, and it must sit level with the fewest discs: the force multiplier.
    move: "pivot" -- all stacks are fixed, and the learner drags the stand under the rule to find the balance point, its centre of gravity. Now "at" runs along the rule from its left end, 0 to 100 cm, with no side: e.g. 1 N at 0 and 4 N at 100. "beam": the rule's own weight in newtons, acting at its middle, optional; nothing else hangs on that mark.
    "pivot": 30 sets the stand away from the middle for the other moves, with "at" read along the rule from its left end, as for a uniform beam on an off-centre pivot; give "beam" too.
  lever: a crowbar under a rock, resting on a wooden fulcrum. The learner drags the fulcrum along the ground. load: the rock's weight in newtons. push: the most the learner's hand can push. A slim meter shows the push needed against the push they have, with no numbers. The rock lifts the moment the push is enough; the card asks for the highest lift, which is the fulcrum as far from the rock as it can be and still lift. Dashes show where bar and rock began, so the long travel of the hand against the short rise of the rock is seen. The mark gives the sum and the ratio.
  pulley: a block and tackle lifting a crate to a shelf. The learner steps the strands holding the crate from 1 to 6, the wheels and rope redrawing each time and the holding strands numbered, then pulls the rope a metre at a time, and the crate rises by that metre shared among the strands. If the pull needed is more than their "pull", the rope will not move. load: the crate's weight. pull: the most they can pull. height: the shelf, 1, 2 or 3 m up. The fewest strands that can do it is what is marked, and the rope coils on the ground, up to 12 m. For a single fixed pulley, give a pull as big as the load.
  gears: real meshing gears, with a mark on each. The learner drags the handle round, or presses Turn once, and watches; counts of turns are under the picture. They change the output gear, 8 to 48 teeth in fours, and can add an idler. teeth: the handle gear, 16 to 48 in fours. turns: the output's turns per turn of the handle, e.g. 3 or 0.5, and it must come to a gear that is drawn. direction: "same" (needs the idler), "opposite" or "any".
  Not drawn: lever classes, wheelbarrows, arms and joints, ramps, screws, wedges, wheel and axle, hydraulics, belts, compound gears, friction, efficiency values, forces at an angle, couples, moment of inertia. Do not use it for a moment in time, moments in statistics, dipole moments, pivot tables or pivot joints.
  Before marking the card shows the machine, its parts, the given forces and the positions the learner has set. It holds back the sums, the rule, the fewest discs or strands and the rope needed. The prompt must ask for the outcome only: do NOT say where to go, how many, or what will happen, such as "further out", "nearer the rock", "3 strands" or "add an idler".
  config: { "task":"balance", "move":"weight", "loads":[{ "force":6, "at":20, "side":"left" }], "weight":3, "unit":"cm" }  -- the prompt says "Drag the brass stack along the rule, or use the buttons, until the rule sits level."
       or { "task":"balance", "move":"pivot", "loads":[{ "force":1, "at":0 }, { "force":4, "at":100 }], "unit":"cm" }  -- the prompt says "Drag the stand along the bench, or use the buttons, until the rule sits level."
       or { "task":"lever", "load":600, "push":150 }  -- the prompt says "Drag the fulcrum along the ground, or use the buttons. Lift the 600 N rock with your 150 N push, as high as it will go."
       or { "task":"pulley", "load":600, "pull":200, "height":2 }  -- the prompt says "Use the buttons to change the strands and to pull the rope. Raise the crate to the shelf without pulling harder than 200 N, using as little rope as you can."
       or { "task":"gears", "teeth":24, "turns":3, "direction":"same" }  -- the prompt says "Change the output gear with the buttons, then drag the handle round or press Turn once to watch it. Make the output gear turn 3 times for each turn of the handle, the same way as the handle."
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drag the brass stack along the rule, or use the buttons, until the rule sits level.",
    "payload": { "engine":"moments-machines", "config": { "task":"balance", "move":"weight", "loads":[{ "force":6, "at":20, "side":"left" }], "weight":3, "unit":"cm" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"magnitude", "apparatus":"scene:moments-machines", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drag the fulcrum along the ground, or use the buttons. Lift the 600 N rock with your 150 N push, as high as it will go.",
    "payload": { "engine":"moments-machines", "config": { "task":"lever", "load":600, "push":150 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"magnitude", "apparatus":"scene:moments-machines", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Use the buttons to change the strands and to pull the rope. Raise the crate to the shelf without pulling harder than 200 N, using as little rope as you can.",
    "payload": { "engine":"moments-machines", "config": { "task":"pulley", "load":600, "pull":200, "height":2 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"magnitude", "apparatus":"scene:moments-machines", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Change the output gear with the buttons, then drag the handle round or press Turn once to watch it. Make the output gear turn 3 times for each turn of the handle, the same way as the handle.",
    "payload": { "engine":"moments-machines", "config": { "task":"gears", "teeth":24, "turns":3, "direction":"same" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"magnitude", "apparatus":"scene:moments-machines", "why":"..." } }`,
}

registerEngine(momentsMachinesEngine as SceneEngine<unknown, unknown>)
