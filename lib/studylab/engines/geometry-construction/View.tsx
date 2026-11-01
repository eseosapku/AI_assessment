'use client'
import { useId, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode, type Ref, type SVGProps } from 'react'
import type { SceneMarked, SceneViewProps } from '../types'
import type { AngleFactsTask, Box, DragTask, Fig, GeometryConfig, GeometryState, Mark, PolygonTask, ReasonId } from './config'
import {
  DRAG, MIN_MOVES, MIN_SIDES, MAX_SIDES, PAIR_LABELS, PLATE_H, PLATE_W, RULES, REASON_ORDER, REASON_TEXT, TRI, TRI_SHAPES,
  arcPath, dragFigure, dragFigureText, dragSaid, dragVerdict, factsSaid, factsVerdict, figureText, figureWithTyped, handleOf,
  placeLabels, polyFig, polygonSaid, polygonText, polygonVerdict, readAB, readLines, readMoves, readReasons, readText, readTheta, readValue,
  regions, regularPoints, solveTask, thetaFromPoint, triApex, triSnap, triStep,
} from './config'

// The scene's own drawing sits on a pale plate in both themes, like a figure in a book, so every part that carries
// meaning is over 3:1 on it. The controls around it use the design tokens.
const PLATE = '#F8FAFC'
const PLATE_EDGE = '#CBD5E1'
const INK = '#16202A'
const SOFT = '#475569'
const GIVEN = '#1D4ED8'
const UNKNOWN = '#C2410C'
const GOOD = '#047857'
const BAD = '#B0303C'
const HANDLE = '#C2410C'
const BLUE_FILL = '#DBEAFE'
const ORANGE_FILL = '#FFEDD5'
const GREY_FILL = '#E2E8F0'
const FONT = 'system-ui, sans-serif'

const f = (v: number) => (Math.round(v * 100) / 100).toString()

const BUTTON = 'nodrag inline-flex min-h-[44px] items-center rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-1.5 text-[14px] font-bold leading-snug text-ss-ink touch-manipulation hover:border-[color:var(--subject)] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:opacity-50'
/** Where a button's words sit is set once, here, not by two classes that disagree: CSS order, not class order, would decide. */
const CENTRED = 'justify-center text-center'
const LEFT = 'justify-start text-left'
/** A chosen option, set inline: as classes, the base's border-ss-line won and a pick looked like no pick. */
const CHOSEN = { borderColor: 'var(--subject)', background: 'color-mix(in srgb, var(--subject) 14%, transparent)' }
const RIGHT_STYLE = { borderColor: GOOD, background: 'color-mix(in srgb, #047857 14%, transparent)' }
const WRONG_STYLE = { borderColor: BAD, background: 'color-mix(in srgb, #B0303C 12%, transparent)' }
const MISSED_STYLE = { borderColor: GOOD, borderStyle: 'dashed' as const }

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

function Unshown(): ReactNode {
  return <p className="text-[13px] font-semibold text-ss-slate">This figure could not be drawn.</p>
}

// ---------------------------------------------------------------------------
// The drawing.

type ArcColour = (m: Mark, i: number) => string

function Drawing({ fig, boxes, arc }: { fig: Fig; boxes: (Box | null)[]; arc: ArcColour }) {
  return (
    <>
      {fig.fill.length > 0 && <polygon points={fig.fill.map((p) => `${f(p.x)},${f(p.y)}`).join(' ')} fill="#FFFFFF" />}
      <g stroke={INK} strokeWidth={2.4} strokeLinecap="round">
        {fig.segs.map((s, i) => <line key={i} x1={f(s.a.x)} y1={f(s.a.y)} x2={f(s.b.x)} y2={f(s.b.y)} />)}
      </g>
      <g stroke={INK} strokeWidth={2.2} strokeLinecap="round">
        {fig.ticks.map((s, i) => <line key={i} x1={f(s.a.x)} y1={f(s.a.y)} x2={f(s.b.x)} y2={f(s.b.y)} />)}
        {fig.chevrons.map((s, i) => <line key={`c${i}`} x1={f(s.a.x)} y1={f(s.a.y)} x2={f(s.b.x)} y2={f(s.b.y)} />)}
      </g>
      <g fill={INK}>{fig.dots.map((p, i) => <circle key={i} cx={f(p.x)} cy={f(p.y)} r={3} />)}</g>
      <g fill="none" strokeWidth={2.4} strokeLinecap="round">
        {fig.marks.map((m, i) => <path key={i} d={arcPath(m)} stroke={arc(m, i)} />)}
      </g>
      <g fontSize={13} fontWeight={800} fontFamily={FONT} textAnchor="middle" paintOrder="stroke" stroke={PLATE} strokeWidth={4}>
        {fig.marks.map((m, i) => {
          const b = boxes[i]
          if (!b) return null
          return <text key={i} x={f(b.x + b.w / 2)} y={f(b.y + b.h / 2 + 4.5)} fill={m.role === 'unknown' ? '#9A3412' : INK}>{m.text}</text>
        })}
      </g>
    </>
  )
}

type PlateHandlers = Pick<SVGProps<SVGSVGElement>, 'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel'>

/** A picture with nothing to hold is an image; one with a corner or a line to hold is a group, or the controls inside it would be hidden from a screen reader. */
function Plate({ children, label, live, svgRef, handlers, group }: {
  children: ReactNode; label: string; live?: boolean; svgRef?: Ref<SVGSVGElement>; handlers?: PlateHandlers; group?: boolean
}) {
  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${PLATE_W} ${PLATE_H}`}
      className={`block w-full select-none ${live ? 'touch-none' : ''}`}
      style={{ maxWidth: PLATE_W }}
      role={group ? 'group' : 'img'}
      aria-label={label}
      {...handlers}
    >
      <rect width={PLATE_W} height={PLATE_H} rx={14} fill={PLATE} stroke={PLATE_EDGE} strokeWidth={1.5} />
      {children}
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Controls.

function NumberField({ label, value, onChange, locked, tone, digits }: {
  label: string; value: string; onChange(v: string): void; locked: boolean; tone: 'right' | 'wrong' | null; digits: number
}) {
  const id = useId()
  return (
    <div className="flex items-center justify-center gap-2">
      <label htmlFor={id} className="text-[15px] font-extrabold text-ss-ink">{label}</label>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        maxLength={digits}
        value={value}
        readOnly={locked}
        aria-readonly={locked || undefined}
        onChange={(e) => { if (!locked) onChange(e.target.value.replace(/\D/g, '').slice(0, digits)) }}
        onKeyDown={keepArrows}
        className="nodrag h-11 w-[84px] rounded-xl border-2 border-ss-line bg-ss-panel px-2 text-center text-[16px] font-extrabold text-ss-ink focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)]"
        style={tone === 'right' ? { borderColor: GOOD } : tone === 'wrong' ? { borderColor: BAD } : undefined}
      />
      <span className="text-[15px] font-extrabold text-ss-ink" aria-hidden="true">°</span>
    </div>
  )
}

/** The fixed list of facts to tick: every card shows all nine, in the same order. */
function Facts({ ticked, needed, onToggle, locked, marked }: {
  ticked: ReasonId[]; needed: ReasonId[]; onToggle(id: ReasonId): void; locked: boolean; marked: SceneMarked
}) {
  const id = useId()
  const named = marked !== 'idle'
  return (
    <div className="flex w-full flex-col gap-1.5">
      <p id={`${id}-l`} className="text-[14px] font-extrabold leading-snug text-ss-ink">Which fact did you use? Tick every fact you need.</p>
      <div role="group" aria-labelledby={`${id}-l`} className="flex flex-col gap-2">
        {REASON_ORDER.map((r) => {
          const on = ticked.includes(r)
          const fit = needed.includes(r)
          const style = !named ? (on ? CHOSEN : undefined) : on ? (fit ? RIGHT_STYLE : WRONG_STYLE) : fit && marked === 'wrong' ? MISSED_STYLE : undefined
          return (
            <button
              key={r}
              type="button"
              role="checkbox"
              aria-checked={on}
              aria-disabled={locked || undefined}
              onClick={() => { if (!locked) onToggle(r) }}
              onKeyDown={keepArrows}
              className={`${BUTTON} ${LEFT}`}
              style={style}
            >
              {REASON_TEXT[r]}
              {named && on && <span className="sr-only">{fit ? ' (fits)' : ' (does not fit)'}</span>}
              {named && !on && fit && marked === 'wrong' && <span className="sr-only"> (was needed)</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

type Option<T extends string> = { id: T; text: string }

/** One choice from a few: a radio group with a single stop on Tab and the arrows to move. */
function Pick<T extends string>({ label, options, value, onPick, locked, marked, right }: {
  label: string; options: Option<T>[]; value: string; onPick(id: T): void; locked: boolean; marked: SceneMarked; right: T | null
}) {
  const id = useId()
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})
  const onKey = (e: KeyboardEvent) => {
    const step = ({ ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 } as Record<string, number>)[e.key]
    if (step === undefined || locked) return
    e.preventDefault()
    e.stopPropagation()
    const at = options.findIndex((o) => o.id === value)
    const next = options[((at < 0 ? (step > 0 ? -1 : 0) : at) + step + options.length) % options.length]
    onPick(next.id)
    refs.current[next.id]?.focus()
  }
  const named = marked !== 'idle'
  return (
    <div className="flex w-full flex-col gap-1.5">
      <p id={`${id}-l`} className="text-[14px] font-extrabold leading-snug text-ss-ink">{label}</p>
      <div role="radiogroup" aria-labelledby={`${id}-l`} className="flex flex-col gap-2">
        {options.map((o, i) => {
          const chosen = value === o.id
          const style = !named ? (chosen ? CHOSEN : undefined) : chosen ? (o.id === right ? RIGHT_STYLE : WRONG_STYLE) : o.id === right && marked === 'wrong' ? MISSED_STYLE : undefined
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={chosen}
              aria-disabled={locked || undefined}
              tabIndex={chosen || (!value && i === 0) ? 0 : -1}
              ref={(el) => { refs.current[o.id] = el }}
              onClick={() => { if (!locked) onPick(o.id) }}
              onKeyDown={onKey}
              className={`${BUTTON} ${LEFT}`}
              style={style}
            >
              {o.text}
            </button>
          )
        })}
      </div>
    </div>
  )
}

const asState = (state: unknown): GeometryState => (state && typeof state === 'object' ? (state as GeometryState) : {})

type Common = { state: GeometryState; setState(next: GeometryState): void; marked: SceneMarked; locked: boolean }

// ---------------------------------------------------------------------------
// angle-facts: work out x, and say why.

function FactsCard({ task, state, setState, marked, locked }: Common & { task: AngleFactsTask }) {
  const solved = solveTask(task)
  if (Array.isArray(solved)) return <Unshown />
  // What the learner has typed is drawn on the figure, in x's own styling: "x = 55°" in place of the letter.
  const { fig, boxes } = figureWithTyped(task, solved, readValue(state))
  const named = marked !== 'idle'
  const verdict = factsVerdict(task, state)
  const ticked = readReasons(state)
  const lines = named ? factsSaid(task, state, marked === 'wrong' ? 'wrong' : 'right') : []
  const toggle = (r: ReasonId) => setState({ ...state, reasons: ticked.includes(r) ? ticked.filter((x) => x !== r) : [...ticked, r] })
  const arcOf: ArcColour = (m) => (m.role !== 'unknown' ? GIVEN : !named ? UNKNOWN : verdict.angle ? GOOD : BAD)
  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col items-center gap-2.5" onKeyDown={keepArrows}>
      <figure className="m-0 w-full" style={{ maxWidth: PLATE_W }}>
        <Plate label={figureText(task, solved)}>
          <Drawing fig={fig} boxes={boxes} arc={arcOf} />
        </Plate>
        <figcaption className="mt-1 text-center text-[12px] font-semibold text-ss-slate">
          Drawn to scale. An arc marks each angle named; x is the angle to find.
        </figcaption>
      </figure>
      <NumberField
        label="x ="
        digits={3}
        value={readValue(state).slice(0, 3)}
        onChange={(v) => setState({ ...state, value: v })}
        locked={locked}
        tone={!named ? null : verdict.angle ? 'right' : marked === 'wrong' ? 'wrong' : null}
      />
      <Facts ticked={ticked} needed={named ? solved.reasons : []} onToggle={toggle} locked={locked} marked={marked} />
      <Said lines={lines} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// drag-invariant.

const svgPoint = (svg: SVGSVGElement | null, e: PointerEvent) => {
  const box = svg?.getBoundingClientRect()
  if (!box || !box.width) return { x: 0, y: 0 }
  return { x: ((e.clientX - box.left) / box.width) * PLATE_W, y: ((e.clientY - box.top) / box.height) * PLATE_H }
}

function Handle({ x, y, focused }: { x: number; y: number; focused: boolean }) {
  return (
    <g pointerEvents="none">
      {focused && <circle cx={f(x)} cy={f(y)} r={19} fill="none" stroke="var(--subject)" strokeWidth={3} />}
      <circle cx={f(x)} cy={f(y)} r={12} fill={HANDLE} stroke="#FFFFFF" strokeWidth={2.4} />
      <circle cx={f(x)} cy={f(y)} r={3.5} fill="#FFFFFF" />
    </g>
  )
}

function TriangleDrag({ task, state, setState, marked, locked }: Common & { task: DragTask }) {
  const svg = useRef<SVGSVGElement>(null)
  const grab = useRef(false)
  const [focused, setFocused] = useState(false)
  const [said, setSaid] = useState('')
  const ab = readAB(state)
  const moves = readMoves(state)
  const live = !locked
  const apex = triApex(ab[0], ab[1])
  const c = 180 - ab[0] - ab[1]
  const fig = polyFig(
    [{ x: TRI.ax, y: TRI.y }, { x: TRI.bx, y: TRI.y }, apex],
    [ab[0], ab[1], c].map((size) => ({ size, role: 'given' as const, text: `${size}°` })),
  )
  const boxes = placeLabels(fig, [{ x: apex.x - 17, y: apex.y - 17, w: 34, h: 34 }])
  const apply = (next: [number, number]) => {
    if (next[0] === ab[0] && next[1] === ab[1]) return
    setState({ ...state, ab: next, moves: Math.min(9, moves + 1) })
    setSaid(`The angles are now ${next[0]}, ${next[1]} and ${180 - next[0] - next[1]} degrees.`)
  }
  const onKey = (e: KeyboardEvent) => {
    if (!live || !e.key.startsWith('Arrow')) return
    e.preventDefault()
    e.stopPropagation()
    apply(triStep(ab, e.key, e.shiftKey))
  }
  const at = (e: PointerEvent) => {
    const p = svgPoint(svg.current, e)
    apply(triSnap(p.x, p.y))
  }
  const named = marked !== 'idle'
  const verdict = dragVerdict(task, state)
  const lines = named ? dragSaid(task, state, marked === 'wrong' ? 'wrong' : 'right') : []
  const shapes = TRI_SHAPES.findIndex((s) => s[0] === ab[0] && s[1] === ab[1])
  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col items-center gap-2.5" onKeyDown={keepArrows}>
      <figure className="m-0 w-full" style={{ maxWidth: PLATE_W }}>
        <Plate
          group
          label={dragFigureText(task, ab, 0)}
          live={live}
          svgRef={svg}
          handlers={{
            onPointerDown: (e: PointerEvent) => {
              if (!live) return
              grab.current = true
              e.currentTarget.setPointerCapture?.(e.pointerId)
              at(e)
            },
            onPointerMove: (e: PointerEvent) => { if (grab.current) at(e) },
            onPointerUp: () => { grab.current = false },
            onPointerCancel: () => { grab.current = false },
          }}
        >
          <Drawing fig={fig} boxes={boxes} arc={() => GIVEN} />
          <g
            role="slider"
            tabIndex={live ? 0 : -1}
            aria-label="Top corner of the triangle. Drag it, or use the arrow keys to move it."
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round((100 * (apex.x - TRI.left)) / (TRI.right - TRI.left))}
            aria-valuetext={`The angles are ${ab[0]}, ${ab[1]} and ${c} degrees`}
            aria-readonly={!live || undefined}
            onKeyDown={onKey}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            className="outline-none focus-visible:outline-none"
            style={{ cursor: live ? 'grab' : 'default' }}
          >
            <circle cx={f(apex.x)} cy={f(apex.y)} r={24} fill="transparent" />
            <Handle x={apex.x} y={apex.y} focused={focused && live} />
          </g>
        </Plate>
        <figcaption className="mt-1 text-center text-[12px] font-semibold text-ss-slate">
          Drag the orange corner. The three angles are shown in degrees.{live ? ` Shapes made: ${moves}. Make at least ${MIN_MOVES} different shapes.` : ''}
        </figcaption>
      </figure>
      {live && (
        <button
          type="button"
          className={`${BUTTON} ${CENTRED}`}
          onClick={() => apply(TRI_SHAPES[(shapes + 1) % TRI_SHAPES.length] ?? TRI_SHAPES[0])}
        >
          Try another shape
        </button>
      )}
      <NumberField
        label="The three angles always add up to"
        digits={3}
        value={readValue(state).slice(0, 3)}
        onChange={(v) => setState({ ...state, value: v })}
        locked={locked}
        tone={!named ? null : verdict.wrongIds.includes('answer') ? (marked === 'wrong' ? 'wrong' : null) : 'right'}
      />
      <p className="sr-only" aria-live="polite">{said}</p>
      <Said lines={lines} />
    </div>
  )
}

function ParallelDrag({ task, state, setState, marked, locked }: Common & { task: DragTask }) {
  const svg = useRef<SVGSVGElement>(null)
  const grab = useRef(false)
  const [focused, setFocused] = useState(false)
  const [said, setSaid] = useState('')
  const pair = task.pair ?? 'alternate'
  const theta = readTheta(state)
  const moves = readMoves(state)
  const live = !locked
  const fig = dragFigure(theta, pair)
  const h = handleOf(theta)
  const boxes = placeLabels(fig, [{ x: h.x - 17, y: h.y - 17, w: 34, h: 34 }])
  const set = (next: number) => {
    const to = Math.max(DRAG.min, Math.min(DRAG.max, next))
    if (to === theta) return
    setState({ ...state, theta: to, moves: Math.min(9, moves + 1) })
    setSaid(`The line now leans ${to < 90 ? 'right' : to > 90 ? 'left' : 'not at all'}.`)
  }
  const lean = 90 - theta
  const onKey = (e: KeyboardEvent) => {
    if (!live) return
    const k = e.shiftKey || e.key === 'PageUp' || e.key === 'PageDown' ? 5 : 1
    const by = ({ ArrowRight: -k, ArrowUp: -k, PageUp: -k, ArrowLeft: k, ArrowDown: k, PageDown: k } as Record<string, number>)[e.key]
    if (by === undefined) return
    e.preventDefault()
    e.stopPropagation()
    set(theta + by)
  }
  const at = (e: PointerEvent) => {
    const p = svgPoint(svg.current, e)
    set(thetaFromPoint(p.x, p.y))
  }
  const named = marked !== 'idle'
  const verdict = dragVerdict(task, state)
  const lines = named ? dragSaid(task, state, marked === 'wrong' ? 'wrong' : 'right') : []
  const rule = readText(state, 'rule')
  const name = readText(state, 'name')
  const ruleRight = pair === 'co-interior' ? 'supplementary' : 'equal'
  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col items-center gap-2.5" onKeyDown={keepArrows}>
      <figure className="m-0 w-full" style={{ maxWidth: PLATE_W }}>
        <Plate
          group
          label={dragFigureText(task, [0, 0], theta)}
          live={live}
          svgRef={svg}
          handlers={{
            onPointerDown: (e: PointerEvent) => {
              if (!live) return
              grab.current = true
              e.currentTarget.setPointerCapture?.(e.pointerId)
              at(e)
            },
            onPointerMove: (e: PointerEvent) => { if (grab.current) at(e) },
            onPointerUp: () => { grab.current = false },
            onPointerCancel: () => { grab.current = false },
          }}
        >
          <Drawing fig={fig} boxes={boxes} arc={() => GIVEN} />
          <g
            role="slider"
            tabIndex={live ? 0 : -1}
            aria-label="The line across the parallel lines. Drag its top end, or use the arrow keys to tilt it."
            aria-valuemin={-(90 - DRAG.min)}
            aria-valuemax={90 - DRAG.min}
            aria-valuenow={lean}
            aria-valuetext={lean === 0 ? 'Upright' : `Leaning ${lean > 0 ? 'right' : 'left'}, ${Math.abs(lean)} degrees from upright`}
            aria-readonly={!live || undefined}
            onKeyDown={onKey}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            className="outline-none focus-visible:outline-none"
            style={{ cursor: live ? 'grab' : 'default' }}
          >
            <circle cx={f(h.x)} cy={f(h.y)} r={24} fill="transparent" />
            <Handle x={h.x} y={h.y} focused={focused && live} />
          </g>
        </Plate>
        <figcaption className="mt-1 text-center text-[12px] font-semibold text-ss-slate">
          Drag the orange end to tilt the line. The two marked angles are shown in degrees.{live ? ` Tilts made: ${moves}. Make at least ${MIN_MOVES} different tilts.` : ''}
        </figcaption>
      </figure>
      <Pick
        label="What stays true about the two marked angles?"
        options={RULES.map((r) => ({ id: r.id, text: r.text }))}
        value={rule}
        onPick={(id) => setState({ ...state, rule: id })}
        locked={locked}
        marked={marked}
        right={ruleRight}
      />
      <Pick
        label="What are the two marked angles called?"
        options={PAIR_LABELS.map((p) => ({ id: p.id, text: p.text }))}
        value={name}
        onPick={(id) => setState({ ...state, name: id })}
        locked={locked}
        marked={marked}
        right={pair}
      />
      <p className="sr-only" aria-live="polite">{said}</p>
      <Said lines={named ? lines : []} />
      {named && !verdict.ok && marked === 'wrong' && verdict.wrongIds.includes('drag') && <span className="sr-only">Tilt the line more.</span>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// polygon-sum.

function PolygonCard({ task, state, setState, marked, locked }: Common & { task: PolygonTask }) {
  const [said, setSaid] = useState('')
  const n = task.sides
  const pts = regularPoints(n)
  const lined = readLines(state, n)
  const regs = regions(n, lined)
  const live = !locked
  const named = marked !== 'idle'
  const ok = polygonVerdict(task, state).ok
  const lines = named ? polygonSaid(task, state, marked === 'wrong' ? 'wrong' : 'right') : []
  const write = (next: number[]) => setState({ ...state, lines: [...next].sort((a, b) => a - b) })
  const toggle = (k: number) => {
    if (!live) return
    const on = lined.includes(k)
    write(on ? lined.filter((x) => x !== k) : [...lined, k])
    setSaid(on ? `Took away the line to corner ${k + 1}.` : `Drew a line from corner 1 to corner ${k + 1}.`)
  }
  const points = (cs: number[]) => cs.map((i) => `${f(pts[i].x)},${f(pts[i].y)}`).join(' ')
  const corners = Array.from({ length: Math.max(0, n - 3) }, (_, i) => i + 2)
  let tri = 0
  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col items-center gap-2.5" onKeyDown={keepArrows}>
      <figure className="m-0 w-full" style={{ maxWidth: PLATE_W }}>
        <Plate group label={polygonText(task)}>
          {lined.length > 0 && regs.map((r, i) => {
            const fill = r.triangle ? (tri++ % 2 === 0 ? BLUE_FILL : ORANGE_FILL) : GREY_FILL
            return <polygon key={i} points={points(r.corners)} fill={fill} />
          })}
          {lined.length === 0 && <polygon points={points(pts.map((_, i) => i))} fill="#FFFFFF" />}
          <polygon points={points(pts.map((_, i) => i))} fill="none" stroke={INK} strokeWidth={2.6} strokeLinejoin="round" />
          <g stroke={INK} strokeWidth={2.2} strokeLinecap="round">
            {lined.map((k) => <line key={k} x1={f(pts[0].x)} y1={f(pts[0].y)} x2={f(pts[k].x)} y2={f(pts[k].y)} />)}
          </g>
          <g fill={INK}>{pts.map((p, i) => (i === 0 ? null : <circle key={i} cx={f(p.x)} cy={f(p.y)} r={4.5} />))}</g>
          <circle cx={f(pts[0].x)} cy={f(pts[0].y)} r={9} fill={HANDLE} stroke="#FFFFFF" strokeWidth={2.4} />
          {live && corners.map((k) => (
            <g
              key={k}
              role="checkbox"
              aria-checked={lined.includes(k)}
              aria-label={`Corner ${k + 1}: draw a line to it from corner 1`}
              tabIndex={0}
              onClick={() => toggle(k)}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault()
                  e.stopPropagation()
                  toggle(k)
                } else if (e.key.startsWith('Arrow')) e.stopPropagation()
              }}
              className="outline-none focus-visible:outline-none"
              style={{ cursor: 'pointer' }}
            >
              <circle cx={f(pts[k].x)} cy={f(pts[k].y)} r={22} fill="transparent" />
              <circle cx={f(pts[k].x)} cy={f(pts[k].y)} r={lined.includes(k) ? 8 : 6.5} fill={lined.includes(k) ? GIVEN : '#FFFFFF'} stroke={lined.includes(k) ? '#FFFFFF' : GIVEN} strokeWidth={2.4} />
            </g>
          ))}
        </Plate>
        <figcaption className="mt-1 text-center text-[12px] font-semibold text-ss-slate">
          A regular polygon: every side and every angle is equal.
          {live ? ' Tap a blue corner to draw a line to it from the orange corner.' : ''}
        </figcaption>
      </figure>
      {live && (
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" className={`${BUTTON} ${CENTRED}`} onClick={() => { write(corners); setSaid('Drew a line to every corner it can reach.') }}>Split into triangles</button>
          <button type="button" className={`${BUTTON} ${CENTRED}`} disabled={!lined.length} onClick={() => { write([]); setSaid('Took every line away.') }}>Clear the lines</button>
        </div>
      )}
      <NumberField
        label={task.ask === 'sum' ? 'Sum of the interior angles =' : 'One interior angle ='}
        digits={4}
        value={readValue(state)}
        onChange={(v) => setState({ ...state, value: v })}
        locked={locked}
        tone={!named ? null : ok ? 'right' : marked === 'wrong' ? 'wrong' : null}
      />
      <p className="sr-only" aria-live="polite">{said}</p>
      <Said lines={lines} />
    </div>
  )
}

// ---------------------------------------------------------------------------

export function GeometryConstructionView({ config, state, setState, marked, locked }: SceneViewProps<GeometryConfig, GeometryState>) {
  const task = config.task
  const common: Common = { state: asState(state), setState, marked, locked }
  if (task.kind === 'angle-facts') return task.unread?.length ? <Unshown /> : <FactsCard task={task} {...common} />
  if (task.kind === 'drag-invariant') {
    if (task.unread?.length) return <Unshown />
    return task.figure === 'triangle' ? <TriangleDrag task={task} {...common} /> : <ParallelDrag task={task} {...common} />
  }
  const ok = !task.unread?.length && Number.isInteger(task.sides) && task.sides >= MIN_SIDES && task.sides <= MAX_SIDES
  return ok ? <PolygonCard task={task} {...common} /> : <Unshown />
}
