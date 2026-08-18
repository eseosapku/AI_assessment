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
 * Where the loop sits, in the student's words. The card is one move in a cycle,
 * and showing the cycle is what stops it reading as a random suggestion.
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
 * The one thing to do next.
 *
 * Sits above the statistics deliberately. A student at 43% opening a screen of
 * averages and bar charts has been handed a report, not a plan; the first thing
 * on the page should be a topic, a button and a number of minutes.
 *
 * It is loud on purpose. The first version was a quiet bordered box that read
 * as one panel among six, and advice that looks like furniture gets treated
 * like furniture.
 */
export function NextStepCard({
  step,
  onAct,
  onSetAside,
  secondaryLabel,
  onSecondary,
  busy = false,
}: {
  step: NextStep
  onAct: () => void
  /** Absent when there is genuinely nothing else to suggest. */
  onSetAside?: () => void
  /**
   * Always-available escape hatch, when the suggestion is something other than
   * building a quiz. This card replaced a hero whose only job was "Create
   * assessment", and quietly removing that route would have undone U3 — a
   * tester could not find the builder in the first place.
   */
  secondaryLabel?: string
  onSecondary?: () => void
  busy?: boolean
}) {
  const Icon = ICONS[step.kind]
  const stage = STAGE[step.kind]

  return (
    <section
      aria-labelledby="next-step-title"
      className="relative overflow-hidden rounded-[24px] p-6 text-white shadow-[0_18px_40px_-20px_rgba(12,111,174,0.75)] sm:p-7"
      style={{ background: 'linear-gradient(118deg,#0C74B4,#0E94D6 54%,#2ACBF2)' }}
    >
      <div aria-hidden className="pointer-events-none absolute -right-12 -top-16 h-52 w-52 rounded-full bg-white/12" />
      <div aria-hidden className="pointer-events-none absolute -bottom-20 right-24 h-40 w-40 rounded-full bg-white/8" />

      <div className="relative flex items-start gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/20 backdrop-blur">
          <Icon className="h-6 w-6" strokeWidth={2} />
        </span>

        <div className="min-w-0 flex-1">
          {/* Which part of the loop this is. Without it the card is a bare
              instruction; with it the student can see the shape of the thing
              they are being walked through. */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-[12px] font-black uppercase tracking-[0.16em] text-white/90">Do this next</p>
            <span aria-hidden className="text-white/40">·</span>
            <p className="text-[12px] font-bold text-white/80">{stage.label}</p>
          </div>

          <h2 id="next-step-title" className="mt-2 text-[22px] font-extrabold leading-tight sm:text-[25px]">
            {step.title}
          </h2>
          <p className="mt-2 max-w-2xl text-[14px] font-medium leading-relaxed text-white/85">{step.reason}</p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onAct}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-full bg-[#13202A] px-6 py-3 text-[14.5px] font-extrabold text-white transition-transform hover:scale-[1.02] active:scale-[0.99] disabled:opacity-70 disabled:hover:scale-100"
            >
              {busy ? 'Getting it ready…' : step.cta}
              {!busy && (
                <span className="grid h-6 w-6 place-items-center rounded-full bg-white text-[#13202A]">
                  <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </button>

            {/* The time estimate decides between "later" and "now" for someone
                with ten minutes before a lesson. */}
            <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-white/85">
              <Clock className="h-4 w-4" aria-hidden />
              About {step.minutes} min
            </span>

            {secondaryLabel && onSecondary && !busy && (
              <button
                type="button"
                onClick={onSecondary}
                className="inline-flex items-center gap-2 rounded-full border border-white/40 px-4 py-2.5 text-[13.5px] font-bold text-white transition-colors hover:bg-white/15"
              >
                {secondaryLabel}
              </button>
            )}

            {onSetAside && !busy && (
              <button
                type="button"
                onClick={onSetAside}
                className="ml-auto text-[13px] font-bold text-white/75 underline underline-offset-4 transition-colors hover:text-white"
              >
                Not now — show me something else
              </button>
            )}
          </div>

          {/* Test → Study → Prove, with the current leg lit. Three words that
              say what the product is for, on the screen students open most. */}
          <div className="mt-5 flex items-center gap-2" aria-hidden>
            {STAGES.map((name, i) => {
              const active = i + 1 === stage.position
              return (
                <div key={name} className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[12px] font-bold transition-colors ${
                      active ? 'bg-white text-[#0C6FAE]' : 'bg-white/15 text-white/75'
                    }`}
                  >
                    {name}
                  </span>
                  {i < STAGES.length - 1 && <span className="text-white/40">→</span>}
                </div>
              )
            })}
          </div>
          <p className="sr-only">
            Step {stage.position} of 3 in the study cycle: test, study, prove.
          </p>
        </div>
      </div>
    </section>
  )
}
