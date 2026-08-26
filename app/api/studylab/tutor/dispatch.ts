// app/api/studylab/tutor/dispatch.ts
import { callGemma, parseJsonRobust } from '@/lib/bedrock'
import { modelForJob } from '@/lib/studylab/lessonJobs'
import type { LessonPolicy } from '@/lib/studylab/lessonPolicy'
import {
  nextBeat, passCheck, failCheck, requestTestOut, skipStep, jumpTo,
  setPace, stop, finish, acceptPlan, editPlan, proposePlan,
  type LessonRun, type LessonStep, type Transition,
} from '@/lib/studylab/lessonRun'
import type { PlanEdit } from '@/lib/studylab/lessonRun'
import type { Pace } from '@/lib/studylab/lessonPolicy'
import { applyLocks } from '@/lib/studylab/stepLocks'
import type { Database } from '@/lib/db'
import { SYSTEM } from './route'

export type LessonAction =
  | { type: 'draft_plan' }
  | { type: 'accept_plan' }
  | { type: 'edit_plan'; edit: PlanEdit }
  | { type: 'next_beat' }
  | { type: 'test_out'; stepId: string; checkpointId: string }
  | { type: 'answer_check'; passed: boolean; missed?: string[] }
  | { type: 'skip'; stepId: string }
  | { type: 'jump'; stepId: string }
  | { type: 'set_pace'; pace: Pace }
  | { type: 'stop' }
  | { type: 'finish' }

export interface DispatchInput {
  run: LessonRun
  policy: LessonPolicy
  userId: string | null
  action: LessonAction
  /** Everything the teaching job needs to write its cards. Absent in tests. */
  context?: Record<string, unknown>
  requestId?: string
}

export interface DispatchResult {
  run: LessonRun
  say: string
  actions: unknown[]
  suggestions: string[]
  refusal?: string
}

/** Actions that only move state. None of these is worth a model call. */
function transitionFor(input: DispatchInput): Transition {
  const { run, policy, action } = input
  switch (action.type) {
    case 'draft_plan': return proposePlan(run, [])
    case 'accept_plan': return acceptPlan(run)
    case 'edit_plan': return editPlan(run, action.edit, policy)
    case 'next_beat': return nextBeat(run)
    case 'test_out': return requestTestOut(run, action.stepId, action.checkpointId, policy)
    case 'answer_check':
      return action.passed ? passCheck(run) : failCheck(run, action.missed ?? [])
    case 'skip': return skipStep(run, action.stepId, policy)
    case 'jump': return jumpTo(run, action.stepId, policy)
    case 'set_pace': return setPace(run, action.pace)
    case 'stop': return stop(run)
    case 'finish': return finish(run, policy)
  }
}

/** Which actions want the model to produce something afterwards. */
const NEEDS_TEACHING = new Set(['accept_plan', 'next_beat', 'answer_check', 'jump'])

/**
 * Applies one action, then calls the one job the new state requires.
 *
 * A refusal returns immediately with the run untouched and no model call: a
 * learner hammering a locked step should cost nothing. A failed parse likewise
 * leaves state alone, so a retry is always safe.
 */
export async function applyAction(input: DispatchInput): Promise<DispatchResult> {
  const transition = transitionFor(input)
  if (!transition.ok) {
    return { run: input.run, say: '', actions: [], suggestions: [], refusal: transition.reason }
  }

  const advanced = transition.run
  if (!NEEDS_TEACHING.has(input.action.type) || advanced.phase === 'done') {
    return { run: advanced, say: '', actions: [], suggestions: [] }
  }

  const step = advanced.steps[advanced.currentStep]
  if (!step) return { run: advanced, say: '', actions: [], suggestions: [] }

  const raw = await callGemma(buildTeachPrompt(advanced, step, input.context ?? {}), {
    maxTokens: 2600,
    temperature: 0.6,
    model: modelForJob('teach_beat'),
    usage: input.requestId
      ? { feature: 'lesson_teach_beat', requestId: input.requestId, userId: input.userId }
      : undefined,
  })

  let parsed: { say?: unknown; actions?: unknown; suggestions?: unknown }
  try {
    parsed = parseJsonRobust(raw)
  } catch {
    // State must not advance on a failed parse — the learner retries the same
    // action and gets the same starting point.
    return {
      run: input.run,
      say: '',
      actions: [],
      suggestions: [],
      refusal: 'That did not come through. Try that again.',
    }
  }

  return {
    run: advanced,
    say: typeof parsed?.say === 'string' ? parsed.say : '',
    actions: Array.isArray(parsed?.actions) ? parsed.actions : [],
    suggestions: Array.isArray(parsed?.suggestions)
      ? parsed.suggestions.filter((s): s is string => typeof s === 'string').slice(0, 3)
      : [],
  }
}

/**
 * The teaching prompt, narrowed to one step's goal.
 *
 * Prepends the route's `SYSTEM` string. `SYSTEM` is where every card type, the
 * LaTeX rule, the connect rule and the checkpoint question shapes are defined —
 * without it the teaching job would produce output with no idea what a card is.
 */
function buildTeachPrompt(
  run: LessonRun,
  step: { title: string; goal: string },
  context: Record<string, unknown>,
): string {
  return [
    SYSTEM,
    '',
    `LESSON: ${String(context.title ?? 'this topic')}`,
    context.subject ? `SUBJECT: ${String(context.subject)}` : '',
    `CURRENT STEP: ${step.title} — ${step.goal}`,
    `BEATS SPENT ON THIS STEP: ${run.beats}`,
    run.pace === 'run'
      ? 'PACE: build the whole step now, then stop.'
      : 'PACE: teach ONE beat — one or two cards — then stop.',
    '',
    'Reply with JSON: { "say": "...", "actions": [...], "suggestions": ["...","..."] }',
  ]
    .filter(Boolean)
    .join('\n')
}

export interface DraftPlanInput {
  title: string
  subject: string | null
  policy: LessonPolicy
  userId: string | null
  /** Curriculum subtopics available to attribute steps to. May be empty. */
  subtopics: { id: number; name: string }[]
  database?: Database
  requestId?: string
}

/**
 * Drafts the outline, then lets the gap map decide what may be skipped.
 *
 * Attribution is the reason subtopics are handed to the model at all: a step
 * that names its subtopic can be matched against `topic_mastery`, and that
 * match is what turns a measurement into a lock. A step the model cannot
 * attribute simply stays unlocked.
 */
export async function draftPlan(input: DraftPlanInput): Promise<LessonStep[]> {
  const { min, max } = input.policy.planSize
  const catalogue = input.subtopics.length
    ? `\nCURRICULUM SUBTOPICS (attribute each step to one by id where it fits):\n${
        input.subtopics.map((s) => `  ${s.id}: ${s.name}`).join('\n')
      }`
    : ''

  const prompt = [
    `Draft a lesson outline for: ${input.title}`,
    input.subject ? `Subject: ${input.subject}` : '',
    `Between ${min} and ${max} steps, ordered so each builds on the last.`,
    catalogue,
    '',
    'Reply with JSON only:',
    '{ "steps": [ { "title": "...", "goal": "one line on what this step teaches", "subtopicId": <id or omit> } ] }',
  ]
    .filter(Boolean)
    .join('\n')

  const raw = await callGemma(prompt, {
    maxTokens: 700,
    temperature: 0.4,
    model: modelForJob('plan'),
    usage: input.requestId
      ? { feature: 'lesson_plan', requestId: input.requestId, userId: input.userId }
      : undefined,
  })

  let parsed: { steps?: unknown }
  try {
    parsed = parseJsonRobust(raw)
  } catch {
    // No plan is better than a broken one: the learner is asked again rather
    // than shown an outline built from noise.
    return []
  }

  const steps: LessonStep[] = (Array.isArray(parsed?.steps) ? parsed.steps : [])
    .map((raw: unknown, i: number): LessonStep | null => {
      if (!raw || typeof raw !== 'object') return null
      const r = raw as { title?: unknown; goal?: unknown; subtopicId?: unknown }
      const title = typeof r.title === 'string' ? r.title.trim() : ''
      if (!title) return null
      const subtopicId = Number(r.subtopicId)
      return {
        id: `s${i + 1}`,
        title,
        goal: typeof r.goal === 'string' ? r.goal : '',
        status: 'pending',
        cardIds: [],
        ...(Number.isInteger(subtopicId) && subtopicId > 0 ? { subtopicId } : {}),
      }
    })
    .filter((s): s is LessonStep => s !== null)

  if (steps.length === 0 || !input.userId) return steps
  return applyLocks(steps, input.userId, input.database)
}
