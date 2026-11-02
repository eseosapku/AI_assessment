'use client'
import { useEffect, useRef, type KeyboardEvent } from 'react'
import type { SceneMarked, SceneViewProps } from '../types'
import type { WavesConfig, WavesState } from './config'
import { FREQ_MAX, FREQ_MIN, SLOW_FREQ_MAX, madeText, made, working } from './config'

type Props = SceneViewProps<WavesConfig, WavesState>
type Task = WavesConfig['task']

// A flat dark stage in both themes, so the rope reads as a bright line. Flat colours only.
const STAGE = '#0F1722'
const ROPE = '#7FCBEF'
const DOT = '#FF8A3D'
const TARGET = '#6EE7A0'
const WHITE = '#F2F5F8'
const TRACK = '#5B6B7E'
const INK = 'var(--ss-ink, #16202A)'
const HALO = { stroke: STAGE, strokeWidth: 4, paintOrder: 'stroke', strokeLinejoin: 'round' } as const

// ---------------------------------------------------------------------------
// Geometry (viewBox pixels). Exported for the tests.
// The rope is 12 m, the join 6 m, the speeds 12 and 6 m/s; written out here because config.ts and this file import
// each other (the test checks they agree).

export const W = 360
export const H = 330
export const X0 = 40
export const X1 = 336
export const PX_PER_M = (X1 - X0) / 12
export const PX_PER_AMP = 13
export const TARGET_Y = 72
export const BRACKET_Y = 134
export const ROPE_Y = 226
export const LABEL_A = 304
export const LABEL_B = 322
/** Pictures run slower than life, so the eye can follow: a wave crosses the thin rope in 2.5 s. */
export const TIME_SCALE = 0.4
export const STILL_PHASE = 0.9

const TAU = Math.PI * 2
const LENGTH = 12
const JOIN_AT = 6
const SPEED = { thin: 12, thick: 6 }
const xOf = (m: number) => X0 + m * PX_PER_M
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** The wave at `m` metres along the rope, for `f` shakes a second, as a unit height (-1..1): the steady state. */
export function unitWave(task: Task, f: number, m: number, phase: number): number {
  const turns = task === 'slow' && m > JOIN_AT
    ? (f * JOIN_AT) / SPEED.thin + (f * (m - JOIN_AT)) / SPEED.thick
    : (f * m) / SPEED.thin
  return Math.sin(phase - TAU * turns)
}

/** Where the dots sit: one on the rope for the match task, one on each rope for the slow task. */
export const dotsOf = (task: Task) => (task === 'slow' ? [3.5, 9] : [6])

// ---------------------------------------------------------------------------
// The hand's history. A point of the rope at `m` metres repeats what the hand did `delayOf(m)` seconds earlier; that is
// all a travelling wave is, and it is why a change in the shaking is seen marching down the rope at the rope's pace.

export type History = { t: number[]; p: number[]; a: number[] }

/** Seconds (of the picture's slowed time) for the wave to reach `m` metres. */
export function delayOf(task: Task, m: number): number {
  if (task === 'slow' && m > JOIN_AT) return (JOIN_AT / SPEED.thin + (m - JOIN_AT) / SPEED.thick) / TIME_SCALE
  return m / SPEED.thin / TIME_SCALE
}
/** The inverse: how many metres the wave has gone in `d` seconds. */
export function reachOf(task: Task, d: number): number {
  const toJoin = JOIN_AT / SPEED.thin / TIME_SCALE
  if (task === 'slow' && d > toJoin) return JOIN_AT + (d - toJoin) * TIME_SCALE * SPEED.thick
  return d * TIME_SCALE * SPEED.thin
}

/** A history as if the hand had always shaken like this, ending at time 0 with the given phase. */
export function steady(f: number, a: number, phase: number, span = 6, step = 1 / 30): History {
  const h: History = { t: [], p: [], a: [] }
  for (let t = -span; t <= 1e-9; t += step) {
    h.t.push(t)
    h.p.push(phase + TAU * f * TIME_SCALE * t)
    h.a.push(a)
  }
  return h
}

export function push(h: History, t: number, p: number, a: number, keep = 7) {
  h.t.push(t); h.p.push(p); h.a.push(a)
  while (h.t.length > 2 && h.t[1] < t - keep) { h.t.shift(); h.p.shift(); h.a.shift() }
}

/** The index of the last sample at or before `v` in a rising list. */
function below(list: number[], v: number): number {
  let lo = 0
  let hi = list.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (list[mid] <= v) lo = mid
    else hi = mid - 1
  }
  return lo
}
function lerp(xs: number[], ys: number[], x: number): number {
  const i = below(xs, x)
  if (i >= xs.length - 1 || x <= xs[0]) return ys[clamp(i, 0, ys.length - 1)]
  const k = (x - xs[i]) / (xs[i + 1] - xs[i] || 1)
  return ys[i] + (ys[i + 1] - ys[i]) * k
}

/** Height, in units of amplitude (up is positive), of the rope at `m` metres when the time is `now`. */
export function heightAt(h: History, task: Task, now: number, m: number): number {
  const tau = now - delayOf(task, m)
  return lerp(h.t, h.a, tau) * Math.sin(lerp(h.t, h.p, tau))
}

/** The stretch of rope one shake of the hand has made: from where it starts, and to how far the first wave has got. */
export function oneWave(h: History, task: Task, now: number): { from: number; to: number } {
  const from = task === 'slow' ? JOIN_AT : 0
  const start = lerp(h.t, h.p, now - delayOf(task, from))
  const target = start - TAU
  if (h.p[0] > target) return { from, to: LENGTH }
  const i = below(h.p, target)
  const k = i >= h.p.length - 1 ? 0 : (target - h.p[i]) / (h.p[i + 1] - h.p[i] || 1)
  const tau = h.t[i] + (h.t[Math.min(i + 1, h.t.length - 1)] - h.t[i]) * k
  return { from, to: clamp(reachOf(task, now - tau), from, LENGTH) }
}

const POINTS = 81
function ropePath(h: History, task: Task, now: number, from = 0, to = LENGTH): string {
  const parts: string[] = []
  for (let k = 0; k < POINTS; k++) {
    const m = from + ((to - from) * k) / (POINTS - 1)
    parts.push(`${k ? 'L' : 'M'}${xOf(m).toFixed(1)} ${(ROPE_Y - heightAt(h, task, now, m) * PX_PER_AMP).toFixed(1)}`)
  }
  return parts.join('')
}
function bracketPath(from: number, to: number): string {
  const a = xOf(from)
  const b = xOf(to)
  return `M${a.toFixed(1)} ${BRACKET_Y - 6}V${BRACKET_Y + 6}M${a.toFixed(1)} ${BRACKET_Y}H${b.toFixed(1)}M${b.toFixed(1)} ${BRACKET_Y - 6}V${BRACKET_Y + 6}`
}

/** The target: the wave that has to be made, fixed on the page. */
export function targetPath(config: WavesConfig): string {
  const parts: string[] = []
  if (config.task === 'slow') {
    for (let m = JOIN_AT; m <= LENGTH + 1e-9; m += 0.15) {
      const y = TARGET_Y - 3 * PX_PER_AMP * Math.sin((TAU * config.frequency * (m - JOIN_AT)) / SPEED.thick)
      parts.push(`${parts.length ? 'L' : 'M'}${xOf(m).toFixed(1)} ${y.toFixed(1)}`)
    }
    return parts.join('')
  }
  for (let m = 0; m <= LENGTH + 1e-9; m += 0.15) {
    const y = TARGET_Y - config.amplitude * PX_PER_AMP * Math.sin((TAU * config.frequency * m) / SPEED.thin)
    parts.push(`${parts.length ? 'L' : 'M'}${xOf(m).toFixed(1)} ${y.toFixed(1)}`)
  }
  return parts.join('')
}

/** The labels under the picture, with where each starts and how much room its words take. */
export function bottomLabels(task: Task): { text: string; x: number; row: 'A' | 'B'; anchor: 'start' | 'middle' | 'end'; wide: number; color: string }[] {
  const width = (s: string) => Math.ceil(s.length * 8)
  const dots = dotsOf(task).map((m) => ({ text: 'orange dot', x: xOf(m), row: 'A' as const, anchor: 'middle' as const, wide: width('orange dot'), color: DOT }))
  const hand = { text: 'hand', x: X0, row: 'A' as const, anchor: 'middle' as const, wide: width('hand'), color: WHITE }
  const rope = task === 'slow'
    ? [
        { text: 'thin rope', x: xOf(JOIN_AT / 2), row: 'B' as const, anchor: 'middle' as const, wide: width('thin rope'), color: ROPE },
        { text: 'thick rope', x: xOf((JOIN_AT + LENGTH) / 2), row: 'B' as const, anchor: 'middle' as const, wide: width('thick rope'), color: ROPE },
      ]
    : [{ text: 'blue rope', x: xOf(LENGTH / 2), row: 'B' as const, anchor: 'middle' as const, wide: width('blue rope'), color: ROPE }]
  return [hand, ...dots, ...rope]
}

/** The spans of x each label covers, so a test can prove none touch another on its row. */
export function labelSpans(task: Task) {
  return bottomLabels(task).map((l) => {
    const left = l.anchor === 'start' ? l.x : l.anchor === 'end' ? l.x - l.wide : l.x - l.wide / 2
    return { text: l.text, row: l.row, x: l.x, left, right: left + l.wide }
  })
}

// ---------------------------------------------------------------------------

function Tap({ label, sign, off, onTap }: { label: string; sign: '+' | '-'; off: boolean; onTap: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={off}
      onClick={onTap}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ss-panel outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:opacity-40"
      style={{ border: `2.5px solid ${INK}` }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
        <path d={sign === '+' ? 'M8 2 V14 M2 8 H14' : 'M2 8 H14'} />
      </svg>
    </button>
  )
}

function Control(props: { name: string; level: number; max: number; less: string; more: string; locked: boolean; set: (v: number) => void; min: number }) {
  const { name, level, max, min, less, more, locked, set } = props
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-[13px] font-extrabold text-ss-ink">{name}</span>
      <div className="flex items-center gap-1">
        <Tap label={less} sign="-" off={locked || level <= min} onTap={() => set(level - 1)} />
        <span className="flex items-center gap-[3px]" aria-hidden="true">
          {Array.from({ length: max }, (_, i) => (
            <span key={i} className="h-2.5 w-2.5 rounded-full" style={{ background: i < level ? INK : 'transparent', border: `2px solid ${INK}` }} />
          ))}
        </span>
        <Tap label={more} sign="+" off={locked || level >= max} onTap={() => set(level + 1)} />
      </div>
    </div>
  )
}

function describe(config: WavesConfig, f: number): string {
  const crests = config.task === 'slow' ? `${f} crests along the thin rope and ${f * 2} along the thick rope` : `${f} crests along the rope`
  return `A dark stage. A hand shakes the left end of a rope and the wave travels to the right, ${crests}. ${config.task === 'slow' ? 'The rope is thin on the left and thick on the right. A dashed green wave above the thick part shows the wave to make. ' : 'A dashed green wave above the rope shows the wave to make. '}A white bracket marks how far the first wave has got in one shake. Orange dot${config.task === 'slow' ? 's' : ''} on the rope only move up and down.`
}

export function WavesView({ config, state, setState, marked, reduced, locked }: Props) {
  const { f, a } = made(state, config)
  const slow = config.task === 'slow'
  const task = config.task
  const shownA = slow ? 3 : a
  const svgRef = useRef<SVGSVGElement>(null)
  const live = useRef({ f, a: shownA })
  live.current = { f, a: shownA }
  const dots = dotsOf(task)

  // The first frame, and every frame under reduced motion, is the steady wave at a fixed phase.
  const frozen = useRef<{ rope: string; rope2: string; hand: number; dots: number[]; br: { from: number; to: number } } | null>(null)
  const still = (ff: number, aa: number) => {
    const h = steady(ff, aa, STILL_PHASE)
    return {
      rope: slow ? ropePath(h, task, 0, 0, JOIN_AT) : ropePath(h, task, 0),
      rope2: slow ? ropePath(h, task, 0, JOIN_AT, LENGTH) : '',
      hand: ROPE_Y - heightAt(h, task, 0, 0) * PX_PER_AMP,
      dots: dots.map((m) => ROPE_Y - heightAt(h, task, 0, m) * PX_PER_AMP),
      br: oneWave(h, task, 0),
    }
  }
  const first = reduced ? still(f, shownA) : (frozen.current ??= still(f, shownA))

  const hist = useRef<{ h: History; now: number; f: number; a: number; p: number } | null>(null)

  useEffect(() => {
    const svg = svgRef.current
    if (reduced || !svg) { hist.current = null; return }
    const start = live.current
    hist.current = { h: steady(start.f, start.a, STILL_PHASE), now: 0, f: start.f, a: start.a, p: STILL_PHASE }
    const set = (sel: string, name: string, value: string) => svg.querySelector(sel)?.setAttribute(name, value)
    const paint = () => {
      const s = hist.current
      if (!s) return
      set('[data-rope]', 'd', slow ? ropePath(s.h, task, s.now, 0, JOIN_AT) : ropePath(s.h, task, s.now))
      if (slow) set('[data-rope2]', 'd', ropePath(s.h, task, s.now, JOIN_AT, LENGTH))
      set('[data-hand]', 'cy', (ROPE_Y - heightAt(s.h, task, s.now, 0) * PX_PER_AMP).toFixed(1))
      dots.forEach((m, i) => set(`[data-dot="${i}"]`, 'cy', (ROPE_Y - heightAt(s.h, task, s.now, m) * PX_PER_AMP).toFixed(1)))
      const br = oneWave(s.h, task, s.now)
      set('[data-bracket]', 'd', bracketPath(br.from, br.to))
      set('[data-bracket-text]', 'x', (Math.max(xOf(br.from), xOf(br.to)) + 8).toFixed(1))
    }
    let raf = 0
    let last = 0
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick)
      const s = hist.current
      if (!s) return
      const dt = last ? Math.min(0.06, (t - last) / 1000) : 0.016
      last = t
      // The hand changes its shaking over about a second, so the change is seen being made.
      const k = 1 - Math.exp(-dt / 0.35)
      s.f += (live.current.f - s.f) * k
      s.a += (live.current.a - s.a) * k
      s.p += TAU * s.f * TIME_SCALE * dt
      s.now += dt
      push(s.h, s.now, s.p, s.a)
      paint()
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, task])

  const setF = (v: number) => { if (!locked) setState(slow ? { f: clamp(v, FREQ_MIN, SLOW_FREQ_MAX) } : { f: clamp(v, FREQ_MIN, FREQ_MAX), a }) }
  const setA = (v: number) => { if (!locked) setState({ f, a: clamp(v, 1, 4) }) }

  // The board moves cards with the arrow keys; inside the card they belong to the card.
  const onKey = (e: KeyboardEvent) => { if (e.key.startsWith('Arrow')) e.stopPropagation() }

  const good = marked === 'right' || marked === 'shown'
  const text = good ? working(config) : marked === 'wrong' ? madeText(config, state) : ''
  const labels = bottomLabels(task)
  const trackTop = ROPE_Y - 4 * PX_PER_AMP - 8
  const trackBottom = ROPE_Y + 4 * PX_PER_AMP + 8
  const targetLabelX = slow ? xOf(JOIN_AT) : 4

  return (
    <div className="nodrag flex flex-col items-center gap-2" onKeyDown={onKey}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={describe(config, f)}
        className="block h-auto w-full max-w-[360px] select-none"
        style={{ background: STAGE, borderRadius: 14 }}
      >
        {/* the target, dashed green, above the rope */}
        <path d={targetPath(config)} fill="none" stroke={TARGET} strokeWidth={4} strokeDasharray="9 7" strokeLinecap="round" strokeLinejoin="round" />
        <text x={targetLabelX} y={16} fontSize={14} fontWeight={700} fill={TARGET} style={HALO}>make this wave</text>
        {/* how far the first wave got while the hand shook once */}
        <path data-bracket d={bracketPath(first.br.from, first.br.to)} fill="none" stroke={WHITE} strokeWidth={2.5} strokeLinecap="round" />
        <text data-bracket-text x={Math.max(xOf(first.br.from), xOf(first.br.to)) + 8} y={BRACKET_Y + 5} textAnchor="start" fontSize={14} fontWeight={700} fill={WHITE} style={HALO}>one wave</text>
        {/* a thin line through the hand and each dot: they only go up and down */}
        <line x1={X0} x2={X0} y1={trackTop} y2={trackBottom} stroke={TRACK} strokeWidth={2} strokeDasharray="2 5" strokeLinecap="round" />
        {dots.map((m) => (
          <line key={m} x1={xOf(m)} x2={xOf(m)} y1={trackTop} y2={trackBottom} stroke={DOT} strokeWidth={2} strokeDasharray="2 5" strokeLinecap="round" />
        ))}
        {/* the rope */}
        <path data-rope d={first.rope} fill="none" stroke={ROPE} strokeWidth={slow ? 3.5 : 5} strokeLinecap="round" strokeLinejoin="round" />
        {slow && <path data-rope2 d={first.rope2} fill="none" stroke={ROPE} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />}
        {/* the hand and the dots */}
        <circle data-hand cx={X0} cy={first.hand} r={11} fill={WHITE} />
        {dots.map((m, i) => (
          <circle key={m} data-dot={i} cx={xOf(m)} cy={first.dots[i]} r={9} fill={DOT} stroke={STAGE} strokeWidth={2.5} />
        ))}
        {labels.map((l) => (
          <text key={`${l.text}${l.x}`} x={l.x} y={l.row === 'A' ? LABEL_A : LABEL_B} textAnchor={l.anchor} fontSize={14} fontWeight={700} fill={l.color} style={HALO}>{l.text}</text>
        ))}
      </svg>
      <div className={slow ? 'flex w-full max-w-[360px] justify-center' : 'grid w-full max-w-[360px] grid-cols-2'}>
        <Control name="How fast you shake" level={f} min={FREQ_MIN} max={slow ? SLOW_FREQ_MAX : FREQ_MAX} less="Shake slower" more="Shake faster" locked={locked} set={setF} />
        {!slow && <Control name="How far you shake" level={a} min={1} max={4} less="Shake a shorter distance" more="Shake a longer distance" locked={locked} set={setA} />}
      </div>
      <Verdict marked={marked} text={text} />
    </div>
  )
}

function Verdict({ marked, text }: { marked: SceneMarked; text: string }) {
  if (marked === 'idle') return null
  return <p className="max-w-[340px] text-center text-[13px] font-extrabold leading-snug text-ss-ink">{text}</p>
}
