'use client'
import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { SceneViewProps } from '../types'
import type { Cell, ElectrodeEvent, ElectrolysisConfig, ElectrolysisState, Side } from './config'
import { cellOf, circuitOf, eventAt, other, requiredCircuit, verdict } from './config'

type Props = SceneViewProps<ElectrolysisConfig, ElectrolysisState>

// A quiet laboratory plate in both themes. Every colour belongs to a real material or an ion.
const PLATE = '#F8FAFC'
const EDGE = '#CBD5E1'
const INK = '#16202A'
const SOFT = '#475569'
const GLASS = '#E3EDF5'
const GRAPHITE = '#475569'
const GRAPHITE_DARK = '#263442'
const COPPER = '#C9794D'
const COPPER_DARK = '#854526'
const SILVER = '#AEBBC8'
const RED = '#C84444'
const RED_DARK = '#7F1D1D'
const BLACK = '#334155'
const CATION = '#2F7FB8'
const ANION = '#B06A16'
const HOLE = '#E2E8F0'
const CASE = '#E2E8F0'
const SCREEN = '#D7E4DC'
const FONT = 'system-ui, sans-serif'

export const W = 380
export const H = 312
export const BEAKER = { left: 67, right: 313, rim: 116, bottom: 259, liquid: 153 }
export const ELECTRODE = { left: 125, right: 255, top: 102, bottom: 243 }
export const TERMINAL_Y = 88
export const PARK = { red: { x: 43, y: 68 }, black: { x: 337, y: 68 } }
/** The visible target: a plug this close snaps fully onto the terminal. */
export const SNAP_RADIUS = 31
export const PLUG_RADIUS = 24

export const electrodeX = (side: Side) => side === 'left' ? ELECTRODE.left : ELECTRODE.right
export const otherSide = (side: Side): Side => side === 'left' ? 'right' : 'left'

type PlugPoint = { x: number; y: number }
type Plugs = Record<'red' | 'black', PlugPoint>
export function plugPoints(state: ElectrolysisState): Plugs {
  const at = (lead: 'red' | 'black') => {
    const side = state?.[lead]
    return side === 'left' || side === 'right' ? { x: electrodeX(side), y: TERMINAL_Y } : PARK[lead]
  }
  return { red: at('red'), black: at('black') }
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))
const f = (n: number) => n.toFixed(1)
const leadStart = (lead: 'red' | 'black'): PlugPoint => ({ x: lead === 'red' ? 112 : 148, y: 50 })
const leadControls = (lead: 'red' | 'black', to: PlugPoint) => lead === 'red'
  ? [{ x: 52, y: 15 }, { x: to.x - 36, y: to.y - 42 }]
  : [{ x: 211, y: 19 }, { x: to.x + 36, y: to.y - 42 }]
const leadPath = (lead: 'red' | 'black', to: PlugPoint) => {
  const a = leadStart(lead)
  const [b, c] = leadControls(lead, to)
  return `M ${a.x} ${a.y} C ${b.x} ${b.y}, ${f(c.x)} ${f(c.y)}, ${f(to.x)} ${f(to.y)}`
}
const onLead = (lead: 'red' | 'black', to: PlugPoint, t: number): PlugPoint => {
  const a = leadStart(lead)
  const [b, c] = leadControls(lead, to)
  const u = 1 - t
  return { x: u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * to.x, y: u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * to.y }
}

/** A lead has a loose, hanging curve when unplugged and a clean circuit path when connected. */
function LeadWire({ lead, to }: { lead: 'red' | 'black'; to: PlugPoint }) {
  const left = lead === 'red'
  const colour = left ? RED : BLACK
  const edge = left ? RED_DARK : INK
  const d = leadPath(lead, to)
  return <g fill="none" strokeLinecap="round"><path d={d} stroke={edge} strokeWidth={6} /><path d={d} stroke={colour} strokeWidth={3.4} /></g>
}

/** The low-voltage supply, with a real switch, terminals and a glass power window. */
function PowerPack() {
  return <g fontFamily={FONT}>
    <rect x={91} y={15} width={77} height={55} rx={7} fill={CASE} stroke={SOFT} strokeWidth={1.5} />
    <path d="M 98 16 H 160" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" />
    <rect x={99} y={23} width={33} height={19} rx={3} fill={SCREEN} stroke={SOFT} strokeWidth={1} />
    <text x={115.5} y={36.5} textAnchor="middle" fontSize={12} fontWeight={800} fill={INK}>6 V</text>
    <text x={146} y={36} fontSize={12} fontWeight={700} fill={SOFT}>DC</text>
    <circle cx={112} cy={52} r={6} fill={RED} stroke={RED_DARK} strokeWidth={1.4} />
    <circle cx={148} cy={52} r={6} fill={BLACK} stroke={INK} strokeWidth={1.4} />
    <text x={112} y={55.5} textAnchor="middle" fontSize={12} fontWeight={900} fill="#FFFFFF">+</text>
    <text x={148} y={55.5} textAnchor="middle" fontSize={13} fontWeight={900} fill="#FFFFFF">−</text>

  </g>
}

/** A clip with a ribbed finger grip and a small plug nose. The ring says it can be taken hold of. */
function Plug({ lead, at, dragging, focused }: { lead: 'red' | 'black'; at: PlugPoint; dragging: boolean; focused: boolean }) {
  const colour = lead === 'red' ? RED : BLACK
  const dark = lead === 'red' ? RED_DARK : INK
  return <g transform={`translate(${f(at.x)} ${f(at.y)}) rotate(${lead === 'red' ? -24 : 24})`} data-plug={lead} pointerEvents="none">
    {focused && <circle r={23} fill="none" stroke="var(--subject)" strokeWidth={3} />}
    <rect x={-19} y={-10} width={31} height={20} rx={7} fill={HOLE} stroke={dark} strokeWidth={1.6} />
    <rect x={-15} y={-7} width={20} height={14} rx={4} fill={colour} />
    {[ -10, -5, 0 ].map((x) => <path key={x} d={`M ${x} -5 V 5`} stroke={dark} strokeWidth={1.2} opacity={0.7} />)}
    <path d="M 11 -5 H 20 L 24 0 L 20 5 H 11 Z" fill={SILVER} stroke={SOFT} strokeWidth={1.2} />
    {dragging && <path d="M -3 -15 L 0 -20 L 3 -15 M -3 15 L 0 20 L 3 15" fill="none" stroke={SOFT} strokeWidth={1.5} strokeLinecap="round" />}
  </g>
}

function Terminal({ side, material, marked, role, jagged }: { side: Side; material: Cell['material']; marked: boolean; role: 'anode' | 'cathode' | null; jagged: boolean }) {
  const x = electrodeX(side)
  return <g fontFamily={FONT}>
    <circle cx={x} cy={TERMINAL_Y} r={7.5} fill={HOLE} stroke={SOFT} strokeWidth={1.5} />
    <circle cx={x} cy={TERMINAL_Y} r={3} fill={SOFT} />
    <text x={side === 'left' ? x + 9 : x - (jagged ? 23 : 9)} y={137} textAnchor={side === 'left' ? 'start' : 'end'} fontSize={12} fontWeight={700} fill={SOFT} stroke={PLATE} strokeWidth={3} paintOrder="stroke">{marked ? role : side}</text>
    {material === 'carbon' ? <text x={x} y={278} textAnchor="middle" fontSize={12} fontWeight={700} fill={SOFT}>carbon</text> : null}
  </g>
}

/** The beaker's glass has a rolled rim, visible back wall, flat meniscus, base and small graduations. */
function BeakerBack({ cell, pureSide }: { cell: Cell; pureSide: Side | null }) {
  const b = BEAKER
  return <g fontFamily={FONT}>
    <path d={`M ${b.left + 4} ${b.rim} L ${b.left + 9} ${b.bottom - 12} Q ${b.left + 10} ${b.bottom} ${b.left + 23} ${b.bottom} H ${b.right - 23} Q ${b.right - 10} ${b.bottom} ${b.right - 9} ${b.bottom - 12} L ${b.right - 4} ${b.rim} Z`} fill={GLASS} stroke={SOFT} strokeWidth={1.7} />
    <path d={`M ${b.left + 8} ${b.liquid} H ${b.right - 8} L ${b.right - 10} ${b.bottom - 13} Q ${b.right - 11} ${b.bottom - 4} ${b.right - 24} ${b.bottom - 4} H ${b.left + 24} Q ${b.left + 11} ${b.bottom - 4} ${b.left + 10} ${b.bottom - 13} Z`} fill={cell.liquid} />
    <path d={`M ${b.left + 8} ${b.liquid} Q 190 ${b.liquid + 4} ${b.right - 8} ${b.liquid}`} fill="none" stroke="#7EA9BC" strokeWidth={1.6} />
    {[174, 194, 214, 234].map((y, i) => <path key={y} d={`M ${b.right - 12} ${y} h ${i % 2 ? -10 : -16}`} stroke="#8DA5B4" strokeWidth={1} />)}
    <text x={190} y={297} textAnchor="middle" fontSize={12} fontWeight={700} fill={SOFT}>{cell.formula}</text>
    {pureSide && <>
      <text x={electrodeX(otherSide(pureSide))} y={278} textAnchor="middle" fontSize={12} fontWeight={700} fill={COPPER_DARK}>impure copper</text>
      <text x={electrodeX(pureSide)} y={278} textAnchor="middle" fontSize={12} fontWeight={700} fill={COPPER_DARK}>pure copper</text>
    </>}
  </g>
}

function BeakerFront() {
  const b = BEAKER
  return <g fill="none" strokeLinecap="round">
    <path d={`M ${b.left - 3} ${b.rim} H ${b.right + 3}`} stroke={SOFT} strokeWidth={2.5} />
    <path d={`M ${b.left + 4} ${b.rim} L ${b.left + 9} ${b.bottom - 12} Q ${b.left + 10} ${b.bottom} ${b.left + 23} ${b.bottom} H ${b.right - 23} Q ${b.right - 10} ${b.bottom} ${b.right - 9} ${b.bottom - 12} L ${b.right - 4} ${b.rim}`} stroke={SOFT} strokeWidth={1.7} />
    <path d={`M ${b.left + 15} ${b.rim + 13} L ${b.left + 19} ${b.bottom - 27}`} stroke="#FFFFFF" strokeWidth={3} opacity={0.85} />
  </g>
}

function Electrode({ side, material, event, running, impure, reduced }: { side: Side; material: Cell['material']; event: ElectrodeEvent | null; running: boolean; impure: 'pure' | 'impure' | null; reduced: boolean }) {
  const x = electrodeX(side)
  const copper = material === 'copper'
  const dissolve = running && event?.kind === 'dissolve'
  const width = dissolve ? 7 : copper ? 13 : 11
  const body = copper ? COPPER : GRAPHITE
  const edge = copper ? COPPER_DARK : GRAPHITE_DARK
  const coating = running && event?.kind === 'metal'
  const pool = running && event?.kind === 'pool'
  const metalColour = event?.metal === 'copper' ? COPPER : event?.metal === 'lead' ? '#778897' : '#C3CED8'
  return <g>
    {copper && impure === 'impure' && <path d={`M ${x - 13} 130 L ${x - 18} 140 L ${x - 12} 147 L ${x - 17} 157 L ${x - 11} 165 L ${x - 15} 178 L ${x - 9} 187 L ${x - 13} 201 L ${x - 7} 213 L ${x - 9} 230 L ${x - 5} 243 H ${x + 5} V 130 Z`} fill="#64748B" stroke={COPPER_DARK} strokeWidth={1.2} />}
    <rect x={x - width / 2} y={ELECTRODE.top} width={width} height={ELECTRODE.bottom - ELECTRODE.top} rx={copper ? 1.5 : 4} fill={body} stroke={edge} strokeWidth={1.5} style={reduced ? undefined : { transition: 'x 700ms ease, width 700ms ease' }} />
    <path d={`M ${x - width / 2 + 3} 111 V 231`} stroke={copper ? '#E9B18C' : '#94A3B8'} strokeWidth={2} strokeLinecap="round" opacity={0.75} />
    {coating && <>
      <rect x={x - width / 2 - 3} y={163} width={width + 6} height={78} rx={5} fill={metalColour} stroke={event?.metal === 'copper' ? COPPER_DARK : '#5C6D7B'} strokeWidth={1.8} />
      <path d={`M ${x - width / 2} 170 V 231`} stroke={event?.metal === 'copper' ? '#F0BE9F' : '#E2E8F0'} strokeWidth={2.5} strokeLinecap="round" />
      {[177, 192, 207, 222].map((y, i) => <circle key={y} cx={x + (i % 2 ? 4 : -3)} cy={y} r={1.8} fill={event?.metal === 'copper' ? '#9E5632' : '#738495'} />)}
    </>}
    {pool && <>
      <path d={`M ${x - 20} 242 Q ${x - 16} 224 ${x} 225 Q ${x + 16} 224 ${x + 21} 242 Q ${x + 17} 250 ${x} 250 Q ${x - 17} 250 ${x - 20} 242 Z`} fill="#BCC8D3" stroke="#62788A" strokeWidth={1.5} />
      <path d={`M ${x - 10} 233 Q ${x} 228 ${x + 10} 233`} fill="none" stroke="#F8FAFC" strokeWidth={2.2} />
    </>}
  </g>
}

/** One labelled ion. Cations and anions have different colours and explicit charge symbols. */
function IonMark({ symbol, positive, x, y, small }: { symbol: string; positive: boolean; x: number; y: number; small: boolean }) {
  const w = small ? 32 : 34
  return <g transform={`translate(${f(x)} ${f(y)})`} fontFamily={FONT}>
    <rect x={-w / 2} y={-9} width={w} height={18} rx={9} fill={positive ? '#DCECF7' : '#F7EBD9'} stroke={positive ? CATION : ANION} strokeWidth={1.4} />
    <text x={0} y={4} textAnchor="middle" fontSize={12} fontWeight={800} fill={positive ? '#1F6397' : '#7C4A0B'}>{symbol}</text>
  </g>
}

/** Eight ions at rest; once connected they separate into two clear lanes, never a cloud of dots. */
export function ionPositions(running: boolean): { x: number; y: number }[] {
  const rest = [{ x: 99, y: 176 }, { x: 160, y: 172 }, { x: 221, y: 174 }, { x: 281, y: 177 }, { x: 99, y: 222 }, { x: 160, y: 218 }, { x: 221, y: 221 }, { x: 281, y: 218 }]
  if (!running) return rest
  return [{ x: 99, y: 160 }, { x: 163, y: 160 }, { x: 217, y: 160 }, { x: 281, y: 160 }, { x: 99, y: 207 }, { x: 163, y: 207 }, { x: 217, y: 207 }, { x: 281, y: 207 }]
}

function Ions({ cell, circuit, reduced }: { cell: Cell; circuit: { positive: Side; negative: Side } | null; reduced: boolean }) {
  const rest = ionPositions(false)
  const used = { left: 0, right: 0 }
  return <g aria-hidden="true">{cell.ions.map((ion, i) => {
    let p = rest[i]
    if (circuit) {
      const side = ion.charge > 0 ? circuit.negative : circuit.positive
      const k = used[side]++
      p = { x: side === 'left' ? (k % 2 ? 160 : 99) : (k % 2 ? 281 : 221), y: k < 2 ? 176 : 219 }
    }
    return <g key={i} transform={`translate(${f(p.x)} ${f(p.y)})`} style={reduced ? undefined : { transition: 'transform 900ms ease-in-out' }}><IonMark symbol={ion.symbol} positive={ion.charge > 0} x={0} y={0} small={ion.symbol.length > 4} /></g>
  })}</g>
}

/** Bubbles are real growing and rising circles; reduced motion shows a still set at different heights. */
function Bubbles({ side, event, reduced }: { side: Side; event: ElectrodeEvent; reduced: boolean }) {
  const x = electrodeX(side)
  const colour = event.gas === 'green' ? '#B9C97B' : event.gas === 'brown' ? '#B7784E' : '#FFFFFF'
  const edge = event.gas === 'green' ? '#6E813A' : event.gas === 'brown' ? '#754323' : '#7193A6'
  return <g aria-hidden="true">{[0, 1, 2, 3, 4].map((i) => {
    const bx = x + (i % 2 ? 9 : -7)
    const by = 177 - i * 8
    const r = 3.2 + (i % 3)
    const inner = <>
      <circle cx={bx} cy={by} r={r} fill={colour} stroke={edge} strokeWidth={1.2} />
      <circle cx={bx - 1.2} cy={by - 1.2} r={0.9} fill="#FFFFFF" opacity={0.9} />
    </>
    return reduced ? <g key={i}>{inner}</g> : <g key={i} style={{ animation: `electrolysis-bubble ${2.4 + i * 0.22}s ${-i * 0.5}s linear infinite` }}>{inner}</g>
  })}</g>
}

function Electrons({ circuit, points, reduced }: { circuit: { positive: Side; negative: Side } | null; points: Plugs; reduced: boolean }) {
  if (!circuit) return null
  // Electrons travel out of the negative supply to the cathode, and from the anode back to +.
  return <g aria-hidden="true" fontFamily={FONT}>
    {(['red', 'black'] as const).map((lead) => {
      const reverse = lead === 'red'
      const t = reverse ? 0.78 : 0.58
      const still = onLead(lead, points[lead], t)
      return <g key={lead} transform={reduced ? `translate(${f(still.x)} ${f(still.y)})` : undefined}>
        {!reduced && <animateMotion path={leadPath(lead, points[lead])} dur="4s" begin={`${-4 * t}s`} repeatCount="indefinite" keyPoints={reverse ? '1;0' : '0;1'} keyTimes="0;1" calcMode="linear" />}
        <circle r={8} fill="#FFFFFF" stroke={CATION} strokeWidth={1.3} />
        <text x={0} y={4} textAnchor="middle" fontSize={12} fontWeight={900} fill={CATION}>e⁻</text>
      </g>
    })}
    <text x={190} y={91} textAnchor="middle" fontSize={12} fontWeight={700} fill={SOFT}>e⁻ in wires</text>
  </g>
}

function describe(config: ElectrolysisConfig, cell: Cell, circuit: { positive: Side; negative: Side } | null, state: ElectrolysisState): string {
  const wiring = `Red positive plug: ${state.red ?? 'loose'}. Black negative plug: ${state.black ?? 'loose'}.`
  const seen = circuit ? `Current is passing. Positive and negative ions have moved to opposite electrodes. ${(['left', 'right'] as Side[]).map((side) => {
    const e = eventAt(config, circuit, side)
    return `${side}: ${e.kind === 'gas' ? 'gas bubbles are rising' : e.kind === 'metal' ? 'a new metal coating is visible' : e.kind === 'pool' ? 'molten metal has collected' : 'the electrode has become thinner'}`
  }).join('. ')}` : 'No current passes through the electrolyte; the ions are mixed throughout it.'
  return `An electrolysis cell containing ${cell.name}, with ${cell.material} electrodes. ${wiring} ${seen}`
}

export function ElectrolysisView({ config, state, setState, marked, reduced, locked }: Props) {
  const cell = cellOf(config)
  const circuit = circuitOf(state)
  const [drag, setDrag] = useState<{ lead: 'red' | 'black'; point: PlugPoint; near: Side | null } | null>(null)
  const [focused, setFocused] = useState<'red' | 'black' | null>(null)
  const [said, setSaid] = useState('')
  const svg = useRef<SVGSVGElement>(null)
  const shown = marked === 'shown'
  const live = !locked && !shown
  const points = plugPoints(state)
  const display = (lead: 'red' | 'black') => drag?.lead === lead ? (drag.near ? { x: electrodeX(drag.near), y: TERMINAL_Y } : drag.point) : points[lead]
  const running = !!circuit
  const named = marked !== 'idle'
  const outcome = named ? verdict(config, state, marked === 'right' || shown) : null
  const equations = named && circuit ? [
    `Cathode (−), ${circuit.negative}: ${cell.cathode.equation}`,
    `Anode (+), ${circuit.positive}: ${cell.anode.equation}`,
  ] : []

  const pointOf = (e: PointerEvent): PlugPoint => {
    const box = svg.current!.getBoundingClientRect()
    return { x: ((e.clientX - box.left) / box.width) * W, y: ((e.clientY - box.top) / box.height) * H }
  }
  const nearest = (p: PlugPoint): Side | null => {
    const left = Math.hypot(p.x - ELECTRODE.left, p.y - TERMINAL_Y)
    const right = Math.hypot(p.x - ELECTRODE.right, p.y - TERMINAL_Y)
    return Math.min(left, right) <= SNAP_RADIUS ? (left < right ? 'left' : 'right') : null
  }
  const put = (lead: 'red' | 'black', side: Side | null) => {
    setState({ red: lead === 'red' ? side : state.red ?? null, black: lead === 'black' ? side : state.black ?? null })
  }
  const cycle = (lead: 'red' | 'black') => {
    if (!live) return
    const now = state?.[lead]
    const next = now === 'left' ? 'right' : now === 'right' ? null : 'left'
    put(lead, next)
    setSaid(`${lead === 'red' ? 'Red positive' : 'Black negative'} plug ${next ? `connected to the ${next} electrode` : 'removed'}.`)
  }
  const onKey = (lead: 'red' | 'black') => (e: KeyboardEvent<SVGGElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault(); e.stopPropagation(); cycle(lead); return
    }
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key) || !live) return
    e.preventDefault(); e.stopPropagation()
    const side: Side | null = e.key === 'ArrowLeft' || e.key === 'Home' ? 'left' : e.key === 'ArrowRight' || e.key === 'End' ? 'right' : null
    put(lead, side)
    setSaid(`${lead === 'red' ? 'Red positive' : 'Black negative'} plug ${side ? `connected to the ${side} electrode` : 'removed'}.`)
  }
  const down = (lead: 'red' | 'black') => (e: PointerEvent<SVGGElement>) => {
    if (!live || e.button !== 0) return
    e.preventDefault(); e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    setDrag({ lead, point: points[lead], near: state?.[lead] ?? null })
  }
  const move = (e: PointerEvent<SVGGElement>) => {
    if (!drag) return
    e.preventDefault()
    const p = pointOf(e)
    setDrag({ ...drag, point: { x: clamp(p.x, 15, W - 15), y: clamp(p.y, 15, H - 15) }, near: nearest(p) })
  }
  const up = (e: PointerEvent<SVGGElement>) => {
    if (!drag) return
    const moved = Math.hypot(drag.point.x - points[drag.lead].x, drag.point.y - points[drag.lead].y)
    if (moved > 5) {
      put(drag.lead, drag.near)
      setSaid(`${drag.lead === 'red' ? 'Red positive' : 'Black negative'} plug ${drag.near ? `connected to the ${drag.near} electrode` : 'removed'}.`)
    } else cycle(drag.lead)
    setDrag(null)
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* pointer already released */ }
  }

  const plugs = (['red', 'black'] as const).map((lead) => <g
    key={lead}
    role="button"
    tabIndex={live ? 0 : -1}
    aria-label={`${lead === 'red' ? 'Red positive' : 'Black negative'} plug, ${state?.[lead] ? `on the ${state[lead]} electrode` : 'loose'}. Drag to a terminal, tap to move, or use left and right arrows; up removes it.`}
    aria-disabled={!live || undefined}
    className={`nodrag outline-none ${live ? 'cursor-grab active:cursor-grabbing' : ''}`}
    onKeyDown={onKey(lead)}
    onFocus={() => setFocused(lead)}
    onBlur={() => setFocused(null)}
    onPointerDown={down(lead)}
    onPointerCancel={() => setDrag(null)}
  >
    <circle cx={display(lead).x} cy={display(lead).y} r={PLUG_RADIUS} fill="transparent" className="touch-none" />
    <Plug lead={lead} at={display(lead)} dragging={drag?.lead === lead} focused={focused === lead} />
  </g>)

  return <div className="nodrag flex w-full max-w-[380px] flex-col gap-2">
    <figure className="m-0 flex w-full flex-col gap-1.5">
      <svg ref={svg} viewBox={`0 0 ${W} ${H}`} role="group" aria-label={describe(config, cell, circuit, state)} className="block h-auto w-full select-none" onPointerMove={move} onPointerUp={up} onPointerCancel={() => setDrag(null)}>
        <defs><clipPath id="electrolysis-liquid"><path d={`M ${BEAKER.left + 8} ${BEAKER.liquid} H ${BEAKER.right - 8} V ${BEAKER.bottom - 5} H ${BEAKER.left + 8} Z`} /></clipPath></defs>
        <rect x={0.75} y={0.75} width={W - 1.5} height={H - 1.5} rx={16} fill={PLATE} stroke={EDGE} strokeWidth={1.5} />
        {!reduced && <style>{`@keyframes electrolysis-bubble { 0% { transform: translateY(27px); opacity: 0 } 15% { opacity: 1 } 85% { opacity: 1 } 100% { transform: translateY(-15px); opacity: 0 } }`}</style>}
        <BeakerBack cell={cell} pureSide={config.task === 'purify' ? (config.side === 'right' ? 'right' : 'left') : null} />
        <g clipPath="url(#electrolysis-liquid)"><Ions cell={cell} circuit={circuit} reduced={reduced} /></g>
        {(['left', 'right'] as Side[]).map((side) => <Electrode key={side} side={side} material={cell.material} event={circuit ? eventAt(config, circuit, side) : null} running={running} impure={config.task === 'purify' ? (side === (config.side === 'right' ? 'right' : 'left') ? 'pure' : 'impure') : null} reduced={reduced} />)}
        {circuit && (['left', 'right'] as Side[]).map((side) => {
          const event = eventAt(config, circuit, side)
          return event.kind === 'gas' ? <Bubbles key={side} side={side} event={event} reduced={reduced} /> : null
        })}
        <BeakerFront />
        <LeadWire lead="red" to={display('red')} />
        <LeadWire lead="black" to={display('black')} />
        <PowerPack />
        {(['left', 'right'] as Side[]).map((side) => <Terminal key={side} side={side} material={cell.material} marked={named} role={circuit ? (circuit.positive === side ? 'anode' : 'cathode') : null} jagged={config.task === 'purify' && side !== (config.side === 'right' ? 'right' : 'left')} />)}
        <Electrons circuit={circuit} points={{ red: display('red'), black: display('black') }} reduced={reduced} />
        {drag?.near && <circle cx={electrodeX(drag.near)} cy={TERMINAL_Y} r={15} fill="none" stroke="var(--subject)" strokeWidth={2.5} strokeDasharray="3 3" />}
        {plugs}
      </svg>
      <figcaption className="flex flex-wrap justify-center gap-x-3 gap-y-0.5 text-[12px] font-semibold text-ss-slate" aria-hidden="true">
        <span className="flex items-center gap-1"><IonSwatch positive />positive ion</span>
        <span className="flex items-center gap-1"><IonSwatch positive={false} />negative ion</span>
        <span>{running ? 'Circuit complete — electrolysis is running' : 'Connect both leads to run the cell'}</span>
      </figcaption>
    </figure>
    <p className="sr-only" aria-live="polite">{said}</p>
    {outcome && <div className="rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2" aria-live="polite">
      <p className="text-[13px] font-extrabold leading-snug text-ss-ink">{outcome.title}</p>
      <p className="mt-0.5 text-[12px] font-semibold leading-snug text-ss-slate">{outcome.detail}</p>
      {equations.map((line) => <p key={line} className="mt-1 text-[12px] font-bold leading-snug text-ss-ink">{line}</p>)}
    </div>}
  </div>
}

function IonSwatch({ positive }: { positive: boolean }) {
  return <svg viewBox="0 0 18 12" className="h-3 w-[18px] shrink-0" aria-hidden="true">
    <rect x={1} y={1} width={16} height={10} rx={5} fill={positive ? '#DCECF7' : '#F7EBD9'} stroke={positive ? CATION : ANION} strokeWidth={1.2} />
    <path d={positive ? 'M 6 6 H 12 M 9 3 V 9' : 'M 6 6 H 12'} stroke={positive ? CATION : ANION} strokeWidth={1.2} />
  </svg>
}
