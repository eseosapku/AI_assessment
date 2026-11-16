import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
// The engine first: it registers itself, and its view comes with it.
import {
  geometryConstructionEngine as engine, ARC, CLEAR, EDGE, DRAG, MAX_SIDES, MIN_ANGLE, MIN_LINES, MIN_MOVES, MIN_SIDES, PAIRS, PAR, PAIR_LABELS,
  PLATE_H, PLATE_W, POLYGON_NAMES, REASON_ORDER, REASON_TEXT, RULES, SITUATIONS, THETA_START, TRI, TRI_SHAPES, TRI_START,
  angleOf, arcPath, corners, dirOf, distBoxBox, dragFigure, dragSaid, dragVerdict, factsSaid, factsVerdict, figureOf, figureText, handleOf,
  insideConvex, labelsFit, nearestFeasible, norm360, parallelFig, placeLabels, polyFig, polygonAnswer, polygonSaid, polygonSum, posFrom, posSize,
  quadPoints, quadShapes, readAB, readLines, readReasons, readTheta, regions, regularAngle, regularPoints, regularWhole, rng, hash, ruleOf,
  solveTask, thetaFromPoint, figureWithTyped, typedForms, THETA_LAST, triApex, triLattice, triSnap, triStep, triValid, triangleAt, triangleCount, typedNumber,
  type AngleFactsTask, type Box, type DragTask, type Fig, type GeometryConfig, type GeometryState, type Mark, type PairName, type PolygonTask,
  type Pt, type ReasonId, type Seg, type Situation,
} from './config'
import { GeometryConstructionView } from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import type { SceneMarked } from '../types'
import { meaningFaults } from '../../meaning'
import { validateSpec } from '../../activities/validate'
import { dimensionsOf } from '../../activities/dimensions'
import { checkIntent } from '../../activities/intent'
import '..'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

/**
 * Angle facts on accurate figures: the tutor names a situation (and may give sizes), the engine draws it to scale from exact
 * whole-degree angles, and marks the size of x and the facts ticked; a corner or a line to drag; a polygon to split.
 */

const facts = (situation: Situation, known: number[], unknown?: string, variant?: number): GeometryConfig =>
  engine.parse({ task: { kind: 'angle-facts', situation, known, ...(unknown ? { unknown } : {}), ...(variant ? { variant } : {}) } })!
const task = (c: GeometryConfig) => c.task as AngleFactsTask
const polygon = (sides: number, ask: 'sum' | 'one-angle' = 'sum'): GeometryConfig => ({ task: { kind: 'polygon-sum', sides, ask } })
const drag = (figure: 'triangle' | 'parallel', pair?: PairName): GeometryConfig => ({ task: { kind: 'drag-invariant', figure, ...(pair ? { pair } : {}) } })
const faultsOf = (c: GeometryConfig) => engine.faults(c)

// ---------------------------------------------------------------------------
// Independent oracles: the answer from the textbook fact, sharing nothing with solveTask.

const sumOf = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

/** The size of x by the fact itself, or null when the figure cannot be drawn (ranges as the engine documents them). */
function answerBy(sit: Situation, unknown: string, known: number[]): number | null {
  const within = (x: number, lo: number, hi: number) => Number.isInteger(x) && x >= lo && x <= hi
  const seq = (total: number, counts: number[], max: number): number | null => {
    if (!counts.includes(known.length + 1) || !known.every((k) => within(k, MIN_ANGLE, max))) return null
    const x = total - sumOf(known)
    return within(x, MIN_ANGLE, max) ? x : null
  }
  switch (sit) {
    case 'straight-line': return seq(180, [2, 3, 4], 160)
    case 'round-point': return seq(360, [3, 4, 5], 270)
    case 'triangle': return seq(180, [3], 140)
    case 'quadrilateral': return seq(360, [4], 160)
    case 'vertically-opposite': return known.length === 1 && within(known[0], MIN_LINES, 150) ? (unknown === 'opposite' ? known[0] : 180 - known[0]) : null
    case 'isosceles': {
      if (known.length !== 1) return null
      const k = known[0]
      if (unknown === 'base') return within(k, 20, 140) && k % 2 === 0 ? (180 - k) / 2 : null
      if (!within(k, 20, 80)) return null
      return unknown === 'apex' ? 180 - 2 * k : k
    }
    case 'co-interior': return known.length === 1 && within(known[0], MIN_LINES, 150) ? 180 - known[0] : null
    default: return known.length === 1 && within(known[0], MIN_LINES, 150) ? known[0] : null
  }
}

const REASONS_BY: Record<string, ReasonId[]> = {
  'straight-line': ['straight'], 'round-point': ['point'], 'triangle': ['triangle'], 'quadrilateral': ['quadrilateral'],
  'alternate': ['alternate'], 'corresponding': ['corresponding'], 'co-interior': ['co-interior'],
}
function reasonsBy(sit: Situation, unknown: string): ReasonId[] {
  if (sit === 'vertically-opposite') return unknown === 'opposite' ? ['vertical'] : ['straight']
  if (sit === 'isosceles') return unknown === 'other-base' ? ['base'] : ['base', 'triangle']
  return REASONS_BY[sit]
}
const sortedReasons = (xs: ReasonId[]) => [...xs].sort((a, b) => REASON_ORDER.indexOf(a) - REASON_ORDER.indexOf(b))

const UNKNOWNS: Record<Situation, string[]> = {
  'straight-line': ['first', 'second', 'third', 'fourth'], 'round-point': ['first', 'second', 'third', 'fourth', 'fifth'],
  'vertically-opposite': ['opposite', 'adjacent'], 'triangle': ['bottom-left', 'bottom-right', 'top'],
  'quadrilateral': ['bottom-left', 'bottom-right', 'top-right', 'top-left'], 'isosceles': ['apex', 'base', 'other-base'],
  'alternate': ['upper', 'lower'], 'corresponding': ['upper', 'lower'], 'co-interior': ['upper', 'lower'],
}

/** Every card the writer can ask for, in the ranges the engine supports (a stride keeps the big ones to a size a test can run). */
function* everyTask(): Generator<AngleFactsTask> {
  const mk = (situation: Situation, unknown: string, known: number[]): AngleFactsTask => ({ kind: 'angle-facts', situation, unknown, known })
  for (let a = 15; a <= 165; a++) for (const u of ['first', 'second']) yield mk('straight-line', u, [a])
  for (let a = 15; a <= 150; a += 5) for (let b = 15; b <= 150; b += 5) for (const u of ['first', 'second', 'third']) yield mk('straight-line', u, [a, b])
  for (let a = 20; a <= 140; a += 20) for (let b = 20; b <= 140; b += 20) for (let c = 20; c <= 140; c += 20) for (const u of ['first', 'fourth']) yield mk('straight-line', u, [a, b, c])
  for (let a = 15; a <= 275; a += 15) for (let b = 15; b <= 275; b += 15) for (const u of ['first', 'second', 'third']) yield mk('round-point', u, [a, b])
  for (let a = 20; a <= 270; a += 40) for (let b = 20; b <= 270; b += 40) for (let c = 20; c <= 270; c += 40) for (const u of ['first', 'fourth']) yield mk('round-point', u, [a, b, c])
  for (let a = 20; a <= 260; a += 60) for (let b = 20; b <= 260; b += 60) for (let c = 20; c <= 260; c += 60) for (let d = 20; d <= 260; d += 60) yield mk('round-point', 'second', [a, b, c, d])
  for (let a = 15; a <= 145; a += 4) for (let b = 15; b <= 145; b += 4) for (const u of UNKNOWNS.triangle) yield mk('triangle', u, [a, b])
  for (let a = 20; a <= 160; a += 20) for (let b = 20; b <= 160; b += 20) for (let c = 20; c <= 160; c += 20) for (const u of UNKNOWNS.quadrilateral) yield mk('quadrilateral', u, [a, b, c])
  for (let a = 15; a <= 145; a++) for (const u of ['apex', 'base', 'other-base']) yield mk('isosceles', u, [a])
  for (let a = 25; a <= 155; a++) for (const u of UNKNOWNS['vertically-opposite']) yield mk('vertically-opposite', u, [a])
  for (const sit of ['alternate', 'corresponding', 'co-interior'] as Situation[]) for (let a = 25; a <= 155; a++) for (const u of ['upper', 'lower']) yield mk(sit, u, [a])
}

// ---------------------------------------------------------------------------
// Measuring a figure back off its coordinates.

const near = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol
/** The directions, from a point, of every drawn line that touches it (a line passing through it counts both ways). */
function raysAt(fig: Fig, p: Pt): number[] {
  const out: number[] = []
  const eq = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y) < 1e-6
  for (const s of fig.segs) {
    if (eq(s.a, p)) out.push(norm360(angleOf(p, s.b)))
    else if (eq(s.b, p)) out.push(norm360(angleOf(p, s.a)))
    else {
      // p lies inside the segment?
      const cross = (s.b.x - s.a.x) * (p.y - s.a.y) - (s.b.y - s.a.y) * (p.x - s.a.x)
      const dot = (p.x - s.a.x) * (s.b.x - s.a.x) + (p.y - s.a.y) * (s.b.y - s.a.y)
      const len2 = (s.b.x - s.a.x) ** 2 + (s.b.y - s.a.y) ** 2
      if (Math.abs(cross) < 1e-6 * Math.sqrt(len2) && dot > 1e-9 && dot < len2 - 1e-9) out.push(norm360(angleOf(p, s.a)), norm360(angleOf(p, s.b)))
    }
  }
  return out
}
const hasRay = (rays: number[], d: number) => rays.some((r) => Math.abs(norm360(r - d + 180) - 180) < 1e-6)

/** A mark measures what it says: both its rays are drawn, and no other line cuts through it. */
function markProblems(fig: Fig, m: Mark): string[] {
  const rays = raysAt(fig, m.at)
  const out: string[] = []
  if (!hasRay(rays, m.from)) out.push(`no line at ${m.from}`)
  if (!hasRay(rays, m.from + m.size)) out.push(`no line at ${m.from + m.size}`)
  for (const r of rays) {
    const d = norm360(r - m.from)
    if (d > 1e-5 && d < m.size - 1e-5) out.push(`a line at ${r} cuts the angle`)
  }
  return out
}

const segDist = (p: Pt, a: Pt, b: Pt) => {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const l2 = dx * dx + dy * dy
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2))
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy)
}
/** The gap between a box and a segment by sampling the box's whole area (not the engine's own geometry). */
function sampledGap(b: Box, s: Seg): number {
  let best = Infinity
  for (let i = 0; i <= 12; i++) for (let j = 0; j <= 6; j++) best = Math.min(best, segDist({ x: b.x + (b.w * i) / 12, y: b.y + (b.h * j) / 6 }, s.a, s.b))
  return best
}

/** Everything a figure's labels must be: placed, inside their angle, clear of every line, apart, nearest their own corner. */
function labelProblems(fig: Fig, boxes: (Box | null)[], extra: Box[] = []): string[] {
  const out: string[] = []
  const lines = [...fig.segs, ...fig.ticks, ...fig.chevrons]
  fig.marks.forEach((m, i) => {
    const b = boxes[i]
    if (!b) return void out.push(`label ${m.text} has no place`)
    if (b.x < EDGE - 1e-9 || b.y < EDGE - 1e-9 || b.x + b.w > PLATE_W - EDGE + 1e-9 || b.y + b.h > PLATE_H - EDGE + 1e-9) out.push(`${m.text} leaves the plate`)
    if (b.h < 16) out.push(`${m.text} box is too short`)
    for (const c of corners(b)) {
      const d = norm360(angleOf(m.at, c) - m.from)
      if (d < 1 || d > m.size - 1) out.push(`${m.text} sits outside its own angle`)
    }
    // Clear of its own arc: the nearest point of the box to the corner is beyond the arc.
    let nearest = Infinity
    for (let a = 0; a <= 12; a++) for (let c = 0; c <= 6; c++) nearest = Math.min(nearest, Math.hypot(b.x + (b.w * a) / 12 - m.at.x, b.y + (b.h * c) / 6 - m.at.y))
    if (nearest < ARC + 4) out.push(`${m.text} touches its own arc`)
    for (const s of lines) if (sampledGap(b, s) < CLEAR - 0.35) out.push(`${m.text} touches a line`)
    for (const e of extra) if (distBoxBox(b, e) < 2) out.push(`${m.text} touches a handle`)
    // Nearer its own corner than any other corner, for marks at different corners.
    const dist = (p: Pt) => {
      let best = Infinity
      for (let a = 0; a <= 12; a++) for (let c = 0; c <= 6; c++) best = Math.min(best, Math.hypot(b.x + (b.w * a) / 12 - p.x, b.y + (b.h * c) / 6 - p.y))
      return best
    }
    fig.marks.forEach((o, j) => {
      if (j !== i && Math.hypot(o.at.x - m.at.x, o.at.y - m.at.y) > 1 && dist(o.at) <= dist(m.at)) out.push(`${m.text} is nearer another corner`)
    })
    boxes.forEach((o, j) => {
      if (j > i && o && distBoxBox(b, o) < CLEAR - 1e-9) out.push(`${m.text} touches ${fig.marks[j].text}`)
    })
  })
  // The arc stays on the plate.
  for (const m of fig.marks) {
    for (let k = 0; k <= 12; k++) {
      const p = { x: m.at.x + ARC * dirOf(m.from + (m.size * k) / 12).x, y: m.at.y + ARC * dirOf(m.from + (m.size * k) / 12).y }
      if (p.x < 0 || p.y < 0 || p.x > PLATE_W || p.y > PLATE_H) out.push(`an arc leaves the plate`)
    }
  }
  return out
}

/** Figures: every drawn point is on the plate. */
function onPlate(fig: Fig): boolean {
  const pts = [...fig.segs.flatMap((s) => [s.a, s.b]), ...fig.ticks.flatMap((s) => [s.a, s.b]), ...fig.chevrons.flatMap((s) => [s.a, s.b]), ...fig.dots, ...fig.fill]
  return pts.every((p) => p.x >= 0 && p.x <= PLATE_W && p.y >= 0 && p.y <= PLATE_H)
}

// ---------------------------------------------------------------------------

describe('reading what the tutor writes', () => {
  it('reads a situation however it is reasonably written', () => {
    const sit = (raw: string) => (engine.parse({ task: { kind: 'angle-facts', situation: raw } })!.task as AngleFactsTask).situation
    expect(sit('Angles on a straight line')).toBe('straight-line')
    expect(sit('straight_line')).toBe('straight-line')
    expect(sit('angles round a point')).toBe('round-point')
    expect(sit('Angles around a point')).toBe('round-point')
    expect(sit('vertically opposite')).toBe('vertically-opposite')
    expect(sit('Angles in a triangle')).toBe('triangle')
    expect(sit('quadrilateral')).toBe('quadrilateral')
    expect(sit('isosceles triangle')).toBe('isosceles')
    expect(sit('Alternate angles')).toBe('alternate')
    expect(sit('Z-angles')).toBe('alternate')
    expect(sit('corresponding')).toBe('corresponding')
    expect(sit('Co-interior angles')).toBe('co-interior')
    expect(sit('allied')).toBe('co-interior')
    expect(sit('coInterior')).toBe('co-interior')
  })

  it('reads known angles as a list, a string or with degree signs, and the unknown in any reasonable spelling', () => {
    const read = (task: Record<string, unknown>) => engine.parse({ task: { kind: 'angle-facts', ...task } })!.task as AngleFactsTask
    expect(read({ situation: 'triangle', known: [50, 60], unknown: 'top' })).toMatchObject({ known: [50, 60], unknown: 'top' })
    expect(read({ situation: 'triangle', known: '50°, 60 degrees', unknown: 'Apex' })).toMatchObject({ known: [50, 60], unknown: 'top' })
    expect(read({ situation: 'straight-line', known: ['120'], unknown: 'Last' })).toMatchObject({ known: [120], unknown: 'second' })
    expect(read({ situation: 'straight-line', known: [40, 70], unknown: '1st' })).toMatchObject({ unknown: 'first' })
    expect(read({ situation: 'isosceles', known: [40], unknown: 'the other base angle' })).toMatchObject({ unknown: 'other-base' })
    expect(read({ situation: 'vertically-opposite', known: [70], unknown: 'next to' })).toMatchObject({ unknown: 'adjacent' })
    expect(read({ situation: 'co-interior', known: [70], unknown: 'bottom' })).toMatchObject({ unknown: 'lower' })
  })

  it('reads a task with or without the "task" wrapper, and infers its kind', () => {
    expect(engine.parse({ kind: 'polygon-sum', sides: 6 })).toEqual({ task: { kind: 'polygon-sum', sides: 6, ask: 'sum' } })
    expect(engine.parse({ task: { sides: 'hexagon', ask: 'one angle' } })).toEqual({ task: { kind: 'polygon-sum', sides: 6, ask: 'one-angle' } })
    expect(engine.parse({ task: { kind: 'Drag', figure: 'Triangle' } })).toEqual({ task: { kind: 'drag-invariant', figure: 'triangle' } })
    expect(engine.parse({ task: { figure: 'parallel lines', pair: 'Alternate angles' } })).toEqual({ task: { kind: 'drag-invariant', figure: 'parallel', pair: 'alternate' } })
    expect(engine.parse({ task: { figure: 'co-interior' } })).toEqual({ task: { kind: 'drag-invariant', figure: 'parallel', pair: 'co-interior' } })
    expect((engine.parse({ task: { situation: 'triangle' } })!.task as AngleFactsTask).kind).toBe('angle-facts')
  })

  it('returns null only for what cannot be read at all, and says the rest through faults()', () => {
    for (const raw of [null, undefined, 7, 'triangle', [], {}, { task: null }, { task: 'triangle' }, { task: [] }]) expect(engine.parse(raw), JSON.stringify(raw)).toBeNull()
    const f = (task: Record<string, unknown>) => faultsOf(engine.parse({ task })!).join(' ')
    expect(f({ kind: 'sing', situation: 'triangle' })).toMatch(/kind "sing" is not one of: angle-facts, drag-invariant, polygon-sum/)
    expect(f({ kind: 'angle-facts' })).toMatch(/needs a "situation": one of "straight-line"/)
    expect(f({ kind: 'angle-facts', situation: 'bearings' })).toMatch(/situation "bearings" is not one this scene draws/)
    expect(f({ kind: 'angle-facts', situation: 'parallel lines' })).toMatch(/Say which angles in parallel lines: "alternate", "corresponding" or "co-interior"/)
    expect(f({ kind: 'angle-facts', situation: 'triangle', known: [50, 'x'] })).toMatch(/"x" in known is not a number of degrees/)
    expect(f({ kind: 'angle-facts', situation: 'triangle', known: { a: 1 } })).toMatch(/"known" should be a list/)
    expect(f({ kind: 'angle-facts', situation: 'triangle', unknown: 'middle' })).toMatch(/unknown "middle" is not a corner of this figure/)
    expect(f({ kind: 'angle-facts', situation: 'isosceles', unknown: 'legs' })).toMatch(/not an angle of an isosceles triangle/)
    expect(f({ kind: 'angle-facts', situation: 'straight-line', unknown: 'sideways' })).toMatch(/not an angle position/)
    expect(f({ kind: 'angle-facts', situation: 'alternate', variant: 'big' })).toMatch(/"variant" "big" is not a whole number/)
    expect(f({ kind: 'drag-invariant' })).toMatch(/needs a "figure"/)
    expect(f({ kind: 'drag-invariant', figure: 'circle' })).toMatch(/figure "circle" is not one this scene drags/)
    expect(f({ kind: 'drag-invariant', figure: 'parallel-lines' })).toMatch(/Say which pair of angles to mark/)
    expect(f({ kind: 'drag-invariant', figure: 'triangle', pair: 'alternate' })).toMatch(/"pair" belongs to the parallel lines/)
    expect(f({ kind: 'drag-invariant', figure: 'parallel-lines', pair: 'opposite sides' })).toMatch(/pair "opposite sides" is not one this scene marks/)
    expect(f({ kind: 'polygon-sum' })).toMatch(/needs "sides"/)
    expect(f({ kind: 'polygon-sum', sides: 'lots' })).toMatch(/"sides" "lots" is not a number/)
    expect(f({ kind: 'polygon-sum', sides: 6, ask: 'colour' })).toMatch(/ask "colour" is not one of/)
  })
})

// ---------------------------------------------------------------------------

describe('every angle-facts card the engine can draw', { timeout: 300_000 }, () => {
  it('works out x by the fact, accepts what it can draw and refuses the rest, and every card starts unsolved and can be solved', () => {
    let drawn = 0
    let refusedRange = 0
    let tight = 0
    const bySit: Record<string, number> = {}
    for (const t of everyTask()) {
      const c: GeometryConfig = { task: t }
      const label = `${t.situation} ${t.unknown} ${t.known}`
      const want = answerBy(t.situation as Situation, t.unknown, t.known)
      const s = solveTask(t)
      if (want === null) {
        if (!Array.isArray(s)) throw new Error(`${label}: drawn, but out of range`)
        refusedRange++
        expect(faultsOf(c), label).toHaveLength(1)
        expect(engine.check(c, engine.solve(c)).ok, label).toBe(false)
        continue
      }
      if (Array.isArray(s)) throw new Error(`${label}: in range but refused: ${s.join(' ')}`)
      if (s.answer !== want) throw new Error(`${label}: x is ${s.answer}, not ${want}`)
      expect(s.reasons, label).toEqual(sortedReasons(reasonsBy(t.situation as Situation, t.unknown)))
      // The marked angles are the given ones with x among them, and add up as the fact says.
      expect(s.sizes.length, label).toBeGreaterThanOrEqual(2)
      expect(s.sizes[s.at], label).toBe(s.answer)
      const start = engine.check(c, engine.initial(c))
      if (start.ok) throw new Error(`${label}: starts solved`)
      const fits = labelsFit(t, s)
      if (fits) {
        drawn++
        bySit[t.situation] = (bySit[t.situation] ?? 0) + 1
        // faults() says nothing for a card that can be drawn (checked for one in ten: it repeats the same search).
        if (drawn % 10 === 0) expect(faultsOf(c), label).toEqual([])
        const solved = engine.solve(c)
        if (!engine.check(c, solved).ok) throw new Error(`${label}: solve() does not pass check()`)
        // Off by one in x, one fact too few, one too many: each is wrong, and each is said.
        const st = solved as GeometryState
        if (engine.check(c, { ...st, value: String(s.answer + 1) }).ok) throw new Error(`${label}: x + 1 passes`)
        if (engine.check(c, { ...st, reasons: [] }).ok) throw new Error(`${label}: no fact passes`)
        const other = REASON_ORDER.find((r) => !s.reasons.includes(r))!
        if (engine.check(c, { ...st, reasons: [...(st.reasons ?? []), other] }).ok) throw new Error(`${label}: an extra fact passes`)
      } else {
        tight++
        const faults = faultsOf(c)
        expect(faults, label).toHaveLength(1)
        expect(faults[0], label).toMatch(/too tight to letter every angle clearly/)
        expect(faults[0], label).toMatch(/use e\.g\. "known": \[[\d, ]+\]\.$/)
      }
    }
    // Both sides are well covered, and every situation has many cards.
    expect(drawn).toBeGreaterThan(5_000)
    expect(refusedRange).toBeGreaterThan(3_000)
    expect(tight).toBeGreaterThan(300)
    for (const sit of SITUATIONS) expect(bySit[sit], sit).toBeGreaterThan(100)
  })

  it('names, for a card too tight to letter, a nearby card that is not, and says so in one sentence a writer can use', () => {
    let checked = 0
    for (const t of everyTask()) {
      if ((checked > 200)) break
      const s = solveTask(t)
      if (Array.isArray(s) || labelsFit(t, s)) continue
      checked++
      const f = faultsOf({ task: t })[0]
      const m = /"known": \[([\d, ]+)\]\.$/.exec(f)!
      const known = m[1].split(',').map(Number)
      const fixed: AngleFactsTask = { ...t, known }
      expect(faultsOf({ task: fixed }), `${t.situation} ${t.unknown} ${t.known} -> ${known}`).toEqual([])
      expect(known.length).toBe(t.known.length)
      // Close to what was written: at most one angle changed for the nearest, else the stock example.
      const changed = known.filter((k, i) => k !== t.known[i]).length
      expect(changed).toBeLessThanOrEqual(t.known.length)
    }
    expect(checked).toBeGreaterThan(100)
    // The sentence itself.
    const thin = faultsOf(facts('triangle', [20, 20], 'top'))[0]
    expect(thin).toMatch(/^20°, 20°, x = 140° draw a figure too tight to letter every angle clearly/)
    expect(nearestFeasible(task(facts('triangle', [20, 20], 'top')))).not.toBeNull()
  })

  it('draws exactly the angles it says, to scale, with no other line cutting an angle: measured back off the coordinates', () => {
    let figures = 0
    let n = 0
    for (const t of everyTask()) {
      n++
      if (n % 3 !== 0) continue
      const s = solveTask(t)
      if (Array.isArray(s) || !labelsFit(t, s)) continue
      const fig = figureOf(t, s)
      figures++
      if (!onPlate(fig)) throw new Error(`${t.situation} ${t.unknown} ${t.known}: drawn off the plate`)
      const label = `${t.situation} ${t.unknown} ${t.known}`
      // The marks are the sizes, in order, with x being the answer.
      const sizes = fig.marks.map((m) => m.size)
      if (t.situation === 'straight-line' || t.situation === 'round-point' || t.situation === 'triangle' || t.situation === 'quadrilateral') {
        expect(sizes, label).toEqual(s.sizes)
        expect(fig.marks.map((m) => m.text), label).toEqual(s.sizes.map((z, i) => (i === s.at ? 'x' : `${z}°`)))
      } else {
        expect(fig.marks.length, label).toBeLessThanOrEqual(2)
        expect(fig.marks.filter((m) => m.role === 'unknown').map((m) => m.size), label).toEqual([s.answer])
        expect(fig.marks.filter((m) => m.role === 'given').map((m) => m.size), label).toEqual([s.sizes[0]])
      }
      expect(fig.marks.filter((m) => m.role === 'unknown'), label).toHaveLength(1)
      for (const m of fig.marks) {
        const bad = markProblems(fig, m)
        if (bad.length) throw new Error(`${label}: ${m.text} ${bad.join('; ')}`)
      }
      // The angles of a straight line sum to 180 around the point, the ones round a point to 360, as drawn.
      if (t.situation === 'straight-line') expect(sumOf(fig.marks.map((m) => m.size)), label).toBe(180)
      if (t.situation === 'round-point') expect(sumOf(fig.marks.map((m) => m.size)), label).toBe(360)
      if (fig.fill.length) {
        // A polygon: its interior angles measured from the corners add up as the fact says.
        const p = fig.fill
        let total = 0
        for (let i = 0; i < p.length; i++) {
          const next = p[(i + 1) % p.length]
          const prev = p[(i + p.length - 1) % p.length]
          const d = norm360(angleOf(p[i], prev) - angleOf(p[i], next))
          expect(d, `${label} corner ${i}`).toBeGreaterThan(0)
          expect(d, `${label} corner ${i}`).toBeLessThan(180)
          total += d
        }
        expect(near(total, (p.length - 2) * 180, 1e-6), `${label} ${total}`).toBe(true)
        for (let i = 0; i < p.length; i++) expect(Math.hypot(p[i].x - p[(i + 1) % p.length].x, p[i].y - p[(i + 1) % p.length].y), `${label} side ${i}`).toBeGreaterThan(40)
      }
    }
    expect(figures).toBeGreaterThan(1_500)
  })

  it('keeps every label inside its angle, clear of every line, apart from the others and nearest its own corner', () => {
    let figures = 0
    let n = 0
    for (const t of everyTask()) {
      n++
      if (n % 2 !== 0) continue
      const s = solveTask(t)
      if (Array.isArray(s) || !labelsFit(t, s)) continue
      figures++
      const fig = figureOf(t, s)
      const problems = labelProblems(fig, placeLabels(fig))
      if (problems.length) throw new Error(`${t.situation} ${t.unknown} ${t.known}: ${problems.join('; ')}`)
    }
    expect(figures).toBeGreaterThan(2_200)
  })

  it('marks an equal-sides triangle by ticks on the sloping sides, and parallel lines by arrows, and nothing else', () => {
    const iso = figureOf(task(facts('isosceles', [40], 'base')), solveTask(task(facts('isosceles', [40], 'base'))) as never)
    expect(iso.ticks).toHaveLength(2)
    expect(iso.chevrons).toHaveLength(0)
    // Each tick crosses the middle of its side, square on.
    iso.ticks.forEach((tick, i) => {
      const side = iso.segs.find((s) => near(Math.hypot((s.a.x + s.b.x) / 2 - (tick.a.x + tick.b.x) / 2, (s.a.y + s.b.y) / 2 - (tick.a.y + tick.b.y) / 2), 0, 1e-6))
      expect(side, `tick ${i} sits on a side's middle`).toBeTruthy()
    })
    const par = figureOf(task(facts('alternate', [70], 'lower')), solveTask(task(facts('alternate', [70], 'lower'))) as never)
    expect(par.chevrons).toHaveLength(4)
    expect(par.ticks).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------

describe('the size the learner types, drawn on the figure', { timeout: 120_000 }, () => {
  const textOf = (fig: Fig) => fig.marks.find((m) => m.role === 'unknown')!.text

  it('reads x = 55° and 55°, widest first, for a size typed with up to three digits, and nothing for none', () => {
    expect(typedForms('55')).toEqual(['x = 55\u00b0', '55\u00b0'])
    expect(typedForms('055')).toEqual(['x = 55\u00b0', '55\u00b0'])
    expect(typedForms('125')).toEqual(['x = 125\u00b0', '125\u00b0'])
    expect(typedForms('12345')).toEqual(['x = 123\u00b0', '123\u00b0'])
    expect(typedForms('0')).toEqual(['x = 0\u00b0', '0\u00b0'])
    for (const none of ['', 'x', '--', ' ']) expect(typedForms(none)).toEqual([])
  })

  it('draws, for a size typed in, a label for x that is inside its angle, clear of the lines and nearest its own corner: 1, 2 and 3 digits, on every kind of card', () => {
    const forms = { long: 0, short: 0, letter: 0 }
    let figures = 0
    let n = 0
    for (const t of everyTask()) {
      n++
      if (n % 4 !== 0) continue
      const s = solveTask(t)
      if (Array.isArray(s) || !labelsFit(t, s)) continue
      for (const typed of ['5', '55', '125', '360']) {
        const { fig, boxes, form } = figureWithTyped(t, s, typed)
        forms[form]++
        const problems = labelProblems(fig, boxes)
        if (problems.length) throw new Error(`${t.situation} ${t.unknown} ${t.known} typed ${typed}: ${problems.join('; ')}`)
        const want = String(Number(typed))
        expect(textOf(fig), `${t.situation} ${t.unknown} ${t.known} typed ${typed}`).toBe(form === 'long' ? `x = ${want}\u00b0` : form === 'short' ? `${want}\u00b0` : 'x')
        figures++
      }
    }
    expect(figures).toBeGreaterThan(5_000)
    // The size is on the figure for nearly every card, in the longer form for most.
    expect(forms.letter / figures).toBeLessThan(0.06)
    expect(forms.long / figures).toBeGreaterThan(0.7)
  })

  it('draws the answer on the figure of every card it serves: the solved drawing differs from the start by the label of x', () => {
    let figures = 0
    let n = 0
    for (const t of everyTask()) {
      n++
      if (n % 5 !== 0) continue
      const s = solveTask(t)
      if (Array.isArray(s) || !labelsFit(t, s)) continue
      const start = figureWithTyped(t, s, '')
      const solved = figureWithTyped(t, s, String(s.answer))
      expect(solved.form, `${t.situation} ${t.unknown} ${t.known}`).not.toBe('letter')
      expect(textOf(start.fig)).toBe('x')
      expect(textOf(solved.fig)).toMatch(new RegExp(`^(x = )?${s.answer}\u00b0$`))
      // The angles themselves are the same: only what x's label says moved.
      expect(solved.fig.marks.map((m) => [m.from, m.size, m.at.x, m.at.y])).toEqual(start.fig.marks.map((m) => [m.from, m.size, m.at.x, m.at.y]))
      figures++
    }
    expect(figures).toBeGreaterThan(900)
  })

  it('refuses a card whose figure could not show the size typed for x, with a sentence a writer can act on', () => {
    // Room for the letter but not for any label of the 20 degrees that x is.
    const f = faultsOf(facts('round-point', [110, 230], 'second'))
    expect(f).toHaveLength(1)
    expect(f[0]).toMatch(/draw a figure too tight to letter every angle clearly/)
    expect(f[0]).toMatch(/use e\.g\. "known": \[\d+, \d+\]\.$/)
  })
})

describe('the figure each situation draws', () => {
  it('draws the two lines of a crossing so that x is across from the known angle, or beside it', () => {
    for (let a = 30; a <= 150; a++) {
      for (const u of ['opposite', 'adjacent']) {
        const t = task(facts('vertically-opposite', [a], u))
        const s = solveTask(t) as { answer: number; sizes: number[] }
        const fig = figureOf(t, s as never)
        const [given, unknown] = [fig.marks.find((m) => m.role === 'given')!, fig.marks.find((m) => m.role === 'unknown')!]
        const apart = norm360(unknown.from - given.from)
        // Opposite: the wedge is half a turn round; adjacent: it starts where the known one ends, or ends where it starts.
        if (u === 'opposite') expect(near(apart, 180, 1e-6), `${a}`).toBe(true)
        else expect(near(apart, given.size, 1e-6) || near(norm360(apart + unknown.size), 0, 1e-6) || near(apart + unknown.size, 360, 1e-6), `${a} ${apart}`).toBe(true)
        expect(unknown.size).toBe(u === 'opposite' ? a : 180 - a)
      }
    }
  })

  it('puts the marked pair of parallel angles where the fact says, and the size of x follows from the picture', () => {
    for (const sit of ['alternate', 'corresponding', 'co-interior'] as const) {
      for (let a = 30; a <= 150; a += 3) {
        for (const u of ['upper', 'lower']) {
          const t = task(facts(sit, [a], u))
          const s = solveTask(t) as never
          const fig = figureOf(t, s)
          const [g, x] = [fig.marks.find((m) => m.role === 'given')!, fig.marks.find((m) => m.role === 'unknown')!]
          // The unknown is on the line asked, the known on the other.
          const yOf = (m: Mark) => Math.round(m.at.y)
          expect(yOf(x), `${sit} ${u} ${a}`).toBe(u === 'upper' ? PAR.uy : PAR.ly)
          expect(yOf(g), `${sit} ${u} ${a}`).toBe(u === 'upper' ? PAR.ly : PAR.uy)
          // Both angles are measured from the lines as drawn: the same transversal makes both.
          expect(g.size + (sit === 'co-interior' ? x.size : 0), `${sit} ${u} ${a}`).toBe(sit === 'co-interior' ? 180 : a)
          if (sit !== 'co-interior') expect(x.size).toBe(g.size)
        }
      }
    }
  })

  it('chooses the pair the fact names: alternate in a Z, corresponding in an F, co-interior between the lines on one side', () => {
    const POS = new Set(['TR', 'TL', 'BL', 'BR'])
    for (const [name, pairs] of Object.entries(PAIRS)) {
      for (const [a, b] of pairs) {
        expect(POS.has(a[1]) && POS.has(b[1])).toBe(true)
        const between = (p: [string, string]) => (p[0] === 'U' ? p[1] === 'BL' || p[1] === 'BR' : p[1] === 'TL' || p[1] === 'TR')
        const left = (p: [string, string]) => p[1] === 'TL' || p[1] === 'BL'
        if (name === 'alternate') {
          expect(a[0] !== b[0] && between(a) && between(b) && left(a) !== left(b), `${name} ${a} ${b}`).toBe(true)
        } else if (name === 'corresponding') {
          expect(a[0] !== b[0] && a[1] === b[1], `${name} ${a} ${b}`).toBe(true)
        } else if (name === 'co-interior') {
          expect(a[0] !== b[0] && between(a) && between(b) && left(a) === left(b), `${name} ${a} ${b}`).toBe(true)
        } else {
          expect(a[0] === b[0], `${name} ${a} ${b}`).toBe(true)
        }
      }
    }
    // Sizes at the four places: the acute-side angle is the transversal's tilt, the others its supplement.
    for (const th of [30, 65, 90, 120, 150]) {
      expect([posSize('TR', th), posSize('TL', th), posSize('BL', th), posSize('BR', th)]).toEqual([th, 180 - th, th, 180 - th])
      expect([posFrom('TR', th), posFrom('TL', th), posFrom('BL', th), posFrom('BR', th)]).toEqual([0, th, 180, 180 + th])
    }
  })

  it('finds a quadrilateral with the angles asked, for any four that add to 360', () => {
    let tried = 0
    for (let a = 30; a <= 150; a += 6) for (let b = 30; b <= 150; b += 6) for (let c = 30; c <= 150; c += 6) {
      const d = 360 - a - b - c
      if (d < 30 || d > 150) continue
      tried++
      const shapes = quadShapes([a, b, c, d])
      if (!shapes.length) throw new Error(`${[a, b, c, d]}: no quadrilateral`)
      const p = shapes[0]
      const sizes = p.map((_, i) => norm360(angleOf(p[i], p[(i + 3) % 4]) - angleOf(p[i], p[(i + 1) % 4])))
      for (let i = 0; i < 4; i++) if (!near(sizes[i], [a, b, c, d][i], 1e-6)) throw new Error(`${[a, b, c, d]}: corner ${i} measures ${sizes[i]}`)
      expect(quadPoints([a, b, c, d])).toEqual(shapes[0])
    }
    expect(tried).toBeGreaterThan(500)
  })

  it('draws a triangle with the base angles asked, and an apex that measures the rest', () => {
    for (let a = 20; a <= 140; a += 3) for (let b = 20; b <= 140; b += 3) {
      if (a + b > 160) continue
      const p = triangleAt(a, b)
      const ang = (i: number) => norm360(angleOf(p[i], p[(i + 2) % 3]) - angleOf(p[i], p[(i + 1) % 3]))
      expect(near(ang(0), a) && near(ang(1), b) && near(ang(2), 180 - a - b), `${a} ${b}`).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------

describe('the sizes the engine picks when the tutor gives none', { timeout: 30_000 }, () => {
  const unknownsOf = (sit: Situation) => UNKNOWNS[sit].filter((u) => !(sit === 'straight-line' && u === 'fourth') && !(sit === 'round-point' && u === 'fifth'))

  it('draws the same card for the same config every time, and a different card for a different variant', () => {
    for (const sit of SITUATIONS) {
      const a = engine.parse({ task: { kind: 'angle-facts', situation: sit } })
      expect(engine.parse({ task: { kind: 'angle-facts', situation: sit } })).toEqual(a)
      const seen = new Set<string>()
      for (let v = 1; v <= 24; v++) {
        const t = engine.parse({ task: { kind: 'angle-facts', situation: sit, variant: v } })!.task as AngleFactsTask
        seen.add(JSON.stringify([t.unknown, t.known]))
      }
      expect(seen.size, sit).toBeGreaterThanOrEqual(12)
    }
  })

  it('gives, for every situation, unknown and variant, a card that parses, passes faults() and is solved by solve()', () => {
    for (const sit of SITUATIONS) {
      for (const u of [undefined, ...unknownsOf(sit)]) {
        for (let v = 1; v <= 40; v++) {
          const c = engine.parse({ task: { kind: 'angle-facts', situation: sit, ...(u ? { unknown: u } : {}), variant: v } })!
          const label = `${sit} ${u} ${v}`
          expect(faultsOf(c), label).toEqual([])
          const t = c.task as AngleFactsTask
          if (u) expect(t.unknown, label).toBe(u)
          const s = solveTask(t)
          expect(Array.isArray(s), label).toBe(false)
          expect(engine.check(c, engine.initial(c)).ok, label).toBe(false)
          expect(engine.check(c, engine.solve(c)).ok, label).toBe(true)
        }
      }
    }
  })

  it('picks whole degrees in steps of 5 (even apexes of 10) so a learner works with round numbers', () => {
    for (const sit of SITUATIONS) {
      for (let v = 1; v <= 40; v++) {
        const t = engine.parse({ task: { kind: 'angle-facts', situation: sit, variant: v } })!.task as AngleFactsTask
        for (const k of t.known) expect(k % 5, `${sit} ${v} ${k}`).toBe(0)
        const s = solveTask(t) as { answer: number }
        expect(s.answer % 5, `${sit} ${v}`).toBe(0)
      }
    }
  })

  it('keeps what the tutor gives and fills in only the rest', () => {
    const t = task(facts('straight-line', [125]))
    expect(t.known).toEqual([125])
    expect(t.unknown).toMatch(/^(first|second)$/)
    const u = task(engine.parse({ task: { kind: 'angle-facts', situation: 'quadrilateral', unknown: 'top-left' } })!)
    expect(u.unknown).toBe('top-left')
    expect(u.known).toHaveLength(3)
    expect(sumOf(u.known) + (solveTask(u) as { answer: number }).answer).toBe(360)
    // A different unknown for the same sizes is a different card.
    const a = facts('triangle', [50, 60], 'top')
    const b = facts('triangle', [50, 60], 'bottom-left')
    expect(task(a).unknown).not.toBe(task(b).unknown)
    expect((solveTask(task(a)) as { sizes: number[] }).sizes).toEqual([50, 60, 70])
    expect((solveTask(task(b)) as { sizes: number[] }).sizes).toEqual([70, 50, 60])
  })

  it('varies the place of x, the number of angles and the side of the figure across variants', () => {
    const at = new Set<number>()
    const counts = new Set<number>()
    for (let v = 1; v <= 40; v++) {
      const t = engine.parse({ task: { kind: 'angle-facts', situation: 'straight-line', variant: v } })!.task as AngleFactsTask
      counts.add(t.known.length)
      at.add((solveTask(t) as { at: number }).at)
    }
    expect([...counts].sort()).toEqual([1, 2, 3])
    expect(at.size).toBeGreaterThanOrEqual(3)
  })
})

// ---------------------------------------------------------------------------

describe('what an angle-facts card refuses, with a sentence a writer can act on', () => {
  const f = (c: GeometryConfig) => faultsOf(c).join(' ')

  it('wants the right number of known angles, and says how many', () => {
    expect(f(facts('triangle', [50]))).toMatch(/"known" has 1 angle: the angles of a triangle needs 2 known \(x is the last\)\. Use e\.g\. "known": \[50, 60\]\./)
    expect(f(facts('quadrilateral', [50, 60]))).toMatch(/needs 3 known/)
    expect(f(facts('straight-line', [10, 20, 30, 40]))).toMatch(/needs 1 to 3 known/)
    expect(f(facts('round-point', [90]))).toMatch(/needs 2 to 4 known/)
    expect(f(facts('alternate', [60, 70]))).toMatch(/needs exactly one known angle/)
    expect(f(facts('isosceles', [40, 50]))).toMatch(/needs exactly one known angle/)
    expect(f(facts('vertically-opposite', []))).toMatch(/needs exactly one known angle/)
  })

  it('refuses angles that are not whole, too small, too large, or leave x too small', () => {
    expect(f(facts('triangle', [50.5, 60]))).toMatch(/50\.5° is not a whole number of degrees/)
    expect(f(facts('triangle', [10, 60]))).toMatch(/10° is below 20°, the smallest angle the figure can label/)
    expect(f(facts('triangle', [150, 20]))).toMatch(/150° is more than the angles of a triangle can have here \(at most 140°\)/)
    expect(f(facts('triangle', [90, 80]))).toMatch(/90° \+ 80° leaves x = 10° out of 180°, below the 20° the figure can label/)
    expect(f(facts('straight-line', [120, 50]))).toMatch(/120° \+ 50° leaves x = 10° out of 180°/)
    expect(f(facts('straight-line', [180]))).toMatch(/more than angles on a straight line can have here \(at most 160°\)/)
    expect(f(facts('quadrilateral', [150, 150, 150]))).toMatch(/leaves x = -90° out of 360°/)
    expect(f(facts('round-point', [300, 20]))).toMatch(/300° is more than angles round a point can have here \(at most 270°\)/)
  })

  it('says why an isosceles card cannot be drawn, with an apex that can', () => {
    expect(f(facts('isosceles', [41], 'base'))).toMatch(/An apex angle of 41° leaves 139° for two equal base angles, 69\.5° each, which is not a whole number of degrees\. Use an even apex angle, e\.g\. "known": \[40\]\./)
    expect(f(facts('isosceles', [150], 'base'))).toMatch(/An apex angle of 150° cannot be drawn: it is from 20° to 140°/)
    expect(f(facts('isosceles', [85], 'apex'))).toMatch(/A base angle of 85° cannot be drawn: it is from 20° to 80°/)
    expect(f(facts('isosceles', [10], 'other-base'))).toMatch(/A base angle of 10° cannot be drawn/)
  })

  it('refuses crossing and parallel lines at angles it cannot letter', () => {
    expect(f(facts('vertically-opposite', [10], 'opposite'))).toMatch(/10° cannot be drawn on crossing lines: the angles are from 30° to 150°/)
    expect(f(facts('alternate', [170], 'upper'))).toMatch(/170° cannot be drawn on parallel lines/)
    expect(f(facts('co-interior', [64.5], 'upper'))).toMatch(/64\.5° is not a whole number of degrees/)
  })

  it('names, for a card too tight to letter, the nearest angles that work', () => {
    const thin = f(facts('triangle', [20, 20], 'top'))
    expect(thin).toMatch(/20°, 20°, x = 140° draw a figure too tight to letter every angle clearly \(a thin shape leaves no room beside a corner\)\./)
    expect(thin).toMatch(/use e\.g\. "known": \[\d+, \d+\]\.$/)
    expect(f(facts('round-point', [20, 40, 40], 'last'))).toMatch(/too tight/)
  })

  it('accepts the cards the catalogue shows', () => {
    for (const c of [facts('straight-line', [125]), facts('co-interior', [65], 'lower'), facts('isosceles', [40], 'base'), facts('quadrilateral', [85, 100, 70], 'top-left')]) expect(faultsOf(c), JSON.stringify(c)).toEqual([])
  })
})

// ---------------------------------------------------------------------------

describe('marking the size of x and the facts ticked', () => {
  const STRAIGHT = facts('straight-line', [125], 'second')
  const ISO = facts('isosceles', [40], 'base')

  it('is right only when x is right and exactly the facts that fit are ticked', () => {
    expect(engine.solve(STRAIGHT)).toEqual({ value: '55', reasons: ['straight'] })
    expect(engine.check(STRAIGHT, { value: '55', reasons: ['straight'] })).toEqual({ ok: true, wrongIds: [] })
    expect(engine.check(STRAIGHT, { value: '55', reasons: ['point'] })).toEqual({ ok: false, wrongIds: ['reason'] })
    expect(engine.check(STRAIGHT, { value: '45', reasons: ['straight'] })).toEqual({ ok: false, wrongIds: ['angle'] })
    expect(engine.check(STRAIGHT, { value: '45', reasons: ['point'] })).toEqual({ ok: false, wrongIds: ['angle', 'reason'] })
    expect(engine.check(STRAIGHT, engine.initial(STRAIGHT))).toEqual({ ok: false, wrongIds: ['angle', 'reason'] })
    // An extra fact is not the fact.
    expect(engine.check(STRAIGHT, { value: '55', reasons: ['straight', 'triangle'] })).toEqual({ ok: false, wrongIds: ['reason'] })
  })

  it('wants both facts for an isosceles base angle from the apex, in any order, and the one for the other base angle', () => {
    expect(engine.solve(ISO)).toEqual({ value: '70', reasons: ['triangle', 'base'] })
    expect(engine.check(ISO, { value: '70', reasons: ['triangle', 'base'] }).ok).toBe(true)
    expect(engine.check(ISO, { value: '70', reasons: ['base'] }).ok).toBe(false)
    expect(engine.check(ISO, { value: '70', reasons: ['triangle'] }).ok).toBe(false)
    const other = facts('isosceles', [70], 'other-base')
    expect(engine.check(other, { value: '70', reasons: ['base'] }).ok).toBe(true)
    expect(engine.check(other, { value: '70', reasons: ['base', 'triangle'] }).ok).toBe(false)
    const apex = facts('isosceles', [70], 'apex')
    expect(engine.check(apex, { value: '40', reasons: ['base', 'triangle'] }).ok).toBe(true)
  })

  it('reads the number typed with or without a degree sign, and nothing that is not a whole number', () => {
    expect(typedNumber({ value: '55' })).toBe(55)
    expect(typedNumber({ value: ' 55° ' })).toBe(55)
    expect(typedNumber({ value: '1800' })).toBe(1800)
    for (const bad of ['', 'five', '5.5', '-5', '55 degrees', '12345', null, undefined, 55, {}, []]) expect(typedNumber({ value: bad }), `${bad}`).toBeNull()
    expect(engine.check(STRAIGHT, { value: '055', reasons: ['straight'] }).ok).toBe(true)
    expect(engine.check(STRAIGHT, { value: '55.0', reasons: ['straight'] }).ok).toBe(false)
  })

  it('reads a state it cannot use as nothing', () => {
    for (const bad of [null, undefined, 'junk', 7, {}, { value: 55, reasons: 'straight' }, { value: ['55'], reasons: [1, null, 'spoon'] }]) {
      expect(engine.check(STRAIGHT, bad as never).ok, JSON.stringify(bad)).toBe(false)
    }
    expect(readReasons({ reasons: ['straight', 'spoon', 'straight', 'point', 3] })).toEqual(['straight', 'point'])
    expect(readReasons('junk')).toEqual([])
  })

  it('says x and the fact back when right, and what was wrong when not', () => {
    const t = task(facts('co-interior', [65], 'lower'))
    expect(factsSaid(t, engine.solve(facts('co-interior', [65], 'lower')), 'right')).toEqual([
      'Yes: x = 180° − 65° = 115°.', 'The fact: "Co-interior angles add up to 180°".',
    ])
    expect(factsSaid(t, { value: '65', reasons: ['alternate'] }, 'wrong')).toEqual([
      'You wrote x = 65°, but x = 180° − 65° = 115°.',
      'You ticked "Alternate angles are equal". The fact that fits here is: "Co-interior angles add up to 180°".',
    ])
    expect(factsSaid(t, { value: '115', reasons: ['alternate'] }, 'wrong')[0]).toBe('x = 180° − 65° = 115° is right.')
    expect(factsSaid(t, { value: '65', reasons: ['co-interior'] }, 'wrong')).toEqual([
      'You wrote x = 65°, but x = 180° − 65° = 115°.', 'The fact you ticked fits: "Co-interior angles add up to 180°".',
    ])
    expect(factsSaid(t, { value: '115' }, 'wrong')[1]).toBe('You ticked no fact. The fact that fits here is: "Co-interior angles add up to 180°".')
    expect(factsSaid(t, {}, 'wrong')).toEqual(['Type the size of x and tick the fact you used, then check.'])
    expect(factsSaid(t, { reasons: ['point'] }, 'wrong')[0]).toBe('You have not typed a size for x yet. x = 180° − 65° = 115°.')
    expect(factsSaid(task(ISO), engine.solve(ISO), 'right')[1]).toBe('The facts: "Angles in a triangle add up to 180°" and "Base angles of an isosceles triangle are equal".')
    expect(factsSaid(task(ISO), { value: '40', reasons: ['base'] }, 'wrong')).toEqual([
      'You wrote x = 40°, but x = (180° − 40°) ÷ 2 = 70°.',
      'You ticked "Base angles of an isosceles triangle are equal". The facts that fit here are: "Angles in a triangle add up to 180°" and "Base angles of an isosceles triangle are equal".',
    ])
  })

  it('says the working of every situation in the form a mark scheme would', () => {
    const w = (sit: Situation, known: number[], unknown?: string) => (solveTask(task(facts(sit, known, unknown))) as { working: string }).working
    expect(w('straight-line', [125])).toBe('x = 180° − 125° = 55°')
    expect(w('straight-line', [40, 70], 'first')).toBe('x = 180° − (40° + 70°) = 70°')
    expect(w('round-point', [100, 110, 60])).toBe('x = 360° − (100° + 110° + 60°) = 90°')
    expect(w('triangle', [50, 60])).toBe('x = 180° − (50° + 60°) = 70°')
    expect(w('quadrilateral', [80, 90, 100])).toBe('x = 360° − (80° + 90° + 100°) = 90°')
    expect(w('vertically-opposite', [70], 'opposite')).toBe('x = 70°')
    expect(w('vertically-opposite', [70], 'adjacent')).toBe('x = 180° − 70° = 110°')
    expect(w('isosceles', [70], 'apex')).toBe('x = 180° − 2 × 70° = 40°')
    expect(w('alternate', [70], 'upper')).toBe('x = 70°')
    expect(w('corresponding', [70], 'lower')).toBe('x = 70°')
    expect(w('co-interior', [70], 'lower')).toBe('x = 180° − 70° = 110°')
  })
})

// ---------------------------------------------------------------------------

describe('drag-invariant: the triangle whose corner is dragged', () => {
  it('draws only whole-degree shapes, each with three angles that add to exactly 180 as measured off the coordinates', () => {
    const all = triLattice()
    expect(all.length).toBeGreaterThan(1500)
    for (const c of all) {
      const p = [{ x: TRI.ax, y: TRI.y }, { x: TRI.bx, y: TRI.y }, triApex(c.a, c.b)]
      const ang = (i: number) => norm360(angleOf(p[i], p[(i + 2) % 3]) - angleOf(p[i], p[(i + 1) % 3]))
      if (!near(ang(0), c.a, 1e-6) || !near(ang(1), c.b, 1e-6) || !near(ang(2), 180 - c.a - c.b, 1e-6)) throw new Error(`${c.a},${c.b} does not measure`)
      expect(c.a + c.b + (180 - c.a - c.b)).toBe(180)
      expect(p[2].x).toBeGreaterThanOrEqual(TRI.left)
      expect(p[2].x).toBeLessThanOrEqual(TRI.right)
      expect(p[2].y).toBeGreaterThanOrEqual(TRI.top)
      for (const z of [c.a, c.b, 180 - c.a - c.b]) expect(z >= TRI.lo && z <= TRI.hi).toBe(true)
    }
    expect(triValid(...TRI_START)).toBe(true)
    for (const s of TRI_SHAPES) expect(triValid(s[0], s[1]), `${s}`).toBe(true)
    expect(new Set(TRI_SHAPES.map((s) => s.join())).size).toBe(TRI_SHAPES.length)
  })

  it('labels all three angles clear of the lines and of the handle, in every shape', () => {
    let n = 0
    for (const c of triLattice()) {
      const apex = triApex(c.a, c.b)
      const fig = polyFig([{ x: TRI.ax, y: TRI.y }, { x: TRI.bx, y: TRI.y }, apex], [c.a, c.b, 180 - c.a - c.b].map((size) => ({ size, role: 'given' as const, text: `${size}°` })))
      const keep: Box = { x: apex.x - 17, y: apex.y - 17, w: 34, h: 34 }
      const problems = labelProblems(fig, placeLabels(fig, [keep]), [])
      if (problems.length) throw new Error(`${c.a},${c.b}: ${problems.join('; ')}`)
      n++
    }
    expect(n).toBe(triLattice().length)
  })

  it('follows the pointer to the nearest shape, keeps a key press on a shape it can draw, and moves the way the key points', () => {
    for (const c of triLattice()) expect(triSnap(c.x, c.y)).toEqual([c.a, c.b])
    expect(triSnap(-100, -100)).toEqual(triSnap(TRI.left, TRI.top))
    // A point near the corner snaps to a shape whose corner is nearby.
    const p = triApex(...TRI_START)
    const [a, b] = triSnap(p.x + 1.5, p.y - 1)
    expect(Math.hypot(triApex(a, b).x - p.x, triApex(a, b).y - p.y)).toBeLessThan(5)
    const start: [number, number] = [50, 60]
    const right = triStep(start, 'ArrowRight', false)
    const left = triStep(start, 'ArrowLeft', false)
    expect(triApex(...right).x).toBeGreaterThan(triApex(...start).x)
    expect(triApex(...left).x).toBeLessThan(triApex(...start).x)
    expect(triApex(...triStep(start, 'ArrowUp', false)).y).toBeLessThan(triApex(...start).y)
    expect(triApex(...triStep(start, 'ArrowDown', false)).y).toBeGreaterThan(triApex(...start).y)
    expect(triStep(start, 'ArrowRight', true)).toEqual([45, 65])
    expect(triStep(start, 'a', false)).toEqual(start)
    // At the edge of what can be drawn it stays put.
    let at: [number, number] = start
    for (let i = 0; i < 200; i++) at = triStep(at, 'ArrowUp', false)
    expect(triValid(...at)).toBe(true)
    expect(triStep(at, 'ArrowUp', false)).toEqual(at)
  })

  it('reads a saved shape safely', () => {
    expect(readAB({ ab: [50, 70] })).toEqual([50, 70])
    for (const bad of [null, undefined, 'junk', {}, { ab: [1, 2] }, { ab: [50] }, { ab: [50.5, 70] }, { ab: 'x' }, { ab: [20, 20] }, { ab: [120, 120] }]) expect(readAB(bad)).toEqual(TRI_START)
  })
})

describe('drag-invariant: the line tilted across two parallel lines', () => {
  const PAIRS_ALL: PairName[] = ['alternate', 'corresponding', 'co-interior', 'vertically-opposite']

  it('keeps, at every tilt, the marked pair equal or adding to 180 as the pair says: measured off the drawn lines', () => {
    for (const pair of PAIRS_ALL) {
      for (let th = PAR.min; th <= PAR.max; th++) {
        const fig = dragFigure(th, pair)
        expect(fig.marks).toHaveLength(2)
        const [a, b] = fig.marks
        for (const m of fig.marks) {
          const bad = markProblems(fig, m)
          if (bad.length) throw new Error(`${pair} ${th}: ${m.text} ${bad.join('; ')}`)
        }
        const relation = ruleOf(pair)
        if (relation === 'equal' ? a.size !== b.size : a.size + b.size !== 180) throw new Error(`${pair} ${th}: ${a.size} and ${b.size}`)
        expect(a.text).toBe(`${a.size}°`)
        expect(b.text).toBe(`${b.size}°`)
        expect(a.role).toBe('given')
        // The transversal really makes the tilt: its drawn direction is th.
        const t = fig.segs[2]
        expect(near(norm360(angleOf(t.a, t.b)), th, 1e-6)).toBe(true)
        // And the lines it crosses are the two parallels, level.
        expect(fig.segs[0].a.y).toBe(fig.segs[0].b.y)
        expect(fig.segs[1].a.y).toBe(fig.segs[1].b.y)
        expect(onPlate(fig)).toBe(true)
      }
    }
  })

  it('names the rule and the pair for each marked pair, and no two pairs are told apart by their rule alone', () => {
    expect(PAIRS_ALL.map(ruleOf)).toEqual(['equal', 'equal', 'supplementary', 'equal'])
    expect(RULES.map((r) => r.id)).toEqual(['equal', 'supplementary', 'unrelated'])
    expect(PAIR_LABELS.map((p) => p.id).sort()).toEqual([...PAIRS_ALL].sort())
    for (const l of PAIR_LABELS) expect(l.text).toMatch(/^[A-Z][a-z-]+( opposite)?$/)
  })

  it('labels both marked angles clear of the lines and of the handle, at every tilt', () => {
    for (const pair of PAIRS_ALL) {
      for (let th = DRAG.min; th <= DRAG.max; th++) {
        const fig = dragFigure(th, pair)
        const h = handleOf(th)
        const keep: Box = { x: h.x - 17, y: h.y - 17, w: 34, h: 34 }
        const problems = labelProblems(fig, placeLabels(fig, [keep]), [keep])
        if (problems.length) throw new Error(`${pair} ${th}: ${problems.join('; ')}`)
      }
    }
  })

  it('puts the handle on the line it turns, on the plate and clear of the labels, and finds the tilt from where it is held', () => {
    for (let th = DRAG.min; th <= DRAG.max; th++) {
      const h = handleOf(th)
      expect(h.x).toBeGreaterThan(20)
      expect(h.x).toBeLessThan(PLATE_W - 20)
      expect(h.y).toBeGreaterThan(20)
      expect(thetaFromPoint(h.x, h.y), `${th}`).toBe(th)
      // The lower end of the line is held too: the same tilt.
      expect(thetaFromPoint(2 * PAR.mx - h.x, 2 * PAR.my - h.y), `${th}`).toBe(th)
    }
    expect(thetaFromPoint(PAR.mx + 100, PAR.my - 5)).toBe(DRAG.min)
    expect(thetaFromPoint(PAR.mx - 100, PAR.my - 5)).toBe(DRAG.max)
    expect(thetaFromPoint(PAR.mx, 0)).toBe(90)
    expect(readTheta({ theta: 100 })).toBe(100)
    for (const bad of [null, undefined, 'x', {}, { theta: 10 }, { theta: 40 }, { theta: 170 }, { theta: 60.5 }, { theta: '60' }]) expect(readTheta(bad)).toBe(THETA_START)
  })
})

describe('drag-invariant: marking', () => {
  const TRI_CARD = drag('triangle')
  const ALT = drag('parallel', 'alternate')
  const CO = drag('parallel', 'co-interior')

  it('is right once the figure has been moved enough and the answer is right, and not before', () => {
    expect(engine.check(TRI_CARD, engine.initial(TRI_CARD))).toEqual({ ok: false, wrongIds: ['answer', 'drag'] })
    expect(engine.check(TRI_CARD, engine.solve(TRI_CARD))).toEqual({ ok: true, wrongIds: [] })
    expect(engine.check(TRI_CARD, { value: '180', moves: MIN_MOVES - 1 })).toEqual({ ok: false, wrongIds: ['drag'] })
    expect(engine.check(TRI_CARD, { value: '360', moves: 9 })).toEqual({ ok: false, wrongIds: ['answer'] })
    expect(engine.check(TRI_CARD, { value: '180', moves: 9 }).ok).toBe(true)
    expect(engine.check(ALT, engine.initial(ALT))).toEqual({ ok: false, wrongIds: ['rule', 'name', 'drag'] })
    expect(engine.check(ALT, engine.solve(ALT)).ok).toBe(true)
    expect(engine.check(ALT, { rule: 'equal', name: 'alternate', moves: 3 }).ok).toBe(true)
    expect(engine.check(ALT, { rule: 'supplementary', name: 'alternate', moves: 3 })).toEqual({ ok: false, wrongIds: ['rule'] })
    expect(engine.check(ALT, { rule: 'equal', name: 'corresponding', moves: 3 })).toEqual({ ok: false, wrongIds: ['name'] })
    expect(engine.check(CO, { rule: 'supplementary', name: 'co-interior', moves: 3 }).ok).toBe(true)
    expect(engine.check(CO, { rule: 'equal', name: 'co-interior', moves: 3 }).ok).toBe(false)
  })

  it('is solved by solve() and unsolved by initial() for every card, and reads a state it cannot use as unmoved', () => {
    for (const c of [TRI_CARD, ...(['alternate', 'corresponding', 'co-interior', 'vertically-opposite'] as PairName[]).map((p) => drag('parallel', p))]) {
      expect(engine.check(c, engine.initial(c)).ok).toBe(false)
      expect(engine.check(c, engine.solve(c)).ok).toBe(true)
      expect(faultsOf(c)).toEqual([])
      for (const bad of [null, undefined, 'junk', 7, { moves: 'many', value: 180 }, { moves: -1, value: '180' }]) expect(engine.check(c, bad as never).ok).toBe(false)
    }
  })

  it('says the rule back once marked, and what to do when the figure was not moved', () => {
    const t = ALT.task as DragTask
    expect(dragSaid(t, engine.solve(ALT), 'right')[0]).toBe('These two angles are always equal, and they are alternate angles.')
    const wrong = dragSaid(t, { rule: 'supplementary', name: 'corresponding', moves: 1 }, 'wrong').join(' ')
    expect(wrong).toContain('You chose "They always add up to 180°", but they are always equal.')
    expect(wrong).toContain('You called them corresponding; these are alternate angles.')
    expect(wrong).toContain('Tilt the line to at least 3 different angles first')
    expect(dragSaid(t, {}, 'wrong')).toEqual(['Choose what stays true about the two marked angles, and what they are called.', 'Tilt the line to at least 3 different angles first, watching both numbers, to see which rule stays true.'])
    const tri = TRI_CARD.task as DragTask
    expect(dragSaid(tri, engine.solve(TRI_CARD), 'right')[0]).toBe('The three angles of a triangle always add up to 180°, however you drag it.')
    expect(dragSaid(tri, { value: '90', moves: 4 }, 'wrong')).toEqual(['You wrote 90°. The three angles of a triangle always add up to 180°, however you drag it.'])
    expect(dragSaid(tri, { value: '180', moves: 0 }, 'wrong').join(' ')).toMatch(/180° is right\. Drag the corner to at least 3 different shapes first/)
    expect(dragSaid(tri, {}, 'wrong')[0]).toBe('Type what the three angles add up to.')
  })

  it('refuses a drag card it cannot draw', () => {
    expect(faultsOf(drag('parallel')).join(' ')).toMatch(/Say which pair of angles to mark/)
    expect(dragVerdict({ kind: 'drag-invariant', figure: 'parallel' }, { moves: 9 })).toEqual({ ok: false, wrongIds: [] })
  })
})

// ---------------------------------------------------------------------------

describe('polygon-sum', () => {
  it('has the angle sum (n - 2) x 180, and a regular angle that is a whole number exactly when n divides 360', () => {
    // Independent: the exterior angles of any polygon add up to 360, so the interior angles add up to 180 n - 360.
    for (let n = MIN_SIDES; n <= MAX_SIDES; n++) {
      expect(polygonSum(n)).toBe(180 * n - 360)
      expect(regularWhole(n), `${n}`).toBe(Number.isInteger(180 - 360 / n))
      expect(near(regularAngle(n), 180 - 360 / n)).toBe(true)
      expect(polygonAnswer({ kind: 'polygon-sum', sides: n, ask: 'sum' })).toBe(polygonSum(n))
    }
    expect(Array.from({ length: 10 }, (_, i) => i + 3).filter(regularWhole)).toEqual([3, 4, 5, 6, 8, 9, 10, 12])
    expect(POLYGON_NAMES[6]).toBe('hexagon')
  })

  it('is solved by solve() and unsolved by initial() for every polygon it draws, and refuses the rest with one that works', () => {
    for (let n = 1; n <= 16; n++) {
      for (const ask of ['sum', 'one-angle'] as const) {
        const c = polygon(n, ask)
        const drawn = n >= MIN_SIDES && n <= MAX_SIDES && (ask === 'sum' || regularWhole(n))
        const label = `${n} ${ask}`
        const faults = faultsOf(c)
        expect(faults.length === 0, label).toBe(drawn)
        if (drawn) {
          expect(engine.check(c, engine.initial(c)).ok, label).toBe(false)
          expect(engine.check(c, engine.solve(c)).ok, label).toBe(true)
          const answer = ask === 'sum' ? (n - 2) * 180 : 180 - 360 / n
          // Solved with the polygon split into triangles from corner 1, the way the learner finds the sum.
          expect(engine.solve(c), label).toEqual({ value: String(answer), lines: Array.from({ length: n - 3 }, (_, i) => i + 2) })
          expect(engine.check(c, { value: String(answer + 1) }).ok, label).toBe(false)
          expect(engine.check(c, { value: String(ask === 'sum' ? 180 * n : answer * 2) }).ok, label).toBe(false)
        } else {
          expect(faults, label).toHaveLength(1)
          expect(engine.check(c, engine.solve(c)).ok, label).toBe(false)
        }
      }
    }
    const f = (c: GeometryConfig) => faultsOf(c).join(' ')
    expect(f(polygon(2))).toMatch(/2 sides is not a polygon\. Use 4 to 12, e\.g\. 6\./)
    expect(f(polygon(13))).toMatch(/13 sides is more than the scene draws \(12\)/)
    expect(f(polygon(6.5))).toMatch(/6\.5 sides is not a whole number/)
    expect(f(polygon(3, 'sum'))).toMatch(/A triangle is already one triangle, so there is no corner to split it from/)
    expect(f(polygon(3, 'one-angle'))).toMatch(/A triangle is already one triangle/)
    expect(f(polygon(7, 'one-angle'))).toMatch(/One angle of a regular 7-sided polygon is 128\.57°, not a whole number of degrees\. Ask for the sum with "ask": "sum", or use a polygon whose sides divide 360: 4, 5, 6, 8, 9, 10 or 12 \(e\.g\. 6\)\./)
    expect(f(polygon(11, 'one-angle'))).toMatch(/147\.27°/)
    expect(f(polygon(7, 'sum'))).toBe('')
  })

  it('splits from corner 1 into regions that tile the polygon, counting the triangles the lines make', () => {
    const area = (pts: Pt[]) => Math.abs(pts.reduce((s, p, i) => s + (p.x * pts[(i + 1) % pts.length].y - pts[(i + 1) % pts.length].x * p.y), 0)) / 2
    const d = rng(hash('regions'))
    for (let n = 3; n <= MAX_SIDES; n++) {
      const pts = regularPoints(n)
      expect(pts).toHaveLength(n)
      const sideLen = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      for (let i = 0; i < n; i++) expect(near(Math.hypot(pts[i].x - pts[(i + 1) % n].x, pts[i].y - pts[(i + 1) % n].y), sideLen, 1e-6)).toBe(true)
      // The bottom side is level, and the points are in order anticlockwise on the screen from the bottom left.
      expect(near(pts[0].y, pts[1].y, 1e-6)).toBe(true)
      expect(pts[0].x).toBeLessThan(pts[1].x)
      const diagonals = Array.from({ length: Math.max(0, n - 3) }, (_, i) => i + 2)
      for (let trial = 0; trial < 60; trial++) {
        const lines = diagonals.filter(() => d() < 0.5)
        const rs = regions(n, lines)
        // The regions tile the polygon exactly.
        expect(near(rs.reduce((s, r) => s + area(r.corners.map((i) => pts[i])), 0), area(pts), 1e-6), `${n} ${lines}`).toBe(true)
        // A region is a triangle exactly when it has three corners, and the count is what is drawn.
        for (const r of rs) expect(r.triangle, `${n} ${lines}`).toBe(r.corners.length === 3)
        expect(triangleCount(n, lines), `${n} ${lines}`).toBe(rs.filter((r) => r.corners.length === 3).length)
        // Every corner of the polygon is in some region, and the lines drawn are where regions meet.
        expect(rs).toHaveLength(lines.length + 1)
      }
      expect(triangleCount(n, diagonals), `${n}`).toBe(n - 2)
      expect(triangleCount(n, [])).toBe(n === 3 ? 1 : 0)
    }
    expect(triangleCount(6, [3])).toBe(0)
    expect(triangleCount(6, [2])).toBe(1)
    expect(triangleCount(6, [2, 3])).toBe(2)
    expect(triangleCount(6, [2, 4])).toBe(2)
    expect(readLines({ lines: [4, 2, 2, 9, 1, 0, 'x', 3.5, -1] }, 6)).toEqual([2, 4])
    expect(readLines('junk', 6)).toEqual([])
  })

  it('says the sum back with the triangles the learner drew, once marked', () => {
    const six = polygon(6).task as PolygonTask
    expect(polygonSaid(six, { value: '720', lines: [2, 3, 4] }, 'right')).toEqual([
      'Yes: 720°.', 'A polygon with 6 sides splits into 4 triangles from one corner, and each triangle\'s angles add up to 180°: 4 × 180° = 720°.',
      'You drew 4 triangles, which is all of them.',
    ])
    expect(polygonSaid(six, { value: '540', lines: [2] }, 'wrong')).toEqual([
      'You wrote 540°, but the answer is 720°.', 'A polygon with 6 sides splits into 4 triangles from one corner, and each triangle\'s angles add up to 180°: 4 × 180° = 720°.',
      'You drew 1 triangle; a 6-sided polygon needs 4.',
    ])
    expect(polygonSaid(six, {}, 'wrong')[0]).toBe('You have not typed an answer yet.')
    const eight = polygon(8, 'one-angle').task as PolygonTask
    expect(polygonSaid(eight, { value: '135' }, 'right')).toEqual([
      'Yes: 135°.', 'A polygon with 8 sides splits into 6 triangles from one corner, and each triangle\'s angles add up to 180°: 6 × 180° = 1080°.',
      'The 8 angles of a regular polygon are equal: 1080° ÷ 8 = 135° each.',
    ])
    expect(polygonSaid({ kind: 'polygon-sum', sides: 7, ask: 'one-angle' }, {}, 'wrong')).toEqual([])
  })
})

// ---------------------------------------------------------------------------

describe('the prompt a geometry-construction card is written with', () => {
  const pf = (c: GeometryConfig, prompt: string) => getEngine('geometry-construction')!.promptFaults!(c, prompt)

  it('angle-facts: may ask for x and a reason, and may not give the size of x, the fact or the rule', () => {
    const c = facts('straight-line', [125], 'second')
    for (const p of [
      'Find the size of angle x and give a reason for your answer.',
      'Work out x. The angle marked 125° is shown.',
      'Calculate the value of x, giving a reason.',
      'What is the size of the angle marked x?',
    ]) expect(pf(c, p), p).toEqual([])
    expect(pf(c, 'Angles on a straight line add up to 180°, so find x.').join(' ')).toMatch(/names the fact the learner is to pick \("Angles on a straight line"\)/)
    expect(pf(c, 'Use angles along a line to find x.').join(' ')).toMatch(/names the fact/)
    expect(pf(c, 'The angles add up to 180 degrees. Find x.').join(' ')).toMatch(/states a rule/)
    expect(pf(c, 'x is 55°, find a reason.').join(' ')).toMatch(/gives the size of x \(55°\)/)
    expect(pf(c, 'Show that x = 55.').join(' ')).toMatch(/gives the size of x \(55°\)/)
    // The given angle is not the answer.
    expect(pf(c, 'One angle is 125°. What is x?')).toEqual([])
  })

  it('angle-facts: may not name the fact or the pair for any situation, but may name the shape', () => {
    const cases: [GeometryConfig, string, RegExp][] = [
      [facts('alternate', [70], 'lower'), 'These are alternate angles. Find x.', /names the fact/],
      [facts('alternate', [70], 'lower'), 'Find x. Think about the Z-angles.', /names the fact/],
      [facts('corresponding', [70], 'lower'), 'Corresponding angles help you find x.', /names the fact/],
      [facts('co-interior', [70], 'lower'), 'Use co-interior angles.', /names the fact/],
      [facts('co-interior', [70], 'lower'), 'Allied angles in parallel lines.', /names the fact/],
      [facts('vertically-opposite', [70], 'opposite'), 'Vertically opposite angles: find x.', /names the fact/],
      [facts('triangle', [50, 60], 'top'), 'Use the angles in a triangle to find x.', /names the fact/],
      [facts('quadrilateral', [85, 100, 70], 'top-left'), 'The angle sum of a quadrilateral helps.', /names the fact/],
      [facts('round-point', [90, 110, 60], 'last'), 'Angles around a point: find x.', /names the fact/],
      [facts('isosceles', [40], 'base'), 'Base angles are equal here.', /names the fact/],
      [facts('alternate', [70], 'lower'), 'The angles are equal. Find x.', /states a rule/],
      [facts('triangle', [50, 60], 'top'), 'The three angles total 180°.', /states a rule/],
      [facts('quadrilateral', [85, 100, 70], 'top-left'), 'The four angles make 360 degrees.', /states a rule/],
    ]
    for (const [c, p, re] of cases) expect(pf(c, p).join(' '), p).toMatch(re)
    for (const [c, p] of [
      [facts('isosceles', [40], 'base'), 'This isosceles triangle has two equal sides. Find x and give your reasons.'],
      [facts('alternate', [70], 'lower'), 'The two lines are parallel. Find x and give a reason.'],
      [facts('quadrilateral', [85, 100, 70], 'top-left'), 'Find x in this quadrilateral.'],
      [facts('triangle', [50, 60], 'top'), 'The diagram shows a triangle. Work out x.'],
    ] as [GeometryConfig, string][]) expect(pf(c, p), p).toEqual([])
    // A fact the card does not need is not a give-away.
    expect(pf(facts('triangle', [50, 60], 'top'), 'It is not the angles on a straight line.')).toEqual([])
  })

  it('drag-invariant: may ask what stays true, and may not give the total, the rule or the pair', () => {
    const t = drag('triangle')
    for (const p of ['Drag the top corner to different places. What do the three angles always add up to?', 'Drag the orange corner. What stays the same?']) expect(pf(t, p), p).toEqual([])
    expect(pf(t, 'The angles add up to 180° whatever you do.').join(' ')).toMatch(/gives the total the three angles make \(180\)/)
    const alt = drag('parallel', 'alternate')
    for (const p of ['Tilt the line. What stays true about the two marked angles?', 'Drag the end of the line across the parallel lines. What can you say about the two marked angles?']) expect(pf(alt, p), p).toEqual([])
    expect(pf(alt, 'These are alternate angles. What stays true?').join(' ')).toMatch(/names the pair \("alternate"\)/)
    expect(pf(alt, 'The two angles stay the same. Why?').join(' ')).toMatch(/says what stays true/)
    expect(pf(alt, 'Do they add up to 180?').join(' ')).toMatch(/says what stays true/)
    expect(pf(drag('parallel', 'vertically-opposite'), 'Vertically opposite angles: what stays true?').join(' ')).toMatch(/names the pair/)
  })

  it('polygon-sum: may name the polygon and ask, and may not give the formula, the triangle count or the answer', () => {
    const six = polygon(6)
    for (const p of [
      'Find the sum of the interior angles of this hexagon.', 'Split the polygon into triangles to help you find the sum of its angles.',
      'How many degrees do the interior angles of a regular hexagon add up to?', 'Find the sum of the interior angles. Use the split button if you like.',
    ]) expect(pf(six, p), p).toEqual([])
    expect(pf(six, 'Use (n - 2) × 180 to find the sum.').join(' ')).toMatch(/gives the formula/)
    expect(pf(six, 'The sum is (6 − 2) × 180.').join(' ')).toMatch(/gives the formula/)
    expect(pf(six, 'It splits into 4 triangles. Find the sum.').join(' ')).toMatch(/says the polygon makes 4 triangles/)
    expect(pf(six, 'Find the sum, which is 720°.').join(' ')).toMatch(/gives the answer \(720°\)/)
    expect(pf(six, 'This pentagon has five sides.').join(' ')).toMatch(/says "pentagon", but the card draws 6 sides \(a hexagon\)/)
    expect(pf(six, 'This 8-sided shape...').join(' ')).toMatch(/says 8 sides, but the card draws 6/)
    expect(pf(polygon(8, 'one-angle'), 'Find one interior angle. It is 135°.').join(' ')).toMatch(/gives the answer \(135°\)/)
    expect(pf(polygon(8, 'one-angle'), 'The exterior angles add up to 360°.').join(' ')).toMatch(/gives the exterior-angle rule/)
  })

  it('says nothing about a card it could not read', () => {
    expect(pf(engine.parse({ task: { kind: 'angle-facts', situation: 'bearings' } })!, 'Anything at all, x = 55.')).toEqual([])
    expect(pf(engine.parse({ task: { kind: 'polygon-sum' } })!, 'Anything.')).toEqual([])
  })

  it('passes the examples in its own catalogue entry', () => {
    const e = getEngine('geometry-construction')!
    // Each example's prompt, then its config by matching braces.
    const found = [...e.prompt.matchAll(/"prompt":"([^"]+)"/g)].map((m) => {
      const from = e.prompt.indexOf('"config": ', m.index!) + '"config": '.length
      let depth = 0
      let end = from
      for (; end < e.prompt.length; end++) {
        if (e.prompt[end] === '{') depth++
        if (e.prompt[end] === '}' && --depth === 0) break
      }
      return { prompt: m[1], config: JSON.parse(e.prompt.slice(from, end + 1)) }
    })
    expect(found.length).toBeGreaterThanOrEqual(4)
    expect(new Set(found.map((x) => x.config.task.kind))).toEqual(new Set(['angle-facts', 'drag-invariant', 'polygon-sum']))
    for (const ex of found) {
      const c = e.parse(ex.config)!
      expect(c, ex.prompt).not.toBeNull()
      expect(e.faults(c), ex.prompt).toEqual([])
      expect(e.promptFaults!(c, ex.prompt), ex.prompt).toEqual([])
      expect(validateSpec({ pattern: 'scene', prompt: ex.prompt, payload: { engine: 'geometry-construction', config: ex.config }, success: { kind: 'scene' } }), ex.prompt).toBe(true)
      expect(e.check(c, e.initial(c)).ok, ex.prompt).toBe(false)
      expect(e.check(c, e.solve(c)).ok, ex.prompt).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------

describe('the catalogue entry', () => {
  it('is registered for the tutor, with its config and every task kind in orbit’s format', () => {
    expect(getEngine('geometry-construction')).toBe(engine)
    expect(engine.isolates).toBe('magnitude')
    expect(engine.prompt).toMatch(/^SCENE "geometry-construction"/)
    expect(engine.prompt).toMatch(/"pattern":"scene"/)
    expect(engine.prompt).toMatch(/"engine":"geometry-construction"/)
    expect(engine.prompt).toMatch(/"success": \{ "kind":"scene" \}/)
    expect(engine.prompt).toMatch(/"apparatus":"scene:geometry-construction"/)
    expect(engine.prompt).toMatch(/"isolates":"magnitude"/)
    for (const kind of ['angle-facts', 'drag-invariant', 'polygon-sum']) expect(engine.prompt).toContain(`"kind":"${kind}"`)
    for (const s of SITUATIONS) expect(engine.prompt).toContain(`"${s}"`)
  })

  it('says plainly what the card shows and what it keeps until it is marked', () => {
    expect(engine.prompt).toMatch(/the angle to find labelled x/)
    expect(engine.prompt).toMatch(/same list, in the same order, on every card/)
    expect(engine.prompt).toMatch(/The sum and the rule are\s+never shown/)
    expect(engine.prompt).toMatch(/the triangles are counted when it is marked/)
    expect(engine.prompt).toMatch(/the\s+size\s+of x and the facts that fit are shown only once the card is marked/)
    expect(engine.prompt).toMatch(/the sum, the angle and the triangle count are shown only then/)
    expect(engine.prompt).toMatch(/Not for:\s+constructions with ruler and compass, loci, bearings, circle theorems/)
    expect(engine.prompt).toMatch(/It never gives the size of x, the reason or fact/)
  })

  it('states, in its first 600 characters, what each of the three cards shows and what it holds back', () => {
    const before = engine.prompt.split('config:')[0]
    const opening = before.slice(0, 600)
    const lines = opening.split('\n').filter((l) => /^\s*"(angle-facts|drag-invariant|polygon-sum)":/.test(l))
    expect(lines.map((l) => /"(angle-facts|drag-invariant|polygon-sum)"/.exec(l)![1])).toEqual(['angle-facts', 'drag-invariant', 'polygon-sum'])
    for (const l of lines) expect(l, l).toMatch(/held back until marked\.$/)
    expect(lines[0]).toMatch(/known angles are shown in degrees and the angle to find as x/)
    expect(lines[1]).toMatch(/dragged, with the angles shown live/)
    expect(lines[2]).toMatch(/split into triangles by tapping/)
    // The detail that follows still names every option, and "config:" first appears where the config does.
    expect(engine.prompt.slice(before.length)).toMatch(/^config: \{ "task": \{ "kind":"angle-facts"/)
    expect(before.length).toBeGreaterThan(900)
  })

  it('is an activity whose intent is magnitude', () => {
    const spec = { pattern: 'scene', prompt: 'Find x.', payload: { engine: 'geometry-construction', config: facts('triangle', [50, 60], 'top') }, success: { kind: 'scene' } }
    expect(validateSpec(spec)).toBe(true)
    expect(dimensionsOf(spec as never)).toEqual(['magnitude'])
    expect(checkIntent({ goal: 'g', isolates: 'magnitude', apparatus: 'scene:geometry-construction', why: 'w' }, spec as never).ok).toBe(true)
    expect(validateSpec({ ...spec, payload: { engine: 'geometry-construction', config: 'triangle' } })).toBe(false)
  })

  it('is offered to the stations it is for, and not to those that merely share a word', () => {
    for (const station of [
      'Angles in a triangle', 'Angles on a straight line', 'Angles round a point', 'Vertically opposite angles', 'Angles in a quadrilateral',
      'Angle facts', 'Angles in parallel lines', 'Alternate and corresponding angles', 'Co-interior angles', 'Base angles of isosceles triangles',
      'Interior angles of polygons', 'Angles in polygons', 'Angle sum of a polygon', 'Angles in triangles: finding the missing angle',
    ]) expect(scenesFor(station).map((x) => x.id), station).toContain('geometry-construction')
    // Not the physics or other maths that share a word or two.
    for (const station of [
      'Angle of incidence', 'Bearings', 'Triangle of forces', 'Angles of elevation and depression', 'Pythagoras theorem', 'Trigonometry: sine, cosine and tangent',
      'Alternate segment theorem', 'Similar triangles: corresponding sides', 'Area of a triangle', 'Straight line graphs', 'Gradient of parallel lines', 'Rounding numbers',
      'Points on a graph', 'Congruent triangles', 'Angle in a semicircle', 'Reflection of light: the law of reflection', 'Mean, median and mode', 'Equivalent fractions',
      'Perimeter of a polygon', 'Regular polygons: symmetry', 'Interior of the Earth',
    ]) expect(scenesFor(station).map((x) => x.id), station).not.toContain('geometry-construction')
    for (const bare of ['angle', 'angles', 'triangle', 'triangles', 'polygon', 'polygons', 'parallel', 'alternate', 'corresponding', 'interior', 'point', 'line', 'sum']) expect(engine.covers).not.toContain(bare)
  })

  it('has no covers phrase that a station about something else would all contain: each is more than one idea', () => {
    for (const topic of engine.covers) expect(topic.split(/\s+/).filter((w) => w.length >= 3).length, topic).toBeGreaterThanOrEqual(2)
    // Every phrase is found for its own station, and for no station on a neighbouring subject.
    const neighbours = ['Angle of incidence', 'Bearings', 'Triangle of forces', 'Angles of elevation and depression', 'Pythagoras theorem', 'Alternate segment theorem']
    for (const topic of engine.covers) {
      expect(scenesFor(topic).map((x) => x.id), topic).toContain('geometry-construction')
      for (const n of neighbours) expect(scenesFor(`${n}`).map((x) => x.id), `${topic} / ${n}`).not.toContain('geometry-construction')
    }
    expect(sceneCatalogue('Angles in a triangle')).toContain('SCENE "geometry-construction"')
    expect(sceneCatalogue('Equivalent fractions')).not.toContain('SCENE "geometry-construction"')
    expect(sceneCatalogue('Staying safe in the lab')).not.toContain('SCENE "geometry-construction"')
  })

  it('is refused by the meaning gates for a config it cannot teach, and for a prompt that gives the answer', () => {
    const action = (config: unknown, prompt = 'Find x and give a reason.') =>
      ({ type: 'createActivity', id: 's1', spec: { pattern: 'scene', prompt, payload: { engine: 'geometry-construction', config }, success: { kind: 'scene' } } })
    expect(meaningFaults(action(facts('straight-line', [125])))).toEqual([])
    expect(meaningFaults(action(facts('triangle', [90, 80]))).join(' ')).toMatch(/leaves x = 10° out of 180°/)
    expect(meaningFaults(action(facts('isosceles', [41], 'base'))).join(' ')).toMatch(/not a whole number of degrees/)
    expect(meaningFaults(action(polygon(7, 'one-angle'))).join(' ')).toMatch(/128\.57°/)
    expect(meaningFaults(action(facts('alternate', [70], 'lower'), 'These are alternate angles. Find x.')).join(' ')).toMatch(/names the fact/)
    expect(meaningFaults(action(polygon(6), 'Use (n - 2) × 180.')).join(' ')).toMatch(/gives the formula/)
    expect(meaningFaults(action({ task: { kind: 'angle-facts', situation: 'bearings' } })).join(' ')).toMatch(/is not one this scene draws/)
  })
})

// ---------------------------------------------------------------------------

describe('the geometry-construction scene on the board', { timeout: 120_000 }, () => {
  const card = (config: unknown, prompt: string) =>
    renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'geometry-construction', config }, success: { kind: 'scene' } } },
    } as never)))
  const view = (c: GeometryConfig, state: unknown, marked: SceneMarked, reduced = false) =>
    renderToStaticMarkup(createElement(GeometryConstructionView, { config: c, state: state as never, setState: () => {}, marked, reduced, locked: marked === 'right' || marked === 'shown' }))
  /** What a person or a screen reader is given: visible text, and the labels read aloud. */
  const said = (html: string) => ({
    texts: [...html.matchAll(/>([^<>]+)</g)].map((m) => m[1]).join(' | '),
    aloud: [...html.matchAll(/aria-(?:label|valuetext)="([^"]*)"/g)].map((m) => m[1]).join(' | '),
  })

  const CARDS: [string, GeometryConfig][] = [
    ['straight-line', facts('straight-line', [125], 'second')], ['round-point', facts('round-point', [100, 110, 60], 'last')],
    ['vertical', facts('vertically-opposite', [65], 'opposite')], ['triangle', facts('triangle', [48, 72], 'top')],
    ['quadrilateral', facts('quadrilateral', [85, 100, 70], 'top-left')], ['isosceles', facts('isosceles', [40], 'base')],
    ['alternate', facts('alternate', [70], 'lower')], ['corresponding', facts('corresponding', [110], 'upper')], ['co-interior', facts('co-interior', [65], 'lower')],
  ]

  it('angle-facts: draws the figure, a box for x and the same nine facts to tick, with the answer nowhere', () => {
    for (const [name, c] of CARDS) {
      const t = c.task as AngleFactsTask
      const html = card(c, 'Find the size of angle x and give a reason for your answer.')
      expect(html, name).toContain('role="img"')
      expect((html.match(/role="checkbox"/g) ?? []).length, name).toBe(9)
      expect((html.match(/aria-checked="true"/g) ?? []).length, name).toBe(0)
      expect(html, name).toContain('x =')
      expect(html, name).toMatch(/<input[^>]*inputMode="numeric"/)
      expect(html, name).toContain('Which fact did you use? Tick every fact you need.')
      expect(html, name).toContain('Drawn to scale.')
      expect(html, name).toContain('>x</text>')
      const s = solveTask(t) as { answer: number; working: string; reasons: ReasonId[] }
      const { texts, aloud } = said(html.replace('Find the size of angle x and give a reason for your answer.', ''))
      // The answer's working, and the words that say it is right, are held back, in sight and aloud.
      expect(`${texts} ${aloud}`, name).not.toMatch(/Yes: |You wrote|is right|that fits here|The fact(s)?: |x = \d|you ticked/i)
      expect(`${texts} ${aloud}`, name).not.toContain(s.working)
      // x is not written as its value anywhere: not on the figure, not in the label read aloud.
      if (!t.known.includes(s.answer)) expect(`${texts} ${aloud}`, `${name} shows ${s.answer}`).not.toMatch(new RegExp(`(?<![\\d.])${s.answer}(?![\\d.])`))
      // The figure says what is seen and names no fact.
      const label = /<svg[^>]*aria-label="([^"]*)"/.exec(html)![1]
      expect(label, name).not.toMatch(/alternate|corresponding|co-interior|vertically opposite|add up|are equal|base angles of/i)
      expect(label, name).toBe(figureText(t, solveTask(t) as never))
      expect(label, name).toContain(' x')
    }
  })

  it('angle-facts: lists the facts in one fixed order on every card, one stop on Tab each, in no order that says the answer', () => {
    const order = (c: GeometryConfig) => [...card(c, 'Find x.').matchAll(/role="checkbox"[^>]*>([^<]*)</g)].map((m) => m[1])
    const first = order(CARDS[0][1])
    expect(first).toEqual(REASON_ORDER.map((r) => REASON_TEXT[r]))
    expect(first).toEqual([...first].sort((a, b) => a.localeCompare(b, 'en')))
    for (const [name, c] of CARDS) expect(order(c), name).toEqual(first)
    for (const [name, c] of CARDS) {
      const html = card(c, 'Find x.')
      expect(html.match(/<button[^>]*role="checkbox"[^>]*tabindex="-1"/g) ?? [], name).toHaveLength(0)
    }
    expect(new Set(first).size).toBe(9)
  })

  it('angle-facts: a ticked fact looks ticked: its colour is set inline, so no class can lose to the base', () => {
    const c = CARDS[0][1]
    const html = view(c, { value: '', reasons: ['straight', 'point'] }, 'idle')
    const buttons = [...html.matchAll(/<button[^>]*role="checkbox"[^>]*>/g)].map((m) => m[0])
    expect(buttons).toHaveLength(9)
    const ticked = buttons.filter((b) => /aria-checked="true"/.test(b))
    expect(ticked).toHaveLength(2)
    for (const b of ticked) {
      expect(b).toMatch(/style="[^"]*border-color:var\(--subject\)/)
      expect(b).toMatch(/style="[^"]*background:color-mix\(in srgb, var\(--subject\) 14%, transparent\)/)
      // As classes, border-ss-line on the base won over a chosen class: none is added.
      expect(b.match(/class="([^"]*)"/)![1]).not.toMatch(/(^|\s)(border-\[color:var\(--subject\)\]|bg-ss-chip)(\s|$)/)
    }
    for (const b of buttons.filter((x) => /aria-checked="false"/.test(x))) expect(b).not.toMatch(/style=/)
    // A button's words sit by one class, not two that disagree (CSS order, not class order, would decide which won).
    for (const b of buttons) {
      const cls = b.match(/class="([^"]*)"/)![1].split(/\s+/)
      expect(cls.filter((c) => /^justify-/.test(c)), b).toHaveLength(1)
      expect(cls.filter((c) => /^text-(left|center|right)$/.test(c)), b).toHaveLength(1)
    }
    // The radio picks of a parallel-lines drag card too.
    const pick = view(drag('parallel', 'alternate'), { rule: 'equal', name: 'alternate' }, 'idle')
    const radios = [...pick.matchAll(/<button[^>]*role="radio"[^>]*>/g)].map((m) => m[0]).filter((b) => /aria-checked="true"/.test(b))
    expect(radios).toHaveLength(2)
    for (const b of radios) expect(b).toMatch(/style="[^"]*border-color:var\(--subject\)/)
  })

  it('angle-facts: says, once marked, x, its working and the facts; colours each tick as it fits, and keeps the picks standing', () => {
    const c = facts('alternate', [70], 'lower')
    const wrong = view(c, { value: '110', reasons: ['co-interior'] }, 'wrong')
    expect(wrong).toContain('You wrote x = 110°, but x = 70°.')
    expect(wrong).toContain('You ticked &quot;Co-interior angles add up to 180°&quot;. The fact that fits here is: &quot;Alternate angles are equal&quot;.')
    expect(wrong).toMatch(/aria-checked="true"/)
    expect(wrong).toContain('(does not fit)')
    expect(wrong).toContain('(was needed)')
    const right = view(c, engine.solve(c), 'right')
    expect(right).toContain('Yes: x = 70°.')
    expect(right).toContain('(fits)')
    expect(right).toMatch(/aria-disabled="true"/)
    expect(right).toMatch(/<input[^>]*readonly=""/)
  })

  it('angle-facts: names no answer before marking on any card, in any state the learner can be in', () => {
    for (const [name, c] of CARDS) {
      for (const state of [engine.initial(c), { value: '55', reasons: ['straight'] }, { value: '', reasons: REASON_ORDER }]) {
        const html = view(c, state, 'idle')
        expect(html, name).not.toMatch(/Yes: |You wrote|That is right| is right\.|that fits here|The fact(s)?: |\(fits\)|\(does not fit\)|\(was needed\)/)
      }
    }
  })

  it('drag-invariant: shows the live angles and never their sum or the rule, with a corner or a line to hold', () => {
    const tri = card(drag('triangle'), 'Drag the top corner to different places. What do the three angles always add up to?')
    expect(tri).toContain('role="slider"')
    // A picture with a control in it is a group, not an image: an image would hide the control from a screen reader.
    expect(tri).toMatch(/<svg[^>]*role="group"/)
    expect(tri).not.toMatch(/<svg[^>]*role="img"/)
    expect(tri).toContain('touch-none')
    expect(tri).toContain('>50°</text>')
    expect(tri).toContain('>70°</text>')
    expect(tri).toContain('>60°</text>')
    expect(tri).toContain('Try another shape')
    expect(tri).toContain('The three angles always add up to')
    const triSaid = said(tri.replace('What do the three angles always add up to?', ''))
    expect(`${triSaid.texts} ${triSaid.aloud}`).not.toMatch(/180|always add up to 180|The three angles of a triangle always/)
    expect(triSaid.aloud).toContain('The angles are 50, 70 and 60 degrees')
    const par = card(drag('parallel', 'co-interior'), 'Tilt the line. What stays true about the two marked angles?')
    expect(par).toContain('role="slider"')
    expect((par.match(/role="radio"/g) ?? []).length).toBe(RULES.length + PAIR_LABELS.length)
    expect((par.match(/role="radiogroup"/g) ?? []).length).toBe(2)
    expect((par.match(/aria-checked="true"/g) ?? []).length).toBe(0)
    const parSaid = said(par.replace('Tilt the line. What stays true about the two marked angles?', ''))
    expect(`${parSaid.texts} ${parSaid.aloud}`).not.toMatch(/These two angles|however you tilt|that fits/)
    // The pair's values are shown (65 and its supplement at the start tilt), but the sum and the name are not.
    expect(par).toContain(`>${posSize('BR', THETA_START)}°</text>`)
    // The rules and the names are in one fixed order, the same for every pair.
    const order = (pair: PairName) => [...card(drag('parallel', pair), 'Tilt.').matchAll(/role="radio"[^>]*>([^<]*)</g)].map((m) => m[1])
    const first = order('alternate')
    for (const pair of ['corresponding', 'co-interior', 'vertically-opposite'] as PairName[]) expect(order(pair), pair).toEqual(first)
    expect(first).toEqual([...RULES.map((r) => r.text), ...PAIR_LABELS.map((p) => p.text)])
  })

  it('drag-invariant: draws the shape the learner has made, and counts the shapes without telling the answer', () => {
    const c = drag('triangle')
    const moved = view(c, { ab: [35, 100], moves: 2 }, 'idle')
    expect(moved).toContain('>35°</text>')
    expect(moved).toContain('>100°</text>')
    expect(moved).toContain('>45°</text>')
    expect(moved).toContain('Shapes made: 2.')
    // A shape that cannot be drawn is the start, not a crash.
    expect(view(c, { ab: [5, 5] }, 'idle')).toContain('>60°</text>')
    const par = view(drag('parallel', 'alternate'), { theta: 130, moves: 3 }, 'idle')
    expect(par).toContain('>50°</text>')
    expect(par).toContain('Tilts made: 3.')
    expect(par).toMatch(/aria-valuenow="-40"/)
    expect(par).toMatch(/aria-valuetext="Leaning left, 40 degrees from upright"/)
  })

  it('drag-invariant: says the fact once marked, locks the figure once solved, and keeps the picks standing', () => {
    const c = drag('parallel', 'co-interior')
    const wrong = view(c, { rule: 'equal', name: 'alternate', moves: 3 }, 'wrong')
    expect(wrong).toContain('You chose &quot;They are always equal&quot;, but they always add up to 180°.')
    expect(wrong).toMatch(/aria-checked="true"/)
    const right = view(c, engine.solve(c), 'right')
    expect(right).toContain('These two angles always add up to 180°, and they are co-interior angles.')
    expect(right).toMatch(/aria-readonly="true"/)
    expect(right).toMatch(/tabindex="-1"/)
    expect(right).not.toContain('Tilts made')
    expect(right).not.toContain('touch-none')
    const tri = view(drag('triangle'), engine.solve(drag('triangle')), 'right')
    expect(tri).toContain('The three angles of a triangle always add up to 180°, however you drag it.')
    expect(tri).not.toContain('Try another shape')
  })

  it('polygon-sum: draws the polygon with a corner for each line it can take, and counts no triangle before marking', () => {
    for (let n = MIN_SIDES; n <= MAX_SIDES; n++) {
      const c = polygon(n, 360 % n === 0 ? 'one-angle' : 'sum')
      const html = card(c, 'Find the interior angle sum of this polygon.')
      expect((html.match(/role="checkbox"/g) ?? []).length, `${n}`).toBe(Math.max(0, n - 3))
      expect(html, `${n}`).toContain('Split into triangles')
      expect(html, `${n}`).toContain(`A regular polygon with ${n} equal sides.`)
      expect(html, `${n}`).not.toMatch(/triangles? (drawn|made)|You drew|(\d+) triangles/)
    }
    const hex = card(polygon(6), 'Find the sum.')
    expect(hex).toContain('Sum of the interior angles =')
    expect(hex).toContain('aria-label="Corner 3: draw a line to it from corner 1"')
    expect(card(polygon(8, 'one-angle'), 'Find one angle.')).toContain('One interior angle =')
    const split = view(polygon(6), { lines: [2, 3, 4] }, 'idle')
    expect(split).toContain('aria-checked="true"')
    expect((split.match(/<polygon points/g) ?? []).length).toBeGreaterThanOrEqual(1 + 4)
    expect(split).not.toMatch(/You drew|4 triangles/)
    expect(split).toContain('Clear the lines')
  })

  it('polygon-sum: says the triangles it counted, and the answer, once marked', () => {
    const c = polygon(6)
    const wrong = view(c, { value: '540', lines: [2] }, 'wrong')
    expect(wrong).toContain('You wrote 540°, but the answer is 720°.')
    expect(wrong).toContain('You drew 1 triangle; a 6-sided polygon needs 4.')
    const right = view(c, { value: '720', lines: [2, 3, 4] }, 'right')
    expect(right).toContain('Yes: 720°.')
    expect(right).toContain('You drew 4 triangles, which is all of them.')
    expect(right).not.toContain('Split into triangles')
    expect(right).not.toContain('role="checkbox"')
    expect(right).toMatch(/<input[^>]*readonly=""/)
  })

  it('takes a four-digit answer for a polygon with many sides', () => {
    expect(view(polygon(12), { value: '1800' }, 'idle')).toMatch(/value="1800"/)
    expect(view(polygon(12), { value: '18000' }, 'idle')).toMatch(/value="1800"/)
  })

  const svgOf = (html: string) => /<svg[\s\S]*?<\/svg>/.exec(html)![0]

  it('angle-facts: draws the size the learner types on the figure in place of the letter, in x\u2019s own styling and with no verdict before marking', () => {
    for (const [name, c] of CARDS) {
      expect(view(c, engine.initial(c), 'idle'), name).toContain('>x</text>')
      const typed = view(c, { value: '55', reasons: [] }, 'idle')
      // The label reads "x = 55°" (or "55°" where the longer form would not fit), in the colour x's label always has.
      expect(typed, name).toMatch(/<text [^>]*fill="#9A3412">(x = )?55°<\/text>/)
      expect(typed, name).not.toContain('>x</text>')
      expect(typed, name).toContain('stroke="#C2410C"')
      expect(typed, name).not.toMatch(/stroke="#047857"|stroke="#B0303C"/)
      // Typing a different size changes the label, and rubbing it out puts the letter back.
      expect(view(c, { value: '125' }, 'idle'), name).toMatch(/fill="#9A3412">(x = )?125°<\/text>/)
      expect(view(c, { value: '' }, 'idle'), name).toContain('>x</text>')
      // Only once marked does x's arc take the colour of the verdict.
      expect(view(c, { value: '56', reasons: [] }, 'wrong'), name).toContain('stroke="#B0303C"')
    }
  })

  it('angle-facts: the solved figure differs from the figure at the start, on every card', () => {
    for (const [name, c] of CARDS) {
      const start = svgOf(view(c, engine.initial(c), 'idle'))
      const solved = svgOf(view(c, engine.solve(c), 'idle'))
      expect(solved, name).not.toBe(start)
      const answer = (solveTask(c.task as AngleFactsTask) as { answer: number }).answer
      expect(solved, name).toMatch(new RegExp(`fill="#9A3412">(x = )?${answer}\u00b0</text>`))
    }
  })

  it('drag-invariant: solve() leaves the figure at the last shape tried, so the solved drawing differs from the start', () => {
    const all: GeometryConfig[] = [drag('triangle'), ...(['alternate', 'corresponding', 'co-interior', 'vertically-opposite'] as PairName[]).map((p) => drag('parallel', p))]
    for (const c of all) {
      const t = c.task as DragTask
      const name = `${t.figure} ${t.pair ?? ''}`
      const start = engine.initial(c) as GeometryState
      const solved = engine.solve(c) as GeometryState
      if (t.figure === 'triangle') {
        expect(readAB(solved), name).not.toEqual(readAB(start))
        expect(readAB(solved), name).toEqual(TRI_SHAPES[TRI_SHAPES.length - 1])
        expect(triValid(...readAB(solved)), name).toBe(true)
      } else {
        expect(readTheta(solved), name).not.toBe(readTheta(start))
        expect(readTheta(solved), name).toBe(THETA_LAST)
      }
      const a = view(c, start, 'idle')
      const b = view(c, solved, 'idle')
      expect(svgOf(b), name).not.toBe(svgOf(a))
      // The angle labels are not the same either: it is a different shape, not the same one moved.
      const labels = (html: string) => [...svgOf(html).matchAll(/<text [^>]*>([^<]*)<\/text>/g)].map((m) => m[1])
      expect(labels(b), name).not.toEqual(labels(a))
      expect(engine.check(c, solved).ok, name).toBe(true)
    }
    expect(THETA_LAST).toBeGreaterThanOrEqual(DRAG.min)
    expect(THETA_LAST).toBeLessThanOrEqual(DRAG.max)
    expect(THETA_LAST).not.toBe(THETA_START)
  })

  it('polygon-sum: solve() leaves the polygon split into triangles, so the solved drawing differs from the start', () => {
    for (let n = MIN_SIDES; n <= MAX_SIDES; n++) {
      for (const ask of ['sum', 'one-angle'] as const) {
        if (ask === 'one-angle' && 360 % n !== 0) continue
        const c = polygon(n, ask)
        const start = engine.initial(c)
        const solved = engine.solve(c) as GeometryState
        expect(readLines(solved, n), `${n} ${ask}`).toHaveLength(n - 3)
        expect(triangleCount(n, readLines(solved, n)), `${n} ${ask}`).toBe(n - 2)
        expect(svgOf(view(c, solved, 'idle')), `${n} ${ask}`).not.toBe(svgOf(view(c, start, 'idle')))
      }
    }
  })

  it('has no text smaller than 12 px, no text split mid-word, no emoji and nothing that moves, on any card', () => {
    const every: GeometryConfig[] = [...CARDS.map(([, c]) => c), drag('triangle'), drag('parallel', 'alternate'), polygon(6), polygon(12), polygon(4, 'one-angle')]
    for (const c of every) {
      for (const [state, marked] of [[engine.initial(c), 'idle'], [engine.solve(c), 'right'], [{}, 'wrong']] as [unknown, SceneMarked][]) {
        for (const reduced of [false, true]) {
          const html = view(c, state, marked, reduced)
          for (const m of html.matchAll(/font-size[:=]"?(\d+(?:\.\d+)?)/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(12)
          for (const m of html.matchAll(/text-\[(\d+)px\]/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(12)
          expect(html).not.toMatch(/break-all|break-words|capitalize|truncate/)
          expect(html).not.toMatch(/animate|transition|keyframes|<animate/)
          expect(html).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{FE0F}]/u)
        }
      }
    }
  })

  it('stands the controls so a finger, a mouse or a key can use them: every option is 44 px tall and every arrow stays on the card', () => {
    for (const c of [CARDS[0][1], drag('parallel', 'alternate'), polygon(6)]) {
      const html = view(c, engine.initial(c), 'idle')
      for (const m of html.matchAll(/<button[^>]*class="([^"]*)"/g)) expect(m[1]).toContain('min-h-[44px]')
      expect(html).toContain('nodrag')
    }
  })

  it('still draws a state it cannot read, as the start', () => {
    for (const [, c] of CARDS) {
      for (const bad of [null, undefined, 'junk', 7, { value: 5, reasons: 'x' }, { value: ['x'], reasons: [null, 'spoon'], ab: 'x', theta: 'y', moves: -3 }]) {
        expect(() => view(c, bad, 'idle'), JSON.stringify(bad)).not.toThrow()
        expect(() => view(c, bad, 'wrong'), JSON.stringify(bad)).not.toThrow()
      }
    }
    for (const c of [drag('triangle'), drag('parallel', 'alternate'), polygon(6)]) {
      for (const bad of [null, undefined, 'junk', 7, { ab: [1, 1], theta: 500, lines: 'x', moves: 'a', rule: 3 }]) {
        expect(() => view(c, bad, 'idle'), JSON.stringify(bad)).not.toThrow()
        expect(() => view(c, bad, 'wrong'), JSON.stringify(bad)).not.toThrow()
      }
    }
  })

  it('draws a config it cannot show as a plain message, not a crash', () => {
    for (const raw of [
      { task: { kind: 'angle-facts', situation: 'bearings' } }, { task: { kind: 'drag-invariant' } }, { task: { kind: 'polygon-sum', sides: 40 } },
      { task: { kind: 'polygon-sum', sides: 2 } }, { task: { kind: 'polygon-sum', sides: 3 } }, { task: { kind: 'drag-invariant', figure: 'parallel-lines' } },
    ]) {
      const c = engine.parse(raw)!
      expect(view(c, {}, 'idle'), JSON.stringify(raw)).toContain('could not be drawn')
    }
    // A card refused by faults() is still drawn if it can be, never thrown on.
    expect(() => view(facts('triangle', [90, 80], 'top'), {}, 'idle')).not.toThrow()
    expect(view(facts('triangle', [90, 80], 'top'), {}, 'idle')).toContain('could not be drawn')
  })

  it('draws the figure with one arc for each angle marked and the unknown arc in its own colour', () => {
    for (const [name, c] of CARDS) {
      const t = c.task as AngleFactsTask
      const s = solveTask(t) as never
      const html = view(c, engine.initial(c), 'idle')
      const arcs = [...html.matchAll(/<path d="M [^"]*A 22 22 [^"]*" stroke="(#[0-9A-F]{6})"/g)].map((m) => m[1])
      expect(arcs.length, name).toBe(figureOf(t, s).marks.length)
      expect(arcs.filter((a) => a === '#C2410C'), name).toHaveLength(1)
      expect(arcPath(figureOf(t, s).marks[0])).toMatch(/^M [\d. -]+ A 22 22 0 [01] 0 [\d. -]+$/)
    }
    // Once marked, x's arc is green when right and red when not.
    const c = CARDS[0][1]
    expect(view(c, engine.solve(c), 'right')).toContain('stroke="#047857"')
    expect(view(c, { value: '1', reasons: [] }, 'wrong')).toContain('stroke="#B0303C"')
  })
})

// A closing guard on the shared helpers the tests lean on.
describe('the measuring helpers the tests use', () => {
  it('see a line that passes through a corner both ways, and measure a wedge by its two rays', () => {
    const fig = parallelFig(60, [{ line: 'U', pos: 'TR', role: 'given', text: '60°' }])
    const m = fig.marks[0]
    expect(markProblems(fig, m)).toEqual([])
    // A wrong size is caught.
    expect(markProblems(fig, { ...m, size: 50 }).length).toBeGreaterThan(0)
    expect(markProblems(fig, { ...m, size: 130 }).length).toBeGreaterThan(0)
    expect(insideConvex([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }], { x: 5, y: 5 })).toBe(true)
    expect(insideConvex([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }], { x: 15, y: 5 })).toBe(false)
  })
})
