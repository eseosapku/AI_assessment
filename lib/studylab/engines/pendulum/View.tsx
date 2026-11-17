'use client'
import { useEffect, useRef } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import type { SceneViewProps } from '../types'
import type { Bob, LengthCm, PendulumConfig, PendulumState, PullDeg, Setup } from './config'
import { captionText, describe, goalText, lengthText, markedRows, measureOf, pendulumEngine, readState, verdictText } from './config'
import Picture, { runMs } from './Picture'

type Props = SceneViewProps<PendulumConfig, PendulumState>

const SEG = 'nodrag flex h-7 select-none items-center justify-center gap-1 whitespace-nowrap rounded-lg border-2 px-2 text-[13px] font-bold leading-none touch-manipulation transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none'
const look = (active: boolean) => (active ? 'border-[color:var(--subject)] bg-ss-chip text-ss-ink' : 'border-ss-line bg-ss-panel text-ss-slate hover:border-[color:var(--subject)]')

/** A small ball beside each bob's name: wood or steel. */
function BobIcon({ bob }: { bob: Bob }) {
  const wood = bob === 'wood'
  return (
    <svg viewBox="0 0 12 12" className="h-3 w-3 shrink-0" aria-hidden="true">
      <circle cx={6} cy={6} r={5} fill={wood ? '#D49C5E' : '#98A3AF'} stroke={wood ? '#8A5A2B' : '#5D6977'} strokeWidth={1} />
      <ellipse cx={4.4} cy={4.2} rx={1.6} ry={1} fill={wood ? '#F2D4A6' : '#F4F7F9'} />
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

const LENGTH_BUTTONS: { value: LengthCm; label: string }[] = [
  { value: 25, label: 'String 25 centimetres' },
  { value: 50, label: 'String 50 centimetres' },
  { value: 75, label: 'String 75 centimetres' },
  { value: 100, label: 'String 1 metre' },
]
const BOB_BUTTONS: { value: Bob; text: string; label: string }[] = [
  { value: 'wood', text: 'Wooden, 50 g', label: 'Wooden bob, 50 grams' },
  { value: 'steel', text: 'Steel, 500 g', label: 'Steel bob, 500 grams' },
]
const PULL_BUTTONS: PullDeg[] = [5, 10]

export function PendulumView({ config, state, setState, marked, reduced, locked }: Props) {
  const ok = pendulumEngine.faults(config).length === 0 && config.kind !== 'other'
  const shown: PendulumState = readState(marked === 'shown' && ok ? pendulumEngine.solve(config) : state)
  const frozen = locked || marked !== 'idle'

  // The timer reads the latest state and setter without restarting when they change identity.
  const latest = useRef({ shown, setState })
  latest.current = { shown, setState }
  useEffect(() => {
    if (frozen || shown.phase !== 'swinging') return
    const finish = () => {
      const s = latest.current.shown
      const that: Setup = { lengthCm: s.lengthCm, bob: s.bob, pullDeg: s.pullDeg }
      latest.current.setState({ ...s, phase: 'timed', runs: [...s.runs, that] })
    }
    if (reduced) {
      finish()
      return
    }
    const t = setTimeout(finish, runMs(shown.lengthCm))
    return () => clearTimeout(t)
  }, [frozen, reduced, shown.phase, shown.runId, shown.lengthCm])

  if (!ok) return null

  // The board moves cards with the arrow keys; inside the card they belong to the card.
  const onKey = (e: KeyboardEvent) => { if (e.key.startsWith('Arrow')) e.stopPropagation() }

  const swinging = shown.phase === 'swinging' && !frozen
  const setField = (patch: Partial<Setup>) => {
    if (frozen || swinging) return
    const same = (Object.keys(patch) as (keyof Setup)[]).every((k) => shown[k] === patch[k])
    if (same) return
    setState({ ...shown, ...patch, phase: 'set' })
  }
  const release = () => {
    if (frozen) return
    const that: Setup = { lengthCm: shown.lengthCm, bob: shown.bob, pullDeg: shown.pullDeg }
    if (reduced) setState({ ...shown, phase: 'timed', runId: shown.runId + 1, runs: [...shown.runs, that] })
    else setState({ ...shown, phase: 'swinging', runId: shown.runId + 1 })
  }
  const stop = () => {
    if (!frozen) setState({ ...shown, phase: 'set' })
  }

  const last = shown.runs[shown.runs.length - 1]
  const again = shown.phase === 'timed' && !!last && last.lengthCm === shown.lengthCm && last.bob === shown.bob && last.pullDeg === shown.pullDeg
  const measure = measureOf(shown)
  const caption = captionText(shown)
  const verdict = marked !== 'idle' ? verdictText(config, shown) : ''
  const rows = marked !== 'idle' ? markedRows(config, shown) : []
  const picturePhase = shown.phase === 'swinging' && frozen ? 'set' : shown.phase

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-1.5" onKeyDown={onKey}>
      <figure className="m-0 flex w-full flex-col gap-1.5">
        <Picture lengthCm={shown.lengthCm} bob={shown.bob} pullDeg={shown.pullDeg} phase={picturePhase} runId={shown.runId} runs={shown.runs} marked={rows} reduced={reduced} />
        <figcaption className={marked !== 'idle' ? 'sr-only' : 'text-center text-[12px] font-bold leading-snug text-ss-slate'} data-caption>{caption}</figcaption>
      </figure>

      <div className="flex flex-col gap-1">
        <Row label="String">
          <span className="grid flex-1 grid-cols-4 gap-1" role="group" aria-label="String length">
            {LENGTH_BUTTONS.map((b) => (
              <button key={b.value} type="button" aria-pressed={shown.lengthCm === b.value} aria-label={b.label} disabled={frozen || swinging} onClick={() => setField({ lengthCm: b.value })} className={`${SEG} ${look(shown.lengthCm === b.value)}`}>
                {lengthText(b.value)}
              </button>
            ))}
          </span>
        </Row>
        <Row label="Bob">
          <span className="grid flex-1 grid-cols-2 gap-1" role="group" aria-label="Bob">
            {BOB_BUTTONS.map((b) => (
              <button key={b.value} type="button" aria-pressed={shown.bob === b.value} aria-label={b.label} disabled={frozen || swinging} onClick={() => setField({ bob: b.value })} className={`${SEG} ${look(shown.bob === b.value)}`}>
                <BobIcon bob={b.value} />
                {b.text}
              </button>
            ))}
          </span>
        </Row>
        <Row label="Pull back">
          <span className="flex flex-1 items-center gap-1" role="group" aria-label="Pull back">
            {PULL_BUTTONS.map((p) => (
              <button key={p} type="button" aria-pressed={shown.pullDeg === p} aria-label={`Pull back ${p} degrees`} disabled={frozen || swinging} onClick={() => setField({ pullDeg: p })} className={`${SEG} w-11 ${look(shown.pullDeg === p)}`}>
                {p}°
              </button>
            ))}
            {swinging ? (
              <button type="button" aria-label="Stop the pendulum and the stopwatch" onClick={stop} className={`${SEG} ml-auto min-w-[112px] border-ss-line bg-ss-panel text-ss-ink hover:border-[color:var(--subject)]`}>
                Stop
              </button>
            ) : (
              <button type="button" aria-label={again ? 'Time again: release the pendulum and time ten swings' : 'Release the pendulum and time ten swings'} disabled={frozen} onClick={release} className={`${SEG} ml-auto min-w-[112px] border-[color:var(--subject)] bg-[color:var(--subject)] text-white`}>
                {again ? 'Time again' : 'Release'}
              </button>
            )}
          </span>
        </Row>
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

      <span className="sr-only" aria-live="polite">{`${describe(shown)} ${caption} ${measure.label}: ${measure.value}.`}</span>
      {marked !== 'idle' && (
        <div className="rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-1" data-done={pendulumEngine.check(config, shown).ok ? '1' : '0'}>
          <p className="text-[12px] font-extrabold leading-snug text-ss-ink">{verdict}</p>
        </div>
      )}
    </div>
  )
}
