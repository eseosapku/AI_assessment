# Stage 3b — Live cutover: `compose` → `bonding-ring`

**Status:** Designed 2026-09-14; not built  
**Date:** 2026-09-14  
**Parent:** `docs/superpowers/specs/2026-09-07-studylab-composable-material-engine-design.md`  
**Depends on:** Stage 3b prior seven live cutovers.  
**Prior cuts:**  
- `docs/superpowers/specs/2026-09-10-sort-sorting-frame-live-cutover-design.md`  
- `docs/superpowers/specs/2026-09-10-sequence-ordering-track-live-cutover-design.md`  
- `docs/superpowers/specs/2026-09-13-compare-venn-sets-live-cutover-design.md`  
- `docs/superpowers/specs/2026-09-13-balance-balance-beam-live-cutover-design.md`  
- `docs/superpowers/specs/2026-09-14-label-labelled-diagram-live-cutover-design.md`  
- `docs/superpowers/specs/2026-09-14-vary-variable-model-live-cutover-design.md`  
- `docs/superpowers/specs/2026-09-14-scenario-decision-branch-live-cutover-design.md`

## The problem

Seven patterns already render through the material vocabulary on the live path.
`compose` still uses `ComposeActivity` (drag part onto part with degree/`accepts`
control of error). Its work shape is `{ joins: [string, string][] }`. The
`bonding-ring` canon already converts payloads into bond chips
(`bond-${joinId}`) on `s-joined` / pool with a gauge bound to
`sum_bondValue_joined`, and equivalence maps placement → joins. The missing
piece is a work adapter and an `ActivityNode` wire-up.

## What this cut builds

**One live path only:** when `ActivityNode` sees `pattern: 'compose'`, it tries
`getApparatus('bonding-ring')!.legacy!.fromLegacy(payload, success)`. On
success it mounts `MaterialActivity` with a **compose adapter**. On `null` it
keeps `ComposeActivity` unchanged.

Add pure helpers for `joins` ↔ placement (`bond-*` → `s-joined`), a
`composeAdapter`, and browser verification on the existing `/dev/activities`
`n-compose` fixture (water).

No other patterns. No `build_material`. `ComposeActivity.tsx` is **not deleted**.

## Non-goals

- Cutover of threePeriod.
- Deleting `ComposeActivity` or prior legacy activities.
- Recreating part-onto-part drag, molecule SVG, or legacy `accepts()` degree
  refusals in MaterialRenderer — material path is bond chips into the ring +
  Check. Grading and `{ joins }` persistence only.
- Stage 4 tutor / `build_material`.
- `.test.tsx` files.

## Architecture

```
ActivitySpec { pattern: 'compose', payload, success, … }
        │
        ├─ fromLegacy(payload, success) ──null──► ComposeActivity
        │
        └─ MaterialSpec (bonding-ring)
                │
                ▼
        MaterialActivity + composeAdapter
          • work.joins ↔ placement[bond-${joinId}] = 's-joined'
          • non-joined bonds unplaced (prefer unplaced over s-pool)
          • freshWork → { joins: [] }
          • MaterialRenderer (slots + gauge)
          • Check → tick().solved + composeModule.validate (wrongIds only)
```

### Conversion

Reuse `bonding-ring` canon as-is. Call with **both** payload and success.
Piece ids are `bond-${joinId(from,to)}` using `joinId` from `compose.ts`.
No catalogue art.

### Placement ↔ `{ joins }` mapping

Use `joinId` from `@/lib/studylab/activities/patterns/compose` as the single
normaliser.

| Direction | Mapping |
|---|---|
| Hydrate | each `[a,b]` in `joins` → `placement[\`bond-${joinId(a,b)}\`] = 's-joined'` |
| Persist | each piece on `s-joined` whose id starts with `bond-` → pair via strip prefix + `split('-')` into two segments (match equivalence; part ids must not contain `-`); ignore `s-pool` |
| Fresh | `{ joins: [] }` |

Determinism: when building `joins` from placement, sort pairs by `joinId(a,b)`
lexicographically so persisted arrays are stable.

Unit-test: round-trip water bonds; empty joins ↔ empty placement; `s-pool`
ignored; bond id uses `joinId` order (drag order of pair elements irrelevant).

### Adapter

```ts
export const composeAdapter: MaterialWorkAdapter = {
  freshWork() { return { joins: [] } },
  placementFromWork(work) { /* joins → s-joined */ },
  workFromPlacement(placement) { /* s-joined → joins */ },
  wrongIdsWhenUnsolved(payload, work, success) {
    return composeModule.validate(payload as never, work as never, success).wrongIds
  },
  refusalTarget(slotId) {
    return binIdFromSlot(slotId) ?? slotId
  },
}
```

Empty allow rules — wrong subsets stand until Check (like balance). Dedicated
`composeAdapter`. Do not call `fromLegacy` inside the bridge.

### Check / hints / outcomes

Same contract as prior cutovers:

1. `tick().solved` sole solve authority (`numericWithin` on bond-value sum).
2. When unsolved, `composeModule.validate` supplies `wrongIds` only (empty when
   no joins yet).
3. `buildOutcome` + `onOutcome` on every Check.
4. Hints: `HINT_AFTER_ATTEMPTS = 2`.
5. Keep `activityRef` refusal/state-change ordering.

### Interaction note (intentional)

Legacy `ComposeActivity` draws parts and bonds via part-onto-part drag with
`accepts()`. The material path shows bond chips and a bonding-ring slot plus
gauge. Success criteria are grading and `{ joins }` persistence, not
pixel-identical molecules.

### Testing

| Kind | What |
|---|---|
| Unit | joins ↔ placement helpers |
| Forbidden | `.test.tsx` |
| Browser | `/dev/activities` `n-compose` — drag both H—O bonds to ring; Check solves; smoke prior cutovers |
| Gate | `npx tsc --noEmit && npx vitest run` |

### Success criteria

1. Well-formed live `compose` draws through `MaterialRenderer` / bonding-ring.
2. `fromLegacy` null → `ComposeActivity`.
3. Persisted `activityState.work.joins` round-trips across remount.
4. Check / outcomes / hints fire; tick sole solve authority.
5. Prior seven cutovers unchanged.
6. `ComposeActivity.tsx` remains; suite green; nothing pushed without an
   explicit decision.

## Risks

- **Bond id parse:** `bond-`.strip + split on `-` assumes part ids have no
  hyphens (same as equivalence). Document; do not invent a second joinId format.
- **Extra valid bonds:** Canon includes all label-valid candidate bonds as
  chips; success subset is the gauge target — extra chips on the ring keep
  Check unsolved (powers-of-two sum).
- **UX gap:** Students used to part-onto-part must learn bond chips — intentional.

## Migration relationship

Eighth live apparatus takeover. Deletion of `ComposeActivity` is a later
explicit decision after this path has been driven in a real lesson.
