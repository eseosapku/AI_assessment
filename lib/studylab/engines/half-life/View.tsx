'use client'
import { memo, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import type { SceneViewProps } from '../types'
import type { DrawConfig, HalfConfig, HalfState, Sample, WaitConfig } from './config'
import {
  amountAt, amountOfLevel, amountTicks, fmt, fmtAxis, halfLifeEngine, halvesFor, isCount, madeLevels, madeStep, madeText, namesOf, sampleOf, shortUnit, spelled, stillWhole, targetStep, timeTicks, working, wrongBeads,
} from './config'

type Props = SceneViewProps<HalfConfig, HalfState>

// A sample on a bench is not a dark subject: a quiet plate, as measure-shape's and network-sim's are. The plate keeps its own
// colours in both themes, so each part keeps its contrast against it. No gradients or shadows.
const PLATE = '#F8FAFC'
const PLATE_EDGE = '#CBD5E1'
const HAIR = '#E2E8F0'
const INK = '#16202A'
const SOFT = '#475569'
const FONT = 'system-ui, sans-serif'
// A nucleus is drawn as atom's are: coral protons, grey neutrons, here with a dark edge for the light plate.
const PROTON = '#E8574F'
const NEUTRON = '#AEB9C9'
const NUCLEON_EDGE = '#5B2A28'
// What it has become: pale and smaller, and plainly not the same thing.
const SPENT = '#F1F5F9'
const SPENT_EDGE = '#7C8BA0'
const FLICK = '#C2410C'
// The tray: a steel dish with a lip.
const RIM = '#E2E8F0'
const RIM_EDGE = '#94A3B8'
const DISH = '#FFFFFF'
// The graph.
const CURVE = '#B4372F'
const AXIS = '#334155'
const GUIDE = '#94A3B8'
// Machines, as network-sim's are.
const CASE = '#334155'
const CASE_TEXT = '#E2E8F0'
const LCD = '#DCE7D6'
const LED_ON = '#22C55E'
const LED_OFF = '#64748B'
const TUBE = '#CBD5E1'
const TUBE_EDGE = '#64748B'

export const W = 360
export const TRAY = { x: 12, y: 8, w: 336, h: 92 }
export const CELL = 20
export const ROWS = 4
/** The graph's title on the left of this row, and the two kinds of nucleus named on the right. */
export const LEGEND_Y = 122
export const TITLE_Y = 122
export const PY0 = 138
export const PY1 = 262
export const PX1 = 344
export const PX0_WAIT = 50
export const PX0_DRAW = 76
export const STEP_TOTAL = 20
export const TICK_Y = 287
export const TITLE_X_Y = 302
export const H_WAIT = 310
export const ROW_A_Y = 285
export const ROW_B_Y = 301
export const H_DRAW = 309
export const THUMB_W = 26
export const THUMB_H = 18
export const BEAD_R = 9
/** Hit areas of the real controls over the drawing. */
export const THUMB_HIT = 36
export const BEAD_HIT = 34
const TOTAL_LEVELS = 64

const f1 = (n: number) => n.toFixed(1)

/** Where each nucleus sits: rows of four, as wide as it takes, centred in the tray. */
export function cellsOf(n: number): { x: number; y: number }[] {
  const cols = Math.ceil(n / ROWS)
  const left = TRAY.x + TRAY.w / 2 - ((cols - 1) * CELL) / 2
  return Array.from({ length: n }, (_, i) => ({ x: left + (i % cols) * CELL, y: TRAY.y + 16 + Math.floor(i / cols) * CELL }))
}

const circle = (x: number, y: number, r: number) => `M${f1(x - r)} ${f1(y)}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0Z`
const around = (count: number, radius: number, turn = 0) => Array.from({ length: count }, (_, i) => ({ x: radius * Math.cos(turn + (i / count) * Math.PI * 2), y: radius * Math.sin(turn + (i / count) * Math.PI * 2) }))
const WHOLE = around(6, 5, 0.35)
const PROTON_D = [{ x: 0, y: 0 }, WHOLE[1], WHOLE[3], WHOLE[5]].map((p) => circle(p.x, p.y, 2.9)).join('')
const NEUTRON_D = [WHOLE[0], WHOLE[2], WHOLE[4]].map((p) => circle(p.x, p.y, 2.9)).join('')
const SPENT_D = around(4, 2.7, 0.6).map((p) => circle(p.x, p.y, 2.5)).join('')

/** One nucleus: a cluster of protons and neutrons; once decayed, a smaller pale cluster. Nothing in between. */
const Nucleus = memo(function Nucleus({ x, y, gone, reduced, scale = 1 }: { x: number; y: number; gone: boolean; reduced: boolean; scale?: number }) {
  const ease = reduced ? undefined : { transition: 'opacity 240ms ease' }
  return (
    <g transform={`translate(${x} ${y})${scale === 1 ? '' : ` scale(${scale})`}`} data-nucleus={gone ? 'gone' : 'whole'}>
      {gone ? (
        <path d={SPENT_D} fill={SPENT} stroke={SPENT_EDGE} strokeWidth={0.9} style={ease} />
      ) : (
        <g style={ease}>
          <path d={NEUTRON_D} fill={NEUTRON} stroke={NUCLEON_EDGE} strokeWidth={0.8} />
          <path d={PROTON_D} fill={PROTON} stroke={NUCLEON_EDGE} strokeWidth={0.8} />
        </g>
      )}
    </g>
  )
})

// ---------------------------------------------------------------------------
// The labels on the picture, placed by rule, so a test can hold them apart.

export type Label = { text: string; x: number; y: number; anchor: 'start' | 'middle' | 'end'; part: { x: number; y: number } }
export const textWidth = (s: string) => s.length * 6.4
const RIGHT_EDGE = 348

/** The two kinds of nucleus, named at the right of the row: each small nucleus sits just before its own name. */
export const legendGlyphs = (config: HalfConfig) => {
  const names = namesOf(config)
  const productX = RIGHT_EDGE - textWidth(names.product)
  const second = productX - 9
  const parentX = second - 14 - textWidth(names.parent)
  return { names, first: parentX - 9, parentX, second, productX }
}

export const axisWord = (config: HalfConfig) => (config.measure === 'nuclei' ? 'nuclei left' : config.measure === 'Bq' ? 'activity (Bq)' : config.measure)

/** A count on the upright axis, and a line on it, for a config: exported for the tests. */
export function labelsOf(config: HalfConfig): Label[] {
  const g = legendGlyphs(config)
  const out: Label[] = [
    { text: g.names.parent, x: g.parentX, y: LEGEND_Y, anchor: 'start', part: { x: g.first, y: LEGEND_Y - 4 } },
    { text: g.names.product, x: g.productX, y: LEGEND_Y, anchor: 'start', part: { x: g.second, y: LEGEND_Y - 4 } },
    { text: axisWord(config), x: 12, y: TITLE_Y, anchor: 'start', part: { x: 12, y: PY0 } },
  ]
  if (showsCounter(config)) out.push(GM_LABEL)
  return out
}

export const GM_LABEL: Label = { text: 'GM tube', x: 346, y: 216, anchor: 'end', part: { x: 326, y: 203 } }
export const showsCounter = (config: HalfConfig) => config.task === 'wait' && isCount(config.measure)

// ---------------------------------------------------------------------------
// The motion: the clock eases to where it was put, and each nucleus it passes goes off.

type Flick = { i: number; age: number }
/** How long a flick lasts, and how far it goes. */
const FLICK_LIFE = 0.55
const FLICK_RUN = 15

function useClock(target: number, sample: Sample, reduced: boolean) {
  const [view, setView] = useState({ shown: target, flicks: [] as Flick[] })
  const live = useRef({ shown: target, flicks: [] as Flick[] })
  const times = useRef(sample.times)
  times.current = sample.times
  useEffect(() => {
    const s = live.current
    if (reduced) {
      s.shown = target
      s.flicks = []
      setView({ shown: target, flicks: [] })
      return
    }
    let raf = 0
    let last = 0
    const tick = (t: number) => {
      const dt = last ? Math.min(0.05, (t - last) / 1000) : 0.016
      last = t
      const before = s.shown
      s.shown += (target - s.shown) * (1 - Math.exp(-dt / 0.3))
      if (Math.abs(target - s.shown) < 0.004) s.shown = target
      const fresh: Flick[] = []
      const aged = s.flicks.map((f) => ({ ...f, age: f.age + dt })).filter((f) => f.age < FLICK_LIFE)
      if (s.shown > before) times.current.forEach((when, i) => { if (when > before && when <= s.shown && !aged.some((f) => f.i === i)) fresh.push({ i, age: 0 }) })
      s.flicks = [...aged, ...fresh]
      setView({ shown: s.shown, flicks: s.flicks })
      if (s.shown !== target || s.flicks.length) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, reduced])
  return reduced ? { shown: target, flicks: [] as Flick[] } : view
}

function Flicks({ flicks, cells }: { flicks: Flick[]; cells: { x: number; y: number }[] }) {
  return (
    <g aria-hidden="true">
      {flicks.map((f) => {
        const p = cells[f.i]
        if (!p) return null
        const turn = f.i * 2.399
        const k = f.age / FLICK_LIFE
        const run = FLICK_RUN * (1 - (1 - k) * (1 - k))
        return (
          <g key={f.i} opacity={f1(1 - k)}>
            <circle cx={f1(p.x)} cy={f1(p.y)} r={f1(6 + 3 * k)} fill="none" stroke={FLICK} strokeWidth={0.9} />
            <circle cx={f1(p.x + Math.cos(turn) * run)} cy={f1(p.y + Math.sin(turn) * run)} r={1.8} fill={FLICK} />
          </g>
        )
      })}
    </g>
  )
}

// ---------------------------------------------------------------------------
// The parts of the picture.

function Tray({ sample, goneOf, reduced }: { sample: Sample; goneOf: (i: number) => boolean; reduced: boolean }) {
  const cells = cellsOf(sample.n)
  return (
    <g>
      <rect x={TRAY.x} y={TRAY.y} width={TRAY.w} height={TRAY.h} rx={9} fill={RIM} stroke={RIM_EDGE} strokeWidth={1.4} />
      <rect x={TRAY.x + 4} y={TRAY.y + 4} width={TRAY.w - 8} height={TRAY.h - 8} rx={6} fill={DISH} stroke={RIM_EDGE} strokeWidth={0.8} />
      {cells.map((c, i) => <Nucleus key={i} x={c.x} y={c.y} gone={goneOf(i)} reduced={reduced} />)}
    </g>
  )
}

function Legend({ config }: { config: HalfConfig }) {
  const g = legendGlyphs(config)
  return (
    <g fontFamily={FONT} fontSize={12} fontWeight={700} fill={SOFT}>
      <Nucleus x={g.first} y={LEGEND_Y - 4} gone={false} reduced scale={0.72} />
      <text x={f1(g.parentX)} y={LEGEND_Y}>{g.names.parent}</text>
      <Nucleus x={g.second} y={LEGEND_Y - 4} gone reduced scale={0.72} />
      <text x={f1(g.productX)} y={LEGEND_Y}>{g.names.product}</text>
    </g>
  )
}

/** The GM tube, reading the tray above it, with a cable to the counter. The light blinks for each nucleus that goes. */
function Counter({ reading, unit, blink, reduced }: { reading: string; unit: string; blink: boolean; reduced: boolean }) {
  return (
    <g fontFamily={FONT} data-counter="1">
      <path d="M326 202 C326 212 312 200 304 176" fill="none" stroke={SOFT} strokeWidth={2.4} strokeLinecap="round" />
      <rect x={318} y={140} width={16} height={54} rx={3} fill={TUBE} stroke={TUBE_EDGE} strokeWidth={1.2} />
      <rect x={316} y={136} width={20} height={7} rx={2} fill={CASE} />
      <rect x={320} y={192} width={12} height={11} rx={2} fill={CASE} />
      <line x1={322.5} x2={322.5} y1={148} y2={188} stroke="#FFFFFF" strokeWidth={1.6} strokeLinecap="round" />
      <rect x={214} y={142} width={90} height={46} rx={5} fill={CASE} />
      <rect x={220} y={148} width={78} height={21} rx={2} fill={LCD} />
      <text x={293} y={164} textAnchor="end" fontSize={15} fontWeight={800} fill={INK} style={{ fontVariantNumeric: 'tabular-nums' }}>{reading}</text>
      <text x={220} y={183} fontSize={12} fontWeight={700} fill={CASE_TEXT}>{unit}</text>
      <circle cx={295} cy={179} r={3} fill={blink ? LED_ON : LED_OFF} style={reduced ? undefined : { transition: 'fill 120ms linear' }} />
    </g>
  )
}

/** The handle: a small dark grip on the axis, with arrows that say it slides. */
function Thumb({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${f1(x)} ${y})`} data-thumb="1">
      <rect x={-THUMB_W / 2} y={-THUMB_H / 2} width={THUMB_W} height={THUMB_H} rx={5} fill={CASE} />
      <path d="M-5 -4 L-9 0 L-5 4 M5 -4 L9 0 L5 4" fill="none" stroke="#FFFFFF" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <line x1={0} x2={0} y1={-5} y2={5} stroke="#94A3B8" strokeWidth={1.4} strokeLinecap="round" />
    </g>
  )
}

/** A bead on the graph: a ring with arrows that say it goes up and down. */
function Bead({ x, y, wrong }: { x: number; y: number; wrong: boolean }) {
  return (
    <g transform={`translate(${f1(x)} ${f1(y)})`} data-bead="1" data-wrong={wrong ? '1' : '0'}>
      <circle r={BEAD_R} fill="#FFFFFF" stroke={wrong ? CURVE : CASE} strokeWidth={2.2} />
      <path d="M-3 -1.6 L0 -4.8 L3 -1.6 M-3 1.6 L0 4.8 L3 1.6" fill="none" stroke={wrong ? CURVE : CASE} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  )
}

/** The graph's frame: ruled lines, the upright axis with its numbers, and the baseline. */
function Frame({ config, px0, noZero }: { config: HalfConfig; px0: number; noZero?: boolean }) {
  const top = config.start
  const y = (v: number) => PY1 - (v / top) * (PY1 - PY0)
  return (
    <g fontFamily={FONT}>
      {amountTicks(top).map((v) => (
        <g key={v}>
          {v > 0 && <line x1={px0} x2={PX1} y1={f1(y(v))} y2={f1(y(v))} stroke={HAIR} strokeWidth={1} />}
          <line x1={px0 - 4} x2={px0} y1={f1(y(v))} y2={f1(y(v))} stroke={AXIS} strokeWidth={1.4} />
          {!(noZero && v === 0) && <text x={px0 - 7} y={f1(y(v) + 4)} textAnchor="end" fontSize={12} fontWeight={700} fill={SOFT} style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtAxis(v)}</text>}
        </g>
      ))}
      <line x1={px0} x2={px0} y1={PY0 - 4} y2={PY1} stroke={AXIS} strokeWidth={1.6} />
      <line x1={px0} x2={PX1} y1={PY1} y2={PY1} stroke={AXIS} strokeWidth={1.6} />
    </g>
  )
}

/** The run as it happened: one step down for each nucleus, as far as the clock has gone. */
export function stairPath(sample: Sample, upto: number, xOf: (k: number) => number, yOf: (whole: number) => number): string {
  const gone = sample.times.filter((t) => t <= upto).sort((a, b) => a - b)
  let whole = sample.n
  let d = `M${f1(xOf(0))} ${f1(yOf(whole))}`
  for (const t of gone) {
    whole -= 1
    d += `H${f1(xOf(t))}V${f1(yOf(whole))}`
  }
  return `${d}H${f1(xOf(upto))}`
}

// ---------------------------------------------------------------------------

const STEP = 'nodrag flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-lg border-2 border-ss-line bg-ss-panel text-[16px] font-extrabold leading-none text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'
const PLAIN = 'nodrag h-7 shrink-0 select-none whitespace-nowrap rounded-lg border-2 border-ss-line bg-ss-panel px-2.5 text-[12px] font-bold text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] motion-reduce:transition-none'

const pct = (v: number, of: number) => `${(v / of) * 100}%`

function Verdict({ marked, said }: { marked: Props['marked']; said: string }) {
  if (marked === 'idle' || !said) return null
  // The first sentence stands out: a number's own full stop, as in "4.5 billion years", does not end it.
  const first = said.startsWith('Yes.') ? said.match(/^(Yes\..*?\.)\s+(?=[A-Z0-9])(.*)$/) : null
  return (
    <div className="rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2" aria-live="polite">
      <p className="text-[13px] font-extrabold leading-snug text-ss-ink">{first ? first[1] : said}</p>
      {first && first[2] && <p className="mt-0.5 text-[12px] font-semibold leading-snug text-ss-slate">{first[2]}</p>}
    </div>
  )
}

function WaitCard({ config, state, setState, marked, reduced, locked }: { config: WaitConfig } & Omit<Props, 'config'>) {
  const [seed, setSeed] = useState(1)
  const sample = sampleOf(config.start, seed)
  const now = marked === 'shown' ? { k: targetStep(config) } : state
  const k = madeStep(now) ?? 0
  const { shown, flicks } = useClock(k, sample, reduced)
  const finished = marked === 'right' || marked === 'shown'
  const live = !locked && !finished
  const px0 = PX0_WAIT
  const xOf = (step: number) => px0 + (step / STEP_TOTAL) * (PX1 - px0)
  const bg = config.background
  const yOfAmount = (v: number) => PY1 - (v / config.start) * (PY1 - PY0)
  const yOfWhole = (whole: number) => yOfAmount(bg + ((config.start - bg) * whole) / sample.n)
  const cells = useMemo(() => cellsOf(sample.n), [sample.n])
  const wrap = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const put = (next: number) => {
    if (!live) return
    const v = Math.max(0, Math.min(STEP_TOTAL, next))
    if (v !== k) setState({ k: v })
  }
  const fromPointer = (e: ReactPointerEvent) => {
    const box = wrap.current?.getBoundingClientRect()
    if (!box || !box.width) return
    const x = ((e.clientX - box.left) / box.width) * W
    put(Math.round(((x - px0) / (PX1 - px0)) * STEP_TOTAL))
  }
  const onDown = (e: ReactPointerEvent) => {
    if (!live) return
    e.stopPropagation()
    dragging.current = true
    e.currentTarget.setPointerCapture?.(e.pointerId)
    fromPointer(e)
  }
  const onMove = (e: ReactPointerEvent) => { if (dragging.current) fromPointer(e) }
  const onUp = () => { dragging.current = false }
  const onKey = (e: KeyboardEvent) => {
    const by = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0
    if (by === 0 && e.key !== 'Home' && e.key !== 'End') return
    e.preventDefault()
    e.stopPropagation()
    put(e.key === 'Home' ? 0 : e.key === 'End' ? STEP_TOTAL : k + by)
  }

  const timeOf = (step: number) => (step * config.halfLife) / 4
  const timeNow = fmt(timeOf(k))
  const reading = fmt(Math.round(amountAt(config, shown)))
  const readingNow = fmt(Math.round(amountAt(config, k)))
  const tipY = yOfWhole(stillWhole(sample, shown))
  const n = halvesFor(config.left)
  const said = finished ? working(config) : marked === 'wrong' ? madeText(config, state) : ''
  const counter = showsCounter(config)
  const unitWord = config.measure === 'nuclei' ? 'Nuclei left' : config.measure === 'Bq' ? 'Activity' : 'Count rate'
  const srTime = spelled(timeOf(k), config.unit)

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-2 [&:has(button:focus-visible)_.hl-kbd]:block" onKeyDown={(e) => { if (e.key.startsWith('Arrow')) e.stopPropagation() }}>
      <figure className="m-0 flex w-full flex-col gap-1.5">
        <div ref={wrap} className="relative w-full">
          <svg viewBox={`0 0 ${W} ${H_WAIT}`} role="img" aria-label={describeWait(config)} className="block h-auto w-full select-none">
            <rect x={0.75} y={0.75} width={W - 1.5} height={H_WAIT - 1.5} rx={16} fill={PLATE} stroke={PLATE_EDGE} strokeWidth={1.5} />
            <Tray sample={sample} goneOf={(i) => sample.times[i] <= shown} reduced={reduced} />
            <Flicks flicks={flicks} cells={cells} />
            <Legend config={config} />
            <text x={12} y={TITLE_Y} fontFamily={FONT} fontSize={12} fontWeight={700} fill={SOFT}>{axisWord(config)}</text>
            <Frame config={config} px0={px0} noZero />
            {/* the time axis: round marks that have nothing to do with the half-life */}
            <g fontFamily={FONT} fontSize={12} fontWeight={700} fill={SOFT} style={{ fontVariantNumeric: 'tabular-nums' }}>
              {(finished ? Array.from({ length: n + 1 }, (_, m) => m * config.halfLife) : timeTicks(config.halfLife * 5)).map((t) => (
                <g key={t}>
                  <line x1={f1(xOf((t / config.halfLife) * 4))} x2={f1(xOf((t / config.halfLife) * 4))} y1={PY1} y2={PY1 + 4} stroke={AXIS} strokeWidth={1.4} />
                  <text x={f1(xOf((t / config.halfLife) * 4))} y={TICK_Y} textAnchor="middle">{fmt(t)}</text>
                </g>
              ))}
              <text x={W / 2} y={TITLE_X_Y} textAnchor="middle">{finished ? `time (${config.unit}): each bracket is one half-life` : `time (${config.unit})`}</text>
            </g>
            {bg > 0 && (
              <g fontFamily={FONT}>
                <line x1={px0} x2={PX1} y1={f1(yOfAmount(bg))} y2={f1(yOfAmount(bg))} stroke={SOFT} strokeWidth={1.5} strokeDasharray="5 4" data-background="1" />
                <text x={px0 + 6} y={f1(yOfAmount(bg) - 4)} fontSize={12} fontWeight={700} fill={SOFT} stroke={PLATE} strokeWidth={3} paintOrder="stroke" strokeLinejoin="round">background {fmt(bg)}</text>
              </g>
            )}
            {/* how to read a half-life off the curve, once it is marked */}
            {finished && Array.from({ length: n }, (_, m) => m + 1).map((m) => {
              const at = xOf(m * 4)
              const level = yOfAmount(amountAt(config, m * 4))
              return (
                <g key={m} data-reading={m}>
                  <path d={`M${px0} ${f1(level)}H${f1(at)}V${PY1}`} fill="none" stroke={GUIDE} strokeWidth={1.2} strokeDasharray="3 3" />
                  <path d={`M${f1(xOf((m - 1) * 4) + 2)} 268V273H${f1(at - 2)}V268`} fill="none" stroke={CURVE} strokeWidth={1.6} data-bracket={m} />
                </g>
              )
            })}
            {!finished && k > 0 && <line x1={f1(xOf(shown))} x2={f1(xOf(shown))} y1={f1(tipY)} y2={PY1} stroke={GUIDE} strokeWidth={1.2} strokeDasharray="3 3" />}
            <path d={stairPath(sample, shown, xOf, yOfWhole)} fill="none" stroke={CURVE} strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round" data-curve="1" />
            <circle cx={f1(xOf(shown))} cy={f1(tipY)} r={4.4} fill={CURVE} stroke="#FFFFFF" strokeWidth={1.6} />
            {counter && <text x={GM_LABEL.x} y={GM_LABEL.y} textAnchor="end" fontFamily={FONT} fontSize={12} fontWeight={700} fill={SOFT}>{GM_LABEL.text}</text>}
            {counter && <Counter reading={reading} unit={config.measure} blink={flicks.some((f) => f.age < 0.1)} reduced={reduced} />}
            {!finished && <Thumb x={xOf(shown)} y={PY1} />}
          </svg>
          {live && (
            <>
              <div
                className="nodrag absolute touch-none"
                style={{ left: pct(px0 - 10, W), width: pct(PX1 - px0 + 20, W), top: pct(PY0, H_WAIT), height: pct(PY1 + 14 - PY0, H_WAIT), cursor: 'pointer' }}
                onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
                aria-hidden="true" data-scrub="1"
              />
              <button
                type="button" role="slider" aria-label="The clock. Drag it along the time line, or use the arrow keys"
                aria-orientation="horizontal" aria-valuemin={0} aria-valuemax={STEP_TOTAL} aria-valuenow={k} aria-valuetext={srTime}
                onKeyDown={onKey} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
                className="nodrag absolute touch-none rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--subject)]"
                style={{ left: pct(xOf(k), W), top: pct(PY1, H_WAIT), width: THUMB_HIT, height: THUMB_HIT - 6, transform: 'translate(-50%, -50%)', border: 'none', background: 'transparent', padding: 0, cursor: 'grab' }}
              />
            </>
          )}
        </div>
        {!finished && <figcaption className="text-center text-[12px] font-bold text-ss-slate">{captionOf(config)}</figcaption>}
      </figure>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-1.5">
          <span className="text-[12px] font-bold text-ss-slate">Time</span>
          <span className="flex items-center gap-1">
            <button type="button" aria-label="Wind the clock back" disabled={!live || k <= 0} onClick={() => put(k - 1)} className={STEP}>{'−'}</button>
            <span className="min-w-[96px] whitespace-nowrap text-center text-[15px] font-extrabold tabular-nums text-ss-ink" data-time={k} aria-hidden="true">{timeNow} {shortUnit(config.unit)}</span>
            <button type="button" aria-label="Wind the clock on" disabled={!live || k >= STEP_TOTAL} onClick={() => put(k + 1)} className={STEP}>+</button>
          </span>
        </div>
        <div className="flex items-center justify-between gap-1.5 border-t border-ss-line pt-1.5">
          <p className="flex items-baseline gap-2">
            <span className="text-[12px] font-bold text-ss-slate">{unitWord}</span>
            <span className="text-[15px] font-extrabold tabular-nums text-ss-ink" data-left={readingNow}>{config.measure === 'nuclei' ? reading : `${reading} ${config.measure}`}</span>
          </p>
          <button type="button" aria-label="Draw a new sample of the same nuclei" onClick={() => setSeed((s) => s + 1)} className={PLAIN}>New sample</button>
        </div>
      </div>

      <p className="hl-kbd hidden text-[12px] font-semibold text-ss-slate">Left and right arrow keys move the clock.</p>
      <span className="sr-only" aria-live="polite">{`Time ${srTime}. ${config.measure === 'nuclei' ? `${readingNow} of ${fmt(config.start)} nuclei left` : config.measure === 'Bq' ? `The activity is ${readingNow} Bq` : `The counter reads ${readingNow}`}.`}</span>
      <Verdict marked={marked} said={said} />
    </div>
  )
}

function describeWait(config: WaitConfig): string {
  const parts = [`A tray of ${fmt(drawnCount(config))} nuclei over a graph of ${axisWord(config)} against time. Each nucleus goes all at once, at a moment of its own.`]
  if (showsCounter(config)) parts.push('A GM tube under the tray feeds a counter.')
  if (config.background > 0) parts.push(`A dashed line marks a background of ${fmt(config.background)}.`)
  return parts.join(' ')
}
const drawnCount = (config: HalfConfig) => Math.min(64, Math.max(1, Math.round(config.start)))

function captionOf(config: HalfConfig): string {
  if (config.task === 'draw') return 'The tray shows the last bead you moved.'
  if (config.background > 0) return 'The background is there with no source at all.'
  if (config.measure === 'Bq') return 'Activity is how many nuclei go each second.'
  if (config.measure !== 'nuclei') return 'The counter reads what the GM tube picks up.'
  if (config.start > 64) return `Each nucleus drawn stands for many of the ${fmt(config.start)}.`
  return 'Each nucleus goes all at once, and nobody can say when.'
}

function DrawCard({ config, state, setState, marked, reduced, locked }: { config: DrawConfig } & Omit<Props, 'config'>) {
  const [seed, setSeed] = useState(1)
  const sample = sampleOf(config.start, seed)
  const finished = marked === 'right' || marked === 'shown'
  const now: HalfState = marked === 'shown' ? halfLifeEngine.solve(config) : state
  const levels = madeLevels(config, now)
  const at = typeof now?.at === 'number' && now.at >= 0 && now.at < levels.length ? now.at : null
  const live = !locked && !finished
  const px0 = PX0_DRAW
  const span = levels.length + 0.25
  const xOf = (half: number) => px0 + (half / span) * (PX1 - px0)
  const yOfLevel = (level: number) => PY1 - (level / TOTAL_LEVELS) * (PY1 - PY0)
  const shownLevel = at === null ? TOTAL_LEVELS : levels[at]
  // The tray holds as many as the bead says, first-to-go first.
  const whole = Math.round((sample.n * shownLevel) / TOTAL_LEVELS)
  const goneSet = useMemo(() => new Set(sample.order.slice(0, sample.n - whole)), [sample, whole])
  const wrap = useRef<HTMLDivElement>(null)
  const dragging = useRef<number | null>(null)
  const put = (i: number, level: number) => {
    if (!live) return
    const v = Math.max(0, Math.min(TOTAL_LEVELS, level))
    const next = levels.map((x, j) => (j === i ? v : x))
    setState({ levels: next, at: i })
  }
  const fromPointer = (i: number, e: ReactPointerEvent) => {
    const box = wrap.current?.getBoundingClientRect()
    if (!box || !box.height) return
    const y = ((e.clientY - box.top) / box.height) * H_DRAW
    put(i, Math.round(((PY1 - y) / (PY1 - PY0)) * TOTAL_LEVELS))
  }
  const onKey = (i: number, e: KeyboardEvent) => {
    const by = e.key === 'ArrowUp' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowDown' || e.key === 'ArrowLeft' ? -1 : e.key === 'PageUp' ? 8 : e.key === 'PageDown' ? -8 : 0
    if (by === 0) return
    e.preventDefault()
    e.stopPropagation()
    put(i, levels[i] + by)
  }
  const line = [`M${f1(xOf(0))} ${f1(yOfLevel(TOTAL_LEVELS))}`, ...levels.map((v, i) => `L${f1(xOf(i + 1))} ${f1(yOfLevel(v))}`)].join('')
  const yOfWhole = (w: number) => PY1 - (w / sample.n) * (PY1 - PY0)
  const xOfStep = (step: number) => xOf(step / 4)
  const said = finished ? working(config) : marked === 'wrong' ? madeText(config, state) : ''
  const timed = config.halfLife !== null && config.unit !== null
  const rowWord = timed ? shortUnit(config.unit!) : 'half-lives'
  const beadLabel = (i: number) => `${axisWord(config)} after ${i + 1} half-li${i === 0 ? 'fe' : 'ves'}. Drag it up or down, or use the arrow keys`
  const refused = marked === 'wrong' ? wrongBeads(config, state) : []

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-2 [&:has(button:focus-visible)_.hl-kbd]:block" onKeyDown={(e) => { if (e.key.startsWith('Arrow')) e.stopPropagation() }}>
      <figure className="m-0 flex w-full flex-col gap-1.5">
        <div ref={wrap} className="relative w-full">
          <svg viewBox={`0 0 ${W} ${H_DRAW}`} role="img" aria-label={`A tray of ${fmt(sample.n)} nuclei over a graph of ${axisWord(config)} against half-lives, with a bead at each half-life and a line joining them.`} className="block h-auto w-full select-none">
            <rect x={0.75} y={0.75} width={W - 1.5} height={H_DRAW - 1.5} rx={16} fill={PLATE} stroke={PLATE_EDGE} strokeWidth={1.5} />
            <Tray sample={sample} goneOf={(i) => goneSet.has(i)} reduced={reduced} />
            <Legend config={config} />
            <text x={12} y={TITLE_Y} fontFamily={FONT} fontSize={12} fontWeight={700} fill={SOFT}>{axisWord(config)}</text>
            <Frame config={config} px0={px0} />
            <g fontFamily={FONT} fontSize={12} fontWeight={700} fill={SOFT} style={{ fontVariantNumeric: 'tabular-nums' }}>
              <text x={8} y={ROW_A_Y}>{rowWord}</text>
              <text x={8} y={ROW_B_Y}>{config.measure === 'nuclei' ? 'left' : 'reading'}</text>
              {Array.from({ length: levels.length + 1 }, (_, m) => m).map((m) => (
                <g key={m}>
                  {m > 0 && <line x1={f1(xOf(m))} x2={f1(xOf(m))} y1={PY0 - 2} y2={PY1} stroke={HAIR} strokeWidth={1} />}
                  <line x1={f1(xOf(m))} x2={f1(xOf(m))} y1={PY1} y2={PY1 + 4} stroke={AXIS} strokeWidth={1.4} />
                  <text x={f1(xOf(m))} y={ROW_A_Y} textAnchor="middle">{timed ? fmt(m * config.halfLife!) : m}</text>
                  <text x={f1(xOf(m))} y={ROW_B_Y} textAnchor="middle" fontSize={13} fontWeight={800} fill={INK} data-value={m}>{fmt(m === 0 ? config.start : amountOfLevel(config, levels[m - 1]))}</text>
                </g>
              ))}
            </g>
            <path d={line} fill="none" stroke={CASE} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" data-line="1" />
            {finished && <path d={stairPath(sample, levels.length * 4 + 1, xOfStep, yOfWhole)} fill="none" stroke={CURVE} strokeWidth={2.2} strokeLinejoin="round" data-curve="1" />}
            <circle cx={f1(xOf(0))} cy={f1(yOfLevel(TOTAL_LEVELS))} r={4.4} fill={CASE} />
            {levels.map((v, i) => <Bead key={i} x={xOf(i + 1)} y={yOfLevel(v)} wrong={refused.includes(`bead-${i + 1}`)} />)}
          </svg>
          {live && levels.map((v, i) => (
            <button
              key={i} type="button" role="slider" aria-label={beadLabel(i)} aria-orientation="vertical" aria-valuemin={0} aria-valuemax={config.start}
              aria-valuenow={amountOfLevel(config, v)} onKeyDown={(e) => onKey(i, e)}
              onPointerDown={(e) => { e.stopPropagation(); dragging.current = i; e.currentTarget.setPointerCapture?.(e.pointerId); fromPointer(i, e) }}
              onPointerMove={(e) => { if (dragging.current === i) fromPointer(i, e) }}
              onPointerUp={() => { dragging.current = null }} onPointerCancel={() => { dragging.current = null }}
              className="nodrag absolute touch-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--subject)]"
              style={{ left: pct(xOf(i + 1), W), top: pct(yOfLevel(v), H_DRAW), width: BEAD_HIT, height: BEAD_HIT, transform: 'translate(-50%, -50%)', border: 'none', background: 'transparent', padding: 0, cursor: 'grab' }}
            />
          ))}
        </div>
        {!finished && <figcaption className="text-center text-[12px] font-bold text-ss-slate">{captionOf(config)}</figcaption>}
      </figure>
      <p className="hl-kbd hidden text-[12px] font-semibold text-ss-slate">Up and down arrow keys move the bead.</p>
      <span className="sr-only" aria-live="polite">{`Your beads say ${levels.map((v, i) => `${fmt(amountOfLevel(config, v))} after ${i + 1}`).join(', ')}.`}</span>
      {finished && (
        <div className="flex justify-end">
          <button type="button" aria-label="Lay another run over the beads" onClick={() => setSeed((s) => s + 1)} className={PLAIN}>New sample</button>
        </div>
      )}
      <Verdict marked={marked} said={said} />
    </div>
  )
}

export function HalfLifeView(props: Props) {
  const { config } = props
  if (config.task === 'draw') return <DrawCard {...props} config={config} />
  return <WaitCard {...props} config={config} />
}
