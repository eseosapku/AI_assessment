# LearnSpace Redesign — Phase 3a: One Tutor, Live Stations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every new lesson is taught as stations (explore → name it → practice → check), with the stage held by the server. The tutor:
- opens each item by saying what to notice;
- steps back during checks;
- checks understanding with two chips and diagnoses before re-explaining;
- reads a learner's attempt back when they ask for help;
- points at parts of cards;
- follows a miss with a near-twin.

The classic/Montessori split ends: materials are the default way in.

**Architecture:**
- **Run state:** `LessonRun` gains `recipe: 'station'` and a `stage`. The transitions are pure and tested; old runs (no recipe) keep today's live beats.
- **Tutor turns:** the teaching job's prompt is unified and stage-specific, and dispatch enforces each stage's contract (a corrective retry when explore comes back as reading cards; no chips in checks).
- **New actions:** `help` and `diagnose` turns join `ask`. A `point` action becomes a canvas effect.
- **Models:** the lesson jobs move to Claude on Bedrock (Haiku 4.5 live, Sonnet 4.5 for plans) through `callGemma`, which learns the Anthropic request format.

**Tech Stack:** Next.js route handlers (no new routes), Bedrock InvokeModel, React, Vitest (node only).

**Spec:** `docs/superpowers/specs/2026-10-25-learnspace-redesign-design.md`, sections:
- *The tutor* (Behaviour; One tutor, not two modes);
- *Generation* (the model table only; authoring ahead is Phase 3b);
- *Phases* 3.

## Global Constraints

- **Frozen files:** `app/api/studylab/grade/route.ts`, `snap/route.ts` and `lib/textbook-vision-images.ts` stay unedited. `JOB_MODELS.grade` is not changed (the grade route reads it).
- **Data is additive only:** `recipe?` and `stage?` are optional on `LessonRun`, and old saved runs load and behave exactly as before. No schema change, no new route.
- **Answers:** the tutor never hands over the answer. In ordinary lessons the answer appears only through the reveal button after two misses; the homework rule is unchanged.
- **Untrusted text:** a learner's attempt is untrusted. It is fenced with `fenceStudentText` and capped at `MAX_TYPED_CHARS` before it reaches a prompt.
- **Model calls:** each one records usage (`usage: { feature, requestId, userId }`) and respects `signalFor(deadline)`. Amplify caps a request at 30 s.
- **Gates:** every commit has `npx vitest run` green and `npx tsc --noEmit -p .` clean, chained with `&&`. Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never stage `scripts/figgen/`, `scripts/build_checkpoint_figure_bank.py`, `scripts/textbook-figure-raw.ts`, `data/audit/` or `.playwright-mcp/`.
- **Pushing:** do not push anything until the user says so (2026-10-26).
- **Testing:** browser verification is on real signed-in lessons, never the demo (user, 2026-10-26).

## Review Focus

1. **An old lesson, saved before this phase** (no `recipe`), still gets live beats, the old checkpoint cadence and old prompts. A lesson's recipe never changes mid-lesson. (Task 2 tests; browser in Task 10.)
2. **A teaching turn that ignores its stage** — explore returning only reading cards, or a check stage with no checkpoint. It is corrected once, then accepted or closed by the existing `ensureStepCloses`. It must never be refused in a loop. (Task 3 tests.)
3. **Help:**
   - "Get help" on a test-mode question before it is answered must not exist (the bar offers it only after a learning miss);
   - help on a material must describe its current placement, not its initial state;
   - help while a turn is running is refused by the busy guard.

   (Tasks 5 and 10.)
4. **A `point` naming a card or part that is not on the board** is dropped silently. It must not throw, and must not leave a stale glow. (Task 6 tests.)
5. **A Claude call that is throttled or returns no text** becomes the same "That did not come through" refusal with retry that a bad parse gets. State is not advanced. (Task 1 tests.)

---

### Task 1: Claude on Bedrock for the lesson jobs

**Files:** Modify `lib/bedrock.ts` (+ test), `lib/studylab/lessonJobs.ts` (+ `lessonJobs.test.ts`).

**Interfaces:**
- Produces:
  - `buildInvokeBody` builds the Anthropic body for `anthropic.*` ids: `{ anthropic_version: 'bedrock-2023-05-31', max_tokens, temperature, messages: [{ role: 'user', content }] }`, with an image as a `{ type: 'image', source: { type: 'base64', media_type, data } }` block before the text;
  - the response reader takes text from `content[].text`;
  - `LessonJob` gains `'help'`;
  - `JOB_MODELS`:
    - `plan: 'anthropic.claude-sonnet-4-5-20250929-v1:0'`;
    - `teach_beat: 'anthropic.claude-haiku-4-5-20251001-v1:0'`;
    - `check: 'anthropic.claude-haiku-4-5-20251001-v1:0'`;
    - `help: 'anthropic.claude-haiku-4-5-20251001-v1:0'`;
    - `grade` unchanged;
  - `ENV_KEYS.help = 'AWS_LESSON_HELP_MODEL_ID'`.

- [ ] **Step 1: Failing tests:**
  - the Anthropic body shape, with and without an image;
  - text read from a Claude response body;
  - an empty `content` → empty string, which the callers already treat as a failed turn;
  - `modelForJob('help')` default and env override;
  - `grade` still Nova Lite.
- [ ] **Step 2: Run** `npx vitest run lib/bedrock.test.ts lib/studylab/lessonJobs.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Confirm one live call per new id from the app credentials with a node script in the scratchpad (eu-west-1 via `buildModelCandidates`). No secrets printed.
- [ ] **Step 4: Run.** PASS. Full suite, `tsc`. The route-test model assertions that pin Gemma/Nova for `plan`, `teach_beat` or `check` are updated to the new ids. Only those.
- [ ] **Step 5: Commit** `feat(learnspace): lesson jobs on Claude -- Sonnet plans, Haiku teaching, checks and help`.

### Task 2: Stations on the run

**Files:** Modify `lib/studylab/lessonRun.ts` (+ `lessonRun.test.ts`), `app/api/studylab/tutor/dispatch.ts` (`transitionFor` only).

**Interfaces:**
- Produces:
  - `type Stage = 'explore' | 'name' | 'practice' | 'check'`;
  - `LessonRun.recipe?: 'station'` and `LessonRun.stage?: Stage`;
  - `startStation(run): LessonRun`;
  - `advanceStage(run): LessonRun`;
  - `stageOf(run): Stage | null` (null for old runs).

  The rules:
  - `acceptPlan` sets `recipe: 'station'` and `stage: 'explore'`;
  - `passCheck` moving to a new step → `'explore'`;
  - `jumpTo` an untaught step → `'explore'`;
  - `nextBeat` → `advanceStage` (explore → name → practice → check; check stays check);
  - `beginCheck` → `'check'`;
  - `failCheck` → `'practice'` (the near-twin);
  - a run without `recipe` is never given a stage by any transition.
- [ ] **Step 1: Failing tests:**
  - each rule above;
  - an old run passes through every transition with `stage` and `recipe` undefined (Review Focus 1);
  - homework runs (`start_homework`) also take the recipe.
- [ ] **Step 2: Run.** FAIL. **Step 3: Implement.** **Step 4: Run.** PASS, full suite, `tsc`.
- [ ] **Step 5: Commit** `feat(learnspace): the run holds the station's stage -- explore, name it, practice, check`.

### Task 3: One tutor — the unified prompt and stage contracts

**Files:**
- Modify:
  - `app/api/studylab/tutor/system-prompt.ts` (+ `route.systemPrompt.test.ts`);
  - `app/api/studylab/tutor/dispatch.ts` (`buildTeachPrompt`, `applyAction`);
  - `route.test.ts` (prompt assertions).
- Create: `app/api/studylab/tutor/stagePrompt.ts` (+ test).

**Interfaces:**
- Produces:
  - `systemPrompt()` with no mode. It always lists `createActivity` and `build_material`, and replaces the card-first mandate with the station mandate:
    - "A station never opens with a reading card";
    - "your `say` is ONE line on what to notice or what changed — never the instructions";
    - "points: …" (Task 6).
  - `stagePrompt(stage: Stage, ctx: { missed: string[]; pace: Pace }): string`:
    - **explore:** exactly one material (createActivity / build_material), or, where no material honestly fits, ONE predict-or-notice item: a `practice` card with `predict: true`, a sort or sequence of real examples, or a library figure with a question. No concept, table, callout, mermaid or worked card.
    - **name:** 1–2 cards that build on what the learner just did, with point targets; the `suggestions` are exactly the comprehension chips.
    - **practice:** one near-twin practice card or a material variant. After a miss, a minimal variation of each missed question, listed: never harder.
    - **check:** one checkpoint, 1–2 questions, gate hard; `say` ≤ 8 words or empty; no suggestions.
    - **run pace:** the whole station in one turn, in that order, ending with the checkpoint.
  - In `applyAction`, for station runs:
    - an explore turn whose kept actions hold no material, practice or figure item is re-asked once with a corrective line (Review Focus 2);
    - a check turn's suggestions are forced to `[]`;
    - a name turn's suggestions are forced to `COMPREHENSION_CHIPS`.
- [ ] **Step 1: Failing tests:**
  - the system prompt contains `createActivity` and `build_material` and no "card-first" line (pins the Montessori open item);
  - `stagePrompt` text per stage;
  - with a mocked `callGemma`:
    - an explore turn returning one concept card triggers exactly one corrective re-call;
    - a second failure is accepted, not refused;
    - check-stage suggestions are emptied;
    - name-stage chips are the two.
  - old runs build the old prompt unchanged.
- [ ] **Step 2–4:** RED, implement, GREEN, full suite, `tsc`.
- [ ] **Step 5: Commit** `feat(learnspace): one tutor -- every station opens with something to handle, the stage decides each turn`.

### Task 4: Comprehension chips and diagnosis

**Files:**
- Create: `lib/studylab/chips.ts` (+ test).
- Modify: `dispatch.ts` (a `diagnose` action), `components/studylab/stage/InkyDock.tsx`, `ChatMouthpiece.tsx`, `Workspace.tsx`.

**Interfaces:**
- Produces:
  - `COMPREHENSION_CHIPS = ['Makes sense', 'Not really'] as const`;
  - `chipAction(label: string): 'advance' | 'diagnose' | 'ask'`;
  - `LessonAction` gains `{ type: 'diagnose'; about?: string }` (no transition). Its prompt asks ONE diagnosing question with 2–3 chips naming the likely sticking points ("the tiles, or how they make 7x?"). It makes no cards.
- The chip clicked under Inky or in the drawer:
  - `advance` → the stage's `onAdvance`;
  - `diagnose` → `sendAction({ type: 'diagnose' })`;
  - anything else → `ask` (unchanged). A diagnosis chip is asked as a question, and the tutor re-explains that one point with a card.
- [ ] **Steps:**
  - tests: `chipAction` cases; a dispatch `diagnose` turn returns suggestions and no `createCard`;
  - implement;
  - full suite, `tsc`.
- [ ] **Commit** `feat(learnspace): Makes sense / Not really -- the tutor asks what is unclear before explaining again`.

### Task 5: Get help carries the attempt

**Files:**
- Create: `lib/studylab/attempt.ts` (+ test).
- Modify:
  - `dispatch.ts` (a `help` action, `applyHelp`);
  - `components/studylab/stage/StageContext.tsx` (`useDock().help(attempt)`);
  - `LessonStage.tsx` (opens the drawer, calls `chat.onHelp`);
  - `QuizNode.tsx`, `PracticeNode.tsx`, `activities/ActivityFrame.tsx` + `material/MaterialActivity.tsx` / `MaterialBoardNode.tsx` (`hasHelp` when docked, the `getHelp` action);
  - `Workspace.tsx`, `ChatMouthpiece.tsx` (the props).

**Interfaces:**
- Produces:
  - `attemptText(input: { kind: 'mcq'; options: string[]; chosen?: number } | { kind: 'match'; pairs: { left: string }[]; given: string[] } | { kind: 'text'; text: string } | { kind: 'material'; placed: { piece: string; slot: string }[]; unplaced: string[] }): string`. For example: "Chose: B) 2x + 3", "Wrote: …", "Put 3 tiles in Area, left 1 unplaced".
  - `LessonAction { type: 'help'; nodeId: string; prompt: string; attempt: string }` and `applyHelp`, on the `help` job.
    - The prompt holds the question, the fenced attempt and the step.
    - The tutor must read the attempt back in its own words and ask ONE question that narrows the gap, never the answer. It may emit one `point` action at the learner's work.
    - No cards.
  - The learner's line in the chat reads "Why was my answer wrong?".
  - `BarOptions.hasHelp` is true for a docked learning card. The bar already shows Get help only in `retry` and `wrong` (Review Focus 3).
- [ ] **Steps:**
  - tests: `attemptText` per kind (a material describes its current placement); `applyHelp` fences the attempt and makes no cards; `barModel` with `hasHelp` in test mode never shows Get help before an answer;
  - implement;
  - full suite, `tsc`.
- [ ] **Commit** `feat(learnspace): Get help reads your attempt back and asks one question that narrows the gap`.

### Task 6: Point at parts

**Files:**
- Create: `lib/studylab/point.ts` (+ test).
- Modify:
  - `lib/studylab/actions.ts` (+ `actions.validate.test.ts`, the `point` action → `CanvasEffect { kind: 'point'; nodeId; part? }`);
  - `lib/studylab/spotlight.ts` (`focusFromTurn` keeps point effects out of focus);
  - renderers (`data-part` attributes):
    - `canvasNodes.tsx` concept items `item-N`;
    - `tutorNodes.tsx` worked steps `step-N`, table cells `rRcC`;
    - `QuizNode.tsx` options `option-N`;
    - `material/PieceChip.tsx` `piece-<id>`, `SlotTarget.tsx` `slot-<id>`.
  - `stage/InkyDock.tsx` (the arrow), `LessonStage.tsx` and `Workspace.tsx` (the pointer state);
  - `app/globals.css` (`[data-pointed]` glow with a reduced-motion variant);
  - `system-prompt.ts` (the part names).

**Interfaces:**
- Produces:
  - TutorAction `{ type: 'point'; nodeId: string; part?: string }`;
  - `isValidPart(part: string): boolean` (`item-N`, `step-N`, `rNcN`, `option-N`, `piece-…`, `slot-…`);
  - `pointSelector(nodeId: string, part?: string): string`.
- The latest turn's pointer lives in `Workspace` state until the next turn. `InkyDock` resolves it in the DOM:
  - found → set `data-pointed`, draw an SVG arrow from the bubble to the part's rect, and camera-frame it if it is off-screen;
  - not found → nothing (Review Focus 4).
- [ ] **Steps:**
  - tests: `isValidAction` accepts and rejects points; `applyActions` turns a point into an effect, not a node; `isValidPart` and `pointSelector`;
  - implement;
  - full suite, `tsc`;
  - in the browser: a pointed table cell glows and the arrow reaches it.
- [ ] **Commit** `feat(learnspace): Inky points at the part it is talking about -- the part glows and the bubble's arrow reaches it`.

### Task 7: Near-twins after a miss

**Files:** Modify `dispatch.ts` (`buildTeachPrompt` passes `missed`), `stagePrompt.ts` (+ test), `route.test.ts`.

- [ ] **Steps:**
  - tests:
    - after a failed check, the next station turn's prompt lists the missed question prompts under "NEAR-TWIN" and says "one thing changed, never harder";
    - after a missed practice (the board shows a practice cell at `incorrect`), the same applies;
    - none of this appears without a miss;
  - implement;
  - full suite, `tsc`.
- [ ] **Commit** `feat(learnspace): after a miss, a near-twin -- the same idea with one thing changed`.

### Task 8: The Montessori leftovers

**Files:**
- `lib/studylab/activities/artMatch.ts` (+ test);
- `lib/studylab/activities/dropZoneGeometry.ts`, `patterns/balance.ts`, `components/studylab/activities/BalanceActivity.tsx` (+ tests);
- `dispatch.ts` (`refuseUnjustifiedActivities`, the art relevance gate) (+ `dispatch.intent.test.ts`).

- [ ] **Steps:**
  - tests:
    - `normalise` matches exactly or by a known plural ("beans" ↔ "bean", "boxes" ↔ "box"), not by stripping every trailing s ("glass" ≠ "glas");
    - a balance pan holds four items, labelled on the beam;
    - a catalogue asset whose hint shares no term with the step title or goal is refused unless the intent names it;
  - implement;
  - full suite, `tsc`.
- [ ] **Commit** `fix(learnspace): materials -- four items a pan, art that belongs to the topic, exact art names`.

### Task 9: The client follows the stage

**Files:** Modify `components/studylab/stage/LessonStage.tsx`, `ActionDock.tsx`, `PathRail.tsx`, `lib/studylab/spotlight.ts` (+ test).

- [ ] **Steps:**
  - tests: `continueFor` labels the explore stage's Continue "I've tried it" once its material or predict item is settled, "Continue" otherwise; the check stage never shows chips.
  - The rail shows the current station's four stages as small pips under its title (explore, name, practice, check), the current one filled.
  - Implement; full suite, `tsc`.
- [ ] **Commit** `feat(learnspace): the stage shows -- four pips on the station, the bar names the move`.

### Task 10: Real lessons

**Files:** none new. Fixes get a commit each.

- [ ] **Step 1:** Run new real lessons in three subjects: maths, biology and history (the last a no-material topic, so explore is predict/notice). Use the signed-in Playwright browser, in a tab of our own.
- [ ] **Step 2:** For each, screenshot each stage:
  - explore opens with a material or a predict item;
  - name it shows the chips;
  - "Not really" gets a diagnosing question;
  - Get help after a practice miss reads the attempt back;
  - a point glows;
  - a missed check is followed by a near-twin.
- [ ] **Step 3:** Open an old lesson (made before this phase) and confirm live beats still work (Review Focus 1).
- [ ] **Step 4:** Fix, then run the full suite and `tsc`. Record per-lesson model cost from the `ai-usage` records in the ledger. **No push.**
