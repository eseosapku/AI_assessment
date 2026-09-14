# Stage 3b — Live cutover: `threePeriod` → `three-period-cards`

**Status:** Designed 2026-09-14; not built  
**Date:** 2026-09-14  
**Parent:** `docs/superpowers/specs/2026-09-07-studylab-composable-material-engine-design.md`  
**Depends on:** Stage 3b prior eight live cutovers.  
**Prior cuts:** all Stage 3b cutovers through compose → bonding-ring.

## The problem

Eight patterns already render through the material vocabulary on the live path.
`threePeriod` still uses `ThreePeriodActivity` (present → identify → recall
walkthrough). Its work shape is
`{ phase, answers: Record<itemId, label>, presentIdx?, identifyIdx? }`. The
`three-period-cards` canon already converts payloads into capacity-1 answer
slots (`s-answer-${itemId}`) with a `binAssignment` goal and equivalence maps
placement → `answers` at `phase: 2`. The missing piece is a work adapter and
an `ActivityNode` wire-up.

## What this cut builds

**One live path only:** when `ActivityNode` sees `pattern: 'threePeriod'`, it
tries `getApparatus('three-period-cards')!.legacy!.fromLegacy(payload, success)`.
On success it mounts `MaterialActivity` with a **threePeriod adapter**. On
`null` it keeps `ThreePeriodActivity` unchanged.

Add pure helpers for `answers` ↔ placement, `catalogueArt` on convert pieces,
a `threePeriodAdapter`, and an `/dev/activities` `n-threePeriod` fixture.

No other patterns. No `build_material`. `ThreePeriodActivity.tsx` is **not
deleted**.

## Non-goals

- Recreating present/identify walkthrough UI in MaterialRenderer — material
  path is **recall only**. Grading and `{ answers }` persistence (at phase 2)
  only.
- Deleting `ThreePeriodActivity`.
- Stage 4 tutor / `build_material`.
- `.test.tsx` files.

## Architecture

```
ActivitySpec { pattern: 'threePeriod', payload, success, … }
        │
        ├─ fromLegacy(payload, success) ──null──► ThreePeriodActivity
        │
        └─ MaterialSpec (three-period-cards)
                │
                ▼
        MaterialActivity + threePeriodAdapter
          • work.answers (itemId→label) ↔ placement[itemId]=s-answer-${id}
          • freshWork → { phase: 2, answers: {}, presentIdx: 0, identifyIdx: 0 }
          • Check → tick().solved + threePeriodModule.validate (wrongIds only)
```

### Conversion

Reuse `three-period-cards` canon. Call with **both** payload and success.
Add `catalogueArt(item.imageUrl)` onto pieces (picture-first pedagogy).

### Placement ↔ `answers` mapping

Slots: `s-answer-${itemId}` (group `answer-${itemId}`). Success pairing is
`[itemId, label]`. Answers store **label text** as values.

| Direction | Mapping |
|---|---|
| Hydrate | each `[pieceId, label]` → find item with that label → `placement[pieceId] = s-answer-${item.id}` |
| Persist | each `[pieceId, s-answer-X]` → `answers[pieceId] = label of item X`; ignore non-`s-answer-*` |
| Fresh | `{ phase: 2, answers: {}, presentIdx: 0, identifyIdx: 0 }` |
| Persist phase | always write `phase: 2` (material path is recall); preserve `presentIdx`/`identifyIdx` if present on prior work when remounting via fresh only — on workFromPlacement emit `{ phase: 2, answers, presentIdx: 0, identifyIdx: 0 }` |

Helpers need payload (or a label map) to resolve labels ↔ answer item ids.
Prefer pure functions taking `items: { id, label }[]`.

Unit-test: round-trip sun/moon; empty; wrong pairing; ignore non-answer slots.

### Adapter

```ts
export const threePeriodAdapter: MaterialWorkAdapter = {
  freshWork() {
    return { phase: 2, answers: {}, presentIdx: 0, identifyIdx: 0 }
  },
  placementFromWork(work, _spec, payload) { /* answers → placement */ },
  workFromPlacement(placement, _spec, payload) {
    return { phase: 2, answers: placementToAnswers(...), presentIdx: 0, identifyIdx: 0 }
  },
  wrongIdsWhenUnsolved(payload, work, success) {
    return threePeriodModule.validate(...).wrongIds
  },
  refusalTarget(slotId) {
    return binIdFromSlot(slotId) ?? slotId
  },
}
```

Note: `placementFromWork` today is `(work, materialSpec)` — extend with
optional `payload` as 3rd arg (like `workFromPlacement` already has), **or**
pass payload only into `workFromPlacement`/`controlsFromWork` and have
`placementFromWork` receive payload by extending the adapter signature
consistently:

```ts
placementFromWork(
  work: Record<string, unknown>,
  materialSpec: MaterialSpec,
  payload?: unknown,
): Placement
```

Update `MaterialActivity.seedMaterialState` to pass `payload` into
`placementFromWork`. Existing adapters ignore the new optional 3rd arg.

Dedicated `threePeriodAdapter`. Empty allow rules — wrong placements stand
until Check.

### Check / hints / outcomes

Same contract as prior cutovers. `tick().solved` sole solve authority.

### Interaction note (intentional)

Legacy runs three Montessori periods. Material path shows labeled answer slots
and recall cards only. Success criteria are recall grading and `answers`
persistence at phase 2.

### Testing

| Kind | What |
|---|---|
| Unit | answers ↔ placement; catalogueArt pin |
| Forbidden | `.test.tsx` |
| Browser | `/dev/activities` `n-threePeriod` — place correct cards, Check solves; smoke prior |
| Gate | `npx tsc --noEmit && npx vitest run` |

### Success criteria

1. Well-formed live `threePeriod` draws through three-period-cards.
2. `fromLegacy` null → `ThreePeriodActivity`.
3. Persisted `work.answers` (+ `phase: 2`) round-trips.
4. Prior eight cutovers unchanged.
5. Suite green; nothing pushed without an explicit decision.

## Risks

- **Phase drop:** Starting at phase 2 skips present/identify — document as
  intentional for this cutover.
- **Label resolution:** Duplicate labels refused by convert; helpers must not
  invent second pairing semantics.

## Migration relationship

Ninth and final Stage 3b live apparatus takeover. Deletion of
`ThreePeriodActivity` is a later explicit decision. Next: Stage 4
`build_material`.
