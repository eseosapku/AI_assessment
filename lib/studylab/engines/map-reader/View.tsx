'use client'
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { SceneMarked, SceneViewProps } from '../types'
import type { MapReaderConfig, MapReaderState } from './config'
import {
  COLS, DIRS, LEVELS, PLACES, PLACE_IDS, RADIUS, ROWS, STEP, compassOf, contourPoint, crossWorking, easting,
  gridWorking, inGrid, madeCross, madeGrid, northing, placeAt, profileOf, refOf, sentence,
} from './config'

type Props = SceneViewProps<MapReaderConfig, MapReaderState>
type GridConfig = Extract<MapReaderConfig, { task: 'grid' }>
type CrossConfig = Extract<MapReaderConfig, { task: 'cross-section' }>

// A printed survey sheet: the same paper in both themes, like measure-shape's plate. Flat colours only.
const PAPER = '#F7F2E2'
const EDGE = '#CBD5E1'
const SHEET_EDGE = '#8FB0CE'
const GRIDBLUE = '#B5CCE0'
const NUM = '#2F5E8C'
const INK = '#2F3640'
const SOFT = '#4B5563'
const BUILD = '#3B3A36'
const ROOF = '#A3412A'
const WATER = '#A9CDE8'
const WATER_EDGE = '#3F7FB5'
const GREEN = '#CFE0B4'
const GREEN_DARK = '#5E8A47'
const ROAD = '#F2D49B'
const ROAD_EDGE = '#9A7B3F'
const BROWN = '#A5592B'
const LAND = '#E9DDB8'
const GROUND_EDGE = '#7A4B1E'
const WINDOW = '#FCFAF2'
const BAD = '#B91C1C'
const GOOD = '#15803D'

// The scene's two accents, each over 3:1 on the paper.
const ALONG = '#1D4ED8'
const UP = '#C2410C'
// Lighter twins for the little captions, which sit on the card and not on the paper.
const PALETTE = '[--mr-b:#1D4ED8] [--mr-o:#C2410C] dark:[--mr-b:#93C5FD] dark:[--mr-o:#FDBA74]'

const HALO = { stroke: PAPER, strokeWidth: 4, paintOrder: 'stroke', strokeLinejoin: 'round' } as const
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

const STEPPER =
  'nodrag flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-lg border-2 border-ss-line bg-ss-panel text-[16px] font-extrabold leading-none text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'

function Stepper(props: { name: string; shown: string; less: string; more: string; locked: boolean; down: () => void; up: () => void; tone?: string; wide?: boolean }) {
  const { name, shown, less, more, locked, down, up, tone, wide } = props
  return (
    <div className="flex items-center justify-between gap-1.5">
      <span className="text-[12px] font-bold text-ss-slate" style={tone ? { color: tone } : undefined}>{name}</span>
      <span className="flex items-center gap-1">
        <button type="button" aria-label={less} disabled={locked} onClick={down} className={STEPPER}>{'−'}</button>
        <span className={`${wide ? 'min-w-[44px]' : 'min-w-[28px]'} text-center text-[15px] font-extrabold tabular-nums text-ss-ink`} aria-hidden="true">{shown}</span>
        <button type="button" aria-label={more} disabled={locked} onClick={up} className={STEPPER}>+</button>
      </span>
    </div>
  )
}

function Verdict({ marked, text }: { marked: SceneMarked; text: string }) {
  if (marked === 'idle' || !text) return null
  return <p className="w-full max-w-[360px] rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2 text-[13px] font-extrabold leading-snug text-ss-ink" aria-live="polite">{text}</p>
}

// ---------------------------------------------------------------------------
// The grid map.

export const GW = 360
export const GH = 364
export const GX = 42
export const GY = 28
export const CELL = 51
// Literals, not COLS * CELL: config imports this file, so its values are not ready at module load (a test checks they agree).
export const GRID_W = 6 * CELL
export const GRID_H = 6 * CELL
const BOTTOM = GY + GRID_H

/** Where a place's label is: the middle of its square, near the foot. */
export const cellCentre = (col: number, row: number) => ({ x: GX + col * CELL + CELL / 2, y: GY + (ROWS - 1 - row) * CELL + CELL / 2 })

/** Small map symbols, each about 20 px across, drawn around (0, 0). */
function Glyph({ id, x, y }: { id: string; x: number; y: number }) {
  const t = `translate(${x} ${y - 4})`
  switch (id) {
    case 'church':
      return (
        <g transform={t}>
          <rect x={-8} y={-1} width={11} height={8} fill={BUILD} />
          <rect x={1} y={-7} width={6} height={14} fill={BUILD} />
          <path d="M4 -7 V-13 M1.5 -10.5 H6.5" stroke={BUILD} strokeWidth={1.6} fill="none" />
          <rect x={3.2} y={1} width={1.6} height={3} fill={WINDOW} />
        </g>
      )
    case 'school':
      return (
        <g transform={t}>
          <rect x={-10} y={-3} width={20} height={9} fill={BUILD} />
          <rect x={-10} y={-3} width={20} height={2} fill={ROOF} />
          {[-7, -2, 3].map((wx) => <rect key={wx} x={wx} y={1} width={3.4} height={3} fill={WINDOW} />)}
          <path d="M0 -3 V-11" stroke={BUILD} strokeWidth={1.2} />
          <path d="M0 -11 H6 L4 -8.5 L6 -6 H0 Z" fill={ROOF} />
        </g>
      )
    case 'farm':
      return (
        <g transform={t}>
          <path d="M-10 6 V-1 L-5 -7 L0 -1 V6 Z" fill={BUILD} />
          <path d="M-12 -0.5 L-5 -8.5 L2 -0.5 Z" fill={ROOF} />
          <rect x={3} y={-2} width={8} height={8} fill={BUILD} />
          <path d="M2 -2 L7 -7 L12 -2 Z" fill={ROOF} />
          <rect x={-6.2} y={2} width={2.4} height={4} fill={WINDOW} />
        </g>
      )
    case 'station':
      return (
        <g transform={t}>
          <rect x={-10} y={-6} width={20} height={9} fill={BUILD} />
          {[-7, -2, 3].map((wx) => <rect key={wx} x={wx} y={-4} width={3.6} height={3.4} fill={WINDOW} />)}
          <path d="M-12 6 H12" stroke={BUILD} strokeWidth={1.6} />
          <path d="M-9 3 V6 M-3 3 V6 M3 3 V6 M9 3 V6" stroke={BUILD} strokeWidth={1.2} />
        </g>
      )
    case 'mill':
      return (
        <g transform={t}>
          <path d="M-4 7 L-2.5 -3 H2.5 L4 7 Z" fill={BUILD} />
          <path d="M0 -4 L-9 -11 M0 -4 L9 -11 M0 -4 L-9 3 M0 -4 L9 3" stroke={BUILD} strokeWidth={2.2} strokeLinecap="round" />
          <circle cx={0} cy={-4} r={1.8} fill={ROOF} />
        </g>
      )
    case 'shop':
      return (
        <g transform={t}>
          <rect x={-9} y={-2} width={18} height={9} fill={BUILD} />
          <path d="M-11 -2 L-8.5 -8 H8.5 L11 -2 Z" fill={ROOF} />
          <path d="M-5.5 -2 L-4 -8 M-0.5 -2 V-8 M4.5 -2 L3 -8" stroke={WINDOW} strokeWidth={1.2} />
          <rect x={-2} y={2} width={4} height={5} fill={WINDOW} />
        </g>
      )
    case 'quarry':
      return (
        <g transform={t}>
          <path d="M-11 6 L-6 -6 L-2 -1 L3 -9 L11 6 Z" fill="#B8B2A3" stroke={BUILD} strokeWidth={1.2} strokeLinejoin="round" />
          <path d="M-4 6 L-1 0 M2 6 L5 -2 M6 6 L8 2" stroke={BUILD} strokeWidth={1} />
        </g>
      )
    default: // pond
      return (
        <g transform={t}>
          <path d="M-11 0 C-10 -7 -2 -8 3 -6 C10 -6 12 -1 9 3 C5 7 -4 7 -8 5 C-10 4 -11 2 -11 0 Z" fill={WATER} stroke={WATER_EDGE} strokeWidth={1.5} />
          <path d="M-5 -1 H1 M-2 2 H5" stroke={WATER_EDGE} strokeWidth={1} strokeLinecap="round" />
        </g>
      )
  }
}

const cx = (col: number) => GX + col * CELL + CELL / 2
const cy = (row: number) => GY + (ROWS - 1 - row) * CELL + CELL / 2
const TREES: [number, number][] = [[-14, -10], [-4, -14], [8, -9], [-10, 0], [2, -3], [13, 1], [-14, 8], [10, 9]]

/** Only squares with no place in them: a lane across the top, a stream through the pond, and a wood in the corner. */
function Scenery() {
  const lane = `M${GX} ${cy(5) - 4} C${cx(1)} ${cy(5) - 12} ${cx(2) - 6} ${cy(5) - 6} ${cx(2)} ${cy(5) + 2} S${cx(2) + 6} ${cy(4) - 6} ${cx(3)} ${cy(4) - 8} S${cx(4)} ${cy(4) + 4} ${GX + GRID_W} ${cy(4) - 2}`
  const py = cy(1) - 4
  const stream = `M${GX + GRID_W} ${py + 3} C${cx(5)} ${py - 6} ${cx(4) + 22} ${py + 2} ${cx(4) + 11} ${py} M${cx(4) - 11} ${py} C${cx(3) + 10} ${py - 6} ${cx(3) - 8} ${py + 6} ${cx(2)} ${py + 1} S${cx(1)} ${py - 6} ${cx(0)} ${py + 2} L${GX} ${py - 2}`
  return (
    <g aria-hidden="true">
      <rect x={GX + 5 * CELL + 3} y={GY + 5 * CELL + 4} width={CELL - 6} height={CELL - 8} rx={6} fill={GREEN} />
      {TREES.map(([dx, dy], i) => (
        <g key={i} transform={`translate(${cx(5) + dx * 0.9} ${cy(0) + dy * 0.9 - 4})`}>
          <circle r={4.2} fill={GREEN_DARK} />
          <circle r={1.4} cy={-1} cx={-1} fill="#8DB46F" />
        </g>
      ))}
      <path d={lane} fill="none" stroke={ROAD_EDGE} strokeWidth={5.5} strokeLinecap="round" strokeLinejoin="round" />
      <path d={lane} fill="none" stroke={ROAD} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" />
      <path d={stream} fill="none" stroke={WATER_EDGE} strokeWidth={2} strokeLinecap="round" />
    </g>
  )
}

function Grid({ config, state, setState, marked, reduced, locked }: Props & { config: GridConfig }) {
  const col = inGrid(state?.col, state?.row) ? (state.col as number) : 2
  const row = inGrid(state?.col, state?.row) ? (state.row as number) : 2
  const svg = useRef<SVGSVGElement>(null)
  const [drag, setDrag] = useState(false)
  const set = (c: number, r: number) => {
    const nc = clamp(c, 0, COLS - 1)
    const nr = clamp(r, 0, ROWS - 1)
    if (!locked && (nc !== col || nr !== row)) setState({ col: nc, row: nr })
  }
  const fromPointer = (e: PointerEvent) => {
    const b = svg.current?.getBoundingClientRect()
    if (!b || b.width === 0) return
    const x = ((e.clientX - b.left) / b.width) * GW
    const y = ((e.clientY - b.top) / b.height) * GH
    set(Math.floor((x - GX) / CELL), ROWS - 1 - Math.floor((y - GY) / CELL))
  }
  const onKey = (e: KeyboardEvent) => {
    const d: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }
    const m = d[e.key]
    if (m) { e.preventDefault(); e.stopPropagation(); set(col + m[0], row + m[1]) }
  }
  const good = marked === 'right' || marked === 'shown'
  const ring = marked === 'wrong' ? BAD : good ? GOOD : INK
  const text = good ? gridWorking(config.place, col, row) || madeGrid(config, col, row) : marked === 'wrong' ? madeGrid(config, col, row) : ''
  const target = PLACES[config.place]
  const ease = reduced ? 'none' : 'transform 600ms ease-in-out'
  const xLine = GX + col * CELL
  const yLine = GY + (ROWS - row) * CELL

  return (
    <div className={`nodrag flex flex-col items-center gap-2 ${PALETTE} [&:has(:focus-visible)_.mr-kbd]:block`}>
      <figure className="flex w-full max-w-[360px] flex-col gap-1.5">
        <svg
          ref={svg}
          viewBox={`0 0 ${GW} ${GH}`}
          className="block h-auto w-full touch-none select-none outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)]"
          role="application"
          aria-roledescription="map cursor"
          aria-label={`A map of an invented village, six squares by six. The cursor is on the square along ${easting(col)}, up ${northing(row)}. Move it with the arrow keys.`}
          tabIndex={locked ? -1 : 0}
          onKeyDown={onKey}
          onPointerDown={(e: PointerEvent) => { if (locked) return; svg.current?.setPointerCapture?.(e.pointerId); setDrag(true); fromPointer(e) }}
          onPointerMove={(e: PointerEvent) => { if (drag) fromPointer(e) }}
          onPointerUp={() => setDrag(false)}
          onPointerCancel={() => setDrag(false)}
        >
          <rect width={GW} height={GH} rx={16} fill={PAPER} stroke={EDGE} strokeWidth={1.5} />
          <rect x={GX} y={GY} width={GRID_W} height={GRID_H} fill={PAPER} stroke={SHEET_EDGE} strokeWidth={1.5} />
          <Scenery />
          {Array.from({ length: COLS - 1 }, (_, i) => (
            <line key={`v${i}`} x1={GX + (i + 1) * CELL} x2={GX + (i + 1) * CELL} y1={GY} y2={BOTTOM} stroke={GRIDBLUE} strokeWidth={1} />
          ))}
          {Array.from({ length: ROWS - 1 }, (_, i) => (
            <line key={`h${i}`} x1={GX} x2={GX + GRID_W} y1={GY + (i + 1) * CELL} y2={GY + (i + 1) * CELL} stroke={GRIDBLUE} strokeWidth={1} />
          ))}
          {PLACE_IDS.map((id) => {
            const c = cellCentre(PLACES[id].col, PLACES[id].row)
            return (
              <g key={id} aria-hidden="true">
                <Glyph id={id} x={c.x} y={c.y} />
                <text x={c.x} y={c.y + 19} textAnchor="middle" fontSize={12} fontWeight={700} fill={INK} {...HALO}>{sentence(id)}</text>
              </g>
            )
          })}
          <g aria-hidden="true" fontSize={12} fontWeight={600} fontStyle="italic" fill={SOFT}>
            <text x={cx(5)} y={cy(0) + 19} textAnchor="middle" {...HALO}>Wood</text>
            <text x={cx(0)} y={cy(1) + 12} textAnchor="middle" fill={WATER_EDGE} {...HALO}>Stream</text>
          </g>
          {/* the grid line numbers, in the margin as on a printed sheet */}
          {Array.from({ length: COLS + 1 }, (_, i) => (
            <text key={`e${i}`} x={GX + i * CELL} y={BOTTOM + 18} textAnchor="middle" fontSize={12} fontWeight={700} fill={NUM} aria-hidden="true">{easting(i)}</text>
          ))}
          {Array.from({ length: ROWS + 1 }, (_, i) => (
            <text key={`n${i}`} x={GX - 8} y={GY + (ROWS - i) * CELL + 4} textAnchor="end" fontSize={12} fontWeight={700} fill={NUM} aria-hidden="true">{northing(i)}</text>
          ))}
          {/* the along line: blue, from the square's left edge down to its number */}
          <g style={{ transform: `translateX(${xLine}px)`, transition: ease }} aria-hidden="true">
            <line x1={0} x2={0} y1={GY} y2={BOTTOM + 5} stroke={ALONG} strokeWidth={2.5} strokeLinecap="round" />
            <rect x={-15} y={BOTTOM + 5} width={30} height={19} rx={6} fill={ALONG} />
            <text x={0} y={BOTTOM + 19} textAnchor="middle" fontSize={12} fontWeight={800} fill="#FFFFFF">{easting(col)}</text>
          </g>
          {/* the up line: orange, from the square's bottom edge across to its number */}
          <g style={{ transform: `translateY(${yLine}px)`, transition: ease }} aria-hidden="true">
            <line x1={GX - 5} x2={GX + GRID_W} y1={0} y2={0} stroke={UP} strokeWidth={2.5} strokeLinecap="round" />
            <rect x={GX - 38} y={-9.5} width={30} height={19} rx={6} fill={UP} />
            <text x={GX - 23} y={4.5} textAnchor="middle" fontSize={12} fontWeight={800} fill="#FFFFFF">{northing(row)}</text>
          </g>
          {/* the cursor: the square the two lines have found */}
          <g style={{ transform: `translate(${xLine}px, ${yLine}px)`, transition: ease }} aria-hidden="true">
            <rect x={1.5} y={-CELL + 1.5} width={CELL - 3} height={CELL - 3} rx={3} fill={ring} fillOpacity={0.12} stroke={ring} strokeWidth={2.5} />
            <circle cx={0} cy={0} r={4.5} fill={PAPER} stroke={ring} strokeWidth={2.5} />
          </g>
          {config.ask === 'square' && target && (
            <text x={GX + GRID_W / 2} y={17} textAnchor="middle" fontSize={15} fontWeight={800} fill={INK} aria-label={`Find square ${refOf(target.col, target.row)}`}>
              Find square <tspan fill={ALONG}>{easting(target.col)}</tspan><tspan fill={UP}>{northing(target.row)}</tspan>
            </text>
          )}
        </svg>
        <figcaption className="text-center text-[12px] font-bold text-ss-slate">
          Read <span style={{ color: 'var(--mr-b)' }}>along</span> first, then <span style={{ color: 'var(--mr-o)' }}>up</span>, to the square's bottom-left corner.
        </figcaption>
      </figure>
      <div className="grid w-full max-w-[360px] grid-cols-2 gap-x-6">
        <Stepper name="Along" tone="var(--mr-b)" shown={String(easting(col))} less="Move the cursor one square left" more="Move the cursor one square right" locked={locked} down={() => set(col - 1, row)} up={() => set(col + 1, row)} />
        <Stepper name="Up" tone="var(--mr-o)" shown={String(northing(row))} less="Move the cursor one square down" more="Move the cursor one square up" locked={locked} down={() => set(col, row - 1)} up={() => set(col, row + 1)} />
      </div>
      <p className="mr-kbd hidden text-[12px] text-ss-slate">The arrow keys move the cursor.</p>
      <Verdict marked={marked} text={text} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// The hill and its cross-section.

export const CW = 360
export const CH = 364
export const MCX = 180
export const MCY = 120
/** The hill is drawn this much smaller than its 10 m-a-pixel working, so the map and the section fit one card. */
export const K = 0.74
const PROF_BASE = 340
const PROF_TOP = 256
export const PROF_SCALE = 100 / 120
const PSC = PROF_SCALE * 0.72
export const PROF_X0 = MCX - 140

/** An angle that eases to its target the short way round (lines repeat every 180 degrees). */
function useEased(target: number, reduced: boolean): number {
  const [v, setV] = useState(target)
  const cur = useRef(target)
  useEffect(() => {
    if (reduced) { cur.current = target; setV(target); return }
    const from = cur.current
    let d = (((target - from) % 180) + 180) % 180
    if (d > 90) d -= 180
    if (Math.abs(d) < 1e-6) return
    const t0 = performance.now()
    let id = 0
    const frame = (now: number) => {
      const k = Math.min(1, (now - t0) / 800)
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
      cur.current = from + d * e
      setV(cur.current)
      if (k < 1) id = requestAnimationFrame(frame)
    }
    id = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(id)
  }, [target, reduced])
  return v
}

const mapXY = (dx: number, dy: number) => `${(MCX + dx * K).toFixed(1)},${(MCY - dy * K).toFixed(1)}`

function contourPath(hill: string, level: number): string {
  const pts: string[] = []
  for (let t = 0; t < 360; t += 3) {
    const p = contourPoint(hill, level, t)
    pts.push(mapXY(p.dx, p.dy))
  }
  return `M ${pts.join(' L ')} Z`
}

/** The contours that carry their height. Between them the lines run on unmarked, as on a printed map. */
export const LABELLED = [20, 60, 100]

/** Where each height is written: each on its own bearing, chosen so no two touch and none sits on the summit mark. A height is about 26 px wide and 13 tall; bearings avoid the six lines the section can lie along. */
export function contourLabels(hill: string): { level: number; x: number; y: number }[] {
  const bearings = Array.from({ length: 12 }, (_, i) => 15 + i * 30)
  const at = LABELLED.map((l) => bearings.map((a) => {
    const p = contourPoint(hill, l, a)
    return { x: p.dx * K, y: p.dy * K }
  }))
  const room = (p: { x: number; y: number }, q: { x: number; y: number }) => Math.max(Math.abs(p.x - q.x) / 28, Math.abs(p.y - q.y) / 14)
  let best: number[] = [0, 0, 0]
  let bestScore = -1
  for (let i = 0; i < 12; i++) for (let j = 0; j < 12; j++) for (let k = 0; k < 12; k++) {
    const [p, q, r] = [at[0][i], at[1][j], at[2][k]]
    const score = Math.min(room(p, q), room(q, r), room(p, r), Math.hypot(r.x, r.y) / 22)
    if (score > bestScore) { bestScore = score; best = [i, j, k] }
  }
  return LABELLED.map((level, n) => {
    const p = at[n][best[n]]
    return { level, x: MCX + p.x, y: MCY - p.y }
  })
}

const SHEET_HALF = 112

function Cross({ config, state, setState, marked, reduced, locked }: Props & { config: CrossConfig }) {
  const dir = Number.isInteger(state?.dir) ? clamp(state.dir as number, 0, DIRS - 1) : 0
  const phi = useEased(dir * STEP, reduced)
  const svg = useRef<SVGSVGElement>(null)
  const [drag, setDrag] = useState(false)
  const set = (d: number) => { if (!locked && d !== dir) setState({ dir: ((d % DIRS) + DIRS) % DIRS }) }
  const fromPointer = (e: PointerEvent) => {
    const b = svg.current?.getBoundingClientRect()
    if (!b || b.width === 0) return
    const x = ((e.clientX - b.left) / b.width) * CW - MCX
    const y = MCY - ((e.clientY - b.top) / b.height) * CH
    if (Math.hypot(x, y) < 20) return
    const deg = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 180
    set(Math.round(deg / STEP) % DIRS)
  }
  const onKey = (e: KeyboardEvent) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0
    if (d) { e.preventDefault(); e.stopPropagation(); set(dir + d) }
  }
  const good = marked === 'right' || marked === 'shown'
  const ring = marked === 'wrong' ? BAD : good ? GOOD : PAPER
  const text = good ? crossWorking(config.hill, dir, config.goal) : marked === 'wrong' ? madeCross(config.hill, dir, config.goal) : ''
  const c = Math.cos((phi * Math.PI) / 180)
  const s = Math.sin((phi * Math.PI) / 180)
  const R = RADIUS * K
  const A = { x: MCX - R * c, y: MCY + R * s }
  const B = { x: MCX + R * c, y: MCY - R * s }
  const prof = profileOf(config.hill, phi)
  const profPts = prof.map((p) => `${(PROF_X0 + p.s + RADIUS).toFixed(1)},${(PROF_BASE - p.h * PSC).toFixed(1)}`)
  const ground = `M ${PROF_X0},${PROF_BASE} L ${profPts.join(' L ')} L ${PROF_X0 + 2 * RADIUS},${PROF_BASE} Z`
  const labels = contourLabels(config.hill)
  const sheetX = MCX - SHEET_HALF
  const sheetY = MCY - SHEET_HALF

  return (
    <div className={`nodrag flex flex-col items-center gap-2 ${PALETTE} [&:has(:focus-visible)_.mr-kbd]:block`}>
      <figure className="flex w-full max-w-[360px] flex-col gap-1.5">
        <svg
          ref={svg}
          viewBox={`0 0 ${CW} ${CH}`}
          className="block h-auto w-full touch-none select-none"
          role="group"
          aria-label="A hill drawn with contour lines every 20 metres, a straight line A to B through its summit, and the ground along that line drawn below it. Turn the line to change the ground it shows."
          onPointerDown={(e: PointerEvent) => { if (locked) return; svg.current?.setPointerCapture?.(e.pointerId); setDrag(true); fromPointer(e) }}
          onPointerMove={(e: PointerEvent) => { if (drag) fromPointer(e) }}
          onPointerUp={() => setDrag(false)}
          onPointerCancel={() => setDrag(false)}
        >
          <defs>
            <pattern id="mr-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="6" stroke={GROUND_EDGE} strokeWidth="0.8" opacity="0.35" />
            </pattern>
            <clipPath id="mr-sheet"><rect x={sheetX} y={sheetY} width={SHEET_HALF * 2} height={SHEET_HALF * 2} /></clipPath>
          </defs>
          <rect width={CW} height={CH} rx={16} fill={PAPER} stroke={EDGE} strokeWidth={1.5} />
          {/* the survey sheet, with its faint grid */}
          <rect x={sheetX} y={sheetY} width={SHEET_HALF * 2} height={SHEET_HALF * 2} fill={PAPER} stroke={SHEET_EDGE} strokeWidth={1.5} />
          <g clipPath="url(#mr-sheet)" aria-hidden="true">
            {[-2, -1, 0, 1, 2].map((i) => (
              <g key={i}>
                <line x1={MCX + i * 44} x2={MCX + i * 44} y1={sheetY} y2={sheetY + SHEET_HALF * 2} stroke={GRIDBLUE} strokeWidth={1} />
                <line y1={MCY + i * 44} y2={MCY + i * 44} x1={sheetX} x2={sheetX + SHEET_HALF * 2} stroke={GRIDBLUE} strokeWidth={1} />
              </g>
            ))}
          </g>
          {LEVELS.map((l) => (
            <path key={l} d={contourPath(config.hill, l)} fill="none" stroke={BROWN} strokeWidth={l % 40 === 20 ? 1.6 : 1.1} strokeLinejoin="round" aria-hidden="true" />
          ))}
          {/* the summit: a triangulation point */}
          <path d={`M${MCX} ${MCY - 5} L${MCX + 4.6} ${MCY + 3} H${MCX - 4.6} Z`} fill="none" stroke={BUILD} strokeWidth={1.4} strokeLinejoin="round" aria-hidden="true" />
          <circle cx={MCX} cy={MCY + 0.5} r={0.9} fill={BUILD} aria-hidden="true" />
          {/* the six places the line can end */}
          {Array.from({ length: DIRS * 2 }, (_, i) => {
            const a = (i * STEP * Math.PI) / 180
            return <circle key={i} cx={MCX + R * Math.cos(a)} cy={MCY - R * Math.sin(a)} r={2.5} fill={SHEET_EDGE} aria-hidden="true" />
          })}
          <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke={ALONG} strokeWidth={2.5} strokeLinecap="round" aria-hidden="true" />
          {labels.map((l) => (
            <text key={l.level} x={l.x} y={l.y + 4} textAnchor="middle" fontSize={12} fontWeight={700} fill={BROWN} {...HALO} aria-hidden="true">{l.level}</text>
          ))}
          {(['A', 'B'] as const).map((k) => {
            const p = k === 'A' ? A : B
            const inner = (
              <>
                <circle cx={p.x} cy={p.y} r={12} fill={ALONG} stroke={ring} strokeWidth={marked === 'idle' ? 2 : 3.5} />
                <text x={p.x} y={p.y + 4.5} textAnchor="middle" fontSize={13} fontWeight={800} fill="#FFFFFF">{k}</text>
              </>
            )
            return k === 'B' ? (
              <g
                key={k}
                role="slider"
                tabIndex={locked ? -1 : 0}
                aria-label="Turn the line through the hill. Move it with the arrow keys"
                aria-valuemin={0}
                aria-valuemax={DIRS - 1}
                aria-valuenow={dir}
                aria-valuetext={`The line runs from ${compassOf(dir * STEP + 180)} to ${compassOf(dir * STEP)}`}
                aria-disabled={locked || undefined}
                onKeyDown={onKey}
                className={`outline-none [&:focus-visible>circle]:stroke-[color:var(--subject)] [&:focus-visible>circle]:stroke-[4] ${locked ? '' : 'cursor-grab'}`}
              >
                {inner}
              </g>
            ) : (
              <g key={k} aria-hidden="true">{inner}</g>
            )
          })}
          {/* the section: the ground along the line, drawn in a ruled window */}
          <text x={PROF_X0} y={PROF_TOP - 8} fontSize={12} fontWeight={700} fill={INK} aria-hidden="true">Ground along your line</text>
          <rect x={PROF_X0} y={PROF_TOP} width={2 * RADIUS} height={PROF_BASE - PROF_TOP} fill="#FCFAF2" stroke={SHEET_EDGE} strokeWidth={1.2} aria-hidden="true" />
          {[0, 60, 120].map((h) => (
            <g key={h} aria-hidden="true">
              {h > 0 && <line x1={PROF_X0} x2={PROF_X0 + 2 * RADIUS} y1={PROF_BASE - h * PSC} y2={PROF_BASE - h * PSC} stroke={GRIDBLUE} strokeWidth={1} strokeDasharray="3 3" />}
              <text x={PROF_X0 - 6} y={PROF_BASE - h * PSC + 4} textAnchor="end" fontSize={12} fontWeight={700} fill={NUM}>{h}</text>
            </g>
          ))}
          <path d={ground} fill={LAND} aria-hidden="true" />
          <path d={ground} fill="url(#mr-hatch)" aria-hidden="true" />
          <polyline points={profPts.join(' ')} fill="none" stroke={GROUND_EDGE} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" aria-hidden="true" />
          <line x1={PROF_X0} x2={PROF_X0 + 2 * RADIUS} y1={PROF_BASE} y2={PROF_BASE} stroke={SOFT} strokeWidth={1.5} aria-hidden="true" />
          <text x={PROF_X0 + 2} y={PROF_BASE + 17} fontSize={12} fontWeight={800} fill={ALONG} aria-hidden="true">A</text>
          <text x={PROF_X0 + 2 * RADIUS - 2} y={PROF_BASE + 17} textAnchor="end" fontSize={12} fontWeight={800} fill={ALONG} aria-hidden="true">B</text>
        </svg>
        <figcaption className="text-center text-[12px] font-bold text-ss-slate">
          Brown lines join ground of equal height, in metres.
        </figcaption>
      </figure>
      <div className="w-full max-w-[360px]">
        <Stepper name="Turn the line" wide shown={`${dir * STEP}°`} less="Turn the line one step anticlockwise" more="Turn the line one step clockwise" locked={locked} down={() => set(dir - 1)} up={() => set(dir + 1)} />
      </div>
      <p className="mr-kbd hidden text-[12px] text-ss-slate">The arrow keys turn the line.</p>
      <Verdict marked={marked} text={text} />
    </div>
  )
}

export function MapReaderView(props: Props) {
  const { config } = props
  return config.task === 'grid' ? <Grid {...props} config={config} /> : <Cross {...props} config={config} />
}

export { placeAt }
