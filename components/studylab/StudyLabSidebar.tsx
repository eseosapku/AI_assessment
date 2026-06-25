'use client'

import { ArrowLeft, Brain, Layers, CheckCircle2, Circle, CircleDot, StickyNote, Settings } from 'lucide-react'
import type { PlanStep } from '@/lib/studylab/types'

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
}: StudyLabSidebarProps) {
  const hasPlan = !!plan && plan.length > 0
  const completed = hasPlan ? Math.max(currentStep - 1, 0) : groups.length
  const total = hasPlan ? plan!.length : Math.max(currentStep, groups.length)

  return (
    <aside className="w-64 shrink-0 h-full flex flex-col bg-[#0e0f12] text-gray-300 border-r border-white/5">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-white/5">
        <div className="w-8 h-8 rounded-xl bg-apple-blue/20 flex items-center justify-center">
          <Brain className="w-4.5 h-4.5 text-apple-blue" />
        </div>
        <div className="leading-tight">
          <p className="font-semibold text-[14px] text-white">StudyLab</p>
          <p className="text-[11px] text-gray-500">Brain Ink</p>
        </div>
      </div>

      <button
        onClick={onBack}
        className="flex items-center gap-2 px-4 py-3 text-[13px] text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        All LearnSpaces
      </button>

      {/* Topic */}
      <div className="px-4 py-3 border-y border-white/5">
        <p className="text-[10px] uppercase tracking-[0.18em] text-gray-500 mb-1">Studying</p>
        <p className="font-semibold text-white text-[14px] leading-snug">{title}</p>
        {subject && <p className="text-[12px] text-gray-500 mt-0.5">{subject}</p>}
      </div>

      {/* Steps / layers */}
      <div className="flex-1 overflow-y-auto px-2 py-3">
        <div className="flex items-center gap-2 px-2 mb-2 text-[10px] uppercase tracking-[0.18em] text-gray-500">
          <Layers className="w-3.5 h-3.5" />
          Steps
        </div>
        <div className="space-y-1">
          {hasPlan ? (
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
                      ? 'text-apple-blue bg-apple-blue/10'
                      : state === 'done'
                        ? 'text-gray-300 hover:bg-white/5'
                        : 'text-gray-500'
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
                <div className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-[13px] text-apple-blue bg-apple-blue/10">
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
          <span className="text-gray-500 flex items-center gap-1.5">
            <StickyNote className="w-3.5 h-3.5" /> Cards
          </span>
          <span className="text-white font-medium">{cardCount}</span>
        </div>
        <div>
          <div className="flex items-center justify-between text-[12px] mb-1.5">
            <span className="text-gray-500">Progress</span>
            <span className="text-white font-medium">
              {completed}/{total || 1}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-apple-blue rounded-full transition-all duration-500"
              style={{ width: `${total ? (completed / total) * 100 : 0}%` }}
            />
          </div>
        </div>
        <button className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-[12px] text-gray-500 hover:text-white hover:bg-white/5 transition-colors">
          <Settings className="w-3.5 h-3.5" />
          Workspace settings
        </button>
      </div>
    </aside>
  )
}
