// lib/studylab/engines/solids-nets/config.ts
//
// Card you can fold, and a solid you can stack. Two tasks, one idea: a solid is made of its faces and layers.
//   fold    -- a card net of a cube lies flat with one square loose. Tap a dotted outline to stick the loose square
//              down somewhere else, then pull the Fold slider to bend the card up around a cube and see whether it
//              closes. A net that does not work folds with two squares on top of each other and a face left open;
//   extrude -- a flat shape of unit squares is pulled out into a prism, one layer at a time. The learner sets how many
//              layers (how long) until the prism holds the volume asked for.
//
// The rules, all computed here and never read from the drawing:
//   fold: the card is rolled over like a die. The face that touches the table under each square is the cube face that
//         square lands on. The net works exactly when the six squares land on six different faces. The view bends the
//         card with real hinge rotations, and a test proves the two agree for every position the learner can reach.
//   extrude: volume = (squares in the cross-section) x (layers), counted from the cell list.
//
// Facts: a cube has 11 different nets (35 hexominoes, 11 of them fold) -- the classic count (e.g. Wikipedia "Net
// (polyhedron)", Polypad "Nets of a cube"); the five nets used here come from the 1-4-1, 2-3-1, 2-2-2 and 3-3 families
// and are re-verified by the test. Volume of a prism = area of the cross-section x length is the textbook rule.
//
// Ideas taken, never code or art:
//   - the slider from flat card to folded solid, with numbered faces you can follow (mysimulator "Polyhedron Nets");
//   - "any six squares make a cube" is the misconception to meet (Polypad "Nets of a cube", Amplify): the net has to be
//     tried, so the fold slider is the test, and a failure shows overlapping squares and a gap;
//   - volume as layers of the cross-section (the layer idea from classroom prism lessons: Oak National Academy "volume
//     of prisms", GCSE notes) -- the usual slip is stopping at the cross-section's area or multiplying every length;
//   - the tutoring papers on net folding (MERGA 2016, ED572353; Polydron studies) found learners predict badly by
//     eye, so the card lets the hand try.
// Refused:
//   - cuboid, pyramid and prism nets: each needs its own fold geometry and its own rule, and a half-right set of nets
//     would teach wrongly. Cube only for folding for now;
//   - rotating the solid, slicing it, and surface area: a surface-area task needs the same card with measured sides;
//   - triangular and curved cross-sections: their layers have no whole count of unit squares.

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { SolidsNetsView } from './View'

export type Cell = [number, number]
/** One square of the card: its grid cell, the number printed on it, and whether it is the loose one. */
export type Square = { r: number; c: number; n: number; loose: boolean }

export type SolidsConfig =
  /** net: the family the card was cut from. A word outside the list still parses, and faults says what would work. */
  | { task: 'fold'; solid: string; net: string }
  /** volume: the cubic units to fill. A section outside the list still parses. */
  | { task: 'extrude'; section: string; volume: number | null; unit: string; width: number; height: number }

/** fold: where the loose square is stuck down; extrude: how many layers have been pulled out. */
export type SolidsState = { at?: Cell; len?: number }

// ---------------------------------------------------------------------------
// The cards. Five squares stay put; the sixth is loose. Every position is a grid cell (row, column), row down.
// Each card is one of the 11 cube nets with one leaf square lifted off, and the loose square set down where it fails.

export const NET_NAMES = ['cross', 'row', 'steps', 'stairs', 'two rows'] as const
export type NetName = (typeof NET_NAMES)[number]

type Card = { base: Cell[]; start: Cell }
/** The five fixed squares, numbered 1 to 5 in this order, and where the loose one (number 6) starts. */
export const CARDS: Record<NetName, Card> = {
  cross: { base: [[1, 0], [1, 1], [1, 2], [1, 3], [0, 1]], start: [0, 2] },
  row: { base: [[1, 0], [1, 1], [1, 2], [1, 3], [0, 0]], start: [1, 4] },
  steps: { base: [[0, 0], [0, 1], [1, 1], [1, 2], [1, 3]], start: [0, 2] },
  stairs: { base: [[0, 0], [0, 1], [1, 1], [1, 2], [2, 2]], start: [2, 1] },
  'two rows': { base: [[0, 1], [0, 2], [1, 2], [1, 3], [1, 4]], start: [1, 1] },
}

const has = (o: object, k: string | number) => Object.prototype.hasOwnProperty.call(o, k)
const same = (a: Cell, b: Cell) => a[0] === b[0] && a[1] === b[1]
const DIRS: Cell[] = [[-1, 0], [0, 1], [1, 0], [0, -1]]

export function cardOf(config: SolidsConfig): Card {
  return config.task === 'fold' && has(CARDS, config.net) ? CARDS[config.net as NetName] : CARDS.cross
}

/** Every empty cell the loose square could be stuck to: one that shares an edge with a fixed square. */
export function spotsOf(card: Card): Cell[] {
  const out: Cell[] = []
  for (const [r, c] of card.base) {
    for (const [dr, dc] of DIRS) {
      const p: Cell = [r + dr, c + dc]
      if (!card.base.some((b) => same(b, p)) && !out.some((q) => same(q, p))) out.push(p)
    }
  }
  return out.sort((a, b) => a[0] - b[0] || a[1] - b[1])
}

/** Where the learner has stuck the loose square; anything that is not a real spot counts as the start. */
export function looseAt(config: SolidsConfig, state: SolidsState): Cell {
  const card = cardOf(config)
  const at = state?.at
  if (Array.isArray(at) && at.length === 2 && spotsOf(card).some((s) => s[0] === at[0] && s[1] === at[1])) return [at[0], at[1]]
  return card.start
}

export function squaresOf(config: SolidsConfig, state: SolidsState): Square[] {
  const card = cardOf(config)
  const at = looseAt(config, state)
  return [...card.base.map(([r, c], i) => ({ r, c, n: i + 1, loose: false })), { r: at[0], c: at[1], n: 6, loose: true }]
}

// ---------------------------------------------------------------------------
// Folding. One tree of hinges, used by both the rule and the drawing.

/** The tree the card folds along: from the middle fixed square outwards, each square hinged on the one it was reached from. */
export function treeOf(sq: Square[]): { root: number; order: number[]; parent: number[] } {
  const base = sq.filter((s) => !s.loose)
  const mr = base.reduce((a, s) => a + s.r + 0.5, 0) / base.length
  const mc = base.reduce((a, s) => a + s.c + 0.5, 0) / base.length
  let root = 0
  let best = Infinity
  sq.forEach((s, i) => {
    if (s.loose) return
    const d = Math.hypot(s.r + 0.5 - mr, s.c + 0.5 - mc)
    if (d < best - 1e-9) {
      best = d
      root = i
    }
  })
  const parent = sq.map(() => -1)
  const order = [root]
  const seen = new Set([root])
  for (let k = 0; k < order.length; k++) {
    const s = sq[order[k]]
    for (const [dr, dc] of DIRS) {
      const j = sq.findIndex((o, i) => !seen.has(i) && o.r === s.r + dr && o.c === s.c + dc)
      if (j >= 0) {
        seen.add(j)
        parent[j] = order[k]
        order.push(j)
      }
    }
  }
  return { root, order, parent }
}

/** Rolling a die over the card: the face under each square, 0..5 (top, bottom, north, south, east, west = 0..5). */
export function faceUnder(sq: Square[]): number[] {
  const { root, order, parent } = treeOf(sq)
  type Die = { T: number; B: number; N: number; S: number; E: number; W: number }
  const dies: Die[] = sq.map(() => ({ T: 0, B: 1, N: 2, S: 3, E: 4, W: 5 }))
  const out = sq.map(() => -1)
  out[root] = dies[root].B
  for (const i of order.slice(1)) {
    const d = dies[parent[i]]
    const s = sq[i]
    const p = sq[parent[i]]
    const n = { ...d }
    if (s.c > p.c) Object.assign(n, { B: d.E, E: d.T, T: d.W, W: d.B })
    else if (s.c < p.c) Object.assign(n, { B: d.W, W: d.T, T: d.E, E: d.B })
    else if (s.r < p.r) Object.assign(n, { B: d.N, N: d.T, T: d.S, S: d.B })
    else Object.assign(n, { B: d.S, S: d.T, T: d.N, N: d.B })
    dies[i] = n
    out[i] = n.B
  }
  return out
}

export type FoldReport = {
  ok: boolean
  /** Squares that land on the same face, as their numbers, e.g. [[2, 6]]. */
  stacked: number[][]
  /** Faces of the cube no square lands on. */
  open: number
  /** Number pairs that end up opposite each other, when it works. */
  opposite: number[][]
}

export function foldReport(sq: Square[]): FoldReport {
  const under = faceUnder(sq)
  const groups = new Map<number, number[]>()
  sq.forEach((s, i) => groups.set(under[i], [...(groups.get(under[i]) ?? []), s.n]))
  const stacked = [...groups.values()].filter((g) => g.length > 1).map((g) => g.slice().sort((a, b) => a - b)).sort((a, b) => a[0] - b[0])
  const open = 6 - groups.size
  const who = (face: number) => sq[under.indexOf(face)]?.n ?? 0
  const opposite = open === 0 ? [[0, 1], [2, 3], [4, 5]].map(([a, b]) => [who(a), who(b)].sort((x, y) => x - y)).sort((a, b) => a[0] - b[0]) : []
  return { ok: stacked.length === 0, stacked, open, opposite }
}

// --- The card in space (cell units: x along columns, y down the rows, z up off the table).

export type V3 = [number, number, number]
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k]

type Hinge = { p0: V3; e: V3; d: V3 }
/** Swing a point about a hinge: what is on the far side of the edge lifts off the table by `rad`. */
function swing(q: V3, h: Hinge, rad: number): V3 {
  const r = sub(q, h.p0)
  const a = dot(r, h.e)
  const u = dot(r, h.d)
  const w = r[2]
  const c = Math.cos(rad)
  const s = Math.sin(rad)
  // The hinge turns d into (c d + s z) and z into (-s d + c z).
  const dz: V3 = [h.d[0] * c, h.d[1] * c, s]
  const zz: V3 = [-h.d[0] * s, -h.d[1] * s, c]
  return add(add(add(h.p0, mul(h.e, a)), mul(dz, u)), mul(zz, w))
}

function hingeBetween(parent: Square, child: Square): Hinge {
  const { r, c } = child
  if (child.c > parent.c) return { p0: [c, r, 0], e: [0, 1, 0], d: [1, 0, 0] }
  if (child.c < parent.c) return { p0: [c + 1, r, 0], e: [0, 1, 0], d: [-1, 0, 0] }
  if (child.r > parent.r) return { p0: [c, r, 0], e: [1, 0, 0], d: [0, 1, 0] }
  return { p0: [c, r + 1, 0], e: [1, 0, 0], d: [0, -1, 0] }
}

export type Tab = { cell: number; poly: V3[] }
const TAB_H = 0.2
const TAB_S = 0.14

/** Edges of the card that stay open, where a glue tab sits: every other one, by a fixed pattern on the grid. */
export function tabsOf(sq: Square[]): { cell: number; a: V3; b: V3; out: V3 }[] {
  const out: { cell: number; a: V3; b: V3; out: V3 }[] = []
  sq.forEach((s, i) => {
    DIRS.forEach(([dr, dc], side) => {
      if (sq.some((o) => o.r === s.r + dr && o.c === s.c + dc)) return
      if ((s.r * 2 + s.c * 3 + side) % 2 !== 0) return
      const { r, c } = s
      const a: V3 = side === 0 ? [c, r, 0] : side === 1 ? [c + 1, r, 0] : side === 2 ? [c + 1, r + 1, 0] : [c, r + 1, 0]
      const b: V3 = side === 0 ? [c + 1, r, 0] : side === 1 ? [c + 1, r + 1, 0] : side === 2 ? [c, r + 1, 0] : [c, r, 0]
      out.push({ cell: i, a, b, out: [dc, dr, 0] })
    })
  })
  return out
}

export type Folded = { corners: V3[][]; tabs: Tab[] }

/** Where every corner of every square (and tab) sits when the card is bent `deg` degrees at each fold. */
export function foldGeometry(sq: Square[], deg: number): Folded {
  const { order, parent } = treeOf(sq)
  const rad = (deg * Math.PI) / 180
  const hinges: (Hinge | null)[] = sq.map((s, i) => (parent[i] < 0 ? null : hingeBetween(sq[parent[i]], s)))
  const place = (q: V3, cell: number): V3 => {
    let p = q
    for (let i = cell; i >= 0 && parent[i] >= 0; i = parent[i]) p = swing(p, hinges[i]!, rad)
    return p
  }
  void order
  const corners = sq.map((s, i) => ([[s.c, s.r, 0], [s.c + 1, s.r, 0], [s.c + 1, s.r + 1, 0], [s.c, s.r + 1, 0]] as V3[]).map((q) => place(q, i)))
  const tabs: Tab[] = tabsOf(sq).map((t) => {
    const e = sub(t.b, t.a)
    const along = mul(e, TAB_S)
    const flat: V3[] = [t.a, t.b, add(sub(t.b, along), mul(t.out, TAB_H)), add(add(t.a, along), mul(t.out, TAB_H))]
    const hinge: Hinge = { p0: t.a, e, d: t.out }
    return { cell: t.cell, poly: flat.map((q) => place(swing(q, hinge, rad), t.cell)) }
  })
  return { corners, tabs }
}

/** The cube face each square lands on when folded all the way, read from the geometry: equal centres are one face. */
export function geometricGroups(sq: Square[]): number[][] {
  const { corners } = foldGeometry(sq, 90)
  const key = (cs: V3[]) => {
    const m = cs.reduce((a, q) => add(a, q), [0, 0, 0] as V3)
    return mul(m, 0.25).map((x) => Math.round(x * 1000) / 1000).join(',')
  }
  const groups = new Map<string, number[]>()
  corners.forEach((cs, i) => groups.set(key(cs), [...(groups.get(key(cs)) ?? []), sq[i].n]))
  return [...groups.values()].filter((g) => g.length > 1).map((g) => g.slice().sort((a, b) => a - b)).sort((a, b) => a[0] - b[0])
}

// --- The projection: a view that lies straight over the flat card and swings round to look at the folded cube.

export type Look = { yaw: number; pitch: number; scale: number; cx: number; cy: number; target: V3 }
export const project = (p: V3, v: Look): { x: number; y: number; depth: number } => {
  const x = p[0] - v.target[0]
  const y = p[1] - v.target[1]
  const z = p[2] - v.target[2]
  const cy = Math.cos(v.yaw)
  const sy = Math.sin(v.yaw)
  const x1 = x * cy - y * sy
  const y1 = x * sy + y * cy
  return { x: v.cx + v.scale * x1, y: v.cy + v.scale * (y1 * Math.cos(v.pitch) - z * Math.sin(v.pitch)), depth: y1 * Math.sin(v.pitch) + z * Math.cos(v.pitch) }
}

// ---------------------------------------------------------------------------
// The prisms: a flat shape of unit squares, stacked into layers.

export const SECTIONS = ['rectangle', 'L', 'T', 'U', 'steps', 'plus'] as const
export type SectionName = (typeof SECTIONS)[number]
export const UNITS = ['cm', 'mm', 'm'] as const
export const LAYERS_MIN = 2
export const LAYERS_MAX = 10
export const SIDE_MIN = 1
export const SIDE_MAX = 4
export const DEFAULT_WIDTH = 3
export const DEFAULT_HEIGHT = 2

const SHAPES: Record<Exclude<SectionName, 'rectangle'>, Cell[]> = {
  L: [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]],
  T: [[0, 0], [0, 1], [0, 2], [1, 1], [2, 1]],
  U: [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2], [1, 2], [0, 2]],
  steps: [[2, 0], [2, 1], [2, 2], [1, 1], [1, 2], [0, 2]],
  plus: [[0, 1], [1, 0], [1, 1], [1, 2], [2, 1]],
}

/** The unit squares of the flat shape (row, column), row down. */
export function sectionCells(config: SolidsConfig): Cell[] {
  if (config.task !== 'extrude') return []
  if (has(SHAPES, config.section)) return SHAPES[config.section as Exclude<SectionName, 'rectangle'>]
  const w = Math.max(SIDE_MIN, Math.min(SIDE_MAX, Math.round(config.width)))
  const h = Math.max(SIDE_MIN, Math.min(SIDE_MAX, Math.round(config.height)))
  const out: Cell[] = []
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) out.push([r, c])
  return out
}

export const areaOf = (config: SolidsConfig) => sectionCells(config).length
/** The layers that fill the volume asked for; 0 when there is no whole number of them. */
export function layersFor(config: SolidsConfig): number {
  if (config.task !== 'extrude' || config.volume === null) return 0
  const a = areaOf(config)
  return a > 0 && config.volume % a === 0 ? config.volume / a : 0
}

export function layersOf(config: SolidsConfig, state: SolidsState): number {
  const n = state?.len
  return typeof n === 'number' && Number.isFinite(n) ? Math.max(1, Math.min(LAYERS_MAX, Math.round(n))) : 1
}

const cubed = (unit: string) => (unit === 'cm' ? 'cm³' : unit === 'mm' ? 'mm³' : unit === 'm' ? 'm³' : `${unit}³`)
const cubicWord = (unit: string) => (unit === 'cm' ? 'cubic centimetres' : unit === 'mm' ? 'cubic millimetres' : unit === 'm' ? 'cubic metres' : `cubic ${unit}`)

// ---------------------------------------------------------------------------
// Marking.

export function done(config: SolidsConfig, state: SolidsState): boolean {
  if (config.task === 'fold') return foldReport(squaresOf(config, state)).ok
  return layersFor(config) > 0 && layersOf(config, state) === layersFor(config)
}

const list = (nums: number[]) => (nums.length === 2 ? `${nums[0]} and ${nums[1]}` : `${nums.slice(0, -1).join(', ')} and ${nums[nums.length - 1]}`)

/** What a correct card says: what the learner found, and the idea behind it. */
export function working(config: SolidsConfig, state: SolidsState): string {
  if (config.task === 'fold') {
    const r = foldReport(squaresOf(config, state))
    const pairs = r.opposite.map((p) => `${p[0]} and ${p[1]}`).join(', ')
    return `Yes. It folds into a closed cube: all six squares land on different faces. Opposite faces here are ${pairs}. Squares that touch along a fold are neighbours on the cube, and no square ever sits next to the one opposite it.`
  }
  const a = areaOf(config)
  const n = layersOf(config, state)
  const unit = config.unit
  return `Yes. One layer holds ${a} cubes, and ${n} layers hold ${a} × ${n} = ${a * n} ${cubed(unit)}. The volume of a prism is the area of its cross-section times its length.`
}

/** What a wrong card says: what the learner made, never where the answer is. */
export function madeText(config: SolidsConfig, state: SolidsState): string {
  if (config.task === 'fold') {
    const r = foldReport(squaresOf(config, state))
    if (r.ok) return ''
    const stack = r.stacked.map((g) => `Squares ${list(g)} land on the same face`).join(', and ')
    return `${stack}, so ${r.open === 1 ? 'one face' : `${r.open} faces`} of the cube ${r.open === 1 ? 'is' : 'are'} left open.`
  }
  const a = areaOf(config)
  const n = layersOf(config, state)
  const want = config.volume ?? 0
  const held = a * n
  const unit = cubed(config.unit)
  const tail = held < want ? 'That is less than the volume asked for.' : 'That is more than the volume asked for.'
  return `${n} ${n === 1 ? 'layer' : 'layers'} of ${a} cubes ${n === 1 ? 'holds' : 'hold'} ${a} × ${n} = ${held} ${unit}. ${tail}`
}

// ---------------------------------------------------------------------------
// Reading the tutor's config.

const keyOf = (raw: unknown) => (typeof raw === 'string' ? raw.trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : '')
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)

const TASK_WORDS: Record<string, 'fold' | 'extrude'> = {
  fold: 'fold', folding: 'fold', net: 'fold', nets: 'fold', 'cube-net': 'fold', 'cube-nets': 'fold', 'net-of-a-cube': 'fold', 'nets-of-a-cube': 'fold', unfold: 'fold', mend: 'fold', fix: 'fold', 'fix-the-net': 'fold', 'mend-the-net': 'fold', 'fold-the-net': 'fold', 'fold-net': 'fold', make: 'fold', cube: 'fold',
  extrude: 'extrude', volume: 'extrude', prism: 'extrude', prisms: 'extrude', layers: 'extrude', layer: 'extrude', stack: 'extrude', 'volume-of-a-prism': 'extrude', 'volume-of-prisms': 'extrude', 'cross-section': 'extrude', 'cross-sections': 'extrude', 'fill-the-prism': 'extrude', 'build-a-prism': 'extrude', fill: 'extrude', length: 'extrude',
}

const NET_WORDS: Record<string, NetName> = {
  cross: 'cross', 'latin-cross': 'cross', '1-4-1': 'cross', 't': 'cross', plus: 'cross', 'long-cross': 'cross',
  row: 'row', strip: 'row', 'row-of-four': 'row', 'four-in-a-row': 'row', line: 'row', train: 'row',
  steps: 'steps', step: 'steps', '2-3-1': 'steps', 'three-in-a-row': 'steps',
  stairs: 'stairs', staircase: 'stairs', stair: 'stairs', '2-2-2': 'stairs', zigzag: 'stairs', 'zig-zag': 'stairs',
  'two-rows': 'two rows', 'two-row': 'two rows', '3-3': 'two rows', 'two-rows-of-three': 'two rows', 'offset-rows': 'two rows', 'double-row': 'two rows',
}

const SECTION_WORDS: Record<string, SectionName> = {
  rectangle: 'rectangle', rect: 'rectangle', rectangular: 'rectangle', cuboid: 'rectangle', box: 'rectangle', block: 'rectangle', square: 'rectangle', bar: 'rectangle', slab: 'rectangle', oblong: 'rectangle',
  l: 'L', 'l-shape': 'L', 'l-shaped': 'L', 'l-prism': 'L', 'corner': 'L', 'angle': 'L',
  t: 'T', 't-shape': 'T', 't-shaped': 'T', 't-prism': 'T',
  u: 'U', 'u-shape': 'U', 'u-shaped': 'U', 'u-prism': 'U', channel: 'U',
  steps: 'steps', step: 'steps', stairs: 'steps', staircase: 'steps', stepped: 'steps', 'step-shape': 'steps',
  plus: 'plus', cross: 'plus', 'plus-shape': 'plus', 'cross-shape': 'plus', 'cross-shaped': 'plus',
}

const nearestNet = 'cross'

function readNet(raw: unknown): string {
  const key = keyOf(raw).replace(/(?:-(?:net|nets|shape))+$/, '').replace(/^(?:a|an|the)-/, '')
  return has(NET_WORDS, key) ? NET_WORDS[key] : key
}

function readSection(raw: unknown): string {
  const key = keyOf(raw).replace(/-?(?:prism|section|cross-section)$/, '').replace(/^(?:a|an|the)-/, '')
  return has(SECTION_WORDS, key) ? SECTION_WORDS[key] : key
}

function readNumber(raw: unknown): number | null {
  const v = typeof raw === 'string' && raw.trim() !== '' ? Number(raw.trim().replace(/[a-z³3²2\s]+$/i, '').replace(/,/g, '')) : raw
  return typeof v === 'number' && Number.isFinite(v) ? v + 0 : null
}

function readUnit(raw: unknown): string | null {
  if (raw === undefined) return null
  if (typeof raw !== 'string') return null
  const t = raw.trim().toLowerCase().replace(/[³3²2^]+$/, '').replace(/\s+/g, '')
  const map: Record<string, string> = { cm: 'cm', centimetre: 'cm', centimetres: 'cm', centimeter: 'cm', centimeters: 'cm', mm: 'mm', millimetre: 'mm', millimetres: 'mm', m: 'm', metre: 'm', metres: 'm', meter: 'm', meters: 'm' }
  return has(map, t) ? map[t] : t || null
}

const goodFold = (config: Extract<SolidsConfig, { task: 'fold' }>) => `Move the orange square so the net folds into a cube. Tap a dotted outline to stick the square there, then pull the Fold slider to bend the card up and test it.`
const goodExtrude = (config: Extract<SolidsConfig, { task: 'extrude' }>) => `Add layers until the prism holds ${config.volume ?? 30} ${cubicWord(config.unit)}. Tap + to add a layer and − to take one away.`

export const solidsNetsEngine: SceneEngine<SolidsConfig, SolidsState> = {
  id: 'solids-nets',
  // Distinctive words only: `sceneCatalogue` matches any single word of a topic, so "solids" or "nets" here would catch
  // chemistry's solids and "net force". Everything common is a whole phrase.
  covers: ['polyhedra', 'cuboids'],
  phrases: [
    'nets of 3d shapes', 'nets of solids', 'nets of solid shapes', 'nets of cubes', 'nets of a cube', 'cube nets', 'net of a cube', 'nets of prisms', 'nets and solids', 'solids and nets', '3d shapes and nets', 'folding nets', 'nets and 3d shapes', 'drawing nets',
    'solid shapes', 'three dimensional shapes', 'three dimensional objects', 'properties of 3d shapes', 'properties of solids', 'properties of solid shapes', 'naming 3d shapes', 'faces edges and vertices', 'faces edges vertices', 'faces and edges', 'edges and vertices',
    'volume of prisms', 'volume of a prism', 'volume of prism', 'volume of a cuboid', 'volume of cuboids', 'volume of a cube', 'volume of cubes', 'volume of solids', 'volume of 3d shapes', 'volume of solid shapes', 'cross sections of prisms', 'cross section of a prism', 'prisms and cylinders', 'volume of prisms and cylinders', 'volume and capacity', 'finding volume', 'counting cubes', 'volume by counting cubes', 'layers of cubes',
    'surface area and volume of prisms', 'surface area and volume of cuboids', 'surface area of prisms', 'surface area of a cuboid', 'surface area of cuboids', 'surface area of a cube',
  ],
  // Near misses: "nets", "solids" and "prism" in other subjects, and volume that is not a stack of layers.
  notFor: [
    'net force', 'net forces', 'net profit', 'net income', 'net charge', 'net worth', 'net present value', 'net pay', 'net migration', 'net movement', 'net primary productivity', 'net gain', 'net loss', 'net cash flow', 'net assets',
    'fishing nets', 'fishing net', 'mist nets', 'safety net', 'cargo net', 'net zero', 'net ionic', 'net ionic equation', 'internet',
    'glass prism', 'glass prisms', 'light prism', 'prism spectrum', 'dispersion of light', 'dispersion by a prism', 'refraction through a prism', 'triangular prism light',
    'solids liquids and gases', 'states of matter', 'solid state', 'solid solubility', 'ionic solids', 'giant structures', 'solid waste', 'solids in solution', 'dissolving solids',
    'surface area to volume ratio', 'surface area volume ratio', 'surface area to volume', 'sa vol', 'cell size', 'cell surface area', 'volume of gases', 'volume of a gas', 'molar volume', 'volume of liquids', 'volume of solutions', 'gas volume', 'volume of gas', 'volume of water', 'liquid volume', 'measuring volume', 'measuring cylinder', 'volume and mass', 'mass and volume', 'density', 'concentration',
    'cylinders', 'cones', 'spheres', 'pyramids', 'volume of a cylinder', 'volume of cylinders', 'volume of a cone', 'volume of a sphere', 'volume of a pyramid', 'compound solids', 'frustum',
    'orthographic projection', 'plans and elevations', 'isometric drawing', 'technical drawing',
  ],
  // The learner decides how the pieces join: the card's structure, then the prism's layers.
  isolates: 'structure',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const nested = o.task && typeof o.task === 'object' ? (o.task as Record<string, unknown>) : null
    const src = nested ?? o
    const rawTask = first(src, nested ? ['kind', 'task', 'type'] : ['task', 'kind', 'type', 'mode'])
    const word = keyOf(rawTask)
    const rawVolume = first(src, ['volume', 'target', 'capacity', 'cubes'])
    const rawSection = first(src, ['section', 'crossSection', 'cross_section', 'shape', 'profile', 'base', 'prism'])
    const rawNet = first(src, ['net', 'from', 'family', 'start', 'card'])
    const task = word ? (has(TASK_WORDS, word) ? TASK_WORDS[word] : null) : rawVolume !== undefined || (rawSection !== undefined && rawNet === undefined) ? 'extrude' : 'fold'
    if (!task) return null
    if (task === 'fold') {
      const solid = first(src, ['solid', 'shape', 'object'])
      if (solid !== undefined && typeof solid !== 'string') return null
      if (rawNet !== undefined && typeof rawNet !== 'string') return null
      return { task, solid: solid === undefined ? 'cube' : keyOf(solid).replace(/^(?:a|an|the)-/, ''), net: rawNet === undefined ? nearestNet : readNet(rawNet) }
    }
    if (rawSection !== undefined && typeof rawSection !== 'string') return null
    const section = rawSection === undefined ? 'rectangle' : readSection(rawSection)
    const volume = rawVolume === undefined ? null : readNumber(rawVolume)
    const unitRaw = first(src, ['unit', 'units'])
    const unit = readUnit(unitRaw) ?? (typeof rawVolume === 'string' ? readUnit(rawVolume.replace(/^[\d.,\s]+/, '').replace(/cubic\s+/i, '')) : null) ?? 'cm'
    const width = readNumber(first(src, ['width', 'w', 'base'])) ?? DEFAULT_WIDTH
    const height = readNumber(first(src, ['height', 'h', 'depth'])) ?? DEFAULT_HEIGHT
    return { task, section, volume, unit: unit === '' ? 'cm' : unit, width, height }
  },

  faults(config) {
    const out: string[] = []
    if (config.task === 'fold') {
      if (config.solid !== 'cube') out.push(`Only the cube is folded here, not a ${config.solid}: use solid "cube", e.g. { "task":"fold", "net":"cross" }.`)
      if (!has(CARDS, config.net)) out.push(`There is no "${config.net}" card: use one of ${NET_NAMES.map((n) => `"${n}"`).join(', ')}, e.g. net "cross".`)
      return out
    }
    if (!(SECTIONS as readonly string[]).includes(config.section)) out.push(`There is no "${config.section}" cross-section: use one of ${SECTIONS.join(', ')}, e.g. section "L".`)
    if (!(UNITS as readonly string[]).includes(config.unit)) out.push(`The unit "${config.unit}" is not drawn: use cm, mm or m, e.g. unit "cm".`)
    if (config.section === 'rectangle') {
      for (const [name, v] of [['width', config.width], ['height', config.height]] as const) {
        if (!Number.isInteger(v) || v < SIDE_MIN || v > SIDE_MAX) out.push(`The ${name} ${v} is not a whole number of squares from ${SIDE_MIN} to ${SIDE_MAX}: use e.g. ${name} ${name === 'width' ? DEFAULT_WIDTH : DEFAULT_HEIGHT}.`)
      }
    }
    const a = areaOf(config)
    if (config.volume === null) {
      out.push(`No volume to aim for: give the cubic units to fill, e.g. volume ${a * 4}.`)
    } else if (!Number.isInteger(config.volume)) {
      out.push(`The volume ${config.volume} is not a whole number of cubes: use e.g. volume ${a * 4}.`)
    } else if (a > 0) {
      const k = config.volume / a
      if (!Number.isInteger(k)) {
        const lo = Math.max(LAYERS_MIN, Math.floor(k)) * a
        out.push(`The volume ${config.volume} does not fill whole layers of this shape (each layer holds ${a} cubes): use e.g. volume ${lo} or ${lo + a}.`)
      } else if (k < LAYERS_MIN || k > LAYERS_MAX) {
        out.push(`The volume ${config.volume} is ${k} layers of this shape, outside ${LAYERS_MIN} to ${LAYERS_MAX} (each layer holds ${a} cubes): use e.g. volume ${a * 4}.`)
      }
    }
    return out
  },

  promptFaults(config, prompt) {
    const text = prompt.replace(/\s+/g, ' ')
    const out: string[] = []
    if (config.task === 'fold') {
      const example = goodFold(config)
      const where = /\b(?:move|put|place|stick|slide|attach|join|glue|fix)\b[^.?!]*\b(?:above|below|beside|next to|left|right|top|bottom|end|under|over|corner|column|row|edge|side|middle)\b|\bsquare\s*\d\b|\b(?:first|second|third|fourth|fifth|sixth)\s+square\b|\bwhich square\b|overlap|\b(?:on top of each other|gap|hole|open face|left open|stack)\b|\b(?:six|6)\s+squares\b/i.test(text)
      if (where) out.push(`the prompt gives the answer away: it says where the square goes, or what a bad net does, which the learner is to find by folding -- ask for the outcome only ("${example}")`)
      if (/\bdrag\b|\brotate\b|\bspin\b|\bturn\b|\bflip\b|\bcut\b|\bscissors\b|\bglue\b|\bdraw\b|\bcolou?r\b|\bsurface area\b|\bvolume\b|\bpyramid|\bcuboid|\bprism/i.test(text)) {
        out.push(`the prompt promises something the card does not show: the learner only taps a dotted outline to stick the orange square down, and pulls the Fold slider -- ask for that ("${example}")`)
      }
      if (!/\b(?:tap|click|press|slider)\b/i.test(text)) out.push(`the prompt must say the gesture: tap a dotted outline to move the square and pull the Fold slider ("${example}")`)
      return out
    }
    const example = goodExtrude(config)
    const nums = [...text.matchAll(/(\d+(?:\.\d+)?)\s*(?:cm|mm|m|cubic|units?|cubes?|layers?|slices?|squares?|long|deep)\b/gi)].map((m) => Number(m[1]))
    const target = config.volume ?? 0
    const said = text.includes(String(target)) || nums.includes(target)
    if (!said && target) out.push(`the prompt must say the volume to aim for (${target} ${cubicWord(config.unit)}), because the card does not print it ("${example}")`)
    const wrongNumber = [...text.matchAll(/(\d+(?:\.\d+)?)\s*(?:cm|mm|m|cubic|cubes?)\b/gi)].some((m) => Number(m[1]) !== target)
    if (wrongNumber) out.push(`the prompt gives a number that is not the volume ${target}: the learner finds the layers, so name only the volume ("${example}")`)
    if (/\b\d+\s*(?:layers?|slices?|long|deep|lengths?)\b|\blength\s+(?:of\s+)?\d|\b(?:multipl|divid|times|formula|per layer|each layer|area of the|cross-?section(?:'s|al)? area|cross-?section area)\b|[×÷*]/i.test(text)) {
      out.push(`the prompt gives the answer away: it says how many layers, or how to work it out, which the learner is to find by building -- ask for the volume only ("${example}")`)
    }
    if (/\bdrag\b|\brotate\b|\bspin\b|\bslice\b|\bcut\b|\bnet\b|\bfold\b|\bsurface area\b|\bpaint\b|\bcylinder|\bpyramid|\btriangular/i.test(text)) {
      out.push(`the prompt promises something the card does not show: it stacks layers of unit squares with + and −, and shows no net, slice or surface area -- ask for that ("${example}")`)
    }
    if (!/\b(?:tap|click|press)\b|[+−-]\s*(?:to|and)/i.test(text) && !/\badd\b/i.test(text)) out.push(`the prompt must say the gesture: tap + to add a layer ("${example}")`)
    return out
  },

  initial(config) {
    return config.task === 'fold' ? { at: cardOf(config).start } : { len: 1 }
  },

  check(config, state) {
    return { ok: done(config, state), wrongIds: [] }
  },

  solve(config) {
    if (config.task === 'extrude') return { len: layersFor(config) || LAYERS_MIN }
    const card = cardOf(config)
    const at = spotsOf(card).find((s) => foldReport([...card.base.map(([r, c], i) => ({ r, c, n: i + 1, loose: false })), { r: s[0], c: s[1], n: 6, loose: true }]).ok)
    return { at: at ?? card.start }
  },

  View: SolidsNetsView,

  prompt: `SCENE "solids-nets" -- two cards on a quiet light panel, drawn like real card.
  fold: a flat card net of a cube lies on the table, with the fold lines dashed and glue tabs on the open edges. Six squares are printed 1 to 6; five are card-coloured and fixed, and one (6) is orange and loose. Each place the loose square could be stuck down is a dotted outline: the learner taps one and the square jumps there. A Fold slider under the picture then bends the whole card up around a cube, so they can test it. The picture is the proof: a net that works closes into a cube; one that does not folds with two squares on top of each other and a face left open. Every fold is a real hinge rotation, and marking uses the same rule (a die rolled over the card): the six squares must land on six different faces. The loose square must be moved before folding again; unfolding the slider shows the dotted outlines.
  net: cross, row, steps, stairs or two rows -- which family of cube nets the card was cut from (1-4-1 with a top and bottom square, a long row, 2-3-1, 2-2-2, or 3-3). The loose square always starts where it fails, and several places work. solid: "cube" (optional; only the cube is folded).
  extrude: a flat shape of unit squares is pulled into a prism, layer by layer, drawn in oblique view with each layer visible. The learner steps the length (1 to 10 layers) with + and − until the prism holds the volume asked for. The card prints the learner's own length ("Length 4 cm") and a "1 cm" mark on one square, never the volume or the cross-section's area. section: rectangle (width, height, 1 to 4 squares each, default 3 by 2), L (5 squares), T (5), U (7), steps (6) or plus (5). volume: the cubic units to fill; it must be a whole number of layers, 2 to 10 layers of the shape, e.g. L: 10, 15, 20 ... 50. unit: cm, mm or m, default cm.
  For: nets of 3D shapes and cubes, folding, faces edges and vertices of a cube, volume of prisms and cuboids as layers of the cross-section. It answers "any six squares fold into a cube" and "volume is length times width times height for every prism". Marking says which squares land on the same face, or what the learner's layers hold.
  Not drawn: nets of cuboids, pyramids or triangular prisms, rotating the solid, slicing, surface area, cylinders, cones, curved or triangular cross-sections, orthographic views.
  Before marking the card shows the net, its numbers and the fold, or the layers and the learner's length. It holds back whether the net works and the volume and layer count. The prompt must say the gesture and the aim only: do NOT say where the loose square goes, which square, or that squares overlap or a face is left open; and do NOT say how many layers, the length, the area of the cross-section, or to multiply.
  config: { "task":"fold", "net":"cross" }  -- the prompt says "Move the orange square so the net folds into a cube. Tap a dotted outline to stick the square there, then pull the Fold slider to bend the card up and test it."
       or { "task":"extrude", "section":"L", "volume":30, "unit":"cm" }  -- the prompt says "Add layers until the prism holds 30 cubic centimetres. Tap + to add a layer and − to take one away."
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Move the orange square so the net folds into a cube. Tap a dotted outline to stick the square there, then pull the Fold slider to bend the card up and test it.",
    "payload": { "engine":"solids-nets", "config": { "task":"fold", "net":"cross" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"structure", "apparatus":"scene:solids-nets", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Add layers until the prism holds 30 cubic centimetres. Tap + to add a layer and − to take one away.",
    "payload": { "engine":"solids-nets", "config": { "task":"extrude", "section":"L", "volume":30, "unit":"cm" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"structure", "apparatus":"scene:solids-nets", "why":"..." } }`,
}

registerEngine(solidsNetsEngine as SceneEngine<unknown, unknown>)
