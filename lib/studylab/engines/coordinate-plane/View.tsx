'use client'
import { useId, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import type { SceneMarked, SceneViewProps } from '../types'
import type { CoordinatePlaneConfig, CoordinatePlaneState, Point } from './config'
import {
  equationText, fromHalves, gridPoint, lineThrough, madeGradient, madeLine, madePick, namedLine, onLine,
  pointText, rat, ratText, samePoint, triangleOn,
} from './config'

// The grid's size. N mirrors GRID in config.ts: config.ts imports this file,
// so a module-level read of its exports here would run before it has loaded.
const N = 6
const U = 24
const PAD = 28
const S = 2 * N * U + 2 * PAD
const O = S / 2
const LO = PAD
const HI = S - PAD
const sx = (x: number) => O + x * U
const sy = (y: number) => O - y * U

// The scene's own two inks, each over 4.5:1 on the panel in both themes: the
// line and its points in blue, the rise-over-run triangle and a chosen point in
// orange. Neither is the lesson colour, so they stay apart in every subject;
// the focus ring takes the lesson colour, as orbit's does.
const PALETTE = '[--cp-line:#1D4ED8] [--cp-mark:#C2410C] dark:[--cp-line:#60A5FA] dark:[--cp-mark:#FB923C]'
const LINE = 'var(--cp-line, #1D4ED8)'
const MARK = 'var(--cp-mark, #C2410C)'
const PANEL = 'var(--ss-panel, #FFFFFF)'
const INK = 'var(--ss-ink, #16202A)'
const SLATE = 'var(--ss-slate, #636D76)'
const MINUS = '−'

const clampGrid = (v: number) => Math.max(-N, Math.min(N, v)) + 0
const num = (v: number) => (v < 0 ? `${MINUS}${-v}` : `${v + 0}`)
const ARROWS: Record<string, [number, number]> = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }
/**
 * Text on the grid stays legible over whatever is drawn beneath it: a halo of
 * the panel colour, painted under the letters. It only works for text drawn
 * after the lines, so the axis numbers sit above the line and the triangle.
 */
const HALO = { stroke: PANEL, strokeWidth: 4, paintOrder: 'stroke', strokeLinejoin: 'round' } as const

// Where the axis numbers go: under the x-axis, and left of the y-axis, clear
// of a point sitting on either axis.
const X_NUMBER_BASE = O + 20
const Y_NUMBER_END = O - 12

/** The part of the infinite line through `p` along `d` that lies inside the grid. */
export function clipToGrid(p: [number, number], d: [number, number]): [[number, number], [number, number]] | null {
  let t0 = -Infinity
  let t1 = Infinity
  for (const k of [0, 1]) {
    if (d[k] === 0) {
      if (Math.abs(p[k]) > N) return null
      continue
    }
    let a = (-N - p[k]) / d[k]
    let b = (N - p[k]) / d[k]
    if (a > b) [a, b] = [b, a]
    t0 = Math.max(t0, a)
    t1 = Math.min(t1, b)
  }
  if (!(t0 < t1)) return null
  return [[p[0] + t0 * d[0], p[1] + t0 * d[1]], [p[0] + t1 * d[0], p[1] + t1 * d[1]]]
}

// ---------------------------------------------------------------------------
// Keeping the triangle's labels off everything else. All in picture units.

export type Box = { x0: number; y0: number; x1: number; y1: number }
type Anchor = 'start' | 'middle' | 'end'
export type Placed = { text: string; x: number; y: number; anchor: Anchor; box: Box }
type Seg = [[number, number], [number, number]]

export const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1

/** A 12 px bold label's box, from its anchor point and baseline (no descenders: letters, digits, a minus). */
function labelBox(text: string, x: number, y: number, anchor: Anchor): Box {
  const w = text.length * 7
  const x0 = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2
  return { x0: x0 - 1, y0: y - 10, x1: x0 + w + 1, y1: y + 2 }
}

const TICKS = Array.from({ length: 2 * N + 1 }, (_, i) => i - N).filter((t) => t !== 0)

/** Every axis number's box, halo and all: one each, so a label may sit in the gap between two. */
export const NUMBER_ZONES: Box[] = [
  ...TICKS.map((t) => labelBox(num(t), sx(t), X_NUMBER_BASE, 'middle')),
  ...TICKS.map((t) => labelBox(num(t), Y_NUMBER_END, sy(t) + 4, 'end')),
  labelBox('0', O - 5, X_NUMBER_BASE, 'end'),
]
/** The two axes themselves. */
export const AXIS_ZONES: Box[] = [
  { x0: LO, y0: O - 2, x1: HI + 16, y1: O + 2 },
  { x0: O - 2, y0: LO - 16, x1: O + 2, y1: HI },
]

/** Whether a segment passes through a box (Liang-Barsky). */
function crosses([p, q]: Seg, b: Box): boolean {
  const d = [q[0] - p[0], q[1] - p[1]]
  let t0 = 0
  let t1 = 1
  for (const [k, lo, hi] of [[0, b.x0, b.x1], [1, b.y0, b.y1]] as const) {
    if (d[k] === 0) {
      if (p[k] < lo || p[k] > hi) return false
      continue
    }
    let a = (lo - p[k]) / d[k]
    let c = (hi - p[k]) / d[k]
    if (a > c) [a, c] = [c, a]
    t0 = Math.max(t0, a)
    t1 = Math.min(t1, c)
    if (t0 > t1) return false
  }
  return true
}

/** How badly a label at `box` would sit: on the axis numbers or an axis worst, then the line, points and the other label. */
function cost(box: Box, segs: Seg[], solid: Box[]): number {
  let c = 0
  if (box.x0 < 0 || box.y0 < 0 || box.x1 > S || box.y1 > S) c += 20
  for (const z of NUMBER_ZONES) if (overlaps(box, z)) c += 6
  for (const z of AXIS_ZONES) if (overlaps(box, z)) c += 5
  for (const s of segs) if (crosses(s, box)) c += 4
  for (const z of solid) if (overlaps(box, z)) c += 4
  // Off the grid's own square is allowed, but a little worse than on it.
  if (box.x0 < LO || box.y0 < LO || box.x1 > HI || box.y1 > HI) c += 1
  // Clear, but crowding an axis number or an axis: a tie-break, not a fault.
  const near = { x0: box.x0 - 5, y0: box.y0 - 3, x1: box.x1 + 5, y1: box.y1 + 3 }
  if (NUMBER_ZONES.some((z) => overlaps(near, z)) || AXIS_ZONES.some((z) => overlaps(near, z))) c += 0.4
  return c
}

/**
 * A candidate spot: anchor point, baseline, anchor, and a preference under 1
 * (nearer the middle of its leg, outside the triangle, close to the leg) that
 * only ever breaks ties -- any real overlap costs at least 1.
 */
type Spot = [number, number, Anchor, number]

function best(spots: Spot[], text: string, segs: Seg[], solid: Box[]): Placed {
  let pick: Placed | null = null
  let low = Infinity
  // Most preferred first; once nothing left could beat the best so far (a
  // spot never costs less than its own preference), stop looking.
  for (const [x, y, anchor, lean] of [...spots].sort((p, q) => p[3] - q[3])) {
    if (lean >= low) break
    const box = labelBox(text, x, y, anchor)
    const c = cost(box, segs, solid) + lean
    if (c < low) { low = c; pick = { text, x, y, anchor, box } }
  }
  return pick!
}

/** Fractions along a leg of `length` px, every 4 px, from 16 px before one end to 16 px past the other. */
const stops = (length: number) => {
  const len = Math.max(1, Math.abs(length))
  const out: number[] = []
  for (let px = -16; px <= len + 16; px += 4) out.push(px / len)
  return out
}
/** How far a fraction along a leg is from its middle, as a tie-break under 0.3. */
const offMiddle = (f: number) => Math.min(0.29, Math.abs(f - 0.5) * 0.25)

/**
 * Where the "run" and "rise" labels go for the triangle from one grid point
 * to another: beside their legs, outside the triangle when that is clear,
 * and moved along or across the leg to keep off the axis numbers, the axes,
 * the line and the points. `shown` adds the numbers, once the card is marked.
 */
export function placeTriangleLabels(from: [number, number], to: [number, number], shown: boolean, line: Seg | null): { run: Placed; rise: Placed } | null {
  const [l, r] = from[0] <= to[0] ? [from, to] : [to, from]
  const run = r[0] - l[0]
  const rise = r[1] - l[1]
  if (run === 0) return null
  const lx = sx(l[0])
  const cx = sx(r[0])
  const cy = sy(l[1])
  const ry = sy(r[1])
  const pt = (x: number, y: number): Box => ({ x0: x - 10, y0: y - 10, x1: x + 10, y1: y + 10 })
  const segs: Seg[] = [...(line ? [line] : []), [[lx, cy], [cx, cy]], [[cx, cy], [cx, ry]]]
  const points = [pt(lx, cy), pt(cx, ry)]

  // "run": under or over the horizontal leg (outside the triangle preferred),
  // anywhere along it, then a little further off if all of that is taken.
  const runText = shown ? `run ${run}` : 'run'
  const outside = rise > 0 ? 1 : -1
  const runSpots: Spot[] = []
  for (const [side, away, lean] of [[outside, 0, 0], [-outside, 0, 0.3], [outside, 14, 0.5], [-outside, 14, 0.6]] as const) {
    // These two rows are exactly the gaps between the y-axis numbers either side of the leg's row.
    const y = side > 0 ? cy + 16 + away : cy - 8 - away
    for (const f of stops(cx - lx)) runSpots.push([lx + (cx - lx) * f, y, 'middle', lean + offMiddle(f)])
  }
  const runLabel = best(runSpots, runText, segs, points)

  // "rise": right of the vertical leg (outside) or left of it, anywhere along it.
  const riseText = shown ? `rise ${num(rise)}` : 'rise'
  const riseSpots: Spot[] = []
  if (rise === 0) {
    // A flat triangle has no rise leg: its label sits by the corner.
    for (const [dx, dy, anchor, lean] of [[12, -5, 'start', 0], [12, 15, 'start', 0.1], [-12, -5, 'end', 0.2], [-12, 15, 'end', 0.3], [12, -19, 'start', 0.5], [12, 29, 'start', 0.6]] as const) {
      riseSpots.push([cx + dx, cy + dy, anchor, lean])
    }
  } else {
    for (const [anchor, away, lean] of [['start', 0, 0], ['end', 0, 0.3], ['start', 12, 0.5], ['end', 12, 0.6]] as const) {
      const x = anchor === 'start' ? cx + 6 + away : cx - 6 - away
      for (const f of stops(ry - cy)) riseSpots.push([x, cy + (ry - cy) * f + 4, anchor, lean + offMiddle(f)])
    }
  }
  const riseLabel = best(riseSpots, riseText, segs, [...points, runLabel.box])
  return { run: runLabel, rise: riseLabel }
}

// ---------------------------------------------------------------------------
// Pointers.

/** Where a pointer is, in grid units: exactly, and snapped to the nearest grid point. */
function useGridPointer() {
  const ref = useRef<SVGSVGElement>(null)
  const exact = (e: PointerEvent): [number, number] | null => {
    const m = ref.current?.getScreenCTM()
    if (!m) return null
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse())
    return [(p.x - O) / U, (O - p.y) / U]
  }
  const snapped = (e: PointerEvent): Point | null => {
    const p = exact(e)
    return p ? [clampGrid(Math.round(p[0])), clampGrid(Math.round(p[1]))] : null
  }
  const capture = (e: PointerEvent) => {
    const el = ref.current
    if (el && typeof el.setPointerCapture === 'function') el.setPointerCapture(e.pointerId)
  }
  return { ref, exact, snapped, capture }
}

// ---------------------------------------------------------------------------
// The drawing, back to front: the grid and axes, the lines, the axis numbers
// (haloed, so a line passing under them never strikes through one), then the
// labels and the points.

function GridBack() {
  const ticks = Array.from({ length: 2 * N + 1 }, (_, i) => i - N)
  return (
    <g aria-hidden="true">
      <rect x={LO} y={LO} width={HI - LO} height={HI - LO} fill={PANEL} />
      <g stroke={SLATE} strokeOpacity={0.3} strokeWidth={1}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={sx(t)} y1={LO} x2={sx(t)} y2={HI} />
            <line x1={LO} y1={sy(t)} x2={HI} y2={sy(t)} />
          </g>
        ))}
      </g>
      {/* The axes, bold, with arrowheads at their positive ends. */}
      <g stroke={INK} strokeWidth={2.25} strokeLinecap="round">
        <line x1={LO} y1={O} x2={HI + 8} y2={O} />
        <line x1={O} y1={HI} x2={O} y2={LO - 8} />
      </g>
      <path d={`M ${HI + 15} ${O} l -9 -4.5 v 9 z M ${O} ${LO - 15} l -4.5 9 h 9 z`} fill={INK} />
      <text x={HI + 10} y={O - 9} textAnchor="middle" fontSize={14} fontWeight={700} fontStyle="italic" fill={INK}>x</text>
      <text x={O + 9} y={LO - 7} fontSize={14} fontWeight={700} fontStyle="italic" fill={INK}>y</text>
    </g>
  )
}

/** The box a round mark of radius `r` covers at a grid point. */
export const dotBox = (p: [number, number], r: number): Box => ({ x0: sx(p[0]) - r, y0: sy(p[1]) - r, x1: sx(p[0]) + r, y1: sy(p[1]) + r })

/**
 * The axis numbers, haloed. A point on the column just left of the y-axis or
 * the row just under the x-axis would sit on a number -- the gap between grid
 * lines holds one or the other, not both -- so a number under a point is left
 * out while the point is there.
 */
function AxisNumbers({ under }: { under: Box[] }) {
  const clear = (b: Box) => !under.some((u) => overlaps(b, u))
  return (
    <g aria-hidden="true" data-axis-numbers="" fontSize={12} fontWeight={600} fill={SLATE} {...HALO}>
      {TICKS.map((t) => (
        <g key={t}>
          {clear(labelBox(num(t), sx(t), X_NUMBER_BASE, 'middle')) && <text x={sx(t)} y={X_NUMBER_BASE} textAnchor="middle">{num(t)}</text>}
          {clear(labelBox(num(t), Y_NUMBER_END, sy(t) + 4, 'end')) && <text x={Y_NUMBER_END} y={sy(t) + 4} textAnchor="end">{num(t)}</text>}
        </g>
      ))}
      <text x={O - 5} y={X_NUMBER_BASE} textAnchor="end">0</text>
    </g>
  )
}

function Plane({ grid, label, lines, marks = [], onMove, onUp, children }: {
  grid: ReturnType<typeof useGridPointer>; label: string; lines: ReactNode
  /** Where the points are, so no axis number is drawn under one. */
  marks?: Box[]
  onMove(e: PointerEvent): void; onUp(): void; children: ReactNode
}) {
  return (
    <svg
      ref={grid.ref}
      viewBox={`0 0 ${S} ${S}`}
      className="block w-full max-w-[344px] touch-none select-none"
      role="group"
      aria-label={label}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      <GridBack />
      {lines}
      <AxisNumbers under={marks} />
      {children}
    </svg>
  )
}

/** A line across the whole grid, through `p` along `d`, in picture units; null when it misses the grid. */
export function lineSeg(p: [number, number], d: [number, number]): Seg | null {
  const g = clipToGrid(p, d)
  return g ? [[sx(g[0][0]), sy(g[0][1])], [sx(g[1][0]), sy(g[1][1])]] : null
}

function DrawnLine({ seg }: { seg: Seg | null }) {
  if (!seg) return null
  return <line data-line="" x1={seg[0][0]} y1={seg[0][1]} x2={seg[1][0]} y2={seg[1][1]} stroke={LINE} strokeWidth={3} strokeLinecap="round" aria-hidden="true" />
}

/** The triangle's legs: along from the left point, then up or down to the right one, with its right angle. */
function TriangleLegs({ from, to }: { from: [number, number]; to: [number, number] }) {
  const [l, r] = from[0] <= to[0] ? [from, to] : [to, from]
  const rise = r[1] - l[1]
  if (r[0] === l[0]) return null
  const cx = sx(r[0])
  const cy = sy(l[1])
  const up = rise > 0 ? 1 : -1
  return (
    <g aria-hidden="true">
      <path d={`M ${sx(l[0])} ${cy} H ${cx} V ${sy(r[1])}`} fill="none" stroke={MARK} strokeWidth={2.5} strokeDasharray="5 4" />
      {rise !== 0 && <path d={`M ${cx - 8} ${cy} v ${-8 * up} h 8`} fill="none" stroke={MARK} strokeWidth={1.5} />}
    </g>
  )
}

function TriangleLabels({ from, to, shown, line }: { from: [number, number]; to: [number, number]; shown: boolean; line: Seg | null }) {
  const at = placeTriangleLabels(from, to, shown, line)
  if (!at) return null
  return (
    <g aria-hidden="true" data-triangle-labels="" fontSize={12} fontWeight={800} fill={MARK} {...HALO}>
      {[at.run, at.rise].map((p) => <text key={p.text} x={p.x} y={p.y} textAnchor={p.anchor}>{p.text}</text>)}
    </g>
  )
}

/** A point the learner moves: drag it, or Tab to it and use the arrow keys. */
function PointHandle({ at, label, valuetext, value, fill, locked, onKeyMove, onGrab }: {
  at: [number, number]; label: string; valuetext: string; value: { now: number; min: number; max: number }
  fill: string; locked: boolean; onKeyMove(dx: number, dy: number): void; onGrab(e: PointerEvent): void
}) {
  const [focused, setFocused] = useState(false)
  const onKey = (e: KeyboardEvent) => {
    const d = ARROWS[e.key]
    if (!d) return
    // The board moves a selected card with the arrows; here they move the point.
    e.preventDefault()
    e.stopPropagation()
    if (!locked) onKeyMove(d[0], d[1])
  }
  return (
    <g
      role="slider"
      tabIndex={locked ? -1 : 0}
      aria-label={label}
      aria-valuemin={value.min}
      aria-valuemax={value.max}
      aria-valuenow={value.now}
      aria-valuetext={valuetext}
      aria-disabled={locked || undefined}
      onKeyDown={onKey}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onPointerDown={(e) => { if (!locked) onGrab(e) }}
      className={`outline-none focus-visible:outline-none ${locked ? '' : 'cursor-grab'}`}
      transform={`translate(${sx(at[0])} ${sy(at[1])})`}
    >
      <circle r={18} fill="transparent" />
      {focused && <circle r={13} fill="none" stroke="var(--subject)" strokeWidth={3} />}
      <circle r={7.5} fill={fill} stroke={PANEL} strokeWidth={2.5} />
    </g>
  )
}

/**
 * Keeps an equation, a coordinate or a line of working whole when the text
 * wraps: "y = (1/2)x − 2", "(0, 1/2)" and "2 ÷ 6 = 1/3" never break inside.
 */
export function unbroken(text: string): string {
  const tie = (m: string) => m.replace(/ /g, ' ')
  return text
    .replace(/\b[xy] = [^:;,]*?(?=[:;,]|\.(?:\s|$)|$)/g, tie)
    .replace(/\([^()]*\)/g, tie)
    .replace(/ ([÷=]) /g, ' $1 ')
}

function Verdict({ marked, text }: { marked: SceneMarked; text: string }) {
  if (marked === 'idle') return null
  return <p className="max-w-[340px] text-center text-[13px] font-extrabold leading-snug text-ss-ink">{unbroken(text)}</p>
}

const Hint = ({ children }: { children: ReactNode }) => <p className="text-center text-[12px] font-semibold text-ss-slate">{children}</p>

type Props = SceneViewProps<CoordinatePlaneConfig, CoordinatePlaneState>

// ---------------------------------------------------------------------------
// make-line: two points and the line through them. Until it is marked the
// learner sees only the line, the points and an unnumbered triangle -- no
// equation and no working -- so they make the line from the grid, not by
// matching a string.

function MakeLine({ config, state, setState, marked, locked }: Props) {
  const a = gridPoint(state?.a) ?? [-3, -2]
  const b = gridPoint(state?.b) ?? [3, 0]
  const grid = useGridPointer()
  const [drag, setDrag] = useState<'a' | 'b' | null>(null)

  const place = (which: 'a' | 'b', to: Point) => {
    if (locked) return
    const [self, other] = which === 'a' ? [a, b] : [b, a]
    // Two points on one spot make no line: a point cannot land on the other.
    if (samePoint(to, other) || samePoint(to, self)) return
    setState({ ...state, a: which === 'a' ? to : a, b: which === 'b' ? to : b })
  }
  const nudge = (which: 'a' | 'b', dx: number, dy: number) => {
    const [self, other] = which === 'a' ? [a, b] : [b, a]
    let to: Point = [self[0] + dx, self[1] + dy]
    // Step over the other point rather than stopping at it.
    if (samePoint(to, other)) to = [to[0] + dx, to[1] + dy]
    if (Math.abs(to[0]) <= N && Math.abs(to[1]) <= N) place(which, to)
  }

  const line = lineThrough(a, b)
  const seg = line ? lineSeg(a, [b[0] - a[0], b[1] - a[1]]) : null
  const [l, r] = a[0] <= b[0] ? [a, b] : [b, a]
  const run = r[0] - l[0]
  const rise = r[1] - l[1]
  const marks = marked !== 'idle'
  const named = marked === 'right' || marked === 'shown'
  const crossing = marks && line?.kind === 'sloped' && Math.abs(line.c.n / line.c.d) <= N ? line.c.n / line.c.d : null
  const handle = (which: 'a' | 'b', p: Point, name: string) => (
    <PointHandle
      key={which}
      at={p}
      label={`${name}. Drag it to a grid point, or use the arrow keys`}
      valuetext={pointText(p)}
      value={{ now: p[1], min: -N, max: N }}
      fill={LINE}
      locked={locked}
      onKeyMove={(dx, dy) => nudge(which, dx, dy)}
      onGrab={(e) => { setDrag(which); grid.capture(e) }}
    />
  )

  return (
    <>
      <Plane
        grid={grid}
        label="A coordinate grid from −6 to 6, with your line through two points"
        lines={<><DrawnLine seg={seg} /><TriangleLegs from={a} to={b} /></>}
        marks={[dotBox(a, 9), dotBox(b, 9)]}
        onMove={(e) => { if (!drag) return; const p = grid.snapped(e); if (p) place(drag, p) }}
        onUp={() => setDrag(null)}
      >
        <TriangleLabels from={a} to={b} shown={marks} line={seg} />
        {crossing !== null && <circle cx={O} cy={sy(crossing)} r={5} fill={PANEL} stroke={LINE} strokeWidth={2} aria-hidden="true" />}
        {handle('a', a, 'First point')}
        {handle('b', b, 'Second point')}
      </Plane>
      <div className="flex flex-col items-center gap-1 text-center">
        <p className="sr-only" aria-live="polite">{`Your line goes through ${pointText(a)} and ${pointText(b)}.`}</p>
        {!marks && <Hint>Drag a point, or Tab to it and use the arrow keys.</Hint>}
        <Verdict marked={marked} text={named ? `${namedLine(config)}.` : madeLine(config, a, b)} />
        {marks && line && (
          <p className="text-[12px] font-semibold leading-snug text-ss-slate">
            {unbroken(line.kind === 'sloped'
              ? `Gradient = rise ÷ run = ${num(rise)} ÷ ${run} = ${ratText(line.m)}; it crosses the y-axis at ${pointText([rat(0), line.c])}.`
              : `Run 0: a vertical line has no gradient, and ${line.x === 0 ? 'it is the y-axis itself' : 'it never crosses the y-axis'}.`)}
          </p>
        )}
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// find-intercept: the engine's line; the learner chooses a grid point.

function FindIntercept({ config, state, setState, marked, locked }: Props) {
  const { gradient: m, intercept: c } = config.task
  const pick = gridPoint(state?.pick)
  const grid = useGridPointer()
  const [down, setDown] = useState(false)
  const [focused, setFocused] = useState(false)

  const choose = (p: Point | null) => {
    if (locked || !p || (pick && samePoint(p, pick))) return
    setState({ pick: p })
  }
  const onKey = (e: KeyboardEvent) => {
    const d = ARROWS[e.key]
    if (!d && e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    e.stopPropagation()
    // The first key puts the point at the origin; the arrows then move it.
    if (!pick) return choose([0, 0])
    if (d) choose([clampGrid(pick[0] + d[0]), clampGrid(pick[1] + d[1])])
  }

  // What a sighted learner sees of the point against the line, and no more.
  const where = !pick ? '' : onLine(m, c, pick) ? 'on the line' : pick[1] > m * pick[0] + c ? 'above the line' : 'below the line'
  const slope = m > 0 ? 'rises from left to right' : m < 0 ? 'falls from left to right' : 'is level'
  const named = marked === 'right' || marked === 'shown'
  const ring = named ? 'var(--ss-good)' : marked === 'wrong' ? 'var(--ss-bad)' : MARK

  return (
    <>
      <Plane
        grid={grid}
        label="A coordinate grid from −6 to 6, with a straight line drawn on it"
        lines={<DrawnLine seg={lineSeg([0, c], [1, m])} />}
        marks={pick ? [dotBox(pick, 13)] : []}
        onMove={(e) => { if (down) choose(grid.snapped(e)) }}
        onUp={() => setDown(false)}
      >
        <rect
          role="slider"
          tabIndex={locked ? -1 : 0}
          x={LO - 12}
          y={LO - 12}
          width={HI - LO + 24}
          height={HI - LO + 24}
          fill="transparent"
          aria-label={`The grid. The line ${slope}. Choose a grid point: tap it, or use the arrow keys`}
          aria-valuemin={-N}
          aria-valuemax={N}
          aria-valuenow={pick ? pick[1] : 0}
          aria-valuetext={pick ? `${pointText(pick)}, ${where}` : 'No point chosen yet'}
          aria-disabled={locked || undefined}
          onKeyDown={onKey}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onPointerDown={(e) => {
            if (locked) return
            setDown(true)
            grid.capture(e)
            choose(grid.snapped(e))
          }}
          className={`outline-none focus-visible:outline-none ${locked ? '' : 'cursor-crosshair'}`}
        />
        {focused && <rect x={LO - 4} y={LO - 4} width={HI - LO + 8} height={HI - LO + 8} rx={6} fill="none" stroke="var(--subject)" strokeWidth={3} pointerEvents="none" />}
        {pick && (
          <g transform={`translate(${sx(pick[0])} ${sy(pick[1])})`} pointerEvents="none" aria-hidden="true">
            <circle r={10} fill="none" stroke={PANEL} strokeWidth={6} />
            <circle r={10} fill="none" stroke={ring} strokeWidth={3} />
            <circle r={3} fill={ring} />
          </g>
        )}
      </Plane>
      <div className="flex flex-col items-center gap-1 text-center">
        <p className="text-[13px] font-bold text-ss-slate">
          {pick ? <>Your point: <span className="tabular-nums text-ss-ink">{pointText(pick)}</span></> : 'Tap a grid point, or use the arrow keys.'}
        </p>
        <p className="sr-only" aria-live="polite">{pick ? `${pointText(pick)}, ${where}` : ''}</p>
        <Verdict
          marked={marked}
          text={named ? `It crosses the y-axis at ${pointText([0, c])}: the line is ${equationText(fromHalves(m), fromHalves(c))}.` : madePick(config, pick)}
        />
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// read-gradient: the engine's line and a triangle on it; the learner stretches
// the triangle, counts its squares and writes the gradient. Until it is marked
// the legs say only "rise" and "run": the counting is the learner's.

function ReadGradient({ config, state, setState, marked, locked }: Props) {
  const { gradient: m, intercept: c } = config.task
  const tri = triangleOn(m, c)
  const id = useId()
  const grid = useGridPointer()
  const [drag, setDrag] = useState(false)

  const step = tri?.step ?? 1
  const most = tri?.most ?? step
  const fit = (raw: number) => Math.max(step, Math.min(most, Math.round(raw / step) * step))
  const run = fit(typeof state?.run === 'number' ? state.run : step)
  const answer = typeof state?.answer === 'string' ? state.answer : ''
  const from: [number, number] = tri?.from ?? [0, c]
  const rise = m * run
  const to: [number, number] = [from[0] + run, from[1] + rise]
  const corner: [number, number] = [to[0], from[1]]
  const seg = lineSeg([0, c], [1, m])

  const stretch = (next: number) => {
    if (locked) return
    const fitted = fit(next)
    if (fitted !== run) setState({ run: fitted, answer })
  }
  const marks = marked !== 'idle'
  const named = marked === 'right' || marked === 'shown'
  const M = fromHalves(m)

  return (
    <>
      <Plane
        grid={grid}
        label="A coordinate grid from −6 to 6, with a straight line and a rise-over-run triangle on it"
        lines={<><DrawnLine seg={seg} /><TriangleLegs from={from} to={to} /></>}
        marks={[dotBox(from, 6), dotBox(to, 9)]}
        onMove={(e) => {
          if (!drag) return
          const p = grid.exact(e)
          // How far along the line the pointer is, measured in run.
          if (p) stretch(((p[0] - from[0]) + (p[1] - from[1]) * m) / (1 + m * m))
        }}
        onUp={() => setDrag(false)}
      >
        <TriangleLabels from={from} to={to} shown={marks} line={seg} />
        <circle cx={sx(from[0])} cy={sy(from[1])} r={5} fill={MARK} stroke={PANEL} strokeWidth={2} aria-hidden="true" />
        <PointHandle
          at={to}
          label="The corner of the triangle on the line. Drag it along the line, or use the arrow keys, to make the triangle bigger or smaller"
          // Where the corner is, as a sighted learner sees it; its run and rise are theirs to count.
          valuetext={`corner at ${pointText(to)}`}
          value={{ now: to[0], min: from[0] + step, max: from[0] + most }}
          fill={MARK}
          locked={locked}
          onKeyMove={(dx, dy) => stretch(run + (dx + dy > 0 ? step : -step))}
          onGrab={(e) => { setDrag(true); grid.capture(e) }}
        />
      </Plane>
      <p className="sr-only" aria-live="polite">{`The triangle's corners are at ${pointText(from)}, ${pointText(corner)} and ${pointText(to)}.`}</p>
      <div className="flex items-center justify-center gap-2">
        <label htmlFor={`${id}-gradient`} className="text-[12px] font-bold uppercase tracking-widest text-ss-slate">Gradient</label>
        <input
          id={`${id}-gradient`}
          type="text"
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          value={answer}
          disabled={locked}
          aria-describedby={`${id}-how`}
          onChange={(e) => setState({ run, answer: e.target.value.slice(0, 12) })}
          // The board's own keys stay out of the box.
          onKeyDown={(e) => e.stopPropagation()}
          className="nodrag w-24 rounded-lg border-2 border-ss-line bg-ss-panel px-2 py-1 text-center text-[16px] font-extrabold tabular-nums text-ss-ink outline-none focus:border-[color:var(--subject)]"
        />
      </div>
      <p id={`${id}-how`} className="text-center text-[12px] text-ss-slate">Count the squares. A whole number, a fraction like 3/2, or a decimal.</p>
      <Verdict
        marked={marked}
        text={named ? `Gradient = rise ÷ run = ${num(rise)} ÷ ${run} = ${ratText(M)}. The line is ${equationText(M, fromHalves(c))}.` : madeGradient(answer)}
      />
    </>
  )
}

/**
 * Straight-line graphs on a grid from -6 to 6: the learner's own line with its
 * rise-over-run triangle (make-line), or the engine's line to read a crossing
 * (find-intercept) or a gradient (read-gradient) from.
 */
export function CoordinatePlaneView(props: Props) {
  const kind = props.config.task.kind
  return (
    <div className={`nodrag flex flex-col items-center gap-2 ${PALETTE}`}>
      {kind === 'make-line' ? <MakeLine {...props} /> : kind === 'find-intercept' ? <FindIntercept {...props} /> : <ReadGradient {...props} />}
    </div>
  )
}
