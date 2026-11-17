// lib/studylab/engines/loci-constructions/config.ts
//
// A locus is made by a moving point. `trace` gives the learner a pencil: two live distances
// answer every move, and the pencil leaves blue ink only while its condition holds. Coverage
// is measured along the true locus, not by the beauty of the drawing.
//
// `compass` uses the other half of the same idea: intersecting loci. The learner places arcs,
// chooses their radii, then marks an intersection. A triangle's third vertex is where circles
// meet; bisectors are found by equal arcs from both objects. All construction arcs stay visible.
//
// Sources and the reasons for these choices are in research.md. The geometry is elementary:
// distance to a segment is distance to its nearest point; the angle-bisector distances are
// perpendicular distances to the two supporting lines. Both SSS intersections are valid.

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { LociConstructionsView } from './View'

export type TraceRelation = 'two-points' | 'point' | 'segment' | 'two-lines'
export type CompassKind = 'triangle' | 'perpendicular' | 'angle'
export type LociConfig =
  | { task: 'trace'; relation: TraceRelation; distance: number }
  | { task: 'compass'; kind: CompassKind; a?: number; b?: number }
export type ArcState = { centre: string; radius: number }
export type LociState = {
  x?: number
  y?: number
  ink?: { x: number; y: number }[]
  arcs?: ArcState[]
  point?: { x: number; y: number }
  /** The compass centre and radius being prepared; no arc exists until Place arc. */
  selected?: string
  radius?: number
}

export const PLATE_W = 360
export const PLATE_H = 258
export const UNIT = 15
/** One visible millimetre on the drawing. A trace within this band counts. */
export const TRACE_TOLERANCE = 10
export const INK_GAP = 3
export const TRACE_GOAL = 0.7
export const MAX_INK = 600
export const MIN_RADIUS = 1
export const MAX_RADIUS = 10
export const MIN_TRIANGLE_SIDE = 3
export const MAX_TRIANGLE_SIDE = 7

export type Pt = { x: number; y: number }
export const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y)
export const nearestOnSegment = (p: Pt, a: Pt, b: Pt): Pt => {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)))
  return { x: a.x + t * dx, y: a.y + t * dy }
}
export const segmentDistance = (p: Pt, a: Pt, b: Pt) => dist(p, nearestOnSegment(p, a, b))

export const TRACE_A: Pt = { x: 6, y: 9 }
export const TRACE_B: Pt = { x: 18, y: 9 }
export const TRACE_C: Pt = { x: 12, y: 15 }
export const TRACE_SEG_A: Pt = { x: 7, y: 9 }
export const TRACE_SEG_B: Pt = { x: 17, y: 9 }
export const TRACE_VERTEX: Pt = { x: 6, y: 15 }
const armLength = 13.5
export const TRACE_ARM_1: Pt = { x: TRACE_VERTEX.x + armLength * Math.cos(-Math.PI / 6), y: TRACE_VERTEX.y + armLength * Math.sin(-Math.PI / 6) }
export const TRACE_ARM_2: Pt = { x: TRACE_VERTEX.x + armLength * Math.cos(-Math.PI / 3), y: TRACE_VERTEX.y + armLength * Math.sin(-Math.PI / 3) }
const lineDistance = (p: Pt, a: Pt, b: Pt) => Math.abs((b.x - a.x) * (a.y - p.y) - (a.x - p.x) * (b.y - a.y)) / dist(a, b)

/** What the two measuring tapes read, in centimetres. */
export function measurements(config: Extract<LociConfig, { task: 'trace' }>, p: Pt): [number, number] {
  if (config.relation === 'two-points') return [dist(p, TRACE_A), dist(p, TRACE_B)]
  if (config.relation === 'point') return [dist(p, TRACE_C), config.distance]
  if (config.relation === 'segment') return [segmentDistance(p, TRACE_SEG_A, TRACE_SEG_B), config.distance]
  return [lineDistance(p, TRACE_VERTEX, TRACE_ARM_1), lineDistance(p, TRACE_VERTEX, TRACE_ARM_2)]
}

export function conditionError(config: Extract<LociConfig, { task: 'trace' }>, p: Pt): number {
  const [a, b] = measurements(config, p)
  return config.relation === 'point' || config.relation === 'segment' ? Math.abs(a - config.distance) : Math.abs(a - b)
}
export const onLocus = (config: Extract<LociConfig, { task: 'trace' }>, p: Pt) => conditionError(config, p) <= TRACE_TOLERANCE / UNIT

/** A denser path, so a hand crossing a valid band still leaves a continuous line. */
export function inkStroke(from: Pt, to: Pt): Pt[] {
  const n = Math.max(1, Math.ceil(dist(from, to) / INK_GAP))
  return Array.from({ length: n }, (_, i) => ({ x: from.x + ((to.x - from.x) * (i + 1)) / n, y: from.y + ((to.y - from.y) * (i + 1)) / n }))
}
export function readInk(state: LociState | null | undefined): Pt[] {
  if (!Array.isArray(state?.ink)) return []
  return state.ink.filter((p): p is Pt => !!p && typeof p.x === 'number' && Number.isFinite(p.x) && typeof p.y === 'number' && Number.isFinite(p.y) && p.x >= -1 && p.x <= 25 && p.y >= -1 && p.y <= 19).slice(-MAX_INK)
}
export function readPencil(config: LociConfig, state: LociState | null | undefined): Pt {
  if (config.task === 'trace') {
    const initial = initialPencil(config)
    const x = state?.x
    const y = state?.y
    return { x: typeof x === 'number' && Number.isFinite(x) ? Math.max(1, Math.min(23, x)) : initial.x, y: typeof y === 'number' && Number.isFinite(y) ? Math.max(1, Math.min(17, y)) : initial.y }
  }
  return { x: 0, y: 0 }
}

export function initialPencil(config: Extract<LociConfig, { task: 'trace' }>): Pt {
  if (config.relation === 'two-points') return { x: 7, y: 4 }
  if (config.relation === 'point') return { x: 4, y: 4 }
  if (config.relation === 'segment') return { x: 12, y: 3 }
  return { x: 15, y: 15 }
}

/** Sample the full mathematical locus, including both capsule sides and rounded ends. */
export function locusSamples(config: Extract<LociConfig, { task: 'trace' }>): Pt[] {
  const out: Pt[] = []
  if (config.relation === 'two-points') {
    for (let y = 1; y <= 17; y += 0.12) out.push({ x: 12, y })
  } else if (config.relation === 'point') {
    for (let a = 0; a < 360; a += 1.5) out.push({ x: TRACE_C.x + config.distance * Math.cos(a * Math.PI / 180), y: TRACE_C.y + config.distance * Math.sin(a * Math.PI / 180) })
  } else if (config.relation === 'segment') {
    const r = config.distance
    const cx = (TRACE_SEG_A.x + TRACE_SEG_B.x) / 2
    const cy = TRACE_SEG_A.y
    const half = dist(TRACE_SEG_A, TRACE_SEG_B) / 2
    const perimeter = 2 * (2 * half) + 2 * Math.PI * r
    for (let s = 0; s < perimeter; s += 0.12) {
      if (s < 2 * half) out.push({ x: TRACE_SEG_A.x + s, y: cy - r })
      else if (s < 2 * half + Math.PI * r) {
        const a = -Math.PI / 2 + (s - 2 * half) / r
        out.push({ x: TRACE_SEG_B.x + r * Math.cos(a), y: cy + r * Math.sin(a) })
      } else if (s < 4 * half + Math.PI * r) out.push({ x: TRACE_SEG_B.x - (s - 2 * half - Math.PI * r), y: cy + r })
      else {
        const a = Math.PI / 2 + (s - 4 * half - Math.PI * r) / r
        out.push({ x: TRACE_SEG_A.x + r * Math.cos(a), y: cy + r * Math.sin(a) })
      }
    }
  } else {
    // The angle has two bisectors. Restrict samples to the drawable sector of both rays.
    const dir1 = Math.atan2(TRACE_ARM_1.y - TRACE_VERTEX.y, TRACE_ARM_1.x - TRACE_VERTEX.x)
    const dir2 = Math.atan2(TRACE_ARM_2.y - TRACE_VERTEX.y, TRACE_ARM_2.x - TRACE_VERTEX.x)
    const bis = (dir1 + dir2) / 2
    for (const a of [bis, bis + Math.PI]) {
      for (let r = 0; r < 30; r += 0.12) {
        const p = { x: TRACE_VERTEX.x + r * Math.cos(a), y: TRACE_VERTEX.y + r * Math.sin(a) }
        if (p.x >= 1 && p.x <= 23 && p.y >= 1 && p.y <= 17) out.push(p)
      }
    }
  }
  return out.filter((p) => p.x >= 1 && p.x <= 23 && p.y >= 1 && p.y <= 17)
}

/** Nearest sample coverage; forgiving, but not satisfiable by a short scribble. */
export function traceCoverage(config: Extract<LociConfig, { task: 'trace' }>, ink: readonly Pt[]): number {
  const samples = locusSamples(config)
  if (!samples.length || !ink.length) return 0
  let covered = 0
  for (const p of samples) {
    if (ink.some((q) => dist(p, q) <= (TRACE_TOLERANCE + 1) / UNIT)) covered++
  }
  return covered / samples.length
}

// ---------------------------------------------------------------------------
// Compass geometry. Coordinates are centimetres in the same 24 x 18 space.

export const COMPASS_A: Pt = { x: 6, y: 12 }
export const COMPASS_B: Pt = { x: 18, y: 12 }
export const COMPASS_VERTEX: Pt = { x: 6, y: 15 }
export const COMPASS_ARM_1: Pt = { x: 17.5, y: 7.85 }
export const COMPASS_ARM_2: Pt = { x: 17.5, y: 12.65 }

export function circleIntersections(a: Pt, ra: number, b: Pt, rb: number): Pt[] {
  const d = dist(a, b)
  if (d <= 0 || d > ra + rb + 1e-8 || d < Math.abs(ra - rb) - 1e-8) return []
  const along = (ra * ra - rb * rb + d * d) / (2 * d)
  const h2 = ra * ra - along * along
  if (h2 < -1e-7) return []
  const h = Math.sqrt(Math.max(0, h2))
  const ux = (b.x - a.x) / d
  const uy = (b.y - a.y) / d
  const m = { x: a.x + along * ux, y: a.y + along * uy }
  const first = { x: m.x - h * uy, y: m.y + h * ux }
  return h < 1e-8 ? [first] : [first, { x: m.x + h * uy, y: m.y - h * ux }]
}

export const DEFAULT_TRIANGLE = { a: 7, b: 6 }
export function compassGeometry(config: Extract<LociConfig, { task: 'compass' }>) {
  if (config.kind === 'triangle') {
    const a = config.a ?? DEFAULT_TRIANGLE.a
    const b = config.b ?? DEFAULT_TRIANGLE.b
    const intersections = circleIntersections(COMPASS_A, a, COMPASS_B, b)
    const solution = intersections.find((p) => p.y < COMPASS_A.y) ?? intersections[0] ?? { x: 12, y: 6 }
    return { a, b, intersections, solution }
  }
  if (config.kind === 'perpendicular') {
    const solution = { x: (COMPASS_A.x + COMPASS_B.x) / 2, y: 6 }
    return { a: 0, b: 0, intersections: [solution, { x: solution.x, y: 15 }], solution }
  }
  const intersections = circleIntersections(COMPASS_ARM_1, 4, COMPASS_ARM_2, 4).filter((p) => p.x > COMPASS_VERTEX.x + 2)
  const solution = intersections[0] ?? { x: 13, y: 10.25 }
  return { a: 0, b: 0, intersections, solution }
}

export function readArcs(state: LociState | null | undefined): ArcState[] {
  if (!Array.isArray(state?.arcs)) return []
  return state.arcs.filter((a): a is ArcState => !!a && ['A', 'B', 'C', 'D'].includes(a.centre) && typeof a.radius === 'number' && Number.isFinite(a.radius) && a.radius >= MIN_RADIUS && a.radius <= MAX_RADIUS).slice(-8)
}
export function arcCentre(id: string): Pt {
  return id === 'A' ? COMPASS_A : id === 'B' ? COMPASS_B : id === 'C' ? COMPASS_ARM_1 : id === 'D' ? COMPASS_ARM_2 : COMPASS_VERTEX
}

export function compassSolved(config: Extract<LociConfig, { task: 'compass' }>, state: LociState | null | undefined): boolean {
  const arcs = readArcs(state)
  const point = state?.point
  if (!point || typeof point.x !== 'number' || typeof point.y !== 'number') return false
  const g = compassGeometry(config)
  if (config.kind === 'triangle') {
    const aa = arcs.find((a) => a.centre === 'A')
    const bb = arcs.find((b) => b.centre === 'B')
    if (!aa || !bb || Math.abs(aa.radius - g.a) > 1e-8 || Math.abs(bb.radius - g.b) > 1e-8) return false
    return g.intersections.some((p) => dist(p, point) < 1e-7)
  }
  if (config.kind === 'perpendicular') {
    const aa = arcs.find((a) => a.centre === 'A')
    const bb = arcs.find((b) => b.centre === 'B')
    if (!aa || !bb || aa.radius !== bb.radius || aa.radius <= 6) return false
    return circleIntersections(COMPASS_A, aa.radius, COMPASS_B, bb.radius).some((p) => dist(p, point) < 1e-7)
  }
  const cc = arcs.find((a) => a.centre === 'C')
  const dd = arcs.find((a) => a.centre === 'D')
  if (!cc || !dd || cc.radius !== dd.radius) return false
  // The fixed first arc has radius 12. Equal arcs from its crossings make the bisector.
  const intersections = circleIntersections(COMPASS_ARM_1, cc.radius, COMPASS_ARM_2, dd.radius)
  return intersections.some((p) => dist(p, point) < 1e-7 && p.x > COMPASS_VERTEX.x + 2 && p.y > 5 && p.y < 14)
}

export function readCompassPoint(state: LociState | null | undefined): Pt | null {
  const p = state?.point
  return p && typeof p.x === 'number' && Number.isFinite(p.x) && typeof p.y === 'number' && Number.isFinite(p.y) ? p : null
}

// ---------------------------------------------------------------------------
// Text, parsing and faults.

const own = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k)
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)
const keyOf = (raw: unknown) => typeof raw === 'string' ? raw.trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : ''
const readNumber = (raw: unknown, fallback: number): number | null => {
  if (raw === undefined) return fallback
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw + 0 : null
  if (typeof raw === 'string') {
    const m = raw.trim().match(/^([-+]?\d+(?:\.\d+)?)\s*(?:cm|centimetres?|centimeters?)?$/i)
    return m ? Number(m[1]) : null
  }
  return null
}

const RELATIONS: Record<string, TraceRelation> = {
  'two-points': 'two-points', 'equidistant-two-points': 'two-points', 'equidistant-from-two-points': 'two-points', 'equal-distance-two-points': 'two-points', 'equal-distances': 'two-points', 'perpendicular-bisector': 'two-points', 'points-equidistant': 'two-points',
  point: 'point', 'fixed-point': 'point', 'fixed-distance-point': 'point', 'fixed-distance-from-a-point': 'point', 'distance-from-point': 'point', circle: 'point',
  segment: 'segment', line: 'segment', 'line-segment': 'segment', 'fixed-line': 'segment', 'fixed-distance-line': 'segment', 'fixed-distance-from-a-line': 'segment', 'distance-from-line': 'segment', capsule: 'segment',
  'two-lines': 'two-lines', 'equidistant-two-lines': 'two-lines', 'equidistant-from-two-lines': 'two-lines', 'equal-distance-two-lines': 'two-lines', 'angle-bisector': 'two-lines', 'intersecting-lines': 'two-lines',
}
const COMPASS: Record<string, CompassKind> = {
  triangle: 'triangle', triangles: 'triangle', sss: 'triangle', 'sss-triangle': 'triangle', 'construct-triangle': 'triangle', 'constructing-triangles': 'triangle', 'three-sides': 'triangle',
  perpendicular: 'perpendicular', 'perpendicular-bisector': 'perpendicular', 'bisect-line': 'perpendicular', 'line-bisector': 'perpendicular', midpoint: 'perpendicular',
  angle: 'angle', 'angle-bisector': 'angle', 'bisect-angle': 'angle', 'bisect-an-angle': 'angle',
}

export const relationName = (r: TraceRelation) => r === 'two-points' ? 'equidistant from A and B' : r === 'point' ? 'a fixed distance from C' : r === 'segment' ? 'a fixed distance from segment AB' : 'equidistant from the two lines'
export const compassName = (k: CompassKind) => k === 'triangle' ? 'a triangle from three sides' : k === 'perpendicular' ? 'the perpendicular bisector of AB' : 'the angle bisector'
export const goodPrompt = (config: LociConfig): string => {
  if (config.task === 'trace') {
    const target = config.relation === 'two-points' ? 'PA = PB' : config.relation === 'two-lines' ? 'equal distances to both lines' : `${config.distance} cm`
    return `Drag the pencil around the paper. Blue ink appears only where its distances satisfy ${target}. Trace the whole path. Arrow keys and the direction buttons also move it.`
  }
  if (config.kind === 'triangle') return 'Place compass arcs from A and B, set their radii, then tap a crossing to construct the triangle. Leave the arcs visible.'
  return `Place equal-radius arcs from the two labelled points, then tap their crossing to construct ${compassName(config.kind)}. Leave the arcs visible.`
}

function parseTrace(src: Record<string, unknown>): LociConfig | null {
  const raw = first(src, ['relation', 'locus', 'from', 'condition', 'kind'])
  const key = keyOf(raw)
  if (raw !== undefined && !own(RELATIONS, key)) return null
  const relation = own(RELATIONS, key) ? RELATIONS[key] : 'two-points'
  const distance = readNumber(first(src, ['distance', 'radius', 'cm']), 3)
  return distance === null ? null : { task: 'trace', relation, distance }
}
function parseCompass(src: Record<string, unknown>): LociConfig | null {
  const raw = first(src, ['kind', 'construction', 'shape', 'type'])
  const key = keyOf(raw)
  if (raw !== undefined && !own(COMPASS, key)) return null
  const kind = own(COMPASS, key) ? COMPASS[key] : 'triangle'
  if (kind !== 'triangle') return { task: 'compass', kind }
  const a = readNumber(first(src, ['a', 'sideA', 'side1', 'firstSide']), DEFAULT_TRIANGLE.a)
  const b = readNumber(first(src, ['b', 'sideB', 'side2', 'secondSide']), DEFAULT_TRIANGLE.b)
  return a === null || b === null ? null : { task: 'compass', kind, a, b }
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))
export const fmt = (n: number) => Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, '')

export const lociConstructionsEngine: SceneEngine<LociConfig, LociState> = {
  id: 'loci-constructions',
  covers: ['loci', 'constructions'],
  phrases: [
    'locus', 'geometric locus', 'geometrical locus', 'loci and constructions', 'constructions and loci', 'loci and construction', 'construction and loci',
    'perpendicular bisector', 'perpendicular bisectors', 'angle bisector', 'angle bisectors', 'ruler and compasses', 'ruler and compass', 'straightedge and compass', 'straight edge and compass',
    'compass constructions', 'compass construction', 'constructing triangles', 'construct triangles', 'triangle from three sides', 'SSS construction', 'regions and loci', 'loci regions', 'scale drawing with loci', 'scale drawings and loci', 'equidistant points', 'fixed distance locus',
  ],
  notFor: [
    'angles on lines', 'angles in parallel lines', 'parallel lines and polygons', 'angle facts', 'polygon angles', 'circle theorem', 'circle theorems', 'angles in circles', 'cyclic quadrilateral',
    'bearings', 'transformations', 'reflection', 'rotation', 'translation', 'enlargement', 'measuring shapes', 'area and perimeter', 'grid references', 'contours', 'map skills', 'scale conversions',
    'gene locus', 'gene loci', 'genetic locus', 'genetic loci', 'locus in genetics', 'physics locus', 'root locus', 'control systems',
  ],
  isolates: 'position',

  parse(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
    const o = raw as Record<string, unknown>
    const nested = o.task && typeof o.task === 'object' ? o.task as Record<string, unknown> : null
    const src = nested ?? o
    const taskKey = keyOf(first(src, nested ? ['task', 'mode'] : ['task', 'mode']))
    const task = taskKey === 'trace' || taskKey === 'locus' || taskKey === 'loci' ? 'trace' : taskKey === 'compass' || taskKey === 'construct' || taskKey === 'construction' || taskKey === 'constructions' ? 'compass' : ''
    if (task) return task === 'trace' ? parseTrace(src) : parseCompass(src)
    // Nested {task:{kind:'trace'...}} and direct {kind:'trace'} are both reasonable.
    const kind = keyOf(first(src, ['kind', 'type']))
    if (kind === 'trace' || kind === 'locus') return parseTrace(src)
    if (kind === 'compass' || kind === 'construct') return parseCompass(src)
    return null
  },

  faults(config) {
    const out: string[] = []
    if (config.task === 'trace') {
      if ((config.relation === 'point' || config.relation === 'segment') && (!Number.isFinite(config.distance) || config.distance < 1.5 || config.distance > 3 || config.distance * 2 !== Math.round(config.distance * 2))) {
        out.push(`A fixed distance of ${fmt(config.distance)} cm does not fit the paper's clear half-centimetre steps: use 1.5 to 3 cm, e.g. distance 3.`)
      }
      if (config.relation === 'two-points' || config.relation === 'two-lines') {
        // Distance is irrelevant to equidistance; do not reject a writer's harmless default.
        return out
      }
      return out
    }
    if (config.kind === 'triangle') {
      const a = config.a ?? DEFAULT_TRIANGLE.a
      const b = config.b ?? DEFAULT_TRIANGLE.b
      if (a * 2 !== Math.round(a * 2) || b * 2 !== Math.round(b * 2) || a < MIN_TRIANGLE_SIDE || b < MIN_TRIANGLE_SIDE || a > MAX_TRIANGLE_SIDE || b > MAX_TRIANGLE_SIDE) {
        out.push(`Triangle sides must be readable half-centimetre lengths from ${MIN_TRIANGLE_SIDE} to ${MAX_TRIANGLE_SIDE} cm: use e.g. a 7, b 6.`)
      } else if (a + b <= 12 || Math.abs(a - b) >= 12) {
        out.push(`Sides AB = 12 cm, AC = ${fmt(a)} cm and BC = ${fmt(b)} cm do not make a triangle: each pair must total more than the third side. Use e.g. a 6, b 5.`)
      }
    }
    return out
  },

  promptFaults(config, prompt) {
    const example = goodPrompt(config)
    const out: string[] = []
    if (config.task === 'trace') {
      if (/perpendicular bisector|angle bisector|\bcircle\b|\bcapsule\b|parallel lines|semicircul|rounded ends|straight line/i.test(prompt)) {
        out.push(`the prompt names the locus the learner is to discover by tracing: ask for the distance condition and gesture only ("${example}")`)
      }
      if (/shade|region|scale factor|1\s*:\s*\d+|type|enter|choose|multiple.choice/i.test(prompt)) {
        out.push(`the prompt promises something the card does not show: this card traces a boundary with a pencil, not a shaded region or scale conversion ("${example}")`)
      }
    } else {
      if (/midpoint|right angle|90\s*(?:°|degrees?)|equal halves|bisects? the angle|two equal angles|equidistant/i.test(prompt)) {
        out.push(`the prompt states the property the construction is meant to reveal: ask only for the named construction and the gesture ("${example}")`)
      }
      if (/protractor|measure the angle|type|enter|choose|multiple.choice|shade|region/i.test(prompt)) {
        out.push(`the prompt names an interaction the card does not use: it places compass arcs and taps their crossings ("${example}")`)
      }
    }
    return out
  },

  initial: () => ({}),
  check(config, state) {
    if (config.task === 'trace') {
      const coverage = traceCoverage(config, readInk(state).filter((p) => onLocus(config, p)))
      return { ok: coverage >= TRACE_GOAL, wrongIds: coverage >= TRACE_GOAL ? [] : ['trace'] }
    }
    const ok = compassSolved(config, state)
    return { ok, wrongIds: ok ? [] : ['point'] }
  },
  solve(config) {
    if (config.task === 'trace') return { ...initialPencil(config), ink: locusSamples(config) }
    if (config.kind === 'triangle') {
      const g = compassGeometry(config)
      return { arcs: [{ centre: 'A', radius: g.a }, { centre: 'B', radius: g.b }], point: g.solution }
    }
    if (config.kind === 'perpendicular') return { arcs: [{ centre: 'A', radius: 8 }, { centre: 'B', radius: 8 }], point: circleIntersections(COMPASS_A, 8, COMPASS_B, 8)[0] }
    return { arcs: [{ centre: 'C', radius: 4 }, { centre: 'D', radius: 4 }], point: compassGeometry(config).solution }
  },
  View: LociConstructionsView,

  prompt: `SCENE "loci-constructions" -- hands-on IGCSE loci and ruler-and-compass constructions on a quiet sheet of drawing paper. Real pencil, compass arcs, rulers and labelled fixed points. Every action visibly changes the drawing. Reduced motion shows the same changed still drawing.
  trace: drag a pencil (or use arrow keys / four quiet direction buttons). Two live distances in cm respond on the drawing. The pencil lays blue ink only while the named condition holds, within a visible 5 px tolerance; no target path is drawn. Coverage of the whole true locus is marked, not artistic similarity. relation "two-points" (equidistant from A and B), "point" (fixed distance from C), "segment" (fixed distance from segment AB, including its rounded ends), or "two-lines" (equidistant from two intersecting lines). distance is required in meaning for point/segment, 1.5 to 3 cm in half-centimetre steps, default 3. Before marking the shape's name is withheld; marking names the discovered path and explains why.
  compass: the learner taps a compass centre, adjusts a radius in half-centimetre steps, and taps Place arc. Arcs stay on the paper. Valid circle crossings appear as small marked targets; tap one to complete the construction. kind "triangle" (SSS, fixed AB = 12 cm; a and b are the other two sides, 3 to 7 cm in half-centimetre steps, default 7 and 6; either crossing is correct), "perpendicular" (equal radii greater than 6 cm from A and B), or "angle" (a fixed first arc gives C and D; equal-radius arcs from C and D). Marking uses exact radii and intersections, never the appearance. Before marking the card does not name the resulting bisector property or give its midpoint/right-angle result.
  For Cambridge IGCSE 0580 constructions and loci: SSS triangles, perpendicular bisectors, angle bisectors, fixed distance from a point or line segment, and equidistance from two points or lines. Not drawn: compound shaded regions, scale conversions, bearings, SAS triangles, protractors, angle facts, polygons or circle theorems. Do not promise those.
  Prompts must state the gesture. For trace do NOT name circle, capsule, parallel lines, perpendicular bisector or angle bisector. For compass do NOT state midpoint, 90 degrees, equal halves or equidistance.
  config: { "task":"trace", "relation":"two-points" } -- prompt "Drag the pencil around the paper. Blue ink appears only where PA = PB. Trace the whole path. Arrow keys and the direction buttons also move it."
       or { "task":"trace", "relation":"segment", "distance":3 } -- prompt "Drag the pencil around the paper. Blue ink appears only where its distance from AB is 3 cm. Trace the whole path. Arrow keys and the direction buttons also move it."
       or { "task":"compass", "kind":"triangle", "a":6, "b":5 } -- prompt "Place compass arcs from A and B, set their radii, then tap a crossing to construct the triangle. Leave the arcs visible."
       or { "task":"compass", "kind":"perpendicular" } -- prompt "Place equal-radius arcs from A and B, then tap their crossing to construct the perpendicular bisector. Leave the arcs visible."
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drag the pencil around the paper. Blue ink appears only where PA = PB. Trace the whole path. Arrow keys and the direction buttons also move it.",
    "payload": { "engine":"loci-constructions", "config": { "task":"trace", "relation":"two-points" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"position", "apparatus":"scene:loci-constructions", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drag the pencil around the paper. Blue ink appears only where its distance from AB is 3 cm. Trace the whole path. Arrow keys and the direction buttons also move it.",
    "payload": { "engine":"loci-constructions", "config": { "task":"trace", "relation":"segment", "distance":3 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"position", "apparatus":"scene:loci-constructions", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Place compass arcs from A and B, set their radii, then tap a crossing to construct the triangle. Leave the arcs visible.",
    "payload": { "engine":"loci-constructions", "config": { "task":"compass", "kind":"triangle", "a":6, "b":5 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"position", "apparatus":"scene:loci-constructions", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Place equal-radius arcs from A and B, then tap their crossing to construct the perpendicular bisector. Leave the arcs visible.",
    "payload": { "engine":"loci-constructions", "config": { "task":"compass", "kind":"perpendicular" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"position", "apparatus":"scene:loci-constructions", "why":"..." } }`,
}

export function markedText(config: LociConfig, state: LociState, marked: 'right' | 'wrong' | 'shown'): string {
  if (config.task === 'trace') {
    const coverage = Math.round(100 * traceCoverage(config, readInk(state).filter((p) => onLocus(config, p))))
    if (marked === 'wrong') return coverage < 5 ? 'No part of the path is traced yet. Move the pencil and watch where blue ink stays on the paper.' : `Your blue ink covers about ${coverage}% of the path. Keep following the places where the distance condition holds, including every part of it.`
    const name = config.relation === 'two-points' ? 'the perpendicular bisector of AB' : config.relation === 'point' ? `a circle of radius ${fmt(config.distance)} cm centred on C` : config.relation === 'segment' ? `two parallel lines with semicircular ends, ${fmt(config.distance)} cm from AB` : 'the angle bisectors of the two lines'
    return `${marked === 'shown' ? 'The completed path' : 'Yes'}: ${name}. Every point on it satisfies the distance condition; the live measurements show why.`
  }
  const ok = compassSolved(config, state)
  if (marked === 'wrong') {
    if (!readArcs(state).length) return 'No construction arcs yet. Place an arc from each labelled point, then look for their crossings.'
    if (!readCompassPoint(state)) return 'Your arcs are drawn, but no crossing has been chosen. Adjust unequal or too-small radii if they do not meet, then tap a crossing.'
    return 'That crossing does not complete the construction. A triangle needs the two stated radii; a bisector needs equal radii from its two labelled points.'
  }
  if (config.kind === 'triangle') return `${marked === 'shown' ? 'The completed construction' : 'Yes'}: the arcs intersect at the third vertex. Its distances from A and B are exactly ${fmt(config.a ?? 6)} cm and ${fmt(config.b ?? 5)} cm, so the three sides are correct.`
  if (config.kind === 'perpendicular') return `${marked === 'shown' ? 'The completed construction' : 'Yes'}: equal arcs meet on the perpendicular bisector. It passes through the midpoint of AB at 90°, and every point on it is equidistant from A and B.`
  return `${marked === 'shown' ? 'The completed construction' : 'Yes'}: joining the vertex to the equal-arc crossing bisects the angle. The two smaller angles are equal, and points on the line are equidistant from the arms.`
}

registerEngine(lociConstructionsEngine as SceneEngine<unknown, unknown>)
