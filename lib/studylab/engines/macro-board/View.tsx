'use client'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { SceneViewProps } from '../types'
import type { MacroConfig, MacroState, Pipe } from './config'
import {
  WORKER_RUNGS, aimOf, flowsOf, inflation, isCost, leaking, leverInfo, levelOf, macroBoardEngine, madeText, money, movedPipes, pct, pouring, priceMark, shockInfo, stepOf, stepRange, tagRungs, targetMark, unemployment, working,
} from './config'

type Props = SceneViewProps<MacroConfig, MacroState>

// A water machine is not a dark subject: a quiet plate, with the tank drawn as measure-shape's cylinder is, glass and a dark edge
// and solid water with a meniscus. The plate keeps its own colours in both themes. No gradients or shadows.
const PLATE = '#F8FAFC'
const PLATE_EDGE = '#CBD5E1'
const INK = '#16202A'
const SOFT = '#475569'
const FONT = 'system-ui, sans-serif'
const GLASS = '#E6EEF6'
const GLASS_EDGE = '#1E293B'
const WATER = '#3B88D8'
const SURFACE = '#1E3A5F'
const STREAK = '#BFDBFE'
const TICK = '#64748B'
// Pipes: a pale bore with a slate wall, the water running down the middle of it. Valves are brass.
const BORE = '#E2E8F0'
const WALL = '#64748B'
const BRASS = '#C49A4A'
const BRASS_EDGE = '#7A5518'
const HAIR = '#94A3B8'
// A worker in work is solid; one out of work is an empty outline. A tag is empty until the water has passed it.
const WORKER = '#475569'
const OUT = '#B91C1C'
const TAG = '#E3A21A'
const TAG_EDGE = '#7A4E08'
const TAG_IDLE = '#94A3B8'

export const W = 360
export const H = 290
// The levels here are written out because config.ts and this file import each other (the test checks they agree).
const FLOOR_LEVEL = 50
const PX_PER_BN = 1.6
export const TANK_L = 56
export const TANK_R = 236
export const TANK_T = 58
export const TANK_B = TANK_T + 105 * PX_PER_BN
/** The height on the glass of a level, in $bn. */
export const yOf = (level: number) => TANK_B - (level - FLOOR_LEVEL) * PX_PER_BN
/** Three columns, each a pair: firms and banks, government, and the rest of the world. */
export const COLUMNS: Record<Pipe, number> = { investment: 74, saving: 74, government: 148, tax: 148, exports: 214, imports: 214 }
const PIPE_HALF = 15
/** A stream is as many pixels wide as the $bn a year it carries, so the widths in and out can be compared. */
const FLOW_PX = 1
export const WORKER_X = 32
export const TAG_X = 256
export const MARK_TEXT_X = 272
/** The name under the workers, and the name over the top tag. */
export const WORKERS_LABEL_X = 28
export const WORKERS_LABEL_Y = 221
export const PRICES_LABEL_X = 246
export const pricesLabelY = (topRung: number) => yOf(topRung) - 11
const IN_NAMES: [Pipe, string][] = [['investment', 'Investment'], ['government', 'Government'], ['exports', 'Exports']]
const OUT_NAMES: [Pipe, string][] = [['saving', 'Saving'], ['tax', 'Tax'], ['imports', 'Imports']]
export const TOP_LABEL_Y = 14
export const BOTTOM_LABEL_Y = 283
const VALVE_IN_Y = 38
const VALVE_OUT_Y = 246
const MOUTH_Y = 266
/** How fast the level answers: at the starting valves a change is about two-thirds done in 0.6 s. */
const RESPONSE = 4

const f1 = (n: number) => n.toFixed(1)
const streamWidth = (flow: number) => Math.min(PIPE_HALF * 2 - 2, Math.max(0, flow) * FLOW_PX)

type Box = { text: string; left: number; right: number; top: number; bottom: number }
const textBox = (text: string, x: number, y: number, anchor: 'start' | 'middle'): Box => {
  const wide = text.length * 6.2
  const left = anchor === 'middle' ? x - wide / 2 : x
  return { text, left, right: left + wide, top: y - 10, bottom: y + 3 }
}

/** The words on the plate, with the room each takes, so a test can prove none touch. */
export function labelBoxes(config: MacroConfig): Box[] {
  const pipes = [
    ...IN_NAMES.map(([pipe, name]) => textBox(name, COLUMNS[pipe], TOP_LABEL_Y, 'middle')),
    ...OUT_NAMES.map(([pipe, name]) => textBox(name, COLUMNS[pipe], BOTTOM_LABEL_Y, 'middle')),
  ]
  const marks = [textBox('full capacity', MARK_TEXT_X, yOf(100) + 4, 'start')]
  if (isCost(config)) marks.push(textBox('prices steady', MARK_TEXT_X, yOf(priceMark(config)) + 4, 'start'))
  const rails = [textBox('workers', WORKERS_LABEL_X, WORKERS_LABEL_Y, 'middle'), textBox('prices', PRICES_LABEL_X, pricesLabelY(tagRungs(config).at(-1)!), 'start')]
  return [...pipes, ...marks, ...rails]
}

function Figure({ x, y, out, reduced }: { x: number; y: number; out: boolean; reduced: boolean }) {
  const ease = reduced ? undefined : { transition: 'fill 500ms ease, stroke 500ms ease' }
  const style = { fill: out ? PLATE : WORKER, stroke: out ? OUT : WORKER, ...ease }
  return (
    <g transform={`translate(${x} ${f1(y)})`} data-worker={out ? 'out' : 'in'}>
      <circle cx={0} cy={-3.5} r={2.8} strokeWidth={1.5} style={style} />
      <path d="M -5.6 6 V 3 Q -5.6 0.2 -2.2 0.2 H 2.2 Q 5.6 0.2 5.6 3 V 6 Z" strokeWidth={1.5} strokeLinejoin="round" style={style} />
    </g>
  )
}

function PriceTag({ x, y, lit, reduced }: { x: number; y: number; lit: boolean; reduced: boolean }) {
  const ease = reduced ? undefined : { transition: 'fill 500ms ease, stroke 500ms ease' }
  return (
    <g transform={`translate(${x} ${f1(y)})`} data-tag={lit ? 'lit' : 'idle'}>
      <path d="M -11 0 L -5.5 -6 H 11 V 6 H -5.5 Z" strokeWidth={1.4} strokeLinejoin="round" style={{ fill: lit ? TAG : PLATE, stroke: lit ? TAG_EDGE : TAG_IDLE, ...ease }} />
      <circle cx={-5} cy={0} r={1.5} fill={PLATE} stroke={lit ? TAG_EDGE : TAG_IDLE} strokeWidth={0.9} />
      <path d="M -1 -2 H 7 M -1 2 H 5" stroke={lit ? TAG_EDGE : TAG_IDLE} strokeWidth={1.3} strokeLinecap="round" />
    </g>
  )
}

/** A length of clear pipe: a pale bore, slate walls, flanges, and the water down the middle as thick as what it carries. */
function PipeRun({ x, y0, y1, flow, t }: { x: number; y0: number; y1: number; flow: number; t: number }) {
  const w = streamWidth(flow)
  return (
    <g>
      <rect x={x - PIPE_HALF} y={y0} width={PIPE_HALF * 2} height={y1 - y0} fill={BORE} />
      {w > 0 && <rect x={f1(x - w / 2)} y={y0} width={f1(w)} height={y1 - y0} fill={WATER} data-stream="1" />}
      {w > 3 && <line x1={x} x2={x} y1={y0} y2={y1} stroke={STREAK} strokeWidth={1.6} strokeLinecap="round" strokeDasharray="5 13" strokeDashoffset={f1(-t * 26)} />}
      <line x1={x - PIPE_HALF} x2={x - PIPE_HALF} y1={y0} y2={y1} stroke={WALL} strokeWidth={1.6} />
      <line x1={x + PIPE_HALF} x2={x + PIPE_HALF} y1={y0} y2={y1} stroke={WALL} strokeWidth={1.6} />
      {[y0, y1].map((y) => <rect key={y} x={x - PIPE_HALF - 3} y={y - 2} width={(PIPE_HALF + 3) * 2} height={4} rx={1} fill={WALL} />)}
    </g>
  )
}

/** A brass gate across the pipe, with a handwheel on a short stem. The wheel turns with the valve's setting. */
function Valve({ x, y, setting, driven, reduced }: { x: number; y: number; setting: number; driven: boolean; reduced: boolean }) {
  const wheel = driven ? 'var(--subject)' : BRASS_EDGE
  const turn = reduced ? undefined : { transition: 'transform 700ms ease' }
  return (
    <g data-valve={driven ? 'driven' : 'fixed'}>
      <rect x={x - PIPE_HALF - 3} y={y - 5.5} width={(PIPE_HALF + 3) * 2} height={11} rx={2} fill={BRASS} stroke={BRASS_EDGE} strokeWidth={1.3} />
      <line x1={x + PIPE_HALF + 3} x2={x + PIPE_HALF + 7} y1={y} y2={y} stroke={BRASS_EDGE} strokeWidth={2.2} />
      <g transform={`translate(${x + PIPE_HALF + 14} ${y})`}>
        <g style={{ transform: `rotate(${setting * 22}deg)`, ...turn }} data-wheel={setting}>
          <circle r={6.4} fill={PLATE} stroke={wheel} strokeWidth={driven ? 2.8 : 2} />
          <path d="M -6 0 H 6 M 0 -6 V 6" stroke={wheel} strokeWidth={driven ? 2 : 1.5} strokeLinecap="round" />
        </g>
      </g>
    </g>
  )
}

/** One mark across the glass, with its band: inside the band is on the mark. The mark the card asks for is the bolder. */
function Mark({ level, name, target, x0 }: { level: number; name: string; target: boolean; x0: number }) {
  const y = yOf(level)
  const band = 5 * PX_PER_BN
  return (
    <g data-mark={level} data-target={target ? '1' : '0'} fontFamily={FONT}>
      {target && <rect x={TANK_L + 1.2} y={f1(y - band)} width={TANK_R - TANK_L - 2.4} height={f1(band * 2)} fill="#FFFFFF" fillOpacity={0.3} />}
      {target && (
        <g stroke={SURFACE} strokeWidth={0.9} strokeDasharray="2 3">
          <line x1={TANK_L + 1.2} x2={TANK_R - 1.2} y1={f1(y - band)} y2={f1(y - band)} />
          <line x1={TANK_L + 1.2} x2={TANK_R - 1.2} y1={f1(y + band)} y2={f1(y + band)} />
        </g>
      )}
      <line x1={x0} x2={MARK_TEXT_X - 4} y1={f1(y)} y2={f1(y)} stroke={INK} strokeWidth={target ? 2 : 1.3} strokeDasharray={target ? undefined : '6 4'} />
      <text x={MARK_TEXT_X} y={f1(y + 4)} fontSize={12} fontWeight={700} fill={INK}>{name}</text>
    </g>
  )
}

function useWater(goal: { pour: number; leak: number; level: number }, reduced: boolean) {
  const [frame, setFrame] = useState({ level: goal.level, t: 0 })
  const live = useRef(frame)
  const aim = useRef(goal)
  aim.current = goal
  useEffect(() => {
    if (reduced) return
    let raf = 0
    let last = 0
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016
      last = now
      const { pour, leak } = aim.current
      // What pours in less what leaks out: the same sum as the level it settles at, only run in time.
      const level = live.current.level + (pour - (leak * live.current.level) / 100) * RESPONSE * dt
      live.current = { level, t: live.current.t + dt }
      setFrame(live.current)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [reduced])
  return reduced ? { level: goal.level, t: 0 } : frame
}

/** A worker out of work, or a lit tag, on a chip of the plate's own colour, so it reads the same as in the picture in either theme. */
function Swatch({ kind }: { kind: 'out' | 'tag' }) {
  return (
    <span className="flex shrink-0 items-center justify-center rounded-md" style={{ background: PLATE, width: 22, height: 18 }} aria-hidden="true" data-swatch={kind}>
      {kind === 'tag' ? (
        <svg viewBox="-12 -7 24 14" width={20} height={12}>
          <path d="M -11 0 L -5.5 -6 H 11 V 6 H -5.5 Z" fill={TAG} stroke={TAG_EDGE} strokeWidth={1.4} strokeLinejoin="round" />
          <circle cx={-5} cy={0} r={1.5} fill={PLATE} stroke={TAG_EDGE} strokeWidth={0.9} />
        </svg>
      ) : (
        <svg viewBox="-7 -8 14 16" width={13} height={15}>
          <circle cx={0} cy={-3.5} r={2.8} fill="none" stroke={OUT} strokeWidth={1.5} />
          <path d="M -5.6 6 V 3 Q -5.6 0.2 -2.2 0.2 H 2.2 Q 5.6 0.2 5.6 3 V 6 Z" fill="none" stroke={OUT} strokeWidth={1.5} strokeLinejoin="round" />
        </svg>
      )}
    </span>
  )
}

const STEP = 'nodrag flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-lg border-2 border-ss-line bg-ss-panel text-[16px] font-extrabold leading-none text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'

/** The same wheel as on the coloured valves, beside the lever that turns them. */
function WheelMark() {
  return (
    <svg viewBox="-8 -8 16 16" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
      <circle r={6.4} fill="none" stroke="var(--subject)" strokeWidth={2.8} />
      <path d="M -6 0 H 6 M 0 -6 V 6" stroke="var(--subject)" strokeWidth={2} strokeLinecap="round" />
    </svg>
  )
}

function describe(config: MacroConfig, name: string, value: string, level: number): string {
  const marks = isCost(config) ? `The full capacity mark is ${money(100)} and the prices steady mark is ${money(priceMark(config))}.` : `The full capacity mark is ${money(100)}.`
  return `A glass tank of water stands for the money going round the economy. Water pours in through the investment, government and exports pipes, and drains away through the saving, tax and imports pipes. ${name} is ${value}. The water stands at ${money(level)}. ${marks}`
}

export function MacroBoardView({ config, state, setState, marked, reduced, locked }: Props) {
  const now = marked === 'shown' ? macroBoardEngine.solve(config) : state
  const step = stepOf(config, now)
  const flows = flowsOf(config, step)
  const pour = pouring(flows)
  const leak = leaking(flows)
  const settled = levelOf(flows)
  const { level, t } = useWater({ pour, leak, level: settled }, reduced)
  const info = leverInfo(config)
  const shock = shockInfo(config)
  const driven = movedPipes(config)
  const { min, max } = stepRange(config)
  const u = unemployment(level)
  const p = inflation(config, level)
  const surface = yOf(level)
  const finished = marked === 'right' || marked === 'shown'
  const said = finished ? working(config, now) : marked === 'wrong' ? madeText(config, now) : ''
  const lead = said.match(/^(Yes\. [^.]*\.)\s*(.*)$/)
  const setting = (pipe: Pipe) => (driven.includes(pipe) ? step * (info.moves[pipe]! > 0 ? 1 : -1) * 2 : 0)
  const go = (next: number) => { if (!locked && !finished) setState({ step: next }) }
  // The board moves cards with the arrow keys; inside the card they belong to the card.
  const onKey = (e: KeyboardEvent) => { if (e.key.startsWith('Arrow')) e.stopPropagation() }

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-2" onKeyDown={onKey}>
      <figure className="m-0 flex w-full flex-col gap-1.5">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={describe(config, info.name, info.value(step), settled)} className="block h-auto w-full select-none">
          <rect x={0.75} y={0.75} width={W - 1.5} height={H - 1.5} rx={16} fill={PLATE} stroke={PLATE_EDGE} strokeWidth={1.5} />

          {/* The drains, from the floor of the tank to their mouths, each stream as thick as the money leaving. */}
          {OUT_NAMES.map(([pipe]) => {
            const x = COLUMNS[pipe]
            const flow = (flows[pipe] * level) / 100
            const w = streamWidth(flow)
            return (
              <g key={pipe}>
                <PipeRun x={x} y0={TANK_B} y1={MOUTH_Y} flow={flow} t={t} />
                {w > 0 && <rect x={f1(x - w / 2)} y={MOUTH_Y} width={f1(w)} height={5} fill={WATER} />}
                <Valve x={x} y={VALVE_OUT_Y} setting={setting(pipe)} driven={driven.includes(pipe)} reduced={reduced} />
              </g>
            )
          })}

          {/* The tank. */}
          <path d={`M ${TANK_L} ${TANK_T} V ${TANK_B - 9} Q ${TANK_L} ${TANK_B} ${TANK_L + 9} ${TANK_B} H ${TANK_R - 9} Q ${TANK_R} ${TANK_B} ${TANK_R} ${TANK_B - 9} V ${TANK_T} Z`} fill={GLASS} />

          {/* What pours in falls through the air and into the water. */}
          {IN_NAMES.map(([pipe]) => {
            const x = COLUMNS[pipe]
            const w = streamWidth(flows[pipe])
            return w > 0 ? (
              <g key={pipe}>
                <rect x={f1(x - w / 2)} y={TANK_T} width={f1(w)} height={f1(surface - TANK_T + 2)} fill={WATER} />
                {w > 3 && <line x1={x} x2={x} y1={TANK_T} y2={f1(surface)} stroke={STREAK} strokeWidth={1.6} strokeLinecap="round" strokeDasharray="5 13" strokeDashoffset={f1(-t * 26)} />}
              </g>
            ) : null
          })}

          {/* The water, with its meniscus. */}
          <path
            data-water={f1(level)}
            d={`M ${TANK_L + 1} ${f1(surface - 4)} Q ${TANK_L + 7} ${f1(surface + 1)} ${TANK_L + 18} ${f1(surface + 1)} H ${TANK_R - 18} Q ${TANK_R - 7} ${f1(surface + 1)} ${TANK_R - 1} ${f1(surface - 4)} V ${TANK_B - 9} Q ${TANK_R - 1} ${TANK_B - 1} ${TANK_R - 9} ${TANK_B - 1} H ${TANK_L + 9} Q ${TANK_L + 1} ${TANK_B - 1} ${TANK_L + 1} ${TANK_B - 9} Z`}
            fill={WATER}
          />
          <path d={`M ${TANK_L + 1} ${f1(surface - 4)} Q ${TANK_L + 7} ${f1(surface + 1)} ${TANK_L + 18} ${f1(surface + 1)} H ${TANK_R - 18} Q ${TANK_R - 7} ${f1(surface + 1)} ${TANK_R - 1} ${f1(surface - 4)}`} fill="none" stroke={SURFACE} strokeWidth={2} />

          {/* Where each stream lands, a little foam on the surface. */}
          {IN_NAMES.map(([pipe]) => {
            const w = streamWidth(flows[pipe])
            return w > 0 ? <ellipse key={pipe} cx={COLUMNS[pipe]} cy={f1(surface + 3)} rx={f1(w / 2 + 5)} ry={2.2} fill={STREAK} /> : null
          })}

          {/* Graded ticks up the glass, one for every $10bn. */}
          <g stroke={TICK} strokeWidth={1.2}>
            {[60, 70, 80, 90, 100, 110, 120, 130, 140, 150].map((n) => <line key={n} x1={TANK_R - 8} x2={TANK_R - 1.5} y1={f1(yOf(n))} y2={f1(yOf(n))} />)}
          </g>

          {/* The walls, the lip and the name of what is in it. */}
          <path d={`M ${TANK_L} ${TANK_T} V ${TANK_B - 9} Q ${TANK_L} ${TANK_B} ${TANK_L + 9} ${TANK_B} H ${TANK_R - 9} Q ${TANK_R} ${TANK_B} ${TANK_R} ${TANK_B - 9} V ${TANK_T}`} fill="none" stroke={GLASS_EDGE} strokeWidth={2.2} />
          <line x1={TANK_L - 5} x2={TANK_R + 5} y1={TANK_T} y2={TANK_T} stroke={GLASS_EDGE} strokeWidth={2.4} strokeLinecap="round" />
          <text x={(TANK_L + TANK_R) / 2} y={TANK_B - 7} textAnchor="middle" fontFamily={FONT} fontSize={12} fontWeight={700} fill="#FFFFFF" data-money="1">{`money going round: ${money(level)}`}</text>

          {/* The pipes in, and their valves. */}
          {IN_NAMES.map(([pipe, name]) => {
            const x = COLUMNS[pipe]
            return (
              <g key={pipe}>
                <PipeRun x={x} y0={20} y1={TANK_T - 1} flow={flows[pipe]} t={t} />
                <Valve x={x} y={VALVE_IN_Y} setting={setting(pipe)} driven={driven.includes(pipe)} reduced={reduced} />
                <text x={x} y={TOP_LABEL_Y} textAnchor="middle" fontFamily={FONT} fontSize={12} fontWeight={700} fill={SOFT}>{name}</text>
              </g>
            )
          })}
          {OUT_NAMES.map(([pipe, name]) => (
            <text key={pipe} x={COLUMNS[pipe]} y={BOTTOM_LABEL_Y} textAnchor="middle" fontFamily={FONT} fontSize={12} fontWeight={700} fill={SOFT}>{name}</text>
          ))}

          {/* The workers on the left, the tags on the right, each joined to the glass at the level it answers to. */}
          {WORKER_RUNGS.map((rung) => (
            <g key={rung}>
              <line x1={WORKER_X + 9} x2={TANK_L - 2} y1={f1(yOf(rung))} y2={f1(yOf(rung))} stroke={HAIR} strokeWidth={1} strokeDasharray="1.5 3" />
              <Figure x={WORKER_X} y={yOf(rung)} out={level < rung} reduced={reduced} />
            </g>
          ))}
          {tagRungs(config).map((rung) => (
            <g key={rung}>
              <line x1={TANK_R + 2} x2={TAG_X - 12} y1={f1(yOf(rung))} y2={f1(yOf(rung))} stroke={HAIR} strokeWidth={1} strokeDasharray="1.5 3" />
              <PriceTag x={TAG_X} y={yOf(rung)} lit={level > rung} reduced={reduced} />
            </g>
          ))}

          <text x={WORKERS_LABEL_X} y={WORKERS_LABEL_Y} textAnchor="middle" fontFamily={FONT} fontSize={12} fontWeight={700} fill={SOFT}>workers</text>
          <text x={PRICES_LABEL_X} y={f1(pricesLabelY(tagRungs(config).at(-1)!))} fontFamily={FONT} fontSize={12} fontWeight={700} fill={SOFT}>prices</text>

          {/* The marks. */}
          <Mark level={100} name="full capacity" target={targetMark(config) === 100} x0={WORKER_X + 9} />
          {isCost(config) && <Mark level={priceMark(config)} name="prices steady" target={aimOf(config) === 'prices'} x0={TANK_L + 1} />}
        </svg>
        <figcaption className="text-center text-[12px] font-bold text-ss-slate">{shock.story}</figcaption>
      </figure>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-1.5">
          <span className="flex items-center gap-1.5 text-[12px] font-bold text-ss-slate"><WheelMark />{info.name}</span>
          <span className="flex items-center gap-1">
            <button type="button" aria-label={info.less} disabled={locked || finished || step <= min} onClick={() => go(step - 1)} className={STEP}>{'−'}</button>
            <span className="min-w-[56px] text-center text-[15px] font-extrabold tabular-nums text-ss-ink" data-lever={step}>{info.value(step)}</span>
            <button type="button" aria-label={info.more} disabled={locked || finished || step >= max} onClick={() => go(step + 1)} className={STEP}>+</button>
          </span>
        </div>
        <div className="grid grid-cols-2 gap-x-6 border-t border-ss-line pt-1.5">
          <p className="flex items-center justify-between">
            <span className="flex items-center gap-1 text-[12px] font-bold text-ss-slate"><Swatch kind="out" />Unemployment</span>
            <span className="text-[15px] font-extrabold tabular-nums text-ss-ink" data-unemployment="1">{pct(u)}</span>
          </p>
          <p className="flex items-center justify-between">
            <span className="flex items-center gap-1 text-[12px] font-bold text-ss-slate"><Swatch kind="tag" />Inflation</span>
            <span className="text-[15px] font-extrabold tabular-nums text-ss-ink" data-inflation="1">{pct(p)}</span>
          </p>
        </div>
      </div>

      <span className="sr-only" aria-live="polite">{`${info.name} ${info.value(step)}. The water settles at ${money(settled)}. Unemployment ${pct(unemployment(settled))}, inflation ${pct(inflation(config, settled))}.`}</span>
      {marked !== 'idle' && (
        <div className="rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2">
          <p className="text-[13px] font-extrabold leading-snug text-ss-ink">{lead ? lead[1] : said}</p>
          {lead && lead[2] && <p className="mt-0.5 text-[12px] font-semibold leading-snug text-ss-slate">{lead[2]}</p>}
        </div>
      )}
    </div>
  )
}
