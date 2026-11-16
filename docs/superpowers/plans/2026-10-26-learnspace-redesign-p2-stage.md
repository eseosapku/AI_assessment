# LearnSpace Redesign — Phase 2: The Stage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the lesson screen from "a board, a sidebar and a chat column" into a stage:
- the camera follows what the learner is working on, and dims the rest;
- one bar at the bottom moves the lesson on;
- Inky speaks in a bubble beside the board;
- the chat becomes a drawer;
- the plan becomes a path;
- finishing a station or the lesson plays a short scene.

**Architecture:**
- The decisions are pure functions in `lib/studylab/`, tested in Vitest:
  - `spotlight.ts`: what is in focus, and what Continue does;
  - `bubble.ts`: Inky's line and where its bubble goes;
  - `scenes.ts`: station and lesson completion, the summary, active time;
  - `planRail.ts`: the path's three sections.
- One layout component, `components/studylab/stage/LessonStage.tsx`, is shared by `Workspace` (live tutor) and `DemoWorkspace` (script). The demo therefore exercises the same stage a real lesson uses.
- A card's check bar stays owned by the card. When the card is in the spotlight, `useDock()` portals the bar into the screen-space dock. The flow state never moves, only where the bar renders.

**Tech Stack:** Next.js (repo version), React, @xyflow/react 12 (`fitView` takes per-side pixel padding; `onMoveStart` passes `null` for programmatic moves), framer-motion 11 (`layoutId` for Inky hopping along the path), Tailwind with `ss-*` and `--subject*` tokens, Vitest (node only).

**Spec:** `docs/superpowers/specs/2026-10-25-learnspace-redesign-design.md`, sections:
- *The lesson, start to finish* (Opening, Ending);
- *The stage: layout on the spatial board*;
- *Motion and sound* (scenes);
- *Accessibility*;
- *Phases* 2.

## Global Constraints

- Frozen, never edited: `app/api/studylab/grade/route.ts`, `snap/route.ts`, `lib/textbook-vision-images.ts`.
- No schema change and no new route in this phase. Active time rides in the saved board JSON as `CanvasState.activeMs?: number`. Old boards load unchanged.
- No new npm dependency.
- Motion is 150–300 ms per state change; scenes last ≤1.5 s and are skippable by click or Escape. Every animation has a reduced-motion variant (fade or none). Nothing blocks input.
- Dim is 35% opacity. A dimmed card stays clickable, and returns to full opacity on hover and on `:focus-within`.
- No text under 12 px. `lib/type-scale.test.ts` fails the suite otherwise.
- Tailwind opacity modifiers (`/10`, `/95`) render nothing on `ss-*` and `--subject` colours. Use inline `color-mix(in srgb, var(--x) N%, transparent)`.
- Colour is never the only signal. The spotlight never traps focus; Tab still reaches every card, the rail and the drawer.
- Sound goes through `playSound` and the one `ss-sound` mute.
- Phones: the layout must not break (rail collapses, the drawer becomes a bottom sheet under `md`). Polish stays deferred.
- No routing code is planned. If any becomes necessary, read `node_modules/next/dist/docs/` first.
- Every commit: `npx vitest run` green and `npx tsc --noEmit -p .` clean. Chain the commit with `&&` after both. Lint is not a gate.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never stage `scripts/build_checkpoint_figure_bank.py`, `scripts/textbook-figure-raw.ts`, `data/audit/paper-style.json`, `scripts/figgen/` or `.playwright-mcp/`.

## Review Focus

1. **A lesson reloaded in the middle of a check.** With no "last turn" to go on, the focus falls back to the first unanswered question. The dock shows that question's bar. Something is always pressable: never a dock with no Continue while no card bar has claimed it. (Pinned by `focusIds` and `dockModel` tests in Task 1.)
2. **The answer to the last question of a check is handed in automatically.** Between the answer and the tutor's reply there must be no Continue that would send `next_beat` past an unsubmitted check. (`continueFor` returns null for an unanswered check with no other questions, and while busy: Task 1.)
3. **The learner pans away, then a turn lands.** The camera comes back to the new item, the dim returns, and "Back to lesson" disappears. While they explore, nothing dims and the camera never pulls them back on its own. (Browser, Task 10.)
4. **Inky's bubble over the work.** On a 1280×720 window with the drawer open, a tall card in focus is never covered: the bubble moves above Inky or shrinks to a one-line pill. (`placeBubble` tests in Task 2; browser in Task 10.)
5. **Keyboard only, from choosing an answer to Continue.**
   - Enter checks a chosen option.
   - The in-card "Go to the Check button" link reaches the docked bar.
   - Focus lands on the bar's primary button after a result.
   - `/` opens the drawer and focuses the box; Escape closes it and returns focus.

   (Browser, Task 10; `drawerKey` test in Task 6.)

---

### Task 1: The spotlight model — focus, Continue and the dock

**Files:**
- Create: `lib/studylab/spotlight.ts`, `lib/studylab/spotlight.test.ts`
- Modify: `lib/studylab/checkBarModel.ts` (+ test): add `barOptionsFor`.

**Interfaces:**
- Consumes: `LessonRun`, `OpenCheck` (`lessonRun.ts`); `StudyNode`, `QuizCell` (`types.ts`); `isFreeform` (`blocks.ts`); `BarOptions` (`checkBarModel.ts`).
- Produces:
  - `focusIds(input: { nodes: StudyNode[]; run: LessonRun | null; explicit: string[] }): string[]`;
  - `type ContinueTarget = { kind: 'advance' | 'finish'; label: string } | { kind: 'focus'; label: string; nodeId: string; hint: string }`;
  - `continueFor(nodeId: string | null, input: { nodes: StudyNode[]; run: LessonRun | null; busy: boolean }): ContinueTarget | null`;
  - `type DockView = { kind: 'none' } | { kind: 'working'; label: string } | { kind: 'continue'; target: ContinueTarget } | { kind: 'done' }`;
  - `dockModel(input: { nodes; run; busy; working: string }): DockView`;
  - `barOptionsFor(base: BarOptions, docked: boolean, cont: { label: string } | null): BarOptions`.

Definitions:
- A *lesson node* is a node that is:
  - not hidden;
  - not freeform (`source !== 'freeform'` and `!isFreeform(type)`);
  - not a `stepGroup`.
- A check's *cells* are the visible `quiz` nodes whose `quiz.checkpointId` equals `run.openCheck.checkpointId`, in board order.
- A cell is *settled* when its state is `correct` or `incorrect`.
- A check is *gating* when any of its cells has `gate === 'hard'`.

- [ ] **Step 1: Write failing tests.**
  - **`focusIds`:**
    - no run, `planning` or `done` → `[]`;
    - explicit ids that are visible lesson nodes are returned in order; hidden, missing and `stepGroup` ids are dropped;
    - explicit empty and a check open → the first unsettled cell (Review Focus 1); every cell settled → the first cell;
    - otherwise → the last lesson node in board order with `data.step === run.currentStep + 1`;
    - none of those → `[]`.
  - **`continueFor`:**
    - busy, no run, or phase ≠ `teaching` → null;
    - a cell with another unsettled cell after or before it → `{ kind: 'focus', label: 'Next question', nodeId: <that cell> }`;
    - the only unsettled cell asking for itself → null (its own Check is the way on);
    - a gating check with unsettled cells, asked from any other node or `null` → `focus` on the first unsettled cell. Label: 'Go to the check' for one cell, 'Go to the questions' for more. Hint: 'Answer the check to go on' or `'${remaining} of ${total} questions still to answer'`;
    - a gating check with every cell settled → null (it is being handed in; Review Focus 2);
    - a soft check never blocks advancing;
    - `currentStep === -1` → `{ kind: 'finish', label: 'Finish lesson' }`;
    - else → `{ kind: 'advance', label: 'Continue' }`.
  - **`dockModel`:**
    - `done` → done;
    - busy → `working` with the label;
    - no run or `planning` → none;
    - otherwise `continue` with `continueFor(null, …)`, or none when that is null.
  - **`barOptionsFor`:**
    - not docked → `hasContinue: false` whatever `cont` is;
    - docked with `cont` → `hasContinue: true`, `continueLabel: cont.label`;
    - docked with null → `hasContinue: false`.
- [ ] **Step 2: Run** `npx vitest run lib/studylab/spotlight.test.ts lib/studylab/checkBarModel.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** both.
- [ ] **Step 4: Run.** Expected: PASS. Then the full suite and `tsc`.
- [ ] **Step 5: Commit** `feat(learnspace): the spotlight model -- what is in focus and what Continue does`.

### Task 2: Inky's line, the bubble's place, the path and the scenes (pure)

**Files:**
- Create: `lib/studylab/bubble.ts` (+ test), `lib/studylab/scenes.ts` (+ test)
- Modify: `lib/studylab/planRail.ts` (+ `planRail.test.ts`)

**Interfaces:**
- Produces:
  - `type TutorLine = { index: number; text: string; tone: 'say' | 'refusal' | 'error'; retryAction?: Record<string, unknown> }`;
  - `latestLine(messages: ChatMessage[]): TutorLine | null`;
  - `type Rect = { x: number; y: number; w: number; h: number }`;
  - `placeBubble(input: { board: Rect; inky: Rect; avoid: Rect[]; size: { w: number; h: number }; compact: { w: number; h: number } }): { x: number; y: number; compact: boolean; tail: 'left' | 'bottom' }`;
  - `settledSince(prev: LessonRun | null, next: LessonRun | null): LessonStep[]`;
  - `lessonFinished(prev: LessonRun | null, next: LessonRun | null): boolean`;
  - `type LessonSummary = { stations: number; known: number; practised: number; minutes: number }`;
  - `lessonSummary(run: LessonRun, nodes: StudyNode[], activeMs: number): LessonSummary`;
  - `const IDLE_CAP_MS = 120_000`;
  - `addActive(totalMs: number, sinceMs: number, nowMs: number, lastInputMs: number): number`;
  - `type PathSections = { known: RailStep[]; current: RailStep | null; later: RailStep[] }`;
  - `pathSections(rail: RailStep[]): PathSections`.

- [ ] **Step 1: Write failing tests.**
  - **`latestLine`:**
    - the newest assistant message with no kind, or kind `refusal` or `error`, whose content is not blank;
    - `status`, `plan` and `homework` messages are skipped;
    - `retryAction` is kept only when that message is the last in the list.
  - **`placeBubble`:** the candidates are tried in order:
    1. right of Inky, bottom-aligned (tail `left`);
    2. above Inky, left-aligned (tail `bottom`);
    3. the compact size right of Inky;
    4. the compact size above Inky.

    The first that lies inside `board` and misses every `avoid` rect by 8 px wins. If none does, the compact one right of Inky. Test each branch with rects (Review Focus 4).
  - **`settledSince`:**
    - prev null → `[]`;
    - a step going from `teaching` or `pending` to `done` or `known` is returned;
    - a step already settled is not;
    - a new id is not.
  - **`lessonFinished`:** true only on a `teaching → done` (or `planning → done`) change; prev null → false.
  - **`lessonSummary`:**
    - `stations` = steps `done`; `known` = steps `known`;
    - `practised` counts nodes, hidden ones included (grouped steps hide their cards), with `quiz.state === 'correct'`, `practice.state === 'correct'`, `activityState.status === 'solved'` or `materialState.status === 'solved'`;
    - `minutes` = `Math.round(activeMs / 60000)`.
  - **`addActive`:** adds `min(now, lastInput + IDLE_CAP_MS) − since`, floored at 0, to the total.
  - **`pathSections`:**
    - `known` = steps `done` or `known`, in order;
    - `current` = the step flagged current, else the first `pending` one;
    - `later` = the rest.
- [ ] **Step 2: Run** `npx vitest run lib/studylab/bubble.test.ts lib/studylab/scenes.test.ts lib/studylab/planRail.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS. Full suite, `tsc`.
- [ ] **Step 5: Commit** `feat(learnspace): Inky's line, bubble placement, the path and lesson scenes -- pure and pinned`.

### Task 3: One stage for both lessons, and the spotlight on the board

**Files:**
- Create: `components/studylab/stage/LessonStage.tsx`
- Modify:
  - `components/studylab/Workspace.tsx`
  - `components/studylab/DemoWorkspace.tsx`
  - `components/studylab/StudyCanvas.tsx`
  - `app/globals.css`

**Interfaces:**
- Consumes: `focusIds` (Task 1).
- Produces:
  - `LessonStage` props. Everything both workspaces now pass to sidebar, canvas and chat, plus:
    - `focus: string[]` (the explicit list);
    - `banner?: ReactNode` (the demo's top bar);
    - `cue?: ReactNode` (the demo's cue card);
    - `drawerOpen?: boolean` and `onDrawerOpenChange?` (controlled by the demo; uncontrolled otherwise).
  - `StudyCanvas` gains:
    - `focusIds: string[]`;
    - `insets: { top: number; right: number; bottom: number; left: number }`;
    - `onExploreChange?: (exploring: boolean) => void`.

- [ ] **Step 1: Move the layout into `LessonStage`, unchanged.** It holds the sidebar, the board column and the chat column, and both workspaces render it. Then run the full suite and `tsc`, and look at `/studylab/demo` in the browser: it must look exactly as before.
- [ ] **Step 2: Focus state.**
  - Both workspaces keep `const [focus, setFocus] = useState<string[]>([])`.
  - A turn that creates cards sets `focus` to the `created` ids and no longer queues a `fitNodes` effect for them. The `fitNodes` for a learner's own new block stays.
  - `goToNode` sets `focus` to `[id]`.
- [ ] **Step 3: The spotlight in `StudyCanvas`.**
  - Compute `const focused = new Set(focusIds)`. While `focused.size > 0` and the learner is not exploring:
    - every drawn node not in it gets `className: 'ss-dim'`;
    - every step region except the current step's is dimmed;
    - edges not touching a focused node get `className: 'ss-dim'`.
  - On a change of the focus set (compare the joined ids), the camera eases there with `rf.fitView({ nodes, duration: 450, padding: { top: px(insets.top+24), right: …, bottom: …, left: … }, minZoom: READABLE_ZOOM, maxZoom: 1 })`, and exploring ends. Under reduced motion, `duration: 0`.
  - `onMoveStart={(e) => { if (e) setExploring(true) }}`. Only learner moves pass an event.
  - While exploring, a "Back to lesson" pill shows top-centre (`Panel position="top-center"`, `ss-press`, the `Crosshair` icon). It ends exploring and refits.
  - Remove the top-left title badge (the title moves to the rail in Task 7). Keep Board tools.
  - Move `ZoomControl` to `bottom-right`; Inky takes bottom-left in Task 5.
  - Replace the busy "Building the board…" pill. Task 4's dock shows the working state.
- [ ] **Step 4: CSS** in `globals.css`:
  - `.react-flow__node.ss-dim, .react-flow__edge.ss-dim { opacity: .35; transition: opacity 200ms ease-out }`;
  - `.react-flow__node.ss-dim:hover, .react-flow__node.ss-dim:focus-within { opacity: 1 }`;
  - no transition under `prefers-reduced-motion: reduce`.
- [ ] **Step 5: Run** the full suite and `tsc`. Check the demo in the browser:
  - after "Looks good, start", the first card is framed and nothing else is dimmed (there is nothing else);
  - after Continue, the new table is framed and the first card dims;
  - dragging the board shows "Back to lesson" and lifts the dim.
- [ ] **Step 6: Commit** `feat(learnspace): one stage for real and demo lessons; the camera follows the work and dims the rest`.

### Task 4: The dock — one bar moves the lesson on

**Files:**
- Create:
  - `components/studylab/stage/StageContext.tsx` (context + `useDock`)
  - `components/studylab/stage/ActionDock.tsx`
- Modify:
  - `LessonStage.tsx`
  - `QuizNode.tsx`
  - `PracticeNode.tsx`
  - `activities/ActivityFrame.tsx`
  - `ChatMouthpiece.tsx`
  - `Workspace.tsx`, `DemoWorkspace.tsx` (the `onContinue` wiring)

**Interfaces:**
- Consumes: `continueFor`, `dockModel`, `barOptionsFor` (Task 1); `CheckBar` (Phase 1).
- Produces:
  - `StageContext` value: `{ dockEl: HTMLElement | null; focus: ReadonlySet<string>; continueFor(nodeId: string): ContinueTarget | null; runContinue(t: ContinueTarget): void; claim(nodeId: string): () => void }`;
  - `useDock(): { docked: boolean; cont: ContinueTarget | null; onContinue(): void; place(bar: ReactNode): ReactNode }`. It reads its node id with `useNodeId()` from `@xyflow/react`. With no provider or no node id, `docked` is false.
  - `LessonStage` props gain `onAdvance(): void` (Continue / Finish: the workspaces' existing `handleAdvance`, or the demo's `continue` act) and `onFocus(id: string): void`.

- [ ] **Step 1: `useDock`.**
  - `docked` = a provider exists, `dockEl` is set, and the node id is in `focus`.
  - While docked, a layout effect calls `claim(nodeId)` and returns its release.
  - `place(bar)`, when docked, returns `createPortal(bar, dockEl)` plus an in-card link: a `sr-only focus:not-sr-only` button, "Go to the Check button", that focuses `dockEl.querySelector('button:not([disabled])')`. Undocked, it returns `bar` itself.
  - `onContinue` runs `runContinue(cont)`.
- [ ] **Step 2: `ActionDock`,** absolutely positioned bottom-centre of the board column. Width `min(560px, 100% - 32px)`, `bottom: 20px`.
  - It always renders an empty portal-target `div` (with `ref` → `dockEl`). React never renders children into that `div`.
  - When `claims.size === 0`, a sibling renders the `DockView`:
    - `working`: an `aria-live` pill with a spinner and the label;
    - `continue`: a 48-px `ss-press` primary button with the target's label and an `ArrowRight` icon, filled `var(--subject)` with `var(--ss-panel)` text. A `focus` target's hint sits to the left.
    - `done`: rendered in Task 8.
  - The dock root carries `data-tour="lesson-continue"`. The tour and the demo cue ring the dock, whichever bar is in it.
- [ ] **Step 3: Cards use the dock.** In `QuizNode`, `PracticeNode` and `ActivityFrame`:
  - `const dock = useDock()`;
  - the bar options become `barOptionsFor(options, dock.docked, dock.cont)`;
  - `onAction('continue')` calls `dock.onContinue()`;
  - the bar renders through `dock.place(<CheckBar …/>)`.

  The card's line, badges, Why panel and border tone stay in the card. In `McqOptions`, Enter on a chosen option, while the flow is `ready`, calls a new `onSubmit` prop that runs `check()`.
- [ ] **Step 4: Retire Continue from the chat.** Remove from `ChatMouthpiece`:
  - the forward-controls block;
  - the pending-checkpoint banner;
  - the `onQuizMe` prop.

  Keep `done` for now; it moves in Task 8. `runContinue` in `LessonStage` does this per target:
  - `advance` / `finish` → `onAdvance()`;
  - `focus` → `onFocus(nodeId)`.
- [ ] **Step 5: Run** the full suite and `tsc`. Then walk the demo to its first check in the browser:
  - the question's Check sits in the dock, disabled until an option is chosen;
  - the result line, then Why?, show in the dock;
  - after the check is handed in, the dock shows Continue.
- [ ] **Step 6: Commit** `feat(learnspace): the docked bar -- Check, Why?, Continue in one place under the work`.

### Task 5: Inky on the board, speaking in a bubble

**Files:**
- Create: `components/studylab/stage/InkyDock.tsx`
- Modify: `LessonStage.tsx`

**Interfaces:**
- Consumes: `latestLine`, `placeBubble` (Task 2); `Inky`, `InkyMood` (Phase 1); `useMuted`.
- Produces: `<InkyDock messages suggestions busy working drawerOpen onOpenDrawer onAsk(text) onRetry(action) avoid: () => Rect[] />`.

- [ ] **Step 1: Build `InkyDock`,** absolute bottom-left of the board column (`left: 16px; bottom: 20px`).
  - Inky is 56 px. Mood:
    - `thinking` while busy;
    - `talking` for 2.4 s after a new line arrives;
    - `concerned` on an `error` or `refusal` line;
    - otherwise `idle`.
  - Beside Inky: a round chat button (`MessageCircle`, label "Open the chat", 44 px) and the mute toggle (moved from the chat header; the header keeps one too, through the same hook).
  - The root carries `data-tour="lesson-chat"`.
- [ ] **Step 2: The bubble.**
  - It shows the `latestLine` text through `SafeLatex`, `max-w-[320px]`, clamped to 4 lines. When clamped, a "More in the chat" link opens the drawer.
  - While busy, it shows the working label with the three dots instead.
  - An `error` or `refusal` line with `retryAction` shows a "Try again" button that calls `onRetry`.
  - Up to three suggestion chips sit under it, carrying `data-tour="lesson-chips"`. They are hidden while the drawer is open (the drawer shows them) and while a check is gating.
  - The bubble is `aria-live="polite"`. It enters with `rise`, and a replaced line cross-fades.
  - Hidden entirely while the drawer is open: the conversation is right there.
- [ ] **Step 3: Placement.** On every focus change, `onMoveEnd`, window resize and drawer toggle, run `placeBubble` with:
  - `board` = the board column's rect;
  - `inky` = the Inky element's rect;
  - `avoid` = the focused nodes' rects (`.react-flow__node[data-id="…"]`) plus the dock's rect;
  - `size` = the bubble's measured size;
  - `compact = { w: 240, h: 44 }`.

  Render at the result. Compact shows the first sentence, truncated, and opens the drawer on click. The tail points at Inky (`left` or `bottom`).
- [ ] **Step 4: Run** the full suite and `tsc`. In the browser, with the demo at 1280×720:
  - the bubble sits right of Inky;
  - with a tall card framed, it moves above Inky or goes compact, and never covers the card.
- [ ] **Step 5: Commit** `feat(learnspace): Inky on the board -- its lines in a bubble that never covers the work`.

### Task 6: The tutor drawer

**Files:**
- Create: `components/studylab/stage/TutorDrawer.tsx`, `lib/studylab/drawerKey.ts` (+ test)
- Modify: `LessonStage.tsx`, `ChatMouthpiece.tsx`

**Interfaces:**
- Produces:
  - `drawerKey(e: { key: string; target: { tagName?: string; isContentEditable?: boolean } | null; open: boolean }): 'open' | 'close' | null`:
    - `/` → `open` unless the target is an `INPUT`, a `TEXTAREA` or editable, or the drawer is already open;
    - `Escape` → `close` when open;
    - otherwise null.
  - `ChatMouthpiece` gains `onClose?: () => void` (a close button in its header) and `autoFocusInput?: boolean`.

- [ ] **Step 1: Failing tests** for `drawerKey`. Run: FAIL. Implement. Run: PASS.
- [ ] **Step 2: `TutorDrawer`,** the right-hand column, closed by default.
  - Open, it is 380 px wide. It animates `width` 0 ↔ 380 over 250 ms (none under reduced motion), so the board narrows: "the board shifts left".
  - Under `md` it is a fixed bottom sheet: `inset-x-0 bottom-0 h-[72vh]`, rounded top, with a scrim.
  - It opens on:
    - the Inky chat button;
    - the bubble's "More in the chat";
    - `drawerKey` 'open' on a window keydown.

    Opening focuses the text box. Closing returns focus to whatever opened it.
  - Once its width transition ends, the board's camera refits the focus (unless exploring).
- [ ] **Step 3: Trim `ChatMouthpiece`** to header, history, suggestions and the composer.
  - A `plan` or `homework` message that is still live renders as one line: "Your plan is on the board" / "Pick your questions on the board". The live card moves to the stage in Task 7.
  - Settled ones keep their card as a record.
- [ ] **Step 4: Run** the full suite and `tsc`. In the browser:
  - `/` opens the drawer with the box focused; Escape closes it;
  - the board narrows and refits;
  - at 390 px wide, the drawer is a bottom sheet.
- [ ] **Step 5: Commit** `feat(learnspace): the chat becomes a drawer -- closed by default, / to open, the board makes room`.

### Task 7: The path rail and the opening card

**Files:**
- Create:
  - `components/studylab/stage/PathRail.tsx` (replaces `StudyLabSidebar.tsx`, which is deleted once nothing imports it)
  - `components/studylab/stage/OpeningCard.tsx`
- Modify: `PlanCard.tsx` (a `variant?: 'chat' | 'stage'`), `LessonStage.tsx`

**Interfaces:**
- Consumes: `railSteps`, `railIsLive`, `pathSections` (Task 2); `PlanCard`, `QuestionPicker`; `Inky`.
- Produces:
  - `<PathRail title subject run policy origin busy onBack onJump onTestOut onSetPace onAddPage />`. It takes the same handlers the sidebar took.
  - `<OpeningCard>`, rendered by `LessonStage` over the board centre while the newest `plan` message is live (or a `homework` message's sheet is live). It holds `PlanCard variant="stage"` (or `QuestionPicker`).

- [ ] **Step 1: `PathRail`.**
  - Light, on `bg-ss-panel` with the `ss-line` border, in both themes.
  - Open, it is 264 px; collapsed, 64 px (tiles only, with titles in `title` tooltips). The state is remembered in localStorage under `ss-learnspace-rail`. It starts collapsed under `md`.
  - Top: the back link "All LearnSpaces", the title, and the subject as a chip in `--subject-soft` / `--subject-ink`.
  - The pace segmented control (`data-tour="lesson-pace"`), shown under the same conditions as before.
  - The homework "Add another page" button, as before.
  - The path (`data-tour="lesson-plan"`) is a vertical line joining round tiles, grouped by `pathSections` under small labels:
    - "You already know" (ticked, `--ss-good`);
    - "Start here" (the current tile, ringed in `--subject`, with a 22-px Inky sitting on it via `motion` `layoutId="path-inky"`, so Inky hops when the step changes);
    - "Later".

    While the plan is still proposed, the labels read "Proposed".
  - Each row keeps the old behaviour: jump, Test out, measured %, locked reason, disabled when not live or busy.
  - A tile that has just turned done plays `settle` (stamp).
  - Footer: "N of M stations" with a progress bar in `--subject`.
- [ ] **Step 2: `OpeningCard`.**
  - A centred panel, `w-[min(560px,100%-32px)]`, with a header band tinted `color-mix(var(--subject) 14%)`. The band shows the lesson title, the station count and a slot for the hero art (Phase 5 fills it).
  - `PlanCard variant="stage"` drops its own tinted frame and lays the steps out as the same three-part path.
  - It carries `data-tour="lesson-plan-card"`, and enters with `rise`.
  - While a plan is drafting (busy, no plan yet), Inky `thinking` replaces the old spinner overlay, with "Drafting your plan…".
- [ ] **Step 3: Run** the full suite and `tsc`. In the browser on the demo, check:
  - the opening card;
  - accept;
  - the rail with Inky on step 1, then on step 2 after the first check;
  - the collapse toggle, which is remembered.
- [ ] **Step 4: Commit** `feat(learnspace): the plan becomes a path -- an opening card on the stage and a rail Inky walks along`.

### Task 8: Scenes — a station done, the lesson done

**Files:**
- Create:
  - `components/studylab/stage/StationScene.tsx`
  - `components/studylab/stage/LessonCompleteScene.tsx`
  - `components/studylab/stage/useActiveTime.ts`
- Modify:
  - `lib/studylab/types.ts` (`CanvasState.activeMs?: number`)
  - `canvasNodes.tsx` (`StepGroupNode` as a station tile)
  - `LessonStage.tsx`, `Workspace.tsx`, `ActionDock.tsx`, `ChatMouthpiece.tsx`

**Interfaces:**
- Consumes: `settledSince`, `lessonFinished`, `lessonSummary`, `addActive`, `IDLE_CAP_MS` (Task 2); `countUpValue` / `useCountUp`, `motionFor` (Phase 1); `playSound`.
- Produces:
  - `useActiveTime(initialMs: number, onChange: (ms: number) => void)`:
    - counts while the page is visible, using the last pointer or key input;
    - commits every 15 s through `addActive`;
    - flushes on `visibilitychange` to hidden.
  - `LessonStage` props gain `activeMs: number`, `onProveIt?`, `provingIt?`, `proveUpdatesGapMap?`, `before?` (moved from `ChatMouthpiece`).

- [ ] **Step 1: Station scene.**
  - `LessonStage` keeps the previous run in a ref. When `settledSince(prev, run)` is non-empty, it plays `StationScene` for the last settled step:
    - a centred card;
    - a tick stamping in (`settle`);
    - "Station complete" and the title;
    - Inky `celebrating`;
    - `playSound('complete')`.
  - It dismisses after 1200 ms, or on click or Escape. It is `aria-live="assertive"`.
  - Under reduced motion it shows statically for the same time.
- [ ] **Step 2: The station node.** `StepGroupNode` becomes a station tile:
  - a `--subject-soft` panel with a 2-px `--subject` border;
  - a ticked badge, "Station N" and the title;
  - the card count with the expand/collapse chevron.

  It enters with `settle`, and its behaviour is unchanged.
- [ ] **Step 3: Lesson complete.** When `lessonFinished(prev, run)`:
  - the camera fits the whole board;
  - the spotlight clears (`focusIds` is `[]` when done);
  - `LessonCompleteScene` opens over it, with:
    - Inky `celebrating` and "Lesson complete";
    - three count-up stats from `lessonSummary`: stations mastered (plus "tested out of N" when `known > 0`), questions practised, minutes learning;
    - the measured "before" line when present;
    - "Prove it — take the quiz", with its Gap Map line;
    - "Look over the board", which closes the scene;
    - `playSound('lesson-complete')`.
  - Once closed, the dock's `done` view shows "Lesson summary" (reopens it) beside "Prove it".
  - Remove the `done` block from `ChatMouthpiece`.
- [ ] **Step 4: Active time.**
  - `Workspace` reads `canvas.activeMs ?? 0`, runs `useActiveTime`, writes `activeMs` into the canvas, and lets the normal debounced save carry it.
  - The demo counts in memory only.
- [ ] **Step 5: Run** the full suite and `tsc`. In the browser, finish the demo:
  - the station scene after each check;
  - the lesson-complete scene with counts;
  - a reload of a real finished lesson shows the dock's `done` view and no scene (prev null).
- [ ] **Step 6: Commit** `feat(learnspace): station and lesson scenes -- a stamp for each station, a map and a summary at the end`.

### Task 9: The tour and the demo, told for the stage

**Files:**
- Modify: `lib/product-tour.ts` (+ its test only if anchors change), `lib/studylab/demoLesson.ts` (+ `demoLesson.test.ts`), `DemoWorkspace.tsx`

- [ ] **Step 1: Lesson tour copy** for the new layout. The anchors keep their names:
  - `lesson-board`: "The work comes to you": the camera frames what to do, and the rest dims;
  - `lesson-chat`: "Inky talks here"; the chat button opens the history, or press /;
  - `lesson-continue`: "One bar moves you on": Check, then Continue;
  - `lesson-plan`: "Your path";
  - `lesson-pace`: unchanged meaning.
- [ ] **Step 2: Demo cues.**
  - "Press Continue" acts say where it is: "Press Continue at the bottom of the board".
  - The chip act says "under Inky".
  - The `ask` act's cue stays on `lesson-composer`. `DemoWorkspace` opens the drawer while the cue's anchor is `lesson-composer` and closes it after the act.
  - The check acts say "Pick an answer, then press Check below it".
  - Update `demoLesson.test.ts` where it pins cue text.
- [ ] **Step 3: Run** the full suite and `tsc`. Walk the whole demo once.
- [ ] **Step 4: Commit** `feat(learnspace): the tour and the demo, told for the stage`.

### Task 10: See it on the real path

**Files:** none new. Fixes go to whichever file is at fault, a commit each.

- [ ] **Step 1:** Use the dev server already on port 3107 if it is running; otherwise `npx next dev -p 3107`. Use the Playwright MCP browser.
- [ ] **Step 2: The demo, end to end,** at 1440×900 and 1280×720. Take a screenshot at each of these and look at it:
  - the opening card;
  - the first card framed;
  - a dimmed board;
  - "Back to lesson" after a drag (Review Focus 3);
  - a check in the dock: selected, retry, correct, test-wrong;
  - the bubble beside a tall card (Review Focus 4);
  - the drawer open;
  - the station scene;
  - the lesson-complete scene.
- [ ] **Step 3: Keyboard only,** through one MCQ to Continue, and `/` with Escape (Review Focus 5).
- [ ] **Step 4: Once each:**
  - reduced motion (nothing moves; the scenes are static);
  - dark mode;
  - 390×844 (nothing broken; the drawer is a sheet, the rail collapsed);
  - the dev bench `/dev/learnspace` (cards render undocked with no provider).
- [ ] **Step 5: A real lesson reload mid-check.** If no signed-in lesson is reachable locally, cover it through the bench's remount with a check open (Review Focus 1), and note it for Phase 6.
- [ ] **Step 6:** Fix what is wrong, with a commit per fix. Then the full suite and `tsc`.
- [ ] **Step 7: Push** with the eseosapku helper. Confirm the live build ID changes, then repeat Step 2's opening, check and complete shots on `https://www.studysquare.org/studylab/demo`.
