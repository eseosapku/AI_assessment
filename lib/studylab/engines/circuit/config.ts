// lib/studylab/engines/circuit/config.ts
import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { CircuitView } from './View'

/**
 * One small circuit the learner changes with their own hand, and the bulbs answer back.
 *
 * The two misconceptions this is built against are the best documented in the physics
 * education literature: that a bulb "uses up" current, and that a battery is a fixed
 * source of current (Engelhardt and Beichner 2004, "Students' understanding of direct
 * current resistive electrical circuits", Am. J. Phys. 72; McDermott and Shaffer 1992).
 * Both are met the way the literature suggests: the learner changes the circuit, sees
 * the brightness change, and after marking sees ammeters read the same either side of a bulb.
 *
 * Tasks:
 * light: two bulbs, A and B, each with its own switch, and a switch in the wire that feeds
 *   B. The learner taps switches until the right bulbs are lit (both; or only one, which is
 *   what a second path to the battery is for).
 * brightness: bulb A lit by the battery. A spare bulb B can be put in either of two slots
 *   (on the top wire, or between the top and bottom wires). The learner finds out by doing it
 *   what each does to A's brightness, then makes A stay as bright as it was, or dim.
 *
 * Facts (Cambridge IGCSE Physics 0625 section 4.2, "Electrical quantities" and "Electric
 * circuits"; OCR Gateway Physics A P5): V = I R (Ohm's law); resistances in series add; the
 * current is the same at every point of a series path; each branch of a parallel circuit has
 * the full battery voltage; a lamp's brightness follows its power P = I^2 R. Wires have no
 * resistance and the battery has no internal resistance (the syllabus idealisation).
 * All arithmetic is exact rational arithmetic on whole-number volts and ohms; brightness
 * is compared by cross-multiplication, never as floats.
 */

export const TASKS = ['light', 'brightness'] as const
export type Task = (typeof TASKS)[number]
export const LIGHT_GOALS = ['both', 'only-first', 'only-second'] as const
export type LightGoal = (typeof LIGHT_GOALS)[number]
export const BRIGHT_GOALS = ['stays-bright', 'dims'] as const
export type BrightGoal = (typeof BRIGHT_GOALS)[number]

export const V_MIN = 1
export const V_MAX = 24
export const R_MIN = 1
export const R_MAX = 30
/** More than this through one bulb is not a school-lab lamp. */
export const I_MAX = 10

export type CircuitConfig =
  | { task: 'light'; goal: LightGoal; volts: number; ohms: number }
  | { task: 'brightness'; goal: BrightGoal; volts: number; ohms: number }

/** Closed switches in the light task: a = bulb A's own switch, link = the switch in the wire feeding B, b = B's own switch. */
export type Switches = { a: boolean; link: boolean; b: boolean }
export type Place = 'none' | 'series' | 'parallel'
export type CircuitState = { sw?: Switches; place?: Place }

// ---------------------------------------------------------------------------
// Exact fractions.

export type Rat = { n: number; d: number }
const gcd = (a: number, b: number): number => {
  a = Math.abs(a)
  b = Math.abs(b)
  while (b) [a, b] = [b, a % b]
  return a || 1
}
export function rat(n: number, d = 1): Rat {
  if (d < 0) { n = -n; d = -d }
  const g = gcd(n, d)
  return { n: n / g, d: d / g }
}
export const sameRat = (a: Rat, b: Rat) => a.n * b.d === b.n * a.d
const mul = (a: Rat, b: Rat) => rat(a.n * b.n, a.d * b.d)
/** a >= b */
const geq = (a: Rat, b: Rat) => a.n * b.d >= b.n * a.d

/** Exact decimal when it terminates ("1.5"), else null. */
export function decimal(r: Rat): string | null {
  const { n, d } = rat(r.n, r.d)
  for (let k = 0; k <= 6; k++) {
    const scaled = n * 10 ** k
    if (scaled % d === 0) {
      const v = String(Math.abs(scaled / d)).padStart(k + 1, '0')
      const s = k === 0 ? v : `${v.slice(0, -k)}.${v.slice(-k)}`
      return (n < 0 ? '−' : '') + s
    }
  }
  return null
}
export const ratText = (r: Rat) => decimal(r) ?? `${r.n}/${r.d}`
/** Whether V/(2R), and so every reading in the scene, is a terminating decimal. */
export const readable = (volts: number, ohms: number) => decimal(rat(volts, 2 * ohms)) !== null

// ---------------------------------------------------------------------------
// The physics.

export type BulbState = { lit: boolean; current: Rat; level: 0 | 1 | 2 | 3 }
export type Net = {
  a: BulbState
  /** null when bulb B is not in the circuit at all. */
  b: BulbState | null
  /** Current out of the battery. */
  battery: Rat
  /** Voltage across bulb A. */
  vA: Rat
}

/** How bright a bulb is, 0 to 3, against a bulb alone on the battery: P = I^2 R, compared exactly. */
function levelOf(current: Rat, ohms: number, ref: Rat): 0 | 1 | 2 | 3 {
  if (current.n === 0) return 0
  const p = mul(mul(current, current), rat(ohms))
  if (geq(p, ref)) return 3
  if (geq(p, rat(ref.n, ref.d * 2))) return 2
  return 1
}

export function netOf(config: CircuitConfig, state: CircuitState): Net {
  const { volts, ohms } = config
  const full = rat(volts, ohms) // V / R, Ohm's law
  const half = rat(volts, 2 * ohms) // two equal resistors in series: V / 2R
  const ref = mul(full, mul(full, rat(ohms))) // P = I^2 R for a bulb alone on the battery
  const bulb = (current: Rat): BulbState => ({ lit: current.n !== 0, current, level: levelOf(current, ohms, ref) })
  const zero = rat(0)
  if (config.task === 'light') {
    const sw = state?.sw ?? { a: false, link: false, b: false }
    const a = sw.a ? full : zero
    const b = sw.link && sw.b ? full : zero
    // Each bulb that has a complete path is across the battery on its own, with the full voltage.
    return { a: bulb(a), b: bulb(b), battery: rat(a.n * b.d + b.n * a.d, a.d * b.d), vA: sw.a ? rat(volts) : zero }
  }
  const place = state?.place ?? 'none'
  if (place === 'series') return { a: bulb(half), b: bulb(half), battery: half, vA: rat(volts, 2) }
  if (place === 'parallel') return { a: bulb(full), b: bulb(full), battery: rat(2 * volts, ohms), vA: rat(volts) }
  return { a: bulb(full), b: null, battery: full, vA: rat(volts) }
}

export const OM = 'Ω'
const unit = (r: Rat) => `${ratText(r)} A`

/** What the learner made, said back as what is seen. */
export function madeText(config: CircuitConfig, state: CircuitState): string {
  const net = netOf(config, state)
  if (config.task === 'light') {
    if (net.a.lit && net.b?.lit) return 'You made both bulbs light.'
    if (net.a.lit) return 'You made bulb A light and left bulb B dark.'
    if (net.b?.lit) return 'You made bulb B light and left bulb A dark.'
    return 'You left both bulbs dark.'
  }
  const place = state?.place ?? 'none'
  if (place === 'none') return 'The second bulb has not been added yet.'
  return net.a.level === 3 ? 'You added the second bulb and bulb A stayed just as bright.' : 'You added the second bulb and bulb A dimmed.'
}

/** The idea said back once marked: what the numbers do. Names the arrangement, so only after marking. */
export function working(config: CircuitConfig, state: CircuitState): string {
  const net = netOf(config, state)
  const { volts, ohms } = config
  if (config.task === 'light') {
    const lit = [net.a.lit, net.b?.lit ?? false]
    const one = unit(rat(volts, ohms))
    if (lit[0] && lit[1]) return `Each bulb has its own path to the ${volts} V battery and so the full ${volts} V: ${volts} ÷ ${ohms} ${OM} = ${one} through each, and the battery gives ${unit(net.battery)}. This is a parallel circuit: one bulb going out would leave the other as bright.`
    if (lit[0] || lit[1]) return `Only ${lit[0] ? 'A' : 'B'} has a complete path to the battery, and it still gets the full ${volts} V and ${one}. The other bulb's path is broken at a switch, so the break puts out only that bulb: each bulb is on its own path, which is what a parallel circuit gives.`
    return 'Neither bulb has a complete path from one end of the battery to the other, so no current flows anywhere.'
  }
  const place = state?.place ?? 'none'
  if (place === 'series') return `The bulbs are in series: there is one path, so the same current goes through both, and the ${volts} V is shared, ${ratText(rat(volts, 2))} V each. The resistance is ${2 * ohms} ${OM}, so the current is ${volts} ÷ ${2 * ohms} = ${unit(net.battery)} instead of ${unit(rat(volts, ohms))}: A is dimmer.`
  if (place === 'parallel') return `The bulbs are in parallel: each has its own path and the full ${volts} V, so A still has ${unit(net.a.current)} and glows as before. The battery now gives ${unit(net.battery)}, twice what it gave one bulb: a battery does not give a fixed current.`
  return `One bulb on a ${volts} V battery: ${volts} ÷ ${ohms} = ${unit(net.a.current)}.`
}

// ---------------------------------------------------------------------------
// Reading the tutor's config.

const key = (raw: unknown) => (typeof raw === 'string' ? raw.trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[\s_]+/g, '-') : null)

function readTask(raw: unknown): Task | null {
  const k = key(raw)
  if (!k) return null
  const alias: Record<string, Task> = {
    light: 'light', 'make-it-light': 'light', 'light-up': 'light', 'light-the-bulbs': 'light', complete: 'light', 'complete-the-circuit': 'light', 'make-it-work': 'light', switches: 'light',
    brightness: 'brightness', 'add-a-bulb': 'brightness', 'add-bulb': 'brightness', 'second-bulb': 'brightness', 'series-or-parallel': 'brightness', 'series-parallel': 'brightness', 'series-and-parallel': 'brightness', compare: 'brightness',
  }
  return Object.prototype.hasOwnProperty.call(alias, k) ? alias[k] : null
}

function readGoal(task: Task, raw: unknown): LightGoal | BrightGoal | null | undefined {
  if (raw === undefined) return undefined
  const k = key(raw)
  if (!k) return null
  const light: Record<string, LightGoal> = {
    both: 'both', all: 'both', every: 'both', 'both-lit': 'both', 'both-on': 'both', 'all-lit': 'both',
    'only-first': 'only-first', first: 'only-first', a: 'only-first', 'only-a': 'only-first', 'a-only': 'only-first', 'a-on': 'only-first', 'keep-a': 'only-first',
    'only-second': 'only-second', second: 'only-second', b: 'only-second', 'only-b': 'only-second', 'b-only': 'only-second', 'b-on': 'only-second', 'keep-b': 'only-second',
  }
  const bright: Record<string, BrightGoal> = {
    'stays-bright': 'stays-bright', 'stay-bright': 'stays-bright', bright: 'stays-bright', brightness: 'stays-bright', same: 'stays-bright', keep: 'stays-bright', unchanged: 'stays-bright', steady: 'stays-bright', 'keep-bright': 'stays-bright', 'stays-the-same': 'stays-bright',
    dims: 'dims', dim: 'dims', dimmer: 'dims', fainter: 'dims', 'gets-dimmer': 'dims', 'goes-dim': 'dims',
  }
  const table: Record<string, LightGoal | BrightGoal> = task === 'light' ? light : bright
  return Object.prototype.hasOwnProperty.call(table, k) ? table[k] : null
}

/** "6", "6 V", "3 ohms", "3Ω" all read; anything else is unreadable. */
function readNumber(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) && Math.abs(raw) <= 1000 ? raw + 0 : null
  if (typeof raw !== 'string') return null
  const m = raw.trim().match(/^(-?\d+(?:\.\d+)?)\s*(?:v|volts?|ω|ohms?|Ω)?$/i)
  const v = m ? Number(m[1]) : NaN
  return Number.isFinite(v) && Math.abs(v) <= 1000 ? v + 0 : null
}
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)

export const circuitEngine: SceneEngine<CircuitConfig, CircuitState> = {
  id: 'circuit',
  // "circuits" and "resistors" are phrases, not covers: scenesFor also matches a shared five-letter stem, so as covers they would
  // claim "circulation" and "air resistance". "current", "series" and "parallel" are left to phrases for the reason their words say:
  // alone they would catch ocean currents, number series and parallel lines.
  covers: ['ammeter'],
  phrases: [
    'circuits', 'circuit', 'resistors', 'resistor',
    'series and parallel', 'parallel circuits', 'series circuits', 'ohm\'s law', 'electric current', 'electrical current', 'electrical resistance',
    'potential difference', 'electric bulbs', 'electric charge and current', 'current and voltage', 'electrical energy and power', 'current electricity',
  ],
  // The learner varies how the parts are connected, which is the structure of the circuit.
  isolates: 'structure',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const nested = o.task && typeof o.task === 'object' ? (o.task as Record<string, unknown>) : null
    const src = nested ?? o
    const task = readTask(nested ? first(nested, ['kind', 'task']) : o.task)
    if (!task) return null
    const goalRaw = readGoal(task, first(src, ['goal', 'target', 'aim', 'want']))
    if (goalRaw === null) return null
    const vRaw = first(src, ['volts', 'voltage', 'v', 'battery', 'cell'])
    const rRaw = first(src, ['ohms', 'resistance', 'r', 'bulb', 'bulbResistance'])
    const volts = vRaw === undefined ? 6 : readNumber(vRaw)
    const ohms = rRaw === undefined ? 3 : readNumber(rRaw)
    if (volts === null || ohms === null) return null
    if (task === 'light') return { task, goal: (goalRaw ?? 'both') as LightGoal, volts, ohms }
    return { task, goal: (goalRaw ?? 'stays-bright') as BrightGoal, volts, ohms }
  },

  faults(config) {
    const { volts, ohms } = config
    // A nearby pair that works, for the message.
    const nv = Number.isInteger(volts) ? Math.min(V_MAX, Math.max(V_MIN, volts)) : 6
    let near = { v: 6, r: 3 }
    for (let dr = 0; dr <= R_MAX; dr++) {
      const c = [Math.round(ohms) + dr, Math.round(ohms) - dr].find((r) => r >= R_MIN && r <= R_MAX && readable(nv, r) && nv / r <= I_MAX)
      if (c !== undefined) { near = { v: nv, r: c }; break }
    }
    const eg = `e.g. a ${near.v} V battery with ${near.r} ${OM} bulbs`
    if (!Number.isInteger(volts) || volts < V_MIN || volts > V_MAX) return [`the battery must be a whole number of volts from ${V_MIN} to ${V_MAX}: use ${eg}.`]
    if (!Number.isInteger(ohms) || ohms < R_MIN || ohms > R_MAX) return [`each bulb's resistance must be a whole number of ohms from ${R_MIN} to ${R_MAX}: use ${eg}.`]
    if (volts / ohms > I_MAX) return [`${volts} V across a ${ohms} ${OM} bulb would pass ${ratText(rat(volts, ohms))} A, far more than a lamp takes (limit ${I_MAX} A): use ${eg}.`]
    if (!readable(volts, ohms)) return [`${volts} V with ${ohms} ${OM} bulbs gives currents that do not come out as a clean decimal (${volts}/${2 * ohms} A): use ${eg}.`]
    return []
  },

  promptFaults(config, prompt) {
    const text = prompt.toLowerCase()
    // The goal is only ever said in the prompt. A real lesson wrote "Close the switch to light the bulb"
    // over two bulbs and three switches, and told a learner who lit both that it was not quite right.
    const offOther = /\b(only|just|out|off|dark|unlit)\b/.test(text)
    const says: Record<typeof config.goal, [boolean, string]> = {
      both: [/\bboth\b/.test(text), 'Make both bulbs light.'],
      'only-first': [/\bbulb a\b/.test(text) && offOther, 'Switch the circuit so only bulb A is lit.'],
      'only-second': [/\bbulb b\b/.test(text) && offOther, 'Switch the circuit so only bulb B is lit.'],
      dims: [/\bdim/.test(text), 'Add the second bulb so bulb A dims: tap a slot to put it there.'],
      'stays-bright': [/\bbright/.test(text), 'Add the second bulb so bulb A stays as bright as it was: tap a slot to put it there.'],
    }
    const [named, example] = says[config.goal]
    const names = /\b(series|parallel|in[- ]line|in a line|side[- ]by[- ]side|branch(?:es)?|share[sd]?|separate (?:path|route|wire)|own path|one path|two paths|junction|loop)\b/.test(text)
    const reading = /\d+(?:\.\d+)?\s*(?:a|amps?|amperes?|ma)\b/.test(text) || /\bammeters?\b/.test(text)
    if (!names && !reading) return named ? [] : [`the prompt does not say what to make, and nothing else on the card does: say it, e.g. "${example}"`]
    return config.task === 'light'
      ? ['the prompt gives the answer away: it names the arrangement or a current, which the learner is to find by trying the switches -- say only what to achieve ("Switch the circuit so bulb B is lit and bulb A is out.")']
      : ['the prompt gives the answer away: it names how the second bulb joins ("series", "parallel", "in line", "branch") or a current, which the learner is to find by trying both slots -- say only what to achieve ("Add the second bulb so bulb A stays as bright as it was on its own.")']
  },

  initial(config) {
    if (config.task === 'brightness') return { place: 'none' }
    // Every start is a working circuit that is not yet the goal.
    if (config.goal === 'both') return { sw: { a: true, link: false, b: false } }
    if (config.goal === 'only-second') return { sw: { a: true, link: false, b: true } }
    return { sw: { a: false, link: true, b: true } }
  },

  check(config, state) {
    const net = netOf(config, state)
    if (config.task === 'light') {
      const wantA = config.goal !== 'only-second'
      const wantB = config.goal !== 'only-first'
      const wrongIds: string[] = []
      if (net.a.lit !== wantA) wrongIds.push('a')
      if (!!net.b?.lit !== wantB) wrongIds.push('b')
      return { ok: wrongIds.length === 0, wrongIds }
    }
    const place = state?.place ?? 'none'
    const want: Place = config.goal === 'dims' ? 'series' : 'parallel'
    return place === want ? { ok: true, wrongIds: [] } : { ok: false, wrongIds: ['place'] }
  },

  solve(config) {
    if (config.task === 'brightness') return { place: config.goal === 'dims' ? 'series' : 'parallel' }
    if (config.goal === 'both') return { sw: { a: true, link: true, b: true } }
    if (config.goal === 'only-second') return { sw: { a: false, link: true, b: true } }
    return { sw: { a: true, link: false, b: false } }
  },

  View: CircuitView,

  prompt: `SCENE "circuit" -- one small circuit the learner changes with their own hand, and the bulbs answer back. Standard school symbols
  (cell, bulb, switch); bulbs glow brighter with more rays. The engine works out every current with Ohm's law and the series and
  parallel rules; nothing is typed. After marking, ammeters appear either side of the lit bulbs (the same reading both sides: a bulb
  does not use current up) and the working is said back. Nothing names series, parallel or any current before that.
  light: a battery and two bulbs, A and B. A has its own switch, B has its own switch, and there is a third switch in the wire that
    feeds B. The learner taps switches (open or closed) until the right bulbs are lit. goal "both": light both. goal "only-second":
    B lit and A out. goal "only-first": A lit and B out. It starts from a working circuit that is not yet the goal.
  brightness: one bulb A lit by the battery, and two empty slots where a spare bulb B can go. The learner taps a slot to put B there
    (tap again to take it out) and watches A. goal "stays-bright": add B so A stays as bright as on its own. goal "dims": add B so A
    dims. The two slots are two different ways to connect the bulb; which is which is never said.
  For: series and parallel circuits, how brightness changes when a bulb is added, current is not used up, a battery does not give a
    fixed current, Ohm's law (the working shows V / R).
  Optional "volts" (whole number, 1 to 24, default 6) and "ohms" (each bulb, whole number, 1 to 30, default 3); the current through one
    bulb alone must be at most 10 A and V / (2R) must be a clean decimal (6 V with 3 ohms: yes; 5 V with 3 ohms: no).
  config: { "task":"light", "goal":"both", "volts":6, "ohms":3 }  -- prompt "Make both bulbs light." (ALWAYS say the goal: nothing else on the card does. Do NOT write series, parallel, a current or "separate paths")
       or { "task":"light", "goal":"only-second", "volts":6, "ohms":3 }  -- prompt "Switch the circuit so bulb B is lit and bulb A is out."
       or { "task":"brightness", "goal":"stays-bright", "volts":6, "ohms":3 }  -- prompt "Add the second bulb so bulb A stays as bright as it was on its own: tap a slot to put it there."
       or { "task":"brightness", "goal":"dims", "volts":12, "ohms":6 }  -- prompt "Add the second bulb so bulb A dims: tap a slot to put it there."
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Switch the circuit so bulb B is lit and bulb A is out.",
    "payload": { "engine":"circuit", "config": { "task":"light", "goal":"only-second", "volts":6, "ohms":3 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"structure", "apparatus":"scene:circuit", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Add the second bulb so bulb A stays as bright as it was on its own: tap a slot to put it there.",
    "payload": { "engine":"circuit", "config": { "task":"brightness", "goal":"stays-bright", "volts":6, "ohms":3 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"structure", "apparatus":"scene:circuit", "why":"..." } }`,
}

registerEngine(circuitEngine as SceneEngine<unknown, unknown>)
