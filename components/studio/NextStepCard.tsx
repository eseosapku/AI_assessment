'use client'

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, BookOpen, Clock, GraduationCap, Layers, Sparkles, Target } from 'lucide-react'
import type { NextStep } from '@/lib/study-loop'

const ICONS = {
  'first-quiz': Sparkles,
  'prove-it': Target,
  'review-cards': Layers,
  'study-gap': BookOpen,
  'exam-prep': GraduationCap,
  'keep-going': Sparkles,
} as const

/**
 * Where this step sits in the loop, and the colour it carries.
 *
 * Each kind gets its own accent so that swapping suggestions is visible at a
 * glance rather than only readable — "Not now" should look like something
 * happened, not like a caption was quietly rewritten. Only the icon tile, the
 * eyebrow and the top rail take the tone; body text stays on the standard ink
 * and slate so nothing here can fail contrast.
 */
const STAGE: Record<
  NextStep['kind'],
  { label: string; position: 1 | 2 | 3; tone: 'accent' | 'good' | 'warn' }
> = {
  'first-quiz': { label: 'Find out where you stand', position: 1, tone: 'accent' },
  'study-gap': { label: 'Get taught the weak bit', position: 2, tone: 'warn' },
  'review-cards': { label: 'Keep what you learned', position: 3, tone: 'good' },
  'prove-it': { label: 'Check that it stuck', position: 3, tone: 'accent' },
  'exam-prep': { label: 'Rehearse the real thing', position: 3, tone: 'warn' },
  'keep-going': { label: 'Find the next gap', position: 1, tone: 'accent' },
}

const VAR = { accent: '--ss-accent', good: '--ss-good', warn: '--ss-warn' } as const

const STAGES = ['Test', 'Study', 'Prove'] as const

/**
 * The one thing to do next.
 *
 * The first version changed suggestions by rewriting its own text in place,
 * which read as a glitch: press "Not now" and words silently become different
 * words, with nothing to say the press landed. Every part that depends on the
 * suggestion is keyed on it now and animates through, so setting one aside
 * looks like setting one aside.
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
  const reduced = useReducedMotion()
  const Icon = ICONS[step.kind]
  const stage = STAGE[step.kind]
  const tone = `var(${VAR[stage.tone]})`

  // Reduced motion still gets a crossfade — the point is feedback, and a fade
  // carries that without anything moving.
  const enter = reduced ? { opacity: 0 } : { opacity: 0, y: 10 }
  const settled = reduced ? { opacity: 1 } : { opacity: 1, y: 0 }
  const leave = reduced ? { opacity: 0 } : { opacity: 0, y: -10 }

  return (
    <section
      aria-labelledby="next-step-title"
      className="relative overflow-hidden rounded-[20px] border border-ss-line bg-ss-panel"
    >
      {/* A rail in the step's own colour, animated on change: the one element
          that makes a swap register peripherally rather than by reading. */}
      <motion.span
        aria-hidden
        layout
        key={`rail-${step.key}`}
        initial={{ scaleX: reduced ? 1 : 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="absolute inset-x-0 top-0 h-[3px] origin-left"
        style={{ background: tone }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full opacity-[0.07] transition-colors duration-500"
        style={{ background: tone }}
      />

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step.key}
          initial={enter}
          animate={settled}
          exit={leave}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="relative flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:gap-8"
        >
          <div className="flex min-w-0 flex-1 items-start gap-4">
            <span
              className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl"
              style={{ background: `color-mix(in srgb, ${tone} 12%, transparent)`, color: tone }}
            >
              <Icon className="h-5 w-5" strokeWidth={2} />
            </span>

            <div className="min-w-0">
              <p className="text-[12px] font-black uppercase tracking-[0.14em]" style={{ color: tone }}>
                Do this next
                <span className="ml-2 font-bold normal-case tracking-normal text-ss-slate">{stage.label}</span>
              </p>
              <h2
                id="next-step-title"
                className="mt-1.5 text-[19px] font-extrabold leading-snug text-ss-ink sm:text-[21px]"
              >
                {step.title}
              </h2>
              <p className="mt-1.5 max-w-2xl text-[13.5px] font-medium leading-relaxed text-ss-slate">{step.reason}</p>
            </div>
          </div>

          {/* Right-hand action column on wide screens; underneath on narrow
              ones, where a horizontal split would squeeze both halves. */}
          <div className="flex shrink-0 flex-col items-start gap-2 lg:items-end">
            <button
              type="button"
              onClick={onAct}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-[14.5px] font-extrabold text-white transition-transform hover:scale-[1.02] active:scale-[0.99] disabled:opacity-60 disabled:hover:scale-100"
              style={{ background: tone }}
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
        </motion.div>
      </AnimatePresence>

      <div className="relative flex items-center justify-between gap-3 border-t border-ss-line bg-ss-chip px-5 py-2.5 sm:px-6">
        {/* Test › Study › Prove, current leg lit: three words saying what the
            product is for, on the screen students open most. */}
        <div className="flex items-center gap-1.5" aria-hidden>
          {STAGES.map((name, i) => {
            const active = i + 1 === stage.position
            return (
              <div key={name} className="flex items-center gap-1.5">
                <motion.span
                  animate={{ opacity: active ? 1 : 0.55 }}
                  transition={{ duration: 0.25 }}
                  className="text-[12px] font-bold"
                  style={{ color: active ? tone : 'var(--ss-slate)' }}
                >
                  {name}
                </motion.span>
                {i < STAGES.length - 1 && <span className="text-[color:var(--ss-slate)]/40">›</span>}
              </div>
            )
          })}
        </div>
        <p aria-live="polite" className="sr-only">
          {step.title}. Step {stage.position} of 3 in the study cycle: test, study, prove.
        </p>

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
    </section>
  )
}
