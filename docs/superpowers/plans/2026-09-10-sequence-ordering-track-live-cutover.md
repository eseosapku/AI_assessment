# Stage 3b — Sequence → Ordering-Track Live Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route well-formed live `sequence` activities through `ordering-track` + `MaterialRenderer`, while refactoring `MaterialActivity` to use sort/sequence adapters so both patterns share Check/hints/outcomes without duplicating the bridge.

**Architecture:** Pure `order` ↔ `placement` helpers; shared `catalogueArt` for legacy `imageUrl`; a narrow `MaterialWorkAdapter` with `sortAdapter` + `sequenceAdapter`; `MaterialActivity` takes an `adapter` prop; `ActivityNode` converts via `fromLegacy` and picks the adapter. Fresh sequence boards seed from `sequenceModule.initialWork` (shuffled full order).

**Tech Stack:** TypeScript strict, existing React client components, `getApparatus` / pattern modules / `buildOutcome` / `CanvasContext`, vitest node-only, Playwright for browser verification. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-10-sequence-ordering-track-live-cutover-design.md`

## Global Constraints

- **One new live pattern only:** `sequence` → `ordering-track`. Sort must keep working.
- **Do not delete** `SequenceActivity.tsx` or `SortActivity.tsx`.
- **Conversion ownership:** `fromLegacy(payload, success)` only in `ActivityNode` (once per pattern case).
- **Persistence shapes unchanged:** sort `{ assign }`; sequence `{ order: string[] }`.
- **Check:** `tick().solved` sole solve authority; legacy `validate` only for `wrongIds` when unsolved.
- **Never create `.test.tsx`.**
- Art via `assetUrl()` / catalogue names; `ss-*` inline; drag via `useActivityDrag`.
- `npx tsc --noEmit && npx vitest run` green at the end of every task.
- **Local commits only. NEVER push** (`aws_deploy` deploys).
- Work in `c:\Users\Stephen\AI_assessment` — not a worktree.
- Preserve `activityRef` refusal/state-change ordering fix from Stage 3b sort.

## File Structure

| Path | Responsibility |
|---|---|
| `lib/studylab/material/sequencePlacement.ts` | Pure `order` ↔ placement helpers |
| `lib/studylab/material/sequencePlacement.test.ts` | Round-trip / partial / ignore non-`s-*` |
| `lib/studylab/material/catalogueArt.ts` | Shared `catalogueArt(imageUrl)` (from sorting-frame) |
| `lib/studylab/material/canon/sortingFrame.ts` | Import shared `catalogueArt` |
| `lib/studylab/material/canon/orderingTrack.ts` | Use `catalogueArt` on pieces |
| `lib/studylab/material/canon/equivalence.test.ts` | Art pin for ordering-track (or adjacent describe) |
| `components/studylab/material/adapters.ts` | `MaterialWorkAdapter`, `sortAdapter`, `sequenceAdapter` |
| `components/studylab/material/MaterialActivity.tsx` | Adapter-driven bridge |
| `components/studylab/activities/ActivityNode.tsx` | Wire `sequence` case |
| `app/dev/activities/page.tsx` | Add `n-sequence` ActivityNode fixture |
| `docs/HANDOVER.md` | Record sequence cutover |

---

### Task 1: `order` ↔ `placement` helpers

**Files:**
- Create: `lib/studylab/material/sequencePlacement.ts`
- Test: `lib/studylab/material/sequencePlacement.test.ts`

**Interfaces:**
- Consumes: none (pure).
- Produces:
  - `slotIdForIndex(index: number): string` → `` `s-${index}` ``
  - `indexFromSlot(slotId: string): number | null` — parse `s-${n}` where `n` is a non-negative integer string; else `null` (reject `s-warm`, `s-`, `pool`)
  - `orderToPlacement(order: string[]): Record<string, string>` — `order[i]` → `` s-${i} ``; skip empty string ids
  - `placementToOrder(placement: Record<string, string>, slotCount: number): string[]` — walk `i = 0..slotCount-1`; if a piece occupies `s-${i}`, append its id; **skip empty slots**; ignore pieces on non-index slots; if two pieces claim the same slot, prefer the first encountered in `Object.entries` order only as last resort — prefer scanning by slot: for each `i`, find the piece whose placement equals `slotIdForIndex(i)` (if multiple, pick lexicographically smallest piece id for determinism)

- [ ] **Step 1: Write failing tests**

```ts
// lib/studylab/material/sequencePlacement.test.ts
import { describe, it, expect } from 'vitest'
import {
  indexFromSlot,
  orderToPlacement,
  placementToOrder,
  slotIdForIndex,
} from './sequencePlacement'

describe('sequencePlacement', () => {
  it('uses s-${index} slots', () => {
    expect(slotIdForIndex(0)).toBe('s-0')
    expect(slotIdForIndex(2)).toBe('s-2')
    expect(indexFromSlot('s-0')).toBe(0)
    expect(indexFromSlot('s-12')).toBe(12)
    expect(indexFromSlot('s-warm')).toBeNull()
    expect(indexFromSlot('pool')).toBeNull()
    expect(indexFromSlot('s-')).toBeNull()
  })

  it('round-trips a full order', () => {
    const order = ['a', 'b', 'c']
    expect(placementToOrder(orderToPlacement(order), 3)).toEqual(order)
  })

  it('skips empty slots when building order', () => {
    expect(
      placementToOrder({ a: 's-0', c: 's-2' }, 3),
    ).toEqual(['a', 'c'])
  })

  it('ignores non-index slot ids', () => {
    expect(
      placementToOrder({ a: 's-0', b: 'pool', c: 's-warm' }, 2),
    ).toEqual(['a'])
  })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run lib/studylab/material/sequencePlacement`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** (match interfaces above).

- [ ] **Step 4: Tests pass + full gate**

Run: `npx vitest run lib/studylab/material/sequencePlacement` then `npx tsc --noEmit && npx vitest run`

- [ ] **Step 5: Commit**

```
feat(studylab): map sequence order work to ordering-track placement

Live cutover must round-trip ActivitySpec work.order through s-\${index} slots.
```

---

### Task 2: Shared `catalogueArt` + ordering-track art

**Files:**
- Create: `lib/studylab/material/catalogueArt.ts`
- Modify: `lib/studylab/material/canon/sortingFrame.ts` (import shared helper; delete local copy)
- Modify: `lib/studylab/material/canon/orderingTrack.ts` (map `imageUrl` → `art`)
- Modify: `lib/studylab/material/canon/equivalence.test.ts` (add ordering-track art describe, mirror sorting-frame)

**Interfaces:**
- Produces: `catalogueArt(imageUrl: string | undefined): string | undefined` — trim, strip leading `asset:`, return only if `/^[a-z0-9-]+$/`.

- [ ] **Step 1: Extract helper; keep sorting-frame behaviour identical**

Move the existing function + `ART_NAME_RE` from `sortingFrame.ts` into `catalogueArt.ts` and re-import.

- [ ] **Step 2: Wire ordering-track convert**

```ts
pieces: payload.items.map((item, index) => {
  const art = catalogueArt(item.imageUrl)
  return {
    id: item.id,
    label: item.label,
    ...(art ? { art } : {}),
    traits: { position: index + 1 },
  }
}),
```

- [ ] **Step 3: Test**

Add a describe like sorting-frame’s art test: payload item with `imageUrl: 'asset:foo-bar'` → `fromLegacy` piece has `art: 'foo-bar'`; illegal `asset:Bad` leaves art unset and still converts.

- [ ] **Step 4: Gate + commit**

```
feat(studylab): preserve ordering-track catalogue art from legacy imageUrl

Share catalogueArt with sorting-frame so pictured sequences keep asset names.
```

---

### Task 3: Adapters + refactor `MaterialActivity`

**Files:**
- Create: `components/studylab/material/adapters.ts`
- Modify: `components/studylab/material/MaterialActivity.tsx`
- Modify: `components/studylab/activities/ActivityNode.tsx` (sort case must pass `sortAdapter` — can be same commit as this task or Task 4; **must not leave sort broken mid-task**)

**Interfaces:**

```ts
import type { Placement } from '@/lib/studylab/material/types' // or Record<string, string> if Placement is that
import type { MaterialSpec } from '@/lib/studylab/material/types'
import type { SuccessRule, ValidateResult } from '@/lib/studylab/activities/types'

export type MaterialWorkAdapter = {
  /** Seed work when activityState.work is empty/absent. */
  freshWork(payload: unknown, seed: number | undefined): Record<string, unknown>
  placementFromWork(work: Record<string, unknown>, materialSpec: MaterialSpec): Placement
  workFromPlacement(
    placement: Placement,
    materialSpec: MaterialSpec,
    payload: unknown,
  ): Record<string, unknown>
  /** Called only when tick says unsolved — return wrongIds (ok ignored). */
  wrongIdsWhenUnsolved(
    payload: unknown,
    work: Record<string, unknown>,
    success: SuccessRule,
  ): string[]
  refusalTarget(slotId: string): string
}

export const sortAdapter: MaterialWorkAdapter
export const sequenceAdapter: MaterialWorkAdapter
```

**sortAdapter behaviour (must match today’s MaterialActivity):**
- `freshWork` → `{ assign: {} }`
- `placementFromWork` → `assignToPlacement(work.assign ?? {})`
- `workFromPlacement` → `{ assign: placementToAssign(placement) }`
- `wrongIdsWhenUnsolved` → `sortModule.validate(...).wrongIds`
- `refusalTarget` → `binIdFromSlot(slotId) ?? slotId`

**sequenceAdapter:**
- `freshWork` → `sequenceModule.initialWork(payload, seed ?? 1)` (cast/guard with `isPayload`; if not payload, `{ order: [] }`)
- `placementFromWork` → `orderToPlacement(Array.isArray(work.order) ? work.order as string[] : [])`
- `workFromPlacement` → `{ order: placementToOrder(placement, materialSpec.slots.length) }`
- `wrongIdsWhenUnsolved` → `sequenceModule.validate(...).wrongIds`
- `refusalTarget` → `indexFromSlot(slotId)?.toString() ?? slotId`

**MaterialActivity changes:**
- Add required prop `adapter: MaterialWorkAdapter`.
- On mount with empty work: `work: adapter.freshWork(spec.payload, spec.seed)`.
- Seed material placement via `adapter.placementFromWork`.
- Persist via `adapter.workFromPlacement`.
- Check uses `adapter.wrongIdsWhenUnsolved` when `!tick.solved`.
- Refusal uses `adapter.refusalTarget`.
- Keep `activityRef` sync pattern.

Update sort `ActivityNode` case to pass `adapter={sortAdapter}` in **this** task so the tree typechecks.

- [ ] **Step 1: Implement adapters + refactor MaterialActivity + update sort wire**

- [ ] **Step 2: `npx tsc --noEmit && npx vitest run`**

- [ ] **Step 3: Commit**

```
refactor(studylab): MaterialActivity work adapters for sort and sequence

Sort behaviour unchanged; sequence adapter ready for ActivityNode cutover.
```

---

### Task 4: Wire `ActivityNode` + bench fixture

**Files:**
- Modify: `components/studylab/activities/ActivityNode.tsx`
- Modify: `app/dev/activities/page.tsx`

**Interfaces:**
- `case 'sequence':` mirror sort: `fromLegacy` → `MaterialActivity` with `sequenceAdapter`, else `SequenceActivity`.

- [ ] **Step 1: ActivityNode**

```tsx
case 'sequence': {
  const material = getApparatus('ordering-track')?.legacy?.fromLegacy(
    spec.payload,
    spec.success,
  )
  if (material) {
    return (
      <MaterialActivity
        id={id}
        spec={spec}
        materialSpec={material}
        adapter={sequenceAdapter}
        onOutcome={emitActivityOutcome}
        initialState={initialState}
      />
    )
  }
  return (
    <SequenceActivity
      id={id}
      spec={spec}
      onOutcome={emitActivityOutcome}
      initialState={initialState}
    />
  )
}
```

Ensure sort case passes `adapter={sortAdapter}` (if not already from Task 3).

- [ ] **Step 2: Add `sequenceSpec` + `specNode('n-sequence', …)` on `/dev/activities`**

Minimal 3-item exactOrder fixture (labels only is fine; one item may include `imageUrl: 'asset:…'` if a known catalogue name exists). Place it near the other activity nodes so Playwright can find it.

- [ ] **Step 3: Full gate + commit**

```
feat(studylab): live sequence activities prefer ordering-track renderer

Fall back to SequenceActivity when fromLegacy returns null.
```

---

### Task 5: Browser verification + handover

**Files:**
- Modify: `docs/HANDOVER.md`

- [ ] **Step 1: Browser checklist** (Playwright MCP)

1. `/dev/activities` — `n-sequence`: pieces on track (not empty pool-only); reorder via slots; Check solves correct order; wrong order Check leaves unsolved / highlights wrongIds.
2. Bench `ordering-track` / canon picker still works.
3. Smoke `n-sort` still material path (chips/slots + Check).

- [ ] **Step 2: Update HANDOVER** — sequence cutover done; remaining seven patterns; test counts; SortActivity + SequenceActivity fallbacks.

- [ ] **Step 3: Final gate + commit**

```
docs(studylab): record Stage 3b sequence live cutover

ordering-track owns the live sequence path; SequenceActivity remains fallback.
```

**Do not push.**

---

## Spec coverage (self-review)

| Spec requirement | Task |
|---|---|
| Adapter split sort + sequence | 3 |
| order ↔ s-${index} | 1, 3 |
| fresh via initialWork | 3 (`sequenceAdapter.freshWork`) |
| imageUrl → art on ordering-track | 2 |
| ActivityNode fromLegacy once | 4 |
| tick sole solve authority | 3 (preserve) |
| SequenceActivity fallback | 4 |
| Bench n-sequence + browser | 4, 5 |
| Sort unchanged | 3, 5 smoke |
| No push / no .test.tsx | Global |

## Placeholder / consistency check

- Adapter method names locked as above.
- `placementToOrder(placement, slotCount)` uses `materialSpec.slots.length`.
- No TBD steps remain.
