# Material Renderer (Dev Bench) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Draw and work a `MaterialSpec` on `/dev/activities` — one vocabulary renderer, full drag/control/`tick` interaction, with `MATERIAL_BOX.heightPx` enforced as real CSS — without touching LearnSpace or deleting the nine pattern UIs.

**Architecture:** Pure layout metrics stay in `lib/studylab/material/fit.ts` (exported on `MATERIAL_BOX`). Client components under `components/studylab/material/` render groups/slots/pieces/controls/displays and call `allowsMove` / `applyMove` / `tick`. The dev page registers a React Flow node type local to that page only and mounts every canon `base` (plus two `fromLegacy` samples).

**Tech Stack:** TypeScript strict, React client components, existing `useActivityDrag` / `ActivityFrame` / `assetUrl`, vitest node-only, no new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-10-material-renderer-dev-bench-design.md`

## Global Constraints

- **Dev bench only** — no `ActivityNode` / LearnSpace / tutor `build_material` wiring.
- **Do not delete or alter** the nine files under `components/studylab/activities/*Activity.tsx` except shared helpers already used (`useActivityDrag`, `ActivityFrame`). Prefer not changing `ActivityFrame` layout for live cards; put the height cap on an inner `MaterialFrame` shell.
- **Never create `.test.tsx`.** Renderer verification is a browser mouse-path checklist on `/dev/activities`.
- Unit tests only for pure `.ts` helpers (node environment).
- Art via `assetUrl()` catalogue names only; never model SVG; never raw URLs.
- `ss-*` colours inline (`style` / SVG `fill`) — no Tailwind alpha on those tokens.
- Drag via `useActivityDrag` (uses `fixedContainingBlock`) — never assume `position: fixed` is the viewport inside React Flow.
- Drop targets are **slot ids** (`data-drop-target={slot.id}`), matching `applyMove`.
- Registry lookups stay `Map`-based; do not add object-literal registries.
- `npx tsc --noEmit && npx vitest run` green at the end of every task.
- **Local commits only. NEVER push** (`aws_deploy` deploys).
- Work in the main repo at `c:\Users\Stephen\AI_assessment` — not a worktree.
- Baseline entering this plan: **119 test files / 1557 tests**, tsc clean (confirm with a quick run if the tree has drifted).

## File Structure

| Path | Responsibility |
|---|---|
| `lib/studylab/material/fit.ts` | Extend `MATERIAL_BOX` with slot/gap/chrome px used by the renderer; update height comments now that the cap will be real |
| `lib/studylab/material/initialState.ts` | `createInitialMaterialState(spec)` |
| `lib/studylab/material/initialState.test.ts` | Pins empty placement, control mins, untouched status |
| `components/studylab/material/PieceChip.tsx` | One piece chip (label / catalogue art) |
| `components/studylab/material/SlotTarget.tsx` | One slot drop target |
| `components/studylab/material/DisplayView.tsx` | beam / bar / tank / plot / gauge from a bound number |
| `components/studylab/material/ControlView.tsx` | One range control |
| `components/studylab/material/MaterialFrame.tsx` | Box-capped shell + group grid + pool strip |
| `components/studylab/material/MaterialRenderer.tsx` | Spec + state wiring to interpreter + drag |
| `components/studylab/material/MaterialBenchNode.tsx` | React Flow node wrapper for the bench only |
| `app/dev/activities/page.tsx` | Picker + material nodes beside existing legacy fixtures |

---

### Task 1: Export layout metrics; tell the truth about height

**Files:**
- Modify: `lib/studylab/material/fit.ts`
- Modify: `lib/studylab/material/fit.test.ts` (assert new exported fields)

**Interfaces:**
- Consumes: existing private layout constants in `fit.ts`.
- Produces: `MATERIAL_BOX` also carries `slotPx`, `slotGapPx`, `gridGapPx`, `groupChromePx`, `groupLabelPx` (numbers already used to derive caps). Height comment states the renderer **must** enforce `heightPx` as CSS `max-height`.

- [ ] **Step 1: Write the failing assertion**

Add to the existing `MATERIAL_BOX` describe in `fit.test.ts`:

```ts
  it('exposes the chip and gap sizes the renderer must share', () => {
    expect(MATERIAL_BOX.slotPx).toBeGreaterThan(0)
    expect(MATERIAL_BOX.slotGapPx).toBeGreaterThan(0)
    expect(MATERIAL_BOX.gridGapPx).toBeGreaterThan(0)
    expect(MATERIAL_BOX.groupChromePx).toBeGreaterThan(0)
    expect(MATERIAL_BOX.groupLabelPx).toBeGreaterThan(0)
  })
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/studylab/material/fit`
Expected: FAIL — property does not exist on `MATERIAL_BOX`.

- [ ] **Step 3: Extend `MATERIAL_BOX` and fix comments**

Add the five fields to the frozen object (same values as the private constants). Rewrite the `heightPx` / `maxRows` comments: the height is a **rendered** `max-height` the Stage 3 material shell must set — no longer “decorative until Stage 3”.

- [ ] **Step 4: Run tests**

Run: `npx vitest run lib/studylab/material/fit`
Expected: PASS.

- [ ] **Step 5: Full gate**

Run: `npx tsc --noEmit && npx vitest run`
Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/studylab/material/fit.ts lib/studylab/material/fit.test.ts
git commit -m "feat(studylab): export MATERIAL_BOX chip metrics for the renderer

One source for slot size and gaps, and the height budget is no longer
documented as decorative — the material shell will enforce it as max-height.
"
```

---

### Task 2: Initial material state

**Files:**
- Create: `lib/studylab/material/initialState.ts`
- Test: `lib/studylab/material/initialState.test.ts`

**Interfaces:**
- Consumes: `MaterialSpec`, `MaterialState` from `./types`.
- Produces: `createInitialMaterialState(spec: MaterialSpec): MaterialState`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/studylab/material/initialState.test.ts
import { describe, it, expect } from 'vitest'
import { createInitialMaterialState } from './initialState'
import type { MaterialSpec } from './types'

const spec = {
  prompt: 'p',
  pieces: [{ id: 'a', label: 'A', traits: { n: 1 } }],
  groups: [{ id: 'g', label: 'G', ordered: false }],
  slots: [{ id: 's-g', groupId: 'g', x: 0, y: 0, capacity: 1 }],
  controls: [{ id: 'drops', label: 'Drops', min: 2, max: 10, step: 1 }],
  rules: [],
  goal: { kind: 'exactSet' as const, itemIds: ['a'] },
} as MaterialSpec

describe('createInitialMaterialState', () => {
  it('starts with nothing placed and controls at their minimum', () => {
    const s = createInitialMaterialState(spec)
    expect(s.placement).toEqual({})
    expect(s.controls).toEqual({ drops: 2 })
    expect(s.attempts).toBe(0)
    expect(s.rejectedMoves).toEqual([])
    expect(s.status).toBe('untouched')
  })

  it('omits controls when the spec has none', () => {
    const bare = { ...spec, controls: undefined }
    expect(createInitialMaterialState(bare as MaterialSpec).controls).toEqual({})
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/studylab/material/initialState`
Expected: FAIL with `Failed to resolve import "./initialState"`.

- [ ] **Step 3: Implement**

```ts
// lib/studylab/material/initialState.ts
import type { MaterialSpec, MaterialState } from './types'

/** Fresh student state for a material — nothing placed, every control at min. */
export function createInitialMaterialState(spec: MaterialSpec): MaterialState {
  const controls: Record<string, number> = {}
  for (const c of spec.controls ?? []) controls[c.id] = c.min
  return {
    placement: {},
    controls,
    attempts: 0,
    rejectedMoves: [],
    status: 'untouched',
  }
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run lib/studylab/material/initialState`
Expected: PASS.

- [ ] **Step 5: Full gate + commit**

Run: `npx tsc --noEmit && npx vitest run`

```bash
git add lib/studylab/material/initialState.ts lib/studylab/material/initialState.test.ts
git commit -m "feat(studylab): initial MaterialState for a composed material

Empty board, controls at min, untouched — the same starting point the
renderer and the solvability prover both assume.
"
```

---

### Task 3: Presentational chips, slots, controls, displays

**Files:**
- Create: `components/studylab/material/PieceChip.tsx`
- Create: `components/studylab/material/SlotTarget.tsx`
- Create: `components/studylab/material/ControlView.tsx`
- Create: `components/studylab/material/DisplayView.tsx`

**Interfaces:**
- Consumes: `Piece`, `Slot`, `Control`, `Display` types; `MATERIAL_BOX.slotPx`; `assetUrl`; drag prop bag from `useActivityDrag`'s `itemProps` return.
- Produces: four presentational client components (no interpreter calls).

No `.test.tsx`. Gate is `tsc --noEmit`.

- [ ] **Step 1: `PieceChip.tsx`**

```tsx
'use client'
import { assetUrl } from '@/lib/studylab/activities/assetCatalog'
import type { Piece } from '@/lib/studylab/material/types'
import { MATERIAL_BOX } from '@/lib/studylab/material/fit'

export function PieceChip({
  piece,
  dragging,
  dragProps,
}: {
  piece: Piece
  dragging?: boolean
  /** Spread from useActivityDrag(...).itemProps(piece.id, ...). */
  dragProps?: Record<string, unknown>
}) {
  const src = piece.art ? assetUrl(piece.art) : null
  const size = MATERIAL_BOX.slotPx
  return (
    <span
      data-item={piece.id}
      {...dragProps}
      className={`nodrag flex cursor-grab items-center justify-center gap-1 active:cursor-grabbing touch-none rounded-lg border border-ss-line px-1.5 text-[11px] font-semibold text-ss-ink shadow-sm ${dragging ? 'opacity-50' : ''}`}
      style={{
        minWidth: size,
        minHeight: size,
        backgroundColor: 'var(--ss-panel)',
      }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={piece.label} width={22} height={22} style={{ width: 22, height: 22 }} className="object-contain" />
      ) : null}
      <span>{piece.label}</span>
    </span>
  )
}
```

- [ ] **Step 2: `SlotTarget.tsx`**

```tsx
'use client'
import type { ReactNode } from 'react'
import type { Slot } from '@/lib/studylab/material/types'
import { MATERIAL_BOX } from '@/lib/studylab/material/fit'

export function SlotTarget({
  slot,
  hot,
  children,
}: {
  slot: Slot
  hot?: boolean
  children?: ReactNode
}) {
  const size = MATERIAL_BOX.slotPx
  return (
    <div
      data-drop-target={slot.id}
      className="flex flex-wrap content-start items-start rounded-md border border-dashed"
      style={{
        minWidth: size,
        minHeight: size,
        gap: MATERIAL_BOX.slotGapPx,
        borderColor: hot ? 'var(--ss-accent)' : 'var(--ss-line)',
        backgroundColor: hot ? 'var(--ss-canvas)' : 'transparent',
      }}
    >
      {children}
    </div>
  )
}
```

- [ ] **Step 3: `ControlView.tsx`**

```tsx
'use client'
import type { Control } from '@/lib/studylab/material/types'

export function ControlView({
  control,
  value,
  onChange,
}: {
  control: Control
  value: number
  onChange: (next: number) => void
}) {
  return (
    <label className="nodrag flex flex-col gap-1 text-[11px] font-semibold text-ss-ink">
      <span>
        {control.label}
        {control.unit ? ` (${control.unit})` : ''}: {value}
      </span>
      <input
        type="range"
        className="nodrag"
        min={control.min}
        max={control.max}
        step={control.step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  )
}
```

- [ ] **Step 4: `DisplayView.tsx`**

Show the bound numeric value for every kind. `beam` uses a tilted bar (CSS rotate from clamped value). `bar` / `tank` / `gauge` fill a proportion of min..max when those exist on the display; otherwise show the number. `plot` shows the number in a small labelled box (numeric binding visible — not a frozen fake).

```tsx
'use client'
import type { Display } from '@/lib/studylab/material/types'

export function DisplayView({ display, value }: { display: Display; value: number | undefined }) {
  const v = value ?? 0
  const lo = display.min ?? -10
  const hi = display.max ?? 10
  const span = hi - lo || 1
  const t = Math.max(0, Math.min(1, (v - lo) / span))

  if (display.kind === 'beam') {
    const deg = (t - 0.5) * 40
    return (
      <div className="flex flex-col items-center gap-1">
        <div
          className="h-1.5 w-28 origin-center rounded-full"
          style={{ backgroundColor: 'var(--ss-ink)', transform: `rotate(${deg}deg)` }}
        />
        <span className="text-[10px] font-semibold text-ss-slate">{v}</span>
      </div>
    )
  }

  if (display.kind === 'bar' || display.kind === 'tank' || display.kind === 'gauge') {
    return (
      <div className="flex flex-col gap-0.5">
        <div className="h-16 w-8 overflow-hidden rounded border border-ss-line" style={{ backgroundColor: 'var(--ss-canvas)' }}>
          <div
            className="w-full"
            style={{
              height: `${Math.round(t * 100)}%`,
              marginTop: `${Math.round((1 - t) * 100)}%`,
              backgroundColor: 'var(--ss-accent)',
            }}
          />
        </div>
        <span className="text-[10px] font-semibold text-ss-slate">{v}</span>
      </div>
    )
  }

  // plot — numeric binding visible
  return (
    <div className="rounded border border-ss-line px-2 py-1 text-[11px] font-semibold text-ss-ink" style={{ backgroundColor: 'var(--ss-panel)' }}>
      {display.id}: {v}
    </div>
  )
}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/studylab/material/PieceChip.tsx components/studylab/material/SlotTarget.tsx components/studylab/material/ControlView.tsx components/studylab/material/DisplayView.tsx
git commit -m "feat(studylab): presentational chips, slots, controls and displays

Vocabulary nouns as UI, sized from MATERIAL_BOX, coloured with inline
ss-* tokens so Tailwind alpha cannot silently drop the rule.
"
```

---

### Task 4: MaterialFrame — the real box

**Files:**
- Create: `components/studylab/material/MaterialFrame.tsx`

**Interfaces:**
- Consumes: `MaterialSpec`, `MATERIAL_BOX`, children render props for pool / groups / displays / controls / says.
- Produces: a shell with `maxWidth: MATERIAL_BOX.widthPx`, `maxHeight: MATERIAL_BOX.heightPx`, `overflow: 'hidden'`, and per-group zones with `overflowY: 'auto'` + `nowheel`.

- [ ] **Step 1: Implement `MaterialFrame`**

Structure:

1. Outer shell capped to `MATERIAL_BOX.widthPx` × `MATERIAL_BOX.heightPx`.
2. Optional displays row.
3. Flex row of group columns (`gap: MATERIAL_BOX.gridGapPx`), each:
   - label
   - scrollable slot area (`nowheel`, max height ≈ `slotPx * maxRows` + gaps so a tall group scrolls instead of growing the card)
4. Pool strip for unplaced pieces (caller passes as `pool` child).
5. Controls row.
6. `says` list (strings from `tick`).

Use flex/`min-h-0` so scroll regions shrink inside the capped shell. Do **not** change `ActivityFrame`'s outer `w-[420px]` behaviour for other activities.

```tsx
'use client'
import type { ReactNode } from 'react'
import type { Group, MaterialSpec } from '@/lib/studylab/material/types'
import { MATERIAL_BOX } from '@/lib/studylab/material/fit'

export function MaterialFrame({
  spec,
  displays,
  groups,
  pool,
  controls,
  says,
}: {
  spec: MaterialSpec
  displays?: ReactNode
  /** Render prop: one group zone's slot grid. */
  groups: (group: Group) => ReactNode
  pool?: ReactNode
  controls?: ReactNode
  says?: string[]
}) {
  const zoneMax = MATERIAL_BOX.slotPx * MATERIAL_BOX.maxRows
    + MATERIAL_BOX.slotGapPx * Math.max(0, MATERIAL_BOX.maxRows - 1)

  return (
    <div
      className="flex flex-col gap-2"
      style={{
        width: MATERIAL_BOX.widthPx,
        maxWidth: MATERIAL_BOX.widthPx,
        maxHeight: MATERIAL_BOX.heightPx,
        overflow: 'hidden',
      }}
    >
      {displays}
      <div className="flex min-h-0 flex-1" style={{ gap: MATERIAL_BOX.gridGapPx }}>
        {spec.groups.map((g) => (
          <div
            key={g.id}
            className="min-w-0 flex-1 rounded-lg border-2 p-2"
            style={{ borderColor: 'var(--ss-line)', backgroundColor: 'var(--ss-canvas)' }}
          >
            <div className="mb-1.5 text-[12px] font-bold text-ss-ink">{g.label}</div>
            <div
              className="nowheel min-h-0 overflow-y-auto"
              style={{ maxHeight: zoneMax }}
            >
              {groups(g)}
            </div>
          </div>
        ))}
      </div>
      {pool}
      {controls}
      {says && says.length > 0 ? (
        <ul className="space-y-0.5 text-[11px] font-medium text-ss-slate">
          {says.map((s, i) => (
            <li key={`${i}-${s}`}>{s}</li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit`

```bash
git add components/studylab/material/MaterialFrame.tsx
git commit -m "feat(studylab): MaterialFrame enforces MATERIAL_BOX as real CSS

max-height on the shell and scrollable group zones — fitsInBox's height
half stops being decorative the moment something draws into this box.
"
```

---

### Task 5: MaterialRenderer — wire the interpreter

**Files:**
- Create: `components/studylab/material/MaterialRenderer.tsx`

**Interfaces:**
- Consumes: `MaterialSpec`; `createInitialMaterialState`; `applyMove`, `tick`; `useActivityDrag`; `shakeElement`; presentational components + `MaterialFrame`; wrap in `ActivityFrame` for prompt / solved chrome.
- Produces: `<MaterialRenderer spec={...} resetKey={...} />`.

- [ ] **Step 1: Implement**

Read `ActivityFrame` props and match SortActivity's call pattern. Core behaviour:

- State from `createInitialMaterialState(spec)`; reset when `resetKey` / spec identity changes.
- `tick(spec, state)` after every render for displays / says / solved.
- `useActivityDrag` → `applyMove`; on refused place, `shakeElement` on `[data-item=…]`.
- Unplaced pieces in pool; placed pieces inside `SlotTarget`s keyed by slot id.
- Controls update `state.controls` then re-tick; set `status` to `solved` / `in_progress` from `tick().solved`.

`data-drop-target={slot.id}` on every slot. Pass all slot ids into `itemProps` as legal target list (hover highlighting); legality still comes from `applyMove`.

Do not special-case `pairing`.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Full suite + commit**

Run: `npx tsc --noEmit && npx vitest run`

```bash
git add components/studylab/material/MaterialRenderer.tsx
git commit -m "feat(studylab): MaterialRenderer works a MaterialSpec by hand

Drag through applyMove, controls through tick, displays from bound
values — the engine stops being lib-only the moment this mounts.
"
```

---

### Task 6: Bench node + `/dev/activities` integration

**Files:**
- Create: `components/studylab/material/MaterialBenchNode.tsx`
- Modify: `app/dev/activities/page.tsx`

**Interfaces:**
- Consumes: `MaterialRenderer`; `getApparatus`, `apparatusNames`; React Flow `NodeProps`.
- Produces: node type registered **only** on the dev page. Do **not** add a `BlockType` or production `studyNodeTypes` entry.

- [ ] **Step 1: `MaterialBenchNode.tsx`**

```tsx
'use client'
import type { NodeProps } from '@xyflow/react'
import type { MaterialSpec } from '@/lib/studylab/material/types'
import { MaterialRenderer } from './MaterialRenderer'

export type MaterialBenchData = {
  spec: MaterialSpec
  resetKey: string
  label: string
}

export function MaterialBenchNode({ data }: NodeProps) {
  const d = data as unknown as MaterialBenchData
  return (
    <div className="sl-node-enter">
      <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-ss-slate">{d.label}</div>
      <MaterialRenderer spec={d.spec} resetKey={d.resetKey} />
    </div>
  )
}
```

- [ ] **Step 2: Extend the dev page**

Keep existing legacy fixtures. Add:

1. Absolute toolbar overlay: `<select>` of `apparatusNames()`; swaps node `n-material` data to `getApparatus(name)!.base` with a fresh `resetKey`.
2. Initial material node (e.g. y: 420) for `sorting-frame`.
3. Two `fromLegacy` samples (sorting-frame acid/base; balance-beam tiny weights) selectable from the toolbar.
4. `nodeTypes = { ...studyNodeTypes, material: MaterialBenchNode }`.
5. Controlled nodes so the picker can update `data.spec` / `data.resetKey`.

Preserve `notFound()` in production. Do not modify `ActivityNode.tsx` or pattern modules.

- [ ] **Step 3: Typecheck + suite**

Run: `npx tsc --noEmit && npx vitest run`  
Confirm no changes under `lib/studylab/activities/patterns/` or `ActivityNode.tsx`.

- [ ] **Step 4: Commit**

```bash
git add components/studylab/material/MaterialBenchNode.tsx app/dev/activities/page.tsx
git commit -m "feat(studylab): composed materials on the /dev/activities bench

Canon bases and two fromLegacy samples, inside React Flow so mouse drag
hits the same fixed-containing-block path as the legacy fixtures.
"
```

---

### Task 7: Browser verification (gate to claim done)

**Files:** none required.

- [ ] **Step 1: Run the app**

Run: `npx next dev`  
Open: http://localhost:3000/dev/activities

- [ ] **Step 2: Mouse-path checklist** (keyboard-only is not sufficient)

For at least `sorting-frame`, `balance-beam`, and `variable-model`:

1. Drag ghost stays ~5px from the cursor after pan/zoom.
2. Illegal drop springs back; legal drop stays.
3. On `variable-model`, moving the slider updates the bound display in the same gesture cycle.
4. Material content shell does not grow past `MATERIAL_BOX.heightPx`.
5. Switching apparatus in the picker resets placement and controls.

- [ ] **Step 3: If any fail, fix in a follow-up commit** named for the fault.

- [ ] **Step 4: Final gate**

Run: `npx tsc --noEmit && npx vitest run`  
Expected: PASS. Still never push.

---

## What this leaves for the next plan

- Stage 3b — swap `ActivityNode` pattern components for `MaterialRenderer` one apparatus at a time; delete each old renderer when its canon entry owns the live path.
- Stage 4 — `build_material` on the action union; advertise vocabulary from `MATERIAL_BOX` + canon; list the action in `systemPrompt(mode)`.
- Optional: richer `plot` display; balance pan layout chrome (2-item cap debt).
