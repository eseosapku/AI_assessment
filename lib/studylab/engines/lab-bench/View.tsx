'use client'
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import type { SceneViewProps } from '../types'
import type { DyeColour, LabBenchConfig, LabBenchState, MethodId, MixtureId, Outcome, SubstanceId } from './config'
import { APPARATUS, METHODS, METHOD_NAMES, MIXTURES, SUBSTANCES, explain, names, observe, run, split, wantLabel } from './config'

// One bench in both themes: a dark lab panel, so its colours are its own. Everything that carries meaning
// keeps 3:1 against the panel (or, for dye spots, against the paper, with a darker rim).
const PANEL = '#15202B'
const BENCH = '#2A3A4A'
const GLASS = '#C3D2DF'
const GLASS_FILL = 'rgba(195,210,223,0.07)'
const LABEL = '#D5E0EA'
const METAL = '#8C99A5'
const CLEAR = '#4C8FC7' // a clear liquid, tinted so it can be seen
const INK = '#7277EC'
const PAPER = '#EFEBE0'
const PENCIL = '#5E6266'
const FLAME = '#5BB0FF'
const FLAME_CORE = '#CFE8FF'
const GLOW = '#FF8A2A'
const PRODUCT = '#2A2A2A'
const GRAIN: Record<SubstanceId, string> = { sand: '#D9B26F', salt: '#F4F6F8', iron: '#A3ACB6', sulfur: '#F2D33B', dyes: '#2B2C55', water: CLEAR, ethanol: CLEAR }
const DYE: Record<DyeColour, { fill: string; edge: string }> = {
  blue: { fill: '#2F5BEA', edge: '#1D3A9C' },
  red: { fill: '#D7263D', edge: '#8E1525' },
  yellow: { fill: '#E8B400', edge: '#7A5A00' },
}

const W = 360
const H = 210
const TOP = 176 // the bench top
const RUN_MS = 2600

const clamp = (v: number) => Math.min(1, Math.max(0, v))
const rnd = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}
const liquidFill = (ids: readonly SubstanceId[]) => (ids.some((id) => !!SUBSTANCES[id].dyes) ? INK : CLEAR)

/** One grain of a solid, drawn as that solid looks: crystals, grains, filings, powder, lumps. */
function grain(id: SubstanceId | 'product', x: number, y: number, k: number): ReactNode {
  if (id === 'salt') return <rect key={k} x={x - 1.7} y={y - 1.7} width={3.4} height={3.4} fill={GRAIN.salt} stroke="#7C8B98" strokeWidth={0.6} transform={`rotate(45 ${x} ${y})`} />
  if (id === 'iron') {
    const a = rnd(k * 7.3) * Math.PI
    return <line key={k} x1={x - 2.2 * Math.cos(a)} y1={y - 2.2 * Math.sin(a)} x2={x + 2.2 * Math.cos(a)} y2={y + 2.2 * Math.sin(a)} stroke={GRAIN.iron} strokeWidth={1.6} strokeLinecap="round" />
  }
  if (id === 'product') return <circle key={k} cx={x} cy={y} r={2.6} fill={PRODUCT} stroke="#9AA5B0" strokeWidth={0.8} />
  return <circle key={k} cx={x} cy={y} r={id === 'sulfur' ? 1.7 : 1.9} fill={GRAIN[id]} />
}

/** Up to n grains of the given solids, mixed evenly, at points the region admits. Deterministic. */
function Grains({ ids, box, inside, n = 22, seed = 1, opacity = 1 }: {
  ids: readonly (SubstanceId | 'product')[]; box: [number, number, number, number]; inside?: (x: number, y: number) => boolean; n?: number; seed?: number; opacity?: number
}) {
  if (!ids.length || opacity <= 0) return null
  const [x0, y0, x1, y1] = box
  const out: ReactNode[] = []
  for (let i = 0, tries = 0; out.length < n && tries < n * 12; tries++, i++) {
    const x = x0 + rnd(seed * 31 + i * 2.1) * (x1 - x0)
    const y = y0 + rnd(seed * 17 + i * 3.7) * (y1 - y0)
    if (inside && !inside(x, y)) continue
    out.push(grain(ids[out.length % ids.length], x, y, seed * 1000 + i))
  }
  return <g opacity={opacity}>{out}</g>
}

/** A label for a place: what it is, and once marked, what is in it. */
function Place({ x, y, role, holds, anchor = 'middle' }: { x: number; y: number; role: string; holds?: string; anchor?: 'start' | 'middle' | 'end' }) {
  return (
    <text x={x} y={y} textAnchor={anchor} fill={LABEL} fontSize={12}>
      <tspan fontWeight={700}>{role}</tspan>
      {holds && <tspan x={x} dy={14} fontWeight={500}>{holds}</tspan>}
    </text>
  )
}

/** A tube: glass walls round a hollow bore. */
const Tube = ({ d }: { d: string }) => (
  <g fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} stroke={GLASS} strokeWidth={6} />
    <path d={d} stroke={PANEL} strokeWidth={3} />
  </g>
)

/** A Bunsen burner standing on the bench, its flame reaching up to `flameTop`. */
function Bunsen({ x, flameTop, barrelTop = TOP - 32 }: { x: number; flameTop: number; barrelTop?: number }) {
  const fh = barrelTop - 1 - flameTop
  const foot = TOP - 8
  return (
    <g>
      <path d={`M ${x - 7} ${barrelTop - 1} Q ${x - 8} ${flameTop + fh * 0.45} ${x} ${flameTop} Q ${x + 8} ${flameTop + fh * 0.45} ${x + 7} ${barrelTop - 1} Z`} fill={FLAME} />
      <path d={`M ${x - 3.5} ${barrelTop - 1} Q ${x - 4} ${flameTop + fh * 0.6} ${x} ${flameTop + fh * 0.35} Q ${x + 4} ${flameTop + fh * 0.6} ${x + 3.5} ${barrelTop - 1} Z`} fill={FLAME_CORE} />
      <rect x={x - 5} y={barrelTop} width={10} height={foot - barrelTop} fill={METAL} />
      <rect x={x - 7} y={barrelTop + (foot - barrelTop) * 0.55} width={14} height={4} fill="#6F7C88" />
      <rect x={x - 17} y={foot} width={34} height={6} rx={2} fill={METAL} />
    </g>
  )
}

/** The mixture as it is handed over, before any apparatus is picked. */
function Mixture({ mixture }: { mixture: MixtureId }) {
  const { liquids, dissolved, undissolved, solids } = split(mixture)
  const inBeaker = (x: number) => x > 153 && x < 207
  return (
    <g>
      {liquids.length > 0 && <rect x={151} y={118} width={58} height={55} fill={liquidFill([...liquids, ...dissolved])} opacity={0.9} />}
      {liquids.length > 0
        ? <Grains ids={undissolved} box={[153, 164, 207, 172]} n={26} seed={3} />
        : <Grains ids={solids} box={[153, 146, 207, 172]} inside={(x, y) => inBeaker(x) && y > 172 - 24 * (1 - ((x - 180) / 30) ** 2)} n={60} seed={5} />}
      <path d="M 146 88 L 150 92 L 150 170 Q 150 174 154 174 L 206 174 Q 210 174 210 170 L 210 92 L 214 88" fill={GLASS_FILL} stroke={GLASS} strokeWidth={2} strokeLinejoin="round" />
      <Place x={180} y={TOP + 15} role="The mixture" />
    </g>
  )
}

/** The funnel's inside half-width at height y (rim at 30, tip at 94). */
const funnel = (y: number) => (58 * (94 - y)) / 64
/** The conical flask's inside half-width at height y. */
const conical = (y: number) => Math.min(40, 10 + Math.max(0, y - 138))

function Filtration({ o, mixture, t, named }: { o: Extract<Outcome, { method: 'filtration' }>; mixture: MixtureId; t: number; named: boolean }) {
  const { liquids, dissolved } = split(mixture)
  const poured = liquidFill([...dissolved, ...liquids])
  const level = 40 + t * 50
  const hw = funnel(level)
  const depth = o.dry ? 0 : 16 * t
  const top = 172 - depth
  const residueIn = (x: number, y: number) => Math.abs(x - 180) < funnel(y) - 2.5
  return (
    <g>
      {/* What is still to run through. */}
      {!o.dry && level < 89 && <path d={`M ${180 - hw} ${level} L ${180 + hw} ${level} L 180 94 Z`} fill={poured} opacity={0.9} />}
      <Grains ids={o.residue} box={[150, o.dry ? 60 : 74, 210, 92]} inside={residueIn} n={o.dry ? 46 : 24} seed={7} />
      <path d="M 130 33 L 180 90 L 230 33" fill="none" stroke={PAPER} strokeWidth={1.6} />
      <path d="M 122 30 L 176 94 L 177 98 L 177 134 M 238 30 L 184 94 L 183 98 L 183 134" fill="none" stroke={GLASS} strokeWidth={2} strokeLinejoin="round" />
      <line x1={122} y1={30} x2={238} y2={30} stroke={GLASS} strokeOpacity={0.5} />
      {/* Drips, only while it runs. */}
      {!o.dry && t > 0 && t < 1 && [0, 0.5].map((k) => {
        const p = (t * 7 + k) % 1
        return <circle key={k} cx={180} cy={137 + p * Math.max(2, top - 140)} r={1.8} fill={poured} />
      })}
      {depth > 0.5 && <path d={`M ${180 - conical(top)} ${top} L ${180 + conical(top)} ${top} L 219 172 L 141 172 Z`} fill={liquidFill(o.filtrate)} opacity={0.9} />}
      <path d="M 170 120 L 170 138 L 140 168 Q 136 174 144 174 L 216 174 Q 224 174 220 168 L 190 138 L 190 120" fill={GLASS_FILL} stroke={GLASS} strokeWidth={2} strokeLinejoin="round" />
      <line x1={116} y1={76} x2={166} y2={84} stroke={LABEL} strokeOpacity={0.6} />
      <Place x={112} y={78} anchor="end" role="Residue" holds={named ? (o.residue.length ? names(o.residue) : 'nothing') : undefined} />
      <Place x={180} y={TOP + 15} role="Filtrate" holds={named ? (o.filtrate.length ? names(o.filtrate) : 'nothing') : undefined} />
    </g>
  )
}

/** The basin's floor at x: a quadratic from rim (128, 84) through (180, 132) to (232, 84). */
const bowl = (x: number) => {
  const s = (x - 128) / 104
  return 84 + 96 * s * (1 - s)
}

function Evaporation({ o, mixture, t, named }: { o: Extract<Outcome, { method: 'evaporation' }>; mixture: MixtureId; t: number; named: boolean }) {
  const { liquids, dissolved, undissolved, solids } = split(mixture)
  const level = 92 + t * 15
  const inBowl = (x: number, y: number) => y < bowl(x) - 2
  const crystals = clamp((t - 0.45) / 0.45)
  const heated = MIXTURES[mixture].heated
  const product = clamp((t - 0.45) / 0.4)
  return (
    <g>
      <defs>
        <clipPath id="lab-bench-bowl"><path d="M 128 84 Q 180 132 232 84 Z" /></clipPath>
      </defs>
      <path d="M 124 112 L 116 174 M 236 112 L 244 174" stroke="#6F7C88" strokeWidth={3} strokeLinecap="round" />
      <Bunsen x={180} flameTop={112} />
      <rect x={118} y={108} width={124} height={4} fill="#6F7C88" />
      {!o.reacted && liquids.length > 0 && t < 0.97 && (
        <rect x={128} y={level} width={104} height={26} fill={liquidFill([...liquids, ...dissolved])} opacity={0.9} clipPath="url(#lab-bench-bowl)" />
      )}
      {o.reacted ? (
        <g>
          <Grains ids={solids} box={[146, 94, 214, 106]} inside={inBowl} n={40} seed={11} opacity={1 - product} />
          <ellipse cx={180} cy={101} rx={34} ry={6} fill={GLOW} opacity={0.85 * Math.sin(Math.PI * clamp((t - 0.15) / 0.7))} />
          {heated && <Grains ids={['product']} box={[148, 95, 212, 106]} inside={inBowl} n={26} seed={13} opacity={product} />}
        </g>
      ) : (
        <g>
          <Grains ids={undissolved} box={[150, 97, 210, 106]} inside={inBowl} n={26} seed={11} />
          {dissolved.filter((s) => !SUBSTANCES[s].dyes).length > 0 && (
            <Grains ids={dissolved.filter((s) => !SUBSTANCES[s].dyes)} box={[150, 97, 210, 106]} inside={inBowl} n={26} seed={17} opacity={crystals} />
          )}
          {dissolved.some((s) => SUBSTANCES[s].dyes) && <ellipse cx={180} cy={103.5} rx={24} ry={4} fill={GRAIN.dyes} stroke={INK} strokeWidth={2} opacity={crystals} />}
        </g>
      )}
      <path d="M 128 84 Q 180 132 232 84" fill={GLASS_FILL} stroke={GLASS} strokeWidth={2} />
      <line x1={126} y1={84} x2={234} y2={84} stroke={GLASS} strokeWidth={2} strokeLinecap="round" />
      {/* Steam or vapour, only while it runs. */}
      {!o.reacted && t > 0 && t < 0.97 && [0, 1, 2].map((k) => {
        const p = (t * 2.5 + k / 3) % 1
        const x = 160 + k * 20
        const y = 78 - p * 34
        return <path key={k} d={`M ${x} ${y} q -5 -6 0 -12 q 5 -6 0 -12`} fill="none" stroke="#DCE6EE" strokeWidth={2} strokeLinecap="round" opacity={0.8 * (1 - p)} />
      })}
      <line x1={116} y1={88} x2={152} y2={97} stroke={LABEL} strokeOpacity={0.6} />
      <Place x={112} y={90} anchor="end" role="In the basin" holds={named ? (o.reacted ? heated?.name : o.left.length ? names(o.left) : 'nothing') : undefined} />
      {o.lost.length > 0 && <Place x={180} y={18} role="Into the air" holds={named ? names(o.lost) : undefined} />}
    </g>
  )
}

/** The round-bottomed flask: centre and radius, and where its neck (x 62 to 74) meets the bulb. */
const FLASK = { cx: 68, cy: 114, r: 26 }
const NECK_FOOT = FLASK.cy - Math.sqrt(FLASK.r ** 2 - 6 ** 2)

function Distillation({ o, mixture, t, named }: { o: Extract<Outcome, { method: 'simple-distillation' | 'fractional-distillation' }>; mixture: MixtureId; t: number; named: boolean }) {
  const fractional = o.method === 'fractional-distillation'
  const { liquids, undissolved, solids } = split(mixture)
  const heated = MIXTURES[mixture].heated
  // The top of the neck (or column), and the side arm where the vapour turns into the condenser.
  const head = fractional ? 22 : 46
  const arm = head + 8
  const cond = { x: 108, y: arm + 10, dx: 164, dy: fractional ? 62 : 42 }
  const len = Math.hypot(cond.dx, cond.dy)
  const angle = (Math.atan2(cond.dy, cond.dx) * 180) / Math.PI
  const end = { x: cond.x + cond.dx, y: cond.y + cond.dy }
  const level = 100 + t * 12
  const depth = o.reacted ? 0 : 24 * t
  const product = clamp((t - 0.45) / 0.4)
  const inFlask = (x: number, y: number) => (x - FLASK.cx) ** 2 + (y - FLASK.cy) ** 2 < (FLASK.r - 3) ** 2
  return (
    <g>
      <defs>
        <clipPath id="lab-bench-flask"><circle cx={FLASK.cx} cy={FLASK.cy} r={FLASK.r - 1} /></clipPath>
      </defs>
      <Bunsen x={FLASK.cx} flameTop={FLASK.cy + FLASK.r + 2} barrelTop={158} />
      {/* The flask: never boiled dry. */}
      {!o.reacted && liquids.length > 0 && <rect x={40} y={level} width={56} height={44} fill={liquidFill(o.flask)} opacity={0.9} clipPath="url(#lab-bench-flask)" />}
      {!o.reacted && <Grains ids={undissolved} box={[50, 128, 86, 138]} inside={inFlask} n={22} seed={19} />}
      {o.reacted && (
        <g>
          <Grains ids={solids} box={[48, 120, 88, 138]} inside={inFlask} n={40} seed={23} opacity={1 - product} />
          <circle cx={FLASK.cx} cy={130} r={14} fill={GLOW} opacity={0.8 * Math.sin(Math.PI * clamp((t - 0.15) / 0.7))} clipPath="url(#lab-bench-flask)" />
          {heated && <Grains ids={['product']} box={[48, 122, 88, 138]} inside={inFlask} n={26} seed={29} opacity={product} />}
        </g>
      )}
      <path d={`M 62 ${head} L 62 ${NECK_FOOT} A ${FLASK.r} ${FLASK.r} 0 1 0 74 ${NECK_FOOT} L 74 ${head}`} fill={GLASS_FILL} stroke={GLASS} strokeWidth={2} strokeLinejoin="round" />
      {fractional && Array.from({ length: 9 }, (_, i) => (
        <g key={i}>
          <circle cx={i % 2 ? 71 : 65} cy={36 + i * 5.5} r={2.2} fill="none" stroke={GLASS} strokeWidth={1} />
          <circle cx={i % 2 ? 65 : 71} cy={38.8 + i * 5.5} r={2.2} fill="none" stroke={GLASS} strokeWidth={1} />
        </g>
      ))}
      {/* Stopper and thermometer, its bulb level with the side arm. */}
      <rect x={59} y={head - 6} width={18} height={6} rx={1.5} fill={METAL} />
      <line x1={68} y1={head - 16} x2={68} y2={arm} stroke="#E8EEF3" strokeWidth={2} />
      <circle cx={68} cy={arm + 2} r={2.6} fill="#E25555" />
      {!o.reacted && t > 0.15 && (
        <text x={80} y={head - 4} fill={LABEL} fontSize={12} fontWeight={700}>{o.reading !== null ? `${o.reading} °C` : 'rising'}</text>
      )}
      <Tube d={`M 74 ${arm} L ${cond.x} ${cond.y}`} />
      <g transform={`translate(${cond.x} ${cond.y}) rotate(${angle})`}>
        <rect x={8} y={-8} width={len - 22} height={16} rx={4} fill="rgba(76,143,199,0.16)" stroke={GLASS} strokeWidth={2} />
        <path d={`M 20 -8 v -6 M ${len - 26} 8 v 6`} stroke={GLASS} strokeWidth={2} />
      </g>
      <Tube d={`M ${cond.x} ${cond.y} L ${end.x} ${end.y} L 288 ${end.y + 6} L 288 140`} />
      {/* What drips over, and the beaker it collects in. */}
      {depth > 0 && t < 1 && <circle cx={288} cy={144 + ((t * 7) % 1) * Math.max(2, 170 - depth - 146)} r={1.8} fill={CLEAR} />}
      {depth > 0.5 && <rect x={267} y={173 - depth} width={50} height={depth} fill={liquidFill(o.distillate)} opacity={0.9} />}
      <path d="M 262 120 L 266 124 L 266 170 Q 266 174 270 174 L 314 174 Q 318 174 318 170 L 318 124 L 322 120" fill={GLASS_FILL} stroke={GLASS} strokeWidth={2} strokeLinejoin="round" />
      <Place x={70} y={TOP + 15} role="Left in the flask" holds={named ? (o.reacted ? heated?.name : names(o.flask)) : undefined} />
      <Place x={292} y={TOP + 15} role="Distillate" holds={named ? (o.distillate.length ? names(o.distillate) : 'nothing') : undefined} />
    </g>
  )
}

function Chromatography({ o, t }: { o: Extract<Outcome, { method: 'chromatography' }>; t: number }) {
  const base = 142
  const front = 152 - t * 102
  const climbed = Math.max(0, base - front)
  const dyes = o.moved.flatMap((s) => SUBSTANCES[s].dyes ?? [])
  return (
    <g>
      <rect x={129} y={152} width={102} height={21} fill={CLEAR} opacity={0.85} />
      <rect x={160} y={38} width={40} height={120} fill={PAPER} />
      <rect x={160} y={front} width={40} height={158 - front} fill={CLEAR} opacity={0.28} />
      <line x1={162} y1={base} x2={198} y2={base} stroke={PENCIL} strokeWidth={1.2} strokeDasharray="3 2" />
      <path d={`M 177 ${base - 3} l 6 6 M 183 ${base - 3} l -6 6`} stroke={PENCIL} strokeWidth={1} />
      {dyes.length > 0 && <ellipse cx={180} cy={base} rx={7} ry={5} fill={GRAIN.dyes} opacity={clamp(1 - climbed / 24)} />}
      {dyes.map((d) => (
        <ellipse key={d.colour} cx={180} cy={base - d.rf * climbed} rx={6} ry={4.2} fill={DYE[d.colour].fill} stroke={DYE[d.colour].edge} strokeWidth={1.2} opacity={0.92} />
      ))}
      <Grains ids={o.stayed} box={[172, 137, 188, 147]} n={14} seed={31} />
      {t >= 0.98 && <line x1={160} y1={front} x2={200} y2={front} stroke="#2E6DA4" strokeWidth={1.5} strokeDasharray="3 2" />}
      <rect x={118} y={33} width={124} height={5} rx={2} fill={METAL} />
      <path d="M 128 34 L 128 170 Q 128 174 132 174 L 228 174 Q 232 174 232 170 L 232 34" fill={GLASS_FILL} stroke={GLASS} strokeWidth={2} strokeLinejoin="round" />
      {t >= 0.98 && (
        <g>
          <line x1={202} y1={front} x2={236} y2={front} stroke={LABEL} strokeOpacity={0.6} />
          <Place x={240} y={front + 4} anchor="start" role="Solvent front" />
        </g>
      )}
      <line x1={202} y1={base} x2={236} y2={base} stroke={LABEL} strokeOpacity={0.6} />
      <Place x={240} y={base + 4} anchor="start" role="Pencil line" />
      <Place x={180} y={TOP + 15} role="Solvent" />
    </g>
  )
}

function Magnet({ o, mixture, t, named }: { o: Extract<Outcome, { method: 'magnet' }>; mixture: MixtureId; t: number; named: boolean }) {
  const { liquids, dissolved, undissolved } = split(mixture)
  // The magnet comes down to the dish, waits, and lifts away.
  const bottom = t < 0.4 ? 96 + (t / 0.4) * 52 : t < 0.55 ? 148 : 148 - ((t - 0.55) / 0.45) * 52
  const lifted = t >= 0.4
  const inDish = (x: number, y: number) => y > 172 - 14 * (1 - ((x - 180) / 56) ** 2)
  const dish = liquids.length ? undissolved : o.left
  const all = lifted ? dish.filter((s) => !o.pulled.includes(s)) : [...dish, ...o.pulled.filter((s) => !dish.includes(s))]
  return (
    <g>
      {liquids.length > 0 && <rect x={119} y={157} width={122} height={16} fill={liquidFill([...liquids, ...dissolved])} opacity={0.9} />}
      <Grains ids={all} box={[124, 156, 236, 173]} inside={liquids.length ? (x, y) => y > 166 : inDish} n={liquids.length ? 26 : 60} seed={37} />
      <path d="M 118 152 L 118 170 Q 118 174 122 174 L 238 174 Q 242 174 242 170 L 242 152" fill={GLASS_FILL} stroke={GLASS} strokeWidth={2} strokeLinejoin="round" />
      <g>
        <rect x={166} y={bottom - 64} width={28} height={32} rx={3} fill="#C93D44" />
        <rect x={166} y={bottom - 32} width={28} height={32} rx={3} fill="#3D63C9" />
        <text x={180} y={bottom - 43} textAnchor="middle" fill="#FFFFFF" fontSize={12} fontWeight={700}>N</text>
        <text x={180} y={bottom - 11} textAnchor="middle" fill="#FFFFFF" fontSize={12} fontWeight={700}>S</text>
        {lifted && <Grains ids={o.pulled} box={[164, bottom, 196, bottom + 9]} n={24} seed={41} />}
      </g>
      <line x1={136} y1={104} x2={162} y2={104} stroke={LABEL} strokeOpacity={0.6} />
      <Place x={132} y={102} anchor="end" role="On the magnet" holds={named ? (o.pulled.length ? names(o.pulled) : 'nothing') : undefined} />
      <Place x={180} y={TOP + 15} role="In the dish" holds={named ? names(o.left) : undefined} />
    </g>
  )
}

/** The shelf's small pictures, in the card's ink. */
function Icon({ method }: { method: MethodId }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  const body: Record<MethodId, ReactNode> = {
    filtration: <><path d="M4 4 H20 L13.5 12 V20 H10.5 V12 Z" {...common} /><path d="M6.5 5.5 L12 11.5 L17.5 5.5" {...common} strokeWidth={1} /></>,
    evaporation: <><path d="M3 8 H21" {...common} /><path d="M4 8 Q12 17 20 8" {...common} /><path d="M12 22 Q9.5 19.5 12 16 Q14.5 19.5 12 22 Z" {...common} /></>,
    'simple-distillation': <><circle cx={6} cy={17} r={4} {...common} /><path d="M6 13 V5 M6 7 L20 13 V20" {...common} /></>,
    'fractional-distillation': <><circle cx={6} cy={19} r={3} {...common} /><path d="M4.5 16.3 V2 H7.5 V16.3 M7.5 3.5 L20 9 V16" {...common} /><circle cx={6} cy={7} r={0.8} fill="currentColor" /><circle cx={6} cy={11} r={0.8} fill="currentColor" /></>,
    chromatography: <><path d="M5 3 V21 H19 V3" {...common} /><path d="M3 3 H21" {...common} /><path d="M10 3 V17 H14 V3" {...common} strokeWidth={1.2} /><circle cx={12} cy={7} r={1} fill="currentColor" /><circle cx={12} cy={11} r={1} fill="currentColor" /></>,
    magnet: <path d="M6 4 V12 A6 6 0 0 0 18 12 V4 H14.5 V12 A2.5 2.5 0 0 1 9.5 12 V4 Z" {...common} />,
  }
  return <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true">{body[method]}</svg>
}

export function LabBenchView({ config, state, setState, marked, reduced, locked }: SceneViewProps<LabBenchConfig, LabBenchState>) {
  const { mixture, want } = config.task
  const method = state?.method && (METHODS as readonly string[]).includes(state.method) ? state.method : null
  // How far the picked apparatus has run: 0 to 1. A restored or reduced-motion pick shows where it ends.
  const [t, setT] = useState(1)
  const [runs, setRuns] = useState(0)
  const shelf = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => {
    if (runs === 0) return
    if (reduced) {
      const id = requestAnimationFrame(() => setT(1))
      return () => cancelAnimationFrame(id)
    }
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const p = clamp((now - start) / RUN_MS)
      setT(p)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [runs, reduced])

  const pick = (m: MethodId) => {
    if (locked) return
    setT(reduced ? 1 : 0)
    setRuns((r) => r + 1)
    setState({ method: m })
  }

  const onShelfKey = (e: KeyboardEvent<HTMLDivElement>) => {
    // The board moves a selected card with the arrows, and Enter and Space open it; here they work the shelf.
    if (e.key === 'Enter' || e.key === ' ') {
      e.stopPropagation()
      return
    }
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 3, ArrowUp: -3 }[e.key]
    if (step === undefined && e.key !== 'Home' && e.key !== 'End') return
    e.preventDefault()
    e.stopPropagation()
    const at = shelf.current.indexOf(e.target as HTMLButtonElement)
    const last = METHODS.length - 1
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? last : Math.min(last, Math.max(0, (at < 0 ? 0 : at) + (step ?? 0)))
    shelf.current[next]?.focus()
  }

  const named = marked !== 'idle'
  const o = method ? run(mixture, method) : null
  const done = t >= 1
  const m = MIXTURES[mixture]

  let scene: ReactNode = <Mixture mixture={mixture} />
  if (o?.method === 'filtration') scene = <Filtration o={o} mixture={mixture} t={t} named={named} />
  else if (o?.method === 'evaporation') scene = <Evaporation o={o} mixture={mixture} t={t} named={named} />
  else if (o?.method === 'simple-distillation' || o?.method === 'fractional-distillation') scene = <Distillation o={o} mixture={mixture} t={t} named={named} />
  else if (o?.method === 'chromatography') scene = <Chromatography o={o} t={t} />
  else if (o?.method === 'magnet') scene = <Magnet o={o} mixture={mixture} t={t} named={named} />

  return (
    <div className="nodrag flex flex-col gap-2.5">
      <div className="flex flex-wrap gap-1.5 text-[12px] font-bold">
        <span className="rounded-full border border-ss-line bg-ss-chip px-2.5 py-0.5 text-ss-ink">Mixture: {m.name}</span>
        <span className="rounded-full border border-ss-line bg-ss-chip px-2.5 py-0.5 text-ss-ink">Get: {wantLabel(want)}</span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full select-none" role="img" aria-label={method ? `${APPARATUS[method]}, set up with the ${m.name}` : `A beaker of ${m.name} on the bench`}>
        <rect width={W} height={H} rx={14} fill={PANEL} />
        <path d={`M 0 ${H - 14} L 0 ${TOP} H ${W} V ${H - 14} A 14 14 0 0 1 ${W - 14} ${H} H 14 A 14 14 0 0 1 0 ${H - 14} Z`} fill={BENCH} />
        {scene}
      </svg>

      <p className="min-h-[34px] text-[12px] font-semibold leading-snug text-ss-slate" aria-live="polite">
        {!method ? 'Pick apparatus from the shelf to try it on the mixture.' : done ? observe(mixture, method) : 'Watch what it does…'}
      </p>

      {named && method && (
        <div className="rounded-xl border border-ss-line bg-ss-chip px-3 py-2">
          <p className="text-[13px] font-extrabold text-ss-ink">{marked === 'wrong' ? `You used ${METHOD_NAMES[method]}` : METHOD_NAMES[method].charAt(0).toUpperCase() + METHOD_NAMES[method].slice(1)}</p>
          <p className="mt-0.5 text-[12px] leading-snug text-ss-ink">{explain(mixture, method, want)}</p>
        </div>
      )}
      {named && !method && <p className="text-[12px] font-bold text-ss-ink">Pick apparatus from the shelf first.</p>}

      <div role="group" aria-label="Apparatus shelf" className="grid grid-cols-3 gap-1.5" onKeyDown={onShelfKey}>
        {METHODS.map((id, i) => {
          const on = id === method
          return (
            <button
              key={id}
              ref={(el) => { shelf.current[i] = el }}
              type="button"
              aria-pressed={on}
              disabled={locked}
              onClick={() => pick(id)}
              className={`nodrag flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-xl border-2 px-1 py-1.5 text-center text-[12px] font-bold leading-tight text-ss-ink transition-colors motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-default ${on ? 'bg-ss-chip' : 'border-ss-line hover:bg-ss-chip'}`}
              style={on ? { borderColor: 'var(--subject)' } : undefined}
            >
              <Icon method={id} />
              {APPARATUS[id]}
            </button>
          )
        })}
      </div>
    </div>
  )
}
