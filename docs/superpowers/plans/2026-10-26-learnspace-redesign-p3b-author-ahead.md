# LearnSpace Redesign Phase 3b: Author Ahead — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Write each station before the learner reaches it — explore item, name-it cards for each likely outcome, practice and a check whose every wrong option carries its own feedback — verify it, and serve it instantly, falling back to Phase 3a's live beats whenever a bundle is missing, stale or failed.

**Architecture:** Station authoring is a chain of short `author_station` jobs on the existing `ai_jobs` table (the user approved this over a new table), one pass per request so each stays under 20 s. The client drives the chain in the background — station 1 while the plan card is up, station N+1 while the learner works on N. The tutor route serves a ready, verified bundle for a station's stage turns with no model call; Get help, diagnose and questions stay live.

**Tech Stack:** Next.js 16 App Router routes, Postgres (`ai_jobs`, additive rows only), Bedrock Claude via `callGemma` (Sonnet 4.5 authoring, Haiku 4.5 judging, Sonnet fallback rules from Phase 3a), Vitest.

**Spec:** `docs/superpowers/specs/2026-10-25-learnspace-redesign-design.md` — "Generation: author ahead, in several passes", "Data and routes", "Verification". Phase 3a (`docs/superpowers/plans/2026-10-26-learnspace-redesign-p3a-one-tutor.md`) is built; its station run, stage prompts and `exploreByStep` are the base.

## Global Constraints

- No push. The user holds all LearnSpace work locally until they say.
- Additive DB writes only: new `ai_jobs` rows with `job_type = 'author_station'`; no DDL, no new tables, no updates to rows this phase did not create.
- Every request a pass runs in finishes in under 20 s (Amplify cuts at 30 s); a pass that cannot is split, not lengthened.
- Models by job, env-overridable like `JOB_MODELS`: authoring passes Sonnet 4.5, the judge Haiku 4.5, each with the Phase 3a busy fallback.
- Every model call goes through the usage recorder with a feature name (`station_explore`, `station_name`, `station_practice_check`, `station_judge`).
- A lesson from before stations, a homework step, and any station without a ready verified bundle are taught exactly as in Phase 3a.
- Never commit `scripts/build_checkpoint_figure_bank.py`, `scripts/textbook-figure-raw.ts`, the `data/audit/paper-style.json` deletion, or anything under `scripts/figgen/` with this work. Never touch `app/api/studylab/grade/route.ts`, `snap/route.ts` or `lib/textbook-vision-images.ts`.
- Full Vitest suite and `tsc` green before every commit.

## Review Focus

1. **A plan edited after authoring began** (a step renamed, reordered, removed): a bundle written for the old step must never be served. The version is a hash of what the bundle was written for.
2. **A bundle that fails verification** is never served, and the learner cannot tell: the station runs live.
3. **Two tabs, or a reload mid-chain, driving the same station:** a pass is claimed once; a second request for the same pass waits or returns status, never writes a second, conflicting result.
4. **A bundle that becomes ready mid-station** (explore was served live): the rest of that station stays live. A station's origin is decided once, at explore.
5. **Spend on stations nobody reaches:** at most one station ahead is authored; a closed tab stops the chain; a failed pass is retried once, then the station is marked live.

---

### Task 1: The station bundle and its code checks

**Files:**
- Create: `lib/studylab/stationBundle.ts` (+ `stationBundle.test.ts`).

**Interfaces:**
- Produces:
  - `type StationBundle = { version: string; stepId: string; explore: AuthoredExplore; name: Record<'solved' | 'helped' | 'untried', AuthoredCut>; practice: AuthoredItem; check: AuthoredCheck }`
    - `AuthoredExplore = { opening: string; action: TutorAction /* createActivity | build_material | createCard practice titled "Predict: …" */; intent?: TeachingIntent; hints: string[] }`
    - `AuthoredCut = { say: string; actions: TutorAction[] /* 1–2 createCard, optional connect, at most one point */ }`
    - `AuthoredItem = { say: string; action: TutorAction }`; `AuthoredCheck = { say: string; questions: CheckpointQuestion[] }`
  - `verifyBundleCode(b: unknown): { ok: true; bundle: StationBundle } | { ok: false; pass: 'explore' | 'name' | 'practice_check'; reasons: string[] }`
- [ ] **Step 1: failing tests:**
  - a well-formed bundle passes;
  - an MCQ whose `answer` is out of range, or any wrong option without `optionFeedback`, fails with pass `practice_check`;
  - a `build_material` that `isSolvable` rejects, or a `createActivity` that `validateSpec`/`checkIntent` rejects, fails with pass `explore`;
  - a name cut with three cards, or a `point` naming an id not in the bundle, fails with pass `name`;
  - a `vary` material whose intent carries no `relationship` fails (the Montessori open item: an invented formula must be cited);
  - a short-answer question without a rubric fails.
- [ ] **Step 2–4:** RED, implement (reuse `validateSpec`, `checkIntent`, `parseMaterialSpec`, `validateMaterial`, `isSolvable`, `isValidAction`, `isValidPart`), GREEN.
- [ ] **Step 5: Commit** `feat(learnspace): the station bundle, and the code that refuses a bad one`.

### Task 2: Versions and job storage

**Files:**
- Create: `lib/studylab/stationJobs.ts` (+ test); Modify: `lib/ai-jobs.ts` (`AI_JOB_TYPES` gains `'author_station'`).

**Interfaces:**
- Produces:
  - `stationVersion(input: { title: string; goal: string; position: number; subject?: string }): string` — a short stable hash; changes when anything the bundle was written for changes.
  - `type Pass = 'explore' | 'name' | 'practice_check' | 'verify'`; `nextPass(done: Pass[]): Pass | null`.
  - `authorState(spaceId, stepId, version): Promise<{ status: 'none' | 'authoring' | 'ready' | 'failed'; done: Pass[]; bundle?: StationBundle; retries: number }>` — reads this station's `author_station` rows (filter by `input_payload->>'spaceId'`, `stepId`, `version`).
  - `claimPass(spaceId, stepId, version, pass): Promise<string | null>` — inserts a `running` row only if no `running`/`succeeded` row exists for that pass (one statement, `INSERT … SELECT … WHERE NOT EXISTS`), returns its id or null.
- [ ] **Steps:** tests with `db.query` mocked — the version changes with the title, goal or position and not otherwise; `nextPass` order; `claimPass` returns null when the pass is already running or done; `authorState` reports ready only when `verify` succeeded for this version. Implement; commit `feat(learnspace): station authoring on ai_jobs -- versioned, claimed once`.

### Task 3: The authoring passes

**Files:**
- Create: `app/api/studylab/stations/passes.ts` (+ test); Modify: `lib/studylab/lessonJobs.ts` (jobs `author` → Sonnet 4.5, `judge` → Haiku 4.5; `fallbackForJob` covers both).

**Interfaces:**
- Produces: `runPass(pass: Pass, ctx: { title: string; subject?: string; step: LessonStep; plan: LessonStep[]; partial: Partial<StationBundle> }, opts: { signal?: AbortSignal; usage?: … }): Promise<{ ok: true; partial: Partial<StationBundle> } | { ok: false; reason: string }>`
- The prompts reuse Phase 3a's pieces: `stationSystemPrompt()` rules, `stagePrompt` contracts, `materialRules()`, `advertiseVocabulary()`.
  - **explore:** one material or predict item, its intent (a `vary` cites the relationship it models, with a source), an opening line on what to notice, two outcome hints.
  - **name:** three cuts — solved first time, solved after help, did not try — each 1–2 cards that build on that outcome, `point` targets at the explore item's parts.
  - **practice_check:** one near-twin practice item; 1–2 check questions, hard, MCQs with `optionFeedback` for every option.
  - **verify:** `verifyBundleCode`, then the Haiku judge on facts, on each feedback line fitting its option, and on a `vary` relationship matching the step; a judge "fail" names the pass to redo.
- [ ] **Steps:** tests with `callGemma` mocked — each pass's prompt carries its contract and the step; a reply missing per-option feedback is `ok: false`; the verify pass runs the code checks before any model call and does not call the judge when they fail; each pass's `maxTokens` fits the 20 s budget (asserted per pass). Implement; commit `feat(learnspace): the authoring passes -- explore, name for each outcome, practice and check, verify`.

### Task 4: The author route

**Files:**
- Create: `app/api/studylab/[id]/stations/[step]/author/route.ts` (+ test with db, `callGemma` mocked).

**Interfaces:**
- `POST` runs the next pass for the station's current version and returns `{ status, done, next }`; `GET` returns `authorState`.
- Owner check, rate limit and subscription gate exactly as the tutor route; a deadline of 20 s; a failed pass is retried once on the next POST, then the station is `failed` (live).
- [ ] **Steps:** tests — not the owner → 404, nothing written; a pass already claimed → 202 with status, no second model call; four POSTs take a station to `ready`; a second failure of one pass → `failed`; a stale version (plan edited) starts a fresh chain. Implement; commit `feat(learnspace): a route that writes a station one pass at a time`.

### Task 5: Prefetch from the page

**Files:**
- Create: `lib/studylab/prefetch.ts` (+ test); Modify: `components/studylab/Workspace.tsx`.

**Interfaces:**
- `whatToAuthor(run: LessonRun | null, known: Record<string, 'none' | 'authoring' | 'ready' | 'failed'>): string | null` — the station to drive next: during planning, the first step; while teaching, the step after the current one; never a homework step, never a lesson from before stations, never more than one ahead.
- Workspace runs one background loop: POST the author route for `whatToAuthor`, back off 1 s → 8 s on 202, stop on `ready`/`failed`, abort on unmount or when the run moves on. It never blocks a turn and shows nothing.
- [ ] **Steps:** tests for `whatToAuthor` (planning → step 1; teaching step 2 → step 3; last step → null; homework → null; legacy run → null; a `failed` or `ready` station → the next candidate or null). Implement the loop; commit `feat(learnspace): the next station is written while the learner works on this one`.

### Task 6: Serving an authored station

**Files:**
- Modify: `app/api/studylab/tutor/dispatch.ts`, `lib/studylab/lessonRun.ts` (`stationOrigin?: 'authored' | 'live'` on the run, set at explore, cleared by `focus`), `route.test.ts`.

**Interfaces:**
- At a station's explore turn, if `authorState` is `ready` for the step's current version, the run takes `stationOrigin: 'authored'` and the turn returns the bundle's explore (opening line as `say`) with no model call. Name returns the cut for `exploreByStep` (solved with attempts ≤ 1 → `solved`; solved later → `helped`; tried or untried → `untried`, whose wording does not claim a result); practice and check return theirs, the check opened hard through `beginCheck`/`keepQuestions`.
- `stationOrigin: 'live'`, a bundle that fails `verifyBundleCode` at serve time, or a near-twin after a miss: live, as Phase 3a.
- [ ] **Steps:** tests — a ready bundle serves explore with `callGemma` not called; name picks each of the three cuts from `exploreByStep`; a bundle ready only after a live explore is not used for that station; a stale version is not served; a missed check's near-twin turn is live. Implement; commit `feat(learnspace): an authored station is served at once, and live beats take over whenever it cannot be`.

### Task 7: The live authoring audit

**Files:**
- Create: `scripts/live/authorAudit.ts` (run with tsx against the app's own credentials; writes a report to the scratchpad).

- [ ] **Steps:** author 20 stations across maths, physics, chemistry, biology, geography, computing and history, end to end through `runPass`; count verifier refusals by pass, solvable materials, checks with correct keys, stations authored without falling back, seconds per pass, and cost from `ai_usage_events`. The bar: 100% correct keys, ≥90% authored without fallback, every pass under 20 s. Fix prompts until it is met; ledger the numbers; commit fixes `fix(learnspace): authoring -- …`.

### Task 8: Real lessons

- [ ] **Step 1:** In a tab of our own on the signed-in browser, run new lessons in maths, biology and history at step pace. Confirm station 1 is ready by the time the plan is accepted (or record how often it is not), station 2 is ready before it is reached, authored turns arrive in under a second, outcome-matched name cuts read right, and a plan edit mid-lesson re-authors.
- [ ] **Step 2:** Force a failure (an env override to a model id that refuses) and confirm the lesson carries on live without a visible seam.
- [ ] **Step 3:** Record per-lesson cost (authoring vs live) from `ai_usage_events` in the ledger. Full suite and `tsc`. No push.
