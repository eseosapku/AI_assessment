# Meaning Gates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** No interaction reaches a learner if:
- moving it changes nothing;
- it is solved before it is touched;
- it prints its own answer;
- it is marked on the control instead of on what it shows;
- its picture does not show its item.

**Architecture:** A pure module, `lib/studylab/meaning/`, returns faults in words for any activity or material action. Its aggregate, `meaningFaults(action)`, is called in four places:
- the authoring code checks (`materialProblems` in `stationBundle.ts`), so a pass is refused and rewritten;
- live dispatch (`refuseUnjustifiedActivities`), so a live item is refused and the predict fallback takes over;
- `keptAuthored`, *after* pictures are stripped, so a station the strip broke is not served;
- a live eval that scores real authored stations on each dimension.

**Tech Stack:** TypeScript, Vitest; expressions via `lib/studylab/activities/expr.ts`; pictures via `assetCatalog.ts`.

**Spec:** `docs/superpowers/specs/2026-10-26-learnspace-interactions-that-teach-design.md` (section 1, "Meaning gates")

## Global Constraints

- Faults are sentences a writer can act on, like `questionFault` ("the bar 'Lit half of Moon' reads 50 at every slider position").
- Pure functions only in `lib/studylab/meaning/`; no model calls.
- Legacy prompts stay byte-for-byte (sha256 pins in `route.systemPrompt.test.ts`).
- The full Vitest suite and `tsc` pass before every commit.

## Review Focus

1. **A slider whose outputs move, but whose target the slider can never reach.** Expected: refused ("no slider position reaches the target").
2. **A three-period card whose picture names fall back to labels after the strip.** Expected: the card is refused at serve time, never drawn with the word in place of the picture.
3. **A picture whose hint shares only a generic word with its item** ("cell" for "Memory cell" → neuron). Expected: removed.
4. **A balance authored balanced.** Expected: refused.
5. **Old slider cards with no `target`.** Expected: refused when they are authored again, but already-saved boards still render and mark as before.

---

### Task 1: Slider cards that show something

**Files:**
- Create: `lib/studylab/meaning/vary.ts`
- Create: `lib/studylab/meaning/vary.test.ts`
- Modify: `lib/studylab/activities/patterns/vary.ts`: `validate` marks on `payload.target` when present.

**Interfaces:**
- Produces:
  ```ts
  export function varyFaults(payload: VaryPayload, success: SuccessRule): string[]
  export function samplePositions(variable: VaryPayload['variable'], n = 9): number[]
  ```

- [ ] **Step 1: Failing tests.**
  - The Moon card's payload (bars `"50"`, readout `"50"`) gives "… reads 50 at every slider position".
  - A bar whose span across the range is under 5% of its `max` is refused; so is one at or above `max` (or at or below 0) everywhere.
  - A plot whose slider id is `x` is refused.
  - A card with no `target` is refused ("mark it on what the learner watches: give a target on a reading").
  - A `target` expression that never comes within tolerance at any sampled position is refused.
  - A `target` already met at `min` is refused ("solved before the slider moves").
  - The river card (gradient → flow `g*2`, target flow 30 ± 2) passes.
  - `varyModule.validate` with a `target` marks the output, not the slider: flow 30 is reached at g = 15.
- [ ] **Step 2: Run.** `npx vitest run lib/studylab/meaning/vary.test.ts lib/studylab/activities/patterns` (expected: FAIL).
- [ ] **Step 3: Implement.**
  - Sample with `modelValue` at `samplePositions` (min, max, and evenly spaced between, snapped to the step).
  - An expression that fails at every sample counts as constant.
  - `validate`: when `payload.target` is set, evaluate `target.expr` at `work.value` and check it against `target.value` ± `max(target.tolerance, half the output's change over one step)`.
- [ ] **Step 4: Run.** Expected: PASS, full suite and `tsc` green.
- [ ] **Step 5: Commit.** `feat(learnspace): a slider card must move what it shows, and is marked on it`

### Task 2: Not solved before it is touched

**Files:**
- Create: `lib/studylab/meaning/startState.ts` and its test.

**Interfaces:**
- Produces: `export function startStateFaults(action: unknown): string[]`. It checks a balance's starting pans, any created activity's `initialWork` through its pattern module's `validate`, and a material with `isSolvable(...).moves === 0`.

- [ ] **Step 1: Failing tests.**
  - A weights balance with 5 against 2 + 3 already on the pans is refused.
  - A sort with every item pre-placed is refused.
  - A material solved at zero moves is refused.
  - The bench sort, balance and slider pass.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Steps 3–5.** Implement, run green, then commit `feat(learnspace): nothing is served already solved`.

### Task 3: Nothing prints its own answer

**Files:**
- Create: `lib/studylab/meaning/selfAnswer.ts` and its test.
- Modify: `components/studylab/activities/ThreePeriodActivity.tsx`. As a defence, an item with no picture draws a neutral "?" tile, never its label.

**Interfaces:**
- Produces: `export function selfAnswerFaults(action: unknown): string[]`.
  - Every three-period item needs a picture `assetUrl` resolves.
  - A label or three-period *material* must not head any box with a piece's own label.
  - A sort bin, a match target or a sequence slot must not contain the piece's label word for word.

- [ ] **Step 1: Failing tests.**
  - The immune card (Antibody with no picture) gives "'Antibody' has no picture, so the card would show its name as the answer".
  - A label material whose boxes are headed "Nucleus" for piece "Nucleus" is refused.
  - A server render of `ThreePeriodActivity` with a pictureless item contains no `>Antibody<` inside the art tile.
- [ ] **Steps 2–5.** Run red, implement, run green, then commit `feat(learnspace): no card shows its own answer`.

### Task 4: A picture shows its item

**Files:**
- Create: `lib/studylab/meaning/art.ts` and its test.
- Modify: `app/api/studylab/tutor/dispatch.ts`: `dropStrayArt` matches each picture against its *item* and checks `scene`, `payload.imageUrl` and `image.imageUrl` too.

**Interfaces:**
- Produces:
  ```ts
  export function pictureFits(asset: string, itemLabel: string): boolean
  export function artFaults(action: unknown): string[]
  ```
  - `pictureFits` compares the catalogue name and hint tokens with the item label's tokens. Generic words (cell, part, thing, system, type, structure) do not count.
  - A scene must share a non-generic token with the card's prompt or the slider's label.

- [ ] **Step 1: Failing tests.**
  - `neuron` does not fit "Memory cell".
  - `test-tube` does not fit "Antibody".
  - `bacterial-cell` fits "Bacterium" but not "Virus".
  - `globe` does not fit "Moon position in orbit".
  - `plant-cell` fits "Plant cell".
  - `river-profile` fits a river gradient card.
  - `dropStrayArt` removes unfitting pictures per item and reports them.
- [ ] **Steps 2–5.** Run red, implement, run green, then commit `feat(learnspace): a picture must show what it labels`.

### Task 5: The gates where items are accepted

**Files:**
- Create: `lib/studylab/meaning/index.ts`, which exports `meaningFaults(action)`: the union of Tasks 1–4 by action type.
- Modify:
  - `lib/studylab/stationBundle.ts`: `materialProblems` adds `meaningFaults` for explore and practice.
  - `app/api/studylab/tutor/dispatch.ts`:
    - `refuseUnjustifiedActivities` refuses on `meaningFaults`, and the existing predict fallback fills in;
    - `keptAuthored` re-checks the stripped actions with `meaningFaults` and returns `null` if any fault appears, so the turn is written live with the gates.
  - `app/api/studylab/stations/passes.ts` and the station prompt state the rules:
    - a slider card names a `target` on a reading that the slider can reach;
    - every three-period item has a catalogue picture;
    - a `scene` must show the thing.

- [ ] **Step 1: Failing tests.**
  - `verifyBundleCode` refuses the Moon and immune explores, and its reasons carry the fault words.
  - `keptAuthored` returns null for the immune station after the strip.
  - The live dispatch of the Moon spec is refused and replaced by a predict card.
  - The station prompt contains the three rules; the legacy pins are unchanged.
- [ ] **Steps 2–5.** Run red, implement, run green, then commit `feat(learnspace): meaning gates on every interaction, authored or live`.

### Task 6: The eval, run on real lessons

**Files:**
- Create: `scripts/live/meaningEval.test.ts` (under `vitest.live.config.ts`).

**What it does:**
- Authors 20 stations across maths, physics, chemistry, biology, geography and computing through the real passes.
- Tallies each served explore and practice item on every dimension:
  - valid;
  - responds;
  - not solved at the start;
  - marked on what is shown;
  - no self-answer;
  - picture fits.
- Writes a JSONL row per station. The bar is 100% on the code dimensions for *served* items (failures may be rewritten, never served).
- Notes the rewrite rate per dimension.

- [ ] **Step 1: Run it.** Read the JSONL and record the numbers in the ledger.
- [ ] **Step 2: Fix any prompt that drives a high rewrite rate.** Run again.
- [ ] **Step 3: Commit** the eval and any prompt fixes: `test(learnspace): meaning eval on real lessons`.
