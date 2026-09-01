// app/api/studylab/tutor/dispatch.ts
import { callGemma, parseJsonRobust } from '@/lib/bedrock'
import { modelForJob } from '@/lib/studylab/lessonJobs'
import type { LessonPolicy } from '@/lib/studylab/lessonPolicy'
import {
  nextBeat, passCheck, failCheck, requestTestOut, skipStep, jumpTo,
  setPace, stop, finish, acceptPlan, editPlan, proposePlan, beginCheck,
  type LessonRun, type LessonStep, type Transition,
} from '@/lib/studylab/lessonRun'
import type { PlanEdit } from '@/lib/studylab/lessonRun'
import type { Pace } from '@/lib/studylab/lessonPolicy'
import { applyLocks } from '@/lib/studylab/stepLocks'
import { isValidQuestion, coerceQuestion } from '@/lib/studylab/quiz'
import { parseBoardSummary, type BoardSummary } from '@/lib/studylab/boardSummary'
import type { CheckpointQuestion } from '@/lib/studylab/types'
import type { Database } from '@/lib/db'
import { SYSTEM } from './route'

export type LessonAction =
  /** `answer` is present on a re-draft, carrying what the learner said back. */
  | { type: 'draft_plan'; answer?: string }
  /**
   * `pace` is chosen on the plan card before the lesson starts. It used to be
   * defaulted silently, which left the learner with a setting they had never
   * been asked about and no reason to believe it was theirs to change.
   */
  | { type: 'accept_plan'; pace?: Pace }
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

/** The plan as the chat renders it: steps, why any is locked, and the questions. */
export interface PlanCard {
  steps: { id: string; title: string; goal: string; measured: number | null; locked: boolean }[]
  questions: string[]
}

export interface DispatchResult {
  run: LessonRun
  say: string
  actions: unknown[]
  suggestions: string[]
  refusal?: string
  plan?: PlanCard
  /**
   * What just happened, when an action only moved state.
   *
   * Kept apart from `say` because it is not the tutor teaching — it is the
   * system reporting — and the chat renders the two differently. Collapsing
   * them would put "Switched to whole steps" in the same bubble as an
   * explanation of covalent bonding.
   */
  ack?: string
}

/** Actions that only move state. None of these is worth a model call. */
function transitionFor(input: DispatchInput): Transition {
  const { run, policy, action } = input
  switch (action.type) {
    case 'draft_plan': return proposePlan(run, [])
    case 'accept_plan': {
      // The pace is applied first so the very first beat already obeys it.
      // setPace only ever fails on a run that has finished, and acceptPlan
      // would refuse that anyway — so a refusal here is still the honest one.
      if (!action.pace) return acceptPlan(run)
      const paced = setPace(run, action.pace)
      return paced.ok ? acceptPlan(paced.run) : paced
    }
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

/**
 * Beats on one step before the tutor is *told* to close it with a check.
 *
 * Each step is one idea and the SYSTEM prompt already asks for 2-4 cards. This
 * is the backstop that makes a step terminate rather than being taught forever:
 * without it, "add one card, then stop" had nothing to say once the goal was
 * met and the lesson sat on step 1 for six beats with no way to finish.
 *
 * `nextBeat` increments `beats` before the prompt is built, so the first
 * teaching turn already reads as beat 1. At "run" pace the threshold is 2: turn
 * one builds the whole step, turn two closes it — needed only because the model
 * does not reliably emit the check it was asked for the first time.
 */
const BEATS_BEFORE_CHECK: Record<Pace, number> = { step: 3, run: 2 }

const ALWAYS_TEACHES = new Set(['accept_plan', 'next_beat', 'answer_check'])

/**
 * Whether this turn should call the teaching job.
 *
 * `jump` is the conditional one. Going BACK to a step that already has cards
 * must not regenerate them — the learner is returning to re-read what they
 * read, and a second explanation of the same thing costs a paid call and
 * clutters the board. But jumping to a step that has never been taught used to
 * do nothing visible at all: the rail highlight moved and the lesson sat there
 * until the learner pressed Continue, with no way to tell the click had even
 * registered. Landing on an empty step teaches it.
 */
function needsTeaching(action: LessonAction, run: LessonRun, board: BoardSummary): boolean {
  if (ALWAYS_TEACHES.has(action.type)) return true
  if (action.type !== 'jump') return false

  const target = run.steps[run.currentStep]
  if (!target) return false
  // Step numbers on cards are 1-based, matching what the prompt asks for.
  return !board.cards.some((c) => c.step === run.currentStep + 1)
}

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

  const board = parseBoardSummary(input.context?.board)

  if (!needsTeaching(input.action, advanced, board) || advanced.phase === 'done') {
    // Never silent. A state-only action that returns nothing to show leaves the
    // learner unable to tell whether their click did anything — which is how
    // "I clicked a step and had to press Continue to find out if it worked"
    // happens. This costs no model call.
    return {
      run: advanced,
      say: '',
      actions: [],
      suggestions: [],
      ack: acknowledge(input.action, advanced, board),
    }
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

  const rawActions = fitCardsToLesson(
    Array.isArray(parsed?.actions) ? parsed.actions : [],
    advanced,
  )
  const { run: openedRun, actions } = openEmittedCheckpoint(advanced, rawActions)

  return {
    run: openedRun,
    say: typeof parsed?.say === 'string' ? parsed.say : '',
    actions,
    suggestions: Array.isArray(parsed?.suggestions)
      ? parsed.suggestions.filter((s): s is string => typeof s === 'string').slice(0, 3)
      : [],
  }
}

/**
 * What the tutor says when an action only moved state.
 *
 * Deterministic and free: these are facts about what just happened, not
 * judgements, so there is nothing here worth a model call. The rule is that
 * every action a learner can take produces a visible response — a control that
 * answers silently is indistinguishable from one that is broken.
 */
function acknowledge(action: LessonAction, run: LessonRun, board: BoardSummary): string {
  const step = run.steps[run.currentStep]
  const stepNo = run.currentStep + 1

  switch (action.type) {
    case 'jump': {
      if (!step) return 'Moved.'
      const built = board.cards.filter((c) => c.step === stepNo).length
      return built > 0
        ? `Back on step ${stepNo}, ${step.title}. Its ${built === 1 ? 'card is' : `${built} cards are`} on the board — Continue picks up where you left off.`
        : `On step ${stepNo}, ${step.title}.`
    }
    case 'skip':
      return step
        ? `Skipped ahead. You are on step ${stepNo}, ${step.title}.`
        : 'Skipped ahead — that was the last step.'
    case 'set_pace':
      return action.pace === 'run'
        ? 'Switched to whole steps — I will build each one out and finish with a check.'
        : 'Switched to one card at a time — I will stop after each so you can steer.'
    case 'edit_plan':
      return 'Plan updated.'
    case 'stop':
      return 'Paused. Nothing is lost — pick it back up whenever you want.'
    case 'finish':
      return 'That is the lesson done. Everything you built is on the board.'
    default:
      return ''
  }
}

/** Card types that render a Run button or a live preview. */
const RUNS_CODE = new Set(['code', 'web'])

/** A line that is nothing but a string being printed. */
const PRINTED_LINE =
  /^\s*(?:console\.log|print|println|System\.out\.println|echo|puts|printf)\s*\(\s*(["'`])([\s\S]*?)\1\s*\)\s*;?\s*$/
/** A line that is nothing but a comment. */
const COMMENT_LINE = /^\s*(?:\/\/+|#)\s?(.*)$/

/**
 * Recovers the prose from a snippet that was only ever prose in costume.
 *
 * A screenwriting lesson produced a card whose whole body was
 * `console.log("Mr. Pink: You know what I hate?...")` repeated line after line,
 * over two `//` comments explaining the scene. Converting that card to a
 * concept card kept the content but kept the costume with it, so the learner
 * read dialogue through a wrapper of function calls and semicolons.
 *
 * Every line has to be a printed string or a comment before anything is
 * rewritten. A snippet with real control flow in it is left exactly as it is —
 * better an odd-looking card than one silently mangled.
 */
function unwrapPrinted(code: string): string {
  const lines = code.replace(/\r\n/g, '\n').split('\n')
  const meaningful = lines.filter((l) => l.trim().length > 0)
  if (meaningful.length === 0) return code

  const out: string[] = []
  let recovered = 0

  for (const line of lines) {
    if (!line.trim()) {
      out.push('')
      continue
    }
    const printed = line.match(PRINTED_LINE)
    if (printed) {
      out.push(printed[2])
      recovered += 1
      continue
    }
    const comment = line.match(COMMENT_LINE)
    if (comment) {
      out.push(comment[1])
      recovered += 1
      continue
    }
    out.push(line)
  }

  if (recovered < meaningful.length) return code
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

/**
 * Keeps runnable card types out of lessons that are not about code.
 *
 * The prompt says plainly that "code" and "web" are for source code the student
 * would actually run. The model produced a JavaScript card holding a scene from
 * Pulp Fiction anyway, with a Run button on it. A rule the model can ignore is
 * not a rule, so the card is converted rather than requested differently: the
 * content survives, on a card type that suits it.
 *
 * Dropping the action instead would be worse — the chat would still narrate a
 * card that never appeared, which is the failure this whole pass exists to fix.
 */
function fitCardsToLesson(actions: unknown[], run: LessonRun): unknown[] {
  if (run.programming !== false) return actions

  return actions.map((raw) => {
    if (!raw || typeof raw !== 'object') return raw
    const a = raw as Record<string, unknown>
    if (a.type !== 'createCard' || typeof a.card !== 'string' || !RUNS_CODE.has(a.card)) return raw

    const source =
      typeof a.code === 'string' ? unwrapPrinted(a.code)
      : typeof a.html === 'string' ? a.html
      : ''
    const body = typeof a.body === 'string' && a.body.trim() ? a.body : source

    const { code, language, runnable, html, css, js, ...rest } = a
    return { ...rest, card: 'concept', body }
  })
}

/**
 * A `next_beat`/`jump`/`accept_plan`/`answer_check` teaching turn is where the
 * SYSTEM prompt tells the model to emit a `checkpoint` action once a step has
 * been taught — that is the ordinary "teach it, then check it" flow, not the
 * test-out path. Nothing else opens a check for it, so without this the
 * checkpoint action still renders a quiz on the canvas, but `openCheck` never
 * gets set: `answer_check` then always refuses with "There is no check open",
 * the step can never reach 'done', and a locked step — un-skippable and
 * un-test-outable by design — becomes un-completable too.
 *
 * `step` on the action is 1-based (see `TutorAction` in lib/studylab/types),
 * not a step id, so it is mapped to `advanced.steps[step - 1]` and, failing
 * that, to the step currently being taught. If neither resolves there is
 * nothing to open a check against, so the action is dropped rather than left
 * for the learner to answer to no effect.
 *
 * `beginCheck` refusing because a check is already open is the state machine
 * correctly enforcing what the old prompt's "rule 3a" used to just ask for —
 * on that refusal the run is left exactly as it came in, and the duplicate
 * checkpoint action is dropped so the canvas does not render a second quiz
 * that cannot gate anything.
 */
function openEmittedCheckpoint(
  run: LessonRun,
  rawActions: unknown[],
): { run: LessonRun; actions: unknown[] } {
  const cpIndex = rawActions.findIndex(
    (a): a is { type: 'checkpoint'; id: string; step: number; gate?: unknown } =>
      !!a &&
      typeof a === 'object' &&
      (a as { type?: unknown }).type === 'checkpoint' &&
      typeof (a as { id?: unknown }).id === 'string' &&
      typeof (a as { step?: unknown }).step === 'number',
  )
  if (cpIndex === -1) return { run, actions: rawActions }

  const cp = rawActions[cpIndex] as { id: string; step: number; gate?: unknown }
  const gate: 'hard' | 'soft' = cp.gate === 'soft' ? 'soft' : 'hard'
  const target = run.steps[cp.step - 1] ?? run.steps[run.currentStep]

  if (!target) {
    // Neither the emitted step number nor the current step resolves — there
    // is nothing to open a check against.
    return { run, actions: rawActions.filter((_, i) => i !== cpIndex) }
  }

  const opened = beginCheck(run, target.id, cp.id, 'checkpoint', gate)
  if (!opened.ok) {
    // Already open (or the step vanished from the plan): keep the run as it
    // was and drop the duplicate rather than returning a quiz that cannot
    // resolve anything.
    return { run, actions: rawActions.filter((_, i) => i !== cpIndex) }
  }
  return { run: opened.run, actions: rawActions }
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
    actions: fitCardsToLesson(Array.isArray(parsed?.actions) ? parsed.actions : [], advanced),
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
/**
 * Accepts the field names a model reaches for anyway.
 *
 * `format` and `prompt` are what the canvas reducer reads, but "type" and
 * "question" are the obvious words for those things and the model reliably
 * chose them — producing questions that parsed, validated as junk, and left
 * the learner with "could not put together a check" twice in a row.
 *
 * Spelling the field names out in the prompt fixes the common case; this
 * catches the drift, because a prompt is a request and this is a guarantee.
 */
function normaliseQuestion(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw
  const q = { ...(raw as Record<string, unknown>) }
  if (q.format === undefined && typeof q.type === 'string') q.format = q.type
  if (q.prompt === undefined && typeof q.question === 'string') q.prompt = q.question
  // A question with no id is otherwise discarded over bookkeeping, not content.
  if (typeof q.id !== 'string' || !q.id.trim()) {
    q.id = `q-${Math.random().toString(36).slice(2, 8)}`
  }
  return q
}

async function writeCheck(
  step: { title: string; goal: string },
  checkpointId: string,
  userId: string | null,
  requestId?: string,
): Promise<CheckpointQuestion[]> {
  // The field names are spelled out with a worked example of each shape.
  // Naming only the formats got back `type` and `question` every time — a
  // reasonable guess, and one that failed validation silently.
  const prompt = [
    `Write a short knowledge check for one step of a lesson.`,
    `STEP: ${step.title}`,
    `GOAL: ${step.goal}`,
    '',
    'Two or three questions, enough to tell whether someone already knows this.',
    'Keep them on this step only — this is not an exam.',
    '',
    'Each question needs "id", "format" and "prompt". Use these EXACT field names:',
    '',
    '{ "questions": [',
    '  { "id": "q1", "format": "mcq", "prompt": "...?",',
    '    "options": ["...", "...", "...", "..."], "answer": 1 },',
    '  { "id": "q2", "format": "short", "prompt": "...?",',
    '    "rubric": "what a good answer must mention" },',
    '  { "id": "q3", "format": "match", "prompt": "Match each term to its description.",',
    '    "pairs": [ { "left": "...", "right": "..." }, { "left": "...", "right": "..." } ] }',
    '] }',
    '',
    '"answer" is the zero-based index into "options". Reply with that JSON and nothing else.',
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
  const questions = (Array.isArray(parsed?.questions) ? parsed.questions : []).map(normaliseQuestion)
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
 * The teaching prompt: one step's goal, against the board that already exists.
 *
 * Prepends the route's `SYSTEM` string. `SYSTEM` is where every card type, the
 * LaTeX rule, the connect rule and the checkpoint question shapes are defined —
 * without it the teaching job would produce output with no idea what a card is.
 *
 * `SYSTEM` also instructs the model to "read the EXISTING CARDS list below" and
 * not to reuse a checkpoint id "already on the canvas (listed below)". Those
 * lists are rendered here. While they were missing those rules pointed at
 * nothing, and the model — with no way to know what it had already built —
 * produced four near-identical cards on one idea and then narrated cards that
 * never appeared, because `applyActions` drops a create whose title duplicates
 * a card already on the board. Every teaching call must carry the board.
 */
function buildTeachPrompt(
  run: LessonRun,
  step: { title: string; goal: string },
  context: Record<string, unknown>,
): string {
  const board = parseBoardSummary(context.board)
  const stepNo = run.currentStep + 1

  const cardList = board.cards.length
    ? board.cards.map((c) => `  ${c.id} [${c.kind}] "${c.title}" (step ${c.step})`).join('\n')
    : '  (none yet — this is the first card on the board)'

  // The plan in full, so a beat knows what came before it and what is still to
  // come. Teaching one step with no sight of its neighbours is how a step-3
  // card ends up re-explaining step 1.
  const planList = run.steps
    .map((s, i) => {
      const mark =
        s.status === 'known' ? 'tested out'
        : s.status === 'done' ? 'done'
        : i === run.currentStep ? 'YOU ARE HERE'
        : 'upcoming'
      return `  ${i + 1}. ${s.title} — ${s.goal} [${mark}]`
    })
    .join('\n')

  const recent = board.recent.length
    ? board.recent.map((m) => `  ${m.role === 'user' ? 'Student' : 'You'}: ${m.text}`).join('\n')
    : '  (nothing yet)'

  // A budget, not a mood. "Teach one beat" and "build the whole step" read as
  // the same instruction to a model with no sense of how much it has already
  // said, which is why the two paces were indistinguishable in use. A card
  // count is something the model can actually comply with.
  // A step has to be able to end. "Add one card, then stop" with nothing to
  // say when the goal is met is an instruction that never terminates — six
  // beats in, the lesson was still on step 1 with no checkpoint in sight and
  // no way for the learner to finish it.
  const wrapUp = run.beats >= BEATS_BEFORE_CHECK[run.pace] && !board.checkedSteps.includes(stepNo)

  const pace =
    wrapUp
      ? [
          `PACE — CLOSE THIS STEP: it has had ${run.beats} turn(s) already.`,
          'Add at most ONE final card if something essential is missing, then emit ONE',
          'checkpoint action for this step so the student can move on.',
          'The checkpoint is required. Do not end this turn without it.',
        ].join('\n')
      : run.pace === 'run'
      ? [
          'PACE — WHOLE STEP: build this entire step in ONE turn.',
          'Emit 3 or 4 cards that together cover the goal, connect them parent→child,',
          'then emit ONE checkpoint action for this step. Do not stop early.',
        ].join('\n')
      : [
          'PACE — ONE BEAT: add exactly ONE new card (a second only if it is a directly',
          'supporting example), connect it to a related existing card, then stop and wait.',
          'Do NOT try to cover the whole step in this turn.',
        ].join('\n')

  // Told to "use variety" in the abstract, the model returns concept cards and
  // nothing else. Told that it has just made four of them in a row, it varies.
  const onThisStep = board.cards.filter((c) => c.step === stepNo)
  const recentKinds = onThisStep.slice(-3).map((c) => c.kind)
  const sameKindRun =
    recentKinds.length >= 2 && new Set(recentKinds).size === 1 ? recentKinds[0] : null

  const variety = sameKindRun
    ? `VARIETY: your last ${recentKinds.length} cards were all "${sameKindRun}" cards. Do NOT make another one — pick a different type that fits the content (mermaid, worked, table, callout).`
    : ''

  // The recent chat is already listed, and the model still opened five turns
  // running with the same words. Naming the failure works where showing it did
  // not.
  const openers = board.recent
    .filter((m) => m.role === 'assistant')
    .map((m) => m.text.split(/[.!?]/)[0].trim())
    .filter(Boolean)
  const freshOpener = openers.length
    ? `Your "say" must NOT begin like any of these, which you have already used: ${openers.map((o) => `"${o}"`).join('; ')}. Say something specific to THIS card instead.`
    : ''


  return [
    SYSTEM,
    '',
    `LESSON: ${String(context.title ?? 'this topic')}`,
    context.subject ? `SUBJECT: ${String(context.subject)}` : '',
    '',
    'THE PLAN:',
    planList,
    '',
    `CURRENT STEP (step ${stepNo}): ${step.title} — ${step.goal}`,
    `Set "step": ${stepNo} on every card you create this turn.`,
    `BEATS ALREADY SPENT ON THIS STEP: ${run.beats}`,
    '',
    'EXISTING CARDS ON CANVAS (do NOT recreate any of these and do NOT reuse their ids — build on them, and "connect" parent→child to their ids):',
    cardList,
    board.checkedSteps.length
      ? `STEPS ALREADY CHECKED (do NOT emit or announce another checkpoint for these): ${board.checkedSteps.join(', ')}`
      : 'STEPS ALREADY CHECKED: none',
    '',
    'RECENT CHAT (do not repeat a sentence you have already said):',
    recent,
    '',
    pace,
    variety,
    freshOpener,
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
  /**
   * What the learner said when asked. Present on a re-draft, absent on the
   * first pass — the whole point of asking is that the second plan differs.
   */
  answer?: string
}

/**
 * A drafted plan and the questions that came with it.
 *
 * The questions are the half that was missing. A plan the learner cannot
 * respond to is not a negotiation, it is an announcement — and an announcement
 * in a sidebar is one nobody reads.
 */
export interface DraftedPlan {
  steps: LessonStep[]
  /** At most two, asked in the chat beside the plan. Empty on a re-draft. */
  questions: string[]
  /** Whether this lesson teaches programming. Gates the code and web cards. */
  programming: boolean
}

/**
 * Drafts the outline, then lets the gap map decide what may be skipped.
 *
 * Attribution is the reason subtopics are handed to the model at all: a step
 * that names its subtopic can be matched against `topic_mastery`, and that
 * match is what turns a measurement into a lock. A step the model cannot
 * attribute simply stays unlocked.
 */
export async function draftPlan(input: DraftPlanInput): Promise<DraftedPlan> {
  const { min, max } = input.policy.planSize
  // Only offered when there is something real to attribute to. Asked for an
  // id with no catalogue in front of it, the model numbers the steps 1, 2,
  // 3 — and those collide with real subtopic ids belonging to entirely other
  // subjects.
  const catalogue = input.subtopics.length
    ? `\nCURRICULUM SUBTOPICS (attribute each step to one by id where it fits):\n${
        input.subtopics.map((s) => `  ${s.id}: ${s.name}`).join('\n')
      }`
    : ''
  const idField = input.subtopics.length ? ', "subtopicId": <id or omit>' : ''

  // A re-draft has the learner's answer and must not ask again — asking twice
  // is how a setup exchange turns into an interrogation.
  const answering = Boolean(input.answer?.trim())

  const prompt = [
    `Draft a lesson outline for: ${input.title}`,
    input.subject ? `Subject: ${input.subject}` : '',
    `Between ${min} and ${max} steps, ordered so each builds on the last.`,
    catalogue,
    answering ? `\nTHE LEARNER SAID: ${input.answer!.trim()}\nShape the plan around that. Drop steps it makes unnecessary, add ones it calls for.` : '',
    '',
    '',
    'Also set "programming" to true ONLY if this lesson teaches writing or reading',
    'source code. A lesson that merely mentions software, or that quotes dialogue,',
    'prose or formulae, is NOT a programming lesson.',
    '',
    answering
      ? `Reply with JSON only:\n{ "steps": [ { "title": "...", "goal": "one line on what this step teaches"${idField} } ], "questions": [], "programming": <true|false> }`
      : [
          'Also ask AT MOST TWO short questions whose answers would change this plan.',
          'Good questions are about their goal or what they already know — "Exam prep or',
          'understanding it properly?", "Have you done simultaneous equations before?".',
          'Never ask something the plan does not depend on. One question is better than two;',
          'none is fine if the plan genuinely does not turn on anything.',
          '',
          'Reply with JSON only:',
          `{ "steps": [ { "title": "...", "goal": "one line on what this step teaches"${idField} } ],`,
          '  "questions": ["...", "..."], "programming": <true|false> }',
        ].join('\n'),
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

  let parsed: { steps?: unknown; questions?: unknown; programming?: unknown }
  try {
    parsed = parseJsonRobust(raw)
  } catch {
    // No plan is better than a broken one: the learner is asked again rather
    // than shown an outline built from noise.
    return { steps: [], questions: [], programming: false }
  }

  const questions = (Array.isArray(parsed?.questions) ? parsed.questions : [])
    .filter((q: unknown): q is string => typeof q === 'string' && q.trim().length > 0)
    .map((q: string) => q.trim())
    .slice(0, 2)

  // Only ids we actually handed over are accepted. Anything else is a number
  // the model made up, and a made-up id matches a real `topic_mastery` row for
  // a different subject entirely — which is how a lesson on Tarantino dialogue
  // came to tell a learner they had scored 29% on it, borrowing a Biology
  // classification score. A fabricated measurement is worse than none.
  const offered = new Set(input.subtopics.map((sub) => sub.id))

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
        ...(Number.isInteger(subtopicId) && offered.has(subtopicId) ? { subtopicId } : {}),
      }
    })
    .filter((s): s is LessonStep => s !== null)

  const programming = parsed?.programming === true

  if (steps.length === 0 || !input.userId) return { steps, questions, programming }
  return { steps: await applyLocks(steps, input.userId, input.database), questions, programming }
}
