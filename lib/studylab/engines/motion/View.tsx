'use client'
import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import type { SceneViewProps } from '../types'
import type { MotionConfig, MotionState, Stage } from './config'
import {
  askedIndex, firstMiss, missSentence, positionsOf, recorded, stageName, stageSpans, storyLines, totalSeconds, trackLength,
} from './config'

// The caption under the picture uses the page's tokens, so it reads in light and dark.
const INK = 'var(--ss-ink)'
const PANEL = 'var(--ss-panel)'
const SUBJECT = 'var(--subject)'
const GOOD = 'var(--ss-good)'
const BAD = 'var(--ss-bad)'

// The picture sits on a quiet light plate in both themes, so it keeps its own colours.
const PLATE = '#F8FAFC'
const PLATE_EDGE = '#CBD5E1'
const DARK = '#334155'
const SOFT = '#475569'
const GRID_MINOR = '#E2E9F0'
const GRID_MAJOR = '#C3D0DC'
const TARGET = '#2F7FB8'
const TRACK_RED = '#CB6A4C'
const TRACK_EDGE = '#A4503A'
const INFIELD = '#8BB06A'
const SKIN = '#E2B48E'
const HAIR = '#4A3426'
const SHOE = '#F8FAFC'

export const W = 330
/** The track: metres run left to right. `y` is the line the runner's feet stand on. */
export const TRACK = { x0: 26, x1: 310, y: 70, h: 106, top: 46, bottom: 84 }
/** The graph's plot area, inside its axes. */
export const PLOT = { x0: 44, x1: 316, y0: 12, y1: 176, h: 208 }

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
export const gx = (t: number, total: number) => PLOT.x0 + (t / total) * (PLOT.x1 - PLOT.x0)
export const gy = (m: number, top: number) => PLOT.y1 - (m / top) * (PLOT.y1 - PLOT.y0)
export const tx = (m: number, top: number) => TRACK.x0 + (m / top) * (TRACK.x1 - TRACK.x0)

/**
 * Where each stage's number badge sits after marking: above the middle of its
 * own part of the line, so it is always nearer that part than any other.
 */
export function badgePositions(stages: Stage[], top: number): { x: number; y: number }[] {
  const total = totalSeconds(stages)
  const pos = positionsOf(stages)
  return stageSpans(stages).map((s, i) => {
    const mx = gx((s.from + s.to) / 2, total)
    const my = gy((pos[s.from] + pos[s.to]) / 2, top)
    const dx = stages[i].kind === 'out' ? -13 : stages[i].kind === 'back' ? 13 : 0
    const dy = stages[i].kind === 'rest' ? -15 : -9
    return { x: clamp(mx + dx, PLOT.x0 + 10, PLOT.x1 - 10), y: clamp(my + dy, PLOT.y0 + 10, PLOT.y1 - 10) }
  })
}

const stepEvery = (total: number) => (total <= 8 ? 1 : 2)

/** Graph paper: a white sheet, a fine grid every second and metre, a firmer line at each number. */
function Axes({ total, top }: { total: number; top: number }) {
  const every = stepEvery(total)
  const xs = Array.from({ length: Math.floor(total / every) + 1 }, (_, i) => i * every)
  const ys = Array.from({ length: top / 2 + 1 }, (_, i) => i * 2)
  const w = PLOT.x1 - PLOT.x0
  const h = PLOT.y1 - PLOT.y0
  return (
    <g fontSize={12} fill={SOFT}>
      <rect x={PLOT.x0} y={PLOT.y0} width={w} height={h} fill="#FFFFFF" />
      {Array.from({ length: total + 1 }, (_, t) => (
        <line key={`fx${t}`} x1={gx(t, total)} x2={gx(t, total)} y1={PLOT.y0} y2={PLOT.y1} stroke={GRID_MINOR} strokeWidth={1} />
      ))}
      {Array.from({ length: top + 1 }, (_, m) => (
        <line key={`fy${m}`} x1={PLOT.x0} x2={PLOT.x1} y1={gy(m, top)} y2={gy(m, top)} stroke={GRID_MINOR} strokeWidth={1} />
      ))}
      {xs.map((t) => (
        <g key={`x${t}`}>
          <line x1={gx(t, total)} x2={gx(t, total)} y1={PLOT.y0} y2={PLOT.y1} stroke={GRID_MAJOR} strokeWidth={1} />
          <text x={gx(t, total)} y={PLOT.y1 + 15} textAnchor="middle">{t}</text>
        </g>
      ))}
      {ys.map((m) => (
        <g key={`y${m}`}>
          <line x1={PLOT.x0} x2={PLOT.x1} y1={gy(m, top)} y2={gy(m, top)} stroke={GRID_MAJOR} strokeWidth={1} />
          <text x={PLOT.x0 - 6} y={gy(m, top) + 4} textAnchor="end">{m}</text>
        </g>
      ))}
      <rect x={PLOT.x0} y={PLOT.y0} width={w} height={h} fill="none" stroke={PLATE_EDGE} strokeWidth={1} />
      <line x1={PLOT.x0} x2={PLOT.x1} y1={PLOT.y1} y2={PLOT.y1} stroke={SOFT} strokeWidth={1.6} />
      <line x1={PLOT.x0} x2={PLOT.x0} y1={PLOT.y0} y2={PLOT.y1} stroke={SOFT} strokeWidth={1.6} />
      <text x={(PLOT.x0 + PLOT.x1) / 2} y={PLOT.h - 3} textAnchor="middle" fontWeight={700}>Time (s)</text>
      <text transform={`translate(12 ${(PLOT.y0 + PLOT.y1) / 2}) rotate(-90)`} textAnchor="middle" fontWeight={700}>Distance (m)</text>
    </g>
  )
}

const points = (ps: number[], total: number, top: number) => ps.map((m, t) => `${gx(t, total)},${gy(m, top)}`).join(' ')

/** A small runner seen from the side, facing right, feet on (0, 0): about 37 px tall. */
function Runner() {
  const limb = (d: string, w: number) => <path d={d} fill="none" stroke={SKIN} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
  return (
    <g transform="scale(1.35)">
      <ellipse cx={0} cy={1} rx={13} ry={2.2} fill="#7A3B2A" opacity={0.28} />
      {limb('M2 -24 L-3 -19 L-7 -23', 2.6)}
      {limb('M0 -15 L-6 -9 L-12 -6', 3.4)}
      <ellipse cx={-13} cy={-5} rx={3} ry={1.7} fill={SHOE} stroke={DARK} strokeWidth={0.8} transform="rotate(-20 -13 -5)" />
      <path d="M-2.5 -15.5 L1.5 -27 L6 -25.5 L3.5 -14.5 Z" fill={SUBJECT} stroke={DARK} strokeWidth={0.8} strokeLinejoin="round" />
      <path d="M-3.4 -16.5 L4.4 -16.5 L5.6 -12 L-1 -11 Z" fill={DARK} />
      {limb('M1 -13 L8 -10.5 L6.5 -1.5', 3.4)}
      <ellipse cx={8} cy={-1} rx={3.4} ry={1.8} fill={SHOE} stroke={DARK} strokeWidth={0.8} />
      <circle cx={6.5} cy={-31} r={4.3} fill={SKIN} />
      <path d="M2.3 -31 A4.3 4.3 0 0 1 10.6 -32.6 L7.2 -33.4 L4.4 -30.6 Z" fill={HAIR} />
      {limb('M4 -25 L9.5 -22 L12 -27.5', 2.6)}
    </g>
  )
}

/** The running track: a lane-marked red surface, a grass edge, a start line and a distance marker every 2 m. */
function Track({ top, at, label }: { top: number; at: number; label?: string }) {
  const x = tx(at, top)
  const lane = (TRACK.bottom - TRACK.top - 5) / 3
  const x0 = TRACK.x0 - 12
  const x1 = TRACK.x1 + 12
  const labelX = clamp(x, 22, W - 22)
  return (
    <g>
      <rect x={x0} y={TRACK.top} width={x1 - x0} height={TRACK.bottom - TRACK.top} rx={5} fill={TRACK_RED} stroke={TRACK_EDGE} strokeWidth={1} />
      <rect x={x0 + 0.5} y={TRACK.top + 0.5} width={x1 - x0 - 1} height={5} rx={2.5} fill={INFIELD} />
      {[0, 1, 2, 3].map((k) => (
        <line key={k} x1={x0 + 3} x2={x1 - 3} y1={TRACK.top + 5 + k * lane} y2={TRACK.top + 5 + k * lane} stroke="#FFFFFF" strokeWidth={k === 0 || k === 3 ? 1.8 : 1.3} opacity={0.92} />
      ))}
      {Array.from({ length: top / 2 + 1 }, (_, i) => i * 2).map((m) => (
        <g key={m}>
          <line x1={tx(m, top)} x2={tx(m, top)} y1={TRACK.top + 5} y2={TRACK.bottom} stroke="#FFFFFF" strokeWidth={m === 0 ? 3 : 1.5} opacity={m === 0 ? 0.95 : 0.6} />
          <line x1={tx(m, top)} x2={tx(m, top)} y1={TRACK.bottom + 1} y2={TRACK.bottom + 5} stroke={SOFT} strokeWidth={1.5} />
          <text x={tx(m, top)} y={TRACK.bottom + 18} textAnchor="middle" fontSize={12} fill={SOFT}>{m}</text>
        </g>
      ))}
      <text x={labelX} y={TRACK.top - 32} textAnchor="middle" fontSize={12} fontWeight={700} fill={DARK}>{label ?? `${at} m`}</text>
    </g>
  )
}

/** The caption shown once marked: what each stage was, numbered as on the graph. */
function Caption({ stages, children }: { stages: Stage[]; children?: ReactNode }) {
  return (
    <div className="text-[13px] leading-snug text-ss-ink">
      <ol className="flex flex-col gap-0.5">
        {stages.map((s, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[12px] font-extrabold" style={{ background: INK, color: PANEL }}>{i + 1}</span>
            <span>{stageName(s)[0].toUpperCase() + stageName(s).slice(1)} for {s.seconds} s</span>
          </li>
        ))}
      </ol>
      {children}
    </div>
  )
}

function Badges({ stages, top }: { stages: Stage[]; top: number }) {
  return (
    <g>
      {badgePositions(stages, top).map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={9} fill={DARK} stroke="#FFFFFF" strokeWidth={1.5} />
          <text x={p.x} y={p.y + 4.2} textAnchor="middle" fontSize={12} fontWeight={800} fill="#FFFFFF">{i + 1}</text>
        </g>
      ))}
    </g>
  )
}

const STEP = 'nodrag flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-lg border-2 border-ss-line bg-ss-panel text-[16px] font-extrabold leading-none text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'
const WORD = 'nodrag h-7 shrink-0 whitespace-nowrap rounded-lg border-2 border-ss-line bg-ss-panel px-3 text-[12px] font-bold text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'
const PANEL_BOX = 'flex flex-col gap-1 overflow-hidden rounded-2xl border-[1.5px] p-1.5'
const panelStyle = { background: PLATE, borderColor: PLATE_EDGE }

export function MotionView(props: SceneViewProps<MotionConfig, MotionState>) {
  return props.config.task.kind === 'read-speed' ? <ReadView {...props} /> : <WalkView {...props} />
}

/* ------------------------------------------------------------------ walk */

function WalkView({ config, state, setState, marked, reduced, locked }: SceneViewProps<MotionConfig, MotionState>) {
  const { kind, stages } = config.task
  const top = trackLength(stages)
  const total = totalSeconds(stages)
  const target = positionsOf(stages)
  const d = recorded(state, top)
  const n = d.length - 1
  const at = clamp(typeof state?.at === 'number' && Number.isInteger(state.at) ? state.at : d[n], 0, top)
  const named = marked !== 'idle'
  const showTarget = kind === 'walk-graph' || named
  const done = n >= total
  const hintId = useId()
  const svg = useRef<SVGSVGElement>(null)
  const [dragging, setDragging] = useState(false)
  const [focused, setFocused] = useState(false)
  const [frac, setFrac] = useState(0)
  const live = useRef({ state, setState, d, at, n, total, top })
  live.current = { state, setState, d, at, n, total, top }

  // While the runner is held, the clock runs: each whole second records where the runner is.
  useEffect(() => {
    if (!dragging) { setFrac(0); return }
    let t0 = performance.now()
    const id = setInterval(() => {
      const L = live.current
      const now = performance.now()
      if (L.n >= L.total) { setDragging(false); return }
      if (now - t0 >= 1000) {
        t0 += 1000
        L.setState({ d: [...L.d, L.at], at: L.at })
        if (L.n + 1 >= L.total) setDragging(false)
        setFrac(0)
      } else setFrac(reduced ? 0 : (now - t0) / 1000)
    }, 100)
    return () => clearInterval(id)
  }, [dragging, reduced])

  const move = (to: number) => { if (!locked) setState({ d, at: clamp(Math.round(to), 0, top) }) }
  const fromPointer = (e: PointerEvent) => {
    const el = svg.current
    const m = el?.getScreenCTM()
    if (!el || !m) return
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse())
    move(((p.x - TRACK.x0) / (TRACK.x1 - TRACK.x0)) * top)
  }
  const tick = () => { if (!locked && n < total) setState({ d: [...d, at], at }) }
  const undo = () => { if (!locked && n > 0) setState({ d: d.slice(0, -1), at: d[n - 1] }) }
  const onKey = (e: KeyboardEvent) => {
    const act: Record<string, () => void> = {
      ArrowRight: () => move(at + 1), ArrowUp: () => move(at + 1), ArrowLeft: () => move(at - 1), ArrowDown: () => move(at - 1),
      Enter: tick, ' ': tick, Backspace: undo, Delete: undo,
    }
    const f = act[e.key]
    if (!f) return
    // The board moves a selected card with the arrows; here they move the runner.
    e.preventDefault()
    e.stopPropagation()
    f()
  }

  const miss = firstMiss(stages, d)
  const pending = !done && !locked
  const px = n + (dragging && !reduced ? frac : 1)
  const traceColour = marked === 'right' ? GOOD : SUBJECT
  const movable = !(locked || done)

  return (
    <div className="nodrag flex w-full max-w-[400px] flex-col gap-2">
      {kind === 'walk-story' && !named && (
        <ul className="flex flex-col gap-0.5 text-[13.5px] leading-snug text-ss-ink">
          {storyLines(stages).map((line, i) => <li key={i}>{line}</li>)}
        </ul>
      )}
      <figure className="flex flex-col gap-1.5">
        <div className={PANEL_BOX} style={panelStyle}>
          <svg
            ref={svg}
            viewBox={`0 0 ${W} ${TRACK.h}`}
            className="block w-full touch-none select-none"
            role="group"
            aria-label={`A running track from 0 to ${top} metres`}
            onPointerMove={(e) => dragging && fromPointer(e)}
            onPointerUp={() => setDragging(false)}
            onPointerCancel={() => setDragging(false)}
          >
            <Track top={top} at={at} />
            <g
              role="slider"
              tabIndex={locked ? -1 : 0}
              aria-label="The runner. Hold it and move it along the track while the clock runs; or use the arrow keys to place it and Enter for the next second"
              aria-describedby={hintId}
              aria-valuemin={0}
              aria-valuemax={top}
              aria-valuenow={at}
              aria-valuetext={`${at} metres, ${n} of ${total} seconds recorded`}
              aria-disabled={locked || undefined}
              onKeyDown={onKey}
              onFocus={(e) => setFocused(e.currentTarget.matches(':focus-visible'))}
              onBlur={() => setFocused(false)}
              onPointerDown={(e) => {
                if (locked || done) return
                ;(e.currentTarget.ownerSVGElement ?? e.currentTarget).setPointerCapture?.(e.pointerId)
                setDragging(true)
                fromPointer(e)
              }}
              className={`outline-none ${movable ? (dragging ? 'cursor-grabbing' : 'cursor-grab') : ''}`}
              transform={`translate(${tx(at, top)} ${TRACK.y})`}
            >
              <rect x={-28} y={-60} width={56} height={70} fill="transparent" />
              {movable && (
                <g fill="#FFFFFF" opacity={0.95}>
                  <path d="M-29 -4 L-24 -8 L-24 0 Z" />
                  <path d="M29 -4 L24 -8 L24 0 Z" />
                </g>
              )}
              {(focused || dragging) && <rect x={-22} y={-54} width={44} height={62} rx={10} fill="none" stroke={SUBJECT} strokeWidth={2.5} />}
              <Runner />
            </g>
          </svg>

          <svg viewBox={`0 0 ${W} ${PLOT.h}`} className="block w-full select-none" role="img"
            aria-label={`Distance-time graph, 0 to ${total} seconds across and 0 to ${top} metres up. ${n} of ${total} seconds drawn from the runner's movement.${showTarget ? ' A dashed path shows the journey to follow.' : ''}`}>
            <Axes total={total} top={top} />
            {showTarget && <polyline points={points(target, total, top)} fill="none" stroke={TARGET} strokeWidth={2.5} strokeDasharray="7 5" strokeLinecap="round" strokeLinejoin="round" />}
            {n > 0 && <polyline points={points(d, total, top)} fill="none" stroke={traceColour} strokeWidth={4.5} strokeLinejoin="round" strokeLinecap="round" />}
            {d.map((m, t) => <circle key={t} cx={gx(t, total)} cy={gy(m, top)} r={t === 0 ? 4.5 : 3.5} fill={traceColour} stroke="#FFFFFF" strokeWidth={1.2} />)}
            {named && <Badges stages={stages} top={top} />}
            {pending && (
              <g>
                <line x1={gx(n, total)} y1={gy(d[n], top)} x2={gx(px, total)} y2={gy(at, top)} stroke={SUBJECT} strokeWidth={2.5} strokeDasharray="3 4" strokeLinecap="round" />
                <circle cx={gx(px, total)} cy={gy(at, top)} r={5.5} fill="#FFFFFF" stroke={SUBJECT} strokeWidth={2.5} />
              </g>
            )}
            {marked === 'wrong' && miss && <circle cx={gx(miss.second, total)} cy={gy(miss.was, top)} r={9} fill="none" stroke={BAD} strokeWidth={3} />}
          </svg>
        </div>
        <figcaption id={hintId} aria-live="polite" className="text-center text-[12px] font-bold text-ss-slate">
          {focused ? 'Arrows place the runner. Enter records the next second. Backspace undoes one.' : 'Hold the runner and slide it; the clock runs while you hold it.'}
        </figcaption>
      </figure>

      <div className="flex min-h-7 items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-bold text-ss-slate">Clock</span>
          <span className="text-[15px] font-extrabold tabular-nums text-ss-ink">{n} of {total} s</span>
        </div>
        {n > 0 && !locked && (
          <button type="button" className={WORD} aria-label="Start again and clear the recorded seconds" onClick={() => { setDragging(false); setState({ d: [0], at: 0 }) }}>Start again</button>
        )}
      </div>

      {named && (
        <Caption stages={stages}>
          {marked === 'wrong' && <p className="mt-1.5 font-bold text-ss-bad">{missSentence(stages, d)}</p>}
        </Caption>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ read */

function ReadView({ config, state, setState, marked, locked }: SceneViewProps<MotionConfig, MotionState>) {
  const { stages } = config.task
  const top = trackLength(stages)
  const total = totalSeconds(stages)
  const pos = positionsOf(stages)
  const ask = askedIndex(config)
  const span = stageSpans(stages)[ask]
  const asked = stages[ask]
  const inSpan = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) ? clamp(v, span.from, span.to) : span.from)
  const a = inSpan(state?.a)
  const b = inSpan(state?.b)
  const answer = typeof state?.answer === 'number' ? state.answer : null
  const named = marked !== 'idle'
  const svg = useRef<SVGSVGElement>(null)
  const [active, setActive] = useState<'a' | 'b' | null>(null)
  const [focus, setFocus] = useState<'a' | 'b' | null>(null)

  const set = (which: 'a' | 'b', t: number) => { if (!locked) setState({ a, b, answer, [which]: clamp(Math.round(t), span.from, span.to) }) }
  const fromPointer = (e: PointerEvent, which: 'a' | 'b') => {
    const el = svg.current
    const m = el?.getScreenCTM()
    if (!el || !m) return
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse())
    set(which, ((p.x - PLOT.x0) / (PLOT.x1 - PLOT.x0)) * total)
  }
  const onKey = (which: 'a' | 'b') => (e: KeyboardEvent) => {
    const t = which === 'a' ? a : b
    const to = { ArrowRight: t + 1, ArrowUp: t + 1, ArrowLeft: t - 1, ArrowDown: t - 1, Home: span.from, End: span.to }[e.key]
    if (to === undefined) return
    e.preventDefault()
    e.stopPropagation()
    set(which, to)
  }
  const step = (by: number) => { if (!locked) setState({ a, b, answer: clamp((answer ?? 0) + by, 0, 8) }) }

  const lo = Math.min(a, b)
  const hi = Math.max(a, b)
  const run = hi - lo
  const rise = Math.abs(pos[hi] - pos[lo])
  const rising = pos[hi] >= pos[lo]
  const corner = { x: gx(hi, total), y: gy(pos[lo], top) }
  const runner = pos[b]

  const flag = (which: 'a' | 'b') => {
    const t = which === 'a' ? a : b
    const colour = which === 'a' ? DARK : SUBJECT
    return (
      <g
        key={which}
        role="slider"
        tabIndex={locked ? -1 : 0}
        aria-label={which === 'a' ? 'First flag on the bold part of the line. Move it along with the arrow keys' : 'Second flag on the bold part of the line. Move it along with the arrow keys'}
        aria-valuemin={span.from}
        aria-valuemax={span.to}
        aria-valuenow={t}
        aria-valuetext={`${t} seconds, where the runner is ${pos[t]} metres from the start`}
        aria-disabled={locked || undefined}
        onKeyDown={onKey(which)}
        onFocus={() => setFocus(which)}
        onBlur={() => setFocus(null)}
        onPointerDown={(e) => {
          if (locked) return
          ;(e.currentTarget.ownerSVGElement ?? e.currentTarget).setPointerCapture?.(e.pointerId)
          setActive(which)
          fromPointer(e, which)
        }}
        className={`outline-none ${locked ? '' : active === which ? 'cursor-grabbing' : 'cursor-grab'}`}
        transform={`translate(${gx(t, total)} ${gy(pos[t], top)})`}
      >
        <circle r={22} fill="transparent" />
        {focus === which && <circle r={15} fill="none" stroke={SUBJECT} strokeWidth={2.5} />}
        <line x1={0} x2={0} y1={0} y2={-17} stroke={colour} strokeWidth={1.8} strokeLinecap="round" />
        <path d="M0.9 -17 L10 -13.5 L0.9 -10 Z" fill={colour} stroke="#FFFFFF" strokeWidth={0.8} strokeLinejoin="round" />
        <circle r={6.5} fill="#FFFFFF" stroke={colour} strokeWidth={2.6} />
      </g>
    )
  }

  const rightEdge = gx(hi, total) > PLOT.x1 - 40

  return (
    <div className="nodrag flex w-full max-w-[400px] flex-col gap-2">
      <figure className="flex flex-col gap-1.5">
        <div className={PANEL_BOX} style={panelStyle}>
          <svg viewBox={`0 0 ${W} ${TRACK.h}`} className="block w-full select-none" role="img" aria-label={`A running track from 0 to ${top} metres. The runner is ${runner} metres along at the second flag's time.`}>
            <Track top={top} at={runner} />
            <g transform={`translate(${tx(runner, top)} ${TRACK.y})`}><Runner /></g>
          </svg>

          <svg
            ref={svg}
            viewBox={`0 0 ${W} ${PLOT.h}`}
            className="block w-full touch-none select-none"
            role="group"
            aria-label={`Distance-time graph, 0 to ${total} seconds across and 0 to ${top} metres up. The bold part of the line is the part to measure.`}
            onPointerMove={(e) => active && fromPointer(e, active)}
            onPointerUp={() => setActive(null)}
            onPointerCancel={() => setActive(null)}
          >
            <Axes total={total} top={top} />
            <polyline points={points(pos, total, top)} fill="none" stroke={SOFT} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
            <polyline points={pos.slice(span.from, span.to + 1).map((m, i) => `${gx(span.from + i, total)},${gy(m, top)}`).join(' ')} fill="none" stroke={SUBJECT} strokeWidth={6} strokeLinecap="round" />
            {named && <Badges stages={stages} top={top} />}
            {run > 0 && (
              <g fontSize={12} fontWeight={700} fill={DARK}>
                <polyline points={`${gx(lo, total)},${gy(pos[lo], top)} ${corner.x},${corner.y} ${gx(hi, total)},${gy(pos[hi], top)}`} fill="none" stroke={DARK} strokeWidth={1.8} strokeDasharray="5 4" strokeLinejoin="round" />
                {/* Below the leg, unless that lands on the axis numbers: then inside the triangle, beside the rise. */}
                {rising && corner.y < PLOT.y1 - 30
                  ? <text x={(gx(lo, total) + corner.x) / 2} y={corner.y + 17} textAnchor="middle">{run} s</text>
                  : <text x={rising ? corner.x - 5 : (gx(lo, total) + corner.x) / 2} y={corner.y - 7} textAnchor={rising ? 'end' : 'middle'}>{run} s</text>}
                <text x={rightEdge ? corner.x - 7 : corner.x + 7} y={(corner.y + gy(pos[hi], top)) / 2 + 4} textAnchor={rightEdge ? 'end' : 'start'}>{rise} m</text>
              </g>
            )}
            {flag('a')}
            {flag('b')}
          </svg>
        </div>
        <figcaption className="text-center text-[12px] font-bold text-ss-slate">
          Place the flags on the bold line, then read the speed.
        </figcaption>
      </figure>

      <div className="flex min-h-7 items-center justify-between gap-1.5">
        <span className="text-[12px] font-bold text-ss-slate">Speed</span>
        <span className="flex items-center gap-1">
          <button type="button" className={STEP} onClick={() => step(-1)} disabled={locked || answer === 0} aria-label="Lower the speed by 1 metre per second">{'−'}</button>
          <span className="min-w-[64px] text-center text-[15px] font-extrabold tabular-nums text-ss-ink" aria-live="polite">{answer === null ? '?' : answer} m/s</span>
          <button type="button" className={STEP} onClick={() => step(1)} disabled={locked || answer === 8} aria-label="Raise the speed by 1 metre per second">+</button>
        </span>
      </div>

      {named && (
        <Caption stages={stages}>
          <p className={`mt-1.5 font-bold ${marked === 'wrong' ? 'text-ss-bad' : 'text-ss-good'}`}>
            {marked === 'wrong' && answer !== null && `You said ${answer} m/s. `}
            {`Stage ${ask + 1} covers ${Math.abs(pos[span.to] - pos[span.from])} m in ${asked.seconds} s: ${asked.speed} m/s.`}
          </p>
        </Caption>
      )}
    </div>
  )
}
