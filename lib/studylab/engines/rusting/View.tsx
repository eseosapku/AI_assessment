'use client'
import { useEffect, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import type { SceneViewProps } from '../types'
import type { Protection, RustConfig, RustState, Water, Air } from './config'
import { captionText, describe, goalText, optionsOf, readState, readoutText, rustingEngine, verdictText } from './config'
import Picture, { DAY_MS, WEEK } from './Picture'

type Props = SceneViewProps<RustConfig, RustState>

const SEG = 'nodrag flex h-7 select-none items-center justify-center gap-1 whitespace-nowrap rounded-lg border-2 px-1.5 text-[13px] font-bold leading-none touch-manipulation transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none'
const SEG_TIGHT = SEG.replace('px-1.5', 'px-0.5').replace('text-[13px]', 'text-[12px]')
const look = (active: boolean) => (active ? 'border-[color:var(--subject)] bg-ss-chip text-ss-ink' : 'border-ss-line bg-ss-panel text-ss-slate hover:border-[color:var(--subject)]')
const PRIMARY = 'border-[color:var(--subject)] bg-[color:var(--subject)] text-white'
const PLAIN = 'border-ss-line bg-ss-panel text-ss-ink hover:border-[color:var(--subject)]'

function Row({ label, narrow, children }: { label: string; narrow?: boolean; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`${narrow ? 'w-[52px]' : 'w-[76px]'} shrink-0 whitespace-nowrap text-[12px] font-bold text-ss-slate`}>{label}</span>
      {children}
    </div>
  )
}

const WATERS: { value: Water; text: string; label: string }[] = [
  { value: 'none', text: 'None', label: 'Water: none' },
  { value: 'tap', text: 'Tap water', label: 'Water: tap water' },
  { value: 'salt', text: 'Salt water', label: 'Water: salt water' },
]
const AIRS: { value: Air; text: string; label: string }[] = [
  { value: 'out', text: 'Kept out', label: 'Air: kept out' },
  { value: 'in', text: 'Let in', label: 'Air: let in' },
]
const PROTECTIONS: Record<Protection, { text: string; label: string }> = {
  none: { text: 'Nothing', label: 'Protect with: nothing' },
  paint: { text: 'Paint', label: 'Protect with: paint' },
  grease: { text: 'Grease', label: 'Protect with: grease' },
  zinc: { text: 'Zinc coat', label: 'Protect with: a zinc coat' },
  magnesium: { text: 'Magnesium', label: 'Protect with: a magnesium strip' },
}

export function RustingView({ config, state, setState, marked, reduced, locked }: Props) {
  const ok = rustingEngine.faults(config).length === 0 && config.kind !== 'other'
  const shown: RustState = readState(marked === 'shown' && ok ? rustingEngine.solve(config) : state)
  const frozen = locked || marked === 'right' || marked === 'shown'

  // The week: the day counter steps while the nail is left, and the Picture grows the rust between steps.
  const [day, setDay] = useState(shown.left ? WEEK : 0)
  const [trial, setTrial] = useState(0)
  useEffect(() => {
    if (!shown.left) {
      setDay(0)
      return
    }
    if (reduced) {
      setDay(WEEK)
      return
    }
    if (day >= WEEK) return
    const t = setTimeout(() => setDay((d) => Math.min(WEEK, d + 1)), DAY_MS)
    return () => clearTimeout(t)
  }, [shown.left, reduced, day])

  if (!ok) return null

  const onKey = (e: KeyboardEvent) => { if (e.key.startsWith('Arrow')) e.stopPropagation() }

  const shownDay = !shown.left ? 0 : reduced || frozen ? WEEK : day
  const passing = shown.left && shownDay < WEEK
  const busy = frozen || shown.left
  const protect = config.kind === 'protect'
  const options = optionsOf(config)
  const salt = config.kind === 'needs' && config.salt === true

  const set = (patch: Partial<RustState>) => {
    if (busy) return
    setState({ ...shown, ...patch })
  }
  const leave = () => {
    if (busy) return
    setDay(0)
    setState({ ...shown, left: true })
  }
  const fresh = () => {
    if (frozen || passing) return
    setTrial((n) => n + 1)
    setDay(0)
    setState({ ...shown, left: false, scratched: false })
  }

  const caption = captionText(config, shown, shownDay)
  const readout = readoutText(shown, shownDay)
  const verdict = marked !== 'idle' ? verdictText(config, shown) : ''
  const waters = salt ? WATERS : WATERS.filter((w) => w.value !== 'salt')

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-1" onKeyDown={onKey}>
      <figure className="m-0 flex w-full flex-col gap-1">
        <Picture
          key={trial}
          water={protect ? 'tap' : shown.water}
          air={protect ? 'in' : shown.air}
          protection={protect ? shown.protection : 'none'}
          scratched={protect ? shown.scratched : false}
          day={shownDay}
          reduced={reduced}
        />
        <figcaption className={marked !== 'idle' ? 'sr-only' : 'text-center text-[12px] font-bold leading-snug text-ss-slate'} data-caption>{caption}</figcaption>
      </figure>

      <div className="flex flex-col gap-1">
        {protect ? (
          <Row label="Protect" narrow>
            <span className="grid flex-1 gap-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }} role="group" aria-label="Protect the nail with">
              {options.map((p) => (
                <button key={p} type="button" aria-pressed={shown.protection === p} aria-label={PROTECTIONS[p].label} disabled={busy} onClick={() => set({ protection: p })} className={`${SEG_TIGHT} ${look(shown.protection === p)}`}>
                  {PROTECTIONS[p].text}
                </button>
              ))}
            </span>
          </Row>
        ) : (
          <>
            <Row label="Water">
              <span className={`grid flex-1 gap-1 ${salt ? 'grid-cols-3' : 'grid-cols-2'}`} role="group" aria-label="Water in the tube">
                {waters.map((b) => (
                  <button key={b.value} type="button" aria-pressed={shown.water === b.value} aria-label={b.label} disabled={busy} onClick={() => set({ water: b.value })} className={`${SEG} ${look(shown.water === b.value)}`}>
                    {b.text}
                  </button>
                ))}
              </span>
            </Row>
            <Row label="Air">
              <span className="grid flex-1 grid-cols-2 gap-1" role="group" aria-label="Air reaching the nail">
                {AIRS.map((b) => (
                  <button key={b.value} type="button" aria-pressed={shown.air === b.value} aria-label={b.label} disabled={busy} onClick={() => set({ air: b.value })} className={`${SEG} ${look(shown.air === b.value)}`}>
                    {b.text}
                  </button>
                ))}
              </span>
            </Row>
          </>
        )}
        <div className="flex items-center gap-1">
          {protect && (
            <button type="button" aria-pressed={shown.scratched} aria-label="Scratch the nail" disabled={busy} onClick={() => set({ scratched: !shown.scratched })} className={`${SEG} flex-1 ${look(shown.scratched)}`}>
              Scratch it
            </button>
          )}
          <button type="button" aria-label="Leave the nail for a week" disabled={busy} onClick={leave} className={`${SEG} flex-[1.4] ${PRIMARY}`}>
            Leave for a week
          </button>
          <button type="button" aria-label="Start again with a new nail" disabled={frozen || !shown.left || passing} onClick={fresh} className={`${SEG} flex-1 ${PLAIN}`}>
            New nail
          </button>
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-x-4 border-t border-ss-line pt-1">
          <p className="flex flex-col">
            <span className="text-[12px] font-bold text-ss-slate">Goal</span>
            <span className="text-[13px] font-extrabold leading-snug text-ss-ink">{goalText(config)}</span>
          </p>
          <p className="flex flex-col items-end text-right">
            <span className="text-[12px] font-bold text-ss-slate">Rust</span>
            <span className="text-[15px] font-extrabold leading-snug text-ss-ink" data-measure>{readout}</span>
          </p>
        </div>
      </div>

      <span className="sr-only" aria-live="polite">{`${describe(shown)} ${caption} Rust: ${readout}.`}</span>
      {marked !== 'idle' && (
        <div className="rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-0.5" data-done={rustingEngine.check(config, shown).ok ? '1' : '0'}>
          <p className="text-[12px] font-extrabold leading-snug text-ss-ink">{verdict}</p>
        </div>
      )}
    </div>
  )
}
