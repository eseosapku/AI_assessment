# Stage 3b — Live cutover: `vary` → `variable-model`

**Status:** Designed 2026-09-14; not built  
**Date:** 2026-09-14  
**Parent:** `docs/superpowers/specs/2026-09-07-studylab-composable-material-engine-design.md`  
**Depends on:** Stage 3b sort / sequence / compare / balance / label cutovers (`MaterialActivity`
adapters, controlled `MaterialRenderer`).  
**Prior cuts:**  
- `docs/superpowers/specs/2026-09-10-sort-sorting-frame-live-cutover-design.md`  
- `docs/superpowers/specs/2026-09-10-sequence-ordering-track-live-cutover-design.md`  
- `docs/superpowers/specs/2026-09-13-compare-venn-sets-live-cutover-design.md`  
- `docs/superpowers/specs/2026-09-13-balance-balance-beam-live-cutover-design.md`  
- `docs/superpowers/specs/2026-09-14-label-labelled-diagram-live-cutover-design.md`

## The problem

Five patterns already render through the material vocabulary on the live path.
`vary` still uses `VaryActivity` (slider + bars/tank/plot SVG + expression
readouts). Its work shape is `{ value: number }` — not placement. The
`variable-model` canon already converts payloads (control + bound display +
`numericWithin` goal) and equivalence maps `controls[variableId] → value`.

The bridge today only persists work from **placement**. Slider moves update
`MaterialState.controls` but `MaterialActivity.handleStateChange` never writes
`work.value`, and hydrate never seeds controls from work. Without extending the
adapter contract, a live vary cutover cannot round-trip.

## What this cut builds

**One live path only:** when `ActivityNode` sees `pattern: 'vary'`, it tries
`getApparatus('variable-model')!.legacy!.fromLegacy(payload, success)`. On
success it mounts `MaterialActivity` with a **vary adapter**. On `null` it
keeps `VaryActivity` unchanged.

Extend `MaterialWorkAdapter` / `MaterialActivity` so control-backed patterns can
hydrate and persist controls. Add `varyAdapter`, pure `value` ↔ controls
helpers, and an `/dev/activities` `n-vary` fixture.

No other patterns. No `build_material`. `VaryActivity.tsx` is **not deleted**.

## Non-goals

- Cutover of scenario, compose, threePeriod.
- Deleting `VaryActivity` or prior legacy activities.
- Recreating legacy multi-bar expression charts, tank float physics, plot-fn
  polylines, or readout lists — material path uses one vocabulary control + one
  bound display. Grading and `work.value` persistence only.
- Stage 4 tutor / `build_material`.
- `.test.tsx` files.
- Changing placement adapters’ behaviour for sort/sequence/compare/balance/label.

## Architecture

```
ActivitySpec { pattern: 'vary', payload, success, … }
        │
        ├─ fromLegacy(payload, success) ──null──► VaryActivity
        │
        └─ MaterialSpec (variable-model)
                │
                ▼
        MaterialActivity + varyAdapter
          • work.value ↔ controls[variable.id]
          • placement always empty
          • freshWork → varyModule.initialWork (value = min)
          • MaterialRenderer (slider + bind display)
          • Check → tick().solved + varyModule.validate (wrongIds only)
```

### Conversion

Reuse `variable-model` canon as-is. Call with **both** payload and success.
Convert already widens tolerance to `max(success.tolerance, step/2)` and binds
`expr: variable.id` to the display. No catalogue art.

### Adapter contract extension

Add optional control hooks; existing adapters omit them and keep working:

```ts
export type MaterialWorkAdapter = {
  // …existing methods…
  /** When present, seed MaterialState.controls from activity work. */
  controlsFromWork?(
    work: Record<string, unknown>,
    materialSpec: MaterialSpec,
    payload: unknown,
  ): Record<string, number>
  /**
   * Optional 4th arg: current material controls.
   * Placement-only adapters ignore it; vary uses it to write work.value.
   */
  workFromPlacement(
    placement: Placement,
    materialSpec: MaterialSpec,
    payload: unknown,
    controls?: Record<string, number>,
  ): Record<string, unknown>
}
```

`MaterialActivity` changes:

1. **seedMaterialState** — after `placementFromWork`, if `controlsFromWork` is
   defined, merge its result over `base.controls`. Treat “has work” as either
   non-empty placement **or** a defined numeric `work.value` (vary) so remount
   status stays `in_progress` when the slider moved.
2. **handleStateChange / check** — call
   `workFromPlacement(placement, spec, payload, next.controls)`.

Do **not** call `fromLegacy` inside the bridge.

### Placement / controls ↔ `{ value }` mapping

| Direction | Mapping |
|---|---|
| Hydrate controls | `controls[variable.id] = work.value` (finite number; else control min) |
| Persist | `work = { value: controls[variable.id] ?? variable.min }` |
| Placement | always `{}` |
| Fresh | `varyModule.initialWork(payload)` → `{ value: variable.min }` |

Unit-test pure helpers: round-trip value through controls; missing control falls
back to min; ignore unrelated control ids when reading value.

### Adapter

```ts
export const varyAdapter: MaterialWorkAdapter = {
  freshWork(payload) {
    if (varyModule.isPayload(payload)) return varyModule.initialWork(payload) as …
    return { value: 0 }
  },
  placementFromWork() { return {} },
  controlsFromWork(work, _spec, payload) { /* value → { [id]: value } */ },
  workFromPlacement(_placement, _spec, payload, controls) { /* controls → { value } */ },
  wrongIdsWhenUnsolved(payload, work, success) {
    return varyModule.validate(payload as never, work as never, success).wrongIds
  },
  refusalTarget(slotId) { return slotId }, // unused — no slots
}
```

Dedicated `varyAdapter` — do not overload sort/compare.

### Check / hints / outcomes

Same contract as prior cutovers:

1. `tick(materialSpec, state).solved` is the sole solve authority.
2. When unsolved, `varyModule.validate` supplies `wrongIds` only (typically
   empty for `numericWithin`).
3. `buildOutcome` + `onOutcome` on every Check.
4. Hints: `HINT_AFTER_ATTEMPTS = 2`.
5. Keep `activityRef` refusal/state-change ordering (refusals rare — no slots).

### Interaction note (intentional)

Legacy `VaryActivity` draws model-specific SVG (bars/tank/plot) and multiple
expression readouts. The material path shows a slider plus one bound vocabulary
display. Success criteria are grading and `{ value }` persistence, not a
pixel-identical model.

### Testing

| Kind | What |
|---|---|
| Unit | `value` ↔ controls helpers round-trip |
| Unit / gate | Existing adapters still compile; prior suites green |
| Forbidden | `.test.tsx` |
| Browser | `/dev/activities`: add `n-vary` — move slider, display updates, Check solves at target; smoke prior cutovers |
| Gate | `npx tsc --noEmit && npx vitest run` |

### Success criteria

1. Well-formed live `vary` draws through `MaterialRenderer` / variable-model.
2. `fromLegacy` null → `VaryActivity`.
3. Persisted `activityState.work.value` round-trips across remount (slider position).
4. Check / outcomes / hints fire; tick sole solve authority.
5. Sort, sequence, compare, balance, and label cutovers unchanged.
6. `VaryActivity.tsx` remains; suite green; nothing pushed without an
   explicit decision.

## Risks

- **Forgetting controls in persist:** Slider moves would leave stale/empty work —
  the contract extension is mandatory, not optional for this pattern.
- **hasWork detection:** Empty placement alone must not mark a moved slider as
  untouched on remount — use `work.value` presence.
- **wrongIds empty:** Match legacy / `numericWithin` — do not invent chip
  highlighting.
- **Legend pieces:** Convert adds Low/High legend pieces with no slots — they
  sit unused; do not invent a pool UI for them.

## Migration relationship

Sixth live apparatus takeover. Deletion of `VaryActivity` is a later
explicit decision after this path has been driven in a real lesson.
