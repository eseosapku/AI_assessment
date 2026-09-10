# Stage 3b — Sort → Sorting-Frame Live Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route well-formed live `sort` activities through `sorting-frame` + `MaterialRenderer`, while persisting the same `activityState.work.assign` shape and falling back to `SortActivity` when `fromLegacy` returns null.

**Architecture:** Pure `assign` ↔ `placement` helpers live under `lib/studylab/material/`. `MaterialRenderer` gains an additive controlled API (`state` / `onStateChange` + ActivityFrame overrides) so a new `MaterialActivity` bridge can own LearnSpace persistence, Check, hints, and outcomes. `ActivityNode` tries conversion once and chooses the bridge or the legacy component. `SortActivity.tsx` stays.

**Tech Stack:** TypeScript strict, existing React client components, `getApparatus` / `sortModule` / `buildOutcome` / `CanvasContext`, vitest node-only, Playwright mouse path for browser verification. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-10-sort-sorting-frame-live-cutover-design.md`

## Global Constraints

- **One pattern only:** `sort` → `sorting-frame`. Do not cut over any other pattern.
- **Do not delete** `SortActivity.tsx` or remove it from the bundle.
- **Conversion ownership:** `fromLegacy(payload, success)` is called in **exactly one place** — `ActivityNode` — and the result is passed into `MaterialActivity` as `materialSpec`. The bridge must not call `fromLegacy` again.
- **Persistence shape unchanged:** `work` remains `{ assign: Record<itemId, binId> }`. Slot ids stay `s-${binId}`.
- **Never create `.test.tsx`.** Unit tests are pure `.ts` helpers only. Browser checklist verifies drag / Check / remount.
- Art via `assetUrl()` only; `ss-*` colours inline; drag via `useActivityDrag`.
- `npx tsc --noEmit && npx vitest run` green at the end of every task.
- **Local commits only. NEVER push** (`aws_deploy` deploys).
- Work in the main repo at `c:\Users\Stephen\AI_assessment` — not a worktree.
- Baseline entering this plan: confirm with a quick gate if the tree has drifted (expect ~120 files / ~1560 tests after Stage 3 cut 1).

## File Structure

| Path | Responsibility |
|---|---|
| `lib/studylab/material/sortPlacement.ts` | Pure `assignToPlacement` / `placementToAssign` / `slotIdToBinId` |
| `lib/studylab/material/sortPlacement.test.ts` | Round-trip and ignore-invalid-slot pins |
| `components/studylab/material/MaterialRenderer.tsx` | Additive controlled state + ActivityFrame props; bench defaults unchanged |
| `components/studylab/material/PieceChip.tsx` | Optional wrong highlight (matches SortActivity after Check) |
| `components/studylab/material/MaterialActivity.tsx` | LearnSpace bridge: hydrate, persist, Check, hints, outcomes |
| `components/studylab/activities/ActivityNode.tsx` | `sort` case: try `fromLegacy`, mount bridge or `SortActivity` |
| `docs/HANDOVER.md` | Record Stage 3b done / remaining cutovers |

---

### Task 1: `assign` ↔ `placement` helpers

**Files:**
- Create: `lib/studylab/material/sortPlacement.ts`
- Test: `lib/studylab/material/sortPlacement.test.ts`

**Interfaces:**
- Consumes: none (pure string maps).
- Produces:
  - `slotIdForBin(binId: string): string` → `` `s-${binId}` ``
  - `binIdFromSlot(slotId: string): string | null` → strip leading `s-` when present, else `null`
  - `assignToPlacement(assign: Record<string, string>): Record<string, string>`
  - `placementToAssign(placement: Record<string, string>): Record<string, string>` — drops entries whose slot is not `s-*`

- [ ] **Step 1: Write the failing tests**

```ts
// lib/studylab/material/sortPlacement.test.ts
import { describe, it, expect } from 'vitest'
import {
  assignToPlacement,
  binIdFromSlot,
  placementToAssign,
  slotIdForBin,
} from './sortPlacement'

describe('sortPlacement', () => {
  it('uses the s-${binId} convention', () => {
    expect(slotIdForBin('warm')).toBe('s-warm')
    expect(binIdFromSlot('s-warm')).toBe('warm')
    expect(binIdFromSlot('warm')).toBeNull()
    expect(binIdFromSlot('pool')).toBeNull()
  })

  it('round-trips assign through placement', () => {
    const assign = { a: 'warm', b: 'cool' }
    expect(placementToAssign(assignToPlacement(assign))).toEqual(assign)
  })

  it('drops placement entries that are not s-* slots', () => {
    expect(
      placementToAssign({
        a: 's-warm',
        b: 'pool',
        c: 'warm',
      }),
    ).toEqual({ a: 'warm' })
  })

  it('omits empty assign keys rather than writing empty strings', () => {
    expect(assignToPlacement({})).toEqual({})
    expect(placementToAssign({})).toEqual({})
  })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run lib/studylab/material/sortPlacement`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// lib/studylab/material/sortPlacement.ts
/** Canon sorting-frame slot ids are `s-${groupId}` — pinned by equivalence tests. */
export function slotIdForBin(binId: string): string {
  return `s-${binId}`
}

export function binIdFromSlot(slotId: string): string | null {
  if (!slotId.startsWith('s-')) return null
  const binId = slotId.slice(2)
  return binId.length > 0 ? binId : null
}

export function assignToPlacement(assign: Record<string, string>): Record<string, string> {
  const placement: Record<string, string> = {}
  for (const [pieceId, binId] of Object.entries(assign)) {
    if (!binId) continue
    placement[pieceId] = slotIdForBin(binId)
  }
  return placement
}

export function placementToAssign(placement: Record<string, string>): Record<string, string> {
  const assign: Record<string, string> = {}
  for (const [pieceId, slotId] of Object.entries(placement)) {
    const binId = binIdFromSlot(slotId)
    if (!binId) continue
    assign[pieceId] = binId
  }
  return assign
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run lib/studylab/material/sortPlacement`
Expected: PASS.

- [ ] **Step 5: Full gate**

Run: `npx tsc --noEmit && npx vitest run`
Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/studylab/material/sortPlacement.ts lib/studylab/material/sortPlacement.test.ts
git commit -m "feat(studylab): map sort assign work to sorting-frame placement

Live cutover must round-trip ActivitySpec work.assign through s-\${binId} slots."
```

---

### Task 2: Controlled `MaterialRenderer` + wrong chip highlight

**Files:**
- Modify: `components/studylab/material/MaterialRenderer.tsx`
- Modify: `components/studylab/material/PieceChip.tsx`
- Modify: `components/studylab/material/MaterialBenchNode.tsx` only if props require it (prefer keeping `spec` + `resetKey` sufficient)

**Interfaces:**
- Consumes: existing `createInitialMaterialState`, `applyMove`, `tick`.
- Produces: `MaterialRenderer` accepts optional controlled props. When `state` **and** `onStateChange` are both provided, the renderer does not keep internal board state (still may keep refs). When omitted, behaviour matches today’s bench (internal state + `resetKey` effect).
- ActivityFrame overrides (all optional): `solved`, `revealed`, `reveal`, `hint`, `hintAvailable`, `onHint`, `onCheck`. Defaults: `solved` from `tick().solved`, `revealed=false`, hints off, no Check — current bench.
- `wrongIds?: string[]` — chips whose id is in the list get the same red treatment as `SortActivity`.
- `onRefusal?: (pieceId: string, slotId: string) => void` — called when `applyMove` appends a rejected move (bridge records bin-id telemetry).

**Chosen API (locked):** fully controlled when both `state` and `onStateChange` are passed. Not “initialState then uncontrolled”.

- [ ] **Step 1: Extend `PieceChip`**

Add optional `wrong?: boolean`. When true, apply styling equivalent to SortActivity’s wrong chip (`bg-red-500/10 text-red-600 dark:text-red-400`). When false, keep the existing panel look.

- [ ] **Step 2: Refactor `MaterialRenderer` props**

Replace the props type with:

```ts
export type MaterialRendererProps = {
  spec: MaterialSpec
  /** Bench-only remount key; ignored in controlled mode. */
  resetKey?: string
  state?: MaterialState
  onStateChange?: (next: MaterialState) => void
  solved?: boolean
  revealed?: boolean
  reveal?: string
  hint?: string | null
  hintAvailable?: boolean
  onHint?: () => void
  onCheck?: () => void
  wrongIds?: string[]
  onRefusal?: (pieceId: string, slotId: string) => void
}

export function MaterialRenderer({
  spec,
  resetKey = '',
  state: controlledState,
  onStateChange,
  solved: solvedProp,
  revealed = false,
  reveal,
  hint = null,
  hintAvailable = false,
  onHint,
  onCheck,
  wrongIds = [],
  onRefusal,
}: MaterialRendererProps) {
  const controlled = controlledState !== undefined && onStateChange !== undefined
  const [internal, setInternal] = useState(() => createInitialMaterialState(spec))

  useEffect(() => {
    if (controlled) return
    setInternal(createInitialMaterialState(spec))
  }, [controlled, resetKey, spec])

  const state = controlled ? controlledState! : internal
  const setState = controlled ? onStateChange! : setInternal

  // place / changeControl call setState(next) as today; on refusal also onRefusal?.(pieceId, slotId)
  // ActivityFrame:
  //   solved={solvedProp ?? result.solved}
  //   revealed={revealed}
  //   reveal={reveal}
  //   hint={hint}
  //   hintAvailable={hintAvailable}
  //   onHint={onHint ?? (() => undefined)}
  //   onCheck={onCheck}
  // pieceView passes wrong={wrongIds.includes(piece.id)}
}
```

Keep `MaterialBenchNode` as `<MaterialRenderer spec={…} resetKey={…} />` — no required change.

- [ ] **Step 3: Typecheck the material components**

Run: `npx tsc --noEmit`
Expected: PASS. (No new unit tests for the renderer — no `.test.tsx`.)

- [ ] **Step 4: Smoke the bench still compiles conceptually**

Confirm `MaterialBenchNode` still typechecks with only `spec` + `resetKey`. Full mouse-path regression is Task 5.

- [ ] **Step 5: Commit**

```bash
git add components/studylab/material/MaterialRenderer.tsx components/studylab/material/PieceChip.tsx
git commit -m "feat(studylab): controlled MaterialRenderer for live activity bridge

LearnSpace needs to own MaterialState and Check/hints without forking drag logic."
```

---

### Task 3: `MaterialActivity` bridge

**Files:**
- Create: `components/studylab/material/MaterialActivity.tsx`

**Interfaces:**
- Consumes: `materialSpec: MaterialSpec` (already validated), `ActivitySpec`, `ActivityState`, `createInitialMaterialState`, sortPlacement helpers, `sortModule`, `buildOutcome`, `CanvasContext`, controlled `MaterialRenderer`.
- Produces: `MaterialActivity({ id, spec, materialSpec, onOutcome, initialState? })`.
- Does **not** call `fromLegacy`.
- Persists via `onNodeDataChange(id, { activityState })` with `work: { assign }`.
- Reject telemetry: `onRefusal(pieceId, slotId)` → `{ itemId: pieceId, targetId: binIdFromSlot(slotId) ?? slotId }`.
- Check: `tick(materialSpec, materialState).solved` decides solve; on failure call `sortModule.validate(payload, { assign }, spec.success)` for `wrongIds` (partial boards → empty wrongIds). Always `buildOutcome` + `onOutcome`.
- Hints: `HINT_AFTER_ATTEMPTS = 2`, same cycling as `useActivityState`.

- [ ] **Step 1: Implement the bridge**

```tsx
// components/studylab/material/MaterialActivity.tsx
'use client'
import { useCallback, useContext, useRef, useState } from 'react'
import type { ActivitySpec, ActivityState } from '@/lib/studylab/activities/types'
import { sortModule, type SortWork } from '@/lib/studylab/activities/patterns/sort'
import { buildOutcome } from '@/lib/studylab/activities/telemetry'
import { createInitialMaterialState } from '@/lib/studylab/material/initialState'
import { tick } from '@/lib/studylab/material/interpreter'
import type { MaterialSpec, MaterialState } from '@/lib/studylab/material/types'
import {
  assignToPlacement,
  binIdFromSlot,
  placementToAssign,
} from '@/lib/studylab/material/sortPlacement'
import { CanvasContext } from '@/components/studylab/canvasShared'
import { MaterialRenderer } from './MaterialRenderer'

const HINT_AFTER_ATTEMPTS = 2

function seedMaterialState(materialSpec: MaterialSpec, initial?: ActivityState): MaterialState {
  const base = createInitialMaterialState(materialSpec)
  const assign = (initial?.work as SortWork | undefined)?.assign ?? {}
  const hasAssign = Object.keys(assign).length > 0
  return {
    ...base,
    placement: hasAssign ? assignToPlacement(assign) : base.placement,
    status: initial?.status === 'solved'
      ? 'solved'
      : hasAssign
        ? 'in_progress'
        : base.status,
    rejectedMoves: [], // material-shaped; activity rejects live in ActivityState
  }
}

export function MaterialActivity({
  id,
  spec,
  materialSpec,
  onOutcome,
  initialState,
}: {
  id: string
  spec: ActivitySpec
  materialSpec: MaterialSpec
  onOutcome: (o: unknown) => void
  initialState?: ActivityState
}) {
  const { onNodeDataChange } = useContext(CanvasContext)
  const startedAt = useRef(Date.now())

  const [activity, setActivity] = useState<ActivityState>(() => {
    if (initialState && initialState.work && Object.keys(initialState.work).length > 0) {
      return initialState
    }
    return {
      status: initialState?.status ?? 'untouched',
      attempts: initialState?.attempts ?? 0,
      hintsUsed: initialState?.hintsUsed ?? 0,
      elapsedMs: initialState?.elapsedMs ?? 0,
      rejectedMoves: initialState?.rejectedMoves ?? [],
      work: { assign: {} },
    }
  })
  const [materialState, setMaterialState] = useState<MaterialState>(() =>
    seedMaterialState(materialSpec, activity),
  )
  const [wrongIds, setWrongIds] = useState<string[]>([])
  const [revealed, setRevealed] = useState(activity.status === 'solved')

  const persistActivity = useCallback((next: ActivityState) => {
    setActivity(next)
    onNodeDataChange?.(id, { activityState: next })
  }, [id, onNodeDataChange])

  const handleStateChange = useCallback((next: MaterialState) => {
    setMaterialState(next)
    const assign = placementToAssign(next.placement)
    persistActivity({
      ...activity,
      work: { assign },
      status: activity.status === 'solved' ? 'solved' : 'in_progress',
    })
  }, [activity, persistActivity])

  const handleRefusal = useCallback((pieceId: string, slotId: string) => {
    const targetId = binIdFromSlot(slotId) ?? slotId
    persistActivity({
      ...activity,
      status: activity.status === 'solved' ? 'solved' : 'in_progress',
      rejectedMoves: [...(activity.rejectedMoves ?? []), { itemId: pieceId, targetId }],
    })
  }, [activity, persistActivity])

  const check = useCallback(() => {
    const tickResult = tick(materialSpec, materialState)
    const assign = placementToAssign(materialState.placement)
    const work: SortWork = { assign }
    const attempts = activity.attempts + 1
    const validate = tickResult.solved
      ? { ok: true as const, wrongIds: [] as string[] }
      : sortModule.validate(spec.payload as never, work, spec.success)
    const next: ActivityState = {
      ...activity,
      attempts,
      work: { assign },
      status: validate.ok ? 'solved' : 'in_progress',
      elapsedMs: Date.now() - startedAt.current,
    }
    persistActivity(next)
    setWrongIds(validate.wrongIds)
    if (validate.ok) {
      setRevealed(true)
      setMaterialState({ ...materialState, status: 'solved' })
    }
    onOutcome(buildOutcome(id, spec.pattern, next, validate))
  }, [activity, id, materialSpec, materialState, onOutcome, persistActivity, spec])

  const hintAvailable =
    (spec.hints?.length ?? 0) > 0 && activity.attempts >= HINT_AFTER_ATTEMPTS
  const hint = hintAvailable
    ? spec.hints![Math.min(activity.hintsUsed, spec.hints!.length - 1)]
    : null

  return (
    <MaterialRenderer
      spec={materialSpec}
      state={materialState}
      onStateChange={handleStateChange}
      onRefusal={handleRefusal}
      solved={activity.status === 'solved'}
      revealed={revealed}
      reveal={spec.reveal}
      hint={hint}
      hintAvailable={hintAvailable}
      onHint={() => persistActivity({ ...activity, hintsUsed: activity.hintsUsed + 1 })}
      onCheck={activity.status === 'solved' ? undefined : check}
      wrongIds={wrongIds}
    />
  )
}
```

**Stale-closure note:** if `persistActivity` / `handleStateChange` race on rapid drops, mirror `useActivityState`’s pattern (close over latest `activity`) — acceptable for this cut; do not invent a reducer unless tests force it.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/studylab/material/MaterialActivity.tsx
git commit -m "feat(studylab): MaterialActivity bridges sort work to MaterialRenderer

Hydrates and persists assign, maps refusals to bin ids, and keeps Check/hints/outcomes."
```

---

### Task 4: Wire `ActivityNode`

**Files:**
- Modify: `components/studylab/activities/ActivityNode.tsx`

**Interfaces:**
- Consumes: `getApparatus('sorting-frame')!.legacy!.fromLegacy(payload, success)`.
- Produces: `sort` case mounts `MaterialActivity` when conversion succeeds, else `SortActivity`.

- [ ] **Step 1: Update the `sort` case**

```tsx
import { getApparatus } from '@/lib/studylab/material/canon'
import { MaterialActivity } from '@/components/studylab/material/MaterialActivity'

// inside switch:
case 'sort': {
  const material = getApparatus('sorting-frame')?.legacy?.fromLegacy(
    spec.payload,
    spec.success,
  )
  if (material) {
    return (
      <MaterialActivity
        id={id}
        spec={spec}
        materialSpec={material}
        onOutcome={emitActivityOutcome}
        initialState={initialState}
      />
    )
  }
  return (
    <SortActivity
      id={id}
      spec={spec}
      onOutcome={emitActivityOutcome}
      initialState={initialState}
    />
  )
}
```

- [ ] **Step 2: Full gate**

Run: `npx tsc --noEmit && npx vitest run`
Expected: both PASS. Record file/test counts in the commit message body if convenient.

- [ ] **Step 3: Commit**

```bash
git add components/studylab/activities/ActivityNode.tsx
git commit -m "feat(studylab): live sort activities prefer sorting-frame renderer

Fall back to SortActivity when fromLegacy returns null so bad payloads never blank the card."
```

---

### Task 5: Browser verification + handover

**Files:**
- Modify: `docs/HANDOVER.md` (Stage 3b status, test counts, next cutovers)

**Interfaces:** none — verification only.

- [ ] **Step 1: Dev bench regression**

Open `/dev/activities`, pick a sorting-frame / legacy-sort fixture:

1. Drag a matching piece into a slot — stays.
2. Drag a mismatch — shakes, springs back.
3. Uncontrolled bench still auto-reflects `tick().solved` in the frame (no Check required on bench).

- [ ] **Step 2: Live LearnSpace / canvas path**

Mount a real `sort` activity (existing lesson or fixture that uses `ActivityNode`):

1. Pieces render via material chips / slots (not the old dashed-bin layout).
2. Wrong drop refuses and records (tutor outcome later shows rejected ids if you Check after).
3. Correct full assignment → **Check** → solved + reveal path.
4. Remount / reload: `activityState.work.assign` restores placement.
5. Force a payload that fails `fromLegacy` (optional): confirm `SortActivity` still appears — or unit-level certainty from existing canon null tests plus the null branch in `ActivityNode`.

- [ ] **Step 3: Update `docs/HANDOVER.md`**

- Branch ahead-count / test counts after the final gate.
- Mark Stage 3b sort cutover done; list remaining eight pattern cutovers + Stage 4.
- Note `SortActivity` retained as fallback.

- [ ] **Step 4: Final gate + commit**

Run: `npx tsc --noEmit && npx vitest run`

```bash
git add docs/HANDOVER.md
git commit -m "docs(studylab): record Stage 3b sort live cutover

sorting-frame owns the live sort path; SortActivity remains fallback."
```

**Do not push.**

---

## Spec coverage (self-review)

| Spec requirement | Task |
|---|---|
| `fromLegacy(payload, success)` then MaterialActivity or SortActivity | 4 |
| One ownership site for conversion | 4 (ActivityNode only) |
| `assign` ↔ `s-${binId}` placement | 1, 3 |
| Ignore non-`s-*` placement when persisting | 1 |
| Persist activityState via CanvasContext | 3 |
| Reject → itemId + bin targetId | 3 (`onRefusal`) |
| Check via tick + sortModule.validate wrongIds | 3 |
| Hints after 2 attempts | 3 |
| Controlled MaterialRenderer; bench unchanged when props omitted | 2 |
| Do not delete SortActivity | 4 (keeps import + fallback) |
| No `.test.tsx`; pure helper tests | 1 |
| Browser mouse path | 5 |
| No push | Global + Task 5 |

## Placeholder / consistency check

- API locked: controlled `state` + `onStateChange` (not initial-only).
- Helper names consistent: `assignToPlacement` / `placementToAssign` / `binIdFromSlot` / `slotIdForBin`.
- No TBD / “add tests later” steps remain.
