'use client'
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { SceneViewProps } from '../types'
import type { ArraysConfig, ArraysState, BuildConfig, BuildState, ShareConfig, ShareState } from './config'
import { buildDrawable, madeBuild, madeShare, pileLeft, plural, rightBuild, shareDrawable, shareSentence, wrongBuild } from './config'

type Props = SceneViewProps<ArraysConfig, ArraysState>

// A quiet light panel in both themes: cookies, a metal tray and white plates, one accent (the handle).
const PANEL = '#F8FAFC'
const INK = '#243447'
const SOFT = '#64748B'
const TRAY = '#CBD5E1'
const TRAY_EDGE = '#94A3B8'
const TRAY_IN = '#E8EDF3'
const COOKIE = '#D9A55B'
const COOKIE_EDGE = '#A9742E'
const CHIP = '#6B4226'
const PLATE_RIM = '#D5DDE6'
const PLATE_IN = '#FFFFFF'
const BOARD = '#EADFC9'
const BOARD_EDGE = '#C9B48B'
const ACCENT = '#2F6FA8'
const FONT = 'system-ui, sans-serif'

// Literal geometry: config.ts imports this file, so its constants are not ready at load. Tests check these against config.
export const W = 360
export const CELL = 23
export const AX = 40
export const AY = 40
export const MAXS = 10
/** The panel grows with the tray, so a small tray is not lost in a large empty panel. */
export const buildHeight = (rows: number) => Math.max(190, 40 + rows * 23 + 5 + 22)
export const PLATE_R = 40
export const MAX_ON_PLATE = 9
export const SPIN_MS = 750

/** Where each cookie sits on a plate, so up to nine fit inside the rim and none touch. */
export function platePoint(i: number, n: number, cx: number, cy: number) {
  const rowsN = Math.ceil(n / 3)
  return { x: cx + ((i % 3) - 1) * 17, y: cy + (Math.floor(i / 3) - (rowsN - 1) / 2) * 17 }
}
/** The plates' centres: one row for up to three plates, otherwise two rows. */
export function platePositions(k: number) {
  const perRow = k <= 3 ? k : Math.ceil(k / 2)
  const two = k > 3
  return Array.from({ length: k }, (_, i) => {
    const row = Math.floor(i / perRow)
    const inRow = row === 0 ? Math.min(perRow, k) : k - perRow
    const col = i % perRow
    return { cx: ((col + 0.5) * W) / inRow + (row === 1 && inRow < perRow ? 0 : 0), cy: two ? 52 + row * 104 : 60 }
  })
}
export function shareHeight(k: number) {
  const lastCy = k > 3 ? 156 : 60
  return lastCy + 55 + 26 + 8 + 56 + 12
}

const style = `@keyframes ma-pop{from{opacity:0;transform:scale(.4)}to{opacity:1;transform:scale(1)}}
.ma-pop{transform-box:fill-box;transform-origin:center;animation:ma-pop 380ms ease-out both}
@media (prefers-reduced-motion: reduce){.ma-pop{animation:none}}`

function Cookie({ x, y, r = 9, pop, delay = 0 }: { x: number; y: number; r?: number; pop?: boolean; delay?: number }) {
  const s = r / 9
  return (
    <g transform={`translate(${x} ${y})`} pointerEvents="none">
      <g className={pop ? 'ma-pop' : undefined} style={pop ? { animationDelay: `${delay}ms` } : undefined}>
        <circle r={r} fill={COOKIE} stroke={COOKIE_EDGE} strokeWidth={1} />
        <circle cx={-3 * s} cy={-2.5 * s} r={1.3 * s} fill={CHIP} />
        <circle cx={2.8 * s} cy={-3 * s} r={1.1 * s} fill={CHIP} />
        <circle cx={0.4 * s} cy={2.8 * s} r={1.3 * s} fill={CHIP} />
        <circle cx={4 * s} cy={2 * s} r={0.9 * s} fill={CHIP} />
      </g>
    </g>
  )
}

const btn = 'nodrag flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-lg border-2 border-ss-line bg-ss-panel text-[16px] font-extrabold leading-none text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'
const wide = 'nodrag flex h-8 shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border-2 border-ss-line bg-ss-panel px-3 text-[12px] font-bold text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'

function Stepper({ label, noun, value, min, max, set, locked }: { label: string; noun: string; value: number; min: number; max: number; set: (n: number) => void; locked: boolean }) {
  const key = (e: KeyboardEvent) => {
    const by = ({ ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, '+': 1, '=': 1, '-': -1 } as Record<string, number>)[e.key]
    if (by === undefined) return
    e.preventDefault()
    e.stopPropagation()
    set(Math.max(min, Math.min(max, value + by)))
  }
  return (
    <div className="flex items-center justify-between gap-1.5">
      <span className="text-[12px] font-bold text-ss-slate">{label}</span>
      <span className="flex items-center gap-1">
        <button type="button" aria-label={`Take away a ${noun}`} className={btn} disabled={locked || value <= min} onClick={() => set(value - 1)}>−</button>
        <span role="spinbutton" tabIndex={locked ? -1 : 0} aria-label={label} aria-valuenow={value} aria-valuemin={min} aria-valuemax={max} aria-valuetext={plural(value, noun)}
          onKeyDown={key} className="nodrag min-w-[26px] rounded-md px-0.5 text-center text-[15px] font-extrabold tabular-nums text-ss-ink outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--subject)]">{value}</span>
        <button type="button" aria-label={`Add a ${noun}`} className={btn} disabled={locked || value >= max} onClick={() => set(value + 1)}>+</button>
      </span>
    </div>
  )
}

function BuildView({ config, state: raw, setState, marked, reduced, locked }: SceneViewProps<BuildConfig, BuildState>) {
  const { rows, cols } = buildDrawable(raw)
  const [spinning, setSpinning] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const dragging = useRef(false)
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const put = (next: Partial<BuildState>) => { if (!locked && !spinning) setState({ rows, cols, ...next }) }
  const turn = () => {
    if (locked || spinning) return
    if (reduced) { setState({ rows: cols, cols: rows }); return }
    setSpinning(true)
    timer.current = setTimeout(() => { setSpinning(false); setState({ rows: cols, cols: rows }) }, SPIN_MS)
  }
  const fromPointer = (e: PointerEvent) => {
    const svg = svgRef.current
    if (!svg) return
    const box = svg.getBoundingClientRect()
    const k = box.width / W
    const x = (e.clientX - box.left) / k
    const y = (e.clientY - box.top) / k
    put({ cols: Math.max(1, Math.min(MAXS, Math.round((x - AX - 5) / CELL))), rows: Math.max(1, Math.min(MAXS, Math.round((y - AY - 5) / CELL))) })
  }

  const total = rows * cols
  const H = buildHeight(spinning ? Math.max(rows, cols) : rows)
  const trayW = cols * CELL
  const trayH = rows * CELL
  const message = marked === 'right' || marked === 'shown' ? rightBuild(config) : marked === 'wrong' ? wrongBuild(config, { rows, cols }) : null
  const live = spinning ? 'Turning the tray a quarter turn.' : `${plural(rows, 'row')} of ${cols}, ${plural(total, 'cookie')} in all.`
  const sr = `A baking tray with ${plural(rows, 'row')} of ${plural(cols, 'cookie')}.`

  const grid = Array.from({ length: rows * cols }, (_, i) => ({ r: Math.floor(i / cols), c: i % cols }))
  const group = (
    <>
      <rect x={-5} y={-5} width={trayW + 10} height={trayH + 10} rx={9} fill={TRAY} stroke={TRAY_EDGE} strokeWidth={1.5} />
      <rect x={-1} y={-1} width={trayW + 2} height={trayH + 2} rx={6} fill={TRAY_IN} />
      {grid.map(({ r, c }) => <Cookie key={`${r}-${c}`} x={c * CELL + CELL / 2} y={r * CELL + CELL / 2} r={9.7} />)}
    </>
  )
  const sx = AX + trayW + 5
  const sy = AY + trayH + 5
  return (
    <div className="nodrag flex flex-col gap-2.5">
      <style>{style}</style>
      <figure className="m-0 flex flex-col gap-1.5">
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full touch-none select-none rounded-2xl border border-ss-line" role="img" aria-label={sr}
          onPointerMove={(e) => { if (dragging.current) fromPointer(e) }} onPointerUp={() => { dragging.current = false }} onPointerCancel={() => { dragging.current = false }}>
          <rect width={W} height={H} fill={PANEL} />
          {!spinning && Array.from({ length: cols }, (_, c) => (
            <text key={`c${c}`} x={AX + c * CELL + CELL / 2} y={AY - 13} textAnchor="middle" fontSize={12} fontWeight={600} fill={SOFT} fontFamily={FONT}>{c + 1}</text>
          ))}
          {!spinning && Array.from({ length: rows }, (_, r) => (
            <text key={`r${r}`} x={AX - 13} y={AY + r * CELL + CELL / 2 + 4} textAnchor="end" fontSize={12} fontWeight={600} fill={SOFT} fontFamily={FONT}>{r + 1}</text>
          ))}
          <g style={{
            transform: spinning ? `translate(${AX + trayH}px, ${AY}px) rotate(90deg)` : `translate(${AX}px, ${AY}px) rotate(0deg)`,
            transformOrigin: '0 0', transition: spinning && !reduced ? `transform ${SPIN_MS}ms cubic-bezier(.4,0,.2,1)` : 'none',
          }}>{group}</g>
          {!spinning && !locked && (
            <g aria-hidden="true" transform={`translate(${sx} ${sy})`} className="cursor-nwse-resize" style={{ touchAction: 'none' }}
              onPointerDown={(e) => { dragging.current = true; (e.target as Element).setPointerCapture?.(e.pointerId); e.preventDefault() }}>
              <circle r={17} fill="transparent" />
              <circle r={10} fill={ACCENT} stroke="#FFFFFF" strokeWidth={2} />
              <path d="M -3.2 -3.2 L 3.2 3.2 M 3.2 3.2 H 0.2 M 3.2 3.2 V 0.2 M -3.2 -3.2 H -0.2 M -3.2 -3.2 V -0.2" stroke="#FFFFFF" strokeWidth={1.5} fill="none" strokeLinecap="round" />
            </g>
          )}
        </svg>
        <figcaption className="text-[12px] font-bold text-ss-slate">Drag the round handle to resize the tray.</figcaption>
      </figure>
      <div className="flex flex-col gap-1.5">
        <Stepper label="Rows" noun="row" value={rows} min={1} max={MAXS} set={(n) => put({ rows: n })} locked={locked} />
        <Stepper label="In each row" noun="cookie in each row" value={cols} min={1} max={MAXS} set={(n) => put({ cols: n })} locked={locked} />
      </div>
      <div className="flex items-center justify-between gap-2">
        <button type="button" aria-label="Turn the tray a quarter turn" className={wide} disabled={locked || spinning} onClick={turn}>
          <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true"><path d="M13 8a5 5 0 1 1-1.8-3.8M13 2v3.2H9.8" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></svg>
          Turn
        </button>
        <p className="m-0 text-right text-[15px] font-extrabold tabular-nums text-ss-ink" aria-live="polite">{live}</p>
      </div>
      <div aria-live="polite">
        {message && <p className="m-0 rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2 text-[13px] font-extrabold leading-snug text-ss-ink">{message}</p>}
      </div>
    </div>
  )
}

function ShareView({ config, state: raw, setState, marked, reduced, locked }: SceneViewProps<ShareConfig, ShareState>) {
  const state = shareDrawable(config, raw)
  const left = pileLeft(config, state)
  const k = config.plates
  const pos = platePositions(k)
  const H = shareHeight(k)
  const lastCy = pos[pos.length - 1].cy
  const labelY = lastCy + 55
  const boardY = labelY + 26 + 8
  const set = (given: number[]) => { if (!locked) setState({ given }) }
  const give = (i: number) => { if (left > 0 && state.given[i] < MAX_ON_PLATE) set(state.given.map((g, j) => (j === i ? g + 1 : g))) }
  const take = (i: number) => { if (state.given[i] > 0) set(state.given.map((g, j) => (j === i ? g - 1 : g))) }
  const canRound = !locked && left >= k && state.given.every((g) => g < MAX_ON_PLATE)
  const message = marked === 'right' || marked === 'shown' ? shareSentence(config) : marked === 'wrong' ? madeShare(config, state) : null
  const keyGive = (i: number) => (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); give(i) } }
  const sr = `${k} plates holding ${state.given.join(', ')} cookies, and ${left} cookies in the pile.`
  return (
    <div className="nodrag flex flex-col gap-2.5">
      <style>{style}</style>
      <figure className="m-0 flex flex-col gap-1.5">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full touch-none select-none rounded-2xl border border-ss-line" role="group" aria-label={sr}>
          <rect width={W} height={H} fill={PANEL} />
          {pos.map(({ cx, cy }, i) => {
            const n = state.given[i]
            return (
              <g key={i}>
                <g role="button" tabIndex={locked ? -1 : 0} aria-label={`Plate ${i + 1} has ${plural(n, 'cookie')}. Give it one more.`} aria-disabled={locked || left === 0 || undefined}
                  className={locked ? '' : 'cursor-pointer outline-none'} onClick={() => give(i)} onKeyDown={keyGive(i)}>
                  <circle cx={cx} cy={cy} r={PLATE_R} fill={PLATE_RIM} stroke={TRAY_EDGE} strokeWidth={1} />
                  <circle cx={cx} cy={cy} r={PLATE_R - 6} fill={PLATE_IN} stroke="#E2E8F0" strokeWidth={1} />
                </g>
                {Array.from({ length: n }, (_, j) => { const p = platePoint(j, n, cx, cy); return <Cookie key={j} x={p.x} y={p.y} r={7} pop={!reduced} delay={i * 140} /> })}
                <text x={cx} y={cy + PLATE_R + 15} textAnchor="middle" fontSize={13} fontWeight={800} fill={INK} fontFamily={FONT}>{n}</text>
                {n > 0 && !locked && (
                  <g role="button" tabIndex={0} aria-label={`Take a cookie back from plate ${i + 1}`} className="cursor-pointer outline-none" onClick={() => take(i)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); take(i) } }}>
                    <circle cx={cx + 33} cy={cy + 33} r={13} fill="transparent" />
                    <circle cx={cx + 33} cy={cy + 33} r={9} fill="#FFFFFF" stroke={TRAY_EDGE} strokeWidth={1.5} />
                    <path d={`M ${cx + 29} ${cy + 33} H ${cx + 37}`} stroke={INK} strokeWidth={2} strokeLinecap="round" />
                  </g>
                )}
              </g>
            )
          })}
          <text x={20} y={labelY + 26} fontSize={12} fontWeight={700} fill={SOFT} fontFamily={FONT}>Cookies left in the pile</text>
          <text x={W - 20} y={labelY + 26} textAnchor="end" fontSize={15} fontWeight={800} fill={INK} fontFamily={FONT}>{left}</text>
          <rect x={20} y={boardY} width={W - 40} height={56} rx={10} fill={BOARD} stroke={BOARD_EDGE} strokeWidth={1.5} />
          {Array.from({ length: config.total }, (_, i) => {
            const x = 20 + 19 + (i % 16) * 19.2
            const y = boardY + 17 + Math.floor(i / 16) * 23
            return i < left ? <Cookie key={i} x={x} y={y} r={8} /> : <circle key={i} cx={x} cy={y} r={7.5} fill="none" stroke={BOARD_EDGE} strokeWidth={1} strokeDasharray="2.5 2.5" />
          })}
        </svg>
        <figcaption className="text-[12px] font-bold text-ss-slate">Tap a plate to deal it one cookie. The small minus takes one back.</figcaption>
      </figure>
      <div className="flex items-center gap-2">
        <button type="button" aria-label="Deal a round: one cookie to every plate" className={wide} disabled={!canRound} onClick={() => set(state.given.map((g) => g + 1))}>Deal a round</button>
        <button type="button" aria-label="Take every cookie back to the pile" className={wide} disabled={locked || state.given.every((g) => g === 0)} onClick={() => set(state.given.map(() => 0))}>Start again</button>
      </div>
      <div aria-live="polite">
        {message && <p className="m-0 rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2 text-[13px] font-extrabold leading-snug text-ss-ink">{message}</p>}
      </div>
    </div>
  )
}

export function MultiplicationArraysView(props: Props) {
  const { config, state, ...rest } = props
  return config.task === 'build'
    ? <BuildView config={config} state={state as BuildState} {...rest} setState={rest.setState as (s: BuildState) => void} />
    : <ShareView config={config} state={state as ShareState} {...rest} setState={rest.setState as (s: ShareState) => void} />
}
