'use client'

import {
  ArrowLeft, Brain, Layers, CheckCircle2, Circle, CircleDot, StickyNote,
  BadgeCheck, Lock, PlayCircle, ChevronRight, FastForward,
} from 'lucide-react'
import type { PlanStep } from '@/lib/studylab/types'
import { railSteps, railIsLive } from '@/lib/studylab/planRail'
import type { LessonRun } from '@/lib/studylab/lessonRun'
import { policyFor, type LessonPolicy, type Pace } from '@/lib/studylab/lessonPolicy'
import { PACES, paceOption } from './paceOptions'

interface StepGroupSummary {
  id: string
  label: string
}

interface StudyLabSidebarProps {
  title: string
  subject?: string | null
  currentStep: number
  groups: StepGroupSummary[]
  plan?: PlanStep[]
  cardCount: number
  onBack: () => void
  onFocusGroup: (id: string) => void
  run?: LessonRun | null
  // Workspace passes a real run, policy and handlers; the defaults below only
  // cover callers (e.g. tests) that render the sidebar without them.
  policy?: LessonPolicy
  /** Where the space came from, so the rail can name what it is listing. */
  origin?: string
  onTestOut?: (stepId: string) => void
  onJump?: (stepId: string) => void
  onSetPace?: (pace: Pace) => void
  /** True while a request is in flight, so the rail stops accepting clicks it would drop. */
  busy?: boolean
}

export default function StudyLabSidebar({
  title,
  subject,
  currentStep,
  groups,
  plan,
  cardCount,
  onBack,
  onFocusGroup,
  run,
  policy = policyFor('scratch'),
  origin,
  onTestOut = () => {},
  onJump = () => {},
  onSetPace = () => {},
  busy = false,
}: StudyLabSidebarProps) {
  const hasPlan = !!plan && plan.length > 0
  const rail = railSteps(run ?? null, policy)
  // A homework space is not a course: the rail lists the questions it read.
  const homework = origin === 'homework'
  const settled = rail.filter((r) => r.status === 'done' || r.status === 'known').length
  const hasRail = rail.length > 0
  // A proposed plan is a preview until it is accepted; nothing in it can be acted on.
  const live = railIsLive(run ?? null)

  // The run is the source of truth wherever there is one. The footer used to
  // count the legacy canvas_state plan while the header counted the rail, so
  // the same panel showed "0 of 6 done" above "0/2" below.
  const completed = hasRail ? settled : hasPlan ? Math.max(currentStep - 1, 0) : groups.length
  const total = hasRail
    ? rail.length
    : hasPlan
      ? plan!.length
      : Math.max(currentStep, groups.length)

  return (
    <aside className="w-64 shrink-0 h-full flex flex-col bg-[#0e0f12] text-gray-300 border-r border-white/5">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-white/5">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: 'var(--ss-accent-soft)' }}
        >
          <Brain className="w-4.5 h-4.5 text-ss-accent" />
        </div>
        <div className="leading-tight">
          <div className="flex items-center gap-1.5">
            <p className="font-semibold text-[14px] text-white">StudyLab</p>
            <span
              className="rounded-full px-1.5 py-0.5 text-[12px] font-extrabold uppercase tracking-wide text-ss-accent"
              style={{ backgroundColor: 'var(--ss-accent-soft)' }}
            >Beta</span>
          </div>
          <p className="text-[12px] text-ss-slate">Brain Ink</p>
        </div>
      </div>

      <button
        onClick={onBack}
        className="flex items-center gap-2 px-4 py-3 text-[13px] text-ss-slate hover:text-white hover:bg-white/5 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        All LearnSpaces
      </button>

      {/* Topic */}
      <div className="px-4 py-3 border-y border-white/5">
        <p className="text-[12px] uppercase tracking-[0.18em] text-ss-slate mb-1">Studying</p>
        <p className="font-semibold text-white text-[14px] leading-snug">{title}</p>
        {subject && <p className="text-[12px] text-ss-slate mt-0.5">{subject}</p>}
      </div>

      {/* The plan: what the lesson covers, where you are in it, and what you
          can do about it. Every row is a button and looks like one — the rail
          used to be a list of labels describing actions in prose, which reads
          as a status display rather than a control you can use. */}
      <div className="flex-1 overflow-y-auto px-2 py-3">
        <div className="flex items-center justify-between gap-2 px-2 mb-1">
          <span className="flex items-center gap-2 text-[12px] uppercase tracking-[0.18em] text-ss-slate">
            <Layers className="w-3.5 h-3.5" />
            Your plan
          </span>
          {hasRail && (
            <span className="text-[12px] font-semibold text-ss-slate">
              {settled} of {rail.length} done
            </span>
          )}
        </div>

        {hasRail && (
          <p className="px-2 mb-2 text-[12px] font-medium leading-snug text-ss-slate">
            {live ? 'Click any step to go there.' : 'Proposed — agree to the plan in the chat to begin.'}
          </p>
        )}

        {/* Hidden while the plan is still being agreed: the plan card asks
            for the pace there, and a toggle already showing an answer makes
            that question look decided before it was put.

            Hidden on homework outright. "Run ahead" builds a step in one turn,
            and a homework step is a question the learner has to hand in —
            building it in one turn is doing it for them, so it is not a choice
            worth offering. */}
        {run && run.phase !== 'planning' && !homework && (
          <div data-tour="lesson-pace" className="mx-2 mb-3 rounded-xl bg-white/5 p-1.5">
            <div className="flex gap-1">
              {PACES.map(({ id, icon: Icon, title, blurb }) => (
                <button
                  key={id}
                  type="button"
                  disabled={busy}
                  onClick={() => onSetPace(id)}
                  aria-pressed={run.pace === id}
                  title={blurb}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] font-bold transition-colors disabled:opacity-50 ${
                    run.pace === id ? 'bg-white/15 text-white' : 'text-ss-slate hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden />
                  {title}
                </button>
              ))}
            </div>
            {/* A toggle whose two states are not explained is a toggle nobody
                touches on purpose. */}
            <p className="mt-1.5 px-1.5 pb-0.5 text-[12px] font-medium leading-snug text-ss-slate">
              {paceOption(run.pace).blurb}
            </p>
          </div>
        )}

        <div className="space-y-1">
          {hasRail ? (
            <ul data-tour="lesson-plan" className="space-y-0.5 list-none">
              {rail.map((step, i) => {
                const settledStep = step.status === 'done' || step.status === 'known'
                // One icon per state, so the rail reads without being read.
                const StatusIcon = step.status === 'known'
                  ? BadgeCheck
                  : step.status === 'done'
                    ? CheckCircle2
                    : step.lockedReason
                      ? Lock
                      : step.current
                        ? PlayCircle
                        : Circle
                return (
                  <li key={step.id}>
                    <button
                      type="button"
                      disabled={busy || !live}
                      onClick={() => onJump(step.id)}
                      aria-current={step.current ? 'step' : undefined}
                      className={`group flex w-full items-start gap-2.5 rounded-lg border-l-2 px-2.5 py-2 text-left transition-colors disabled:cursor-default ${
                        step.current
                          ? 'border-[color:var(--ss-accent)] bg-white/[0.07]'
                          : `border-transparent ${live ? 'hover:bg-white/5' : ''}`
                      }`}
                    >
                      <StatusIcon
                        aria-hidden
                        className={`mt-0.5 w-4 h-4 shrink-0 ${
                          settledStep ? 'text-ss-good' : step.current ? 'text-ss-accent' : 'text-ss-slate'
                        }`}
                      />
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block text-[13px] font-semibold leading-snug ${
                            step.current
                              ? 'text-white'
                              : settledStep
                                ? 'text-ss-slate'
                                : 'text-ss-slate group-hover:text-white'
                          }`}
                        >
                          <span className="tabular-nums opacity-70">{i + 1}. </span>
                          {step.title}
                        </span>

                        {step.status === 'known' && (
                          <span className="mt-0.5 block text-[12px] font-semibold text-ss-good">
                            Tested out
                          </span>
                        )}

                        {step.measured !== null && !settledStep && (
                          <span className="mt-0.5 block text-[12px] font-medium text-ss-warn">
                            Scored {step.measured}% before
                          </span>
                        )}

                        {/* A locked step used to show a percentage and simply
                            omit the button, which reads as the control being
                            missing rather than withheld. Saying why is the
                            difference between a rule and a bug. */}
                        {step.lockedReason && (
                          <span className="mt-0.5 block text-[12px] font-medium leading-snug text-ss-warn">
                            {step.lockedReason}
                          </span>
                        )}
                      </span>

                      {live && (
                        <ChevronRight
                          aria-hidden
                          className="mt-0.5 w-3.5 h-3.5 shrink-0 text-transparent transition-colors group-hover:text-ss-slate"
                        />
                      )}
                    </button>

                    {/* Offered only where it applies. The old copy — "I know
                        this, test me" — promised a test on every row that
                        happened to show it, which read as the whole lesson
                        being testable when most of it is not. */}
                    {step.canTestOut && (
                      <button
                        type="button"
                        disabled={busy}
                        aria-label={`Test out of ${step.title}`}
                        title={`Answer a couple of questions on this step. Get them right and we skip it.`}
                        onClick={() => onTestOut(step.id)}
                        className="ml-9 mb-1 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] font-bold text-ss-accent transition-colors hover:bg-white/10 disabled:opacity-50"
                      >
                        <FastForward className="w-3.5 h-3.5" aria-hidden />
                        Test out
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          ) : hasPlan ? (
            plan!.map((p, i) => {
              const stepNo = i + 1
              const state = stepNo < currentStep ? 'done' : stepNo === currentStep ? 'current' : 'upcoming'
              const matchGroup = groups[i]
              const Icon = state === 'done' ? CheckCircle2 : state === 'current' ? CircleDot : Circle
              return (
                <button
                  key={i}
                  onClick={() => matchGroup && onFocusGroup(matchGroup.id)}
                  title={p.goal}
                  className={`w-full flex items-start gap-2 px-2 py-2 rounded-lg text-left text-[13px] transition-colors ${
                    state === 'current'
                      ? 'text-ss-accent bg-[color:var(--ss-accent)]/10'
                      : state === 'done'
                        ? 'text-gray-300 hover:bg-white/5'
                        : 'text-ss-slate'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 mt-0.5 shrink-0 ${state === 'done' ? 'text-emerald-400' : ''}`}
                  />
                  <span className="leading-snug">{p.title}</span>
                </button>
              )
            })
          ) : (
            <>
              {groups.length === 0 && (
                // Before a plan exists there is nothing completed to wait for —
                // saying so read as though the lesson had already started.
                <p className="px-2 text-[12px] text-gray-600">
                  {/* A homework space has no plan to draft — its steps are the
                      questions off the page, and it says so while the page is
                      being read. */}
                  {homework
                    ? 'The questions on your sheet will appear here.'
                    : 'Your steps will appear here once the plan is drafted.'}
                </p>
              )}
              {groups.map((g, i) => (
                <button
                  key={g.id}
                  onClick={() => onFocusGroup(g.id)}
                  className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left text-[13px] text-gray-300 hover:bg-white/5 transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="truncate">{g.label || `Step ${i + 1}`}</span>
                </button>
              ))}
              {currentStep > groups.length && (
                <div className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-[13px] text-ss-accent bg-[color:var(--ss-accent)]/10">
                  <Circle className="w-4 h-4 shrink-0" />
                  <span className="truncate">Step {currentStep} · in progress</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Footer stats */}
      <div className="px-4 py-4 border-t border-white/5 space-y-3">
        <div className="flex items-center justify-between text-[12px]">
          <span className="text-ss-slate flex items-center gap-1.5">
            <StickyNote className="w-3.5 h-3.5" /> Cards
          </span>
          <span className="text-white font-medium">{cardCount}</span>
        </div>
        <div>
          <div className="flex items-center justify-between text-[12px] mb-1.5">
            <span className="text-ss-slate">Progress</span>
            {/* A total of zero is honest; the old `|| 1` invented a step so the
                counter would not read 0/0, and showed "0/1" before any plan
                existed. */}
            <span className="text-white font-medium">
              {total > 0 ? `${completed}/${total}` : '—'}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-ss-accent rounded-full transition-all duration-500"
              style={{ width: `${total > 0 ? (completed / total) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>
    </aside>
  )
}
