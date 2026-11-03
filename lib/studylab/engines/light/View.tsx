'use client'
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode, type RefObject } from 'react'
import type { SceneMarked, SceneViewProps } from '../types'
import type { LightConfig, LightState } from './config'
import {
  AIM, MIRROR_AIM, APERTURE, LAMP_AT, SHARP, TURN_MAX, TURN_MIN, U_MAX, U_MIN, apart, blur, glassEye, indexOf, landing, lightEngine, madeLamp, madeText, madeTurn, madeU,
  mirrorEye, mirrorIn, mirrorOut, screenAt, trace, working, wrap,
} from './config'

type Props = SceneViewProps<LightConfig, LightState>
type MirrorConfig = Extract<LightConfig, { task: 'mirror' }>
type LensConfig = Extract<LightConfig, { task: 'lens' }>
type GlassConfig = Exclude<LightConfig, MirrorConfig | LensConfig>

// One scene look in both themes: a room with the lights off, so light can look like light. Flat colours only.
const ROOM = '#0F1722'
const LIGHT = '#FFD23F'
const PULSE = '#FFF4C7'
const WHITE = '#F2F5F8'
const DIM = '#93A3B5'
const TRACK = '#5B6B7E'
const GLASS = '#1C4A66'
const EDGE = '#7FCBEF'
const SLICE = '#7A6410'
const SCREEN = '#2B3644'
const HALO = { stroke: ROOM, strokeWidth: 4, paintOrder: 'stroke', strokeLinejoin: 'round' } as const
const HALO_GLASS = { ...HALO, stroke: GLASS }

export const W = 360
export const H = 292
const RAY = 5

export type Pt = { x: number; y: number }
export type Label = { text: string; x: number; y: number; anchor: 'start' | 'middle' | 'end'; part: Pt; onGlass?: boolean }

const rad = (d: number) => (d * Math.PI) / 180
const f1 = (n: number) => n.toFixed(1)
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
export const at = (c: Pt, bearing: number, dist: number): Pt => ({ x: c.x + dist * Math.sin(rad(bearing)), y: c.y - dist * Math.cos(rad(bearing)) })
const bearingOf = (c: Pt, p: Pt) => (Math.atan2(p.x - c.x, c.y - p.y) * 180) / Math.PI
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y)

/** How far from `c` along `bearing` before the edge of the stage. */
function toEdge(c: Pt, bearing: number): number {
  const dx = Math.sin(rad(bearing))
  const dy = -Math.cos(rad(bearing))
  const tx = dx > 0 ? (W - c.x) / dx : dx < 0 ? -c.x / dx : Infinity
  const ty = dy > 0 ? (H - c.y) / dy : dy < 0 ? -c.y / dy : Infinity
  return Math.min(tx, ty)
}

function slice(c: Pt, r: number, from: number, to: number): string {
  const a = at(c, from, r)
  const b = at(c, to, r)
  const d = wrap(to - from)
  return `M ${f1(c.x)} ${f1(c.y)} L ${f1(a.x)} ${f1(a.y)} A ${r} ${r} 0 0 ${d > 0 ? 1 : 0} ${f1(b.x)} ${f1(b.y)} Z`
}

/** A slice's label: inside the slice when it is wide enough, or just past the ray when it is not. */
function sliceLabel(c: Pt, normal: number, ray: number, r: number): Pt {
  const d = wrap(ray - normal)
  const w = Math.abs(d)
  const side = d < 0 ? -1 : 1
  return at(c, normal + side * (w >= 28 ? w / 2 : w + 15), r)
}

// ---------------------------------------------------------------------------
// Light moves along the ray, at walking pace, and slower inside glass.

const PULSE_GAP = 62
const PULSE_LONG = 9
const PULSE_SPEED = 52

function useFlow(svg: RefObject<SVGSVGElement>, reduced: boolean) {
  useEffect(() => {
    if (reduced) return
    let raf = 0
    const t0 = performance.now()
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick)
      const walked = (PULSE_SPEED * (t - t0)) / 1000
      svg.current?.querySelectorAll('[data-flow]').forEach((el) => {
        const n = Number(el.getAttribute('data-n')) || 1
        const opt = Number(el.getAttribute('data-opt')) || 0
        el.setAttribute('stroke-dashoffset', f1((opt - walked) / n))
      })
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [svg, reduced])
}

/** What is drawn eases toward what is set, so a key press is seen happening and a drag has some weight. */
function useEased(target: number, reduced: boolean, round = false): number {
  const [shown, setShown] = useState(target)
  const now = useRef(target)
  useEffect(() => {
    if (reduced) {
      now.current = target
      setShown(target)
      return
    }
    let raf = 0
    let last = 0
    const tick = (t: number) => {
      const dt = last ? Math.min(0.05, (t - last) / 1000) : 0.016
      last = t
      const gap = round ? wrap(target - now.current) : target - now.current
      if (Math.abs(gap) < 0.04) {
        now.current = target
        setShown(target)
        return
      }
      now.current += gap * (1 - Math.exp(-dt / 0.11))
      if (round) now.current = wrap(now.current)
      setShown(now.current)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, reduced, round])
  return reduced ? target : shown
}

function usePointer(svg: RefObject<SVGSVGElement>, onMove: (p: Pt) => void) {
  const [dragging, setDragging] = useState(false)
  const toStage = (e: PointerEvent): Pt | null => {
    const m = svg.current?.getScreenCTM()
    if (!m) return null
    const q = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse())
    return { x: q.x, y: q.y }
  }
  return {
    dragging,
    toStage,
    begin: (e: PointerEvent) => {
      svg.current?.setPointerCapture?.(e.pointerId)
      setDragging(true)
    },
    stage: {
      onPointerMove: (e: PointerEvent) => {
        if (!dragging) return
        const p = toStage(e)
        if (p) onMove(p)
      },
      onPointerUp: () => setDragging(false),
      onPointerCancel: () => setDragging(false),
    },
  }
}

// ---------------------------------------------------------------------------
// The shared pieces of the drawing.

type Seg = { a: Pt; b: Pt; n: number; width: number; arrow?: boolean; along?: number }

function Rays({ segs, reduced }: { segs: Seg[]; reduced: boolean }) {
  let opt = 0
  const flow: ReactNode[] = []
  segs.forEach((s, k) => {
    const long = dist(s.a, s.b)
    const n = s.n
    if (!reduced && s.width >= 2.5 && long > 2) {
      flow.push(
        <line
          key={k} data-flow data-n={n} data-opt={f1(opt)}
          x1={f1(s.a.x)} y1={f1(s.a.y)} x2={f1(s.b.x)} y2={f1(s.b.y)}
          stroke={PULSE} strokeWidth={Math.max(1, s.width - 1.5)} strokeDasharray={`${f1(PULSE_LONG / n)} ${f1((PULSE_GAP - PULSE_LONG) / n)}`} strokeDashoffset={f1(opt / n)}
        />,
      )
    }
    opt += long * n
  })
  return (
    <g fill="none" strokeLinecap="round">
      {segs.map((s, k) => (
        <line key={k} x1={f1(s.a.x)} y1={f1(s.a.y)} x2={f1(s.b.x)} y2={f1(s.b.y)} stroke={LIGHT} strokeWidth={s.width} />
      ))}
      {flow}
      {segs.map((s, k) => {
        if (!s.arrow) return null
        const k2 = s.along ?? 0.5
        const m = { x: s.a.x + (s.b.x - s.a.x) * k2, y: s.a.y + (s.b.y - s.a.y) * k2 }
        const b = bearingOf(s.a, s.b)
        return <path key={k} d="M 0 -9 L 8 6 L -8 6 Z" fill={LIGHT} stroke="none" transform={`translate(${f1(m.x)} ${f1(m.y)}) rotate(${f1(b)}) scale(${s.width < RAY ? 0.8 : 1})`} />
      })}
    </g>
  )
}

/** The lamp, with its open end facing `facing` (a bearing): light leaves from the end marked in yellow. */
function Lamp({ p, facing }: { p: Pt; facing: number }) {
  return (
    <g transform={`translate(${f1(p.x)} ${f1(p.y)}) rotate(${f1(facing)})`}>
      <rect x={-11} y={-14} width={22} height={28} rx={4} fill={WHITE} />
      <rect x={-11} y={-20} width={22} height={7} fill={LIGHT} />
    </g>
  )
}

/** The eye does nothing until light reaches it: then it opens on a yellow iris. */
function Eye({ p, lit, reduced }: { p: Pt; lit: boolean; reduced: boolean }) {
  return (
    <g transform={`translate(${f1(p.x)} ${f1(p.y)})`}>
      <path d="M -24 0 Q 0 -22 24 0 Q 0 22 -24 0 Z" fill={ROOM} stroke={WHITE} strokeWidth={3} strokeLinejoin="round" />
      <circle r={10} fill="none" stroke={TRACK} strokeWidth={2} />
      <g style={{ transform: `scale(${lit ? 1 : 0})`, transition: reduced ? 'none' : 'transform 450ms ease-out' }}>
        <circle r={10.5} fill={LIGHT} />
        <circle r={4.5} fill={ROOM} />
      </g>
    </g>
  )
}

/** The one thing to handle, the same everywhere: a white knob whose arrows say which way it goes. */
function Knob({ p, rot }: { p: Pt; rot: number }) {
  return (
    <g transform={`translate(${f1(p.x)} ${f1(p.y)}) rotate(${f1(rot)})`}>
      <circle className="li-focus hidden" r={19.5} fill="none" stroke={WHITE} strokeWidth={2.5} />
      <circle r={14.5} fill={WHITE} />
      <path d="M -9.5 0 H 9.5 M -5.5 -4.5 L -10 0 L -5.5 4.5 M 5.5 -4.5 L 10 0 L 5.5 4.5" fill="none" stroke={ROOM} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  )
}

function Names({ labels }: { labels: Label[] }) {
  return (
    <g aria-hidden="true">
      {labels.map((l) => (
        <text key={l.text} x={f1(l.x)} y={f1(l.y)} textAnchor={l.anchor} fontSize={14} fontWeight={700} fill={WHITE} style={l.onGlass ? HALO_GLASS : HALO}>{l.text}</text>
      ))}
    </g>
  )
}

function Slices({ c, r, normal1, ray1, normal2, ray2 }: { c: Pt; r: number; normal1: number; ray1: number; normal2: number; ray2: number }) {
  return (
    <g>
      {[[normal1, ray1], [normal2, ray2]].map(([n, b], k) => (
        apart(n, b) >= 1 ? <path key={k} d={slice(c, r, n, b)} fill={SLICE} /> : null
      ))}
    </g>
  )
}

function Stage(props: { svg: RefObject<SVGSVGElement>; label: string; handlers: object; children: ReactNode }) {
  return (
    <svg
      ref={props.svg}
      viewBox={`0 0 ${W} ${H}`}
      role="group"
      aria-label={props.label}
      className="block h-auto w-full max-w-[360px] select-none"
      style={{ background: ROOM, borderRadius: 14, overflow: 'hidden' }}
      {...props.handlers}
    >
      {props.children}
    </svg>
  )
}

function Verdict({ marked, text }: { marked: SceneMarked; text: string }) {
  if (marked === 'idle') return null
  return <p className="max-w-[350px] text-center text-[13px] font-bold leading-snug text-ss-ink">{text}</p>
}

const Hint = ({ children }: { children: string }) => <p className="li-kbd hidden text-[12px] text-ss-slate">{children}</p>

function keyMove(e: KeyboardEvent, set: (dir: number, big: boolean) => void) {
  const d = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 1, PageDown: -1 }[e.key]
  if (!d) return
  // The board moves a selected card with the arrows; here they move the knob.
  e.preventDefault()
  e.stopPropagation()
  set(d, e.key.startsWith('Page'))
}

const sliderClass = (locked: boolean, dragging: boolean) =>
  `outline-none focus-visible:outline-none [&:focus-visible_.li-focus]:block ${locked ? '' : dragging ? 'cursor-grabbing' : 'cursor-grab'}`

/** What a marked or shown card should draw: the learner's work, or the answer when it is being shown. */
const drawnState = (config: LightConfig, state: LightState, marked: SceneMarked): LightState =>
  marked === 'shown' ? lightEngine.solve(config) : state

const said = (config: LightConfig, state: LightState, marked: SceneMarked) =>
  marked === 'right' || marked === 'shown' ? working(config, state) : marked === 'wrong' ? madeText(config, state) : ''

const reachText = (hit: boolean) => (hit ? 'The light reaches the eye.' : 'The light does not reach the eye.')

// ---------------------------------------------------------------------------
// The mirror.

export const PIVOT: Pt = { x: 180, y: 212 }
export const REACH = 152
const MIRROR_HALF = 82
const NORMAL_LONG = 92
const SLICE_R = 46

export function mirrorLayout(config: MirrorConfig, turn: number) {
  const lamp = at(PIVOT, LAMP_AT, REACH)
  const mouth = at(PIVOT, LAMP_AT, REACH - 20)
  const eye = at(PIVOT, mirrorEye(config.target), REACH)
  const out = mirrorOut(turn)
  const hit = apart(out, mirrorEye(config.target)) <= MIRROR_AIM
  const end = hit ? eye : at(PIVOT, out, toEdge(PIVOT, out))
  const knob = at(PIVOT, turn + 90, MIRROR_HALF)
  const tip = at(PIVOT, turn, NORMAL_LONG)
  const lampLabel = at(PIVOT, LAMP_AT, REACH + 30)
  const labels: Label[] = [
    { text: 'lamp', x: clamp(lampLabel.x, 34, W - 34), y: lampLabel.y, anchor: 'middle', part: lamp },
    { text: 'eye', x: eye.x, y: eye.y - 20, anchor: 'middle', part: eye },
    { text: 'mirror', ...at(PIVOT, turn + 180, 38), anchor: 'middle', part: at(PIVOT, turn + 180, 8) },
    { text: 'normal', ...at(PIVOT, turn, NORMAL_LONG + 14), anchor: 'middle', part: tip },
  ]
  return { lamp, mouth, eye, out, hit, end, knob, tip, labels }
}

function describeMirror(config: MirrorConfig, turn: number): string {
  return `A dark room. A lamp at the left shines one ray at a mirror, and the ray leaves the mirror again; a dashed line called the normal stands on the mirror, with a slice between each ray and the normal. An eye sits above the mirror. ${reachText(mirrorLayout(config, turn).hit)}`
}

function MirrorScene({ config, state, setState, marked, reduced, locked }: Props & { config: MirrorConfig }) {
  const svg = useRef<SVGSVGElement>(null)
  const now = drawnState(config, state, marked)
  const turn = madeTurn(config, now)
  const shown = useEased(turn, reduced)
  useFlow(svg, reduced)
  // Where the hand took hold, so the mirror follows it from there, whichever end was grabbed.
  const grab = useRef({ pointer: 0, turn })
  const set = (v: number) => {
    const next = clamp(Math.round(v), TURN_MIN, TURN_MAX)
    if (!locked && next !== turn) setState({ turn: next })
  }
  const pointer = usePointer(svg, (p) => set(grab.current.turn + wrap(bearingOf(PIVOT, p) - grab.current.pointer)))
  const lay = mirrorLayout(config, shown)
  const iNow = mirrorIn(shown)
  const named = marked !== 'idle'
  const inLabel = sliceLabel(PIVOT, shown, LAMP_AT, SLICE_R + 15)
  const outLabel = sliceLabel(PIVOT, shown, lay.out, SLICE_R + 15)

  return (
    <div className="nodrag flex flex-col items-center gap-2 [&:has(:focus-visible)_.li-kbd]:block">
      <Stage svg={svg} label={describeMirror(config, turn)} handlers={pointer.stage}>
        <Slices c={PIVOT} r={SLICE_R} normal1={shown} ray1={LAMP_AT} normal2={shown} ray2={lay.out} />
        <line x1={PIVOT.x} y1={PIVOT.y} x2={f1(lay.tip.x)} y2={f1(lay.tip.y)} stroke={WHITE} strokeWidth={2} strokeDasharray="6 6" />
        <Rays reduced={reduced} segs={[{ a: lay.mouth, b: PIVOT, n: 1, width: RAY, arrow: true }, { a: PIVOT, b: lay.end, n: 1, width: RAY, arrow: true }]} />
        <Lamp p={lay.lamp} facing={LAMP_AT + 180} />
        <Eye p={lay.eye} lit={lay.hit} reduced={reduced} />
        <Names labels={lay.labels} />
        <g aria-hidden="true" fontSize={14} fontWeight={700} fill={WHITE} style={HALO} textAnchor="middle" dominantBaseline="central">
          <text x={f1(inLabel.x)} y={f1(inLabel.y)}>{named ? `${Math.abs(Math.round(iNow))}°` : 'in'}</text>
          <text x={f1(outLabel.x)} y={f1(outLabel.y)}>{named ? `${Math.abs(Math.round(iNow))}°` : 'out'}</text>
        </g>
        <g
          role="slider"
          tabIndex={locked ? -1 : 0}
          aria-label="The mirror. Drag its white knob to turn it, or use the arrow keys"
          aria-valuemin={TURN_MIN}
          aria-valuemax={TURN_MAX}
          aria-valuenow={turn}
          aria-valuetext={`Mirror turned ${Math.abs(turn)} degrees ${turn < 0 ? 'to the left' : 'to the right'} of level. ${reachText(lay.hit)}`}
          aria-disabled={locked || undefined}
          style={{ touchAction: 'none' }}
          className={sliderClass(locked, pointer.dragging)}
          onKeyDown={(e) => keyMove(e, (d, big) => set(turn + d * (big ? 15 : 3)))}
          onPointerDown={(e) => {
            if (locked) return
            const p = pointer.toStage(e)
            if (p) grab.current = { pointer: bearingOf(PIVOT, p), turn }
            pointer.begin(e)
          }}
        >
          <g transform={`translate(${PIVOT.x} ${PIVOT.y}) rotate(${f1(shown)})`}>
            <line x1={-MIRROR_HALF} y1={0} x2={MIRROR_HALF} y2={0} stroke="transparent" strokeWidth={30} />
            <line x1={-MIRROR_HALF} y1={0} x2={MIRROR_HALF} y2={0} stroke={WHITE} strokeWidth={7} />
            {Array.from({ length: 11 }, (_, k) => {
              const x = -70 + k * 14
              return <line key={k} x1={x} y1={3} x2={x - 7} y2={12} stroke={DIM} strokeWidth={2} strokeLinecap="round" />
            })}
          </g>
          <circle cx={f1(lay.knob.x)} cy={f1(lay.knob.y)} r={25} fill="transparent" />
          <Knob p={lay.knob} rot={shown + 90} />
        </g>
      </Stage>
      <Hint>The arrow keys turn the mirror.</Hint>
      <span className="sr-only" aria-live="polite">{reachText(lay.hit)}</span>
      <Verdict marked={marked} text={said(config, now, marked)} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// The half-disc on its ring.

export const CENTRE: Pt = { x: 180, y: 140 }
export const RING = 120
export const DISC = 88
const LAMP_IN = 26
const GLASS_SLICE = 40

/** The lamp's name, out past its knob where there is room, and to one side at the very top and bottom of the ring. */
function lampLabel(knob: Pt, lamp: number): Label {
  const b = rad(lamp)
  const y = knob.y - Math.cos(b) * 31 + 5
  if (y < 15 || y > H - 6) {
    return { text: 'lamp', x: knob.x + (lamp < 0 ? -20 : 20), y: knob.y + 5, anchor: lamp < 0 ? 'end' : 'start', part: knob }
  }
  return { text: 'lamp', x: clamp(knob.x + Math.sin(b) * 37, 18, W - 18), y, anchor: 'middle', part: knob }
}

export function glassLayout(config: GlassConfig, lamp: number) {
  const n = indexOf(config.material)
  const t = trace(lamp, n)
  const eyeAt = glassEye(config.task, config.target)
  const eye = at(CENTRE, eyeAt, RING)
  const hit = apart(t.out, eyeAt) <= AIM
  const knob = at(CENTRE, lamp, RING)
  const body = at(CENTRE, lamp, RING - LAMP_IN)
  const mouth = at(CENTRE, lamp, RING - LAMP_IN - 20)
  const end = hit ? eye : at(CENTRE, t.out, toEdge(CENTRE, t.out))
  const segs: Seg[] = []
  const shareOut = Math.max(0, 1 - t.share)
  const main = 1.5 + (RAY - 1.5) * shareOut
  if (t.inAir) {
    segs.push({ a: mouth, b: CENTRE, n: 1, width: RAY, arrow: true })
    segs.push({ a: CENTRE, b: at(CENTRE, t.out, DISC), n, width: RAY, arrow: true })
    segs.push({ a: at(CENTRE, t.out, DISC), b: end, n: 1, width: RAY })
  } else {
    segs.push({ a: mouth, b: at(CENTRE, lamp, DISC), n: 1, width: RAY })
    segs.push({ a: at(CENTRE, lamp, DISC), b: CENTRE, n, width: RAY, arrow: true })
    if (t.trapped) {
      segs.push({ a: CENTRE, b: at(CENTRE, t.out, DISC), n, width: RAY, arrow: true })
      segs.push({ a: at(CENTRE, t.out, DISC), b: end, n: 1, width: RAY })
    } else {
      segs.push({ a: CENTRE, b: end, n: 1, width: main, arrow: main >= 2.5 })
    }
  }
  // The part that reflects inside, thin until the critical angle takes all of it.
  const faint = !t.inAir && !t.trapped && t.bounce !== null
    ? [
        { a: CENTRE, b: at(CENTRE, t.bounce, DISC), n, width: 1.5 + (RAY - 1.5) * t.share },
        { a: at(CENTRE, t.bounce, DISC), b: at(CENTRE, t.bounce, toEdge(CENTRE, t.bounce)), n: 1, width: 1.5 + (RAY - 1.5) * t.share },
      ]
    : []
  const upper = Math.abs(eyeAt) < 90
  const fromAir = config.task === 'bend-in'
  const steep = config.task === 'trap' && config.target >= 58
  const labels: Label[] = [
    lampLabel(knob, lamp),
    eye.y < 36
      ? { text: 'eye', x: eye.x + 30, y: eye.y + 5, anchor: 'start', part: eye }
      : { text: 'eye', x: eye.x, y: upper ? eye.y - 20 : eye.y + 30, anchor: 'middle', part: eye },
    { text: 'normal', x: CENTRE.x + (fromAir ? 8 : -8), y: CENTRE.y - RING + 20, anchor: fromAir ? 'start' : 'end', part: { x: CENTRE.x, y: CENTRE.y - RING + 16 } },
    { text: 'air', x: CENTRE.x + 4 - DISC, y: CENTRE.y - 10, anchor: 'start', part: { x: CENTRE.x + 14 - DISC, y: CENTRE.y - 22 } },
    steep
      ? { text: config.material, x: CENTRE.x, y: CENTRE.y + DISC - 12, anchor: 'middle', part: { x: CENTRE.x, y: CENTRE.y + DISC - 6 }, onGlass: true }
      : { text: config.material, x: CENTRE.x - DISC + 8, y: CENTRE.y + 20, anchor: 'start', part: { x: CENTRE.x - DISC + 26, y: CENTRE.y + 22 }, onGlass: true },
  ]
  return { t, eye, hit, knob, body, mouth, end, segs, faint, labels, n, eyeAt }
}

function describeGlass(config: GlassConfig, lamp: number): string {
  const lay = glassLayout(config, lamp)
  const where = lay.t.inAir ? 'in the air above the flat face' : 'below the flat face, shining in through the curved side'
  const through = lay.t.trapped ? 'None of the light gets out of the flat face.' : lay.t.inAir ? 'The ray changes direction at the flat face.' : 'The ray changes direction at the flat face, and a fainter ray reflects back inside.'
  return `A dark room with a half-disc of ${config.material}, flat face up, and a dashed normal through the middle of the flat face. A lamp rides a ring round it, now ${where}. ${through} An eye sits on the ring. ${reachText(lay.hit)}`
}

function GlassScene({ config, state, setState, marked, reduced, locked }: Props & { config: GlassConfig }) {
  const svg = useRef<SVGSVGElement>(null)
  const now = drawnState(config, state, marked)
  const lamp = madeLamp(config, now)
  const shown = useEased(lamp, reduced, true)
  useFlow(svg, reduced)
  const set = (v: number) => {
    const next = wrap(Math.round(v))
    if (!locked && next !== lamp) setState({ lamp: next })
  }
  const pointer = usePointer(svg, (p) => set(bearingOf(CENTRE, p)))
  const lay = glassLayout(config, shown)
  const { t } = lay
  const named = marked !== 'idle'
  const inNormal = t.inAir ? 0 : 180
  const outNormal = t.inAir ? 180 : t.trapped ? 180 : 0
  const inMark = sliceLabel(CENTRE, inNormal, shown, GLASS_SLICE + 14)
  const outMark = sliceLabel(CENTRE, outNormal, t.out, GLASS_SLICE + 14)

  return (
    <div className="nodrag flex flex-col items-center gap-2 [&:has(:focus-visible)_.li-kbd]:block">
      <Stage svg={svg} label={describeGlass(config, lamp)} handlers={pointer.stage}>
        <circle cx={CENTRE.x} cy={CENTRE.y} r={RING} fill="none" stroke={TRACK} strokeWidth={2} />
        <path d={`M ${CENTRE.x - DISC} ${CENTRE.y} A ${DISC} ${DISC} 0 0 0 ${CENTRE.x + DISC} ${CENTRE.y} Z`} fill={GLASS} stroke={EDGE} strokeWidth={3} strokeLinejoin="round" />
        <Slices c={CENTRE} r={GLASS_SLICE} normal1={inNormal} ray1={shown} normal2={outNormal} ray2={t.out} />
        <line x1={CENTRE.x} y1={CENTRE.y - RING} x2={CENTRE.x} y2={CENTRE.y + RING} stroke={WHITE} strokeWidth={2} strokeDasharray="6 6" />
        <Rays reduced={reduced} segs={lay.faint} />
        <Rays reduced={reduced} segs={lay.segs} />
        <Lamp p={lay.body} facing={shown + 180} />
        <Eye p={lay.eye} lit={lay.hit} reduced={reduced} />
        <Names labels={lay.labels} />
        <g aria-hidden="true" fontSize={14} fontWeight={700} fill={WHITE} textAnchor="middle" dominantBaseline="central">
          <text x={f1(inMark.x)} y={f1(inMark.y)} style={inNormal === 180 ? HALO_GLASS : HALO}>{named ? `${Math.round(t.i)}°` : 'in'}</text>
          <text x={f1(outMark.x)} y={f1(outMark.y)} style={outNormal === 180 ? HALO_GLASS : HALO}>{named ? `${Math.round(t.r ?? t.i)}°` : 'out'}</text>
        </g>
        <g
          role="slider"
          tabIndex={locked ? -1 : 0}
          aria-label="The lamp. Drag its white knob round the ring, or use the arrow keys"
          aria-valuemin={-179}
          aria-valuemax={180}
          aria-valuenow={lamp}
          aria-valuetext={`Lamp ${Math.abs(lamp)} degrees ${lamp < 0 ? 'to the left' : 'to the right'} round the ring from the top. ${reachText(lay.hit)}`}
          aria-disabled={locked || undefined}
          style={{ touchAction: 'none' }}
          className={sliderClass(locked, pointer.dragging)}
          onKeyDown={(e) => keyMove(e, (d, big) => set(lamp + d * (big ? 15 : 2)))}
          onPointerDown={(e) => {
            if (locked) return
            pointer.begin(e)
            const p = pointer.toStage(e)
            if (p) set(bearingOf(CENTRE, p))
          }}
        >
          <circle cx={CENTRE.x} cy={CENTRE.y} r={RING} fill="none" stroke="transparent" strokeWidth={28} />
          <circle cx={f1(lay.knob.x)} cy={f1(lay.knob.y)} r={25} fill="transparent" />
          <Knob p={lay.knob} rot={shown} />
        </g>
      </Stage>
      <Hint>The arrow keys move the lamp round the ring.</Hint>
      <span className="sr-only" aria-live="polite">{reachText(lay.hit)}</span>
      <Verdict marked={marked} text={said(config, now, marked)} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// The lens: a candle, five rays, and a screen.

export const AXIS = 122
export const LENS_X = 158
export const PX = 4.4
const RAY_HEIGHTS = [-1, -0.5, 0, 0.5, 1]
const PANEL_HALF = 27
const PANEL_TOP = 38
const PANEL_BOTTOM = 274
const STICK_H = 30
const STICK_W = 10
const CANDLE_PX = 52
const KNOB_DROP = 16
const FLAME = 'M 0 -52 C 7 -44 10 -38 6 -32 C 4 -30 -4 -30 -6 -32 C -10 -38 -7 -44 0 -52 Z'
const SILHOUETTE = 'M -5 0 L -5 -30 L -6 -32 C -10 -38 -7 -44 0 -52 C 7 -44 10 -38 6 -32 L 5 -30 L 5 0 Z'

export function lensLayout(config: LensConfig, u: number) {
  const v = screenAt(config.size)
  const candleX = LENS_X - u * PX
  const screenX = LENS_X + v * PX
  const tip: Pt = { x: candleX, y: AXIS - CANDLE_PX }
  const fan = RAY_HEIGHTS.map((k) => {
    const h = k * APERTURE
    const yAtLens = AXIS - h * PX
    const yAtScreen = AXIS - landing(u, h, v) * PX
    return { yAtLens, yAtScreen }
  })
  const spread = blur(u, v)
  const hit = spread <= SHARP
  const size = v / u
  const labels: Label[] = [
    { text: 'candle', x: clamp(candleX, 30, LENS_X - 44), y: AXIS + 50, anchor: 'middle', part: { x: candleX, y: AXIS + KNOB_DROP } },
    { text: 'lens', x: LENS_X, y: AXIS - 70, anchor: 'middle', part: { x: LENS_X, y: AXIS - 60 } },
    { text: 'screen', x: screenX, y: PANEL_TOP - 9, anchor: 'middle', part: { x: screenX, y: PANEL_TOP } },
  ]
  return { v, candleX, screenX, tip, fan, spread, hit, size, labels }
}

function describeLens(config: LensConfig, u: number): string {
  const lay = lensLayout(config, u)
  return `A dark room. A candle stands on a rail to the left of a lens, and five rays leave the tip of its flame through different parts of the lens and go on to a screen. ${lay.hit ? 'The rays meet on the screen and the picture there is sharp.' : 'The rays land apart on the screen and the picture there is a blur.'}`
}

function LensScene({ config, state, setState, marked, reduced, locked }: Props & { config: LensConfig }) {
  const svg = useRef<SVGSVGElement>(null)
  const now = drawnState(config, state, marked)
  const u = madeU(config, now)
  const shown = useEased(u, reduced)
  useFlow(svg, reduced)
  const set = (v: number) => {
    const next = clamp(Math.round(v * 2) / 2, U_MIN, U_MAX)
    if (!locked && next !== u) setState({ u: next })
  }
  const grab = useRef(0)
  const pointer = usePointer(svg, (p) => set((LENS_X - (p.x + grab.current)) / PX))
  const lay = lensLayout(config, shown)
  const named = marked !== 'idle'
  const blurPx = lay.spread * PX
  // The blur shrinks with the rays and gets brighter as the light gathers; the picture snaps sharp exactly when
  // the rays count as met, so what the eye sees and what Check says can never disagree.
  const crisp = lay.hit ? 1 : 0
  const glow = clamp(1 - lay.spread / 16, 0.3, 1)
  const fade = reduced ? undefined : { transition: 'opacity 280ms ease-out' }
  const stroke = (2 * blurPx) / Math.max(lay.size, 0.05)

  return (
    <div className="nodrag flex flex-col items-center gap-2 [&:has(:focus-visible)_.li-kbd]:block">
      <Stage svg={svg} label={describeLens(config, u)} handlers={pointer.stage}>
        {/* the rail */}
        <line x1={0} x2={W} y1={AXIS} y2={AXIS} stroke={TRACK} strokeWidth={2} />
        {/* the screen, and on it whatever picture the light makes */}
        <svg x={f1(lay.screenX - PANEL_HALF)} y={PANEL_TOP} width={PANEL_HALF * 2} height={PANEL_BOTTOM - PANEL_TOP} overflow="hidden">
          <rect width={PANEL_HALF * 2} height={PANEL_BOTTOM - PANEL_TOP} fill={SCREEN} />
          <g transform={`translate(${PANEL_HALF} ${AXIS - PANEL_TOP}) scale(${lay.size.toFixed(3)} ${(-lay.size).toFixed(3)})`}>
            <path d={SILHOUETTE} fill={LIGHT} stroke={LIGHT} strokeWidth={f1(stroke)} strokeLinejoin="round" style={{ opacity: glow * (1 - crisp), ...fade }} />
            <g style={{ opacity: crisp, ...fade }}>
              <rect x={-STICK_W / 2} y={-STICK_H} width={STICK_W} height={STICK_H} fill={WHITE} />
              <path d={FLAME} fill={LIGHT} />
            </g>
          </g>
        </svg>
        <rect x={f1(lay.screenX - PANEL_HALF)} y={PANEL_TOP} width={PANEL_HALF * 2} height={PANEL_BOTTOM - PANEL_TOP} fill="none" stroke={DIM} strokeWidth={2} />
        {/* the lens */}
        <path d={`M ${LENS_X} ${AXIS - 62} Q ${LENS_X + 22} ${AXIS} ${LENS_X} ${AXIS + 62} Q ${LENS_X - 22} ${AXIS} ${LENS_X} ${AXIS - 62} Z`} fill={GLASS} stroke={EDGE} strokeWidth={3} strokeLinejoin="round" />
        {/* every ray from the tip of the flame */}
        {lay.fan.map((r, k) => (
          <Rays
            key={k} reduced={reduced}
            segs={[
              { a: lay.tip, b: { x: LENS_X, y: r.yAtLens }, n: 1, width: 3, arrow: k === 0 || k === 4, along: 0.72 },
              { a: { x: LENS_X, y: r.yAtLens }, b: { x: lay.screenX, y: r.yAtScreen }, n: 1, width: 3 },
            ]}
          />
        ))}
        {/* the candle */}
        <g aria-hidden="true" transform={`translate(${f1(lay.candleX)} ${AXIS})`}>
          <rect x={-STICK_W / 2} y={-STICK_H} width={STICK_W} height={STICK_H} fill={WHITE} />
          <path d={FLAME} fill={LIGHT} />
        </g>
        <Names labels={lay.labels} />
        {named && (
          <g aria-hidden="true" fontSize={14} fontWeight={700} fill={WHITE} style={HALO} textAnchor="middle">
            <text x={f1(clamp((lay.candleX + LENS_X) / 2, 44, LENS_X - 44))} y={H - 8}>u = {Math.round(shown * 10) / 10} cm</text>
            <text x={f1(clamp((LENS_X + lay.screenX) / 2, LENS_X + 44, lay.screenX - 34))} y={H - 8}>v = {Math.round(lay.v * 10) / 10} cm</text>
          </g>
        )}
        <g
          role="slider"
          tabIndex={locked ? -1 : 0}
          aria-label="The candle. Drag its white knob along the rail, or use the arrow keys"
          aria-valuemin={U_MIN}
          aria-valuemax={U_MAX}
          aria-valuenow={u}
          aria-valuetext={`Candle ${u} centimetres from the lens. ${lay.hit ? 'The picture on the screen is sharp.' : 'The picture on the screen is a blur.'}`}
          aria-disabled={locked || undefined}
          style={{ touchAction: 'none' }}
          className={sliderClass(locked, pointer.dragging)}
          onKeyDown={(e) => keyMove(e, (d, big) => set(u - d * (big ? 5 : 1)))}
          onPointerDown={(e) => {
            if (locked) return
            const p = pointer.toStage(e)
            if (p) grab.current = lay.candleX - p.x
            pointer.begin(e)
          }}
        >
          <rect x={f1(lay.candleX - 25)} y={AXIS - CANDLE_PX - 6} width={50} height={CANDLE_PX + KNOB_DROP + 32} fill="transparent" />
          <Knob p={{ x: lay.candleX, y: AXIS + KNOB_DROP }} rot={0} />
        </g>
      </Stage>
      <Hint>The arrow keys slide the candle along the rail.</Hint>
      <span className="sr-only" aria-live="polite">{lay.hit ? 'The picture on the screen is sharp.' : 'The picture on the screen is a blur.'}</span>
      <Verdict marked={marked} text={said(config, now, marked)} />
    </div>
  )
}

// ---------------------------------------------------------------------------

export function LightView(props: Props) {
  const { config } = props
  if (config.task === 'mirror') return <MirrorScene {...props} config={config} />
  if (config.task === 'lens') return <LensScene {...props} config={config} />
  return <GlassScene {...props} config={config as GlassConfig} />
}
