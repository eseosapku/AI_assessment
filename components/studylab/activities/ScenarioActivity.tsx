// components/studylab/activities/ScenarioActivity.tsx
'use client'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ActivitySpec, ActivityState, ScenarioPayload } from '@/lib/studylab/activities/types'
import type { ScenarioWork } from '@/lib/studylab/activities/patterns/scenario'
import { assetUrl } from '@/lib/studylab/activities/assetCatalog'
import { ActivityFrame } from './ActivityFrame'
import { useActivityState } from './useActivityState'

type Choice = ScenarioPayload['choices'][number]

export function ScenarioActivity({ id, spec, onOutcome, initialState }: {
  id: string; spec: ActivitySpec; onOutcome: (o: unknown) => void; initialState?: ActivityState
}) {
  const payload = spec.payload as ScenarioPayload
  const a = useActivityState(id, spec, initialState)
  const work = a.work as unknown as ScenarioWork
  const chosen = work.chosen

  // The FIRST choice is the one that is graded (persisted in `work.chosen`
  // via useActivityState). Afterwards the student may still click OTHER
  // choices to see what would have happened — that is the point of a
  // scenario — so exploration lives in local, unpersisted state and never
  // touches `work` or the graded answer.
  const [previewId, setPreviewId] = useState<string | null>(null)
  const activeId = previewId ?? chosen

  // Scenario deliberately auto-grades on the first choice — the click IS the
  // decision, there is nothing further to submit, so there is no Check button
  // here (unlike every other pattern, which grades only when the student
  // presses Check). Grading still can't run inline in the click handler:
  // calling a.check() there would read the pre-update `work` (React state
  // hasn't re-rendered yet), so it runs from an effect instead, guarded so it
  // fires exactly once, on the transition into a first answer.
  useEffect(() => {
    if (chosen && a.state.attempts === 0) {
      const o = a.check()
      if (o) onOutcome(o)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosen, a.state.attempts])

  const pick = (choiceId: string) => {
    if (!chosen) {
      a.setWork({ chosen: choiceId })
    } else {
      setPreviewId(choiceId) // exploring only — does not re-answer
    }
  }

  const active: Choice | undefined = payload.choices.find((c) => c.id === activeId)
  const imgSrc = payload.imageUrl ? assetUrl(payload.imageUrl) : null

  return (
    <ActivityFrame
      prompt={spec.prompt} solved={a.solved} reveal={spec.reveal} revealed={a.revealed}
      hint={a.hint} hintAvailable={a.hintAvailable} onHint={a.showHint}
    >
      <div className="flex flex-col gap-3">
        {imgSrc && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imgSrc}
            alt=""
            className="mx-auto max-h-40 w-full rounded-lg border border-ss-line bg-ss-panel object-contain p-2"
          />
        )}

        <p className="text-[13px] font-semibold leading-snug text-ss-ink">{payload.situation}</p>

        <div className="flex flex-col gap-2">
          {payload.choices.map((choice) => {
            const isActive = choice.id === activeId
            const isGraded = chosen !== null && choice.id === chosen
            return (
              <button
                key={choice.id}
                type="button"
                onClick={() => pick(choice.id)}
                className={`nodrag rounded-lg border px-3 py-2 text-left text-[12.5px] font-semibold transition motion-reduce:transition-none ${
                  isActive
                    ? 'border-[color:var(--ss-accent)]/50 bg-[color:var(--ss-accent)]/10 text-ss-ink'
                    : 'border-ss-line bg-ss-panel text-ss-ink hover:border-[color:var(--ss-accent)]/40'
                }`}
              >
                {choice.label}
                {isGraded && !isActive && (
                  <span className="ml-2 text-[12px] font-normal uppercase tracking-widest text-ss-slate">
                    your choice
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* The consequence is the teaching, not a verdict — no pass/fail
            colouring here, and every choice (including defensible ones)
            shows what followed. */}
        <AnimatePresence mode="wait">
          {active && (
            <motion.div
              key={active.id}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
              className="rounded-lg border border-ss-line bg-[color:var(--ss-canvas)]/60 px-3 py-2"
            >
              <p className="text-[12px] font-bold uppercase tracking-widest text-ss-slate">What happened</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-ss-ink">{active.consequence}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {chosen && payload.followUp && (
          <p className="text-[12px] italic leading-relaxed text-ss-slate">{payload.followUp}</p>
        )}

        {chosen && (
          <p className="text-[12px] text-ss-slate">
            You can still open the other choices above to see what would have happened.
          </p>
        )}
      </div>
    </ActivityFrame>
  )
}
