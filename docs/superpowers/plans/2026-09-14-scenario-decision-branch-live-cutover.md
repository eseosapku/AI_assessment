# Stage 3b — Scenario → Decision-Branch Live Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route well-formed live `scenario` activities through `decision-branch` + `MaterialActivity`, mapping `{ chosen }` work to `s-chosen` placement, with `ScenarioActivity` as fallback.

**Architecture:** Pure `scenarioPlacement` helpers; `scenarioAdapter`; `ActivityNode` wire-up; `n-scenario` bench. Gauge display already works via existing MaterialRenderer — do not rebuild. No catalogue art. Click-auto-grade is an intentional non-goal.

**Tech Stack:** TypeScript strict, existing React adapters / MaterialRenderer, vitest node-only, Playwright. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-14-scenario-decision-branch-live-cutover-design.md`

## Global Constraints

- **One new live pattern only:** `scenario` → `decision-branch`. Prior six cutovers must keep working.
- **Do not delete** `ScenarioActivity.tsx` (or prior legacy activities).
- **Conversion ownership:** `fromLegacy(payload, success)` only in `ActivityNode`.
- **Persistence unchanged:** `{ chosen: string | null }`.
- **Check:** `tick().solved` sole solve authority; `scenarioModule.validate` only for `wrongIds` when unsolved.
- **Pool:** hydrate non-chosen as **unplaced**; persist ignores `s-pool`.
- **Never create `.test.tsx`.**
- **Local commits only. NEVER push** (`aws_deploy` deploys).
- Work in `c:\Users\Stephen\AI_assessment` — not a worktree.
- Dedicated `scenarioAdapter` — do not overload sort/compare adapters.

## File Structure

| Path | Responsibility |
|---|---|
| `lib/studylab/material/scenarioPlacement.ts` | Pure chosen ↔ placement helpers |
| `lib/studylab/material/scenarioPlacement.test.ts` | Round-trip / null / s-pool |
| `components/studylab/material/adapters.ts` | `scenarioAdapter` |
| `components/studylab/activities/ActivityNode.tsx` | Wire `scenario` case |
| `app/dev/activities/page.tsx` | Add `n-scenario` fixture |
| `docs/HANDOVER.md` | Record scenario cutover |

---

### Task 1: `chosen` ↔ placement helpers

**Files:**
- Create: `lib/studylab/material/scenarioPlacement.ts`
- Test: `lib/studylab/material/scenarioPlacement.test.ts`

**Interfaces:**
- Reuse `slotIdForBin` / `binIdFromSlot` from `./sortPlacement` (`s-chosen`).
- Produces:
  - `chosenToPlacement(chosen: string | null): Record<string, string>`
  - `placementToChosen(placement: Record<string, string>): string | null`
    - piece on `s-chosen`; if multiple, lexicographically smallest id; ignore `s-pool`

- [ ] **Step 1: Failing tests**

```ts
import { describe, it, expect } from 'vitest'
import { chosenToPlacement, placementToChosen } from './scenarioPlacement'

describe('scenarioPlacement', () => {
  it('round-trips a chosen id', () => {
    expect(chosenToPlacement('safe')).toEqual({ safe: 's-chosen' })
    expect(placementToChosen({ safe: 's-chosen' })).toBe('safe')
  })

  it('maps null / empty to empty placement', () => {
    expect(chosenToPlacement(null)).toEqual({})
    expect(chosenToPlacement('')).toEqual({})
    expect(placementToChosen({})).toBeNull()
  })

  it('ignores s-pool and non-chosen slots', () => {
    expect(
      placementToChosen({ safe: 's-pool', unsafe: 's-chosen', x: 'pool' }),
    ).toBe('unsafe')
  })

  it('picks lexicographically smallest if multiple on s-chosen', () => {
    expect(placementToChosen({ b: 's-chosen', a: 's-chosen' })).toBe('a')
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run lib/studylab/material/scenarioPlacement`

- [ ] **Step 3: Implement**

- [ ] **Step 4: Focused + full gate** `npx tsc --noEmit && npx vitest run`

- [ ] **Step 5: Commit**

```
feat(studylab): map scenario chosen work to decision-branch placement

Live cutover must round-trip ActivitySpec work.chosen through s-chosen.
```

---

### Task 2: `scenarioAdapter` + `ActivityNode` wire-up

**Files:**
- Modify: `components/studylab/material/adapters.ts`
- Modify: `components/studylab/activities/ActivityNode.tsx`

**Interfaces:**

```ts
import { scenarioModule } from '@/lib/studylab/activities/patterns/scenario'
import { chosenToPlacement, placementToChosen } from '@/lib/studylab/material/scenarioPlacement'
import { binIdFromSlot } from '@/lib/studylab/material/sortPlacement'

export const scenarioAdapter: MaterialWorkAdapter = {
  freshWork() {
    return { chosen: null }
  },
  placementFromWork(work) {
    const chosen = typeof work.chosen === 'string' ? work.chosen : null
    return chosenToPlacement(chosen)
  },
  workFromPlacement(placement) {
    return { chosen: placementToChosen(placement) }
  },
  wrongIdsWhenUnsolved(payload, work, success) {
    return scenarioModule.validate(payload as never, work as never, success).wrongIds
  },
  refusalTarget(slotId) {
    return binIdFromSlot(slotId) ?? slotId
  },
}
```

**ActivityNode** — replace `scenario` case:

```tsx
case 'scenario': {
  const material = getApparatus('decision-branch')?.legacy?.fromLegacy(
    spec.payload,
    spec.success,
  )
  if (material) {
    return (
      <MaterialActivity
        id={id}
        spec={spec}
        materialSpec={material}
        adapter={scenarioAdapter}
        onOutcome={emitActivityOutcome}
        initialState={initialState}
      />
    )
  }
  return (
    <ScenarioActivity
      id={id}
      spec={spec}
      onOutcome={emitActivityOutcome}
      initialState={initialState}
    />
  )
}
```

Import `scenarioAdapter`. Do not delete `ScenarioActivity`.

- [ ] **Step 1: Implement**

- [ ] **Step 2: Full gate** `npx tsc --noEmit && npx vitest run`

- [ ] **Step 3: Commit**

```
feat(studylab): live scenario activities prefer decision-branch renderer

Fall back to ScenarioActivity when fromLegacy returns null.
```

---

### Task 3: Bench fixture + browser verification + handover

**Files:**
- Modify: `app/dev/activities/page.tsx` — add `scenarioSpec` + `n-scenario`
- Modify: `docs/HANDOVER.md`

**Fixture:**

```ts
const scenarioSpec: ActivitySpec = {
  pattern: 'scenario',
  prompt: 'Choose the safer route.',
  payload: {
    situation: 'Which route is safe?',
    choices: [
      { id: 'safe', label: 'Use the bridge', consequence: 'You cross safely.', defensible: true },
      { id: 'unsafe', label: 'Enter the flood', consequence: 'The current is dangerous.' },
    ],
  },
  success: { kind: 'exactSet', itemIds: ['safe'] },
  hints: ['Think about the current.'],
  reveal: 'The bridge is the defensible choice.',
}
```

Place `n-scenario` (e.g. x=2940).

**Browser checklist** (Playwright MCP on `/dev/activities`):

1. **`n-scenario`:** material My choice / Choices slots + gauge (not click-list ScenarioActivity); drag `safe` → `s-chosen`; **Check** solves; optionally wrong `unsafe` stays unsolved on Check.
2. Smoke prior cutovers: sort, sequence, compare, balance, label, vary.

**HANDOVER:** Mark scenario cutover done; remaining two + Stage 4; `ScenarioActivity` fallback; drag+Check-not-auto-grade intentional.

- [ ] **Step 1: Add fixture**

- [ ] **Step 2: Browser verify**

- [ ] **Step 3: Update HANDOVER**

- [ ] **Step 4: Final gate + commit**

```
docs(studylab): record Stage 3b scenario live cutover

decision-branch owns the live scenario path; ScenarioActivity remains fallback.
```

**Do not push.**

---

## Spec coverage (self-review)

| Spec requirement | Task |
|---|---|
| chosen ↔ s-chosen helpers | 1 |
| scenarioAdapter | 2 |
| ActivityNode fromLegacy once | 2 |
| n-scenario + browser | 3 |
| ScenarioActivity fallback | 2 |
| No push / no .test.tsx | Global |

## Placeholder / consistency check

- Helper names: `chosenToPlacement` / `placementToChosen`.
- No TBD steps.
