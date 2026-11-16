'use client'
import { useId, useState, type KeyboardEvent } from 'react'
import type { SceneMarked, SceneViewProps } from '../types'
import type { BarModelConfig, BarModelState } from './config'
import {
  MAX_PIECES, clampPieces, clampShaded, describeBar, fmtNum, initialOf, madeMatch, madePart, madeShare, ownersOf,
  workingMatch, workingPart, workingShare,
} from './config'

type Props = SceneViewProps<BarModelConfig, BarModelState>

// A quiet light plate in both themes, like waves' and measure-shape's: the picture keeps its own colours. Flat colours only.
const PLATE = '#F8FAFC'
const PLATE_EDGE = '#CBD5E1'
const INK = '#334155'
const SOFT = '#475569'
const PAPER = '#FBF3DF'
const PAPER_EDGE = '#A8946B'
const SCORE = '#6B5B3A'
// Calm shading colours, each over 4.5:1 against white lettering.
const A = '#2F6F9F'
const B = '#B4631A'

// Geometry, exported so the tests can check that nothing leaves its box.
export const W = 360
export const BX = 12
export const BW = 336
export const BH = 56
export const EASE = 'transform 800ms ease-in-out, opacity 800ms ease-in-out'
export const pieceX = (i: number, pieces: number) => BX + (i * BW) / pieces

function Verdict({ marked, text }: { marked: SceneMarked; text: string }) {
  if (marked === 'idle') return null
  return <p className="w-full max-w-[360px] rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2 text-[13px] font-extrabold leading-snug text-ss-ink" aria-live="polite">{text}</p>
}

const STEP = 'nodrag flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-lg border-2 border-ss-line bg-ss-panel text-[16px] font-extrabold leading-none text-ss-ink touch-manipulation hover:border-[color:var(--subject)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40'

function Stepper({ name, value, less, more, canLess, canMore, onLess, onMore }: {
  name: string; value: number; less: string; more: string; canLess: boolean; canMore: boolean; onLess: () => void; onMore: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-1.5">
      <span className="text-[12px] font-bold text-ss-slate">{name}</span>
      <span className="flex items-center gap-1">
        <button type="button" aria-label={less} disabled={!canLess} onClick={onLess} className={STEP}>{'−'}</button>
        <span className="min-w-[28px] text-center text-[15px] font-extrabold tabular-nums text-ss-ink" aria-hidden="true">{value}</span>
        <button type="button" aria-label={more} disabled={!canMore} onClick={onMore} className={STEP}>+</button>
      </span>
    </div>
  )
}

const swatch = (colour: string, hollow = false) => (
  <span
    aria-hidden="true"
    className="inline-block h-3 w-3 shrink-0 rounded-[3px]"
    style={{ background: hollow ? PAPER : colour, border: `1.5px solid ${hollow ? PAPER_EDGE : colour}` }}
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

/** A strip of card you could cut: paper, a soft shadow under it, scored lines with a notch at each end. */
function Bar({ y, pieces, shaded, owners, initials, worth, reduced, onPart, partLabel }: BarProps) {
  const tr = reduced ? undefined : EASE
  const clip = `bm-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
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
      <defs>
        <clipPath id={clip}><rect x={BX} y={y} width={BW} height={BH} rx={5} /></clipPath>
      </defs>
      <rect x={BX} y={y + 3} width={BW} height={BH} rx={5} fill="#64748B" opacity={0.28} />
      <g clipPath={`url(#${clip})`}>
        <rect x={BX} y={y} width={BW} height={BH} fill={PAPER} />
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
                  <text x={0} y={y + (worthFits ? 25 : 34)} textAnchor="middle" fontSize="15" fontWeight="800" fill="#FFFFFF" style={{ transform: `translateX(${x + w / 2}px)`, transition: tr }}>
                    {initials[o - 1]}
                  </text>
                )}
                {o > 0 && worthFits && (
                  <text x={0} y={y + 44} textAnchor="middle" fontSize="12" fontWeight="700" fill="#FFFFFF" style={{ transform: `translateX(${x + w / 2}px)`, transition: tr }}>
                    {worth}
                  </text>
                )}
              </g>
            )
          })}
        {shaded !== undefined && worthFits &&
          Array.from({ length: shaded }, (_, i) => (
            <text key={i} x={pieceX(i, pieces) + BW / pieces / 2} y={y + 33} textAnchor="middle" fontSize="12" fontWeight="700" fill="#FFFFFF">{worth}</text>
          ))}
        {/* paper sheen along the top, shade along the bottom edge */}
        <rect x={BX} y={y} width={BW} height={6} fill="#FFFFFF" opacity={0.3} />
        <rect x={BX} y={y + BH - 6} width={BW} height={6} fill="#1E293B" opacity={0.1} />
      </g>
      {Array.from({ length: MAX_PIECES - 1 }, (_, i) => {
        const live = i + 1 < pieces
        return (
          <g key={i} style={{ transform: `translateX(${live ? pieceX(i + 1, pieces) : BX + BW}px)`, opacity: live ? 1 : 0, transition: tr }}>
            <line x1={0} x2={0} y1={y + 3} y2={y + BH - 3} stroke="#1E293B" strokeOpacity={0.5} strokeWidth="1.4" />
            <line x1={1.4} x2={1.4} y1={y + 3} y2={y + BH - 3} stroke="#FFFFFF" strokeOpacity={0.55} strokeWidth="1.2" />
            <path d={`M-3.5 ${y}L0 ${y + 4.5}L3.5 ${y}Z M-3.5 ${y + BH}L0 ${y + BH - 4.5}L3.5 ${y + BH}Z`} fill={PLATE} stroke={SCORE} strokeWidth="0.8" strokeLinejoin="round" />
          </g>
        )
      })}
      <rect x={BX} y={y} width={BW} height={BH} rx={5} fill="none" stroke={PAPER_EDGE} strokeWidth="1.5" />
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

/** A bracket under the whole strip, with its label on it. */
function Whole({ y, text }: { y: number; text: string }) {
  const d = `M${BX} ${y - 4}V${y}H${BX + BW}V${y - 4}`
  return (
    <g>
      <path d={d} fill="none" stroke={SOFT} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <text x={BX + BW / 2} y={y + 17} textAnchor="middle" fontSize="12" fontWeight="700" fill={INK}>{text}</text>
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

  const isMatch = config.task === 'match'
  const height = isMatch ? 204 : 134
  const topY = isMatch ? 30 : 18
  const lowY = 128
  const edge = config.task === 'match' ? BX + (BW * config.n) / config.d : 0

  const description =
    config.task === 'match'
      ? `Two paper strips of the same length, one above the other. The top strip is given: cut into ${config.d} equal parts, ${config.n} shaded. The lower strip is yours: ${describeBar(pieces, shaded)}.`
      : config.task === 'part'
        ? `A paper strip worth ${whole}, ${describeBar(pieces, shaded)}.`
        : `A paper strip worth ${whole}, cut into ${pieces} equal ${pieces === 1 ? 'part' : 'parts'}. ${owners.slice(0, pieces).filter((v) => v === 1).length} given to ${config.names[0]}, ${owners.slice(0, pieces).filter((v) => v === 2).length} given to ${config.names[1]}.`

  const caption =
    config.task === 'match' ? 'Cut the lower strip, then tap its parts to shade them.' :
    config.task === 'part' ? 'Cut the strip, then tap parts to shade them.' :
    'Cut the strip, pick a name, then tap parts to give them out.'

  return (
    <div className="nodrag flex flex-col items-center gap-3">
      <figure className="flex w-full max-w-[360px] flex-col gap-1.5">
        <svg viewBox={`0 0 ${W} ${height}`} role="img" aria-label={description} className="block h-auto w-full select-none">
          <rect width={W} height={height} rx={16} fill={PLATE} stroke={PLATE_EDGE} strokeWidth={1.5} />
          {config.task === 'match' ? (
            <>
              <text x={BX} y={22} fontSize="12" fontWeight="700" fill={INK}>{`Given: ${config.n} of ${config.d} parts shaded`}</text>
              <Bar y={topY} pieces={config.d} shaded={config.n} reduced={reduced} />
              <text x={BX} y={lowY - 12} fontSize="12" fontWeight="700" fill={INK}>Yours</text>
              <Bar y={lowY} pieces={pieces} shaded={shaded} reduced={reduced} onPart={tap} partLabel={mine} />
              {marked !== 'idle' && <line x1={edge} x2={edge} y1={topY + BH} y2={lowY + BH + 8} stroke={INK} strokeWidth="1.6" strokeDasharray="5 4" strokeLinecap="round" />}
            </>
          ) : (
            <>
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
              <Whole y={topY + BH + 22} text={`Whole bar = ${whole}`} />
            </>
          )}
        </svg>
        <figcaption className="text-center text-[12px] font-bold text-ss-slate">{caption}</figcaption>
      </figure>
      <div className="flex w-full max-w-[360px] flex-col gap-1.5">
        <Stepper
          name="Cut into equal parts"
          value={pieces}
          less="Cut the bar into one fewer equal part"
          more="Cut the bar into one more equal part"
          canLess={!locked && pieces > 1}
          canMore={!locked && pieces < MAX_PIECES}
          onLess={() => recut(pieces - 1)}
          onMore={() => recut(pieces + 1)}
        />
        {config.task === 'share' ? (
          <div className="flex items-center justify-between gap-1.5" role="group" aria-label="Whose part to give">
            <span className="text-[12px] font-bold text-ss-slate">Give parts to</span>
            <span className="flex items-center gap-1">
              {config.names.map((name, k) => {
                const on = brush === k + 1
                const c = k === 0 ? A : B
                return (
                  <button
                    key={name}
                    type="button"
                    aria-pressed={on}
                    disabled={locked}
                    onClick={() => setBrush((k + 1) as 1 | 2)}
                    className="nodrag flex h-7 items-center gap-1.5 whitespace-nowrap rounded-lg border-2 bg-ss-panel px-2 text-[12px] font-extrabold text-ss-ink outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:opacity-60"
                    style={{ borderColor: on ? c : 'var(--ss-line, #E2E8F0)', boxShadow: on ? `inset 0 0 0 1px ${c}` : undefined }}
                  >
                    {swatch(c)}
                    {name}
                  </button>
                )
              })}
            </span>
          </div>
        ) : null}
        <p className="flex items-center justify-end gap-3 text-[12px] font-bold text-ss-slate">
          {config.task === 'share' ? (
            <span className="flex items-center gap-1.5">{swatch(A, true)}not given yet</span>
          ) : (
            <>
              <span className="flex items-center gap-1.5">{swatch(A)}shaded</span>
              <span className="flex items-center gap-1.5">{swatch(A, true)}not shaded</span>
            </>
          )}
        </p>
      </div>
      <span className="sr-only" aria-live="polite">{`${pieces} equal ${pieces === 1 ? 'part' : 'parts'}`}</span>
      <Verdict marked={marked} text={text} />
    </div>
  )
}
