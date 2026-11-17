'use client'
import { useEffect, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import type { SceneViewProps } from '../types'
import type { PowerConfig, PowerState } from './config'
import { MAX_EACH, captionText, co2Label, co2Of, coalAt, describe, energyEngine, goalText, jumpTo, litAt, momentsOf, readState, stationsOf, timeName, verdictText, HOMES } from './config'
import Picture from './Picture'

type Props = SceneViewProps<PowerConfig, PowerState>

const STEP = 'nodrag flex h-6 w-6 shrink-0 select-none items-center justify-center rounded-lg border-2 border-ss-line bg-ss-panel text-[16px] font-extrabold leading-none text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'
const SEG = 'nodrag flex h-6 select-none items-center justify-center gap-1 whitespace-nowrap rounded-lg border-2 px-2 text-[13px] font-bold leading-none touch-manipulation transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] motion-reduce:transition-none'
const look = (active: boolean) => (active ? 'border-[color:var(--subject)] bg-ss-chip text-ss-ink' : 'border-ss-line bg-ss-panel text-ss-slate hover:border-[color:var(--subject)]')

type Kind = 'turbines' | 'panels' | 'coal'
const KINDS: { key: Kind; label: string; take: string; build: string }[] = [
  { key: 'turbines', label: 'Wind turbines', take: 'Take down a wind turbine', build: 'Build a wind turbine' },
  { key: 'panels', label: 'Solar panels', take: 'Remove a row of solar panels', build: 'Build a row of solar panels' },
  { key: 'coal', label: 'Coal stations', take: 'Close a coal power station', build: 'Build a coal power station' },
]

/** A small picture of each kind of station beside its name. */
function Icon({ kind }: { kind: Kind }) {
  return (
    <svg viewBox="0 0 14 14" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
      {kind === 'turbines' && (
        <g stroke="#7B8794" strokeWidth={0.8} fill="#FFFFFF" strokeLinejoin="round">
          <path d="M6.4 7.2 7.6 7.2 7.9 13 6.1 13Z" />
          <path d="M7 6.6C6 4.8 6.2 2.6 7 0.8 7.8 2.6 8 4.8 7 6.6Z" />
          <path d="M7 7 12.6 9.4C10.6 9.9 8.6 9.2 7.2 7.6Z" />
          <path d="M7 7 1.4 9.4C3.4 9.9 5.4 9.2 6.8 7.6Z" />
          <circle cx={7} cy={7} r={1} />
        </g>
      )}
      {kind === 'panels' && (
        <g>
          <path d="M2.4 4 12.6 4 11.4 10 1.2 10Z" fill="#30507D" stroke="#3B4859" strokeWidth={0.8} strokeLinejoin="round" />
          <path d="M5.8 4 4.6 10M9.2 4 8 10M1.8 7 12 7" stroke="#8FA8C8" strokeWidth={0.6} />
          <path d="M6.3 10 6.3 13M8.6 10 8.6 13" stroke="#3B4859" strokeWidth={0.9} />
        </g>
      )}
      {kind === 'coal' && (
        <g strokeLinejoin="round">
          <path d="M9 1.5 10.6 1.5 10.9 12.6 8.7 12.6Z" fill="#C2BCB2" stroke="#857F75" strokeWidth={0.7} />
          <rect x={1.4} y={7} width={7.4} height={5.6} fill="#9B6A54" stroke="#6C4838" strokeWidth={0.7} />
          <rect x={3} y={8.6} width={1.4} height={2.2} fill="#5F738A" />
          <rect x={5.6} y={8.6} width={1.4} height={2.2} fill="#5F738A" />
        </g>
      )}
    </svg>
  )
}

function Stepper({ label, kind, value, canAdd, take, build, locked, set }: { label: string; kind: Kind; value: number; canAdd: boolean; take: string; build: string; locked: boolean; set: (v: number) => void }) {
  return (
    <div className="flex items-center gap-2" role="group" aria-label={label}>
      <span className="flex min-w-0 flex-1 items-center gap-1.5 whitespace-nowrap text-[12px] font-bold text-ss-slate">
        <Icon kind={kind} />
        {label}
      </span>
      <button type="button" aria-label={take} disabled={locked || value <= 0} onClick={() => set(value - 1)} className={STEP}>−</button>
      <span className="w-6 text-center text-[15px] font-extrabold tabular-nums text-ss-ink" data-count={kind}>{value}</span>
      <button type="button" aria-label={build} disabled={locked || value >= MAX_EACH || !canAdd} onClick={() => set(value + 1)} className={STEP}>+</button>
    </div>
  )
}

const dayWords = (m: { time: string; wind: string; sky: string }) => {
  const sky = m.time === 'noon' ? [m.sky] : ['dark', ...(m.sky === 'cloudy' ? ['cloudy'] : [])]
  const parts = [...sky, m.wind]
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

export function EnergyView({ config, state, setState, marked, reduced, locked }: Props) {
  const ok = energyEngine.faults(config).length === 0
  const shown: PowerState = readState(marked === 'shown' && ok ? energyEngine.solve(config) : state)
  const frozen = locked || marked !== 'idle'

  // What the student last changed decides how the town answers: a new time plays the sunset first, a build answers at once.
  const [changed, setChanged] = useState<'mix' | 'time'>('mix')
  // Once marked, the card can still be looked at: the times keep working without touching the work.
  const [looked, setLooked] = useState<number | null>(null)
  useEffect(() => {
    if (!frozen) setLooked(null)
  }, [frozen])

  if (!ok) return null

  const moments = momentsOf(config)
  const jump = frozen ? jumpTo(config, shown) : null
  const at = Math.min(frozen && looked !== null ? looked : jump ?? shown.shown, moments.length - 1)
  // A marked card opens on the first time homes went dark: the sky answers before the town does.
  const effChanged = frozen && jump !== null && looked === null ? 'time' : changed
  const m = moments[at]

  // The board moves cards with the arrow keys; inside the card they belong to the card.
  const onKey = (e: KeyboardEvent) => { if (e.key.startsWith('Arrow')) e.stopPropagation() }

  const build = (key: Kind) => (v: number) => {
    if (frozen) return
    setChanged('mix')
    setState({ ...shown, [key]: v })
  }
  const pick = (i: number) => {
    setChanged('time')
    if (frozen) setLooked(i)
    else if (i !== shown.shown) setState({ ...shown, shown: i })
  }

  const left = Math.max(0, config.plots - stationsOf(shown))
  const lit = litAt(m, shown)
  const co2 = co2Of(moments, shown)
  const caption = captionText(config, { ...shown, shown: at })
  const verdict = marked !== 'idle' ? verdictText(config, shown) : ''
  const isDone = energyEngine.check(config, shown).ok

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-1" onKeyDown={onKey}>
      <figure className="m-0 flex w-full flex-col gap-1">
        <Picture
          time={m.time}
          wind={m.wind}
          sky={m.sky}
          turbines={shown.turbines}
          panels={shown.panels}
          coal={shown.coal}
          coalOutput={coalAt(m, shown)}
          lit={lit}
          changed={effChanged}
          reduced={reduced}
        />
        <figcaption className={marked !== 'idle' ? 'sr-only' : 'text-center text-[12px] font-bold leading-snug text-ss-slate'} data-caption>{caption}</figcaption>
      </figure>

      <div className="flex flex-col gap-0.5">
        {KINDS.map((k) => (
          <Stepper key={k.key} label={k.label} kind={k.key} value={shown[k.key]} canAdd={left > 0} take={k.take} build={k.build} locked={frozen} set={build(k.key)} />
        ))}
        {moments.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="w-[92px] shrink-0 whitespace-nowrap text-[12px] font-bold text-ss-slate">Time of day</span>
            <span className="grid flex-1 gap-1" style={{ gridTemplateColumns: `repeat(${moments.length}, minmax(0, 1fr))` }} role="group" aria-label="Time of day">
              {moments.map((mo, i) => (
                <button
                  key={i}
                  type="button"
                  aria-pressed={at === i}
                  aria-label={`Show the ${mo.time}: ${dayWords(mo)}`}
                  onClick={() => pick(i)}
                  className={`${SEG} ${look(at === i)}`}
                >
                  {timeName(mo.time)}
                </button>
              ))}
            </span>
          </div>
        )}
        <div className="border-t border-ss-line pt-1">
          <p className="flex gap-1 text-[12px] leading-snug">
            <span className="shrink-0 font-bold text-ss-slate">Goal</span>
            <span className="font-extrabold text-ss-ink">{goalText(config)}</span>
          </p>
          <div className="mt-1 grid grid-cols-3 gap-x-2">
            <p className="flex flex-col">
              <span className="text-[12px] font-bold text-ss-slate">Homes lit</span>
              <span className="text-[15px] font-extrabold leading-snug text-ss-ink" data-measure>{`${lit} of ${HOMES}`}</span>
            </p>
            <p className="flex flex-col">
              <span className="text-[12px] font-bold text-ss-slate">{co2Label(moments)}</span>
              <span className="text-[15px] font-extrabold leading-snug text-ss-ink" data-co2>{`${co2} unit${co2 === 1 ? '' : 's'}`}</span>
            </p>
            <p className="flex flex-col items-end text-right">
              <span className="text-[12px] font-bold text-ss-slate">Places left</span>
              <span className="text-[15px] font-extrabold leading-snug text-ss-ink" data-left>{`${left} of ${config.plots}`}</span>
            </p>
          </div>
        </div>
      </div>

      <span className="sr-only" aria-live="polite">{`${describe(config, shown)} ${caption} Homes lit: ${lit} of ${HOMES}.`}</span>
      {marked !== 'idle' && (
        <div className="rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-1" data-done={isDone ? '1' : '0'}>
          <p className="text-[12px] font-extrabold leading-snug text-ss-ink">{verdict}</p>
        </div>
      )}
    </div>
  )
}
