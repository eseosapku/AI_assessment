'use client'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { SceneViewProps } from '../types'
import type { SpringsConfig, SpringsState } from './config'
import { answerMasses, extensionFor, fmt, madeText, springsEngine, working } from './config'

type Props = SceneViewProps<SpringsConfig, SpringsState>

// A quiet light plate in both themes, like measure-shape's and waves': the picture keeps its own material colours. Flat colours only.
const PLATE = '#F8FAFC'
const PLATE_EDGE = '#CBD5E1'
const HAIR = '#DCE3EA'
const INK = '#334155'
const SOFT = '#475569'
const STEEL = '#94A3B8'
const STEEL_EDGE = '#475569'
const STEEL_HI = '#E2E8F0'
const STAND = '#64748B'
const STAND_DARK = '#334155'
const BRASS = '#D2A94A'
const BRASS_EDGE = '#8A6A22'
const BRASS_HI = '#EBD28A'
const TARGET = '#2F7FB8'
const TARGET_INK = '#1F6397'

// Geometry (viewBox pixels), exported for the tests. MAX_MASSES is 8 and the weight 1 N; written out
// here because config.ts and this file import each other (the test checks they agree).
export const W = 360
export const H = 372
export const CX = 150
export const SPRING_TOP = 52
export const REST = 56
export const PX = 16
export const HOOK = 8
export const BLK_W = 44
export const BLK_H = 11
export const AMP = 16
export const COILS = 9
const ARM_Y = 32
const ARM_H = 7
const ROD_X = 47
const BASE_Y = 350
const EYE = 4
const TILT = 3.4

const f = (n: number) => n.toFixed(1)

export const springBot = (m: number) => SPRING_TOP + REST + m * PX
export const hookBot = (m: number) => springBot(m) + HOOK
export const stackBot = (m: number) => hookBot(m) + m * BLK_H

/** The spring as a helix seen from the side: a short straight lead, nine coils, a short straight tail. */
export function springPath(masses: number): string {
  const top = SPRING_TOP
  const bot = springBot(masses)
  const lead = 4
  const y0 = top + lead
  const len = bot - top - 2 * lead
  const steps = COILS * 14
  let d = `M ${f(CX)} ${f(top)} L ${f(CX)} ${f(y0)}`
  for (let i = 0; i <= steps; i++) {
    const th = (i / steps) * COILS * Math.PI * 2
    const x = CX + AMP * Math.sin(th)
    const y = y0 + (len - 2 * TILT) * (i / steps) + TILT * (1 - Math.cos(th))
    d += ` L ${f(x)} ${f(y)}`
  }
  d += ` L ${f(CX)} ${f(bot - lead)} L ${f(CX)} ${f(bot)}`
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

const STEP = 'nodrag flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-lg border-2 border-ss-line bg-ss-panel text-[16px] font-extrabold leading-none text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'

export function SpringsView({ config, state, setState, marked, reduced, locked }: Props) {
  const now = marked === 'shown' ? springsEngine.solve(config) : state
  const masses: number = typeof now?.masses === 'number' && Number.isInteger(now.masses) && now.masses >= 0 && now.masses <= 8
    ? now.masses : 0

  const shown = useSpringBounce(masses, reduced)
  const answer: number = answerMasses(config)
  const targetY = stackBot(answer)
  const reached = masses === answer
  const named = marked !== 'idle'
  const status = reached ? 'The spring has stretched to the target.' : 'The spring has not reached the target.'

  const set = (n: number) => {
    if (locked) return
    const next = Math.max(0, Math.min(8, n))
    if (next !== masses) setState({ masses: next })
  }

  // The board moves cards with the arrow keys; inside the card they belong to the card (the buttons are the control).
  const onKey = (e: KeyboardEvent) => { if (e.key.startsWith('Arrow')) e.stopPropagation() }

  const drawnBot = SPRING_TOP + REST + shown * PX
  const drawnHook = drawnBot + HOOK
  const path = springPath(shown)
  const stemBot = drawnHook + masses * BLK_H + 5

  const text = named
    ? (marked === 'right' || marked === 'shown' ? working(config, now) : madeText(config, now))
    : ''

  const extTop = SPRING_TOP + REST
  const extBot = springBot(masses)

  return (
    <div className="nodrag flex flex-col items-center gap-3" onKeyDown={onKey}>
      <figure className="flex w-full max-w-[360px] flex-col gap-1.5">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`A spring hanging from a clamp on a lab stand, with ${masses} brass weight${masses === 1 ? '' : 's'} on its hanger. ${status}`}
          className="block h-auto w-full select-none"
        >
          <rect width={W} height={H} rx={16} fill={PLATE} stroke={PLATE_EDGE} strokeWidth={1.5} />

          {/* the bench */}
          <line x1={16} x2={W - 16} y1={BASE_Y + 12} y2={BASE_Y + 12} stroke={HAIR} strokeWidth={1.5} />

          {/* the target: where the bottom of the stack has to come to */}
          <line x1={CX + 62} y1={f(targetY)} x2={W - 16} y2={f(targetY)} stroke={TARGET} strokeWidth={2.5} strokeDasharray="7 6" strokeLinecap="round" />
          <text x={W - 16} y={f(targetY - 7)} textAnchor="end" fontSize={12} fontWeight={700} fill={TARGET_INK}>target</text>

          {/* the stand: base, rod, clamp and arm */}
          <rect x={22} y={BASE_Y} width={78} height={10} rx={3} fill={STAND} stroke={STAND_DARK} strokeWidth={1} />
          <rect x={26} y={BASE_Y + 1.5} width={70} height={2} rx={1} fill={STEEL_HI} opacity={0.7} />
          <rect x={ROD_X} y={ARM_Y - 6} width={8} height={BASE_Y - ARM_Y + 6} rx={3} fill={STEEL} stroke={STEEL_EDGE} strokeWidth={1} />
          <rect x={ROD_X + 1.8} y={ARM_Y - 4} width={2} height={BASE_Y - ARM_Y + 2} rx={1} fill={STEEL_HI} />
          <rect x={ROD_X + 14} y={ARM_Y} width={CX + 14 - ROD_X - 14} height={ARM_H} rx={2.5} fill={STEEL} stroke={STEEL_EDGE} strokeWidth={1} />
          <rect x={ROD_X + 16} y={ARM_Y + 1.4} width={CX - ROD_X - 18} height={1.8} rx={0.9} fill={STEEL_HI} />
          <rect x={ROD_X - 6} y={ARM_Y - 4} width={22} height={ARM_H + 8} rx={3} fill={STAND} stroke={STAND_DARK} strokeWidth={1} />
          <circle cx={ROD_X - 11} cy={ARM_Y + 3.5} r={4} fill={STAND} stroke={STAND_DARK} strokeWidth={1} />
          <line x1={ROD_X - 10} x2={ROD_X - 6} y1={ARM_Y + 3.5} y2={ARM_Y + 3.5} stroke={STAND_DARK} strokeWidth={2} />
          <text x={ROD_X + 22} y={ARM_Y - 10} fontSize={12} fontWeight={700} fill={SOFT}>clamp</text>

          {/* the eye the spring hangs from */}
          <circle cx={CX} cy={ARM_Y + ARM_H + EYE - 1} r={EYE} fill="none" stroke={STEEL_EDGE} strokeWidth={1.8} />

          {/* the spring: dark edge, steel body, a thin highlight */}
          <g fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d={path} stroke={STEEL_EDGE} strokeWidth={5.4} />
            <path d={path} stroke={STEEL} strokeWidth={3.4} />
            <path d={path} stroke={STEEL_HI} strokeWidth={1} opacity={0.9} />
          </g>

          {/* the hanger: a ring under the spring and a stem the slotted masses slide onto */}
          <circle cx={CX} cy={f(drawnBot + 3)} r={2.8} fill="none" stroke={STEEL_EDGE} strokeWidth={1.6} />
          <line x1={CX} y1={f(drawnBot + 5.5)} x2={CX} y2={f(stemBot)} stroke={STEEL_EDGE} strokeWidth={3} strokeLinecap="round" />
          <line x1={CX} y1={f(drawnBot + 5.5)} x2={CX} y2={f(stemBot)} stroke={STEEL_HI} strokeWidth={1} strokeLinecap="round" />
          <rect x={CX - 9} y={f(stemBot - 2)} width={18} height={4.5} rx={2} fill={STEEL} stroke={STEEL_EDGE} strokeWidth={1} />

          {/* slotted brass masses */}
          {Array.from({ length: masses }, (_, i) => {
            const y = drawnHook + i * BLK_H
            return (
              <g key={i}>
                <rect x={CX - BLK_W / 2} y={f(y)} width={BLK_W} height={BLK_H - 0.6} rx={2.5} fill={BRASS} stroke={BRASS_EDGE} strokeWidth={1} />
                <rect x={CX - BLK_W / 2 + 3} y={f(y + 1.2)} width={BLK_W - 6} height={1.5} rx={0.75} fill={BRASS_HI} />
                <rect x={CX - BLK_W / 2 - 0.5} y={f(y + BLK_H / 2 - 2)} width={BLK_W / 2 - 1} height={3} fill={BRASS_EDGE} />
              </g>
            )
          })}

          {/* labels, each on the thing it names */}
          <text x={CX + AMP + 12} y={SPRING_TOP + 16} fontSize={12} fontWeight={700} fill={SOFT}>spring</text>
          <text x={CX - BLK_W / 2 - 8} y={f(drawnHook + (masses > 0 ? BLK_H / 2 + 4 : 14))} textAnchor="end" fontSize={12} fontWeight={700} fill={BRASS_EDGE}>
            {masses > 0 ? 'masses' : 'hanger'}
          </text>

          {/* after marking: how far it stretched, and the force */}
          {named && masses > 0 && (
            <g>
              <path
                d={`M ${CX + 34} ${f(extTop)} H ${CX + 44} M ${CX + 39} ${f(extTop)} V ${f(extBot)} M ${CX + 34} ${f(extBot)} H ${CX + 44}`}
                fill="none" stroke={INK} strokeWidth={1.6} strokeLinecap="round"
              />
              <text x={CX + 50} y={f((extTop + extBot) / 2 + 4)} fontSize={12} fontWeight={700} fill={INK}>
                {fmt(extensionFor(config.k, masses))} cm
              </text>
              <text x={CX + BLK_W / 2 + 10} y={f(hookBot(masses) + (masses * BLK_H) / 2 + 4)} fontSize={12} fontWeight={700} fill={INK}>
                {masses} N
              </text>
            </g>
          )}
        </svg>
        <figcaption className="text-center text-[12px] font-bold text-ss-slate">
          Hang weights on the spring until the stack reaches the dashed line.
        </figcaption>
      </figure>
      <div className="flex w-full max-w-[360px] flex-col gap-1.5">
        <div className="flex items-center justify-between gap-1.5">
          <span className="text-[12px] font-bold text-ss-slate">Weights hung</span>
          <span className="flex items-center gap-1">
            <button type="button" aria-label="Take one weight off" disabled={locked || masses <= 0} onClick={() => set(masses - 1)} className={STEP}>{'−'}</button>
            <span className="min-w-[28px] text-center text-[15px] font-extrabold tabular-nums text-ss-ink" aria-hidden="true">{masses}</span>
            <button type="button" aria-label="Hang one more weight" disabled={locked || masses >= 8} onClick={() => set(masses + 1)} className={STEP}>+</button>
          </span>
        </div>
      </div>
      <span className="sr-only" aria-live="polite">{status}</span>
      {named && (
        <p className="w-full max-w-[360px] rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2 text-[13px] font-extrabold leading-snug text-ss-ink" aria-live="polite">{text}</p>
      )}
    </div>
  )
}
