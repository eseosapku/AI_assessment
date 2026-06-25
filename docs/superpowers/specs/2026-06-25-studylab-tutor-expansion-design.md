# StudyLab Tutor Expansion — Design

**Date:** 2026-06-25
**Status:** Approved for planning
**Area:** StudyLab LearnSpace (spatial AI tutor)

## 1. Summary

Expand the StudyLab LearnSpace from a chat-driven canvas that spawns static
concept/code/diagram cards into a richer, more interactive tutoring environment:

- **Runnable code** with real, in-browser execution and output/terminals.
- A wider **AI teaching vocabulary** (Mermaid diagrams, worked-example steps,
  comparison tables, callouts) on top of the existing cards.
- **Knowledge-check checkpoints** — the tutor surfaces quizzes at natural
  moments; step-boundary checks are a hard gate to advance, mid-step checks are
  optional. Four question formats, played out on the canvas and AI-graded where
  needed.
- A **freeform drag-and-drop palette** of "dumb" components (code scratchpad,
  sticky notes, markdown notes, connectors) the student uses to practice outside
  the guided steps — with no AI context by default.
- **Remove the tldraw sketch layer** (unused).
- **Fix the node-placement bug** where new AI cards spawn behind their neighbors,
  and make new cards animate cleanly into view.

This is one cohesive evolution of the LearnSpace, built in six independently
shippable phases.

## 2. Goals / Non-goals

**Goals**
- Real client-side code execution (no backend) for HTML/CSS/JS, JavaScript/TS,
  and Python.
- Enforced separation between AI-controllable blocks and freeform student blocks.
- AI-driven knowledge checks with a hard gate at step boundaries.
- Clean, reliable node placement and entrance animation.

**Non-goals (this iteration)**
- Server-side code execution / multi-language sandbox.
- SQL execution (engine is stubbed behind the runner interface for a later drop-in).
- Real-time collaboration / multi-user canvases.
- Persisting per-question analytics back into the assessment/gap-map system
  (checkpoints inform the tutor in-session only; cross-feature analytics is a
  future item).

## 3. Current state (baseline)

- `components/studylab/Workspace.tsx` — orchestrates load, tutor turns,
  persistence, canvas + chat.
- `components/studylab/StudyCanvas.tsx` — React Flow canvas + tldraw overlay +
  view effects (zoom/fit/center).
- `components/studylab/canvasNodes.tsx` — node renderers + `studyNodeTypes` map.
- `lib/studylab/actions.ts` — pure reducer `applyActions(state, actions)` +
  `autoPosition` + group/toggle helpers.
- `lib/studylab/types.ts` — `StudyNode`, `StudyNodeData`, `TutorAction`,
  `TutorResponse`, `CanvasState`, `ChatMessage`.
- `app/api/studylab/tutor/route.ts` — builds the prompt, calls Gemma (Bedrock),
  sanitizes the JSON response.
- Existing node types: `concept`, `code`, `diagram`, `image`, `stepGroup`,
  `sketch`.
- Existing actions: `createCard`, `connect`, `groupStep`, `zoom`, `highlight`.

## 4. Architecture decision

**Chosen: incremental extension + a light "block registry"** (over a full plugin
abstraction or ad-hoc bolt-ons).

A single registry becomes the source of truth for every block type, declaring
whether the AI may create it. This enforces the AI/freeform boundary in one place
and lets the runner, quizzes, palette, and new tutoring cards slot in as registry
entries.

```ts
// lib/studylab/blocks.ts
type BlockSource = 'ai' | 'freeform'

interface BlockDef {
  type: BlockType            // 'concept' | 'code' | 'diagram' | 'mermaid' |
                             // 'worked' | 'table' | 'callout' | 'quiz' |
                             // 'checkpointHeader' | 'sticky' | 'note' |
                             // 'scratchpad' | 'stepGroup' | 'image'
                             // (one 'quiz' type; the format lives in data.quiz.format)
  renderer: NodeComponent
  source: BlockSource        // 'freeform' ⇒ tutor can never create or read it
  defaultSize: { w: number; h: number }
  palette?: { label: string; icon: string; group: string } // ⇒ shows in palette
}
```

Rules derived from the registry:
- `applyActions` accepts AI create actions only for `source: 'ai'` block types.
- The freeform palette is generated from every entry that has a `palette` field.
- The `card_ids` sent to the tutor exclude every `source: 'freeform'` node, so the
  model never sees scratch work.

## 5. Phases

Build order (each independently shippable):

1. Node placement fix + tldraw removal
2. Block registry refactor
3. Code runner engines
4. Freeform palette + toolbar
5. Knowledge-check checkpoint system
6. Tutor prompt + protocol upgrades (incl. new tutoring node types)

### Phase 1 — Node placement fix + tldraw removal

**Placement bug.** `autoPosition` (lib/studylab/actions.ts) positions by index
within a step (`col = count % 3`), so cards created across turns can resolve to
coordinates an existing card already occupies → new node renders behind a
neighbor.

- Rewrite `autoPosition` to be **collision-aware**: compute candidate slots in the
  step band and skip any that overlap an existing visible node's rect (using each
  block's `defaultSize`); shift right/down until a free slot is found.
- **Entrance animation:** the apply result tags newly-created node ids. The canvas
  applies a brief enter transition (fade + scale from ~0.96) via a node class and
  centers using the node's **measured** size (`node.measured`) instead of the
  hardcoded `+150/+100` offset in StudyCanvas.tsx.
- When a turn creates multiple cards, **fit to just those new node ids** so the
  whole new cluster glides into frame, rather than centering on one.

**tldraw removal.** Delete `SketchOverlay`, `CanvasOpenSketchButton`, the
`sketch`/`onSketchSnapshot` props and handlers, the `SketchNode` renderer and
`sketch` node type, and the `sketch` field on `CanvasState`. Remove the `tldraw`
dependency. Persisted `canvas_state.sketch` blobs are ignored on load — no data
migration required.

### Phase 2 — Block registry refactor

- Add `lib/studylab/blocks.ts` exporting the registry and helpers:
  `isAiCreatable(type)`, `paletteItems()`, `blockSize(type)`,
  `nodeTypesForReactFlow()`.
- `studyNodeTypes` in canvasNodes.tsx is derived from the registry.
- `applyActions` / `isValidAction` validate AI block creation against
  `isAiCreatable`.
- `StudyNodeData` gains additive optional fields: `source?`, `color?` (sticky),
  `quiz?` (quiz payload), `runner?` (runnable code state), `mermaid?`, `rows?`
  (table), `steps?` (worked example), `variant?` (callout: definition|tip|warning).
- `StudyNode` gains `source?: BlockSource` (defaults to `'ai'` for back-compat;
  freeform blocks set `'freeform'`).
- Existing persisted canvases continue to load unchanged.

### Phase 3 — Code runner engines

`lib/studylab/runner/` — one interface, pluggable engines, fully client-side.

```ts
interface RunResult { ok: boolean; stdout: string; stderr: string; previewHtml?: string }
interface RunEngine {
  language: string
  run(code: string, signal: AbortSignal): Promise<RunResult>
}
```

Engines:
- **Web preview** (`web` = combined html/css/js): render into a sandboxed
  `<iframe srcdoc>` with `sandbox="allow-scripts"`; re-renders on Run.
- **JavaScript/TypeScript** (`javascript`): run in a **Web Worker** (isolated,
  terminable on timeout); `console.*` piped to a terminal pane; TS transpiled with
  a lightweight pass (sucrase/esbuild-wasm) before running.
- **Python** (`python`): **Pyodide** lazy-loaded from CDN on first Run (cached
  thereafter); stdout/stderr captured. One-time load shows a spinner.
- **SQL** (`sql`): interface stub only this iteration (sql.js drop-in later).

Safety/UX:
- Every run is wrapped in a **timeout + worker terminate** to kill infinite loops.
- Output is escaped before render.
- Engines load **only when a runnable card is first run**, keeping initial
  LearnSpace load light.

**Runnable code card** (replaces the static `CodeNode`): language badge,
**Run**/**Stop** buttons, editable code area (CodeMirror), attached output pane
(text terminal for JS/Python, live iframe for web). The same component powers both
the AI's `code` cards and the freeform scratchpad; behavior is identical, only
`source` differs.

### Phase 4 — Freeform palette + toolbar

A palette toolbar docked on the canvas (replacing the old Sketch button). Drag an
item onto the canvas, or click to drop at viewport center. All items are
`source: 'freeform'`:

- **Code scratchpad** — blank runnable card (Phase 3), language picker, Run +
  terminal.
- **Sticky note** — compact, resizable, color picker
  (yellow/green/blue/pink/violet), plain text.
- **Text / markdown note** — larger card, markdown + LaTeX (reuses `SafeLatex`).
- **Connectors + labels** — drag from any card handle to any other to create a
  user edge (React Flow `onConnect`); drop small floating text labels. User edges
  are tagged distinct from AI edges and never modified by the tutor.

Behavior:
- Freeform blocks **persist** in `canvas_state`, carry `source: 'freeform'`, and
  are **excluded** from the `card_ids` sent to the tutor.
- Each freeform block has an **"Ask tutor about this"** action that explicitly
  sends that one block's content into the chat as the next user turn (opt-in
  bridge). This is the only path by which a freeform block enters AI context.
- Freeform blocks are ignored by step-grouping and checkpoint gating.

### Phase 5 — Knowledge-check checkpoint system

**New action** emitted by the tutor and expanded by `applyActions`:

```ts
{ type: 'checkpoint', id: string, step: number, gate: 'hard' | 'soft',
  questions: [
    { id, format: 'mcq',   prompt, options: string[], answer: number, explain },
    { id, format: 'short', prompt, rubric },
    { id, format: 'code',  prompt, language, starter, goal },
    { id, format: 'match', prompt, pairs: { left: string; right: string }[] },
  ]}
```

- The reducer drops a **checkpoint header node** + one **question node per item**
  as a tidy cluster in its own band, animated into frame (Phase 1).
- Question nodes are `source: 'ai'` (not draggable from the palette).

**Question nodes:**
- **MCQ** — tap an option → instant **client-side** grading from `answer`, reveals
  `explain`.
- **Match/order** — drag pairs/sequence on the node → **client-side** grading.
- **Short answer** — textarea → on submit, **AI-graded**.
- **Code challenge** — embeds a runnable card (Phase 3); student writes + runs; on
  submit the code + its output are **AI-graded** against `goal`.

**Grading.** MCQ and match grade client-side (no model call; answer key lives in
node data — acceptable for a study tool). Short-answer and code call a new route
**`POST /api/studylab/grade`** returning `{ pass, score, feedback }` per answer.

**Gating.** The Workspace tracks each checkpoint's state.
- **Hard** checkpoint (emitted at a step boundary, in place of grouping
  immediately): the step does not group and the next step stays locked until the
  student submits and meets the pass threshold. The chat still answers questions
  freely; only *advancing* is blocked.
- On submit, a synthetic user turn is sent to the tutor, e.g.
  `CHECKPOINT RESULT: 2/3 — missed Q2 (recursion base case)`. The tutor then:
  - **pass** → emit `groupStep` for the step + introduce the next step;
  - **fail** → re-teach the weak spot and offer a retry checkpoint.
- **Soft** checkpoint (mid-step "Quiz me on this") runs the same flow but never
  blocks advancement.

**Chat UX (`ChatMouthpiece`).**
- When a checkpoint arrives, render a prominent **"Take the check →"** button
  (distinct from suggestion chips) that zooms the canvas to the quiz cluster.
- A persistent **"Quiz me on this"** button is always available for
  student-initiated soft checks.

### Phase 6 — Tutor prompt + protocol upgrades

- Extend the system prompt, `isValidAction`, and `sanitizeResponse` for the new
  actions (`checkpoint`) and new card types.
- **New AI tutoring node types** (all `source: 'ai'`):
  - **Mermaid diagram** (`mermaid`) — AI emits Mermaid syntax; rendered to a real
    diagram. Replaces reliance on hand-written inline SVG for fl/tree/sequence/
    state diagrams. (Existing `diagram`/SVG path remains for one-off custom SVG.)
  - **Worked-example / steps** (`worked`) — numbered solution steps with LaTeX.
  - **Comparison table** (`table`) — rows/columns structured data.
  - **Callout / definition** (`callout`) — small accented card with
    `variant: definition | tip | warning`.
- **Runnable code:** instruct the tutor that `code` cards now execute, so it should
  prefer runnable languages (`web`/`javascript`/`python`) and write code that
  actually runs and demonstrates the point.
- **Checkpoint behavior:** emit a **hard** checkpoint right before it would
  `groupStep` a step (instead of grouping immediately); emit a **soft** checkpoint
  on a `Quiz me` request; choose the question format to fit the material
  (concept→mcq/short, procedure→match/order, coding→code). Wait for
  `CHECKPOINT RESULT` before advancing and branch on pass/fail.
- `card_ids` already exclude freeform blocks, so the prompt never sees scratch work.

## 6. Data model changes (additive)

- `StudyNode.source?: 'ai' | 'freeform'` (default `'ai'`).
- `StudyNodeData` optional fields: `color`, `quiz`, `runner`, `mermaid`, `rows`,
  `steps`, `variant`.
- `CanvasState.sketch` removed (ignored on load).
- New `TutorAction` member: `checkpoint`.
- `CanvasState` otherwise unchanged; all changes back-compatible with persisted
  rows in `learnspaces`.

## 7. New / changed files (anticipated)

- `lib/studylab/blocks.ts` (new) — block registry.
- `lib/studylab/runner/` (new) — runner interface + web/js/python engines.
- `lib/studylab/types.ts` — additive type changes; `checkpoint` action; remove
  `sketch`.
- `lib/studylab/actions.ts` — collision-aware placement; `checkpoint` expansion;
  new-node tagging; registry-based validation.
- `components/studylab/canvasNodes.tsx` — new renderers (runnable code, mermaid,
  worked, table, callout, the single `quiz` node rendering all four formats,
  sticky, note, checkpoint header); derive node types from registry; remove
  `SketchNode`.
- `components/studylab/StudyCanvas.tsx` — remove tldraw; palette toolbar; entrance
  animation + measured-size centering; freeform `onConnect`.
- `components/studylab/Workspace.tsx` — checkpoint state + gating; "Ask tutor about
  this" bridge; freeform-aware `card_ids`.
- `components/studylab/ChatMouthpiece.tsx` — checkpoint CTA + "Quiz me" button.
- `app/api/studylab/grade/route.ts` (new) — AI grading for short-answer + code.
- `app/api/studylab/tutor/route.ts` — prompt + action validation upgrades.

## 8. Risks / open considerations

- **Pyodide load weight** — mitigated by lazy-load on first Run + spinner; only
  paid when a student actually runs Python.
- **iframe sandbox** — `allow-scripts` only (no `allow-same-origin`) to keep student
  code from touching the app; output escaped.
- **Model JSON reliability for `checkpoint`** — reuse existing `parseJsonRobust` /
  `fixLatexInRawJson` + strict `isValidAction` filtering; malformed checkpoints are
  dropped rather than breaking the turn.
- **Answer keys client-side** — acceptable for a learning tool; not an exam system.
- **Prompt growth** — the system prompt gains several card types and the checkpoint
  protocol; keep card-type docs terse and example-driven to limit token growth.
```
