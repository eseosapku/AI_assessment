'use client'
import { useId, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import type { SceneMarked, SceneViewProps } from '../types'
import type { Answer, ControlTask, Curve, ShiftTask, SupplyDemandConfig, SupplyDemandState } from './config'
import {
  controlOutcome, controlPrice, equilibrium, eventOf, madeControl, madeShift, namedControl, namedShift,
  quantityDemanded, quantitySupplied, readPrice, readShift, sentenceCase,
} from './config'

/**
 * The market's numbers, mirrored from config.ts: config.ts imports this file,
 * so a module-level read of its exports here would run before it has loaded.
 * The tests pin the two together.
 */
export const VIEW = { max: 12, demandTop: 11, supplyFoot: 1, notch: 2, maxShift: 4 } as const

// The drawing, in its own units: a 12 by 12 grid, 22 units a square.
const U = 22
const L = 46
const T = 28
const R = 38
const B = 44
const SIZE = VIEW.max * U
const W = L + SIZE + R
const H = T + SIZE + B
const sx = (q: number) => L + q * U
const sy = (p: number) => T + (VIEW.max - p) * U

// The scene's own inks, each over 4.5:1 on the panel in both themes: demand in
// blue, supply in orange, the government's price in violet. None is the lesson
// colour, so they stay apart in every subject; focus takes the lesson colour.
const PALETTE = '[--sd-demand:#1D4ED8] [--sd-supply:#C2410C] [--sd-control:#6D28D9] dark:[--sd-demand:#60A5FA] dark:[--sd-supply:#FB923C] dark:[--sd-control:#C4B5FD]'
const INKS = { demand: 'var(--sd-demand, #1D4ED8)', supply: 'var(--sd-supply, #C2410C)', control: 'var(--sd-control, #6D28D9)' } as const
const PANEL = 'var(--ss-panel, #FFFFFF)'
const INK = 'var(--ss-ink, #16202A)'
const SLATE = 'var(--ss-slate, #636D76)'
/** Text on the grid stays legible over lines: a halo of the panel colour behind it. */
const HALO = { stroke: PANEL, strokeWidth: 3.5, paintOrder: 'stroke', strokeLinejoin: 'round' } as const
const LETTER: Record<Curve, string> = { demand: 'D', supply: 'S' }
/**
 * Where each curve's handle sits: demand at $4, supply at $8, apart from each
 * other and from the first crossing, and never on the right edge, where a
 * moved curve's label goes.
 */
const HANDLE_PRICE: Record<Curve, number> = { demand: 4, supply: 8 }
const CHOICES: { id: Answer; label: string }[] = [
  { id: 'shortage', label: 'Shortage' },
  { id: 'surplus', label: 'Surplus' },
  { id: 'none', label: 'Neither' },
]

type Pt = [number, number]

/** The part of a curve inside the grid, left to right: demand P = 11 + shift - Q, supply P = 1 - shift + Q. */
export function segment(curve: Curve, shift: number): [Pt, Pt] | null {
  const M = VIEW.max
  if (curve === 'demand') {
    const a = VIEW.demandTop + shift
    const q0 = Math.max(0, a - M)
    const q1 = Math.min(M, a)
    return q0 < q1 ? [[q0, a - q0], [q1, a - q1]] : null
  }
  const c = VIEW.supplyFoot - shift
  const q0 = Math.max(0, -c)
  const q1 = Math.min(M, M - c)
  return q0 < q1 ? [[q0, c + q0], [q1, c + q1]] : null
}

/** Where a curve's handle sits, in grid units. */
const handleAt = (curve: Curve, shift: number): Pt => {
  const p = HANDLE_PRICE[curve]
  return [curve === 'demand' ? quantityDemanded(p, shift) : quantitySupplied(p, shift), p]
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v)) + 0
const money = (n: number) => `$${n}`
const howFar = (shift: number) => (shift === 0 ? 'not moved' : `moved ${Math.abs(shift)} units ${shift > 0 ? 'to the right' : 'to the left'}`)

/** Where a pointer is, in grid units. */
function useGridPointer() {
  const ref = useRef<SVGSVGElement>(null)
  const at = (e: PointerEvent): Pt | null => {
    const m = ref.current?.getScreenCTM()
    if (!m) return null
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse())
    return [(p.x - L) / U, VIEW.max - (p.y - T) / U]
  }
  const capture = (e: PointerEvent) => {
    const el = ref.current
    if (el && typeof el.setPointerCapture === 'function') el.setPointerCapture(e.pointerId)
  }
  return { ref, at, capture }
}

// ---------------------------------------------------------------------------
// The drawing.

function Axes() {
  const ticks = Array.from({ length: VIEW.max + 1 }, (_, i) => i)
  return (
    <g aria-hidden="true">
      <rect x={sx(0)} y={sy(VIEW.max)} width={SIZE} height={SIZE} fill={PANEL} />
      <g stroke={SLATE} strokeOpacity={0.22} strokeWidth={1}>
        {ticks.slice(1).map((t) => (
          <g key={t}>
            <line x1={sx(t)} y1={sy(0)} x2={sx(t)} y2={sy(VIEW.max)} />
            <line x1={sx(0)} y1={sy(t)} x2={sx(VIEW.max)} y2={sy(t)} />
          </g>
        ))}
      </g>
      <g stroke={INK} strokeWidth={2.25} strokeLinecap="round">
        <line x1={sx(0)} y1={sy(0)} x2={sx(VIEW.max) + 8} y2={sy(0)} />
        <line x1={sx(0)} y1={sy(0)} x2={sx(0)} y2={sy(VIEW.max) - 8} />
      </g>
      <path d={`M ${sx(VIEW.max) + 15} ${sy(0)} l -9 -4.5 v 9 z M ${sx(0)} ${sy(VIEW.max) - 15} l -4.5 9 h 9 z`} fill={INK} />
      <text x={sx(0) + 10} y={17} textAnchor="start" fontSize={12} fontWeight={800} fill={INK}>Price ($)</text>
      <text x={sx(VIEW.max)} y={H - 6} textAnchor="end" fontSize={12} fontWeight={800} fill={INK}>Quantity</text>
      <g fontSize={12} fontWeight={600} fill={SLATE}>
        {ticks.map((t) => <text key={`q${t}`} x={sx(t)} y={sy(0) + 16} textAnchor="middle">{t}</text>)}
        {ticks.slice(1).map((t) => <text key={`p${t}`} x={sx(0) - 7} y={sy(t) + 4} textAnchor="end">{t}</text>)}
      </g>
    </g>
  )
}

/** A dashed line from a point down to the quantity axis, and across to the price axis unless told not to. */
function DropLines({ at, colour, across = true }: { at: Pt; colour: string; across?: boolean }) {
  return (
    <g stroke={colour} strokeWidth={1.5} strokeDasharray="4 4" aria-hidden="true">
      <line x1={sx(at[0])} y1={sy(at[1])} x2={sx(at[0])} y2={sy(0)} />
      {across && <line x1={sx(at[0])} y1={sy(at[1])} x2={sx(0)} y2={sy(at[1])} />}
    </g>
  )
}

function Dot({ at, fill, r = 5 }: { at: Pt; fill: string; r?: number }) {
  return <circle cx={sx(at[0])} cy={sy(at[1])} r={r} fill={fill} stroke={PANEL} strokeWidth={2} aria-hidden="true" />
}

/** A curve's label at its right-hand end: beside it on the right edge, just inside the top or bottom otherwise. */
function CurveLabel({ curve, shift, text, faded }: { curve: Curve; shift: number; text: string; faded?: boolean }) {
  const seg = segment(curve, shift)
  if (!seg) return null
  const [q, p] = seg[1]
  const onRight = q >= VIEW.max
  const x = onRight ? sx(q) + 6 : sx(q) + 4
  const y = onRight ? sy(p) + 5 : curve === 'demand' ? sy(p) - 7 : sy(p) + 14
  return (
    <text x={x} y={y} fontSize={13} fontWeight={800} fontStyle="italic" fill={INKS[curve]} opacity={faded ? 0.7 : 1} {...HALO} aria-hidden="true">
      {text}
    </text>
  )
}

function CurveLine({ curve, shift, faded }: { curve: Curve; shift: number; faded?: boolean }) {
  const seg = segment(curve, shift)
  if (!seg) return null
  return (
    <line
      x1={sx(seg[0][0])} y1={sy(seg[0][1])} x2={sx(seg[1][0])} y2={sy(seg[1][1])}
      stroke={INKS[curve]} strokeWidth={faded ? 2 : 3.25} strokeLinecap="round"
      strokeDasharray={faded ? '6 5' : undefined} opacity={faded ? 0.6 : 1} aria-hidden="true"
    />
  )
}

/** A small arrow along a price from where a curve was to where it is now. */
function MoveArrow({ curve, shift }: { curve: Curve; shift: number }) {
  if (shift === 0) return null
  const p = HANDLE_PRICE[curve]
  const from = handleAt(curve, 0)[0]
  const to = handleAt(curve, shift)[0]
  const dir = Math.sign(to - from)
  const x1 = sx(from) + dir * 5
  const x2 = sx(to) - dir * 13
  const y = sy(p) + (curve === 'demand' ? -13 : 13)
  return (
    <g stroke={INKS[curve]} fill={INKS[curve]} strokeWidth={2} aria-hidden="true">
      <line x1={x1} y1={y} x2={x2} y2={y} />
      <path d={`M ${x2 + dir * 6} ${y} l ${-dir * 7} -4 v 8 z`} />
    </g>
  )
}

function Verdict({ marked, children }: { marked: SceneMarked; children: ReactNode }) {
  if (marked === 'idle') return null
  return <p role="status" className="max-w-[350px] text-center text-[13px] font-extrabold leading-snug text-ss-ink">{children}</p>
}

function EventCard({ children, note }: { children: ReactNode; note?: string }) {
  return (
    <div className="w-full max-w-[350px] rounded-xl border border-ss-line bg-ss-chip px-3 py-2">
      <p className="text-[12px] font-bold text-ss-slate">What happens in the market</p>
      <p className="text-[14px] font-extrabold leading-snug text-ss-ink">{children}</p>
      {note && <p className="text-[12px] font-semibold leading-snug text-ss-slate">{note}</p>}
    </div>
  )
}

type Props = SceneViewProps<SupplyDemandConfig, SupplyDemandState>

// ---------------------------------------------------------------------------
// shift: the event, and two curves the learner can move sideways.

/** A curve the learner moves: drag it sideways, or Tab to it and use the arrow keys. */
function CurveSlider({ curve, shift, locked, onShift, onGrab }: {
  curve: Curve; shift: number; locked: boolean; onShift(next: number): void; onGrab(e: PointerEvent): void
}) {
  const [focused, setFocused] = useState(false)
  const seg = segment(curve, shift)
  const [hq, hp] = handleAt(curve, shift)
  const onKey = (e: KeyboardEvent) => {
    const step = ({ ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 } as Record<string, number>)[e.key]
    if (step === undefined && e.key !== 'Home') return
    // The board moves a selected card with the arrows; here they move the curve.
    e.preventDefault()
    e.stopPropagation()
    if (locked) return
    onShift(e.key === 'Home' ? 0 : clamp(shift + step * VIEW.notch, -VIEW.maxShift, VIEW.maxShift))
  }
  const name = curve === 'demand' ? 'The demand curve' : 'The supply curve'
  return (
    <g
      role="slider"
      tabIndex={locked ? -1 : 0}
      aria-label={`${name}. Drag it sideways, or use the arrow keys`}
      aria-valuemin={-VIEW.maxShift}
      aria-valuemax={VIEW.maxShift}
      aria-valuenow={shift}
      aria-valuetext={howFar(shift)}
      aria-disabled={locked || undefined}
      onKeyDown={onKey}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onPointerDown={(e) => { if (!locked) onGrab(e) }}
      className={`outline-none focus-visible:outline-none ${locked ? '' : 'cursor-ew-resize'}`}
    >
      {seg && focused && (
        <line x1={sx(seg[0][0])} y1={sy(seg[0][1])} x2={sx(seg[1][0])} y2={sy(seg[1][1])} stroke="var(--subject)" strokeWidth={9} strokeLinecap="round" opacity={0.45} />
      )}
      <CurveLine curve={curve} shift={shift} />
      {seg && <line x1={sx(seg[0][0])} y1={sy(seg[0][1])} x2={sx(seg[1][0])} y2={sy(seg[1][1])} stroke="transparent" strokeWidth={24} strokeLinecap="round" />}
      {!locked && (
        <g transform={`translate(${sx(hq)} ${sy(hp)})`}>
          <circle r={16} fill="transparent" />
          {focused && <circle r={13} fill="none" stroke="var(--subject)" strokeWidth={3} />}
          <circle r={9} fill={PANEL} stroke={INKS[curve]} strokeWidth={2.5} />
          <path d="M -5.5 0 h 11 M -5.5 0 l 3 -3 M -5.5 0 l 3 3 M 5.5 0 l -3 -3 M 5.5 0 l -3 3" stroke={INKS[curve]} strokeWidth={1.6} strokeLinecap="round" fill="none" />
        </g>
      )}
    </g>
  )
}

function ShiftScene({ config, state, setState, marked, locked }: Props) {
  const task = config.task as ShiftTask
  const event = eventOf(task.event)
  const d = readShift(state?.demand) ?? 0
  const s = readShift(state?.supply) ?? 0
  const grid = useGridPointer()
  const [drag, setDrag] = useState<{ curve: Curve; from: number; start: number } | null>(null)

  const move = (curve: Curve, next: number) => {
    if (locked || next === (curve === 'demand' ? d : s)) return
    setState({ demand: curve === 'demand' ? next : d, supply: curve === 'supply' ? next : s })
  }
  const grab = (curve: Curve) => (e: PointerEvent) => {
    const p = grid.at(e)
    if (!p) return
    grid.capture(e)
    setDrag({ curve, from: p[0], start: curve === 'demand' ? d : s })
  }

  const before = equilibrium(0, 0)
  const after = equilibrium(d, s)
  const moved = d !== 0 || s !== 0
  const named = marked === 'right' || marked === 'shown'
  const said = moved
    ? `Demand ${howFar(d)}, supply ${howFar(s)}. The curves now cross at a price of ${money(after.price)} and a quantity of ${after.quantity}, where they crossed at ${money(before.price)} and ${before.quantity}.`
    : `Neither curve has moved. The curves cross at a price of ${money(before.price)} and a quantity of ${before.quantity}.`

  return (
    <>
      <EventCard note={event.note}>{sentenceCase(event.text)}</EventCard>
      {!locked && <p className="text-[12px] font-semibold text-ss-slate">Drag the curve this moves sideways, or Tab to it and use the arrow keys.</p>}
      <svg
        ref={grid.ref}
        viewBox={`0 0 ${W} ${H}`}
        className="block w-full max-w-[348px] touch-none select-none"
        role="group"
        aria-label="A market diagram: price up the side, quantity along the bottom, with a demand curve and a supply curve"
        onPointerMove={(e) => {
          if (!drag) return
          const p = grid.at(e)
          if (p) move(drag.curve, clamp(Math.round((drag.start + p[0] - drag.from) / VIEW.notch) * VIEW.notch, -VIEW.maxShift, VIEW.maxShift))
        }}
        onPointerUp={() => setDrag(null)}
        onPointerCancel={() => setDrag(null)}
      >
        <Axes />
        {/* Where the curves were, once moved. */}
        {d !== 0 && <CurveLine curve="demand" shift={0} faded />}
        {s !== 0 && <CurveLine curve="supply" shift={0} faded />}
        <DropLines at={[before.quantity, before.price]} colour={SLATE} />
        {moved && <DropLines at={[after.quantity, after.price]} colour={INK} />}
        <MoveArrow curve="demand" shift={d} />
        <MoveArrow curve="supply" shift={s} />
        <CurveLabel curve="demand" shift={0} text={d !== 0 ? 'D1' : 'D'} faded={d !== 0} />
        <CurveLabel curve="supply" shift={0} text={s !== 0 ? 'S1' : 'S'} faded={s !== 0} />
        {d !== 0 && <CurveLabel curve="demand" shift={d} text="D2" />}
        {s !== 0 && <CurveLabel curve="supply" shift={s} text="S2" />}
        <CurveSlider curve="demand" shift={d} locked={locked} onShift={(n) => move('demand', n)} onGrab={grab('demand')} />
        <CurveSlider curve="supply" shift={s} locked={locked} onShift={(n) => move('supply', n)} onGrab={grab('supply')} />
        <Dot at={[before.quantity, before.price]} fill={moved ? SLATE : INK} />
        {moved && <Dot at={[after.quantity, after.price]} fill={INK} r={6} />}
      </svg>
      <div className="flex flex-wrap justify-center gap-2 text-[13px] font-bold tabular-nums text-ss-ink" aria-hidden="true">
        <span className="rounded-lg bg-ss-chip px-2.5 py-1">Price {money(before.price)}{moved && after.price !== before.price && ` → ${money(after.price)}`}</span>
        <span className="rounded-lg bg-ss-chip px-2.5 py-1">Quantity {before.quantity}{moved && after.quantity !== before.quantity && ` → ${after.quantity}`}</span>
      </div>
      <p className="sr-only" aria-live="polite">{said}</p>
      <Verdict marked={marked}>{named ? namedShift(config, state) : madeShift(config, state)}</Verdict>
    </>
  )
}

// ---------------------------------------------------------------------------
// price-control: the government's price, a line the learner sets, and what they say happens there.

function ControlScene({ config, state, setState, marked, locked }: Props) {
  const task = config.task as ControlTask
  const level = controlPrice(task)
  const base = equilibrium(0, 0)
  const price = readPrice(state?.price) ?? base.price
  const answer = state?.answer === 'shortage' || state?.answer === 'surplus' || state?.answer === 'none' ? state.answer : null
  const size = typeof state?.size === 'number' && Number.isInteger(state.size) ? clamp(state.size, 0, VIEW.max) : 0
  const grid = useGridPointer()
  const id = useId()
  const [down, setDown] = useState(false)
  const [focused, setFocused] = useState(false)

  const update = (next: Partial<SupplyDemandState>) => {
    if (locked) return
    setState({ price, answer, size, ...next })
  }
  const setPrice = (p: number) => {
    const next = clamp(Math.round(p), 0, VIEW.max)
    if (next !== price) update({ price: next })
  }
  const onKey = (e: KeyboardEvent) => {
    const step = ({ ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 2, PageDown: -2 } as Record<string, number>)[e.key]
    if (step === undefined) return
    // The board moves a selected card with the arrows; here they move the price line.
    e.preventDefault()
    e.stopPropagation()
    if (!locked) setPrice(price + step)
  }

  const qd = quantityDemanded(price)
  const qs = quantitySupplied(price)
  const onGrid = (q: number) => q >= 0 && q <= VIEW.max
  const named = marked === 'right' || marked === 'shown'
  const outcome = controlOutcome(task)
  const label = task.control === 'maximum' ? 'Maximum price' : 'Minimum price'
  const labelY = price >= VIEW.max - 0.5 ? sy(price) + 16 : sy(price) - 7
  const gap = named && outcome.binds ? ([Math.min(outcome.demanded, outcome.supplied), Math.max(outcome.demanded, outcome.supplied)] as const) : null
  const said = `The ${label.toLowerCase()} line is at ${money(price)}. At ${money(price)} the demand curve is at a quantity of ${qd} and the supply curve at ${qs}. The curves cross at ${money(base.price)}.`

  return (
    <>
      <EventCard>The government sets a {task.control} price of {money(level)}.</EventCard>
      {!locked && <p className="max-w-[350px] text-center text-[12px] font-semibold text-ss-slate">Drag the price line to {money(level)}, or Tab to it and use the arrow keys. Then say what happens there.</p>}
      <svg
        ref={grid.ref}
        viewBox={`0 0 ${W} ${H}`}
        className="block w-full max-w-[348px] touch-none select-none"
        role="group"
        aria-label="A market diagram: price up the side, quantity along the bottom, with a demand curve, a supply curve and a price line"
        onPointerMove={(e) => {
          if (!down) return
          const p = grid.at(e)
          if (p) setPrice(p[1])
        }}
        onPointerUp={() => setDown(false)}
        onPointerCancel={() => setDown(false)}
      >
        <Axes />
        {/* Anywhere on the grid moves the line there, for a finger as much as a mouse. */}
        <rect
          x={sx(0)} y={sy(VIEW.max)} width={SIZE} height={SIZE} fill="transparent" aria-hidden="true"
          className={locked ? '' : 'cursor-ns-resize'}
          onPointerDown={(e) => {
            if (locked) return
            const p = grid.at(e)
            grid.capture(e)
            setDown(true)
            if (p) setPrice(p[1])
          }}
        />
        <g pointerEvents="none">
          <DropLines at={[base.quantity, base.price]} colour={SLATE} />
          <CurveLine curve="demand" shift={0} />
          <CurveLine curve="supply" shift={0} />
          <CurveLabel curve="demand" shift={0} text="D" />
          <CurveLabel curve="supply" shift={0} text="S" />
          <Dot at={[base.quantity, base.price]} fill={named && !outcome.binds ? 'var(--ss-good)' : SLATE} r={named && !outcome.binds ? 7 : 5} />
          {onGrid(qd) && <DropLines at={[qd, price]} colour={INKS.demand} across={false} />}
          {onGrid(qs) && <DropLines at={[qs, price]} colour={INKS.supply} across={false} />}
          {onGrid(qd) && <Dot at={[qd, price]} fill={INKS.demand} />}
          {onGrid(qs) && <Dot at={[qs, price]} fill={INKS.supply} />}
          {gap && (
            <g aria-hidden="true">
              <path d={`M ${sx(gap[0])} ${sy(price) + 8} v 6 H ${sx(gap[1])} v -6`} fill="none" stroke={INK} strokeWidth={2} />
              <text x={(sx(gap[0]) + sx(gap[1])) / 2} y={sy(price) + 28} textAnchor="middle" fontSize={12} fontWeight={800} fill={INK} {...HALO}>
                {sentenceCase(outcome.answer)} of {outcome.size}
              </text>
            </g>
          )}
          {named && !outcome.binds && (
            <text x={sx(base.quantity) + 10} y={sy(base.price) + (task.side === 'above' ? 18 : -10)} fontSize={12} fontWeight={800} fill={INK} {...HALO} aria-hidden="true">
              The price stays at {money(base.price)}
            </text>
          )}
        </g>
        {/* The government's price: a line across the grid. */}
        <g
          role="slider"
          tabIndex={locked ? -1 : 0}
          aria-label={`The ${label.toLowerCase()} line. Drag it up or down, or use the arrow keys`}
          aria-valuemin={0}
          aria-valuemax={VIEW.max}
          aria-valuenow={price}
          aria-valuetext={money(price)}
          aria-disabled={locked || undefined}
          onKeyDown={onKey}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onPointerDown={(e) => {
            if (locked) return
            grid.capture(e)
            setDown(true)
          }}
          className={`outline-none focus-visible:outline-none ${locked ? '' : 'cursor-ns-resize'}`}
        >
          {focused && <line x1={sx(0)} y1={sy(price)} x2={sx(VIEW.max)} y2={sy(price)} stroke="var(--subject)" strokeWidth={9} opacity={0.45} />}
          <line
            x1={sx(0)} y1={sy(price)} x2={sx(VIEW.max)} y2={sy(price)} stroke={INKS.control} strokeWidth={3}
            strokeDasharray={named && !outcome.binds ? '7 5' : undefined}
          />
          <line x1={sx(0)} y1={sy(price)} x2={sx(VIEW.max) + 24} y2={sy(price)} stroke="transparent" strokeWidth={22} />
          <text x={sx(0) + 6} y={labelY} fontSize={12} fontWeight={800} fill={INKS.control} {...HALO}>{label}</text>
          {!locked && (
            <g transform={`translate(${sx(VIEW.max) + 16} ${sy(price)})`}>
              {focused && <circle r={13} fill="none" stroke="var(--subject)" strokeWidth={3} />}
              <circle r={9} fill={PANEL} stroke={INKS.control} strokeWidth={2.5} />
              <path d="M 0 -5.5 v 11 M 0 -5.5 l -3 3 M 0 -5.5 l 3 3 M 0 5.5 l -3 -3 M 0 5.5 l 3 -3" stroke={INKS.control} strokeWidth={1.6} strokeLinecap="round" fill="none" />
            </g>
          )}
        </g>
      </svg>
      <p className="sr-only" aria-live="polite">{said}</p>

      <div className="flex w-full max-w-[350px] flex-col items-center gap-2">
        <p id={`${id}-q`} className="text-[12px] font-bold text-ss-slate">At this price, is there a shortage, a surplus, or neither?</p>
        <div role="group" aria-labelledby={`${id}-q`} className="grid w-full grid-cols-3 gap-1.5">
          {CHOICES.map(({ id: choice, label: text }) => {
            const on = answer === choice
            return (
              <button
                key={choice}
                type="button"
                aria-pressed={on}
                disabled={locked}
                onClick={() => update({ answer: choice, size: choice === 'none' ? size : Math.max(1, size) })}
                className={`nodrag min-h-[38px] rounded-xl border-2 px-2 text-[13px] font-bold text-ss-ink transition-colors motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-default ${on ? 'bg-ss-chip' : 'border-ss-line hover:bg-ss-chip'}`}
                style={on ? { borderColor: 'var(--subject)' } : undefined}
              >
                {text}
              </button>
            )
          })}
        </div>
        {(answer === 'shortage' || answer === 'surplus') && (
          <div className="flex items-center gap-2">
            <span id={`${id}-size`} className="text-[12px] font-bold text-ss-slate">How many units?</span>
            <button
              type="button"
              aria-label="One unit fewer"
              disabled={locked || size <= 1}
              onClick={() => update({ size: Math.max(1, size - 1) })}
              className="nodrag h-9 w-9 rounded-full border-2 border-ss-line text-[16px] font-extrabold text-ss-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:opacity-40"
            >
              −
            </button>
            <output aria-labelledby={`${id}-size`} aria-live="polite" className="w-8 text-center text-[16px] font-extrabold tabular-nums text-ss-ink">{size}</output>
            <button
              type="button"
              aria-label="One unit more"
              disabled={locked || size >= VIEW.max}
              onClick={() => update({ size: Math.min(VIEW.max, size + 1) })}
              className="nodrag h-9 w-9 rounded-full border-2 border-ss-line text-[16px] font-extrabold text-ss-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:opacity-40"
            >
              +
            </button>
          </div>
        )}
      </div>
      <Verdict marked={marked}>{named ? namedControl(config) : madeControl(config, state)}</Verdict>
    </>
  )
}

/**
 * A market diagram: the event and the two curves the learner moves (shift),
 * or the government's price, its line and what happens there (price-control).
 */
export function SupplyDemandView(props: Props) {
  return (
    <div className={`nodrag flex flex-col items-center gap-2 ${PALETTE}`}>
      {props.config.task.kind === 'shift' ? <ShiftScene {...props} /> : <ControlScene {...props} />}
    </div>
  )
}
