'use client'
import { useId } from 'react'
import type { KeyboardEvent } from 'react'
import type { SceneViewProps } from '../types'
import type { Setting, StocksConfig, StocksState } from './config'
import {
  caseOf, endLevel, madeText, rawLevel, settingOf, settingsOf, shownLevel, stocksFlowsEngine, tagsOf, timeText, working,
} from './config'

type Props = SceneViewProps<StocksConfig, StocksState>

// A tank, a bath, a lake: not a dark subject. A quiet plate as measure-shape's and network-sim's are, with the real vessel
// cut away on it. The plate keeps its own colours in both themes. No gradients or shadows.
// None of config's constants are read at the top of this file (they would not exist yet when the two modules load), so the
// frame is written out here as literals and the tests hold them to the config.
const PLATE = '#F8FAFC'
const PLATE_EDGE = '#CBD5E1'
const AIR = '#F1F5F9'
const INK = '#16202A'
const SOFT = '#475569'
const FONT = 'system-ui, sans-serif'
const METAL = '#94A3B8'
const METAL_EDGE = '#64748B'
const AIM = '#D9480F'
const WHEEL = '#334155'

export const W = 360
export const H = 252
const CAP = 10
const TOP = 62
const BOTTOM = 192
const LEFT = 128
const RIGHT = 232
const UNIT = 13
const STEPS = 3
const STREAM_X = 150
const DRAIN_X = 312
const STREAM_PER_NOTCH = 2.4

const f1 = (n: number) => n.toFixed(1)
const yOf = (level: number) => BOTTOM - level * UNIT

/** The outer left edge of each vessel, where the graduation marks sit. */
const OUTER_LEFT: Record<Setting['wall'], number> = { porcelain: 118, earth: 108, glass: 122 }

/** The vessel's walls, drawn around the cut-away. */
function Walls({ wall }: { wall: Setting['wall'] }) {
  if (wall === 'porcelain') {
    return (
      <g data-wall="porcelain">
        <rect x={125} y={204} width={16} height={8} rx={3} fill={METAL} />
        <rect x={219} y={204} width={16} height={8} rx={3} fill={METAL} />
        <rect x={118} y={58} width={10} height={146} rx={3} fill="#FFFFFF" stroke="#B6C2D0" strokeWidth={1.5} />
        <rect x={232} y={58} width={10} height={146} rx={3} fill="#FFFFFF" stroke="#B6C2D0" strokeWidth={1.5} />
        <rect x={118} y={192} width={124} height={12} rx={3} fill="#FFFFFF" stroke="#B6C2D0" strokeWidth={1.5} />
        <rect x={113} y={54} width={19} height={7} rx={3.5} fill="#FFFFFF" stroke="#B6C2D0" strokeWidth={1.5} />
        <rect x={228} y={54} width={19} height={7} rx={3.5} fill="#FFFFFF" stroke="#B6C2D0" strokeWidth={1.5} />
      </g>
    )
  }
  if (wall === 'earth') {
    return (
      <g data-wall="earth">
        <rect x={108} y={62} width={20} height={142} rx={3} fill="#A98467" stroke="#7F5F45" strokeWidth={1.5} />
        <rect x={232} y={62} width={20} height={142} rx={3} fill="#A98467" stroke="#7F5F45" strokeWidth={1.5} />
        <rect x={108} y={192} width={144} height={12} rx={3} fill="#A98467" stroke="#7F5F45" strokeWidth={1.5} />
        <rect x={106} y={57} width={24} height={7} rx={3.5} fill="#6B9B4A" />
        <rect x={230} y={57} width={24} height={7} rx={3.5} fill="#6B9B4A" />
      </g>
    )
  }
  return (
    <g data-wall="glass">
      <rect x={120} y={192} width={120} height={8} rx={3} fill={METAL_EDGE} />
      <rect x={124} y={58} width={4} height={140} rx={1.5} fill="#DCE7F1" stroke={METAL} strokeWidth={1.2} />
      <rect x={232} y={58} width={4} height={140} rx={1.5} fill="#DCE7F1" stroke={METAL} strokeWidth={1.2} />
      <rect x={120} y={55} width={12} height={5} rx={2} fill={METAL_EDGE} />
      <rect x={228} y={55} width={12} height={5} rx={2} fill={METAL_EDGE} />
    </g>
  )
}

/** Graduation marks on the outside of the vessel: a mark for every notch, a number at nought, half and full. */
function Scale({ wall, s }: { wall: Setting['wall']; s: Setting }) {
  const x = OUTER_LEFT[wall]
  return (
    <g aria-hidden="true" fontFamily={FONT} fontSize={12} fontWeight={700} fill={SOFT}>
      {Array.from({ length: CAP + 1 }, (_, k) => {
        const major = k % 5 === 0
        return <line key={k} x1={x - (major ? 8 : 4.5)} x2={x} y1={yOf(k)} y2={yOf(k)} stroke={METAL_EDGE} strokeWidth={major ? 1.6 : 1.1} />
      })}
      {[0, 5, 10].map((k) => (
        <text key={k} x={x - 11} y={yOf(k) + 4} textAnchor="end">{k === 0 ? '0' : String(k * s.levelScale)}</text>
      ))}
    </g>
  )
}

/** A hand-wheel on a stem. Turning it by the flow's notches is what shows how open the valve is. */
function Wheel({ at, rate, pipeTop }: { at: { x: number; y: number }; rate: number; pipeTop: number }) {
  return (
    <g data-wheel={rate}>
      <rect x={at.x - 2.5} y={at.y + 8} width={5} height={pipeTop - at.y - 8} fill={METAL_EDGE} />
      <g transform={`translate(${at.x} ${at.y}) rotate(${rate * 36})`}>
        <circle r={10} fill="#FFFFFF" stroke={WHEEL} strokeWidth={2.6} />
        <line x1={-10} x2={10} y1={0} y2={0} stroke={WHEEL} strokeWidth={2.2} />
        <line x1={0} x2={0} y1={-10} y2={10} stroke={WHEEL} strokeWidth={2.2} />
        <circle r={2.8} fill={WHEEL} />
        <circle cy={-10} r={3} fill={AIM} stroke="#FFFFFF" strokeWidth={1} />
      </g>
    </g>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-1.5">
      <span className="text-[12px] font-bold text-ss-slate">{label}</span>
      {children}
    </div>
  )
}

const stepButton = 'nodrag flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-lg border-2 border-ss-line bg-ss-panel text-[16px] font-extrabold leading-none text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'

/** One flow: the learner's own gets − and +, the fixed one is only a number. */
function FlowRow({ name, value, text, mine, locked, max, onSet }: { name: string; value: number; text: string; mine: boolean; locked: boolean; max: number; onSet(v: number): void }) {
  const key = (e: KeyboardEvent) => {
    const by = e.key === 'ArrowUp' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowDown' || e.key === 'ArrowLeft' ? -1 : 0
    if (!by || locked) return
    // The board moves a selected card with the arrows; here they turn the flow.
    e.preventDefault()
    e.stopPropagation()
    onSet(Math.max(0, Math.min(max, value + by)))
  }
  if (!mine) {
    return (
      <Row label={`${name} (fixed)`}>
        <span className="w-[176px] text-center text-[15px] font-extrabold tabular-nums text-ss-ink" data-fixed="1">{text}</span>
      </Row>
    )
  }
  return (
    <Row label={name}>
      <span role="group" aria-label={`${name} flow`} onKeyDown={key} className="flex items-center gap-1">
        <button type="button" aria-label={`Less ${name.toLowerCase()}`} disabled={locked || value <= 0} onClick={() => onSet(value - 1)} className={stepButton}>−</button>
        <span className="w-[112px] text-center text-[15px] font-extrabold tabular-nums text-ss-ink" data-flow={value}>{text}</span>
        <button type="button" aria-label={`More ${name.toLowerCase()}`} disabled={locked || value >= max} onClick={() => onSet(value + 1)} className={stepButton}>+</button>
      </span>
    </Row>
  )
}

export function StocksFlowsView({ config, state, setState, marked, reduced, locked }: Props) {
  const clip = useId().replace(/:/g, '')
  const now = marked === 'shown' ? stocksFlowsEngine.solve(config) : state
  const s = settingOf(config)
  const c = caseOf(config)
  const f = settingsOf(config, now)
  const raw = rawLevel(config, now)
  const level = shownLevel(config, now)
  const finished = marked === 'right' || marked === 'shown'
  const frozen = locked || finished
  const ease = reduced ? undefined : { transition: 'transform 900ms ease-in-out' }
  const easeWidth = reduced ? undefined : { transition: 'stroke-width 700ms ease' }
  const dy = (CAP - level) * UNIT
  const change = level - c.start
  const tags = tagsOf(config, raw)
  const said = marked === 'right' || marked === 'shown' ? working(config, now) : marked === 'wrong' ? madeText(config, now) : ''
  const lead = said.match(/^((?:Yes\. )?[^.]*\.)\s*(.*)$/)
  const timeNow = timeText(config, f.t)
  const levelText = s.level(level)
  const set = (patch: Partial<StocksState>) => setState({ tap: f.tap, drain: f.drain, t: f.t, ...patch })
  const arrowAt = yOf(level)
  const wall = s.wall

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-2 [&:has(button:focus-visible)_.sf-kbd]:block [&:has(input:focus-visible)_.sf-kbd]:block">
      <figure className="m-0 flex w-full flex-col gap-1.5">
        <svg
          viewBox={`0 0 ${W} ${H}`} role="img" className="block h-auto w-full select-none"
          aria-label={`${s.store}: a vessel with ${s.inName.toLowerCase()} running in and ${s.outName.toLowerCase()} running out. ${s.measure} after ${timeNow} is ${levelText}; it started at ${s.level(c.start)}.`}
        >
          <rect x={0.75} y={0.75} width={W - 1.5} height={H - 1.5} rx={16} fill={PLATE} stroke={PLATE_EDGE} strokeWidth={1.5} />
          <defs>
            <clipPath id={clip}><rect x={LEFT} y={TOP} width={RIGHT - LEFT} height={BOTTOM - TOP} /></clipPath>
          </defs>

          {/* The inside of the vessel: air, the stream falling in, then the liquid over it. */}
          <rect x={LEFT} y={TOP} width={RIGHT - LEFT} height={BOTTOM - TOP} fill={AIR} />
          {f.tap > 0 && <line x1={STREAM_X} x2={STREAM_X} y1={58} y2={BOTTOM} stroke={s.liquid} strokeWidth={f.tap * STREAM_PER_NOTCH} data-stream="in" style={easeWidth} />}
          <g clipPath={`url(#${clip})`}>
            <g style={{ transform: `translateY(${f1(dy)}px)`, ...ease }} data-level={level}>
              <rect x={LEFT} y={TOP} width={RIGHT - LEFT} height={(CAP + 1) * UNIT} fill={s.liquid} />
              <rect x={LEFT} y={TOP} width={RIGHT - LEFT} height={2.5} fill={s.surface} />
            </g>
          </g>
          <line x1={LEFT} x2={RIGHT} y1={yOf(c.start)} y2={yOf(c.start)} stroke={INK} strokeWidth={1.6} strokeDasharray="6 4" data-line="start" />
          {config.task === 'reach' && <line x1={LEFT} x2={RIGHT} y1={yOf(c.aim)} y2={yOf(c.aim)} stroke={AIM} strokeWidth={2.6} data-line="aim" />}
          {Math.abs(change) >= 0.5 && (
            <g style={{ transform: `translateY(${f1(arrowAt)}px)`, ...ease }} data-arrow={change > 0 ? 'up' : 'down'}>
              <path d={change > 0 ? 'M 170 -3 L 176 -12 L 182 -3 Z' : 'M 170 3 L 176 12 L 182 3 Z'} fill={INK} />
            </g>
          )}

          <Walls wall={wall} />
          <Scale wall={wall} s={s} />

          {/* The flow in: a pipe with its nozzle over the vessel. */}
          <rect x={10} y={37} width={8} height={18} rx={2} fill={METAL_EDGE} />
          <rect x={18} y={40} width={138} height={12} fill={METAL} stroke={METAL_EDGE} strokeWidth={1.2} />
          <rect x={144} y={40} width={12} height={18} rx={2} fill={METAL} stroke={METAL_EDGE} strokeWidth={1.2} />
          {f.tap > 0 && <path d={`M 20 46 H ${STREAM_X} V 57`} fill="none" stroke={s.liquid} strokeWidth={4} data-pipe="in" />}
          <Wheel at={{ x: 64, y: 26 }} rate={f.tap} pipeTop={40} />

          {/* The flow out: through the wall, along, then down. */}
          <rect x={232} y={174} width={86} height={12} fill={METAL} stroke={METAL_EDGE} strokeWidth={1.2} />
          <rect x={306} y={174} width={12} height={24} rx={2} fill={METAL} stroke={METAL_EDGE} strokeWidth={1.2} />
          {f.drain > 0 && <path d={`M 234 180 H ${DRAIN_X} V 196`} fill="none" stroke={s.liquid} strokeWidth={4} data-pipe="out" />}
          {f.drain > 0 && <line x1={DRAIN_X} x2={DRAIN_X} y1={198} y2={236} stroke={s.liquid} strokeWidth={f.drain * STREAM_PER_NOTCH} data-stream="out" style={easeWidth} />}
          <rect x={290} y={236} width={44} height={4} rx={2} fill={METAL_EDGE} />
          <Wheel at={{ x: 270, y: 150 }} rate={f.drain} pipeTop={174} />

          <g aria-hidden="true" fontFamily={FONT}>
            {tags.map((t) => (
              <text key={t.text} x={f1(t.x)} y={f1(t.y)} textAnchor={t.anchor} fontSize={13} fontWeight={700} fill={t.text === 'Aim' ? AIM : INK} stroke={t.text === 'Aim' || t.text === 'Start' ? 'none' : PLATE} strokeWidth={3} paintOrder="stroke" strokeLinejoin="round" data-tag={t.text}>{t.text}</text>
            ))}
          </g>
        </svg>
        <figcaption className="flex flex-wrap justify-center gap-x-3 gap-y-0.5 text-[12px] font-semibold text-ss-slate" aria-hidden="true">
          <span className="flex items-center gap-1 whitespace-nowrap">
            <svg viewBox="0 0 18 8" className="h-2 w-[18px] shrink-0"><line x1={0} x2={18} y1={4} y2={4} stroke="currentColor" strokeWidth={1.8} strokeDasharray="5 3" /></svg>
            Where it started
          </span>
          {config.task === 'reach' && (
            <span className="flex items-center gap-1 whitespace-nowrap">
              <svg viewBox="0 0 18 8" className="h-2 w-[18px] shrink-0"><line x1={0} x2={18} y1={4} y2={4} stroke={AIM} strokeWidth={2.8} /></svg>
              Aim
            </span>
          )}
          <span className="whitespace-nowrap">A wider stream runs faster</span>
        </figcaption>
      </figure>

      <div className="flex flex-col gap-1.5">
        <FlowRow name={s.inName} value={f.tap} text={s.rate(f.tap)} mine={c.adjust === 'tap'} locked={frozen} max={5} onSet={(v) => set({ tap: v })} />
        <FlowRow name={s.outName} value={f.drain} text={s.rate(f.drain)} mine={c.adjust === 'drain'} locked={frozen} max={5} onSet={(v) => set({ drain: v })} />
        <Row label="Time">
          <span className="flex items-center gap-2">
            <input
              type="range" min={0} max={STEPS} step={1} value={f.t} aria-label="Time" aria-valuetext={timeNow}
              onChange={(e) => set({ t: Number(e.target.value) })}
              onKeyDown={(e) => { if (e.key.startsWith('Arrow') || e.key === 'Home' || e.key === 'End') e.stopPropagation() }}
              className="nodrag h-5 w-[128px] touch-none accent-[color:var(--subject)]"
            />
            <span className="w-[76px] text-center text-[15px] font-extrabold tabular-nums text-ss-ink" data-time={f.t}>{timeNow}</span>
          </span>
        </Row>
        <div className="grid border-t border-ss-line pt-1.5">
          <p className="flex items-baseline justify-between gap-2">
            <span className="text-[12px] font-bold text-ss-slate">{s.measure} after {timeNow}</span>
            <span className="text-[15px] font-extrabold tabular-nums text-ss-ink" data-level-text="1">{levelText}</span>
          </p>
        </div>
      </div>

      <p className="sf-kbd hidden text-[12px] font-semibold text-ss-slate">Tab moves between the buttons and the time. The arrow keys turn a flow or move the time.</p>
      <span className="sr-only" aria-live="polite">{`${s.measure} after ${timeNow}: ${levelText}. It started at ${s.level(c.start)}.`}</span>
      {marked !== 'idle' && (
        <div className="rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2">
          <p className="text-[13px] font-extrabold leading-snug text-ss-ink">{lead ? lead[1] : said}</p>
          {lead && lead[2] && <p className="mt-0.5 text-[12px] font-semibold leading-snug text-ss-slate">{lead[2]}</p>}
        </div>
      )}
    </div>
  )
}
