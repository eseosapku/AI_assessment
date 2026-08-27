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
import { isValidQuestion, coerceQuestion } from '@/lib/studylab/quiz'
import type { CheckpointQuestion } from '@/lib/studylab/types'
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
  | { type: 'ask'; question: string }

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
    // A question is not progress: state passes through unchanged.
    case 'ask': return { ok: true, run }
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

  // test_out deliberately bypasses NEEDS_TEACHING: that path calls the
  // teaching job, which writes cards. A test-out needs questions, from the
  // check job, on the cheap model — not a lesson.
  if (input.action.type === 'test_out') {
    return applyTestOut(input, advanced)
  }

  // Asking is answered like a teaching turn, but its transition above was a
  // no-op, so nothing here is allowed to advance the lesson.
  if (input.action.type === 'ask') {
    return applyAsk(input, advanced)
  }

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
 * Turns an open test-out check into real questions.
 *
 * The transition already opened `run.openCheck` — that part is free, it just
 * moves state. Writing the questions costs a model call, so it happens here,
 * after the transition, on the `check` job rather than `teach_beat`.
 *
 * Both failure modes return the ORIGINAL run, not the transitioned one: an
 * open check with nothing to answer would strand the learner, since the step
 * can never resolve when there is nothing to pass.
 */
async function applyTestOut(input: DispatchInput, advanced: LessonRun): Promise<DispatchResult> {
  const check = advanced.openCheck
  const stepIndex = check ? advanced.steps.findIndex((s) => s.id === check.stepId) : -1
  const step = stepIndex === -1 ? undefined : advanced.steps[stepIndex]
  if (!check || !step) {
    // Defensive: requestTestOut always sets these together on success.
    return { run: input.run, say: '', actions: [], suggestions: [], refusal: 'That step is not in the plan.' }
  }

  let questions: CheckpointQuestion[]
  try {
    questions = await writeCheck(step, check.checkpointId, input.userId, input.requestId)
  } catch {
    return {
      run: input.run,
      say: '',
      actions: [],
      suggestions: [],
      refusal: 'That did not come through. Try that again.',
    }
  }

  if (questions.length === 0) {
    return {
      run: input.run,
      say: '',
      actions: [],
      suggestions: [],
      refusal: 'Could not put together a check for that step — try again.',
    }
  }

  return {
    run: advanced,
    say: '',
    actions: [
      { type: 'checkpoint', id: check.checkpointId, step: stepIndex + 1, gate: check.gate, questions },
    ],
    suggestions: [],
  }
}

/**
 * Answers a free-text question without moving the lesson forward.
 *
 * `transitionFor`'s `ask` case is a no-op, so `advanced` here is the same run
 * the caller passed in — this can only ever hand back that run or the one
 * unaltered copy of it, never a step or beat further along.
 */
async function applyAsk(input: DispatchInput, advanced: LessonRun): Promise<DispatchResult> {
  const question = input.action.type === 'ask' ? input.action.question.trim() : ''
  if (!question) {
    return { run: input.run, say: '', actions: [], suggestions: [], refusal: 'Ask me something first.' }
  }

  const step = advanced.steps[advanced.currentStep]
  if (!step) return { run: advanced, say: '', actions: [], suggestions: [] }

  const prompt = [
    buildTeachPrompt(advanced, step, input.context ?? {}),
    '',
    "The student has a question about the current step — answer it. You may add or update a card if that's the clearest way to explain, but do NOT advance to a new beat or step.",
    `QUESTION: ${question}`,
  ].join('\n')

  const raw = await callGemma(prompt, {
    maxTokens: 2600,
    temperature: 0.6,
    model: modelForJob('teach_beat'),
    usage: input.requestId
      ? { feature: 'lesson_ask', requestId: input.requestId, userId: input.userId }
      : undefined,
  })

  let parsed: { say?: unknown; actions?: unknown; suggestions?: unknown }
  try {
    parsed = parseJsonRobust(raw)
  } catch {
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
 * Writes the questions a test-out is answered on.
 *
 * Small and bounded: two or three questions against one step's goal, in the
 * formats the canvas already renders. This runs on the cheap model on purpose —
 * it is a structured transform against a goal that is already decided, not a
 * judgement about how to teach.
 */
async function writeCheck(
  step: { title: string; goal: string },
  checkpointId: string,
  userId: string | null,
  requestId?: string,
): Promise<CheckpointQuestion[]> {
  const prompt = [
    `Write a short knowledge check for one step of a lesson.`,
    `STEP: ${step.title}`,
    `GOAL: ${step.goal}`,
    '',
    'Two or three questions, enough to tell whether someone already knows this.',
    'Keep them on this step only — this is not an exam.',
    'Formats: "mcq" (give "options" and an integer "answer"), "short" (give a "rubric"),',
    'or "match" (give "pairs" of {"left","right"}). Give every question a unique "id".',
    '',
    'Reply with JSON only: { "questions": [ ... ] }',
  ].join('\n')

  const raw = await callGemma(prompt, {
    maxTokens: 900,
    temperature: 0.3,
    model: modelForJob('check'),
    usage: requestId
      ? { feature: 'lesson_check', requestId, userId }
      : undefined,
  })

  const parsed = parseJsonRobust(raw)
  const questions = Array.isArray(parsed?.questions) ? parsed.questions : []
  // Validate with the same predicate the canvas reducer uses (isValidQuestion,
  // already imported by lib/studylab/actions.ts) — a looser check here (e.g.
  // just "has a prompt") would let a question missing its format-specific
  // fields (mcq with no "options", match with no "pairs"...) through as a
  // false success. That commits a run whose openCheck the canvas can never
  // resolve: beginCheck refuses to open a second check while one is already
  // open, and nothing can pass/fail a check with no valid quiz node to answer
  // — every future test-out on that run is permanently blocked, not just this
  // one. isValidQuestion already tolerates a stringy mcq "answer" (checks
  // `Number.isInteger(Number(q.answer))`), so a nearly-right question survives
  // validation; coerceQuestion then normalises it to the canonical numeric
  // shape rather than the question being discarded over a type mismatch.
  return questions.filter(isValidQuestion).map(coerceQuestion)
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
