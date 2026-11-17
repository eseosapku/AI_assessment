'use client'
import { useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { SceneViewProps } from '../types'
import type { CircleConfig, CircleState } from './config'
import {
  arcPosition, centreAngleAtC, centrePositions, crossings, fmt, isSolved, markedText, norm,
  readState, semiAngles, tangentAngle,
} from './config'

type Props = SceneViewProps<CircleConfig, CircleState>
type Pt = { x: number; y: number }

// A geometry drawing on paper, not a dark stage. These colours stay fixed in both themes,
// as they do on measure-shape's instrument panel. No gradients, glows or shadows.
const PLATE = '#F8FAFC'
const PAPER = '#FFFFFF'
const EDGE = '#CBD5E1'
const INK = '#263442'
const SOFT = '#526173'
const FAINT = '#D8E0E8'
const BLUE = '#2F72B5'
const BLUE_DARK = '#174D82'
const BLUE_FILL = '#DCEAF7'
const COPPER = '#B76028'
const COPPER_FILL = '#F8E7D8'
const GREEN = '#267451'
const HANDLE = '#1D4ED8'
const FONT = 'system-ui, sans-serif'

// View geometry is written here rather than read from config at module load: the two modules
// import each other (contract rule 41). Tests compare the shared mathematical tolerance.
export const W = 360
export const H = 286
export const CX = 180
export const CY = 132
export const R = 90
export const CENTRE_START_C = -90
export const SEMI_START_B = 90
export const TANGENT_START_DELTA = -20

const TAU = Math.PI * 2
const pt = (deg: number, radius = R): Pt => ({ x: CX + radius * Math.cos(deg * TAU / 360), y: CY + radius * Math.sin(deg * TAU / 360) })
const f = (n: number) => n.toFixed(2).replace(/\.00$/, '')
const line = (a: Pt, b: Pt) => `M ${f(a.x)} ${f(a.y)} L ${f(b.x)} ${f(b.y)}`

/** A circular angle mark, from one ray to the other, drawn as a measured wedge. */
function wedge(vertex: Pt, a: Pt, b: Pt, radius: number, sweep = 0): string {
  const aa = Math.atan2(a.y - vertex.y, a.x - vertex.x)
  const bb = Math.atan2(b.y - vertex.y, b.x - vertex.x)
  const p = { x: vertex.x + radius * Math.cos(aa), y: vertex.y + radius * Math.sin(aa) }
  const q = { x: vertex.x + radius * Math.cos(bb), y: vertex.y + radius * Math.sin(bb) }
  return `M ${f(vertex.x)} ${f(vertex.y)} L ${f(p.x)} ${f(p.y)} A ${radius} ${radius} 0 0 ${sweep} ${f(q.x)} ${f(q.y)} Z`
}

/** The minor or reflex sector from A to B, with its interior facing the movable B. */
function centreWedge(b: number): string {
  const start = 180
  const diff = norm(start - b)
  const large = diff > 180 ? 1 : 0
  const p = pt(start, 24)
  const q = pt(b, 24)
  return `M ${CX} ${CY} L ${f(p.x)} ${f(p.y)} A 24 24 0 ${large} 0 ${f(q.x)} ${f(q.y)} Z`
}

/** Highlight minor arc AB over the top, a thick section of the actual circumference. */
function arcAB(central: number): string {
  const a = pt(-90 - central / 2, R + 1)
  const b = pt(-90 + central / 2, R + 1)
  return `M ${f(a.x)} ${f(a.y)} A ${R + 1} ${R + 1} 0 0 1 ${f(b.x)} ${f(b.y)}`
}

function CircleBase() {
  return (
    <>
      <rect x={0.75} y={0.75} width={W - 1.5} height={H - 1.5} rx={16} fill={PLATE} stroke={EDGE} strokeWidth={1.5} />
      <circle cx={CX} cy={CY} r={R} fill={PAPER} stroke={INK} strokeWidth={2.2} />
      {/* Four quiet registration ticks make this a drafted geometric figure. */}
      <g stroke={EDGE} strokeWidth={1.2}>
        <path d={`M ${CX - 5} ${CY - R - 5} H ${CX + 5} M ${CX} ${CY - R - 10} V ${CY - R}`} />
        <path d={`M ${CX - 5} ${CY + R + 5} H ${CX + 5} M ${CX} ${CY + R} V ${CY + R + 10}`} />
      </g>
    </>
  )
}

function Point({ at, name, dx = 0, dy = -12, colour = INK }: { at: Pt; name: string; dx?: number; dy?: number; colour?: string }) {
  return (
    <g fontFamily={FONT}>
      <circle cx={at.x} cy={at.y} r={4.3} fill={colour} stroke={PAPER} strokeWidth={1.6} />
      <text x={at.x + dx} y={at.y + dy} textAnchor="middle" fontSize={13} fontWeight={800} fill={colour} style={{ fill: colour }} stroke={PLATE} strokeWidth={3} paintOrder="stroke">{name}</text>
    </g>
  )
}

function AngleLabel({ at, text, colour = INK, x, y }: { at?: Pt; text: string; colour?: string; x: number; y: number }) {
  return <text x={x} y={y} textAnchor="middle" fontFamily={FONT} fontSize={12} fontWeight={800} fill={colour} style={{ fill: colour }} stroke={PAPER} strokeWidth={3} paintOrder="stroke">{text}</text>
}

function HandleMark({ at, focused, vertical = false }: { at: Pt; focused: boolean; vertical?: boolean }) {
  return (
    <g transform={`translate(${f(at.x)} ${f(at.y)})`} aria-hidden="true">
      <circle r={23} fill="transparent" />
      {focused && <circle r={17} fill="none" stroke="var(--subject)" strokeWidth={3} />}
      <circle r={11} fill={HANDLE} stroke="#FFFFFF" strokeWidth={2.2} />
      <g transform={`rotate(${vertical ? 90 : 0})`} fill="#FFFFFF">
        <path d="M -5.5 -2.5 L -1.5 -6.5 L 2.5 -2.5 Z M -5.5 2.5 L -1.5 6.5 L 2.5 2.5 Z" />
      </g>
    </g>
  )
}

function Draggable({ id, at, value, min, max, text, step, locked, set, vertical = false }: {
  id: string; at: Pt; value: number; min: number; max: number; text: string; step: number
  locked: boolean; set(next: number): void; vertical?: boolean
}) {
  const [focused, setFocused] = useState(false)
  const svg = useRef<SVGSVGElement | null>(null)
  const dragging = useRef(false)
  const onKey = (e: KeyboardEvent) => {
    const d = ({ ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 5, PageDown: -5 } as Record<string, number>)[e.key]
    if (d === undefined && e.key !== 'Home' && e.key !== 'End') return
    e.preventDefault()
    e.stopPropagation()
    if (locked) return
    set(e.key === 'Home' ? min : e.key === 'End' ? max : Math.max(min, Math.min(max, value + (d ?? 0) * step)))
  }
  return (
    <g
      data-handle={id}
      role="slider"
      tabIndex={locked ? -1 : 0}
      aria-label={`${text}. Drag, or use the arrow keys`}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={Math.round(value)}
      aria-valuetext={`${fmt(value)} degrees`}
      aria-disabled={locked || undefined}
      onKeyDown={onKey}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      className={`outline-none focus-visible:outline-none ${locked ? '' : 'cursor-grab active:cursor-grabbing'}`}
      onPointerDown={(e: PointerEvent<SVGGElement>) => {
        if (locked || e.button !== 0) return
        dragging.current = true
        svg.current = e.currentTarget.ownerSVGElement
        e.currentTarget.setPointerCapture?.(e.pointerId)
      }}
      onPointerMove={(e: PointerEvent<SVGGElement>) => {
        if (!dragging.current || locked || !svg.current) return
        const box = svg.current.getBoundingClientRect()
        const x = ((e.clientX - box.left) / box.width) * W
        const y = ((e.clientY - box.top) / box.height) * H
        // Circle points turn about O; the secant turns about its fixed contact P.
        const pivotY = id === 'tangent' ? CY - R : CY
        let degrees = Math.atan2(y - pivotY, x - CX) * 360 / TAU
        if (degrees > 180) degrees -= 360
        set(Math.round(degrees))
      }}
      onPointerUp={() => { dragging.current = false }}
      onPointerCancel={() => { dragging.current = false }}
    >
      <HandleMark at={at} focused={focused} vertical={vertical} />
    </g>
  )
}

function Steps({ label, value, min, max, step, locked, set }: {
  label: string; value: number; min: number; max: number; step: number; locked: boolean; set(next: number): void
}) {
  const button = 'nodrag flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-lg border-2 border-ss-line bg-ss-panel text-[16px] font-extrabold leading-none text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[12px] font-bold text-ss-slate">{label}</span>
      <span className="flex items-center gap-1">
        <button type="button" aria-label={`${label} anticlockwise`} disabled={locked || value <= min} onClick={() => set(Math.max(min, value - step))} className={button}>↺</button>
        <button type="button" aria-label={`${label} clockwise`} disabled={locked || value >= max} onClick={() => set(Math.min(max, value + step))} className={button}>↻</button>
      </span>
    </div>
  )
}

function Readout({ left, right, second }: { left: string; right: string; second?: [string, string] }) {
  return (
    <div className={`grid ${second ? 'grid-cols-2' : 'grid-cols-1'} gap-x-5 border-t border-ss-line pt-1.5`}>
      <p className="flex items-baseline justify-between gap-2">
        <span className="text-[12px] font-bold text-ss-slate">{left}</span>
        <span className="text-[15px] font-extrabold tabular-nums text-ss-ink">{right}</span>
      </p>
      {second && <p className="flex items-baseline justify-between gap-2">
        <span className="text-[12px] font-bold text-ss-slate">{second[0]}</span>
        <span className="text-[15px] font-extrabold tabular-nums text-ss-ink">{second[1]}</span>
      </p>}
    </div>
  )
}

function CentreDrawing({ config, state, locked, setC }: { config: Extract<CircleConfig, { task: 'centre' }>; state: CircleState; locked: boolean; setC(n: number): void }) {
  const s = readState(config, state)
  const ends = centrePositions(config.central)
  const A = pt(ends.a)
  const B = pt(ends.b)
  const C = pt(s.c)
  const O = { x: CX, y: CY }
  const angleC = centreAngleAtC(config, state)
  const outward = { x: (C.x - CX) / R, y: (C.y - CY) / R }
  const nameAt = { x: C.x + outward.x * 24, y: C.y + outward.y * 24 }
  // Put the angle on the inward side of C, and its name outside: neither can cover the other.
  const angleAt = { x: C.x - outward.x * 28, y: C.y - outward.y * 28 }
  return (
    <>
      <path d={arcAB(config.central)} fill="none" stroke={COPPER} strokeWidth={6} strokeLinecap="round" />
      <g fill="none" stroke={BLUE_DARK} strokeWidth={2.4} strokeLinejoin="round">
        <path d={line(O, A)} /><path d={line(O, B)} />
      </g>
      <g fill="none" stroke={COPPER} strokeWidth={2.4} strokeLinejoin="round">
        <path d={line(C, A)} /><path d={line(C, B)} />
      </g>
      <path d={wedge(O, A, B, 25, 1)} fill={BLUE_FILL} stroke={BLUE_DARK} strokeWidth={1.5} />
      <path d={wedge(C, A, B, 22, norm(Math.atan2(B.y - C.y, B.x - C.x) - Math.atan2(A.y - C.y, A.x - C.x)) <= Math.PI ? 1 : 0)} fill={COPPER_FILL} stroke={COPPER} strokeWidth={1.5} />
      <AngleLabel x={CX} y={CY - 33} text={`${config.central}°`} colour={BLUE_DARK} />
      <AngleLabel x={CX} y={CY + 20} text="O" colour={BLUE_DARK} />
      <AngleLabel x={angleAt.x} y={angleAt.y + 4} text={`${fmt(angleC)}°`} colour={COPPER} />
      <Point at={A} name="A" dx={-15} dy={1} />
      <Point at={B} name="B" dx={15} dy={1} />
      {!locked && <Draggable id="c" at={C} value={s.c > 180 ? s.c - 360 : s.c} min={-180} max={180} text="point C around the circle" step={1} locked={locked} set={setC} />}
      <text x={nameAt.x} y={nameAt.y + 4} textAnchor="middle" fontFamily={FONT} fontSize={12} fontWeight={800} fill={COPPER} style={{ fill: COPPER }} stroke={PLATE} strokeWidth={3} paintOrder="stroke">C</text>
    </>
  )
}

function SemiDrawing({ state, locked, setB }: { state: CircleState; locked: boolean; setB(n: number): void }) {
  const s = readState({ task: 'semicircle' }, state)
  const A = pt(180)
  const B = pt(s.b)
  const C = pt(270)
  const O = { x: CX, y: CY }
  const a = semiAngles(state)
  const good = isSolved({ task: 'semicircle' }, state)
  const diameterEnd = pt(0)
  return (
    <>
      {good && <path d={line(A, diameterEnd)} fill="none" stroke={BLUE} strokeWidth={2} strokeDasharray="5 5" />}
      <g fill="none" stroke={BLUE_DARK} strokeWidth={2.4}><path d={line(O, A)} /><path d={line(O, B)} /></g>
      <g fill="none" stroke={COPPER} strokeWidth={2.6}><path d={line(C, A)} /><path d={line(C, B)} /></g>
      <path d={centreWedge(s.b)} fill={BLUE_FILL} stroke={BLUE_DARK} strokeWidth={1.5} />
      <path d={wedge(C, A, B, 22, 0)} fill={COPPER_FILL} stroke={COPPER} strokeWidth={1.5} />
      <AngleLabel x={CX} y={CY - 33} text={`${fmt(a.centre)}°`} colour={BLUE_DARK} />
      <AngleLabel x={CX + 20} y={CY + 20} text="O" colour={BLUE_DARK} />
      <AngleLabel x={CX + 30} y={CY - R + 34} text={`${fmt(a.atC)}°`} colour={COPPER} />
      <Point at={A} name="A" dx={-15} dy={5} />
      <Point at={C} name="C" dx={-18} dy={-7} colour={COPPER} />
      {!locked && <Draggable id="b" at={B} value={s.b} min={-55} max={150} text="point B around the circle" step={1} locked={locked} set={setB} />}
      <text x={B.x + (B.x >= CX ? 17 : -17)} y={B.y + (Math.abs(B.y - CY) > 65 ? 3 : 19)} textAnchor="middle" fontFamily={FONT} fontSize={12} fontWeight={800} fill={INK} style={{ fill: INK }} stroke={PLATE} strokeWidth={3} paintOrder="stroke">B</text>
      <text x={CX} y={CY + R + 31} textAnchor="middle" fontFamily={FONT} fontSize={12} fontWeight={700} fill={SOFT} style={{ fill: SOFT }}>A and C stay fixed</text>
    </>
  )
}

/** Exact second intersection and a clipped, handle-carrying segment of the rotating line. */
export function tangentPoints(delta: number): { P: Pt; Q: Pt; handle: Pt; endA: Pt; endB: Pt } {
  const P = { x: CX, y: CY - R }
  const angle = delta * TAU / 360
  const dir = { x: Math.cos(angle), y: Math.sin(angle) }
  // (t cos d)^2 + (-R + t sin d)^2 = R^2  =>  t = 2R sin d.
  const t = 2 * R * Math.sin(angle)
  const Q = { x: P.x + t * dir.x, y: P.y + t * dir.y }
  const at = (k: number) => ({ x: P.x + k * dir.x, y: P.y + k * dir.y })
  // A finite ruler-like line, clipped to the paper. Every allowed Q stays on the circle.
  const reach = (sign: number) => {
    const dx = dir.x * sign
    const dy = dir.y * sign
    const tx = dx > 0 ? (W - 24 - P.x) / dx : dx < 0 ? (24 - P.x) / dx : Infinity
    const ty = dy > 0 ? (H - 45 - P.y) / dy : dy < 0 ? (22 - P.y) / dy : Infinity
    return Math.max(0, Math.min(tx, ty))
  }
  const forward = reach(1)
  const back = reach(-1)
  // Hold the side away from Q: the second crossing stays visible even at the range ends.
  const handle = delta > 0.5 ? at(-Math.min(104, back - 15)) : at(Math.min(112, forward - 15))
  return { P, Q, handle, endA: at(-back), endB: at(forward) }
}

function TangentDrawing({ state, locked, setDelta }: { state: CircleState; locked: boolean; setDelta(n: number): void }) {
  const s = readState({ task: 'tangent' }, state)
  const { P, Q, handle, endA, endB } = tangentPoints(s.delta)
  const O = { x: CX, y: CY }
  const near = Math.abs(s.delta) <= 4
  const angle = tangentAngle(state)
  const count = crossings(state)
  const qBelow = Q.y > CY + 25
  return (
    <>
      <path d={line(O, P)} stroke={BLUE_DARK} strokeWidth={3} />
      <path d={line(endA, endB)} stroke={COPPER} strokeWidth={3} strokeLinecap="round" />
      {/* A genuine right-angle square when it is square, a measured wedge while turning. */}
      {near ? (
        <path d={`M ${CX + 15} ${CY - R} L ${CX + 15} ${CY - R + 15} L ${CX} ${CY - R + 15}`} fill="none" stroke={GREEN} strokeWidth={2.3} />
      ) : (
        <path d={wedge(P, O, s.delta < 0 ? endA : endB, 24, s.delta < 0 ? 1 : 0)} fill={COPPER_FILL} stroke={COPPER} strokeWidth={1.5} />
      )}
      <AngleLabel x={CX + 34} y={CY - R + 38} text={`${fmt(angle)}°`} colour={near ? GREEN : COPPER} />
      <Point at={O} name="O" dx={0} dy={20} colour={BLUE_DARK} />
      <Point at={P} name="P" dx={-16} dy={-3} />
      {count === 2 && <Point at={Q} name="Q" dx={Q.x < CX ? -14 : 14} dy={qBelow ? 17 : -9} colour={COPPER} />}
      <text x={CX - 28} y={CY - R / 2 + 4} textAnchor="end" fontFamily={FONT} fontSize={12} fontWeight={700} fill={BLUE_DARK} style={{ fill: BLUE_DARK }}>radius</text>
      {!locked && <Draggable id="tangent" at={handle} value={s.delta} min={-35} max={35} text="the line around P" step={1} locked={locked} set={setDelta} vertical />}
      {locked && <circle cx={handle.x} cy={handle.y} r={5} fill={COPPER} />}
      <text x={CX} y={CY + R + 31} textAnchor="middle" fontFamily={FONT} fontSize={12} fontWeight={700} fill={SOFT} style={{ fill: SOFT }}>The line turns about P</text>
    </>
  )
}

export function CircleTheoremsView({ config, state: raw, setState, marked, reduced, locked }: Props) {
  const id = useId()
  const state = marked === 'shown' ? (config.task === 'centre' ? { c: 90 } : config.task === 'semicircle' ? { b: 0 } : { delta: 0 }) : raw
  const s = readState(config, state)
  const live = !locked && marked !== 'right' && marked !== 'shown'
  const put = (part: CircleState) => { if (live) setState({ ...state, ...part }) }
  const setC = (n: number) => put({ c: norm(n) })
  const setB = (n: number) => put({ b: Math.max(-55, Math.min(150, n)) })
  const setDelta = (n: number) => put({ delta: Math.max(-35, Math.min(35, n)) })

  const description = config.task === 'centre'
    ? `Circle with centre O. Fixed radii OA and OB make ${config.central} degrees. The minor arc AB is highlighted. Point C can move around the circle; the angle ACB is ${fmt(centreAngleAtC(config, state))} degrees. C is on the ${arcPosition(config, state) <= config.central ? 'highlighted' : 'other'} arc.`
    : config.task === 'semicircle'
      ? `Circle with fixed points A and C and movable B. OA and OB make ${fmt(semiAngles(state).centre)} degrees; angle ACB is ${fmt(semiAngles(state).atC)} degrees. ${isSolved(config, state) ? 'AB passes through O.' : 'AB does not pass through O.'}`
      : `Circle with radius OP. A line through P turns around it. The angle between the line and radius is ${fmt(tangentAngle(state))} degrees, with ${crossings(state)} ${crossings(state) === 1 ? 'crossing' : 'crossings'} of the circle.`

  const caption = config.task === 'centre' ? 'Move C round the circle: the angle at O stays the same.' : config.task === 'semicircle' ? 'Move B: make AB pass through O.' : 'Turn the line: watch Q move towards P.'
  const said = marked === 'idle' ? '' : markedText(config, state, marked)
  const value = config.task === 'centre' ? (s.c > 180 ? s.c - 360 : s.c) : config.task === 'semicircle' ? s.b : s.delta

  return (
    <div className="nodrag flex w-full max-w-[360px] flex-col gap-2" onKeyDown={(e) => { if (e.key.startsWith('Arrow')) e.stopPropagation() }}>
      <figure className="m-0 flex w-full flex-col gap-1">
        <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label={description} aria-describedby={`${id}-caption`} className={`block h-auto w-full select-none ${live ? 'touch-none' : ''}`}>
          <CircleBase />
          {config.task === 'centre' && <CentreDrawing config={config} state={state} locked={!live} setC={setC} />}
          {config.task === 'semicircle' && <SemiDrawing state={state} locked={!live} setB={setB} />}
          {config.task === 'tangent' && <TangentDrawing state={state} locked={!live} setDelta={setDelta} />}
        </svg>
        <figcaption id={`${id}-caption`} className="text-center text-[12px] font-bold text-ss-slate">{caption}</figcaption>
      </figure>

      {config.task === 'centre' ? (
        <Readout left="Angle at O" right={`${config.central}°`} second={['Angle at C', `${fmt(centreAngleAtC(config, state))}°`]} />
      ) : config.task === 'semicircle' ? (
        <Readout left="Angle at O" right={`${fmt(semiAngles(state).centre)}°`} second={['Angle at C', `${fmt(semiAngles(state).atC)}°`]} />
      ) : (
        <Readout left="Angle at P" right={`${fmt(tangentAngle(state))}°`} second={['Circle crossings', String(crossings(state))]} />
      )}

      {live && (
        <Steps
          label={config.task === 'centre' ? 'Move C' : config.task === 'semicircle' ? 'Move B' : 'Turn line'}
          value={value}
          min={config.task === 'centre' ? -180 : config.task === 'semicircle' ? -55 : -35}
          max={config.task === 'centre' ? 180 : config.task === 'semicircle' ? 150 : 35}
          step={config.task === 'tangent' ? 5 : 10}
          locked={!live}
          set={config.task === 'centre' ? setC : config.task === 'semicircle' ? setB : setDelta}
        />
      )}
      <p className="sr-only" aria-live="polite">{description}</p>
      {marked !== 'idle' && (
        <div className="rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2" aria-live="polite">
          <p className="text-[13px] font-extrabold leading-snug text-ss-ink">{said}</p>
        </div>
      )}
      {/* reduced is deliberately not used to freeze the drawing: every state is already a still,
          and only direct pointer/keyboard actions change it, so reduced motion loses nothing. */}
      <span className="hidden" data-reduced={reduced ? '1' : '0'} />
    </div>
  )
}
