'use client'
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { SceneMarked, SceneViewProps } from '../types'
import type { MapReaderConfig, MapReaderState } from './config'
import {
  COLS, DIRS, HMAX, LEVELS, PLACES, PLACE_IDS, RADIUS, ROWS, STEP, compassOf, contourPoint, crossWorking, easting,
  gridWorking, inGrid, madeCross, madeGrid, northing, placeAt, profileOf, refOf, sentence,
} from './config'

type Props = SceneViewProps<MapReaderConfig, MapReaderState>
type GridConfig = Extract<MapReaderConfig, { task: 'grid' }>
type CrossConfig = Extract<MapReaderConfig, { task: 'cross-section' }>

// The scene's own inks: flat solid colours, each over 3:1 on the card in both themes.
const PALETTE =
  '[--mr-b:#1D4ED8] [--mr-bt:#FFFFFF] [--mr-o:#C2410C] [--mr-ot:#FFFFFF] [--mr-water:#93C5FD] [--mr-land:#F3E6D3] [--mr-brown:#92400E] ' +
  'dark:[--mr-b:#93C5FD] dark:[--mr-bt:#0B1220] dark:[--mr-o:#FDBA74] dark:[--mr-ot:#0B1220] dark:[--mr-water:#1D4ED8] dark:[--mr-land:#4A3320] dark:[--mr-brown:#E0B36F]'
const INK = 'var(--ss-ink, #16202A)'
const SLATE = 'var(--ss-slate, #5B6B7B)'
const LINE = 'var(--ss-line, #D5DCE3)'
const PANEL = 'var(--ss-panel, #FFFFFF)'
const HALO = { stroke: PANEL, strokeWidth: 4, paintOrder: 'stroke', strokeLinejoin: 'round' } as const

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

function Verdict({ marked, text }: { marked: SceneMarked; text: string }) {
  if (marked === 'idle' || !text) return null
  return <p className="max-w-[340px] text-center text-[13px] font-extrabold leading-snug text-ss-ink">{text}</p>
}

// ---------------------------------------------------------------------------
// The grid map.

export const GW = 360
export const GH = 400
export const GX = 42
export const GY = 34
export const CELL = 51
// Literals, not COLS * CELL: config imports this file, so its values are not ready at module load (a test checks they agree).
export const GRID_W = 6 * CELL
export const GRID_H = 6 * CELL
const BOTTOM = GY + GRID_H

/** Where a place's label is: the middle of its square, near the foot. */
export const cellCentre = (col: number, row: number) => ({ x: GX + col * CELL + CELL / 2, y: GY + (ROWS - 1 - row) * CELL + CELL / 2 })

/** Flat glyphs, each about 20 px across, drawn around (0, 0). */
const GLYPH: Record<string, string> = {
  church: 'M-8 6 V-3 L0 -11 L8 -3 V6 Z',
  school: 'M-10 6 V-5 H10 V6 Z',
  farm: 'M-10 6 V-3 L-5 -9 H5 L10 -3 V6 Z',
  station: 'M-10 3 V-6 H10 V3 Z M-6 6 a2 2 0 1 0 0.01 0 Z M6 6 a2 2 0 1 0 0.01 0 Z',
  mill: 'M-5 6 L-3 -4 H3 L5 6 Z M-9 -10 L9 2 L7 4 L-11 -8 Z M9 -10 L-9 2 L-7 4 L11 -8 Z',
  shop: 'M-9 6 V-2 H9 V6 Z M-11 -2 L-8 -9 H8 L11 -2 Z',
  quarry: 'M-11 6 L-5 -7 L0 0 L5 -9 L11 6 Z',
}

function Glyph({ id, x, y }: { id: string; x: number; y: number }) {
  if (id === 'pond') {
    return <ellipse cx={x} cy={y - 4} rx={11} ry={7} fill="var(--mr-water, #93C5FD)" stroke="var(--mr-b, #1D4ED8)" strokeWidth={2} />
  }
  return <path transform={`translate(${x} ${y - 4})`} d={GLYPH[id]} fill={INK} fillRule="evenodd" />
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
  const ring = marked === 'wrong' ? 'var(--ss-bad, #B91C1C)' : good ? 'var(--ss-good, #15803D)' : INK
  const text = good ? gridWorking(config.place, col, row) || madeGrid(config, col, row) : marked === 'wrong' ? madeGrid(config, col, row) : ''
  const target = PLACES[config.place]
  const ease = reduced ? 'none' : 'transform 600ms ease-in-out'
  const xLine = GX + col * CELL
  const yLine = GY + (ROWS - row) * CELL

  return (
    <div className={`nodrag flex flex-col items-center gap-2 ${PALETTE} [&:has(:focus-visible)_.mr-kbd]:block`}>
      <svg
        ref={svg}
        viewBox={`0 0 ${GW} ${GH}`}
        width={GW}
        height={GH}
        className="touch-none select-none outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)]"
        style={{ maxWidth: '100%', height: 'auto' }}
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
        <rect x={GX} y={GY} width={GRID_W} height={GRID_H} fill={PANEL} />
        {Array.from({ length: COLS + 1 }, (_, i) => (
          <line key={`v${i}`} x1={GX + i * CELL} x2={GX + i * CELL} y1={GY} y2={BOTTOM} stroke={LINE} strokeWidth={i === 0 || i === COLS ? 2 : 1.5} />
        ))}
        {Array.from({ length: ROWS + 1 }, (_, i) => (
          <line key={`h${i}`} x1={GX} x2={GX + GRID_W} y1={GY + i * CELL} y2={GY + i * CELL} stroke={LINE} strokeWidth={i === 0 || i === ROWS ? 2 : 1.5} />
        ))}
        {PLACE_IDS.map((id) => {
          const c = cellCentre(PLACES[id].col, PLACES[id].row)
          return (
            <g key={id} aria-hidden="true">
              <Glyph id={id} x={c.x} y={c.y} />
              <text x={c.x} y={c.y + 19} textAnchor="middle" fontSize={12} fontWeight={800} fill={INK} {...HALO}>{sentence(id)}</text>
            </g>
          )
        })}
        {/* the grid line numbers */}
        {Array.from({ length: COLS + 1 }, (_, i) => (
          <text key={`e${i}`} x={GX + i * CELL} y={BOTTOM + 19} textAnchor="middle" fontSize={13} fontWeight={700} fill={SLATE} aria-hidden="true">{easting(i)}</text>
        ))}
        {Array.from({ length: ROWS + 1 }, (_, i) => (
          <text key={`n${i}`} x={GX - 23} y={GY + (ROWS - i) * CELL + 4} textAnchor="middle" fontSize={13} fontWeight={700} fill={SLATE} aria-hidden="true">{northing(i)}</text>
        ))}
        {/* the along line: blue, from the square's left edge down to its number */}
        <g style={{ transform: `translateX(${xLine}px)`, transition: ease }} aria-hidden="true">
          <line x1={0} x2={0} y1={GY} y2={BOTTOM} stroke="var(--mr-b, #1D4ED8)" strokeWidth={5} />
          <rect x={-18} y={BOTTOM + 4} width={36} height={22} rx={11} fill="var(--mr-b, #1D4ED8)" />
          <text x={0} y={BOTTOM + 20} textAnchor="middle" fontSize={14} fontWeight={800} fill="var(--mr-bt, #FFFFFF)">{easting(col)}</text>
        </g>
        {/* the up line: orange, from the square's bottom edge across to its number */}
        <g style={{ transform: `translateY(${yLine}px)`, transition: ease }} aria-hidden="true">
          <line x1={GX} x2={GX + GRID_W} y1={0} y2={0} stroke="var(--mr-o, #C2410C)" strokeWidth={5} />
          <rect x={GX - 40} y={-11} width={34} height={22} rx={11} fill="var(--mr-o, #C2410C)" />
          <text x={GX - 23} y={5} textAnchor="middle" fontSize={14} fontWeight={800} fill="var(--mr-ot, #FFFFFF)">{northing(row)}</text>
        </g>
        {/* the cursor: the square the two lines have found */}
        <g style={{ transform: `translate(${xLine}px, ${yLine}px)`, transition: ease }} aria-hidden="true">
          <rect x={2.5} y={-CELL + 2.5} width={CELL - 5} height={CELL - 5} fill="none" stroke={ring} strokeWidth={5} />
          <circle cx={0} cy={0} r={7} fill={PANEL} stroke={ring} strokeWidth={4} />
        </g>
        <text x={GX + GRID_W / 2} y={BOTTOM + 46} textAnchor="middle" fontSize={13} fontWeight={800} fill={SLATE} aria-hidden="true">
          <tspan fill="var(--mr-b, #1D4ED8)">along</tspan> first, then <tspan fill="var(--mr-o, #C2410C)">up</tspan>
        </text>
        {config.ask === 'square' && target && (
          <text x={GX + GRID_W / 2} y={20} textAnchor="middle" fontSize={16} fontWeight={800} fill={INK} aria-label={`Find square ${refOf(target.col, target.row)}`}>
            Find square <tspan fill="var(--mr-b, #1D4ED8)">{easting(target.col)}</tspan><tspan fill="var(--mr-o, #C2410C)">{northing(target.row)}</tspan>
          </text>
        )}
      </svg>
      <p className="mr-kbd hidden text-[12px] text-ss-slate">The arrow keys move the cursor.</p>
      <Verdict marked={marked} text={text} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// The hill and its cross-section.

export const CW = 360
export const CH = 480
export const MCX = 180
export const MCY = 156
const PROF_BASE = 440
export const PROF_SCALE = 100 / 120
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

const mapXY = (dx: number, dy: number) => `${(MCX + dx).toFixed(1)},${(MCY - dy).toFixed(1)}`

function contourPath(hill: string, level: number): string {
  const pts: string[] = []
  for (let t = 0; t < 360; t += 3) {
    const p = contourPoint(hill, level, t)
    pts.push(mapXY(p.dx, p.dy))
  }
  return `M ${pts.join(' L ')} Z`
}

export const LABELLED = [20, 60, 100]

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
  const ring = marked === 'wrong' ? 'var(--ss-bad, #B91C1C)' : good ? 'var(--ss-good, #15803D)' : 'var(--mr-b, #1D4ED8)'
  const text = good ? crossWorking(config.hill, dir, config.goal) : marked === 'wrong' ? madeCross(config.hill, dir, config.goal) : ''
  const c = Math.cos((phi * Math.PI) / 180)
  const s = Math.sin((phi * Math.PI) / 180)
  const A = { x: MCX - RADIUS * c, y: MCY + RADIUS * s }
  const B = { x: MCX + RADIUS * c, y: MCY - RADIUS * s }
  const prof = profileOf(config.hill, phi)
  const profPts = prof.map((p) => `${(PROF_X0 + p.s + RADIUS).toFixed(1)},${(PROF_BASE - p.h * PROF_SCALE).toFixed(1)}`)
  const ground = `M ${PROF_X0},${PROF_BASE} L ${profPts.join(' L ')} L ${PROF_X0 + 2 * RADIUS},${PROF_BASE} Z`

  return (
    <div className={`nodrag flex flex-col items-center gap-2 ${PALETTE} [&:has(:focus-visible)_.mr-kbd]:block`}>
      <svg
        ref={svg}
        viewBox={`0 0 ${CW} ${CH}`}
        width={CW}
        height={CH}
        className="touch-none select-none"
        style={{ maxWidth: '100%', height: 'auto' }}
        role="group"
        aria-label="A hill drawn with contour lines every 20 metres, a straight line A to B through its summit, and the ground along that line drawn below it. Turn the line to change the ground it shows."
        onPointerDown={(e: PointerEvent) => { if (locked) return; svg.current?.setPointerCapture?.(e.pointerId); setDrag(true); fromPointer(e) }}
        onPointerMove={(e: PointerEvent) => { if (drag) fromPointer(e) }}
        onPointerUp={() => setDrag(false)}
        onPointerCancel={() => setDrag(false)}
      >
        <circle cx={MCX} cy={MCY} r={RADIUS + 4} fill={PANEL} stroke={LINE} strokeWidth={2} />
        {LEVELS.map((l) => (
          <path key={l} d={contourPath(config.hill, l)} fill="none" stroke="var(--mr-brown, #92400E)" strokeWidth={2} strokeLinejoin="round" aria-hidden="true" />
        ))}
        {LABELLED.map((l, i) => {
          const p = contourPoint(config.hill, l, [75, -75, 165][i])
          return (
            <text key={l} x={MCX + p.dx} y={MCY - p.dy + 4} textAnchor="middle" fontSize={12} fontWeight={800} fill="var(--mr-brown, #92400E)" {...HALO} aria-hidden="true">
              {l} m
            </text>
          )
        })}
        {/* the six places the line can point */}
        {Array.from({ length: DIRS * 2 }, (_, i) => {
          const a = (i * STEP * Math.PI) / 180
          return <circle key={i} cx={MCX + (RADIUS + 4) * Math.cos(a)} cy={MCY - (RADIUS + 4) * Math.sin(a)} r={3} fill={SLATE} aria-hidden="true" />
        })}
        <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke="var(--mr-b, #1D4ED8)" strokeWidth={5} strokeLinecap="round" aria-hidden="true" />
        {(['A', 'B'] as const).map((k) => {
          const p = k === 'A' ? A : B
          const inner = (
            <>
              <circle cx={p.x} cy={p.y} r={16} fill="var(--mr-b, #1D4ED8)" stroke={ring} strokeWidth={marked === 'idle' ? 0 : 4} />
              <text x={p.x} y={p.y + 5} textAnchor="middle" fontSize={15} fontWeight={800} fill="var(--mr-bt, #FFFFFF)">{k}</text>
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
              className={`outline-none [&:focus-visible>circle]:stroke-[color:var(--subject)] [&:focus-visible>circle]:stroke-[5] ${locked ? '' : 'cursor-grab'}`}
            >
              {inner}
            </g>
          ) : (
            <g key={k} aria-hidden="true">{inner}</g>
          )
        })}
        {/* the ground along the line */}
        <path d={ground} fill="var(--mr-land, #F3E6D3)" aria-hidden="true" />
        <polyline points={profPts.join(' ')} fill="none" stroke="var(--mr-b, #1D4ED8)" strokeWidth={5} strokeLinejoin="round" strokeLinecap="round" aria-hidden="true" />
        <line x1={PROF_X0} x2={PROF_X0 + 2 * RADIUS} y1={PROF_BASE} y2={PROF_BASE} stroke={SLATE} strokeWidth={2} aria-hidden="true" />
        <text x={PROF_X0} y={324} fontSize={13} fontWeight={800} fill="var(--mr-b, #1D4ED8)" aria-hidden="true">Ground along your line</text>
        <text x={PROF_X0 + 4} y={PROF_BASE + 20} fontSize={14} fontWeight={800} fill="var(--mr-b, #1D4ED8)" aria-hidden="true">A</text>
        <text x={PROF_X0 + 2 * RADIUS - 4} y={PROF_BASE + 20} textAnchor="end" fontSize={14} fontWeight={800} fill="var(--mr-b, #1D4ED8)" aria-hidden="true">B</text>
      </svg>
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
