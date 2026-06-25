# StudyLab Tutor Vocabulary + Step Discipline Implementation Plan (Phase 6)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Widen the tutor's teaching vocabulary with four new card types — Mermaid diagram, worked-example/steps, comparison table, and callout/definition — and rewrite the tutor prompt for sequential step discipline (no skipped/duplicate steps, no re-teaching the same concept).

**Architecture:** The four card types are already in the block registry; this phase adds them to `CARD_KINDS` (so the tutor may create them), carries their data through the `createCard` action + reducer, and adds their renderers. Mermaid renders via a lazily-imported `mermaid` library. The tutor prompt gains documentation for the new cards and stricter step rules.

**Tech Stack:** Next.js 16, React 18, TypeScript (strict), `@xyflow/react` v12, Vitest, `mermaid` (new, lazy-loaded). 

## Global Constraints

- Path alias `@/*` maps to repo root. TypeScript `strict`; no `any` in new code (existing `isValidAction(a: any)` is baseline).
- Pure-logic modules (`lib/studylab/*.ts` except components) must NOT import React or browser/canvas code.
- One new npm dependency this phase: **`mermaid`** — imported lazily (`await import('mermaid')`) inside the client renderer so it stays out of the initial bundle. No other new deps.
- New card renderers reuse `CardFrame`/`SafeLatex` from `canvasShared` for consistent chrome + the `sl-node-enter` animation; LaTeX uses `SafeLatex`.
- Verification gate: `npx tsc --noEmit` (clean) + `npm test` (all green). `npm run lint` is unavailable (Next 16). Do not start the dev server inside a subagent.
- Commit after each task. Commit messages end with the trailer below.

```
Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

- This plan is **Phase 6** (final phase) of `docs/superpowers/specs/2026-06-25-studylab-tutor-expansion-design.md`.
- The four card types (`mermaid`, `worked`, `table`, `callout`) already exist in `lib/studylab/blocks.ts` `BLOCKS` with `source:'ai'` and sizes — do not redefine them. `CardKind` already includes them (foundation). `StudyNodeData` already has `mermaid`, `steps`, `rows`, `variant` fields (foundation).

---

### Task 1: Carry the new card data + enable creation (pure, TDD)

Add `mermaid`/`steps`/`rows`/`variant` to the `createCard` action, copy them through the reducer, and add the four types to `CARD_KINDS` so `isValidAction` accepts them.

**Files:**
- Modify: `lib/studylab/blocks.ts` (`CARD_KINDS`)
- Modify: `lib/studylab/types.ts` (`createCard` action fields)
- Modify: `lib/studylab/actions.ts` (reducer copies the new fields)
- Modify: `lib/studylab/blocks.test.ts` (assert the new card kinds)
- Test: `lib/studylab/actions.cards.test.ts`

**Interfaces:**
- `CARD_KINDS` becomes `['concept', 'code', 'diagram', 'mermaid', 'worked', 'table', 'callout']`.
- `createCard` action gains optional `mermaid?: string`, `steps?: string[]`, `rows?: string[][]`, `variant?: 'definition' | 'tip' | 'warning'`.
- The reducer's `createCard` node `data` includes those four fields.

- [ ] **Step 1: Extend the blocks test (assert new kinds) — failing**

In `lib/studylab/blocks.test.ts`, replace the `'marks concept/code/diagram as AI card kinds'` test with:
```ts
  it('marks all seven content cards as AI card kinds', () => {
    for (const t of ['concept', 'code', 'diagram', 'mermaid', 'worked', 'table', 'callout']) {
      expect(isCardKind(t)).toBe(true)
    }
  })
```

- [ ] **Step 2: Write the reducer field-copy test — failing**

Create `lib/studylab/actions.cards.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { applyActions, isValidAction } from '@/lib/studylab/actions'
import type { CanvasState } from '@/lib/studylab/types'

const empty: CanvasState = { nodes: [], edges: [] }

describe('new card kinds', () => {
  it('isValidAction accepts the new card kinds', () => {
    expect(isValidAction({ type: 'createCard', id: 'm', card: 'mermaid' })).toBe(true)
    expect(isValidAction({ type: 'createCard', id: 'w', card: 'worked' })).toBe(true)
    expect(isValidAction({ type: 'createCard', id: 't', card: 'table' })).toBe(true)
    expect(isValidAction({ type: 'createCard', id: 'c', card: 'callout' })).toBe(true)
  })

  it('reducer copies mermaid/steps/rows/variant into node data', () => {
    const res = applyActions(empty, [
      { type: 'createCard', id: 'm1', card: 'mermaid', step: 1, mermaid: 'graph TD; A-->B', position: 'auto' },
      { type: 'createCard', id: 'w1', card: 'worked', step: 1, steps: ['s1', 's2'], position: 'auto' },
      { type: 'createCard', id: 't1', card: 'table', step: 1, rows: [['a', 'b'], ['1', '2']], position: 'auto' },
      { type: 'createCard', id: 'c1', card: 'callout', step: 1, variant: 'tip', body: 'remember', position: 'auto' },
    ])
    const byId = (id: string) => res.nodes.find((n) => n.id === id)!.data
    expect(byId('m1').mermaid).toBe('graph TD; A-->B')
    expect(byId('w1').steps).toEqual(['s1', 's2'])
    expect(byId('t1').rows).toEqual([['a', 'b'], ['1', '2']])
    expect(byId('c1').variant).toBe('tip')
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- "blocks|actions.cards"`
Expected: FAIL — `isCardKind('mermaid')` is false and `data.mermaid` is undefined.

- [ ] **Step 4: Add the four kinds to `CARD_KINDS`**

In `lib/studylab/blocks.ts`:
```ts
export const CARD_KINDS: BlockType[] = ['concept', 'code', 'diagram', 'mermaid', 'worked', 'table', 'callout']
```

- [ ] **Step 5: Add the createCard action fields**

In `lib/studylab/types.ts`, in the `createCard` member of `TutorAction`, add after `svg?: string`:
```ts
      mermaid?: string
      steps?: string[]
      rows?: string[][]
      variant?: 'definition' | 'tip' | 'warning'
```

- [ ] **Step 6: Copy the fields in the reducer**

In `lib/studylab/actions.ts`, in the `createCard` case's `data` object, add after `svg: action.svg,`:
```ts
            mermaid: action.mermaid,
            steps: action.steps,
            rows: action.rows,
            variant: action.variant,
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm test -- "blocks|actions.cards"`
Expected: PASS.

- [ ] **Step 8: Full suite + typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: all green; tsc clean.

- [ ] **Step 9: Commit**

```bash
git add lib/studylab/blocks.ts lib/studylab/types.ts lib/studylab/actions.ts lib/studylab/blocks.test.ts lib/studylab/actions.cards.test.ts
git commit -m "feat(studylab): enable mermaid/worked/table/callout cards and carry their data"
```

---

### Task 2: Worked-example, table, and callout renderers

**Files:**
- Create: `components/studylab/tutorNodes.tsx`
- Modify: `components/studylab/canvasNodes.tsx` (register `worked`, `table`, `callout`)

**Interfaces:**
- Consumes: `CardFrame`, `SafeLatex` from `./canvasShared`; `StudyNodeData` from types.
- Produces: `export function WorkedNode`, `TableNode`, `CalloutNode` (each `(props: NodeProps)`).

Behavior (standard-model task — exact contract):
- `WorkedNode` (`CardFrame accent="blue"`): header with a `ListOrdered` icon + `data.title`; body renders `data.steps` as a numbered `<ol>`, each step through `<SafeLatex>`.
- `TableNode` (`CardFrame accent="blue"`): header with `data.title`; body renders `data.rows` as a `<table>` — first row as `<th>` header, the rest as `<td>`; small text, bordered cells. Guard against missing/empty `rows`.
- `CalloutNode`: a compact accented card (NOT `CardFrame` — its own smaller frame with `Handle`s) whose color + icon depends on `data.variant`: `definition`→indigo + `BookMarked`, `tip`→emerald + `Lightbulb`, `warning`→amber + `AlertTriangle` (default `definition`). Shows `data.title` (optional) and `data.body` via `<SafeLatex>`.

- [ ] **Step 1: Create `tutorNodes.tsx`** implementing the three renderers per the contract. Keep each focused; reuse `CardFrame`/`SafeLatex`.

- [ ] **Step 2: Register them**

In `components/studylab/canvasNodes.tsx`, import and add to `studyNodeTypes`:
```ts
import { WorkedNode, TableNode, CalloutNode } from './tutorNodes'
// ...
worked: WorkedNode,
table: TableNode,
callout: CalloutNode,
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add components/studylab/tutorNodes.tsx components/studylab/canvasNodes.tsx
git commit -m "feat(studylab): worked-example, comparison-table, and callout renderers"
```

---

### Task 3: Mermaid diagram renderer (lazy)

**Files:**
- Modify: `package.json` (add `mermaid`)
- Create: `components/studylab/MermaidNode.tsx`
- Modify: `components/studylab/canvasNodes.tsx` (register `mermaid`)

**Interfaces:**
- Consumes: `CardFrame` from `./canvasShared`; `StudyNodeData` from types.
- Produces: `export function MermaidNode(props: NodeProps)`.

- [ ] **Step 1: Add the dependency**

Run:
```bash
npm install mermaid
```
Expected: `mermaid` appears in `package.json` dependencies.

- [ ] **Step 2: Create `MermaidNode.tsx`**

Lazily import mermaid, render `data.mermaid` to SVG into a ref'd container, falling back to the raw text on parse error.
```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { type NodeProps } from '@xyflow/react'
import { GitBranch } from 'lucide-react'
import type { StudyNodeData } from '@/lib/studylab/types'
import { CardFrame } from './canvasShared'

let mermaidReady: Promise<typeof import('mermaid').default> | null = null
function loadMermaid() {
  if (!mermaidReady) {
    mermaidReady = import('mermaid').then((m) => {
      m.default.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'strict' })
      return m.default
    })
  }
  return mermaidReady
}

export function MermaidNode({ id, data }: NodeProps) {
  const d = data as unknown as StudyNodeData
  const ref = useRef<HTMLDivElement>(null)
  const [error, setError] = useState(false)
  const src = d.mermaid ?? ''

  useEffect(() => {
    let cancelled = false
    if (!src.trim()) return
    ;(async () => {
      try {
        const mermaid = await loadMermaid()
        const { svg } = await mermaid.render(`m-${id}-${Date.now()}`, src)
        if (!cancelled && ref.current) {
          ref.current.innerHTML = svg
          setError(false)
        }
      } catch {
        if (!cancelled) setError(true)
      }
    })()
    return () => { cancelled = true }
  }, [src, id])

  return (
    <CardFrame accent="orange">
      <div className="flex items-center gap-2 px-4 pt-4">
        <div className="w-7 h-7 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
          <GitBranch className="w-4 h-4 text-orange-500" />
        </div>
        <h3 className="font-semibold text-[15px] leading-tight">{d.title}</h3>
      </div>
      <div className="px-4 pb-4 pt-2">
        {error ? (
          <pre className="text-[11px] bg-gray-50 dark:bg-white/5 rounded-lg p-2 overflow-x-auto whitespace-pre-wrap">{src}</pre>
        ) : (
          <div ref={ref} className="w-full flex justify-center [&_svg]:max-w-full [&_svg]:h-auto" />
        )}
      </div>
    </CardFrame>
  )
}
```

- [ ] **Step 3: Register it**

In `components/studylab/canvasNodes.tsx`:
```ts
import { MermaidNode } from './MermaidNode'
// ...
mermaid: MermaidNode,
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean. (If TS cannot find types for `mermaid`, the package ships its own types; confirm `import('mermaid').default` resolves — it does in mermaid v10/11.)

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json components/studylab/MermaidNode.tsx components/studylab/canvasNodes.tsx
git commit -m "feat(studylab): mermaid diagram renderer (lazy-loaded)"
```

---

### Task 4: Tutor prompt — new cards + step discipline

Document the four new cards and fix the step-progression problems (jumping step numbers, re-teaching the same concept).

**Files:**
- Modify: `app/api/studylab/tutor/route.ts` (system prompt)

**Interfaces:** none (prompt text only).

- [ ] **Step 1: Document the new card types**

In the `SYSTEM` string, extend the `createCard` action card list. Change the `card` enum line and add bullets. Replace:
```
- { "type":"createCard", "id":"unique-id", "card":"concept"|"code"|"diagram", ... }
    • "concept": use title + body (and optional items for key terms / bullet lists).
    • "code": use title + code + language. Keep code short.
    • "diagram": use title + body. Optionally "svg" with simple inline SVG markup if a visual truly helps.
```
with:
```
- { "type":"createCard", "id":"unique-id", "card":"concept"|"code"|"diagram"|"mermaid"|"worked"|"table"|"callout", ... }
    • "concept": use title + body (and optional items for key terms / bullet lists).
    • "code": use title + code + language. Keep code short. Code cards are RUNNABLE — prefer python, javascript, or html so the student can Run them.
    • "diagram": prefer "mermaid" over "svg". Use "svg" only for a tiny custom visual.
    • "mermaid": set "mermaid" to valid Mermaid syntax (e.g. "graph TD; A[Start]-->B[End]"). Best for flows, trees, sequences, state.
    • "worked": set "steps" to an array of numbered solution steps (LaTeX allowed). Best for math/physics/procedures.
    • "table": set "rows" to an array of rows (first row = header), e.g. [["Feature","A","B"],["Speed","O(1)","O(n)"]]. Best for comparisons.
    • "callout": set "variant" to "definition"|"tip"|"warning" and put the text in "body". Best for a key definition, a tip, or a common-mistake warning.
```

- [ ] **Step 2: Tighten step discipline**

In the `RULES` section, replace rule 1 and add discipline rules. Change rule 1 to:
```
1. On the FIRST turn, briefly introduce the topic, then create 2-4 cards for Step 1 and connect related ones. Set awaitUser=true, step=1.
```
(unchanged) and add at the end of the rules list:
```
10. STEP DISCIPLINE: steps are strictly sequential — the very first step is 1, and you may only ever increase "step" by exactly 1 when you advance (1→2→3...). Never skip a number and never jump ahead.
11. NEVER re-teach a concept you already covered. Before creating a card, check CARD IDS ALREADY ON CANVAS — do not duplicate an existing card's idea. Each new card must add something new.
12. Keep each step tightly scoped to ONE idea; 2-4 cards per step is plenty.
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean (string-only change).

- [ ] **Step 4: Commit**

```bash
git add app/api/studylab/tutor/route.ts
git commit -m "feat(studylab): teach new card types and enforce sequential step discipline"
```

---

## Self-Review

**Spec coverage (Phase 6 — tutor vocabulary + step discipline):**
- Mermaid diagram card → Task 1 (data/validation) + Task 3 (renderer + dep). ✓
- Worked-example/steps card → Task 1 + Task 2. ✓
- Comparison table card → Task 1 + Task 2. ✓
- Callout/definition card → Task 1 + Task 2. ✓
- Tutor prompt teaches the new cards + runnable-code preference → Task 4. ✓
- Step-numbering/redundant-card fix (the issue flagged during Phase 4 testing) → Task 4 (rules 10-12). ✓

**Documented deviation:** `mermaid` is the one new npm dependency (the spec named Mermaid); it is lazy-loaded so it doesn't weigh on initial load. The checkpoint protocol (Phase 5) already lives in the prompt; this phase only extends rules around it.

**Placeholder scan:** Task 1 and Task 4 carry complete code/text. Tasks 2–3 carry the Mermaid renderer in full and an exact behavior contract for the three pure renderers (icons, variants, table structure) — no hand-waving.

**Type consistency:** `CARD_KINDS` (Task 1) gates `isValidAction` and matches the prompt's `card` enum (Task 4). The `createCard` fields `mermaid`/`steps`/`rows`/`variant` (Task 1) are the same `StudyNodeData` fields the renderers read (Tasks 2–3) and the prompt sets (Task 4). Renderer keys `worked`/`table`/`callout`/`mermaid` match the registry `BlockType`s and `studyNodeTypes` registration.
