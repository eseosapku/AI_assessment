'use client'
import { useId, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import type { SceneMarked, SceneViewProps } from '../types'
import type { BusinessFinanceConfig, BusinessFinanceState, BusinessFinanceTask, Chart, Economics } from './config'
import {
  atOutput, breakEven, chartFor, count, leverRange, leverStart, madeLever, madeMargin, money, needed,
  revealBreakEven, revealContribution, revealLever, revealMargin, totalCosts, totalRevenue, units, withLever,
} from './config'

// The chart's frame, in its own units. config.ts imports this file, so nothing
// of config's is read at module level here: it would not have loaded yet.
const W = 360
const H = 282
/** The plot's top: the marker's handle rides above it, clear of the axis title and the top label. */
const T = 46
const B = H - 42
/** Where the marker's handle sits, above the plot. */
const GRIP = T - 15
/** Room on the right for the lines' names. */
const R = W - 30
/** A digit's width at 12px, near enough, for sizing the axis labels. */
const CHAR = 7

// The scene's own inks, each over 4.5:1 on the panel in both themes: revenue
// blue, total costs orange, fixed costs violet (dashed as well, so the three
// differ by more than colour). The marker takes the lesson colour, as orbit's
// focus ring does. Loss and profit are tints, shown only once it is marked.
const PALETTE =
  '[--bf-rev:#1D4ED8] [--bf-cost:#C2410C] [--bf-fixed:#7C3AED] [--bf-loss:rgba(176,48,60,0.14)] [--bf-profit:rgba(4,120,87,0.14)] ' +
  'dark:[--bf-rev:#60A5FA] dark:[--bf-cost:#FB923C] dark:[--bf-fixed:#C4B5FD] dark:[--bf-loss:rgba(240,138,147,0.2)] dark:[--bf-profit:rgba(63,208,143,0.18)]'
const REV = 'var(--bf-rev, #1D4ED8)'
const COST = 'var(--bf-cost, #C2410C)'
const FIXED = 'var(--bf-fixed, #7C3AED)'
const LOSS = 'var(--bf-loss, rgba(176,48,60,0.14))'
const PROFIT = 'var(--bf-profit, rgba(4,120,87,0.14))'
const MARK = 'var(--subject, #0C6FAE)'
const PANEL = 'var(--ss-panel, #FFFFFF)'
const INK = 'var(--ss-ink, #16202A)'
const SLATE = 'var(--ss-slate, #636D76)'
const GOOD = 'var(--ss-good, #047857)'
const BAD = 'var(--ss-bad, #B0303C)'
/** Text on the chart stays legible over lines: a halo of the panel colour behind it. */
const HALO = { stroke: PANEL, strokeWidth: 3.5, paintOrder: 'stroke', strokeLinejoin: 'round' } as const

type Props = SceneViewProps<BusinessFinanceConfig, BusinessFinanceState>

/** Where outputs and amounts sit on the chart. */
export type Geo = { L: number; chart: Chart; x(q: number): number; y(m: number): number }

export function geometry(chart: Chart): Geo {
  const L = Math.max(34, count(chart.y.max).length * CHAR + 12)
  return { L, chart, x: (q) => L + (q / chart.x.max) * (R - L), y: (m) => B - (m / chart.y.max) * (B - T) }
}

/** The line a + b·q across the output axis, cut where it leaves the top of the chart; null when it starts above it. */
export function segment(g: Geo, a: number, b: number): { x1: number; y1: number; x2: number; y2: number; cut: boolean } | null {
  const max = g.chart.x.max
  const top = g.chart.y.max
  if (a > top) return null
  const cut = a + b * max > top
  const end = cut ? (top - a) / b : max
  return { x1: g.x(0), y1: g.y(a), x2: g.x(end), y2: g.y(a + b * end), cut }
}

/** Which way the two lines lie at an output, as a sighted learner sees them. */
function relation(e: Economics, q: number): string {
  const tc = totalCosts(e, q)
  const tr = totalRevenue(e, q)
  return tc > tr ? 'the total costs line is above the total revenue line' : tr > tc ? 'the total revenue line is above the total costs line' : 'the two lines meet'
}

// ---------------------------------------------------------------------------
// The drawing.

function Grid({ g }: { g: Geo }) {
  const { x: X, y: Y } = g.chart
  const per = (R - g.L) / X.cols
  const wide = count(X.max).length * CHAR + 6
  const every = [1, 2, 4, 5, 10, 20].find((k) => k * per >= wide) ?? 20
  const cols = Array.from({ length: X.cols + 1 }, (_, i) => i)
  const rows = Array.from({ length: Y.rows + 1 }, (_, i) => i)
  return (
    <g aria-hidden="true">
      <rect x={g.L} y={T} width={R - g.L} height={B - T} fill={PANEL} />
      <g stroke={SLATE} strokeOpacity={0.28} strokeWidth={1}>
        {cols.map((i) => <line key={`c${i}`} x1={g.x(i * X.step)} y1={T} x2={g.x(i * X.step)} y2={B} />)}
        {rows.map((j) => <line key={`r${j}`} x1={g.L} y1={g.y(j * Y.step)} x2={R} y2={g.y(j * Y.step)} />)}
      </g>
      <g stroke={INK} strokeWidth={2} strokeLinecap="round">
        <line x1={g.L} y1={B} x2={R} y2={B} />
        <line x1={g.L} y1={B} x2={g.L} y2={T} />
      </g>
      <g fontSize={12} fontWeight={600} fill={SLATE}>
        {cols.filter((i) => i % every === 0).map((i) => (
          <text key={`xl${i}`} data-tick="" x={g.x(i * X.step)} y={B + 16} textAnchor="middle">{count(i * X.step)}</text>
        ))}
        {rows.map((j) => (
          <text key={`yl${j}`} data-tick="" x={g.L - 6} y={g.y(j * Y.step) + 4} textAnchor="end">{count(j * Y.step)}</text>
        ))}
      </g>
      <g fontSize={12} fontWeight={700} fill={INK}>
        <text x={4} y={14}>Costs and revenue ($)</text>
        <text x={(g.L + R) / 2} y={H - 6} textAnchor="middle">Output (units)</text>
      </g>
    </g>
  )
}

/** The three lines, each named at its end: in the margin, or inside the chart where it leaves the top. */
function Lines({ g, e }: { g: Geo; e: Economics }) {
  const lines = [
    { name: 'FC', colour: FIXED, dash: '7 5', seg: segment(g, e.fixedCosts, 0) },
    { name: 'TC', colour: COST, dash: undefined, seg: segment(g, e.fixedCosts, e.variableCost) },
    { name: 'TR', colour: REV, dash: undefined, seg: segment(g, 0, e.price) },
  ]
  // Names in the margin are pushed apart so they never sit on one another.
  const margin = lines.filter((l) => l.seg && !l.seg.cut).map((l) => ({ name: l.name, colour: l.colour, y: l.seg!.y2 + 4 }))
  margin.sort((a, b) => a.y - b.y)
  for (let i = 1; i < margin.length; i++) margin[i].y = Math.max(margin[i].y, margin[i - 1].y + 13)
  const overflow = margin.length ? margin[margin.length - 1].y - (B + 4) : 0
  if (overflow > 0) for (const m of margin) m.y -= overflow
  return (
    <g aria-hidden="true">
      {lines.map((l) => l.seg && (
        <line key={l.name} x1={l.seg.x1} y1={l.seg.y1} x2={l.seg.x2} y2={l.seg.y2} stroke={l.colour} strokeWidth={3} strokeDasharray={l.dash} strokeLinecap="round" />
      ))}
      <g fontSize={12} fontWeight={800} {...HALO}>
        {margin.map((m) => <text key={m.name} x={R + 5} y={m.y} fill={m.colour}>{m.name}</text>)}
        {lines.filter((l) => l.seg?.cut).map((l) => {
          const right = l.seg!.x2 + 26 <= R
          return <text key={l.name} x={right ? l.seg!.x2 + 5 : l.seg!.x2 - 5} y={T + 13} textAnchor={right ? 'start' : 'end'} fill={l.colour}>{l.name}</text>
        })}
      </g>
    </g>
  )
}

/** Where a line meets an output, as a dot on that line; nothing above the chart. */
function Dots({ g, e, q }: { g: Geo; e: Economics; q: number }) {
  const at = [
    { key: 'tc', m: totalCosts(e, q), colour: COST },
    { key: 'tr', m: totalRevenue(e, q), colour: REV },
  ].filter((d) => d.m <= g.chart.y.max)
  return (
    <g aria-hidden="true" pointerEvents="none">
      {at.map((d) => <circle key={d.key} cx={g.x(q)} cy={g.y(d.m)} r={4.5} fill={d.colour} stroke={PANEL} strokeWidth={2} />)}
    </g>
  )
}

/** A box on the chart, in its own units. */
export type Box = { x0: number; x1: number; y0: number; y1: number }
const hits = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1

/** Where a given output's upright and its name sit, so other words keep off them. */
function uprightAt(g: Geo, q: number): { x: number; right: boolean; label: Box; line: Box } {
  const x = g.x(q)
  const right = x + 62 <= R
  const label = right ? { x0: x + 3, x1: x + 62, y0: T + 16, y1: T + 32 } : { x0: x - 62, x1: x - 3, y0: T + 16, y1: T + 32 }
  return { x, right, label, line: { x0: x - 2, x1: x + 2, y0: T, y1: B } }
}

/** A given output (planned or target), drawn as a dashed upright with its name. */
function Upright({ g, q, name }: { g: Geo; q: number; name: string }) {
  const { x, right } = uprightAt(g, q)
  return (
    <g aria-hidden="true">
      <line x1={x} y1={T} x2={x} y2={B} stroke={INK} strokeWidth={2} strokeDasharray="3 4" />
      <text x={right ? x + 5 : x - 5} y={T + 28} textAnchor={right ? 'start' : 'end'} fontSize={12} fontWeight={800} fill={INK} {...HALO}>{name}</text>
    </g>
  )
}

/**
 * Whether a box is inside the plot and clear of the three lines (each money =
 * a + b·q, so over the box's width it spans a range of heights) and of every
 * box to avoid.
 */
export function clearOf(g: Geo, e: Economics, box: Box, avoid: Box[] = []): boolean {
  if (box.x0 < g.L + 2 || box.x1 > R - 2 || box.y0 < T + 2 || box.y1 > B - 2) return false
  if (avoid.some((a) => hits(a, box))) return false
  const toQ = (x: number) => ((x - g.L) / (R - g.L)) * g.chart.x.max
  const [q0, q1] = [toQ(box.x0), toQ(box.x1)]
  const lines: [number, number][] = [[e.fixedCosts, 0], [e.fixedCosts, e.variableCost], [0, e.price]]
  return lines.every(([a, b]) => {
    const [ya, yb] = [g.y(a + b * q0), g.y(a + b * q1)]
    // Half a stroke either side, and a hair of air.
    return Math.max(ya, yb) + 1.75 < box.y0 || Math.min(ya, yb) - 1.75 > box.y1
  })
}

/**
 * Where a word `w` wide fits inside a wedge between two lines (`upper` above,
 * `lower` below, money as a function of output), trying outputs in the order
 * given and, at each, heights from the middle of the wedge outwards. Null when
 * it fits nowhere: the shading and the key still say what it is.
 */
export function wordSpot(g: Geo, e: Economics, w: number, qs: number[], upper: (q: number) => number, lower: (q: number) => number, avoid: Box[] = []): { x: number; y: number } | null {
  for (const q of qs) {
    const x = g.x(q)
    const top = g.y(upper(q))
    const bottom = g.y(lower(q))
    const mid = (top + bottom) / 2
    for (let d = 0; d <= (bottom - top) / 2; d += 2) {
      for (const y of d === 0 ? [mid] : [mid - d, mid + d]) {
        if (y <= top || y >= bottom) continue
        // A capital's height above the baseline (y + 4), and nothing below it: neither word has a descender.
        if (clearOf(g, e, { x0: x - w / 2, x1: x + w / 2, y0: y - 5, y1: y + 4 }, avoid)) return { x, y }
      }
    }
  }
  return null
}

/** Fractions of a span, nearest `centre` first. */
const around = (centre: number) => [0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9].sort((a, b) => Math.abs(a - centre) - Math.abs(b - centre))

/** Once marked: the loss and profit either side of break-even, the point itself named, and any margin of safety. */
function Reveal({ g, e, given }: { g: Geo; e: Economics; given?: { q: number; margin: boolean } }) {
  const be = breakEven(e)
  if (be === null) return null
  const max = g.chart.x.max
  const meet = totalRevenue(e, be)
  const px = g.x(be)
  const py = g.y(meet)
  const tc = (q: number) => totalCosts(e, q)
  const tr = (q: number) => totalRevenue(e, q)
  const named: Box = { x0: px - 84, x1: px - 4, y0: py - 32, y1: py - 1 }
  const upright = given ? uprightAt(g, given.q) : null
  const avoid = [named, ...(upright ? [upright.label, upright.line] : []), { x0: px - 3, x1: px + 3, y0: py, y1: B }]
  const loss = wordSpot(g, e, 34, around(0.4).map((f) => f * be), tc, tr, avoid)
  const profit = wordSpot(g, e, 44, around(0.7).map((f) => be + f * (max - be)), tr, tc, avoid)
  // The margin of safety, bracketed between break-even and the plan: as low as it fits clear of the lines.
  const span = given?.margin && given.q > be ? { x0: px, x1: g.x(given.q) } : null
  let arrowY = B - 12
  if (span) {
    const mid = (span.x0 + span.x1) / 2
    const box = (y: number): Box => ({ x0: Math.min(span.x0, mid - 56), x1: Math.max(span.x1, mid + 56), y0: y - 21, y1: y + 5 })
    for (let y = B - 9; y >= T + 26; y -= 3) {
      if (clearOf(g, e, box(y), [named, ...(upright ? [upright.label] : [])])) {
        arrowY = y
        break
      }
    }
  }
  return (
    <g aria-hidden="true">
      <polygon points={`${g.x(0)},${g.y(e.fixedCosts)} ${px},${py} ${g.x(0)},${g.y(0)}`} fill={LOSS} />
      <polygon points={`${px},${py} ${g.x(max)},${g.y(tr(max))} ${g.x(max)},${g.y(tc(max))}`} fill={PROFIT} />
      <g fontSize={12} fontWeight={800} textAnchor="middle" {...HALO}>
        {loss && <text x={loss.x} y={loss.y + 4} fill={BAD}>Loss</text>}
        {profit && <text x={profit.x} y={profit.y + 4} fill={GOOD}>Profit</text>}
      </g>
      <line x1={px} y1={py} x2={px} y2={B} stroke={INK} strokeWidth={1.5} strokeDasharray="2 3" />
      <circle cx={px} cy={py} r={5.5} fill={INK} stroke={PANEL} strokeWidth={2} />
      <g fontSize={12} fontWeight={800} fill={INK} textAnchor="end" {...HALO}>
        <text x={px - 8} y={py - 20}>Break-even</text>
        <text x={px - 8} y={py - 6}>{units(be)}</text>
      </g>
      {span && (
        <g>
          <path
            d={`M ${span.x0} ${arrowY} H ${span.x1} M ${span.x0 + 6} ${arrowY - 4} L ${span.x0} ${arrowY} L ${span.x0 + 6} ${arrowY + 4} M ${span.x1 - 6} ${arrowY - 4} L ${span.x1} ${arrowY} L ${span.x1 - 6} ${arrowY + 4}`}
            fill="none" stroke={GOOD} strokeWidth={2}
          />
          <text x={(span.x0 + span.x1) / 2} y={arrowY - 8} textAnchor="middle" fontSize={12} fontWeight={800} fill={GOOD} {...HALO}>Margin of safety</text>
        </g>
      )}
    </g>
  )
}

function Swatch({ colour, dash }: { colour: string; dash?: string }) {
  return (
    <svg width={22} height={10} viewBox="0 0 22 10" aria-hidden="true" className="shrink-0">
      <line x1={1} y1={5} x2={21} y2={5} stroke={colour} strokeWidth={3} strokeDasharray={dash} strokeLinecap="round" />
    </svg>
  )
}

function Shade({ fill }: { fill: string }) {
  return (
    <svg width={14} height={12} viewBox="0 0 14 12" aria-hidden="true" className="shrink-0">
      <rect x={0.5} y={0.5} width={13} height={11} rx={2} fill={fill} stroke={SLATE} strokeWidth={1} />
    </svg>
  )
}

/** The chart's key: each line's name and the numbers it is drawn from; once marked, what the shading means. */
function Key({ e, given, named }: { e: Economics; given?: { name: string; q: number }; named: boolean }) {
  const row = 'flex items-center gap-1.5'
  return (
    <ul className="flex max-w-[360px] flex-wrap justify-center gap-x-4 gap-y-1 text-[12px] font-semibold leading-snug text-ss-slate">
      <li className={row}><Swatch colour={REV} /><span><b className="text-ss-ink">TR</b> total revenue: {money(e.price)} per unit</span></li>
      <li className={row}><Swatch colour={COST} /><span><b className="text-ss-ink">TC</b> total costs: {money(e.fixedCosts)} + {money(e.variableCost)} per unit</span></li>
      <li className={row}><Swatch colour={FIXED} dash="5 3" /><span><b className="text-ss-ink">FC</b> fixed costs: {money(e.fixedCosts)}</span></li>
      {given && <li className={row}><Swatch colour={INK} dash="2 3" /><span>{given.name}: {units(given.q)}</span></li>}
      {named && <li className={row}><Shade fill={LOSS} /><span>loss: costs above revenue</span></li>}
      {named && <li className={row}><Shade fill={PROFIT} /><span>profit: revenue above costs</span></li>}
    </ul>
  )
}

function Verdict({ marked, children }: { marked: SceneMarked; children: ReactNode }) {
  if (marked === 'idle') return null
  return <div className="flex max-w-[360px] flex-col gap-1 text-center text-[13px] font-bold leading-snug text-ss-ink">{children}</div>
}

// ---------------------------------------------------------------------------
// The chart with its marker (find-break-even and margin-of-safety), or with
// the target and the learner's price (reach-break-even).

function useChartPointer(g: Geo) {
  const ref = useRef<SVGSVGElement>(null)
  /** The output under the pointer, snapped to the nearest gridline. */
  const outputAt = (e: PointerEvent): number | null => {
    const m = ref.current?.getScreenCTM()
    if (!m) return null
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse())
    const { step, max } = g.chart.x
    const raw = ((p.x - g.L) / (R - g.L)) * max
    return Math.max(0, Math.min(max, Math.round(raw / step) * step))
  }
  const capture = (e: PointerEvent) => {
    const el = ref.current
    if (el && typeof el.setPointerCapture === 'function') el.setPointerCapture(e.pointerId)
  }
  return { ref, outputAt, capture }
}

function MarkerChart({ config, state, setState, marked, locked }: Props) {
  const t = config.task
  const chart = chartFor(t)
  const g = geometry(chart ?? { x: { step: 1, cols: 8, max: 8 }, y: { step: 1, rows: 8, max: 8 } })
  const pointer = useChartPointer(g)
  const [dragging, setDragging] = useState(false)
  const [focused, setFocused] = useState(false)
  const id = useId()
  const { step, max } = g.chart.x
  const raw = state?.at
  const at = typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 && raw <= max ? raw : 0
  const answer = typeof state?.answer === 'string' ? state.answer : ''
  const margin = t.kind === 'margin-of-safety'
  const planned = margin ? t.plannedOutput : undefined
  const named = marked === 'right' || marked === 'shown'

  const move = (to: number | null) => {
    if (locked || to === null) return
    const next = Math.max(0, Math.min(max, to))
    if (next !== at) setState(margin ? { at: next, answer } : { at: next })
  }
  const onKey = (e: KeyboardEvent) => {
    const by = { ArrowRight: step, ArrowUp: step, ArrowLeft: -step, ArrowDown: -step, PageUp: 5 * step, PageDown: -5 * step }[e.key]
    if (by === undefined && e.key !== 'Home' && e.key !== 'End') return
    // The board moves a selected card with the arrows; here they move the marker.
    e.preventDefault()
    e.stopPropagation()
    move(e.key === 'Home' ? 0 : e.key === 'End' ? max : at + (by ?? 0))
  }
  const x = g.x(at)

  return (
    <>
      <svg
        ref={pointer.ref}
        viewBox={`0 0 ${W} ${H}`}
        className="block w-full max-w-[380px] touch-none select-none"
        role="group"
        aria-label="A chart of costs and revenue in dollars against output in units"
        onPointerMove={(e) => { if (dragging) move(pointer.outputAt(e)) }}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
      >
        <Grid g={g} />
        {named && <Reveal g={g} e={t} given={planned !== undefined ? { q: planned, margin: true } : undefined} />}
        <Lines g={g} e={t} />
        {planned !== undefined && <Upright g={g} q={planned} name="Planned" />}
        {/* Tap anywhere on the chart to bring the marker there. */}
        <rect
          x={g.L} y={T} width={R - g.L} height={B - T} fill="transparent"
          className={locked ? '' : 'cursor-pointer'}
          onPointerDown={(e) => {
            if (locked) return
            setDragging(true)
            pointer.capture(e)
            move(pointer.outputAt(e))
          }}
        />
        <line x1={x} y1={GRIP} x2={x} y2={B} stroke={MARK} strokeWidth={2.5} pointerEvents="none" aria-hidden="true" />
        <Dots g={g} e={t} q={at} />
        <g
          role="slider"
          tabIndex={locked ? -1 : 0}
          aria-label="The marker on the output axis. Drag it, or use the arrow keys"
          aria-valuemin={0}
          aria-valuemax={max}
          aria-valuenow={at}
          aria-valuetext={units(at)}
          aria-disabled={locked || undefined}
          onKeyDown={onKey}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onPointerDown={(e) => {
            if (locked) return
            setDragging(true)
            pointer.capture(e)
          }}
          className={`outline-none focus-visible:outline-none ${locked ? '' : dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        >
          <rect x={x - 14} y={GRIP - 10} width={28} height={B - GRIP + 10} fill="transparent" />
          {focused && <circle cx={x} cy={GRIP} r={13} fill="none" stroke={MARK} strokeWidth={2.5} />}
          <circle cx={x} cy={GRIP} r={8} fill={MARK} stroke={PANEL} strokeWidth={2} />
        </g>
      </svg>
      <Key e={t} given={planned !== undefined ? { name: 'Planned output', q: planned } : undefined} named={named} />
      <p className="text-[13px] font-bold text-ss-slate" aria-hidden="true">
        Marker at <span className="tabular-nums text-ss-ink">{units(at)}</span>
        <span className="block text-[12px] font-semibold">
          {margin ? 'Drag it, or use the arrow keys, to read the chart.' : 'Drag it along the output axis, or use the arrow keys.'}
        </span>
      </p>
      <p className="sr-only" aria-live="polite">{`Marker at ${units(at)}: ${relation(t, at)} here.`}</p>
      {margin && (
        <div className="flex items-center justify-center gap-2">
          <label htmlFor={`${id}-margin`} className="text-[12px] font-bold uppercase tracking-widest text-ss-slate">Margin of safety</label>
          <input
            id={`${id}-margin`}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
            value={answer}
            disabled={locked}
            onChange={(e) => setState({ at, answer: e.target.value.slice(0, 12) })}
            // The board's own keys stay out of the box.
            onKeyDown={(e) => e.stopPropagation()}
            className="nodrag w-24 rounded-lg border-2 border-ss-line bg-ss-panel px-2 py-1 text-center text-[16px] font-extrabold tabular-nums text-ss-ink outline-none focus:border-[color:var(--subject)]"
          />
          <span className="text-[13px] font-bold text-ss-slate">units</span>
        </div>
      )}
      <Verdict marked={marked}>
        {named ? (
          <>
            <p>{revealBreakEven(t)}</p>
            <p className="font-semibold">{margin ? revealMargin(t) : revealContribution(t)}</p>
          </>
        ) : (
          <p>{margin ? madeMargin(t, answer) : atOutput(t, at)}</p>
        )}
      </Verdict>
    </>
  )
}

function LeverChart({ config, state, setState, marked, locked }: Props) {
  const t: BusinessFinanceTask = config.task
  const chart = chartFor(t)
  const g = geometry(chart ?? { x: { step: 1, cols: 8, max: 8 }, y: { step: 1, rows: 8, max: 8 } })
  const id = useId()
  const { lo, hi } = leverRange(t)
  const raw = state?.value
  const value = typeof raw === 'number' && Number.isInteger(raw) ? Math.max(lo, Math.min(hi, raw)) : leverStart(t)
  const named = marked === 'right' || marked === 'shown'
  // Shown, the chart is drawn at the answer; otherwise at the learner's own value.
  const drawn = named ? needed(t) ?? value : value
  const e = withLever(t, drawn)
  const target = t.targetOutput ?? 0
  const word = t.change === 'variable-cost' ? 'variable cost' : 'price'
  const set = (v: number) => {
    if (locked) return
    const next = Math.max(lo, Math.min(hi, v))
    if (next !== value) setState({ value: next })
  }
  const what = t.change === 'variable-cost' ? `With a variable cost of ${money(value)} per unit` : `With a price of ${money(value)}`
  const button = 'nodrag h-8 w-8 shrink-0 rounded-lg border-2 border-ss-line bg-ss-chip text-[16px] font-extrabold leading-none text-ss-ink disabled:opacity-40'

  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full max-w-[380px] select-none" role="img" aria-label="A chart of costs and revenue in dollars against output in units, with the target output marked">
        <Grid g={g} />
        {named && <Reveal g={g} e={e} given={{ q: target, margin: false }} />}
        <Lines g={g} e={e} />
        <Upright g={g} q={target} name="Target" />
        <Dots g={g} e={e} q={target} />
      </svg>
      <Key e={e} given={{ name: 'Target output', q: target }} named={named} />
      <div className="flex w-full max-w-[360px] items-center gap-2">
        <label htmlFor={`${id}-lever`} className="whitespace-nowrap text-[12px] font-bold uppercase tracking-widest text-ss-slate">
          {t.change === 'variable-cost' ? 'Variable cost' : 'Price'}
        </label>
        <button type="button" className={button} aria-label={`Lower the ${word} by $1`} disabled={locked || value <= lo} onClick={() => set(value - 1)}>−</button>
        <input
          id={`${id}-lever`}
          type="range"
          min={lo}
          max={hi}
          step={1}
          value={value}
          disabled={locked}
          aria-valuetext={`${money(value)} per unit`}
          onChange={(ev) => set(Number(ev.target.value))}
          // The board moves a selected card with the arrows; here they move the control.
          onKeyDown={(ev) => ev.stopPropagation()}
          className="nodrag min-w-0 flex-1 touch-none"
          style={{ accentColor: 'var(--subject)' }}
        />
        <button type="button" className={button} aria-label={`Raise the ${word} by $1`} disabled={locked || value >= hi} onClick={() => set(value + 1)}>+</button>
        <span className="w-14 shrink-0 text-right text-[16px] font-extrabold tabular-nums text-ss-ink" aria-hidden="true">{money(value)}</span>
      </div>
      <p className="sr-only" aria-live="polite">{`${what}: at the target of ${units(target)}, ${relation(withLever(t, value), target)}.`}</p>
      <Verdict marked={marked}>
        <p>{named ? revealLever(t) : madeLever(t, value)}</p>
      </Verdict>
    </>
  )
}

/**
 * A break-even chart: fixed costs, total costs and total revenue against
 * output. The learner moves a marker along the output axis (find-break-even,
 * margin-of-safety) or changes the price or variable cost until the lines
 * cross at a target (reach-break-even). Where the lines cross is never named
 * until it is marked.
 */
export function BusinessFinanceView(props: Props) {
  return (
    <div className={`nodrag flex flex-col items-center gap-2 ${PALETTE}`}>
      {props.config.task.kind === 'reach-break-even' ? <LeverChart {...props} /> : <MarkerChart {...props} />}
    </div>
  )
}
