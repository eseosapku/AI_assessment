'use client'
import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { SceneViewProps } from '../types'
import type { PlantConfig, PlantState } from './config'
import {
  FACTOR_NAMES, UNITS, baseOf, factorOf, levelOf, levelsOf, madeText, plantTransportEngine,
  rateAt, rateText, valueAt, valueText, working,
} from './config'

type Props = SceneViewProps<PlantConfig, PlantState>

// A light laboratory plate in both themes. Material colours belong to the apparatus; UI uses ss-* tokens.
const PLATE = '#F8FAFC'
const EDGE = '#CBD5E1'
const INK = '#16202A'
const SOFT = '#475569'
const GLASS = '#E6F0F5'
const GLASS_EDGE = '#57758A'
const WATER = '#3F8FD8'
const WATER_DARK = '#155A9C'
const WATER_PALE = '#B9DDF2'
const LEAF = '#4F8A58'
const LEAF_DARK = '#315E39'
const LEAF_LIGHT = '#78A96B'
const STEM = '#789752'
const SOIL_FREE = '#E8E2D3'
const METAL = '#94A3B8'
const CASE = '#E2E8F0'
const AMBER = '#D79B35'
const VAPOUR = '#6999B5'
const FONT = 'system-ui, sans-serif'

// Kept literal here because config and View import one another; the tests check agreement with the geometry used.
const W = 360
const H = 250
const TUBE_Y = 224
const BUBBLE_TRAVEL = 80
const VAPOUR_SPOTS = [
  [116, 43, -14, -25], [150, 38, 3, -27], [178, 57, 17, -22],
  [101, 72, -20, -10], [178, 84, 21, -9], [143, 68, 0, -29],
] as const

const ease = (reduced: boolean) => reduced ? undefined : { transition: 'transform 800ms ease, opacity 500ms ease, d 800ms ease' }
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** One water parcel's position on the continuous reservoir → stem → leaf route, t in 0..1. */
export function streamPoint(t: number): { x: number; y: number } {
  if (t < 0.2) {
    const k = t / 0.2
    return { x: 89 + (143 - 89) * k, y: 204 - 50 * k }
  }
  if (t < 0.78) {
    const k = (t - 0.2) / 0.58
    return { x: 143 + 3 * Math.sin(k * Math.PI), y: 154 - 91 * k }
  }
  const k = (t - 0.78) / 0.22
  return { x: 146 + 33 * k, y: 63 - 22 * k }
}

/** The live bubble's position; travel is proportional to the uptake rate. */
export function bubbleX(phase: number): number {
  return 264 + (phase % 1) * BUBBLE_TRAVEL
}

function Leaf({ x, y, turn, scale = 1, pale = false }: { x: number; y: number; turn: number; scale?: number; pale?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${turn}) scale(${scale})`}>
      <path d="M0 0 C-7-13-26-17-39-7 C-34 8-15 14 0 0Z" fill={pale ? LEAF_LIGHT : LEAF} stroke={LEAF_DARK} strokeWidth={1.2} strokeLinejoin="round" />
      <path d="M-2 0 Q-19-1-34-7 M-17-2 L-21-10 M-23-3 L-27 3" fill="none" stroke={LEAF_DARK} strokeWidth={0.9} strokeLinecap="round" />
    </g>
  )
}

function Shoot({ wind, wilt, reduced }: { wind: number; wilt: boolean; reduced: boolean }) {
  const bend = wind * 1.6 + (wilt ? 9 : 0)
  return (
    <g style={ease(reduced)} data-shoot="">
      {/* A real stem with two cut ends and a labelled xylem bundle inside it. */}
      <path d={`M143 202 C140 167 143 126 145 96 Q146 71 ${151 + bend} 50`} fill="none" stroke={LEAF_DARK} strokeWidth={10} strokeLinecap="round" />
      <path d={`M143 202 C140 167 143 126 145 96 Q146 71 ${151 + bend} 50`} fill="none" stroke={STEM} strokeWidth={7} strokeLinecap="round" />
      <path d={`M143 202 C140 167 143 126 145 96 Q146 71 ${151 + bend} 50`} fill="none" stroke={WATER_DARK} strokeWidth={2.8} strokeLinecap="round" data-xylem="" />
      <path d="M144 119 Q124 103 110 90 M145 88 Q163 77 174 64 M146 67 Q127 54 116 43" fill="none" stroke={STEM} strokeWidth={3.2} strokeLinecap="round" />
      <g transform={`translate(${bend * 0.25} 0) rotate(${bend * 0.3} 145 95)`}>
        <Leaf x={112} y={91} turn={-8 + bend} scale={1.02} />
        <Leaf x={174} y={65} turn={163 + bend} scale={1.06} />
        <Leaf x={117} y={44} turn={7 + bend} scale={0.95} pale />
        <Leaf x={153 + bend} y={51} turn={145 + bend} scale={0.92} />
        <Leaf x={143} y={119} turn={16 + bend} scale={0.9} pale />
      </g>
    </g>
  )
}

function Potometer({ bubble, reduced }: { bubble: number; reduced: boolean }) {
  return (
    <g>
      {/* Reservoir, with a rim, water meniscus, glass wall and a stopper around the shoot. */}
      <path d="M72 146 H101 V202 Q101 211 92 211 H81 Q72 211 72 202Z" fill={GLASS} stroke={GLASS_EDGE} strokeWidth={1.8} />
      <path d="M75 174 H98 V202 Q98 208 91 208 H82 Q75 208 75 202Z" fill={WATER_PALE} />
      <path d="M75 174 Q86 179 98 174" fill="none" stroke={WATER_DARK} strokeWidth={1.5} />
      <rect x={67} y={141} width={39} height={8} rx={3} fill={CASE} stroke={GLASS_EDGE} strokeWidth={1.5} />
      <path d="M95 183 H128 Q137 183 140 191 L143 199" fill="none" stroke={GLASS_EDGE} strokeWidth={10} strokeLinejoin="round" />
      <path d="M95 183 H128 Q137 183 140 191 L143 199" fill="none" stroke={WATER_PALE} strokeWidth={6} strokeLinejoin="round" />
      <path d="M143 199 V211 Q143 220 153 220 H264" fill="none" stroke={GLASS_EDGE} strokeWidth={10} strokeLinejoin="round" />
      <path d="M143 199 V211 Q143 220 153 220 H264" fill="none" stroke={WATER_PALE} strokeWidth={6} strokeLinejoin="round" />
      {/* Capillary: real graduations, 0 to 5 mm, with numbers apart from the moving bubble. */}
      <rect x={257} y={215} width={96} height={18} rx={8} fill={GLASS} stroke={GLASS_EDGE} strokeWidth={1.5} />
      <rect x={263} y={220} width={85} height={7} rx={3.5} fill={WATER_PALE} />
      <g stroke={SOFT} strokeWidth={1}>
        {Array.from({ length: 11 }, (_, i) => {
          const x = 264 + i * 8
          return <line key={i} x1={x} x2={x} y1={233} y2={i % 2 === 0 ? 240 : 237} />
        })}
      </g>
      <g fill={SOFT} fontFamily={FONT} fontSize={12} fontWeight={700} textAnchor="middle">
        {[0, 2, 4].map((n) => <text key={n} x={264 + n * 16} y={250}>{n}</text>)}
      </g>
      <text x={356} y={250} textAnchor="end" fill={SOFT} fontFamily={FONT} fontSize={12} fontWeight={700}>mm</text>
      <g transform={`translate(${bubble} ${TUBE_Y})`} style={reduced ? undefined : { transition: 'transform 80ms linear' }} data-bubble="">
        <ellipse rx={6.5} ry={4.2} fill="#FFFFFF" stroke={WATER_DARK} strokeWidth={1.8} />
        <path d="M-3-1.5 Q0-3 3-1.5" fill="none" stroke={EDGE} strokeWidth={1} />
      </g>
      <rect x={132} y={197} width={22} height={9} rx={2} fill={METAL} stroke={SOFT} strokeWidth={1} />
      <path d="M134 198 H152" stroke={CASE} strokeWidth={2} />
    </g>
  )
}

function Fan({ level, reduced }: { level: number; reduced: boolean }) {
  return (
    <g transform="translate(30 96)">
      <path d="M0 24 V105 M-14 105 H14" stroke={SOFT} strokeWidth={4} strokeLinecap="round" />
      <circle r={27} fill={CASE} stroke={SOFT} strokeWidth={1.8} />
      <circle r={22} fill={PLATE} stroke={METAL} strokeWidth={1} />
      <g data-fan-blades="" transform={`rotate(${level * 22})`} fill={METAL} stroke={SOFT} strokeWidth={0.8}>
        {[0, 120, 240].map((r) => <path key={r} d="M0-3 C5-20 19-19 15-8 C12-2 6 1 0 3Z" transform={`rotate(${r})`} />)}
      </g>
      <circle r={4} fill={SOFT} />
      <path d="M-22-17 A28 28 0 0 1 23-16 M-27 0 A28 28 0 0 0 26 4" fill="none" stroke={SOFT} strokeWidth={1} />
      <text x={0} y={-33} textAnchor="middle" fontFamily={FONT} fontSize={12} fontWeight={700} fill={SOFT}>fan</text>
    </g>
  )
}

function Environment({ factor, level, reduced }: { factor: ReturnType<typeof factorOf>; level: number; reduced: boolean }) {
  if (factor === 'wind') return <Fan level={level} reduced={reduced} />
  if (factor === 'temperature') {
    return (
      <g transform="translate(29 55)">
        <rect x={-15} y={91} width={43} height={10} rx={3} fill={METAL} stroke={SOFT} strokeWidth={1.2} />
        <rect x={-10} y={84} width={33} height={8} rx={2} fill={CASE} stroke={SOFT} strokeWidth={1.2} />
        <path d="M-4 84 Q-10 74-3 67 M6 84 Q0 74 7 67 M16 84 Q10 74 17 67" fill="none" stroke={AMBER} strokeWidth={2} strokeLinecap="round" opacity={0.35 + level * 0.1} />
        <rect x={0} y={0} width={13} height={72} rx={6.5} fill={GLASS} stroke={GLASS_EDGE} strokeWidth={1.4} />
        <circle cx={6.5} cy={76} r={10} fill="#C65D4B" stroke={GLASS_EDGE} strokeWidth={1.3} />
        <rect x={3.5} y={65 - level * 9} width={6} height={level * 9 + 8} rx={3} fill="#C65D4B" />
        <text x={6} y={117} textAnchor="middle" fontFamily={FONT} fontSize={12} fontWeight={700} fill={SOFT}>heater</text>
      </g>
    )
  }
  if (factor === 'light') {
    return (
      <g transform="translate(39 25)">
        <path d="M0 0 V25 L17 39" fill="none" stroke={SOFT} strokeWidth={4} strokeLinecap="round" />
        <path d="M8 32 L30 42 L19 59 L-3 49Z" fill={CASE} stroke={SOFT} strokeWidth={1.6} />
        <path d="M1 51 L-8 69 M10 56 L4 77 M20 58 L17 80" stroke={AMBER} strokeWidth={2.2} strokeLinecap="round" opacity={0.2 + level * 0.2} />
        <text x={5} y={96} textAnchor="middle" fontFamily={FONT} fontSize={12} fontWeight={700} fill={SOFT}>lamp</text>
      </g>
    )
  }
  return (
    <g>
      <path d="M61 25 H209 Q221 25 221 38 V143 H54 V40 Q54 25 61 25Z" fill={GLASS} fillOpacity={0.34} stroke={GLASS_EDGE} strokeWidth={1.5} />
      <rect x={221} y={56} width={39} height={28} rx={4} fill={CASE} stroke={SOFT} strokeWidth={1.4} />
      <circle cx={240} cy={70} r={9} fill={PLATE} stroke={SOFT} strokeWidth={1.1} />
      <path d={`M240 70 L${234 + level * 2.3} ${64 + level * 0.5}`} stroke={INK} strokeWidth={1.5} strokeLinecap="round" />
      <text x={240} y={99} textAnchor="middle" fontFamily={FONT} fontSize={12} fontWeight={700} fill={SOFT}>humidity</text>
    </g>
  )
}

const STEP = 'nodrag flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-lg border-2 border-ss-line bg-ss-panel text-[16px] font-extrabold leading-none text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'

function Stepper({ config, level, locked, set }: { config: PlantConfig; level: number; locked: boolean; set(next: number): void }) {
  const id = useId()
  const factor = factorOf(config)
  const max = levelsOf(config).length - 1
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const held = useRef(false)
  const latest = useRef({ level, locked, set })
  latest.current = { level, locked, set }
  const stop = () => { if (timer.current) clearTimeout(timer.current); timer.current = null }
  useEffect(() => stop, [])
  const bump = (by: number): boolean => {
    const l = latest.current
    if (l.locked) return false
    const next = clamp(l.level + by, 0, max)
    if (next === l.level) return false
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
        if (bump(by)) tick(120)
        else stop()
      }, wait)
    }
    tick(450)
  }
  const click = (by: number) => () => {
    if (held.current) { held.current = false; return }
    bump(by)
  }
  const onKey = (e: KeyboardEvent) => {
    const by = ({ ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 2, PageDown: -2, '+': 1, '=': 1, '-': -1 } as Record<string, number>)[e.key]
    if (by === undefined && e.key !== 'Home' && e.key !== 'End') return
    e.preventDefault()
    e.stopPropagation()
    if (e.key === 'Home') set(0)
    else if (e.key === 'End') set(max)
    else bump(by)
  }
  return (
    <div className="flex items-center justify-between gap-2">
      <span id={id} className="text-[12px] font-bold text-ss-slate">{FACTOR_NAMES[factor]}</span>
      <span className="flex items-center gap-1">
        <button type="button" tabIndex={-1} aria-label={`Decrease ${FACTOR_NAMES[factor].toLowerCase()}`} disabled={locked || level <= 0} onPointerDown={hold(-1)} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop} onClick={click(-1)} className={STEP}>−</button>
        <span
          role="spinbutton" tabIndex={locked ? -1 : 0} aria-labelledby={id} aria-valuemin={0} aria-valuemax={max}
          aria-valuenow={level} aria-valuetext={valueText(config, level)} aria-disabled={locked || undefined} onKeyDown={onKey}
          className="nodrag min-w-[76px] rounded-md px-1 text-center text-[15px] font-extrabold tabular-nums text-ss-ink outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--subject)]"
        >{valueAt(config, level)} <span className="text-[12px] font-bold text-ss-slate">{UNITS[factor]}</span></span>
        <button type="button" tabIndex={-1} aria-label={`Increase ${FACTOR_NAMES[factor].toLowerCase()}`} disabled={locked || level >= max} onPointerDown={hold(1)} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop} onClick={click(1)} className={STEP}>+</button>
      </span>
    </div>
  )
}

export function PlantTransportView({ config, state, setState, marked, reduced, locked }: Props) {
  const current = marked === 'shown' ? plantTransportEngine.solve(config) : state
  const level = Math.max(0, levelOf(config, current))
  const factor = factorOf(config)
  const rate = rateAt(config, level)
  const base = baseOf(config)
  const svg = useRef<SVGSVGElement>(null)
  const [still, setStill] = useState(0.18)
  const phase = useRef(0.18)
  const fanPhase = useRef(0)
  const lastRate = useRef(rate)
  lastRate.current = rate

  useEffect(() => {
    if (reduced) { setStill(0.18 + (level * 0.17) % 1); return }
    let raf = 0
    let last = 0
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick)
      const dt = last ? Math.min(0.06, (t - last) / 1000) : 0.016
      last = t
      phase.current = (phase.current + dt * (0.055 + lastRate.current * 0.09)) % 1
      fanPhase.current += dt * (8 + level * 18)
      const el = svg.current
      if (el) {
        el.querySelector('[data-bubble]')?.setAttribute('transform', `translate(${bubbleX(phase.current)} ${TUBE_Y})`)
        el.querySelector('[data-fan-blades]')?.setAttribute('transform', `rotate(${fanPhase.current})`)
        el.querySelectorAll<SVGGElement>('[data-parcel]').forEach((node, i) => {
          const p = streamPoint((phase.current + i / 5) % 1)
          node.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`)
        })
        el.querySelectorAll<SVGGElement>('[data-vapour]').forEach((node, i) => {
          const p = (phase.current * 1.7 + i / 6) % 1
          node.setAttribute('transform', `translate(${(p * 11).toFixed(1)} ${(-p * 19).toFixed(1)})`)
          node.setAttribute('opacity', String(Math.sin(p * Math.PI) * 0.72))
        })
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [reduced, level])

  const set = (next: number) => { if (!locked) setState({ level: next }) }
  const shownPhase = reduced ? still : phase.current
  const speed = clamp(rate / 1.9, 0.08, 1)
  const vapourCount = rate <= 0.55 ? 2 : rate <= 0.75 ? 3 : rate < 1.3 ? 4 : 6
  const wilt = rate > 1.65
  const targetBand = config.task === 'match' ? `Aim ${rateText(config.target)} ± 0.10 mm/min` : `Aim at least ${rateText(config.target)} mm/min`
  const aria = `A leafy cut shoot in a bubble potometer. ${FACTOR_NAMES[factor]} is ${valueText(config, level)}. Water uptake is ${rateText(rate)} millimetres per minute. ${targetBand}.`

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-2" onKeyDown={(e) => { if (e.key.startsWith('Arrow')) e.stopPropagation() }}>
      <figure className="m-0 flex w-full flex-col gap-1.5">
        <svg ref={svg} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={aria} className="block h-auto w-full select-none">
          <rect x={0.75} y={0.75} width={W - 1.5} height={H - 1.5} rx={16} fill={PLATE} stroke={EDGE} strokeWidth={1.5} />
          <Environment factor={factor} level={level} reduced={reduced} />
          <Shoot wind={factor === 'wind' ? level : 0} wilt={wilt} reduced={reduced} />
          <Potometer bubble={bubbleX(shownPhase)} reduced={reduced} />
          {/* Five separate parcels make the column's motion visible; the thin blue xylem is always continuous. */}
          {Array.from({ length: 5 }, (_, i) => {
            const p = streamPoint((shownPhase + i / 5) % 1)
            return (
              <g key={i} data-parcel="" transform={`translate(${p.x} ${p.y})`}>
                <rect x={-3.5} y={-5} width={7} height={10} rx={3.5} fill={WATER} stroke="#FFFFFF" strokeWidth={1.2} />
              </g>
            )
          })}
          {/* Water vapour: small outlined droplets, named beside the leaf, never rain from the sky. */}
          {VAPOUR_SPOTS.slice(0, vapourCount).map(([x, y], i) => (
            <g key={i} transform={`translate(${x} ${y})`}>
              <g data-vapour="" opacity={0.55}>
                <circle r={2.6} fill="#FFFFFF" stroke={VAPOUR} strokeWidth={1.2} />
              </g>
            </g>
          ))}
          <g fontFamily={FONT} fontSize={12} fontWeight={700} fill={SOFT}>
            <text x={273} y={38}>water vapour</text>
            <path d="M265 42 H226 L196 48" fill="none" stroke={VAPOUR} strokeWidth={1.1} />
            <text x={178} y={137}>xylem</text>
            <path d="M172 140 H158 L146 153" fill="none" stroke={WATER_DARK} strokeWidth={1.1} />
            <text x={16} y={194} stroke={PLATE} strokeWidth={4} strokeLinejoin="round" paintOrder="stroke">water</text>
            <path d="M51 190 H63 L72 181" fill="none" stroke={WATER_DARK} strokeWidth={1.1} />
            <text x={220} y={199}>air bubble</text>
            <path d="M269 202 V211" stroke={SOFT} strokeWidth={1.1} />
          </g>
        </svg>
        <figcaption className="text-center text-[12px] font-bold text-ss-slate">The bubble measures water uptake.</figcaption>
      </figure>

      <div className="flex flex-col gap-1.5">
        <Stepper config={config} level={level} locked={locked} set={set} />
        <div className="grid grid-cols-2 gap-x-4 border-t border-ss-line pt-1.5">
          <p className="flex items-baseline justify-between gap-1">
            <span className="text-[12px] font-bold text-ss-slate">Water uptake</span>
            <span className="whitespace-nowrap text-[15px] font-extrabold tabular-nums text-ss-ink" data-rate="">{rateText(rate)} <span className="text-[12px] font-bold text-ss-slate">mm/min</span></span>
          </p>
          <p className="flex items-baseline justify-between gap-1">
            <span className="text-[12px] font-bold text-ss-slate">From room</span>
            <span className="text-[15px] font-extrabold tabular-nums text-ss-ink">{Math.abs(level - base)} {Math.abs(level - base) === 1 ? 'step' : 'steps'}</span>
          </p>
        </div>
        <p className="text-center text-[12px] font-bold text-ss-slate">{targetBand} · Room: {valueText(config, base)}</p>
      </div>
      <span className="sr-only" aria-live="polite">Water uptake {rateText(rate)} millimetres per minute.</span>
      {marked !== 'idle' && (
        <div className="rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2" aria-live="polite">
          <p className="text-[13px] font-extrabold leading-snug text-ss-ink">{marked === 'wrong' ? madeText(config, current) : working(config, current)}</p>
        </div>
      )}
    </div>
  )
}
