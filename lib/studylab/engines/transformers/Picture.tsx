import type { CSSProperties, ReactNode } from 'react'

/**
 * Transformers: the picture. A demountable school transformer on a bench: a laminated iron core (a U with a bar laid across
 * its top), a primary coil wound on the left limb and fed by a supply, a secondary coil wound on the right limb and wired to a
 * lamp with a voltmeter across it. Every turn of copper is drawn, so turns can be counted.
 *
 * The plate stays a quiet light panel in both themes, with everything drawn in its own material colours (iron grey, enamelled
 * copper, brass, plastic). One accent: the magnetic field line in the core. The lamp's light is the effect, not decoration.
 *
 * Pure: no hooks, no state, no clicks. Changes animate with CSS transitions; the a.c. field moves with SMIL. With `reduced`
 * every change jumps to its end frame and the field stands still.
 */
export interface PictureProps {
  /** What drives the primary coil. 'ac': a lab a.c. power pack, with its own current meter. 'dc': a battery pack of 1.5 V cells. */
  supply: 'ac' | 'dc'
  /** The supply's voltage in volts, printed on it. A battery is drawn as supplyVolts / 1.5 cells, so use 3, 6, 9 or 12 with 'dc'. */
  supplyVolts: number
  /** Turns on the primary coil, 1 to 12. Fixed for a task; drawn turn by turn and counted beside the coil. */
  primaryTurns: number
  /** Turns on the secondary coil, 1 to 12: the student's control. One more turn plays the signature motion (the turn winds on,
   *  then the lamp brightens and the needle swings). */
  secondaryTurns: number
  /** The lamp's rated voltage in volts, printed on its holder. */
  lampRating: number
  /** The lamp has blown: broken filament, smoked glass, no light. The builder sets it when the lamp's voltage reaches twice its
   *  rating, and clears it when a new lamp is fitted. The voltmeter still reads the secondary voltage. */
  blown?: boolean
  /** Reduced motion: every change jumps to its end frame and the field in the core stands still. */
  reduced?: boolean
}

/** Most turns either coil can hold. */
export const MAX_TURNS = 12

/** The secondary (lamp) voltage the picture shows: Vs = Vp x Ns / Np on a.c., nothing on d.c. */
export function secondaryVolts(p: Pick<PictureProps, 'supply' | 'supplyVolts' | 'primaryTurns' | 'secondaryTurns'>): number {
  return p.supply === 'ac' ? (p.supplyVolts * p.secondaryTurns) / p.primaryTurns : 0
}

const W = 376
const H = 266
const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif'
const PLATE = '#F8FAFC'
const PLATE_EDGE = '#CBD5E1'
const INK = '#334155'
const LEADER = '#64748B'
/** The one accent: the magnetic field in the core. */
const FIELD = '#0E7490'
// Laminated soft iron: a pale steel front sheet, the stack of sheet edges seen on the top and side faces.
const IRON = { front: '#AEB7C1', edge: '#56616E', top: '#CDD4DB', side: '#8F99A5', inner: '#7E8894', innerTop: '#BEC6CE', sheet: '#5E6976', lit: '#C6CDD4' }
// Enamelled copper: bright where it crosses the front, darker where it comes round from behind.
const CU = { front: '#C98446', back: '#99592B', edge: '#6B3816', shine: '#F1BE88', lead: '#C47E42' }
const BRASS = '#C9A54B'
const BRASS_EDGE = '#7D6526'

// The core, front face: outer box and the window. Depth runs up and to the right by (DX, DY).
const X0 = 118
const X1 = 258
const Y0 = 46
const Y1 = 226
const T = 26
const WX0 = X0 + T
const WX1 = X1 - T
const WY0 = Y0 + T
const WY1 = Y1 - T
const DX = 8
const DY = -7
// The coils: each turn is an ellipse round its limb, front half over the iron, back half behind it, sloping by one pitch.
const TOP = 78
const PITCH = 9.6
const RX = 21
const RY = 6.5
const LCX = (X0 + WX0) / 2 + DX / 2
const RCX = (WX1 + X1) / 2 + DX / 2
const LL = LCX - RX
const RR = RCX + RX
// The circuit on the right: the lamp, the voltmeter, the rails and the return wire.
const LAMP = { x: 330, y: 56 }
const RAIL_L = 292
const RAIL_R = 366
const RETURN_Y = 252
const STUB_X = 282
const METER = { x0: 300, y0: 146, x1: 360, y1: 210, px: 330, py: 185, r: 24 }
const PACK = { px: 42, py: 121, r: 22 }

const f = (n: number) => Number(n.toFixed(2))
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
const rad = (d: number) => (d * Math.PI) / 180
const endY = (turns: number) => TOP + turns * PITCH

function hex(c: string): number[] {
  const n = parseInt(c.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
function mix(a: string, b: string, t: number): string {
  const A = hex(a)
  const B = hex(b)
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * clamp(t, 0, 1)).toString(16).padStart(2, '0')).join('')
}
/** Filament colour by power as a share of the rated power: cold grey, dull red, orange, warm white, white hot. */
const FILAMENT: [number, string][] = [[0, '#8A8F98'], [0.04, '#7F1D1D'], [0.2, '#C2410C'], [0.55, '#F59E0B'], [1, '#FEF3C7'], [1.8, '#FFFFFF']]
function filament(p: number): string {
  if (p <= 0) return FILAMENT[0][1]
  for (let i = 1; i < FILAMENT.length; i++) {
    const [p1, c1] = FILAMENT[i]
    const [p0, c0] = FILAMENT[i - 1]
    if (p <= p1) return mix(c0, c1, (p - p0) / (p1 - p0))
  }
  return FILAMENT[FILAMENT.length - 1][1]
}

/** One turn's front and back halves. The left coil starts at its left end, the right coil at its right end. */
function turn(side: 'L' | 'R', i: number): { front: string; back: string } {
  const y = TOP + i * PITCH
  const h = PITCH / 2
  if (side === 'L') {
    const a = LCX - RX
    const b = LCX + RX
    return { front: `M${f(a)} ${f(y)} A${RX} ${RY} 0 0 0 ${f(b)} ${f(y + h)}`, back: `M${f(b)} ${f(y + h)} A${RX} ${RY} 0 0 0 ${f(a)} ${f(y + PITCH)}` }
  }
  const a = RCX + RX
  const b = RCX - RX
  return { front: `M${f(a)} ${f(y)} A${RX} ${RY} 0 0 1 ${f(b)} ${f(y + h)}`, back: `M${f(b)} ${f(y + h)} A${RX} ${RY} 0 0 1 ${f(a)} ${f(y + PITCH)}` }
}

/** How a turn appears and goes: it winds on (front half, then back half) and unwinds the other way round. */
function turnStyle(shown: boolean, part: 'front' | 'back', reduced: boolean): CSSProperties {
  const delay = shown ? (part === 'front' ? 0 : 210) : part === 'back' ? 0 : 190
  return {
    strokeDasharray: '100 100',
    strokeDashoffset: shown ? 0 : 100,
    opacity: shown ? 1 : 0,
    transition: reduced
      ? 'none'
      : shown
        ? `stroke-dashoffset 230ms ease-out ${delay}ms, opacity 0ms linear ${delay}ms`
        : `stroke-dashoffset 210ms ease-in ${delay}ms, opacity 0ms linear ${delay + 210}ms`,
  }
}

function CoilHalf({ side, turns, part, reduced, live }: { side: 'L' | 'R'; turns: number; part: 'front' | 'back'; reduced: boolean; live: boolean }) {
  const slots = live ? MAX_TURNS : turns
  const body = part === 'front' ? CU.front : CU.back
  return (
    <g fill="none" strokeLinecap="round">
      {Array.from({ length: slots }, (_, i) => {
        const d = turn(side, i)[part]
        const st = turnStyle(i < turns, part, reduced)
        return (
          <g key={i}>
            <path d={d} pathLength={100} stroke={CU.edge} strokeWidth={5.2} style={st} />
            <path d={d} pathLength={100} stroke={body} strokeWidth={3.7} style={st} />
            {part === 'front' && <path d={d} pathLength={100} stroke={CU.shine} strokeWidth={1.2} transform="translate(0 -1.1)" style={{ ...st, opacity: (st.opacity as number) * 0.85 }} />}
          </g>
        )
      })}
    </g>
  )
}

function Wire({ d, cap = 'round', style }: { d: string; cap?: 'round' | 'butt'; style?: CSSProperties }) {
  return (
    <g fill="none" strokeLinejoin="round" strokeLinecap={cap} style={style}>
      <path d={d} stroke={CU.edge} strokeWidth={3.4} />
      <path d={d} stroke={CU.lead} strokeWidth={2} />
    </g>
  )
}

const Dot = ({ x, y }: { x: number; y: number }) => <circle cx={x} cy={y} r={2.7} fill={CU.edge} />

function Label({ x, y, anchor = 'start', children }: { x: number; y: number; anchor?: 'start' | 'middle' | 'end'; children: ReactNode }) {
  return (
    <text x={x} y={y} fontSize={12} fontWeight={600} fill={INK} fontFamily={FONT} textAnchor={anchor}>
      {children}
    </text>
  )
}

function Leader({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={LEADER} strokeWidth={1} />
      <circle cx={x2} cy={y2} r={1.7} fill={LEADER} />
    </g>
  )
}

/** A meter's scale arc and ticks about a pivot, from -50 to +50 degrees. */
function Scale({ px, py, r, ticks }: { px: number; py: number; r: number; ticks: number }) {
  const at = (deg: number, rr: number) => ({ x: px + rr * Math.sin(rad(deg)), y: py - rr * Math.cos(rad(deg)) })
  const a = at(-50, r)
  const b = at(50, r)
  return (
    <g stroke="#475569" fill="none">
      <path d={`M${f(a.x)} ${f(a.y)} A${r} ${r} 0 0 1 ${f(b.x)} ${f(b.y)}`} strokeWidth={1} />
      {Array.from({ length: ticks }, (_, i) => {
        const deg = -50 + (100 * i) / (ticks - 1)
        const major = i === 0 || i === ticks - 1 || i === (ticks - 1) / 2
        const p = at(deg, r)
        const q = at(deg, r - (major ? 4.5 : 2.8))
        return <line key={i} x1={f(p.x)} y1={f(p.y)} x2={f(q.x)} y2={f(q.y)} strokeWidth={major ? 1.2 : 0.9} />
      })}
    </g>
  )
}

function Needle({ px, py, len, frac, reduced, delay }: { px: number; py: number; len: number; frac: number; reduced: boolean; delay: number }) {
  const deg = -50 + 100 * clamp(frac, 0, 1)
  return (
    <g>
      <g style={{ transform: `rotate(${f(deg)}deg)`, transformBox: 'view-box', transformOrigin: `${px}px ${py}px`, transition: reduced ? 'none' : `transform 520ms cubic-bezier(.3,.7,.3,1) ${delay}ms` }}>
        <line x1={px} y1={py} x2={px} y2={py - len} stroke="#B42318" strokeWidth={1.4} strokeLinecap="round" />
      </g>
      <circle cx={px} cy={py} r={2.4} fill="#334155" />
    </g>
  )
}

function PowerPack({ volts, frac, reduced }: { volts: number; frac: number; reduced: boolean }) {
  return (
    <g>
      <rect x={10} y={84} width={76} height={100} rx={6} fill="#E7E1D3" stroke="#8C8473" strokeWidth={1.2} />
      <path d="M15 86 H81" stroke="#F7F3EA" strokeWidth={1.4} />
      <rect x={17} y={91} width={50} height={35} rx={3} fill="#5B6472" />
      <rect x={19.5} y={93.5} width={45} height={30} rx={2} fill="#FFFFFF" />
      <Scale px={PACK.px} py={PACK.py} r={PACK.r - 3} ticks={9} />
      <Needle px={PACK.px} py={PACK.py} len={PACK.r - 4} frac={frac} reduced={reduced} delay={200} />
      <Label x={42} y={141} anchor="middle">A</Label>
      <Label x={41} y={162} anchor="middle">{`${volts} V a.c.`}</Label>
      <circle cx={76} cy={106} r={5} fill="#B42318" stroke="#7A1A12" />
      <circle cx={76} cy={106} r={1.8} fill="#2B1210" />
      <circle cx={76} cy={172} r={5} fill="#1F2937" stroke="#0B1220" />
      <circle cx={76} cy={172} r={1.8} fill="#000000" />
    </g>
  )
}

function BatteryPack({ volts }: { volts: number }) {
  const n = clamp(Math.round(volts / 1.5), 1, 8)
  const cols = n > 4 ? 2 : 1
  const rows = Math.ceil(n / cols)
  const pitch = 76 / rows
  const h = Math.min(13, pitch - 5)
  const w = cols === 1 ? 46 : 21
  return (
    <g>
      <Label x={46} y={90} anchor="middle">{`${volts} V battery`}</Label>
      <rect x={12} y={96} width={68} height={88} rx={4} fill="#374151" stroke="#1E2530" />
      <rect x={16} y={100} width={60} height={80} rx={2} fill="#A3AAB5" />
      {Array.from({ length: n }, (_, k) => {
        const row = k % rows
        const col = Math.floor(k / rows)
        const cy = 102 + pitch * row + pitch / 2
        const x = cols === 1 ? 22 : 21 + col * 28
        const plusRight = (row + col) % 2 === 0
        const band = w * 0.42
        return (
          <g key={k}>
            <rect x={x} y={cy - h / 2} width={w} height={h} rx={2.5} fill="#1F2937" />
            <rect x={plusRight ? x + w - band : x} y={cy - h / 2} width={band} height={h} rx={2.5} fill={CU.front} />
            <rect x={plusRight ? x + w : x - 2.5} y={cy - 2.5} width={2.5} height={5} rx={1} fill="#D5DAE1" stroke="#7B8591" strokeWidth={0.6} />
            <path d={`M${x + 2} ${cy - h / 2 + 2.2} H${x + w - 2}`} stroke="#FFFFFF" strokeOpacity={0.25} strokeWidth={1.2} />
          </g>
        )
      })}
      <rect x={72} y={102.5} width={9} height={7} rx={1.5} fill="#B42318" />
      <rect x={72} y={168.5} width={9} height={7} rx={1.5} fill="#111827" />
    </g>
  )
}

function Lamp({ volts, rating, blown, reduced }: { volts: number; rating: number; blown: boolean; reduced: boolean }) {
  const r = rating > 0 ? volts / rating : 0
  const p = blown ? 0 : r * r
  const g = clamp(p, 0, 2.2)
  const t = (props: string) => (reduced ? 'none' : `${props} 480ms ease 180ms`)
  const { x, y } = LAMP
  const glass = `M${x - 6.5} ${y + 21} C${x - 6.5} ${y + 15} ${x - 16} ${y + 12} ${x - 16} ${y} A16 16 0 1 1 ${x + 16} ${y} C${x + 16} ${y + 12} ${x + 6.5} ${y + 15} ${x + 6.5} ${y + 21} Z`
  const coil = `M${x - 5.5} ${y + 1} q1.4 -3.2 2.75 0 q1.4 3.2 2.75 0 q1.4 -3.2 2.75 0 q1.4 3.2 2.75 0`
  return (
    <g>
      <g style={{ opacity: clamp(g * 0.75, 0, 0.95), transform: `scale(${f(0.5 + 0.3 * g)})`, transformBox: 'view-box', transformOrigin: `${x}px ${y}px`, transition: t('opacity') + ', ' + t('transform') }}>
        <circle cx={x} cy={y} r={42} fill="url(#tf-glow)" />
      </g>
      {/* glass, then its warm light, the glass stem and the filament on its two support wires */}
      <path d={glass} fill="#E8EEF3" fillOpacity={0.6} />
      <path d={glass} fill="#FFF1B8" style={{ opacity: clamp(p, 0, 1) * 0.85, transition: t('opacity') }} />
      <path d={`M${x - 3} ${y + 21} L${x - 2} ${y + 13} H${x + 2} L${x + 3} ${y + 21} Z`} fill="#FFFFFF" fillOpacity={0.55} stroke="#A7B4C2" strokeWidth={0.6} />
      <path d={`M${x - 4} ${y + 21} L${x - 5.5} ${y + 1} M${x + 4} ${y + 21} L${x + 5.5} ${y + 1}`} stroke="#8A8F98" strokeWidth={0.8} fill="none" />
      <g style={{ opacity: blown ? 0 : 1, transition: reduced ? 'none' : 'opacity 120ms' }}>
        <path d={coil} fill="none" strokeWidth={1.4} strokeLinecap="round" style={{ stroke: filament(p), transition: t('stroke') }} />
        <circle cx={x} cy={y + 0.5} r={8} fill="url(#tf-hot)" style={{ opacity: clamp((p - 1.1) / 0.7, 0, 1), transition: t('opacity') }} />
      </g>
      <g style={{ opacity: blown ? 1 : 0, transition: reduced ? 'none' : 'opacity 300ms' }}>
        <ellipse cx={x} cy={y - 8} rx={11} ry={6.5} fill="#475569" fillOpacity={0.32} />
        <path d={`M${x - 5.5} ${y + 1} q1.4 -3.2 2.75 0 l0.7 3.8 M${x + 5.5} ${y + 1} q-1.4 3.2 -2.75 0 l-0.5 3.4`} fill="none" stroke="#4B5563" strokeWidth={1.5} strokeLinecap="round" />
      </g>
      <path d={glass} fill="none" stroke="#8B9AAB" strokeWidth={1.2} />
      <path d={`M${x - 11.5} ${y - 6} A12 12 0 0 1 ${x - 4} ${y - 13.5}`} fill="none" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeOpacity={0.85} />
      {/* the cap with its thread, the holder and its base with the lamp's rating and two terminal screws */}
      <rect x={x - 7.5} y={y + 20} width={15} height={12} rx={1.5} fill="#C3C9D0" stroke="#6B7280" strokeWidth={0.8} />
      <path d={`M${x - 7.5} ${y + 23.5} l15 -1.5 M${x - 7.5} ${y + 27} l15 -1.5 M${x - 7.5} ${y + 30.5} l15 -1.5`} stroke="#8D96A0" strokeWidth={0.8} />
      <rect x={x - 11} y={y + 30} width={22} height={8} rx={1.5} fill="#3B4452" />
      <rect x={x - 26} y={y + 37} width={52} height={18} rx={3} fill="#475569" stroke="#334155" />
      <text x={x} y={y + 50} fontSize={12} fontWeight={600} fill="#F1F5F9" fontFamily={FONT} textAnchor="middle">{`${rating} V`}</text>
      <circle cx={x - 23} cy={y + 46} r={2.2} fill={BRASS} stroke={BRASS_EDGE} strokeWidth={0.6} />
      <circle cx={x + 23} cy={y + 46} r={2.2} fill={BRASS} stroke={BRASS_EDGE} strokeWidth={0.6} />
    </g>
  )
}

function Voltmeter({ frac, reduced }: { frac: number; reduced: boolean }) {
  const m = METER
  return (
    <g>
      <rect x={m.x0} y={m.y0} width={m.x1 - m.x0} height={m.y1 - m.y0} rx={5} fill="#E2E8F0" stroke="#64748B" strokeWidth={1.1} />
      <rect x={m.x0 + 6} y={m.y0 + 6} width={m.x1 - m.x0 - 12} height={36} rx={2} fill="#FFFFFF" stroke="#94A3B8" strokeWidth={0.9} />
      <Scale px={m.px} py={m.py} r={m.r} ticks={11} />
      <Needle px={m.px} py={m.py} len={m.r - 3} frac={frac} reduced={reduced} delay={200} />
      <Label x={m.px} y={m.y1 - 7} anchor="middle">V</Label>
      <circle cx={m.x0} cy={196} r={2.4} fill={BRASS} stroke={BRASS_EDGE} strokeWidth={0.6} />
      <circle cx={m.x1} cy={196} r={2.4} fill={BRASS} stroke={BRASS_EDGE} strokeWidth={0.6} />
    </g>
  )
}

/** The field line round the middle of the core, drawn clockwise from the middle of the top bar. */
const FIELD_PATH = (() => {
  const l = (X0 + WX0) / 2
  const r = (WX1 + X1) / 2
  const t = (Y0 + WY0) / 2
  const b = (WY1 + Y1) / 2
  const k = 14
  const m = (X0 + X1) / 2
  return `M${m} ${t} H${r - k} A${k} ${k} 0 0 1 ${r} ${t + k} V${b - k} A${k} ${k} 0 0 1 ${r - k} ${b} H${l + k} A${k} ${k} 0 0 1 ${l} ${b - k} V${t + k} A${k} ${k} 0 0 1 ${l + k} ${t} Z`
})()

function Chevrons({ clockwise }: { clockwise: boolean }) {
  const m = (X0 + X1) / 2
  const t = (Y0 + WY0) / 2
  const b = (WY1 + Y1) / 2
  const s = clockwise ? 1 : -1
  return (
    <g fill="none" stroke={FIELD} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d={`M${m - 3 * s} ${t - 4} L${m + 2 * s} ${t} L${m - 3 * s} ${t + 4}`} />
      <path d={`M${m + 3 * s} ${b - 4} L${m - 2 * s} ${b} L${m + 3 * s} ${b + 4}`} />
    </g>
  )
}

function Field({ moving }: { moving: boolean }) {
  const cycle = '2.4s'
  return (
    <g>
      <path d={FIELD_PATH} fill="none" stroke={FIELD} strokeWidth={1.8} strokeDasharray="7 5" strokeOpacity={0.9}>
        {moving && (
          <animate attributeName="stroke-dashoffset" values="0;-12;0" keyTimes="0;0.5;1" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1" dur={cycle} repeatCount="indefinite" />
        )}
      </path>
      <g>
        {moving && <animate attributeName="opacity" values="1;1;0;0;1" keyTimes="0;0.42;0.5;0.92;1" dur={cycle} repeatCount="indefinite" />}
        <Chevrons clockwise />
      </g>
      {moving && (
        <g opacity={0}>
          <animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;0.42;0.5;0.92;1" dur={cycle} repeatCount="indefinite" />
          <Chevrons clockwise={false} />
        </g>
      )}
    </g>
  )
}

function Core() {
  const n = 6
  const sheets = Array.from({ length: n - 1 }, (_, i) => (i + 1) / n)
  const at = (x: number, y: number, k: number) => `${f(x + DX * k)} ${f(y + DY * k)}`
  return (
    <g strokeLinejoin="round">
      {/* top and outer side faces: the edges of the stacked iron sheets */}
      <path d={`M${X0} ${Y0} L${at(X0, Y0, 1)} L${at(X1, Y0, 1)} L${X1} ${Y0} Z`} fill={IRON.top} stroke={IRON.edge} strokeWidth={1} />
      <path d={`M${X1} ${Y0} L${at(X1, Y0, 1)} L${at(X1, Y1, 1)} L${X1} ${Y1} Z`} fill={IRON.side} stroke={IRON.edge} strokeWidth={1} />
      {/* inside the window: the left limb's inner side and the top of the bottom bar */}
      <path d={`M${WX0} ${WY0} L${at(WX0, WY0, 1)} L${at(WX0, WY1, 1)} L${WX0} ${WY1} Z`} fill={IRON.inner} />
      <path d={`M${WX0} ${WY1} L${at(WX0, WY1, 1)} L${at(WX1, WY1, 1)} L${WX1} ${WY1} Z`} fill={IRON.innerTop} />
      <g stroke={IRON.sheet} strokeWidth={0.7} strokeOpacity={0.6}>
        {sheets.map((k) => (
          <g key={k}>
            <path d={`M${at(X0, Y0, k)} L${at(X1, Y0, k)}`} />
            <path d={`M${at(X1, Y0, k)} L${at(X1, Y1, k)}`} />
            <path d={`M${at(WX0, WY0, k)} L${at(WX0, WY1, k)}`} />
            <path d={`M${at(WX0, WY1, k)} L${at(WX1, WY1, k)}`} />
          </g>
        ))}
      </g>
      {/* the front sheet, with the window cut out */}
      <path d={`M${X0} ${Y0} H${X1} V${Y1} H${X0} Z M${WX0} ${WY0} V${WY1} H${WX1} V${WY0} Z`} fill={IRON.front} fillRule="evenodd" stroke={IRON.edge} strokeWidth={1.1} />
      {/* bevel light on the top and left edges, and the joints where the top bar sits on the U */}
      <path d={`M${X0 + 1.5} ${Y1 - 2} V${Y0 + 1.5} H${X1 - 2} M${WX1 - 1.5} ${WY0 + 2} V${WY1 - 1.5} H${WX0 + 2}`} fill="none" stroke={IRON.lit} strokeWidth={1.2} />
      <path d={`M${X0} ${WY0} H${WX0} M${WX1} ${WY0} H${X1} L${at(X1, WY0, 1)}`} fill="none" stroke={IRON.edge} strokeWidth={0.9} strokeOpacity={0.8} />
    </g>
  )
}

export default function Picture(props: PictureProps) {
  const { supply, supplyVolts, lampRating } = props
  const np = clamp(Math.round(props.primaryTurns), 1, MAX_TURNS)
  const ns = clamp(Math.round(props.secondaryTurns), 1, MAX_TURNS)
  const blown = !!props.blown
  const reduced = !!props.reduced
  const vs = secondaryVolts({ supply, supplyVolts, primaryTurns: np, secondaryTurns: ns })
  const power = blown ? 0 : (vs / (lampRating || 1)) ** 2
  // The voltmeter's full scale is what all twelve turns would give, so the needle steps the same way for every turn.
  const meterFrac = supply === 'ac' ? ns / MAX_TURNS : 0
  // Power in = power out: the supply's own meter shows the current it gives, a quarter of the scale for the lamp's rated power.
  const packFrac = clamp(power / 4, 0, 1)
  const yP = endY(np)
  const yS = endY(ns)
  const move = reduced ? 'none' : 'transform 440ms cubic-bezier(.3,.7,.3,1)'
  const k = (RETURN_Y - yS) / (RETURN_Y - TOP)
  const fade = reduced ? 'none' : 'opacity 380ms ease'

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="A transformer: a primary and a secondary coil on a laminated iron core, with a lamp and a voltmeter on the secondary">
      <defs>
        <radialGradient id="tf-glow">
          <stop offset="0" stopColor="#FFF7D6" stopOpacity="0.95" />
          <stop offset="0.3" stopColor="#FDE68A" stopOpacity="0.55" />
          <stop offset="0.65" stopColor="#FCD34D" stopOpacity="0.18" />
          <stop offset="1" stopColor="#FCD34D" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="tf-hot">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="1" />
          <stop offset="0.6" stopColor="#FFFFFF" stopOpacity="0.6" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
        <clipPath id="tf-plate">
          <rect x={0.5} y={0.5} width={W - 1} height={H - 1} rx={10} />
        </clipPath>
      </defs>
      <rect x={0.5} y={0.5} width={W - 1} height={H - 1} rx={10} fill={PLATE} stroke={PLATE_EDGE} />
      <g clipPath="url(#tf-plate)">
        {/* the supply: a.c. power pack or battery, cross-faded in the same place */}
        <g style={{ opacity: supply === 'ac' ? 1 : 0, transition: fade }}>
          <PowerPack volts={supplyVolts} frac={packFrac} reduced={reduced} />
        </g>
        <g style={{ opacity: supply === 'dc' ? 1 : 0, transition: fade }}>
          <BatteryPack volts={supplyVolts} />
        </g>

        {/* primary leads */}
        <Wire d={`M76 106 H100 V${TOP} H${f(LL)}`} />
        <Wire d={`M76 172 H104 V${f(yP)} H${f(LL)}`} />
        {/* secondary leads: the start of the winding to the lamp and meter; the end follows the last turn down */}
        <Wire d={`M${f(RR)} ${TOP} H${RAIL_L} V196 H${METER.x0}`} />
        <Wire d={`M${RAIL_L} ${LAMP.y + 46} H${LAMP.x - 26}`} />
        <Wire d={`M${STUB_X} ${RETURN_Y} H${RAIL_R} V${LAMP.y + 46} H${LAMP.x + 26}`} />
        <Wire d={`M${METER.x1} 196 H${RAIL_R}`} />
        <Wire d={`M${STUB_X} ${RETURN_Y} V${TOP}`} cap="butt" style={{ transform: `scaleY(${f(k)})`, transformBox: 'view-box', transformOrigin: `${STUB_X}px ${RETURN_Y}px`, transition: move }} />
        <Wire d={`M${f(RR)} ${TOP} H${STUB_X}`} style={{ transform: `translateY(${f(yS - TOP)}px)`, transition: move }} />
        <Dot x={RAIL_L} y={LAMP.y + 46} />
        <Dot x={RAIL_R} y={196} />

        {/* coils behind the iron, the core, the field, coils in front */}
        <CoilHalf side="L" turns={np} part="back" reduced={reduced} live={false} />
        <CoilHalf side="R" turns={ns} part="back" reduced={reduced} live />
        <Core />
        <Field moving={supply === 'ac' && !reduced} />
        <CoilHalf side="L" turns={np} part="front" reduced={reduced} live={false} />
        <CoilHalf side="R" turns={ns} part="front" reduced={reduced} live />

        <Lamp volts={vs} rating={lampRating} blown={blown} reduced={reduced} />
        <Voltmeter frac={meterFrac} reduced={reduced} />

        {/* labels */}
        <Label x={(X0 + X1) / 2} y={22} anchor="middle">laminated iron core</Label>
        <Leader x1={(X0 + X1) / 2} y1={27} x2={(X0 + X1) / 2} y2={Y0 - 3.5} />
        <Label x={163} y={94}>primary</Label>
        <Label x={163} y={109}>{`${np} ${np === 1 ? 'turn' : 'turns'}`}</Label>
        <Label x={221} y={158} anchor="end">secondary</Label>
        <Label x={221} y={173} anchor="end">{`${ns} ${ns === 1 ? 'turn' : 'turns'}`}</Label>
        <Label x={(X0 + X1) / 2} y={256} anchor="middle">magnetic field</Label>
        <Leader x1={200} y1={245} x2={211} y2={(WY1 + Y1) / 2} />
      </g>
    </svg>
  )
}
