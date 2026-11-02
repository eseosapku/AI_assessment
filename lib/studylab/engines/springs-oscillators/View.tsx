'use client'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { SceneViewProps } from '../types'
import type { SpringsConfig, SpringsState } from './config'
import { answerMasses, extensionFor, fmt, madeText, springsEngine, working } from './config'

type Props = SceneViewProps<SpringsConfig, SpringsState>

const BG = '#111827'
const COIL = '#38BDF8'
const MASS_C = '#F59E0B'
const WHITE = '#F2F5F8'
const DIM = '#6B7280'
const BAR_C = '#4B5563'
const HALO = { stroke: BG, strokeWidth: 3.5, paintOrder: 'stroke', strokeLinejoin: 'round' } as const

export const W = 360
export const H = 296
export const CX = 180
export const BAR_Y = 10
const BAR_HALF = 50
export const SPRING_TOP = 18
export const REST = 36
export const PX = 14
export const HOOK = 3
export const BLK_W = 30
export const BLK_H = 14
const COILS = 6
const AMP = 14
const BTN_R = 20
const BTN_LX = 52
const BTN_RX = 308
const BTN_Y = 160

const f = (n: number) => n.toFixed(1)

export const springBot = (m: number) => SPRING_TOP + REST + m * PX
export const hookBot = (m: number) => springBot(m) + HOOK
export const stackBot = (m: number) => hookBot(m) + m * BLK_H

export function springPath(masses: number): string {
  const top = SPRING_TOP
  const bot = springBot(masses)
  const n = COILS * 2
  const totalLen = bot - top
  const lead = Math.min(5, totalLen / 4)
  const zigLen = totalLen - 2 * lead
  if (zigLen <= 0) return `M ${CX} ${f(top)} L ${CX} ${f(bot)}`
  const step = zigLen / (n + 1)
  const zigTop = top + lead
  let d = `M ${CX} ${f(top)}`
  for (let i = 1; i <= n; i++) {
    const x = i % 2 === 1 ? CX + AMP : CX - AMP
    d += ` L ${f(x)} ${f(zigTop + i * step)}`
  }
  d += ` L ${CX} ${f(bot)}`
  return d
}

function useSpringBounce(target: number, reduced: boolean): number {
  const [shown, setShown] = useState(target)
  const pos = useRef(target)
  const vel = useRef(0)

  useEffect(() => {
    if (reduced) {
      pos.current = target
      vel.current = 0
      setShown(target)
      return
    }
    let raf = 0
    let prev = 0
    const tick = (t: number) => {
      const dt = prev ? Math.min(0.04, (t - prev) / 1000) : 0
      prev = t
      if (dt === 0) { raf = requestAnimationFrame(tick); return }
      const a = 150 * (target - pos.current) - 12 * vel.current
      vel.current += a * dt
      pos.current += vel.current * dt
      if (Math.abs(target - pos.current) < 0.05 && Math.abs(vel.current) < 0.5) {
        pos.current = target
        vel.current = 0
        setShown(target)
        return
      }
      setShown(pos.current)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, reduced])

  return reduced ? target : shown
}

function animatedPath(m: number): string {
  const top = SPRING_TOP
  const bot = SPRING_TOP + REST + m * PX
  const n = COILS * 2
  const totalLen = bot - top
  const lead = Math.min(5, totalLen / 4)
  const zigLen = totalLen - 2 * lead
  if (zigLen <= 0) return `M ${CX} ${f(top)} L ${CX} ${f(bot)}`
  const step = zigLen / (n + 1)
  const zigTop = top + lead
  let d = `M ${CX} ${f(top)}`
  for (let i = 1; i <= n; i++) {
    const x = i % 2 === 1 ? CX + AMP : CX - AMP
    d += ` L ${f(x)} ${f(zigTop + i * step)}`
  }
  d += ` L ${CX} ${f(bot)}`
  return d
}

export function SpringsView({ config, state, setState, marked, reduced, locked }: Props) {
  const now = marked === 'shown' ? springsEngine.solve(config) : state
  const masses: number = typeof now?.masses === 'number' && Number.isInteger(now.masses) && now.masses >= 0 && now.masses <= 8
    ? now.masses : 0

  const shown = useSpringBounce(masses, reduced)
  const answer: number = answerMasses(config)
  const targetY = stackBot(answer)
  const reached = masses === answer
  const named = marked !== 'idle'

  const set = (n: number) => {
    if (locked) return
    const next = Math.max(0, Math.min(8, n))
    if (next !== masses) setState({ masses: next })
  }

  const onKey = (e: KeyboardEvent) => {
    const map: Record<string, number> = { ArrowUp: -1, ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, PageUp: -2, PageDown: 2 }
    const d = map[e.key]
    if (d === undefined) return
    e.preventDefault()
    e.stopPropagation()
    set(masses + d)
  }

  const drawnBot = SPRING_TOP + REST + shown * PX
  const drawnHook = drawnBot + HOOK
  const path = animatedPath(shown)

  const minusOk = !locked && masses > 0
  const plusOk = !locked && masses < 8

  const text = named
    ? (marked === 'right' || marked === 'shown' ? working(config, now) : madeText(config, now))
    : ''

  return (
    <div className="nodrag flex flex-col items-center gap-2 [&:has(:focus-visible)_.li-kbd]:block">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="group"
        aria-label={`A spring hanging from a bar with ${masses} weight${masses === 1 ? '' : 's'}. ${reached ? 'The spring has stretched to the target.' : 'The spring has not reached the target.'}`}
        className="block h-auto w-full max-w-[360px] select-none"
        style={{ background: BG, borderRadius: 14, overflow: 'hidden' }}
      >
        {/* Bar */}
        <rect x={CX - BAR_HALF} y={BAR_Y} width={BAR_HALF * 2} height={6} rx={2} fill={BAR_C} />

        {/* Target line */}
        <line x1={40} y1={f(targetY)} x2={320} y2={f(targetY)} stroke={WHITE} strokeWidth={1.5} strokeDasharray="8 5" opacity={0.6} />

        {/* Spring coil */}
        <path d={path} fill="none" stroke={COIL} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />

        {/* Hook */}
        <line x1={CX} y1={f(drawnBot)} x2={CX} y2={f(drawnHook)} stroke={WHITE} strokeWidth={2} />

        {/* Weight blocks */}
        {Array.from({ length: masses }, (_, i) => (
          <rect
            key={i}
            x={CX - BLK_W / 2}
            y={f(drawnHook + i * BLK_H)}
            width={BLK_W}
            height={BLK_H}
            fill={MASS_C}
            stroke={BG}
            strokeWidth={1.5}
            rx={3}
          />
        ))}

        {/* Labels */}
        <text x={CX + AMP + 8} y={SPRING_TOP + 12} fontSize={14} fontWeight={700} fill={WHITE} style={HALO}>spring</text>
        <text x={325} y={f(targetY - 7)} fontSize={13} fontWeight={700} fill={WHITE} style={HALO} textAnchor="end">target</text>

        {/* After marking: extension bracket and force */}
        {named && masses > 0 && (
          <g>
            <line x1={100} y1={f(SPRING_TOP + REST)} x2={110} y2={f(SPRING_TOP + REST)} stroke={WHITE} strokeWidth={1.5} />
            <line x1={105} y1={f(SPRING_TOP + REST)} x2={105} y2={f(springBot(masses))} stroke={WHITE} strokeWidth={1.5} />
            <line x1={100} y1={f(springBot(masses))} x2={110} y2={f(springBot(masses))} stroke={WHITE} strokeWidth={1.5} />
            <text x={98} y={f((SPRING_TOP + REST + springBot(masses)) / 2 + 5)} textAnchor="end" fontSize={13} fontWeight={700} fill={WHITE} style={HALO}>
              {fmt(extensionFor(config.k, masses))} cm
            </text>
            <text x={CX} y={f(hookBot(masses) + masses * BLK_H / 2 + 5)} textAnchor="middle" fontSize={13} fontWeight={700} fill={WHITE} style={HALO}>
              {masses} N
            </text>
          </g>
        )}

        {/* Interactive: slider with +/- buttons */}
        <g
          role="slider"
          tabIndex={locked ? -1 : 0}
          aria-label="The spring. Tap the round buttons or use arrow keys to add or remove weights"
          aria-valuemin={0}
          aria-valuemax={8}
          aria-valuenow={masses}
          aria-valuetext={`${masses} weight${masses === 1 ? '' : 's'}. ${reached ? 'The spring has stretched to the target.' : 'The spring has not reached the target.'}`}
          aria-disabled={locked || undefined}
          style={{ touchAction: 'none' }}
          className="outline-none"
          onKeyDown={onKey}
        >
          {/* − button */}
          <g onClick={() => set(masses - 1)} style={{ cursor: minusOk ? 'pointer' : 'default' }}>
            <circle cx={BTN_LX} cy={BTN_Y} r={BTN_R + 8} fill="transparent" />
            <circle cx={BTN_LX} cy={BTN_Y} r={BTN_R} fill={minusOk ? WHITE : DIM} />
            <line x1={BTN_LX - 8} y1={BTN_Y} x2={BTN_LX + 8} y2={BTN_Y} stroke={BG} strokeWidth={3} strokeLinecap="round" />
          </g>
          {/* + button */}
          <g onClick={() => set(masses + 1)} style={{ cursor: plusOk ? 'pointer' : 'default' }}>
            <circle cx={BTN_RX} cy={BTN_Y} r={BTN_R + 8} fill="transparent" />
            <circle cx={BTN_RX} cy={BTN_Y} r={BTN_R} fill={plusOk ? WHITE : DIM} />
            <line x1={BTN_RX - 8} y1={BTN_Y} x2={BTN_RX + 8} y2={BTN_Y} stroke={BG} strokeWidth={3} strokeLinecap="round" />
            <line x1={BTN_RX} y1={BTN_Y - 8} x2={BTN_RX} y2={BTN_Y + 8} stroke={BG} strokeWidth={3} strokeLinecap="round" />
          </g>
        </g>
      </svg>
      <p className="li-kbd hidden text-[12px] text-ss-slate">Arrow keys add or remove weights.</p>
      <span className="sr-only" aria-live="polite">{reached ? 'The spring has stretched to the target.' : 'The spring has not reached the target.'}</span>
      {named && <p className="max-w-[350px] text-center text-[13px] font-bold leading-snug text-ss-ink">{text}</p>}
    </div>
  )
}
