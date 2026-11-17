'use client'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { SceneViewProps } from '../types'
import type { Arm, Muscle, MuscleConfig, MuscleState } from './config'
import { done, madeText, pullingText, readArm, skeletonMusclesEngine, toggle, working } from './config'

type Props = SceneViewProps<MuscleConfig, MuscleState>
type P = { x: number; y: number }

// An arm is not a dark subject: a quiet plate, as measure-shape's and network-sim's are, with the anatomy drawn on it in
// its own material colours, kept the same in both themes. Flat colours only: no gradients, glows or shadows.
const PLATE = '#F8FAFC'
const PLATE_EDGE = '#CBD5E1'
const SOFT = '#475569'
const FONT = 'system-ui, sans-serif'
// Bone: ivory with a warm brown edge; the shoulder blade a shade paler, as it lies further back. Cartilage bluish white.
const BONE = '#F2EADA'
const BONE_BACK = '#F6F1E6'
const BONE_EDGE = '#9C8660'
const BONE_LINE = '#DDCFB2'
const CART = '#DCE7EE'
// Tendon and ligament: silvery white cords and bands.
const TENDON = '#F5F3EC'
const TENDON_EDGE = '#8E99A6'
const LIG = '#DCE3EA'
const LIG_EDGE = '#7D8C9D'
const LIG_LINE = '#A9B5C2'
// Muscle: soft and pale when relaxed, firm deep red when contracted.
export const RELAXED = { fill: '#E5A397', edge: '#AE6358', fibre: '#C7806F', sheen: '#F1C9C1' }
export const TIGHT = { fill: '#B8463C', edge: '#76231D', fibre: '#8C2C25', sheen: '#D27064' }

export const W = 360
export const H = 252
/** The anatomy is drawn in its own units and set on the plate by this: a little larger, the shoulder blade cropped at the edge. */
export const K = 1.1
export const OX = -29
export const OY = 12
/** The shoulder joint (centre of the ball) and the elbow hinge, in anatomy units. The upper arm lies level between them. */
export const S: P = { x: 62, y: 150 }
export const E: P = { x: 180, y: 150 }
/** How far the forearm swings up from straight, in degrees: an elbow bent to about 70 degrees, the "make a muscle" pose. */
export const BENT_DEG = 110
/** A full swing of the forearm takes about a second; a muscle darkens or pales in a third of one. */
export const SWING_MS = 1000
export const SQUEEZE_MS = 340

const f1 = (n: number) => n.toFixed(1)
const add = (a: P, b: P): P => ({ x: a.x + b.x, y: a.y + b.y })
const sub = (a: P, b: P): P => ({ x: a.x - b.x, y: a.y - b.y })
const mul = (a: P, k: number): P => ({ x: a.x * k, y: a.y * k })
const len = (a: P) => Math.hypot(a.x, a.y)
const unit = (a: P): P => mul(a, 1 / (len(a) || 1))
const pt = (x: number, y: number): P => ({ x, y })
const rad = (deg: number) => (deg * Math.PI) / 180
/** Anatomy units to the plate's. */
export const toPlate = (p: P): P => ({ x: OX + K * p.x, y: OY + K * p.y })

/** A point fixed to the forearm (x along it from the elbow, y towards its back), where it is when the forearm is up `deg` degrees. */
export function onForearm(p: P, deg: number): P {
  const a = rad(deg)
  return { x: E.x + p.x * Math.cos(a) + p.y * Math.sin(a), y: E.y - p.x * Math.sin(a) + p.y * Math.cos(a) }
}

/** A smooth closed (or open) outline through the points: Catmull-Rom, written as cubic Beziers. */
function smooth(pts: P[], closed = true): string {
  const n = pts.length
  const at = (i: number) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))])
  let d = `M${f1(pts[0].x)} ${f1(pts[0].y)}`
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const p0 = at(i - 1)
    const p1 = at(i)
    const p2 = at(i + 1)
    const p3 = at(i + 2)
    const c1 = add(p1, mul(sub(p2, p0), 1 / 6))
    const c2 = sub(p2, mul(sub(p3, p1), 1 / 6))
    d += ` C${f1(c1.x)} ${f1(c1.y)} ${f1(c2.x)} ${f1(c2.y)} ${f1(p2.x)} ${f1(p2.y)}`
  }
  return closed ? `${d}Z` : d
}
const line = (pts: P[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${f1(p.x)} ${f1(p.y)}`).join('')
const fromS = (list: [number, number][]) => list.map(([x, y]) => pt(S.x + x, S.y + y))
const local = (list: [number, number][]) => list.map(([x, y]) => pt(x, y))

/** A slender bone from p to q, knobbed at both ends and narrower in its shaft. */
function boneSeg(p: P, q: P, end: number, waist: number): string {
  const u = unit(sub(q, p))
  const n = pt(-u.y, u.x)
  const m = mul(add(p, q), 0.5)
  return smooth([
    sub(p, mul(u, end * 0.8)), add(p, mul(n, end)), add(m, mul(n, waist)), add(q, mul(n, end * 0.92)),
    add(q, mul(u, end * 0.75)), sub(q, mul(n, end * 0.92)), sub(m, mul(n, waist)), sub(p, mul(n, end)),
  ])
}

// ---------------------------------------------------------------------------
// The bones, after the standard anatomy plates, seen from the front with the arm raised level. Shoulder parts are
// written from the shoulder joint S; forearm parts from the elbow, along the forearm, and turned with it.

/** Shoulder blade: its socket (a shallow cup facing the ball), the neck, and the edge of its blade, cropped at the plate. */
const SCAPULA = smooth(fromS([
  [-11.2, -9.6], [-15.5, -12.6], [-22, -13.6], [-34, -14], [-34, 62], [-30.5, 48], [-24.5, 31], [-18, 17], [-12.4, 10.8], [-13.9, 5.1], [-14.8, 0], [-13.9, -5.1],
]))
const SCAPULA_LINES = [line(fromS([[-21, 19], [-27, 34], [-31.5, 50]]))]
/** The hook in front, the coracoid, where the biceps' short head is fastened. */
const CORACOID = smooth(fromS([[-26, -10], [-24.6, -16.4], [-18.6, -20.2], [-11, -20.2], [-6, -18], [-7.2, -15.4], [-13, -15.8], [-19.4, -14], [-21.6, -10.4]]))
const ACROMION = smooth(fromS([[-13, -22.6], [-4, -26.6], [6.4, -27], [13.6, -24], [16, -19.6], [12.4, -18.2], [4, -20.6], [-5, -20.6], [-12, -19.4]]))
/** The collar bone, rising from the acromion towards the neck in its long S. */
const CLAVICLE = smooth(fromS([[-35, -59.4], [-26, -54], [-15, -46.2], [-5, -38], [3, -33], [7.4, -29.6], [4.6, -26.8], [-2, -29.4], [-11, -36], [-21, -44.4], [-30, -50.6], [-35, -52.6]]))

const HUMERUS = smooth(fromS([
  [-13.3, 0], [-12, -6], [-7.5, -11], [0, -13.4], [7, -12.8], [12.5, -12], [16, -10.8], [19.5, -8.6], [25, -7.6], [36, -6.6], [62, -6.1], [86, -6.5], [98, -7.8], [106, -9.8],
  [112, -10.2], [115, -8.6], [122.5, -7.8], [126.6, -3], [126.6, 3], [122.5, 7.8], [116, 9.4], [109, 10.6], [102, 9.6], [94, 7.6], [80, 6.5], [56, 6.2], [36, 6.8], [25, 8.2],
  [17, 10.8], [10, 12.6], [2, 13.4], [-6.5, 11.6], [-11.5, 6.6],
]))
/** The cartilage on the ball, where it turns in the socket, and the line round the ball's edge. */
const HEAD_CART = `M${f1(S.x - 6.4)} ${f1(S.y - 10.4)} A 12.2 12.2 0 0 0 ${f1(S.x - 6.4)} ${f1(S.y + 10.4)}`
const HUMERUS_LINES = [
  `M${f1(S.x + 7)} ${f1(S.y - 12.6)} Q ${f1(S.x + 1.6)} ${f1(S.y)} ${f1(S.x + 6.4)} ${f1(S.y + 12.8)}`,
  line(fromS([[32, 2.2], [64, 1.8], [94, 2.6]])),
  line(fromS([[103, -5], [109, -2.4], [110, 2.6]])),
]

const ULNA = smooth(local([
  [9.65, 1.7], [6.3, 7.5], [0, 9.8], [-6.3, 7.5], [-9.5, 2.5], [-9.6, -1.7], [-13, -2.6], [-16.4, 0.6], [-16.2, 6.8], [-12.4, 12.4], [-4, 14.6],
  [10, 13], [30, 10.6], [60, 9.2], [84, 8.7], [91, 8.9], [95.6, 10.6], [98.6, 8.2], [97.4, 4], [92, 2.9], [70, 3.7], [40, 4.6], [22, 5.5], [15.6, 4.8], [12.2, 3.4],
]))
const RADIUS = smooth(local([
  [10.4, -10.8], [12.6, -11.9], [15.6, -11.6], [17.2, -9.8], [19.6, -8.2], [23, -9.5], [27.4, -9.1], [36, -7.8], [60, -7.6], [80, -8.6], [90, -10.6],
  [95, -12.2], [99.2, -12], [101.6, -8], [100.2, -3], [96, -0.7], [88, -1.5], [70, -2.4], [40, -2.4], [24, -2.7], [17, -2.3], [14.4, -1.3], [10.9, -1.5], [9.3, -6],
]))
const FOREARM_LINES = [line(local([[30, 7.4], [60, 6.5], [86, 6]])), line(local([[32, -5], [62, -5], [88, -6.4]])), line(local([[10.8, -6.2], [15.4, -6.6]]))]
/** The cartilage lining the ulna's notch, which wraps round the end of the humerus: the hinge. */
const NOTCH_CART = `M 9.2 1.6 A 9.4 9.4 0 0 1 -9.1 -1.6`

const CARPALS: [number, number, number, number][] = [
  [101.6, -8.6, 3.4, 2.9], [102.7, -2.6, 3.3, 3], [102.3, 3.4, 3, 2.8], [107.7, -6.6, 3, 2.7], [108.5, -0.8, 3.1, 2.9], [107.5, 4.8, 2.7, 2.5],
]
type Finger = { base: P; tip: P; segs: number[]; curl: number[] }
const FINGERS: Finger[] = [
  // Drawn back to front: ring, middle, index, closed in a loose fist.
  { base: pt(111.6, 4.4), tip: pt(134.4, 4.8), segs: [11, 7, 5.6], curl: [-1, -1.15, -0.65] },
  { base: pt(112, -1.2), tip: pt(138.6, -1.8), segs: [13, 8.2, 6.2], curl: [-0.95, -1.15, -0.65] },
  { base: pt(111.6, -6.6), tip: pt(136.4, -8.6), segs: [12.4, 7.8, 6], curl: [-0.95, -1.15, -0.65] },
]
/** The joints of a finger, knuckle to tip: where each of its bones starts and ends. */
function fingerJoints(f: Finger): [P, P][] {
  const out: [P, P][] = [[f.base, f.tip]]
  let at = add(f.tip, mul(unit(sub(f.tip, f.base)), 1.4))
  let ang = Math.atan2(f.tip.y - f.base.y, f.tip.x - f.base.x)
  for (let i = 0; i < f.segs.length; i++) {
    ang += f.curl[i]
    const dir = pt(Math.cos(ang), Math.sin(ang))
    const to = add(at, mul(dir, f.segs[i]))
    out.push([at, to])
    at = add(to, mul(dir, 1.2))
  }
  return out
}
const THUMB: [P, P][] = [[pt(104.5, -10.6), pt(115.4, -17.4)], [pt(116.8, -18.2), pt(125, -23)], [pt(126.4, -23.8), pt(132.4, -26)]]
const BONES_OF_HAND: [P, P][] = [...FINGERS.flatMap(fingerJoints), ...THUMB]
/** Every hand bone's ends, in forearm units, for the test that keeps the hand on the plate. */
export const HAND_POINTS: P[] = BONES_OF_HAND.flat()
const HAND = BONES_OF_HAND.map(([p, q], i) => {
  const finger = i % 4
  const thumb = i >= FINGERS.length * 4
  return boneSeg(p, q, thumb ? 2.4 - 0.25 * (i - FINGERS.length * 4) : finger === 0 ? 2.5 : finger === 3 ? 1.9 : 2.1, finger === 0 && !thumb ? 1.5 : 1.35)
})

/** The elbow's ligament: a band from the humerus, fastened at the hinge, fanning onto both forearm bones. It turns with the forearm. */
const LIGAMENT = smooth(local([[-3.4, -1.8], [0, -3.4], [8, -4], [15.4, -5], [17.4, -2], [17.8, 3.4], [16, 6.4], [8, 4.6], [0, 3.2], [-3.4, 1.6]]))
const LIGAMENT_LINES = [line(local([[0, -1.6], [15.4, -3.4]])), line(local([[0.4, 0.2], [16.6, 1]])), line(local([[0, 1.8], [14.6, 5]]))]
/** The forearm and hand's outline, in forearm units, round every bone of them. Drawn faint and dashed where the goal wants
 * the forearm, it is the shape the real one swings into. */
export const FOREARM_HULL: [number, number][] = [
  [-16.4, 3], [-13, -4], [-4, -11.6], [10, -12.6], [20, -10.6], [40, -8.6], [70, -9.4], [92, -11.4], [100, -13.2], [108, -13], [116, -18.6], [124, -24.4], [131, -31],
  [138, -33.6], [145.4, -30], [150.6, -21], [151.8, -10], [148.6, 0], [142, 6.8], [134, 8.2], [120, 8.4], [110, 8.6], [100, 11], [90, 11], [60, 10.6], [30, 12.2], [10, 15.4], [-6, 15.6],
]
const GHOST = smooth(local(FOREARM_HULL))
const GHOST_EDGE = '#8A99AB'
const GHOST_FILL = '#EDF1F5'
const GHOST_WORD_INK = '#64748B'
/** Where the goal's word sits, by the hand of the goal outline, in forearm units. */
export const GHOST_WORD = pt(112, -30)

/** Where the ligament is, for its label's leader line. */
export const LIGAMENT_MID = pt(12, 0.6)

// ---------------------------------------------------------------------------
// The muscles. Each is a belly between tendons that do not stretch: the belly is whatever length is left, and keeps
// its volume, so when it is shorter it is fatter. Contracted, it is firm and stands up rounder.

export type MuscleSpec = {
  /** Where its tendons start on the shoulder blade (curving through `via`), and where the belly begins. */
  origins: { from: P; via: P }[]
  A: P
  /** The insertion on the forearm, in forearm coordinates. */
  insert: P
  /** The tendon between the belly and the insertion. */
  tendon: number
  /** Belly thickness when relaxed at its longest. */
  thick: number
  longest: number
  /** Which side the belly bulges to: away from the bone. */
  out: P
  /** Where along the belly it is fattest, 0 to 1. */
  peak: number
  /** How wide the tendons are, and how far back from its end the distal tendon runs over the belly. */
  cord: number
  sheet: number
  rise: number
}

export const BICEPS: MuscleSpec = {
  // Two heads, hence its name: the long head over the ball of the shoulder to the top of the socket, the short head
  // to the coracoid hook in front.
  origins: [{ from: add(S, pt(-11.4, -10.6)), via: add(S, pt(3, -16.4)) }, { from: add(S, pt(-6.4, -17.2)), via: add(S, pt(8, -21)) }],
  A: add(S, pt(22, -8.5)),
  insert: pt(23, -9.6),
  tendon: 12,
  thick: 15,
  longest: 106,
  out: pt(0, -1),
  peak: 0.58,
  cord: 3.4,
  sheet: 0.88,
  rise: 0.08,
}
export const TRICEPS: MuscleSpec = {
  // The long head, from just under the socket; the triceps' broad tendon spreads far up its back before the point of the elbow.
  origins: [{ from: add(S, pt(-13, 13.4)), via: add(S, pt(2, 15)) }],
  A: add(S, pt(16, 8)),
  insert: pt(-14.6, 3.6),
  tendon: 8,
  thick: 14,
  longest: 104,
  out: pt(0, 1),
  peak: 0.42,
  cord: 4.6,
  sheet: 0.8,
  rise: 0.07,
}

export type MuscleGeo = {
  belly: string; fibres: string[]; sheen: string; sheets: string[]; tendons: string[]; foot: { at: P; deg: number }; cord: number
  centre: P; top: number; bottom: number; left: number; right: number; length: number; thick: number
}

/** The muscle drawn for a forearm `deg` degrees up and an activation from 0 (relaxed) to 1 (contracted), in anatomy units. */
export function muscleGeo(spec: MuscleSpec, deg: number, act: number): MuscleGeo {
  const I = onForearm(spec.insert, deg)
  const u = unit(sub(I, spec.A))
  const reach = len(sub(I, spec.A))
  const L = Math.max(30, reach - spec.tendon)
  const B = add(spec.A, mul(u, L))
  let n = pt(-u.y, u.x)
  if (n.x * spec.out.x + n.y * spec.out.y < 0) n = mul(n, -1)
  // Volume kept: thickness goes as one over length. Contracted, the fibres are firm, so it stands a little taller.
  const T = spec.thick * (spec.longest / L) * (1 + 0.14 * act)
  // It lies on the bone: nearly all of it stands out on the far side.
  const outer = T * (0.8 + 0.04 * act)
  const inner = T * (0.2 - 0.04 * act)
  const k = Math.log(0.5) / Math.log(spec.peak)
  // Relaxed it is a soft spindle; contracted it stands up in a rounder mound.
  const p = 1.15 - 0.4 * act
  const shape = (t: number) => Math.pow(Math.sin(Math.PI * Math.pow(Math.min(1, Math.max(0, t)), k)), p)
  const END = spec.cord / 2
  const mid = (t: number) => add(spec.A, mul(u, L * t))
  /** A point at fraction t along the belly, `side` of the way to its outer (1) or inner (-1) edge. */
  const at = (t: number, side: number) => add(mid(t), mul(n, side * ((side >= 0 ? outer : inner) * shape(t) + END)))
  const N = 36
  const ts = Array.from({ length: N + 1 }, (_, i) => i / N)
  const outerEdge = ts.map((t) => at(t, 1))
  const innerEdge = ts.map((t) => at(t, -1)).reverse()
  const belly = smooth([...outerEdge.slice(0, -1), ...innerEdge.slice(0, -1)])
  const fibreAt = (kk: number) => line(ts.filter((t) => t > 0.04 && t < 0.96).map((t) => at(t, kk)))
  const fibres = [-0.6, -0.2, 0.15, 0.42, 0.68].map(fibreAt)
  const sheen = line(ts.filter((t) => t > 0.22 && t < 0.66).map((t) => at(t, 0.82)))
  // The tendon runs on along the belly's bone side as a pale sheet, thinning away from each end.
  const sheet = (t0: number, t1: number, rise: number) => {
    const ss = Array.from({ length: 13 }, (_, i) => i / 12)
    const upper = ss.map((s) => { const t = t0 + (t1 - t0) * s; return add(mid(t), mul(n, (END + rise * outer * shape(t)) * Math.pow(1 - s, 0.8))) })
    const lower = ss.map((s) => at(t0 + (t1 - t0) * s, -1))
    return smooth([...upper, ...lower.reverse()])
  }
  const sheets = [sheet(0, 0.1, 0.08), sheet(1, spec.sheet, spec.rise)]
  const tendons = [...spec.origins.map((o) => `M${f1(o.from.x)} ${f1(o.from.y)} Q${f1(o.via.x)} ${f1(o.via.y)} ${f1(spec.A.x)} ${f1(spec.A.y)}`), line([B, I])]
  const all = [...outerEdge, ...innerEdge]
  const xs = all.map((q) => q.x)
  const ys = all.map((q) => q.y)
  return {
    belly, fibres, sheen, sheets, tendons, cord: spec.cord, foot: { at: I, deg: (Math.atan2(u.y, u.x) * 180) / Math.PI },
    centre: mid(spec.peak), top: Math.min(...ys), bottom: Math.max(...ys), left: Math.min(...xs), right: Math.max(...xs), length: L, thick: T,
  }
}

const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16))
const mix = (a: string, b: string, t: number) => `rgb(${hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * t)).join(',')})`
const tone = (act: number) => ({
  fill: mix(RELAXED.fill, TIGHT.fill, act), edge: mix(RELAXED.edge, TIGHT.edge, act), fibre: mix(RELAXED.fibre, TIGHT.fibre, act), sheen: mix(RELAXED.sheen, TIGHT.sheen, act),
})

function MuscleMark({ geo, act, id }: { geo: MuscleGeo; act: number; id: string }) {
  const c = tone(act)
  return (
    <g data-muscle={id} data-act={act.toFixed(2)} data-length={geo.length.toFixed(1)} data-thick={geo.thick.toFixed(1)}>
      {/* the tendons: a pale cord with a darker edge */}
      {geo.tendons.map((d, i) => <path key={`e${i}`} d={d} fill="none" stroke={TENDON_EDGE} strokeWidth={geo.cord + 1.8} strokeLinecap="round" />)}
      {geo.tendons.map((d, i) => <path key={`c${i}`} d={d} fill="none" stroke={TENDON} strokeWidth={geo.cord} strokeLinecap="round" />)}
      {/* where the tendon is fastened to the bone: it spreads a little as it grips */}
      <ellipse cx={0} cy={0} rx={3.6} ry={geo.cord / 2 + 1.1} fill={TENDON} stroke={TENDON_EDGE} strokeWidth={1} transform={`translate(${f1(geo.foot.at.x)} ${f1(geo.foot.at.y)}) rotate(${f1(geo.foot.deg)}) translate(-1 0)`} />
      <path d={geo.belly} fill={c.fill} stroke={c.edge} strokeWidth={1.4} strokeLinejoin="round" />
      {geo.fibres.map((d, i) => <path key={i} d={d} fill="none" stroke={c.fibre} strokeWidth={0.85} strokeLinecap="round" />)}
      <path d={geo.sheen} fill="none" stroke={c.sheen} strokeWidth={1.8} strokeLinecap="round" />
      {geo.sheets.map((d, i) => <path key={i} d={d} fill={TENDON} stroke={TENDON_EDGE} strokeWidth={0.7} strokeLinejoin="round" />)}
    </g>
  )
}

// ---------------------------------------------------------------------------
// The labels, in plate units: fixed places clear of the arm in both poses, each with a hairline to its part where it is
// not right beside it.

export type Label = { text: string; x: number; y: number; anchor: 'start' | 'middle' | 'end'; from?: P; to?: (deg: number) => P }
export const LABELS: Label[] = [
  { text: 'biceps', x: 98, y: 122, anchor: 'middle' },
  { text: 'triceps', x: 122, y: 226, anchor: 'middle' },
  { text: 'tendon', x: 12, y: 112, anchor: 'start', from: pt(38, 116), to: () => toPlate(add(S, pt(5, -16.6))) },
  { text: 'ball and socket joint', x: 10, y: 243, anchor: 'start', from: pt(28, 233), to: () => toPlate(add(S, pt(-6, 14))) },
  { text: 'hinge joint', x: 200, y: 230, anchor: 'start', from: pt(204, 220), to: (deg) => toPlate(onForearm(pt(-4, 11), deg)) },
  { text: 'ligament', x: 240, y: 208, anchor: 'start', from: pt(244, 198), to: (deg) => toPlate(onForearm(LIGAMENT_MID, deg)) },
]
const textWidth = (s: string) => s.length * 6.6
/** The box each label's words take, for the overlap tests. */
export const labelBox = (l: Label) => {
  const w = textWidth(l.text)
  const left = l.anchor === 'start' ? l.x : l.anchor === 'end' ? l.x - w : l.x - w / 2
  return { left, right: left + w, top: l.y - 10, bottom: l.y + 3 }
}

function Labels({ deg }: { deg: number }) {
  const led = LABELS.filter((l) => l.to && l.from)
  return (
    <g aria-hidden="true" fontFamily={FONT} pointerEvents="none">
      {led.map((l) => {
        const to = l.to!(deg)
        return (
          <g key={`l${l.text}`}>
            <line x1={l.from!.x} y1={l.from!.y} x2={f1(to.x)} y2={f1(to.y)} stroke={SOFT} strokeWidth={1} strokeLinecap="round" />
            <circle cx={f1(to.x)} cy={f1(to.y)} r={1.8} fill={SOFT} />
          </g>
        )
      })}
      {LABELS.map((l) => (
        <text key={l.text} x={l.x} y={l.y} textAnchor={l.anchor} fontSize={12} fontWeight={700} fill={SOFT} stroke={PLATE} strokeWidth={3} paintOrder="stroke" strokeLinejoin="round">{l.text}</text>
      ))}
    </g>
  )
}

// ---------------------------------------------------------------------------
// Motion: the forearm swings and the muscles darken or pale, each eased, and each picking up from where it is.

function useEased(target: number, ms: number, reduced: boolean): number {
  const [value, setValue] = useState(target)
  const now = useRef(target)
  useEffect(() => {
    if (reduced) {
      now.current = target
      setValue(target)
      return
    }
    const from = now.current
    if (Math.abs(from - target) < 1e-3) return
    const start = performance.now()
    let raf = 0
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / ms)
      now.current = from + (target - from) * (0.5 - 0.5 * Math.cos(Math.PI * k))
      setValue(now.current)
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, ms, reduced])
  return reduced ? target : value
}

const goalText = (config: MuscleConfig) => (config.task === 'both' ? 'Bend, then straighten' : config.to === 'bend' ? 'Bend the arm' : 'Straighten the arm')

function describe(arm: Arm): string {
  const state = (on: boolean) => (on ? 'contracted' : 'relaxed')
  return `An arm with its bones and muscles, the elbow ${arm.pose}. The biceps, on top of the upper arm, is ${state(arm.flexor)}; the triceps, underneath, is ${state(arm.extensor)}. ${pullingText(arm)}`
}

/** A small muscle beside each state's name, so the two colours and shapes are named on the card. */
function Swatch({ on }: { on: boolean }) {
  const c = on ? TIGHT : RELAXED
  return (
    <svg viewBox="0 0 22 12" className="h-3 w-[22px] shrink-0" aria-hidden="true">
      <path d="M1 6 H5" stroke={TENDON_EDGE} strokeWidth={1.6} strokeLinecap="round" />
      <path d="M17 6 H21" stroke={TENDON_EDGE} strokeWidth={1.6} strokeLinecap="round" />
      {on
        ? <path d="M5 6 C 6 0.6, 16 0.6, 17 6 C 16 11.4, 6 11.4, 5 6 Z" fill={c.fill} stroke={c.edge} strokeWidth={1} />
        : <path d="M2 6 C 5 3.4, 17 3.4, 20 6 C 17 8.6, 5 8.6, 2 6 Z" fill={c.fill} stroke={c.edge} strokeWidth={1} />}
    </svg>
  )
}

const SEG = 'nodrag flex h-7 select-none items-center gap-1 whitespace-nowrap rounded-lg border-2 px-2 text-[13px] font-bold leading-none touch-manipulation transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-not-allowed motion-reduce:transition-none'

function MuscleRow({ name, on, locked, set }: { name: string; on: boolean; locked: boolean; set(next: boolean): void }) {
  const look = (active: boolean) => (active ? 'border-[color:var(--subject)] bg-ss-chip text-ss-ink' : 'border-ss-line bg-ss-panel text-ss-slate hover:border-[color:var(--subject)]')
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="whitespace-nowrap text-[12px] font-bold text-ss-slate">{name[0].toUpperCase() + name.slice(1)}</span>
      <span className="flex items-center gap-1" role="group" aria-label={`The ${name}`}>
        <button type="button" aria-pressed={!on} aria-label={`Relax the ${name}`} disabled={locked} onClick={() => on && set(false)} className={`${SEG} ${look(!on)}`}><Swatch on={false} />Relaxed</button>
        <button type="button" aria-pressed={on} aria-label={`Contract the ${name}`} disabled={locked} onClick={() => !on && set(true)} className={`${SEG} ${look(on)}`}><Swatch on />Contracted</button>
      </span>
    </div>
  )
}

export function SkeletonMusclesView({ config, state, setState, marked, reduced, locked }: Props) {
  const shown = marked === 'shown' ? skeletonMusclesEngine.solve(config) : state
  const arm = readArm(config, shown)
  const deg = useEased(arm.pose === 'bent' ? BENT_DEG : 0, SWING_MS, reduced)
  const flexAct = useEased(arm.flexor ? 1 : 0, SQUEEZE_MS, reduced)
  const extAct = useEased(arm.extensor ? 1 : 0, SQUEEZE_MS, reduced)
  const biceps = muscleGeo(BICEPS, deg, flexAct)
  const triceps = muscleGeo(TRICEPS, deg, extAct)
  const frozen = locked || marked === 'right' || marked === 'shown'
  // The goal, as the angle the forearm should reach: for "both", bent until it has been, then straight again.
  const goalDeg = config.task === 'both' ? (arm.wasBent ? 0 : BENT_DEG) : config.to === 'bend' ? BENT_DEG : 0
  // Shown until the forearm is there: then the real one covers it.
  const ghost = frozen || Math.abs(deg - goalDeg) < 1 ? null : goalDeg

  const tap = (m: Muscle) => {
    if (frozen) return
    setState(toggle(config, shown, m))
  }
  const set = (m: Muscle) => (next: boolean) => {
    if (frozen || arm[m] === next) return
    setState(toggle(config, shown, m))
  }
  // The board moves cards with the arrow keys; inside the card they belong to the card.
  const onKey = (e: KeyboardEvent) => { if (e.key.startsWith('Arrow')) e.stopPropagation() }

  const said = marked === 'right' || marked === 'shown' ? working(config) : marked === 'wrong' ? madeText(config, shown) : ''
  const lead = said.match(/^(Yes\.\s[^.]*\.)\s*(.*)$/)
  const forearm = `translate(${f1(E.x)} ${f1(E.y)}) rotate(${f1(-deg)})`
  /** A see-through button over each belly, so a tap on the muscle itself squeezes it. The rows below are the keyboard way. */
  const hit = (g: MuscleGeo, m: Muscle) => {
    const a = toPlate(pt(g.left, g.top))
    const b = toPlate(pt(g.right, g.bottom))
    const w = Math.max(30, b.x - a.x)
    const h = Math.max(24, b.y - a.y + 4)
    return (
      <button
        key={m} type="button" tabIndex={-1} aria-hidden="true" data-tap={m} disabled={frozen} onClick={() => tap(m)}
        className="nodrag absolute touch-manipulation rounded-xl outline-none hover:ring-2 hover:ring-[color:var(--subject)]"
        style={{
          left: `${(((a.x + b.x) / 2) / W) * 100}%`, top: `${(((a.y + b.y) / 2) / H) * 100}%`, width: `${(w / W) * 100}%`, height: `${(h / H) * 100}%`,
          transform: 'translate(-50%, -50%)', border: 'none', background: 'transparent', padding: 0, cursor: frozen ? 'default' : 'pointer',
        }}
      />
    )
  }

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-2" onKeyDown={onKey}>
      <figure className="m-0 flex w-full flex-col gap-1.5">
        <div className="relative w-full">
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={describe(arm)} className="block h-auto w-full select-none">
            <defs>
              <clipPath id="skm-plate"><rect x={0.75} y={0.75} width={W - 1.5} height={H - 1.5} rx={16} /></clipPath>
            </defs>
            <rect x={0.75} y={0.75} width={W - 1.5} height={H - 1.5} rx={16} fill={PLATE} />
            <g clipPath="url(#skm-plate)">
              <g transform={`translate(${OX} ${OY}) scale(${K})`}>
                {/* shoulder blade, its socket, coracoid hook and acromion roof, and the collar bone */}
                <path d={SCAPULA} fill={BONE_BACK} stroke={BONE_EDGE} strokeWidth={1.3} strokeLinejoin="round" />
                {SCAPULA_LINES.map((d, i) => <path key={i} d={d} fill="none" stroke={BONE_LINE} strokeWidth={1.6} strokeLinecap="round" />)}
                <path d={CORACOID} fill={BONE} stroke={BONE_EDGE} strokeWidth={1.3} strokeLinejoin="round" />
                <path d={CLAVICLE} fill={BONE} stroke={BONE_EDGE} strokeWidth={1.3} strokeLinejoin="round" />
                <path d={ACROMION} fill={BONE} stroke={BONE_EDGE} strokeWidth={1.3} strokeLinejoin="round" />
                {/* the upper arm bone, its ball in the socket */}
                <path d={HUMERUS} fill={BONE} stroke={BONE_EDGE} strokeWidth={1.3} strokeLinejoin="round" />
                <path d={HEAD_CART} fill="none" stroke={CART} strokeWidth={2.6} strokeLinecap="round" />
                {HUMERUS_LINES.map((d, i) => <path key={i} d={d} fill="none" stroke={BONE_LINE} strokeWidth={1.5} strokeLinecap="round" />)}
                {/* where the goal wants the forearm */}
                {ghost !== null && (
                  <path d={GHOST} transform={`translate(${f1(E.x)} ${f1(E.y)}) rotate(${f1(-ghost)})`} fill={GHOST_FILL} stroke={GHOST_EDGE} strokeWidth={1.3} strokeDasharray="5 4" strokeLinejoin="round" data-ghost={ghost} />
                )}
                {/* the forearm and hand, turning on the hinge */}
                <g transform={forearm} data-forearm={deg.toFixed(1)}>
                  {HAND.map((d, i) => <path key={i} d={d} fill={BONE} stroke={BONE_EDGE} strokeWidth={1.05} strokeLinejoin="round" />)}
                  {CARPALS.map(([cx, cy, rx, ry], i) => <ellipse key={i} cx={cx} cy={cy} rx={rx} ry={ry} fill={BONE} stroke={BONE_EDGE} strokeWidth={1.05} />)}
                  <path d={ULNA} fill={BONE} stroke={BONE_EDGE} strokeWidth={1.3} strokeLinejoin="round" />
                  <path d={NOTCH_CART} fill="none" stroke={CART} strokeWidth={2.2} strokeLinecap="round" />
                  <path d={RADIUS} fill={BONE} stroke={BONE_EDGE} strokeWidth={1.3} strokeLinejoin="round" />
                  {FOREARM_LINES.map((d, i) => <path key={i} d={d} fill="none" stroke={BONE_LINE} strokeWidth={1.4} strokeLinecap="round" />)}
                  <path d={LIGAMENT} fill={LIG} stroke={LIG_EDGE} strokeWidth={1} strokeLinejoin="round" />
                  {LIGAMENT_LINES.map((d, i) => <path key={i} d={d} fill="none" stroke={LIG_LINE} strokeWidth={0.8} strokeLinecap="round" />)}
                </g>
                <MuscleMark geo={triceps} act={extAct} id="extensor" />
                <MuscleMark geo={biceps} act={flexAct} id="flexor" />
              </g>
              <Labels deg={deg} />
              {ghost !== null && (() => {
                const at = toPlate(onForearm(GHOST_WORD, ghost))
                return <text x={f1(at.x)} y={f1(at.y)} textAnchor="middle" fontFamily={FONT} fontSize={12} fontWeight={700} fill={GHOST_WORD_INK} stroke={PLATE} strokeWidth={3} paintOrder="stroke" aria-hidden="true">goal</text>
              })()}
            </g>
            <rect x={0.75} y={0.75} width={W - 1.5} height={H - 1.5} rx={16} fill="none" stroke={PLATE_EDGE} strokeWidth={1.5} />
          </svg>
          {!frozen && [hit(triceps, 'extensor'), hit(biceps, 'flexor')]}
        </div>
        <figcaption className="text-center text-[12px] font-bold leading-snug text-ss-slate" data-pulling>{pullingText(arm)}</figcaption>
      </figure>

      <div className="flex flex-col gap-1.5">
        <MuscleRow name="biceps" on={arm.flexor} locked={frozen} set={set('flexor')} />
        <MuscleRow name="triceps" on={arm.extensor} locked={frozen} set={set('extensor')} />
        <div className="grid grid-cols-2 gap-x-6 border-t border-ss-line pt-1.5">
          <p className="flex items-baseline justify-between gap-2">
            <span className="text-[12px] font-bold text-ss-slate">Goal</span>
            <span className="whitespace-nowrap text-[13px] font-extrabold text-ss-ink">{goalText(config)}</span>
          </p>
          <p className="flex items-baseline justify-between gap-2">
            <span className="text-[12px] font-bold text-ss-slate">Elbow</span>
            <span className="text-[15px] font-extrabold text-ss-ink" data-pose={arm.pose}>{arm.pose === 'bent' ? 'Bent' : 'Straight'}</span>
          </p>
        </div>
      </div>

      <span className="sr-only" aria-live="polite">{`${pullingText(arm)} The elbow is ${arm.pose}.`}</span>
      {marked !== 'idle' && (
        <div className="rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2" data-done={done(config, shown) ? '1' : '0'}>
          <p className="text-[13px] font-extrabold leading-snug text-ss-ink">{lead ? lead[1] : said}</p>
          {lead && lead[2] && <p className="mt-0.5 text-[12px] font-semibold leading-snug text-ss-slate">{lead[2]}</p>}
        </div>
      )}
    </div>
  )
}
