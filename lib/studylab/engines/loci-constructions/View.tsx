'use client'
import { useId, useRef, type KeyboardEvent, type PointerEvent } from 'react'
import type { SceneViewProps } from '../types'
import type { ArcState, LociConfig, LociState, Pt } from './config'
import {
  arcCentre, compassGeometry, conditionError, circleIntersections, COMPASS_A, COMPASS_B, COMPASS_ARM_1, COMPASS_ARM_2, COMPASS_VERTEX,
  fmt, initialPencil, lociConstructionsEngine, markedText, measurements, onLocus, readArcs, readCompassPoint, readInk, readPencil, traceCoverage,
  TRACE_A, TRACE_B, TRACE_C, TRACE_SEG_A, TRACE_SEG_B, TRACE_VERTEX, TRACE_ARM_1, TRACE_ARM_2,
} from './config'

type Props = SceneViewProps<LociConfig, LociState>

// A sheet of drawing paper, not a dark geometry "stage". Its colours are fixed in both themes,
// like measure-shape's instrument panel. Flat ink, paper, wood, graphite and steel only.
const PAPER = '#FCFDFE'
const PAPER_EDGE = '#CBD5E1'
const GRID = '#E7EDF2'
const INK = '#263746'
const SOFT = '#526474'
const FAINT = '#A6B4BF'
const BLUE = '#287EA5'
const BLUE_DARK = '#1F607D'
const BLUE_PALE = '#DCEEF5'
const PENCIL = '#E8B44E'
const PENCIL_EDGE = '#9A6A25'
const WOOD = '#E4C99F'
const GRAPHITE = '#39434C'
const STEEL = '#A8B4BE'
const STEEL_EDGE = '#52616E'
const ARC = '#758894'
const POINT = '#2D6F91'

// Literals, not top-level reads of config constants: config imports this file to register the view.
export const W = 360
export const H = 258
export const UNIT = 15
export const ORIGIN_X = 15
export const ORIGIN_Y = 20
export const TRACE_TOLERANCE_PX = 10
const RADIUS_STEP = 0.5
const PENCIL_STEP = 0.25

const sx = (p: Pt) => ORIGIN_X + p.x * UNIT
const sy = (p: Pt) => ORIGIN_Y + p.y * UNIT
const screen = (p: Pt) => ({ x: sx(p), y: sy(p) })
const pathFrom = (points: readonly Pt[]) => points.map((p, i) => `${i ? 'L' : 'M'}${sx(p).toFixed(1)} ${sy(p).toFixed(1)}`).join(' ')
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const clean = (v: number) => Number(v.toFixed(3))

function PaperGrid() {
  return (
    <g aria-hidden="true">
      {Array.from({ length: 23 }, (_, i) => <line key={`v${i}`} x1={ORIGIN_X + (i + 1) * UNIT} x2={ORIGIN_X + (i + 1) * UNIT} y1={ORIGIN_Y} y2={ORIGIN_Y + 17 * UNIT} stroke={GRID} strokeWidth={0.75} />)}
      {Array.from({ length: 17 }, (_, i) => <line key={`h${i}`} x1={ORIGIN_X} x2={ORIGIN_X + 23 * UNIT} y1={ORIGIN_Y + (i + 1) * UNIT} y2={ORIGIN_Y + (i + 1) * UNIT} stroke={GRID} strokeWidth={0.75} />)}
    </g>
  )
}

function FixedPoint({ at, name, dx = 0, dy = -9 }: { at: Pt; name: string; dx?: number; dy?: number }) {
  const p = screen(at)
  return (
    <g aria-hidden="true">
      <circle cx={p.x} cy={p.y} r={4.5} fill={PAPER} stroke={POINT} strokeWidth={2} />
      <circle cx={p.x} cy={p.y} r={1.7} fill={POINT} />
      <text x={p.x + dx} y={p.y + dy} textAnchor="middle" fontFamily="system-ui, sans-serif" fontSize={12} fontWeight={800} fill={INK} stroke={PAPER} strokeWidth={3} paintOrder="stroke">{name}</text>
    </g>
  )
}

function PerpendicularTape({ from, a, b, label, side }: { from: Pt; a: Pt; b: Pt; label: string; side: number }) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const t = ((from.x - a.x) * dx + (from.y - a.y) * dy) / (dx * dx + dy * dy)
  const foot = { x: a.x + t * dx, y: a.y + t * dy }
  const p = screen(from)
  const q = screen(foot)
  const vx = q.x - p.x
  const vy = q.y - p.y
  const long = Math.hypot(vx, vy) || 1
  const ux = vx / long
  const uy = vy / long
  const tick = 4
  return <g aria-hidden="true"><line x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={FAINT} strokeWidth={1.25} strokeDasharray="3 3" /><path d={`M${q.x - uy * tick} ${q.y + ux * tick} l${-ux * tick} ${-uy * tick} l${uy * tick} ${-ux * tick}`} fill="none" stroke={FAINT} strokeWidth={1.2} /><text x={(p.x + q.x) / 2 + side * 10} y={(p.y + q.y) / 2 + 4} textAnchor="middle" fontFamily="system-ui, sans-serif" fontSize={12} fontWeight={800} fill={SOFT} stroke={PAPER} strokeWidth={4} paintOrder="stroke">{label}</text></g>
}

function Tape({ from, to, label, bend = 0 }: { from: Pt; to: Pt; label: string; bend?: number }) {
  const a = screen(from)
  const b = screen(to)
  const dx = b.x - a.x
  const dy = b.y - a.y
  const long = Math.hypot(dx, dy) || 1
  const nx = -dy / long
  const ny = dx / long
  const mx = (a.x + b.x) / 2 + nx * bend
  const my = (a.y + b.y) / 2 + ny * bend
  return (
    <g aria-hidden="true">
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={FAINT} strokeWidth={1.25} strokeDasharray="3 3" />
      <text x={mx} y={my + 4} textAnchor="middle" fontFamily="system-ui, sans-serif" fontSize={12} fontWeight={800} fill={SOFT} stroke={PAPER} strokeWidth={4} paintOrder="stroke">{label}</text>
    </g>
  )
}

/** A small hexagonal cedar pencil: painted facets, exposed wood and a graphite point. */
function Pencil({ at, drawing }: { at: Pt; drawing: boolean }) {
  const p = screen(at)
  return (
    <g transform={`translate(${p.x} ${p.y})`} fill={SOFT} style={{ fill: SOFT }}>
    <g transform="rotate(-32)" aria-hidden="true" data-pencil="1">
      <path d="M0 0 L-8 -19 L0 -25 L8 -19 Z" fill={WOOD} stroke={PENCIL_EDGE} strokeWidth={1.2} strokeLinejoin="round" />
      <path d="M0 0 L-3.2 -7.5 L3.2 -7.5 Z" fill={GRAPHITE} />
      <path d="M-8 -19 L-8 -78 L0 -83 L8 -78 L8 -19 L0 -25 Z" fill={PENCIL} stroke={PENCIL_EDGE} strokeWidth={1.3} strokeLinejoin="round" />
      <path d="M-8 -19 L0 -25 L0 -83 L-8 -78 Z" fill="#D99C36" />
      <path d="M0 -25 L8 -19 L8 -78 L0 -83 Z" fill="#F2C763" />
      <path d="M-8 -78 L0 -83 L8 -78 L8 -68 L0 -73 L-8 -68 Z" fill="#C98982" stroke={PENCIL_EDGE} strokeWidth={1} />
      <path d="M-8 -68 L0 -73 L8 -68" fill="none" stroke={STEEL_EDGE} strokeWidth={4} />
      {drawing && <circle r={2.7} fill={BLUE} />}
    </g>
    </g>
  )
}

function PencilHit({ at, locked, onDown, onKey, label }: { at: Pt; locked: boolean; onDown(e: PointerEvent<SVGGElement>): void; onKey(e: KeyboardEvent<SVGGElement>): void; label: string }) {
  const p = screen(at)
  return (
    <g
      transform={`translate(${p.x} ${p.y})`} role="slider" tabIndex={locked ? -1 : 0} aria-label={label}
      aria-valuetext={`Pencil at ${at.x.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')} centimetres across and ${at.y.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')} centimetres down`}
      aria-valuemin={0} aria-valuemax={23} aria-valuenow={Math.round(at.x * 4) / 4}
      className="nodrag touch-none outline-none focus-visible:outline-none" onPointerDown={onDown} onKeyDown={onKey} data-handle="pencil"
      style={{ cursor: locked ? 'default' : 'grab' }}
    >
      <circle r={25} fill="transparent" />
      <rect x={-24} y={-86} width={48} height={91} fill="transparent" />
      <circle r={20} fill="transparent" stroke="transparent" strokeWidth={2} className="focus-visible:stroke-[color:var(--subject)]" />
    </g>
  )
}

const buttonClass = 'nodrag flex h-7 min-w-7 shrink-0 select-none items-center justify-center whitespace-nowrap rounded-lg border-2 border-ss-line bg-ss-panel px-1.5 text-[13px] font-extrabold leading-none text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'

function TraceView({ config, state, setState, marked, locked }: Props & { config: Extract<LociConfig, { task: 'trace' }> }) {
  const now = marked === 'shown' ? lociConstructionsEngine.solve(config) : state
  const pencil = readPencil(config, now)
  const ink = readInk(now)
  const goodInk = ink.filter((p) => onLocus(config, p))
  const [m1, m2] = measurements(config, pencil)
  const valid = conditionError(config, pencil) <= TRACE_TOLERANCE_PX / UNIT
  const coverage = traceCoverage(config, goodInk)
  const live = useRef({ config, state: now, pencil, ink, locked })
  live.current = { config, state: now, pencil, ink, locked }
  const id = useId()

  const put = (raw: Pt) => {
    const l = live.current
    if (l.locked) return
    const p = { x: clean(clamp(raw.x, 1, 23)), y: clean(clamp(raw.y, 1, 17)) }
    const extra = Math.hypot(p.x - l.pencil.x, p.y - l.pencil.y) > 0 ? (() => {
      const n = Math.max(1, Math.ceil(Math.hypot(p.x - l.pencil.x, p.y - l.pencil.y) * UNIT / 3))
      return Array.from({ length: n }, (_, i) => ({ x: l.pencil.x + (p.x - l.pencil.x) * (i + 1) / n, y: l.pencil.y + (p.y - l.pencil.y) * (i + 1) / n })).filter((q) => onLocus(l.config, q))
    })() : []
    const all = [...l.ink, ...extra]
    // A moving pencil keeps the useful recent drawing and never makes the saved state huge.
    const unique: Pt[] = []
    for (const q of all) if (!unique.some((r) => Math.hypot(q.x - r.x, q.y - r.y) < 0.12)) unique.push(q)
    setState({ ...l.state, x: p.x, y: p.y, ink: unique.slice(-600) })
  }
  const down = (e: PointerEvent<SVGGElement>) => {
    if (locked || e.button !== 0) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    const svg = e.currentTarget.ownerSVGElement!
    const move = (ev: globalThis.PointerEvent) => {
      const r = svg.getBoundingClientRect()
      put({ x: ((ev.clientX - r.left) * W / r.width - ORIGIN_X) / UNIT, y: ((ev.clientY - r.top) * H / r.height - ORIGIN_Y) / UNIT })
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }
  const key = (e: KeyboardEvent<SVGGElement>) => {
    const d = ({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] } as Record<string, number[]>)[e.key]
    if (!d) return
    e.preventDefault()
    e.stopPropagation()
    put({ x: pencil.x + d[0] * PENCIL_STEP, y: pencil.y + d[1] * PENCIL_STEP })
  }
  const moveButton = (dx: number, dy: number, name: string) => <button key={name} type="button" aria-label={name} disabled={locked} className={buttonClass} onClick={() => put({ x: pencil.x + dx, y: pencil.y + dy })}>{name.replace('Move pencil ', '') === 'left' ? '←' : name.replace('Move pencil ', '') === 'right' ? '→' : name.replace('Move pencil ', '') === 'up' ? '↑' : '↓'}</button>
  const fixed = config.relation === 'two-points' ? [TRACE_A, TRACE_B] : config.relation === 'point' ? [TRACE_C] : config.relation === 'segment' ? [TRACE_SEG_A, TRACE_SEG_B] : []
  const desc = config.relation === 'two-points'
    ? `Points A and B on squared paper. A pencil is at distances PA ${fmt(m1)} centimetres and PB ${fmt(m2)} centimetres. It leaves blue ink when the distances agree closely.`
    : config.relation === 'point'
      ? `Point C on squared paper. The pencil is ${fmt(m1)} centimetres from C; blue ink appears near ${fmt(config.distance)} centimetres.`
      : config.relation === 'segment'
        ? `Line segment AB on squared paper. The pencil's nearest distance to AB is ${fmt(m1)} centimetres; blue ink appears near ${fmt(config.distance)} centimetres.`
        : `Two intersecting lines with vertex V. The pencil's perpendicular distances to the lines are ${fmt(m1)} and ${fmt(m2)} centimetres. Blue ink appears when they agree closely.`

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-2">
      <figure className="m-0 flex w-full flex-col gap-1.5">
        <div className="relative w-full">
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${id}-title`} className="block h-auto w-full select-none rounded-2xl">
            <title id={`${id}-title`}>{desc}</title>
            <rect x={0.75} y={0.75} width={W - 1.5} height={H - 1.5} rx={16} fill={PAPER} stroke={PAPER_EDGE} strokeWidth={1.5} />
            <defs><clipPath id={`${id}-paper`}><rect x={1} y={1} width={W - 2} height={H - 2} rx={15} /></clipPath></defs>
            <g clipPath={`url(#${id}-paper)`} fill={SOFT} style={{ fill: SOFT }}>
            <PaperGrid />
            {config.relation === 'segment' && <line x1={sx(TRACE_SEG_A)} y1={sy(TRACE_SEG_A)} x2={sx(TRACE_SEG_B)} y2={sy(TRACE_SEG_B)} stroke={INK} strokeWidth={3} strokeLinecap="round" />}
            {config.relation === 'two-lines' && <g stroke={INK} strokeWidth={2.4} strokeLinecap="round"><line x1={sx(TRACE_VERTEX)} y1={sy(TRACE_VERTEX)} x2={sx(TRACE_ARM_1)} y2={sy(TRACE_ARM_1)} /><line x1={sx(TRACE_VERTEX)} y1={sy(TRACE_VERTEX)} x2={sx(TRACE_ARM_2)} y2={sy(TRACE_ARM_2)} /></g>}
            {config.relation === 'two-points' && <line x1={sx(TRACE_A)} y1={sy(TRACE_A)} x2={sx(TRACE_B)} y2={sy(TRACE_B)} stroke={FAINT} strokeWidth={1.4} />}
            {config.relation === 'point' && <Tape from={TRACE_C} to={pencil} label={`PC ${fmt(m1)} cm`} bend={13} />}
            {config.relation === 'segment' && <Tape from={pencil} to={{ x: clamp(pencil.x, TRACE_SEG_A.x, TRACE_SEG_B.x), y: TRACE_SEG_A.y }} label={`${fmt(m1)} cm`} bend={-13} />}
            {config.relation === 'two-points' && <><Tape from={TRACE_A} to={pencil} label={`PA ${fmt(m1)} cm`} bend={12} /><Tape from={TRACE_B} to={pencil} label={`PB ${fmt(m2)} cm`} bend={-12} /></>}
            {config.relation === 'two-lines' && <><PerpendicularTape from={pencil} a={TRACE_VERTEX} b={TRACE_ARM_1} label={`line 1: ${fmt(m1)} cm`} side={-1} /><PerpendicularTape from={pencil} a={TRACE_VERTEX} b={TRACE_ARM_2} label={`line 2: ${fmt(m2)} cm`} side={1} /></>}
            {goodInk.length > 0 && (() => {
        const strokes: Pt[][] = []
        for (const p of goodInk) {
          const last = strokes[strokes.length - 1]
          if (!last || Math.hypot(p.x - last[last.length - 1].x, p.y - last[last.length - 1].y) > 0.35) strokes.push([p])
          else last.push(p)
        }
        return <g data-ink="1">{strokes.map((stroke, i) => stroke.length === 1 ? <circle key={i} cx={sx(stroke[0])} cy={sy(stroke[0])} r={1.8} fill={BLUE} /> : <path key={i} d={pathFrom(stroke)} fill="none" stroke={BLUE} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />)}</g>
      })()}
            {fixed.map((p, i) => <FixedPoint key={`${p.x}-${p.y}`} at={p} name={config.relation === 'point' ? 'C' : i === 0 ? 'A' : 'B'} dy={config.relation === 'point' ? -10 : 18} />)}
            {config.relation === 'two-lines' && <><FixedPoint at={TRACE_VERTEX} name="V" dx={-10} dy={4} /><text x={sx(TRACE_ARM_1) - 3} y={sy(TRACE_ARM_1) + 17} fontSize={12} fontWeight={700} fill={SOFT}>line 1</text><text x={sx(TRACE_ARM_2) + 7} y={sy(TRACE_ARM_2) + 4} fontSize={12} fontWeight={700} fill={SOFT}>line 2</text></>}
            <Pencil at={pencil} drawing={valid} />
            <PencilHit at={pencil} locked={locked} onDown={down} onKey={key} label="Move the pencil over the paper" />
            </g>
          </svg>
        </div>
        <figcaption className="text-center text-[12px] font-bold text-ss-slate">Blue ink stays where the distance condition holds.</figcaption>
      </figure>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-bold text-ss-slate">Ink coverage</span>
        <span className="flex items-center gap-1">{moveButton(-PENCIL_STEP, 0, 'Move pencil left')}{moveButton(0, -PENCIL_STEP, 'Move pencil up')}{moveButton(0, PENCIL_STEP, 'Move pencil down')}{moveButton(PENCIL_STEP, 0, 'Move pencil right')}</span>
        <span className="min-w-[48px] text-right text-[15px] font-extrabold tabular-nums text-ss-ink" aria-label="Ink coverage">{Math.round(coverage * 100)}%</span>
      </div>
      {marked !== 'idle' && <p className="rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2 text-[13px] font-extrabold leading-snug text-ss-ink" aria-live="polite">{markedText(config, now, marked)}</p>}
    </div>
  )
}

function CompassIcon({ at, radius }: { at: Pt; radius: number }) {
  const p = screen(at)
  const spread = clamp(radius * UNIT * 0.2, 13, 27)
  return (
    <g transform={`translate(${p.x} ${p.y})`} aria-hidden="true">
      <circle r={6} fill={STEEL} stroke={STEEL_EDGE} strokeWidth={1.5} />
      <circle r={2} fill={PAPER} stroke={STEEL_EDGE} strokeWidth={1} />
      <path d={`M-3 5 L${-spread} 57 M3 5 L${spread * 0.68} 57`} fill="none" stroke={STEEL_EDGE} strokeWidth={6} strokeLinecap="round" />
      <path d={`M-3 5 L${-spread} 57 M3 5 L${spread * 0.68} 57`} fill="none" stroke={STEEL} strokeWidth={3.2} strokeLinecap="round" />
      <path d={`M${-spread - 2} 55 L${-spread + 1} 64 L${-spread + 4} 56`} fill={GRAPHITE} />
      <path d={`M${spread * 0.68 - 2} 55 L${spread * 0.68} 64 L${spread * 0.68 + 3} 55`} fill={PENCIL} stroke={PENCIL_EDGE} strokeWidth={1} />
      <path d={`M${-spread * 0.7} 31 Q0 39 ${spread * 0.5} 31`} fill="none" stroke={STEEL_EDGE} strokeWidth={2.2} />
    </g>
  )
}

function RadiusControl({ selected, radius, setRadius, place, locked, centreName }: { selected: string; radius: number; setRadius(n: number): void; place(): void; locked: boolean; centreName: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
      <span className="text-[12px] font-bold text-ss-slate">Compass {centreName}</span>
      <span className="flex items-center gap-1">
        <button type="button" aria-label="Make compass radius smaller" className={buttonClass} disabled={locked || radius <= 1} onClick={() => setRadius(radius - RADIUS_STEP)}>−</button>
        <span className="min-w-[48px] text-center text-[15px] font-extrabold tabular-nums text-ss-ink">{fmt(radius)} cm</span>
        <button type="button" aria-label="Make compass radius larger" className={buttonClass} disabled={locked || radius >= 10} onClick={() => setRadius(radius + RADIUS_STEP)}>+</button>
        <button type="button" aria-label={`Place arc from ${selected}`} className={buttonClass} disabled={locked} onClick={place}>Place arc</button>
      </span>
    </div>
  )
}

function CompassView({ config, state, setState, marked, locked }: Props & { config: Extract<LociConfig, { task: 'compass' }> }) {
  const g = compassGeometry(config)
  const now = marked === 'shown' ? lociConstructionsEngine.solve(config) : state
  const arcs = readArcs(now)
  const chosen = readCompassPoint(now)
  const last = arcs[arcs.length - 1]
  const selected = typeof now.selected === 'string' && ['A', 'B', 'C', 'D'].includes(now.selected) ? now.selected : last?.centre ?? 'A'
  const radius = typeof now.radius === 'number' && Number.isFinite(now.radius) ? clamp(Math.round(now.radius * 2) / 2, 1, 10) : last?.radius ?? (config.kind === 'perpendicular' ? 8 : config.kind === 'angle' ? 4 : 7)
  const centre = arcCentre(selected)
  const svgRef = useRef<SVGSVGElement>(null)

  const setArc = (arc: ArcState) => {
    if (locked) return
    const rest = arcs.filter((a) => a.centre !== arc.centre)
    setState({ ...now, selected: arc.centre, radius: arc.radius, arcs: [...rest, arc], point: undefined })
  }
  const selectCentre = (id: string) => {
    if (locked) return
    const existing = arcs.find((a) => a.centre === id)
    setState({ ...now, selected: id, radius: existing?.radius ?? radius })
  }
  const place = () => setArc({ centre: selected, radius })
  const setRadius = (n: number) => {
    const r = clamp(Math.round(n * 2) / 2, 1, 10)
    setState({ ...now, selected, radius: r, point: undefined })
  }

  const pairs: { at: Pt; a: string; b: string }[] = []
  for (let i = 0; i < arcs.length; i++) for (let j = i + 1; j < arcs.length; j++) {
    const a = arcs[i]
    const b = arcs[j]
    if (a.centre === b.centre) continue
    for (const at of circleIntersections(arcCentre(a.centre), a.radius, arcCentre(b.centre), b.radius)) {
      if (at.x >= 1 && at.x <= 23 && at.y >= 1 && at.y <= 17 && !pairs.some((q) => Math.hypot(q.at.x - at.x, q.at.y - at.y) < 0.2)) pairs.push({ at, a: a.centre, b: b.centre })
    }
  }
  const points = config.kind === 'angle' ? [COMPASS_VERTEX, COMPASS_ARM_1, COMPASS_ARM_2] : [COMPASS_A, COMPASS_B]
  const names = config.kind === 'angle' ? ['V', 'C', 'D'] : ['A', 'B']
  const pick = (p: Pt) => {
    if (locked) return
    // Only exact computed intersections are offered; marking still uses the mathematical rule.
    setState({ ...now, point: { x: p.x, y: p.y } })
  }
  const baseLine = config.kind === 'triangle' && chosen ? <path d={`M${sx(COMPASS_A)} ${sy(COMPASS_A)} L${sx(chosen)} ${sy(chosen)} L${sx(COMPASS_B)} ${sy(COMPASS_B)}`} fill="none" stroke={BLUE} strokeWidth={2.8} strokeLinejoin="round" /> : null
  const bisector = config.kind !== 'triangle' && chosen ? <line x1={config.kind === 'angle' ? sx(COMPASS_VERTEX) : sx(chosen)} y1={config.kind === 'angle' ? sy(COMPASS_VERTEX) : 35} x2={config.kind === 'angle' ? sx(chosen) : sx(chosen)} y2={config.kind === 'angle' ? sy(chosen) : 248} stroke={BLUE} strokeWidth={2.5} /> : null
  const centreButtons = config.kind === 'angle' ? ['C', 'D'] : ['A', 'B']

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-2">
      <figure className="m-0 flex w-full flex-col gap-1.5">
        <div className="relative w-full">
          <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Drawing paper with fixed ${names.join(', ')} points, ${arcs.length} compass arcs, and ${pairs.length} available crossings.`} className="block h-auto w-full select-none rounded-2xl">
            <rect x={0.75} y={0.75} width={W - 1.5} height={H - 1.5} rx={16} fill={PAPER} stroke={PAPER_EDGE} strokeWidth={1.5} />
            <defs><clipPath id="compass-paper"><rect x={1} y={1} width={W - 2} height={H - 2} rx={15} /></clipPath></defs>
            <g clipPath="url(#compass-paper)" fill={SOFT} style={{ fill: SOFT }}>
            <PaperGrid />
            {config.kind === 'angle' ? <g stroke={INK} strokeWidth={2.5} strokeLinecap="round"><line x1={sx(COMPASS_VERTEX)} y1={sy(COMPASS_VERTEX)} x2={sx(COMPASS_ARM_1)} y2={sy(COMPASS_ARM_1)} /><line x1={sx(COMPASS_VERTEX)} y1={sy(COMPASS_VERTEX)} x2={sx(COMPASS_ARM_2)} y2={sy(COMPASS_ARM_2)} /></g> : <line x1={sx(COMPASS_A)} y1={sy(COMPASS_A)} x2={sx(COMPASS_B)} y2={sy(COMPASS_B)} stroke={INK} strokeWidth={2.8} strokeLinecap="round" />}
            {config.kind === 'angle' && <path d={`M${sx(COMPASS_VERTEX) + 12 * UNIT} ${sy(COMPASS_VERTEX)} A${12 * UNIT} ${12 * UNIT} 0 0 1 ${sx(COMPASS_ARM_1)} ${sy(COMPASS_ARM_1)} M${sx(COMPASS_VERTEX) + 12 * UNIT} ${sy(COMPASS_VERTEX)} A${12 * UNIT} ${12 * UNIT} 0 0 0 ${sx(COMPASS_ARM_2)} ${sy(COMPASS_ARM_2)}`} fill="none" stroke={ARC} strokeWidth={1.8} />}
            {arcs.map((a) => <circle key={a.centre} cx={sx(arcCentre(a.centre))} cy={sy(arcCentre(a.centre))} r={a.radius * UNIT} fill="none" stroke={ARC} strokeWidth={1.8} data-arc={a.centre} />)}
            {baseLine}{bisector}
            {pairs.map((q, i) => <g key={`${q.at.x}-${q.at.y}`} data-crossing={i}><circle cx={sx(q.at)} cy={sy(q.at)} r={8} fill={PAPER} stroke={BLUE} strokeWidth={1.8} /><path d={`M${sx(q.at) - 3} ${sy(q.at)} H${sx(q.at) + 3} M${sx(q.at)} ${sy(q.at) - 3} V${sy(q.at) + 3}`} stroke={BLUE} strokeWidth={1.6} strokeLinecap="round" /></g>)}
            {points.map((p, i) => <FixedPoint key={names[i]} at={p} name={names[i]} dy={i === 0 && config.kind === 'angle' ? -10 : 18} />)}
            {config.kind === 'triangle' && <><text x={(sx(COMPASS_A) + sx(COMPASS_B)) / 2} y={sy(COMPASS_A) + 20} textAnchor="middle" fontSize={12} fontWeight={700} fill={SOFT} stroke={PAPER} strokeWidth={3} paintOrder="stroke">12 cm</text><text x={32} y={48} fontSize={12} fontWeight={700} fill={SOFT}>AC {fmt(g.a)} cm</text><text x={32} y={65} fontSize={12} fontWeight={700} fill={SOFT}>BC {fmt(g.b)} cm</text></>}
            {chosen && <circle cx={sx(chosen)} cy={sy(chosen)} r={4} fill={BLUE} />}
            <CompassIcon at={centre} radius={radius} />
            </g>
          </svg>
          {/* Real HTML controls, positioned over the paper: keyboard and touch use the same targets. */}
          {centreButtons.map((id) => {
            const p = screen(arcCentre(id))
            return <button key={id} type="button" aria-label={`Select compass centre ${id}`} disabled={locked} onClick={() => selectCentre(id)} className="nodrag absolute h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--subject)]" style={{ left: `${p.x / W * 100}%`, top: `${p.y / H * 100}%` }} />
          })}
          {pairs.map((q, i) => <button key={`pick-${i}`} type="button" aria-label={`Choose crossing ${i + 1}`} disabled={locked} onClick={() => pick(q.at)} className="nodrag absolute h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--subject)]" style={{ left: `${sx(q.at) / W * 100}%`, top: `${sy(q.at) / H * 100}%` }} />)}
        </div>
        <figcaption className="text-center text-[12px] font-bold text-ss-slate">Tap a point, set the radius, place an arc; then tap a crossing.</figcaption>
      </figure>
      <RadiusControl selected={selected} centreName={selected} radius={radius} setRadius={setRadius} place={place} locked={locked} />
      {marked !== 'idle' && <p className="rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2 text-[13px] font-extrabold leading-snug text-ss-ink" aria-live="polite">{markedText(config, now, marked)}</p>}
    </div>
  )
}

export function LociConstructionsView(props: Props) {
  return props.config.task === 'trace' ? <TraceView {...props} config={props.config} /> : <CompassView {...props} config={props.config} />
}
