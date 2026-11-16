# Interactions that teach — design

**Date:** 2026-10-26 · **Status:** proposed, for the user's review
**Asked for:** "we need a solution for stuff like this in general … like brilliant's interactions are top notch"
**Builds on:** `2026-10-25-learnspace-redesign-design.md` (proposed as Phase 4b, before Phase 5's art pass)

## Why: two cards, one failure

**The immune card** ("Match each immune system component to its role") was an authored three-period naming card.
- A filter that strips pictures "off the step's topic" took the test-tube off *Antibody*.
- The card then drew the word "Antibody" where the picture belonged, so "What is this? **Antibody**" sat above a button reading *Antibody*.
- The station was served anyway: `keptAuthored` counts actions, not what the filter changed.
- The neuron stayed on *Memory cell* because a picture is kept when any word of it matches the step ("cell"), never the item.

**The Moon card** ("Drag the slider to move the Moon … watch which half is lit") was written live; the authored station had not finished.
- Its bar was the constant `50`, so it read 50% at every angle: the slider moved nothing.
- It counted as solved at 45° of *slider*, because a slider card's success is measured on the control, not on anything shown.
- Its picture, `globe`, is a Christmas bauble. The catalogue has no Moon, and the scene picture is never checked.
- Nothing on the server ever works a slider card's numbers out.
- The authored version that never got served used `50 + 50·cos(angle)`, which is full at 0°, the reverse of its own "0° is new moon".

**The general failure:** every gate we have checks *shape* (fields present, ids distinct, numbers in range), never *meaning*:
- whether the thing moves when the learner acts;
- whether it moves the way the idea says;
- whether it gives its own answer away;
- whether a picture shows what it labels.

A card can pass every gate and teach nothing, or teach the opposite.

The audit found the same holes elsewhere:
- **Solved before it is touched:** a slider whose target sits at its start; a balance authored already balanced; a material that is solved in zero moves.
- **Shows its own answer:** a three-period or labelled-diagram box headed with the answer's own name.
- **A control that drives nothing:**
  - an output that ignores the slider;
  - a plot whose slider is named `x`;
  - a bar pinned at its maximum;
  - a material display that only echoes the raw control.
- **A picture that doesn't show the item:** any picture field other than an item's `imageUrl` (scene, scenario, diagram, material art) is checked against the topic at best.

## What Brilliant does

- **Engines, not templates.** Each Brilliant game is an engine "driven by APIs designed for experts and LLMs", where "every possible configuration is guaranteed to be a correct, solvable, and meaningful puzzle" ([job post](https://jobs.lever.co/brilliant/2e86ce40-3c7e-4924-b3cb-bfe74b492353)).
  - Game types include circuits, gridworlds, mobiles (balance), order logic, equation tiles, logic grids and coding blocks; optics are in progress.
- **Representation beats model.** Changing what the LLM writes, not the model, took their gear puzzles from 0% to 93% correct in 48 hours ([Hand-crafted, machine-made](https://blog.brilliant.org/hand-crafted-machine-made/)).
- **Humans own the objective and the "aha"; AI implements.** Learning comes from acting and failing (the Super Mario pit), not from text. They chose not to build a chatbot tutor.
- **Evals before anyone sees it** ([When "almost right" is catastrophically wrong](https://blog.brilliant.org/when-almost-right-is-catastrophically-wrong-evals-for-ai-learning-games/)).
  - Every generated puzzle is scored on six dimensions: mathematical correctness, unique solvability, visual clarity (no overlaps), state consistency, impossible states, and physical plausibility.
  - Failures are filtered out before human review. They report 80–90% passes on foundational mobiles.
  - "Compiled correctly" puzzles were "visually unclear, or worse, completely unsolvable".
- **PhET's implicit scaffolding** ([Podolefsky et al.](https://arxiv.org/pdf/1306.6544)): guide through *which controls exist*, live feedback and the picture itself, not through instructions. One learning goal per sim.

## Principles

1. **The thing shows the idea.** Every interaction has something to watch that changes with what the learner does, the way the idea says it should.
2. **Every configuration the tutor can write is correct, solvable and meaningful.** The engine and its checks enforce this, not the prompt.
3. **The tutor writes meaning, not mechanics.** It writes "phases from position, target: first quarter", never a cosine. Engines compute.
4. **Nothing on screen answers the question before it is answered.**
5. **A picture shows its item, or it is not there.** An item that needs its picture is not served without it.
6. **Measured before it ships.** Each engine has an eval across real topics and must reach ≥ 90% on every dimension before the tutor may choose it. A failure never reaches a learner.

## The design

### 1. Meaning gates, on everything we have now

A pure module, `lib/studylab/meaning/`, runs wherever an interaction is accepted:
- the authoring passes (`checkExplore`, `checkPracticeCheck`);
- live dispatch (`refuseUnjustifiedActivities`, `build_material`);
- `keptAuthored`, again *after* pictures are stripped.

Like `questionFault`, each check returns its fault in words, so the pass that wrote it can write it again.

- **Responds.** Work out every slider output (bars, readouts, tank, plot) at nine or more points across the control's range.
  - Refuse an output that never changes, a bar that never moves visibly (span under 5% of its maximum), or one pinned at its top or bottom.
  - For materials: every display must depend on a control and must not echo the raw control.
- **Not solved at the start.** Refuse when the starting state already meets the success rule (slider, balance, any material at zero moves).
- **Success on what is shown.** A slider card's success targets a reading, not the slider's own value.
- **Right direction.** When the relationship names points ("0° is new moon", "doubling the force doubles the acceleration"), the model is evaluated at them and must agree.
- **No self-answer.**
  - Every three-period or label item has a picture that resolves.
  - No box is headed with a piece's own name.
  - The naming phases never print the item's name.
- **The picture shows the item.** Each picture is matched against its *item's* label, not the step's topic. The scene, scenario and diagram pictures are checked too.
  - An unmatched picture is removed.
  - If the pattern needs it, the item is refused.
  - A card left with fewer than three named items is refused whole.
- **Re-checked after changes.** A station whose items the strip changed is checked again. If it now fails, it goes back for a rewrite instead of being served.
- **Live fallback.** A live interaction that fails is replaced by a predict card (the path already exists), never served broken.

### 2. Scenes: purpose-built engines for the ideas the syllabus keeps teaching

A scene is an engine, like Brilliant's game types. It draws its own SVG, so it does not depend on the picture catalogue.

```ts
interface SceneEngine<Config, State> {
  id: string                                   // 'orbit'
  covers: string[]                             // the syllabus ideas it teaches, for the tutor's catalogue
  configSchema: Schema<Config>                 // small and semantic: what the tutor writes
  faults(config: Config): string[]             // in words a pass can fix
  initial(config: Config): State
  observe(config: Config, state: State): Observed   // what the learner sees, computed, never written by the model
  check(config: Config, state: State): { solved: boolean; wrong?: string[] }
  solve(config: Config): State                 // proves it can be solved; drives "show me"
  View: React.ComponentType<SceneProps<Config, State>>  // mouse, touch, keyboard; reduced motion; answer shown by the thing
}
```

**The guarantee:** `faults(config)` empty means the scene is solvable, not solved at the start, and what is shown responds to every control. Each engine's tests prove this with property tests over random valid configs, and its golden configs are screenshotted.

**First wave.** Chosen by how often the Cambridge syllabus teaches the idea, and how badly a slider and a bar show it:

| Scene | Shows | The learner | Task kinds the tutor picks |
|---|---|---|---|
| **orbit** | Sun, Earth and Moon from above, beside the Moon as seen from Earth; day and night; tilt and seasons; eclipses | drags the Moon or Earth round, tilts the axis | make a phase; name the phase at a position; predict an eclipse |
| **particles** | solid, liquid and gas; heating; diffusion; pressure in a box | moves temperature or volume, adds particles | reach a state; predict spread; explain pressure |
| **circuit** | cells, bulbs, switches, resistors; ammeter and voltmeter readings | builds and rewires series and parallel | light both bulbs; make the reading X; find the fault |
| **forces** | arrows on an object; resultant; motion | adds and resizes forces | balance it; make it speed up left; find the missing force |
| **light** | rays at mirrors, boundaries and lenses; angles read live | turns mirrors, moves the ray | hit the target; measure reflection or refraction |
| **food web** | organisms joined by energy arrows | draws arrows, removes a species | build the chain; predict what grows or shrinks |
| **number line and fractions** | jumps, places, fraction bars, area models | drags, splits, shades | place 3/4; make equal fractions; jump to the total |
| **coordinate plane** | points, lines, gradient and intercept | drags points and lines | make y = 2x + 1; find where they meet |
| **atom** | shells, electrons, ions, simple bonding | adds and moves electrons | build sodium; make the ion; share a pair |
| **body flow** | our mapped diagrams, with a path through them (blood, food, air, nerve) | traces the path part by part | trace blood from the lungs to the body |

Later: geography map scenes (rivers, plates, climate graphs), probability spinners and dice, balancing equations, and code blocks. The existing sort, sequence, balance, label and tap stay, behind the gates.

### 3. What the tutor writes

The tutor is shown a **SCENES** catalogue first. For each scene it gets:
- what the scene covers;
- its config fields;
- two worked examples.

The tutor is told to use a scene whenever the idea is in its covers. The generic patterns remain for what no scene covers, under the gates.

The config is semantic:
```json
{ "scene": "orbit", "show": ["top-view", "from-earth"], "task": { "kind": "make-phase", "phase": "first-quarter" } }
```
The engine works out where the lit half is, what Earth sees, and whether the learner got there. A fault comes back in words ("first-quarter needs the Moon a quarter of the way round from new moon; set `start` elsewhere") for the pass to fix. This is the Brilliant lesson: change the representation, not the model.

### 4. Pictures

- **Engines draw their own.** Pictures are used only where a picture *is* the point: naming, labelling, a real photo of a place.
- **Every picture is checked against its item.**
- **Gaps** (no Moon, no immune cells) are filled from two places, each checked by a vision model ("does this show *X*?") before it joins the catalogue:
  - the figure library (374k approved figures);
  - the Phase 5 house-style art.
- **Kenney skins (Phase 4, Task 9)** are cartoon vehicles, food and animals. They cannot show an antibody or a phase of the Moon. I propose to cut Task 9 or keep it only for maths counters.

### 5. Evals, as Brilliant runs them

`scripts/live/sceneEvals.test.ts` authors 20 items per scene and per pattern across real lesson topics, through the real passes.

**Scored in code:**
- valid;
- solvable;
- not solved at the start;
- responds;
- direction;
- unique where the task needs it;
- no self-answer;
- picture matched.

**Scored by eye.** A headless browser renders each item, and a vision model (Claude on Bedrock) answers four yes/no questions:
1. Is any answer visible before acting?
2. Does each picture show its label?
3. Does anything overlap or clip?
4. Does the thing visibly change between two control positions? (two screenshots)

**The bar:** at least 90% on every dimension before a scene is offered to the tutor. In service, the code checks run on every item, and the vision check runs in the authoring verify pass. A failure is rewritten, never served.

**Cost:** authoring is cents per station; a vision check is about a cent.

### 6. Rollout (each part ships on its own)

- **A. Meaning gates on what exists.** One plan, about a week. Stops both cards and the whole class of them, with the evals harness scoring the existing patterns as the baseline.
- **B. The engine contract and the first two scenes** (orbit and particles), the SCENES catalogue in the prompt, and their evals.
- **C. The rest of the first wave,** two scenes at a time, each one live only after it meets the bar.
- **D. The vision check in the authoring verify pass.**

### 7. Every kind of idea gets its engine, gaps filled like the figure library

The user (2026-10-26): "we really need to look at all kinds of interactions, all kinds of engines … like how we were doing the image thing, so all gaps are filled … we need to ensure the best quality".

So coverage is run the way the figure library was:

- **Taxonomy.** Every engine type the subjects need (40–60), drawn from:
  - PhET's full catalogue, by subject;
  - Brilliant's game types;
  - Desmos and GeoGebra;
  - Montessori materials.

  Ideas no simulation serves (history narratives, source work) get the interactions that do serve them: timelines, source comparison, cause-and-consequence chains, card sorts.
- **Coverage map.** Every curriculum topic in the database is classified, once, by the engine that shows its central idea best (Sonnet on Bedrock, a few dollars for all of them), the way P0 mapped figure concepts. Topics with no fitting engine are the gaps.
- **Waves.** Engines are built in waves of four to six, one writer agent per engine, each with its contract, property tests, golden screenshots and the eval bar, like figure families. A wave ships only when every engine in it meets the bar.
- **Report.** The coverage report (topics covered, by subject) is published after each wave, as the figure library's was.

**The map (built 2026-10-26).**
- **Scope:** 2,960 in-scope topics, classified once with Sonnet ($5.61), against 64 engines: 56 scenes, 7 structured interactions and the fill/order/tap fallback.
- **Coverage:** 87% have an interaction that fits, 55% of them a scene.
- **By subject:**
  - Science and maths are at 95–98%.
  - Computing is at 76%.
  - Accounting is at 48%. Its gap is a double-entry ledger workbench (50 topics), the largest buildable gap.
  - Art is low priority.
- **The build order follows the map, not the first guess.** Topics are weighted towards secondary science and maths, and towards ideas today's cards show worst:
  - orbit, particles (built);
  - then bonding, cause-chain, coordinate-plane, lab-bench, business-finance, body-flow, algorithm-tracer, measure-shape, counters-place-value, magnetism, supply-demand, atom, algebra-tiles, food-web, stats-explorer.
  - forces, circuit and light fall lower: each owns few topics.
- **Wave 1 (writer agents, one engine each):** bonding, atom, coordinate-plane, body-flow, cause-chain, lab-bench.
- **Files:** the map and report are in the session scratchpad `coverage/`.

**Where it stands (2026-10-27).**
- **Fourteen scenes are offered to the tutor:**
  - orbit, particles, atom, bonding, coordinate-plane, lab-bench, body-flow and cause-chain;
  - food-web, supply-demand, business-finance (break-even), ledger, algebra-tiles and counters-place-value.
- **Each scene is held to the eval's bar.** Every scene with five or more items meets 90% on every dimension; a scene's uptake (how often the writer chose it) is reported apart.
- **The eval earned its place.** It caught what no unit test could see:
  - answers printed before marking (the coordinate plane's "rise 1, run 2" and its live equation);
  - a mislabelled airway;
  - particles clipped by their box;
  - words broken mid-word.
- **Each fix is pinned by a test of its own:** labels nearer their own part than any other, still frames that keep things inside and apart, text never under 12px nor split.
- **Wave 3 is being written:** algorithm-tracer, measure-shape, magnetism, stats-explorer, geometry-construction and forces. Next by the map: rates-equilibrium, motion, calculus-grapher, cell-lab, circuit, map-reader, timeline.
- **How a scene reaches a prompt.** A station's prompt carries only the catalogue entries near its idea (a topic word or its plural, generic words ignored); at sixty engines, every entry in every prompt would not fit. A scene can refuse a prompt that gives away what it hides (`promptFaults`).
- **Real lessons pick scenes unprompted:**
  - a heart lesson opened on the body-flow scene, then a ruled sequence;
  - a linear-equations lesson opened on algebra tiles.

### 8. The lesson screen, rebuilt Brilliant-style (user, 2026-10-26)

**One pace.** "Run ahead" and the pace choice go. Every lesson is step by step.
- New lessons default to `step`.
- A stored run at `run` pace is moved to `step` when it loads.
- The pace radios leave the plan card, and the toggle leaves the screen.

**A top bar replaces the left rail.**
- ✕ on the left, back to all LearnSpaces.
- One wide progress bar across the middle, a segment per station:
  - finished stations are filled, with a tick;
  - the station being taught fills by its four stages;
  - later stations are empty.
- One control opens the steps: a "2 / 5 ▾" button beside the bar (clicking the bar opens it too). It drops down a list of every station, each with:
  - its status (✓ done, ● now, ○ later);
  - its stage pips if current;
  - Go to, or Skip ahead / Test out;
  - why a locked one can't be skipped.
- No "You already know / Start here / Later" sections: the ticks already say it.
- Homework's "Add another page" moves into the dropdown.
- The bar is keyboard-operable: Escape closes the list and focus returns to the button.

**The chat moves to the left and grows.** It is 440 px wide, the board narrows beside it, and on a phone it stays a sheet. Messages before the latest exchange fade, Brilliant-style:
- they drop to 70% opacity, which still passes 4.5:1, and lose their fill;
- the scroll area fades out at its top edge;
- the tutor's newest reply is lit in the subject colour.

**The planning phase, simplified.** A calm, centred opening with one obvious action:
- the subject chip;
- the lesson title, large;
- "5 steps · about 20 minutes";
- the stations as a clean numbered path of titles (no goals, no section labels; a measured weak step keeps its "You scored 40%" note);
- the tutor's question, if it has one, as a single line with an answer box beneath it;
- one big **Start** button;
- a quiet "Change the plan" link that opens "Shorter", "Deeper", "I know the basics" and a box to write in.

## Non-goals

- Hand-authoring lessons. The tutor still writes every lesson; scenes give it better things to write with.
- Embedding PhET. Its sims are CC BY with attribution, generic rather than tailored, and heavy in a canvas card. Its design principles are taken, not its code.
- A general physics engine. Each scene computes only its own idea.

## Calls I made

- Gates first (A), before any new scene: they stop the broken cards this week, and they score every later scene too.
- Scenes draw their own SVG, so the picture catalogue stops being the weak point.
- The 90% bar and the dimensions follow Brilliant's published practice.

## Decided (user, 2026-10-26: "do what you recommend even if it costs a bit")

1. **Scene order:** as proposed — orbit, particles, circuit, forces, light, food web, number line, coordinate plane, atom, body flow — then the waves the coverage map calls for.
2. **Kenney skins:** cut. Phase 4 Task 9 is dropped, because engines draw their own visuals.
3. **The vision check** runs on every authored item.
4. **Order of work:**
   - the lesson-screen rebuild (section 8) first;
   - then the meaning gates (A);
   - then the taxonomy and coverage map;
   - then the scene waves.
