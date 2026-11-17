'use client'
import { useRef, type KeyboardEvent, type PointerEvent } from 'react'
import type { SceneMarked, SceneViewProps } from '../types'
import type { StandardFormConfig, StandardFormState, TapeDigit } from './config'
import { baseOf, currentDecimal, currentPower, decimalText, expressionLeft, frameOf, madeText, moveBounds, ordinaryLeft, readMove, standardFormEngine, tapeDigits, working } from './config'

type Props = SceneViewProps<StandardFormConfig, StandardFormState>

// A printed place-value chart, not a dark subject: the same quiet plate in both themes,
// so every digit and line keeps its contrast. Flat colour only.
const PLATE = '#F8FAFC'
const PLATE_EDGE = '#CBD5E1'
const GRID = '#CBD5E1'
const INK = '#16202A'
const SOFT = '#475569'
const FAINT = '#E2E8F0'
const PAPER = '#FFFFFF'
const ZERO_PAPER = '#F1F5F9'
const BLUE = '#2563A6'
const BLUE_PALE = '#EAF2F9'
const HANDLE = '#64748B'
const FONT = 'system-ui, sans-serif'

export const W = 360
export const H = 202
export const FRAME_X = 16
export const FRAME_W = 328
export const CELL_W = FRAME_W / 10
export const TAPE_Y = 61
export const TAPE_H = 58
const SUP: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' }
const superscript = (n: number) => String(n).split('').map((c) => SUP[c] ?? '').join('')
const placeText = (p: number) => p === 0 ? '1' : p === 1 ? '10' : p === -1 ? '1/10' : `10${superscript(p)}`
const fix = (n: number) => n.toFixed(2)

/** The actual printable cells: digits that are in the window, plus needed internal zeros. */
export function visibleCells(config: StandardFormConfig, move: number): { digit: string | null; place: number; x: number }[] {
  const { frame, cells } = tapeLayout(config, move)
  const required = tapeDigits(currentDecimal(config, move))
  const highest = required[0].place
  const lowest = required[required.length - 1].place
  // Placeholder zeros on the paper can become unnecessary trailing decimal zeros;
  // hide those, but retain every digit in the current ordinary number.
  const present = cells.filter((c) => {
    const place = c.place - move
    return c.x >= FRAME_X && c.x < FRAME_X + FRAME_W && place <= highest && place >= lowest
  })
  return Array.from({ length: 10 }, (_, j) => {
    const place = frame.high - j
    const digit = present.find((c) => c.place - move === place)?.digit ?? null
    return { digit: !digit && place <= highest && place >= lowest ? '0' : digit, place, x: FRAME_X + j * CELL_W }
  })
}

/** The visible zero placeholders are computed, never painted over a shortened numeral. */
export function tapeLayout(config: StandardFormConfig, move: number): { frame: { high: number; low: number }; cells: (TapeDigit & { x: number })[] } {
  const frame = frameOf(config)
  const digits = tapeDigits(baseOf(config))
  const first = frame.high - digits[0].place
  return { frame, cells: digits.map((d, i) => ({ ...d, x: FRAME_X + (first + i + move) * CELL_W })) }
}

function Power({ n }: { n: number }) {
  return <span className="relative inline-flex items-start whitespace-nowrap"><span>10</span><sup className="ml-px text-[12px] font-extrabold leading-none">{n}</sup><span className="sr-only absolute h-px w-px overflow-hidden whitespace-pre">^{n}</span></span>
}

function Product({ coefficient, power, blue = false }: { coefficient: string; power: number; blue?: boolean }) {
  return (
    <span className={`inline-flex items-baseline gap-1 whitespace-nowrap ${blue ? 'text-[#2563A6]' : 'text-ss-ink'}`}>
      <span aria-hidden="true" className="inline-flex items-baseline gap-1"><span>{coefficient}</span><span>×</span><span>10<sup className="ml-px text-[12px] font-extrabold leading-none">{power}</sup></span></span>
      <span className="sr-only">{coefficient} × 10^{power}</span>
    </span>
  )
}

function Equation({ config, move }: { config: StandardFormConfig; move: number }) {
  const now = decimalText(currentDecimal(config, move))
  const left = expressionLeft(config)
  return (
    <div className="flex min-h-[32px] flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-center text-[20px] font-extrabold tabular-nums text-ss-ink" aria-live="polite">
      {config.task === 'write' ? <span>{left.coefficient}</span> : <Product coefficient={left.coefficient} power={left.power} />}
      <span aria-hidden="true">=</span>
      {config.task === 'write' ? <Product coefficient={now} power={currentPower(config, move)} blue /> : <span className="text-[#2563A6]" data-ordinary={now}>{now}</span>}
      <span className="sr-only">equals {now}{config.task === 'write' ? ` times ten to the power ${move}` : ''}</span>
    </div>
  )
}

const ARROW = 'nodrag flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-lg border-2 border-ss-line bg-ss-panel text-[17px] font-extrabold leading-none text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'

function Verdict({ marked, text }: { marked: SceneMarked; text: string }) {
  if (marked === 'idle') return null
  return <p className="w-full rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2 text-[13px] font-extrabold leading-snug text-ss-ink" aria-live="polite">{text}</p>
}

export function StandardFormView({ config, state, setState, marked, reduced, locked }: Props) {
  const raw = marked === 'shown' ? standardFormEngine.solve(config) : state
  const move = readMove(config, raw)
  const bounds = moveBounds(config)
  const layout = tapeLayout(config, move)
  const now = currentDecimal(config, move)
  const ordinary = decimalText(now)
  const left = expressionLeft(config)
  const good = marked === 'right' || marked === 'shown'
  const verdict = good ? working(config, raw) : marked === 'wrong' ? madeText(config, raw) : ''
  const drag = useRef<{ x: number; move: number; pointer: number } | null>(null)
  const previous = useRef(move)
  previous.current = move

  const setMove = (next: number) => {
    if (!locked) setState({ move: Math.max(bounds.lo, Math.min(bounds.hi, next)) })
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') return
    e.preventDefault()
    e.stopPropagation()
    if (e.key === 'Home') setMove(bounds.lo)
    else if (e.key === 'End') setMove(bounds.hi)
    else setMove(move + (e.key === 'ArrowRight' ? 1 : -1))
  }
  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (locked || e.button !== 0) return
    drag.current = { x: e.clientX, move: previous.current, pointer: e.pointerId }
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* window-level pointerup is enough */ }
  }
  const dragTo = (e: PointerEvent<HTMLDivElement>) => {
    const start = drag.current
    if (!start || start.pointer !== e.pointerId) return
    const width = e.currentTarget.clientWidth || W
    const delta = (e.clientX - start.x) * W / width / CELL_W
    const step = Math.trunc(delta + (delta >= 0 ? 0.3 : -0.3))
    setMove(start.move + step)
  }
  const up = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointer === e.pointerId) drag.current = null
  }
  const shift = layout.cells.map((c) => c.x - FRAME_X)
  const leftDigit = Math.min(...shift)
  const rightDigit = Math.max(...shift)
  const described = config.task === 'write'
    ? `A sliding digit tape in a fixed place-value frame. The decimal point stays between ones and tenths. ${ordinaryLeft(config)} equals ${ordinary} times ten to the power ${move}.`
    : `A sliding digit tape in a fixed place-value frame. The decimal point stays between ones and tenths. ${left.coefficient} times ten to the power ${left.power} equals ${ordinary}.`

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-2" onKeyDown={onKey}>
      <figure className="m-0 flex w-full flex-col gap-1.5">
        <div className="relative w-full">
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={described} className="block h-auto w-full select-none">
            <defs>
              <clipPath id="sf-tape-window"><rect x={FRAME_X} y={TAPE_Y - 2} width={FRAME_W} height={TAPE_H + 4} rx={5} /></clipPath>
            </defs>
            <rect x={0.75} y={0.75} width={W - 1.5} height={H - 1.5} rx={16} fill={PLATE} stroke={PLATE_EDGE} strokeWidth={1.5} />
            <text x={W / 2} y={23} textAnchor="middle" fontFamily={FONT} fontSize={12} fontWeight={700} fill={SOFT}>Place value</text>
            {/* Each column is named with its own value. Ones and tenths bracket the fixed point. */}
            {Array.from({ length: 10 }, (_, j) => {
              const p = layout.frame.high - j
              return <text key={j} x={FRAME_X + (j + 0.5) * CELL_W} y={47} textAnchor="middle" fontFamily={FONT} fontSize={12} fontWeight={700} fill={p === 0 || p === -1 ? BLUE : SOFT}>{placeText(p)}</text>
            })}
            {/* The real paper tape runs behind the window. Cells move as one; no digit is omitted. */}
            <g clipPath="url(#sf-tape-window)">
              <g style={reduced ? undefined : { transition: 'transform 650ms ease' }} transform={`translate(${fix(move * CELL_W)} 0)`}>
                {layout.cells.filter((c) => {
                  const required = tapeDigits(currentDecimal(config, move))
                  const place = c.place - move
                  return place <= required[0].place && place >= required[required.length - 1].place
                }).map((c) => (
                  <g key={c.index}>
                    <rect x={fix(c.x - move * CELL_W)} y={TAPE_Y} width={CELL_W} height={TAPE_H} fill={c.fromTape ? PAPER : ZERO_PAPER} stroke={GRID} strokeWidth={1} />
                    <text x={fix(c.x - move * CELL_W + CELL_W / 2)} y={TAPE_Y + 38} textAnchor="middle" fontFamily={FONT} fontSize={26} fontWeight={750} fill={c.fromTape ? INK : SOFT}>{c.digit}</text>
                  </g>
                ))}
              </g>
              {/* Only zeros in the ordinary number are printed: no leading zero padding and
                  never a second zero on top of a digit. A cell's place changes with the move. */}
              {visibleCells(config, move).map((cell, j) => cell.digit === null || layout.cells.some((c) => c.place - move === cell.place && c.x === cell.x) ? null : (
                <text key={j} x={cell.x + CELL_W / 2} y={TAPE_Y + 38} textAnchor="middle" fontFamily={FONT} fontSize={26} fontWeight={700} fill={SOFT}>0</text>
              ))}
            </g>
            <rect x={FRAME_X} y={TAPE_Y} width={FRAME_W} height={TAPE_H} rx={5} fill="none" stroke={HANDLE} strokeWidth={1.5} />
            {Array.from({ length: 11 }, (_, j) => <line key={j} x1={FRAME_X + j * CELL_W} x2={FRAME_X + j * CELL_W} y1={TAPE_Y} y2={TAPE_H + TAPE_Y} stroke={GRID} strokeWidth={0.8} />)}
            <circle cx={FRAME_X + (layout.frame.high + 1) * CELL_W} cy={TAPE_Y + TAPE_H - 9} r={4.5} fill={BLUE} />
            <text
              x={FRAME_X + (layout.frame.high + 1) * CELL_W + (layout.frame.high < 3 ? 8 : -8)}
              y={137}
              textAnchor={layout.frame.high < 3 ? 'start' : 'end'}
              fontFamily={FONT} fontSize={12} fontWeight={700} fill={SOFT}
            >decimal point stays fixed</text>
            {/* A visible grip, on the tape itself. The whole window is also a slider. */}
            <g transform={`translate(${W / 2} 166)`} aria-hidden="true">
              <rect x={-46} y={-13} width={92} height={26} rx={8} fill={BLUE_PALE} stroke={BLUE} strokeWidth={1.2} />
              <path d="M -33 -4 L -38 0 L -33 4 M 33 -4 L 38 0 L 33 4" fill="none" stroke={BLUE} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
              <path d="M -8 -5 V 5 M -3 -5 V 5 M 2 -5 V 5 M 7 -5 V 5" stroke={HANDLE} strokeWidth={1.5} strokeLinecap="round" />
            </g>
            <text x={105} y={171} textAnchor="end" fontFamily={FONT} fontSize={12} fontWeight={700} fill={SOFT}>digit tape</text>
            <text x={255} y={171} fontFamily={FONT} fontSize={12} fontWeight={700} fill={BLUE}>slide</text>
          </svg>
          <div
            role="slider" tabIndex={locked ? -1 : 0} aria-label="Digit tape position" aria-valuemin={bounds.lo} aria-valuemax={bounds.hi} aria-valuenow={move}
            aria-valuetext={`${ordinary}${config.task === 'write' ? ` times ten to the power ${move}` : ''}`} aria-disabled={locked || undefined}
            className="absolute inset-0 touch-none rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--subject)] cursor-grab active:cursor-grabbing"
            onPointerDown={down} onPointerMove={dragTo} onPointerUp={up} onPointerCancel={up} onLostPointerCapture={up}
            data-left-digit={leftDigit} data-right-digit={rightDigit}
          />
        </div>
        <figcaption className="text-center text-[12px] font-bold text-ss-slate">The digits move past the fixed decimal point.</figcaption>
      </figure>

      <Equation config={config} move={move} />

      <div className="flex items-center justify-between gap-2 border-t border-ss-line pt-2">
        <span className="text-[12px] font-bold text-ss-slate">Move digits</span>
        <span className="flex items-center gap-2">
          <button type="button" aria-label="Slide digits one column left" disabled={locked || move <= bounds.lo} onClick={() => setMove(move - 1)} className={ARROW}>←</button>
          <span className="min-w-[100px] text-center text-[13px] font-extrabold tabular-nums text-ss-ink" data-move={move}>{move === 0 ? 'start' : `${Math.abs(move)} ${Math.abs(move) === 1 ? 'column' : 'columns'} ${move > 0 ? 'right' : 'left'}`}</span>
          <button type="button" aria-label="Slide digits one column right" disabled={locked || move >= bounds.hi} onClick={() => setMove(move + 1)} className={ARROW}>→</button>
        </span>
      </div>
      <p className="text-center text-[12px] font-semibold text-ss-slate">
        {config.task === 'write' ? 'Standard form: blue number at least 1 and under 10.' : 'Use the power to choose how far the digits move.'}
      </p>
      <Verdict marked={marked} text={verdict} />
    </div>
  )
}
