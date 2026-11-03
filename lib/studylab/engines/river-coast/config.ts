// lib/studylab/engines/river-coast/config.ts
//
// Water doing its work, shown happening. Two tasks, one clock:
//   meander -- a river winds across a floodplain and a house stands on one plot. Run the years forward: the fastest
//              water swings to the outside of each bend and cuts it, the slow inside drops its sand, and the bends grow
//              and slide downstream. Move the house to a plot the river will never reach;
//   drift   -- waves arrive at a slant on a beach of pebbles. Each swash carries a pebble up the beach at an angle, each
//              backwash pulls it straight down, so pebbles zigzag along the coast. Build groynes (timber walls) so that the
//              beach in front of the hotel is still thick with sand twenty years on.
//
// The rules, all computed here and never read from the drawing:
//   meander: the channel's centre line is y = CY + A(t) sin(2 pi (x - S(t)) / LAM). A(t) and S(t) grow with the years, so
//     bends swing wider and slide downstream. A plot is lost in the first year the house comes within HIT_DIST of the
//     centre line. The house is right when its plot is never lost within the horizon.
//   drift: a coast of five bays; sand is carried along the shore at a steady rate RATE from the up-drift end. A groyne
//     stops all sand until the bay up-drift of it is full, then passes only what arrives. The hotel beach is held when
//     its bay is at least HOLD_AT full after the horizon.
//
// Facts: longshore drift is the zigzag of swash at the angle the waves arrive and backwash straight down the steepest slope
// of the beach; a groyne traps sediment on its up-drift side and starves the beach down-drift; erosion is greatest on the
// outside of a bend where flow is fastest (the cutbank) and deposition on the inside (the point bar / slip-off slope).
// General knowledge of the school syllabuses, checked against the teaching notes read below, not a specification.
//
// Ideas taken, never code or art:
//   - the stream table: students watch a channel migrate over repeated runs (teacher lesson plans, flipeducation.ai, middle
//     and lower course river landforms), which is why the learner here runs the years forward and watches;
//   - the three misconceptions those notes list: the inside of a bend is where the water is fastest (a study of undergraduate
//     conceptions of surface-water flow, NSF PAR 10295403), meanders stay where they are, and sediment moves in a straight line
//     parallel to the shore instead of zigzagging (flipeducation.ai coastal transportation notes); also "a groyne protects the
//     whole coast", answered by the beach beyond it going bare;
//   - the sand-tray/angled-wave activity, with a groyne added and the build-up sketched: here the pebbles themselves zigzag.
// Refused: waterfalls and gorges (a cross-section idea that needs its own cut-away), ox-bow lakes and deltas (more of the
// same river picture, no new act), seawalls and cliffs (a different hard-engineering idea), tides and storms.

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { RiverCoastView } from './View'

export const TMAX = 4
/** The river's step is fifty years; the beach's is five. */
export const RIVER_YEARS = 50
export const BEACH_YEARS = 5

// ---------------------------------------------------------------------------
// The river.

export const FLOWS = ['steady', 'fast'] as const
export type FlowName = (typeof FLOWS)[number]
export const BENDS = ['first', 'second', 'third'] as const
export type BendName = (typeof BENDS)[number]

export const PLAN_W = 360
export const PLAN_H = 250
export const CY = 125
export const LAM = 240
export const A0 = 26
export const CHANNEL_W = 16
/** The house is lost when its middle comes this close to the middle of the channel. */
export const HIT_DIST = 16
const GROW: Record<FlowName, { a: number; s: number }> = { steady: { a: 9, s: 6 }, fast: { a: 12, s: 9 } }

export const amplitude = (flow: FlowName, t: number) => A0 + GROW[flow].a * t
export const shiftOf = (flow: FlowName, t: number) => GROW[flow].s * t
/** The centre of the channel at x, t years' worth of steps on. */
export const riverY = (flow: FlowName, x: number, t: number) => CY + amplitude(flow, t) * Math.sin((2 * Math.PI * (x - shiftOf(flow, t))) / LAM)

export type Site = { id: string; n: number; x: number; y: number; bend: number; side: 'outer' | 'inner' }
const APEX = [60, 180, 300]
const SIGN = [1, -1, 1]
// Numbered in no particular order, so the numbers and the tab order say nothing about which plots are safe.
const NUMBER: Record<string, number> = { i0: 3, o0: 5, i1: 1, o1: 4, i2: 6, o2: 2 }
export const SITES: Site[] = APEX.flatMap((x, b): Site[] => [
  { id: `o${b}`, n: NUMBER[`o${b}`], x: x + 12, y: CY + SIGN[b] * (A0 + 38), bend: b, side: 'outer' },
  { id: `i${b}`, n: NUMBER[`i${b}`], x, y: CY - SIGN[b] * 4, bend: b, side: 'inner' },
]).sort((a, b) => a.n - b.n)

export const siteOf = (id: string): Site => SITES.find((s) => s.id === id) ?? SITES[0]

export function distToRiver(flow: FlowName, p: { x: number; y: number }, t: number): number {
  let best = Infinity
  for (let x = p.x - 46; x <= p.x + 46; x += 1) best = Math.min(best, Math.hypot(x - p.x, riverY(flow, x, t) - p.y))
  return best
}

/** The first moment, in steps, the river reaches the plot; null if it never does within the horizon. */
export function lostAt(flow: FlowName, id: string): number | null {
  const s = siteOf(id)
  for (let t = 0; t <= TMAX + 1e-9; t += 0.05) if (distToRiver(flow, s, t) < HIT_DIST) return Math.round(t * 100) / 100
  return null
}

export const flowOf = (config: RcConfig): FlowName => (config.task === 'meander' && (FLOWS as readonly string[]).includes(config.flow) ? (config.flow as FlowName) : 'steady')
export const bendIndex = (config: RcConfig): number => (config.task === 'meander' ? Math.max(0, (BENDS as readonly string[]).indexOf(config.bend)) : 0)

// ---------------------------------------------------------------------------
// The beach. Five bays, four places for a groyne between them, waves from the left or the right.

export const BAYS = 5
export const BAY_W = 72
export const HOTELS = ['left', 'middle', 'right'] as const
export const FROMS = ['left', 'right'] as const
export type FromName = (typeof FROMS)[number]
export const RATE = 0.25
export const HOLD_AT = 0.9
const SUB = 0.02

export const hotelBay = (config: RcConfig): number => (config.task === 'drift' ? 1 + Math.max(0, (HOTELS as readonly string[]).indexOf(config.hotel)) : 2)
export const fromOf = (config: RcConfig): FromName => (config.task === 'drift' && config.from === 'right' ? 'right' : 'left')

/** Sites run 1 to 4 across the screen; along the drift they run the other way when the waves come from the right. */
export const driftSite = (from: FromName, s: number) => (from === 'left' ? s : BAYS - s)
export const screenBay = (from: FromName, k: number) => (from === 'left' ? k : BAYS - 1 - k)

const levelCache = new Map<string, number[][]>()
/** Every 0.05 step of the years, the fullness of each bay (0 bare, 1 full), by screen bay. */
function trajectory(from: FromName, groynes: number[]): number[][] {
  const key = `${from}|${groynes.join(',')}`
  const known = levelCache.get(key)
  if (known) return known
  const g = new Set(groynes.map((s) => driftSite(from, s)))
  const level = Array.from({ length: BAYS }, () => 0.5)
  const out: number[][] = []
  const per = Math.round(0.05 / SUB)
  const steps = Math.round(TMAX / SUB)
  for (let i = 0; i <= steps; i++) {
    if (i % per === 0) out.push(Array.from({ length: BAYS }, (_, s) => level[from === 'left' ? s : BAYS - 1 - s]))
    // flow across the entrance (0), the sites (1..4) and the exit (5)
    const q: number[] = [RATE]
    for (let j = 1; j <= BAYS; j++) {
      const stock = level[j - 1] / SUB + q[j - 1]
      if (g.has(j)) q.push(level[j - 1] >= 1 - 1e-9 ? q[j - 1] : 0)
      else q.push(Math.min(RATE, stock))
    }
    for (let k = 0; k < BAYS; k++) level[k] = Math.max(0, Math.min(1, level[k] + (q[k] - q[k + 1]) * SUB))
  }
  levelCache.set(key, out)
  return out
}

/** How full each bay is (screen order) after t steps. */
export function levelsAt(from: FromName, groynes: number[], t: number): number[] {
  const tr = trajectory(from, groynes)
  const f = Math.max(0, Math.min(TMAX, t)) / 0.05
  const i = Math.min(tr.length - 1, Math.floor(f))
  const j = Math.min(tr.length - 1, i + 1)
  const w = f - i
  return tr[i].map((v, k) => v + (tr[j][k] - v) * w)
}

// ---------------------------------------------------------------------------
// The pebbles. A plain simulation in drift coordinates (x grows along the drift), so a test can run it undrawn.

export const PEBBLES = 10
export const PEBBLE_R = 6
export const SWASH_STEP = 26
export const CYCLE = 2.4
export const SPACING = 13
export const WALL = 9
export const EDGE = 372

export type Pebble = { x: number; u: number }
export type Pebbles = Pebble[]

export const startPebbles = (): Pebbles => Array.from({ length: PEBBLES }, (_, i) => ({ x: 18 + i * 36, u: (i * 0.37) % 1 }))
export const groyneX = (dsite: number) => dsite * BAY_W

/** One frame. A pebble moves on only in the swash, never through a groyne, never onto the pebble ahead. */
export function stepPebbles(ps: Pebbles, dgroynes: number[], dt: number): Pebbles {
  const walls = dgroynes.map(groyneX).sort((a, b) => a - b)
  const moved = ps.map((p) => {
    const u = p.u + dt / CYCLE
    const swash = p.u % 1 < 0.5
    let x = p.x + (swash ? (SWASH_STEP / (CYCLE / 2)) * dt : 0)
    for (const w of walls) {
      if (p.x <= w - WALL + 1e-6 && x > w - WALL) x = w - WALL
      else if (p.x > w - WALL && p.x < w + WALL) x = p.x < w ? w - WALL : w + WALL
    }
    return { x, u }
  })
  // Furthest on first: each pebble stops short of the one ahead of it.
  const order = moved.map((_, i) => i).sort((a, b) => moved[b].x - moved[a].x)
  for (let r = 1; r < order.length; r++) {
    const ahead = moved[order[r - 1]]
    const me = moved[order[r]]
    const old = ps[order[r]].x
    if (me.x > ahead.x - SPACING && ahead.x - SPACING >= old - 1e-6) me.x = ahead.x - SPACING
    else if (me.x > ahead.x - SPACING) me.x = Math.max(old, Math.min(me.x, ahead.x - SPACING))
  }
  // Out of the right-hand edge and in again at the left: the coast goes on.
  return moved.map((p) => (p.x > EDGE ? { x: p.x - EDGE - 12, u: p.u } : p))
}

export function settledPebbles(dgroynes: number[], seconds = 60): Pebbles {
  let ps = startPebbles()
  for (let i = 0; i < seconds / 0.1; i++) ps = stepPebbles(ps, dgroynes, 0.1)
  return ps
}

// ---------------------------------------------------------------------------
// The tutor's config, and the learner's state.

export type RcConfig =
  /** flow: steady or fast. bend: which bend the house starts on. Words outside the lists still parse; faults says what works. */
  | { task: 'meander'; flow: string; bend: string }
  /** from: the side the waves come from. hotel: where the hotel stands along the coast. */
  | { task: 'drift'; from: string; hotel: string }

/** site: the plot the house stands on (meander). groynes: sites 1 to 4 across the screen (drift). t: steps of years. run: bumps to replay. */
export type RcState = { site?: string; groynes?: number[]; t: number; run: number }

const has = (o: object, k: string | number) => Object.prototype.hasOwnProperty.call(o, k)

export const groynesOf = (state: RcState): number[] => (Array.isArray(state?.groynes) ? [...new Set(state.groynes.filter((n) => n === 1 || n === 2 || n === 3 || n === 4))].sort() : [])
export const timeOf = (state: RcState): number => (typeof state?.t === 'number' && Number.isFinite(state.t) ? Math.max(0, Math.min(TMAX, Math.round(state.t))) : 0)
export const siteIdOf = (config: RcConfig, state: RcState): string =>
  typeof state?.site === 'string' && SITES.some((s) => s.id === state.site) ? state.site : `o${bendIndex(config)}`

export function holdsNow(config: RcConfig, state: RcState): number {
  return levelsAt(fromOf(config), groynesOf(state), TMAX)[hotelBay(config)]
}

export function done(config: RcConfig, state: RcState): boolean {
  if (config.task === 'meander') return lostAt(flowOf(config), siteIdOf(config, state)) === null
  return holdsNow(config, state) >= HOLD_AT
}

// ---------------------------------------------------------------------------
// What is said once marked. Before that the card holds no verdict at all.

const years = (t: number, per: number) => `${Math.round(t * per)}`

export function working(config: RcConfig, state: RcState): string {
  if (config.task === 'meander') {
    return 'Yes. The fastest water swings to the outside of every bend and cuts the bank there. On the slower inside it drops its sand, so the inside builds up. The bends swell and slide downstream, so a house on the outside is lost, and one on the inside is left on dry land.'
  }
  const from = fromOf(config)
  const toward = from === 'left' ? 'right' : 'left'
  const hotel = `the hotel beach`
  const g = groynesOf(state)
  return `Yes. Each wave arrives at a slant and the backwash runs straight down, so pebbles zigzag along the coast towards the ${toward}. A groyne stops them on the side they come from, so ${hotel} built up. The beach beyond it gets none and thins${g.length > 1 ? '; each extra groyne does the same further along' : ''}.`
}

export function madeText(config: RcConfig, state: RcState): string {
  if (config.task === 'meander') {
    const id = siteIdOf(config, state)
    const t = lostAt(flowOf(config), id)
    const s = siteOf(id)
    if (t === null) return 'The house is safe.'
    return `You put the house on plot ${s.n}. The river reached it by year ${years(Math.ceil(t), RIVER_YEARS)}, because the fast water cuts the outside of a bend and the bends grow and slide downstream.`
  }
  const from = fromOf(config)
  const g = groynesOf(state)
  const k = hotelBay(config)
  const lvl = holdsNow(config, state)
  const upEdge = from === 'left' ? k : k + 1
  const downEdge = from === 'left' ? k + 1 : k
  const pct = Math.round(lvl * 100)
  if (!g.length) return `There is no groyne, so pebbles kept passing and the hotel beach stayed about half as thick as a full beach (${pct}%).`
  if (g.includes(upEdge) && !g.includes(downEdge)) return `You put a groyne on the side the waves come from. It caught the pebbles before they reached the hotel beach, which wore away to ${pct}%.`
  if (!g.includes(downEdge)) return `The hotel beach is only ${pct}% full: no groyne stops the pebbles leaving it, so they keep passing along the coast.`
  return `Your groynes held the pebbles on the hotel beach, but other groynes caught them first and the hotel beach was only ${pct}% full when the years ran out. Pebbles must fill each beach behind a groyne before any pass on.`
}

// ---------------------------------------------------------------------------
// Reading the tutor's config.

const keyOf = (raw: unknown) => (typeof raw === 'string' ? raw.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : typeof raw === 'number' ? String(raw) : '')
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)

const MEANDER_WORDS = new Set(['meander', 'meanders', 'river', 'rivers', 'river-bend', 'river-bends', 'bend', 'bends', 'floodplain', 'migration', 'river-erosion', 'channel', 'house', 'river-meander', 'river-meanders', 'river-landforms'])
const DRIFT_WORDS = new Set(['drift', 'longshore-drift', 'longshore', 'groyne', 'groynes', 'coast', 'coastal', 'beach', 'beaches', 'sea-defence', 'sea-defences', 'coastal-defence', 'coastal-defences', 'coastal-management', 'deposition', 'coastal-erosion', 'hotel', 'coastal-protection'])

const FLOW_WORDS: Record<string, FlowName> = { steady: 'steady', slow: 'steady', normal: 'steady', calm: 'steady', gentle: 'steady', fast: 'fast', quick: 'fast', flood: 'fast', strong: 'fast', high: 'fast', swift: 'fast', 'fast-flowing': 'fast' }
const BEND_WORDS: Record<string, BendName> = { first: 'first', '1': 'first', upstream: 'first', second: 'second', '2': 'second', middle: 'second', centre: 'second', center: 'second', third: 'third', '3': 'third', downstream: 'third' }
const FROM_WORDS: Record<string, FromName> = { left: 'left', west: 'left', 'the-left': 'left', right: 'right', east: 'right', 'the-right': 'right' }
const HOTEL_WORDS: Record<string, (typeof HOTELS)[number]> = { left: 'left', west: 'left', middle: 'middle', centre: 'middle', center: 'middle', central: 'middle', right: 'right', east: 'right' }

const goodPrompt = (config: RcConfig) =>
  config.task === 'meander'
    ? `Tap a numbered plot to move the house there, and press the plus on Years to run the river forward. Choose a plot where the house is still on dry land after ${TMAX * RIVER_YEARS} years.`
    : `Tap a dotted line to build a groyne there, and tap it again to take it away. Keep the beach in front of the hotel thick with sand for the next ${TMAX * BEACH_YEARS} years.`

export const riverCoastEngine: SceneEngine<RcConfig, RcState> = {
  id: 'river-coast',
  // Few and distinctive: "river", "bank", "coast", "mouth" and "drift" mean other things (history, money, continental and genetic drift).
  covers: ['meanders', 'meandering', 'groynes', 'longshore'],
  phrases: [
    'river meanders', 'river meander', 'meandering rivers', 'meandering river', 'oxbow lakes', 'ox bow lakes', 'oxbow lake', 'ox bow lake', 'river erosion', 'river deposition', 'river landforms', 'river landform', 'river processes',
    'erosion and deposition', 'river erosion and deposition', 'rivers and coasts', 'river and coast landforms', 'river and coastal landforms', 'river and coastal', 'floodplains', 'floodplain', 'flood plain', 'flood plains',
    'middle and lower course', 'lower course of a river', 'middle course of a river', 'river channel', 'river bends', 'river bend',
    'coastal erosion', 'coastal deposition', 'coastal processes', 'coastal landforms', 'coastal management', 'coastal protection', 'coastal defences', 'coastal defence', 'sea defences', 'sea defence', 'wave erosion', 'wave erosion and deposition',
    'longshore drift', 'beach processes', 'beaches and spits', 'spits and bars', 'coastal transport', 'coastal transportation', 'sediment transport',
  ],
  notFor: [
    'soil erosion', 'gully erosion', 'wind erosion', 'glacial erosion', 'glacial deposition', 'glaciers', 'erosion of the soil', 'soil conservation', 'gene flow',
    'genetic drift', 'continental drift', 'drift velocity', 'electron drift', 'snow drift', 'drift net', 'drifting', 'plate tectonics',
    'river valley civilisation', 'river valley civilisations', 'river civilisations', 'nile valley', 'river thames', 'coastal tourism', 'coastal cities', 'coastal ecosystems', 'coastal habitats', 'coastal wetlands', 'coral reefs', 'mangroves',
    'tsunami', 'tsunamis', 'tropical storms', 'storm surge', 'flood risk', 'flood management', 'floods', 'drainage basin', 'drainage basins', 'hydrological cycle', 'water cycle', 'river pollution', 'water pollution', 'river basin', 'river basins',
    'sea level rise', 'rising sea levels', 'sound waves', 'heat waves', 'wave speed',
  ],
  isolates: 'consequence',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const word = keyOf(first(o, ['task', 'kind', 'type', 'mode', 'scene']))
    const rawFlow = first(o, ['flow', 'discharge', 'speed', 'river'])
    const rawBend = first(o, ['bend', 'start', 'house'])
    const rawFrom = first(o, ['from', 'waves', 'direction', 'waveDirection', 'wavesFrom'])
    const rawHotel = first(o, ['hotel', 'where', 'position'])
    let task: 'meander' | 'drift' | null = null
    if (word) {
      if (MEANDER_WORDS.has(word)) task = 'meander'
      else if (DRIFT_WORDS.has(word)) task = 'drift'
      else return null
    } else if (rawFrom !== undefined || rawHotel !== undefined) task = 'drift'
    else if (rawFlow !== undefined || rawBend !== undefined) task = 'meander'
    if (!task) return null
    const text = (v: unknown, dflt: string, table: Record<string, string>): string | null => {
      if (v === undefined) return dflt
      if (typeof v !== 'string' && typeof v !== 'number') return null
      const k = keyOf(v).replace(/^(?:from-)?the-/, '').replace(/-?(?:flow|bend|side)$/, '')
      return has(table, k) ? table[k] : k
    }
    if (task === 'meander') {
      const flow = text(rawFlow, 'steady', FLOW_WORDS)
      const bend = text(rawBend, 'first', BEND_WORDS)
      return flow === null || bend === null ? null : { task, flow, bend }
    }
    const from = text(rawFrom, 'left', FROM_WORDS)
    const hotel = text(rawHotel, 'middle', HOTEL_WORDS)
    return from === null || hotel === null ? null : { task, from, hotel }
  },

  faults(config) {
    const out: string[] = []
    if (config.task === 'meander') {
      if (!(FLOWS as readonly string[]).includes(config.flow)) out.push(`There is no "${config.flow}" river: flow must be one of ${FLOWS.join(', ')}, e.g. flow "steady".`)
      if (!(BENDS as readonly string[]).includes(config.bend)) out.push(`There is no "${config.bend}" bend: bend must be one of ${BENDS.join(', ')}, e.g. bend "first".`)
    } else {
      if (!(FROMS as readonly string[]).includes(config.from)) out.push(`The waves cannot come from "${config.from}": from must be left or right, e.g. from "left".`)
      if (!(HOTELS as readonly string[]).includes(config.hotel)) out.push(`The hotel cannot stand "${config.hotel}": hotel must be one of ${HOTELS.join(', ')}, e.g. hotel "middle".`)
    }
    return out
  },

  promptFaults(config, prompt) {
    const text = prompt.replace(/\s+/g, ' ')
    const example = goodPrompt(config)
    const out: string[] = []
    const give = config.task === 'meander'
      ? /\b(?:outer|outside|inner|inside)\b|\bcut ?bank|\bslip-?off|\bpoint bar|\bundercut|\bfastest\b|\bslowest\b|\bfast water|\bslow water|\bdeposit|\bnot (?:near|next to|beside) the (?:river|water)|\bfurthest from the (?:river|water)|\bsafest\b|\bodd\b|\beven\b|\bplots? (?:\d|one|two|three|four|five|six)\b/i.test(text)
      : /\bup-?drift|\bdown-?drift|\bside (?:the )?waves|\bfrom the (?:left|right)\b|\b(?:left|right) (?:of|side)\b|\bnext to the hotel|\bbeside the hotel|\bbeyond the hotel|\bpast the hotel|\bbefore the hotel|\bafter the hotel|\bbetween\b|\bone groyne|\b(?:a )?single groyne|\btwo groynes|\bstarv|\bwhich side|\bzig-?zag|\bwhere the pebbles (?:go|stop|pile)/i.test(text)
    if (give) out.push(`the prompt gives the answer away: it says where to put it, or why, which the learner is to find by running the years -- ask for the outcome only ("${example}")`)
    const promise = /\bwaterfalls?\b|\bgorges?\b|\box-?bow|\bdelta\b|\bcross-?section|\bcliffs?\b|\bwave-?cut|\bseawall|\bsea wall|\brock armour|\brip-?rap|\btides?\b|\bstorms?\b|\btsunami|\bdrag\b|\bdrop\b/i.test(text)
    if (promise) out.push(`the prompt promises something the card does not show: it draws a river migrating across a floodplain, or pebbles drifting past groynes, and the learner taps plots, groynes and Years -- ask for that ("${example}")`)
    return out
  },

  initial(config) {
    return config.task === 'meander' ? { site: `o${bendIndex(config)}`, t: 0, run: 0 } : { groynes: [], t: 0, run: 0 }
  },

  check(config, state) {
    return { ok: done(config, state), wrongIds: done(config, state) ? [] : [config.task === 'meander' ? 'house' : 'hotel'] }
  },

  solve(config) {
    if (config.task === 'meander') {
      const flow = flowOf(config)
      const safe = SITES.find((s) => s.bend === bendIndex(config) && lostAt(flow, s.id) === null) ?? SITES.find((s) => lostAt(flow, s.id) === null)!
      return { site: safe.id, t: TMAX, run: 1 }
    }
    const from = fromOf(config)
    const k = hotelBay(config)
    return { groynes: [from === 'left' ? k + 1 : k], t: TMAX, run: 1 }
  },

  View: RiverCoastView,

  prompt: `SCENE "river-coast" -- water doing its work, shown happening, on a quiet light panel. Two tasks, both run on a Years clock with a stepper (and the picture replays by itself after each move).
  For: how a river meanders (erosion on the outside of bends, deposition on the inside, bends that grow and slide downstream) and how longshore drift moves pebbles along a coast and how groynes stop it. It answers "the water is fastest on the inside of a bend", "meanders stay where they are" and "sediment moves in a straight line along the shore". Use it for rivers and coasts, never for waves as physics (the waves scene), plate tectonics, tides or ocean currents.
  meander: a river winds across a green floodplain with a fast dark thread of water, sand building on the slow inside of the bends and a brown cut bank where it eats the outside. A house stands on one of six numbered plots. The learner taps a plot to move the house and runs the years forward (0 to 200, in 50s); the bends swing wider and slide downstream, and the house is tipped into the river if the water reaches it. They find the plot the river never reaches. flow: "steady" or "fast" (the bends grow faster). bend: "first", "second" or "third" (the plot the house starts on, which is always one the river reaches).
  drift: a beach seen from above, sea at the top with slanted wave crests, ten pebbles that zigzag along the shore (up the beach at an angle with each swash, straight back down with each backwash) and a hotel at the back. Four dotted lines across the beach are places for a groyne (a timber wall into the sea): tap one to build it, tap again to take it up. Pebbles pile against a groyne on the side they come from, and the beach beyond it loses sand. The Years clock (0 to 20, in 5s) shows each bay's beach thicken or thin. from: "left" or "right", the side the waves come from. hotel: "left", "middle" or "right", where the hotel stands. The learner finds where a groyne keeps the hotel beach thick.
  Not drawn: waterfalls, gorges, ox-bow lakes, deltas, river cross-sections, cliffs, wave-cut platforms, seawalls, tides, storms. Do not use it for waves, tectonics, drainage basins, the water cycle, flooding or river pollution.
  Before marking the card shows the moving water or pebbles, the beach or river as it is at the chosen year, and the house or groynes as placed; it names Fast water, Sand, Groyne, Pebble, House, Hotel and Flow, and numbers the plots. It does not say which side of a bend is eroded, which side of the hotel to build on, or whether the house is safe: marking says. The prompt must ask for the outcome only: do NOT say outside or inside of the bend, the fast water or deposition, which plot, the side the waves come from, upstream or downstream, how many groynes, or "next to the hotel".
  config: { "task":"meander", "flow":"steady", "bend":"first" }  -- the prompt says "Tap a numbered plot to move the house there, and press the plus on Years to run the river forward. Choose a plot where the house is still on dry land after 200 years."
       or { "task":"drift", "from":"left", "hotel":"middle" }  -- the prompt says "Tap a dotted line to build a groyne there, and tap it again to take it away. Keep the beach in front of the hotel thick with sand for the next 20 years."
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Tap a numbered plot to move the house there, and press the plus on Years to run the river forward. Choose a plot where the house is still on dry land after 200 years.",
    "payload": { "engine":"river-coast", "config": { "task":"meander", "flow":"steady", "bend":"first" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:river-coast", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Tap a dotted line to build a groyne there, and tap it again to take it away. Keep the beach in front of the hotel thick with sand for the next 20 years.",
    "payload": { "engine":"river-coast", "config": { "task":"drift", "from":"left", "hotel":"middle" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:river-coast", "why":"..." } }`,
}

registerEngine(riverCoastEngine as SceneEngine<unknown, unknown>)
