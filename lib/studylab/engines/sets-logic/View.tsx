'use client'
import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react'
import type { SceneMarked, SceneViewProps } from '../types'
import type { CountsConfig, RegionId, SetsConfig, SetsState } from './config'
import { countsOf, EXPRESSIONS, madeText, MAX_TOTAL, REGION_IDS, REGION_NAMES, shadedOf, working } from './config'

type Props = SceneViewProps<SetsConfig, SetsState>

// The Venn diagram is paper, not a dark stage. The same quiet plate in both themes
// keeps the region colour and its ink constant. No gradients, shadows or decoration.
const PLATE = '#F8FAFC'
const PLATE_EDGE = '#CBD5E1'
const UNIVERSAL = '#FFFFFF'
const INK = '#243447'
const SOFT = '#475569'
const HAIR = '#A8B5C2'
const A_EDGE = '#397EAB'
const A_FILL = '#DFEEF6'
const B_EDGE = '#A56D3F'
const B_FILL = '#F5E9DB'
const YELLOW = '#F6D66B'
const YELLOW_EDGE = '#9A7417'
const CHIP = '#EDF1F4'
const FONT = 'system-ui, sans-serif'

// Literal geometry: config.ts imports this file, so a top-level import of its
// geometry would be read before config had initialised. Tests check this geometry.
export const W = 360
export const H = 220
export const A_CENTRE = { x: 142, y: 119 }
export const B_CENTRE = { x: 218, y: 119 }
export const CIRCLE_R = 68
export const REGION_POINTS: Record<RegionId, { x: number; y: number }> = {
  a: { x: 111, y: 120 },
  both: { x: 180, y: 120 },
  b: { x: 249, y: 120 },
  outside: { x: 180, y: 199 },
}
const REGION_ORDER: RegionId[] = ['a', 'both', 'b', 'outside']
const ids = { a: 'A only', both: 'Both', b: 'B only', outside: 'Neither' } as const

const contextNames = (context: SetsConfig['context']) => context === 'numbers'
  ? { a: 'even numbers', b: 'multiples of 3', universal: 'whole numbers 1–20' }
  : { a: 'play football', b: 'play tennis', universal: 'students in the class' }

export const INTERSECTION_Y = 119 - Math.sqrt(CIRCLE_R * CIRCLE_R - (B_CENTRE.x - A_CENTRE.x) ** 2 / 4)

export function regionPath(id: RegionId): string {
  const r = CIRCLE_R
  const top = INTERSECTION_Y
  const bottom = 2 * A_CENTRE.y - top
  // Exact circle intersections, never rounded guesses. Each crescent is its
  // outer arc followed by its inner arc; the lens is the two small inner arcs.
  // None covers another, so later fills cannot erase it.
  if (id === 'a') return `M180 ${top} A${r} ${r} 0 1 0 180 ${bottom} A${r} ${r} 0 0 0 180 ${top} Z`
  if (id === 'both') return `M180 ${top} A${r} ${r} 0 0 1 180 ${bottom} A${r} ${r} 0 0 1 180 ${top} Z`
  if (id === 'b') return `M180 ${top} A${r} ${r} 0 1 1 180 ${bottom} A${r} ${r} 0 0 1 180 ${top} Z`
  const circle = (x: number, y: number) => `M${x - r} ${y} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0 `
  return `M30 31 H330 V205 H30 Z ${circle(A_CENTRE.x, A_CENTRE.y)}${circle(B_CENTRE.x, B_CENTRE.y)}`
}

function RegionShape({ id, fill, reduced }: { id: RegionId; fill: string; reduced: boolean }) {
  return <path fill={fill} fillRule="evenodd" stroke="none" data-region-fill={id} d={regionPath(id)} style={reduced ? undefined : { transition: 'fill 450ms ease' }} />
}

function RuleBand({ config }: { config: SetsConfig }) {
  const e = config.task === 'shade' ? EXPRESSIONS[config.expression] : null
  return (
    <div className="flex min-h-[38px] items-center justify-center gap-2 rounded-lg border border-ss-line bg-ss-panel px-2 py-1 text-center">
      {config.task === 'shade' && e ? <>
        <span className="shrink-0 text-[15px] font-extrabold text-ss-ink">{e.symbol}</span>
        <span className="text-[12px] font-semibold leading-tight text-ss-slate">{e.words}</span>
      </> : <div className="grid w-full grid-cols-4 gap-1">
        {[{ label: 'A total', value: (config as CountsConfig).totalA }, { label: 'B total', value: (config as CountsConfig).totalB }, { label: 'Both', value: (config as CountsConfig).both }, { label: 'ℰ total', value: (config as CountsConfig).universal }].map((g) => <p key={g.label} className="m-0 flex items-baseline justify-center gap-1 whitespace-nowrap">
          <span className="text-[12px] font-bold text-ss-slate">{g.label}</span>
          <span className="text-[15px] font-extrabold tabular-nums text-ss-ink">{g.value}</span>
        </p>)}
      </div>}
    </div>
  )
}

function RegionButtons({ config, state, setState, locked }: Pick<Props, 'config' | 'state' | 'setState' | 'locked'>) {
  if (config.task !== 'shade') return null
  const shaded = shadedOf(config, state)
  const toggle = (id: RegionId) => {
    if (locked) return
    setState({ shaded: shaded.includes(id) ? shaded.filter((x) => x !== id) : [...shaded, id] })
  }
  return <>
    {REGION_ORDER.map((id) => {
      const p = REGION_POINTS[id]
      return <button
        key={id}
        type="button"
        aria-label={`${shaded.includes(id) ? 'Unshade' : 'Shade'} ${REGION_NAMES[id]}`}
        aria-pressed={shaded.includes(id)}
        disabled={locked}
        onClick={() => toggle(id)}
        className="nodrag absolute touch-manipulation rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--subject)] focus-visible:ring-offset-2 disabled:cursor-default"
        style={{ left: `${(p.x / W) * 100}%`, top: `${(p.y / H) * 100}%`, width: 44, height: 44, transform: 'translate(-50%, -50%)', border: 0, padding: 0, background: 'transparent', cursor: locked ? 'default' : 'pointer' }}
      />
    })}
  </>
}

function Stepper({ id, value, set, locked }: { id: RegionId; value: number; set(next: number): void; locked: boolean }) {
  const latest = useRef({ value, set, locked })
  latest.current = { value, set, locked }
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const held = useRef(false)
  const stop = () => { if (timer.current) clearTimeout(timer.current); timer.current = null }
  useEffect(() => stop, [])
  const bump = (by: number) => {
    const l = latest.current
    if (l.locked) return false
    const next = Math.max(0, Math.min(MAX_TOTAL, l.value + by))
    if (next === l.value) return false
    l.set(next)
    return true
  }
  const hold = (by: number) => (e: PointerEvent) => {
    if (e.button !== 0) return
    held.current = false
    stop()
    const tick = (wait: number) => {
      timer.current = setTimeout(() => {
        held.current = true
        if (bump(by)) tick(100)
        else stop()
      }, wait)
    }
    tick(450)
  }
  const press = (by: number) => () => {
    if (held.current) { held.current = false; return }
    bump(by)
  }
  const onKey = (e: KeyboardEvent) => {
    const by = ({ ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 5, PageDown: -5, '+': 1, '=': 1, '-': -1 } as Record<string, number>)[e.key]
    if (by === undefined && e.key !== 'Home' && e.key !== 'End') return
    e.preventDefault()
    e.stopPropagation()
    if (e.key === 'Home') bump(-latest.current.value)
    else if (e.key === 'End') bump(MAX_TOTAL - latest.current.value)
    else bump(by)
  }
  const button = 'nodrag flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-lg border-2 border-ss-line bg-ss-panel text-[16px] font-extrabold leading-none text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'
  return <div className="flex items-center justify-between gap-1.5">
    <span id={`count-${id}`} className="text-[12px] font-bold text-ss-slate">{ids[id]}</span>
    <span className="flex items-center gap-1">
      <button type="button" tabIndex={-1} aria-label={`Take 1 from ${ids[id]}`} className={button} disabled={locked || value <= 0}
        onPointerDown={hold(-1)} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop} onClick={press(-1)}>−</button>
      <span role="spinbutton" tabIndex={locked ? -1 : 0} aria-labelledby={`count-${id}`} aria-valuenow={value} aria-valuemin={0} aria-valuemax={MAX_TOTAL}
        aria-disabled={locked || undefined} onKeyDown={onKey}
        className="nodrag min-w-[28px] rounded-md px-0.5 text-center text-[15px] font-extrabold tabular-nums text-ss-ink outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--subject)]">{value}</span>
      <button type="button" tabIndex={-1} aria-label={`Add 1 to ${ids[id]}`} className={button} disabled={locked || value >= MAX_TOTAL}
        onPointerDown={hold(1)} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop} onClick={press(1)}>+</button>
    </span>
  </div>
}

function Verdict({ marked, text }: { marked: SceneMarked; text: string }) {
  if (marked === 'idle') return null
  return <p className="w-full rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2 text-[12px] font-semibold leading-snug text-ss-slate" aria-live="polite"><strong className="font-extrabold text-ss-ink">{text.split('. ')[0]}.</strong>{text.includes('. ') ? ` ${text.split('. ').slice(1).join('. ')}` : ''}</p>
}

export function SetsLogicView({ config, state, setState, marked, reduced, locked }: Props) {
  const shaded = shadedOf(config, state)
  const counts = config.task === 'counts' ? countsOf(config, state) : [0, 0, 0, 0]
  const names = contextNames(config.context)
  const good = marked === 'right' || marked === 'shown'
  const text = good ? working(config, state) : marked === 'wrong' ? madeText(config, state) : ''
  const union = counts[0] + counts[1] + counts[2]
  const seen = config.task === 'shade'
    ? `A two-set Venn diagram inside the universal set. Circle A is ${names.a}; circle B is ${names.b}. Four regions: A only, both A and B, B only, and neither. ${shaded.length ? `Shaded: ${shaded.map((id) => REGION_NAMES[id]).join(', ')}.` : 'No regions are shaded.'}`
    : `A two-set Venn diagram for ${names.universal}. A is ${names.a}, B is ${names.b}. Current counts: A only ${counts[0]}, both ${counts[1]}, B only ${counts[2]}, neither ${counts[3]}.`
  const setCount = (index: number) => (next: number) => {
    if (locked || config.task !== 'counts') return
    const following = counts.map((n, i) => i === index ? next : n)
    setState({ counts: following })
  }
  return <div className="nodrag flex w-full max-w-[380px] flex-col gap-2 [&:has(button:focus-visible)_.sl-kbd]:block">
    <RuleBand config={config} />
    <figure className="m-0 flex w-full flex-col gap-1.5">
      <div className="relative w-full">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={seen} className="block h-auto w-full select-none">
          <rect x={0.75} y={0.75} width={W - 1.5} height={H - 1.5} rx={16} fill={PLATE} stroke={PLATE_EDGE} strokeWidth={1.5} />
          <rect x={30} y={31} width={300} height={174} rx={13} fill={UNIVERSAL} stroke={HAIR} strokeWidth={1.4} />
          {/* Four non-overlapping paths; the outside path subtracts both circles. */}
          {REGION_ORDER.map((id) => <RegionShape key={id} id={id} reduced={reduced} fill={config.task === 'shade' && shaded.includes(id) ? YELLOW : id === 'both' ? CHIP : UNIVERSAL} />)}
          <circle cx={A_CENTRE.x} cy={A_CENTRE.y} r={CIRCLE_R} fill={A_FILL} fillOpacity={config.task === 'shade' ? 0 : 0.48} stroke={A_EDGE} strokeWidth={2.2} />
          <circle cx={B_CENTRE.x} cy={B_CENTRE.y} r={CIRCLE_R} fill={B_FILL} fillOpacity={config.task === 'shade' ? 0 : 0.48} stroke={B_EDGE} strokeWidth={2.2} />
          <g fontFamily={FONT} fontSize={12} fontWeight={700} fill={SOFT}>
            <text x={44} y={48}>ℰ <tspan fontWeight={600}>universal set</tspan></text>
            <text x={100} y={17} textAnchor="middle" fill={A_EDGE}>A: {names.a}</text>
            <text x={260} y={17} textAnchor="middle" fill={B_EDGE}>B: {names.b}</text>
          </g>
          <g fontFamily={FONT} textAnchor="middle" pointerEvents="none">
            {REGION_ORDER.map((id, i) => {
              const p = REGION_POINTS[id]
              return <g key={id} transform={`translate(${p.x} ${p.y})`}>
                <text x={id === 'outside' && config.task === 'counts' ? -10 : 0} y={config.task === 'counts' && id !== 'outside' ? -4 : 4} fontSize={12} fontWeight={700} fill={id === 'outside' ? SOFT : INK}>{ids[id]}</text>
                {config.task === 'counts' && <text x={id === 'outside' ? 28 : 0} y={id === 'outside' ? 4 : 15} fontSize={15} fontWeight={800} fill={id === 'both' ? SOFT : INK} className="tabular-nums">{counts[i]}</text>}
              </g>
            })}
          </g>
        </svg>
        <RegionButtons config={config} state={state} setState={setState} locked={locked} />
      </div>
      <figcaption className="text-center text-[12px] font-bold text-ss-slate">
        {config.task === 'shade' ? 'In A? In B? Each region answers both.' : 'A total = its own part + both.'}
      </figcaption>
    </figure>

    {config.task === 'counts' && <div className="flex flex-col gap-1.5">
      <div className="flex flex-col gap-1.5">
        {(['a', 'b', 'outside'] as RegionId[]).map((id) => <Stepper key={id} id={id} value={counts[REGION_IDS.indexOf(id)]} set={setCount(REGION_IDS.indexOf(id))} locked={locked} />)}
      </div>
      <div className="flex items-center justify-between border-t border-ss-line pt-1.5">
        <span className="text-[12px] font-bold text-ss-slate">In A or B <span className="font-semibold">(overlap once)</span></span>
        <span className="text-[15px] font-extrabold tabular-nums text-ss-ink" aria-live="polite">{union}</span>
      </div>
      <p className="sl-kbd m-0 hidden text-[12px] font-semibold text-ss-slate">Tab to a count. Arrow keys change it; Home and End set its limits.</p>
    </div>}
    <Verdict marked={marked} text={text} />
  </div>
}
