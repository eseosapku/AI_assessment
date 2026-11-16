'use client'
import { useEffect, useRef, type KeyboardEvent } from 'react'
import type { SceneMarked, SceneViewProps } from '../types'
import type { CellLabConfig, CellLabState } from './config'
import { LEFT_MAX, TIMES_MAX, cubes, crossing, madeMembrane, madeSlice, membraneWorking, sliceWorking } from './config'

type Props = SceneViewProps<CellLabConfig, CellLabState>
type MembraneConfig = Extract<CellLabConfig, { right: number }>
type SliceConfig = Extract<CellLabConfig, { task: 'surface-area' }>

// The scene's own inks: flat solid colours, each over 3:1 on the card in both themes.
const PALETTE =
  '[--cl-water:#DCE8FF] [--cl-sol:#C2410C] [--cl-aq:#1D4ED8] [--cl-top:#D3F0DA] [--cl-lft:#A7DDB6] [--cl-rgt:#7FC795] [--cl-edge:#15803D] [--cl-glass:#DCE9EF] [--cl-glassedge:#8FA9B8] [--cl-mem:#8A7352] ' +
  'dark:[--cl-water:#1E3A8A] dark:[--cl-sol:#FDBA74] dark:[--cl-aq:#93C5FD] dark:[--cl-top:#2F7D4F] dark:[--cl-lft:#1E5C38] dark:[--cl-rgt:#14472A] dark:[--cl-edge:#86EFAC] dark:[--cl-glass:#2E4456] dark:[--cl-glassedge:#7F9DB2] dark:[--cl-mem:#CDB68F]'
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
// One tank, split by a membrane.

export const W = 360
export const H = 270
export const MID = 180
export const TOP = 14
export const BOT = 258
export const WALL_L = 14
export const WALL_R = 346
export const LEVEL = 92
// One tap moves the two surfaces 12 px apart: a change to see at a glance, not to compare for.
export const SWING = 6
export const DOT_R = 7
export const WATER_R = 4.5
export const MIN_GAP = 20
export const BOX_L = { x0: 34, x1: 158, y0: 208, y1: 244 }
export const BOX_R = { x0: 202, x1: 326, y0: 208, y1: 244 }
// A literal, not LEFT_MAX: config imports this file, so its values are not ready at module load (a test checks they agree).
export const MAX_DOTS = 10
export const LANE_X0 = 44
export const LANE_X1 = 316
export const LANE_TO_RIGHT = 160
export const LANE_TO_LEFT = 184
const LANE_MS = 5000
const HEAD = 9
const DROP_MS = 700
const WOBBLE = 2

type Box = typeof BOX_L
export type Dot = { x: number; y: number }

/** Ten places in two staggered rows, handed out in an order the seed shuffles: the same every time, and never touching. */
export function stillDots(seed: number, count: number, box: Box): Dot[] {
  const rnd = mulberry32(seed)
  const step = (box.x1 - box.x0) / 4.5
  const places: Dot[] = Array.from({ length: MAX_DOTS }, (_, n) => {
    const row = n % 2
    const x = box.x0 + (Math.floor(n / 2) + row / 2) * step + (rnd() - 0.5) * 6
    return { x: clamp(x, box.x0, box.x1), y: row ? box.y1 - rnd() * 4 : box.y0 + rnd() * 4 }
  })
  for (let i = places.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[places[i], places[j]] = [places[j], places[i]]
  }
  return places.slice(0, count)
}

/** Where the water stands on each side: level when the two ways match, higher on the side water crosses to. */
export function levels(task: 'diffusion' | 'osmosis', left: number, right: number): { l: number; r: number } {
  if (task === 'diffusion') return { l: LEVEL, r: LEVEL }
  const n = clamp(right - left, -10, 10)
  return { l: LEVEL + n * SWING, r: LEVEL - n * SWING }
}

/** One lane each way: a lane carries as many dots as cross that way, evenly spaced, so the two can be counted. */
export function laneDots(count: number, rightward: boolean, t: number): Dot[] {
  const run = LANE_X1 - LANE_X0 - HEAD * 2
  const out: Dot[] = []
  for (let k = 0; k < count; k++) {
    const ph = (((t / LANE_MS + k / count) % 1) + 1) % 1
    out.push({ x: rightward ? LANE_X0 + ph * run : LANE_X1 - ph * run, y: rightward ? LANE_TO_RIGHT : LANE_TO_LEFT })
  }
  return out
}

type Pal = { ink: string; panel: string; water: string; sol: string; aq: string; glass: string; glassEdge: string; mem: string }
function palette(el: HTMLElement): Pal {
  const cs = getComputedStyle(el)
  const g = (n: string, f: string) => cs.getPropertyValue(n).trim() || f
  return { ink: g('--ss-ink', '#16202A'), panel: g('--ss-panel', '#FFFFFF'), water: g('--cl-water', '#DCE8FF'), sol: g('--cl-sol', '#C2410C'), aq: g('--cl-aq', '#1D4ED8'), glass: g('--cl-glass', '#DCE9EF'), glassEdge: g('--cl-glassedge', '#8FA9B8'), mem: g('--cl-mem', '#8A7352') }
}

type Scene = { task: 'diffusion' | 'osmosis'; left: number; right: number }

/** A small sphere: flat colour with a soft highlight and a thin darker rim. */
function dot(ctx: CanvasRenderingContext2D, d: Dot, r: number, fill: string, _ring: string) {
  ctx.beginPath()
  ctx.arc(d.x, d.y, r, 0, Math.PI * 2)
  ctx.fillStyle = fill
  ctx.fill()
  ctx.lineWidth = 1
  ctx.strokeStyle = 'rgba(0,0,0,0.28)'
  ctx.stroke()
  const g = ctx.createRadialGradient(d.x - r * 0.35, d.y - r * 0.4, r * 0.1, d.x - r * 0.2, d.y - r * 0.2, r * 0.95)
  g.addColorStop(0, 'rgba(255,255,255,0.6)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.beginPath()
  ctx.arc(d.x, d.y, r - 0.5, 0, Math.PI * 2)
  ctx.fillStyle = g
  ctx.fill()
}

function drawLane(ctx: CanvasRenderingContext2D, pal: Pal, rightward: boolean, count: number, fill: string, r: number, t: number) {
  const y = rightward ? LANE_TO_RIGHT : LANE_TO_LEFT
  const [from, to] = rightward ? [LANE_X0, LANE_X1] : [LANE_X1, LANE_X0]
  const back = rightward ? -HEAD : HEAD
  ctx.save()
  ctx.globalAlpha = 0.4
  ctx.strokeStyle = fill
  ctx.lineWidth = 1.5
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(from, y)
  ctx.lineTo(to, y)
  ctx.moveTo(to + back, y - HEAD * 0.6)
  ctx.lineTo(to, y)
  ctx.lineTo(to + back, y + HEAD * 0.6)
  ctx.stroke()
  ctx.restore()
  for (const d of laneDots(count, rightward, t)) dot(ctx, d, r, fill, pal.panel)
}

/** A solute dot where it rests, bobbing a little, or on its way down from the surface if it has just been dropped in. */
function placed(home: Dot, i: number, t: number, droppedAt: number, surface: number): Dot {
  if (!t) return home
  const x = home.x + Math.sin(t / 1100 + i * 1.7) * WOBBLE
  const y = home.y + Math.cos(t / 1300 + i * 2.3) * WOBBLE
  const p = (t - droppedAt) / DROP_MS
  if (p >= 1) return { x, y }
  return { x, y: surface + (y - surface) * (1 - (1 - Math.max(0, p)) ** 2) }
}

const WALL = 8
const PORE_Y0 = 16
const PORE_STEP = 24
const PORE_H = 12

function drawMembrane(
  ctx: CanvasRenderingContext2D, pal: Pal, sc: Scene, lv: { l: number; r: number }, homes: { l: Dot[]; r: Dot[] }, dropAt: number[], t: number,
) {
  ctx.clearRect(0, 0, W, H)
  // The water on each side, with a lighter skin at the surface.
  ctx.fillStyle = pal.water
  ctx.fillRect(WALL_L, lv.l, MID - WALL_L, BOT - lv.l)
  ctx.fillRect(MID, lv.r, WALL_R - MID, BOT - lv.r)
  ctx.fillStyle = pal.aq
  ctx.globalAlpha = 0.35
  ctx.fillRect(WALL_L, lv.l, MID - WALL_L, 2)
  ctx.fillRect(MID, lv.r, WALL_R - MID, 2)
  ctx.globalAlpha = 1
  // The membrane: a thin sheet with a pore every 24 px, set so each lane crosses through one.
  ctx.fillStyle = pal.mem
  const cuts: number[] = []
  for (let y = PORE_Y0; y <= BOT; y += PORE_STEP) cuts.push(y)
  let from = TOP
  const seg = (y0: number, y1: number) => {
    if (y1 <= y0) return
    ctx.beginPath()
    ctx.roundRect(MID - 3, y0, 6, y1 - y0, 3)
    ctx.fill()
  }
  for (const c of cuts) { seg(from, c - PORE_H / 2); from = c + PORE_H / 2 }
  seg(from, BOT)
  // What crosses, each way.
  const c = crossing(sc.task, sc.left, sc.right)
  const fill = sc.task === 'diffusion' ? pal.sol : pal.aq
  const r = sc.task === 'diffusion' ? DOT_R : WATER_R
  drawLane(ctx, pal, true, c.toRight, fill, r, t)
  drawLane(ctx, pal, false, c.toLeft, fill, r, t)
  // The solute, one sphere a particle.
  for (let i = 0; i < sc.left; i++) dot(ctx, placed(homes.l[i], i, t, dropAt[i], lv.l), DOT_R, pal.sol, pal.panel)
  for (let i = 0; i < sc.right; i++) dot(ctx, placed(homes.r[i], i + MAX_DOTS, t, 0, lv.r), DOT_R, pal.sol, pal.panel)
  // The glass tank: walls and base with real thickness, a lip at the rim and a highlight down the wall.
  const o = WALL_L - WALL
  const ow = WALL_R + WALL
  const floor = BOT + WALL
  ctx.beginPath()
  ctx.moveTo(o, TOP)
  ctx.lineTo(o, floor - 6)
  ctx.quadraticCurveTo(o, floor, o + 6, floor)
  ctx.lineTo(ow - 6, floor)
  ctx.quadraticCurveTo(ow, floor, ow, floor - 6)
  ctx.lineTo(ow, TOP)
  ctx.lineTo(WALL_R, TOP)
  ctx.lineTo(WALL_R, BOT)
  ctx.lineTo(WALL_L, BOT)
  ctx.lineTo(WALL_L, TOP)
  ctx.closePath()
  ctx.fillStyle = pal.glass
  ctx.fill()
  ctx.lineWidth = 1.5
  ctx.lineJoin = 'round'
  ctx.strokeStyle = pal.glassEdge
  ctx.stroke()
  ctx.fillStyle = pal.glass
  ctx.strokeStyle = pal.glassEdge
  for (const x of [o - 3, WALL_R]) {
    ctx.beginPath()
    ctx.roundRect(x, TOP - 3, WALL + 3, 3, 1.5)
    ctx.fill()
    ctx.stroke()
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.75)'
  ctx.lineWidth = 2
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(o + 2.5, TOP + 10)
  ctx.lineTo(o + 2.5, floor - 14)
  ctx.moveTo(WALL_R + 2.5, TOP + 10)
  ctx.lineTo(WALL_R + 2.5, floor - 14)
  ctx.stroke()
}

const particles = (n: number) => `${n} solute ${n === 1 ? 'particle' : 'particles'}`

function describeMembrane(config: MembraneConfig, left: number): string {
  const lv = levels(config.task, left, config.right)
  const level = lv.l === lv.r ? 'The water stands level on both sides.' : `The water stands higher on the ${lv.l < lv.r ? 'left' : 'right'}.`
  const passes = config.task === 'diffusion' ? 'lets solute particles through' : 'lets only water through'
  return `A tank split by a dashed membrane that ${passes}. The left holds ${particles(left)} and the right ${config.right}. Dots cross the membrane along one lane each way. ${config.task === 'osmosis' ? level : ''}`.trim()
}

const STEP = 'nodrag flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-lg border-2 border-ss-line bg-ss-panel text-[16px] font-extrabold leading-none text-ss-ink touch-manipulation hover:border-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40'

function Tap({ label, sign, off, onTap }: { label: string; sign: '+' | '-'; off: boolean; onTap: () => void }) {
  return (
    <button type="button" aria-label={label} disabled={off} onClick={onTap} className={STEP}>
      {sign === '+' ? '+' : '\u2212'}
    </button>
  )
}

function Membrane({ config, state, setState, marked, reduced, locked }: Props & { config: MembraneConfig }) {
  const left = Number.isInteger(state?.left) ? clamp(state.left as number, 0, LEFT_MAX) : 0
  const canvas = useRef<HTMLCanvasElement>(null)
  const homes = useRef<{ l: Dot[]; r: Dot[] } | null>(null)
  if (!homes.current) homes.current = { l: stillDots(11, MAX_DOTS, BOX_L), r: stillDots(23, MAX_DOTS, BOX_R) }
  const dropAt = useRef<number[]>(Array.from({ length: MAX_DOTS }, () => 0))
  // The latest scene, read by the animation without restarting it.
  const live = useRef<Scene>({ task: config.task as 'diffusion' | 'osmosis', left, right: config.right })
  live.current = { task: config.task as 'diffusion' | 'osmosis', left, right: config.right }
  const shown = useRef<{ l: number; r: number } | null>(null)

  const paint = (t: number, still: boolean) => {
    const el = canvas.current
    const ctx = el?.getContext('2d')
    if (!el || !ctx || !homes.current) return
    const sc = live.current
    const target = levels(sc.task, sc.left, sc.right)
    // The water takes about a second to find its level, so the eye catches it moving.
    if (still || !shown.current) shown.current = { ...target }
    else shown.current = { l: shown.current.l + (target.l - shown.current.l) * 0.07, r: shown.current.r + (target.r - shown.current.r) * 0.07 }
    drawMembrane(ctx, palette(el), sc, shown.current, homes.current, dropAt.current, still ? 0 : t)
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
      // One still frame, nothing moving.
      paint(0, true)
      return
    }
    let raf = 0
    let last = 0
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick)
      if (t - last < 33) return // about 30 frames a second
      last = t
      paint(t, false)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced])

  // Under reduced motion the still frame follows the buttons.
  useEffect(() => {
    if (reduced) paint(0, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, left, config.right, config.task])

  const set = (v: number) => {
    if (locked || v < 0 || v > LEFT_MAX) return
    if (v > left) dropAt.current[left] = performance.now()
    setState({ left: v })
  }

  const good = marked === 'right' || marked === 'shown'
  const text = good
    ? membraneWorking(config, left)
    : marked === 'wrong' ? madeMembrane(config, left) : ''
  const swatch = (colour: string) => <span aria-hidden="true" className="inline-block h-3 w-3 shrink-0 rounded-full" style={{ background: colour }} />
  const SOLUTE = 'var(--cl-sol, #C2410C)'

  return (
    <div className={`nodrag flex w-full max-w-[380px] flex-col items-center gap-2 ${PALETTE}`}>
      <figure className="m-0 w-full">
        <div className="rounded-xl border border-ss-line bg-ss-chip px-2 pb-1.5 pt-2.5">
          <canvas ref={canvas} role="img" aria-label={describeMembrane(config, left)} className="mx-auto block h-auto w-full max-w-[360px]" style={{ aspectRatio: `${W} / ${H}` }} />
          <div className="mx-auto grid w-full max-w-[360px] grid-cols-2 pt-1 text-center text-[12px] font-bold text-ss-slate">
            <span>left</span>
            <span>right</span>
          </div>
        </div>
        <figcaption className="mt-1.5 flex items-center justify-center gap-1.5 text-center text-[12px] font-bold text-ss-slate">
          {swatch(config.task === 'diffusion' ? SOLUTE : 'var(--cl-aq, #1D4ED8)')}
          {config.task === 'diffusion' ? 'solute passes' : 'only water passes'}
        </figcaption>
      </figure>
      <div className="flex w-full items-center justify-between gap-1.5 px-1">
        <span className="flex items-center gap-1.5 text-[12px] font-bold text-ss-slate">{swatch(SOLUTE)}solute on the left</span>
        <span className="flex items-center gap-1">
          <Tap label="Take one solute particle out of the left side" sign="-" off={locked || left <= 0} onTap={() => set(left - 1)} />
          <span className="min-w-[28px] text-center text-[15px] font-extrabold tabular-nums text-ss-ink">{left}</span>
          <Tap label="Add one solute particle to the left side" sign="+" off={locked || left >= LEFT_MAX} onTap={() => set(left + 1)} />
        </span>
      </div>
      <span className="sr-only" aria-live="polite">{particles(left)} on the left</span>
      <Verdict marked={marked} text={text} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// A cube cut into cubes.

export const SW = 360
export const SH = 308
export const E = 84
export const GAP = 7
const OX = 180
const OY = 90
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
  const set = (v: number) => {
    const next = clamp(Math.round(v), 1, TIMES_MAX)
    if (!locked && next !== n) setState({ pieces: next })
  }
  const onKey = (e: KeyboardEvent) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0
    if (d) { e.preventDefault(); e.stopPropagation(); set(n + d) }
    else if (e.key === 'Home') { e.preventDefault(); e.stopPropagation(); set(1) }
    else if (e.key === 'End') { e.preventDefault(); e.stopPropagation(); set(TIMES_MAX) }
  }
  const good = marked === 'right' || marked === 'shown'
  const text = good ? sliceWorking(config.side, n) : marked === 'wrong' ? madeSlice(config, n) : ''
  const skin = 6 * n
  const barW = tileX(6 * TIMES_MAX - 1) + TILE + BAR_X

  return (
    <div className={`nodrag flex w-full max-w-[380px] flex-col items-center gap-2 ${PALETTE} [&:has(:focus-visible)_.cl-kbd]:block`}>
      <figure className="m-0 w-full">
        <div className="rounded-xl border border-ss-line bg-ss-chip px-2 py-2">
          <svg
            viewBox={`0 0 ${SW} ${SH}`}
            width={SW}
            height={SH}
            className="mx-auto block touch-none select-none"
            style={{ maxWidth: '100%', height: 'auto' }}
            role="group"
            aria-label={`A cube cut into ${cubes(n)} equal ${cubes(n) === 1 ? 'cube' : 'cubes'}, ${n} along each edge, with a bar for its skin and a bar for its inside`}
          >
            <ellipse cx={OX} cy={OY + E - 2} rx={E * 0.8} ry={9} fill="var(--ss-ink, #16202A)" fillOpacity={0.09} />
            {piecesOf(n).map((p) => {
              const [a, b, c] = p.at
              const e = p.e
              return (
                <g key={`${p.i}${p.j}${p.k}`} stroke="var(--cl-edge, #15803D)" strokeWidth={1} strokeLinejoin="round">
                  <polygon fill="var(--cl-top, #D3F0DA)" points={[proj(a, b, c + e), proj(a + e, b, c + e), proj(a + e, b + e, c + e), proj(a, b + e, c + e)].join(' ')} />
                  <polygon fill="var(--cl-lft, #A7DDB6)" points={[proj(a, b + e, c), proj(a + e, b + e, c), proj(a + e, b + e, c + e), proj(a, b + e, c + e)].join(' ')} />
                  <polygon fill="var(--cl-rgt, #7FC795)" points={[proj(a + e, b, c), proj(a + e, b + e, c), proj(a + e, b + e, c + e), proj(a + e, b, c + e)].join(' ')} />
                </g>
              )
            })}
            <text x={OX} y={202} textAnchor="middle" fontSize={12} fontWeight={800} fill={INK} {...HALO} aria-hidden="true">
              {cubes(n)} {cubes(n) === 1 ? 'cube' : 'cubes'}
            </text>
            {/* two troughs on one left edge: the skin grows in groups of six, the inside stays one group */}
            <rect x={0} y={228} width={barW} height={24} rx={5} fill={PANEL} stroke="var(--ss-line, #D5DDE5)" strokeWidth={1} />
            <rect x={0} y={276} width={barW} height={24} rx={5} fill={PANEL} stroke="var(--ss-line, #D5DDE5)" strokeWidth={1} />
            <text x={BAR_X} y={222} fontSize={12} fontWeight={700} fill="var(--ss-slate, #5B6B7B)" aria-hidden="true">skin</text>
            {Array.from({ length: skin }, (_, t) => (
              <rect key={t} x={tileX(t)} y={232} width={TILE} height={16} rx={2} fill="var(--cl-edge, #15803D)" />
            ))}
            <text x={BAR_X} y={270} fontSize={12} fontWeight={700} fill="var(--ss-slate, #5B6B7B)" aria-hidden="true">inside</text>
            {Array.from({ length: 6 }, (_, t) => (
              <rect key={t} x={tileX(t)} y={280} width={TILE} height={16} rx={2} fill="var(--cl-top, #D3F0DA)" stroke="var(--cl-edge, #15803D)" strokeWidth={1.5} />
            ))}
          </svg>
        </div>
        <figcaption className="mt-1.5 text-center text-[12px] font-bold text-ss-slate">Cut the block into more pieces and watch the two bars.</figcaption>
      </figure>
      <div className="flex w-full items-center justify-between gap-1.5 px-1">
        <span className="text-[12px] font-bold text-ss-slate">Cuts along each edge</span>
        <span className="flex items-center gap-1">
          <button type="button" aria-label="Cut into fewer pieces" disabled={locked || n <= 1} onClick={() => set(n - 1)} className={STEP}>{'\u2212'}</button>
          <span
            role="slider"
            tabIndex={locked ? -1 : 0}
            aria-label="How finely the cube is cut. Move it with the arrow keys"
            aria-valuemin={1}
            aria-valuemax={TIMES_MAX}
            aria-valuenow={n}
            aria-valuetext={`${cubes(n)} ${cubes(n) === 1 ? 'cube' : 'cubes'}, ${n} along each edge`}
            aria-disabled={locked || undefined}
            onKeyDown={onKey}
            className="min-w-[28px] rounded-md px-0.5 text-center text-[15px] font-extrabold tabular-nums text-ss-ink outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--subject)]"
          >{n}</span>
          <button type="button" aria-label="Cut into more pieces" disabled={locked || n >= TIMES_MAX} onClick={() => set(n + 1)} className={STEP}>+</button>
        </span>
      </div>
      <p className="cl-kbd hidden text-[12px] text-ss-slate">The left and right arrow keys change the number.</p>
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
