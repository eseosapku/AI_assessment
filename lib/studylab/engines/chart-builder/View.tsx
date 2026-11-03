'use client'
import { useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { SceneViewProps } from '../types'
import type { ChartConfig, ChartState, Paper } from './config'
import {
  SCALES, barWidth, check, chartBuilderEngine, colCentre, colWidth, describe, eachOf, formOf, halfAt, heightsOf, honestStarts, madeText, paperOf, pictogramOf, picHeight, squareAt, startOf, working,
} from './config'

type Props = SceneViewProps<ChartConfig, ChartState>

// A chart is not a dark subject: squared paper on a quiet light plate, as measure-shape's and bonding's panels are. The plate keeps
// its own colours in both themes, so each part keeps its contrast against it. No gradients or shadows.
const PAPER = '#FBFDFF'
const GRID = '#DCE6F1'
const GRID_MAJOR = '#BCCEE2'
const EDGE = '#C5D2E0'
const TABLE_LINE = '#CBD5E1'
const AXIS = '#1F2937'
const INK = '#16202A'
const SOFT = '#475569'
const BAR = '#4C84C8'
const BAR_EDGE = '#2F5E96'
const WARN = '#C2631A'
const GHOST = '#D9E2EC'
const FONT = 'system-ui, sans-serif'

// These agree with config.ts, which the tests prove: View.tsx may not read a config constant at load time.
export const VW = 357
export const VH = 273
export const SQ_PX = 17
export const X0_PX = 51
export const X1_PX = 340
export const BASE = 204
export const TOP = 34
export const CAP_PX = 10
export const PIC_X0_PX = 88
export const PIC_CELL_PX = 27
export const PIC_KEY_H_PX = 40
export const PIC_ROW_H_PX = 40
export const PIC_DIVIDE_PX = 310
export const NAME_Y_PX = 225
export const RULE_Y_PX = 239
export const VALUE_Y_PX = 255
export const TABLE_END_PX = 271
/** How many symbols a pictogram row has room for. */
export const PIC_SLOT_COUNT = 8

const f1 = (n: number) => (Math.round(n * 10) / 10).toString()

// ---------------------------------------------------------------------------
// The symbols of a pictogram, each drawn on a 24 by 24 box.

function Glyph({ kind, ghost }: { kind: string; ghost?: boolean }) {
  const c = (own: string) => (ghost ? GHOST : own)
  switch (kind) {
    case 'apple':
      return (
        <g>
          <path d="M12 7.5 C9.5 5.5 4 6.5 4 13 C4 18.5 8 22.5 10.5 22.5 C11.5 22.5 11.5 21.8 12 21.8 C12.5 21.8 12.5 22.5 13.5 22.5 C16 22.5 20 18.5 20 13 C20 6.5 14.5 5.5 12 7.5 Z" fill={c('#D9605A')} stroke={ghost ? 'none' : '#8E2F2A'} strokeWidth={1.2} strokeLinejoin="round" />
          {!ghost && <path d="M12 7.5 C12 5 12.8 3.5 14 2.5" fill="none" stroke="#6B4A1E" strokeWidth={1.6} strokeLinecap="round" />}
          {!ghost && <path d="M12.8 5.2 C14.2 2.6 17.2 2.6 18.6 3.6 C17.2 6.2 14.6 6.2 12.8 5.2 Z" fill="#4F9A4A" stroke="#2F6A2C" strokeWidth={0.9} />}
        </g>
      )
    case 'book':
      return (
        <g>
          <rect x={4} y={3} width={16} height={18} rx={1.8} fill={c('#2F7D6B')} stroke={ghost ? 'none' : '#1B4F43'} strokeWidth={1.2} />
          {!ghost && <rect x={4} y={3} width={3.4} height={18} rx={1.2} fill="#1B4F43" />}
          {!ghost && <rect x={9.4} y={7} width={7.6} height={4.2} rx={0.8} fill="#E8F1EE" />}
        </g>
      )
    case 'star':
      return <polygon points="12,2 14.9,8.6 22,9.3 16.6,14 18.2,21 12,17.3 5.8,21 7.4,14 2,9.3 9.1,8.6" fill={c('#E3A21A')} stroke={ghost ? 'none' : '#8A5A07'} strokeWidth={1.2} strokeLinejoin="round" />
    case 'ball':
      return (
        <g>
          <circle cx={12} cy={12} r={10} fill={ghost ? GHOST : '#FFFFFF'} stroke={ghost ? 'none' : '#334155'} strokeWidth={1.4} />
          {!ghost && <polygon points="12,8 15.8,10.8 14.4,15.2 9.6,15.2 8.2,10.8" fill="#334155" />}
          {!ghost && <path d="M12 8 V2.4 M15.8 10.8 L21 9 M14.4 15.2 L17.6 20 M9.6 15.2 L6.4 20 M8.2 10.8 L3 9" fill="none" stroke="#334155" strokeWidth={1.3} strokeLinecap="round" />}
        </g>
      )
    default:
      return (
        <g>
          <circle cx={12} cy={7} r={4.8} fill={c(BAR)} stroke={ghost ? 'none' : BAR_EDGE} strokeWidth={1.2} />
          <path d="M3.2 22.5 C3.2 15.6 7.2 13 12 13 S20.8 15.6 20.8 22.5 Z" fill={c(BAR)} stroke={ghost ? 'none' : BAR_EDGE} strokeWidth={1.2} strokeLinejoin="round" />
        </g>
      )
  }
}

/** The handle on the thing itself: a white pill with an arrow each way. */
function Grip({ at, across, round, active }: { at: { x: number; y: number }; across?: boolean; round?: boolean; active: boolean }) {
  const w = across ? 18 : 26
  const h = across ? 26 : 16
  const edge = active ? WARN : BAR_EDGE
  return (
    <g transform={`translate(${f1(at.x)} ${f1(at.y)})`} aria-hidden="true" data-grip="1">
      {round
        ? <circle r={10} fill="#FFFFFF" stroke={edge} strokeWidth={active ? 2.4 : 2} />
        : <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={8} fill="#FFFFFF" stroke={edge} strokeWidth={active ? 2.2 : 1.6} />}
      <path d={across ? 'M -1.8 -3.4 L -4.6 0 L -1.8 3.4 M 1.8 -3.4 L 4.6 0 L 1.8 3.4' : 'M -3.6 -1.2 L 0 -4.6 L 3.6 -1.2 M -3.6 1.2 L 0 4.6 L 3.6 1.2'} fill="none" stroke={INK} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  )
}

// ---------------------------------------------------------------------------
// The squared paper, with its axis and the table of names and numbers under it.

function Plate({ config, paper, wrong, active, handles, reduced, uid }: {
  config: ChartConfig; paper: Paper; wrong: Set<number>; active: number | null; handles: boolean; reduced: boolean; uid: string
}) {
  const n = config.data.length
  const colW = colWidth(n)
  const bw = barWidth(n)
  const line = formOf(config) === 'line' && config.task === 'build'
  const ease = reduced || config.task === 'build' ? undefined : { transition: 'y 700ms ease, height 700ms ease' }
  const hGrid = Array.from({ length: BASE / SQ_PX + 1 }, (_, k) => k * SQ_PX)
  const vGrid = Array.from({ length: VW / SQ_PX + 1 }, (_, j) => j * SQ_PX)
  const major = (v: number, origin: number) => Math.round((v - origin) / SQ_PX) % 5 === 0
  const px = (squares: number) => Math.min(squares, CAP_PX) * SQ_PX
  const points = paper.heights.map((h, i) => ({ x: colCentre(n, i), y: BASE - px(Math.max(0, h)) }))
  return (
    <>
      <defs>
        <clipPath id={`${uid}c`}><rect x={0.75} y={0.75} width={VW - 1.5} height={VH - 1.5} rx={16} /></clipPath>
      </defs>
      <g clipPath={`url(#${uid}c)`}>
        <rect x={0} y={0} width={VW} height={VH} fill={PAPER} />
        <path d={hGrid.filter((y) => !major(y, BASE)).map((y) => `M0 ${y}H${VW}`).join('')} stroke={GRID} strokeWidth={1} fill="none" />
        <path d={vGrid.filter((x) => !major(x, X0_PX)).map((x) => `M${x} 0V${BASE}`).join('')} stroke={GRID} strokeWidth={1} fill="none" />
        <path d={hGrid.filter((y) => major(y, BASE)).map((y) => `M0 ${y}H${VW}`).join('')} stroke={GRID_MAJOR} strokeWidth={1.2} fill="none" />
        <path d={vGrid.filter((x) => major(x, X0_PX)).map((x) => `M${x} 0V${BASE}`).join('')} stroke={GRID_MAJOR} strokeWidth={1.2} fill="none" />
        <rect x={0} y={BASE} width={VW} height={VH - BASE} fill="#FFFFFF" />
      </g>
      <rect x={0.75} y={0.75} width={VW - 1.5} height={VH - 1.5} rx={16} fill="none" stroke={EDGE} strokeWidth={1.5} />

      {/* The table: a name over its number, in the column of its bar. */}
      <g stroke={TABLE_LINE} strokeWidth={1} fill="none">
        <path d={`M${X0_PX} ${RULE_Y_PX}H${X1_PX}M${X0_PX} ${TABLE_END_PX}H${X1_PX}`} />
        <path d={Array.from({ length: n + 1 }, (_, i) => `M${f1(X0_PX + colW * i)} ${BASE}V${TABLE_END_PX}`).join('')} />
      </g>
      <g fontFamily={FONT} textAnchor="middle" data-table="1">
        {config.data.map((r, i) => (
          <g key={`${r.label}-${i}`}>
            <text x={f1(colCentre(n, i))} y={NAME_Y_PX} dominantBaseline="central" fontSize={12} fontWeight={700} fill={SOFT}>{r.label}</text>
            <text x={f1(colCentre(n, i))} y={VALUE_Y_PX} dominantBaseline="central" fontSize={15} fontWeight={800} fill={INK} style={{ fontVariantNumeric: 'tabular-nums' }}>{r.value}</text>
          </g>
        ))}
      </g>

      {/* The bars, or the line and its points. */}
      {!line && paper.heights.map((h, i) => {
        const top = BASE - px(Math.max(0, h))
        const cx = colCentre(n, i)
        const hp = px(Math.max(0, h))
        const over = h > CAP_PX + 1e-9
        return (
          <g key={i} data-bar={i}>
            <rect x={f1(cx - bw / 2)} y={f1(top)} width={bw} height={f1(hp)} rx={2} fill={BAR} stroke={BAR_EDGE} strokeWidth={hp > 0 ? 1.5 : 0} style={ease} data-height={f1(h)} />
            {over && <polyline points={`${f1(cx - bw / 2 - 1)},${TOP + 14} ${f1(cx - bw / 4)},${TOP + 9} ${f1(cx)},${TOP + 19} ${f1(cx + bw / 4)},${TOP + 9} ${f1(cx + bw / 2 + 1)},${TOP + 14}`} fill="none" stroke={PAPER} strokeWidth={5} strokeLinejoin="round" data-break="1" />}
            {wrong.has(i) && <rect x={f1(cx - bw / 2 - 4)} y={f1(top - 4)} width={bw + 8} height={f1(hp + 4)} rx={4} fill="none" stroke={WARN} strokeWidth={2} strokeDasharray="5 4" data-wrong={i} />}
          </g>
        )
      })}
      {line && (
        <g data-line="1">
          <polyline points={points.map((p) => `${f1(p.x)},${f1(p.y)}`).join(' ')} fill="none" stroke={BAR} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
          {points.map((p, i) => (
            <g key={i}>
              {wrong.has(i) && <circle cx={f1(p.x)} cy={f1(p.y)} r={13.5} fill="none" stroke={WARN} strokeWidth={2} strokeDasharray="4 3.5" data-wrong={i} />}
              {!handles && <circle cx={f1(p.x)} cy={f1(p.y)} r={5} fill="#FFFFFF" stroke={BAR_EDGE} strokeWidth={2.2} />}
            </g>
          ))}
        </g>
      )}

      {/* The ruler line from the active bar back to the scale, so the axis can be read against it. */}
      {active !== null && handles && (
        <line x1={X0_PX} x2={f1(colCentre(n, active))} y1={f1(points[active].y)} y2={f1(points[active].y)} stroke={WARN} strokeWidth={1.5} strokeDasharray="4 3" data-guide="1" />
      )}

      {/* The axes, with a number at every second square. */}
      <g stroke={AXIS} strokeWidth={2} strokeLinecap="square" fill="none">
        <path d={`M${X0_PX} ${TOP - 10}V${BASE}H${X1_PX + 6}`} />
      </g>
      <g stroke={AXIS} strokeWidth={1.6} fill="none">
        {paper.labels.map((_, j) => <path key={j} d={`M${X0_PX - 5} ${BASE - j * 2 * SQ_PX}H${X0_PX}`} />)}
      </g>
      <g fontFamily={FONT} fontSize={12} fontWeight={700} fill={SOFT} textAnchor="end" aria-hidden="true">
        {paper.labels.map((v, j) => (
          <text key={j} x={X0_PX - 9} y={BASE - j * 2 * SQ_PX} dominantBaseline="central" stroke={PAPER} strokeWidth={3} paintOrder="stroke" strokeLinejoin="round" data-tick={v}>{v}</text>
        ))}
      </g>
      {config.unit && <text x={8} y={18} fontFamily={FONT} fontSize={12} fontWeight={700} fill={SOFT} aria-hidden="true">{config.unit}</text>}

      {handles && points.map((p, i) => <Grip key={i} at={{ x: p.x, y: line ? p.y : Math.min(BASE - 9, p.y) }} round={line} active={active === i} />)}
    </>
  )
}

// ---------------------------------------------------------------------------
// A pictogram: a key, then a row of pictures for each name, with its number at the end.

function PicPlate({ config, halves, wrong, active, handles, uid }: {
  config: ChartConfig; halves: number[]; wrong: Set<number>; active: number | null; handles: boolean; uid: string
}) {
  const n = config.data.length
  const h = picHeight(n)
  const key = pictogramOf(config, { v: halves }).key
  const slots = Array.from({ length: PIC_SLOT_COUNT }, (_, k) => k)
  return (
    <>
      <defs>
        <clipPath id={`${uid}c`}><rect x={0.75} y={0.75} width={VW - 1.5} height={h - 1.5} rx={16} /></clipPath>
        <clipPath id={`${uid}h`}><rect x={0} y={0} width={12} height={24} /></clipPath>
      </defs>
      <g clipPath={`url(#${uid}c)`}>
        <rect x={0} y={0} width={VW} height={h} fill="#FFFFFF" />
      </g>
      <rect x={0.75} y={0.75} width={VW - 1.5} height={h - 1.5} rx={16} fill="none" stroke={EDGE} strokeWidth={1.5} />
      <g stroke={TABLE_LINE} strokeWidth={1} fill="none">
        {Array.from({ length: n + 1 }, (_, i) => <path key={i} d={`M10 ${PIC_KEY_H_PX + PIC_ROW_H_PX * i}H${VW - 10}`} />)}
        <path d={`M${PIC_DIVIDE_PX} ${PIC_KEY_H_PX}V${PIC_KEY_H_PX + PIC_ROW_H_PX * n}`} />
      </g>
      {/* The key: one symbol, and what it stands for. */}
      <g fontFamily={FONT} data-key="1">
        <text x={12} y={21} dominantBaseline="central" fontSize={12} fontWeight={700} fill={SOFT}>Key</text>
        <g transform="translate(46 8)"><Glyph kind={config.symbol} /></g>
        <text x={78} y={21} dominantBaseline="central" fontSize={13} fontWeight={700} fill={INK}>{`= ${key}${config.unit ? ` ${config.unit}` : ''}`}</text>
      </g>
      {config.data.map((r, i) => {
        const y0 = PIC_KEY_H_PX + PIC_ROW_H_PX * i
        const whole = Math.floor(halves[i] / 2)
        const half = halves[i] % 2 === 1
        const edge = PIC_X0_PX + (halves[i] * PIC_CELL_PX) / 2
        return (
          <g key={`${r.label}-${i}`} data-row={i}>
            <text x={12} y={y0 + 21} dominantBaseline="central" fontFamily={FONT} fontSize={13} fontWeight={700} fill={INK}>{r.label}</text>
            {slots.map((k) => (
              <g key={k} transform={`translate(${PIC_X0_PX + k * PIC_CELL_PX + 1.5} ${y0 + 8})`}>
                <Glyph kind={config.symbol} ghost />
                {k < whole && <Glyph kind={config.symbol} />}
                {k === whole && half && <g clipPath={`url(#${uid}h)`}><Glyph kind={config.symbol} /></g>}
              </g>
            ))}
            <text x={(PIC_DIVIDE_PX + VW - 10) / 2} y={y0 + 21} textAnchor="middle" dominantBaseline="central" fontFamily={FONT} fontSize={15} fontWeight={800} fill={INK} style={{ fontVariantNumeric: 'tabular-nums' }}>{r.value}</text>
            {wrong.has(i) && <rect x={PIC_X0_PX - 4} y={y0 + 4} width={Math.max(8, edge - PIC_X0_PX + 8)} height={PIC_ROW_H_PX - 8} rx={6} fill="none" stroke={WARN} strokeWidth={2} strokeDasharray="5 4" data-wrong={i} />}
            {handles && <Grip at={{ x: edge + 10, y: y0 + PIC_ROW_H_PX / 2 }} across active={active === i} />}
          </g>
        )
      })}
      {active !== null && handles && (
        <line x1={PIC_X0_PX + (halves[active] * PIC_CELL_PX) / 2} x2={PIC_X0_PX + (halves[active] * PIC_CELL_PX) / 2} y1={PIC_KEY_H_PX + PIC_ROW_H_PX * active + 4} y2={PIC_KEY_H_PX + PIC_ROW_H_PX * active + PIC_ROW_H_PX - 4} stroke={WARN} strokeWidth={1.5} data-guide="1" />
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// The quiet control: a label, then minus, the value, plus (atom's stepper row).

function Stepper({ label, value, text, canDown, canUp, onDown, onUp, downLabel, upLabel, locked }: {
  label: string; value: number; text: string; canDown: boolean; canUp: boolean; onDown(): void; onUp(): void; downLabel: string; upLabel: string; locked: boolean
}) {
  const id = useId()
  const button = 'nodrag flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-lg border-2 border-ss-line bg-ss-panel text-[16px] font-extrabold leading-none text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'
  const onKey = (e: KeyboardEvent) => {
    const up = e.key === 'ArrowUp' || e.key === 'ArrowRight' || e.key === '+' || e.key === '='
    const down = e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === '-'
    if (!up && !down) return
    // The board moves a selected card with the arrows; here they step the value.
    e.preventDefault()
    e.stopPropagation()
    if (locked) return
    if (up && canUp) onUp()
    if (down && canDown) onDown()
  }
  return (
    <div className="flex items-center justify-between gap-1.5">
      <span id={id} className="text-[12px] font-bold text-ss-slate">{label}</span>
      <span className="flex items-center gap-1">
        <button type="button" tabIndex={-1} aria-label={downLabel} className={button} disabled={locked || !canDown} onClick={onDown}>−</button>
        <span
          role="spinbutton" tabIndex={locked ? -1 : 0} aria-labelledby={id} aria-valuenow={value} aria-valuetext={text} aria-disabled={locked || undefined} onKeyDown={onKey}
          className="nodrag min-w-[52px] rounded-md px-0.5 text-center text-[15px] font-extrabold tabular-nums text-ss-ink outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--subject)]"
          data-value={value}
        >{text}</span>
        <button type="button" tabIndex={-1} aria-label={upLabel} className={button} disabled={locked || !canUp} onClick={onUp}>+</button>
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------

export function ChartBuilderView({ config, state, setState, marked, reduced, locked }: Props) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const wrap = useRef<HTMLDivElement>(null)
  const drag = useRef<{ i: number; grab: number } | null>(null)
  const [active, setActive] = useState<number | null>(null)
  const finished = marked === 'right' || marked === 'shown'
  const now = marked === 'shown' ? chartBuilderEngine.solve(config) : state
  const n = config.data.length
  const kind = config.task === 'build' ? (formOf(config) === 'line' ? 'line' : formOf(config) === 'pictogram' ? 'pictogram' : 'bar') : 'bar'
  const canDrag = config.task === 'build' && !locked && !finished
  const paper = paperOf(config, now)
  const halves = heightsOf(config, now)
  const wrong = new Set<number>(marked === 'wrong' && config.task === 'build' ? check(config, now).wrongIds.map(Number) : [])
  const height = kind === 'pictogram' ? picHeight(n) : VH

  const put = (i: number, to: number) => {
    const cur = heightsOf(config, now)
    if (cur[i] === to) return
    const next = cur.slice()
    next[i] = to
    setState({ v: next })
  }
  /** Where a pointer is on the plate, in the plate's own units. */
  const at = (e: PointerEvent): { x: number; y: number } => {
    const r = wrap.current?.getBoundingClientRect()
    if (!r || !r.width || !r.height) return { x: 0, y: 0 }
    return { x: ((e.clientX - r.left) * VW) / r.width, y: ((e.clientY - r.top) * height) / r.height }
  }
  const handleAt = (i: number) => (kind === 'pictogram' ? PIC_X0_PX + (halves[i] * PIC_CELL_PX) / 2 + 10 : kind === 'line' ? BASE - Math.min(halves[i], CAP_PX) * SQ_PX : Math.min(BASE - 9, BASE - Math.min(halves[i], CAP_PX) * SQ_PX))
  const apply = (i: number, p: { x: number; y: number }, grab: number) => {
    if (kind === 'pictogram') put(i, halfAt(p.x - grab - 10))
    else put(i, squareAt(p.y - grab))
  }
  const down = (i: number) => (e: PointerEvent<HTMLDivElement>) => {
    if (!canDrag) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    const p = at(e)
    const here = handleAt(i)
    const along = kind === 'pictogram' ? p.x : p.y
    // Held by the handle, the bar keeps the same offset from the pointer; the handle of an empty bar sits just above the axis, so the offset is from the bar's true top.
    const trueTop = kind === 'pictogram' ? here : BASE - Math.min(halves[i], CAP_PX) * SQ_PX
    const grab = Math.abs(along - here) <= 14 ? along - trueTop : 0
    drag.current = { i, grab }
    setActive(i)
    apply(i, p, grab)
  }
  const move = (i: number) => (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.i === i) apply(i, at(e), drag.current.grab)
  }
  const up = () => {
    drag.current = null
  }
  const keys = (i: number) => (e: KeyboardEvent) => {
    const by = ({ ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 5, PageDown: -5 } as Record<string, number>)[e.key]
    if (by === undefined && e.key !== 'Home' && e.key !== 'End') return
    // The board moves a selected card with the arrows; here they move the bar.
    e.preventDefault()
    e.stopPropagation()
    if (!canDrag) return
    const cap = kind === 'pictogram' ? 16 : CAP_PX
    const cur = halves[i]
    put(i, e.key === 'Home' ? 0 : e.key === 'End' ? cap : Math.max(0, Math.min(cap, cur + by)))
  }

  const said = finished ? working(config, now) : marked === 'wrong' ? madeText(config, now) : ''
  const lead = said.match(/^(Yes\. [^.]*\.)\s*(.*)$/)
  const caption = config.title || (config.task === 'build' ? (kind === 'line' ? 'Line graph of the table' : kind === 'pictogram' ? 'Pictogram of the table' : 'Bar chart of the table') : 'Bar chart of the table')
  const raised = halves.filter((v) => v > 0).length

  const col = (i: number) => {
    const label = config.data[i].label
    const v = halves[i]
    const rowStyle = { left: 0, width: '100%', top: `${((PIC_KEY_H_PX + PIC_ROW_H_PX * i) / height) * 100}%`, height: `${(PIC_ROW_H_PX / height) * 100}%` }
    const colStyle = { left: `${((X0_PX + colWidth(n) * i) / VW) * 100}%`, width: `${(colWidth(n) / VW) * 100}%`, top: `${((TOP - 14) / height) * 100}%`, height: `${((BASE - TOP + 28) / height) * 100}%` }
    return (
      <div
        key={i} role="slider" tabIndex={locked || finished ? -1 : 0} aria-label={`${label} ${kind === 'line' ? 'point' : kind === 'pictogram' ? 'row' : 'bar'}`}
        aria-orientation={kind === 'pictogram' ? 'horizontal' : 'vertical'} aria-valuemin={0} aria-valuemax={kind === 'pictogram' ? 16 : CAP_PX} aria-valuenow={v}
        aria-valuetext={kind === 'pictogram' ? `${v / 2} symbols` : `${v} ${v === 1 ? 'square' : 'squares'} up`} aria-disabled={!canDrag || undefined}
        onPointerDown={down(i)} onPointerMove={move(i)} onPointerUp={up} onPointerCancel={up} onKeyDown={keys(i)}
        onFocus={() => setActive(i)} onBlur={() => setActive((a) => (a === i ? null : a))}
        className={`nodrag absolute touch-none rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--subject)] ${canDrag ? (kind === 'pictogram' ? 'cursor-ew-resize' : 'cursor-ns-resize') : ''}`}
        style={kind === 'pictogram' ? rowStyle : colStyle}
        data-slider={i}
      />
    )
  }

  const steps = config.task === 'scale' ? [...SCALES] : honestStarts(config.data.map((r) => r.value))
  const stepNow = config.task === 'scale' ? eachOf(config, now) : startOf(config, now)
  const at_ = steps.indexOf(stepNow)

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-2 [&:has([role=slider]:focus-visible)_.cb-kbd]:block">
      <figure className="m-0 flex w-full flex-col gap-1.5">
        <div ref={wrap} className="relative w-full">
          <svg viewBox={`0 0 ${VW} ${height}`} role="img" aria-label={describe(config)} className="block h-auto w-full select-none">
            {kind === 'pictogram'
              ? <PicPlate config={config} halves={halves} wrong={wrong} active={active} handles={canDrag} uid={uid} />
              : <Plate config={config} paper={paper} wrong={wrong} active={active} handles={canDrag} reduced={reduced} uid={uid} />}
          </svg>
          {config.task === 'build' && config.data.map((_, i) => col(i))}
        </div>
        <figcaption className="text-center text-[12px] font-bold text-ss-slate" aria-hidden="true">{caption}</figcaption>
      </figure>

      {config.task === 'scale' && (
        <Stepper
          label="Each square is worth" value={stepNow} text={String(stepNow)} locked={locked || finished} canDown={at_ > 0} canUp={at_ >= 0 && at_ < steps.length - 1}
          onDown={() => setState({ each: steps[at_ - 1] })} onUp={() => setState({ each: steps[at_ + 1] })} downLabel="Make each square worth less" upLabel="Make each square worth more"
        />
      )}
      {config.task === 'honest' && (
        <Stepper
          label="The axis starts at" value={stepNow} text={String(stepNow)} locked={locked || finished} canDown={at_ > 0} canUp={at_ >= 0 && at_ < steps.length - 1}
          onDown={() => setState({ start: steps[at_ - 1] })} onUp={() => setState({ start: steps[at_ + 1] })} downLabel="Start the axis lower" upLabel="Start the axis higher"
        />
      )}

      <p className="cb-kbd hidden text-[12px] font-semibold text-ss-slate">Tab moves between bars. The arrow keys move the one in the ring.</p>
      <span className="sr-only" aria-live="polite">{config.task === 'build' ? `${raised} of ${n} raised.` : config.task === 'scale' ? `Each square is worth ${stepNow}.` : `The axis starts at ${stepNow}.`}</span>
      {marked !== 'idle' && said && (
        <div className="rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2">
          <p className="text-[13px] font-extrabold leading-snug text-ss-ink">{lead ? lead[1] : said}</p>
          {lead && lead[2] && <p className="mt-0.5 text-[12px] font-semibold leading-snug text-ss-slate">{lead[2]}</p>}
        </div>
      )}
    </div>
  )
}
