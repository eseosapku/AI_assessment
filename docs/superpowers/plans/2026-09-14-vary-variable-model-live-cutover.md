# Stage 3b — Vary → Variable-Model Live Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route well-formed live `vary` activities through `variable-model` + `MaterialActivity`, mapping `{ value }` work to material `controls[variableId]`, with `VaryActivity` as fallback.

**Architecture:** Pure `varyControls` helpers; extend `MaterialWorkAdapter` + `MaterialActivity` so control-backed patterns hydrate/persist controls; `varyAdapter`; `ActivityNode` wire-up; `n-vary` bench. No catalogue art. Legacy SVG models are an intentional non-goal.

**Tech Stack:** TypeScript strict, existing React adapters / MaterialRenderer, vitest node-only, Playwright. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-14-vary-variable-model-live-cutover-design.md`

## Global Constraints

- **One new live pattern only:** `vary` → `variable-model`. Sort, sequence, compare, balance, label must keep working.
- **Do not delete** `VaryActivity.tsx` (or prior legacy activities).
- **Conversion ownership:** `fromLegacy(payload, success)` only in `ActivityNode`.
- **Persistence unchanged:** `work` remains `{ value: number }`.
- **Check:** `tick().solved` sole solve authority; `varyModule.validate` only for `wrongIds` when unsolved.
- **Placement adapters must ignore the new optional `controls` argument** — no behaviour change for prior cutovers.
- **Never create `.test.tsx`.**
- **Local commits only. NEVER push** (`aws_deploy` deploys).
- Work in `c:\Users\Stephen\AI_assessment` — not a worktree.
- Dedicated `varyAdapter` — do not overload sort/compare adapters.
- No legacy multi-bar / tank / plot SVG recreation.

## File Structure

| Path | Responsibility |
|---|---|
| `lib/studylab/material/varyControls.ts` | Pure value ↔ controls helpers |
| `lib/studylab/material/varyControls.test.ts` | Round-trip / fallback |
| `components/studylab/material/adapters.ts` | Optional control hooks on type; `varyAdapter` |
| `components/studylab/material/MaterialActivity.tsx` | Hydrate/persist controls via adapter |
| `components/studylab/activities/ActivityNode.tsx` | Wire `vary` case |
| `app/dev/activities/page.tsx` | Add `n-vary` fixture |
| `docs/HANDOVER.md` | Record vary cutover |

---

### Task 1: Control helpers + adapter type + MaterialActivity bridge

**Files:**
- Create: `lib/studylab/material/varyControls.ts`
- Test: `lib/studylab/material/varyControls.test.ts`
- Modify: `components/studylab/material/adapters.ts` (type only in this task — add optional hooks; **do not add varyAdapter yet**)
- Modify: `components/studylab/material/MaterialActivity.tsx`

**Interfaces — helpers:**

```ts
export function valueToControls(controlId: string, value: number): Record<string, number>
export function controlsToValue(
  controls: Record<string, number> | undefined,
  controlId: string,
  fallback: number,
): number
```

**Interfaces — adapter type** (add optional; extend `workFromPlacement` signature):

```ts
controlsFromWork?(
  work: Record<string, unknown>,
  materialSpec: MaterialSpec,
  payload: unknown,
): Record<string, number>

workFromPlacement(
  placement: Placement,
  materialSpec: MaterialSpec,
  payload: unknown,
  controls?: Record<string, number>,
): Record<string, unknown>
```

**MaterialActivity:**

- `seedMaterialState`: if `adapter.controlsFromWork`, set `controls` from it; `hasWork` = non-empty placement **OR** `typeof work.value === 'number'`.
- `handleStateChange` / `check`: pass `next.controls` / `materialState.controls` as 4th arg to `workFromPlacement`.

Existing adapters need no body changes (optional 4th param ignored).

- [ ] **Step 1: Failing helper tests**

```ts
import { describe, it, expect } from 'vitest'
import { controlsToValue, valueToControls } from './varyControls'

describe('varyControls', () => {
  it('round-trips value through controls', () => {
    expect(valueToControls('temperature', 5)).toEqual({ temperature: 5 })
    expect(controlsToValue({ temperature: 5 }, 'temperature', 0)).toBe(5)
  })

  it('falls back when control missing', () => {
    expect(controlsToValue({}, 'temperature', 2)).toBe(2)
    expect(controlsToValue(undefined, 'temperature', 2)).toBe(2)
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run lib/studylab/material/varyControls`

- [ ] **Step 3: Implement helpers + type + MaterialActivity**

- [ ] **Step 4: Full gate** `npx tsc --noEmit && npx vitest run`

- [ ] **Step 5: Commit**

```
feat(studylab): round-trip material controls through MaterialActivity

Control-backed patterns need work hydrate/persist beyond placement alone.
```

---

### Task 2: `varyAdapter` + `ActivityNode` wire-up

**Files:**
- Modify: `components/studylab/material/adapters.ts`
- Modify: `components/studylab/activities/ActivityNode.tsx`

**Interfaces:**

```ts
import { varyModule } from '@/lib/studylab/activities/patterns/vary'
import { controlsToValue, valueToControls } from '@/lib/studylab/material/varyControls'
import type { VaryPayload } from '@/lib/studylab/activities/types'

function variableId(payload: unknown): string | null {
  if (varyModule.isPayload(payload)) return payload.variable.id
  return null
}

export const varyAdapter: MaterialWorkAdapter = {
  freshWork(payload) {
    if (varyModule.isPayload(payload)) {
      return varyModule.initialWork(payload) as unknown as Record<string, unknown>
    }
    return { value: 0 }
  },
  placementFromWork() {
    return {}
  },
  controlsFromWork(work, _spec, payload) {
    const id = variableId(payload)
    if (!id) return {}
    const value = typeof work.value === 'number' && Number.isFinite(work.value)
      ? work.value
      : (varyModule.isPayload(payload) ? payload.variable.min : 0)
    return valueToControls(id, value)
  },
  workFromPlacement(_placement, _spec, payload, controls) {
    const id = variableId(payload)
    const fallback = varyModule.isPayload(payload) ? payload.variable.min : 0
    if (!id) return { value: fallback }
    return { value: controlsToValue(controls, id, fallback) }
  },
  wrongIdsWhenUnsolved(payload, work, success) {
    return varyModule.validate(payload as never, work as never, success).wrongIds
  },
  refusalTarget(slotId) {
    return slotId
  },
}
```

**ActivityNode** — replace `vary` case (mirror balance/label):

```tsx
case 'vary': {
  const material = getApparatus('variable-model')?.legacy?.fromLegacy(
    spec.payload,
    spec.success,
  )
  if (material) {
    return (
      <MaterialActivity
        id={id}
        spec={spec}
        materialSpec={material}
        adapter={varyAdapter}
        onOutcome={emitActivityOutcome}
        initialState={initialState}
      />
    )
  }
  return (
    <VaryActivity
      id={id}
      spec={spec}
      onOutcome={emitActivityOutcome}
      initialState={initialState}
    />
  )
}
```

Import `varyAdapter`. Do not delete `VaryActivity`.

- [ ] **Step 1: Implement**

- [ ] **Step 2: Full gate** `npx tsc --noEmit && npx vitest run`

- [ ] **Step 3: Commit**

```
feat(studylab): live vary activities prefer variable-model renderer

Fall back to VaryActivity when fromLegacy returns null.
```

---

### Task 3: Bench fixture + browser verification + handover

**Files:**
- Modify: `app/dev/activities/page.tsx` — add `varySpec` + `n-vary` node
- Modify: `docs/HANDOVER.md`

**Fixture** (mirror equivalence sample):

```ts
const varySpec: ActivitySpec = {
  pattern: 'vary',
  prompt: 'Set the temperature to the target.',
  payload: {
    variable: { id: 'temperature', label: 'Temperature', min: 0, max: 10, step: 1 },
    model: { kind: 'bars', bars: [{ label: 'Height', expr: 'temperature', max: 10 }] },
    readouts: [{ label: 'Temperature', expr: 'temperature' }],
    target: { expr: 'temperature', value: 5, tolerance: 0.5 },
  },
  success: { kind: 'numericWithin', target: 5, tolerance: 0.5 },
  hints: ['Aim for the middle of the range.'],
  reveal: 'The target temperature is 5.',
}
```

Place `n-vary` on the bench (e.g. x=2520).

**Browser checklist** (Playwright MCP on `/dev/activities`):

1. **`n-vary`:** material control + display (not legacy VaryActivity SVG); move slider toward 5; display updates; **Check** solves at target (start at min=0).
2. Smoke **`n-sort`**, **`n-sequence`**, **`n-compare`**, **`n-balance`**, **`n-label`**.

**HANDOVER:** Mark vary cutover done (verified claims only); remaining three patterns + Stage 4; test counts; `VaryActivity` fallback; control+display-not-SVG intentional.

- [ ] **Step 1: Add `n-vary` fixture**

- [ ] **Step 2: Browser verify**

- [ ] **Step 3: Update HANDOVER**

- [ ] **Step 4: Final gate + commit**

```
docs(studylab): record Stage 3b vary live cutover

variable-model owns the live vary path; VaryActivity remains fallback.
```

**Do not push.**

---

## Spec coverage (self-review)

| Spec requirement | Task |
|---|---|
| value ↔ controls helpers | 1 |
| Adapter type + MaterialActivity control round-trip | 1 |
| varyAdapter + initialWork | 2 |
| ActivityNode fromLegacy once | 2 |
| n-vary bench + browser | 3 |
| VaryActivity fallback | 2 |
| Prior cutovers unchanged | Global / Task 1–2 gates |
| No push / no .test.tsx | Global |

## Placeholder / consistency check

- Helper names: `valueToControls` / `controlsToValue`.
- Optional `controlsFromWork`; optional 4th arg on `workFromPlacement`.
- No TBD steps.
