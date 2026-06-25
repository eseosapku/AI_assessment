# StudyLab Lesson-Plan Tutor — Design

**Date:** 2026-06-25
**Status:** Approved for implementation
**Area:** StudyLab tutor + canvas

## 1. Problem

The tutor improvises turn-by-turn: it rambles and glosses over things, never builds toward a checkpoint, explains too thinly, connects cards "upward" (messy tree), and ships bugs (Run button on read-only code → errors, tap-popover firing on Run clicks, mermaid rendering raw, disconnected step pills).

## 2. Decisions (from brainstorming)

- **Lesson plan = step outline up front, beats per step.**
- The whiteboard stays the lesson, but cards must actually teach.
- Fix layout (downward tree, connected step spine) and the bug batch.

## 3. Design

### 3.1 Lesson plan (the spine)

- **First turn** returns a `plan: { title: string; goal: string }[]` (4-6 steps) alongside its normal teaching of step 1.
- **Stored** in `canvas_state.plan` (additive JSON, no DB migration); persisted as usual.
- **Sidebar roadmap:** `StudyLabSidebar` lists the planned steps with the current one highlighted and earlier ones checked (replaces "Completed steps will appear here").
- Every turn sends the plan + current step to the tutor; it teaches toward the **current step's goal** and knows what's next. The plan is a flexible spine (it may insert a clarifying beat).

### 3.2 Beat-by-beat teaching

- A step spans several **beats** (turns). **"Continue" advances ONE beat** (1-2 cards toward the step goal) — never jumps straight to a checkpoint.
- The hard **checkpoint fires only when the current step's goal is fully covered**, then the next planned step begins.
- **Cards teach:** concept bodies are real explanatory paragraphs (analogy / concrete example), not bare bullets; the tutor varies approach (analogy → worked example → contrast).

### 3.3 Layout & connections

- **Downward tree:** the tutor connects **parent → child** (existing/earlier card → the new card). With dagre top-down, the lesson grows downward; a clarifying card hangs below what it elaborates.
- **Step spine:** `autoGroupStep` chains each new step-group pill to the previous one (Step 1 → Step 2 → …) so completed steps form a connected backbone, not floating pills.

### 3.4 Bug fixes

- **Showcase vs runnable code:** `createCard`/`StudyNodeData` gain `runnable?: boolean`. The runnable card shows **Run** only when `isRunnable(language)` AND `runnable !== false` AND not heuristic-showcase. Heuristic (`isShowcaseOnly`, pure, TDD): a `javascript` card whose code references `document`/`window`/`alert`/`localStorage`/`navigator`/`fetch` can't run in the worker → showcase (no Run). Prompt: set `runnable:false` for read-only snippets; use `html` for things meant to render.
- **Tap-popover only on the card body:** `onNodeClick` is suppressed when the click target is interactive — `e.target.closest('button, input, textarea, select, a, .nodrag')`.
- **Mermaid renders:** the renderer treats a `![alt](url)` markdown-image value as an image (renders `<img>`); on render error it shows a clean "Diagram unavailable" note instead of raw source. Prompt: mermaid must be simple valid syntax — `A[Label]` nodes, **no parentheses or markdown inside labels**, no `style`/markdown lines.

## 4. Files

- `lib/studylab/types.ts` — `CanvasState.plan`, `TutorResponse.plan`, `createCard.runnable`, `StudyNodeData.runnable`.
- `lib/studylab/runner/showcase.ts` (new) + test — `isShowcaseOnly`.
- `lib/studylab/actions.ts` — copy `runnable` in `createCard`; chain step pills in `autoGroupStep`.
- `app/api/studylab/tutor/route.ts` — prompt rewrite (plan, beats, connect direction, teach depth, mermaid rules, runnable); accept/return `plan`; render plan + step goal.
- `components/studylab/Workspace.tsx` — store/send `plan`.
- `components/studylab/StudyLabSidebar.tsx` — roadmap.
- `components/studylab/RunnableCodeCard.tsx` — Run only when runnable.
- `components/studylab/StudyCanvas.tsx` — suppress popover on interactive targets.
- `components/studylab/MermaidNode.tsx` — image + clean fallback.

## 5. Risks

- Beat/checkpoint pacing depends on the model judging "step goal covered" — guided by the plan goal; the Continue button drives it.
- Plan stored in `canvas_state` (not a column) — fine since it persists with the canvas.
- Behavior changes apply to new lessons/turns, not existing cards.
