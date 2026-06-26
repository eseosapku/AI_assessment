# StudyLab Checkpoint Reliability + Presentation — Design

**Date:** 2026-06-26
**Status:** Approved for implementation
**Area:** StudyLab tutor checkpoints, layout, card rendering

## 1. Problems

- **Checkpoints rarely fire.** The tutor announces "let's do a checkpoint" but no quiz appears. Root cause: `isValidAction`'s checkpoint case uses `questions.every(isValidQuestion)` — one slightly-malformed question (missing `id`, `answer:"0"` instead of `0`) discards the **whole** checkpoint. (No card cap is wanted — deep study with many cards is fine.)
- **Layout is top-down; the student wants left→right.**
- **Card text looks raw** — markdown emphasis (`*weights*`) renders as literal asterisks.
- **Diagrams are vague** — no explanation; sometimes blank.
- **Calculations** render as cramped plain text.

## 2. Design

### 2.1 Checkpoints fire reliably (salvage, not all-or-nothing)

- `isValidAction` checkpoint: accept when `id` is a string and `questions` is a non-empty array — drop the strict `every` per-question gate; the reducer salvages.
- `applyActions` checkpoint case: backfill a missing question `id` (`<cpId>-q<i>`), **filter to valid questions, coerce common issues** (`coerceQuestion`: mcq `answer` → integer), default `gate` to `hard`. Build nodes only from the salvaged questions; skip only if none survive.
- `lib/studylab/quiz.ts`: loosen `isValidQuestion` mcq to accept a numeric-string `answer`; add `coerceQuestion(q)` (pure, TDD).
- Prompt nudge: emit the `checkpoint` action **in the same turn** you announce it; each question needs `id` + `prompt` + its fields.

### 2.2 Left-to-right layout

`lib/studylab/layout.ts`: `rankdir: 'TB'` → `'LR'` so the lesson grows left → right. Update the layout test to LR semantics (parent.x < child.x).

### 2.3 Markdown emphasis in card text

Upgrade `SafeLatex` (the shared text renderer used by every card) into a math+markdown renderer: split the string on `$…$` (math → KaTeX as today); in the remaining text render `**bold**` → `<strong>`, `*term*` → a highlighted bold span (brand blue). Input is HTML-escaped first, then only our own tags are added (safe). One change upgrades all cards.

### 2.4 Diagram caption + no blank diagrams

`MermaidNode`: render `data.body` (when present) as a one-line **caption under the diagram** explaining the flow; if the source is empty/failed, show "Diagram unavailable." Prompt: every `mermaid` card includes a short `body` explaining the flow, in simple valid syntax.

### 2.5 Calculation display

With 2.3, math wrapped in `$…$` renders via KaTeX. Prompt: put calculations/numbers in `worked` steps in `$…$` (e.g. `$(7 \times 0.5) + 0 = 3.5$`). Worked-step calculation lines then render as clean math instead of cramped text. (No new card type — LaTeX rendering is the lever.)

## 3. Files

- `lib/studylab/quiz.ts` (+ test) — `isValidQuestion` looser mcq, `coerceQuestion`.
- `lib/studylab/actions.ts` (+ checkpoint test) — lenient `isValidAction` checkpoint, reducer salvage.
- `lib/studylab/layout.ts` (+ test) — `rankdir: 'LR'`.
- `components/studylab/canvasShared.tsx` — `SafeLatex` math+emphasis.
- `components/studylab/MermaidNode.tsx` — caption + empty fallback.
- `app/api/studylab/tutor/route.ts` — prompt: same-turn checkpoint, mermaid caption, calculations in LaTeX.

## 4. Risks

- Salvage is forgiving but never fabricates — if all questions are unusable the checkpoint still won't appear (rare); the prompt nudge reduces that.
- `dangerouslySetInnerHTML` in the text renderer is fed HTML-escaped input with only whitelisted emphasis tags added — no injection surface.
- Behavior changes apply to new turns; existing cards unchanged.
