'use client'
import { useEffect, useRef } from 'react'
import type { SceneViewProps } from '../types'
import type { MatterState, ParticlesConfig, ParticlesState } from './config'
import { SUBSTANCES, meanSpeed, range, stateAt, stepFor } from './config'

const W = 260
const H = 170
const N = 30
const R = 7
const COLS = 6
const FILL = '#2F7FD1'
/** Clear space between a particle and the box's edge, so none is clipped by its border or corners. */
const INSET = 4
/** The box's measures, for the tests that hold every frame to them. */
export const BOX = { w: W, h: H, r: R, inset: INSET } as const
const LO = R + INSET
const HI_X = W - R - INSET
const HI_Y = H - R - INSET

/** What the box shows, in words that describe the arrangement and never name the state. */
const SEEN: Record<MatterState, string> = {
  solid: 'Particles packed in a regular pattern, each vibrating in its place',
  liquid: 'Particles close together, sliding past one another',
  gas: 'Particles far apart, moving fast in every direction',
}

interface P { x: number; y: number; vx: number; vy: number; hx: number; hy: number }

/** The lattice a solid holds: rows from the floor up, centred. */
function home(i: number): { hx: number; hy: number } {
  const row = Math.floor(i / COLS)
  const col = i % COLS
  const gap = R * 2 + 2
  const left = (W - (COLS - 1) * gap) / 2
  return { hx: left + col * gap, hy: H - R - 4 - row * gap }
}

function start(): P[] {
  return Array.from({ length: N }, (_, i) => {
    const h = home(i)
    return { x: h.hx, y: h.hy, vx: 0, vy: 0, ...h }
  })
}

/** One step of the box: vibrate in place, slide in a heap, or fly and bounce. `speed` is 0..1. */
function step(ps: P[], state: MatterState, speed: number) {
  const jitter = () => (Math.random() - 0.5) * 2
  for (const p of ps) {
    if (state === 'solid') {
      // Pulled back to its place, shaken by the heat.
      p.x += (p.hx - p.x) * 0.3 + jitter() * (0.4 + 2.2 * speed)
      p.y += (p.hy - p.y) * 0.3 + jitter() * (0.4 + 2.2 * speed)
      continue
    }
    if (state === 'liquid') {
      p.vx = p.vx * 0.85 + jitter() * (0.5 + 1.6 * speed)
      p.vy = p.vy * 0.85 + jitter() * (0.5 + 1.6 * speed) + 0.35 // settles to the floor
    } else {
      const v = 1.8 + 5 * speed
      const m = Math.hypot(p.vx, p.vy) || 1
      if (m < v * 0.6 || m > v * 1.4) {
        const a = Math.random() * Math.PI * 2
        p.vx = Math.cos(a) * v
        p.vy = Math.sin(a) * v
      }
    }
    p.x += p.vx
    p.y += p.vy
    if (p.x < LO) { p.x = LO; p.vx = Math.abs(p.vx) }
    if (p.x > HI_X) { p.x = HI_X; p.vx = -Math.abs(p.vx) }
    if (p.y < LO) { p.y = LO; p.vy = Math.abs(p.vy) }
    if (p.y > HI_Y) { p.y = HI_Y; p.vy = -Math.abs(p.vy) * (state === 'liquid' ? 0.2 : 1) }
  }
  if (state === 'solid') {
    for (const p of ps) clamp(p)
    return
  }
  // Close in a liquid, apart in a gas, and never one over another: pushed
  // apart and back inside until they settle. A still frame caught a liquid
  // piled over itself on the box's floor.
  for (let round = 0; round < 16; round++) {
    let moved = false
    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        const a = ps[i], b = ps[j]
        const dx = b.x - a.x, dy = b.y - a.y
        const d = Math.hypot(dx, dy) || 0.01
        if (d < R * 2) {
          const push = (R * 2 - d) / 2 + 0.01
          a.x -= (dx / d) * push; a.y -= (dy / d) * push
          b.x += (dx / d) * push; b.y += (dy / d) * push
          moved = true
        }
      }
    }
    for (const p of ps) clamp(p)
    if (!moved) break
  }
}

/** Back inside the box, clear of its edge. */
function clamp(p: P) {
  p.x = Math.min(HI_X, Math.max(LO, p.x))
  p.y = Math.min(HI_Y, Math.max(LO, p.y))
}

/** The box after some frames in one state, as the tests and a still frame see it. */
export function simulate(state: MatterState, speed: number, frames: number): P[] {
  const ps = start()
  for (let i = 0; i < frames; i++) step(ps, state, speed)
  return ps
}

function draw(ctx: CanvasRenderingContext2D, ps: P[]) {
  ctx.clearRect(0, 0, W, H)
  for (const p of ps) {
    ctx.beginPath()
    ctx.arc(p.x, p.y, R, 0, Math.PI * 2)
    ctx.fillStyle = FILL
    ctx.fill()
    ctx.lineWidth = 1.5
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'
    ctx.stroke()
  }
}

export function ParticlesView({ config, state, setState, marked, reduced, locked }: SceneViewProps<ParticlesConfig, ParticlesState>) {
  const s = SUBSTANCES[config.substance]
  const [lo, hi] = range(config.substance)
  const temp = typeof state?.temp === 'number' ? state.temp : lo
  const now = stateAt(config.substance, temp)
  const speed = (meanSpeed(temp) - meanSpeed(lo)) / Math.max(1e-6, meanSpeed(hi) - meanSpeed(lo))
  const canvas = useRef<HTMLCanvasElement>(null)
  const ps = useRef<P[]>(start())
  // The latest state and speed, read by the animation without restarting it.
  const live = useRef({ now, speed })
  live.current = { now, speed }

  useEffect(() => {
    const el = canvas.current
    const ctx = el?.getContext('2d')
    if (!el || !ctx) return
    const scale = window.devicePixelRatio || 1
    el.width = W * scale
    el.height = H * scale
    ctx.scale(scale, scale)
    if (reduced) {
      // One still frame, settled into the state it is in.
      for (let i = 0; i < 60; i++) step(ps.current, live.current.now, live.current.speed)
      draw(ctx, ps.current)
      return
    }
    let raf = 0
    let last = 0
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick)
      if (t - last < 33) return // about 30 frames a second
      last = t
      step(ps.current, live.current.now, live.current.speed)
      draw(ctx, ps.current)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [reduced])

  // Under reduced motion the still frame follows the temperature.
  useEffect(() => {
    if (!reduced) return
    const ctx = canvas.current?.getContext('2d')
    if (!ctx) return
    for (let i = 0; i < 60; i++) step(ps.current, now, speed)
    draw(ctx, ps.current)
  }, [reduced, now, speed])

  const explore = config.task.kind === 'explore'
  const named = explore || marked !== 'idle'
  const set = (t: number) => {
    if (locked) return
    const seen = explore ? [...new Set<MatterState>([...(state?.seen ?? []), stateAt(config.substance, t)])] : state?.seen
    setState({ temp: t, ...(seen ? { seen } : {}) })
  }

  return (
    <div className="nodrag flex flex-col gap-3">
      <div className="relative mx-auto w-full max-w-[300px] overflow-hidden rounded-2xl border-2 border-ss-line bg-ss-chip">
        <canvas ref={canvas} role="img" aria-label={SEEN[now]} className="block h-auto w-full" style={{ aspectRatio: `${W} / ${H}` }} />
        <span className="absolute left-2 top-1.5 text-[12px] font-bold capitalize text-ss-slate">{s.name}</span>
      </div>
      <p className="sr-only" aria-live="polite">{SEEN[now]}</p>
      {named && (
        <p className="text-center text-[13px] font-extrabold text-ss-ink">
          {marked === 'wrong' ? `You made it a ${now}` : `It is a ${now}`}
        </p>
      )}
      <div>
        <div className="mb-1 flex items-baseline justify-between">
          <label htmlFor={`temp-${config.substance}`} className="text-[12px] font-bold uppercase tracking-widest text-ss-slate">Temperature</label>
          <span className="text-[15px] font-extrabold tabular-nums text-ss-ink">{temp} °C</span>
        </div>
        <input
          id={`temp-${config.substance}`}
          type="range"
          className="nodrag w-full accent-[color:var(--subject)]"
          min={lo}
          max={hi}
          step={stepFor(config.substance)}
          value={temp}
          disabled={locked}
          onChange={(e) => set(Number(e.target.value))}
          onKeyDown={(e) => e.stopPropagation()}
        />
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[12px] font-bold text-ss-slate">Particle speed</span>
          <span className="h-2 flex-1 overflow-hidden rounded-full bg-ss-line">
            <span className="block h-full rounded-full transition-[width] duration-200 motion-reduce:transition-none" style={{ width: `${Math.round(10 + 90 * speed)}%`, backgroundColor: FILL }} />
          </span>
        </div>
      </div>
    </div>
  )
}
