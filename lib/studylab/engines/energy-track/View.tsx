'use client'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { SceneViewProps } from '../types'
import type { EnergyTrackConfig, EnergyTrackState } from './config'
import { advance, endX, energyTrackEngine, heightAt, madeReach, madeRelease, madeRough, madeText, startX, stores, working } from './config'

type Props = SceneViewProps<EnergyTrackConfig, EnergyTrackState>

// A quiet light plate in both themes, like waves' and measure-shape's: the picture keeps its own colours. Flat colours only.
const PLATE = '#F8FAFC'
const PLATE_EDGE = '#CBD5E1'
const HAIR = '#DCE3EA'
const INK = '#334155'
const SOFT = '#475569'
const WOOD = '#C29A5C'
const WOOD_EDGE = '#7C5A2C'
const WOOD_LIP = '#E6CE9C'
const GRIT = '#9C8466'
const GRIT_DARK = '#5B4630'
const GRIT_LIGHT = '#D8C7A5'
const STEEL = '#A9B6C4'
const STEEL_EDGE = '#475569'
const IRON = '#6B7A8C'
const HEIGHT = '#5B8DB8'
const MOTION = '#E3B93C'
const HEAT = '#E08A2E'
const FLAG_OFF = '#D64545'
const FLAG_ON = '#2F9E62'
const FLAG_EDGE = '#7F1D1D'
const FLAG_ON_EDGE = '#14532D'
const HALO = { stroke: PLATE, strokeWidth: 3.5, paintOrder: 'stroke', strokeLinejoin: 'round' } as const

// The stage, in pixels. The track is drawn in marks: one mark is UX across and UY up. These agree with config.ts
// (WALL 9, FLOOR 7) and a test holds them together: View cannot read config's constants at load time.
export const W = 360
export const H = 272
export const UX = 7
export const UY = 15
export const X0 = 14
export const BASE = 236
export const BAR_UNIT = 15
export const BAR_X = [230, 278, 326]
const BAR_W = 24
const PANEL_X = 204
const THICK = 7

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
    { text: 'flag', x: pole.x + 12, y: pole.y - 56, anchor: 'middle', part: { x: pole.x + 12, y: pole.y - 38 } },
    { text: 'floor', x: (px(9) + px(16)) / 2, y: BASE + 28, anchor: 'middle', part: { x: (px(9) + px(16)) / 2, y: BASE + 8 } },
    { text: 'height', x: BAR_X[0], y: BASE + 18, anchor: 'middle', part: { x: BAR_X[0], y: BASE - 6 } },
    { text: 'motion', x: BAR_X[1], y: BASE + 18, anchor: 'middle', part: { x: BAR_X[1], y: BASE - 6 } },
    { text: 'heat', x: BAR_X[2], y: BASE + 18, anchor: 'middle', part: { x: BAR_X[2], y: BASE - 6 } },
  )
  return labels
}

export function totalLine(config: EnergyTrackConfig, state: EnergyTrackState) {
  const mass = config.ball === 'heavy' ? 1.5 : 1
  const y = BASE - madeRelease(config, state) * mass * BAR_UNIT
  return { y, label: { text: 'total', x: PANEL_X + 8, y: y - 6, anchor: 'start' as const, part: { x: PANEL_X + 31, y } } }
}

/** The track's outline at a perpendicular distance d below its surface: four corners, the walls' angle kept. */
export function trackEdge(d: number): Pt[] {
  const a: Pt = { x: px(0), y: py(9) }
  const b: Pt = { x: px(9), y: BASE }
  const len = Math.hypot(b.x - a.x, b.y - a.y)
  const nx = -(b.y - a.y) / len
  const ny = (b.x - a.x) / len
  // the left wall's offset line meets the floor's offset line (y = BASE + d / 1)
  const s = (BASE + d - (a.y + ny * d)) / ((b.y - a.y) / len)
  const left: Pt = { x: a.x + nx * d + ((b.x - a.x) / len) * s, y: BASE + d }
  const top: Pt = { x: a.x + nx * d, y: a.y + ny * d }
  const mirror = (p: Pt): Pt => ({ x: px(25) - (p.x - px(0)), y: p.y })
  return [top, left, mirror(left), mirror(top)]
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
        <text key={l.text} x={f1(l.x)} y={f1(l.y)} textAnchor={l.anchor} fontSize={12} fontWeight={700} fill={SOFT} style={HALO}>{l.text}</text>
      ))}
    </g>
  )
}

const STEP = 'nodrag flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-lg border-2 border-ss-line bg-ss-panel text-[16px] font-extrabold leading-none text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'

/** One setting: a slate label, then a take-away button, pips that show where it is set, and an add button. No number, so no answer. */
function Control(props: { name: string; level: number; min: number; max: number; less: string; more: string; locked: boolean; set: (v: number) => void }) {
  const { name, level, min, max, less, more, locked, set } = props
  return (
    <div className="flex items-center justify-between gap-1.5">
      <span className="text-[12px] font-bold text-ss-slate">{name}</span>
      <span className="flex items-center gap-1">
        <button type="button" aria-label={less} disabled={locked || level <= min} onClick={() => set(level - 1)} className={STEP}>{'−'}</button>
        <span className="flex min-w-[96px] items-center justify-center gap-[3px]" aria-hidden="true">
          {Array.from({ length: max - min + 1 }, (_, k) => (
            <span key={k} className={`block h-2 w-2 rounded-full ${k + min <= level ? 'bg-ss-ink' : 'bg-ss-line'}`} />
          ))}
        </span>
        <button type="button" aria-label={more} disabled={locked || level >= max} onClick={() => set(level + 1)} className={STEP}>+</button>
      </span>
    </div>
  )
}

/** Sandpaper over the floor: a strip that thickens, and grit that crowds, with every step rougher. */
function Grit({ rough }: { rough: number }) {
  if (rough <= 0) return null
  const a = px(9)
  const w = px(16) - a
  const dots = Array.from({ length: rough * 12 }, (_, k) => {
    const x = a + 2 + (((k * 37 + 11) % 97) / 97) * (w - 4)
    const y = BASE + 0.4 + (((k * 53 + 5) % 11) / 11) * (1 + rough * 0.8)
    return { x, y, r: k % 3 === 0 ? 1.3 : 0.9, c: k % 2 ? GRIT_DARK : GRIT_LIGHT }
  })
  return (
    <g aria-hidden="true">
      <rect x={f1(a)} y={BASE} width={f1(w)} height={f1(1.5 + rough)} fill={GRIT} />
      {dots.map((d, k) => <circle key={k} cx={f1(d.x)} cy={f1(d.y)} r={d.r} fill={d.c} />)}
    </g>
  )
}

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
  const ballColour = config.ball === 'heavy' ? IRON : STEEL
  const pts = (d: number) => trackEdge(d).map((p) => `${f1(p.x)} ${f1(p.y)}`)
  const flagColour = flagLit ? FLAG_ON : FLAG_OFF
  const flagEdge = flagLit ? FLAG_ON_EDGE : FLAG_EDGE
  const sideRun = THICK / 0.906 + 0.6

  const key = (e: KeyboardEvent) => {
    const d = ({ ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 } as Record<string, number>)[e.key]
    if (!d) return
    e.preventDefault()
    e.stopPropagation()
    set(value + d)
  }

  const sphere = (cx: number, cy: number, ghosted: boolean) => (
    <g>
      <circle cx={f1(cx)} cy={f1(cy)} r={R} fill={ghosted ? 'none' : ballColour} stroke={STEEL_EDGE} strokeWidth={ghosted ? 2 : 1.5} strokeDasharray={ghosted ? '4 4' : undefined} />
      {!ghosted && <circle cx={f1(cx - R * 0.35)} cy={f1(cy - R * 0.38)} r={f1(R * 0.26)} fill="#FFFFFF" />}
    </g>
  )

  return (
    <div className="nodrag flex flex-col items-center gap-3 [&:has(:focus-visible)_.et-kbd]:block" onKeyDown={key}>
      <figure className="flex w-full max-w-[360px] flex-col gap-1.5">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={describe(config, now)} className="block h-auto w-full select-none">
          <rect width={W} height={H} rx={16} fill={PLATE} stroke={PLATE_EDGE} strokeWidth={1.5} />
          {/* the wooden track: a thick board with a pale lip, and a notch for every mark of height */}
          <polygon points={`${pts(0).join(' ')} ${[...pts(THICK)].reverse().join(' ')}`} fill={WOOD} stroke={WOOD_EDGE} strokeWidth={1.5} strokeLinejoin="round" />
          <polyline points={pts(1.4).join(' ')} fill="none" stroke={WOOD_LIP} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <g stroke={WOOD_EDGE} strokeWidth={1.2} strokeLinecap="round" aria-hidden="true">
            {Array.from({ length: 9 }, (_, k) => k + 1).map((h) => (
              <g key={h}>
                <line x1={f1(px(9 - h) - 2)} y1={py(h) + 2} x2={f1(px(9 - h) - sideRun)} y2={py(h) + 2} />
                <line x1={f1(px(16 + h) + 2)} y1={py(h) + 2} x2={f1(px(16 + h) + sideRun)} y2={py(h) + 2} />
              </g>
            ))}
          </g>
          <Grit rough={rough} />
          {/* the flag stands on the right hill: a pole, a foot and a bold cloth */}
          <g transform={`translate(${f1(flag.x)} ${f1(flag.y)})`} aria-hidden="true">
            <line x1={0} y1={0} x2={0} y2={-46} stroke={INK} strokeWidth={2.5} strokeLinecap="round" />
            <circle cx={0} cy={-47} r={3} fill={INK} />
            <circle cx={0} cy={0} r={3.2} fill={INK} />
            <path d="M 1.2 -43 H 28 L 22.5 -34 L 28 -25 H 1.2 Z" fill={flagColour} stroke={flagEdge} strokeWidth={1.5} strokeLinejoin="round" />
          </g>
          {/* the ball, and where it will turn when motion is off */}
          {reduced && sphere(ghost.x, ghost.y, true)}
          {sphere(ball.x, ball.y, false)}
          {/* the bars sit in their own chart card, with the total across them */}
          <rect x={PANEL_X} y={8} width={W - PANEL_X - 8} height={BASE + 26 - 8} rx={10} fill="#FFFFFF" stroke={HAIR} strokeWidth={1.5} />
          <line x1={PANEL_X + 8} y1={f1(top.y)} x2={W - 16} y2={f1(top.y)} stroke={INK} strokeWidth={1.6} strokeDasharray="6 5" />
          {[bars.height, bars.motion, bars.heat].map((v, k) => (
            <rect key={k} x={BAR_X[k] - BAR_W / 2} y={f1(BASE - v * BAR_UNIT)} width={BAR_W} height={f1(v * BAR_UNIT)} rx={2} fill={[HEIGHT, MOTION, HEAT][k]} stroke={['#3E6C92', '#A9851A', '#A85F12'][k]} strokeWidth={v > 0.05 ? 1 : 0} />
          ))}
          <line x1={PANEL_X + 8} y1={BASE} x2={W - 16} y2={BASE} stroke={SOFT} strokeWidth={1.6} />
          <Names labels={[...labels, top.label]} />
        </svg>
        <figcaption className="text-center text-[12px] font-bold text-ss-slate">
          {isRelease ? 'Raise or lower the ball so it just climbs to the flag.' : 'Roughen or smooth the floor so the ball just climbs to the flag.'}
        </figcaption>
      </figure>
      <div className="flex w-full max-w-[360px] flex-col gap-1.5">
        <Control
          name={isRelease ? 'Ball height' : 'Floor'} level={value} min={lo} max={hi} locked={locked} set={set}
          less={isRelease ? 'Lower the ball' : 'Make the floor smoother'} more={isRelease ? 'Raise the ball' : 'Make the floor rougher'}
        />
      </div>
      <p className="et-kbd hidden text-[12px] text-ss-slate">{isRelease ? 'The arrow keys raise and lower the ball.' : 'The arrow keys change the floor.'}</p>
      <span className="sr-only" aria-live="polite">{reachText}</span>
      {marked !== 'idle' && <p className="w-full max-w-[360px] rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2 text-[13px] font-extrabold leading-snug text-ss-ink">{said}</p>}
    </div>
  )
}
