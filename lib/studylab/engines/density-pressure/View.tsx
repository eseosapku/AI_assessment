'use client'
import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent, ReactNode } from 'react'
import type { SceneViewProps } from '../types'
import type { DPConfig, DPState } from './config'
import {
  BRICK, DIVE_DEPTH, FACES, MAX_BRICKS, bricksOf, densityPressureEngine, depthOf, faceOf, liquidOf, loadFrame, loadPlan, madeText, pressureOf, reading, weightsOf, working,
} from './config'

type Props = SceneViewProps<DPConfig, DPState>

// Real apparatus on a quiet light plate, as measure-shape's and network-sim's are. The plate keeps its own colours in both
// themes, so every part keeps its contrast against it. No gradients, glows or shadows.
const PLATE = '#F8FAFC'
const PLATE_EDGE = '#CBD5E1'
const INK = '#16202A'
const SOFT = '#475569'
const FONT = 'system-ui, sans-serif'
const ACCENT = '#C2410C'
const GLASS = '#8FA6BA'
const BENCH = '#CBD5E1'
const STEEL = '#8794A8'
const STEEL_EDGE = '#475569'
const STEEL_LIGHT = '#B4BFCE'
// A liquid is drawn in front of what is in it, so the part under the surface reads through it.
const LIQUID: Record<string, string> = { water: '#5DA9E0', 'sea water': '#4E9FBF', brine: '#6BB9A6', paraffin: '#E5B93C' }
// Each material as it looks: a face colour, a darker line for its grain, an outline.
const MATERIAL: Record<string, { face: string; mark: string; edge: string; top: string }> = {
  balsa: { face: '#EBDCB6', mark: '#CDB88A', edge: '#9A8456', top: '#F4EACB' },
  cork: { face: '#C8975F', mark: '#8F6234', edge: '#6F4A24', top: '#D7AB78' },
  pine: { face: '#E2B26B', mark: '#B98638', edge: '#8A5F22', top: '#EDC88C' },
  oak: { face: '#B07A43', mark: '#7F5226', edge: '#5C3A19', top: '#C48F5A' },
  ice: { face: '#D3EAF6', mark: '#FFFFFF', edge: '#7FA9C2', top: '#E8F5FC' },
  polythene: { face: '#E6EDF2', mark: '#C3CFD8', edge: '#8695A3', top: '#F4F8FA' },
}

export const W = 360
export const H = 300
/** Each picture crops to what it draws: the top and height of its panel, in the 360 x 300 drawing space. */
export const BOX = { load: { y: 74, h: 226 }, press: { y: 40, h: 260 }, dive: { y: 0, h: 290 } }

/** Pixels to the centimetre in each picture: written out here because config's constants are not there at load. */
export const PX_LOAD = 7.2
export const PX_PRESS = 4.4
export const PX_DIVE = 3.6
export const DENT = 5

const f1 = (n: number) => n.toFixed(1)
const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k)

// ---------------------------------------------------------------------------
// Calm motion: a value that eases towards where it should be, so a change is seen happening. Still under reduced motion.

function useEased(target: number, reduced: boolean): number {
  const [value, setValue] = useState(target)
  const now = useRef(target)
  useEffect(() => {
    if (reduced) {
      now.current = target
      setValue(target)
      return
    }
    let raf = 0
    let last = 0
    const tick = (t: number) => {
      const dt = last ? Math.min(0.05, (t - last) / 1000) : 0.016
      last = t
      const gap = target - now.current
      if (Math.abs(gap) < 0.01) {
        now.current = target
        setValue(target)
        return
      }
      now.current += gap * Math.min(1, dt * 4.5)
      setValue(now.current)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, reduced])
  return reduced ? target : value
}

/** The same dots every time, so the picture does not shimmer between renders. */
function dots(seed: number, n: number, w: number, h: number): { x: number; y: number; r: number; k: number }[] {
  let s = seed * 9301 + 49297
  const next = () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
  return Array.from({ length: n }, () => ({ x: next() * w, y: next() * h, r: 0.6 + next() * 1.1, k: Math.floor(next() * 3) }))
}

// ---------------------------------------------------------------------------
// The stepper row, as atom's is: a small bold label, a 28 px button each side and the value between.

function Stepper({ label, text, value, min, max, set, locked, glyphs, nouns, repeat, width }: {
  label: string; text: string; value: number; min: number; max: number; set(next: number): void; locked: boolean
  glyphs: [string, string]; nouns: [string, string]; repeat?: boolean; width: string
}) {
  const id = useId()
  const latest = useRef({ value, min, max, set, locked })
  latest.current = { value, min, max, set, locked }
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const held = useRef(false)
  const stop = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }
  useEffect(() => stop, [])
  const bump = (by: number): boolean => {
    const l = latest.current
    if (l.locked) return false
    const next = Math.max(l.min, Math.min(l.max, l.value + by))
    if (next === l.value) return false
    l.set(next)
    return true
  }
  const hold = (by: number) => (e: PointerEvent) => {
    if (!repeat || e.button !== 0) return
    held.current = false
    stop()
    const tick = (wait: number) => {
      timer.current = setTimeout(() => {
        held.current = true
        if (bump(by)) tick(90)
        else stop()
      }, wait)
    }
    tick(450)
  }
  const press = (by: number) => () => {
    if (held.current) {
      held.current = false
      return
    }
    bump(by)
  }
  const onKey = (e: KeyboardEvent) => {
    const by = ({ ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 5, PageDown: -5, '+': 1, '=': 1, '-': -1 } as Record<string, number>)[e.key]
    if (by === undefined && e.key !== 'Home' && e.key !== 'End') return
    // The board moves a selected card with the arrows; here they set the value.
    e.preventDefault()
    e.stopPropagation()
    if (e.key === 'Home') bump(latest.current.min - latest.current.value)
    else if (e.key === 'End') bump(latest.current.max - latest.current.value)
    else bump(by)
  }
  const button = 'nodrag flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-lg border-2 border-ss-line bg-ss-panel text-[16px] font-extrabold leading-none text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'
  return (
    <div className="flex items-center justify-between gap-1.5">
      <span id={id} className="text-[12px] font-bold text-ss-slate">{label}</span>
      <span className="flex items-center gap-1">
        <button
          type="button" tabIndex={-1} aria-label={nouns[0]} className={button} disabled={locked || value <= min}
          onPointerDown={hold(-1)} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop} onClick={press(-1)}
        >{glyphs[0]}</button>
        <span
          role="spinbutton" tabIndex={locked ? -1 : 0} aria-labelledby={id} aria-valuenow={value} aria-valuemin={min} aria-valuemax={max} aria-valuetext={text}
          aria-disabled={locked || undefined} onKeyDown={onKey}
          className={`nodrag ${width} rounded-md px-0.5 text-center text-[15px] font-extrabold tabular-nums text-ss-ink outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--subject)]`}
        >{text}</span>
        <button
          type="button" tabIndex={-1} aria-label={nouns[1]} className={button} disabled={locked || value >= max}
          onPointerDown={hold(1)} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop} onClick={press(1)}
        >{glyphs[1]}</button>
      </span>
    </div>
  )
}

const Readout = ({ label, value }: { label: string; value: string }) => (
  <p className="flex items-baseline justify-between border-t border-ss-line pt-1.5">
    <span className="text-[12px] font-bold text-ss-slate">{label}</span>
    <span className="text-[15px] font-extrabold tabular-nums text-ss-ink">{value}</span>
  </p>
)

const Tag = ({ x, y, text, anchor = 'start', tone = SOFT }: { x: number; y: number; text: string; anchor?: 'start' | 'middle' | 'end'; tone?: string }) => (
  <text x={f1(x)} y={f1(y)} textAnchor={anchor} fontSize={12} fontWeight={700} fill={tone} fontFamily={FONT} stroke={PLATE} strokeWidth={3} paintOrder="stroke" strokeLinejoin="round">{text}</text>
)

/** A glass tank: three walls and a floor, open at the top, with a bright edge down the front. */
function Glass({ x0, x1, rim, floor }: { x0: number; x1: number; rim: number; floor: number }) {
  return (
    <g aria-hidden="true">
      <path d={`M ${x0 - 4} ${rim} V ${floor + 4} H ${x1 + 4} V ${rim}`} fill="none" stroke={GLASS} strokeWidth={4} strokeLinejoin="round" />
      <line x1={x0 + 4} x2={x0 + 4} y1={rim + 8} y2={floor - 6} stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" opacity={0.85} />
      <rect x={x0 - 8} y={rim - 2} width={8} height={3} rx={1.5} fill={GLASS} />
      <rect x={x1} y={rim - 2} width={8} height={3} rx={1.5} fill={GLASS} />
    </g>
  )
}

/** The liquid: a see-through body with a bright line at its surface, drawn over whatever sits in it. */
function Liquid({ name, x0, x1, top, floor }: { name: string; x0: number; x1: number; top: number; floor: number }) {
  const tint = has(LIQUID, name) ? LIQUID[name] : LIQUID.water
  return (
    <g aria-hidden="true" data-liquid={name}>
      <rect x={x0} y={f1(top)} width={x1 - x0} height={f1(floor - top)} fill={tint} opacity={0.4} />
      <line x1={x0} x2={x1} y1={f1(top)} y2={f1(top)} stroke="#FFFFFF" strokeWidth={2} opacity={0.9} />
      <line x1={x0} x2={x1} y1={f1(top + 2.5)} y2={f1(top + 2.5)} stroke={tint} strokeWidth={1.2} opacity={0.9} />
    </g>
  )
}

// ---------------------------------------------------------------------------
// load: a block floating in a tank, with weights to stack on it.

const LOAD = { x0: 30, x1: 246, floor: 272, rim: 99, cx: 138, trayX: 305 }

function BlockBody({ name, x, y, w, h, mass }: { name: string; x: number; y: number; w: number; h: number; mass: number }) {
  const m = has(MATERIAL, name) ? MATERIAL[name] : MATERIAL.pine
  const id = useId().replace(/:/g, '')
  const grain = name === 'pine' || name === 'oak' || name === 'balsa'
  return (
    <g data-block={name}>
      <defs>
        <clipPath id={`${id}-b`}><rect x={x} y={y} width={w} height={h} rx={2.5} /></clipPath>
      </defs>
      <rect x={x} y={y} width={w} height={h} rx={2.5} fill={m.face} stroke={m.edge} strokeWidth={1.6} opacity={name === 'ice' ? 0.92 : 1} />
      <g clipPath={`url(#${id}-b)`}>
        {grain && [0.22, 0.48, 0.74].map((f, i) => (
          <path key={i} d={`M ${x} ${f1(y + h * f)} q ${f1(w * 0.25)} ${i % 2 ? 3 : -3} ${f1(w * 0.5)} 0 t ${f1(w * 0.5)} 0`} fill="none" stroke={m.mark} strokeWidth={1.2} opacity={0.8} />
        ))}
        {name === 'pine' && <ellipse cx={x + w * 0.82} cy={y + h * 0.62} rx={4.5} ry={2.6} fill="none" stroke={m.mark} strokeWidth={1.4} />}
        {name === 'cork' && dots(3, 46, w, h).map((d, i) => <circle key={i} cx={f1(x + d.x)} cy={f1(y + d.y)} r={d.r} fill={d.k ? m.mark : m.edge} opacity={0.55} />)}
        {name === 'polythene' && <rect x={x + 5} y={y + 4} width={w - 10} height={2.2} rx={1.1} fill="#FFFFFF" opacity={0.85} />}
        {name === 'ice' && (
          <g fill="none" stroke={m.mark} strokeLinecap="round">
            <path d={`M ${x + 10} ${y + h - 6} L ${x + 34} ${y + 6}`} strokeWidth={2.4} opacity={0.9} />
            <path d={`M ${x + w - 40} ${y + h - 5} L ${x + w - 22} ${y + 8}`} strokeWidth={2} opacity={0.9} />
            {dots(7, 6, w - 20, h - 10).map((d, i) => <circle key={i} cx={f1(x + 10 + d.x)} cy={f1(y + 5 + d.y)} r={d.r + 0.4} fill="#FFFFFF" stroke="none" opacity={0.8} />)}
          </g>
        )}
        <rect x={x} y={y} width={w} height={2.5} fill={m.top} opacity={0.9} />
      </g>
    </g>
  )
}

function Slab({ x, y, w }: { x: number; y: number; w: number }) {
  return (
    <g data-weight="1">
      <rect x={f1(x)} y={f1(y)} width={w} height={6} rx={1.4} fill={STEEL} stroke={STEEL_EDGE} strokeWidth={1} />
      <rect x={f1(x + 1)} y={f1(y + 0.9)} width={w - 2} height={1.6} rx={0.8} fill={STEEL_LIGHT} />
    </g>
  )
}

function LoadPicture({ config, state, reduced }: { config: Extract<DPConfig, { task: 'load' }>; state: DPState; reduced: boolean }) {
  const plan = loadPlan(config)
  const most = plan ? plan.most : 0
  const n = weightsOf(state, most)
  const frame = plan ? loadFrame(plan, n) : { total: 0, floats: true, level: 12, sunk: 0, bottom: 9 }
  const level = useEased(frame.level, reduced)
  const bottom = useEased(frame.bottom, reduced)
  const L = LOAD
  const levelY = L.floor - PX_LOAD * level
  const frontW = 20 * PX_LOAD
  const frontH = 5 * PX_LOAD
  const bodyY = L.floor - PX_LOAD * bottom - frontH
  const bodyX = L.cx - frontW / 2
  const total = frame.total
  const mass = plan ? plan.mass : 0
  const tray = plan ? Math.max(0, most + 2 - n) : 0
  const slabW = 80
  return (
    <g>
      <rect x={20} y={L.floor + 4} width={320} height={6} rx={2} fill={BENCH} />
      <BlockBody name={config.block} x={bodyX} y={bodyY} w={frontW} h={frontH} mass={mass} />
      {Array.from({ length: n }, (_, k) => <Slab key={k} x={L.cx - slabW / 2} y={bodyY - 6 * (k + 1)} w={slabW} />)}
      <Liquid name={config.liquid} x0={L.x0} x1={L.x1} top={levelY} floor={L.floor} />
      <Glass x0={L.x0} x1={L.x1} rim={L.rim} floor={L.floor} />
      <Tag x={L.x1 + 12} y={levelY + 4} text={config.liquid} />
      <line x1={L.x1 + 6} x2={L.x1 + 10} y1={levelY} y2={levelY} stroke={SOFT} strokeWidth={1.4} />
      {/* The weights not yet used wait in a pile beside the tank. */}
      {Array.from({ length: tray }, (_, k) => <Slab key={k} x={L.trayX - slabW / 2} y={L.floor + 4 - 6 * (k + 1)} w={slabW} />)}
      {plan && <Tag x={L.trayX} y={L.floor + 4 - 6 * tray - 22} text="weights" anchor="middle" />}
      {plan && <Tag x={L.trayX} y={L.floor + 4 - 6 * tray - 8} text={`${plan.unit} g each`} anchor="middle" />}
      <title>{`${config.block} block, ${total} g in all`}</title>
    </g>
  )
}

// ---------------------------------------------------------------------------
// press: a brick on foam on a kitchen scale.

const PRESS = { foamX0: 90, foamX1: 270, foamTop: 212, foamBottom: 262, cx: 180 }

function Brick({ x, y, w, h, top, seed }: { x: number; y: number; w: number; h: number; top: boolean; seed: number }) {
  const id = useId().replace(/:/g, '')
  return (
    <g data-brick={seed}>
      <defs><clipPath id={`${id}-r`}><rect x={x} y={y} width={w} height={h} rx={2} /></clipPath></defs>
      <rect x={x} y={y} width={w} height={h} rx={2} fill="#B9533C" stroke="#6E2B1B" strokeWidth={1.6} />
      <g clipPath={`url(#${id}-r)`}>
        {dots(seed + 1, Math.round((w * h) / 70), w, h).map((d, i) => <circle key={i} cx={f1(x + d.x)} cy={f1(y + d.y)} r={d.r} fill={d.k === 0 ? '#D9775C' : d.k === 1 ? '#8E3A28' : '#C96A4F'} opacity={0.7} />)}
        {top && <rect x={x} y={y} width={w} height={2.4} fill="#D9775C" />}
        <rect x={x} y={y} width={2.4} height={h} fill="#CF6A50" opacity={0.8} />
      </g>
    </g>
  )
}

function PressPicture({ config, state, reduced }: { config: Extract<DPConfig, { task: 'press' }>; state: DPState; reduced: boolean }) {
  const face = FACES[faceOf(state)]
  const bricks = bricksOf(state)
  const p = useEased(pressureOf(state), reduced)
  const P = PRESS
  const dent = DENT * p
  const wpx = face.wide * PX_PRESS
  const hpx = face.high * PX_PRESS
  const x0 = P.cx - wpx / 2
  const xl = x0 - 10
  const xr = x0 + wpx + 10
  const yb = P.foamTop + dent
  const targetY = P.foamTop + DENT * config.target
  const topY = yb - bricks * hpx
  const foam = [
    `M ${P.foamX0} ${P.foamBottom} V ${P.foamTop + 8} a 8 8 0 0 1 8 -8 H ${f1(xl)}`,
    `C ${f1(xl + 6)} ${P.foamTop} ${f1(x0)} ${f1(P.foamTop + dent * 0.55)} ${f1(x0)} ${f1(yb)} H ${f1(x0 + wpx)}`,
    `C ${f1(x0 + wpx)} ${f1(P.foamTop + dent * 0.55)} ${f1(xr - 6)} ${P.foamTop} ${f1(xr)} ${P.foamTop} H ${P.foamX1 - 8} a 8 8 0 0 1 8 8 V ${P.foamBottom} Z`,
  ].join(' ')
  const id = useId().replace(/:/g, '')
  return (
    <g>
      {/* The kitchen scale: a body with a display, and a steel plate the foam stands on. */}
      <rect x={52} y={270} width={256} height={24} rx={8} fill="#CBD5E1" stroke="#64748B" strokeWidth={1.6} />
      <rect x={70} y={262} width={220} height={8} rx={3} fill="#94A3B8" stroke="#64748B" strokeWidth={1.4} />
      <rect x={150} y={273} width={60} height={18} rx={3} fill="#C9D6B5" stroke="#566246" strokeWidth={1.4} />
      <text x={180} y={282.5} textAnchor="middle" dominantBaseline="central" fontSize={13} fontWeight={800} fill="#2C3A1F" fontFamily={FONT} data-scale="1">{(bricks * BRICK.kg).toFixed(1)} kg</text>
      <Tag x={316} y={286} text="scale" />
      {/* The foam, dented under the brick. */}
      <defs><clipPath id={`${id}-f`}><path d={foam} /></clipPath></defs>
      <path d={foam} fill="#F1CF76" stroke="#B8923A" strokeWidth={1.6} strokeLinejoin="round" data-foam="1" />
      <g clipPath={`url(#${id}-f)`}>
        {dots(5, 34, P.foamX1 - P.foamX0, P.foamBottom - P.foamTop).map((d, i) => <ellipse key={i} cx={f1(P.foamX0 + d.x)} cy={f1(P.foamTop + d.y)} rx={d.r + 0.6} ry={d.r} fill="#C9A24A" opacity={0.5} />)}
      </g>
      <Tag x={P.foamX1 + 8} y={P.foamBottom - 6} text="foam" />
      {/* The dent to match. The brick hides it where it stands. */}
      <line x1={P.foamX0 - 6} x2={P.foamX1 + 6} y1={targetY} y2={targetY} stroke={ACCENT} strokeWidth={1.8} strokeDasharray="6 4" data-target="1" />
      <Tag x={P.foamX0 - 9} y={targetY + 4} text="target dent" anchor="end" tone={ACCENT} />
      {Array.from({ length: bricks }, (_, k) => <Brick key={k} x={x0} y={yb - hpx * (k + 1)} w={wpx} h={hpx} top={k === bricks - 1} seed={k + 1} />)}
      {/* Its size, edge by edge. */}
      <g stroke={SOFT} strokeWidth={1.2} aria-hidden="true">
        <line x1={x0} x2={x0 + wpx} y1={topY - 6} y2={topY - 6} />
        <line x1={x0} x2={x0} y1={topY - 9} y2={topY - 3} />
        <line x1={x0 + wpx} x2={x0 + wpx} y1={topY - 9} y2={topY - 3} />
      </g>
      <Tag x={x0 + wpx / 2} y={topY - 11} text={`${face.wide} cm`} anchor="middle" />
      <Tag x={x0 + wpx + 8} y={topY + Math.min(hpx, 24) / 2 + 4} text={`${face.high} cm`} />
    </g>
  )
}

// ---------------------------------------------------------------------------
// dive: a pressure gauge whose capsule is lowered into a tank.

const DIVE = { x0: 90, x1: 270, surface: 146, floor: 276, rim: 130, cx: 180, dial: { x: 180, y: 68, r: 48 } }

const sweep = (v: number) => -135 + 67.5 * v
const onDial = (v: number, r: number) => {
  const a = (sweep(v) * Math.PI) / 180
  return { x: DIVE.dial.x + r * Math.sin(a), y: DIVE.dial.y - r * Math.cos(a) }
}

function Dial({ value, marker, shown }: { value: number; marker: number; shown: string }) {
  const D = DIVE.dial
  const needle = onDial(Math.min(value, 4.05), 33)
  const tail = onDial(value + 2, 8)
  const a = sweep(marker)
  const tip = onDial(marker, D.r + 0.5)
  const side = (dir: number) => {
    const r = D.r + 9
    const ang = ((a + dir * 4.6) * Math.PI) / 180
    return `${f1(D.x + r * Math.sin(ang))},${f1(D.y - r * Math.cos(ang))}`
  }
  return (
    <g>
      <circle cx={D.x} cy={D.y} r={D.r} fill="#E2E8F0" stroke="#475569" strokeWidth={3.4} />
      <circle cx={D.x} cy={D.y} r={D.r - 5} fill="#FFFFFF" stroke="#94A3B8" strokeWidth={1} />
      {Array.from({ length: 21 }, (_, i) => {
        const v = i * 0.2
        const major = i % 5 === 0
        const o = onDial(v, D.r - 6)
        const q = onDial(v, D.r - (major ? 14 : 10))
        return <line key={i} x1={f1(o.x)} y1={f1(o.y)} x2={f1(q.x)} y2={f1(q.y)} stroke={INK} strokeWidth={major ? 1.8 : 1} />
      })}
      <line x1={f1(tail.x)} y1={f1(tail.y)} x2={f1(needle.x)} y2={f1(needle.y)} stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
      <circle cx={D.x} cy={D.y} r={4} fill={INK} />
      {[0, 1, 2, 3, 4].map((v) => {
        const t = onDial(v, D.r - 25)
        return <text key={v} x={f1(t.x)} y={f1(t.y)} textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={700} fill={INK} fontFamily={FONT} stroke="#FFFFFF" strokeWidth={3} paintOrder="stroke" strokeLinejoin="round">{v}</text>
      })}
      {/* The tab: where the needle stood in water. */}
      <polygon points={`${f1(tip.x)},${f1(tip.y)} ${side(-1)} ${side(1)}`} fill={ACCENT} stroke="#7C2D12" strokeWidth={1} strokeLinejoin="round" data-marker="1" />
      <text x={D.x} y={D.y + 36} textAnchor="middle" fontSize={12} fontWeight={800} fill={SOFT} fontFamily={FONT} data-reading={shown}>kPa</text>

    </g>
  )
}

function DivePicture({ config, state, reduced }: { config: Extract<DPConfig, { task: 'dive' }>; state: DPState; reduced: boolean }) {
  const D = DIVE
  const rho = liquidOf(config.liquid === 'brine' ? 'brine' : 'paraffin').rho
  const depth = depthOf(state)
  const eased = useEased(depth, reduced)
  const kpa = reading(rho, eased)
  const exact = reading(rho, depth)
  const cy = D.surface + PX_DIVE * eased
  const push = Math.min(3.2, exact * 1.2)
  return (
    <g>
      <rect x={20} y={D.floor + 4} width={320} height={6} rx={2} fill={BENCH} />
      <Liquid name={config.liquid} x0={D.x0} x1={D.x1} top={D.surface} floor={D.floor} />
      {/* The depth ruler, on the front of the glass. */}
      <g stroke={SOFT} strokeWidth={1.2} aria-hidden="true">
        {Array.from({ length: 7 }, (_, i) => {
          const y = D.surface + PX_DIVE * 5 * i
          return <line key={i} x1={D.x0} x2={D.x0 + (i % 2 === 0 ? 10 : 6)} y1={f1(y)} y2={f1(y)} />
        })}
      </g>
      {[0, 10, 20, 30].map((d) => <Tag key={d} x={D.x0 - 10} y={D.surface + PX_DIVE * d + 4} text={`${d} cm`} anchor="end" />)}
      <line x1={D.x0 + 12} x2={D.cx - 16} y1={f1(cy)} y2={f1(cy)} stroke={SOFT} strokeWidth={1.2} strokeDasharray="2 4" opacity={0.8} />
      <Glass x0={D.x0} x1={D.x1} rim={D.rim} floor={D.floor} />
      {/* The tube from the dial down to the capsule, and the capsule: a brass drum with a rubber face that is pushed in. */}
      <rect x={D.cx - 2.5} y={D.dial.y + D.dial.r - 2} width={5} height={f1(Math.max(4, cy - 8.5 - (D.dial.y + D.dial.r - 2)))} fill="#64748B" stroke="#334155" strokeWidth={1} />
      <rect x={D.cx - 15} y={f1(cy - 8.5)} width={30} height={17} rx={3.5} fill="#C9962B" stroke="#7A5710" strokeWidth={1.4} data-capsule="1" />
      <path d={`M ${D.cx + 15} ${f1(cy - 7)} q ${f1(-push)} 7 0 14`} fill="#3B82F6" stroke="#1E3A8A" strokeWidth={1.6} />
      <Dial value={Math.max(0, kpa)} marker={config.reference * 0.1} shown={exact.toFixed(2)} />
      <Tag x={D.x1 + 12} y={D.surface + 4} text={config.liquid} />
      <Tag x={D.x1 + 12} y={D.surface + 19} text={`${rho / 1000} g/cm³`} />
      <line x1={D.x1 + 6} x2={D.x1 + 10} y1={D.surface} y2={D.surface} stroke={SOFT} strokeWidth={1.4} />
      <Tag x={D.cx + 20} y={cy + 4} text="capsule" />
    </g>
  )
}

// ---------------------------------------------------------------------------

function describe(config: DPConfig, state: DPState): string {
  if (config.task === 'load') {
    const plan = loadPlan(config)
    if (!plan) return `A ${config.block} block in a tank of ${config.liquid}.`
    const n = weightsOf(state, plan.most)
    const f = loadFrame(plan, n)
    return `A ${config.block} block of ${plan.mass} g in a tank of ${config.liquid}, with ${n === 0 ? 'no weights' : `${n} weights of ${plan.unit} g`} on it. It is ${f.floats ? 'floating' : 'resting on the floor of the tank'}.`
  }
  if (config.task === 'press') {
    const face = FACES[faceOf(state)]
    const n = bricksOf(state)
    return `${n === 1 ? 'A brick' : `${n} bricks stacked`} resting on its ${face.label} face, pressing into foam on a scale that reads ${(n * BRICK.kg).toFixed(1)} kg. A dashed line marks a dent to match.`
  }
  const d = depthOf(state)
  const rho = liquidOf(config.liquid === 'brine' ? 'brine' : 'paraffin').rho
  return `A pressure gauge with its capsule ${d} cm deep in ${config.liquid}. The dial reads ${reading(rho, d).toFixed(2)} kilopascals, and an orange tab marks a reading to reach.`
}

export function DensityPressureView({ config, state, setState, marked, reduced, locked }: Props) {
  const now = marked === 'shown' ? densityPressureEngine.solve(config) : state
  const finished = marked === 'right' || marked === 'shown'
  const frozen = locked || finished
  const said = finished ? working(config, now) : marked === 'wrong' ? madeText(config, now) : ''
  const lead = said.match(/^(Yes\. [^.]*\.)\s*(.*)$/)
  const put = (next: DPState) => {
    if (!frozen) setState(next)
  }

  const box = BOX[config.task]
  let picture: ReactNode = null
  let caption = ''
  let rows: React.ReactNode = null
  let polite = ''
  if (config.task === 'load') {
    const plan = loadPlan(config)
    const most = plan ? plan.most : 0
    const n = weightsOf(now, most)
    const total = plan ? plan.mass + n * plan.unit : 0
    picture = <LoadPicture config={config} state={now} reduced={reduced} />
    caption = plan ? `${config.block[0].toUpperCase()}${config.block.slice(1)} block, 20 × 10 × 5 cm, ${plan.mass} g. ${config.liquid[0].toUpperCase()}${config.liquid.slice(1)}: ${plan.liquid / 1000} g per cm³.` : ''
    polite = plan ? `${n} weights on the block, ${total} g in all.` : ''
    rows = plan && (
      <>
        <Stepper
          label={`Weights, ${plan.unit} g each`} text={String(n)} value={n} min={0} max={most + 2} set={(v) => put({ weights: v })} locked={frozen}
          glyphs={['−', '+']} nouns={['Take a weight off', 'Put a weight on']} width="min-w-[28px]"
        />
        <Readout label="Total mass on the water" value={`${total} g`} />
      </>
    )
  } else if (config.task === 'press') {
    const n = bricksOf(now)
    const face = faceOf(now)
    picture = <PressPicture config={config} state={now} reduced={reduced} />
    caption = `Brick 20 × 10 × 5 cm, ${BRICK.kg} kg each. The foam dents in proportion to the pressure.`
    polite = `${n} brick${n === 1 ? '' : 's'} on the ${FACES[face].label} face. The scale reads ${(n * BRICK.kg).toFixed(1)} kg.`
    rows = (
      <>
        <Stepper
          label="Resting on" text={FACES[face].label} value={face} min={0} max={FACES.length - 1} set={(v) => put({ face: v, bricks: n })} locked={frozen}
          glyphs={['‹', '›']} nouns={['Turn the brick to the face before', 'Turn the brick to the face after']} width="w-[92px]"
        />
        <Stepper
          label="Bricks" text={String(n)} value={n} min={1} max={MAX_BRICKS} set={(v) => put({ face, bricks: v })} locked={frozen}
          glyphs={['−', '+']} nouns={['Take a brick away', 'Add a brick']} width="min-w-[28px]"
        />
      </>
    )
  } else {
    const d = depthOf(now)
    const rho = liquidOf(config.liquid === 'brine' ? 'brine' : 'paraffin').rho
    picture = <DivePicture config={config} state={now} reduced={reduced} />
    caption = 'Orange tab: where the needle stopped in water. g = 10 N/kg.'
    polite = `The capsule is ${d} cm deep and the gauge reads ${reading(rho, d).toFixed(2)} kilopascals.`
    rows = (
      <>
        <Stepper
          label="Depth of the capsule" text={`${d} cm`} value={d} min={0} max={DIVE_DEPTH} set={(v) => put({ depth: v })} locked={frozen}
          glyphs={['−', '+']} nouns={['Raise the capsule one centimetre', 'Lower the capsule one centimetre']} width="w-[64px]" repeat
        />
        <Readout label="Gauge reads" value={`${reading(rho, d).toFixed(2)} kPa`} />
      </>
    )
  }

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-2 [&:has([role=spinbutton]:focus-visible)_.dp-kbd]:block">
      <figure className="m-0 flex w-full flex-col gap-1.5">
        <svg viewBox={`0 ${box.y} ${W} ${box.h}`} role="img" aria-label={describe(config, now)} className="block h-auto w-full select-none">
          <rect x={0.75} y={box.y + 0.75} width={W - 1.5} height={box.h - 1.5} rx={16} fill={PLATE} stroke={PLATE_EDGE} strokeWidth={1.5} />
          {picture}
        </svg>
        <figcaption className="text-center text-[12px] font-bold leading-snug text-ss-slate">{caption}</figcaption>
      </figure>
      <div className="flex flex-col gap-1.5">{rows}</div>
      <p className="dp-kbd hidden text-[12px] font-semibold text-ss-slate">Tab reaches the number. Arrow keys change it.</p>
      <span className="sr-only" aria-live="polite">{polite}</span>
      {marked !== 'idle' && (
        <div className="rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2">
          <p className="text-[13px] font-extrabold leading-snug text-ss-ink">{lead ? lead[1] : said}</p>
          {lead && lead[2] && <p className="mt-0.5 text-[12px] font-semibold leading-snug text-ss-slate">{lead[2]}</p>}
        </div>
      )}
    </div>
  )
}
