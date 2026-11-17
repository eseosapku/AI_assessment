'use client'
import { useId, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react'
import type { SceneViewProps } from '../types'
import type { Observation, ReactivityConfig, ReactivityState } from './config'
import {
  dippedOf, equationsOf, madeText, metalOf, observationOf, reactionOf, reactivitySeriesEngine,
  rubbedOf, solutionOf, working,
} from './config'

type Props = SceneViewProps<ReactivityConfig, ReactivityState>

// A light laboratory plate in both themes. All the colours belong to the real materials; no gradients or shadows.
const PLATE = '#F8FAFC'
const PLATE_EDGE = '#CBD5E1'
const GLASS = '#E4EDF0'
const GLASS_EDGE = '#6E8792'
const GLASS_HI = '#FFFFFF'
const INK = '#263640'
const SOFT = '#52646F'
const BENCH = '#D8E0E4'
const BENCH_EDGE = '#A9B6BD'
const HANDLE = '#52626C'
const HANDLE_HI = '#B9C4CA'
const EMERY = '#A67D57'
const EMERY_EDGE = '#72543B'
const PAPER = '#D6B58D'
const OXIDE = '#A8ADB0'
const ALUMINIUM = '#CDD5DA'
const ALUMINIUM_EDGE = '#73838D'
const ACID = '#E7F0F1'
const GRIP_BLUE = '#397CA1'
const FONT = 'system-ui, sans-serif'

// Literal dimensions, not top-level reads from config (config and View initialise one another).
export const W = 360
export const H = 284
const STRIP_X = 150
const STRIP_TOP = 18
const STRIP_BOTTOM = 169
const BEAKER_X = 79
const BEAKER_RIGHT = 251
const RIM_Y = 125
const LIQUID_Y = 181
const SETTLE_Y = 178
const FLOOR_Y = 228

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

export const stripBottom = (dipped: boolean, dragging: number | null) => dragging ?? (dipped ? FLOOR_Y : STRIP_BOTTOM)
export const solutionColour = (config: ReactivityConfig, dipped: boolean) => {
  if (config.task === 'aluminium') return ACID
  const solution = solutionOf(config.solution)
  if (!dipped || !reactionOf(config)) return solution.liquid
  if (solution.id === 'copper-sulfate') return '#BDD4DE'
  return solution.liquid
}

export function observationOrder(config: ReactivityConfig): Observation[] {
  if (config.task === 'aluminium') return []
  // Same order for both outcomes of this metal: button position cannot be used to infer the answer.
  return metalOf(config.metal).rank % 20 === 0 ? ['none', 'coating'] : ['coating', 'none']
}

/** A small deterministic coating: crystalline grains, not a flat recolouring of the original strip. */
export function coatingGrains(dipped: boolean): { x: number; y: number; r: number }[] {
  if (!dipped) return []
  const out: { x: number; y: number; r: number }[] = []
  const rows = Math.max(1, Math.floor((FLOOR_Y - LIQUID_Y - 5) / 4.6))
  for (let row = 0; row < rows; row++) {
    const y = LIQUID_Y + 5 + row * 4.6
    for (let side = 0; side < 2; side++) {
      out.push({ x: STRIP_X + (side ? 13.5 : -13.5), y, r: 2.7 + ((row + side) % 3) * 0.45 })
      if (row % 2 === side) out.push({ x: STRIP_X + (side ? 8 : -8), y: y + 1.8, r: 2.5 })
    }
  }
  return out
}

export function bubbles(config: ReactivityConfig, state: ReactivityState): { x: number; y: number; r: number; phase: number }[] {
  if (config.task !== 'aluminium' || rubbedOf(state) !== 3 || !dippedOf(state)) return []
  return Array.from({ length: 9 }, (_, i) => ({
    x: STRIP_X + [-21, 20, -16, 23, -24, 17, -19, 25, -14][i],
    y: 220 - (i % 4) * 13,
    r: 2.5 + (i % 3),
    phase: i / 9,
  }))
}

function GlassBack() {
  return (
    <g aria-hidden="true">
      {/* A thick bottom and the back wall of a real squat beaker. */}
      <path d={`M ${BEAKER_X} ${RIM_Y + 5} L 87 247 Q 88 257 99 258 H 235 Q 246 257 247 247 L ${BEAKER_RIGHT} ${RIM_Y + 5}`}
        fill={GLASS} fillOpacity={0.46} stroke={GLASS_EDGE} strokeWidth={1.5} strokeLinejoin="round" />
      <path d={`M ${BEAKER_X + 4} ${RIM_Y + 10} L 92 246 Q 93 252 101 252 H 232`} fill="none" stroke={GLASS_HI} strokeWidth={2.2} strokeLinecap="round" opacity={0.9} />
    </g>
  )
}

function Graduations() {
  return (
    <g aria-hidden="true" fill={SOFT} stroke={SOFT} fontFamily={FONT}>
      {[0, 1, 2, 3].map((i) => {
        const y = 180 + i * 16
        return <g key={i}>
          <line x1={229} x2={i % 2 ? 236 : 241} y1={y} y2={y} strokeWidth={1.2} />
          {i % 2 === 0 && <text x={224} y={y + 3.5} textAnchor="end" fontSize={12} fontWeight={650} stroke="none">{100 - i * 25}</text>}
        </g>
      })}
      <text x={215} y={253} textAnchor="end" fontSize={12} fontWeight={650} stroke="none">ml</text>
    </g>
  )
}

function GlassFront() {
  return (
    <g aria-hidden="true" fill="none" strokeLinecap="round" strokeLinejoin="round">
      {/* The pouring lip interrupts the left-hand rim. */}
      <path d={`M 75 ${RIM_Y} L 80 ${RIM_Y + 7} M 80 ${RIM_Y + 7} H ${BEAKER_RIGHT} Q 256 ${RIM_Y + 7} 254 ${RIM_Y + 2} L 250 ${RIM_Y - 2} H 88 L 80 ${RIM_Y - 6} Z`}
        fill={GLASS} fillOpacity={0.78} stroke={GLASS_EDGE} strokeWidth={1.5} />
      <path d={`M 86 ${RIM_Y + 2} H 248`} stroke={GLASS_HI} strokeWidth={1.8} />
      <path d={`M 80 ${RIM_Y + 8} L 87 247 Q 88 258 99 259 H 235 Q 246 258 247 247 L 251 ${RIM_Y + 8}`} stroke={GLASS_EDGE} strokeWidth={1.5} />
      <path d={`M 91 252 Q 95 255 104 255 H 228`} stroke={GLASS_HI} strokeWidth={2.1} />
      <path d={`M 241 174 L 237 237`} stroke={GLASS_HI} strokeWidth={2.4} opacity={0.8} />
    </g>
  )
}

function Liquid({ colour, reduced }: { colour: string; reduced: boolean }) {
  const ease: CSSProperties = reduced ? {} : { transition: 'fill 900ms ease' }
  return (
    <g aria-hidden="true">
      <path d={`M 85 ${LIQUID_Y} Q 166 ${LIQUID_Y - 5} 247 ${LIQUID_Y} L 242 247 Q 241 253 233 253 H 100 Q 92 253 91 247 Z`}
        fill={colour} style={ease} />
      <path d={`M 85 ${LIQUID_Y} Q 166 ${LIQUID_Y - 5} 247 ${LIQUID_Y} Q 166 ${LIQUID_Y + 5} 85 ${LIQUID_Y}`}
        fill={colour} stroke={GLASS_EDGE} strokeWidth={0.8} style={ease} />
      <path d={`M 88 ${LIQUID_Y + 1} Q 166 ${LIQUID_Y + 5} 244 ${LIQUID_Y + 1}`} fill="none" stroke={GLASS_HI} strokeWidth={1.1} opacity={0.75} />
    </g>
  )
}

function Strip({ config, rubbed, bottom, coating, reduced, onPointerDown, onKeyDown, onClick, onFocus, onBlur, focused, interactive }: {
  config: ReactivityConfig
  rubbed: number
  bottom: number
  coating: ReturnType<typeof reactionOf>
  reduced: boolean
  interactive: boolean
  onPointerDown(e: PointerEvent<SVGGElement>): void
  onKeyDown(e: KeyboardEvent<SVGGElement>): void
  onClick(e: MouseEvent<SVGGElement>): void
  onFocus(): void
  onBlur(): void
  focused: boolean
}) {
  const aluminium = config.task === 'aluminium'
  const metal = aluminium ? null : metalOf(config.metal)
  const top = bottom - 151
  const exposed = rubbed / 3
  const body = aluminium ? ALUMINIUM : metal!.colour
  const edge = aluminium ? ALUMINIUM_EDGE : metal!.edge
  const ease: CSSProperties = reduced ? {} : { transition: 'transform 850ms cubic-bezier(.22,.7,.25,1)' }
  const name = aluminium ? 'aluminium' : metal!.name
  return (
    <g
      data-strip="1" transform={`translate(0 ${top})`} style={ease}
      role="slider" tabIndex={interactive ? 0 : -1} aria-disabled={!interactive} aria-label={`${name} strip. Drag into the solution, tap to dip or lift, or use the up and down arrow keys.`}
      aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(((bottom - STRIP_BOTTOM) / (FLOOR_Y - STRIP_BOTTOM)) * 100)}
      aria-valuetext={bottom >= LIQUID_Y + 10 ? `${name} strip in the solution` : `${name} strip above the solution`}
      className="nodrag cursor-grab touch-none outline-none active:cursor-grabbing"
      onPointerDown={onPointerDown} onKeyDown={onKeyDown} onClick={onClick} onFocus={onFocus} onBlur={onBlur}
    >
      <rect x={STRIP_X - 29} y={-8} width={58} height={168} fill="transparent" />
      {/* A flat rolled-metal strip, its sheared end below the liquid. */}
      <path d={`M ${STRIP_X - 14} 6 L ${STRIP_X - 10} 1 H ${STRIP_X + 11} L ${STRIP_X + 14} 6 V 146 L ${STRIP_X + 8} 151 H ${STRIP_X - 9} L ${STRIP_X - 14} 146 Z`}
        fill={body} stroke={edge} strokeWidth={1.5} strokeLinejoin="round" />
      <path d={`M ${STRIP_X - 9} 9 V 139`} stroke="#F4F7F8" strokeWidth={2.1} opacity={0.72} />
      <path d={`M ${STRIP_X + 9} 12 V 140`} stroke={edge} strokeWidth={1} opacity={0.35} />
      {aluminium && <>
        {/* The intact oxide is a dull, patchy skin; three rubs uncover the bright metal in broad bands. */}
        {Array.from({ length: 3 }, (_, i) => i >= rubbed ? (
          <path key={i} d={`M ${STRIP_X - 12} ${78 + i * 24} H ${STRIP_X + 12} V ${98 + i * 24} H ${STRIP_X - 12} Z`} fill={OXIDE} opacity={0.86} />
        ) : null)}
        {rubbed > 0 && <path d={`M ${STRIP_X - 8} ${126 - exposed * 40} L ${STRIP_X + 7} ${132 - exposed * 40}`} stroke="#FFFFFF" strokeWidth={2} opacity={0.7} />}
      </>}
      {coating && <g>
        {/* A continuous new solid, with a rough crystalline edge, not beads on top of the old metal. */}
        <path d={`M ${STRIP_X - 14} ${LIQUID_Y - top} H ${STRIP_X + 14} V ${bottom - top} H ${STRIP_X - 14} Z`}
          fill={coating.coatingColour} stroke={coating.coatingEdge} strokeWidth={1.1} />
        <path d={`M ${STRIP_X - 8} ${LIQUID_Y + 4 - top} V ${FLOOR_Y - 5 - top}`} stroke="#E8C0A6" strokeWidth={2} opacity={coating.product === 'copper' ? 0.65 : 0.25} />
        {coatingGrains(bottom >= LIQUID_Y).map((g, i) => (
          <circle key={i} cx={g.x} cy={g.y - top} r={g.r} fill={coating.coatingColour} stroke={coating.coatingEdge} strokeWidth={0.65} />
        ))}
      </g>}
      {/* A small laboratory clamp: visible affordance and generous grip, attached to the object itself. */}
      <g transform={`translate(${STRIP_X} 0)`}>
        <rect x={-24} y={-5} width={48} height={13} rx={4} fill={HANDLE} stroke={INK} strokeWidth={1} />
        <rect x={-16} y={-2} width={32} height={3} rx={1.5} fill={HANDLE_HI} />
        <circle cx={-19} cy={1.5} r={2.2} fill={HANDLE_HI} stroke={INK} strokeWidth={0.7} />
        <path d="M -5 10 V 15 M 0 10 V 15 M 5 10 V 15" stroke={HANDLE} strokeWidth={2} strokeLinecap="round" />
      </g>
      {focused && <rect x={STRIP_X - 31} y={-9} width={62} height={169} rx={7} fill="none" stroke="var(--subject)" strokeWidth={2} />}
    </g>
  )
}

function Emery() {
  return (
    <g transform="translate(27 76)" aria-hidden="true">
      <path d="M 0 7 L 39 0 L 49 38 L 10 45 Z" fill={PAPER} stroke={EMERY_EDGE} strokeWidth={1.2} />
      <path d="M 5 10 L 37 4 L 44 34 L 12 40 Z" fill={EMERY} />
      {Array.from({ length: 18 }, (_, i) => <circle key={i} cx={10 + (i * 13) % 29} cy={9 + (i * 9) % 27} r={0.8} fill={EMERY_EDGE} opacity={0.7} />)}
    </g>
  )
}

export function ReactivitySeriesView({ config, state, setState, marked, reduced, locked }: Props) {
  const now = marked === 'shown' ? reactivitySeriesEngine.solve(config) : state
  const dipped = dippedOf(now)
  const rubbed = rubbedOf(now)
  const observed = observationOf(now)
  const reaction = config.task === 'displace' && dipped ? reactionOf(config) : null
  const metal = config.task === 'displace' ? metalOf(config.metal) : null
  const solution = config.task === 'displace' ? solutionOf(config.solution) : null
  const liquid = solutionColour(config, dipped)
  const bubbleList = bubbles(config, now)
  const order = observationOrder(config)
  const good = marked === 'right' || marked === 'shown'
  const finished = marked !== 'idle'
  const verdict = good ? working(config, now) : marked === 'wrong' ? madeText(config, now) : ''
  // A wrong mark says what was made, not the reaction: the equations would give the next try away.
  const equations = marked === 'right' || marked === 'shown' ? equationsOf(config, now) : []
  const id = useId()
  const [dragging, setDragging] = useState<number | null>(null)
  const [focused, setFocused] = useState(false)
  const suppressClick = useRef(false)
  const canHandle = !locked && !good
  const bottom = stripBottom(dipped, dragging)

  const put = (next: ReactivityState) => { if (canHandle) setState(next) }
  const toggleDip = () => put(config.task === 'aluminium' ? { dipped: !dipped, rubbed } : { dipped: !dipped, observed })
  const rub = () => {
    if (!canHandle || config.task !== 'aluminium') return
    put({ dipped: false, rubbed: Math.min(3, rubbed + 1) })
  }
  const observe = (value: Observation) => put({ dipped: true, observed: value })
  const stripClick = (e: MouseEvent<SVGGElement>) => {
    if (suppressClick.current) {
      suppressClick.current = false
      e.preventDefault()
      return
    }
    if (canHandle) toggleDip()
  }

  const onStripPointer = (e: PointerEvent<SVGGElement>) => {
    if (!canHandle || e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    // React releases currentTarget after the handler: keep the real nodes for the pointer-up later.
    const target = e.currentTarget
    const svg = target.ownerSVGElement!
    const pointerId = e.pointerId
    const startY = e.clientY
    const startBottom = bottom
    const scale = H / svg.getBoundingClientRect().height
    let moved = false
    let nextBottom = startBottom
    const move = (ev: globalThis.PointerEvent) => {
      const delta = (ev.clientY - startY) * scale
      if (Math.abs(delta) > 4) moved = true
      nextBottom = clamp(startBottom + delta, STRIP_BOTTOM, FLOOR_Y)
      setDragging(nextBottom)
    }
    const up = (ev: globalThis.PointerEvent) => {
      if (target.hasPointerCapture?.(pointerId)) target.releasePointerCapture(pointerId)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      setDragging(null)
      if (!moved) return // the click toggles; no precision target
      suppressClick.current = true
      const shouldDip = nextBottom >= SETTLE_Y
      put(config.task === 'aluminium' ? { dipped: shouldDip, rubbed } : { dipped: shouldDip, observed })
      ev.preventDefault()
    }
    target.setPointerCapture?.(pointerId)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  const onStripKey = (e: KeyboardEvent<SVGGElement>) => {
    if (!canHandle) return
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
      e.preventDefault()
      e.stopPropagation()
      if (e.key === 'ArrowDown' && !dipped) put(config.task === 'aluminium' ? { dipped: true, rubbed } : { dipped: true, observed })
      else if (e.key === 'ArrowUp' && dipped) put(config.task === 'aluminium' ? { dipped: false, rubbed } : { dipped: false, observed })
      else if (e.key === 'Enter' || e.key === ' ') toggleDip()
    }
  }

  const seen = config.task === 'aluminium'
    ? `A glass beaker of dilute hydrochloric acid, an aluminium strip ${dipped ? 'in' : 'above'} the acid, and emery paper. ${rubbed === 0 ? 'The strip has a dull surface.' : rubbed === 3 ? 'The strip has been rubbed bright.' : `The strip has had ${rubbed} of 3 rubs.`} ${bubbleList.length ? 'Gas bubbles are rising around the strip.' : 'No bubbles are visible.'}`
    : `A glass beaker of ${solution!.name}, and a ${metal!.name} strip ${dipped ? 'in' : 'above'} the solution. ${reaction ? `A ${reaction.coating} solid coating is visible on the strip${solution!.id === 'copper-sulfate' ? ' and the blue liquid is paler' : ''}.` : 'The strip and liquid show no visible change.'}`

  const observeButton = (value: Observation) => {
    const selected = observed === value
    return (
      <button key={value} type="button" data-observation={value} aria-label={value === 'coating' ? 'I observe a coating on the strip' : 'I observe no change'}
        aria-pressed={selected} disabled={!canHandle} onClick={() => observe(value)}
        className={`nodrag flex h-7 flex-1 items-center justify-center whitespace-nowrap rounded-lg border-2 px-2 text-[12px] font-bold text-ss-ink transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-default ${selected ? 'border-[color:var(--subject)] bg-ss-chip' : 'border-ss-line bg-ss-panel hover:border-[color:var(--subject)]'} ${reduced ? 'motion-reduce:transition-none' : ''}`}>
        {value === 'coating' ? 'A coating' : 'No change'}
      </button>
    )
  }

  return (
    <div className="nodrag flex w-full max-w-[360px] flex-col gap-2" onKeyDown={(e) => { if (e.key.startsWith('Arrow')) e.stopPropagation() }}>
      <figure className="m-0 flex w-full flex-col gap-1.5">
        <div className="relative w-full">
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={seen} className="block h-auto w-full select-none" fontFamily={FONT}>
            <rect x={0.75} y={0.75} width={W - 1.5} height={H - 1.5} rx={16} fill={PLATE} stroke={PLATE_EDGE} strokeWidth={1.5} />
            {/* Named reactants sit on their own side of the apparatus, never in a separate legend. */}
            <text x={23} y={29} fontSize={13} fontWeight={750} fill={INK} style={{ fill: INK }}>{config.task === 'aluminium' ? 'Aluminium strip' : `${metal!.name[0].toUpperCase()}${metal!.name.slice(1)} strip`}</text>
            {!dipped && <path d={`M 106 34 L 130 48`} stroke={PLATE_EDGE} strokeWidth={1.4} />}
            <text x={258} y={143} fontSize={12.5} fontWeight={700} fill={INK} style={{ fill: INK }}>{config.task === 'aluminium' ? 'Dilute' : solution!.name.split(' ')[0]}</text>
            <text x={258} y={159} fontSize={12.5} fontWeight={700} fill={INK} style={{ fill: INK }}>{config.task === 'aluminium' ? 'hydrochloric acid' : solution!.name.split(' ').slice(1).join(' ')}</text>
            <text x={258} y={179} fontSize={12} fontWeight={600} fill={SOFT} style={{ fill: SOFT }}>{config.task === 'aluminium' ? 'HCl(aq)' : `${solution!.formula}(aq)`}</text>

            <path d="M 49 263 H 282 L 289 270 H 42 Z" fill={BENCH} stroke={BENCH_EDGE} strokeWidth={1.2} strokeLinejoin="round" />
            <GlassBack />
            <Liquid colour={liquid} reduced={reduced} />
            <Graduations />
            <Strip config={config} rubbed={rubbed} bottom={bottom} coating={reaction} reduced={reduced}
              onPointerDown={onStripPointer} onKeyDown={onStripKey} onClick={stripClick}
              onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} focused={focused} interactive={canHandle} />
            {bubbleList.map((b, i) => (
              <circle key={i} data-bubble={i} cx={b.x} cy={reduced ? b.y : b.y - b.phase * 36} r={b.r} fill={GLASS_HI} fillOpacity={0.78} stroke={GRIP_BLUE} strokeWidth={1.1}>
                {!reduced && <>
                  <animate attributeName="cy" values={`${b.y};${LIQUID_Y + 4}`} dur={`${1.7 + b.phase}s`} begin={`${-b.phase * 1.7}s`} repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.15;0.8;1" dur={`${1.7 + b.phase}s`} begin={`${-b.phase * 1.7}s`} repeatCount="indefinite" />
                </>}
              </circle>
            ))}
            <GlassFront />
            {config.task === 'aluminium' && <Emery />}
            {config.task === 'aluminium' && <text x={49} y={66} textAnchor="middle" fontSize={12} fontWeight={700} fill={SOFT} style={{ fill: SOFT }}>Emery paper</text>}
          </svg>
          {config.task === 'aluminium' && canHandle && (
            <button type="button" aria-label={`Rub the aluminium with emery paper (${rubbed} of 3 rubs)`} onClick={rub} disabled={rubbed >= 3}
              className="nodrag absolute touch-manipulation rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--subject)] disabled:cursor-default"
              style={{ left: '4%', top: '23%', width: '22%', height: '29%', border: 'none', background: 'transparent', padding: 0, cursor: rubbed >= 3 ? 'default' : 'pointer' }} />
          )}
        </div>
        <figcaption id={`${id}-caption`} className="text-center text-[12px] font-bold text-ss-slate">
          {config.task === 'aluminium'
            ? bubbleList.length ? 'Bubbles rise around the strip.' : dipped ? 'Watch the strip in the acid.' : rubbed === 3 ? 'Surface rubbed bright. Dip the strip to test it.' : 'Rub the dull surface, then dip the strip.'
            : dipped ? reaction ? 'Look at the strip and the solution.' : 'The strip and solution look unchanged.' : 'Dip the strip and watch what happens.'}
        </figcaption>
      </figure>

      {config.task === 'displace' && dipped ? (
        <div className="flex items-center gap-2" aria-label="Your observation">
          <span className="shrink-0 text-[12px] font-bold text-ss-slate">You see</span>
          {order.map(observeButton)}
        </div>
      ) : null}

      {finished && (
        <div className="rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2" aria-live="polite">
          <p className="text-[13px] font-extrabold leading-snug text-ss-ink">{verdict}</p>
          {equations.map((equation) => <p key={equation} className="mt-1 text-[12px] font-semibold leading-snug text-ss-slate">{equation}</p>)}
        </div>
      )}
      <span className="sr-only" aria-live="polite">{dipped ? config.task === 'aluminium' ? bubbleList.length ? 'The dipped strip is producing bubbles.' : 'The dipped strip has no visible bubbles.' : reaction ? 'A coating is visible.' : 'There is no visible change.' : 'The strip is above the liquid.'}</span>
    </div>
  )
}

