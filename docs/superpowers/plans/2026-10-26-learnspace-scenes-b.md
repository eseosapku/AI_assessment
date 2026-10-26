# Scenes, Stage B: the Engine Contract and the First Scenes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Purpose-built interactive scenes that the tutor configures in a few semantic fields, starting with Moon orbit and phases and then particles. Each scene computes what the learner sees, so any configuration the tutor can write is correct, solvable and meaningful.

**Architecture:**
- A scene is a new activity pattern, `scene`, with payload `{ engine, config }`. It rides everything activities already have: `ActivityFrame` and its check bar, hints, outcomes, `validateSpec`, the station passes, and the meaning gates.
- `lib/studylab/scenes/` holds the `SceneEngine` contract and a registry. Each engine is one folder:
  - `config.ts`: parse, faults, initial state, observe, check, solve;
  - `View.tsx`: the SVG, with pointer and keyboard;
  - `prompt.ts`: the catalogue entry the tutor reads;
  - tests, including property tests over random valid configs.
- The `scene` PatternModule dispatches to the engine. `meaningFaults` asks the engine's `faults`.

**Tech Stack:** TypeScript, React 19 and SVG, framer-motion, Vitest. No new dependency for orbit or particles.

**Spec:** `docs/superpowers/specs/2026-10-26-learnspace-interactions-that-teach-design.md` (sections 2, 3 and 5)

## Global Constraints

- **The engine computes; the tutor names.** A config holds no expressions.
- **Every learner control works by mouse, touch and keyboard.** Reduced motion gets no transform animation.
- **No answer shows before the check.** In a task, the names of phases and states appear only after marking.
- **Faults are in words** a writer can act on.
- **Legacy prompt pins stay byte for byte.**
- **Gates:** the full suite and `tsc` pass before every commit.

## Review Focus

1. **Keyboard only.** Every task can be done with the keys alone; the Moon steps with arrows.
2. **Exactly between two phases** (22.5° off a quarter). Marking agrees with the picture the learner sees: the tolerance is inside the phase band.
3. **A config with a task already met at the start.** Expected: the engine starts elsewhere, or `faults` refuses it.
4. **A narrow phone (360 px).** The two views stack; nothing is clipped.
5. **Dark mode.** The lit and unlit sides of the Moon stay distinct (contrast of at least 3:1 between the lit and dark halves).

---

### Task 1: The contract, the registry and the `scene` pattern

**Files:**
- Create: `lib/studylab/scenes/types.ts`, `lib/studylab/scenes/registry.ts`, `lib/studylab/activities/patterns/scene.ts` and their tests.
- Create: `components/studylab/activities/SceneActivity.tsx`.
- Modify:
  - `lib/studylab/activities/types.ts`: `ActivityPattern` gains `'scene'`; add `ScenePayload`.
  - `lib/studylab/activities/registry.ts`
  - `components/studylab/activities/ActivityNode.tsx`: route `scene`.
  - `lib/studylab/activities/intent.ts` and its dimensions: a scene's intent has `apparatus: 'scene:<engine>'` and `isolates` from the engine.
  - `lib/studylab/meaning/index.ts`: ask the engine's faults.

**Interfaces:**
- Produces:
  ```ts
  export interface SceneEngine<C, S> {
    id: string
    covers: string[]
    isolates: TeachingIntent['isolates']
    parse(raw: unknown): C | null
    faults(config: C): string[]
    initial(config: C): S
    check(config: C, state: S): { ok: boolean; wrongIds: string[] }
    solve(config: C): S
    View: React.ComponentType<{ config: C; state: S; setState(next: S): void; marked: 'idle' | 'right' | 'wrong' | 'shown'; reduced: boolean }>
    prompt: string
  }
  export function getEngine(id: string): SceneEngine<unknown, unknown> | null
  export function sceneCatalogue(): string   // the SCENES block for the prompts
  ```

- [ ] **Step 1: Failing tests.**
  - `validateSpec` accepts `{ pattern: 'scene', payload: { engine: 'orbit', config }, success: { kind: 'scene' } }` and refuses an unknown engine or a config the engine cannot parse.
  - The `scene` PatternModule's `validate` is the engine's `check`.
  - `meaningFaults` returns the engine's faults.
  - A server render of `SceneActivity` with a stub engine shows the prompt and the engine's view.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** `success.kind: 'scene'` is added to `SuccessRule`; the engine decides success.
- [ ] **Step 4: Run.** Expected: PASS, full suite and `tsc` green.
- [ ] **Step 5: Commit.** `feat(learnspace): the scene engine contract`

### Task 2: Orbit, the Moon's phases

**Files:**
- Create: `lib/studylab/scenes/orbit/config.ts`, `orbit.test.ts`, `View.tsx` and `prompt.ts`.

**Interfaces:**
- Produces: the `orbit` engine.
  - Config: `{ task: { kind: 'make-phase', phase: PhaseName } | { kind: 'explore' } }`.
  - State: `{ moon: number }`, the Moon's angle in degrees from the Sun line, counter-clockwise, 0 = new moon.
  - `litFraction(moon) = (1 - cos(moon)) / 2`.
  - `phaseAt(moon)` names the eight phases by 45° bands.

**Behaviour:**
- **Top view:** sunlight from the left; Earth at the centre with its night side shaded; the Moon on its orbit with its Sun-facing half lit at every position.
- **Second view, "Seen from Earth":** the Moon's disc with the terminator drawn from the angle.
- **Controls:** drag the Moon round the orbit; or focus it and step with the arrow keys (15°), Home for new moon.
- **Marked** when the Moon is within ±15° of the asked phase's centre.
- **Names stay hidden:** the phase name of the current position shows only once the card is marked, or in explore.

- [ ] **Step 1: Failing tests.**
  - The lit fraction is 0 at new moon, 1 at full, and 0.5 at both quarters.
  - `phaseAt` gives the eight names on the band edges.
  - `faults` refuses an unknown phase name.
  - `initial` never starts within ±15° of the target. This is a property test over all eight phases.
  - `check` passes at the target ±15° and fails at ±16°.
  - `solve` passes `check`.
  - A server render of a make-phase card does not contain the target phase name anywhere except the prompt, and contains one focusable Moon with an aria-valuenow.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Steps 3–4.** Implement, then run. Expected: PASS.
- [ ] **Step 5: Look at it** on the bench and on a real Physics lesson ("Phases of the Moon"): drag and keys, light and dark, phone width, reduced motion. Read the screenshots.
- [ ] **Step 6: Commit.** `feat(learnspace): an orbit scene -- the Moon's phases, seen from above and from Earth`

### Task 3: The tutor writes scenes

**Files:**
- Modify:
  - `app/api/studylab/tutor/dispatch.ts`: `materialRules()` begins with the SCENES block from `sceneCatalogue()`.
  - the explore prompt in `app/api/studylab/stations/passes.ts`: prefer a scene whose `covers` names the idea.
  - `lib/studylab/stationBundle.ts`: no change needed (the `scene` pattern is an activity).
- Test: `passes.test.ts` (the explore prompt lists the orbit scene and its config) and `dispatch.intent.test.ts` (a scene with `apparatus 'scene:orbit'` and isolates `'position'` passes `checkIntent`).

- [ ] **Steps 1–5.** Run red, implement, run green, then commit `feat(learnspace): the tutor reaches for a scene when the idea is one`.

### Task 4: Particles

**Files:**
- Create: `lib/studylab/scenes/particles/*`.

**Behaviour:**
- **States of matter:** a box of particles, with a temperature control (and volume or pressure for gases). The engine computes:
  - spacing and arrangement (lattice, close-random, far-random);
  - mean speed, which goes as √T;
  - the state at the substance's melting and boiling points (water, iron, nitrogen, ethanol, wax, from a table).
- **Tasks:**
  - make the substance a liquid, or melt it;
  - predict what happens when it is heated;
  - diffusion: open the partition and watch, then predict.
- **Motion:** in a canvas, at 30 fps, paused under reduced motion (positions shown, no animation, with arrows for speed).

- [ ] **Step 1: Failing tests.**
  - States are right at the table's points.
  - `initial` is never in the asked state.
  - `check` follows the state.
  - Property: every substance and task combination is solvable within the control's range.
  - Render: the state name is not shown before marking.
- [ ] **Steps 2–6.** Run red, implement, run green; look at it on the bench and on a real Chemistry lesson ("States of matter"); commit `feat(learnspace): a particle scene -- states, heating and diffusion`.

### Task 5: The scenes held to the bar

**Files:**
- Create: `scripts/live/sceneEval.test.ts`.

**Behaviour:**
- Author 10 explores per scene, across lessons whose topic the scene `covers`, through the real passes.
- Score on the code dimensions: valid, solvable, not solved at the start, no self-answer.
- Score visually: render with Playwright and ask the vision model the four questions from the spec.
- **The bar:** at least 90% on every dimension before the scene is offered in live lessons.
- Record the numbers in the ledger.

- [ ] **Steps 1–3.** Run the eval; fix prompts or engines until it meets the bar; commit `test(learnspace): scenes held to the bar`.
