// lib/studylab/engines/forces-next/config.ts
import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { ForcesView } from './View'

/**
 * Forces along one line, for Cambridge IGCSE Physics 0625 and lower secondary.
 *
 * 1. "resultant" -- an object (a box, a car, a boat or a skydiver) has two to
 *    four forces drawn as arrows to scale, each labelled in newtons. The tutor
 *    names the object, how it starts (at rest, or moving one way) and what the
 *    forces do to it (balanced, speed it up, slow it down); the engine deals the
 *    forces. The learner gives the resultant's size and direction, then says what
 *    happens to the motion. The resultant is drawn only once marked.
 * 2. "make" -- the same pictures, with one arrow whose end the learner drags (or
 *    steps with the keys, one step at a time) until the resultant meets an aim:
 *    zero (balanced forces), or a size and direction. The card prints no
 *    resultant of its own before marking: the picture is the readout, since the
 *    arrows are to scale and the learner reads the sum off their lengths.
 * 3. "f-ma" -- a mass and a resultant force: the learner works out the
 *    acceleration, the force, or the mass; or, for "weight", the weight of a
 *    mass with g printed on the card. A typed number, marked exactly.
 *
 * The tutor never writes a force's value, a coordinate or an answer. It names
 * what to ask; the engine owns every number and checks every configuration is
 * physically sensible (a car at rest has no air resistance to draw; a box at
 * rest cannot be pushed so that friction wins).
 *
 * Where the facts come from.
 * - Cambridge IGCSE Physics 0625, section 1.5.1 "Effects of forces": a resultant
 *   force is the single force with the same effect as all the forces on an object;
 *   for forces along the same straight line it is found by adding those in one
 *   direction, adding those in the other, and subtracting. With no resultant
 *   force (balanced forces) an object at rest stays at rest and a moving object
 *   keeps moving at a steady speed in a straight line (Newton's first law); a
 *   resultant force changes its speed or direction. In one dimension a resultant
 *   acting along the motion speeds the object up, one acting against it slows it
 *   down, and from rest the object starts to move the way the resultant points.
 * - F = ma: the resultant force (N) equals mass (kg) times acceleration (m/s2),
 *   the acceleration being in the direction of the resultant force (0625 1.5.1,
 *   Newton's second law); the newton is the unit of force.
 * - Weight is the gravitational force on a mass: W = mg, with g the gravitational
 *   field strength, 9.8 N/kg at the Earth's surface (0625 section 1.3 "Mass and
 *   weight"; the lead's brief for this engine names 9.8). Some papers state
 *   10 N/kg, so the card always prints the value of g it uses, and the tutor may
 *   write 10. Weight is a force in newtons; mass is in kilograms.
 * - Friction and the resistive forces (air resistance, water resistance) act
 *   against the motion; at rest there is no air or water resistance, and static
 *   friction can only match, never beat, the push (so at rest a resistive force
 *   never wins). A skydiver's weight acts down and air resistance up; they are
 *   equal at a steady speed. The cars and boats are drawn on a level surface or
 *   water, where up and down the weight and the support balance, so only the
 *   forces along the line are drawn (the card says so).
 * - The numbers are teaching numbers, not data: round multiples of a unit that
 *   suits each object (5 N for a box, 100 or 200 N for a car or boat), so arrows
 *   can be drawn to scale and the sums are whole numbers.
 *
 * All arithmetic is exact: forces are whole numbers of a unit; accelerations are
 * whole tenths; a typed answer is read as an exact decimal and compared by
 * cross-multiplying, never as a float.
 */

// ---------------------------------------------------------------------------
// Small helpers.

const own = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k)
const slug = (raw: string) => raw.trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
const listOr = (items: string[]) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} or ${items[items.length - 1]}`)
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)
const shown = (v: unknown) => (typeof v === 'string' ? `"${v}"` : JSON.stringify(v))

/** A hash of text, well mixed in its low bits: the engine's own dice, so a card always deals the same. */
export function hashOf(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  h ^= h >>> 16
  h = Math.imul(h, 2246822507)
  h ^= h >>> 13
  h = Math.imul(h, 3266489909)
  h ^= h >>> 16
  return h >>> 0
}
const pick = <T,>(list: readonly T[], key: string): T => list[hashOf(key) % list.length]

// ---------------------------------------------------------------------------
// Exact numbers: a typed answer is a decimal read as a fraction.

export type Rat = { n: number; d: number }
export const eqRat = (a: Rat, b: Rat): boolean => a.n * b.d === b.n * a.d
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a)
export const rat = (n: number, d = 1): Rat => {
  const g = gcd(Math.abs(n), Math.abs(d)) || 1
  return { n: n / g, d: d / g }
}

export type Unit = 'force' | 'accel' | 'mass'
const UNIT_WORDS: Record<Unit, RegExp> = {
  force: /^(?:n|newtons?)$/i,
  accel: /^(?:m\/s(?:\^?2|²)|m\s?s\^?-2|m\/s\/s)$/i,
  mass: /^(?:kg|kilograms?)$/i,
}

/**
 * What a learner typed, as an exact fraction, or null when it is not a plain
 * decimal number (up to three places) with the quantity's own unit, if any. A
 * comma is a thousands separator only in the groups of three ("1,200"); "7,5" is
 * not read, so a decimal comma is never taken for a thousand.
 */
export function readNumber(raw: unknown, unit: Unit): Rat | null {
  if (typeof raw !== 'string') return null
  const s = raw.trim()
  if (unit === 'force' && /^(?:zero|nil|none|nothing)$/i.test(s)) return rat(0)
  const m = /^(\d{1,3}(?:,\d{3})+|\d{1,7})?(?:\.(\d{1,3}))?\s*([^\d.,][\s\S]*)?$/.exec(s)
  if (!m || (m[1] === undefined && m[2] === undefined)) return null
  const whole = (m[1] ?? '0').replace(/,/g, '')
  const frac = m[2] ?? ''
  const tail = (m[3] ?? '').trim()
  if (tail && !UNIT_WORDS[unit].test(tail)) return null
  return rat(Number(whole + frac), 10 ** frac.length)
}

/** Tenths of a unit, written as a person would: 25 -> "2.5", 30 -> "3". */
export const fmtTenths = (t: number): string => (t % 10 === 0 ? `${t / 10}` : `${Math.floor(t / 10)}.${t % 10}`)
/** An exact decimal of at most three places, written plainly: 588/10 -> "58.8", 121/8 -> "15.125". */
export function fmtRat(r: Rat): string {
  if (r.d === 1) return `${r.n}`
  const t = (r.n * 1000) / r.d
  if (!Number.isInteger(t)) return `${r.n}/${r.d}`
  const frac = String(t % 1000).padStart(3, '0').replace(/0+$/, '')
  return frac ? `${Math.floor(t / 1000)}.${frac}` : `${t / 1000}`
}

// ---------------------------------------------------------------------------
// Directions.

export const WAYS = ['left', 'right', 'up', 'down'] as const
export type Way = (typeof WAYS)[number]
export type Axis = 'horizontal' | 'vertical'
export type Sign = 1 | -1
export const axisOf = (w: Way): Axis => (w === 'left' || w === 'right' ? 'horizontal' : 'vertical')
/** Right and up are positive. */
export const signOf = (w: Way): Sign => (w === 'right' || w === 'up' ? 1 : -1)
export const wayOf = (axis: Axis, sign: Sign): Way => (axis === 'horizontal' ? (sign === 1 ? 'right' : 'left') : sign === 1 ? 'up' : 'down')
export const wayPhrase = (w: Way): string => (w === 'left' ? 'to the left' : w === 'right' ? 'to the right' : w === 'up' ? 'upwards' : 'downwards')
export type Motion = 'rest' | Way
export const motionText = (m: Motion): string => (m === 'rest' ? 'at rest' : `moving ${wayPhrase(m)}`)

// ---------------------------------------------------------------------------
// The objects: what is drawn, which forces it can have, and the sizes that suit it.

export const OBJECTS = ['box', 'car', 'boat', 'skydiver'] as const
export type ObjectId = (typeof OBJECTS)[number]

/** `with`: points the way the object goes (or would go); `against`: the opposite. */
export type Slot = { name: string; side: 'with' | 'against'; lo?: number; hi?: number }

export type SceneDef = {
  id: ObjectId
  axis: Axis
  article: string
  /** How a sentence names it. */
  noun: string
  /** The ways it may start: a car at rest has no air resistance, a skydiver is falling. */
  motions: readonly Motion[]
  /** How many forces a card may hold (the first n slots are used). */
  counts: readonly number[]
  slots: readonly Slot[]
  /** Newtons in one step of arrow length, pixels a step is drawn, and the steps a force may have. */
  unit: number
  px: number
  lo: number
  hi: number
  /** The slot the learner sets in a "make" card. */
  adjust: number
  /** f-ma: masses (kg) that suit it, accelerations (tenths of m/s2), masses for weight. */
  masses: readonly number[]
  accels: readonly number[]
  weights: readonly number[]
}

export const SCENES: Record<ObjectId, SceneDef> = {
  // A box on a rough floor: pushes either way, and friction. Static friction at rest can only match the push.
  box: {
    id: 'box', axis: 'horizontal', article: 'a', noun: 'box',
    motions: ['rest', 'left', 'right'], counts: [2, 3, 4],
    slots: [{ name: 'Push', side: 'with' }, { name: 'Friction', side: 'against' }, { name: 'Rope pull', side: 'with' }, { name: 'Push back', side: 'against' }],
    unit: 5, px: 10, lo: 3, hi: 11, adjust: 0,
    masses: [2, 4, 5, 8, 10, 15, 20, 25, 30, 40, 50], accels: [5, 10, 15, 20, 25, 30, 40, 50], weights: [2, 3, 5, 6, 8, 10, 12, 15, 20, 25],
  },
  car: {
    id: 'car', axis: 'horizontal', article: 'a', noun: 'car',
    motions: ['left', 'right'], counts: [2, 3],
    slots: [{ name: 'Driving force', side: 'with' }, { name: 'Air resistance', side: 'against' }, { name: 'Friction', side: 'against' }],
    unit: 200, px: 9, lo: 3, hi: 12, adjust: 0,
    masses: [800, 900, 1000, 1200, 1500, 1600, 2000], accels: [5, 10, 15, 20, 25, 30], weights: [800, 900, 1000, 1200, 1500, 1600, 2000],
  },
  boat: {
    id: 'boat', axis: 'horizontal', article: 'a', noun: 'boat',
    motions: ['left', 'right'], counts: [2, 3],
    slots: [{ name: 'Engine thrust', side: 'with' }, { name: 'Water resistance', side: 'against' }, { name: 'Wind on sail', side: 'with' }],
    unit: 100, px: 9, lo: 4, hi: 12, adjust: 0,
    masses: [200, 300, 400, 500, 800, 1000, 1500, 2000], accels: [2, 3, 4, 5, 6, 8, 10, 15, 20], weights: [200, 300, 400, 500, 800, 1000, 1500, 2000],
  },
  // Falling: weight down, air resistance up. Always moving down (no resistance at the instant of the jump).
  skydiver: {
    id: 'skydiver', axis: 'vertical', article: 'a', noun: 'skydiver',
    motions: ['down'], counts: [2],
    slots: [{ name: 'Weight', side: 'with', lo: 6, hi: 9 }, { name: 'Air resistance', side: 'against', lo: 4, hi: 16 }],
    unit: 100, px: 6, lo: 4, hi: 16, adjust: 1,
    masses: [60, 65, 70, 75, 80, 85, 90], accels: [20, 30, 40, 50, 60, 80], weights: [60, 65, 70, 75, 80, 85, 90],
  },
}

const rangeOf = (scene: SceneDef, slot: Slot): [number, number] => [slot.lo ?? scene.lo, slot.hi ?? scene.hi]
export const forceCount = (scene: SceneDef): string => listOr(scene.counts.map(String))

// ---------------------------------------------------------------------------
// Tasks.

export const RESULTS = ['balanced', 'speeds up', 'slows down'] as const
export type Result = (typeof RESULTS)[number]
export type Change = 'same' | 'faster' | 'slower'
const CHANGE_OF: Record<Result, Change> = { balanced: 'same', 'speeds up': 'faster', 'slows down': 'slower' }
export const FINDS = ['acceleration', 'force', 'mass', 'weight'] as const
export type Find = (typeof FINDS)[number]

/** Either balanced forces, or a resultant of `n` newtons one way. */
export type Target = { balanced: true } | { balanced: false; n: number; way: Way }

type Common = { object?: ObjectId; variant?: number; unread?: string[] }
export type ResultantTask = Common & { kind: 'resultant'; motion?: Motion; result?: Result; forces?: number }
export type MakeTask = Common & { kind: 'make'; motion?: Motion; target?: Target | null; forces?: number }
export type FmaTask = Common & { kind: 'f-ma'; find?: Find; g?: number }
export type ForcesConfig = { task: ResultantTask | MakeTask | FmaTask }

/**
 * resultant: `size` (typed), `way` ('left', 'none', 'right', or 'up', 'none', 'down') and `change` ('same', 'faster' or
 * 'slower'). make: `steps`, the length of the force the learner sets, in steps. f-ma: `answer` (typed).
 */
export type ForcesState = { size?: string; way?: string; change?: string; steps?: number; answer?: string }

export const MAX_RESULTANT_STEPS = 4
export const DEFAULT_FORCES = 2

// ---------------------------------------------------------------------------
// Dealing the forces: every tuple of steps that gives the wanted resultant, kept once and picked by hash.

export type Force = { id: number; name: string; steps: number; n: number; sign: Sign; way: Way; side: 'with' | 'against' }
export type Scenario = {
  scene: SceneDef
  motion: Motion
  /** The sign of "the way it goes": the motion's, or for an object at rest the way the resultant (or the push) points. */
  dsign: Sign
  forces: Force[]
}

function eachTuple(ranges: [number, number][], fn: (k: number[]) => void): void {
  const k: number[] = new Array(ranges.length).fill(0)
  const go = (i: number) => {
    if (i === ranges.length) return fn(k)
    for (let v = ranges[i][0]; v <= ranges[i][1]; v++) {
      k[i] = v
      go(i + 1)
    }
  }
  go(0)
}

const POOLS = new Map<string, number[][]>()
const MAKE_POOLS = new Map<string, { fixed: number[]; solution: number }[]>()

/** Every steps-tuple for the first `count` slots whose net, along "the way it goes", lies in [from, to]. */
function netPool(scene: SceneDef, count: number, from: number, to: number): number[][] {
  const key = `net|${scene.id}|${count}|${from}|${to}`
  const hit = POOLS.get(key)
  if (hit) return hit
  const slots = scene.slots.slice(0, count)
  const w = slots.map((s) => (s.side === 'with' ? 1 : -1))
  const out: number[][] = []
  eachTuple(slots.map((s) => rangeOf(scene, s)), (k) => {
    const net = k.reduce((a, v, i) => a + w[i] * v, 0)
    if (net >= from && net <= to) out.push(k.slice())
  })
  POOLS.set(key, out)
  return out
}

/** For "make": every set of fixed steps (the adjustable slot left at 0) and the adjustable value that gives a net of `net`. */
function makePool(scene: SceneDef, count: number, net: number): { fixed: number[]; solution: number }[] {
  const key = `${scene.id}|${count}|${net}`
  const hit = MAKE_POOLS.get(key)
  if (hit) return hit
  const slots = scene.slots.slice(0, count)
  const w = slots.map((s) => (s.side === 'with' ? 1 : -1))
  const a = scene.adjust
  const [alo, ahi] = rangeOf(scene, slots[a])
  const out: { fixed: number[]; solution: number }[] = []
  eachTuple(slots.map((s, i) => (i === a ? [0, 0] : rangeOf(scene, s))) as [number, number][], (k) => {
    const fixedNet = k.reduce((acc, v, i) => acc + w[i] * v, 0)
    // net = fixedNet + w[a] * solution, and w[a] is +1 or -1.
    const solution = w[a] * (net - fixedNet)
    if (solution >= alo && solution <= ahi) out.push({ fixed: k.slice(), solution })
  })
  MAKE_POOLS.set(key, out)
  return out
}

function forcesOf(scene: SceneDef, steps: readonly number[], dsign: Sign): Force[] {
  return steps.map((k, i) => {
    const slot = scene.slots[i]
    const sign: Sign = slot.side === 'with' ? dsign : (-dsign as Sign)
    return { id: i, name: slot.name, steps: k, n: k * scene.unit, sign, way: wayOf(scene.axis, sign), side: slot.side }
  })
}

const sceneOf = (o: unknown): SceneDef | null => (typeof o === 'string' && own(SCENES, o) ? SCENES[o as ObjectId] : null)
const countOf = (scene: SceneDef, n: number | undefined): number | null => {
  const c = n ?? DEFAULT_FORCES
  return scene.counts.includes(c) ? c : null
}
const variantOf = (t: Common): number => (Number.isInteger(t.variant) && (t.variant as number) >= 0 ? (t.variant as number) : 0)

// ---------------------------------------------------------------------------
// resultant: the scenario and its truth.

/** The motion a task names; a scene with one way to start (the falling skydiver) needs none named. */
const motionOf = (scene: SceneDef, motion: Motion | undefined): Motion | undefined => motion ?? (scene.motions.length === 1 ? scene.motions[0] : undefined)

export function resultantScenario(task: ResultantTask): Scenario | null {
  const scene = sceneOf(task.object)
  const motion = scene ? motionOf(scene, task.motion) : undefined
  if (!scene || !task.result || !motion || !scene.motions.includes(motion)) return null
  const count = countOf(scene, task.forces)
  if (count === null) return null
  const change = CHANGE_OF[task.result]
  if (!change || (motion === 'rest' && change === 'slower')) return null
  const [from, to] = change === 'same' ? [0, 0] : change === 'faster' ? [1, MAX_RESULTANT_STEPS] : [-MAX_RESULTANT_STEPS, -1]
  const pool = netPool(scene, count, from, to)
  if (!pool.length) return null
  const key = `r|${scene.id}|${motion}|${task.result}|${count}|${variantOf(task)}`
  const steps = pick(pool, key)
  // At rest the way "it goes" is the way the resultant points; the engine picks a side. (Only horizontal objects start at rest.)
  const dsign: Sign = motion === 'rest' ? ((hashOf(`d|${key}`) & 1 ? 1 : -1) as Sign) : signOf(motion)
  return { scene, motion, dsign, forces: forcesOf(scene, steps, dsign) }
}

export type Truth = {
  /** Signed newtons, positive to the right or up. */
  net: number
  size: number
  way: Way | 'none'
  change: Change
}

/** The resultant found the plain way: add the signed newtons. */
export function truthOf(s: Scenario): Truth {
  const net = s.forces.reduce((a, f) => a + f.sign * f.n, 0)
  const sign: Sign = net > 0 ? 1 : -1
  const change: Change = net === 0 ? 'same' : s.motion === 'rest' ? 'faster' : sign === signOf(s.motion) ? 'faster' : 'slower'
  return { net, size: Math.abs(net), way: net === 0 ? 'none' : wayOf(s.scene.axis, sign), change }
}

const readText = (raw: unknown, key: string): string => {
  const v = raw && typeof raw === 'object' ? (raw as Record<string, unknown>)[key] : undefined
  return typeof v === 'string' ? v.slice(0, 24) : ''
}
export const readWay = (raw: unknown, axis: Axis): Way | 'none' | '' => {
  const v = readText(raw, 'way')
  return v === 'none' || (axis === 'horizontal' ? v === 'left' || v === 'right' : v === 'up' || v === 'down') ? (v as Way | 'none') : ''
}
export const readChange = (raw: unknown): Change | '' => {
  const v = readText(raw, 'change')
  return v === 'same' || v === 'faster' || v === 'slower' ? v : ''
}
export const readSize = (raw: unknown): string => readText(raw, 'size')
export const readAnswer = (raw: unknown): string => readText(raw, 'answer')

export type ResultantVerdict = { ok: boolean; sizeOk: boolean; wayOk: boolean; changeOk: boolean }

export function resultantVerdict(task: ResultantTask, state: unknown): ResultantVerdict {
  const s = resultantScenario(task)
  if (!s) return { ok: false, sizeOk: false, wayOk: false, changeOk: false }
  const t = truthOf(s)
  const typed = readNumber(readSize(state), 'force')
  const sizeOk = typed !== null && eqRat(typed, rat(t.size))
  const wayOk = readWay(state, s.scene.axis) === t.way
  const changeOk = readChange(state) === t.change
  return { ok: sizeOk && wayOk && changeOk, sizeOk, wayOk, changeOk }
}

export const CHANGE_NAMES: Record<Change, string> = { same: 'Stays at rest or keeps a steady speed', faster: 'Speeds up', slower: 'Slows down' }
export const CHANGES: Change[] = ['same', 'faster', 'slower']

export function waysFor(axis: Axis): { id: Way | 'none'; label: string }[] {
  return axis === 'horizontal'
    ? [{ id: 'left', label: 'Left' }, { id: 'none', label: 'No direction' }, { id: 'right', label: 'Right' }]
    : [{ id: 'up', label: 'Up' }, { id: 'none', label: 'No direction' }, { id: 'down', label: 'Down' }]
}

const N = (n: number) => `${n} N`

/** The sum of the forces on one side, as it is worked: "40 N + 20 N = 60 N", or just "40 N". */
function sumText(fs: readonly Force[]): string {
  const total = fs.reduce((a, f) => a + f.n, 0)
  return fs.length === 1 ? N(total) : `${fs.map((f) => N(f.n)).join(' + ')} = ${N(total)}`
}

/** "Forces to the right: 40 N + 20 N = 60 N. Forces to the left: 25 N. ..." -- the working of any set of forces. */
export function workingOf(forces: readonly Force[], axis: Axis): string {
  const pos = forces.filter((f) => f.sign === 1)
  const neg = forces.filter((f) => f.sign === -1)
  const posWay = wayOf(axis, 1)
  const negWay = wayOf(axis, -1)
  const net = forces.reduce((a, f) => a + f.sign * f.n, 0)
  const sumP = pos.reduce((a, f) => a + f.n, 0)
  const sumN = neg.reduce((a, f) => a + f.n, 0)
  const parts: string[] = []
  if (pos.length) parts.push(`Forces ${wayPhrase(posWay)}: ${sumText(pos)}.`)
  if (neg.length) parts.push(`Forces ${wayPhrase(negWay)}: ${sumText(neg)}.`)
  const big = Math.max(sumP, sumN)
  const small = Math.min(sumP, sumN)
  parts.push(net === 0 ? `The resultant is the difference: ${N(big)} − ${N(small)} = 0 N.` : `The resultant is the difference: ${N(big)} − ${N(small)} = ${N(Math.abs(net))} ${wayPhrase(wayOf(axis, net > 0 ? 1 : -1))}.`)
  return parts.join(' ')
}

function motionLine(s: Scenario, t: Truth): string {
  const noun = s.scene.noun
  if (t.change === 'same') {
    return s.motion === 'rest'
      ? `The forces are balanced, so there is no resultant force and the ${noun} stays at rest.`
      : `The forces are balanced, so there is no resultant force and the ${noun} keeps moving at a steady speed in a straight line. A moving object does not need a resultant force to keep moving.`
  }
  const way = t.way as Way
  if (s.motion === 'rest') return `The forces are unbalanced, so the ${noun} starts to move ${wayPhrase(way)} and speeds up.`
  return t.change === 'faster'
    ? `The resultant acts the way the ${noun} is moving, so it speeds up.`
    : `The resultant acts against the way the ${noun} is moving, so it slows down.`
}

const youSaidSize = (state: unknown): string => {
  const typed = readNumber(readSize(state), 'force')
  return typed ? `${fmtRat(typed)} N` : ''
}
const changeWords = (c: Change, rest: boolean): string => (c === 'same' ? (rest ? 'stays at rest' : 'keeps a steady speed') : c === 'faster' ? 'speeds up' : 'slows down')

export function resultantSaid(task: ResultantTask, state: unknown, marked: 'right' | 'wrong' | 'shown'): string[] {
  const s = resultantScenario(task)
  if (!s) return []
  const t = truthOf(s)
  const answer = t.way === 'none' ? 'The resultant force is 0 N: there is no resultant force.' : `The resultant force is ${N(t.size)} ${wayPhrase(t.way)}.`
  const lines = [answer, workingOf(s.forces, s.scene.axis), motionLine(s, t)]
  if (marked !== 'wrong') return lines
  const v = resultantVerdict(task, state)
  const typed = youSaidSize(state)
  const way = readWay(state, s.scene.axis)
  const change = readChange(state)
  if (!typed && !way && !change) return ['Give the size of the resultant, its direction, and what it does to the motion, then check.']
  if (!typed || !way || !change) {
    const missing = [!typed && 'its size', !way && 'its direction', !change && 'what happens to the motion'].filter(Boolean) as string[]
    return [`Still to give: ${missing.length < 2 ? missing.join('') : `${missing.slice(0, -1).join(', ')} and ${missing[missing.length - 1]}`}. Then check.`]
  }
  const mine = way === 'none' ? `a resultant of ${typed} with no direction` : `a resultant of ${typed} ${wayPhrase(way)}`
  const head = `You said ${mine}, and that the ${s.scene.noun} ${changeWords(change, s.motion === 'rest')}.`
  const notes: string[] = []
  if (!v.sizeOk && v.wayOk) notes.push('The direction is right, but the size is not: subtract the smaller total from the larger.')
  else if (v.sizeOk && !v.wayOk) notes.push('The size is right, but the direction is not: the resultant points the way the bigger total points.')
  if (v.sizeOk && v.wayOk && !v.changeOk) notes.push('The resultant is right, but the motion is not: a resultant along the motion speeds it up, against it slows it down, and none keeps the motion the same.')
  if (t.way === 'none' && way !== 'none' && readNumber(readSize(state), 'force') && eqRat(readNumber(readSize(state), 'force') as Rat, rat(0))) notes.push('A resultant of 0 N has no direction.')
  return [head, ...notes, ...lines]
}

// ---------------------------------------------------------------------------
// make.

export type MakeScenario = Scenario & {
  /** The index of the force the learner sets. */
  adjust: number
  /** Steps that meet the aim, and where it starts. `forces` holds the learner's force at its start. */
  solution: number
  start: number
  /** The aim, in signed newtons (positive right or up). */
  aim: number
  count: number
}

export function makeScenario(task: MakeTask): MakeScenario | null {
  const scene = sceneOf(task.object)
  if (!scene || !task.target) return null
  const count = countOf(scene, task.forces)
  if (count === null) return null
  const motion: Motion = motionOf(scene, task.motion) ?? pick(scene.motions, `m|${scene.id}|${variantOf(task)}`)
  if (!scene.motions.includes(motion)) return null
  const target = task.target
  let aimSteps = 0
  if (!target.balanced) {
    if (axisOf(target.way) !== scene.axis || !Number.isInteger(target.n) || target.n <= 0 || target.n % scene.unit !== 0) return null
    aimSteps = signOf(target.way) * (target.n / scene.unit)
  }
  // The way it goes: the motion's; at rest, the way the resultant points (or a hash's way when balanced).
  const dsign: Sign = motion !== 'rest' ? signOf(motion) : aimSteps !== 0 ? (Math.sign(aimSteps) as Sign) : ((hashOf(`d|${scene.id}|${variantOf(task)}`) & 1 ? 1 : -1) as Sign)
  const net = aimSteps * dsign
  if (motion === 'rest' && net < 0) return null
  const pool = makePool(scene, count, net)
  if (!pool.length) return null
  const key = `k|${scene.id}|${motion}|${target.balanced ? 'b' : `${target.n}${target.way}`}|${count}|${variantOf(task)}`
  const chosen = pick(pool, key)
  const [alo, ahi] = rangeOf(scene, scene.slots[scene.adjust])
  const starts: number[] = []
  for (let v = alo; v <= ahi; v++) if (Math.abs(v - chosen.solution) >= 2) starts.push(v)
  const start = pick(starts, `s|${key}`)
  // The forces are held with the learner's force at its start, never at the answer.
  const steps = chosen.fixed.slice()
  steps[scene.adjust] = start
  return { scene, motion, dsign, forces: forcesOf(scene, steps, dsign), adjust: scene.adjust, solution: chosen.solution, start, aim: aimSteps * scene.unit, count }
}

/** The forces of a make card with the learner's force set to `steps` (clamped to what it may be). */
export function makeForces(m: MakeScenario, steps: number): Force[] {
  const [lo, hi] = rangeOf(m.scene, m.scene.slots[m.adjust])
  const k = Math.max(lo, Math.min(hi, steps))
  return m.forces.map((f, i) => (i === m.adjust ? { ...f, steps: k, n: k * m.scene.unit } : f))
}
export const makeRange = (m: MakeScenario): [number, number] => rangeOf(m.scene, m.scene.slots[m.adjust])

/** The steps a state holds, read safely: a whole number in range, else where the force starts. */
export function readSteps(m: MakeScenario, raw: unknown): number {
  const v = raw && typeof raw === 'object' ? (raw as { steps?: unknown }).steps : undefined
  const [lo, hi] = makeRange(m)
  return typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi ? v : m.start
}

export function makeNet(m: MakeScenario, steps: number): number {
  return makeForces(m, steps).reduce((a, f) => a + f.sign * f.n, 0)
}

export function makeVerdict(task: MakeTask, state: unknown): { ok: boolean; net: number | null } {
  const m = makeScenario(task)
  if (!m) return { ok: false, net: null }
  const net = makeNet(m, readSteps(m, state))
  return { ok: net === m.aim, net }
}

export const aimText = (t: Target): string => (t.balanced ? 'balanced forces: a resultant of 0 N' : `a resultant of ${N(t.n)} ${wayPhrase(t.way)}`)

/** How far a key moves the end of an arrow: the end goes the way the key points, so it grows or shrinks by what that does to the arrow. */
export function stepForKey(key: string, outward: Sign, axis: Axis): number | null {
  const along: Record<string, number> = axis === 'horizontal' ? { ArrowRight: 1, ArrowLeft: -1 } : { ArrowUp: 1, ArrowDown: -1 }
  if (own(along, key)) return along[key] * outward
  if (key === '+' || key === '=') return 1
  if (key === '-' || key === '_') return -1
  if (key === 'PageUp') return 5
  if (key === 'PageDown') return -5
  return null
}

export function makeSaid(task: MakeTask, state: unknown, marked: 'right' | 'wrong' | 'shown'): string[] {
  const m = makeScenario(task)
  if (!m || !task.target) return []
  const adj = m.forces[m.adjust]
  const name = adj.name.toLowerCase()
  const right = makeForces(m, m.solution)
  const rightNet = right.reduce((a, f) => a + f.sign * f.n, 0)
  const rightLine = rightNet === 0
    ? `With the ${name} at ${N(m.solution * m.scene.unit)} the resultant is 0 N: the forces are balanced.`
    : `With the ${name} at ${N(m.solution * m.scene.unit)} the resultant is ${N(Math.abs(rightNet))} ${wayPhrase(wayOf(m.scene.axis, rightNet > 0 ? 1 : -1))}.`
  const tail = [workingOf(right, m.scene.axis)]
  const law = rightNet === 0
    ? m.motion === 'rest' ? `There is no resultant force, so the ${m.scene.noun} stays at rest.` : `There is no resultant force, so the ${m.scene.noun} keeps moving at a steady speed.`
    : ''
  if (marked !== 'wrong') return [rightLine, ...tail, ...(law ? [law] : [])]
  const steps = readSteps(m, state)
  const mine = makeForces(m, steps)
  const net = mine.reduce((a, f) => a + f.sign * f.n, 0)
  const got = net === 0 ? 'a resultant of 0 N: the forces are balanced' : `a resultant of ${N(Math.abs(net))} ${wayPhrase(wayOf(m.scene.axis, net > 0 ? 1 : -1))}`
  return [
    `You set the ${name} to ${N(steps * m.scene.unit)}, which makes ${got}.`,
    `The aim was ${aimText(task.target)}.`,
    rightLine,
    ...tail,
  ]
}

// ---------------------------------------------------------------------------
// f-ma.

export type FmaCase = {
  scene: SceneDef
  find: Find
  /** Mass (kg), acceleration (tenths of m/s2), resultant force (N), g (tenths of N/kg). Weight cards hold no force or acceleration. */
  m: number
  aT: number | null
  F: number | null
  gT: number | null
  /** The answer, exactly, and its unit. */
  answer: Rat
  unit: Unit
  /** The way the force and the acceleration point. */
  way: Way
}

export const G_CHOICES = [9.8, 10] as const
/** g in tenths of N/kg: only 9.8 (the 0625 value) and 10 are used; anything else is NaN. */
export const gTenths = (g: number | undefined): number => (g === undefined || g === 9.8 ? 98 : g === 10 ? 100 : NaN)

const FMA_POOLS = new Map<string, { m: number; aT: number }[]>()
function fmaPool(scene: SceneDef): { m: number; aT: number }[] {
  const hit = FMA_POOLS.get(scene.id)
  if (hit) return hit
  const out: { m: number; aT: number }[] = []
  for (const m of scene.masses) for (const aT of scene.accels) if ((m * aT) % 10 === 0 && (m * aT) / 10 >= 1) out.push({ m, aT })
  FMA_POOLS.set(scene.id, out)
  return out
}

export function fmaCase(task: FmaTask): FmaCase | null {
  if (!task.find || !FINDS.includes(task.find)) return null
  const scene = sceneOf(task.object ?? pick(OBJECTS, `o|${task.find}|${variantOf(task)}|${task.g ?? ''}`))
  if (!scene) return null
  const gT = gTenths(task.g)
  if (gT !== 98 && gT !== 100) return null
  const key = `f|${scene.id}|${task.find}|${gT}|${variantOf(task)}`
  const way: Way = scene.axis === 'vertical' ? 'down' : (hashOf(`w|${key}`) & 1 ? 'right' : 'left')
  if (task.find === 'weight') {
    const m = pick(scene.weights, key)
    return { scene, find: 'weight', m, aT: null, F: null, gT, answer: rat(m * gT, 10), unit: 'force', way: 'down' }
  }
  const { m, aT } = pick(fmaPool(scene), key)
  const F = (m * aT) / 10
  const answer = task.find === 'acceleration' ? rat(aT, 10) : task.find === 'force' ? rat(F) : rat(m)
  return { scene, find: task.find, m, aT, F, gT: null, answer, unit: task.find === 'acceleration' ? 'accel' : task.find === 'mass' ? 'mass' : 'force', way }
}

export const FIND_LABEL: Record<Find, string> = { acceleration: 'Acceleration', force: 'Resultant force', mass: 'Mass', weight: 'Weight' }
export const UNIT_LABEL: Record<Unit, string> = { force: 'N', accel: 'm/s²', mass: 'kg' }
export const UNIT_SPOKEN: Record<Unit, string> = { force: 'newtons', accel: 'metres per second squared', mass: 'kilograms' }

/** What the card gives, as chips; the quantity asked for is never among them. */
export function fmaGivens(c: FmaCase): string[] {
  const out: string[] = []
  if (c.find !== 'mass') out.push(`Mass: ${c.m} kg`)
  if (c.find === 'weight') out.push(`g = ${fmtTenths(c.gT as number)} N/kg`)
  if (c.find === 'acceleration' || c.find === 'mass') out.push(`Resultant force: ${c.F} N`)
  if (c.find === 'force' || c.find === 'mass') out.push(`Acceleration: ${fmtTenths(c.aT as number)} m/s² ${wayPhrase(c.way)}`)
  return out
}

export function fmaVerdict(task: FmaTask, state: unknown): { ok: boolean; typed: Rat | null } {
  const c = fmaCase(task)
  if (!c) return { ok: false, typed: null }
  const typed = readNumber(readAnswer(state), c.unit)
  return { ok: typed !== null && eqRat(typed, c.answer), typed }
}

/** The working, in the numbers of the card. */
export function fmaWorking(c: FmaCase): string {
  const a = c.aT !== null ? fmtTenths(c.aT) : ''
  switch (c.find) {
    case 'acceleration': return `a = F ÷ m = ${c.F} N ÷ ${c.m} kg = ${fmtRat(c.answer)} m/s²`
    case 'force': return `F = m × a = ${c.m} kg × ${a} m/s² = ${fmtRat(c.answer)} N`
    case 'mass': return `m = F ÷ a = ${c.F} N ÷ ${a} m/s² = ${fmtRat(c.answer)} kg`
    case 'weight': return `W = m × g = ${c.m} kg × ${fmtTenths(c.gT as number)} N/kg = ${fmtRat(c.answer)} N`
  }
}

/** Answers a learner is tempted by, each with the sentence that says what it is. */
function slips(c: FmaCase): { value: Rat; text: string }[] {
  const F = c.F ?? 0
  const aN = c.aT ?? 0
  switch (c.find) {
    case 'acceleration': return [
      { value: rat(F * c.m), text: 'That is force × mass. Acceleration is force ÷ mass.' },
      { value: rat(c.m, F), text: 'That is mass ÷ force, the wrong way up. Acceleration is force ÷ mass.' },
    ]
    case 'force': return [
      { value: rat(c.m * 10, aN), text: 'That is mass ÷ acceleration. Force is mass × acceleration.' },
    ]
    case 'mass': return [
      { value: rat(F * aN, 10), text: 'That is force × acceleration. Mass is force ÷ acceleration.' },
      { value: rat(aN, 10 * F), text: 'That is acceleration ÷ force, the wrong way up. Mass is force ÷ acceleration.' },
    ]
    case 'weight': return [
      { value: rat(c.m), text: 'That is the mass, in kilograms. Weight is a force in newtons: multiply the mass by g.' },
      { value: rat(c.m * 10, c.gT as number), text: 'That divides by g. Weight is mass × g.' },
    ]
  }
}

export function fmaSaid(task: FmaTask, state: unknown, marked: 'right' | 'wrong' | 'shown'): string[] {
  const c = fmaCase(task)
  if (!c) return []
  const answerText = `${fmtRat(c.answer)} ${UNIT_LABEL[c.unit]}`
  const lines = [`${FIND_LABEL[c.find]}: ${answerText}.`, `${fmaWorking(c)}.`]
  if (c.find === 'acceleration') lines.push(`The acceleration is in the direction of the resultant force, ${wayPhrase(c.way)}.`)
  if (c.find === 'weight') lines.push('Weight is a force, in newtons. Mass is how much matter there is, in kilograms, and is the same anywhere.')
  if (marked !== 'wrong') return lines
  const v = fmaVerdict(task, state)
  const raw = readAnswer(state).trim()
  if (!raw) return ['Type your answer, then check.']
  if (!v.typed) {
    return [`The answer "${raw.slice(0, 24)}" could not be read. Type a number${c.unit === 'force' ? ' of newtons' : c.unit === 'accel' ? ', then m/s² if you like' : ' of kilograms'}, with a decimal point if it needs one.`, ...lines]
  }
  const slip = slips(c).find((s) => eqRat(s.value, v.typed as Rat))
  return [`You gave ${fmtRat(v.typed)} ${UNIT_LABEL[c.unit]}.${slip ? ` ${slip.text}` : ''}`, ...lines]
}

// ---------------------------------------------------------------------------
// Reading what the tutor writes.

const KIND_WORDS: Record<string, 'resultant' | 'make' | 'f-ma'> = {
  'resultant': 'resultant', 'resultants': 'resultant', 'resultant-force': 'resultant', 'find-the-resultant': 'resultant', 'find-resultant': 'resultant',
  'net-force': 'resultant', 'predict-motion': 'resultant', 'resultant-and-motion': 'resultant',
  'make': 'make', 'balance': 'make', 'balance-the-forces': 'make', 'make-balanced': 'make', 'build': 'make', 'adjust': 'make',
  'set-the-force': 'make', 'set-force': 'make', 'make-resultant': 'make', 'make-the-resultant': 'make',
  'f-ma': 'f-ma', 'fma': 'f-ma', 'f-m-a': 'f-ma', 'force-mass-acceleration': 'f-ma', 'second-law': 'f-ma', 'newtons-second-law': 'f-ma',
  'newton-s-second-law': 'f-ma', 'calculate': 'f-ma', 'calculation': 'f-ma', 'f-equals-ma': 'f-ma',
}
const OBJECT_WORDS: Record<string, ObjectId> = {
  'box': 'box', 'boxes': 'box', 'crate': 'box', 'block': 'box', 'wooden-box': 'box',
  'car': 'car', 'cars': 'car', 'vehicle': 'car', 'car-on-a-road': 'car',
  'boat': 'boat', 'boats': 'boat', 'ship': 'boat', 'motor-boat': 'boat', 'motorboat': 'boat', 'speedboat': 'boat',
  'skydiver': 'skydiver', 'skydivers': 'skydiver', 'sky-diver': 'skydiver', 'parachutist': 'skydiver', 'parachute': 'skydiver', 'free-fall': 'skydiver',
}
const MOTION_WORDS: Record<string, Motion> = {
  'rest': 'rest', 'at-rest': 'rest', 'stationary': 'rest', 'still': 'rest', 'not-moving': 'rest', 'stopped': 'rest', 'stays-at-rest': 'rest', 'from-rest': 'rest', 'starting-from-rest': 'rest',
  'right': 'right', 'moving-right': 'right', 'to-the-right': 'right', 'rightwards': 'right', 'moving-to-the-right': 'right', 'east': 'right',
  'left': 'left', 'moving-left': 'left', 'to-the-left': 'left', 'leftwards': 'left', 'moving-to-the-left': 'left', 'west': 'left',
  'up': 'up', 'moving-up': 'up', 'upwards': 'up', 'rising': 'up', 'going-up': 'up', 'moving-upwards': 'up',
  'down': 'down', 'moving-down': 'down', 'downwards': 'down', 'falling': 'down', 'moving-downwards': 'down', 'going-down': 'down', 'descending': 'down',
}
const RESULT_WORDS: Record<string, Result> = {
  'balanced': 'balanced', 'zero': 'balanced', 'no-change': 'balanced', 'constant-speed': 'balanced', 'steady-speed': 'balanced', 'steady': 'balanced', 'same': 'balanced',
  'stays-the-same': 'balanced', 'equilibrium': 'balanced', 'no-resultant': 'balanced', 'terminal-velocity': 'balanced',
  'speeds-up': 'speeds up', 'speed-up': 'speeds up', 'faster': 'speeds up', 'accelerates': 'speeds up', 'accelerate': 'speeds up', 'accelerating': 'speeds up',
  'speeding-up': 'speeds up', 'unbalanced-speeds-up': 'speeds up', 'gets-faster': 'speeds up',
  'slows-down': 'slows down', 'slow-down': 'slows down', 'slower': 'slows down', 'decelerates': 'slows down', 'decelerate': 'slows down', 'decelerating': 'slows down',
  'slowing-down': 'slows down', 'slows': 'slows down', 'gets-slower': 'slows down',
}
const FIND_WORDS: Record<string, Find> = {
  'acceleration': 'acceleration', 'a': 'acceleration', 'accel': 'acceleration', 'find-acceleration': 'acceleration',
  'force': 'force', 'f': 'force', 'resultant-force': 'force', 'find-force': 'force', 'net-force': 'force',
  'mass': 'mass', 'm': 'mass', 'find-mass': 'mass',
  'weight': 'weight', 'w': 'weight', 'find-weight': 'weight',
}

const word = <T,>(table: Record<string, T>, raw: unknown): T | null => {
  if (typeof raw !== 'string') return null
  const k = slug(raw).replace(/^(?:the|a|an)-/, '')
  return own(table, k) ? table[k] : null
}

function readInt(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
  if (typeof raw !== 'string') return null
  const m = /^\s*(\d+(?:\.\d+)?)\s*(?:forces?|arrows?)?\s*$/i.exec(raw)
  return m ? Number(m[1]) : null
}

const DIRECTION = /(left|right|up|down)(?:wards?)?/i

/** "balanced", "0 N", "20 N to the right", { n: 20, way: "right" }: an aim for a make card; null when it cannot be read. */
export function readTarget(raw: unknown): Target | null {
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>
    const nRaw = first(o, ['n', 'size', 'newtons', 'force', 'value', 'resultant'])
    const wayRaw = first(o, ['way', 'direction', 'dir'])
    const n = readInt(nRaw)
    if (n === null) return typeof o.balanced === 'boolean' && o.balanced ? { balanced: true } : null
    if (n === 0) return { balanced: true }
    const way = typeof wayRaw === 'string' ? DIRECTION.exec(wayRaw) : null
    return way ? { balanced: false, n, way: way[1].toLowerCase() as Way } : null
  }
  if (typeof raw === 'number') return raw === 0 ? { balanced: true } : null
  if (typeof raw !== 'string') return null
  const s = raw.trim().toLowerCase()
  if (/^(?:balanced(?: forces)?|zero|0\s*n?|no resultant(?: force)?|equilibrium|equal and opposite)$/.test(s)) return { balanced: true }
  const m = /^(?:a resultant of\s+)?(\d+(?:\.\d+)?)\s*(?:n|newtons?)?\s*(?:acting\s+|pointing\s+|going\s+)?(?:to the\s+|towards the\s+|in the\s+)?(left|right|up|down)(?:wards?)?$/.exec(s)
  if (!m) return null
  return Number(m[1]) === 0 ? { balanced: true } : { balanced: false, n: Number(m[1]), way: m[2] as Way }
}

// ---------------------------------------------------------------------------
// What would teach nothing, or wrongly.

const quoted = (xs: readonly string[]) => xs.map((x) => `"${x}"`)

function sharedFaults(task: Common): string[] {
  const out = [...(task.unread ?? [])]
  if (task.variant !== undefined && (!Number.isInteger(task.variant) || task.variant < 0 || task.variant > 99)) {
    out.push(`"variant" ${task.variant} is not a whole number from 0 to 99: use e.g. 1, or leave it out.`)
  }
  return out
}

function objectFaults(task: Common, needs: boolean): string[] {
  if (task.object !== undefined || !needs) return []
  return [`Say what the forces act on: "object": ${listOr(quoted(OBJECTS))}.`]
}

function motionFaults(scene: SceneDef, motion: Motion | undefined): string[] {
  if (motion === undefined || scene.motions.includes(motion)) return []
  const ok = quoted(scene.motions.map((m) => (m === 'rest' ? 'at rest' : `moving ${m}`)))
  const why: Record<ObjectId, string> = {
    box: '',
    car: 'A car at rest has no air resistance or friction to draw; start it moving.',
    boat: 'A boat at rest has no water resistance to draw; start it moving.',
    skydiver: 'The skydiver card is a skydiver already falling, with weight and air resistance.',
  }
  return [`A ${scene.noun} cannot start "${motionText(motion)}" here. ${why[scene.id]} Use "motion": ${listOr(ok)}.`.replace('  ', ' ')]
}

function countFaults(scene: SceneDef, forces: number | undefined): string[] {
  if (forces === undefined || scene.counts.includes(forces)) return []
  const big = OBJECTS.filter((o) => SCENES[o].counts.includes(forces)).map((o) => SCENES[o].noun)
  return [`The ${scene.noun} card holds ${forceCount(scene)} forces, not ${shown(forces)}.${big.length ? ` ${forces} forces is for the ${listOr(big)}.` : ''} Use "forces": ${scene.counts[scene.counts.length - 1]}, or leave it out for ${DEFAULT_FORCES}.`]
}

function resultantFaults(task: ResultantTask): string[] {
  const out = [...sharedFaults(task), ...objectFaults(task, true)]
  const scene = sceneOf(task.object)
  if (task.motion === undefined && !(scene && scene.motions.length === 1)) out.push('Say how it starts: "motion": "at rest", "moving left" or "moving right".')
  if (task.result === undefined) out.push('Say what the forces do: "result": "balanced", "speeds up" or "slows down". The engine deals the forces; the learner is not told which.')
  if (!scene) return out
  out.push(...motionFaults(scene, task.motion), ...countFaults(scene, task.forces))
  if (task.motion === 'rest' && task.result === 'slows down') {
    out.push(`${scene.article === 'a' ? 'A' : 'An'} ${scene.noun} at rest cannot slow down. Use "result": "speeds up" (it starts to move) or "balanced" (it stays at rest), or start it moving ("motion": "moving right").`)
  }
  if (!out.length && !resultantScenario(task)) out.push('No forces can be dealt for that card: change the object, the motion or the result.')
  return out
}

/** A target that works for the card, for a message that names one. */
function exampleTarget(task: MakeTask): string {
  const scene = sceneOf(task.object)
  if (!scene) return '"balanced"'
  const motion: Motion = motionOf(scene, task.motion) ?? scene.motions[0]
  const way = wayOf(scene.axis, motion === 'rest' ? 1 : signOf(motion))
  for (let k = 1; k <= 6; k++) {
    if (makeScenario({ ...task, motion, target: { balanced: false, n: k * scene.unit, way } })) return `"${k * scene.unit} N ${wayPhrase(way)}"`
  }
  return '"balanced"'
}

function makeFaults(task: MakeTask): string[] {
  const out = [...sharedFaults(task), ...objectFaults(task, true)]
  const scene = sceneOf(task.object)
  if (task.target === undefined) out.push('Say the aim: "target": "balanced" (a resultant of 0 N), or e.g. "20 N to the right".')
  if (!scene) return out
  out.push(...motionFaults(scene, task.motion), ...countFaults(scene, task.forces))
  const t = task.target
  if (t && !t.balanced) {
    if (axisOf(t.way) !== scene.axis) {
      out.push(`The ${scene.noun} card works ${scene.axis === 'horizontal' ? 'left and right' : 'up and down'}, so a target ${t.way} is not one it can draw. Use e.g. ${exampleTarget(task)}.`)
    } else if (!Number.isInteger(t.n) || t.n <= 0 || t.n % scene.unit !== 0) {
      out.push(`${shown(t.n)} N is not a size the ${scene.noun} card can draw to scale: its arrows go in steps of ${scene.unit} N. Use e.g. ${exampleTarget(task)}.`)
    }
  }
  if (!out.length && !makeScenario(task)) {
    out.push(`No forces can be dealt that meet that aim${task.motion === 'rest' ? ' for an object at rest (it can only start to move the way the resultant points)' : ''}. Use e.g. ${exampleTarget(task)}, or "balanced".`)
  }
  return out
}

function fmaFaults(task: FmaTask): string[] {
  const out = [...sharedFaults(task)]
  if (task.find === undefined) out.push(`Say what to find: "find": ${listOr(quoted(FINDS))}.`)
  if (task.g !== undefined && gTenths(task.g) !== 98 && gTenths(task.g) !== 100) {
    out.push(`g = ${shown(task.g)} is not used: write 9.8 (the 0625 value) or 10, or leave it out for 9.8.`)
  } else if (task.g !== undefined && task.find !== 'weight') {
    out.push('"g" is only used when finding the weight: leave it out here.')
  }
  if (!out.length && !fmaCase(task)) out.push('No numbers can be dealt for that card: change what to find or the object.')
  return out
}

// ---------------------------------------------------------------------------
// The prompt a card is written with.

const sentences = (text: string) => text.split(/(?<=[.?!])\s+/).filter(Boolean)
const NOUNS: Record<ObjectId, RegExp> = {
  box: /\b(?:box|boxes|crate|block)\b/i,
  car: /\b(?:car|cars|vehicle)\b/i,
  boat: /\b(?:boat|boats|ship|speedboat)\b/i,
  skydiver: /\b(?:skydiver|skydivers|sky diver|parachutist)\b/i,
}

/** Numbers followed by a unit in the prompt: [value, unit, sentence]. */
function numbersIn(prompt: string): { value: number; unit: 'N' | 'kg' | 'accel' | 'g'; text: string; sentence: string }[] {
  const out: { value: number; unit: 'N' | 'kg' | 'accel' | 'g'; text: string; sentence: string }[] = []
  for (const sentence of sentences(prompt)) {
    for (const m of sentence.matchAll(/(\d+(?:\.\d+)?)\s*(N\/kg|newtons?|N|kg|m\/s(?:\^?2|²)|m s\^?-2)(?![A-Za-z/])/gi)) {
      const u = m[2]
      out.push({ value: Number(m[1]), unit: /^n\/kg$/i.test(u) ? 'g' : /^(?:n|newtons?)$/i.test(u) ? 'N' : /^kg$/i.test(u) ? 'kg' : 'accel', text: m[0], sentence })
    }
  }
  return out
}

function objectPromptFaults(scene: SceneDef, prompt: string): string[] {
  if (NOUNS[scene.id].test(prompt)) return []
  const other = OBJECTS.find((o) => o !== scene.id && NOUNS[o].test(prompt))
  return other ? [`the prompt is about ${SCENES[other].article} ${SCENES[other].noun}, but the card draws ${scene.article} ${scene.noun}: the prompt must fit the picture (or leave the object out).`] : []
}

function motionPromptFaults(motion: Motion, prompt: string): string[] {
  const said = /\b(?:moving|moves|travelling|traveling|going)\s+(?:to the\s+)?(left|right|up|down)(?:wards)?\b/i.exec(prompt)
  const rest = /\b(?:at rest|stationary|not moving|parked)\b/i.test(prompt)
  if (said && (motion === 'rest' || said[1].toLowerCase() !== motion)) return [`the prompt says "${said[0]}", but the card starts ${motionText(motion)}: leave the motion to the picture, or say it right.`]
  if (rest && motion !== 'rest') return [`the prompt says it is at rest, but the card starts ${motionText(motion)}: leave the motion to the picture, or say it right.`]
  return []
}

const OUTCOMES: { name: Change; re: RegExp }[] = [
  { name: 'faster', re: /\b(?:speeds?|speeding|gets? faster)(?:\s+up)?\b/i },
  { name: 'slower', re: /\b(?:slows?|slowing|gets? slower|decelerat\w+|brak(?:es|ing))(?:\s+down)?\b/i },
  { name: 'same', re: /\b(?:stays?|remains?|keeps?)\s+(?:at rest|moving|the same|still|a steady speed|a constant speed)\b|\b(?:steady|constant)\s+speed\b|\bno change\b/i },
]

function resultantPromptFaults(task: ResultantTask, prompt: string): string[] {
  const s = resultantScenario(task)
  if (!s) return []
  const t = truthOf(s)
  const out: string[] = []
  const bal = /\b(?:balanced|unbalanced|equilibrium|terminal velocity)\b/i.exec(prompt)
  if (bal) out.push(`the prompt uses the word "${bal[0]}", which names what the forces do and is the learner's to find: ask for the resultant and the motion, and leave it out (it is said once marked).`)
  else {
    const named = OUTCOMES.filter((o) => o.re.test(prompt))
    if (named.length > 0 && named.length < 3) {
      out.push('the prompt names what the motion does ("speeds up", "slows down" or "steady speed") without naming all three: that narrows the answer. Ask "what happens to its motion?", or list all three options.')
    }
  }
  for (const sent of sentences(prompt)) {
    if (!/\b(?:resultant|net force|overall force|total force)\b/i.test(sent)) continue
    const sayNum = [...sent.matchAll(/\d+(?:\.\d+)?/g)].find((m) => Number(m[0]) === t.size && !s.forces.some((f) => f.n === t.size))
    if (sayNum) out.push(`the prompt gives the resultant (${t.size} N): the learner works it out, so leave it out.`)
    const dir = /\b(?:to the )?(left|right|upwards?|downwards?|up|down)\b/i.exec(sent)
    if (dir && /\b(?:is|are|acts?|points?|towards?)\b/i.test(sent) && !/\?/.test(sent)) out.push(`the prompt gives the resultant's direction ("${sent.trim()}"): the learner reads it from the arrows, so ask for it and leave the answer out.`)
  }
  const method = /\b(?:subtract\w*|take away|minus|the difference|add (?:up )?the (?:forces|arrows))\b/i.exec(prompt)
  if (method) out.push(`the prompt gives the method ("${method[0]}"): the learner works out how to combine the forces (it is shown once marked).`)
  const given = new Set(s.forces.map((f) => f.n))
  for (const n of numbersIn(prompt)) {
    if (n.unit === 'N' && !given.has(n.value) && n.value !== t.size) {
      out.push(`the prompt says ${n.text}, but the card's forces are ${listOr(s.forces.map((f) => N(f.n)))} (the engine chooses them): leave the values to the picture.`)
      break
    }
  }
  return [...out, ...objectPromptFaults(s.scene, prompt), ...motionPromptFaults(s.motion, prompt)].slice(0, 3)
}

function makePromptFaults(task: MakeTask, prompt: string): string[] {
  const m = makeScenario(task)
  if (!m || !task.target) return []
  const out: string[] = []
  const solution = m.solution * m.scene.unit
  const fixed = m.forces.filter((_, i) => i !== m.adjust).map((f) => f.n)
  const allowed = new Set([...fixed, task.target.balanced ? 0 : task.target.n])
  const adjName = m.forces[m.adjust].name.toLowerCase()
  for (const n of numbersIn(prompt)) {
    if (n.unit !== 'N') continue
    // The learner's force may share its size with a fixed one (equal and opposite): a number set for it gives it away.
    const settingIt = n.value === solution && (n.sentence.toLowerCase().includes(adjName) || /\b(?:set|make|use|choose|drag|change|adjust|needs?|must be|should be)\b/i.test(n.sentence))
    if (settingIt) out.push(`the prompt gives the force to set (${n.text}): the learner works it out, so leave it out.`)
    else if (!allowed.has(n.value) && n.value !== solution) out.push(`the prompt says ${n.text}, but the card's fixed forces are ${listOr(fixed.map((x) => N(x)))} and its aim is ${aimText(task.target)} (the engine chooses the forces): leave the values to the picture.`)
    if (out.length) break
  }
  const method = /\b(?:equal (?:to|and opposite)|as (?:big|large|strong|hard) as|the same size as|same as the|matches? the|cancel\w*|subtract\w*|the difference)\b/i.exec(prompt)
  if (method) out.push(`the prompt gives the method ("${method[0]}"): the learner works out how big the force must be.`)
  return [...out, ...objectPromptFaults(m.scene, prompt), ...motionPromptFaults(m.motion, prompt)].slice(0, 3)
}

const METHODS: RegExp[] = [
  /\bF\s*=\s*m\s*[×x*·.]?\s*a\b/i,
  /\bF\s*=\s*ma\b/i,
  /\bforce\s*=\s*mass\b/i,
  /\ba\s*=\s*F\s*[÷/]\s*m\b/i,
  /\bm\s*=\s*F\s*[÷/]\s*a\b/i,
  /\bW\s*=\s*m\s*[×x*·.]?\s*g\b/i,
  /\bweight\s*=\s*mass\b/i,
  /\bnewton'?s\s+second\s+law\b/i,
  /\b(?:force|mass)\s+(?:times|multiplied by|divided by)\b/i,
  /\b(?:multiply|divide)\b[^.?!]{0,30}\b(?:mass|force|acceleration|g)\b/i,
]

function fmaPromptFaults(task: FmaTask, prompt: string): string[] {
  const c = fmaCase(task)
  if (!c) return []
  const out: string[] = []
  const method = METHODS.map((re) => re.exec(prompt)).find(Boolean)
  if (method) out.push(`the prompt gives the method ("${method[0].trim()}"): recalling the equation is the learner's job (it is shown once marked).`)
  const answerUnit = c.unit === 'accel' ? 'accel' : c.unit === 'mass' ? 'kg' : 'N'
  const mismatch = (u: typeof answerUnit | 'g', want: number | null, what: string) => {
    for (const n of numbersIn(prompt)) if (n.unit === u && want !== null && n.value !== want) return [`the prompt says ${n.text}, but the card's ${what} is different (the engine chooses the numbers): leave the values to the card.`]
    return []
  }
  const ans = Number(fmtRat(c.answer))
  for (const n of numbersIn(prompt)) {
    if (n.unit === answerUnit && n.value === ans) {
      out.push(`the prompt gives the answer (${n.text}): the learner works it out, so leave it out.`)
      break
    }
  }
  if (!out.length) {
    out.push(
      ...(c.find !== 'mass' ? mismatch('kg', c.m, 'mass') : []),
      ...(c.find === 'acceleration' || c.find === 'mass' ? mismatch('N', c.F, 'resultant force') : []),
      ...(c.find === 'force' || c.find === 'mass' ? mismatch('accel', (c.aT as number) / 10, 'acceleration') : []),
      ...(c.find === 'weight' ? mismatch('g', (c.gT as number) / 10, 'g') : []),
    )
  }
  return [...out, ...objectPromptFaults(c.scene, prompt)].slice(0, 3)
}

// ---------------------------------------------------------------------------

export const forcesEngine: SceneEngine<ForcesConfig, ForcesState> = {
  id: 'forces',
  // Topics as stations name them, each with a word that is its own: scenesFor wants every word of a topic in the station, so
  // "balanced forces" is never a balanced diet, nor "resultant force" the resultant of vectors in a maths station. Not the
  // bare "forces" (intermolecular forces, market forces), "weight" (body weight), "acceleration" (every motion graph) or
  // "friction". sceneCatalogue offers the entry on any one word, so "balanced" or "first" also offer it, and only offer it.
  covers: [
    'balanced and unbalanced forces', 'balanced forces', 'unbalanced forces', 'resultant force', 'force and acceleration',
    'forces and motion', 'mass and weight', 'gravitational field strength', "newton's first law", "newton's second law",
  ],
  // The learner finds, sets or calculates a size: the resultant, a force that meets an aim, an acceleration.
  isolates: 'magnitude',

  parse(raw) {
    const task = (raw as { task?: unknown } | null)?.task
    if (!task || typeof task !== 'object' || Array.isArray(task)) return null
    const t = task as Record<string, unknown>
    const kind = word(KIND_WORDS, t.kind)
    if (!kind) return null
    const unread: string[] = []

    const objectRaw = first(t, ['object', 'scene', 'thing', 'item', 'vehicle', 'on'])
    let object: ObjectId | undefined
    if (objectRaw !== undefined) {
      const o = word(OBJECT_WORDS, objectRaw)
      if (o) object = o
      else unread.push(`${shown(objectRaw)} is not an object the card can draw: use ${listOr(quoted(OBJECTS))}.`)
    }
    const variantRaw = first(t, ['variant', 'seed', 'version'])
    let variant: number | undefined
    if (variantRaw !== undefined) {
      const v = readInt(variantRaw)
      if (v === null) unread.push(`${shown(variantRaw)} is not a variant: use a whole number from 0 to 99, or leave it out.`)
      else variant = v
    }
    const base = { ...(object ? { object } : {}), ...(variant !== undefined ? { variant } : {}) }

    if (kind === 'f-ma') {
      const findRaw = first(t, ['find', 'ask', 'unknown', 'solve_for', 'solveFor', 'calculate', 'quantity', 'work_out', 'workOut'])
      let find: Find | undefined
      if (findRaw !== undefined) {
        const f = word(FIND_WORDS, findRaw)
        if (f) find = f
        else unread.push(`${shown(findRaw)} is not something to find: use ${listOr(quoted(FINDS))}.`)
      }
      const gRaw = first(t, ['g', 'gravity', 'gravitational_field_strength', 'gravitationalFieldStrength'])
      let g: number | undefined
      if (gRaw !== undefined) {
        const n = typeof gRaw === 'string' ? Number(gRaw.replace(/\s*n\/kg$/i, '')) : typeof gRaw === 'number' ? gRaw : NaN
        if (Number.isFinite(n)) g = n
        else unread.push(`${shown(gRaw)} is not a value of g: use 9.8 or 10.`)
      }
      const out: FmaTask = { kind, ...base, ...(find ? { find } : {}), ...(g !== undefined ? { g } : {}), ...(unread.length ? { unread } : {}) }
      return { task: out }
    }

    const motionRaw = first(t, ['motion', 'start', 'starts', 'starting_motion', 'startingMotion', 'moving', 'movement', 'starting'])
    let motion: Motion | undefined
    if (motionRaw !== undefined) {
      const m = word(MOTION_WORDS, motionRaw)
      if (m) motion = m
      else unread.push(`${shown(motionRaw)} is not a way to start: use "at rest", "moving left", "moving right" (or "moving down" for the skydiver).`)
    }
    const forcesRaw = first(t, ['forces', 'count', 'number_of_forces', 'numberOfForces', 'arrows'])
    let forces: number | undefined
    if (forcesRaw !== undefined) {
      const n = readInt(forcesRaw)
      if (n === null) unread.push(Array.isArray(forcesRaw)
        ? '"forces" is a count here (2 to 4): the engine chooses the values of the forces, so leave the list out.'
        : `${shown(forcesRaw)} is not a number of forces: use 2, 3 or 4.`)
      else forces = n
    }
    const withCommon = { ...base, ...(motion ? { motion } : {}), ...(forces !== undefined ? { forces } : {}) }

    if (kind === 'resultant') {
      const resultRaw = first(t, ['result', 'outcome', 'effect', 'what_happens', 'whatHappens', 'resultant', 'forces_are', 'motion_change'])
      let result: Result | undefined
      if (resultRaw !== undefined) {
        const r = word(RESULT_WORDS, resultRaw)
        if (r) result = r
        else unread.push(`${shown(resultRaw)} is not something the forces can do here: use "balanced", "speeds up" or "slows down".`)
      }
      const out: ResultantTask = { kind, ...withCommon, ...(result ? { result } : {}), ...(unread.length ? { unread } : {}) }
      return { task: out }
    }

    const targetRaw = first(t, ['target', 'aim', 'goal', 'resultant', 'make', 'want'])
    let target: Target | null | undefined
    if (targetRaw !== undefined) {
      target = readTarget(targetRaw)
      if (!target) unread.push(`${shown(targetRaw)} is not an aim the card can read: use "balanced", or a size and direction like "20 N to the right".`)
    }
    const out: MakeTask = { kind, ...withCommon, ...(target ? { target } : {}), ...(unread.length ? { unread } : {}) }
    return { task: out }
  },

  faults(config) {
    const t = config.task
    return t.kind === 'resultant' ? resultantFaults(t) : t.kind === 'make' ? makeFaults(t) : fmaFaults(t)
  },

  promptFaults(config, prompt) {
    const t = config.task
    return t.kind === 'resultant' ? resultantPromptFaults(t, prompt) : t.kind === 'make' ? makePromptFaults(t, prompt) : fmaPromptFaults(t, prompt)
  },

  initial(config) {
    const t = config.task
    if (t.kind === 'resultant') return { size: '', way: '', change: '' }
    if (t.kind === 'make') {
      const m = makeScenario(t)
      return { steps: m ? m.start : 0 }
    }
    return { answer: '' }
  },

  check(config, state) {
    const t = config.task
    if (t.kind === 'resultant') return { ok: resultantVerdict(t, state).ok, wrongIds: [] }
    if (t.kind === 'make') return { ok: makeVerdict(t, state).ok, wrongIds: [] }
    return { ok: fmaVerdict(t, state).ok, wrongIds: [] }
  },

  solve(config) {
    const t = config.task
    if (t.kind === 'resultant') {
      const s = resultantScenario(t)
      if (!s) return { size: '', way: '', change: '' }
      const tr = truthOf(s)
      return { size: String(tr.size), way: tr.way, change: tr.change }
    }
    if (t.kind === 'make') {
      const m = makeScenario(t)
      return { steps: m ? m.solution : 0 }
    }
    const c = fmaCase(t)
    return { answer: c ? fmtRat(c.answer) : '' }
  },

  View: ForcesView,

  prompt: `SCENE "forces" -- forces along one line, three task kinds (IGCSE Physics 0625 sections 1.3 and 1.5.1; ages 11-16).
  Every card draws an object (a box, a car, a boat or a skydiver) with its forces as arrows drawn TO SCALE, each labelled with
  its name and its size in newtons, and a scale bar. The ENGINE deals the forces, so every card is physically sensible: the
  tutor never writes a force. It prints no resultant, no acceleration and no weight of its own before the card is marked.
  (1) "resultant": the object, how it starts (shown as a chip) and two to four forces. The learner types the size of the
  resultant force, picks its direction (or "No direction"), and picks what happens to the motion: "Stays at rest or keeps a
  steady speed", "Speeds up" or "Slows down". Whether the forces are balanced, the resultant, and the working are held back
  until marked, when the resultant arrow is drawn.
  (2) "make": the same picture with one arrow whose end the learner drags (or steps with the arrow keys, or the Shorter and
  Longer buttons) until the resultant meets the AIM printed on the card: balanced forces (zero), or a size and direction. The
  card shows no running resultant: the learner reads the sum off the lengths and labels. Results and working come when marked.
  (3) "f-ma": a mass and a force, an acceleration, or a mass, drawn on the object. The learner types the quantity asked
  (acceleration in m/s2, resultant force or weight in N, mass in kg) as a decimal, marked exactly. "weight" is W = mg with
  g printed on the card. The equation and the answer are held back until marked.
  For: balanced and unbalanced forces, the resultant of forces along a line, Newton's first law (no resultant, no change in
  motion; a resultant along the motion speeds up, against it slows down), F = ma, mass and weight. Not for: forces in two
  dimensions or at angles, terminal velocity graphs, momentum and collisions, moments, circular motion, springs and Hooke's
  law, density or pressure.
  config: { "task": { "kind":"resultant", "object":"<box | car | boat | skydiver>", "motion":"<at rest | moving left | moving right | moving down>",
                      "result":"<balanced | speeds up | slows down>", "forces":<2 to 4, default 2> } }
            -- box: 2, 3 or 4 forces and may start at rest; car and boat: 2 or 3, always moving left or right; skydiver: 2, moving
               down (weight and air resistance). "slows down" needs a moving object. Optional "variant":<0 to 99> deals other numbers.
       or { "task": { "kind":"make", "object":"<box | car | boat | skydiver>", "motion":"<as above, optional>",
                      "target":"<balanced | e.g. 20 N to the right>", "forces":<2 to 4, default 2> } }
            -- the learner sets the push (box), driving force (car), engine thrust (boat) or air resistance (skydiver). A size must
               be in the object's steps: box 5 N, car 200 N, boat 100 N, skydiver 100 N.
       or { "task": { "kind":"f-ma", "find":"<acceleration | force | mass | weight>", "object":"<box | car | boat | skydiver, optional>", "g":<9.8 or 10, weight only> } }
  - the prompt names the question. It never says whether the forces are balanced, the size or direction of the resultant, what
    the motion does, the method ("subtract", "F = ma", "W = mg", Newton's second law), the force to set, or any answer; and it
    does not state the forces' values (the engine chooses them).
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Find the resultant force on the car, then say what happens to its motion.",
    "payload": { "engine":"forces", "config": { "task": { "kind":"resultant", "object":"car", "motion":"moving right", "result":"slows down", "forces":3 } } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"magnitude", "apparatus":"scene:forces", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drag the end of the push arrow until the forces on the box are balanced.",
    "payload": { "engine":"forces", "config": { "task": { "kind":"make", "object":"box", "motion":"moving right", "target":"balanced" } } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"magnitude", "apparatus":"scene:forces", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"A resultant force acts on the car. Work out its acceleration.",
    "payload": { "engine":"forces", "config": { "task": { "kind":"f-ma", "find":"acceleration", "object":"car" } } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"magnitude", "apparatus":"scene:forces", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Work out the weight of the box.",
    "payload": { "engine":"forces", "config": { "task": { "kind":"f-ma", "find":"weight", "object":"box", "g":9.8 } } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"magnitude", "apparatus":"scene:forces", "why":"..." } }`,
}

registerEngine(forcesEngine as SceneEngine<unknown, unknown>)
