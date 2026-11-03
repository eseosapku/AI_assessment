'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { SceneViewProps } from '../types'
import type { ProbConfig, ProbState } from './config'
import {
  allPairs, cellsOf, countOf, eventPairs, madeText, MAX_SPINS, paletteOf, pairId, picksOf, probabilityLabEngine, rollAt, rollsOf, runningShare, sidesOf, spinAt, spinColours, spinsOf, working,
} from './config'

type Props = SceneViewProps<ProbConfig, ProbState>
type SpinnerConfig = Extract<ProbConfig, { task: 'spinner' }>
type SpaceConfig = Extract<ProbConfig, { task: 'space' }>

// Probability equipment is not a dark subject: a quiet plate, as measure-shape's and bonding's are, keeping its own colours
// in both themes. No gradients or shadows.
const PLATE = '#F8FAFC'
const PLATE_EDGE = '#CBD5E1'
const INK = '#16202A'
const SOFT = '#475569'
const FONT = 'system-ui, sans-serif'
// A spinner board: cream plastic with a coloured sector, and a dark needle.
const FILL: Record<string, string> = { plain: '#F3EEE3', red: '#D2534B', blue: '#3E7CC4', green: '#4C9A6A', yellow: '#F2C14E' }
// A darker shade of each colour for a line or a word on the light plate, so thin marks keep 3:1.
const DEEP: Record<string, string> = { red: '#B23A33', blue: '#2A5C99', green: '#2F7149', yellow: '#B8860B' }
const BOARD_EDGE = '#4A5563'
const SEAM = '#8A8F98'
const RIM = '#FFFFFF'
const PEG = '#B9B2A2'
const NEEDLE = '#1E293B'
const HUB = '#CBD5E1'
// Dice: a pale blue first die and a pale amber second die, as ivory plastic with painted pips, in the grid's two axes too.
const DIE_A = { body: '#DCE9F7', pip: '#1F4E8C', edge: '#6B8DB8' }
const DIE_B = { body: '#F8E8C8', pip: '#8A5A12', edge: '#C49A4E' }
const TILE = '#EEF2F6'
const TILE_EDGE = '#CBD5E1'
// A counter: a deep green disc with a lighter ring, as in a real set.
const COUNTER = '#0F766E'
const COUNTER_RING = '#7FD1C7'
const BAD = '#B0303C'
const LANDED = '#E07B2D'

const W = 360
const SPIN_H = 236
const SPACE_H = 262

/** Where the goal labels sit, one beside each dotted line, pushed apart so two near chances never touch. Plot top 40, floor 160. */
export function goalLabelYs(values: number[]): number[] {
  const want = values.map((v) => 160 - v * 120 + 4)
  const order = want.map((_, i) => i).sort((a, b) => want[a] - want[b])
  const out = [...want]
  for (let j = 1; j < order.length; j++) out[order[j]] = Math.max(out[order[j]], out[order[j - 1]] + 15)
  return out
}

const f1 = (n: number) => n.toFixed(1)
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
/** A point on a circle, with 0 at the top and the angle running clockwise in turns. */
const at = (cx: number, cy: number, r: number, turn: number) => ({ x: cx + r * Math.sin(turn * 2 * Math.PI), y: cy - r * Math.cos(turn * 2 * Math.PI) })

/** The steps the graph's spin axis can have, so the scale holds still while a run draws itself. */
const AXES = [10, 20, 50, 100, 200, 500, 1000]
const axisFor = (n: number) => AXES.find((a) => a >= n) ?? 1000

function useEased(target: number, reduced: boolean): number {
  const [shown, setShown] = useState(target)
  const from = useRef(target)
  const raf = useRef(0)
  useEffect(() => {
    cancelAnimationFrame(raf.current)
    if (reduced || target < from.current || target === from.current) {
      from.current = target
      setShown(target)
      return
    }
    const start = from.current
    const ms = target - start <= 1 ? 900 : 1300
    let t0 = 0
    const tick = (t: number) => {
      if (!t0) t0 = t
      const p = Math.min(1, (t - t0) / ms)
      const e = 1 - Math.pow(1 - p, 2.2)
      from.current = start + (target - start) * e
      setShown(from.current)
      if (p < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [target, reduced])
  return shown
}

// ---------------------------------------------------------------------------
// Dice

const PIPS: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [[0.27, 0.27], [0.73, 0.73]],
  3: [[0.27, 0.27], [0.5, 0.5], [0.73, 0.73]],
  4: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]],
  5: [[0.27, 0.27], [0.73, 0.27], [0.5, 0.5], [0.27, 0.73], [0.73, 0.73]],
  6: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.5], [0.73, 0.5], [0.27, 0.73], [0.73, 0.73]],
}

function Die({ x, y, size, face, tone }: { x: number; y: number; size: number; face: number; tone: typeof DIE_A }) {
  return (
    <g transform={`translate(${f1(x)} ${f1(y)})`} data-die={face}>
      <rect x={0.75} y={0.75} width={size - 1.5} height={size - 1.5} rx={size * 0.2} fill={tone.body} stroke={tone.edge} strokeWidth={1.5} />
      {(PIPS[face] ?? PIPS[1]).map(([px, py], i) => <circle key={i} cx={f1(px * size)} cy={f1(py * size)} r={f1(Math.max(2, size * 0.085))} fill={tone.pip} />)}
    </g>
  )
}

// ---------------------------------------------------------------------------
// Shared pieces

const btn = 'nodrag flex h-7 min-w-[28px] shrink-0 select-none items-center justify-center whitespace-nowrap rounded-lg border-2 border-ss-line bg-ss-panel px-2 text-[13px] font-extrabold leading-none text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] focus-visible:border-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'

function Swatch({ kind, tone }: { kind: 'line' | 'dots' | 'counter' | 'ring' | 'spin'; tone?: string }) {
  return (
    <svg viewBox="0 0 18 12" className="h-3 w-[18px] shrink-0" aria-hidden="true">
      {kind === 'line' && <line x1={0} x2={18} y1={6} y2={6} stroke={tone ?? SOFT} strokeWidth={2.4} strokeLinecap="round" />}
      {kind === 'dots' && <line x1={0} x2={18} y1={6} y2={6} stroke={tone ?? SOFT} strokeWidth={2} strokeDasharray="2.5 3" />}
      {kind === 'counter' && (<><circle cx={9} cy={6} r={5.2} fill={COUNTER} /><circle cx={9} cy={6} r={3} fill="none" stroke={COUNTER_RING} strokeWidth={1} /></>)}
      {kind === 'spin' && (<><circle cx={9} cy={6} r={5.2} fill={FILL.yellow} stroke={BOARD_EDGE} strokeWidth={1.1} /><circle cx={9} cy={6} r={3} fill="none" stroke="#FFFFFF" strokeOpacity={0.7} strokeWidth={1} /></>)}
      {kind === 'ring' && <rect x={3.5} y={1.5} width={11} height={9} rx={2.5} fill="none" stroke={LANDED} strokeWidth={2} />}
    </svg>
  )
}

const Named = ({ children, swatch }: { children: string; swatch: React.ReactNode }) => (
  <span className="flex items-center gap-1 whitespace-nowrap">{swatch}{children}</span>
)

function Said({ said }: { said: string }) {
  const lead = said.match(/^(Yes\. [^.]*\.)\s*(.*)$/)
  return (
    <div className="rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2">
      <p className="text-[13px] font-extrabold leading-snug text-ss-ink">{lead ? lead[1] : said}</p>
      {lead && lead[2] && <p className="mt-0.5 text-[12px] font-semibold leading-snug text-ss-slate">{lead[2]}</p>}
    </div>
  )
}

/** Arrow keys move between the squares and stay off the board, which would otherwise move the card. */
function arrowMove(e: KeyboardEvent, i: number, count: number, per: number, root: HTMLElement | null, setRove: (n: number) => void) {
  const k = e.key
  if (!k.startsWith('Arrow') && k !== 'Home' && k !== 'End') return
  e.preventDefault()
  e.stopPropagation()
  let n = i
  if (k === 'ArrowLeft') n = i - 1
  else if (k === 'ArrowRight') n = i + 1
  else if (k === 'ArrowUp') n = i - per
  else if (k === 'ArrowDown') n = i + per
  else if (k === 'Home') n = 0
  else n = count - 1
  if (n < 0 || n >= count) return
  setRove(n)
  root?.querySelector<HTMLElement>(`[data-i="${n}"]`)?.focus()
}

// ---------------------------------------------------------------------------
// The spinner

const SPIN = { cx: 90, cy: 118, rim: 82, board: 72 }

function wedgePath(n: number, i: number, r: number, cx: number, cy: number): string {
  const a = at(cx, cy, r, i / n)
  const b = at(cx, cy, r, (i + 1) / n)
  return `M ${f1(cx)} ${f1(cy)} L ${f1(a.x)} ${f1(a.y)} A ${r} ${r} 0 ${1 / n > 0.5 ? 1 : 0} 1 ${f1(b.x)} ${f1(b.y)} Z`
}

/** A hit area shaped like the sector, in percentages of the square it fills. */
function clipOf(n: number, i: number): string {
  const pts: string[] = ['50% 50%']
  const steps = Math.max(2, Math.ceil(24 / n))
  for (let k = 0; k <= steps; k++) {
    const p = at(50, 50, 50, (i + k / steps) / n)
    pts.push(`${f1(p.x)}% ${f1(p.y)}%`)
  }
  return `polygon(${pts.join(', ')})`
}

function SpinnerPlate({ config, state, setState, marked, reduced, locked }: Props & { config: SpinnerConfig }) {
  const now = marked === 'shown' ? probabilityLabEngine.solve(config) : state
  const cells = cellsOf(config, now)
  const n = cells.length
  const pal = paletteOf(config.targets)
  const spins = marked === 'shown' ? 0 : spinsOf(now)
  const shown = useEased(spins, reduced)
  const k = Math.floor(shown + 1e-6)
  const landed = useMemo(() => spinColours(cells, spins), [cells.join(','), spins]) // eslint-disable-line react-hooks/exhaustive-deps
  const root = useRef<HTMLDivElement>(null)
  const [rove, setRove] = useState(0)
  const [focus, setFocus] = useState(-1)
  const finished = marked === 'right' || marked === 'shown'
  const can = !locked && !finished

  const last = spins > 0 ? spinAt(cells, spins - 1) : null
  const needle = (last ? last.turn * 360 : 0) + spins * 720
  const settled = spins > 0 && k >= spins
  const lit = settled && last ? last.sector : -1

  const paint = (i: number) => {
    if (!can) return
    const order = ['plain', ...pal]
    const next = order[(order.indexOf(cells[i]) + 1) % order.length]
    setState({ cells: cells.map((c, j) => (j === i ? next : c)), spins: 0 })
  }
  const spin = (by: number) => {
    if (!can) return
    setState({ cells, spins: Math.min(MAX_SPINS, spins + by) })
  }

  // The plot: the share of spins on each goal colour, drawn as far as the spins have got.
  const X0 = 212
  const X1 = 314
  const Y0 = 160
  const Y1 = 40
  const xmax = axisFor(spins)
  const px = (i: number) => X0 + ((i + 1) / xmax) * (X1 - X0)
  const py = (v: number) => Y0 - v * (Y0 - Y1)
  const lines = config.targets.map((t) => ({ t, share: runningShare(landed, t.colour) }))
  const trail = landed.slice(Math.max(0, k - 8), k)

  const names = config.targets.map((t) => t.colour)
  const aria = `A spinner with ${n} equal sectors. ${names.length ? '' : ''}${['plain', ...pal].map((c) => `${countOf(cells, c)} ${c}`).join(', ')}. ${spins === 0 ? 'It has not been spun.' : `Spun ${spins} ${spins === 1 ? 'time' : 'times'}. ${names.map((c) => `${cap(c)} landed ${landed.filter((x) => x === c).length}`).join(', ')}.`}`

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-2 [&:has(button:focus-visible)_.pl-kbd]:block">
      <figure className="m-0 flex w-full flex-col gap-1.5">
        <div ref={root} className="relative w-full">
          <svg viewBox={`0 0 ${W} ${SPIN_H}`} role="img" aria-label={aria} className="block h-auto w-full select-none" fontFamily={FONT}>
            <rect x={0.75} y={0.75} width={W - 1.5} height={SPIN_H - 1.5} rx={16} fill={PLATE} stroke={PLATE_EDGE} strokeWidth={1.5} />
            {/* The board: a white rim with a peg at every seam, and the sectors inside it. */}
            <circle cx={SPIN.cx} cy={SPIN.cy} r={SPIN.rim} fill={RIM} stroke={BOARD_EDGE} strokeWidth={1.6} />
            {cells.map((c, i) => (
              <path key={i} d={wedgePath(n, i, SPIN.board, SPIN.cx, SPIN.cy)} data-sector={i} data-colour={c} fill={FILL[c] ?? FILL.plain} stroke={SEAM} strokeWidth={1} strokeLinejoin="round" style={reduced ? undefined : { transition: 'fill 300ms ease' }} />
            ))}
            <circle cx={SPIN.cx} cy={SPIN.cy} r={SPIN.board} fill="none" stroke={BOARD_EDGE} strokeWidth={1.4} />
            {cells.map((_, i) => {
              const p = at(SPIN.cx, SPIN.cy, (SPIN.board + SPIN.rim) / 2, i / n)
              return <circle key={i} cx={f1(p.x)} cy={f1(p.y)} r={2.2} fill={PEG} stroke={BOARD_EDGE} strokeWidth={0.8} />
            })}
            {lit >= 0 && <path d={wedgePath(n, lit, SPIN.board - 1.5, SPIN.cx, SPIN.cy)} data-landed={lit} fill="none" stroke={INK} strokeWidth={3} strokeLinejoin="round" />}
            {focus >= 0 && can && <path d={wedgePath(n, focus, SPIN.board - 2, SPIN.cx, SPIN.cy)} fill="none" stroke={LANDED} strokeWidth={3} strokeLinejoin="round" strokeDasharray="5 3" />}
            {/* The needle turns on its hub: a pointer with a short tail. */}
            <g data-needle={f1(needle)} style={{ transformOrigin: `${SPIN.cx}px ${SPIN.cy}px`, transform: `rotate(${f1(needle)}deg)`, transition: reduced ? undefined : `transform ${spins - k > 1 || shown < spins - 1 ? 1300 : 900}ms cubic-bezier(0.15, 0.7, 0.2, 1)` }}>
              <path d={`M ${SPIN.cx} ${SPIN.cy - 64} L ${SPIN.cx + 5} ${SPIN.cy} L ${SPIN.cx} ${SPIN.cy + 14} L ${SPIN.cx - 5} ${SPIN.cy} Z`} fill={NEEDLE} stroke="#FFFFFF" strokeWidth={1.2} strokeLinejoin="round" />
            </g>
            <circle cx={SPIN.cx} cy={SPIN.cy} r={7} fill={NEEDLE} stroke="#FFFFFF" strokeWidth={1.4} />
            <circle cx={SPIN.cx} cy={SPIN.cy} r={2.6} fill={HUB} />

            {/* The graph: the share of spins landing on each goal colour, and the chance asked for as a dotted line. */}
            <g aria-hidden="true">
              <text x={X0} y={26} fontSize={12} fontWeight={700} fill={SOFT}>Share of spins</text>
              {[0, 0.5, 1].map((v) => (
                <g key={v}>
                  <line x1={X0} x2={X1} y1={py(v)} y2={py(v)} stroke={PLATE_EDGE} strokeWidth={v === 0 ? 1.6 : 1} />
                  <text x={X0 - 5} y={py(v) + 4} fontSize={12} fontWeight={600} fill={SOFT} textAnchor="end">{v === 0.5 ? '1/2' : v}</text>
                </g>
              ))}
              {lines.map(({ t }, gi) => {
                const m = /^(\d+)\/(\d+)$/.exec(t.chance)
                if (!m) return null
                const y = py(Number(m[1]) / Number(m[2]))
                const labelY = goalLabelYs(config.targets.map((x) => { const q = /^(\d+)\/(\d+)$/.exec(x.chance); return q ? Number(q[1]) / Number(q[2]) : 0 }))[gi]
                return (
                  <g key={t.colour} data-goal={t.colour}>
                    <line x1={X0} x2={X1} y1={y} y2={y} stroke={DEEP[t.colour] ?? SOFT} strokeWidth={2} strokeDasharray="3 4" strokeLinecap="round" />
                    <text x={X1 + 5} y={f1(labelY)} fontSize={12} fontWeight={700} fill={DEEP[t.colour] ?? SOFT} textAnchor="start">{t.chance}</text>
                  </g>
                )
              })}
              {lines.map(({ t, share }) => {
                const up = share.slice(0, k)
                if (up.length === 0) return null
                const d = up.map((v, i) => `${i === 0 ? 'M' : 'L'} ${f1(px(i))} ${f1(py(v))}`).join(' ')
                const end = { x: px(up.length - 1), y: py(up[up.length - 1]) }
                return (
                  <g key={t.colour} data-line={t.colour}>
                    <path d={d} fill="none" stroke={DEEP[t.colour] ?? SOFT} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
                    <circle cx={f1(end.x)} cy={f1(end.y)} r={4} fill={FILL[t.colour] ?? SOFT} stroke={INK} strokeWidth={1.4} />
                  </g>
                )
              })}
              <text x={X0} y={Y0 + 16} fontSize={12} fontWeight={600} fill={SOFT}>0</text>
              <text x={X1} y={Y0 + 16} fontSize={12} fontWeight={600} fill={SOFT} textAnchor="end">{xmax} spins</text>
              {/* The last few results, as counters. */}
              {trail.map((c, i) => (
                <g key={`${k}-${i}`} data-trail={c}>
                  <circle cx={X0 + 8 + i * 17} cy={206} r={7} fill={FILL[c] ?? FILL.plain} stroke={BOARD_EDGE} strokeWidth={1.2} />
                  <circle cx={X0 + 8 + i * 17} cy={206} r={4} fill="none" stroke="#FFFFFF" strokeOpacity={0.7} strokeWidth={1} />
                </g>
              ))}
              {trail.length === 0 && <text x={X0} y={210} fontSize={12} fontWeight={600} fill={SOFT}>Last spins</text>}
            </g>
          </svg>
          {cells.map((c, i) => (
            <button
              key={i} type="button" data-i={i} disabled={!can} tabIndex={i === rove ? 0 : -1}
              aria-label={`Sector ${i + 1} of ${n}, ${c}`}
              onClick={() => { setRove(i); paint(i) }}
              onFocus={() => setFocus(i)} onBlur={() => setFocus(-1)}
              onKeyDown={(e) => arrowMove(e, i, n, 1, root.current, setRove)}
              className="nodrag absolute touch-manipulation border-none bg-transparent p-0 outline-none"
              style={{
                left: `${((SPIN.cx - SPIN.board) / W) * 100}%`, top: `${((SPIN.cy - SPIN.board) / SPIN_H) * 100}%`,
                width: `${((SPIN.board * 2) / W) * 100}%`, height: `${((SPIN.board * 2) / SPIN_H) * 100}%`,
                clipPath: clipOf(n, i), cursor: can ? 'pointer' : 'default',
              }}
            />
          ))}
        </div>
        <figcaption className="flex flex-wrap justify-center gap-x-3 gap-y-0.5 text-[12px] font-semibold text-ss-slate" aria-hidden="true">
          <Named swatch={<Swatch kind="line" />}>Share of spins</Named>
          <Named swatch={<Swatch kind="dots" />}>Chance asked for</Named>
          <Named swatch={<Swatch kind="spin" />}>Last spins</Named>
        </figcaption>
      </figure>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-1.5">
          <span className="text-[12px] font-bold text-ss-slate">Spin</span>
          <span className="flex items-center gap-1">
            {[1, 10, 100].map((by) => (
              <button key={by} type="button" className={btn} disabled={!can || spins >= MAX_SPINS} onClick={() => spin(by)} aria-label={by === 1 ? 'Spin once' : `Spin ${by} times`}>{`×${by}`}</button>
            ))}
            <button type="button" className={btn} disabled={!can || spins === 0} onClick={() => setState({ cells, spins: 0 })} aria-label="Clear the spins">Clear</button>
          </span>
        </div>
        <div className="grid border-t border-ss-line pt-1.5" style={{ gridTemplateColumns: `repeat(${config.targets.length + 1}, minmax(0, 1fr))`, columnGap: 16 }}>
          <p className="flex items-baseline justify-between">
            <span className="text-[12px] font-bold text-ss-slate">Spins</span>
            <span className="text-[15px] font-extrabold tabular-nums text-ss-ink" data-spins={spins}>{k}</span>
          </p>
          {config.targets.map((t) => (
            <p key={t.colour} className="flex items-baseline justify-between">
              <span className="text-[12px] font-bold text-ss-slate">{cap(t.colour)}</span>
              <span className="text-[15px] font-extrabold tabular-nums text-ss-ink">{landed.slice(0, k).filter((x) => x === t.colour).length}</span>
            </p>
          ))}
        </div>
      </div>

      <p className="pl-kbd hidden text-[12px] font-semibold text-ss-slate">Arrow keys move between sectors. Enter changes the colour of the one in focus.</p>
      <span className="sr-only" aria-live="polite">{spins === 0 ? 'Not spun yet.' : `Spun ${spins} ${spins === 1 ? 'time' : 'times'}.`}</span>
      {marked !== 'idle' && <Said said={finished ? working(config, now) : madeText(config, now)} />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// The two dice and their grid

function SpacePlate({ config, state, setState, marked, reduced, locked }: Props & { config: SpaceConfig }) {
  const now = marked === 'shown' ? probabilityLabEngine.solve(config) : state
  const d = sidesOf(config)
  const picks = picksOf(config, now)
  const rolls = marked === 'shown' ? 0 : rollsOf(now)
  const finished = marked === 'right' || marked === 'shown'
  const can = !locked && !finished
  const want = useMemo(() => eventPairs(config), [config.dice, config.event]) // eslint-disable-line react-hooks/exhaustive-deps
  const cell = d === 6 ? 33 : 49
  const GX = 46
  const GY = 52
  const root = useRef<HTMLDivElement>(null)
  const [rove, setRove] = useState(0)
  const [focus, setFocus] = useState(-1)
  const pairs = allPairs(d)
  const rolled = rolls > 0 ? rollAt(d, rolls - 1) : null
  const shownDice = rolled ?? { a: Math.min(d, 3), b: Math.min(d, 5) }
  const wrongNow = marked === 'wrong'
  const extra = new Set(wrongNow ? picks.filter((id) => !want.includes(id)) : [])
  const missing = new Set(wrongNow ? want.filter((id) => !picks.includes(id)) : [])

  const toggle = (id: string) => {
    if (!can) return
    setState({ picks: picks.includes(id) ? picks.filter((x) => x !== id) : [...picks, id], rolls })
  }
  const total = (a: number, b: number) => a + b

  const aria = `Two dice and a grid of every pair they can land on, first die across the top and second die down the side. ${picks.length} ${picks.length === 1 ? 'pair is' : 'pairs are'} marked with counters.${rolled ? ` The dice rolled ${rolled.a} and ${rolled.b}.` : ''}`

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-2 [&:has(button:focus-visible)_.pl-kbd]:block">
      <figure className="m-0 flex w-full flex-col gap-1.5">
        <div ref={root} className="relative w-full">
          <svg viewBox={`0 0 ${W} ${SPACE_H}`} role="img" aria-label={aria} className="block h-auto w-full select-none" fontFamily={FONT}>
            <rect x={0.75} y={0.75} width={W - 1.5} height={SPACE_H - 1.5} rx={16} fill={PLATE} stroke={PLATE_EDGE} strokeWidth={1.5} />
            <g aria-hidden="true">
              <text x={GX + (cell * d) / 2} y={17} fontSize={12} fontWeight={700} fill={SOFT} textAnchor="middle">first die</text>
              <text transform={`translate(10 ${GY + (cell * d) / 2}) rotate(-90)`} fontSize={12} fontWeight={700} fill={SOFT} textAnchor="middle">second die</text>
              {Array.from({ length: d }, (_, i) => (
                <g key={`h${i}`}>
                  <Die x={GX + i * cell + (cell - 24) / 2} y={GY - 29} size={24} face={i + 1} tone={DIE_A} />
                  <Die x={GX - 29} y={GY + i * cell + (cell - 24) / 2} size={24} face={i + 1} tone={DIE_B} />
                </g>
              ))}
              {pairs.map((p) => {
                const id = pairId(p.a, p.b)
                const x = GX + (p.a - 1) * cell
                const y = GY + (p.b - 1) * cell
                const on = picks.includes(id)
                const bad = extra.has(id)
                const gap = missing.has(id)
                const land = rolled && rolled.a === p.a && rolled.b === p.b
                return (
                  <g key={id} data-cell={id} data-on={on ? '1' : '0'}>
                    <rect x={x + 1.5} y={y + 1.5} width={cell - 3} height={cell - 3} rx={5} fill={TILE} stroke={gap ? COUNTER : TILE_EDGE} strokeWidth={gap ? 2 : 1} strokeDasharray={gap ? '4 3' : undefined} />
                    {on && (
                      <g data-counter="1" style={reduced ? undefined : { transition: 'opacity 250ms ease' }}>
                        <circle cx={x + cell / 2} cy={y + cell / 2} r={cell * 0.36} fill={bad ? BAD : COUNTER} />
                        <circle cx={x + cell / 2} cy={y + cell / 2} r={cell * 0.24} fill="none" stroke={bad ? '#F6C6CB' : COUNTER_RING} strokeWidth={1.4} />
                      </g>
                    )}
                    {marked !== 'idle' && (
                      <text x={x + cell / 2} y={y + cell / 2 + 4} fontSize={12} fontWeight={800} fill={on ? '#FFFFFF' : SOFT} textAnchor="middle">{total(p.a, p.b)}</text>
                    )}
                    {land && <rect data-landed="1" x={x + 1} y={y + 1} width={cell - 2} height={cell - 2} rx={6} fill="none" stroke={LANDED} strokeWidth={3} />}
                  </g>
                )
              })}
              {focus >= 0 && can && (() => {
                const p = pairs[focus]
                return <rect x={GX + (p.a - 1) * cell + 0.5} y={GY + (p.b - 1) * cell + 0.5} width={cell - 1} height={cell - 1} rx={6} fill="none" stroke={LANDED} strokeWidth={2.5} strokeDasharray="5 3" />
              })()}
              {/* The pair that last rolled, as two real dice. */}
              <Die x={262} y={92} size={42} face={shownDice.a} tone={DIE_A} />
              <Die x={310} y={92} size={42} face={shownDice.b} tone={DIE_B} />
              <text x={W - 28} y={158} fontSize={12} fontWeight={700} fill={SOFT} textAnchor="middle">{rolled ? `${rolled.a} and ${rolled.b}` : 'not rolled'}</text>
            </g>
          </svg>
          {pairs.map((p, i) => {
            const id = pairId(p.a, p.b)
            const on = picks.includes(id)
            return (
              <button
                key={id} type="button" data-i={i} disabled={!can} tabIndex={i === rove ? 0 : -1}
                aria-pressed={on}
                aria-label={`First die ${p.a}, second die ${p.b}, ${on ? 'marked' : 'not marked'}`}
                onClick={() => { setRove(i); toggle(id) }}
                onFocus={() => setFocus(i)} onBlur={() => setFocus(-1)}
                onKeyDown={(e) => arrowMove(e, i, d * d, d, root.current, setRove)}
                className="nodrag absolute touch-manipulation rounded-md border-none bg-transparent p-0 outline-none"
                style={{ left: `${((GX + (p.a - 1) * cell) / W) * 100}%`, top: `${((GY + (p.b - 1) * cell) / SPACE_H) * 100}%`, width: `${(cell / W) * 100}%`, height: `${(cell / SPACE_H) * 100}%`, cursor: can ? 'pointer' : 'default' }}
              />
            )
          })}
        </div>
        <figcaption className="flex flex-wrap justify-center gap-x-3 gap-y-0.5 text-[12px] font-semibold text-ss-slate" aria-hidden="true">
          <Named swatch={<Swatch kind="counter" />}>Marked pair</Named>
          <Named swatch={<Swatch kind="ring" />}>Where the dice landed</Named>
        </figcaption>
      </figure>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-1.5">
          <span className="text-[12px] font-bold text-ss-slate">Dice</span>
          <span className="flex items-center gap-1">
            <button type="button" className={btn} disabled={!can || rolls >= MAX_SPINS} onClick={() => setState({ picks, rolls: rolls + 1 })} aria-label="Roll the dice">Roll</button>
            <button type="button" className={btn} disabled={!can || (picks.length === 0 && rolls === 0)} onClick={() => setState({ picks: [], rolls: 0 })} aria-label="Clear the counters and the roll">Clear</button>
          </span>
        </div>
        <div className="grid grid-cols-2 gap-x-6 border-t border-ss-line pt-1.5">
          <p className="flex items-baseline justify-between">
            <span className="text-[12px] font-bold text-ss-slate">Pairs in all</span>
            <span className="text-[15px] font-extrabold tabular-nums text-ss-ink">{d * d}</span>
          </p>
          <p className="flex items-baseline justify-between">
            <span className="text-[12px] font-bold text-ss-slate">Marked</span>
            <span className="text-[15px] font-extrabold tabular-nums text-ss-ink" data-marked={picks.length}>{picks.length}</span>
          </p>
        </div>
      </div>

      <p className="pl-kbd hidden text-[12px] font-semibold text-ss-slate">Arrow keys move between squares. Enter marks or unmarks the one in focus.</p>
      <span className="sr-only" aria-live="polite">{rolled ? `Rolled ${rolled.a} and ${rolled.b}.` : 'Not rolled yet.'}</span>
      {marked !== 'idle' && <Said said={finished ? working(config, now) : madeText(config, now)} />}
    </div>
  )
}

export function ProbabilityLabView(props: Props) {
  return props.config.task === 'spinner'
    ? <SpinnerPlate {...props} config={props.config} />
    : <SpacePlate {...props} config={props.config} />
}

export const PLOT = { x0: 212, x1: 314, y0: 160, y1: 40 }
export { W, SPIN_H, SPACE_H, SPIN }
