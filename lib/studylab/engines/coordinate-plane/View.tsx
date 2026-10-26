'use client'
import { useId, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import type { SceneMarked, SceneViewProps } from '../types'
import type { CoordinatePlaneConfig, CoordinatePlaneState, Line, Point, Rat } from './config'
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
/** Text on the grid stays legible over lines: a halo of the panel colour behind it. */
const HALO = { stroke: PANEL, strokeWidth: 3.5, paintOrder: 'stroke', strokeLinejoin: 'round' } as const

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
// The drawing.

function Grid() {
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
      <g fontSize={12} fontWeight={600} fill={SLATE} {...HALO}>
        {ticks.filter((t) => t !== 0).map((t) => (
          <g key={t}>
            <text x={sx(t)} y={O + 16} textAnchor="middle">{num(t)}</text>
            <text x={O - 6} y={sy(t) + 4} textAnchor="end">{num(t)}</text>
          </g>
        ))}
        <text x={O - 6} y={O + 16} textAnchor="end">0</text>
      </g>
    </g>
  )
}

function Plane({ grid, label, onMove, onUp, children }: {
  grid: ReturnType<typeof useGridPointer>; label: string; onMove(e: PointerEvent): void; onUp(): void; children: ReactNode
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
      <Grid />
      {children}
    </svg>
  )
}

/** A line across the whole grid, through `p` along `d`. */
function DrawnLine({ p, d }: { p: [number, number]; d: [number, number] }) {
  const seg = clipToGrid(p, d)
  if (!seg) return null
  return <line x1={sx(seg[0][0])} y1={sy(seg[0][1])} x2={sx(seg[1][0])} y2={sy(seg[1][1])} stroke={LINE} strokeWidth={3} strokeLinecap="round" aria-hidden="true" />
}

/** Rise over run between two points: along from the left one, then up or down to the right one. */
function Triangle({ from, to }: { from: [number, number]; to: [number, number] }) {
  const [l, r] = from[0] <= to[0] ? [from, to] : [to, from]
  const run = r[0] - l[0]
  const rise = r[1] - l[1]
  if (run === 0) return null
  const cx = sx(r[0])
  const cy = sy(l[1])
  const up = rise > 0 ? 1 : -1
  // The rise label sits outside the triangle, unless that would leave the picture.
  const outside = cx + 58 <= S
  return (
    <g aria-hidden="true">
      <path d={`M ${sx(l[0])} ${cy} H ${cx} V ${sy(r[1])}`} fill="none" stroke={MARK} strokeWidth={2.5} strokeDasharray="5 4" />
      {rise !== 0 && <path d={`M ${cx - 8} ${cy} v ${-8 * up} h 8`} fill="none" stroke={MARK} strokeWidth={1.5} />}
      <g fontSize={12} fontWeight={800} fill={MARK} {...HALO}>
        <text x={(sx(l[0]) + cx) / 2} y={cy + (rise > 0 ? 17 : -8)} textAnchor="middle">run {run}</text>
        <text x={outside ? cx + 7 : cx - 7} y={(cy + sy(r[1])) / 2 + 4} textAnchor={outside ? 'start' : 'end'}>rise {num(rise)}</text>
      </g>
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

/** A fraction's size, stacked, as a school writes it; a whole number as itself. */
function Frac({ r }: { r: Rat }) {
  const n = Math.abs(r.n)
  if (r.d === 1) return <>{n}</>
  return (
    <span className="mx-[2px] inline-flex flex-col items-center align-middle text-[13px] leading-[1.1]">
      <span className="border-b-[1.5px] border-current px-[3px]">{n}</span>
      <span className="px-[3px]">{r.d}</span>
    </span>
  )
}

function Equation({ line }: { line: Line }) {
  if (line.kind === 'vertical') return <><i className="font-serif">x</i> = {num(line.x)}</>
  const { m, c } = line
  const unit = m.d === 1 && Math.abs(m.n) === 1
  return (
    <>
      <i className="font-serif">y</i> ={' '}
      {m.n !== 0 && <>{m.n < 0 && MINUS}{!unit && <Frac r={m} />}<i className="font-serif">x</i></>}
      {m.n === 0 ? <>{c.n < 0 && MINUS}<Frac r={c} /></> : c.n !== 0 && <> {c.n < 0 ? MINUS : '+'} <Frac r={c} /></>}
    </>
  )
}

function Verdict({ marked, children }: { marked: SceneMarked; children: ReactNode }) {
  if (marked === 'idle') return null
  return <p className="max-w-[340px] text-center text-[13px] font-extrabold leading-snug text-ss-ink">{children}</p>
}

type Props = SceneViewProps<CoordinatePlaneConfig, CoordinatePlaneState>

// ---------------------------------------------------------------------------
// make-line: two points, the line through them, and its equation.

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
  const [l, r] = a[0] <= b[0] ? [a, b] : [b, a]
  const run = r[0] - l[0]
  const rise = r[1] - l[1]
  const crossing = line?.kind === 'sloped' && Math.abs(line.c.n / line.c.d) <= N ? line.c.n / line.c.d : null
  const words = !line ? '' : line.kind === 'vertical' ? `x = ${num(line.x)}` : equationText(line.m, line.c)
  const named = marked === 'right' || marked === 'shown'
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
        onMove={(e) => { if (!drag) return; const p = grid.snapped(e); if (p) place(drag, p) }}
        onUp={() => setDrag(null)}
      >
        {line && <DrawnLine p={a} d={[b[0] - a[0], b[1] - a[1]]} />}
        <Triangle from={a} to={b} />
        {crossing !== null && <circle cx={O} cy={sy(crossing)} r={5} fill={PANEL} stroke={LINE} strokeWidth={2} aria-hidden="true" />}
        {handle('a', a, 'First point')}
        {handle('b', b, 'Second point')}
      </Plane>
      <div className="flex flex-col items-center gap-1 text-center">
        <p className="flex min-h-[34px] items-center text-[19px] font-extrabold tabular-nums text-ss-ink" aria-hidden="true">
          {/* Inline, not a flex item: a flex box drops the spaces between the terms. */}
          <span>{line && <Equation line={line} />}</span>
        </p>
        <p className="text-[12px] font-semibold leading-snug text-ss-slate" aria-hidden="true">
          {line?.kind === 'sloped' ? (
            <>
              gradient = rise ÷ run = {num(rise)} ÷ {run} = {ratText(line.m)}
              <span className="block">crosses the y-axis at {pointText([rat(0), line.c])}</span>
            </>
          ) : line?.kind === 'vertical' ? (
            <>
              run 0: a vertical line has no gradient
              <span className="block">{line.x === 0 ? 'it is the y-axis itself' : 'it never crosses the y-axis'}</span>
            </>
          ) : null}
        </p>
        <p className="sr-only" aria-live="polite">
          {line ? `Your line goes through ${pointText(a)} and ${pointText(b)}: ${words}. Rise ${num(rise)}, run ${run}.` : ''}
        </p>
        <Verdict marked={marked}>
          {named ? `${namedLine(config)}.` : madeLine(config, a, b)}
        </Verdict>
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
        onMove={(e) => { if (down) choose(grid.snapped(e)) }}
        onUp={() => setDown(false)}
      >
        <DrawnLine p={[0, c]} d={[1, m]} />
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
        <Verdict marked={marked}>
          {named
            ? `It crosses the y-axis at ${pointText([0, c])}: the line is ${equationText(fromHalves(m), fromHalves(c))}.`
            : madePick(config, pick)}
        </Verdict>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// read-gradient: the engine's line and a triangle on it; the learner stretches
// the triangle and writes the gradient.

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

  const stretch = (next: number) => {
    if (locked) return
    const fitted = fit(next)
    if (fitted !== run) setState({ run: fitted, answer })
  }
  const named = marked === 'right' || marked === 'shown'
  const M = fromHalves(m)

  return (
    <>
      <Plane
        grid={grid}
        label="A coordinate grid from −6 to 6, with a straight line and a rise-over-run triangle on it"
        onMove={(e) => {
          if (!drag) return
          const p = grid.exact(e)
          // How far along the line the pointer is, measured in run.
          if (p) stretch(((p[0] - from[0]) + (p[1] - from[1]) * m) / (1 + m * m))
        }}
        onUp={() => setDrag(false)}
      >
        <DrawnLine p={[0, c]} d={[1, m]} />
        <Triangle from={from} to={to} />
        <circle cx={sx(from[0])} cy={sy(from[1])} r={5} fill={MARK} stroke={PANEL} strokeWidth={2} aria-hidden="true" />
        <PointHandle
          at={to}
          label="The corner of the triangle on the line. Drag it along the line, or use the arrow keys, to change the run"
          valuetext={`run ${run}, rise ${num(rise)}`}
          value={{ now: run, min: step, max: most }}
          fill={MARK}
          locked={locked}
          onKeyMove={(dx, dy) => stretch(run + (dx + dy > 0 ? step : -step))}
          onGrab={(e) => { setDrag(true); grid.capture(e) }}
        />
      </Plane>
      <p className="sr-only" aria-live="polite">{`The triangle has run ${run} and rise ${num(rise)}.`}</p>
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
      <p id={`${id}-how`} className="text-center text-[12px] text-ss-slate">A whole number, a fraction like 3/2, or a decimal.</p>
      <Verdict marked={marked}>
        {named
          ? `Gradient = rise ÷ run = ${num(rise)} ÷ ${run} = ${ratText(M)}. The line is ${equationText(M, fromHalves(c))}.`
          : madeGradient(answer)}
      </Verdict>
    </>
  )
}

/**
 * Straight-line graphs on a grid from -6 to 6: the learner's own line with its
 * rise-over-run triangle and equation (make-line), or the engine's line to read
 * a crossing (find-intercept) or a gradient (read-gradient) from.
 */
export function CoordinatePlaneView(props: Props) {
  const kind = props.config.task.kind
  return (
    <div className={`nodrag flex flex-col items-center gap-2 ${PALETTE}`}>
      {kind === 'make-line' ? <MakeLine {...props} /> : kind === 'find-intercept' ? <FindIntercept {...props} /> : <ReadGradient {...props} />}
    </div>
  )
}
