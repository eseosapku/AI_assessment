'use client'
import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { SceneViewProps } from '../types'
import type { OrbitConfig, OrbitState, PhaseId } from './config'
import { litFraction, phaseAt, PHASE_NAMES } from './config'

// One scene look in both themes: space is dark either way, so its colours are its own.
const SPACE = '#0E1A2B'
const SUN = '#F5B700'
const LIT = '#F3F1E7'
const DARK = '#2B3A4E'
const EARTH = '#2F7FD1'

const W = 240
const C = W / 2
const ORBIT = 82
const MOON = 11
const STEP = 15

const norm = (deg: number) => ((Math.round(deg) % 360) + 360) % 360
const rad = (deg: number) => (deg * Math.PI) / 180

/** Where the Moon sits in the view from above: the Sun is to the left, and the Moon goes round anticlockwise. */
function moonAt(moon: number): { x: number; y: number } {
  return { x: C - ORBIT * Math.cos(rad(moon)), y: C + ORBIT * Math.sin(rad(moon)) }
}

/**
 * The lit part of the disc Earth sees, as a path: the lit half-disc (right
 * while waxing, left while waning) and the terminator, an ellipse whose width
 * is the disc's times |cos|, bulging into the lit side for a crescent and
 * away from it for a gibbous Moon. Null at new moon.
 */
export function litPath(moon: number, cx: number, cy: number, r: number): string | null {
  const a = norm(moon)
  const f = litFraction(a)
  if (f < 0.005) return null
  if (f > 0.995) return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx} ${cy + r} A ${r} ${r} 0 1 1 ${cx} ${cy - r} Z`
  const waxing = a < 180
  const crescent = Math.cos(rad(a)) > 0
  const rx = Math.abs(r * Math.cos(rad(a)))
  const outer = `M ${cx} ${cy - r} A ${r} ${r} 0 0 ${waxing ? 1 : 0} ${cx} ${cy + r}`
  // Back up the terminator: for a waxing crescent it bulges right (into the lit side).
  const sweep = waxing ? (crescent ? 0 : 1) : (crescent ? 1 : 0)
  return `${outer} A ${rx} ${r} 0 0 ${sweep} ${cx} ${cy - r} Z`
}

export function OrbitView({ config, state, setState, marked, locked }: SceneViewProps<OrbitConfig, OrbitState>) {
  const moon = typeof state?.moon === 'number' ? norm(state.moon) : 0
  const svg = useRef<SVGSVGElement>(null)
  const [focused, setFocused] = useState(false)
  const [dragging, setDragging] = useState(false)
  const explore = config.task.kind === 'explore'

  const move = (to: number) => {
    if (locked) return
    const next = norm(to)
    const seen = explore ? [...new Set<PhaseId>([...(state?.seen ?? []), phaseAt(next)])] : state?.seen
    setState({ moon: next, ...(seen ? { seen } : {}) })
  }
  const fromPointer = (e: PointerEvent) => {
    const el = svg.current
    const m = el?.getScreenCTM()
    if (!el || !m) return
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse())
    move((Math.atan2(p.y - C, C - p.x) * 180) / Math.PI)
  }
  const onKey = (e: KeyboardEvent) => {
    const step = { ArrowRight: STEP, ArrowUp: STEP, ArrowLeft: -STEP, ArrowDown: -STEP, PageUp: 45, PageDown: -45 }[e.key]
    if (step === undefined && e.key !== 'Home') return
    // The board moves a selected card with the arrows; here they move the Moon.
    e.preventDefault()
    e.stopPropagation()
    move(e.key === 'Home' ? 0 : moon + (step ?? 0))
  }

  const at = moonAt(moon)
  const named = explore || marked !== 'idle'
  const path = litPath(moon, 60, 58, 40)
  const lit = Math.round(litFraction(moon) * 100)

  return (
    <div className="nodrag flex flex-wrap items-start justify-center gap-3">
      <svg
        ref={svg}
        viewBox={`0 0 ${W} ${W}`}
        className="w-full max-w-[260px] touch-none select-none"
        onPointerMove={(e) => dragging && fromPointer(e)}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
        aria-label="The Sun, Earth and Moon from above"
      >
        <rect width={W} height={W} rx={16} fill={SPACE} />
        {/* Sunlight from the left. */}
        <text x={10} y={18} fill={SUN} fontSize={11} fontWeight={700}>Sunlight</text>
        {[44, 84, 124, 164, 204].map((y) => (
          <g key={y} stroke={SUN} strokeWidth={2} strokeLinecap="round">
            <line x1={8} y1={y} x2={30} y2={y} />
            <path d={`M 26 ${y - 4} L 31 ${y} L 26 ${y + 4}`} fill="none" />
          </g>
        ))}
        <circle cx={C} cy={C} r={ORBIT} fill="none" stroke="rgba(255,255,255,0.25)" strokeDasharray="3 5" />
        {/* The line of sight from Earth to the Moon. */}
        <line x1={C} y1={C} x2={at.x} y2={at.y} stroke="rgba(255,255,255,0.35)" strokeDasharray="2 4" />
        {/* Earth: day on the Sun side, night away from it. */}
        <circle cx={C} cy={C} r={22} fill={EARTH} />
        <path d={`M ${C} ${C - 22} A 22 22 0 0 1 ${C} ${C + 22} Z`} fill="rgba(5,10,20,0.62)" />
        <text x={C} y={C + 36} textAnchor="middle" fill="rgba(255,255,255,0.8)" fontSize={10} fontWeight={700}>Earth</text>
        {/* The Moon: always lit on the half facing the Sun. */}
        <g
          role="slider"
          tabIndex={locked ? -1 : 0}
          aria-label="The Moon. Drag it round its orbit, or use the arrow keys"
          aria-valuemin={0}
          aria-valuemax={359}
          aria-valuenow={moon}
          aria-valuetext={`${moon} degrees round its orbit from the Sun line${named ? `: ${PHASE_NAMES[phaseAt(moon)]}` : ''}`}
          aria-disabled={locked || undefined}
          onKeyDown={onKey}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onPointerDown={(e) => {
            if (locked) return
            setDragging(true)
            ;(e.currentTarget.ownerSVGElement ?? e.currentTarget).setPointerCapture?.(e.pointerId)
            fromPointer(e)
          }}
          className={`outline-none focus-visible:outline-none ${locked ? '' : dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
          transform={`translate(${at.x} ${at.y})`}
        >
          <circle r={24} fill="transparent" />
          {focused && <circle r={17} fill="none" stroke="var(--subject)" strokeWidth={3} />}
          <circle r={MOON} fill={DARK} stroke="rgba(255,255,255,0.4)" strokeWidth={1} />
          <path d={`M 0 ${-MOON} A ${MOON} ${MOON} 0 0 0 0 ${MOON} Z`} fill={LIT} />
        </g>
      </svg>

      <figure className="flex w-[124px] flex-col items-center gap-1.5">
        <svg viewBox="0 0 120 116" className="w-full" aria-label={named ? `The Moon seen from Earth: ${PHASE_NAMES[phaseAt(moon)]}, ${lit}% of the disc lit` : `The Moon seen from Earth: ${lit}% of the disc lit`} role="img">
          <rect width={120} height={116} rx={14} fill={SPACE} />
          <circle cx={60} cy={58} r={40} fill={DARK} />
          {path && <path d={path} fill={LIT} />}
        </svg>
        <figcaption className="text-center text-[12px] font-bold leading-tight text-ss-slate">
          Seen from Earth
          {named && (
            <span className="block text-[13px] font-extrabold text-ss-ink">
              {marked === 'wrong' ? `You made a ${PHASE_NAMES[phaseAt(moon)]}` : <span className="capitalize">{PHASE_NAMES[phaseAt(moon)]}</span>}
            </span>
          )}
          <span className="block text-[12px] font-semibold tabular-nums">{lit}% lit</span>
        </figcaption>
      </figure>
    </div>
  )
}
