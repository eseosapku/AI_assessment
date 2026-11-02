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

// The scene's own inks: flat solid colours. Fills carry the card's ink text at over 4.5:1 in both themes.
const PALETTE =
  '[--tl-lane:#CBD5E1] [--tl-on:#FFFFFF] [--tl-a:#CFE0FF] [--tl-b:#FBE3BC] [--tl-pale:#EEF1F5] [--tl-bar:#1D4ED8] [--tl-good:#15803D] [--tl-bad:#B91C1C] ' +
  'dark:[--tl-lane:#3B4856] dark:[--tl-on:#0B1220] dark:[--tl-a:#1E3A8A] dark:[--tl-b:#7A4A0A] dark:[--tl-pale:#1F2933] dark:[--tl-bar:#93C5FD] dark:[--tl-good:#86EFAC] dark:[--tl-bad:#FCA5A5]'
const INK = 'var(--ss-ink, #16202A)'
const PANEL = 'var(--ss-panel, #FFFFFF)'
const LINE = 'var(--ss-line, #C9D1D9)'
const SLATE = 'var(--ss-slate, #5B6B7B)'

export const W = 360
export const X0 = 28
export const X1 = 332
export const LANE_H = 58
export const TOP = 6
export const DISC_R = 17
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
    <div className="max-w-[340px] text-center text-[13px] font-extrabold leading-snug text-ss-ink">
      {lines.map((l, i) => <p key={i}>{l}</p>)}
    </div>
  )
}

function AxisLines({ ax, y }: { ax: Axis; y: number }) {
  return (
    <g aria-hidden="true">
      {ax.ticks.map((t) => <line key={`g${t}`} x1={xOf(t, ax)} x2={xOf(t, ax)} y1={TOP} y2={y} stroke={LINE} strokeWidth={1} />)}
      <line x1={X0} x2={X1} y1={y} y2={y} stroke={INK} strokeWidth={2.5} />
      {ax.ticks.map((t) => {
        const x = xOf(t, ax)
        const anchor = x < X0 + 26 ? 'start' : x > X1 - 26 ? 'end' : 'middle'
        return (
          <g key={t}>
            <line x1={x} x2={x} y1={y} y2={y + 7} stroke={INK} strokeWidth={2} />
            <text x={x} y={y + 24} textAnchor={anchor} fontSize={12} fontWeight={700} fill={INK}>{fmtYear(toHist(t), ax.plain)}</text>
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

/** The arrows on a disc: it slides left and right. */
function Grip({ x, y, color }: { x: number; y: number; color: string }) {
  return <path d={`M ${x - 6} ${y} L ${x - 2} ${y - 4} M ${x - 6} ${y} L ${x - 2} ${y + 4} M ${x + 6} ${y} L ${x + 2} ${y - 4} M ${x + 6} ${y} L ${x + 2} ${y + 4}`} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" aria-hidden="true" />
}

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

  const H = yA + 34 + 28 + 6
  return (
    <div className={`nodrag flex flex-col items-center gap-2 ${PALETTE} [&:has(:focus-visible)_.tl-kbd]:block`}>
      <svg
        ref={svg}
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        className="touch-none select-none"
        style={{ maxWidth: '100%', height: 'auto' }}
        role="group"
        aria-label={`A timeline of ${items.length} items, each in its own lane, on a scale of ${yearsText(ax.span)}`}
        onPointerMove={(e: PointerEvent) => { if (drag) { const v = yearAt(e.clientX); if (v !== null) put(drag, v) } }}
        onPointerUp={() => setDrag(null)}
        onPointerCancel={() => setDrag(null)}
      >
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
              <line x1={X0} x2={X1} y1={ty} y2={ty} stroke="var(--tl-lane)" strokeWidth={10} strokeLinecap="round" aria-hidden="true" />
              <text x={X0 - 12} y={top + NAME_DY} fontSize={16} fontWeight={800} fill={INK} stroke={PANEL} strokeWidth={4} paintOrder="stroke" strokeLinejoin="round" aria-hidden="true">{it.name}</text>
              <text x={X1 + 4} y={top + NAME_DY} textAnchor="end" fontSize={14} fontWeight={800} fill={it.given ? INK : 'var(--tl-bar)'} aria-hidden="true">{readout}</text>
              {isSpan && a !== undefined && b !== undefined && (
                <rect x={xOf(Math.min(a, b), ax)} y={ty - 6} width={Math.abs(xOf(b, ax) - xOf(a, ax))} height={12} rx={4} fill="var(--tl-bar)" aria-hidden="true" />
              )}
              {hs.map((h) => {
                const v = pos(h)
                if (h.given) {
                  return v === undefined ? null : (
                    <g key={h.key} role="img" aria-label={`${it.name}${isSpan ? (h.part === 'start' ? ' began' : ' ended') : ''} in ${fmtYear(toHist(h.year), ax.plain)}, fixed`}>
                      <line x1={xOf(v, ax)} x2={xOf(v, ax)} y1={ty} y2={yA} stroke={INK} strokeWidth={2} />
                      <circle cx={xOf(v, ax)} cy={ty} r={11} fill={INK} />
                    </g>
                  )
                }
                const cx = xOf(v as number, ax)
                const fill = good ? 'var(--tl-good)' : wrongNow.has(h.key) ? 'var(--tl-bad)' : 'var(--tl-bar)'
                const name = `${it.name}${isSpan ? (h.part === 'start' ? ', start' : ', end') : ''}`
                return (
                  <g key={h.key}>
                    <line x1={cx} x2={cx} y1={ty} y2={yA} stroke={fill} strokeWidth={3} aria-hidden="true" />
                    {marked === 'wrong' && wrongNow.has(h.key) && (
                      <g aria-hidden="true">
                        <circle cx={xOf(h.year, ax)} cy={ty} r={8} fill={PANEL} stroke="var(--tl-good)" strokeWidth={3} />
                        <line x1={xOf(h.year, ax)} x2={xOf(h.year, ax)} y1={ty + 8} y2={yA} stroke="var(--tl-good)" strokeWidth={2} strokeDasharray="4 3" />
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
                      className={`outline-none [&:focus-visible>circle:nth-child(2)]:stroke-[color:var(--subject)] [&:focus-visible>circle:nth-child(2)]:stroke-[6] ${locked ? '' : 'cursor-grab'}`}
                    >
                      <circle cx={cx} cy={ty} r={DISC_R + 10} fill="transparent" />
                      <circle cx={cx} cy={ty} r={DISC_R} fill={fill} stroke={PANEL} strokeWidth={3} />
                      <Grip x={cx} y={ty} color="var(--tl-on)" />
                    </g>
                  </g>
                )
              })}
            </g>
          )
        })}
        {/* the gaps their placements leave, drawn to the same scale as the axis */}
        <g aria-hidden="true">
          {segs.map((s, i) => {
            const x = xOf(s.a, ax)
            const w = xOf(s.b, ax) - x
            return (
              <g key={i}>
                <rect x={x} y={yA + 34} width={Math.max(w, 0)} height={28} fill={i % 2 ? 'var(--tl-b)' : 'var(--tl-a)'} />
                {w >= SEG_LABEL_MIN && <text x={x + w / 2} y={yA + 53} textAnchor="middle" fontSize={12} fontWeight={800} fill={INK}>{yearsText(s.b - s.a)}</text>}
              </g>
            )
          })}
        </g>
      </svg>
      <p className="tl-kbd hidden text-[12px] text-ss-slate">Tab to a disc, then the left and right arrow keys slide it. Shift moves it faster.</p>
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
  const ring = good ? 'var(--tl-good)' : marked === 'wrong' ? 'var(--tl-bad)' : INK
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
  const H = yA + 34 + 40
  return (
    <div className={`nodrag flex flex-col items-center gap-2 ${PALETTE} [&:has(:focus-visible)_.tl-kbd]:block`}>
      <svg
        ref={svg}
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        className="touch-none select-none"
        style={{ maxWidth: '100%', height: 'auto' }}
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
        <AxisLines ax={ax} y={yA} />
        {order.map((idx, row) => {
          const s = spans[idx] as Item & { start: number; end: number }
          const top = TOP + row * LANE_H
          const on = now.includes(idx)
          const x1 = xOf(handlesOf([s])[0].year, ax)
          const x2 = xOf(handlesOf([s])[1].year, ax)
          return (
            <g key={idx} aria-hidden="true">
              <text x={X0 - 12} y={top + NAME_DY} fontSize={16} fontWeight={800} fill={INK} stroke={PANEL} strokeWidth={4} paintOrder="stroke" strokeLinejoin="round">{s.name}</text>
              <rect
                x={x1} y={top + 28} width={Math.max(x2 - x1, 6)} height={26} rx={4}
                fill={on ? 'var(--tl-bar)' : 'var(--tl-pale)'} stroke={on ? 'var(--tl-bar)' : SLATE} strokeWidth={2}
                className="motion-safe:transition-colors motion-safe:duration-700"
              />
            </g>
          )
        })}
        {/* the year line */}
        <line x1={lx} x2={lx} y1={TOP} y2={yA} stroke={ring} strokeWidth={3} aria-hidden="true" />
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
          className={`outline-none [&:focus-visible>circle:nth-child(2)]:stroke-[color:var(--subject)] [&:focus-visible>circle:nth-child(2)]:stroke-[6] ${locked ? '' : 'cursor-grab'}`}
        >
          <circle cx={lx} cy={yA} r={DISC_R + 10} fill="transparent" />
          <circle cx={lx} cy={yA} r={DISC_R} fill={ring === INK ? 'var(--tl-bar)' : ring} stroke={PANEL} strokeWidth={3} />
          <Grip x={lx} y={yA} color="var(--tl-on)" />
        </g>
        <text x={clamp(lx, X0 + 30, X1 - 30)} y={yA + 44} textAnchor="middle" fontSize={14} fontWeight={800} fill={INK} aria-hidden="true">{fmtYear(toHist(year), ax.plain)}</text>
        <g aria-hidden="true" fontSize={12} fontWeight={700} fill={INK}>
          <rect x={X0} y={yA + 56} width={14} height={14} rx={3} fill="var(--tl-bar)" stroke="var(--tl-bar)" strokeWidth={2} />
          <text x={X0 + 20} y={yA + 68}>running in the line&apos;s year</text>
          <rect x={X0 + 178} y={yA + 56} width={14} height={14} rx={3} fill="var(--tl-pale)" stroke={SLATE} strokeWidth={2} />
          <text x={X0 + 198} y={yA + 68}>not running</text>
        </g>
      </svg>
      <p className="tl-kbd hidden text-[12px] text-ss-slate">The left and right arrow keys move the line. Shift moves it faster.</p>
      <Verdict marked={marked} lines={lines} />
    </div>
  )
}

export function TimelineView(props: Props) {
  const { config } = props
  return config.task === 'place' ? <Place {...props} config={config} /> : <Overlap {...props} config={config} />
}
