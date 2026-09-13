# Stage 3b — Live cutover: `label` → `labelled-diagram`

**Status:** Designed 2026-09-14; not built  
**Date:** 2026-09-14  
**Parent:** `docs/superpowers/specs/2026-09-07-studylab-composable-material-engine-design.md`  
**Depends on:** Stage 3b sort / sequence / compare / balance cutovers (`MaterialActivity` adapters,
controlled `MaterialRenderer`, capacity-1 swap).  
**Prior cuts:**  
- `docs/superpowers/specs/2026-09-10-sort-sorting-frame-live-cutover-design.md`  
- `docs/superpowers/specs/2026-09-10-sequence-ordering-track-live-cutover-design.md`  
- `docs/superpowers/specs/2026-09-13-compare-venn-sets-live-cutover-design.md`  
- `docs/superpowers/specs/2026-09-13-balance-balance-beam-live-cutover-design.md`

## The problem

Four patterns already render through the material vocabulary on the live path.
`label` still uses `LabelActivity` (SVG/diagram image with circular hotspots).
Its work shape looks like sort’s `assign`, but the **key direction is flipped**:
legacy `LabelWork.assign` is **`hotspotId → label`**, while material placement and
`labelled-diagram`’s `binAssignment` goal are **`label → hotspotId`** (piece id is
the label text). Equivalence already flips between them. The missing piece is a
work adapter that preserves that flip and an `ActivityNode` wire-up.

## What this cut builds

**One live path only:** when `ActivityNode` sees `pattern: 'label'`, it tries
`getApparatus('labelled-diagram')!.legacy!.fromLegacy(payload, success)`. On
success it mounts `MaterialActivity` with a **label adapter**. On `null` it
keeps `LabelActivity` unchanged.

Add pure helpers for legacy hotspot→label assign ↔ placement (`label` →
`s-${hotspotId}`), a `labelAdapter`, and a `/dev/activities` `n-label` fixture
(none exists today). Do **not** add catalogue art — label pieces are text; the
diagram `imageUrl`/`svg` is not mapped into material chips.

No other patterns. No `build_material`. `LabelActivity.tsx` is **not deleted**.

## Non-goals

- Cutover of vary, scenario, compose, threePeriod.
- Deleting `LabelActivity` or prior legacy activities.
- Recreating the legacy diagram image with circular hotspot overlays — material
  path uses labeled capacity-1 slots. Grading and persistence parity only.
- Stage 4 tutor / `build_material`.
- `.test.tsx` files.
- Changing capacity-1 swap or interpreter bind/display logic beyond what the
  adapter needs.
- Mapping diagram `image` into `MaterialRenderer` (intentional gap).

## Architecture

```
ActivitySpec { pattern: 'label', payload, success, … }
        │
        ├─ fromLegacy(payload, success) ──null──► LabelActivity
        │
        └─ MaterialSpec (labelled-diagram)
                │
                ▼
        MaterialActivity + labelAdapter
          • work.assign hotspotId→label ↔ placement label→s-${hotspotId}
          • freshWork → { assign: {} }
          • allow rules refuse wrong hotspot (mirrors accepts())
          • Check → tick().solved + labelModule.validate (wrongIds only)
```

### Conversion

Reuse `labelled-diagram` canon as-is. Call with **both** payload and success.
Piece ids are label strings; slots are `s-${hotspot.id}` with `capacity: 1` and
per-hotspot `allow` rules. No `catalogueArt` change.

### Placement ↔ legacy `assign` mapping (the flip)

| Direction | Mapping |
|---|---|
| Hydrate | each `[hotspotId, label]` in `work.assign` → `placement[label] = s-${hotspotId}` |
| Persist | each `[label, slotId]` in placement → `assign[binIdFromSlot(slotId)] = label` |
| Fresh | `{ assign: {} }` — all labels unplaced |

Unit-test the helpers: round-trip full and partial boards; drop non-`s-*`
slots; empty assign ↔ empty placement. Pin that keys and values swap roles
relative to `sortPlacement` (do **not** call `assignToPlacement` on raw
`work.assign`).

### Adapter

```ts
export const labelAdapter: MaterialWorkAdapter = {
  freshWork() {
    return { assign: {} }
  },
  placementFromWork(work) {
    return labelAssignToPlacement((work.assign as Record<string, string>) ?? {})
  },
  workFromPlacement(placement) {
    return { assign: placementToLabelAssign(placement) }
  },
  wrongIdsWhenUnsolved(payload, work, success) {
    return labelModule.validate(payload as never, work as never, success).wrongIds
  },
  refusalTarget(slotId) {
    return binIdFromSlot(slotId) ?? slotId  // hotspot id
  },
}
```

Do **not** call `fromLegacy` inside the bridge — conversion stays in
`ActivityNode`. Dedicated `labelAdapter` — do not overload sort/compare.

### Check / hints / outcomes

Same contract as prior cutovers:

1. `tick(materialSpec, state).solved` is the sole solve authority.
2. When unsolved, `labelModule.validate` supplies `wrongIds` only (often empty
   until every hotspot is labelled — unfinished board is not “wrong”).
3. `buildOutcome` + `onOutcome` on every Check.
4. Hints: `HINT_AFTER_ATTEMPTS = 2`.
5. Keep `activityRef` refusal/state-change ordering.

### Interaction note (intentional)

Legacy `LabelActivity` draws the diagram image and circular drop targets; wrong
labels shake and refuse via `accepts()`. The material path shows labeled slots
plus chips; allow-rule refusals + capacity-1 swap cover correction. Success
criteria are grading and `assign` persistence (hotspot→label), not a pixel-
identical diagram.

### Testing

| Kind | What |
|---|---|
| Unit | hotspot→label ↔ placement helpers round-trip + flip pin |
| Forbidden | `.test.tsx` |
| Browser | `/dev/activities`: add `n-label` — place correct labels, wrong drop refuses, Check solves; smoke sort/sequence/compare/balance |
| Gate | `npx tsc --noEmit && npx vitest run` |

### Success criteria

1. Well-formed live `label` draws through `MaterialRenderer` / labelled-diagram.
2. `fromLegacy` null → `LabelActivity`.
3. Persisted `activityState.work.assign` stays **hotspotId → label** across remount.
4. Check / outcomes / hints fire; tick sole solve authority.
5. Sort, sequence, compare, and balance cutovers unchanged.
6. `LabelActivity.tsx` remains; suite green; nothing pushed without an
   explicit decision.

## Risks

- **Assign direction:** Using `sortPlacement.assignToPlacement` on legacy work
  without flipping silently inverts keys/values and breaks persistence /
  equivalence. Dedicated helpers + tests are mandatory.
- **Piece id = label text:** Duplicate labels are already rejected by
  `labelModule.isPayload`; do not weaken that.
- **Diagram gap:** Students lose the background image on the material path —
  document as intentional until a later visual pass.
- **wrongIds empty mid-board:** Match legacy — unfinished boards are not wrong.

## Migration relationship

Fifth live apparatus takeover. Deletion of `LabelActivity` is a later
explicit decision after this path has been driven in a real lesson.
