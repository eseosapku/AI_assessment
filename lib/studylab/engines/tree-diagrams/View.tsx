'use client'
import type { KeyboardEvent, ReactNode } from 'react'
import type { SceneViewProps } from '../types'
import type { Pick, TreeConfig, TreeState } from './config'
import { captionText, describe, goalText, handlingText, inBag, measureOf, readState, strict, treeEngine, verdictText } from './config'
import Picture from './Picture'

type Props = SceneViewProps<TreeConfig, TreeState>

const SEG = 'nodrag flex h-7 select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border-2 px-2 text-[13px] font-bold leading-none touch-manipulation transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none'
const PLAIN = 'border-ss-line bg-ss-panel text-ss-ink hover:border-[color:var(--subject)]'

/** The counter's colour as a small disc beside its name on the button. */
const SWATCH: Record<string, { face: string; side: string }> = {
  red: { face: '#C9483D', side: '#8E2D26' },
  blue: { face: '#3567AD', side: '#22467C' },
  green: { face: '#3D8A56', side: '#285F3B' },
  yellow: { face: '#E2B13A', side: '#A07914' },
}

function Swatch({ colour }: { colour: string }) {
  const k = SWATCH[colour] ?? SWATCH.red
  return (
    <svg viewBox="0 0 14 12" className="h-3 w-3.5 shrink-0" aria-hidden="true">
      <path d="M1 5 A6 4 0 0 0 13 5 L13 7.4 A6 4 0 0 1 1 7.4 Z" fill={k.side} />
      <ellipse cx={7} cy={5} rx={6} ry={4} fill={k.face} stroke={k.side} strokeWidth={0.7} />
    </svg>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-[62px] shrink-0 whitespace-nowrap text-[12px] font-bold text-ss-slate">{label}</span>
      {children}
    </div>
  )
}

const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1)

export function TreeView({ config, state, setState, marked, reduced, locked }: Props) {
  const ok = treeEngine.faults(config).length === 0
  const shown: TreeState = readState(marked === 'shown' && ok ? treeEngine.solve(config) : state)
  const frozen = locked || marked === 'right' || marked === 'shown'
  if (!ok) return null

  // The board moves cards with the arrow keys; inside the card they belong to the card.
  const onKey = (e: KeyboardEvent) => {
    if (e.key.startsWith('Arrow')) e.stopPropagation()
  }

  const s = strict(config)
  const hasPutBack = s.kind === 'choose' || s.put === 'back'
  const mustPutBack = s.kind === 'find' && s.put === 'back' && shown.first !== null && !shown.back

  const takeOff = (c: Pick) => frozen || shown.second !== null || inBag(config, shown, c) <= 0 || mustPutBack
  const take = (c: Pick) => {
    if (takeOff(c)) return
    if (shown.first === null) setState({ ...shown, first: c })
    else setState({ ...shown, second: c })
  }
  const putBack = () => {
    if (frozen || shown.first === null || shown.back || shown.second !== null) return
    setState({ ...shown, back: true })
  }
  const again = () => {
    if (frozen || shown.first === null) return
    const tried = shown.second !== null
      ? [...shown.tried.filter((t) => !(t.first === shown.first && t.second === shown.second)), { first: shown.first, second: shown.second, back: shown.back }]
      : shown.tried
    setState({ first: null, back: false, second: null, tried })
  }

  const measure = measureOf(config, shown)
  const caption = captionText(config, shown)
  const verdict = marked !== 'idle' ? verdictText(config, shown) : ''
  const hand = handlingText(config)

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-1.5" onKeyDown={onKey}>
      <figure className="m-0 flex w-full flex-col gap-1.5">
        <Picture
          colours={s.colours}
          bag={s.bag}
          first={shown.first}
          back={shown.back}
          second={shown.second}
          tried={shown.tried}
          reveal={marked !== 'idle'}
          reduced={reduced}
        />
        <figcaption className={marked !== 'idle' ? 'sr-only' : 'min-h-[2.4rem] text-center text-[12px] font-bold leading-snug text-ss-slate'} data-caption>
          {caption}
        </figcaption>
      </figure>

      <div className="flex flex-col gap-1">
        <Row label="Take out">
          <span className="grid flex-1 grid-cols-2 gap-1" role="group" aria-label="Take a counter out of the bag">
            {([0, 1] as Pick[]).map((c) => (
              <button key={c} type="button" aria-label={`Take a ${s.colours[c]} counter out of the bag`} disabled={takeOff(c)} onClick={() => take(c)} className={`${SEG} ${PLAIN}`}>
                <Swatch colour={s.colours[c]} />
                {cap(s.colours[c])}
              </button>
            ))}
          </span>
        </Row>
        <Row label="Bag">
          <span className="flex flex-1 items-center gap-1">
            {hasPutBack && (
              <button type="button" aria-label="Put the first counter back in the bag" disabled={frozen || shown.first === null || shown.back || shown.second !== null} onClick={putBack} className={`${SEG} flex-1 ${PLAIN}`}>
                Put it back
              </button>
            )}
            <button type="button" aria-label="Put every counter back and start again" disabled={frozen || shown.first === null} onClick={again} className={`${SEG} flex-1 ${PLAIN}`}>
              Start again
            </button>
          </span>
        </Row>
        <div className="grid grid-cols-[1fr_auto] gap-x-4 border-t border-ss-line pt-1">
          <p className="flex flex-col">
            <span className="text-[12px] font-bold text-ss-slate">Goal</span>
            <span className="text-[13px] font-extrabold leading-snug text-ss-ink">{goalText(config)}</span>
            <span className="text-[12px] leading-snug text-ss-slate">{hand}</span>
          </p>
          <p className="flex flex-col items-end text-right">
            <span className="text-[12px] font-bold text-ss-slate">{measure.label}</span>
            <span className="text-[14px] font-extrabold leading-snug text-ss-ink" data-measure>
              {measure.value}
            </span>
          </p>
        </div>
      </div>

      <span className="sr-only" aria-live="polite">{`${describe(config, shown)} ${caption} ${measure.label}: ${measure.value}.`}</span>
      {marked !== 'idle' && (
        <div className="rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-1" data-done={treeEngine.check(config, shown).ok ? '1' : '0'}>
          <p className="text-[12px] font-extrabold leading-snug text-ss-ink">{verdict}</p>
        </div>
      )}
    </div>
  )
}
