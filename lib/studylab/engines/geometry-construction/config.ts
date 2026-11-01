// lib/studylab/engines/geometry-construction/config.ts
import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { GeometryConstructionView } from './View'

/**
 * Angle facts, as lower secondary and IGCSE teach them: Cambridge Lower Secondary
 * Mathematics (0862, Geometry and measure: the angle facts and the angle sum of a
 * polygon) and Cambridge IGCSE Mathematics (0580, Geometry: calculate unknown
 * angles using angles at a point, on a straight line and at intersecting straight
 * lines, in a triangle and a quadrilateral, in parallel lines (alternate,
 * corresponding and co-interior) and in polygons). Three tasks.
 *
 * 1. angle-facts. The tutor names the situation the engine draws, and may say
 *    which angle is unknown and give the sizes of the others. The figure is drawn
 *    to scale from exact whole-degree angles; the known angles are labelled with
 *    their size and the unknown with x. The learner types x and ticks the fact (or
 *    facts) that justify it, from the same fixed list of exam phrasings for every
 *    situation, so the list says nothing about the answer. Both are marked.
 * 2. drag-invariant. The learner drags a corner of a triangle, or tilts a line
 *    across two parallels, with the angle sizes shown live, and says what stays
 *    true: the sum of the three angles, or the rule joining a marked pair (and
 *    its name). Only individual angles are shown, never the sum or the rule, and
 *    the card is not right until the figure has been moved to several shapes.
 * 3. polygon-sum. The learner gives the interior angle sum, or one interior angle
 *    of a regular polygon of 4 to 12 sides. They may split the polygon into
 *    triangles from one corner; the triangles are counted when it is marked.
 *
 * The facts used (each a standard result): angles on a straight line add up to
 * 180 degrees; angles round a point add up to 360; vertically opposite angles are
 * equal; the angles of a triangle add up to 180 and of a quadrilateral to 360; the
 * base angles of an isosceles triangle are equal; with parallel lines, alternate
 * and corresponding angles are equal and co-interior angles add up to 180. An
 * n-sided polygon splits into n - 2 triangles from one corner, so its angles add
 * up to (n - 2) x 180; a regular polygon has n equal angles, a whole number of
 * degrees exactly when n divides 360.
 *
 * All arithmetic is on whole degrees, so marking compares integers and never
 * floats. Figures are built from the same whole-degree sizes, and the tests measure
 * the angles back off the drawn coordinates.
 *
 * Left for later: constructions with ruler and compass, loci, circle theorems,
 * bearings, exterior angles of polygons, algebraic angles (3x + 10).
 */

// ---------------------------------------------------------------------------
// Limits.

/** The smallest angle a figure labels: below this a label cannot sit clear of its own arc and lines. */
export const MIN_ANGLE = 20
/** Crossing and parallel lines are drawn with long lines through a point; their smallest angle. */
export const MIN_LINES = 30
export const MIN_SIDES = 4
export const MAX_SIDES = 12
/** drag-invariant: how many different shapes the learner must have made before it can be right. */
export const MIN_MOVES = 3

const own = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k)
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)
const slug = (raw: string) => raw.trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0)
const deg = (n: number) => `${n}°`
const listOr = (xs: readonly string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} or ${xs[xs.length - 1]}`)

/** A small seeded dice: the same task always draws the same figure. */
export function hash(s: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h >>> 0
}
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ---------------------------------------------------------------------------
// The facts a learner can give as a reason: one fixed list for every situation.

export type ReasonId = 'alternate' | 'base' | 'co-interior' | 'corresponding' | 'point' | 'quadrilateral' | 'straight' | 'triangle' | 'vertical'

export const REASON_TEXT: Record<ReasonId, string> = {
  'alternate': 'Alternate angles are equal',
  'base': 'Base angles of an isosceles triangle are equal',
  'co-interior': 'Co-interior angles add up to 180°',
  'corresponding': 'Corresponding angles are equal',
  'point': 'Angles round a point add up to 360°',
  'quadrilateral': 'Angles in a quadrilateral add up to 360°',
  'straight': 'Angles on a straight line add up to 180°',
  'triangle': 'Angles in a triangle add up to 180°',
  'vertical': 'Vertically opposite angles are equal',
}

/** The order the list is shown in, alphabetical by its wording: the same for every card, so it says nothing. */
export const REASON_ORDER: ReasonId[] = (Object.keys(REASON_TEXT) as ReasonId[]).sort((a, b) => REASON_TEXT[a].localeCompare(REASON_TEXT[b], 'en'))

const REASON_SET = new Set<string>(REASON_ORDER)
const byReasonOrder = (xs: readonly ReasonId[]): ReasonId[] => [...xs].sort((a, b) => REASON_ORDER.indexOf(a) - REASON_ORDER.indexOf(b))

// ---------------------------------------------------------------------------
// The situations.

export const SITUATIONS = ['straight-line', 'round-point', 'vertically-opposite', 'triangle', 'quadrilateral', 'isosceles', 'alternate', 'corresponding', 'co-interior'] as const
export type Situation = (typeof SITUATIONS)[number]
export type Parallel = 'alternate' | 'corresponding' | 'co-interior'
const isParallel = (s: string): s is Parallel => s === 'alternate' || s === 'corresponding' || s === 'co-interior'

const ORD = ['first', 'second', 'third', 'fourth', 'fifth'] as const
const TRI_NAMES = ['bottom-left', 'bottom-right', 'top'] as const
const QUAD_NAMES = ['bottom-left', 'bottom-right', 'top-right', 'top-left'] as const
const ISO_UNKNOWNS = ['apex', 'base', 'other-base'] as const
const VERT_UNKNOWNS = ['opposite', 'adjacent'] as const
const PAR_UNKNOWNS = ['upper', 'lower'] as const

export type AngleFactsTask = {
  kind: 'angle-facts'
  /** '' when the situation could not be read (faults() says so). */
  situation: Situation | ''
  /** Which angle is x: an ordinal on a line or round a point, a corner, the apex or a base angle, upper or lower, opposite or adjacent. */
  unknown: string
  /** The sizes of the other marked angles, in drawn order with x left out. */
  known: number[]
  unread?: string[]
}

export type DragFigure = 'triangle' | 'parallel'
export type PairName = Parallel | 'vertically-opposite'
export type DragTask = { kind: 'drag-invariant'; figure: DragFigure; pair?: PairName; unread?: string[] }
export type PolygonTask = { kind: 'polygon-sum'; sides: number; ask: 'sum' | 'one-angle'; unread?: string[] }
export type Task = AngleFactsTask | DragTask | PolygonTask
export type GeometryConfig = { task: Task }

/** What the learner has done, whichever task: each task reads its own fields. */
export type GeometryState = {
  value?: string
  reasons?: ReasonId[]
  ab?: [number, number]
  theta?: number
  moves?: number
  rule?: string
  name?: string
  lines?: number[]
}

// ---------------------------------------------------------------------------
// angle-facts: the arithmetic.

export type Solved = {
  /** The size of x. */
  answer: number
  /** Every fact that justifies it, in the list's order. */
  reasons: ReasonId[]
  /** "x = 180° − 120° = 60°". */
  working: string
  /** The marked angles in drawn order, x included. */
  sizes: number[]
  /** The place of x among the sizes. */
  at: number
}

type Seq = { total: number; counts: [number, number]; max: number; reason: ReasonId; what: string; names?: readonly string[] }
const SEQ: Partial<Record<Situation, Seq>> = {
  'straight-line': { total: 180, counts: [2, 4], max: 180 - MIN_ANGLE, reason: 'straight', what: 'angles on a straight line' },
  'round-point': { total: 360, counts: [3, 5], max: 270, reason: 'point', what: 'angles round a point' },
  'triangle': { total: 180, counts: [3, 3], max: 180 - 2 * MIN_ANGLE, reason: 'triangle', what: 'the angles of a triangle', names: TRI_NAMES },
  'quadrilateral': { total: 360, counts: [4, 4], max: 160, reason: 'quadrilateral', what: 'the angles of a quadrilateral', names: QUAD_NAMES },
}

const EXAMPLE: Record<string, number[]> = {
  'straight-line1': [120], 'straight-line2': [50, 70], 'straight-line3': [40, 50, 60],
  'round-point2': [110, 130], 'round-point3': [80, 90, 100], 'round-point4': [60, 70, 80, 90],
  'triangle2': [50, 60], 'quadrilateral3': [80, 90, 100],
  'isosceles-base': [40], 'isosceles-apex': [70], 'isosceles-other-base': [70], 'vertically-opposite1': [70], 'parallel1': [70],
}
const egKnown = (key: string) => `"known": [${(EXAMPLE[key] ?? [70]).join(', ')}]`

function seqSolve(t: AngleFactsTask, s: Seq, situation: Situation): Solved | string[] {
  const k = t.known
  const n = k.length + 1
  const [lo, hi] = s.counts
  const eg = (count: number) => egKnown(`${situation}${count}`)
  if (n < lo || n > hi) {
    const want = lo === hi ? `${lo - 1}` : `${lo - 1} to ${hi - 1}`
    const use = Math.min(hi, Math.max(lo, n)) - 1
    return [`"known" has ${k.length} angle${k.length === 1 ? '' : 's'}: ${s.what} needs ${want} known (x is the last). Use e.g. ${eg(use)}.`]
  }
  const names: readonly string[] = s.names ?? ORD.slice(0, n)
  const u = names.indexOf(t.unknown)
  if (u < 0) return [`"${t.unknown}" is not an angle of this figure. Use one of: ${names.map((x) => `"${x}"`).join(', ')}.`]
  const frac = k.find((x) => !Number.isInteger(x))
  if (frac !== undefined) return [`${frac}° is not a whole number of degrees: the figure is drawn from whole-degree angles. Use e.g. ${eg(n - 1)}.`]
  const small = k.find((x) => x < MIN_ANGLE)
  if (small !== undefined) return [`${small}° is below ${MIN_ANGLE}°, the smallest angle the figure can label. Use e.g. ${eg(n - 1)}.`]
  const big = k.find((x) => x > s.max)
  if (big !== undefined) return [`${big}° is more than ${s.what} can have here (at most ${s.max}°). Use e.g. ${eg(n - 1)}.`]
  const answer = s.total - sum(k)
  if (answer < MIN_ANGLE || answer > s.max) {
    return [`${k.map(deg).join(' + ')} leaves x = ${answer}° out of ${s.total}°, ${answer < MIN_ANGLE ? `below the ${MIN_ANGLE}° the figure can label` : `more than the ${s.max}° it can draw`}. Use e.g. ${eg(n - 1)}.`]
  }
  const terms = k.length === 1 ? deg(k[0]) : `(${k.map(deg).join(' + ')})`
  const sizes = [...k.slice(0, u), answer, ...k.slice(u)]
  return { answer, reasons: [s.reason], working: `x = ${s.total}° − ${terms} = ${answer}°`, sizes, at: u }
}

/** The isosceles base angles that go with an apex; the apex must be even. */
const baseOf = (apex: number) => (180 - apex) / 2

/** Where each pair of parallel-line angles sits, and which of the four angles at a crossing it is. */
export type Pos = 'TR' | 'TL' | 'BL' | 'BR'
type Line = 'U' | 'L'
type Spot = [Line, Pos]
export const PAIRS: Record<PairName, [Spot, Spot][]> = {
  'alternate': [[['U', 'BR'], ['L', 'TL']], [['U', 'BL'], ['L', 'TR']]],
  'corresponding': (['TR', 'TL', 'BL', 'BR'] as Pos[]).map((p): [Spot, Spot] => [['U', p], ['L', p]]),
  'co-interior': [[['U', 'BR'], ['L', 'TR']], [['U', 'BL'], ['L', 'TL']]],
  'vertically-opposite': [[['U', 'TR'], ['U', 'BL']], [['U', 'TL'], ['U', 'BR']]],
}
/** Whether the angle at a corner of a crossing is the acute-side one (theta) or its supplement. */
export const posSize = (p: Pos, theta: number): number => (p === 'TR' || p === 'BL' ? theta : 180 - theta)
const POS_FROM: Record<Pos, number> = { TR: 0, TL: 1, BL: 2, BR: 3 }
/** The start of the angle in degrees (anticlockwise from the right), given the line's tilt theta. */
export const posFrom = (p: Pos, theta: number): number => [0, theta, 180, 180 + theta][POS_FROM[p]]

/** The size of x, the facts that justify it and the working, or the sentences a writer can act on. */
export function solveTask(t: AngleFactsTask): Solved | string[] {
  if (t.unread?.length) return t.unread
  const s = t.situation
  if (s === '') return ['The situation could not be read.']
  const seq = SEQ[s]
  if (seq) return seqSolve(t, seq, s)
  const k = t.known
  const one = (what: string): string[] | null => (k.length === 1 ? null : [`"known" has ${k.length} angle${k.length === 1 ? '' : 's'}: ${what} needs exactly one known angle. Use e.g. ${egKnown(s === 'isosceles' ? `isosceles-${t.unknown}` : s === 'vertically-opposite' ? 'vertically-opposite1' : 'parallel1')}.`])
  if (s === 'vertically-opposite') {
    const bad = one('crossing lines')
    if (bad) return bad
    if (!(VERT_UNKNOWNS as readonly string[]).includes(t.unknown)) return [`"${t.unknown}" is not an angle of crossing lines. Use "opposite" (the angle across the crossing from the known one) or "adjacent" (the one beside it).`]
    const a = k[0]
    if (!Number.isInteger(a)) return [`${a}° is not a whole number of degrees. Use e.g. ${egKnown('vertically-opposite1')}.`]
    if (a < MIN_LINES || a > 180 - MIN_LINES) return [`${a}° cannot be drawn on crossing lines: the angles are from ${MIN_LINES}° to ${180 - MIN_LINES}°, so each can be labelled. Use e.g. ${egKnown('vertically-opposite1')}.`]
    if (t.unknown === 'opposite') return { answer: a, reasons: ['vertical'], working: `x = ${a}°`, sizes: [a, a], at: 1 }
    const x = 180 - a
    return { answer: x, reasons: ['straight'], working: `x = 180° − ${a}° = ${x}°`, sizes: [a, x], at: 1 }
  }
  if (s === 'isosceles') {
    const bad = one('an isosceles triangle')
    if (bad) return bad
    if (!(ISO_UNKNOWNS as readonly string[]).includes(t.unknown)) return [`"${t.unknown}" is not an angle of an isosceles triangle. Use "apex" (the angle between the equal sides), "base" (a base angle, with the apex known) or "other-base" (the other base angle).`]
    const a = k[0]
    if (!Number.isInteger(a)) return [`${a}° is not a whole number of degrees. Use e.g. ${egKnown(`isosceles-${t.unknown}`)}.`]
    if (t.unknown === 'base') {
      if (a < MIN_ANGLE || a > 180 - 2 * MIN_ANGLE) return [`An apex angle of ${a}° cannot be drawn: it is from ${MIN_ANGLE}° to ${180 - 2 * MIN_ANGLE}°. Use e.g. ${egKnown('isosceles-base')}.`]
      if (a % 2 !== 0) return [`An apex angle of ${a}° leaves ${180 - a}° for two equal base angles, ${baseOf(a)}° each, which is not a whole number of degrees. Use an even apex angle, e.g. ${egKnown('isosceles-base')}.`]
      const x = baseOf(a)
      return { answer: x, reasons: byReasonOrder(['base', 'triangle']), working: `x = (180° − ${a}°) ÷ 2 = ${x}°`, sizes: [a, x], at: 1 }
    }
    if (a < MIN_ANGLE || a > 90 - MIN_ANGLE / 2) return [`A base angle of ${a}° cannot be drawn: it is from ${MIN_ANGLE}° to ${90 - MIN_ANGLE / 2}° (the apex then keeps ${MIN_ANGLE}° or more). Use e.g. ${egKnown(`isosceles-${t.unknown}`)}.`]
    if (t.unknown === 'apex') {
      const x = 180 - 2 * a
      return { answer: x, reasons: byReasonOrder(['base', 'triangle']), working: `x = 180° − 2 × ${a}° = ${x}°`, sizes: [a, x], at: 1 }
    }
    return { answer: a, reasons: ['base'], working: `x = ${a}°`, sizes: [a, a], at: 1 }
  }
  // Parallel lines: alternate, corresponding, co-interior.
  const bad = one('parallel lines')
  if (bad) return bad
  if (!(PAR_UNKNOWNS as readonly string[]).includes(t.unknown)) return [`"${t.unknown}" is not a place for x on parallel lines. Use "upper" or "lower": the line that crosses x.`]
  const a = k[0]
  if (!Number.isInteger(a)) return [`${a}° is not a whole number of degrees. Use e.g. ${egKnown('parallel1')}.`]
  if (a < MIN_LINES || a > 180 - MIN_LINES) return [`${a}° cannot be drawn on parallel lines: the angles are from ${MIN_LINES}° to ${180 - MIN_LINES}°. Use e.g. ${egKnown('parallel1')}.`]
  if (s === 'co-interior') {
    const x = 180 - a
    return { answer: x, reasons: ['co-interior'], working: `x = 180° − ${a}° = ${x}°`, sizes: [a, x], at: 1 }
  }
  return { answer: a, reasons: [s as Parallel], working: `x = ${a}°`, sizes: [a, a], at: 1 }
}

// ---------------------------------------------------------------------------
// Reading what the tutor writes.

function readNum(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw + 0 : null
  if (typeof raw === 'string') {
    const s = raw.trim().replace(/°|degrees?|deg\b/gi, '').trim()
    if (/^[-−–]?\d+(?:\.\d+)?$/.test(s)) return Number(s.replace(/[−–]/g, '-')) + 0
  }
  return null
}
const readInt = (raw: unknown): number | null => {
  const n = readNum(raw)
  return n !== null && Number.isInteger(n) ? n : null
}
function readList(raw: unknown): unknown[] | null {
  if (Array.isArray(raw)) return raw.slice(0, 12)
  if (typeof raw === 'string') return raw.split(/[\s,;]+/).filter((x) => x && !/^and$/i.test(x)).slice(0, 12)
  if (typeof raw === 'number') return [raw]
  return null
}

const KIND_WORDS: Record<string, Task['kind']> = {
  'angle-facts': 'angle-facts', 'angle-fact': 'angle-facts', 'angles': 'angle-facts', 'find-the-angle': 'angle-facts', 'unknown-angle': 'angle-facts',
  'angle-reasons': 'angle-facts', 'find-x': 'angle-facts', 'facts': 'angle-facts', 'angle': 'angle-facts',
  'drag-invariant': 'drag-invariant', 'drag': 'drag-invariant', 'invariant': 'drag-invariant', 'what-stays-true': 'drag-invariant', 'explore': 'drag-invariant', 'invariants': 'drag-invariant',
  'polygon-sum': 'polygon-sum', 'polygon': 'polygon-sum', 'polygons': 'polygon-sum', 'polygon-angles': 'polygon-sum', 'interior-angles': 'polygon-sum', 'angle-sum-of-a-polygon': 'polygon-sum',
}

const SITUATION_WORDS: Record<string, Situation> = {
  'straight-line': 'straight-line', 'a-straight-line': 'straight-line', 'on-a-straight-line': 'straight-line', 'angles-on-a-straight-line': 'straight-line', 'angles-on-a-line': 'straight-line',
  'straight': 'straight-line', 'angles-on-straight-line': 'straight-line', 'supplementary': 'straight-line', 'supplementary-angles': 'straight-line',
  'round-point': 'round-point', 'round-a-point': 'round-point', 'angles-round-a-point': 'round-point', 'angles-around-a-point': 'round-point', 'around-a-point': 'round-point',
  'at-a-point': 'round-point', 'angles-at-a-point': 'round-point', 'point': 'round-point', 'full-turn': 'round-point', 'about-a-point': 'round-point', 'angles-about-a-point': 'round-point',
  'vertically-opposite': 'vertically-opposite', 'vertically-opposite-angles': 'vertically-opposite', 'vertical': 'vertically-opposite', 'vertical-angles': 'vertically-opposite',
  'opposite': 'vertically-opposite', 'opposite-angles': 'vertically-opposite', 'intersecting-lines': 'vertically-opposite', 'crossing-lines': 'vertically-opposite', 'intersecting-straight-lines': 'vertically-opposite',
  'triangle': 'triangle', 'angles-in-a-triangle': 'triangle', 'angles-in-triangle': 'triangle', 'triangle-angles': 'triangle', 'angle-sum-of-a-triangle': 'triangle', 'interior-angles-of-a-triangle': 'triangle',
  'quadrilateral': 'quadrilateral', 'angles-in-a-quadrilateral': 'quadrilateral', 'quadrilateral-angles': 'quadrilateral', 'angle-sum-of-a-quadrilateral': 'quadrilateral', 'four-sided-shape': 'quadrilateral',
  'isosceles': 'isosceles', 'isosceles-triangle': 'isosceles', 'isosceles-triangles': 'isosceles', 'angles-in-an-isosceles-triangle': 'isosceles', 'base-angles': 'isosceles',
  'alternate': 'alternate', 'alternate-angles': 'alternate', 'z-angles': 'alternate', 'parallel-alternate': 'alternate', 'alternate-interior-angles': 'alternate', 'alternate-interior': 'alternate',
  'corresponding': 'corresponding', 'corresponding-angles': 'corresponding', 'f-angles': 'corresponding', 'parallel-corresponding': 'corresponding',
  'co-interior': 'co-interior', 'cointerior': 'co-interior', 'co-interior-angles': 'co-interior', 'cointerior-angles': 'co-interior', 'allied': 'co-interior', 'allied-angles': 'co-interior',
  'c-angles': 'co-interior', 'u-angles': 'co-interior', 'parallel-co-interior': 'co-interior', 'same-side-interior': 'co-interior', 'consecutive-interior-angles': 'co-interior',
}

const ORD_WORDS: Record<string, number> = {
  'first': 0, '1st': 0, '1': 0, 'one': 0, 'second': 1, '2nd': 1, '2': 1, 'two': 1, 'third': 2, '3rd': 2, '3': 2, 'three': 2,
  'fourth': 3, '4th': 3, '4': 3, 'four': 3, 'fifth': 4, '5th': 4, '5': 4, 'five': 4, 'last': -1, 'final': -1,
}
const NAMED_WORDS: Record<string, string> = {
  'bottom-left': 'bottom-left', 'lower-left': 'bottom-left', 'left': 'bottom-left', 'bottom-right': 'bottom-right', 'lower-right': 'bottom-right', 'right': 'bottom-right',
  'top': 'top', 'apex': 'top', 'top-vertex': 'top', 'upper': 'top', 'top-right': 'top-right', 'upper-right': 'top-right', 'top-left': 'top-left', 'upper-left': 'top-left',
}
const ISO_WORDS: Record<string, string> = {
  'apex': 'apex', 'top': 'apex', 'vertex': 'apex', 'apex-angle': 'apex', 'base': 'base', 'base-angle': 'base', 'a-base-angle': 'base',
  'other-base': 'other-base', 'the-other-base-angle': 'other-base', 'other-base-angle': 'other-base', 'second-base': 'other-base', 'other': 'other-base',
}
const VERT_WORDS: Record<string, string> = {
  'opposite': 'opposite', 'vertically-opposite': 'opposite', 'across': 'opposite', 'adjacent': 'adjacent', 'next-to': 'adjacent', 'beside': 'adjacent', 'neighbouring': 'adjacent', 'neighboring': 'adjacent',
}
const PAR_WORDS: Record<string, string> = { 'upper': 'upper', 'top': 'upper', 'above': 'upper', 'lower': 'lower', 'bottom': 'lower', 'below': 'lower' }

/** Genuine, deterministic whole-degree sizes: multiples of 5 that add to the total, each within a range. */
function genSeq(total: number, n: number, lo: number, hi: number, r: () => number): number[] {
  for (let tries = 0; tries < 300; tries++) {
    const xs: number[] = []
    let left = total
    for (let i = 0; i < n - 1; i++) {
      const v = lo + 5 * Math.floor(r() * ((hi - lo) / 5 + 1))
      xs.push(v)
      left -= v
    }
    if (left >= lo && left <= hi && left % 5 === 0) return [...xs, left]
  }
  const base = Math.floor(total / n / 5) * 5
  return [...Array<number>(n - 1).fill(base), total - base * (n - 1)]
}
const pickOf = <T,>(r: () => number, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]
const step5 = (r: () => number, lo: number, hi: number, not?: number): number => {
  for (;;) {
    const v = lo + 5 * Math.floor(r() * ((hi - lo) / 5 + 1))
    if (v !== not) return v
  }
}

const SIT_RANGE: Record<string, [number, number]> = { 'straight-line': [30, 130], 'round-point': [30, 190], 'triangle': [30, 110], 'quadrilateral': [50, 130] }

function parseAngleFacts(t: Record<string, unknown>): AngleFactsTask {
  const unread: string[] = []
  const sitRaw = first(t, ['situation', 'topic', 'fact', 'relation', 'figure', 'scenario', 'case', 'angle_fact'])
  const none: AngleFactsTask = { kind: 'angle-facts', situation: '', unknown: '', known: [] }
  if (sitRaw === undefined) return { ...none, unread: [`the task needs a "situation": one of ${SITUATIONS.map((s) => `"${s}"`).join(', ')}.`] }
  const key = typeof sitRaw === 'string' ? slug(sitRaw) : ''
  const situation = own(SITUATION_WORDS, key) ? SITUATION_WORDS[key] : null
  if (!situation) {
    const par = /^(?:parallel|parallel-lines|parallels|transversal|parallel-lines-and-a-transversal|angles-in-parallel-lines)$/.test(key)
    return { ...none, unread: [par
      ? 'Say which angles in parallel lines: "alternate", "corresponding" or "co-interior" (the three are different cards).'
      : `situation ${JSON.stringify(sitRaw)} is not one this scene draws. Use one of: ${SITUATIONS.map((s) => `"${s}"`).join(', ')}.`] }
  }
  // known: the sizes of the other angles.
  let known: number[] | null = null
  const knownRaw = first(t, ['known', 'given', 'sizes', 'values', 'angles', 'given_angles', 'known_angles'])
  if (knownRaw !== undefined) {
    const items = readList(knownRaw)
    if (!items) unread.push('"known" should be a list of angle sizes in degrees, e.g. [50, 60].')
    else {
      known = []
      for (const item of items) {
        const v = readNum(item)
        if (v === null) unread.push(`${JSON.stringify(item)} in known is not a number of degrees.`)
        else known.push(v)
      }
    }
  }
  const variantRaw = first(t, ['variant', 'version', 'example', 'seed'])
  const variant = variantRaw === undefined ? 1 : readInt(variantRaw)
  if (variant === null) unread.push(`"variant" ${JSON.stringify(variantRaw)} is not a whole number (1, 2, 3...); leave it out for the card's first figure.`)
  const unknownRaw = first(t, ['unknown', 'find', 'ask', 'which', 'target', 'x'])
  const ukey = typeof unknownRaw === 'string' || typeof unknownRaw === 'number' ? slug(String(unknownRaw)) : ''
  const r = rng(hash([situation, ukey, known ? known.join(',') : '', variant ?? 1].join('|')))

  let unknown = ''
  let n = 0
  if (situation === 'straight-line' || situation === 'round-point') {
    n = known ? known.length + 1 : pickOf(r, situation === 'straight-line' ? [2, 3, 3, 4] : [3, 4, 4, 5])
    if (unknownRaw !== undefined) {
      const at = own(ORD_WORDS, ukey) ? ORD_WORDS[ukey] : undefined
      if (at === undefined) unread.push(`unknown ${JSON.stringify(unknownRaw)} is not an angle position: use "first", "second", "third" ... or "last" (counting in the order drawn, left to right).`)
      else {
        // With no sizes given, enough angles are drawn for the one named.
        if (!known && at >= n) n = Math.min(at + 1, SEQ[situation]?.counts[1] ?? n)
        unknown = ORD[Math.min(at < 0 ? n - 1 : at, ORD.length - 1)]
      }
    }
    if (!unknown) unknown = ORD[Math.floor(r() * n)]
  } else if (situation === 'triangle' || situation === 'quadrilateral') {
    const names = situation === 'triangle' ? TRI_NAMES : QUAD_NAMES
    n = names.length
    if (unknownRaw !== undefined) {
      const c = own(NAMED_WORDS, ukey) ? NAMED_WORDS[ukey] : undefined
      if (c && (names as readonly string[]).includes(c)) unknown = c
      else unread.push(`unknown ${JSON.stringify(unknownRaw)} is not a corner of this figure: use ${listOr(names.map((x) => `"${x}"`))}.`)
    }
    if (!unknown) unknown = pickOf(r, names)
  } else if (situation === 'isosceles') {
    if (unknownRaw !== undefined) {
      if (own(ISO_WORDS, ukey)) unknown = ISO_WORDS[ukey]
      else unread.push(`unknown ${JSON.stringify(unknownRaw)} is not an angle of an isosceles triangle: use "apex", "base" (with the apex known) or "other-base".`)
    }
    if (!unknown) unknown = pickOf(r, ISO_UNKNOWNS)
  } else if (situation === 'vertically-opposite') {
    if (unknownRaw !== undefined) {
      if (own(VERT_WORDS, ukey)) unknown = VERT_WORDS[ukey]
      else unread.push(`unknown ${JSON.stringify(unknownRaw)} is not an angle of crossing lines: use "opposite" or "adjacent".`)
    }
    if (!unknown) unknown = pickOf(r, VERT_UNKNOWNS)
  } else {
    if (unknownRaw !== undefined) {
      if (own(PAR_WORDS, ukey)) unknown = PAR_WORDS[ukey]
      else unread.push(`unknown ${JSON.stringify(unknownRaw)} is not a place for x on parallel lines: use "upper" or "lower".`)
    }
    if (!unknown) unknown = pickOf(r, PAR_UNKNOWNS)
  }

  let sizes: number[] | null = known
  if (!sizes) {
    const gen = (): number[] => {
      if (situation === 'straight-line' || situation === 'round-point' || situation === 'triangle' || situation === 'quadrilateral') {
        const [lo, hi] = SIT_RANGE[situation]
        const total = situation === 'straight-line' || situation === 'triangle' ? 180 : 360
        const names: readonly string[] = situation === 'triangle' ? TRI_NAMES : situation === 'quadrilateral' ? QUAD_NAMES : ORD.slice(0, n)
        const u = names.indexOf(unknown)
        return genSeq(total, n, lo, hi, r).filter((_, i) => i !== u)
      }
      if (situation === 'isosceles') return [unknown === 'base' ? 30 + 10 * Math.floor(r() * 10) : step5(r, 30, 75)]
      return [step5(r, 30, 150, 90)]
    }
    // The first sizes whose figure can be labelled cleanly: the engine never draws a card it cannot letter.
    for (let attempt = 0; attempt < 60; attempt++) {
      sizes = gen()
      const task: AngleFactsTask = { kind: 'angle-facts', situation, unknown, known: sizes }
      const s = solveTask(task)
      if (!Array.isArray(s) && labelsFit(task, s)) break
    }
  }
  return { kind: 'angle-facts', situation, unknown, known: sizes ?? [], ...(unread.length ? { unread } : {}) }
}

const PAIR_WORDS: Record<string, PairName> = {
  'alternate': 'alternate', 'alternate-angles': 'alternate', 'z-angles': 'alternate', 'corresponding': 'corresponding', 'corresponding-angles': 'corresponding', 'f-angles': 'corresponding',
  'co-interior': 'co-interior', 'cointerior': 'co-interior', 'co-interior-angles': 'co-interior', 'allied': 'co-interior', 'allied-angles': 'co-interior',
  'vertically-opposite': 'vertically-opposite', 'vertically-opposite-angles': 'vertically-opposite', 'vertical': 'vertically-opposite', 'opposite': 'vertically-opposite',
}
const PARALLEL_FIGURE_WORDS = ['parallel', 'parallel-lines', 'parallels', 'transversal', 'parallel-lines-and-a-transversal', 'two-parallel-lines']

function parseDrag(t: Record<string, unknown>): DragTask {
  const unread: string[] = []
  const figRaw = first(t, ['figure', 'shape', 'diagram', 'situation', 'topic'])
  const pairRaw = first(t, ['pair', 'relation', 'angles', 'marked', 'fact'])
  const figKey = typeof figRaw === 'string' ? slug(figRaw) : ''
  let figure: DragFigure = 'triangle'
  let pair: PairName | undefined
  if (figRaw === undefined) unread.push('the task needs a "figure": "triangle" (drag a corner) or "parallel-lines" (tilt the crossing line).')
  else if (figKey === 'triangle' || figKey === 'triangles' || figKey === 'a-triangle') figure = 'triangle'
  else if (PARALLEL_FIGURE_WORDS.includes(figKey)) figure = 'parallel'
  else if (own(PAIR_WORDS, figKey)) {
    figure = 'parallel'
    pair = PAIR_WORDS[figKey]
  } else unread.push(`figure ${JSON.stringify(figRaw)} is not one this scene drags. Use "triangle" or "parallel-lines".`)
  if (pairRaw !== undefined) {
    const k = typeof pairRaw === 'string' ? slug(pairRaw) : ''
    if (own(PAIR_WORDS, k)) pair = PAIR_WORDS[k]
    else unread.push(`pair ${JSON.stringify(pairRaw)} is not one this scene marks. Use "alternate", "corresponding", "co-interior" or "vertically-opposite".`)
  }
  if (figure === 'parallel' && !pair && !unread.length) unread.push('Say which pair of angles to mark on the parallel lines: "pair": "alternate", "corresponding", "co-interior" or "vertically-opposite".')
  if (figure === 'triangle' && pair) unread.push('"pair" belongs to the parallel lines: leave it out for a triangle.')
  return { kind: 'drag-invariant', figure, ...(figure === 'parallel' && pair ? { pair } : {}), ...(unread.length ? { unread } : {}) }
}

export const POLYGON_NAMES: Record<number, string> = {
  3: 'triangle', 4: 'quadrilateral', 5: 'pentagon', 6: 'hexagon', 7: 'heptagon', 8: 'octagon', 9: 'nonagon', 10: 'decagon', 11: 'hendecagon', 12: 'dodecagon',
}
const SIDES_WORDS: Record<string, number> = Object.fromEntries(Object.entries(POLYGON_NAMES).map(([n, w]) => [w, Number(n)]))
SIDES_WORDS['square'] = 4
SIDES_WORDS['rectangle'] = 4
SIDES_WORDS['undecagon'] = 11

const ASK_WORDS: Record<string, PolygonTask['ask']> = {
  'sum': 'sum', 'angle-sum': 'sum', 'interior-angle-sum': 'sum', 'sum-of-interior-angles': 'sum', 'sum-of-angles': 'sum', 'total': 'sum',
  'one-angle': 'one-angle', 'one': 'one-angle', 'each': 'one-angle', 'each-angle': 'one-angle', 'interior-angle': 'one-angle', 'one-interior-angle': 'one-angle', 'regular': 'one-angle', 'size': 'one-angle', 'angle': 'one-angle',
}

function parsePolygon(t: Record<string, unknown>): PolygonTask {
  const unread: string[] = []
  const sidesRaw = first(t, ['sides', 'n', 'polygon', 'shape', 'number_of_sides', 'numberOfSides', 'edges', 'corners'])
  let sides = 0
  if (sidesRaw === undefined) unread.push(`the task needs "sides": a whole number from ${MIN_SIDES} to ${MAX_SIDES}, e.g. 6.`)
  else {
    const v = typeof sidesRaw === 'string' && own(SIDES_WORDS, slug(sidesRaw)) ? SIDES_WORDS[slug(sidesRaw)] : readNum(sidesRaw)
    if (v === null) unread.push(`"sides" ${JSON.stringify(sidesRaw)} is not a number: use a whole number from ${MIN_SIDES} to ${MAX_SIDES}, e.g. 6.`)
    else sides = v
  }
  const askRaw = first(t, ['ask', 'find', 'asks', 'question', 'target'])
  let ask: PolygonTask['ask'] = 'sum'
  if (askRaw !== undefined) {
    const k = typeof askRaw === 'string' ? slug(askRaw) : ''
    if (own(ASK_WORDS, k)) ask = ASK_WORDS[k]
    else unread.push(`ask ${JSON.stringify(askRaw)} is not one of: "sum" (the interior angle sum) or "one-angle" (one interior angle of the regular polygon).`)
  }
  return { kind: 'polygon-sum', sides, ask, ...(unread.length ? { unread } : {}) }
}

export function parseTask(raw: unknown): GeometryConfig | null {
  const holder = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as { task?: unknown }) : null
  const task = holder?.task ?? (holder && ('kind' in holder || 'situation' in holder || 'sides' in holder || 'figure' in holder) ? holder : null)
  if (!task || typeof task !== 'object' || Array.isArray(task)) return null
  const t = task as Record<string, unknown>
  let kind: Task['kind'] | null = null
  const kindUnread: string[] = []
  if (t.kind !== undefined) {
    const key = typeof t.kind === 'string' ? slug(t.kind) : ''
    kind = own(KIND_WORDS, key) ? KIND_WORDS[key] : null
    if (!kind) kindUnread.push(`kind ${JSON.stringify(t.kind)} is not one of: angle-facts, drag-invariant, polygon-sum.`)
  }
  if (!kind) kind = 'sides' in t ? 'polygon-sum' : 'figure' in t && !('situation' in t) ? 'drag-invariant' : 'angle-facts'
  const out = kind === 'polygon-sum' ? parsePolygon(t) : kind === 'drag-invariant' ? parseDrag(t) : parseAngleFacts(t)
  if (kindUnread.length) out.unread = [...kindUnread, ...(out.unread ?? [])]
  return { task: out }
}

// ---------------------------------------------------------------------------
// The state a learner leaves, read safely.

export const readValue = (raw: unknown): string => {
  const v = (raw as { value?: unknown } | null)?.value
  return typeof v === 'string' ? v.replace(/\D/g, '').slice(0, 4) : ''
}
/** The whole-number size typed, or null. */
export const typedNumber = (raw: unknown): number | null => {
  const v = (raw as { value?: unknown } | null)?.value
  return typeof v === 'string' && /^\s*\d{1,4}\s*°?\s*$/.test(v) ? Number(v.replace(/\D/g, '')) : null
}
export function readReasons(raw: unknown): ReasonId[] {
  const v = (raw as { reasons?: unknown } | null)?.reasons
  if (!Array.isArray(v)) return []
  return byReasonOrder([...new Set(v.filter((x): x is ReasonId => typeof x === 'string' && REASON_SET.has(x)))])
}
export const readMoves = (raw: unknown): number => {
  const v = (raw as { moves?: unknown } | null)?.moves
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 ? Math.min(v, 9) : 0
}
export const readText = (raw: unknown, key: 'rule' | 'name'): string => {
  const v = (raw as Record<string, unknown> | null)?.[key]
  return typeof v === 'string' ? v : ''
}
const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x) => b.includes(x))

// ---------------------------------------------------------------------------
// angle-facts: marking.

export type FactsVerdict = { ok: boolean; angle: boolean; reason: boolean; wrongIds: string[] }

export function factsVerdict(t: AngleFactsTask, state: unknown): FactsVerdict {
  const s = solveTask(t)
  if (Array.isArray(s)) return { ok: false, angle: false, reason: false, wrongIds: [] }
  const angle = typedNumber(state) === s.answer
  const reason = sameSet(readReasons(state), s.reasons)
  return { ok: angle && reason, angle, reason, wrongIds: [...(angle ? [] : ['angle']), ...(reason ? [] : ['reason'])] }
}

const quote = (ids: readonly ReasonId[]) => ids.map((r) => `"${REASON_TEXT[r]}"`).join(' and ')

/** The lines an angle-facts card says once marked. Never called before: they hold x and the fact. */
export function factsSaid(t: AngleFactsTask, state: unknown, marked: 'right' | 'wrong' | 'shown'): string[] {
  const s = solveTask(t)
  if (Array.isArray(s)) return []
  const v = factsVerdict(t, state)
  const ticked = readReasons(state)
  const typed = typedNumber(state)
  const many = s.reasons.length > 1
  if (marked !== 'wrong' || v.ok) return [`Yes: ${s.working}.`, `${many ? 'The facts' : 'The fact'}: ${quote(s.reasons)}.`]
  if (typed === null && !ticked.length) return ['Type the size of x and tick the fact you used, then check.']
  const lines = [v.angle ? `${s.working} is right.` : typed === null ? `You have not typed a size for x yet. ${s.working}.` : `You wrote x = ${typed}°, but ${s.working}.`]
  if (v.reason) lines.push(`${many ? 'The facts you ticked fit' : 'The fact you ticked fits'}: ${quote(ticked)}.`)
  else lines.push(`${ticked.length ? `You ticked ${quote(ticked)}. ` : 'You ticked no fact. '}${many ? 'The facts that fit here are' : 'The fact that fits here is'}: ${quote(s.reasons)}.`)
  return lines
}

// ---------------------------------------------------------------------------
// The figures: exact angles, drawn to scale. Directions are in degrees anticlockwise on the screen, from the right.

export const PLATE_W = 360
export const PLATE_H = 250
export const ARC = 22

export type Pt = { x: number; y: number }
export type Seg = { a: Pt; b: Pt }
export type Mark = {
  at: Pt
  /** The first ray's direction, degrees anticlockwise on screen from the right; the angle sweeps anticlockwise from it. */
  from: number
  size: number
  role: 'given' | 'unknown'
  text: string
  /** How far from `at` the label's farthest corner may be: the angle's own lines end there. */
  reach: number
}
export type Fig = { segs: Seg[]; ticks: Seg[]; chevrons: Seg[]; marks: Mark[]; fill: Pt[]; dots: Pt[]; /** False when the angles could not be drawn as a figure at all. */ drawable?: boolean }

const rad = (d: number) => (d * Math.PI) / 180
export const dirOf = (d: number): Pt => ({ x: Math.cos(rad(d)), y: -Math.sin(rad(d)) })
export const along = (p: Pt, d: number, len: number): Pt => ({ x: p.x + len * Math.cos(rad(d)), y: p.y - len * Math.sin(rad(d)) })
export const angleOf = (from: Pt, to: Pt): number => (Math.atan2(-(to.y - from.y), to.x - from.x) * 180) / Math.PI
export const norm360 = (d: number): number => ((d % 360) + 360) % 360
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y)
const seg = (a: Pt, b: Pt): Seg => ({ a, b })
const emptyFig = (): Fig => ({ segs: [], ticks: [], chevrons: [], marks: [], fill: [], dots: [] })

type Role = Mark['role']
export type Tag = { size: number; role: Role; text: string } | null

/** The angle at corner i of a polygon drawn anticlockwise on the screen. */
export function polyFig(pts: Pt[], tags: Tag[], ticks: [number, number][] = []): Fig {
  const fig = emptyFig()
  const n = pts.length
  for (let i = 0; i < n; i++) {
    const p = pts[i]
    const next = pts[(i + 1) % n]
    const prev = pts[(i + n - 1) % n]
    fig.segs.push(seg(p, next))
    const tag = tags[i]
    if (tag) fig.marks.push({ at: p, from: angleOf(p, next), size: tag.size, role: tag.role, text: tag.text, reach: 400 })
  }
  // Equal-side ticks: a short stroke across the middle of each side named.
  for (const [i, j] of ticks) {
    const a = pts[i]
    const b = pts[j]
    const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    const d = angleOf(a, b) + 90
    fig.ticks.push(seg(along(m, d, 7), along(m, d + 180, 7)))
  }
  fig.fill = pts
  return fig
}

const MARGIN_X = 22
const MARGIN_Y = 18

/** Scale and centre points into the plate, keeping the shape. */
function fitTo(pts: Pt[], mx: number, my: number, maxScale = 3): (p: Pt) => Pt {
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  const x0 = Math.min(...xs)
  const x1 = Math.max(...xs)
  const y0 = Math.min(...ys)
  const y1 = Math.max(...ys)
  const k = Math.min((PLATE_W - 2 * mx) / (x1 - x0 || 1), (PLATE_H - 2 * my) / (y1 - y0 || 1), maxScale)
  const cx = (x0 + x1) / 2
  const cy = (y0 + y1) / 2
  return (p) => ({ x: PLATE_W / 2 + (p.x - cx) * k, y: PLATE_H / 2 + (p.y - cy) * k })
}

/** A triangle from its base angles, anticlockwise: the left base corner, the right, the apex. */
export function triangleAt(a: number, b: number, c = 100): Pt[] {
  const top = 180 - a - b
  const side = (c * Math.sin(rad(b))) / Math.sin(rad(top))
  const left = { x: 0, y: 0 }
  return [left, { x: c, y: 0 }, along(left, a, side)]
}

/**
 * A convex quadrilateral with the given interior angles, anticlockwise from the bottom left.
 * The edge directions are fixed by the angles; the lengths are found from closing the shape, trying the
 * second side's length over a wide range and keeping the roundest result.
 */
export function quadShapes(angles: readonly number[]): Pt[][] {
  const phi: number[] = [0]
  for (let i = 1; i < 4; i++) phi.push(phi[i - 1] + 180 - angles[i])
  const u = phi.map((p) => ({ x: Math.cos(rad(p)), y: Math.sin(rad(p)) }))
  const det = u[2].x * u[3].y - u[2].y * u[3].x
  const found: { score: number; l: number[] }[] = []
  for (let k = -80; k <= 80; k++) {
    const t = Math.exp(k / 10)
    const rx = -(u[0].x + t * u[1].x)
    const ry = -(u[0].y + t * u[1].y)
    const l2 = (rx * u[3].y - ry * u[3].x) / det
    const l3 = (u[2].x * ry - u[2].y * rx) / det
    if (l2 <= 1e-3 || l3 <= 1e-3) continue
    const l = [1, t, l2, l3]
    found.push({ score: Math.min(...l) / Math.max(...l), l })
  }
  return found.sort((a, b) => b.score - a.score).map(({ l }) => {
    const pts: Pt[] = [{ x: 0, y: 0 }]
    for (let i = 0; i < 3; i++) pts.push({ x: pts[i].x + 100 * l[i] * u[i].x, y: pts[i].y - 100 * l[i] * u[i].y })
    return pts
  })
}
export const quadPoints = (angles: readonly number[]): Pt[] | null => quadShapes(angles)[0] ?? null

const lineFig = (sizes: number[], at: number): Fig => {
  const fig = emptyFig()
  const o = { x: 180, y: 206 }
  const rays = [180]
  for (const s of sizes) rays.push(rays[rays.length - 1] - s)
  fig.segs.push(seg({ x: 20, y: o.y }, { x: 340, y: o.y }))
  for (let i = 1; i < sizes.length; i++) fig.segs.push(seg(o, along(o, rays[i], 150)))
  sizes.forEach((s, i) => fig.marks.push({ at: o, from: rays[i + 1], size: s, role: i === at ? 'unknown' : 'given', text: i === at ? 'x' : deg(s), reach: 142 }))
  fig.dots.push(o)
  return fig
}

const pointFig = (sizes: number[], at: number, rho: number): Fig => {
  const fig = emptyFig()
  const o = { x: 180, y: 125 }
  let a = rho
  const rays: number[] = []
  for (const s of sizes) {
    rays.push(a)
    a += s
  }
  rays.forEach((d) => fig.segs.push(seg(o, along(o, d, 108))))
  sizes.forEach((s, i) => fig.marks.push({ at: o, from: rays[i], size: s, role: i === at ? 'unknown' : 'given', text: i === at ? 'x' : deg(s), reach: 102 }))
  fig.dots.push(o)
  return fig
}

const crossFig = (theta: number, rho: number, g: number, gText: string, u: number, uSize: number): Fig => {
  const fig = emptyFig()
  const o = { x: 180, y: 125 }
  for (const d of [rho, rho + theta]) fig.segs.push(seg(along(o, d, 112), along(o, d + 180, 112)))
  const start = [rho, rho + theta, rho + 180, rho + 180 + theta]
  const size = (k: number) => (k % 2 === 0 ? theta : 180 - theta)
  fig.marks.push({ at: o, from: start[g], size: size(g), role: 'given', text: gText, reach: 106 })
  fig.marks.push({ at: o, from: start[u], size: uSize, role: 'unknown', text: 'x', reach: 106 })
  fig.dots.push(o)
  return fig
}

const isoFig = (beta: number, tags: { base0: Tag; base1: Tag; apex: Tag }): Fig => {
  const pts = triangleAt(beta, beta, 100)
  const p = pts.map(fitTo(pts, MARGIN_X, MARGIN_Y))
  return polyFig(p, [tags.base0, tags.base1, tags.apex], [[0, 2], [1, 2]])
}

// Parallel lines: two horizontal lines and a line crossing them.
export const PAR = { ux: 14, vx: 346, uy: 84, ly: 166, mx: 180, my: 125, min: MIN_LINES, max: 180 - MIN_LINES, over: 60 }

export type ParMark = { line: Line; pos: Pos; role: Role; text: string }
export function parallelFig(theta: number, marks: ParMark[]): Fig {
  const fig = emptyFig()
  const half = (PAR.ly - PAR.uy) / 2
  const t = half / Math.sin(rad(theta))
  const m = { x: PAR.mx, y: PAR.my }
  const p = along(m, theta, t)
  const q = along(m, theta + 180, t)
  fig.segs.push(seg({ x: PAR.ux, y: PAR.uy }, { x: PAR.vx, y: PAR.uy }))
  fig.segs.push(seg({ x: PAR.ux, y: PAR.ly }, { x: PAR.vx, y: PAR.ly }))
  fig.segs.push(seg(along(q, theta + 180, PAR.over), along(p, theta, PAR.over)))
  // A chevron on each line shows they are parallel.
  for (const y of [PAR.uy, PAR.ly]) {
    const x = PAR.vx - 14
    fig.chevrons.push(seg({ x: x - 7, y: y - 7 }, { x, y }), seg({ x, y }, { x: x - 7, y: y + 7 }))
  }
  for (const k of marks) {
    const at = k.line === 'U' ? p : q
    fig.marks.push({ at, from: posFrom(k.pos, theta), size: posSize(k.pos, theta), role: k.role, text: k.text, reach: 100 })
  }
  fig.dots.push(p, q)
  return fig
}

/** The spots an angle-facts parallel card marks: the known angle and x, from a pair that suits the situation. */
export function parallelSpots(t: AngleFactsTask, s: Solved): { theta: number; marks: ParMark[] } {
  const r = rng(hash(JSON.stringify([t.situation, t.unknown, t.known, 'pair'])))
  const pairs = PAIRS[t.situation as Parallel]
  const pair = pairs[Math.floor(r() * pairs.length)]
  const unknownLine: Line = t.unknown === 'upper' ? 'U' : 'L'
  const [ua, ub] = pair[0][0] === unknownLine ? [pair[0], pair[1]] : [pair[1], pair[0]]
  const given = s.sizes[0]
  const theta = ub[1] === 'TR' || ub[1] === 'BL' ? given : 180 - given
  return {
    theta,
    marks: [{ line: ub[0], pos: ub[1], role: 'given', text: deg(given) }, { line: ua[0], pos: ua[1], role: 'unknown', text: 'x' }],
  }
}

/**
 * The ways x's label can read once the learner has typed a size, widest first: "x = 55°", then "55°". The first that
 * leaves every label a clear place is drawn; x alone is what is drawn before anything is typed (and if neither fits).
 */
export function typedForms(typed: string): string[] {
  const digits = typed.replace(/\D/g, '').slice(0, 3)
  if (!digits) return []
  const n = String(Number(digits))
  return [`x = ${n}°`, `${n}°`]
}

/** The figure an angle-facts card draws, to scale, from the solved sizes; x's label reads `xText`. */
export function figureOf(t: AngleFactsTask, s: Solved, xText = 'x'): Fig {
  const fig = baseFigure(t, s, xText)
  for (const m of fig.marks) if (m.role === 'unknown') m.text = xText
  return fig
}

/**
 * What the card draws for the size the learner has typed: x's label in the widest form that fits with every other label
 * still inside its own angle, clear of the lines and nearest its own corner. Nothing typed, or no form fits: x.
 */
export function figureWithTyped(t: AngleFactsTask, s: Solved, typed: string): { fig: Fig; boxes: (Box | null)[]; form: 'long' | 'short' | 'letter' } {
  const forms = typedForms(typed)
  for (let i = 0; i < forms.length; i++) {
    const fig = figureOf(t, s, forms[i])
    if (fig.drawable !== false && sidesOk(fig) && canPlace(fig)) return { fig, boxes: placeLabels(fig), form: i === 0 ? 'long' : 'short' }
  }
  const fig = figureOf(t, s)
  return { fig, boxes: placeLabels(fig), form: 'letter' }
}

function baseFigure(t: AngleFactsTask, s: Solved, xText: string): Fig {
  const sit = t.situation as Situation
  const r = rng(hash(JSON.stringify([t.situation, t.unknown, t.known])))
  if (sit === 'straight-line') return lineFig(s.sizes, s.at)
  if (sit === 'round-point') return pointFig(s.sizes, s.at, 10 + 5 * Math.floor(r() * 12))
  if (sit === 'vertically-opposite') {
    const g = Math.floor(r() * 4)
    const side = r() < 0.5 ? 1 : 3
    const u = t.unknown === 'opposite' ? (g + 2) % 4 : (g + side) % 4
    const given = s.sizes[0]
    const theta = g % 2 === 0 ? given : 180 - given
    return crossFig(theta, 8 + 4 * Math.floor(r() * 6), g, deg(given), u, s.answer)
  }
  if (sit === 'triangle' || sit === 'quadrilateral') {
    const sizes = s.sizes
    // The shape is chosen with the letter, so it stays put as the learner types: only x's label changes.
    const tags = sizes.map((z, i): Tag => ({ size: z, role: i === s.at ? 'unknown' : 'given', text: i === s.at ? 'x' : deg(z) }))
    const shapes = sit === 'triangle' ? [triangleAt(sizes[0], sizes[1])] : quadShapes(sizes)
    let firstFig: Fig | null = null
    // The roundest shape whose labels all fit: a quadrilateral's angles leave its side lengths free.
    for (const raw of shapes.slice(0, 8)) {
      const fig = polyFig(raw.map(fitTo(raw, MARGIN_X, MARGIN_Y)), tags)
      if (sidesOk(fig) && canPlace(fig)) return fig
      firstFig ??= fig
    }
    return firstFig ?? { ...polyFig([0, 1, 2, 3].map((i) => ({ x: 60 + 60 * i, y: 60 + 20 * i })), tags), drawable: false }
  }
  if (sit === 'isosceles') {
    const left = r() < 0.5
    const given = s.sizes[0]
    const beta = t.unknown === 'base' ? s.answer : given
    const tag = (size: number, role: Role): Tag => ({ size, role, text: role === 'unknown' ? xText : deg(size) })
    const none: Tag = null
    if (t.unknown === 'base') {
      const x = tag(beta, 'unknown')
      return isoFig(beta, { base0: left ? x : none, base1: left ? none : x, apex: tag(given, 'given') })
    }
    const alpha = 180 - 2 * beta
    const g = tag(beta, 'given')
    if (t.unknown === 'apex') return isoFig(beta, { base0: left ? g : none, base1: left ? none : g, apex: tag(alpha, 'unknown') })
    return isoFig(beta, { base0: left ? g : tag(beta, 'unknown'), base1: left ? tag(beta, 'unknown') : g, apex: none })
  }
  const par = parallelSpots(t, s)
  return parallelFig(par.theta, par.marks)
}

// ---------------------------------------------------------------------------
// Labels: each sits inside its own angle, apart from every line and every other label.

export type Box = { x: number; y: number; w: number; h: number }
export const LABEL_H = 18
export const labelW = (text: string) => Math.max(22, text.length * 7.6 + 8)

const distPtSeg = (p: Pt, a: Pt, b: Pt): number => {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const l2 = dx * dx + dy * dy
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}
const ccw = (a: Pt, b: Pt, c: Pt) => (c.y - a.y) * (b.x - a.x) - (b.y - a.y) * (c.x - a.x)
const segsCross = (a: Pt, b: Pt, c: Pt, d: Pt): boolean => ccw(a, c, d) * ccw(b, c, d) < 0 && ccw(a, b, c) * ccw(a, b, d) < 0
const inBox = (box: Box, p: Pt) => p.x >= box.x && p.x <= box.x + box.w && p.y >= box.y && p.y <= box.y + box.h
export const corners = (b: Box): Pt[] => [{ x: b.x, y: b.y }, { x: b.x + b.w, y: b.y }, { x: b.x + b.w, y: b.y + b.h }, { x: b.x, y: b.y + b.h }]
export const distBoxPt = (b: Box, p: Pt): number => Math.hypot(Math.max(b.x - p.x, 0, p.x - (b.x + b.w)), Math.max(b.y - p.y, 0, p.y - (b.y + b.h)))
/** The distance between a box and a segment: zero when they touch or cross. */
export function distBoxSeg(b: Box, s: Seg): number {
  if (inBox(b, s.a) || inBox(b, s.b)) return 0
  const c = corners(b)
  for (let i = 0; i < 4; i++) if (segsCross(s.a, s.b, c[i], c[(i + 1) % 4])) return 0
  return Math.min(distBoxPt(b, s.a), distBoxPt(b, s.b), ...c.map((p) => distPtSeg(p, s.a, s.b)))
}
export function distBoxBox(a: Box, b: Box): number {
  return Math.hypot(Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w), 0), Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h), 0))
}

export const CLEAR = 3
export const EDGE = 3

/** Whether a point is inside a convex polygon (any winding). */
export function insideConvex(poly: readonly Pt[], p: Pt): boolean {
  let sign = 0
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)
    if (cross === 0) continue
    if (sign === 0) sign = Math.sign(cross)
    else if (Math.sign(cross) !== sign) return false
  }
  return true
}

function fits(box: Box, m: Mark, obstacles: Seg[], taken: Box[], inside: readonly Pt[], others: readonly Pt[]): boolean {
  if (box.x < EDGE || box.y < EDGE || box.x + box.w > PLATE_W - EDGE || box.y + box.h > PLATE_H - EDGE) return false
  if (distBoxPt(box, m.at) < ARC + 5) return false
  const c = corners(box)
  if (Math.max(...c.map((p) => dist(p, m.at))) > m.reach) return false
  if (inside.length && !c.every((p) => insideConvex(inside, p))) return false
  // Every corner in the angle: nearer its own lines than any other angle's.
  if (m.size < 360) {
    for (const p of c) {
      const d = norm360(angleOf(m.at, p) - m.from)
      if (d < 1.5 || d > m.size - 1.5) return false
    }
  }
  // Nearer its own corner than any other angle's.
  const own = distBoxPt(box, m.at)
  for (const o of others) if (distBoxPt(box, o) < own + 1) return false
  for (const s of obstacles) if (distBoxSeg(box, s) < CLEAR) return false
  for (const b of taken) if (distBoxBox(box, b) < CLEAR) return false
  return true
}

/**
 * Where each mark's label goes: on the angle's bisector, the nearest place to its arc where it is wholly inside the
 * angle, clear of every line and of every other label. When two labels want the same place the nearer-in choices are
 * tried again in turn, so a pair of angles that share a gap still both find a place. A null means no such place exists
 * (the tests hold every supported figure to none).
 */
export function placeLabels(fig: Fig, keepOut: Box[] = []): (Box | null)[] {
  const whole = placeAll(fig, keepOut)
  if (whole.out) return whole.out
  // No complete set: place what can be, tightest first, so the caller can see which could not.
  const placed: Box[] = []
  const partial: (Box | null)[] = Array<Box | null>(fig.marks.length).fill(null)
  for (const i of whole.order) {
    const b = whole.optionsOf(i).find((o) => placed.every((t) => distBoxBox(o, t) >= CLEAR))
    if (b) {
      partial[i] = b
      placed.push(b)
    }
  }
  return partial
}

/** Whether every mark has a place, without working out the places of a figure that has none. */
export const canPlace = (fig: Fig, keepOut: Box[] = []): boolean => placeAll(fig, keepOut).out !== null

function placeAll(fig: Fig, keepOut: Box[]): { out: Box[] | null; order: number[]; optionsOf(i: number): Box[] } {
  const obstacles = [...fig.segs, ...fig.ticks, ...fig.chevrons]
  const n = fig.marks.length
  // Every place a label could go, nearest its own arc first, worked out only when asked for.
  const cache: (Box[] | undefined)[] = []
  const optionsOf = (i: number): Box[] => (cache[i] ??= (() => {
    const m = fig.marks[i]
    const w = labelW(m.text)
    const mid = m.from + m.size / 2
    const others = fig.marks.filter((o) => dist(o.at, m.at) > 1).map((o) => o.at)
    const out: Box[] = []
    // Nearest its arc first, and on the bisector before a little to either side of it.
    for (let r = ARC + 10; r <= Math.min(m.reach, 130) && out.length < 60; r += 2) {
      for (const off of [0, 8, -8, 16, -16, 24, -24]) {
        const c = along(m.at, mid + off, r)
        const box = { x: c.x - w / 2, y: c.y - LABEL_H / 2, w, h: LABEL_H }
        if (fits(box, m, obstacles, keepOut, fig.fill, others)) out.push(box)
      }
    }
    return out
  })())
  const order = fig.marks.map((_, i) => i).sort((a, b) => fig.marks[a].size - fig.marks[b].size || a - b)
  const out: (Box | null)[] = Array<Box | null>(n).fill(null)
  const taken: Box[] = []
  // A figure with no way to place every label is given up on quickly, not searched to the end.
  let budget = 3000
  const go = (k: number): boolean => {
    if (k === order.length) return true
    const i = order[k]
    for (const b of optionsOf(i)) {
      if (--budget < 0) return false
      if (taken.some((t) => distBoxBox(b, t) < CLEAR)) continue
      out[i] = b
      taken.push(b)
      if (go(k + 1)) return true
      taken.pop()
      out[i] = null
    }
    return false
  }
  // The tightest angle having no place at all settles it: no search is needed.
  const complete = order.every((i) => optionsOf(i).length > 0) && go(0)
  return { out: complete ? (out as Box[]) : null, order, optionsOf }
}

/** The shortest a polygon's side may be: the arcs at its two ends then do not touch. */
export const MIN_SIDE = 2 * ARC + 2
export function sidesOk(fig: Fig): boolean {
  return fig.fill.every((p, i) => dist(p, fig.fill[(i + 1) % fig.fill.length]) >= MIN_SIDE)
}

/**
 * Whether every label of an angle-facts figure has a clear place, and the figure can still show the size the learner
 * types for x (a label for it, among the others, in the widest form that fits).
 */
export function labelsFit(t: AngleFactsTask, s: Solved): boolean {
  const fig = figureOf(t, s)
  if (!(fig.drawable !== false && sidesOk(fig) && canPlace(fig))) return false
  return figureWithTyped(t, s, String(s.answer)).form !== 'letter'
}

/** The nearest known sizes (one angle changed, as little as possible) whose figure can be labelled, or null. */
export function nearestFeasible(t: AngleFactsTask): number[] | null {
  for (let d = 1; d <= 60; d++) {
    for (let i = 0; i < t.known.length; i++) {
      for (const sign of [-1, 1]) {
        const known = t.known.map((k, j) => (j === i ? k + sign * d : k))
        const task = { ...t, known }
        const s = solveTask(task)
        if (!Array.isArray(s) && labelsFit(task, s)) return known
      }
    }
  }
  return null
}

function tightFault(t: AngleFactsTask, s: Solved): string[] {
  if (labelsFit(t, s)) return []
  const near = nearestFeasible(t)
  const key = t.situation === 'isosceles' ? `isosceles-${t.unknown}` : t.situation === 'vertically-opposite' ? 'vertically-opposite1' : isParallel(t.situation) ? 'parallel1' : `${t.situation}${t.known.length}`
  const use = near ? `"known": [${near.join(', ')}]` : egKnown(key)
  return [`${s.sizes.map((z, i) => (i === s.at ? `x = ${z}°` : deg(z))).join(', ')} draw a figure too tight to letter every angle clearly (a thin shape leaves no room beside a corner). Make the smallest angle bigger, or the others smaller: use e.g. ${use}.`]
}

export const arcPath = (m: Mark): string => {
  const a = along(m.at, m.from, ARC)
  const b = along(m.at, m.from + m.size, ARC)
  const f = (v: number) => Math.round(v * 100) / 100
  return `M ${f(a.x)} ${f(a.y)} A ${ARC} ${ARC} 0 ${m.size > 180 ? 1 : 0} 0 ${f(b.x)} ${f(b.y)}`
}

// ---------------------------------------------------------------------------
// angle-facts: what the figure is, in words, for a screen reader. It says what is seen, never the answer.

const POS_WORDS: Record<Pos, string> = {
  TR: 'above the line and to the right of the crossing line',
  TL: 'above the line and to the left of the crossing line',
  BL: 'below the line and to the left of the crossing line',
  BR: 'below the line and to the right of the crossing line',
}
const spokenAngle = (m: { text: string }) => (m.text === 'x' ? 'x' : `${m.text.replace('°', '')} degrees`)

export function figureText(t: AngleFactsTask, s: Solved): string {
  const sit = t.situation as Situation
  const labels = s.sizes.map((z, i) => (i === s.at ? 'x' : `${z} degrees`))
  if (sit === 'straight-line') return `A straight horizontal line with ${s.sizes.length - 1} ray${s.sizes.length === 2 ? '' : 's'} rising from one point on it, making ${s.sizes.length} angles. From left to right the angles are marked ${labels.join(', ')}.`
  if (sit === 'round-point') return `${s.sizes.length} lines meet at one point, making ${s.sizes.length} angles round it. Going anticlockwise the angles are marked ${labels.join(', ')}.`
  if (sit === 'vertically-opposite') {
    const given = labels[0]
    return `Two straight lines cross. One angle is marked ${given}, and ${t.unknown === 'opposite' ? 'the angle across the crossing from it' : 'an angle next to it'} is marked x.`
  }
  if (sit === 'triangle') return `A triangle with its three angles marked. At the bottom left ${labels[0]}, at the bottom right ${labels[1]}, at the top ${labels[2]}.`
  if (sit === 'quadrilateral') return `A four-sided shape with its four angles marked. Going anticlockwise from the bottom left the angles are ${labels.join(', ')}.`
  if (sit === 'isosceles') {
    const g = labels[0]
    const what = t.unknown === 'base' ? `The angle between the equal sides is marked ${g}, and one angle at the base is marked x.`
      : t.unknown === 'apex' ? `One angle at the base is marked ${g}, and the angle between the equal sides is marked x.`
      : `One angle at the base is marked ${g}, and the other angle at the base is marked x.`
    return `A triangle whose two sloping sides are marked with a tick each, to show they are the same length. ${what}`
  }
  const par = parallelSpots(t, s)
  const word = (k: ParMark) => `${spokenAngle(k)} at the ${k.line === 'U' ? 'upper' : 'lower'} crossing, ${POS_WORDS[k.pos]}`
  return `Two parallel lines, each marked with an arrow, are crossed by a third line. One angle is marked: ${word(par.marks[0])}. Another is marked ${word(par.marks[1])}.`
}

// ---------------------------------------------------------------------------
// drag-invariant.

export const TRI = { ax: 70, bx: 290, y: 214, lo: 35, hi: 110, top: 20, left: 16, right: 344 }
export const TRI_START: [number, number] = [50, 70]

/** The apex for base angles a and b (whole degrees) on the fixed base. */
export function triApex(a: number, b: number): Pt {
  const c = TRI.bx - TRI.ax
  return along({ x: TRI.ax, y: TRI.y }, a, (c * Math.sin(rad(b))) / Math.sin(rad(180 - a - b)))
}
export function triValid(a: number, b: number): boolean {
  if (!Number.isInteger(a) || !Number.isInteger(b)) return false
  const c = 180 - a - b
  if (a < TRI.lo || a > TRI.hi || b < TRI.lo || b > TRI.hi || c < TRI.lo || c > TRI.hi) return false
  const p = triApex(a, b)
  return p.x >= TRI.left && p.x <= TRI.right && p.y >= TRI.top
}
let LATTICE: { a: number; b: number; x: number; y: number }[] | null = null
/** Every shape the corner can be dragged to: base angles that are whole degrees, the corner on the plate. */
export function triLattice() {
  if (!LATTICE) {
    LATTICE = []
    for (let a = TRI.lo; a <= TRI.hi; a++) {
      for (let b = TRI.lo; b <= TRI.hi; b++) {
        if (!triValid(a, b)) continue
        const p = triApex(a, b)
        LATTICE.push({ a, b, x: p.x, y: p.y })
      }
    }
  }
  return LATTICE
}
/** The shape whose corner is nearest a point on the plate. */
export function triSnap(x: number, y: number): [number, number] {
  let best = triLattice()[0]
  let bd = Infinity
  for (const c of triLattice()) {
    const d = (c.x - x) ** 2 + (c.y - y) ** 2
    if (d < bd) {
      bd = d
      best = c
    }
  }
  return [best.a, best.b]
}
/** One key press moves the corner: right or left along the base, up or down. Stays put when the new shape cannot be drawn. */
export function triStep(ab: [number, number], key: string, big: boolean): [number, number] {
  const k = big ? 5 : 1
  const d: Record<string, [number, number]> = { ArrowRight: [-k, k], ArrowLeft: [k, -k], ArrowUp: [k, k], ArrowDown: [-k, -k] }
  if (!own(d, key)) return ab
  const next: [number, number] = [ab[0] + d[key][0], ab[1] + d[key][1]]
  return triValid(next[0], next[1]) ? next : ab
}
/** A handful of different shapes, for a button that jumps between them. */
export const TRI_SHAPES: [number, number][] = [[50, 70], [70, 45], [40, 55], [60, 60], [35, 100], [100, 35]]
export function readAB(raw: unknown): [number, number] {
  const v = (raw as { ab?: unknown } | null)?.ab
  return Array.isArray(v) && v.length === 2 && triValid(v[0] as number, v[1] as number) ? [v[0] as number, v[1] as number] : TRI_START
}

/** How far the line can be tilted when it is held: a narrower range than the figures use, so the handle never lies over a label. */
export const DRAG = { min: 45, max: 135 }
export const THETA_START = 65
/** Where the line stands at the last of the tilts the learner is asked to try. */
export const THETA_LAST = 115
export function readTheta(raw: unknown): number {
  const v = (raw as { theta?: unknown } | null)?.theta
  return typeof v === 'number' && Number.isInteger(v) && v >= DRAG.min && v <= DRAG.max ? v : THETA_START
}
/** The pair a parallel card marks, as two spots on the figure. */
export function dragSpots(pair: PairName): [Spot, Spot] {
  return PAIRS[pair][0]
}
export function dragFigure(theta: number, pair: PairName): Fig {
  const [a, b] = dragSpots(pair)
  return parallelFig(theta, [
    { line: a[0], pos: a[1], role: 'given', text: deg(posSize(a[1], theta)) },
    { line: b[0], pos: b[1], role: 'given', text: deg(posSize(b[1], theta)) },
  ])
}
/** The top end of the crossing line, which is where the learner takes hold. */
export function handleOf(theta: number): Pt {
  const t = (PAR.ly - PAR.uy) / 2 / Math.sin(rad(theta))
  return along(along({ x: PAR.mx, y: PAR.my }, theta, t), theta, PAR.over)
}
/** The tilt of the line a point on the plate lies along, from the middle, kept within what is drawn. */
export function thetaFromPoint(x: number, y: number): number {
  let d = (Math.atan2(-(y - PAR.my), x - PAR.mx) * 180) / Math.PI
  if (d < 0) d += 180
  if (d >= 180) d -= 180
  return Math.max(DRAG.min, Math.min(DRAG.max, Math.round(d)))
}

export type Rule = 'equal' | 'supplementary' | 'unrelated'
export const RULES: { id: Rule; text: string }[] = [
  { id: 'equal', text: 'They are always equal' },
  { id: 'supplementary', text: 'They always add up to 180°' },
  { id: 'unrelated', text: 'There is no rule: they change on their own' },
]
export const PAIR_LABELS: { id: PairName; text: string }[] = [
  { id: 'alternate', text: 'Alternate' },
  { id: 'co-interior', text: 'Co-interior' },
  { id: 'corresponding', text: 'Corresponding' },
  { id: 'vertically-opposite', text: 'Vertically opposite' },
]
export const ruleOf = (pair: PairName): Rule => (pair === 'co-interior' ? 'supplementary' : 'equal')

export type DragVerdict = { ok: boolean; wrongIds: string[] }
export function dragVerdict(t: DragTask, state: unknown): DragVerdict {
  if (t.unread?.length) return { ok: false, wrongIds: [] }
  const wrong: string[] = []
  if (t.figure === 'triangle') {
    if (typedNumber(state) !== 180) wrong.push('answer')
  } else {
    if (!t.pair) return { ok: false, wrongIds: [] }
    if (readText(state, 'rule') !== ruleOf(t.pair)) wrong.push('rule')
    if (readText(state, 'name') !== t.pair) wrong.push('name')
  }
  if (readMoves(state) < MIN_MOVES) wrong.push('drag')
  return { ok: wrong.length === 0, wrongIds: wrong }
}

function dragProblems(t: DragTask): string[] {
  if (t.unread?.length) return t.unread
  return t.figure === 'parallel' && !t.pair ? ['Say which pair of angles to mark on the parallel lines: "pair": "alternate", "corresponding", "co-interior" or "vertically-opposite".'] : []
}

export function dragSaid(t: DragTask, state: unknown, marked: 'right' | 'wrong' | 'shown'): string[] {
  if (t.unread?.length) return []
  const v = dragVerdict(t, state)
  const moved = readMoves(state) >= MIN_MOVES
  if (t.figure === 'triangle') {
    const typed = typedNumber(state)
    const head = 'The three angles of a triangle always add up to 180°, however you drag it.'
    if (marked !== 'wrong' || v.ok) return [head, 'Add the three marked angles for any shape you make: the total is the same every time.']
    const lines: string[] = []
    if (typed === null) lines.push('Type what the three angles add up to.')
    else if (typed !== 180) lines.push(`You wrote ${typed}°. ${head}`)
    else lines.push('180° is right.')
    if (!moved) lines.push(`Drag the corner to at least ${MIN_MOVES} different shapes first, adding the three angles each time, to see it stays true.`)
    return lines
  }
  if (!t.pair) return []
  const rule = ruleOf(t.pair)
  const ruleText = RULES.find((r) => r.id === rule)?.text ?? ''
  const nameText = PAIR_LABELS.find((p) => p.id === t.pair)?.text.toLowerCase() ?? ''
  const fact = `${ruleText.replace(/^They/, 'These two angles')}, and they are ${nameText} angles.`
  if (marked !== 'wrong' || v.ok) return [fact, 'However you tilt the crossing line, one marked angle changes and the other changes with it, in the same way.']
  const lines: string[] = []
  const gave = readText(state, 'rule')
  const named = readText(state, 'name')
  if (!gave && !named) lines.push('Choose what stays true about the two marked angles, and what they are called.')
  else {
    if (gave && gave !== rule) lines.push(`You chose "${RULES.find((r) => r.id === gave)?.text ?? gave}", but ${ruleText.toLowerCase()}.`)
    if (!gave) lines.push('You have not chosen what stays true.')
    if (named && named !== t.pair) lines.push(`You called them ${PAIR_LABELS.find((p) => p.id === named)?.text.toLowerCase() ?? named}; these are ${nameText} angles.`)
    if (!named) lines.push('You have not named the pair.')
  }
  if (!moved) lines.push(`Tilt the line to at least ${MIN_MOVES} different angles first, watching both numbers, to see which rule stays true.`)
  return lines
}

export function dragFigureText(t: DragTask, ab: [number, number], theta: number): string {
  if (t.figure === 'triangle') {
    const c = 180 - ab[0] - ab[1]
    return `A triangle on a fixed base. The top corner can be dragged. Its angles are now ${ab[0]} degrees at the bottom left, ${ab[1]} degrees at the bottom right and ${c} degrees at the top.`
  }
  const [a, b] = dragSpots(t.pair ?? 'alternate')
  const word = (s: Spot) => `${posSize(s[1], theta)} degrees at the ${s[0] === 'U' ? 'upper' : 'lower'} crossing, ${POS_WORDS[s[1]]}`
  return `Two parallel lines, each marked with an arrow, are crossed by a third line that can be tilted. Two angles are marked: ${word(a)}, and ${word(b)}.`
}

// ---------------------------------------------------------------------------
// polygon-sum.

export const polygonSum = (n: number): number => (n - 2) * 180
/** One angle of the regular polygon: a whole number of degrees exactly when n divides 360. */
export const regularWhole = (n: number): boolean => 360 % n === 0
export const regularAngle = (n: number): number => polygonSum(n) / n
export const polygonAnswer = (t: PolygonTask): number => (t.ask === 'sum' ? polygonSum(t.sides) : regularAngle(t.sides))

/** The corners of the regular polygon, anticlockwise from the bottom left, as drawn. */
export function regularPoints(n: number): Pt[] {
  const c = { x: PLATE_W / 2, y: PLATE_H / 2 }
  return Array.from({ length: n }, (_, k) => along(c, -90 - 180 / n + (k * 360) / n, 104))
}
/** The regions the lines from corner 0 cut the polygon into: corner lists, with whether each is a triangle. */
export function regions(n: number, lines: readonly number[]): { corners: number[]; triangle: boolean }[] {
  const rays = [1, ...[...new Set(lines)].filter((k) => k >= 2 && k <= n - 2).sort((a, b) => a - b), n - 1]
  const out: { corners: number[]; triangle: boolean }[] = []
  for (let i = 0; i + 1 < rays.length; i++) {
    const cs = [0]
    for (let k = rays[i]; k <= rays[i + 1]; k++) cs.push(k)
    out.push({ corners: cs, triangle: rays[i + 1] - rays[i] === 1 })
  }
  return out
}
export const triangleCount = (n: number, lines: readonly number[]): number => regions(n, lines).filter((r) => r.triangle).length
export function readLines(raw: unknown, n: number): number[] {
  const v = (raw as { lines?: unknown } | null)?.lines
  if (!Array.isArray(v)) return []
  return [...new Set(v.filter((k): k is number => typeof k === 'number' && Number.isInteger(k) && k >= 2 && k <= n - 2))].sort((a, b) => a - b)
}

function polygonProblems(t: PolygonTask): string[] {
  if (t.unread?.length) return t.unread
  const n = t.sides
  if (!Number.isInteger(n)) return [`${n} sides is not a whole number. Use a whole number from ${MIN_SIDES} to ${MAX_SIDES}, e.g. 6.`]
  if (n < 3) return [`${n} sides is not a polygon. Use ${MIN_SIDES} to ${MAX_SIDES}, e.g. 6.`]
  if (n < MIN_SIDES) return [`A triangle is already one triangle, so there is no corner to split it from and nothing for the learner to do. Use ${MIN_SIDES} to ${MAX_SIDES} sides, e.g. "sides": 6.`]
  if (n > MAX_SIDES) return [`${n} sides is more than the scene draws (${MAX_SIDES}): the corners would be too close to tap. Use ${MIN_SIDES} to ${MAX_SIDES}, e.g. 8.`]
  if (t.ask === 'one-angle' && !regularWhole(n)) {
    const near = [4, 5, 6, 8, 9, 10, 12].reduce((a, b) => (Math.abs(b - n) < Math.abs(a - n) ? b : a))
    return [`One angle of a regular ${n}-sided polygon is ${Math.round((polygonSum(n) / n) * 100) / 100}°, not a whole number of degrees. Ask for the sum with "ask": "sum", or use a polygon whose sides divide 360: 4, 5, 6, 8, 9, 10 or 12 (e.g. ${near}).`]
  }
  return []
}

export function polygonVerdict(t: PolygonTask, state: unknown): { ok: boolean; wrongIds: string[] } {
  if (polygonProblems(t).length) return { ok: false, wrongIds: [] }
  const ok = typedNumber(state) === polygonAnswer(t)
  return { ok, wrongIds: ok ? [] : ['answer'] }
}

export function polygonSaid(t: PolygonTask, state: unknown, marked: 'right' | 'wrong' | 'shown'): string[] {
  if (polygonProblems(t).length) return []
  const n = t.sides
  const v = polygonVerdict(t, state)
  const typed = typedNumber(state)
  const lines: string[] = []
  const split = `A polygon with ${n} sides splits into ${n - 2} triangles from one corner, and each triangle's angles add up to 180°: ${n - 2} × 180° = ${polygonSum(n)}°.`
  const each = `The ${n} angles of a regular polygon are equal: ${polygonSum(n)}° ÷ ${n} = ${regularAngle(n)}° each.`
  const body = t.ask === 'sum' ? [split] : [split, each]
  if (marked !== 'wrong' || v.ok) lines.push(`Yes: ${polygonAnswer(t)}°.`, ...body)
  else lines.push(typed === null ? 'You have not typed an answer yet.' : `You wrote ${typed}°, but the answer is ${polygonAnswer(t)}°.`, ...body)
  const lined = readLines(state, n)
  if (lined.length) {
    const k = triangleCount(n, lined)
    lines.push(`You drew ${k} triangle${k === 1 ? '' : 's'}${k === n - 2 ? ', which is all of them' : `; a ${n}-sided polygon needs ${n - 2}`}.`)
  }
  return lines
}

export function polygonText(t: PolygonTask): string {
  return `A regular polygon with ${t.sides} equal sides. Its corners are numbered 1 to ${t.sides} anticlockwise from the bottom left. Corner 1 is the corner lines are drawn from.`
}

// ---------------------------------------------------------------------------
// The card's prompt: what it may not say.

const REASON_NAMES: Record<ReasonId, RegExp> = {
  'straight': /angles?\s+(?:on|along)\s+a\s+(?:straight\s+)?line/i,
  'point': /angles?\s+(?:round|around|at|about)\s+a\s+point/i,
  'vertical': /vertically\s+opposite|vertical\s+angles?/i,
  'triangle': /angles?\s+(?:in|of)\s+a\s+triangle|angle\s+sum\s+of\s+a\s+triangle/i,
  'quadrilateral': /angles?\s+(?:in|of)\s+a\s+quadrilateral|angle\s+sum\s+of\s+a\s+quadrilateral/i,
  'base': /base\s+angles?/i,
  'alternate': /\balternate\b|\bz[-\s]?angles?\b/i,
  'corresponding': /\bcorresponding\b|\bf[-\s]?angles?\b/i,
  'co-interior': /co-?interior|\ballied\b|\bsame[-\s]side\b/i,
}
const SUM_RULE = /(?:add(?:s|ed)?\s+(?:up\s+)?to|sum(?:s)?\s+(?:to|of|is)|totals?|make(?:s)?|come(?:s)?\s+to)[^.?!]{0,25}\b(?:180|360)\b/i
const EQUAL_RULE = /\bangles?\b[^.?!]{0,30}\b(?:are|is|stay|stays|must\s+be|will\s+be)\s+(?:all\s+)?(?:equal|the\s+same)\b|\bequal\s+angles\b/i

const near = (text: string, re: RegExp) => re.exec(text)?.[0].trim()

function factsPromptFaults(t: AngleFactsTask, prompt: string): string[] {
  const s = solveTask(t)
  if (Array.isArray(s)) return []
  const out: string[] = []
  for (const id of s.reasons) {
    const hit = near(prompt, REASON_NAMES[id])
    if (hit) out.push(`the prompt names the fact the learner is to pick ("${hit}"): ask for x and the reason, and leave the fact out (it is said once marked).`)
  }
  const rule = near(prompt, SUM_RULE) ?? near(prompt, EQUAL_RULE)
  if (rule && !out.length) out.push(`the prompt states a rule ("${rule}"), which is the reason the learner is to give: ask for x and the reason, and leave the rule out.`)
  if (!t.known.includes(s.answer)) {
    const hit = new RegExp(`(?<![\\d.])${s.answer}\\s*(?:°|degrees?)|\\bx\\s*(?:=|is|equals)\\s*${s.answer}(?!\\d|\\.\\d)`, 'i').exec(prompt)
    if (hit) out.push(`the prompt gives the size of x (${s.answer}°), which the learner is to work out: leave it out.`)
  }
  return out
}

function dragPromptFaults(t: DragTask, prompt: string): string[] {
  const out: string[] = []
  if (t.figure === 'triangle') {
    if (/\b180\b/.test(prompt)) out.push('the prompt gives the total the three angles make (180), which the learner is to find by dragging: ask what they add up to and leave the number out.')
    return out
  }
  const names = near(prompt, /\balternate\b|\bcorresponding\b|co-?interior|\ballied\b|vertically\s+opposite|\bz[-\s]?angles?\b|\bf[-\s]?angles?\b/i)
  if (names) out.push(`the prompt names the pair ("${names}"), which the learner is asked to name: say "the two marked angles".`)
  const rule = near(prompt, /\b(?:stay|stays|remain|remains|always|are)\s+(?:the\s+same|equal)\b|\badd(?:s)?\s+up\s+to\b|\b180\b/i)
  if (rule) out.push(`the prompt says what stays true ("${rule}"), which the learner is to find by tilting the line: ask what stays true and leave it out.`)
  return out
}

function polygonPromptFaults(t: PolygonTask, prompt: string): string[] {
  const out: string[] = []
  if (polygonProblems(t).length) return out
  const n = t.sides
  const answer = polygonAnswer(t)
  const formula = near(prompt, /\(?\s*\bn\b\s*[-−–]\s*2\s*\)?|[-−–]\s*2\s*\)?\s*[×x*]\s*180|180\s*[×x*]\s*\(|n\s*[-−–]\s*2\s*triangles?/i)
  if (formula) out.push(`the prompt gives the formula ("${formula}"), which the learner is to find by splitting into triangles: leave it out.`)
  const ext = near(prompt, /exterior[^.?!]{0,30}\b360\b|\b360\b[^.?!]{0,30}exterior/i)
  if (ext) out.push(`the prompt gives the exterior-angle rule ("${ext}"): leave it out.`)
  const count = [...prompt.matchAll(/(\d+)\s+triangles?\b/gi)].find((m) => Number(m[1]) === n - 2)
  if (count) out.push(`the prompt says the polygon makes ${n - 2} triangles, which the learner counts after splitting: leave it out.`)
  if (new RegExp(`(?<![\\d.])${answer}\\s*(?:°|degrees?)`, 'i').test(prompt)) out.push(`the prompt gives the answer (${answer}°): leave it out.`)
  for (const m of prompt.matchAll(/\b(triangle|quadrilateral|pentagon|hexagon|heptagon|octagon|nonagon|decagon|hendecagon|dodecagon)\b/gi)) {
    const word = m[1].toLowerCase()
    if (SIDES_WORDS[word] !== n) {
      out.push(`the prompt says "${word}", but the card draws ${n} sides (a ${POLYGON_NAMES[n]}): make them agree.`)
      break
    }
  }
  const said = [...prompt.matchAll(/(\d+)[-\s]sided/gi)].map((m) => Number(m[1])).find((k) => k !== n)
  if (said !== undefined) out.push(`the prompt says ${said} sides, but the card draws ${n}: make them agree.`)
  return out
}

// ---------------------------------------------------------------------------

export const geometryConstructionEngine: SceneEngine<GeometryConfig, GeometryState> = {
  id: 'geometry-construction',
  // Phrases a station on these ideas would use. scenesFor wants every word of a phrase in the station's title, step and goal,
  // so "angles in a triangle" is never "Angle of incidence" nor "Triangle of forces", and there is no bare "angle", "triangle" or
  // "parallel". Words are matched by a five-letter stem, so "angles in a triangle" also finds "Right-angled triangles: finding
  // angles" (angled ~ angles): the one near miss the phrases cannot avoid. "Alternate" and "corresponding" are not alone, as
  // "alternate segment" (circle theorems) and "corresponding sides" (similar shapes) are other ideas. sceneCatalogue offers the
  // entry on any one word, so it is also offered (only offered) to a station that merely has "angle".
  covers: [
    'angle facts', 'angles in a triangle', 'angles in a quadrilateral', 'angles on a straight line', 'angles round a point',
    'vertically opposite angles', 'angles in parallel lines', 'alternate and corresponding angles', 'co-interior angles',
    'base angles of isosceles triangles', 'angles in polygons', 'interior angles of polygons', 'angle sum of a polygon',
  ],
  // The learner works out the size of an angle from the others, and what stays true as a figure changes.
  isolates: 'magnitude',

  parse: parseTask,

  faults(config) {
    const t = config.task
    if (t.kind === 'angle-facts') {
      const s = solveTask(t)
      return Array.isArray(s) ? s : tightFault(t, s)
    }
    if (t.kind === 'drag-invariant') return dragProblems(t)
    return polygonProblems(t)
  },

  promptFaults(config, prompt) {
    const t = config.task
    if (t.unread?.length) return []
    if (t.kind === 'angle-facts') return factsPromptFaults(t, prompt)
    return t.kind === 'drag-invariant' ? dragPromptFaults(t, prompt) : polygonPromptFaults(t, prompt)
  },

  initial(config) {
    const t = config.task
    if (t.kind === 'angle-facts') return { value: '', reasons: [] }
    if (t.kind === 'drag-invariant') return { ab: TRI_START, theta: THETA_START, moves: 0, value: '', rule: '', name: '' }
    return { value: '', lines: [] }
  },

  check(config, state) {
    const t = config.task
    if (t.kind === 'angle-facts') {
      const v = factsVerdict(t, state)
      return { ok: v.ok, wrongIds: v.wrongIds }
    }
    if (t.kind === 'drag-invariant') return dragVerdict(t, state)
    return polygonVerdict(t, state)
  },

  solve(config) {
    const t = config.task
    if (t.kind === 'angle-facts') {
      const s = solveTask(t)
      return Array.isArray(s) ? { value: '', reasons: [] } : { value: String(s.answer), reasons: s.reasons }
    }
    if (t.kind === 'drag-invariant') {
      // Solved after the learner has tried several shapes: the figure stands at the last of them, not where it began.
      return { ab: TRI_SHAPES[TRI_SHAPES.length - 1], theta: THETA_LAST, moves: MIN_MOVES, value: t.figure === 'triangle' ? '180' : '', rule: t.pair ? ruleOf(t.pair) : '', name: t.pair ?? '' }
    }
    // The polygon is left split into triangles from corner 1, as the learner would split it to find the sum.
    return { value: String(polygonAnswer(t)), lines: Array.from({ length: Math.max(0, t.sides - 3) }, (_, i) => i + 2) }
  },

  View: GeometryConstructionView,

  prompt: `SCENE "geometry-construction" -- angle facts on accurate figures, to scale, in whole degrees. Three cards.
  "angle-facts": known angles are shown in degrees and the angle to find as x ("x = 55°" once 55 is typed); the learner types x and ticks the facts used. The answer and facts are held back until marked.
  "drag-invariant": a triangle corner, or a line across two parallels, is dragged, with the angles shown live. The sum or the rule that stays true is held back until marked.
  "polygon-sum": a regular polygon is split into triangles by tapping. Its angle sum is held back until marked.
  For lower secondary and IGCSE Mathematics 0580. The engine draws the figure and does all the arithmetic; you never write a
  coordinate, a size you have not chosen, or an answer.
  "angle-facts" in full: you name a situation. The card draws it with the known angles labelled with their sizes in degrees, arcs
  marking each angle, and the angle to find labelled x. The learner types the size of x and ticks the fact (or facts) that justify
  it from one fixed list of nine exam phrasings (the same list, in the same order, on every card). Both are marked and said back; the
  size of x and the facts that fit are shown only once the card is marked.
  Situations: "straight-line" (2 to 4 angles on a line), "round-point" (3 to 5 angles), "vertically-opposite" (two crossing
  lines), "triangle", "quadrilateral", "isosceles" (equal sides ticked), "alternate", "corresponding" and "co-interior" (two
  parallel lines, marked with arrows, crossed by a third line).
  "drag-invariant" in full: the learner drags a corner of a triangle (figure "triangle"), or tilts the line across two parallel lines
  (figure "parallel-lines", with a "pair" of marked angles), with the angles shown live as whole numbers. They say what stays true:
  what the three angles add up to, or the rule joining the two marked angles and what the pair is called. The sum and the rule are
  never shown; it is not right until the figure has been moved to several shapes.
  "polygon-sum" in full: a regular polygon of 4 to 12 sides. The learner types the sum of its interior angles ("ask": "sum") or one
  interior angle ("ask": "one-angle"). They may tap corners to split it into triangles from one corner, or use the split button;
  the triangles are counted when it is marked, and the sum, the angle and the triangle count are shown only then.
  For: angle facts; angles on a straight line, round a point, in a triangle, in a quadrilateral; vertically opposite angles;
  isosceles triangles; alternate, corresponding and co-interior angles; angles in polygons; the angle sum of a polygon. Not for:
  constructions with ruler and compass, loci, bearings, circle theorems, exterior angles, trigonometry or algebraic angles.
  config: { "task": { "kind":"angle-facts", "situation":"<straight-line | round-point | vertically-opposite | triangle |
                      quadrilateral | isosceles | alternate | corresponding | co-interior>", "unknown":"<which angle is x>",
                      "known":[<whole degrees>], "variant":<1, 2, 3...> } }
            -- everything but "situation" is optional. Left out, the engine picks whole-degree sizes and the place of x, and "variant"
            chooses a different figure of the same situation. "unknown" is: "first".."fifth" or "last" (straight-line, round-point,
            counting in the order drawn); "bottom-left", "bottom-right", "top" (triangle); those and "top-right", "top-left"
            (quadrilateral); "apex", "base" (a base angle, the apex known) or "other-base" (isosceles); "opposite" or "adjacent"
            (vertically-opposite); "upper" or "lower", the line that crosses x (parallel lines). "known" lists the other angles,
            left to right, with x left out: 1 to 3 on a line, 2 to 4 round a point, 2 for a triangle, 3 for a quadrilateral, 1 for
            the rest. Angles are at least 20 (30 on crossing and parallel lines), the angle left for x too; the sum must leave x.
            An isosceles apex must be even. Sizes that cannot be drawn are refused, with ones that can.
       or { "task": { "kind":"drag-invariant", "figure":"triangle" } }
       or { "task": { "kind":"drag-invariant", "figure":"parallel-lines", "pair":"<alternate | corresponding | co-interior | vertically-opposite>" } }
       or { "task": { "kind":"polygon-sum", "sides":<4 to 12>, "ask":"<sum | one-angle>" } }
            -- "one-angle" needs sides that divide 360 (4, 5, 6, 8, 9, 10, 12).
  - the prompt names the task and what to find. It never gives the size of x, the reason or fact (the rule, "alternate",
    "angles on a straight line", "base angles"), what a triangle's angles add up to, the rule joining a marked pair or its name,
    the polygon formula "(n - 2) x 180", or the polygon's triangle count or angle.
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Find the size of angle x and give a reason for your answer.",
    "payload": { "engine":"geometry-construction", "config": { "task": { "kind":"angle-facts", "situation":"straight-line", "known":[125] } } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"magnitude", "apparatus":"scene:geometry-construction", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"The two lines are parallel. Work out angle x and say which fact you used.",
    "payload": { "engine":"geometry-construction", "config": { "task": { "kind":"angle-facts", "situation":"co-interior", "known":[65], "unknown":"lower" } } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"magnitude", "apparatus":"scene:geometry-construction", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drag the top corner to different places. What do the three angles always add up to?",
    "payload": { "engine":"geometry-construction", "config": { "task": { "kind":"drag-invariant", "figure":"triangle" } } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"magnitude", "apparatus":"scene:geometry-construction", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Find the sum of the interior angles of this polygon. Split it into triangles to help.",
    "payload": { "engine":"geometry-construction", "config": { "task": { "kind":"polygon-sum", "sides":6, "ask":"sum" } } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"magnitude", "apparatus":"scene:geometry-construction", "why":"..." } }`,
}

registerEngine(geometryConstructionEngine as SceneEngine<unknown, unknown>)
