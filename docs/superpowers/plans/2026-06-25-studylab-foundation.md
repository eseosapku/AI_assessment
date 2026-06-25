# StudyLab Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the foundation for the StudyLab tutor expansion — add a test harness, fix the node-placement-behind-neighbor bug with clean entrance animation, remove the unused tldraw sketch layer, and introduce the block registry that enforces the AI-vs-freeform boundary.

**Architecture:** Keep the existing pure-reducer pattern (`applyActions`) and React Flow canvas. Add Vitest for unit-testing pure logic. Introduce `lib/studylab/blocks.ts` as a pure metadata registry (no React) that the reducer, tutor route, and renderers all read from. Renderers stay in `canvasNodes.tsx` keyed by the registry's block types.

**Tech Stack:** Next.js 16, React 18, TypeScript (strict), `@xyflow/react` v12, Vitest (new), Tailwind.

## Global Constraints

- Path alias: `@/*` maps to the repo root (`./*`). Use `@/lib/...`, `@/components/...`.
- TypeScript `strict` is on. No `any` in new pure-logic modules unless mirroring an existing cast.
- Pure-logic modules (`lib/studylab/blocks.ts`, `lib/studylab/actions.ts`) must **not** import React or any browser/canvas code, so they stay unit-testable in a Node environment.
- Persisted `learnspaces.canvas_state` rows must keep loading. All data-shape changes are additive/optional; removing `CanvasState.sketch` must be tolerated on load (ignored, not errored).
- Commit after each task. Commit messages: imperative mood, end with the Co-Authored-By trailer below.

```
Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

- This plan covers **Phases 1–2** of `docs/superpowers/specs/2026-06-25-studylab-tutor-expansion-design.md`. Phases 3–6 (code runner, freeform palette, checkpoints, tutor upgrades) are separate plans written after this foundation lands.

---

### Task 1: Add Vitest test harness

**Files:**
- Modify: `package.json` (add devDependency + scripts)
- Create: `vitest.config.ts`
- Create: `lib/studylab/smoke.test.ts` (temporary sanity test, deleted at end of task)

**Interfaces:**
- Consumes: nothing.
- Produces: a working `npm test` command that runs `*.test.ts` files in a Node environment with the `@` alias resolved.

- [ ] **Step 1: Install Vitest**

Run:
```bash
npm install -D vitest@^2
```
Expected: `vitest` appears under `devDependencies` in `package.json`.

- [ ] **Step 2: Add test scripts to package.json**

In `package.json`, add to the `"scripts"` object:
```json
    "test": "vitest run",
    "test:watch": "vitest"
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
```
(Vitest already excludes `node_modules` and `.next` by default.)

- [ ] **Step 4: Write a smoke test**

Create `lib/studylab/smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest'

describe('vitest harness', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 5: Run the smoke test**

Run: `npm test`
Expected: PASS — 1 test passed.

- [ ] **Step 6: Delete the smoke test and commit**

```bash
rm lib/studylab/smoke.test.ts
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add vitest test harness"
```

---

### Task 2: Collision-aware node placement

The bug: `autoPosition` in `lib/studylab/actions.ts` positions cards by index (`col = count % 3`), so cards created across turns can resolve onto coordinates an existing card already occupies, making a new node render behind a neighbor. Replace it with a scan that returns the first grid slot in the step band whose rectangle does not overlap any existing visible node.

**Files:**
- Modify: `lib/studylab/actions.ts` (replace `autoPosition`, export it)
- Test: `lib/studylab/actions.placement.test.ts`

**Interfaces:**
- Consumes: `StudyNode` from `@/lib/studylab/types`.
- Produces: `export function autoPosition(nodes: StudyNode[], step: number): { x: number; y: number }` — returns the top-left of the first non-overlapping grid slot in `step`'s band. Slot grid: 3 columns; column pitch 356px, row pitch 280px; band base `y = step * 460`.

- [ ] **Step 1: Write the failing tests**

Create `lib/studylab/actions.placement.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { autoPosition } from '@/lib/studylab/actions'
import type { StudyNode } from '@/lib/studylab/types'

function card(id: string, x: number, y: number, step: number): StudyNode {
  return { id, type: 'concept', position: { x, y }, data: { kind: 'concept', step } }
}

describe('autoPosition', () => {
  it('places the first card at slot 0 of the step band', () => {
    expect(autoPosition([], 1)).toEqual({ x: 0, y: 460 })
  })

  it('places the second card in the next column, not on top of the first', () => {
    const nodes = [card('a', 0, 460, 1)]
    expect(autoPosition(nodes, 1)).toEqual({ x: 356, y: 460 })
  })

  it('wraps to the next row after three columns', () => {
    const nodes = [card('a', 0, 460, 1), card('b', 356, 460, 1), card('c', 712, 460, 1)]
    expect(autoPosition(nodes, 1)).toEqual({ x: 0, y: 740 })
  })

  it('skips a slot occupied by an off-grid (dragged) card', () => {
    // A card dragged to overlap slot 0 must not get a new card stacked on it.
    const nodes = [card('a', 10, 465, 1)]
    expect(autoPosition(nodes, 1)).toEqual({ x: 356, y: 460 })
  })

  it('ignores stepGroup and hidden nodes when checking occupancy', () => {
    const group: StudyNode = { id: 'g', type: 'stepGroup', position: { x: 0, y: 460 }, data: { kind: 'stepGroup' } }
    const hidden: StudyNode = { ...card('h', 0, 460, 1), hidden: true }
    expect(autoPosition([group, hidden], 1)).toEqual({ x: 0, y: 460 })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- actions.placement`
Expected: FAIL — `autoPosition` is not exported / current logic returns index-based coords (e.g. second card returns `{x:356,y:460}` may pass but the off-grid and hidden cases fail).

- [ ] **Step 3: Replace `autoPosition` with collision-aware logic**

In `lib/studylab/actions.ts`, replace the existing `autoPosition` function (lines ~20-28) with:
```ts
const CARD_W = 300
const CARD_H = 200
const SLOT_W = CARD_W + COL_GAP // 356
const SLOT_H = CARD_H + ROW_GAP // 280

function rectsOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number }
): boolean {
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y)
}

// Return the first 3-column grid slot in this step's band whose rectangle does
// not overlap any visible, non-group node anywhere on the canvas.
export function autoPosition(nodes: StudyNode[], step: number): { x: number; y: number } {
  const occupied = nodes
    .filter((n) => n.type !== 'stepGroup' && !n.hidden)
    .map((n) => ({ x: n.position.x, y: n.position.y, w: CARD_W, h: CARD_H }))
  const bandY = step * STEP_BAND
  for (let row = 0; row < 200; row++) {
    for (let col = 0; col < 3; col++) {
      const cand = { x: col * SLOT_W, y: bandY + row * SLOT_H, w: CARD_W, h: CARD_H }
      if (!occupied.some((o) => rectsOverlap(cand, o))) {
        return { x: cand.x, y: cand.y }
      }
    }
  }
  return { x: 0, y: bandY }
}
```
Keep the existing `CARD_W`/`CARD_H`/`COL_GAP`/`ROW_GAP`/`STEP_BAND` constants — remove the duplicate `CARD_W`/`CARD_H` declarations if they already exist at the top of the file so there is exactly one of each. (`COL_GAP = 56`, `ROW_GAP = 80`, `STEP_BAND = 460` are already defined.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- actions.placement`
Expected: PASS — all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/studylab/actions.ts lib/studylab/actions.placement.test.ts
git commit -m "fix(studylab): collision-aware card placement so new nodes never spawn behind neighbors"
```

---

### Task 3: Report newly-created node ids + a fit-to-new-nodes effect

So the canvas can animate freshly-created cards into frame, `applyActions` must report which node ids it created, and a new `fitNodes` effect must exist for the canvas to act on.

**Files:**
- Modify: `lib/studylab/actions.ts` (extend `CanvasEffect`, add `created` to `ApplyResult`)
- Test: `lib/studylab/actions.created.test.ts`

**Interfaces:**
- Consumes: `TutorAction`, `CanvasState` from `@/lib/studylab/types`.
- Produces:
  - `CanvasEffect` is now a union: `{ kind: 'zoom'; target: 'fit' | 'node' | 'reset'; nodeId?: string } | { kind: 'fitNodes'; nodeIds: string[] }`.
  - `ApplyResult` gains `created: string[]` — ids of nodes added this call (excludes duplicates that were skipped).

- [ ] **Step 1: Write the failing tests**

Create `lib/studylab/actions.created.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { applyActions } from '@/lib/studylab/actions'
import type { CanvasState } from '@/lib/studylab/types'

const empty: CanvasState = { nodes: [], edges: [] }

describe('applyActions created ids', () => {
  it('reports the id of a newly created card', () => {
    const res = applyActions(empty, [
      { type: 'createCard', id: 's1-a', card: 'concept', title: 'A', step: 1, position: 'auto' },
    ])
    expect(res.created).toEqual(['s1-a'])
  })

  it('does not report an id that already exists', () => {
    const state: CanvasState = {
      nodes: [{ id: 's1-a', type: 'concept', position: { x: 0, y: 0 }, data: { kind: 'concept', step: 1 } }],
      edges: [],
    }
    const res = applyActions(state, [
      { type: 'createCard', id: 's1-a', card: 'concept', title: 'dup', step: 1, position: 'auto' },
    ])
    expect(res.created).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- actions.created`
Expected: FAIL — `res.created` is `undefined`.

- [ ] **Step 3: Extend `CanvasEffect` and `ApplyResult`**

In `lib/studylab/actions.ts`:

Replace the `CanvasEffect` interface with a union:
```ts
export type CanvasEffect =
  | { kind: 'zoom'; target: 'fit' | 'node' | 'reset'; nodeId?: string }
  | { kind: 'fitNodes'; nodeIds: string[] }
```

Add `created` to `ApplyResult`:
```ts
export interface ApplyResult {
  nodes: StudyNode[]
  edges: StudyEdge[]
  effects: CanvasEffect[]
  created: string[]
}
```

In `applyActions`, declare `const created: string[] = []` near the top, push to it inside the `createCard` case right after `nodes.push(...)` succeeds (i.e. when the id was not a duplicate), and include `created` in the returned object.

Note: the existing `effects.push({ kind: 'zoom', target: ... })` calls already match the union's `zoom` member — no change needed there.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- actions.created`
Expected: PASS — both tests pass.

- [ ] **Step 5: Run the full suite + typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: all tests PASS; tsc reports no errors (the union change must not break existing `effects` usage).

- [ ] **Step 6: Commit**

```bash
git add lib/studylab/actions.ts lib/studylab/actions.created.test.ts
git commit -m "feat(studylab): report created node ids and add fitNodes effect"
```

---

### Task 4: Canvas entrance animation + measured-size centering + consume fitNodes

Make new cards fade/scale in on mount, center using the node's measured size (not the hardcoded `+150/+100`), and fit-to-the-new-cluster when a turn creates cards.

**Files:**
- Modify: `components/studylab/StudyCanvas.tsx` (effect runner: measured centering + `fitNodes`)
- Modify: `components/studylab/canvasNodes.tsx` (`CardFrame` enter animation class)
- Modify: `app/globals.css` (keyframes)
- Modify: `components/studylab/Workspace.tsx` (append a `fitNodes` effect for created ids)

**Interfaces:**
- Consumes: `ApplyResult.created` and the `fitNodes` `CanvasEffect` from Task 3.
- Produces: no new exports; behavior only.

- [ ] **Step 1: Add the enter keyframes to `app/globals.css`**

Append:
```css
@keyframes slNodeEnter {
  from { opacity: 0; transform: scale(0.96); }
  to   { opacity: 1; transform: scale(1); }
}
.sl-node-enter { animation: slNodeEnter 280ms ease-out; }
```

- [ ] **Step 2: Apply the enter animation in `CardFrame`**

In `components/studylab/canvasNodes.tsx`, add `sl-node-enter` to the `CardFrame` root `div`'s className (the `w-[300px] rounded-2xl ...` element). React Flow keeps nodes mounted across pans, so the animation only plays when a node is first created.

- [ ] **Step 3: Use measured size for `node` centering and handle `fitNodes`**

In `components/studylab/StudyCanvas.tsx`, inside the effect-runner `useEffect` loop, replace the `node` branch and add a `fitNodes` branch:
```ts
for (const effect of effects.list) {
  if (effect.kind === 'fitNodes') {
    rf.fitView({ duration: 700, padding: 0.3, nodes: effect.nodeIds.map((id) => ({ id })) })
  } else if (effect.target === 'fit') {
    rf.fitView({ duration: 700, padding: 0.25 })
  } else if (effect.target === 'reset') {
    rf.setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 500 })
  } else if (effect.target === 'node' && effect.nodeId) {
    const node = rf.getNode(effect.nodeId)
    if (node) {
      const w = node.measured?.width ?? 300
      const h = node.measured?.height ?? 200
      rf.setCenter(node.position.x + w / 2, node.position.y + h / 2, { zoom: 1.15, duration: 600 })
    }
  }
}
```

- [ ] **Step 4: Append a `fitNodes` effect for created cards in `Workspace.tsx`**

In `components/studylab/Workspace.tsx`, in `runTutor`, change the destructure and effect handling. Where it currently reads:
```ts
const { nodes, edges, effects: fx } = applyActions(baseCanvas, actions)
const nextCanvas: CanvasState = { ...baseCanvas, nodes, edges }
setCanvas(nextCanvas)
if (fx.length > 0) {
  effectVersion.current += 1
  setEffects({ version: effectVersion.current, list: fx })
}
```
replace with:
```ts
const { nodes, edges, effects: fx, created } = applyActions(baseCanvas, actions)
const nextCanvas: CanvasState = { ...baseCanvas, nodes, edges }
setCanvas(nextCanvas)
const list = created.length > 0 ? [...fx, { kind: 'fitNodes' as const, nodeIds: created }] : fx
if (list.length > 0) {
  effectVersion.current += 1
  setEffects({ version: effectVersion.current, list })
}
```

- [ ] **Step 5: Verify build, lint, and a manual run**

Run: `npx tsc --noEmit && npm run lint`
Expected: no type errors, no new lint errors.

Manual check (dev server): open a LearnSpace, send a turn that creates cards, and confirm new cards (a) never overlap an existing card and (b) fade/scale in while the canvas smoothly fits to the new cluster.
```bash
npm run dev
# visit http://localhost:3000/studylab, open or create a LearnSpace
```

- [ ] **Step 6: Commit**

```bash
git add components/studylab/StudyCanvas.tsx components/studylab/canvasNodes.tsx components/studylab/Workspace.tsx app/globals.css
git commit -m "feat(studylab): animate new cards in and fit canvas to the new cluster"
```

---

### Task 5: Remove the tldraw sketch layer

Delete the unused sketch overlay end-to-end and drop the dependency.

**Files:**
- Modify: `components/studylab/StudyCanvas.tsx` (remove `SketchOverlay`, `CanvasOpenSketchButton`, `sketchMode`, sketch props)
- Modify: `components/studylab/canvasNodes.tsx` (remove `SketchNode`, `onOpenSketch` from context, `sketch` node type)
- Modify: `components/studylab/Workspace.tsx` (remove `handleSketchSnapshot`, `sketch`/`onSketchSnapshot` props, `canvas.sketch` usage)
- Modify: `lib/studylab/types.ts` (remove `sketch?` from `CanvasState`)
- Modify: `package.json` (remove `tldraw` dependency)

**Interfaces:**
- Consumes: nothing new.
- Produces: `StudyCanvasProps` no longer has `sketch` or `onSketchSnapshot`. `CanvasState` no longer has `sketch`.

- [ ] **Step 1: Strip tldraw from `StudyCanvas.tsx`**

In `components/studylab/StudyCanvas.tsx`:
- Remove the imports: `import { Tldraw, getSnapshot, loadSnapshot, type Editor } from 'tldraw'`, `import 'tldraw/tldraw.css'`, and the now-unused `Pencil, Check` from `lucide-react`.
- Delete the `SketchOverlay` and `CanvasOpenSketchButton` components entirely.
- Remove `onOpenSketch` from `FlowInner`'s props and the `<CanvasOpenSketchButton ... />` usage.
- In the default `StudyCanvas` export: remove the `sketchMode` state, the `onOpenSketch` value from `CanvasContext.Provider`, and the `{sketchMode && <SketchOverlay .../>}` block. The provider value becomes `{{ onToggleGroup: props.onToggleGroup }}`.
- Update `StudyCanvasProps` to drop `sketch` and `onSketchSnapshot`.

- [ ] **Step 2: Strip the sketch node from `canvasNodes.tsx`**

In `components/studylab/canvasNodes.tsx`:
- Remove `Pencil` from the `lucide-react` import if otherwise unused.
- Delete the `SketchNode` function.
- Change `CanvasCallbacks` to `{ onToggleGroup: (groupId: string) => void }` and the `CanvasContext` default to `{ onToggleGroup: () => {} }`.
- Remove `sketch: SketchNode` from `studyNodeTypes`.

- [ ] **Step 3: Strip sketch from `Workspace.tsx`**

In `components/studylab/Workspace.tsx`:
- Delete the `handleSketchSnapshot` callback.
- Remove `sketch={canvas.sketch}` and `onSketchSnapshot={handleSketchSnapshot}` from the `<StudyCanvas .../>` usage.

- [ ] **Step 4: Remove `sketch` from the `CanvasState` type**

In `lib/studylab/types.ts`, delete the line:
```ts
  /** Serialised tldraw sketch document (snapshot). */
  sketch?: any
```
(Persisted rows that still contain `sketch` simply have an ignored extra field — no migration needed.)

- [ ] **Step 5: Remove the dependency**

Run:
```bash
npm uninstall tldraw
```
Expected: `tldraw` removed from `package.json` dependencies.

- [ ] **Step 6: Verify build + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no type errors, no references to `tldraw`, `SketchOverlay`, `SketchNode`, `onOpenSketch`, or `canvas.sketch` remain.

- [ ] **Step 7: Commit**

```bash
git add components/studylab/StudyCanvas.tsx components/studylab/canvasNodes.tsx components/studylab/Workspace.tsx lib/studylab/types.ts package.json package-lock.json
git commit -m "refactor(studylab): remove unused tldraw sketch layer"
```

---

### Task 6: Block registry (pure metadata + helpers)

Introduce `lib/studylab/blocks.ts` as the single source of truth for block types: which are AI-creatable vs freeform, their default sizes, and which appear in the freeform palette. Pure metadata only (no React) so the reducer and tutor route can import it and it stays unit-testable.

**Files:**
- Create: `lib/studylab/blocks.ts`
- Test: `lib/studylab/blocks.test.ts`

**Interfaces:**
- Consumes: nothing (self-contained types).
- Produces:
  - `type BlockSource = 'ai' | 'freeform'`
  - `type BlockType = 'concept' | 'code' | 'diagram' | 'mermaid' | 'worked' | 'table' | 'callout' | 'quiz' | 'checkpointHeader' | 'stepGroup' | 'image' | 'sticky' | 'note' | 'scratchpad' | 'photo' | 'flashcard' | 'frame' | 'checklist' | 'resources'`
  - `interface BlockDef { type: BlockType; source: BlockSource; defaultSize: { w: number; h: number }; palette?: { label: string; icon: string; group: 'practice' | 'notes' | 'organize' } }`
  - `const BLOCKS: Record<BlockType, BlockDef>`
  - `const CARD_KINDS: BlockType[]` — the subset creatable via the tutor's `createCard` action **and** that has a renderer today: `['concept', 'code', 'diagram']`. Later phases extend this as renderers land.
  - `function isCardKind(type: string): boolean`
  - `function isFreeform(type: string): boolean`
  - `function blockSize(type: string): { w: number; h: number }`
  - `function paletteItems(): BlockDef[]` — every block with a `palette` field.

- [ ] **Step 1: Write the failing tests**

Create `lib/studylab/blocks.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { BLOCKS, CARD_KINDS, isCardKind, isFreeform, blockSize, paletteItems } from '@/lib/studylab/blocks'

describe('block registry', () => {
  it('marks concept/code/diagram as AI card kinds', () => {
    expect(isCardKind('concept')).toBe(true)
    expect(isCardKind('code')).toBe(true)
    expect(isCardKind('diagram')).toBe(true)
  })

  it('does not treat freeform or non-card types as card kinds', () => {
    expect(isCardKind('sticky')).toBe(false)
    expect(isCardKind('quiz')).toBe(false)
    expect(isCardKind('stepGroup')).toBe(false)
    expect(isCardKind('nonsense')).toBe(false)
  })

  it('classifies freeform blocks', () => {
    expect(isFreeform('sticky')).toBe(true)
    expect(isFreeform('scratchpad')).toBe(true)
    expect(isFreeform('concept')).toBe(false)
  })

  it('every CARD_KIND exists in BLOCKS with source ai', () => {
    for (const t of CARD_KINDS) {
      expect(BLOCKS[t]).toBeDefined()
      expect(BLOCKS[t].source).toBe('ai')
    }
  })

  it('returns a default size for known and unknown types', () => {
    expect(blockSize('concept')).toEqual({ w: 300, h: 200 })
    expect(blockSize('nonsense')).toEqual({ w: 300, h: 200 })
  })

  it('palette items are exactly the freeform blocks with a palette entry', () => {
    const items = paletteItems()
    expect(items.length).toBeGreaterThan(0)
    for (const def of items) {
      expect(def.palette).toBeDefined()
      expect(def.source).toBe('freeform')
    }
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- blocks`
Expected: FAIL — module `@/lib/studylab/blocks` not found.

- [ ] **Step 3: Implement `lib/studylab/blocks.ts`**

```ts
// Single source of truth for StudyLab block types. Pure metadata only — no React,
// no canvas code — so the reducer and tutor route can import it and it stays
// unit-testable. Renderers live in components/studylab/canvasNodes.tsx, keyed by
// these BlockType values.

export type BlockSource = 'ai' | 'freeform'

export type BlockType =
  // AI-creatable / tutor-managed
  | 'concept' | 'code' | 'diagram' | 'mermaid' | 'worked' | 'table' | 'callout'
  | 'quiz' | 'checkpointHeader' | 'stepGroup' | 'image'
  // freeform student blocks (no AI context)
  | 'sticky' | 'note' | 'scratchpad' | 'photo' | 'flashcard' | 'frame'
  | 'checklist' | 'resources'

export type PaletteGroup = 'practice' | 'notes' | 'organize'

export interface BlockDef {
  type: BlockType
  source: BlockSource
  defaultSize: { w: number; h: number }
  palette?: { label: string; icon: string; group: PaletteGroup }
}

const def = (
  type: BlockType,
  source: BlockSource,
  w: number,
  h: number,
  palette?: BlockDef['palette']
): BlockDef => ({ type, source, defaultSize: { w, h }, palette })

export const BLOCKS: Record<BlockType, BlockDef> = {
  // AI / tutor blocks
  concept: def('concept', 'ai', 300, 200),
  code: def('code', 'ai', 320, 240),
  diagram: def('diagram', 'ai', 300, 220),
  mermaid: def('mermaid', 'ai', 340, 260),
  worked: def('worked', 'ai', 320, 260),
  table: def('table', 'ai', 360, 220),
  callout: def('callout', 'ai', 280, 140),
  quiz: def('quiz', 'ai', 320, 220),
  checkpointHeader: def('checkpointHeader', 'ai', 260, 110),
  stepGroup: def('stepGroup', 'ai', 260, 90),
  image: def('image', 'ai', 300, 240),
  // freeform palette blocks
  sticky: def('sticky', 'freeform', 200, 200, { label: 'Sticky note', icon: 'StickyNote', group: 'notes' }),
  note: def('note', 'freeform', 320, 220, { label: 'Note', icon: 'FileText', group: 'notes' }),
  scratchpad: def('scratchpad', 'freeform', 360, 300, { label: 'Code scratchpad', icon: 'Terminal', group: 'practice' }),
  photo: def('photo', 'freeform', 300, 240, { label: 'Image', icon: 'Image', group: 'notes' }),
  flashcard: def('flashcard', 'freeform', 240, 160, { label: 'Flashcard', icon: 'Layers', group: 'practice' }),
  frame: def('frame', 'freeform', 480, 360, { label: 'Frame', icon: 'Frame', group: 'organize' }),
  checklist: def('checklist', 'freeform', 280, 220, { label: 'Checklist', icon: 'ListChecks', group: 'organize' }),
  resources: def('resources', 'freeform', 300, 240, { label: 'Resource board', icon: 'Link', group: 'organize' }),
}

// Tutor createCard is only allowed for content cards that already have a renderer.
// Later phases extend this list as new renderers (mermaid, worked, table, callout) land.
export const CARD_KINDS: BlockType[] = ['concept', 'code', 'diagram']

export function isCardKind(type: string): boolean {
  return (CARD_KINDS as string[]).includes(type)
}

export function isFreeform(type: string): boolean {
  const b = BLOCKS[type as BlockType]
  return !!b && b.source === 'freeform'
}

export function blockSize(type: string): { w: number; h: number } {
  return BLOCKS[type as BlockType]?.defaultSize ?? { w: 300, h: 200 }
}

export function paletteItems(): BlockDef[] {
  return Object.values(BLOCKS).filter((b) => b.palette)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- blocks`
Expected: PASS — all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/studylab/blocks.ts lib/studylab/blocks.test.ts
git commit -m "feat(studylab): add block registry as single source of truth for block types"
```

---

### Task 7: Wire the registry into validation, types, and renderers

Make the reducer validate `createCard` against `isCardKind`, derive the renderer map's typing from `BlockType`, and add the additive `source` field plumbing — without changing runtime behavior (the AI still only creates concept/code/diagram for now).

**Files:**
- Modify: `lib/studylab/actions.ts` (`isValidAction` uses `isCardKind`)
- Modify: `lib/studylab/types.ts` (`StudyNode.source?`, `StudyNodeData` additive fields, `CardKind` widened)
- Modify: `components/studylab/canvasNodes.tsx` (type `studyNodeTypes` against `BlockType`)
- Test: `lib/studylab/actions.validate.test.ts`

**Interfaces:**
- Consumes: `isCardKind` from `@/lib/studylab/blocks`.
- Produces:
  - `StudyNode` gains `source?: BlockSource` (default behavior: absent ⇒ treated as `'ai'`).
  - `StudyNodeData` gains optional `source`, `color`, `quiz`, `runner`, `mermaid`, `rows`, `steps`, `variant`, `card`, `checklist`, `frameLabel`, `links` (typed loosely as the renderers/actions for them arrive in later phases; type them as documented below).

- [ ] **Step 1: Write the failing test**

Create `lib/studylab/actions.validate.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { isValidAction } from '@/lib/studylab/actions'

describe('isValidAction createCard', () => {
  it('accepts AI card kinds', () => {
    expect(isValidAction({ type: 'createCard', id: 'x', card: 'concept' })).toBe(true)
  })

  it('rejects freeform block types as createCard cards', () => {
    expect(isValidAction({ type: 'createCard', id: 'x', card: 'sticky' })).toBe(false)
    expect(isValidAction({ type: 'createCard', id: 'x', card: 'scratchpad' })).toBe(false)
  })

  it('rejects unknown card kinds', () => {
    expect(isValidAction({ type: 'createCard', id: 'x', card: 'nonsense' })).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- actions.validate`
Expected: FAIL — `sticky`/`scratchpad`/`nonsense` currently pass or fail incorrectly because `isValidAction` checks a hardcoded `['concept','code','diagram']` list (the `sticky` case would already fail, but the test imports run together; the meaningful new coupling is via `isCardKind`). Confirm the suite reports the file and the assertions that fail.

- [ ] **Step 3: Use `isCardKind` in `isValidAction`**

In `lib/studylab/actions.ts`:
- Add import: `import { isCardKind } from './blocks'`
- In `isValidAction`, change the `createCard` case from:
```ts
    case 'createCard':
      return typeof a.id === 'string' && ['concept', 'code', 'diagram'].includes(a.card)
```
to:
```ts
    case 'createCard':
      return typeof a.id === 'string' && isCardKind(a.card)
```

- [ ] **Step 4: Add additive type fields**

In `lib/studylab/types.ts`:
- Add `import type { BlockSource } from './blocks'` at the top.
- Widen `CardKind` to: `export type CardKind = 'concept' | 'code' | 'diagram' | 'mermaid' | 'worked' | 'table' | 'callout'`.
- Add `source?: BlockSource` to the `StudyNode` interface.
- Add these optional fields to `StudyNodeData` (additive; renderers/actions arrive in later phases):
```ts
  /** Block provenance; absent ⇒ treated as 'ai'. */
  source?: BlockSource
  /** Sticky note color key. */
  color?: string
  /** Mermaid diagram source. */
  mermaid?: string
  /** Comparison table rows (first row = header). */
  rows?: string[][]
  /** Worked-example numbered steps (LaTeX allowed). */
  steps?: string[]
  /** Callout variant. */
  variant?: 'definition' | 'tip' | 'warning'
  /** Flashcard faces. */
  card?: { front: string; back: string }
  /** Checklist items. */
  checklist?: { text: string; done: boolean }[]
  /** Frame label. */
  frameLabel?: string
  /** Resource board links. */
  links?: { url: string; label?: string }[]
  /** Quiz payload (shape finalised in the checkpoints phase). */
  quiz?: Record<string, unknown>
  /** Runnable-code editor state (shape finalised in the runner phase). */
  runner?: Record<string, unknown>
```

- [ ] **Step 5: Type the renderer map against `BlockType`**

In `components/studylab/canvasNodes.tsx`:
- Add import: `import type { BlockType } from '@/lib/studylab/types'` — actually import from blocks: `import type { BlockType } from '@/lib/studylab/blocks'`.
- Change the `studyNodeTypes` declaration to be partially typed so missing renderers are caught as they are added:
```ts
import type { ComponentType } from 'react'
import type { NodeProps } from '@xyflow/react'

export const studyNodeTypes: Partial<Record<BlockType, ComponentType<NodeProps>>> = {
  concept: ConceptNode,
  code: CodeNode,
  diagram: DiagramNode,
  stepGroup: StepGroupNode,
  image: ImageNode,
}
```
(`sketch` is already gone from Task 5. Using `Partial` documents that more block types will be filled in by later phases.)

- [ ] **Step 6: Run tests, typecheck, and lint**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: all tests PASS; no type errors; no lint errors.

- [ ] **Step 7: Commit**

```bash
git add lib/studylab/actions.ts lib/studylab/types.ts components/studylab/canvasNodes.tsx lib/studylab/actions.validate.test.ts
git commit -m "feat(studylab): validate cards against the block registry and add source/data fields"
```

---

## Self-Review

**Spec coverage (Phases 1–2):**
- Phase 1 placement fix → Task 2. ✓
- Phase 1 entrance animation + measured centering + fit-to-cluster → Tasks 3–4. ✓
- Phase 1 tldraw removal → Task 5. ✓
- Phase 2 block registry (pure metadata, AI-vs-freeform, sizes, palette source) → Task 6. ✓
- Phase 2 registry-based validation + additive `source`/data fields + registry-derived renderer typing → Task 7. ✓
- Test harness (precondition for TDD) → Task 1. ✓
- Phases 3–6 are explicitly out of scope for this plan (separate plans).

**Deviation from spec, intentional:** the spec's `BlockDef` listed a `renderer` field. This plan keeps `BLOCKS` as pure metadata (no React) and holds renderers separately in `canvasNodes.tsx`, because the reducer and the server-side tutor route import the registry and must not pull in React/canvas code. The registry's `BlockType` still types the renderer map, so the two stay in sync.

**Placeholder scan:** no TBD/TODO; every code step shows full code; test code is concrete.

**Type consistency:** `autoPosition`, `applyActions` (`created`), `CanvasEffect` union (`zoom` | `fitNodes`), `isCardKind`/`isFreeform`/`blockSize`/`paletteItems`, `BlockType`/`BlockSource`, and `studyNodeTypes` typing are referenced consistently across Tasks 2–7. `CardKind` widening in Task 7 matches the `CARD_KINDS` note that renderers for the new kinds arrive later.
