'use client'
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { SceneMarked, SceneViewProps } from '../types'
import type { GrowConfig, LengthConfig, SimConfig, SimState } from './config'
import { fmt, madeText, problemOf, readScale, solved, targetScale, unitOf, working } from './config'

type Props = SceneViewProps<SimConfig, SimState>
type Pt = { x: number; y: number }

// The same quiet paper plate in both themes, as on measure-shape and bonding.
const PLATE = '#F8FAFC'
const EDGE = '#CBD5E1'
const INK = '#334155'
const SOFT = '#64748B'
const GREY = '#E2E8F0'
const GREY_EDGE = '#64748B'
const BLUE = '#93C5FD'
const BLUE_EDGE = '#2563EB'
const BLUE_DARK = '#1D4ED8'
const TARGET = '#64748B'
const FONT = 'system-ui, sans-serif'

export const W = 360
export const H = 238
const MIN_SCALE = 0.5
const MAX_SCALE = 3
const SCALE_STEP = 0.25

const f = (n: number) => n.toFixed(2)
const points = (ps: Pt[]) => ps.map((p) => `${f(p.x)},${f(p.y)}`).join(' ')
const mix = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })

/** A triangle from its three true side lengths: base, left side and right side. */
export function triangleSides(base: number, left: number, right: number) {
  const x = (left * left - right * right + base * base) / (2 * base)
  return { x, h: Math.sqrt(Math.max(0, left * left - x * x)) }
}

export type TriDraw = { a: Pt; b: Pt; c: Pt }

/** The triangle at `scale`, in a fixed target's coordinate system. */
function triAt(problem: ReturnType<typeof problemOf>, scale: number, origin: Pt, px: number): TriDraw {
  const t = triangleSides(problem.small.base, problem.small.height, problem.small.slant)
  return {
    a: origin,
    b: { x: origin.x + problem.small.base * scale * px, y: origin.y },
    c: { x: origin.x + t.x * scale * px, y: origin.y - t.h * scale * px },
  }
}

function lengthLayout(config: LengthConfig) {
  const p = problemOf(config)
  const t = triangleSides(p.small.base, p.small.height, p.small.slant)
  if (config.layout === 'nested') {
    const px = Math.min(270 / (p.small.base * MAX_SCALE), 174 / (t.h * MAX_SCALE))
    const k = targetScale(config)
    const baseY = 202
    const a = { x: 180 - (p.small.base * k * px) / 2, y: baseY }
    const target = triAt(p, k, a, px)
    const at = (scale: number) => {
      const r = scale / k
      return { a: mix(target.c, target.a, r), b: mix(target.c, target.b, r), c: target.c }
    }
    return { p, target, at, px, nested: true }
  }
  const px = Math.min(184 / (p.small.base * MAX_SCALE), 163 / (t.h * MAX_SCALE))
  const k = targetScale(config)
  const origin = { x: 184, y: 202 }
  return { p, target: triAt(p, k, origin, px), at: (scale: number) => triAt(p, scale, origin, px), px, nested: false }
}

/** An arc at a vertex, drawn between the two adjacent sides. */
function angleArc(at: Pt, one: Pt, two: Pt, r: number): string {
  const unit = (p: Pt) => {
    const d = Math.hypot(p.x - at.x, p.y - at.y) || 1
    return { x: at.x + ((p.x - at.x) / d) * r, y: at.y + ((p.y - at.y) / d) * r }
  }
  const a = unit(one)
  const b = unit(two)
  return `M ${f(a.x)} ${f(a.y)} A ${r} ${r} 0 0 1 ${f(b.x)} ${f(b.y)}`
}

function Angles({ tri, color, r = 10 }: { tri: TriDraw; color: string; r?: number }) {
  return (
    <g fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" aria-hidden="true">
      <path d={angleArc(tri.a, tri.b, tri.c, r)} />
      <path d={angleArc(tri.b, tri.a, tri.c, r)} />
      <path d={angleArc(tri.c, tri.a, tri.b, r)} />
    </g>
  )
}

function ParallelMark({ a, b, color }: { a: Pt; b: Pt; color: string }) {
  const m = mix(a, b, 0.56)
  const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI
  return <path d="M -5 -4 L 0 0 L -5 4" transform={`translate(${f(m.x)} ${f(m.y)}) rotate(${angle})`} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" />
}

function SideLabel({ a, b, text, side = 1, dx = 0, dy = 0 }: { a: Pt; b: Pt; text: string; side?: number; dx?: number; dy?: number }) {
  const m = mix(a, b, 0.5)
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1
  const nx = (-(b.y - a.y) / len) * side
  const ny = ((b.x - a.x) / len) * side
  return (
    <text x={f(m.x + nx * 15 + dx)} y={f(m.y + ny * 15 + dy)} textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={700} fill={INK} stroke={PLATE} strokeWidth={3.5} paintOrder="stroke" strokeLinejoin="round">
      {text}
    </text>
  )
}

/** The small fixed reference triangle, with its two given lengths. */
function ReferenceTriangle({ config }: { config: LengthConfig }) {
  const layout = lengthLayout(config)
  const { p } = layout
  const t = triangleSides(p.small.base, p.small.height, p.small.slant)
  const px = Math.min(110 / p.small.base, 150 / t.h)
  const tri = triAt(p, 1, { x: 28, y: 202 }, px)
  const missing = p.missing
  return (
    <g fontFamily={FONT}>
      <polygon points={points([tri.a, tri.b, tri.c])} fill={GREY} stroke={GREY_EDGE} strokeWidth={2} strokeLinejoin="round" />
      <Angles tri={tri} color={GREY_EDGE} r={8} />
      <SideLabel a={tri.a} b={tri.b} text={`${fmt(p.small.base)} cm`} side={1} dy={-27} />
      {missing !== 'height' && <SideLabel a={tri.a} b={tri.c} text={`${fmt(p.small.height)} cm`} side={1} />}
      {missing !== 'slant' && <SideLabel a={tri.b} b={tri.c} text={`${fmt(p.small.slant)} cm`} side={1} />}
      <text x={80} y={31} textAnchor="middle" fontSize={12} fontWeight={700} fill={SOFT}>Original triangle</text>
    </g>
  )
}

function LengthPicture({ config, scale }: { config: LengthConfig; scale: number }) {
  const layout = lengthLayout(config)
  const { p, target, nested } = layout
  const blue = layout.at(scale)
  const original = layout.at(1)
  return (
    <g fontFamily={FONT}>
      {!nested && <ReferenceTriangle config={config} />}
      {nested && <text x={180} y={29} textAnchor="middle" fontSize={12} fontWeight={700} fill={SOFT}>Parallel sides · equal angles</text>}
      {/* The dashed outline is the wanted outer shape. */}
      <polygon points={points([target.a, target.b, target.c])} fill="none" stroke={TARGET} strokeWidth={2} strokeDasharray="6 5" strokeLinejoin="round" />
      {nested && (
        <g>
          <polygon points={points([original.a, original.b, original.c])} fill={GREY} stroke={GREY_EDGE} strokeWidth={1.8} strokeLinejoin="round" />
          <Angles tri={original} color={GREY_EDGE} r={8} />
          <text x={original.c.x - 15} y={original.c.y - 10} textAnchor="end" fontSize={12} fontWeight={700} fill={SOFT}>Original</text>
        </g>
      )}
      <polygon data-blue-shape points={points([blue.a, blue.b, blue.c])} fill={BLUE} fillOpacity={nested ? 0.5 : 0.68} stroke={BLUE_EDGE} strokeWidth={2.4} strokeLinejoin="round" />
      <Angles tri={blue} color={BLUE_DARK} r={11} />
      {nested && (
        <>
          <ParallelMark a={original.a} b={original.b} color={GREY_EDGE} />
          <ParallelMark a={target.a} b={target.b} color={TARGET} />
        </>
      )}
      {/* Fixed target labels never move with the handle; a missing side stays unlabelled. */}
      {p.missing !== 'base' && <SideLabel a={target.a} b={target.b} text={`${fmt(p.large.base)} cm`} side={1} dy={-27} />}
      {p.missing !== 'height' && <SideLabel a={target.a} b={target.c} text={`${fmt(p.large.height)} cm`} side={-1} dx={nested ? -2 : 4} />}
      {nested && p.missing !== 'slant' && <SideLabel a={target.b} b={target.c} text={`${fmt(p.large.slant)} cm`} side={1} />}
      {!nested && <text x={270} y={31} textAnchor="middle" fontSize={12} fontWeight={700} fill={SOFT}>Grow to the dashed triangle</text>}
      {!nested && <text x={180} y={226} textAnchor="middle" fontSize={12} fontWeight={700} fill={SOFT}>Matching arcs are equal angles</text>}
    </g>
  )
}

function SquarePicture({ config, scale }: { config: GrowConfig; scale: number }) {
  const unit = 49
  const k = targetScale(config)
  const small = { x: 35, y: 190 }
  const big = { x: 180, y: 202 }
  const size = unit * scale
  const target = unit * k
  const grid = Number.isInteger(scale) && scale >= 2 ? scale : 0
  return (
    <g fontFamily={FONT}>
      <text x={35} y={37} fontSize={12} fontWeight={700} fill={SOFT}>Original square</text>
      <rect x={small.x} y={small.y - unit} width={unit} height={unit} fill={GREY} stroke={GREY_EDGE} strokeWidth={2} />
      <text x={small.x + unit / 2} y={small.y + 20} textAnchor="middle" fontSize={12} fontWeight={700} fill={INK}>{config.base} {unitOf(config)}</text>
      <text x={180} y={37} fontSize={12} fontWeight={700} fill={SOFT}>Grow to the dashed square</text>
      <rect x={big.x} y={big.y - target} width={target} height={target} fill="none" stroke={TARGET} strokeWidth={2} strokeDasharray="6 5" />
      <rect data-blue-shape x={big.x} y={big.y - size} width={size} height={size} fill={BLUE} fillOpacity={0.72} stroke={BLUE_EDGE} strokeWidth={2.4} />
      {grid > 0 && Array.from({ length: grid - 1 }, (_, i) => i + 1).map((i) => (
        <g key={i} stroke={BLUE_DARK} strokeWidth={1.3} opacity={0.8}>
          <line x1={big.x + i * unit} x2={big.x + i * unit} y1={big.y - size} y2={big.y} />
          <line x1={big.x} x2={big.x + size} y1={big.y - i * unit} y2={big.y - i * unit} />
        </g>
      ))}
      <text x={big.x + target / 2} y={226} textAnchor="middle" fontSize={12} fontWeight={700} fill={SOFT}>Target area: {config.target} {unitOf(config)}</text>
    </g>
  )
}

type CubeFaces = { front: Pt[]; top: Pt[]; side: Pt[]; origin: Pt; size: number; depth: Pt }
function cubeAt(x: number, y: number, size: number): CubeFaces {
  const d = { x: size * 0.38, y: -size * 0.32 }
  const a = { x, y }
  const b = { x: x + size, y }
  const c = { x: x + size, y: y - size }
  const e = { x, y: y - size }
  const shift = (p: Pt) => ({ x: p.x + d.x, y: p.y + d.y })
  return {
    front: [a, b, c, e], top: [e, c, shift(c), shift(e)], side: [b, shift(b), shift(c), c], origin: a, size, depth: d,
  }
}

function CubeGrid({ cube, n }: { cube: CubeFaces; n: number }) {
  if (n < 2) return null
  const { origin: a, size: s, depth: d } = cube
  const lines: { from: Pt; to: Pt }[] = []
  for (let i = 1; i < n; i++) {
    const q = i / n
    // Front face.
    lines.push({ from: { x: a.x + s * q, y: a.y }, to: { x: a.x + s * q, y: a.y - s } })
    lines.push({ from: { x: a.x, y: a.y - s * q }, to: { x: a.x + s, y: a.y - s * q } })
    // Top face: front-to-back and left-to-right seams.
    lines.push({ from: { x: a.x + s * q, y: a.y - s }, to: { x: a.x + s * q + d.x, y: a.y - s + d.y } })
    lines.push({ from: { x: a.x + d.x * q, y: a.y - s + d.y * q }, to: { x: a.x + s + d.x * q, y: a.y - s + d.y * q } })
    // Right face: vertical and depth seams.
    lines.push({ from: { x: a.x + s + d.x * q, y: a.y + d.y * q }, to: { x: a.x + s + d.x * q, y: a.y - s + d.y * q } })
    lines.push({ from: { x: a.x + s, y: a.y - s * q }, to: { x: a.x + s + d.x, y: a.y - s * q + d.y } })
  }
  return <g stroke={BLUE_DARK} strokeWidth={0.85} opacity={0.72}>{lines.map((l, i) => <line key={i} x1={l.from.x} y1={l.from.y} x2={l.to.x} y2={l.to.y} />)}</g>
}

function CubePicture({ config, scale }: { config: GrowConfig; scale: number }) {
  const unit = 39
  const k = targetScale(config)
  const small = cubeAt(27, 174, unit)
  const target = cubeAt(158, 199, unit * k)
  const cube = cubeAt(158, 199, unit * scale)
  const grid = Number.isInteger(scale) && scale >= 2 ? scale : 0
  return (
    <g fontFamily={FONT}>
      <text x={25} y={37} fontSize={12} fontWeight={700} fill={SOFT}>Original cube</text>
      <polygon points={points(small.top)} fill={GREY} stroke={GREY_EDGE} strokeWidth={1.5} />
      <polygon points={points(small.side)} fill="#CBD5E1" stroke={GREY_EDGE} strokeWidth={1.5} />
      <polygon points={points(small.front)} fill="#E2E8F0" stroke={GREY_EDGE} strokeWidth={1.5} />
      <text x={48} y={216} textAnchor="middle" fontSize={12} fontWeight={700} fill={INK}>{config.base} {unitOf(config)}</text>
      <text x={158} y={29} fontSize={12} fontWeight={700} fill={SOFT}>Grow to the dashed cube</text>
      <g fill="none" stroke={TARGET} strokeWidth={1.8} strokeDasharray="5 4" strokeLinejoin="round">
        <polygon points={points(target.front)} />
        <polygon points={points(target.top)} />
        <polygon points={points(target.side)} />
      </g>
      <g data-blue-shape stroke={BLUE_EDGE} strokeWidth={1.5} strokeLinejoin="round">
        <polygon points={points(cube.top)} fill="#BFDBFE" fillOpacity={0.88} />
        <polygon points={points(cube.side)} fill="#60A5FA" fillOpacity={0.88} />
        <polygon points={points(cube.front)} fill="#93C5FD" fillOpacity={0.88} />
      </g>
      <CubeGrid cube={cube} n={grid} />
      <text x={246} y={226} textAnchor="middle" fontSize={12} fontWeight={700} fill={SOFT}>Target volume: {config.target} {unitOf(config)}</text>
    </g>
  )
}

/** Ease only the response to a move; reduced motion gets the same new still frame at once. */
function useDisplayedScale(target: number, reduced: boolean): number {
  const [shown, setShown] = useState(target)
  const current = useRef(target)
  useEffect(() => {
    if (reduced) {
      current.current = target
      setShown(target)
      return
    }
    const from = current.current
    if (from === target) return
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 240)
      const eased = 1 - (1 - t) ** 3
      current.current = from + (target - from) * eased
      setShown(current.current)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, reduced])
  return shown
}

const STEP_BUTTON = 'nodrag flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-lg border-2 border-ss-line bg-ss-panel text-[16px] font-extrabold leading-none text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'

function describe(config: SimConfig, scale: number): string {
  if (config.task === 'length') {
    const p = problemOf(config)
    return `A grey triangle and a blue triangle at length factor ${fmt(scale)}. Matching arcs mark corresponding angles. The blue triangle can be resized by its corner to meet a dashed target. Its ${p.missing} is now ${fmt(p.small[p.missing] * scale)} centimetres; the target is ${fmt(p.large[p.missing])} centimetres.`
  }
  const measure = config.base * (config.solid === 'square' ? scale * scale : scale ** 3)
  return `A small grey ${config.solid} and a blue ${config.solid} at length factor ${fmt(scale)}, with a dashed target. Its ${config.solid === 'square' ? 'area' : 'volume'} is now ${fmt(measure)} ${unitOf(config)}; the target is ${config.target} ${unitOf(config)}. Whole copy grid lines appear at whole-number factors.`
}

export function SimilarityView({ config, state, setState, marked, reduced, locked }: Props) {
  const actual = marked === 'shown' ? targetScale(config) : readScale(state)
  const scale = useDisplayedScale(actual, reduced)
  const svgRef = useRef<SVGSVGElement>(null)
  const dragging = useRef(false)
  const good = marked === 'right' || marked === 'shown'
  const near = good && Math.abs(actual - targetScale(config)) > 0.005
  const said = good ? working(config) : marked === 'wrong' ? madeText(config, { scale: actual }) : ''

  const set = (next: number) => {
    if (locked || marked === 'shown') return
    const clamped = Math.max(MIN_SCALE, Math.min(MAX_SCALE, Math.round(next / SCALE_STEP) * SCALE_STEP))
    setState({ scale: clamped })
  }

  const handlePoint = (): Pt => {
    if (config.task === 'length') {
      const layout = lengthLayout(config)
      const tri = layout.at(scale)
      // On a nested triangle the parallel cross-side is the thing being moved.
      // Its midpoint stays clear of the fixed side labels at every size.
      return layout.nested ? mix(tri.a, tri.b, 0.5) : tri.b
    }
    if (config.solid === 'square') return { x: 180 + 49 * scale, y: 202 - 49 * scale }
    const cube = cubeAt(158, 199, 39 * scale)
    return { x: cube.origin.x + cube.size, y: cube.origin.y - cube.size }
  }

  const scaleFromPointer = (e: PointerEvent<SVGGElement>) => {
    const svg = svgRef.current
    if (!svg) return
    const r = svg.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * W
    const y = ((e.clientY - r.top) / r.height) * H
    if (config.task === 'length') {
      const layout = lengthLayout(config)
      if (layout.nested) {
        const target = layout.target
        const vx = target.b.x - target.c.x
        const vy = target.b.y - target.c.y
        const along = ((x - target.c.x) * vx + (y - target.c.y) * vy) / (vx * vx + vy * vy)
        set(targetScale(config) * along)
      } else set((x - layout.target.a.x) / (layout.px * layout.p.small.base))
    } else if (config.solid === 'square') set((x - 180) / 49)
    else set((x - 158) / 39)
  }

  const down = (e: PointerEvent<SVGGElement>) => {
    if (locked || e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    dragging.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    scaleFromPointer(e)
  }
  const move = (e: PointerEvent<SVGGElement>) => {
    if (!dragging.current) return
    e.preventDefault()
    scaleFromPointer(e)
  }
  const up = (e: PointerEvent<SVGGElement>) => {
    dragging.current = false
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
  }
  const keys = (e: KeyboardEvent<SVGGElement>) => {
    const change = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? SCALE_STEP : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -SCALE_STEP : 0
    if (!change && !['Home', 'End', '+', '=', '-'].includes(e.key)) return
    e.preventDefault()
    e.stopPropagation()
    if (e.key === 'Home') set(MIN_SCALE)
    else if (e.key === 'End') set(MAX_SCALE)
    else if (e.key === '+' || e.key === '=') set(actual + SCALE_STEP)
    else if (e.key === '-') set(actual - SCALE_STEP)
    else set(actual + change)
  }

  const hp = handlePoint()
  const measure = config.task === 'length'
    ? problemOf(config).small[problemOf(config).missing] * actual
    : config.base * (config.solid === 'square' ? actual * actual : actual ** 3)
  const measureName = config.task === 'length'
    ? `${problemOf(config).missing === 'base' ? 'Base' : problemOf(config).missing === 'height' ? 'Left side' : 'Right side'} now`
    : config.solid === 'square' ? 'Area now' : 'Volume now'
  const measureUnit = config.task === 'length' ? 'cm' : unitOf(config)
  const targetMeasure = config.task === 'length' ? problemOf(config).large[problemOf(config).missing] : config.target
  const copies = Number.isInteger(actual) && actual >= 2 && config.task === 'grow' ? (config.solid === 'square' ? actual * actual : actual ** 3) : 0
  const caption = config.task === 'length'
    ? 'Same angles. Every side grows by the same factor.'
    : copies ? `${copies} copies of the grey ${config.solid} fit inside.` : `Grow the blue ${config.solid} to the dashed outline.`

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-2">
      <figure className="m-0 flex w-full flex-col gap-1.5">
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={describe(config, actual)} className="block h-auto w-full select-none">
          <rect x={0.75} y={0.75} width={W - 1.5} height={H - 1.5} rx={16} fill={PLATE} stroke={EDGE} strokeWidth={1.5} />
          {config.task === 'length' ? <LengthPicture config={config} scale={scale} /> : config.solid === 'square' ? <SquarePicture config={config} scale={scale} /> : <CubePicture config={config} scale={scale} />}
          {!locked && marked !== 'shown' && (
            <g
              data-scale-handle role="slider" tabIndex={0} aria-label="Resize the blue shape" aria-valuemin={MIN_SCALE} aria-valuemax={MAX_SCALE} aria-valuenow={actual} aria-valuetext={`${fmt(actual)} times the original lengths`}
              transform={`translate(${f(hp.x)} ${f(hp.y)})`} className="touch-none cursor-grab outline-none focus-visible:outline-none" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onKeyDown={keys}
            >
              <circle r={19} fill="transparent" />
              <circle r={11} fill="#FFFFFF" stroke={BLUE_EDGE} strokeWidth={2.2} />
              <path d="M -5 0 H 5 M -5 0 L -2 -3 M -5 0 L -2 3 M 5 0 L 2 -3 M 5 0 L 2 3" fill="none" stroke={BLUE_DARK} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
              <circle r={15} fill="none" stroke="var(--subject)" strokeWidth={2} opacity={0} className="[g:focus-visible>&]:opacity-100" />
            </g>
          )}
        </svg>
        <figcaption className="text-center text-[12px] font-bold text-ss-slate">{caption}</figcaption>
      </figure>

      <div className="flex flex-col gap-1.5 border-t border-ss-line pt-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12px] font-bold text-ss-slate">Length factor</span>
          <span className="flex items-center gap-1">
            <button type="button" aria-label="Decrease length factor" disabled={locked || actual <= MIN_SCALE} onClick={() => set(actual - SCALE_STEP)} className={STEP_BUTTON}>−</button>
            <span className="min-w-[52px] text-center text-[15px] font-extrabold tabular-nums text-ss-ink">× {fmt(actual)}</span>
            <button type="button" aria-label="Increase length factor" disabled={locked || actual >= MAX_SCALE} onClick={() => set(actual + SCALE_STEP)} className={STEP_BUTTON}>+</button>
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-2" aria-live="polite">
          <span className="text-[12px] font-bold text-ss-slate">{measureName}</span>
          <span className="text-[15px] font-extrabold tabular-nums text-ss-ink">{fmt(measure)} {measureUnit} <span className="text-[12px] font-semibold text-ss-slate">/ {fmt(targetMeasure)} {measureUnit}</span></span>
        </div>
      </div>

      <span className="sr-only">Use the left and right arrow keys on the corner handle to resize the blue shape.</span>
      {marked !== 'idle' && (
        <div className="rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2" aria-live="polite">
          <p className="text-[13px] font-extrabold leading-snug text-ss-ink">{near ? working(config).replace('Yes.', 'Near enough.') : said}</p>
        </div>
      )}
    </div>
  )
}
