# Stage 3b — Live cutover: `compare` → `venn-sets`

**Status:** Designed 2026-09-13; not built  
**Date:** 2026-09-13  
**Parent:** `docs/superpowers/specs/2026-09-07-studylab-composable-material-engine-design.md`  
**Depends on:** Stage 3b sort + sequence cutovers (`MaterialActivity` adapters, controlled `MaterialRenderer`, `catalogueArt`).  
**Prior cuts:**  
- `docs/superpowers/specs/2026-09-10-sort-sorting-frame-live-cutover-design.md`  
- `docs/superpowers/specs/2026-09-10-sequence-ordering-track-live-cutover-design.md`

## The problem

`sort` and `sequence` already render through the material vocabulary on the live
path. `compare` still uses `CompareActivity` (drawn Venn zones). Its work shape
is `{ assign: Record<itemId, 'left' | 'right' | 'both'> }` — the same bin-style
assign as sort, already mapped by `sortPlacement` onto `s-${binId}` slots that
`venn-sets` uses (`s-left`, `s-both`, `s-right`). The missing piece is a
`compareAdapter` and an `ActivityNode` wire-up.

## What this cut builds

**One live path only:** when `ActivityNode` sees `pattern: 'compare'`, it tries
`getApparatus('venn-sets')!.legacy!.fromLegacy(payload, success)`. On success it
mounts `MaterialActivity` with a **compare adapter**. On `null` it keeps
`CompareActivity` unchanged.

Reuse existing `sortPlacement` helpers (no new placement module). Add
`compareAdapter` beside `sortAdapter` / `sequenceAdapter`. Map legal
`item.imageUrl` → `piece.art` via shared `catalogueArt` in `vennSets.convert`.

No other patterns. No `build_material`. `CompareActivity.tsx` is **not deleted**.

## Non-goals

- Cutover of balance, label, vary, scenario, compose, threePeriod.
- Deleting `CompareActivity` or prior legacy activities.
- Recreating the SVG/CSS Venn crescent layout — the material path uses three
  labeled slots (vocabulary-native). Grading and persistence parity only.
- Stage 4 tutor / `build_material`.
- `.test.tsx` files.
- Changing capacity-1 swap behaviour (not needed: compare slots use capacity =
  item count and start empty).

## Architecture

```
ActivitySpec { pattern: 'compare', payload, success, … }
        │
        ├─ fromLegacy(payload, success) ──null──► CompareActivity
        │
        └─ MaterialSpec (venn-sets)
                │
                ▼
        MaterialActivity + compareAdapter
          • work.assign ↔ placement via sortPlacement (s-left / s-both / s-right)
          • freshWork → { assign: {} } (empty pool)
          • MaterialRenderer (no allow rules — wrong drops stand)
          • Check → tick().solved + compareModule.validate (wrongIds only)
```

### Conversion

Reuse `venn-sets` canon. Call with **both** payload and success. In `convert`,
map catalogue art the same way as sorting-frame / ordering-track
(`catalogueArt(item.imageUrl)`).

### Placement ↔ `assign` mapping

| Direction | Mapping |
|---|---|
| Hydrate | `work.assign[itemId] = zone` → `placement[itemId] = \`s-${zone}\`` |
| Persist | `placement[itemId] = \`s-${zone}\`` → `assign[itemId] = zone` |
| Fresh | `{ assign: {} }` via `compareModule.initialWork` / empty assign |
| Unplaced | absent from placement ↔ absent from assign |

Zones are exactly `left` | `both` | `right` (group ids in the canon). Ignore
non-`s-*` placement keys when persisting (existing `placementToAssign`).

### Adapter

```ts
export const compareAdapter: MaterialWorkAdapter = {
  freshWork() { return { assign: {} } }, // or compareModule.initialWork()
  placementFromWork(work) {
    return assignToPlacement((work.assign as Record<string, string>) ?? {})
  },
  workFromPlacement(placement) {
    return { assign: placementToAssign(placement) }
  },
  wrongIdsWhenUnsolved(payload, work, success) {
    return compareModule.validate(payload as never, work as never, success).wrongIds
  },
  refusalTarget(slotId) {
    return binIdFromSlot(slotId) ?? slotId
  },
}
```

Almost identical to `sortAdapter`; the only behavioural difference is which
module supplies `wrongIds` (and that compare has no `accepts()` / empty material
`rules`, matching legacy). Prefer a dedicated `compareAdapter` over overloading
`sortAdapter` so the pattern→module link stays explicit.

Do **not** call `fromLegacy` inside the bridge — conversion stays in
`ActivityNode`.

### Check / hints / outcomes

Same contract as sort/sequence:

1. `tick(materialSpec, state).solved` is the sole solve authority.
2. When unsolved, `compareModule.validate` supplies `wrongIds` only.
3. Partial boards → empty wrongIds (legacy compare already requires every item
   placed before judging).
4. `buildOutcome` + `onOutcome` on every Check.
5. Hints: `HINT_AFTER_ATTEMPTS = 2`.
6. Keep `activityRef` refusal/state-change ordering.

### Interaction note (intentional)

Legacy `CompareActivity` draws Venn crescents/lenses. The material path shows
three slot groups. Students may place any item in any zone until Check (no
control of error at drop — empty `rules`). Success criteria are grading and
`work.assign` persistence, not visual parity with the SVG Venn.

### Testing

| Kind | What |
|---|---|
| Unit | `catalogueArt` pin for venn-sets fromLegacy (mirror sorting-frame / ordering-track) |
| Forbidden | `.test.tsx` |
| Browser | `/dev/activities`: add `n-compare` ActivityNode fixture; drag into zones; Check solves; wrong Check highlights; smoke `n-sort` / `n-sequence` |
| Gate | `npx tsc --noEmit && npx vitest run` |

### Success criteria

1. Well-formed live `compare` draws through `MaterialRenderer` / venn-sets.
2. `fromLegacy` null → `CompareActivity`.
3. Persisted `activityState.work.assign` round-trips (same helpers as sort).
4. Check / outcomes / hints fire; tick sole solve authority.
5. Sort and sequence cutovers unchanged.
6. `CompareActivity.tsx` remains; suite green; nothing pushed without an explicit decision.

## Risks

- **Visual expectation:** Teachers may expect crescents; document that this cut
  is vocabulary slots, not a Venn redraw.
- **Zone id mismatch:** Payload `belongs` / success assign must use
  `left`/`both`/`right` — already required by `compareModule.isPayload` and
  canon convert. Hostile payloads that fail convert fall back to
  `CompareActivity`.
- **Adapter drift:** Keep compare and sort adapters parallel; do not silently
  share one adapter object that hard-codes `sortModule`.

## Migration relationship

Third live apparatus takeover. Deletion of `CompareActivity` is a later
explicit decision after this path has been driven in a real lesson.
