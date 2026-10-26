# LearnSpace Redesign Phase 4: Interactions and Showing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three new question formats a learner does with their hands (fill the blanks, put in order, tap the part), answers shown by the thing itself (sequences slide into order, bins close, beams settle, graphs redraw, code steps line by line), constraint answers that tick condition by condition, and real CC0 art for material pieces.

**Architecture:** The formats extend `CheckpointQuestion` and are marked on the server from what was given, as mcq and match are; each gets one renderer under `components/studylab/check/` used by both `QuizNode` and `PracticeNode`. Tap questions only point at our own catalogue diagrams, whose regions we map by hand. Animations are framer-motion `layout` and tween transitions driven by presets in `lib/studylab/motionPresets.ts`, each with a reduced-motion variant. Kenney sprites are vendored as WebP under `public/art/skins/` and join the existing asset catalogue.

**Tech Stack:** Next.js 16 (vendored React 19 at runtime; tests render with React 18.3), framer-motion 11, Vitest (node), Pyodide 0.26.4 worker for Python, Blob worker for JS.

**Spec:** `docs/superpowers/specs/2026-10-25-learnspace-redesign-design.md` — Phase 4, "Checks and interactions", "Motion and sound", "Assets".

## Global Constraints

- All motion 150–300 ms, every one with a reduced-motion variant: fade, or nothing (spec, Motion and sound).
- "Correctness is shown by the thing itself, then confirmed by text."
- All three formats "can also be done with the keyboard: tap-to-select then tap-to-place, with arrow keys and Enter."
- Marking stays where it is: mcq and match (and now fill, order, tap) are server-marked through `run.openCheck.questions`; `app/api/studylab/grade/route.ts` remains frozen.
- `tap` covers "our own diagrams, whose regions we know"; library figures with region data come later (Non-goals).
- Material skins: Kenney.nl CC0 packs vendored into `public/art/skins/<pack>/` with each pack's licence file; only the needed sprites kept, converted to WebP; every pack's source URL and licence recorded in `public/art/skins/LICENSES.md`. Kenney's logo is never used.
- Legacy prompts are sha256-pinned (`route.systemPrompt.test.ts`): new formats are taught in station-only prompt text and in `writeCheck`, never by editing `ACTION_LIST` / `LEGACY_RULES`.
- Data and routes additive only. Full Vitest suite and `tsc` pass before every commit. No push (user hold on all LearnSpace work).
- Text no smaller than 12 px (`lib/type-scale.test.ts`).

## Review Focus

1. **A tampered page claims a new-format answer is right.** `answeredRight` trusts `state` for unknown formats; fill, order and tap must be marked from `given` alone — Task 1 test.
2. **A fill question whose tiles cannot fill its blanks** (an answer missing from the tiles, a tile repeated, blanks ≠ answers) is refused at validation and never reaches a learner — Task 1 test.
3. **A tap question on a figure or region we have not mapped** is refused at validation, never drawn unanswerable — Task 1 and Task 2 tests.
4. **Reduced motion:** every new animation (slide into order, bins closing, beam settling, bar tween, code replay) has a no-transform or no-replay variant — Task 6 and Task 7 tests.
5. **Keyboard only:** fill, order and tap are fully operable with Tab, arrows, Enter and Space, and focus lands back on the question after Try again — Task 3 test.

---

### Task 1: The question model and server marking

**Files:**
- Modify: `lib/studylab/types.ts` (the `CheckpointQuestion` union; `QuizCell.given` already allows `string[]`)
- Modify: `lib/studylab/quiz.ts` (`isValidQuestion`, `coerceQuestion`, new graders, `answeredRight`)
- Test: `lib/studylab/quiz.test.ts`

**Interfaces:**
- Produces:
  ```ts
  | { id: string; format: 'fill'; prompt: string; text: string; tiles: string[]; answer: string[] }
    // text: the sentence with each blank written as "___"; answer[i] fills blank i; tiles: every answer plus 1–3 distractors
  | { id: string; format: 'order'; prompt: string; items: string[]; clues?: { text: string; before: string; after: string }[] }
    // items in the right order (shown shuffled); a clue says item `before` comes before item `after`
  | { id: string; format: 'tap'; prompt: string; figure: string; answer: string[] }
    // figure: a catalogue diagram ("asset:plant-cell"); answer: region ids from DIAGRAM_REGIONS (Task 2)
  export type FillQuestion = Extract<CheckpointQuestion, { format: 'fill' }>    // likewise OrderQuestion, TapQuestion
  export const BLANK = '___'
  export function blanksIn(text: string): number
  export function gradeFill(q: FillQuestion, given: string[]): boolean      // per blank, trimmed, case-insensitive
  export function gradeOrder(q: OrderQuestion, given: string[]): boolean    // exact sequence
  export function gradeTap(q: TapQuestion, given: string[]): boolean        // same set, order ignored
  export function clueStates(q: OrderQuestion, arrangement: string[]): boolean[]  // one per clue; an item not yet placed leaves its clue unmet
  ```
- Consumes (Task 2): `regionsFor(figure: string): DiagramRegions | null`.

- [ ] **Step 1: Write the failing tests** in `quiz.test.ts`:
  - `isValidQuestion` accepts a fill with 2 blanks, 2 answers, tiles = answers + 1 distractor; refuses: blanks ≠ answers; an answer missing from tiles; a tile repeated; more than 8 tiles.
  - accepts an order of 3–6 unique items with clues that hold in the right order; refuses: a duplicate item; a clue naming an item not in `items`; a clue false in the right order.
  - accepts a tap on `asset:plant-cell` whose answers are mapped region ids; refuses an unmapped figure, an unknown region id, an empty answer, a repeated id.
  - `markCheck` marks fill/order/tap from `given` and ignores `state: 'correct'` with a wrong `given` (Review Focus 1).
  - `clueStates` ticks a clue only when both items are placed and in that order.
- [ ] **Step 2: Run** `npx vitest run lib/studylab/quiz.test.ts` — Expected: FAIL (formats unknown).
- [ ] **Step 3: Implement** the union members, `blanksIn`, the three graders, `clueStates`, validation (tiles compared as a multiset; ≤ 8 tiles; 3–6 order items; tap via `regionsFor`), `coerceQuestion` (trim strings), and `answeredRight` cases for the three formats.
- [ ] **Step 4: Run** the test file — Expected: PASS. Then the full suite and `tsc`.
- [ ] **Step 5: Commit** `feat(learnspace): fill, order and tap questions, marked on the server from what was given`

### Task 2: Region maps for our diagrams

**Files:**
- Create: `lib/studylab/check/diagramRegions.ts`, `lib/studylab/check/diagramRegions.test.ts`
- Create (dev aid, not shipped as a route): `scripts/check-diagram-regions.ts` writing an HTML overlay sheet to the scratchpad

**Interfaces:**
- Produces:
  ```ts
  export interface Region { id: string; label: string; x: number; y: number; r: number }  // in the diagram's own pixels
  export interface DiagramRegions { width: number; height: number; regions: Region[] }
  export const DIAGRAM_REGIONS: Record<string, DiagramRegions>   // keyed by catalogue name without "asset:"
  export function regionsFor(figure: string): DiagramRegions | null
  export function regionAt(map: DiagramRegions, x: number, y: number): Region | null  // nearest region whose circle holds the point
  ```
- [ ] **Step 1: Failing tests:** every key is a catalogue diagram name (`assetUrl` resolves it under `/art/montessori/diagrams/`); every region id is `^[a-z0-9-]+$` and unique within its diagram; every circle lies inside width × height; no two circles in one diagram overlap; `regionAt` returns the region under a point and null in empty space; at least the twelve diagrams the hints name parts for most (plant-cell, animal-cell, leaf-section, flower-section, heart, lungs, eye, ear, earth-layers, volcano, river-profile, circuit-series) are mapped.
- [ ] **Step 2: Run** — Expected: FAIL (module missing).
- [ ] **Step 3: Map the regions by looking at each diagram** (read the WebP, note pixel size, place one circle per part the catalogue hint names). Render the overlay sheet with `scripts/check-diagram-regions.ts` and look at it; move any circle that misses its part.
- [ ] **Step 4: Run** — Expected: PASS; the overlay sheet viewed, every circle on its part.
- [ ] **Step 5: Commit** `feat(learnspace): the parts of our own diagrams, mapped for tap questions`

### Task 3: The three renderers, in checks

**Files:**
- Create: `components/studylab/check/FillBlanks.tsx`, `OrderSlots.tsx`, `TapFigure.tsx`, `ConditionList.tsx`
- Modify: `components/studylab/QuizNode.tsx` (`FORMAT_LABEL`, `initialAnswer`, `attemptOf`, `isAnswered`, `whyText`, the Try-again reset, the refocus selector, and local grading for learn-mode feedback)
- Modify: `lib/studylab/point.ts` (parts `blank-N`, `slot-N`, `region-<id>`) and `point.test.ts`
- Modify: `lib/studylab/attempt.ts`, `lib/studylab/recallFromCheckpoint.ts` and their tests
- Test: `lib/studylab/checkFormats.test.ts` (server-rendered, as `lessonCards.test.ts` renders cards)

**Interfaces:**
- Consumes: Task 1 types and graders; Task 2 `regionsFor`, `regionAt`.
- Produces (each a controlled component):
  ```ts
  FillBlanks({ q, value: string[], onChange(v: string[]), result?: boolean[], disabled? })
  OrderSlots({ q, value: string[], onChange(v: string[]), result?: boolean[], disabled? })   // shows ConditionList for clues
  TapFigure({ q, value: string[], onChange(v: string[]), result?: Record<string, boolean>, disabled? })
  ConditionList({ items: { text: string; met: boolean }[] })   // each line ticks as it becomes true, with `pop`
  ```
- [ ] **Step 1: Failing tests** (render a quiz cell for each format):
  - fill shows the sentence with one empty slot per blank (`data-part="blank-N"`) and every tile once as a button.
  - order shows numbered slots and the items shuffled (not in answer order for a seeded cell), plus each clue as a line with its tick state.
  - tap shows the diagram image and one focusable region button per mapped region, with no region label printed.
  - keyboard (Review Focus 5): every tile, slot item and region is a `button` (or `role="button"` with `tabIndex=0`); the refocus selector now matches `[data-part]` buttons.
  - `point.ts` accepts `blank-2`, `slot-3`, `region-nucleus`; `attemptText` reads each format back in words; recall cards are built from a missed fill/order/tap.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement.** Tap-to-select then tap-to-place: select a tile (or item), then a blank (or slot); Arrow keys move between targets, Enter or Space places, Backspace returns a placed tile. Tiles fly into blanks with `layout`; bank gaps stay. Corner `ResultBadge` per blank, slot or tapped region after marking; un-chosen parts fade as mcq options do.
- [ ] **Step 4: Run** — Expected: PASS; full suite and `tsc`.
- [ ] **Step 5: Look at it:** one check of each format on a real signed-in lesson in a tab of our own, mouse and keyboard; screenshots read.
- [ ] **Step 6: Commit** `feat(learnspace): fill the blanks, put in order, tap the part -- by hand or by keyboard`

### Task 4: The formats in practice cards

**Files:**
- Modify: `lib/studylab/types.ts` (`StudyNodeData.question?: CheckpointQuestion`; createCard `question`), `lib/studylab/actions.ts` (copy it), `components/studylab/PracticeNode.tsx`
- Test: `lib/studylab/practiceFormats.test.ts`

**Interfaces:**
- Consumes: Task 3 components; Task 1 graders.
- Produces: a practice card with `question` of format mcq, fill, order or tap renders that question instead of the textarea and is marked locally (practice is never gated) in learn mode: two tries, then Show me.
- [ ] **Step 1: Failing tests:** the reducer keeps a valid `question` on a practice card and drops an invalid one (the card falls back to free text); a practice card with a fill question renders `FillBlanks`, not a textarea; marking a wrong then right answer walks retry → correct.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — Expected: PASS; full suite and `tsc`.
- [ ] **Step 5: Commit** `feat(learnspace): practice in the new formats, marked on the card`

### Task 5: The tutor and the authoring passes write them

**Files:**
- Modify: `app/api/studylab/tutor/dispatch.ts` (`writeCheck` schema block, `normaliseQuestion`), `app/api/studylab/tutor/system-prompt.ts` (a station-only `QUESTION_FORMATS` block, like `POINT_ACTION`), `app/api/studylab/stations/passes.ts` (`PRACTICE_CHECK_ASK`), `lib/studylab/stationBundle.ts` (`questionProblems`), `app/api/studylab/tutor/stagePrompt.ts` if the check stage names formats
- Test: `route.test.ts` (writeCheck substrings), `passes.test.ts`, `stationBundle.test.ts`, `route.systemPrompt.test.ts` (pins unchanged; station prompt contains the block)

**Interfaces:**
- Consumes: Task 1 validation; Task 2 `DIAGRAM_REGIONS` (the prompt lists mapped diagrams and their region ids).
- [ ] **Step 1: Failing tests:** `writeCheck`'s prompt shows a fill, an order and a tap example and the rule "a tap question names a figure and regions from this list"; the station system prompt includes the formats block and both legacy sha256 pins still pass; `PRACTICE_CHECK_ASK` offers a practice card carrying a `question`; `questionProblems` refuses a fill whose answers are not all tiles, an order with a false clue, a tap on an unmapped figure (via `isValidQuestion`), and an order or fill a teacher could argue is left to the judge (`arguable-item`).
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement.** Prompt text lists mapped diagrams as `asset:<name>: region-id (label), …`, generated from `DIAGRAM_REGIONS`, never hand-copied.
- [ ] **Step 4: Run** — Expected: PASS; full suite and `tsc`.
- [ ] **Step 5: Commit** `feat(learnspace): checks and practice are written in the new formats`

### Task 6: Answers shown by the thing itself

**Files:**
- Modify: `lib/studylab/motionPresets.ts` and `motionPresets.test.ts` (add `slide` and `close`; the pinned name list grows by these two)
- Modify: `components/studylab/activities/SequenceActivity.tsx`, `SortActivity.tsx`, `BalanceActivity.tsx`, `VaryActivity.tsx`, `ActivityFrame.tsx`
- Modify: `components/studylab/material/MaterialFrame.tsx`, `SlotTarget.tsx`, `PieceChip.tsx`, `MaterialRenderer.tsx`
- Create: `lib/studylab/showAnswer.ts` (pure state for what to show) and its test

**Interfaces:**
- Produces:
  ```ts
  MOTION.slide  // layout transition 0.28 s; reduced: duration 0
  MOTION.close  // a bin's lid drops in over 0.22 s; reduced: opacity only
  export function shownOrder(items: string[], arrangement: string[], settled: 'correct' | 'revealed' | null): string[]  // the right order once revealed
  export function closedBins(groups: string[], solved: boolean): string[]
  ```
- [ ] **Step 1: Failing tests:** `slide` and `close` exist, ≤ 0.3 s, and have no transform and ≤ 0.15 s when reduced (Review Focus 4); `shownOrder` returns the arrangement until revealed, then the right order; `closedBins` closes every bin only when solved.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement:** sequence rows and ordering-track pieces animate with `layout` + `slide` into `shownOrder`; sorted bins draw a lid and a tick with `close` when solved; the balance beam settles level and both pans pop a tick when solved (it already tilts live); vary bars tween height and the plot's points tween over 0.25 s.
- [ ] **Step 4: Run** — Expected: PASS; full suite and `tsc`.
- [ ] **Step 5: Look at it** on a real lesson: a sequence revealed, a sort solved, a balance solved, a slider moved; screenshots read, and once with reduced motion on.
- [ ] **Step 6: Commit** `feat(learnspace): a sequence slides into order, sorted bins close, the beam settles, graphs redraw`

### Task 7: The code runner steps through the lines

**Files:**
- Modify: `lib/studylab/runner/types.ts` (`RunResult.trace?`), `workerSrc.ts` (Python `sys.settrace` over the user's code; JS: `console.log` records its caller's line), `jsEngine.ts`, `pythonEngine.ts`, `components/studylab/RunnableCodeCard.tsx`
- Create: `lib/studylab/runner/replay.ts` and its test
- Test: `lib/studylab/runner/workerSrc.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface TraceStep { line: number; out?: string }   // 1-based line in the learner's code
  RunResult.trace?: TraceStep[]                                 // at most 500 steps; absent when tracing fails
  export function replaySteps(trace: TraceStep[], code: string): { line: number; outputLines: number }[]
  ```
- [ ] **Step 1: Failing tests:** the JS worker source, run under `vm` as `workerSrc.test.ts` already does, returns a trace whose print steps carry the printing line; `replaySteps` caps at 500, drops lines outside the code, and counts output lines shown so far; the Python worker source contains the settrace hook and its trace shape (it cannot run under Vitest).
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement.** After a run, the card shows the code with line numbers and replays the trace: a ▶ marker on the current line and each output line highlighting as it is printed, 220 ms a step, skippable by clicking; reduced motion shows the final state with no replay. Worker code stays plain strings (minifier trap).
- [ ] **Step 4: Run** — Expected: PASS; full suite and `tsc`.
- [ ] **Step 5: Look at it:** run a Python and a JS card on a real programming lesson; screenshots read.
- [ ] **Step 6: Commit** `feat(learnspace): code steps through its lines with a marker, its output lighting as it prints`

### Task 8: Constraint answers tick condition by condition

**Files:**
- Modify: `lib/studylab/activities/types.ts` (`SequencePayload.rules?`), `patterns/sequence.ts`, `patterns/balance.ts`, `components/studylab/activities/SequenceActivity.tsx`, `BalanceActivity.tsx`, `components/studylab/material/MaterialFrame.tsx` (material `says` shown as a `ConditionList`)
- Test: `lib/studylab/activities/patterns/sequence.test.ts`, `balance.test.ts`

**Interfaces:**
- Consumes: Task 3 `ConditionList`; Task 1 clue shape (`{ text, before, after }`).
- Produces: `conditionsFor(pattern, payload, work): { text: string; met: boolean }[]` in `lib/studylab/activities/conditions.ts` — sequence rules ("X before Y"), balance ("Both sides weigh the same"), material `when` lines.
- [ ] **Step 1: Failing tests:** a sequence with rules ticks each rule only when it holds in the current arrangement; a balance ticks its condition only when level; a sequence without rules shows none.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement**, and add `rules` to the sequence brief in `materialRules` (not pinned).
- [ ] **Step 4: Run** — Expected: PASS; full suite and `tsc`.
- [ ] **Step 5: Commit** `feat(learnspace): constraint answers tick each condition as it comes true`

### Task 9: Kenney skins for material pieces

**Files:**
- Create: `public/art/skins/<pack>/*.webp` for animals, food, items, vehicles, space, characters; `public/art/skins/LICENSES.md`; each pack's `License.txt` copied beside its sprites
- Create: `scripts/vendor-kenney-skins.py` (run with `-I`; reads the unpacked packs from the scratchpad, converts the chosen sprites to WebP, writes nothing outside `public/art/skins/`)
- Modify: `lib/studylab/activities/assetCatalog.ts` (entries carry their own path; skins added with hints), `lib/studylab/activities/assetCatalog.test.ts`, `lib/studylab/activities/artMatch.test.ts` if its expectations move

**Interfaces:**
- Produces: catalogue entries `{ name, path: '/art/skins/<pack>/<name>.webp', hint }`; names `^[a-z0-9-]+$` (the material art rule), unique across the whole catalogue.
- [ ] **Step 1: Failing tests:** every catalogue entry's file exists under `public/`; names are unique and regex-safe; `LICENSES.md` names every pack directory with its source URL and "CC0"; every pack directory holds its `License.txt`; no file in `public/art/skins` is larger than 60 KB.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Choose the sprites** (about 150: 30 animals; fruit, vegetables, bread, dairy and kitchen things from the food kit's renders; tools, lab glassware, stationery and coins from generic items, each named by looking at it; a few cars and a motorbike; ships, a UFO and meteors; standing poses of the four characters and the robot), convert, and write hints in the catalogue's style.
- [ ] **Step 4: Run** — Expected: PASS; full suite and `tsc`; a sort with skinned items looked at on a real lesson.
- [ ] **Step 5: Commit** `feat(learnspace): Kenney CC0 art for material pieces, with its provenance`

### Task 10: Proof on real lessons

**Files:**
- Modify: `scripts/live/liveAuthorAudit.test.ts` (blind-solve fill, order and tap keys)

- [ ] **Step 1:** Run the authoring audit; the bar stays 100 % correct keys (now including fill, order and tap), ≥ 90 % ready, every pass < 20 s.
- [ ] **Step 2:** In a tab of our own, signed in, run real lessons in maths, biology and geography at step pace until a check in each new format appears; answer each right and wrong, by mouse and by keyboard; screenshots read.
- [ ] **Step 3:** Ledger the numbers and every ruling; full suite and `tsc`. No push.

## Calls made in this plan

- `tap` covers our own catalogue diagrams only, with hand-made region maps; tutor-drawn SVG regions wait until `DiagramNode` sanitises SVG (it injects tutor SVG raw today) and the verifier can check a region exists in a drawing.
- Practice in the new formats is marked on the card (practice is never gated); checks are marked on the server.
- JS code steps through the lines that print; Python steps through every executed line (`sys.settrace`). JS has no equivalent hook inside our worker short of rewriting the learner's code.
