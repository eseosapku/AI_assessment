# Stage 3b — Live cutover: `sequence` → `ordering-track`

**Status:** Designed 2026-09-10; not built  
**Date:** 2026-09-10  
**Parent:** `docs/superpowers/specs/2026-09-07-studylab-composable-material-engine-design.md`  
**Depends on:** Stage 3b sort cutover (`MaterialActivity`, controlled `MaterialRenderer`) and Phase 2 canon (`ordering-track.fromLegacy`).  
**Prior cut:** `docs/superpowers/specs/2026-09-10-sort-sorting-frame-live-cutover-design.md`

## The problem

`sort` now renders through the material vocabulary on the live path.
`sequence` still uses `SequenceActivity`. Its work shape is
`{ order: string[] }`, not `{ assign }`, and a fresh board is a **shuffled full
order** (every item already “placed”), not an empty pool. The sort-only bridge
cannot round-trip that without lying about persistence or first paint.

## What this cut builds

**One live path only:** when `ActivityNode` sees `pattern: 'sequence'`, it tries
`getApparatus('ordering-track')!.legacy!.fromLegacy(payload, success)`. On
success it mounts the shared material bridge with a **sequence adapter**. On
`null` it keeps `SequenceActivity` unchanged.

Also: extract the sort-specific hydrate/persist/validate bits behind a small
adapter so the bridge is not copy-pasted. Sort behaviour must stay identical.

No other patterns. No `build_material`. `SequenceActivity.tsx` is **not deleted**.

## Non-goals

- Cutover of compare, balance, label, vary, scenario, compose, threePeriod.
- Deleting `SequenceActivity` or `SortActivity`.
- Recreating legacy list-splice UX (drop item onto item). The material path uses
  **slots** (`s-0`…`s-n`); interaction will feel different while grading agrees.
- Stage 4 tutor / `build_material`.
- `.test.tsx` files.

## Architecture

```
ActivitySpec { pattern: 'sequence', payload, success, … }
        │
        ├─ fromLegacy(payload, success) ──null──► SequenceActivity
        │
        └─ MaterialSpec
                │
                ▼
        MaterialActivity + sequence adapter
          • seed order from initialWork or persisted work
          • order[i] ↔ placement[pieceId] = s-${i}
          • MaterialRenderer (slots / drag / tick)
          • Check → tick().solved + sequenceModule.validate (wrongIds only)
          • persist work.order
```

### Conversion

Reuse `ordering-track` canon. Call with **both** payload and success. Map legal
`item.imageUrl` → `piece.art` the same way sorting-frame does (trim, strip
`asset:`, `/^[a-z0-9-]+$/` only) so pictured sequences keep catalogue art.

### Placement ↔ `order` mapping

Ordering-track slots use `s-${index}` (groupId `String(index)`).

| Direction | Mapping |
|---|---|
| Hydrate | `order[i] = pieceId` → `placement[pieceId] = \`s-${i}\`` |
| Persist | For indices `0..n-1`, read which piece occupies `s-${i}` (if any) into `order[i]`; omit gaps or treat incomplete boards as partial order arrays consistent with what `sequenceModule.validate` expects |
| Fresh | If no persisted work, `sequenceModule.initialWork(payload, seed)` then hydrate — never start with an empty pool |

Persist must never invent a second work key (`assign`). Shape stays `{ order: string[] }`.

**Partial / conflicting placement:** Prefer a deterministic rule documented in the
plan (e.g. build `order` by walking slot indices in order; skip empty slots;
ignore pieces on non-`s-*` slots). Unit-test the helper.

### Adapter split (recommended shape)

Introduce a narrow adapter interface used only by the bridge, e.g.:

- `workFromPlacement(placement, materialSpec, payload) → Record<string, unknown>`
- `placementFromWork(work, materialSpec) → Placement`
- `freshWork(payload, seed) → Record<string, unknown>` (optional; sequence needs it)
- `validateWork(payload, work, success) → ValidateResult` (wrongIds when unsolved)
- `refusalTarget(slotId) → string` (telemetry target id)

Implement `sortAdapter` (current behaviour) and `sequenceAdapter`. `ActivityNode`
picks the adapter when mounting the bridge. Do **not** call `fromLegacy` inside
the bridge — conversion stays sole-owned by `ActivityNode`.

Refuse to invent a mega-generic engine for all nine patterns; only sort +
sequence adapters in this cut.

### Check / hints / outcomes

Same contract as the sort cutover:

1. `tick(materialSpec, state).solved` is the **sole** solve authority.
2. When unsolved, `sequenceModule.validate` supplies `wrongIds` only — never
   mark solved from legacy `ok`.
3. `buildOutcome` + `onOutcome` on every Check.
4. Hints: `HINT_AFTER_ATTEMPTS = 2`, cycle `spec.hints`.
5. Preserve `activityRef` (or equivalent) so refusal + state-change in one
   `place()` cannot wipe `rejectedMoves`. Sequence has no `accepts()` today;
   refuse telemetry remains correct if the material later adds allow rules.

### Interaction note (intentional)

Legacy `SequenceActivity` reorders by dropping one step onto another (array
splice) with **no** control of error at drop time. The material renderer places
pieces into indexed slots. Students may use the pool if a piece is cleared from
a slot — that is vocabulary-native. Success criteria are about grading and
persistence parity, not pixel-identical gestures.

### Testing

| Kind | What |
|---|---|
| Unit | `order` ↔ placement helpers round-trip; fresh seed uses shuffled full order |
| Unit | `fromLegacy` art mapping for sequence items (mirror sorting-frame art test) |
| Forbidden | `.test.tsx` |
| Browser | `/dev/activities` `n-sequence` (or add one if missing): drag into order, Check solves; mismatch Check shows wrong; bench ordering-track still works |
| Gate | `npx tsc --noEmit && npx vitest run` |
| Regression | Live `sort` path still works (smoke or existing browser checklist subset) |

### Success criteria

1. Well-formed live `sequence` draws through `MaterialRenderer` / ordering-track.
2. `fromLegacy` null → `SequenceActivity`.
3. Persisted `activityState.work.order` round-trips across remount (unit + seed path; browser remount optional if fixture allows).
4. Check / outcomes / hints fire; tick sole solve authority.
5. Sort cutover unchanged in behaviour.
6. `SequenceActivity.tsx` remains; suite green; nothing pushed without an explicit decision.

## Risks

- **Work seeding:** Forgetting `initialWork` produces an empty track and looks
  “broken” compared to legacy (all steps visible immediately).
- **Order length vs slots:** Persist must align with `payload.items.length` /
  slot count so `evaluateSuccess({ order })` sees a comparable array.
- **Adapter footgun:** Sort regression if the refactor accidentally changes
  assign mapping or Check authority — keep sort adapter behaviour pinned by
  existing tests / a short sortPlacement + bridge smoke.

## Migration relationship

Second live apparatus takeover. Deletion of `SequenceActivity` is a later
explicit decision after this path has been driven in a real lesson.
