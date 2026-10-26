'use client'

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowLeft, Check, Lock, FastForward, Plus, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { Inky } from '../inky/Inky'
import { PACES, paceOption } from '../paceOptions'
import type { PlanStep } from '@/lib/studylab/types'
import { STAGES, stageOf, type LessonRun, type Stage } from '@/lib/studylab/lessonRun'
import { railSteps, railIsLive, pathSections, railStartsFolded, type RailStep } from '@/lib/studylab/planRail'
import { policyFor, type LessonPolicy, type Pace } from '@/lib/studylab/lessonPolicy'
import { motionFor } from '@/lib/studylab/motionPresets'

export interface PathRailProps {
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
  /** Where the space came from, so the rail can name what it is listing. */
  origin?: string
  /** Homework: another page of the same assignment, to add to the list. */
  onAddPage?: (file: File) => void
  onTestOut?: (stepId: string) => void
  onJump?: (stepId: string) => void
  onSetPace?: (pace: Pace) => void
  /** True while a request is in flight, so the rail stops accepting clicks it would drop. */
  busy?: boolean
}

const RAIL_KEY = 'ss-learnspace-rail'

/**
 * The lesson as a path down the left of the screen.
 *
 * Stations joined by a line, in three stretches: what you already know (ticked),
 * where you start (Inky sits on it, and hops down the path as you go), and what
 * comes later. Every station is still a control -- jump to it, test out of it --
 * and the pace switch lives at the top. It folds to a strip of stations when the
 * board needs the room, and remembers that.
 */
export function PathRail({
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
  onSetPace = () => {},
  busy = false,
}: PathRailProps) {
  const reduced = useReducedMotion() ?? false
  const pageInputRef = useRef<HTMLInputElement>(null)
  const homework = origin === 'homework'
  const rail = railSteps(run ?? null, policy)
  const live = railIsLive(run ?? null)
  const sections = pathSections(rail)
  const settled = sections.known.length

  const [folded, setFolded] = useState(false)
  useEffect(() => {
    const phone = window.matchMedia('(max-width: 767px)').matches
    let saved: string | null = null
    try {
      saved = localStorage.getItem(RAIL_KEY)
    } catch {
      /* storage blocked: the default for the screen */
    }
    setFolded(railStartsFolded({ saved, phone }))
  }, [])
  const toggleFold = () => {
    const next = !folded
    setFolded(next)
    // Unfolding on a phone is for this visit; it is not the choice to bring
    // back to a wider screen, or to the next lesson.
    if (window.matchMedia('(max-width: 767px)').matches) return
    try {
      localStorage.setItem(RAIL_KEY, next ? 'folded' : 'open')
    } catch {
      /* the switch still works for this visit */
    }
  }

  // A station that turns done while the learner is here gets its stamp; one
  // that was done when the lesson opened is just done.
  const seenSettled = useRef<Set<string> | null>(null)
  const justSettled = new Set<string>()
  if (seenSettled.current === null) {
    seenSettled.current = new Set(sections.known.map((r) => r.id))
  } else {
    for (const r of sections.known) if (!seenSettled.current.has(r.id)) justSettled.add(r.id)
  }
  useEffect(() => {
    for (const r of sections.known) seenSettled.current?.add(r.id)
  })

  const planning = !!run && run.phase === 'planning'
  // Where the station being taught is in its four stages; null before stations.
  const stage = run && run.phase === 'teaching' ? stageOf(run) : null
  const station = (step: RailStep, index: number, last: boolean) => (
    <Station
      key={step.id}
      step={step}
      index={index}
      last={last}
      stage={step.current ? stage : null}
      folded={folded}
      live={live}
      busy={busy}
      stamp={justSettled.has(step.id) ? motionFor('settle', reduced) : null}
      onJump={() => onJump(step.id)}
      onTestOut={() => onTestOut(step.id)}
    />
  )
  // The path itself: one line behind the stations, from the first to the last,
  // in the lesson's colour as far as the station Inky is on. Measured off the
  // stations rather than drawn per row, so section labels and the folded rail
  // cannot break it into pieces.
  const pathRef = useRef<HTMLOListElement>(null)
  const [path, setPath] = useState<{ x: number; top: number; reached: number; bottom: number } | null>(null)
  useLayoutEffect(() => {
    const ol = pathRef.current
    if (!ol) return
    const measure = () => {
      const dots = [...ol.querySelectorAll<HTMLElement>('[data-path-dot]')]
      if (dots.length < 2) return setPath(null)
      const origin = ol.getBoundingClientRect()
      const mid = (el: HTMLElement) => {
        const r = el.getBoundingClientRect()
        return { x: r.left + r.width / 2 - origin.left, y: r.top + r.height / 2 - origin.top }
      }
      const first = mid(dots[0])
      const last = mid(dots[dots.length - 1])
      const here = dots.find((d) => d.dataset.pathDot === 'current')
      setPath({ x: first.x, top: first.y, reached: here ? mid(here).y : sections.current ? first.y : last.y, bottom: last.y })
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(ol)
    return () => ro.disconnect()
  }, [rail.length, folded, sections.current?.id, settled])

  const indexOf = (id: string) => rail.findIndex((r) => r.id === id)
  const all = [...sections.known, ...(sections.current ? [sections.current] : []), ...sections.later]
  const lastId = all[all.length - 1]?.id

  return (
    <aside
      className="relative flex h-full shrink-0 flex-col border-r border-ss-line bg-ss-panel transition-[width] duration-200 ease-out motion-reduce:transition-none"
      style={{ width: folded ? 64 : 264 }}
      aria-label="Your lesson path"
    >
      {/* Back, and the fold switch. */}
      <div className={`flex items-center gap-1 px-2 pt-3 ${folded ? 'flex-col' : ''}`}>
        <button
          type="button"
          onClick={onBack}
          title="All LearnSpaces"
          className="ss-press flex min-h-[40px] items-center gap-2 rounded-xl px-2.5 text-[13px] font-semibold text-ss-slate hover:bg-ss-chip hover:text-ss-ink"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
          {!folded && <span>All LearnSpaces</span>}
        </button>
        <button
          type="button"
          onClick={toggleFold}
          aria-label={folded ? 'Open the path' : 'Fold the path away'}
          aria-expanded={!folded}
          className={`ss-press grid h-10 w-10 shrink-0 place-items-center rounded-xl text-ss-slate hover:bg-ss-chip hover:text-ss-ink ${folded ? '' : 'ml-auto'}`}
        >
          {folded ? <PanelLeftOpen className="h-4.5 w-4.5" aria-hidden /> : <PanelLeftClose className="h-4.5 w-4.5" aria-hidden />}
        </button>
      </div>

      {!folded && (
        <div className="px-4 pb-3 pt-2">
          <p className="text-[16px] font-extrabold leading-snug tracking-tight text-ss-ink [text-wrap:balance]">{title}</p>
          {subject && (
            <span
              className="mt-1.5 inline-block rounded-full px-2.5 py-0.5 text-[12px] font-bold"
              style={{ backgroundColor: 'var(--subject-soft)', color: 'var(--subject-ink)' }}
            >
              {subject}
            </span>
          )}
        </div>
      )}

      {/* Hidden while the plan is still being agreed (the opening card asks
          for the pace), and on homework, where building a whole question in
          one turn would be doing it for them. */}
      {!folded && run && run.phase !== 'planning' && !homework && (
        <div data-tour="lesson-pace" className="mx-3 mb-3 rounded-2xl bg-ss-chip p-1">
          <div className="flex gap-1">
            {PACES.map(({ id, icon: Icon, title: label, blurb }) => (
              <button
                key={id}
                type="button"
                disabled={busy}
                onClick={() => onSetPace(id)}
                aria-pressed={run.pace === id}
                title={blurb}
                className={`ss-press flex min-h-[36px] flex-1 items-center justify-center gap-1.5 rounded-xl px-2 text-[12px] font-bold transition-colors disabled:opacity-50 ${
                  run.pace === id ? 'bg-ss-panel text-ss-ink shadow-ss-panel' : 'text-ss-slate hover:text-ss-ink'
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {label}
              </button>
            ))}
          </div>
          <p className="px-2 pb-1 pt-1.5 text-[12px] font-medium leading-snug text-ss-slate">{paceOption(run.pace).blurb}</p>
        </div>
      )}

      {!folded && homework && onAddPage && run && run.phase !== 'planning' && (
        <div className="mx-3 mb-2">
          <input
            ref={pageInputRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) onAddPage(file)
            }}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => pageInputRef.current?.click()}
            className="ss-press flex min-h-[40px] w-full items-center justify-center gap-2 rounded-xl border border-dashed border-ss-line text-[12.5px] font-bold text-ss-slate hover:border-[color:var(--subject)] hover:text-ss-ink disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Add another page
          </button>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {rail.length > 0 ? (
          <ol ref={pathRef} data-tour="lesson-plan" className="relative list-none">
            {path && (
              <>
                <li aria-hidden className="pointer-events-none absolute w-0.5 rounded-full" style={{ left: path.x - 1, top: path.top, height: Math.max(0, path.reached - path.top), backgroundColor: 'var(--subject)' }} />
                <li aria-hidden className="pointer-events-none absolute w-0.5 rounded-full" style={{ left: path.x - 1, top: path.reached, height: Math.max(0, path.bottom - path.reached), backgroundColor: 'var(--ss-line)' }} />
              </>
            )}
            {planning ? (
              <>
                <SectionLabel folded={folded}>Proposed</SectionLabel>
                {all.map((s) => station(s, indexOf(s.id), s.id === lastId))}
              </>
            ) : (
              <>
                {sections.known.length > 0 && <SectionLabel folded={folded}>You already know</SectionLabel>}
                {sections.known.map((s) => station(s, indexOf(s.id), s.id === lastId))}
                {sections.current && <SectionLabel folded={folded}>Start here</SectionLabel>}
                {sections.current && station(sections.current, indexOf(sections.current.id), sections.current.id === lastId)}
                {sections.later.length > 0 && <SectionLabel folded={folded}>Later</SectionLabel>}
                {sections.later.map((s) => station(s, indexOf(s.id), s.id === lastId))}
              </>
            )}
          </ol>
        ) : !folded ? (
          // A space with no run (an old one) still lists what it has.
          <div className="px-2 text-[12.5px] text-ss-slate">
            {plan && plan.length > 0 ? (
              <ol className="list-decimal space-y-1 pl-5">
                {plan.map((p, i) => (
                  <li key={i} className={i + 1 === currentStep ? 'font-bold text-ss-ink' : ''}>
                    {p.title}
                  </li>
                ))}
              </ol>
            ) : groups.length > 0 ? (
              groups.map((g, i) => (
                <button key={g.id} type="button" onClick={() => onFocusGroup(g.id)} className="block w-full rounded-lg px-2 py-1.5 text-left hover:bg-ss-chip">
                  {g.label || `Step ${i + 1}`}
                </button>
              ))
            ) : (
              <p>{homework ? 'The questions on your sheet will appear here.' : 'Your path appears here once the plan is drafted.'}</p>
            )}
          </div>
        ) : null}
      </div>

      {rail.length > 0 && (
        <div className={`border-t border-ss-line ${folded ? 'px-2 py-3' : 'px-4 py-3.5'}`}>
          {!folded && (
            <p className="mb-1.5 flex justify-between text-[12px] font-semibold text-ss-slate">
              <span>{homework ? 'Questions' : 'Stations'}</span>
              <span className="tabular-nums text-ss-ink">
                {settled} of {rail.length}
              </span>
            </p>
          )}
          <div
            className="h-1.5 overflow-hidden rounded-full"
            style={{ backgroundColor: 'color-mix(in srgb, var(--subject) 16%, transparent)' }}
            role="progressbar"
            aria-label="Stations done"
            aria-valuemin={0}
            aria-valuemax={rail.length}
            aria-valuenow={settled}
          >
            <div
              className="h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none"
              style={{ width: `${(settled / rail.length) * 100}%`, backgroundColor: 'var(--subject)' }}
            />
          </div>
        </div>
      )}
    </aside>
  )
}

function SectionLabel({ folded, children }: { folded: boolean; children: ReactNode }) {
  // Folded, the path is just its stations: a divider here cut the line.
  if (folded) return null
  return (
    // Indented to the titles, beside the path rather than across it.
    <li className="pb-1 pl-[60px] pr-2 pt-3 text-[12px] font-bold uppercase tracking-[0.12em] text-ss-slate">{children}</li>
  )
}

const STAGE_NAMES: Record<Stage, string> = { explore: 'Try it', name: 'Name it', practice: 'Practise', check: 'Check' }

/**
 * The four stages of the station being taught, as pips: the ones behind it
 * soft, the one it is on solid, the ones ahead outlined -- and its name.
 */
function StagePips({ stage }: { stage: Stage }) {
  const at = STAGES.indexOf(stage)
  return (
    <span className="mt-1.5 flex items-center gap-1.5">
      {STAGES.map((s, i) => (
        <span
          key={s}
          aria-hidden
          className={`h-1.5 rounded-full ${i === at ? 'w-5' : 'w-3'}`}
          style={{
            backgroundColor:
              // Ahead: a neutral that still shows on the current station's
              // tinted row, where the line colour all but vanished.
              i === at ? 'var(--subject)' : i < at ? 'color-mix(in srgb, var(--subject) 40%, transparent)' : 'color-mix(in srgb, var(--ss-slate) 35%, transparent)',
          }}
        />
      ))}
      <span className="ml-0.5 text-[12px] font-semibold text-ss-slate">
        <span className="sr-only">Part {at + 1} of 4: </span>
        {STAGE_NAMES[stage]}
      </span>
    </span>
  )
}

function Station({
  step,
  index,
  last,
  stage,
  folded,
  live,
  busy,
  stamp,
  onJump,
  onTestOut,
}: {
  step: RailStep
  index: number
  last: boolean
  /** The current station's stage, drawn as pips under its title. */
  stage: Stage | null
  folded: boolean
  live: boolean
  busy: boolean
  stamp: ReturnType<typeof motionFor> | null
  onJump: () => void
  onTestOut: () => void
}) {
  const settled = step.status === 'done' || step.status === 'known'
  const locked = !!step.lockedReason
  return (
    <li className="relative">
      <button
        type="button"
        disabled={busy || !live}
        onClick={onJump}
        aria-current={step.current ? 'step' : undefined}
        title={folded ? step.title : undefined}
        className={`group relative flex w-full items-start gap-3 rounded-xl px-2 py-1.5 text-left transition-colors disabled:cursor-default ${
          step.current && !folded ? 'bg-[color:var(--subject-soft)]' : live ? 'hover:bg-ss-chip' : ''
        } ${folded ? 'justify-center' : ''}`}
      >
        <span data-path-dot={step.current ? 'current' : 'station'} className="relative z-[1] grid h-9 w-9 shrink-0 place-items-center">
          {settled ? (
            <motion.span
              initial={stamp?.initial}
              animate={stamp?.animate}
              transition={stamp?.transition}
              className="grid h-8 w-8 place-items-center rounded-full"
              style={{ backgroundColor: 'var(--subject)', color: 'var(--ss-panel)' }}
            >
              <Check className="h-4 w-4" strokeWidth={3} aria-hidden />
            </motion.span>
          ) : step.current ? (
            <span
              className="grid h-9 w-9 place-items-center rounded-full border-2 bg-ss-panel"
              style={{ borderColor: 'var(--subject)' }}
            >
              <motion.span layoutId="path-inky" transition={{ type: 'spring', stiffness: 420, damping: 30 }}>
                <Inky size={26} title="Inky is here" />
              </motion.span>
            </span>
          ) : (
            <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-ss-line bg-ss-panel text-[12px] font-extrabold text-ss-slate tabular-nums">
              {locked ? <Lock className="h-3.5 w-3.5" aria-hidden /> : index + 1}
            </span>
          )}
        </span>
        {!folded && (
          <span className="min-w-0 flex-1 pt-1">
            <span
              className={`block text-[13.5px] font-semibold leading-snug ${
                step.current ? 'text-ss-ink' : settled ? 'text-ss-slate' : 'text-ss-ink'
              }`}
            >
              <span className="sr-only">{index + 1}. </span>
              {step.title}
            </span>
            {stage && <StagePips stage={stage} />}
            {step.status === 'known' && <span className="mt-0.5 block text-[12px] font-semibold text-ss-good">Tested out</span>}
            {step.measured !== null && !settled && (
              <span className="mt-0.5 block text-[12px] font-medium text-ss-warn">Scored {step.measured}% before</span>
            )}
            {step.lockedReason && (
              <span className="mt-0.5 block text-[12px] font-medium leading-snug text-ss-warn">{step.lockedReason}</span>
            )}
          </span>
        )}
      </button>
      {!folded && step.canTestOut && (
        <button
          type="button"
          disabled={busy}
          aria-label={`Test out of ${step.title}`}
          title="Answer a couple of questions on this step. Get them right and we skip it."
          onClick={onTestOut}
          className="ss-press mb-1 ml-14 inline-flex min-h-[32px] items-center gap-1.5 rounded-lg px-2 text-[12px] font-bold text-ss-subject-ink hover:bg-ss-chip disabled:opacity-50"
        >
          <FastForward className="h-3.5 w-3.5" aria-hidden />
          Test out
        </button>
      )}
    </li>
  )
}
