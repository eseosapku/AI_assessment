// lib/studylab/engines/symmetry/config.ts
//
// Symmetry with the two things a class does with its hands: fold a shape cut from card, and turn a tracing of it.
//   fold -- tap two dots (corners and middles of sides) and the card folds along the line between them. The folded
//           part lands in the card's paler back colour: on a line of symmetry it covers the rest exactly, anywhere else
//           corners stick out and colour peeks out from under it. The learner draws every line that fits, or says it
//           has none.
//   turn -- a tracing of the shape, on tracing paper pinned at its centre, with a red dot traced at one corner. The
//           learner turns it one full turn and marks the card under the red dot each time the tracing fits. The marks
//           land where the corners are, and the mark at the end of the full turn falls on the first, so the start is
//           never counted twice. Every shape gets at least one mark: the order is never 0.
//
// The rules, all computed here from the shape's corners and never read from the drawing:
//   a fold line is a line of symmetry exactly when reflecting every corner in it lands on a corner;
//   the tracing fits after a turn exactly when turning every corner about the centre lands on a corner;
//   the facts table below (sources: Save My Exams and Third Space Learning symmetry tables, Cambridge IGCSE 0580 notes)
//   is checked against both rules in the tests.
//
// Ideas taken, never code or art: the fold test and "draw the line with a ruler" (every primary scheme); tracing paper
// pinned at the centre, with "an arrow on the tracing so you can tell when you have turned it through 360 degrees" (Flip
// Education's activity notes); "take care not to count the starting point twice" (Oak National Academy, Rotational
// symmetry, KS3). The misconceptions designed against: a rectangle's diagonals, a parallelogram's lines, order 0, the
// start counted twice, and lines confused with order.
// Left for later: completing a picture across a mirror line on squared paper, letters, planes of symmetry in solids.

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { SymmetryView } from './View'

export const SHAPES = [
  'square', 'rectangle', 'rhombus', 'parallelogram', 'kite', 'isosceles trapezium', 'trapezium',
  'equilateral triangle', 'isosceles triangle', 'right-angled isosceles triangle', 'right-angled triangle', 'scalene triangle',
  'regular pentagon', 'regular hexagon', 'regular octagon',
] as const
export type ShapeName = (typeof SHAPES)[number]
export const TASKS = ['fold', 'turn'] as const
export type SymTask = (typeof TASKS)[number]

/** shape: a word outside the list still parses, and faults says what would work. */
export type SymConfig = { task: SymTask; shape: string }
/** fold: the lines drawn, as landmark pairs ("c1-c3"), and whether the learner said it has none. turn: the marks, in degrees. */
export type SymState = { lines?: string[]; none?: boolean; marks?: number[] }

export type Pt = { x: number; y: number }

/** How many lines of symmetry, and the order of rotational symmetry: the textbook facts. */
export const FACTS: Record<ShapeName, { lines: number; order: number }> = {
  square: { lines: 4, order: 4 },
  rectangle: { lines: 2, order: 2 },
  rhombus: { lines: 2, order: 2 },
  parallelogram: { lines: 0, order: 2 },
  kite: { lines: 1, order: 1 },
  'isosceles trapezium': { lines: 1, order: 1 },
  trapezium: { lines: 0, order: 1 },
  'equilateral triangle': { lines: 3, order: 3 },
  'isosceles triangle': { lines: 1, order: 1 },
  'right-angled isosceles triangle': { lines: 1, order: 1 },
  'right-angled triangle': { lines: 0, order: 1 },
  'scalene triangle': { lines: 0, order: 1 },
  'regular pentagon': { lines: 5, order: 5 },
  'regular hexagon': { lines: 6, order: 6 },
  'regular octagon': { lines: 8, order: 8 },
}

const around = (n: number, start: number): [number, number][] =>
  Array.from({ length: n }, (_, k) => {
    const a = ((start + (360 * k) / n) * Math.PI) / 180
    return [Math.cos(a), Math.sin(a)]
  })

/** Each shape's corners in its own units, y down. Proportions chosen so no shape is nearly another (a rectangle 1.6 : 1). */
const RAW: Record<ShapeName, [number, number][]> = {
  square: [[-1, -1], [1, -1], [1, 1], [-1, 1]],
  rectangle: [[-1.6, -1], [1.6, -1], [1.6, 1], [-1.6, 1]],
  // Sides of 2, angles 60 and 120 degrees, the top and bottom level, as books draw it.
  rhombus: [[-1.5, -Math.sqrt(3) / 2], [0.5, -Math.sqrt(3) / 2], [1.5, Math.sqrt(3) / 2], [-0.5, Math.sqrt(3) / 2]],
  parallelogram: [[-1, -0.8], [1.6, -0.8], [1, 0.8], [-1.6, 0.8]],
  kite: [[0, -1.2], [1, 0], [0, 2], [-1, 0]],
  'isosceles trapezium': [[-0.9, -0.8], [0.9, -0.8], [1.6, 0.8], [-1.6, 0.8]],
  trapezium: [[-1.4, -0.9], [0.6, -0.9], [1.4, 0.9], [-1.4, 0.9]],
  'equilateral triangle': around(3, -90),
  'isosceles triangle': [[0, -1.4], [1, 1], [-1, 1]],
  'right-angled isosceles triangle': [[-1, -1], [1, 1], [-1, 1]],
  // Sides 3, 4 and 5.
  'right-angled triangle': [[-1, -0.75], [1, 0.75], [-1, 0.75]],
  // Angles of about 63, 38 and 79 degrees: plainly no two sides alike.
  'scalene triangle': [[-0.7, -1], [1.6, 0.8], [-1.6, 0.8]],
  'regular pentagon': around(5, -90),
  'regular hexagon': around(6, 0),
  'regular octagon': around(8, 22.5),
}

const has = (o: object, k: string | number) => Object.prototype.hasOwnProperty.call(o, k)
export const known = (shape: string): shape is ShapeName => has(FACTS, shape)
const shapeOf = (shape: string): ShapeName => (known(shape) ? shape : 'rectangle')

// ---------------------------------------------------------------------------
// Plain geometry.

const EPS = 1e-6
const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y })
const dot = (a: Pt, b: Pt) => a.x * b.x + a.y * b.y
const len = (a: Pt) => Math.hypot(a.x, a.y)

export function areaOf(poly: Pt[]): number {
  let s = 0
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]
    const q = poly[(i + 1) % poly.length]
    s += p.x * q.y - q.x * p.y
  }
  return s / 2
}

export function centroidOf(poly: Pt[]): Pt {
  let a = 0
  let cx = 0
  let cy = 0
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]
    const q = poly[(i + 1) % poly.length]
    const c = p.x * q.y - q.x * p.y
    a += c
    cx += (p.x + q.x) * c
    cy += (p.y + q.y) * c
  }
  if (Math.abs(a) < EPS) return { x: poly.reduce((s, p) => s + p.x, 0) / poly.length, y: poly.reduce((s, p) => s + p.y, 0) / poly.length }
  return { x: cx / (3 * a), y: cy / (3 * a) }
}

/** The corners, clockwise on the screen, starting from the top one (the leftmost of a level top). */
export function cornersOf(shape: string): Pt[] {
  let pts = RAW[shapeOf(shape)].map(([x, y]) => ({ x: x + 0, y: y + 0 }))
  if (areaOf(pts) < 0) pts = pts.reverse()
  let start = 0
  pts.forEach((p, i) => {
    const s = pts[start]
    if (p.y < s.y - EPS || (Math.abs(p.y - s.y) <= EPS && p.x < s.x)) start = i
  })
  return [...pts.slice(start), ...pts.slice(0, start)]
}

/** Reflect p in the line through a and b. */
export function reflect(p: Pt, a: Pt, b: Pt): Pt {
  const d = sub(b, a)
  const u = { x: d.x / len(d), y: d.y / len(d) }
  const v = sub(p, a)
  const along = dot(v, u)
  return { x: a.x + 2 * along * u.x - v.x, y: a.y + 2 * along * u.y - v.y }
}

/** Turn p about c by `deg` degrees, clockwise on the screen. */
export function turn(p: Pt, c: Pt, deg: number): Pt {
  const r = (deg * Math.PI) / 180
  const v = sub(p, c)
  return { x: c.x + v.x * Math.cos(r) - v.y * Math.sin(r), y: c.y + v.x * Math.sin(r) + v.y * Math.cos(r) }
}

/** Does every corner land on a corner? Scaled to the shape's size. */
export function sameCorners(a: Pt[], b: Pt[]): boolean {
  if (a.length !== b.length) return false
  const size = Math.max(...a.map((p) => len(p)), 1)
  return a.every((p) => b.some((q) => len(sub(p, q)) < 1e-7 * size))
}

/** The part of a polygon where f >= 0 (Sutherland-Hodgman, one edge). Points on the line belong to both sides. */
export function clipHalf(poly: Pt[], f: (p: Pt) => number): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]
    const q = poly[(i + 1) % poly.length]
    const fp = f(p)
    const fq = f(q)
    if (fp >= -EPS) out.push(p)
    if ((fp > EPS && fq < -EPS) || (fp < -EPS && fq > EPS)) {
      const k = fp / (fp - fq)
      out.push({ x: p.x + (q.x - p.x) * k, y: p.y + (q.y - p.y) * k })
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// The dots a fold can join: every corner, and the middle of every side.

export type Landmark = { id: string; kind: 'corner' | 'middle'; n: number; at: Pt }

/** In order round the shape: corner 1, the middle of side 1, corner 2... Side k runs from corner k to corner k + 1. */
export function landmarksOf(corners: Pt[]): Landmark[] {
  const out: Landmark[] = []
  corners.forEach((p, i) => {
    const q = corners[(i + 1) % corners.length]
    out.push({ id: `c${i + 1}`, kind: 'corner', n: i + 1, at: p })
    out.push({ id: `m${i + 1}`, kind: 'middle', n: i + 1, at: { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 } })
  })
  return out
}

/** The sides a dot lies on: a corner on two, the middle of a side on its own. */
function sidesOf(id: string, n: number): number[] {
  const k = Number(id.slice(1))
  return id[0] === 'm' ? [k] : [k, ((k - 2 + n) % n) + 1]
}

/** Two dots on one side make a line along the edge, which folds nothing. */
export function sameSide(a: string, b: string, n: number): boolean {
  return a === b || sidesOf(a, n).some((s) => sidesOf(b, n).includes(s))
}

const idOrder = (id: string) => Number(id.slice(1)) * 2 + (id[0] === 'm' ? 1 : 0)
/** One name for a line, whichever dot was tapped first. */
export const lineId = (a: string, b: string) => (idOrder(a) <= idOrder(b) ? `${a}-${b}` : `${b}-${a}`)

/** Every line a fold can take on this shape. */
export function foldLines(shape: string): string[] {
  const corners = cornersOf(shape)
  const marks = landmarksOf(corners)
  const out: string[] = []
  for (let i = 0; i < marks.length; i++) {
    for (let j = i + 1; j < marks.length; j++) {
      if (!sameSide(marks[i].id, marks[j].id, corners.length)) out.push(lineId(marks[i].id, marks[j].id))
    }
  }
  return out
}

const landmarkAt = (corners: Pt[], id: string): Pt => landmarksOf(corners).find((m) => m.id === id)?.at ?? corners[0]

/** Is this line a line of symmetry? Reflecting every corner in it lands on a corner. */
export function isSymmetryLine(shape: string, id: string): boolean {
  const corners = cornersOf(shape)
  const [a, b] = id.split('-')
  const A = landmarkAt(corners, a)
  const B = landmarkAt(corners, b)
  return sameCorners(corners.map((p) => reflect(p, A, B)), corners)
}

const symmetryMemo = new Map<string, string[]>()
/** The lines of symmetry, found by trying every fold. */
export function symmetryLines(shape: string): string[] {
  const s = shapeOf(shape)
  const memo = symmetryMemo.get(s)
  if (memo) return memo
  const out = foldLines(s).filter((id) => isSymmetryLine(s, id))
  symmetryMemo.set(s, out)
  return out
}

/** The order of rotational symmetry, found by turning: how many of the turns that take corner 1 to a corner fit. */
export function orderOf(shape: string): number {
  const corners = cornersOf(shape)
  const c = centroidOf(corners)
  const r0 = sub(corners[0], c)
  let n = 0
  for (const q of corners) {
    const r = sub(q, c)
    if (Math.abs(len(r) - len(r0)) > 1e-7 * len(r0)) continue
    const deg = (Math.atan2(r.y, r.x) - Math.atan2(r0.y, r0.x)) * (180 / Math.PI)
    if (sameCorners(corners.map((p) => turn(p, c, deg)), corners)) n++
  }
  return Math.max(1, n)
}

// ---------------------------------------------------------------------------
// Folding: which part lifts, and where it goes. Pure, so the view and the tests use the same picture.

export type FoldParts = {
  /** The part that stays flat, face up. */
  stay: Pt[]
  /** The part that folds over, as it lies before the fold. */
  flap: Pt[]
  /** Unit normal from the fold line towards the flap's side. */
  n: Pt
  a: Pt
  b: Pt
}

export function foldParts(corners: Pt[], a: Pt, b: Pt): FoldParts {
  const d = sub(b, a)
  const n0 = { x: -d.y / len(d), y: d.x / len(d) }
  const side = (p: Pt) => dot(sub(p, a), n0)
  const pos = clipHalf(corners, side)
  const neg = clipHalf(corners, (p) => -side(p))
  const ap = Math.abs(areaOf(pos))
  const an = Math.abs(areaOf(neg))
  // The smaller part folds over the larger; two halves fold top over bottom, or left over right, as a page turns.
  let posFolds = ap < an - EPS * Math.max(ap, an, 1)
  if (Math.abs(ap - an) <= EPS * Math.max(ap, an, 1)) {
    const cp = centroidOf(pos)
    const cn = centroidOf(neg)
    posFolds = Math.abs(cp.y - cn.y) > EPS ? cp.y < cn.y : cp.x < cn.x
  }
  return posFolds ? { stay: neg, flap: pos, n: n0, a, b } : { stay: pos, flap: neg, n: { x: -n0.x, y: -n0.y }, a, b }
}

/**
 * The flap part-way through the fold, `t` from 0 (flat) to 1 (folded over): each point swings over the line, seen from
 * above, so it narrows to the line at halfway and opens out again on the far side.
 */
export function flapAt(parts: FoldParts, t: number): Pt[] {
  const k = 1 - Math.cos(Math.PI * Math.max(0, Math.min(1, t)))
  return parts.flap.map((p) => {
    const d = dot(sub(p, parts.a), parts.n)
    return { x: p.x - parts.n.x * d * k, y: p.y - parts.n.y * d * k }
  })
}

// ---------------------------------------------------------------------------
// Where everything sits on the plate. One plate, 360 x 270, for both tasks.

export const PLATE_W = 360
export const PLATE_H = 270
export const CX = 180
export const CY = 135
/** The fold board keeps every folded flap this far inside the plate, and a dot's button is this wide. */
export const FOLD_MARGIN = { x: 14, y: 12 }
export const DOT_HIT = 32
/** No shape is drawn larger than this, so the small ones do not fill the plate. */
const MAX_W = 236
const MAX_H = 196
/** The tracing paper reaches this far past the shape's furthest corner, its tab further still. */
export const DISC_PAD = 10
export const TAB_OUT = 15
export const TURN_ROOM = 130

export type FoldLayout = { corners: Pt[]; marks: Landmark[]; scale: number }
export type TurnLayout = { corners: Pt[]; pin: Pt; disc: number; scale: number; dot: number }

const place = (pts: Pt[], s: number, from: Pt, to: Pt) => pts.map((p) => ({ x: to.x + (p.x - from.x) * s, y: to.y + (p.y - from.y) * s }))
const boxOf = (pts: Pt[]) => {
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) }
}

const foldMemo = new Map<string, FoldLayout>()
/** The shape centred on the plate, as large as it can be while every possible fold still lands on the plate. */
export function foldLayout(shape: string): FoldLayout {
  const s = shapeOf(shape)
  const memo = foldMemo.get(s)
  if (memo) return memo
  const unit = cornersOf(s)
  const box = boxOf(unit)
  const mid = { x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 }
  const reach = [...unit]
  const marks = landmarksOf(unit)
  for (const id of foldLines(s)) {
    const [a, b] = id.split('-')
    const parts = foldParts(unit, marks.find((m) => m.id === a)!.at, marks.find((m) => m.id === b)!.at)
    reach.push(...flapAt(parts, 1))
  }
  const far = reach.reduce((m, p) => ({ x: Math.max(m.x, Math.abs(p.x - mid.x)), y: Math.max(m.y, Math.abs(p.y - mid.y)) }), { x: 0, y: 0 })
  const scale = Math.min((CX - FOLD_MARGIN.x) / far.x, (CY - FOLD_MARGIN.y) / far.y, MAX_W / (box.right - box.left), MAX_H / (box.bottom - box.top))
  const corners = place(unit, scale, mid, { x: CX, y: CY })
  const out = { corners, marks: landmarksOf(corners), scale }
  foldMemo.set(s, out)
  return out
}

const turnMemo = new Map<string, TurnLayout>()
/** The shape with its centre on the pin, small enough that the tracing paper and its tab turn clear of the plate's edge. */
export function turnLayout(shape: string): TurnLayout {
  const s = shapeOf(shape)
  const memo = turnMemo.get(s)
  if (memo) return memo
  const unit = cornersOf(s)
  const c = centroidOf(unit)
  const box = boxOf(unit)
  const far = Math.max(...unit.map((p) => len(sub(p, c))))
  const scale = Math.min((TURN_ROOM - DISC_PAD - TAB_OUT) / far, MAX_W / (box.right - box.left), MAX_H / (box.bottom - box.top))
  const pin = { x: CX, y: CY }
  const corners = place(unit, scale, c, pin)
  const out = { corners, pin, disc: far * scale + DISC_PAD, scale, dot: dotCorner(corners, pin) }
  turnMemo.set(s, out)
  return out
}

/** The corner the red dot is traced on: the furthest from the pin, the upper right on a tie, so its marks are easy to see. */
function dotCorner(corners: Pt[], pin: Pt): number {
  let best = 0
  corners.forEach((p, i) => {
    const q = corners[best]
    const dp = len(sub(p, pin))
    const dq = len(sub(q, pin))
    if (dp > dq + 1e-6 || (Math.abs(dp - dq) <= 1e-6 && p.x - p.y > q.x - q.y + 1e-6)) best = i
  })
  return best
}

// ---------------------------------------------------------------------------
// Turning: the tracing turns in steps, and fits at whole multiples of a turn's share.

/** The click of the turn. 15 degrees reaches every fit of order 1, 2, 3, 4, 6 and 8; a pentagon needs 18 (fits every 72). */
export function stepOf(shape: string): number {
  return (360 / FACTS[shapeOf(shape)].order) % 15 === 0 ? 15 : 18
}

/** Where the tracing fits, in degrees from the start, one full turn: always 0, the start, which is also 360. */
export function fitAngles(shape: string): number[] {
  const n = FACTS[shapeOf(shape)].order
  return Array.from({ length: n }, (_, k) => (360 * k) / n)
}

export const fitsAt = (shape: string, deg: number) => fitAngles(shape).includes(((Math.round(deg) % 360) + 360) % 360)

// ---------------------------------------------------------------------------
// The state, read safely.

/** The lines the learner drew, each once, in the order of the shape's own list. Anything else counts for nothing. */
export function drawnLines(config: SymConfig, state: SymState): string[] {
  const raw = state?.lines
  if (!Array.isArray(raw)) return []
  const valid = new Set(raw.filter((x): x is string => typeof x === 'string').map((x) => {
    const [a, b] = x.split('-')
    return a && b ? lineId(a, b) : x
  }))
  return foldLines(config.shape).filter((id) => valid.has(id))
}

/** The marks, each once, as whole degrees of a turn on the shape's own steps; 360 is the start again. */
export function madeMarks(config: SymConfig, state: SymState): number[] {
  const raw = state?.marks
  if (!Array.isArray(raw)) return []
  const step = stepOf(config.shape)
  const out = new Set<number>()
  for (const m of raw) {
    if (typeof m !== 'number' || !Number.isFinite(m)) continue
    if (Math.abs(m - Math.round(m)) > 1e-6) continue
    const deg = ((Math.round(m) % 360) + 360) % 360
    if (deg % step === 0) out.add(deg)
  }
  return [...out].sort((a, b) => a - b)
}

export const saidNone = (state: SymState) => state?.none === true

export function done(config: SymConfig, state: SymState): boolean {
  if (!known(config.shape)) return false
  if (config.task === 'fold') {
    const want = symmetryLines(config.shape)
    const made = drawnLines(config, state)
    if (want.length === 0) return saidNone(state) && made.length === 0
    return !saidNone(state) && made.length === want.length && want.every((id) => made.includes(id))
  }
  const want = fitAngles(config.shape)
  const made = madeMarks(config, state)
  return made.length === want.length && want.every((d) => made.includes(d))
}

// ---------------------------------------------------------------------------
// What is said once marked. Before that the card holds no count at all.

const say = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
const times = (n: number) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`)
export const article = (shape: string) => (/^[aeiou]/i.test(shape) ? 'an' : 'a')
const named = (shape: string) => `${article(shape)} ${shape}`

const LINE_WHY: Record<ShapeName, string> = {
  square: 'A square has 4 lines of symmetry: 2 from the middle of a side to the middle of the opposite side, and 2 from corner to corner.',
  rectangle: 'A rectangle has 2 lines of symmetry, each from the middle of a side to the middle of the opposite side. Folded corner to corner, two corners stick out: its diagonals are not lines of symmetry.',
  rhombus: 'A rhombus has 2 lines of symmetry: its diagonals, from corner to corner. Folded from the middle of a side to the middle of the opposite side, it does not fit.',
  parallelogram: 'A parallelogram has no lines of symmetry: every fold leaves part of it sticking out, even corner to corner. It does fit onto itself after a half turn, which is rotational symmetry.',
  kite: 'A kite has 1 line of symmetry, from the corner between its two short sides to the corner between its two long sides.',
  'isosceles trapezium': 'An isosceles trapezium has 1 line of symmetry, from the middle of one parallel side to the middle of the other.',
  trapezium: 'This trapezium has no lines of symmetry: its two slanting sides are different, so every fold leaves part sticking out. An isosceles trapezium, with equal slanting sides, has one.',
  'equilateral triangle': 'An equilateral triangle has 3 lines of symmetry, each from a corner to the middle of the opposite side.',
  'isosceles triangle': 'An isosceles triangle has 1 line of symmetry, from the corner between its two equal sides to the middle of the opposite side.',
  'right-angled isosceles triangle': 'A right-angled isosceles triangle has 1 line of symmetry, from the right angle to the middle of the longest side.',
  'right-angled triangle': 'This right-angled triangle has no lines of symmetry: its three sides are all different lengths, so no fold fits.',
  'scalene triangle': 'A scalene triangle has no lines of symmetry: its three sides are all different lengths, so no fold fits.',
  'regular pentagon': 'A regular pentagon has 5 lines of symmetry, each from a corner to the middle of the opposite side. A regular polygon has as many lines of symmetry as sides.',
  'regular hexagon': 'A regular hexagon has 6 lines of symmetry: 3 from corner to corner and 3 from the middle of a side to the middle of the opposite side. A regular polygon has as many lines of symmetry as sides.',
  'regular octagon': 'A regular octagon has 8 lines of symmetry: 4 from corner to corner and 4 from the middle of a side to the middle of the opposite side. A regular polygon has as many lines of symmetry as sides.',
}

const TURN_WHY: Partial<Record<ShapeName, string>> = {
  square: 'It fits after every quarter turn. A regular polygon has the same order as its number of sides.',
  rectangle: 'It fits after a half turn, but not after a quarter turn, when it stands on its end.',
  rhombus: 'It fits after a half turn, but not after a quarter turn.',
  parallelogram: 'It fits after a half turn, yet it has no lines of symmetry: turning and folding are different tests.',
  'equilateral triangle': 'It fits after every third of a turn. A regular polygon has the same order as its number of sides.',
  'regular pentagon': 'A regular polygon has the same order as its number of sides.',
  'regular hexagon': 'A regular polygon has the same order as its number of sides.',
  'regular octagon': 'A regular polygon has the same order as its number of sides.',
}

/** What a correct card says: what the learner found, and the misconception it answers. */
export function working(config: SymConfig): string {
  const shape = shapeOf(config.shape)
  if (config.task === 'fold') return `Yes. ${LINE_WHY[shape]}`
  const n = FACTS[shape].order
  if (n === 1) {
    const line = FACTS[shape].lines > 0 ? ' It has a line of symmetry all the same: folding and turning are different tests.' : ''
    return `Yes. The tracing fits only once in a full turn, back at the start, so ${named(shape)} has rotational symmetry of order 1. That means no rotational symmetry; the order is never 0.${line}`
  }
  return `Yes. The tracing fits ${times(n)} in one full turn, so ${named(shape)} has rotational symmetry of order ${n}. ${TURN_WHY[shape] ?? ''} The start counts once: the mark at the end of the turn lands on the first.`.replace(/\s+/g, ' ').trim()
}

/** What a wrong card says: what the learner made, never where the answer is. */
export function madeText(config: SymConfig, state: SymState): string {
  const shape = config.shape
  if (config.task === 'fold') {
    const made = drawnLines(config, state)
    const want = symmetryLines(shape)
    const n = made.length
    if (saidNone(state) && n === 0) return `You said ${named(shape)} has no lines of symmetry, but at least one fold fits it exactly onto itself.`
    if (n === 0) return 'Nothing is drawn yet, and you have not said it has none.'
    const bad = made.filter((id) => !want.includes(id)).length
    if (bad > 0) return `You drew ${say(n, 'line', 'lines')}, but folding along ${n === 1 ? 'it' : 'at least one of them'} leaves part of the card sticking out.`
    return `You drew ${say(n, 'line', 'lines')}, and ${n === 1 ? 'it folds' : 'each one folds'} the ${shape} exactly onto itself. It has more lines of symmetry than that.`
  }
  const made = madeMarks(config, state)
  const want = fitAngles(shape)
  const n = made.length
  if (n === 0) return 'No marks yet: turn the tracing and mark the card under the red dot each time it fits.'
  const bad = made.filter((d) => !want.includes(d)).length
  if (bad > 0) return `You made ${say(n, 'mark', 'marks')}, but at ${n === 1 ? 'that one' : 'at least one of them'} the tracing does not fit the ${shape}.`
  if (!made.includes(0)) return `You made ${say(n, 'mark', 'marks')}, and the tracing fits at each. After one full turn the red dot is back where it started, and the tracing fits there too.`
  return `You made ${say(n, 'mark', 'marks')}, and the tracing fits at each. In one full turn it fits in more places than that.`
}

// ---------------------------------------------------------------------------
// Reading the tutor's config.

const keyOf = (raw: unknown) => (typeof raw === 'string'
  ? raw.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  : '')
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)

const TASK_WORDS: Record<string, SymTask> = {
  fold: 'fold', folds: 'fold', folding: 'fold', 'fold it': 'fold', 'fold the shape': 'fold', lines: 'fold', line: 'fold', 'line symmetry': 'fold', 'lines of symmetry': 'fold', 'line of symmetry': 'fold',
  'reflective symmetry': 'fold', 'reflection symmetry': 'fold', 'reflectional symmetry': 'fold', 'mirror symmetry': 'fold', 'mirror lines': 'fold', 'mirror line': 'fold', 'draw lines': 'fold', 'find lines': 'fold', 'find the lines': 'fold', reflective: 'fold', mirror: 'fold',
  turn: 'turn', turns: 'turn', turning: 'turn', rotate: 'turn', rotating: 'turn', rotation: 'turn', rotational: 'turn', 'rotational symmetry': 'turn', 'order of rotational symmetry': 'turn', order: 'turn',
  'order of rotation': 'turn', tracing: 'turn', 'tracing paper': 'turn', 'turn the tracing': 'turn', spin: 'turn',
}

const SHAPE_WORDS: Record<string, ShapeName> = {
  square: 'square', rectangle: 'rectangle', oblong: 'rectangle', rhombus: 'rhombus', diamond: 'rhombus', parallelogram: 'parallelogram', kite: 'kite',
  'isosceles trapezium': 'isosceles trapezium', 'isosceles trapezoid': 'isosceles trapezium', trapezium: 'trapezium', trapezoid: 'trapezium', 'right angled trapezium': 'trapezium', 'right trapezium': 'trapezium',
  'equilateral triangle': 'equilateral triangle', equilateral: 'equilateral triangle', 'regular triangle': 'equilateral triangle',
  'isosceles triangle': 'isosceles triangle', isosceles: 'isosceles triangle',
  'right angled isosceles triangle': 'right-angled isosceles triangle', 'right isosceles triangle': 'right-angled isosceles triangle', 'isosceles right triangle': 'right-angled isosceles triangle', 'isosceles right angled triangle': 'right-angled isosceles triangle',
  'right angled triangle': 'right-angled triangle', 'right triangle': 'right-angled triangle', 'right angle triangle': 'right-angled triangle',
  'scalene triangle': 'scalene triangle', scalene: 'scalene triangle',
  'regular pentagon': 'regular pentagon', pentagon: 'regular pentagon', 'regular hexagon': 'regular hexagon', hexagon: 'regular hexagon', 'regular octagon': 'regular octagon', octagon: 'regular octagon',
  'regular quadrilateral': 'square',
}

export function readShape(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  let key = keyOf(raw).replace(/^(?:a|an|the)\s+/, '')
  if (key.endsWith('s') && has(SHAPE_WORDS, key.slice(0, -1))) key = key.slice(0, -1)
  if (key.endsWith('es') && has(SHAPE_WORDS, key.slice(0, -2))) key = key.slice(0, -2)
  return has(SHAPE_WORDS, key) ? SHAPE_WORDS[key] : key
}

const goodShape = (task: SymTask) => (task === 'fold' ? 'rectangle' : 'parallelogram')

/** What a prompt can safely say: the gesture and the aim. */
export const goodPrompt = (config: SymConfig) => (config.task === 'fold'
  ? `Tap two dots to fold the ${known(config.shape) ? config.shape : 'shape'} along the line between them. Draw every line of symmetry, or say it has none.`
  : 'Turn the tracing paper one full turn, by its tab or the turn buttons. Each time it fits the shape exactly, mark the card under the red dot.')

export const symmetryEngine: SceneEngine<SymConfig, SymState> = {
  id: 'symmetry',
  // Distinctive words only: "line", "turn", "mirror" and "order" belong to a dozen other topics.
  covers: ['symmetry', 'symmetries', 'symmetrical', 'symmetric'],
  phrases: [
    'line symmetry', 'lines of symmetry', 'line of symmetry', 'reflective symmetry', 'reflection symmetry', 'reflectional symmetry', 'mirror symmetry',
    'rotational symmetry', 'order of rotational symmetry', 'order of rotation', 'symmetry of polygons', 'symmetry in 2d shapes', 'symmetrical shapes',
  ],
  // Near misses: symmetry in biology, chemistry, statistics, computing, graphs and circles, and art.
  notFor: [
    'symmetrical patterns', 'symmetrical pattern', 'completing symmetrical', 'complete the symmetrical', 'complete the pattern',
    'bilateral symmetry', 'radial symmetry', 'bilaterally symmetrical', 'radially symmetrical', 'body symmetry', 'symmetry in animals', 'body plan', 'body plans', 'invertebrates', 'vertebrates', 'classification of animals', 'flower structure', 'facial symmetry',
    'molecular symmetry', 'symmetrical molecules', 'symmetric molecules', 'polar molecules', 'polarity', 'shapes of molecules', 'molecular shape', 'molecular shapes', 'vsepr', 'dipole', 'dipoles', 'crystal symmetry', 'crystal structure', 'crystal structures', 'symmetry breaking', 'conservation laws', 'symmetric stretch',
    'symmetric encryption', 'asymmetric encryption', 'encryption', 'cryptography', 'public key', 'symmetric key',
    'symmetric distribution', 'symmetrical distribution', 'symmetric distributions', 'symmetrical distributions', 'skewed distribution', 'skewed distributions', 'skewness', 'skewed', 'normal distribution', 'box plots', 'histograms',
    'symmetric difference', 'symmetric matrix', 'symmetric matrices', 'matrices',
    'quadratic', 'quadratics', 'quadratic graphs', 'parabola', 'parabolas', 'turning point', 'turning points', 'graphs of functions', 'even and odd functions', 'odd and even functions', 'even functions', 'odd functions',
    'symmetry of graphs', 'graph symmetry', 'trigonometric graphs', 'trig graphs', 'sine graph', 'cosine graph',
    'symmetry properties of circles', 'symmetry properties of a circle', 'circle symmetry', 'chord', 'chords', 'tangent', 'tangents', 'circle theorems',
    'symmetry in art', 'symmetrical balance', 'asymmetrical balance', 'balance in art', 'formal balance', 'symmetrical composition', 'poem', 'poetry',
  ],
  // The learner changes where the folds and the marks go: the shape's symmetry is its structure.
  isolates: 'structure',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const nested = o.task && typeof o.task === 'object' ? (o.task as Record<string, unknown>) : null
    const src = nested ?? o
    const rawTask = first(src, nested ? ['kind', 'task', 'type'] : ['task', 'kind', 'type', 'mode'])
    const rawShape = first(src, ['shape', 'polygon', 'figure', 'name'])
    const word = keyOf(rawTask)
    if (rawTask !== undefined && typeof rawTask !== 'string') return null
    if (word && !has(TASK_WORDS, word)) return null
    const task: SymTask = word ? TASK_WORDS[word] : 'fold'
    if (rawShape === undefined) return { task, shape: goodShape(task) }
    const shape = readShape(rawShape)
    return shape === null || shape === '' ? null : { task, shape }
  },

  faults(config) {
    const s = config.shape
    if (known(s)) return []
    const near = goodShape(config.task)
    if (/\b(?:circle|circles|oval|ellipse|semicircle|semi circle|disc)\b/.test(s)) {
      return [`"${s}" has curved edges, and this card folds and turns only shapes with straight sides (a circle has more lines of symmetry than any card could fold): use e.g. shape "regular octagon".`]
    }
    if (/^(?:triangle|triangles)$/.test(s)) return ['A triangle can have 0, 1 or 3 lines of symmetry, so the card needs to know which: use e.g. shape "isosceles triangle", "equilateral triangle" or "scalene triangle".']
    if (/^(?:quadrilateral|quadrilaterals|polygon|polygons|shape|shapes|2d shape|2d shapes)$/.test(s)) return [`"${s}" could be many shapes, each with its own symmetry: name one, e.g. shape "${near}".`]
    if (/\b(?:heptagon|nonagon|decagon|dodecagon|hendecagon|undecagon)\b/.test(s)) return [`Only the regular pentagon, hexagon and octagon are drawn here: use e.g. shape "regular hexagon".`]
    return [`There is no "${s}" drawn here: use one of ${SHAPES.join(', ')}, e.g. shape "${near}".`]
  },

  promptFaults(config, prompt) {
    const text = prompt.replace(/\s+/g, ' ')
    const example = goodPrompt(config)
    const out: string[] = []
    const num = String.raw`(?:\d+|no|zero|one|two|three|four|five|six|seven|eight|once|twice)`
    const count = new RegExp(String.raw`\b${num}\s+(?:\w+\s+)?(?:lines?|axes|axis|folds?|times|ways|positions|places|marks?|fits?)\b|\border\s+(?:is\s+|of\s+)?${num}\b|\bfits?\s+(?:\w+\s+)?${num}\b|\b${num}\s+times\b`, 'i')
    const rule = /\bas many (?:lines|times)\b|\bsame (?:number|order)\b|\bnever (?:0|zero)\b|\bat least once\b|\bcount the start\b|\bstart(?:ing)? (?:position )?(?:counts|twice)\b/i
    const where = config.task === 'fold'
      ? /\bdiagonals?\b|\bcorner to corner\b|\bmiddle to middle\b|\bvertex to\b|\bhorizontal(?:ly)?\b|\bvertical(?:ly)?\b|\bopposite (?:corners|sides|vertices)\b|\bin half\b/i
      : /\b(?:half|quarter|third|fifth|sixth|eighth)\s+(?:of\s+a\s+)?turns?\b|\b(?:45|60|72|90|120|135|144|180|216|225|240|270|288|300|315)\s*(?:°|degrees?)/i
    if (count.test(text) || rule.test(text) || where.test(text)) {
      out.push(`the prompt gives the answer away: it says how many, where or what the rule is, which the learner is to find by ${config.task === 'fold' ? 'folding' : 'turning the tracing'} -- ask for the outcome only ("${example}")`)
    }
    const wrongTask = config.task === 'fold' ? /\btracing\b|\brotat|\bturn (?:the|it)\b|\bred dot\b/i : /\bfold|\bdraw (?:the|every|each|a) line/i
    const elsewhere = /\b(?:use|place|hold|drag|move|put) (?:a |the )?mirror\b|\bcomplete the (?:pattern|picture|shape|drawing)\b|\bsquared paper\b|\bgrid\b|\bcoordinates?\b|\bplanes? of symmetry\b|\b3-?d\b|\bsolids?\b|\bletters?\b|\bprotractor\b|\breflect (?:the|a) shape\b|\btranslat|\benlarge/i
    if (wrongTask.test(text) || elsewhere.test(text)) {
      out.push(`the prompt promises something the card does not do: the ${config.task === 'fold' ? 'fold card folds a shape cut from card along a line between two dots' : 'turn card turns a tracing pinned at the centre and marks under its red dot'} -- ask for that ("${example}")`)
    }
    return out
  },

  initial(config) {
    return config.task === 'fold' ? { lines: [], none: false } : { marks: [] }
  },

  check(config, state) {
    return { ok: done(config, state), wrongIds: [] }
  },

  solve(config) {
    if (config.task === 'fold') {
      const want = symmetryLines(config.shape)
      return { lines: [...want], none: want.length === 0 }
    }
    return { marks: fitAngles(config.shape) }
  },

  View: SymmetryView,

  prompt: `SCENE "symmetry" -- a shape cut from orange card lying on squared paper, drawn on a quiet light panel. Two tasks, both with the learner's hands:
  For: line symmetry and lines of symmetry, reflective symmetry, rotational symmetry and its order, and the symmetry of polygons (triangles, quadrilaterals and regular polygons), at Cambridge Primary stages 3 to 6, Lower Secondary and IGCSE. It answers "a rectangle's diagonals are lines of symmetry", "a parallelogram has two lines of symmetry", "order 0" and counting the start of a turn twice.
  fold: small dots sit on every corner and the middle of every side. The learner taps two dots and the card folds along the line between them, lifting over and landing in its paler back colour. On a line of symmetry the folded part covers the rest exactly; anywhere else corners stick out and orange peeks out from under it. Then "Unfold", which leaves a faint crease, or "Draw this line" to keep it as a dashed pencil line. "It has none" is there for a shape with no lines. A readout counts the lines drawn.
  turn: tracing paper is pinned at the shape's centre, with the outline traced on it and a red dot traced at one corner. The learner turns it one full turn, by dragging its tab or with turn buttons, in steps of 15 degrees (18 for the pentagon), and taps "Mark under the red dot" each time the tracing fits the shape exactly. Readouts give how far it has turned and how many marks.
  shape: square, rectangle, rhombus, parallelogram, kite, isosceles trapezium, trapezium (no symmetry), equilateral triangle, isosceles triangle, right-angled isosceles triangle, right-angled triangle (3-4-5), scalene triangle, regular pentagon, regular hexagon, regular octagon. A rectangle or a parallelogram is the best first fold, a parallelogram or a kite the best first turn; use the same shape in both tasks to show lines and order are different. Circles, letters, solids and completing a picture across a mirror line are not drawn.
  Before marking the card shows the shape, its name, the dots or the tracing, and the learner's own folds, lines and marks. It holds back how many lines or fits the shape has. Marking says the count and why. The prompt must ask for the outcome only: do NOT say how many lines or fits, the order, where the lines go (diagonals, corner to corner, middle to middle, horizontal, vertical), the angles or fractions of a turn where it fits, or the rule for regular polygons.
  config: { "task":"fold", "shape":"rectangle" }  -- the prompt says "Tap two dots to fold the rectangle along the line between them. Draw every line of symmetry, or say it has none."
       or { "task":"fold", "shape":"parallelogram" }  -- the prompt says "Tap two dots to fold the parallelogram along the line between them. Draw every line of symmetry, or say it has none."
       or { "task":"turn", "shape":"parallelogram" }  -- the prompt says "Turn the tracing paper one full turn, by its tab or the turn buttons. Each time it fits the shape exactly, mark the card under the red dot."
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Tap two dots to fold the rectangle along the line between them. Draw every line of symmetry, or say it has none.",
    "payload": { "engine":"symmetry", "config": { "task":"fold", "shape":"rectangle" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"structure", "apparatus":"scene:symmetry", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Tap two dots to fold the parallelogram along the line between them. Draw every line of symmetry, or say it has none.",
    "payload": { "engine":"symmetry", "config": { "task":"fold", "shape":"parallelogram" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"structure", "apparatus":"scene:symmetry", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Turn the tracing paper one full turn, by its tab or the turn buttons. Each time it fits the shape exactly, mark the card under the red dot.",
    "payload": { "engine":"symmetry", "config": { "task":"turn", "shape":"parallelogram" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"structure", "apparatus":"scene:symmetry", "why":"..." } }`,
}

registerEngine(symmetryEngine as SceneEngine<unknown, unknown>)
