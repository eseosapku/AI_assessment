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
 * The one thing to do next.
 *
 * Sits above the statistics deliberately. A student at 43% opening a screen of
 * averages and bar charts has been handed a report, not a plan; the first thing
 * on the page should be a topic, a button and a number of minutes.
 */
export function NextStepCard({
  step,
  onAct,
  busy = false,
}: {
  step: NextStep
  onAct: () => void
  busy?: boolean
}) {
  const Icon = ICONS[step.kind]

  return (
    <section
      aria-labelledby="next-step-title"
      className="rounded-[22px] border border-[color:var(--ss-accent)]/25 bg-[color:var(--ss-accent)]/[0.06] p-5 sm:p-6"
    >
      <div className="flex items-start gap-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-ss-accent text-white">
          <Icon className="h-5 w-5" strokeWidth={2} />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-black uppercase tracking-[0.14em] text-ss-accent">Do this next</p>
          <h2 id="next-step-title" className="mt-1 text-[19px] font-extrabold leading-snug text-ss-ink">
            {step.title}
          </h2>
          <p className="mt-1.5 max-w-2xl text-[13.5px] font-medium leading-relaxed text-ss-slate">{step.reason}</p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onAct}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-full bg-ss-accent px-5 py-2.5 text-[14px] font-extrabold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {busy ? 'Getting it ready…' : step.cta}
              {!busy && <ArrowRight className="h-4 w-4" />}
            </button>
            {/* The time estimate is what makes the difference between "later"
                and "now" for someone with ten minutes before a lesson. */}
            <span className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-ss-slate">
              <Clock className="h-3.5 w-3.5" aria-hidden />
              About {step.minutes} min
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
