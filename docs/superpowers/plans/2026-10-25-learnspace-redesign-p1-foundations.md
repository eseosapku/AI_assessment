# LearnSpace Redesign — Phase 1: Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every answerable thing in LearnSpace the same finished feel: one check flow with two tries while learning and one in tests, corner badges, gentle motion and sound, Inky the tutor, subject colours and tap-to-define terms.

**Architecture:**
- The logic lives in pure modules under `lib/studylab/` (`checkFlow`, `subjectFamily`, `motionPresets`, `sound`, `glossary`), unit-tested in Vitest.
- Presentation lives in new components under `components/studylab/check/` and `components/studylab/inky/`.
- The existing nodes (`QuizNode`, `PracticeNode`, `ActivityFrame` and through it every activity and material) adopt them.
- Saved data stays backward-compatible: new fields are optional, and old cells and questions render as before.

**Tech Stack:** Next.js (repo version; read `node_modules/next/dist/docs/` before touching routing), React, Tailwind with the `ss-*` tokens, framer-motion 11, @xyflow/react 12, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-25-learnspace-redesign-design.md`, sections *Principles*, *Visual identity*, *Motion and sound*, *Checks and interactions*, *Assets*.

## Global Constraints

- Motion 150–300 ms per state change, every animation with a reduced-motion variant (fade or none). Never blocks input.
- Learning = two tries, amber, never red, no points lost. Testing (hard checkpoints and test-out) = one try, red "Incorrect", answer revealed, Why? primary until opened.
- MCQ and match stay server-marked through `run.openCheck.questions`. `app/api/studylab/grade/route.ts`, `snap/route.ts` and `lib/textbook-vision-images.ts` are frozen. Call the grade route, never edit it.
- Colour is never the only signal: every right/wrong state carries an icon and text.
- Sound and voice are behind one mute, remembered per learner (localStorage key `ss-sound`), no audio before the first user gesture.
- Data changes are additive and optional (`attempts?`, `optionFeedback?`); old saved canvases must load unchanged.
- Vendored assets are CC0 only, each pack recorded in `public/sounds/LICENSES.md` with its source URL.
- Every commit: `npx vitest run` green and `npx tsc --noEmit -p .` clean. `npm run lint` is broken project-wide and is not a gate.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never stage `scripts/build_checkpoint_figure_bank.py`, `scripts/textbook-figure-raw.ts`, `data/audit/paper-style.json`, or anything under `scripts/figgen/` (another workstream).

## Review Focus

1. **The grade route failing during a retry** (network, 5xx, unparsable reply → `readGradeReply` gives `ungraded`) must not use up a try. The learner stays at the same attempt and sees "Couldn't mark that — try again."
2. **A reload mid-retry** must come back at the same attempt with the same feedback showing. Attempts are persisted on the cell, not in component state.
3. **Old saved data:**
   - quiz cells without `attempts`;
   - MCQs without `optionFeedback`;
   - practice cells without `attempts`;
   - an activity solved before this change.

   All must render and behave sensibly (attempts read as 0, a generic nudge instead of option feedback).
4. **Reduced motion and autoplay:**
   - with `prefers-reduced-motion`, no pop, shake or stagger runs;
   - no sound plays before the learner's first click on the page;
   - mute survives a reload.
5. **Keyboard only:** options reachable by Tab, chosen with Space/Enter, Check by Enter, focus kept on the card (not lost to `body`) after each state change, and the result announced through `aria-live`.

---

### Task 1: Subject families, lesson tokens, pressable controls

**Files:**
- Create: `lib/studylab/subjectFamily.ts`, `lib/studylab/subjectFamily.test.ts`
- Modify: `app/globals.css` (add `--subject*` defaults under the `ss-*` block and in `.dark`; add `.ss-press` utility), `tailwind.config.js` (colours `ss-subject`, `ss-subject-soft`, `ss-subject-ink`)
- Modify: `components/studylab/Workspace.tsx` and `components/studylab/DemoWorkspace.tsx`. On the root `div`, set `style={subjectStyle(space.subject ?? space.title)}`.

**Interfaces:**
- Produces:
  - `type FamilyName = 'number'|'matter'|'life'|'world'|'code'|'data'|'words'|'time'|'craft'`;
  - `interface SubjectFamily { name: FamilyName; label: string; light: { accent: string; soft: string; ink: string }; dark: { accent: string; soft: string; ink: string } }`;
  - `familyFor(subjectOrTitle: string | null | undefined): SubjectFamily`;
  - `subjectStyle(subjectOrTitle): React.CSSProperties`, which sets `--subject`, `--subject-soft` and `--subject-ink` for light, plus `--subject-dark`, `--subject-soft-dark` and `--subject-ink-dark` consumed by `.dark`.

- [ ] **Step 1: Write failing tests** in `subjectFamily.test.ts`:
  - `familyFor('Mathematics').name === 'number'`, `familyFor('Further Mathematics')` → number, `familyFor('Statistics')` → number;
  - `familyFor('Physics')`, `familyFor('Chemistry')` → matter;
  - `familyFor('Biology')`, `familyFor('Integrated Science')`, `familyFor('Primary Science')` → life;
  - `familyFor('Geography')`, `familyFor('Environmental Management')` → world;
  - `familyFor('Computer Science')`, `familyFor('ICT')`, `familyFor('Computing')` → code;
  - `familyFor('Economics')`, `familyFor('Business Studies')`, `familyFor('Accounting')` → data;
  - `familyFor('English Language')`, `familyFor('Kinyarwanda')`, `familyFor('French')` → words;
  - `familyFor('History')`, `familyFor('Social Studies')`, `familyFor('Civics')` → time;
  - `familyFor('Art and Design')`, `familyFor(null)`, `familyFor('')` → craft (the fallback);
  - every family's light `accent` on `#FFFFFF` and dark `accent` on `#161B21` reach a contrast ratio ≥ 3:1 (write `contrastRatio(hexA, hexB)` in the test file).
- [ ] **Step 2: Run** `npx vitest run lib/studylab/subjectFamily.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement** `subjectFamily.ts`.
  - Matching is lower-cased keyword lists, tried in the order the spec's table lists them. The first hit wins.
  - Hues per the spec: number blue, matter gold, life teal-green, world green, code purple, data orange, words rose, time indigo, craft slate.
  - Pick light/dark hex values that pass the contrast test.
  - `globals.css`: `.dark` swaps `--subject` to `var(--subject-dark)` (and the same for soft and ink).
  - `.ss-press`: `box-shadow: 0 3px 0 0 color-mix(in srgb, currentColor 22%, transparent); transition: transform 120ms, box-shadow 120ms;` with `:active { transform: translateY(2px); box-shadow: 0 1px 0 0 … }`, and none of that under `prefers-reduced-motion: reduce`.
- [ ] **Step 4: Run** the test file. Expected: PASS. Run `npx tsc --noEmit -p .`. Expected: clean.
- [ ] **Step 5: Commit** `feat(learnspace): subject families -- each lesson takes its subject's accent; pressable control utility`.

### Task 2: Motion presets

**Files:**
- Create: `lib/studylab/motionPresets.ts`, `lib/studylab/motionPresets.test.ts`
- Keep: `lib/studylab/activities/motion.ts` (`prefersReducedMotion`, `shakeElement`). Re-export `prefersReducedMotion` from the new module rather than duplicating it.

**Interfaces:**
- Produces:
  - `const MOTION = { pop, rise, settle, stagger, shakeSoft, glow, dim, fly }`. Each is a framer-motion `{ initial, animate, exit?, transition }` object.
  - `motionFor(name: keyof typeof MOTION, reduced: boolean)`, which returns the preset, or under reduced motion an opacity-only version with `duration ≤ 0.15`, or no transform at all.
  - `countUpValue(from: number, to: number, t: number): number`, eased (easeOutCubic), clamped to `t ∈ [0,1]`, rounded to an integer.
  - `useCountUp(to: number, opts?: { from?: number; ms?: number }): number`, a hook that drives `countUpValue` with `requestAnimationFrame`, and under reduced motion returns `to` at once.

- [ ] **Step 1: Write failing tests:**
  - every preset's `transition.duration` (or the sum with delay) is ≤ 0.3, except none;
  - `motionFor(x, true)` never contains `x`, `y`, `scale` or `rotate` keys in `initial`/`animate`;
  - `countUpValue(0, 95, 0) === 0`, `countUpValue(0, 95, 1) === 95`, `countUpValue(0, 95, 0.5)` is between 60 and 95 (eased);
  - out-of-range `t` is clamped.
- [ ] **Step 2: Run** `npx vitest run lib/studylab/motionPresets.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Values:
  - `pop`: scale 0.6 → 1, spring, about 0.22 s;
  - `rise`: y 8 → 0 with opacity, 0.2 s;
  - `settle`: scale 1.08 → 1, 0.25 s;
  - `stagger`: children delay 0.05;
  - `shakeSoft`: x [0, -6, 6, -4, 4, 0], 0.28 s;
  - `glow`: a boxShadow pulse using `var(--subject)`, 0.3 s;
  - `dim`: opacity 1 → 0.35, 0.25 s;
  - `fly`: y 0 → -24 with opacity 1 → 0, 0.3 s.
- [ ] **Step 4: Run.** Expected: PASS. Then `tsc` clean.
- [ ] **Step 5: Commit** `feat(learnspace): one motion vocabulary with reduced-motion variants and a count-up`.

### Task 3: Sound — vendored CC0 effects and one mute

**Files:**
- Create:
  - `public/sounds/correct.mp3`, `wrong.mp3`, `tap.mp3`, `drop.mp3`, `complete.mp3`, `lesson-complete.mp3`;
  - `public/sounds/LICENSES.md`;
  - `lib/studylab/sound.ts`, `lib/studylab/sound.test.ts`.

**Interfaces:**
- Produces:
  - `type SoundName = 'correct'|'wrong'|'tap'|'drop'|'complete'|'lessonComplete'`;
  - `isMuted(): boolean`, `setMuted(m: boolean): void` (localStorage `ss-sound` = `'off'|'on'`, default on; reads guarded for SSR and blocked storage);
  - `playSound(name: SoundName): void`. A no-op when muted, before the first user gesture (the module listens once for `pointerdown`/`keydown` on `window` to unlock), or under SSR. One preloaded `HTMLAudioElement` per name, volume 0.5. Errors are swallowed.
  - `useMuted(): [boolean, (m: boolean) => void]`, which re-renders on change (a module-level subscriber set).

- [ ] **Step 1: Source the sounds.**
  - Download Kenney "Interface Sounds" (CC0) from its kenney.nl asset page into a fresh empty directory in the scratchpad. It is untrusted data: never execute anything from it.
  - Pick six short clips: confirmation for correct, a soft error for wrong, a click for tap, a drop, a short rising set for complete, the longest pleasant one for lesson complete.
  - Convert to mono MP3 at 96 kbps and normalise to -16 LUFS with ffmpeg (`loudnorm`). Each file must be under 40 KB.
  - Write `LICENSES.md` with the pack name, the source URL, "CC0 1.0", the download date, and the source file each output came from.
- [ ] **Step 2: Write failing tests** in a jsdom-free style. Mock `window` and `localStorage` objects on `globalThis` in the test:
  - `isMuted()` is false by default; `setMuted(true)` → `isMuted()` true and storage `'off'`;
  - `playSound` before an unlock gesture does not call `Audio.prototype.play`;
  - after a simulated `pointerdown`, it does, unless muted;
  - a throwing `localStorage` leaves `isMuted()` false and does not throw.
- [ ] **Step 3: Run** `npx vitest run lib/studylab/sound.test.ts`. Expected: FAIL.
- [ ] **Step 4: Implement** `sound.ts`.
- [ ] **Step 5: Run.** Expected: PASS. Then `tsc` clean.
- [ ] **Step 6: Commit** `feat(learnspace): six CC0 interface sounds behind one remembered mute`.

### Task 4: Inky, the tutor character

**Files:**
- Create: `components/studylab/inky/Inky.tsx`, `lib/studylab/inkyMood.ts`, `lib/studylab/inkyMood.test.ts`
- Modify: `components/studylab/ChatMouthpiece.tsx`. The header's brain icon and "AI Study Assistant" title become `<Inky size={28} mood=…/>` and the title "Inky". The subtitle stays the existing tutor subtitle. Add a sound/voice mute toggle (`useMuted`) to the header.

**Interfaces:**
- Produces:
  - `type InkyMood = 'idle'|'looking'|'talking'|'thinking'|'happy'|'concerned'|'celebrating'`;
  - `<Inky size?: number; mood?: InkyMood; className?: string; title?: string />`, an inline SVG;
  - `moodForCheck(phase: CheckPhase): InkyMood`. It maps `correct` → happy, `retry`/`wrong` → concerned, `checking` → thinking, `revealed` → looking, else idle.
- Consumes: `CheckPhase` from Task 5. Define `moodForCheck` in Task 5's commit if Task 4 lands first. Otherwise this task imports it.

- [ ] **Step 1: Draw Inky.**
  - An ink drop in a 64×64 viewBox: a body path with a vertical gradient from `var(--ss-accent-bright)` to `var(--ss-accent-deep)`; a highlight arc; two eyes as white ellipses with dark pupils; a mouth path.
  - Moods change only pupils, lids and mouth:
    - `happy`: closed-arc eyes and a smile;
    - `concerned`: lowered brows and a flat mouth;
    - `thinking`: pupils up-left;
    - `celebrating`: happy with a little hop;
    - `talking`: mouth open/close.
  - Idle blink: lids scaleY 1 → 0.1 → 1 every 3.5–5 s (random), framer-motion.
  - Talking: the mouth alternates at 0.18 s.
  - Celebrating: y 0 → -6 → 0, twice.
  - All motion goes through `motionFor`, and is static under reduced motion.
  - `role="img"` and `aria-label` = `title ?? 'Inky, your tutor'`.
- [ ] **Step 2: Write failing tests** for `moodForCheck` (each phase → mood as above).
- [ ] **Step 3: Implement** and run `npx vitest run lib/studylab/inkyMood.test.ts`. Expected: PASS.
- [ ] **Step 4: Swap the chat header** and add the mute toggle (the `Volume2`/`VolumeX` icon, `aria-pressed`).
- [ ] **Step 5:** `tsc` clean. Full `npx vitest run` green.
- [ ] **Step 6: Commit** `feat(learnspace): Inky, the tutor -- an ink-drop character with moods; header mute`.

### Task 5: The check flow (pure state machine and data fields)

**Files:**
- Create: `lib/studylab/checkFlow.ts`, `lib/studylab/checkFlow.test.ts`
- Modify:
  - `lib/studylab/types.ts`: the `mcq` variant gains `optionFeedback?: string[]`; `QuizCell` gains `attempts?: number`;
  - `lib/studylab/practice.ts`: `PracticeCell` gains `attempts?: number`;
  - `lib/studylab/activities/types.ts`: `ActivityState` gains `attempts?: number` if absent; the material state already has `attempts`;
  - `lib/studylab/quiz.ts`: `isValidQuestion` accepts and `coerceQuestion` keeps `optionFeedback` when it is a string array of the same length as `options`, and drops it otherwise.
- Modify: `app/api/studylab/tutor/system-prompt.ts`. In the checkpoint MCQ shape, add `"optionFeedback":["<why this option is wrong, or right>", …]`, one per option, written for a learner who chose it. Add one line saying it is optional but expected.

**Interfaces:**
- Produces:
  - `type CheckMode = 'learn' | 'test'`;
  - `type CheckPhase = 'idle'|'ready'|'checking'|'correct'|'retry'|'wrong'|'revealed'`;
  - `interface CheckFlowState { mode: CheckMode; phase: CheckPhase; attempts: number; message?: string }`;
  - `type CheckEvent = { type: 'answer'; present: boolean } | { type: 'check' } | { type: 'result'; verdict: 'correct'|'incorrect'|'ungraded'; message?: string } | { type: 'tryAgain' } | { type: 'reveal' }`;
  - `checkFlow(state: CheckFlowState, event: CheckEvent): CheckFlowState`;
  - `initialCheckFlow(mode: CheckMode, saved?: { attempts?: number; settled?: 'correct'|'incorrect'; revealed?: boolean }): CheckFlowState`;
  - `modeForGate(gate: 'hard'|'soft'|undefined, kind?: 'checkpoint'|'testout'): CheckMode`, where hard or testout → test, else learn;
  - `const MAX_LEARN_TRIES = 2`;
  - `feedbackFor(q: CheckpointQuestion, given: unknown, verdict: 'correct'|'incorrect'): string | undefined`. For an MCQ it returns `optionFeedback[given]` when present. Otherwise it returns `explain` when the answer is final, or undefined on a first learn miss.

- [ ] **Step 1: Write failing tests** for `checkFlow`:
  - learn: answer(true) → ready; check → checking; result(incorrect) → retry with attempts 1; tryAgain → ready; check → result(incorrect) → wrong with attempts 2; reveal → revealed;
  - learn: result(correct) on attempt 1 or 2 → correct;
  - test: result(incorrect) on the first try → wrong (attempts 1), and reveal is allowed at once;
  - `result(ungraded)` from checking → back to ready, attempts unchanged, message set (Review Focus 1);
  - `answer(false)` from ready → idle; `check` from idle is ignored (state unchanged);
  - events in a settled phase (correct, wrong, revealed) are ignored except reveal from wrong;
  - `initialCheckFlow('learn', { attempts: 1 })` → phase `retry`, attempts 1 (Review Focus 2); `initialCheckFlow('test', { settled: 'incorrect' })` → wrong;
  - `modeForGate('hard')` → test, `('soft')` → learn, `(undefined, 'testout')` → test;
  - `feedbackFor` with and without `optionFeedback` (Review Focus 3);
  - `coerceQuestion` keeps a valid `optionFeedback` and drops a wrong-length one.
- [ ] **Step 2: Run** `npx vitest run lib/studylab/checkFlow.test.ts lib/studylab/quiz.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS. Full suite green. `tsc` clean. The `route.test.ts` prompt snapshots may need the new MCQ shape line; update only the expected text that this task changed.
- [ ] **Step 5: Commit** `feat(learnspace): one check flow -- two tries while learning, one in tests, per-option feedback`.

### Task 6: CheckBar, result badges and the Inky line

**Files:**
- Create: `components/studylab/check/CheckBar.tsx`, `components/studylab/check/ResultBadge.tsx`, `components/studylab/check/InkyLine.tsx`, `components/studylab/check/useCheckFlow.ts`
- Test: `lib/studylab/checkBarModel.ts` + `checkBarModel.test.ts`. A pure function decides the buttons, so it can be tested without a DOM.

**Interfaces:**
- Consumes: `checkFlow`, `CheckFlowState`, `CheckMode`, `MAX_LEARN_TRIES` (Task 5); `MOTION`/`motionFor` (Task 2); `playSound` (Task 3); `Inky`, `moodForCheck` (Task 4).
- Produces:
  - `barModel(state: CheckFlowState, opts: { canReveal: boolean; hasWhy: boolean; whyOpened: boolean; hasHelp: boolean; continueLabel?: string }): { tone: 'neutral'|'good'|'warn'|'bad'; primary: BarButton; secondary?: BarButton; line?: string }`, where `type BarButton = { action: 'check'|'tryAgain'|'getHelp'|'reveal'|'why'|'continue'; label: string; disabled?: boolean }`;
  - `useCheckFlow(mode, saved, onPersist: (s: CheckFlowState) => void)`. It returns `{ state, dispatch }`, persists on every change, and plays `correct`/`wrong` sounds on result transitions;
  - `<CheckBar state opts onAction(action) />`, rendered inline at the card's foot in Phase 1 (Phase 2 docks it);
  - `<ResultBadge kind="correct"|"wrong"|"answer" />`, an absolute top-right badge with the `pop` motion;
  - `<InkyLine mood text />`, a small Inky plus the line, `aria-live="polite"`.

- [ ] **Step 1: Write failing tests for `barModel`:**
  - idle → primary `check` disabled, tone neutral;
  - ready → `check` enabled;
  - correct → tone good, primary `continue` (label default "Continue"), secondary `why` when hasWhy;
  - learn retry → tone warn, primary `tryAgain`, secondary `getHelp` when hasHelp, else `reveal` when canReveal;
  - learn wrong (attempts 2) → tone warn, primary `getHelp` when hasHelp, else `reveal`, secondary `tryAgain`;
  - test wrong → tone bad, primary `why` while not whyOpened, then primary `continue` with `why` secondary once whyOpened;
  - revealed → primary `continue`;
  - the line copy: correct → one of "That's it.", "Yes.", "Right."; learn retry → "Not quite — have another go."; test wrong → "Incorrect".
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement `barModel`, then the components.**
  - `CheckBar` buttons use `.ss-press`, at least 44 px tall.
  - Primary fill by tone: good `var(--ss-good)`, warn `var(--ss-warn)`, bad is the ink-dark neutral (as on Brilliant), neutral `var(--subject)`.
  - The card border reflects the tone. The caller reads `barModel(...).tone`.
- [ ] **Step 4: Run tests.** Expected: PASS. `tsc` clean.
- [ ] **Step 5: Commit** `feat(learnspace): CheckBar, corner badges and Inky's line -- one feedback system for every card`.

### Task 7: Checkpoint questions on the new flow

**Files:**
- Modify: `components/studylab/QuizNode.tsx`

**Interfaces:**
- Consumes:
  - `useCheckFlow`, `CheckBar`, `ResultBadge`, `InkyLine` (Task 6);
  - `modeForGate`, `feedbackFor` (Task 5);
  - existing `gradeMcq`, `gradeMatch`, `useGrade`/`readGradeReply`.

- [ ] **Step 1: MCQ.**
  - Clicking an option *selects* it (no instant marking) and dispatches `answer(true)`. Check marks it with `gradeMcq`.
  - After any result, the chosen option keeps full opacity and the others drop to 0.45. A `ResultBadge` sits on the chosen option (✓ or ✕), and in test-wrong/revealed a grey `answer` badge sits on the correct one.
  - `feedbackFor` text is shown in the `InkyLine`.
- [ ] **Step 2: Short and code.**
  - Check calls the grade route as today. `ungraded` → `result(ungraded)` with "Couldn't mark that — try again."
  - In learn mode an incorrect answer gives a retry with the route's feedback.
- [ ] **Step 3: Match.** Same select-then-check shape. Rows are marked individually after Check (✓ / ✕ per row).
- [ ] **Step 4: Persistence.**
  - The cell stores `state` ('unanswered' during retry, `correct`/`incorrect` only when final), `attempts` and `feedback`, so `summarizeCheckpoints` and the server's `markCheck` see exactly what they saw before: a cell settles only when final.
  - Restore through `initialCheckFlow`.
- [ ] **Step 5: Keyboard.** Options are buttons in a `role="radiogroup"`, arrow keys move between them, and Enter triggers Check when ready. Focus returns to the CheckBar's primary button after a result.
- [ ] **Step 6: Verify.**
  - `npx vitest run` is green; in particular `checkpointState*`, `quiz.test.ts` and the `route.test.ts` checkpoint cases still pass.
  - `tsc` clean.
- [ ] **Step 7: Commit** `feat(learnspace): checkpoint questions select-then-check, two tries in soft checks, one in hard, badges and fade`.

### Task 8: Practice cards on the new flow

**Files:**
- Modify: `components/studylab/PracticeNode.tsx`

- [ ] **Step 1:** Replace "Check my answer"/"Check again" with `CheckBar` in learn mode:
  - an incorrect or "close" verdict counts as a miss (close shows the warn tone with its feedback);
  - after two misses, the primary button becomes `reveal`, which shows the existing worked steps ("Show me how") and is labelled "Show me how";
  - "Show me how" stays available as a quiet secondary text button from the start, as today ("never gated behind failing first").
- [ ] **Step 2:** Persist `attempts` on the `PracticeCell`. Restore through `initialCheckFlow`. A local-verdict "correct" still short-circuits as today.
- [ ] **Step 3:** Run `npx vitest run lib/studylab/practice.test.ts` (unchanged, green) and the full suite. `tsc` clean.
- [ ] **Step 4: Commit** `feat(learnspace): practice cards take the shared check bar -- two tries, then Show me how`.

### Task 9: Activities and materials on the new flow

**Files:**
- Modify: `components/studylab/activities/ActivityFrame.tsx` (the shared chrome for all nine activities and for `MaterialRenderer`), `components/studylab/activities/ActivityNode.tsx`, `components/studylab/material/MaterialBoardNode.tsx`

- [ ] **Step 1: ActivityFrame props.**
  - The props gain `checkState?: CheckFlowState` and `onCheckAction?: (a: BarButton['action']) => void`.
  - When `checkState` is given, the frame renders `CheckBar` in place of its own Check button and "Solved" pill.
  - The hint button becomes the bar's `getHelp`/`reveal` fallback: after the first miss the hint is shown automatically; after the second, "Show me" reveals the `reveal` text.
  - When `checkState` is absent, the frame behaves exactly as today (dev bench and demo).
- [ ] **Step 2: Activity and material nodes.** `ActivityNode` and `MaterialBoardNode` drive `useCheckFlow('learn', …)` from their existing solved/attempts logic:
  - "Check" → `tick()` / the activity success rule;
  - solved → `result(correct)`, plus a `stagger` bounce on the placed pieces (pass a `celebrate` flag down to the pattern renderers, which wrap pieces in a `motion` container with `MOTION.stagger`; reduced motion → none);
  - not solved → `result(incorrect)`;
  - persist `attempts` (activities) / use the existing `attempts` (materials).
- [ ] **Step 3: Verify.** `npx vitest run lib/studylab/activities lib/studylab/material lib/studylab/checkpointState*` is green; then the full suite. `tsc` clean.
- [ ] **Step 4: Commit** `feat(learnspace): activities and materials use the shared check bar -- miss once, a hint; twice, show me; solved, the pieces bounce`.

### Task 10: Tap-to-define terms

**Files:**
- Create: `lib/studylab/glossary.ts`, `lib/studylab/glossary.test.ts`, `components/studylab/GlossaryTerm.tsx`
- Modify:
  - `components/studylab/canvasShared.tsx`: `SafeLatex` splits glossary marks first, rendering `GlossaryTerm` for each and the existing LaTeX path for the rest;
  - `app/api/studylab/tutor/system-prompt.ts`: one line under the concept card bullet: "In a concept, worked or callout body you may mark up to three key terms as [[term|one-sentence definition]]; the student taps them to see the definition."

**Interfaces:**
- Produces:
  - `type GlossaryPart = { kind: 'text'; text: string } | { kind: 'term'; term: string; definition: string }`;
  - `splitGlossary(text: string): GlossaryPart[]`. It parses `[[term|definition]]`. A mark with no `|`, an empty term or an empty definition renders as plain text without the brackets. Nested or unclosed brackets render literally. At most 3 terms per text: the rest render as plain terms.
  - `<GlossaryTerm term definition />`, a button with a dotted underline in `var(--subject)`, with `aria-expanded`. The popover card opens on click/Enter/Space, closes on Escape, an outside click or blur, and is positioned below the term (it flips above near the viewport edge). It uses `nodrag nowheel`.

- [ ] **Step 1: Write failing tests:**
  - `splitGlossary('A [[corpus|the texts a model learns from]] is…')` → text / term / text;
  - no marks → one text part;
  - a malformed `[[corpus]]` → text "corpus";
  - a fourth term → plain text;
  - LaTeX inside the definition is preserved as text (`$x^2$` survives).
- [ ] **Step 2: Run.** Expected: FAIL. **Step 3: Implement.** **Step 4: Run.** Expected: PASS. Full suite green. `tsc` clean. Prompt snapshot tests updated only for the added line.
- [ ] **Step 5: Commit** `feat(learnspace): tap-to-define key terms in card text`.

### Task 11: See it on the real path

**Files:** none new. Fixes go to whichever file is at fault, each with its own commit.

- [ ] **Step 1:** Start the dev server on a non-default port (`npx next dev -p 3107`). Use the Playwright MCP browser, never a `taskkill`.
- [ ] **Step 2: The public demo lesson** (`/studylab/demo`). Walk through to its checkpoint and screenshot:
  - an MCQ selected but not yet checked;
  - a wrong first try in learn mode (amber, ✕ badge, Inky concerned, Try again);
  - the correct answer (green, ✓, Inky happy, Why?/Continue);
  - a hard-check wrong answer (red Incorrect, answer revealed, Why? primary).
- [ ] **Step 3: A real LearnSpace,** signed in locally as the dev user. Open one maths and one science lesson. Exercise a practice card twice wrong, then Show me how; an activity or material wrong once (hint appears), then solved (bounce); a glossary term (open, Escape); mute (reload, still muted).
- [ ] **Step 4: Run once each:**
  - reduced motion, through Playwright `emulateMedia({ reducedMotion: 'reduce' })`: nothing moves;
  - dark mode: the subject colours are readable;
  - keyboard only, for one MCQ.
- [ ] **Step 5:** Look at every screenshot. Fix what's wrong (overlap, contrast, a focus loss), with a commit per fix. Then the full suite and `tsc`.
- [ ] **Step 6: Push** with the eseosapku helper, confirm the live build ID changes, and repeat Step 2 on `https://www.studysquare.org/studylab/demo`.
