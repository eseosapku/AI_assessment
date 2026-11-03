'use client'
import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { SceneViewProps } from '../types'
import type { BeadsConfig, ThermalConfig, ThermalState, WrapConfig } from './config'
import {
  beadsOf, clock, degrees, dropSeconds, heatFraction, horizonOf, lossOf, madeText, tempAt, thermalTransferEngine, working, wrappingOf,
} from './config'

type Props = SceneViewProps<ThermalConfig, ThermalState>

// A bench is not a dark subject: a quiet light plate, as network-sim's and measure-shape's are, with the real apparatus on it.
// The plate keeps its own colours in both themes. No gradients, glows or shadows; the rods' heat is flat steps along them.
const PLATE = '#F8FAFC'
const PLATE_EDGE = '#CBD5E1'
const INK = '#16202A'
const SOFT = '#475569'
const FONT = 'system-ui, sans-serif'
const STEEL = '#64748B'
const STEEL_LIGHT = '#94A3B8'
const WATER = '#B9D8F2'
const WATER_EDGE = '#7BA7D1'
const HOT = '#CF4A2F'
const ARROW = '#E0702A'
const WAX = '#F1E7C9'
const WAX_EDGE = '#B49C60'
const BALL = '#A3ADB8'
const BALL_EDGE = '#58636F'
const WOOL = ['#E9DDC3', '#DCCBA8']
const WOOL_EDGE = '#A8956B'
const FOIL = '#D7DDE3'
const FOIL_EDGE = '#8793A0'
const GLASS = '#8FA6B8'
const BENCH = '#D9CBB1'
const BENCH_EDGE = '#B29F7C'
const METAL: Record<string, string> = { aluminium: '#B9C2CC', brass: '#CFB052', copper: '#C9824F', iron: '#7C8590' }

// The beads board, in plate units. Every literal here is checked against the config's in the tests.
export const W = 360
export const H = 236
export const X0 = 72
export const PX = 17
export const WRAP_H = 208
/** How long a rod is, and which centimetres a ball may sit on; how many layers of wool there can be. */
export const RODS = 15
export const BMIN = 1
export const BMAX = 14
export const WOOLS = 3

const f1 = (n: number) => n.toFixed(1)
const lerp = (a: number, b: number, k: number) => a + (b - a) * k
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

function mix(a: string, b: string, k: number): string {
  const p = (s: string) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16))
  const x = p(a)
  const y = p(b)
  return `#${[0, 1, 2].map((i) => Math.round(lerp(x[i], y[i], k)).toString(16).padStart(2, '0')).join('')}`
}

/** The row each rod sits in, from the top, and where its tray is. */
export function rowsOf(n: number): number[] {
  return n === 2 ? [76, 156] : [50, 108, 166]
}

/** The clock. It runs from 0 to `end` in `seconds`, then rests; a move restarts it, and the learner can wind it. */
function useClock(end: number, key: string, reduced: boolean, rest: number, hold: boolean, seconds: number) {
  const [t, setT] = useState(reduced ? rest : 0)
  const [manual, setManual] = useState<number | null>(null)
  const now = useRef(0)
  const playing = useRef(!reduced)
  const live = useRef({ end, hold, seconds })
  live.current = { end, hold, seconds }

  useEffect(() => {
    setManual(null)
    if (reduced) return
    playing.current = true
    now.current = 0
    setT(0)
  }, [key, reduced])

  useEffect(() => {
    if (reduced) return
    let raf = 0
    let last = 0
    const tick = (ms: number) => {
      raf = requestAnimationFrame(tick)
      const dt = last ? Math.min(0.05, (ms - last) / 1000) : 0.016
      last = ms
      const l = live.current
      if (!playing.current || l.hold) return
      now.current = Math.min(l.end, now.current + (dt * l.end) / l.seconds)
      if (now.current >= l.end) playing.current = false
      setT(now.current)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [reduced])

  const scrub = (v: number) => {
    if (reduced) {
      setManual(v)
      return
    }
    playing.current = false
    now.current = v
    setT(v)
  }
  const replay = () => {
    now.current = 0
    playing.current = true
    setT(0)
  }
  const back = () => {
    now.current = 0
    setT(0)
  }
  return { t: reduced ? manual ?? rest : t, scrub, replay, back }
}

/** A wavy or straight arrow whose head grows with its width. */
function Arrow({ from, to, w, wave = 0, dash, faint }: { from: { x: number; y: number }; to: { x: number; y: number }; w: number; wave?: number; dash?: string; faint: number }) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len
  const nx = -uy
  const ny = ux
  const hl = 5 + w * 1.5
  const hw = 2.8 + w * 0.8
  const shaft = len - hl * 0.8
  const pts: string[] = []
  const steps = 24
  for (let i = 0; i <= steps; i++) {
    const s = i / steps
    const off = wave * Math.sin(s * Math.PI * 4) * Math.min(1, s * 6)
    pts.push(`${i === 0 ? 'M' : 'L'} ${f1(from.x + ux * shaft * s + nx * off)} ${f1(from.y + uy * shaft * s + ny * off)}`)
  }
  const bx = to.x - ux * hl
  const by = to.y - uy * hl
  return (
    <g opacity={faint}>
      <path d={pts.join(' ')} fill="none" stroke={ARROW} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={dash} />
      <path d={`M ${f1(to.x)} ${f1(to.y)} L ${f1(bx + nx * hw)} ${f1(by + ny * hw)} L ${f1(bx - nx * hw)} ${f1(by - ny * hw)} Z`} fill={ARROW} />
    </g>
  )
}

export const WRAP_LABELS = {
  conduction: { x: 4, y: 90, anchor: 'start' as const },
  convection: { x: 122, y: 36, anchor: 'middle' as const },
  radiation: { x: 184, y: 112, anchor: 'start' as const },
  water: { x: 258, y: 24, anchor: 'start' as const },
}
export const BEADS_LABELS = { bath: { x: 9, y: 14 } }

const Label = ({ x, y, anchor = 'start', children }: { x: number; y: number; anchor?: 'start' | 'middle' | 'end'; children: string }) => (
  <text x={f1(x)} y={f1(y)} textAnchor={anchor} fontSize={13} fontWeight={700} fill={SOFT} stroke={PLATE} strokeWidth={3} paintOrder="stroke" strokeLinejoin="round" fontFamily={FONT} aria-hidden="true">{children}</text>
)

const readout = 'text-[15px] font-extrabold tabular-nums text-ss-ink'
const labelClass = 'text-[12px] font-bold text-ss-slate'
const button = 'nodrag flex h-7 shrink-0 select-none items-center justify-center rounded-lg border-2 border-ss-line bg-ss-panel text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'

/** The slim slider that winds the clock, as particles' temperature slider is: a label, the slider, a readout. */
function ClockRow({ t, max, step, text, spoken, onScrub, onReplay, reduced, locked }: {
  t: number; max: number; step: number; text: string; spoken: string; onScrub(v: number): void; onReplay?(): void; reduced: boolean; locked?: boolean
}) {
  const id = useId()
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className={labelClass}>{onReplay ? 'Clock' : 'Time'}</label>
      <input
        id={id} type="range" min={0} max={max} step={step} value={clamp(t, 0, max)} disabled={locked}
        aria-valuetext={spoken}
        className="nodrag min-w-0 flex-1 accent-[color:var(--subject)]"
        onChange={(e) => onScrub(Number(e.target.value))}
        onKeyDown={(e) => e.stopPropagation()}
      />
      <span className={`${readout} w-[58px] text-right`}>{text}</span>
      {onReplay && !reduced && (
        <button type="button" className={`${button} px-2.5 text-[12px] font-bold whitespace-nowrap`} onClick={onReplay} aria-label="Run the experiment again">Run again</button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// The wax-and-rod test.

function Ball({ x, y, fall, sag }: { x: number; y: number; fall: number; sag: number }) {
  const hang = y + 10.5
  const rest = y + 22.5
  const by = lerp(hang + sag * 1.2, rest, fall)
  return (
    <g>
      {fall <= 0 && <ellipse cx={f1(x)} cy={f1(y + 5.4)} rx={4.6 + sag * 0.8} ry={2.6 + sag * 1.6} fill={WAX} stroke={WAX_EDGE} strokeWidth={1.2} />}
      <circle cx={f1(x)} cy={f1(by)} r={5.4} fill={BALL} stroke={BALL_EDGE} strokeWidth={1.3} />
      <circle cx={f1(x - 1.5)} cy={f1(by - 1.6)} r={1.3} fill="#FFFFFF" />
    </g>
  )
}

function Chevron({ x, y, dir }: { x: number; y: number; dir: -1 | 1 }) {
  return <path d={`M ${f1(x - dir * 2.4)} ${f1(y - 3.8)} L ${f1(x + dir * 1.8)} ${f1(y)} L ${f1(x - dir * 2.4)} ${f1(y + 3.8)}`} fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ stroke: 'var(--subject)' }} />
}

function BeadsBoard({ config, state, setState, marked, reduced, locked }: Props & { config: BeadsConfig }) {
  const shown = marked === 'shown' ? thermalTransferEngine.solve(config) : state
  const at = beadsOf(config, shown)
  const rods = config.rods
  const rows = rowsOf(rods.length)
  const clipId = useId().replace(/:/g, '')
  const horizon = horizonOf(rods)
  const times = rods.map((r) => dropSeconds(at[r], r))
  const last = Math.max(...times)
  const end = clamp(last * 1.12, 30, horizon)
  const placing = rods.map((r) => at[r]).join(',')
  const [holding, setHolding] = useState(false)
  const { t, scrub, replay, back } = useClock(end, `${placing}|${marked === 'right' || marked === 'shown' ? 'done' : 'open'}`, reduced, (Math.min(...times) + last) / 2, holding, 6)
  const fallFor = Math.max(1.5, end * 0.05)
  const finished = marked === 'right' || marked === 'shown'
  const canMove = !locked && !finished
  const drag = useRef<{ rod: string; box: DOMRect } | null>(null)

  const put = (rod: string, cm: number) => {
    if (!canMove) return
    const next = clamp(Math.round(cm), BMIN, BMAX)
    if (next === at[rod]) return
    setState({ beads: { ...at, [rod]: next } })
  }
  const cmFrom = (e: PointerEvent<HTMLElement>, box: DOMRect) => {
    const x = ((e.clientX - box.left) / box.width) * W
    return (x - X0) / PX
  }
  const down = (rod: string) => (e: PointerEvent<HTMLDivElement>) => {
    if (!canMove || e.button !== 0) return
    e.preventDefault()
    // The whole overlay spans the plate, so the box is the plate's.
    const box = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect()
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { rod, box }
    setHolding(true)
    back()
    put(rod, cmFrom(e, box))
  }
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (d) put(d.rod, cmFrom(e, d.box))
  }
  const up = () => {
    drag.current = null
    setHolding(false)
  }
  const key = (rod: string) => (e: KeyboardEvent) => {
    const by = ({ ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 3, PageDown: -3 } as Record<string, number>)[e.key]
    if (by === undefined && e.key !== 'Home' && e.key !== 'End') return
    // The board moves a selected card with the arrows; here they move the ball.
    e.preventDefault()
    e.stopPropagation()
    put(rod, e.key === 'Home' ? BMIN : e.key === 'End' ? BMAX : at[rod] + (by ?? 0))
  }

  const dropped = rods.filter((r, i) => t >= times[i]).length
  const seen = `${rods.length} metal rods, ${rods.join(', ')}, stand in a bath of boiling water. Each has a ball bearing hanging from it on a dab of wax, at its own distance from the bath. The rods redden from the bath end as heat travels along them. At ${clock(t)} on the clock, ${dropped} of ${rods.length} balls have dropped.`

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-2 [&:has(:focus-visible)_.tt-kbd]:block">
      <figure className="m-0 flex w-full flex-col gap-1.5">
        <div className="relative w-full">
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={seen} className="block h-auto w-full select-none">
            <rect x={0.75} y={0.75} width={W - 1.5} height={H - 1.5} rx={16} fill={PLATE} stroke={PLATE_EDGE} strokeWidth={1.5} />
            {/* The bath: a steel tank of boiling water on a hot plate, with the rods through its wall. */}
            <rect x={11} y={22} width={58} height={184} rx={5} fill={WATER} stroke={WATER_EDGE} strokeWidth={1.5} />
            <rect x={11} y={22} width={58} height={20} rx={5} fill={PLATE} />
            <path d="M 11 42 H 69" stroke={WATER_EDGE} strokeWidth={1.5} />
            {[[24, 190], [48, 176], [36, 150], [20, 128], [54, 100], [30, 76], [50, 60]].map(([cx, cy]) => <circle key={`${cx}${cy}`} cx={cx} cy={cy} r={2.4} fill="none" stroke="#FFFFFF" strokeWidth={1.3} />)}
            <rect x={7} y={204} width={66} height={9} rx={3} fill={STEEL} />
            {rods.map((rod, i) => {
              const y = rows[i]
              const x = at[rod]
              const bx = X0 + x * PX
              const fall = clamp((t - times[i]) / fallFor, 0, 1)
              const warm = heatFraction(x, rod, t)
              const sag = clamp((warm - 0.28) / 0.22, 0, 1)
              return (
                <g key={rod} data-rod={rod}>
                  <clipPath id={`${clipId}-${rod}`}><rect x={30} y={y - 4.5} width={X0 + RODS * PX - 30} height={9} rx={4} /></clipPath>
                  <g clipPath={`url(#${clipId}-${rod})`}>
                    <rect x={30} y={y - 4.5} width={X0 - 30 + 1} height={9} fill={HOT} />
                    {Array.from({ length: RODS }, (_, c) => (
                      <rect key={c} x={f1(X0 + c * PX)} y={y - 4.5} width={PX + 0.6} height={9} fill={mix(METAL[rod] ?? '#999999', HOT, heatFraction(c + 0.5, rod, t))} data-heat={f1(heatFraction(c + 0.5, rod, t))} />
                    ))}
                    <rect x={30} y={y - 4.5} width={X0 + RODS * PX - 30} height={2} fill="#FFFFFF" opacity={0.35} />
                    <rect x={30} y={y + 2.5} width={X0 + RODS * PX - 30} height={2} fill="#000000" opacity={0.14} />
                  </g>
                  <rect x={30} y={y - 4.5} width={X0 + RODS * PX - 30} height={9} rx={4} fill="none" stroke="#475569" strokeWidth={1} />
                  {/* The tray that catches what falls from this rod. */}
                  <rect x={X0} y={y + 28} width={RODS * PX} height={3.5} rx={1.5} fill={STEEL_LIGHT} />
                  <Ball x={bx} y={y} fall={fall} sag={sag} />
                  {canMove && fall <= 0 && (
                    <g>
                      <Chevron x={bx - 12} y={y + 10.5} dir={-1} />
                      <Chevron x={bx + 12} y={y + 10.5} dir={1} />
                    </g>
                  )}
                </g>
              )
            })}
            {/* The tank's wall, with a collar where each rod goes through. */}
            <rect x={67} y={22} width={5} height={184} rx={2} fill={STEEL} />
            {rows.map((y) => <rect key={y} x={64} y={y - 8} width={11} height={16} rx={2.5} fill={STEEL_LIGHT} stroke={STEEL} strokeWidth={1} />)}
            {/* The ruler, in centimetres from the bath. */}
            <g stroke={SOFT} strokeWidth={1}>
              <line x1={X0} x2={X0 + RODS * PX} y1={209} y2={209} />
              {Array.from({ length: RODS + 1 }, (_, c) => <line key={c} x1={X0 + c * PX} x2={X0 + c * PX} y1={209} y2={c % 5 === 0 ? 216 : 213} />)}
            </g>
            <g fontFamily={FONT} fontSize={12} fontWeight={700} fill={SOFT} textAnchor="middle" aria-hidden="true">
              {[0, 5, 10, 15].map((c) => <text key={c} x={X0 + c * PX} y={230}>{c}</text>)}
            </g>
            <Label {...BEADS_LABELS.bath}>boiling water</Label>
            {rods.map((rod, i) => <Label key={rod} x={X0 + 6} y={rows[i] - 10}>{rod}</Label>)}
          </svg>
          {canMove && rods.map((rod, i) => (
            <div
              key={rod}
              className="nodrag absolute touch-none"
              style={{ left: `${((X0 - 8) / W) * 100}%`, width: `${((RODS * PX + 16) / W) * 100}%`, top: `${((rows[i] - 14) / H) * 100}%`, height: `${(44 / H) * 100}%`, cursor: 'ew-resize' }}
              onPointerDown={down(rod)} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
              data-row={rod}
            >
              <div
                role="slider" tabIndex={0}
                aria-label={`Ball on the ${rod} rod`} aria-valuemin={BMIN} aria-valuemax={BMAX} aria-valuenow={at[rod]}
                aria-valuetext={`${at[rod]} centimetres from the bath`} aria-orientation="horizontal"
                onKeyDown={key(rod)}
                className="absolute rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--subject)]"
                style={{ left: `${((X0 + at[rod] * PX) / W) * 100}%`, top: `${((rows[i] + 10.5 - (rows[i] - 14)) / 44) * 100}%`, width: 32, height: 32, transform: 'translate(-50%, -50%)' }}
              />
            </div>
          ))}
        </div>
        <figcaption className="text-center text-[12px] font-semibold text-ss-slate" aria-hidden="true">
          Balls hang on wax from rods in boiling water. Redder means hotter. Ruler: cm from the bath.
        </figcaption>
      </figure>

      <ClockRow
        t={t} max={horizon} step={1} text={clock(t)} spoken={`${clock(t)} on the clock`} onScrub={scrub} onReplay={replay} reduced={reduced} locked={false}
      />
      <p className="tt-kbd hidden text-[12px] font-semibold text-ss-slate">Tab to a ball, then the arrow keys slide it one centimetre.</p>
      <p className="sr-only">
        {rods.map((r) => `The ball on the ${r} rod is ${at[r]} centimetres from the bath and drops at ${clock(dropSeconds(at[r], r))}.`).join(' ')}
      </p>
      <Said config={config} state={shown} marked={marked} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// The cup.

// Plate units for the cup. Every literal is checked against the config's in the tests.
export const CX = 122
export const HALF = 32
export const GLASS_W = 3
export const BASE = 176
export const RIM = 90
export const LID_Y = 82
export const WATER_Y = 106
export const WOOL_TOP = 98
export const LAYER = 7
export const FOIL_W = 3
// The thermometer: a plate on the wall, with its scale and the target.
const T_Y0 = 152
const T_Y100 = 36
const yOfTemp = (c: number) => T_Y0 - ((clamp(c, 0, 100) / 100) * (T_Y0 - T_Y100))

/** A column of knit stitches: a zigzag down the middle of a wool layer. */
function knit(cx: number, y0: number, y1: number): string {
  const pts: string[] = []
  for (let y = y0, k = 0; y <= y1; y += 4, k++) pts.push(`${k === 0 ? 'M' : 'L'} ${f1(cx + (k % 2 ? 2 : -2))} ${y}`)
  return pts.join(' ')
}

function Cup({ wool, lid, foil, hot }: { wool: number; lid: boolean; foil: boolean; hot: boolean }) {
  const inner = HALF + GLASS_W
  const strips = Array.from({ length: wool }, (_, k) => k + 1)
  const out = inner + wool * LAYER
  return (
    <g>
      {/* The bench the cup stands on. */}
      <rect x={14} y={BASE} width={228} height={8} rx={3} fill={BENCH} stroke={BENCH_EDGE} strokeWidth={1} />
      {/* Wool, in section: each layer is a strip each side, outermost first. */}
      {[...strips].reverse().map((k) => (
        <g key={k} data-wool={k}>
          {[-1, 1].map((side) => {
            const x = side < 0 ? CX - inner - k * LAYER : CX + inner + (k - 1) * LAYER
            return (
              <g key={side}>
                <rect x={x} y={WOOL_TOP} width={LAYER} height={BASE - WOOL_TOP} fill={WOOL[k % 2]} stroke={WOOL_EDGE} strokeWidth={0.8} />
                <path d={knit(x + LAYER / 2, WOOL_TOP + 3, BASE - 2)} fill="none" stroke={WOOL_EDGE} strokeWidth={1.1} strokeLinejoin="round" />
              </g>
            )
          })}
        </g>
      ))}
      {foil && (
        <g data-foil="1">
          {[-1, 1].map((side) => {
            const x = side < 0 ? CX - out - FOIL_W : CX + out
            return (
              <g key={side}>
                <rect x={x} y={WOOL_TOP} width={FOIL_W} height={BASE - WOOL_TOP} fill={FOIL} stroke={FOIL_EDGE} strokeWidth={0.8} />
                <line x1={x + 1} x2={x + 1} y1={WOOL_TOP + 2} y2={BASE - 3} stroke="#FFFFFF" strokeWidth={1} strokeDasharray="5 7" />
              </g>
            )
          })}
        </g>
      )}
      {/* The beaker: water, glass walls, a thick base. */}
      <rect x={CX - HALF} y={WATER_Y} width={HALF * 2} height={BASE - WATER_Y - GLASS_W} fill={hot ? WATER : '#A5C8EA'} />
      <path d={`M ${CX - HALF} ${WATER_Y} H ${CX + HALF}`} stroke={WATER_EDGE} strokeWidth={1.2} />
      <path d={`M ${CX - inner} ${RIM} V ${BASE} H ${CX + inner} V ${RIM}`} fill="none" stroke={GLASS} strokeWidth={GLASS_W} strokeLinejoin="round" />
      <g stroke={WATER_EDGE} strokeWidth={1}>
        {[132, 144, 156].map((y) => <line key={y} x1={CX + HALF - 7} x2={CX + HALF} y1={y} y2={y} />)}
      </g>
      <path d={`M ${CX - HALF - 0.5} ${RIM + 6} V ${RIM + 24}`} stroke="#FFFFFF" strokeWidth={1.6} strokeLinecap="round" opacity={0.8} />
      {lid && (
        <g data-lid="1">
          <rect x={CX - inner - 5} y={LID_Y} width={(inner + 5) * 2} height={8} rx={3} fill={STEEL} stroke="#475569" strokeWidth={1} />
          <rect x={CX - 7} y={LID_Y - 6} width={14} height={7} rx={2.5} fill={STEEL} stroke="#475569" strokeWidth={1} />
          {hot && [-18, -4, 12, 24].map((dx) => <circle key={dx} cx={CX + dx} cy={LID_Y + 12} r={1.8} fill={WATER} stroke={WATER_EDGE} strokeWidth={0.8} />)}
        </g>
      )}
    </g>
  )
}

export const THERMO = { x: 252, y: 8, w: 100, h: 166, tube: 290 }

function Thermometer({ now, target, drink }: { now: number; target: number; drink: 'hot' | 'cold' }) {
  const top = yOfTemp(now)
  const tx = THERMO.tube
  return (
    <g>
      <rect x={THERMO.x} y={THERMO.y} width={THERMO.w} height={THERMO.h} rx={8} fill="#FFFFFF" stroke={PLATE_EDGE} strokeWidth={1.2} />
      <Label {...WRAP_LABELS.water}>water</Label>
      <rect x={tx - 4} y={T_Y100 - 6} width={8} height={T_Y0 - T_Y100 + 10} rx={4} fill="#FFFFFF" stroke={GLASS} strokeWidth={1.4} />
      <circle cx={tx} cy={T_Y0 + 8} r={7.5} fill={HOT} stroke={GLASS} strokeWidth={1.4} />
      <rect x={tx - 1.8} y={f1(top)} width={3.6} height={f1(T_Y0 + 6 - top)} fill={HOT} data-reading={Math.round(now)} />
      <g stroke={SOFT} strokeWidth={1}>
        {Array.from({ length: 11 }, (_, k) => <line key={k} x1={tx - 6} x2={tx - (k % 2 === 0 ? 11 : 9)} y1={yOfTemp(k * 10)} y2={yOfTemp(k * 10)} />)}
      </g>
      <g fontFamily={FONT} fontSize={12} fontWeight={600} fill={SOFT} textAnchor="end" aria-hidden="true">
        {[0, 20, 40, 60, 80, 100].map((v) => <text key={v} x={tx - 14} y={yOfTemp(v) + 4}>{v}</text>)}
      </g>
      <g data-target={target}>
        <line x1={tx - 4} x2={tx + 13} y1={yOfTemp(target)} y2={yOfTemp(target)} stroke={INK} strokeWidth={1.5} strokeDasharray="3 2" />
        <text x={tx + 16} y={yOfTemp(target) + 4.5} fontSize={12} fontWeight={700} fill={SOFT} fontFamily={FONT} aria-hidden="true">target</text>
      </g>
      <title>{`Thermometer: ${degrees(now)}, ${drink === 'hot' ? 'to stay above' : 'to stay below'} ${target} °C`}</title>
    </g>
  )
}

function Stepper({ label, noun, value, max, set, locked }: { label: string; noun: string; value: number; max: number; set(n: number): void; locked: boolean }) {
  const id = useId()
  const bump = (by: number) => {
    if (locked) return
    const next = clamp(value + by, 0, max)
    if (next !== value) set(next)
  }
  const onKey = (e: KeyboardEvent) => {
    const by = ({ ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, '+': 1, '=': 1, '-': -1 } as Record<string, number>)[e.key]
    if (by === undefined && e.key !== 'Home' && e.key !== 'End') return
    e.preventDefault()
    e.stopPropagation()
    if (e.key === 'Home') bump(-value)
    else if (e.key === 'End') bump(max - value)
    else bump(by)
  }
  return (
    <div className="flex items-center justify-between gap-1.5">
      <span id={id} className={labelClass}>{label}</span>
      <span className="flex items-center gap-1">
        <button type="button" tabIndex={-1} aria-label={`Take away a ${noun}`} className={`${button} w-7 text-[16px] font-extrabold leading-none`} disabled={locked || value <= 0} onClick={() => bump(-1)}>−</button>
        <span
          role="spinbutton" tabIndex={locked ? -1 : 0} aria-labelledby={id}
          aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} aria-valuetext={`${value} ${value === 1 ? noun : `${noun}s`}`}
          aria-disabled={locked || undefined} onKeyDown={onKey}
          className="nodrag min-w-[28px] rounded-md px-0.5 text-center text-[15px] font-extrabold tabular-nums text-ss-ink outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--subject)]"
        >{value}</span>
        <button type="button" tabIndex={-1} aria-label={`Add a ${noun}`} className={`${button} w-7 text-[16px] font-extrabold leading-none`} disabled={locked || value >= max} onClick={() => bump(1)}>+</button>
      </span>
    </div>
  )
}

function Toggle({ label, noun, on, set, locked }: { label: string; noun: string; on: boolean; set(v: boolean): void; locked: boolean }) {
  return (
    <div className="flex items-center justify-between gap-1.5">
      <span className={labelClass}>{label}</span>
      <button
        type="button" aria-pressed={on} aria-label={`${noun}: ${on ? 'on' : 'off'}`} disabled={locked} onClick={() => set(!on)}
        className={`${button} w-[56px] text-[13px] font-extrabold ${on ? 'border-[color:var(--subject)]' : ''}`}
      >{on ? 'On' : 'Off'}</button>
    </div>
  )
}

function WrapBoard({ config, state, setState, marked, reduced, locked }: Props & { config: WrapConfig }) {
  const shown = marked === 'shown' ? thermalTransferEngine.solve(config) : state
  const w = wrappingOf(config, shown)
  const hot = config.drink !== 'cold'
  const finished = marked === 'right' || marked === 'shown'
  const canMove = !locked && !finished
  const { t, scrub } = useClock(config.minutes, `${w.wool}${w.lid ? 'L' : ''}${w.foil ? 'F' : ''}`, reduced, config.minutes, false, 3.4)
  const bare = { wool: 0, lid: false, foil: false }
  const water = tempAt(config, w, t)
  const bareNow = tempAt(config, bare, t)
  const loss = lossOf(w)
  const gap = Math.exp((-loss.all * t) / 10000)
  const faint = 0.45 + 0.55 * clamp(gap, 0, 1)
  const scale = (rate: number) => Math.max(1, 9 * (rate / 210))
  const set = (next: Partial<{ wool: number; lid: boolean; foil: boolean }>) => {
    if (!canMove) return
    setState({ wool: w.wool, lid: w.lid, foil: w.foil, ...next })
  }
  // Heat leaves a hot cup and enters a cold one, so the same arrows point the other way.
  const dir = hot ? 1 : -1
  const arrow = (a: { x: number; y: number }, b: { x: number; y: number }) => (dir === 1 ? { from: a, to: b } : { from: b, to: a })
  const drink = hot ? 'water' : 'drink'
  const seen = `A beaker of ${hot ? 'hot' : 'cold'} water in section beside a thermometer, with ${w.wool === 0 ? 'no wool' : `${w.wool} ${w.wool === 1 ? 'layer' : 'layers'} of wool`}, ${w.lid ? 'a lid' : 'no lid'} and ${w.foil ? 'shiny foil' : 'no foil'}. Orange arrows show heat ${hot ? 'leaving the water' : 'entering the drink'} through the wall, over the top and as rays. After ${Math.round(t)} minutes the thermometer reads ${degrees(water)}.`

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-2 [&:has(:focus-visible)_.tt-kbd]:block">
      <figure className="m-0 flex w-full flex-col gap-1.5">
        <svg viewBox={`0 0 ${W} ${WRAP_H}`} role="img" aria-label={seen} className="block h-auto w-full select-none">
          <rect x={0.75} y={0.75} width={W - 1.5} height={WRAP_H - 1.5} rx={16} fill={PLATE} stroke={PLATE_EDGE} strokeWidth={1.5} />
          <Cup wool={w.wool} lid={w.lid} foil={w.foil} hot={hot} />
          {/* Three ways out, or in: each arrow is as thick as the heat that takes that way, and all thin as the water nears the room. */}
          <g data-arrows="1">
            {[132, 156].map((y) => {
              const a = arrow({ x: CX - 22, y }, { x: 18, y })
              return <Arrow key={y} from={a.from} to={a.to} w={scale(loss.wall) * 0.8} faint={faint} />
            })}
            {[-14, 14].map((dx) => {
              const a = arrow({ x: CX + dx, y: WATER_Y - 6 }, { x: CX + dx, y: 46 })
              return <Arrow key={dx} from={a.from} to={a.to} w={scale(loss.top) * 0.8} wave={2.6} faint={faint} />
            })}
            {[126, 142, 158].map((y) => {
              const a = arrow({ x: CX + 22, y }, { x: 218, y })
              return <Arrow key={y} from={a.from} to={a.to} w={scale(loss.rays)} wave={2.4} dash="5 3" faint={faint} />
            })}
          </g>
          {/* Names go on the arrows they name; the lid and the foil are named by the controls. */}
          <Label {...WRAP_LABELS.conduction}>conduction</Label>
          <Label {...WRAP_LABELS.convection}>convection</Label>
          <Label {...WRAP_LABELS.radiation}>radiation</Label>
          <Thermometer now={water} target={config.target} drink={hot ? 'hot' : 'cold'} />
        </svg>
        <figcaption className="text-center text-[12px] font-semibold text-ss-slate" aria-hidden="true">
          {hot ? 'Orange arrows: heat leaving the water.' : 'Orange arrows: heat entering the drink.'} Thicker means more.
        </figcaption>
      </figure>

      <div className="flex flex-col gap-1.5">
        {config.parts.includes('wool') && <Stepper label="Wool layers" noun="layer of wool" value={w.wool} max={WOOLS} set={(n) => set({ wool: n })} locked={!canMove} />}
        {(config.parts.includes('lid') || config.parts.includes('foil')) && (
          <div className="grid grid-cols-2 gap-x-6">
            {config.parts.includes('lid') && <Toggle label="Lid" noun="Lid" on={w.lid} set={(v) => set({ lid: v })} locked={!canMove} />}
            {config.parts.includes('foil') && <Toggle label="Shiny foil" noun="Shiny foil" on={w.foil} set={(v) => set({ foil: v })} locked={!canMove} />}
          </div>
        )}
        <ClockRow t={t} max={config.minutes} step={1} text={`${Math.round(t)} min`} spoken={`${Math.round(t)} minutes`} onScrub={scrub} reduced={reduced} />
        <div className="grid grid-cols-2 gap-x-6 border-t border-ss-line pt-1.5">
          <p className="flex items-baseline justify-between">
            <span className={labelClass}>{hot ? 'Water' : 'Drink'}</span>
            <span className={readout} data-water={water.toFixed(1)}>{degrees(water)}</span>
          </p>
          <p className="flex items-baseline justify-between">
            <span className={labelClass}>Bare cup</span>
            <span className={readout}>{degrees(bareNow)}</span>
          </p>
        </div>
      </div>
      <p className="tt-kbd hidden text-[12px] font-semibold text-ss-slate">Tab moves between the parts. Arrow keys change the layers.</p>
      <span className="sr-only">{`After ${Math.round(t)} minutes the ${drink} reads ${degrees(water)} and a bare cup reads ${degrees(bareNow)}.`}</span>
      <Said config={config} state={shown} marked={marked} />
    </div>
  )
}

/** What is said once marked: a bold first sentence, then the why. */
function Said({ config, state, marked }: { config: ThermalConfig; state: ThermalState; marked: Props['marked'] }) {
  if (marked === 'idle') return null
  const said = marked === 'right' || marked === 'shown' ? working(config, state) : madeText(config, state)
  const lead = said.match(/^(Yes\. [^.]*\.)\s*(.*)$/)
  return (
    <div className="rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2" aria-live="polite">
      <p className="text-[13px] font-extrabold leading-snug text-ss-ink">{lead ? lead[1] : said}</p>
      {lead && lead[2] && <p className="mt-0.5 text-[12px] font-semibold leading-snug text-ss-slate">{lead[2]}</p>}
    </div>
  )
}

export function ThermalTransferView(props: Props) {
  const { config } = props
  return config.task === 'beads' ? <BeadsBoard {...props} config={config} /> : <WrapBoard {...props} config={config} />
}
