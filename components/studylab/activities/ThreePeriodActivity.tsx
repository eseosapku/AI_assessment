// components/studylab/activities/ThreePeriodActivity.tsx
'use client'
import { useEffect, useMemo, useRef } from 'react'
import { motion } from 'framer-motion'
import type { ActivitySpec, ActivityState, ThreePeriodPayload } from '@/lib/studylab/activities/types'
import type { ThreePeriodWork } from '@/lib/studylab/activities/patterns/threePeriod'
import { seededShuffle } from '@/lib/studylab/activities/shuffle'
import { assetUrl } from '@/lib/studylab/activities/assetCatalog'
import { shakeElement } from '@/lib/studylab/activities/motion'
import { ActivityFrame } from './ActivityFrame'
import { useActivityState } from './useActivityState'

type Item = ThreePeriodPayload['items'][number]

/** Picture-first: the image IS the lesson. Text is only a fallback. */
function ItemArt({ item, size = 84 }: { item: Item; size?: number }) {
  const src = item.imageUrl ? assetUrl(item.imageUrl) : null
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={item.label}
        width={size}
        height={size}
        className="rounded-lg border border-ss-line bg-ss-panel object-contain p-1.5"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <div
      className="flex items-center justify-center rounded-lg border border-ss-line bg-ss-panel text-center text-[13px] font-bold leading-tight text-ss-ink"
      style={{ width: size, height: size }}
    >
      {item.label}
    </div>
  )
}

export function ThreePeriodActivity({ id, spec, onOutcome, initialState }: {
  id: string; spec: ActivitySpec; onOutcome: (o: unknown) => void; initialState?: ActivityState
}) {
  const payload = spec.payload as ThreePeriodPayload
  const a = useActivityState(id, spec, initialState)
  const work = a.work as unknown as ThreePeriodWork
  const answers = work.answers ?? {}
  const rootRef = useRef<HTMLDivElement>(null)

  // Present/identify walk-through position lives in `work.presentIdx` /
  // `work.identifyIdx` (not local useState) so a remount mid-walkthrough —
  // e.g. a reload after the board persists — resumes where the student left
  // off instead of restarting at item 0.
  const presentIdx = work.presentIdx ?? 0
  const identifyIdx = work.identifyIdx ?? 0

  const options = useMemo(
    () => seededShuffle(payload.items, spec.seed ?? 1),
    [payload.items, spec.seed],
  )
  const labelOptions = useMemo(
    () => seededShuffle(payload.items.map((i) => i.label), (spec.seed ?? 1) + 1),
    [payload.items, spec.seed],
  )

  const setPhase = (phase: number) => a.setWork({ phase, answers, presentIdx, identifyIdx })
  const setPresentIdx = (next: number) => a.setWork({ phase: work.phase, answers, presentIdx: next, identifyIdx })
  const setIdentifyIdx = (next: number) => a.setWork({ phase: work.phase, answers, presentIdx, identifyIdx: next })

  // Identify's walk-through has no Check button — it hands off to recall on
  // its own once every item has been found. Done as an effect (not inline
  // during render) so we never call setState on the parent hook mid-render.
  useEffect(() => {
    if (work.phase === 1 && identifyIdx >= payload.items.length) setPhase(2)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [work.phase, identifyIdx, payload.items.length])

  const shake = (itemId: string) => {
    const el = rootRef.current?.querySelector(`[data-item="${CSS.escape(itemId)}"]`)
    shakeElement(el, [
      { transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' },
    ])
  }

  // ── Period 1: present — the material names each item, no question asked ──
  if (work.phase === 0) {
    const item = payload.items[presentIdx]
    const isLast = presentIdx === payload.items.length - 1
    return (
      <ActivityFrame
        prompt={spec.prompt} solved={a.solved} reveal={spec.reveal} revealed={a.revealed}
        hint={a.hint} hintAvailable={a.hintAvailable} onHint={a.showHint}
      >
        <div ref={rootRef} className="flex flex-col items-center gap-3 py-2">
          <ItemArt item={item} size={112} />
          <p className="text-[13px] font-semibold text-ss-ink">This is {item.label}.</p>
          <button
            type="button"
            onClick={() => (isLast ? setPhase(1) : setPresentIdx(presentIdx + 1))}
            className="nodrag rounded-full bg-ss-accent px-4 py-1.5 text-[12px] font-bold text-white transition hover:brightness-95 motion-reduce:transition-none"
          >
            {isLast ? 'Continue' : 'Next'}
          </button>
          <p className="text-[12px] uppercase tracking-widest text-ss-slate">
            {presentIdx + 1} / {payload.items.length}
          </p>
        </div>
      </ActivityFrame>
    )
  }

  // ── Period 2: identify — given a name, the student picks the matching item ──
  if (work.phase === 1 && identifyIdx < payload.items.length) {
    const target = payload.items[identifyIdx]
    return (
      <ActivityFrame
        prompt={spec.prompt} solved={a.solved} reveal={spec.reveal} revealed={a.revealed}
        hint={a.hint} hintAvailable={a.hintAvailable} onHint={a.showHint}
      >
        <div ref={rootRef} className="flex flex-col gap-3">
          <p className="text-center text-[13px] font-semibold text-ss-ink">Show me: {target.label}</p>
          <div className="flex flex-wrap justify-center gap-2.5">
            {options.map((item) => (
              <motion.button
                key={item.id}
                type="button"
                data-item={item.id}
                onClick={() => {
                  if (item.id === target.id) setIdentifyIdx(identifyIdx + 1)
                  else {
                    shake(item.id) // control of error: quietly re-ask, no scolding
                    a.recordReject(item.id, target.id)
                  }
                }}
                className="nodrag cursor-pointer"
              >
                <ItemArt item={item} />
              </motion.button>
            ))}
          </div>
          <p className="text-center text-[12px] uppercase tracking-widest text-ss-slate">
            {identifyIdx + 1} / {payload.items.length}
          </p>
        </div>
      </ActivityFrame>
    )
  }

  // ── Period 3: recall — given an item, the student supplies the name ──
  // A wrong answer (known only after Check) quietly resurfaces its item for
  // another try instead of scolding or locking the student out.
  const pending = payload.items.find((i) => !answers[i.id] || a.wrongIds.includes(i.id))
  return (
    <ActivityFrame
      prompt={spec.prompt} solved={a.solved} reveal={spec.reveal} revealed={a.revealed}
      hint={a.hint} hintAvailable={a.hintAvailable} onHint={a.showHint}
      onCheck={() => { const o = a.check(); if (o) onOutcome(o) }}
    >
      <div ref={rootRef} className="flex flex-col items-center gap-3 py-1">
        {pending ? (
          <>
            <p className="text-[13px] font-semibold text-ss-ink">What is this?</p>
            <ItemArt item={pending} size={112} />
            <div data-item={pending.id} className="flex flex-wrap justify-center gap-2">
              {labelOptions.map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => a.setWork({ phase: 2, answers: { ...answers, [pending.id]: label }, presentIdx, identifyIdx })}
                  className={`nodrag rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition motion-reduce:transition-none ${
                    a.wrongIds.includes(pending.id)
                      ? 'border-red-400/40 bg-red-500/10 text-red-600 dark:text-red-400'
                      : 'border-ss-line bg-ss-panel text-ss-ink hover:border-[color:var(--ss-accent)]/40'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </>
        ) : (
          <span className="text-[12px] italic text-ss-slate">All named — press Check.</span>
        )}
      </div>
    </ActivityFrame>
  )
}
