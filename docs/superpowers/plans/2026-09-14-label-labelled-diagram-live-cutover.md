# Stage 3b — Label → Labelled-Diagram Live Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route well-formed live `label` activities through `labelled-diagram` + `MaterialActivity`, mapping flipped legacy `assign` (hotspot→label) to placement (label→`s-${hotspot}`), with `LabelActivity` as fallback.

**Architecture:** Pure `labelPlacement` helpers that flip key/value roles; `labelAdapter` using empty fresh work + `labelModule.validate`; `ActivityNode` wire-up; add `n-label` bench fixture. No catalogue art. Diagram SVG behind hotspots is an intentional non-goal.

**Tech Stack:** TypeScript strict, existing React adapters / MaterialRenderer, vitest node-only, Playwright. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-14-label-labelled-diagram-live-cutover-design.md`

## Global Constraints

- **One new live pattern only:** `label` → `labelled-diagram`. Sort, sequence, compare, balance must keep working.
- **Do not delete** `LabelActivity.tsx` (or prior legacy activities).
- **Conversion ownership:** `fromLegacy(payload, success)` only in `ActivityNode`.
- **Persistence unchanged:** `work.assign` remains **`hotspotId → label`**.
- **Check:** `tick().solved` sole solve authority; `labelModule.validate` only for `wrongIds` when unsolved.
- **Never call** `sortPlacement.assignToPlacement` / `placementToAssign` on raw label `work.assign` — those assume piece→bin, not hotspot→label.
- **Never create `.test.tsx`.**
- **Local commits only. NEVER push** (`aws_deploy` deploys).
- Work in `c:\Users\Stephen\AI_assessment` — not a worktree.
- Do not change interpreter capacity-1 swap for this cut.
- Dedicated `labelAdapter` — do not overload sort/compare adapters.
- No catalogue art / no diagram image in MaterialRenderer for this cut.

## File Structure

| Path | Responsibility |
|---|---|
| `lib/studylab/material/labelPlacement.ts` | Pure hotspot→label ↔ placement helpers |
| `lib/studylab/material/labelPlacement.test.ts` | Round-trip / flip / non-s-* drop |
| `components/studylab/material/adapters.ts` | `labelAdapter` |
| `components/studylab/activities/ActivityNode.tsx` | Wire `label` case |
| `app/dev/activities/page.tsx` | Add `n-label` fixture |
| `docs/HANDOVER.md` | Record label cutover |

---

### Task 1: Hotspot→label ↔ placement helpers

**Files:**
- Create: `lib/studylab/material/labelPlacement.ts`
- Test: `lib/studylab/material/labelPlacement.test.ts`

**Interfaces:**
- Consumes: `slotIdForBin` / `binIdFromSlot` from `./sortPlacement`.
- Produces:
  - `labelAssignToPlacement(assign: Record<string, string>): Record<string, string>`
    - Input: legacy `hotspotId → label`
    - Output: `placement[label] = s-${hotspotId}` (skip empty labels)
  - `placementToLabelAssign(placement: Record<string, string>): Record<string, string>`
    - Output: legacy `hotspotId → label` via `binIdFromSlot`; ignore non-`s-*`

- [ ] **Step 1: Failing tests**

```ts
import { describe, it, expect } from 'vitest'
import { labelAssignToPlacement, placementToLabelAssign } from './labelPlacement'

describe('labelPlacement', () => {
  it('flips hotspot→label assign into label→slot placement', () => {
    expect(
      labelAssignToPlacement({ nucleus: 'Nucleus', membrane: 'Membrane' }),
    ).toEqual({ Nucleus: 's-nucleus', Membrane: 's-membrane' })
  })

  it('flips placement back to hotspot→label assign', () => {
    expect(
      placementToLabelAssign({ Nucleus: 's-nucleus', Membrane: 's-membrane' }),
    ).toEqual({ nucleus: 'Nucleus', membrane: 'Membrane' })
  })

  it('round-trips', () => {
    const assign = { nucleus: 'Nucleus', membrane: 'Membrane' }
    expect(placementToLabelAssign(labelAssignToPlacement(assign))).toEqual(assign)
  })

  it('drops non-s-* slots and empty labels', () => {
    expect(
      placementToLabelAssign({ Nucleus: 's-nucleus', X: 'pool', Y: 'nucleus' }),
    ).toEqual({ nucleus: 'Nucleus' })
    expect(labelAssignToPlacement({ nucleus: '', membrane: 'Membrane' })).toEqual({
      Membrane: 's-membrane',
    })
  })
})
```

- [ ] **Step 2: Run — expect FAIL** (module not found)

Run: `npx vitest run lib/studylab/material/labelPlacement`

- [ ] **Step 3: Implement**

- [ ] **Step 4: Focused tests + full gate** `npx tsc --noEmit && npx vitest run`

- [ ] **Step 5: Commit**

```
feat(studylab): map label hotspot→label work to labelled-diagram placement

Live cutover must flip legacy assign keys through s-${hotspot} slots.
```

---

### Task 2: `labelAdapter` + `ActivityNode` wire-up

**Files:**
- Modify: `components/studylab/material/adapters.ts`
- Modify: `components/studylab/activities/ActivityNode.tsx`

**Interfaces:**

```ts
import { labelModule } from '@/lib/studylab/activities/patterns/label'
import {
  labelAssignToPlacement,
  placementToLabelAssign,
} from '@/lib/studylab/material/labelPlacement'
import { binIdFromSlot } from '@/lib/studylab/material/sortPlacement'

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
    return binIdFromSlot(slotId) ?? slotId
  },
}
```

**ActivityNode** — replace `label` case:

```tsx
case 'label': {
  const material = getApparatus('labelled-diagram')?.legacy?.fromLegacy(
    spec.payload,
    spec.success,
  )
  if (material) {
    return (
      <MaterialActivity
        id={id}
        spec={spec}
        materialSpec={material}
        adapter={labelAdapter}
        onOutcome={emitActivityOutcome}
        initialState={initialState}
      />
    )
  }
  return (
    <LabelActivity
      id={id}
      spec={spec}
      onOutcome={emitActivityOutcome}
      initialState={initialState}
    />
  )
}
```

Import `labelAdapter`. Do not delete `LabelActivity`.

- [ ] **Step 1: Implement**

- [ ] **Step 2: Full gate** `npx tsc --noEmit && npx vitest run`

- [ ] **Step 3: Commit**

```
feat(studylab): live label activities prefer labelled-diagram renderer

Fall back to LabelActivity when fromLegacy returns null.
```

---

### Task 3: Bench fixture + browser verification + handover

**Files:**
- Modify: `app/dev/activities/page.tsx` — add `labelSpec` + `n-label` node
- Modify: `docs/HANDOVER.md`

**Fixture** (mirror equivalence sample; use `imageUrl` not raw svg markup):

```ts
const labelSpec: ActivitySpec = {
  pattern: 'label',
  prompt: 'Label each part of the cell.',
  payload: {
    image: { imageUrl: 'asset:cell', width: 100, height: 100 },
    hotspots: [
      { id: 'nucleus', x: 30, y: 30, r: 8, label: 'Nucleus' },
      { id: 'membrane', x: 70, y: 70, r: 8, label: 'Membrane' },
    ],
  },
  success: {
    kind: 'pairing',
    pairs: [
      ['nucleus', 'Nucleus'],
      ['membrane', 'Membrane'],
    ],
  },
  hints: ['Start with the centre.'],
  reveal: 'Nucleus is the centre; membrane is the outer boundary.',
}
```

Place `n-label` on the bench (e.g. x=2100) via `specNode('n-label', labelSpec, …)`.

**Browser checklist** (Playwright MCP on `/dev/activities`):

1. **`n-label`:** material slots (not legacy diagram circles); chips in pool; correct drop sticks; wrong hotspot refuses/springs back; Check solves when both correct.
2. Smoke **`n-sort`**, **`n-sequence`**, **`n-compare`**, **`n-balance`**.

**HANDOVER:** Mark label cutover done (verified claims only); remaining four patterns + Stage 4; test counts; `LabelActivity` fallback; slots-not-diagram intentional.

- [ ] **Step 1: Add `n-label` fixture**

- [ ] **Step 2: Browser verify**

- [ ] **Step 3: Update HANDOVER**

- [ ] **Step 4: Final gate + commit**

```
docs(studylab): record Stage 3b label live cutover

labelled-diagram owns the live label path; LabelActivity remains fallback.
```

**Do not push.**

---

## Spec coverage (self-review)

| Spec requirement | Task |
|---|---|
| hotspot→label ↔ placement helpers (flip) | 1 |
| labelAdapter + empty freshWork | 2 |
| ActivityNode fromLegacy once | 2 |
| n-label bench + browser | 3 |
| LabelActivity fallback | 2 |
| No catalogue art / no diagram | Global |
| No push / no .test.tsx | Global |

## Placeholder / consistency check

- Helper names: `labelAssignToPlacement` / `placementToLabelAssign`.
- Persistence keys remain hotspot ids.
- No TBD steps.
