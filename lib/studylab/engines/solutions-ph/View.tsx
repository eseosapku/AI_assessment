'use client'
import { useId } from 'react'
import type { SceneViewProps } from '../types'
import type { SolutionsConfig, SolutionsState } from './config'
import {
  cm3, dropsOf, indicatorFrac, madeDilute, madeTitrate, phAt, solutionsEngine, stepsOf, tubePh, workingDilute, workingTitrate,
} from './config'

type Props = SceneViewProps<SolutionsConfig, SolutionsState>
type Titr = Extract<SolutionsConfig, { task: 'titrate' }>
type Dil = Extract<SolutionsConfig, { task: 'dilute' }>

// Glassware on a quiet plate, as measure-shape's and bonding's pictures are. The plate keeps its own colours in both themes.
// View.tsx may not read config's constants at load time (the two import each other), so the few it needs are written out here
// and the tests hold them together.
const PLATE = '#F8FAFC'
const PLATE_EDGE = '#CBD5E1'
const INK = '#16202A'
const SOFT = '#475569'
const GLASS = '#94A3B8'
const GLASS_FILL = '#EEF4F8'
const LIQUID = '#D6E6F1'
const MENISCUS = '#5B7288'
const TAP_BODY = '#64748B'
const ACCENT = '#1F6397'
const TILE = '#FFFFFF'
const FONT = 'system-ui, sans-serif'
const COPPER = '#B45309'

export const W = 360
/** The titration picture's and the rack's heights. */
export const H_TITRATE = 306
export const H_DILUTE = 240
/** Burette scale: 0 cm³ at this y, and this many px per cm³. */
export const ZERO_Y = 30
export const PX_PER_CM3 = 2.8
export const MAX_TUBES_DRAWN = 5
const DROP_CM3 = 0.05
const BURETTE_MAX = 50

// Universal indicator, by pH (1 to 14): the usual kit chart.
export const CHART = ['#E0262F', '#E8482B', '#EE6A25', '#F29A22', '#F5C320', '#DDD72B', '#6BB84A', '#3E9F6A', '#2B86A8', '#3B62B5', '#5B4CA8', '#7A3C99', '#8C2F86', '#6E1F6A']
export const CHART_NAMES = ['red', 'red', 'orange', 'orange', 'yellow', 'yellow-green', 'green', 'blue-green', 'blue', 'blue', 'indigo', 'purple', 'purple', 'purple']

// Titration indicators, low-pH form then high-pH form.
const FORMS: Record<string, { low: string; high: string }> = {
  phenolphthalein: { low: '#E6EFF4', high: '#DD3F8C' },
  'methyl orange': { low: '#D8352A', high: '#F2C430' },
}
const FLASK_WATER = '#E6EFF4'

const f1 = (n: number) => n.toFixed(1)
const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const mix = (a: string, b: string, t: number) => {
  const x = hex(a)
  const y = hex(b)
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',')})`
}

export function flaskColour(c: Titr, drops: number): string {
  const f = FORMS[c.indicator] ?? FORMS.phenolphthalein
  return mix(f.low, f.high, indicatorFrac(c.indicator, phAt(c, drops)))
}
function colourName(c: Titr, drops: number): string {
  const t = indicatorFrac(c.indicator, phAt(c, drops))
  if (c.indicator === 'methyl orange') return t < 0.25 ? 'red' : t < 0.75 ? 'orange' : 'yellow'
  return t < 0.12 ? 'colourless' : t < 0.7 ? 'pale pink' : 'pink'
}

const num = (c: number) => c.toFixed(3)

const BTN = 'nodrag flex h-7 shrink-0 select-none items-center justify-center whitespace-nowrap rounded-lg border-2 border-ss-line bg-ss-panel px-2.5 text-[12px] font-extrabold leading-none text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'
const STEP = 'nodrag flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-lg border-2 border-ss-line bg-ss-panel text-[16px] font-extrabold leading-none text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'

/** The board moves a selected card with the arrows, so the arrows stop here. */
const keep = (e: React.KeyboardEvent) => {
  if (e.key.startsWith('Arrow')) e.stopPropagation()
}

// ---------------------------------------------------------------------------
// The burette over the flask.

function Burette({ level, reduced, dropKey }: { level: number; reduced: boolean; dropKey: number }) {
  const surface = ZERO_Y + level * PX_PER_CM3
  const ticks = Array.from({ length: BURETTE_MAX + 1 }, (_, i) => i)
  return (
    <g>
      {/* The tube, its liquid and its meniscus. */}
      <rect x={100} y={18} width={24} height={162} rx={3} fill={GLASS_FILL} stroke={GLASS} strokeWidth={1.5} />
      <rect x={101.5} y={surface} width={21} height={178 - surface} fill={LIQUID} />
      <path d={`M 101.5 ${f1(surface)} Q 112 ${f1(surface + 4.5)} 122.5 ${f1(surface)}`} fill="none" stroke={MENISCUS} strokeWidth={1.6} data-meniscus={f1(surface)} />
      {/* The scale, 0 at the top, read downwards. */}
      <g stroke={INK} strokeWidth={1}>
        {ticks.map((i) => {
          const y = ZERO_Y + i * PX_PER_CM3
          const len = i % 10 === 0 ? 11 : i % 5 === 0 ? 8 : 4
          return <line key={i} x1={101.5} x2={101.5 + len} y1={y} y2={y} />
        })}
      </g>
      <g fontFamily={FONT} fontSize={12} fontWeight={600} fill={SOFT} textAnchor="end" aria-hidden="true">
        {[0, 10, 20, 30, 40, 50].map((i) => <text key={i} x={95} y={ZERO_Y + i * PX_PER_CM3 + 4}>{i}</text>)}
      </g>
      {/* The tap: a barrel, a handle, and the jet. */}
      <rect x={106} y={180} width={12} height={13} rx={2} fill={TAP_BODY} />
      <rect x={118} y={184.5} width={17} height={5} rx={2.5} fill={ACCENT} />
      <path d="M 109.5 193 H 114.5 L 113.5 207 H 110.5 Z" fill={GLASS_FILL} stroke={GLASS} strokeWidth={1.2} />
      {!reduced && dropKey > 0 && (
        <circle key={dropKey} cx={112} cy={211} r={3} fill={LIQUID} stroke={MENISCUS} strokeWidth={1.2} style={{ animation: 'sol-fall 0.5s ease-in forwards' }} />
      )}
    </g>
  )
}

function Flask({ colour, volume, reduced, clip }: { colour: string; volume: number; reduced: boolean; clip: string }) {
  const outline = 'M 103 222 H 121 V 246 L 158 288 Q 161 294 153 294 H 71 Q 63 294 66 288 L 103 246 Z'
  const level = 292 - (14 + (volume - 20) * 0.3)
  const ease = reduced ? undefined : { transition: 'fill 450ms ease' }
  return (
    <g>
      <rect x={42} y={294} width={140} height={6} rx={2} fill={TILE} stroke={PLATE_EDGE} strokeWidth={1.2} />
      <clipPath id={clip}><path d={outline} /></clipPath>
      <path d={outline} fill={GLASS_FILL} />
      <rect x={60} y={level} width={104} height={300 - level} fill={colour} clipPath={`url(#${clip})`} style={ease} data-flask-colour="1" />
      <line x1={60} x2={164} y1={level} y2={level} stroke={MENISCUS} strokeWidth={1} clipPath={`url(#${clip})`} opacity={0.6} />
      <path d={outline} fill="none" stroke={GLASS} strokeWidth={1.8} strokeLinejoin="round" />
      <rect x={100} y={219} width={24} height={4.5} rx={2} fill={GLASS_FILL} stroke={GLASS} strokeWidth={1.4} />
    </g>
  )
}

function Names({ c }: { c: Titr }) {
  return (
    <g aria-hidden="true" fontFamily={FONT} fontSize={13} fontWeight={700} fill={SOFT} stroke={PLATE} strokeWidth={3} paintOrder="stroke" strokeLinejoin="round">
      <text x={142} y={26}>burette</text>
      <text x={142} y={46} fontWeight={600}>{`${num(c.buretteConc)} mol/dm³`}</text>
      <text x={142} y={62} fontWeight={600}>{c.burette}</text>
      <text x={146} y={198}>tap</text>
      <text x={172} y={240}>conical flask</text>
      <text x={172} y={257} fontWeight={600}>{`${c.flaskVolume.toFixed(1)} cm³ of ${num(c.flaskConc)} mol/dm³`}</text>
      <text x={172} y={272} fontWeight={600}>{c.flask}</text>
      <text x={172} y={287} fontWeight={600}>{`with ${c.indicator}`}</text>
    </g>
  )
}

function Titration({ config, drops, locked, marked, reduced, setState }: { config: Titr; drops: number; locked: boolean; marked: Props['marked']; reduced: boolean; setState(s: SolutionsState): void }) {
  const clip = `sol-${useId().replace(/[^a-z0-9]/gi, '')}`
  const level = drops * DROP_CM3
  const finished = marked === 'right' || marked === 'shown'
  const off = locked || finished
  const add = (n: number) => setState({ drops: Math.min(1000, drops + n) })
  const colour = flaskColour(config, drops)
  const reading = cm3(drops)
  const volume = config.flaskVolume + level
  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-2" onKeyDown={keep}>
      <style>{'@keyframes sol-fall { from { transform: translateY(0); opacity: 1 } to { transform: translateY(34px); opacity: 0.9 } }'}</style>
      <figure className="m-0 flex w-full flex-col gap-1.5">
        <svg viewBox={`0 0 ${W} ${H_TITRATE}`} role="img" aria-label={`A burette over a conical flask. The burette reads ${reading} cm³. The flask is ${colourName(config, drops)}.`} className="block h-auto w-full select-none">
          <rect x={0.75} y={0.75} width={W - 1.5} height={H_TITRATE - 1.5} rx={16} fill={PLATE} stroke={PLATE_EDGE} strokeWidth={1.5} />
          <Burette level={level} reduced={reduced} dropKey={drops} />
          <Flask colour={colour} volume={volume} reduced={reduced} clip={clip} />
          <line x1={168} y1={236} x2={132} y2={256} stroke={GLASS} strokeWidth={1.2} aria-hidden="true" />
          <Names c={config} />
        </svg>
        <figcaption className="text-center text-[12px] font-semibold text-ss-slate" aria-hidden="true">One drop is 0.05 cm³. Read the burette at the bottom of the curve.</figcaption>
      </figure>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12px] font-bold text-ss-slate">Open the tap</span>
          <span className="flex items-center gap-1">
            <button type="button" className={BTN} aria-label="Let out 5 cm³ of titrant" disabled={off || drops >= 1000} onClick={() => add(100)}>+5 cm³</button>
            <button type="button" className={BTN} aria-label="Let out 1 cm³ of titrant" disabled={off || drops >= 1000} onClick={() => add(20)}>+1 cm³</button>
            <button type="button" className={BTN} aria-label="Let out one drop of titrant" disabled={off || drops >= 1000} onClick={() => add(1)}>+1 drop</button>
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-ss-line pt-1.5">
          <p className="flex items-baseline gap-2">
            <span className="text-[12px] font-bold text-ss-slate">Burette reading</span>
            <span className="text-[15px] font-extrabold tabular-nums text-ss-ink" data-reading={reading}>{reading} cm³</span>
          </p>
          <button type="button" className={BTN} aria-label="Start again: refill the burette" disabled={off || drops === 0} onClick={() => setState({ drops: 0 })}>Start again</button>
        </div>
      </div>
      <span className="sr-only" aria-live="polite">{`Burette reading ${reading} cm³. The flask is ${colourName(config, drops)}.`}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// The rack of tubes.

const PITCH = 56
const X0 = 44
const tubeX = (i: number) => X0 + i * PITCH

function Tube({ x, colour, ring, reduced, clip }: { x: number; colour: string; ring: boolean; reduced: boolean; clip: string }) {
  const outline = `M ${x - 15} 46 V 118 A 15 15 0 0 0 ${x + 15} 118 V 46`
  const ease = reduced ? undefined : { transition: 'fill 450ms ease' }
  return (
    <g data-tube={x}>
      <clipPath id={clip}><path d={`${outline} Z`} /></clipPath>
      <path d={`${outline} Z`} fill={GLASS_FILL} />
      <rect x={x - 15} y={64} width={30} height={80} fill={colour} clipPath={`url(#${clip})`} style={ease} />
      <line x1={x - 15} x2={x + 15} y1={64} y2={64} stroke={MENISCUS} strokeWidth={1} clipPath={`url(#${clip})`} opacity={0.6} />
      <path d={outline} fill="none" stroke={ring ? ACCENT : GLASS} strokeWidth={ring ? 2.4 : 1.8} strokeLinecap="round" />
      <rect x={x - 17} y={43} width={34} height={4.5} rx={2} fill={GLASS_FILL} stroke={ring ? ACCENT : GLASS} strokeWidth={1.4} />
    </g>
  )
}

function Rack({ config, steps, reduced }: { config: Dil; steps: number; reduced: boolean }) {
  const base = `sol-${useId().replace(/[^a-z0-9]/gi, '')}`
  const target = config.target
  const slots = Array.from({ length: MAX_TUBES_DRAWN + 1 }, (_, i) => i)
  return (
    <svg viewBox={`0 0 ${W} ${H_DILUTE}`} role="img" aria-label={`A rack of ${steps + 1} test ${steps === 0 ? 'tube' : 'tubes'} of universal indicator, and a colour chart from 1 to 14. ${Array.from({ length: steps + 1 }, (_, i) => `Tube ${i + 1} is ${CHART_NAMES[tubePh(config, i) - 1]}.`).join(' ')}`} className="block h-auto w-full select-none">
      <rect x={0.75} y={0.75} width={W - 1.5} height={H_DILUTE - 1.5} rx={16} fill={PLATE} stroke={PLATE_EDGE} strokeWidth={1.5} />
      {slots.map((i) => (i <= steps ? null : (
        <path key={i} d={`M ${tubeX(i) - 15} 46 V 118 A 15 15 0 0 0 ${tubeX(i) + 15} 118 V 46`} fill="none" stroke={PLATE_EDGE} strokeWidth={1.5} strokeDasharray="4 4" data-slot={i} />
      )))}
      {slots.map((i) => (i > steps ? null : <Tube key={i} x={tubeX(i)} colour={CHART[tubePh(config, i) - 1]} ring={i === steps} reduced={reduced} clip={`${base}${i}`} />))}
      {/* The rack: a front rail and two legs. */}
      <rect x={20} y={90} width={320} height={9} rx={3} fill="#B8C4D0" stroke="#94A3B8" strokeWidth={1.2} />
      <rect x={24} y={99} width={7} height={44} rx={2} fill="#B8C4D0" stroke="#94A3B8" strokeWidth={1.2} />
      <rect x={329} y={99} width={7} height={44} rx={2} fill="#B8C4D0" stroke="#94A3B8" strokeWidth={1.2} />
      {/* The pipette's journey: 1 cm³ from each tube to the next. */}
      <g fill="none" stroke={COPPER} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {slots.map((i) => (i >= steps ? null : (
          <g key={i}>
            <path d={`M ${tubeX(i) + 4} 36 Q ${tubeX(i) + PITCH / 2} 14 ${tubeX(i + 1) - 4} 36`} />
            <path d={`M ${tubeX(i + 1) - 10} 32 L ${tubeX(i + 1) - 4} 36 L ${tubeX(i + 1) - 11} 40`} />
          </g>
        )))}
      </g>
      <g fontFamily={FONT} fontSize={13} fontWeight={700} fill={SOFT} textAnchor="middle" stroke={PLATE} strokeWidth={3} paintOrder="stroke" strokeLinejoin="round" aria-hidden="true">
        {steps > 0 && <text x={tubeX(0) + PITCH / 2} y={14}>1 cm³</text>}
        <text x={tubeX(0)} y={160}>start</text>
        {slots.map((i) => (i === 0 || i > steps ? null : <text key={i} x={tubeX(i)} y={160}>+ water</text>))}
      </g>
      {/* The chart. */}
      <g>
        {CHART.map((col, i) => <rect key={i} x={12 + i * 24} y={196} width={24} height={18} fill={col} stroke={PLATE} strokeWidth={0.8} data-chart={i + 1} />)}
        <rect x={12 + (target - 1) * 24 - 2} y={193} width={28} height={24} rx={3} fill="none" stroke={ACCENT} strokeWidth={2.4} />
        <g fontFamily={FONT} fontSize={12} fontWeight={700} fill={SOFT} textAnchor="middle" aria-hidden="true">
          {CHART.map((_, i) => <text key={i} x={24 + i * 24} y={233}>{i + 1}</text>)}
        </g>
        <text x={24 + (target - 1) * 24} y={187} textAnchor="middle" fontFamily={FONT} fontSize={13} fontWeight={800} fill={ACCENT} stroke={PLATE} strokeWidth={3} paintOrder="stroke" aria-hidden="true">target</text>
      </g>
    </svg>
  )
}

function Dilution({ config, steps, locked, marked, reduced, setState }: { config: Dil; steps: number; locked: boolean; marked: Props['marked']; reduced: boolean; setState(s: SolutionsState): void }) {
  const finished = marked === 'right' || marked === 'shown'
  const off = locked || finished
  const unit = `${config.concentration} mol/dm³ ${config.substance}`
  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-2" onKeyDown={keep}>
      <figure className="m-0 flex w-full flex-col gap-1.5">
        <Rack config={config} steps={steps} reduced={reduced} />
        <figcaption className="text-center text-[12px] font-semibold text-ss-slate" aria-hidden="true">
          {`Start: ${unit}. Each new tube is 1 cm³ of the one before, with water to 10 cm³.`}
        </figcaption>
      </figure>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-bold text-ss-slate">Tubes added</span>
        <span className="flex items-center gap-1">
          <button type="button" className={STEP} aria-label="Take the last tube away" disabled={off || steps <= 0} onClick={() => setState({ steps: steps - 1 })}>−</button>
          <span className="min-w-[28px] text-center text-[15px] font-extrabold tabular-nums text-ss-ink" data-steps={steps}>{steps}</span>
          <button type="button" className={STEP} aria-label="Add a tube: 1 cm³ of the last, made up to 10 cm³ with water" disabled={off || steps >= MAX_TUBES_DRAWN} onClick={() => setState({ steps: steps + 1 })}>+</button>
        </span>
      </div>
      <span className="sr-only" aria-live="polite">{`${steps} ${steps === 1 ? 'tube' : 'tubes'} added. The last tube is ${CHART_NAMES[tubePh(config, steps) - 1]}.`}</span>
    </div>
  )
}

export function SolutionsView({ config, state, setState, marked, reduced, locked }: Props) {
  const now = marked === 'shown' ? solutionsEngine.solve(config) : state
  const said = marked === 'right' || marked === 'shown'
    ? config.task === 'titrate' ? workingTitrate(config, dropsOf(now)) : workingDilute(config, stepsOf(now))
    : marked === 'wrong'
      ? config.task === 'titrate' ? madeTitrate(config, dropsOf(now)) : madeDilute(config, stepsOf(now))
      : ''
  const cut = said.indexOf(String.fromCharCode(10))
  const lead = cut >= 0 ? [said.slice(0, cut), said.slice(cut + 1)] : null
  return (
    <div className="flex w-full max-w-[380px] flex-col gap-2">
      {config.task === 'titrate'
        ? <Titration config={config} drops={dropsOf(now)} locked={locked} marked={marked} reduced={reduced} setState={setState} />
        : <Dilution config={config} steps={stepsOf(now)} locked={locked} marked={marked} reduced={reduced} setState={setState} />}
      {marked !== 'idle' && (
        <div className="rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2">
          <p className="text-[13px] font-extrabold leading-snug text-ss-ink">{lead ? lead[0] : said}</p>
          {lead && lead[1] && <p className="mt-0.5 text-[12px] font-semibold leading-snug text-ss-slate">{lead[1]}</p>}
        </div>
      )}
    </div>
  )
}
