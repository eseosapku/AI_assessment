# StudyLab Freeform Palette Implementation Plan (Phase 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give students a drag/drop palette of freeform blocks (sticky notes, markdown notes, code scratchpad, image, flashcard, frame, checklist, resource board) plus user-drawn connectors — none of which the AI tutor controls or sees — so they can practice and organize outside the guided steps.

**Architecture:** A pure `createFreeformBlock` factory builds `source:'freeform'` nodes from the existing block registry. A docked `PaletteToolbar` adds them at viewport center. Each freeform block renders an editable card that persists via the existing `onNodeDataChange`, can be deleted, and has an "Ask tutor about this" bridge. Freeform nodes are excluded from the `card_ids` sent to the tutor, and user-drawn edges (React Flow `onConnect`) are tagged so they're visually distinct and ignored by the AI.

**Tech Stack:** Next.js 16, React 18, TypeScript (strict), `@xyflow/react` v12, Vitest, Tailwind. No new npm dependencies.

## Global Constraints

- Path alias `@/*` maps to repo root. TypeScript `strict`; no `any` in new code (existing `isValidAction(a: any)` is baseline).
- Pure-logic modules (`lib/studylab/*.ts` except components) must NOT import React or browser/canvas code.
- **Freeform blocks must never enter AI context:** they carry `source: 'freeform'`, are excluded from `card_ids`, and the tutor protocol cannot create or reference them. The only path into AI context is the explicit "Ask tutor about this" action a student triggers.
- No new npm dependencies. The code scratchpad reuses `RunnableCodeNode`; the editor is a `<textarea>`.
- Interactive controls on a node must carry the `nodrag` class (and `onMouseDown` stopPropagation for text inputs) so React Flow doesn't pan/drag the canvas while editing.
- Verification gate: `npx tsc --noEmit` (clean) + `npm test` (all green). `npm run lint` is unavailable in this project (Next 16). Do not start the dev server inside a subagent.
- Commit after each task. Commit messages: imperative mood, ending with the trailer below.

```
Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

- This plan is **Phase 4** of `docs/superpowers/specs/2026-06-25-studylab-tutor-expansion-design.md`. Phases 5–6 (checkpoints, tutor upgrades) are separate plans.
- The 8 palette blocks and their registry metadata (`label`, `icon`, `group`, `defaultSize`, `source:'freeform'`) already exist in `lib/studylab/blocks.ts` — do not redefine them. "Connectors + labels" is a canvas behavior (`onConnect` + edge labels), not a palette button.

---

### Task 1: Freeform block factory (pure, TDD)

A pure factory that turns a freeform `BlockType` + drop position into a `source:'freeform'` StudyNode with sensible default `data` per type, plus the helper that selects which node ids are sent to the tutor (AI cards only).

**Files:**
- Create: `lib/studylab/freeform.ts`
- Test: `lib/studylab/freeform.test.ts`

**Interfaces:**
- Consumes: `StudyNode`, `StudyNodeData` from `@/lib/studylab/types`; `isFreeform` from `@/lib/studylab/blocks`.
- Produces:
  - `function createFreeformBlock(type: string, position: { x: number; y: number }): StudyNode` — returns a node with a unique id (`free-<type>-<timestamp>-<rand>`), `source: 'freeform'`, `type` as given, and per-type default `data` (see below). Throws `Error('not a freeform block: '+type)` if `!isFreeform(type)`.
  - `function aiCardIds(nodes: StudyNode[]): string[]` — ids of nodes that are neither `stepGroup` nor freeform (the set the tutor should see).

Per-type default `data`:
- `sticky` → `{ kind: 'concept', source: 'freeform', color: 'yellow', body: '' }`
- `note` → `{ kind: 'concept', source: 'freeform', body: '' }`
- `scratchpad` → `{ kind: 'code', source: 'freeform', language: 'python', code: '' }`
- `photo` → `{ kind: 'image', source: 'freeform', imageUrl: '' }`
- `flashcard` → `{ kind: 'concept', source: 'freeform', card: { front: '', back: '' } }`
- `frame` → `{ kind: 'concept', source: 'freeform', frameLabel: 'Group' }`
- `checklist` → `{ kind: 'concept', source: 'freeform', checklist: [] }`
- `resources` → `{ kind: 'concept', source: 'freeform', links: [] }`

(`kind` is set to a permissive existing value; renderers key off `type`, not `kind`. `StudyNodeData.kind` only allows `CardKind | 'stepGroup' | 'image'`, so use `'concept'`/`'code'`/`'image'` as shown.)

- [ ] **Step 1: Write the failing tests**

Create `lib/studylab/freeform.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { createFreeformBlock, aiCardIds } from '@/lib/studylab/freeform'
import type { StudyNode } from '@/lib/studylab/types'

describe('createFreeformBlock', () => {
  it('creates a sticky with freeform source and a color', () => {
    const n = createFreeformBlock('sticky', { x: 10, y: 20 })
    expect(n.source).toBe('freeform')
    expect(n.type).toBe('sticky')
    expect(n.position).toEqual({ x: 10, y: 20 })
    expect(n.data.source).toBe('freeform')
    expect(n.data.color).toBe('yellow')
  })

  it('creates a scratchpad seeded for python code', () => {
    const n = createFreeformBlock('scratchpad', { x: 0, y: 0 })
    expect(n.type).toBe('scratchpad')
    expect(n.data.language).toBe('python')
    expect(n.data.code).toBe('')
  })

  it('creates a flashcard with empty faces', () => {
    const n = createFreeformBlock('flashcard', { x: 0, y: 0 })
    expect(n.data.card).toEqual({ front: '', back: '' })
  })

  it('gives every block a unique id', () => {
    const a = createFreeformBlock('note', { x: 0, y: 0 })
    const b = createFreeformBlock('note', { x: 0, y: 0 })
    expect(a.id).not.toBe(b.id)
  })

  it('rejects non-freeform types', () => {
    expect(() => createFreeformBlock('concept', { x: 0, y: 0 })).toThrow()
  })
})

describe('aiCardIds', () => {
  it('excludes stepGroup and freeform nodes', () => {
    const nodes: StudyNode[] = [
      { id: 'a', type: 'concept', position: { x: 0, y: 0 }, data: { kind: 'concept' } },
      { id: 'g', type: 'stepGroup', position: { x: 0, y: 0 }, data: { kind: 'stepGroup' } },
      { id: 's', type: 'sticky' as any, position: { x: 0, y: 0 }, data: { kind: 'concept' }, source: 'freeform' },
    ]
    expect(aiCardIds(nodes)).toEqual(['a'])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- freeform`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/studylab/freeform.ts`**

```ts
import type { StudyNode, StudyNodeData } from './types'
import { isFreeform } from './blocks'

let seq = 0

function defaultData(type: string): StudyNodeData {
  const base = { source: 'freeform' as const }
  switch (type) {
    case 'sticky': return { kind: 'concept', ...base, color: 'yellow', body: '' }
    case 'note': return { kind: 'concept', ...base, body: '' }
    case 'scratchpad': return { kind: 'code', ...base, language: 'python', code: '' }
    case 'photo': return { kind: 'image', ...base, imageUrl: '' }
    case 'flashcard': return { kind: 'concept', ...base, card: { front: '', back: '' } }
    case 'frame': return { kind: 'concept', ...base, frameLabel: 'Group' }
    case 'checklist': return { kind: 'concept', ...base, checklist: [] }
    case 'resources': return { kind: 'concept', ...base, links: [] }
    default: return { kind: 'concept', ...base }
  }
}

export function createFreeformBlock(type: string, position: { x: number; y: number }): StudyNode {
  if (!isFreeform(type)) throw new Error('not a freeform block: ' + type)
  seq += 1
  const id = `free-${type}-${Date.now()}-${seq}`
  return {
    id,
    type: type as StudyNode['type'],
    position,
    data: defaultData(type),
    source: 'freeform',
  }
}

// Node ids the tutor should see: AI content cards only (no step groups, no freeform).
export function aiCardIds(nodes: StudyNode[]): string[] {
  return nodes
    .filter((n) => n.type !== 'stepGroup' && n.source !== 'freeform' && !isFreeform(n.type))
    .map((n) => n.id)
}
```
(Casting `type as StudyNode['type']` is needed because freeform types like `'sticky'` aren't in the `StudyNode.type` union; this is the one place freeform types cross into the node — acceptable and contained.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- freeform`
Expected: PASS — all tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/studylab/freeform.ts lib/studylab/freeform.test.ts
git commit -m "feat(studylab): freeform block factory + AI card-id selector"
```

---

### Task 2: Workspace/Canvas plumbing — add, delete, ask-tutor, connectors, card_ids

Wire the canvas so freeform blocks can be added/deleted, an "Ask tutor about this" bridge sends one block's content into chat, user-drawn edges are created, and freeform nodes are excluded from `card_ids`.

**Files:**
- Modify: `components/studylab/canvasShared.tsx` (`CanvasCallbacks` + context default: add `onDeleteNode`, `onAskTutor`)
- Modify: `components/studylab/StudyCanvas.tsx` (`StudyCanvasProps`, provider value, `onConnect`, `onNodesDelete`, expose an imperative "add at center" — see below)
- Modify: `components/studylab/Workspace.tsx` (handlers + exclude freeform from `card_ids`)

**Interfaces:**
- Consumes: `createFreeformBlock`, `aiCardIds` from `@/lib/studylab/freeform`; `StudyEdge` from types.
- Produces:
  - `CanvasContext` gains `onDeleteNode: (id: string) => void` and `onAskTutor: (id: string) => void`.
  - `StudyCanvasProps` gains `onAddBlock: (type: string) => void`, `onDeleteNode`, `onAskTutor`, `onConnectEdge: (from: string, to: string) => void`.
  - `Workspace` implements: `handleAddBlock(type)` (create at a fixed offset cascade and persist), `handleDeleteNode(id)` (remove node + its edges, persist), `handleAskTutor(id)` (turn the block's data into a chat message via `handleSend`), `handleConnectEdge(from, to)` (append a user edge `{ id: 'u-...', source, target, animated: false }`).
  - `card_ids` at Workspace runTutor changes from the inline filter to `aiCardIds(baseCanvas.nodes)`.

- [ ] **Step 1: Extend `CanvasCallbacks` in `canvasShared.tsx`**

```ts
export interface CanvasCallbacks {
  onToggleGroup: (groupId: string) => void
  onNodeDataChange: (id: string, patch: Partial<StudyNodeData>) => void
  onDeleteNode: (id: string) => void
  onAskTutor: (id: string) => void
}
```
And the default:
```ts
export const CanvasContext = createContext<CanvasCallbacks>({
  onToggleGroup: () => {},
  onNodeDataChange: () => {},
  onDeleteNode: () => {},
  onAskTutor: () => {},
})
```

- [ ] **Step 2: Extend `StudyCanvas`**

In `components/studylab/StudyCanvas.tsx`:
- Add to `StudyCanvasProps`: `onAddBlock: (type: string) => void`, `onDeleteNode: (id: string) => void`, `onAskTutor: (id: string) => void`, `onConnectEdge: (from: string, to: string) => void`.
- In `FlowInner`, accept `onConnectEdge` and wire React Flow:
  ```ts
  import { addEdge, type Connection } from '@xyflow/react' // add to imports
  const onConnect = useCallback(
    (c: Connection) => { if (c.source && c.target) onConnectEdge(c.source, c.target) },
    [onConnectEdge]
  )
  ```
  Pass `onConnect={onConnect}` to `<ReactFlow>`. Add `onConnectEdge` to `FlowInner`'s prop type (it's in `Omit<StudyCanvasProps,'onNodeDataChange'>` already, so just destructure it).
- Provider value adds `onDeleteNode` and `onAskTutor`:
  ```tsx
  <CanvasContext.Provider value={{ onToggleGroup: props.onToggleGroup, onNodeDataChange: props.onNodeDataChange, onDeleteNode: props.onDeleteNode, onAskTutor: props.onAskTutor }}>
  ```
- Render the palette (added in Task 3) — leave a placeholder import for now; Task 3 fills it. To keep this task self-contained, render nothing extra yet.

- [ ] **Step 3: Implement handlers in `Workspace.tsx`**

Add imports: `import { createFreeformBlock, aiCardIds } from '@/lib/studylab/freeform'`.

Add a drop-offset ref near the other refs:
```ts
const addOffset = useRef(0)
```

Add handlers near `handleNodeDataChange`:
```ts
const handleAddBlock = useCallback((type: string) => {
  // Cascade new blocks so they don't stack exactly.
  addOffset.current = (addOffset.current + 1) % 8
  const o = addOffset.current * 36
  const node = createFreeformBlock(type, { x: 200 + o, y: 200 + o })
  setCanvas((prev) => ({ ...prev, nodes: [...prev.nodes, node] }))
  effectVersion.current += 1
  setEffects({ version: effectVersion.current, list: [{ kind: 'fitNodes', nodeIds: [node.id] }] })
  scheduleCanvasSave()
}, [scheduleCanvasSave])

const handleDeleteNode = useCallback((nodeId: string) => {
  setCanvas((prev) => ({
    ...prev,
    nodes: prev.nodes.filter((n) => n.id !== nodeId),
    edges: prev.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
  }))
  scheduleCanvasSave()
}, [scheduleCanvasSave])

const handleConnectEdge = useCallback((from: string, to: string) => {
  setCanvas((prev) => {
    if (prev.edges.some((e) => e.source === from && e.target === to)) return prev
    return { ...prev, edges: [...prev.edges, { id: `u-${from}-${to}-${Date.now()}`, source: from, target: to, animated: false }] }
  })
  scheduleCanvasSave()
}, [scheduleCanvasSave])
```

Add the ask-tutor bridge (uses `handleSend`, which already exists, and `canvasRef`):
```ts
const handleAskTutor = useCallback((nodeId: string) => {
  const n = canvasRef.current.nodes.find((x) => x.id === nodeId)
  if (!n) return
  const d = n.data
  const text =
    d.code ? `Can you look at this code I wrote?\n\n\`\`\`${d.language ?? ''}\n${d.code}\n\`\`\`` :
    d.body ? `Can you help me with this note?\n\n${d.body}` :
    d.card ? `Quiz me / check my flashcard — front: "${d.card.front}", back: "${d.card.back}"` :
    'Can you help me with this?'
  handleSend(text)
}, [handleSend])
```

Change the `card_ids` line in `runTutor` from:
```ts
card_ids: baseCanvas.nodes.filter((n) => n.type !== 'stepGroup').map((n) => n.id),
```
to:
```ts
card_ids: aiCardIds(baseCanvas.nodes),
```

Pass the new props to `<StudyCanvas>`: `onAddBlock={handleAddBlock} onDeleteNode={handleDeleteNode} onAskTutor={handleAskTutor} onConnectEdge={handleConnectEdge}`.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean. (`StudyCanvas` will warn about an unused `onAddBlock` until Task 3 renders the palette — pass it down but it's fine to leave it threaded to the default export for now.)

- [ ] **Step 5: Commit**

```bash
git add components/studylab/canvasShared.tsx components/studylab/StudyCanvas.tsx components/studylab/Workspace.tsx
git commit -m "feat(studylab): freeform add/delete/connect/ask-tutor plumbing; exclude freeform from card_ids"
```

---

### Task 3: Palette toolbar

A docked toolbar listing the 8 freeform palette blocks; clicking one adds it at viewport center.

**Files:**
- Create: `components/studylab/PaletteToolbar.tsx`
- Modify: `components/studylab/StudyCanvas.tsx` (render the toolbar inside the canvas, wired to `onAddBlock`)

**Interfaces:**
- Consumes: `paletteItems` from `@/lib/studylab/blocks`; `onAddBlock` from props.
- Produces: `export default function PaletteToolbar({ onAdd }: { onAdd: (type: string) => void })`.

- [ ] **Step 1: Create `PaletteToolbar.tsx`**

```tsx
'use client'

import { StickyNote, FileText, Terminal, Image, Layers, Frame, ListChecks, Link, type LucideIcon } from 'lucide-react'
import { paletteItems } from '@/lib/studylab/blocks'

const ICONS: Record<string, LucideIcon> = {
  StickyNote, FileText, Terminal, Image, Layers, Frame, ListChecks, Link,
}

export default function PaletteToolbar({ onAdd }: { onAdd: (type: string) => void }) {
  const items = paletteItems()
  return (
    <div className="absolute top-4 right-4 z-10 flex flex-col gap-1 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-[#1c1c1e]/95 p-1.5 shadow-lg backdrop-blur">
      {items.map((b) => {
        const Icon = b.palette ? ICONS[b.palette.icon] ?? FileText : FileText
        return (
          <button
            key={b.type}
            type="button"
            title={b.palette?.label ?? b.type}
            onClick={() => onAdd(b.type)}
            className="flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-[12px] font-medium text-gray-600 dark:text-gray-300 hover:bg-apple-blue/10 hover:text-apple-blue transition-colors"
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span className="whitespace-nowrap">{b.palette?.label}</span>
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Render it in `StudyCanvas`**

In `components/studylab/StudyCanvas.tsx`, in the default export's `<div className="relative w-full h-full">`, add the toolbar as a sibling of `<ReactFlowProvider>`:
```tsx
import PaletteToolbar from './PaletteToolbar'
// ...
<div className="relative w-full h-full">
  <ReactFlowProvider>
    <FlowInner ... />
  </ReactFlowProvider>
  <PaletteToolbar onAdd={props.onAddBlock} />
</div>
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add components/studylab/PaletteToolbar.tsx components/studylab/StudyCanvas.tsx
git commit -m "feat(studylab): freeform palette toolbar"
```

---

### Task 4: Freeform renderers A — sticky, note, checklist

The simple text-editing freeform blocks. Each persists via `onNodeDataChange`, has a delete (✕) and an "Ask tutor" affordance, and uses `nodrag` on inputs.

**Files:**
- Create: `components/studylab/freeformNodes.tsx`
- Modify: `components/studylab/canvasNodes.tsx` (register `sticky`, `note`, `checklist`, and `scratchpad` in `studyNodeTypes`)

**Interfaces:**
- Consumes: `CanvasContext` (`onNodeDataChange`, `onDeleteNode`, `onAskTutor`) and `handleClass` from `./canvasShared`; `RunnableCodeNode` from `./RunnableCodeCard`; `StudyNodeData` from types.
- Produces: `export function StickyNode`, `NoteNode`, `ChecklistNode` (each `(props: NodeProps)`).

- [ ] **Step 1: Create `freeformNodes.tsx` with a shared chrome + the three nodes**

Implement a small `FreeformFrame` wrapper (its own, lighter than `CardFrame`) that renders `Handle`s, a header row with a title slot + an "Ask tutor" button (calls `onAskTutor(id)`) + a delete ✕ (calls `onDeleteNode(id)`), and the children. Then:
- `StickyNode`: a colored square (color from `data.color`, mapped to a tailwind bg), a `nodrag` `<textarea>` bound to `data.body` (debounced persist via `onNodeDataChange`), and a small color swatch row to change `data.color`.
- `NoteNode`: a wider card, a `nodrag` `<textarea>` bound to `data.body`, rendered through `SafeLatex` in a preview toggle is NOT required — just an editable textarea for v1.
- `ChecklistNode`: renders `data.checklist` items each with a checkbox (toggles `done`) and an editable text; an "+ add item" button appends `{ text:'', done:false }`. All mutations go through `onNodeDataChange(id, { checklist: next })`.

Exact persistence pattern (reuse in each): keep local state seeded from `data`, debounce ~600ms to `onNodeDataChange`. Inputs carry `className="nodrag ..."` and text inputs add `onMouseDown={(e)=>e.stopPropagation()}`.

(Full component code is the implementer's to write following this contract; it is a standard-model task. Keep each node under ~60 lines; share the `FreeformFrame` and a `useDebouncedPersist(id, patchKey)` helper to stay DRY.)

- [ ] **Step 2: Register the renderers**

In `components/studylab/canvasNodes.tsx`, import and add to `studyNodeTypes`:
```ts
import { StickyNode, NoteNode, ChecklistNode } from './freeformNodes'
import { RunnableCodeNode } from './RunnableCodeCard' // already imported
// ...
sticky: StickyNode,
note: NoteNode,
checklist: ChecklistNode,
scratchpad: RunnableCodeNode,
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add components/studylab/freeformNodes.tsx components/studylab/canvasNodes.tsx
git commit -m "feat(studylab): freeform renderers — sticky, note, checklist; scratchpad reuses runner"
```

---

### Task 5: Freeform renderers B — flashcard, photo, frame, resources

**Files:**
- Modify: `components/studylab/freeformNodes.tsx` (add `FlashcardNode`, `PhotoNode`, `FrameNode`, `ResourceBoardNode`)
- Modify: `components/studylab/canvasNodes.tsx` (register `flashcard`, `photo`, `frame`, `resources`)

**Interfaces:**
- Consumes: same context as Task 4.
- Produces: `export function FlashcardNode`, `PhotoNode`, `FrameNode`, `ResourceBoardNode`.

Behavior:
- `FlashcardNode`: shows `data.card.front`; click flips (local state) to show `back`. An edit mode (small pencil toggle) reveals two `nodrag` inputs for front/back persisted via `onNodeDataChange(id, { card })`.
- `PhotoNode`: if `data.imageUrl`, render `<img>`; else a `nodrag` drop/click target that reads a pasted/selected image file to a data URL (reuse the `readFileAsDataUrl` pattern from `ChatMouthpiece.tsx` — copy the small helper locally, don't import) and persists `{ imageUrl }`. 5 MB cap.
- `FrameNode`: a large translucent labeled rectangle rendered at low opacity with the registry's `frame` size; an editable `nodrag` label bound to `data.frameLabel`. **Must sit behind other nodes:** give its outer div `pointer-events-none` except the label/handles, and rely on it being added first / lower — set `className` with a translucent border and no fill so blocks on top remain usable. (React Flow draws nodes in array order; the frame being draggable by its border is enough for v1 — document that true z-ordering is a follow-up.)
- `ResourceBoardNode`: a `nodrag` URL input + "add" that appends `{ url, label? }` to `data.links`; render each link as a chip (`<a href target=_blank>` showing the hostname); a YouTube/Vimeo URL renders a small thumbnail tile (derive `https://img.youtube.com/vi/<id>/mqdefault.jpg` for youtube ids). Delete-per-link via a tiny ✕. Persist via `onNodeDataChange(id, { links })`.

- [ ] **Step 1: Add the four renderers to `freeformNodes.tsx`** following the contract above (standard-model task; keep each focused, reuse `FreeformFrame` and the debounced-persist helper).

- [ ] **Step 2: Register them**

In `canvasNodes.tsx` `studyNodeTypes`:
```ts
flashcard: FlashcardNode,
photo: PhotoNode,
frame: FrameNode,
resources: ResourceBoardNode,
```
(import them from `./freeformNodes`)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add components/studylab/freeformNodes.tsx components/studylab/canvasNodes.tsx
git commit -m "feat(studylab): freeform renderers — flashcard, photo, frame, resource board"
```

---

### Task 6: User-edge styling + edge labels

Make user-drawn connectors (from Task 2's `onConnect`) visually distinct from AI edges, and let a student label one.

**Files:**
- Modify: `components/studylab/StudyCanvas.tsx` (style user edges; double-click to edit a label)

**Interfaces:**
- Consumes: `onNodeDataChange` is not used here; uses a new `onEdgeLabel` prop OR reuses an inline edit. To stay simple: edges are part of canvas state already; add `onEdgeLabel: (id: string, label: string) => void` to props + a Workspace handler.

- [ ] **Step 1: Style user vs AI edges**

In `StudyCanvas.tsx` `rfEdges` mapping, branch on the edge id prefix (`u-` = user): user edges get a dashed gray stroke (`strokeDasharray: '6 4'`, `stroke: '#94a3b8'`), AI edges keep the blue solid style. Confirm the existing `rfEdges` map is the single place edges are styled.

- [ ] **Step 2: Edge label editing (double-click)**

Add `onEdgeLabel: (id: string, label: string) => void` to `StudyCanvasProps`; in `FlowInner` pass `onEdgeDoubleClick={(_, edge) => { const v = window.prompt('Edge label', edge.label as string ?? ''); if (v !== null) onEdgeLabel(edge.id, v) }}` to `<ReactFlow>`. In `Workspace`, implement `handleEdgeLabel(id, label)` that maps `canvas.edges` setting `label` on the matching edge and persists; pass it down. (Prefer a small inline prompt for v1; a custom edge component is a later follow-up.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add components/studylab/StudyCanvas.tsx components/studylab/Workspace.tsx
git commit -m "feat(studylab): distinct user-drawn connectors with editable labels"
```

---

## Self-Review

**Spec coverage (Phase 4 — freeform palette):**
- Palette toolbar (click to add at center) → Tasks 2–3. ✓ (drag-from-toolbar is reduced to click-to-drop for v1; documented below.)
- 8 freeform blocks: scratchpad (reuses runner), sticky, note, photo, flashcard, frame, checklist, resources → Tasks 4–5. ✓
- Freeform persists, `source:'freeform'`, excluded from `card_ids` → Tasks 1–2. ✓
- "Ask tutor about this" opt-in bridge → Task 2 (`onAskTutor`) + rendered in Task 4/5 chrome. ✓
- Connectors (user-drawn edges) + labels, tagged distinct from AI edges → Tasks 2 + 6. ✓
- Delete freeform blocks → Task 2 (`onDeleteNode`) + chrome ✕. ✓
- Resource board with link chips + YouTube thumbnails → Task 5. ✓

**Documented deviations:** drag-from-palette-onto-canvas is simplified to click-to-drop-at-center for v1 (drag-and-drop positioning is a follow-up); frame true z-ordering and a custom edge-label component are follow-ups; the rich link-preview endpoint stays optional/out of scope.

**Placeholder scan:** Tasks 1–3 and Task 6 carry complete code. Tasks 4–5 are standard-model UI tasks with explicit per-node behavior contracts, exact registry keys, the persistence/`nodrag` pattern, and the shared-helper requirement — not "add a component"-style hand-waving.

**Type consistency:** `createFreeformBlock`/`aiCardIds` (Task 1) used in Task 2. `CanvasCallbacks` additions (`onDeleteNode`, `onAskTutor`) in Task 2 match consumers in Tasks 4–5. `onAddBlock` (Task 2 prop) consumed in Task 3. `studyNodeTypes` keys (`sticky`,`note`,`checklist`,`scratchpad`,`flashcard`,`photo`,`frame`,`resources`) match the registry `BlockType`s and the renderer names across Tasks 4–5. `onConnectEdge`/`onEdgeLabel` threaded Task 2 → Task 6.
