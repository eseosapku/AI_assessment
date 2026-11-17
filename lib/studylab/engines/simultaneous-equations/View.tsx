'use client'
import { useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode, type RefObject } from 'react'
import type { SceneMarked, SceneViewProps } from '../types'
import type { Equation, SimConfig, SimState } from './config'
import {
  combine, eliminationSentence, equationText, graphSentence, num, readState, solutionOf,
} from './config'

type Props = SceneViewProps<SimConfig, SimState>

// A quiet paper panel in both themes, as in measure-shape. All colours are flat.
const PAPER = '#F8FAFC'
const EDGE = '#CBD5E1'
const GRID_LINE = '#E2E8F0'
const INK = '#334155'
const SOFT = '#64748B'
const BLUE = '#3979A8'
const TEAL = '#2F857C'
const ORANGE = '#C66A2B'
const WHITE = '#FFFFFF'

// Literals, not top-level reads of config constants: the two modules import each other.
export const W = 360
export const H = 252
export const RANGE = 5
export const ORIGIN_X = 190
export const ORIGIN_Y = 128
export const UNIT = 19
export const MAX_MULT = 6

export const sx = (x: number) => ORIGIN_X + UNIT * x
export const sy = (y: number) => ORIGIN_Y - UNIT * y
const clampGrid = (v: number) => Math.max(-RANGE, Math.min(RANGE, v))
const signed = (n: number) => `${n < 0 ? '−' : '+'} ${num(Math.abs(n))}`

/** Clip a line to the square grid, then map it to the SVG. */
export function lineEnds(e: Equation): [[number, number], [number, number]] | null {
  if (e.a === 0 && e.b === 0) return null
  const pts: [number, number][] = []
  const add = (x: number, y: number) => {
    if (Math.abs(x) <= RANGE + 1e-7 && Math.abs(y) <= RANGE + 1e-7 && !pts.some((p) => Math.abs(p[0] - x) < 1e-6 && Math.abs(p[1] - y) < 1e-6)) pts.push([x, y])
  }
  if (e.b !== 0) for (const x of [-RANGE, RANGE]) add(x, (e.c - e.a * x) / e.b)
  if (e.a !== 0) for (const y of [-RANGE, RANGE]) add((e.c - e.b * y) / e.a, y)
  // Near-vertical or horizontal lines meet only two sides; this also covers a line through a corner.
  if (pts.length < 2 && e.a !== 0 && e.b !== 0) {
    for (const x of [-RANGE, RANGE]) for (const y of [-RANGE, RANGE]) add(x, (e.c - e.a * x) / e.b)
  }
  return pts.length >= 2 ? [pts[0], pts[1]] : null
}

function EquationLine({ equation, colour, dashed = false, data, reduced = false }: { equation: Equation; colour: string; dashed?: boolean; data?: string; reduced?: boolean }) {
  const ends = lineEnds(equation)
  if (!ends) return null
  return <line data-line={data} x1={sx(ends[0][0])} y1={sy(ends[0][1])} x2={sx(ends[1][0])} y2={sy(ends[1][1])} stroke={colour} strokeWidth={3} strokeLinecap="round" strokeDasharray={dashed ? '7 5' : undefined} style={reduced ? undefined : { transition: 'x1 600ms ease, x2 600ms ease, y1 600ms ease, y2 600ms ease' }} />
}

function GraphPaper({ children, svgRef, onPointerMove, onPointerUp, label }: {
  children: ReactNode
  svgRef?: RefObject<SVGSVGElement>
  onPointerMove?: (e: PointerEvent<SVGSVGElement>) => void
  onPointerUp?: () => void
  label: string
}) {
  const ticks = Array.from({ length: 11 }, (_, i) => i - RANGE)
  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full touch-none select-none" role="group" aria-label={label}
      onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
      <rect x={0.75} y={0.75} width={W - 1.5} height={H - 1.5} rx={15} fill={PAPER} stroke={EDGE} strokeWidth={1.5} />
      <g aria-hidden="true">
        {ticks.map((t) => <g key={t} stroke={GRID_LINE} strokeWidth={1}>
          <line x1={sx(t)} y1={19} x2={sx(t)} y2={237} />
          <line x1={80} y1={sy(t)} x2={300} y2={sy(t)} />
        </g>)}
        <rect x={80} y={19} width={220} height={218} fill="none" stroke={EDGE} strokeWidth={1} />
        <g stroke={INK} strokeWidth={1.7} strokeLinecap="round">
          <line x1={76} y1={ORIGIN_Y} x2={307} y2={ORIGIN_Y} />
          <line x1={ORIGIN_X} y1={241} x2={ORIGIN_X} y2={13} />
        </g>
        <path d={`M 309 128 l -7 -4 v 8 z M 190 10 l -4 7 h 8 z`} fill={INK} />
        <text x={310} y={121} fontSize={13} fontWeight={700} fontStyle="italic" fill={INK}>x</text>
        <text x={197} y={17} fontSize={13} fontWeight={700} fontStyle="italic" fill={INK}>y</text>
        <g fontSize={12} fontWeight={600} fill={SOFT} stroke={PAPER} strokeWidth={3} paintOrder="stroke" strokeLinejoin="round">
          {ticks.filter((t) => t !== 0).map((t) => <g key={t}>
            <text x={sx(t)} y={146} textAnchor="middle">{num(t)}</text>
            <text x={180} y={sy(t) + 4} textAnchor="end">{num(t)}</text>
          </g>)}
          <text x={180} y={122} textAnchor="end">0</text>
        </g>
      </g>
      {children}
    </svg>
  )
}

const STEP = 'nodrag flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-lg border-2 border-ss-line bg-ss-panel text-[16px] font-extrabold leading-none text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'

function Multiplier({ name, value, set, locked }: { name: string; value: number; set: (n: number) => void; locked: boolean }) {
  const onKey = (e: KeyboardEvent) => {
    const by = ({ ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 2, PageDown: -2 } as Record<string, number>)[e.key]
    if (by === undefined && e.key !== 'Home' && e.key !== 'End') return
    e.preventDefault()
    e.stopPropagation()
    set(e.key === 'Home' ? -MAX_MULT : e.key === 'End' ? MAX_MULT : value + by)
  }
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[12px] font-bold text-ss-slate">{name}</span>
      <span className="flex items-center gap-1">
        <button type="button" aria-label={`Decrease ${name}`} disabled={locked || value <= -MAX_MULT} onClick={() => set(value - 1)} className={STEP}>−</button>
        <span role="spinbutton" tabIndex={locked ? -1 : 0} aria-label={name} aria-valuemin={-MAX_MULT} aria-valuemax={MAX_MULT} aria-valuenow={value} aria-valuetext={`${value} times`} aria-disabled={locked || undefined} onKeyDown={onKey}
          className="nodrag min-w-[30px] rounded-md px-0.5 text-center text-[15px] font-extrabold tabular-nums text-ss-ink outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--subject)]">{num(value)}</span>
        <button type="button" aria-label={`Increase ${name}`} disabled={locked || value >= MAX_MULT} onClick={() => set(value + 1)} className={STEP}>+</button>
      </span>
    </div>
  )
}

function EquationRow({ colour, children }: { colour: string; children: ReactNode }) {
  return <p className="flex min-w-0 items-center gap-2 text-[13px] font-bold leading-snug text-ss-ink">
    <svg viewBox="0 0 24 8" className="h-2 w-6 shrink-0" aria-hidden="true"><line x1={1} x2={23} y1={4} y2={4} stroke={colour} strokeWidth={3} strokeLinecap="round" /></svg>
    <span className="whitespace-nowrap tabular-nums">{children}</span>
  </p>
}

function Verdict({ marked, text }: { marked: SceneMarked; text: string }) {
  if (marked === 'idle') return null
  return <p className="w-full rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2 text-[13px] font-extrabold leading-snug text-ss-ink" aria-live="polite">{text}</p>
}

function usePoint(svgRef: RefObject<SVGSVGElement | null>) {
  return (e: PointerEvent): [number, number] | null => {
    const m = svgRef.current?.getScreenCTM()
    if (!m) return null
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse())
    return [clampGrid(Math.round((p.x - ORIGIN_X) / UNIT)), clampGrid(Math.round((ORIGIN_Y - p.y) / UNIT))]
  }
}

function Ring({ point, colour = ORANGE }: { point: [number, number]; colour?: string }) {
  return <g transform={`translate(${sx(point[0])} ${sy(point[1])})`} pointerEvents="none" aria-hidden="true">
    <circle r={11} fill={WHITE} fillOpacity={0.85} stroke={colour} strokeWidth={2.5} />
    <circle r={3.2} fill={colour} />
    <path d="M -5 -16 L 0 -21 L 5 -16 M -5 16 L 0 21 L 5 16" fill="none" stroke={colour} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
  </g>
}

function GraphTask({ config, state, setState, marked, locked }: Props) {
  const s = readState(state)
  const svgRef = useRef<SVGSVGElement>(null)
  const [down, setDown] = useState(false)
  const [focused, setFocused] = useState(false)
  const toPoint = usePoint(svgRef)
  const answer = solutionOf(config)
  const special = answer.kind !== 'one'
  const point = s.point
  const good = marked === 'right' || marked === 'shown'

  const choose = (p: [number, number]) => {
    if (locked || special) return
    if (!point || point[0] !== p[0] || point[1] !== p[1]) setState({ ...state, point: p })
  }
  const onKey = (e: KeyboardEvent) => {
    const d = ({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] } as Record<string, [number, number]>)[e.key]
    if (!d && e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    e.stopPropagation()
    if (special) return
    const at = point ?? [0, 0]
    choose([clampGrid(at[0] + (d?.[0] ?? 0)), clampGrid(at[1] + (d?.[1] ?? 0))])
  }
  const where = !point ? 'No point placed yet' : `Your point is (${num(point[0])}, ${num(point[1])})`
  const ringColour = good ? 'var(--ss-good)' : marked === 'wrong' ? 'var(--ss-bad)' : ORANGE

  return <>
    <figure className="m-0 flex w-full flex-col gap-1.5">
      <GraphPaper svgRef={svgRef} label={special ? 'A coordinate grid with two lines. Decide how many points they share.' : 'A coordinate grid with a blue and a green line. Place the ring on their common point.'}
        onPointerMove={(e) => { if (down) { const p = toPoint(e); if (p) choose(p) } }} onPointerUp={() => setDown(false)}>
        <EquationLine equation={config.first} colour={BLUE} data="first" />
        <EquationLine equation={config.second} colour={TEAL} data="second" dashed={answer.kind === 'many'} />
        {!special && <g role="slider" tabIndex={locked ? -1 : 0} aria-label="Point to place on both lines. Drag, tap a grid point, or use the arrow keys" aria-valuemin={-RANGE} aria-valuemax={RANGE} aria-valuenow={point?.[1] ?? 0} aria-valuetext={where} aria-disabled={locked || undefined}
          onKeyDown={onKey} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          onPointerDown={(e) => { if (locked) return; setDown(true); svgRef.current?.setPointerCapture(e.pointerId); const p = toPoint(e); if (p) choose(p) }}
          className={`outline-none focus-visible:outline-none ${locked ? '' : 'cursor-grab'}`}>
          <rect x={72} y={11} width={240} height={234} fill="transparent" />
        </g>}
        {focused && !special && <rect x={76} y={15} width={228} height={226} rx={5} fill="none" stroke="var(--subject)" strokeWidth={2.5} pointerEvents="none" />}
        {point && !special && <Ring point={point} colour={ringColour} />}
      </GraphPaper>
      <figcaption className="flex flex-col items-center gap-0.5">
        <span className="flex flex-wrap justify-center gap-x-3 gap-y-0.5">
          <EquationRow colour={BLUE}>{equationText(config.first)}</EquationRow>
          <EquationRow colour={TEAL}>{equationText(config.second)}</EquationRow>
        </span>
        <span className="text-[12px] font-bold text-ss-slate">{special ? 'How many points satisfy both?' : 'Each line is every point that fits its equation.'}</span>
      </figcaption>
    </figure>
    {special && <div className="flex justify-center gap-2" onKeyDown={(e) => { if (e.key.startsWith('Arrow')) e.stopPropagation() }}>
      <button type="button" disabled={locked} aria-label="Choose no solutions" onClick={() => setState({ ...state, special: 'none' })} className={`rounded-lg border-2 px-3 py-1.5 text-[12px] font-bold whitespace-nowrap ${state.special === 'none' ? 'border-[color:var(--subject)] text-ss-ink' : 'border-ss-line bg-ss-panel text-ss-slate'}`}>No solutions</button>
      <button type="button" disabled={locked} aria-label="Choose infinitely many solutions" onClick={() => setState({ ...state, special: 'many' })} className={`rounded-lg border-2 px-3 py-1.5 text-[12px] font-bold whitespace-nowrap ${state.special === 'many' ? 'border-[color:var(--subject)] text-ss-ink' : 'border-ss-line bg-ss-panel text-ss-slate'}`}>Infinitely many</button>
    </div>}
    <Verdict marked={marked} text={good || marked === 'wrong' ? graphSentence(config, state, good) : ''} />
  </>
}

function EliminateTask({ config, state, setState, marked, reduced, locked }: Props) {
  const s = readState(state)
  const combined = combine(config, s.p, s.q)
  const good = marked === 'right' || marked === 'shown'
  const set = (patch: Partial<SimState>) => { if (!locked) setState({ ...state, ...patch }) }
  return <>
    <figure className="m-0 flex w-full flex-col gap-1.5">
      <GraphPaper label="A blue and a green line cross. Their orange combination turns about the same crossing as the multipliers change.">
        <EquationLine equation={config.first} colour={BLUE} data="first" reduced={reduced} />
        <EquationLine equation={config.second} colour={TEAL} data="second" reduced={reduced} />
        <EquationLine equation={combined} colour={ORANGE} data="combined" reduced={reduced} />
        {(combined.a === 0 || combined.b === 0) && combined.a + combined.b !== 0 && <g aria-hidden="true" opacity={0.7}>
          <circle cx={sx(0)} cy={sy(0)} r={3} fill={ORANGE} />
        </g>}
      </GraphPaper>
      <figcaption className="flex flex-col items-center gap-0.5">
        <span className="flex flex-wrap justify-center gap-x-3 gap-y-0.5">
          <EquationRow colour={BLUE}>{equationText(config.first)}</EquationRow>
          <EquationRow colour={TEAL}>{equationText(config.second)}</EquationRow>
        </span>
        <span className="text-[12px] font-bold text-ss-slate">Combine the equations. Watch the orange line.</span>
      </figcaption>
    </figure>
    <div className="grid grid-cols-2 gap-x-5">
      <Multiplier name="First ×" value={s.p} locked={locked} set={(p) => set({ p })} />
      <Multiplier name="Second ×" value={s.q} locked={locked} set={(q) => set({ q })} />
    </div>
    <div className="flex items-center justify-center gap-2 border-t border-ss-line pt-1.5">
      <EquationRow colour={ORANGE}><span data-combined-equation>{equationText(combined)}</span></EquationRow>
    </div>
    <Verdict marked={marked} text={good || marked === 'wrong' ? eliminationSentence(config, state, good) : ''} />
  </>
}

export function SimultaneousEquationsView(props: Props) {
  return <div className="nodrag flex w-full max-w-[380px] flex-col gap-2">
    {props.config.task === 'graph' ? <GraphTask {...props} /> : <EliminateTask {...props} />}
    <span className="sr-only" aria-live="polite">{props.config.task === 'eliminate' ? `Combined equation: ${equationText(combine(props.config, readState(props.state).p, readState(props.state).q))}` : readState(props.state).point ? `Point ${readState(props.state).point?.join(', ')}` : ''}</span>
  </div>
}
