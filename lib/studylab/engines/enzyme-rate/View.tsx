'use client'
import { useId, type KeyboardEvent, type ReactNode } from 'react'
import type { SceneViewProps } from '../types'
import type { EnzymeFacts, EnzymeRateConfig, EnzymeRateState, LensView, Molecule, Point, SecondName, Trace } from './config'
import {
  atOf, beenText, bestOf, enzymeRateEngine, factorOf, factsOf, freshTube, idealOf, levelText, levelsOf, lensOf, lightOf, limitAt, limitRate, limitStepped, madeText,
  otherName, otherOf, otherValue, rateOf, secondOfCard, stepped, tracesOf, working,
} from './config'

type Props = SceneViewProps<EnzymeRateConfig, EnzymeRateState>
type EnzymeCard = Extract<EnzymeRateConfig, { task: 'enzyme' }>
type LimitCard = Extract<EnzymeRateConfig, { task: 'limiting' }>

// A lab bench is not a dark subject: a quiet plate, as measure-shape's and network-sim's are. The plate keeps its own colours in both
// themes, so each part keeps its contrast against it. Flat colours only.
const PLATE = '#F8FAFC'
const PLATE_EDGE = '#CBD5E1'
const HAIR = '#DCE3EA'
const INK = '#16202A'
const SOFT = '#475569'
const FONT = 'system-ui, sans-serif'
// Glass and water.
const GLASS = '#64748B'
const GLASS_FILL = '#EEF3F7'
const WATER = '#CFE3F2'
const WATER_EDGE = '#7FA9CB'
// Thermometer and hot plate.
const MERCURY = '#C81E1E'
const STEEL = '#475569'
const STEEL_DARK = '#334155'
const HOT = '#C2571A'
const COLD = '#94A3B8'
const ICE = '#F1F7FB'
// What is in the tube.
const LIQUID = '#E8F0E4'
const FOAM = '#FFFDF7'
const FOAM_EDGE = '#A8B3BE'
const LIVER = '#7B2D26'
const LIVER_HI = '#A8483E'
const BLUE_BLACK = [31, 42, 68]
const STRAW = [231, 208, 136]
const EGG = '#FFFEFA'
const EGG_EDGE = '#8A94A0'
const FAT = '#EFCB62'
const FAT_EDGE = '#A67C12'
// The molecules.
const LENS = '#FFFFFF'
const RIM = '#64748B'
const ENZYME = '#5FAFA5'
const ENZYME_EDGE = '#1F6F66'
const FOLD = '#2F8A7F'
const SPENT = '#D5DDDB'
const SPENT_EDGE = '#7D8C8A'
const SUBSTRATE = '#E9A23B'
const SUBSTRATE_EDGE = '#8A5A12'
// The graph: the learner's own line, and an older one.
const LINE = '#1D4ED8'
const LINE_OLD = '#94A3B8'
const TRUE_LINE = '#64748B'
const AIM = '#B3126E'
// The pondweed bench.
const BENCH = '#D8C8A8'
const BENCH_EDGE = '#A8926A'
const WEED = '#2F7D4F'
const WEED_EDGE = '#1E5A38'
const BEAM = '#FDE68A'
const BULB = '#FCD34D'
const BULB_EDGE = '#B7791F'
const GAS = '#F8FAFC'
const BOTTLE = '#5B6B7F'
const BOTTLE_DARK = '#3E4C5E'
const PAPER = '#F7F2E4'

export const W = 360
export const H = 292
// The graph, in picture coordinates.
export const PX0 = 48
export const PX1 = 330
export const PY0 = 266
export const PY1 = 194
// The lens.
export const LX = 276
export const LY = 80
export const LR = 72
// The tube.
export const TUBE_X = 98
export const LIQUID_TOP = 108
/** How far a free substrate drifts from its spot. */
export const DRIFT = 4

const f1 = (n: number) => n.toFixed(1)
const ease = (reduced: boolean, what = 'all') => (reduced ? undefined : { transition: `${what} 900ms ease` })
const mix = (a: number[], b: number[], k: number) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(',')})`

// ---------------------------------------------------------------------------
// The graph.

export type GraphSpec = { title: string; xs: number[]; xName: string; top: number; yTicks: number[]; x1: number; shade?: boolean }

export function graphOf(config: EnzymeRateConfig): GraphSpec {
  if (config.task === 'limiting') return { title: 'Bubbles a minute', xs: [1, 2, 3, 4, 5], xName: 'light', top: 36, yTicks: [0, 12, 24, 36], x1: 310 }
  const f = factorOf(config)
  return { title: factsOf(config).title, xs: levelsOf(config), xName: f === 'temperature' ? '°C' : f === 'ph' ? 'pH' : '%', top: 100, yTicks: [0, 50, 100], x1: f === 'ph' ? 318 : PX1, shade: f === 'ph' }
}

export const graphX = (g: GraphSpec, v: number) => PX0 + ((v - g.xs[0]) / (g.xs[g.xs.length - 1] - g.xs[0])) * (g.x1 - PX0)
export const graphY = (g: GraphSpec, r: number) => PY0 - (r / g.top) * (PY0 - PY1)
const pathOf = (g: GraphSpec, pts: Point[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${f1(graphX(g, p.x))} ${f1(graphY(g, p.y))}`).join('')

/** Universal indicator's colours, muted a little: red acid, through green, to purple alkali. */
export const phColour = (ph: number) => ['#C8372D', '#D2502B', '#DD7A2C', '#E49B2E', '#E6B93A', '#C9C13F', '#6FA945', '#3F8F6A', '#2F7F9C', '#3366A8', '#42499F', '#54408F', '#5F367F'][Math.max(0, Math.min(12, ph - 1))]

export type Note = { text: string; x: number; y: number; anchor: 'start' | 'middle' | 'end' }

/** What marking writes on the graph: the name of each part, once the learner has made it. */
export function notesOf(config: EnzymeRateConfig, state: EnzymeRateState): Note[] {
  const g = graphOf(config)
  if (config.task === 'limiting') {
    const o = otherOf(state)
    const second = secondOfCard(config)
    const corner = [1, 2, 3, 4, 5].find((l) => limitAt(l, o) !== 'light') ?? 5
    const flat = second === 'co2' ? 'CO₂ limits' : 'temperature limits'
    const flatY = graphY(g, limitRate(5, o)) - 7
    const out: Note[] = [{ text: 'light limits', x: PX0 + 2, y: graphY(g, config.target) - 5, anchor: 'start' }]
    if (corner < 5) out.push({ text: flat, x: g.x1 + 8, y: flatY, anchor: 'end' })
    return out
  }
  const f = factorOf(config)
  const best = bestOf(config)
  const peak = { x: graphX(g, best), y: graphY(g, f === 'substrate' ? 20 * best : 96) }
  if (f === 'substrate') {
    return [
      { text: 'substrate limits', x: PX0 + 36, y: PY0 - 6, anchor: 'start' },
      { text: 'every site busy', x: PX1 + 8, y: peak.y + 22, anchor: 'end' },
    ]
  }
  const fast: Note = { text: 'fastest', x: peak.x + 11, y: peak.y + 5, anchor: 'start' }
  if (f === 'temperature') return [fast, { text: 'denatured', x: graphX(g, 60) + 4, y: graphY(g, 34), anchor: 'start' }, { text: 'slower collisions', x: graphX(g, 25) - 4, y: graphY(g, 62), anchor: 'end' }]
  // On whichever side of the peak has the room, and clear of the axis's numbers.
  return [fast, best < 7 ? { text: 'denatured', x: graphX(g, best + 4), y: graphY(g, 30), anchor: 'start' } : { text: 'denatured', x: PX0 + 2, y: graphY(g, 30), anchor: 'start' }]
}

function Graph({ config, traces, state, marked, reduced }: { config: EnzymeRateConfig; traces: Trace[]; state: EnzymeRateState; marked: Props['marked']; reduced: boolean }) {
  const g = graphOf(config)
  const finished = marked === 'right' || marked === 'shown'
  const notes = finished ? notesOf(config, state) : []
  const live = traces.find((t) => t.now)
  const last = config.task === 'limiting'
    ? { x: lightOf(state), y: limitRate(lightOf(state), otherOf(state)) }
    : live?.points[live.points.length - 1]
  return (
    <g fontFamily={FONT} data-graph="">
      <text x={14} y={184} fontSize={12.5} fontWeight={700} fill={SOFT}>{g.title}</text>
      {traces.some((t) => !t.now) && <text x={W - 10} y={184} textAnchor="end" fontSize={12} fontWeight={600} fill={SOFT} data-grey="">{config.task === 'limiting' ? 'grey: other levels' : 'grey: an earlier tube'}</text>}
      {g.yTicks.map((t) => (
        <g key={t}>
          <line x1={PX0 - 8} x2={g.x1 + 10} y1={graphY(g, t)} y2={graphY(g, t)} stroke={t === 0 ? GLASS : HAIR} strokeWidth={t === 0 ? 1.6 : 1.2} />
          <text x={PX0 - 12} y={graphY(g, t) + 4} textAnchor="end" fontSize={12} fontWeight={600} fill={SOFT}>{t}</text>
        </g>
      ))}
      {g.shade && g.xs.map((v) => <rect key={v} x={f1(graphX(g, v) - 11.5)} y={PY0 + 1} width={23} height={3.5} fill={phColour(v)} />)}
      {g.xs.map((v) => (
        <text key={v} x={graphX(g, v)} y={PY0 + 18} textAnchor="middle" fontSize={12} fontWeight={600} fill={SOFT}>{v}</text>
      ))}
      <text x={W - 6} y={PY0 + 18} textAnchor="end" fontSize={12} fontWeight={700} fill={SOFT}>{g.xName}</text>
      {config.task === 'limiting' && (
        <g data-aim="">
          <line x1={PX0 - 8} x2={g.x1 + 10} y1={graphY(g, config.target)} y2={graphY(g, config.target)} stroke={AIM} strokeWidth={1.6} strokeDasharray="6 5" />
          <text x={W - 8} y={graphY(g, config.target) + 4} textAnchor="end" fontSize={12.5} fontWeight={700} fill={AIM}>aim</text>
        </g>
      )}
      {finished && <path d={pathOf(g, idealOf(config, state))} fill="none" stroke={TRUE_LINE} strokeWidth={1.4} strokeDasharray="2 4" strokeLinecap="round" data-true="" />}
      {traces.filter((t) => !t.now).map((t) => (
        <g key={t.key} data-trace="old">
          {t.points.length > 1 && <path d={pathOf(g, t.points)} fill="none" stroke={LINE_OLD} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
          {t.points.map((p, i) => <circle key={i} cx={graphX(g, p.x)} cy={graphY(g, p.y)} r={3.2} fill={LINE_OLD} />)}
        </g>
      ))}
      {traces.filter((t) => t.now).map((t) => (
        <g key={t.key} data-trace="now">
          {t.points.length > 1 && <path d={pathOf(g, t.points)} fill="none" stroke={LINE} strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round" />}
          {t.points.map((p, i) => <circle key={i} cx={graphX(g, p.x)} cy={graphY(g, p.y)} r={3.6} fill={LINE} />)}
        </g>
      ))}
      {last && (
        <circle
          data-now="" cx={graphX(g, last.x)} cy={graphY(g, last.y)} r={6} fill={PLATE} stroke={LINE} strokeWidth={3}
          style={ease(reduced, 'cx 900ms ease, cy')}
        />
      )}
      {notes.map((n) => (
        <text key={n.text} data-note="" x={f1(n.x)} y={f1(n.y)} textAnchor={n.anchor} fontSize={12.5} fontWeight={700} fill={INK} stroke={PLATE} strokeWidth={3} paintOrder="stroke" strokeLinejoin="round">{n.text}</text>
      ))}
    </g>
  )
}

// ---------------------------------------------------------------------------
// The water bath, the tube and what is in it.

/** Where the thermometer's column reaches. */
export const thermY = (t: number) => 126 - (t / 70) * 102

function Thermometer({ t, reduced }: { t: number; reduced: boolean }) {
  const x = 46
  const top = thermY(t)
  return (
    <g data-thermometer={t} fontFamily={FONT}>
      <rect x={x - 5} y={10} width={10} height={130} rx={5} fill={GLASS_FILL} stroke={GLASS} strokeWidth={1.4} />
      <circle cx={x} cy={140} r={8} fill={MERCURY} stroke={GLASS} strokeWidth={1.4} />
      <rect x={x - 2.5} y={top} width={5} height={140 - top} fill={MERCURY} style={ease(reduced, 'y 900ms ease, height')} />
      {[0, 10, 20, 30, 40, 50, 60, 70].map((v) => (
        <line key={v} x1={x - 9} x2={x - 5} y1={thermY(v)} y2={thermY(v)} stroke={GLASS} strokeWidth={v % 20 === 0 ? 1.6 : 1} />
      ))}
      {[0, 20, 40, 60].map((v) => (
        <text key={v} x={x - 11} y={thermY(v) + 4} textAnchor="end" fontSize={12} fontWeight={600} fill={SOFT}>{v}</text>
      ))}
    </g>
  )
}

/** A rising bubble: moving when motion is allowed, and a still dot in the same place when it is not. */
function Bubble({ x, from, to, r, n, of, dur, reduced, colour }: { x: number; from: number; to: number; r: number; n: number; of: number; dur: number; reduced: boolean; colour: string }) {
  const k = (n + 0.5) / of
  if (reduced) return <circle cx={x} cy={f1(from + (to - from) * k)} r={r} fill={FOAM} stroke={colour} strokeWidth={1} />
  return (
    <circle cx={x} cy={from} r={r} fill={FOAM} stroke={colour} strokeWidth={1}>
      <animate attributeName="cy" from={from} to={to} dur={`${dur}s`} begin={`${f1(-k * dur)}s`} repeatCount="indefinite" />
    </circle>
  )
}

const FOAM_DOTS: [number, number, number][] = [[6, 6, 2.6], [15, 9, 2], [25, 6, 3], [9, 16, 3], [21, 18, 2.4], [29, 15, 2], [5, 27, 2.2], [15, 28, 3], [26, 27, 2.4], [9, 38, 2.6], [20, 40, 2.2], [28, 37, 3], [6, 50, 3], [16, 51, 2.2], [25, 49, 2.6], [11, 62, 2.4], [21, 62, 3], [29, 60, 2], [6, 74, 2.4], [16, 73, 3], [26, 75, 2.2], [10, 85, 3], [21, 86, 2.4]]

/** The tube's contents, which are the thing that answers back. */
function TubeStuff({ facts, rate, clip, reduced }: { facts: EnzymeFacts; rate: number; clip: string; reduced: boolean }) {
  const inner = TUBE_X - 16
  const k = Math.max(0, Math.min(1, rate / 100))
  if (facts.shows === 'foam') {
    const top = LIQUID_TOP - rate * 0.9
    const count = Math.round(k * 7)
    return (
      <g clipPath={`url(#${clip})`} data-stuff="foam">
        {rate > 0.4 && (
          <g style={{ transform: `translateY(${f1(top)}px)`, ...ease(reduced, 'transform') }} data-foam={f1(LIQUID_TOP - top)}>
            {[4, 12, 20, 28].map((x) => <circle key={x} cx={inner + x} cy={3} r={5.4} fill={FOAM} stroke={FOAM_EDGE} strokeWidth={1.2} />)}
            <rect x={inner} y={3} width={32} height={150} fill={FOAM} />
            {FOAM_DOTS.map(([x, y, r]) => <circle key={`${x}-${y}`} cx={inner + x} cy={y + 4} r={r} fill="none" stroke={FOAM_EDGE} strokeWidth={0.9} />)}
          </g>
        )}
        <rect x={inner} y={LIQUID_TOP} width={32} height={46} fill={LIQUID} />
        <line x1={inner} x2={inner + 32} y1={LIQUID_TOP} y2={LIQUID_TOP} stroke={WATER_EDGE} strokeWidth={1.2} />
        <path d={`M${TUBE_X - 12} 138 C${TUBE_X - 14} 130 ${TUBE_X - 4} 124 ${TUBE_X + 4} 126 C${TUBE_X + 14} 126 ${TUBE_X + 14} 136 ${TUBE_X + 9} 140 C${TUBE_X + 2} 146 ${TUBE_X - 8} 145 ${TUBE_X - 12} 138 Z`} fill={LIVER} />
        <path d={`M${TUBE_X - 6} 133 C${TUBE_X - 4} 129 ${TUBE_X + 2} 128 ${TUBE_X + 6} 130`} fill="none" stroke={LIVER_HI} strokeWidth={2} strokeLinecap="round" />
        {Array.from({ length: count }, (_, i) => (
          <Bubble key={i} x={TUBE_X - 10 + ((i * 7) % 21)} from={127} to={LIQUID_TOP + 2} r={2.2} n={i} of={count} dur={2.6} reduced={reduced} colour={FOAM_EDGE} />
        ))}
      </g>
    )
  }
  if (facts.shows === 'iodine') {
    return (
      <g clipPath={`url(#${clip})`} data-stuff="iodine">
        <rect x={inner} y={44} width={32} height={110} data-clear={f1(k)} style={{ fill: mix(BLUE_BLACK, STRAW, k), ...ease(reduced, 'fill') }} />
        <line x1={inner} x2={inner + 32} y1={44} y2={44} stroke={GLASS} strokeWidth={1.2} />
      </g>
    )
  }
  if (facts.shows === 'cubes') {
    const size = 17 - k * 13
    const spots: [number, number][] = [[-8, 134], [8, 134], [-7, 115], [8, 116]]
    return (
      <g clipPath={`url(#${clip})`} data-stuff="cubes">
        <rect x={inner} y={44} width={32} height={110} fill={LIQUID} />
        <line x1={inner} x2={inner + 32} y1={44} y2={44} stroke={WATER_EDGE} strokeWidth={1.2} />
        {spots.map(([dx, y], i) => (
          <rect
            key={i} data-cube={f1(size)} x={TUBE_X + dx - 8.5} y={y - 8.5} width={17} height={17} rx={2.5} fill={EGG} stroke={EGG_EDGE} strokeWidth={1.3}
            style={{ transform: `scale(${f1(size / 17)})`, transformBox: 'fill-box', transformOrigin: 'center', ...ease(reduced, 'transform') }}
          />
        ))}
      </g>
    )
  }
  const thick = 36 - k * 32
  return (
    <g clipPath={`url(#${clip})`} data-stuff="fat">
      <rect x={inner} y={44} width={32} height={110} fill={LIQUID} />
      <rect x={inner} y={44} width={32} height={f1(thick)} data-fat={f1(thick)} fill={FAT} stroke={FAT_EDGE} strokeWidth={1.2} style={ease(reduced, 'height')} />
    </g>
  )
}

export type Tag = { text: string; x: number; y: number; anchor: 'start' | 'middle' | 'end'; part: { x: number; y: number } }

/** The names on the tube: beside the thing each one names, and moving with it. */
export function tubeTags(facts: EnzymeFacts, rate: number): Tag[] {
  const x = TUBE_X + 24
  if (facts.shows === 'foam') {
    const h = rate * 0.9
    const y = Math.max(20, Math.min(LIQUID_TOP - 4, LIQUID_TOP - h / 2 + 4))
    const liver: Tag = { text: 'liver', x, y: 140, anchor: 'start', part: { x: TUBE_X + 12, y: 134 } }
    // A name leaves with its thing: a tube with no foam has nothing to call foam.
    if (rate <= 0.4) return [liver]
    return [{ text: 'foam', x, y, anchor: 'start', part: { x: TUBE_X + 18, y: LIQUID_TOP - h / 2 } }, liver]
  }
  if (facts.shows === 'iodine') return [{ text: 'starch', x, y: 140, anchor: 'start', part: { x: TUBE_X + 18, y: 120 } }]
  if (facts.shows === 'cubes') return [{ text: 'egg white', x, y: 140, anchor: 'start', part: { x: TUBE_X + 17, y: 132 } }]
  return [{ text: 'fat', x, y: 58, anchor: 'start', part: { x: TUBE_X + 18, y: 52 } }]
}

function PhPaper({ ph, reduced }: { ph: number; reduced: boolean }) {
  return (
    <g data-ph-paper={ph} fontFamily={FONT}>
      <path d={`M${TUBE_X + 20} 10 L130 9`} fill="none" stroke={SOFT} strokeWidth={1} />
      <rect x={124} y={8} width={13} height={33} rx={1.5} fill={PAPER} stroke={GLASS} strokeWidth={1.1} />
      <rect x={124.6} y={21} width={11.8} height={19.4} rx={1} style={{ fill: phColour(ph), ...ease(reduced, 'fill') }} />
      <text x={142} y={21} fontSize={12.5} fontWeight={700} fill={SOFT}>pH</text>
      <text x={142} y={36} fontSize={12.5} fontWeight={700} fill={SOFT}>paper</text>
    </g>
  )
}

function TubeLabel({ percent }: { percent: number }) {
  return (
    <g data-tube-label={percent} fontFamily={FONT}>
      <path d={`M${TUBE_X + 20} 10 L129 17`} fill="none" stroke={SOFT} strokeWidth={1} />
      <path d="M126 19 L132 14 H158 Q160 14 160 16 V32 Q160 34 158 34 H132 L126 29 Z" fill={PAPER} stroke={GLASS} strokeWidth={1.1} strokeLinejoin="round" />
      <text x={146} y={29} textAnchor="middle" fontSize={13} fontWeight={800} fill={INK}>{percent}%</text>
    </g>
  )
}

function WaterBath({ config, level, rate, reduced }: { config: EnzymeCard; level: number; rate: number; reduced: boolean }) {
  const clip = `er${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const f = factorOf(config)
  const facts = factsOf(config)
  const t = f === 'temperature' ? level : 37
  const heat = t >= 60 ? 1 : t >= 30 ? 0.65 : 0
  const iced = t <= 10
  const steam = t >= 50
  const rim = 40
  const bottom = 150
  const water = 62
  return (
    <g data-bath="">
      {/* the hot plate */}
      <rect x={8} y={bottom} width={162} height={14} rx={3} fill={STEEL} />
      <rect x={14} y={bottom - 1} width={150} height={3.5} rx={1.5} style={{ fill: heat === 0 ? COLD : HOT, opacity: heat === 0 ? 1 : heat, ...ease(reduced, 'fill') }} data-heat={heat} />
      <circle cx={156} cy={bottom + 8} r={3.5} fill={PLATE} stroke={STEEL_DARK} strokeWidth={1} />
      {/* steam, when it is hot */}
      {steam && (
        <g fill="none" stroke={COLD} strokeWidth={2} strokeLinecap="round" data-steam="" opacity={0.75}>
          <path d="M60 52 C56 44 64 40 60 32" />
          <path d="M152 52 C148 44 156 40 152 32" />
        </g>
      )}
      {/* the beaker */}
      <path d={`M14 ${water} H164 V${bottom - 8} Q164 ${bottom} 156 ${bottom} H22 Q14 ${bottom} 14 ${bottom - 8} Z`} fill={WATER} />
      <line x1={14} x2={164} y1={water} y2={water} stroke={WATER_EDGE} strokeWidth={1.4} />
      {iced && (
        <g data-ice="" fill={ICE} stroke={WATER_EDGE} strokeWidth={1.2}>
          <rect x={58} y={57} width={15} height={13} rx={2.5} transform="rotate(-8 65 63)" />
          <rect x={145} y={58} width={14} height={13} rx={2.5} transform="rotate(10 152 64)" />
        </g>
      )}
      <Thermometer t={t} reduced={reduced} />
      {/* the test tube */}
      <path d={`M${TUBE_X - 18} 10 V128 a18 18 0 0 0 36 0 V10`} fill={GLASS_FILL} />
      <clipPath id={clip}><path d={`M${TUBE_X - 16} 12 V128 a16 16 0 0 0 32 0 V12 Z`} /></clipPath>
      <TubeStuff facts={facts} rate={rate} clip={clip} reduced={reduced} />
      <path d={`M${TUBE_X - 18} 10 V128 a18 18 0 0 0 36 0 V10`} fill="none" stroke={GLASS} strokeWidth={2} />
      <line x1={TUBE_X - 22} x2={TUBE_X + 22} y1={10} y2={10} stroke={GLASS} strokeWidth={2.6} strokeLinecap="round" />
      <line x1={TUBE_X - 12} x2={TUBE_X - 12} y1={20} y2={38} stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" opacity={0.8} />
      {/* the beaker's glass, over everything in it */}
      <path d={`M10 ${rim - 2} L14 ${rim + 2} V${bottom - 8} Q14 ${bottom} 22 ${bottom} H156 Q164 ${bottom} 164 ${bottom - 8} V${rim + 2} L168 ${rim - 2}`} fill="none" stroke={GLASS} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
      {[70, 90, 110, 130].map((y) => <line key={y} x1={164} x2={157} y1={y} y2={y} stroke={GLASS} strokeWidth={1.1} />)}
      {f === 'ph' && <PhPaper ph={level} reduced={reduced} />}
      {f === 'substrate' && <TubeLabel percent={level} />}
      <g fontFamily={FONT}>
        {tubeTags(facts, rate).map((tag) => (
          <text key={tag.text} data-tag="" textAnchor={tag.anchor} fontSize={12.5} fontWeight={700} fill={INK} style={{ transform: `translate(${f1(tag.x)}px, ${f1(tag.y)}px)`, ...ease(reduced, 'transform') }}>{tag.text}</text>
        ))}
      </g>
    </g>
  )
}

// ---------------------------------------------------------------------------
// The lens: the molecules, each drawn as a lump of folded protein with its active site.

/** A folded protein with a wedge cut in its side, which is the active site. */
const FOLDED = 'M-19 -9 C-24 -18 -11 -22 -3 -19 C5 -23 18 -19 20 -9 L7 -3.5 L7 3.5 L20 9 C18 19 5 23 -3 19 C-11 22 -24 18 -19 9 C-23 3 -23 -3 -19 -9 Z'
const FOLD_LINES = ['M-15 -9 C-10 -15 -4 -7 1 -13', 'M-16 1 C-10 -5 -5 5 0 -1', 'M-14 11 C-9 6 -3 15 2 10']
/** The same chain, loosened: the wedge has gone, and no substrate could sit in it. */
const LOOSE = 'M-20 -6 C-25 -17 -9 -24 -1 -16 C7 -23 22 -17 19 -7 C24 -3 15 2 10 -1 C5 -3 3 5 9 7 C18 10 16 20 6 18 C0 24 -14 22 -15 13 C-24 13 -24 2 -20 -6 Z'
const LOOSE_LINES = ['M-14 -7 C-8 -3 -6 -13 -1 -8', 'M-14 6 C-9 2 -4 11 1 7']
/** The substrate: a wedge that fits the active site and nothing else. */
const WEDGE = 'M8.5 -3 L21 -8.6 Q23 -9 23 -7 V7 Q23 9 21 8.6 L8.5 3 Q7.8 2.7 7.8 2 V-2 Q7.8 -2.7 8.5 -3 Z'

function SubstrateMark({ busy }: { busy?: boolean }) {
  return <path d={WEDGE} transform={busy ? undefined : 'translate(-15 0)'} fill={SUBSTRATE} stroke={SUBSTRATE_EDGE} strokeWidth={1.3} strokeLinejoin="round" data-substrate={busy ? 'busy' : 'free'} />
}

function MoleculeMark({ m, x, y, turn, scale, reduced }: { m: Molecule; x: number; y: number; turn: number; scale: number; reduced: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${turn}) scale(${scale})`} data-molecule={m.intact ? (m.busy ? 'busy' : 'free') : 'changed'} style={ease(reduced, 'opacity')}>
      {m.intact ? (
        <>
          <path d={FOLDED} fill={ENZYME} stroke={ENZYME_EDGE} strokeWidth={1.6} strokeLinejoin="round" />
          {FOLD_LINES.map((d) => <path key={d} d={d} fill="none" stroke={FOLD} strokeWidth={1.8} strokeLinecap="round" />)}
          {m.busy && <SubstrateMark busy />}
        </>
      ) : (
        <>
          <path d={LOOSE} fill={SPENT} stroke={SPENT_EDGE} strokeWidth={1.6} strokeLinejoin="round" />
          {LOOSE_LINES.map((d) => <path key={d} d={d} fill="none" stroke={SPENT_EDGE} strokeWidth={1.6} strokeLinecap="round" />)}
        </>
      )}
    </g>
  )
}

/** How big a molecule is drawn: the most crowded lens draws them a little smaller, so none touches. */
export const moleculeScale = (n: number) => (n === 5 ? 0.82 : 0.92)
/** The drawn outline's reach from a molecule's centre, before scaling, and a wedge's reach from its own. */
export const MOLECULE_REACH = 24
export const WEDGE_REACH = 9.5

/**
 * Where each molecule sits in the lens, and the gaps left for the substrate waiting about. The first molecule is always nearest
 * the row of names on the left, and the last is the first to fill, so an empty active site stays to be named.
 */
export function lensLayout(n: number): { at: [number, number, number][]; gaps: [number, number][] } {
  if (n === 2) return { at: [[-30, -24, -6], [30, -24, 6]], gaps: [[30, 26], [-30, 26], [0, 2], [0, 48]] }
  if (n === 3) return { at: [[0, 26, 0], [-32, -26, -6], [32, -26, 6]], gaps: [[46, 22], [-46, 22], [0, -50]] }
  if (n === 5) return { at: [[-31, 31, 6], [-31, -31, -6], [0, 0, 0], [31, -31, 6], [31, 31, -6]], gaps: [[0, 52]] }
  return { at: [[-30, 30, 6], [-30, -30, -6], [30, -30, 6], [30, 30, -6]], gaps: [[0, 50], [0, 0], [-52, 0], [52, 0]] }
}

function FreeSubstrate({ x, y, i, pace, reduced }: { x: number; y: number; i: number; pace: number; reduced: boolean }) {
  const swing = ['0 0;4 -3;-3 3;2 4;0 0', '0 0;-3 3;3 2;-2 -4;0 0', '0 0;3 3;-4 -2;2 -3;0 0', '0 0;-2 -3;3 -2;-3 3;0 0'][i % 4]
  return (
    <g transform={`translate(${x} ${y}) rotate(${(i * 67) % 360})`}>
      {!reduced && <animateTransform attributeName="transform" type="translate" values={swing} dur={`${f1(pace)}s`} repeatCount="indefinite" additive="sum" />}
      <SubstrateMark />
    </g>
  )
}

export type Leader = { text: string; x: number; y: number; anchor: 'start' | 'middle' | 'end'; to: { x: number; y: number } }

/** The names of the molecules, in a row under the lens, each with a hairline to what it names. */
export function lensTags(view: LensView, marked: Props['marked']): Leader[] {
  const n = view.molecules.length
  const layout = lensLayout(n)
  const place = (i: number, dx: number, dy: number) => ({ x: LX + layout.at[i][0] + dx, y: LY + layout.at[i][1] + dy })
  const y = 169
  const intact = view.molecules.filter((m) => m.intact).length
  const out: Leader[] = []
  if (intact === n) {
    out.push({ text: 'enzyme', x: 196, y, anchor: 'middle', to: place(0, -13, 12) })
    out.push({ text: 'active site', x: 254, y, anchor: 'middle', to: place(0, 11, 1) })
  } else {
    const word = marked === 'idle' ? (intact === 0 ? 'changed shape' : 'changed') : 'denatured'
    if (intact > 0) {
      out.push({ text: 'enzyme', x: 196, y, anchor: 'middle', to: place(0, -13, 12) })
      out.push({ text: word, x: 254, y, anchor: 'middle', to: place(n - 1, -9, 14) })
    } else out.push({ text: word, x: 228, y, anchor: 'middle', to: place(n - 1, -9, 14) })
  }
  const spot = view.free > 0 ? { x: LX + layout.gaps[0][0] + 3, y: LY + layout.gaps[0][1] + 7 } : place(n - 1, 17, 8)
  if (view.free > 0 || view.molecules.some((m) => m.busy)) out.push({ text: 'substrate', x: 324, y, anchor: 'middle', to: spot })
  return out
}

function Lens({ view, marked, reduced }: { view: LensView; marked: Props['marked']; reduced: boolean }) {
  const { at, gaps } = lensLayout(view.molecules.length)
  return (
    <g data-lens="" fontFamily={FONT}>
      {/* where the lens is looking */}
      <line x1={TUBE_X + 18} y1={118} x2={LX - LR + 3} y2={LY + 26} stroke={RIM} strokeWidth={1.1} strokeDasharray="3 3" />
      <circle cx={LX} cy={LY} r={LR} fill={LENS} stroke={RIM} strokeWidth={3} />
      <circle cx={LX} cy={LY} r={LR - 3} fill="none" stroke={HAIR} strokeWidth={1} />
      {at.map(([x, y, turn], i) => <MoleculeMark key={i} m={view.molecules[i]} x={LX + x} y={LY + y} turn={turn} scale={moleculeScale(view.molecules.length)} reduced={reduced} />)}
      {Array.from({ length: view.free }, (_, i) => (
        <FreeSubstrate key={i} x={LX + gaps[i][0]} y={LY + gaps[i][1]} i={i} pace={view.pace} reduced={reduced} />
      ))}
      {lensTags(view, marked).map((t) => (
        <g key={t.text}>
          <line x1={f1(t.to.x)} y1={f1(t.to.y)} x2={t.x} y2={t.y - 11} stroke={SOFT} strokeWidth={1} data-leader={t.text} />
          <text x={t.x} y={t.y} textAnchor={t.anchor} fontSize={12.5} fontWeight={700} fill={INK} data-tag="">{t.text}</text>
        </g>
      ))}
    </g>
  )
}

// ---------------------------------------------------------------------------
// The pondweed bench.

export const lampX = (l: number) => 26 + (l - 1) * 24
export const gasBottom = (rate: number) => 16 + rate * 1.5

function Lamp({ l, reduced }: { l: number; reduced: boolean }) {
  const clip = `er${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const x = lampX(l)
  const headY = 106
  const beam = 0.2 + l * 0.11
  const travel = { transform: `translateX(${x}px)`, ...ease(reduced, 'transform') }
  return (
    <g data-lamp={l}>
      <clipPath id={clip}><rect x={0} y={0} width={226} height={160} /></clipPath>
      <g clipPath={`url(#${clip})`}>
        <g style={travel}>
          <polygon data-beam={f1(beam)} points={`33,${headY - 16} 33,${headY + 16} 233,${headY + 56} 233,${headY - 56}`} style={{ fill: BEAM, opacity: beam, ...ease(reduced, 'opacity') }} />
        </g>
      </g>
      <g style={travel}>
        <rect x={-15} y={154} width={30} height={6} rx={2} fill={STEEL_DARK} />
        <rect x={-2} y={headY} width={4} height={48} fill={STEEL} />
        <rect x={-2} y={headY - 2} width={12} height={4} fill={STEEL} />
        <circle cx={29} cy={headY} r={9} fill={BULB} stroke={BULB_EDGE} strokeWidth={1.3} />
        <path d={`M8 ${headY - 6} L29 ${headY - 16} V${headY + 16} L8 ${headY + 6} Z`} fill={STEEL_DARK} />
      </g>
    </g>
  )
}

function Weed() {
  const stems = [
    { d: 'M222 148 C218 136 212 128 210 116', leaves: [[219, 140], [215, 131], [212, 122]] as [number, number][] },
    { d: 'M222 148 C223 134 222 122 222 108', leaves: [[223, 138], [223, 127], [222, 116]] as [number, number][] },
    { d: 'M222 148 C226 136 232 128 234 116', leaves: [[225, 140], [229, 131], [232, 122]] as [number, number][] },
  ]
  return (
    <g data-weed="">
      {stems.map((s) => (
        <g key={s.d}>
          <path d={s.d} fill="none" stroke={WEED_EDGE} strokeWidth={2} strokeLinecap="round" />
          {s.leaves.map(([x, y]) => (
            <g key={`${x}-${y}`}>
              <ellipse cx={x - 5} cy={y - 1} rx={5.5} ry={2.2} fill={WEED} stroke={WEED_EDGE} strokeWidth={0.8} transform={`rotate(24 ${x - 5} ${y - 1})`} />
              <ellipse cx={x + 5} cy={y - 1} rx={5.5} ry={2.2} fill={WEED} stroke={WEED_EDGE} strokeWidth={0.8} transform={`rotate(-24 ${x + 5} ${y - 1})`} />
            </g>
          ))}
        </g>
      ))}
    </g>
  )
}

function GasBottle({ level, reduced }: { level: number; reduced: boolean }) {
  const needle = -120 + ((level - 1) / 4) * 240
  return (
    <g data-gas-bottle={level} fontFamily={FONT}>
      <path d="M266 118 C276 112 282 92 290 70" fill="none" stroke={STEEL} strokeWidth={3} strokeLinecap="round" />
      <path d="M266 118 L256 118" fill="none" stroke={STEEL} strokeWidth={3} strokeLinecap="round" />
      <rect x={295} y={62} width={14} height={10} rx={2} fill={STEEL_DARK} />
      <path d="M284 88 Q284 72 302 72 Q320 72 320 88 V156 Q320 160 316 160 H288 Q284 160 284 156 Z" fill={BOTTLE} />
      <rect x={284} y={90} width={36} height={4} fill={BOTTLE_DARK} />
      <text x={302} y={126} textAnchor="middle" fontSize={13} fontWeight={800} fill="#FFFFFF">CO₂</text>
      <circle cx={302} cy={44} r={18} fill="#FFFFFF" stroke={STEEL_DARK} strokeWidth={2.4} />
      {[1, 2, 3, 4, 5].map((v) => {
        const a = ((-120 + ((v - 1) / 4) * 240 - 90) * Math.PI) / 180
        return <line key={v} x1={f1(302 + Math.cos(a) * 11)} y1={f1(44 + Math.sin(a) * 11)} x2={f1(302 + Math.cos(a) * 15)} y2={f1(44 + Math.sin(a) * 15)} stroke={STEEL_DARK} strokeWidth={1.6} />
      })}
      <line x1={302} y1={44} x2={302} y2={31} stroke={MERCURY} strokeWidth={2.4} strokeLinecap="round" data-needle={needle} style={{ transform: `rotate(${needle}deg)`, transformOrigin: '302px 44px', ...ease(reduced, 'transform') }} />
      <circle cx={302} cy={44} r={2.6} fill={STEEL_DARK} />
      <rect x={299} y={60} width={6} height={4} fill={STEEL_DARK} />
    </g>
  )
}

/** The bath's thermometer on the limiting card: 10 to 30 °C, one step of the stepper to each 5 degrees. */
export const pondY = (t: number) => 134 - ((t - 10) / 20) * 92

function PondThermometer({ level, reduced }: { level: number; reduced: boolean }) {
  const t = 10 + (level - 1) * 5
  const x = 258
  const top = pondY(t)
  return (
    <g data-thermometer={t} fontFamily={FONT}>
      <rect x={x - 4.5} y={22} width={9} height={118} rx={4.5} fill={GLASS_FILL} stroke={GLASS} strokeWidth={1.3} />
      <circle cx={x} cy={141} r={7} fill={MERCURY} stroke={GLASS} strokeWidth={1.3} />
      <rect x={x - 2.2} y={top} width={4.4} height={141 - top} fill={MERCURY} style={ease(reduced, 'y 900ms ease, height')} />
      {[10, 15, 20, 25, 30].map((v) => <line key={v} x1={272} x2={280} y1={pondY(v)} y2={pondY(v)} stroke={GLASS} strokeWidth={v % 10 === 0 ? 1.6 : 1.1} />)}
      {[10, 15, 20, 25, 30].map((v) => <line key={`g${v}`} x1={x + 4.5} x2={272} y1={pondY(v)} y2={pondY(v)} stroke={HAIR} strokeWidth={1} />)}
      {[10, 20, 30].map((v) => <text key={v} x={284} y={pondY(v) + 4} fontSize={12} fontWeight={600} fill={SOFT}>{v} °C</text>)}
    </g>
  )
}

function PondweedBench({ config, light, other, rate, reduced }: { config: LimitCard; light: number; other: number; rate: number; reduced: boolean }) {
  const second: SecondName = secondOfCard(config)
  const bottom = 156
  const count = Math.max(2, Math.round(rate / 4))
  const gas = gasBottom(rate)
  const heat = second === 'temperature' ? (other >= 4 ? 1 : other >= 2 ? 0.6 : 0) : 0
  return (
    <g data-bench="" fontFamily={FONT}>
      {/* the bench, with a scale along it for the lamp */}
      <rect x={6} y={160} width={348} height={5} rx={1} fill={BENCH} stroke={BENCH_EDGE} strokeWidth={0.8} />
      {[1, 2, 3, 4, 5].map((v) => <line key={v} x1={lampX(v)} x2={lampX(v)} y1={160.5} y2={164.5} stroke={BENCH_EDGE} strokeWidth={1.2} />)}
      {/* what stands the beaker on the bench: a block, or a hot plate when the water's temperature is the factor */}
      <rect x={172} y={bottom} width={100} height={4} rx={1} fill={second === 'temperature' ? STEEL_DARK : BENCH_EDGE} />
      {second === 'temperature' && <rect x={176} y={bottom - 0.5} width={92} height={2} style={{ fill: heat ? HOT : COLD, opacity: heat || 1, ...ease(reduced, 'fill') }} data-heat={heat} />}
      {/* the water */}
      <path d={`M176 70 H268 V${bottom - 8} Q268 ${bottom} 260 ${bottom} H184 Q176 ${bottom} 176 ${bottom - 8} Z`} fill={WATER} />
      <line x1={176} x2={268} y1={70} y2={70} stroke={WATER_EDGE} strokeWidth={1.3} />
      <Lamp l={light} reduced={reduced} />
      <Weed />
      {/* the funnel over the weed */}
      <path d="M190 150 L216 100 V84 H228 V100 L254 150" fill="none" stroke={GLASS} strokeWidth={2} strokeLinejoin="round" />
      {/* the collecting tube, upside down over the funnel's neck, full of water until the oxygen pushes it down */}
      <path d="M212 92 V24 a10 10 0 0 1 20 0 V92 Z" fill={WATER} />
      <path d="M214 92 V24 a8 8 0 0 1 16 0 V92" fill="none" />
      <rect x={213} y={14} width={18} height={f1(gas - 14)} data-gas={f1(gas - 16)} fill={GAS} style={ease(reduced, 'height')} />
      <line x1={213} x2={231} y1={0} y2={0} stroke={WATER_EDGE} strokeWidth={1.4} data-surface={f1(gas)} style={{ transform: `translateY(${f1(gas)}px)`, ...ease(reduced, 'transform') }} />
      <path d="M212 92 V24 a10 10 0 0 1 20 0 V92" fill="none" stroke={GLASS} strokeWidth={2} />
      {Array.from({ length: count }, (_, i) => (
        <Bubble key={i} x={222 + (i % 2 === 0 ? -2 : 2)} from={106} to={gas + 3} r={2.6} n={i} of={count} dur={3.2} reduced={reduced} colour={WATER_EDGE} />
      ))}
      {/* the beaker's glass, over everything in it */}
      <path d={`M172 54 L176 58 V${bottom - 8} Q176 ${bottom} 184 ${bottom} H260 Q268 ${bottom} 268 ${bottom - 8} V58 L272 54`} fill="none" stroke={GLASS} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
      {second === 'co2' ? <GasBottle level={other} reduced={reduced} /> : <PondThermometer level={other} reduced={reduced} />}
      {benchTags(light, rate).map((t) => <text key={t.text} data-tag="" textAnchor={t.anchor} fontSize={12.5} fontWeight={700} fill={INK} style={{ transform: `translate(${f1(t.x)}px, ${f1(t.y)}px)`, ...ease(reduced, 'transform') }}>{t.text}</text>)}
      <line x1={209} y1={168} x2={218} y2={151} stroke={SOFT} strokeWidth={1} />
    </g>
  )
}

/** The names on the bench: the lamp's moves with it. */
export function benchTags(light: number, rate: number): Tag[] {
  const x = lampX(light)
  return [
    { text: 'lamp', x: x + 18, y: 80, anchor: 'middle', part: { x: x + 18, y: 92 } },
    { text: 'pondweed', x: 205, y: 179, anchor: 'middle', part: { x: 218, y: 150 } },
    { text: 'oxygen', x: 206, y: 28, anchor: 'end', part: { x: 212, y: Math.min(24, gasBottom(rate)) } },
  ]
}

// ---------------------------------------------------------------------------
// The controls, as atom draws its stepper.

const BUTTON = 'nodrag flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-lg border-2 border-ss-line bg-ss-panel text-[16px] font-extrabold leading-none text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'

function Stepper({ name, value, less, more, canLess, canMore, locked, onLess, onMore }: { name: string; value: string; less: string; more: string; canLess: boolean; canMore: boolean; locked: boolean; onLess(): void; onMore(): void }) {
  const onKey = (e: KeyboardEvent) => {
    if (!e.key.startsWith('Arrow')) return
    e.preventDefault()
    e.stopPropagation()
    if (locked) return
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { if (canMore) onMore() } else if (canLess) onLess()
  }
  return (
    <div className="flex items-center justify-between gap-1.5" onKeyDown={onKey}>
      <span className="whitespace-nowrap text-[12px] font-bold text-ss-slate">{name}</span>
      <span className="flex items-center gap-1">
        <button type="button" aria-label={less} disabled={locked || !canLess} onClick={onLess} className={BUTTON}>{'−'}</button>
        <span className="min-w-[56px] whitespace-nowrap text-center text-[15px] font-extrabold tabular-nums text-ss-ink" aria-hidden="true">{value}</span>
        <button type="button" aria-label={more} disabled={locked || !canMore} onClick={onMore} className={BUTTON}>+</button>
      </span>
    </div>
  )
}

function Reading({ name, children, data }: { name: string; children: ReactNode; data?: string }) {
  return (
    <p className="flex items-baseline justify-between gap-2">
      <span className="whitespace-nowrap text-[12px] font-bold text-ss-slate">{name}</span>
      <span className="whitespace-nowrap text-[15px] font-extrabold tabular-nums text-ss-ink" data-reading={data}>{children}</span>
    </p>
  )
}

function Verdict({ text }: { text: string }) {
  const lead = text.match(/^(Yes\. .*?[.])\s+(.*)$/)
  return (
    <div className="rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2">
      <p className="text-[13px] font-extrabold leading-snug text-ss-ink">{lead ? lead[1] : text}</p>
      {lead && <p className="mt-0.5 text-[12px] font-semibold leading-snug text-ss-slate">{lead[2]}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// The two cards.

function EnzymeCardView({ config, state, setState, marked, reduced, locked }: Props & { config: EnzymeCard }) {
  const now = marked === 'shown' ? enzymeRateEngine.solve(config) : state
  const f = factorOf(config)
  const facts = factsOf(config)
  const grid = levelsOf(config)
  const at = atOf(config, now)
  const i = grid.indexOf(at)
  const rate = rateOf(config, now)
  const shown = `${Math.round(rate)}${facts.unit} a minute`
  const traces = tracesOf(config, now)
  const lens = lensOf(config, now)
  const said = marked === 'right' || marked === 'shown' ? working(config, now) : marked === 'wrong' ? madeText(config, now) : ''
  const stepName = f === 'temperature' ? 'Water bath' : f === 'ph' ? 'pH of the buffer' : facts.substrate.charAt(0).toUpperCase() + facts.substrate.slice(1)
  const less = f === 'temperature' ? 'Cool the water bath by 10 degrees' : f === 'ph' ? 'Lower the pH by one' : `Less ${facts.substrate}`
  const more = f === 'temperature' ? 'Warm the water bath by 10 degrees' : f === 'ph' ? 'Raise the pH by one' : `More ${facts.substrate}`
  const go = (by: 1 | -1) => { if (!locked) setState(stepped(config, state, by)) }
  const tubeLine = f === 'substrate' ? null : <Reading name={f === 'temperature' ? 'Hottest this tube' : 'Tube has seen'} data="been">{beenText(config, now)}</Reading>
  const aria = `A test tube of ${facts.substrate} with ${facts.name} stands in a water bath at ${f === 'temperature' ? at : 37} degrees${f === 'ph' ? `, at pH ${at}` : f === 'substrate' ? `, at ${at} percent` : ''}. Its rate is ${shown}. A lens shows ${lens.molecules.length} enzyme molecules, ${lens.molecules.filter((m) => m.busy).length} with substrate in the active site${lens.molecules.some((m) => !m.intact) ? `, and ${lens.molecules.filter((m) => !m.intact).length} that have changed shape` : ''}. A graph shows the readings taken so far.`
  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-2 [&:has(button:focus-visible)_.er-kbd]:block" onKeyDown={(e) => { if (e.key.startsWith('Arrow')) e.stopPropagation() }}>
      <figure className="m-0 flex w-full flex-col gap-1">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={aria} className="block h-auto w-full select-none">
          <rect x={0.75} y={0.75} width={W - 1.5} height={H - 1.5} rx={16} fill={PLATE} stroke={PLATE_EDGE} strokeWidth={1.5} />
          <WaterBath config={config} level={at} rate={rate} reduced={reduced} />
          <Lens view={lens} marked={marked} reduced={reduced} />
          <Graph config={config} traces={traces} state={now} marked={marked} reduced={reduced} />
        </svg>
        <figcaption className="text-center text-[12px] font-bold leading-snug text-ss-slate">{facts.caption}</figcaption>
      </figure>
      <div className="flex flex-col gap-1.5">
        <div className={`grid gap-x-5 ${tubeLine ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <Reading name="Rate" data="rate">{shown}</Reading>
          {tubeLine}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-ss-line pt-1.5">
          <div className={f === 'substrate' ? 'w-full' : 'min-w-0 grow'}>
            <Stepper
              name={stepName} value={levelText(config, at)} less={less} more={more} locked={locked} canLess={i > 0} canMore={i < grid.length - 1}
              onLess={() => go(-1)} onMore={() => go(1)}
            />
          </div>
          {f !== 'substrate' && (
            <button
              type="button" aria-label="Take a fresh tube" disabled={locked} onClick={() => { if (!locked) setState(freshTube(config, state)) }}
              className="nodrag h-7 shrink-0 select-none whitespace-nowrap rounded-lg border-2 border-ss-line bg-ss-panel px-2 text-[12px] font-bold text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
            >Fresh tube</button>
          )}
        </div>
      </div>
      <p className="er-kbd hidden text-[12px] font-semibold text-ss-slate">Tab moves between the buttons. The arrow keys change the setting.</p>
      <span className="sr-only" aria-live="polite">{`${levelText(config, at)}. The rate is ${shown}.`}</span>
      {marked !== 'idle' && <Verdict text={said} />}
    </div>
  )
}

function LimitCardView({ config, state, setState, marked, reduced, locked }: Props & { config: LimitCard }) {
  const now = marked === 'shown' ? enzymeRateEngine.solve(config) : state
  const second = secondOfCard(config)
  const l = lightOf(now)
  const o = otherOf(now)
  const rate = limitRate(l, o)
  const traces = tracesOf(config, now)
  const said = marked === 'right' || marked === 'shown' ? working(config, now) : marked === 'wrong' ? madeText(config, now) : ''
  const name = otherName(second)
  const Name = name.charAt(0).toUpperCase() + name.slice(1)
  const go = (which: 'light' | 'second', by: 1 | -1) => { if (!locked) setState(limitStepped(state, which, by)) }
  const aria = `A lamp shines on pondweed in a beaker, with a funnel and a test tube collecting oxygen. The lamp is at step ${l} of 5 and the ${name} is at ${otherValue(second, o)}. The weed gives ${rate} bubbles a minute, and the aim is ${config.target}. A graph shows the readings taken so far.`
  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-2 [&:has(button:focus-visible)_.er-kbd]:block" onKeyDown={(e) => { if (e.key.startsWith('Arrow')) e.stopPropagation() }}>
      <figure className="m-0 flex w-full flex-col gap-1">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={aria} className="block h-auto w-full select-none">
          <rect x={0.75} y={0.75} width={W - 1.5} height={H - 1.5} rx={16} fill={PLATE} stroke={PLATE_EDGE} strokeWidth={1.5} />
          <PondweedBench config={config} light={l} other={o} rate={rate} reduced={reduced} />
          <Graph config={config} traces={traces} state={now} marked={marked} reduced={reduced} />
        </svg>
        <figcaption className="text-center text-[12px] font-bold leading-snug text-ss-slate">The pondweed gives off oxygen as it makes its food.</figcaption>
      </figure>
      <div className="flex flex-col gap-1.5">
        <div className="grid grid-cols-2 gap-x-5">
          <Reading name="Bubbles a minute" data="rate">{rate}</Reading>
          <Reading name="Aim" data="aim">{config.target}</Reading>
        </div>
        <div className="flex flex-col gap-1 border-t border-ss-line pt-1.5">
          <Stepper name="Lamp, nearer for more light" value={String(l)} less="Move the lamp further away" more="Move the lamp nearer" locked={locked} canLess={l > 1} canMore={l < 5} onLess={() => go('light', -1)} onMore={() => go('light', 1)} />
          <Stepper name={Name} value={otherValue(second, o)} less={second === 'co2' ? 'Less carbon dioxide' : 'Cooler water'} more={second === 'co2' ? 'More carbon dioxide' : 'Warmer water'} locked={locked} canLess={o > 1} canMore={o < 5} onLess={() => go('second', -1)} onMore={() => go('second', 1)} />
        </div>
      </div>
      <p className="er-kbd hidden text-[12px] font-semibold text-ss-slate">Tab moves between the buttons. The arrow keys change the setting.</p>
      <span className="sr-only" aria-live="polite">{`Lamp at step ${l}, ${name} at ${otherValue(second, o)}. ${rate} bubbles a minute.`}</span>
      {marked !== 'idle' && <Verdict text={said} />}
    </div>
  )
}

export function EnzymeRateView(props: Props) {
  const { config } = props
  if (config.task === 'limiting') return <LimitCardView {...props} config={config} />
  return <EnzymeCardView {...props} config={config} />
}

