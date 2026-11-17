'use client'
import { useId, type KeyboardEvent, type PointerEvent } from 'react'
import type { SceneViewProps } from '../types'
import type { NuclearConfig, NuclearState } from './config'
import { ABSORB_AT, madeDepth, madeSqueeze, madeText, nextFissions, nuclearFissionEngine, working } from './config'

type Props = SceneViewProps<NuclearConfig, NuclearState>

// A quiet light plate in both themes, as measure-shape's and bonding's. Apparatus keeps its material colours.
const PLATE = '#F8FAFC'
const EDGE = '#CBD5E1'
const INK = '#263548'
const SOFT = '#526277'

const STEEL = '#8493A3'
const STEEL_EDGE = '#445568'
const STEEL_LIGHT = '#D6DEE5'
const BORON = '#465466'
const GRAPHITE = '#E2E7EB'
const FUEL = '#E6B867'
const FUEL_EDGE = '#815B25'
const DAUGHTER = '#C88762'
const DAUGHTER_EDGE = '#7A4934'
const PROTON = '#D96560'
const NEUTRON = '#D8DEE5'
const FREE_NEUTRON = '#3985B9'
const FREE_EDGE = '#1F567D'
const GOLD = '#D99B28'
const GOLD_EDGE = '#8A5A12'
const WHITE = '#FFFFFF'
const FONT = 'system-ui, sans-serif'

// Geometry is local to the view: config.ts imports this file, so no top-level config constant is read here.
export const W = 360
export const REACTOR_H = 312
export const FUSION_H = 238
export const ROD_X = [86, 180, 274] as const
export const ROD_TOP = (depth: number) => 160 - depth * 14
export const CORE_X = 47
export const CORE_W = 266
const ROD_W = 32
const TRAVEL = 32
const f1 = (n: number) => Number(n.toFixed(1))

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const EASE = 'transform 650ms ease-out, opacity 450ms ease-out, fill 500ms ease-out'
const ease = (reduced: boolean) => (reduced ? {} : { transition: EASE })

function Nucleon({ x, y, kind = 'p', r = 4.3 }: { x: number; y: number; kind?: 'p' | 'n'; r?: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={kind === 'p' ? PROTON : NEUTRON} stroke={kind === 'p' ? '#8F3E3B' : '#718094'} strokeWidth={0.75} />
      {kind === 'p' && <path d={`M ${x - r * 0.48} ${y} H ${x + r * 0.48} M ${x} ${y - r * 0.48} V ${y + r * 0.48}`} stroke={WHITE} strokeWidth={1.1} strokeLinecap="round" />}
    </g>
  )
}

function Energy({ x, y, small = false }: { x: number; y: number; small?: boolean }) {
  const rays = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4
    const inner = small ? 12 : 17
    const outer = small ? 18 : 26
    return <line key={i} x1={x + Math.cos(a) * inner} y1={y + Math.sin(a) * inner} x2={x + Math.cos(a) * outer} y2={y + Math.sin(a) * outer} />
  })
  return (
    <g stroke={GOLD} strokeWidth={small ? 2 : 2.8} strokeLinecap="round" data-energy="1">
      {rays}
      <circle cx={x} cy={y} r={small ? 5 : 7} fill={GOLD} stroke={GOLD_EDGE} strokeWidth={1} />
    </g>
  )
}

/** A uranium-235 teaching nucleus: a heavy warm cluster, never a cloud of 235 illegible dots. */
function Uranium({ x, y, small = false }: { x: number; y: number; small?: boolean }) {
  const r = small ? 2.8 : 4
  const pts = small ? [[-3, -3], [3, -3], [-3, 3], [3, 3]] : [[-5, -5], [5, -5], [-5, 5], [5, 5], [0, 0]]
  return (
    <g>
      <circle cx={x} cy={y} r={small ? 10 : 15} fill={FUEL} stroke={FUEL_EDGE} strokeWidth={1.4} />
      {pts.map(([dx, dy], i) => (
        <g key={i} transform={`translate(${x + dx} ${y + dy})`}>
          <circle r={r + 0.01} fill={i % 2 ? NEUTRON : PROTON} stroke={i % 2 ? '#718094' : '#8F3E3B'} strokeWidth={0.75} />
          {i % 2 === 0 && <path d={`M${-(r + 0.01) * 0.48} 0H${(r + 0.01) * 0.48}M0 ${-(r + 0.01) * 0.48}V${(r + 0.01) * 0.48}`} stroke={WHITE} strokeWidth={1.1} strokeLinecap="round" />}
        </g>
      ))}
    </g>
  )
}

function Daughters({ x, y, small = false }: { x: number; y: number; small?: boolean }) {
  const gap = small ? 7 : 10
  return (
    <g>
      {[-1, 1].map((side) => (
        <g key={side}>
          <circle cx={x + side * gap} cy={y} r={small ? 6.5 : 9} fill={DAUGHTER} stroke={DAUGHTER_EDGE} strokeWidth={1.2} />
          <g transform={`translate(${x + side * gap} ${y})`}>
            <circle cx={-2} cy={0} r={small ? 2.21 : 2.81} fill={PROTON} stroke="#8F3E3B" strokeWidth={0.75} />
            <path d={small ? 'M-3 0h2 M-2-1v2' : 'M-3.3 0h2.6 M-2-1.3v2.6'} stroke={WHITE} strokeWidth={0.8} />
            <circle cx={2.5} cy={0.5} r={small ? 2.21 : 2.81} fill={NEUTRON} stroke="#718094" strokeWidth={0.75} />
          </g>
        </g>
      ))}
    </g>
  )
}

function FreeNeutron({ x, y, r = 4.5 }: { x: number; y: number; r?: number }) {
  return <circle cx={x} cy={y} r={r} fill={FREE_NEUTRON} stroke={WHITE} strokeWidth={1.2} data-neutron="1" />
}

/** One fission, split visibly into daughters, a gold energy release and three departing blue neutrons. */
function Fission({ x, y, small = false }: { x: number; y: number; small?: boolean }) {
  return (
    <g data-fission="1">
      <Energy x={x} y={y} small={small} />
      <Daughters x={x} y={y} small={small} />
      <FreeNeutron x={x - 13} y={y - (small ? 13 : 20)} r={small ? 3.3 : 4} />
      <FreeNeutron x={x} y={y - (small ? 16 : 23)} r={small ? 3.3 : 4} />
      <FreeNeutron x={x + 13} y={y - (small ? 13 : 20)} r={small ? 3.3 : 4} />
    </g>
  )
}

function Label({ x, y, children, anchor = 'middle', fill = SOFT, size = 12 }: { x: number; y: number; children: string; anchor?: 'start' | 'middle' | 'end'; fill?: string; size?: number }) {
  return <text x={x} y={y} textAnchor={anchor} fontFamily={FONT} fontSize={size} fontWeight={700} fill={fill}>{children}</text>
}

function ReactorPicture({ depth, reduced }: { depth: number; reduced: boolean }) {
  const top = ROD_TOP(depth)
  const next = nextFissions(depth)
  const surviving = ABSORB_AT.flatMap((at, i) => (at > depth ? [i] : []))
  return (
    <>
      <rect x={0.75} y={0.75} width={W - 1.5} height={REACTOR_H - 1.5} rx={16} fill={PLATE} stroke={EDGE} strokeWidth={1.5} />
      <Label x={20} y={24} anchor="start" fill={INK}>Cutaway reactor core</Label>
      <Label x={340} y={24} anchor="end">Uranium-235</Label>
      <Label x={24} y={64} anchor="start">Earlier split</Label>
      <Fission x={180} y={61} />
      <path d="M180 86V96" stroke={GOLD} strokeWidth={1.8} strokeLinecap="round" />
      <Label x={20} y={104} anchor="start">Previous</Label>
      <Label x={20} y={119} anchor="start">fissions</Label>
      {ROD_X.map((x) => <Fission key={x} x={x} y={111} small />)}
      {/* The graphite block is behind the events, with quiet machining marks and no competing particles. */}
      <rect x={CORE_X} y={134} width={CORE_W} height={122} rx={8} fill={GRAPHITE} stroke="#9BAAB8" strokeWidth={1.4} />
      {Array.from({ length: 10 }, (_, i) => <path key={i} d={`M${58 + i * 26} 249h12`} stroke="#B4BEC7" strokeWidth={2} strokeLinecap="round" />)}
      {/* The block's name lives in the legend: inside the block, the moving rods ran across it. */}
      {/* Each of the previous three has three departing neutrons. They meet the rods before the output row. */}
      {ROD_X.map((x) => (
        <g key={x}>
          {[-1, 0, 1].map((n) => <path key={n} d={`M${x + n * 13} 98L${x + n * 13} 226`} stroke={FREE_NEUTRON} strokeWidth={1.2} opacity={0.45} />)}
        </g>
      ))}
      {/* Rods sit in clear gaps between the generations; no nucleus is ever underneath a rod. */}
      <g data-rod-bank="1" transform={`translate(0 ${f1(top)})`} style={ease(reduced)}>
        <rect x={66} y={0} width={228} height={10} rx={4} fill={STEEL_EDGE} />
        <rect x={70} y={2} width={220} height={3} rx={1.5} fill={STEEL_LIGHT} />
        {ROD_X.map((x) => (
          <g key={x}>
            <rect x={x - ROD_W / 2} y={8} width={ROD_W} height={TRAVEL} rx={4} fill={BORON} stroke="#27364A" strokeWidth={1.4} />
            <rect x={x - ROD_W / 2 + 4} y={12} width={5} height={TRAVEL - 9} rx={2.5} fill="#718197" />
            {Array.from({ length: 5 }, (_, i) => <line key={i} x1={x + 4} x2={x + 11} y1={24 + i * 12} y2={24 + i * 12} stroke="#91A0B2" strokeWidth={1.5} />)}
          </g>
        ))}
        <rect x={157} y={-15} width={46} height={14} rx={5} fill={STEEL_LIGHT} stroke={STEEL_EDGE} strokeWidth={1.5} />
        <path d="M169-8h22M173-12v8M187-12v8" stroke={STEEL_EDGE} strokeWidth={1.6} strokeLinecap="round" />
        <path d="M301-8v17m-5-5 5 5 5-5" fill="none" stroke={SOFT} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      </g>
      {/* Nine neutron endpoints are clear of the products. A gold cross means this rod absorbed that neutron. */}
      {ABSORB_AT.map((at, i) => {
        const parent = ROD_X[Math.floor(i / 3)]
        const x = parent + (i % 3 - 1) * 13
        const hitY = at === 4 ? 228 : ROD_TOP(at) + 24
        const hitsRod = at <= depth
        return (
          <g key={i}>
            <FreeNeutron x={x} y={hitsRod ? hitY : 222} r={4.1} />
            {hitsRod && (
              <g transform={`translate(${x} ${hitY})`} stroke={GOLD_EDGE} strokeWidth={1.5} strokeLinecap="round" data-absorbed="1">
                <path d="M-5-5L5 5M5-5L-5 5" />
                <circle r={7} fill="none" stroke={GOLD} />
              </g>
            )}
          </g>
        )
      })}
      {/* Evenly spread products: three groups of three, rather than a continuous crowded row. */}
      {surviving.map((branch, i) => {
        const parent = ROD_X[Math.floor(branch / 3)]
        // Spread each group of three around its own parent; counting across all nine pushed the outer groups off the panel.
        const group = surviving.filter((b) => Math.floor(b / 3) === Math.floor(branch / 3))
        const x = parent + (group.indexOf(branch) - (group.length - 1) / 2) * 27
        return <Fission key={`${depth}-${branch}`} x={x} y={244} small />
      })}
      <Label x={180} y={275}>Grey block: graphite moderator</Label>
      <Label x={180} y={290} fill={GOLD_EDGE}>Gold burst: energy released</Label>
      <Label x={180} y={305}>Blue: neutrons</Label>
    </>
  )
}

function Deuterium({ x, y }: { x: number; y: number }) {
  return (
    <g data-deuterium="1">
      <circle cx={x} cy={y} r={10} fill={WHITE} stroke={EDGE} strokeWidth={1} />
      <g transform={`translate(${x} ${y})`}>
        <circle cx={-3.7} cy={0} r={4.71} fill={PROTON} stroke="#8F3E3B" strokeWidth={0.75} />
        <path d="M-6 0h4.6M-3.7-2.3v4.6" stroke={WHITE} strokeWidth={1.1} strokeLinecap="round" />
        <circle cx={4} cy={0.5} r={4.71} fill={NEUTRON} stroke="#718094" strokeWidth={0.75} />
      </g>
    </g>
  )
}

function FusionProduct({ x, y }: { x: number; y: number }) {
  return (
    <g data-fused="1">
      <Energy x={x} y={y} small />
      <circle cx={x} cy={y} r={12} fill={WHITE} stroke={GOLD} strokeWidth={1.4} />
      <g transform={`translate(${x} ${y})`}>
        {[[-4, -3], [4.5, -2]].map(([px, py]) => <g key={px}><circle cx={px} cy={py} r={4.71} fill={PROTON} stroke="#8F3E3B" strokeWidth={0.75} /><path d={`M${px - 2.3} ${py}h4.6M${px} ${py - 2.3}v4.6`} stroke={WHITE} strokeWidth={1.1} strokeLinecap="round" /></g>)}
        <circle cx={0} cy={5} r={4.71} fill={NEUTRON} stroke="#718094" strokeWidth={0.75} />
      </g>
    </g>
  )
}

function FusionPicture({ squeeze, pairs, reduced }: { squeeze: number; pairs: number; reduced: boolean }) {
  const gap = 142 - squeeze * 29
  const leftEdge = 180 - gap / 2
  const rightEdge = 180 + gap / 2
  const fused = squeeze === 4
  const ys = pairs === 1 ? [130] : [94, 164]
  return (
    <>
      <rect x={0.75} y={0.75} width={W - 1.5} height={FUSION_H - 1.5} rx={16} fill={PLATE} stroke={EDGE} strokeWidth={1.5} />
      <Label x={20} y={23} anchor="start" fill={INK}>Deuterium fuel</Label>
      <Label x={340} y={23} anchor="end" fill={GOLD_EDGE}>15 million °C</Label>
      <rect x={45} y={39} width={270} height={176} rx={14} fill="#E9EEF2" stroke="#9BAAB8" strokeWidth={1.4} />
      {/* The pellet has room around it: no tinted glow, just a hot chamber with its fuel. */}
      <rect x={leftEdge} y={45} width={gap} height={164} rx={6} fill="#F4E8CF" stroke="#C7A675" strokeWidth={1.2} style={reduced ? {} : { transition: 'x 650ms ease-out, width 650ms ease-out' }} />
      {ys.map((y, row) => {
        const base = 180
        const approach = 39 - squeeze * 8
        const sep = fused ? 0 : approach
        const bend = fused ? 0 : squeeze * 5
        const x1 = base - sep
        const x2 = base + sep
        const yy1 = y - bend
        const yy2 = y + bend
        if (fused) return <g key={y}><FusionProduct x={base} y={y} /><FreeNeutron x={base + 27} y={y} r={4.5} /></g>
        return (
          <g key={y}>
            <path d={`M${leftEdge + 14} ${y} Q${base - 18} ${y - 20} ${x1} ${yy1}`} fill="none" stroke="#A6B2BD" strokeWidth={1.4} strokeDasharray="3 3" />
            <path d={`M${rightEdge - 14} ${y} Q${base + 18} ${y + 20} ${x2} ${yy2}`} fill="none" stroke="#A6B2BD" strokeWidth={1.4} strokeDasharray="3 3" />
            <g style={ease(reduced)}>
              <Deuterium x={x1} y={yy1} />
              <Deuterium x={x2} y={yy2} />
            </g>
            <path d={`M${base - 10} ${y - 8}l4-4m-4 4h4v-4M${base + 10} ${y + 8}l-4 4m4-4h-4v4`} fill="none" stroke={PROTON} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" data-repulsion="1" />
          </g>
        )
      })}
      {/* Thick machined plates with grips. They visibly close; the whole right plate is also a drag handle. */}
      <g data-left-plate="1" style={ease(reduced)}>
        <rect x={leftEdge - 28} y={38} width={28} height={178} rx={5} fill={STEEL} stroke={STEEL_EDGE} strokeWidth={1.5} />
        <rect x={leftEdge - 24} y={44} width={6} height={166} rx={3} fill={STEEL_LIGHT} />
        {Array.from({ length: 5 }, (_, i) => <path key={i} d={`M${leftEdge - 14} ${71 + i * 28}H${leftEdge - 5}`} stroke={STEEL_EDGE} strokeWidth={1.4} />)}
      </g>
      <g data-right-plate="1" style={ease(reduced)}>
        <rect x={rightEdge} y={38} width={28} height={178} rx={5} fill={STEEL} stroke={STEEL_EDGE} strokeWidth={1.5} />
        <rect x={rightEdge + 18} y={44} width={6} height={166} rx={3} fill={STEEL_LIGHT} />
        {Array.from({ length: 5 }, (_, i) => <path key={i} d={`M${rightEdge + 5} ${71 + i * 28}H${rightEdge + 14}`} stroke={STEEL_EDGE} strokeWidth={1.4} />)}
      </g>
      <path d="M150 224h60m-6-4 6 4-6 4m-48-8-6 4 6 4" fill="none" stroke={SOFT} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Label x={180} y={236} size={12}>Steel press plates</Label>
    </>
  )
}

const STEP = 'nodrag flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-lg border-2 border-ss-line bg-ss-panel text-[16px] font-extrabold leading-none text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none whitespace-nowrap'

function Stepper({ label, noun, value, max, locked, set }: { label: string; noun: string; value: number; max: number; locked: boolean; set(n: number): void }) {
  const id = useId()
  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const by = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0
    if (!by && e.key !== 'Home' && e.key !== 'End') return
    e.preventDefault()
    e.stopPropagation()
    set(e.key === 'Home' ? 0 : e.key === 'End' ? max : clamp(value + by, 0, max))
  }
  return (
    <div className="flex items-center justify-between gap-2">
      <span id={id} className="text-[12px] font-bold text-ss-slate">{label}</span>
      <span className="flex items-center gap-1">
        <button type="button" aria-label={`Raise ${noun}`} disabled={locked || value <= 0} onClick={() => set(value - 1)} className={STEP}>{'\u2212'}</button>
        <button
          type="button" role="slider" aria-labelledby={id} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}
          aria-valuetext={`${value} of ${max}`} disabled={locked} onKeyDown={onKey}
          className="nodrag min-w-[38px] rounded-md px-1 text-center text-[15px] font-extrabold tabular-nums text-ss-ink outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--subject)]"
        >{value}</button>
        <button type="button" aria-label={`Lower ${noun}`} disabled={locked || value >= max} onClick={() => set(value + 1)} className={STEP}>+</button>
      </span>
    </div>
  )
}

export function NuclearFissionView({ config, state, setState, marked, reduced, locked }: Props) {
  const now = marked === 'shown' ? nuclearFissionEngine.solve(config) : state
  const reactor = config.task === 'reactor'
  const depth = madeDepth(now)
  const squeeze = madeSqueeze(now)
  const pairs = config.task === 'fusion' && (config.pairs === 1 || config.pairs === 2) ? config.pairs : 2
  const height = reactor ? REACTOR_H : FUSION_H
  const set = (value: number) => {
    if (locked) return
    setState(reactor ? { depth: clamp(value, 0, 4) } : { squeeze: clamp(value, 0, 4) })
  }
  const value = reactor ? depth : squeeze

  const drag = (kind: 'reactor' | 'fusion') => (e: PointerEvent<SVGRectElement>) => {
    if (locked || e.button !== 0) return
    e.preventDefault()
    // React clears currentTarget once this handler returns, so the later move and up listeners keep the element itself.
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    const svg = el.ownerSVGElement!
    const start = svg.createSVGPoint()
    start.x = e.clientX
    start.y = e.clientY
    const p = start.matrixTransform(svg.getScreenCTM()!.inverse())
    const initial = value
    const move = (ev: globalThis.PointerEvent) => {
      const point = svg.createSVGPoint()
      point.x = ev.clientX
      point.y = ev.clientY
      const q = point.matrixTransform(svg.getScreenCTM()!.inverse())
      const delta = kind === 'reactor' ? (q.y - p.y) / 14 : (Math.abs(q.x - 180) - Math.abs(p.x - 180)) / -29
      set(Math.round(initial + delta))
    }
    const up = (ev: globalThis.PointerEvent) => {
      move(ev)
      el.releasePointerCapture(ev.pointerId)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
  }
  const onKey = (e: KeyboardEvent<SVGRectElement>) => {
    const positive = reactor ? ['ArrowDown', 'ArrowRight'] : ['ArrowRight', 'ArrowUp']
    const negative = reactor ? ['ArrowUp', 'ArrowLeft'] : ['ArrowLeft', 'ArrowDown']
    const by = positive.includes(e.key) ? 1 : negative.includes(e.key) ? -1 : 0
    if (!by && e.key !== 'Home' && e.key !== 'End') return
    e.preventDefault()
    e.stopPropagation()
    set(e.key === 'Home' ? 0 : e.key === 'End' ? 4 : value + by)
  }

  const rodTop = ROD_TOP(depth)
  const gap = 142 - squeeze * 29
  const rightPlate = 180 + gap / 2
  const described = reactor
    ? `A cutaway reactor core. One earlier split led to three fissions. Three control rods at depth ${depth} of 4 intercept some neutrons. ${nextFissions(depth)} new fissions are shown. Gold bursts mark released energy; blue circles are neutrons. The graphite moderator is fixed.`
    : `A steel press at 15 million degrees Celsius. ${pairs === 1 ? 'One pair' : 'Two pairs'} of deuterium nuclei are inside. Press setting ${squeeze} of 4. ${squeeze === 4 ? 'Each pair has joined into one nucleus, releasing a blue neutron and energy.' : 'Each pair approaches and swerves apart without joining.'}`
  const verdict = marked === 'right' || marked === 'shown' ? working(config) : marked === 'wrong' ? madeText(config, state) : ''

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-2">
      <figure className="m-0 flex w-full flex-col gap-1.5">
        <div className="relative w-full">
          <svg viewBox={`0 0 ${W} ${height}`} role="img" aria-label={described} className="block h-auto w-full select-none" fontFamily={FONT}>
            {reactor ? <ReactorPicture depth={depth} reduced={reduced} /> : <FusionPicture squeeze={squeeze} pairs={pairs} reduced={reduced} />}
            {!locked && marked !== 'right' && marked !== 'shown' && reactor && (
              <rect
                data-rod-handle="1" x={63} y={rodTop - 18} width={245} height={34} rx={7} fill="transparent"
                role="slider" tabIndex={0} aria-label="Control rod depth" aria-valuemin={0} aria-valuemax={4} aria-valuenow={depth}
                className="cursor-grab touch-none outline-none focus-visible:stroke-[color:var(--subject)] focus-visible:stroke-2 active:cursor-grabbing"
                onPointerDown={drag('reactor')} onKeyDown={onKey}
              />
            )}
            {!locked && marked !== 'right' && marked !== 'shown' && !reactor && (
              <rect
                data-press-handle="1" x={rightPlate - 3} y={35} width={36} height={184} rx={7} fill="transparent"
                role="slider" tabIndex={0} aria-label="Steel press closing" aria-valuemin={0} aria-valuemax={4} aria-valuenow={squeeze}
                className="cursor-grab touch-none outline-none focus-visible:stroke-[color:var(--subject)] focus-visible:stroke-2 active:cursor-grabbing"
                onPointerDown={drag('fusion')} onKeyDown={onKey}
              />
            )}
          </svg>
        </div>
        <figcaption className="text-center text-[12px] font-bold leading-snug text-ss-slate">
          {reactor ? 'Rods absorb neutrons; the moderator slows them.' : 'Positive nuclei repel. Squeeze the hot fuel to make them join.'}
        </figcaption>
      </figure>
      <div className="flex flex-col gap-1.5 border-t border-ss-line pt-1.5">
        <Stepper label={reactor ? 'Control rod depth' : 'Press closing'} noun={reactor ? 'the control rods' : 'the press'} value={value} max={4} locked={locked} set={set} />
        {reactor && (
          <div className="grid grid-cols-2 gap-x-6">
            <p className="flex items-baseline justify-between gap-1"><span className="text-[12px] font-bold text-ss-slate">Previous fissions</span><span className="text-[15px] font-extrabold tabular-nums text-ss-ink">3</span></p>
            <p className="flex items-baseline justify-between gap-1"><span className="text-[12px] font-bold text-ss-slate">New fissions</span><span className="text-[15px] font-extrabold tabular-nums text-ss-ink" data-next-fissions={nextFissions(depth)}>{nextFissions(depth)}</span></p>
          </div>
        )}
      </div>
      {marked !== 'idle' && (
        <div className="rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2" aria-live="polite">
          <p className="text-[13px] font-extrabold leading-snug text-ss-ink">{verdict}</p>
        </div>
      )}
    </div>
  )
}
