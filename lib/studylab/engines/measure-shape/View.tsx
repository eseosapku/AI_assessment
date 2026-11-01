'use client'
import { useId, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import type { SceneMarked, SceneViewProps } from '../types'
import type {
  CompareTask, Design, Instrument, MakeTask, MeasureShapeConfig, MeasureShapeState, ScaleTask, Shape, Tick,
} from './config'
import {
  GRID_COLS, GRID_ROWS, MINI, INSTRUMENT_NAMES, areaText, comparePair, compareSaid, divisionsOf, fmtTenths, makeSaid,
  perimeterText, positionWords, readCells, readGridUnit, readScaleState, resolveScale, runsText, scaleSaid, scaleWords, READING_MAX,
  snapLevel, ticksOf,
} from './config'

// The scene's own drawing: instruments and graph paper sit on a pale plate in both
// themes, like a diagram in a book, so every meaningful part is over 3:1 on it.
// UI around the drawing uses the design tokens.
const PLATE = '#F8FAFC'
const PLATE_EDGE = '#CBD5E1'
const INK = '#16202A'
const SOFT = '#475569'
const GLASS = '#E3EDF5'
const WATER = '#3F8FD8'
const WATER_EDGE = '#123F73'
const RED = '#C81E1E'
const STRIP = '#C2571A'
const STRIP_EDGE = '#7A3608'
const RULER = '#F5E6B4'
const CASING = '#E2E8F0'
const SLOT = '#CBD5E1'
const HANDLE = '#1D4ED8'
const SHADE = '#3B82D6'
const OUTLINE = '#0B1D33'
const LINES = '#AEBBC8'

// ---------------------------------------------------------------------------
// Where everything sits on a scale: pure, so the tests can hold it to the bar
// (inside its box, labels apart, each label nearest its own mark).

export type LayoutTick = { t: number; kind: Tick['kind']; x1: number; y1: number; x2: number; y2: number }
/** `x`, `y` are the text anchor; (cx, cy, w, h) is the box the text fills. */
export type LayoutLabel = { t: number; text: string; x: number; y: number; anchor: 'start' | 'middle'; cx: number; cy: number; w: number; h: number }
export type ScaleLayout = {
  shape: 'vertical' | 'ruler' | 'dial'
  w: number
  h: number
  ticks: LayoutTick[]
  labels: LayoutLabel[]
  /** The point on the scale that a value is at. */
  at(t: number): { x: number; y: number }
  /** The (unsnapped) value a point in the drawing is nearest. */
  fromPoint(x: number, y: number): number
  /** A ruler whose strip starts at the 0 mark; false for a section of ruler cut away from zero. */
  fromZero: boolean
}

const TICK_LEN = { major: 20, mid: 14, minor: 9 } as const
const DIAL_TICK = { major: 18, mid: 13, minor: 8 } as const
const LABEL_H = 13
const textW = (s: string) => Math.max(9, s.length * 7.8)

/**
 * Vertical scales are drawn 300 px long, so the engine's fiftieth division is still 6 px from
 * its neighbour: enough to see, to count and to land a finger on. No design has more than
 * MAX_DIVISIONS (the tests hold every one to it, for every instrument).
 */
export const MIN_GAP = 6
export const VERT = {
  w: 220,
  cylinder: { top: 46, bottom: 346, x: 106, h: 380 },
  thermometer: { top: 40, bottom: 340, x: 84, h: 396 },
  balance: { top: 52, bottom: 352, x: 102, h: 422 },
} as const
export const RULER_BOX = { w: 340, h: 150, x0: 14, x1: 326, y: 78 } as const
export const DIAL = { w: 230, h: 230, cx: 115, cy: 112, out: 94, label: 57, needle: 84, face: 104 } as const

/** Degrees clockwise from twelve o'clock for a fraction of the scale: 270 degrees, the gap at the bottom. */
export const dialAngle = (frac: number): number => -135 + 270 * frac

export function layoutScale(inst: Instrument, g: Design): ScaleLayout {
  const span = g.max - g.min
  const frac = (t: number) => (t - g.min) / span
  const marks = ticksOf(g)
  const label = (t: number, x: number, y: number, anchor: 'start' | 'middle'): LayoutLabel => {
    const text = fmtTenths(t)
    const w = textW(text)
    return { t, text, x, y: y + 5, anchor, cx: anchor === 'start' ? x + w / 2 : x, cy: y, w, h: LABEL_H }
  }

  if (inst === 'ruler') {
    const { x0, x1, y, w, h } = RULER_BOX
    const xOf = (t: number) => x0 + frac(t) * (x1 - x0)
    return {
      shape: 'ruler', w, h, fromZero: g.min === 0,
      ticks: marks.map((m) => ({ t: m.t, kind: m.kind, x1: xOf(m.t), y1: y, x2: xOf(m.t), y2: y + TICK_LEN[m.kind] })),
      labels: marks.filter((m) => m.kind === 'major').map((m) => label(m.t, xOf(m.t), y + 20 + 11, 'middle')),
      at: (t) => ({ x: xOf(t), y }),
      fromPoint: (px) => g.min + ((px - x0) / (x1 - x0)) * span,
    }
  }

  if (inst === 'scales') {
    const { cx, cy, out, label: lr, w, h } = DIAL
    const pt = (t: number, r: number) => {
      const a = (dialAngle(frac(t)) * Math.PI) / 180
      return { x: cx + r * Math.sin(a), y: cy - r * Math.cos(a) }
    }
    return {
      shape: 'dial', w, h, fromZero: true,
      ticks: marks.map((m) => {
        const a = pt(m.t, out)
        const b = pt(m.t, out - DIAL_TICK[m.kind])
        return { t: m.t, kind: m.kind, x1: a.x, y1: a.y, x2: b.x, y2: b.y }
      }),
      labels: marks.filter((m) => m.kind === 'major').map((m) => {
        const p = pt(m.t, lr)
        return label(m.t, p.x, p.y, 'middle')
      }),
      at: (t) => pt(t, DIAL.needle),
      fromPoint: (px, py) => {
        const a = (Math.atan2(px - cx, -(py - cy)) * 180) / Math.PI
        const f = a < -135 ? 0 : a > 135 ? 1 : (a + 135) / 270
        return g.min + f * span
      },
    }
  }

  const v = VERT[inst]
  // A balance counts down from the top: zero at the top, the load pulling the pointer down.
  const yOf = (t: number) => (inst === 'balance' ? v.top + frac(t) * (v.bottom - v.top) : v.bottom - frac(t) * (v.bottom - v.top))
  return {
    shape: 'vertical', w: VERT.w, h: v.h, fromZero: true,
    ticks: marks.map((m) => ({ t: m.t, kind: m.kind, x1: v.x, y1: yOf(m.t), x2: v.x + TICK_LEN[m.kind], y2: yOf(m.t) })),
    labels: marks.filter((m) => m.kind === 'major').map((m) => label(m.t, v.x + 24, yOf(m.t), 'start')),
    at: (t) => ({ x: v.x, y: yOf(t) }),
    fromPoint: (_px, py) => {
      const f = (inst === 'balance' ? py - v.top : v.bottom - py) / (v.bottom - v.top)
      return g.min + f * span
    },
  }
}

// ---------------------------------------------------------------------------
// The squared grid.

export type Edge = { x1: number; y1: number; x2: number; y2: number }

/**
 * The outline of a shape, one segment per unit side where a shaded square meets an unshaded
 * square or the edge of the grid. Each is drawn a little short at both ends, so the outline
 * reads as dashes that can be counted. There are exactly as many as the perimeter.
 */
export function outlineEdges(cells: readonly number[], cols: number, rows: number, cell: number, pad: number, inset: number): Edge[] {
  const set = new Set(cells)
  const out: Edge[] = []
  for (const i of set) {
    const r = Math.floor(i / cols)
    const c = i % cols
    const x = pad + c * cell
    const y = pad + r * cell
    if (!(r > 0 && set.has(i - cols))) out.push({ x1: x + inset, y1: y, x2: x + cell - inset, y2: y })
    if (!(r < rows - 1 && set.has(i + cols))) out.push({ x1: x + inset, y1: y + cell, x2: x + cell - inset, y2: y + cell })
    if (!(c > 0 && set.has(i - 1))) out.push({ x1: x, y1: y + inset, x2: x, y2: y + cell - inset })
    if (!(c < cols - 1 && set.has(i + 1))) out.push({ x1: x + cell, y1: y + inset, x2: x + cell, y2: y + cell - inset })
  }
  return out
}

export const MAKE_LOOK = { cell: 26, pad: 9 } as const
export const MINI_LOOK = { cell: 16, pad: 8 } as const
const sizeOf = (cols: number, rows: number, look: { cell: number; pad: number }) => ({ w: cols * look.cell + 2 * look.pad, h: rows * look.cell + 2 * look.pad })

const BUTTON = 'nodrag inline-flex min-h-[44px] items-center justify-center rounded-xl border-2 border-ss-line bg-ss-panel px-4 py-1.5 text-[14px] font-bold text-ss-ink touch-manipulation hover:border-[color:var(--subject)] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:opacity-50'
/** A chosen option, set inline: as classes, the base's border-ss-line won and a pick looked like no pick. */
const CHOSEN = { borderColor: 'var(--subject)', background: 'color-mix(in srgb, var(--subject) 14%, transparent)' }

/** The board moves a selected card with the arrows; inside the scene they belong to the scene. */
const keepArrows = (e: KeyboardEvent) => {
  if (e.key.startsWith('Arrow')) e.stopPropagation()
}

function Said({ lines }: { lines: string[] }) {
  if (!lines.length) return null
  return (
    <div aria-live="polite" className="flex w-full flex-col items-center gap-0.5 text-center">
      {lines.map((line, i) => (
        <p key={i} className={i === 0 ? 'text-[15px] font-extrabold leading-snug text-ss-ink' : 'text-[13px] font-semibold leading-snug text-ss-slate'}>
          {line}
        </p>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Reading scales.

/** What the level is called in a sentence about the picture. */
const THING: Record<Instrument, string> = {
  ruler: 'The strip ends', cylinder: 'The bottom of the curved water surface is', thermometer: 'The red liquid reaches',
  balance: 'The pointer is', scales: 'The needle points',
}
/** What a learner moves in a set task. */
const HANDLE_NAME: Record<Instrument, string> = {
  ruler: 'end of the strip', cylinder: 'water level', thermometer: 'top of the liquid', balance: 'pointer', scales: 'needle',
}

function Ticks({ layout }: { layout: ScaleLayout }) {
  return (
    <g stroke={INK} strokeLinecap="butt">
      {layout.ticks.map((t) => (
        <line key={t.t} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} strokeWidth={t.kind === 'major' ? 1.8 : t.kind === 'mid' ? 1.3 : 1} />
      ))}
    </g>
  )
}

function Labels({ layout }: { layout: ScaleLayout }) {
  return (
    <g fill={INK} fontSize={13} fontWeight={700} fontFamily="system-ui, sans-serif">
      {layout.labels.map((l) => (
        <text key={l.t} x={l.x} y={l.y} textAnchor={l.anchor}>{l.text}</text>
      ))}
    </g>
  )
}

/** The unit, set above the numbers where a vertical scale starts, or on the ruler's body, or on the dial's face. */
function UnitMark({ inst, unit }: { inst: Instrument; unit: string }) {
  const common = { fill: SOFT, fontSize: 13, fontWeight: 700, fontFamily: 'system-ui, sans-serif' } as const
  if (inst === 'ruler') return <text x={RULER_BOX.w / 2} y={RULER_BOX.y + 54} textAnchor="middle" {...common}>{unit}</text>
  if (inst === 'scales') return <text x={DIAL.cx} y={DIAL.cy + 66} textAnchor="middle" {...common}>{unit}</text>
  return <text x={VERT[inst].x + 24} y={VERT[inst].top - 20} {...common}>{unit}</text>
}

/** The instrument itself, with its level at `t`. */
function Body({ inst, layout, t }: { inst: Instrument; layout: ScaleLayout; t: number }) {
  const at = layout.at(t)
  if (inst === 'cylinder') {
    const y = at.y
    const rim = VERT.cylinder.top - 16
    const floor = VERT.cylinder.bottom + 14
    const curve = `M 51 ${y - 7} C 61 ${y + 1} 70 ${y} 78 ${y} C 86 ${y} 95 ${y + 1} 105 ${y - 7}`
    const glass = `M 50 ${rim} V ${floor - 10} Q 50 ${floor} 60 ${floor} H 96 Q 106 ${floor} 106 ${floor - 10} V ${rim}`
    return (
      <g>
        <path d={`${glass} Z`} fill={GLASS} />
        <path d={`${curve} V ${floor - 10} Q 105 ${floor - 1} 96 ${floor - 1} H 60 Q 51 ${floor - 1} 51 ${floor - 10} Z`} fill={WATER} />
        <path d={curve} fill="none" stroke={WATER_EDGE} strokeWidth={2.6} strokeLinecap="round" />
        <path d={glass} fill="none" stroke={INK} strokeWidth={2.4} />
        <path d={`M 44 ${rim} H 112`} stroke={INK} strokeWidth={2.4} strokeLinecap="round" />
        <rect x={36} y={floor + 2} width={84} height={9} rx={3} fill={SOFT} />
      </g>
    )
  }
  if (inst === 'thermometer') {
    const bulb = VERT.thermometer.bottom + 28
    return (
      <g>
        <rect x={70} y={VERT.thermometer.top - 6} width={14} height={bulb + 2 - (VERT.thermometer.top - 6)} rx={7} fill={GLASS} stroke={INK} strokeWidth={2.2} />
        <rect x={74} y={at.y} width={6} height={bulb - at.y} fill={RED} />
        <circle cx={77} cy={bulb} r={17} fill={RED} stroke={INK} strokeWidth={2.2} />
      </g>
    )
  }
  if (inst === 'balance') {
    const { top, bottom } = VERT.balance
    const base = bottom + 18
    return (
      <g>
        <circle cx={80} cy={20} r={9} fill="none" stroke={INK} strokeWidth={3} />
        <line x1={80} y1={29} x2={80} y2={34} stroke={INK} strokeWidth={3} />
        <rect x={58} y={34} width={44} height={base - 34} rx={8} fill={CASING} stroke={INK} strokeWidth={2.4} />
        <rect x={74} y={top - 8} width={12} height={bottom - top + 16} rx={4} fill={SLOT} stroke={SOFT} strokeWidth={1} />
        <rect x={66} y={at.y - 2.5} width={36} height={5} fill={RED} stroke="#FFFFFF" strokeWidth={0.8} />
        <path d={`M 80 ${base} V ${base + 12} Q 80 ${base + 20} 87 ${base + 20}`} fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" />
        <rect x={66} y={base + 20} width={28} height={16} rx={4} fill={SOFT} />
      </g>
    )
  }
  if (inst === 'ruler') {
    const { x0, y } = RULER_BOX
    // From the 0 mark; or, for a section of ruler away from zero, running in from the left edge.
    const start = layout.fromZero ? x0 : 4
    return (
      <g>
        <rect x={4} y={y} width={RULER_BOX.w - 8} height={62} rx={4} fill={RULER} stroke={INK} strokeWidth={1.6} />
        <rect x={start} y={y - 32} width={at.x - start} height={32} fill={STRIP} />
        {layout.fromZero && <line x1={x0} y1={y - 32} x2={x0} y2={y} stroke={STRIP_EDGE} strokeWidth={2.5} />}
        <line x1={at.x} y1={y - 32} x2={at.x} y2={y} stroke={STRIP_EDGE} strokeWidth={2.5} />
      </g>
    )
  }
  const { cx, cy, face } = DIAL
  return (
    <g>
      <circle cx={cx} cy={cy} r={face} fill="#FFFFFF" stroke={INK} strokeWidth={3} />
      <line x1={cx} y1={cy} x2={at.x} y2={at.y} stroke={RED} strokeWidth={3.5} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={9} fill={INK} />
    </g>
  )
}

/** Where a learner takes hold: beside the level, so the level itself stays in view. */
function handlePoint(inst: Instrument, layout: ScaleLayout, t: number): { x: number; y: number; turn: number } {
  const at = layout.at(t)
  if (inst === 'cylinder') return { x: 28, y: at.y, turn: 0 }
  if (inst === 'thermometer') return { x: 50, y: at.y, turn: 0 }
  if (inst === 'balance') return { x: 36, y: at.y, turn: 0 }
  if (inst === 'ruler') return { x: at.x, y: RULER_BOX.y - 52, turn: 90 }
  // The dial's handle sits on the needle near the hub, so it never covers the marks the learner reads.
  const k = 36 / DIAL.needle
  return { x: DIAL.cx + (at.x - DIAL.cx) * k, y: DIAL.cy + (at.y - DIAL.cy) * k, turn: 0 }
}

function HandleMark({ x, y, turn, focused }: { x: number; y: number; turn: number; focused: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${turn})`}>
      <circle r={24} fill="transparent" />
      {focused && <circle r={17} fill="none" stroke="var(--subject)" strokeWidth={3} />}
      <circle r={11} fill={HANDLE} stroke="#FFFFFF" strokeWidth={2} />
      <path d="M -4 -2.5 L 0 -7 L 4 -2.5 Z M -4 2.5 L 0 7 L 4 2.5 Z" fill="#FFFFFF" />
    </g>
  )
}

function ScaleCard({ task, state, setState, marked, locked }: {
  task: ScaleTask; state: MeasureShapeState; setState(next: MeasureShapeState): void; marked: SceneMarked; locked: boolean
}) {
  const id = useId()
  const svg = useRef<SVGSVGElement>(null)
  const [dragging, setDragging] = useState(false)
  const [focused, setFocused] = useState(false)
  const [said, setSaid] = useState('')
  const r = resolveScale(task)
  if (!r) return <p className="text-[13px] font-semibold text-ss-slate">This scale could not be drawn.</p>
  const g = r.design
  const inst = r.instrument
  const set = task.kind === 'set'
  const s = readScaleState(r, state)
  const level = set ? s.level : r.t
  const layout = layoutScale(inst, g)
  const name = INSTRUMENT_NAMES[inst]
  const live = set && !locked
  const where = positionWords(inst, g, level)
  const index = Math.round((level - g.min) / g.minor)

  const commit = (next: number) => {
    if (!live) return
    const to = snapLevel(g, next)
    if (to !== s.level) setState({ level: to })
    return to
  }
  const fromPointer = (e: PointerEvent) => {
    const el = svg.current
    if (!el) return
    const box = el.getBoundingClientRect()
    const p = { x: ((e.clientX - box.left) / box.width) * layout.w, y: ((e.clientY - box.top) / box.height) * layout.h }
    commit(layout.fromPoint(p.x, p.y))
  }
  const onKey = (e: KeyboardEvent) => {
    if (!live) return
    // Up the scale for the arrows; a balance counts down from the top, so its arrows follow the pointer.
    const vertical = inst === 'balance' ? -1 : 1
    const step = ({ ArrowUp: vertical, ArrowDown: -vertical, ArrowRight: 1, ArrowLeft: -1 } as Record<string, number>)[e.key]
    const page = ({ PageUp: 1, PageDown: -1 } as Record<string, number>)[e.key] ?? 0
    if (step === undefined && !page && e.key !== 'Home' && e.key !== 'End') return
    // The board moves a selected card with the arrows; here they move the level.
    e.preventDefault()
    e.stopPropagation()
    const next = e.key === 'Home' ? g.min : e.key === 'End' ? g.max : s.level + (step !== undefined ? step * g.minor : page * g.major * (inst === 'balance' ? -1 : 1))
    const to = commit(next)
    if (to !== undefined) setSaid(`The ${HANDLE_NAME[inst]} is ${positionWords(inst, g, to)}.`)
  }

  const handle = handlePoint(inst, layout, level)
  const picture = (
    <svg
      ref={svg}
      viewBox={`0 0 ${layout.w} ${layout.h}`}
      className={`block w-full select-none ${live ? 'touch-none' : ''} ${live ? (dragging ? 'cursor-grabbing' : 'cursor-pointer') : ''}`}
      style={{ maxWidth: layout.w }}
      role={set ? 'group' : 'img'}
      aria-label={set
        ? `The ${scaleWords(inst, g)}. Move the ${HANDLE_NAME[inst]} to the value asked for.`
        : `The ${scaleWords(inst, g)}. ${THING[inst]} ${where}.`}
      onPointerDown={(e) => {
        if (!live) return
        setDragging(true)
        e.currentTarget.setPointerCapture?.(e.pointerId)
        fromPointer(e)
      }}
      onPointerMove={(e) => dragging && fromPointer(e)}
      onPointerUp={() => {
        if (dragging) setSaid(`The ${HANDLE_NAME[inst]} is ${where}.`)
        setDragging(false)
      }}
      onPointerCancel={() => setDragging(false)}
    >
      <rect width={layout.w} height={layout.h} rx={16} fill={PLATE} stroke={PLATE_EDGE} strokeWidth={1.5} />
      <Body inst={inst} layout={layout} t={level} />
      <Ticks layout={layout} />
      <Labels layout={layout} />
      <UnitMark inst={inst} unit={g.unit} />
      {live && (
        <g
          role="slider"
          tabIndex={0}
          aria-label={`The ${HANDLE_NAME[inst]}. Drag it, or use the arrow keys`}
          aria-orientation={layout.shape === 'ruler' ? 'horizontal' : 'vertical'}
          aria-valuemin={0}
          aria-valuemax={divisionsOf(g)}
          aria-valuenow={index}
          aria-valuetext={where}
          onKeyDown={onKey}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="outline-none focus-visible:outline-none"
        >
          <HandleMark x={handle.x} y={handle.y} turn={handle.turn} focused={focused} />
        </g>
      )}
    </svg>
  )

  const lines = marked !== 'idle' ? scaleSaid(task, state, marked === 'wrong' ? 'wrong' : marked === 'shown' ? 'shown' : 'right') : []

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col items-center gap-2" onKeyDown={keepArrows}>
      <div className="flex w-full flex-wrap items-center justify-center gap-x-4 gap-y-2">
        <figure className="m-0 w-full" style={{ maxWidth: layout.w }}>
          {picture}
          <figcaption className="mt-1 text-center text-[12px] font-bold text-ss-slate">
            {name.charAt(0).toUpperCase() + name.slice(1)}, in {g.unit}
          </figcaption>
        </figure>
        {!set && (
          <div className="flex items-center gap-2">
            <label htmlFor={`${id}-reading`} className="text-[13px] font-bold text-ss-slate">Your reading</label>
            <input
              id={`${id}-reading`}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              maxLength={READING_MAX}
              value={s.reading}
              readOnly={locked}
              onChange={(e) => setState({ reading: e.target.value })}
              onKeyDown={keepArrows}
              aria-label={`Your reading, in ${g.unit}`}
              className="nodrag w-[96px] rounded-lg border-[1.5px] border-ss-line bg-ss-panel px-2 py-1.5 text-[16px] font-bold tabular-nums text-ss-ink"
            />
            <span className="text-[15px] font-bold text-ss-ink">{g.unit}</span>
          </div>
        )}
      </div>
      {set && (
        <div className="flex flex-col items-center gap-1 text-center">
          <p className="rounded-xl border-2 border-ss-line bg-ss-chip px-3 py-1.5 text-[15px] font-extrabold text-ss-ink">
            Set the {HANDLE_NAME[inst]} to <span className="tabular-nums">{fmtTenths(r.t)} {g.unit}</span>
          </p>
          {live && <p className="text-[12px] font-semibold text-ss-slate">Drag it, or click it and use the arrow keys.</p>}
        </div>
      )}
      <p className="sr-only" aria-live="polite">{said}</p>
      <Said lines={lines} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// The squared grid: shading a shape, and reading two shapes.

function GridDrawing({ cells, cols, rows, look, shown, chosen }: {
  cells: readonly number[]; cols: number; rows: number; look: { cell: number; pad: number }; shown?: ReactNode; chosen?: boolean
}) {
  const { cell, pad } = look
  const { w, h } = sizeOf(cols, rows, look)
  const set = new Set(cells)
  const lines: ReactNode[] = []
  for (let c = 0; c <= cols; c++) lines.push(<line key={`v${c}`} x1={pad + c * cell} y1={pad} x2={pad + c * cell} y2={pad + rows * cell} />)
  for (let r = 0; r <= rows; r++) lines.push(<line key={`h${r}`} x1={pad} y1={pad + r * cell} x2={pad + cols * cell} y2={pad + r * cell} />)
  return (
    <>
      <rect width={w} height={h} rx={12} fill={PLATE} stroke={chosen ? 'var(--subject)' : PLATE_EDGE} strokeWidth={chosen ? 5 : 1.5} />
      <rect x={pad} y={pad} width={cols * cell} height={rows * cell} fill="#FFFFFF" />
      {[...set].map((i) => (
        <rect key={i} x={pad + (i % cols) * cell} y={pad + Math.floor(i / cols) * cell} width={cell} height={cell} fill={SHADE} />
      ))}
      <g stroke={LINES} strokeWidth={1}>{lines}</g>
      <g stroke={OUTLINE} strokeWidth={3.5} strokeLinecap="butt">
        {outlineEdges(cells, cols, rows, cell, pad, Math.max(2, Math.round(cell / 10))).map((e, k) => (
          <line key={k} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} />
        ))}
      </g>
      {shown}
    </>
  )
}

function MakeCard({ task, state, setState, marked, locked }: {
  task: MakeTask; state: MeasureShapeState; setState(next: MeasureShapeState): void; marked: SceneMarked; locked: boolean
}) {
  const id = useId()
  const svg = useRef<SVGSVGElement>(null)
  const paint = useRef<{ on: boolean; last: number; cells: Set<number> } | null>(null)
  const [cursor, setCursor] = useState(0)
  const [focused, setFocused] = useState(false)
  const [said, setSaid] = useState('')
  const unit = readGridUnit(task.unit) ?? 'units'
  const cells = readCells(state)
  const look = MAKE_LOOK
  const { w, h } = sizeOf(GRID_COLS, GRID_ROWS, look)
  const live = !locked
  const at = (i: number) => `row ${Math.floor(i / GRID_COLS) + 1}, column ${(i % GRID_COLS) + 1}`

  const write = (next: Set<number>) => setState({ cells: [...next].sort((a, b) => a - b) })
  const cellAt = (e: PointerEvent): number | null => {
    const el = svg.current
    if (!el) return null
    const box = el.getBoundingClientRect()
    const x = ((e.clientX - box.left) / box.width) * w
    const y = ((e.clientY - box.top) / box.height) * h
    const c = Math.floor((x - look.pad) / look.cell)
    const r = Math.floor((y - look.pad) / look.cell)
    return r < 0 || c < 0 || r >= GRID_ROWS || c >= GRID_COLS ? null : r * GRID_COLS + c
  }
  const touch = (i: number) => {
    const p = paint.current
    if (!p || p.last === i) return
    p.last = i
    if (p.on) p.cells.add(i)
    else p.cells.delete(i)
    write(p.cells)
  }
  const toggle = (i: number) => {
    const next = new Set(cells)
    const on = !next.has(i)
    if (on) next.add(i)
    else next.delete(i)
    write(next)
    setSaid(`${on ? 'Shaded' : 'Cleared'} ${at(i)}.`)
  }
  const onKey = (e: KeyboardEvent) => {
    if (!live) return
    const r = Math.floor(cursor / GRID_COLS)
    const c = cursor % GRID_COLS
    const move = ({
      ArrowRight: [0, 1], ArrowLeft: [0, -1], ArrowDown: [1, 0], ArrowUp: [-1, 0],
      Home: [0, -c], End: [0, GRID_COLS - 1 - c], PageUp: [-r, 0], PageDown: [GRID_ROWS - 1 - r, 0],
    } as Record<string, [number, number]>)[e.key]
    if (move) {
      e.preventDefault()
      e.stopPropagation()
      const nr = Math.max(0, Math.min(GRID_ROWS - 1, r + move[0]))
      const nc = Math.max(0, Math.min(GRID_COLS - 1, c + move[1]))
      setCursor(nr * GRID_COLS + nc)
      return
    }
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      toggle(cursor)
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && cells.includes(cursor)) {
      e.preventDefault()
      e.stopPropagation()
      toggle(cursor)
    }
  }

  const grid = (
    <svg
      ref={svg}
      viewBox={`0 0 ${w} ${h}`}
      className={`block w-full select-none ${live ? 'touch-none cursor-pointer' : ''}`}
      style={{ maxWidth: w }}
      role="grid"
      tabIndex={live ? 0 : -1}
      aria-label={`Squared grid, ${GRID_COLS} columns by ${GRID_ROWS} rows. Arrow keys move, space shades or clears a square.`}
      aria-activedescendant={live && focused ? `${id}-c${cursor}` : undefined}
      aria-readonly={!live || undefined}
      onKeyDown={onKey}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onPointerDown={(e) => {
        if (!live) return
        const i = cellAt(e)
        if (i === null) return
        e.currentTarget.setPointerCapture?.(e.pointerId)
        const next = new Set(cells)
        const on = !next.has(i)
        paint.current = { on, last: -1, cells: next }
        setCursor(i)
        touch(i)
        setSaid(`${on ? 'Shaded' : 'Cleared'} ${at(i)}.`)
      }}
      onPointerMove={(e) => {
        if (!paint.current) return
        const i = cellAt(e)
        if (i !== null) touch(i)
      }}
      onPointerUp={() => { paint.current = null }}
      onPointerCancel={() => { paint.current = null }}
    >
      <GridDrawing cells={cells} cols={GRID_COLS} rows={GRID_ROWS} look={look} />
      {/* One cell per square, for the keyboard and screen readers; the drawing above is what is seen. */}
      <g>
        {Array.from({ length: GRID_ROWS }, (_, r) => (
          <g key={r} role="row">
            {Array.from({ length: GRID_COLS }, (_, c) => {
              const i = r * GRID_COLS + c
              return (
                <rect
                  key={c}
                  id={`${id}-c${i}`}
                  role="gridcell"
                  aria-label={`${at(i)}, ${cells.includes(i) ? 'shaded' : 'empty'}`}
                  aria-selected={cells.includes(i)}
                  x={look.pad + c * look.cell}
                  y={look.pad + r * look.cell}
                  width={look.cell}
                  height={look.cell}
                  fill="transparent"
                />
              )
            })}
          </g>
        ))}
      </g>
      {live && focused && (
        <rect
          x={look.pad + (cursor % GRID_COLS) * look.cell + 1.5}
          y={look.pad + Math.floor(cursor / GRID_COLS) * look.cell + 1.5}
          width={look.cell - 3}
          height={look.cell - 3}
          fill="none" stroke="var(--subject)" strokeWidth={3} rx={3}
        />
      )}
    </svg>
  )

  const lines = marked !== 'idle' ? makeSaid(task, state, marked === 'wrong' ? 'wrong' : marked === 'shown' ? 'shown' : 'right') : []
  const side = unit === 'units' ? '1 unit' : `1 ${unit}`

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col items-center gap-2" onKeyDown={keepArrows}>
      <ul className="flex flex-wrap justify-center gap-2" aria-label="The shape to make">
        {task.area !== undefined && (
          <li className="rounded-xl border-2 border-ss-line bg-ss-chip px-3 py-1 text-[14px] font-extrabold text-ss-ink">Area: {areaText(task.area, unit)}</li>
        )}
        {task.perimeter !== undefined && (
          <li className="rounded-xl border-2 border-ss-line bg-ss-chip px-3 py-1 text-[14px] font-extrabold text-ss-ink">Perimeter: {perimeterText(task.perimeter, unit)}</li>
        )}
      </ul>
      <figure className="m-0 w-full" style={{ maxWidth: w }}>
        {grid}
        <figcaption className="mt-1 text-center text-[12px] font-semibold text-ss-slate">
          Each square has sides {side} long. {live ? 'Click, tap or drag to shade squares.' : ''}
        </figcaption>
      </figure>
      <p className="sr-only" aria-live="polite">{said}</p>
      {live && (
        <button type="button" className={BUTTON} disabled={!cells.length} onClick={() => { setSaid('Cleared the grid.'); setState({ cells: [] }) }}>
          Clear the grid
        </button>
      )}
      <Said lines={lines} />
    </div>
  )
}

function CompareCard({ task, state, setState, marked, locked }: {
  task: CompareTask; state: MeasureShapeState; setState(next: MeasureShapeState): void; marked: SceneMarked; locked: boolean
}) {
  const id = useId()
  const radios = useRef<Record<string, HTMLButtonElement | null>>({})
  const pair = comparePair(task)
  if (!pair) return <p className="text-[13px] font-semibold text-ss-slate">These shapes could not be drawn.</p>
  const unit = readGridUnit(task.unit) ?? 'units'
  const pick = (state as { pick?: unknown } | null)?.pick === 'a' ? 'a' : (state as { pick?: unknown } | null)?.pick === 'b' ? 'b' : ''
  const named = marked !== 'idle'
  const look = MINI_LOOK
  const { w, h } = sizeOf(MINI, MINI, look)
  const shared = task.same === 'area' ? `an area of ${areaText(task.value, unit)}` : `a perimeter of ${perimeterText(task.value, unit)}`
  const question = `Which shape has the ${task.ask} ${pair.asked}?`
  const lines = named ? compareSaid(task, state, marked === 'wrong' ? 'wrong' : marked === 'shown' ? 'shown' : 'right') : []

  const choose = (side: 'a' | 'b') => {
    if (locked) return
    setState({ pick: side })
  }
  const onKey = (e: KeyboardEvent) => {
    const move = ({ ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 } as Record<string, number>)[e.key]
    if (move === undefined || locked) return
    e.preventDefault()
    e.stopPropagation()
    // With nothing picked yet, forward lands on A and back on B.
    const from = pick ? (pick === 'a' ? 0 : 1) : move > 0 ? -1 : 0
    const next: 'a' | 'b' = (from + move + 2) % 2 === 0 ? 'a' : 'b'
    choose(next)
    radios.current[next]?.focus()
  }

  const shapeCard = (side: 'a' | 'b', shape: Shape) => {
    const letter = side.toUpperCase()
    const chosen = pick === side
    const measure = pair.asked === 'perimeter' ? perimeterText(shape.perimeter, unit) : areaText(shape.area, unit)
    return (
      <figure key={side} className="m-0 flex flex-col items-center gap-1.5">
        <svg
          viewBox={`0 0 ${w} ${h}`}
          className="block w-full"
          style={{ maxWidth: w }}
          role="img"
          id={`${id}-${side}`}
          aria-label={`Shape ${letter} on a squared grid, ${MINI} columns by ${MINI} rows: ${runsText(shape.cells, MINI)}`}
        >
          <GridDrawing cells={shape.cells} cols={MINI} rows={MINI} look={look} chosen={chosen} />
        </svg>
        <figcaption className="text-center text-[13px] font-extrabold text-ss-ink">
          Shape {letter}
          {named && <span className="block text-[12px] font-semibold text-ss-slate">{pair.asked === 'perimeter' ? 'Perimeter' : 'Area'} {measure}</span>}
        </figcaption>
        <button
          type="button"
          role="radio"
          aria-checked={chosen}
          aria-describedby={`${id}-${side}`}
          ref={(el) => { radios.current[side] = el }}
          tabIndex={chosen || (!pick && side === 'a') ? 0 : -1}
          aria-disabled={locked || undefined}
          onClick={() => choose(side)}
          onKeyDown={onKey}
          className={`${BUTTON} w-full`}
          style={chosen ? CHOSEN : undefined}
        >
          {chosen ? `Shape ${letter} picked` : `Pick shape ${letter}`}
        </button>
      </figure>
    )
  }

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col items-center gap-2" onKeyDown={keepArrows}>
      <div className="flex flex-col items-center gap-0.5 text-center">
        <p id={`${id}-q`} className="text-[15px] font-extrabold leading-snug text-ss-ink">{question}</p>
        <p className="text-[13px] font-semibold text-ss-slate">Both shapes have {shared}. Each square has sides {unit === 'units' ? '1 unit' : `1 ${unit}`} long.</p>
      </div>
      <div role="radiogroup" aria-labelledby={`${id}-q`} className="grid w-full grid-cols-2 gap-3">
        {shapeCard('a', pair.a)}
        {shapeCard('b', pair.b)}
      </div>
      <Said lines={lines} />
    </div>
  )
}

// ---------------------------------------------------------------------------

export function MeasureShapeView({ config, state, setState, marked, locked }: SceneViewProps<MeasureShapeConfig, MeasureShapeState>) {
  const task = config.task
  const common = { state: state ?? {}, setState, marked, locked }
  if (task.kind === 'read' || task.kind === 'set') return <ScaleCard task={task} {...common} />
  if (task.kind === 'make') return <MakeCard task={task} {...common} />
  return <CompareCard task={task} {...common} />
}
