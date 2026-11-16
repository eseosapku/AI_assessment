'use client'
import { useId, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import type { SceneMarked, SceneViewProps } from '../types'
import type { Average, Axis, ChooseTask, MakeTask, Move, PChange, PMeasure, PredictTask, StatsExplorerConfig, StatsExplorerState } from './config'
import {
  AVERAGES, MAX_DOTS, MIN_DOTS, MOVES, MOVE_WORDS, REASONS, TOP,
  applyChange, changeText, chooseSaid, makeSaid, predictSaid, readAnswers, readChoice, readDots, scenarioOf, targetChips,
} from './config'

// The scene's own drawing: the dot plot sits on a pale plate in both themes, like a figure in a
// book, so every part that carries meaning is over 3:1 on it. UI around it uses the design tokens.
const PLATE = '#F8FAFC'
const PLATE_EDGE = '#CBD5E1'
const INK = '#16202A'
const SOFT = '#475569'
const DOT = '#2563EB'
const DOT_EDGE = '#1E3A8A'
const CHANGE = '#C2410C'
const CHANGE_FILL = '#FFEDD5'
const BAND = '#DBEAFE'

// ---------------------------------------------------------------------------
// Where everything sits on a dot plot: pure, so the tests can hold it to the bar (dots apart and
// inside the box, each label nearest its own tick).

export const PLOT_W = 360
export const PAD_X = 16
/** The room above the stacks, for the arrow of a move and the flag over the column being edited. */
export const HEAD = 28
const TICK_LEN = 8
const LABEL_H = 14
const textW = (s: string) => s.length * 7.6 + 2

export type PlotLayout = {
  w: number
  h: number
  cols: number
  pitch: number
  r: number
  rowH: number
  rows: number
  baseY: number
  ticks: { value: number; x: number; major: boolean }[]
  labels: { value: number; text: string; x: number; y: number; w: number; h: number }[]
  xOf(value: number): number
  /** The value of the column nearest an x in the drawing, kept on the line. */
  valueAtX(x: number): number
  /** The centre of the k-th dot (from the bottom, from 0) of a value's stack. */
  dot(value: number, k: number): { cx: number; cy: number }
}

/** The plot for an axis with room for stacks `rows` high. */
export function layoutPlot(axis: Axis, rows: number): PlotLayout {
  const cols = Math.round((axis.max - axis.min) / axis.step) + 1
  const pitch = (PLOT_W - 2 * PAD_X) / (cols - 1)
  const r = Math.min(11, Math.floor(pitch * 0.42 * 10) / 10)
  const rowH = 2 * r + 1.5
  const baseY = HEAD + rows * rowH + 4
  const xOf = (value: number) => PAD_X + ((value - axis.min) / axis.step) * pitch
  const ticks = Array.from({ length: cols }, (_, i) => {
    const value = axis.min + i * axis.step
    return { value, x: xOf(value), major: i % axis.labelEvery === 0 }
  })
  const labels = ticks.filter((t) => t.major).map((t) => {
    const text = String(t.value)
    return { value: t.value, text, x: t.x, y: baseY + TICK_LEN + 16, w: textW(text), h: LABEL_H }
  })
  return {
    w: PLOT_W, h: baseY + TICK_LEN + 26, cols, pitch, r, rowH, rows, baseY, ticks, labels, xOf,
    valueAtX: (x) => axis.min + Math.max(0, Math.min(cols - 1, Math.round((x - PAD_X) / pitch))) * axis.step,
    dot: (value, k) => ({ cx: xOf(value), cy: baseY - 3 - r - k * rowH }),
  }
}

/** Each value's dots with their place in the stack, in order. */
export function stackOf(values: readonly number[]): { value: number; k: number }[] {
  const seen = new Map<number, number>()
  return [...values].sort((a, b) => a - b).map((value) => {
    const k = seen.get(value) ?? 0
    seen.set(value, k + 1)
    return { value, k }
  })
}

/** How many dots the tallest stack has. */
export const tallest = (values: readonly number[]): number => Math.max(0, ...stackOf(values).map((d) => d.k + 1))

// A function, not a constant: config.ts and this file import each other, so TOP is not there yet when this module loads.
const axis0to20 = (): Axis => ({ min: 0, max: TOP, step: 1, labelEvery: 2 })

const BUTTON = 'nodrag inline-flex min-h-[44px] items-center justify-center rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-1.5 text-center text-[14px] font-bold leading-snug text-ss-ink touch-manipulation hover:border-[color:var(--subject)] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:opacity-50'
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
// The plot: axis, ticks, numbers and dots.

function PlotBody({ layout, values }: { layout: PlotLayout; values: readonly number[] }) {
  const { r, pitch, baseY } = layout
  const x0 = layout.xOf(layout.ticks[0].value) - pitch / 2
  const x1 = layout.xOf(layout.ticks[layout.ticks.length - 1].value) + pitch / 2
  return (
    <>
      <rect width={layout.w} height={layout.h} rx={14} fill={PLATE} stroke={PLATE_EDGE} strokeWidth={1.5} />
      <line x1={x0} y1={baseY} x2={x1} y2={baseY} stroke={INK} strokeWidth={2} />
      <g stroke={INK}>
        {layout.ticks.map((t) => (
          <line key={t.value} x1={t.x} y1={baseY} x2={t.x} y2={baseY + (t.major ? TICK_LEN : TICK_LEN - 3)} strokeWidth={t.major ? 1.8 : 1.2} />
        ))}
      </g>
      <g fill={INK} fontSize={12} fontWeight={700} fontFamily="system-ui, sans-serif" textAnchor="middle">
        {layout.labels.map((l) => (
          <text key={l.value} x={l.x} y={l.y}>{l.text}</text>
        ))}
      </g>
      <g fill={DOT} stroke={DOT_EDGE} strokeWidth={1.4}>
        {stackOf(values).map((d) => {
          const p = layout.dot(d.value, d.k)
          return <circle key={`${d.value}-${d.k}`} cx={p.cx} cy={p.cy} r={r} />
        })}
      </g>
    </>
  )
}

/** The change a predict card shows, in orange: a dashed dot added, a crossed dot taken away, or a dot moved with an arrow. */
function ChangeMarks({ layout, values, change }: { layout: PlotLayout; values: readonly number[]; change: PChange }) {
  const { r, rowH, pitch } = layout
  const count = (v: number) => values.filter((x) => x === v).length
  const dashed = { stroke: CHANGE, strokeWidth: 2.2, strokeDasharray: '3.5 2.5' } as const
  const ghost = (value: number, k: number, plus: boolean) => {
    const p = layout.dot(value, k)
    return (
      <g>
        <circle cx={p.cx} cy={p.cy} r={r} fill={CHANGE_FILL} {...dashed} />
        {plus && <path d={`M ${p.cx - r * 0.5} ${p.cy} H ${p.cx + r * 0.5} M ${p.cx} ${p.cy - r * 0.5} V ${p.cy + r * 0.5}`} stroke={CHANGE} strokeWidth={2} fill="none" />}
      </g>
    )
  }
  if (change.kind === 'add') return ghost(change.value, count(change.value), true)
  if (change.kind === 'remove') {
    const p = layout.dot(change.value, count(change.value) - 1)
    const e = r * 0.62
    return (
      <g>
        <circle cx={p.cx} cy={p.cy} r={r + 1.5} fill="none" {...dashed} />
        <path d={`M ${p.cx - e} ${p.cy - e} L ${p.cx + e} ${p.cy + e} M ${p.cx + e} ${p.cy - e} L ${p.cx - e} ${p.cy + e}`} stroke={CHANGE} strokeWidth={2.6} strokeLinecap="round" />
      </g>
    )
  }
  const from = layout.dot(change.from, count(change.from) - 1)
  const to = layout.dot(change.to, count(change.to))
  const yA = HEAD + rowH / 2 + 1
  const dir = Math.sign(to.cx - from.cx) || 1
  const tip = to.cx - dir * Math.min(3, pitch / 4)
  return (
    <g>
      <circle cx={from.cx} cy={from.cy} r={r} fill={CHANGE_FILL} {...dashed} />
      {ghost(change.to, count(change.to), false)}
      <g stroke={CHANGE} strokeWidth={2} fill="none">
        <path d={`M ${from.cx} ${from.cy - r - 2} V ${yA} H ${tip}`} strokeDasharray="2 3" />
        <path d={`M ${to.cx} ${yA} V ${to.cy - r - 2}`} strokeDasharray="2 3" />
      </g>
      <path d={`M ${to.cx} ${yA} l ${-dir * 7} -4.5 v 9 Z`} fill={CHANGE} />
    </g>
  )
}

const spoken = (values: readonly number[]): string => [...values].sort((a, b) => a - b).join(', ')

// ---------------------------------------------------------------------------
// Choosing one of a few: a radio group with a single stop on Tab.

type Option<T extends string> = { id: T; text: string }

function Choice<T extends string>({ label, options, value, onPick, locked, columns }: {
  label: string; options: Option<T>[]; value: T | ''; onPick(id: T): void; locked: boolean; columns: 1 | 3
}) {
  const id = useId()
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})
  const onKey = (e: KeyboardEvent) => {
    const step = ({ ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 } as Record<string, number>)[e.key]
    if (step === undefined || locked) return
    e.preventDefault()
    e.stopPropagation()
    const at = options.findIndex((o) => o.id === value)
    // With nothing chosen yet, forward lands on the first and back on the last.
    const next = options[((at < 0 ? (step > 0 ? -1 : 0) : at) + step + options.length) % options.length]
    onPick(next.id)
    refs.current[next.id]?.focus()
  }
  return (
    <div className="flex w-full flex-col gap-1.5">
      <p id={`${id}-l`} className="text-[14px] font-extrabold leading-snug text-ss-ink">{label}</p>
      <div role="radiogroup" aria-labelledby={`${id}-l`} className={columns === 3 ? 'grid grid-cols-3 gap-2' : 'flex flex-col gap-2'}>
        {options.map((o, i) => {
          const chosen = value === o.id
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
              className={`${BUTTON} ${columns === 1 ? 'justify-start text-left' : ''}`}
              style={chosen ? CHOSEN : undefined}
            >
              {o.text}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// make: build a data set that meets the targets.

function MakeCard({ task, state, setState, marked, locked }: {
  task: MakeTask; state: StatsExplorerState; setState(next: StatsExplorerState): void; marked: SceneMarked; locked: boolean
}) {
  const id = useId()
  const svg = useRef<SVGSVGElement>(null)
  const grab = useRef<{ value: number; fresh: boolean; moved: boolean; dots: number[] } | null>(null)
  const [cursor, setCursor] = useState(Math.floor(TOP / 2))
  const [focused, setFocused] = useState(false)
  const [holding, setHolding] = useState(false)
  const [said, setSaid] = useState('')
  const n = task.count as number
  const dots = readDots(state, n)
  const live = !locked
  const layout = layoutPlot(axis0to20(), n)
  const countAt = (v: number) => dots.filter((x) => x === v).length
  const write = (next: number[]) => setState({ dots: [...next].sort((a, b) => a - b) })
  const valueFrom = (e: PointerEvent): number => {
    const box = svg.current?.getBoundingClientRect()
    return layout.valueAtX(box ? ((e.clientX - box.left) / box.width) * PLOT_W : 0)
  }
  const add = (v: number) => {
    if (dots.length >= n) return setSaid(`All ${n} dots are placed. Take one off to move it.`)
    write([...dots, v])
    setSaid(`Added a dot at ${v}. ${dots.length + 1} of ${n} placed.`)
  }
  const take = (v: number) => {
    const i = dots.indexOf(v)
    if (i < 0) return setSaid(`No dot at ${v} to take off.`)
    write(dots.filter((_, j) => j !== i))
    setSaid(`Took a dot off ${v}. ${dots.length - 1} of ${n} placed.`)
  }
  const onKey = (e: KeyboardEvent) => {
    if (!live) return
    const move = ({ ArrowRight: 1, ArrowLeft: -1 } as Record<string, number>)[e.key]
    if (move !== undefined) {
      e.preventDefault()
      e.stopPropagation()
      const to = Math.max(0, Math.min(TOP, cursor + move))
      setCursor(to)
      setSaid(`${to}, ${countAt(to) ? `${countAt(to)} dot${countAt(to) === 1 ? '' : 's'}` : 'no dots'}.`)
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault()
      e.stopPropagation()
      setCursor(e.key === 'Home' ? 0 : TOP)
    } else if (e.key === 'ArrowUp' || e.key === ' ' || e.key === 'Enter' || e.key === '+') {
      e.preventDefault()
      e.stopPropagation()
      add(cursor)
    } else if (e.key === 'ArrowDown' || e.key === 'Backspace' || e.key === 'Delete' || e.key === '-') {
      e.preventDefault()
      e.stopPropagation()
      take(cursor)
    }
  }

  const band = live && (focused || holding)
  const plot = (
    <svg
      ref={svg}
      viewBox={`0 0 ${layout.w} ${layout.h}`}
      className={`block w-full select-none outline-none focus-visible:outline-none ${live ? 'touch-none cursor-pointer' : ''}`}
      style={{ maxWidth: layout.w }}
      role="grid"
      tabIndex={live ? 0 : -1}
      aria-label={`Dot plot on a line from 0 to ${TOP}, for ${n} dots. Right and left arrows move along the line, the up arrow or space adds a dot, the down arrow or backspace takes one off.`}
      aria-activedescendant={live && focused ? `${id}-c${cursor}` : undefined}
      aria-readonly={!live || undefined}
      onKeyDown={onKey}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onPointerDown={(e) => {
        if (!live) return
        const v = valueFrom(e)
        setCursor(v)
        if (dots.includes(v)) grab.current = { value: v, fresh: false, moved: false, dots: [...dots] }
        else if (dots.length < n) {
          const next = [...dots, v]
          write(next)
          grab.current = { value: v, fresh: true, moved: false, dots: next }
          setSaid(`Added a dot at ${v}. ${next.length} of ${n} placed.`)
        } else {
          setSaid(`All ${n} dots are placed. Tap a dot to take one off.`)
          return
        }
        setHolding(true)
        e.currentTarget.setPointerCapture?.(e.pointerId)
      }}
      onPointerMove={(e) => {
        const g = grab.current
        if (!g) return
        const v = valueFrom(e)
        if (v === g.value) return
        const i = g.dots.indexOf(g.value)
        if (i >= 0) g.dots[i] = v
        g.value = v
        g.moved = true
        write(g.dots)
        setCursor(v)
      }}
      onPointerUp={() => {
        const g = grab.current
        grab.current = null
        setHolding(false)
        if (!g) return
        if (!g.fresh && !g.moved) {
          write(g.dots.filter((_, j) => j !== g.dots.indexOf(g.value)))
          setSaid(`Took a dot off ${g.value}. ${g.dots.length - 1} of ${n} placed.`)
        } else setSaid(`A dot is at ${g.value}. ${g.dots.length} of ${n} placed.`)
      }}
      onPointerCancel={() => { grab.current = null; setHolding(false) }}
    >
      <PlotBody layout={layout} values={dots} />
      {band && (
        <g>
          <rect x={layout.xOf(cursor) - layout.pitch / 2} y={HEAD - 2} width={layout.pitch} height={layout.baseY - HEAD + 2} fill="none" stroke="var(--subject)" strokeWidth={2.5} rx={4} />
          <g transform={`translate(${Math.max(15, Math.min(layout.w - 15, layout.xOf(cursor)))} 14)`}>
            <rect x={-15} y={-11} width={30} height={22} rx={6} fill={INK} />
            <text x={0} y={5} textAnchor="middle" fontSize={13} fontWeight={800} fill="#FFFFFF" fontFamily="system-ui, sans-serif">{cursor}</text>
          </g>
        </g>
      )}
      {/* One cell per column, for the keyboard and screen readers; the drawing above is what is seen. */}
      <g role="row">
        {layout.ticks.map((t) => (
          <rect
            key={t.value}
            id={`${id}-c${t.value}`}
            role="gridcell"
            aria-label={`${t.value}, ${countAt(t.value) ? `${countAt(t.value)} dot${countAt(t.value) === 1 ? '' : 's'}` : 'no dots'}`}
            x={t.x - layout.pitch / 2}
            y={HEAD}
            width={layout.pitch}
            height={layout.baseY - HEAD}
            fill="transparent"
          />
        ))}
      </g>
    </svg>
  )

  const lines = marked !== 'idle' ? makeSaid(task, state, marked === 'wrong' ? 'wrong' : 'right') : []
  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col items-center gap-2" onKeyDown={keepArrows}>
      <ul className="flex flex-wrap justify-center gap-2" aria-label="The data set to make">
        <li className="rounded-xl border-2 border-ss-line bg-ss-chip px-3 py-1 text-[14px] font-extrabold text-ss-ink">{n} dots</li>
        {targetChips(task).map((chip) => (
          <li key={chip} className="rounded-xl border-2 border-ss-line bg-ss-chip px-3 py-1 text-[14px] font-extrabold text-ss-ink">{chip}</li>
        ))}
      </ul>
      <figure className="m-0 w-full" style={{ maxWidth: layout.w }}>
        {plot}
        <figcaption className="mt-1 text-center text-[12px] font-semibold text-ss-slate">
          Dots placed: {dots.length} of {n}. Not all the dots on one value.{live ? ' Tap the line to add a dot, drag a dot to move it, tap a dot to take it off.' : ''}
        </figcaption>
      </figure>
      <p className="sr-only" aria-live="polite">{said}</p>
      {live && (
        <button type="button" className={BUTTON} disabled={!dots.length} onClick={() => { setSaid('Took every dot off.'); write([]) }}>
          Clear the dots
        </button>
      )}
      <Said lines={lines} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// predict: what a change does to each measure.

const MEASURE_ASK: Record<PMeasure, string> = { mean: 'the mean', median: 'the median', range: 'the range' }

function PredictCard({ task, state, setState, marked, locked }: {
  task: PredictTask; state: StatsExplorerState; setState(next: StatsExplorerState): void; marked: SceneMarked; locked: boolean
}) {
  const change = task.change as PChange
  const after = applyChange(task.values, change)
  const rows = Math.max(tallest(task.values), tallest(after)) + (change.kind === 'move' ? 1 : 0)
  const layout = layoutPlot(axis0to20(), rows)
  const answers = readAnswers(state)
  const options: Option<Move>[] = MOVES.map((m) => ({ id: m, text: cap(MOVE_WORDS[m]) }))
  const legend =
    change.kind === 'add' ? 'The orange dashed dot is the new value.'
    : change.kind === 'remove' ? 'The orange crossed dot is taken away.'
    : 'The orange dashed dot at the start of the arrow moves to the dashed dot at its end.'
  const caption = `Each dot is one value. ${legend}`
  const lines = marked !== 'idle' ? predictSaid(task, state, marked === 'wrong' ? 'wrong' : 'right') : []
  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col items-center gap-2.5" onKeyDown={keepArrows}>
      <p className="rounded-xl border-2 border-ss-line bg-ss-chip px-3 py-1.5 text-center text-[15px] font-extrabold leading-snug text-ss-ink">
        The change: {changeText(change)}
      </p>
      <figure className="m-0 w-full" style={{ maxWidth: layout.w }}>
        <svg
          viewBox={`0 0 ${layout.w} ${layout.h}`}
          className="block w-full"
          style={{ maxWidth: layout.w }}
          role="img"
          aria-label={`Dot plot on a line from 0 to ${TOP}. The dots are at ${spoken(task.values)}. The change: ${changeText(change)}.`}
        >
          <PlotBody layout={layout} values={task.values} />
          <ChangeMarks layout={layout} values={task.values} change={change} />
        </svg>
        <figcaption className="mt-1 text-center text-[12px] font-semibold text-ss-slate">{caption}</figcaption>
      </figure>
      {task.measures.map((m) => (
        <Choice
          key={m}
          label={`What happens to ${MEASURE_ASK[m]}?`}
          options={options}
          value={answers[m] ?? ''}
          locked={locked}
          columns={3}
          onPick={(move) => setState({ answers: { ...answers, [m]: move } })}
        />
      ))}
      <Said lines={lines} />
    </div>
  )
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

// ---------------------------------------------------------------------------
// choose: the best average for a situation, and why.

function ChooseCard({ task, state, setState, marked, locked }: {
  task: ChooseTask; state: StatsExplorerState; setState(next: StatsExplorerState): void; marked: SceneMarked; locked: boolean
}) {
  const s = scenarioOf(task)
  if (!s) return <p className="text-[13px] font-semibold text-ss-slate">This situation could not be drawn.</p>
  const c = readChoice(state)
  const layout = layoutPlot(s.axis, tallest(s.values))
  const averages: Option<Average>[] = AVERAGES.map((a) => ({ id: a, text: cap(a) }))
  const reasons: Option<Average>[] = AVERAGES.map((a) => ({ id: a, text: REASONS[a] }))
  const lines = marked !== 'idle' ? chooseSaid(task, state, marked === 'wrong' ? 'wrong' : 'right') : []
  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col items-center gap-2.5" onKeyDown={keepArrows}>
      <p className="text-center text-[14px] font-semibold leading-snug text-ss-ink">{s.setting}</p>
      <figure className="m-0 w-full" style={{ maxWidth: layout.w }}>
        <svg
          viewBox={`0 0 ${layout.w} ${layout.h}`}
          className="block w-full"
          style={{ maxWidth: layout.w }}
          role="img"
          aria-label={`Dot plot of ${s.thing}. There are ${s.values.length} values: ${spoken(s.values)}.`}
        >
          <PlotBody layout={layout} values={s.values} />
        </svg>
        <figcaption className="mt-1 text-center text-[12px] font-semibold text-ss-slate">One dot for each value. The line shows the {s.thing}.</figcaption>
      </figure>
      <Choice label="Which average is best here?" options={averages} value={c.average} locked={locked} columns={3} onPick={(average) => setState({ average, reason: c.reason })} />
      <Choice label="Which reason fits?" options={reasons} value={c.reason} locked={locked} columns={1} onPick={(reason) => setState({ average: c.average, reason })} />
      <Said lines={lines} />
    </div>
  )
}

// ---------------------------------------------------------------------------

export function StatsExplorerView({ config, state, setState, marked, locked }: SceneViewProps<StatsExplorerConfig, StatsExplorerState>) {
  const task = config.task
  const common = { state: state && typeof state === 'object' ? state : {}, setState, marked, locked }
  if (task.kind === 'make') {
    const ok = task.count !== undefined && Number.isInteger(task.count) && task.count >= MIN_DOTS && task.count <= MAX_DOTS
    return ok ? <MakeCard task={task} {...common} /> : <Unshown />
  }
  if (task.kind === 'predict') return task.change && task.values.length > 0 ? <PredictCard task={task} {...common} /> : <Unshown />
  return <ChooseCard task={task} {...common} />
}

function Unshown(): ReactNode {
  return <p className="text-[13px] font-semibold text-ss-slate">This data could not be drawn.</p>
}
