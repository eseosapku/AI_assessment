// lib/studylab/lessonRunMigrate.ts
import type { LessonPolicy } from './lessonPolicy'
import type { LessonRun, LessonStep, StepStatus } from './lessonRun'

/**
 * Derives a lesson run from a LearnSpace saved before runs existed.
 *
 * Done on read rather than as a batch migration: there is no downtime, no
 * script to babysit, and a lesson nobody opens again costs nothing. The derived
 * run is written back on the next save, so each space converts once, when it is
 * next used.
 *
 * Nothing locks. Old plans carry no `subtopicId`, so there is nothing to match
 * against `topic_mastery` — and inventing a lock for a lesson already in
 * progress would strand a learner mid-way through.
 */

export interface LegacyLesson {
  /** `canvas_state.plan`, which is model-written jsonb and may be anything. */
  plan: { title?: unknown; goal?: unknown }[] | null | undefined
  /** The `current_step` column. 1-based, 0 when never started. */
  currentStep: number | null | undefined
  /** The `status` column. */
  status: string | null | undefined
}

function toStep(raw: unknown, index: number): LessonStep | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as { title?: unknown; goal?: unknown }
  const title = typeof r.title === 'string' ? r.title.trim() : ''
  if (!title) return null
  return {
    id: `legacy-${index + 1}`,
    title,
    goal: typeof r.goal === 'string' ? r.goal : '',
    status: 'pending',
    cardIds: [],
  }
}

export function runFromLegacy(input: LegacyLesson, policy: LessonPolicy): LessonRun {
  const steps = (Array.isArray(input.plan) ? input.plan : [])
    .map(toStep)
    .filter((s): s is LessonStep => s !== null)

  const base: LessonRun = {
    phase: 'planning',
    pace: policy.defaultPace,
    steps: [],
    currentStep: -1,
    beats: 0,
    awaiting: true,
  }

  if (steps.length === 0) return base

  const done = String(input.status ?? '').toLowerCase() === 'completed'
  if (done) {
    return {
      ...base,
      phase: 'done',
      steps: steps.map((s) => ({ ...s, status: 'done' as StepStatus })),
    }
  }

  // current_step is 1-based; clamp because nothing ever validated it.
  const raw = Number(input.currentStep) || 1
  const index = Math.min(Math.max(raw - 1, 0), steps.length - 1)

  return {
    ...base,
    phase: 'teaching',
    currentStep: index,
    awaiting: true,
    steps: steps.map((s, i) => ({
      ...s,
      status: (i < index ? 'done' : i === index ? 'teaching' : 'pending') as StepStatus,
    })),
  }
}
