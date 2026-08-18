'use client'

import { ArrowRight, BookOpen, Clock, Layers, Sparkles, Target } from 'lucide-react'
import type { NextStep } from '@/lib/study-loop'

const ICONS = {
  'first-quiz': Sparkles,
  'prove-it': Target,
  'review-cards': Layers,
  'study-gap': BookOpen,
  'keep-going': Sparkles,
} as const

/**
 * Where this step sits in the loop, in the student's words. The card is one
 * move in a cycle, and showing the cycle is what stops it reading as a random
 * suggestion.
 */
const STAGE: Record<NextStep['kind'], { label: string; position: 1 | 2 | 3 }> = {
  'first-quiz': { label: 'Find out where you stand', position: 1 },
  'study-gap': { label: 'Get taught the weak bit', position: 2 },
  'review-cards': { label: 'Keep what you learned', position: 3 },
  'prove-it': { label: 'Check that it stuck', position: 3 },
  'keep-going': { label: 'Find the next gap', position: 1 },
}

const STAGES = ['Test', 'Study', 'Prove'] as const

/**
 * The one thing to do next — the advice panel, not the front door.
 *
 * This started as a full-width gradient sitting under another full-width
 * gradient, and the two competed: the page asked twice, in the same voice, and
 * "Create assessment" got squeezed into fourth place in a row of controls
 * despite being the product's main action.
 *
 * So the hierarchy is carried by contrast rather than by volume. Building a
 * quiz is the one saturated surface on the page, and this sits beside it as a
 * light panel with an accent spine: unmissable, obviously secondary, and no
 * longer shouting over the thing it is meant to complement.
 */
export function NextStepCard({
  step,
  onAct,
  onSetAside,
  busy = false,
}: {
  step: NextStep
  onAct: () => void
  /** Absent when there is genuinely nothing else to suggest. */
  onSetAside?: () => void
  busy?: boolean
}) {
  const Icon = ICONS[step.kind]
  const stage = STAGE[step.kind]

  return (
    <section
      aria-labelledby="next-step-title"
      className="flex h-full flex-col rounded-[24px] border border-ss-line bg-ss-panel p-6 shadow-ss-panel"
    >
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[color:var(--ss-accent)]/12 text-ss-accent">
          <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <p className="text-[12px] font-black uppercase tracking-[0.14em] text-ss-accent">Do this next</p>
          <p className="text-[12.5px] font-semibold text-ss-slate">{stage.label}</p>
        </div>
      </div>

      <h2 id="next-step-title" className="mt-4 text-[19px] font-extrabold leading-snug text-ss-ink">
        {step.title}
      </h2>
      <p className="mt-2 text-[13.5px] font-medium leading-relaxed text-ss-slate">{step.reason}</p>

      {/* Pushed to the bottom so the panel's actions line up with the hero's,
          however long the reason runs. */}
      <div className="mt-auto pt-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <button
            type="button"
            onClick={onAct}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-ss-accent px-5 py-2.5 text-[14px] font-extrabold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {busy ? 'Getting it ready…' : step.cta}
            {!busy && <ArrowRight className="h-4 w-4" />}
          </button>
          {/* The time estimate decides between "later" and "now" for someone
              with ten minutes before a lesson. */}
          <span className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-ss-slate">
            <Clock className="h-3.5 w-3.5" aria-hidden />
            About {step.minutes} min
          </span>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-ss-line pt-3.5">
          {/* Test → Study → Prove, current leg lit: three words saying what the
              product is for, on the screen students open most. */}
          <div className="flex items-center gap-1.5" aria-hidden>
            {STAGES.map((name, i) => {
              const active = i + 1 === stage.position
              return (
                <div key={name} className="flex items-center gap-1.5">
                  <span
                    className={`text-[12px] font-bold transition-colors ${
                      active ? 'text-ss-accent' : 'text-[color:var(--ss-slate)]/60'
                    }`}
                  >
                    {name}
                  </span>
                  {i < STAGES.length - 1 && <span className="text-[color:var(--ss-slate)]/40">›</span>}
                </div>
              )
            })}
          </div>
          <p className="sr-only">Step {stage.position} of 3 in the study cycle: test, study, prove.</p>

          {onSetAside && !busy && (
            <button
              type="button"
              onClick={onSetAside}
              className="shrink-0 text-[12.5px] font-bold text-ss-slate underline underline-offset-2 transition-colors hover:text-ss-ink"
            >
              Not now
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
