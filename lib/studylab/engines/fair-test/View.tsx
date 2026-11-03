'use client'
import { useEffect, useRef, useState } from 'react'
import type { SceneViewProps } from '../types'
import type { FairConfig, FairState } from './config'
import { FACTORS, FACTOR_INFO, RUNS_MAX, differing, distances, fairTestEngine, laneA, laneB, madeText, meanOf, rollDistance, runsDone, working } from './config'
import type { Setup } from './config'

type Props = SceneViewProps<FairConfig, FairState>

// A bench is not a dark subject: a quiet plate, as measure-shape's and network-sim's are, with the real apparatus on it.
// The plate keeps its own colours in both themes. No gradients or shadows.
const PLATE = '#F8FAFC'
const PLATE_EDGE = '#CBD5E1'
const INK = '#16202A'
const SOFT = '#475569'
const FONT = 'system-ui, sans-serif'
const ACCENT = '#0E7490'
// Materials.
const WOOD = { top: '#E7CFA3', face: '#D8B98A', grain: '#C4A06B', joint: '#B38F58' }
const CARPET = { face: '#8FA8C8', fringe: '#6F89AE', fleck: '#A9BED8' }
const CARD = { face: '#EFE3C8', edge: '#B09A6E' }
const SAND = { face: '#BE8F5E', edge: '#7F5B35', grit: '#6E4C28' }
const BOOKS = ['#5F8FA6', '#C77D5B', '#D9AE4F', '#6E9174']
const CAR = '#C8553D'
const CAR_EDGE = '#8A3523'
const GLASS = '#CFE3EE'
const TYRE = '#1F2937'
const BLOCK = { face: '#9AA7B8', edge: '#5B6676', top: '#C0CAD6' }
const TAPE = { face: '#F2D36B', edge: '#A88420', tick: '#6B5410' }
const DOT = '#1F2937'

// The bench, in view units (the plate is 360 wide). Lane geometry is lane-local: y runs down from the lane's top.
export const W = 360
export const H = 240
export const LANE_H = 98
export const LANE_Y = [6, 106]
export const FLOOR = 64
export const SLAB = 30
export const X0 = 16
export const FOOT = 146
export const PXCM = 1.7
export const BOOK = 11
export const RAMP_THICK = 7
export const K = 1.35
/** From a car's centre to its nose, once drawn at its size. */
export const HALF = 13 * K
export const ROLL_MS = 1700
const T_START = 0.14
const T_END = (FOOT - HALF - X0) / (FOOT - X0)

const f1 = (n: number) => n.toFixed(1)
const toDeg = (r: number) => (r * 180) / Math.PI

type Pose = { x: number; y: number; rot: number }

export function rampOf(books: number) {
  const y0 = FLOOR - BOOK * books - RAMP_THICK
  const y1 = FLOOR - RAMP_THICK
  return { y0, y1, angle: Math.atan2(y1 - y0, FOOT - X0) }
}

/** Where a car is: on the ramp at fraction t of its way, or on the floor `d` cm along. */
export function poseOnRamp(books: number, t: number): Pose {
  const r = rampOf(books)
  return { x: X0 + (FOOT - X0) * t, y: r.y0 + (r.y1 - r.y0) * t, rot: toDeg(r.angle) }
}
export const poseOnFloor = (d: number): Pose => ({ x: FOOT - HALF + d * PXCM, y: FLOOR, rot: 0 })

/** The car mid-run: quickening down the ramp, then easing to a stop. */
export function poseAt(books: number, d: number, u: number): Pose {
  const split = 0.4
  if (u <= split) {
    const r = (u / split) ** 2
    return poseOnRamp(books, T_START + (T_END - T_START) * r)
  }
  const s = (u - split) / (1 - split)
  return poseOnFloor(d * (1 - (1 - s) ** 2))
}

/** Which row a dot sits in, so dots from nearby runs never touch. */
export const dotRow = (run: number) => run % 3
export const dotAt = (d: number, run: number) => ({ x: FOOT + d * PXCM, y: FLOOR + 7.5 + 8.5 * dotRow(run) })

// ---------------------------------------------------------------------------
// Parts of the bench.

function Floor({ carpet }: { carpet: boolean }) {
  const x = 10
  const w = 340
  if (carpet) {
    const teeth = Array.from({ length: 84 }, (_, i) => x + 2 + i * 4)
    return (
      <g data-floor="carpet">
        <rect x={x} y={FLOOR} width={w} height={SLAB} rx={3} fill={CARPET.face} />
        <g stroke={CARPET.fringe} strokeWidth={1.4} strokeLinecap="round">
          {teeth.map((tx, i) => <line key={tx} x1={tx} x2={tx} y1={FLOOR + 0.5} y2={FLOOR - (i % 3 === 0 ? 3.4 : 2.4)} />)}
        </g>
        <g stroke={CARPET.fleck} strokeWidth={1.4} strokeLinecap="round">
          {Array.from({ length: 36 }, (_, i) => (
            <line key={i} x1={x + 10 + ((i * 37) % 320)} x2={x + 14 + ((i * 37) % 320)} y1={FLOOR + 7 + ((i * 11) % 22)} y2={FLOOR + 7 + ((i * 11) % 22)} />
          ))}
        </g>
      </g>
    )
  }
  return (
    <g data-floor="wood">
      <rect x={x} y={FLOOR} width={w} height={SLAB} rx={3} fill={WOOD.face} />
      <rect x={x} y={FLOOR} width={w} height={3} rx={1.5} fill={WOOD.top} />
      <g stroke={WOOD.grain} strokeWidth={1} strokeLinecap="round">
        {[0, 1, 2, 3, 4, 5].map((i) => <line key={i} x1={x + 14 + i * 56} x2={x + 52 + i * 56} y1={FLOOR + 12 + ((i * 7) % 9)} y2={FLOOR + 12 + ((i * 7) % 9)} />)}
        {[0, 1, 2, 3, 4].map((i) => <line key={i} x1={x + 34 + i * 66} x2={x + 70 + i * 66} y1={FLOOR + 24 - ((i * 5) % 7)} y2={FLOOR + 24 - ((i * 5) % 7)} />)}
      </g>
      <g stroke={WOOD.joint} strokeWidth={1}>
        {[1, 2, 3, 4, 5].map((i) => <line key={i} x1={x + i * 56.7} x2={x + i * 56.7} y1={FLOOR + 3} y2={FLOOR + SLAB} />)}
      </g>
    </g>
  )
}

/** The books under the high end of the ramp, each a different cover with a pale band on its spine. */
function Books({ count }: { count: number }) {
  return (
    <g data-books={count}>
      {Array.from({ length: count }, (_, i) => {
        const nudge = ((i * 5) % 3) - 1
        const y = FLOOR - BOOK * (i + 1)
        return (
          <g key={i}>
            <rect x={X0 + 1 + nudge} y={y} width={28} height={BOOK} rx={1.5} fill={BOOKS[i % BOOKS.length]} stroke={INK} strokeWidth={0.8} strokeOpacity={0.5} />
            <rect x={X0 + 5 + nudge} y={y + 3} width={18} height={3} rx={1} fill="#FFFFFF" opacity={0.45} />
          </g>
        )
      })}
    </g>
  )
}

/** The ramp: a board resting on the books and the floor. Smooth card, or card covered in sandpaper grit. */
function Ramp({ books, sandpaper }: { books: number; sandpaper: boolean }) {
  const { y0, y1 } = rampOf(books)
  const mat = sandpaper ? SAND : { face: CARD.face, edge: CARD.edge }
  const grit = Array.from({ length: 30 }, (_, i) => {
    const t = 0.03 + ((i * 0.6180339) % 0.94)
    const wob = ((i * 5) % 4) + 0.8
    return { x: X0 + (FOOT - X0) * t, y: y0 + (y1 - y0) * t + wob }
  })
  return (
    <g data-ramp={sandpaper ? 'sandpaper' : 'card'}>
      <polygon
        points={`${X0},${y0} ${FOOT},${y1} ${FOOT},${y1 + RAMP_THICK} ${X0},${y0 + RAMP_THICK}`}
        fill={mat.face} stroke={mat.edge} strokeWidth={1.3} strokeLinejoin="round"
      />
      {sandpaper && (
        <g fill={SAND.grit}>
          {grit.map((g, i) => <circle key={i} cx={f1(g.x)} cy={f1(g.y)} r={1} />)}
        </g>
      )}
    </g>
  )
}

/** A toy pickup truck, nose to the right, wheels on the line y = 0. A load is two grey blocks in its bed. */
function Car({ load }: { load: boolean }) {
  return (
    <g transform={`scale(${K})`} data-load={load ? '1' : '0'}>
      <rect x={-13} y={-9.5} width={26} height={6} rx={1.8} fill={CAR} stroke={CAR_EDGE} strokeWidth={1} />
      <path d="M 1 -9.5 L 3 -14.5 H 9 L 11.5 -9.5 Z" fill={CAR} stroke={CAR_EDGE} strokeWidth={1} strokeLinejoin="round" />
      <path d="M 3.8 -13.5 H 8.2 L 9.6 -10.4 H 2.6 Z" fill={GLASS} />
      {load && (
        <g stroke={BLOCK.edge} strokeWidth={0.9} strokeLinejoin="round">
          <rect x={-12} y={-15.5} width={6} height={6} rx={0.8} fill={BLOCK.face} />
          <rect x={-5.2} y={-15.5} width={6} height={6} rx={0.8} fill={BLOCK.face} />
          <g stroke="none" fill={BLOCK.top}>
            <rect x={-11} y={-14.8} width={4} height={1.4} />
            <rect x={-4.2} y={-14.8} width={4} height={1.4} />
          </g>
        </g>
      )}
      {[-7.5, 7.5].map((x) => (
        <g key={x}>
          <circle cx={x} cy={-3.6} r={3.6} fill={TYRE} />
          <circle cx={x} cy={-3.6} r={1.2} fill="#E2E8F0" />
        </g>
      ))}
    </g>
  )
}

function Lane({ index, name, setup, pose, dots, mean }: {
  index: number; name: string; setup: Setup; pose: Pose; dots: { d: number; run: number }[]; mean: number | null
}) {
  return (
    <g transform={`translate(0 ${LANE_Y[index]})`} data-lane={name}>
      <Floor carpet={setup.carpet} />
      <g stroke="#FFFFFF" strokeWidth={1} strokeDasharray="3 3" opacity={0.55}>
        {[1, 2, 3, 4, 5].map((k) => <line key={k} x1={FOOT + 20 * PXCM * k} x2={FOOT + 20 * PXCM * k} y1={FLOOR + 3} y2={FLOOR + SLAB} />)}
      </g>
      <Books count={setup.books === 4 ? 4 : 2} />
      <Ramp books={setup.books === 4 ? 4 : 2} sandpaper={setup.sandpaper} />
      {dots.map((p) => {
        const at = dotAt(p.d, p.run)
        return <circle key={p.run} data-dot={p.run} cx={f1(at.x)} cy={f1(at.y)} r={3.6} fill={DOT} stroke={PLATE} strokeWidth={1.2} />
      })}
      {mean !== null && <rect data-mean={mean} x={f1(FOOT + mean * PXCM - 2)} y={FLOOR + 3} width={4} height={SLAB - 6} rx={1} fill={ACCENT} stroke={PLATE} strokeWidth={0.8} />}
      <g
        data-car={name} transform={`translate(${f1(pose.x)} ${f1(pose.y)}) rotate(${f1(pose.rot)})`}
       
      >
        <Car load={setup.load} />
      </g>
      <text x={X0} y={FLOOR + 20} fontSize={13} fontWeight={800} fill={INK} fontFamily={FONT} aria-hidden="true">{`Lane ${name}`}</text>
    </g>
  )
}

function Ruler({ marks: stops }: { marks: { a: number; b: number } | null }) {
  const y = 208
  const marks = Array.from({ length: 11 }, (_, i) => i * 10)
  return (
    <g data-ruler="1" fontFamily={FONT} aria-hidden="true">
      <rect x={FOOT - 4} y={y} width={352 - FOOT + 4} height={20} rx={2} fill={TAPE.face} stroke={TAPE.edge} strokeWidth={1.2} />
      <g stroke={TAPE.tick} strokeWidth={1.2}>
        {marks.map((cm) => <line key={cm} x1={FOOT + cm * PXCM} x2={FOOT + cm * PXCM} y1={y} y2={y + (cm % 20 === 0 ? 7 : 4.5)} />)}
      </g>
      <g fontSize={12} fontWeight={700} fill={INK} textAnchor="middle">
        {marks.filter((cm) => cm % 20 === 0).map((cm) => <text key={cm} x={FOOT + cm * PXCM} y={y + 17}>{cm}</text>)}
      </g>
      <text x={330} y={y + 17} fontSize={12} fontWeight={700} fill={SOFT}>cm</text>
      {stops && (
        <g data-stops="1">
          <path d={`M ${f1(FOOT + stops.a * PXCM - 5)} ${y - 8} h 10 l -5 8 Z`} fill={INK} />
          <path d={`M ${f1(FOOT + stops.b * PXCM - 5)} ${y + 28} h 10 l -5 -8 Z`} fill={ACCENT} />
        </g>
      )}
    </g>
  )
}

// ---------------------------------------------------------------------------
// The roll: a car goes down its ramp once for each run.

function useRoll(runs: number, reduced: boolean, ms: number): number | null {
  const [anim, setAnim] = useState<{ run: number; u: number } | null>(null)
  const prev = useRef(runs)
  useEffect(() => {
    if (runs > prev.current && !reduced) {
      prev.current = runs
      const start = performance.now()
      let raf = 0
      const tick = (t: number) => {
        const u = Math.max(0, Math.min(1, (t - start) / ms))
        setAnim({ run: runs, u })
        if (u < 1) raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
      return () => cancelAnimationFrame(raf)
    }
    prev.current = runs
  }, [runs, reduced, ms])
  return anim && anim.run === runs && anim.u < 1 ? anim.u : null
}

const setupWords = (s: Setup) => `${s.books} books under the ramp, ${s.load ? 'two blocks on the car' : 'an empty car'}, a ${s.sandpaper ? 'sandpaper' : 'smooth card'} ramp, and a ${s.carpet ? 'carpet' : 'wooden'} floor`
const describe = (a: Setup, b: Setup, runs: number, repeat: boolean) =>
  `A bench with two ramps, lane A above lane B, and a ruler in centimetres. Lane A has ${setupWords(a)}. Lane B has ${setupWords(b)}.${repeat ? ` ${runs} ${runs === 1 ? 'run has' : 'runs have'} been rolled, each marked by a dot where the cars stopped.` : ''}`

const segment = 'nodrag flex h-7 min-w-0 flex-1 select-none items-center justify-center whitespace-nowrap rounded-lg border-2 px-2 text-[13px] font-extrabold leading-none touch-manipulation outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--subject)] disabled:cursor-not-allowed motion-reduce:transition-none'
const chosen = 'border-[color:var(--subject)] bg-ss-chip text-ss-ink'
const unchosen = 'border-ss-line bg-ss-panel text-ss-slate hover:border-[color:var(--subject)]'
const action = 'nodrag flex h-7 select-none items-center justify-center whitespace-nowrap rounded-lg border-2 border-ss-line bg-ss-panel px-3 text-[13px] font-extrabold leading-none text-ss-ink touch-manipulation outline-none transition-colors hover:border-[color:var(--subject)] focus-visible:ring-2 focus-visible:ring-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'

export function FairTestView({ config, state, setState, marked, reduced, locked }: Props) {
  const now = marked === 'shown' ? fairTestEngine.solve(config) : state
  const repeat = config.task === 'repeat'
  const a = laneA
  const b = laneB(config, now)
  const runs = runsDone(config, now)
  const finished = marked === 'right' || marked === 'shown'
  const rolled = repeat ? 0 : Math.max(0, Math.floor(Number(now?.rolled) || 0))
  // A bench rolls when let go, and once more by itself when marked right.
  const u = useRoll(repeat ? runs : rolled + (finished ? 1000 : 0), reduced, repeat ? 1700 : 2400)
  const gone = !repeat && (rolled > 0 || finished)
  const stopAt = { a: rollDistance(a), b: rollDistance(b) }
  const frozen = locked || finished
  const change = FACTORS.includes(config.change as never) ? config.change : 'height'
  const data = distances(change, runs)

  const settled = repeat && u !== null ? runs - 1 : runs
  const dotsOf = (rows: number[]) => rows.slice(0, settled).map((d, run) => ({ d, run }))
  const restPose = (s: Setup, rows: number[], d: number): Pose => (repeat ? (runs === 0 ? poseOnRamp(s.books, T_START) : poseOnFloor(rows[runs - 1])) : gone ? poseOnFloor(d) : poseOnRamp(s.books, T_START))
  const poseOf = (s: Setup, rows: number[], d: number): Pose => {
    if (u === null) return restPose(s, rows, d)
    return repeat ? poseAt(s.books, rows[runs - 1], u) : poseAt(s.books, d, u)
  }
  const meanA = marked !== 'idle' && repeat && runs > 0 ? meanOf(data.a) : null
  const meanB = marked !== 'idle' && repeat && runs > 0 ? meanOf(data.b) : null

  const pick = (f: string, on: boolean) => {
    if (frozen) return
    const rest = differing(config, now).filter((x) => x !== f)
    setState({ diff: on ? [...rest, f] : rest })
  }
  const letGo = () => {
    if (frozen) return
    setState({ diff: differing(config, now), rolled: rolled + 1 })
  }
  const roll = () => {
    if (frozen || runs >= RUNS_MAX) return
    setState({ runs: runs + 1 })
  }
  const stopArrows = (e: React.KeyboardEvent) => {
    if (e.key.startsWith('Arrow')) e.stopPropagation()
  }

  const said = finished ? working(config, now) : marked === 'wrong' ? madeText(config, now) : ''
  const lead = said.match(/^(Yes\. [^.]*\.)\s*(.*)$/)
  const on = differing(config, now)

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-2" onKeyDown={stopArrows}>
      <figure className="m-0 flex w-full flex-col gap-1.5">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={describe(a, b, runs, repeat)} className="block h-auto w-full select-none">
          <rect x={0.75} y={0.75} width={W - 1.5} height={H - 1.5} rx={16} fill={PLATE} stroke={PLATE_EDGE} strokeWidth={1.5} />
          <Lane index={0} name="A" setup={a} pose={poseOf(a, data.a, stopAt.a)} dots={dotsOf(data.a)} mean={meanA} />
          <line x1={16} x2={344} y1={103} y2={103} stroke="#E2E8F0" strokeWidth={1} />
          <Lane index={1} name="B" setup={b} pose={poseOf(b, data.b, stopAt.b)} dots={dotsOf(data.b)} mean={meanB} />
          <Ruler marks={gone && u === null ? stopAt : null} />
        </svg>
        <div className="flex items-center justify-between gap-3">
          <p className="text-[12px] font-semibold leading-snug text-ss-slate">
            {repeat ? 'Each dot marks where a car stopped. Cars are let go, not pushed.' : 'Lane A stays as it is. Cars are let go, not pushed. Triangles on the ruler mark where each stopped.'}
          </p>
          {!repeat && <button type="button" aria-label="Let go of both cars" disabled={frozen} onClick={letGo} className={action}>Let go</button>}
        </div>
      </figure>

      {repeat ? (
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-baseline gap-2">
            <span className="text-[12px] font-bold text-ss-slate">Runs</span>
            <span className="text-[15px] font-extrabold tabular-nums text-ss-ink" data-runs={runs}>{runs}</span>
          </p>
          <div className="flex gap-1.5">
            <button type="button" aria-label="Roll both cars" disabled={frozen || runs >= RUNS_MAX} onClick={roll} className={action}>Roll both cars</button>
            <button type="button" aria-label="Clear the runs" disabled={frozen || runs === 0} onClick={() => setState({ runs: 0 })} className={action}>Clear</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5" role="group" aria-label="What lane B has">
          {FACTORS.map((f) => {
            const info = FACTOR_INFO[f]
            const differs = on.includes(f)
            return (
              <div key={f} className="flex items-center gap-2" data-row={f}>
                <span className="w-[100px] shrink-0 text-[12px] font-bold text-ss-slate">{info.label}</span>
                <div className="flex min-w-0 flex-1 gap-1.5">
                  <button
                    type="button" disabled={frozen} aria-pressed={!differs} aria-label={`Lane B ${info.lower}: ${info.a}`}
                    onClick={() => pick(f, false)} className={`${segment} ${!differs ? chosen : unchosen}`}
                  >{info.a}</button>
                  <button
                    type="button" disabled={frozen} aria-pressed={differs} aria-label={`Lane B ${info.lower}: ${info.b}`}
                    onClick={() => pick(f, true)} className={`${segment} ${differs ? chosen : unchosen}`}
                  >{info.b}</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <span className="sr-only" aria-live="polite">{repeat ? `${runs} ${runs === 1 ? 'run' : 'runs'} rolled.` : ''}</span>
      {marked !== 'idle' && (
        <div className="rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2">
          <p className="text-[13px] font-extrabold leading-snug text-ss-ink">{lead ? lead[1] : said}</p>
          {lead && lead[2] && <p className="mt-0.5 text-[12px] font-semibold leading-snug text-ss-slate">{lead[2]}</p>}
        </div>
      )}
    </div>
  )
}
