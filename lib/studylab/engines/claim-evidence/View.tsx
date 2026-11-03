'use client'
import { useState } from 'react'
import type { SceneViewProps } from '../types'
import type { ArgConfig, ArgState, Card } from './config'
import { claimEvidenceEngine, displayOrder, putOf, sideName, tiltOf, weightOn } from './config'
import { madeText, working } from './config'

type Props = SceneViewProps<ArgConfig, ArgState>

// A balance is not a dark subject: a quiet light plate, as measure-shape's is, with a brass balance on it.
// The plate keeps its own colours in both themes. No gradients or shadows.
const PLATE = '#F8FAFC'
const PLATE_EDGE = '#CBD5E1'
const INK = '#16202A'
const SOFT = '#475569'
const FONT = 'system-ui, sans-serif'
const BRASS = '#B8893A'
const BRASS_EDGE = '#7A5A1E'
const BRASS_LIGHT = '#D9B565'
const STAND = '#64748B'
const CARD = '#FBF3DC'
const CARD_EDGE = '#8A6A25'

// The geometry of the plate (also the viewBox). Literals: config's constants do not exist yet when this file loads.
export const W = 360
export const H = 176
const PIVOT_X = 180
const PIVOT_Y = 36
const ARM = 118
const HANG = 58
const PAN_W = 108
const TILE_W = 34
const TILE_GAP = 3
const f1 = (n: number) => n.toFixed(1)
const tileH = (strength: number) => 14 + 5 * (Math.max(1, Math.min(3, strength)) - 1)

function Tile({ x, y, card, label, picked }: { x: number; y: number; card: Card; label: number; picked: boolean }) {
  const h = tileH(card.strength)
  return (
    <g transform={`translate(${x} ${y - h})`} data-tile={label}>
      <rect width={TILE_W} height={h} rx={3} fill={CARD} stroke={picked ? '#2563EB' : CARD_EDGE} strokeWidth={picked ? 2.4 : 1.4} />
      <text x={TILE_W / 2} y={h / 2 + 0.5} textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={800} fill={INK} fontFamily={FONT}>{label}</text>
    </g>
  )
}

/** A pan hanging from the beam end by two cords: the dish, and the cards on it, bottom row first. */
function Pan({ at, name, tiles, reduced }: { at: { x: number; y: number }; name: string; tiles: { card: Card; label: number; picked: boolean }[]; reduced: boolean }) {
  const ease = reduced ? undefined : { transition: 'transform 900ms ease' }
  const left = -(PAN_W / 2)
  const cols = 3
  const rowH = 27
  return (
    <g style={{ transform: `translate(${f1(at.x)}px, ${f1(at.y)}px)`, ...ease }} data-pan={name}>
      <g stroke={STAND} strokeWidth={1.4} strokeLinecap="round">
        <line x1={0} y1={0} x2={-(PAN_W / 2 - 4)} y2={HANG} />
        <line x1={0} y1={0} x2={PAN_W / 2 - 4} y2={HANG} />
      </g>
      {tiles.map((t, j) => (
        <Tile key={t.label} x={left + 1 + (j % cols) * (TILE_W + TILE_GAP)} y={HANG - Math.floor(j / cols) * rowH - 0.5} card={t.card} label={t.label} picked={t.picked} />
      ))}
      <path d={`M ${left} ${HANG} H ${-left} Q ${-left - 8} ${HANG + 12} ${-left - 22} ${HANG + 12} H ${left + 22} Q ${left + 8} ${HANG + 12} ${left} ${HANG} Z`} fill={BRASS} stroke={BRASS_EDGE} strokeWidth={1.6} strokeLinejoin="round" />
      <rect x={left} y={HANG - 1.2} width={PAN_W} height={3} rx={1.5} fill={BRASS_LIGHT} stroke={BRASS_EDGE} strokeWidth={1} />
      <text x={0} y={HANG + 30} textAnchor="middle" fontSize={13} fontWeight={700} fill={SOFT} fontFamily={FONT} stroke={PLATE} strokeWidth={3} paintOrder="stroke" strokeLinejoin="round">{name}</text>
    </g>
  )
}

function Strength({ n }: { n: number }) {
  return (
    <span className="flex items-center gap-[3px]" aria-hidden="true">
      {[1, 2, 3].map((k) => (
        <span key={k} className="h-[7px] w-[7px] rounded-full border" style={{ background: k <= n ? SOFT : 'transparent', borderColor: SOFT }} />
      ))}
    </span>
  )
}

export function ClaimEvidenceView({ config, state, setState, marked, reduced, locked }: Props) {
  const [picked, setPicked] = useState<number | null>(null)
  const now: ArgState = marked === 'shown' ? claimEvidenceEngine.solve(config) : state
  const put = putOf(config, now)
  const order = displayOrder(config)
  const labelOf = (i: number) => order.indexOf(i) + 1
  const finished = marked === 'right' || marked === 'shown'
  const frozen = locked || finished
    const tilt = tiltOf(config, now)
  const rad = (tilt * Math.PI) / 180
  const leftEnd = { x: PIVOT_X - ARM * Math.cos(rad), y: PIVOT_Y - ARM * Math.sin(rad) }
  const rightEnd = { x: PIVOT_X + ARM * Math.cos(rad), y: PIVOT_Y + ARM * Math.sin(rad) }
  const tilesOn = (pan: 'for' | 'against') =>
    order.filter((i) => put[i] === pan).map((i) => ({ card: config.cards[i], label: labelOf(i), picked: picked === i }))
  const weightFor = weightOn(config, now, 'for')
  const weightAgainst = weightOn(config, now, 'against')
  const nFor = put.filter((p) => p === 'for').length
  const nAgainst = put.filter((p) => p === 'against').length
  const beamEase = reduced ? undefined : { transition: 'transform 900ms ease' }

  const move = (pan: 'for' | 'against') => {
    if (frozen || picked === null) return
    const next = [...put]
    next[picked] = next[picked] === pan ? null : pan
    setState({ put: next })
    setPicked(null)
  }
  const takeOff = () => {
    if (frozen || picked === null) return
    const next = [...put]
    next[picked] = null
    setState({ put: next })
    setPicked(null)
  }
  const said = finished ? working(config) : marked === 'wrong' ? madeText(config, now) : ''
  const lead = said.match(/^(Yes\. [^.]*\.)\s*(.*)$/)
  const lean = tilt === 0 ? 'level' : tilt < 0 ? 'towards the supporting pan' : 'towards the opposing pan'
  const showTargets = !frozen && picked !== null
  const pickedOnPan = picked !== null && put[picked] !== null

  return (
    <div
      className="nodrag flex w-full max-w-[380px] flex-col gap-2"
      onKeyDown={(e) => { if (e.key.startsWith('Arrow')) e.stopPropagation() }}
    >
      <div className="rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-1.5">
        <p className="text-[14px] font-extrabold leading-snug text-ss-ink"><span className="mr-1.5 text-[12px] font-bold text-ss-slate">Claim</span>{config.claim}</p>
      </div>

      <figure className="m-0 flex w-full flex-col gap-1.5">
        <div className="relative w-full">
          <svg
            viewBox={`0 0 ${W} ${H}`} role="img" className="block h-auto w-full select-none"
            aria-label={`A balance with a supporting pan on the left and an opposing pan on the right. ${nFor} ${nFor === 1 ? 'card is' : 'cards are'} on the supporting pan and ${nAgainst} on the opposing pan. The beam is ${tilt === 0 ? 'level' : `tipped ${lean}`}.`}
          >
            <rect x={0.75} y={0.75} width={W - 1.5} height={H - 1.5} rx={16} fill={PLATE} stroke={PLATE_EDGE} strokeWidth={1.5} />
            {showTargets && (
              <g fill="none" stroke="#2563EB" strokeWidth={1.6} strokeDasharray="5 4" data-targets="1">
                <rect x={10} y={leftEnd.y + 8} width={PAN_W + 8} height={HANG + 60} rx={10} style={reduced ? undefined : { transition: 'y 900ms ease' }} />
                <rect x={W - 10 - PAN_W - 8} y={rightEnd.y + 8} width={PAN_W + 8} height={HANG + 60} rx={10} style={reduced ? undefined : { transition: 'y 900ms ease' }} />
              </g>
            )}
            {/* The stand: base, pillar. */}
            <rect x={PIVOT_X - 52} y={161} width={104} height={10} rx={4} fill={STAND} />
            <rect x={PIVOT_X - 5} y={PIVOT_Y} width={10} height={128} fill={STAND} />
            <Pan at={leftEnd} name="Supports" tiles={tilesOn('for')} reduced={reduced} />
            <Pan at={rightEnd} name="Against" tiles={tilesOn('against')} reduced={reduced} />
            {/* The beam, turning on the pillar's top. */}
            <g style={{ transform: `rotate(${f1(tilt)}deg)`, transformOrigin: `${PIVOT_X}px ${PIVOT_Y}px`, ...beamEase }} data-beam={f1(tilt)}>
              <rect x={PIVOT_X - ARM - 6} y={PIVOT_Y - 4} width={ARM * 2 + 12} height={8} rx={4} fill={BRASS} stroke={BRASS_EDGE} strokeWidth={1.6} />
              <circle cx={PIVOT_X - ARM} cy={PIVOT_Y} r={4.5} fill={BRASS_LIGHT} stroke={BRASS_EDGE} strokeWidth={1.4} />
              <circle cx={PIVOT_X + ARM} cy={PIVOT_Y} r={4.5} fill={BRASS_LIGHT} stroke={BRASS_EDGE} strokeWidth={1.4} />
            </g>
            <circle cx={PIVOT_X} cy={PIVOT_Y} r={7.5} fill={BRASS_LIGHT} stroke={BRASS_EDGE} strokeWidth={1.8} />
            <circle cx={PIVOT_X} cy={PIVOT_Y} r={2.4} fill={BRASS_EDGE} />
          </svg>
          {showTargets && (
            <>
              <button
                type="button" aria-label={`Put card ${labelOf(picked!)} on the supporting pan`} onClick={() => move('for')}
                className="nodrag absolute touch-manipulation rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--subject)]"
                style={{ left: 0, top: 0, width: '42%', height: '100%', border: 'none', background: 'transparent', padding: 0, cursor: 'pointer' }}
              />
              <button
                type="button" aria-label={`Put card ${labelOf(picked!)} on the opposing pan`} onClick={() => move('against')}
                className="nodrag absolute touch-manipulation rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--subject)]"
                style={{ right: 0, top: 0, width: '42%', height: '100%', border: 'none', background: 'transparent', padding: 0, cursor: 'pointer' }}
              />
            </>
          )}
        </div>
        <figcaption className="text-center text-[12px] font-semibold text-ss-slate" aria-hidden="true">
          Dots and block height show how strong a card is.
        </figcaption>
      </figure>

      <ol className="m-0 grid list-none grid-cols-2 gap-1.5 p-0">
        {order.map((i) => {
          const c = config.cards[i]
          const on = put[i]
          const isPicked = picked === i
          const tag = finished ? sideName(c.side) : on ? sideName(on) : ''
          return (
            <li key={i} className="flex">
              <button
                type="button" disabled={frozen} aria-pressed={isPicked} data-card={labelOf(i)} data-on={on ?? 'off'}
                aria-label={`Card ${labelOf(i)}: ${c.text}. Strength ${c.strength} of 3.${on ? ` On the ${on === 'for' ? 'supporting' : 'opposing'} pan.` : ' Not on the scale.'}`}
                onClick={() => setPicked(isPicked ? null : i)}
                className={`nodrag flex w-full touch-manipulation flex-col gap-1 rounded-lg border-2 px-2 py-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--subject)] disabled:cursor-default ${on ? 'bg-ss-chip' : 'bg-ss-panel'} ${reduced ? '' : 'transition-colors duration-300'}`}
                style={{ borderColor: isPicked ? '#2563EB' : undefined }}
              >
                <span className="flex items-center justify-between gap-1.5">
                  <span className="flex items-center gap-1.5">
                    <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-[4px] px-[3px] text-[12px] font-extrabold tabular-nums" style={{ background: CARD, border: `1.4px solid ${CARD_EDGE}`, color: INK }}>{labelOf(i)}</span>
                    <Strength n={c.strength} />
                  </span>
                  <span className="text-[12px] font-bold text-ss-slate">{tag}</span>
                </span>
                <span className="text-[12px] font-semibold leading-snug text-ss-ink">{c.text}</span>
              </button>
            </li>
          )
        })}
      </ol>

      <div className="flex h-7 items-center justify-between gap-1.5 border-t border-ss-line pt-1.5">
        <span className="flex items-baseline gap-4">
          <span className="flex items-baseline gap-1.5"><span className="text-[12px] font-bold text-ss-slate">Supports</span><span className="text-[15px] font-extrabold tabular-nums text-ss-ink" data-weight-for={weightFor}>{weightFor}</span></span>
          <span className="flex items-baseline gap-1.5"><span className="text-[12px] font-bold text-ss-slate">Against</span><span className="text-[15px] font-extrabold tabular-nums text-ss-ink" data-weight-against={weightAgainst}>{weightAgainst}</span></span>
        </span>
        <button
          type="button" aria-label="Take the picked card off the scale" disabled={frozen || !pickedOnPan} onClick={takeOff}
          className="nodrag h-7 shrink-0 touch-manipulation whitespace-nowrap rounded-lg border-2 border-ss-line bg-ss-panel px-2.5 text-[12px] font-bold text-ss-ink transition-colors hover:border-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
        >
          Take off
        </button>
      </div>

      <span className="sr-only" aria-live="polite">{`${nFor} on the supporting pan, ${nAgainst} on the opposing pan. The beam is ${tilt === 0 ? 'level' : `tipped ${lean}`}.`}</span>
      {marked !== 'idle' && (
        <div className="rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2">
          <p className="text-[13px] font-extrabold leading-snug text-ss-ink">{lead ? lead[1] : said}</p>
          {lead && lead[2] && <p className="mt-0.5 text-[12px] font-semibold leading-snug text-ss-slate">{lead[2]}</p>}
        </div>
      )}
    </div>
  )
}
