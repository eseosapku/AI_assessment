'use client'

import type { ReactNode } from 'react'
import { useEffect, useRef } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, Map } from 'lucide-react'
import { Kana } from '../kana/Kana'
import { motionFor, useCountUp } from '@/lib/studylab/motionPresets'
import { playSound } from '@/lib/studylab/sound'
import type { LessonSummary } from '@/lib/studylab/scenes'

/**
 * The end of the lesson, over the whole board zoomed out behind it: what was
 * mastered, what was practised and how long it took, counted up. Then the way
 * on -- a fresh quiz that moves the Gap Map -- or a look back over the board.
 */
export function LessonCompleteScene({
  title,
  summary,
  before,
  onProveIt,
  provingIt,
  proveFailed,
  proveUpdatesGapMap,
  onClose,
  mascot,
}: {
  /** Who celebrates. Kana, unless the stage says otherwise. */
  mascot?: ReactNode
  title: string
  summary: LessonSummary
  before?: { title: string; accuracy: number } | null
  onProveIt?: () => void
  provingIt?: boolean
  /** The last try could not build the quiz. The chat is shut behind this screen, so it says so here. */
  proveFailed?: boolean
  proveUpdatesGapMap?: boolean
  onClose: () => void
}) {
  const reduced = useReducedMotion() ?? false
  const rise = motionFor('rise', reduced)
  const closeRef = useRef<HTMLButtonElement>(null)
  // Once, when the scene opens. The stage re-renders under it -- the camera
  // settling, the time-on-task tick every 15s -- and each re-run replayed the
  // fanfare and pulled focus back from whatever the learner had tabbed to.
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    playSound('lessonComplete')
    closeRef.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close.current()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center p-4"
      style={{ backgroundColor: 'color-mix(in srgb, var(--ss-canvas) 55%, transparent)' }}
    >
      <motion.section
        role="dialog"
        aria-modal="false"
        aria-labelledby="lesson-complete-title"
        initial={rise.initial}
        animate={rise.animate}
        transition={rise.transition}
        className="w-full max-w-[520px] overflow-hidden rounded-3xl border border-ss-line bg-ss-panel shadow-[0_32px_70px_-28px_rgba(20,60,90,0.6)]"
      >
        <header
          className="flex flex-col items-center px-6 pb-5 pt-7 text-center"
          style={{ backgroundColor: 'color-mix(in srgb, var(--subject) 12%, var(--ss-panel))' }}
        >
          {mascot ?? <Kana pose="celebrate" size={84} />}
          <h2 id="lesson-complete-title" className="mt-2 text-[24px] font-extrabold tracking-tight text-ss-ink">Lesson complete</h2>
          <p className="mt-1 text-[14px] font-semibold text-ss-slate [text-wrap:balance]">{title}</p>
        </header>
        <div className="grid grid-cols-3 divide-x divide-ss-line border-b border-ss-line">
          <Stat value={summary.stations} label={summary.stations === 1 ? 'station mastered' : 'stations mastered'} note={summary.known > 0 ? `+ ${summary.known} tested out` : undefined} />
          <Stat value={summary.practised} label={summary.practised === 1 ? 'question right' : 'questions right'} />
          <Stat value={summary.minutes} label={summary.minutes === 1 ? 'minute learning' : 'minutes learning'} />
        </div>
        <div className="flex flex-col gap-2.5 px-6 py-5">
          {before && (
            <p className="text-[13px] font-semibold text-ss-ink">
              Before this lesson: {before.accuracy}% on {before.title}. Take the quiz to see where you are now.
            </p>
          )}
          {onProveIt && (
            <button
              type="button"
              onClick={onProveIt}
              disabled={provingIt}
              className="ss-press inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl px-5 text-[14px] font-bold disabled:opacity-60"
              style={{ backgroundColor: 'var(--subject)', color: 'var(--ss-panel)' }}
            >
              {provingIt ? 'Building your quiz…' : 'Prove it — take the quiz'}
              {!provingIt && <ArrowRight className="h-4 w-4" aria-hidden />}
            </button>
          )}
          {onProveIt && proveFailed && !provingIt && (
            <p role="alert" className="text-center text-[13px] font-bold" style={{ color: 'var(--ss-bad)' }}>
              Couldn&apos;t build the quiz just now. Press it again to try.
            </p>
          )}
          {onProveIt && !(proveFailed && !provingIt) && (
            <p className="text-center text-[12px] font-medium text-ss-slate">
              {proveUpdatesGapMap ? 'Fresh questions on this topic. Your score updates your gap map.' : 'Fresh questions on this topic.'}
            </p>
          )}
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="ss-press inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-ss-chip px-5 text-[13.5px] font-bold text-ss-ink"
          >
            <Map className="h-4 w-4" aria-hidden />
            Look over the board
          </button>
        </div>
      </motion.section>
    </div>
  )
}

function Stat({ value, label, note }: { value: number; label: string; note?: string }) {
  const shown = useCountUp(value)
  return (
    <div className="flex flex-col items-center px-3 py-4 text-center">
      <span className="text-[28px] font-extrabold leading-none tabular-nums text-ss-ink">{shown}</span>
      <span className="mt-1.5 text-[12px] font-semibold leading-tight text-ss-slate">{label}</span>
      {note && <span className="mt-1 text-[12px] font-semibold text-ss-subject-ink">{note}</span>}
    </div>
  )
}
