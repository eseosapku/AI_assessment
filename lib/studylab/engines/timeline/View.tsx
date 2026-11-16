'use client'
import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { SceneMarked, SceneViewProps } from '../types'
import type { Axis, Item, TimelineConfig, TimelineState } from './config'
import {
  axisOf, fmtYear, startAt, handlesOf, laneOrder, madeOverlap, madePlace, movable, running, toHist, workingOverlap, workingPlace, yearsText,
} from './config'

type Props = SceneViewProps<TimelineConfig, TimelineState>
type PlaceConfig = Extract<TimelineConfig, { task: 'place' }>
type OverlapConfig = Extract<TimelineConfig, { task: 'overlap' }>

// A quiet light plate in both themes, like waves and measure-shape: the picture keeps its own colours. Flat colours only.
const PLATE = '#F8FAFC'
const PLATE_EDGE = '#CBD5E1'
const HAIR = '#DCE3EA'
const GROOVE = '#E2E8F0'
const INK = '#334155'
const SOFT = '#475569'
const ACCENT = '#2F6FB5'
const GOOD = '#15803D'
const BAD = '#B91C1C'
const FIXED = '#475569'
const PAPER = '#F4EFE2'
const PAPER_EDGE = '#CDC3A9'
const PAPER_INK = '#3B3426'
const PAPER_TICK = '#6B6350'

export const W = 360
export const X0 = 28
export const X1 = 332
export const LANE_H = 58
export const TOP = 6
export const DISC_R = 17
/** The ruler band under the lanes. */
export const RULER_H = 32
export const TRACK_DY = 42
export const NAME_DY = 17
/** Narrowest strip segment that has room to print its years. */
export const SEG_LABEL_MIN = 78

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
export const xOf = (a: number, ax: Axis) => X0 + ((a - ax.from) / ax.span) * (X1 - X0)
export const axisY = (lanes: number) => TOP + lanes * LANE_H + 4

function Verdict({ marked, lines }: { marked: SceneMarked; lines: string[] }) {
  if (marked === 'idle' || lines.length === 0) return null
  return (
    <div className="w-full max-w-[360px] rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2 text-[13px] font-extrabold leading-snug text-ss-ink" aria-live="polite">
      {lines.map((l, i) => <p key={i}>{l}</p>)}
    </div>
  )
}

type Tab = { x0: number; x1: number; y0: number; y1: number }
const tabW = (name: string) => Math.ceil(name.length * 6.8) + 14
const tabOf = (name: string, top: number): Tab => ({ x0: 14, x1: 14 + tabW(name), y0: top + NAME_DY - 13, y1: top + NAME_DY + 5 })

/** A vertical line from y0 to y1 that stops short of any event tab it would cross. */
function vline(x: number, y0: number, y1: number, tabs: Tab[]): string {
  let segs: [number, number][] = [[y0, y1]]
  for (const t of tabs) {
    if (x < t.x0 - 4 || x > t.x1 + 4) continue
    const lo = t.y0 - 4
    const hi = t.y1 + 4
    segs = segs.flatMap(([a, b]) => (b <= lo || a >= hi ? [[a, b] as [number, number]] : [[a, Math.min(b, lo)], [Math.max(a, hi), b]].filter(([p, q]) => q - p > 1) as [number, number][]))
  }
  return segs.map(([a, b]) => `M${x.toFixed(1)} ${a.toFixed(1)}V${b.toFixed(1)}`).join('')
}

function EventTab({ name, top }: { name: string; top: number }) {
  const t = tabOf(name, top)
  return (
    <g aria-hidden="true">
      <rect x={t.x0} y={t.y0} width={t.x1 - t.x0} height={t.y1 - t.y0} rx={5} fill="#FFFFFF" stroke={PLATE_EDGE} strokeWidth={1} />
      <text x={t.x0 + 7} y={t.y1 - 5} fontSize={12} fontWeight={700} fill={INK}>{name}</text>
    </g>
  )
}

/** The printed ruler: a paper band with minor and major ticks and dates inside it. */
function AxisLines({ ax, y }: { ax: Axis; y: number }) {
  const d = ax.ticks.length > 1 ? ax.ticks[1] - ax.ticks[0] : ax.span / 4
  const minor: number[] = []
  if (d > 0) {
    const first = ax.ticks.length ? ax.ticks[0] : ax.from
    const step = d / 5
    let v = first - Math.floor((first - ax.from) / step) * step
    for (let k = 0; v <= ax.to + 1e-6 && k < 80; k++, v += step) minor.push(v)
  }
  return (
    <g aria-hidden="true">
      <rect x={X0 - 10} y={y} width={X1 - X0 + 20} height={RULER_H} rx={4} fill={PAPER} stroke={PAPER_EDGE} strokeWidth={1} />
      {minor.map((v, i) => <line key={`m${i}`} x1={xOf(v, ax)} x2={xOf(v, ax)} y1={y} y2={y + 5} stroke={PAPER_TICK} strokeWidth={1} />)}
      {ax.ticks.map((t) => {
        const x = xOf(t, ax)
        const anchor = x < X0 + 26 ? 'start' : x > X1 - 26 ? 'end' : 'middle'
        const lx = anchor === 'start' ? Math.max(x - 4, X0 - 6) : anchor === 'end' ? Math.min(x + 4, X1 + 6) : x
        return (
          <g key={t}>
            <line x1={x} x2={x} y1={y} y2={y + 11} stroke={PAPER_INK} strokeWidth={1.5} />
            <text x={lx} y={y + 25} textAnchor={anchor} fontSize={12} fontWeight={700} fill={PAPER_INK}>{fmtYear(toHist(t), ax.plain)}</text>
          </g>
        )
      })}
    </g>
  )
}

function useYearDrag(svg: React.RefObject<SVGSVGElement | null>, ax: Axis) {
  return (clientX: number): number | null => {
    const r = svg.current?.getBoundingClientRect()
    if (!r || r.width === 0) return null
    const x = ((clientX - r.left) / r.width) * W
    return clamp(Math.round(ax.from + ((x - X0) / (X1 - X0)) * ax.span), ax.from, ax.to)
  }
}

/** The handle: a slim grooved pin that sits on the object, with two grip lines. */
function Pin({ x, y, fill, h = 24 }: { x: number; y: number; fill: string; h?: number }) {
  return (
    <g>
      <rect x={x - 7} y={y - h / 2} width={14} height={h} rx={5} fill={fill} stroke="#FFFFFF" strokeWidth={1.5} />
      <path d={`M${x - 2} ${y - 5}V${y + 5}M${x + 2} ${y - 5}V${y + 5}`} stroke="#FFFFFF" strokeWidth={1.4} strokeLinecap="round" opacity={0.85} />
    </g>
  )
}

const FIG = 'flex w-full max-w-[360px] flex-col gap-1.5'
const CAP = 'text-center text-[12px] font-bold text-ss-slate'
const FOCUS = 'outline-none [&:focus-visible>rect:nth-child(2)]:stroke-[color:var(--subject)] [&:focus-visible>rect:nth-child(2)]:stroke-[3]'

// ---------------------------------------------------------------------------
// Place: one lane for each event, a disc to slide along it.

function Place({ config, state, setState, marked, locked }: Props & { config: PlaceConfig }) {
  const { items } = config
  const ax = axisOf(items)
  const svg = useRef<SVGSVGElement>(null)
  const yearAt = useYearDrag(svg, ax)
  const [drag, setDrag] = useState<string | null>(null)
  const [focus, setFocus] = useState<string | null>(null)
  const at = { ...startAt(items), ...(state?.at ?? {}) }
  const order = laneOrder(items)
  const yA = axisY(items.length)
  const all = handlesOf(items)
  const good = marked === 'right' || marked === 'shown'
  const wrongNow = marked === 'wrong' ? new Set(checkWrong(config, at)) : new Set<string>()

  const put = (key: string, v: number) => {
    if (locked) return
    const next = clamp(Math.round(v), ax.from, ax.to)
    if (at[key] !== next) setState({ at: { ...at, [key]: next } })
  }
  const keyOf = (h: { key: string }, e: KeyboardEvent) => {
    const big = e.shiftKey ? 5 : 1
    const cur = at[h.key]
    const d = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0
    if (d) { e.preventDefault(); e.stopPropagation(); put(h.key, cur + d * ax.unit * big) }
    else if (e.key === 'Home') { e.preventDefault(); e.stopPropagation(); put(h.key, ax.from) }
    else if (e.key === 'End') { e.preventDefault(); e.stopPropagation(); put(h.key, ax.to) }
  }

  // Where every date on the board stands (given ones and the learner's), for the strip of gaps.
  const marks: number[] = []
  for (const h of all) {
    const v = h.given ? h.year : at[h.key]
    if (v !== undefined) marks.push(v)
  }
  marks.sort((a, b) => a - b)
  const segs = marks.slice(1).map((m, i) => ({ a: marks[i], b: m }))

  const lines = good
    ? [workingPlace(items, ax.plain)]
    : marked === 'wrong' ? madePlace(items, at, ax.plain).slice(0, 3) : []

  const H = yA + RULER_H + 10 + 18 + 12
  const tabs = order.map((idx, row) => tabOf(items[idx].name, TOP + row * LANE_H))
  const tabsBelow = (row: number) => tabs.slice(row + 1)
  return (
    <div className="nodrag flex flex-col items-center gap-3 [&:has(:focus-visible)_.tl-kbd]:block">
      <figure className={FIG}>
        <svg
          ref={svg}
          viewBox={`0 0 ${W} ${H}`}
          width={W}
          height={H}
          className="block h-auto w-full touch-none select-none"
          role="group"
          aria-label={`A timeline of ${items.length} items, each in its own lane, on a scale of ${yearsText(ax.span)}`}
          onPointerMove={(e: PointerEvent) => { if (drag) { const v = yearAt(e.clientX); if (v !== null) put(drag, v) } }}
          onPointerUp={() => setDrag(null)}
          onPointerCancel={() => setDrag(null)}
        >
          <rect width={W} height={H} rx={16} fill={PLATE} stroke={PLATE_EDGE} strokeWidth={1.5} aria-hidden="true" />
          <AxisLines ax={ax} y={yA} />
          {order.map((idx, row) => {
            const it = items[idx]
            const top = TOP + row * LANE_H
            const ty = top + TRACK_DY
            const hs = all.filter((h) => h.item === idx)
            const isSpan = hs.length === 2
            const pos = (h: (typeof hs)[number]) => (h.given ? h.year : at[h.key])
            const a = isSpan ? pos(hs[0]) : undefined
            const b = isSpan ? pos(hs[1]) : undefined
            const readout = isSpan
              ? (a !== undefined && b !== undefined ? `${yearsText(Math.abs(b - a))}` : '')
              : (pos(hs[0]) === undefined ? '' : fmtYear(toHist(pos(hs[0]) as number), ax.plain))
            return (
              <g key={idx}>
                <line x1={X0} x2={X1} y1={ty} y2={ty} stroke={GROOVE} strokeWidth={6} strokeLinecap="round" aria-hidden="true" />
                <line x1={X0} x2={X1} y1={ty} y2={ty} stroke={PLATE_EDGE} strokeWidth={1} aria-hidden="true" />
                <EventTab name={it.name} top={top} />
                <text x={X1 + 4} y={top + NAME_DY} textAnchor="end" fontSize={12} fontWeight={800} fill={it.given ? FIXED : ACCENT} aria-hidden="true">{readout}</text>
                {isSpan && a !== undefined && b !== undefined && (
                  <rect x={xOf(Math.min(a, b), ax)} y={ty - 4} width={Math.abs(xOf(b, ax) - xOf(a, ax))} height={8} rx={3} fill={ACCENT} opacity={0.35} aria-hidden="true" />
                )}
                {hs.map((h) => {
                  const v = pos(h)
                  if (h.given) {
                    return v === undefined ? null : (
                      <g key={h.key} role="img" aria-label={`${it.name}${isSpan ? (h.part === 'start' ? ' began' : ' ended') : ''} in ${fmtYear(toHist(h.year), ax.plain)}, fixed`}>
                        <path d={vline(xOf(v, ax), ty + 12, yA, tabsBelow(row))} stroke={FIXED} strokeWidth={1.5} fill="none" />
                        <Pin x={xOf(v, ax)} y={ty} fill={FIXED} h={20} />
                      </g>
                    )
                  }
                  const cx = xOf(v as number, ax)
                  const fill = good ? GOOD : wrongNow.has(h.key) ? BAD : ACCENT
                  const name = `${it.name}${isSpan ? (h.part === 'start' ? ', start' : ', end') : ''}`
                  return (
                    <g key={h.key}>
                      <path d={vline(cx, ty + 14, yA, tabsBelow(row))} stroke={fill} strokeWidth={1.5} strokeDasharray="4 3" fill="none" aria-hidden="true" />
                      {marked === 'wrong' && wrongNow.has(h.key) && (
                        <g aria-hidden="true">
                          <rect x={xOf(h.year, ax) - 6} y={ty - 10} width={12} height={20} rx={5} fill="none" stroke={GOOD} strokeWidth={2} />
                          <path d={vline(xOf(h.year, ax), ty + 12, yA, tabsBelow(row))} stroke={GOOD} strokeWidth={1.5} fill="none" />
                        </g>
                      )}
                      <g
                        role="slider"
                        tabIndex={locked ? -1 : 0}
                        aria-label={`${name}: slide to the date. Arrow keys move it`}
                        aria-valuemin={ax.from}
                        aria-valuemax={ax.to}
                        aria-valuenow={v}
                        aria-valuetext={fmtYear(toHist(v as number), ax.plain)}
                        aria-disabled={locked || undefined}
                        onKeyDown={(e) => keyOf(h, e)}
                        onFocus={() => setFocus(h.key)}
                        onBlur={() => setFocus(null)}
                        onPointerDown={(e: PointerEvent) => {
                          if (locked) return
                          svg.current?.setPointerCapture?.(e.pointerId)
                          setDrag(h.key)
                          const y = yearAt(e.clientX)
                          if (y !== null) put(h.key, y)
                        }}
                        className={`${FOCUS} ${locked ? '' : 'cursor-grab'}`}
                      >
                        <rect x={cx - 20} y={ty - 22} width={40} height={44} fill="transparent" />
                        <rect x={cx - 7} y={ty - 12} width={14} height={24} rx={5} fill={fill} stroke="#FFFFFF" strokeWidth={1.5} />
                        <path d={`M${cx - 2} ${ty - 5}V${ty + 5}M${cx + 2} ${ty - 5}V${ty + 5}`} stroke="#FFFFFF" strokeWidth={1.4} strokeLinecap="round" opacity={0.85} aria-hidden="true" />
                      </g>
                    </g>
                  )
                })}
              </g>
            )
          })}
          {/* the gaps their placements leave, drawn to the same scale as the ruler */}
          <g aria-hidden="true">
            {segs.map((s, i) => {
              const x = xOf(s.a, ax)
              const w = xOf(s.b, ax) - x
              return (
                <g key={i}>
                  <rect x={x} y={yA + RULER_H + 10} width={Math.max(w, 0)} height={18} fill={i % 2 ? '#EDF1F5' : '#E4EAF0'} stroke={PLATE_EDGE} strokeWidth={0.75} />
                  {w >= SEG_LABEL_MIN && <text x={x + w / 2} y={yA + RULER_H + 23} textAnchor="middle" fontSize={12} fontWeight={700} fill={SOFT}>{yearsText(s.b - s.a)}</text>}
                </g>
              )
            })}
          </g>
        </svg>
        <figcaption className={CAP}>Drag each marker along its line to the date it happened.</figcaption>
      </figure>
      <p className="tl-kbd hidden text-[12px] text-ss-slate">Tab to a marker, then the left and right arrow keys slide it. Shift moves it faster.</p>
      <Verdict marked={marked} lines={lines} />
    </div>
  )
}

function checkWrong(config: PlaceConfig, at: Record<string, number>): string[] {
  const ax = axisOf(config.items)
  return movable(config.items).filter((h) => at[h.key] === undefined || Math.abs(at[h.key] - h.year) > ax.tol).map((h) => h.key)
}

// ---------------------------------------------------------------------------
// Overlap: bars at their true places, a year line to drag.

function Overlap({ config, state, setState, marked, locked }: Props & { config: OverlapConfig }) {
  const { spans } = config
  const ax = axisOf(spans)
  const svg = useRef<SVGSVGElement>(null)
  const yearAt = useYearDrag(svg, ax)
  const [drag, setDrag] = useState(false)
  const year = clamp(typeof state?.year === 'number' ? state.year : ax.from, ax.from, ax.to)
  const order = laneOrder(spans)
  const yA = axisY(spans.length)
  const now = running(spans, year)
  const good = marked === 'right' || marked === 'shown'
  const ring = good ? GOOD : marked === 'wrong' ? BAD : ACCENT
  const lx = xOf(year, ax)

  const set = (v: number) => {
    if (locked) return
    const next = clamp(Math.round(v), ax.from, ax.to)
    if (next !== year) setState({ year: next })
  }
  const onKey = (e: KeyboardEvent) => {
    const big = e.shiftKey ? 5 : 1
    const d = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0
    if (d) { e.preventDefault(); e.stopPropagation(); set(year + d * ax.unit * big) }
    else if (e.key === 'Home') { e.preventDefault(); e.stopPropagation(); set(ax.from) }
    else if (e.key === 'End') { e.preventDefault(); e.stopPropagation(); set(ax.to) }
  }
  const lines = good ? [workingOverlap(config, year, ax.plain)] : marked === 'wrong' ? [madeOverlap(spans, year, ax.plain)] : []
  const H = yA + RULER_H + 46
  const tabs = order.map((idx, row) => tabOf(spans[idx].name, TOP + row * LANE_H))
  return (
    <div className="nodrag flex flex-col items-center gap-3 [&:has(:focus-visible)_.tl-kbd]:block">
      <figure className={FIG}>
        <svg
          ref={svg}
          viewBox={`0 0 ${W} ${H}`}
          width={W}
          height={H}
          className="block h-auto w-full touch-none select-none"
          role="group"
          aria-label={`${spans.length} bars on a timeline of ${yearsText(ax.span)}, and a vertical line to move along it`}
          onPointerDown={(e: PointerEvent) => {
            if (locked) return
            svg.current?.setPointerCapture?.(e.pointerId)
            setDrag(true)
            const v = yearAt(e.clientX)
            if (v !== null) set(v)
          }}
          onPointerMove={(e: PointerEvent) => { if (drag) { const v = yearAt(e.clientX); if (v !== null) set(v) } }}
          onPointerUp={() => setDrag(false)}
          onPointerCancel={() => setDrag(false)}
        >
          <rect width={W} height={H} rx={16} fill={PLATE} stroke={PLATE_EDGE} strokeWidth={1.5} aria-hidden="true" />
          <AxisLines ax={ax} y={yA} />
          {order.map((idx, row) => {
            const s = spans[idx] as Item & { start: number; end: number }
            const top = TOP + row * LANE_H
            const on = now.includes(idx)
            const x1 = xOf(handlesOf([s])[0].year, ax)
            const x2 = xOf(handlesOf([s])[1].year, ax)
            return (
              <g key={idx} aria-hidden="true">
                <line x1={X0} x2={X1} y1={top + 40} y2={top + 40} stroke={HAIR} strokeWidth={1} />
                <EventTab name={s.name} top={top} />
                <rect
                  x={x1} y={top + 31} width={Math.max(x2 - x1, 6)} height={18} rx={5}
                  fill={on ? ACCENT : '#EEF2F6'} stroke={on ? '#1F4E85' : '#94A3B8'} strokeWidth={1.25}
                  className="motion-safe:transition-colors motion-safe:duration-700"
                />
              </g>
            )
          })}
          {/* the year line, with its handle sitting on the ruler's edge */}
          <path d={vline(lx, TOP, yA - 12, tabs)} stroke={ring} strokeWidth={1.75} fill="none" aria-hidden="true" />
          <g
            role="slider"
            tabIndex={locked ? -1 : 0}
            aria-label="Year line. Arrow keys move it along the timeline"
            aria-valuemin={ax.from}
            aria-valuemax={ax.to}
            aria-valuenow={year}
            aria-valuetext={`${fmtYear(toHist(year), ax.plain)}: ${now.length === 0 ? 'none of the bars is crossed' : `crossing ${now.map((i) => spans[i].name).join(', ')}`}`}
            aria-disabled={locked || undefined}
            onKeyDown={onKey}
            className={`${FOCUS} ${locked ? '' : 'cursor-grab'}`}
          >
            <rect x={lx - 20} y={yA - 22} width={40} height={44} fill="transparent" />
            <rect x={lx - 7} y={yA - 12} width={14} height={24} rx={5} fill={ring} stroke="#FFFFFF" strokeWidth={1.5} />
            <path d={`M${lx - 2} ${yA - 5}V${yA + 5}M${lx + 2} ${yA - 5}V${yA + 5}`} stroke="#FFFFFF" strokeWidth={1.4} strokeLinecap="round" opacity={0.85} aria-hidden="true" />
          </g>
          <text x={clamp(lx, X0 + 30, X1 - 30)} y={yA + RULER_H + 16} textAnchor="middle" fontSize={13} fontWeight={800} fill={INK} aria-hidden="true">{fmtYear(toHist(year), ax.plain)}</text>
          <g aria-hidden="true" fontSize={12} fontWeight={700} fill={SOFT}>
            <rect x={X0} y={yA + RULER_H + 26} width={14} height={12} rx={4} fill={ACCENT} stroke="#1F4E85" strokeWidth={1.25} />
            <text x={X0 + 20} y={yA + RULER_H + 36}>running in the line&apos;s year</text>
            <rect x={X0 + 178} y={yA + RULER_H + 26} width={14} height={12} rx={4} fill="#EEF2F6" stroke="#94A3B8" strokeWidth={1.25} />
            <text x={X0 + 198} y={yA + RULER_H + 36}>not running</text>
          </g>
        </svg>
        <figcaption className={CAP}>Drag the line along the ruler. Bars it crosses light up.</figcaption>
      </figure>
      <p className="tl-kbd hidden text-[12px] text-ss-slate">The left and right arrow keys move the line. Shift moves it faster.</p>
      <Verdict marked={marked} lines={lines} />
    </div>
  )
}

export function TimelineView(props: Props) {
  const { config } = props
  return config.task === 'place' ? <Place {...props} config={config} /> : <Overlap {...props} config={config} />
}
