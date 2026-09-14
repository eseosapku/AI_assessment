# Stage 3b — Live cutover: `scenario` → `decision-branch`

**Status:** Designed 2026-09-14; not built  
**Date:** 2026-09-14  
**Parent:** `docs/superpowers/specs/2026-09-07-studylab-composable-material-engine-design.md`  
**Depends on:** Stage 3b sort / sequence / compare / balance / label / vary cutovers.  
**Prior cuts:**  
- `docs/superpowers/specs/2026-09-10-sort-sorting-frame-live-cutover-design.md`  
- `docs/superpowers/specs/2026-09-10-sequence-ordering-track-live-cutover-design.md`  
- `docs/superpowers/specs/2026-09-13-compare-venn-sets-live-cutover-design.md`  
- `docs/superpowers/specs/2026-09-13-balance-balance-beam-live-cutover-design.md`  
- `docs/superpowers/specs/2026-09-14-label-labelled-diagram-live-cutover-design.md`  
- `docs/superpowers/specs/2026-09-14-vary-variable-model-live-cutover-design.md`

## The problem

Six patterns already render through the material vocabulary on the live path.
`scenario` still uses `ScenarioActivity` (click a choice → auto-grade; then
preview other consequences). Its work shape is `{ chosen: string | null }`.
The `decision-branch` canon already converts payloads (capacity-1 `s-chosen`,
pool slot, gauge bound to `sum_accepted_chosen`) and equivalence maps
placement group `chosen` → `work.chosen`. The missing piece is a work adapter
and an `ActivityNode` wire-up.

## What this cut builds

**One live path only:** when `ActivityNode` sees `pattern: 'scenario'`, it tries
`getApparatus('decision-branch')!.legacy!.fromLegacy(payload, success)`. On
success it mounts `MaterialActivity` with a **scenario adapter**. On `null` it
keeps `ScenarioActivity` unchanged.

Add pure helpers for `chosen` ↔ placement (`s-chosen`), a `scenarioAdapter`,
and an `/dev/activities` `n-scenario` fixture.

No other patterns. No `build_material`. `ScenarioActivity.tsx` is **not deleted**.

## Non-goals

- Cutover of compose, threePeriod.
- Deleting `ScenarioActivity` or prior legacy activities.
- Recreating click-to-auto-grade, post-answer consequence preview, or situation
  `imageUrl` in MaterialRenderer — material path is drag-to-slot + Check.
  Grading and `{ chosen }` persistence only.
- Stage 4 tutor / `build_material`.
- `.test.tsx` files.
- Changing capacity-1 swap or prior adapters beyond what this cut needs.

## Architecture

```
ActivitySpec { pattern: 'scenario', payload, success, … }
        │
        ├─ fromLegacy(payload, success) ──null──► ScenarioActivity
        │
        └─ MaterialSpec (decision-branch)
                │
                ▼
        MaterialActivity + scenarioAdapter
          • work.chosen ↔ placement[id] = 's-chosen'
          • other choices unplaced (prefer unplaced over s-pool)
          • freshWork → { chosen: null }
          • MaterialRenderer (slots + gauge display)
          • Check → tick().solved + scenarioModule.validate (wrongIds only)
```

### Conversion

Reuse `decision-branch` canon as-is. Call with **both** payload and success.
Success must be `exactSet` when provided; accepted ids become trait
`accepted: 1|0`. No catalogue art.

### Placement ↔ `{ chosen }` mapping

| Direction | Mapping |
|---|---|
| Hydrate | if `chosen` is a non-empty string → `placement[chosen] = 's-chosen'`; else `{}` |
| Persist | `chosen` = the unique piece id whose placement is `s-chosen`, else `null`; ignore `s-pool` and unplaced |
| Fresh | `{ chosen: null }` |

If more than one piece somehow sits on `s-chosen` (should not — capacity 1),
pick deterministically (e.g. first lexicographic id) for persist stability.

Unit-test: round-trip chosen; null ↔ empty; `s-pool` ignored on persist.

### Adapter

```ts
export const scenarioAdapter: MaterialWorkAdapter = {
  freshWork() { return { chosen: null } },
  placementFromWork(work) { /* chosen → s-chosen */ },
  workFromPlacement(placement) { /* s-chosen → chosen */ },
  wrongIdsWhenUnsolved(payload, work, success) {
    return scenarioModule.validate(payload as never, work as never, success).wrongIds
  },
  refusalTarget(slotId) {
    return binIdFromSlot(slotId) ?? slotId  // 'chosen' | 'pool'
  },
}
```

Do **not** call `fromLegacy` inside the bridge. Dedicated `scenarioAdapter`.

### Check / hints / outcomes

Same contract as prior cutovers (not legacy auto-grade):

1. `tick(materialSpec, state).solved` is the sole solve authority
   (`numericWithin` on `sum_accepted_chosen`).
2. When unsolved, `scenarioModule.validate` supplies `wrongIds` only.
3. `buildOutcome` + `onOutcome` on every Check.
4. Hints: `HINT_AFTER_ATTEMPTS = 2`.
5. Keep `activityRef` refusal/state-change ordering.

### Interaction note (intentional)

Legacy `ScenarioActivity` auto-grades on the first click and allows consequence
preview without changing `work`. The material path requires placing a chip on
**My choice** and pressing **Check**. Success criteria are grading and
`{ chosen }` persistence, not click-auto-grade UX.

### Testing

| Kind | What |
|---|---|
| Unit | `chosen` ↔ placement helpers |
| Forbidden | `.test.tsx` |
| Browser | `/dev/activities`: add `n-scenario` — drag safe→chosen, Check solves; wrong choice Check fails; smoke prior cutovers |
| Gate | `npx tsc --noEmit && npx vitest run` |

### Success criteria

1. Well-formed live `scenario` draws through `MaterialRenderer` / decision-branch.
2. `fromLegacy` null → `ScenarioActivity`.
3. Persisted `activityState.work.chosen` round-trips across remount.
4. Check / outcomes / hints fire; tick sole solve authority.
5. Prior six cutovers unchanged.
6. `ScenarioActivity.tsx` remains; suite green; nothing pushed without an
   explicit decision.

## Risks

- **Auto-grade expectation:** Students/tutors used to one-click grade will see
  Check — document as intentional.
- **Pool vs unplaced:** Hydrate with unplaced so remounts match other cutovers;
  persist ignores `s-pool`.
- **wrongIds:** Only the chosen id can be wrong (legacy membership rule) —
  do not invent missing-set wrongIds.

## Migration relationship

Seventh live apparatus takeover. Deletion of `ScenarioActivity` is a later
explicit decision after this path has been driven in a real lesson.
