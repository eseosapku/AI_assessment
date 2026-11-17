'use client'
import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import type { SceneViewProps } from '../types'
import type { FigConfig, FigState } from './config'
import { carriedOf, endingOf, figurativeEngine, looksOf, madeLines, picturedOf, sceneOf, sentenceOf, taskOf, working } from './config'

type Props = SceneViewProps<FigConfig, FigState>

// What a reader pictures, drawn as a small book illustration on a quiet plate with a hairline edge. The picture keeps its
// own colours in both themes, like measure-shape's plate; everything around it uses the ss tokens. Flat colours only.
const PLATE_EDGE = '#CBD5E1'
const INK = '#16202A'
// The one accent: amber, for the words that change and the cards carried.
const AMBER = '#B7791F'
const AMBER_FILL = '#FBEFD5'

export const W = 360
export const H = 190

const f1 = (n: number) => Number(n.toFixed(1))
const has = (looks: string[], k: string) => looks.includes(k)
/** A change eases over most of a second, so the eye sees it happen; under reduced motion it is simply there. */
const fade = (on: boolean, reduced: boolean, extra?: CSSProperties): CSSProperties => ({ opacity: on ? 1 : 0, ...(reduced ? {} : { transition: 'opacity 700ms ease' }), ...extra })
/** Grows up from its bottom edge, as snow piles up. */
const rise = (on: boolean, reduced: boolean): CSSProperties => ({
  opacity: on ? 1 : 0, transformBox: 'fill-box', transformOrigin: '50% 100%', transform: on ? 'scaleY(1)' : 'scaleY(0.3)',
  ...(reduced ? {} : { transition: 'transform 900ms ease-out, opacity 600ms ease' }),
})

const MOTION = `@keyframes fl-drift{0%{transform:translateX(-3px)}100%{transform:translateX(3px)}}@keyframes fl-fall{0%{transform:translateY(-12px)}100%{transform:translateY(200px)}}@keyframes fl-turn{to{transform:rotate(360deg)}}@keyframes fl-wind{to{stroke-dashoffset:-108}}@media (prefers-reduced-motion:reduce){.fl-anim{animation:none!important}}`

// ===========================================================================
// The lake. "The lake was like a mirror."

const LK = {
  sky: '#E7F0F7', farHill: '#B5CCBD', nearHill: '#9DBE95', grass: '#A9C47F', grassEdge: '#8DAA65', sand: '#E6D9AE',
  pine: '#3E6B4F', pineDark: '#2F5640', trunk: '#6B4A2E', wall: '#B4533B', roof: '#5A3A2C', pane: '#F3E3A6',
  water: '#86B9DB', churn: '#6F9DBD', waterEdge: '#5D93BA', ripple: '#D6E9F6', rippleDark: '#6CA2C8', sheen: '#C6E0F1',
  // The same things seen in the water: each colour mixed with the lake's blue.
  rFar: '#9DC2CC', rNear: '#8FBAB6', rPine: '#5A8890', rPineDark: '#4C7A84', rWall: '#A07F86', rRoof: '#677486',
  frame: '#9A5B2A', frameDark: '#6A3B18', frameLight: '#C98D52', nail: '#64748B',
  crack: '#FFFFFF', crackEdge: '#2E5573', foam: '#FFFFFF', foamEdge: '#7FA6C2', reed: '#6F8F4A', reedHead: '#7A4E2A',
}
/** The lake's water, and the far shore the reflection turns about. */
export const LAKE = { cx: 180, cy: 136, rx: 156, ry: 38, shore: 98 }

type Tone = 'real' | 'mirror'

function Pine({ x, base, h, tone }: { x: number; base: number; h: number; tone: Tone }) {
  const light = tone === 'real' ? LK.pine : LK.rPine
  const dark = tone === 'real' ? LK.pineDark : LK.rPineDark
  return (
    <g>
      <rect x={x - 1.6} y={base - 7} width={3.2} height={7} fill={tone === 'real' ? LK.trunk : LK.rRoof} />
      {[0, 1, 2].map((k) => {
        const apex = base - h + k * h * 0.24
        const bottom = apex + h * 0.44
        const half = h * (0.2 + k * 0.08)
        return (
          <g key={k}>
            <path d={`M${f1(x)} ${f1(apex)}L${f1(x - half)} ${f1(bottom)}L${f1(x)} ${f1(bottom)}Z`} fill={light} />
            <path d={`M${f1(x)} ${f1(apex)}L${f1(x)} ${f1(bottom)}L${f1(x + half)} ${f1(bottom)}Z`} fill={dark} />
          </g>
        )
      })}
    </g>
  )
}

const PINES = [{ x: 30, h: 30 }, { x: 46, h: 40 }, { x: 64, h: 28 }, { x: 84, h: 22 }, { x: 266, h: 34 }, { x: 286, h: 46 }, { x: 308, h: 32 }, { x: 328, h: 40 }]

/** The far shore: hills, pines and a cabin. Drawn twice: once real, once upside down in the water. */
function FarShore({ tone }: { tone: Tone }) {
  const real = tone === 'real'
  return (
    <g>
      <path d="M0 96L0 62C40 48 82 44 120 56C150 66 176 60 206 46C242 30 286 36 320 54C338 62 350 60 360 56L360 96Z" fill={real ? LK.farHill : LK.rFar} />
      <path d="M0 96L0 76C34 68 76 70 116 84L132 96ZM222 96C254 80 302 70 360 74L360 96Z" fill={real ? LK.nearHill : LK.rNear} />
      {PINES.map((p) => <Pine key={p.x} x={p.x} base={100} h={p.h} tone={tone} />)}
      <g>
        <rect x={142} y={86} width={24} height={13} fill={real ? LK.wall : LK.rWall} />
        <path d="M139 87L154 76L169 87Z" fill={real ? LK.roof : LK.rRoof} />
        <rect x={151} y={91} width={6} height={8} fill={real ? LK.roof : LK.rRoof} />
        <rect x={144.5} y={89} width={4.5} height={4.5} fill={real ? LK.pane : LK.rFar} />
      </g>
    </g>
  )
}

/** A spiral of churning water, squashed by the view across the lake. */
function swirl(cx: number, cy: number, r: number): string {
  const pts: string[] = []
  for (let k = 0; k <= 40; k++) {
    const a = (k / 40) * Math.PI * 3.4
    const rr = 2 + (r - 2) * (k / 40)
    pts.push(`${k ? 'L' : 'M'}${f1(cx + rr * Math.cos(a))} ${f1(cy + rr * 0.5 * Math.sin(a))}`)
  }
  return pts.join('')
}

const RIPPLES: [number, number, number][] = [[56, 140, 22], [102, 126, 30], [150, 150, 26], [196, 132, 34], [246, 146, 24], [290, 130, 28], [118, 164, 30], [226, 164, 22], [312, 152, 18], [80, 154, 20], [172, 116, 24], [262, 118, 20]]
const CRACKS: [number, number][][] = [
  [[0, 0], [14, -4], [22, -2], [38, -8], [52, -6]],
  [[0, 0], [8, 8], [12, 16], [24, 22]],
  [[0, 0], [-6, 9], [-16, 14], [-22, 24]],
  [[0, 0], [-14, 2], [-26, -3], [-44, 0], [-58, -5]],
  [[0, 0], [-6, -8], [-16, -12], [-22, -20]],
  [[0, 0], [6, -10], [16, -16], [20, -24]],
]

function LakeScene({ looks, reduced, uid }: { looks: string[]; reduced: boolean; uid: string }) {
  const still = has(looks, 'still')
  const churn = has(looks, 'churn')
  const lake = `${uid}-water`
  const anim = (a: string): CSSProperties => (reduced ? {} : { animation: a })
  return (
    <g>
      <defs>
        <clipPath id={lake}><ellipse cx={LAKE.cx} cy={LAKE.cy} rx={LAKE.rx} ry={LAKE.ry} /></clipPath>
      </defs>
      <rect width={W} height={H} fill={LK.sky} />
      <rect y={92} width={W} height={H - 92} fill={LK.grass} />
      <FarShore tone="real" />
      <ellipse cx={LAKE.cx} cy={LAKE.cy + 1} rx={LAKE.rx + 4} ry={LAKE.ry + 3} fill={LK.sand} />
      <ellipse cx={LAKE.cx} cy={LAKE.cy} rx={LAKE.rx} ry={LAKE.ry} style={{ fill: churn ? LK.churn : LK.water, ...(reduced ? {} : { transition: 'fill 700ms ease' }) }} />
      <g clipPath={`url(#${lake})`}>
        {/* the far shore upside down in the water, turned about the shoreline */}
        <g data-look="reflect" style={fade(has(looks, 'reflect') && !churn, reduced)}>
          <g transform={`translate(0 ${LAKE.shore * 2}) scale(1 -1)`}><FarShore tone="mirror" /></g>
        </g>
        {/* glassy streaks on still water */}
        <g data-look="still" style={fade(still && !churn, reduced)} stroke={LK.sheen} strokeWidth={1.6} strokeLinecap="round">
          <line x1={40} x2={136} y1={128} y2={128} />
          <line x1={206} x2={322} y1={160} y2={160} />
          <line x1={120} x2={238} y1={170} y2={170} />
        </g>
        {/* little ripples, drifting, gone when the water is still */}
        <g style={fade(!still && !churn, reduced)}>
          <g className={reduced ? undefined : 'fl-anim'} style={anim('fl-drift 3.6s ease-in-out infinite alternate')} strokeLinecap="round" data-look="ripples">
            {RIPPLES.map(([x, y, l]) => (
              <g key={`${x}-${y}`}>
                <path d={`M${x - l / 2} ${y}Q${x} ${y - 3} ${x + l / 2} ${y}`} fill="none" stroke={LK.ripple} strokeWidth={2} />
                <line x1={x - l / 2 + 4} x2={x + l / 2 - 4} y1={y + 2.6} y2={y + 2.6} stroke={LK.rippleDark} strokeWidth={1.4} />
              </g>
            ))}
          </g>
        </g>
        {/* a washing machine: swirls and suds */}
        <g data-look="churn" style={fade(churn, reduced)}>
          {[[108, 148, 22], [196, 136, 26], [282, 152, 22]].map(([x, y, r], i) => (
            <g key={x}>
              <g className={reduced ? undefined : 'fl-anim'} style={{ transformBox: 'fill-box', transformOrigin: 'center', ...anim(`fl-turn ${12 + i * 3}s linear infinite`) }}>
                <path d={swirl(x, y, r)} fill="none" stroke={LK.foam} strokeWidth={2.4} strokeLinecap="round" />
              </g>
              {[[-r, 2, 4], [r * 0.8, -3, 3.4], [r * 0.3, r * 0.45, 4.6], [-r * 0.5, -r * 0.4, 3]].map(([dx, dy, rr], k) => (
                <circle key={k} cx={x + dx} cy={y + dy} r={rr} fill={LK.foam} stroke={LK.foamEdge} strokeWidth={1} />
              ))}
            </g>
          ))}
          {[40, 66, 96, 130, 168, 206, 240, 272, 304, 326].map((x, k) => (
            <circle key={x} cx={x} cy={LAKE.cy + LAKE.ry * Math.sqrt(Math.max(0, 1 - ((x - LAKE.cx) / LAKE.rx) ** 2)) - 4} r={3 + (k % 3)} fill={LK.foam} stroke={LK.foamEdge} strokeWidth={1} />
          ))}
        </g>
        {/* glass that cracked when it was dropped */}
        <g data-look="crack" style={fade(has(looks, 'crack'), reduced)} fill="none" strokeLinecap="round" strokeLinejoin="round">
          {CRACKS.map((pts, k) => {
            const d = pts.map(([x, y], j) => `${j ? 'L' : 'M'}${226 + x} ${146 + y}`).join('')
            return (
              <g key={k}>
                <path d={d} stroke={LK.crackEdge} strokeWidth={3.2} />
                <path d={d} stroke={LK.crack} strokeWidth={1.4} />
              </g>
            )
          })}
          <ellipse cx={226} cy={146} rx={11} ry={6} stroke={LK.crackEdge} strokeWidth={2.6} strokeDasharray="7 4" />
        </g>
      </g>
      {/* reeds at the near shore */}
      {[[10, 4], [18, 0], [26, 6], [36, 2], [326, 3], [336, 7], [344, 1], [352, 5]].map(([x, lean]) => (
        <g key={x}>
          <path d={`M${x} ${H}Q${x + 1} ${H - 14} ${x + lean} ${H - 26}`} fill="none" stroke={LK.reed} strokeWidth={1.8} strokeLinecap="round" />
          <ellipse cx={x + lean} cy={H - 27} rx={2.3} ry={5.2} fill={LK.reedHead} />
        </g>
      ))}
      {/* a mirror's frame, and the wire it would hang by */}
      <g data-look="frame" style={fade(has(looks, 'frame'), reduced)}>
        <path d="M112 97L180 64L248 97" fill="none" stroke={LK.nail} strokeWidth={1.4} />
        <circle cx={180} cy={63} r={2.6} fill={LK.nail} />
        <ellipse cx={LAKE.cx} cy={LAKE.cy} rx={LAKE.rx + 7} ry={LAKE.ry + 7} fill="none" stroke={LK.frame} strokeWidth={11} />
        <ellipse cx={LAKE.cx} cy={LAKE.cy} rx={LAKE.rx + 1.5} ry={LAKE.ry + 1.5} fill="none" stroke={LK.frameDark} strokeWidth={1.6} />
        <ellipse cx={LAKE.cx} cy={LAKE.cy} rx={LAKE.rx + 12.5} ry={LAKE.ry + 12.5} fill="none" stroke={LK.frameDark} strokeWidth={1.6} />
        <path d={`M${LAKE.cx - 120} ${LAKE.cy - 33}Q${LAKE.cx - 60} ${LAKE.cy - 47} ${LAKE.cx} ${LAKE.cy - 45}`} fill="none" stroke={LK.frameLight} strokeWidth={2} strokeLinecap="round" />
      </g>
    </g>
  )
}

// ===========================================================================
// The snow. "The snow was a blanket over the town."

const SN = {
  sky: '#E2EBF4', hill: '#F4F7FA', snow: '#FFFFFF', edge: '#B4C5D6', shade: '#DCE6EF', under: '#D3DEE8', ground: '#A7B094', grass: '#8DAA65',
  brick: '#B65A41', brickRoof: '#5E3428', mustard: '#D8A548', mustardRoof: '#7A4E2E', slate: '#5E7D9B', slateRoof: '#344558',
  pane: '#CFE3F2', sill: '#F4EFE6', pine: '#3E6B4F', pineDark: '#2F5640', post: '#2F3A46', lamp: '#F3E3A6',
  car: '#C4473C', carDark: '#93302A', tyre: '#2B2F36', hub: '#A3AEBA', wood: '#8A5A33', woodDark: '#62401F', iron: '#3F4651',
  print: '#C5D2DE', stitch: '#B9C7D5', stitchRed: '#C4473C', flake: '#FFFFFF', flakeEdge: '#AFC0D1', spark: '#FFFFFF',
}

/** The roofs, as [left eave, peak, right eave] -- one place for the houses and the snow on them. */
const ROOFS: [number, number][][] = [[[16, 86], [58, 56], [100, 86]], [[98, 98], [130, 74], [162, 98]], [[256, 82], [300, 52], [344, 82]]]

function roofCap(r: [number, number][], thick: number): string {
  const [[lx, ly], [px, py], [rx, ry]] = r
  // A layer lying on both slopes, hanging over the eaves, rounded on top.
  return `M${lx - 2} ${ly + 1}L${px} ${py - 1.2}L${rx + 2} ${ry + 1}Q${rx + 3} ${ry - thick * 0.9} ${rx - 4} ${ry - thick}L${px} ${py - thick * 1.3}L${lx + 4} ${ly - thick}Q${lx - 3} ${ly - thick * 0.9} ${lx - 2} ${ly + 1}Z`
}

function House({ k }: { k: number }) {
  const r = ROOFS[k]
  const [[lx], , [rx]] = r
  const wall = [SN.brick, SN.mustard, SN.slate][k]
  const roof = [SN.brickRoof, SN.mustardRoof, SN.slateRoof][k]
  const top = r[0][1] - 2
  const left = lx + 6
  const right = rx - 6
  const mid = (left + right) / 2
  const win = (x: number, y: number) => (
    <g key={`${x}-${y}`}>
      <rect x={x} y={y} width={13} height={13} fill={SN.pane} stroke={SN.sill} strokeWidth={1.6} />
      <path d={`M${x + 6.5} ${y}V${y + 13}M${x} ${y + 6.5}H${x + 13}`} stroke={SN.sill} strokeWidth={1.2} />
    </g>
  )
  return (
    <g>
      {k !== 1 && <rect x={k === 0 ? 72 : 318} y={k === 0 ? 58 : 54} width={8} height={18} fill={roof} />}
      <rect x={left} y={top} width={right - left} height={128 - top} fill={wall} />
      <path d={`M${r[0][0]} ${r[0][1]}L${r[1][0]} ${r[1][1]}L${r[2][0]} ${r[2][1]}Z`} fill={roof} />
      <rect x={mid - 6} y={106} width={12} height={22} rx={1.5} fill={roof} />
      {k === 1 ? win(left + 6, 104) : [win(left + 6, top + 10), win(right - 19, top + 10)]}
    </g>
  )
}

function Car() {
  return (
    <g>
      <path d="M50 158L60 142H92L102 158Z" fill={SN.car} />
      <path d="M58 156L64 145H75V156ZM79 156V145H90L96 156Z" fill={SN.pane} />
      <rect x={36} y={156} width={78} height={18} rx={6} fill={SN.car} />
      <rect x={36} y={168} width={78} height={6} rx={3} fill={SN.carDark} />
      <rect x={106} y={160} width={7} height={4.5} rx={1.5} fill={SN.lamp} />
      {[54, 98].map((x) => (
        <g key={x}>
          <circle cx={x} cy={176} r={7.5} fill={SN.tyre} />
          <circle cx={x} cy={176} r={3} fill={SN.hub} />
        </g>
      ))}
    </g>
  )
}

function Bench() {
  return (
    <g>
      {[154, 200].map((x) => <rect key={x} x={x} y={163} width={3.5} height={18} fill={SN.iron} />)}
      <rect x={148} y={146} width={62} height={5} rx={1.5} fill={SN.wood} />
      <rect x={148} y={154} width={62} height={5} rx={1.5} fill={SN.wood} />
      <rect x={146} y={163} width={66} height={6} rx={1.5} fill={SN.woodDark} />
    </g>
  )
}

const GROUND = 'M0 130C40 126 80 132 120 128S200 126 240 130S320 126 360 129L360 190L0 190Z'
const DEEP = 'M0 117C30 109 60 115 90 112S150 109 190 115S260 107 300 113S345 109 360 111L360 190L0 190Z'
const CAR_MOUND = 'M28 188C25 172 29 160 40 155C47 151 51 145 57 140C65 132 89 132 97 140C103 146 108 151 117 154C125 158 127 172 125 188Z'
const BENCH_MOUND = 'M137 188C135 168 139 151 149 144C160 138 198 138 209 144C219 151 223 168 221 188Z'
const FRONT_DRIFT = 'M0 190V180C30 176 60 180 90 177S150 175 190 179S260 175 300 178S345 176 360 177V190Z'
const FOLD = { a: [296, 190], b: [360, 148] } as const
/** The corner of the snow, folded back over itself along the line from a to b. */
export function foldFlap(): [number, number][] {
  const [ax, ay] = FOLD.a
  const [bx, by] = FOLD.b
  const [px, py] = [360, 190]
  const dx = bx - ax
  const dy = by - ay
  const t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)
  const fx = ax + t * dx
  const fy = ay + t * dy
  return [[ax, ay], [bx, by], [f1(2 * fx - px), f1(2 * fy - py)]]
}

const FLAKES: [number, number, number][] = [[24, 20, 2.2], [62, 44, 1.8], [96, 16, 2.4], [132, 52, 2], [168, 26, 1.8], [196, 60, 2.3], [228, 18, 2], [252, 46, 1.8], [286, 30, 2.4], [318, 58, 2], [342, 22, 1.8], [146, 84, 2], [44, 72, 1.8], [272, 88, 2.1]]
const PRINTS: [number, number][] = [[228, 182], [240, 176], [252, 184], [264, 177], [276, 185], [288, 178]]

function sparkles(seed: number, n: number, x0: number, x1: number, y0: number, y1: number): [number, number][] {
  const out: [number, number][] = []
  let s = seed
  for (let k = 0; k < n; k++) {
    s = (s * 9301 + 49297) % 233280
    const a = s / 233280
    s = (s * 9301 + 49297) % 233280
    const b = s / 233280
    out.push([f1(x0 + a * (x1 - x0)), f1(y0 + b * (y1 - y0))])
  }
  return out
}

/** Knitted from wool: rows of stitches, with red stripes like a jumper's, laid over whatever snow the clip names. */
function Knit({ id, on, reduced }: { id: string; on: boolean; reduced: boolean }) {
  return (
    <g data-look="wool" style={fade(on, reduced)} clipPath={`url(#${id})`} fill="none" strokeLinecap="round" strokeLinejoin="round">
      {Array.from({ length: 10 }, (_, row) => {
        const y = 106 + row * 9
        const red = row === 4 || row === 7
        return (
          <path key={row} stroke={red ? SN.stitchRed : SN.stitch} strokeWidth={red ? 2 : 1.5}
            d={Array.from({ length: 41 }, (_, i) => `M${i * 9 + (row % 2) * 4.5} ${y}l3.5 4.5l3.5 -4.5`).join('')} />
        )
      })}
    </g>
  )
}

function SnowScene({ looks, reduced, uid }: { looks: string[]; reduced: boolean; uid: string }) {
  const thick = has(looks, 'thick')
  const cover = has(looks, 'cover')
  const dust = has(looks, 'dust')
  const wool = has(looks, 'wool')
  const fold = has(looks, 'fold')
  const knit = `${uid}-knit`
  const flap = foldFlap()
  const snowy = { fill: SN.snow, stroke: SN.edge, strokeWidth: 1.2 }
  return (
    <g>
      <defs>
        {/* the snow's surfaces, for the stitches when the snow is wool: the ground behind the street, then what lies on it */}
        <clipPath id={`${knit}-back`}><path d={thick ? DEEP : GROUND} /></clipPath>
        <clipPath id={`${knit}-front`}>
          {thick && <path d={FRONT_DRIFT} />}
          {cover && <path d={CAR_MOUND} />}
          {cover && <path d={BENCH_MOUND} />}
        </clipPath>
      </defs>
      <rect width={W} height={H} fill={SN.sky} />
      <path d="M0 122L0 92C50 70 100 72 150 86C190 96 220 80 260 70C300 60 340 70 360 78L360 122Z" fill={SN.hill} stroke={SN.edge} strokeWidth={1.2} />
      {/* the town */}
      {[0, 1, 2].map((k) => <House key={k} k={k} />)}
      <g>
        <rect x={207} y={116} width={4} height={12} fill={LK.trunk} />
        {[0, 1, 2].map((k) => {
          const apex = 64 + k * 16
          const half = 12 + k * 6
          return (
            <g key={k}>
              <path d={`M209 ${apex}L${209 - half} ${apex + 26}H209Z`} fill={SN.pine} />
              <path d={`M209 ${apex}V${apex + 26}H${209 + half}Z`} fill={SN.pineDark} />
            </g>
          )
        })}
      </g>
      <rect x={238.5} y={90} width={3} height={62} fill={SN.post} />
      <path d="M233 92H247L244 82H236Z" fill={SN.post} />
      <rect x={236.5} y={84} width={7} height={6} fill={SN.lamp} />
      {/* a little snow on the roofs */}
      <g style={fade(!dust && !thick, reduced)}>{ROOFS.map((r, k) => <path key={k} d={roofCap(r, 3.5)} {...snowy} />)}</g>
      {/* the ground: snow, or bare ground with a dusting on it */}
      <path d={GROUND} {...snowy} style={fade(!dust, reduced)} />
      <g data-look="dust" style={fade(dust, reduced)}>
        <path d={GROUND} fill={SN.ground} />
        {sparkles(7, 70, 4, 356, 132, 188).map(([x, y], k) => <circle key={k} cx={x} cy={y} r={k % 3 ? 1.2 : 1.7} fill={SN.snow} />)}
        {ROOFS.map((r, k) => sparkles(11 + k, 12, r[0][0] + 8, r[2][0] - 8, r[1][1] + 6, r[0][1] - 2).map(([x, y], j) => <circle key={`${k}-${j}`} cx={x} cy={y} r={1.1} fill={SN.snow} />))}
        {[[60, 148], [180, 176], [300, 160], [120, 186], [236, 140]].map(([x, y]) => (
          <path key={x} d={`M${x} ${y - 5}L${x + 1.3} ${y - 1.3}L${x + 5} ${y}L${x + 1.3} ${y + 1.3}L${x} ${y + 5}L${x - 1.3} ${y + 1.3}L${x - 5} ${y}L${x - 1.3} ${y - 1.3}Z`} fill={SN.spark} stroke={SN.edge} strokeWidth={0.8} />
        ))}
      </g>
      {/* deep snow: thick on the roofs, up the walls and half way up the doors */}
      <g data-look="thick" style={rise(thick, reduced)}><path d={DEEP} {...snowy} /></g>
      <g style={fade(thick, reduced)}>{ROOFS.map((r, k) => <path key={k} d={roofCap(r, 9)} {...snowy} />)}</g>
      {/* footprints in the snow */}
      <g style={fade(!dust && !cover && !thick, reduced)}>{PRINTS.map(([x, y]) => <ellipse key={x} cx={x} cy={y} rx={3.4} ry={2} fill={SN.print} />)}</g>
      <Knit id={`${knit}-back`} on={wool} reduced={reduced} />
      {/* the street: a parked car and a bench, each with a little snow on top */}
      <Car />
      <Bench />
      <g style={fade(!dust, reduced)}>
        <path d="M58 143Q76 138 94 143L92 145H60Z" {...snowy} />
        <path d="M146 163Q179 159 212 163V165H146Z" {...snowy} />
      </g>
      <g style={fade(dust, reduced)}>{sparkles(3, 10, 40, 110, 156, 166).map(([x, y], k) => <circle key={k} cx={x} cy={y} r={1.1} fill={SN.snow} />)}</g>
      {/* deep snow in front, burying the wheels and the bench's feet */}
      <g style={rise(thick, reduced)}>
        <path d={FRONT_DRIFT} {...snowy} />
        <path d="M54 143Q76 134 98 143L94 146H58Z" {...snowy} />
        <path d="M144 163Q179 154 214 163V166H144Z" {...snowy} />
      </g>
      {/* covered: the car and the bench are soft white shapes under the snow */}
      <g data-look="cover" style={rise(cover, reduced)}>
        <path d={CAR_MOUND} {...snowy} />
        <path d="M44 160C56 150 92 148 108 162" fill="none" stroke={SN.shade} strokeWidth={2} strokeLinecap="round" />
        <path d={BENCH_MOUND} {...snowy} />
        <path d="M150 162C164 155 194 155 208 162" fill="none" stroke={SN.shade} strokeWidth={2} strokeLinecap="round" />
        <path d="M232 84Q240 76 248 84L247 87H233Z" {...snowy} />
        {[0, 1, 2].map((k) => <path key={k} d={`M${209 - (11 + k * 6)} ${86 + k * 16}Q209 ${76 + k * 16} ${209 + 11 + k * 6} ${86 + k * 16}Z`} {...snowy} />)}
      </g>
      {(thick || cover) && <Knit id={`${knit}-front`} on={wool} reduced={reduced} />}
      {/* folded back at the corner, like the top of a bed: grass underneath */}
      <g data-look="fold" style={fade(fold, reduced)}>
        <path d={`M${FOLD.a[0]} ${FOLD.a[1]}L${FOLD.b[0]} ${FOLD.b[1]}L360 190Z`} fill={SN.grass} />
        {[[318, 186], [332, 180], [344, 172], [350, 184], [338, 188]].map(([x, y]) => <path key={x} d={`M${x} ${y}l-1.5 -5M${x + 3} ${y}l1 -5.5`} stroke="#6E8C4A" strokeWidth={1.2} strokeLinecap="round" />)}
        <path d={`M${flap.map(([x, y]) => `${x} ${y}`).join('L')}Z`} fill={SN.under} stroke={SN.edge} strokeWidth={1.2} strokeLinejoin="round" />
        <path d={`M${FOLD.a[0]} ${FOLD.a[1]}L${FOLD.b[0]} ${FOLD.b[1]}`} stroke={SN.edge} strokeWidth={2} />
      </g>
      {/* falling snow */}
      <g>
        {FLAKES.map(([x, y, r], k) => (reduced
          ? <circle key={k} cx={x} cy={y} r={r} fill={SN.flake} stroke={SN.flakeEdge} strokeWidth={0.8} />
          : (
            <g key={k} className="fl-anim" style={{ animation: `fl-fall ${10 + (k % 5)}s linear ${-((k * 1.7) % 10) - y / 20}s infinite` }}>
              <circle cx={x} cy={0} r={r} fill={SN.flake} stroke={SN.flakeEdge} strokeWidth={0.8} />
            </g>
          )))}
      </g>
    </g>
  )
}

// ===========================================================================
// The leaves. "The leaves danced in the wind." They move, so a little simulation drives them.

const LV = {
  sky: '#EEF3F8', ground: '#AEB873', groundEdge: '#8C9A55', trunk: '#6B4A2E', trunkDark: '#523620', wind: '#B4C3D1',
  trail: '#97A6B5', leg: '#5B3A1E', shoe: '#E58FA8', shoeEdge: '#A84D6A', arm: '#5B3A1E',
}
const LEAF_FILL = ['#D9822B', '#C2452D', '#E3A92F', '#B85A1E', '#E08A2A', '#C9542B']
const LEAF_EDGE = ['#8F4E14', '#7E2A1A', '#94691A', '#7A3A12', '#9C5A16', '#843419']
/** The crown: one mass of orange, its lower right edge in shadow and its upper left lit, with red clusters at the rim. */
const CROWN: [number, number, number][] = [[30, 62, 20], [54, 46, 26], [84, 42, 22], [66, 24, 18], [40, 86, 19], [72, 76, 26], [100, 64, 18], [94, 90, 15], [16, 72, 13]]
const CROWN_LIT: [number, number, number][] = [[48, 39, 13], [78, 35, 11], [61, 18, 9], [25, 56, 9]]
const CROWN_RED: [number, number, number][] = [[110, 56, 8], [8, 82, 7], [104, 100, 7], [44, 104, 7]]

export type LeafParams = { spin: number; leap: number; march: number; pair: number; rain: number; shoes: number; period: number }
export const LEAVES = 6
const START: [number, number][] = [[118, 60], [128, 78], [112, 96], [134, 66], [122, 88], [140, 56]]
const DRIFT = [128, 150, 172]
const GROUND_Y = 158
const TAU = Math.PI * 2

/** The looks a leaves picture asks for, as the numbers the motion eases towards. */
export function leafTarget(looks: string[]): LeafParams {
  const on = (k: string) => (looks.includes(k) ? 1 : 0)
  const period = looks.includes('slow') ? 13 : looks.includes('rain') ? 3.2 : looks.includes('leap') ? 8 : 7
  return { spin: on('spin'), leap: on('leap'), march: on('march'), pair: on('hands'), rain: on('rain'), shoes: on('shoes'), period }
}

const frac = (v: number) => v - Math.floor(v)
const mix = (a: number, b: number, t: number) => a + (b - a) * t

/** A leaf falling from (sx, sy) towards (ex, the ground), at u of the way, with whatever it has been given. */
function freePose(u: number, sx: number, sy: number, ex: number, seed: number, p: LeafParams) {
  const w = TAU * 2 * u + seed
  // Falling: down and along with the wind, rocking a little.
  let x = mix(sx, ex, u) + 7 * Math.sin(w)
  let y = mix(sy, GROUND_Y, u)
  let rot = 18 * Math.sin(w) + 10
  // Like rain: straight down, stem up.
  x = mix(x, sx + 8 * u, p.rain)
  rot = mix(rot, -90, p.rain)
  // Spinning: loops along the way, turning right round.
  const s = TAU * 3 * u + seed
  x += 15 * p.spin * Math.cos(s)
  y += 11 * p.spin * Math.sin(s)
  rot += p.spin * 1080 * u
  // Leaping: bounding up again and again on the way down.
  y -= p.leap * 24 * Math.abs(Math.sin(TAU * 2.5 * u + seed))
  return { x, y, rot, alpha: Math.min(1, u / 0.08, (1 - u) / 0.1) }
}

/** Partners dance on one lane, a third of the way apart and in step, so no pair runs into another. */
const PAIR_LANE = { sx: 114, sy: 60, ex: 290 }

/** Where leaf i is at a moment of the motion: plain falling, plus whatever the leaves have been given. */
export function leafPose(i: number, phase: number, p: LeafParams): { x: number; y: number; rot: number; alpha: number } {
  const u = frac(phase + i / LEAVES)
  const [sx, sy] = START[i]
  let { x, y, rot, alpha } = freePose(u, sx, sy, sx + DRIFT[i % 3], i, p)
  // Holding hands: each leaf beside its partner, the pair falling as one.
  if (p.pair > 0) {
    const lead = i - (i % 2)
    const o = freePose(frac(phase + lead / LEAVES), PAIR_LANE.sx, PAIR_LANE.sy, PAIR_LANE.ex, 0, p)
    const side = i % 2 ? 17 : -17
    x = mix(x, o.x + side, p.pair)
    y = mix(y, o.y, p.pair)
    rot = mix(rot, o.rot, p.pair)
    alpha = mix(alpha, o.alpha, p.pair)
  }
  // Marching: a stiff row, standing up, stepping in time on the spot.
  const step = frac(phase * 7)
  const lift = step < 0.5 ? Math.sin(step * TAU) * 6 : 0
  x = mix(x, 128 + i * 38, p.march)
  y = mix(y, 120 - lift, p.march)
  rot = mix(rot, -90, p.march)
  alpha = mix(alpha, 1, p.march)
  return { x, y, rot, alpha: Math.max(0, alpha) }
}

const STILL_PHASE = 0.31
/** Leaves are drawn larger than life, so a pair of shoes on one can be seen. */
export const LEAF_SCALE = 1.3

function Leaf({ k, x, y, rot, alpha, shoes }: { k: number; x: number; y: number; rot: number; alpha: number; shoes: number }) {
  return (
    <g transform={`translate(${f1(x)} ${f1(y)}) rotate(${f1(rot)}) scale(${LEAF_SCALE})`} opacity={f1(alpha)} data-leaf={k}>
      <g opacity={f1(shoes)} data-shoes={k}>
        <path d="M-3 4L-5 12M3 4L5 12" stroke={LV.leg} strokeWidth={1.4} strokeLinecap="round" />
        <ellipse cx={-6.5} cy={13} rx={3.6} ry={2} fill={LV.shoe} stroke={LV.shoeEdge} strokeWidth={0.9} />
        <ellipse cx={6.5} cy={13} rx={3.6} ry={2} fill={LV.shoe} stroke={LV.shoeEdge} strokeWidth={0.9} />
      </g>
      <path d="M-11 0C-6 -7 5 -8 11 0C5 8 -6 7 -11 0Z" fill={LEAF_FILL[k]} stroke={LEAF_EDGE[k]} strokeWidth={1.1} />
      <path d="M-11 0L8 0M-3 0L2 -4M-3 0L2 4M3 0L6 -2.6M3 0L6 2.6" stroke={LEAF_EDGE[k]} strokeWidth={0.9} strokeLinecap="round" fill="none" />
      <path d="M-11 0L-15 1.6" stroke={LEAF_EDGE[k]} strokeWidth={1.4} strokeLinecap="round" />
    </g>
  )
}

const ease = (now: LeafParams, to: LeafParams, k: number): LeafParams => ({
  spin: mix(now.spin, to.spin, k), leap: mix(now.leap, to.leap, k), march: mix(now.march, to.march, k), pair: mix(now.pair, to.pair, k),
  rain: mix(now.rain, to.rain, k), shoes: mix(now.shoes, to.shoes, k), period: mix(now.period, to.period, k),
})

function LeavesScene({ looks, reduced }: { looks: string[]; reduced: boolean }) {
  const target = leafTarget(looks)
  const goal = useRef(target)
  goal.current = target
  const [live, setLive] = useState({ phase: STILL_PHASE, p: target })
  const run = useRef(live)
  useEffect(() => {
    if (reduced) return
    let raf = 0
    let last = 0
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick)
      const dt = last ? Math.min(0.05, (t - last) / 1000) : 0.016
      last = t
      // The leaves change their way of moving over about a second, so the change is seen being made.
      const p = ease(run.current.p, goal.current, 1 - Math.exp(-dt / 0.35))
      run.current = { phase: run.current.phase + dt / p.period, p }
      setLive(run.current)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [reduced])
  const { phase, p } = reduced ? { phase: STILL_PHASE, p: target } : live
  const poses = Array.from({ length: LEAVES }, (_, i) => leafPose(i, phase, p))
  // A still frame shows each leaf's way of moving as a dotted trail behind it.
  // As far as a leaf goes in a second and a half: a short trail is a slow leaf.
  const span = 1.5 / p.period
  const trails = reduced && p.march < 0.5
    ? Array.from({ length: LEAVES }, (_, i) => {
      const pts: string[] = []
      let lastU = -1
      for (let k = 0; k <= 16; k++) {
        const ph = phase - span + (span * k) / 16
        const u = frac(ph + i / LEAVES)
        if (u < lastU) pts.length = 0
        lastU = u
        const q = leafPose(i, ph, p)
        pts.push(`${pts.length ? 'L' : 'M'}${f1(q.x)} ${f1(q.y)}`)
      }
      return pts.join('')
    })
    : []
  return (
    <g>
      <rect width={W} height={H} fill={LV.sky} />
      <g fill="none" stroke={LV.wind} strokeWidth={2} strokeLinecap="round" strokeDasharray="44 10">
        {['M130 30C170 20 210 40 252 30S320 22 350 32', 'M150 102C196 90 236 112 280 100S334 94 352 102', 'M128 142C170 134 214 150 258 140S326 136 350 142'].map((d, k) => (
          <path key={k} d={d} className={reduced ? undefined : 'fl-anim'} style={reduced ? undefined : { animation: `fl-wind ${4 + k}s linear infinite` }} />
        ))}
      </g>
      <path d="M0 168C60 162 140 170 220 166S320 164 360 167L360 190L0 190Z" fill={LV.ground} stroke={LV.groundEdge} strokeWidth={1.2} />
      {/* the tree, its crown in autumn colours */}
      <path d="M52 170C58 150 60 120 58 92L66 92C66 120 70 150 78 170Z" fill={LV.trunk} />
      <path d="M62 100C52 86 40 80 30 72M64 96C76 84 88 76 100 70M60 116C50 108 42 104 34 100" fill="none" stroke={LV.trunkDark} strokeWidth={3} strokeLinecap="round" />
      {CROWN.map(([x, y, r]) => <circle key={`s${x}-${y}`} cx={x + 4} cy={y + 5} r={r} fill="#B85A1E" />)}
      {CROWN_RED.map(([x, y, r]) => <circle key={`r${x}-${y}`} cx={x} cy={y} r={r} fill="#C2452D" />)}
      {CROWN.map(([x, y, r]) => <circle key={`m${x}-${y}`} cx={x} cy={y} r={r} fill="#D9822B" />)}
      {CROWN_LIT.map(([x, y, r]) => <circle key={`l${x}-${y}`} cx={x} cy={y} r={r} fill="#E8A93A" />)}
      {/* leaves already down */}
      {[[18, 178, 20, 2], [96, 176, -30, 0], [196, 180, 60, 4], [262, 177, -12, 1], [330, 181, 34, 3]].map(([x, y, r, k]) => (
        <g key={x} transform={`translate(${x} ${y}) rotate(${r}) scale(0.8)`}>
          <path d="M-11 0C-6 -7 5 -8 11 0C5 8 -6 7 -11 0Z" fill={LEAF_FILL[k]} stroke={LEAF_EDGE[k]} strokeWidth={1.1} />
        </g>
      ))}
      {trails.map((d, i) => <path key={i} d={d} fill="none" stroke={LV.trail} strokeWidth={1.3} strokeDasharray="1.5 4" strokeLinecap="round" data-trail={i} />)}
      {/* partners: arms joined between each pair */}
      {p.pair > 0.02 && [0, 2, 4].map((i) => {
        const a = poses[i]
        const b = poses[i + 1]
        const mx = (a.x + b.x) / 2
        const my = (a.y + b.y) / 2 + 6
        return (
          <g key={i} opacity={f1(p.pair * Math.min(a.alpha, b.alpha))} data-hands={i}>
            <path d={`M${f1(a.x + 7)} ${f1(a.y + 3)}L${f1(mx)} ${f1(my)}L${f1(b.x - 7)} ${f1(b.y + 3)}`} fill="none" stroke={LV.arm} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={f1(mx)} cy={f1(my)} r={2.4} fill={LV.arm} />
          </g>
        )
      })}
      {poses.map((q, k) => <Leaf key={k} k={k} {...q} shoes={p.shoes} />)}
    </g>
  )
}

// ===========================================================================
// The card.

function Pip({ on, kind }: { on: boolean; kind: 'carry' | 'pick' }) {
  if (kind === 'pick') {
    return (
      <svg viewBox="0 0 14 14" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
        <circle cx={7} cy={7} r={5.6} fill="none" stroke={on ? AMBER : 'currentColor'} strokeWidth={1.6} opacity={on ? 1 : 0.55} />
        {on && <circle cx={7} cy={7} r={3} fill={AMBER} />}
      </svg>
    )
  }
  // An arrow up, into the picture; filled once it is carried there.
  return (
    <svg viewBox="0 0 14 14" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
      <rect x={0.8} y={0.8} width={12.4} height={12.4} rx={3.5} fill={on ? AMBER : 'none'} stroke={on ? AMBER : 'currentColor'} strokeWidth={1.4} opacity={on ? 1 : 0.55} />
      <path d="M7 10.2V4M4.4 6.4L7 3.8L9.6 6.4" fill="none" stroke={on ? '#FFFFFF' : 'currentColor'} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" opacity={on ? 1 : 0.7} />
    </svg>
  )
}

function Card({ on, kind, label, text, disabled, onPress }: { on: boolean; kind: 'carry' | 'pick'; label: string; text: string; disabled: boolean; onPress(): void }) {
  return (
    <button
      type="button" aria-pressed={on} aria-label={label} disabled={disabled} onClick={onPress}
      className={`nodrag inline-flex items-center gap-1 whitespace-nowrap rounded-lg border-2 px-1.5 py-1 text-[13px] font-bold leading-5 touch-manipulation outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--subject)] focus-visible:ring-offset-1 disabled:cursor-default motion-reduce:transition-none ${on ? '' : 'border-ss-line bg-ss-panel text-ss-ink hover:border-[color:var(--subject)]'}`}
      style={on ? { background: AMBER_FILL, borderColor: AMBER, color: INK } : undefined}
    >
      <Pip on={on} kind={kind} />
      {text}
    </button>
  )
}

export function FigurativeView({ config, state, setState, marked, reduced, locked }: Props) {
  const uid = `fl${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const now = marked === 'shown' ? figurativeEngine.solve(config) : state
  const scene = sceneOf(config)
  const task = taskOf(config)
  const looks = looksOf(config, now)
  const carried = carriedOf(config, now)
  const ending = endingOf(config, now)
  const line = sentenceOf(config, now)
  const pictured = picturedOf(scene, looks)
  const finished = marked === 'right' || marked === 'shown'
  const [lead, rest] = finished ? working(config) : marked === 'wrong' ? madeLines(config, now) : ['', '']

  const toggle = (id: string) => {
    if (locked) return
    setState({ carried: carried.includes(id) ? carried.filter((x) => x !== id) : [...carried, id] })
  }
  const choose = (id: string) => {
    if (locked) return
    setState({ ending: ending?.id === id ? null : id })
  }

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-2">
      {!reduced && <style>{MOTION}</style>}
      <p className="m-0 text-[18px] font-semibold leading-snug text-ss-ink" data-sentence="">
        {line.before}
        {task === 'carry' ? (
          <span style={{ textDecorationLine: 'underline', textDecorationColor: AMBER, textDecorationThickness: 3, textUnderlineOffset: 4 }}>{line.middle}</span>
        ) : (
          <span className="inline-block whitespace-nowrap rounded-md px-1 leading-tight" style={{ border: `2px ${ending ? 'solid' : 'dashed'} ${AMBER}` }}>{line.middle}</span>
        )}
        {line.after}
      </p>
      <p className="m-0 flex gap-1 text-[12px] font-bold leading-snug text-ss-slate">
        <span className="shrink-0 text-ss-ink">Aim:</span>
        <span>{task === 'carry' ? 'make the picture the writer meant.' : scene.aim.charAt(0).toLowerCase() + scene.aim.slice(1)}</span>
      </p>
      <figure className="m-0 flex w-full flex-col gap-1">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`What a reader pictures: ${pictured}.`} className="block h-auto w-full select-none" data-scene={scene.id}>
          <defs><clipPath id={`${uid}-plate`}><rect x={0.75} y={0.75} width={W - 1.5} height={H - 1.5} rx={14} /></clipPath></defs>
          <g clipPath={`url(#${uid}-plate)`}>
            {scene.id === 'lake' && <LakeScene looks={looks} reduced={reduced} uid={uid} />}
            {scene.id === 'snow' && <SnowScene looks={looks} reduced={reduced} uid={uid} />}
            {scene.id === 'leaves' && <LeavesScene looks={looks} reduced={reduced} />}
          </g>
          <rect x={0.75} y={0.75} width={W - 1.5} height={H - 1.5} rx={14} fill="none" stroke={PLATE_EDGE} strokeWidth={1.5} />
        </svg>
        <figcaption className="text-center text-[12px] font-bold text-ss-slate">What a reader pictures</figcaption>
      </figure>
      <div className="flex flex-col gap-1.5">
        <span className="text-[12px] font-bold text-ss-slate">{task === 'carry' ? `${scene.ask} Tap to carry it into the picture.` : 'Tap an ending to finish the sentence.'}</span>
        <div className="flex flex-wrap gap-1.5">
          {task === 'carry'
            ? scene.qualities.map((q) => {
              const on = carried.includes(q.id)
              return <Card key={q.id} kind="carry" on={on} text={q.text} disabled={locked} onPress={() => toggle(q.id)} label={on ? `Take "${q.text}" out of the picture` : `Carry "${q.text}" into the picture`} />
            })
            : scene.endings.map((e) => {
              const on = ending?.id === e.id
              return <Card key={e.id} kind="pick" on={on} text={e.text} disabled={locked} onPress={() => choose(e.id)} label={on ? `Take out the ending "${e.text}"` : `Finish the sentence with "${e.text}"`} />
            })}
        </div>
      </div>
      <span className="sr-only" aria-live="polite">{`A reader pictures ${pictured}.`}</span>
      {marked !== 'idle' && (
        <div className="rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2" aria-live="polite">
          <p className="m-0 text-[13px] font-extrabold leading-snug text-ss-ink">{lead}</p>
          {rest && <p className="m-0 mt-0.5 text-[12px] font-semibold leading-snug text-ss-slate">{rest}</p>}
        </div>
      )}
    </div>
  )
}
