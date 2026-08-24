# Steerable LearnSpace lessons

**Date:** 2026-08-24
**Status:** Approved for planning

## The problem

A LearnSpace lesson starts itself and runs on rails. `Workspace.tsx` fires
`runTutor('', [])` the moment a space loads with no history, and the tutor's
first turn drafts a 4–6 step plan *and* builds the first cards in one response.
The learner is never asked what they want.

From there the plan is fixed. Rule 7 of the tutor prompt reads "steps are
sequential — never skip or jump", and hard checkpoints gate each transition. A
learner who already knows step 2 has no way past it. A learner who wants to
skim has to click through every beat, because the tutor pauses after each one.

Two complaints, one cause: the lesson is something that happens *to* the
learner rather than something they steer.

## What exists today

Worth stating, because most of the scaffolding is already here and this design
reuses it rather than replacing it.

- **A plan.** `PlanStep[]` (`{ title, goal }`) drafted on turn one, stored
  inside `canvas_state` jsonb, rendered as a roadmap by `StudyLabSidebar`.
- **Steps and beats.** A `step` integer on each card; a step spans several
  "beats", each adding 1–2 cards.
- **`awaitUser`.** The tutor already signals when it is waiting.
- **Suggestion chips.** `suggestions: string[]` rendered under the tutor's
  message.
- **Checkpoints.** `CheckpointQuestion` in four formats (mcq, short, code,
  match), rendered as quiz nodes, with `hard` and `soft` gates.
- **`groupStep`.** Collapses a finished step's cards into one node.
- **A grading route.** `app/api/studylab/grade/route.ts`.
- **`current_step`** as a column on `learnspaces`; **`mode`** column exists.

What is missing is a setup exchange, a way to skip, and learner-controlled
pacing. Nothing above needs to be thrown away.

## Decisions

Four product decisions were settled before this design, and one technical one.

1. **Skipping is earned, except where it isn't offered.** A learner may test
   out of a step by answering 2–3 questions on it. Steps covering a subtopic
   the learner has a *measured* gap on are locked and must be taught.
2. **Plan first, then negotiate.** The tutor's opening turn proposes a plan and
   asks at most two targeted questions. No cards are built until the learner
   accepts or edits.
3. **The learner sets the pace.** `step` pauses after every beat; `run` builds a
   whole step and pauses at the checkpoint. Changeable at any time.
4. **Controls split by altitude.** Plan-level actions (skip, test out, add,
   reorder) live in the sidebar rail. Moment-level actions (continue, more on
   this, stop) stay as chat chips.
5. **Control flow moves into code.** The server owns phase, step status and
   pace. The model is called for one narrow job at a time and never decides
   what happens next.

Decision 5 is the architectural one. The failures already patched into the
353-line tutor prompt — rule 3a stopping repeated checkpoints, rule 7 forbidding
skips, rule 13 governing completion — are all control-flow failures. They exist
because a language model is being asked to run a state machine. This feature is
almost entirely state machine, so the state machine becomes code.

## Architecture

### The lesson run

A new module, `lib/studylab/lessonRun.ts`, owns the shape and every transition
as a pure function. No I/O, no model calls, no React.

```ts
export type LessonPhase = 'planning' | 'teaching' | 'done'
export type StepStatus = 'pending' | 'teaching' | 'known' | 'done'
export type Pace = 'step' | 'run'

export interface LessonStep {
  id: string
  title: string
  goal: string
  status: StepStatus
  /** Curriculum subtopic this step covers, where one applies. */
  subtopicId?: number
  /** Present when a measured gap makes this step non-skippable. */
  lockedBy?: { subtopicId: number; accuracy: number }
  /** Cards built for this step, so a skipped step can be collapsed. */
  cardIds: string[]
  /** The checkpoint or test-out check currently attached. */
  checkpointId?: string
}

export interface LessonRun {
  phase: LessonPhase
  pace: Pace
  steps: LessonStep[]
  /** Index into `steps`. -1 while planning. */
  currentStep: number
  /** Beats spent on the current step, for pacing decisions. */
  beats: number
  /** True when the run is stopped and waiting on the learner. */
  awaiting: boolean
  /**
   * A check the learner has open. Names its own step rather than moving
   * `currentStep`, because testing out of a *later* step must not disturb
   * where teaching is. A `hard` checkpoint blocks advancing; a test-out does
   * not block anything, it just resolves one step.
   */
  openCheck?: {
    stepId: string
    checkpointId: string
    kind: 'checkpoint' | 'testout'
    gate: 'hard' | 'soft'
  }
}
```

`checking` is deliberately not a phase. Making it one forced a single
`currentStep` to mean two different things — where teaching is, and what is
being answered — which broke the moment a learner tested out of a step ahead of
the one they were on.

### Transitions

Every transition takes a run and returns either a new run or a refusal. A
refusal is a value, not an exception — the UI renders it as a reason.

```ts
export type Transition<T = void> =
  | { ok: true; run: LessonRun }
  | { ok: false; reason: string }
```

| Transition | From | To | Refuses when |
|---|---|---|---|
| `proposePlan(steps)` | any | `planning` | — |
| `editPlan(ops)` | `planning` | `planning` | an op would remove a locked step |
| `acceptPlan()` | `planning` | `teaching` @ first non-known step | plan has no steps |
| `nextBeat()` | `teaching` | `teaching`, `beats + 1` | a **hard** check is open |
| `beginCheck(stepId, kind, gate)` | `teaching` | sets `openCheck` | a check is already open |
| `passCheck()` | `openCheck` set | resolves that step | no check is open |
| `failCheck(missed)` | `openCheck` set | that step `teaching` | no check is open |
| `requestTestOut(stepId)` | `teaching` | `openCheck` on that step, `kind: 'testout'` | **step is locked**, or a check is open |
| `skipStep(stepId)` | any | that step `known` | **step is locked** |
| `jumpTo(stepId)` | `teaching` | `teaching` on that step | an earlier step is locked and unfinished |
| `setPace(pace)` | any | same phase | — |
| `stop()` | any | `awaiting: true` | — |
| `finish()` | `teaching` | `done` | any step is neither `done` nor `known` |

`passCheck()` resolves differently by kind, which is the whole reason the kind
is recorded. A **checkpoint** marks its step `done` and advances `currentStep`
to the next unfinished step. A **test-out** marks its step `known` and leaves
`currentStep` exactly where it was.

The two bolded refusals are the design's core guarantee. Skipping a locked step
is not discouraged in a prompt — it is a branch that returns
`{ ok: false, reason: 'Covalent bonding — measured at 38%. This one gets
taught.' }` and cannot be talked around.

### Invariants

Enforced by the module and asserted in tests:

- While phase is `teaching`, exactly one step has status `teaching`, and
  `currentStep` indexes it.
- While phase is `planning`, `currentStep` is -1 and no step is `teaching`.
- At most one `openCheck` exists at a time.
- `openCheck.stepId` always names a step that exists in `steps`.
- A locked step never reaches `known` — it can only reach `done`, and only by
  being taught and passing its checkpoint.
- `finish()` is impossible while any step is `pending` or `teaching`.

## Locking steps from measured gaps

When a plan is drafted, each step is resolved to a curriculum `subtopicId`
where one applies — the drafting job is given the subtopic list for the
LearnSpace's `textbook_id`/`topic_id` and asked to attribute each step.

The server then queries `topic_mastery` for the learner and those subtopics.
Any step whose subtopic sits below 50% accuracy (the same threshold
`lib/admin/gap-metrics.ts` and the learner's own gap map use) gets `lockedBy`
set. Locked steps show the reason in the rail and are offered no test-out
control.

Steps with no `subtopicId`, and subtopics with no mastery row, are unlocked.
Absence of evidence is not evidence of a gap.

This is the first time gap data does anything other than describe. It decides
what the learner is allowed to skip.

## Test-out

Reuses the checkpoint path end to end, with no new question format and no new
grading code.

1. Learner clicks **I know this** on an unlocked `pending` step.
2. `requestTestOut(stepId)` → `openCheck` on that step. Teaching stays where
   it is; a learner can test out of step 4 while step 2 is still the one being
   taught.
3. The `check` job writes 2–3 questions against that step's `goal`.
4. Questions render as the existing quiz nodes.
5. The `grade` job marks the answers.
6. **Pass** → `passCheck()`; step becomes `known` and collapses to a one-line
   summary node. **Fail** → `failCheck(missed)`; step becomes `teaching`, and
   the `teach_beat` job is told which questions were missed so it teaches the
   weak part rather than the whole step.

A failed test-out is therefore *better* than not attempting one: the lesson
narrows to what the learner actually got wrong.

## Model routing

One table, keyed by job name:

```ts
export type LessonJob = 'plan' | 'teach_beat' | 'check' | 'grade'

export const JOB_MODELS: Record<LessonJob, string> = {
  plan: 'google.gemma-3-27b-it',
  teach_beat: 'google.gemma-3-27b-it',
  check: 'amazon.nova-lite-v1:0',
  grade: 'amazon.nova-lite-v1:0',
}
```

The line is whether the job needs judgement about the subject or is a bounded
transform. Planning gets Gemma despite its short output: ordering a syllabus
correctly requires knowing the subject's dependency structure, the output is
~400 tokens so the latency penalty is small, and at 1–2 calls per lesson the
cost difference is roughly $0.0003.

Each job passes its name as `feature` to `withUsageTracking`, so the admin
model panel attributes spend per job with no further work. Because model choice
hangs off the job name rather than a route-level default, no job can silently
inherit a model set during an incident — the failure three call sites are still
living with from 22 June.

Environment overrides follow the existing convention: `AWS_LESSON_PLAN_MODEL_ID`,
`AWS_LESSON_TEACH_MODEL_ID`, `AWS_LESSON_CHECK_MODEL_ID`,
`AWS_LESSON_GRADE_MODEL_ID`, each falling back to the table above.

## Persistence

`plan` moves out of `canvas_state` into a new `lesson_run` jsonb column on
`learnspaces`. It is lesson structure, not canvas content, and it now carries
status the whiteboard has no business owning.

```sql
ALTER TABLE learnspaces ADD COLUMN lesson_run jsonb;
```

**Migration.** Existing lessons back-fill on read, not in a batch job — a
LearnSpace with no `lesson_run` derives one from `canvas_state.plan` and
`current_step`:

- Steps before `current_step` → `done`
- Step at `current_step` → `teaching`
- Steps after → `pending`
- `pace` → `step` (today's behaviour)
- `phase` → `teaching`, or `done` if the space's `status` says so
- No `lockedBy` — old plans have no `subtopicId`, so nothing locks

Back-filling on read means no downtime, no batch script, and a lesson that is
never opened again costs nothing. The derived run is written back on the next
save.

`canvas_state.plan` is left in place and ignored. Removing it is a separate
cleanup once every active lesson has been opened.

## Route surface

`app/api/studylab/tutor/route.ts` stops being one endpoint that does everything.
The lesson run is advanced by an action, and the route dispatches to the job the
new state requires:

```
POST /api/studylab/tutor
  { learnspaceId, action: { type: 'accept_plan' | 'next_beat' | 'test_out'
                          | 'skip' | 'jump' | 'set_pace' | 'stop'
                          | 'answer_check' | 'ask', ... } }
  → { run: LessonRun, actions: TutorAction[], say: string,
      suggestions: string[], refusal?: string }
```

The route:

1. Loads the run (back-filling if absent).
2. Applies the transition. A refusal returns immediately with `refusal` set and
   the run unchanged — no model call, no spend.
3. Calls the one job the new state requires — `plan` while planning,
   `teach_beat` after a beat, `check` when a check opens, `grade` on an
   answer — on that job's model.
4. Persists the run and returns.

A refusal costing no model call matters: a learner hammering **skip** on a
locked step should cost nothing.

## UI

**Sidebar rail** (`StudyLabSidebar`) becomes the plan surface:

- Per-step status: `pending` / `teaching` (current) / `known` / `done`
- **I know this** on unlocked `pending` steps
- Lock badge with the reason on locked steps ("measured 38%")
- **+ Add a step** and drag-to-reorder while phase is `planning`
- The whole rail is read-only once phase is `teaching`, except test-out and
  jump — editing a plan mid-lesson is a re-plan, not an edit

**Planning phase** renders the proposed plan in the rail with **Looks good,
start** / **Edit plan**, the tutor's two questions in chat, and an empty canvas.
Nothing is built until the learner acts.

**Chat chips** stay where they are: Continue, More on this, Stop, and — when the
current step's goal is met — Next step.

**Pace control** is a two-state toggle in the rail header. Changing it takes
effect on the next beat.

**Refusals** render as a line in chat in the tutor's voice, not an error toast.

## Error handling

- **A job returns unparseable output.** The run is not advanced; the learner
  sees "That didn't come through — try again" with a retry chip. State never
  advances on a failed parse, so a retry is safe.
- **A model is unavailable in the region.** `callGemma`'s existing prefix
  expansion and fallback apply unchanged. If every candidate fails, the run is
  not advanced and the failure is recorded in `ai_usage_events` with its
  `errorCode`.
- **A refusal.** Returned as a value with a reason; no model call, no state
  change.
- **A stale run.** Writes are last-write-wins on `lesson_run`, matching how
  `canvas_state` already behaves. Two tabs on one lesson is not a supported
  case and is not made worse by this change.

## Testing

- **`lessonRun.ts`** — pure unit tests, the bulk of the coverage. Every
  transition, both refusals, and each invariant. Locked-skip refusal and
  `finish()` with an unfinished step are the two that protect the guarantee.
- **Locking** — a step over a measured gap locks; a step with no mastery row
  does not; the threshold matches `GAP_THRESHOLD`.
- **Migration** — a `canvas_state.plan` with `current_step: 3` derives a run
  with the first two steps `done` and the third `teaching`.
- **Route** — a refusal returns without calling any job; each phase dispatches
  to the expected job; a parse failure leaves the run unchanged.
- **Job routing** — every `LessonJob` has a model; env overrides resolve;
  region prefixes strip.

Existing StudyLab tests must keep passing — `blocks`, `actions`, `layout`,
`checkpointState`, `quiz` are all untouched by this.

## What shrinks

The tutor prompt loses every rule that polices control flow: step discipline
(rule 7), checkpoint repetition (rule 3a), when to finish (rule 13), and the
first-turn plan-drafting instructions (rule 1), which become the separate `plan`
job. What remains is *teach one beat toward this goal, using these card types*.

The reduction is the point, not a side effect. Those rules exist because the
model was running the state machine; with the machine in code they have nothing
to police.

## Out of scope

- **Montessori mode.** Deliberately excluded. This design covers the classic
  tutor path only.
- Re-pointing the three call sites still on the incident default
  (`studylab/grade`, `studylab/snap`, `textbook-vision-images`).
- The gap-map "build me a lesson" entry point, which will benefit from step
  locking automatically but needs no change here.
- Removing `canvas_state.plan` after migration.
