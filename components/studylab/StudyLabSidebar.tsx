'use client'

import { ArrowLeft, Brain, Layers, CheckCircle2, Circle, CircleDot, StickyNote } from 'lucide-react'
import type { PlanStep } from '@/lib/studylab/types'
import { railSteps } from '@/lib/studylab/planRail'
import type { LessonRun } from '@/lib/studylab/lessonRun'
import { policyFor, type LessonPolicy, type Pace } from '@/lib/studylab/lessonPolicy'

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
  onTestOut = () => {},
  onJump = () => {},
  onSetPace = () => {},
  busy = false,
}: StudyLabSidebarProps) {
  const hasPlan = !!plan && plan.length > 0
  const completed = hasPlan ? Math.max(currentStep - 1, 0) : groups.length
  const total = hasPlan ? plan!.length : Math.max(currentStep, groups.length)
  const rail = railSteps(run ?? null, policy)
  const settled = rail.filter((r) => r.status === 'done' || r.status === 'known').length
  const hasRail = rail.length > 0

  return (
    <aside className="w-64 shrink-0 h-full flex flex-col bg-[#0e0f12] text-gray-300 border-r border-white/5">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-white/5">
        <div className="w-8 h-8 rounded-xl bg-[color:var(--ss-accent)]/20 flex items-center justify-center">
          <Brain className="w-4.5 h-4.5 text-ss-accent" />
        </div>
        <div className="leading-tight">
          <div className="flex items-center gap-1.5">
            <p className="font-semibold text-[14px] text-white">StudyLab</p>
            <span className="rounded-full bg-[color:var(--ss-accent)]/20 px-1.5 py-0.5 text-[12px] font-extrabold uppercase tracking-wide text-ss-accent">Beta</span>
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
          can do about it. Every row states its own status, because a list
          where only the current item is bold tells you where you are and
          nothing about what you have got through. */}
      <div className="flex-1 overflow-y-auto px-2 py-3">
        <div className="flex items-center justify-between gap-2 px-2 mb-2">
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

        {run && (
          <div className="mx-2 mb-3 rounded-xl bg-white/5 p-2">
            <div className="flex gap-1">
              {(['step', 'run'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  disabled={busy}
                  onClick={() => onSetPace(p)}
                  aria-pressed={run.pace === p}
                  className={`flex-1 rounded-lg px-2 py-1.5 text-[12px] font-bold transition-colors disabled:opacity-50 ${
                    run.pace === p ? 'bg-white/15 text-white' : 'text-ss-slate hover:text-white'
                  }`}
                >
                  {p === 'step' ? 'One card at a time' : 'Whole step at once'}
                </button>
              ))}
            </div>
            {/* A toggle whose two states are not explained is a toggle nobody
                touches on purpose. */}
            <p className="mt-1.5 px-1 text-[12px] font-medium leading-snug text-ss-slate">
              {run.pace === 'step'
                ? 'Adds one card, then waits for you.'
                : 'Builds the whole step, then stops at the check.'}
            </p>
          </div>
        )}

        <div className="space-y-1">
          {hasRail ? (
            <ul className="space-y-1 list-none">
              {rail.map((step) => {
                const settledStep = step.status === 'done' || step.status === 'known'
                return (
                  <li
                    key={step.id}
                    className={`rounded-lg px-3 py-2 ${
                      step.current ? 'bg-white/[0.07] border-l-2 border-[color:var(--ss-accent)]' : 'border-l-2 border-transparent'
                    }`}
                  >
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onJump(step.id)}
                      className="flex w-full items-start gap-2 text-left disabled:opacity-60"
                    >
                      {/* One glyph per state, so the list reads at a glance. */}
                      <span
                        aria-hidden
                        className={`mt-0.5 shrink-0 text-[12px] font-bold ${
                          settledStep ? 'text-ss-good' : step.current ? 'text-ss-accent' : 'text-ss-slate'
                        }`}
                      >
                        {settledStep ? '✓' : step.current ? '●' : '○'}
                      </span>
                      <span
                        className={`text-[13px] font-semibold leading-snug ${
                          step.current ? 'text-white' : settledStep ? 'text-ss-slate line-through decoration-1' : 'text-ss-slate hover:text-white'
                        }`}
                      >
                        {step.title}
                      </span>
                    </button>

                    <div className="pl-5">
                      {step.status === 'known' && (
                        <span className="mt-0.5 block text-[12px] font-semibold text-ss-good">
                          You tested out of this
                        </span>
                      )}

                      {step.measured !== null && !settledStep && (
                        <span className="mt-0.5 block text-[12px] font-medium text-ss-warn">
                          You scored {step.measured}% on this before
                        </span>
                      )}

                      {step.canTestOut && (
                        <button
                          type="button"
                          disabled={busy}
                          aria-label={`Test out of ${step.title}`}
                          onClick={() => onTestOut(step.id)}
                          className="mt-1 rounded-lg px-2 py-1 text-[12px] font-bold text-ss-accent hover:bg-[color:var(--ss-accent)]/15 disabled:opacity-50"
                        >
                          I know this — test me
                        </button>
                      )}

                      {/* A locked step used to show a percentage and simply
                          omit the button, which reads as the control being
                          missing rather than withheld. Saying why is the
                          difference between a rule and a bug. */}
                      {step.lockedReason && (
                        <p className="mt-1 text-[12px] font-medium leading-snug text-ss-warn">
                          {step.lockedReason}
                        </p>
                      )}
                    </div>
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
                <p className="px-2 text-[12px] text-gray-600">Completed steps will appear here.</p>
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
            <span className="text-white font-medium">
              {completed}/{total || 1}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-ss-accent rounded-full transition-all duration-500"
              style={{ width: `${total ? (completed / total) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>
    </aside>
  )
}
