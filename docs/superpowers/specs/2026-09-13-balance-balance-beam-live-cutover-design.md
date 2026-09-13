# Stage 3b — Live cutover: `balance` → `balance-beam`

**Status:** Designed 2026-09-13; not built  
**Date:** 2026-09-13  
**Parent:** `docs/superpowers/specs/2026-09-07-studylab-composable-material-engine-design.md`  
**Depends on:** Stage 3b sort / sequence / compare cutovers (`MaterialActivity` adapters,
controlled `MaterialRenderer`, `catalogueArt`, capacity-1 swap).  
**Prior cuts:**  
- `docs/superpowers/specs/2026-09-10-sort-sorting-frame-live-cutover-design.md`  
- `docs/superpowers/specs/2026-09-10-sequence-ordering-track-live-cutover-design.md`  
- `docs/superpowers/specs/2026-09-13-compare-venn-sets-live-cutover-design.md`

## The problem

Three patterns already render through the material vocabulary on the live path.
`balance` still uses `BalanceActivity` (absolute pans + pool strip). Its work
shape is `{ left: string[]; right: string[] }` — not `assign` — and a fresh board
seeds pans from the authored payload via `balanceModule.initialWork`. The
`balance-beam` canon already converts payloads (with a beam display bound to
`sum_weight_left - sum_weight_right`) and equivalence pins grading agreement.
The missing piece is a work adapter and an `ActivityNode` wire-up.

## What this cut builds

**One live path only:** when `ActivityNode` sees `pattern: 'balance'`, it tries
`getApparatus('balance-beam')!.legacy!.fromLegacy(payload, success)`. On success
it mounts `MaterialActivity` with a **balance adapter**. On `null` it keeps
`BalanceActivity` unchanged.

Add pure helpers for `left`/`right` ↔ placement (`s-left` / `s-right`), a
`balanceAdapter`, and `catalogueArt` on `balanceBeam.convert` pieces. The beam
`DisplayView` path already exists in `MaterialRenderer` — do not rebuild it.

No other patterns. No `build_material`. `BalanceActivity.tsx` is **not deleted**.

## Non-goals

- Cutover of label, vary, scenario, compose, threePeriod.
- Deleting `BalanceActivity` or prior legacy activities.
- Recreating the legacy absolute-pan / beam SVG layout — material path uses
  slots + the vocabulary beam display. Grading and persistence parity only.
- Stage 4 tutor / `build_material`.
- `.test.tsx` files.
- Changing capacity-1 swap or interpreter bind/display logic beyond what the
  adapter needs.

## Architecture

```
ActivitySpec { pattern: 'balance', payload, success, … }
        │
        ├─ fromLegacy(payload, success) ──null──► BalanceActivity
        │
        └─ MaterialSpec (balance-beam)
                │
                ▼
        MaterialActivity + balanceAdapter
          • work.left / work.right ↔ placement s-left / s-right
          • unplaced (or s-pool) = pool — not in work arrays
          • freshWork → balanceModule.initialWork(payload)
          • MaterialRenderer (beam display via existing bind/tick)
          • Check → tick().solved + balanceModule.validate (wrongIds only)
```

### Conversion

Reuse `balance-beam` canon. Call with **both** payload and success. In `convert`,
map catalogue art on every item from `left`, `right`, and `pool`:

```ts
const art = catalogueArt(item.imageUrl)
return {
  id: item.id,
  label: item.label,
  ...(art ? { art } : {}),
  traits: { weight: item.weight },
}
```

### Placement ↔ `{ left, right }` mapping

Canon slots: `s-left`, `s-right`, `s-pool` (group ids `left` / `right` / `pool`).
Equivalence already maps fixture group ids through `` `s-${groupId}` ``.

| Direction | Mapping |
|---|---|
| Hydrate | each id in `work.left` → `placement[id] = 's-left'`; each in `work.right` → `'s-right'`; ids in neither stay **unplaced** (MaterialFrame pool strip) |
| Persist | `left` = piece ids whose placement is `s-left`; `right` = those on `s-right`; ignore `s-pool` and unplaced |
| Fresh | `balanceModule.initialWork(payload)` then hydrate — authored pans occupied, pool items unplaced |

Prefer **unplaced** for pool items over forcing `s-pool`, so the existing pool
strip UI matches sort/compare. If a student drops onto `s-pool`, persist still
omits them from `left`/`right` (same as unplaced for grading).

Determinism: when building `left`/`right` arrays from placement, sort ids
lexicographically (or walk `Object.keys` of placement in a fixed order) so
persisted arrays are stable across remounts. Grading uses `sideTotal` (order
independent); stable order still helps diffs and tests.

Unit-test the helpers: round-trip a full pans+pool board; unplaced ↔ not in
arrays; `s-pool` treated like unplaced for work.

### Adapter

```ts
export const balanceAdapter: MaterialWorkAdapter = {
  freshWork(payload, _seed) {
    if (balanceModule.isPayload(payload)) return balanceModule.initialWork(payload) as …
    return { left: [], right: [] }
  },
  placementFromWork(work, _spec) { /* left/right → s-left/s-right */ },
  workFromPlacement(placement, _spec, _payload) { /* s-left/s-right → left/right */ },
  wrongIdsWhenUnsolved(payload, work, success) {
    return balanceModule.validate(payload as never, work as never, success).wrongIds
  },
  refusalTarget(slotId) {
    return binIdFromSlot(slotId) ?? slotId  // 'left' | 'right' | 'pool'
  },
}
```

Do **not** call `fromLegacy` inside the bridge — conversion stays in
`ActivityNode`.

### Check / hints / outcomes

Same contract as prior cutovers:

1. `tick(materialSpec, state).solved` is the sole solve authority (beam at
   target within tolerance).
2. When unsolved, `balanceModule.validate` supplies `wrongIds` only (often empty
   for `numericWithin` — that matches legacy).
3. `buildOutcome` + `onOutcome` on every Check.
4. Hints: `HINT_AFTER_ATTEMPTS = 2`.
5. Keep `activityRef` refusal/state-change ordering.

### Interaction note (intentional)

Legacy `BalanceActivity` draws absolute pans on a beam graphic. The material
path shows labeled slots plus the vocabulary **beam** display driven by
`tick().displays`. No `accepts()` / empty allow rules — wrong pans stand until
Check. Success criteria are grading and `{ left, right }` persistence, not
pixel-identical pan layout.

### Testing

| Kind | What |
|---|---|
| Unit | `left`/`right` ↔ placement helpers round-trip; pool/unplaced/`s-pool` |
| Unit | `catalogueArt` pin for balance-beam fromLegacy |
| Forbidden | `.test.tsx` |
| Browser | `/dev/activities`: `n-balance` (exists) — drag pool→pans, beam moves, Check solves balanced board; smoke sort/sequence/compare |
| Gate | `npx tsc --noEmit && npx vitest run` |

### Success criteria

1. Well-formed live `balance` draws through `MaterialRenderer` / balance-beam
   (slots + beam display).
2. `fromLegacy` null → `BalanceActivity`.
3. Persisted `activityState.work.{left,right}` round-trips across remount (unit +
   seed path).
4. Check / outcomes / hints fire; tick sole solve authority.
5. Sort, sequence, and compare cutovers unchanged.
6. `BalanceActivity.tsx` remains; suite green; nothing pushed without an
   explicit decision.

## Risks

- **Pool representation:** Mixing unplaced and `s-pool` in one board is fine for
  grading if persist ignores both; document that hydrate always uses unplaced
  for pool so remounts look consistent.
- **Pre-placed pans:** Forgetting `initialWork` empties the pans and changes the
  lesson’s starting point.
- **Display extent:** Convert already sets beam `min`/`max` from total weight —
  do not invent a second display.
- **wrongIds empty:** `numericWithin` often returns no wrong ids; do not invent
  pan highlighting unless legacy already does.

## Migration relationship

Fourth live apparatus takeover. Deletion of `BalanceActivity` is a later
explicit decision after this path has been driven in a real lesson.
