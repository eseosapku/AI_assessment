'use client'

import { motion } from 'framer-motion'
import { ArrowRight, RotateCcw, Target, Sparkles, Loader2 } from 'lucide-react'
import type { WeakArea } from '@/lib/assessment-weak-areas'

/**
 * What to do next, shown under the score on both review screens.
 *
 * A percentage is a verdict, not an instruction. This panel names the areas
 * that lost marks, lets the student jump straight to the questions they got
 * wrong, and offers the two moves that actually close the loop: go and study
 * the weak areas, or prove it by retaking the paper.
 */

/** Colour the bar by how far under water the area is. */
function barColor(accuracy: number): string {
  if (accuracy >= 70) return 'var(--ss-ok, #16B67A)'
  if (accuracy >= 40) return 'var(--ss-warn, #F0A93E)'
  return 'var(--ss-bad, #E2645F)'
}

function gapMapHref(subject: string, focus?: string): string {
  const params = new URLSearchParams()
  if (subject) params.set('subject', subject)
  if (focus) params.set('focus', focus)
  const qs = params.toString()
  return `/studylab/gap-map${qs ? `?${qs}` : ''}`
}

function AreaRow({
  area,
  onJumpToQuestion,
}: {
  area: WeakArea
  onJumpToQuestion: (questionNumber: number) => void
}) {
  return (
    <div className="rounded-2xl border border-ss-line bg-ss-panel p-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 flex-1 truncate text-[13.5px] font-bold text-ss-ink">{area.label}</p>
        <p className="shrink-0 text-[12.5px] font-extrabold" style={{ color: barColor(area.accuracy) }}>
          {area.accuracy}%
        </p>
      </div>

      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--ss-ink)]/8">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${Math.max(area.accuracy, 2)}%`, background: barColor(area.accuracy) }}
        />
      </div>

      <p className="mt-2 text-[13px] font-semibold text-ss-slate">
        {area.correct} of {area.total} correct
      </p>

      {area.missedQuestions.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[12px] font-bold uppercase tracking-wider text-ss-slate">Review</span>
          {area.missedQuestions.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onJumpToQuestion(n)}
              // The number IS the affordance: tapping scrolls the review to that
              // question, so the student never has to hunt for "question 7".
              className="rounded-full border border-ss-line bg-ss-chip px-2.5 py-1 text-[13px] font-extrabold text-ss-ink transition-colors hover:border-ss-accent hover:text-ss-accent"
              aria-label={`Jump to question ${n}`}
            >
              Q{n}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function NextStepsPanel({
  areas,
  subject,
  onJumpToQuestion,
  onRetake,
  retaking = false,
}: {
  /** Problem areas only — an empty list renders the "nothing to fix" state. */
  areas: WeakArea[]
  subject: string
  onJumpToQuestion: (questionNumber: number) => void
  onRetake?: () => void
  retaking?: boolean
}) {
  const hasGaps = areas.length > 0
  const primaryFocus = hasGaps ? areas[0].label : undefined

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden rounded-[24px] border border-ss-line bg-ss-chip"
      aria-label="What to do next"
    >
      <div className="flex items-center gap-2.5 border-b border-ss-line bg-ss-panel px-5 py-3.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[color:var(--ss-accent)]/12 text-ss-accent">
          {hasGaps ? <Target className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
        </span>
        <div className="min-w-0">
          <h2 className="text-[15px] font-extrabold text-ss-ink">
            {hasGaps ? 'What to work on next' : 'Nothing to fix here'}
          </h2>
          <p className="text-[12px] font-semibold text-ss-slate">
            {hasGaps
              ? 'These are the areas that cost you marks.'
              : 'You were solid across every area in this quiz.'}
          </p>
        </div>
      </div>

      <div className="space-y-2.5 p-4 sm:p-5">
        {hasGaps && areas.map((a) => (
          <AreaRow key={a.label} area={a} onJumpToQuestion={onJumpToQuestion} />
        ))}

        <div className="flex flex-col gap-2.5 pt-1 sm:flex-row">
          <a
            href={gapMapHref(subject, primaryFocus)}
            className="group flex flex-1 items-center justify-center gap-2 rounded-2xl bg-ss-accent px-5 py-3.5 text-[13.5px] font-extrabold text-white transition-opacity hover:opacity-90"
          >
            {hasGaps ? 'Study these areas' : 'Open my gap map'}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </a>

          {onRetake && (
            <button
              type="button"
              onClick={onRetake}
              disabled={retaking}
              className="flex items-center justify-center gap-2 rounded-2xl border border-ss-line bg-ss-panel px-5 py-3.5 text-[13.5px] font-extrabold text-ss-ink transition-colors hover:border-ss-accent hover:text-ss-accent disabled:cursor-not-allowed disabled:opacity-60"
            >
              {retaking ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              {retaking ? 'Starting…' : 'Retake quiz'}
            </button>
          )}
        </div>

        <p className="pt-0.5 text-center text-[13px] font-medium text-ss-slate">
          {hasGaps
            ? 'Studying opens your gap map, where you can pick a topic and learn it in LearnSpace.'
            : 'Retake it any time to keep the streak going.'}
        </p>
      </div>
    </motion.section>
  )
}
