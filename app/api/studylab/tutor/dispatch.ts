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
import { isValidQuestion, coerceQuestion, markCheck, salvageQuestions, type CheckAnswers } from '@/lib/studylab/quiz'
import { parseBoardSummary, type BoardSummary } from '@/lib/studylab/boardSummary'
import { parseHomeworkSheet, stepsFromQuestions } from '@/lib/studylab/homework'
import { isCardKind } from '@/lib/studylab/blocks'
import { parseImageDataUrl } from '@/lib/studylab/imageMime'
import { fenceStudentText, MAX_TYPED_CHARS } from '@/lib/studylab/untrusted'
import { isValidAction, plainTitle, titleKey } from '@/lib/studylab/actions'
import type { CheckpointQuestion } from '@/lib/studylab/types'
import type { Database } from '@/lib/db'
import { systemPrompt } from './system-prompt'
import { validateSpec } from '@/lib/studylab/activities/validate'
import { parseIntent, checkIntent, checkMaterialIntent, type TeachingIntent } from '@/lib/studylab/activities/intent'
import { getApparatus } from '@/lib/studylab/material/canon'
import { validateMaterial } from '@/lib/studylab/material/validate'
import { advertiseVocabulary } from '@/lib/studylab/material/advertiseVocabulary'
import { unmatchedArt } from '@/lib/studylab/activities/artMatch'
import { DIMENSIONS } from '@/lib/studylab/activities/dimensions'
import { assetCatalogPromptBlock } from '@/lib/studylab/activities/assetCatalog'
import { BALANCE_PAN, COMPARE_ZONE } from '@/lib/studylab/activities/dropZoneGeometry'

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
  | { type: 'answer_check'; passed: boolean; missed?: string[]; answers?: CheckAnswers }
  | { type: 'skip'; stepId: string }
  | { type: 'jump'; stepId: string }
  | { type: 'set_pace'; pace: Pace }
  | { type: 'stop' }
  | { type: 'finish' }
  /**
   * `image` is a photo of their own work, pasted into the chat.
   *
   * The attach button has always been there and the photo has always shown in
   * the transcript; nothing ever read it, so the tutor answered as though the
   * page were not in front of it.
   */
  | { type: 'ask'; question: string; image?: string }
  /**
   * Homework only, and the replacement for `draft_plan` + `accept_plan` there.
   *
   * The questions the learner picked off their own sheet become the steps, so
   * no model call drafts anything: a sheet is already an ordered plan somebody
   * set them, and asking a model to invent a different one produced a five-step
   * course in Engineering Economics for a single pump question.
   */
  | { type: 'start_homework'; sheet: unknown; questionIds: string[] }
  /**
   * A second page of the same assignment, added to a plan already running.
   *
   * Separate from `start_homework` because it must NOT teach: the learner is
   * part-way through question two, and a teaching turn here would add another
   * card to that rather than acknowledge the page. `editPlan` keeps the current
   * step where it is, so the new questions simply wait their turn.
   */
  | { type: 'add_homework_page'; sheet: unknown; questionIds: string[] }

export interface DispatchInput {
  run: LessonRun
  policy: LessonPolicy
  userId: string | null
  action: LessonAction
  /** Everything the teaching job needs to write its cards. Absent in tests. */
  context?: Record<string, unknown>
  requestId?: string
  /**
   * When the route must answer by, as epoch ms. Amplify ends a request at
   * 30 s and the student reads a gateway error page; past this the model
   * call is abandoned so the route can say so itself. Absent in tests.
   */
  deadline?: number
}

/**
 * Time a closing check needs to be worth starting. The cheap model takes a
 * few seconds; started any later, it would cost the turn it rides on.
 */
const CLOSE_CHECK_BUDGET_MS = 8_000

/** Aborts a model call at the deadline. Undefined without one. */
function signalFor(deadline: number | undefined): AbortSignal | undefined {
  if (deadline === undefined) return undefined
  return AbortSignal.timeout(Math.max(1, deadline - Date.now()))
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
  /**
   * The refusal is a turn that failed for a reason pressing again can fix
   * (a reply that did not parse, a check that did not write), so the page
   * offers Try again. Absent on a refusal that is a rule, which would only
   * refuse again.
   */
  retry?: boolean
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
  /**
   * What the tutor said it was teaching, for every material it attempted —
   * collected before `materialRefusals` is applied, so a refused attempt is
   * in here too.
   *
   * That inclusion is deliberate, not a leak: the whole question this phase
   * asks is whether the tutor reasons about a material or reaches for the
   * same apparatus every time, and a claim it made and then had refused is as
   * much evidence of that as one that was kept. Neither is visible from the
   * board alone.
   */
  intents?: TeachingIntent[]
  /** Materials refused, with the reason each was refused. */
  materialRefusals?: string[]
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
    case 'start_homework': {
      const steps = stepsFromQuestions(parseHomeworkSheet(action.sheet), action.questionIds)
      if (steps.length === 0) return { ok: false, reason: 'Pick at least one question to work on.' }
      const proposed = proposePlan(run, steps)
      return proposed.ok ? acceptPlan(proposed.run) : proposed
    }
    case 'add_homework_page': {
      // Built here, not sent: the steps decide what the lesson is, and a client
      // that could post its own would be posting its own lesson.
      const steps = stepsFromQuestions(
        parseHomeworkSheet(action.sheet),
        action.questionIds,
        run.steps.length,
      )
      if (steps.length === 0) return { ok: false, reason: 'Pick at least one question from that page.' }
      return editPlan(run, { add: steps }, policy)
    }
    case 'next_beat': return nextBeat(run)
    case 'test_out': return requestTestOut(run, action.stepId, action.checkpointId, policy)
    case 'answer_check': {
      // Marked here when the run holds the questions; the page's `passed` is
      // only taken for a check opened before they were kept.
      const questions = run.openCheck?.questions
      const passed = questions?.length ? markCheck(questions, action.answers) : action.passed
      return passed ? passCheck(run) : failCheck(run, action.missed ?? [])
    }
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
 * Cards on one step before the tutor is told to close it with a check.
 *
 * Counted on the board rather than in `beats`, because beats do not measure
 * what they were standing in for. `accept_plan` teaches the first turn without
 * incrementing `beats`, so at "run" pace — where one turn builds three or four
 * cards — step one reached TEN cards before its check appeared. The board knows
 * how much has been taught; the counter only knew how many times a button was
 * pressed.
 *
 * The SYSTEM prompt already says each step is one idea and 2-4 cards is plenty.
 * This is the number that makes that true.
 */
const CARDS_BEFORE_CHECK = 3

/**
 * Whether this step has been taught enough that it should now be checked.
 *
 * Counted since the LAST check on this step, not since the step began. Reading
 * "this step already has a checkpoint" as "this step is finished with being
 * checked" is what made a missed question unrecoverable: the check was failed,
 * the tutor re-taught the point as it should, and then never asked again —
 * fifteen more cards on one idea and no way to reach the next step.
 *
 * A first check comes after a step's worth of teaching. A retry comes sooner:
 * the learner has already had the step, and one card re-teaching the thing they
 * missed is the whole of what is new.
 *
 * Cards made in answer to a question are not teaching and do not count, so a
 * step gets taught in full whether or not the learner asked anything.
 *
 * At "step by step" the first turn of a step can never close it, whatever it
 * built. The pace promises "one card at a time, I stop after each so you can
 * ask" — and the model opened a step with four cards and a quiz, which is the
 * other pace wearing this one's label. A count of cards cannot tell those
 * apart; a count of turns can.
 */
function shouldCloseStep(board: BoardSummary, stepNo: number, run: LessonRun): boolean {
  if (run.pace === 'step' && run.beats < 1) return false
  // After three misses the turn is spent re-teaching the idea a different way,
  // and a check on the end of that is a fourth attempt at the same ground with
  // nothing new behind it. The turn after this one asks again.
  const missed = board.askedByStep[stepNo]?.length ?? 0
  if (missed >= 3 && (board.cardsSinceCheck[stepNo] ?? 0) < 1) return false
  const since =
    board.cardsSinceCheck[stepNo] ??
    board.cards.filter((c) => c.step === stepNo && !c.aside).length
  const retry = board.checkedSteps.includes(stepNo)
  return since >= (retry ? 1 : CARDS_BEFORE_CHECK)
}

/**
 * The board with the cards this turn just made counted in.
 *
 * The summary arrives from the client and predates the turn, so without this
 * the step is judged one turn behind and its check always lands late. Cards
 * made in answer to a question are left out, the same as everywhere else.
 */
function boardWithTurn(board: BoardSummary, actions: unknown[], stepNo: number): BoardSummary {
  const madeNow = actions.filter(
    (a) =>
      !!a &&
      typeof a === 'object' &&
      (a as { type?: unknown }).type === 'createCard' &&
      (a as { aside?: unknown }).aside !== true,
  ).length
  const base =
    board.cardsSinceCheck[stepNo] ??
    board.cards.filter((c) => c.step === stepNo && !c.aside).length
  return { ...board, cardsSinceCheck: { ...board.cardsSinceCheck, [stepNo]: base + madeNow } }
}

const ALWAYS_TEACHES = new Set(['accept_plan', 'next_beat', 'answer_check', 'start_homework'])

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

  const raw = await callGemma(buildTeachPrompt(advanced, step, input.context ?? {}, false), {
    maxTokens: 2600,
    temperature: 0.6,
    model: modelForJob('teach_beat'),
    usage: input.requestId
      ? { feature: 'lesson_teach_beat', requestId: input.requestId, userId: input.userId }
      : undefined,
    signal: signalFor(input.deadline),
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
      retry: true,
    }
  }

  const say = typeof parsed?.say === 'string' ? parsed.say.trim() : ''
  const returned = Array.isArray(parsed?.actions) ? parsed.actions : []

  // A turn that says nothing and builds nothing is a dead turn. The client only
  // renders a message when there is one, so this reached the learner as Continue
  // doing absolutely nothing — and with the run already advanced, pressing it
  // again just moved further from a card. State is left untouched so the retry
  // starts from the same place.
  if (!say && returned.length === 0) {
    return {
      run: input.run,
      say: '',
      actions: [],
      suggestions: [],
      refusal: 'That did not come through. Try that again.',
      retry: true,
    }
  }

  const rawActions = fitCardsToLesson(returned, advanced)

  // A turn that tried to build something and got all of it wrong is a turn
  // that built nothing, and the `say` will happily describe it anyway: the
  // chat read "Here's a practice question to help you solidify your
  // understanding" beside a board with no question on it. Saying so and
  // leaving state alone lets the learner press again from the same place.
  if (returned.length > 0 && !rawActions.some(isValidAction)) {
    return {
      run: input.run,
      say: '',
      actions: [],
      suggestions: [],
      refusal: 'That did not come through. Try that again.',
      retry: true,
    }
  }

  // A turn whose every card already exists is a turn that builds nothing. The
  // reducer drops repeats — by id and by title, in any word order — so the
  // learner would get "here's the next idea" with an unchanged board and no
  // way to tell the difference from a broken button. Caught here, where the
  // board is known, rather than after the client has silently discarded it.
  if (isAllRepeats(rawActions, board)) {
    return {
      run: input.run,
      say: '',
      actions: [],
      suggestions: [],
      refusal: 'I nearly repeated myself there — press continue again.',
      retry: true,
    }
  }
  const opened = openEmittedCheckpoint(advanced, rawActions, board)

  // Asking was never enough. Told plainly to close the step with a checkpoint,
  // the model often returns three more cards instead — which is how one step
  // reached ten cards and the learner could not finish it. When the step is
  // full and nothing came back to close it, the check is written here, on the
  // cheap model, from the step's own goal.
  const closed = await ensureStepCloses(opened.run, opened.actions, board, input)

  // Collected before the strip below: refuseUnjustifiedActivities drops the
  // `intent` field off every material it keeps, since the intent is why the
  // material exists rather than part of it — left on, it would ride into the
  // node's data and onto the screen. The whole question this phase asks is
  // whether the tutor reasons about a material or reaches for the same
  // apparatus every time, and that is invisible from the board alone unless
  // it is captured here, before the strip removes it.
  const intents = closed.actions
    .map((a) => (a && typeof a === 'object' ? parseIntent((a as Record<string, unknown>).intent) : null))
    .filter((i): i is TeachingIntent => i !== null)
  const { kept: afterActivities, refused: activityRefusals } = refuseUnjustifiedActivities(closed.actions)
  const { kept, refused: buildMaterialRefusals } = refuseUnjustifiedMaterials(afterActivities)
  const materialRefusals = [...activityRefusals, ...buildMaterialRefusals]
  for (const reason of materialRefusals) console.log(`Refused a material: ${reason}`)

  return {
    run: closed.run,
    say,
    actions: kept,
    suggestions: Array.isArray(parsed?.suggestions)
      ? parsed.suggestions.filter((s): s is string => typeof s === 'string').slice(0, 3)
      : [],
    intents: intents.length > 0 ? intents : undefined,
    materialRefusals: materialRefusals.length > 0 ? materialRefusals : undefined,
  }
}

/**
 * A homework step's check: their own question, asked back.
 *
 * The practice cards along the way set the parts of the working. This is the
 * whole of it — the thing they hand in — so it is a short answer marked against
 * what the sheet said a correct answer has to show, and there is nothing to
 * reveal. Returns null for an ordinary lesson step, which is checked the
 * ordinary way.
 */
function homeworkCheck(step: LessonStep): CheckpointQuestion | null {
  const hw = step.homework
  if (!hw) return null
  return {
    id: `${step.id}-answer`,
    format: 'short',
    prompt: step.goal,
    rubric:
      hw.rubric ??
      'Answers the question that was set, and shows the working that gets there. Mark on the idea and the method, in whatever words the student used.',
  }
}

/**
 * Puts a check on a step the tutor was told to close and did not.
 *
 * The prompt asks for one once a step is full. Compliance is unreliable, and an
 * unreliable close is the same as no close: the step keeps growing and the
 * learner has no way to reach the next one. This does deterministically what
 * the prompt requests, using the same job a test-out uses.
 *
 * Every failure path returns the run untouched. An open check with no questions
 * to answer strands the learner far worse than a step that runs one card long,
 * because `beginCheck` refuses to open a second check while one is open.
 */
async function ensureStepCloses(
  run: LessonRun,
  actions: unknown[],
  board: BoardSummary,
  input: DispatchInput,
): Promise<{ run: LessonRun; actions: unknown[] }> {
  const stepIndex = run.currentStep
  const step = run.steps[stepIndex]
  if (!step) return { run, actions }

  const stepNo = stepIndex + 1

  const alreadyClosing =
    run.openCheck !== undefined ||
    actions.some((a) => !!a && typeof a === 'object' && (a as { type?: unknown }).type === 'checkpoint')
  if (alreadyClosing) return { run, actions }

  if (!shouldCloseStep(boardWithTurn(board, actions, stepNo), stepNo, run)) return { run, actions }

  // A fresh id every time. The reducer ignores a checkpoint whose id is already
  // on the board, so a fixed one meant the SECOND check on a step — the retry
  // after a miss — was silently dropped, leaving the run holding an open check
  // with nothing to answer.
  const checkpointId = `cp-${step.id}-${Math.random().toString(36).slice(2, 6)}`
  let questions: CheckpointQuestion[]

  // On homework the check is the question. Nothing is written, and no call is
  // made: the student was set a question, they have been worked through it, and
  // what closes the step is answering the thing they have to hand in. A quiz
  // about the topic in general would be a third party's question in the middle
  // of their own.
  const own = homeworkCheck(step)
  if (own) {
    questions = [own]
  } else {
    // A slow teaching turn leaves no room for a second call. The step stays
    // open and the next turn closes it, which beats the whole turn timing out.
    if (input.deadline !== undefined && input.deadline - Date.now() < CLOSE_CHECK_BUDGET_MS) {
      return { run, actions }
    }
    try {
      questions = await writeCheck(
        step, checkpointId, input.userId, input.requestId, 'close-step',
        board.askedByStep[stepNo] ?? [], signalFor(input.deadline),
      )
    } catch {
      return { run, actions }
    }
  }
  if (questions.length === 0) return { run, actions }

  const begun = beginCheck(run, step.id, checkpointId, 'checkpoint', 'hard')
  if (!begun.ok) return { run, actions }

  return {
    run: keepQuestions(begun.run, checkpointId, questions),
    actions: [
      ...actions,
      { type: 'checkpoint', id: checkpointId, step: stepNo, gate: 'hard', questions },
    ],
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
    case 'add_homework_page': {
      const added = action.questionIds.length
      return added === 1
        ? 'Added that question to your list.'
        : `Added those ${added} questions to your list.`
    }
    case 'stop':
      return 'Paused. Nothing is lost — pick it back up whenever you want.'
    case 'finish':
      return 'That is the lesson done. Everything you built is on the board.'
    default:
      return ''
  }
}

/**
 * Whether a turn's cards were all things the board already has.
 *
 * Only cards count towards this. A turn that emits a checkpoint, updates a card
 * in place, or draws a connection has done something real even if it created
 * nothing new.
 */
function isAllRepeats(actions: unknown[], board: BoardSummary): boolean {
  const creates = actions.filter(
    (a) => !!a && typeof a === 'object' && (a as { type?: unknown }).type === 'createCard',
  ) as { id?: unknown; title?: unknown }[]
  if (creates.length === 0) return false

  const doesSomethingElse = actions.some(
    (a) =>
      !!a &&
      typeof a === 'object' &&
      ['checkpoint', 'updateCard'].includes(String((a as { type?: unknown }).type)),
  )
  if (doesSomethingElse) return false

  const ids = new Set(board.cards.map((c) => c.id))
  const titles = new Set(board.cards.map((c) => titleKey(c.title)))

  return creates.every((c) => {
    const id = typeof c.id === 'string' ? c.id : ''
    const key = typeof c.title === 'string' ? titleKey(c.title) : ''
    return (id && ids.has(id)) || (key && titles.has(key))
  })
}

/** Card types that render a Run button or a live preview. */
const RUNS_CODE = new Set(['code', 'web'])

/**
 * Rewrites a card type the prompt no longer offers.
 *
 * "diagram" is gone: of the 42 on real boards, 26 had no drawing in them at
 * all — a titled box saying nothing. The renderer stays so those boards keep
 * working, but nothing new should arrive as one. A stray becomes a mermaid card
 * when it carries diagram syntax, and a concept card when it does not, so its
 * words survive either way.
 */
function retireDiagramCard(a: Record<string, unknown>): Record<string, unknown> {
  if (a.card !== 'diagram') return a
  const mermaid = typeof a.mermaid === 'string' ? a.mermaid.trim() : ''
  if (mermaid) return { ...a, card: 'mermaid' }

  const { svg, mermaid: _m, ...rest } = a
  const body = typeof a.body === 'string' && a.body.trim() ? a.body : ''
  return { ...rest, card: 'concept', body }
}

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
 * The lettered options the model keeps putting on a practice card.
 *
 * Returns the stem and the options only when it really is multiple choice:
 * three or more letters, in order, starting at A. Anything less is a body that
 * merely happens to contain a bracket.
 */
function splitMcq(body: string): { stem: string; options: Record<string, string> } | null {
  const marks: { letter: string; at: number; after: number }[] = []
  const re = /(?:^|\s)([A-E])[).]\s+/g
  let m: RegExpExecArray | null
  while ((m = re.exec(body)) !== null) {
    const letter = m[1]
    const expected = String.fromCharCode(65 + marks.length)
    if (letter !== expected) continue
    marks.push({ letter, at: m.index, after: re.lastIndex })
  }
  if (marks.length < 3) return null

  const options: Record<string, string> = {}
  marks.forEach((mark, i) => {
    const end = i + 1 < marks.length ? marks[i + 1].at : body.length
    options[mark.letter] = body.slice(mark.after, end).trim().replace(/[.;]$/, '')
  })
  return { stem: body.slice(0, marks[0].at).trim(), options }
}

/**
 * Turns a multiple-choice practice card back into something to work out.
 *
 * A practice card is a text box the student writes in and a marker that reads
 * what they wrote. The model put "Which of the following best describes the
 * role of an enzyme? A) ... B) ... C) ..." in one, so the student's whole task
 * was typing a letter — recognition dressed as practice, and awkward to mark.
 *
 * The options come off and the stem is repaired ("which of the following"
 * without anything following is not a sentence). The expected answer is
 * recovered from the option the letter pointed at, so marking still has
 * something to compare against. A stem with nothing left in it is dropped —
 * a step with no practice card is a state the lesson already handles, and a
 * broken card is not.
 */
function unMultipleChoice(a: Record<string, unknown>): Record<string, unknown> | null {
  if (a.type !== 'createCard' || a.card !== 'practice') return a
  const body = typeof a.body === 'string' ? a.body : ''
  const split = splitMcq(body)
  if (!split) return a

  const stem = split.stem
    .replace(/\bwhich (?:of the following|of these|option|one)\b/gi, 'Which')
    .replace(/\s{2,}/g, ' ')
    .trim()
  if (stem.length < 15) return null

  const letter =
    typeof a.answer === 'string' ? a.answer.trim().replace(/[).]$/, '').toUpperCase() : ''
  const answer = letter.length === 1 && split.options[letter] ? split.options[letter] : a.answer

  return { ...a, body: stem, answer }
}

/**
 * Repairs a card the model addressed by its kind instead of its type.
 *
 * The contract is `{ "type": "createCard", "card": "practice", ... }`, and the
 * model wrote `{ "type": "practice", ... }` — everything else correct: id,
 * title, body, answer, rubric, step. `isValidAction` does not recognise it, so
 * the reducer dropped it without a word, the chat listed nothing, and the
 * learner read "Here's a practice question to help you solidify your
 * understanding" beside a board with no question on it. Asking again produced
 * the same near miss, which is why practice sometimes never arrived at all.
 *
 * One field away from working is worth repairing rather than discarding.
 */
function coerceCardAction(a: Record<string, unknown>): Record<string, unknown> {
  if (typeof a.type !== 'string' || !isCardKind(a.type)) return a
  return { ...a, type: 'createCard', card: a.type }
}

/**
 * Drops any material the tutor could not justify, and says why.
 *
 * Every other check in this chain repairs what the model got wrong. This one
 * cannot: a material whose stated reason does not match what it varies is not
 * a formatting fault, it is the tutor reaching for the apparatus it always
 * reaches for and inventing a rationale afterwards. The refusal carries the
 * mismatch so the next turn has something to act on — telling it only that the
 * turn failed produces the same turn again.
 */
export function refuseUnjustifiedActivities(actions: unknown[]): {
  kept: unknown[]
  refused: string[]
} {
  const kept: unknown[] = []
  const refused: string[] = []

  for (const raw of actions) {
    if (!raw || typeof raw !== 'object' || (raw as Record<string, unknown>).type !== 'createActivity') {
      kept.push(raw)
      continue
    }
    const a = raw as Record<string, unknown>

    if (!validateSpec(a.spec)) {
      const pattern = (a.spec as { pattern?: unknown } | null | undefined)?.pattern
      const named = typeof pattern === 'string' && pattern ? `"${pattern}"` : 'activity'
      // Server-side, the whole spec. A material dropped for its shape is the
      // one failure invisible from the board — the turn simply teaches less —
      // and "the spec was malformed" names neither the apparatus nor the field,
      // so nobody reading a live transcript could tell which of nine schemas
      // was missed. The refusal handed back to the tutor stays short.
      console.log(`Malformed activity spec: ${JSON.stringify(a.spec)}`)
      refused.push(
        `The ${named} spec was malformed — its payload, prompt or success rule does not match ` +
          `that apparatus's schema, so nothing was built. Check it field for field.`,
      )
      continue
    }
    const intent = parseIntent(a.intent)
    if (!intent) {
      refused.push(
        'Every material needs an intent: goal, the single quality it isolates, the apparatus, and why.',
      )
      continue
    }
    const verdict = checkIntent(intent, a.spec)
    if (!verdict.ok) {
      refused.push(verdict.reason)
      continue
    }
    const wordy = unmatchedArt(a.spec)
    if (wordy.length > 0) {
      refused.push(
        `These are shown as words but the catalogue has pictures for them: ${wordy.join(', ')}. ` +
          `Set imageUrl to the catalogue name — a word matched against a word is not a material.`,
      )
      continue
    }
    // The intent is why the material exists, not part of it; keeping it on the
    // action would carry it into the node's data and onto the screen.
    const { intent: _dropped, ...action } = a
    kept.push(action)
  }
  return { kept, refused }
}

/**
 * Drops any free-form material the tutor could not justify, and says why.
 *
 * Mirrors `refuseUnjustifiedActivities` for `build_material`: intent must be
 * present, the apparatus must be canon, the spec must validate, and the stated
 * isolates must match the apparatus — not be invented from the topic.
 */
export function refuseUnjustifiedMaterials(actions: unknown[]): {
  kept: unknown[]
  refused: string[]
} {
  const kept: unknown[] = []
  const refused: string[] = []

  for (const raw of actions) {
    if (!raw || typeof raw !== 'object' || (raw as Record<string, unknown>).type !== 'build_material') {
      kept.push(raw)
      continue
    }
    const a = raw as Record<string, unknown>

    const intent = parseIntent(a.intent)
    if (!intent) {
      refused.push(
        'Every material needs an intent: goal, the single quality it isolates, the apparatus, and why.',
      )
      continue
    }

    const apparatus = getApparatus(intent.apparatus)
    if (!apparatus) {
      refused.push(
        `Unknown apparatus "${intent.apparatus}". Choose one from the canon list — ` +
          `each apparatus is built to teach one quality.`,
      )
      continue
    }

    const validation = validateMaterial(a.spec, apparatus.maxVaryingTraits)
    if (!validation.ok) {
      console.log(`Malformed build_material spec: ${JSON.stringify(a.spec)}`)
      refused.push(validation.reason)
      continue
    }

    const verdict = checkMaterialIntent(intent, validation.spec)
    if (!verdict.ok) {
      refused.push(verdict.reason)
      continue
    }

    const { intent: _dropped, ...action } = a
    kept.push(action)
  }
  return { kept, refused }
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
  // Retiring the diagram card applies to every lesson; only the runnable-card
  // rule below turns on whether this one teaches programming.
  const retired = actions
    .map((raw) =>
      raw && typeof raw === 'object' ? coerceCardAction(raw as Record<string, unknown>) : raw,
    )
    .map((raw) => {
      // "aside" decides when a step is finished being taught, so it is not the
      // model's to set. It comes off here and is put back by `markAsides` on
      // the one turn that is entitled to it.
      if (!raw || typeof raw !== 'object' || !('aside' in raw)) return raw
      const { aside, ...rest } = raw as Record<string, unknown>
      return rest
    })
    .map((raw) =>
      raw && typeof raw === 'object' ? unMultipleChoice(raw as Record<string, unknown>) : raw,
    )
    .filter((raw) => raw !== null)
    .map((raw) =>
      raw && typeof raw === 'object' ? retireDiagramCard(raw as Record<string, unknown>) : raw,
    )
  if (run.programming !== false) return retired

  return retired.map((raw) => {
    if (!raw || typeof raw !== 'object') return raw
    const a = raw as Record<string, unknown>
    if (a.type !== 'createCard' || typeof a.card !== 'string' || !RUNS_CODE.has(a.card)) return a

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
  board: BoardSummary,
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

  // When a check may appear is not the model's call. It emitted one on the very
  // first turn of a step at "step by step" pace — three cards and a quiz where
  // the learner had asked for one card at a time — and, worse, a single card
  // re-taught after a miss brought the retry straight back. `shouldCloseStep`
  // is the one gate, so the same rule decides whether an emitted check opens as
  // decides whether one gets written; and it is what keeps a learner's own
  // questions from shortening the step.
  // On homework the check is the question they were set, written by
  // `homeworkCheck` from their own sheet. A quiz the model invented about the
  // topic in general would be a third party's question in the middle of their
  // own, and it would close the step without them ever answering theirs.
  if (target.homework) {
    return { run, actions: rawActions.filter((_, i) => i !== cpIndex) }
  }

  const stepNo = run.steps.indexOf(target) + 1
  if (!shouldCloseStep(boardWithTurn(board, rawActions, stepNo), stepNo, run)) {
    return { run, actions: rawActions.filter((_, i) => i !== cpIndex) }
  }

  // The id is ours, not the model's. Re-teaching a step it had already checked,
  // the model emitted `cp-3-a7` a second time — the id of the check the learner
  // had just failed. The reducer drops a checkpoint whose id is already on the
  // board, so no new questions appeared, while the run opened a check against
  // that id and waited for an answer to cards that were already answered and
  // gone. Nothing could resolve it and the lesson stopped dead on step three.
  const id = `cp-${target.id}-${Math.random().toString(36).slice(2, 6)}`
  const renamed = rawActions.map((a, i) => (i === cpIndex ? { ...(a as object), id } : a))

  const opened = beginCheck(run, target.id, id, 'checkpoint', gate)
  if (!opened.ok) {
    // Already open (or the step vanished from the plan): keep the run as it
    // was and drop the duplicate rather than returning a quiz that cannot
    // resolve anything.
    return { run, actions: rawActions.filter((_, i) => i !== cpIndex) }
  }
  return {
    run: keepQuestions(opened.run, id, (rawActions[cpIndex] as { questions?: unknown }).questions),
    actions: renamed,
  }
}

/**
 * Puts a check's questions on the run, where `answer_check` marks against
 * them. Salvaged the way the board salvages them, so the ids match the
 * questions the learner actually sees.
 */
function keepQuestions(run: LessonRun, checkpointId: string, raw: unknown): LessonRun {
  if (run.openCheck?.checkpointId !== checkpointId) return run
  return { ...run, openCheck: { ...run.openCheck, questions: salvageQuestions(checkpointId, raw) } }
}

/**
 * Marks every card a turn built as an aside.
 *
 * Set here rather than trusted from the model: the flag decides when a step is
 * finished being taught, so it is not something a card should be able to claim
 * for itself.
 */
function markAsides(actions: unknown[]): unknown[] {
  return actions.map((a) =>
    a && typeof a === 'object' && (a as { type?: unknown }).type === 'createCard'
      ? { ...(a as object), aside: true }
      : a,
  )
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
    questions = await writeCheck(
      step, check.checkpointId, input.userId, input.requestId, 'test-out', [], signalFor(input.deadline),
    )
  } catch {
    return {
      run: input.run,
      say: '',
      actions: [],
      suggestions: [],
      refusal: 'That did not come through. Try that again.',
      retry: true,
    }
  }

  if (questions.length === 0) {
    return {
      run: input.run,
      say: '',
      actions: [],
      suggestions: [],
      refusal: 'Could not put together a check for that step — try again.',
      retry: true,
    }
  }

  return {
    run: keepQuestions(advanced, check.checkpointId, questions),
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
  const question = input.action.type === 'ask' ? String(input.action.question ?? '').trim() : ''
  if (!question) {
    return { run: input.run, say: '', actions: [], suggestions: [], refusal: 'Ask me something first.' }
  }
  if (question.length > MAX_TYPED_CHARS) {
    return {
      run: input.run, say: '', actions: [], suggestions: [],
      refusal: `That is a lot to take in at once. Keep a question under ${MAX_TYPED_CHARS.toLocaleString('en')} characters.`,
    }
  }

  // A finished lesson has no current step, and that is exactly when a learner
  // asks a follow-up. Answering against the last step they were on is better
  // than the silence this used to return: no card, no reply, no refusal, just
  // a question that vanished.
  const step =
    advanced.steps[advanced.currentStep] ??
    [...advanced.steps].reverse().find((s) => s.status === 'done' || s.status === 'known') ??
    advanced.steps[advanced.steps.length - 1]

  if (!step) {
    return {
      run: advanced,
      say: '',
      actions: [],
      suggestions: [],
      refusal: 'There is no lesson here yet — start one and I can answer that.',
    }
  }

  // A photo of their own work, pasted into the chat. Looked at on this turn
  // only: it is what they are asking about, not something the lesson carries
  // forward. The attach button has always been there and the photo has always
  // shown in the transcript — nothing ever read it, so the tutor answered as
  // though the page were not in front of it.
  const photo = input.action.type === 'ask' ? parseImageDataUrl(input.action.image) : null

  const finished = advanced.phase === 'done'
  const prompt = [
    buildTeachPrompt(advanced, step, input.context ?? {}, true),
    '',
    finished
      ? 'The lesson is FINISHED. The student has a follow-up question about it — answer it against the whole lesson, adding a card if that is the clearest way. Do not restart the lesson and do not emit a checkpoint.'
      : "The student has a question about the current step — answer it. You may add or update a card if that's the clearest way to explain, but do NOT advance to a new beat or step.",
    photo
      ? 'THEY HAVE ATTACHED A PHOTO OF THEIR OWN WORK. Read it and answer what is actually on it — say what is right before what is wrong, and name the first line that goes wrong rather than listing everything. Do not write out a corrected version for them to copy.'
      : '',
    fenceStudentText('QUESTION', question),
  ]
    .filter(Boolean)
    .join('\n')

  const raw = await callGemma(prompt, {
    maxTokens: 2600,
    temperature: 0.6,
    model: modelForJob('teach_beat'),
    ...(photo ? { image: photo } : {}),
    usage: input.requestId
      ? { feature: photo ? 'lesson_ask_photo' : 'lesson_ask', requestId: input.requestId, userId: input.userId }
      : undefined,
    signal: signalFor(input.deadline),
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
      retry: true,
    }
  }

  // A checkpoint is dropped whatever the model returns. Asking a question must
  // never put a gate in front of the learner: the check would render on the
  // canvas with nothing in the run to resolve it, so Continue would block on a
  // quiz that answering could not clear.
  //
  // A material is dropped for the same reason: an aside explains what already
  // exists, it does not set new work, so it may no more build an activity than
  // it may open a checkpoint. `buildTeachPrompt` is already told not to ask for
  // one on this path, but a prompt is not a guarantee — this is the backstop,
  // and it is the one place that matters, since a material that got this far
  // would otherwise skip `refuseUnjustifiedActivities` entirely: that check
  // only runs on the teaching path, not this one.
  //
  // What survives is marked as an aside, so the step's own teaching is not
  // shortened by it. The check arrives after a step's worth of cards, counted
  // off the board — which meant three questions, each answered with a card,
  // brought the check forward and the step was taught less than a step that
  // nobody asked anything about.
  const DROPPED_ON_ASIDE = new Set(['checkpoint', 'createActivity', 'build_material'])
  const asideActions = markAsides(
    fitCardsToLesson(
      (Array.isArray(parsed?.actions) ? parsed.actions : []).filter(
        (a) => !a || typeof a !== 'object' || !DROPPED_ON_ASIDE.has(String((a as { type?: unknown }).type)),
      ),
      advanced,
    ),
  )
  // Same rule as a teaching turn: an answer that describes a card it failed to
  // build is worse than one that admits it did not come through.
  if (asideActions.length > 0 && !asideActions.some(isValidAction)) {
    return {
      run: input.run,
      say: '',
      actions: [],
      suggestions: [],
      refusal: 'That did not come through. Try that again.',
      retry: true,
    }
  }

  return {
    run: advanced,
    say: typeof parsed?.say === 'string' ? parsed.say : '',
    actions: asideActions,
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
  /**
   * Why the check is being written, which is what decides how long it is.
   *
   * Closing a step is a "did that land?" — the SYSTEM prompt asks for one or
   * two questions, answerable in under a minute from what was just taught.
   * Testing out is a claim to have the whole step already, and deserves more
   * than a single question before it is waved through. Both used to ask for
   * two or three, so closing a step could land three questions on a learner
   * who had read three cards.
   */
  kind: 'close-step' | 'test-out' = 'test-out',
  /** Questions already put to this learner on this step. Never ask them again. */
  asked: string[] = [],
  signal?: AbortSignal,
): Promise<CheckpointQuestion[]> {
  // The field names are spelled out with a worked example of each shape.
  // Naming only the formats got back `type` and `question` every time — a
  // reasonable guess, and one that failed validation silently.
  const prompt = [
    `Write a short knowledge check for one step of a lesson.`,
    `STEP: ${step.title}`,
    `GOAL: ${step.goal}`,
    '',
    kind === 'close-step'
      ? 'EXACTLY ONE question. It confirms the idea just taught landed; it is not an exam, the student has only read a few cards, and they have already worked a practice problem.'
      : 'Two or three questions, enough to tell whether someone already knows this well enough to skip it.',
    'Keep them on this step only.',
    asked.length
      ? [
          '',
          'You have ALREADY asked this student the following, and they did not get it:',
          ...asked.map((q) => `  - ${q}`),
          'Ask something DIFFERENT. Not a rewording — a different angle on the same idea,',
          'or a concrete case they have to judge. Repeating a question they just missed',
          'gives them no second chance at anything.',
          'Ask EXACTLY ONE question and make its "format" "short", so they have to say',
          'the answer rather than spot it. A reworded multiple choice is the failure',
          'this rule exists to stop.',
          // Three misses is not a signal to ask harder. Getting one thing right
          // and moving on beats a fourth failure on the same ground.
          asked.length >= 3
            ? 'They have now missed this three times or more. Ask the SIMPLEST question that still shows they have the core idea, not the full version of it.'
            : '',
        ]
          .filter(Boolean)
          .join('\n')
      : '',
    '',
    'Each question needs "id", "format" and "prompt". Use these EXACT field names:',
    '',
    '{ "questions": [',
    '  { "id": "q1", "format": "mcq", "prompt": "...?",',
    '    "options": ["...", "...", "...", "..."], "answer": 1 },',
    '  { "id": "q2", "format": "short", "prompt": "...?",',
    '    "rubric": "the one idea a correct answer shows" },',
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
    signal,
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
  const valid = questions.filter(isValidQuestion).map(coerceQuestion)

  // Trimmed, not requested. Told plainly to ask one question, the check job
  // returns two or three often enough that a learner closing a step after
  // three cards was handed a test. A cap is the only version of this the model
  // cannot talk itself out of.
  //
  // One, not two: asked for a pair, the model wrote "Why is it important to
  // isolate the x² and constant terms?" as multiple choice and "Explain why
  // isolating the x² and constant terms is a crucial first step" as a short
  // answer — the same question twice, in two formats, on a step the learner
  // had already worked a practice problem for. The pace copy promises "a
  // quick check", and one question is what that is.
  const marked = valid.map(acceptsParaphrase)

  // A retry is one question, and the one that makes them say the answer if the
  // model gave us one. Two goes at the same idea is not a second chance.
  if (asked.length > 0) {
    const short = marked.find((q: CheckpointQuestion) => q.format === 'short')
    return short ? [short] : marked.slice(0, 1)
  }

  return marked.slice(0, kind === 'close-step' ? 1 : 3)
}

/**
 * Says on the rubric that the learner's own words count.
 *
 * The rubric travels verbatim into the grading prompt as the expected idea,
 * and the grader reads it as a checklist. Asked why the x² and constant terms
 * are isolated first, a learner answered "it puts the x² and x terms on one
 * side by themselves, so you can add (b/2)² to both sides and turn that side
 * into a perfect square" — the whole point, in their own words — and was
 * marked wrong for not using the rubric's phrasing.
 *
 * Saying it in the rubric is the lever available from this side: the grading
 * route builds its own prompt and this is the only text it takes from here.
 */
function acceptsParaphrase(q: CheckpointQuestion): CheckpointQuestion {
  if (q.format !== 'short') return q
  const rubric = (q.rubric ?? '').trim()
  if (!rubric) return q
  if (/own words/i.test(rubric)) return q
  return {
    ...q,
    rubric: `${rubric.replace(/[.\s]+$/, '')}. Mark this correct if the answer shows that idea, in whatever words the student used — never require particular phrasing.`,
  }
}

/**
 * The whole of what a montessori turn may build, in one block.
 *
 * Ported from the deleted `lib/studylab/tutorPrompt.ts`, whose `MONTESSORI`
 * block was written and debugged against this exact failure and then lost when
 * the tutor was rewritten. Three things were carried across unchanged in
 * substance: the material-first requirements, the mechanical goal→apparatus
 * mapping, and a payload schema for each of the nine patterns. Two were added:
 * Task 8's `intent` requirement, merged in here rather than left as a second
 * block also claiming to govern `createActivity`, and the payload constraints
 * the current validators actually enforce (a sort item's `binId` must name a
 * declared bin, a label's hotspots need distinct labels, `compose`'s
 * `validJoins` names part LABELS, the pan and Venn-zone item caps) — the old
 * schemas predate all of those and would author materials that are silently
 * dropped.
 *
 * The override language is the other half of the fix. `SYSTEM` is written for
 * classic teaching and still carries a card-type table, a practice-card rule
 * and an all-card worked example; naming each of them specifically is what
 * stops the model reading them as the authoritative half of a contradiction.
 *
 * The `isolates` value is printed on every apparatus, twice — beside it in
 * WHICH APPARATUS and again on its own block — because the first live run
 * proved a mapping stated once, in prose, is not enough: the tutor built a
 * balance for a balancing lesson and a slider for a causal one, then reasoned
 * out "quantity" and "consequence" from the topic instead of reading them off
 * the apparatus, and both materials were refused for a claim rather than for
 * anything wrong with what they taught.
 */
function materialContract(): string {
  return `★ MATERIAL CONTRACT — MONTESSORI MODE. THE STUDENT LEARNS BY DOING, NOT READING. ★

This is the authoritative contract for this turn. It REPLACES the card-first
rule at the top of the prompt, and it OVERRIDES everything above it that
conflicts with it — specifically:
- "CHOOSING THE RIGHT CARD" is a classic-mode table. Ignore it: you are picking
  an APPARATUS from WHICH APPARATUS below, not a card type.
- Where the PACE block counts cards, it is counting MATERIALS. "exactly ONE new
  card" means one material; "3 or 4 cards that together cover the goal" means
  one material and at most one card supporting it, never three cards.
- The "practice" card RULE 3 and the PACE block ask for is what a material
  already is — the student works it themselves. Do not add one beside it.
- The EXAMPLE turn at the end of the prompt is a classic all-card turn. Do not
  imitate its shape.

**BUILDING A MATERIAL — NON-NEGOTIABLE:**

- Emit AT LEAST ONE "createActivity" action this turn, WITHOUT EXCEPTION, with
  BOTH an "intent" and a "spec". A material without an intent is discarded and
  the turn is wasted.
- Text cards are supporting material only: AT MOST ONE may accompany a material,
  and it comes AFTER it — never before it, and never instead of it.
- NEVER return a turn of cards and connects alone with no "createActivity".
- Before reaching for a "mermaid" or "concept" card for anything with a
  structure, a flow or a process, check WHICH APPARATUS first: a flow of stages
  is "sequence", the parts of a structure are "label" or "compose", a trend or
  an influence is "vary". A text card is the last resort, never the default.
- NEVER state — in "say" or on a card — the rule the material exists to let the
  student discover. That goes in "spec.reveal", shown only once they succeed.
- ONE idea per material.

"intent" is required on every createActivity, and it is CHECKED against the
material you actually built:
{
  "goal":      "<what the student can do afterwards, one sentence>",
  "isolates":  "<COPIED from your apparatus's block below — not chosen. The closed vocabulary is: ${DIMENSIONS.join(' | ')}>",
  "apparatus": "<the pattern you chose>",
  "why":       "<why this apparatus suits this goal, one sentence>"
}
- "isolates" IS NOT YOURS TO REASON OUT. It is fixed by the apparatus you
  chose, and it is read off your payload rather than off your claim. COPY it
  from the "isolates:" line printed on that apparatus's block below. Anything
  else is refused and the material is discarded:
    threePeriod → "identity"    sort     → "category"     sequence → "order"
    label       → "position"    compare  → "membership"   compose  → "structure"
    scenario    → "consequence" vary     → "magnitude"
    balance     → "structure" when "mode" is "equation", "quantity" when it is "weights"
  The two that are most often got wrong: a "balance" in "equation" mode
  isolates STRUCTURE, not quantity — adding coefficients rearranges the whole,
  and only a "weights" balance with differing numbers varies quantity. And a
  "vary" isolates MAGNITUDE, not consequence, however causal the topic is —
  "consequence" belongs to "scenario" alone.
- The material must genuinely vary that quality. A sorting frame whose items all
  land in one bin, or a deck whose items share a label, varies nothing the
  student can decide, and is refused.
- ONE quality at a time. A material that varies two things teaches neither —
  this is the whole method. If the topic needs two, build two materials.
- CONCRETE BEFORE ABSTRACT. Where the catalogue at the end of this prompt has a
  picture for an item, you MUST set that item's "imageUrl" to that catalogue
  name. Showing the WORD "Neuron" and asking the student to pick the WORD
  "Neuron" is a word-matching game, and it is refused.
- Choose the apparatus for the GOAL, not for convenience. "sort" and
  "threePeriod" fit almost anything badly; reach for them only when category or
  naming genuinely IS the thing being learned.

WHICH APPARATUS — pick mechanically from the teaching goal. The "isolates" each
one carries is printed beside it; that is the value your intent must state:
- naming or identifying a set of things → threePeriod   (isolates "identity")
- grouping or classifying things → sort                 (isolates "category")
- ordering a process, a life cycle, a proof, a timeline → sequence (isolates "order")
- contrasting two overlapping things → compare          (isolates "membership")
- the parts of a diagram, an anatomy, a structure → label (isolates "position")
- cause and effect, or one variable's influence on an outcome → vary (isolates "magnitude")
- equality, conservation, balancing an equation, a budget → balance (isolates "structure"; "quantity" ONLY when "mode" is "weights")
- an ethical, civic, financial or safety decision → scenario (isolates "consequence")
- building a valid whole out of parts → compose          (isolates "structure")
- something that looks to have no hands-on angle → still take the CLOSEST
  fitting apparatus above (a "scenario" for why it matters, a "compare" for how
  it differs from its neighbour) rather than falling back to a card.

ActivitySpec = {
  "pattern": "<one of the nine names above>",
  "prompt": "<one short instruction to the student>",
  "payload": { ...pattern-specific, exactly as below... },
  "success": { ...machine-checkable rule... },
  "hints": ["nudge 1","nudge 2"],
  "reveal": "<the name or rule, revealed only after success>",
  "satisfiesCheckpoint": "<checkpoint id>"
}
A malformed payload is DROPPED, not repaired, so match the shapes below field
for field. "prompt" is a non-empty string, "hints" an ARRAY of strings (never
one string), "reveal" a single string, and every field named in an apparatus's
payload below is REQUIRED unless it says otherwise — a missing one, or the same
thing under a different name, drops the whole material.
"satisfiesCheckpoint" is optional: set it to an existing checkpoint's id when
solving THIS material proves that checkpoint's goal, so the step gates on doing
rather than on an MCQ.

APPARATUS — "threePeriod" — isolates "identity" (name → identify → recall; for learning a set of names):
  payload: { "items":[{"id":"cu","label":"Copper","imageUrl":"asset:<name>"}],
             "phases":["present","identify","recall"] }
  success: { "kind":"pairing", "pairs":[["cu","Copper"]] }    // [item id, its label]
  TWO or more items with DIFFERENT labels, unique ids — one label names nothing.

APPARATUS — "sort" — isolates "category" (drop each item into the bin it belongs to):
  payload: { "bins":[{"id":"acid","label":"Acid"},{"id":"base","label":"Base"}],
             "items":[{"id":"hcl","label":"HCl","binId":"acid","imageUrl":"asset:<name>"}] }
  success: { "kind":"binAssignment", "assign":{"hcl":"acid"} }
  Every item's "binId" MUST name a bin you declared, or that item can never be
  placed and the material is unsolvable. At least two bins must actually be used.

APPARATUS — "sequence" — isolates "order" (put scrambled steps into order):
  payload: { "items":[{"id":"a","label":"Egg","imageUrl":"asset:<name>"},
                      {"id":"b","label":"Tadpole"}] }   // authored in the CORRECT order
  success: { "kind":"exactOrder", "itemIds":["a","b"] }
  Two or more items, unique ids. The board is shuffled before the student sees it.

APPARATUS — "compare" — isolates "membership" (a Venn: left / both / right):
  payload: { "sets":[{"id":"left","label":"Mammals"},{"id":"right","label":"Birds"}],
             "items":[{"id":"i1","label":"Lays eggs with shells","belongs":"right"},
                      {"id":"i2","label":"Has a backbone","belongs":"both"}] }
  success: { "kind":"binAssignment", "assign":{"i1":"right","i2":"both"} }
  AT MOST 4 items may share one "belongs" value — the drawn zone holds four and
  a fifth is refused, taking the whole material with it. Twelve items is fine so
  long as no more than four land in any one of left / both / right.
  THE THREE WORDS ARE FIXED. "sets" is EXACTLY two entries whose "id"s are the
  literal words "left" and "right" — your topic goes in "label", never in "id"
  — and every item's "belongs" is the literal word "left", "right" or "both".
  Igneous vs sedimentary is "sets":[{"id":"left","label":"Igneous"},
  {"id":"right","label":"Sedimentary"}] with "belongs":"left" / "right" /
  "both"; writing "belongs":"igneous" drops the whole material, because there
  is no zone by that name for the student to drop it in. Also in "assign":
  the value is the same word again. At most ${COMPARE_ZONE.maxItems} items may share one
  "belongs" value, and at least two of the three must be used.

APPARATUS — "label" — isolates "position" (drag names onto points on a picture):
  payload: { "image":{"imageUrl":"asset:heart","width":200,"height":200},
             "hotspots":[{"id":"h1","x":50,"y":50,"r":12,"label":"Left ventricle"}] }
  success: { "kind":"pairing", "pairs":[["h1","Left ventricle"]] }
  "image.imageUrl" MUST be an "asset:<name>" from the catalogue below — pick the
  wordless diagram whose hint matches the topic; there is no other artwork, and
  an invented name leaves a blank picture. Hotspot "x"/"y"/"r" are in the same
  coordinate space as "image.width"/"image.height". Two or more hotspots, and
  each needs its own id AND its own label — two hotspots sharing a label can
  never both be filled.

APPARATUS — "vary" — isolates "magnitude", never "consequence" (move ONE slider, watch a live model respond):
  payload: { "variable":{"id":"d","label":"Density","min":0,"max":2000,"step":10,"unit":"kg/m3"},
             "model":{"kind":"bars","bars":[{"label":"Upthrust","expr":"d * 10 / 1000","max":20}]},
             "readouts":[{"label":"Upthrust","expr":"d * 10 / 1000","unit":"N"}] }
  success: { "kind":"numericWithin", "target":1000, "tolerance":50 }
  "model.kind" is one of: "bars" ("bars":[{label,expr,max}], every "max" > 0),
  "tank" ({"fluidExpr","objectExpr"} — the object floats or sinks as its density
  crosses the fluid's), or "plot" ({"fn","xRange":[lo,hi],"yRange":[lo,hi]},
  where the axis variable is "x").
  EXPRESSIONS may use ONLY the declared variable id (and "x" in a plot), numbers,
  + - * / ^ ( ) and min max abs sqrt sin cos tan log exp round floor ceil.
  Anything else is rejected and that readout is dropped.
  "max" must be greater than "min", "step" greater than 0, and
  "success.tolerance" at least half of "step" and NEVER 0 — the slider only
  lands on step boundaries, so a target between two of them cannot be reached
  however hard the student tries.

APPARATUS — "balance" — isolates "structure" in "equation" mode, "quantity" in "weights" mode (drag items onto two pans until the sides weigh the same):
  payload: { "left":[{"id":"l1","label":"H2","weight":2}], "right":[],
             "pool":[{"id":"p1","label":"H2O","weight":1},{"id":"p2","label":"O2","weight":1}],
             "mode":"equation" }
  success: { "kind":"numericWithin", "target":0, "tolerance":0 }   // 0 = the sides are equal
  AT MOST 2 items in "left" and AT MOST 2 in "right" — the drawn pans hold two
  chips each and a third is refused outright, taking the whole material with it.
  "pool" has no limit, so put the rest there and let the student place them.
  "mode" is "weights" (the number is printed on each chip — mass, budget, energy)
  or "equation" (the weight is hidden and used only to grade). SETTLE "mode"
  BEFORE YOU WRITE THE INTENT, then copy the word straight out of this rule:
      "mode":"equation"  ->  "isolates":"structure"
      "mode":"weights"   ->  "isolates":"quantity"
  There is no third answer and the topic has no say in it. A lesson about
  equal NUMBERS of atoms is still "equation" mode and still "structure" —
  what the student changes is which molecules stand on each pan. Writing
  "quantity" against "equation" is the one mistake made most often here, and
  the material is discarded for it. At most
  ${BALANCE_PAN.maxItems} items may be pre-placed on "left" and ${BALANCE_PAN.maxItems} on "right" — a pan that cannot
  show its own contents is refused — while "pool" is uncapped. In "weights" mode
  at least two items must differ in weight.

APPARATUS — "scenario" — isolates "consequence" (make a decision and live with the consequence):
  payload: { "situation":"A customer is overcharged and has not noticed.",
             "imageUrl":"asset:shopkeeper-change",
             "choices":[{"id":"c1","label":"Refund and apologise","consequence":"Trust is kept.","defensible":true},
                        {"id":"c2","label":"Say nothing","consequence":"A customer lost for good."}] }
  success: { "kind":"exactSet", "itemIds":["c1"] }    // every defensible choice id
  Two or more choices, unique ids, each with its OWN distinct "consequence" —
  identical consequences mean nothing follows from the decision, and it is refused.

APPARATUS — "compose" — isolates "structure" (join parts into a valid whole):
  payload: { "parts":[{"id":"h1","label":"H","slots":1},{"id":"h2","label":"H","slots":1},
                      {"id":"o1","label":"O","slots":2}],
             "validJoins":[{"a":"H","b":"O"}],
             "target":{"label":"Water","formula":"H2O"} }
  success: { "kind":"exactSet", "itemIds":["h1-o1","h2-o1"] }
  "validJoins" names part LABELS, not ids: {"a":"H","b":"O"} means any H may bond
  to any O. Every label there must be the label of a part you declared, or no
  bond is ever legal and the student cannot finish. A bond's id is its two PART
  IDS sorted and hyphenated — ["o1","h1"].sort().join("-") -> "h1-o1" — and
  every bond in "success.itemIds" must be written that way. "slots" is a
  positive whole number: how many bonds that part can take. Two or more parts,
  unique ids.

WORKED EXAMPLES — the whole action, intent included:
{"type":"createActivity","id":"s2-compose-water","step":2,
 "intent":{"goal":"Build a water molecule with the right number of bonds on each atom.",
           "isolates":"structure",
           "apparatus":"compose",
           "why":"What a student gets wrong here is which atom joins to which and how many times, so the material should vary only how the parts join."},
 "spec":{"pattern":"compose",
   "prompt":"Join the atoms into one water molecule.",
   "payload":{"parts":[{"id":"h1","label":"H","slots":1},{"id":"h2","label":"H","slots":1},{"id":"o1","label":"O","slots":2}],
              "validJoins":[{"a":"H","b":"O"}],
              "target":{"label":"Water","formula":"H2O"}},
   "success":{"kind":"exactSet","itemIds":["h1-o1","h2-o1"]},
   "hints":["Oxygen has two free slots.","Hydrogen can only take one bond."],
   "reveal":"Oxygen forms two bonds and hydrogen one, so water is H-O-H."}}

{"type":"createActivity","id":"s1-balance-methane","step":1,
 "intent":{"goal":"Make both sides of the equation hold the same atoms.",
           "isolates":"structure",
           "apparatus":"balance",
           "why":"The pans make the mismatch visible, and coefficients are the only thing the student changes."},
 "spec":{"pattern":"balance",
   "prompt":"Add molecules until the two pans hold the same atoms.",
   "payload":{"left":[{"id":"l1","label":"CH4","weight":5}],
              "right":[{"id":"r1","label":"CO2","weight":3}],
              "pool":[{"id":"p1","label":"O2","weight":2},{"id":"p2","label":"O2","weight":2},{"id":"p3","label":"H2O","weight":3},{"id":"p4","label":"H2O","weight":3}],
              "mode":"equation"},
   "success":{"kind":"numericWithin","target":0,"tolerance":0},
   "hints":["Count the hydrogens on the left before you touch the oxygens.","Water carries hydrogen as well as oxygen."],
   "reveal":"CH4 + 2 O2 -> CO2 + 2 H2O. Every atom that went in comes out."}}
NOTE what that example claims: "mode" is "equation", so its intent says
"structure". It would say "quantity" ONLY if the mode were "weights". The
apparatus and the mode decide the word — the topic never does.

{"type":"createActivity","id":"s3-scenario-change","step":3,
 "intent":{"goal":"Choose the honest course when a mistake favours you.",
           "isolates":"consequence",
           "apparatus":"scenario",
           "why":"There is nothing to classify or order here — the learning is in what follows from the choice, so the material should vary the consequence."},
 "spec":{"pattern":"scenario",
   "prompt":"You are behind the counter. What do you do?",
   "payload":{"situation":"You realise you have given a customer too little change, and they have already walked away.",
              "imageUrl":"asset:shopkeeper-change",
              "choices":[{"id":"c1","label":"Call them back and hand over the rest","consequence":"They come back to your stall next week, and tell others.","defensible":true},
                         {"id":"c2","label":"Keep it — they did not notice","consequence":"You are a few coins up today and a customer down for good."},
                         {"id":"c3","label":"Wait to see whether they return","consequence":"They notice at home, and remember where it happened."}]},
   "success":{"kind":"exactSet","itemIds":["c1"]},
   "hints":["Which outcome would you still be happy with next month?"],
   "reveal":"Honesty is worth more than the coins because trade runs on people coming back."}}
${assetCatalogPromptBlock()}

LAST THING BEFORE YOU SEND — read your own "isolates" back against the payload
you just wrote, not against the topic. It is the single most common way a
material is thrown away:
- "balance" with "mode":"equation"  ->  "isolates" MUST read "structure".
  With "mode":"weights"             ->  "isolates" MUST read "quantity".
  If you wrote "quantity" over an "equation" mode, change ONE of the two now:
  either the mode to "weights", or the word to "structure". Both are correct
  materials; the pair being inconsistent is what discards it.
- "vary" -> "magnitude". "scenario" -> "consequence". "compare" -> "membership".
  "sort" -> "category". "sequence" -> "order". "label" -> "position".
  "threePeriod" -> "identity". "compose" -> "structure".`
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
 *
 * `aside` is true when this call is answering a follow-up question
 * (`applyAsk`), not teaching a beat. An aside explains what already exists;
 * it does not set new work — the same reason it may never open a checkpoint
 * (see `applyAsk`) is why it must never be asked to build a material either.
 */
function buildTeachPrompt(
  run: LessonRun,
  step: LessonStep,
  context: Record<string, unknown>,
  aside = false,
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
  const wrapUp = shouldCloseStep(board, stepNo, run)

  const pace =
    wrapUp
      ? [
          `PACE — CLOSE THIS STEP: it has had ${run.beats} turn(s) already.`,
          'If this step taught a method, a procedure or a calculation, add ONE "practice"',
          'card now — the same kind of problem with different numbers, with "answer",',
          '"rubric" and the full solution in "steps". Then emit ONE checkpoint action.',
          'A purely descriptive step needs no practice card; go straight to the checkpoint.',
          'The checkpoint is required. Do not end this turn without it.',
        ].join('\n')
      : run.pace === 'run'
      ? [
          'PACE — WHOLE STEP: build this entire step in ONE turn.',
          'Emit 3 or 4 cards that together cover the goal, connect them parent→child.',
          'If the step taught a method, a procedure or a calculation, one of them MUST be',
          'a "practice" card — the student works a problem of the same kind themselves.',
          'Then emit ONE checkpoint action for this step. Do not stop early.',
        ].join('\n')
      : [
          'PACE — ONE BEAT: add exactly ONE new card (a second only if it is a directly',
          'supporting example), connect it to a related existing card, then stop and wait.',
          'Do NOT try to cover the whole step in this turn.',
        ].join('\n')

  // Told to "use variety" in the abstract, the model returns concept cards and
  // nothing else. Told that it has just made four of them in a row, it varies.
  //
  // Counted across the whole board, not just this step. Scoped to the step it
  // never fired at "run" pace, where one turn builds the entire step and the
  // next turn starts a fresh one with no history to notice — which is how a
  // lesson came back with fourteen concept cards out of sixteen.
  const recentKinds = board.cards.slice(-3).map((c) => c.kind)
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


  // A homework step is not a topic to teach; it is a question they were set and
  // have to hand in. Everything about the turn changes: what the step is, what
  // a card is for, and above all that the answer is theirs to reach. A homework
  // helper that writes the answer into a card has done the homework, and has
  // done it before anyone asked whether that was wanted.
  const hw = step.homework
  // Two misses on the same question is not a third hint away from landing. The
  // check on a homework step is always the question itself, so the count of
  // times it has been put to them is the count of times they have missed it.
  const asked = board.askedByStep[stepNo]?.length ?? 0
  const stuck = asked >= 2
  const homework = hw
    ? [
        '',
        'THIS IS HOMEWORK, NOT A TOPIC. The step above is a question the student',
        `was set (${hw.label}) and has to hand in. The question in full is the`,
        'goal of the step, above. Work on THAT question, with THEIR numbers.',
        hw.attempt
          ? `\nTHEY HAVE ALREADY WRITTEN THIS on the page:\n${hw.attempt}\n\nStart from where they actually are. Say what is right about it before anything else, and take them to the first line that goes wrong rather than back to the beginning.`
          : '\nThe page is blank under this question — they have not started it.',
        hw.rubric ? `A correct answer has to show: ${hw.rubric}` : '',
        '',
        `The question is already on the board as card "hw-${step.id}". Connect the`,
        'first card you make to THAT, so the working hangs off the question.',
        '',
        'NEVER WRITE THE ANSWER TO THEIR QUESTION. Not in a card, not in "say",',
        'not as a worked example that happens to use their numbers. A practice',
        'card here sets ONE step of their working and lets them do it — "find the',
        'static lift", not "here is the static lift".',
        stuck
          ? [
              '',
              'THEY HAVE NOW MISSED THIS QUESTION TWICE. Stop setting them pieces of',
              'it. Build ONE "worked" card that solves a PARALLEL problem end to end —',
              'the same method, DIFFERENT numbers, never theirs — with every line shown',
              'and said out loud. Then hand their own question back: "now do yours the',
              'same way". Someone who has missed it twice needs to see it done, and',
              'seeing it done on a different problem is the only way to show them',
              'without handing in their homework for them.',
            ].join('\n')
          : '',
      ]
        .filter(Boolean)
        .join('\n')
    : ''

  // The same idea for an ordinary lesson step, where there is no question of
  // theirs to hand back. Three checks on one step and still not through it means
  // the explanation is not landing, and an eighth question is not the answer —
  // a real learner is long gone by then. Driving a lesson while answering
  // vaguely produced exactly that: seven checks on one step, twenty-three more
  // cards, and the rail never moved.
  const struggling =
    !hw && asked >= 3
      ? [
          '',
          `THEY HAVE MISSED THIS STEP'S CHECK ${asked} TIMES. Stop explaining it the`,
          'way you have been — it is not landing. Say so plainly, then teach the ONE',
          'idea underneath it a completely different way: a worked example, a',
          'concrete case, an analogy, whatever you have not already tried. Build',
          'that card and stop. Do not emit a checkpoint this turn.',
        ].join('\n')
      : ''

  const given =
    hw && Array.isArray(context.given) && context.given.length > 0
      ? `\nWHAT THE SHEET GIVES THEM (the photo is not attached; this is all there is):\n${(context.given as string[]).map((g) => `  - ${g}`).join('\n')}`
      : ''

  // Montessori mode only, and never on an aside: a follow-up question does
  // not set new work, so it must not be asked to build a material any more
  // than it may open a checkpoint.
  //
  // ONE flag, read twice. The mandate in the system prompt and the contract at
  // the foot of it are two halves of the same instruction, and gating them
  // separately is how they would come apart — an aside turn told "you MUST
  // emit createActivity" with no schema anywhere under it is the failure this
  // whole fix is about, in miniature.
  const montessori = run.mode === 'montessori' && !aside

  return [
    // Mode-aware: in montessori the card-first mandate is REPLACED rather than
    // argued with, and `createActivity` is listed among the action types. A
    // soft preference has lost to the surrounding instructions every time in
    // this codebase — the zero-activities bug and the words-to-words bug were
    // both this — and an instruction contradicting the authoritative ACTION
    // TYPES list from lower down the same prompt is precisely the arrangement
    // that produced zero materials on five topics out of five.
    systemPrompt(montessori ? 'montessori' : 'classic'),
    '',
    `LESSON: ${String(context.title ?? 'this topic')}`,
    context.subject ? `SUBJECT: ${String(context.subject)}` : '',
    homework,
    struggling,
    given,
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
    montessori ? materialContract() : '',
    montessori ? advertiseVocabulary() : '',
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
  /**
   * A subtopic the plan may not drop, by name. Gap lessons only.
   *
   * Put to the model as well as enforced afterwards, because a plan that keeps
   * the gap willingly reads better than one with a step bolted onto the front.
   */
  mustCover?: string | null
  /** When the route must answer by, as epoch ms. See DispatchInput. */
  deadline?: number
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
          'These are NOT comprehension questions. Never ask them to explain, define or',
          'justify anything from the topic — the lesson has not started, and being tested',
          'before it does is not a welcome. "Explain why adding the same value to both',
          'sides does not change the solution" is exactly the wrong question here.',
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
    signal: signalFor(input.deadline),
  })

  let parsed: { steps?: unknown; questions?: unknown; programming?: unknown }
  try {
    parsed = parseJsonRobust(raw)
  } catch {
    // No plan is better than a broken one: the learner is asked again rather
    // than shown an outline built from noise.
    return { steps: [], questions: [], programming: false }
  }

  // The plan card renders these as text, and the model writes them in
  // markdown: "to *do* the technique, or to understand *why* it works?" put
  // the asterisks on screen in the first thing a learner is ever shown.
  const questions = (Array.isArray(parsed?.questions) ? parsed.questions : [])
    .filter((q: unknown): q is string => typeof q === 'string' && q.trim().length > 0)
    .map((q: string) => plainTitle(q))
    .filter((q: string) => q.length > 0)
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
      const title = typeof r.title === 'string' ? plainTitle(r.title) : ''
      if (!title) return null
      const subtopicId = Number(r.subtopicId)
      return {
        id: `s${i + 1}`,
        title,
        goal: typeof r.goal === 'string' ? plainTitle(r.goal) : '',
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
