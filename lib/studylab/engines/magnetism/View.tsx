'use client'
import { useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { SceneMarked, SceneViewProps } from '../types'
import type { CompassTask, End, FieldTask, InductionTask, MagnetismConfig, MagnetismState, Pole, PoleTask, Run, Site, Size, Way } from './config'
import {
  KEY_TURNS, angleFromDelta, turnedTo, bodiesOf, compassSaid, compassVerdict, endsOf, fieldLines, halfOf, hasNeutralPoint, inductionSaid, leftEndOf, movementText, outcomeOf,
  pointingWords, poleSaid, poleVerdict, readAngles, readEnds, readSize, readWay, referenceSide, sitesOf, toPx, inductionVerdict, stepsOf, fromSteps,
  REFERENCE_TEXT, THICK, VIEW,
} from './config'

// Flat palette, each colour over 3:1 on both ss-panel and ss-chip.
// Literals only — nothing read from config at module load (rule 41).
const NORTH = '#C81E1E'
const SOUTH = '#1D4ED8'
const BARE = '#CBD5E1'
const LINE = '#3B5B7A'
const INK = '#16202A'
const SOFT = '#475569'
const GOOD = '#047857'
const BAD = '#B0303C'
const COPPER = '#B45309'
const DIAL_BG = '#FFFFFF'
const FONT = 'system-ui, sans-serif'

const f = (v: number) => (Math.round(v * 10) / 10).toString()

const BUTTON = 'nodrag inline-flex min-h-[44px] items-center justify-center rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-1.5 text-center text-[13px] font-bold leading-tight text-ss-ink touch-manipulation whitespace-nowrap hover:border-[color:var(--subject)] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:opacity-50'
const CHOSEN = { borderColor: 'var(--subject)', background: 'color-mix(in srgb, var(--subject) 14%, transparent)' } as const

const keepArrows = (e: KeyboardEvent) => { if (e.key.startsWith('Arrow')) e.stopPropagation() }

function Said({ lines }: { lines: string[] }) {
  if (!lines.length) return null
  return (
    <div aria-live="polite" className="flex w-full flex-col items-center gap-1 text-center">
      {lines.map((line, i) => (
        <p key={i} className={i === 0 ? 'text-[15px] font-extrabold leading-snug text-ss-ink' : 'text-[13px] font-semibold leading-snug text-ss-slate'}>
          {line}
        </p>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// The field picture: magnets, field lines, plotting compasses.

// Literals, not config constants: config imports this file so its values are
// not ready at module load. The test checks they agree.
export const SIZE = { l: 12, w: 3.6, dial: 16, hit: 24 } as const

function Needle({ x, y, angle, ghost }: { x: number; y: number; angle: number; ghost?: boolean }) {
  const { l, w } = SIZE
  const stroke = ghost ? GOOD : INK
  return (
    <g transform={`translate(${f(x)} ${f(y)}) rotate(${-angle})`} pointerEvents="none">
      <polygon points={`${l},0 0,${-w} 0,${w}`} fill={ghost ? 'none' : NORTH} stroke={stroke} strokeWidth={ghost ? 1.8 : 1} strokeDasharray={ghost ? '3 2' : undefined} strokeLinejoin="round" />
      <polygon points={`${-l},0 0,${-w} 0,${w}`} fill={ghost ? 'none' : '#F1F5F9'} stroke={stroke} strokeWidth={ghost ? 1.8 : 1} strokeDasharray={ghost ? '3 2' : undefined} strokeLinejoin="round" />
      <circle r={2} fill={stroke} />
    </g>
  )
}

export function badgeOf(site: { x: number; y: number }): { x: number; y: number; r: number } {
  const c = toPx(site.x, site.y)
  return { x: c.x + (site.x < 0 ? 19 : -19), y: c.y - 19, r: 8.5 }
}

export function markerOf(end: { x: number }): { x: number; y: number; r: number } {
  const c = toPx(end.x, -(THICK + 0.52))
  return { x: c.x, y: c.y, r: 9 }
}

function Compass({ site, angle, ghost, mark, focused, live }: {
  site: Site; angle: number; ghost?: number; mark?: 'right' | 'wrong' | null; focused?: boolean; live?: boolean
}) {
  const c = toPx(site.x, site.y)
  const b = badgeOf(site)
  const ring = mark === 'right' ? GOOD : mark === 'wrong' ? BAD : INK
  return (
    <g>
      {live && <circle cx={f(c.x)} cy={f(c.y)} r={SIZE.hit} fill="transparent" />}
      {focused && <circle cx={f(c.x)} cy={f(c.y)} r={SIZE.dial + 5} fill="none" stroke="var(--subject)" strokeWidth={3} />}
      <circle cx={f(c.x)} cy={f(c.y)} r={SIZE.dial} fill={DIAL_BG} stroke={ring} strokeWidth={mark ? 2.4 : 1.8} strokeDasharray={mark === 'wrong' ? '4 3' : undefined} />
      {ghost !== undefined && (
        <g aria-hidden="true">
          <Needle x={c.x} y={c.y} angle={ghost} ghost />
          <polygon points="10,0 0,-5.5 0,5.5" fill={GOOD} stroke={DIAL_BG} strokeWidth={1.2} strokeLinejoin="round" transform={`translate(${f(c.x)} ${f(c.y)}) rotate(${-ghost}) translate(${SIZE.dial + 2} 0)`} />
        </g>
      )}
      <Needle x={c.x} y={c.y} angle={angle} />
      {site.id >= 0 && (
        <g pointerEvents="none">
          <circle cx={f(b.x)} cy={f(b.y)} r={b.r} fill={INK} />
          <text x={f(b.x)} y={f(b.y + 4.5)} textAnchor="middle" fill="#FFFFFF" fontSize={12} fontWeight={700} fontFamily={FONT}>{site.id + 1}</text>
        </g>
      )}
    </g>
  )
}

function FixedCompass({ site }: { site: Site }) {
  const c = toPx(site.x, site.y)
  return (
    <g>
      <circle cx={f(c.x)} cy={f(c.y)} r={SIZE.dial} fill={DIAL_BG} stroke={INK} strokeWidth={1.8} />
      <Needle x={c.x} y={c.y} angle={site.truth} />
    </g>
  )
}

function linePath(run: Run): string {
  const pts = run.pts.filter((_, i) => i % 5 === 0 || i === run.pts.length - 1)
  return pts.map((p, i) => {
    const q = toPx(p.x, p.y)
    return `${i === 0 ? 'M' : 'L'}${f(q.x)} ${f(q.y)}`
  }).join(' ')
}

function Lines({ lines, clip }: { lines: Run[]; clip: string }) {
  return (
    <g aria-hidden="true" clipPath={`url(#${clip})`}>
      <g fill="none" stroke={LINE} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
        {lines.map((r, i) => <path key={i} d={linePath(r)} />)}
      </g>
      <g fill={LINE}>
        {lines.map((r, i) => {
          const q = toPx(r.arrow.x, r.arrow.y)
          return <polygon key={i} points="6,0 -4.5,-4 -4.5,4" transform={`translate(${f(q.x)} ${f(q.y)}) rotate(${-r.arrow.angle})`} />
        })}
      </g>
    </g>
  )
}

type Tint = { fill: string; letter: string }
const TINTS: Record<Pole | '', Tint> = { N: { fill: NORTH, letter: 'N' }, S: { fill: SOUTH, letter: 'S' }, '': { fill: BARE, letter: '' } }

function Magnets({ task, ends, named }: { task: FieldTask; ends: End[]; named: (Pole | '')[] }) {
  const bodies = bodiesOf(task.arrangement)
  return (
    <g aria-hidden="true">
      {ends.map((e, i) => {
        const h = halfOf(task.arrangement, e)
        const a = toPx(h.x0, THICK)
        const b = toPx(h.x1, -THICK)
        const tint = TINTS[named[i]]
        return (
          <g key={e.id}>
            <rect x={f(a.x)} y={f(a.y)} width={f(b.x - a.x)} height={f(b.y - a.y)} fill={tint.fill} />
            {tint.letter && (
              <text x={f((a.x + b.x) / 2)} y={f((a.y + b.y) / 2 + 5)} textAnchor="middle" fill="#FFFFFF" fontSize={14} fontWeight={800} fontFamily={FONT}>{tint.letter}</text>
            )}
          </g>
        )
      })}
      {bodies.map((m, i) => {
        const a = toPx(m.x0, THICK)
        const b = toPx(m.x1, -THICK)
        return <rect key={i} x={f(a.x)} y={f(a.y)} width={f(b.x - a.x)} height={f(b.y - a.y)} fill="none" stroke={INK} strokeWidth={2} />
      })}
    </g>
  )
}

function NeutralMark() {
  const c = toPx(0, 0)
  const d = 6
  return (
    <g aria-hidden="true" strokeLinecap="round">
      <path d={`M${f(c.x - d)} ${f(c.y - d)} L${f(c.x + d)} ${f(c.y + d)} M${f(c.x - d)} ${f(c.y + d)} L${f(c.x + d)} ${f(c.y - d)}`} stroke="#FFFFFF" strokeWidth={6} />
      <path d={`M${f(c.x - d)} ${f(c.y - d)} L${f(c.x + d)} ${f(c.y + d)} M${f(c.x - d)} ${f(c.y + d)} L${f(c.x + d)} ${f(c.y - d)}`} stroke={BAD} strokeWidth={2.6} />
    </g>
  )
}

const ARRANGEMENT_ALT = {
  single: 'A bar magnet',
  attract: 'Two bar magnets end to end',
  repel: 'Two bar magnets end to end',
} as const

const polesWords = (ends: End[]) => ends.map((e) => (e.sign === 'N' ? 'north' : 'south')).join(', ')

// ---------------------------------------------------------------------------
// Compass cards: turn the needles to show the field.

function CompassCard({ task, state, setState, marked, locked }: {
  task: CompassTask; state: MagnetismState; setState(next: MagnetismState): void; marked: SceneMarked; locked: boolean
}) {
  const svg = useRef<SVGSVGElement>(null)
  const clip = `mag-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const drag = useRef<number | null>(null)
  const [focus, setFocus] = useState<number | null>(null)
  const [said, setSaid] = useState('')
  const sites = sitesOf(task)
  const angles = readAngles(task, state)
  const ends = endsOf(task)
  const live = !locked
  const named = marked !== 'idle'
  const verdict = compassVerdict(task, state)
  const lines = named ? fieldLines(task.arrangement, leftEndOf(task)) : []
  const reveal = marked === 'shown'
  const outcome = (id: number): 'right' | 'wrong' | null => (!named || marked === 'shown' ? null : verdict.wrong.includes(id) ? 'wrong' : 'right')

  const turn = (i: number, to: number) => {
    const next = turnedTo(angles, i, to)
    if (!next) return
    setState({ angles: next })
    setSaid(`Compass ${i + 1} now points ${pointingWords(next[i])}.`)
  }
  const fromPointer = (i: number, e: PointerEvent) => {
    const el = svg.current
    if (!el) return
    const box = el.getBoundingClientRect()
    const k = box.width / VIEW.w
    const c = toPx(sites[i].x, sites[i].y)
    const to = angleFromDelta(e.clientX - (box.left + c.x * k), box.top + c.y * k - e.clientY)
    if (to !== null) turn(i, to)
  }
  const onKey = (i: number) => (e: KeyboardEvent) => {
    if (!live) return
    const step = (KEY_TURNS as Record<string, number>)[e.key]
    if (step === undefined) return
    e.preventDefault()
    e.stopPropagation()
    turn(i, angles[i] + step)
  }

  const lit = marked === 'wrong' ? verdict.wrong : []
  const said_ = named ? compassSaid(task, state, marked === 'wrong' ? 'wrong' : marked === 'shown' ? 'shown' : 'right') : []

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col items-center gap-2" onKeyDown={keepArrows}>
      <figure className="m-0 w-full" style={{ maxWidth: VIEW.w }}>
        <svg
          ref={svg}
          viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
          className={`block w-full select-none rounded-2xl border border-ss-line bg-ss-chip ${live ? 'touch-none' : ''}`}
          role="group"
          aria-label={`${ARRANGEMENT_ALT[task.arrangement]}, with its poles labelled N and S. From left to right the poles are ${polesWords(ends)}. ${sites.length} plotting compasses stand near ${task.arrangement === 'single' ? 'it' : 'them'}, numbered 1 to ${sites.length}.`}
        >
          <defs><clipPath id={clip}><rect width={VIEW.w} height={VIEW.h} rx={16} /></clipPath></defs>
          {named && <Lines lines={lines} clip={clip} />}
          <Magnets task={task} ends={ends} named={ends.map((e) => e.sign)} />
          {named && hasNeutralPoint(task.arrangement) && <NeutralMark />}
          {sites.map((s, i) => {
            const mark = outcome(s.id)
            return (
              <g
                key={s.id}
                role="slider"
                tabIndex={live ? 0 : -1}
                aria-label={`Compass ${s.id + 1}. Turn it, or use the arrow keys`}
                aria-orientation="horizontal"
                aria-valuemin={0}
                aria-valuemax={345}
                aria-valuenow={angles[i]}
                aria-valuetext={`Pointing ${pointingWords(angles[i])}`}
                aria-readonly={!live || undefined}
                onKeyDown={onKey(i)}
                onFocus={() => setFocus(i)}
                onBlur={() => setFocus((f0) => (f0 === i ? null : f0))}
                onPointerDown={(e) => {
                  if (!live) return
                  drag.current = i
                  e.currentTarget.setPointerCapture?.(e.pointerId)
                  fromPointer(i, e)
                }}
                onPointerMove={(e) => drag.current === i && fromPointer(i, e)}
                onPointerUp={() => { drag.current = null }}
                onPointerCancel={() => { drag.current = null }}
                className={`outline-none focus-visible:outline-none ${live ? 'cursor-grab' : ''}`}
              >
                <Compass
                  site={s}
                  angle={reveal ? s.truth : angles[i]}
                  ghost={named && lit.includes(s.id) ? s.truth : undefined}
                  mark={mark}
                  focused={focus === i && live}
                  live={live}
                />
              </g>
            )
          })}
        </svg>
        <figcaption className="mt-1 text-center text-[12px] font-semibold text-ss-slate">
          {ARRANGEMENT_ALT[task.arrangement]}, with a plotting compass at each numbered point.
          {named && lit.length > 0 ? ' A green arrowhead and dashed needle show the way the field points.' : ''}
          {named && hasNeutralPoint(task.arrangement) ? ' × marks the neutral point.' : ''}
        </figcaption>
      </figure>
      {live && (
        <p className="text-center text-[12px] font-semibold text-ss-slate">
          The red end of a needle is its north-seeking end. Drag a needle round, or click it and use the arrow keys.
        </p>
      )}
      <p className="sr-only" aria-live="polite">{said}</p>
      <Said lines={said_} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Pole cards: tap each end of the magnets to name it N or S.

const POLE_CYCLE: (Pole | '')[] = ['', 'N', 'S']

function PoleCard({ task, state, setState, marked, locked }: {
  task: PoleTask; state: MagnetismState; setState(next: MagnetismState): void; marked: SceneMarked; locked: boolean
}) {
  const [said, setSaid] = useState('')
  const clip = `mag-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const sites = sitesOf(task)
  const ends = endsOf(task)
  const given = readEnds(task, state) as (Pole | '')[]
  const named = marked !== 'idle'
  const truth = ends.map((e) => e.sign)
  const lines = fieldLines(task.arrangement, leftEndOf(task))
  const verdict = poleVerdict(task, state)
  const shownAs = named ? truth : given

  const cycle = (i: number) => {
    if (locked) return
    const at = POLE_CYCLE.indexOf(given[i])
    const to = POLE_CYCLE[(at + 1) % POLE_CYCLE.length]
    const next = given.slice()
    next[i] = to
    setState({ ends: next })
    setSaid(to ? `End ${ends[i].letter} named a ${to === 'N' ? 'north' : 'south'} pole.` : `End ${ends[i].letter} cleared.`)
  }
  const onEndKey = (i: number) => (e: KeyboardEvent) => {
    if (locked) return
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      cycle(i)
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault()
      e.stopPropagation()
      const next = given.slice()
      next[i] = 'N'
      setState({ ends: next })
      setSaid(`End ${ends[i].letter} named a north pole.`)
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault()
      e.stopPropagation()
      const next = given.slice()
      next[i] = 'S'
      setState({ ends: next })
      setSaid(`End ${ends[i].letter} named a south pole.`)
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      e.stopPropagation()
      const next = given.slice()
      next[i] = ''
      setState({ ends: next })
      setSaid(`End ${ends[i].letter} cleared.`)
    }
  }

  const said_ = named ? poleSaid(task, state, marked === 'wrong' ? 'wrong' : marked === 'shown' ? 'shown' : 'right') : []
  const flow = ends.map((e) => `At end ${e.letter} the lines run ${e.sign === 'N' ? 'out of' : 'into'} the magnet.`).join(' ')

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col items-center gap-2" onKeyDown={keepArrows}>
      <figure className="m-0 w-full" style={{ maxWidth: VIEW.w }}>
        <svg
          viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
          className="block w-full select-none rounded-2xl border border-ss-line bg-ss-chip"
          role="group"
          aria-label={`${ARRANGEMENT_ALT[task.arrangement]}, with field lines drawn round ${task.arrangement === 'single' ? 'it' : 'them'}, each with an arrow on it, and ${sites.length} compasses. The ends are lettered ${ends.map((e) => e.letter).join(', ')} from left to right. ${flow}`}
        >
          <defs><clipPath id={clip}><rect width={VIEW.w} height={VIEW.h} rx={16} /></clipPath></defs>
          <Lines lines={lines} clip={clip} />
          <Magnets task={task} ends={ends} named={shownAs} />
          {named && hasNeutralPoint(task.arrangement) && <NeutralMark />}
          {sites.map((s) => <FixedCompass key={s.id} site={s} />)}
          {ends.map((e) => {
            const m = markerOf(e)
            const bad = named && verdict.wrong.includes(e.id)
            const current = shownAs[e.id]
            return (
              <g
                key={e.id}
                role="button"
                tabIndex={locked ? -1 : 0}
                aria-label={`End ${e.letter}${current ? `: ${current === 'N' ? 'north' : 'south'} pole` : ' (unnamed)'}. ${locked ? '' : 'Tap to cycle north, south, blank. Or press N or S.'}`}
                onClick={() => cycle(e.id)}
                onKeyDown={onEndKey(e.id)}
                className={`outline-none cursor-pointer focus-visible:outline-none ${locked ? 'pointer-events-none' : ''}`}
              >
                {!locked && (
                  <rect x={f(m.x - 14)} y={f(m.y - 14)} width={28} height={28} rx={14} fill="transparent" />
                )}
                <circle cx={f(m.x)} cy={f(m.y)} r={m.r} fill={current ? (current === 'N' ? NORTH : SOUTH) : INK} stroke={bad ? BAD : '#FFFFFF'} strokeWidth={bad ? 2.5 : 1.5} />
                <text x={f(m.x)} y={f(m.y + 4.5)} textAnchor="middle" fill="#FFFFFF" fontSize={12} fontWeight={700} fontFamily={FONT}>{current || e.letter}</text>
                {!locked && !current && (
                  <g pointerEvents="none" opacity={0.5}>
                    <text x={f(m.x)} y={f(m.y - 14)} textAnchor="middle" fill={INK} fontSize={12} fontWeight={700} fontFamily={FONT}>tap</text>
                  </g>
                )}
              </g>
            )
          })}
        </svg>
        <figcaption className="mt-1 text-center text-[12px] font-semibold text-ss-slate">
          {ARRANGEMENT_ALT[task.arrangement]}. An arrow on a field line shows which way the field points. Tap an end to name it.
          {named && hasNeutralPoint(task.arrangement) ? ' × marks the neutral point.' : ''}
        </figcaption>
      </figure>
      <p className="sr-only" aria-live="polite">{said}</p>
      <Said lines={said_} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Induction cards: drag the meter needle to predict its deflection.

export const PANEL = { w: 360, h: 130 } as const
const METER = { px: 292, py: 88, needle: 42, arc: 52, window: { x: 244, y: 12, w: 96, h: 80 } } as const
const COIL = { x0: 118, dx: 11, turns: 6, rx: 6.5, ry: 26, cy: 72 } as const
const MAGNET = { w: 88, h: 22, cy: 72 } as const

type Speed = 'same' | 'faster' | 'slower'
const ARROW_LEN: Record<Speed, number> = { slower: 34, same: 56, faster: 80 }

const STEP_DEG = 9
const SCALE_N = 5

const tip = (steps: number, len: number) => {
  const a = (steps * STEP_DEG * Math.PI) / 180
  return { x: METER.px + len * Math.sin(a), y: METER.py - len * Math.cos(a) }
}

function Meter({ truth, mine, refSteps, draggable, onDrag }: {
  truth: number | null; mine: number | null; refSteps: number | null
  draggable?: boolean; onDrag?: (steps: number) => void
}) {
  const shown = truth ?? mine ?? 0
  const t = tip(shown, METER.needle)
  const me = mine !== null && truth !== null && mine !== truth ? tip(mine, METER.needle) : null
  const w = METER.window
  const ticks = []
  for (let k = -SCALE_N; k <= SCALE_N; k++) {
    const len = k === 0 || Math.abs(k) === SCALE_N ? 10 : 6
    const a = tip(k, METER.arc)
    const b = tip(k, METER.arc - len)
    ticks.push(<line key={k} x1={f(a.x)} y1={f(a.y)} x2={f(b.x)} y2={f(b.y)} stroke={INK} strokeWidth={k === 0 ? 2 : 1.4} />)
  }
  const marker = refSteps === null ? null : (() => {
    const a = tip(refSteps, METER.arc + 3)
    const l = tip(refSteps - 0.6, METER.arc + 11)
    const r = tip(refSteps + 0.6, METER.arc + 11)
    return `${f(a.x)},${f(a.y)} ${f(l.x)},${f(l.y)} ${f(r.x)},${f(r.y)}`
  })()

  const needleColor = truth === null && mine !== null ? SOUTH : INK

  return (
    <g>
      <rect x={236} y={4} width={112} height={118} rx={10} fill="#E2E8F0" stroke={INK} strokeWidth={2} />
      <rect x={w.x} y={w.y} width={w.w} height={w.h} rx={6} fill="#FFFFFF" stroke="#94A3B8" strokeWidth={1.2} />
      {ticks}
      <text x={METER.px} y={METER.py - METER.arc - 6} textAnchor="middle" fill={INK} fontSize={12} fontWeight={700} fontFamily={FONT}>0</text>
      {marker && <polygon points={marker} fill={COPPER} stroke="#FFFFFF" strokeWidth={0.8} />}
      {me && <line x1={METER.px} y1={METER.py} x2={f(me.x)} y2={f(me.y)} stroke={SOUTH} strokeWidth={2.6} strokeDasharray="4 3" strokeLinecap="round" />}
      <line x1={METER.px} y1={METER.py} x2={f(t.x)} y2={f(t.y)} stroke={needleColor} strokeWidth={3} strokeLinecap="round" />
      {draggable && mine !== null && (
        <circle cx={f(t.x)} cy={f(t.y)} r={8} fill="none" stroke={SOUTH} strokeWidth={2.4} />
      )}
      <circle cx={METER.px} cy={METER.py} r={5} fill={needleColor} />
    </g>
  )
}

function InductionPanel({ pole, motion, speed, truth, mine, refSteps, label, draggable, onDrag, svgRef }: {
  pole: Pole; motion: string; speed: Speed; truth: number | null; mine: number | null; refSteps: number | null; label: string
  draggable?: boolean; onDrag?: (steps: number) => void; svgRef?: React.RefObject<SVGSVGElement | null>
}) {
  const inside = motion !== 'in'
  const rightEnd = inside ? 150 : 96
  const left = rightEnd - MAGNET.w
  const mid = left + MAGNET.w / 2
  const top = MAGNET.cy - MAGNET.h / 2
  const rightPole: Pole = pole
  const leftPole: Pole = pole === 'N' ? 'S' : 'N'
  const half = (x: number, p: Pole) => <rect x={x} y={top} width={MAGNET.w / 2} height={MAGNET.h} fill={TINTS[p].fill} />
  const letter = (x: number, p: Pole) => (
    <text x={x + MAGNET.w / 4} y={MAGNET.cy + 5} textAnchor="middle" fill="#FFFFFF" stroke={TINTS[p].fill} strokeWidth={4} paintOrder="stroke" fontSize={14} fontWeight={800} fontFamily={FONT}>{p}</text>
  )
  const arrowLen = ARROW_LEN[speed]
  const toRight = motion === 'in'
  const ay = 34
  const ax = (motion === 'in' ? 52 : 106) + (toRight ? -arrowLen / 2 : arrowLen / 2)
  const bx = ax + (toRight ? arrowLen : -arrowLen)
  const verb = motion === 'in' ? 'pushed in' : motion === 'out' ? 'pulled out' : 'held still'
  const caption = motion === 'still' ? verb : speed === 'faster' ? `${verb}, faster` : speed === 'slower' ? `${verb}, slower` : verb
  const labelX = motion === 'still' ? mid : (ax + bx) / 2
  const turns = Array.from({ length: COIL.turns }, (_, k) => COIL.x0 + COIL.dx * k)

  return (
    <svg ref={svgRef as React.LegacyRef<SVGSVGElement>} viewBox={`0 0 ${PANEL.w} ${PANEL.h}`} className={`block w-full select-none rounded-2xl border border-ss-line bg-ss-chip ${draggable ? 'touch-none' : ''}`} role={draggable ? 'group' : 'img'} aria-label={label}>
      <g fill="none" stroke={COPPER} strokeWidth={3} strokeLinecap="round">
        {turns.map((x) => <path key={`b${x}`} d={`M${x} ${COIL.cy - COIL.ry} A${COIL.rx} ${COIL.ry} 0 0 0 ${x} ${COIL.cy + COIL.ry}`} opacity={0.55} />)}
      </g>
      {half(left, leftPole)}
      {half(mid, rightPole)}
      <rect x={left} y={top} width={MAGNET.w} height={MAGNET.h} fill="none" stroke={INK} strokeWidth={2} />
      <g fill="none" stroke={COPPER} strokeWidth={3} strokeLinecap="round">
        {turns.map((x) => <path key={`f${x}`} d={`M${x} ${COIL.cy - COIL.ry} A${COIL.rx} ${COIL.ry} 0 0 1 ${x} ${COIL.cy + COIL.ry}`} />)}
      </g>
      {letter(left, leftPole)}
      {letter(mid, rightPole)}
      <g fill="none" stroke={SOFT} strokeWidth={2} strokeLinejoin="round">
        <path d={`M${COIL.x0 + COIL.dx * (COIL.turns - 1)} ${COIL.cy - COIL.ry} L206 ${COIL.cy - COIL.ry} L206 56 L236 56`} />
        <path d={`M${COIL.x0 + COIL.dx * (COIL.turns - 1)} ${COIL.cy + COIL.ry} L206 ${COIL.cy + COIL.ry} L206 88 L236 88`} />
      </g>
      {motion !== 'still' && (
        <g stroke={INK} fill={INK} strokeWidth={speed === 'faster' ? 4 : 3} strokeLinecap="round">
          <line x1={f(ax)} y1={ay} x2={f(bx + (toRight ? -6 : 6))} y2={ay} />
          <polygon stroke="none" points={toRight ? `${f(bx)},${ay} ${f(bx - 10)},${ay - 6} ${f(bx - 10)},${ay + 6}` : `${f(bx)},${ay} ${f(bx + 10)},${ay - 6} ${f(bx + 10)},${ay + 6}`} />
        </g>
      )}
      <text x={f(labelX)} y={22} textAnchor="middle" fill={INK} fontSize={12} fontWeight={700} fontFamily={FONT}>{caption}</text>
      <Meter truth={truth} mine={mine} refSteps={refSteps} draggable={draggable} onDrag={onDrag} />
    </svg>
  )
}

const sideSteps = (side: 'left' | 'right') => (side === 'left' ? -3 : 3)
const needleWords = (way: Way | '', size: Size | '') =>
  !way ? 'at zero' : way === 'none' ? 'at zero' : `deflected to the ${way}${size ? `, ${size === 'further' ? 'further than' : size === 'less' ? 'less far than' : 'as far as'} the reference` : ''}`

function InductionCard({ task, state, setState, marked, locked }: {
  task: InductionTask; state: MagnetismState; setState(next: MagnetismState): void; marked: SceneMarked; locked: boolean
}) {
  const [said, setSaid] = useState('')
  const caseSvg = useRef<SVGSVGElement>(null)
  const dragging = useRef(false)
  const way = readWay(state)
  const size = readSize(state)
  const named = marked !== 'idle'
  const ref = referenceSide(task)
  const want = outcomeOf(task)
  const verdict = inductionVerdict(task, state)
  const mine = stepsOf(way, size)
  const truth = named ? stepsOf(want.way, want.size) : null
  const shownMine = named ? (verdict.ok ? null : mine) : mine
  const speed: Speed = (task.speed ?? 'same') as Speed
  const lines = named ? inductionSaid(task, state, marked === 'wrong' ? 'wrong' : marked === 'shown' ? 'shown' : 'right') : []

  const dragToAngle = (clientX: number, clientY: number) => {
    const el = caseSvg.current
    if (!el || locked) return
    const box = el.getBoundingClientRect()
    const scale = box.width / PANEL.w
    const cx = box.left + METER.px * scale
    const cy = box.top + METER.py * scale
    const dx = clientX - cx
    const dy = cy - clientY
    if (Math.hypot(dx, dy) < 8) return
    const rawDeg = (Math.atan2(dx, dy) * 180) / Math.PI
    const rawSteps = rawDeg / STEP_DEG
    const clamped = Math.max(-4.5, Math.min(4.5, rawSteps))
    const { way: w, size: s } = fromSteps(clamped)
    setState({ way: w, size: s })
    const sName = s === 'further' ? 'further than' : s === 'less' ? 'less far than' : s === 'same' ? 'as far as' : ''
    setSaid(w === 'none' ? 'Needle at zero.' : `Needle to the ${w}${sName ? `, ${sName} the reference` : ''}.`)
  }

  const onNeedleKey = (e: KeyboardEvent) => {
    if (locked) return
    const step = { ArrowRight: 1.5, ArrowUp: 1.5, ArrowLeft: -1.5, ArrowDown: -1.5 }[e.key]
    if (step === undefined) return
    e.preventDefault()
    e.stopPropagation()
    const current = mine ?? 0
    const next = Math.max(-4.5, Math.min(4.5, current + step))
    const { way: w, size: s } = fromSteps(next)
    setState({ way: w, size: s })
    const sName = s === 'further' ? 'further than' : s === 'less' ? 'less far than' : s === 'same' ? 'as far as' : ''
    setSaid(w === 'none' ? 'Needle at zero.' : `Needle to the ${w}${sName ? `, ${sName} the reference` : ''}.`)
  }

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col items-center gap-2" onKeyDown={keepArrows}>
      <section className="flex w-full flex-col gap-1" aria-label="The reference case">
        <h3 className="text-[13px] font-extrabold text-ss-ink">Reference</h3>
        <InductionPanel
          pole="N" motion="in" speed="same" truth={sideSteps(ref)} mine={null} refSteps={null}
          label={`${REFERENCE_TEXT} The needle of the centre-zero meter is deflected to the ${ref} of zero.`}
        />
        <p className="text-[12px] font-semibold leading-snug text-ss-slate">{REFERENCE_TEXT} The needle swings to the {ref}.</p>
      </section>
      <section className="flex w-full flex-col gap-1" aria-label="The case to predict">
        <h3 className="text-[13px] font-extrabold text-ss-ink">Predict</h3>
        <div
          role="slider"
          tabIndex={locked ? -1 : 0}
          aria-label="Drag the meter needle to your prediction, or use the arrow keys"
          aria-valuemin={-4.5}
          aria-valuemax={4.5}
          aria-valuenow={mine ?? 0}
          aria-valuetext={`Needle ${named ? 'shown as it really moves' : mine === null ? 'at zero (no prediction yet)' : needleWords(way, size)}`}
          aria-readonly={locked || undefined}
          onKeyDown={onNeedleKey}
          onPointerDown={(e) => {
            if (locked) return
            dragging.current = true
            e.currentTarget.setPointerCapture?.(e.pointerId)
            dragToAngle(e.clientX, e.clientY)
          }}
          onPointerMove={(e) => dragging.current && dragToAngle(e.clientX, e.clientY)}
          onPointerUp={() => { dragging.current = false }}
          onPointerCancel={() => { dragging.current = false }}
          className={`outline-none focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] rounded-2xl ${locked ? '' : 'cursor-grab'}`}
        >
          <InductionPanel
            svgRef={caseSvg}
            pole={task.pole} motion={task.motion} speed={speed} truth={truth} mine={shownMine} refSteps={sideSteps(ref)}
            label={`${movementText(task)} The needle of the centre-zero meter is ${named ? 'shown as it really moves' : mine === null ? 'at zero' : needleWords(way, size)}.`}
            draggable={!locked}
          />
        </div>
        <p className="text-[12px] font-semibold leading-snug text-ss-slate">
          {movementText(task)} Drag the needle to your prediction. The triangle marks the reference.
        </p>
      </section>
      <p className="sr-only" aria-live="polite">{said}</p>
      <Said lines={lines} />
    </div>
  )
}

// ---------------------------------------------------------------------------

export function MagnetismView({ config, state, setState, marked, locked }: SceneViewProps<MagnetismConfig, MagnetismState>) {
  const task = config.task
  const common = { state: state && typeof state === 'object' ? state : {}, setState, marked, locked }
  if (task.kind === 'compass') return <CompassCard task={task} {...common} />
  if (task.kind === 'pole') return <PoleCard task={task} {...common} />
  return <InductionCard task={task} {...common} />
}
