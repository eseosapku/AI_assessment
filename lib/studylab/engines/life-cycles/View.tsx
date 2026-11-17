'use client'
import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import type { SceneViewProps } from '../types'
import type { LifeConfig, LifeState } from './config'
import { goalOf, lifeCyclesEngine, lifeOf, madeText, rangeOf, stepOf, timeText, working } from './config'

type Props = SceneViewProps<LifeConfig, LifeState>
type P = { x: number; y: number }

// A living thing is not a dark subject: a quiet light plate, as measure-shape's and network-sim's are, with the plant,
// the pond or the soil drawn on it in their own colours. The plate keeps its colours in both themes. No gradients or shadows.
const PLATE = '#F8FAFC'
const PLATE_EDGE = '#CBD5E1'
const SOFT = '#475569'
const FONT = 'system-ui, sans-serif'

export const W = 360
export const H = 240

// ---------------------------------------------------------------------------
// Time. Every drawn quantity is a list of values, one per moment; the picture at a time between two moments is the
// blend of the two, so a change is seen happening as the slider moves or the picture eases to the next moment.

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const f1 = (n: number) => n.toFixed(1)

/** A keyframed quantity at moment `u`, which may lie between two moments. */
export function kf(u: number, v: readonly number[]): number {
  if (v.length === 1) return v[0]
  const c = clamp(u, 0, v.length - 1)
  const i = Math.min(v.length - 2, Math.floor(c))
  return lerp(v[i], v[i + 1], c - i)
}
/** 1 at the listed moments and 0 at the rest, crossfading between neighbours. */
export const on = (u: number, n: number, list: number[]) => kf(u, Array.from({ length: n }, (_, i) => (list.includes(i) ? 1 : 0)))

function hex(c: string): [number, number, number] {
  const n = parseInt(c.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
/** A colour between two, for things that ripen or dry. */
function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hex(a)
  const [r2, g2, b2] = hex(b)
  const k = clamp(t, 0, 1)
  const to = (x: number, y: number) => Math.round(lerp(x, y, k)).toString(16).padStart(2, '0')
  return `#${to(r1, r2)}${to(g1, g2)}${to(b1, b2)}`
}

/** Draws its children only while they can be seen. */
function Fade({ op, children, ...rest }: { op: number; children: ReactNode; transform?: string; 'data-actor'?: string }) {
  if (op <= 0.01) return null
  return <g opacity={op >= 0.99 ? undefined : op.toFixed(3)} {...rest}>{children}</g>
}

// ---------------------------------------------------------------------------
// Leaves: a pointed oval from a base to a tip. `at(s, h)` is a point on the leaf: s along it, h across it (1 is the edge
// on the normal's side, -1 the other edge).

type Leaf = { b: P; t: P; w: number }
function leafFrame(l: Leaf) {
  const dx = l.t.x - l.b.x
  const dy = l.t.y - l.b.y
  const L = Math.hypot(dx, dy)
  const u = { x: dx / L, y: dy / L }
  // The normal that points up the page.
  const n0 = { x: -u.y, y: u.x }
  const n = n0.y <= 0 ? n0 : { x: -n0.x, y: -n0.y }
  return { L, u, n, hw: l.w / 2 }
}
const C1 = 1.05
const C2 = 1.25
const along = (s: number) => 3 * s * (1 - s) ** 2 * 0.15 + 3 * s * s * (1 - s) * 0.7 + s ** 3
const across = (s: number) => 3 * s * (1 - s) ** 2 * C1 + 3 * s * s * (1 - s) * C2
/** A point on the leaf: s from base (0) to tip (1), h from the lower edge (-1) through the midrib (0) to the upper edge (1). */
function leafAt(l: Leaf, s: number, h: number): P {
  const { L, u, n, hw } = leafFrame(l)
  const a = along(s) * L
  const w = across(s) * hw * h
  return { x: l.b.x + u.x * a + n.x * w, y: l.b.y + u.y * a + n.y * w }
}
function leafPath(l: Leaf): string {
  const { L, u, n, hw } = leafFrame(l)
  const p = (a: number, s: number) => `${f1(l.b.x + u.x * a * L + n.x * s)} ${f1(l.b.y + u.y * a * L + n.y * s)}`
  return `M ${p(0, 0)} C ${p(0.15, hw * C1)} ${p(0.7, hw * C2)} ${p(1, 0)} C ${p(0.7, -hw * C2)} ${p(0.15, -hw * C1)} ${p(0, 0)} Z`
}
function LeafShape({ l, fill, edge, vein, mask }: { l: Leaf; fill: string; edge: string; vein: string; mask?: string }) {
  const veins = [0.28, 0.46, 0.64, 0.8].flatMap((s) => [1, -1].map((side) => [leafAt(l, s, 0), leafAt(l, s + 0.12, side * 0.72)]))
  return (
    <g mask={mask ? `url(#${mask})` : undefined}>
      <path d={leafPath(l)} fill={fill} stroke={edge} strokeWidth={1.4} strokeLinejoin="round" />
      <g stroke={vein} strokeLinecap="round" fill="none">
        <path d={`M ${f1(l.b.x)} ${f1(l.b.y)} L ${f1(leafAt(l, 0.94, 0).x)} ${f1(leafAt(l, 0.94, 0).y)}`} strokeWidth={1.6} />
        {veins.map(([a, b], i) => <path key={i} d={`M ${f1(a.x)} ${f1(a.y)} Q ${f1((a.x + b.x) / 2)} ${f1((a.y + b.y) / 2 - 1)} ${f1(b.x)} ${f1(b.y)}`} strokeWidth={0.9} />)}
      </g>
    </g>
  )
}

// ---------------------------------------------------------------------------
// The monarch. Real colours: a cream ridged egg; a caterpillar banded black, white and yellow with black filaments at
// both ends; a jade chrysalis with a black and gold crown; orange wings with black veins and a white-spotted black margin.

const B = {
  leaf: '#86AE5E', leafEdge: '#557A3A', vein: '#D2E2BA', stem: '#7AA352', stemEdge: '#557A3A',
  flower: '#D88BB1', flowerDark: '#A65A82', flowerBud: '#E9BCD2',
  egg: '#F0E4BE', eggEdge: '#A8955E', eggDark: '#3A3530',
  white: '#F5F2E8', black: '#1F1D1B', yellow: '#F2C230',
  jade: '#5DB27E', jadeEdge: '#2F7A4D', jadeLight: '#93D3AA', gold: '#E6B53A', goldEdge: '#93701A',
  clear: '#2F2A27', shell: '#EEF3EE', shellEdge: '#A9BDB0',
  orange: '#E8812B', under: '#EBA65A', wingBlack: '#1E1A17', dot: '#FFFFFF', apex: '#F3C27A', silk: '#FFFFFF',
}

const L1: Leaf = { b: { x: 174, y: 178 }, t: { x: 30, y: 150 }, w: 64 }
const L2: Leaf = { b: { x: 178, y: 184 }, t: { x: 310, y: 198 }, w: 52 }
const L3: Leaf = { b: { x: 180, y: 122 }, t: { x: 84, y: 98 }, w: 44 }
const L4: Leaf = { b: { x: 182, y: 120 }, t: { x: 302, y: 92 }, w: 46 }

/** Where the J and the chrysalis hang: the underside of the upper right leaf. */
const hangPoint = (): P => {
  const p = leafAt(L4, 0.7, -0.92)
  return { x: Math.round(p.x), y: Math.round(p.y) }
}

/** A banded caterpillar along a line of points, tail first. */
function Caterpillar({ pts, thick, legs }: { pts: P[]; thick: number; legs: 1 | -1 }) {
  const seg: { a: P; len: number }[] = []
  let total = 0
  for (let i = 0; i + 1 < pts.length; i++) {
    const len = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y)
    seg.push({ a: pts[i], len })
    total += len
  }
  const atLen = (d: number): { p: P; t: P } => {
    let rest = clamp(d, 0, total)
    for (let i = 0; i < seg.length; i++) {
      if (rest <= seg[i].len || i === seg.length - 1) {
        const b = pts[i + 1]
        const k = seg[i].len ? rest / seg[i].len : 0
        const t = { x: (b.x - seg[i].a.x) / (seg[i].len || 1), y: (b.y - seg[i].a.y) / (seg[i].len || 1) }
        return { p: { x: lerp(seg[i].a.x, b.x, k), y: lerp(seg[i].a.y, b.y, k) }, t }
      }
      rest -= seg[i].len
    }
    return { p: pts[pts.length - 1], t: { x: 1, y: 0 } }
  }
  const d = `M ${pts.map((p) => `${f1(p.x)} ${f1(p.y)}`).join(' L ')}`
  const n = clamp(Math.round(total / 5.5), 3, 12)
  const step = total / n
  const half = thick * 0.47
  const band = (at: number, w: number, colour: string, key: string) => {
    const { p, t } = atLen(at)
    const nx = -t.y
    const ny = t.x
    return <line key={key} x1={f1(p.x + nx * half)} y1={f1(p.y + ny * half)} x2={f1(p.x - nx * half)} y2={f1(p.y - ny * half)} stroke={colour} strokeWidth={f1(w)} />
  }
  const head = atLen(total)
  const tail = atLen(0)
  const ln = (o: P, t: P, k: number, sideways: number) => ({ x: o.x + t.x * k - t.y * sideways, y: o.y + t.y * k + t.x * sideways })
  const feelers = (o: P, t: P, len: number, dir: 1 | -1) => [1, -1].map((side) => {
    const tip = ln(o, t, dir * len * 0.7, side * len * 0.55)
    const mid = ln(o, t, dir * len * 0.2, side * len * 0.5)
    return <path key={side} d={`M ${f1(o.x)} ${f1(o.y)} Q ${f1(mid.x)} ${f1(mid.y)} ${f1(tip.x)} ${f1(tip.y)}`} fill="none" stroke={B.black} strokeWidth={Math.max(0.9, thick * 0.12)} strokeLinecap="round" />
  })
  const legPts = Array.from({ length: n - 1 }, (_, i) => i).filter((i) => i >= 1)
  return (
    <g>
      {/* Little legs under the body: true legs at the front, stubby prolegs behind. */}
      {legPts.map((i) => {
        const { p, t } = atLen((i + 0.5) * step)
        const nx = -t.y * legs
        const ny = t.x * legs
        const front = i >= n - 4
        if (!front && i % 2) return null
        return <line key={`l${i}`} x1={f1(p.x + nx * half * 0.6)} y1={f1(p.y + ny * half * 0.6)} x2={f1(p.x + nx * (half + thick * 0.32))} y2={f1(p.y + ny * (half + thick * 0.32))} stroke={B.black} strokeWidth={f1(Math.max(0.9, thick * (front ? 0.13 : 0.2)))} strokeLinecap="round" />
      })}
      <path d={d} fill="none" stroke={B.black} strokeWidth={f1(thick + 1.6)} strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke={B.white} strokeWidth={f1(thick)} strokeLinecap="round" strokeLinejoin="round" />
      {Array.from({ length: n - 1 }, (_, i) => i).map((i) => [
        band((i + 0.45) * step, step * 0.34, B.black, `b${i}`),
        band((i + 0.82) * step, step * 0.2, B.yellow, `y${i}`),
      ])}
      {feelers(tail.p, tail.t, thick * 1.1, -1)}
      {feelers(head.p, head.t, thick * 1.7, 1)}
      <circle cx={f1(head.p.x)} cy={f1(head.p.y)} r={f1(thick * 0.56)} fill={B.black} />
      <path d={`M ${f1(head.p.x - head.t.y * thick * 0.3)} ${f1(head.p.y + head.t.x * thick * 0.3)} L ${f1(head.p.x + head.t.x * thick * 0.35)} ${f1(head.p.y + head.t.y * thick * 0.35)} L ${f1(head.p.x + head.t.y * thick * 0.3)} ${f1(head.p.y - head.t.x * thick * 0.3)}`} fill="none" stroke={B.yellow} strokeWidth={f1(Math.max(0.7, thick * 0.12))} strokeLinejoin="round" />
    </g>
  )
}

/** A chrysalis hanging from a point: jade with a gold-dotted crown; see-through with the wings inside; or the empty case. */
function Chrysalis({ at, look, age = 0 }: { at: P; look: 'jade' | 'clear' | 'empty'; age?: number }) {
  const body = 'M 0 5 C 8 5 11.5 11 11.5 19 C 11.5 31 6.5 41 0 42 C -6.5 41 -11.5 31 -11.5 19 C -11.5 11 -8 5 0 5 Z'
  return (
    <g transform={`translate(${at.x} ${at.y})`}>
      <line x1={0} y1={0} x2={0} y2={6} stroke={B.black} strokeWidth={2} strokeLinecap="round" />
      <ellipse cx={0} cy={0} rx={4} ry={1.6} fill={B.silk} stroke="#C9D3DB" strokeWidth={0.8} />
      {look === 'jade' && (
        <g>
          <path d={body} fill={mix(B.jade, '#3F8F6A', age)} stroke={B.jadeEdge} strokeWidth={1.4} />
          <path d="M -6.5 12 C -8.5 19 -8 28 -4.5 35" fill="none" stroke={B.jadeLight} strokeWidth={2.4} strokeLinecap="round" />
          <path d="M -10.5 16.5 Q 0 13 10.5 16.5" fill="none" stroke={B.black} strokeWidth={1.6} />
          {[-8, -4, 0, 4, 8].map((x) => <circle key={x} cx={x} cy={x === 0 ? 13.2 : Math.abs(x) === 4 ? 13.8 : 15} r={1.3} fill={B.gold} stroke={B.goldEdge} strokeWidth={0.5} />)}
          {[[-6, 33], [-2, 37], [3, 37], [7, 32], [-9, 9.5], [9, 9.5]].map(([x, y]) => <circle key={`${x},${y}`} cx={x} cy={y} r={1.1} fill={B.gold} stroke={B.goldEdge} strokeWidth={0.4} />)}
        </g>
      )}
      {look === 'clear' && (
        <g>
          <path d={body} fill={B.clear} stroke={B.jadeEdge} strokeWidth={1.4} />
          {/* The folded wings show through: orange cells in black, with the white-spotted margin. */}
          <path d="M -1 15 C -6 18 -9 26 -7 35 C -3 37 0 33 -1 15 Z" fill={B.orange} />
          <path d="M 1 15 C 6 18 9 26 7 35 C 3 37 0 33 1 15 Z" fill={B.orange} />
          <path d="M -1 16 L -6 33 M 1 16 L 6 33 M -2 22 L -7.5 26 M 2 22 L 7.5 26" stroke={B.wingBlack} strokeWidth={1} />
          {[[-8.5, 30], [-9.5, 24], [8.5, 30], [9.5, 24], [-4, 38.5], [4, 38.5]].map(([x, y]) => <circle key={`${x},${y}`} cx={x} cy={y} r={0.9} fill={B.dot} />)}
          <path d="M -10.5 16.5 Q 0 13 10.5 16.5" fill="none" stroke={B.gold} strokeWidth={1.2} />
        </g>
      )}
      {look === 'empty' && (
        <g>
          <path d="M 0 5 C 8 5 11.5 11 11.5 19 C 11.5 27 9 33 6 36 L 3 31 L 0 37 L -3 31 L -6 36 C -9 33 -11.5 27 -11.5 19 C -11.5 11 -8 5 0 5 Z" fill={B.shell} stroke={B.shellEdge} strokeWidth={1.2} strokeLinejoin="round" />
          <path d="M -10.5 16.5 Q 0 13 10.5 16.5" fill="none" stroke={B.shellEdge} strokeWidth={1} />
        </g>
      )}
    </g>
  )
}

/** A monarch seen from above, wings open: wingspan 100 at s 1. */
function MonarchOpen({ s, rot }: { s: number; rot: number }) {
  const fore = 'M 2 -3 C 10 -20 30 -36 49 -37 C 52 -31 51 -22 46 -12 C 40 -2 24 3 4 2 Z'
  const hind = 'M 3 2 C 18 2 34 6 38 16 C 41 27 33 38 20 40 C 11 41 5 32 2 15 Z'
  const side = (k: 1 | -1) => (
    <g key={k} transform={`scale(${k} 1)`}>
      <path d={hind} fill={B.wingBlack} />
      <path d={hind} fill={B.orange} transform="translate(3 3) scale(0.8) translate(-3 -3)" />
      <path d={fore} fill={B.wingBlack} />
      <path d={fore} fill={B.orange} transform="translate(4 0) scale(0.8) translate(-4 0)" />
      <g stroke={B.wingBlack} strokeWidth={1.3} fill="none" strokeLinecap="round">
        <path d="M 4 -1 Q 22 -14 38 -27" />
        <path d="M 5 0 Q 24 -6 40 -14" />
        <path d="M 5 1 Q 22 1 35 -4" />
        <path d="M 4 4 Q 20 6 33 14" />
        <path d="M 4 5 Q 18 14 28 29" />
        <path d="M 4 5 Q 10 18 15 34" />
      </g>
      {[[48.5, -30], [48, -24.5], [46.5, -18.5], [43.5, -13], [38, 22], [36, 29], [31, 35], [24.5, 38], [17, 38.5]].map(([x, y]) => <circle key={`${x},${y}`} cx={x} cy={y} r={1.2} fill={B.dot} />)}
      {[[40, -31], [43.5, -27.5], [38, -34]].map(([x, y]) => <circle key={`a${x},${y}`} cx={x} cy={y} r={1.3} fill={B.apex} />)}
      <path d="M -1 -10 Q -5 -22 -9 -30" fill="none" stroke={B.wingBlack} strokeWidth={1.1} transform="scale(-1 1)" />
      <circle cx={9} cy={-30} r={1.7} fill={B.wingBlack} />
    </g>
  )
  return (
    <g transform={`rotate(${f1(rot)}) scale(${s.toFixed(3)})`}>
      {side(1)}
      {side(-1)}
      <ellipse cx={0} cy={10} rx={3} ry={12} fill={B.wingBlack} />
      <circle cx={0} cy={-2} r={4} fill={B.wingBlack} />
      <circle cx={0} cy={-8} r={3} fill={B.wingBlack} />
      {[[-1.2, -3], [1.2, -1], [0, 6], [0, 11]].map(([x, y]) => <circle key={`${x},${y}`} cx={x} cy={y} r={0.75} fill={B.dot} />)}
    </g>
  )
}

/** A monarch from the side, wings closed above it, laying an egg: its abdomen bends down to the leaf. */
function MonarchClosed() {
  const fore = 'M 0 -2 C -3 -20 5 -40 19 -47 C 27 -45 32 -35 30 -23 C 28 -12 14 -4 0 -2 Z'
  const hind = 'M 0 -2 C 2 -15 12 -25 24 -24 C 32 -22 33 -10 27 -2 C 21 4 8 4 0 -2 Z'
  return (
    <g>
      <path d="M 0 1 C -6 3 -11 7 -13 14" fill="none" stroke={B.wingBlack} strokeWidth={5} strokeLinecap="round" />
      {[[-4, 3.8], [-8, 6.2], [-11, 9.6]].map(([x, y]) => <circle key={`${x},${y}`} cx={x} cy={y} r={0.7} fill={B.dot} />)}
      <g stroke={B.wingBlack} strokeWidth={1.1} strokeLinecap="round" fill="none">
        <path d="M 2 3 L -2 13" /><path d="M 5 3 L 6 13" /><path d="M 7 2 L 12 11" />
      </g>
      <path d={fore} fill={B.wingBlack} />
      <path d={fore} fill={B.under} transform="translate(0 -2) scale(0.82) translate(0 2)" />
      <path d={hind} fill={B.wingBlack} />
      <path d={hind} fill={B.under} transform="translate(0 -2) scale(0.8) translate(0 2)" />
      <g stroke={B.wingBlack} strokeWidth={1.1} fill="none" strokeLinecap="round">
        <path d="M 1 -4 Q 8 -24 18 -42" /><path d="M 2 -4 Q 14 -18 27 -26" /><path d="M 2 -3 Q 13 -12 26 -12" /><path d="M 2 -2 Q 14 -3 25 -1" />
      </g>
      {[[29, -30], [30.5, -22], [26.5, -7], [31, -14], [22, -45.5], [26.5, -42]].map(([x, y]) => <circle key={`${x},${y}`} cx={x} cy={y} r={1.1} fill={B.dot} />)}
      <circle cx={4} cy={-1} r={3.6} fill={B.wingBlack} />
      <circle cx={8.5} cy={-2} r={2.8} fill={B.wingBlack} />
      <path d="M 9 -4 Q 14 -12 18 -19" fill="none" stroke={B.wingBlack} strokeWidth={1.1} />
      <circle cx={18} cy={-19} r={1.5} fill={B.wingBlack} />
    </g>
  )
}

/** Just out of the chrysalis: hanging from the empty case, wings small, soft and crumpled. */
function MonarchCrumpled() {
  return (
    <g>
      <g stroke={B.wingBlack} strokeWidth={1} strokeLinecap="round"><path d="M -2 6 L -4 0" /><path d="M 2 6 L 4 0" /></g>
      <path d="M 1 9 L 8 11 L 6.5 15 L 11 18 L 8.5 22 L 12 26 L 6 28 L 2.5 23 Z" fill={B.wingBlack} />
      <path d="M 2 10.5 L 7 12 L 5.5 15.5 L 9 18.5 L 7 22 L 9.5 25.5 L 6 26.5 L 3 22.5 Z" fill={B.orange} />
      <path d="M -1 9 L -7 11.5 L -5.5 15.5 L -9.5 18.5 L -7 22.5 L -10 25.5 L -5 27 L -2 22 Z" fill={B.wingBlack} />
      <path d="M -2 10.5 L -6 12.5 L -4.5 15.8 L -8 18.8 L -5.8 22.3 L -8.2 24.8 L -5 25.6 L -2.5 21.5 Z" fill={B.under} />
      <ellipse cx={0} cy={20} rx={2.8} ry={9.5} fill={B.wingBlack} />
      <circle cx={0} cy={9} r={3.2} fill={B.wingBlack} />
      <circle cx={0} cy={4.5} r={2.6} fill={B.wingBlack} />
      {[[0, 16], [0, 21], [0, 26]].map(([x, y]) => <circle key={y} cx={x} cy={y} r={0.7} fill={B.dot} />)}
    </g>
  )
}

function MonarchEgg({ at, dark }: { at: P; dark: number }) {
  return (
    <g transform={`translate(${f1(at.x)} ${f1(at.y)})`}>
      <path d="M 0 -6 C 3.4 -5 4.4 -1 4.2 2 C 4 4.6 2.2 5.6 0 5.6 C -2.2 5.6 -4 4.6 -4.2 2 C -4.4 -1 -3.4 -5 0 -6 Z" fill={B.egg} stroke={B.eggEdge} strokeWidth={1} />
      <path d="M -2 -3.8 L -2.4 4.6 M 0 -5.4 L 0 5.3 M 2 -3.8 L 2.4 4.6" stroke={B.eggEdge} strokeWidth={0.6} />
      {dark > 0.01 && <path d="M 0 -6 C 2.6 -5.3 3.6 -3.4 3.9 -1.6 L -3.9 -1.6 C -3.6 -3.4 -2.6 -5.3 0 -6 Z" fill={B.eggDark} opacity={dark >= 0.99 ? undefined : dark.toFixed(2)} />}
    </g>
  )
}

/** Milkweed flowers: a dome of small pink flowers, each on its own fine stalk from one point. */
function Umbel({ at }: { at: P }) {
  const flowers = Array.from({ length: 15 }, (_, i) => {
    const a = (-168 + (i * 156) / 14) * (Math.PI / 180)
    const r = i % 2 ? 19 : 24
    return { x: at.x + Math.cos(a) * r, y: at.y - 4 + Math.sin(a) * r * 1.05, bud: i === 0 || i === 14 }
  })
  const inner = [-130, -95, -60].map((d) => {
    const a = (d * Math.PI) / 180
    return { x: at.x + Math.cos(a) * 11, y: at.y - 4 + Math.sin(a) * 12, bud: false }
  })
  return (
    <g>
      <g stroke={B.stemEdge} strokeWidth={0.9} strokeLinecap="round">
        {[...flowers, ...inner].map((f, i) => <line key={i} x1={at.x} y1={at.y} x2={f1(f.x)} y2={f1(f.y)} />)}
      </g>
      {[...flowers, ...inner].map((f, i) => (
        <g key={i} transform={`translate(${f1(f.x)} ${f1(f.y)}) rotate(${i * 23})`}>
          {f.bud ? <circle r={2.6} fill={B.flowerBud} stroke={B.flowerDark} strokeWidth={0.7} /> : (
            <g>
              <path d="M 0 -5 L 1.4 -1.5 L 4.8 -1.5 L 2 0.7 L 3 4.3 L 0 2.1 L -3 4.3 L -2 0.7 L -4.8 -1.5 L -1.4 -1.5 Z" fill={B.flower} stroke={B.flowerDark} strokeWidth={0.7} strokeLinejoin="round" />
              <circle r={1.5} fill={B.flowerBud} stroke={B.flowerDark} strokeWidth={0.5} />
            </g>
          )}
        </g>
      ))}
    </g>
  )
}

function ButterflyScene({ u, ids }: { u: number; ids: { bite: string } }) {
  const N = 13
  const A = hangPoint()
  const egg = leafAt(L1, 0.56, 0.22)
  // Bites out of the nursery leaf: s along it, h across, radius, and the moment each has been eaten by.
  const bites: [number, number, number, number][] = [
    [0.6, 0.42, 2.6, 2], [0.73, 1, 7, 3], [0.66, 1, 5, 3], [0.6, 1, 8, 4], [0.86, 1, 7, 4], [0.5, -1, 6, 4],
    [0.8, 1, 11, 5], [0.95, 0.2, 9, 5], [0.7, -1, 9, 5], [0.88, -1, 8, 5], [0.45, 1, 9, 5],
  ]
  // The caterpillar on the leaf: where its head is (s along, h across), and how long it is.
  const headS = kf(u, [0.56, 0.56, 0.6, 0.72, 0.64, 0.78, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5])
  const headH = kf(u, [0.25, 0.25, 0.3, 0.5, 0.46, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5])
  const len = kf(u, [8, 8, 11, 28, 44, 64, 64, 64, 64, 64, 64, 64, 64])
  const crawl = on(u, N, [2, 3, 4, 5])
  const head = leafAt(L1, headS, headH)
  const { u: ax } = leafFrame(L1)
  const k = 10
  const thick = Math.max(3.2, len * 0.16)
  const body = Array.from({ length: k + 1 }, (_, i) => {
    const d = len * (1 - i / k)
    return { x: head.x - ax.x * d, y: head.y - ax.y * d - Math.sin((Math.PI * i) / k) * thick * 0.35 }
  })
  const jPts = Array.from({ length: 13 }, (_, i) => {
    if (i <= 5) return { x: A.x, y: A.y + 3 + (i / 5) * 27 }
    const th = ((i - 5) / 7) * Math.PI
    return { x: A.x - 9 + 9 * Math.cos(th), y: A.y + 30 + 9 * Math.sin(th) }
  })
  const flyX = kf(u, [64, 34, 34, 34, 34, 34, 34, 34, 34, 34, A.x, 206, 292])
  const flyY = kf(u, [66, 34, 34, 34, 34, 34, 34, 34, 34, 34, A.y + 52, 46, 172])
  const flyS = kf(u, [0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.45, 0.9, 0.8])
  return (
    <g>
      <defs>
        <mask id={ids.bite} maskUnits="userSpaceOnUse" x={0} y={0} width={W} height={H}>
          <rect x={0} y={0} width={W} height={H} fill="#FFFFFF" />
          {bites.map(([s, h, r, at], i) => {
            const grow = clamp(u - (at - 1), 0, 1)
            if (grow <= 0) return null
            const p = leafAt(L1, s, h)
            return <circle key={i} cx={f1(p.x)} cy={f1(p.y)} r={f1(r * grow)} fill="#000000" />
          })}
        </mask>
      </defs>
      {/* The milkweed: a stout stem, broad leaves in pairs, and a ball of small pink flowers at the top. */}
      <path d="M 176 240 C 174 196 184 140 182 74" fill="none" stroke={B.stemEdge} strokeWidth={8} strokeLinecap="round" />
      <path d="M 176 240 C 174 196 184 140 182 74" fill="none" stroke={B.stem} strokeWidth={5} strokeLinecap="round" />
      <LeafShape l={L3} fill={B.leaf} edge={B.leafEdge} vein={B.vein} />
      <LeafShape l={L4} fill={B.leaf} edge={B.leafEdge} vein={B.vein} />
      <LeafShape l={L2} fill={B.leaf} edge={B.leafEdge} vein={B.vein} />
      <LeafShape l={L1} fill={B.leaf} edge={B.leafEdge} vein={B.vein} mask={ids.bite} />
      <Umbel at={{ x: 182, y: 72 }} />

      {/* The egg, and the shell the caterpillar leaves. */}
      <Fade op={on(u, N, [0, 1])}><MonarchEgg at={egg} dark={kf(u, [0, 1])} /></Fade>
      <Fade op={on(u, N, [2]) * 0.9}>
        <path d={`M ${f1(egg.x - 4)} ${f1(egg.y + 2)} C ${f1(egg.x - 4)} ${f1(egg.y + 5.6)} ${f1(egg.x + 4)} ${f1(egg.y + 5.6)} ${f1(egg.x + 4)} ${f1(egg.y + 2)} L ${f1(egg.x + 2)} ${f1(egg.y + 3.2)} L ${f1(egg.x)} ${f1(egg.y + 1.4)} L ${f1(egg.x - 2)} ${f1(egg.y + 3.2)} Z`} fill={B.egg} stroke={B.eggEdge} strokeWidth={0.8} />
      </Fade>
      {/* The skin it grew out of, left crumpled behind it. */}
      <Fade op={on(u, N, [4])}>
        {(() => {
          const p = leafAt(L1, 0.4, 0.42)
          return <path d={`M ${f1(p.x - 7)} ${f1(p.y)} q 2 -3.5 4 -0.5 q 2 -3 4 0 q 2 -2.5 3.5 0.5 q 1.5 2.5 -1 3.5 q -4 1.5 -9 0.5 Z`} fill="#9C9A86" stroke="#55534A" strokeWidth={0.8} />
        })()}
      </Fade>
      <Fade op={crawl}><Caterpillar pts={body} thick={thick} legs={-1} /></Fade>
      <Fade op={on(u, N, [6])}>
        <ellipse cx={A.x} cy={A.y} rx={4} ry={1.6} fill={B.silk} stroke="#C9D3DB" strokeWidth={0.8} />
        <Caterpillar pts={jPts} thick={10} legs={1} />
      </Fade>
      {/* It deepens in colour as the days pass, then turns clear the day before the butterfly comes out. */}
      <Fade op={on(u, N, [7, 8])}><Chrysalis at={A} look="jade" age={kf(u, [0, 0, 0, 0, 0, 0, 0, 0, 1, 1])} /></Fade>
      <Fade op={on(u, N, [9])}><Chrysalis at={A} look="clear" /></Fade>
      <Fade op={on(u, N, [10, 11, 12]) * 0.95}><Chrysalis at={A} look="empty" /></Fade>
      <Fade op={on(u, N, [10])} transform={`translate(${A.x} ${A.y + 36}) scale(1.35)`}><MonarchCrumpled /></Fade>
      {/* The new egg, laid by our butterfly: the cycle starts again. */}
      <Fade op={on(u, N, [12])}><MonarchEgg at={{ x: 281, y: 191 }} dark={0} /></Fade>
      <Fade op={on(u, N, [12])} transform="translate(292 176) scale(0.8)"><MonarchClosed /></Fade>
      {/* The parent flies off as the egg's first days pass; our butterfly flies from its case to the flowers. */}
      <Fade op={on(u, N, [0])} transform={`translate(${f1(flyX)} ${f1(flyY)})`}><MonarchOpen s={flyS} rot={-14} /></Fade>
      <Fade op={on(u, N, [11])} transform={`translate(${f1(flyX)} ${f1(flyY)})`}><MonarchOpen s={flyS} rot={6} /></Fade>
    </g>
  )
}

// ---------------------------------------------------------------------------
// The common frog, in a garden pond seen from the side: water on the left, a muddy bank and grass on the right.

const F = {
  water: '#D4E9F3', surface: '#7DB0CE', mud: '#C6B08A', mudEdge: '#A08A63', earth: '#CBB48C', earthEdge: '#9E875F',
  grass: '#8DB866', grassDark: '#5F8F42', weed: '#4F8A4A', weedLeaf: '#6FA65F', algae: '#A9CF83',
  stone: '#A9A59D', stoneDark: '#87837B', stoneLight: '#C9C6BF', pad: '#6FA65F', padEdge: '#4A7F43', padVein: '#93C27F',
  jelly: '#EEF6F9', jellyEdge: '#97B6C7', dot: '#1E211C',
  tad: '#3E3B2C', tadSpot: '#5F5A43', tail: '#7C7659', fin: '#ABA58B', gill: '#C46A55',
  frog: '#8C7B45', frogEdge: '#55492A', frogDark: '#5E5230', belly: '#DCD2A8', eye: '#D6A23A', mask: '#4A3E26', tongue: '#D46A78', fly: '#2A2A2E', flyWing: '#DCE6EE',
}
const SURFACE = 86
const SPAWN: P = { x: 100, y: 118 }
const SPAWN_EGGS: P[] = [
  { x: 0, y: 0 }, { x: 16, y: -4 }, { x: -15, y: -5 }, { x: 7, y: 14 }, { x: -9, y: 13 }, { x: 22, y: 10 }, { x: -23, y: 8 }, { x: 1, y: -16 }, { x: -7, y: -15 },
]

function Spawn({ dots, commas }: { dots: number; commas: number }) {
  return (
    <g transform={`translate(${SPAWN.x} ${SPAWN.y})`}>
      {SPAWN_EGGS.map((e, i) => <circle key={i} cx={e.x} cy={e.y} r={9.6} fill={F.jelly} stroke={F.jellyEdge} strokeWidth={1.2} />)}
      {SPAWN_EGGS.map((e, i) => (
        <g key={`d${i}`} transform={`translate(${e.x} ${e.y})`}>
          {dots > 0.01 && <circle r={3.4} fill={F.dot} opacity={dots >= 0.99 ? undefined : f1(dots)} />}
          {commas > 0.01 && <path d="M 2.6 -1.2 C 2.6 -3.2 -0.6 -3.6 -1.8 -1.6 C -2.8 0.2 -1.6 2.6 0.6 3.4" fill="none" stroke={F.dot} strokeWidth={2.4} strokeLinecap="round" opacity={commas >= 0.99 ? undefined : f1(commas)} transform={`rotate(${i * 47})`} />}
        </g>
      ))}
    </g>
  )
}

/** A tadpole facing right: body, a finned tail of the given share, and gills or legs as they come. */
function Tadpole({ tail, gills, back, front }: { tail: number; gills: number; back: number; front: number }) {
  return (
    <g>
      {tail > 0.02 && (
        <g transform={`scale(${f1(tail)} 1)`}>
          <path d="M -4 -3.6 C -12 -6.5 -22 -5.5 -29 0 C -22 5.5 -12 6.5 -4 3.6 Z" fill={F.fin} stroke={F.tail} strokeWidth={0.8} />
          <path d="M -4 -1.8 C -12 -2.2 -20 -1.2 -27 0 C -20 1.2 -12 2.2 -4 1.8 Z" fill={F.tail} />
        </g>
      )}
      {back > 0.02 && (
        <g stroke={F.tad} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={back >= 0.99 ? undefined : f1(back)}>
          <path d="M -3 3 L -7 8.5 L -2.5 11 L -7 12.5" />
        </g>
      )}
      {front > 0.02 && (
        <g stroke={F.tad} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={front >= 0.99 ? undefined : f1(front)}>
          <path d="M 3.5 4 L 5 8.5 L 8 9.5" />
        </g>
      )}
      <ellipse cx={0} cy={0} rx={7.5} ry={5.4} fill={F.tad} />
      {[[-2.5, -2.4], [1.5, -3.2], [-4.5, 0.6], [0, 1.6]].map(([x, y]) => <circle key={`${x},${y}`} cx={x} cy={y} r={0.8} fill={F.tadSpot} />)}
      <circle cx={4.4} cy={-1.8} r={1.5} fill={F.eye} />
      <circle cx={4.6} cy={-1.8} r={0.7} fill={F.dot} />
      {gills > 0.02 && (
        <g stroke={F.gill} strokeWidth={1.2} strokeLinecap="round" fill="none" opacity={gills >= 0.99 ? undefined : f1(gills)}>
          {[[-0.5, -4.5, -3, -9], [1.5, -4.8, 1, -9.5], [-1.8, 4.6, -4.2, 8.6]].map(([x, y, tx, ty]) => (
            <g key={`${x},${y}`}>
              <path d={`M ${x} ${y} L ${tx} ${ty}`} />
              <path d={`M ${(x + tx) / 2} ${(y + ty) / 2} l -1.6 ${ty < 0 ? -0.6 : 0.6} M ${(x + tx) / 2} ${(y + ty) / 2} l 1.5 ${ty < 0 ? -0.8 : 0.8} M ${tx} ${ty} l -1.3 ${ty < 0 ? 0.6 : -0.6} M ${tx} ${ty} l 1.3 ${ty < 0 ? 0.2 : -0.2}`} />
            </g>
          ))}
        </g>
      )}
    </g>
  )
}

/** A common frog sitting, facing right: about 46 across at s 1, its feet on y 15. */
function Frog({ stub, tongue }: { stub: number; tongue: number }) {
  return (
    <g>
      {stub > 0.02 && <path d={`M -16 6 L ${f1(-16 - 9 * stub)} 9 L -15 11 Z`} fill={F.frog} stroke={F.frogEdge} strokeWidth={0.9} strokeLinejoin="round" />}
      {/* The folded back leg and its long foot. */}
      <path d="M -6 13 L 9 13.4 L 12.5 15 L -6 15.2 Z" fill={F.frogDark} />
      <path d="M -18 5 C -23 -2 -14 -9 -5 -4 C 1 -1 3 6 -1 11 C -5 14 -15 13 -18 5 Z" fill={F.frog} stroke={F.frogEdge} strokeWidth={1} />
      <path d="M -14 0 L -6 4 M -12 -4 L -4 0" stroke={F.frogDark} strokeWidth={1.6} strokeLinecap="round" />
      {/* Body and head, the snout to the right. */}
      <path d="M -17 4 C -17 -8 -6 -14 6 -12 C 14 -11 20 -6 22.5 -2 C 23.5 1 20.5 4.5 14 6.5 C 6 9 -9 10 -17 4 Z" fill={F.frog} stroke={F.frogEdge} strokeWidth={1.1} />
      <path d="M -13 6.5 C -4 9.5 8 8.5 15 6" fill="none" stroke={F.belly} strokeWidth={2.4} strokeLinecap="round" />
      {[[-8, -6, 3.2, 2], [0, -9, 2.6, 1.6], [-12, -1, 2.4, 1.6], [5, -5, 2, 1.4]].map(([x, y, rx, ry]) => <ellipse key={`${x},${y}`} cx={x} cy={y} rx={rx} ry={ry} fill={F.frogDark} />)}
      {/* The dark patch behind the eye, the eye itself and the front leg. */}
      <path d="M 9 -8 C 6 -5 4 -2 3.5 1.5 L 8 0.5 C 9 -2.5 11 -5 12 -6.5 Z" fill={F.mask} />
      <circle cx={13} cy={-9.5} r={3.8} fill={F.frog} stroke={F.frogEdge} strokeWidth={1} />
      <circle cx={13.4} cy={-9.6} r={2.6} fill={F.eye} />
      <ellipse cx={13.6} cy={-9.6} rx={1.8} ry={0.9} fill={F.dot} />
      <path d="M 12 4 L 13.5 12.5 M 13.5 12.5 L 17.5 14.5 M 13.5 12.5 L 10.5 14.8" stroke={F.frogEdge} strokeWidth={1.8} strokeLinecap="round" fill="none" />
      <path d="M 16 0.8 Q 19.5 0.4 22.6 -1.2" fill="none" stroke={F.frogEdge} strokeWidth={0.9} />
      {tongue > 0.02 && (
        <g opacity={tongue >= 0.99 ? undefined : f1(tongue)}>
          <path d="M 21 -1 Q 30 -8 36 -15" fill="none" stroke={F.tongue} strokeWidth={2.2} strokeLinecap="round" />
          <circle cx={36} cy={-15} r={2.2} fill={F.tongue} />
        </g>
      )}
    </g>
  )
}

function FrogScene({ u }: { u: number }) {
  const N = 10
  // The young one: a tadpole, then a frog.
  const tx = kf(u, [98, 98, 84, 140, 150, 194, 240, 240, 240, 240])
  const ty = kf(u, [118, 118, 142, 158, 148, 106, 92, 92, 92, 92])
  const tr = kf(u, [0, 0, -62, 0, -8, -36, -20, -20, -20, -20])
  const ts = kf(u, [0.8, 0.8, 1, 1.55, 2, 2.1, 1.7, 1.7, 1.7, 1.7])
  const fx = kf(u, [244, 244, 244, 244, 244, 226, 244, 304, 306, 306])
  const fy = kf(u, [70, 70, 70, 70, 70, 88, 70, 64, 60, 60])
  const fs = kf(u, [0.55, 0.55, 0.55, 0.55, 0.55, 0.5, 0.55, 0.62, 0.95, 0.95])
  const tadOp = on(u, N, [2, 3, 4, 5])
  const frogOp = on(u, N, [6, 7, 8])
  return (
    <g>
      <rect x={0} y={SURFACE} width={W} height={H - SURFACE} fill={F.water} />
      <path d={`M 0 228 C 60 220 140 224 230 236 L 230 ${H} L 0 ${H} Z`} fill={F.mud} stroke={F.mudEdge} strokeWidth={1.2} />
      {/* The bank: earth with grass on top, sloping into the water. */}
      <path d="M 360 76 L 282 76 C 266 80 256 96 250 120 C 242 160 232 204 222 240 L 360 240 Z" fill={F.earth} stroke={F.earthEdge} strokeWidth={1.4} />
      <path d="M 360 72 L 282 72 C 272 73 265 78 260 86 L 266 88 C 270 82 276 79 286 79 L 360 79 Z" fill={F.grass} stroke={F.grassDark} strokeWidth={1} />
      {/* Layers in the bank, and stones in it, so it reads as earth. */}
      <path d="M 274 104 C 300 100 330 104 360 100 M 262 146 C 296 140 326 146 360 140 M 248 192 C 286 186 322 192 360 186" fill="none" stroke="#B89F74" strokeWidth={1.2} />
      {[[300, 122, 6, 3.6], [332, 166, 7, 4], [282, 214, 6, 3.4], [342, 220, 5, 3], [314, 90, 4, 2.6]].map(([x, y, rx, ry]) => <ellipse key={`${x},${y}`} cx={x} cy={y} rx={rx} ry={ry} fill={F.stoneLight} stroke={F.stoneDark} strokeWidth={0.8} />)}
      {[290, 302, 318, 334, 348].map((x, i) => <path key={x} d={`M ${x} 74 l ${-2 + (i % 2) * 3} -8 M ${x + 3} 74 l 1 -10 M ${x + 6} 74 l 3 -7`} stroke={F.grassDark} strokeWidth={1.3} strokeLinecap="round" />)}
      <line x1={0} y1={SURFACE} x2={232} y2={SURFACE} stroke={F.surface} strokeWidth={2} />
      {/* The stone at the water's edge. */}
      <path d="M 228 92 C 228 82 238 78 248 78 C 258 78 266 83 266 92 C 266 98 256 100 246 100 C 236 100 228 98 228 92 Z" fill={F.stone} stroke={F.stoneDark} strokeWidth={1.2} />
      <path d="M 236 84 C 240 81 246 80 252 81" fill="none" stroke={F.stoneLight} strokeWidth={2} strokeLinecap="round" />

      {/* Pond weed, with the green algae a tadpole grazes. */}
      {[[34, 104], [56, 96], [78, 112]].map(([x, top], i) => (
        <g key={x}>
          <path d={`M ${x} 230 C ${x - 6} 200 ${x + 6} 170 ${x - 2} 140 S ${x + 4} ${top + 12} ${x} ${top}`} fill="none" stroke={F.weed} strokeWidth={2} strokeLinecap="round" />
          {Array.from({ length: 6 }, (_, k) => k).map((k) => {
            const y = 222 - k * ((222 - top) / 6)
            const side = (k + i) % 2 ? 1 : -1
            return <ellipse key={k} cx={x + side * 5} cy={y} rx={5.5} ry={2.2} transform={`rotate(${side * -28} ${x + side * 5} ${y})`} fill={F.weedLeaf} />
          })}
          {[0.3, 0.55, 0.8].map((k) => <circle key={k} cx={x + (k > 0.5 ? 2 : -2)} cy={230 - k * (230 - top)} r={1.6} fill={F.algae} />)}
        </g>
      ))}
      {/* The lily pad, where the parent sits and, three years on, our frog. */}
      <ellipse cx={150} cy={SURFACE} rx={28} ry={5.5} fill={F.pad} stroke={F.padEdge} strokeWidth={1.2} />
      <path d={`M 150 ${SURFACE} L 172 ${SURFACE - 2.5} L 170 ${SURFACE + 1.5} Z`} fill={F.water} />
      <path d={`M 150 ${SURFACE} L 128 ${SURFACE + 2} M 150 ${SURFACE} L 140 ${SURFACE - 4} M 150 ${SURFACE} L 160 ${SURFACE + 4.5}`} stroke={F.padVein} strokeWidth={1} />

      <Fade op={kf(u, [1, 1, 0.45, 0, 0, 0, 0, 0, 0, 1])}><Spawn dots={kf(u, [1, 0, 0, 0, 0, 0, 0, 0, 0, 1])} commas={on(u, N, [1])} /></Fade>
      <Fade op={tadOp} transform={`translate(${f1(tx)} ${f1(ty)}) rotate(${f1(tr)}) scale(${ts.toFixed(3)})`}>
        <Tadpole tail={kf(u, [1, 1, 1, 1, 1, 0.55, 0.2, 0, 0, 0])} gills={on(u, N, [2])} back={kf(u, [0, 0, 0, 0, 1, 1, 1, 1, 1, 1])} front={kf(u, [0, 0, 0, 0, 0, 1, 1, 1, 1, 1])} />
      </Fade>
      <Fade op={frogOp} transform={`translate(${f1(fx)} ${f1(fy)}) scale(${fs.toFixed(3)})`}>
        <Frog stub={kf(u, [0, 0, 0, 0, 0, 1, 1, 0, 0, 0])} tongue={on(u, N, [8])} />
      </Fade>
      {/* On the lily pad: the parent at the start, and three years on our frog, back to lay its own spawn. */}
      <Fade op={on(u, N, [0, 9])} transform="translate(150 69.5) scale(1.1)"><Frog stub={0} tongue={0} /></Fade>
      <Fade op={on(u, N, [8])} transform="translate(340 46)">
        <ellipse cx={-2} cy={-3} rx={3.2} ry={1.8} fill={F.flyWing} stroke="#9AAFBF" strokeWidth={0.6} transform="rotate(-25 -2 -3)" />
        <ellipse cx={0} cy={0} rx={2.6} ry={1.9} fill={F.fly} />
      </Fade>
    </g>
  )
}

// ---------------------------------------------------------------------------
// The sunflower, with the soil cut away so the seed and its roots show.

const S = {
  soil: '#C29A6B', soilEdge: '#8A6440', speck: '#A7815A', pebble: '#ADA498',
  seed: '#3B3631', seedStripe: '#DCD5C6', root: '#F4ECD6', rootEdge: '#7E6A45', grass: '#6E9E48',
  pale: '#B9CF86', stem: '#6E9E48', stemEdge: '#4D7432', dry: '#A78C5C', dryEdge: '#755F3B',
  leaf: '#7AA94F', leafEdge: '#4E7A33', vein: '#A9C98A', dryLeaf: '#B79C68', coty: '#93C364',
  petal: '#F4C21F', petalEdge: '#C38F0D', petalDry: '#C29C52', disc: '#5B3B1F', discRing: '#7A5530', discSeed: '#36230F', bract: '#5E8E3E',
  bee: '#E2A83A', beeBlack: '#2A2522', beeWing: '#EAF2F7', beeWingEdge: '#9AAFBF',
}
const GROUND = 150
const SEED_AT: P = { x: 178, y: 186 }

/** A sunflower seed, striped, its pointed end towards +x; drawn half as big again as life, like everything here. */
function SunSeed({ at, rot, k = 1.5, split = 0 }: { at: P; rot: number; k?: number; split?: number }) {
  return (
    <g transform={`translate(${f1(at.x)} ${f1(at.y)}) rotate(${f1(rot)}) scale(${k})`}>
      <path d="M -8 0 C -8 -4.6 -2 -5.2 4 -3.2 C 7 -2.2 9 -1 9 0 C 9 1 7 2.2 4 3.2 C -2 5.2 -8 4.6 -8 0 Z" fill={S.seed} />
      <path d="M -6 -1.6 L 6 -1.2 M -6.5 0.4 L 7.5 0.2 M -5.5 2.2 L 5.5 1.8" stroke={S.seedStripe} strokeWidth={0.8} strokeLinecap="round" />
      {split > 0.02 && <path d="M 8.6 0 L 0 0.3" stroke={S.root} strokeWidth={f1(1.1 * split)} strokeLinecap="round" />}
    </g>
  )
}

/** A heart-shaped sunflower leaf on its stalk, hanging out to one side. */
function SunLeaf({ at, side, size, dry }: { at: P; side: 1 | -1; size: number; dry: number }) {
  if (size <= 0.02) return null
  const fill = mix(S.leaf, S.dryLeaf, dry)
  const edge = mix(S.leafEdge, S.dryEdge, dry)
  const droop = 16 + dry * 34
  return (
    <g transform={`translate(${f1(at.x)} ${f1(at.y)}) scale(${side} 1) rotate(${f1(droop)}) scale(${size.toFixed(3)})`}>
      <path d="M 0 0 L 11 0" stroke={edge} strokeWidth={1.6} strokeLinecap="round" />
      <path d="M 10 0 C 10 -8 18 -13 27 -11 C 35 -9 41 -4 45 0 C 41 4 35 9 27 11 C 18 13 10 8 10 0 Z" fill={fill} stroke={edge} strokeWidth={1.1} strokeLinejoin="round" />
      <path d="M 10 0 L 42 0 M 18 0 L 24 -7.5 M 18 0 L 24 7.5 M 27 0 L 33 -6 M 27 0 L 33 6 M 35 0 L 39 -3.5 M 35 0 L 39 3.5" stroke={mix(S.vein, S.dryEdge, dry)} strokeWidth={0.9} strokeLinecap="round" />
    </g>
  )
}

function Bee() {
  return (
    <g>
      <ellipse cx={-1} cy={-6} rx={5} ry={3} fill={S.beeWing} stroke={S.beeWingEdge} strokeWidth={0.7} transform="rotate(-20 -1 -6)" />
      <ellipse cx={4} cy={-6} rx={4.4} ry={2.6} fill={S.beeWing} stroke={S.beeWingEdge} strokeWidth={0.7} transform="rotate(25 4 -6)" />
      <ellipse cx={0} cy={0} rx={7} ry={4.4} fill={S.bee} />
      <path d="M -2.6 -4.1 L -2.6 4.1 M 0.6 -4.4 L 0.6 4.4 M 3.6 -3.6 L 3.6 3.6" stroke={S.beeBlack} strokeWidth={1.5} />
      <circle cx={-7.5} cy={-0.5} r={2.8} fill={S.beeBlack} />
      <path d="M -9 -2.5 L -12 -6 M -8 -3 L -9.5 -7" stroke={S.beeBlack} strokeWidth={0.8} strokeLinecap="round" />
      <path d="M -3 4 L -4 7 M 1 4.3 L 1 7.5" stroke={S.beeBlack} strokeWidth={0.8} strokeLinecap="round" />
    </g>
  )
}

function PlantScene({ u }: { u: number }) {
  const N = 9
  const dry = kf(u, [0, 0, 0, 0, 0, 0, 0, 0.3, 1])
  const top = kf(u, [GROUND + 30, GROUND + 30, GROUND + 4, 124, 100, 54, 46, 50, 54])
  const stemW = kf(u, [1.6, 1.6, 2.2, 2.8, 3.6, 6, 6.6, 6.6, 6.2])
  const rootLen = kf(u, [0, 18, 34, 42, 48, 52, 54, 54, 54])
  const branch = kf(u, [0, 0, 0.5, 0.8, 1, 1, 1, 1, 1])
  const bend = kf(u, [0, 0, 0, 0, 0, 0, 0, 1, 1])
  const stemCol = mix(S.stem, S.dry, dry)
  const stemEdge = mix(S.stemEdge, S.dryEdge, dry)
  const upright = on(u, N, [3, 4, 5, 6, 7, 8])
  const hook = on(u, N, [2])
  // The seed's pointed end, where the root comes out.
  const rootTop = { x: SEED_AT.x + 4, y: SEED_AT.y + 12 }
  const sideRoots: [number, number, number][] = [[0.28, -1, 18], [0.4, 1, 20], [0.55, -1, 16], [0.68, 1, 14], [0.8, -1, 10]]
  const base = { x: SEED_AT.x - 1, y: SEED_AT.y - 10 }
  const head = { x: 182, y: top }
  // A ripe head is heavy: the top of the stem bends over and the head hangs face down.
  const end = { x: head.x + 14 * bend, y: top + 4 * bend }
  // Once the seed is spent, the stem runs down into the root it grew from.
  const stem = `M ${rootTop.x} ${rootTop.y} C ${base.x + 1} ${GROUND} ${head.x - 2} ${f1((GROUND + top) / 2)} ${head.x} ${f1(top)} C ${head.x} ${f1(top - 12 * bend)} ${f1(head.x + 12 * bend)} ${f1(top - 12 * bend)} ${f1(end.x)} ${f1(end.y)}`
  const faceAt = { x: end.x, y: end.y + 9 * bend }
  const petalLen = kf(u, [0, 0, 0, 0, 0, 0, 15, 6, 0])
  const discR = kf(u, [9, 9, 9, 9, 9, 9, 13, 14, 14])
  const leaves: { y: number; side: 1 | -1; size: number[] }[] = [
    { y: 110, side: -1, size: [0, 0, 0, 0, 0.55, 1.2, 1.25, 1.2, 1.15] },
    { y: 106, side: 1, size: [0, 0, 0, 0, 0.5, 1.2, 1.25, 1.2, 1.15] },
    { y: 90, side: -1, size: [0, 0, 0, 0, 0, 1.1, 1.15, 1.1, 1.05] },
    { y: 82, side: 1, size: [0, 0, 0, 0, 0, 1.05, 1.1, 1.05, 1] },
    { y: 70, side: -1, size: [0, 0, 0, 0, 0, 0.75, 0.9, 0.9, 0.85] },
  ]
  const fallTo: P[] = [{ x: 132, y: GROUND - 3 }, { x: 226, y: GROUND - 3 }, { x: 250, y: GROUND + 12 }, { x: 244, y: 126 }, { x: 122, y: 128 }]
  return (
    <g>
      {/* The soil, cut away: a few pebbles and specks so it reads as earth, and grass along the top. */}
      <rect x={0} y={GROUND} width={W} height={H - GROUND} fill={S.soil} />
      <line x1={0} y1={GROUND} x2={W} y2={GROUND} stroke={S.soilEdge} strokeWidth={2} />
      {[[30, 170, 5, 3], [96, 214, 6, 3.5], [262, 190, 5, 3], [318, 222, 7, 4], [128, 176, 3.5, 2.4], [300, 166, 4, 2.6]].map(([x, y, rx, ry]) => <ellipse key={`${x},${y}`} cx={x} cy={y} rx={rx} ry={ry} fill={S.pebble} stroke={S.soilEdge} strokeWidth={0.8} />)}
      {[[60, 166], [74, 196], [118, 228], [150, 200], [224, 218], [246, 170], [286, 204], [340, 182], [22, 232], [206, 236]].map(([x, y]) => <circle key={`${x},${y}`} cx={x} cy={y} r={1.3} fill={S.speck} />)}
      {[22, 52, 92, 270, 306, 340].map((x, i) => (
        <path key={x} d={`M ${x} ${GROUND} q -3 -6 -5 -11 M ${x + 2} ${GROUND} q 0 -8 ${i % 2 ? 2 : -1} -14 M ${x + 4} ${GROUND} q 3 -5 6 -9`} fill="none" stroke={S.grass} strokeWidth={1.6} strokeLinecap="round" />
      ))}

      {/* Roots: the main root first, then side roots, all with a dark edge so they read against the soil. */}
      {rootLen > 0.5 && (
        <g fill="none" strokeLinecap="round">
          <path d={`M ${rootTop.x} ${rootTop.y} C ${rootTop.x + 2} ${f1(rootTop.y + rootLen * 0.4)} ${rootTop.x - 3} ${f1(rootTop.y + rootLen * 0.7)} ${rootTop.x} ${f1(rootTop.y + rootLen)}`} stroke={S.rootEdge} strokeWidth={4.4} />
          <path d={`M ${rootTop.x} ${rootTop.y} C ${rootTop.x + 2} ${f1(rootTop.y + rootLen * 0.4)} ${rootTop.x - 3} ${f1(rootTop.y + rootLen * 0.7)} ${rootTop.x} ${f1(rootTop.y + rootLen)}`} stroke={S.root} strokeWidth={2.4} />
          {sideRoots.map(([k, dir, l]) => {
            const y = rootTop.y + rootLen * k
            const len = l * branch * (1 - k * 0.4)
            if (len < 1) return null
            const d = `M ${rootTop.x} ${f1(y)} q ${f1(dir * len * 0.6)} ${f1(len * 0.15)} ${f1(dir * len)} ${f1(len * 0.55)}`
            return (
              <g key={k}>
                <path d={d} stroke={S.rootEdge} strokeWidth={2.6} />
                <path d={d} stroke={S.root} strokeWidth={1.2} />
              </g>
            )
          })}
        </g>
      )}
      <Fade op={on(u, N, [0, 1, 2])}><SunSeed at={SEED_AT} rot={70} split={kf(u, [0, 1, 1])} /></Fade>
      {/* The hooked shoot, pushing up through the soil. */}
      <Fade op={hook}>
        <path d={`M ${base.x} ${base.y} C ${base.x + 1} 166 ${base.x + 4} ${GROUND + 2} ${base.x + 2} ${GROUND - 4} C ${base.x} ${GROUND - 9} ${base.x - 7} ${GROUND - 8} ${base.x - 8} ${GROUND + 1}`} fill="none" stroke={S.stemEdge} strokeWidth={4.6} strokeLinecap="round" />
        <path d={`M ${base.x} ${base.y} C ${base.x + 1} 166 ${base.x + 4} ${GROUND + 2} ${base.x + 2} ${GROUND - 4} C ${base.x} ${GROUND - 9} ${base.x - 7} ${GROUND - 8} ${base.x - 8} ${GROUND + 1}`} fill="none" stroke={S.pale} strokeWidth={2.8} strokeLinecap="round" />
        <path d={`M ${base.x - 13} ${GROUND} q 3 -3 6 -2 M ${base.x + 6} ${GROUND - 2} q 3 -1 6 2`} fill="none" stroke={S.soilEdge} strokeWidth={1.6} strokeLinecap="round" />
      </Fade>
      {/* The stem and everything on it. */}
      <Fade op={upright}>
        <path d={stem} fill="none" stroke={stemEdge} strokeWidth={f1(stemW + 1.8)} strokeLinecap="round" />
        <path d={stem} fill="none" stroke={stemCol} strokeWidth={f1(stemW)} strokeLinecap="round" />
        {leaves.map((l, i) => {
          if (l.y < top + 2) return null
          return <SunLeaf key={i} at={{ x: 181, y: l.y }} side={l.side} size={kf(u, l.size)} dry={dry} />
        })}
      </Fade>
      {/* The two seed leaves: at the top of the seedling, then left low as it grows past them, then withered. */}
      <Fade op={on(u, N, [3, 4, 5]) * kf(u, [1, 1, 1, 1, 1, 0.8, 0, 0, 0])}>
        {[-1, 1].map((k) => {
          const cy = kf(u, [121, 121, 121, 121, 121, 123])
          return <ellipse key={k} cx={181 + k * 10} cy={f1(cy)} rx={10} ry={4.6} fill={mix(S.coty, '#C9C077', kf(u, [0, 0, 0, 0, 0, 1]))} stroke={S.stemEdge} strokeWidth={1} transform={`rotate(${k * -16} ${181 + k * 10} ${f1(cy)})`} />
        })}
      </Fade>
      {/* The empty seed coat, pushed off by the seed leaves. */}
      <Fade op={on(u, N, [3]) + on(u, N, [4]) * 0.7}><SunSeed at={{ x: 204, y: GROUND - 3 }} rot={8} k={1.2} /></Fade>
      {/* The bud, the flower and the seed head, at the top of the stem. */}
      <Fade op={on(u, N, [5])} transform={`translate(${head.x} ${f1(top)})`}>
        {Array.from({ length: 10 }, (_, i) => i).map((i) => <path key={i} d="M 0 0 L 2.8 -11 L -2.8 -11 Z" fill={S.bract} transform={`rotate(${i * 36})`} />)}
        <circle r={7} fill="#7FAF55" stroke={S.stemEdge} strokeWidth={1} />
      </Fade>
      <Fade op={on(u, N, [6, 7, 8])} transform={`translate(${f1(faceAt.x)} ${f1(faceAt.y)}) rotate(${f1(18 * bend)}) scale(1 ${(1 - 0.58 * bend).toFixed(3)})`}>
        {Array.from({ length: 16 }, (_, i) => i).map((i) => <path key={i} d={`M 0 0 L 3 ${f1(-discR - 4)} L -3 ${f1(-discR - 4)} Z`} fill={mix(S.bract, S.dry, dry)} transform={`rotate(${i * 22.5 + 11})`} />)}
        {petalLen > 0.5 && Array.from({ length: 21 }, (_, i) => i).map((i) => (
          <path key={`p${i}`} d={`M -3 ${f1(-discR + 1)} C -3.4 ${f1(-discR - petalLen * 0.6)} -1 ${f1(-discR - petalLen)} 0 ${f1(-discR - petalLen)} C 1 ${f1(-discR - petalLen)} 3.4 ${f1(-discR - petalLen * 0.6)} 3 ${f1(-discR + 1)} Z`} fill={mix(S.petal, S.petalDry, kf(u, [0, 0, 0, 0, 0, 0, 0, 1, 1]))} stroke={S.petalEdge} strokeWidth={0.6} transform={`rotate(${f1((i * 360) / 21)})`} />
        ))}
        <circle r={f1(discR)} fill={mix(S.disc, '#3E2915', dry)} stroke={S.discRing} strokeWidth={1.4} />
        {Array.from({ length: 34 }, (_, i) => i).map((i) => {
          const r = Math.sqrt(i + 0.5) * (discR / 6.2)
          const a = i * 2.39996
          return <ellipse key={`s${i}`} cx={f1(r * Math.cos(a))} cy={f1(r * Math.sin(a))} rx={1} ry={0.7} fill={S.discSeed} transform={`rotate(${f1((a * 180) / Math.PI)} ${f1(r * Math.cos(a))} ${f1(r * Math.sin(a))})`} />
        })}
        {/* Hanging, its green back is uppermost. */}
        {bend > 0.02 && <path d={`M ${f1(-discR - 3)} -2 C ${f1(-discR - 2)} ${f1(-discR - 14)} ${f1(discR + 2)} ${f1(-discR - 14)} ${f1(discR + 3)} -2 Z`} fill={mix(S.bract, S.dry, dry)} stroke={stemEdge} strokeWidth={1} opacity={bend >= 0.99 ? undefined : bend.toFixed(2)} />}
      </Fade>
      <Fade op={on(u, N, [6])} transform="translate(226 28) scale(1.5)"><Bee /></Fade>
      {/* Ripe seeds falling out of the dry head, and lying on the soil, one of them pressed in. */}
      {fallTo.map((to, i) => {
        const k = clamp(u - 7, 0, 1)
        if (k <= 0.01) return null
        const at = { x: lerp(faceAt.x, to.x, k), y: lerp(faceAt.y + 4, to.y, k * k) }
        return <SunSeed key={i} at={at} rot={-20 + i * 37} k={1.2} />
      })}
    </g>
  )
}

// ---------------------------------------------------------------------------
// The short names on the picture. Each sits nearer its own part than any other, and shows only at the moments named.

export type Label = { text: string; x: number; y: number; anchor: 'start' | 'middle' | 'end'; part: P; at: number[]; ink: string; halo: string; leader?: [P, P] }

export function labelsOf(life: string): Label[] {
  if (life === 'frog') {
    return [
      { text: 'frogspawn', x: 137, y: 135, anchor: 'start', part: { x: 127, y: 128 }, at: [0, 1], ink: '#2F4E61', halo: F.water },
      { text: 'parent', x: 150, y: 44, anchor: 'middle', part: { x: 150, y: 54 }, at: [0], ink: SOFT, halo: PLATE },
      { text: 'lily pad', x: 116, y: 80, anchor: 'end', part: { x: 124, y: 84 }, at: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], ink: SOFT, halo: PLATE },
      { text: 'pond weed', x: 92, y: 196, anchor: 'start', part: { x: 82, y: 192 }, at: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], ink: '#2F4E61', halo: F.water },
      { text: 'stone', x: 247, y: 62, anchor: 'middle', part: { x: 247, y: 78 }, at: [0, 1, 2, 3, 4, 5, 7, 8, 9], ink: SOFT, halo: PLATE },
      { text: 'pond', x: 180, y: 212, anchor: 'middle', part: { x: 180, y: 200 }, at: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], ink: '#2F4E61', halo: F.water },
    ]
  }
  if (life === 'plant') {
    return [
      { text: 'soil', x: 22, y: 206, anchor: 'start', part: { x: 30, y: 196 }, at: [0, 1, 2, 3, 4, 5, 6, 7, 8], ink: '#4A3320', halo: S.soil },
      { text: 'seed', x: 196, y: 192, anchor: 'start', part: { x: 186, y: 187 }, at: [0, 1, 2], ink: '#4A3320', halo: S.soil },
      { text: 'bee', x: 242, y: 31, anchor: 'start', part: { x: 234, y: 26 }, at: [6], ink: SOFT, halo: PLATE },
    ]
  }
  const egg = leafAt(L1, 0.56, 0.22)
  return [
    { text: 'egg', x: Math.round(egg.x), y: 124, anchor: 'middle', part: { x: egg.x, y: egg.y - 6 }, at: [0, 1], ink: SOFT, halo: PLATE, leader: [{ x: egg.x, y: 128 }, { x: egg.x, y: egg.y - 8 }] },
    { text: 'parent', x: 64, y: 22, anchor: 'middle', part: { x: 64, y: 34 }, at: [0], ink: SOFT, halo: PLATE },
    { text: 'flowers', x: 156, y: 46, anchor: 'end', part: { x: 166, y: 52 }, at: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12], ink: SOFT, halo: PLATE },
    { text: 'milkweed', x: 190, y: 232, anchor: 'start', part: { x: 180, y: 226 }, at: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], ink: SOFT, halo: PLATE },
  ]
}

/** The box a label's words take, at 12 px bold. */
export function labelBox(l: Label) {
  const wide = l.text.length * 6.9
  const left = l.anchor === 'start' ? l.x : l.anchor === 'end' ? l.x - wide : l.x - wide / 2
  return { left, right: left + wide, top: l.y - 10, bottom: l.y + 3 }
}

function Names({ life, u }: { life: string; u: number }) {
  const n = lifeOfName(life)
  return (
    <g aria-hidden="true" fontFamily={FONT} pointerEvents="none">
      {labelsOf(life).map((l) => {
        const op = on(u, n, l.at)
        if (op <= 0.01) return null
        return (
          <g key={l.text} opacity={op >= 0.99 ? undefined : f1(op)}>
            {l.leader && <line x1={f1(l.leader[0].x)} y1={f1(l.leader[0].y)} x2={f1(l.leader[1].x)} y2={f1(l.leader[1].y)} stroke={SOFT} strokeWidth={1} />}
            <text x={l.x} y={l.y} textAnchor={l.anchor} fontSize={12} fontWeight={700} fill={l.ink} stroke={l.halo} strokeWidth={3} paintOrder="stroke" strokeLinejoin="round">{l.text}</text>
          </g>
        )
      })}
    </g>
  )
}
const lifeOfName = (life: string) => (life === 'frog' ? 10 : life === 'plant' ? 9 : 13)

// ---------------------------------------------------------------------------
// The control: one time slider with a step back and a step on, in atom's quiet row.

const STEP = 'nodrag flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-lg border-2 border-ss-line bg-ss-panel text-[16px] font-extrabold leading-none text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'
/** The track's own inset, so the thumb's middle reaches both ends. */
const INSET = 9

function TimeTrack({ value, min, max, disabled, text, scrub, commit }: {
  value: number; min: number; max: number; disabled: boolean; text: string; scrub(v: number): void; commit(step: number): void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const held = useRef(false)
  const span = Math.max(1, max - min)
  const frac = clamp((value - min) / span, 0, 1)
  const at = (clientX: number) => {
    const r = ref.current?.getBoundingClientRect()
    if (!r || r.width <= INSET * 2) return value
    return min + clamp((clientX - r.left - INSET) / (r.width - INSET * 2), 0, 1) * span
  }
  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (disabled || e.button !== 0) return
    held.current = true
    e.currentTarget.setPointerCapture?.(e.pointerId)
    scrub(at(e.clientX))
  }
  const move = (e: PointerEvent<HTMLDivElement>) => { if (held.current) scrub(at(e.clientX)) }
  const up = (e: PointerEvent<HTMLDivElement>) => {
    if (!held.current) return
    held.current = false
    commit(clamp(Math.round(at(e.clientX)), min, max))
  }
  const key = (e: KeyboardEvent) => {
    const by = ({ ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 3, PageDown: -3 } as Record<string, number>)[e.key]
    if (by === undefined && e.key !== 'Home' && e.key !== 'End') return
    e.preventDefault()
    e.stopPropagation()
    if (disabled) return
    const now = Math.round(value)
    commit(e.key === 'Home' ? min : e.key === 'End' ? max : clamp(now + by, min, max))
  }
  const pos = (f: number) => `calc(${INSET}px + (100% - ${INSET * 2}px) * ${f.toFixed(4)})`
  return (
    <div
      ref={ref} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
      className={`nodrag relative h-7 min-w-0 flex-1 touch-none select-none ${disabled ? 'cursor-default opacity-60' : 'cursor-pointer'}`}
    >
      <span className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-ss-line" style={{ left: INSET, right: INSET }} />
      <span className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full" style={{ left: INSET, width: `calc((100% - ${INSET * 2}px) * ${frac.toFixed(4)})`, background: 'var(--subject)' }} />
      {Array.from({ length: max - min + 1 }, (_, i) => i).map((i) => (
        <span key={i} className="pointer-events-none absolute top-1/2 h-[5px] w-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: pos(i / span), background: i / span <= frac + 1e-6 ? '#FFFFFF' : '#94A3B8' }} />
      ))}
      <span
        role="slider" tabIndex={disabled ? -1 : 0} aria-label="Time" aria-valuemin={min} aria-valuemax={max} aria-valuenow={Math.round(value)} aria-valuetext={text}
        aria-disabled={disabled || undefined} onKeyDown={key}
        className="absolute top-1/2 h-[20px] w-[20px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] bg-white outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--subject)] focus-visible:ring-offset-2"
        style={{ left: pos(frac), borderColor: 'var(--subject)' }}
      />
    </div>
  )
}

/** Eases the drawing towards the moment set, so each change is seen happening; follows a drag directly. */
function useShown(target: number, scrubbing: number | null, reduced: boolean): number {
  const [u, setU] = useState(target)
  const live = useRef(target)
  useEffect(() => {
    if (reduced) return
    if (scrubbing !== null) {
      live.current = scrubbing
      setU(scrubbing)
      return
    }
    const from = live.current
    const to = target
    if (Math.abs(to - from) < 1e-3) {
      live.current = to
      setU(to)
      return
    }
    const dur = clamp(900 * Math.abs(to - from), 700, 1800)
    let raf = 0
    let t0 = 0
    const tick = (t: number) => {
      if (!t0) t0 = t
      const k = Math.min(1, (t - t0) / dur)
      const e = k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2
      live.current = from + (to - from) * e
      setU(live.current)
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, scrubbing, reduced])
  if (reduced) return Math.round(scrubbing ?? target)
  return u
}

function Scene({ life, u, bite }: { life: string; u: number; bite: string }) {
  if (life === 'frog') return <FrogScene u={u} />
  if (life === 'plant') return <PlantScene u={u} />
  return <ButterflyScene u={u} ids={{ bite }} />
}

export function LifeCyclesView({ config, state, setState, marked, reduced, locked }: Props) {
  const now = marked === 'shown' ? lifeCyclesEngine.solve(config) : state
  const info = lifeOf(config)
  const life = (['butterfly', 'frog', 'plant'] as string[]).includes(config.life) ? config.life : 'butterfly'
  const { min, max } = rangeOf(config)
  const step = stepOf(config, now)
  const [scrub, setScrub] = useState<number | null>(null)
  const u = useShown(step, scrub, reduced)
  const showing = clamp(Math.round(scrub ?? step), 0, max)
  const moment = info.moments[showing]
  const time = timeText(life, moment.day)
  const frozen = locked || marked === 'right' || marked === 'shown'
  const raw = useId()
  const bite = `lc-bite-${raw.replace(/[^a-zA-Z0-9_-]/g, '')}`
  const clip = `lc-plate-${raw.replace(/[^a-zA-Z0-9_-]/g, '')}`

  const commit = (next: number) => {
    setScrub(null)
    if (frozen) return
    const s = clamp(next, min, max)
    if (s !== step || state?.step !== s) setState({ step: s })
  }
  const said = marked === 'right' || marked === 'shown' ? working(config, now) : marked === 'wrong' ? madeText(config, now) : ''
  const lead = said.match(/^((?:Yes\. )?[^.]*\.)\s*(.*)$/)

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-2 [&:has(:focus-visible)_.lc-kbd]:block">
      <p className="flex items-baseline gap-2">
        <span className="shrink-0 text-[12px] font-bold text-ss-slate">Goal</span>
        <span className="text-[13px] font-extrabold leading-snug text-ss-ink" data-goal>{goalOf(config)}</span>
      </p>
      <figure className="m-0 flex w-full flex-col gap-1.5">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${time}. ${moment.seen}`} className="block h-auto w-full select-none" data-life={life} data-moment={showing}>
          <defs>
            <clipPath id={clip}><rect x={0.75} y={0.75} width={W - 1.5} height={H - 1.5} rx={16} /></clipPath>
          </defs>
          <rect x={0.75} y={0.75} width={W - 1.5} height={H - 1.5} rx={16} fill={PLATE} />
          <g clipPath={`url(#${clip})`}>
            <Scene life={life} u={u} bite={bite} />
          </g>
          <Names life={life} u={u} />
          <rect x={0.75} y={0.75} width={W - 1.5} height={H - 1.5} rx={16} fill="none" stroke={PLATE_EDGE} strokeWidth={1.5} />
        </svg>
        <figcaption className="text-center text-[12px] font-bold text-ss-slate">{info.caption}</figcaption>
      </figure>

      <div className="flex items-center gap-1.5">
        <span className="w-9 shrink-0 text-[12px] font-bold text-ss-slate">Time</span>
        <button type="button" aria-label="Go back in time" className={STEP} disabled={frozen || step <= min} onClick={() => commit(step - 1)}>−</button>
        <TimeTrack value={scrub ?? step} min={min} max={max} disabled={frozen} text={time} scrub={(v) => { if (!frozen) setScrub(v) }} commit={commit} />
        <button type="button" aria-label="Let time pass" className={STEP} disabled={frozen || step >= max} onClick={() => commit(step + 1)}>+</button>
        <span className="w-[66px] shrink-0 text-right text-[15px] font-extrabold tabular-nums text-ss-ink" data-time>{time}</span>
      </div>

      <p className="lc-kbd hidden text-[12px] font-semibold text-ss-slate">The arrow keys move time a step at a time.</p>
      <span className="sr-only" aria-live="polite">{`${time}. ${moment.seen}`}</span>
      {marked !== 'idle' && (
        <div className="rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2">
          <p className="text-[13px] font-extrabold leading-snug text-ss-ink">{lead ? lead[1] : said}</p>
          {lead && lead[2] && <p className="mt-0.5 text-[12px] font-semibold leading-snug text-ss-slate">{lead[2]}</p>}
        </div>
      )}
    </div>
  )
}
