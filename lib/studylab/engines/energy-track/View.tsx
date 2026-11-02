'use client'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { SceneViewProps } from '../types'
import type { EnergyTrackConfig, EnergyTrackState } from './config'
import { advance, endX, energyTrackEngine, heightAt, madeReach, madeRelease, madeRough, madeText, startX, stores, working } from './config'

type Props = SceneViewProps<EnergyTrackConfig, EnergyTrackState>

// One scene look in both themes: a flat dark stage. Flat colours only, every one named on the card.
const ROOM = '#0F1722'
const WHITE = '#F2F5F8'
const DIM = '#93A3B5'
const HEIGHT = '#5BB8F5'
const MOTION = '#FFD23F'
const HEAT = '#FF8A4C'
const FLAG = '#5FD38D'
const HALO = { stroke: ROOM, strokeWidth: 4, paintOrder: 'stroke', strokeLinejoin: 'round' } as const

// The stage, in pixels. The track is drawn in marks: one mark is UX across and UY up. These agree with config.ts
// (WALL 9, FLOOR 7) and a test holds them together: View cannot read config's constants at load time.
export const W = 360
export const H = 270
export const UX = 8
export const UY = 15
export const X0 = 10
export const BASE = 222
export const BAR_UNIT = 15
export const BAR_X = [246, 294, 340]
const BAR_W = 24

export type Pt = { x: number; y: number }
export type Label = { text: string; x: number; y: number; anchor: 'start' | 'middle' | 'end'; part: Pt }

const f1 = (n: number) => n.toFixed(1)
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
/** A point on the track, x in marks along it. */
export const px = (x: number) => X0 + UX * x
export const py = (h: number) => BASE - UY * h
const radiusOf = (config: EnergyTrackConfig) => (config.ball === 'heavy' ? 12 : 8)

/** The ball's centre when it is x marks along the track: resting on the surface, rolling round the corners. */
export function ballAt(config: EnergyTrackConfig, x: number): Pt {
  const R = radiusOf(config)
  const left = clamp((9 + 0.4 - x) / 0.8, 0, 1)
  const right = clamp((x - (16 - 0.4)) / 0.8, 0, 1)
  const nx = 0.88 * (left - right)
  const ny = Math.sqrt(1 - nx * nx)
  return { x: px(x) + R * nx, y: py(heightAt(x)) - R * ny }
}

export function labelsFor(config: EnergyTrackConfig, state: EnergyTrackState, withBall: boolean): Label[] {
  const release = madeRelease(config, state)
  const R = radiusOf(config)
  const c = ballAt(config, startX(release))
  const flagAt = 16 + config.flag
  const pole: Pt = { x: px(flagAt), y: py(config.flag) }
  const labels: Label[] = []
  if (withBall) labels.push({ text: config.ball === 'heavy' ? 'heavy ball' : 'ball', x: Math.max(4, c.x - 8), y: c.y - R - 6, anchor: 'start', part: c })
  labels.push(
    { text: 'flag', x: pole.x + 10, y: pole.y - 36, anchor: 'middle', part: { x: pole.x + 6, y: pole.y - 22 } },
    { text: 'floor', x: (px(9) + px(16)) / 2, y: BASE + 36, anchor: 'middle', part: { x: (px(9) + px(16)) / 2, y: BASE + 4 } },
    { text: 'height', x: BAR_X[0], y: BASE + 18, anchor: 'middle', part: { x: BAR_X[0], y: BASE - 6 } },
    { text: 'motion', x: BAR_X[1], y: BASE + 18, anchor: 'middle', part: { x: BAR_X[1], y: BASE - 6 } },
    { text: 'heat', x: BAR_X[2], y: BASE + 18, anchor: 'middle', part: { x: BAR_X[2], y: BASE - 6 } },
  )
  return labels
}

export function totalLine(config: EnergyTrackConfig, state: EnergyTrackState) {
  const mass = config.ball === 'heavy' ? 1.5 : 1
  const y = BASE - madeRelease(config, state) * mass * BAR_UNIT
  return { y, label: { text: 'total', x: 222, y: y - 6, anchor: 'start' as const, part: { x: 241, y } } }
}

function describe(config: EnergyTrackConfig, state: EnergyTrackState): string {
  const up = madeReach(config, state)
  const where = up === config.flag ? 'climbs exactly to the flag' : up > config.flag ? 'climbs above the flag' : 'stops below the flag'
  return `A ball on a track: a hill on the left, a floor, a hill on the right with a flag. Three bars called height, motion and heat show where the ball's energy is, and a dashed line shows the total. The ball ${where}.`
}

// ---------------------------------------------------------------------------
// The run: wait, roll, hold, again. Calm, at a walking pace.

const WAIT = 0.8
const HOLD = 1.6

function useRun(config: EnergyTrackConfig, release: number, rough: number, reduced: boolean) {
  const [at, setAt] = useState({ x: startX(release), waiting: true })
  useEffect(() => {
    const begin = startX(release)
    setAt({ x: begin, waiting: true })
    if (reduced) return
    let raf = 0
    let last = 0
    let phase: 'wait' | 'run' | 'hold' = 'wait'
    let clock = 0
    let x = begin
    const stop = endX(release, rough)
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick)
      const dt = last ? Math.min(0.05, (t - last) / 1000) : 0.016
      last = t
      clock += dt
      if (phase === 'wait' && clock >= WAIT) { phase = 'run'; clock = 0 }
      else if (phase === 'run') {
        x = advance(release, rough, x, dt)
        if (x >= stop) { phase = 'hold'; clock = 0 }
        setAt({ x, waiting: false })
      } else if (phase === 'hold' && clock >= HOLD) {
        phase = 'wait'; clock = 0; x = begin
        setAt({ x, waiting: true })
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [config, release, rough, reduced])
  return at
}

// ---------------------------------------------------------------------------

function Names({ labels }: { labels: Label[] }) {
  return (
    <g aria-hidden="true">
      {labels.map((l) => (
        <text key={l.text} x={f1(l.x)} y={f1(l.y)} textAnchor={l.anchor} fontSize={14} fontWeight={700} fill={WHITE} style={HALO}>{l.text}</text>
      ))}
    </g>
  )
}

const Round = ({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: string }) => (
  <button
    type="button" aria-label={label} disabled={disabled} onClick={onClick}
    style={{ width: 48, height: 48, borderRadius: 24, fontSize: 26, fontWeight: 700, lineHeight: 1, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.35 : 1 }}
    className="flex h-12 w-12 select-none items-center justify-center rounded-full border border-ss-line bg-ss-chip text-[26px] font-bold leading-none text-ss-ink outline-none focus-visible:ring-2 focus-visible:ring-ss-ink disabled:opacity-35"
  >
    {children}
  </button>
)

export function EnergyTrackView({ config, state, setState, marked, reduced, locked }: Props) {
  const now = marked === 'shown' ? energyTrackEngine.solve(config) : state
  const release = madeRelease(config, now)
  const rough = madeRough(config, now)
  const up = madeReach(config, now)
  const mass = config.ball === 'heavy' ? 1.5 : 1
  const R = radiusOf(config)
  const run = useRun(config, release, rough, reduced)
  const isRelease = config.task === 'release'
  const value = isRelease ? release : rough
  const lo = isRelease ? 1 : 0
  const hi = isRelease ? 9 : 4
  const set = (v: number) => {
    const next = clamp(v, lo, hi)
    if (!locked && next !== value) setState(isRelease ? { release: next } : { rough: next })
  }
  const end = endX(release, rough)
  // Under reduced motion the still frame is the result of the run: the ball where it begins, a ghost where it turns, the bars at that moment.
  const x = reduced ? end : run.x
  const bars = stores(release, rough, mass, x)
  const ball = ballAt(config, reduced ? startX(release) : run.x)
  const ghost = ballAt(config, end)
  const flagLit = up === config.flag && (reduced || run.x >= end - 0.001)
  const top = totalLine(config, now)
  const showBall = reduced || run.waiting
  const labels = labelsFor(config, now, showBall)
  const flag: Pt = { x: px(16 + config.flag), y: py(config.flag) }
  const said = marked === 'right' || marked === 'shown' ? working(config, now) : marked === 'wrong' ? madeText(config, now) : ''
  const reachText = up === config.flag ? 'The ball climbs to the flag.' : up > config.flag ? 'The ball climbs above the flag.' : 'The ball stops short of the flag.'

  const key = (e: KeyboardEvent) => {
    const d = ({ ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 } as Record<string, number>)[e.key]
    if (!d) return
    e.preventDefault()
    e.stopPropagation()
    set(value + d)
  }

  return (
    <div className="nodrag flex flex-col items-center gap-2 [&:has(:focus-visible)_.et-kbd]:block" onKeyDown={key}>
      <svg
        viewBox={`0 0 ${W} ${H}`} role="img" aria-label={describe(config, now)}
        className="block h-auto w-full max-w-[360px] select-none" style={{ background: ROOM, borderRadius: 14 }}
      >
        {/* tick marks up both hills: one per mark of height */}
        <g stroke={DIM} strokeWidth={1.5} strokeLinecap="round">
          {Array.from({ length: 9 }, (_, k) => k + 1).map((h) => (
            <g key={h}>
              <line x1={f1(px(9 - h) - 7)} y1={py(h)} x2={f1(px(9 - h) - 1)} y2={py(h)} />
              <line x1={f1(px(16 + h) + 1)} y1={py(h)} x2={f1(px(16 + h) + 7)} y2={py(h)} />
            </g>
          ))}
        </g>
        {/* the track: two smooth hills, and a floor that is rough when it is orange with teeth */}
        <path d={`M ${px(0)} ${py(9)} L ${px(9)} ${BASE} M ${px(16)} ${BASE} L ${px(25)} ${py(9)}`} fill="none" stroke={WHITE} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
        <line x1={px(9)} y1={BASE} x2={px(16)} y2={BASE} stroke={rough > 0 ? HEAT : WHITE} strokeWidth={4} strokeLinecap="round" />
        {Array.from({ length: rough }, (_, k) => {
          const w = 56 / Math.max(rough, 1)
          const a = px(9) + k * w
          return <path key={k} d={`M ${f1(a + 1)} ${BASE + 2} L ${f1(a + w / 2)} ${BASE + 13} L ${f1(a + w - 1)} ${BASE + 2} Z`} fill={HEAT} />
        })}
        {/* the flag stands on the right hill */}
        <g transform={`translate(${f1(flag.x)} ${f1(flag.y)})`} aria-hidden="true">
          <line x1={0} y1={0} x2={0} y2={-30} stroke={FLAG} strokeWidth={3} strokeLinecap="round" />
          <path d="M 1 -30 L 21 -23 L 1 -16 Z" fill={flagLit ? FLAG : ROOM} stroke={FLAG} strokeWidth={2.5} strokeLinejoin="round" />
        </g>
        {/* the ball, and where it will turn when motion is off */}
        {reduced && <circle cx={f1(ghost.x)} cy={f1(ghost.y)} r={R} fill="none" stroke={WHITE} strokeWidth={2.5} strokeDasharray="4 4" />}
        <circle cx={f1(ball.x)} cy={f1(ball.y)} r={R} fill={WHITE} />
        {/* the three bars, and the total */}
        <line x1={222} y1={f1(top.y)} x2={W - 4} y2={f1(top.y)} stroke={WHITE} strokeWidth={2} strokeDasharray="6 5" />
        {[bars.height, bars.motion, bars.heat].map((v, k) => (
          <rect key={k} x={BAR_X[k] - BAR_W / 2} y={f1(BASE - v * BAR_UNIT)} width={BAR_W} height={f1(v * BAR_UNIT)} fill={[HEIGHT, MOTION, HEAT][k]} />
        ))}
        <line x1={222} y1={BASE} x2={W - 4} y2={BASE} stroke={DIM} strokeWidth={2} />
        <Names labels={[...labels, top.label]} />
      </svg>
      <div className="flex items-center gap-4">
        <Round label={isRelease ? 'Lower the ball' : 'Make the floor smoother'} disabled={locked || value <= lo} onClick={() => set(value - 1)}>−</Round>
        <span className="min-w-[96px] text-center text-[13px] font-bold text-ss-slate">{isRelease ? 'ball height' : 'floor'}</span>
        <Round label={isRelease ? 'Raise the ball' : 'Make the floor rougher'} disabled={locked || value >= hi} onClick={() => set(value + 1)}>+</Round>
      </div>
      <p className="et-kbd hidden text-[12px] text-ss-slate">{isRelease ? 'The arrow keys raise and lower the ball.' : 'The arrow keys change the floor.'}</p>
      <span className="sr-only" aria-live="polite">{reachText}</span>
      {marked !== 'idle' && <p className="max-w-[350px] text-center text-[13px] font-bold leading-snug text-ss-ink">{said}</p>}
    </div>
  )
}
