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
  // Optional for now: no caller passes a run yet, so the rail stays empty and
  // these are unused — Task 9 wires a real run through and starts sending them.
  policy?: LessonPolicy
  onTestOut?: (stepId: string) => void
  onJump?: (stepId: string) => void
  onSetPace?: (pace: Pace) => void
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
}: StudyLabSidebarProps) {
  const hasPlan = !!plan && plan.length > 0
  const completed = hasPlan ? Math.max(currentStep - 1, 0) : groups.length
  const total = hasPlan ? plan!.length : Math.max(currentStep, groups.length)
  const rail = railSteps(run ?? null, policy)
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

      {/* Steps / layers */}
      <div className="flex-1 overflow-y-auto px-2 py-3">
        <div className="flex items-center gap-2 px-2 mb-2 text-[12px] uppercase tracking-[0.18em] text-ss-slate">
          <Layers className="w-3.5 h-3.5" />
          Steps
        </div>
        {run && (
          <div className="flex gap-1 px-3 pb-2">
            {(['step', 'run'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onSetPace(p)}
                aria-pressed={run.pace === p}
                className={`rounded-lg px-2 py-1 text-[12px] font-bold ${
                  run.pace === p ? 'bg-white/10 text-white' : 'text-ss-slate hover:text-white'
                }`}
              >
                {p === 'step' ? 'Step by step' : 'Run ahead'}
              </button>
            ))}
          </div>
        )}
        <div className="space-y-1">
          {hasRail ? (
            rail.map((step) => (
              <li key={step.id} className="px-3 py-2">
                <button
                  type="button"
                  onClick={() => onJump(step.id)}
                  className={`block w-full text-left text-[13px] font-semibold ${
                    step.current ? 'text-white' : 'text-ss-slate hover:text-white'
                  }`}
                >
                  {step.title}
                </button>

                {step.measured !== null && (
                  <span className="mt-0.5 block text-[12px] font-medium text-ss-warn">
                    measured {step.measured}%
                  </span>
                )}

                {step.canTestOut && (
                  <button
                    type="button"
                    aria-label={`Test out of ${step.title}`}
                    onClick={() => onTestOut(step.id)}
                    className="mt-1 rounded-lg px-2 py-1 text-[12px] font-bold text-ss-accent hover:bg-[color:var(--ss-accent)]/15"
                  >
                    I know this
                  </button>
                )}
              </li>
            ))
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
