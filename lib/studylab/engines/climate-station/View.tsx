'use client'
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import type { SceneViewProps } from '../types'
import type { Axes, ClimateConfig, ClimateState, Station } from './config'
import {
  MONTHS, MONTH_SHORT, STATIONS, axesOf, climateStationEngine, declination, latText, madeText, monthOf, nearestStation, placeOf, stationOf, stationsNorthToSouth, working,
} from './config'

type Props = SceneViewProps<ClimateConfig, ClimateState>

// A weather station is not a dark subject: a quiet light plate, as measure-shape's and bonding's are, with real instruments on
// it. The plate keeps its own colours in both themes. Flat colours, no gradients or shadows.
const PLATE = '#F8FAFC'
const PLATE_EDGE = '#CBD5E1'
const HAIR = '#DCE3EA'
const INK = '#16202A'
const SOFT = '#475569'
const FONT = 'system-ui, sans-serif'
const GLASS = '#EEF2F6'
const GLASS_EDGE = '#94A3B8'
const TEMP = '#C2410C'
const RAIN = '#9CC3E6'
const RAIN_EDGE = '#3A78B4'
const WATER = '#5B9BD5'
const GHOST = '#1F2937'
const BAND = '#E3ECF5'
const SUN_FAINT = '#EBCB73'
const SUN = '#D99A00'
const PATCH = '#C2640A'
const DAY = '#CFE3F3'
const NIGHT = '#B3C6D8'
const GLOBE_EDGE = '#7C93AA'

// Geometry (viewBox pixels). Written out here because config.ts and this file import each other (the test checks the
// ones that matter against the config).
export const W = 360
export const H = 326
export const CX = 96
export const CY = 92
export const R = 68
const BEAM = 16
const GLOBE_W = 176
const GLOBE_H = 180
// The climate graph.
export const PX0 = 44
export const PX1 = 316
export const PY0 = 206
export const PY1 = 300
const MW = (PX1 - PX0) / 12
// The instruments.
const TH_X = 230
const TH_TOP = 31
const TH_BASE = 116
const GA_X0 = 296
const GA_X1 = 320
const GA_TOP = 52
const GA_BASE = 116

const f1 = (n: number) => n.toFixed(1)
const rad = (d: number) => (d * Math.PI) / 180
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

type Pt = { x: number; y: number }

/** The sun's beam on the globe: where the rays meet the ground, found by running them on to the circle. */
export function beamOf(lat: number, decl: number, cx = CX, cy = CY, r = R, w = BEAM) {
  const dx = Math.cos(rad(decl))
  const dy = Math.sin(rad(decl))
  const px = -dy
  const py = dx
  const entry = (b: number): Pt => {
    const k = Math.sqrt(Math.max(0, r * r - b * b))
    return { x: cx + b * px - k * dx, y: cy + b * py - k * dy }
  }
  const inc = Math.cos(rad(lat - decl))
  const b0 = -r * Math.sin(rad(lat - decl))
  return { dx, dy, px, py, entry, b0, cosInc: inc, dark: inc < 0.04, b1: clamp(b0 - w / 2, -r, r), b2: clamp(b0 + w / 2, -r, r) }
}

/** How far the footprint reaches along the ground, in pixels. */
export function patchLength(lat: number, decl: number): number {
  const b = beamOf(lat, decl)
  if (b.dark) return 0
  const e1 = b.entry(b.b1)
  const e2 = b.entry(b.b2)
  const a1 = Math.atan2(e1.y - CY, e1.x - CX)
  const a2 = Math.atan2(e2.y - CY, e2.x - CX)
  let d = a2 - a1
  while (d > Math.PI) d -= 2 * Math.PI
  while (d < -Math.PI) d += 2 * Math.PI
  return Math.abs(d) * R
}

/** A number that eases to its target, for the globe: nothing moves under reduced motion. */
function useEased(target: number, reduced: boolean, ms = 520): number {
  const [v, setV] = useState(target)
  const now = useRef(target)
  useEffect(() => {
    if (reduced) {
      now.current = target
      setV(target)
      return
    }
    const from = now.current
    if (from === target) return
    let raf = 0
    let t0 = 0
    const tick = (t: number) => {
      if (!t0) t0 = t
      const k = Math.min(1, (t - t0) / ms)
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
      now.current = from + (target - from) * e
      setV(now.current)
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, reduced, ms])
  return reduced ? target : v
}

const tempY = (t: number, a: Axes, y0: number, y1: number) => y1 - ((t - a.tMin) / (a.tMax - a.tMin)) * (y1 - y0)
const rainY = (r: number, a: Axes, y0: number, y1: number) => y1 - (clamp(r, 0, a.rMax) / a.rMax) * (y1 - y0)
const ticks = (lo: number, hi: number, step: number) => {
  const out: number[] = []
  for (let v = lo; v <= hi + 1e-9; v += step) out.push(v)
  return out
}
/** Every tick when there are few, every other one when they would crowd. */
const labelled = (list: number[]) => (list.length <= 5 ? list : list.filter((_, i) => i % 2 === 0))

function Globe({ lat, decl, place, draggable, pins, active }: { lat: number; decl: number; place: Station | null; draggable: boolean; pins: Station[]; active: string }) {
  const b = beamOf(lat, decl)
  const pin = (l: number): Pt => ({ x: CX - R * Math.cos(rad(l)), y: CY - R * Math.sin(rad(l)) })
  const p = pin(lat)
  const p1 = { x: CX + R * b.px, y: CY + R * b.py }
  const p2 = { x: CX - R * b.px, y: CY - R * b.py }
  const night = `M ${f1(p1.x)} ${f1(p1.y)} A ${R} ${R} 0 0 0 ${f1(p2.x)} ${f1(p2.y)} Z`
  const chords = [0, 23.45, -23.45]
  // A faint ray every so often, and the gold beam on the station.
  const faint = [-54, -36, -18, 0, 18, 36, 54].filter((x) => b.dark || Math.abs(x - b.b0) > 14)
  const ray = (bb: number, stroke: string, width: number, key: string) => {
    const e = b.entry(bb)
    return <line key={key} x1={f1(e.x - 22 * b.dx)} y1={f1(e.y - 22 * b.dy)} x2={f1(e.x)} y2={f1(e.y)} stroke={stroke} strokeWidth={width} strokeLinecap="round" />
  }
  let arc: string | null = null
  if (!b.dark) {
    const e1 = b.entry(b.b1)
    const e2 = b.entry(b.b2)
    const a1 = Math.atan2(e1.y - CY, e1.x - CX)
    const a2 = Math.atan2(e2.y - CY, e2.x - CX)
    let d = a2 - a1
    while (d > Math.PI) d -= 2 * Math.PI
    while (d < -Math.PI) d += 2 * Math.PI
    const rr = R + 3
    const s1 = { x: CX + rr * Math.cos(a1), y: CY + rr * Math.sin(a1) }
    const s2 = { x: CX + rr * Math.cos(a2), y: CY + rr * Math.sin(a2) }
    arc = `M ${f1(s1.x)} ${f1(s1.y)} A ${rr} ${rr} 0 0 ${d > 0 ? 1 : 0} ${f1(s2.x)} ${f1(s2.y)}`
  }
  const tx = Math.sin(rad(lat))
  const ty = -Math.cos(rad(lat))
  const chev = (sign: 1 | -1) => {
    const c = { x: p.x + sign * 13 * tx, y: p.y + sign * 13 * ty }
    const a = Math.atan2(sign * ty, sign * tx) * (180 / Math.PI)
    return <path key={sign} d="M -3 -3.5 L 3 0 L -3 3.5" fill="none" stroke={INK} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" transform={`translate(${f1(c.x)} ${f1(c.y)}) rotate(${f1(a)})`} />
  }
  return (
    <g fontFamily={FONT}>
      <circle cx={CX} cy={CY} r={R} fill={DAY} />
      <path d={night} fill={NIGHT} />
      {chords.map((c) => {
        const y = CY - R * Math.sin(rad(c))
        const half = R * Math.cos(rad(c))
        return <line key={c} x1={f1(CX - half)} x2={f1(CX + half)} y1={f1(y)} y2={f1(y)} stroke={GLOBE_EDGE} strokeWidth={c === 0 ? 1.2 : 1} strokeDasharray={c === 0 ? undefined : '3 3'} opacity={c === 0 ? 1 : 0.8} />
      })}
      <circle cx={CX} cy={CY} r={R} fill="none" stroke={GLOBE_EDGE} strokeWidth={1.4} />
      {faint.map((x) => ray(x, SUN_FAINT, 1.3, `f${x}`))}
      {!b.dark && [b.b0 - BEAM / 2, b.b0, b.b0 + BEAM / 2].map((x, i) => ray(clamp(x, -R, R), SUN, i === 1 ? 2.2 : 1.6, `b${i}`))}
      {arc && <path d={arc} fill="none" stroke={PATCH} strokeWidth={5} strokeLinecap="butt" />}
      {pins.filter((s) => s.id !== active).map((s) => {
        const q = pin(s.lat)
        return <circle key={s.id} cx={f1(q.x)} cy={f1(q.y)} r={3.6} fill="#FFFFFF" stroke={SOFT} strokeWidth={1.4} data-pin={s.id} />
      })}
      {draggable && chev(1)}
      {draggable && chev(-1)}
      <circle cx={f1(p.x)} cy={f1(p.y)} r={6.4} fill="#FFFFFF" stroke={INK} strokeWidth={2.4} data-station={place?.id ?? ''} />
      <text x={CX} y={17} textAnchor="middle" fontSize={12} fontWeight={700} fill={SOFT}>N</text>
      <text x={CX} y={176} textAnchor="middle" fontSize={12} fontWeight={700} fill={SOFT}>S</text>
      <text x={CX + R - 5} y={CY - 5} textAnchor="end" fontSize={12} fontWeight={700} fill={SOFT}>equator</text>
      <text x={6} y={16} fontSize={12} fontWeight={700} fill={SOFT}>sunlight</text>
    </g>
  )
}

function Thermometer({ t, a, reduced }: { t: number; a: Axes; reduced: boolean }) {
  const y = tempY(t, a, TH_TOP + 3, TH_BASE)
  const list = ticks(a.tMin, a.tMax, a.tStep)
  const ease = reduced ? undefined : { transition: 'y 600ms ease, height 600ms ease' }
  return (
    <g fontFamily={FONT} data-instrument="thermometer">
      {list.map((v) => {
        const ty = tempY(v, a, TH_TOP + 3, TH_BASE)
        return <line key={v} x1={TH_X - 11} x2={TH_X - 5} y1={f1(ty)} y2={f1(ty)} stroke={SOFT} strokeWidth={1.2} />
      })}
      {labelled(list).map((v) => <text key={v} x={TH_X - 14} y={f1(tempY(v, a, TH_TOP + 3, TH_BASE) + 4)} textAnchor="end" fontSize={12} fontWeight={600} fill={SOFT}>{v}</text>)}
      <rect x={TH_X - 5} y={TH_TOP} width={10} height={TH_BASE - TH_TOP + 6} rx={5} fill={GLASS} stroke={GLASS_EDGE} strokeWidth={1.4} />
      <rect x={TH_X - 2.2} width={4.4} style={{ y: f1(y), height: f1(TH_BASE + 12 - y), fill: TEMP, ...ease }} data-mercury="1" />
      <circle cx={TH_X} cy={TH_BASE + 12} r={8.5} fill={TEMP} stroke={GLASS_EDGE} strokeWidth={1.4} />
      <circle cx={TH_X - 2.6} cy={TH_BASE + 9.6} r={2.2} fill="#FFFFFF" opacity={0.55} />
    </g>
  )
}

function RainGauge({ r, a, reduced }: { r: number; a: Axes; reduced: boolean }) {
  const y = rainY(r, a, GA_TOP, GA_BASE)
  const list = ticks(0, a.rMax, a.rStep)
  const ease = reduced ? undefined : { transition: 'y 600ms ease, height 600ms ease' }
  return (
    <g fontFamily={FONT} data-instrument="rain-gauge">
      <path d={`M ${GA_X0 - 6} 38 L ${GA_X1 + 6} 38 L ${GA_X1} ${GA_TOP} L ${GA_X0} ${GA_TOP} Z`} fill="#CBD5E1" stroke={GLASS_EDGE} strokeWidth={1.4} strokeLinejoin="round" />
      <rect x={GA_X0} y={GA_TOP} width={GA_X1 - GA_X0} height={GA_BASE - GA_TOP} fill={GLASS} stroke={GLASS_EDGE} strokeWidth={1.4} />
      <rect x={GA_X0 + 1} width={GA_X1 - GA_X0 - 2} style={{ y: f1(y), height: f1(GA_BASE - y - 0.7), fill: WATER, ...ease }} data-water="1" />
      <rect x={GA_X0 - 2} y={GA_BASE} width={GA_X1 - GA_X0 + 4} height={4} rx={1.5} fill={GLASS_EDGE} />
      {list.map((v) => {
        const ty = rainY(v, a, GA_TOP, GA_BASE)
        return <line key={v} x1={GA_X1} x2={GA_X1 + 5} y1={f1(ty)} y2={f1(ty)} stroke={SOFT} strokeWidth={1.2} />
      })}
      {labelled(list).map((v) => <text key={v} x={GA_X1 + 8} y={f1(rainY(v, a, GA_TOP, GA_BASE) + 4)} fontSize={12} fontWeight={600} fill={SOFT}>{v}</text>)}
    </g>
  )
}

function Graph({ s, ghost, a, month }: { s: Station; ghost: Station | null; a: Axes; month: number }) {
  const mx = (m: number) => PX0 + (m + 0.5) * MW
  const line = (st: Station) => st.temp.map((t, m) => `${f1(mx(m))},${f1(tempY(t, a, PY0, PY1))}`).join(' ')
  const tl = ticks(a.tMin, a.tMax, a.tStep)
  const rl = ticks(0, a.rMax, a.rStep)
  return (
    <g fontFamily={FONT} data-graph="1">
      <rect x={PX0 + month * MW} y={PY0} width={MW} height={PY1 - PY0} fill={BAND} data-band={month} />
      {tl.map((v) => {
        const y = tempY(v, a, PY0, PY1)
        return <line key={v} x1={PX0} x2={PX1} y1={f1(y)} y2={f1(y)} stroke={v === 0 ? GLASS_EDGE : HAIR} strokeWidth={v === 0 ? 1.3 : 1} />
      })}
      {labelled(tl).map((v) => <text key={v} x={PX0 - 5} y={f1(tempY(v, a, PY0, PY1) + 4)} textAnchor="end" fontSize={12} fontWeight={600} fill={TEMP}>{v}</text>)}
      {labelled(rl).map((v) => <text key={v} x={PX1 + 5} y={f1(rainY(v, a, PY0, PY1) + 4)} fontSize={12} fontWeight={600} fill={RAIN_EDGE}>{v}</text>)}
      {rl.map((v) => <line key={v} x1={PX1} x2={PX1 + 3} y1={f1(rainY(v, a, PY0, PY1))} y2={f1(rainY(v, a, PY0, PY1))} stroke={RAIN_EDGE} strokeWidth={1.2} />)}
      <text x={PX0 - 5} y={PY0 - 12} textAnchor="end" fontSize={12} fontWeight={800} fill={TEMP}>°C</text>
      <text x={PX1 + 5} y={PY0 - 12} fontSize={12} fontWeight={800} fill={RAIN_EDGE}>mm</text>
      {s.rain.map((r, m) => {
        const y = rainY(r, a, PY0, PY1)
        return <rect key={m} x={f1(mx(m) - 6)} y={f1(y)} width={12} height={Math.max(0, PY1 - y).toFixed(1)} fill={RAIN} stroke={RAIN_EDGE} strokeWidth={m === month ? 2 : 1} data-bar={m} />
      })}
      {ghost && ghost.rain.map((r, m) => {
        const y = rainY(r, a, PY0, PY1)
        return <rect key={`g${m}`} x={f1(mx(m) - 6)} y={f1(y)} width={12} height={Math.max(0, PY1 - y).toFixed(1)} fill="none" stroke={GHOST} strokeWidth={1.5} strokeDasharray="3 2" data-ghost-bar={m} />
      })}
      <polyline points={line(s)} fill="none" stroke={TEMP} strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round" data-line="1" />
      {s.temp.map((t, m) => <circle key={m} cx={f1(mx(m))} cy={f1(tempY(t, a, PY0, PY1))} r={m === month ? 5 : 2.6} fill={m === month ? '#FFFFFF' : TEMP} stroke={TEMP} strokeWidth={m === month ? 2.4 : 0} />)}
      {ghost && <polyline points={line(ghost)} fill="none" stroke={GHOST} strokeWidth={1.8} strokeDasharray="5 3" strokeLinejoin="round" data-ghost-line="1" />}
      {MONTH_SHORT.map((n, m) => <text key={m} x={f1(mx(m))} y={PY1 + 16} textAnchor="middle" fontSize={12} fontWeight={m === month ? 800 : 600} fill={m === month ? INK : SOFT}>{n[0]}</text>)}
    </g>
  )
}

const btn = 'nodrag flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-lg border-2 border-ss-line bg-ss-panel text-[16px] font-extrabold leading-none text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'

/** A stepper row copied from atom's: a slate label, then two buttons round the value. */
function Row({ id, label, value, valueText, now, max, wrap, down, up, locked, downLabel, upLabel, glyphs }: {
  id: string; label: string; value: string; valueText: string; now: number; max: number; wrap: boolean; down(): void; up(): void; locked: boolean; downLabel: string; upLabel: string; glyphs: [string, string]
}) {
  const onKey = (e: KeyboardEvent) => {
    const by = ({ ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, '+': 1, '=': 1, '-': -1 } as Record<string, number>)[e.key]
    if (by === undefined) return
    // The board moves a selected card with the arrows; here they step the station or the month.
    e.preventDefault()
    e.stopPropagation()
    if (locked) return
    if (by > 0) up()
    else down()
  }
  return (
    <div className="flex items-center justify-between gap-1.5">
      <span id={id} className="text-[12px] font-bold text-ss-slate">{label}</span>
      <span className="flex items-center gap-1">
        <button type="button" tabIndex={-1} aria-label={downLabel} className={btn} disabled={locked || (!wrap && now <= 0)} onClick={down}>{glyphs[0]}</button>
        <span
          role="spinbutton" tabIndex={locked ? -1 : 0} aria-labelledby={id} aria-valuenow={now} aria-valuemin={0} aria-valuemax={max} aria-valuetext={valueText}
          aria-disabled={locked || undefined} onKeyDown={onKey}
          className="nodrag w-[104px] rounded-md px-0.5 text-center text-[15px] font-extrabold tabular-nums text-ss-ink outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--subject)]"
        >{value}</span>
        <button type="button" tabIndex={-1} aria-label={upLabel} className={btn} disabled={locked || (!wrap && now >= max)} onClick={up}>{glyphs[1]}</button>
      </span>
    </div>
  )
}

function Swatch({ kind }: { kind: 'line' | 'bar' | 'ghost' | 'sun' }) {
  return (
    <svg viewBox="0 0 18 10" className="h-2.5 w-[18px] shrink-0" aria-hidden="true">
      {kind === 'line' && <><line x1={0} x2={18} y1={5} y2={5} stroke={TEMP} strokeWidth={2.4} /><circle cx={9} cy={5} r={2.6} fill={TEMP} /></>}
      {kind === 'bar' && <rect x={4} y={0.75} width={10} height={8.5} fill={RAIN} stroke={RAIN_EDGE} strokeWidth={1.2} />}
      {kind === 'ghost' && <line x1={0} x2={18} y1={5} y2={5} stroke={GHOST} strokeWidth={1.8} strokeDasharray="4 2.5" />}
      {kind === 'sun' && <line x1={0} x2={18} y1={5} y2={5} stroke={PATCH} strokeWidth={4} />}
    </svg>
  )
}
const Named = ({ kind, children }: { kind: 'line' | 'bar' | 'ghost' | 'sun'; children: string }) => (
  <span className="flex items-center gap-1 whitespace-nowrap"><Swatch kind={kind} />{children}</span>
)

function describe(config: ClimateConfig, s: Station, month: number): string {
  const where = config.task === 'month' ? `${s.full}, ${latText(s.lat)}` : `a place at ${latText(s.lat)}`
  return `A globe with sunlight landing on a weather station at ${where}, a thermometer and a rain gauge reading ${MONTHS[month]}: ${s.temp[month]} degrees and ${s.rain[month]} millimetres of rain, and a climate graph of the year with temperature as a line and rainfall as bars.`
}

export function ClimateStationView({ config, state, setState, marked, reduced, locked }: Props) {
  const now = marked === 'shown' ? climateStationEngine.solve(config) : state
  const place = placeOf(config, now) ?? STATIONS[1]
  const month = monthOf(config, now)
  const ghost = config.task === 'place' ? stationOf(config.place) : null
  const axes = axesOf(config)
  const finished = marked === 'right' || marked === 'shown'
  const frozen = locked || finished
  const decl = useEased(declination(month), reduced)
  const lat = useEased(place.lat, reduced)
  const order = stationsNorthToSouth()
  const index = order.findIndex((o) => o.id === place.id)
  const movable = config.task === 'place' && !frozen
  const held = useRef(false)

  const setMonth = (m: number) => { if (!frozen) setState({ ...now, at: place.id, month: ((m % 12) + 12) % 12 }) }
  const setPlace = (id: string) => { if (movable) setState({ ...now, at: id, month }) }
  const step = (by: number) => { const n = order[clamp(index + by, 0, order.length - 1)]; setPlace(n.id) }

  const onGlobe = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.type === 'pointerdown') { held.current = true; e.currentTarget.setPointerCapture?.(e.pointerId) }
    if (!held.current || !movable) return
    const r = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * GLOBE_W
    const y = ((e.clientY - r.top) / r.height) * GLOBE_H
    const phi = (Math.atan2(-(y - CY), Math.max(1e-6, Math.abs(x - CX))) * 180) / Math.PI
    setPlace(nearestStation(phi).id)
  }
  const onGraph = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.type === 'pointerdown') { held.current = true; e.currentTarget.setPointerCapture?.(e.pointerId) }
    if (!held.current || frozen) return
    const r = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * (PX1 - PX0)
    setMonth(clamp(Math.floor(x / MW), 0, 11))
  }
  const release = () => { held.current = false }

  const said = marked === 'right' || marked === 'shown' ? working(config, now) : marked === 'wrong' ? madeText(config, now) : ''
  const lead = said.match(/^(Yes\.(?: Near enough:)? [^.]*\.)\s*(.*)$/)
  const title = config.task === 'month' ? `${place.name} · ${latText(place.lat)}` : `Station at ${latText(place.lat)}`
  const pct = (n: number, d: number) => `${(n / d) * 100}%`

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-2">
      <figure className="m-0 flex w-full flex-col gap-1.5">
        <div className="relative w-full">
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={describe(config, place, month)} className="block h-auto w-full select-none">
            <rect x={0.75} y={0.75} width={W - 1.5} height={H - 1.5} rx={16} fill={PLATE} stroke={PLATE_EDGE} strokeWidth={1.5} />
            <Globe lat={lat} decl={decl} place={place} draggable={movable} pins={config.task === 'place' ? STATIONS : [place]} active={place.id} />
            <g fontFamily={FONT}>
              <text x={190} y={16} fontSize={13} fontWeight={800} fill={INK}>{title}</text>
            </g>
            <Thermometer t={place.temp[month]} a={axes} reduced={reduced} />
            <RainGauge r={place.rain[month]} a={axes} reduced={reduced} />
            <g fontFamily={FONT} textAnchor="middle">
              <text x={TH_X} y={152} fontSize={15} fontWeight={800} fill={INK} data-reading="temp">{place.temp[month]} °C</text>
              <text x={(GA_X0 + GA_X1) / 2} y={152} fontSize={15} fontWeight={800} fill={INK} data-reading="rain">{place.rain[month]} mm</text>
              <text x={TH_X} y={168} fontSize={12} fontWeight={600} fill={SOFT}>thermometer</text>
              <text x={(GA_X0 + GA_X1) / 2} y={168} fontSize={12} fontWeight={600} fill={SOFT}>rain gauge</text>
            </g>
            <line x1={14} x2={W - 14} y1={182} y2={182} stroke={HAIR} strokeWidth={1} />
            <Graph s={place} ghost={ghost} a={axes} month={month} />
          </svg>
          {movable && (
            <div
              className="nodrag absolute touch-none cursor-grab active:cursor-grabbing"
              style={{ left: 0, top: 0, width: pct(GLOBE_W, W), height: pct(GLOBE_H, H) }}
              onPointerDown={onGlobe} onPointerMove={onGlobe} onPointerUp={release} onPointerCancel={release} aria-hidden="true"
            />
          )}
          {!frozen && (
            <div
              className="nodrag absolute touch-none cursor-pointer"
              style={{ left: pct(PX0, W), top: pct(PY0 - 6, H), width: pct(PX1 - PX0, W), height: pct(PY1 - PY0 + 22, H) }}
              onPointerDown={onGraph} onPointerMove={onGraph} onPointerUp={release} onPointerCancel={release} aria-hidden="true"
            />
          )}
        </div>
        <figcaption className="flex flex-wrap justify-center gap-x-3 gap-y-0.5 text-[12px] font-semibold text-ss-slate" aria-hidden="true">
          <Named kind="line">Temperature</Named>
          <Named kind="bar">Rainfall</Named>
          <Named kind="sun">Sun&apos;s patch</Named>
          {config.task === 'place' && <Named kind="ghost">Target</Named>}
        </figcaption>
      </figure>

      <div className="flex flex-col gap-1.5">
        {config.task === 'place' && (
          <Row
            id="cs-lat" label="Station" value={latText(place.lat)} valueText={latText(place.lat)} now={index} max={order.length - 1} wrap={false}
            down={() => step(1)} up={() => step(-1)} locked={!movable} downLabel="Move the station south" upLabel="Move the station north" glyphs={['↓', '↑']}
          />
        )}
        <Row
          id="cs-month" label="Month" value={MONTHS[month]} valueText={MONTHS[month]} now={month} max={11} wrap
          down={() => setMonth(month - 1)} up={() => setMonth(month + 1)} locked={frozen} downLabel="Previous month" upLabel="Next month" glyphs={['‹', '›']}
        />
      </div>

      <span className="sr-only" aria-live="polite">{`${MONTHS[month]}: ${place.temp[month]} degrees Celsius, ${place.rain[month]} millimetres of rain.`}</span>
      {marked !== 'idle' && (
        <div className="rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2">
          <p className="text-[13px] font-extrabold leading-snug text-ss-ink">{lead ? lead[1] : said}</p>
          {lead && lead[2] && <p className="mt-0.5 text-[12px] font-semibold leading-snug text-ss-slate">{lead[2]}</p>}
        </div>
      )}
    </div>
  )
}
