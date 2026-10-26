'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { X, Check, ChevronDown, Lock, Plus, FastForward } from 'lucide-react'
import type { PlanStep } from '@/lib/studylab/types'
import { STAGES, type LessonRun, type Stage } from '@/lib/studylab/lessonRun'
import { policyFor, type LessonPolicy, type Pace } from '@/lib/studylab/lessonPolicy'
import { barSegments, barProgress, type BarSegment } from '@/lib/studylab/progressBar'
import { railIsLive } from '@/lib/studylab/planRail'
import { motionFor } from '@/lib/studylab/motionPresets'
import { Inky } from '../inky/Inky'

export interface LessonTopBarProps {
  title: string
  subject?: string | null
  currentStep: number
  groups: { id: string; label: string }[]
  plan?: PlanStep[]
  cardCount: number
  onBack: () => void
  onFocusGroup: (id: string) => void
  run?: LessonRun | null
  policy?: LessonPolicy
  /** Where the space came from, so the list can name what it is listing. */
  origin?: string
  /** Homework: another page of the same assignment, to add to the list. */
  onAddPage?: (file: File) => void
  onTestOut?: (stepId: string) => void
  onJump?: (stepId: string) => void
  /** Kept for callers; there is one pace now, so nothing here sets it. */
  onSetPace?: (pace: Pace) => void
  /** True while a request is in flight, so the bar stops accepting clicks it would drop. */
  busy?: boolean
}

const STAGE_NAMES: Record<Stage, string> = { explore: 'Try it', name: 'Name it', practice: 'Practise', check: 'Check' }

/**
 * The lesson across the top, Brilliant-style: a way out, one bar for the
 * whole lesson -- a segment a station, finished ones full and ticked, the one
 * being taught filling by its stages -- and the steps behind one button, to
 * go back to one or skip ahead.
 *
 * It replaces the path down the left. The ticks already say what is done, so
 * there are no "You already know / Start here / Later" sections to read.
 */
export function LessonTopBar({
  title,
  subject,
  currentStep,
  groups,
  plan,
  onBack,
  onFocusGroup,
  run,
  policy = policyFor('scratch'),
  origin,
  onAddPage,
  onTestOut = () => {},
  onJump = () => {},
  busy = false,
}: LessonTopBarProps) {
  const reduced = useReducedMotion() ?? false
  const homework = origin === 'homework'
  const live = railIsLive(run ?? null)
  // A space from before lesson runs has only its plan, or only its groups.
  const segments: BarSegment[] = run ? barSegments(run, policy) : legacySegments(plan, currentStep)
  const done = segments.filter((s) => s.status === 'done' || s.status === 'known').length
  const at = segments.findIndex((s) => s.status === 'current')
  const progress = barProgress(segments)

  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const pageInput = useRef<HTMLInputElement>(null)
  const close = (refocus = true) => {
    setOpen(false)
    if (refocus) trigger.current?.focus({ preventScroll: true })
  }
  // Escape and a click elsewhere close the list; opening it puts focus on the station being taught.
  useEffect(() => {
    if (!open) return
    const first = panel.current?.querySelector<HTMLElement>('[aria-current="step"], button:not([disabled])')
    first?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
      }
    }
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (!panel.current?.contains(t) && !trigger.current?.contains(t)) close(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const noun = homework ? 'question' : 'step'
  // The button names where the learner is: the station being taught, or the
  // lesson itself while the plan is agreed and once it is done.
  const here = at >= 0 ? segments[at] : null
  const heading = here?.title ?? title

  return (
    <header
      className="relative z-40 flex h-14 shrink-0 items-center gap-2 border-b border-ss-line bg-ss-panel px-2 sm:gap-4 sm:px-4"
      aria-label="Lesson progress"
    >
      <button
        type="button"
        onClick={onBack}
        aria-label="Back to all LearnSpaces"
        title="All LearnSpaces"
        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-ss-slate transition-colors hover:bg-ss-chip hover:text-ss-ink"
      >
        <X className="h-5 w-5" aria-hidden />
      </button>

      {/* The whole lesson in one bar; pressing it opens the steps, as the button beside it does. */}
      <button
        type="button"
        onClick={() => (segments.length ? setOpen((o) => !o) : undefined)}
        tabIndex={-1}
        aria-hidden
        className="flex min-w-0 flex-1 items-center gap-1.5 py-3 sm:mx-auto sm:max-w-[760px]"
      >
        {segments.length > 0 ? (
          segments.map((s, i) => <Segment key={s.id} segment={s} index={i} reduced={reduced} />)
        ) : (
          <span className="truncate text-[14px] font-bold text-ss-ink">{title}</span>
        )}
      </button>
      <span className="sr-only" role="progressbar" aria-label={`${title}: ${noun}s done`} aria-valuemin={0} aria-valuemax={segments.length} aria-valuenow={done}>
        {done} of {segments.length} {noun}s done, {Math.round(progress * 100)}% of the lesson
      </span>

      {segments.length > 0 && (
        <button
          ref={trigger}
          type="button"
          data-tour="lesson-plan"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-haspopup="true"
          aria-label={here ? `${capital(noun)} ${at + 1} of ${segments.length}: ${here.title}. Show all ${noun}s` : `${title}: show all ${noun}s`}
          title={heading}
          className="inline-flex h-10 min-w-0 max-w-[42vw] shrink items-center gap-1.5 rounded-xl px-2.5 text-left text-[14px] font-extrabold text-ss-ink transition-colors hover:bg-ss-chip sm:max-w-[340px]"
        >
          <span className="truncate">{heading}</span>
          <ChevronDown className={`h-4 w-4 shrink-0 text-ss-slate transition-transform duration-200 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} aria-hidden />
        </button>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            ref={panel}
            role="dialog"
            aria-label={`All ${noun}s`}
            {...motionFor('rise', reduced)}
            className="absolute right-2 top-[calc(100%+6px)] z-50 flex max-h-[min(72vh,620px)] w-[min(400px,calc(100vw-16px))] flex-col overflow-hidden rounded-2xl border border-ss-line bg-ss-panel shadow-[0_24px_60px_-24px_rgba(20,60,90,0.45)] sm:right-4"
          >
            <div className="flex items-start gap-3 px-5 pb-3 pt-4">
              <div className="min-w-0 flex-1">
                <p className="text-[16px] font-extrabold leading-snug tracking-tight text-ss-ink [text-wrap:balance]">{title}</p>
                <p className="mt-1 text-[12.5px] font-semibold text-ss-slate">
                  {subject && (
                    <span className="mr-2 rounded-full px-2 py-0.5 font-bold" style={{ backgroundColor: 'var(--subject-soft)', color: 'var(--subject-ink)' }}>
                      {subject}
                    </span>
                  )}
                  {done} of {segments.length} done
                </p>
              </div>
            </div>
            <ol className="min-h-0 flex-1 list-none overflow-y-auto px-2 pb-2">
              {run
                ? segments.map((s, i) => (
                    <StepRow
                      key={s.id}
                      segment={s}
                      index={i}
                      live={live}
                      busy={busy}
                      onJump={() => {
                        onJump(s.id)
                        close()
                      }}
                      onTestOut={() => {
                        onTestOut(s.id)
                        close()
                      }}
                    />
                  ))
                : groups.length > 0
                  ? groups.map((g, i) => (
                      <li key={g.id}>
                        <button
                          type="button"
                          onClick={() => {
                            onFocusGroup(g.id)
                            close()
                          }}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[14px] font-bold text-ss-ink hover:bg-ss-chip"
                        >
                          <Dot index={i} status="later" />
                          {g.label || `Step ${i + 1}`}
                        </button>
                      </li>
                    ))
                  : segments.map((s, i) => (
                      <li key={s.id} className="flex items-center gap-3 px-3 py-2.5 text-[14px] font-bold text-ss-ink">
                        <Dot index={i} status={s.status} />
                        {s.title}
                      </li>
                    ))}
            </ol>
            {homework && onAddPage && live && (
              <div className="border-t border-ss-line p-3">
                <input
                  ref={pageInput}
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    e.target.value = ''
                    if (file) {
                      onAddPage(file)
                      close()
                    }
                  }}
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => pageInput.current?.click()}
                  className="ss-press flex min-h-[40px] w-full items-center justify-center gap-2 rounded-xl border border-dashed border-ss-line text-[13px] font-bold text-ss-slate hover:border-[color:var(--subject)] hover:text-ss-ink disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  Add another page
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** A plan from before lesson runs: the steps up to the current one are done. */
function legacySegments(plan: PlanStep[] | undefined, currentStep: number): BarSegment[] {
  return (plan ?? []).map((p, i) => {
    const status = i + 1 < currentStep ? 'done' : i + 1 === currentStep ? 'current' : 'later'
    return { id: `p${i}`, title: p.title, status, fill: status === 'done' ? 1 : status === 'current' ? 0.06 : 0, stage: null, canTestOut: false, lockedReason: null, measured: null }
  })
}

/** One station's stretch of the bar: a track in the lesson's colour, filled as far as it has got; a tick once it is done. */
function Segment({ segment, index, reduced }: { segment: BarSegment; index: number; reduced: boolean }) {
  const settled = segment.status === 'done' || segment.status === 'known'
  return (
    <span
      title={`${index + 1}. ${segment.title}`}
      className="relative h-3.5 min-w-[18px] flex-1 overflow-hidden rounded-full"
      style={{ backgroundColor: 'color-mix(in srgb, var(--subject) 15%, var(--ss-panel))' }}
    >
      <motion.span
        className="absolute inset-y-0 left-0 rounded-full"
        style={{ backgroundColor: 'var(--subject)' }}
        initial={false}
        animate={{ width: `${segment.fill * 100}%` }}
        transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 120, damping: 20 }}
      />
      {settled && (
        <span className="absolute inset-0 grid place-items-center">
          <Check className="h-2.5 w-2.5" strokeWidth={4} style={{ color: 'var(--ss-panel)' }} aria-hidden />
        </span>
      )}
    </span>
  )
}

/** A station's mark in the list: ticked when done, Inky on the one being taught, its number otherwise. */
function Dot({ index, status }: { index: number; status: BarSegment['status'] }) {
  if (status === 'done' || status === 'known') {
    return (
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full" style={{ backgroundColor: 'var(--subject)', color: 'var(--ss-panel)' }}>
        <Check className="h-4 w-4" strokeWidth={3} aria-hidden />
      </span>
    )
  }
  if (status === 'current') {
    return (
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 bg-ss-panel" style={{ borderColor: 'var(--subject)' }}>
        <Inky size={22} title="" />
      </span>
    )
  }
  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-ss-line bg-ss-panel text-[12px] font-extrabold tabular-nums text-ss-slate">
      {index + 1}
    </span>
  )
}

function StepRow({
  segment,
  index,
  live,
  busy,
  onJump,
  onTestOut,
}: {
  segment: BarSegment
  index: number
  live: boolean
  busy: boolean
  onJump: () => void
  onTestOut: () => void
}) {
  const current = segment.status === 'current'
  const later = segment.status === 'later'
  const locked = !!segment.lockedReason
  const at = segment.stage ? STAGES.indexOf(segment.stage) : -1
  return (
    <li className="group relative">
      <button
        type="button"
        disabled={busy || !live || current}
        onClick={onJump}
        aria-current={current ? 'step' : undefined}
        className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors disabled:cursor-default ${
          current ? 'bg-[color:var(--subject-soft)]' : live ? 'hover:bg-ss-chip' : ''
        }`}
      >
        <Dot index={index} status={segment.status} />
        <span className="min-w-0 flex-1 pt-1">
          <span className="block text-[14px] font-bold leading-snug text-ss-ink">{segment.title}</span>
          {current && segment.stage && (
            <span className="mt-1.5 flex items-center gap-1.5">
              {STAGES.map((s, i) => (
                <span
                  key={s}
                  aria-hidden
                  className={`h-1.5 rounded-full ${i === at ? 'w-5' : 'w-3'}`}
                  style={{
                    backgroundColor:
                      i === at ? 'var(--subject)' : i < at ? 'color-mix(in srgb, var(--subject) 40%, transparent)' : 'color-mix(in srgb, var(--ss-slate) 35%, transparent)',
                  }}
                />
              ))}
              <span className="ml-0.5 text-[12px] font-semibold text-ss-slate">
                <span className="sr-only">Part {at + 1} of 4: </span>
                {STAGE_NAMES[segment.stage]}
              </span>
            </span>
          )}
          {segment.status === 'known' && <span className="mt-0.5 block text-[12px] font-semibold text-ss-slate">Tested out</span>}
          {segment.measured !== null && !locked && (
            <span className="mt-0.5 block text-[12px] font-bold text-ss-warn">You scored {segment.measured}% on this</span>
          )}
          {locked && (
            <span className="mt-0.5 block text-[12px] font-bold leading-snug text-ss-warn">
              <Lock className="mr-1 inline h-3 w-3 -translate-y-px" aria-hidden />
              {segment.lockedReason}
            </span>
          )}
        </span>
        {later && live && !locked && !segment.canTestOut && (
          <span className="mt-1 shrink-0 rounded-lg px-2 py-0.5 text-[12px] font-bold text-ss-subject-ink opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            Skip to here
          </span>
        )}
      </button>
      {segment.canTestOut && live && (
        <button
          type="button"
          disabled={busy}
          onClick={onTestOut}
          className="absolute right-2 top-2.5 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-bold text-ss-subject-ink hover:bg-ss-chip disabled:opacity-50"
        >
          <FastForward className="h-3.5 w-3.5" aria-hidden />
          Test out
        </button>
      )}
    </li>
  )
}
