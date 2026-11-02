'use client'
import { useId, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { SceneMarked, SceneViewProps } from '../types'
import type { CalculusConfig, CalculusState, Poly } from './config'
import {
  HALVES, LEVEL, LEVEL_SPAN, PL, PR, PW, QUARTERS, STATIONS, VBW,
  areaText, areaTo, derive, evalFloat, findVerdict, fromHalves, gradientAt, layout, num, rat, setVerdict, sweepVerdict,
} from './config'

// The scene's own two inks, each over 4.5:1 on the panel in both themes: the
// curve in blue, whatever the learner handles (tangent, point, trace) in
// orange. Neither is the lesson colour; the focus ring takes the lesson colour.
const PALETTE = '[--cg-curve:#1D4ED8] [--cg-mark:#C2410C] dark:[--cg-curve:#60A5FA] dark:[--cg-mark:#FB923C]'
const CURVE = 'var(--cg-curve, #1D4ED8)'
const MARK = 'var(--cg-mark, #C2410C)'
const PANEL = 'var(--ss-panel, #FFFFFF)'
const SLATE = 'var(--ss-slate, #636D76)'
const GRID = 'var(--ss-line, #D5DBE0)'
const GOOD = 'var(--ss-good, #15803D)'
const BAD = 'var(--ss-bad, #B91C1C)'
const MINUS = '−'
const HALO = { stroke: PANEL, strokeWidth: 4, paintOrder: 'stroke', strokeLinejoin: 'round' } as const

type Props = SceneViewProps<CalculusConfig, CalculusState>

const fmt = (v: number) => `${v < 0 ? MINUS : ''}${Math.abs(Math.round(v * 100) / 100)}`
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** Keeps "x = −1.5" whole when the text wraps. */
export function unbroken(text: string): string {
  return text.replace(/\bx = [^\s,;:.]+(?:\.\d+)?/g, (m) => m.replace(/ /g, ' ')).replace(/\([^()]*\)/g, (m) => m.replace(/ /g, ' '))
}

function Verdict({ marked, text }: { marked: SceneMarked; text: string }) {
  if (marked === 'idle' || !text) return null
  return <p className="max-w-[340px] text-center text-[13px] font-extrabold leading-snug text-ss-ink">{unbroken(text)}</p>
}

// ---------------------------------------------------------------------------
// The picture: two stacked graphs sharing an x-axis.

function useFrame(config: CalculusConfig) {
  const { kind, coef } = config.task
  const L = layout(kind)
  const { xa, xb } = L
  const gx = (x: number) => PL + ((x - xa) / (xb - xa)) * PW
  // The curve's own range over the window, with room.
  let lo = Infinity
  let hi = -Infinity
  for (let i = 0; i <= 120; i++) {
    const v = evalFloat(coef, xa + ((xb - xa) * i) / 120)
    lo = Math.min(lo, v)
    hi = Math.max(hi, v)
  }
  if (kind === 'sweep-area') { lo = Math.min(0, lo); hi = hi * 1.1 }
  else { const pad = Math.max(0.5, (hi - lo) * 0.14); lo -= pad; hi += pad }
  if (hi - lo < 1) hi = lo + 1
  const uy = (v: number) => L.upper.y0 + L.upper.h - ((v - lo) / (hi - lo)) * L.upper.h
  return { L, gx, uy, lo, hi }
}
type Frame = ReturnType<typeof useFrame>

const pathOf = (pts: Array<[number, number]>) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')

function curvePath(coef: Poly, f: Frame, from: number, to: number) {
  const n = 120
  return pathOf(Array.from({ length: n + 1 }, (_, i) => {
    const x = from + ((to - from) * i) / n
    return [f.gx(x), f.uy(evalFloat(coef, x))] as [number, number]
  }))
}

function Axes({ f, ticks }: { f: Frame; ticks: number[] }) {
  const { L } = f
  const zero = f.uy(0)
  const showZero = zero >= L.upper.y0 && zero <= L.upper.y0 + L.upper.h
  return (
    <g aria-hidden="true">
      {showZero && <line x1={PL} x2={PR} y1={zero} y2={zero} stroke={SLATE} strokeWidth={1} />}
      <line x1={f.gx(0)} x2={f.gx(0)} y1={L.upper.y0} y2={L.upper.y0 + L.upper.h} stroke={SLATE} strokeWidth={1} opacity={f.L.xa === 0 ? 1 : 0.6} />
      {ticks.map((t) => (
        <text key={t} x={f.gx(t)} y={L.strip.y0 + L.strip.h + 16} textAnchor="middle" fontSize={12} fontWeight={700} fill={SLATE}>{t < 0 ? `${MINUS}${-t}` : t}</text>
      ))}
    </g>
  )
}

/** A horizontal scrub across both graphs: pointer, touch and the arrow keys, snapped to `steps`. */
function Scrub({
  f, steps, value, onChange, locked, label, valuetext, min, max, big,
}: {
  f: Frame; steps: number; value: number; onChange: (v: number) => void; locked: boolean
  label: string; valuetext: string; min: number; max: number; big: number
}) {
  const [focus, setFocus] = useState(false)
  const { L } = f
  const top = L.upper.y0 - 4
  const height = L.strip.y0 + L.strip.h - top + 4
  const at = (e: PointerEvent<SVGRectElement>) => {
    const svg = e.currentTarget.ownerSVGElement!
    const r = svg.getBoundingClientRect()
    const x = ((e.clientX - r.left) * VBW) / r.width
    return clamp(Math.round(((x - PL) / PW) * steps) + min, min, max)
  }
  const move = (v: number) => { if (!locked && v !== value) onChange(v) }
  const onKey = (e: KeyboardEvent) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1
      : e.key === 'PageUp' ? big : e.key === 'PageDown' ? -big : 0
    if (d) { e.preventDefault(); e.stopPropagation(); move(clamp(value + d, min, max)); return }
    if (e.key === 'Home') { e.preventDefault(); e.stopPropagation(); move(min) }
    if (e.key === 'End') { e.preventDefault(); e.stopPropagation(); move(max) }
  }
  return (
    <>
      <rect
        role="slider" tabIndex={locked ? -1 : 0} x={PL - 10} y={top} width={PW + 20} height={height} fill="transparent"
        aria-label={label} aria-orientation="horizontal" aria-valuemin={min} aria-valuemax={max} aria-valuenow={value}
        aria-valuetext={valuetext} aria-disabled={locked || undefined}
        onKeyDown={onKey} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
        onPointerDown={(e) => { if (locked) return; e.currentTarget.setPointerCapture(e.pointerId); move(at(e)) }}
        onPointerMove={(e) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) move(at(e)) }}
        onPointerUp={(e) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId) }}
        className={`touch-none outline-none focus-visible:outline-none ${locked ? '' : 'cursor-ew-resize'}`}
      />
      {focus && <rect x={PL - 6} y={top + 2} width={PW + 12} height={height - 4} rx={6} fill="none" stroke="var(--subject)" strokeWidth={3} pointerEvents="none" />}
    </>
  )
}

function Handle({ x, y, ring }: { x: number; y: number; ring: string }) {
  return (
    <g transform={`translate(${x} ${y})`} pointerEvents="none" aria-hidden="true">
      <circle r={9} fill={PANEL} />
      <circle r={7} fill={ring} stroke={PANEL} strokeWidth={2} />
    </g>
  )
}

const ringFor = (marked: SceneMarked) => (marked === 'right' || marked === 'shown' ? GOOD : marked === 'wrong' ? BAD : MARK)

function Svg({ H, label, children }: { H: number; label: string; children: React.ReactNode }) {
  return (
    <svg viewBox={`0 0 ${VBW} ${H}`} role="group" aria-label={label} className="w-full max-w-[380px] touch-none select-none" style={{ height: 'auto' }}>
      {children}
    </svg>
  )
}

/** The tangent through (x, f(x)) with gradient g, drawn `half` units each way. */
function tangentPath(f: Frame, x: number, y: number, g: number, half: number) {
  return pathOf([[f.gx(x - half), f.uy(y - g * half)], [f.gx(x + half), f.uy(y + g * half)]])
}

// ---------------------------------------------------------------------------
// find-stationary

function FindStationary({ config, state, setState, marked, locked }: Props) {
  const clip = useId().replace(/[^a-zA-Z0-9]/g, '')
  const f = useFrame(config)
  const { coef } = config.task
  const { L } = f
  const k = typeof state?.k === 'number' ? clamp(Math.round(state.k), -QUARTERS, QUARTERS) : QUARTERS
  const seen = Array.isArray(state?.seen) ? state.seen.filter((v) => Number.isInteger(v)) : [k]
  const d1 = derive(coef)
  const x = k / 4
  const y = evalFloat(coef, x)
  const g = num(gradientAt(coef, rat(k, 4)))

  let gmax = 0.5
  for (let i = 0; i <= 120; i++) gmax = Math.max(gmax, Math.abs(evalFloat(d1, -3 + (6 * i) / 120)))
  gmax *= 1.15
  const sy = (v: number) => L.strip.y0 + L.strip.h / 2 - (v / gmax) * (L.strip.h / 2)
  const trail = [...new Set(seen)].sort((a, b) => a - b)
  const move = (next: number) => {
    const from = Math.min(k, next)
    const to = Math.max(k, next)
    const add = Array.from({ length: to - from + 1 }, (_, i) => from + i)
    setState({ k: next, seen: [...new Set([...seen, ...add])].sort((a, b) => a - b) })
  }
  const ring = ringFor(marked)
  const slope = Math.abs(g) < 1e-9 ? 'level' : g > 0 ? (g > 2 ? 'climbing steeply' : 'climbing') : g < -2 ? 'falling steeply' : 'falling'

  return (
    <>
      <Svg H={L.H} label="A curve with a point on it, a tangent line riding on the point, and below it a graph of the tangent's steepness filling in as the point moves">
        <defs><clipPath id={clip}><rect x={PL} y={L.upper.y0} width={PW} height={L.upper.h} /></clipPath></defs>
        <Axes f={f} ticks={[-2, 0, 2]} />
        <line x1={f.gx(x)} x2={f.gx(x)} y1={L.upper.y0} y2={L.strip.y0 + L.strip.h} stroke={GRID} strokeWidth={1.5} strokeDasharray="3 4" aria-hidden="true" />
        <g aria-hidden="true">
          <path d={curvePath(coef, f, -3, 3)} fill="none" stroke={CURVE} strokeWidth={3} strokeLinecap="round" clipPath={`url(#${clip})`} />
          <path d={tangentPath(f, x, y, g, 1)} fill="none" stroke={MARK} strokeWidth={2.5} strokeLinecap="round" clipPath={`url(#${clip})`} />
          <text x={PL} y={L.strip.y0 - 10} fontSize={12} fontWeight={700} fill={SLATE}>steepness of the tangent</text>
          <line x1={PL} x2={PR} y1={sy(0)} y2={sy(0)} stroke={SLATE} strokeWidth={1} />
          <text x={PL - 6} y={sy(0) + 4} textAnchor="end" fontSize={12} fontWeight={700} fill={SLATE}>0</text>
          {trail.length > 1 && <path d={pathOf(trail.map((t) => [f.gx(t / 4), sy(num(gradientAt(coef, rat(t, 4))))] as [number, number]))} fill="none" stroke={MARK} strokeWidth={2.5} strokeLinejoin="round" />}
          <circle cx={f.gx(x)} cy={sy(g)} r={5} fill={MARK} stroke={PANEL} strokeWidth={2} />
        </g>
        <Scrub
          f={f} steps={QUARTERS * 4} min={-QUARTERS} max={QUARTERS} value={k} big={4} locked={locked} onChange={move}
          label="Slide along the curve. Left and right arrow keys move the point a quarter of a unit; Page Up and Page Down move it a whole unit"
          valuetext={`point at x = ${fmt(x)}, tangent ${slope}`}
        />
        <Handle x={f.gx(x)} y={f.uy(y)} ring={ring} />
      </Svg>
      <p className="sr-only" aria-live="polite">{`Point at x = ${fmt(x)}. The tangent is ${slope}.`}</p>
      <Verdict marked={marked} text={findVerdict(config, state?.k, marked === 'right' || marked === 'shown')} />
    </>
  )
}

// ---------------------------------------------------------------------------
// set-gradients

function SetGradients({ config, state, setState, marked, locked }: Props) {
  const clip = useId().replace(/[^a-zA-Z0-9]/g, '')
  const f = useFrame(config)
  const { coef } = config.task
  const { L } = f
  const g = STATIONS.map((_, i) => (Array.isArray(state?.g) && Number.isInteger(state.g[i]) ? clamp(state.g[i], -LEVEL, LEVEL) : 0))
  const sy = (v: number) => L.strip.y0 + L.strip.h / 2 - (v / LEVEL_SPAN) * L.strip.h
  const [focus, setFocus] = useState<number | null>(null)
  const set = (i: number, v: number) => {
    const next = clamp(v, -LEVEL, LEVEL)
    if (locked || next === g[i]) return
    setState({ g: g.map((old, j) => (j === i ? next : old)) })
  }
  const verdictRight = marked === 'right' || marked === 'shown'
  const words = (v: number) => (v === 0 ? 'level' : v > 0 ? (v > 2 ? 'climbing steeply' : 'climbing') : v < -2 ? 'falling steeply' : 'falling')
  const pts = STATIONS.map((x, i) => [f.gx(x), sy(g[i])] as [number, number])

  return (
    <>
      <Svg H={L.H} label="A curve with five marks on it, each with a tangent line you can tilt, and below it a graph where you set each tangent's steepness">
        <defs><clipPath id={clip}><rect x={PL} y={L.upper.y0} width={PW} height={L.upper.h} /></clipPath></defs>
        <Axes f={f} ticks={[-2, 0, 2]} />
        <g aria-hidden="true">
          <path d={curvePath(coef, f, -3, 3)} fill="none" stroke={CURVE} strokeWidth={3} strokeLinecap="round" clipPath={`url(#${clip})`} />
          {STATIONS.map((x, i) => (
            <g key={x} clipPath={`url(#${clip})`}>
              <path d={tangentPath(f, x, evalFloat(coef, x), g[i], 0.45)} fill="none" stroke={MARK} strokeWidth={2.5} strokeLinecap="round" />
              <circle cx={f.gx(x)} cy={f.uy(evalFloat(coef, x))} r={4} fill={CURVE} stroke={PANEL} strokeWidth={1.5} />
            </g>
          ))}
          <text x={PL} y={L.strip.y0 - 10} fontSize={12} fontWeight={700} fill={SLATE}>steepness of each tangent</text>
          {Array.from({ length: 2 * LEVEL + 1 }, (_, j) => j - LEVEL).map((v) => (
            <line key={v} x1={PL} x2={PR} y1={sy(v)} y2={sy(v)} stroke={v === 0 ? SLATE : GRID} strokeWidth={v === 0 ? 1.5 : 1} />
          ))}
          {[-4, -2, 0, 2, 4].map((v) => (
            <text key={v} x={PL - 6} y={sy(v) + 4} textAnchor="end" fontSize={12} fontWeight={700} fill={SLATE}>{v < 0 ? `${MINUS}${-v}` : v}</text>
          ))}
          <path d={pathOf(pts)} fill="none" stroke={MARK} strokeWidth={2} strokeLinejoin="round" opacity={0.7} />
        </g>
        {STATIONS.map((x, i) => {
          const cx = f.gx(x)
          const wrong = marked === 'wrong' && !verdictRight && gradientAt(coef, rat(x)).n !== g[i]
          const ring = verdictRight ? GOOD : wrong ? BAD : MARK
          return (
            <g key={x}>
              <rect
                role="slider" tabIndex={locked ? -1 : 0} x={cx - PW / 12} y={L.strip.y0 - 6} width={PW / 6} height={L.strip.h + 12} fill="transparent"
                aria-label={`Tangent mark ${i + 1} of 5, at x = ${x < 0 ? MINUS : ''}${Math.abs(x)}. Up and down arrow keys tilt it`}
                aria-orientation="vertical" aria-valuemin={-LEVEL} aria-valuemax={LEVEL} aria-valuenow={g[i]}
                aria-valuetext={`tangent ${words(g[i])}`} aria-disabled={locked || undefined}
                onKeyDown={(e) => {
                  const d = e.key === 'ArrowUp' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowDown' || e.key === 'ArrowLeft' ? -1 : 0
                  if (d) { e.preventDefault(); e.stopPropagation(); set(i, g[i] + d) }
                  else if (e.key === 'Home') { e.preventDefault(); e.stopPropagation(); set(i, -LEVEL) }
                  else if (e.key === 'End') { e.preventDefault(); e.stopPropagation(); set(i, LEVEL) }
                }}
                onFocus={() => setFocus(i)} onBlur={() => setFocus(null)}
                onPointerDown={(e) => { if (locked) return; e.currentTarget.setPointerCapture(e.pointerId); set(i, level(e)) }}
                onPointerMove={(e) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) set(i, level(e)) }}
                onPointerUp={(e) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId) }}
                className={`touch-none outline-none focus-visible:outline-none ${locked ? '' : 'cursor-ns-resize'}`}
              />
              {focus === i && <rect x={cx - PW / 12 + 2} y={L.strip.y0 - 4} width={PW / 6 - 4} height={L.strip.h + 8} rx={6} fill="none" stroke="var(--subject)" strokeWidth={3} pointerEvents="none" />}
              <Handle x={cx} y={sy(g[i])} ring={ring} />
            </g>
          )
        })}
      </Svg>
      <p className="sr-only" aria-live="polite">{g.map((v, i) => `mark ${i + 1}: tangent ${words(v)}`).join('; ')}</p>
      <Verdict marked={marked} text={setVerdict(config, state?.g, verdictRight)} />
    </>
  )

  function level(e: PointerEvent<SVGRectElement>) {
    const svg = e.currentTarget.ownerSVGElement!
    const r = svg.getBoundingClientRect()
    const y = ((e.clientY - r.top) * (L.H / r.height))
    return Math.round(((L.strip.y0 + L.strip.h / 2 - y) / L.strip.h) * LEVEL_SPAN)
  }
}

// ---------------------------------------------------------------------------
// sweep-area

function SweepArea({ config, state, setState, marked, locked }: Props) {
  const clip = useId().replace(/[^a-zA-Z0-9]/g, '')
  const f = useFrame(config)
  const { coef, area } = config.task
  const { L } = f
  const h = typeof state?.h === 'number' ? clamp(Math.round(state.h), 0, HALVES) : 0
  const far = Math.max(h, typeof state?.far === 'number' ? clamp(Math.round(state.far), 0, HALVES) : 0)
  const t = h / 2
  const total = areaTo(coef, fromHalves(h))
  const top = num(areaTo(coef, fromHalves(HALVES))) * 1.08
  const sy = (v: number) => L.strip.y0 + L.strip.h - (v / top) * L.strip.h
  const trace = Array.from({ length: far * 4 + 1 }, (_, i) => {
    const x = i / 8
    return [f.gx(x), sy(num(areaTo(coef, rat(i, 8))))] as [number, number]
  })
  const shade = `${pathOf(Array.from({ length: h * 6 + 1 }, (_, i) => [f.gx(i / 12), f.uy(evalFloat(coef, i / 12))] as [number, number]))} L${f.gx(t)} ${f.uy(0)} L${f.gx(0)} ${f.uy(0)} Z`
  const target = area ? num(area) : 0
  const ring = ringFor(marked)
  const move = (next: number) => setState({ h: next, far: Math.max(far, next) })
  const height = evalFloat(coef, t)

  return (
    <>
      <Svg H={L.H} label="A curve above the x-axis with the area under it shaded from 0 up to a line you sweep right, and below it a graph of the area so far, with a dashed target level">
        <defs><clipPath id={clip}><rect x={PL} y={L.upper.y0} width={PW} height={L.upper.h} /></clipPath></defs>
        <Axes f={f} ticks={[0, 1, 2, 3, 4]} />
        <g aria-hidden="true">
          {h > 0 && <path d={shade} fill={CURVE} fillOpacity={0.3} />}
          <path d={curvePath(coef, f, 0, 4)} fill="none" stroke={CURVE} strokeWidth={3} strokeLinecap="round" clipPath={`url(#${clip})`} />
          <line x1={f.gx(t)} x2={f.gx(t)} y1={f.uy(0)} y2={f.uy(height)} stroke={MARK} strokeWidth={2.5} />
          <text x={PL} y={L.strip.y0 - 10} fontSize={12} fontWeight={700} fill={SLATE}>area so far</text>
          <text x={PL + 70} y={L.strip.y0 - 10} fontSize={13} fontWeight={800} fill="var(--ss-ink)">{areaText(total)}</text>
          <line x1={PL} x2={PR} y1={sy(0)} y2={sy(0)} stroke={SLATE} strokeWidth={1} />
          <text x={PL - 6} y={sy(0) + 4} textAnchor="end" fontSize={12} fontWeight={700} fill={SLATE}>0</text>
          <line x1={PL} x2={PR} y1={sy(target)} y2={sy(target)} stroke={SLATE} strokeWidth={1.5} strokeDasharray="5 4" />
          <text x={PR} y={sy(target) - 6} textAnchor="end" fontSize={12} fontWeight={700} fill={SLATE} {...HALO}>{`target ${area ? areaText(area) : ''}`}</text>
          {far > 0 && <path d={pathOf(trace)} fill="none" stroke={MARK} strokeWidth={2.5} strokeLinejoin="round" />}
          <circle cx={f.gx(t)} cy={sy(num(total))} r={5} fill={MARK} stroke={PANEL} strokeWidth={2} />
        </g>
        <Scrub
          f={f} steps={HALVES} min={0} max={HALVES} value={h} big={2} locked={locked} onChange={move}
          label="Sweep the line along the x-axis. Left and right arrow keys move it half a unit; Page Up and Page Down move it a whole unit"
          valuetext={`line at x = ${t}, area so far ${areaText(total)}`}
        />
        <Handle x={f.gx(t)} y={f.uy(height)} ring={ring} />
      </Svg>
      <p className="sr-only" aria-live="polite">{`Line at x = ${t}. Area so far ${areaText(total)}.`}</p>
      <Verdict marked={marked} text={sweepVerdict(config, state?.h, marked === 'right' || marked === 'shown')} />
    </>
  )
}

/**
 * One curve and one thing to handle: slide a point and feel the tangent's
 * steepness (find-stationary), set the steepness at five marks and draw the
 * gradient graph (set-gradients), or sweep a line and watch area pile up
 * (sweep-area).
 */
export function CalculusGrapherView(props: Props) {
  const kind = props.config.task.kind
  return (
    <div className={`nodrag flex flex-col items-center gap-2 ${PALETTE}`}>
      {kind === 'find-stationary' ? <FindStationary {...props} /> : kind === 'set-gradients' ? <SetGradients {...props} /> : <SweepArea {...props} />}
    </div>
  )
}
