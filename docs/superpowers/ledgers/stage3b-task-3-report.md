# Stage 3b Task 3 Report — MaterialActivity bridge

## Status

DONE

## Implementation

- Created `components/studylab/material/MaterialActivity.tsx` from the locked Task 3 plan.
- Seeds controlled `MaterialState` from persisted `work.assign` through `assignToPlacement`.
- Persists each board change as the unchanged activity shape `{ work: { assign } }`.
- Maps rejected sorting-frame slot ids back to bin ids for activity telemetry.
- Uses `tick(materialSpec, materialState).solved` as the solve authority and legacy `sortModule.validate` only to derive failed-check `wrongIds`.
- Preserves attempts, elapsed time, hint cycling, reveal state, outcomes, and solved-state Check suppression.
- Does not call `fromLegacy`, modify `ActivityNode`, or remove `SortActivity`.

## Verification

- `npx tsc --noEmit` — PASS.
- `npx vitest run` — PASS: 121 files, 1564 tests.
- IDE diagnostics — no errors in `MaterialActivity.tsx`.
- `git diff --cached --check` — PASS before commit.

## Self-review

- Compared the implementation against every Task 3 behavior and global constraint.
- Confirmed Task 2's controlled renderer props match the plan without adaptation.
- Confirmed persisted rejects remain activity-shaped while renderer rejects remain material-shaped.
- Confirmed partial boards produce no wrong highlights through `sortModule.validate`.
- No concerns found. The documented latest-state closure behavior matches `useActivityState` and the task ruling.

## Commit

- `154f85a feat(studylab): MaterialActivity bridges sort work to MaterialRenderer`

Local commit only; nothing pushed.

## Important review fixes

- Made `tick(materialSpec, materialState).solved` the sole authority for `validate.ok`, persisted solved status, reveal, and outcome. Legacy sort validation now contributes only `wrongIds` when the tick is unsolved.
- Added a synchronously updated `activityRef`; refusal and placement callbacks build from its latest value, so the placement callback cannot erase a refusal emitted earlier in the same `place()` call.
- Preserved refusal target mapping as `binIdFromSlot(slotId) ?? slotId`.

## Fix verification

- `npx tsc --noEmit` — PASS.
- `npx vitest run` — PASS: 121 files, 1564 tests.
- IDE diagnostics — no errors in `MaterialActivity.tsx`.
