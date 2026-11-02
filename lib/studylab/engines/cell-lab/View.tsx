'use client'
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { SceneMarked, SceneViewProps } from '../types'
import type { CellLabConfig, CellLabState } from './config'
import {
  DOTS_PER_PART, LEFT_MAX, TIMES_MAX, cubes, crossing, madeMembrane, madeSlice, membraneWorking, sliceWorking,
} from './config'

type Props = SceneViewProps<CellLabConfig, CellLabState>
type MembraneConfig = Extract<CellLabConfig, { right: number }>
type SliceConfig = Extract<CellLabConfig, { task: 'surface-area' }>

// The scene's own inks: flat solid colours, each over 3:1 on the card in both themes.
const PALETTE =
  '[--cl-water:#DCE8FF] [--cl-sol:#C2410C] [--cl-aq:#1D4ED8] [--cl-top:#D3F0DA] [--cl-lft:#A7DDB6] [--cl-rgt:#7FC795] [--cl-edge:#15803D] ' +
  'dark:[--cl-water:#1E3A8A] dark:[--cl-sol:#FDBA74] dark:[--cl-aq:#93C5FD] dark:[--cl-top:#2F7D4F] dark:[--cl-lft:#1E5C38] dark:[--cl-rgt:#14472A] dark:[--cl-edge:#86EFAC]'
const INK = 'var(--ss-ink, #16202A)'
const PANEL = 'var(--ss-panel, #FFFFFF)'
const HALO = { stroke: PANEL, strokeWidth: 4, paintOrder: 'stroke', strokeLinejoin: 'round' } as const

function Verdict({ marked, text }: { marked: SceneMarked; text: string }) {
  if (marked === 'idle') return null
  return <p className="max-w-[340px] text-center text-[13px] font-extrabold leading-snug text-ss-ink">{text}</p>
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** A small seeded generator: the same seed always gives the same numbers. */
export function mulberry32(seed: number) {
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
// Two chambers and a membrane.

export const W = 360
export const H = 250
export const MID = 180
export const TOP = 56
export const BOT = 204
export const CUP_L = { x0: 58, x1: 178 }
export const CUP_R = { x0: 182, x1: 302 }
export const LEVEL = 112
export const SWING = 1.8
export const DOT_R = 3.5
export const MIN_GAP = 9
export const BOX_L = { x0: 66, x1: 150, y0: 136, y1: 196 }
export const BOX_R = { x0: 210, x1: 294, y0: 136, y1: 196 }
export const TRACK = { x: 24, y0: 74, y1: 200 }
// A literal, not LEFT_MAX * DOTS_PER_PART: config imports this file, so its values are not ready at module load (a test checks they agree).
export const MAX_DOTS = 30
export const LANE_X0 = 156
export const LANE_X1 = 204

type Box = typeof BOX_L
export type Dot = { x: number; y: number }

/** Dots placed at random but never touching, the same every time for a seed. Each dot is independent of how many follow it. */
export function stillDots(seed: number, count: number, box: Box): Dot[] {
  const rnd = mulberry32(seed)
  const out: Dot[] = []
  for (let n = 0; n < count; n++) {
    let best: Dot = { x: box.x0, y: box.y0 }
    for (let tries = 0; tries < 400; tries++) {
      const p = { x: box.x0 + rnd() * (box.x1 - box.x0), y: box.y0 + rnd() * (box.y1 - box.y0) }
      best = p
      if (out.every((q) => Math.hypot(q.x - p.x, q.y - p.y) >= MIN_GAP)) break
    }
    out.push(best)
  }
  return out
}

/** Where the water stands in each chamber: level when the two ways match, higher on the side water crosses to. */
export function levels(task: 'diffusion' | 'osmosis', left: number, right: number): { l: number; r: number } {
  if (task === 'diffusion') return { l: LEVEL, r: LEVEL }
  const n = clamp(right - left, -10, 10)
  return { l: LEVEL + n * SWING, r: LEVEL - n * SWING }
}

/** The streams across the membrane: which row each dot rides, and where along the lane it is at phase `t`. */
export function laneDots(count: number, rightward: boolean, t: number): Dot[] {
  const out: Dot[] = []
  for (let k = 0; k < count; k++) {
    const row = k % 4
    const j = Math.floor(k / 4)
    const y = (rightward ? 140 : 148) + row * 16
    const ph = (((t / 1800 + j / 3 + row * 0.21) % 1) + 1) % 1
    out.push({ x: rightward ? LANE_X0 + ph * (LANE_X1 - LANE_X0) : LANE_X1 - ph * (LANE_X1 - LANE_X0), y })
  }
  return out
}

/** Labels and the parts they name: each label sits nearer its own part than any other. */
export const PARTS = { handle: { x: TRACK.x, y: 130 }, left: { x: 118, y: 130 }, right: { x: 242, y: 130 }, membrane: { x: MID, y: 130 } }
export const LABELS = [
  { text: 'solute', x: TRACK.x, y: 48, part: 'handle' as const },
  { text: 'left', x: 118, y: 224, part: 'left' as const },
  { text: 'right', x: 242, y: 224, part: 'right' as const },
  { text: 'membrane', x: MID, y: 44, part: 'membrane' as const },
]

type Pal = { ink: string; panel: string; water: string; sol: string; aq: string }
function palette(el: HTMLElement): Pal {
  const cs = getComputedStyle(el)
  const g = (n: string, f: string) => cs.getPropertyValue(n).trim() || f
  return { ink: g('--ss-ink', '#16202A'), panel: g('--ss-panel', '#FFFFFF'), water: g('--cl-water', '#DCE8FF'), sol: g('--cl-sol', '#C2410C'), aq: g('--cl-aq', '#1D4ED8') }
}

type Scene = { task: 'diffusion' | 'osmosis'; left: number; right: number }
type Walker = { x: number; y: number; vx: number; vy: number }

function dot(ctx: CanvasRenderingContext2D, d: Dot, fill: string, ring: string) {
  ctx.beginPath()
  ctx.arc(d.x, d.y, DOT_R, 0, Math.PI * 2)
  ctx.fillStyle = fill
  ctx.fill()
  ctx.lineWidth = 1
  ctx.strokeStyle = ring
  ctx.stroke()
}

function drawMembrane(
  ctx: CanvasRenderingContext2D, pal: Pal, sc: Scene, lv: { l: number; r: number }, walkL: Dot[], walkR: Dot[], t: number,
) {
  ctx.clearRect(0, 0, W, H)
  // Water in each chamber.
  ctx.fillStyle = pal.water
  ctx.fillRect(CUP_L.x0, lv.l, CUP_L.x1 - CUP_L.x0, BOT - lv.l)
  ctx.fillRect(CUP_R.x0, lv.r, CUP_R.x1 - CUP_R.x0, BOT - lv.r)
  // Dots in the chambers.
  const nl = sc.left * DOTS_PER_PART
  const nr = sc.right * DOTS_PER_PART
  for (let i = 0; i < nl; i++) dot(ctx, walkL[i], pal.sol, pal.panel)
  for (let i = 0; i < nr; i++) dot(ctx, walkR[i], pal.sol, pal.panel)
  // What crosses, each way.
  const c = crossing(sc.task, sc.left, sc.right)
  const fill = sc.task === 'diffusion' ? pal.sol : pal.aq
  for (const d of laneDots(c.toRight, true, t)) dot(ctx, d, fill, pal.panel)
  for (const d of laneDots(c.toLeft, false, t)) dot(ctx, d, fill, pal.panel)
  // The cups and the membrane.
  ctx.lineWidth = 2.5
  ctx.strokeStyle = pal.ink
  ctx.lineJoin = 'round'
  for (const cup of [CUP_L, CUP_R]) {
    ctx.beginPath()
    ctx.moveTo(cup.x0, TOP)
    ctx.lineTo(cup.x0, BOT)
    ctx.lineTo(cup.x1, BOT)
    ctx.lineTo(cup.x1, TOP)
    ctx.stroke()
  }
  ctx.lineWidth = 3
  ctx.setLineDash([6, 4])
  ctx.beginPath()
  ctx.moveTo(MID, TOP)
  ctx.lineTo(MID, BOT)
  ctx.stroke()
  ctx.setLineDash([])
}

/** One step of every dot's random walk, kept inside its box. */
function walk(dots: Walker[], box: Box, rnd: () => number) {
  for (const d of dots) {
    d.vx = d.vx * 0.85 + (rnd() - 0.5) * 1.8
    d.vy = d.vy * 0.85 + (rnd() - 0.5) * 1.8
    d.x += d.vx * 1.2
    d.y += d.vy * 1.2
    if (d.x < box.x0) { d.x = box.x0; d.vx = Math.abs(d.vx) }
    if (d.x > box.x1) { d.x = box.x1; d.vx = -Math.abs(d.vx) }
    if (d.y < box.y0) { d.y = box.y0; d.vy = Math.abs(d.vy) }
    if (d.y > box.y1) { d.y = box.y1; d.vy = -Math.abs(d.vy) }
  }
}

const seedWalkers = (seed: number, box: Box): Walker[] => stillDots(seed, MAX_DOTS, box).map((d) => ({ ...d, vx: 0, vy: 0 }))

const parts = (n: number) => `${n} ${n === 1 ? 'part' : 'parts'}`

function describeMembrane(config: MembraneConfig, left: number): string {
  const lv = levels(config.task, left, config.right)
  const level = lv.l === lv.r ? 'The water stands level in both.' : `The water stands higher in the ${lv.l < lv.r ? 'left' : 'right'}.`
  const passes = config.task === 'diffusion' ? 'lets solute particles through' : 'lets only water through'
  return `Two open chambers side by side, split by a dashed membrane that ${passes}. The left holds ${parts(left)} of solute out of ${LEFT_MAX} and the right ${config.right}. Small dots cross the membrane in both directions. ${config.task === 'osmosis' ? level : ''}`.trim()
}

function Membrane({ config, state, setState, marked, reduced, locked }: Props & { config: MembraneConfig }) {
  const left = Number.isInteger(state?.left) ? clamp(state.left as number, 0, LEFT_MAX) : 0
  const canvas = useRef<HTMLCanvasElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState(false)
  const seeds = useRef<{ l: Walker[]; r: Walker[] } | null>(null)
  if (!seeds.current) seeds.current = { l: seedWalkers(11, BOX_L), r: seedWalkers(23, BOX_R) }
  // The latest scene, read by the animation without restarting it.
  const live = useRef<Scene>({ task: config.task as 'diffusion' | 'osmosis', left, right: config.right })
  live.current = { task: config.task as 'diffusion' | 'osmosis', left, right: config.right }
  const shown = useRef<{ l: number; r: number } | null>(null)

  const paint = (t: number, still: boolean) => {
    const el = canvas.current
    const ctx = el?.getContext('2d')
    if (!el || !ctx || !seeds.current) return
    const sc = live.current
    const target = levels(sc.task, sc.left, sc.right)
    if (still || !shown.current) shown.current = { ...target }
    else shown.current = { l: shown.current.l + (target.l - shown.current.l) * 0.12, r: shown.current.r + (target.r - shown.current.r) * 0.12 }
    drawMembrane(ctx, palette(el), sc, shown.current, seeds.current.l, seeds.current.r, still ? 0 : t)
  }

  useEffect(() => {
    const el = canvas.current
    const ctx = el?.getContext('2d')
    if (!el || !ctx) return
    const scale = window.devicePixelRatio || 1
    el.width = W * scale
    el.height = H * scale
    ctx.setTransform(scale, 0, 0, scale, 0, 0)
    if (reduced) {
      // One still frame from the seeded positions, nothing moving.
      paint(0, true)
      return
    }
    const rnd = mulberry32(7)
    let raf = 0
    let last = 0
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick)
      if (t - last < 33) return // about 30 frames a second
      last = t
      if (seeds.current) { walk(seeds.current.l, BOX_L, rnd); walk(seeds.current.r, BOX_R, rnd) }
      paint(t, false)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced])

  // Under reduced motion the still frame follows the handle.
  useEffect(() => {
    if (reduced) paint(0, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, left, config.right, config.task])

  const set = (v: number) => {
    if (!locked) setState({ left: clamp(Math.round(v), 0, LEFT_MAX) })
  }
  const fromY = (clientY: number) => {
    const r = track.current?.getBoundingClientRect()
    if (!r || r.height === 0) return left
    return (1 - (clientY - r.top) / r.height) * LEFT_MAX
  }
  const onKey = (e: KeyboardEvent) => {
    const d = e.key === 'ArrowUp' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowDown' || e.key === 'ArrowLeft' ? -1 : 0
    if (d) { e.preventDefault(); e.stopPropagation(); set(left + d) }
    else if (e.key === 'Home') { e.preventDefault(); e.stopPropagation(); set(0) }
    else if (e.key === 'End') { e.preventDefault(); e.stopPropagation(); set(LEFT_MAX) }
  }

  const good = marked === 'right' || marked === 'shown'
  const ring = marked === 'wrong' ? 'var(--ss-bad, #B91C1C)' : good ? 'var(--ss-good, #15803D)' : INK
  const text = good
    ? membraneWorking(config, left)
    : marked === 'wrong' ? madeMembrane(config, left) : ''
  const pct = (v: number, of: number) => `${(v / of) * 100}%`

  return (
    <div className={`nodrag flex flex-col items-center gap-2 ${PALETTE} [&:has(:focus-visible)_.cl-kbd]:block`}>
      <div className="relative w-full max-w-[360px]">
        <canvas ref={canvas} role="img" aria-label={describeMembrane(config, left)} className="block h-auto w-full" style={{ aspectRatio: `${W} / ${H}` }} />
        <svg viewBox={`0 0 ${W} ${H}`} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
          {LABELS.map((l) => (
            <text key={l.part} x={l.x} y={l.y} textAnchor="middle" fontSize={13} fontWeight={800} fill={INK} {...HALO}>
              {l.part === 'membrane' ? (config.task === 'diffusion' ? 'solute passes' : 'only water passes') : l.text}
            </text>
          ))}
        </svg>
        <div
          ref={track}
          role="slider"
          tabIndex={locked ? -1 : 0}
          aria-label="Solute in the left chamber. Move it with the arrow keys"
          aria-orientation="vertical"
          aria-valuemin={0}
          aria-valuemax={LEFT_MAX}
          aria-valuenow={left}
          aria-valuetext={`${parts(left)} of solute out of ${LEFT_MAX}`}
          aria-disabled={locked || undefined}
          onKeyDown={onKey}
          onPointerDown={(e: PointerEvent) => {
            if (locked) return
            e.currentTarget.setPointerCapture?.(e.pointerId)
            setDrag(true)
            set(fromY(e.clientY))
          }}
          onPointerMove={(e: PointerEvent) => { if (drag) set(fromY(e.clientY)) }}
          onPointerUp={() => setDrag(false)}
          onPointerCancel={() => setDrag(false)}
          className={`absolute touch-none rounded-lg outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] ${locked ? '' : 'cursor-grab'}`}
          style={{ left: pct(TRACK.x, W), top: pct(TRACK.y0, H), height: pct(TRACK.y1 - TRACK.y0, H), width: 44, transform: 'translateX(-50%)' }}
        >
          <div className="absolute left-1/2 top-0 h-full w-[3px] -translate-x-1/2 rounded bg-ss-slate" />
          <div
            className="absolute left-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-ss-panel"
            style={{ top: `${(1 - left / LEFT_MAX) * 100}%`, border: `3px solid ${ring}` }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 6 L8 2 L12 6 M4 10 L8 14 L12 10" />
            </svg>
          </div>
        </div>
      </div>
      <p className="cl-kbd hidden text-[12px] text-ss-slate">The up and down arrow keys move the handle.</p>
      <Verdict marked={marked} text={text} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// A cube cut into cubes.

export const SW = 360
export const SH = 356
export const E = 84
export const GAP = 7
const OX = 180
const OY = 90
const TRACK_X0 = 52
const TRACK_X1 = 308
const TRACK_Y = 330
export const TILE = 11
export const TILE_STEP = 12
export const GROUP_GAP = 5
export const BAR_X = 8

/** Where tile `t` of a bar sits: tiles run in groups of six, one group for each time the block's skin. */
export const tileX = (t: number) => BAR_X + t * TILE_STEP + Math.floor(t / 6) * GROUP_GAP

type Piece = { i: number; j: number; k: number; e: number; at: [number, number, number] }
export function piecesOf(n: number): Piece[] {
  const e = (E - (n - 1) * GAP) / n
  const out: Piece[] = []
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let k = 0; k < n; k++) {
    out.push({ i, j, k, e, at: [i * (e + GAP), j * (e + GAP), k * (e + GAP)] })
  }
  // Furthest first, so nearer pieces draw over them.
  return out.sort((a, b) => a.i + a.j + a.k - (b.i + b.j + b.k))
}

const C30 = Math.sqrt(3) / 2
const proj = (i: number, j: number, k: number) => `${(OX + (i - j) * C30).toFixed(1)},${(OY + (i + j) * 0.5 - k).toFixed(1)}`

function Slice({ config, state, setState, marked, locked }: Props & { config: SliceConfig }) {
  const n = clamp(Number.isInteger(state?.pieces) ? (state.pieces as number) : 1, 1, TIMES_MAX)
  const svg = useRef<SVGSVGElement>(null)
  const [drag, setDrag] = useState(false)
  const set = (v: number) => {
    const next = clamp(Math.round(v), 1, TIMES_MAX)
    if (!locked && next !== n) setState({ pieces: next })
  }
  const fromX = (clientX: number) => {
    const r = svg.current?.getBoundingClientRect()
    if (!r || r.width === 0) return n
    const x = ((clientX - r.left) / r.width) * SW
    return 1 + ((x - TRACK_X0) / (TRACK_X1 - TRACK_X0)) * (TIMES_MAX - 1)
  }
  const onKey = (e: KeyboardEvent) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0
    if (d) { e.preventDefault(); e.stopPropagation(); set(n + d) }
    else if (e.key === 'Home') { e.preventDefault(); e.stopPropagation(); set(1) }
    else if (e.key === 'End') { e.preventDefault(); e.stopPropagation(); set(TIMES_MAX) }
  }
  const stopX = (v: number) => TRACK_X0 + ((v - 1) / (TIMES_MAX - 1)) * (TRACK_X1 - TRACK_X0)
  const good = marked === 'right' || marked === 'shown'
  const ring = marked === 'wrong' ? 'var(--ss-bad, #B91C1C)' : good ? 'var(--ss-good, #15803D)' : INK
  const text = good ? sliceWorking(config.side, n) : marked === 'wrong' ? madeSlice(config, n) : ''
  const skin = 6 * n

  return (
    <div className={`nodrag flex flex-col items-center gap-2 ${PALETTE} [&:has(:focus-visible)_.cl-kbd]:block`}>
      <svg
        ref={svg}
        viewBox={`0 0 ${SW} ${SH}`}
        width={SW}
        height={SH}
        className="touch-none select-none"
        style={{ maxWidth: '100%', height: 'auto' }}
        role="group"
        aria-label={`A cube cut into ${cubes(n)} equal ${cubes(n) === 1 ? 'cube' : 'cubes'}, ${n} along each edge, with a bar for its skin and a bar for its inside`}
        onPointerMove={(e: PointerEvent) => { if (drag) set(fromX(e.clientX)) }}
        onPointerUp={() => setDrag(false)}
        onPointerCancel={() => setDrag(false)}
      >
        {piecesOf(n).map((p) => {
          const [a, b, c] = p.at
          const e = p.e
          return (
            <g key={`${p.i}${p.j}${p.k}`} stroke="var(--cl-edge, #15803D)" strokeWidth={1.2} strokeLinejoin="round">
              <polygon fill="var(--cl-top, #D3F0DA)" points={[proj(a, b, c + e), proj(a + e, b, c + e), proj(a + e, b + e, c + e), proj(a, b + e, c + e)].join(' ')} />
              <polygon fill="var(--cl-lft, #A7DDB6)" points={[proj(a, b + e, c), proj(a + e, b + e, c), proj(a + e, b + e, c + e), proj(a, b + e, c + e)].join(' ')} />
              <polygon fill="var(--cl-rgt, #7FC795)" points={[proj(a + e, b, c), proj(a + e, b + e, c), proj(a + e, b + e, c + e), proj(a + e, b, c + e)].join(' ')} />
            </g>
          )
        })}
        <text x={OX} y={198} textAnchor="middle" fontSize={13} fontWeight={800} fill={INK} {...HALO} aria-hidden="true">
          {cubes(n)} {cubes(n) === 1 ? 'cube' : 'cubes'}
        </text>
        {/* the skin grows in groups of six; the inside stays one group */}
        <text x={BAR_X} y={226} fontSize={13} fontWeight={800} fill={INK} aria-hidden="true">skin</text>
        {Array.from({ length: skin }, (_, t) => (
          <rect key={t} x={tileX(t)} y={232} width={TILE} height={16} fill="var(--cl-edge, #15803D)" />
        ))}
        <text x={BAR_X} y={274} fontSize={13} fontWeight={800} fill={INK} aria-hidden="true">inside</text>
        {Array.from({ length: 6 }, (_, t) => (
          <rect key={t} x={tileX(t)} y={280} width={TILE} height={16} fill="var(--cl-top, #D3F0DA)" stroke="var(--cl-edge, #15803D)" strokeWidth={1.5} />
        ))}
        {/* the cut: a track with four stops and a handle */}
        <line x1={TRACK_X0} x2={TRACK_X1} y1={TRACK_Y} y2={TRACK_Y} stroke="var(--ss-slate, #5B6B7B)" strokeWidth={3} strokeLinecap="round" />
        {[1, 2, 3, 4].map((v) => <circle key={v} cx={stopX(v)} cy={TRACK_Y} r={4} fill={PANEL} stroke="var(--ss-slate, #5B6B7B)" strokeWidth={2} />)}
        <g
          role="slider"
          tabIndex={locked ? -1 : 0}
          aria-label="How finely the cube is cut. Move it with the arrow keys"
          aria-valuemin={1}
          aria-valuemax={TIMES_MAX}
          aria-valuenow={n}
          aria-valuetext={`${cubes(n)} ${cubes(n) === 1 ? 'cube' : 'cubes'}, ${n} along each edge`}
          aria-disabled={locked || undefined}
          onKeyDown={onKey}
          onPointerDown={(e: PointerEvent) => {
            if (locked) return
            svg.current?.setPointerCapture?.(e.pointerId)
            setDrag(true)
            set(fromX(e.clientX))
          }}
          className={`outline-none [&:focus-visible>circle:first-child]:stroke-[color:var(--subject)] [&:focus-visible>circle:first-child]:stroke-[4] ${locked ? '' : 'cursor-grab'}`}
        >
          <rect x={TRACK_X0 - 24} y={TRACK_Y - 24} width={TRACK_X1 - TRACK_X0 + 48} height={48} fill="transparent" />
          <circle cx={stopX(n)} cy={TRACK_Y} r={15} fill={PANEL} stroke={ring} strokeWidth={3} />
          <path d={`M ${stopX(n) - 6} ${TRACK_Y} L ${stopX(n) - 2} ${TRACK_Y - 4} M ${stopX(n) - 6} ${TRACK_Y} L ${stopX(n) - 2} ${TRACK_Y + 4} M ${stopX(n) + 6} ${TRACK_Y} L ${stopX(n) + 2} ${TRACK_Y - 4} M ${stopX(n) + 6} ${TRACK_Y} L ${stopX(n) + 2} ${TRACK_Y + 4}`} fill="none" stroke={INK} strokeWidth={2} strokeLinecap="round" aria-hidden="true" />
        </g>
      </svg>
      <p className="cl-kbd hidden text-[12px] text-ss-slate">The left and right arrow keys move the handle.</p>
      <Verdict marked={marked} text={text} />
    </div>
  )
}

export function CellLabView(props: Props) {
  const { config } = props
  return config.task === 'surface-area'
    ? <Slice {...props} config={config} />
    : <Membrane {...props} config={config} />
}
