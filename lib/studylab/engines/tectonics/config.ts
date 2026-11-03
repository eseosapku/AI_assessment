// lib/studylab/engines/tectonics/config.ts
//
// A cross-section of two plates, drawn in real rock colours on a quiet light panel. The learner moves the plates --
// pulls them apart, slides them past each other, or pushes them together -- and lets time run, and the section answers:
// an ocean floor bends down into the mantle, a continent crumples into mountains, magma fills a gap, a valley drops.
//   landform -- make a named landform (a trench, fold mountains, a rift valley ...);
//   hazard   -- make the plates that cause a named mix of volcanoes and earthquakes (deep ones, shallow ones, none).
// Both are the same machine: which way the plates move, and which two kinds of crust meet, decide everything drawn.
//
// The rules, all computed here and never read from the drawing:
//   what happens depends on the two crusts (ocean or continent) and the way they move (apart, past, together);
//   a task passes when the learner has chosen a movement that makes the target, and let it run for two steps or more.
//
// Facts (general school geography, the usual Cambridge / Edexcel / IB / Rwandan secondary syllabus boundaries):
//   - together: ocean under continent or ocean under ocean -- the denser oceanic plate sinks (subduction): a trench,
//     volcanoes on the plate above (a volcanic mountain chain, or an island arc), and earthquakes that start shallow and
//     reach deep along the sinking plate (the Wadati-Benioff zone). Continent meets continent -- neither sinks: the crust
//     is squeezed into fold mountains with a thick root, shallow to intermediate earthquakes, and no volcanoes;
//   - apart: ocean floor -- magma rises and sets as new crust along a mid-ocean ridge, with shallow earthquakes; continent
//     -- the crust stretches and a block drops between faults as a rift valley, with volcanoes and shallow earthquakes
//     (the East African Rift, which runs through Rwanda's western border);
//   - past (a transform or conservative boundary): no crust is made or destroyed, so no new landform and no volcano, but
//     the plates stick and jerk free: shallow earthquakes.
//   Mixed crusts pulled apart are drawn as a new ocean opening between them (a young ridge): that is how a continent splits.
//
// Ideas taken, never code or art (three sources read):
//   - Cavadas and Aboim, Geoscience Communication 4 (2021), on the PhET Plate Tectonics simulator, which collects the
//     misconceptions this card is built against: "separating plates leave an empty gap", "all mountains are volcanoes",
//     "the same mechanism makes continental and oceanic ranges", "earthquakes happen when plates suddenly crash together";
//   - Tectonic Explorer (Concord Consortium, NSF-funded): move plates and read earthquake depth in a cross-section, hence the
//     red earthquake dots that deepen along a sinking plate and stay shallow elsewhere;
//   - Eos, "A grand tour of the ocean basins": students draw symmetrical cross-sections; so the sections here are always
//     one ocean-continent or like-with-like pair, drawn with the real difference in crust thickness and density.
// Refused: a map-view globe (that is `map-reader`'s ground), a magnitude slider and shaking buildings (the section would not show
// them), hot-spot volcanoes and tsunamis (not a plate-boundary section), and a pick-from-a-list boundary quiz.

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { TectonicsView } from './View'

// ---------------------------------------------------------------------------
// The words

export const KINDS = ['ocean', 'continent'] as const
export type Kind = (typeof KINDS)[number]
export const DIRS = ['apart', 'past', 'together'] as const
export type Dir = (typeof DIRS)[number]
export const LANDFORMS = ['trench', 'island-arc', 'volcanic-mountains', 'fold-mountains', 'rift-valley', 'ridge'] as const
export type Landform = (typeof LANDFORMS)[number]
export const HAZARDS = ['deep-earthquakes', 'volcanoes-shallow-quakes', 'quakes-no-volcanoes'] as const
export type Hazard = (typeof HAZARDS)[number]

export type TectConfig =
  /** target: the landform to make. A name outside the list still parses; faults says what would work. */
  | { task: 'landform'; left: string; right: string; target: string }
  | { task: 'hazard'; left: string; right: string; target: string }

/** dir: the way the plates move (null before any choice). step: how much time has passed, 0 to STEPS. */
export type TectState = { dir: Dir | null; step: number }

export const STEPS = 4
/** Time passed for a movement to show clearly: the card passes from here on. */
export const ENOUGH = 2
/** Pressing a movement runs the plates this far. */
export const RUN = 3

// ---------------------------------------------------------------------------
// What each meeting does

export type Boundary = 'subduction' | 'collision' | 'ridge' | 'rift' | 'fault'
export type Outcome = { id: Boundary; landforms: Landform[]; volcanoes: boolean; deep: boolean }

export function outcomeOf(left: Kind, right: Kind, dir: Dir): Outcome {
  if (dir === 'past') return { id: 'fault', landforms: [], volcanoes: false, deep: false }
  if (dir === 'together') {
    if (left === 'continent' && right === 'continent') return { id: 'collision', landforms: ['fold-mountains'], volcanoes: false, deep: false }
    const both = left === 'ocean' && right === 'ocean'
    return { id: 'subduction', landforms: both ? ['trench', 'island-arc'] : ['trench', 'volcanic-mountains'], volcanoes: true, deep: true }
  }
  if (left === 'continent' && right === 'continent') return { id: 'rift', landforms: ['rift-valley'], volcanoes: true, deep: false }
  return { id: 'ridge', landforms: ['ridge'], volcanoes: true, deep: false }
}

const makes = (target: string, o: Outcome): boolean => {
  if ((LANDFORMS as readonly string[]).includes(target)) return o.landforms.includes(target as Landform)
  if (target === 'deep-earthquakes') return o.deep
  if (target === 'volcanoes-shallow-quakes') return o.volcanoes && !o.deep
  if (target === 'quakes-no-volcanoes') return !o.volcanoes
  return false
}

const isKind = (v: string): v is Kind => (KINDS as readonly string[]).includes(v)

/** Every movement that makes the target with these two crusts. */
export function solutions(config: TectConfig): Dir[] {
  if (!isKind(config.left) || !isKind(config.right)) return []
  return DIRS.filter((d) => makes(config.target, outcomeOf(config.left as Kind, config.right as Kind, d)))
}

export const done = (config: TectConfig, state: TectState): boolean =>
  state.dir !== null && state.step >= ENOUGH && solutions(config).includes(state.dir)

// ---------------------------------------------------------------------------
// Words said back, after marking only

export const DIR_NAME: Record<Dir, string> = { apart: 'pulled the plates apart', past: 'slid the plates past each other', together: 'pushed the plates together' }
export const LANDFORM_NAME: Record<string, string> = {
  trench: 'a deep ocean trench', 'island-arc': 'a chain of volcanic islands', 'volcanic-mountains': 'a line of volcanic mountains',
  'fold-mountains': 'a range of fold mountains', 'rift-valley': 'a rift valley', ridge: 'a mid-ocean ridge',
}
export const HAZARD_NAME: Record<string, string> = {
  'deep-earthquakes': 'earthquakes that start deep in the Earth',
  'volcanoes-shallow-quakes': 'volcanoes with only shallow earthquakes',
  'quakes-no-volcanoes': 'earthquakes with no volcano',
}
const targetName = (config: TectConfig) => (config.task === 'landform' ? LANDFORM_NAME[config.target] : HAZARD_NAME[config.target]) ?? config.target

/** What the section shows for these two crusts and this movement, in a sentence. */
export function madeOf(left: Kind, right: Kind, dir: Dir): string {
  const o = outcomeOf(left, right, dir)
  switch (o.id) {
    case 'subduction':
      return right === 'ocean' && left === 'ocean'
        ? 'the older, denser ocean plate sank beneath the other: a deep trench, a chain of volcanic islands above it, and earthquakes that deepen along the sinking plate'
        : 'the dense ocean plate sank beneath the lighter continent: a deep trench, volcanoes on the continent above it, and earthquakes that deepen along the sinking plate'
    case 'collision':
      return 'neither plate could sink, so the crust was squeezed up into fold mountains, with shallow earthquakes and no volcanoes'
    case 'ridge':
      return 'magma welled up into the gap and set as new ocean floor along a mid-ocean ridge, with shallow earthquakes'
    case 'rift':
      return 'the crust stretched and a block dropped between faults into a rift valley, with volcanoes and shallow earthquakes'
    default:
      return 'no crust was made or lost, so no new landform and no volcano, only shallow earthquakes as the plates stick and then jerk free'
  }
}

/** Why the target needs what it needs: said when the learner made something else. */
const NEEDS: Record<string, string> = {
  trench: 'A trench forms where two plates push together and the denser ocean plate is forced down.',
  'island-arc': 'A volcanic island chain forms where two ocean plates push together and one sinks, melting as it goes.',
  'volcanic-mountains': 'Volcanic mountains rise on a continent where an ocean plate sinks beneath its edge and melts.',
  'fold-mountains': 'Fold mountains rise where two continents push together: neither will sink, so the crust crumples upward.',
  'rift-valley': 'A rift valley opens where a continent is pulled apart and a block drops between faults.',
  ridge: 'A mid-ocean ridge builds where ocean plates pull apart and magma sets in the gap.',
  'deep-earthquakes': 'Earthquakes only start deep where a plate sinks into the mantle; elsewhere they stay shallow.',
  'volcanoes-shallow-quakes': 'Volcanoes with only shallow earthquakes come where plates pull apart and magma rises through the gap.',
  'quakes-no-volcanoes': 'Plates that make earthquakes but no volcano either slide past each other, or are two continents pushed together.',
}

export type Said = { lead: string; more: string }

export function working(config: TectConfig, state: TectState): Said {
  const l = config.left as Kind
  const r = config.right as Kind
  const dir = state.dir ?? solutions(config)[0]
  const made = madeOf(l, r, dir)
  return { lead: `Yes. You ${DIR_NAME[dir]}: ${made}.`, more: NEEDS[config.target] ?? '' }
}

export function madeText(config: TectConfig, state: TectState): Said {
  if (state.dir === null || state.step === 0) return { lead: 'The plates did not move.', more: `Move them, and let time run, to make ${targetName(config)}.` }
  const l = config.left as Kind
  const r = config.right as Kind
  if (solutions(config).includes(state.dir) && state.step < ENOUGH) {
    return { lead: 'That is the right movement, but too little time has passed for it to show.', more: 'Step the time on and look again.' }
  }
  return { lead: `You ${DIR_NAME[state.dir]}: ${madeOf(l, r, state.dir)}.`, more: `${NEEDS[config.target] ?? ''}` }
}

// ---------------------------------------------------------------------------
// The picture. Every number is a pixel on a 360 x 240 plate.

export const W = 360
export const H = 240
/** Sea level, the land surface, the ocean floor. */
export const SL = 100
export const LAND = 90
export const OCF = 128
/** Crust and whole-plate thicknesses. */
export const OC_T = 14
export const CC_T = 40
export const LITH_O = 48
export const CBOT = 190
/** Where the two plates meet. */
export const X0 = 180
export const HINGE = 180
/** The row, above everything, where the names of the answer go once marked. */
export const SKY_Y = 30

export type Pt = { x: number; y: number }
export type Mat = 'sea' | 'mantle' | 'lith' | 'basalt' | 'basalt2' | 'strataA' | 'strataB' | 'strataC' | 'granite' | 'magma' | 'cone'
export type Poly = { m: Mat; pts: Pt[] }
export type Seg = { kind: 'fault' | 'conduit'; pts: Pt[]; w: number }
export type Tag = { text: string; x: number; y: number; anchor: 'start' | 'middle' | 'end'; part: Pt; leader?: boolean }
export type Arrow = { x: number; y: number; dx: 1 | -1 }
export type Mark = { x: number; y: number; kind: 'in' | 'out' }
export type Facts = { cones: number; foci: number; heaved: boolean; dropped: boolean; bent: boolean; newFloor: boolean }
export type Scene = { polys: Poly[]; segs: Seg[]; foci: Pt[]; arrows: Arrow[]; marks: Mark[]; tags: Tag[]; answerTags: Tag[]; facts: Facts }

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
/** A smooth bump: 1 at u = 0, 0 at |u| >= 1. */
const rc = (u: number) => (Math.abs(u) >= 1 ? 0 : (1 + Math.cos(Math.PI * u)) / 2)
const P = (x: number, y: number): Pt => ({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 })

/** Roughly how wide a label is, at 12 px bold. */
export const textWidth = (s: string) => s.length * 6.6

const xsOf = (a: number, b: number, step = 3): number[] => {
  const out: number[] = []
  for (let x = a; x < b; x += step) out.push(x)
  out.push(b)
  return out
}
type Fn = (x: number) => number
const band = (x1: number, x2: number, top: Fn, bot: Fn, step = 3): Pt[] => {
  const xs = xsOf(x1, x2, step)
  return [...xs.map((x) => P(x, top(x))), ...xs.slice().reverse().map((x) => P(x, bot(x)))]
}

type Layers = { back: Poly[]; lith: Poly[]; crust: Poly[]; over: Poly[]; segs: Seg[]; foci: Pt[]; arrows: Arrow[]; marks: Mark[]; tags: Tag[]; answerTags: Tag[]; facts: Facts }
const newLayers = (): Layers => ({
  back: [], lith: [], crust: [], over: [], segs: [], foci: [], arrows: [], marks: [], tags: [], answerTags: [],
  facts: { cones: 0, foci: 0, heaved: false, dropped: false, bent: false, newFloor: false },
})

/** Ocean crust and the stiff mantle beneath it, between x1 and x2. */
function oceanColumn(S: Layers, x1: number, x2: number, top: Fn, lithBot: Fn) {
  if (x2 <= x1) return
  S.lith.push({ m: 'lith', pts: band(x1, x2, (x) => top(x) + OC_T, lithBot) })
  S.crust.push({ m: 'basalt', pts: band(x1, x2, top, (x) => top(x) + OC_T) })
}

/** Alternate darker strips in ocean crust: they ride along with the plate they are on. */
function stripes(S: Layers, x1: number, x2: number, top: Fn, edge: number, dir: 1 | -1) {
  for (let k = -14; k < 26; k++) {
    if (((k % 2) + 2) % 2 === 0) continue
    const a = dir === 1 ? edge + 16 * k : edge - 16 * (k + 1)
    const lo = Math.max(a, x1)
    const hi = Math.min(a + 16, x2)
    if (hi - lo > 0.5) S.crust.push({ m: 'basalt2', pts: band(lo, hi, top, (x) => top(x) + OC_T, 4) })
  }
}

/** Continent: sedimentary layers on granite, on stiff mantle. */
function contColumn(S: Layers, x1: number, x2: number, top: Fn, moho: Fn, lithBot: Fn) {
  if (x2 <= x1) return
  S.lith.push({ m: 'lith', pts: band(x1, x2, moho, lithBot) })
  const mats: Mat[] = ['strataA', 'strataB', 'strataC']
  mats.forEach((m, i) => S.crust.push({ m, pts: band(x1, x2, (x) => Math.min(top(x) + 8 * i, moho(x)), (x) => Math.min(top(x) + 8 * (i + 1), moho(x))) }))
  S.crust.push({ m: 'granite', pts: band(x1, x2, (x) => Math.min(top(x) + 24, moho(x)), moho) })
}

const coastTop = (edge: number, y0: number): Fn => (x) => y0 + (LAND - y0) * clamp((x - edge) / 34, 0, 1)
const coastThick = (edge: number): Fn => (x) => clamp(14 + (x - edge) * 0.8, 14, CC_T)

const cone = (S: Layers, x: number, baseY: number, h: number, hw: number) => {
  if (h < 2) return
  S.over.push({ m: 'cone', pts: [P(x - hw, baseY + 1), P(x - 5, baseY - h), P(x + 5, baseY - h), P(x + hw, baseY + 1)] })
  S.facts.cones += 1
}

const lerp = (a: Pt, b: Pt, f: number): Pt => P(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f)
const count = (t: number, max = 8) => clamp(Math.floor(t * max + 0.001), 0, max)

/** Two plates meeting, at rest or sliding past: the section shows no new landform at all. */
function fault(S: Layers, l: Kind, r: Kind, t: number, withMarks: boolean) {
  const flat = (k: Kind): Fn => () => (k === 'ocean' ? OCF : LAND)
  if (l === 'ocean') oceanColumn(S, -10, X0, flat('ocean'), () => OCF + LITH_O)
  else contColumn(S, -10, X0, flat('continent'), () => LAND + CC_T, () => CBOT)
  if (r === 'ocean') oceanColumn(S, X0, W + 10, flat('ocean'), () => OCF + LITH_O)
  else if (l === 'ocean') contColumn(S, X0, W + 10, coastTop(X0, OCF), (x) => coastTop(X0, OCF)(x) + coastThick(X0)(x), () => CBOT)
  else contColumn(S, X0, W + 10, flat('continent'), () => LAND + CC_T, () => CBOT)
  if (l === 'ocean') stripes(S, -10, X0, flat('ocean'), 0, 1)
  if (r === 'ocean') stripes(S, X0, W + 10, flat('ocean'), 0, 1)
  const topY = l === 'ocean' ? OCF : LAND
  S.segs.push({ kind: 'fault', pts: [P(X0, topY), P(X0, 184)], w: 2 })
  if (withMarks) {
    S.marks.push({ x: X0 - 64, y: 158, kind: 'out' }, { x: X0 + 64, y: 158, kind: 'in' })
    const REL = [4, 10.5, 17, 23.5, 30, 36.5, 43, 49.5]
    const DX = [6, -6, 6, -6, 6, -6, 6, -6]
    for (let i = 0; i < count(t); i++) S.foci.push(P(X0 + DX[i], topY + REL[i]))
  }
}

/** Plates pulled apart where there is ocean: magma sets in the gap as a ridge of new crust. */
function ridge(S: Layers, r: Kind, t: number) {
  const g = 64 * t
  const rise = 26 * clamp(t * 3, 0, 1)
  const top: Fn = (x) => OCF - rise * Math.max(0, 1 - Math.abs(x - X0) / (g + 34))
  const lithBot: Fn = (x) => top(x) + OC_T + clamp(4 + 0.55 * Math.abs(x - X0), 4, LITH_O - OC_T)
  const xr = r === 'ocean' ? W + 10 : X0 + g
  oceanColumn(S, -10, xr, top, lithBot)
  stripes(S, -10, xr, top, X0 - g, -1)
  stripes(S, X0, xr, top, X0 + g, 1)
  if (r === 'continent') {
    const ct = coastTop(xr, top(xr))
    contColumn(S, xr, W + 10, ct, (x) => ct(x) + coastThick(xr)(x), () => CBOT)
  }
  const yb = lithBot(X0)
  const m = clamp(t * 2, 0, 1)
  S.over.push({ m: 'magma', pts: [P(X0 - 16, yb + 1), P(X0 + 16, yb + 1), P(X0 + 9, yb + 1 + 30 * m), P(X0 - 9, yb + 1 + 30 * m)] })
  S.segs.push({ kind: 'conduit', pts: [P(X0, yb + 2), P(X0, top(X0) + 3)], w: 5 * m })
  cone(S, X0 - 26, top(X0 - 26), 15 * m, 14)
  cone(S, X0 + 26, top(X0 + 26), 15 * m, 14)
  S.arrows.push({ x: 74, y: 160, dx: -1 }, { x: 286, y: 160, dx: 1 })
  const DX = [16, -18, 32, -34, 46, -48, 24, -26]
  const REL = [24, 24, 22, 22, 20, 20, 36, 36]
  for (let i = 0; i < count(t); i++) S.foci.push(P(X0 + DX[i], top(X0 + DX[i]) + REL[i]))
  S.facts.newFloor = t > 0.05
  S.answerTags.push({ text: 'Mid-ocean ridge', x: X0, y: SKY_Y, anchor: 'middle', part: P(X0, top(X0)), leader: true })
}

/** A continent pulled apart: the middle drops between faults and magma rises under it. */
function rift(S: Layers, t: number) {
  const w = 18 + 50 * t
  const shape = (x: number) => clamp((1 - Math.abs(x - X0) / w) / 0.35, 0, 1)
  const top: Fn = (x) => LAND + 26 * t * shape(x)
  const bump = (x: number) => rc((x - X0) / (w * 1.7))
  const moho: Fn = (x) => LAND + CC_T - 4 * t * bump(x)
  const lithBot: Fn = (x) => CBOT - 56 * t * bump(x)
  contColumn(S, -10, W + 10, top, moho, lithBot)
  const mt = clamp(t * 1.6, 0, 1)
  const yb = lithBot(X0)
  const yTop = yb - (yb - moho(X0)) * mt
  S.over.push({ m: 'magma', pts: [P(X0 - 8, yb + 2), P(X0 + 8, yb + 2), P(X0 + 5, yTop), P(X0 - 5, yTop)] })
  const m = clamp((t - 0.25) / 0.5, 0, 1)
  const c1 = X0 - 14
  const c2 = X0 + 16
  cone(S, c1, top(c1), 26 * m, 16)
  cone(S, c2, top(c2), 20 * m, 14)
  if (m > 0) {
    S.segs.push({ kind: 'conduit', pts: [P(X0 - 2, yTop), P(c1, top(c1) - 22 * m)], w: 3.4 * m }, { kind: 'conduit', pts: [P(X0 + 2, yTop), P(c2, top(c2) - 18 * m)], w: 3.4 * m })
  }
  const left = [P(X0 - w - 6, LAND), P(X0 - w * 0.55, 140)]
  const right = [P(X0 + w + 6, LAND), P(X0 + w * 0.55, 140)]
  if (t > 0.05) S.segs.push({ kind: 'fault', pts: left, w: 1.6 }, { kind: 'fault', pts: right, w: 1.6 })
  S.arrows.push({ x: 74, y: 160, dx: -1 }, { x: 286, y: 160, dx: 1 })
  const F = [0.3, 0.3, 0.55, 0.55, 0.8, 0.8, 0.15, 0.15]
  for (let i = 0; i < count(t); i++) S.foci.push(lerp(i % 2 === 0 ? left[0] : right[0], i % 2 === 0 ? left[1] : right[1], F[i]))
  S.facts.dropped = t > 0.05
  S.answerTags.push({ text: 'Rift valley', x: X0, y: SKY_Y, anchor: 'middle', part: P(X0, top(X0)), leader: true })
}

/** Two continents pushed together: neither sinks, so the crust piles up into folded mountains with a root. */
function collide(S: Layers, t: number) {
  const w = 60 + 30 * t
  const h = 28 * t
  const tri = (u: number) => Math.max(0, 1 - Math.abs(u))
  const peak = (x: number) => h * (0.12 * rc((x - X0) / (w * 1.1)) + 0.5 * tri((x - X0 + 46) / (w * 0.4)) + 0.9 * tri((x - X0 + 20) / (w * 0.36)) + 1.0 * tri((x - X0) / (w * 0.36)) + 0.7 * tri((x - X0 - 22) / (w * 0.36)) + 0.45 * tri((x - X0 - 46) / (w * 0.4)))
  const top: Fn = (x) => LAND - peak(x)
  const moho: Fn = (x) => LAND + CC_T + 44 * t * rc((x - X0) / (w * 1.3))
  const lithBot: Fn = (x) => CBOT + 20 * t * rc((x - X0) / (w * 1.6))
  contColumn(S, -10, W + 10, top, moho, lithBot)
  const l0 = P(X0 - 70, LAND)
  const l1 = P(X0 - 4, 150 + 44 * t)
  const r0 = P(X0 + 70, LAND)
  const r1 = P(X0 + 4, 150 + 44 * t)
  if (t > 0.05) S.segs.push({ kind: 'fault', pts: [l0, l1], w: 1.6 }, { kind: 'fault', pts: [r0, r1], w: 1.6 })
  S.arrows.push({ x: 74, y: 160, dx: 1 }, { x: 286, y: 160, dx: -1 })
  const F = [0.35, 0.35, 0.6, 0.6, 0.85, 0.85, 0.2, 0.2]
  for (let i = 0; i < count(t); i++) S.foci.push(lerp(i % 2 === 0 ? l0 : r0, i % 2 === 0 ? l1 : r1, F[i]))
  S.facts.heaved = t > 0.05
  S.answerTags.push({ text: 'Fold mountains', x: X0, y: SKY_Y, anchor: 'middle', part: P(X0, top(X0)), leader: true })
}

/** An ocean plate pushed under another plate: it bends down at the hinge, and the plate above is cut along its top. */
function subduct(S: Layers, r: Kind, t: number) {
  const a = ((90 - 45 * clamp(t / 0.3, 0, 1)) * Math.PI) / 180
  const u = { x: Math.cos(a), y: Math.sin(a) }
  const n = { x: -Math.sin(a), y: Math.cos(a) }
  const H0 = P(HINGE, OCF)
  const D = 200 * t
  const at = (s: number, d: number) => P(H0.x + s * u.x + d * n.x, H0.y + s * u.y + d * n.y)
  const flatTop: Fn = () => OCF
  oceanColumn(S, -10, HINGE, flatTop, () => OCF + LITH_O)
  // The plate going down, a rotated slab hinged at the top corner, with the stripes sliding along into it.
  if (D > 0.5) {
    S.lith.push({ m: 'lith', pts: [at(0, OC_T), at(D, OC_T), at(D, LITH_O), at(0, LITH_O)] })
    S.crust.push({ m: 'basalt', pts: [at(0, 0), at(D, 0), at(D, OC_T), at(0, OC_T)] })
  }
  const lf = HINGE + 10
  const shift = 180 * t
  for (let k = -14; k < 30; k++) {
    if (((k % 2) + 2) % 2 === 0) continue
    const s0 = 16 * k + shift
    const s1 = s0 + 16
    const fa = Math.max(s0 - 10, -10)
    const fb = Math.min(s1 - 10, HINGE)
    if (fb - fa > 0.5 && s1 > 0) S.crust.push({ m: 'basalt2', pts: band(fa, fb, flatTop, () => OCF + OC_T, 4) })
    const ta = Math.max(s0 - lf, 0)
    const tb = Math.min(s1 - lf, D)
    if (tb - ta > 0.5) S.crust.push({ m: 'basalt2', pts: [at(ta, 0), at(tb, 0), at(tb, OC_T), at(ta, OC_T)] })
  }
  // The plate above.
  const yb = r === 'continent' ? CBOT : OCF + LITH_O
  const sEnd = (yb - OCF) / u.y
  const E = at(sEnd, 0)
  const topR: Fn = r === 'continent' ? coastTop(HINGE, OCF) : () => OCF
  const mohoR: Fn = r === 'continent' ? (x) => topR(x) + coastThick(HINGE)(x) : () => OCF + OC_T
  if (r === 'continent') {
    S.lith.push({ m: 'lith', pts: [...xsOf(HINGE, W + 10, 6).map((x) => P(x, mohoR(x))), P(W + 10, yb), E, H0] })
    contColumn(S, HINGE, W + 10, topR, mohoR, () => yb)
  } else {
    S.lith.push({ m: 'lith', pts: [P(HINGE, OCF + OC_T), P(W + 10, OCF + OC_T), P(W + 10, yb), E, H0] })
    S.crust.push({ m: 'basalt', pts: band(HINGE, W + 10, flatTop, () => OCF + OC_T) })
    stripes(S, HINGE, W + 10, flatTop, 0, 1)
  }
  // Magma: from the sinking plate where it has reached melting depth, up to cones on the plate above.
  const sTop = (yb - OCF) / u.y
  const vm = clamp((D - sTop + 30) / 40, 0, 1)
  const base = at(sTop, 0)
  const cx = r === 'continent' ? [HINGE + 70, HINGE + 104] : [HINGE + 56, HINGE + 92]
  const ch = r === 'continent' ? [34, 26] : [46, 38]
  const cb = r === 'continent' ? LAND : OCF
  if (vm > 0) {
    const mx = (cx[0] + cx[1]) / 2
    const my = cb + (r === 'continent' ? CC_T - 12 : OC_T - 6)
    const rx = 15 * vm
    const ry = 8 * vm
    S.over.push({ m: 'magma', pts: [0, 1, 2, 3, 4, 5, 6, 7].map((i) => P(mx + rx * Math.cos((i * Math.PI) / 4), my + ry * Math.sin((i * Math.PI) / 4))) })
    S.segs.push({ kind: 'conduit', pts: [P(base.x, base.y), P(mx - 4, my + 4)], w: 3.4 * vm })
    cx.forEach((x, i) => {
      S.segs.push({ kind: 'conduit', pts: [P(mx + (i === 0 ? -6 : 6), my - 2), P(x, cb - ch[i] * vm + 3)], w: 2.8 * vm })
      cone(S, x, cb, ch[i] * vm, r === 'continent' ? 22 : 20)
    })
  }
  const OFF = [8, 22, 14, 30, 10, 26, 18, 34, 12, 28, 20]
  for (let j = 0; j < OFF.length; j++) {
    const s = 12 + 17 * j
    if (s > D - 4) break
    const f = at(s, OFF[j])
    if (f.y > H - 10 || f.x > W - 10) break
    S.foci.push(f)
  }
  S.facts.bent = D > 20
  S.arrows.push({ x: 74, y: 160, dx: 1 }, { x: 300, y: 160, dx: -1 })
  S.answerTags.push({ text: 'Trench', x: HINGE - 8, y: 117, anchor: 'end', part: P(HINGE, OCF) })
  if (vm > 0) {
    const apex = P((cx[0] + cx[1]) / 2, cb - Math.max(ch[0], ch[1]) * vm)
    S.answerTags.push({ text: r === 'continent' ? 'Volcanoes' : 'Island arc', x: apex.x, y: SKY_Y, anchor: 'middle', part: apex, leader: true })
  }
}

function build(l: Kind, r: Kind, dir: Dir | null, t: number): Layers {
  const S = newLayers()
  S.back.push({ m: 'sea', pts: [P(0, SL), P(W, SL), P(W, 232), P(0, 232)] })
  S.back.push({ m: 'mantle', pts: [P(0, 150), P(W, 150), P(W, H), P(0, H)] })
  if (dir === null) fault(S, l, r, 0, false)
  else if (dir === 'past') fault(S, l, r, t, true)
  else if (dir === 'apart') {
    if (l === 'continent' && r === 'continent') rift(S, t)
    else ridge(S, r, t)
  } else if (l === 'continent' && r === 'continent') collide(S, t)
  else subduct(S, r, t)
  if (dir === 'past') S.answerTags.push({ text: 'Fault line', x: X0, y: SKY_Y, anchor: 'middle', part: P(X0, l === 'ocean' ? OCF : LAND), leader: true })
  S.facts.foci = S.foci.length
  return S
}

/** The names of the parts, which are not the answer: shown from the start. */
function partTags(l: Kind, r: Kind): Tag[] {
  const out: Tag[] = []
  const anyOcean = l === 'ocean' || r === 'ocean'
  if (anyOcean) out.push({ text: 'Sea', x: 14, y: 116, anchor: 'start', part: P(26, 110) })
  if (l === 'ocean') out.push({ text: 'Oceanic crust', x: 14, y: OCF + 11, anchor: 'start', part: P(50, OCF + 7) })
  else out.push({ text: 'Continental crust', x: 10, y: 112, anchor: 'start', part: P(50, 108) })
  if (l === 'ocean' && r === 'continent') out.push({ text: 'Continent', x: W - 10, y: 112, anchor: 'end', part: P(W - 40, 108) })
  if (l === 'ocean' && r === 'ocean') { /* one label for the one kind */ }
  out.push({ text: 'Mantle', x: 12, y: 232, anchor: 'start', part: P(30, 226) })
  return out
}

/** The whole section for these plates, this movement and this much time (t from 0 to 1). The ocean always sits on the left. */
export function sceneOf(left: Kind, right: Kind, dir: Dir | null, t: number): Scene {
  const flip = left === 'continent' && right === 'ocean'
  const S = build(flip ? 'ocean' : left, flip ? 'continent' : right, dir, clamp(t, 0, 1))
  const tags = partTags(flip ? 'ocean' : left, flip ? 'continent' : right)
  const mx = (p: Pt): Pt => (flip ? P(W - p.x, p.y) : p)
  const mt = (g: Tag): Tag => (flip ? { ...g, x: W - g.x, part: mx(g.part), anchor: g.anchor === 'start' ? 'end' : g.anchor === 'end' ? 'start' : 'middle' } : g)
  const mp = (poly: Poly): Poly => (flip ? { m: poly.m, pts: poly.pts.map(mx) } : poly)
  return {
    polys: [...S.back, ...S.lith, ...S.crust, ...S.over].map(mp),
    segs: S.segs.map((s) => (flip ? { ...s, pts: s.pts.map(mx) } : s)),
    foci: S.foci.map(mx),
    arrows: S.arrows.map((a) => (flip ? { ...a, x: W - a.x, dx: (a.dx * -1) as 1 | -1 } : a)),
    marks: S.marks.map((m) => (flip ? { ...m, x: W - m.x } : m)),
    tags: tags.map(mt),
    answerTags: S.answerTags.map(mt),
    facts: S.facts,
  }
}

/** The section in words, without naming what it is. */
export function describe(left: Kind, right: Kind, dir: Dir | null, step: number): string {
  const kind = (k: Kind) => (k === 'ocean' ? 'an ocean plate' : 'a continental plate')
  const base = `A cross-section of the Earth's outer layers: ${kind(left)} on the left and ${kind(right)} on the right, over hot mantle.`
  if (dir === null) return `${base} Nothing is moving yet.`
  const sc = sceneOf(left, right, dir, step / STEPS)
  const f = sc.facts
  const move = dir === 'apart' ? 'moving apart' : dir === 'past' ? 'sliding past each other, one towards you and one away' : 'moving towards each other'
  const bits = [`The plates are ${move}; time passed is ${step} of ${STEPS}.`]
  if (f.bent) bits.push("The edge of one plate bends down into the mantle.")
  if (f.heaved) bits.push('The ground between them has been heaved up into a high, crumpled heap, with a thick root below.')
  if (f.dropped) bits.push('A block of ground between two faults has dropped, with hot rock rising below it.')
  if (f.newFloor) bits.push('Hot rock rises into the gap and sets as new dark floor, with no empty space left.')
  if (f.cones > 0) bits.push(`${f.cones} cone${f.cones === 1 ? '' : 's'} of hot rock stand${f.cones === 1 ? 's' : ''} where magma reaches the surface.`)
  bits.push(f.foci > 0 ? `${f.foci} red dot${f.foci === 1 ? '' : 's'} mark earthquakes.` : 'No earthquakes yet.')
  return `${base} ${bits.join(' ')}`
}

// ---------------------------------------------------------------------------
// Reading the config

const norm = (raw: unknown): string => (typeof raw === 'string' ? raw.toLowerCase().replace(/[^a-z]+/g, ' ').trim() : '')
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)

const TARGET_WORDS: [string, RegExp][] = [
  ['island-arc', /island arc|volcanic arc|volcanic island|island chain|chain of islands/],
  ['volcanic-mountains', /volcanic mountain|volcanic chain|volcanoes on the|andes|composite volcano|continental arc/],
  ['quakes-no-volcanoes', /no volcano|without volcano|not volcanic|quakes only|earthquakes only|only earthquakes|no eruption/],
  ['volcanoes-shallow-quakes', /volcano.*shallow|shallow.*volcano|volcanic.*shallow|shallow.*volcanic/],
  ['deep-earthquakes', /deep.*quake|quake.*deep|deep focus/],
  ['trench', /trench/],
  ['fold-mountains', /fold|himalaya|mountain|range/],
  ['rift-valley', /rift|graben|valley/],
  ['ridge', /ridge|ocean floor|spreading|seafloor|sea floor/],
]
function readTarget(raw: unknown): string | null {
  const s = norm(raw)
  if (!s) return null
  const kebab = s.replace(/ /g, '-')
  if ([...LANDFORMS, ...HAZARDS].includes(kebab as never)) return kebab
  for (const [id, re] of TARGET_WORDS) if (re.test(s)) return id
  return kebab
}

function readKinds(raw: unknown): [string, string] | null {
  const s = norm(raw)
  if (!s) return null
  const found = [...s.matchAll(/ocean|oceanic|sea|continent|continental|land|crust/g)].map((m) => (/^(ocean|oceanic|sea)$/.test(m[0]) ? 'ocean' : /^crust$/.test(m[0]) ? '' : 'continent')).filter(Boolean)
  if (found.length >= 2) return [found[0], found[1]]
  if (found.length === 1 && /two|both|each/.test(s)) return [found[0], found[0]]
  return null
}
const kindOf = (raw: unknown): string | null => {
  const s = norm(raw)
  if (!s) return null
  if (/ocean|sea/.test(s)) return 'ocean'
  if (/continent|land/.test(s)) return 'continent'
  return s.replace(/ /g, '-')
}

/** The two crusts that make each target, used when the writer names none. */
const DEFAULT_PLATES: Record<string, [Kind, Kind]> = {
  trench: ['ocean', 'continent'], 'island-arc': ['ocean', 'ocean'], 'volcanic-mountains': ['ocean', 'continent'], 'fold-mountains': ['continent', 'continent'],
  'rift-valley': ['continent', 'continent'], ridge: ['ocean', 'ocean'], 'deep-earthquakes': ['ocean', 'continent'],
  'volcanoes-shallow-quakes': ['continent', 'continent'], 'quakes-no-volcanoes': ['continent', 'continent'],
}

export const NAMED_PAIRS = 'oceanic and continental, oceanic and oceanic, or continental and continental'

/** What would work, in config words, for a pair that cannot make the target. */
const pairFor = (target: string): string => {
  const [a, b] = DEFAULT_PLATES[target] ?? ['ocean', 'continent']
  return `left "${a}", right "${b}"`
}

const PROMPT_FOR: Record<string, string> = {
  trench: 'Choose how the two plates move, then step the time on, to make a deep ocean trench.',
  'island-arc': 'Choose how the two plates move, then step the time on, to build a chain of volcanic islands.',
  'volcanic-mountains': 'Choose how the two plates move, then step the time on, to raise a line of volcanic mountains along the coast.',
  'fold-mountains': 'Choose how the two plates move, then step the time on, to raise a range of fold mountains.',
  'rift-valley': 'Choose how the two plates move, then step the time on, to open a rift valley.',
  ridge: 'Choose how the two plates move, then step the time on, to build a mid-ocean ridge.',
  'deep-earthquakes': 'Choose how the two plates move, then step the time on, so that earthquakes start deep below the surface.',
  'volcanoes-shallow-quakes': 'Choose how the two plates move, then step the time on, so that volcanoes erupt but the earthquakes stay shallow.',
  'quakes-no-volcanoes': 'Choose how the two plates move, then step the time on, so that earthquakes strike but no volcano erupts.',
}
const goodPrompt = (config: TectConfig) => PROMPT_FOR[config.target] ?? PROMPT_FOR.trench

export const tectonicsEngine: SceneEngine<TectConfig, TectState> = {
  id: 'tectonics',
  // Few and distinctive: `scenesFor` matches a covers word by its first five letters and `sceneCatalogue` by the word or its plural.
  // "Plate", "fault" and "volcano" have other lives (biology, the kitchen, electronics, a science-fair model), so the long names are phrases.
  covers: ['tectonics', 'tectonic', 'earthquakes', 'volcanoes', 'seismic', 'subduction'],
  phrases: [
    'plate tectonics', 'tectonic plates', 'tectonic plate', 'tectonic processes', 'tectonic hazards', 'tectonic activity', 'plate boundaries', 'plate boundary', 'plate margins', 'plate movement', 'plate movements',
    'moving plates', 'continental drift', 'earth s plates', 'earths plates', 'earthquake', 'volcano', 'volcanic eruptions', 'volcanic activity', 'volcanic hazards', 'earthquakes and volcanoes',
    'fold mountains', 'rift valley', 'rift valleys', 'great rift valley', 'east african rift', 'mid ocean ridge', 'ocean ridge', 'ocean trench', 'ocean trenches', 'island arc', 'island arcs', 'sea floor spreading', 'seafloor spreading',
    'forms of relief', 'structure of the earth', 'earth s structure', 'inside the earth', 'crust and mantle', 'destructive margin', 'constructive margin', 'conservative margin', 'destructive margins', 'constructive margins', 'conservative margins', 'destructive plate', 'constructive plate',
    'convergent boundary', 'divergent boundary', 'transform boundary', 'convergent boundaries', 'divergent boundaries', 'transform boundaries', 'convergent plate', 'divergent plate', 'convergent margin', 'divergent margin', 'convergent margins', 'divergent margins', 'transform fault', 'san andreas', 'ring of fire',
  ],
  // Near misses: the words with other lives, and what the section cannot draw.
  notFor: [
    'plate of food', 'dinner plate', 'plate armour', 'number plate', 'number plates', 'licence plate', 'petri dish', 'agar plate', 'agar plates', 'plate count', 'plate reader', 'cell plate', 'metaphase plate', 'growth plate', 'growth plates',
    'paper plate', 'paper plates', 'baking plate', 'plated', 'plating', 'electroplating', 'bone plate', 'bone plates',
    'science fair volcano', 'baking soda volcano', 'volcano experiment', 'volcano model', 'volcano models', 'model volcano', 'model volcanoes', 'volcano experiments', 'volcano projects', 'volcano craft', 'earthquake proof', 'earthquake resistant', 'earthquake engineering', 'earthquake drill', 'earthquake drills', 'earthquake safety',
    'tectonic shift', 'tectonic shifts', 'seismic shift', 'seismic shifts', 'seismic change', 'seismic waves', 'seismic survey', 'seismic surveys', 'seismology',
    'tsunami', 'tsunamis', 'hot spot', 'hotspot', 'hotspots', 'hot spots', 'hawaiian islands', 'tropical storms', 'tropical cyclones', 'hurricanes', 'flood risk', 'flooding',
    'fault finding', 'fault diagnosis', 'fault tolerance', 'fault tolerant', 'fault level', 'fault current', 'fault in the circuit', 'network fault', 'single point of failure', 'logic fault',
    'map reading', 'grid references', 'contour lines', 'reading maps',
  ],
  // The learner sets the way the plates move and watches what that does.
  isolates: 'consequence',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const target = readTarget(first(o, ['target', 'landform', 'hazard', 'goal', 'make', 'feature', 'aim']))
    if (target === null) return null
    const rawTask = norm(first(o, ['task', 'kind', 'type', 'mode']))
    const task: 'landform' | 'hazard' = /hazard|quake|volcano|danger/.test(rawTask)
      ? 'hazard'
      : /land|form|feature|relief/.test(rawTask) ? 'landform'
        : (HAZARDS as readonly string[]).includes(target) ? 'hazard' : 'landform'
    const pair = readKinds(first(o, ['plates', 'boundary', 'between', 'meeting', 'crusts', 'pair']))
    const lk = kindOf(first(o, ['left', 'plateA', 'a', 'first']))
    const rk = kindOf(first(o, ['right', 'plateB', 'b', 'second']))
    const def = DEFAULT_PLATES[target] ?? ['ocean', 'continent']
    const left = lk ?? (pair ? pair[0] : def[0])
    const right = rk ?? (pair ? pair[1] : def[1])
    return { task, left, right, target }
  },

  faults(config) {
    const out: string[] = []
    const known = config.task === 'landform' ? (LANDFORMS as readonly string[]) : (HAZARDS as readonly string[])
    if (!known.includes(config.target)) {
      const other = config.task === 'landform' ? HAZARDS : LANDFORMS
      const hint = (other as readonly string[]).includes(config.target) ? ` ("${config.target}" belongs to task "${config.task === 'landform' ? 'hazard' : 'landform'}")` : ''
      out.push(`There is no "${config.target}" target in task "${config.task}"${hint}: use one of ${known.join(', ')}, e.g. target "${known[0]}".`)
    }
    for (const side of ['left', 'right'] as const) {
      if (!isKind(config[side])) out.push(`The ${side} plate "${config[side]}" cannot be drawn: use "ocean" or "continent", e.g. ${side} "ocean".`)
    }
    if (out.length === 0 && solutions(config).length === 0) {
      out.push(`${targetName(config)[0].toUpperCase()}${targetName(config).slice(1)} cannot be made by ${config.left} and ${config.right} plates, whichever way they move: use e.g. ${pairFor(config.target)}.`)
    }
    return out
  },

  promptFaults(config, prompt) {
    const text = prompt.replace(/\s+/g, ' ')
    const example = goodPrompt(config)
    const out: string[] = []
    const motion = /\b(?:push(?:es|ed|ing)?|pull(?:s|ed|ing)?|mov(?:e|es|ed|ing)|slid(?:e|es|ing)|drift(?:s|ed|ing)?|ram(?:s|med|ming)?)\s+(?:the\s+(?:two\s+)?plates?\s+)?(?:together|apart|toward|towards|away|past|into|under|beneath|against|sideways)\b|\bcollid|\bcollision|\bconverg|\bdiverg|\bsubduct|\bsink(?:s|ing)?\b|\bgrind|\bsideways\b|\bcome together\b|\btowards? each other\b|\baway from each other\b|\bpast each other\b|\bdestructive\b|\bconstructive\b|\bconservative\b|\btransform\b|\bpulling apart\b|\bmoving apart\b|\bpush(?:ing)? together\b/i.test(text)
    if (motion) out.push(`the prompt gives the answer away: it says which way the plates move or what one does, which the learner is to find -- ask for the result only ("${example}")`)
    const promises = /\btsunami|\bmagnitude|\brichter|\bepicent|\bseismic wave|\bhot ?spot|\bdamage|\bbuilding|\bevacuat|\bforecast|\bpredict(?:ion)?\b|\bmap\b|\bglobe\b|\bdrag(?:ging)?\b|\bslider\b|\bdeaths?\b|\bpeople\b|\bcity|\bcities\b|\bhawaii|\bmagma chamber/i.test(text)
    if (promises) out.push(`the prompt promises something the card does not show: it draws one cross-section with a choice of movement and a time step, and no map, magnitude, damage or hot spot -- ask for that ("${example}")`)
    const mention: Record<string, RegExp> = {
      trench: /trench/i, 'island-arc': /island/i, 'volcanic-mountains': /volcan|mountain/i, 'fold-mountains': /mountain|fold|range/i, 'rift-valley': /rift|valley/i, ridge: /ridge|ocean floor/i,
      'deep-earthquakes': /deep/i, 'volcanoes-shallow-quakes': /volcan/i, 'quakes-no-volcanoes': /quake|earthquake/i,
    }
    const need = mention[config.target]
    if (need && !need.test(text)) out.push(`the prompt does not say what to make: the learner cannot tell the aim from the card -- name it ("${example}")`)
    return out
  },

  initial() {
    return { dir: null, step: 0 }
  },

  check(config, state) {
    return { ok: done(config, state), wrongIds: [] }
  },

  solve(config) {
    return { dir: solutions(config)[0] ?? 'together', step: RUN }
  },

  View: TectonicsView,

  prompt: `SCENE "tectonics" -- a cross-section of two tectonic plates on a quiet light panel, in real rock colours: dark basalt ocean crust, layered sandstone and granite continent, stiff mantle under each plate and hot orange mantle below. The learner presses one of three movements (pull the plates apart, slide them past each other, push them together) and steps time on with a stepper (0 to 4); the section answers at once, and eases over a second: a plate bends down into the mantle and cones of rock rise, ground heaves up and crumples, a block drops, or dark new floor fills a gap. Red dots mark earthquakes, orange is magma. Labels name only the parts (sea, oceanic crust, continental crust, mantle); what was made (trench, fold mountains, rift valley, ridge, volcanoes, fault line) is named on the picture only once marked.
  For: plate tectonics, plate boundaries, earthquakes and volcanoes, fold mountains, rift valleys, ocean trenches, mid-ocean ridges, island arcs, the structure of the Earth, forms of relief. It answers "separating plates leave an empty gap", "all mountains are volcanoes", "earthquakes happen when plates suddenly crash together" and "the same thing makes every mountain range".
  landform: the learner makes a named landform. target: trench (ocean under ocean or continent, together), island-arc (two ocean plates, together), volcanic-mountains (ocean and continent, together), fold-mountains (two continents, together), rift-valley (two continents, apart) or ridge (ocean plates apart).
  hazard: the learner makes the plates that cause a mix of hazards. target: deep-earthquakes (a sinking plate; ocean with ocean or continent), volcanoes-shallow-quakes (plates pulled apart) or quakes-no-volcanoes (plates sliding past, or two continents pushed together).
  left, right: the two crusts, "ocean" or "continent" (the section is always one real kind of meeting; an ocean next to a continent may be written either way round). Optional: each target has a pair it needs, and is given it when these are left out.
  Not drawn: a map or globe, hot spots, tsunamis, earthquake magnitude or damage, seismic waves, how plates are driven (convection, ridge push, slab pull). Do not use it for the weather, rivers or coasts, for earthquake-proof building design, or for reading maps.
  Before marking the card shows the part labels, a short key (red dot earthquake, orange magma), and the section moving as the learner chooses. It holds back what the movement is called and what it makes. The prompt must ask for the result only: do NOT say which way the plates move, that one sinks, collides, converges, diverges or slides past, or give the type of boundary.
  config: { "task":"landform", "left":"ocean", "right":"continent", "target":"trench" }  -- the prompt says "Choose how the two plates move, then step the time on, to make a deep ocean trench."
       or { "task":"landform", "left":"continent", "right":"continent", "target":"fold-mountains" }  -- the prompt says "Choose how the two plates move, then step the time on, to raise a range of fold mountains."
       or { "task":"hazard", "left":"ocean", "right":"continent", "target":"deep-earthquakes" }  -- the prompt says "Choose how the two plates move, then step the time on, so that earthquakes start deep below the surface."
       or { "task":"hazard", "left":"continent", "right":"continent", "target":"quakes-no-volcanoes" }  -- the prompt says "Choose how the two plates move, then step the time on, so that earthquakes strike but no volcano erupts."
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Choose how the two plates move, then step the time on, to make a deep ocean trench.",
    "payload": { "engine":"tectonics", "config": { "task":"landform", "left":"ocean", "right":"continent", "target":"trench" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:tectonics", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Choose how the two plates move, then step the time on, so that earthquakes strike but no volcano erupts.",
    "payload": { "engine":"tectonics", "config": { "task":"hazard", "left":"continent", "right":"continent", "target":"quakes-no-volcanoes" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:tectonics", "why":"..." } }`,
}

registerEngine(tectonicsEngine as SceneEngine<unknown, unknown>)
