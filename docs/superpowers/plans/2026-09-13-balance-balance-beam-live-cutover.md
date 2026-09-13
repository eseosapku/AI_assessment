# Stage 3b — Balance → Balance-Beam Live Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route well-formed live `balance` activities through `balance-beam` + `MaterialActivity`, mapping `{ left, right }` work to `s-left`/`s-right` placement, with `BalanceActivity` as fallback.

**Architecture:** Pure `balancePlacement` helpers; `catalogueArt` in `balanceBeam.convert`; `balanceAdapter` using `balanceModule.initialWork` / `validate`; `ActivityNode` wire-up. Beam display already works via existing `MaterialRenderer` bind/tick — do not rebuild. Bench already has `n-balance`.

**Tech Stack:** TypeScript strict, existing React adapters / MaterialRenderer, vitest node-only, Playwright. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-13-balance-balance-beam-live-cutover-design.md`

## Global Constraints

- **One new live pattern only:** `balance` → `balance-beam`. Sort, sequence, compare must keep working.
- **Do not delete** `BalanceActivity.tsx` (or prior legacy activities).
- **Conversion ownership:** `fromLegacy(payload, success)` only in `ActivityNode`.
- **Persistence unchanged:** `{ left: string[]; right: string[] }`.
- **Check:** `tick().solved` sole solve authority; `balanceModule.validate` only for `wrongIds` when unsolved.
- **Pool:** hydrate pool items as **unplaced**; persist ignores `s-pool` and unplaced (not in left/right).
- **Never create `.test.tsx`.**
- **Local commits only. NEVER push** (`aws_deploy` deploys).
- Work in `c:\Users\Stephen\AI_assessment` — not a worktree.
- Do not change interpreter capacity-1 swap or display bind logic for this cut.
- Dedicated `balanceAdapter` — do not overload sort/compare adapters.

## File Structure

| Path | Responsibility |
|---|---|
| `lib/studylab/material/balancePlacement.ts` | Pure left/right ↔ placement helpers |
| `lib/studylab/material/balancePlacement.test.ts` | Round-trip / pool / s-pool |
| `lib/studylab/material/canon/balanceBeam.ts` | `catalogueArt` on convert pieces |
| `lib/studylab/material/canon/equivalence.test.ts` | Art pin for balance-beam |
| `components/studylab/material/adapters.ts` | `balanceAdapter` |
| `components/studylab/activities/ActivityNode.tsx` | Wire `balance` case |
| `docs/HANDOVER.md` | Record balance cutover |

---

### Task 1: `left`/`right` ↔ placement helpers

**Files:**
- Create: `lib/studylab/material/balancePlacement.ts`
- Test: `lib/studylab/material/balancePlacement.test.ts`

**Interfaces:**
- Consumes: `binIdFromSlot` / `slotIdForBin` from `./sortPlacement` **or** inline `s-left` / `s-right` constants — prefer reusing `slotIdForBin('left')` etc. so the `s-` convention stays one place.
- Produces:
  - `sidesToPlacement(work: { left: string[]; right: string[] }): Record<string, string>`
  - `placementToSides(placement: Record<string, string>): { left: string[]; right: string[] }`
    - `left` = ids with placement `s-left`, **sorted lexicographically**
    - `right` = ids with placement `s-right`, **sorted lexicographically**
    - ignore `s-pool`, non-`s-*`, and missing

- [ ] **Step 1: Failing tests**

```ts
import { describe, it, expect } from 'vitest'
import { placementToSides, sidesToPlacement } from './balancePlacement'

describe('balancePlacement', () => {
  it('round-trips pans (order-normalized)', () => {
    const work = { left: ['b', 'a'], right: ['c'] }
    const placement = sidesToPlacement(work)
    expect(placement).toEqual({ a: 's-left', b: 's-left', c: 's-right' })
    expect(placementToSides(placement)).toEqual({ left: ['a', 'b'], right: ['c'] })
  })

  it('ignores s-pool and non-pan slots when building work', () => {
    expect(
      placementToSides({ a: 's-left', b: 's-pool', c: 's-right', d: 'pool' }),
    ).toEqual({ left: ['a'], right: ['c'] })
  })

  it('leaves pool ids out of placement on hydrate', () => {
    expect(sidesToPlacement({ left: ['a'], right: [] })).toEqual({ a: 's-left' })
  })
})
```

- [ ] **Step 2: Run — expect FAIL** (module not found)

Run: `npx vitest run lib/studylab/material/balancePlacement`

- [ ] **Step 3: Implement**

- [ ] **Step 4: Focused tests + full gate** `npx tsc --noEmit && npx vitest run`

- [ ] **Step 5: Commit**

```
feat(studylab): map balance left/right work to balance-beam placement

Live cutover must round-trip ActivitySpec work pans through s-left/s-right.
```

---

### Task 2: Balance-beam catalogue art

**Files:**
- Modify: `lib/studylab/material/canon/balanceBeam.ts`
- Modify: `lib/studylab/material/canon/equivalence.test.ts`

**Interfaces:**
- Consumes: `catalogueArt` from `../catalogueArt`.
- Produces: each converted piece may include `art` from `item.imageUrl`.

- [ ] **Step 1: Failing art test** (mirror venn-sets / ordering-track)

Use a valid balance payload (empty left/right, pool items with imageUrls) + `numericWithin` success. Assert legal `asset:…` / bare name → `art`; illegal URL → unset; missing → unset.

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Wire convert**

```ts
pieces: items.map((item) => {
  const art = catalogueArt(item.imageUrl)
  return {
    id: item.id,
    label: item.label,
    ...(art ? { art } : {}),
    traits: { weight: item.weight },
  }
}),
```

- [ ] **Step 4: Gate + commit**

```
feat(studylab): preserve balance-beam catalogue art from legacy imageUrl

Pictured balance weights keep asset names through fromLegacy.
```

---

### Task 3: `balanceAdapter` + `ActivityNode` wire-up

**Files:**
- Modify: `components/studylab/material/adapters.ts`
- Modify: `components/studylab/activities/ActivityNode.tsx`

**Interfaces:**

```ts
import { balanceModule } from '@/lib/studylab/activities/patterns/balance'
import { placementToSides, sidesToPlacement } from '@/lib/studylab/material/balancePlacement'
import { binIdFromSlot } from '@/lib/studylab/material/sortPlacement'

export const balanceAdapter: MaterialWorkAdapter = {
  freshWork(payload) {
    if (balanceModule.isPayload(payload)) {
      return balanceModule.initialWork(payload) as unknown as Record<string, unknown>
    }
    return { left: [], right: [] }
  },
  placementFromWork(work) {
    const left = Array.isArray(work.left) ? (work.left as string[]) : []
    const right = Array.isArray(work.right) ? (work.right as string[]) : []
    return sidesToPlacement({ left, right })
  },
  workFromPlacement(placement) {
    return placementToSides(placement)
  },
  wrongIdsWhenUnsolved(payload, work, success) {
    return balanceModule.validate(payload as never, work as never, success).wrongIds
  },
  refusalTarget(slotId) {
    return binIdFromSlot(slotId) ?? slotId
  },
}
```

**ActivityNode** — replace `balance` case:

```tsx
case 'balance': {
  const material = getApparatus('balance-beam')?.legacy?.fromLegacy(
    spec.payload,
    spec.success,
  )
  if (material) {
    return (
      <MaterialActivity
        id={id}
        spec={spec}
        materialSpec={material}
        adapter={balanceAdapter}
        onOutcome={emitActivityOutcome}
        initialState={initialState}
      />
    )
  }
  return (
    <BalanceActivity
      id={id}
      spec={spec}
      onOutcome={emitActivityOutcome}
      initialState={initialState}
    />
  )
}
```

Import `balanceAdapter`. Do not delete `BalanceActivity`.

- [ ] **Step 1: Implement**

- [ ] **Step 2: Full gate** `npx tsc --noEmit && npx vitest run`

- [ ] **Step 3: Commit**

```
feat(studylab): live balance activities prefer balance-beam renderer

Fall back to BalanceActivity when fromLegacy returns null.
```

---

### Task 4: Browser verification + handover

**Files:**
- Modify: `docs/HANDOVER.md`
- Touch `app/dev/activities/page.tsx` only if `n-balance` needs a tweak (already at x=420). Prefer a fixture with non-empty `pool` and empty or light pans so drag-to-balance is exercisable — read current `balanceSpec` and adjust only if the existing fixture cannot reach a solved Check via drag.

**Browser checklist** (Playwright MCP on `/dev/activities`):

1. **`n-balance`:** material slots + beam display (not legacy absolute pans); pool/unplaced chips; drag onto pans; beam updates; Check solves a balanced arrangement (or documents if fixture is already solved / unsolvable — fix fixture if needed).
2. Smoke **`n-sort`**, **`n-sequence`**, **`n-compare`**.
3. Bench balance-beam / material picker still mounts.

**HANDOVER:** Mark balance cutover done (verified claims only); remaining five patterns + Stage 4; test counts; `BalanceActivity` fallback; slots+beam-not-SVG intentional.

- [ ] **Step 1: Browser verify** (fix fixture first if Check cannot be reached)

- [ ] **Step 2: Update HANDOVER**

- [ ] **Step 3: Final gate + commit**

```
docs(studylab): record Stage 3b balance live cutover

balance-beam owns the live balance path; BalanceActivity remains fallback.
```

**Do not push.**

---

## Spec coverage (self-review)

| Spec requirement | Task |
|---|---|
| left/right ↔ s-left/s-right helpers | 1 |
| catalogueArt on balance convert | 2 |
| balanceAdapter + initialWork | 3 |
| ActivityNode fromLegacy once | 3 |
| Browser n-balance + smokes | 4 |
| BalanceActivity fallback | 3 |
| Beam via existing renderer | Global (no new display code) |
| No push / no .test.tsx | Global |

## Placeholder / consistency check

- Helper names: `sidesToPlacement` / `placementToSides`.
- Lexicographic sort on persist arrays.
- No TBD steps.
