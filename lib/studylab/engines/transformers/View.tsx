'use client'
import type { KeyboardEvent, ReactNode } from 'react'
import type { SceneViewProps } from '../types'
import type { TransformersConfig, TransformersState } from './config'
import { MAX_TURNS, canFit, captionText, describe, fitLamp, goalText, measureOf, move, readState, transformersEngine, verdictText } from './config'
import Picture from './Picture'

type Props = SceneViewProps<TransformersConfig, TransformersState>

const SEG = 'nodrag flex h-7 select-none items-center justify-center gap-1 whitespace-nowrap rounded-lg border-2 px-2 text-[13px] font-bold leading-none touch-manipulation transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none'
const look = (active: boolean) => (active ? 'border-[color:var(--subject)] bg-ss-chip text-ss-ink' : 'border-ss-line bg-ss-panel text-ss-slate hover:border-[color:var(--subject)]')
const STEP = 'nodrag flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-lg border-2 border-ss-line bg-ss-panel text-[16px] font-extrabold leading-none text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-[70px] shrink-0 whitespace-nowrap text-[12px] font-bold text-ss-slate">{label}</span>
      {children}
    </div>
  )
}

export function TransformersView({ config, state, setState, marked, reduced, locked }: Props) {
  if (config.kind === 'other' || transformersEngine.faults(config).length) return null
  const shown = readState(marked === 'shown' ? transformersEngine.solve(config) : state)
  const frozen = locked || marked === 'right' || marked === 'shown'
  const onKey = (e: KeyboardEvent) => { if (e.key.startsWith('Arrow')) e.stopPropagation() }

  const wind = (by: number) => {
    if (frozen) return
    const turns = Math.min(MAX_TURNS, Math.max(1, shown.turns + by))
    if (turns !== shown.turns) setState(move(config, shown, { turns }))
  }
  const connect = (supply: 'ac' | 'dc') => {
    if (!frozen && supply !== shown.supply) setState(move(config, shown, { supply }))
  }

  const measure = measureOf(config, shown)
  const caption = captionText(config, shown)
  const verdict = marked !== 'idle' ? verdictText(config, shown) : ''
  const SUPPLIES: { v: 'ac' | 'dc'; text: string; label: string }[] = [
    { v: 'dc', text: 'Battery', label: 'Connect the battery to the primary coil' },
    { v: 'ac', text: 'a.c. supply', label: 'Connect the a.c. supply to the primary coil' },
  ]

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-1.5" onKeyDown={onKey}>
      <figure className="m-0 flex w-full flex-col gap-1.5">
        <Picture supply={shown.supply} supplyVolts={config.supplyVolts} primaryTurns={config.primaryTurns} secondaryTurns={shown.turns} lampRating={config.lampRating} blown={shown.blown} reduced={reduced} />
        <figcaption className={marked !== 'idle' ? 'sr-only' : 'text-center text-[12px] font-bold leading-snug text-ss-slate'} data-caption>{caption}</figcaption>
      </figure>

      <div className="flex flex-col gap-1">
        <Row label="Secondary">
          <span className="flex flex-1 items-center gap-1" role="group" aria-label="Secondary coil turns">
            <button type="button" aria-label="Unwind one turn from the secondary coil" disabled={frozen || shown.turns <= 1} onClick={() => wind(-1)} className={STEP}>−</button>
            <span className="min-w-[64px] text-center text-[15px] font-extrabold tabular-nums text-ss-ink" data-turns>{`${shown.turns} ${shown.turns === 1 ? 'turn' : 'turns'}`}</span>
            <button type="button" aria-label="Wind one more turn onto the secondary coil" disabled={frozen || shown.turns >= MAX_TURNS} onClick={() => wind(1)} className={STEP}>+</button>
          </span>
        </Row>
        {config.kind === 'supply' && (
          <Row label="Supply">
            <span className="grid flex-1 grid-cols-2 gap-1" role="group" aria-label="Supply">
              {SUPPLIES.map((b) => (
                <button key={b.v} type="button" aria-pressed={shown.supply === b.v} aria-label={b.label} disabled={frozen || shown.supply === b.v} onClick={() => connect(b.v)} className={`${SEG} ${look(shown.supply === b.v)}`}>
                  {b.text}
                </button>
              ))}
            </span>
          </Row>
        )}
        {shown.blown && (
          <Row label="Lamp">
            <button type="button" aria-label="Fit a new lamp" disabled={frozen || !canFit(config, shown)} onClick={() => setState(fitLamp(config, shown))} className={`${SEG} flex-1 border-[color:var(--subject)] bg-[color:var(--subject)] text-white`}>
              Fit a new lamp
            </button>
          </Row>
        )}
        <div className="grid grid-cols-[1fr_auto] gap-x-4 border-t border-ss-line pt-1">
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

      <span className="sr-only" aria-live="polite">{`${describe(config, shown)} ${caption} ${measure.label}: ${measure.value}.`}</span>
      {marked !== 'idle' && (
        <div className="rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-1" data-done={transformersEngine.check(config, shown).ok ? '1' : '0'}>
          <p className="text-[12px] font-extrabold leading-snug text-ss-ink">{verdict}</p>
        </div>
      )}
    </div>
  )
}
