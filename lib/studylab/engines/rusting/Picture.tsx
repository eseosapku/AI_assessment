import type { CSSProperties } from 'react'

// A nail in a boiling tube, drawn as the real thing. The student sets what reaches the nail (water, air) or how it is
// protected (paint, grease, zinc, a magnesium strip, with or without a scratch); then a week passes, day by day, and rust
// creeps in exactly where water and air both reach bare iron. Nothing else moves.
//
// The plate is light in both themes (as skeleton-muscles does): glass, water, oil and metal keep their own colours.
// Flat colours only. Rust is the one accent; everything else is calm grey, glass blue, oil amber, paint green.

/** What liquid the nail sits in. 'none' = no water at all (dry air with a drying agent, or a tube of oil). */
export type Water = 'none' | 'tap' | 'salt'
/** Whether air can reach the nail. With water, 'out' is boiled water under a layer of oil; with no water, 'out' is a tube of oil and 'in' is dry air, stoppered. */
export type Air = 'in' | 'out'
/** What protects the nail. 'magnesium' is a strip wrapped round a bare nail, not a coat. */
export type Protection = 'none' | 'paint' | 'grease' | 'zinc' | 'magnesium'

export interface PictureProps {
  /** The liquid round the nail. For the protect kind always 'tap'. */
  water: Water
  /** Whether air reaches the nail. For the protect kind always 'in'. */
  air: Air
  /** How the nail is protected. Default 'none' (a bare steel nail). */
  protection?: Protection
  /** A scratch across the nail, through any coat. Drawing it in plays a short stroke. Default false. */
  scratched?: boolean
  /** Days left in the tube, 0 to 7. The View steps it 0, 1, ... 7 every DAY_MS while the week plays; rust grows smoothly between steps. THIS is the signature motion. */
  day: number
  /** Reduced motion: no transitions; every change jumps to its end frame. */
  reduced?: boolean
}

/** How long the View should hold each day while the week plays (7 steps, about 2.5 s). */
export const DAY_MS = 360
export const WEEK = 7

// --- colours -----------------------------------------------------------------------------------------------------
const PLATE = '#F8FAFC'
const PLATE_EDGE = '#CBD5E1'
const SOFT = '#475569'
const LEAD = '#64748B'
const FONT = 'system-ui, sans-serif'
const GLASS_IN = '#EDF3F7'
const GLASS = '#D7E2EA'
const GLASS_EDGE = '#8EA3B5'
const GLASS_INNER = '#B7C6D2'
const WATER = '#D4E7F3'
const WATER_TOP = '#E8F2F9'
const WATER_EDGE = '#93B8D1'
const OIL = '#EDCF80'
const OIL_TOP = '#F6E1A6'
const OIL_EDGE = '#B98F32'
// Rust: the accent. Orange-brown, darker where it is thick, paler where it is a thin stain.
const RUST = '#A8552B'
const RUST_DARK = '#6E3518'
const RUST_LIGHT = '#C47A45'
const RUST_STAIN = '#D08A4A'
// Metals and coats.
const STEEL = { fill: '#9AA2AA', light: '#C9CFD5', shade: '#7B838B', edge: '#4F575F', top: '#B5BCC3', mark: '#6C747C' }
const PAINT = { fill: '#55806A', light: '#79A38C', shade: '#42664F', edge: '#2C4A39', top: '#6A957E', mark: '#476B55' }
const ZINC = { fill: '#B7C0C8', light: '#D9DFE4', shade: '#98A3AD', edge: '#6A7580', top: '#CBD2D8', mark: '#A2ACB5' }
const GREASE = '#D0A94B'
const GREASE_EDGE = '#A2791F'
const SCRATCH_BRIGHT = '#E3E7EA'
const SCRATCH_LIP = '#4A5159'
const WHITE_CRUST = '#F4F2EC'
const WHITE_CRUST_EDGE = '#BDB9AE'
const MG = '#DCE1E5'
const MG_EDGE = '#6F7882'
const MG_BACK = '#A9B1B8'
const RUBBER = '#4C5158'
const RUBBER_TOP = '#5E646C'
const RUBBER_EDGE = '#2E3238'
const WOOL = '#FCFCFB'
const WOOL_EDGE = '#C3C9CF'
const GRAIN = '#F3F4F5'
const GRAIN_DARK = '#DADDE1'
const GRAIN_EDGE = '#A3AAB2'

// --- geometry ----------------------------------------------------------------------------------------------------
const W = 376
const H = 300
const CX = 188
/** A boiling tube: walls from the rim (y 30) down to 235, then a round bottom; inner radius 46, glass 3 thick. */
const RIM = 30
const ARC_Y = 235
const LEVEL = 92 // the liquid surface
const OIL_TOP_Y = 79 // top of the oil layer floated on boiled water
/** The nail rests point-down on the bottom of the tube, or on the cotton wool in the dry tube. */
const NAIL_Y_WET = 115
const NAIL_Y_DRY = 69
const SCRATCH = { x1: -8.8, y1: 71, x2: 8.8, y2: 82.5 }
/** The patch tables below were laid out on a 14 x 153 nail; these stretch them onto the 16 x 165 nail drawn. */
const nx = (x: number) => (x * 8) / 7
const ny = (y: number) => (y <= 8.4 ? y : 8.4 + ((y - 8.4) * 156.6) / 144.6)

type P = { x: number; y: number }
const f1 = (n: number) => (Math.round(n * 10) / 10).toString()
const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
const ramp = (day: number, t0: number, t1: number) => clamp01((day - t0) / (t1 - t0))
const rnd = (seed: number) => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

/** A smooth closed outline through the points (Catmull-Rom as cubic Beziers). */
function smooth(pts: P[]): string {
  const n = pts.length
  const at = (i: number) => pts[(i + n) % n]
  let d = `M${f1(pts[0].x)} ${f1(pts[0].y)}`
  for (let i = 0; i < n; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2)
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 }
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 }
    d += ` C${f1(c1.x)} ${f1(c1.y)} ${f1(c2.x)} ${f1(c2.y)} ${f1(p2.x)} ${f1(p2.y)}`
  }
  return d + 'Z'
}

/** An irregular rounded patch: a rust bloom, a crust, a granule. */
function blob(cx: number, cy: number, rx: number, ry: number, seed: number, n = 9, j = 0.28): string {
  const pts: P[] = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (rnd(seed + i * 3.1) - 0.5) * 0.5
    const r = 1 + (rnd(seed + i * 7.7) - 0.5) * 2 * j
    pts.push({ x: cx + Math.cos(a) * rx * r, y: cy + Math.sin(a) * ry * r })
  }
  return smooth(pts)
}

const liquid = (top: number) => `M142 ${top} L142 ${ARC_Y} A46 46 0 0 0 234 ${ARC_Y} L234 ${top} Z`
const TUBE_WALL =
  `M139 ${RIM} L139 ${ARC_Y} A49 49 0 0 0 237 ${ARC_Y} L237 ${RIM} L234 ${RIM} L234 ${ARC_Y} A46 46 0 0 1 142 ${ARC_Y} L142 ${RIM} Z`
const TUBE_OUT = `M139 ${RIM} L139 ${ARC_Y} A49 49 0 0 0 237 ${ARC_Y} L237 ${RIM}`
const TUBE_IN = `M142 ${RIM} L142 ${ARC_Y} A46 46 0 0 0 234 ${ARC_Y} L234 ${RIM}`

// The nail, in its own units: head top at y 0, centre line x 0, shank 16 wide, point at y 165.
const HEAD_D = 'M-19 2.8 A19 2.8 0 0 1 19 2.8 L19 6.6 A19 2.8 0 0 1 -19 6.6 Z'
const POINT_D = 'M-8 142 L8 142 L0.8 164.4 Q0 165.4 -0.8 164.4 Z'
const SIDES_D = 'M-8 7.5 L-8 142 L-0.8 164.4 Q0 165.4 0.8 164.4 L8 142 L8 7.5'

// --- motion helpers ----------------------------------------------------------------------------------------------
const STEP_MS = 420
const FADE_MS = 260
function grow(k: number, reduced: boolean, origin = 'center'): CSSProperties {
  return {
    opacity: k,
    transform: `scale(${f1(0.5 + 0.5 * k)})`,
    transformBox: 'fill-box',
    transformOrigin: origin,
    transition: reduced ? 'none' : `opacity ${STEP_MS}ms linear, transform ${STEP_MS}ms ease-out`,
  }
}
function fade(k: number, reduced: boolean, ms = FADE_MS): CSSProperties {
  return { opacity: k, transition: reduced ? 'none' : `opacity ${ms}ms ease` }
}

// --- rust on a bare nail, in nail units, with the day each patch starts and finishes (tap water) --------------------
// Under tap water the head and the point go first (the worked metal), then spots along the shank, then they merge.
type Patch = { x: number; y: number; rx: number; ry: number; t0: number; t1: number; c: string; s: number; salt?: boolean }
const PATCHES: Patch[] = [
  { x: 9, y: 4.6, rx: 8, ry: 3.4, t0: 0.6, t1: 2.6, c: RUST, s: 1 },
  { x: 0, y: 142, rx: 5.5, ry: 10, t0: 0.8, t1: 2.8, c: RUST, s: 2 },
  { x: -3, y: 30, rx: 4, ry: 6, t0: 1.6, t1: 3.8, c: RUST, s: 3 },
  { x: 3, y: 60, rx: 4.5, ry: 7, t0: 2, t1: 4.2, c: RUST, s: 4 },
  { x: -2.5, y: 92, rx: 5, ry: 8, t0: 2.2, t1: 4.4, c: RUST, s: 5 },
  { x: 2.5, y: 118, rx: 4.2, ry: 6.5, t0: 1.8, t1: 4, c: RUST, s: 6 },
  { x: -9, y: 4.2, rx: 6.5, ry: 3, t0: 2.4, t1: 4.4, c: RUST, s: 7 },
  { x: 0, y: 44, rx: 8, ry: 14, t0: 3.4, t1: 5.8, c: RUST_LIGHT, s: 8 },
  { x: 0, y: 104, rx: 8, ry: 17, t0: 3.6, t1: 6, c: RUST_LIGHT, s: 9 },
  { x: 1, y: 76, rx: 7, ry: 9, t0: 4, t1: 6.2, c: RUST, s: 10 },
  { x: -1, y: 18, rx: 6, ry: 6, t0: 4.4, t1: 6.6, c: RUST, s: 11 },
  // Salt water only: more and heavier, some bulging past the edge (rust takes more room than the iron it came from).
  { x: -6.5, y: 70, rx: 3.2, ry: 7, t0: 1.4, t1: 3.6, c: RUST_DARK, s: 12, salt: true },
  { x: 6.8, y: 38, rx: 2.8, ry: 6, t0: 1.6, t1: 3.8, c: RUST, s: 13, salt: true },
  { x: -6.6, y: 122, rx: 3, ry: 6.5, t0: 2, t1: 4.2, c: RUST, s: 14, salt: true },
  { x: 6.6, y: 96, rx: 2.8, ry: 7, t0: 2.4, t1: 4.6, c: RUST_DARK, s: 15, salt: true },
  { x: 0, y: 130, rx: 8, ry: 10, t0: 3, t1: 5, c: RUST_DARK, s: 16, salt: true },
]
const PITS: [number, number][] = [
  [-4, 20], [3, 36], [-2, 50], [4, 66], [-5, 80], [1, 88], [-3, 112], [5, 124], [2, 100], [-1, 140], [10, 5], [-12, 5], [-4, 58], [3, 132],
]
/** Rust flakes that fall from the nail and settle, in tube units: where each appears, on which day, and how far it may drop. */
const FLAKES = [
  { x: 166, y: 160, t: 2.6, drop: 70, salt: false },
  { x: 210, y: 140, t: 3.0, drop: 80, salt: false },
  { x: 172, y: 206, t: 3.6, drop: 40, salt: false },
  { x: 206, y: 196, t: 4.2, drop: 46, salt: false },
  { x: 216, y: 232, t: 4.8, drop: 18, salt: false },
  { x: 158, y: 124, t: 1.8, drop: 96, salt: true },
  { x: 203, y: 168, t: 2.4, drop: 60, salt: true },
  { x: 168, y: 238, t: 3.2, drop: 14, salt: true },
]
const FLAKE_D = 'M-1.9 -1 L1.5 -1.5 L2.1 0.8 L-1.1 1.5 Z'
const HEAP = 'M156 268 Q172 258 188 261 Q204 258 220 268 A46 46 0 0 1 156 268 Z'
const HEAP_SALT = 'M151 262 Q170 249 188 252 Q206 249 225 262 A46 46 0 0 1 151 262 Z'
const HEAP_SMALL = 'M167 276 Q178 271 188 272 Q198 271 209 276 A46 46 0 0 1 167 276 Z'
const ZINC_SPANGLE: [number, number][][] = [
  [[-7, 13], [-1, 10], [1, 24], [-7, 27]], [[1, 29], [7, 26], [7, 44], [2, 47]], [[-7, 50], [0, 47], [-2, 63], [-7, 66]],
  [[0, 80], [7, 77], [7, 94], [1, 97]], [[-7, 99], [-1, 96], [0, 111], [-7, 114]], [[1, 116], [7, 113], [7, 130], [0, 131]],
  [[-14, 3], [-4, 2], [-6, 7.5], [-15, 7]], [[4, 3], [13, 2.6], [15, 7], [5, 7.6]],
]
const ZINC_SPECKS: [number, number][] = [[-3, 22], [4, 40], [-4, 86], [3, 108], [-2, 126], [8, 4]]
/** The magnesium strip: three turns round the upper shank, in nail units (each front pass runs down to the right). */
const MG_TURNS = [20, 32, 44]

// --- small pieces ------------------------------------------------------------------------------------------------
type Pal = typeof STEEL
function NailBody({ p }: { p: Pal }) {
  return (
    <g>
      <rect x={-8} y={7.5} width={16} height={135} fill={p.fill} />
      <rect x={-5.4} y={8} width={3.4} height={134} fill={p.light} />
      <rect x={3.6} y={8} width={4.4} height={134} fill={p.shade} />
      <path d="M-8 142 L0 142 L0 165 Z" fill={p.fill} />
      <path d="M-5.4 142 L-2 142 L0 162 Z" fill={p.light} />
      <path d="M0 142 L8 142 L0 165 Z" fill={p.shade} />
      {[11.5, 15.2, 18.9, 22.6].map((y) => (
        <line key={y} x1={-8} y1={y} x2={8} y2={y + 2.6} stroke={p.mark} strokeWidth={0.9} />
      ))}
      <path d={SIDES_D} fill="none" stroke={p.edge} strokeWidth={0.9} strokeLinejoin="round" />
      <path d={HEAD_D} fill={p.fill} stroke={p.edge} strokeWidth={0.9} />
      <ellipse cx={0} cy={2.8} rx={19} ry={2.8} fill={p.top} stroke={p.edge} strokeWidth={0.6} />
      <path d="M-17.5 5.4 L-7 5.7 L-7 8.2 L-17 7.9 Z" fill={p.light} opacity={0.7} />
    </g>
  )
}

function Tag({ text, side, y, to, reduced, show = 1 }: { text: string; side: 'left' | 'right'; y: number; to: [number, number]; reduced: boolean; show?: number }) {
  const x = side === 'left' ? 124 : 254
  const lx = side === 'left' ? x + 4 : x - 4
  return (
    <g style={fade(show, reduced, STEP_MS)}>
      <line x1={lx} y1={y} x2={to[0]} y2={to[1]} stroke={LEAD} strokeWidth={0.9} />
      <circle cx={to[0]} cy={to[1]} r={1.7} fill={LEAD} />
      <text x={x} y={y + 4} textAnchor={side === 'left' ? 'end' : 'start'} fontFamily={FONT} fontSize={12} fontWeight={700}
        fill={SOFT} stroke={PLATE} strokeWidth={3} paintOrder="stroke" strokeLinejoin="round">{text}</text>
    </g>
  )
}

const strokeEase = (reduced: boolean) => (reduced ? 'none' : `stroke-width ${STEP_MS}ms linear`)

// --- the picture -------------------------------------------------------------------------------------------------
export default function Picture(props: PictureProps) {
  const { water, air, protection = 'none', scratched = false, reduced = false } = props
  const day = Math.max(0, Math.min(WEEK, props.day))
  const wet = water !== 'none'
  const airy = air === 'in'
  const salt = water === 'salt'
  const setup: 'open' | 'boiled' | 'dry' | 'oil' = wet ? (airy ? 'open' : 'boiled') : airy ? 'dry' : 'oil'
  // The chemistry: iron rusts only where water AND oxygen both reach bare iron. A barrier (paint, grease) fails at a
  // scratch; zinc and magnesium are more reactive, so they corrode instead and the iron stays bare and bright.
  const rusting = wet && airy
  const barrier = protection === 'paint' || protection === 'grease'
  const where: 'all' | 'scratch' | 'none' = !rusting ? 'none' : protection === 'none' ? 'all' : barrier && scratched ? 'scratch' : 'none'
  const sp = salt ? 0.55 : 1 // salt water brings every stage forward
  const zincEats = rusting && protection === 'zinc'
  const mgEats = rusting && protection === 'magnesium'
  const nailY = setup === 'dry' ? NAIL_Y_DRY : NAIL_Y_WET
  const ease = reduced ? 'none' : 'transform 320ms cubic-bezier(.2,.7,.2,1)'
  const dayN = Math.round(day)

  // How far along each change is today.
  const kFirst = where === 'all' ? ramp(day, 0.6 * sp, 2.6 * sp) : 0
  const kCoat = where === 'all' ? ramp(day, 4.6 * sp, 7 * sp) : 0
  const kPits = where === 'all' ? ramp(day, 3.4 * sp, 6.2 * sp) : 0
  const kHeap = where === 'all' ? ramp(day, 3 * sp, 7 * sp) : where === 'scratch' ? ramp(day, 4, 7) : 0
  const kTint = where === 'all' ? ramp(day, 4 * sp, 7 * sp) * (salt ? 0.38 : 0.26) : where === 'scratch' ? ramp(day, 4, 7) * 0.08 : 0
  const kGash = where === 'scratch' || (where === 'all' && scratched) ? ramp(day, 0.8, 2.2) : 0
  const kBlister = where === 'scratch' ? ramp(day, 1.8, 5.6) : 0
  const kStreak = where === 'scratch' ? ramp(day, 3, 6.5) : 0
  const kHalo = zincEats && scratched ? ramp(day, 1, 5.5) : 0
  const kSpecks = zincEats ? ramp(day, 4, 7) : 0
  const kMg = mgEats ? ramp(day, 1, 7) : 0
  const kWhiteHeap = mgEats ? ramp(day, 3, 7) : 0
  const kRustTag = where === 'all' ? kFirst : kGash

  const describe =
    (setup === 'open' ? `a nail in ${salt ? 'salt' : 'tap'} water, open to the air`
      : setup === 'boiled' ? `a nail in boiled ${salt ? 'salt ' : ''}water under a layer of oil`
        : setup === 'dry' ? 'a nail in dry air over a drying agent, stoppered'
          : 'a nail sunk in oil') +
    (protection === 'none' ? '' : protection === 'magnesium' ? ', a magnesium strip wrapped round it' : `, coated with ${protection}`) +
    (scratched ? ', scratched' : '') + `; day ${dayN} of ${WEEK}`

  const scratchMetal = protection === 'zinc' ? '#8C949C' : protection === 'paint' ? '#B3BAC1' : SCRATCH_BRIGHT
  const mg = (w: number) => w - 1.8 * kMg
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={describe}>
      <defs>
        <clipPath id="rusting-tube-in"><path d={liquid(RIM - 20)} /></clipPath>
        <clipPath id="rusting-nail">
          <path d={HEAD_D} /><rect x={-8} y={7} width={16} height={135.5} /><path d={POINT_D} />
        </clipPath>
      </defs>
      <rect x={0.5} y={0.5} width={W - 1} height={H - 1} rx={14} fill={PLATE} stroke={PLATE_EDGE} />

      {/* Day strip: the week passing, one dot a day. */}
      <g aria-hidden="true">
        <text x={18} y={27} fontFamily={FONT} fontSize={12} fontWeight={700} fill={SOFT}>{`Day ${dayN} of ${WEEK}`}</text>
        {Array.from({ length: WEEK }, (_, i) => (
          <circle key={i} cx={23 + i * 13} cy={39} r={4.2} fill={i < dayN ? SOFT : '#FFFFFF'} stroke={i < dayN ? SOFT : PLATE_EDGE}
            strokeWidth={1.2} style={{ transition: reduced ? 'none' : `fill ${FADE_MS}ms ease, stroke ${FADE_MS}ms ease` }} />
        ))}
      </g>

      {/* Tube interior (glass seen through) */}
      <path d={liquid(RIM)} fill={GLASS_IN} />

      <g clipPath="url(#rusting-tube-in)">
        {/* Water: tap, salt or boiled. */}
        <g style={fade(wet ? 1 : 0, reduced)}>
          <path d={liquid(LEVEL)} fill={WATER} />
          <ellipse cx={CX} cy={LEVEL} rx={46} ry={3} fill={WATER_TOP} stroke={WATER_EDGE} strokeWidth={0.8} />
        </g>
        {/* Oil floated on boiled water keeps air from dissolving back in. */}
        <g style={fade(setup === 'boiled' ? 1 : 0, reduced)}>
          <rect x={139} y={OIL_TOP_Y} width={98} height={LEVEL - OIL_TOP_Y} fill={OIL} />
          <path d={`M142 ${LEVEL} A46 3 0 0 0 234 ${LEVEL}`} fill="none" stroke={OIL_EDGE} strokeWidth={0.8} />
          <ellipse cx={CX} cy={OIL_TOP_Y} rx={46} ry={3} fill={OIL_TOP} stroke={OIL_EDGE} strokeWidth={0.8} />
        </g>
        {/* A tube of oil: no water, no air. */}
        <g style={fade(setup === 'oil' ? 1 : 0, reduced)}>
          <path d={liquid(LEVEL)} fill={OIL} />
          <ellipse cx={CX} cy={LEVEL} rx={46} ry={3} fill={OIL_TOP} stroke={OIL_EDGE} strokeWidth={0.8} />
        </g>
        {/* Dry tube: drying agent (anhydrous calcium chloride) under a cotton wool plug. */}
        <g style={fade(setup === 'dry' ? 1 : 0, reduced)}>
          <rect x={139} y={250} width={98} height={40} fill={GRAIN_DARK} />
          {Array.from({ length: 40 }, (_, i) => {
            const row = Math.floor(i / 8)
            const x = 144 + (i % 8) * 12.4 + (row % 2) * 5.5 + (rnd(i + 40) - 0.5) * 3
            const y = 255 + row * 6.4 + (rnd(i + 90) - 0.5) * 2
            return <path key={i} d={blob(x, y, 4.4, 3.5, i + 200, 6, 0.22)} fill={i % 3 ? GRAIN : GRAIN_DARK} stroke={GRAIN_EDGE} strokeWidth={0.7} />
          })}
          <path d={smooth([{ x: 136, y: 254 }, { x: 137, y: 234 }, { x: 148, y: 226.5 }, { x: 160, y: 230.5 }, { x: 173, y: 225 }, { x: 188, y: 230 },
            { x: 202, y: 224.5 }, { x: 215, y: 229.5 }, { x: 228, y: 225.5 }, { x: 240, y: 234 }, { x: 240, y: 254 }, { x: 188, y: 257 }])}
            fill={WOOL} stroke={WOOL_EDGE} strokeWidth={0.9} />
          {[[150, 238, 164, 235], [176, 244, 192, 240], [200, 236, 215, 239], [158, 249, 172, 247], [198, 249, 213, 247], [220, 244, 230, 242]].map(([a, b, c, d], i) => (
            <path key={i} d={`M${a} ${b} Q${(a + c) / 2} ${b - 4} ${c} ${d}`} fill="none" stroke={WOOL_EDGE} strokeWidth={0.7} opacity={0.7} />
          ))}
        </g>

        {/* Rust settling on the bottom; white magnesium hydroxide when the strip corrodes. */}
        <path d={salt ? HEAP_SALT : where === 'scratch' ? HEAP_SMALL : HEAP} fill={RUST} stroke={RUST_DARK} strokeWidth={0.6} style={grow(kHeap, reduced, 'bottom')} />
        <path d={HEAP_SMALL} fill={WHITE_CRUST} stroke={WHITE_CRUST_EDGE} strokeWidth={0.6} style={grow(kWhiteHeap, reduced, 'bottom')} />

        {/* The nail */}
        <g style={{ transform: `translate(${CX}px, ${nailY}px)`, transition: ease }}>
          {/* back passes of the magnesium strip, behind the shank */}
          <g style={fade(protection === 'magnesium' ? 1 : 0, reduced)}>
            {MG_TURNS.map((y0) => (
              <line key={y0} x1={8.8} y1={y0 - 6} x2={-8.8} y2={y0} stroke={MG_BACK} strokeWidth={mg(6)} style={{ transition: strokeEase(reduced) }} />
            ))}
          </g>
          <NailBody p={STEEL} />
          <g style={fade(protection === 'paint' ? 1 : 0, reduced)}><NailBody p={PAINT} /></g>
          <g style={fade(protection === 'zinc' ? 1 : 0, reduced)}>
            <NailBody p={ZINC} />
            <g clipPath="url(#rusting-nail)">
              {ZINC_SPANGLE.map((pts, i) => (
                <path key={i} d={'M' + pts.map(([x, y]) => `${f1(nx(x))} ${f1(ny(y))}`).join(' L') + 'Z'} fill={i % 2 ? ZINC.light : ZINC.shade} opacity={0.35} />
              ))}
            </g>
          </g>
          <g style={fade(protection === 'grease' ? 1 : 0, reduced)}>
            <rect x={-9.6} y={6} width={19.2} height={137} rx={3} fill={GREASE} opacity={0.32} stroke={GREASE_EDGE} strokeWidth={0.7} />
            <path d="M-9.6 141 L9.6 141 L0.8 167 Q0 168 -0.8 167 Z" fill={GREASE} opacity={0.32} />
            <ellipse cx={0} cy={4.6} rx={20.6} ry={5.8} fill={GREASE} opacity={0.32} stroke={GREASE_EDGE} strokeWidth={0.7} />
            <path d={blob(-9.4, 48, 2.6, 7.5, 51)} fill={GREASE} opacity={0.55} />
            <path d={blob(9.3, 106, 2.4, 8.5, 52)} fill={GREASE} opacity={0.55} />
            <line x1={-4} y1={12} x2={-4} y2={136} stroke="#FFF7DE" strokeWidth={1.2} opacity={0.75} />
          </g>

          <g clipPath="url(#rusting-nail)">
            {/* Zinc corroding round the scratch (white), and a little everywhere by the end of the week. */}
            <path d={blob(0, 77, 10.5, 13.5, 61, 10, 0.22)} fill={WHITE_CRUST} stroke={WHITE_CRUST_EDGE} strokeWidth={0.6} style={grow(kHalo, reduced)} />
            {ZINC_SPECKS.map(([x, y], i) => (
              <path key={i} d={blob(nx(x), ny(y), 2.4, 1.9, 70 + i, 7)} fill={WHITE_CRUST} style={fade(kSpecks * 0.8, reduced, STEP_MS)} />
            ))}
            {/* The scratch: a bright groove with a dark lip, drawn in like a stroke. */}
            <g style={fade(scratched ? 1 : 0, reduced)}>
              <line x1={SCRATCH.x1} y1={SCRATCH.y1 + 1.5} x2={SCRATCH.x2} y2={SCRATCH.y2 + 1.5} stroke={SCRATCH_LIP} strokeWidth={1}
                strokeDasharray={22} style={{ strokeDashoffset: scratched ? 0 : 22, transition: reduced ? 'none' : 'stroke-dashoffset 420ms ease-out' }} />
              <line x1={SCRATCH.x1} y1={SCRATCH.y1} x2={SCRATCH.x2} y2={SCRATCH.y2} stroke={scratchMetal}
                strokeWidth={2.6} strokeDasharray={22} style={{ strokeDashoffset: scratched ? 0 : 22, transition: reduced ? 'none' : 'stroke-dashoffset 420ms ease-out' }} />
            </g>
            {/* Rust all over a bare nail: first the head and point, then spots, then a coat. */}
            <g style={fade(kCoat * (salt ? 0.9 : 0.72), reduced, STEP_MS)}>
              <path d={HEAD_D} fill={RUST_LIGHT} /><rect x={-8} y={7} width={16} height={135.5} fill={RUST_LIGHT} /><path d={POINT_D} fill={RUST_LIGHT} />
            </g>
            {where === 'all' && PATCHES.filter((p) => !p.salt).map((p) => (
              <path key={p.s} d={blob(nx(p.x), ny(p.y), nx(p.rx), p.ry * 1.08, p.s)} fill={p.c} style={grow(ramp(day, p.t0 * sp, p.t1 * sp), reduced)} />
            ))}
            <g style={fade(kPits, reduced, STEP_MS)}>
              {where === 'all' && PITS.map(([x, y], i) => <circle key={i} cx={f1(nx(x))} cy={f1(ny(y))} r={0.9 + rnd(i + 5) * 0.8} fill={RUST_DARK} />)}
            </g>
            {/* Under a scratched coat: rust in the groove, then a blister creeping under the coat's edge, and a stain below. */}
            <path d={blob(0, 77, 9.6, 12, 81, 10, 0.24)} fill={RUST} style={grow(kBlister, reduced)} />
            <path d={blob(0, 77, 5, 6.5, 82, 8, 0.3)} fill={RUST_DARK} style={grow(kBlister, reduced)} />
            <path d="M-1.2 87 C0 96 3.4 100 2.3 113 L-0.7 113 C0 102 -3 96 -3.4 88 Z" fill={RUST_STAIN} style={fade(kStreak * 0.85, reduced, STEP_MS)} />
            <line x1={SCRATCH.x1} y1={SCRATCH.y1} x2={SCRATCH.x2} y2={SCRATCH.y2} stroke={RUST_DARK} strokeWidth={2.6} style={fade(kGash, reduced, STEP_MS)} />
          </g>
          {/* Paint lifting round the blister. */}
          <path d={blob(0, 77, 10.6, 13, 81, 10, 0.24)} fill="none" stroke={PAINT.light} strokeWidth={1.3}
            clipPath="url(#rusting-nail)" style={grow(protection === 'paint' ? kBlister : 0, reduced)} />
          {/* Salt water: heavier rust, some bulging past the nail's edge (rust takes more room than the iron it came from). */}
          {where === 'all' && salt && PATCHES.filter((p) => p.salt).map((p) => (
            <path key={p.s} d={blob(nx(p.x), ny(p.y), nx(p.rx), p.ry * 1.08, p.s)} fill={p.c} style={grow(ramp(day, p.t0 * sp, p.t1 * sp), reduced)} />
          ))}

          {/* Front passes of the magnesium strip; it thins and grows a white crust as it corrodes instead of the iron. */}
          <g style={fade(protection === 'magnesium' ? 1 : 0, reduced)}>
            {MG_TURNS.map((y0) => (
              <g key={y0}>
                <line x1={-8.8} y1={y0} x2={8.8} y2={y0 + 6} stroke={MG_EDGE} strokeWidth={mg(7.4)} style={{ transition: strokeEase(reduced) }} />
                <line x1={-8.8} y1={y0} x2={8.8} y2={y0 + 6} stroke={MG} strokeWidth={mg(6)} style={{ transition: strokeEase(reduced) }} />
                <line x1={-8.4} y1={y0 - 1.3} x2={8.4} y2={y0 + 4.5} stroke="#F7F9FA" strokeWidth={1} style={fade(1 - kMg * 0.8, reduced, STEP_MS)} />
                {[0.2, 0.55, 0.85].map((t, i) => (
                  <path key={i} d={blob(-8.8 + 17.6 * t, y0 + 6 * t, 2.8, 2.2, y0 + i * 11, 7)} fill={WHITE_CRUST} stroke={WHITE_CRUST_EDGE} strokeWidth={0.5}
                    style={grow(mgEats ? ramp(day, 1 + i * 1.2, 4 + i * 1.2) : 0, reduced)} />
                ))}
              </g>
            ))}
          </g>
        </g>

        {/* Flakes of rust falling and settling. */}
        {FLAKES.map((f, i) => {
          const on = where === 'all' && (salt || !f.salt)
          const k = on ? ramp(day, f.t * sp, f.t * sp + 0.8) : 0
          const drop = on ? Math.min(f.drop, Math.max(0, day - f.t * sp) * 14) : 0
          return (
            <path key={i} d={FLAKE_D} fill={i % 2 ? RUST : RUST_DARK}
              style={{ opacity: k, transform: `translate(${f.x}px, ${f1(f.y + drop)}px) rotate(${i * 37}deg)`, transition: reduced ? 'none' : `opacity ${STEP_MS}ms linear, transform ${STEP_MS}ms linear` }} />
          )
        })}

        {/* The liquid seen in front of the nail, and the rust stain spreading through it. */}
        <path d={liquid(LEVEL)} fill={setup === 'oil' ? OIL : WATER} style={fade(setup === 'dry' ? 0 : setup === 'oil' ? 0.38 : 0.22, reduced)} />
        <path d={liquid(LEVEL + 3)} fill={RUST_STAIN} style={fade(kTint, reduced, STEP_MS)} />
      </g>

      {/* Glass */}
      <path d={TUBE_WALL} fill={GLASS} opacity={0.75} />
      <path d={TUBE_OUT} fill="none" stroke={GLASS_EDGE} strokeWidth={1.2} />
      <path d={TUBE_IN} fill="none" stroke={GLASS_INNER} strokeWidth={0.8} />
      <rect x={146} y={44} width={3.4} height={196} rx={1.7} fill="#FFFFFF" opacity={0.8} />
      <rect x={228} y={60} width={1.8} height={150} rx={0.9} fill="#FFFFFF" opacity={0.55} />
      <ellipse cx={CX} cy={RIM} rx={50.5} ry={4.5} fill="none" stroke={GLASS_EDGE} strokeWidth={1.3} />

      {/* Rubber stopper on the dry tube. */}
      <g style={fade(setup === 'dry' ? 1 : 0, reduced)}>
        <path d="M139 14 L144 48 A44 3.6 0 0 0 232 48 L237 14 Z" fill={RUBBER} stroke={RUBBER_EDGE} strokeWidth={0.9} />
        <path d="M146 18 L149.5 46 L156 47 L153 18 Z" fill={RUBBER_TOP} opacity={0.8} />
        <ellipse cx={CX} cy={14} rx={49} ry={4} fill={RUBBER_TOP} stroke={RUBBER_EDGE} strokeWidth={0.9} />
        <path d={`M137.5 ${RIM} A50.5 4.5 0 0 0 238.5 ${RIM}`} fill="none" stroke={GLASS_EDGE} strokeWidth={1.3} />
      </g>

      {/* Labels: names of things only, on leader lines; nothing that tells the result. */}
      <Tag text={setup === 'dry' ? 'dry air' : 'air'} side="left" y={56} to={[160, 56]} reduced={reduced} />
      <Tag text="nail" side="left" y={nailY + 6} to={[170.5, nailY + 5.5]} reduced={reduced} />
      {scratched && <Tag text="scratch" side="left" y={nailY + 76} to={[181.5, nailY + 72.6]} reduced={reduced} />}
      {setup === 'open' && <Tag text={salt ? 'salt water' : 'tap water'} side="right" y={232} to={[224, 232]} reduced={reduced} />}
      {setup === 'boiled' && <Tag text="oil" side="right" y={85} to={[226, 85]} reduced={reduced} />}
      {setup === 'boiled' && <Tag text={salt ? 'boiled salt water' : 'boiled water'} side="right" y={232} to={[224, 232]} reduced={reduced} />}
      {setup === 'oil' && <Tag text="oil" side="right" y={232} to={[224, 232]} reduced={reduced} />}
      {setup === 'dry' && <Tag text="stopper" side="right" y={26} to={[233, 26]} reduced={reduced} />}
      {setup === 'dry' && <Tag text="cotton wool" side="right" y={238} to={[222, 240]} reduced={reduced} />}
      {setup === 'dry' && <Tag text="drying agent" side="right" y={268} to={[214, 266]} reduced={reduced} />}
      {(protection === 'paint' || protection === 'zinc' || protection === 'grease') && (
        <Tag text={protection === 'paint' ? 'paint' : protection === 'zinc' ? 'zinc coat' : 'grease'} side="right" y={nailY + 42} to={[196.6, nailY + 40]} reduced={reduced} />
      )}
      {protection === 'magnesium' && <Tag text="magnesium strip" side="right" y={nailY + 50} to={[196, nailY + 49.5]} reduced={reduced} />}
      {kRustTag > 0 && where === 'all' && <Tag text="rust" side="right" y={nailY + 6} to={[198.5, nailY + 5]} reduced={reduced} show={kRustTag} />}
      {kRustTag > 0 && where === 'scratch' && <Tag text="rust" side="right" y={nailY + 94} to={[196, nailY + 82]} reduced={reduced} show={kRustTag} />}
    </svg>
  )
}
