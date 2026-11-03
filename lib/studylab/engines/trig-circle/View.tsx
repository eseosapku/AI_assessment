'use client'
import { useId, useRef } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import type { SceneViewProps } from '../types'
import type { TrigConfig, TrigState } from './config'
import {
  angleAt, angleOf, fmtM, ladderOk, snapFoot, footMax, footOf, madeText, showNumber, topAt, trigCircleEngine, working,
} from './config'

type Props = SceneViewProps<TrigConfig, TrigState>
type Ladder = Extract<TrigConfig, { task: 'ladder' }>
type Circle = Extract<TrigConfig, { task: 'circle' }>

// A quiet light plate, as measure-shape's and network-sim's are, kept in both themes so each part keeps its contrast.
// Plain colours: no gradients, glows or shadows. One accent, for the thing the learner is steering to or measuring.
const PLATE = '#F8FAFC'
const PLATE_EDGE = '#CBD5E1'
const INK = '#16202A'
const SOFT = '#475569'
const FAINT = '#CBD5E1'
const ACCENT = '#2563EB'
const FONT = 'system-ui, sans-serif'
// The ladder's world: render and brick on the wall, paving underfoot, painted timber.
const WALL = '#E6DCCE'
const WALL_LINE = '#D3C5B2'
const WALL_EDGE = '#9C8A74'
const GROUND = '#D5DAE0'
const GROUND_LINE = '#94A3B8'
const GLASS = '#BAD3EC'
const FRAME = '#FFFFFF'
const WOOD = '#C08F52'
const WOOD_EDGE = '#7C5A2E'
const RUBBER = '#334155'

// Literals, not config's: the two files import each other, so at load time config's constants do not exist. A test
// holds each of these to its config value.
export const W = 360
export const H = 236
export const WALL_X = 286
export const GROUND_Y = 190
export const LADDER_PX = 150
export const STEP_DEG = 15
export const TILT_LIMITS = [20, 80]
export const CX = 110
export const CY = 118
export const R = 80
export const GX = 222
export const GW = 124

const f1 = (n: number) => n.toFixed(1)
const deg = (r: number) => (r * 180) / Math.PI
const rad = (d: number) => (d * Math.PI) / 180

// ---------------------------------------------------------------------------
// Where things are. Pure, so a test can hold the drawing to the same numbers the marking uses.

export type LadderGeometry = {
  scale: number
  foot: { x: number; y: number }
  top: { x: number; y: number }
  /** The unit vector along the ladder, from foot to top. */
  u: { x: number; y: number }
  d10: number
  height: number
  angle: number
}

export function ladderGeometry(config: Ladder, d10: number): LadderGeometry {
  const scale = LADDER_PX / config.length
  const height = topAt(config.length, d10)
  const foot = { x: WALL_X - (d10 / 10) * scale, y: GROUND_Y }
  const top = { x: WALL_X, y: GROUND_Y - height * scale }
  const long = Math.hypot(top.x - foot.x, top.y - foot.y) || 1
  return { scale, foot, top, u: { x: (top.x - foot.x) / long, y: (top.y - foot.y) / long }, d10, height, angle: angleAt(config.length, d10) }
}

export type PointGeometry = { p: { x: number; y: number }; sin: number; cos: number }
export function pointGeometry(angle: number): PointGeometry {
  const s = Math.sin(rad(angle))
  const c = Math.cos(rad(angle))
  return { p: { x: CX + R * c, y: CY - R * s }, sin: s, cos: c }
}

const curveX = (a: number) => GX + (GW * a) / 360
const curveY = (fn: string, a: number) => CY - R * (fn === 'cosine' ? Math.cos(rad(a)) : Math.sin(rad(a)))
export function curvePath(fn: string, upTo: number): string {
  if (upTo <= 0) return ''
  const pts: string[] = []
  for (let a = 0; a <= upTo; a += 5) pts.push(`${pts.length ? 'L' : 'M'} ${f1(curveX(a))} ${f1(curveY(fn, a))}`)
  if (upTo % 5 !== 0) pts.push(`L ${f1(curveX(upTo))} ${f1(curveY(fn, upTo))}`)
  return pts.join(' ')
}

/** Rungs: about one every 0.35 m, but never closer than the eye can tell apart. */
export const rungCount = (length: number) => Math.max(7, Math.min(14, Math.round(length / 0.35)))

// ---------------------------------------------------------------------------
// The ladder.

function LadderPicture({ config, g, marked, uid, met }: { config: Ladder; g: LadderGeometry; marked: Props['marked']; uid: string; met: boolean }) {
  const { foot, top, u, scale } = g
  const nx = u.y
  const ny = -u.x
  // Rails stand 5 px either side of the centre line, and are cut off at the wall face.
  const rail = (side: 1 | -1) => ({ x1: foot.x + nx * 5 * side, y1: foot.y + ny * 5 * side, x2: top.x + nx * 5 * side, y2: top.y + ny * 5 * side })
  const a = rail(1)
  const b = rail(-1)
  const rungs = Array.from({ length: rungCount(config.length) }, (_, i) => (i + 1) / (rungCount(config.length) + 1))
  const mid = { x: (foot.x + top.x) / 2, y: (foot.y + top.y) / 2 }
  const labelAt = { x: mid.x + u.y * 15, y: mid.y - u.x * 15 + 4 }
  const theta = rad(g.angle)
  const arc = `M ${f1(foot.x + 30)} ${f1(foot.y)} A 30 30 0 0 0 ${f1(foot.x + 30 * Math.cos(theta))} ${f1(foot.y - 30 * Math.sin(theta))}`
  const sector = `M ${f1(foot.x)} ${f1(foot.y)} L ${f1(foot.x + 30)} ${f1(foot.y)} A 30 30 0 0 0 ${f1(foot.x + 30 * Math.cos(theta))} ${f1(foot.y - 30 * Math.sin(theta))} Z`
  const tickYs = Array.from({ length: Math.floor(config.length) }, (_, i) => GROUND_Y - (i + 1) * scale).filter((y) => y > 16)
  const target = config.value * scale
  const sillY = GROUND_Y - target
  const flagX = WALL_X - target
  const win = Math.min(38, sillY - 8)
  const bricks: number[] = []
  for (let y = GROUND_Y - 12; y > 0; y -= 12) bricks.push(y)
  const done = marked === 'right' || marked === 'shown'
  return (
    <g>
      <defs>
        <clipPath id={`${uid}-panel`}><rect x={0.75} y={0.75} width={W - 1.5} height={H - 1.5} rx={16} /></clipPath>
        <clipPath id={`${uid}-air`}><rect x={0} y={0} width={WALL_X} height={GROUND_Y} /></clipPath>
      </defs>
      <g clipPath={`url(#${uid}-panel)`}>
        <rect x={0} y={0} width={W} height={H} fill={PLATE} />
        {/* the wall: brick courses, and a vertical gauge of whole metres on its face */}
        <rect x={WALL_X} y={0} width={W - WALL_X} height={GROUND_Y} fill={WALL} />
        {bricks.map((y, i) => (
          <g key={y} stroke={WALL_LINE} strokeWidth={1.2}>
            <line x1={WALL_X} x2={W} y1={y} y2={y} />
            {[0, 1, 2, 3].map((k) => <line key={k} x1={WALL_X + 12 + (i % 2 ? 9 : 0) + k * 18} x2={WALL_X + 12 + (i % 2 ? 9 : 0) + k * 18} y1={y} y2={y + 12} />)}
          </g>
        ))}
        <line x1={WALL_X} x2={WALL_X} y1={0} y2={GROUND_Y} stroke={WALL_EDGE} strokeWidth={2.4} />
        {config.ask === 'height' && tickYs.map((y) => <line key={y} x1={WALL_X} x2={WALL_X + 8} y1={y} y2={y} stroke={WALL_EDGE} strokeWidth={1.6} />)}
        {/* the ground: paving slabs */}
        <rect x={0} y={GROUND_Y} width={W} height={H - GROUND_Y} fill={GROUND} />
        <line x1={0} x2={W} y1={GROUND_Y} y2={GROUND_Y} stroke={GROUND_LINE} strokeWidth={2} />
        {[0, 1, 2, 3, 4, 5, 6, 7].map((k) => <line key={k} x1={14 + k * 48} x2={14 + k * 48} y1={GROUND_Y + 2} y2={H} stroke={FAINT} strokeWidth={1.4} />)}
        <line x1={0} x2={W} y1={GROUND_Y + 22} y2={GROUND_Y + 22} stroke={FAINT} strokeWidth={1.4} />
      </g>
      <rect x={0.75} y={0.75} width={W - 1.5} height={H - 1.5} rx={16} fill="none" stroke={PLATE_EDGE} strokeWidth={1.5} />
      {config.ask === 'height' ? (
        <g data-mark="sill">
          {/* a window set into the wall, its sill at the height asked for */}
          <rect x={WALL_X + 18} y={sillY - win} width={40} height={win} fill={GLASS} stroke={WALL_EDGE} strokeWidth={1.6} />
          <rect x={WALL_X + 20} y={sillY - win + 2} width={36} height={win - 4} fill="none" stroke={FRAME} strokeWidth={2.4} />
          <line x1={WALL_X + 38} x2={WALL_X + 38} y1={sillY - win} y2={sillY} stroke={FRAME} strokeWidth={2.4} />
          <rect x={WALL_X + 14} y={sillY} width={48} height={5} rx={1.5} fill={met ? ACCENT : '#F1EDE6'} stroke={met ? ACCENT : WALL_EDGE} strokeWidth={1.4} data-met={met ? '1' : '0'} />
          <line x1={WALL_X - 16} x2={WALL_X} y1={sillY + 2.5} y2={sillY + 2.5} stroke={ACCENT} strokeWidth={3} strokeLinecap="round" />
          <text x={WALL_X + 38} y={sillY + 22} textAnchor="middle" fontSize={12} fontWeight={700} fill={INK} fontFamily={FONT}>{fmtM(config.value)} m</text>
        </g>
      ) : (
        <g data-mark="line" data-met={met ? '1' : '0'}>
          {/* a line painted across the paving, at the distance asked for */}
          <rect x={f1(flagX - (met ? 4.5 : 2.5))} y={GROUND_Y + 4} width={met ? 9 : 5} height={26} rx={1} fill={ACCENT} />
          <text x={f1(flagX)} y={GROUND_Y + 43} textAnchor="middle" fontSize={12} fontWeight={700} fill={INK} fontFamily={FONT}>{fmtM(config.value)} m</text>
        </g>
      )}
      <g clipPath={`url(#${uid}-air)`} data-ladder>
        {/* the angle, an arc with no number on it */}
        <path d={sector} fill={ACCENT} fillOpacity={0.14} data-arc />
        <path d={arc} fill="none" stroke={ACCENT} strokeWidth={2.4} strokeLinecap="round" />
        {/* the ladder: two painted rails, rungs, and rubber feet */}
        <line {...a} stroke={WOOD_EDGE} strokeWidth={5.4} strokeLinecap="butt" />
        <line {...b} stroke={WOOD_EDGE} strokeWidth={5.4} strokeLinecap="butt" />
        <line {...a} stroke={WOOD} strokeWidth={3} />
        <line {...b} stroke={WOOD} strokeWidth={3} />
        {rungs.map((t) => (
          <line key={t} x1={a.x1 + (a.x2 - a.x1) * t} y1={a.y1 + (a.y2 - a.y1) * t} x2={b.x1 + (b.x2 - b.x1) * t} y2={b.y1 + (b.y2 - b.y1) * t} stroke={WOOD_EDGE} strokeWidth={3.2} strokeLinecap="round" />
        ))}
        {rungs.map((t) => (
          <line key={`h${t}`} x1={a.x1 + (a.x2 - a.x1) * t} y1={a.y1 + (a.y2 - a.y1) * t} x2={b.x1 + (b.x2 - b.x1) * t} y2={b.y1 + (b.y2 - b.y1) * t} stroke={WOOD} strokeWidth={1.4} strokeLinecap="round" />
        ))}
        <circle cx={a.x1} cy={a.y1} r={3.6} fill={RUBBER} />
        <circle cx={b.x1} cy={b.y1} r={3.6} fill={RUBBER} />
      </g>
      <text x={f1(labelAt.x)} y={f1(labelAt.y)} textAnchor="end" fontSize={12} fontWeight={700} fill={SOFT} fontFamily={FONT} stroke={PLATE} strokeWidth={3} paintOrder="stroke" strokeLinejoin="round" data-length>
        {fmtM(config.length)} m
      </text>
      {/* the handle, on the foot of the ladder itself */}
      {!done && (
        <g data-handle transform={`translate(${f1(foot.x)} ${GROUND_Y + 3})`}>
          <circle r={12} fill="#FFFFFF" stroke={ACCENT} strokeWidth={2.4} />
          <path d="M -3.4 0 L -7.6 0 M -7.6 0 L -5 -2.4 M -7.6 0 L -5 2.4 M 3.4 0 L 7.6 0 M 7.6 0 L 5 -2.4 M 7.6 0 L 5 2.4" fill="none" stroke={INK} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )}
    </g>
  )
}

// ---------------------------------------------------------------------------
// The circle.

function CirclePicture({ config, angle, marked }: { config: Circle; angle: number; marked: Props['marked'] }) {
  const fn = config.fn === 'cosine' ? 'cosine' : 'sine'
  const g = pointGeometry(angle)
  const asked = ACCENT
  const quiet = '#64748B'
  const sinCol = fn === 'sine' ? asked : quiet
  const cosCol = fn === 'cosine' ? asked : quiet
  const sinLen = Math.abs(g.sin) * R
  const cosLen = Math.abs(g.cos) * R
  const done = marked === 'right' || marked === 'shown'
  const theta = rad(angle)
  const arc = angle === 0 ? '' : `M ${f1(CX + 14)} ${CY} A 14 14 0 ${angle > 180 ? 1 : 0} 0 ${f1(CX + 14 * Math.cos(theta))} ${f1(CY - 14 * Math.sin(theta))}`
  const sinAt = { x: g.p.x + (g.p.x >= CX ? 8 : -8), y: (CY + g.p.y) / 2 + 4, anchor: g.p.x >= CX ? ('start' as const) : ('end' as const) }
  const cosAt = { x: (CX + g.p.x) / 2, y: g.p.y > CY ? CY - 7 : CY + 16 }
  const dot = { x: curveX(angle), y: curveY(fn, angle) }
  return (
    <g>
      <rect x={0.75} y={0.75} width={W - 1.5} height={H - 1.5} rx={16} fill={PLATE} stroke={PLATE_EDGE} strokeWidth={1.5} />
      {/* the graph: angle along the bottom, the value up the side, on the same scale as the circle */}
      <g stroke={FAINT} strokeWidth={1.4}>
        <line x1={GX} x2={GX + GW} y1={CY - R} y2={CY - R} strokeDasharray="3 4" />
        <line x1={GX} x2={GX + GW} y1={CY + R} y2={CY + R} strokeDasharray="3 4" />
      </g>
      <g stroke={SOFT} strokeWidth={1.4}>
        <line x1={GX} x2={GX + GW + 4} y1={CY} y2={CY} />
        <line x1={GX} x2={GX} y1={CY - R - 6} y2={CY + R + 6} />
        {[90, 180, 270, 360].map((a) => <line key={a} x1={curveX(a)} x2={curveX(a)} y1={CY - 3} y2={CY + 3} />)}
      </g>
      <path d={curvePath(fn, 360)} fill="none" stroke={FAINT} strokeWidth={2.4} strokeLinejoin="round" data-curve-all />
      <path d={curvePath(fn, angle)} fill="none" stroke={asked} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" data-curve />
      <text x={GX + GW / 2} y={22} textAnchor="middle" fontSize={12} fontWeight={700} fill={SOFT} fontFamily={FONT}>{fn} against angle</text>
      <text x={curveX(180)} y={CY + 20} textAnchor="middle" fontSize={12} fontWeight={700} fill={SOFT} fontFamily={FONT}>180°</text>
      <text x={GX + GW + 2} y={CY + 20} textAnchor="end" fontSize={12} fontWeight={700} fill={SOFT} fontFamily={FONT}>360°</text>
      {/* the unit circle, with its axes */}
      <circle cx={CX} cy={CY} r={R} fill="#FFFFFF" stroke="#94A3B8" strokeWidth={1.6} />
      <g stroke={SOFT} strokeWidth={1.2}>
        <line x1={CX - R - 10} x2={CX + R + 10} y1={CY} y2={CY} />
        <line x1={CX} x2={CX} y1={CY - R - 10} y2={CY + R + 10} />
      </g>
      <g fontSize={12} fontWeight={700} fill={SOFT} fontFamily={FONT}>
        <text x={CX + 13} y={33}>1</text>
        <text x={CX + 13} y={CY + R + 17}>−1</text>
      </g>
      <circle cx={CX} cy={CY} r={2.6} fill={INK} />
      {/* the triangle the point makes: its height is one leg, its distance across the other */}
      {cosLen > 0.5 && <line x1={CX} y1={CY} x2={f1(g.p.x)} y2={CY} stroke={cosCol} strokeWidth={4} strokeLinecap="round" data-leg="cosine" />}
      {sinLen > 0.5 && <line x1={f1(g.p.x)} y1={CY} x2={f1(g.p.x)} y2={f1(g.p.y)} stroke={sinCol} strokeWidth={4} strokeLinecap="round" data-leg="sine" />}
      <line x1={CX} y1={CY} x2={f1(g.p.x)} y2={f1(g.p.y)} stroke={INK} strokeWidth={1.8} />
      {arc && <path d={arc} fill="none" stroke={INK} strokeWidth={2} strokeLinecap="round" data-arc />}
      {fn === 'sine' && <line x1={f1(g.p.x + 10)} y1={f1(g.p.y)} x2={f1(dot.x - 6)} y2={f1(g.p.y)} stroke={asked} strokeWidth={1.5} strokeDasharray="3 4" data-link />}
      {sinLen >= 17 && <text x={f1(sinAt.x)} y={f1(sinAt.y)} textAnchor={sinAt.anchor} fontSize={12} fontWeight={700} fill={sinCol} fontFamily={FONT} stroke="#FFFFFF" strokeWidth={3} paintOrder="stroke" data-name="sine">sine</text>}
      {cosLen >= 42 && <text x={f1(cosAt.x)} y={cosAt.y} textAnchor="middle" fontSize={12} fontWeight={700} fill={cosCol} fontFamily={FONT} stroke="#FFFFFF" strokeWidth={3} paintOrder="stroke" data-name="cosine">cosine</text>}
      <circle cx={f1(dot.x)} cy={f1(dot.y)} r={4.6} fill={asked} stroke="#FFFFFF" strokeWidth={1.6} data-dot />
      {/* the handle: the point on the circle */}
      <circle cx={f1(g.p.x)} cy={f1(g.p.y)} r={9} fill="#FFFFFF" stroke={done ? SOFT : asked} strokeWidth={3} data-handle />
    </g>
  )
}

// ---------------------------------------------------------------------------
// The controls: atom's stepper row, with the arrows pointing the way the thing moves.

function Row({ label, value, less, more, onLess, onMore, disabled }: { label: string; value: string; less: string; more: string; onLess(): void; onMore(): void; disabled: boolean }) {
  const button = 'nodrag flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-lg border-2 border-ss-line bg-ss-panel text-[16px] font-extrabold leading-none text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'
  return (
    <div className="flex items-center justify-between gap-1.5">
      <span className="text-[12px] font-bold text-ss-slate">{label}</span>
      <span className="flex items-center gap-1">
        <button type="button" aria-label={less} className={button} disabled={disabled} onClick={onLess}>‹</button>
        <span className="min-w-[64px] text-center text-[15px] font-extrabold tabular-nums text-ss-ink" aria-live="off">{value}</span>
        <button type="button" aria-label={more} className={button} disabled={disabled} onClick={onMore}>›</button>
      </span>
    </div>
  )
}

const onArrows = (e: KeyboardEvent) => { if (e.key.startsWith('Arrow')) e.stopPropagation() }

// Nothing here moves by itself, so reduced motion has nothing to take away: the picture is the same still frame.
export function TrigCircleView({ config, state, setState, marked, locked }: Props) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const svgRef = useRef<SVGSVGElement>(null)
  const dragging = useRef(false)
  const now = marked === 'shown' ? trigCircleEngine.solve(config) : state
  const finished = marked === 'right' || marked === 'shown'
  const frozen = locked || finished
  const said = finished ? working(config, now) : marked === 'wrong' ? madeText(config, now) : ''
  const lead = said.match(/^((?:Yes\.|Near enough:) [\s\S]*?\.)\s+(?=[A-Z])([\s\S]*)$/)

  const at = (e: PointerEvent) => {
    const box = svgRef.current?.getBoundingClientRect()
    if (!box || box.width === 0) return null
    return { x: ((e.clientX - box.left) / box.width) * W, y: ((e.clientY - box.top) / box.height) * H }
  }

  if (config.task === 'ladder') {
    const d10 = footOf(config, now)
    const g = ladderGeometry(config, d10)
    const max = footMax(config.length)
    const set = (v: number) => { if (!frozen) setState({ foot: Math.max(1, Math.min(max, Math.round(v))) }) }
    const move = (e: PointerEvent) => { const p = at(e); if (p) set(snapFoot(config, Math.max(1, Math.min(max, Math.round(((WALL_X - p.x) / g.scale) * 10))))) }
    // The buttons walk the foot to the next half metre, so a tap is a step you can see.
    const stepBy = (dir: 1 | -1) => set(dir === 1 ? (Math.floor(d10 / 5 + 1e-9) + 1) * 5 : (Math.ceil(d10 / 5 - 1e-9) - 1) * 5)
    const onKey = (e: KeyboardEvent) => {
      const by = e.shiftKey || e.key === 'PageUp' || e.key === 'PageDown' ? 5 : 1
      let dir = 0
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown' || e.key === 'PageDown') dir = 1
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'PageUp') dir = -1
      if (!dir) return
      e.preventDefault()
      e.stopPropagation()
      set(d10 + dir * by)
    }
    const other = config.ask === 'out' ? `${fmtM(Math.round(g.height * 10) / 10)} m` : `${fmtM(d10 / 10)} m`
    const otherName = config.ask === 'out' ? 'Top up the wall' : 'Foot from the wall'
    const sr = `The ladder, ${fmtM(config.length)} metres long, leans with its foot ${fmtM(d10 / 10)} metres from the wall and its top ${fmtM(Math.round(g.height * 10) / 10)} metres up it.`
    const picture = `A ${fmtM(config.length)} metre ladder leans against a wall, its foot on the ground. ${config.ask === 'out' ? `A line is painted on the paving ${fmtM(config.value)} metres from the wall.` : `A window sill is marked ${fmtM(config.value)} metres up the wall.`} An arc at the foot shows the angle between the ladder and the ground.`
    return (
      <div className="nodrag flex w-full max-w-[380px] flex-col gap-2 [&:has(:focus-visible)_.tc-kbd]:block" onKeyDown={onArrows}>
        <figure className="m-0 flex w-full flex-col gap-1.5">
          <div className="relative w-full">
            <svg
              ref={svgRef} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={picture} className="block h-auto w-full touch-none select-none"
              style={{ cursor: frozen ? 'default' : 'ew-resize' }}
              onPointerDown={(e) => { if (frozen) return; e.currentTarget.setPointerCapture(e.pointerId); dragging.current = true; move(e) }}
              onPointerMove={(e) => { if (dragging.current) move(e) }}
              onPointerUp={() => { dragging.current = false }} onPointerCancel={() => { dragging.current = false }}
            >
              <LadderPicture config={config} g={g} marked={marked} uid={uid} met={ladderOk(config, d10)} />
            </svg>
            <div
              role="slider" tabIndex={frozen ? -1 : 0} aria-label="Foot of the ladder" aria-orientation="horizontal" aria-valuemin={1} aria-valuemax={max} aria-valuenow={d10}
              aria-valuetext={config.ask === 'out' ? `top ${fmtM(Math.round(g.height * 10) / 10)} metres up the wall` : `foot ${fmtM(d10 / 10)} metres from the wall`} aria-disabled={frozen || undefined}
              onKeyDown={onKey}
              className="pointer-events-none absolute rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--subject)]"
              style={{ left: `${(g.foot.x / W) * 100}%`, top: `${((GROUND_Y + 3) / H) * 100}%`, width: 36, height: 36, transform: 'translate(-50%, -50%)' }}
            />
          </div>
          <figcaption className="text-center text-[12px] font-bold text-ss-slate">Drag the foot along the ground. The arc is the angle the ladder makes with it.</figcaption>
        </figure>
        <Row
          label={otherName} value={other} disabled={frozen}
          less="Slide the foot away from the wall" more="Slide the foot toward the wall"
          onLess={() => stepBy(1)} onMore={() => stepBy(-1)}
        />
        <p className="tc-kbd hidden text-[12px] font-semibold text-ss-slate">Arrow keys slide the foot a tenth of a metre. Hold Shift for half a metre.</p>
        <span className="sr-only" aria-live="polite">{sr}</span>
        {marked !== 'idle' && <Verdict lead={lead} said={said} />}
      </div>
    )
  }

  const fn = config.fn === 'cosine' ? 'cosine' : 'sine'
  const angle = angleOf(now)
  const g = pointGeometry(angle)
  const set = (v: number) => { if (!frozen) setState({ angle: ((Math.round(v / STEP_DEG) * STEP_DEG) % 360 + 360) % 360 }) }
  const move = (e: PointerEvent) => {
    const p = at(e)
    if (p) set(deg(Math.atan2(CY - p.y, p.x - CX)))
  }
  const onKey = (e: KeyboardEvent) => {
    let dir = 0
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') dir = 1
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') dir = -1
    if (!dir) return
    e.preventDefault()
    e.stopPropagation()
    set(angle + dir * STEP_DEG)
  }
  const sinText = showNumber(g.sin)
  const cosText = showNumber(g.cos)
  const picture = `The unit circle with a point on it, joined to the centre. The point's height above the horizontal axis is drawn as one leg of a right triangle and its distance across as the other. To the right, a graph of ${fn} against angle is drawn as the point goes round.`
  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-2 [&:has(:focus-visible)_.tc-kbd]:block" onKeyDown={onArrows}>
      <figure className="m-0 flex w-full flex-col gap-1.5">
        <div className="relative w-full">
          <svg
            ref={svgRef} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={picture} className="block h-auto w-full touch-none select-none"
            style={{ cursor: frozen ? 'default' : 'grab' }}
            onPointerDown={(e) => { if (frozen) return; e.currentTarget.setPointerCapture(e.pointerId); dragging.current = true; move(e) }}
            onPointerMove={(e) => { if (dragging.current) move(e) }}
            onPointerUp={() => { dragging.current = false }} onPointerCancel={() => { dragging.current = false }}
          >
            <CirclePicture config={config} angle={angle} marked={marked} />
          </svg>
          <div
            role="slider" tabIndex={frozen ? -1 : 0} aria-label="Point on the unit circle" aria-valuemin={0} aria-valuemax={345} aria-valuenow={angle}
            aria-valuetext={`${angle} degrees; sine ${sinText}, cosine ${cosText}`} aria-disabled={frozen || undefined} onKeyDown={onKey}
            className="pointer-events-none absolute rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--subject)]"
            style={{ left: `${(g.p.x / W) * 100}%`, top: `${(g.p.y / H) * 100}%`, width: 32, height: 32, transform: 'translate(-50%, -50%)' }}
          />
        </div>
        <figcaption className="text-center text-[12px] font-bold text-ss-slate">Drag the point round the circle. The curve is drawn from its {fn === 'sine' ? 'height' : 'distance across'}.</figcaption>
      </figure>
      <div className="flex flex-col gap-1.5">
        <Row
          label="Angle" value={`${angle}°`} disabled={frozen}
          less="Turn the point back 15 degrees" more="Turn the point on 15 degrees"
          onLess={() => set(angle - STEP_DEG)} onMore={() => set(angle + STEP_DEG)}
        />
        <div className="grid grid-cols-2 gap-x-6 border-t border-ss-line pt-1.5">
          <p className="flex items-baseline justify-between">
            <span className="text-[12px] font-bold text-ss-slate">Sine</span>
            <span className="text-[15px] font-extrabold tabular-nums text-ss-ink" data-sine>{sinText}</span>
          </p>
          <p className="flex items-baseline justify-between">
            <span className="text-[12px] font-bold text-ss-slate">Cosine</span>
            <span className="text-[15px] font-extrabold tabular-nums text-ss-ink" data-cosine>{cosText}</span>
          </p>
        </div>
      </div>
      <p className="tc-kbd hidden text-[12px] font-semibold text-ss-slate">Arrow keys turn the point 15 degrees.</p>
      <span className="sr-only" aria-live="polite">{`The point is at ${angle} degrees: sine ${sinText}, cosine ${cosText}.`}</span>
      {marked !== 'idle' && <Verdict lead={lead} said={said} />}
    </div>
  )
}

function Verdict({ lead, said }: { lead: RegExpMatchArray | null; said: string }) {
  return (
    <div className="rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2" aria-live="polite">
      <p className="text-[13px] font-extrabold leading-snug text-ss-ink">{lead ? lead[1] : said}</p>
      {lead && lead[2] && <p className="mt-0.5 text-[12px] font-semibold leading-snug text-ss-slate">{lead[2]}</p>}
    </div>
  )
}

