'use client'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { SceneMarked, SceneViewProps } from '../types'
import type { Contacts, MotorConfig, MotorState } from './config'
import {
  cleanAmps, cleanAngle, cleanContacts, forceSign, FULL_TURN, motorEffectEngine, motorFeedback,
  nextMotorState, wireFeedback, wireWay,
} from './config'

type Props = SceneViewProps<MotorConfig, MotorState>

// School apparatus on one pale plate in both themes. Materials, not neon: lacquered
// magnet steel, copper, brass, carbon and rubber leads. Flat colour only.
const PLATE = '#F8FAFC'
const PLATE_EDGE = '#CBD5E1'
const INK = '#16202A'
const SOFT = '#475569'
const NORTH = '#C84B45'
const NORTH_EDGE = '#7F2926'
const SOUTH = '#477DA8'
const SOUTH_EDGE = '#294E6C'
const COPPER = '#C77B35'
const COPPER_HI = '#F0BA70'
const COPPER_EDGE = '#714119'
const BRASS = '#C49A45'
const CARBON = '#414B57'
const RUBBER = '#394552'
const FORCE = '#2679A8'
const PAPER = '#FFFFFF'
const FONT = 'system-ui, sans-serif'
export const W = 360
export const H = 240

const keepArrows = (e: KeyboardEvent) => { if (e.key.startsWith('Arrow')) e.stopPropagation() }
const f = (n: number) => n.toFixed(1)

const STEP = 'nodrag flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-lg border-2 border-ss-line bg-ss-panel text-[16px] font-extrabold leading-none text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'
const WIDE = 'nodrag inline-flex h-7 min-w-[112px] select-none items-center justify-center whitespace-nowrap rounded-lg border-2 border-ss-line bg-ss-panel px-2 text-[12px] font-extrabold text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex min-h-7 items-center justify-between gap-2"><span className="text-[12px] font-bold text-ss-slate">{label}</span>{children}</div>
}

function Arrow({ x1, y1, x2, y2, color = FORCE, width = 2.2 }: { x1: number; y1: number; x2: number; y2: number; color?: string; width?: number }) {
  const dx = x2 - x1
  const dy = y2 - y1
  const long = Math.hypot(dx, dy) || 1
  const ux = dx / long
  const uy = dy / long
  const px = -uy
  const py = ux
  const hx = x2 - ux * 7
  const hy = y2 - uy * 7
  return <g stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" fill={color}>
    <line x1={x1} y1={y1} x2={hx} y2={hy} />
    <path d={`M ${f(x2)} ${f(y2)} L ${f(hx + px * 3.5)} ${f(hy + py * 3.5)} L ${f(hx - px * 3.5)} ${f(hy - py * 3.5)} Z`} stroke="none" />
  </g>
}

function Pole({ front, north }: { front: boolean; north: boolean }) {
  const fill = north ? NORTH : SOUTH
  const edge = north ? NORTH_EDGE : SOUTH_EDGE
  const y = front ? 174 : 43
  return <g data-pole={front ? 'front' : 'back'}>
    <rect x={112} y={y + 5} width={136} height={front ? 43 : 34} rx={5} fill={edge} />
    <rect x={112} y={y} width={136} height={front ? 42 : 34} rx={5} fill={fill} stroke={edge} strokeWidth={1.5} />
    <rect x={120} y={y + 6} width={120} height={4} rx={2} fill={PAPER} opacity={0.2} />
    <text x={180} y={y + (front ? 28 : 24)} textAnchor="middle" fontFamily={FONT} fontSize={17} fontWeight={800} fill={PAPER}>{north ? 'N' : 'S'}</text>
  </g>
}

/** Geometry exported for tests: one current step always makes a visible move. Positive turns the rod's foot left. */
export function wireSwingDegrees(amps: number, sign: number): number {
  return amps === 0 ? 0 : sign * (5 + 4 * amps)
}

// A light oblique view: depth towards the viewer is drawn down and to the left, so the field
// (back to front) runs on a slant and never looks parallel to the hanging rod.
const toward = (x: number, y: number, z: number): [number, number] => [x - 0.6 * z, y + 0.45 * z]
const pts = (list: [number, number][]) => list.map(([x, y]) => `${f(x)},${f(y)}`).join(' ')

/** A magnet pole as a box: x0..x1 across, y0..y1 down, z0..z1 towards the viewer. Faces seen: front, top, right. */
function PoleBox({ x0, x1, y0, y1, z0, z1, fill, edge, see }: { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number; fill: string; edge: string; see?: boolean }) {
  const front = pts([toward(x0, y0, z1), toward(x1, y0, z1), toward(x1, y1, z1), toward(x0, y1, z1)])
  const top = pts([toward(x0, y0, z0), toward(x1, y0, z0), toward(x1, y0, z1), toward(x0, y0, z1)])
  const right = pts([toward(x1, y0, z0), toward(x1, y1, z0), toward(x1, y1, z1), toward(x1, y0, z1)])
  const o = see ? 0.32 : 1
  return <g stroke={edge} strokeWidth={1.5} strokeLinejoin="round" strokeDasharray={see ? '4 3' : undefined}>
    <polygon points={right} fill={edge} fillOpacity={o} />
    <polygon points={top} fill={fill} fillOpacity={see ? o : 0.82} />
    <polygon points={front} fill={fill} fillOpacity={o} />
  </g>
}

const PIVOT_X = 180
const PIVOT_Y = 30
const ROD = 150
const footOf = (deg: number): [number, number] => [PIVOT_X - ROD * Math.sin((deg * Math.PI) / 180), PIVOT_Y + ROD * Math.cos((deg * Math.PI) / 180)]
// The slack lead from the rod's foot loops under the magnet to the supply's lower terminal.
const leadPath = (deg: number) => {
  const [x, y] = footOf(deg)
  return `M ${f(x)} ${f(y)} C ${f(x - 30)} 228, 30 232, 46 130`
}

function WirePicture({ config, state, reduced }: { config: Extract<MotorConfig, { task: 'wire' }>; state: MotorState; reduced: boolean }) {
  const svg = useRef<SVGSVGElement>(null)
  const amps = cleanAmps(state)
  const sign = forceSign(state)
  const target = wireSwingDegrees(amps, sign)
  const previous = useRef(target)
  const way = wireWay(config, state)
  const northBack = state.poles !== -1
  const currentUp = state.supply === -1

  useEffect(() => {
    const rod = svg.current?.querySelector('[data-hanger]')
    const lead = svg.current?.querySelector('[data-lead]')
    if (!rod || !lead) return
    const from = previous.current
    previous.current = target
    const put = (deg: number) => { rod.setAttribute('transform', `rotate(${f(deg)} ${PIVOT_X} ${PIVOT_Y})`); lead.setAttribute('d', leadPath(deg)) }
    if (reduced || from === target) { put(target); return }
    let raf = 0
    let start = 0
    const tick = (time: number) => {
      if (!start) start = time
      const t = Math.min(1, (time - start) / 900)
      put(target + (from - target) * Math.exp(-3.2 * t) * Math.cos(7.2 * t))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, reduced])

  const back = { fill: northBack ? NORTH : SOUTH, edge: northBack ? NORTH_EDGE : SOUTH_EDGE }
  const front = { fill: northBack ? SOUTH : NORTH, edge: northBack ? SOUTH_EDGE : NORTH_EDGE }
  // Field arrows run from the N pole to the S pole: back to front, or front to back once the poles are swapped.
  const fieldArrows = [[150, 130], [212, 130], [150, 156], [212, 156]].map(([x, y]) => {
    const a = toward(x, y, -24)
    const b = toward(x, y, 24)
    return northBack ? [a, b] : [b, a]
  })
  return <svg ref={svg} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`A copper rod hangs between two magnet poles: the ${northBack ? 'north' : 'south'} pole behind it and the ${northBack ? 'south' : 'north'} pole in front of it, so the field runs ${northBack ? 'from back to front' : 'from front to back'}. ${amps ? `At ${amps} amperes it ${way === 'still' ? 'hangs still' : `swings ${way}`}.` : 'No current flows, so it hangs still.'} Conventional current flows ${currentUp ? 'up' : 'down'} the rod.`} className="block h-auto w-full select-none">
    <rect x={0.75} y={0.75} width={W - 1.5} height={H - 1.5} rx={16} fill={PLATE} stroke={PLATE_EDGE} strokeWidth={1.5} />
    {/* Stand and clamp. */}
    <path d={`M 28 228 H 350 M 344 228 V 20 H ${PIVOT_X} V ${PIVOT_Y - 4}`} fill="none" stroke={SOFT} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
    {/* Supply, with its top lead to the pivot. */}
    <text x={42} y={52} textAnchor="middle" fontFamily={FONT} fontSize={12} fontWeight={700} fill={SOFT}>d.c. supply</text>
    <rect x={16} y={60} width={52} height={60} rx={7} fill="#E2E8F0" stroke={SOFT} strokeWidth={1.5} />
    <circle cx={42} cy={76} r={8} fill={PAPER} stroke={SOFT} strokeWidth={1.3} />
    <circle cx={42} cy={104} r={8} fill={PAPER} stroke={SOFT} strokeWidth={1.3} />
    <text x={42} y={81} textAnchor="middle" fontFamily={FONT} fontSize={15} fontWeight={800} fill={INK}>{currentUp ? '−' : '+'}</text>
    <text x={42} y={109} textAnchor="middle" fontFamily={FONT} fontSize={15} fontWeight={800} fill={INK}>{currentUp ? '+' : '−'}</text>
    <path d={`M 50 76 H 96 V ${PIVOT_Y} H ${PIVOT_X - 6}`} fill="none" stroke={RUBBER} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    <path d="M 50 104 H 46 V 130" fill="none" stroke={RUBBER} strokeWidth={3} strokeLinecap="round" />
    {/* The pole behind the rod. */}
    <PoleBox x0={140} x1={220} y0={118} y1={166} z0={-70} z1={-24} {...back} />
    <text x={248} y={124} textAnchor="middle" fontFamily={FONT} fontSize={15} fontWeight={800} fill={PAPER}>{northBack ? 'N' : 'S'}</text>
    <text x={270} y={100} textAnchor="start" fontFamily={FONT} fontSize={12} fontWeight={700} fill={SOFT}>{northBack ? 'N' : 'S'} pole</text>
    <text x={270} y={114} textAnchor="start" fontFamily={FONT} fontSize={12} fontWeight={700} fill={SOFT}>(behind)</text>
    {fieldArrows.map(([a, b], i) => <Arrow key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} color="#5F7A90" width={1.8} />)}
    <text x={246} y={160} textAnchor="start" fontFamily={FONT} fontSize={12} fontWeight={700} fill={SOFT}>field</text>
    <path data-lead="" d={leadPath(target)} fill="none" stroke={RUBBER} strokeWidth={2.5} strokeLinecap="round" />
    <g data-hanger="" transform={`rotate(${f(target)} ${PIVOT_X} ${PIVOT_Y})`}>
      <line x1={PIVOT_X} y1={PIVOT_Y} x2={PIVOT_X} y2={PIVOT_Y + ROD} stroke={COPPER_EDGE} strokeWidth={8} strokeLinecap="round" />
      <line x1={PIVOT_X} y1={PIVOT_Y} x2={PIVOT_X} y2={PIVOT_Y + ROD} stroke={COPPER} strokeWidth={5} strokeLinecap="round" />
      <line x1={PIVOT_X - 1} y1={PIVOT_Y + 4} x2={PIVOT_X - 1} y2={PIVOT_Y + ROD - 4} stroke={COPPER_HI} strokeWidth={1.5} strokeLinecap="round" />
      {amps > 0 && <Arrow x1={PIVOT_X + 13} y1={currentUp ? 80 : 42} x2={PIVOT_X + 13} y2={currentUp ? 42 : 80} color={COPPER_EDGE} width={2} />}
      {amps > 0 && <text x={PIVOT_X + 20} y={65} textAnchor="start" fontFamily={FONT} fontSize={12} fontWeight={700} fill={COPPER_EDGE}>current</text>}
    </g>
    <circle cx={PIVOT_X} cy={PIVOT_Y} r={4.5} fill={BRASS} stroke={SOFT} strokeWidth={1} />
    {/* The pole in front, drawn see-through so the rod stays visible. */}
    <PoleBox x0={140} x1={220} y0={118} y1={166} z0={24} z1={70} {...front} see />
    <text x={138} y={180} textAnchor="middle" fontFamily={FONT} fontSize={16} fontWeight={800} fill={front.edge}>{northBack ? 'S' : 'N'}</text>
    <text x={244} y={204} textAnchor="start" fontFamily={FONT} fontSize={12} fontWeight={700} fill={SOFT}>{northBack ? 'S' : 'N'} pole</text>
    <text x={244} y={218} textAnchor="start" fontFamily={FONT} fontSize={12} fontWeight={700} fill={SOFT}>(in front)</text>
    <text x={PIVOT_X - 14} y={64} textAnchor="end" fontFamily={FONT} fontSize={12} fontWeight={700} fill={SOFT}>copper rod</text>
  </svg>
}

function CurrentControl({ amps, locked, set }: { amps: number; locked: boolean; set(n: number): void }) {
  return <Row label="Current">
    <span className="flex items-center gap-1">
      <button type="button" aria-label="Decrease current by 1 amp" disabled={locked || amps <= 0} onClick={() => set(amps - 1)} className={STEP}>−</button>
      <span className="min-w-[42px] text-center text-[15px] font-extrabold tabular-nums text-ss-ink">{amps} A</span>
      <button type="button" aria-label="Increase current by 1 amp" disabled={locked || amps >= 3} onClick={() => set(amps + 1)} className={STEP}>+</button>
    </span>
  </Row>
}

function WireCard({ config, state, setState, marked, reduced, locked }: Props & { config: Extract<MotorConfig, { task: 'wire' }> }) {
  const now = marked === 'shown' ? motorEffectEngine.solve(config) : state
  const amps = cleanAmps(now)
  const put = (next: Partial<MotorState>) => { if (!locked) setState({ ...now, ...next }) }
  const lines = marked === 'idle' ? [] : wireFeedback(config, now, marked === 'right' || marked === 'shown')
  return <div className="nodrag flex w-full max-w-[380px] flex-col gap-2" onKeyDown={keepArrows}>
    <figure className="m-0 flex w-full flex-col gap-1">
      <WirePicture config={config} state={now} reduced={reduced} />
      <figcaption className="text-center text-[12px] font-bold text-ss-slate">The rod hangs in the field between the poles. It moves when current flows.</figcaption>
    </figure>
    <p className="flex items-baseline justify-between border-y border-ss-line py-1.5">
      <span className="text-[12px] font-bold text-ss-slate">Goal</span>
      <span className="text-[15px] font-extrabold text-ss-ink">Swing {config.swing} · {config.amps} A</span>
    </p>
    <div className="flex flex-col gap-1.5">
      <CurrentControl amps={amps} locked={locked} set={(n) => put({ amps: n })} />
      <Row label="Supply"><button type="button" aria-label="Reverse the supply" className={WIDE} disabled={locked} onClick={() => put({ supply: now.supply === -1 ? 1 : -1 })}>Reverse supply</button></Row>
      <Row label="Magnet poles"><button type="button" aria-label="Swap the north and south poles" className={WIDE} disabled={locked} onClick={() => put({ poles: now.poles === -1 ? 1 : -1 })}>Swap N and S</button></Row>
    </div>
    <span className="sr-only" aria-live="polite">{amps ? `The wire swings ${wireWay(config, now)} at ${amps} amperes.` : 'The wire hangs still.'}</span>
    <Verdict marked={marked} lines={lines} />
  </div>
}

export function motorCurrent(angle: number, contacts: Contacts): { dead: boolean; reversed: boolean } {
  return { dead: contacts === 'split' && angle % 2 === 1, reversed: contacts === 'split' && angle >= 2 && angle < FULL_TURN }
}

// The textbook view of the coil: field left to right, axle running towards the viewer (drawn down-left).
// x right, y up, z towards the viewer. Side A starts on the right; theta turns it anticlockwise as seen.
const CX = 180
const CY = 100
const R = 48
const HALF = 40
const view = (x: number, y: number, z: number): [number, number] => [CX + x - 0.42 * z, CY - y + 0.32 * z]
const COMM: [number, number] = view(0, 0, 120)

/** Which way the force on each coil side points (+1 up, -1 down, 0 none) at a coil angle in degrees. */
export function sideForces(theta: number, contacts: Contacts): { a: number; b: number } {
  if (contacts === 'slip') return { a: 1, b: -1 }
  const t = ((theta % 360) + 360) % 360
  // The split ring's gaps sit under the brushes while the coil is near upright: no current, no force.
  if (Math.abs(t - 90) < 9 || Math.abs(t - 270) < 9) return { a: 0, b: 0 }
  // Otherwise the side on the right always carries current towards the viewer and is pushed up.
  return Math.cos((t * Math.PI) / 180) > 0 ? { a: 1, b: -1 } : { a: -1, b: 1 }
}

/** The coil angle drawn, eased between quarter-turns; a slip-ring push swings past upright and back. */
function useTheta(target: number, pushes: number, contacts: Contacts, reduced: boolean): number {
  const [theta, setTheta] = useState(target)
  const from = useRef({ theta: target, pushes, contacts })
  useEffect(() => {
    const was = from.current
    from.current = { theta: target, pushes, contacts }
    const swing = contacts === 'slip' && (pushes !== was.pushes || (was.theta === 0 && target === 90))
    if (reduced || was.contacts !== contacts || (was.theta === target && !swing)) { setTheta(target); return }
    let raf = 0
    let start = 0
    const tick = (time: number) => {
      if (!start) start = time
      const t = Math.min(1, (time - start) / 1300)
      const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
      // Past upright the forces push back: the overshoot rises and dies away to upright.
      const over = swing ? 42 * Math.sin(Math.PI * Math.min(1, t * 1.25)) * Math.exp(-1.2 * t) : 0
      setTheta(was.theta + (target - was.theta) * eased + over)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, pushes, contacts, reduced])
  return theta
}

function CoilPicture({ theta, contacts }: { theta: number; contacts: Contacts }) {
  const rad = (theta * Math.PI) / 180
  const ax = R * Math.cos(rad)
  const ay = R * Math.sin(rad)
  const forces = sideForces(theta, contacts)
  const A0 = view(ax, ay, -HALF)
  const A1 = view(ax, ay, HALF)
  const B0 = view(-ax, -ay, -HALF)
  const B1 = view(-ax, -ay, HALF)
  // Force arrows sit towards each side's far end, clear of the contacts.
  const aMid = view(ax, ay, -30)
  const bMid = view(-ax, -ay, -30)
  const force = (p: [number, number], dir: number) => dir === 0 ? null
    : <Arrow x1={p[0]} y1={p[1] - dir * 6} x2={p[0]} y2={p[1] - dir * 33} width={2.8} />
  // Current runs towards the viewer on a side pushed up, away on a side pushed down.
  const current = (x: number, y: number, dir: number) => {
    if (dir === 0) return null
    const p = view(x, y, dir > 0 ? -6 : 30)
    const q = view(x, y, dir > 0 ? 30 : -6)
    return <Arrow x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} color={PAPER} width={1.6} />
  }
  const copper = (d: string) => <>
    <path d={d} fill="none" stroke={COPPER_EDGE} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />
    <path d={d} fill="none" stroke={COPPER} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
  </>
  const ring = (cx: number, cy: number) => <>
    <circle cx={cx} cy={cy} r={12} fill="none" stroke={COPPER_EDGE} strokeWidth={7} />
    <circle cx={cx} cy={cy} r={12} fill="none" stroke={COPPER} strokeWidth={4} />
  </>
  const arc = (from: number, to: number) => {
    const p = (deg: number) => [COMM[0] + 12 * Math.cos((deg * Math.PI) / 180), COMM[1] - 12 * Math.sin((deg * Math.PI) / 180)]
    const [x1, y1] = p(from)
    const [x2, y2] = p(to)
    return `M ${f(x1)} ${f(y1)} A 12 12 0 0 0 ${f(x2)} ${f(y2)}`
  }
  const slipA = view(0, 0, 108)
  const slipB = view(0, 0, 132)
  const ends = contacts === 'split'
    ? [[COMM[0] + 6 * Math.cos(rad), COMM[1] - 6 * Math.sin(rad)], [COMM[0] - 6 * Math.cos(rad), COMM[1] + 6 * Math.sin(rad)]]
    : [slipA, slipB]
  const back = view(0, 0, -HALF)
  return <g>
    {/* Axle, then the coil's far end. */}
    <line x1={back[0]} y1={back[1]} x2={COMM[0]} y2={COMM[1]} stroke="#94A3B8" strokeWidth={3} strokeLinecap="round" />
    {copper(`M ${f(A0[0])} ${f(A0[1])} L ${f(B0[0])} ${f(B0[1])}`)}
    {copper(`M ${f(B1[0])} ${f(B1[1])} L ${f(B0[0])} ${f(B0[1])}`)}
    {copper(`M ${f(A1[0])} ${f(A1[1])} L ${f(A0[0])} ${f(A0[1])}`)}
    {current(-ax, -ay, forces.b)}
    {current(ax, ay, forces.a)}
    {/* Leads from the coil's near ends to the contacts. */}
    <path d={`M ${f(A1[0])} ${f(A1[1])} L ${f(ends[0][0])} ${f(ends[0][1])} M ${f(B1[0])} ${f(B1[1])} L ${f(ends[1][0])} ${f(ends[1][1])}`} fill="none" stroke={COPPER_EDGE} strokeWidth={2} />
    {contacts === 'split' ? <g data-contacts-turn={Math.round(theta)}>
      <path d={arc(theta - 78, theta + 78)} fill="none" stroke={COPPER_EDGE} strokeWidth={8} />
      <path d={arc(theta + 102, theta + 258)} fill="none" stroke={COPPER_EDGE} strokeWidth={8} />
      <path d={arc(theta - 78, theta + 78)} fill="none" stroke={COPPER} strokeWidth={5} />
      <path d={arc(theta + 102, theta + 258)} fill="none" stroke={COPPER} strokeWidth={5} />
    </g> : <g data-contacts-turn={Math.round(theta)}>{ring(slipA[0], slipA[1])}{ring(slipB[0], slipB[1])}</g>}
    {/* Fixed carbon brushes press on the contacts from either side. */}
    <rect x={COMM[0] - 28} y={COMM[1] - 8} width={13} height={16} rx={2} fill={CARBON} stroke={INK} strokeWidth={1} />
    <rect x={COMM[0] + 15} y={COMM[1] - 8} width={13} height={16} rx={2} fill={CARBON} stroke={INK} strokeWidth={1} />
    <path d={`M ${COMM[0] - 22} ${COMM[1] + 8} V 214 H 150 M ${COMM[0] + 21} ${COMM[1] + 8} V 196 H 182 V 200`} fill="none" stroke={RUBBER} strokeWidth={2.5} strokeLinejoin="round" />
    {force(bMid, forces.b)}
    {force(aMid, forces.a)}
    <path d={`M ${COMM[0] - 40} ${COMM[1] + 36} L ${COMM[0] - 12} ${COMM[1] + 12}`} stroke={SOFT} strokeWidth={1} />
    <text x={COMM[0] - 42} y={COMM[1] + 46} textAnchor="end" fontFamily={FONT} fontSize={12} fontWeight={700} fill={SOFT}>{contacts === 'split' ? 'split ring' : 'slip rings'}</text>
  </g>
}

function MotorPicture({ state, reduced }: { state: MotorState; reduced: boolean }) {
  const angle = cleanAngle(state)
  const contacts = cleanContacts(state)
  const phase = motorCurrent(angle, contacts)
  const theta = useTheta(angle * 90, state.pushes ?? 0, contacts, reduced)
  const box = (x0: number, x1: number, fill: string, edge: string, letter: string) => {
    const P = (x: number, y: number, z: number) => view(x, y, z)
    const front = pts([P(x0, 48, 44), P(x1, 48, 44), P(x1, -48, 44), P(x0, -48, 44)])
    const top = pts([P(x0, 48, -44), P(x1, 48, -44), P(x1, 48, 44), P(x0, 48, 44)])
    const side = pts([P(x1, 48, -44), P(x1, -48, -44), P(x1, -48, 44), P(x1, 48, 44)])
    const c = P((x0 + x1) / 2, 0, 44)
    return <g stroke={edge} strokeWidth={1.5} strokeLinejoin="round">
      <polygon points={side} fill={edge} />
      <polygon points={top} fill={fill} fillOpacity={0.82} />
      <polygon points={front} fill={fill} />
      <text x={c[0]} y={c[1] + 7} textAnchor="middle" fontFamily={FONT} fontSize={19} fontWeight={800} fill={PAPER} stroke="none">{letter}</text>
    </g>
  }
  return <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`A single copper coil between a north pole on the left and a south pole on the right, its axle running towards you to ${contacts === 'split' ? 'a split ring' : 'two slip rings'} pressed by fixed carbon brushes. The coil has turned ${angle * 90} degrees. ${phase.dead ? 'Its split ring is at a gap under the brushes, so no current flows and it coasts.' : 'The force pushes the side on the right up and the side on the left down.'}`} className="block h-auto w-full select-none">
    <rect x={0.75} y={0.75} width={W - 1.5} height={H - 1.5} rx={16} fill={PLATE} stroke={PLATE_EDGE} strokeWidth={1.5} />
    {/* Field lines cross the gap behind the coil, from the N face to the S face. */}
    {[16, -30].map((y) => {
      const a = view(-82, y, -30)
      const b = view(50, y, -30)
      return <Arrow key={y} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} color="#A8B8C6" width={1.4} />
    })}
    {box(-140, -84, NORTH, NORTH_EDGE, 'N')}
    {box(84, 140, SOUTH, SOUTH_EDGE, 'S')}
    <CoilPicture theta={theta} contacts={contacts} />
    <rect x={150} y={200} width={66} height={28} rx={6} fill="#E2E8F0" stroke={SOFT} strokeWidth={1.5} />
    <text x={183} y={218} textAnchor="middle" fontFamily={FONT} fontSize={12} fontWeight={700} fill={INK}>d.c. supply</text>
    {/* Key: what the two kinds of arrow mean. */}
    <Arrow x1={240} y1={206} x2={262} y2={206} />
    <text x={268} y={210} textAnchor="start" fontFamily={FONT} fontSize={12} fontWeight={700} fill={SOFT}>force</text>
    <line x1={240} y1={224} x2={262} y2={224} stroke={COPPER} strokeWidth={6} strokeLinecap="round" />
    <Arrow x1={241} y1={224} x2={262} y2={224} color={PAPER} width={1.6} />
    <text x={268} y={228} textAnchor="start" fontFamily={FONT} fontSize={12} fontWeight={700} fill={SOFT}>coil current</text>
  </svg>
}

export function motorStage(angle: number, contacts: Contacts): string {
  const degrees = angle * 90
  if (angle === 0) return 'Start · 0°'
  if (angle >= FULL_TURN) return 'Full turn · 360°'
  if (contacts === 'slip') return `Quarter-turn · ${degrees}° · stops upright`
  const atGap = angle % 2 === 1
  const base = angle === 1 ? 'Quarter-turn' : angle === 2 ? 'Half-turn' : 'Three-quarter turn'
  return `${base} · ${degrees}°${atGap ? ' · contact gap' : ' · current reversed'}`
}

/** What is happening now, in plain words, under the picture. */
export function motorCaption(angle: number, contacts: Contacts, pushes: number): string {
  if (angle >= FULL_TURN) return 'A full turn: the split ring kept it going.'
  if (angle === 0) return 'Current flows: the forces push the right side up and the left side down.'
  if (contacts === 'slip') return pushes > 0 ? 'Pushed back again: the forces now pull it back to upright.' : 'Upright. Past here the forces push it back, so it stops.'
  if (angle % 2 === 1) return 'Upright: the gaps are under the brushes, so no current. It coasts on.'
  return 'The split ring has swapped the current: the forces still turn it the same way.'
}

const SEG = 'nodrag inline-flex h-7 select-none items-center justify-center whitespace-nowrap rounded-md px-2.5 text-[12px] font-extrabold touch-manipulation transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'

function MotorCard({ config, state, setState, marked, reduced, locked }: Props & { config: Extract<MotorConfig, { task: 'motor' }> }) {
  const now = marked === 'shown' ? motorEffectEngine.solve(config) : state
  const angle = cleanAngle(now)
  const contacts = cleanContacts(now)
  const pushes = now.pushes ?? 0
  const solved = marked === 'right' || marked === 'shown'
  const atEnd = angle >= FULL_TURN
  const pick = (next: Contacts) => { if (!locked && next !== contacts) setState({ contacts: next, angle: 0, pushes: 0 }) }
  const turn = () => { if (!locked && !atEnd) setState(nextMotorState(now)) }
  const lines = marked === 'idle' ? [] : motorFeedback(config, now, solved)
  return <div className="nodrag flex w-full max-w-[380px] flex-col gap-2" onKeyDown={keepArrows}>
    <figure className="m-0 flex w-full flex-col gap-1">
      <MotorPicture state={now} reduced={reduced} />
      <figcaption className="text-center text-[12px] font-bold text-ss-slate" aria-live="polite">{motorCaption(angle, contacts, pushes)}</figcaption>
    </figure>
    <p className="flex items-baseline justify-between border-y border-ss-line py-1.5">
      <span className="text-[12px] font-bold text-ss-slate">Coil turned</span>
      <span className="text-[15px] font-extrabold tabular-nums text-ss-ink">{angle * 90}° of 360°</span>
    </p>
    <div className="flex flex-col gap-1.5">
      <Row label="Contacts">
        <span role="group" aria-label="Contacts" className="inline-flex gap-1 rounded-lg border-2 border-ss-line p-0.5">
          {(['slip', 'split'] as const).map((c) => <button key={c} type="button" aria-pressed={contacts === c} disabled={locked} onClick={() => pick(c)}
            className={`${SEG} ${contacts === c ? 'bg-[color:var(--subject)] text-white' : 'bg-transparent text-ss-ink hover:bg-ss-line'}`}>{c === 'split' ? 'Split ring' : 'Slip rings'}</button>)}
        </span>
      </Row>
      <Row label="Coil"><button type="button" aria-label={atEnd ? 'The coil has made a full turn' : 'Turn the coil 90 degrees'} className={WIDE} disabled={locked || atEnd} onClick={turn}>Turn 90°</button></Row>
    </div>
    <span className="sr-only" aria-live="polite">{motorStage(angle, contacts)}.</span>
    <Verdict marked={marked} lines={lines} />
  </div>
}

function Verdict({ marked, lines }: { marked: SceneMarked; lines: string[] }) {
  if (marked === 'idle') return null
  return <div className="rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2" aria-live="polite">
    <p className="text-[13px] font-extrabold leading-snug text-ss-ink">{lines[0]}</p>
    {lines[1] && <p className="mt-0.5 text-[12px] font-semibold leading-snug text-ss-slate">{lines[1]}</p>}
  </div>
}

export function MotorEffectView(props: Props) {
  return props.config.task === 'wire'
    ? <WireCard {...props} config={props.config} />
    : <MotorCard {...props} config={props.config} />
}
