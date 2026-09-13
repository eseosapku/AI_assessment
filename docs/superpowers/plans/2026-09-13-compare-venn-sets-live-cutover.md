# Stage 3b — Compare → Venn-Sets Live Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route well-formed live `compare` activities through `venn-sets` + `MaterialActivity`, reusing `sortPlacement` for `assign` ↔ `s-left|both|right`, with `CompareActivity` as fallback.

**Architecture:** Add `compareAdapter` (same shape as `sortAdapter`, but `compareModule` for wrongIds). Map catalogue art in `vennSets.convert`. Wire `ActivityNode` `compare` case. Bench already has `n-compare` — use it for browser verification.

**Tech Stack:** TypeScript strict, existing React client components / adapters, vitest node-only, Playwright for browser. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-13-compare-venn-sets-live-cutover-design.md`

## Global Constraints

- **One new live pattern only:** `compare` → `venn-sets`. Sort and sequence must keep working.
- **Do not delete** `CompareActivity.tsx` (or Sort/Sequence activities).
- **Conversion ownership:** `fromLegacy(payload, success)` only in `ActivityNode`.
- **Persistence unchanged:** `{ assign: Record<itemId, 'left'|'right'|'both'> }` via existing `sortPlacement`.
- **Check:** `tick().solved` sole solve authority; `compareModule.validate` only for `wrongIds` when unsolved.
- **Never create `.test.tsx`.**
- **Local commits only. NEVER push** (`aws_deploy` deploys).
- Work in `c:\Users\Stephen\AI_assessment` — not a worktree.
- Preserve `activityRef` and capacity-1 swap behaviour (do not change interpreter for this cut).
- Dedicated `compareAdapter` — do not overload `sortAdapter` with `sortModule`.

## File Structure

| Path | Responsibility |
|---|---|
| `lib/studylab/material/canon/vennSets.ts` | `catalogueArt` on pieces in `convert` |
| `lib/studylab/material/canon/equivalence.test.ts` | Art pin for venn-sets |
| `components/studylab/material/adapters.ts` | `compareAdapter` |
| `components/studylab/activities/ActivityNode.tsx` | Wire `compare` case |
| `app/dev/activities/page.tsx` | Confirm `n-compare` exists (already present); tweak only if needed for Playwright |
| `docs/HANDOVER.md` | Record compare cutover |

---

### Task 1: Venn-sets catalogue art

**Files:**
- Modify: `lib/studylab/material/canon/vennSets.ts`
- Modify: `lib/studylab/material/canon/equivalence.test.ts`

**Interfaces:**
- Consumes: `catalogueArt` from `../catalogueArt`.
- Produces: `convert` pieces include optional `art` from `item.imageUrl`.

- [ ] **Step 1: Write failing art test** (mirror ordering-track / sorting-frame describe)

```ts
describe('venn-sets fromLegacy preserves catalogue art', () => {
  it('maps legal imageUrl onto piece.art', () => {
    const payload = {
      sets: [{ id: 'A', label: 'A' }, { id: 'B', label: 'B' }],
      items: [
        { id: 'a', label: 'A only', belongs: 'left' as const, imageUrl: 'asset:balance-scale' },
        { id: 'b', label: 'Both', belongs: 'both' as const, imageUrl: 'neuron' },
        { id: 'c', label: 'Bad', belongs: 'right' as const, imageUrl: 'asset:https://evil.example/x.png' },
        { id: 'd', label: 'Plain', belongs: 'right' as const },
      ],
    }
    const success = {
      kind: 'binAssignment' as const,
      assign: { a: 'left', b: 'both', c: 'right', d: 'right' },
    }
    const spec = getApparatus('venn-sets')!.legacy!.fromLegacy(payload, success)!
    const byId = Object.fromEntries(spec.pieces.map((p) => [p.id, p]))
    expect(byId.a.art).toBe('balance-scale')
    expect(byId.b.art).toBe('neuron')
    expect(byId.c.art).toBeUndefined()
    expect(byId.d.art).toBeUndefined()
  })
})
```

Adjust `sets` / `belongs` if `isPayload` requires specific set ids — read `compareModule.isPayload` and existing equivalence compare fixture first.

- [ ] **Step 2: Run test — expect FAIL** (art undefined)

Run: `npx vitest run lib/studylab/material/canon/equivalence.test.ts -t "venn-sets fromLegacy preserves"`

- [ ] **Step 3: Wire convert**

```ts
import { catalogueArt } from '../catalogueArt'
// in pieces map:
const art = catalogueArt(item.imageUrl)
return {
  id: item.id,
  label: item.label,
  ...(art ? { art } : {}),
  traits: { side: item.belongs, overlap: item.belongs === 'both' ? 1 : 0 },
}
```

- [ ] **Step 4: Gate**

Run: `npx tsc --noEmit && npx vitest run`

- [ ] **Step 5: Commit**

```
feat(studylab): preserve venn-sets catalogue art from legacy imageUrl

Pictured compare items keep asset names through fromLegacy.
```

---

### Task 2: `compareAdapter` + `ActivityNode` wire-up

**Files:**
- Modify: `components/studylab/material/adapters.ts`
- Modify: `components/studylab/activities/ActivityNode.tsx`

**Interfaces:**

```ts
import { compareModule } from '@/lib/studylab/activities/patterns/compare'

export const compareAdapter: MaterialWorkAdapter = {
  freshWork() {
    return { assign: {} }
  },
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

**ActivityNode** — replace current `compare` case:

```tsx
case 'compare': {
  const material = getApparatus('venn-sets')?.legacy?.fromLegacy(
    spec.payload,
    spec.success,
  )
  if (material) {
    return (
      <MaterialActivity
        id={id}
        spec={spec}
        materialSpec={material}
        adapter={compareAdapter}
        onOutcome={emitActivityOutcome}
        initialState={initialState}
      />
    )
  }
  return (
    <CompareActivity
      id={id}
      spec={spec}
      onOutcome={emitActivityOutcome}
      initialState={initialState}
    />
  )
}
```

Import `compareAdapter` from adapters. Do not delete `CompareActivity` import.

- [ ] **Step 1: Implement adapter + wire**

- [ ] **Step 2: Full gate** `npx tsc --noEmit && npx vitest run`

- [ ] **Step 3: Commit**

```
feat(studylab): live compare activities prefer venn-sets renderer

Fall back to CompareActivity when fromLegacy returns null.
```

---

### Task 3: Browser verification + handover

**Files:**
- Modify: `docs/HANDOVER.md`
- Touch `app/dev/activities/page.tsx` only if `n-compare` needs a tweak for the checklist (it already exists at x=840).

**Browser checklist** (Playwright MCP on `/dev/activities`):

1. **`n-compare`:** material chips/slots (not SVG Venn); empty pool start; drag into left/both/right; wrong full assign → Check unsolved + wrongIds; correct assign → Check solves.
2. Smoke **`n-sort`** and **`n-sequence`** still on material path.
3. Bench venn-sets / material picker still mounts.

**HANDOVER:** Mark compare cutover done (only what was verified); remaining six patterns + Stage 4; test counts; `CompareActivity` fallback; note slots-not-crescents intentional.

- [ ] **Step 1: Browser verify**

- [ ] **Step 2: Update HANDOVER**

- [ ] **Step 3: Final gate + commit**

```
docs(studylab): record Stage 3b compare live cutover

venn-sets owns the live compare path; CompareActivity remains fallback.
```

**Do not push.**

---

## Spec coverage (self-review)

| Spec requirement | Task |
|---|---|
| catalogueArt in venn convert | 1 |
| compareAdapter + sortPlacement reuse | 2 |
| ActivityNode fromLegacy once | 2 |
| n-compare browser + sort/sequence smoke | 3 |
| CompareActivity fallback / not deleted | 2 |
| tick sole solve (unchanged MaterialActivity) | 2 (adapter only) |
| No new placement module | Global |
| No push / no .test.tsx | Global |

## Placeholder / consistency check

- Adapter method names match existing `MaterialWorkAdapter`.
- Zone ids `left`/`both`/`right` via `s-${zone}` from `sortPlacement`.
- No TBD steps.
