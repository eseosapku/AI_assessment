# Stage 3b — ThreePeriod → Three-Period-Cards Live Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route well-formed live `threePeriod` activities through `three-period-cards` + `MaterialActivity`, mapping recall `answers` to `s-answer-*` placement, with `ThreePeriodActivity` as fallback.

**Architecture:** Pure `threePeriodPlacement` helpers (need item id/label list); extend `placementFromWork` with optional payload arg; `catalogueArt` in convert; `threePeriodAdapter`; `ActivityNode` wire-up; `n-threePeriod` bench. Present/identify walkthrough is an intentional non-goal (recall-only).

**Tech Stack:** TypeScript strict, existing React adapters / MaterialRenderer, vitest node-only, Playwright. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-14-threePeriod-three-period-cards-live-cutover-design.md`

## Global Constraints

- **One new live pattern only:** `threePeriod` → `three-period-cards`. Prior eight must keep working.
- **Do not delete** `ThreePeriodActivity.tsx`.
- **Conversion ownership:** `fromLegacy(payload, success)` only in `ActivityNode`.
- **Persistence:** `answers` unchanged; material path always persists `phase: 2`.
- **Check:** `tick().solved` sole solve authority; `threePeriodModule.validate` for wrongIds when unsolved.
- **Never create `.test.tsx`.**
- **Local commits only. NEVER push.**
- Work in `c:\Users\Stephen\AI_assessment` — not a worktree.
- Dedicated `threePeriodAdapter`.
- Existing adapters ignore new optional `placementFromWork` 3rd arg.

## File Structure

| Path | Responsibility |
|---|---|
| `lib/studylab/material/threePeriodPlacement.ts` | answers ↔ placement helpers |
| `lib/studylab/material/threePeriodPlacement.test.ts` | Round-trip tests |
| `lib/studylab/material/canon/threePeriodCards.ts` | catalogueArt on convert |
| `lib/studylab/material/canon/equivalence.test.ts` | Art pin |
| `components/studylab/material/adapters.ts` | placementFromWork payload?; threePeriodAdapter |
| `components/studylab/material/MaterialActivity.tsx` | Pass payload to placementFromWork |
| `components/studylab/activities/ActivityNode.tsx` | Wire threePeriod case |
| `app/dev/activities/page.tsx` | n-threePeriod fixture |
| `docs/HANDOVER.md` | Record cutover (9 of 9) |

---

### Task 1: answers ↔ placement helpers + placementFromWork payload arg

**Files:**
- Create: `lib/studylab/material/threePeriodPlacement.ts` + `.test.ts`
- Modify: `adapters.ts` — add optional 3rd `payload?: unknown` to `placementFromWork` type only (bodies unchanged)
- Modify: `MaterialActivity.tsx` — `seedMaterialState` calls `placementFromWork(work, materialSpec, payload)`

**Interfaces:**

```ts
type ItemRef = { id: string; label: string }

export function answersToPlacement(
  answers: Record<string, string>,
  items: ItemRef[],
): Record<string, string>

export function placementToAnswers(
  placement: Record<string, string>,
  items: ItemRef[],
): Record<string, string>
```

- Hydrate: label → item id via items; `placement[pieceId] = slotIdForBin('answer-' + item.id)`
- Persist: `binIdFromSlot` → strip `answer-` prefix → item label; skip non-matching

- [ ] **Step 1: Failing tests**

```ts
import { describe, it, expect } from 'vitest'
import { answersToPlacement, placementToAnswers } from './threePeriodPlacement'

const items = [
  { id: 'sun', label: 'Sun' },
  { id: 'moon', label: 'Moon' },
]

describe('threePeriodPlacement', () => {
  it('round-trips answers through s-answer-* slots', () => {
    const answers = { sun: 'Sun', moon: 'Moon' }
    const placement = answersToPlacement(answers, items)
    expect(placement).toEqual({
      sun: 's-answer-sun',
      moon: 's-answer-moon',
    })
    expect(placementToAnswers(placement, items)).toEqual(answers)
  })

  it('maps wrong pairing', () => {
    expect(answersToPlacement({ sun: 'Moon' }, items)).toEqual({
      sun: 's-answer-moon',
    })
  })

  it('skips unknown labels and non-answer slots', () => {
    expect(answersToPlacement({ sun: 'Nope' }, items)).toEqual({})
    expect(
      placementToAnswers({ sun: 's-answer-sun', x: 'pool', y: 's-warm' }, items),
    ).toEqual({ sun: 'Sun' })
  })

  it('maps empty', () => {
    expect(answersToPlacement({}, items)).toEqual({})
    expect(placementToAnswers({}, items)).toEqual({})
  })
})
```

- [ ] **Step 2–4: Implement, gate, commit**

```
feat(studylab): map threePeriod answers to three-period-cards placement

Live cutover must round-trip recall answers through s-answer-* slots.
```

---

### Task 2: catalogueArt on three-period-cards convert

**Files:**
- Modify: `lib/studylab/material/canon/threePeriodCards.ts`
- Modify: `lib/studylab/material/canon/equivalence.test.ts`

Mirror balance-beam art pin: legal `asset:…` / bare name → `art`; illegal/missing unset.

- [ ] **Steps: failing test → implement → gate → commit**

```
feat(studylab): preserve three-period-cards catalogue art from legacy imageUrl

Picture-first recall cards keep asset names through fromLegacy.
```

---

### Task 3: `threePeriodAdapter` + `ActivityNode` wire-up

**Files:**
- Modify: `adapters.ts`, `ActivityNode.tsx`

```ts
import { threePeriodModule } from '@/lib/studylab/activities/patterns/threePeriod'
import { answersToPlacement, placementToAnswers } from '@/lib/studylab/material/threePeriodPlacement'

function itemsFrom(payload: unknown): { id: string; label: string }[] {
  if (threePeriodModule.isPayload(payload)) return payload.items
  return []
}

export const threePeriodAdapter: MaterialWorkAdapter = {
  freshWork() {
    return { phase: 2, answers: {}, presentIdx: 0, identifyIdx: 0 }
  },
  placementFromWork(work, _spec, payload) {
    const answers = (work.answers as Record<string, string>) ?? {}
    return answersToPlacement(answers, itemsFrom(payload))
  },
  workFromPlacement(placement, _spec, payload) {
    return {
      phase: 2,
      answers: placementToAnswers(placement, itemsFrom(payload)),
      presentIdx: 0,
      identifyIdx: 0,
    }
  },
  wrongIdsWhenUnsolved(payload, work, success) {
    return threePeriodModule.validate(payload as never, work as never, success).wrongIds
  },
  refusalTarget(slotId) {
    return binIdFromSlot(slotId) ?? slotId
  },
}
```

Wire `threePeriod` case like compose. Do not delete `ThreePeriodActivity`.

- [ ] **Commit**

```
feat(studylab): live threePeriod activities prefer three-period-cards renderer

Fall back to ThreePeriodActivity when fromLegacy returns null.
```

---

### Task 4: Bench + browser + handover

**Fixture:**

```ts
const threePeriodSpec: ActivitySpec = {
  pattern: 'threePeriod',
  prompt: 'Learn the names, then recall them.',
  payload: {
    items: [
      { id: 'sun', label: 'Sun' },
      { id: 'moon', label: 'Moon' },
    ],
    phases: ['present', 'identify', 'recall'],
  },
  success: {
    kind: 'pairing',
    pairs: [
      ['sun', 'Sun'],
      ['moon', 'Moon'],
    ],
  },
  hints: ['Match each card to its name.'],
  reveal: 'Sun and Moon are the two names.',
}
```

Place `n-threePeriod` (e.g. x=3360).

**Browser:** material answer slots (not walkthrough); place sun/moon correctly; Check solves; smoke prior eight.

**HANDOVER:** Stage 3b complete (9 of 9); Stage 4 next; ThreePeriodActivity fallback; recall-only intentional.

- [ ] **Commit**

```
docs(studylab): record Stage 3b threePeriod live cutover

three-period-cards owns the live threePeriod path; Stage 3b complete.
```

**Do not push.**

---

## Spec coverage

| Spec requirement | Task |
|---|---|
| answers ↔ placement + payload on placementFromWork | 1 |
| catalogueArt | 2 |
| threePeriodAdapter + ActivityNode | 3 |
| n-threePeriod + browser + HANDOVER | 4 |
| recall-only / phase 2 | Global / Task 3 |
| No push / no .test.tsx | Global |
