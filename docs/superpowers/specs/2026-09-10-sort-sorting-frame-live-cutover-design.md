# Stage 3b — Live cutover: `sort` → `sorting-frame`

**Status:** Designed 2026-09-10; not built  
**Date:** 2026-09-10  
**Parent:** `docs/superpowers/specs/2026-09-07-studylab-composable-material-engine-design.md`  
**Depends on:** Stage 3 cut 1 (`MaterialRenderer`, `MATERIAL_BOX` shell) and Phase 2 canon (`sorting-frame.fromLegacy`).  
**Prior cut:** `docs/superpowers/specs/2026-09-10-material-renderer-dev-bench-design.md`

## The problem

The vocabulary renderer works on `/dev/activities`, but LearnSpace still draws
`sort` through `SortActivity`. Stored lessons are `ActivitySpec` values
(`pattern` + `payload` + `success` + `activityState.work`). Until
`ActivityNode` can render a converted `MaterialSpec` and round-trip the same
`work` shape, the engine cannot take over a live path without a flag day.

## What this cut builds

**One live path only:** when `ActivityNode` sees `pattern: 'sort'`, it tries
`getApparatus('sorting-frame')!.legacy!.fromLegacy(payload, success)`. On
success it mounts a bridge component around `MaterialRenderer`. On `null` it
keeps `SortActivity` unchanged.

No other patterns. No `build_material`. `SortActivity.tsx` is **not deleted**.

## Non-goals

- Cutover of sequence, compare, balance, label, vary, scenario, compose, threePeriod.
- Deleting `SortActivity` or removing it from the bundle.
- Tutor action union / prompt changes (Stage 4).
- Changing the on-disk shape of `ActivitySpec` or `activityState.work` for sort
  — persistence stays `{ assign: Record<itemId, binId> }`.
- `.test.tsx` files.

## Architecture

```
ActivitySpec { pattern: 'sort', payload, success, … }
        │
        ├─ fromLegacy(payload, success) ──null──► SortActivity (unchanged)
        │
        └─ MaterialSpec
                │
                ▼
        MaterialActivity (bridge)
          • hydrate MaterialState from work.assign
          • MaterialRenderer (drag / allow / tick)
          • Check → tick().solved + buildOutcome
          • persist work.assign from placement
```

### Conversion

Reuse the existing canon entry. Call with **both** payload and success (Stage 2
ruling: success is authoritative). If `fromLegacy` returns `null` (malformed
payload, isolation/fit/solvability fail), fall back — never blank the card.

### Placement ↔ `assign` mapping

Sorting-frame slots use `s-${binId}` (already pinned by equivalence tests).

| Direction | Mapping |
|---|---|
| Hydrate | `work.assign[itemId] = binId` → `placement[itemId] = \`s-${binId}\`` |
| Persist | `placement[itemId] = \`s-${binId}\`` → `assign[itemId] = binId` |
| Unplaced | absent from `placement` ↔ absent from `assign` |

Ignore placement keys whose slot id is not `s-*` or does not match a known
group — treat as unplaced rather than corrupting `assign`.

### `MaterialActivity` responsibilities

New file under `components/studylab/material/` (or `activities/` if that keeps
imports cleaner — prefer `material/` beside the renderer).

Props mirror other activities: `id`, `spec: ActivitySpec`, `onOutcome`,
`initialState?: ActivityState`.

Behaviour:

1. `materialSpec = fromLegacy(spec.payload, spec.success)`. If null, render
   `SortActivity` with the same props (single call site in `ActivityNode` may
   also do the null check — one place only, not both).
2. Hold `MaterialState`, seeded by `createInitialMaterialState(materialSpec)`
   then overlaid with hydrated placement from `initialState?.work`.
3. On every successful `applyMove` / meaningful board change, persist via
   `CanvasContext.onNodeDataChange` the same fields `useActivityState` writes:
   `activityState` with `work: { assign }`, `status`, `attempts`,
   `rejectedMoves` (map material rejects `{ pieceId, slotId }` →
   `{ itemId, targetId }` using the bin id derived from the slot, or the slot
   id if no bin can be derived — prefer bin id so telemetry stays comparable).
4. **Check** button: run `tick(materialSpec, state)`; if `solved`, mark
   solved / revealed and `onOutcome(buildOutcome(...))` with
   `validate` result `{ ok: true, wrongIds: [] }`. If not solved, increment
   attempts and use `sortModule.validate` on the **persisted assign** so
   `wrongIds` stay consistent with the legacy checker (partial boards stay
   unsolved with empty wrongIds, matching `sortModule`).
5. Hints: same gate as `useActivityState` (`HINT_AFTER_ATTEMPTS = 2`, cycle
   `spec.hints`).

`MaterialRenderer` may need small, additive props for this cut:

- `initialState?: MaterialState` (or controlled `state` / `onStateChange`) so
  the bridge owns persistence without remounting on every keystroke.
- Optional `onStateChange?(state: MaterialState)` after moves/controls.
- Keep bench usage working: omit the new props → current behaviour.

Prefer **controlled-friendly** API: bridge owns state, passes
`state` + `onStateChange` into the renderer, rather than duplicating drag
logic. If that refactor is too large, a minimal alternative is
`initialState` + `onStateChange` with the renderer remaining mostly
uncontrolled after mount — document which was chosen in the plan.

### `ActivityNode` change

```ts
case 'sort': {
  const material = getApparatus('sorting-frame')?.legacy?.fromLegacy(
    spec.payload,
    spec.success,
  )
  if (material) {
    return (
      <MaterialActivity
        id={id}
        spec={spec}
        materialSpec={material}
        onOutcome={emitActivityOutcome}
        initialState={initialState}
      />
    )
  }
  return <SortActivity … />
}
```

Or let `MaterialActivity` perform the `fromLegacy` call and fall back
internally — one ownership site for the conversion.

### Testing

| Kind | What |
|---|---|
| Unit | Pure helpers: `assignToPlacement`, `placementToAssign` round-trip (node vitest) |
| Unit | `fromLegacy` null → bridge must not throw (optional smoke) |
| Forbidden | `.test.tsx` |
| Browser | LearnSpace or canvas with a `sort` activity: mouse drag into bins, Check solves, reload/persist keeps assign; `/dev/activities` legacy sort fixture still works |
| Gate | `npx tsc --noEmit && npx vitest run` |

### Success criteria

1. A well-formed live `sort` activity draws through `MaterialRenderer` (sorting-frame vocabulary).
2. A payload that fails `fromLegacy` still renders via `SortActivity`.
3. Persisted `activityState.work.assign` round-trips across remount.
4. Check / outcomes / hints still fire for the tutor.
5. No other pattern’s UI changes; `SortActivity.tsx` remains in the tree.
6. Suite green; nothing pushed to `aws_deploy` without an explicit decision.

## Risks

- **Allow rules differ from legacy `accepts`.** Canon sorting-frame uses trait
  `allow` by bin; legacy `sortModule.accepts` also refuses wrong bins. They
  should agree; if a live lesson feels stickier or looser than before, compare
  the two before blaming the renderer.
- **`MaterialRenderer` today has no Check.** The bridge must add it — do not
  rely on auto-solve alone for tutor telemetry (legacy always used an explicit
  Check).
- **Rejected-move id shape.** Telemetry expects `itemId` / target as bin id in
  sort; map slot → group when recording.

## Migration relationship

Parent design step 3: renderers deleted as entries take over. This cut is the
first *live* takeover for one pattern, with the old component retained as
fallback. Deletion of `SortActivity` is a later commit once this path has been
driven in a real lesson.
