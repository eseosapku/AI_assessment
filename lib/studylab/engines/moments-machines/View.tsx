'use client'
import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode, type RefObject } from 'react'
import type { SceneViewProps } from '../types'
import type { BalanceConfig, GearsConfig, LeverConfig, MachineConfig, MachineState, PulleyConfig } from './config'
import {
  canPull, discUnit, fixedPivot, freeMarks, gearTurns, isAbsolute, leanOf, leverHolds, madeText, markOfLoad, momentsMachinesEngine, pullNeeded, pushNeeded, readAt, readDiscs, readFulcrum, readIdler, readPulled, readStrands, readTeeth, tiltOf, working,
} from './config'

type Props = SceneViewProps<MachineConfig, MachineState>

// Machines are not a dark subject: a quiet plate, as measure-shape's and network-sim's are, with real materials on it. The plate
// keeps its own colours in both themes, so each part keeps its contrast against it. No gradients or shadows.
const PLATE = '#F8FAFC'
const PLATE_EDGE = '#CBD5E1'
const INK = '#16202A'
const SOFT = '#475569'
const HAIR = '#CBD5E1'
const FONT = 'system-ui, sans-serif'
// Wood: a pale planed face with darker edge and grain.
const WOOD = '#DDBB86'
const WOOD_EDGE = '#8A6236'
const WOOD_GRAIN = '#C9A369'
const WOOD_DARK = '#B98D52'
const WOOD_INK = '#3F2A12'
// Steel and cast iron.
const STEEL = '#B4C0CF'
const STEEL_LIGHT = '#DCE3EB'
const STEEL_EDGE = '#475569'
const IRON = '#475569'
const IRON_EDGE = '#1E293B'
const IRON_LIGHT = '#64748B'
// Brass is the one accent: whatever the learner changes is brass.
const BRASS = '#E3B341'
const BRASS_EDGE = '#8A6414'
const BRASS_LIGHT = '#F3D27A'
const BRASS_INK = '#6B4D0C'
// Rock, rope, rubber and ground.
const ROCK = '#94A0AE'
const ROCK_LIGHT = '#AEB8C4'
const ROCK_DARK = '#7A8694'
const ROCK_EDGE = '#475569'
const ROPE_EDGE = '#7C5A2C'
const ROPE = '#C29A5C'
const ROPE_TWIST = '#E6CE9C'
const RUBBER = '#1E293B'
const GROUND = '#E2E8F0'
const GROUND_EDGE = '#94A3B8'

export const W = 360
export const R = 16

const f1 = (n: number) => Number(n.toFixed(1))
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const rad = (d: number) => (d * Math.PI) / 180
const safeId = (id: string) => id.replace(/[^a-zA-Z0-9]/g, '')

const STEP = 'nodrag flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-lg border-2 border-ss-line bg-ss-panel text-[16px] font-extrabold leading-none text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'
const WORD = 'nodrag flex h-7 shrink-0 select-none items-center justify-center whitespace-nowrap rounded-lg border-2 border-ss-line bg-ss-panel px-2.5 text-[12px] font-bold leading-none text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'

/** A stepper, as atom's: a label, then a button, the value and the other button, aligned. */
function Stepper(props: { name: string; value: string; less: string; more: string; canLess: boolean; canMore: boolean; onLess(): void; onMore(): void; glyphs?: [string, string] }) {
  const { name, value, less, more, canLess, canMore, onLess, onMore, glyphs = ['−', '+'] } = props
  return (
    <div className="flex items-center justify-between gap-1.5">
      <span className="text-[12px] font-bold text-ss-slate">{name}</span>
      <span className="flex items-center gap-1">
        <button type="button" aria-label={less} disabled={!canLess} onClick={onLess} className={STEP}>{glyphs[0]}</button>
        <span className="min-w-[56px] text-center text-[15px] font-extrabold tabular-nums text-ss-ink" aria-hidden="true">{value}</span>
        <button type="button" aria-label={more} disabled={!canMore} onClick={onMore} className={STEP}>{glyphs[1]}</button>
      </span>
    </div>
  )
}

/** How much force the machine asks for, against the most the learner has. A slim bar with no number, so reading it is not the answer. */
function Meter({ name, share, limit, limitName, reduced }: { name: string; share: number; limit: number; limitName: string; reduced: boolean }) {
  return (
    <div className="flex items-center gap-2" aria-hidden="true">
      <span className="shrink-0 whitespace-nowrap text-[12px] font-bold text-ss-slate">{name}</span>
      <span className="relative h-2.5 flex-1 rounded-full border border-ss-line bg-ss-chip" data-meter={f1(share * 100)}>
        <span className={`absolute inset-y-0 left-0 rounded-full bg-ss-slate ${reduced ? '' : 'transition-[width] duration-700 ease-out'}`} style={{ width: `${clamp(share, 0, 1) * 100}%` }} />
        <span className="absolute -inset-y-1 w-[3px] -translate-x-1/2 rounded-full" style={{ left: `${limit * 100}%`, background: BRASS }} />
      </span>
      <span className="flex shrink-0 items-center gap-1 whitespace-nowrap text-[12px] font-bold text-ss-slate">
        <span className="h-3 w-[3px] rounded-full" style={{ background: BRASS }} />{limitName}
      </span>
    </div>
  )
}

function Verdict({ text }: { text: string }) {
  if (!text) return null
  const lead = text.match(/^(Yes\. .*?\.)\s+(.*)$/)
  return (
    <div className="rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2">
      <p className="text-[13px] font-extrabold leading-snug text-ss-ink">{lead ? lead[1] : text}</p>
      {lead && lead[2] && <p className="mt-0.5 text-[12px] font-semibold leading-snug text-ss-slate">{lead[2]}</p>}
    </div>
  )
}

/** The plate: a rounded panel with a hairline edge, and whatever stands on it clipped to its corners. */
function Plate({ h, label, svgRef, children, base }: { h: number; label: string; svgRef?: RefObject<SVGSVGElement | null>; children: ReactNode; base?: ReactNode }) {
  const id = safeId(useId())
  return (
    <svg ref={svgRef as RefObject<SVGSVGElement>} viewBox={`0 0 ${W} ${h}`} role="img" aria-label={label} className="block h-auto w-full select-none" fontFamily={FONT}>
      <clipPath id={id}><rect x={0.75} y={0.75} width={W - 1.5} height={h - 1.5} rx={R} /></clipPath>
      <rect x={0.75} y={0.75} width={W - 1.5} height={h - 1.5} rx={R} fill={PLATE} />
      {base && <g clipPath={`url(#${id})`}>{base}</g>}
      <rect x={0.75} y={0.75} width={W - 1.5} height={h - 1.5} rx={R} fill="none" stroke={PLATE_EDGE} strokeWidth={1.5} />
      {children}
    </svg>
  )
}

/** Dragging a thing along a line of marks: it snaps to whichever mark the pointer is nearest. */
function useSlide(svgRef: RefObject<SVGSVGElement | null>, active: boolean, pick: (x: number) => void) {
  const held = useRef(false)
  const at = (e: PointerEvent) => {
    const box = svgRef.current?.getBoundingClientRect()
    if (box && box.width > 0) pick(((e.clientX - box.left) / box.width) * W)
  }
  return {
    onPointerDown(e: PointerEvent<SVGGElement>) {
      if (!active) return
      held.current = true
      e.stopPropagation()
      e.currentTarget.setPointerCapture?.(e.pointerId)
      at(e)
    },
    onPointerMove(e: PointerEvent<SVGGElement>) { if (held.current) at(e) },
    onPointerUp() { held.current = false },
    onPointerCancel() { held.current = false },
  }
}

/** Left and right on a slider, and the board keeps its hands off the arrows. */
const arrowKeys = (go: (by: number) => void) => (e: KeyboardEvent) => {
  const by = ({ ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 } as Record<string, number>)[e.key]
  if (by === undefined) return
  e.preventDefault()
  e.stopPropagation()
  go(by)
}

/** The grip on anything the learner can slide: two chevrons on a small brass tab. */
function Grip({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} aria-hidden="true">
      <rect x={-19} y={-8} width={38} height={16} rx={5} fill={BRASS} stroke={BRASS_EDGE} strokeWidth={1.4} />
      <path d="M -8 -3.5 L -12.5 0 L -8 3.5 M 8 -3.5 L 12.5 0 L 8 3.5" fill="none" stroke={BRASS_INK} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M -2.6 -3.5 V 3.5 M 2.6 -3.5 V 3.5" stroke={BRASS_EDGE} strokeWidth={1.2} strokeLinecap="round" />
    </g>
  )
}

/** Help for the arrows, shown only while a keyboard is on a slider: a mouse press also focuses. */
const KeyHelp = ({ text }: { text: string }) => <p className="mm-kbd hidden text-[12px] font-semibold text-ss-slate">{text}</p>
const WITH_KEYS = '[&:has(g[role=slider]:focus-visible)_.mm-kbd]:block'

const Ring = () => <rect className="mm-ring opacity-0" x={-24} y={-14} width={48} height={28} rx={8} fill="none" stroke="var(--subject, #0F766E)" strokeWidth={2.5} />
const SLIDER = 'cursor-grab touch-none outline-none active:cursor-grabbing [&:focus-visible_.mm-ring]:opacity-100'

// ---------------------------------------------------------------------------
// The rule on its stand.

export const BAL_H = 256
export const BY = 72
export const MARK = 30
export const CX = 180
export const PLANK_HALF = 164
export const PLANK_H = 22
export const DISC_H = 6.5
export const STRING = 26
export const FLOOR = 238
export const stackHeight = (discs: number) => 8 + discs * DISC_H + 3
const labelOffset = (discs: number) => STRING + stackHeight(discs) + 14

/** Under a stack, and lowered when the neighbour's label would touch it. */
export function stackLabels(stacks: { x: number; discs: number; text: string }[]): number[] {
  const wide = (t: string) => t.length * 7 + 2
  const placed: { x: number; y: number; w: number }[] = []
  return stacks.map((s) => {
    let y = labelOffset(s.discs)
    for (const p of placed) {
      if (Math.abs(p.x - s.x) * MARK < (p.w + wide(s.text)) / 2 + 2 && Math.abs(p.y - y) < 14) y = p.y + 14
    }
    placed.push({ x: s.x, y, w: wide(s.text) })
    return y
  })
}

/** A hanger on its loop of cord, with slotted discs on it: each disc is one count of the force. It hangs plumb however the rule leans. */
function Stack({ discs, brass, label, labelY }: { discs: number; brass: boolean; label: string; labelY: number }) {
  const face = brass ? BRASS : IRON
  const edge = brass ? BRASS_EDGE : IRON_EDGE
  const light = brass ? BRASS_LIGHT : IRON_LIGHT
  const top = STRING + 8
  return (
    <g>
      <line x1={0} y1={0} x2={0} y2={STRING} stroke={SOFT} strokeWidth={1.6} />
      <circle cx={0} cy={STRING + 1} r={2.4} fill="none" stroke={SOFT} strokeWidth={1.4} />
      <rect x={-1.6} y={STRING + 3} width={3.2} height={stackHeight(discs) - 3} fill={SOFT} />
      <rect x={-11} y={top + discs * DISC_H} width={22} height={3} rx={1} fill={SOFT} />
      {Array.from({ length: discs }, (_, k) => (
        <g key={k} data-disc={brass ? 'brass' : 'iron'}>
          <rect x={-14} y={top + k * DISC_H} width={28} height={DISC_H - 0.7} rx={1.6} fill={face} stroke={edge} strokeWidth={0.9} />
          <line x1={-11} x2={-3.5} y1={top + k * DISC_H + 1.4} y2={top + k * DISC_H + 1.4} stroke={light} strokeWidth={1} strokeLinecap="round" />
        </g>
      ))}
      <rect x={-1.2} y={top - 1} width={2.4} height={discs * DISC_H + 1} fill={edge} />
      <text x={0} y={labelY} textAnchor="middle" fontSize={12} fontWeight={700} fill={brass ? BRASS_INK : INK} stroke={PLATE} strokeWidth={3} paintOrder="stroke" strokeLinejoin="round">{label}</text>
    </g>
  )
}

function Stand({ x, reduced }: { x: number; reduced: boolean }) {
  const ease = reduced ? undefined : 'transform 900ms ease'
  return (
    <g style={{ transform: `translate(${x}px, 0px)`, transition: ease }} data-stand={x}>
      <rect x={-4} y={BY} width={8} height={FLOOR - 10 - BY} fill={STEEL} stroke={STEEL_EDGE} strokeWidth={1.2} />
      <line x1={-1.5} x2={-1.5} y1={BY + 14} y2={FLOOR - 12} stroke={STEEL_LIGHT} strokeWidth={1.4} />
      <rect x={-9} y={FLOOR - 26} width={18} height={9} rx={2} fill={IRON} />
      <rect x={-38} y={FLOOR - 10} width={76} height={10} rx={3} fill={IRON} stroke={IRON_EDGE} strokeWidth={1} />
      <line x1={-31} x2={31} y1={FLOOR - 7.5} y2={FLOOR - 7.5} stroke={IRON_LIGHT} strokeWidth={1.2} strokeLinecap="round" />
    </g>
  )
}

function ruleNumber(config: BalanceConfig, x: number): number {
  const step = config.unit === 'm' ? 1 : 10
  return isAbsolute(config) ? (x + 5) * step : Math.abs(x) * step
}

function Plank({ config, skip }: { config: BalanceConfig; skip?: number }) {
  const marks = isAbsolute(config) ? [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5] : [-5, -4, -3, -2, -1, 1, 2, 3, 4, 5]
  return (
    <g>
      <rect x={CX - PLANK_HALF} y={BY - PLANK_H / 2} width={PLANK_HALF * 2} height={PLANK_H} rx={3} fill={WOOD} stroke={WOOD_EDGE} strokeWidth={1.5} />
      <path d={`M ${CX - PLANK_HALF + 6} ${BY - 7.5} H ${CX + PLANK_HALF - 6} M ${CX - PLANK_HALF + 6} ${BY + 8} H ${CX + PLANK_HALF - 6}`} stroke={WOOD_GRAIN} strokeWidth={1} />
      {marks.map((x) => (
        <g key={x}>
          <line x1={CX + x * MARK} x2={CX + x * MARK} y1={BY - PLANK_H / 2} y2={BY - PLANK_H / 2 + 4} stroke={WOOD_INK} strokeWidth={1.3} />
          {x !== skip && <text x={CX + x * MARK} y={BY + 5.5} textAnchor="middle" fontSize={12} fontWeight={700} fill={WOOD_INK}>{ruleNumber(config, x)}</text>}
        </g>
      ))}
    </g>
  )
}

function BalanceCard({ config, state, setState, marked, reduced, locked }: Props & { config: BalanceConfig }) {
  const now = marked === 'shown' ? momentsMachinesEngine.solve(config) : state
  const svgRef = useRef<SVGSVGElement>(null)
  const marks = freeMarks(config)
  const at = readAt(config, now)
  const discs = readDiscs(config, now)
  const unit = discUnit(config)
  const step = config.unit === 'm' ? 1 : 10
  const moving = config.move === 'pivot'
  const p = moving ? at : fixedPivot(config)
  const px = CX + p * MARK
  const tilt = tiltOf(config, now)
  const lean = leanOf(config, now)
  const active = !locked
  const ease = reduced ? undefined : 'transform 900ms ease'
  const slides = active && (config.move === 'weight' || config.move === 'both')
  const standSlides = active && moving
  const index = marks.indexOf(at)

  const setAt = (x: number) => { if (active && x !== at && marks.includes(x)) setState({ ...state, at: x, discs }) }
  const setDiscs = (d: number) => { if (active) setState({ ...state, at, discs: clamp(d, 1, 12) }) }
  const nearest = (x: number) => setAt(marks.reduce((best, m) => (Math.abs(CX + m * MARK - x) < Math.abs(CX + best * MARK - x) ? m : best), at))
  const drag = useSlide(svgRef, active, nearest)
  const stepTo = (by: number) => { const next = marks[index + by]; if (next !== undefined) setAt(next) }
  // On the slider, the arrows point where the thing goes.
  const onKey = arrowKeys((by) => {
    const sorted = [...marks].sort((a, b) => a - b)
    const next = sorted[sorted.indexOf(at) + by]
    if (next !== undefined) setAt(next)
  })

  const fixed = config.loads.map((l) => ({ x: markOfLoad(config, l), discs: clamp(Math.round(l.force / unit), 1, 12), text: `${l.force} N`, brass: false }))
  const mine = moving ? [] : [{ x: at, discs, text: `${discs * unit} N`, brass: true }]
  const stacks = [...fixed, ...mine].sort((a, b) => a.x - b.x)
  const ys = stackLabels(stacks)
  const distance = Math.abs(at - p) * step
  const pivotText = moving ? clamp(px, 34, W - 34) : px
  const brassSide = !moving && at > p ? 1 : -1
  const pivotAnchor = moving ? 'middle' : brassSide > 0 ? 'end' : 'start'
  const pivotX = moving ? pivotText : px - brassSide * 12
  const facing = lean === 'level' ? 'The rule sits level.' : `The rule tips ${lean}.`
  const said = marked === 'right' || marked === 'shown' ? working(config, now) : marked === 'wrong' ? madeText(config, now) : ''
  const describe = `A wooden rule on a stand, marked in ${config.unit}, with ${config.loads.map((l) => `${l.force} newtons at ${l.at}`).join(' and ')}${moving ? '' : `, and a brass stack of ${discs * unit} newtons ${distance} ${config.unit} from the pivot`}. ${facing}`
  const caption = `${isAbsolute(config) ? `Marks are ${config.unit} along the rule` : `Marks are ${config.unit} from the pivot`}. Each disc is ${unit} N.${config.beam ? ` The arrow is the rule's own weight.` : ''}`

  return (
    <div className={`nodrag flex w-full max-w-[380px] flex-col gap-2 ${WITH_KEYS}`} onKeyDown={(e) => { if (e.key.startsWith('Arrow')) e.stopPropagation() }}>
      <figure className="m-0 flex w-full flex-col gap-1.5">
        <Plate
          h={BAL_H} label={describe} svgRef={svgRef}
          base={<g><rect x={0} y={FLOOR} width={W} height={BAL_H - FLOOR} fill={GROUND} /><line x1={0} x2={W} y1={FLOOR} y2={FLOOR} stroke={GROUND_EDGE} strokeWidth={1.5} /></g>}
        >
          {/* Level, for the eye to read the lean against. */}
          <line x1={8} x2={W - 8} y1={BY} y2={BY} stroke={HAIR} strokeWidth={1.5} strokeDasharray="3 5" data-level />
          <Stand x={px} reduced={reduced} />
          <g data-tilt={f1(tilt)} style={{ transform: `translate(${px}px, ${BY}px) rotate(${f1(tilt)}deg) translate(${-px}px, ${-BY}px)`, transition: ease }}>
            {stacks.map((s, i) => {
              const body = (
                <g style={{ transform: `translate(${CX + s.x * MARK}px, ${BY}px) rotate(${f1(-tilt)}deg)`, transition: ease }}>
                  <Stack discs={s.discs} brass={s.brass} label={s.text} labelY={ys[i]} />
                </g>
              )
              return s.brass && slides
                ? <g key="mine" {...drag} className="cursor-grab touch-none active:cursor-grabbing">{body}</g>
                : <g key={s.brass ? 'mine' : s.x}>{body}</g>
            })}
            <Plank config={config} skip={moving ? undefined : at} />
            {config.beam && (
              <g style={{ transform: `translate(${CX}px, ${BY}px) rotate(${f1(-tilt)}deg)`, transition: ease }} data-own-weight>
                <line x1={0} y1={PLANK_H / 2 + 1} x2={0} y2={PLANK_H / 2 + 26} stroke="#2F6DA8" strokeWidth={2.4} />
                <path d={`M -5 ${PLANK_H / 2 + 24} L 0 ${PLANK_H / 2 + 33} L 5 ${PLANK_H / 2 + 24} Z`} fill="#2F6DA8" />
                <text x={0} y={PLANK_H / 2 + 47} textAnchor="middle" fontSize={12} fontWeight={700} fill="#1F4F7D" stroke={PLATE} strokeWidth={3} paintOrder="stroke" strokeLinejoin="round">{config.beam} N</text>
              </g>
            )}
            {!moving && (
              <g style={{ transform: `translate(${CX + at * MARK}px, ${BY}px)`, transition: ease }} data-brass-at={at}>
                <rect x={-13} y={-PLANK_H / 2 - 2} width={26} height={PLANK_H + 4} rx={3} fill={BRASS} stroke={BRASS_EDGE} strokeWidth={1.4} />
                <text x={0} y={5.5} textAnchor="middle" fontSize={12} fontWeight={800} fill={INK}>{ruleNumber(config, at)}</text>
                {slides && (
                  <g
                    role="slider" tabIndex={0} aria-label="Slide the brass stack along the rule" aria-valuemin={0} aria-valuemax={100}
                    aria-valuenow={distance} aria-valuetext={`${distance} ${config.unit} from the pivot`} aria-orientation="horizontal"
                    className={SLIDER} {...drag} onKeyDown={onKey}
                  >
                    <rect x={-22} y={-38} width={44} height={62} fill="transparent" />
                    <g transform="translate(0 -24)"><Ring /></g>
                    <Grip x={0} y={-24} />
                  </g>
                )}
              </g>
            )}
          </g>
          <g style={{ transform: `translate(${px}px, ${BY}px)`, transition: ease }} data-pin>
            <circle r={5.5} fill={STEEL_LIGHT} stroke={STEEL_EDGE} strokeWidth={1.5} />
            <circle r={1.8} fill={STEEL_EDGE} />
          </g>
          <g style={{ transform: `translate(${f1(pivotX)}px, ${BY - 28}px)`, transition: ease }}>
            <text textAnchor={pivotAnchor} fontSize={12} fontWeight={700} fill={SOFT} stroke={PLATE} strokeWidth={3} paintOrder="stroke" strokeLinejoin="round" data-pivot-label={f1(pivotX)}>pivot</text>
          </g>
          {standSlides && (
            <g
              role="slider" tabIndex={0} aria-label="Slide the stand along the bench" aria-valuemin={1} aria-valuemax={9} aria-valuenow={at + 5}
              aria-valuetext={`${(at + 5) * step} ${config.unit} along the rule`} aria-orientation="horizontal"
              className={SLIDER} {...drag} onKeyDown={onKey} style={{ transform: `translate(${px}px, ${FLOOR - 19}px)`, transition: ease }}
            >
              <rect x={-26} y={-16} width={52} height={32} fill="transparent" />
              <Ring />
              <Grip x={0} y={0} />
            </g>
          )}
        </Plate>
        <figcaption className="text-center text-[12px] font-bold leading-snug text-ss-slate">{caption}</figcaption>
      </figure>
      <div className="flex flex-col gap-1.5">
        {moving && (
          <Stepper
            name="Stand on the rule" value={`${(at + 5) * step} ${config.unit}`} less="Move the stand left" more="Move the stand right" glyphs={['‹', '›']}
            canLess={active && index > 0} canMore={active && index < marks.length - 1} onLess={() => stepTo(-1)} onMore={() => stepTo(1)}
          />
        )}
        {(config.move === 'weight' || config.move === 'both') && (
          <Stepper
            name="Brass stack from the pivot" value={`${distance} ${config.unit}`} less="Move the brass stack towards the pivot" more="Move the brass stack away from the pivot"
            canLess={active && index > 0} canMore={active && index < marks.length - 1} onLess={() => stepTo(-1)} onMore={() => stepTo(1)}
          />
        )}
        {(config.move === 'discs' || config.move === 'both') && (
          <Stepper
            name="Brass discs" value={String(discs)} less="Take a disc off the brass stack" more="Add a disc to the brass stack"
            canLess={active && discs > 1} canMore={active && discs < 12} onLess={() => setDiscs(discs - 1)} onMore={() => setDiscs(discs + 1)}
          />
        )}
      </div>
      <KeyHelp text="The left and right arrows slide it along." />
      <span className="sr-only" aria-live="polite">{facing}</span>
      <Verdict text={said} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// The crowbar and the rock.

export const LEV_H = 236
export const LEV_FLOOR = 198
export const TOE_X = 66
export const LEV_PART = 26
export const LEV_LEN = LEV_PART * 10
export const WEDGE = 18
/** How high the grip stays off the ground when the bar is pushed right down. */
const CLEAR = 7

export const fulcrumX = (p: number) => TOE_X + p * LEV_PART

/** Where the bar sits: tipped back on the rock, or pushed down, with how high that leaves the toe. Vertical travels are in the bar's own proportion. */
export function barPose(p: number, lifted: boolean) {
  const near = p * LEV_PART
  const far = LEV_LEN - near
  const rest = Math.asin(clamp(WEDGE / near, 0, 0.95))
  const down = -Math.atan((WEDGE - CLEAR) / far)
  const angle = lifted ? down : rest
  const fy = LEV_FLOOR - WEDGE - 3
  const fx = fulcrumX(p)
  const end = { x: fx + far * Math.cos(angle), y: fy - far * Math.sin(angle) }
  const toe = { x: fx - near * Math.cos(angle), y: fy + near * Math.sin(angle) }
  const restEnd = { x: fx + far * Math.cos(rest), y: fy - far * Math.sin(rest) }
  const restToe = { x: fx - near * Math.cos(rest), y: fy + near * Math.sin(rest) }
  return { angle: (angle * 180) / Math.PI, fx, fy, near, far, end, toe, restEnd, restToe, rise: lifted ? Math.max(0, restToe.y - toe.y) : 0 }
}

const ROCK_SHAPE = `M 12 ${LEV_FLOOR} L 5 ${LEV_FLOOR - 30} L 16 ${LEV_FLOOR - 62} L 44 ${LEV_FLOOR - 78} L 72 ${LEV_FLOOR - 62} L 84 ${LEV_FLOOR - 28} L 78 ${LEV_FLOOR} Z`

function Rock({ rise, text, reduced }: { rise: number; text: string; reduced: boolean }) {
  return (
    <g style={{ transform: `translate(0px, ${f1(-rise)}px)`, transition: reduced ? undefined : 'transform 900ms ease' }} data-rise={f1(rise)}>
      <path d={ROCK_SHAPE} fill={ROCK} stroke={ROCK_EDGE} strokeWidth={1.6} strokeLinejoin="round" />
      <path d={`M 16 ${LEV_FLOOR - 62} L 44 ${LEV_FLOOR - 78} L 72 ${LEV_FLOOR - 62} L 52 ${LEV_FLOOR - 50} L 26 ${LEV_FLOOR - 50} Z`} fill={ROCK_LIGHT} />
      <path d={`M 72 ${LEV_FLOOR - 62} L 84 ${LEV_FLOOR - 28} L 78 ${LEV_FLOOR} L 68 ${LEV_FLOOR} L 66 ${LEV_FLOOR - 40} Z`} fill={ROCK_DARK} />
      <text x={38} y={LEV_FLOOR - 19} textAnchor="middle" fontSize={13} fontWeight={800} fill={INK}>{text}</text>
    </g>
  )
}

/** Beside its arrow: inside the wedge between the old bar and the new when that is open, otherwise above them both. */
export function pushLabel(pose: ReturnType<typeof barPose>, lifted: boolean, arrowX: number) {
  if (lifted && pose.end.y - pose.restEnd.y >= 40) return { x: Math.min(pose.restEnd.x, pose.end.x) - 10, y: pose.end.y - 18 }
  const top = lifted ? Math.min(pose.restEnd.y, pose.end.y - 28) : pose.end.y - 28
  return { x: arrowX + 7, y: Math.max(16, top - 7) }
}

function LeverCard({ config, state, setState, marked, reduced, locked }: Props & { config: LeverConfig }) {
  const now = marked === 'shown' ? momentsMachinesEngine.solve(config) : state
  const svgRef = useRef<SVGSVGElement>(null)
  const p = readFulcrum(config, now)
  const lifted = leverHolds(config, p)
  const pose = barPose(p, lifted)
  const active = !locked
  const ease = reduced ? undefined : 'transform 900ms ease'
  const setAt = (next: number) => { if (active && next >= 1 && next <= 9 && next !== p) setState({ ...state, at: next }) }
  const drag = useSlide(svgRef, active, (x) => setAt(clamp(Math.round((x - TOE_X) / LEV_PART), 1, 9)))
  const onKey = arrowKeys((by) => setAt(p + by))
  const said = marked === 'right' || marked === 'shown' ? working(config, now) : marked === 'wrong' ? madeText(config, now) : ''
  const facing = lifted ? 'The rock has lifted off the ground.' : 'The rock stays on the ground.'
  const textRight = pose.fx > 250
  const arrowX = Math.min(W - 16, pose.end.x + 14)
  const push = pushLabel(pose, lifted, arrowX)
  const near = pose.near
  const far = pose.far
  // The hand's journey: the arc the grip sweeps from where the bar began.
  const arc = lifted ? `M ${f1(pose.restEnd.x)} ${f1(pose.restEnd.y)} A ${f1(far)} ${f1(far)} 0 0 1 ${f1(pose.end.x)} ${f1(pose.end.y)}` : ''
  return (
    <div className={`nodrag flex w-full max-w-[380px] flex-col gap-2 ${WITH_KEYS}`} onKeyDown={(e) => { if (e.key.startsWith('Arrow')) e.stopPropagation() }}>
      <figure className="m-0 flex w-full flex-col gap-1.5">
        <Plate
          h={LEV_H} svgRef={svgRef} label={`A steel bar with its toe under a ${config.load} newton rock, resting on a wooden fulcrum ${p * 10} centimetres from the rock. Your push is ${config.push} newtons on the far end. ${facing}`}
          base={(
            <g>
              <rect x={0} y={LEV_FLOOR} width={W} height={LEV_H - LEV_FLOOR} fill={GROUND} />
              <line x1={0} x2={W} y1={LEV_FLOOR} y2={LEV_FLOOR} stroke={GROUND_EDGE} strokeWidth={1.5} />
            </g>
          )}
        >
          {lifted && (
            <g data-ghost>
              <path d={ROCK_SHAPE} fill="none" stroke={GROUND_EDGE} strokeWidth={1.4} strokeDasharray="4 4" />
              <line x1={f1(pose.restToe.x)} y1={f1(pose.restToe.y)} x2={f1(pose.restEnd.x)} y2={f1(pose.restEnd.y)} stroke={GROUND_EDGE} strokeWidth={2} strokeDasharray="5 5" />
              <path d={arc} fill="none" stroke={SOFT} strokeWidth={1.6} strokeDasharray="2 4" strokeLinecap="round" data-hand-arc />
            </g>
          )}
          {/* The bar, first, so the rock sits on its toe. */}
          <g style={{ transform: `translate(${f1(pose.fx)}px, ${pose.fy}px) rotate(${f1(-pose.angle)}deg)`, transition: ease }} data-bar={f1(pose.angle)}>
            <path d={`M ${-near - 6} 5 Q ${-near - 2} 1 ${-near + 8} -3.5 H ${far - 30} V 3.5 H ${-near + 8} Q ${-near + 2} 5 ${-near - 2} 6 Z`} fill={STEEL} stroke={STEEL_EDGE} strokeWidth={1.4} strokeLinejoin="round" />
            <line x1={-near + 10} x2={far - 32} y1={-1.5} y2={-1.5} stroke={STEEL_LIGHT} strokeWidth={1.2} />
            {Array.from({ length: 9 }, (_, k) => k + 1).map((k) => <line key={k} x1={-near + k * LEV_PART} x2={-near + k * LEV_PART} y1={-3.5} y2={3.5} stroke={STEEL_EDGE} strokeWidth={1} />)}
            <rect x={far - 32} y={-5.5} width={32} height={11} rx={3} fill={RUBBER} />
            {[-26, -20, -14, -8].map((d) => <line key={d} x1={far + d} x2={far + d} y1={-5} y2={5} stroke={IRON_LIGHT} strokeWidth={1} />)}
          </g>
          <Rock rise={pose.rise} text={`${config.load} N`} reduced={reduced} />
          {/* The fulcrum: a wooden block with a ridge along its top. */}
          <g style={{ transform: `translate(${f1(pose.fx)}px, ${LEV_FLOOR}px)`, transition: ease }} data-fulcrum={p}>
            <path d={`M -16 0 L -3 ${-WEDGE + 1} Q 0 ${-WEDGE - 1} 3 ${-WEDGE + 1} L 16 0 Z`} fill={WOOD} stroke={WOOD_EDGE} strokeWidth={1.5} strokeLinejoin="round" />
            <path d={`M -9 -3 L -2 ${-WEDGE + 4} M 2 -3 L 4 ${-WEDGE + 6}`} stroke={WOOD_GRAIN} strokeWidth={1.1} strokeLinecap="round" />
          </g>
          {/* Your push: a fixed arrow, the same however the bar moves. */}
          <g style={{ transform: `translate(${f1(arrowX)}px, ${f1(pose.end.y)}px)`, transition: ease }} data-push>
            <line x1={0} y1={-28} x2={0} y2={-4} stroke={BRASS_EDGE} strokeWidth={3} strokeLinecap="round" />
            <path d="M -6 -9 L 0 2 L 6 -9 Z" fill={BRASS} stroke={BRASS_EDGE} strokeWidth={1.4} strokeLinejoin="round" />
          </g>
          <text x={f1(push.x)} y={f1(push.y)} textAnchor="end" fontSize={12} fontWeight={700} fill={BRASS_INK} data-push-label>your push</text>
          {active && (
            <g
              role="slider" tabIndex={0} aria-label="Slide the fulcrum along the ground" aria-valuemin={10} aria-valuemax={90} aria-valuenow={p * 10}
              aria-valuetext={`${p * 10} centimetres from the rock`} aria-orientation="horizontal"
              className={SLIDER} {...drag} onKeyDown={onKey} style={{ transform: `translate(${f1(pose.fx)}px, ${LEV_FLOOR + 19}px)`, transition: ease }}
            >
              <rect x={-26} y={-36} width={52} height={54} fill="transparent" />
              <Ring />
              <Grip x={0} y={0} />
            </g>
          )}
          <g style={{ transform: `translate(${f1(pose.fx + (!active ? 0 : textRight ? -26 : 26))}px, ${LEV_FLOOR + 23}px)`, transition: ease }}>
            <text textAnchor={!active ? 'middle' : textRight ? 'end' : 'start'} fontSize={12} fontWeight={700} fill={SOFT} data-fulcrum-label>fulcrum</text>
          </g>
        </Plate>
        <figcaption className="text-center text-[12px] font-bold leading-snug text-ss-slate">
          {lifted ? 'The dashes show where the bar and the rock began.' : 'The bar rests on the rock until your push is enough.'}
        </figcaption>
      </figure>
      <div className="flex flex-col gap-1.5">
        <Meter name="Push needed" share={pushNeeded(config, p) / (config.push * 3)} limit={1 / 3} limitName={`your push ${config.push} N`} reduced={reduced} />
        <Stepper
          name="Fulcrum from the rock" value={`${p * 10} cm`} less="Move the fulcrum towards the rock" more="Move the fulcrum away from the rock"
          canLess={active && p > 1} canMore={active && p < 9} onLess={() => setAt(p - 1)} onMore={() => setAt(p + 1)}
        />
      </div>
      <KeyHelp text="The left and right arrows slide the fulcrum along." />
      <span className="sr-only" aria-live="polite">{facing}</span>
      <Verdict text={said} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// The block and tackle.

export const PUL_H = 288
export const PUL_FLOOR = 256
export const CRATE_X = 128
export const CRATE_W = 64
export const CRATE_H = 50
export const SPACE = 22
export const TOP_Y = 46
export const PX_PER_M = 30
export const GRIP = { x: 284, y: 156 }

/** Where each straight run of rope is, and which wheels it goes round. The strands are numbered from the anchor; the last line is the one in the hand. */
export function pulleyLayout(strands: number) {
  const x0 = CRATE_X - ((strands - 1) * SPACE) / 2
  const lines = Array.from({ length: strands + 1 }, (_, i) => x0 + i * SPACE)
  const top: number[] = []
  const bottom: number[] = []
  // Working back from the hand: over a fixed wheel, under a moving one, and so on.
  for (let i = strands - 1, up = true; i >= 0; i--, up = !up) (up ? top : bottom).push(x0 + i * SPACE + SPACE / 2)
  return { lines, top: top.sort((a, b) => a - b), bottom: bottom.sort((a, b) => a - b), fromTop: strands % 2 === 0 }
}

/** The moving block's wheels sit this high, for a crate raised `rise` px. */
export const hubY = (rise: number) => PUL_FLOOR - CRATE_H - rise - 30
const crateTop = (rise: number) => PUL_FLOOR - CRATE_H - rise

export function ropePath(strands: number, rise: number): string {
  const { lines, fromTop } = pulleyLayout(strands)
  const r = SPACE / 2
  const low = hubY(rise)
  const parts: string[] = []
  const startY = fromTop ? 22 : strands === 1 ? crateTop(rise) - 8 : low + 10
  parts.push(`M ${lines[0]} ${f1(startY)}`)
  for (let i = 0; i < strands; i++) {
    const overTop = (strands - 1 - i) % 2 === 0
    const y = overTop ? TOP_Y : low
    parts.push(`L ${lines[i]} ${f1(y)}`)
    if (i === strands - 1) {
      // Round the last fixed wheel, leaving it on a tangent to the hand.
      const cx = lines[i] + r
      const dx = GRIP.x - cx
      const dy = GRIP.y - TOP_Y
      const a = Math.atan2(dy, dx) - Math.acos(r / Math.hypot(dx, dy))
      const tx = cx + r * Math.cos(a)
      const ty = TOP_Y + r * Math.sin(a)
      parts.push(`A ${r} ${r} 0 0 1 ${f1(tx)} ${f1(ty)}`, `L ${GRIP.x} ${GRIP.y}`)
    } else parts.push(`A ${r} ${r} 0 0 ${overTop ? 1 : 0} ${lines[i + 1]} ${f1(y)}`)
  }
  return parts.join(' ')
}

function Rope({ d, w = 4.4 }: { d: string; w?: number }) {
  return (
    <g fill="none" strokeLinejoin="round">
      <path d={d} stroke={ROPE_EDGE} strokeWidth={w + 2} strokeLinecap="round" />
      <path d={d} stroke={ROPE} strokeWidth={w} strokeLinecap="round" />
      <path d={d} stroke={ROPE_TWIST} strokeWidth={1.3} strokeDasharray="2.6 3.6" />
    </g>
  )
}

function Wheel({ x, y }: { x: number; y: number }) {
  const r = SPACE / 2
  return (
    <g data-wheel>
      <circle cx={x} cy={y} r={r} fill={STEEL} stroke={STEEL_EDGE} strokeWidth={1.3} />
      <circle cx={x} cy={y} r={r - 4} fill={STEEL_LIGHT} stroke={STEEL_EDGE} strokeWidth={0.8} />
      <circle cx={x} cy={y} r={2.2} fill={IRON_EDGE} />
    </g>
  )
}

function Crate({ top, text, reduced, x = CRATE_X }: { top: number; text: string; reduced: boolean; x?: number }) {
  const l = x - CRATE_W / 2
  return (
    <g style={{ transform: `translate(0px, ${f1(top)}px)`, transition: reduced ? undefined : 'transform 600ms ease' }} data-crate={f1(top)}>
      <circle cx={x} cy={-5} r={5} fill="none" stroke={STEEL_EDGE} strokeWidth={2.2} />
      <rect x={l} y={0} width={CRATE_W} height={CRATE_H} rx={2} fill={WOOD} stroke={WOOD_EDGE} strokeWidth={1.6} />
      <path d={`M ${l + 1} 16 H ${l + CRATE_W - 1} M ${l + 1} 33 H ${l + CRATE_W - 1}`} stroke={WOOD_GRAIN} strokeWidth={1.2} />
      <rect x={l} y={0} width={7} height={CRATE_H} fill={WOOD_DARK} stroke={WOOD_EDGE} strokeWidth={1} />
      <rect x={l + CRATE_W - 7} y={0} width={7} height={CRATE_H} fill={WOOD_DARK} stroke={WOOD_EDGE} strokeWidth={1} />
      <text x={x} y={30} textAnchor="middle" fontSize={13} fontWeight={800} fill={WOOD_INK} stroke={WOOD} strokeWidth={3} paintOrder="stroke" strokeLinejoin="round">{text}</text>
    </g>
  )
}

/** The rope you have hauled, in a coil on the ground: one ring for each metre, so more strands visibly cost more rope. */
function Coil({ metres }: { metres: number }) {
  return (
    <g data-coil={metres}>
      {Array.from({ length: Math.max(1, metres) }, (_, k) => (
        <g key={k}>
          <ellipse cx={GRIP.x} cy={PUL_FLOOR - 3 - k * 4.5} rx={20} ry={5.5} fill="none" stroke={ROPE_EDGE} strokeWidth={4.4} />
          <ellipse cx={GRIP.x} cy={PUL_FLOOR - 3 - k * 4.5} rx={20} ry={5.5} fill="none" stroke={ROPE} strokeWidth={2.6} />
        </g>
      ))}
    </g>
  )
}

function PulleyCard({ config, state, setState, marked, reduced, locked }: Props & { config: PulleyConfig }) {
  const now = marked === 'shown' ? momentsMachinesEngine.solve(config) : state
  const strands = readStrands(now)
  const pulled = readPulled(config, now)
  const rise = (pulled / strands) * PX_PER_M
  const can = canPull(config, strands)
  const active = !locked
  const { lines, top, bottom, fromTop } = pulleyLayout(strands)
  const low = hubY(rise)
  const shelfY = PUL_FLOOR - config.height * PX_PER_M
  const cap = strands * config.height
  const setStrands = (n: number) => { if (active) setState({ ...state, strands: clamp(n, 1, 6), pulled: 0 }) }
  const setPulled = (m: number) => { if (active && can) setState({ ...state, strands, pulled: clamp(m, 0, cap) }) }
  const said = marked === 'right' || marked === 'shown' ? working(config, now) : marked === 'wrong' ? madeText(config, now) : ''
  const coil = PUL_FLOOR - 3 - Math.max(0, pulled - 1) * 4.5
  const facing = can
    ? `${strands === 1 ? 'One strand holds' : `${strands} strands hold`} the crate. The crate has risen ${Number((pulled / strands).toFixed(2))} metres, with ${pulled} metres of rope pulled.`
    : `${strands === 1 ? 'One strand holds' : `${strands} strands hold`} the crate. It will not move: the pull needed is more than you have.`
  const mids = (TOP_Y + low) / 2
  const dir = { x: GRIP.x - (lines[strands] + SPACE / 2), y: GRIP.y - TOP_Y }
  const dirLen = Math.hypot(dir.x, dir.y) || 1
  const ux = dir.x / dirLen
  const uy = dir.y / dirLen

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-2">
      <figure className="m-0 flex w-full flex-col gap-1.5">
        <Plate
          h={PUL_H} label={`A block and tackle under a beam lifts a ${config.load} newton crate towards a shelf ${config.height} metres up. ${facing}`}
          base={(
            <g>
              <rect x={0} y={PUL_FLOOR} width={W} height={PUL_H - PUL_FLOOR} fill={GROUND} />
              <line x1={0} x2={W} y1={PUL_FLOOR} y2={PUL_FLOOR} stroke={GROUND_EDGE} strokeWidth={1.5} />
              {/* The overhead beam. */}
              <rect x={0} y={8} width={W} height={4} fill={IRON} />
              <rect x={0} y={12} width={W} height={7} fill={IRON_LIGHT} />
              <rect x={0} y={19} width={W} height={4} fill={IRON} />
            </g>
          )}
        >
          {/* A post with its marks, and the shelf on it. */}
          <rect x={14} y={shelfY + 7} width={8} height={PUL_FLOOR - shelfY - 7} fill={WOOD_DARK} stroke={WOOD_EDGE} strokeWidth={1.2} />
          {[1, 2, 3].filter((m) => m < config.height).map((m) => <line key={m} x1={14} x2={22} y1={PUL_FLOOR - m * PX_PER_M} y2={PUL_FLOOR - m * PX_PER_M} stroke={WOOD_INK} strokeWidth={1.2} />)}
          <rect x={10} y={shelfY} width={CRATE_X - CRATE_W / 2 - 12} height={7} rx={1.5} fill={WOOD} stroke={WOOD_EDGE} strokeWidth={1.4} data-shelf={config.height} />
          <text x={12} y={shelfY - 6} fontSize={12} fontWeight={700} fill={SOFT} stroke={PLATE} strokeWidth={3} paintOrder="stroke" strokeLinejoin="round">shelf {config.height} m up</text>

          {/* The fixed wheels, hung from the beam. */}
          {top.map((x) => (
            <g key={x}>
              <rect x={x - 2.5} y={21} width={5} height={TOP_Y - 21} fill={STEEL} stroke={STEEL_EDGE} strokeWidth={1} />
              <Wheel x={x} y={TOP_Y} />
            </g>
          ))}
          {fromTop && <rect x={lines[0] - 3} y={21} width={6} height={7} rx={1} fill={STEEL_EDGE} data-anchor="beam" />}

          {/* The moving block: its wheels on a strap, with the hook below. */}
          {bottom.length > 0 && (
            <g data-block={f1(low)}>
              <rect x={Math.min(lines[0], ...bottom) - 3} y={low + 8} width={Math.max(...bottom) - Math.min(lines[0], ...bottom) + 6} height={5} rx={1.5} fill={STEEL} stroke={STEEL_EDGE} strokeWidth={1} />
              {bottom.map((x) => <rect key={x} x={x - 2} y={low} width={4} height={10} fill={STEEL_EDGE} />)}
              <line x1={CRATE_X} x2={CRATE_X} y1={low + 13} y2={crateTop(rise) - 8} stroke={STEEL_EDGE} strokeWidth={2.6} />
              {bottom.map((x) => <Wheel key={x} x={x} y={low} />)}
            </g>
          )}

          <Crate top={crateTop(rise)} text={`${config.load} N`} reduced={reduced} />

          <Rope d={ropePath(strands, rise)} />
          {/* The free end falls from the hand to the coil. */}
          <Rope d={`M ${GRIP.x} ${GRIP.y} V ${f1(coil - 6)}`} w={3.6} />
          <Coil metres={pulled} />

          {/* Each strand that holds the crate is numbered; the one in your hand is not. */}
          {lines.slice(0, strands).map((x, i) => (
            <text key={x} x={x} y={f1(mids + 4)} textAnchor="middle" fontSize={13} fontWeight={800} fill={INK} stroke={PLATE} strokeWidth={4} paintOrder="stroke" strokeLinejoin="round" data-strand={i + 1}>{i + 1}</text>
          ))}

          {/* The handle in your hand, and your pull along the rope. */}
          <g transform={`translate(${GRIP.x} ${GRIP.y}) rotate(${f1((Math.atan2(uy, ux) * 180) / Math.PI + 90)})`}>
            <rect x={-13} y={-4} width={26} height={8} rx={3.5} fill={RUBBER} />
          </g>
          <g transform={`translate(${f1(GRIP.x + ux * 10)} ${f1(GRIP.y + uy * 10)})`} data-pull>
            <line x1={0} y1={0} x2={f1(ux * 22)} y2={f1(uy * 22)} stroke={BRASS_EDGE} strokeWidth={3} strokeLinecap="round" />
            <path d="M -9 -6 L 2 0 L -9 6 Z" transform={`translate(${f1(ux * 26)} ${f1(uy * 26)}) rotate(${f1((Math.atan2(uy, ux) * 180) / Math.PI)})`} fill={BRASS} stroke={BRASS_EDGE} strokeWidth={1.4} strokeLinejoin="round" />
          </g>
          <text x={W - 12} y={GRIP.y - 14} textAnchor="end" fontSize={12} fontWeight={700} fill={BRASS_INK} stroke={PLATE} strokeWidth={3} paintOrder="stroke" strokeLinejoin="round">your pull</text>
          <text x={GRIP.x} y={PUL_FLOOR + 20} textAnchor="middle" fontSize={12} fontWeight={700} fill={SOFT}>rope pulled</text>
        </Plate>
        <figcaption className="text-center text-[12px] font-bold leading-snug text-ss-slate">
          {can ? 'The numbered strands hold the crate. Yours does not.' : 'The crate will not move: that is more pull than you have.'}
        </figcaption>
      </figure>
      <div className="flex flex-col gap-1.5">
        <Meter name="Pull needed" share={pullNeeded(config, strands) / Math.max(config.load, config.pull)} limit={Math.min(1, config.pull / Math.max(config.load, config.pull))} limitName={`your pull ${config.pull} N`} reduced={reduced} />
        <Stepper
          name="Strands holding the crate" value={String(strands)} less="Take away a strand" more="Add a strand"
          canLess={active && strands > 1} canMore={active && strands < 6} onLess={() => setStrands(strands - 1)} onMore={() => setStrands(strands + 1)}
        />
        <Stepper
          name="Rope pulled" value={`${pulled} m`} less="Let a metre of rope back" more="Pull a metre of rope"
          canLess={active && pulled > 0} canMore={active && can && pulled < cap} onLess={() => setPulled(pulled - 1)} onMore={() => setPulled(pulled + 1)}
        />
      </div>
      <span className="sr-only" aria-live="polite">{facing}</span>
      <Verdict text={said} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// The gears.

export const GEAR_H = 222
export const GEAR_Y = 106
const MAX_MODULE = 3.7
const OUTPUT_MAX = 48
const IDLER = 12

/** The pixels of pitch circle diameter per tooth, set for the widest train this card can make, so stepping never rescales it. */
export const moduleOf = (handle: number) => Math.min(MAX_MODULE, (W - 40) / (handle + OUTPUT_MAX + IDLER + 3))

export type Gear = { key: string; teeth: number; x: number; r: number; turn: 1 | -1; kind: 'handle' | 'idler' | 'output' }

/** The train, along one line, with each pair's pitch circles touching. */
export function trainOf(handle: number, output: number, idler: boolean): Gear[] {
  const m = moduleOf(handle)
  const list: { key: string; teeth: number; kind: Gear['kind'] }[] = [{ key: 'handle', teeth: handle, kind: 'handle' }]
  if (idler) list.push({ key: 'idler', teeth: IDLER, kind: 'idler' })
  list.push({ key: 'output', teeth: output, kind: 'output' })
  const rs = list.map((g) => (g.teeth * m) / 2)
  const span = rs.reduce((n, r) => n + 2 * r, 0)
  let x = (W - span) / 2
  return list.map((g, i) => {
    const at = x + rs[i]
    x += 2 * rs[i]
    return { ...g, x: at, r: rs[i], turn: (i % 2 === 0 ? 1 : -1) as 1 | -1 }
  })
}

/**
 * How far each gear has turned when the handle has turned `deg`, so a tooth of one always sits in a gap of the next.
 * Each next gear's tooth at its own left point (180 degrees) is half a pitch out from the last gear's at its right (0 degrees).
 */
export function gearAngles(train: Gear[], deg: number): number[] {
  const out: number[] = []
  train.forEach((g, i) => {
    if (i === 0) out.push(deg)
    else {
      const prev = train[i - 1]
      out.push(180 + 180 / g.teeth - (out[i - 1] * prev.teeth) / g.teeth)
    }
  })
  return out
}

export function gearPath(teeth: number, m: number): string {
  const r = (teeth * m) / 2
  const tip = r + 0.9 * m
  const root = r - 1.1 * m
  const pitch = (2 * Math.PI) / teeth
  const pt = (rr: number, a: number) => `${f1(rr * Math.cos(a))} ${f1(rr * Math.sin(a))}`
  const parts: string[] = []
  for (let k = 0; k < teeth; k++) {
    const a = k * pitch
    parts.push(`${k ? 'L' : 'M'} ${pt(root, a - 0.33 * pitch)}`, `L ${pt(tip, a - 0.135 * pitch)}`, `L ${pt(tip, a + 0.135 * pitch)}`, `L ${pt(root, a + 0.33 * pitch)}`, `A ${f1(root)} ${f1(root)} 0 0 1 ${pt(root, a + 0.67 * pitch)}`)
  }
  return `${parts.join(' ')} Z`
}

function GearWheel({ gear, angle, markAt, m }: { gear: Gear; angle: number; markAt: number; m: number }) {
  const { r, teeth, kind } = gear
  const face = kind === 'output' ? BRASS : kind === 'idler' ? STEEL_LIGHT : STEEL
  const edge = kind === 'output' ? BRASS_EDGE : STEEL_EDGE
  const web = kind === 'output' ? BRASS_LIGHT : '#E9EEF4'
  const holes = r > 34 ? 6 : r > 24 ? 4 : 0
  const hub = Math.max(4.5, r * 0.2)
  return (
    <g transform={`translate(${f1(gear.x)} ${GEAR_Y})`} data-gear={kind} data-teeth={teeth}>
      <g transform={`rotate(${f1(angle)})`} data-angle={f1(angle)}>
        <path d={gearPath(teeth, m)} fill={face} stroke={edge} strokeWidth={1.4} strokeLinejoin="round" />
        {r > 16 && <circle r={r - 1.9 * m} fill={web} stroke={edge} strokeWidth={1} />}
        {Array.from({ length: holes }, (_, k) => {
          const a = (k * 2 * Math.PI) / holes + Math.PI / holes
          return <circle key={k} cx={f1(r * 0.48 * Math.cos(a))} cy={f1(r * 0.48 * Math.sin(a))} r={f1(r * 0.13)} fill={PLATE} stroke={edge} strokeWidth={1} />
        })}
        <circle r={hub} fill={edge} />
        <circle r={Math.max(1.6, hub * 0.4)} fill={PLATE} />
        {/* The painted mark, on a tooth, for counting the turns. */}
        {kind !== 'handle' && <circle cx={f1(r - 0.3 * m)} cy={0} r={3.4} fill="#B91C1C" stroke={PLATE} strokeWidth={1.2} transform={`rotate(${f1(markAt)})`} data-mark />}
      </g>
    </g>
  )
}

/** Which way a gear goes: a small arc above it, with its head on the way it is going. */
function Sense({ gear, m, way }: { gear: Gear; m: number; way: 1 | -1 }) {
  const rr = gear.r + 0.9 * m + 6
  const a1 = rad(-125)
  const a2 = rad(-55)
  const [from, to] = way > 0 ? [a1, a2] : [a2, a1]
  const p = (a: number) => ({ x: gear.x + rr * Math.cos(a), y: GEAR_Y + rr * Math.sin(a) })
  const s = p(from)
  const e = p(to)
  const tangent = (to + (way > 0 ? Math.PI / 2 : -Math.PI / 2)) * (180 / Math.PI)
  return (
    <g data-sense={way > 0 ? 'clockwise' : 'anticlockwise'} data-sense-of={gear.kind}>
      <path d={`M ${f1(s.x)} ${f1(s.y)} A ${f1(rr)} ${f1(rr)} 0 0 ${way > 0 ? 1 : 0} ${f1(e.x)} ${f1(e.y)}`} fill="none" stroke={SOFT} strokeWidth={2} strokeLinecap="round" />
      <path d="M -7 -4.5 L 1 0 L -7 4.5 Z" transform={`translate(${f1(e.x)} ${f1(e.y)}) rotate(${f1(tangent)})`} fill={SOFT} />
    </g>
  )
}

const turnsNow = (n: number) => (Math.abs(n - Math.round(n)) < 0.05 ? String(Math.round(n)) : n.toFixed(1))

function GearsCard({ config, state, setState, marked, reduced, locked }: Props & { config: GearsConfig }) {
  const now = marked === 'shown' ? momentsMachinesEngine.solve(config) : state
  const svgRef = useRef<SVGSVGElement>(null)
  const output = readTeeth(config, now)
  const idler = readIdler(now)
  const setup = `${output}-${idler ? 1 : 0}`
  // How far the handle has been turned belongs to the card, not the answer: a new train starts from nothing.
  const [crank, setCrank] = useState({ setup, deg: 0, way: 1 as 1 | -1 })
  const deg = crank.setup === setup ? crank.deg : 0
  const way = crank.way
  const glide = useRef<{ raf: number; to: number } | null>(null)
  const stopGlide = () => {
    if (glide.current) cancelAnimationFrame(glide.current.raf)
    glide.current = null
  }
  useEffect(() => () => { if (glide.current) cancelAnimationFrame(glide.current.raf) }, [])
  const m = moduleOf(config.teeth)
  const train = trainOf(config.teeth, output, idler)
  const angles = gearAngles(train, deg)
  const starts = gearAngles(train, 0)
  const handle = train[0]
  const outputTurns = (Math.abs(deg) / 360) * gearTurns(config, output)
  const active = !locked
  const armLen = Math.max(handle.r * 0.68, 22)
  const held = useRef<number | null>(null)

  const turnBy = (by: number) => setCrank({ setup, deg: deg + by, way: by >= 0 ? 1 : -1 })
  /** One whole turn of the handle, at walking pace: about three seconds, easing in and out. */
  const turnOnce = () => {
    if (reduced) { turnBy(360); return }
    const from = deg
    const to = (glide.current?.to ?? deg) + 360
    stopGlide()
    const begun = performance.now()
    const long = ((to - from) / 360) * 3000
    const run = { raf: 0, to }
    const frame = (t: number) => {
      const k = clamp((t - begun) / long, 0, 1)
      const eased = k < 0.5 ? 2 * k * k : 1 - ((2 - 2 * k) * (2 - 2 * k)) / 2
      setCrank({ setup, deg: from + (to - from) * eased, way: 1 })
      if (k < 1) run.raf = requestAnimationFrame(frame)
      else glide.current = null
    }
    run.raf = requestAnimationFrame(frame)
    glide.current = run
  }
  const angleAt = (e: PointerEvent) => {
    const box = svgRef.current?.getBoundingClientRect()
    if (!box || box.width === 0) return null
    const k = W / box.width
    return Math.atan2((e.clientY - box.top) * k - GEAR_Y, (e.clientX - box.left) * k - handle.x) * (180 / Math.PI)
  }
  const onDown = (e: PointerEvent<SVGGElement>) => {
    stopGlide()
    held.current = angleAt(e)
    e.stopPropagation()
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const onMove = (e: PointerEvent<SVGGElement>) => {
    if (held.current === null) return
    const a = angleAt(e)
    if (a === null) return
    let d = a - held.current
    if (d > 180) d -= 360
    if (d < -180) d += 360
    held.current = a
    if (d !== 0) turnBy(d)
  }
  const onUp = () => { held.current = null }
  const onKey = arrowKeys((by) => { stopGlide(); turnBy(by * 30) })
  const setOutput = (t: number) => { if (active) { stopGlide(); setState({ ...state, teeth: t, idler }) } }
  const toggleIdler = () => { if (active) { stopGlide(); setState({ ...state, teeth: output, idler: !idler }) } }

  const list = [8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48]
  const index = list.indexOf(output)
  const relation = idler ? 'the same way as' : 'the opposite way to'
  const said = marked === 'right' || marked === 'shown' ? working(config, now) : marked === 'wrong' ? madeText(config, now) : ''
  const idlerGear = train.find((g) => g.kind === 'idler')
  // The arm starts pointing up, clear of the next gear.
  const knob = { x: handle.x + armLen * Math.cos(rad(deg - 90)), y: GEAR_Y + armLen * Math.sin(rad(deg - 90)) }
  const describe = `A handle turns a gear of ${config.teeth} teeth, which ${idler ? 'drives an idler gear and then' : 'drives'} a brass output gear of ${output} teeth. The output turns ${relation} the handle.`

  return (
    <div className={`nodrag flex w-full max-w-[380px] flex-col gap-2 ${WITH_KEYS}`} onKeyDown={(e) => { if (e.key.startsWith('Arrow')) e.stopPropagation() }}>
      <figure className="m-0 flex w-full flex-col gap-1.5">
        <Plate h={GEAR_H} svgRef={svgRef} label={describe}>
          {train.map((g, i) => <GearWheel key={g.key} gear={g} angle={angles[i]} markAt={-90 - starts[i]} m={m} />)}
          {train.map((g) => <Sense key={g.key} gear={g} m={m} way={(g.turn * way) as 1 | -1} />)}
          {/* The handle: an arm from the hub, with a wooden knob to hold. */}
          <g transform={`translate(${f1(handle.x)} ${GEAR_Y})`}>
            <g transform={`rotate(${f1(deg - 90)})`} data-handle={f1(deg)}>
              <rect x={-4} y={-4} width={armLen + 8} height={8} rx={4} fill={IRON} stroke={IRON_EDGE} strokeWidth={1} />
              <circle cx={armLen} cy={0} r={10} fill={WOOD_DARK} stroke={WOOD_EDGE} strokeWidth={1.8} />
              <circle cx={armLen} cy={0} r={4.5} fill={WOOD} stroke={WOOD_EDGE} strokeWidth={1} />
            </g>
          </g>
          <g
            role="slider" tabIndex={0} aria-label="Turn the handle" aria-valuemin={0} aria-valuemax={3600} aria-valuenow={f1(Math.min(3600, Math.abs(deg)))}
            aria-valuetext={`${turnsNow(Math.abs(deg) / 360)} turns of the handle`} aria-orientation="horizontal"
            className="cursor-grab touch-none outline-none active:cursor-grabbing [&:focus-visible_.mm-ring]:opacity-100"
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onKeyDown={onKey}
            transform={`translate(${f1(knob.x)} ${f1(knob.y)})`}
          >
            <circle r={20} fill="transparent" />
            <circle className="mm-ring opacity-0" r={14} fill="none" stroke="var(--subject, #0F766E)" strokeWidth={2.5} />
          </g>
          {idlerGear && <text x={f1(idlerGear.x)} y={f1(GEAR_Y - idlerGear.r - 0.9 * m - 14)} textAnchor="middle" fontSize={12} fontWeight={700} fill={SOFT} data-idler-label>idler</text>}
          <text x={14} y={GEAR_H - 12} fontSize={12} fontWeight={700} fill={SOFT} data-label="handle">handle gear, {config.teeth} teeth</text>
          <text x={W - 14} y={GEAR_H - 12} textAnchor="end" fontSize={12} fontWeight={700} fill={BRASS_INK} data-label="output">output gear, {output} teeth</text>
        </Plate>
        <figcaption className="text-center text-[12px] font-bold leading-snug text-ss-slate">Red marks count the turns. Arrows show which way each goes.</figcaption>
      </figure>
      <div className="flex flex-col gap-1.5">
        <Stepper
          name="Output gear" value={`${output} teeth`} less="Fewer teeth on the output gear" more="More teeth on the output gear"
          canLess={active && index > 0} canMore={active && index < list.length - 1} onLess={() => setOutput(list[index - 1])} onMore={() => setOutput(list[index + 1])}
        />
        <div className="flex items-center justify-between gap-1.5">
          <span className="text-[12px] font-bold text-ss-slate">Idler gear between them</span>
          <button type="button" className={WORD} disabled={!active} aria-label={idler ? 'Take off the idler gear' : 'Add an idler gear'} onClick={toggleIdler}>{idler ? 'Take off' : 'Add'}</button>
        </div>
        <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-0.5 border-t border-ss-line pt-1.5">
          <p className="flex items-baseline justify-between">
            <span className="text-[12px] font-bold text-ss-slate">Handle turns</span>
            <span className="text-[15px] font-extrabold tabular-nums text-ss-ink" data-handle-turns>{turnsNow(Math.abs(deg) / 360)}</span>
          </p>
          <button type="button" className={`${WORD} row-span-2`} aria-label="Turn the handle once" onClick={turnOnce}>Turn once</button>
          <p className="flex items-baseline justify-between">
            <span className="text-[12px] font-bold text-ss-slate">Output turns</span>
            <span className="text-[15px] font-extrabold tabular-nums text-ss-ink" data-output-turns>{turnsNow(outputTurns)}</span>
          </p>
        </div>
      </div>
      <KeyHelp text="The left and right arrows turn the handle." />
      <span className="sr-only" aria-live="polite">{`Handle turned ${turnsNow(Math.abs(deg) / 360)} times, output turned ${turnsNow(outputTurns)} times, ${relation} the handle.`}</span>
      <Verdict text={said} />
    </div>
  )
}

export function MomentsMachinesView(props: Props) {
  const { config } = props
  switch (config.task) {
    case 'balance':
      return <BalanceCard {...props} config={config} />
    case 'lever':
      return <LeverCard {...props} config={config} />
    case 'pulley':
      return <PulleyCard {...props} config={config} />
    case 'gears':
      return <GearsCard {...props} config={config} />
  }
}
