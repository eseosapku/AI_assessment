'use client'
import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { SceneViewProps } from '../types'
import type { BearingsConfig, BearingsState } from './config'
import { angleOf, BEARING_TOLERANCE, bearingText, madeText, norm360, targetOf, working } from './config'

// Drawing paper in both themes, with an enamel compass and a blue course-setting arm.
const PAPER = '#F8FAFC'
const EDGE = '#CBD5E1'
const INK = '#243447'
const SOFT = '#526276'
const FAINT = '#D9E2EC'
const RING = '#E6EBEF'
const METAL = '#AAB7C4'
const BLUE = '#2F6FA8'
const BLUE_DARK = '#20547F'
const BLUE_PALE = '#DCEAF5'
const RED = '#B94B45'
const LAND = '#E7E3D5'
const LAND_EDGE = '#AAA58E'
const FONT = 'system-ui, sans-serif'

/** The plate and compass. Kept literal here because config and View load each other. */
export const W = 360
export const H = 250
export const CX = 180
export const CY = 132
export const R = 88
export const HANDLE_R = 78
export const DRAW_TOLERANCE = 2

export type Pt = { x: number; y: number }
export const pointAt = (c: Pt, bearing: number, r: number): Pt => {
  const a = (norm360(bearing) * Math.PI) / 180
  return { x: c.x + r * Math.sin(a), y: c.y - r * Math.cos(a) }
}

/** SVG's positive-angle arc goes clockwise on screen. North is the zero-radius ray. */
export function sectorPath(c: Pt, r: number, bearing: number): string {
  const a = norm360(bearing)
  if (a === 0) return `M ${c.x} ${c.y} L ${c.x} ${c.y - r} Z`
  const end = pointAt(c, a, r)
  return `M ${c.x} ${c.y} L ${c.x} ${c.y - r} A ${r} ${r} 0 ${a > 180 ? 1 : 0} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)} Z`
}

export function arcPath(c: Pt, r: number, bearing: number): string {
  const a = norm360(bearing)
  if (a === 0) return ''
  const end = pointAt(c, a, r)
  return `M ${c.x} ${c.y - r} A ${r} ${r} 0 ${a > 180 ? 1 : 0} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`
}

/** A and B sit symmetrically about the middle, so every direction keeps its label and north line on the paper. */
export function routePoints(outward: number): { a: Pt; b: Pt } {
  const out = pointAt({ x: 0, y: 0 }, outward, 48)
  return { a: { x: 180 - out.x, y: 116 - out.y }, b: { x: 180 + out.x, y: 116 + out.y } }
}

const f = (n: number) => Number(n.toFixed(2))

function NorthLine({ at, length = 34 }: { at: Pt; length?: number }) {
  return (
    <g aria-hidden="true">
      <line x1={at.x} y1={at.y - 2} x2={at.x} y2={at.y - length} stroke={RED} strokeWidth={1.7} />
      <path d={`M ${at.x - 4} ${at.y - length + 6} L ${at.x} ${at.y - length} L ${at.x + 4} ${at.y - length + 6} Z`} fill={RED} />
      <text x={at.x} y={at.y - length - 6} textAnchor="middle" fill={RED} fontSize={12} fontWeight={800} fontFamily={FONT}>N</text>
    </g>
  )
}

function Compass({ at, course, live, dragging, focused, onDown, onKey, onFocus, onBlur }: {
  at: Pt
  course: number
  live: boolean
  dragging: boolean
  focused: boolean
  onDown(e: PointerEvent<SVGGElement>): void
  onKey(e: KeyboardEvent<SVGGElement>): void
  onFocus(): void
  onBlur(): void
}) {
  const grip = pointAt(at, course, HANDLE_R)
  const tip = pointAt(at, course, 70)
  const tail = pointAt(at, course + 180, 15)
  return (
    <g>
      <circle cx={at.x} cy={at.y} r={R + 4} fill={METAL} stroke={INK} strokeWidth={1.3} />
      <circle cx={at.x} cy={at.y} r={R} fill="#FFFFFF" stroke={INK} strokeWidth={1.3} />
      <circle cx={at.x} cy={at.y} r={R - 12} fill="none" stroke={RING} strokeWidth={1} />
      {Array.from({ length: 72 }, (_, d) => d * 5).map((d) => {
        const outer = pointAt(at, d, R - 2)
        const inner = pointAt(at, d, R - (d % 90 === 0 ? 12 : d % 30 === 0 ? 9 : d % 10 === 0 ? 6 : 4))
        return <line key={d} x1={f(outer.x)} y1={f(outer.y)} x2={f(inner.x)} y2={f(inner.y)} stroke={d % 30 === 0 ? INK : SOFT} strokeWidth={d % 30 === 0 ? 1.5 : 0.8} />
      })}
      <path d={sectorPath(at, 43, course)} fill={BLUE_PALE} stroke="none" data-sector={course} />
      {course !== 0 && <path d={arcPath(at, 43, course)} fill="none" stroke={BLUE} strokeWidth={1.6} />}
      <NorthLine at={at} length={55} />
      <text x={at.x + R - 4} y={at.y + 4} textAnchor="middle" fill={SOFT} fontSize={12} fontWeight={700} fontFamily={FONT}>E</text>
      <text x={at.x} y={at.y + R - 5} textAnchor="middle" fill={SOFT} fontSize={12} fontWeight={700} fontFamily={FONT}>S</text>
      <text x={at.x - R + 4} y={at.y + 4} textAnchor="middle" fill={SOFT} fontSize={12} fontWeight={700} fontFamily={FONT}>W</text>
      <line x1={f(tail.x)} y1={f(tail.y)} x2={f(tip.x)} y2={f(tip.y)} stroke={BLUE_DARK} strokeWidth={4} strokeLinecap="round" />
      <path d={`M ${f(tip.x)} ${f(tip.y)} L ${f(pointAt(at, course, 57).x + 5 * Math.cos((course * Math.PI) / 180))} ${f(pointAt(at, course, 57).y + 5 * Math.sin((course * Math.PI) / 180))} L ${f(pointAt(at, course, 57).x - 5 * Math.cos((course * Math.PI) / 180))} ${f(pointAt(at, course, 57).y - 5 * Math.sin((course * Math.PI) / 180))} Z`} fill={BLUE_DARK} />
      <circle cx={at.x} cy={at.y} r={7} fill="#FFFFFF" stroke={INK} strokeWidth={1.5} />
      <circle cx={at.x} cy={at.y} r={2.5} fill={INK} />
      {live && (
        <g
          data-handle="course"
          role="slider"
          tabIndex={0}
          aria-label="Course direction. Drag the blue handle, or use the arrow keys"
          aria-valuemin={0}
          aria-valuemax={359}
          aria-valuenow={course}
          aria-valuetext={`${bearingText(course)} clockwise from north`}
          onPointerDown={onDown}
          onKeyDown={onKey}
          onFocus={onFocus}
          onBlur={onBlur}
          className="nodrag cursor-grab touch-none outline-none active:cursor-grabbing"
        >
          <circle cx={f(grip.x)} cy={f(grip.y)} r={24} fill="transparent" />
          {focused && <circle cx={f(grip.x)} cy={f(grip.y)} r={15} fill="none" stroke="var(--subject)" strokeWidth={3} />}
          <circle cx={f(grip.x)} cy={f(grip.y)} r={10.5} fill={dragging ? BLUE_DARK : BLUE} stroke="#FFFFFF" strokeWidth={2} />
          <path d={`M ${f(grip.x - 4)} ${f(grip.y - 2)} L ${f(grip.x)} ${f(grip.y - 6)} L ${f(grip.x + 4)} ${f(grip.y - 2)} M ${f(grip.x - 4)} ${f(grip.y + 2)} L ${f(grip.x)} ${f(grip.y + 6)} L ${f(grip.x + 4)} ${f(grip.y + 2)}`} fill="none" stroke="#FFFFFF" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )}
    </g>
  )
}

function BackPicture({ config, course, live, handleProps }: {
  config: Extract<BearingsConfig, { task: 'back' }>
  course: number
  live: boolean
  handleProps: Pick<Parameters<typeof Compass>[0], 'dragging' | 'focused' | 'onDown' | 'onKey' | 'onFocus' | 'onBlur'>
}) {
  const out = norm360(config.outward)
  const delta = norm360(out - 180)
  const { a, b } = routePoints(out)
  const returnTip = pointAt(b, course, 49)
  const returnTail = pointAt(b, course + 180, 9)
  // The grip is beside the arrow, never on top of B's north line or its N label.
  const rad = (course * Math.PI) / 180
  const grip = { x: returnTip.x + 11 * Math.cos(rad), y: returnTip.y + 11 * Math.sin(rad) }
  const landAt = (p: Pt) => ({ x: Math.max(30, Math.min(140, p.x)), y: 187 + Math.min(13, Math.max(0, p.y - 160) * 0.3) })
  const la = landAt(a)
  const lb = landAt(b)
  return (
    <>
      <path d={`M 14 215 Q ${f(la.x)} ${f(la.y - 30)} ${f(la.x + 25)} ${f(la.y - 4)} T ${f(lb.x)} ${f(lb.y - 6)} Q 160 192 170 215 Z`} fill={LAND} stroke={LAND_EDGE} strokeWidth={1.2} />
      <path d="M 25 209 Q 63 189 102 204 T 155 205" fill="none" stroke={LAND_EDGE} strokeWidth={1} />
      <line x1={a.x} y1={a.y} x2={f(b.x)} y2={f(b.y)} stroke={INK} strokeWidth={2.6} />
      <path d={arcPath(b, 25, course)} fill="none" stroke={BLUE} strokeWidth={2} strokeLinecap="round" data-sector={course} />
      <NorthLine at={a} length={27} />
      <NorthLine at={b} length={27} />
      <circle cx={a.x} cy={a.y} r={8} fill="#FFFFFF" stroke={INK} strokeWidth={1.4} />
      <circle cx={a.x} cy={a.y} r={2.5} fill={INK} />
      <circle cx={f(b.x)} cy={f(b.y)} r={7} fill="#FFFFFF" stroke={INK} strokeWidth={1.4} />
      <circle cx={f(b.x)} cy={f(b.y)} r={2.5} fill={RED} />
      <text x={f(a.x - 14)} y={f(a.y + 5)} textAnchor="middle" fill={INK} fontSize={13} fontWeight={800} fontFamily={FONT}>A</text>
      <text x={f(b.x + 14)} y={f(b.y + 5)} textAnchor="middle" fill={INK} fontSize={13} fontWeight={800} fontFamily={FONT}>B</text>
      <line x1={f(returnTail.x)} y1={f(returnTail.y)} x2={f(returnTip.x)} y2={f(returnTip.y)} stroke={BLUE_DARK} strokeWidth={3.5} strokeLinecap="round" />
      <path d={`M ${f(returnTip.x)} ${f(returnTip.y)} L ${f(pointAt(b, course, 38).x + 4.5 * Math.cos(rad))} ${f(pointAt(b, course, 38).y + 4.5 * Math.sin(rad))} L ${f(pointAt(b, course, 38).x - 4.5 * Math.cos(rad))} ${f(pointAt(b, course, 38).y - 4.5 * Math.sin(rad))} Z`} fill={BLUE_DARK} />
      <text x={180} y={232} textAnchor="middle" fill={SOFT} fontSize={12} fontWeight={700} fontFamily={FONT}>outward A → B: {bearingText(out)}</text>
      {live && (
        <g {...handleProps} onPointerDown={handleProps.onDown} data-handle="course" role="slider" tabIndex={0} aria-label="Return course from B. Drag the blue handle, or use the arrow keys" aria-valuemin={0} aria-valuemax={359} aria-valuenow={course} aria-valuetext={`${bearingText(course)} clockwise from north`} className="nodrag cursor-grab touch-none outline-none active:cursor-grabbing">
          <circle cx={f(grip.x)} cy={f(grip.y)} r={24} fill="transparent" />
          {handleProps.focused && <circle cx={f(grip.x)} cy={f(grip.y)} r={14} fill="none" stroke="var(--subject)" strokeWidth={3} />}
          <circle cx={f(grip.x)} cy={f(grip.y)} r={9} fill={handleProps.dragging ? BLUE_DARK : BLUE} stroke="#FFFFFF" strokeWidth={2} />
          <path d={`M ${f(grip.x - 3.5)} ${f(grip.y - 2)} L ${f(grip.x)} ${f(grip.y - 5.5)} L ${f(grip.x + 3.5)} ${f(grip.y - 2)} M ${f(grip.x - 3.5)} ${f(grip.y + 2)} L ${f(grip.x)} ${f(grip.y + 5.5)} L ${f(grip.x + 3.5)} ${f(grip.y + 2)}`} fill="none" stroke="#FFFFFF" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )}
    </>
  )
}

const STEP = 'nodrag flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-lg border-2 border-ss-line bg-ss-panel text-[16px] font-extrabold leading-none text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'

export function BearingsView({ config, state, setState, marked, locked }: SceneViewProps<BearingsConfig, BearingsState>) {
  const svg = useRef<SVGSVGElement>(null)
  const [dragging, setDragging] = useState(false)
  const [focused, setFocused] = useState(false)
  const shown = marked === 'shown'
  const course = shown ? targetOf(config) : angleOf(state)
  const live = !locked && !shown
  const centre: Pt = config.task === 'back' ? routePoints(config.outward).b : { x: CX, y: CY }
  const dragId = useRef<number | null>(null)

  const commit = (next: number) => {
    if (!live) return
    const a = norm360(next)
    if (a !== angleOf(state)) setState({ angle: a })
  }
  const fromPointer = (e: { clientX: number; clientY: number }) => {
    const el = svg.current
    if (!el) return
    const box = el.getBoundingClientRect()
    const x = ((e.clientX - box.left) / box.width) * W - centre.x
    const y = ((e.clientY - box.top) / box.height) * H - centre.y
    commit((Math.atan2(x, -y) * 180) / Math.PI)
  }
  const onKey = (e: KeyboardEvent<SVGGElement>) => {
    const by = ({ ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 10, PageDown: -10 } as Record<string, number>)[e.key]
    if (by === undefined && e.key !== 'Home' && e.key !== 'End') return
    e.preventDefault()
    e.stopPropagation()
    if (!live) return
    commit(e.key === 'Home' ? 0 : e.key === 'End' ? 359 : course + by)
  }
  const handleProps = {
    dragging, focused,
    onDown: (e: PointerEvent<SVGGElement>) => {
      if (!live || e.button !== 0) return
      dragId.current = e.pointerId
      e.currentTarget.setPointerCapture?.(e.pointerId)
      setDragging(true)
      fromPointer(e)
    },
    onKey,
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
  }
  const onMove = (e: PointerEvent<SVGSVGElement>) => { if (dragId.current === e.pointerId) fromPointer(e) }
  const endDrag = (e: PointerEvent<SVGSVGElement>) => {
    if (dragId.current !== e.pointerId) return
    dragId.current = null
    setDragging(false)
  }

  const description = config.task === 'set'
    ? `A compass at A with a north line. The blue course is ${bearingText(course)} clockwise from north; its shaded sector shows that angle. Turn the blue handle.`
    : `A route from A to B on outward bearing ${bearingText(config.outward)}, with a north line at each point. At B the blue return course is ${bearingText(course)}. Turn its handle to point back to A.`

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-2">
      <figure className="m-0 flex w-full flex-col gap-1.5">
        <div className="relative w-full" style={{ maxWidth: W }}>
          <svg ref={svg} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={description} className="block h-auto w-full select-none" onPointerMove={onMove} onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={endDrag}>
            <rect x={0.75} y={0.75} width={W - 1.5} height={H - 1.5} rx={16} fill={PAPER} stroke={EDGE} strokeWidth={1.5} />
            {config.task === 'set' ? (
              <>
                <Compass at={{ x: CX, y: CY }} course={course} live={live} {...handleProps} />
                <text x={CX} y={CY + 28} textAnchor="middle" fill={INK} fontSize={13} fontWeight={800} fontFamily={FONT}>A</text>
                <g transform={`translate(${f(pointAt({ x: CX, y: CY }, targetOf(config), 98).x)} ${f(pointAt({ x: CX, y: CY }, targetOf(config), 98).y + 13)})`} aria-hidden="true">
                  <line x1={0} y1={-16} x2={0} y2={0} stroke={INK} strokeWidth={1.5} />
                  <path d="M 0 -16 L 10 -12 L 0 -8 Z" fill={RED} stroke={INK} strokeWidth={0.8} />
                  <circle cx={0} cy={1} r={3} fill="#FFFFFF" stroke={INK} strokeWidth={1.3} />
                  <rect x={5} y={1} width={16} height={17} rx={3} fill="#FFFFFF" stroke={EDGE} strokeWidth={1} />
                  <text x={13} y={14} textAnchor="middle" fill={INK} fontSize={13} fontWeight={800} fontFamily={FONT}>B</text>
                </g>
              </>
            ) : <BackPicture config={config} course={course} live={live} handleProps={handleProps} />}
          </svg>
        </div>
        <figcaption className="text-center text-[12px] font-bold text-ss-slate">
          {config.task === 'set' ? 'Set the course A → B' : 'Turn the return course at B back to A'}
        </figcaption>
      </figure>

      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-bold text-ss-slate">{config.task === 'set' ? 'Course from A' : 'Return course from B'}</span>
        <span className="flex items-center gap-1">
          <button type="button" aria-label="Turn course 1 degree anticlockwise" disabled={!live} onClick={() => commit(course - 1)} className={STEP}>−</button>
          <span className="min-w-[68px] text-center text-[15px] font-extrabold tabular-nums text-ss-ink" data-course={course}>{bearingText(course)}</span>
          <button type="button" aria-label="Turn course 1 degree clockwise" disabled={!live} onClick={() => commit(course + 1)} className={STEP}>+</button>
        </span>
      </div>
      <p className="m-0 flex items-baseline justify-between border-t border-ss-line pt-1.5">
        <span className="text-[12px] font-bold text-ss-slate">Clockwise from north</span>
        <span className="text-[12px] font-semibold text-ss-slate">three-figure bearing</span>
      </p>
      {marked !== 'idle' && (
        <div className="rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2" aria-live="polite">
          <p className="text-[13px] font-extrabold leading-snug text-ss-ink">{marked === 'wrong' ? madeText(config, state) : working(config, state)}</p>
        </div>
      )}
    </div>
  )
}
