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
const PALETTE = '[--cg-curve:#1D4ED8] [--cg-mark:#C2410C] [--cg-ruler:#FADDC0] dark:[--cg-curve:#60A5FA] dark:[--cg-mark:#FB923C] dark:[--cg-ruler:#5A3C28]'
const CURVE = 'var(--cg-curve, #1D4ED8)'
const MARK = 'var(--cg-mark, #C2410C)'
const PANEL = 'var(--ss-panel, #FFFFFF)'
const SLATE = 'var(--ss-slate, #636D76)'
const GRID = 'var(--ss-line, #D5DBE0)'
const RULER = 'var(--cg-ruler, #FADDC0)'
const INK = 'var(--ss-ink, #1F2933)'
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
// The picture: two graph-paper graphs stacked, sharing an x scale.

function useFrame(config: CalculusConfig) {
  const { kind, coef } = config.task
  const L = layout(kind)
  const { xa, xb } = L
  const gx = (x: number) => PL + ((x - xa) / (xb - xa)) * PW
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

/** A tidy step (1, 2, 5 times a power of ten) that gives about `want` marks across `range`. */
function niceStep(range: number, want: number) {
  const raw = range / want
  const mag = 10 ** Math.floor(Math.log10(raw))
  const m = raw / mag
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * mag
}
function marks(lo: number, hi: number, step: number) {
  const out: number[] = []
  for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + 1e-9; v += step) out.push(Math.round(v * 1000) / 1000)
  return out
}

type Box = { y0: number; h: number }

/** One sheet of graph paper: fine and bold grid lines, a frame, the x and y axes, and numbers on both scales. */
function Sheet({ f, box, map, lo, hi, step, xs, minor = true }: {
  f: Frame; box: Box; map: (v: number) => number; lo: number; hi: number; step: number; xs: number[]; minor?: boolean
}) {
  const { xa, xb } = f.L
  const bottom = box.y0 + box.h
  const yMajor = marks(lo, hi, step)
  const yMinor = minor ? marks(lo, hi, step / 2).filter((v) => !yMajor.includes(v)) : []
  const xMajor = marks(xa, xb, 1)
  const xMinor = marks(xa, xb, 0.5).filter((v) => !xMajor.includes(v))
  const zeroY = lo <= 0 && hi >= 0 ? map(0) : null
  const zeroX = xa < 0 && xb > 0 ? f.gx(0) : null
  const label = (v: number) => (v < 0 ? `${MINUS}${-v}` : `${v}`)
  return (
    <g aria-hidden="true">
      <rect x={PL} y={box.y0} width={PW} height={box.h} fill={PANEL} />
      {xMinor.map((v) => <line key={`xm${v}`} x1={f.gx(v)} x2={f.gx(v)} y1={box.y0} y2={bottom} stroke={GRID} strokeWidth={0.6} opacity={0.6} />)}
      {yMinor.map((v) => <line key={`ym${v}`} x1={PL} x2={PR} y1={map(v)} y2={map(v)} stroke={GRID} strokeWidth={0.6} opacity={0.6} />)}
      {xMajor.map((v) => <line key={`xM${v}`} x1={f.gx(v)} x2={f.gx(v)} y1={box.y0} y2={bottom} stroke={GRID} strokeWidth={1} />)}
      {yMajor.map((v) => <line key={`yM${v}`} x1={PL} x2={PR} y1={map(v)} y2={map(v)} stroke={GRID} strokeWidth={1} />)}
      <rect x={PL} y={box.y0} width={PW} height={box.h} fill="none" stroke={SLATE} strokeWidth={1} opacity={0.55} />
      {zeroY !== null && <line x1={PL} x2={PR} y1={zeroY} y2={zeroY} stroke={INK} strokeWidth={1.4} />}
      {zeroX !== null && <line x1={zeroX} x2={zeroX} y1={box.y0} y2={bottom} stroke={INK} strokeWidth={1.4} />}
      {yMajor.map((v) => (
        <text key={`yt${v}`} x={PL - 6} y={map(v) + 4} textAnchor="end" fontSize={12} fontWeight={700} fill={SLATE}>{label(v)}</text>
      ))}
      {xs.map((v) => (
        <text key={`xt${v}`} x={f.gx(v)} y={bottom + 16} textAnchor="middle" fontSize={12} fontWeight={700} fill={SLATE}>{label(v)}</text>
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

/** The neat round handle: a coloured disc with a paper ring and a pin-point centre. */
function Handle({ x, y, ring }: { x: number; y: number; ring: string }) {
  return (
    <g transform={`translate(${x} ${y})`} pointerEvents="none" aria-hidden="true">
      <circle r={8.5} fill={ring} stroke={PANEL} strokeWidth={2.5} />
      <circle r={2.4} fill={PANEL} />
    </g>
  )
}

const ringFor = (marked: SceneMarked) => (marked === 'right' || marked === 'shown' ? GOOD : marked === 'wrong' ? BAD : MARK)

/** A straight edge laid along a tangent: its edge runs through (x, y) at the tangent's own angle, ticked like a ruler. */
function Ruler({ f, x, y, g, len, thick, edge }: { f: Frame; x: number; y: number; g: number; len: number; thick: number; edge: string }) {
  const px = f.gx(x)
  const py = f.uy(y)
  const dx = f.gx(x + 1) - px
  const dy = f.uy(y + g) - py
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI
  const ticks: string[] = []
  const n = Math.floor(len / 2 / 6)
  for (let i = -n; i <= n; i++) {
    const long = i % 5 === 0
    ticks.push(`M${i * 6} 0V${-(long ? thick * 0.55 : thick * 0.3)}`)
  }
  return (
    <g transform={`translate(${px.toFixed(1)} ${py.toFixed(1)}) rotate(${angle.toFixed(2)})`}>
      <rect x={-len / 2} y={-thick} width={len} height={thick} rx={2} fill={RULER} fillOpacity={0.94} stroke={edge} strokeWidth={1.2} />
      <path d={ticks.join('')} stroke={edge} strokeWidth={1} opacity={0.9} />
      <line x1={-len / 2} x2={len / 2} y1={0} y2={0} stroke={edge} strokeWidth={2} strokeLinecap="round" />
    </g>
  )
}

function Svg({ H, label, children }: { H: number; label: string; children: React.ReactNode }) {
  return (
    <svg viewBox={`0 0 ${VBW} ${H}`} role="group" aria-label={label} className="block h-auto w-full touch-none select-none">
      <rect x={0.75} y={0.75} width={VBW - 1.5} height={H - 1.5} rx={14} fill={PANEL} stroke={GRID} strokeWidth={1.5} />
      {children}
    </svg>
  )
}

const STEP = 'nodrag flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-lg border-2 border-ss-line bg-ss-panel text-[16px] font-extrabold leading-none text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'

function Stepper({ name, text, less, more, canLess, canMore, locked, onLess, onMore }: {
  name: string; text: string; less: string; more: string; canLess: boolean; canMore: boolean; locked: boolean; onLess: () => void; onMore: () => void
}) {
  return (
    <div className="flex w-full max-w-[360px] items-center justify-between gap-1.5">
      <span className="text-[12px] font-bold text-ss-slate">{name}</span>
      <span className="flex items-center gap-1">
        <button type="button" aria-label={less} disabled={locked || !canLess} onClick={onLess} className={STEP}>{'‹'}</button>
        <span className="min-w-[72px] text-center text-[15px] font-extrabold tabular-nums text-ss-ink" aria-hidden="true">{text}</span>
        <button type="button" aria-label={more} disabled={locked || !canMore} onClick={onMore} className={STEP}>{'›'}</button>
      </span>
    </div>
  )
}

function Figure({ caption, children }: { caption: string; children: React.ReactNode }) {
  return (
    <figure className="flex w-full max-w-[360px] flex-col gap-1.5">
      {children}
      <figcaption className="text-center text-[12px] font-bold text-ss-slate">{caption}</figcaption>
    </figure>
  )
}

/** The curve: a paper-coloured halo under a confident blue line. */
function Curve({ coef, f, from, to, clip }: { coef: Poly; f: Frame; from: number; to: number; clip: string }) {
  const d = curvePath(coef, f, from, to)
  return (
    <g clipPath={`url(#${clip})`}>
      <path d={d} fill="none" stroke={PANEL} strokeWidth={6.5} strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke={CURVE} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  )
}

const intTicks = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i)

/** Titles and the x letter shared by both graphs. */
function Titles({ f, top, bottom }: { f: Frame; top: string; bottom: string }) {
  const { L } = f
  return (
    <g aria-hidden="true">
      <text x={PL} y={L.upper.y0 - 8} fontSize={12} fontWeight={700} fill={INK}>{top}</text>
      <text x={PL} y={L.strip.y0 - 10} fontSize={12} fontWeight={700} fill={INK}>{bottom}</text>
      <text x={PR} y={L.upper.y0 + L.upper.h + 31} textAnchor="end" fontSize={12} fontWeight={700} fill={SLATE}>x</text>
      <text x={PR} y={L.strip.y0 + L.strip.h + 31} textAnchor="end" fontSize={12} fontWeight={700} fill={SLATE}>x</text>
    </g>
  )
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
  const step = niceStep(f.hi - f.lo, 5)
  const gstep = niceStep(2 * gmax, 4)

  return (
    <>
      <Figure caption="Drag the point along the curve. The ruler lies along the curve there; the lower graph records its steepness.">
        <Svg H={L.H} label="A curve on graph paper with a point on it, a ruler laid along the curve there, and below it a second graph of the ruler's steepness filling in as the point moves">
          <defs>
            <clipPath id={clip}><rect x={PL} y={L.upper.y0} width={PW} height={L.upper.h} /></clipPath>
            <clipPath id={`${clip}s`}><rect x={PL} y={L.strip.y0} width={PW} height={L.strip.h} /></clipPath>
          </defs>
          <Sheet f={f} box={L.upper} map={f.uy} lo={f.lo} hi={f.hi} step={step} xs={intTicks(-3, 3)} />
          <Sheet f={f} box={L.strip} map={sy} lo={-gmax} hi={gmax} step={gstep} xs={intTicks(-3, 3)} />
          <Titles f={f} top="The curve" bottom="steepness of the tangent" />
          <g aria-hidden="true" stroke={MARK} strokeWidth={1.2} strokeDasharray="3 4" opacity={0.7}>
            <line x1={f.gx(x)} x2={f.gx(x)} y1={L.upper.y0} y2={L.upper.y0 + L.upper.h} />
            <line x1={f.gx(x)} x2={f.gx(x)} y1={L.strip.y0} y2={L.strip.y0 + L.strip.h} />
          </g>
          <g aria-hidden="true">
            <g clipPath={`url(#${clip})`}><Ruler f={f} x={x} y={y} g={g} len={150} thick={13} edge={ring} /></g>
            <Curve coef={coef} f={f} from={-3} to={3} clip={clip} />
            <g clipPath={`url(#${clip}s)`}>
              {trail.length > 1 && <path d={pathOf(trail.map((t) => [f.gx(t / 4), sy(num(gradientAt(coef, rat(t, 4))))] as [number, number]))} fill="none" stroke={MARK} strokeWidth={2.6} strokeLinejoin="round" strokeLinecap="round" />}
            </g>
            <circle cx={f.gx(x)} cy={sy(g)} r={5.5} fill={ring} stroke={PANEL} strokeWidth={2} />
          </g>
          <Scrub
            f={f} steps={QUARTERS * 4} min={-QUARTERS} max={QUARTERS} value={k} big={4} locked={locked} onChange={move}
            label="Slide along the curve. Left and right arrow keys move the point a quarter of a unit; Page Up and Page Down move it a whole unit"
            valuetext={`point at x = ${fmt(x)}, tangent ${slope}`}
          />
          <Handle x={f.gx(x)} y={f.uy(y)} ring={ring} />
        </Svg>
      </Figure>
      <Stepper
        name="Point" text={`x = ${fmt(x)}`} locked={locked}
        less="Move the point left a quarter of a unit" more="Move the point right a quarter of a unit"
        canLess={k > -QUARTERS} canMore={k < QUARTERS} onLess={() => move(k - 1)} onMore={() => move(k + 1)}
      />
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
  const half = LEVEL_SPAN / 2
  const step = niceStep(f.hi - f.lo, 5)
  const colour = (i: number) => {
    const wrong = marked === 'wrong' && !verdictRight && gradientAt(coef, rat(STATIONS[i])).n !== g[i]
    return verdictRight ? GOOD : wrong ? BAD : MARK
  }

  return (
    <>
      <Figure caption="Drag each dot up or down to tilt its ruler, so every ruler lies along the curve.">
        <Svg H={L.H} label="A curve on graph paper with five marks on it, each with a ruler you can tilt, and below it a second graph where you set each ruler's steepness">
          <defs>
            <clipPath id={clip}><rect x={PL} y={L.upper.y0} width={PW} height={L.upper.h} /></clipPath>
            <clipPath id={`${clip}s`}><rect x={PL} y={L.strip.y0} width={PW} height={L.strip.h} /></clipPath>
          </defs>
          <Sheet f={f} box={L.upper} map={f.uy} lo={f.lo} hi={f.hi} step={step} xs={intTicks(-3, 3)} />
          <Sheet f={f} box={L.strip} map={sy} lo={-half} hi={half} step={1} minor={false} xs={intTicks(-3, 3)} />
          <Titles f={f} top="The curve" bottom="steepness of each tangent" />
          <g aria-hidden="true">
            {STATIONS.map((x, i) => (
              <line key={x} x1={f.gx(x)} x2={f.gx(x)} y1={f.uy(evalFloat(coef, x))} y2={L.upper.y0 + L.upper.h} stroke={colour(i)} strokeWidth={1.1} strokeDasharray="3 4" opacity={0.6} />
            ))}
            <g clipPath={`url(#${clip})`}>
              {STATIONS.map((x, i) => <Ruler key={x} f={f} x={x} y={evalFloat(coef, x)} g={g[i]} len={66} thick={10} edge={colour(i)} />)}
            </g>
            <Curve coef={coef} f={f} from={-3} to={3} clip={clip} />
            {STATIONS.map((x) => <circle key={x} cx={f.gx(x)} cy={f.uy(evalFloat(coef, x))} r={3.6} fill={CURVE} stroke={PANEL} strokeWidth={1.5} />)}
            <g clipPath={`url(#${clip}s)`}>
              <path d={pathOf(pts)} fill="none" stroke={MARK} strokeWidth={2} strokeLinejoin="round" opacity={0.65} />
            </g>
          </g>
          {STATIONS.map((x, i) => {
            const cx = f.gx(x)
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
                <Handle x={cx} y={sy(g[i])} ring={colour(i)} />
              </g>
            )
          })}
        </Svg>
      </Figure>
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
  // The area as upright strips, one per half unit, each filled up to the curve.
  const strips = Array.from({ length: h }, (_, i) => {
    const a = i / 2
    const pts: Array<[number, number]> = [[f.gx(a), f.uy(0)], ...Array.from({ length: 7 }, (_, j) => [f.gx(a + j / 12), f.uy(evalFloat(coef, a + j / 12))] as [number, number]), [f.gx(a + 0.5), f.uy(0)]]
    return `${pathOf(pts)}Z`
  })
  const target = area ? num(area) : 0
  const ring = ringFor(marked)
  const move = (next: number) => setState({ h: next, far: Math.max(far, next) })
  const height = evalFloat(coef, t)
  const step = niceStep(f.hi - f.lo, 5)
  const astep = niceStep(top, 4)

  return (
    <>
      <Figure caption="Drag the line right. The strips fill with area; the lower graph adds it up.">
        <Svg H={L.H} label="A curve on graph paper above the x-axis with the area under it shaded in strips from 0 up to a line you sweep right, and below it a second graph of the area so far, with a dashed target level">
          <defs>
            <clipPath id={clip}><rect x={PL} y={L.upper.y0} width={PW} height={L.upper.h} /></clipPath>
            <clipPath id={`${clip}s`}><rect x={PL} y={L.strip.y0} width={PW} height={L.strip.h} /></clipPath>
          </defs>
          <Sheet f={f} box={L.upper} map={f.uy} lo={f.lo} hi={f.hi} step={step} xs={intTicks(0, 4)} />
          <Sheet f={f} box={L.strip} map={sy} lo={0} hi={top} step={astep} xs={intTicks(0, 4)} />
          <Titles f={f} top="The curve" bottom="area so far" />
          <g aria-hidden="true">
            <g clipPath={`url(#${clip})`}>
              {strips.map((d, i) => <path key={i} d={d} fill={CURVE} fillOpacity={0.24} stroke={CURVE} strokeOpacity={0.5} strokeWidth={0.9} strokeLinejoin="round" />)}
            </g>
            <Curve coef={coef} f={f} from={0} to={4} clip={clip} />
            <line x1={f.gx(t)} x2={f.gx(t)} y1={f.uy(0)} y2={f.uy(height)} stroke={ring} strokeWidth={2.6} />
            <text x={PL + 80} y={L.strip.y0 - 10} fontSize={13} fontWeight={800} fill={INK}>{areaText(total)}</text>
            <line x1={PL} x2={PR} y1={sy(target)} y2={sy(target)} stroke={INK} strokeWidth={1.4} strokeDasharray="5 4" />
            <text x={PR - 4} y={sy(target) - 6} textAnchor="end" fontSize={12} fontWeight={700} fill={INK} {...HALO}>{`target ${area ? areaText(area) : ''}`}</text>
            <g clipPath={`url(#${clip}s)`}>
              {far > 0 && <path d={pathOf(trace)} fill="none" stroke={MARK} strokeWidth={2.6} strokeLinejoin="round" strokeLinecap="round" />}
            </g>
            <circle cx={f.gx(t)} cy={sy(num(total))} r={5.5} fill={ring} stroke={PANEL} strokeWidth={2} />
          </g>
          <Scrub
            f={f} steps={HALVES} min={0} max={HALVES} value={h} big={2} locked={locked} onChange={move}
            label="Sweep the line along the x-axis. Left and right arrow keys move it half a unit; Page Up and Page Down move it a whole unit"
            valuetext={`line at x = ${t}, area so far ${areaText(total)}`}
          />
          <Handle x={f.gx(t)} y={f.uy(height)} ring={ring} />
        </Svg>
      </Figure>
      <Stepper
        name="Line" text={`x = ${t}`} locked={locked}
        less="Move the line left half a unit" more="Move the line right half a unit"
        canLess={h > 0} canMore={h < HALVES} onLess={() => move(h - 1)} onMore={() => move(h + 1)}
      />
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
    <div className={`nodrag flex flex-col items-center gap-3 ${PALETTE}`}>
      {kind === 'find-stationary' ? <FindStationary {...props} /> : kind === 'set-gradients' ? <SetGradients {...props} /> : <SweepArea {...props} />}
    </div>
  )
}
