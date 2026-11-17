'use client'
import type { KeyboardEvent } from 'react'
import type { SceneViewProps } from '../types'
import type { EyeConfig, EyeState, Muscle } from './config'
import { captionText, describe, drawable, eyeEngine, goalText, madeText, measureOf, readState, working } from './config'
import Picture, { RELAXED, TIGHT } from './Picture'

type Props = SceneViewProps<EyeConfig, EyeState>

/** A small muscle spindle beside each state's word: thin and pale when relaxed, thick and deep red when contracted. */
function Swatch({ on }: { on: boolean }) {
  const c = on ? TIGHT : RELAXED
  return (
    <svg viewBox="0 0 22 12" className="h-3 w-[22px] shrink-0" aria-hidden="true">
      <path d="M1 6 H5" stroke="#8E99A6" strokeWidth={1.6} strokeLinecap="round" />
      <path d="M17 6 H21" stroke="#8E99A6" strokeWidth={1.6} strokeLinecap="round" />
      {on
        ? <path d="M5 6 C 6 0.6, 16 0.6, 17 6 C 16 11.4, 6 11.4, 5 6 Z" fill={c.fill} stroke={c.edge} strokeWidth={1} />
        : <path d="M2 6 C 5 3.4, 17 3.4, 20 6 C 17 8.6, 5 8.6, 2 6 Z" fill={c.fill} stroke={c.edge} strokeWidth={1} />}
    </svg>
  )
}

const SEG = 'nodrag flex h-7 select-none items-center gap-1 whitespace-nowrap rounded-lg border-2 px-2 text-[13px] font-bold leading-none touch-manipulation transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-not-allowed motion-reduce:transition-none'

function MuscleRow({ label, value, disabled, set }: { label: string; value: Muscle; disabled: boolean; set(next: Muscle): void }) {
  const look = (active: boolean) => (active ? 'border-[color:var(--subject)] bg-ss-chip text-ss-ink' : 'border-ss-line bg-ss-panel text-ss-slate hover:border-[color:var(--subject)]')
  const relaxed = value === 'relaxed'
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="whitespace-nowrap text-[12px] font-bold text-ss-slate">{label}</span>
      <span className="flex items-center gap-1" role="group" aria-label={label}>
        <button type="button" aria-pressed={relaxed} aria-label={`${label} relaxed`} disabled={disabled} onClick={() => !relaxed && set('relaxed')} className={`${SEG} ${look(relaxed)}`}><Swatch on={false} />Relaxed</button>
        <button type="button" aria-pressed={!relaxed} aria-label={`${label} contracted`} disabled={disabled} onClick={() => relaxed && set('contracted')} className={`${SEG} ${look(!relaxed)}`}><Swatch on />Contracted</button>
      </span>
    </div>
  )
}

export function EyeView({ config, state, setState, marked, reduced, locked }: Props) {
  if (!drawable(config)) return null
  const shown = readState(marked === 'shown' ? eyeEngine.solve(config) : state)
  const frozen = locked || marked !== 'idle'
  const set = (key: keyof EyeState) => (next: Muscle) => {
    if (frozen || shown[key] === next) return
    setState({ ...shown, [key]: next })
  }
  // The board moves cards with the arrow keys; inside the card they belong to the card.
  const onKey = (e: KeyboardEvent) => { if (e.key.startsWith('Arrow')) e.stopPropagation() }

  const measure = measureOf(config, shown)
  const said = marked === 'right' || marked === 'shown' ? working(config) : marked === 'wrong' ? madeText(config, shown) : ''
  const caption = captionText(config, shown)

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-2" onKeyDown={onKey}>
      <figure className="m-0 flex w-full flex-col gap-1.5">
        <div role="img" aria-label={describe(config, shown)}>
          {config.kind === 'focus'
            ? <Picture view="focus" object={config.object} ciliary={shown.ciliary} reduced={reduced} />
            : <Picture view="pupil" light={config.light} circular={shown.circular} radial={shown.radial} reduced={reduced} />}
        </div>
        <figcaption className="text-center text-[12px] font-bold leading-snug text-ss-slate" data-caption>{caption}</figcaption>
      </figure>

      <div className="flex flex-col gap-1.5">
        {config.kind === 'focus' ? (
          <MuscleRow label="Ciliary muscle" value={shown.ciliary} disabled={frozen} set={set('ciliary')} />
        ) : (
          <>
            <MuscleRow label="Circular muscle" value={shown.circular} disabled={frozen} set={set('circular')} />
            <MuscleRow label="Radial muscle" value={shown.radial} disabled={frozen} set={set('radial')} />
          </>
        )}
        <div className="grid grid-cols-[1fr_auto] gap-x-4 border-t border-ss-line pt-1.5">
          <p className="flex flex-col">
            <span className="text-[12px] font-bold text-ss-slate">Goal</span>
            <span className="text-[13px] font-extrabold leading-snug text-ss-ink">{goalText(config)}</span>
          </p>
          <p className="flex flex-col items-end text-right">
            <span className="text-[12px] font-bold text-ss-slate">{measure.label}</span>
            <span className="text-[15px] font-extrabold leading-snug text-ss-ink" data-measure>{measure.value}</span>
          </p>
        </div>
      </div>

      <span className="sr-only" aria-live="polite">{`${caption} ${measure.label}: ${measure.value}.`}</span>
      {marked !== 'idle' && (
        <div className="rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-1.5" data-done={eyeEngine.check(config, shown).ok ? '1' : '0'}>
          <p className="text-[12px] font-extrabold leading-snug text-ss-ink">{said}</p>
        </div>
      )}
    </div>
  )
}
