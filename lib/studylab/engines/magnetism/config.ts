// lib/studylab/engines/magnetism/config.ts
import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { MagnetismView } from './View'

/**
 * Three magnetism tasks, for Cambridge IGCSE Physics 0625 and lower secondary.
 *
 * 1. "compass" -- the field of bar magnets, plotted. The learner turns plotting
 *    compasses at a few numbered points to show which way the field points.
 *    The magnets are drawn and labelled; the field lines are drawn only once
 *    marked.
 * 2. "pole" -- the field lines (with arrows) and a few compasses are drawn, the
 *    magnets' poles are not named, and the learner names every end north or
 *    south. Field lines run out of a north pole and into a south pole.
 * 3. "induction" -- electromagnetic induction, predicted. A magnet moves into
 *    or out of a coil joined to a centre-zero meter. A reference case is shown
 *    first (north pole pushed in at a steady speed, the needle deflecting to one
 *    side); the learner says which way the needle swings (left, right or not at
 *    all) and how far compared with the reference.
 *
 * The tutor never writes a coordinate or an answer. It names an arrangement
 * ("single", "attract" or "repel"), or a pole, a movement and a speed; the
 * engine owns every position, every angle and the verdict.
 *
 * Where the facts come from.
 * - Cambridge IGCSE Physics 0625, section 4.1 "Simple phenomena of magnetism":
 *   a magnetic field is a region where a magnet feels a force; its direction at
 *   a point is the direction of the force on a north pole placed there, which
 *   is the way the north-seeking end of a plotting compass points; field lines
 *   outside a bar magnet run from the north pole to the south pole; like poles
 *   repel and unlike poles attract. (The usual "plotting compass" practical.)
 * - Cambridge IGCSE Physics 0625, section 4.5.1 "Electromagnetic induction": an
 *   e.m.f. is induced in a coil when the magnetic field through it changes
 *   (a magnet moving relative to it); with no relative movement there is no
 *   e.m.f.; it is larger for a faster movement; reversing the movement, or the
 *   pole, reverses its direction (Faraday's and Lenz's laws). The engine states
 *   only these ordinal facts and never a size in volts or divisions.
 * - The field is the textbook two-pole model: a long thin bar magnet is a north
 *   and a south point pole on its axis, a little inside its ends, and
 *   B = sum q (r - r_i) / |r - r_i|^3 over the poles (inverse square; the field
 *   outside a long thin uniformly magnetised rod, drawn in a plane through its
 *   axis). Two magnets end to end add their fields. By the mirror symmetry of
 *   two like poles facing, the field is exactly zero midway between them (the
 *   neutral point), and the tests show it is the only one for that arrangement.
 *   (Two unlike poles facing have neutral points too, off the axis: the tests
 *   find them, above and below the middle. The card marks and names only the
 *   one between like poles, where it explains the repulsion, and says nothing
 *   of the others.)
 * - The picture is a model. It draws no strength and prints no number.
 */

// ---------------------------------------------------------------------------
// Small helpers.

const own = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k)
const slug = (raw: string) => raw.trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[\s_.]+/g, '-').replace(/-+/g, '-')
const listOr = (items: string[]) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} or ${items[items.length - 1]}`)

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

// ---------------------------------------------------------------------------
// Types.

export const ARRANGEMENTS = ['single', 'attract', 'repel'] as const
export type Arrangement = (typeof ARRANGEMENTS)[number]
export type Pole = 'N' | 'S'
export const MOTIONS = ['in', 'out', 'still'] as const
export type Motion = (typeof MOTIONS)[number]
export const SPEEDS = ['same', 'faster', 'slower'] as const
export type Speed = (typeof SPEEDS)[number]

/** `leftEnd`: the pole at the far left end of the picture; the engine picks one when the tutor does not. `unread`: what parse could not read, for faults() to say. */
type FieldBase = { arrangement: Arrangement; leftEnd?: Pole; unread?: string[] }
export type CompassTask = FieldBase & { kind: 'compass'; count?: number }
export type PoleTask = FieldBase & { kind: 'pole' }
export type InductionTask = { kind: 'induction'; pole: Pole; motion: Motion; speed?: Speed; unread?: string[] }
export type FieldTask = CompassTask | PoleTask
export type MagnetismConfig = { task: CompassTask | PoleTask | InductionTask }

/**
 * compass: `angles`, each needle's angle in degrees (anticlockwise from pointing
 * right), in the order of the numbered points. pole: `ends`, 'N', 'S' or '' for
 * each end, left to right. induction: `way` ('left', 'right' or 'none') and
 * `size` ('further', 'same' or 'less' than the reference).
 */
export type MagnetismState = { angles?: number[]; ends?: string[]; way?: string; size?: string }

export const POLE_NAMES: Record<Pole, string> = { N: 'north', S: 'south' }

// ---------------------------------------------------------------------------
// The picture's space. World units: x to the right, y up. 40 px to a unit.

export const VIEW = { w: 360, h: 240, scale: 40 } as const
export const toPx = (x: number, y: number) => ({ x: VIEW.w / 2 + VIEW.scale * x, y: VIEW.h / 2 - VIEW.scale * y })
/** What the picture shows of the world: x within +-4.5, y within +-3. */
export const BOUNDS = { x: VIEW.w / 2 / VIEW.scale, y: VIEW.h / 2 / VIEW.scale } as const

/** A bar magnet is 2.4 long and 0.56 across (a lone one is drawn 3.2 long, to fill the picture); two sit 1.2 apart. Its poles sit 0.15 inside its ends. */
export const HALF = 1.2
export const HALF_SINGLE = 1.6
export const THICK = 0.28
export const GAP = 0.6
export const INSET = 0.15
/** A plotting compass: the dial's radius, and the needle's half length. */
export const DIAL = 0.4
export const NEEDLE = 0.3

export type Body = { x0: number; x1: number }
export type Charge = { x: number; y: number; q: 1 | -1 }

export function bodiesOf(arrangement: Arrangement): Body[] {
  if (arrangement === 'single') return [{ x0: -HALF_SINGLE, x1: HALF_SINGLE }]
  return [{ x0: -(GAP + 2 * HALF), x1: -GAP }, { x0: GAP, x1: GAP + 2 * HALF }]
}

/** The poles from left to right as +1 (north) or -1 (south) when the far left end is a north pole. */
const PATTERN: Record<Arrangement, (1 | -1)[]> = {
  single: [1, -1],
  // Unlike poles facing: the left magnet's right end is south, the right magnet's left end is north.
  attract: [1, -1, 1, -1],
  // Like poles facing: both facing ends are south (when the far left is north).
  repel: [1, -1, -1, 1],
}

/** The point poles, left to right, each a little inside the end of its magnet. */
export function chargesOf(arrangement: Arrangement, leftEnd: Pole): Charge[] {
  const sign = leftEnd === 'N' ? 1 : -1
  const xs: number[] = []
  for (const b of bodiesOf(arrangement)) xs.push(b.x0 + INSET, b.x1 - INSET)
  return PATTERN[arrangement].map((q, i) => ({ x: xs[i], y: 0, q: (q * sign) as 1 | -1 }))
}

export type Vec = { x: number; y: number }

/** The field at a point: each pole contributes q (r - r_i) / |r - r_i|^3, pointing away from a north pole and towards a south pole. */
export function fieldAt(charges: readonly Charge[], x: number, y: number): Vec {
  let bx = 0
  let by = 0
  for (const c of charges) {
    const dx = x - c.x
    const dy = y - c.y
    const r2 = dx * dx + dy * dy
    const r3 = r2 * Math.sqrt(r2)
    if (r3 < 1e-12) continue
    bx += (c.q * dx) / r3
    by += (c.q * dy) / r3
  }
  return { x: bx, y: by }
}

export const magnitude = (v: Vec) => Math.hypot(v.x, v.y)
/** Degrees anticlockwise from pointing right, 0 up to 360. */
export const angleOf = (v: Vec) => (((Math.atan2(v.y, v.x) * 180) / Math.PI) % 360 + 360) % 360
/** The angle between two directions, 0 to 180. */
export function angleApart(a: number, b: number): number {
  const d = Math.abs((((a - b) % 360) + 360) % 360)
  return Math.min(d, 360 - d)
}

/** Where a point lies, nearest first: distance from a body's rectangle (0 inside it). */
export function clearance(arrangement: Arrangement, x: number, y: number): number {
  let best = Infinity
  for (const b of bodiesOf(arrangement)) {
    const dx = Math.max(b.x0 - x, 0, x - b.x1)
    const dy = Math.max(-THICK - y, 0, y - THICK)
    best = Math.min(best, Math.hypot(dx, dy))
  }
  return best
}
export const insideBody = (arrangement: Arrangement, x: number, y: number) => clearance(arrangement, x, y) === 0

// ---------------------------------------------------------------------------
// Field lines, traced from the poles along the field.

export type Run = { pts: Vec[]; arrow: { x: number; y: number; angle: number } }

const STEP = 0.04
const MAX_STEPS = 3000
const SEEDS = 14
const NEAR = 0.14

/**
 * Follow the field from a start, one small step at a time (midpoint method on the
 * direction of the field), until the line comes within NEAR of a pole of the
 * wanted sign, leaves the picture or runs out of steps. Moves along the field when
 * `way` is 1 and against it when -1.
 */
function follow(charges: readonly Charge[], from: Vec, way: 1 | -1, stopAt: 1 | -1): { pts: Vec[]; ended: 'pole' | 'out' | 'long' } {
  const pts: Vec[] = [from]
  let p = from
  const dir = (at: Vec): Vec | null => {
    const b = fieldAt(charges, at.x, at.y)
    const m = magnitude(b)
    return m < 1e-9 ? null : { x: (way * b.x) / m, y: (way * b.y) / m }
  }
  for (let i = 0; i < MAX_STEPS; i++) {
    const d1 = dir(p)
    if (!d1) return { pts, ended: 'out' }
    const d2 = dir({ x: p.x + (STEP / 2) * d1.x, y: p.y + (STEP / 2) * d1.y })
    if (!d2) return { pts, ended: 'out' }
    p = { x: p.x + STEP * d2.x, y: p.y + STEP * d2.y }
    pts.push(p)
    for (const c of charges) {
      if (c.q === stopAt && Math.hypot(p.x - c.x, p.y - c.y) < NEAR) {
        pts.push({ x: c.x, y: c.y })
        return { pts, ended: 'pole' }
      }
    }
    if (Math.abs(p.x) > BOUNDS.x + 0.2 || Math.abs(p.y) > BOUNDS.y + 0.2) return { pts, ended: 'out' }
  }
  return { pts, ended: 'long' }
}

/** The stretches of a traced line that lie outside the magnets and inside the picture. */
function outside(arrangement: Arrangement, pts: readonly Vec[]): Vec[][] {
  const runs: Vec[][] = []
  let run: Vec[] = []
  for (const p of pts) {
    const ok = !insideBody(arrangement, p.x, p.y) && Math.abs(p.x) <= BOUNDS.x && Math.abs(p.y) <= BOUNDS.y
    if (ok) run.push(p)
    else if (run.length) {
      runs.push(run)
      run = []
    }
  }
  if (run.length) runs.push(run)
  return runs.filter((r) => r.length >= 8)
}

/** The point a fraction of the way along a run (by length), and the way the line is going there. */
function arrowAt(run: readonly Vec[], frac: number): { x: number; y: number; angle: number } {
  const lens: number[] = [0]
  for (let i = 1; i < run.length; i++) lens.push(lens[i - 1] + Math.hypot(run[i].x - run[i - 1].x, run[i].y - run[i - 1].y))
  const want = lens[lens.length - 1] * frac
  let k = 1
  while (k < run.length - 1 && lens[k] < want) k++
  const a = run[Math.max(0, k - 2)]
  const b = run[Math.min(run.length - 1, k + 2)]
  return { x: run[k].x, y: run[k].y, angle: angleOf({ x: b.x - a.x, y: b.y - a.y }) }
}

/** Arrows sit at least this far apart, and this far from the magnets and the picture's edge, so each can be seen on its own line. */
export const ARROW_GAP = 0.28
const ARROW_ROOM = 0.15

/**
 * An arrow for each run: half way along, or the nearest of a few other places to it where that is crowded (another
 * run's arrow, a magnet, the edge). A run with no such place -- a short curl hugging a magnet, or crowded out -- is left
 * undrawn, so it comes back as null: every line drawn carries an arrow that can be seen.
 */
function placeArrows(arrangement: Arrangement, runs: { pts: Vec[] }[]): ({ x: number; y: number; angle: number } | null)[] {
  const placed: { x: number; y: number; angle: number }[] = []
  const out: ({ x: number; y: number; angle: number } | null)[] = []
  for (const run of runs) {
    let best = arrowAt(run.pts, 0.5)
    let bestRoom = -Infinity
    for (const frac of [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8]) {
      const a = arrowAt(run.pts, frac)
      const room = Math.min(
        ...placed.map((o) => Math.hypot(a.x - o.x, a.y - o.y) - ARROW_GAP),
        clearance(arrangement, a.x, a.y) - ARROW_ROOM,
        BOUNDS.x - ARROW_ROOM - Math.abs(a.x),
        BOUNDS.y - ARROW_ROOM - Math.abs(a.y),
      )
      if (room > bestRoom) {
        best = a
        bestRoom = room
      }
      if (room >= 0) break
    }
    if (bestRoom >= 0) placed.push(best)
    out.push(bestRoom >= 0 ? best : null)
  }
  return out
}

const linesCache = new Map<string, Run[]>()

/**
 * The field lines of an arrangement, each running the way the field points: from
 * the north poles, plus the lines that come in from beyond the picture to a south
 * pole. Fourteen leave each north pole (at angles that avoid the axis for two like
 * poles facing, where the line along it would have to pass the neutral point).
 */
export function fieldLines(arrangement: Arrangement, leftEnd: Pole): Run[] {
  const key = `${arrangement}:${leftEnd}`
  const hit = linesCache.get(key)
  if (hit) return hit
  const charges = chargesOf(arrangement, leftEnd)
  const offset = arrangement === 'repel' ? 180 / SEEDS : 0
  const found: { pts: Vec[] }[] = []
  const add = (pts: Vec[]) => {
    for (const run of outside(arrangement, pts)) found.push({ pts: run })
  }
  for (const c of charges) {
    for (let k = 0; k < SEEDS; k++) {
      const a = ((offset + (360 * k) / SEEDS) * Math.PI) / 180
      const start = { x: c.x + 0.1 * Math.cos(a), y: c.y + 0.1 * Math.sin(a) }
      if (c.q === 1) add(follow(charges, start, 1, -1).pts)
      else {
        // From a south pole, back along the field: only the lines that come from beyond the picture.
        const back = follow(charges, start, -1, 1)
        if (back.ended !== 'pole') add(back.pts.slice().reverse())
      }
    }
  }
  const arrows = placeArrows(arrangement, found)
  const out: Run[] = []
  found.forEach((r, i) => {
    const arrow = arrows[i]
    if (arrow) out.push({ pts: r.pts, arrow })
  })
  linesCache.set(key, out)
  return out
}

/** Where the magnets' fields cancel: midway between two like poles facing. Nowhere else is drawn. */
export const NEUTRAL = { x: 0, y: 0 } as const
export const hasNeutralPoint = (arrangement: Arrangement) => arrangement === 'repel'

// ---------------------------------------------------------------------------
// The compass sites.

/**
 * Where a plotting compass may stand, per arrangement, in the order they are dealt.
 * Each is clear of the magnets, in a field strong enough to show a direction that is
 * nearly the same across the needle, and any four in a row are far enough apart (and
 * point enough different ways) to be told apart. The tests hold every one to that.
 */
const SITES: Record<Arrangement, readonly Vec[]> = {
  single: [{ x: 3, y: 0 }, { x: 0, y: 1.3 }, { x: -1.9, y: -1.6 }, { x: 1.9, y: -1.6 }, { x: -3, y: 0 }, { x: 0, y: -1.3 }, { x: 1.9, y: 1.6 }, { x: -1.9, y: 1.6 }],
  attract: [{ x: 0, y: 0 }, { x: -1.9, y: 1.2 }, { x: 3.9, y: 0 }, { x: 1.9, y: -1.2 }, { x: -3.9, y: 0 }, { x: 1.9, y: 1.2 }, { x: -1.9, y: -1.2 }, { x: -3.4, y: 1.4 }],
  repel: [{ x: 0, y: 1.15 }, { x: -1.9, y: 1.2 }, { x: 0, y: -1.15 }, { x: 1.9, y: 1.2 }, { x: -3.9, y: 0 }, { x: 3.9, y: 0 }, { x: -1.9, y: -1.2 }, { x: 1.9, y: -1.2 }],
}
export const SITE_COUNT = 8

/** Needles turn in steps of this many degrees, and are right within this many of the field. */
export const SNAP = 15
export const TOLERANCE = 30
export const MIN_COMPASSES = 2
export const MAX_COMPASSES = 4
export const DEFAULT_COMPASSES = 3
/** The compasses drawn on a pole card, which the learner does not turn. */
export const POLE_COMPASSES = 3

const snap = (deg: number) => ((Math.round(deg / SNAP) * SNAP) % 360 + 360) % 360

function keyOf(task: CompassTask | PoleTask | InductionTask): string {
  if (task.kind === 'induction') return `induction:${task.pole}:${task.motion}:${task.motion === 'still' ? '' : task.speed ?? 'same'}`
  return `${task.kind}:${task.arrangement}:${task.kind === 'compass' ? task.count ?? DEFAULT_COMPASSES : ''}:${task.leftEnd ?? ''}`
}

/** The pole at the far left end: the tutor's, or the engine's own pick from the task. */
export function leftEndOf(task: FieldTask): Pole {
  return task.leftEnd ?? ((hashOf(keyOf(task)) & 1) === 1 ? 'N' : 'S')
}

export type Site = { id: number; x: number; y: number; truth: number; start: number }

/** The sites dealt to a card: a run of the arrangement's list, from a point the card's hash picks. */
export function siteSet(arrangement: Arrangement, leftEnd: Pole, from: number, count: number, seed: string): Site[] {
  const list = SITES[arrangement]
  const charges = chargesOf(arrangement, leftEnd)
  const out: Site[] = []
  for (let i = 0; i < count; i++) {
    const at = list[(from + i) % list.length]
    const truth = snap(angleOf(fieldAt(charges, at.x, at.y)))
    // Starts well away from the field -- never within 90 degrees -- and not at a fixed offset from it.
    const away: number[] = []
    for (let a = 0; a < 360; a += SNAP) if (angleApart(a, truth) >= 90) away.push(a)
    out.push({ id: i, x: at.x, y: at.y, truth, start: away[hashOf(`${seed}:${i}`) % away.length] })
  }
  return out
}

export const countOf = (task: CompassTask): number =>
  Math.max(MIN_COMPASSES, Math.min(MAX_COMPASSES, Number.isInteger(task.count) ? (task.count as number) : DEFAULT_COMPASSES))

/** The compasses on a compass card or a pole card, with the way the field points at each. */
export function sitesOf(task: FieldTask): Site[] {
  const count = task.kind === 'compass' ? countOf(task) : POLE_COMPASSES
  const from = (hashOf(keyOf(task)) >>> 3) % SITE_COUNT
  return siteSet(task.arrangement, leftEndOf(task), from, count, keyOf(task))
}

// ---------------------------------------------------------------------------
// The ends of the magnets, for naming.

export type End = { id: number; letter: string; x: number; sign: Pole; magnet: number; side: 'left' | 'right' }

export function endsOf(task: FieldTask): End[] {
  const charges = chargesOf(task.arrangement, leftEndOf(task))
  return charges.map((c, i) => ({
    id: i, letter: 'ABCD'[i], x: c.x, sign: c.q === 1 ? 'N' : 'S', magnet: Math.floor(i / 2), side: i % 2 === 0 ? 'left' : 'right',
  }))
}

/** The end a field line leaves or enters is where its pole sits; the half of the magnet it names runs from the middle to that end. */
export function halfOf(arrangement: Arrangement, end: End): Body {
  const b = bodiesOf(arrangement)[end.magnet]
  const mid = (b.x0 + b.x1) / 2
  return end.side === 'left' ? { x0: b.x0, x1: mid } : { x0: mid, x1: b.x1 }
}

// ---------------------------------------------------------------------------
// Words: where a needle points, for a screen reader and for what is said back.

const EIGHT = ['right', 'up and to the right', 'up', 'up and to the left', 'left', 'down and to the left', 'down', 'down and to the right']

/** "up and to the right", or "left, turned 15 degrees clockwise": a direction as it is seen. */
export function pointingWords(angle: number): string {
  const a = ((angle % 360) + 360) % 360
  const k = Math.round(a / 45) % 8
  const off = Math.round(a - Math.round(a / 45) * 45)
  if (off === 0) return EIGHT[k]
  return `${EIGHT[k]}, turned ${Math.abs(off)} degrees ${off > 0 ? 'anticlockwise' : 'clockwise'} from there`
}

// ---------------------------------------------------------------------------
// Turning a needle: what a key and a pointer do, kept here so the tests can hold them to it.

/** Right and up turn a needle clockwise, left and down anticlockwise (the way a dial or a slider reads); the page keys turn it three steps. */
export const KEY_TURNS: Record<string, number> = {
  ArrowRight: -SNAP, ArrowUp: -SNAP, ArrowLeft: SNAP, ArrowDown: SNAP, PageUp: -3 * SNAP, PageDown: 3 * SNAP,
}

/** The angles with needle `i` turned to `to` (snapped, kept within 0 to 360), or null when that is where it already is. */
export function turnedTo(angles: readonly number[], i: number, to: number): number[] | null {
  const a = snap(to)
  if (!(i >= 0 && i < angles.length) || a === angles[i]) return null
  const next = angles.slice()
  next[i] = a
  return next
}

/** Where a pointer is, from a needle's centre (dy up the screen), as an angle for the needle; null when it is on the pivot. */
export function angleFromDelta(dx: number, dy: number): number | null {
  if (Math.hypot(dx, dy) < 5) return null
  return snap((Math.atan2(dy, dx) * 180) / Math.PI)
}

// ---------------------------------------------------------------------------
// Compass cards: state, marking and what is said.

/** The needles' angles in the state, each a multiple of 15 degrees; a needle not set stands where it started. */
export function readAngles(task: CompassTask, raw: unknown): number[] {
  const list = (raw as { angles?: unknown } | null)?.angles
  return sitesOf(task).map((s, i) => {
    const v = Array.isArray(list) ? list[i] : undefined
    return typeof v === 'number' && Number.isFinite(v) ? snap(v) : s.start
  })
}

export function compassVerdict(task: CompassTask, state: unknown): { ok: boolean; wrong: number[] } {
  const angles = readAngles(task, state)
  const wrong = sitesOf(task).filter((s, i) => angleApart(angles[i], s.truth) > TOLERANCE).map((s) => s.id)
  return { ok: wrong.length === 0, wrong }
}

const RULE = 'Outside a magnet the field points away from a north pole and towards a south pole: field lines run from north to south. The red end of a compass needle is its north-seeking end and points the way the field points.'
const NEUTRAL_SAID = 'The × marks the neutral point, midway between the two magnets, where their fields cancel and the field is zero.'

export function compassSaid(task: CompassTask, state: unknown, marked: 'right' | 'wrong' | 'shown'): string[] {
  const sites = sitesOf(task)
  const extra = hasNeutralPoint(task.arrangement) ? [NEUTRAL_SAID] : []
  if (marked !== 'wrong') {
    return ['Every needle lies along the field, with its red end pointing the way the field points.', RULE, ...extra]
  }
  const angles = readAngles(task, state)
  const lines: string[] = []
  for (const s of sites) {
    const gap = angleApart(angles[s.id], s.truth)
    if (gap <= TOLERANCE) continue
    const how = gap >= 150 ? 'That is the wrong way round.' : gap >= 60 && gap <= 120 ? 'That needle lies across the field, not along it.' : 'That is not quite along the field.'
    lines.push(`Compass ${s.id + 1}: you turned it to point ${pointingWords(angles[s.id])}. The field there points ${pointingWords(s.truth)}. ${how}`)
  }
  return [...lines, RULE, ...extra]
}

// ---------------------------------------------------------------------------
// Pole cards: state, marking and what is said.

export function readEnds(task: PoleTask, raw: unknown): string[] {
  const list = (raw as { ends?: unknown } | null)?.ends
  return endsOf(task).map((_, i) => {
    const v = Array.isArray(list) ? list[i] : undefined
    return v === 'N' || v === 'S' ? v : ''
  })
}

export function poleVerdict(task: PoleTask, state: unknown): { ok: boolean; wrong: number[]; unnamed: number[] } {
  const named = readEnds(task, state)
  const ends = endsOf(task)
  return {
    ok: ends.every((e, i) => named[i] === e.sign),
    wrong: ends.filter((e, i) => named[i] !== '' && named[i] !== e.sign).map((e) => e.id),
    unnamed: ends.filter((_, i) => named[i] === '').map((e) => e.id),
  }
}

const POLE_RULE = 'Field lines run out of a north pole and into a south pole.'

export function poleSaid(task: PoleTask, state: unknown, marked: 'right' | 'wrong' | 'shown'): string[] {
  const ends = endsOf(task)
  const facing = task.arrangement === 'attract'
    ? 'The two facing ends are unlike poles, one north and one south, so the magnets attract: the field lines run across the gap from the north pole of one to the south pole of the other.'
    : task.arrangement === 'repel'
      ? `The two facing ends are like poles, both north or both south, so the magnets repel: their field lines bend away from each other. ${NEUTRAL_SAID}`
      : ''
  const tail = [POLE_RULE, ...(facing ? [facing] : [])]
  if (marked !== 'wrong') {
    const names = ends.map((e) => `end ${e.letter} is a ${POLE_NAMES[e.sign]} pole`)
    return [`${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}.`.replace(/^./, (c) => c.toUpperCase()), ...tail]
  }
  const v = poleVerdict(task, state)
  if (v.unnamed.length) return [`Name every end first: ${listOr(v.unnamed.map((i) => `end ${ends[i].letter}`))} ${v.unnamed.length === 1 ? 'is' : 'are'} still unnamed.`]
  const named = readEnds(task, state)
  const lines = v.wrong.map((i) => {
    const e = ends[i]
    return `You named end ${e.letter} a ${POLE_NAMES[named[i] as Pole]} pole, but the lines run ${e.sign === 'N' ? 'out of' : 'into'} it, so it is a ${POLE_NAMES[e.sign]} pole.`
  })
  return [...lines, ...tail]
}

// ---------------------------------------------------------------------------
// Induction cards.

/** The reference every induction card is measured against: the north pole pushed in at a steady speed. */
export const REFERENCE = { pole: 'N', motion: 'in', speed: 'same' } as const
export const isReference = (t: InductionTask) => t.pole === REFERENCE.pole && t.motion === REFERENCE.motion && (t.speed ?? 'same') === REFERENCE.speed

/** Which side the needle swings to in the reference: the meter's wiring, which the tutor does not choose. */
export function referenceSide(task: InductionTask): 'left' | 'right' {
  return (hashOf(`ref:${keyOf(task)}`) & 1) === 1 ? 'right' : 'left'
}

export type Way = 'left' | 'right' | 'none'
export type Size = 'further' | 'same' | 'less'
export type Outcome = { way: Way; size: Size | null }

/**
 * What the needle does. The e.m.f. reverses with the pole and with the movement,
 * so the side is the reference's, flipped once for each of the two that differs
 * from it; it is larger for a faster movement and smaller for a slower one; and a
 * magnet at rest induces nothing.
 */
export function outcomeOf(task: InductionTask): Outcome {
  if (task.motion === 'still') return { way: 'none', size: null }
  const ref = referenceSide(task)
  const flips = (task.pole === 'S' ? 1 : 0) + (task.motion === 'out' ? 1 : 0)
  const way: Way = flips % 2 === 0 ? ref : ref === 'left' ? 'right' : 'left'
  const speed = task.speed ?? 'same'
  return { way, size: speed === 'faster' ? 'further' : speed === 'slower' ? 'less' : 'same' }
}

/** Where the needle is drawn, in steps of 9 degrees from the vertical, for each size; the reference is 3 steps out. */
export const NEEDLE_STEPS: Record<Size, number> = { less: 1.5, same: 3, further: 4.5 }
export const SCALE_STEPS = 5
export const STEP_DEGREES = 9

/** The needle's drawn position, as steps from centre. Null when no prediction has been made. */
export function stepsOf(way: Way | '', size: Size | '' | null): number | null {
  if (!way) return null
  if (way === 'none') return 0
  const s = NEEDLE_STEPS[size || 'same']
  return way === 'left' ? -s : s
}

/** Map a needle position (in steps from centre) to way and size: the reverse of stepsOf. */
export function fromSteps(steps: number): { way: Way; size: Size | '' } {
  if (Math.abs(steps) < 0.75) return { way: 'none', size: '' }
  const way: Way = steps < 0 ? 'left' : 'right'
  const abs = Math.abs(steps)
  if (abs < 2.25) return { way, size: 'less' }
  if (abs < 3.75) return { way, size: 'same' }
  return { way, size: 'further' }
}

export const WAY_NAMES: Record<Way, string> = { left: 'Left', none: 'Stays at zero', right: 'Right' }
export const SIZE_NAMES: Record<Size, string> = { less: 'Less far', same: 'Same distance', further: 'Further' }
export const WAYS: Way[] = ['left', 'none', 'right']
export const SIZES: Size[] = ['less', 'same', 'further']

export function readWay(raw: unknown): Way | '' {
  const v = (raw as { way?: unknown } | null)?.way
  return v === 'left' || v === 'right' || v === 'none' ? v : ''
}
export function readSize(raw: unknown): Size | '' {
  const v = (raw as { size?: unknown } | null)?.size
  return v === 'further' || v === 'same' || v === 'less' ? v : ''
}

export function inductionVerdict(task: InductionTask, state: unknown): { ok: boolean; wayOk: boolean; sizeOk: boolean } {
  const want = outcomeOf(task)
  const way = readWay(state)
  const size = readSize(state)
  const wayOk = way === want.way
  const sizeOk = want.size === null || size === want.size
  return { ok: wayOk && sizeOk, wayOk, sizeOk }
}

export const poleWord = (p: Pole) => POLE_NAMES[p]
const sideWord = (w: 'left' | 'right') => (w === 'left' ? 'left' : 'right')

/** The movement as the card says it, naming the speed against the reference. */
export function movementText(task: InductionTask): string {
  if (task.motion === 'still') return 'The magnet is held still inside the coil.'
  const verb = task.motion === 'in' ? 'pushed in' : 'pulled out'
  const speed = task.speed ?? 'same'
  const how = speed === 'faster' ? ' faster than in the reference' : speed === 'slower' ? ' more slowly than in the reference' : ' at the same speed as in the reference'
  return `The magnet has its ${poleWord(task.pole)} pole pointing into the coil, and is ${verb}${how}.`
}

export const REFERENCE_TEXT = 'The magnet has its north pole pointing into the coil, and is pushed in at a steady speed.'

export function inductionSaid(task: InductionTask, state: unknown, marked: 'right' | 'wrong' | 'shown'): string[] {
  const want = outcomeOf(task)
  const ref = referenceSide(task)
  const lines: string[] = []
  if (want.way === 'none') {
    const answer = 'The needle stays at zero.'
    lines.push(answer, 'The magnet is not moving, so the magnetic field through the coil is not changing. No e.m.f. is induced, there is no current, and the needle does not move.')
  } else {
    const how = want.size === 'further' ? ', further than in the reference' : want.size === 'less' ? ', less far than in the reference' : ', the same distance as in the reference'
    lines.push(`The needle swings ${sideWord(want.way)}${how}.`)
    const poleFlip = task.pole === 'S'
    const moveFlip = task.motion === 'out'
    if (!poleFlip && !moveFlip) lines.push(`The pole and the movement are as in the reference, so the needle swings the same way: ${ref}.`)
    else if (poleFlip && moveFlip) lines.push('The pole is reversed and so is the movement. Each reversal turns the e.m.f. round, so the two cancel and the needle swings the same way as in the reference.')
    else if (poleFlip) lines.push('The pole is reversed, which reverses the e.m.f., so the needle swings the opposite way to the reference.')
    else lines.push('Pulling the magnet out reverses the change in the magnetic field through the coil, which reverses the e.m.f., so the needle swings the opposite way to the reference.')
    const speed = task.speed ?? 'same'
    lines.push(speed === 'faster'
      ? 'A faster movement changes the field through the coil faster, which induces a larger e.m.f., so the needle swings further.'
      : speed === 'slower'
        ? 'A slower movement changes the field through the coil more slowly, which induces a smaller e.m.f., so the needle swings less far.'
        : 'The speed is the same, so the e.m.f. is the same size and the needle swings the same distance.')
  }
  if (marked !== 'wrong') return lines
  const way = readWay(state)
  const size = readSize(state)
  if (!way) return ['Say which way the needle swings, then check.']
  if (way === want.way && want.way !== 'none' && !size) return ['That is the right way. Now say how far the needle swings compared with the reference, then check.']
  const mine = way === 'none' ? 'the needle stays at zero' : `the needle swings ${way}${size ? `, ${size === 'further' ? 'further than' : size === 'less' ? 'less far than' : 'the same distance as'} the reference` : ''}`
  return [`You said ${mine}.`, ...lines]
}

// ---------------------------------------------------------------------------
// Reading what the tutor writes.

const KIND_WORDS: Record<string, 'compass' | 'pole' | 'induction'> = {
  'compass': 'compass', 'compasses': 'compass', 'plotting-compass': 'compass', 'plotting-compasses': 'compass', 'turn-compasses': 'compass',
  'field-direction': 'compass', 'field': 'compass', 'plot-field': 'compass', 'plot-the-field': 'compass', 'turn-needles': 'compass',
  'pole': 'pole', 'poles': 'pole', 'name-poles': 'pole', 'name-the-poles': 'pole', 'identify-poles': 'pole', 'find-poles': 'pole', 'name-pole': 'pole',
  'induction': 'induction', 'predict': 'induction', 'predict-needle': 'induction', 'em-induction': 'induction', 'electromagnetic-induction': 'induction',
  'induced-emf': 'induction', 'predict-induction': 'induction', 'magnet-and-coil': 'induction',
}
const ARRANGEMENT_WORDS: Record<string, Arrangement> = {
  'single': 'single', 'one': 'single', 'one-magnet': 'single', 'one-bar-magnet': 'single', 'single-magnet': 'single', 'bar-magnet': 'single', 'bar': 'single', 'single-bar-magnet': 'single',
  'attract': 'attract', 'attracting': 'attract', 'attraction': 'attract', 'unlike': 'attract', 'unlike-poles': 'attract', 'unlike-poles-facing': 'attract', 'opposite-poles': 'attract',
  'two-magnets-attract': 'attract', 'two-attracting': 'attract', 'north-south': 'attract',
  'repel': 'repel', 'repelling': 'repel', 'repulsion': 'repel', 'like': 'repel', 'like-poles': 'repel', 'like-poles-facing': 'repel', 'same-poles': 'repel',
  'two-magnets-repel': 'repel', 'two-repelling': 'repel',
}
const POLE_WORDS: Record<string, Pole> = { n: 'N', north: 'N', 'north-pole': 'N', 'n-pole': 'N', s: 'S', south: 'S', 'south-pole': 'S', 's-pole': 'S' }
const MOTION_WORDS: Record<string, Motion> = {
  'in': 'in', 'into': 'in', 'push-in': 'in', 'pushed-in': 'in', 'pushing-in': 'in', 'push': 'in', 'towards': 'in', 'toward': 'in', 'approach': 'in', 'approaching': 'in', 'insert': 'in', 'inserted': 'in',
  'out': 'out', 'pull-out': 'out', 'pulled-out': 'out', 'pulling-out': 'out', 'pull': 'out', 'away': 'out', 'withdraw': 'out', 'withdrawn': 'out', 'remove': 'out', 'removed': 'out',
  'still': 'still', 'held-still': 'still', 'hold-still': 'still', 'stationary': 'still', 'at-rest': 'still', 'rest': 'still', 'not-moving': 'still', 'stopped': 'still', 'stop': 'still',
}
const SPEED_WORDS: Record<string, Speed> = {
  'same': 'same', 'same-speed': 'same', 'steady': 'same', 'reference': 'same', 'as-before': 'same', 'unchanged': 'same', 'equal': 'same',
  'faster': 'faster', 'fast': 'faster', 'quicker': 'faster', 'quickly': 'faster', 'quick': 'faster', 'more-quickly': 'faster', 'speed-up': 'faster',
  'slower': 'slower', 'slow': 'slower', 'slowly': 'slower', 'more-slowly': 'slower', 'slow-down': 'slower',
}

const word = <T,>(table: Record<string, T>, raw: unknown): T | null => {
  if (typeof raw !== 'string') return null
  const k = slug(raw).replace(/^the-/, '').replace(/-$/, '')
  return own(table, k) ? table[k] : null
}

function readInt(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
  if (typeof raw !== 'string') return null
  const m = /^\s*(\d+(?:\.\d+)?)\s*(?:compass(?:es)?|needles?|points?)?\s*$/i.exec(raw)
  return m ? Number(m[1]) : null
}

const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)
const shown = (v: unknown) => (typeof v === 'string' ? `"${v}"` : JSON.stringify(v))

// ---------------------------------------------------------------------------
// What would teach nothing, or wrongly.

function fieldFaults(task: FieldTask): string[] {
  const out = [...(task.unread ?? [])]
  if (task.kind === 'compass' && task.count !== undefined && (!Number.isInteger(task.count) || task.count < MIN_COMPASSES || task.count > MAX_COMPASSES)) {
    out.push(`${task.count} compasses is not a number the card can hold: use ${MIN_COMPASSES} to ${MAX_COMPASSES} (e.g. ${DEFAULT_COMPASSES}), or leave it out.`)
  }
  return out
}

function inductionFaults(task: InductionTask): string[] {
  const out = [...(task.unread ?? [])]
  if (!out.length && isReference(task)) {
    out.push('The north pole pushed in at the same speed is the reference case the card shows first, so there is nothing to predict. Change the pole, the movement or the speed, e.g. pole "S" and motion "in", or motion "in" with speed "faster".')
  }
  return out
}

// ---------------------------------------------------------------------------
// The prompt a card is written with.

const sentences = (text: string) => text.split(/[.?!]+\s+/).filter(Boolean)

/** The rule that tells the way the field points, which the learner is to bring. */
const FLOW_RULES: RegExp[] = [
  /\b(?:north|south)\b[^.?!]{0,30}\b(?:to|towards?|into|onto)\b[^.?!]{0,15}\b(?:south|north)\b/i,
  /\b(?:away from|out of|leaves?|leaving|emerges? from|comes? out of|starts? (?:at|from)|begins? (?:at|from))\b[^.?!]{0,25}\b(?:north|south)\b/i,
  /\b(?:towards?|into|enters?|entering|ends? (?:at|on)|goes? into|returns? to)\b[^.?!]{0,25}\b(?:north|south)\b/i,
  /\bN\s*(?:to|->|→|-)\s*S\b/,
]

function fieldPromptFaults(task: FieldTask, prompt: string): string[] {
  const out: string[] = []
  const said = FLOW_RULES.map((re) => re.exec(prompt)).find(Boolean)
  if (said) {
    out.push(`the prompt gives the rule for the field's direction ("${said[0].trim()}"), which the learner brings to ${task.kind === 'compass' ? 'turn the needles' : 'name the poles'}: ask the question and leave the rule out (it is said once marked).`)
  }
  if (task.kind === 'compass') {
    const way = /\b(?:point|points|pointing)\b[^.?!]{0,20}\b(?:left|right|up|down|upwards|downwards)\b/i.exec(prompt)
    if (way) out.push(`the prompt says which way a needle points ("${way[0].trim()}"): ask for the field's direction and leave the answer out.`)
    return out
  }
  const side = /\b(?:left|right)\b[^.?!]{0,30}\b(?:north|south)\b|\b(?:north|south)\b[^.?!]{0,30}\b(?:left|right)\b/i.exec(prompt)
    ?? /\b[Ee]nd\s+[A-D]\b[^.?!]{0,25}\b(?:[Nn]orth|[Ss]outh)\b|\b(?:[Nn]orth|[Ss]outh)\b[^.?!]{0,25}\b[Ee]nd\s+[A-D]\b/.exec(prompt)
  if (side) out.push(`the prompt says where a pole is ("${side[0].trim()}"), which the learner is to name: ask them to name the poles and leave the answer out.`)
  if (task.arrangement !== 'single') {
    const rel = /\b(?:attract\w*|repel\w*|repuls\w+|unlike|like poles|opposite poles|same poles)\b/i.exec(prompt)
    if (rel) out.push(`the prompt says how the two magnets act ("${rel[0]}"), which the learner works out from the field lines: leave it out.`)
  }
  return out
}

const NEEDLE_WORDS = /\b(?:needle|pointer|meter|galvanometer|deflect\w*|swing\w*|swung|reading|e\.?m\.?f\.?|current)\b/i
const BIGGER = /\b(?:bigger|larger|greater|further|farther|stronger|increas\w+|more deflection)\b/i
const SMALLER = /\b(?:smaller|weaker|decreas\w+|less far|shorter|less deflection)\b/i
const NO_SWING = /\b(?:no|zero)\s+(?:deflection|reading|current|e\.?m\.?f\.?|swing)\b|\b(?:does|will|would|can)(?:\s*n[o']t|\s+not)\s+(?:move|deflect|swing|show)\b|\bwon['’]t\s+(?:move|deflect|swing)\b|\b(?:stays?|remains?)\s+(?:at\s+)?(?:zero|still|put)\b|\bnot\s+(?:move|deflect|swing)\b/i
const REVERSES = /\b(?:revers\w+|flips?)\b|\b(?:opposite|other|same)\s+(?:way|direction|side)\b/i

function inductionPromptFaults(prompt: string): string[] {
  const out: string[] = []
  for (const s of sentences(prompt)) {
    if (!NEEDLE_WORDS.test(s)) continue
    const left = /\bleft\b/i.test(s)
    const right = /\bright\b/i.test(s)
    if (left !== right) out.push(`the prompt names a side the needle swings ("${s.trim()}"): the learner works out which side from the reference, so ask which way it swings and leave the side out.`)
    else if (BIGGER.test(s) !== SMALLER.test(s)) out.push(`the prompt says how big the swing is ("${s.trim()}"): ask how far it swings compared with the reference and leave the answer out.`)
    else if (NO_SWING.test(s) && !(left && right)) out.push(`the prompt says whether the needle moves ("${s.trim()}"): ask what it does and leave the answer out.`)
    else if (REVERSES.test(s)) out.push(`the prompt says the swing reverses or not ("${s.trim()}"): that is the rule the learner is to use, so leave it out (it is said once marked).`)
  }
  return out.slice(0, 2)
}

// ---------------------------------------------------------------------------

export const magnetismEngine: SceneEngine<MagnetismConfig, MagnetismState> = {
  id: 'magnetism',
  // Phrases a station on these ideas would use, each with a word that is its own: scenesFor wants every word of a phrase in the
  // station, so "plotting compass" is never a map's compass, nor "magnetic fields" a gravitational field. sceneCatalogue offers
  // the entry on any one word, so "magnetic" also offers it (only offers it) to a station on magnetic materials. Not the bare
  // "magnets" (the same, more), "current" (every circuit), "field lines" ("line graphs") or "electromagnetic" (the spectrum).
  covers: ['magnetic fields', 'plotting compass', 'electromagnetic induction', 'induced emf'],
  // The learner places a direction: which way a needle points, which end is which pole, which way a needle swings.
  isolates: 'position',

  parse(raw) {
    const task = (raw as { task?: unknown } | null)?.task
    if (!task || typeof task !== 'object') return null
    const t = task as Record<string, unknown>
    const kind = word(KIND_WORDS, t.kind)
    if (!kind) return null
    const unread: string[] = []

    if (kind === 'induction') {
      const poleRaw = first(t, ['pole', 'leading_pole', 'leadingPole', 'magnet', 'end'])
      const motionRaw = first(t, ['motion', 'movement', 'move', 'action'])
      const speedRaw = first(t, ['speed', 'rate', 'how_fast', 'howFast'])
      let motion: Motion = 'in'
      if (motionRaw === undefined) unread.push('The movement is missing: say how the magnet moves, "in", "out" or "still".')
      else {
        const m = word(MOTION_WORDS, motionRaw)
        if (m) motion = m
        else unread.push(`${shown(motionRaw)} is not a movement the card can draw: use "in", "out" or "still".`)
      }
      let pole: Pole = 'N'
      if (poleRaw === undefined) {
        if (motion !== 'still') unread.push('The pole is missing: say which pole of the magnet points into the coil, "N" or "S".')
      } else {
        const p = word(POLE_WORDS, poleRaw)
        if (p) pole = p
        else unread.push(`${shown(poleRaw)} is not a pole: use "N" or "S".`)
      }
      let speed: Speed | undefined
      if (speedRaw !== undefined && motion !== 'still') {
        const s = word(SPEED_WORDS, speedRaw)
        if (s) speed = s
        else unread.push(`${shown(speedRaw)} is not a speed the card can draw: use "same", "faster" or "slower".`)
      }
      const out: InductionTask = { kind, pole, motion, ...(speed ? { speed } : {}), ...(unread.length ? { unread } : {}) }
      return { task: out }
    }

    const arrangementRaw = first(t, ['arrangement', 'magnets', 'layout', 'setup', 'magnet'])
    let arrangement: Arrangement = 'single'
    if (arrangementRaw !== undefined) {
      const a = word(ARRANGEMENT_WORDS, arrangementRaw)
      if (a) arrangement = a
      else unread.push(`${shown(arrangementRaw)} is not an arrangement the card can draw: use ${listOr(ARRANGEMENTS.map((x) => `"${x}"`))}.`)
    }
    const leftRaw = first(t, ['leftEnd', 'left_end', 'left'])
    let leftEnd: Pole | undefined
    if (leftRaw !== undefined) {
      const p = word(POLE_WORDS, leftRaw)
      if (p) leftEnd = p
      else unread.push(`${shown(leftRaw)} is not a pole for the far left end: use "N" or "S", or leave it out.`)
    }
    const base = { arrangement, ...(leftEnd ? { leftEnd } : {}) }
    if (kind === 'pole') {
      const out: PoleTask = { kind, ...base, ...(unread.length ? { unread } : {}) }
      return { task: out }
    }
    const countRaw = first(t, ['count', 'compasses', 'points', 'needles'])
    let count: number | undefined
    if (countRaw !== undefined) {
      const n = readInt(countRaw)
      if (n === null) unread.push(`${shown(countRaw)} is not a number of compasses: use ${MIN_COMPASSES} to ${MAX_COMPASSES}.`)
      else count = n
    }
    const out: CompassTask = { kind, ...base, ...(count !== undefined ? { count } : {}), ...(unread.length ? { unread } : {}) }
    return { task: out }
  },

  faults(config) {
    const task = config.task
    return task.kind === 'induction' ? inductionFaults(task) : fieldFaults(task)
  },

  promptFaults(config, prompt) {
    const task = config.task
    return task.kind === 'induction' ? inductionPromptFaults(prompt) : fieldPromptFaults(task, prompt)
  },

  initial(config) {
    const task = config.task
    if (task.kind === 'compass') return { angles: sitesOf(task).map((s) => s.start) }
    if (task.kind === 'pole') return { ends: endsOf(task).map(() => '') }
    return { way: '', size: '' }
  },

  check(config, state) {
    const task = config.task
    if (task.kind === 'compass') {
      const v = compassVerdict(task, state)
      return { ok: v.ok, wrongIds: v.wrong.map(String) }
    }
    if (task.kind === 'pole') {
      const v = poleVerdict(task, state)
      return { ok: v.ok, wrongIds: v.wrong.map(String) }
    }
    return { ok: inductionVerdict(task, state).ok, wrongIds: [] }
  },

  solve(config) {
    const task = config.task
    if (task.kind === 'compass') return { angles: sitesOf(task).map((s) => s.truth) }
    if (task.kind === 'pole') return { ends: endsOf(task).map((e) => e.sign) }
    const want = outcomeOf(task)
    return { way: want.way, size: want.size ?? '' }
  },

  View: MagnetismView,

  prompt: `SCENE "magnetism" -- magnets and fields, three task kinds (IGCSE Physics 0625 sections 4.1 and 4.5.1; ages 11-16).
  (1) "compass": the field of bar magnets, plotted. The card draws the magnet(s) with N and S labelled, and a few numbered
  plotting compasses beside them. The learner turns each needle (drag it round, or click it and use the arrow keys) so its
  red end points the way the magnetic field points at that spot. The field lines are drawn only once the card is marked.
  (2) "pole": the field lines are drawn with arrows on them, with a few compasses, but the magnets' poles are NOT named.
  The learner names every end of the magnets (lettered A, B, ...) a north or a south pole. What each end is, and whether
  two magnets attract or repel, is held back until marked.
  (3) "induction": a magnet, a coil and a centre-zero meter. A REFERENCE case is shown first (the north pole pushed into
  the coil at a steady speed, the needle swinging to one side). Then a different case is described in words and picture
  (the pole, in or out, faster or slower, or held still) and the learner says which way the needle swings (left, stays at
  zero or right) and how far compared with the reference (further, same distance or less far). Which side, and the reasons
  (reversing the pole or the movement reverses the swing; a faster movement swings further; a magnet held still gives
  nothing) are given once marked.
  For: magnetic fields, magnetic field lines and their direction (north to south outside a magnet), a plotting compass,
  like and unlike poles facing, the neutral point, electromagnetic induction. Not for: sorting magnetic and non-magnetic
  materials, electromagnets, motors, generators or transformers.
  config: { "task": { "kind":"compass", "arrangement":"<single | attract | repel>", "count":<2 to 4, default 3> } }
            -- single: one bar magnet; attract: two bar magnets end to end, unlike poles facing; repel: two, like poles facing
       or { "task": { "kind":"pole", "arrangement":"<single | attract | repel>" } }
       or { "task": { "kind":"induction", "pole":"<N | S: the pole pointing into the coil>", "motion":"<in | out | still>",
                      "speed":"<same | faster | slower: against the reference; leave out when still>" } }
            -- the case N pole, in, same speed IS the reference and is refused: change at least one thing
       Optional on compass and pole: "leftEnd":"<N | S>", the pole at the far left end; the engine picks one if left out.
  - the prompt names the question. It never says which way a needle points, which end is a north or south pole, the rule
    "field lines run from north to south", whether the magnets attract or repel (pole), which side the meter needle swings
    to, whether the swing is bigger or smaller, or whether it reverses.
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Turn each compass so the red end of its needle shows the way the magnetic field points at that spot.",
    "payload": { "engine":"magnetism", "config": { "task": { "kind":"compass", "arrangement":"single", "count":3 } } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"position", "apparatus":"scene:magnetism", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"The field lines of these two magnets are drawn. Name each end of the magnets a north pole or a south pole.",
    "payload": { "engine":"magnetism", "config": { "task": { "kind":"pole", "arrangement":"repel" } } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"position", "apparatus":"scene:magnetism", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Predict what the meter needle does in the second case. Which way does it swing, and how far compared with the reference?",
    "payload": { "engine":"magnetism", "config": { "task": { "kind":"induction", "pole":"S", "motion":"out", "speed":"faster" } } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"position", "apparatus":"scene:magnetism", "why":"..." } }`,
}

registerEngine(magnetismEngine as SceneEngine<unknown, unknown>)
