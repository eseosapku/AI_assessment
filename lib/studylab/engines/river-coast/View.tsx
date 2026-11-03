'use client'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { SceneViewProps } from '../types'
import type { RcConfig, RcState, Pebbles, Site } from './config'
import {
  BAY_W, BAYS, BEACH_YEARS, CHANNEL_W, HIT_DIST, LAM, RIVER_YEARS, SITES, TMAX, amplitude, distToRiver, driftSite, flowOf, fromOf, groynesOf, hotelBay,
  levelsAt, madeText, riverCoastEngine, riverY, settledPebbles, shiftOf, siteIdOf, startPebbles, stepPebbles, timeOf, working,
} from './config'

type Props = SceneViewProps<RcConfig, RcState>

// A river and a beach are not dark subjects: a quiet plate, as measure-shape's and network-sim's are, drawn in plan from above.
// The plate keeps its own colours in both themes. No gradients or shadows.
const PLATE_EDGE = '#CBD5E1'
const INK = '#16202A'
const SOFT = '#475569'
const FONT = 'system-ui, sans-serif'
export const W = 360
export const H = 250
const PLOT = 34

const LAND_A = '#E9EDD6'
const LAND_B = '#E1E7CA'
const HEDGE = '#CBD4AE'
const WATER = '#8FC1E3'
const WATER_EDGE = '#5C9CC6'
const FAST = '#2F6F9F'
const SAND = '#E8D6A0'
const SAND_EDGE = '#C9B27A'
const CUTBANK = '#8A6A4B'
const ROOF = '#B5655A'
const WALL_COL = '#F3EDE2'
const WALL_EDGE = '#8C8579'
const TIMBER = '#8A6A4B'
const TIMBER_EDGE = '#5E4630'
const SEA = '#A9D3EA'
const CREST = '#EAF5FB'
const WET = '#D8C795'
const PROM = '#8E99A4'
const GRASS = '#D5E2C0'
const STONES = ['#8C8F94', '#A39A8F', '#7A7F87', '#B0A596', '#9A948A']

const f1 = (n: number) => n.toFixed(1)
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** The years clock: a shown value that walks to its target at walking pace, and starts again from the beginning on a new run. */
function useShown(target: number, run: number, reduced: boolean): number {
  const [v, setV] = useState(target)
  const live = useRef({ v: target, run })
  useEffect(() => {
    if (reduced) {
      live.current = { v: target, run }
      setV(target)
      return
    }
    if (live.current.run !== run) live.current = { v: 0, run }
    let raf = 0
    let last = 0
    const tick = (now: number) => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016
      last = now
      const d = target - live.current.v
      if (Math.abs(d) < 0.004) {
        live.current.v = target
        setV(target)
        return
      }
      live.current.v += Math.sign(d) * Math.min(Math.abs(d), 0.9 * dt)
      setV(live.current.v)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, run, reduced])
  return reduced ? target : v
}

// ---------------------------------------------------------------------------
// The river.

type Pt = { x: number; y: number; s: number; nx: number; ny: number }

function riverPoints(flow: ReturnType<typeof flowOf>, t: number): Pt[] {
  const out: Pt[] = []
  const a = amplitude(flow, t)
  const c = (2 * Math.PI) / LAM
  for (let x = -8; x <= W + 8; x += 4) {
    const th = c * (x - shiftOf(flow, t))
    const dy = a * c * Math.cos(th)
    const n = Math.hypot(dy, 1)
    out.push({ x, y: riverY(flow, x, t), s: Math.sin(th), nx: -dy / n, ny: 1 / n })
  }
  return out
}

const line = (pts: { x: number; y: number }[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${f1(p.x)} ${f1(p.y)}`).join(' ')
const off = (p: Pt, d: number) => ({ x: p.x + p.nx * d, y: p.y + p.ny * d })
const sgn = (v: number) => (v >= 0 ? 1 : -1)

/** Runs of consecutive points that satisfy `keep`. */
function runs(pts: Pt[], keep: (p: Pt) => boolean): Pt[][] {
  const out: Pt[][] = []
  let cur: Pt[] = []
  for (const p of pts) {
    if (keep(p)) cur.push(p)
    else if (cur.length) {
      out.push(cur)
      cur = []
    }
  }
  if (cur.length) out.push(cur)
  return out.filter((r) => r.length > 2)
}

function House({ x, y, lost, lean }: { x: number; y: number; lost: boolean; lean: number }) {
  return (
    <g transform={`translate(${f1(x)} ${f1(y)})`} data-house={lost ? 'lost' : 'standing'}>
      <g transform={lost ? `translate(${lean * 2} 4) rotate(${lean * 26})` : undefined}>
        <rect x={-9} y={-4} width={18} height={13} rx={1} fill={lost ? '#CFC5B4' : WALL_COL} stroke={WALL_EDGE} strokeWidth={1.3} />
        <path d="M -12 -3.5 L 0 -14 L 12 -3.5 Z" fill={lost ? '#B79C93' : ROOF} stroke="#7C4A42" strokeWidth={1.2} strokeLinejoin="round" />
        <rect x={-2.5} y={2.5} width={5} height={6.5} fill="#7B6A58" />
        <rect x={4} y={-0.5} width={3} height={3} fill="#9CB6C9" />
      </g>
    </g>
  )
}

function PlotMark({ site }: { site: Site }) {
  return (
    <g transform={`translate(${f1(site.x)} ${f1(site.y)})`} aria-hidden="true" data-plot={site.n}>
      <rect x={-12} y={-12} width={24} height={24} rx={5} fill="#FFFFFF" fillOpacity={0.7} stroke="#7C8A6A" strokeWidth={1.4} strokeDasharray="4 3" />
      <text x={0} y={4.5} textAnchor="middle" fontFamily={FONT} fontSize={13} fontWeight={700} fill={SOFT}>{site.n}</text>
    </g>
  )
}

function RiverPlan({ config, state, t, reduced, finished, onPlot, locked }: { config: RcConfig; state: RcState; t: number; reduced: boolean; finished: boolean; onPlot(id: string): void; locked: boolean }) {
  const flow = flowOf(config)
  const pts = useMemo(() => riverPoints(flow, t), [flow, t])
  const start = useMemo(() => riverPoints(flow, 0), [flow])
  const bar = (3 + 3.6 * t)
  const id = siteIdOf(config, state)
  const here = SITES.find((s) => s.id === id)!
  const gone = distToRiver(flow, here, t) < HIT_DIST
  const dir = sgn(riverY(flow, here.x, t) - here.y)
  const sand = runs(pts, (p) => Math.abs(p.s) > 0.25)
  const cut = runs(pts, (p) => Math.abs(p.s) > 0.6)
  const thread = pts.map((p) => off(p, sgn(p.s) * (CHANNEL_W / 2 - 4.5) * Math.min(1, Math.abs(p.s) / 0.8)))
  const fields: { x: number; y: number; w: number; h: number; c: string }[] = []
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) fields.push({ x: 6 + i * 88 + (j % 2) * 10, y: 6 + j * 80, w: 82, h: 74, c: (i + j) % 2 ? LAND_A : LAND_B })
  return (
    <>
      <style>{'@keyframes rc-flow{to{stroke-dashoffset:-34}}'}</style>
      <rect x={0.75} y={0.75} width={W - 1.5} height={H - 1.5} rx={16} fill={LAND_A} />
      <g aria-hidden="true">
        {fields.map((f, k) => <rect key={k} x={f.x} y={f.y} width={f.w} height={f.h} rx={6} fill={f.c} stroke={HEDGE} strokeWidth={1.2} />)}
      </g>
      {t > 0.15 && <path d={line(start)} fill="none" stroke={WATER_EDGE} strokeWidth={1.4} strokeDasharray="3 4" opacity={0.7} data-start="1" />}
      {!finished && !locked && SITES.filter((s) => s.id !== id).map((s) => <PlotMark key={s.id} site={s} />)}
      {sand.map((r, k) => {
        const a = r.map((p) => off(p, -sgn(p.s) * (CHANNEL_W / 2 - 1)))
        const b = r.map((p) => off(p, -sgn(p.s) * (CHANNEL_W / 2 + bar * ((Math.abs(p.s) - 0.25) / 0.75))))
        return <path key={k} d={`${line(a)} ${line(b.slice().reverse()).replace('M', 'L')} Z`} fill={SAND} stroke={SAND_EDGE} strokeWidth={1.2} strokeLinejoin="round" data-bar="1" />
      })}
      <path d={line(pts)} fill="none" stroke={WATER_EDGE} strokeWidth={CHANNEL_W + 3} strokeLinejoin="round" data-channel="1" />
      <path d={line(pts)} fill="none" stroke={WATER} strokeWidth={CHANNEL_W} strokeLinejoin="round" />
      {cut.map((r, k) => <path key={k} d={line(r.map((p) => off(p, sgn(p.s) * (CHANNEL_W / 2 + 2))))} fill="none" stroke={CUTBANK} strokeWidth={3} strokeLinecap="round" data-cutbank="1" />)}
      <path
        d={line(thread)} fill="none" stroke={FAST} strokeWidth={2.2} strokeLinecap="round" strokeDasharray="10 7" data-fast="1"
        style={reduced ? undefined : { animation: 'rc-flow 1.1s linear infinite' }}
      />
      <g aria-hidden="true" fontFamily={FONT}>
        <text x={16} y={26} fontSize={13} fontWeight={700} fill={SOFT} stroke={LAND_A} strokeWidth={3} paintOrder="stroke" strokeLinejoin="round">Flow</text>
        <path d="M 50 22 h 14 m -4.5 -4.5 l 4.5 4.5 l -4.5 4.5" fill="none" stroke={SOFT} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <House x={here.x} y={here.y} lost={gone} lean={dir} />
      {gone && <circle cx={here.x + dir * 6} cy={here.y + dir * 8} r={13} fill="none" stroke={WATER_EDGE} strokeWidth={1.4} opacity={0.8} />}
      {!finished && !locked && SITES.filter((s) => s.id !== id).map((s) => (
        <PlotButton key={s.id} x={s.x} y={s.y} label={`Put the house on plot ${s.n}`} onPress={() => onPlot(s.id)} />
      ))}
    </>
  )
}

/** The real control over each place the learner can tap: see-through and bigger than the mark, so a finger cannot miss. */
function PlotButton({ x, y, label, onPress }: { x: number; y: number; label: string; onPress(): void }) {
  return (
    <foreignObject x={x - PLOT / 2} y={y - PLOT / 2} width={PLOT} height={PLOT}>
      <button
        type="button" aria-label={label} onClick={onPress}
        className="nodrag block touch-manipulation rounded-lg outline-none hover:ring-2 hover:ring-[color:var(--subject)] focus-visible:ring-2 focus-visible:ring-[color:var(--subject)]"
        style={{ width: PLOT, height: PLOT, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer' }}
      />
    </foreignObject>
  )
}

// ---------------------------------------------------------------------------
// The beach.

const BACK = 170
const shoreOf = (level: number) => BACK - 14 - level * 64

function Hotel({ x }: { x: number }) {
  return (
    <g transform={`translate(${x} 0)`} aria-hidden="true" fontFamily={FONT}>
      <rect x={10} y={202} width={52} height={34} rx={2} fill={WALL_COL} stroke={WALL_EDGE} strokeWidth={1.3} />
      <rect x={7} y={198} width={58} height={6} rx={1.5} fill={ROOF} stroke="#7C4A42" strokeWidth={1.2} />
      {[16, 30, 44].flatMap((wx) => [208, 220].map((wy) => <rect key={`${wx}-${wy}`} x={wx} y={wy} width={8} height={7} fill="#9CB6C9" stroke={WALL_EDGE} strokeWidth={0.8} />))}
      <text x={36} y={247} textAnchor="middle" fontSize={13} fontWeight={700} fill={SOFT}>Hotel</text>
    </g>
  )
}

function Houses({ x }: { x: number }) {
  return (
    <g transform={`translate(${x} 0)`} aria-hidden="true">
      {[12, 42].map((hx) => (
        <g key={hx}>
          <rect x={hx} y={210} width={20} height={20} rx={1.5} fill="#E4E0D8" stroke={WALL_EDGE} strokeWidth={1.1} />
          <path d={`M ${hx - 2} 211 L ${hx + 10} 202 L ${hx + 22} 211 Z`} fill="#A9A39A" stroke="#7B766E" strokeWidth={1} strokeLinejoin="round" />
        </g>
      ))}
    </g>
  )
}

function Groyne({ x, top, offer }: { x: number; top: number; offer?: boolean }) {
  if (offer) return <line x1={x} x2={x} y1={BACK + 2} y2={top} stroke="#94A3B8" strokeWidth={2} strokeDasharray="4 5" data-groyne="offer" />
  const planks = []
  for (let y = top + 6; y < BACK; y += 9) planks.push(<line key={y} x1={x - 3} x2={x + 3} y1={y} y2={y} stroke={TIMBER_EDGE} strokeWidth={1} />)
  return (
    <g data-groyne="built">
      <rect x={x - 3.5} y={top} width={7} height={BACK + 2 - top} rx={1.5} fill={TIMBER} stroke={TIMBER_EDGE} strokeWidth={1.2} />
      {planks}
      <circle cx={x} cy={top} r={4} fill={TIMBER} stroke={TIMBER_EDGE} strokeWidth={1.2} />
    </g>
  )
}

function Clip({ x, y, adds }: { x: number; y: number; adds: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`} aria-hidden="true" data-clip={adds ? 'plus' : 'cross'}>
      <rect x={-8} y={-8} width={16} height={16} rx={4} fill="#FFFFFF" stroke={SOFT} strokeWidth={1.4} />
      <path d={adds ? 'M -4 0 H 4 M 0 -4 V 4' : 'M -3 -3 L 3 3 M 3 -3 L -3 3'} fill="none" stroke={INK} strokeWidth={1.9} strokeLinecap="round" />
    </g>
  )
}

export const GROYNE_TOP = 60
const CLIP_Y = 188

function BeachPlan({ config, state, t, reduced, finished, locked, pebbles, onGroyne }: { config: RcConfig; state: RcState; t: number; reduced: boolean; finished: boolean; locked: boolean; pebbles: Pebbles; onGroyne(site: number): void }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const from = fromOf(config)
  const g = groynesOf(state)
  const level = levelsAt(from, g, t)
  const hotel = hotelBay(config)
  const flip = from === 'right'
  // The shore, bay by bay: a wedge in each, with a step at every groyne.
  const edge = (b: number, side: 'l' | 'r') => {
    if (b <= 0) return level[0]
    if (b >= BAYS) return level[BAYS - 1]
    if (g.includes(b)) return side === 'l' ? level[b - 1] : level[b]
    return (level[b - 1] + level[b]) / 2
  }
  const shore: { x: number; y: number }[] = []
  for (let k = 0; k < BAYS; k++) {
    shore.push({ x: k * BAY_W, y: shoreOf(edge(k, 'r')) })
    shore.push({ x: k * BAY_W + BAY_W / 2, y: shoreOf(level[k]) })
    shore.push({ x: (k + 1) * BAY_W, y: shoreOf(edge(k + 1, 'l')) })
  }
  const shoreAt = (x: number) => {
    for (let i = 0; i + 1 < shore.length; i++) {
      const a = shore[i]
      const b = shore[i + 1]
      if (x >= a.x && x <= b.x) return b.x === a.x ? Math.min(a.y, b.y) : a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x)
    }
    return shore[shore.length - 1].y
  }
  const top = shore.map((p, i) => `${i ? 'L' : 'M'}${f1(p.x)} ${f1(p.y)}`).join(' ')
  const seaPath = `${top} L ${W} 0 L 0 0 Z`.replace(/^M/, 'M')
  const sandPath = `${top} L ${W} ${BACK + 2} L 0 ${BACK + 2} Z`
  const crests = []
  for (let j = -1; j < 7; j++) for (let i = -1; i < 8; i++) crests.push({ x: i * 56 + (((j % 2) + 2) % 2) * 28, y: j * 28 })
  const mirror = flip ? `translate(${W} 0) scale(-1 1)` : undefined
  const sx = (x: number) => (flip ? W - x : x)
  return (
    <>
      <style>{'@keyframes rc-wave{to{transform:translate(28px,28px)}}'}</style>
      <rect x={0.75} y={0.75} width={W - 1.5} height={H - 1.5} rx={16} fill={GRASS} />
      <clipPath id={`sea${uid}`}><path d={seaPath} /></clipPath>
      <clipPath id={`panel${uid}`}><rect x={0.75} y={0.75} width={W - 1.5} height={H - 1.5} rx={16} /></clipPath>
      <g clipPath={`url(#panel${uid})`}>
        <path d={seaPath} fill={SEA} />
        <g clipPath={`url(#sea${uid})`}>
          <g transform={mirror}>
            <g style={reduced ? undefined : { animation: 'rc-wave 2.4s linear infinite' }}>
              {crests.map((c, k) => <path key={k} d={`M ${c.x + 14} ${c.y - 14} Q ${c.x} ${c.y} ${c.x - 14} ${c.y + 14}`} fill="none" stroke={CREST} strokeWidth={2.4} strokeLinecap="round" />)}
            </g>
          </g>
        </g>
        <path d={sandPath} fill={SAND} />
        <path d={top} fill="none" stroke={WET} strokeWidth={7} strokeLinejoin="round" transform="translate(0 4)" />
        <path d={top} fill="none" stroke="#F6FBFE" strokeWidth={3} strokeLinejoin="round" />
        <rect x={0} y={BACK} width={W} height={7} fill={PROM} />
        <path d={`M 0 ${BACK + 7} H ${W}`} stroke="#6E7A86" strokeWidth={1} />
      </g>
      <g aria-hidden="true">
        {Array.from({ length: BAYS }, (_, k) => (k === hotel ? <Hotel key={k} x={k * BAY_W} /> : <Houses key={k} x={k * BAY_W} />))}
      </g>
      {[1, 2, 3, 4].map((s) => <Groyne key={s} x={s * BAY_W} top={GROYNE_TOP} offer={!g.includes(s)} />)}
      {pebbles.map((p, i) => {
        const swash = p.u % 1 < 0.5
        const ytop = Math.min(shoreAt(sx(p.x)) + 11, BACK - 16)
        const ybot = BACK - 9
        const f = (p.u % 1) * 2
        const y = swash ? ytop + (ybot - ytop) * f : ybot - (ybot - ytop) * (f - 1)
        return (
          <g key={i} transform={`translate(${f1(sx(p.x))} ${f1(y)})`} data-pebble={i}>
            <circle r={6} fill={STONES[i % STONES.length]} stroke="#4B4F55" strokeWidth={1.1} />
            <path d="M -3 -1.5 Q -1 -4 2 -3.2" fill="none" stroke="#FFFFFF" strokeOpacity={0.55} strokeWidth={1.2} strokeLinecap="round" />
          </g>
        )
      })}
      {!finished && !locked && [1, 2, 3, 4].map((s) => <Clip key={s} x={s * BAY_W} y={CLIP_Y} adds={!g.includes(s)} />)}
      <g aria-hidden="true" fontFamily={FONT}>
        <g transform={flip ? `translate(${W - 16} 14) scale(-1 1)` : 'translate(16 14)'}>
          <path d="M 0 6 L 20 26 M 8 26 H 20 V 14" fill="none" stroke="#1D4F73" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </g>
        <text x={flip ? W - 48 : 48} y={26} textAnchor={flip ? 'end' : 'start'} fontSize={13} fontWeight={700} fill="#1D4F73">Waves</text>
      </g>
      {!finished && !locked && [1, 2, 3, 4].map((s) => (
        <PlotButton key={s} x={s * BAY_W} y={CLIP_Y} label={g.includes(s) ? `Take up the groyne at line ${s}` : `Build a groyne at line ${s}`} onPress={() => onGroyne(s)} />
      ))}
    </>
  )
}

// ---------------------------------------------------------------------------

function Swatch({ kind }: { kind: 'fast' | 'sand' | 'house' | 'pebble' | 'groyne' }) {
  return (
    <svg viewBox="0 0 18 12" className="h-3 w-[18px] shrink-0" aria-hidden="true">
      {kind === 'fast' && <line x1={1} x2={17} y1={6} y2={6} stroke={FAST} strokeWidth={2.4} strokeLinecap="round" strokeDasharray="6 3" />}
      {kind === 'sand' && <rect x={1} y={2} width={16} height={8} rx={2} fill={SAND} stroke={SAND_EDGE} strokeWidth={1.2} />}
      {kind === 'house' && <><rect x={4} y={5} width={10} height={6} fill={WALL_COL} stroke={WALL_EDGE} strokeWidth={1} /><path d="M 2 5.5 L 9 0.8 L 16 5.5 Z" fill={ROOF} /></>}
      {kind === 'pebble' && <circle cx={9} cy={6} r={5} fill={STONES[1]} stroke="#4B4F55" strokeWidth={1.1} />}
      {kind === 'groyne' && <rect x={1} y={4} width={16} height={4} rx={1.5} fill={TIMBER} stroke={TIMBER_EDGE} strokeWidth={1} />}
    </svg>
  )
}
const Named = ({ kind, children }: { kind: 'fast' | 'sand' | 'house' | 'pebble' | 'groyne'; children: string }) => (
  <span className="flex items-center gap-1 whitespace-nowrap"><Swatch kind={kind} />{children}</span>
)

const stepBtn = 'nodrag flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-lg border-2 border-ss-line bg-ss-panel text-[16px] font-extrabold leading-none text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'

function describe(config: RcConfig, state: RcState, t: number): string {
  if (config.task === 'meander') {
    const here = SITES.find((s) => s.id === siteIdOf(config, state))!
    const gone = distToRiver(flowOf(config), here, t) < HIT_DIST
    return `A river winds across a floodplain. At year ${Math.round(t * RIVER_YEARS)} its bends have swung ${t < 0.5 ? 'little' : 'wider and further downstream'}. A house stands on plot ${here.n}${gone ? ', and the river has reached it' : ''}. Six numbered plots can hold the house.`
  }
  const lvl = levelsAt(fromOf(config), groynesOf(state), t)[hotelBay(config)]
  const n = groynesOf(state).length
  return `A beach seen from above, with waves arriving at a slant from the ${fromOf(config)}. ${n === 0 ? 'No groynes are built.' : `${n} ${n === 1 ? 'groyne is' : 'groynes are'} built.`} At year ${Math.round(t * BEACH_YEARS)} the beach in front of the hotel is ${lvl > 0.8 ? 'thick' : lvl > 0.55 ? 'of middling thickness' : lvl > 0.3 ? 'thin' : 'almost bare'}.`
}

export function RiverCoastView({ config, state: given, setState, marked, reduced, locked }: Props) {
  const state = marked === 'shown' ? riverCoastEngine.solve(config) : given
  const finished = marked === 'right' || marked === 'shown'
  const [bump, setBump] = useState(0)
  const target = marked !== 'idle' ? TMAX : timeOf(state)
  const t = useShown(target, (state.run ?? 0) + bump, reduced)
  const per = config.task === 'meander' ? RIVER_YEARS : BEACH_YEARS

  // The pebbles: a live simulation in drift coordinates, so that a groyne holds them on the side they come from.
  const from = fromOf(config)
  const dgroynes = useMemo(() => groynesOf(state).map((s) => driftSite(from, s)), [state, from])
  const stuff = useRef(dgroynes)
  stuff.current = dgroynes
  const still = useMemo(() => settledPebbles(dgroynes), [dgroynes])
  const [live, setLive] = useState<Pebbles>(() => startPebbles())
  useEffect(() => {
    if (reduced || config.task !== 'drift') return
    let raf = 0
    let last = 0
    let ps = startPebbles()
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016
      last = now
      ps = stepPebbles(ps, stuff.current, dt)
      setLive(ps)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [reduced, config.task])
  const pebbles = reduced ? still : live

  const set = (next: Partial<RcState>) => {
    if (locked) return
    setState({ ...state, ...next })
  }
  const onPlot = (id: string) => set({ site: id, t: TMAX, run: (state.run ?? 0) + 1 })
  const onGroyne = (s: number) => {
    const g = groynesOf(state)
    set({ groynes: g.includes(s) ? g.filter((x) => x !== s) : [...g, s].sort(), t: TMAX, run: (state.run ?? 0) + 1 })
  }
  const stepBy = (d: number) => set({ t: clamp(timeOf(state) + d, 0, TMAX), run: state.run ?? 0 })
  const replay = () => {
    setBump((b) => b + 1)
    set({ t: TMAX })
  }
  const onKey = (e: React.KeyboardEvent) => {
    const by = ({ ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 } as Record<string, number>)[e.key]
    if (by === undefined) return
    // The board moves a selected card with the arrows; here they set the years.
    e.preventDefault()
    e.stopPropagation()
    stepBy(by)
  }

  const said = finished ? working(config, state) : marked === 'wrong' ? madeText(config, state) : ''
  const lead = said.match(/^(Yes\. [^.]*\.)\s*(.*)$/)
  const shownYears = Math.round(timeOf(state) * per)
  const alt = describe(config, state, t)

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-2 [&:has(button:focus-visible)_.rc-kbd]:block">
      <figure className="m-0 flex w-full flex-col gap-1.5">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={alt} className="block h-auto w-full select-none">
          {config.task === 'meander'
            ? <RiverPlan config={config} state={state} t={t} reduced={reduced} finished={finished} locked={locked} onPlot={onPlot} />
            : <BeachPlan config={config} state={state} t={t} reduced={reduced} finished={finished} locked={locked} pebbles={pebbles} onGroyne={onGroyne} />}
          <rect x={0.75} y={0.75} width={W - 1.5} height={H - 1.5} rx={16} fill="none" stroke={PLATE_EDGE} strokeWidth={1.5} />
        </svg>
        <figcaption className="flex flex-wrap justify-center gap-x-3 gap-y-0.5 text-[12px] font-semibold text-ss-slate" aria-hidden="true">
          {config.task === 'meander' ? (
            <>
              <Named kind="fast">Fast water</Named>
              <Named kind="sand">Sand</Named>
              <Named kind="house">House</Named>
            </>
          ) : (
            <>
              <Named kind="pebble">Pebble</Named>
              <Named kind="groyne">Groyne</Named>
              <Named kind="sand">Sand</Named>
            </>
          )}
        </figcaption>
      </figure>

      <div className="flex items-center justify-between gap-2">
        <span id="rc-years" className="text-[12px] font-bold text-ss-slate">Years</span>
        <span className="flex items-center gap-1">
          <button type="button" aria-label={`Go back ${per} years`} className={stepBtn} disabled={locked || timeOf(state) <= 0} onClick={() => stepBy(-1)}>−</button>
          <span
            role="spinbutton" tabIndex={locked ? -1 : 0} aria-labelledby="rc-years" aria-valuenow={shownYears} aria-valuemin={0} aria-valuemax={TMAX * per}
            aria-valuetext={`${shownYears} years`} aria-disabled={locked || undefined} onKeyDown={onKey}
            className="nodrag min-w-[40px] rounded-md px-0.5 text-center text-[15px] font-extrabold tabular-nums text-ss-ink outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--subject)]"
          >{shownYears}</span>
          <button type="button" aria-label={`Run on ${per} years`} className={stepBtn} disabled={locked || timeOf(state) >= TMAX} onClick={() => stepBy(1)}>+</button>
        </span>
        <button
          type="button" aria-label="Replay from the start" onClick={replay}
          className="nodrag h-7 whitespace-nowrap rounded-lg border-2 border-ss-line bg-ss-panel px-2.5 text-[12px] font-bold text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] motion-reduce:transition-none"
        >Replay</button>
      </div>

      <p className="rc-kbd hidden text-[12px] font-semibold text-ss-slate">Tab moves between plots or lines. Enter chooses one. Arrow keys change the years.</p>
      <span className="sr-only" aria-live="polite">{alt}</span>
      {marked !== 'idle' && (
        <div className="rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2">
          <p className="text-[13px] font-extrabold leading-snug text-ss-ink">{lead ? lead[1] : said}</p>
          {lead && lead[2] && <p className="mt-0.5 text-[12px] font-semibold leading-snug text-ss-slate">{lead[2]}</p>}
        </div>
      )}
    </div>
  )
}
