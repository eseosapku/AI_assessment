'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { SceneViewProps } from '../types'
import type { Band, Bar, PyConfig, PyState, Pyr } from './config'
import {
  BANDS, BIRTH_MAX, BIRTH_MIN, DEATH_MAX, DEATH_MIN, DECADES, axisOf, frameOf, ghostOf, madeText, populationPyramidEngine, ratesOf, runOf, shares, sz, working,
} from './config'

type Props = SceneViewProps<PyConfig, PyState>

// A population is not a dark subject: a quiet plate, as measure-shape's and network-sim's are. The plate keeps its own colours in
// both themes so each part keeps its contrast against it. Men and women each have a strong colour (born since the start) and a
// pale one (here at the start), with a darker edge so the pale bars stay visible. No gradients or shadows.
const PLATE = '#F8FAFC'
const PLATE_EDGE = '#CBD5E1'
const INK = '#16202A'
const SOFT = '#475569'
const GRID = '#E2E8F0'
const FONT = 'system-ui, sans-serif'
const SIDES = {
  m: { strong: '#4F7FB0', pale: '#CADBEB', edge: '#355F8C' },
  f: { strong: '#B85C79', pale: '#EDCDD8', edge: '#8E3D58' },
}

// Written out here, never read from config at load time (config imports this file): a test holds them together.
export const W = 360
export const H = 210
const TOP = 28
export const ROW = 17
const REACH = 140
const LEFT_SPINE = 160
const RIGHT_SPINE = 200
/** How long a decade takes to play, in seconds: a walking pace, so the eye can follow a cohort up. */
export const DECADE_SECONDS = 1.1
/** Wait after the last slider move before the years replay from the start. */
export const SETTLE_MS = 800

const f1 = (n: number) => n.toFixed(1)
const RUNGS = ['0–9', '10–19', '20–29', '30–39', '40–49', '50–59', '60–69', '70–79', '80+']
const yOf = (row: number) => TOP + (8 - row) * ROW

/** Where a bar's outer end sits, in pixels from its spine. */
const reach = (share: number, axis: number) => Math.min(REACH, (share * 100 * REACH) / axis)

function Rung({ bar, total, axis }: { bar: Bar; total: number; axis: number }) {
  const col = SIDES[bar.side]
  const old = reach(bar.o / total, axis)
  const all = reach((bar.o + bar.f) / total, axis)
  const y = yOf(bar.row) + 1.25
  const dir = bar.side === 'm' ? -1 : 1
  const spine = bar.side === 'm' ? LEFT_SPINE : RIGHT_SPINE
  const x = (from: number, to: number) => (dir === -1 ? spine - to : spine + from)
  return (
    <g opacity={bar.fade} data-rung={bar.side}>
      {old > 0.4 && <rect x={f1(x(0, old))} y={f1(y)} width={f1(old)} height={ROW - 2.5} fill={col.pale} stroke={col.edge} strokeWidth={1} />}
      {all - old > 0.4 && <rect x={f1(x(old, all))} y={f1(y)} width={f1(all - old)} height={ROW - 2.5} fill={col.strong} stroke={col.edge} strokeWidth={1} />}
    </g>
  )
}

/** The dashed edge of the pyramid the learner is to fill. */
function Target({ pyr, axis }: { pyr: Pyr; axis: number }) {
  const edge = (side: 'm' | 'f') => {
    const list = pyr[side]
    const everyone = [...pyr.m, ...pyr.f].reduce((s, b) => s + sz(b), 0)
    const spine = side === 'm' ? LEFT_SPINE : RIGHT_SPINE
    const dir = side === 'm' ? -1 : 1
    let d = `M ${f1(spine)} ${f1(yOf(BANDS - 1))}`
    for (let r = BANDS - 1; r >= 0; r--) {
      const x = spine + dir * reach(sz(list[r]) / everyone, axis)
      d += ` L ${f1(x)} ${f1(yOf(r))} L ${f1(x)} ${f1(yOf(r) + ROW)}`
    }
    return `${d} L ${f1(spine)} ${f1(yOf(0) + ROW)}`
  }
  return (
    <g fill="none" stroke={INK} strokeWidth={1.7} strokeDasharray="5 3" strokeLinejoin="round" data-target="1">
      <path d={edge('m')} />
      <path d={edge('f')} />
    </g>
  )
}

function Pyramid({ run, t, axis, ghost, label }: { run: ReturnType<typeof runOf>; t: number; axis: number; ghost: Pyr | null; label: string }) {
  const { bars, total } = frameOf(run, t)
  const ticks = [axis / 2, axis]
  const base = TOP + 9 * ROW
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="block h-auto w-full select-none">
      <defs>
        <clipPath id="pp-clip"><rect x={0} y={TOP} width={W} height={9 * ROW} /></clipPath>
      </defs>
      <rect x={0.75} y={0.75} width={W - 1.5} height={H - 1.5} rx={16} fill={PLATE} stroke={PLATE_EDGE} strokeWidth={1.5} />
      <g aria-hidden="true" fontFamily={FONT}>
        <text x={LEFT_SPINE - REACH / 2} y={19} textAnchor="middle" fontSize={13} fontWeight={700} fill={SIDES.m.edge}>Men</text>
        <text x={RIGHT_SPINE + REACH / 2} y={19} textAnchor="middle" fontSize={13} fontWeight={700} fill={SIDES.f.edge}>Women</text>
        {/* The gridlines and the axis. */}
        <g stroke={GRID} strokeWidth={1}>
          {ticks.map((v) => {
            const dx = (v * REACH) / axis
            return (
              <g key={v}>
                <line x1={f1(LEFT_SPINE - dx)} x2={f1(LEFT_SPINE - dx)} y1={TOP} y2={base} />
                <line x1={f1(RIGHT_SPINE + dx)} x2={f1(RIGHT_SPINE + dx)} y1={TOP} y2={base} />
              </g>
            )
          })}
        </g>
        <g stroke={SOFT} strokeWidth={1.2}>
          <line x1={LEFT_SPINE - REACH} x2={LEFT_SPINE} y1={base + 0.6} y2={base + 0.6} />
          <line x1={RIGHT_SPINE} x2={RIGHT_SPINE + REACH} y1={base + 0.6} y2={base + 0.6} />
        </g>
        <g fontSize={12} fontWeight={600} fill={SOFT}>
          {ticks.map((v) => {
            const dx = (v * REACH) / axis
            return (
              <g key={v}>
                <text x={f1(LEFT_SPINE - dx)} y={base + 16} textAnchor={v === axis ? 'start' : 'middle'}>{v}</text>
                <text x={f1(RIGHT_SPINE + dx)} y={base + 16} textAnchor={v === axis ? 'end' : 'middle'}>{v}</text>
              </g>
            )
          })}
          <text x={180} y={base + 16} textAnchor="middle" fontWeight={700}>% of all people</text>
        </g>
        {RUNGS.map((r, i) => (
          <text key={r} x={180} y={yOf(i) + ROW / 2 + 4.2} textAnchor="middle" fontSize={12} fontWeight={600} fill={SOFT}>{r}</text>
        ))}
      </g>
      <g clipPath="url(#pp-clip)">
        {bars.map((b, i) => <Rung key={`${b.side}${i}`} bar={b} total={total} axis={axis} />)}
        {ghost && <Target pyr={ghost} axis={axis} />}
      </g>
    </svg>
  )
}

function Swatch({ kind }: { kind: 'old' | 'new' | 'target' }) {
  if (kind === 'target') {
    return (
      <svg viewBox="0 0 18 10" className="h-2.5 w-[18px] shrink-0 text-ss-ink" aria-hidden="true">
        <path d="M 1 9 V 1 H 17 V 9" fill="none" stroke="currentColor" strokeWidth={1.7} strokeDasharray="4 2.5" />
      </svg>
    )
  }
  const pick = (s: 'm' | 'f') => (kind === 'old' ? SIDES[s].pale : SIDES[s].strong)
  return (
    <svg viewBox="0 0 18 10" className="h-2.5 w-[18px] shrink-0" aria-hidden="true">
      <rect x={0.5} y={0.5} width={8} height={9} fill={pick('m')} stroke={SIDES.m.edge} strokeWidth={1} />
      <rect x={9.5} y={0.5} width={8} height={9} fill={pick('f')} stroke={SIDES.f.edge} strokeWidth={1} />
    </svg>
  )
}

const Named = ({ kind, children }: { kind: 'old' | 'new' | 'target'; children: string }) => (
  <span className="flex items-center gap-1 whitespace-nowrap"><Swatch kind={kind} />{children}</span>
)

function RateRow({ id, label, unit, value, min, max, disabled, onChange }: { id: string; label: string; unit: string; value: number; min: number; max: number; disabled: boolean; onChange(v: number): void }) {
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="w-[76px] shrink-0 text-[12px] font-bold text-ss-slate">{label}</label>
      <input
        id={id} type="range" min={min} max={max} step={1} value={value} disabled={disabled}
        aria-label={`${label}, ${unit}`} aria-valuetext={`${value} per 1000`}
        className="nodrag min-w-0 flex-1 touch-manipulation accent-[color:var(--subject)]"
        onChange={(e) => onChange(Number(e.target.value))}
        onKeyDown={(e) => e.stopPropagation()}
      />
      <span className="w-[74px] shrink-0 whitespace-nowrap text-right"><span className="text-[15px] font-extrabold tabular-nums text-ss-ink">{value}</span><span className="text-[12px] font-bold text-ss-slate"> per 1000</span></span>
    </div>
  )
}

const people = (n: number) => `${n.toFixed(1)} million`

export function PopulationPyramidView({ config, state, setState, marked, reduced, locked }: Props) {
  const finished = marked === 'right' || marked === 'shown'
  const now = marked === 'shown' ? populationPyramidEngine.solve(config) : state
  const rates = ratesOf(config, now)
  const run = useMemo(() => runOf(config, now), [config, rates.birth, rates.death]) // eslint-disable-line react-hooks/exhaustive-deps -- the run changes only with the rates
  const axis = useMemo(() => axisOf(config), [config])
  const ghost = useMemo(() => (config.task === 'match' ? ghostOf(config) : null), [config])

  // Time, in decades: it plays from the start on its own at first, jumps to the end when a slider moves (so the picture answers
  // at once), and plays again once the sliders have been still for a moment.
  const [t, setT] = useState(reduced ? DECADES : 0)
  const [playing, setPlaying] = useState(false)
  const key = `${rates.birth}|${rates.death}`
  const seen = useRef(key)
  const live = useRef(t)
  live.current = t
  const canPlay = !reduced

  useEffect(() => {
    if (canPlay && !finished) setPlaying(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the card first appears
  }, [])
  useEffect(() => {
    if (seen.current === key) return
    seen.current = key
    setPlaying(false)
    setT(DECADES)
    if (!canPlay || finished) return
    const timer = window.setTimeout(() => {
      setT(0)
      setPlaying(true)
    }, SETTLE_MS)
    return () => window.clearTimeout(timer)
  }, [key, canPlay, finished])
  useEffect(() => {
    if (finished) {
      setPlaying(false)
      setT(DECADES)
    }
  }, [finished])
  useEffect(() => {
    if (!playing) return
    let raf = 0
    let last = 0
    const loop = (now2: number) => {
      raf = requestAnimationFrame(loop)
      const dt = last ? Math.min(0.05, (now2 - last) / 1000) : 0.016
      last = now2
      const next = live.current + dt / DECADE_SECONDS
      if (next >= DECADES) {
        setT(DECADES)
        setPlaying(false)
      } else setT(next)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [playing])

  const shownT = reduced ? Math.round(t) : t
  const { total } = frameOf(run, shownT)
  const year = Math.round(shownT * 10)
  const start = frameOf(run, 0).total
  const set = (next: Partial<PyState>) => {
    if (locked || finished) return
    setState({ birth: rates.birth, death: rates.death, ...next })
  }
  const press = () => {
    if (playing) setPlaying(false)
    else {
      if (live.current >= DECADES - 0.001) setT(0)
      setPlaying(true)
    }
  }
  const said = marked === 'right' || marked === 'shown' ? working(config, now) : marked === 'wrong' ? madeText(config, now) : ''
  const lead = said.match(/^(Yes\. [^.]*\.)\s*(.*)$/)
  const widest = frameOf(run, shownT).bars.reduce((best, b) => (b.o + b.f > best.v ? { v: b.o + b.f, row: Math.round(b.row) } : best), { v: 0, row: 0 })
  const label = `A population pyramid, men on the left and women on the right, for year ${year} of 50: ${people(total)} people, with the widest rung at age ${RUNGS[Math.max(0, Math.min(8, widest.row))]}.${config.task === 'match' ? ' A dashed outline shows the pyramid to fill.' : ` The country had ${people(start)} people at the start.`}`

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-2">
      <figure className="m-0 flex w-full flex-col gap-1.5">
        <Pyramid run={run} t={shownT} axis={axis} ghost={ghost} label={label} />
        <figcaption className="flex flex-wrap justify-center gap-x-3 gap-y-0.5 text-[12px] font-semibold text-ss-slate" aria-hidden="true">
          <Named kind="old">Alive at the start</Named>
          <Named kind="new">Born since</Named>
          {config.task === 'match' && <Named kind="target">Pyramid to fill</Named>}
        </figcaption>
      </figure>

      <div className="grid grid-cols-2 gap-x-6 border-y border-ss-line py-1.5">
        <p className="flex items-baseline justify-between">
          <span className="text-[12px] font-bold text-ss-slate">Year</span>
          <span className="text-[15px] font-extrabold tabular-nums text-ss-ink" data-year={year}>{year}</span>
        </p>
        <p className="flex items-baseline justify-between">
          <span className="text-[12px] font-bold text-ss-slate">People</span>
          <span className="whitespace-nowrap text-[15px] font-extrabold tabular-nums text-ss-ink">{people(total)}</span>
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <RateRow id="pp-birth" label="Birth rate" unit="births per 1000 people a year" value={rates.birth} min={BIRTH_MIN} max={BIRTH_MAX} disabled={locked || finished} onChange={(v) => set({ birth: v })} />
        <RateRow id="pp-death" label="Death rate" unit="deaths per 1000 people a year" value={rates.death} min={DEATH_MIN} max={DEATH_MAX} disabled={locked || finished} onChange={(v) => set({ death: v })} />
        <div className="flex items-center gap-2">
          <button
            type="button" aria-label={playing ? 'Pause the fifty years' : 'Play the fifty years from the start'} onClick={press} disabled={reduced}
            className="nodrag flex h-7 w-[76px] shrink-0 select-none items-center justify-center gap-1 whitespace-nowrap rounded-lg border-2 border-ss-line bg-ss-panel text-[12px] font-extrabold text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
          >
            <svg viewBox="0 0 10 10" className="h-2.5 w-2.5" aria-hidden="true">
              {playing ? <path d="M 2 1 V 9 M 8 1 V 9" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" /> : <path d="M 2 1 L 9 5 L 2 9 Z" fill="currentColor" />}
            </svg>
            {playing ? 'Pause' : 'Play'}
          </button>
          <input
            type="range" min={0} max={DECADES} step={reduced ? 1 : 0.05} value={shownT} aria-label="Years from the start, in tens" aria-valuetext={`Year ${year}`}
            className="nodrag min-w-0 flex-1 touch-manipulation accent-[color:var(--subject)]"
            onChange={(e) => { setPlaying(false); setT(Number(e.target.value)) }}
            onPointerUp={() => setT((v) => Math.round(v))}
            onKeyDown={(e) => {
              e.stopPropagation()
              const by = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0
              if (by) {
                e.preventDefault()
                setPlaying(false)
                setT((v) => Math.max(0, Math.min(DECADES, Math.round(v) + by)))
              }
            }}
          />
          <span className="w-[74px] shrink-0 text-right text-[12px] font-bold text-ss-slate">0 to 50 years</span>
        </div>
      </div>

      <span className="sr-only" aria-live="polite">{`Year ${year}: ${people(total)} people.`}</span>
      {marked !== 'idle' && (
        <div className="rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2">
          <p className="text-[13px] font-extrabold leading-snug text-ss-ink">{lead ? lead[1] : said}</p>
          {lead && lead[2] && <p className="mt-0.5 text-[12px] font-semibold leading-snug text-ss-slate">{lead[2]}</p>}
        </div>
      )}
    </div>
  )
}
