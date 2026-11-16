'use client'
import type { KeyboardEvent, ReactNode } from 'react'
import type { SceneViewProps } from '../types'
import type { BulbState, CircuitConfig, CircuitState, Place, Switches } from './config'
import { madeText, netOf, ratText, working } from './config'

type Props = SceneViewProps<CircuitConfig, CircuitState>

// The scene's own inks: flat, and each part that carries meaning is over 3:1 on the panel in both themes.
const PALETTE =
  '[--ci-lit:#FBBF24] [--ci-ray:#B45309] [--ci-meter:#1D4ED8] dark:[--ci-ray:#FCD34D] dark:[--ci-meter:#93C5FD]'
const INK = 'var(--ss-ink, #16202A)'
const PANEL = 'var(--ss-panel, #FFFFFF)'
const LIT = 'var(--ci-lit, #FBBF24)'
const RAY = 'var(--ci-ray, #B45309)'
const METER = 'var(--ci-meter, #1D4ED8)'
const SUBJECT = 'var(--subject, #1D4ED8)'
const WIRE = { stroke: INK, strokeWidth: 3, strokeLinecap: 'round', fill: 'none' } as const

// Geometry, in the viewBox's own pixels (about 1:1 at the card's width).
export const TOP = 30
export const BOT = 220
export const XL = 50
export const BULB_R = 17
export const METER_R = 15
export const SW_HALF = 16

type Dir = 'h' | 'v'
/** A part on a wire: where it sits along the wire and how far it reaches either way. */
type Part = { at: number; half: number }

/** The wire between two ends of a straight run, cut where parts sit on it. */
export function runs(from: number, to: number, parts: Part[]): [number, number][] {
  const sorted = [...parts].sort((p, q) => p.at - q.at)
  const out: [number, number][] = []
  let cur = from
  for (const p of sorted) {
    if (p.at - p.half > cur) out.push([cur, p.at - p.half])
    cur = p.at + p.half
  }
  if (to > cur) out.push([cur, to])
  return out
}

function Wire({ dir, fixed, from, to, parts = [], dashed }: { dir: Dir; fixed: number; from: number; to: number; parts?: Part[]; dashed?: boolean }) {
  return (
    <>
      {runs(from, to, parts).map(([a, b], i) => (
        <path
          key={i}
          d={dir === 'h' ? `M${a} ${fixed}H${b}` : `M${fixed} ${a}V${b}`}
          {...WIRE}
          opacity={dashed ? 0.5 : 1}
          strokeDasharray={dashed ? '5 6' : undefined}
        />
      ))}
    </>
  )
}

const Dot = ({ x, y }: { x: number; y: number }) => <circle cx={x} cy={y} r={4} fill={INK} />

/** A bulb: the standard circle with a cross. Brighter bulbs have longer rays; none are drawn when dark. */
export function Bulb({ x, y, level }: { x: number; y: number; level: 0 | 1 | 2 | 3 }) {
  const c = BULB_R * 0.707
  const len = [0, 3, 6, 9][level]
  return (
    <g>
      {level > 0 &&
        Array.from({ length: 8 }, (_, i) => {
          const a = (i * Math.PI) / 4
          const r0 = BULB_R + 4
          return <path key={i} d={`M${x + Math.cos(a) * r0} ${y + Math.sin(a) * r0}L${x + Math.cos(a) * (r0 + len)} ${y + Math.sin(a) * (r0 + len)}`} stroke={RAY} strokeWidth={3} strokeLinecap="round" />
        })}
      <circle cx={x} cy={y} r={BULB_R} fill={level > 0 ? LIT : PANEL} stroke={INK} strokeWidth={2.5} />
      <path d={`M${x - c} ${y - c}L${x + c} ${y + c}M${x + c} ${y - c}L${x - c} ${y + c}`} stroke={INK} strokeWidth={2.5} strokeLinecap="round" />
    </g>
  )
}

function Meter({ x, y, reading }: { x: number; y: number; reading: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r={METER_R} fill={PANEL} stroke={METER} strokeWidth={2.5} />
      <text x={x} y={y + 5} textAnchor="middle" fontSize={14} fontWeight={800} fill={METER}>A</text>
      <text x={x + METER_R + 6} y={y + 5} fontSize={14} fontWeight={800} fill={INK}>{reading}</text>
    </g>
  )
}

/** The standard cell: a long thin line (positive, top) and a short thick one (negative). */
function Cell({ x, volts }: { x: number; volts: number }) {
  return (
    <g>
      <path d={`M${x - 15} 117H${x + 15}`} stroke={INK} strokeWidth={2.5} />
      <path d={`M${x - 8} 133H${x + 8}`} stroke={INK} strokeWidth={5} />
      <text x={x + 22} y={130} fontSize={14} fontWeight={800} fill={INK}>{volts} V</text>
    </g>
  )
}

function stop(e: KeyboardEvent) {
  if (e.key.startsWith('Arrow')) e.stopPropagation()
}

/** A tappable spot: a button for mouse, touch and keyboard, with a ring that says it can be handled. */
function Tap({ x, y, label, pressed, disabled, onPress, children, ring = 22 }: { x: number; y: number; label: string; pressed?: boolean; disabled: boolean; onPress(): void; children: ReactNode; ring?: number }) {
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={label}
      aria-pressed={pressed}
      aria-disabled={disabled}
      className="group touch-none outline-none"
      style={{ cursor: disabled ? 'default' : 'pointer' }}
      onClick={() => { if (!disabled) onPress() }}
      onKeyDown={(e) => {
        stop(e)
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); if (!disabled) onPress() }
      }}
    >
      <rect x={x - 24} y={y - 24} width={48} height={48} fill="transparent" />
      {children}
      {!disabled && (
        <circle cx={x} cy={y} r={ring} fill="none" stroke={SUBJECT} strokeWidth={2} strokeDasharray="3 4" className="group-focus-visible:[stroke-dasharray:0] group-focus-visible:[stroke-width:3.5px]" />
      )}
    </g>
  )
}

/** The standard switch: a lever resting on one contact. Open it stands up off the other; closed it lies flat across. */
function Switch({ x, y, dir, closed }: { x: number; y: number; dir: Dir; closed: boolean }) {
  const a = dir === 'h' ? [x - SW_HALF, y] : [x, y - SW_HALF]
  const b = dir === 'h' ? [x + SW_HALF, y] : [x, y + SW_HALF]
  const lift = dir === 'h' ? [x + SW_HALF - 4, y - 15] : [x + 15, y + SW_HALF - 4]
  const end = closed ? b : lift
  return (
    <g>
      <path d={`M${a[0]} ${a[1]}L${end[0]} ${end[1]}`} {...WIRE} />
      <circle cx={a[0]} cy={a[1]} r={4} fill={INK} />
      <circle cx={b[0]} cy={b[1]} r={4} fill={INK} />
    </g>
  )
}

const Letter = ({ x, y, t }: { x: number; y: number; t: string }) => (
  <text x={x} y={y + 5} textAnchor="middle" fontSize={15} fontWeight={800} fill={INK}>{t}</text>
)

/** What the bulbs look like, in words and without naming any arrangement. */
function seen(name: string, b: BulbState | null) {
  if (!b) return `Bulb ${name} is not in the circuit.`
  return `Bulb ${name} is ${['dark', 'glowing faintly', 'glowing', 'glowing brightly'][b.level]}.`
}

// ---------------------------------------------------------------------------
// light: two bulbs on their own paths, each with a switch, and a switch in the wire that feeds B.

const X1 = 140
const XM = 220
const X2 = 300
const SW_Y = 66
const M1_Y = 104
const BULB_Y = 150
const M2_Y = 196

function Light({ config, state, setState, marked, locked }: Props & { config: Extract<CircuitConfig, { task: 'light' }> }) {
  const sw: Switches = state?.sw ?? { a: false, link: false, b: false }
  const net = netOf(config, state)
  const showMeters = marked !== 'idle'
  const flip = (k: keyof Switches) => { if (!locked) setState({ ...state, sw: { ...sw, [k]: !sw[k] } }) }
  const branch = (x: number, name: string, on: keyof Switches, b: BulbState) => {
    const metered = showMeters && b.lit
    const parts: Part[] = [{ at: SW_Y, half: SW_HALF }, { at: BULB_Y, half: BULB_R }]
    if (metered) parts.push({ at: M1_Y, half: METER_R }, { at: M2_Y, half: METER_R })
    const reading = `${ratText(b.current)} A`
    return (
      <g>
        <Wire dir="v" fixed={x} from={TOP} to={BOT} parts={parts} />
        <Tap x={x} y={SW_Y} disabled={locked} pressed={sw[on]} onPress={() => flip(on)} label={`Switch for bulb ${name}, ${sw[on] ? 'closed' : 'open'}. Press to ${sw[on] ? 'open' : 'close'} it.`}>
          <Switch x={x} y={SW_Y} dir="v" closed={sw[on]} />
        </Tap>
        {metered && <Meter x={x} y={M1_Y} reading={reading} />}
        <Bulb x={x} y={BULB_Y} level={b.level} />
        {metered && <Meter x={x} y={M2_Y} reading={reading} />}
        <Letter x={x - 46} y={BULB_Y} t={name} />
      </g>
    )
  }
  return (
    <>
      <Cell x={XL} volts={config.volts} />
      <Wire dir="v" fixed={XL} from={TOP} to={117} />
      <Wire dir="v" fixed={XL} from={133} to={BOT} />
      <Wire dir="h" fixed={TOP} from={XL} to={X2} parts={[{ at: XM, half: SW_HALF }]} />
      <Wire dir="h" fixed={BOT} from={XL} to={X2} />
      <Dot x={X1} y={TOP} />
      <Dot x={X1} y={BOT} />
      <Dot x={X2} y={BOT} />
      <Tap x={XM} y={TOP} disabled={locked} pressed={sw.link} onPress={() => flip('link')} label={`Switch in the top wire between bulb A and bulb B, ${sw.link ? 'closed' : 'open'}. Press to ${sw.link ? 'open' : 'close'} it.`}>
        <Switch x={XM} y={TOP} dir="h" closed={sw.link} />
      </Tap>
      {branch(X1, 'A', 'a', net.a)}
      {branch(X2, 'B', 'b', net.b!)}
    </>
  )
}

// ---------------------------------------------------------------------------
// brightness: bulb A, and two slots for a spare bulb.

const S_X = 105 // slot on the top wire
const P_X = 190 // slot between the wires
const A_X = 300
const MID = 125

function Bright({ config, state, setState, marked, locked }: Props & { config: Extract<CircuitConfig, { task: 'brightness' }> }) {
  const place: Place = state?.place ?? 'none'
  const net = netOf(config, state)
  const put = (p: 'series' | 'parallel') => { if (!locked) setState({ ...state, place: place === p ? 'none' : p }) }
  const showMeters = marked !== 'idle'
  const aParts: Part[] = [{ at: MID, half: BULB_R }]
  if (showMeters) aParts.push({ at: 75, half: METER_R }, { at: 175, half: METER_R })
  const reading = `${ratText(net.a.current)} A`
  const slotTop = place === 'series'
  const slotMid = place === 'parallel'
  return (
    <>
      <Cell x={XL} volts={config.volts} />
      <Wire dir="v" fixed={XL} from={TOP} to={117} />
      <Wire dir="v" fixed={XL} from={133} to={BOT} />
      <Wire dir="h" fixed={TOP} from={XL} to={A_X} parts={slotTop ? [{ at: S_X, half: BULB_R }] : []} />
      <Wire dir="h" fixed={BOT} from={XL} to={A_X} />
      <Dot x={P_X} y={TOP} />
      <Dot x={P_X} y={BOT} />
      {/* The middle slot: a faint wire when empty, a real branch once a bulb is in it. */}
      <Wire dir="v" fixed={P_X} from={TOP} to={BOT} parts={slotMid ? [{ at: MID, half: BULB_R }] : []} dashed={!slotMid} />
      <Wire dir="v" fixed={A_X} from={TOP} to={BOT} parts={aParts} />
      {showMeters && <Meter x={A_X} y={75} reading={reading} />}
      <Bulb x={A_X} y={MID} level={net.a.level} />
      {showMeters && <Meter x={A_X} y={175} reading={reading} />}
      <Letter x={A_X - 46} y={MID} t="A" />

      <Tap x={S_X} y={TOP} disabled={locked} ring={slotTop ? 35 : 22} pressed={slotTop} onPress={() => put('series')} label={slotTop ? 'Spare bulb B, in the slot on the top wire. Press to take it out.' : 'Empty slot on the top wire. Press to put the spare bulb B here.'}>
        {slotTop ? <><Bulb x={S_X} y={TOP} level={net.b?.level ?? 0} /><Letter x={S_X} y={TOP - 46} t="B" /></> : <circle cx={S_X} cy={TOP} r={BULB_R} fill={PANEL} stroke={INK} strokeWidth={2} strokeDasharray="4 4" />}
        {!slotTop && <path d={`M${S_X - 7} ${TOP}H${S_X + 7}M${S_X} ${TOP - 7}V${TOP + 7}`} stroke={INK} strokeWidth={2.5} strokeLinecap="round" />}
      </Tap>
      <Tap x={P_X} y={MID} disabled={locked} ring={slotMid ? 35 : 22} pressed={slotMid} onPress={() => put('parallel')} label={slotMid ? 'Spare bulb B, in the slot between the top and bottom wires. Press to take it out.' : 'Empty slot between the top and bottom wires. Press to put the spare bulb B here.'}>
        {slotMid ? <><Bulb x={P_X} y={MID} level={net.b?.level ?? 0} /><Letter x={P_X - 46} y={MID} t="B" /></> : <circle cx={P_X} cy={MID} r={BULB_R} fill={PANEL} stroke={INK} strokeWidth={2} strokeDasharray="4 4" />}
        {!slotMid && <path d={`M${P_X - 7} ${MID}H${P_X + 7}M${P_X} ${MID - 7}V${MID + 7}`} stroke={INK} strokeWidth={2.5} strokeLinecap="round" />}
      </Tap>
    </>
  )
}

export function CircuitView(props: Props) {
  const { config, state, marked } = props
  const net = netOf(config, state)
  const said = marked === 'idle' ? '' : [marked === 'right' ? '' : madeText(config, state), working(config, state)].filter(Boolean).join(' ')
  const sr = `${seen('A', net.a)} ${seen('B', net.b)}`
  return (
    <div className={`flex w-full flex-col items-center gap-2 ${PALETTE}`}>
      <svg viewBox="0 0 380 276" role="group" aria-label={`A ${config.volts} volt battery and bulbs. ${sr}`} className="h-auto w-full max-w-[400px]">
        <rect width={380} height={276} fill={PANEL} />
        <g transform="translate(0 28)">
          {config.task === 'light' ? <Light {...props} config={config} /> : <Bright {...props} config={config} />}
        </g>
      </svg>
      <p className="sr-only" aria-live="polite">{sr}</p>
      {said && <p className="max-w-[360px] text-center text-[13px] font-extrabold leading-snug text-ss-ink">{said}</p>}
    </div>
  )
}
