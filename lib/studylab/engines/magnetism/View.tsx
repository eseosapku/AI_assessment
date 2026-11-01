'use client'
import { useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { SceneMarked, SceneViewProps } from '../types'
import type { CompassTask, End, FieldTask, InductionTask, MagnetismConfig, MagnetismState, Motion, Pole, PoleTask, Run, Site, Size, Speed, Way } from './config'
import {
  NEEDLE_STEPS, REFERENCE_TEXT, SCALE_STEPS, SIZES, SIZE_NAMES, STEP_DEGREES, THICK, VIEW, WAYS, WAY_NAMES,
  KEY_TURNS, angleFromDelta, turnedTo, bodiesOf, compassSaid, compassVerdict, endsOf, fieldLines, halfOf, hasNeutralPoint, inductionSaid, leftEndOf, movementText, outcomeOf,
  pointingWords, poleSaid, poleVerdict, readAngles, readEnds, readSize, readWay, referenceSide, sitesOf, toPx, inductionVerdict,
} from './config'

// The scene's own drawing sits on a pale plate in both themes, like a diagram in a book, so every part that carries
// meaning is over 3:1 on it. The controls around it use the design tokens.
const PLATE = '#F8FAFC'
const PLATE_EDGE = '#CBD5E1'
const INK = '#16202A'
const SOFT = '#475569'
const NORTH = '#C81E1E'
const SOUTH = '#1D4ED8'
const BARE = '#CBD5E1'
const LINE = '#3B5B7A'
const GOOD = '#047857'
const BAD = '#B0303C'
const COPPER = '#B45309'
const CASE = '#E2E8F0'
const TAIL = '#F1F5F9'
const FONT = 'system-ui, sans-serif'

const f = (v: number) => (Math.round(v * 10) / 10).toString()
const own = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k)

const BUTTON = 'nodrag inline-flex min-h-[44px] items-center justify-center rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-1.5 text-center text-[13px] font-bold leading-tight text-ss-ink touch-manipulation hover:border-[color:var(--subject)] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:opacity-50'
/** A chosen option, set inline: as classes, the base's border-ss-line won and a pick looked like no pick. */
const CHOSEN = { borderColor: 'var(--subject)', background: 'color-mix(in srgb, var(--subject) 14%, transparent)' }

/** The board moves a selected card with the arrows; inside the scene they belong to the scene. */
const keepArrows = (e: KeyboardEvent) => {
  if (e.key.startsWith('Arrow')) e.stopPropagation()
}

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
// One choice from a few, as radio buttons with one stop on Tab and the arrows to move.

/** The option an arrow key moves to: forward from nothing lands on the first, back on the last; it wraps. */
export function stepChoice(ids: readonly string[], value: string, move: number): string {
  const at = ids.indexOf(value)
  return ids[at < 0 ? (move > 0 ? 0 : ids.length - 1) : (at + move + ids.length) % ids.length]
}

function Choice<T extends string>({ legend, options, value, onPick, locked, off }: {
  legend: string; options: { id: T; label: string }[]; value: T | ''; onPick(id: T): void; locked: boolean; off?: boolean
}) {
  const id = useId()
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})
  const ids = options.map((o) => o.id)
  const pick = (to: T) => {
    if (!locked && !off) onPick(to)
  }
  const onKey = (e: KeyboardEvent) => {
    const move = ({ ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 } as Record<string, number>)[e.key]
    if (move === undefined || locked || off) return
    e.preventDefault()
    e.stopPropagation()
    const next = stepChoice(ids, value, move) as T
    pick(next)
    refs.current[next]?.focus()
  }
  return (
    <div className="flex w-full flex-col gap-1">
      <p id={`${id}-l`} className="text-[13px] font-extrabold text-ss-ink">{legend}</p>
      <div role="radiogroup" aria-labelledby={`${id}-l`} aria-disabled={off || undefined} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map((o) => {
          const chosen = value === o.id
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={chosen}
              aria-disabled={locked || off || undefined}
              ref={(el) => { refs.current[o.id] = el }}
              tabIndex={off ? -1 : chosen || (!value && o.id === ids[0]) ? 0 : -1}
              onClick={() => pick(o.id)}
              onKeyDown={onKey}
              className={`${BUTTON} ${off ? 'opacity-50' : ''}`}
              style={chosen ? CHOSEN : undefined}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// The field picture: magnets, field lines, plotting compasses.

// In pixels: 12 is NEEDLE * VIEW.scale and 16 is DIAL * VIEW.scale (the tests hold them equal). Not read from config at load, which
// imports this file: a value used before config has loaded would be undefined.
export const SIZE = { l: 12, w: 3.6, dial: 16, hit: 24 } as const

/** A compass needle drawn pointing right, turned to `angle` (anticlockwise, as the field is measured). Its north-seeking end is red and pointed. */
function Needle({ x, y, angle, ghost }: { x: number; y: number; angle: number; ghost?: boolean }) {
  const { l, w } = SIZE
  const stroke = ghost ? GOOD : INK
  return (
    <g transform={`translate(${f(x)} ${f(y)}) rotate(${-angle})`} pointerEvents="none">
      <polygon points={`${l},0 0,${-w} 0,${w}`} fill={ghost ? 'none' : NORTH} stroke={stroke} strokeWidth={ghost ? 1.8 : 1} strokeDasharray={ghost ? '3 2' : undefined} strokeLinejoin="round" />
      <polygon points={`${-l},0 0,${-w} 0,${w}`} fill={ghost ? 'none' : TAIL} stroke={stroke} strokeWidth={ghost ? 1.8 : 1} strokeDasharray={ghost ? '3 2' : undefined} strokeLinejoin="round" />
      <circle r={2} fill={stroke} />
    </g>
  )
}

/** Where a compass's number sits: up and in from its dial, towards the middle so it never leaves the picture. */
export function badgeOf(site: { x: number; y: number }): { x: number; y: number; r: number } {
  const c = toPx(site.x, site.y)
  return { x: c.x + (site.x < 0 ? 19 : -19), y: c.y - 19, r: 8.5 }
}

/** Where an end's letter sits: just under the end it names. */
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
      <circle cx={f(c.x)} cy={f(c.y)} r={SIZE.dial} fill="#FFFFFF" stroke={ring} strokeWidth={mark ? 2.4 : 1.8} strokeDasharray={mark === 'wrong' ? '4 3' : undefined} />
      {ghost !== undefined && (
        <g aria-hidden="true">
          <Needle x={c.x} y={c.y} angle={ghost} ghost />
          <polygon points="10,0 0,-5.5 0,5.5" fill={GOOD} stroke="#FFFFFF" strokeWidth={1.2} strokeLinejoin="round" transform={`translate(${f(c.x)} ${f(c.y)}) rotate(${-ghost}) translate(${SIZE.dial + 2} 0)`} />
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

/** A static compass on a pole card: it shows which way the field points and cannot be turned. */
function FixedCompass({ site }: { site: Site }) {
  const c = toPx(site.x, site.y)
  return (
    <g>
      <circle cx={f(c.x)} cy={f(c.y)} r={SIZE.dial} fill="#FFFFFF" stroke={INK} strokeWidth={1.8} />
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

/** The poles of a compass card's magnets, left to right, as they are labelled on the picture. */
const polesWords = (ends: End[]) => ends.map((e) => (e.sign === 'N' ? 'north' : 'south')).join(', ')

// ---------------------------------------------------------------------------
// Compass cards.

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
    const step = own(KEY_TURNS, e.key) ? KEY_TURNS[e.key] : undefined
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
          className={`block w-full select-none ${live ? 'touch-none' : ''}`}
          role="group"
          aria-label={`${ARRANGEMENT_ALT[task.arrangement]}, with its poles labelled N and S. From left to right the poles are ${polesWords(ends)}. ${sites.length} plotting compasses stand near ${task.arrangement === 'single' ? 'it' : 'them'}, numbered 1 to ${sites.length}.`}
        >
          <rect width={VIEW.w} height={VIEW.h} rx={16} fill={PLATE} stroke={PLATE_EDGE} strokeWidth={1.5} />
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
// Pole cards.

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

  const name = (i: number, to: Pole) => {
    const next = given.slice()
    next[i] = to
    setState({ ends: next })
    setSaid(`End ${ends[i].letter} named a ${to === 'N' ? 'north' : 'south'} pole.`)
  }
  const said_ = named ? poleSaid(task, state, marked === 'wrong' ? 'wrong' : marked === 'shown' ? 'shown' : 'right') : []

  // What the lines do at each end, as seen: they run out of it or into it. Not which pole that makes it.
  const flow = ends.map((e) => `At end ${e.letter} the lines run ${e.sign === 'N' ? 'out of' : 'into'} the magnet.`).join(' ')

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col items-center gap-2" onKeyDown={keepArrows}>
      <figure className="m-0 w-full" style={{ maxWidth: VIEW.w }}>
        <svg
          viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
          className="block w-full select-none"
          role="img"
          aria-label={`${ARRANGEMENT_ALT[task.arrangement]}, with field lines drawn round ${task.arrangement === 'single' ? 'it' : 'them'}, each with an arrow on it, and ${sites.length} compasses. The ends are lettered ${ends.map((e) => e.letter).join(', ')} from left to right. ${flow}`}
        >
          <rect width={VIEW.w} height={VIEW.h} rx={16} fill={PLATE} stroke={PLATE_EDGE} strokeWidth={1.5} />
          <defs><clipPath id={clip}><rect width={VIEW.w} height={VIEW.h} rx={16} /></clipPath></defs>
          <Lines lines={lines} clip={clip} />
          <Magnets task={task} ends={ends} named={shownAs} />
          {named && hasNeutralPoint(task.arrangement) && <NeutralMark />}
          {sites.map((s) => <FixedCompass key={s.id} site={s} />)}
          {ends.map((e) => {
            const m = markerOf(e)
            const bad = named && verdict.wrong.includes(e.id)
            return (
              <g key={e.id} aria-hidden="true">
                <circle cx={f(m.x)} cy={f(m.y)} r={m.r} fill={INK} stroke={bad ? BAD : '#FFFFFF'} strokeWidth={bad ? 2.5 : 1.5} />
                <text x={f(m.x)} y={f(m.y + 4.5)} textAnchor="middle" fill="#FFFFFF" fontSize={12} fontWeight={700} fontFamily={FONT}>{e.letter}</text>
              </g>
            )
          })}
        </svg>
        <figcaption className="mt-1 text-center text-[12px] font-semibold text-ss-slate">
          {ARRANGEMENT_ALT[task.arrangement]}. An arrow on a field line shows which way the field points.
          {named && hasNeutralPoint(task.arrangement) ? ' × marks the neutral point.' : ''}
        </figcaption>
      </figure>
      <div className={`grid w-full gap-x-3 gap-y-2 ${ends.length > 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {ends.map((e) => (
          <Choice<Pole>
            key={e.id}
            legend={`End ${e.letter}`}
            options={[{ id: 'N', label: 'North pole' }, { id: 'S', label: 'South pole' }]}
            value={given[e.id]}
            onPick={(to) => name(e.id, to)}
            locked={locked}
          />
        ))}
      </div>
      <p className="sr-only" aria-live="polite">{said}</p>
      <Said lines={said_} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Induction cards: a magnet, a coil and a centre-zero meter, twice -- the reference, then the case.

export const PANEL = { w: 360, h: 150 } as const
export const METER = { px: 292, py: 100, needle: 46, arc: 56, window: { x: 244, y: 20, w: 96, h: 88 } } as const
const COIL = { x0: 118, dx: 11, turns: 6, rx: 6.5, ry: 30, cy: 82 } as const
const MAGNET = { w: 88, h: 24, cy: 82 } as const
const ARROW_LEN: Record<Speed, number> = { slower: 34, same: 56, faster: 80 }

/** The steps a needle is drawn at: left is negative, right positive. */
export function stepsOf(way: Way | '', size: Size | '' | null): number | null {
  if (!way) return null
  if (way === 'none') return 0
  const s = NEEDLE_STEPS[size || 'same']
  return way === 'left' ? -s : s
}

const tip = (steps: number, len: number) => {
  const a = (steps * STEP_DEGREES * Math.PI) / 180
  return { x: METER.px + len * Math.sin(a), y: METER.py - len * Math.cos(a) }
}

function Meter({ truth, mine, refSteps }: { truth: number | null; mine: number | null; refSteps: number | null }) {
  const shown = truth ?? mine ?? 0
  const t = tip(shown, METER.needle)
  const me = mine !== null && truth !== null && mine !== truth ? tip(mine, METER.needle) : null
  const w = METER.window
  const ticks = []
  for (let k = -SCALE_STEPS; k <= SCALE_STEPS; k++) {
    const len = k === 0 || Math.abs(k) === SCALE_STEPS ? 10 : 6
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
  return (
    <g>
      <rect x={236} y={12} width={112} height={128} rx={10} fill={CASE} stroke={INK} strokeWidth={2} />
      <rect x={w.x} y={w.y} width={w.w} height={w.h} rx={6} fill="#FFFFFF" stroke="#94A3B8" strokeWidth={1.2} />
      {ticks}
      <text x={METER.px} y={METER.py - METER.arc - 8} textAnchor="middle" fill={INK} fontSize={12} fontWeight={700} fontFamily={FONT}>0</text>
      {marker && <polygon points={marker} fill={COPPER} stroke="#FFFFFF" strokeWidth={0.8} />}
      {me && <line x1={METER.px} y1={METER.py} x2={f(me.x)} y2={f(me.y)} stroke={SOUTH} strokeWidth={2.6} strokeDasharray="4 3" strokeLinecap="round" />}
      <line x1={METER.px} y1={METER.py} x2={f(t.x)} y2={f(t.y)} stroke={truth === null && mine !== null ? SOUTH : INK} strokeWidth={3} strokeLinecap="round" />
      {mine !== null && truth === null && <circle cx={METER.px} cy={METER.py} r={9} fill="none" stroke={SOUTH} strokeWidth={2.4} />}
      <circle cx={METER.px} cy={METER.py} r={5} fill={truth === null && mine !== null ? SOUTH : INK} />
    </g>
  )
}

function Panel({ pole, motion, speed, truth, mine, refSteps, label }: {
  pole: Pole; motion: Motion; speed: Speed; truth: number | null; mine: number | null; refSteps: number | null; label: string
}) {
  const inside = motion !== 'in'
  const rightEnd = inside ? 150 : 96
  const left = rightEnd - MAGNET.w
  const mid = left + MAGNET.w / 2
  const top = MAGNET.cy - MAGNET.h / 2
  const rightPole: Pole = pole
  const leftPole: Pole = pole === 'N' ? 'S' : 'N'
  const half = (x: number, p: Pole) => <rect x={x} y={top} width={MAGNET.w / 2} height={MAGNET.h} fill={TINTS[p].fill} />
  // The letters sit over the coil's near turns, ringed in their own colour so the copper never cuts across them.
  const letter = (x: number, p: Pole) => (
    <text x={x + MAGNET.w / 4} y={MAGNET.cy + 5} textAnchor="middle" fill="#FFFFFF" stroke={TINTS[p].fill} strokeWidth={4} paintOrder="stroke" fontSize={14} fontWeight={800} fontFamily={FONT}>{p}</text>
  )
  const arrowLen = ARROW_LEN[speed]
  const toRight = motion === 'in'
  const ay = 40
  const ax = (motion === 'in' ? 52 : 106) + (toRight ? -arrowLen / 2 : arrowLen / 2)
  const bx = ax + (toRight ? arrowLen : -arrowLen)
  const verb = motion === 'in' ? 'pushed in' : motion === 'out' ? 'pulled out' : 'held still'
  const caption = motion === 'still' ? verb : speed === 'faster' ? `${verb}, faster` : speed === 'slower' ? `${verb}, slower` : verb
  const labelX = motion === 'still' ? mid : (ax + bx) / 2
  const turns = Array.from({ length: COIL.turns }, (_, k) => COIL.x0 + COIL.dx * k)
  return (
    <svg viewBox={`0 0 ${PANEL.w} ${PANEL.h}`} className="block w-full select-none" role="img" aria-label={label}>
      <rect width={PANEL.w} height={PANEL.h} rx={14} fill={PLATE} stroke={PLATE_EDGE} strokeWidth={1.5} />
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
        <path d={`M${COIL.x0 + COIL.dx * (COIL.turns - 1)} ${COIL.cy - COIL.ry} L206 ${COIL.cy - COIL.ry} L206 66 L236 66`} />
        <path d={`M${COIL.x0 + COIL.dx * (COIL.turns - 1)} ${COIL.cy + COIL.ry} L206 ${COIL.cy + COIL.ry} L206 98 L236 98`} />
      </g>
      {motion !== 'still' && (
        <g stroke={INK} fill={INK} strokeWidth={speed === 'faster' ? 4 : 3} strokeLinecap="round">
          <line x1={f(ax)} y1={ay} x2={f(bx + (toRight ? -6 : 6))} y2={ay} />
          <polygon stroke="none" points={toRight ? `${f(bx)},${ay} ${f(bx - 10)},${ay - 6} ${f(bx - 10)},${ay + 6}` : `${f(bx)},${ay} ${f(bx + 10)},${ay - 6} ${f(bx + 10)},${ay + 6}`} />
        </g>
      )}
      <text x={f(labelX)} y={26} textAnchor="middle" fill={INK} fontSize={12} fontWeight={700} fontFamily={FONT}>{caption}</text>
      <Meter truth={truth} mine={mine} refSteps={refSteps} />
    </svg>
  )
}

const sideSteps = (side: 'left' | 'right') => (side === 'left' ? -NEEDLE_STEPS.same : NEEDLE_STEPS.same)
const needleWords = (way: Way | '', size: Size | '') =>
  !way ? 'at zero' : way === 'none' ? 'at zero' : `deflected to the ${way}${size ? `, ${size === 'further' ? 'further than' : size === 'less' ? 'less far than' : 'as far as'} the reference` : ''}`

function InductionCard({ task, state, setState, marked, locked }: {
  task: InductionTask; state: MagnetismState; setState(next: MagnetismState): void; marked: SceneMarked; locked: boolean
}) {
  const [said, setSaid] = useState('')
  const way = readWay(state)
  const size = readSize(state)
  const named = marked !== 'idle'
  const ref = referenceSide(task)
  const want = outcomeOf(task)
  const verdict = inductionVerdict(task, state)
  const mine = stepsOf(way, size)
  const truth = named ? stepsOf(want.way, want.size) : null
  const shownMine = named ? (verdict.ok ? null : mine) : mine
  const speed: Speed = task.speed ?? 'same'
  const lines = named ? inductionSaid(task, state, marked === 'wrong' ? 'wrong' : marked === 'shown' ? 'shown' : 'right') : []

  const pickWay = (to: Way) => {
    setState(to === 'none' ? { way: to, size: '' } : { way: to, size })
    setSaid(`${WAY_NAMES[to]} chosen for the way the needle swings.`)
  }
  const pickSize = (to: Size) => {
    setState({ way, size: to })
    setSaid(`${SIZE_NAMES[to]} chosen for how far the needle swings.`)
  }

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col items-center gap-2.5" onKeyDown={keepArrows}>
      <section className="flex w-full flex-col gap-1" aria-label="The reference case">
        <h3 className="text-[13px] font-extrabold text-ss-ink">The reference case</h3>
        <Panel
          pole="N" motion="in" speed="same" truth={sideSteps(ref)} mine={null} refSteps={null}
          label={`${REFERENCE_TEXT} The needle of the centre-zero meter is deflected to the ${ref} of zero.`}
        />
        <p className="text-[12px] font-semibold leading-snug text-ss-slate">{REFERENCE_TEXT} The needle swings to the {ref}.</p>
      </section>
      <section className="flex w-full flex-col gap-1" aria-label="The case to predict">
        <h3 className="text-[13px] font-extrabold text-ss-ink">The case to predict</h3>
        <Panel
          pole={task.pole} motion={task.motion} speed={speed} truth={truth} mine={shownMine} refSteps={sideSteps(ref)}
          label={`${movementText(task)} The needle of the centre-zero meter is ${named ? 'shown as it really moves' : mine === null ? 'at zero' : needleWords(way, size)}.`}
        />
        <p className="text-[12px] font-semibold leading-snug text-ss-slate">
          {movementText(task)} The small triangle on the meter marks how far the needle swung in the reference.
        </p>
      </section>
      <Choice<Way>
        legend="Which way does the needle swing?"
        options={WAYS.map((w) => ({ id: w, label: WAY_NAMES[w] }))}
        value={way}
        onPick={pickWay}
        locked={locked}
      />
      <Choice<Size>
        legend={way === 'none' ? 'How far, compared with the reference? (none needed)' : 'How far, compared with the reference?'}
        options={SIZES.map((s) => ({ id: s, label: SIZE_NAMES[s] }))}
        value={size}
        onPick={pickSize}
        locked={locked}
        off={way === 'none'}
      />
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

