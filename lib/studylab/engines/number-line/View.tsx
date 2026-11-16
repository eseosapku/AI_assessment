'use client'
import { useEffect, useState, type KeyboardEvent, type PointerEvent, type ReactElement } from 'react'
import type { SceneViewProps } from '../types'
import type { JumpConfig, Ladder, NumberLineConfig, NumberLineState, Parts, PlaceConfig, Target, Win } from './config'
import {
  cellOf, fineText, fracParts, hopText, ladderOf, landing, lastLevel, madeText, magOf, moveTo, rangeOf, readJump, readPlace,
  readValue, signedText, sumText, targetText, tickWords, windowAt, working, zoomIn, zoomOut,
} from './config'

type Props = SceneViewProps<NumberLineConfig, NumberLineState>

// A printed number line: a quiet light plate in both themes, ink ticks, one blue accent for what the learner handles.
// Flat colours only. The plate keeps its own colours so each part keeps its contrast.
const PLATE = '#F8FAFC'
const PLATE_EDGE = '#CBD5E1'
const INK = '#1F2937'
const SOFT = '#475569'
const FONT = 'system-ui, sans-serif'
const ACCENT = '#2563A8'
const ACCENT_DARK = '#1B4C85'
const GAP = '#BCD3EC'
const FUNNEL = '#EAF2FB'
const FUNNEL_EDGE = '#8FB0D4'
const GHOST = '#B8C4D2'
const GOOD = '#2F855A'
const GOOD_DARK = '#22633F'

// Geometry (viewBox pixels). Written out here because config.ts and this file import each other (the test checks them).
export const W = 360
export const X0 = 50
export const X1 = 334
const HEAD_Y = 30
const FIRST_Y = 92
const PITCH = 82
const FUNNEL_END = 44
const OVERLAP = 16

const f1 = (n: number) => n.toFixed(1)
export const rowCount = (config: PlaceConfig) => (ladderOf(readValue(config.value) ?? readValue('3')!).steps.length)
export const placeHeight = (rows: number) => FIRST_Y + (rows - 1) * PITCH + 46

/** The tag for a label, keyed on the ink the label should use. */
function Num({ t, fine, step, x, y, fill = INK, size = 13, weight = 700 }: { t: Target; fine: number; step: number; x: number; y: number; fill?: string; size?: number; weight?: number }) {
  if (t.kind !== 'frac') {
    return <text x={f1(x)} y={f1(y)} textAnchor="middle" fontSize={size} fontWeight={weight} fill={fill}>{fineText(t, fine, step)}</text>
  }
  const p = fracParts(t, fine)
  return <Stacked p={p} x={x} y={y} fill={fill} size={size} weight={weight} />
}

/** A mixed number or fraction, the numerator over the denominator, centred on x. */
function Stacked({ p, x, y, fill, size, weight }: { p: Parts; x: number; y: number; fill: string; size: number; weight: number }) {
  const minus = p.neg && (p.w > 0 || p.n > 0)
  const ch = size * 0.58
  const wholeW = p.w > 0 || p.n === 0 ? String(p.w).length * ch : 0
  const minusW = minus ? ch + 1 : 0
  const fracW = p.n > 0 ? Math.max(String(p.n).length, String(p.d).length) * ch + 5 : 0
  const total = minusW + wholeW + (wholeW && fracW ? 3 : 0) + fracW
  let cx = x - total / 2
  const parts: ReactElement[] = []
  if (minus) {
    parts.push(wholeW
      ? <text key="m" x={f1(cx)} y={f1(y)} fontSize={size} fontWeight={weight} fill={fill}>{'−'}</text>
      : <line key="m" x1={f1(cx)} x2={f1(cx + ch)} y1={f1(y - 5)} y2={f1(y - 5)} stroke={fill} strokeWidth={1.8} strokeLinecap="round" />)
    cx += minusW
  }
  if (wholeW) {
    parts.push(<text key="w" x={f1(cx)} y={f1(y)} fontSize={size} fontWeight={weight} fill={fill}>{p.w}</text>)
    cx += wholeW + 3
  }
  if (fracW) {
    const mid = cx + fracW / 2
    parts.push(
      <g key="f">
        <text x={f1(mid)} y={f1(y - 8)} textAnchor="middle" fontSize={size - 1} fontWeight={weight} fill={fill}>{p.n}</text>
        <line x1={f1(cx)} x2={f1(cx + fracW)} y1={f1(y - 5)} y2={f1(y - 5)} stroke={fill} strokeWidth={1.4} />
        <text x={f1(mid)} y={f1(y + 8)} textAnchor="middle" fontSize={size - 1} fontWeight={weight} fill={fill}>{p.d}</text>
      </g>,
    )
  }
  return <g fontFamily={FONT}>{parts}</g>
}

const xIn = (w: { lo: number; hi: number }, f: number) => X0 + ((f - w.lo) / (w.hi - w.lo)) * (X1 - X0)

/** Which ticks of a row carry a number: the ends and the middle of a zoomed line; every few ticks on the whole line. */
export function labelled(w: Win, i: number, n: number): boolean {
  if (w.level > 0) return i === 0 || i === n || (n % 2 === 0 && i === n / 2)
  const gap = (X1 - X0) / n
  const every = [1, 2, 5, 10].find((e) => gap * e >= 36) ?? 10
  return Math.abs((w.lo / w.step) + i) % every === 0
}

function Row({ t, w, y, tag, current, cell, pinned, reduced, lowest, fresh }: {
  t: Target; w: Win; y: number; tag: string; current: boolean; cell: { a: number; b: number } | null; pinned: number | null; reduced: boolean; lowest: boolean; fresh: boolean
}) {
  const [shown, setShown] = useState(!fresh || reduced)
  useEffect(() => {
    if (shown) return
    const id = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(id)
  }, [shown])
  const n = (w.hi - w.lo) / w.step
  const ticks = Array.from({ length: n + 1 }, (_, i) => ({ i, f: w.lo + i * w.step }))
  const whole = w.level === 0
  return (
    <g style={reduced ? undefined : { opacity: shown ? 1 : 0, transition: 'opacity 600ms ease' }} data-row={w.level}>
      {cell && <rect x={f1(xIn(w, cell.a))} y={y - 5} width={f1(xIn(w, cell.b) - xIn(w, cell.a))} height={10} fill={GAP} data-gap="1" />}
      <line x1={whole ? X0 - 12 : X0} x2={whole ? X1 + 12 : X1} y1={y} y2={y} stroke={INK} strokeWidth={2} strokeLinecap="round" />
      {whole && (
        <g fill={INK}>
          <path d={`M ${X0 - 18} ${y} l 8 -4 v 8 z`} />
          <path d={`M ${X1 + 18} ${y} l -8 -4 v 8 z`} />
        </g>
      )}
      <g stroke={INK} strokeLinecap="round">
        {ticks.map(({ i, f }) => {
          const big = labelled(w, i, n)
          const end = !whole && (i === 0 || i === n)
          const h = end ? 9 : big ? 7.5 : 4.5
          return <line key={i} x1={f1(xIn(w, f))} x2={f1(xIn(w, f))} y1={y - h} y2={y + h} strokeWidth={end || (f === 0 && whole) ? 2.4 : 1.6} />
        })}
      </g>
      <g fontFamily={FONT}>
        {ticks.filter(({ i }) => labelled(w, i, n)).map(({ i, f }) => (
          <Num key={i} t={t} fine={f} step={w.step} x={xIn(w, f)} y={y - 15} fill={INK} />
        ))}
      </g>
      <text x={6} y={y + 4.5} fontSize={13} fontWeight={700} fill={SOFT} fontFamily={FONT} data-tag={tag}>{tag}</text>
      {pinned !== null && !lowest && <circle cx={f1(xIn(w, pinned))} cy={y} r={4} fill={ACCENT} stroke="#FFFFFF" strokeWidth={1.5} data-dot="1" />}
    </g>
  )
}

function Pin({ x, y, colour, edge }: { x: number; y: number; colour: string; edge: string }) {
  return (
    <g transform={`translate(${f1(x)} ${f1(y)})`} data-pin="1">
      <path d="M 0 1 C -3 7 -10 10 -10 20 A 10 10 0 1 0 10 20 C 10 10 3 7 0 1 Z" fill={colour} stroke="#FFFFFF" strokeWidth={2} strokeLinejoin="round" />
      <path d="M 0 1 C -3 7 -10 10 -10 20 A 10 10 0 1 0 10 20 C 10 10 3 7 0 1 Z" fill="none" stroke={edge} strokeWidth={1} strokeLinejoin="round" />
      <circle cx={0} cy={20} r={3.4} fill="#FFFFFF" />
    </g>
  )
}

const hasHover = 'hover:border-[color:var(--subject)]'
const BUTTON = `nodrag flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-lg border-2 border-ss-line bg-ss-panel text-[16px] font-extrabold leading-none text-ss-ink touch-manipulation transition-colors ${hasHover} disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none`

function Stepper({ label, value, down, up, downLabel, upLabel, disableDown, disableUp }: {
  label: string; value: string; down(): void; up(): void; downLabel: string; upLabel: string; disableDown: boolean; disableUp: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-1.5">
      <span className="text-[12px] font-bold text-ss-slate">{label}</span>
      <span className="flex items-center gap-1">
        <button type="button" aria-label={downLabel} className={BUTTON} disabled={disableDown} onClick={down}>{'−'}</button>
        <span className="min-w-[44px] text-center text-[15px] font-extrabold tabular-nums text-ss-ink" aria-live="polite">{value}</span>
        <button type="button" aria-label={upLabel} className={BUTTON} disabled={disableUp} onClick={up}>+</button>
      </span>
    </div>
  )
}

function Result({ said }: { said: string }) {
  const lead = said.match(/^(Yes\. .*?\.)(?:\s+(.*))?$/)
  return (
    <div className="rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2" aria-live="polite">
      <p className="text-[13px] font-extrabold leading-snug text-ss-ink">{lead ? lead[1] : said}</p>
      {lead && lead[2] && <p className="mt-0.5 text-[12px] font-semibold leading-snug text-ss-slate">{lead[2]}</p>}
    </div>
  )
}

/** Where a pointer is along an overlay that starts `from` viewBox pixels in and spans `across` of them. */
function viewX(e: PointerEvent<HTMLElement>, from: number, across: number): number {
  const r = e.currentTarget.getBoundingClientRect()
  return from + ((e.clientX - r.left) / (r.width || 1)) * across
}

const stop = (e: KeyboardEvent) => {
  e.preventDefault()
  e.stopPropagation()
}

// ---------------------------------------------------------------------------
// Place

function PlaceView({ config, state, setState, marked, reduced, locked }: SceneViewProps<PlaceConfig, NumberLineState>) {
  const t = readValue(config.value) ?? readValue('3')!
  const l: Ladder = ladderOf(t)
  const now = marked === 'shown' ? { v: t.T, lo: shownPath(config) } : readPlace(config, state)
  const w = windowAt(l, now.lo)
  const rows = l.steps.length
  const H = placeHeight(rows)
  const finished = marked === 'right' || marked === 'shown'
  const live = !locked && !finished
  const deepest = w.level
  const canZoom = deepest < lastLevel(l)
  const rowY = (k: number) => FIRST_Y + k * PITCH
  const wins: Win[] = []
  for (let k = 0; k <= deepest; k++) wins.push(windowAt(l, now.lo.slice(0, k)))
  const gap = canZoom ? cellOf(w, now.v) : null
  const colour = finished ? GOOD : ACCENT
  const edge = finished ? GOOD_DARK : ACCENT_DARK
  const said = marked === 'right' || marked === 'shown' ? working(config, now) : marked === 'wrong' ? madeText(config, now) : ''

  const put = (v: number) => {
    if (!live) return
    setState(moveTo(config, now, v))
  }
  const key = (e: KeyboardEvent) => {
    if (!live) return
    const k = e.key
    if (k === 'ArrowRight' || k === 'ArrowUp') {
      stop(e)
      put((Math.floor(now.v / w.step + 1e-9) + 1) * w.step)
    } else if (k === 'ArrowLeft' || k === 'ArrowDown') {
      stop(e)
      put((Math.ceil(now.v / w.step - 1e-9) - 1) * w.step)
    } else if (k === 'Home') {
      stop(e)
      put(w.lo)
    } else if (k === 'End') {
      stop(e)
      put(w.hi)
    } else if ((k === '+' || k === '=') && canZoom) {
      stop(e)
      setState(zoomIn(config, now))
    } else if (k === '-' && deepest > 0) {
      stop(e)
      setState(zoomOut(config, now))
    }
  }
  const [drag, setDrag] = useState(false)
  const at = (e: PointerEvent<HTMLElement>) => {
    const x = viewX(e, X0 - OVERLAP, X1 - X0 + 2 * OVERLAP)
    put(w.lo + ((x - X0) / (X1 - X0)) * (w.hi - w.lo))
  }
  const seen = `A number line, ${rows === 1 ? 'with ticks' : `zoomed ${deepest} ${deepest === 1 ? 'time' : 'times'}, with ticks`} ${tickWords(t, w.step)} apart. Find ${targetText(t)}. The pin is on ${fineText(t, now.v, w.step)}.`

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-2 [&:has([role=slider]:focus-visible)_.nl-kbd]:block">
      <figure className="m-0 flex w-full flex-col gap-1.5">
        <div className="relative w-full">
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={seen} className="block h-auto w-full select-none">
            <rect x={0.75} y={0.75} width={W - 1.5} height={H - 1.5} rx={16} fill={PLATE} stroke={PLATE_EDGE} strokeWidth={1.5} />
            <text x={X0 - 12} y={HEAD_Y} fontSize={13} fontWeight={700} fill={SOFT} fontFamily={FONT}>Find</text>
            <g data-target="1">
              <TargetMark t={t} x={X0 + 28} y={HEAD_Y + 1} />
            </g>
            {/* The funnels first, so every line and tick draws over them. */}
            {wins.map((cw, k) => {
              if (k >= rows - 1) return null
              const nextCell = k < deepest ? { a: wins[k + 1].lo, b: wins[k + 1].hi } : gap === null ? null : { a: gap, b: gap + cw.step }
              if (!nextCell) return null
              const xa = xIn(cw, nextCell.a)
              const xb = xIn(cw, nextCell.b)
              const y = rowY(k)
              const yn = rowY(k + 1) - FUNNEL_END
              const preview = k === deepest
              return (
                <g key={`f${k}`} data-funnel={preview ? 'preview' : 'open'}>
                  <polygon points={`${f1(xa)},${y + 8} ${f1(xb)},${y + 8} ${X1},${yn} ${X0},${yn}`} fill={FUNNEL} />
                  <path d={`M ${f1(xa)} ${y + 8} L ${X0} ${yn} M ${f1(xb)} ${y + 8} L ${X1} ${yn}`} stroke={FUNNEL_EDGE} strokeWidth={1.3} fill="none" strokeDasharray={preview ? '4 4' : undefined} />
                  {preview && <line x1={X0} x2={X1} y1={rowY(k + 1)} y2={rowY(k + 1)} stroke={GHOST} strokeWidth={2} strokeDasharray="2 5" strokeLinecap="round" />}
                </g>
              )
            })}
            {Array.from({ length: Math.max(0, rows - deepest - 2) }, (_, j) => deepest + 2 + j).map((k) => (
              <line key={`g${k}`} x1={X0} x2={X1} y1={rowY(k)} y2={rowY(k)} stroke={GHOST} strokeWidth={2} strokeDasharray="2 5" strokeLinecap="round" data-ghost={k} />
            ))}
            {wins.map((rw, k) => {
              const cell = k < deepest ? { a: wins[k + 1].lo, b: wins[k + 1].hi } : gap === null ? null : { a: gap, b: gap + rw.step }
              return (
                <Row
                  key={k} t={t} w={rw} y={rowY(k)} tag={`×${magOf(l, k)}`} current={k === deepest} cell={cell}
                  pinned={now.v} reduced={reduced} lowest={k === deepest} fresh={k > 0}
                />
              )
            })}
            <Pin x={xIn(w, now.v)} y={rowY(deepest) + 1} colour={colour} edge={edge} />
          </svg>
          {/* The real control: a slider over the line you are working on, which the pin follows. */}
          <div
            role="slider" tabIndex={locked ? -1 : 0} aria-label="Pin on the number line" aria-orientation="horizontal"
            aria-valuemin={w.lo} aria-valuemax={w.hi} aria-valuenow={now.v} aria-valuetext={`${fineText(t, now.v, w.step)}`} aria-disabled={!live || undefined}
            onKeyDown={key}
            onPointerDown={(e) => {
              if (!live) return
              try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* no capture where there is no pointer */ }
              setDrag(true)
              at(e)
            }}
            onPointerMove={(e) => { if (drag) at(e) }}
            onPointerUp={() => setDrag(false)}
            onPointerCancel={() => setDrag(false)}
            className={`nodrag absolute touch-none rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--subject)] ${live ? 'cursor-grab' : ''}`}
            style={{
              left: `${((X0 - OVERLAP) / W) * 100}%`, width: `${((X1 - X0 + 2 * OVERLAP) / W) * 100}%`,
              top: `${((rowY(deepest) - 24) / H) * 100}%`, height: `${(58 / H) * 100}%`,
            }}
          />
        </div>
        <figcaption className="text-center text-[12px] font-semibold text-ss-slate" aria-hidden="true">
          {rows > 1 ? 'The shaded gap is what Zoom opens up.' : `Ticks are ${tickWords(t, w.step)} apart.`}
        </figcaption>
      </figure>

      {rows > 1 && (
        <Stepper
          label="Zoom" value={`×${magOf(l, deepest)}`}
          down={() => setState(zoomOut(config, now))} up={() => setState(zoomIn(config, now))}
          downLabel="Zoom out one line" upLabel="Zoom in on the shaded gap under the pin"
          disableDown={!live || deepest === 0} disableUp={!live || !canZoom}
        />
      )}
      <p className="nl-kbd hidden text-[12px] font-semibold text-ss-slate">Left and right move the pin. Plus zooms in, minus zooms out.</p>
      <span className="sr-only" aria-live="polite">{`Pin on ${fineText(t, now.v, w.step)}, ticks ${tickWords(t, w.step)} apart.`}</span>
      {marked !== 'idle' && <Result said={said} />}
    </div>
  )
}

/** The zoom path that ends on the number: for the "shown" frame. */
function shownPath(config: PlaceConfig): number[] {
  const t = readValue(config.value)!
  const l = ladderOf(t)
  const lo: number[] = []
  for (let k = 0; k < lastLevel(l); k++) lo.push(cellOf(windowAt(l, lo), t.T))
  return lo
}

function TargetMark({ t, x, y }: { t: Target; x: number; y: number }) {
  if (t.kind !== 'frac') {
    return <text x={f1(x)} y={f1(y)} fontSize={22} fontWeight={800} fill={INK} fontFamily={FONT}>{targetText(t)}</text>
  }
  const neg = t.T < 0
  const ch = 12.5
  const wholeW = t.whole > 0 ? String(t.whole).length * ch : 0
  const minusW = neg ? 13 : 0
  const fw = Math.max(String(t.num).length, String(t.den).length) * 12 + 6
  return (
    <g fontFamily={FONT} fill={INK} fontWeight={800}>
      {neg && (wholeW > 0
        ? <text x={f1(x)} y={f1(y)} fontSize={22}>{'−'}</text>
        : <line x1={f1(x)} x2={f1(x + 10)} y1={f1(y - 5)} y2={f1(y - 5)} stroke={INK} strokeWidth={2.4} strokeLinecap="round" />)}
      {wholeW > 0 && <text x={f1(x + minusW)} y={f1(y)} fontSize={22}>{t.whole}</text>}
      <g transform={`translate(${f1(x + minusW + wholeW + (wholeW ? 4 : 0))} 0)`}>
        <text x={fw / 2} y={f1(y - 8)} textAnchor="middle" fontSize={17}>{t.num}</text>
        <line x1={0} x2={fw} y1={f1(y - 5)} y2={f1(y - 5)} stroke={INK} strokeWidth={2} />
        <text x={fw / 2} y={f1(y + 11)} textAnchor="middle" fontSize={17}>{t.den}</text>
      </g>
    </g>
  )
}

// ---------------------------------------------------------------------------
// Jump

const JW = 360
const JH = 206
const JX0 = 30
const JX1 = 330
const AXIS_Y = 142

function JumpView({ config, state, setState, marked, reduced, locked }: SceneViewProps<JumpConfig, NumberLineState>) {
  const R = rangeOf(config)
  const at = marked === 'shown' ? landing(config) : readJump(config, state)
  const finished = marked === 'right' || marked === 'shown'
  const live = !locked && !finished
  const xOf = (n: number) => JX0 + ((n + R) / (2 * R)) * (JX1 - JX0)
  const gapPx = (JX1 - JX0) / (2 * R)
  const every = [1, 2, 5, 10].find((e) => gapPx * e >= (R >= 10 ? 34 : 26)) ?? 10
  const ns = Array.from({ length: 2 * R + 1 }, (_, i) => i - R)
  const xs = xOf(config.start)
  const xl = xOf(at)
  const dx = Math.abs(xl - xs)
  const ry = Math.min(dx / 2, 54)
  const colour = finished ? GOOD : ACCENT
  const edge = finished ? GOOD_DARK : ACCENT_DARK
  const hop = at - config.start
  const said = marked === 'right' || marked === 'shown' ? working(config, { at }) : marked === 'wrong' ? madeText(config, { at }) : ''
  const put = (n: number) => {
    if (live) setState({ at: Math.max(-R, Math.min(R, Math.round(n))) })
  }
  const key = (e: KeyboardEvent) => {
    if (!live) return
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { stop(e); put(at + 1) }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { stop(e); put(at - 1) }
    else if (e.key === 'Home') { stop(e); put(-R) }
    else if (e.key === 'End') { stop(e); put(R) }
  }
  const [drag, setDrag] = useState(false)
  const from = (e: PointerEvent<HTMLElement>) => {
    const x = viewX(e, JX0 - OVERLAP, JX1 - JX0 + 2 * OVERLAP)
    put(((x - JX0) / (JX1 - JX0)) * 2 * R - R)
  }
  const seen = `A number line from ${signedText(-R)} to ${R}. The sum is ${sumText(config)}. The hopper starts on ${signedText(config.start)} and is on ${signedText(at)}.`
  const apexY = AXIS_Y - 12 - ry

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-2 [&:has([role=slider]:focus-visible)_.nl-kbd]:block">
      <figure className="m-0 flex w-full flex-col gap-1.5">
        <div className="relative w-full">
          <svg viewBox={`0 0 ${JW} ${JH}`} role="img" aria-label={seen} className="block h-auto w-full select-none">
            <rect x={0.75} y={0.75} width={JW - 1.5} height={JH - 1.5} rx={16} fill={PLATE} stroke={PLATE_EDGE} strokeWidth={1.5} />
            <text x={JX0 - 4} y={34} fontSize={22} fontWeight={800} fill={INK} fontFamily={FONT} data-sum="1">
              {sumText(config)}<tspan fill={SOFT} dx={8}>= ?</tspan>
            </text>
            {hop !== 0 && (
              <g data-hop="1">
                <path
                  d={`M ${f1(xs)} ${AXIS_Y - 8} A ${f1(dx / 2)} ${f1(ry)} 0 0 ${hop > 0 ? 1 : 0} ${f1(xl)} ${AXIS_Y - 17}`}
                  fill="none" stroke={colour} strokeWidth={3} strokeLinecap="round"
                />
                <path d={`M ${f1(xl - 5.5)} ${AXIS_Y - 26} L ${f1(xl)} ${AXIS_Y - 17} L ${f1(xl + 5.5)} ${AXIS_Y - 26}`} fill="none" stroke={colour} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
                <text
                  x={f1((xs + xl) / 2)} y={f1(apexY - 7)} textAnchor="middle" fontSize={13} fontWeight={800} fill={edge} fontFamily={FONT}
                  stroke={PLATE} strokeWidth={4} paintOrder="stroke" strokeLinejoin="round" data-hoplabel="1"
                >
                  {hopText(config.start, at)}
                </text>
              </g>
            )}
            <line x1={JX0 - 14} x2={JX1 + 14} y1={AXIS_Y} y2={AXIS_Y} stroke={INK} strokeWidth={2} strokeLinecap="round" />
            <g fill={INK}>
              <path d={`M ${JX0 - 20} ${AXIS_Y} l 8 -4 v 8 z`} />
              <path d={`M ${JX1 + 20} ${AXIS_Y} l -8 -4 v 8 z`} />
            </g>
            <g stroke={INK} strokeLinecap="round">
              {ns.map((n) => {
                const big = n % every === 0
                return <line key={n} x1={f1(xOf(n))} x2={f1(xOf(n))} y1={AXIS_Y - (big ? 7.5 : 4.5)} y2={AXIS_Y + (big ? 7.5 : 4.5)} strokeWidth={n === 0 ? 2.4 : 1.6} />
              })}
            </g>
            <g fontFamily={FONT} fontSize={13} fontWeight={700} fill={INK} textAnchor="middle">
              {ns.filter((n) => n % every === 0).map((n) => <text key={n} x={f1(xOf(n))} y={AXIS_Y + 26}>{signedText(n)}</text>)}
            </g>
            <circle cx={f1(xs)} cy={AXIS_Y} r={5} fill={INK} data-start="1" />
            <text x={f1(xs)} y={AXIS_Y + 46} textAnchor="middle" fontSize={12} fontWeight={700} fill={SOFT} fontFamily={FONT}>start</text>
            {/* The hopper: a handle on the line itself, with arrows either side to show it slides. */}
            <g data-hopper="1">
              <circle cx={f1(xl)} cy={AXIS_Y} r={11} fill={colour} stroke="#FFFFFF" strokeWidth={2.5} />
              <g fill="#FFFFFF">
                <path d={`M ${f1(xl - 2)} ${AXIS_Y - 4.5} l -5 4.5 l 5 4.5 z`} />
                <path d={`M ${f1(xl + 2)} ${AXIS_Y - 4.5} l 5 4.5 l -5 4.5 z`} />
              </g>
            </g>
          </svg>
          <div
            role="slider" tabIndex={locked ? -1 : 0} aria-label="Hopper on the number line" aria-orientation="horizontal"
            aria-valuemin={-R} aria-valuemax={R} aria-valuenow={at} aria-valuetext={`${signedText(at)}, a hop of ${hopText(config.start, at)}`} aria-disabled={!live || undefined}
            onKeyDown={key}
            onPointerDown={(e) => {
              if (!live) return
              try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* no capture where there is no pointer */ }
              setDrag(true)
              from(e)
            }}
            onPointerMove={(e) => { if (drag) from(e) }}
            onPointerUp={() => setDrag(false)}
            onPointerCancel={() => setDrag(false)}
            className={`nodrag absolute touch-none rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--subject)] ${live ? 'cursor-grab' : ''}`}
            style={{
              left: `${((JX0 - OVERLAP) / JW) * 100}%`, width: `${((JX1 - JX0 + 2 * OVERLAP) / JW) * 100}%`,
              top: `${((AXIS_Y - 30) / JH) * 100}%`, height: `${(64 / JH) * 100}%`,
            }}
          />
        </div>
        <figcaption className="text-center text-[12px] font-semibold text-ss-slate" aria-hidden="true">
          The arc is the hop, from the dot to the hopper.
        </figcaption>
      </figure>

      <Stepper
        label="Lands on" value={signedText(at)}
        down={() => put(at - 1)} up={() => put(at + 1)}
        downLabel="Move the hopper one to the left" upLabel="Move the hopper one to the right"
        disableDown={!live || at <= -R} disableUp={!live || at >= R}
      />
      <p className="nl-kbd hidden text-[12px] font-semibold text-ss-slate">Left and right move the hopper one step.</p>
      <span className="sr-only" aria-live="polite">{`Hopper on ${signedText(at)}, a hop of ${hopText(config.start, at)}.`}</span>
      {marked !== 'idle' && <Result said={said} />}
    </div>
  )
}

export function NumberLineView(props: Props) {
  const { config } = props
  if (config.task === 'jump') return <JumpView {...(props as SceneViewProps<JumpConfig, NumberLineState>)} />
  return <PlaceView {...(props as SceneViewProps<PlaceConfig, NumberLineState>)} />
}
