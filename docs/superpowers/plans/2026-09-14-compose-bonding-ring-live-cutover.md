# Stage 3b — Compose → Bonding-Ring Live Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route well-formed live `compose` activities through `bonding-ring` + `MaterialActivity`, mapping `{ joins }` work to `bond-*` on `s-joined`, with `ComposeActivity` as fallback.

**Architecture:** Pure `composePlacement` helpers using `joinId`; `composeAdapter`; `ActivityNode` wire-up; verify existing `n-compose` bench. No catalogue art. Part-onto-part UX is an intentional non-goal.

**Tech Stack:** TypeScript strict, existing React adapters / MaterialRenderer, vitest node-only, Playwright. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-14-compose-bonding-ring-live-cutover-design.md`

## Global Constraints

- **One new live pattern only:** `compose` → `bonding-ring`. Prior seven cutovers must keep working.
- **Do not delete** `ComposeActivity.tsx`.
- **Conversion ownership:** `fromLegacy(payload, success)` only in `ActivityNode`.
- **Persistence unchanged:** `{ joins: [string, string][] }`.
- **Check:** `tick().solved` sole solve authority; `composeModule.validate` only for `wrongIds` when unsolved.
- **Pool:** hydrate non-joined as **unplaced**; persist ignores `s-pool`.
- **joinId:** import from `@/lib/studylab/activities/patterns/compose` — do not reimplement.
- **Never create `.test.tsx`.**
- **Local commits only. NEVER push.**
- Work in `c:\Users\Stephen\AI_assessment` — not a worktree.
- Dedicated `composeAdapter`.

## File Structure

| Path | Responsibility |
|---|---|
| `lib/studylab/material/composePlacement.ts` | Pure joins ↔ placement helpers |
| `lib/studylab/material/composePlacement.test.ts` | Round-trip / pool / joinId order |
| `components/studylab/material/adapters.ts` | `composeAdapter` |
| `components/studylab/activities/ActivityNode.tsx` | Wire `compose` case |
| `docs/HANDOVER.md` | Record compose cutover |
| `app/dev/activities/page.tsx` | Only if `n-compose` needs a tweak |

---

### Task 1: `joins` ↔ placement helpers

**Files:**
- Create: `lib/studylab/material/composePlacement.ts`
- Test: `lib/studylab/material/composePlacement.test.ts`

**Interfaces:**
- Import `joinId` from `@/lib/studylab/activities/patterns/compose`
- Import `slotIdForBin` / `binIdFromSlot` from `./sortPlacement` (`s-joined`)
- Produces:
  - `joinsToPlacement(joins: [string, string][]): Record<string, string>`
  - `placementToJoins(placement: Record<string, string>): [string, string][]`
    - pieces on `s-joined` with ids `bond-…`; strip `bond-`; split on `-` into exactly two segments; skip malformed; sort by `joinId(a,b)`

- [ ] **Step 1: Failing tests**

```ts
import { describe, it, expect } from 'vitest'
import { joinsToPlacement, placementToJoins } from './composePlacement'

describe('composePlacement', () => {
  it('round-trips joins through bond-* on s-joined', () => {
    const joins: [string, string][] = [['h1', 'o1'], ['h2', 'o1']]
    const placement = joinsToPlacement(joins)
    expect(placement).toEqual({
      'bond-h1-o1': 's-joined',
      'bond-h2-o1': 's-joined',
    })
    expect(placementToJoins(placement)).toEqual([
      ['h1', 'o1'],
      ['h2', 'o1'],
    ])
  })

  it('normalises pair order via joinId', () => {
    expect(joinsToPlacement([['o1', 'h1']])).toEqual({ 'bond-h1-o1': 's-joined' })
  })

  it('ignores s-pool and malformed bond ids', () => {
    expect(
      placementToJoins({
        'bond-h1-o1': 's-joined',
        'bond-h2-o1': 's-pool',
        'bond-bad': 's-joined',
        x: 's-joined',
      }),
    ).toEqual([['h1', 'o1']])
  })

  it('maps empty joins to empty placement', () => {
    expect(joinsToPlacement([])).toEqual({})
    expect(placementToJoins({})).toEqual([])
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run lib/studylab/material/composePlacement`

- [ ] **Step 3: Implement**

- [ ] **Step 4: Full gate** `npx tsc --noEmit && npx vitest run`

- [ ] **Step 5: Commit**

```
feat(studylab): map compose joins work to bonding-ring placement

Live cutover must round-trip ActivitySpec work.joins through bond-* slots.
```

---

### Task 2: `composeAdapter` + `ActivityNode` wire-up

**Files:**
- Modify: `components/studylab/material/adapters.ts`
- Modify: `components/studylab/activities/ActivityNode.tsx`

**Interfaces:**

```ts
import { composeModule } from '@/lib/studylab/activities/patterns/compose'
import { joinsToPlacement, placementToJoins } from '@/lib/studylab/material/composePlacement'
import { binIdFromSlot } from '@/lib/studylab/material/sortPlacement'

export const composeAdapter: MaterialWorkAdapter = {
  freshWork() {
    return { joins: [] }
  },
  placementFromWork(work) {
    const joins = Array.isArray(work.joins) ? (work.joins as [string, string][]) : []
    return joinsToPlacement(joins)
  },
  workFromPlacement(placement) {
    return { joins: placementToJoins(placement) }
  },
  wrongIdsWhenUnsolved(payload, work, success) {
    return composeModule.validate(payload as never, work as never, success).wrongIds
  },
  refusalTarget(slotId) {
    return binIdFromSlot(slotId) ?? slotId
  },
}
```

**ActivityNode** — replace `compose` case:

```tsx
case 'compose': {
  const material = getApparatus('bonding-ring')?.legacy?.fromLegacy(
    spec.payload,
    spec.success,
  )
  if (material) {
    return (
      <MaterialActivity
        id={id}
        spec={spec}
        materialSpec={material}
        adapter={composeAdapter}
        onOutcome={emitActivityOutcome}
        initialState={initialState}
      />
    )
  }
  return (
    <ComposeActivity
      id={id}
      spec={spec}
      onOutcome={emitActivityOutcome}
      initialState={initialState}
    />
  )
}
```

Import `composeAdapter`. Do not delete `ComposeActivity`.

- [ ] **Step 1: Implement**

- [ ] **Step 2: Full gate**

- [ ] **Step 3: Commit**

```
feat(studylab): live compose activities prefer bonding-ring renderer

Fall back to ComposeActivity when fromLegacy returns null.
```

---

### Task 3: Browser verification + handover

**Files:**
- Modify: `docs/HANDOVER.md`
- Touch `app/dev/activities/page.tsx` only if `n-compose` cannot reach a solved Check (existing water fixture should work).

**Browser checklist** (Playwright MCP on `/dev/activities`):

1. **`n-compose`:** material Bonding ring / Available bonds + gauge (not legacy part-onto-part); drag both H—O chips to `s-joined`; gauge updates; **Check** solves.
2. Smoke prior cutovers (sort, sequence, compare, balance, label, vary, scenario).

**HANDOVER:** Mark compose cutover done (8 of 9); remaining threePeriod + Stage 4; `ComposeActivity` fallback; bond-chips-not-parts intentional.

- [ ] **Step 1: Browser verify**

- [ ] **Step 2: Update HANDOVER**

- [ ] **Step 3: Final gate + commit**

```
docs(studylab): record Stage 3b compose live cutover

bonding-ring owns the live compose path; ComposeActivity remains fallback.
```

**Do not push.**

---

## Spec coverage (self-review)

| Spec requirement | Task |
|---|---|
| joins ↔ bond-* helpers | 1 |
| composeAdapter | 2 |
| ActivityNode fromLegacy once | 2 |
| Browser n-compose | 3 |
| ComposeActivity fallback | 2 |
| No push / no .test.tsx | Global |

## Placeholder / consistency check

- Helper names: `joinsToPlacement` / `placementToJoins`.
- No TBD steps.
