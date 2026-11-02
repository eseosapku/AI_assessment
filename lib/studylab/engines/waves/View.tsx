'use client'
import { useEffect, useRef, type KeyboardEvent } from 'react'
import type { SceneMarked, SceneViewProps } from '../types'
import type { WavesConfig, WavesState } from './config'
import {
  AMP_MAX, FREQ_MAX, FREQ_MIN, JOIN, ROPE_LENGTH, SLOW_AMP, SLOW_FREQ_MAX, madeText, made, working,
} from './config'

type Props = SceneViewProps<WavesConfig, WavesState>

// The scene's own inks: flat solid colours, each over 3:1 on the card in both themes.
const PALETTE =
  '[--wv-rope:#1D4ED8] [--wv-dot:#C2410C] [--wv-target:#15803D] ' +
  'dark:[--wv-rope:#93C5FD] dark:[--wv-dot:#FDBA74] dark:[--wv-target:#86EFAC]'
const INK = 'var(--ss-ink, #16202A)'
const PANEL = 'var(--ss-panel, #FFFFFF)'
const ROPE = 'var(--wv-rope, #1D4ED8)'
const DOT = 'var(--wv-dot, #C2410C)'
const TARGET = 'var(--wv-target, #15803D)'
const HALO = { stroke: PANEL, strokeWidth: 4, paintOrder: 'stroke', strokeLinejoin: 'round' } as const

// ---------------------------------------------------------------------------
// Geometry (viewBox pixels). Exported for the tests.

export const W = 360
export const H = 270
export const X0 = 24
export const X1 = 336
// 12 = ROPE_LENGTH; written out because config.ts and this file import each other (the test checks they agree).
export const PX_PER_M = (X1 - X0) / 12
export const PX_PER_AMP = 12
export const TARGET_Y = 70
export const ROPE_Y = 184
export const LABEL_A = 246
export const LABEL_B = 264
/** Pictures run slower than life, so the eye can follow: the wave crosses the rope in a few seconds. */
export const TIME_SCALE = 0.25
export const STILL_PHASE = 0.9

const TAU = Math.PI * 2
const SPEED = { thin: 12, thick: 6 }
const xOf = (m: number) => X0 + m * PX_PER_M

/** The wave at `m` metres along the rope, for `f` shakes a second, as a unit height (-1..1). */
export function unitWave(task: WavesConfig['task'], f: number, m: number, phase: number): number {
  const turns = task === 'slow' && m > JOIN
    ? (f * JOIN) / SPEED.thin + (f * (m - JOIN)) / SPEED.thick
    : (f * m) / SPEED.thin
  return Math.sin(phase - TAU * turns)
}

/** Where the dots sit: one on the rope for the match task, one on each rope for the slow task. */
export const dotsOf = (task: WavesConfig['task']) => (task === 'slow' ? [3, 9] : [6])

function ropePath(task: WavesConfig['task'], f: number, a: number, phase: number, from = 0, to = ROPE_LENGTH, y0 = ROPE_Y): string {
  const parts: string[] = []
  const step = 0.15 // metres: about 4 px, so the line is smooth
  for (let m = from; m <= to + 1e-9; m += step) {
    parts.push(`${parts.length ? 'L' : 'M'}${xOf(m).toFixed(1)} ${(y0 - a * PX_PER_AMP * unitWave(task, f, m, phase)).toFixed(1)}`)
  }
  return parts.join('')
}

/** The target: the wave that has to be made, fixed on the page. */
export function targetPath(config: WavesConfig): string {
  if (config.task === 'slow') {
    // Drawn over the thick rope only, as the wave there would look.
    const parts: string[] = []
    for (let m = JOIN; m <= ROPE_LENGTH + 1e-9; m += 0.15) {
      const y = TARGET_Y - SLOW_AMP * PX_PER_AMP * Math.sin(TAU * (config.frequency * (m - JOIN)) / SPEED.thick)
      parts.push(`${parts.length ? 'L' : 'M'}${xOf(m).toFixed(1)} ${y.toFixed(1)}`)
    }
    return parts.join('')
  }
  const parts: string[] = []
  for (let m = 0; m <= ROPE_LENGTH + 1e-9; m += 0.15) {
    const y = TARGET_Y - config.amplitude * PX_PER_AMP * Math.sin(TAU * (config.frequency * m) / SPEED.thin)
    parts.push(`${parts.length ? 'L' : 'M'}${xOf(m).toFixed(1)} ${y.toFixed(1)}`)
  }
  return parts.join('')
}

/** The labels under the picture, with where each starts and how much room its words take. */
export function bottomLabels(task: WavesConfig['task']): { text: string; x: number; row: 'A' | 'B'; anchor: 'start' | 'middle' | 'end'; wide: number }[] {
  const width = (s: string) => Math.ceil(s.length * 7.4)
  const dots = dotsOf(task).map((m) => ({ text: 'orange dot', x: xOf(m), row: 'A' as const, anchor: 'middle' as const, wide: width('orange dot') }))
  const hand = { text: 'hand', x: 4, row: 'A' as const, anchor: 'start' as const, wide: width('hand') }
  const rope = task === 'slow'
    ? [
        { text: 'thin rope', x: xOf(JOIN / 2), row: 'B' as const, anchor: 'middle' as const, wide: width('thin rope') },
        { text: 'thick rope', x: xOf((JOIN + ROPE_LENGTH) / 2), row: 'B' as const, anchor: 'middle' as const, wide: width('thick rope') },
      ]
    : [{ text: 'blue rope', x: xOf(ROPE_LENGTH / 2), row: 'B' as const, anchor: 'middle' as const, wide: width('blue rope') }]
  return [hand, ...dots, ...rope]
}

/** The spans of x each label covers, so a test can prove none touch another on its row. */
export function labelSpans(task: WavesConfig['task']) {
  return bottomLabels(task).map((l) => {
    const left = l.anchor === 'start' ? l.x : l.anchor === 'end' ? l.x - l.wide : l.x - l.wide / 2
    return { text: l.text, row: l.row, left, right: left + l.wide }
  })
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

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
  return `A rope shaken at its left end by a hand. The wave travels to the right, ${crests}. ${config.task === 'slow' ? 'The rope is thin on the left and thick on the right. A dashed green wave above the thick part shows the wave to make. ' : 'A dashed green wave above the rope shows the wave to make. '}Orange dot${config.task === 'slow' ? 's' : ''} on the rope only move up and down.`
}

export function WavesView({ config, state, setState, marked, reduced, locked }: Props) {
  const { f, a } = made(state, config)
  const slow = config.task === 'slow'
  const svgRef = useRef<SVGSVGElement>(null)
  const live = useRef({ f, a, task: config.task })
  live.current = { f, a, task: config.task }
  // What is drawn eases toward what is set, so a tap is seen happening over about a second.
  const shown = useRef({ f, a, phase: STILL_PHASE })

  const paint = () => {
    const svg = svgRef.current
    if (!svg) return
    const { f: sf, a: sa, phase } = shown.current
    const task = live.current.task
    svg.querySelector('[data-rope]')?.setAttribute('d', slow ? ropePath(task, sf, sa, phase, 0, JOIN) : ropePath(task, sf, sa, phase))
    if (slow) svg.querySelector('[data-rope2]')?.setAttribute('d', ropePath(task, sf, sa, phase, JOIN, ROPE_LENGTH))
    const hand = svg.querySelector('[data-hand]')
    hand?.setAttribute('cy', (ROPE_Y - sa * PX_PER_AMP * unitWave(task, sf, 0, phase)).toFixed(1))
    dotsOf(task).forEach((m, i) => {
      const y = (ROPE_Y - sa * PX_PER_AMP * unitWave(task, sf, m, phase)).toFixed(1)
      svg.querySelector(`[data-dot="${i}"]`)?.setAttribute('cy', y)
    })
  }

  useEffect(() => {
    if (reduced) {
      // One still frame, redrawn on each tap; nothing moves by itself.
      shown.current = { f, a, phase: STILL_PHASE }
      paint()
      return
    }
    let raf = 0
    let last = 0
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick)
      if (!last) last = t
      const dt = Math.min(0.1, (t - last) / 1000)
      last = t
      const k = 1 - Math.exp(-dt / 0.4)
      const s = shown.current
      s.f += (live.current.f - s.f) * k
      s.a += (live.current.a - s.a) * k
      s.phase += TAU * s.f * TIME_SCALE * dt
      paint()
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, f, a, config.task])

  const setF = (v: number) => { if (!locked) setState(slow ? { f: clamp(v, FREQ_MIN, SLOW_FREQ_MAX) } : { f: clamp(v, FREQ_MIN, FREQ_MAX), a }) }
  const setA = (v: number) => { if (!locked) setState({ f, a: clamp(v, 1, AMP_MAX) }) }

  // The board moves cards with the arrow keys; inside the card they belong to the card.
  const onKey = (e: KeyboardEvent) => { if (e.key.startsWith('Arrow')) e.stopPropagation() }

  const good = marked === 'right' || marked === 'shown'
  const text = good ? working(config) : marked === 'wrong' ? madeText(config, state) : ''
  const ropeD = slow ? ropePath(config.task, f, SLOW_AMP, STILL_PHASE, 0, JOIN) : ropePath(config.task, f, a, STILL_PHASE)
  const rope2D = slow ? ropePath(config.task, f, SLOW_AMP, STILL_PHASE, JOIN, ROPE_LENGTH) : ''
  const shownA = slow ? SLOW_AMP : a
  const handY = ROPE_Y - shownA * PX_PER_AMP * unitWave(config.task, f, 0, STILL_PHASE)
  const labels = bottomLabels(config.task)

  return (
    <div className={`nodrag flex flex-col items-center gap-2 ${PALETTE}`} onKeyDown={onKey}>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={describe(config, f)} className="block h-auto w-full max-w-[360px]">
        {/* the target, dashed green, above the rope */}
        <path d={targetPath(config)} fill="none" stroke={TARGET} strokeWidth={4} strokeDasharray="9 7" strokeLinecap="round" strokeLinejoin="round" />
        <text x={4} y={14} fontSize={13} fontWeight={800} fill={TARGET} style={HALO}>make this wave</text>
        {/* a thin line through each dot: it only goes up and down */}
        {dotsOf(config.task).map((m) => (
          <line key={m} x1={xOf(m)} x2={xOf(m)} y1={ROPE_Y - 4 * PX_PER_AMP - 16} y2={LABEL_A - 14} stroke={DOT} strokeWidth={2} strokeDasharray="2 5" strokeLinecap="round" />
        ))}
        {/* the rope */}
        <path data-rope d={ropeD} fill="none" stroke={ROPE} strokeWidth={slow ? 3 : 5} strokeLinecap="round" strokeLinejoin="round" />
        {slow && <path data-rope2 d={rope2D} fill="none" stroke={ROPE} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" />}
        {/* the hand */}
        <circle data-hand cx={X0} cy={handY} r={10} fill={PANEL} stroke={INK} strokeWidth={3} />
        {dotsOf(config.task).map((m, i) => (
          <circle key={m} data-dot={i} cx={xOf(m)} cy={ROPE_Y - shownA * PX_PER_AMP * unitWave(config.task, f, m, STILL_PHASE)} r={9} fill={DOT} stroke={PANEL} strokeWidth={2.5} />
        ))}
        {labels.map((l) => (
          <text key={`${l.text}${l.x}`} x={l.x} y={l.row === 'A' ? LABEL_A : LABEL_B} textAnchor={l.anchor} fontSize={13} fontWeight={800} fill={l.text === 'orange dot' ? DOT : l.text === 'hand' ? INK : ROPE} style={HALO}>{l.text}</text>
        ))}
      </svg>
      <div className={slow ? 'flex w-full max-w-[360px] justify-center' : 'grid w-full max-w-[360px] grid-cols-2'}>
        <Control name="How fast you shake" level={f} min={FREQ_MIN} max={slow ? SLOW_FREQ_MAX : FREQ_MAX} less="Shake slower" more="Shake faster" locked={locked} set={setF} />
        {!slow && <Control name="How far you shake" level={a} min={1} max={AMP_MAX} less="Shake a shorter distance" more="Shake a longer distance" locked={locked} set={setA} />}
      </div>
      <Verdict marked={marked} text={text} />
    </div>
  )
}

function Verdict({ marked, text }: { marked: SceneMarked; text: string }) {
  if (marked === 'idle') return null
  return <p className="max-w-[340px] text-center text-[13px] font-extrabold leading-snug text-ss-ink">{text}</p>
}
