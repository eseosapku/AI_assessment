'use client'
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode } from 'react'
import type { SceneMarked, SceneViewProps } from '../types'
import type { Amounts, ArtConfig, ArtState, MotifName, Paint, Print } from './config'
import { amountsOf, artStudioEngine, dabsOf, givenPrints, heldFlip, heldTurn, hexOf, madeText, printsOf, spotKey, targetAmounts, working } from './config'

type Props = SceneViewProps<ArtConfig, ArtState>

// A painter's table: a warm, quiet plate with its own colours in both themes, so each part keeps its contrast. Flat colours only.
const TABLE = '#F6EDDD'
const TABLE_EDGE = '#D9C7A8'
const PLANK = '#EBDEC8'
const INK = '#3A2A1B'
const SOFT = '#6A5540'
const FONT = 'system-ui, sans-serif'
// Birch for the palette and the easel, with a darker edge.
const WOOD = '#DDB98D'
const WOOD_EDGE = '#A67C4E'
const GRAIN = '#CFA877'
const EASEL = '#B98F5F'
// The canvas and the room in the painting.
const CANVAS = '#F7F2E7'
const WEAVE = '#E4DAC6'
const CANVAS_SIDE = '#C9BDA5'
const WALL = '#C7BBA6'
const SHELF = '#A68C6C'
const SHELF_DARK = '#8C7558'

export const W = 360
export const MIX_H = 256
export const REPEAT_H = 236

const TAU = Math.PI * 2
const f1 = (n: number) => n.toFixed(1)
const ease = (t: number) => t * t * (3 - 2 * t)
const clamp01 = (t: number) => Math.max(0, Math.min(1, t))

/** The buttons the page's other scenes use. */
const SMALL_BUTTON = 'nodrag flex h-7 shrink-0 select-none items-center justify-center whitespace-nowrap rounded-lg border-2 border-ss-line bg-ss-panel px-2 text-[12px] font-bold text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'

// ---------------------------------------------------------------------------
// The palette: where everything sits. Written here because the view reads it as it loads.

export const MIX_X = 252
export const MIX_Y = 148
/** Each paint's squeeze of colour, round the top of the palette; light to dark, as a painter sets one out. */
export const DOLLOPS: { paint: Paint; x: number; y: number; edge: string; shine: string; labelX: number; labelY: number }[] = [
  { paint: 'white', x: 184, y: 86, edge: '#A99C86', shine: '#FFFFFF', labelX: 184, labelY: 116 },
  { paint: 'yellow', x: 222, y: 46, edge: '#B98F00', shine: '#FFF3A0', labelX: 222, labelY: 76 },
  { paint: 'red', x: 270, y: 36, edge: '#A32631', shine: '#FBA3A9', labelX: 270, labelY: 66 },
  { paint: 'blue', x: 309, y: 62, edge: '#004A8C', shine: '#7DB5EA', labelX: 309, labelY: 92 },
  { paint: 'black', x: 331, y: 126, edge: '#111011', shine: '#6E6C6E', labelX: 328, labelY: 156 },
]
/** The size of the mix, from how much paint is in it. */
export const mixRadius = (dabs: number) => (dabs <= 0 ? 0 : 18 + 29 * Math.sqrt(Math.min(dabs, 12) / 12))

export const PALETTE = 'M 238 12 C 304 8 354 52 354 118 C 354 190 306 244 244 244 C 196 244 150 220 148 182 C 147 160 170 154 172 136 C 174 120 148 112 148 84 C 148 42 192 16 238 12 Z'
const BRUSH_REST = { x: 250, y: 238, a: -22 }

function blobPath(cx: number, cy: number, r: number): string {
  const n = 56
  let d = ''
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU
    const rr = r * (1 + 0.05 * Math.sin(3 * a + 1) + 0.03 * Math.sin(5 * a + 4))
    d += `${i ? 'L' : 'M'}${f1(cx + rr * Math.cos(a))} ${f1(cy + rr * Math.sin(a))}`
  }
  return `${d}Z`
}

/**
 * A round dab, sheared by the stirring: paint near the middle goes round faster than paint near the rim, so the dab winds out
 * into a long thin streak, as it does on a real palette. `turned` is how far the stirring has gone, in radians.
 */
export function streakPath(seed: { x: number; y: number; r: number }, R: number, turned: number): string {
  const n = 90
  let d = ''
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU
    const px = seed.x + seed.r * Math.cos(a)
    const py = seed.y + seed.r * Math.sin(a)
    const rho = Math.hypot(px, py)
    const phi = Math.atan2(py, px) + turned * (0.55 + 0.85 * (1 - Math.min(1, rho / Math.max(1, R))))
    d += `${i ? 'L' : 'M'}${f1(MIX_X + rho * Math.cos(phi))} ${f1(MIX_Y + rho * Math.sin(phi))}`
  }
  return `${d}Z`
}

/** The ridge a brush leaves in wet paint: one slow curl, in the mix's own darker colour. */
function ridgePath(R: number): string {
  let d = ''
  for (let i = 0; i <= 24; i++) {
    const a = 0.6 + (i / 24) * 4.2
    const r = R * (0.72 - (i / 24) * 0.46)
    d += `${i ? 'L' : 'M'}${f1(MIX_X + r * Math.cos(a))} ${f1(MIX_Y + r * Math.sin(a))}`
  }
  return d
}

const sumOf = (a: Amounts) => (['white', 'yellow', 'red', 'blue', 'black'] as Paint[]).reduce((s, p) => s + (a[p] ?? 0), 0)
const withPaint = (a: Amounts, p: Paint, by: number): Amounts => ({ ...a, [p]: (a[p] ?? 0) + by })

/** Everything the mix sets in the picture, for the first render and for every frame after. */
function mixLook(a: Amounts) {
  const total = sumOf(a)
  // A nearly wiped palette shrinks away, instead of vanishing at full size.
  const R = mixRadius(total) * Math.min(1, total * 3)
  if (total <= 0.01) return { R: 0, fill: '#000000', edge: '#000000', ridge: '#000000', shine: '#FFFFFF', patch: 0 }
  return {
    R,
    fill: hexOf(a),
    edge: hexOf(withPaint(a, 'black', total * 0.16)),
    ridge: hexOf(withPaint(a, 'black', total * 0.08)),
    shine: hexOf(withPaint(a, 'white', total * 0.9)),
    patch: Math.min(1, total),
  }
}

// ---------------------------------------------------------------------------
// The drawing.

/** The brush, drawn along +x from the tip at the origin. */
function Brush({ tip }: { tip: string }) {
  return (
    <g data-brush-body>
      <path d="M 0 0 C 4 -3.5 11 -4.5 15 -3.6 L 15 3.6 C 11 4.5 4 3.5 0 0 Z" fill="#6F4F31" />
      <path data-brush-tip d="M 0 0 C 3 -2.5 7 -3.2 9.5 -3.2 L 9.5 3.2 C 7 3.2 3 2.5 0 0 Z" fill={tip} />
      <path d="M 15 -3.6 L 27 -2.8 L 27 2.8 L 15 3.6 Z" fill="#AEB2B5" stroke="#7E8387" strokeWidth={0.8} />
      <line x1={20} y1={-3.2} x2={20} y2={3.2} stroke="#7E8387" strokeWidth={0.8} />
      <path d="M 27 -2.8 C 48 -4 70 -2.6 104 -0.9 L 104 0.9 C 70 2.6 48 4 27 2.8 Z" fill="#7B3F2A" stroke="#57291A" strokeWidth={0.8} />
    </g>
  )
}

/** A squeeze of paint from the tube: a mound, a smaller curl on top, and the wet shine. */
function Dollop({ fill, edge, shine }: { fill: string; edge: string; shine: string }) {
  return (
    <g>
      <path d="M -15 4 C -16 -6 -7 -13 1 -13 C 10 -13 16 -5 15 4 C 14 11 6 13 -1 13 C -9 13 -14 10 -15 4 Z" fill={fill} stroke={edge} strokeWidth={1.4} />
      <path d="M -7 3 C -9 -3 -3 -7 2 -7 C 7 -7 9 -2 7 2" fill="none" stroke={edge} strokeWidth={1.2} strokeLinecap="round" opacity={0.65} />
      <path d="M -10 -4 C -8 -8 -4 -10 0 -10.4" fill="none" stroke={shine} strokeWidth={2} strokeLinecap="round" />
    </g>
  )
}

const JUG = 'M 56 54 C 57 62 58 67 54 74 C 41 88 35 107 41 127 C 45 141 52 149 58 154 L 88 154 C 96 148 104 139 107 125 C 111 107 103 88 91 74 C 87 67 88 62 90 54 Z'
const PATCH = 'M 56 97 C 63 90 75 93 83 90 C 91 90 95 100 92 109 C 96 118 90 129 79 128 C 71 132 60 130 56 122 C 51 114 51 104 56 97 Z'

/** The small painting on its easel: a jug on a shelf, the jug's colour the one the learner is after, a patch of it bare. */
function Painting({ want, patchFill, patchOpacity, id }: { want: Amounts; patchFill: string; patchOpacity: number; id: string }) {
  const total = sumOf(want)
  const body = hexOf(want)
  const dark = hexOf(withPaint(want, 'black', total * 0.14))
  const darker = hexOf(withPaint(want, 'black', total * 0.3))
  const light = hexOf(withPaint(want, 'white', total * 0.9))
  return (
    <g>
      {/* The easel: two legs, a post behind the canvas and a ledge for it to stand on. */}
      <g stroke={EASEL} strokeLinecap="round">
        <line x1={46} y1={190} x2={30} y2={246} strokeWidth={5} />
        <line x1={98} y1={190} x2={114} y2={246} strokeWidth={5} />
        <line x1={72} y1={190} x2={72} y2={238} strokeWidth={4.5} />
        <line x1={72} y1={6} x2={72} y2={20} strokeWidth={5} />
        <line x1={36} y1={222} x2={108} y2={222} strokeWidth={3.5} />
      </g>
      <rect x={12} y={185} width={120} height={7} rx={2} fill={WOOD_EDGE} />
      {/* The canvas, with its side showing. */}
      <rect x={14} y={15} width={118} height={171} rx={1.5} fill={CANVAS_SIDE} />
      <rect x={14} y={15} width={115} height={168} rx={1} fill={WALL} />
      <rect x={14} y={132} width={115} height={51} fill={SHELF} />
      <rect x={14} y={132} width={115} height={2} fill={SHELF_DARK} />
      {/* The jug's shadow on the shelf, then the jug. */}
      <ellipse cx={84} cy={156} rx={40} ry={7} fill={SHELF_DARK} />
      <path d="M 54 66 C 26 60 22 106 42 116" fill="none" stroke={dark} strokeWidth={6.5} strokeLinecap="round" />
      <path d={JUG} fill={body} />
      <clipPath id={`${id}-jug`}><path d={JUG} /></clipPath>
      <g clipPath={`url(#${id}-jug)`}>
        {/* Shade down its far side, and a light down the near one; the patch keeps clear of both, on the jug's plain colour. */}
        <path d="M 100 70 C 110 90 106 136 92 158 L 124 158 L 124 70 Z" fill={dark} />
        <path d="M 49 90 C 41 104 41 118 45 130" fill="none" stroke={light} strokeWidth={5} strokeLinecap="round" />
      </g>
      {/* The rim and the lip. */}
      <path d="M 90 54 L 99 47 C 96 53 92 60 89 62 Z" fill={body} />
      <ellipse cx={73} cy={54} rx={18} ry={4.6} fill={darker} />
      <path d="M 55 54 C 58 49 88 49 91 54 C 88 57.5 58 57.5 55 54 Z" fill="none" stroke={body} strokeWidth={1.6} />
      {/* The bare patch: primed canvas with its weave showing, under the learner's paint. */}
      <clipPath id={`${id}-patch`}><path d={PATCH} /></clipPath>
      <path d={PATCH} fill={CANVAS} />
      <g clipPath={`url(#${id}-patch)`} stroke={WEAVE} strokeWidth={1}>
        {[90, 95, 100, 105, 110, 115, 120, 125, 130].map((y) => <line key={y} x1={48} x2={98} y1={y} y2={y} />)}
        {[52, 57, 62, 67, 72, 77, 82, 87, 92].map((x) => <line key={x} x1={x} x2={x} y1={86} y2={134} />)}
      </g>
      {/* Its own colour as an edge, to cover the bare canvas's soft rim: an exact mix leaves no line at all. */}
      <path data-patch d={PATCH} fill={patchFill} stroke={patchFill} strokeWidth={1.6} opacity={patchOpacity} />
    </g>
  )
}

function Palette({ id }: { id: string }) {
  return (
    <g>
      <path d={PALETTE} fill={WOOD} stroke={WOOD_EDGE} strokeWidth={1.6} />
      <clipPath id={`${id}-wood`}><path d={PALETTE} /></clipPath>
      <g clipPath={`url(#${id}-wood)`} fill="none" stroke={GRAIN} strokeWidth={1.1}>
        <path d="M 140 40 C 200 22 280 30 360 22" />
        <path d="M 140 118 C 210 100 290 112 360 92" />
        <path d="M 140 172 C 210 158 280 176 360 150" />
        <path d="M 140 214 C 220 204 290 222 360 196" />
        <path d="M 180 236 C 230 232 280 240 340 222" />
      </g>
      {/* The thumb hole, showing the table through it. */}
      <ellipse cx={188} cy={194} rx={15} ry={12} transform="rotate(-24 188 194)" fill={TABLE} stroke={WOOD_EDGE} strokeWidth={1.6} />
    </g>
  )
}

const say = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`
const DAB_ORDER: Paint[] = ['red', 'yellow', 'blue', 'white', 'black']

/** The dabs in the mix, kept together by paint, so the proportions can be read at a glance. */
function DabRow({ dabs }: { dabs: Paint[] }) {
  const amounts = amountsOf(dabs)
  const used = DAB_ORDER.filter((p) => (amounts[p] ?? 0) > 0)
  return (
    <span className="flex min-h-[14px] flex-wrap items-center gap-x-2 gap-y-1" aria-hidden="true">
      {used.map((p) => (
        <span key={p} className="flex items-center gap-[2px]" data-dab-group={p}>
          {Array.from({ length: amounts[p] ?? 0 }, (_, i) => (
            <span key={i} className="inline-block h-[13px] w-[13px] rounded-full" style={{ background: hexOf({ [p]: 1 }), border: `1.5px solid ${DOLLOPS.find((d) => d.paint === p)?.edge}` }} />
          ))}
        </span>
      ))}
      {!used.length && <span className="text-[12px] font-semibold text-ss-slate">Nothing yet</span>}
    </span>
  )
}

function Said({ marked, text }: { marked: SceneMarked; text: string }) {
  if (marked === 'idle') return null
  const lead = text.match(/^((?:Yes|Near enough)[.:][^.]*\.)\s*(.*)$/)
  return (
    <div className="rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2">
      <p className="text-[13px] font-extrabold leading-snug text-ss-ink">{lead ? lead[1] : text}</p>
      {lead && lead[2] && <p className="mt-0.5 text-[12px] font-semibold leading-snug text-ss-slate">{lead[2]}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// The mix.

type Swirl = { paint: Paint; born: number; at: number }
type Trip = { paint: Paint; start: number; from: { x: number; y: number; a: number }; landed: boolean; goal: Amounts }

/** How long a dab takes to wind out and vanish into the mix, and the brush's trip: to the paint, to the palette, round, and home. */
const SWIRL_MS = 2600
const TO_PAINT = 200
const TO_MIX = 470
const STIR_END = 1900
const HOME = 2350
const MAX_SWIRLS = 3
const STREAKS = 3

function MixCard({ config, state, setState, marked, reduced, locked }: Props) {
  const now = marked === 'shown' ? artStudioEngine.solve(config) : state
  const dabs = dabsOf(now)
  const key = dabs.join(',')
  const amounts = useMemo(() => amountsOf(dabs), [key]) // eslint-disable-line react-hooks/exhaustive-deps
  const want = targetAmounts(config)
  const colourName = config.task === 'mix' ? config.colour : ''
  const finished = marked === 'right' || marked === 'shown'
  const canTouch = !locked && !finished
  const rawId = useId()
  const id = `art${rawId.replace(/[^a-zA-Z0-9]/g, '')}`
  const svgRef = useRef<SVGSVGElement>(null)
  const first = useRef(mixLook(amounts))
  const firstLook = first.current
  const live = useRef({
    shown: amounts, goal: amounts, swirls: [] as Swirl[], trip: null as Trip | null, brush: { ...BRUSH_REST }, raf: 0, last: 0, prev: dabs, tip: '#6F4F31',
  })

  /** Writes one frame straight into the drawing, so that a whole swirl costs React nothing. */
  const paint = (t: number) => {
    const svg = svgRef.current
    if (!svg) return
    const s = live.current
    const look = mixLook(s.shown)
    const set = (sel: string, name: string, value: string) => svg.querySelector(sel)?.setAttribute(name, value)
    const shape = look.R > 0 ? blobPath(MIX_X, MIX_Y, look.R) : ''
    set('[data-mix]', 'd', shape)
    set('[data-mix-clip]', 'd', shape)
    set('[data-mix]', 'fill', look.fill)
    set('[data-mix]', 'stroke', look.edge)
    set('[data-ridge]', 'd', look.R > 26 ? ridgePath(look.R) : '')
    set('[data-ridge]', 'stroke', look.ridge)
    set('[data-shine]', 'd', look.R > 0 ? `M ${f1(MIX_X - look.R * 0.62)} ${f1(MIX_Y - look.R * 0.36)} Q ${f1(MIX_X - look.R * 0.42)} ${f1(MIX_Y - look.R * 0.72)} ${f1(MIX_X - look.R * 0.08)} ${f1(MIX_Y - look.R * 0.76)}` : '')
    set('[data-shine]', 'stroke', look.shine)
    set('[data-patch]', 'fill', look.fill)
    set('[data-patch]', 'stroke', look.fill)
    set('[data-patch]', 'opacity', look.patch.toFixed(3))
    const labelY = MIX_Y + Math.max(look.R, 22) + 16
    set('[data-mix-name]', 'y', f1(labelY))
    set('[data-mix-ring]', 'opacity', look.R > 0 ? '0' : '1')
    // The streaks: each dab starts as nearly its own paint, and ends as the colour of the mix, passing through real mixtures on the way.
    for (let i = 0; i < MAX_SWIRLS * STREAKS; i++) {
      const sw = s.swirls[Math.floor(i / STREAKS)]
      const el = svg.querySelector(`[data-streak="${i}"]`)
      if (!el) continue
      if (!sw) { el.setAttribute('d', ''); continue }
      const age = clamp01((t - sw.born) / SWIRL_MS)
      const left = Math.pow(1 - age, 1.6)
      const turned = 9.5 * (1 - Math.pow(1 - age, 2.2))
      const k = i % STREAKS
      const spread = [0, 0.75, -0.7][k]
      const rho = look.R * [0.5, 0.3, 0.72][k]
      const r = look.R * [0.3, 0.17, 0.15][k]
      el.setAttribute('d', streakPath({ x: rho * Math.cos(sw.at + spread), y: rho * Math.sin(sw.at + spread), r }, look.R, turned))
      el.setAttribute('fill', hexOf(withPaint(s.shown, sw.paint, sumOf(s.shown) * 5 * left)))
    }
    set('[data-brush]', 'transform', `translate(${f1(s.brush.x)} ${f1(s.brush.y)}) rotate(${f1(s.brush.a)})`)
    set('[data-brush-tip]', 'fill', s.tip)
  }

  useEffect(() => {
    const s = live.current
    const prev = s.prev
    s.prev = dabs
    const added = dabs.length === prev.length + 1 && prev.every((p, i) => p === dabs[i]) ? dabs[dabs.length - 1] : null
    if (reduced) {
      s.shown = amounts
      s.goal = amounts
      s.swirls = []
      s.trip = null
      s.brush = { ...BRUSH_REST }
      paint(performance.now())
      return
    }
    const clock = performance.now()
    const land = (trip: Trip, at: number) => {
      trip.landed = true
      s.goal = trip.goal
      const angle = Math.atan2(s.brush.y - MIX_Y, s.brush.x - MIX_X)
      s.swirls = [...s.swirls, { paint: trip.paint, born: at, at: Number.isFinite(angle) ? angle : -1 }].slice(-MAX_SWIRLS)
    }
    // A quick second tap lands the dab already on its way: nothing makes the learner wait.
    if (s.trip && !s.trip.landed) land(s.trip, clock)
    if (added) {
      s.trip = { paint: added, start: clock, from: { ...s.brush }, landed: false, goal: amounts }
    } else if (key !== prev.join(',')) {
      s.goal = amounts
    }
    const tick = (t: number) => {
      const dt = s.last ? Math.min(0.05, (t - s.last) / 1000) : 0.016
      s.last = t
      const trip = s.trip
      if (trip) {
        const age = t - trip.start
        const d = DOLLOPS.find((x) => x.paint === trip.paint)!
        const R = mixRadius(sumOf(s.shown)) || 20
        const stirAt = (u: number) => {
          const a = -1.2 + u * TAU * 2.2
          const rr = R * (0.46 - 0.12 * u)
          return { x: MIX_X + rr * Math.cos(a), y: MIX_Y + rr * Math.sin(a), a: -50 }
        }
        const go = (from: { x: number; y: number; a: number }, to: { x: number; y: number; a: number }, u: number) => {
          const e = ease(clamp01(u))
          return { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e, a: from.a + (to.a - from.a) * e }
        }
        const atPaint = { x: d.x, y: d.y, a: -50 }
        if (age < TO_PAINT) s.brush = go(trip.from, atPaint, age / TO_PAINT)
        else if (age < TO_MIX) {
          s.tip = hexOf({ [trip.paint]: 1 })
          s.brush = go(atPaint, stirAt(0), (age - TO_PAINT) / (TO_MIX - TO_PAINT))
        } else if (age < STIR_END) {
          if (!trip.landed) land(trip, t)
          s.tip = mixLook(s.shown).fill
          s.brush = stirAt(ease((age - TO_MIX) / (STIR_END - TO_MIX)))
        } else if (age < HOME) {
          if (!trip.landed) land(trip, t)
          s.brush = go(stirAt(1), BRUSH_REST, (age - STIR_END) / (HOME - STIR_END))
        } else {
          if (!trip.landed) land(trip, t)
          s.brush = { ...BRUSH_REST }
          s.trip = null
        }
      }
      // The mix drifts to its new colour by real fractions of paint, so red on its way to orange never passes through grey.
      const wiping = sumOf(s.goal) === 0
      const k = 1 - Math.exp(-dt / (wiping ? 0.16 : 0.75))
      const next: Amounts = {}
      let moving = false
      for (const p of DAB_ORDER) {
        const a = s.shown[p] ?? 0
        const g = s.goal[p] ?? 0
        const v = Math.abs(g - a) < 0.004 ? g : a + (g - a) * k
        if (v !== g) moving = true
        if (v > 0) next[p] = v
      }
      s.shown = next
      s.swirls = s.swirls.filter((w) => t - w.born < SWIRL_MS)
      paint(t)
      if (s.trip || s.swirls.length || moving) s.raf = requestAnimationFrame(tick)
      else { s.raf = 0; s.last = 0 }
    }
    if (!s.raf) { s.last = 0; s.raf = requestAnimationFrame(tick) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, reduced])

  useEffect(() => () => { if (live.current.raf) cancelAnimationFrame(live.current.raf); live.current.raf = 0 }, [])

  const add = (p: Paint) => { if (canTouch && dabs.length < 12) setState({ dabs: [...dabs, p] }) }
  const takeBack = () => { if (canTouch && dabs.length) setState({ dabs: dabs.slice(0, -1) }) }
  const wipe = () => { if (canTouch && dabs.length) setState({ dabs: [] }) }

  const full = dabs.length >= 12
  const said = finished ? working(config, now) : marked === 'wrong' ? madeText(config, now) : ''
  const amountsSaid = DAB_ORDER.filter((p) => (amounts[p] ?? 0) > 0).map((p) => say(amounts[p] ?? 0, `dab`) + ` of ${p}`).join(', ')

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-2">
      <figure className="m-0 flex w-full flex-col gap-1.5">
        <div className="relative w-full">
          <svg ref={svgRef} viewBox={`0 0 ${W} ${MIX_H}`} role="img" aria-label={`A small painting of ${/^[aeiou]/.test(colourName) ? 'an' : 'a'} ${colourName} jug stands on an easel, with a bare patch of canvas in the jug. Beside it is a wooden palette with white, yellow, red, blue and black paint, and the mix in its middle.`} className="block h-auto w-full select-none">
            <rect x={0.75} y={0.75} width={W - 1.5} height={MIX_H - 1.5} rx={16} fill={TABLE} stroke={TABLE_EDGE} strokeWidth={1.5} />
            <g stroke={PLANK} strokeWidth={1.5}>
              <line x1={2} x2={W - 2} y1={88} y2={88} />
              <line x1={2} x2={W - 2} y1={176} y2={176} />
            </g>
            <Painting want={want} patchFill={firstLook.fill} patchOpacity={firstLook.patch} id={id} />
            <Palette id={id} />
            {DOLLOPS.map((d) => (
              <g key={d.paint} transform={`translate(${d.x} ${d.y})`} data-dollop={d.paint}>
                <Dollop fill={hexOf({ [d.paint]: 1 })} edge={d.edge} shine={d.shine} />
              </g>
            ))}
            {DOLLOPS.map((d) => (
              <text key={d.paint} x={d.labelX} y={d.labelY} textAnchor="middle" fontFamily={FONT} fontSize={12} fontWeight={700} fill={INK}>{d.paint}</text>
            ))}
            {/* Where the mix will go, until there is paint in it. */}
            <circle data-mix-ring cx={MIX_X} cy={MIX_Y} r={22} fill="none" stroke={WOOD_EDGE} strokeWidth={1.6} strokeDasharray="3 5" strokeLinecap="round" opacity={firstLook.R > 0 ? 0 : 1} />
            <clipPath id={`${id}-mix`}><path data-mix-clip d={firstLook.R > 0 ? blobPath(MIX_X, MIX_Y, firstLook.R) : ''} /></clipPath>
            <path data-mix d={firstLook.R > 0 ? blobPath(MIX_X, MIX_Y, firstLook.R) : ''} fill={firstLook.fill} stroke={firstLook.edge} strokeWidth={1.5} />
            <g clipPath={`url(#${id}-mix)`}>
              {Array.from({ length: MAX_SWIRLS * STREAKS }, (_, i) => <path key={i} data-streak={i} d="" />)}
            </g>
            <path data-ridge d={firstLook.R > 26 ? ridgePath(firstLook.R) : ''} fill="none" stroke={firstLook.ridge} strokeWidth={1.6} strokeLinecap="round" />
            <path data-shine d={firstLook.R > 0 ? `M ${f1(MIX_X - firstLook.R * 0.62)} ${f1(MIX_Y - firstLook.R * 0.36)} Q ${f1(MIX_X - firstLook.R * 0.42)} ${f1(MIX_Y - firstLook.R * 0.72)} ${f1(MIX_X - firstLook.R * 0.08)} ${f1(MIX_Y - firstLook.R * 0.76)}` : ''} fill="none" stroke={firstLook.shine} strokeWidth={2.2} strokeLinecap="round" />
            <text data-mix-name x={MIX_X} y={MIX_Y + Math.max(firstLook.R, 22) + 16} textAnchor="middle" fontFamily={FONT} fontSize={12} fontWeight={700} fill={INK}>your mix</text>
            <g data-brush transform={`translate(${BRUSH_REST.x} ${BRUSH_REST.y}) rotate(${BRUSH_REST.a})`} pointerEvents="none">
              <Brush tip="#6F4F31" />
            </g>
          </svg>
          {DOLLOPS.map((d) => (
            <button
              key={d.paint} type="button" aria-label={`Add a dab of ${d.paint}`} disabled={!canTouch || full} onClick={() => add(d.paint)}
              className="nodrag absolute touch-manipulation rounded-xl outline-none hover:ring-2 hover:ring-[color:var(--subject)] focus-visible:ring-2 focus-visible:ring-[color:var(--subject)] disabled:cursor-default disabled:hover:ring-0"
              style={{ left: `${((d.x - 22) / W) * 100}%`, top: `${((d.y - 17) / MIX_H) * 100}%`, width: `${(44 / W) * 100}%`, height: `${(50 / MIX_H) * 100}%`, border: 'none', background: 'transparent', padding: 0 }}
            />
          ))}
        </div>
        <figcaption className="text-center text-[12px] font-bold text-ss-slate">{full && canTouch ? 'The palette is full: take a dab back, or wipe it.' : 'The bare patch on the jug shows your mix.'}</figcaption>
      </figure>
      <div className="flex items-center justify-between gap-2 border-t border-ss-line pt-1.5">
        <span className="shrink-0 text-[12px] font-bold text-ss-slate">In the mix</span>
        <span className="min-w-0 flex-1"><DabRow dabs={dabs} /></span>
        <span className="flex shrink-0 items-center gap-1">
          <button type="button" aria-label="Take back the last dab" disabled={!canTouch || !dabs.length} onClick={takeBack} className={SMALL_BUTTON}>Take back</button>
          <button type="button" aria-label="Wipe the palette clean" disabled={!canTouch || !dabs.length} onClick={wipe} className={SMALL_BUTTON}>Wipe</button>
        </span>
      </div>
      <span className="sr-only" aria-live="polite">{dabs.length ? `In the mix: ${amountsSaid}.` : 'The palette is clean.'}</span>
      <Said marked={marked} text={said} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// The repeat.

export const CLOTH = { x: 12, y: 12, w: 270, h: 212 }
export const STEP = 30
export const SPOT_X0 = 42
export const SPOT_Y0 = 43
export const spotAt = (p: { x: number; y: number }) => ({ x: SPOT_X0 + p.x * STEP, y: SPOT_Y0 + p.y * STEP })
const LINEN = '#F4EEDF'
const HEM = '#D6C8AE'
const CHALK = '#D3C8B1'
const INDIGO = '#2C3F72'
const BLOCK_REST = { x: 321, y: 62 }

/** One motif, drawn in a 44 px box round the origin, with its lines cut away, as a carved block leaves them. */
function Motif({ name, ink, cut }: { name: MotifName | string; ink: string; cut: string }) {
  if (name === 'fish') {
    return (
      <g>
        <path d="M -9 0 C -3 -13 12 -14 21 0 C 12 14 -3 13 -9 0 Z" fill={ink} />
        <path d="M -8 0 L -21 -12 C -18 -5 -18 5 -21 12 Z" fill={ink} />
        <path d="M 1 -11 L -5 -18 L 9 -13 Z" fill={ink} />
        <g fill="none" stroke={cut} strokeWidth={1.7} strokeLinecap="round">
          <path d="M 7 -8.5 C 10 -3 10 3 7 8.5" />
          <path d="M 0 -6 C 2.5 -2 2.5 2 0 6" />
          <path d="M -5 -3 C -3.5 -1 -3.5 1 -5 3" />
        </g>
        <circle cx={14} cy={-3} r={2.1} fill={cut} />
      </g>
    )
  }
  if (name === 'bird') {
    return (
      <g>
        <path d="M -21 9 C -13 9 -11 4 -9 1 C -7 -7 2 -12 8 -11 C 11 -15 18 -14 18 -9 L 23 -7 L 17 -5 C 16 8 5 15 -6 13 C -12 13 -18 12 -21 9 Z" fill={ink} />
        <path d="M 0 13 L -1 20 M 6 12 L 6.5 20" stroke={ink} strokeWidth={2} strokeLinecap="round" />
        <g fill="none" stroke={cut} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
          <path d="M -8 3 C -2 -3 6 -3 9 1 C 6 7 -2 8 -8 3 Z" />
          <path d="M -3 2.5 L 4 1" />
        </g>
        <circle cx={13} cy={-9.5} r={1.8} fill={cut} />
      </g>
    )
  }
  return (
    <g>
      <path d="M -17 17 C -15 3 -7 -14 18 -19 C 19 -3 11 15 -9 16 C -12 16.4 -15 16.8 -17 17 Z" fill={ink} />
      <path d="M -16 16 L -21 21" stroke={ink} strokeWidth={2.6} strokeLinecap="round" />
      <g fill="none" stroke={cut} strokeWidth={1.7} strokeLinecap="round">
        <path d="M -14 14 C -6 7 4 -4 13 -14" />
        <path d="M -7 7.5 L -7.5 -2" />
        <path d="M -7 7.5 L 3 9" />
        <path d="M 0 0 L 0.5 -9" />
        <path d="M 0 0 L 9.5 2" />
        <path d="M 6 -6.5 L 7 -13" />
        <path d="M 6 -6.5 L 13 -5" />
      </g>
    </g>
  )
}

const facing = (turn: number, flip: boolean) => `rotate(${turn * 90}) scale(${flip ? -1 : 1} 1)`

/** A few bare flecks in each print, different on each, as a hand-pressed block leaves. */
function flecks(p: { x: number; y: number }) {
  const out: { x: number; y: number; r: number }[] = []
  let seed = p.x * 31 + p.y * 17 + 5
  for (let i = 0; i < 6; i++) {
    seed = (seed * 137 + 59) % 509
    const x = (seed % 34) - 17
    seed = (seed * 137 + 59) % 509
    const y = (seed % 34) - 17
    out.push({ x, y, r: 0.6 + (seed % 5) * 0.15 })
  }
  return out
}

function PrintMark({ print, motif, hidden, mine }: { print: Print; motif: string; hidden?: boolean; mine: boolean }) {
  const at = spotAt(print)
  return (
    <g transform={`translate(${at.x} ${at.y})`} opacity={hidden ? 0 : 1} data-print={spotKey(print)} data-mine={mine ? '1' : '0'} data-turn={print.turn} data-flip={print.flip ? '1' : '0'}>
      <g transform={facing(print.turn, print.flip)}>
        <Motif name={motif} ink={INDIGO} cut={LINEN} />
      </g>
      {flecks(print).map((f, i) => <circle key={i} cx={f.x} cy={f.y} r={f.r} fill={LINEN} />)}
    </g>
  )
}

function Block({ motif, turn, flip }: { motif: string; turn: number; flip: boolean }) {
  return (
    <g>
      <rect x={-23} y={-21} width={46} height={46} rx={5} fill={WOOD_EDGE} />
      <rect x={-23} y={-23} width={46} height={46} rx={5} fill={WOOD} stroke={WOOD_EDGE} strokeWidth={1.4} />
      <g transform={`${facing(turn, flip)} scale(0.82)`}>
        <Motif name={motif} ink="#5B3B20" cut={WOOD} />
      </g>
    </g>
  )
}

function RepeatCard({ config, state, setState, marked, reduced, locked }: Props) {
  const now = marked === 'shown' ? artStudioEngine.solve(config) : state
  const rule = config.task === 'repeat' ? config.rule : 'block'
  const motif = config.task === 'repeat' ? config.motif : 'leaf'
  const safeRule = (['block', 'half-drop', 'brick', 'mirror', 'turn'].includes(rule) ? rule : 'block') as Parameters<typeof givenPrints>[0]
  const given = givenPrints(safeRule)
  const mine = printsOf(config, now)
  const turn = heldTurn(now)
  const flip = heldFlip(now)
  const finished = marked === 'right' || marked === 'shown'
  const canTouch = !locked && !finished
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null)
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null)
  // The block's trip to the cloth. The print shows when the block comes down on it.
  const [press, setPress] = useState<{ at: { x: number; y: number }; phase: 'go' | 'down' | 'back'; key: string } | null>(null)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const put = (next: ArtState) => setState({ prints: mine, turn, flip, ...next })
  const spotOf = (e: MouseEvent<HTMLButtonElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    const x = CLOTH.x + ((e.clientX - box.left) / box.width) * CLOTH.w
    const y = CLOTH.y + ((e.clientY - box.top) / box.height) * CLOTH.h
    return { raw: { x, y }, spot: nearest(x, y) }
  }
  const act = (spot: { x: number; y: number }, raw?: { x: number; y: number }) => {
    if (!canTouch) return
    // A tap on one of the learner's prints lifts it, anywhere on it.
    const hit = mine.find((p) => {
      const at = spotAt(p)
      return raw ? Math.hypot(at.x - raw.x, at.y - raw.y) <= 20 : spotKey(p) === spotKey(spot)
    })
    if (hit) { put({ prints: mine.filter((p) => p !== hit) }); return }
    if (given.some((p) => spotKey(p) === spotKey(spot))) return
    const made = { ...spot, turn, flip }
    put({ prints: [...mine, made] })
    if (reduced) return
    timers.current.forEach(clearTimeout)
    const key = spotKey(spot)
    setPress({ at: spotAt(spot), phase: 'go', key })
    timers.current = [
      setTimeout(() => setPress({ at: spotAt(spot), phase: 'down', key }), 240),
      setTimeout(() => setPress({ at: spotAt(spot), phase: 'back', key }), 390),
      setTimeout(() => setPress(null), 800),
    ]
  }
  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const by = ({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] } as Record<string, number[]>)[e.key]
    if (by) {
      e.preventDefault()
      e.stopPropagation()
      const c = cursor ?? { x: 0, y: 0 }
      setCursor({ x: Math.max(0, Math.min(7, c.x + by[0])), y: Math.max(0, Math.min(5, c.y + by[1])) })
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      act(cursor ?? { x: 0, y: 0 })
      if (!cursor) setCursor({ x: 0, y: 0 })
    }
  }
  const onClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (e.detail === 0) return
    const { raw, spot } = spotOf(e)
    setCursor(null)
    act(spot, raw)
  }
  const onMove = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType !== 'mouse' || !canTouch) return
    setGhost(spotOf(e as unknown as MouseEvent<HTMLButtonElement>).spot)
  }

  const blockAt = press && press.phase !== 'back' ? press.at : BLOCK_REST
  const pressing = press?.phase === 'down'
  const hideKey = press && press.phase === 'go' ? press.key : null
  const ghostAt = cursor ?? ghost
  const ghostFree = ghostAt && canTouch && !mine.some((p) => spotKey(p) === spotKey(ghostAt)) && !given.some((p) => spotKey(p) === spotKey(ghostAt))
  const said = finished ? working(config, now) : marked === 'wrong' ? madeText(config, now) : ''
  const needsFlip = rule === 'mirror'
  const needsTurn = rule === 'turn'

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-2 [&:has(button:focus-visible)_.as-kbd]:block">
      <figure className="m-0 flex w-full flex-col gap-1.5">
        <div className="relative w-full">
          <svg viewBox={`0 0 ${W} ${REPEAT_H}`} role="img" aria-label={`A length of cloth, marked with chalk crosses, part printed with a ${motif} in indigo: ${given.length} prints from the block so far and ${mine.length} of yours. Beside it, a carved block on an ink pad.`} className="block h-auto w-full select-none">
            <rect x={0.75} y={0.75} width={W - 1.5} height={REPEAT_H - 1.5} rx={16} fill={TABLE} stroke={TABLE_EDGE} strokeWidth={1.5} />
            <g stroke={PLANK} strokeWidth={1.5}>
              <line x1={2} x2={W - 2} y1={84} y2={84} />
              <line x1={2} x2={W - 2} y1={168} y2={168} />
            </g>
            {/* The cloth, hemmed, with its chalk crosses. */}
            <rect x={CLOTH.x} y={CLOTH.y} width={CLOTH.w} height={CLOTH.h} rx={2} fill={LINEN} stroke={HEM} strokeWidth={1.4} />
            <rect x={CLOTH.x + 5} y={CLOTH.y + 5} width={CLOTH.w - 10} height={CLOTH.h - 10} rx={1} fill="none" stroke={HEM} strokeWidth={1} strokeDasharray="5 4" />
            {/* The chalk brushes off a finished cloth, which leaves only the pattern. */}
            <g stroke={CHALK} strokeWidth={1.2} strokeLinecap="round" data-chalk opacity={finished ? 0 : 1} style={reduced ? undefined : { transition: 'opacity 900ms ease' }}>
              {Array.from({ length: 8 }, (_, x) => Array.from({ length: 6 }, (_, y) => {
                const at = spotAt({ x, y })
                return <path key={`${x},${y}`} d={`M ${at.x - 3} ${at.y} H ${at.x + 3} M ${at.x} ${at.y - 3} V ${at.y + 3}`} />
              }))}
            </g>
            {given.map((p) => <PrintMark key={spotKey(p)} print={p} motif={motif} mine={false} />)}
            {mine.map((p) => <PrintMark key={spotKey(p)} print={p} motif={motif} mine hidden={spotKey(p) === hideKey} />)}
            {ghostFree && (
              <g transform={`translate(${spotAt(ghostAt).x} ${spotAt(ghostAt).y})`} opacity={0.35} data-ghost pointerEvents="none">
                <g transform={facing(turn, flip)}><Motif name={motif} ink={INDIGO} cut={LINEN} /></g>
              </g>
            )}
            {cursor && <rect x={spotAt(cursor).x - 25} y={spotAt(cursor).y - 25} width={50} height={50} rx={6} fill="none" stroke={INK} strokeWidth={2} strokeDasharray="5 4" />}
            {/* The ink pad, in its tin, with the block's place above it. */}
            <rect x={296} y={124} width={50} height={46} rx={4} fill="#8D8F92" stroke="#6B6D70" strokeWidth={1.4} />
            <rect x={301} y={129} width={40} height={36} rx={2.5} fill={INDIGO} />
            <text x={321} y={187} textAnchor="middle" fontFamily={FONT} fontSize={12} fontWeight={700} fill={SOFT}>ink</text>
            <text x={321} y={106} textAnchor="middle" fontFamily={FONT} fontSize={12} fontWeight={700} fill={SOFT}>block</text>
            <g
              data-block data-turn={turn} data-flip={flip ? '1' : '0'} pointerEvents="none"
              style={{ transform: `translate(${blockAt.x}px, ${blockAt.y}px) scale(${pressing ? 0.92 : 1})`, transition: reduced ? undefined : `transform ${press?.phase === 'down' ? 110 : 280}ms ease-in-out` }}
            >
              <Block motif={motif} turn={turn} flip={flip} />
            </g>
          </svg>
          <button
            type="button" aria-label="The cloth: press the block here" disabled={!canTouch} onClick={onClick} onKeyDown={onKey} onPointerMove={onMove} onPointerLeave={() => setGhost(null)}
            className="nodrag absolute touch-manipulation rounded outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--subject)] disabled:cursor-default"
            style={{ left: `${(CLOTH.x / W) * 100}%`, top: `${(CLOTH.y / REPEAT_H) * 100}%`, width: `${(CLOTH.w / W) * 100}%`, height: `${(CLOTH.h / REPEAT_H) * 100}%`, border: 'none', background: 'transparent', padding: 0, cursor: canTouch ? 'pointer' : 'default' }}
          />
        </div>
        <figcaption className="text-center text-[12px] font-bold text-ss-slate">Each press leaves one print on a chalk cross.</figcaption>
      </figure>
      <div className="flex min-h-[28px] items-center justify-between gap-2 border-t border-ss-line pt-1.5">
        <p className="flex items-baseline gap-2">
          <span className="text-[12px] font-bold text-ss-slate">Your prints</span>
          <span className="text-[15px] font-extrabold tabular-nums text-ss-ink" data-count>{mine.length}</span>
        </p>
        {needsFlip && <button type="button" aria-label={`Flip the block. It is ${flip ? 'flipped' : 'not flipped'}.`} disabled={!canTouch} onClick={() => put({ flip: !flip })} className={SMALL_BUTTON}>Flip the block</button>}
        {needsTurn && <button type="button" aria-label={`Turn the block a quarter turn. It is ${turn === 0 ? 'upright' : `turned ${turn} quarter${turn === 1 ? '' : 's'}`}.`} disabled={!canTouch} onClick={() => put({ turn: (turn + 1) % 4 })} className={SMALL_BUTTON}>Turn the block</button>}
      </div>
      <p className="as-kbd hidden text-[12px] font-semibold text-ss-slate">Arrow keys move over the chalk crosses. Enter prints or lifts.</p>
      <span className="sr-only" aria-live="polite">{`${say(mine.length, 'print')} of yours on the cloth.`}</span>
      <Said marked={marked} text={said} />
    </div>
  )
}

/** The chalk cross nearest a tap: half a step at most away, so a print cannot be nearly in place. */
export function nearest(x: number, y: number): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(7, Math.round((x - SPOT_X0) / STEP))),
    y: Math.max(0, Math.min(5, Math.round((y - SPOT_Y0) / STEP))),
  }
}

export function ArtStudioView(props: Props): ReactNode {
  return props.config.task === 'mix' ? <MixCard {...props} /> : <RepeatCard {...props} />
}
