# Task 3 Report: MaterialBoardNode + canvas registration + checkpoints

**Date:** 2026-09-15  
**Plan:** `docs/superpowers/plans/2026-09-14-build-material-tutor-mvp.md` Task 3  
**Depends on:** Task 2 (`f133e3d`)

## Deliverables

### 1. `MaterialBoardNode.tsx`

- Client component reading `id`, `data.materialSpec`, `data.materialState` from React Flow `NodeProps`.
- Missing `materialSpec` → `CardFrame` error shell (no crash).
- Controlled `MaterialState` hydrated from persisted state or `createInitialMaterialState(spec)`.
- Persists via `CanvasContext.onNodeDataChange(id, { materialState })` on every state change.
- Check wired through `tick(spec, state).solved` — sole solve authority; sets `status: 'solved'` and persists.
- Drives `MaterialRenderer` (which wraps `ActivityFrame` at 420px) with `onCheck`, `solved`, `onStateChange`.
- No adapter, `activityState`, or `onOutcome` — board-only free-form materials.

### 2. `canvasNodes.tsx`

- Registered `material: MaterialBoardNode` on `studyNodeTypes`.

### 3. `checkpointState.ts`

- After the activity loop, walks `n.type === 'material'` nodes with `materialSpec.satisfiesCheckpoint`.
- Marks checkpoint done when `materialState.status === 'solved'` — same row merge logic as activities.

### 4. Tests

- Added `lib/studylab/checkpointState.material.test.ts`:
  - solved material → checkpoint done
  - unsolved → not done
  - no `satisfiesCheckpoint` → ignored

## Gate

```
npx tsc --noEmit && npx vitest run
```

- **tsc:** pass
- **vitest:** 137 files, 1708 tests — all pass

## Out of scope (later tasks)

- Dispatch filter / prompt advertise (Task 4)
- HANDOVER (Task 5)
- No `.test.tsx` for MaterialBoardNode (per brief)

## Concerns

- None blocking. Hints/reveal omitted for MVP as allowed by brief.

## Review fix: solve gate clamp (2026-09-15)

**Finding:** `MaterialRenderer.place` / `changeControl` set `status: 'solved'` when live `tick()` is true (lines 77, 110). `MaterialBoardNode.handleStateChange` persisted that blindly, so checkpoints settled and Check disappeared without clicking Check.

**Fix:** `handleStateChange` now persists placement/controls but clamps status — only `'solved'` if already solved after Check; otherwise `'in_progress'`. Matches `MaterialActivity` pattern (`latest.status === 'solved' ? 'solved' : 'in_progress'`). `check()` unchanged as sole promote-to-solved path.

**MaterialRenderer:** confirmed unchanged (live preview elsewhere may rely on tick-derived status).

**Tests:** no new test (clamp is inline in node; skipped per brief — no `.test.tsx`).

**Gate:** `npx tsc --noEmit && npx vitest run` — 137 files, 1708 tests pass.
