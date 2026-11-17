import type { CSSProperties, ReactNode } from 'react'

// A school pendulum, drawn as the real kit: a clamp stand on the bench, the string held between two cork cheeks, a metre
// rule clamped beside it (zero level with the pivot), a wooden or steel bob of the same size, a stopwatch, a pencil tally
// of complete swings, and a results notebook. A quiet light plate with material colours, the same in both themes, as the
// skeleton card does it. Flat colours only.
//
// Pure: no hooks, no state. A new `runId` with phase 'swinging' mounts the run: the bob is pulled back to the release
// point and let go, swings at the true period for its length (2 pi root of L over g, nothing else), and the stopwatch and
// the tally count ten complete swings from the moment of release, as a student would with a stopwatch, then the watch
// stops. The pendulum keeps swinging after the watch stops, as a real one does.

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
const MONO = 'ui-monospace, "Cascadia Mono", "SF Mono", Consolas, Menlo, monospace'

export type LengthCm = 25 | 50 | 75 | 100
export type Bob = 'wood' | 'steel'
export type PullDeg = 5 | 10
export type Setup = { lengthCm: LengthCm; bob: Bob; pullDeg: PullDeg }
export type Phase = 'set' | 'swinging' | 'timed'

export type PictureProps = {
  /** String length from the pivot to the middle of the bob, in centimetres. Drawn to scale (1 m = 200 units). */
  lengthCm: LengthCm
  /** Which bob hangs on the string: 'wood' (50 g) or 'steel' (500 g). Both are 5 cm balls, so only the mass differs. */
  bob: Bob
  /** How far the bob is pulled back before it is let go, in degrees from hanging straight. Shown as a dashed ghost bob. */
  pullDeg: PullDeg
  /**
   * 'set': hanging still, ready to release; the stopwatch reads 0.0 and the tally is empty.
   * 'swinging': released; the stopwatch runs and the tally gains a mark each time the bob comes back to the release point.
   * 'timed': the watch has stopped after ten complete swings and the "one swing" sum is shown; the pendulum swings on.
   */
  phase: Phase
  /** Changes on every Release. A new value restarts the pull, the swing, the stopwatch and the tally from zero. */
  runId: number
  /** Finished timings, oldest first, written in the notebook with their times. The last three are shown. */
  runs: Setup[]
  /** Indexes into `runs` that the verdict refers to; those notebook rows get a soft highlight. */
  marked?: number[]
  /** Reduced motion: nothing animates; 'timed' shows the end frame (watch stopped, ten marks, bob hanging at rest). */
  reduced: boolean
}

/** g in m/s^2. */
const G = 9.81
/** The time for one complete swing (there and back), in seconds: T = 2 pi sqrt(L / g). It does not depend on the bob or the pull. */
export function periodS(lengthCm: number): number {
  return 2 * Math.PI * Math.sqrt(lengthCm / 100 / G)
}
/** What the stopwatch shows for ten swings, rounded to 0.1 s: 10.0, 14.2, 17.4, 20.1. */
export function tenSwingsS(lengthCm: number): number {
  return Math.round(periodS(lengthCm) * 100) / 10
}
/** The time for one swing the card reports: the ten-swing time divided by ten, to 0.01 s. */
export function oneSwingText(lengthCm: number): string {
  return (tenSwingsS(lengthCm) / 10).toFixed(2)
}
/** The pull back to the release point takes this long; the stopwatch starts when the bob is let go. */
export const PULL_MS = 600
/** How long after Release the View should switch to 'timed' (the watch has stopped and the tenth mark is drawn). */
export function runMs(lengthCm: number): number {
  return PULL_MS + Math.ceil(1000 * Math.max(10 * periodS(lengthCm), tenSwingsS(lengthCm))) + 400
}

// Geometry, in picture units.
const W = 376
const H = 290
const PX = 102 // pivot: where the string leaves the cork cheeks
const PY = 34
const K = 2 // units per centimetre
const FULL = 100 * K // 1 m
const R = 7 // bob radius (a 5 cm ball, drawn a little large so it reads)
const BENCH = 274
const STEP = 30 // odometer: distance between digits on a strip

// Plate and ink.
const PLATE = '#F8FAFC'
const PLATE_EDGE = '#CBD5E1'
const INK = '#1E293B'
const SOFT = '#475569'
const LEADER = '#94A3B8'
const GUIDE = '#94A3B8'
// Bench: pale oak.
const BENCH_TOP = '#EADFCB'
const BENCH_EDGE = '#C9B48E'
const BENCH_LIGHT = '#F4ECDF'
// Clamp stand: painted iron base and bosses, bright steel rod and arm.
const IRON = '#566170'
const IRON_EDGE = '#3A4350'
const IRON_LIGHT = '#78849A'
const BOSS = '#7B8796'
const ROD = '#BAC3CC'
const ROD_EDGE = '#6E7A87'
const ROD_LIGHT = '#E4E9EE'
const CORK = '#D8B98C'
const CORK_EDGE = '#9C7A4C'
// Metre rule: boxwood yellow with brown print.
const RULE = '#F1E2B3'
const RULE_EDGE = '#B39A5E'
const RULE_INK = '#5B4A22'
const STRING = '#6B6255'
const WOOD = { fill: '#D49C5E', edge: '#8A5A2B', grain: '#B07A40', hi: '#F2D4A6' }
const STEEL = { fill: '#98A3AF', mid: '#B8C2CB', edge: '#5D6977', hi: '#F4F7F9' }
// The one accent: the stopwatch, the thing that answers.
const ACCENT = '#0F766E'
const ACCENT_DEEP = '#0B524D'
const ACCENT_RIM = '#16897F'
const ON_ACCENT = '#D7F2EC'
const LCD = '#DCE4D2'
const LCD_EDGE = '#5F6F55'
const LCD_SHADE = '#C5CFB8'
const LCD_INK = '#1D2A1D'
const PENCIL = '#334155'
const PAPER = '#FFFFFF'
const PAPER_RULE = '#DCE6F0'
const MARK = '#CDEBE5'

const CSS = [
  '@keyframes pdlm-swing{0%,100%{transform:rotate(var(--pdlm-a))}50%{transform:rotate(calc(var(--pdlm-a) * -1))}}',
  '@keyframes pdlm-pull{from{transform:rotate(calc(var(--pdlm-a) * -1))}to{transform:rotate(0deg)}}',
  `@keyframes pdlm-odo{from{transform:translateY(0px)}to{transform:translateY(${-10 * STEP}px)}}`,
  '@keyframes pdlm-draw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}',
  '@keyframes pdlm-pulse{0%{opacity:0.9}35%{opacity:0}100%{opacity:0}}',
  '@keyframes pdlm-in{from{opacity:0}to{opacity:1}}',
].join('')

const f1 = (n: number) => n.toFixed(1)
const rad = (deg: number) => (deg * Math.PI) / 180
/** A point at `deg` from straight down (positive = towards the release side, right) and `r` from the pivot. */
const at = (deg: number, r: number) => ({ x: PX + r * Math.sin(rad(deg)), y: PY + r * Math.cos(rad(deg)) })
const PIVOT: CSSProperties = { transformBox: 'view-box', transformOrigin: `${PX}px ${PY}px` }

function bobShape(kind: Bob, shown: boolean, fade: string): ReactNode {
  const hook = (
    <g>
      <line x1={PX} y1={PY - R - 0.5} x2={PX} y2={PY - R + 1} stroke="#8C7A55" strokeWidth={1.2} />
      <circle cx={PX} cy={PY - R - 1.6} r={1.4} fill="none" stroke="#8C7A55" strokeWidth={0.9} />
    </g>
  )
  if (kind === 'wood')
    return (
      <g style={{ opacity: shown ? 1 : 0, transition: fade }}>
        {hook}
        <circle cx={PX} cy={PY} r={R} fill={WOOD.fill} />
        <path
          d={`M${PX - 5.4} ${PY - 1.4} Q${PX} ${PY + 1.9} ${PX + 5.6} ${PY - 0.7} M${PX - 4.2} ${PY + 3} Q${PX} ${PY + 5.4} ${PX + 4.4} ${PY + 2.8}`}
          fill="none"
          stroke={WOOD.grain}
          strokeWidth={0.7}
        />
        <ellipse cx={PX - 2.6} cy={PY - 3} rx={2.3} ry={1.5} fill={WOOD.hi} />
        <circle cx={PX} cy={PY} r={R} fill="none" stroke={WOOD.edge} strokeWidth={1} />
      </g>
    )
  return (
    <g style={{ opacity: shown ? 1 : 0, transition: fade }}>
      {hook}
      <circle cx={PX} cy={PY} r={R} fill={STEEL.fill} />
      <circle cx={PX - 1.3} cy={PY - 1.3} r={5} fill={STEEL.mid} />
      <ellipse cx={PX - 2.7} cy={PY - 2.9} rx={2.2} ry={1.4} fill={STEEL.hi} />
      <circle cx={PX} cy={PY} r={R} fill="none" stroke={STEEL.edge} strokeWidth={1} />
    </g>
  )
}

/** String and bob, hanging straight down from the pivot; the caller rotates it. */
function pendulum(lengthCm: LengthCm, bob: Bob, glide: string, fade: string): ReactNode {
  const lp = lengthCm * K
  return (
    <g>
      <line
        x1={PX}
        y1={PY}
        x2={PX}
        y2={PY + FULL}
        stroke={STRING}
        strokeWidth={1.2}
        vectorEffect="non-scaling-stroke"
        style={{ ...PIVOT, transform: `scaleY(${lp / FULL})`, transition: glide }}
      />
      <g style={{ transform: `translateY(${lp}px)`, transition: glide }}>
        {bobShape('wood', bob === 'wood', fade)}
        {bobShape('steel', bob === 'steel', fade)}
      </g>
    </g>
  )
}

function stand(): ReactNode {
  return (
    <g>
      {/* Base on the bench. */}
      <rect x={6} y={264} width={76} height={10} rx={2.5} fill={IRON} stroke={IRON_EDGE} strokeWidth={1} />
      <line x1={9} y1={265.6} x2={79} y2={265.6} stroke={IRON_LIGHT} strokeWidth={1} />
      {/* Rod. */}
      <rect x={20} y={8} width={5} height={258} rx={2} fill={ROD} stroke={ROD_EDGE} strokeWidth={0.9} />
      <line x1={21.6} y1={11} x2={21.6} y2={262} stroke={ROD_LIGHT} strokeWidth={1} />
      {/* Lower boss holding the metre rule. */}
      <rect x={30} y={135} width={3} height={6} fill={ROD} stroke={ROD_EDGE} strokeWidth={0.8} />
      <rect x={16} y={131} width={14} height={14} rx={2} fill={BOSS} stroke={IRON_EDGE} strokeWidth={1} />
      <line x1={16} y1={138} x2={11} y2={138} stroke={IRON_EDGE} strokeWidth={1.6} />
      <rect x={8.5} y={134.5} width={3} height={7} rx={1} fill={BOSS} stroke={IRON_EDGE} strokeWidth={0.8} />
    </g>
  )
}

/** The top boss, the arm and the clamp at the pivot: drawn over the string so it comes out from between the cork cheeks. */
function arm(): ReactNode {
  return (
    <g>
      <rect x={28} y={21.5} width={84} height={5} rx={2} fill={ROD} stroke={ROD_EDGE} strokeWidth={0.9} />
      <line x1={30} y1={23} x2={110} y2={23} stroke={ROD_LIGHT} strokeWidth={1} />
      <rect x={16} y={17} width={14} height={14} rx={2} fill={BOSS} stroke={IRON_EDGE} strokeWidth={1} />
      <line x1={16} y1={24} x2={11} y2={24} stroke={IRON_EDGE} strokeWidth={1.6} />
      <rect x={8.5} y={20.5} width={3} height={7} rx={1} fill={BOSS} stroke={IRON_EDGE} strokeWidth={0.8} />
      {/* Clamp jaws and the two cork cheeks the string is held between. */}
      <rect x={94} y={18} width={16} height={10} rx={2} fill={BOSS} stroke={IRON_EDGE} strokeWidth={1} />
      <circle cx={113} cy={23} r={2} fill={BOSS} stroke={IRON_EDGE} strokeWidth={0.8} />
      <rect x={96} y={26.5} width={5.2} height={7.5} rx={1} fill={CORK} stroke={CORK_EDGE} strokeWidth={0.8} />
      <rect x={102.8} y={26.5} width={5.2} height={7.5} rx={1} fill={CORK} stroke={CORK_EDGE} strokeWidth={0.8} />
    </g>
  )
}

/** The metre rule beside the pendulum: zero level with the pivot, a tick every 5 cm, numbers at 25, 50, 75 and 100. */
function rule(): ReactNode {
  const ticks: ReactNode[] = []
  for (let cm = 0; cm <= 100; cm += 5) {
    const y = PY + cm * K
    const long = cm % 25 === 0
    ticks.push(<line key={cm} x1={long ? 41 : 45} y1={y} x2={50} y2={y} stroke={RULE_INK} strokeWidth={long ? 1 : 0.7} />)
    if (long && cm > 0)
      ticks.push(
        <text key={`n${cm}`} x={34} y={y - 3} fontSize={8.5} fontWeight={600} fill={RULE_INK} fontFamily={FONT}>
          {cm}
        </text>,
      )
  }
  return (
    <g>
      <rect x={32} y={30} width={18} height={210} rx={1.5} fill={RULE} stroke={RULE_EDGE} strokeWidth={1} />
      <text x={34} y={47} fontSize={8.5} fontWeight={600} fill={RULE_INK} fontFamily={FONT}>
        cm
      </text>
      {ticks}
    </g>
  )
}

function lcdDigits(v: number) {
  const tens = Math.floor(v / 10) % 10
  return { tens: tens === 0 ? '' : String(tens), units: String(Math.floor(v) % 10), tenths: String(Math.round(v * 10) % 10) }
}

const DIGIT_Y = 70
const DIGIT_X = { tens: 255, units: 271, tenths: 292 }

function digitText(x: number, y: number, s: string, key?: string | number): ReactNode {
  return (
    <text key={key} x={x} y={y} textAnchor="middle" fontSize={28} fontFamily={MONO} fill={LCD_INK}>
      {s}
    </text>
  )
}

/** One odometer digit: a strip of 0-9 stepping under the LCD window, `cycle` seconds per turn, stopping at `stopS`. */
function strip(x: number, cycle: number, stopS: number, delay: number, blankZero: boolean): ReactNode {
  const count = (stopS + 0.004) / cycle
  return (
    <g style={{ animation: `pdlm-odo ${cycle}s steps(10, end) ${delay}s ${count.toFixed(5)} both` }}>
      {Array.from({ length: 10 }, (_, i) => digitText(x, DIGIT_Y + i * STEP, i === 0 && blankZero ? '' : String(i), i))}
    </g>
  )
}

function stopwatch(face: ReactNode): ReactNode {
  const cx = 278
  return (
    <g>
      <circle cx={cx} cy={7.5} r={4} fill="none" stroke="#64748B" strokeWidth={1.8} />
      <rect x={cx - 3.5} y={15} width={7} height={8} fill="#A3AFBD" stroke="#475569" strokeWidth={0.9} />
      <rect x={cx - 8} y={12} width={16} height={5} rx={2} fill="#B9C4D0" stroke="#475569" strokeWidth={0.9} />
      <rect x={225} y={22} width={12} height={7} rx={2} fill="#A3AFBD" stroke="#475569" strokeWidth={0.9} transform="rotate(-33 231 25.5)" />
      <rect x={319} y={22} width={12} height={7} rx={2} fill="#A3AFBD" stroke="#475569" strokeWidth={0.9} transform="rotate(33 325 25.5)" />
      <rect x={214} y={22} width={128} height={92} rx={30} fill={ACCENT} stroke={ACCENT_DEEP} strokeWidth={1.2} />
      <rect x={220} y={28} width={116} height={80} rx={25} fill="none" stroke={ACCENT_RIM} strokeWidth={1.6} />
      <path d="M228 50 Q232 34 250 31" fill="none" stroke="#3FA79A" strokeWidth={2} strokeLinecap="round" opacity={0.7} />
      <rect x={236} y={40} width={84} height={40} rx={6} fill={LCD} stroke={LCD_EDGE} strokeWidth={1.2} />
      <line x1={239} y1={42.6} x2={317} y2={42.6} stroke={LCD_SHADE} strokeWidth={2} />
      {face}
      <circle cx={281.5} cy={DIGIT_Y - 1.5} r={1.8} fill={LCD_INK} />
      <text x={306} y={DIGIT_Y} fontSize={12} fontFamily={FONT} fontWeight={600} fill={LCD_INK}>
        s
      </text>
      <text x={cx} y={98} textAnchor="middle" fontSize={12} fontFamily={FONT} fontWeight={600} fill={ON_ACCENT}>
        10 swings
      </text>
    </g>
  )
}

/** The pencil tally: four strokes and a strike, twice. Mark k (1-10) is the k-th complete swing. */
const TALLY: { x1: number; y1: number; x2: number; y2: number }[] = [
  ...[200, 206, 212, 218].map((x) => ({ x1: x, y1: 126, x2: x, y2: 142 })),
  { x1: 196, y1: 140, x2: 222, y2: 128 },
  ...[232, 238, 244, 250].map((x) => ({ x1: x, y1: 126, x2: x, y2: 142 })),
  { x1: 228, y1: 140, x2: 254, y2: 128 },
]

function tally(mode: 'empty' | 'full' | { periodS: number; delay: number }): ReactNode {
  if (mode === 'empty') return null
  return TALLY.map((m, i) => (
    <line
      key={i}
      {...m}
      pathLength={1}
      stroke={PENCIL}
      strokeWidth={1.8}
      strokeLinecap="butt"
      strokeDasharray={mode === 'full' ? undefined : '1 1'}
      style={mode === 'full' ? undefined : { animation: `pdlm-draw 0.25s ease-out ${(mode.delay + (i + 1) * mode.periodS).toFixed(3)}s 1 both` }}
    />
  ))
}

function bobIcon(kind: Bob, x: number, y: number): ReactNode {
  const c = kind === 'wood' ? WOOD : { fill: STEEL.fill, edge: STEEL.edge, hi: STEEL.hi }
  return (
    <g>
      <circle cx={x} cy={y} r={4.5} fill={c.fill} stroke={c.edge} strokeWidth={0.9} />
      <ellipse cx={x - 1.6} cy={y - 1.8} rx={1.4} ry={0.9} fill={c.hi} />
    </g>
  )
}

function notebook(runs: Setup[], marked: number[], reduced: boolean): ReactNode {
  const first = Math.max(0, runs.length - 3)
  const shown = runs.slice(first)
  const text = { fontSize: 12, fontFamily: FONT } as const
  return (
    <g>
      <rect x={192} y={176} width={172} height={84} rx={3} fill={PAPER} stroke={PLATE_EDGE} strokeWidth={1} />
      {[214, 232, 250].map((y) => (
        <line key={y} x1={196} y1={y} x2={360} y2={y} stroke={PAPER_RULE} strokeWidth={1} />
      ))}
      <line x1={196} y1={196} x2={360} y2={196} stroke="#B9C8D8" strokeWidth={1} />
      <text x={200} y={191} {...text} fill={SOFT}>
        string
      </text>
      <text x={258} y={191} textAnchor="middle" {...text} fill={SOFT}>
        bob
      </text>
      <text x={276} y={191} {...text} fill={SOFT}>
        pull
      </text>
      <text x={306} y={191} {...text} fill={SOFT}>
        10 swings
      </text>
      {shown.map((r, k) => {
        const i = first + k
        const y = 210 + k * 18
        return (
          <g key={i} style={reduced ? undefined : { animation: 'pdlm-in 400ms ease-out both' }}>
            {marked.includes(i) && <rect x={196} y={y - 12.5} width={164} height={16} rx={3} fill={MARK} />}
            <text x={200} y={y} {...text} fill={INK}>
              {r.lengthCm === 100 ? '1 m' : `${r.lengthCm} cm`}
            </text>
            {bobIcon(r.bob, 258, y - 4)}
            <text x={276} y={y} {...text} fill={INK}>
              {`${r.pullDeg}°`}
            </text>
            <text x={306} y={y} {...text} fontWeight={600} fill={INK}>
              {`${tenSwingsS(r.lengthCm).toFixed(1)} s`}
            </text>
          </g>
        )
      })}
    </g>
  )
}

export default function Picture({ lengthCm, bob, pullDeg, phase, runId, runs, marked = [], reduced }: PictureProps) {
  const T = periodS(lengthCm)
  const ten = tenSwingsS(lengthCm)
  const lp = lengthCm * K
  const P = PULL_MS / 1000
  const live = phase !== 'set'
  const moving = live && !reduced
  const glide = reduced ? 'none' : 'transform 600ms cubic-bezier(0.33, 1, 0.68, 1)'
  const fade = reduced ? 'none' : 'opacity 300ms ease'
  const release = -pullDeg // CSS rotation that carries the bob out to the right

  // The dotted path of the swing, and the angle the bob is pulled back through.
  const a = at(-pullDeg, lp)
  const b = at(pullDeg, lp)
  const ra = Math.min(36, lp * 0.5)
  const r0 = at(0, ra)
  const r1 = at(pullDeg, ra)
  const lab = at(pullDeg + 9, ra + 9)

  const face =
    phase === 'swinging' && !reduced ? (
      <g key={`odo-${runId}`} clipPath="url(#pdlm-lcd)">
        {strip(DIGIT_X.tens, 100, ten, P, true)}
        {strip(DIGIT_X.units, 10, ten, P, false)}
        {strip(DIGIT_X.tenths, 1, ten, P, false)}
      </g>
    ) : (
      (() => {
        const d = lcdDigits(phase === 'set' ? 0 : ten)
        return (
          <g>
            {digitText(DIGIT_X.tens, DIGIT_Y, d.tens)}
            {digitText(DIGIT_X.units, DIGIT_Y, d.units)}
            {digitText(DIGIT_X.tenths, DIGIT_Y, d.tenths)}
          </g>
        )
      })()
    )

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="A pendulum on a clamp stand beside a metre rule, with a stopwatch timing ten swings and a results notebook">
      <style>{CSS}</style>
      <defs>
        <clipPath id="pdlm-plate">
          <rect x={0.5} y={0.5} width={W - 1} height={H - 1} rx={14} />
        </clipPath>
        <clipPath id="pdlm-lcd">
          <rect x={238} y={42} width={80} height={36} rx={4} />
        </clipPath>
      </defs>

      <rect x={0.5} y={0.5} width={W - 1} height={H - 1} rx={14} fill={PLATE} />
      <g clipPath="url(#pdlm-plate)">
        <rect x={0} y={BENCH} width={W} height={H - BENCH} fill={BENCH_TOP} />
        <line x1={0} y1={BENCH + 1.5} x2={W} y2={BENCH + 1.5} stroke={BENCH_LIGHT} strokeWidth={1.4} />
        <line x1={0} y1={BENCH} x2={W} y2={BENCH} stroke={BENCH_EDGE} strokeWidth={1} />
      </g>

      {rule()}
      {stand()}

      {/* The swing's path and the pull-back angle; redrawn (faded in) when the length or the angle changes. */}
      <g key={`guide-${lengthCm}-${pullDeg}`} style={reduced ? undefined : { animation: 'pdlm-in 450ms ease-out both' }}>
        <path
          d={`M${f1(a.x)} ${f1(a.y)} A${lp} ${lp} 0 0 0 ${f1(b.x)} ${f1(b.y)}`}
          fill="none"
          stroke={GUIDE}
          strokeWidth={1.2}
          strokeDasharray="0.1 3.4"
          strokeLinecap="round"
        />
        <line x1={PX} y1={PY + 3} x2={PX} y2={PY + ra + 6} stroke={GUIDE} strokeWidth={0.9} strokeDasharray="2.5 2" />
        <path d={`M${f1(r0.x)} ${f1(r0.y)} A${ra} ${ra} 0 0 0 ${f1(r1.x)} ${f1(r1.y)}`} fill="none" stroke={SOFT} strokeWidth={0.9} />
        <text x={f1(lab.x)} y={f1(lab.y)} dominantBaseline="middle" fontSize={12} fontFamily={FONT} fontWeight={600} fill={SOFT}>
          {`${pullDeg}°`}
        </text>
      </g>

      {/* Where the bob is let go from: a dashed ghost on a faint string. It pulses each time the bob comes back. */}
      <g style={{ ...PIVOT, transform: `rotate(${release}deg)`, transition: glide }}>
        <line
          x1={PX}
          y1={PY}
          x2={PX}
          y2={PY + FULL}
          stroke={GUIDE}
          strokeWidth={1}
          opacity={0.6}
          vectorEffect="non-scaling-stroke"
          style={{ ...PIVOT, transform: `scaleY(${(lp - R) / FULL})`, transition: glide }}
        />
        <g style={{ transform: `translateY(${lp}px)`, transition: glide }}>
          <circle cx={PX} cy={PY} r={R} fill={PLATE} stroke={GUIDE} strokeWidth={1} strokeDasharray="2 1.6" />
          {phase === 'swinging' && !reduced && (
            <circle
              key={`pulse-${runId}`}
              cx={PX}
              cy={PY}
              r={R + 3.5}
              fill="none"
              stroke={ACCENT}
              strokeWidth={1.6}
              opacity={0}
              style={{ animation: `pdlm-pulse ${T.toFixed(4)}s ease-out ${(P + T).toFixed(4)}s 10 none` }}
            />
          )}
        </g>
      </g>

      {/* Reading the length: from the middle of the hanging bob across to the rule. Only while it hangs still. */}
      <g style={{ transform: `translateY(${lp}px)`, opacity: live && !reduced ? 0 : 1, transition: reduced ? 'none' : 'transform 600ms cubic-bezier(0.33, 1, 0.68, 1), opacity 300ms ease' }}>
        <line x1={51} y1={PY} x2={PX - R - 2} y2={PY} stroke={SOFT} strokeWidth={0.9} strokeDasharray="2.5 2" />
      </g>

      {/* The pendulum at rest, and the one that swings (cross-faded so a release or a reset never jumps). */}
      <g style={{ opacity: moving ? 0 : 1, transition: fade }}>{pendulum(lengthCm, bob, glide, fade)}</g>
      {!reduced && (
        <g key={`run-${runId}`} style={{ opacity: moving ? 1 : 0, transition: fade }}>
          <g
            style={
              {
                ...PIVOT,
                '--pdlm-a': `${release}deg`,
                animation: `pdlm-pull ${P}s cubic-bezier(0.45, 0, 0.55, 1) 0s 1 both`,
                animationPlayState: moving ? 'running' : 'paused',
              } as CSSProperties
            }
          >
            <g
              style={{
                ...PIVOT,
                animation: `pdlm-swing ${T.toFixed(4)}s cubic-bezier(0.37, 0, 0.63, 1) ${P}s infinite both`,
                animationPlayState: moving ? 'running' : 'paused',
              }}
            >
              {pendulum(lengthCm, bob, glide, fade)}
            </g>
          </g>
        </g>
      )}

      {arm()}

      {/* Labels for the pendulum. */}
      <text x={88} y={50} textAnchor="end" fontSize={12} fontFamily={FONT} fontWeight={600} fill={SOFT}>
        string
      </text>
      <line x1={90} y1={46} x2={97} y2={46} stroke={LEADER} strokeWidth={1} />
      <g style={{ transform: `translateY(${lp}px)`, transition: glide }}>
        <text
          key={bob}
          x={PX}
          y={PY + R + 17}
          textAnchor="middle"
          fontSize={12}
          fontFamily={FONT}
          fontWeight={600}
          fill={SOFT}
          style={reduced ? undefined : { animation: 'pdlm-in 300ms ease-out both' }}
        >
          {bob === 'wood' ? 'wooden bob, 50 g' : 'steel bob, 500 g'}
        </text>
      </g>

      {stopwatch(face)}

      {/* Tally of complete swings: there and back to the release point counts one. */}
      {TALLY.map((m, i) => (
        <line key={`ghost-${i}`} {...m} stroke="#E2E8F0" strokeWidth={1.8} />
      ))}
      <g key={`tally-${runId}-${phase === 'swinging' ? 'live' : 'still'}`}>
        {tally(phase === 'set' ? 'empty' : phase === 'swinging' && !reduced ? { periodS: T, delay: P } : 'full')}
      </g>
      <text x={264} y={139} fontSize={12} fontFamily={FONT} fontWeight={600} fill={SOFT}>
        complete swings
      </text>

      {/* The sum that turns ten swings into one. */}
      <text
        x={278}
        y={166}
        textAnchor="middle"
        fontSize={12}
        fontFamily={FONT}
        fill={INK}
        style={{ opacity: phase === 'timed' ? 1 : 0, transition: reduced ? 'none' : 'opacity 400ms ease 150ms' }}
      >
        <tspan fill={SOFT}>one swing = </tspan>
        <tspan>{`${ten.toFixed(1)} ÷ 10 = `}</tspan>
        <tspan fontWeight={700}>{`${oneSwingText(lengthCm)} s`}</tspan>
      </text>

      {notebook(runs, marked, reduced)}

      <rect x={0.5} y={0.5} width={W - 1} height={H - 1} rx={14} fill="none" stroke={PLATE_EDGE} strokeWidth={1} />
    </svg>
  )
}
