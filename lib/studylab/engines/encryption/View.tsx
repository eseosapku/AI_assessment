'use client'
import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import type { SceneViewProps } from '../types'
import type { EncryptionConfig, EncryptionState, KeyTrip } from './config'
import { captionText, describe, encryptionEngine, goalText, measureOf, readState, verdictText } from './config'
import Picture, { LOCK_SEND_DONE_MS, SHARE_BARE_DONE_MS, SHARE_BOXED_DONE_MS } from './Picture'

type Props = SceneViewProps<EncryptionConfig, EncryptionState>

const SEG = 'nodrag flex h-7 select-none items-center justify-center gap-1 whitespace-nowrap rounded-lg border-2 px-1.5 text-[13px] font-bold leading-none touch-manipulation transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none'
const PLAIN = 'border-ss-line bg-ss-panel text-ss-ink hover:border-[color:var(--subject)]'
const MAIN = 'border-[color:var(--subject)] bg-[color:var(--subject)] text-white'

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-[50px] shrink-0 whitespace-nowrap text-[12px] font-bold text-ss-slate">{label}</span>
      {children}
    </div>
  )
}

export function EncryptionView({ config, state, setState, marked, reduced, locked }: Props) {
  const ok = encryptionEngine.faults(config).length === 0 && config.kind !== 'other'
  const shown: EncryptionState = readState(marked === 'shown' && ok ? encryptionEngine.solve(config) : state)
  const frozen = locked || marked === 'right' || marked === 'shown'

  // The verdict waits until the picture has finished its motion.
  const [held, setHeld] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  const hold = (ms: number) => {
    if (reduced) return
    setHeld(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setHeld(false), ms)
  }

  if (!ok) return null

  const onKey = (e: KeyboardEvent) => { if (e.key.startsWith('Arrow')) e.stopPropagation() }

  const kind = config.kind as 'lock' | 'crack' | 'share'
  const lockSent = kind === 'lock' && shown.sent
  const turnLocked = frozen || lockSent
  const turnTo = (turn: number) => {
    if (turnLocked || turn < 0 || turn > 25) return
    const tried = kind === 'crack' && turn >= 1 ? Array.from(new Set([...shown.tried, turn])).sort((a, b) => a - b) : shown.tried
    setState({ ...shown, turn, tried })
  }
  const send = () => {
    if (frozen || shown.sent) return
    hold(LOCK_SEND_DONE_MS)
    setState({ ...shown, sent: true })
  }
  const sendKey = (trip: KeyTrip) => {
    if (frozen || shown.keyTrip !== 'home') return
    hold(trip === 'bare' ? SHARE_BARE_DONE_MS : SHARE_BOXED_DONE_MS)
    setState({ ...shown, keyTrip: trip })
  }
  const startAgain = () => {
    if (frozen) return
    if (timer.current) clearTimeout(timer.current)
    setHeld(false)
    setState(encryptionEngine.initial(config))
  }
  const canRestart = !frozen && (kind === 'lock' ? shown.sent : kind === 'share' ? shown.keyTrip !== 'home' : false)

  const measures = measureOf(config, shown)
  const caption = captionText(config, shown)
  const verdict = marked !== 'idle' && !held ? verdictText(config, shown) : ''

  const startBtn = (
    <button type="button" aria-label="Bring everything back to the start" disabled={!canRestart} onClick={startAgain} className={`${SEG} ${PLAIN}`}>
      Start again
    </button>
  )

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-1.5" onKeyDown={onKey}>
      <figure className="m-0 flex w-full flex-col gap-1.5">
        <Picture mode={kind} plain={config.plain} cipherKey={config.key} turn={shown.turn} sent={shown.sent} keyTrip={shown.keyTrip} reduced={reduced} />
        <figcaption className={marked !== 'idle' ? 'sr-only' : 'text-center text-[12px] font-bold leading-snug text-ss-slate'} data-caption>{caption}</figcaption>
      </figure>

      <div className="flex flex-col gap-1">
        {kind !== 'share' && (
          <Row label="Ring">
            <button type="button" aria-label="Turn the inner ring back one letter" disabled={turnLocked || shown.turn <= 0} onClick={() => turnTo(shown.turn - 1)} className={`${SEG} ${PLAIN}`}>
              ◀ Turn back
            </button>
            <button type="button" aria-label="Turn the inner ring on one letter" disabled={turnLocked || shown.turn >= 25} onClick={() => turnTo(shown.turn + 1)} className={`${SEG} ${PLAIN}`}>
              Turn on ▶
            </button>
            {kind === 'lock' ? (
              <button type="button" aria-label="Send the note down the line to Bo" disabled={frozen || shown.sent} onClick={send} className={`${SEG} ml-auto ${MAIN}`}>
                Send the note
              </button>
            ) : (
              <span className="ml-auto" />
            )}
          </Row>
        )}
        {kind === 'share' && (
          <Row label="Send key">
            <button type="button" aria-label="Send your key down the line as it is" disabled={frozen || shown.keyTrip !== 'home'} onClick={() => sendKey('bare')} className={`${SEG} ${PLAIN}`}>
              On its own
            </button>
            <button type="button" aria-label="Shut your key in the box with Bo's open padlock, then send it" disabled={frozen || shown.keyTrip !== 'home'} onClick={() => sendKey('boxed')} className={`${SEG} ${PLAIN}`}>
              In Bo&apos;s padlock box
            </button>
          </Row>
        )}
        <div className="grid grid-cols-[1fr_auto] items-end gap-x-3 border-t border-ss-line pt-1">
          <div className="flex flex-col">
            <p className="flex flex-col">
              <span className="text-[12px] font-bold text-ss-slate">Goal</span>
              <span className="text-[13px] font-extrabold leading-snug text-ss-ink">{goalText(config)}</span>
            </p>
            <div className="mt-1">{kind === 'crack' ? null : startBtn}</div>
          </div>
          <div className="flex flex-col items-end text-right" data-measure>
            {measures.map((m) => (
              <p key={m.label} className="flex flex-col items-end leading-snug">
                <span className="text-[12px] font-bold text-ss-slate">{m.label}</span>
                <span className="text-[14px] font-extrabold text-ss-ink">{m.value}</span>
              </p>
            ))}
          </div>
        </div>
      </div>

      <span className="sr-only" aria-live="polite">{`${describe(config, shown)} ${caption}`}</span>
      {verdict && (
        <div className="rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-1" data-done={encryptionEngine.check(config, shown).ok ? '1' : '0'}>
          <p className="text-[12px] font-extrabold leading-snug text-ss-ink">{verdict}</p>
        </div>
      )}
    </div>
  )
}
