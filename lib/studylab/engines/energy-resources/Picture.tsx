/**
 * Energy resources: a small valley town and the power stations the student has built for it, at one moment of a day.
 * Wind turbines stand on the ridge, rows of solar panels on the slope, coal power stations by the river (they need its
 * water to cool), and six homes sit in the town. The weather and the time of day decide what each station can make;
 * the homes light when there is enough, and the chimneys smoke when coal is burning.
 *
 * Pure picture: no hooks, no state, no clicks. The View works out what the stations make and passes the meaning in.
 * A landscape is not a dark subject: it keeps its own colours in both themes, on its own framed plate.
 */
import type { CSSProperties } from 'react'

export type Time = 'noon' | 'evening' | 'night'
export type Wind = 'still' | 'windy'
export type Sky = 'clear' | 'cloudy'

export interface PictureProps {
  /** The moment shown. 'noon': sun high, daylight. 'evening': just after sunset, dusk with a warm glow where the sun went
   *  down. 'night': dark, with the moon and stars. Changing it plays the signature motion: the sun sinks behind the hills. */
  time: Time
  /** 'windy' spins every built turbine, leans the trees and bends the smoke away; 'still' stops the rotors and the smoke
   *  rises straight up. */
  wind: Wind
  /** 'cloudy' greys the sky and draws cloud over the sun (or the moon). */
  sky: Sky
  /** Wind turbines built on the ridge, 0 to 3. */
  turbines: number
  /** Rows of solar panels built on the slope, 0 to 3. */
  panels: number
  /** Coal power stations built by the river, 0 to 3. */
  coal: number
  /** Homes' worth of electricity the coal stations are making at this moment, 0 to 9. Each station makes up to 3 and they
   *  are filled in order, so 4 means the first at full and the second at a third. Smoke and furnace glow follow it. */
  coalOutput: number
  /** Homes with electricity at this moment, 0 to 6. Windows light in reading order: the back row left to right, then the
   *  front row. When it falls, the homes go dark one after another from the last. */
  lit: number
  /** What the student just changed. 'time': the sky changes first and the homes and smoke answer once the sun has gone,
   *  about a second later. 'mix' (the default): they answer at once. */
  changed?: 'mix' | 'time'
  /** Reduced motion: no transitions; rotors and smoke are drawn still, at the same end frame. */
  reduced?: boolean
}

const W = 376
const H = 256
const HOMES = 6
const PER = 3
const FONT = 'system-ui, sans-serif'

// Sky, by time of day. Evening keeps a warm glow low on the right, where the sun has just gone down (the west).
const NOON_TOP = '#8EC3E8'
const NOON_LOW = '#DDEFF8'
const EVE_TOP = '#3B4878'
const EVE_MID = '#8A6F92'
const EVE_LOW = '#F1B47A'
const NIGHT_TOP = '#25335F'
const NIGHT_LOW = '#3D4C7B'
const OVERCAST = '#B7C1CB'
const SUN = '#F6CD58'
const SUN_HALO = '#FBE6A2'
const MOON = '#F4F0DC'
const STAR = '#EEF2F8'
const CLOUD = '#F4F6F8'
const CLOUD_EDGE = '#C3CCD5'
// Land: hazy far hills, green ridge and valley, a pale river.
const HILL_FAR = '#BACFCA'
const HILL_MID = '#A3BFB2'
const VALLEY = '#A8CA8E'
const RIDGE = '#8DB972'
const RIDGE_SHADE = '#7FAC66'
const RIVER = '#8DB9D5'
const RIVER_LIGHT = '#BAD7E9'
const TRUNK = '#7A5B43'
const LEAF = '#6C9C58'
const LEAF_LIGHT = '#82B06A'
// Turbines: white steel.
const TOWER = '#F4F5F6'
const STEEL_EDGE = '#959FA9'
const AIR_LIGHT = '#D95B4B'
// Solar panels: deep blue cells in a grey frame; the sheen is sunlight caught on the glass.
const PANEL = '#30507D'
const PANEL_EDGE = '#3B4859'
const PANEL_LINE = '#5D7BA4'
const SHEEN = '#D3E6F6'
// Coal station: brick boiler house, concrete chimney, furnace glow in its windows when it burns.
const BRICK = '#9B6A54'
const BRICK_EDGE = '#6C4838'
const SLATE = '#5B6470'
const CONCRETE = '#C2BCB2'
const CONCRETE_EDGE = '#857F75'
const SOOT = '#5E5A55'
const FURNACE = '#F0A54B'
const SMOKE: Record<Time, string> = { noon: '#999FA7', evening: '#8E93A0', night: '#8D94A6' }
// Homes: cream walls, tiled and slate roofs; dark glass, and warm lamp light when the home has electricity.
const WALLS = ['#EFE5D3', '#E8DBC5', '#F2E9DB']
const ROOFS = ['#B4644A', '#6E7887', '#A65E48']
const WALL_EDGE = '#8E7D66'
const DOOR = '#7A5A44'
const GLASS = '#5F738A'
const LAMP = '#F7CA5E'
// The dusk: one dark wash over the whole scene, deeper at night; lit windows, smoke and labels sit above it.
const INK = '#0C1630'
const WASH: Record<Time, number> = { noon: 0, evening: 0.3, night: 0.55 }
const PLATE_EDGE = '#CBD5E1'

type P = { x: number; y: number }
/** Hubs and tower feet of the three turbine places along the ridge's crest. */
const TURBINES = [
  { hub: { x: 30, y: 45 }, foot: 96, phase: 8 },
  { hub: { x: 76, y: 38 }, foot: 89, phase: 52 },
  { hub: { x: 122, y: 47 }, foot: 98, phase: 95 },
]
const ROTOR = 20
/** Front-left corner of each row of solar panels on the lower slope. */
const ARRAYS: P[] = [
  { x: 18, y: 197 },
  { x: 74, y: 208 },
  { x: 130, y: 219 },
]
/** Left edge of each coal station's boiler house on the riverbank; its chimney stands just to the right. */
const STATIONS = [236, 268, 300]
const STATION_BASE = 156
const CHIMNEY_TOP = 96
/** The six homes, in the order they light: back row left to right, then the front row. */
const HOUSES = [
  { x: 232, base: 218, h: 18 },
  { x: 276, base: 218, h: 18 },
  { x: 320, base: 218, h: 18 },
  { x: 246, base: 250, h: 20 },
  { x: 290, base: 250, h: 20 },
  { x: 334, base: 250, h: 20 },
]
const HOUSE_W = 30
/** Left edges of the two ground-floor windows, either side of the door. */
const WINDOWS = [3, 21]
const ROOF_H = 13
/** Where the sun is at noon, and how far it slides to set behind the hills on the right. */
const SUN_AT: P = { x: 182, y: 34 }
const SUN_SET: P = { x: 170, y: 136 }
const STARS: P[] = [
  { x: 150, y: 16 }, { x: 214, y: 22 }, { x: 242, y: 10 }, { x: 108, y: 11 }, { x: 300, y: 28 },
  { x: 348, y: 16 }, { x: 266, y: 54 }, { x: 160, y: 66 }, { x: 18, y: 12 }, { x: 58, y: 9 }, { x: 362, y: 64 },
]

/** Smoke is drawn as soft puffs that rise and spread from the chimney mouth, one leaving every half second. */
const PUFFS = 11
const PUFF_S = 5.5
const SKY_MS = 1400
const LAG_MS = 1100
const EASE = 'cubic-bezier(.4,0,.2,1)'

const n = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(Number.isFinite(v) ? v : 0)))
const pts = (a: P[]) => a.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

/** One blade pointing straight up from the hub: broad near the root, a fine tip. */
const BLADE = 'M-1.2 -2.2 C-3.1 -7 -1.9 -13.5 -0.3 -20 Q0.4 -20.6 0.8 -19.8 C1.2 -13 1.5 -7 1.3 -2.2 Z'

function cloudPath(cx: number, cy: number, s: number) {
  const r = (v: number) => (v * s).toFixed(1)
  return (
    `M${cx - 26 * s} ${cy + 8 * s} ` +
    `a${r(8)} ${r(8)} 0 0 1 ${r(6)} ${r(-12)} ` +
    `a${r(12)} ${r(12)} 0 0 1 ${r(18)} ${r(-8)} ` +
    `a${r(10)} ${r(10)} 0 0 1 ${r(16)} ${r(4)} ` +
    `a${r(8)} ${r(8)} 0 0 1 ${r(12)} ${r(16)} Z`
  )
}

function Tree({ x, base, h, windy, t }: { x: number; base: number; h: number; windy: boolean; t: string }) {
  return (
    <g style={{ transform: `rotate(${windy ? -9 : 0}deg)`, transformOrigin: `${x}px ${base}px`, transformBox: 'view-box', transition: t }}>
      <rect x={x - 1} y={base - h * 0.5} width={2} height={h * 0.5} fill={TRUNK} />
      <ellipse cx={x} cy={base - h * 0.62} rx={h * 0.3} ry={h * 0.4} fill={LEAF} />
      <ellipse cx={x - h * 0.08} cy={base - h * 0.72} rx={h * 0.16} ry={h * 0.2} fill={LEAF_LIGHT} />
    </g>
  )
}

/** A puff's place along the smoke's path, f from 0 (at the chimney mouth) to 1 (gone). */
function puffAt(f: number, windy: boolean) {
  const dx = windy ? -64 * f : 4 * f * Math.sin(f * 9)
  const dy = windy ? -40 * f : -76 * f
  return { dx, dy, k: 0.6 + 1.6 * f, o: 0.62 * (1 - f) }
}

function Plume({ mx, burn, windy, reduced, colour, t }: { mx: number; burn: number; windy: boolean; reduced?: boolean; colour: string; t: string }) {
  const k = burn > 0 ? 0.5 + 0.5 * burn : 0.3
  const variant = (w: boolean) => (
    <g style={{ opacity: w === windy ? 1 : 0, transition: reduced ? 'none' : `opacity 600ms ${EASE}` }}>
      <ellipse cx={0} cy={-3} rx={3.4} ry={4} fill={colour} opacity={0.75} />
      {Array.from({ length: PUFFS }, (_, i) => {
        if (reduced) {
          const p = puffAt((i + 0.5) / PUFFS, w)
          return <circle key={i} r={6} fill={colour} opacity={p.o} transform={`translate(${p.dx.toFixed(1)} ${p.dy.toFixed(1)}) scale(${p.k.toFixed(2)})`} />
        }
        const style: CSSProperties = {
          animation: `${w ? 'er-puff-wind' : i % 2 ? 'er-puff-sway' : 'er-puff-still'} ${PUFF_S}s linear ${(-i * PUFF_S) / PUFFS}s infinite`,
          transformOrigin: '0px 0px',
        }
        return <circle key={i} r={6} fill={colour} style={style} />
      })}
    </g>
  )
  return (
    <g transform={`translate(${mx} ${CHIMNEY_TOP})`}>
      <g style={{ transform: `scale(${k})`, transformOrigin: '0px 0px', opacity: burn > 0 ? 0.55 + 0.45 * burn : 0, transition: t }}>
        {variant(false)}
        {variant(true)}
      </g>
    </g>
  )
}

function Label({ x, y, text, show, dark, t, anchor = 'start' }: { x: number; y: number; text: string; show: boolean; dark: boolean; t: string; anchor?: 'start' | 'middle' | 'end' }) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      fontFamily={FONT}
      fontSize={12}
      fontWeight={600}
      style={{
        fill: dark ? '#F1F5F9' : '#1E293B',
        stroke: dark ? 'rgba(12,22,48,0.78)' : 'rgba(255,255,255,0.85)',
        strokeWidth: 3,
        strokeLinejoin: 'round',
        paintOrder: 'stroke',
        opacity: show ? 1 : 0,
        transition: t,
      }}
    >
      {text}
    </text>
  )
}

export default function Picture(props: PictureProps) {
  const { time, wind, sky, reduced } = props
  const turbines = n(props.turbines, 0, 3)
  const panels = n(props.panels, 0, 3)
  const coal = n(props.coal, 0, 3)
  const coalOutput = n(props.coalOutput, 0, coal * PER)
  const lit = n(props.lit, 0, HOMES)
  const windy = wind === 'windy'
  const cloudy = sky === 'cloudy'
  const dark = time !== 'noon'
  const lag = props.changed === 'time' ? LAG_MS : 0

  const tr = (...parts: Array<[string, number, number?]>) =>
    reduced ? 'none' : parts.map(([p, ms, d = 0]) => `${p} ${ms}ms ${EASE} ${d}ms`).join(', ')
  const skyT = tr(['opacity', SKY_MS])
  const appear = tr(['opacity', 420], ['transform', 420])
  const labelT = tr(['opacity', 420], ['fill', SKY_MS], ['stroke', SKY_MS])

  const sheen = time === 'noon' ? (cloudy ? 0.22 : 0.78) : 0
  const sunMoved = time === 'noon' ? { x: 0, y: 0 } : SUN_SET
  const starOp = cloudy ? 0 : time === 'night' ? 1 : time === 'evening' ? 0.4 : 0
  const glowOp = time === 'night' ? 0.42 : time === 'evening' ? 0.3 : 0
  const burnOf = (i: number) => (i < coal ? Math.max(0, Math.min(PER, coalOutput - PER * i)) / PER : 0)

  const timeWords = { noon: 'Noon', evening: 'Evening, after sunset', night: 'Night' }[time]
  const aria =
    `${timeWords}, ${windy ? 'windy' : 'still'}, ${cloudy ? 'cloudy' : 'clear'}. ` +
    `${turbines} wind turbine${turbines === 1 ? '' : 's'}, ${panels} row${panels === 1 ? '' : 's'} of solar panels, ` +
    `${coal} coal power station${coal === 1 ? '' : 's'}${coal ? `, burning for ${coalOutput} homes` : ''}. ` +
    `${lit} of ${HOMES} homes lit.`

  const css =
    '@keyframes er-spin{to{transform:rotate(360deg)}}' +
    '@keyframes er-puff-still{0%{transform:translate(0px,0px) scale(.6);opacity:.58}45%{transform:translate(-3px,-34px) scale(1.3);opacity:.36}100%{transform:translate(4px,-76px) scale(2.2);opacity:0}}' +
    '@keyframes er-puff-sway{0%{transform:translate(0px,0px) scale(.6);opacity:.58}45%{transform:translate(4px,-34px) scale(1.3);opacity:.36}100%{transform:translate(1px,-76px) scale(2.2);opacity:0}}' +
    '@keyframes er-puff-wind{0%{transform:translate(0px,0px) scale(.6);opacity:.62}100%{transform:translate(-64px,-40px) scale(2.2);opacity:0}}'

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={aria}>
      <defs>
        <linearGradient id="er-sky-noon" x1="0" y1="0" x2="0" y2="160" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={NOON_TOP} />
          <stop offset="1" stopColor={NOON_LOW} />
        </linearGradient>
        <linearGradient id="er-sky-eve" x1="0" y1="0" x2="0" y2="160" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={EVE_TOP} />
          <stop offset="0.6" stopColor={EVE_MID} />
          <stop offset="1" stopColor={EVE_LOW} />
        </linearGradient>
        <radialGradient id="er-sky-glow" cx="352" cy="150" r="160" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={EVE_LOW} stopOpacity={0.95} />
          <stop offset="1" stopColor={EVE_LOW} stopOpacity={0} />
        </radialGradient>
        <linearGradient id="er-sky-night" x1="0" y1="0" x2="0" y2="160" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={NIGHT_TOP} />
          <stop offset="1" stopColor={NIGHT_LOW} />
        </linearGradient>
        <clipPath id="er-frame">
          <rect x={0.5} y={0.5} width={W - 1} height={H - 1} rx={10} />
        </clipPath>
      </defs>
      {!reduced && <style>{css}</style>}

      <g clipPath="url(#er-frame)">
        {/* Sky */}
        <rect width={W} height={H} fill="url(#er-sky-noon)" />
        <g style={{ opacity: time === 'evening' ? 1 : 0, transition: skyT }}>
          <rect width={W} height={H} fill="url(#er-sky-eve)" />
          <rect width={W} height={H} fill="url(#er-sky-glow)" />
        </g>
        <rect width={W} height={H} fill="url(#er-sky-night)" style={{ opacity: time === 'night' ? 1 : 0, transition: skyT }} />
        <rect width={W} height={H} fill={OVERCAST} style={{ opacity: cloudy ? 0.45 : 0, transition: skyT }} />

        {/* The sun: high at noon, slid down behind the hills on the right by evening. */}
        <g
          style={{
            transform: `translate(${sunMoved.x}px, ${sunMoved.y}px)`,
            opacity: time === 'night' ? 0 : 1,
            transition: tr(['transform', SKY_MS], ['opacity', SKY_MS]),
          }}
        >
          <circle cx={SUN_AT.x} cy={SUN_AT.y} r={20} fill={SUN_HALO} opacity={0.55} />
          <circle cx={SUN_AT.x} cy={SUN_AT.y} r={13} fill={SUN} />
        </g>

        {/* Clouds: one over the sun's (and moon's) place, one drifting further right. */}
        <g style={{ opacity: cloudy ? 1 : 0, transition: skyT }}>
          <path d={cloudPath(184, 40, 1.45)} fill={CLOUD} stroke={CLOUD_EDGE} strokeWidth={0.8} />
          <path d={cloudPath(292, 22, 1)} fill={CLOUD} stroke={CLOUD_EDGE} strokeWidth={0.8} />
        </g>

        {/* Hills, valley and river */}
        <path d="M0,128 C40,118 80,124 118,116 C160,108 200,122 246,118 C290,114 330,124 376,116 L376,176 L0,176 Z" fill={HILL_FAR} />
        <path d="M0,146 C46,134 96,142 140,136 C190,130 238,142 290,136 C330,132 356,140 376,136 L376,176 L0,176 Z" fill={HILL_MID} />
        <path d="M150,153 C214,148 300,152 376,145 L376,256 L150,256 Z" fill={VALLEY} />
        <path d="M0,256 L0,104 C24,96 48,88 72,88 C98,88 118,94 140,106 C168,122 190,160 206,256 Z" fill={RIDGE} />
        <path d="M140,106 C168,122 190,160 206,256 L193,256 C182,180 164,134 140,106 Z" fill={RIDGE_SHADE} />
        <path d="M216,151 C214,168 220,186 212,204 C204,222 200,240 192,256 L214,256 C218,240 220,224 222,208 C226,188 225,168 221,151 Z" fill={RIVER} />
        <path d="M218,160 C218,178 220,192 214,206 C209,220 206,236 202,250" fill="none" stroke={RIVER_LIGHT} strokeWidth={1.2} strokeLinecap="round" />

        <Tree x={160} base={123} h={20} windy={windy} t={tr(['transform', 900])} />
        <Tree x={228} base={154} h={15} windy={windy} t={tr(['transform', 900])} />
        <Tree x={362} base={152} h={17} windy={windy} t={tr(['transform', 900])} />

        {/* Wind turbines on the crest */}
        {TURBINES.map((tb, i) => {
          const built = i < turbines
          const { hub } = tb
          const spin: CSSProperties = reduced
            ? {}
            : { animation: 'er-spin 3.4s linear infinite', animationPlayState: windy ? 'running' : 'paused', transformOrigin: '0px 0px' }
          return (
            <g key={i} style={{ opacity: built ? 1 : 0, transform: `translate(0px, ${built ? 0 : 6}px)`, transition: appear }}>
              <polygon
                points={pts([
                  { x: hub.x - 2.4, y: tb.foot + 1 },
                  { x: hub.x + 2.4, y: tb.foot + 1 },
                  { x: hub.x + 1.1, y: hub.y + 2 },
                  { x: hub.x - 1.1, y: hub.y + 2 },
                ])}
                fill={TOWER}
                stroke={STEEL_EDGE}
                strokeWidth={0.6}
              />
              <rect x={hub.x - 1.5} y={hub.y - 2.6} width={8} height={5.2} rx={2.2} fill={TOWER} stroke={STEEL_EDGE} strokeWidth={0.6} />
              <g transform={`translate(${hub.x} ${hub.y})`}>
                <circle r={ROTOR} fill="#FFFFFF" fillOpacity={0.12} stroke="#FFFFFF" strokeOpacity={0.4} strokeWidth={0.8} style={{ opacity: windy ? 1 : 0, transition: tr(['opacity', 600]) }} />
                <g style={spin}>
                  {[0, 120, 240].map((a) => (
                    <path key={a} d={BLADE} transform={`rotate(${a + tb.phase}) scale(${ROTOR / 20})`} fill={TOWER} stroke={STEEL_EDGE} strokeWidth={0.5} />
                  ))}
                </g>
                <circle r={2.4} fill={TOWER} stroke={STEEL_EDGE} strokeWidth={0.6} />
              </g>
            </g>
          )
        })}

        {/* Rows of solar panels on the slope, tilted up to the sky */}
        {ARRAYS.map((a, i) => {
          const built = i < panels
          const face = [
            { x: a.x, y: a.y },
            { x: a.x + 44, y: a.y },
            { x: a.x + 51, y: a.y - 14 },
            { x: a.x + 7, y: a.y - 14 },
          ]
          return (
            <g key={i} style={{ opacity: built ? 1 : 0, transform: `translate(0px, ${built ? 0 : 5}px)`, transition: appear }}>
              <line x1={a.x + 51} y1={a.y - 14} x2={a.x + 51} y2={a.y + 2} stroke={PANEL_EDGE} strokeWidth={1.2} />
              <line x1={a.x + 4} y1={a.y} x2={a.x + 4} y2={a.y + 3} stroke={PANEL_EDGE} strokeWidth={1.2} />
              <line x1={a.x + 40} y1={a.y} x2={a.x + 40} y2={a.y + 3} stroke={PANEL_EDGE} strokeWidth={1.2} />
              <polygon points={pts(face)} fill={PANEL} stroke={PANEL_EDGE} strokeWidth={1} strokeLinejoin="round" />
              <line x1={a.x + 3.5} y1={a.y - 7} x2={a.x + 47.5} y2={a.y - 7} stroke={PANEL_LINE} strokeWidth={0.6} />
              {[1, 2, 3, 4, 5].map((k) => (
                <line key={k} x1={a.x + (44 * k) / 6} y1={a.y} x2={a.x + 7 + (44 * k) / 6} y2={a.y - 14} stroke={PANEL_LINE} strokeWidth={0.6} />
              ))}
              <polygon
                points={pts([
                  { x: a.x + 15, y: a.y },
                  { x: a.x + 24, y: a.y },
                  { x: a.x + 38, y: a.y - 14 },
                  { x: a.x + 29, y: a.y - 14 },
                ])}
                fill={SHEEN}
                style={{ opacity: sheen, transition: tr(['opacity', 900]) }}
              />
            </g>
          )
        })}

        {/* Coal power stations on the riverbank */}
        {STATIONS.map((x0, i) => {
          const built = i < coal
          return (
            <g key={i} style={{ opacity: built ? 1 : 0, transform: `translate(0px, ${built ? 0 : 5}px)`, transition: appear }}>
              <polygon
                points={pts([
                  { x: x0 + 24, y: STATION_BASE },
                  { x: x0 + 32, y: STATION_BASE },
                  { x: x0 + 30.8, y: CHIMNEY_TOP },
                  { x: x0 + 25.2, y: CHIMNEY_TOP },
                ])}
                fill={CONCRETE}
                stroke={CONCRETE_EDGE}
                strokeWidth={0.6}
              />
              <rect x={x0 + 25.2} y={CHIMNEY_TOP} width={5.6} height={3.4} fill={SOOT} />
              <rect x={x0 + 24.6} y={CHIMNEY_TOP + 14} width={6.8} height={1.4} fill={CONCRETE_EDGE} opacity={0.5} />
              <rect x={x0} y={STATION_BASE - 20} width={24} height={20} fill={BRICK} stroke={BRICK_EDGE} strokeWidth={0.6} />
              <rect x={x0 - 1} y={STATION_BASE - 22} width={26} height={3} rx={0.8} fill={SLATE} />
              {[3, 10, 17].map((dx) => (
                <rect key={dx} x={x0 + dx} y={STATION_BASE - 15} width={4} height={8} rx={1.6} fill={GLASS} />
              ))}
              <path d={`M${x0 + 1} ${STATION_BASE} q5 -5 10 0 Z`} fill={SOOT} />
            </g>
          )
        })}

        {/* Homes */}
        {HOUSES.map((hs, i) => {
          const top = hs.base - hs.h
          return (
            <g key={i}>
              <rect x={hs.x} y={top} width={HOUSE_W} height={hs.h} fill={WALLS[i % 3]} stroke={WALL_EDGE} strokeWidth={0.6} />
              <polygon
                points={pts([
                  { x: hs.x - 3, y: top + 0.5 },
                  { x: hs.x + HOUSE_W + 3, y: top + 0.5 },
                  { x: hs.x + HOUSE_W / 2, y: top - ROOF_H },
                ])}
                fill={ROOFS[(i + (i >= 3 ? 1 : 0)) % 3]}
                stroke={WALL_EDGE}
                strokeWidth={0.6}
                strokeLinejoin="round"
              />
              <rect x={hs.x + 12} y={hs.base - 11} width={6} height={11} fill={DOOR} />
              {WINDOWS.map((wx) => (
                <rect key={wx} x={hs.x + wx} y={top + 4} width={7} height={6.5} fill={GLASS} />
              ))}
              <rect x={hs.x + HOUSE_W / 2 - 3} y={top - 7.5} width={6} height={5} fill={GLASS} />
            </g>
          )
        })}

        {/* Dusk */}
        <rect width={W} height={H} fill={INK} style={{ opacity: WASH[time], transition: skyT }} />

        {/* Stars and moon sit above the dusk */}
        <g style={{ opacity: starOp, transition: skyT }}>
          {STARS.map((s, i) => (
            <circle key={i} cx={s.x} cy={s.y} r={i % 3 === 0 ? 1.1 : 0.8} fill={STAR} />
          ))}
        </g>
        <g style={{ opacity: time === 'night' && !cloudy ? 1 : 0, transition: skyT }}>
          <circle cx={SUN_AT.x} cy={SUN_AT.y - 2} r={8.5} fill={MOON} />
          <circle cx={SUN_AT.x - 2.5} cy={SUN_AT.y - 3.5} r={1.6} fill="#E2DCC2" />
          <circle cx={SUN_AT.x + 2.8} cy={SUN_AT.y + 1} r={1.1} fill="#E2DCC2" />
        </g>

        {/* Lamp light in the homes that have electricity */}
        {HOUSES.map((hs, i) => {
          const on = i < lit
          const delay = lag + (on ? i * 110 : (HOMES - 1 - i) * 150)
          const top = hs.base - hs.h
          return (
            <g key={i} style={{ opacity: on ? 1 : 0, transition: tr(['opacity', 380, delay]) }}>
              <g style={{ opacity: glowOp, transition: skyT }}>
                {WINDOWS.map((wx) => (
                  <rect key={wx} x={hs.x + wx - 2.5} y={top + 1.5} width={12} height={11.5} rx={3.5} fill={LAMP} opacity={0.55} />
                ))}
                <rect x={hs.x + HOUSE_W / 2 - 5} y={top - 9.5} width={10} height={9} rx={3} fill={LAMP} opacity={0.55} />
              </g>
              {WINDOWS.map((wx) => (
                <g key={wx}>
                  <rect x={hs.x + wx} y={top + 4} width={7} height={6.5} fill={LAMP} />
                  <line x1={hs.x + wx + 3.5} y1={top + 4} x2={hs.x + wx + 3.5} y2={top + 10.5} stroke="#C99E48" strokeWidth={0.6} />
                </g>
              ))}
              <rect x={hs.x + HOUSE_W / 2 - 3} y={top - 7.5} width={6} height={5} fill={LAMP} />
            </g>
          )
        })}

        {/* Furnace glow and aviation lights */}
        {STATIONS.map((x0, i) => (
          <g key={i} style={{ opacity: burnOf(i) > 0 ? 1 : 0, transition: tr(['opacity', 500, lag]) }}>
            {[3, 10, 17].map((dx) => (
              <rect key={dx} x={x0 + dx} y={STATION_BASE - 15} width={4} height={8} rx={1.6} fill={FURNACE} />
            ))}
          </g>
        ))}
        {TURBINES.map((tb, i) => (
          <circle key={i} cx={tb.hub.x + 4} cy={tb.hub.y - 3.4} r={1.3} fill={AIR_LIGHT} style={{ opacity: dark && i < turbines ? 1 : 0, transition: skyT }} />
        ))}

        {/* Smoke from the chimneys that are burning */}
        {STATIONS.map((x0, i) => (
          <Plume key={i} mx={x0 + 28} burn={burnOf(i)} windy={windy} reduced={reduced} colour={SMOKE[time]} t={tr(['transform', 800, lag], ['opacity', 800, lag])} />
        ))}

        {/* Labels */}
        <Label x={24} y={133} text={turbines === 1 ? 'wind turbine' : 'wind turbines'} show={turbines > 0} dark={dark} t={labelT} />
        <Label x={20} y={243} text="solar panels" show={panels > 0} dark={dark} t={labelT} />
        <Label x={238} y={174} text={coal === 1 ? 'coal power station' : 'coal power stations'} show={coal > 0} dark={dark} t={labelT} />
      </g>
      <rect x={0.5} y={0.5} width={W - 1} height={H - 1} rx={10} fill="none" stroke={PLATE_EDGE} />
    </svg>
  )
}
