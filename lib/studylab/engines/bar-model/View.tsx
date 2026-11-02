'use client'
import { useState, type KeyboardEvent } from 'react'
import type { SceneMarked, SceneViewProps } from '../types'
import type { BarModelConfig, BarModelState } from './config'
import {
  MAX_PIECES, clampPieces, clampShaded, describeBar, fmtNum, initialOf, madeMatch, madePart, madeShare, ownersOf,
  workingMatch, workingPart, workingShare,
} from './config'

type Props = SceneViewProps<BarModelConfig, BarModelState>

// The scene's own inks: flat solid colours, each over 3:1 on the card in both themes. --bm-on is the text on top of a coloured part.
const PALETTE =
  '[--bm-a:#1D4ED8] [--bm-b:#C2410C] [--bm-on:#FFFFFF] dark:[--bm-a:#93C5FD] dark:[--bm-b:#FDBA74] dark:[--bm-on:#0B1220]'
const INK = 'var(--ss-ink, #16202A)'
const PANEL = 'var(--ss-panel, #FFFFFF)'
const A = 'var(--bm-a, #1D4ED8)'
const B = 'var(--bm-b, #C2410C)'
const ON = 'var(--bm-on, #FFFFFF)'

// Geometry, exported so the tests can check that nothing leaves its box.
export const W = 360
export const BX = 10
export const BW = 340
export const BH = 64
export const EASE = 'transform 800ms ease-in-out, opacity 800ms ease-in-out'
export const pieceX = (i: number, pieces: number) => BX + (i * BW) / pieces

function Verdict({ marked, text }: { marked: SceneMarked; text: string }) {
  if (marked === 'idle') return null
  return <p className="max-w-[340px] text-center text-[13px] font-extrabold leading-snug text-ss-ink">{text}</p>
}

function Tap({ label, sign, off, onTap }: { label: string; sign: '+' | '-'; off: boolean; onTap: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={off}
      onClick={onTap}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ss-panel outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:opacity-40"
      style={{ border: `2.5px solid ${INK}` }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
        <path d={sign === '+' ? 'M8 2 V14 M2 8 H14' : 'M2 8 H14'} />
      </svg>
    </button>
  )
}

const swatch = (colour: string, hollow = false) => (
  <span
    aria-hidden="true"
    className="inline-block h-3.5 w-3.5 shrink-0 rounded-sm"
    style={{ background: hollow ? PANEL : colour, border: `2px solid ${hollow ? INK : colour}` }}
  />
)

type BarProps = {
  y: number
  pieces: number
  /** shaded from the left (match, part) */
  shaded?: number
  /** a colour per part (share) */
  owners?: number[]
  initials?: [string, string]
  /** text inside a part, once marked */
  worth?: string
  reduced: boolean
  /** which parts can be tapped */
  onPart?: (i: number) => void
  partLabel?: (i: number) => string
}

function Bar({ y, pieces, shaded, owners, initials, worth, reduced, onPart, partLabel }: BarProps) {
  const tr = reduced ? undefined : EASE
  const worthFits = worth !== undefined && worth.length * 8 + 4 <= BW / pieces
  const keys = (e: KeyboardEvent<SVGRectElement>, i: number) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.stopPropagation()
      e.preventDefault()
      const next = (e.currentTarget.parentElement?.querySelectorAll('rect[role="button"]') ?? [])[i + (e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1)] as SVGRectElement | undefined
      next?.focus()
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.stopPropagation()
      e.preventDefault()
      onPart?.(i)
    }
  }
  return (
    <g>
      <rect x={BX} y={y} width={BW} height={BH} fill={PANEL} />
      {shaded !== undefined && (
        <rect x={0} y={y} width={BW} height={BH} fill={A} style={{ transform: `translateX(${BX}px) scaleX(${pieces ? shaded / pieces : 0})`, transition: tr }} />
      )}
      {owners &&
        Array.from({ length: MAX_PIECES }, (_, i) => {
          const live = i < pieces
          const x = live ? pieceX(i, pieces) : BX + BW
          const w = live ? BW / pieces : 0
          const o = live ? owners[i] : 0
          return (
            <g key={i}>
              <rect x={0} y={y} width={1} height={BH} fill={o === 2 ? B : A} style={{ transform: `translateX(${x}px) scaleX(${w})`, opacity: o ? 1 : 0, transition: tr }} />
              {o > 0 && initials && (
                <text x={0} y={y + (worthFits ? 25 : 38)} textAnchor="middle" fontSize="16" fontWeight="800" fill={ON} style={{ transform: `translateX(${x + w / 2}px)`, transition: tr }}>
                  {initials[o - 1]}
                </text>
              )}
              {o > 0 && worthFits && (
                <text x={0} y={y + 48} textAnchor="middle" fontSize="13" fontWeight="800" fill={ON} style={{ transform: `translateX(${x + w / 2}px)`, transition: tr }}>
                  {worth}
                </text>
              )}
            </g>
          )
        })}
      {shaded !== undefined && worthFits &&
        Array.from({ length: shaded }, (_, i) => (
          <text key={i} x={pieceX(i, pieces) + BW / pieces / 2} y={y + 38} textAnchor="middle" fontSize="13" fontWeight="800" fill={ON}>{worth}</text>
        ))}
      {Array.from({ length: MAX_PIECES - 1 }, (_, i) => {
        const live = i + 1 < pieces
        return (
          <line key={i} x1={0} x2={0} y1={y} y2={y + BH} stroke={INK} strokeWidth="2.5" style={{ transform: `translateX(${live ? pieceX(i + 1, pieces) : BX + BW}px)`, opacity: live ? 1 : 0, transition: tr }} />
        )
      })}
      <rect x={BX} y={y} width={BW} height={BH} fill="none" stroke={INK} strokeWidth="3" />
      {onPart &&
        Array.from({ length: pieces }, (_, i) => (
          <rect
            key={i}
            role="button"
            tabIndex={0}
            aria-label={partLabel?.(i)}
            x={pieceX(i, pieces)}
            y={y}
            width={BW / pieces}
            height={BH}
            fill="transparent"
            className="touch-none cursor-pointer outline-none focus-visible:outline focus-visible:outline-[3px] focus-visible:-outline-offset-4 focus-visible:outline-[color:var(--subject)]"
            onClick={() => onPart(i)}
            onKeyDown={(e) => keys(e, i)}
          />
        ))}
    </g>
  )
}

export function BarModelView({ config, state, setState, marked, reduced, locked }: Props) {
  const [brush, setBrush] = useState<1 | 2>(1)
  const pieces = clampPieces(state?.pieces)
  const shaded = clampShaded(state?.shaded, pieces)
  const owners = ownersOf(state)
  const good = marked === 'right' || marked === 'shown'

  const recut = (v: number) => {
    if (locked || v < 1 || v > MAX_PIECES || v === pieces) return
    setState({ pieces: v, shaded: 0, owners: Array(MAX_PIECES).fill(0) })
  }
  const tap = (i: number) => {
    if (locked) return
    if (config.task === 'share') {
      const next = owners.slice()
      next[i] = next[i] === brush ? 0 : brush
      setState({ pieces, owners: next })
    } else {
      setState({ pieces, shaded: shaded === i + 1 ? i : i + 1 })
    }
  }

  const unitName = config.task === 'match' ? '' : config.unit
  const whole = config.task === 'match' ? '' : `${fmtNum(config.amount)}${unitName ? ` ${unitName}` : ''}`
  const eachWorth = config.task !== 'match' && marked !== 'idle' && config.amount % pieces === 0 ? fmtNum(config.amount / pieces) : undefined

  const text =
    marked === 'idle' ? '' :
    config.task === 'match' ? (good ? workingMatch(config) : madeMatch(config, state)) :
    config.task === 'part' ? (good ? workingPart(config, state) : madePart(config, state)) :
    good ? workingShare(config, state) : madeShare(config, state)

  const mine = (i: number) =>
    config.task === 'share'
      ? `Part ${i + 1} of ${pieces}, ${owners[i] ? `given to ${config.names[owners[i] - 1]}` : 'not given out'}`
      : `Part ${i + 1} of ${pieces}, ${i < shaded ? 'shaded' : 'not shaded'}`

  const height = config.task === 'match' ? 214 : 122
  const topY = config.task === 'match' ? 26 : 30
  const lowY = 134
  const edge = config.task === 'match' ? BX + (BW * config.n) / config.d : 0

  const description =
    config.task === 'match'
      ? `Two bars of the same length, one above the other. The top bar is given: cut into ${config.d} equal parts, ${config.n} shaded. The lower bar is yours: ${describeBar(pieces, shaded)}.`
      : config.task === 'part'
        ? `A bar worth ${whole}, ${describeBar(pieces, shaded)}.`
        : `A bar worth ${whole}, cut into ${pieces} equal ${pieces === 1 ? 'part' : 'parts'}. ${owners.slice(0, pieces).filter((v) => v === 1).length} given to ${config.names[0]}, ${owners.slice(0, pieces).filter((v) => v === 2).length} given to ${config.names[1]}.`

  return (
    <div className={`nodrag flex flex-col items-center gap-2.5 ${PALETTE}`}>
      {config.task !== 'share' && (
        <p className="flex items-center gap-3 text-[13px] font-extrabold text-ss-ink">
          <span className="flex items-center gap-1.5">{swatch(A)}shaded</span>
          <span className="flex items-center gap-1.5">{swatch(A, true)}not shaded</span>
        </p>
      )}
      <svg viewBox={`0 0 ${W} ${height}`} role="img" aria-label={description} className="block h-auto w-full max-w-[360px] select-none">
        {config.task === 'match' ? (
          <>
            <text x={BX} y={18} fontSize="13" fontWeight="800" fill={INK}>{`Given: ${config.n} of ${config.d} parts shaded`}</text>
            <Bar y={topY} pieces={config.d} shaded={config.n} reduced={reduced} />
            <text x={BX} y={lowY - 8} fontSize="13" fontWeight="800" fill={INK}>Yours</text>
            <Bar y={lowY} pieces={pieces} shaded={shaded} reduced={reduced} onPart={tap} partLabel={mine} />
            {marked !== 'idle' && <line x1={edge} x2={edge} y1={topY + BH} y2={lowY + BH + 8} stroke={INK} strokeWidth="2.5" strokeDasharray="6 5" />}
          </>
        ) : (
          <>
            <text x={BX} y={20} fontSize="13" fontWeight="800" fill={INK}>{`Whole bar = ${whole}`}</text>
            <Bar
              y={topY}
              pieces={pieces}
              shaded={config.task === 'part' ? shaded : undefined}
              owners={config.task === 'share' ? owners : undefined}
              initials={config.task === 'share' ? [initialOf(config.names[0]), initialOf(config.names[1])] : undefined}
              worth={eachWorth}
              reduced={reduced}
              onPart={tap}
              partLabel={mine}
            />
          </>
        )}
      </svg>
      <div className="flex items-center gap-3 text-ss-ink">
        <Tap label="Cut the bar into one fewer equal part" sign="-" off={locked || pieces <= 1} onTap={() => recut(pieces - 1)} />
        <span className="min-w-[92px] text-center text-[16px] font-extrabold whitespace-nowrap">{pieces} equal {pieces === 1 ? 'part' : 'parts'}</span>
        <Tap label="Cut the bar into one more equal part" sign="+" off={locked || pieces >= MAX_PIECES} onTap={() => recut(pieces + 1)} />
      </div>
      {config.task === 'share' && (
        <div className="flex flex-wrap items-center justify-center gap-2" role="group" aria-label="Whose part to give">
          {config.names.map((name, k) => {
            const on = brush === k + 1
            return (
              <button
                key={name}
                type="button"
                aria-pressed={on}
                disabled={locked}
                onClick={() => setBrush((k + 1) as 1 | 2)}
                className="flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-full bg-ss-panel px-3.5 text-[14px] font-extrabold text-ss-ink outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:opacity-60"
                style={{ border: `${on ? 4 : 2}px solid ${k === 0 ? A : B}` }}
              >
                {swatch(k === 0 ? A : B)}
                {name}
              </button>
            )
          })}
          <span className="flex items-center gap-1.5 whitespace-nowrap text-[13px] font-extrabold text-ss-ink">{swatch(A, true)}not given yet</span>
        </div>
      )}
      <span className="sr-only" aria-live="polite">{`${pieces} equal ${pieces === 1 ? 'part' : 'parts'}`}</span>
      <Verdict marked={marked} text={text} />
    </div>
  )
}
