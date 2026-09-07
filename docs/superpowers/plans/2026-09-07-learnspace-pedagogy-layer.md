# LearnSpace Pedagogy Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-land the nine Montessori activity patterns on the rewritten tutor, then make the tutor state and defend its teaching intent before any material reaches a student.

**Architecture:** The activity engine is pure `lib/` logic (payload types, a hardened expression parser, declarative success rules, nine pattern modules) plus React renderers, joined to the board by five small hooks in `types.ts`, `blocks.ts`, `actions.ts`, `checkpointState.ts` and the tutor route. On top of that, a `TeachingIntent` — goal, the single quality isolated, the apparatus, and why — is validated against the material the tutor actually built, and a material whose intent does not hold up is refused with a reason rather than shown to a student.

**Tech Stack:** Next.js 16 App Router, React 18, TypeScript strict, vitest (node environment), `@xyflow/react` canvas, AWS Bedrock via `modelForJob()`.

**Spec:** `docs/superpowers/specs/2026-09-07-studylab-composable-material-engine-design.md`

## Global Constraints

- **Phase 1 only.** Phase 2 (the composable vocabulary, interpreter, canon and solvability prover) is deliberately gated on this phase's evidence. Do not build it, do not stub it.
- **vitest node environment only — no jsdom, no `.test.tsx` files.** Renderers cannot be unit-tested; they are verified by driving a real lesson in a browser.
- Live/model tests go in `scripts/live/*.test.ts` and run under `vitest.live.config.ts`; they are excluded from the default suite.
- `npx tsc --noEmit` clean and `npx vitest run` fully green at the end of every task.
- **Local commits only. Never push.**
- Work in the main repo at `c:\Users\Stephen\AI_assessment` — not a worktree. The user watches edits live.
- `migrations/add-learnspace-mode.sql` is unapplied. It must be applied before any browser verification, or the StudyLab hub 500s for every user.
- Browser verification uses an isolated Chrome with its own throwaway `--user-data-dir` and a non-default `--remote-debugging-port` (e.g. 9333), shutting down only the PID it started. **Never `taskkill` or `Stop-Process` any browser.**
- Verify drag with the **mouse** path. Keyboard testing once gave a false pass while mouse drag was entirely dead.
- Model-authored SVG is never rendered. Art is referenced by catalogue name and resolved through `assetUrl()`; an unvalidated `src` is a broken-image, tracking-pixel and SSRF risk.
- Registry lookups use a `Map`, never an object literal — names originate in model output, and an object literal reaches `Object.prototype`, so `__proto__` and `constructor` sail past a `if (!mod)` guard.

## File Structure

**Restored unchanged from `montessori-recovered` (tag `montessori-snapshot-2026-08-20`, commit `e594f43`):**

| Path | Responsibility |
|---|---|
| `lib/studylab/activities/types.ts` | Payload types, `SuccessRule`, `ModelSpec`, `ActivitySpec`, `ActivityState`, `PatternModule` |
| `lib/studylab/activities/expr.ts` | Whitelisted recursive-descent arithmetic parser; no `eval`, fails closed |
| `lib/studylab/activities/success.ts` | Pure evaluation of `SuccessRule` |
| `lib/studylab/activities/validate.ts` | Structural guard `validateSpec()` |
| `lib/studylab/activities/registry.ts` | `Map` of pattern name → module |
| `lib/studylab/activities/assetCatalog.ts` | Named art; `assetNames()`, `assetUrl()`, `assetCatalogPromptBlock()` |
| `lib/studylab/activities/patterns/*.ts` | The nine pattern modules |
| `lib/studylab/activities/{shuffle,motion,telemetry}.ts` | Support |
| `components/studylab/activities/*.tsx` | The nine renderers, `ActivityFrame`, `ActivityNode`, drag/state hooks |
| `migrations/add-learnspace-mode.sql` | `learnspace_mode` column (`classic \| montessori`) |
| `scripts/slice-montessori-assets.js` | Asset slicing tool |
| `public/art/montessori/**` | 196 art files |

**Modified to join the engine to the current board:**

| Path | Change |
|---|---|
| `lib/studylab/types.ts` | `'activity'` in both node-type unions; `spec` / `activityState` on node data; `createActivity` action variant |
| `lib/studylab/blocks.ts` | `'activity'` in `BlockType`; a `BLOCKS` entry. **Not** in `CARD_KINDS` |
| `lib/studylab/actions.ts` | `createActivity` case and its duplicate-prompt guard |
| `lib/studylab/checkpointState.ts` | A solved activity satisfies a checkpoint |
| `lib/studylab/lessonRun.ts` | `mode?: 'classic' \| 'montessori'` on the run |
| `app/api/studylab/tutor/route.ts` | Read `mode` off the request body onto the run |
| `components/studylab/canvasNodes.tsx` | Register `ActivityNode` in `studyNodeTypes` |

**New, this plan's own work:**

| Path | Responsibility |
|---|---|
| `lib/studylab/activities/dimensions.ts` | The closed dimension vocabulary and `dimensionsOf(spec)` |
| `lib/studylab/activities/intent.ts` | `TeachingIntent` and `checkIntent(intent, spec)` |
| `lib/studylab/activities/artMatch.ts` | `unmatchedArt(spec)` — items the catalogue could illustrate but that shipped as bare words |
| `app/api/studylab/tutor/dispatch.ts` | `refuseUnjustifiedActivities()` in the action chain |

---

### Task 1: Restore the activity engine's pure logic

Nothing here touches the board. The deliverable is that the engine's own tests run green inside the current repo, proving the snapshot's logic still compiles against today's TypeScript and vitest.

**Files:**
- Restore: `lib/studylab/activities/**` (all `.ts` and `.test.ts`)
- Restore: `migrations/add-learnspace-mode.sql`, `scripts/slice-montessori-assets.js`, `public/art/montessori/**`

**Interfaces:**
- Consumes: nothing.
- Produces: `ActivitySpec`, `ActivityState`, `SuccessRule`, `PatternModule` from `lib/studylab/activities/types.ts`; `getPatternModule(p)`, `registeredPatterns()` from `registry.ts`; `validateSpec(x): x is ActivitySpec` from `validate.ts`; `assetNames(): string[]`, `assetUrl(name): string | null`, `assetCatalogPromptBlock(): string` from `assetCatalog.ts`; `evaluateExpr(src, vars): number | null` from `expr.ts`.

- [ ] **Step 1: Restore the pure logic and its assets**

```bash
cd "c:/Users/Stephen/AI_assessment"
git checkout montessori-recovered -- lib/studylab/activities
git checkout montessori-recovered -- migrations/add-learnspace-mode.sql
git checkout montessori-recovered -- scripts/slice-montessori-assets.js
git checkout montessori-recovered -- public/art/montessori
```

- [ ] **Step 2: Confirm it compiles against today's TypeScript**

Run: `npx tsc --noEmit`

Expected: PASS. If it fails, the only permitted fixes are type-level — the snapshot's logic is already tested and must not be rewritten here.

- [ ] **Step 3: Run the engine's own tests**

Run: `npx vitest run lib/studylab/activities`

Expected: PASS. These are the snapshot's tests, restored unchanged; they cover `expr`, `success`, `validate`, `assetCatalog`, `motion`, `telemetry` and all nine pattern modules.

- [ ] **Step 4: Run the whole suite to prove nothing else moved**

Run: `npx vitest run`

Expected: PASS, with the total test count higher than before by the restored files' count.

- [ ] **Step 5: Commit**

```bash
git add lib/studylab/activities migrations/add-learnspace-mode.sql scripts/slice-montessori-assets.js public/art/montessori
git commit -m "feat(studylab): restore the activity engine's logic

Recovered from e594f43, orphaned when aws_deploy was reset to origin on
2026-08-20. Pure lib/ only — nothing on the board can reach it yet."
```

---

### Task 2: Join the engine to the board

Five small hooks. After this an activity can exist as a node and satisfy a checkpoint, though nothing draws it yet.

**Files:**
- Modify: `lib/studylab/types.ts`
- Modify: `lib/studylab/blocks.ts`
- Modify: `lib/studylab/actions.ts`
- Modify: `lib/studylab/checkpointState.ts`
- Restore: `lib/studylab/actions.activity.test.ts`, `lib/studylab/checkpointState.activity.test.ts`

**Interfaces:**
- Consumes: `ActivitySpec`, `ActivityState` (Task 1).
- Produces: the `createActivity` action variant, accepted by `applyActions`; `'activity'` as a `BlockType` and node type.

- [ ] **Step 1: Restore the two integration test files, which must fail**

```bash
cd "c:/Users/Stephen/AI_assessment"
git checkout montessori-recovered -- lib/studylab/actions.activity.test.ts
git checkout montessori-recovered -- lib/studylab/checkpointState.activity.test.ts
```

- [ ] **Step 2: Run them to confirm they fail**

Run: `npx vitest run lib/studylab/actions.activity lib/studylab/checkpointState.activity`

Expected: FAIL — `createActivity` is not a known action and `'activity'` is not a node type.

- [ ] **Step 3: Add the node type and action variant to `lib/studylab/types.ts`**

Add the import at the top of the file:

```ts
import type { ActivitySpec, ActivityState } from './activities/types'
```

Add `'activity'` to **both** node-type unions (the `StudyNode['type']` union and the node-data `kind` union), so each reads:

```ts
kind: CardKind | 'stepGroup' | 'image' | 'quiz' | 'checkpointHeader' | 'activity'
```

Add to the node's `data` interface:

```ts
  /** Montessori activity payload (activity nodes only). */
  spec?: ActivitySpec
  /** Persisted student progress within the activity. */
  activityState?: ActivityState
```

Add to the `StudyAction` union, beside `createCard`:

```ts
  | {
      type: 'createActivity'
      id: string
      spec: ActivitySpec
      step?: number
    }
```

- [ ] **Step 4: Add the block definition to `lib/studylab/blocks.ts`**

Add `'activity'` to the `BlockType` union on the tutor-managed line:

```ts
  | 'quiz' | 'checkpointHeader' | 'stepGroup' | 'image' | 'activity'
```

Add to `BLOCKS`:

```ts
  // A Montessori material: bigger than a reading card because the student
  // works inside it. Deliberately absent from CARD_KINDS below — like
  // `question`, there is no createCard that can make one, because a material
  // is validated before it is built, not written freehand.
  activity: def('activity', 'ai', 420, 380),
```

Leave `CARD_KINDS` (line 76) untouched.

- [ ] **Step 5: Handle the action in `lib/studylab/actions.ts`**

Add above the reducer:

```ts
// Find an existing, visible activity node whose spec prompt (trimmed,
// case-insensitive) matches. The tutor re-emits an activity it has already
// built when a turn is retried, and the prompt text is the only reliable
// signal that this is "the same activity" rather than a new one.
function findActivityByPrompt(nodes: StudyNode[], prompt: string): StudyNode | undefined {
  const p = prompt.trim().toLowerCase()
  return nodes.find(
    (n) => n.type === 'activity' && !n.hidden && (n.data.spec?.prompt ?? '').trim().toLowerCase() === p,
  )
}
```

Add the case to the reducer's switch:

```ts
      case 'createActivity': {
        // A duplicate turn must not leave two identical materials on the board.
        // Zoom to the existing one instead of producing a blank turn, so "see
        // the activity" still lands.
        const dupe = findActivityByPrompt(nodes, action.spec.prompt)
        if (dupe) {
          focusId = dupe.id
          break
        }
        const step = action.step ?? currentStep
        nodes = [
          ...nodes,
          {
            id: action.id,
            type: 'activity',
            position: autoPosition(nodes, step, 'activity'),
            data: {
              kind: 'activity',
              title: action.spec.prompt,
              step,
              spec: action.spec,
              activityState: {
                status: 'untouched',
                attempts: 0,
                hintsUsed: 0,
                elapsedMs: 0,
                rejectedMoves: [],
                work: {},
              },
            },
          },
        ]
        focusId = action.id
        break
      }
```

- [ ] **Step 6: Let a solved activity satisfy a checkpoint in `lib/studylab/checkpointState.ts`**

In `summarizeCheckpoints`, add a second loop **after** the existing quiz loop and
**before** the `return`, which currently reads
`return [...byId.values()].sort((a, b) => a.step - b.step)`:

```ts
  // A solved activity can stand in for a checkpoint, so Montessori lessons gate
  // on DOING rather than on answering an MCQ. Shape is identical to a quiz row,
  // so the gap map and gating pipelines need no changes.
  for (const n of nodes) {
    if (n.type !== 'activity') continue
    const cpId = n.data.spec?.satisfiesCheckpoint
    if (!cpId || typeof cpId !== 'string') continue
    const solved = n.data.activityState?.status === 'solved'
    const row = byId.get(cpId) ?? {
      id: cpId,
      step: n.data.step ?? 0,
      total: 0,
      answered: 0,
      correct: 0,
      done: true,
    }
    row.total += 1
    if (solved) {
      row.answered += 1
      row.correct += 1
    } else {
      row.done = false
    }
    byId.set(cpId, row)
  }
```

Do **not** restore this file wholesale from the snapshot — the surrounding
quiz logic has moved since, and only this block is new.

- [ ] **Step 7: Run the integration tests**

Run: `npx vitest run lib/studylab/actions.activity lib/studylab/checkpointState.activity`

Expected: PASS.

- [ ] **Step 8: Run the whole suite**

Run: `npx tsc --noEmit && npx vitest run`

Expected: both PASS.

- [ ] **Step 9: Commit**

```bash
git add lib/studylab/types.ts lib/studylab/blocks.ts lib/studylab/actions.ts lib/studylab/checkpointState.ts lib/studylab/actions.activity.test.ts lib/studylab/checkpointState.activity.test.ts
git commit -m "feat(studylab): an activity can live on the board

Five hooks: the node type, the block, the createActivity action and its
duplicate guard, and a solved activity satisfying a checkpoint. Kept out
of CARD_KINDS on purpose — a material is validated before it is built,
so there must be no createCard that can make one."
```

---

### Task 3: Restore the renderers, and fix the two bugs that make them untestable

Two of the four outstanding bugs block every subsequent judgement about whether the teaching is any good, so they are fixed here rather than left on a list.

**Files:**
- Restore: `components/studylab/activities/**`, `app/dev/activities/page.tsx`
- Modify: `components/studylab/activities/{BalanceActivity,CompareActivity,ComposeActivity,LabelActivity,SequenceActivity,SortActivity,ThreePeriodActivity}.tsx`
- Modify: `components/studylab/canvasNodes.tsx`
- Modify: `lib/studylab/lessonRun.ts`
- Modify: `app/api/studylab/tutor/route.ts`

**Interfaces:**
- Consumes: `'activity'` node type (Task 2), `ActivitySpec` (Task 1).
- Produces: a rendered, draggable activity node on the canvas.

- [ ] **Step 1: Restore the renderers**

```bash
cd "c:/Users/Stephen/AI_assessment"
git checkout montessori-recovered -- components/studylab/activities
git checkout montessori-recovered -- app/dev/activities/page.tsx
```

- [ ] **Step 2: Remove `layout` from every draggable piece**

`framer-motion`'s `layout` prop animates an element whenever its bounding box changes. React Flow transforms an ancestor on every canvas pan and zoom, so every piece's box changes and `layout` springs each one — which is why a dragged piece "moves haphazardly" instead of tracking the cursor, and why pieces "follow loosely" when the card itself is dragged. Both reported symptoms are this one cause.

Delete the `layout` prop (and only that prop — keep `initial` and `animate`, which are enter animations and are fine) at each of these sites:

- `BalanceActivity.tsx:44`
- `CompareActivity.tsx:53`
- `ComposeActivity.tsx:140`
- `LabelActivity.tsx:120`
- `SequenceActivity.tsx:73`
- `SortActivity.tsx:76` and `SortActivity.tsx:103`
- `ThreePeriodActivity.tsx:128`

Verify none remain:

Run: `npx grep -rn "layout" components/studylab/activities || rg -n "\blayout\b" components/studylab/activities`

Expected: no `layout` prop on a motion element.

- [ ] **Step 3: Let the pans grow instead of scrolling**

`BalanceActivity` (~line 155 and ~line 176) and `CompareActivity` (~line 109) put content in fixed-height absolutely-positioned boxes with `overflow-y-auto`, so pieces hide behind a scrollbar and overlap the beam. Replace the fixed height and `overflow-y-auto` on those three containers with a flex-wrap column that grows:

```tsx
className="flex min-h-[96px] flex-wrap content-start gap-2 p-2"
```

Remove the `absolute`/fixed-height positioning on those containers so the surrounding layout reflows around them.

- [ ] **Step 4: Register the renderer in `components/studylab/canvasNodes.tsx`**

The canvas reads its renderers from `studyNodeTypes` (line 118), which
`StudyCanvas.tsx` casts to React Flow's `NodeTypes` — not from `Workspace.tsx`.

Add the import at the top:

```tsx
import { ActivityNode } from './activities/ActivityNode'
```

Add the entry to `studyNodeTypes`, beside `quiz`:

```tsx
  activity: ActivityNode,
```

The map is typed `Partial<Record<BlockType, ComponentType<NodeProps>>>`, so this
only compiles once `'activity'` is a `BlockType` — which Task 2 Step 4 did.

- [ ] **Step 5: Carry the mode on the run, so the teaching turn can see it**

Reading the mode off the request is not enough — `buildTeachPrompt` (Task 8)
needs it, and it reaches that only through the run.

Add to `LessonRun` in `lib/studylab/lessonRun.ts`, beside `programming`:

```ts
  /**
   * Which kind of lesson this is, fixed when the space is created.
   *
   * Undefined on a run stored before Montessori mode existed, and read as
   * 'classic' everywhere, so an old lesson keeps behaving exactly as it did.
   */
  mode?: 'classic' | 'montessori'
```

In `app/api/studylab/tutor/route.ts`, read it off the body and put it on the run
before dispatching, beside the other body reads:

```ts
    const mode: 'classic' | 'montessori' = body?.mode === 'montessori' ? 'montessori' : 'classic'
```

```ts
    run = { ...run, mode }
```

Everything downstream tests `run.mode === 'montessori'`, never a bare `mode`
variable, so a run loaded from storage behaves the same as one just built.

- [ ] **Step 6: Type check and run the suite**

Run: `npx tsc --noEmit && npx vitest run`

Expected: both PASS.

- [ ] **Step 7: Apply the migration, which everything after this depends on**

```bash
cd "c:/Users/Stephen/AI_assessment"
node -e "const fs=require('fs');const {Client}=require('pg');const env=fs.readFileSync('.env','utf8');const u=(env.match(/^DATABASE_URL\s*=\s*(.*)$/m)||[])[1].trim().replace(/^[\"']|[\"']$/g,'');const c=new Client({connectionString:u,ssl:{rejectUnauthorized:false}});c.connect().then(()=>c.query(fs.readFileSync('migrations/add-learnspace-mode.sql','utf8'))).then(()=>{console.log('applied');return c.end()}).catch(e=>{console.error(e.message);process.exit(1)})"
```

Expected: `applied`. Without this the StudyLab hub 500s for every user.

- [ ] **Step 8: Verify the drag in a browser, with the mouse**

Start the dev server, then launch an isolated Chrome:

```bash
npx next dev
```

```bash
"C:/Program Files/Google/Chrome/Application/chrome.exe" --user-data-dir="C:/Users/Stephen/AppData/Local/Temp/claude-chrome-montessori" --remote-debugging-port=9333 "http://localhost:3000/dev/activities"
```

On `/dev/activities`, for **each** of the nine patterns: drag a piece with the mouse from its start to a target. Confirm the piece tracks the cursor exactly, does not spring, and does not drift when the canvas is panned. Then pan the canvas mid-drag and confirm the piece stays under the cursor.

`compare`, `label` and `balance` have never been browser-verified at all — only read. Give them the most attention.

Shut down only the Chrome PID you started. Never `taskkill`.

- [ ] **Step 9: Commit**

```bash
git add components/studylab/activities app/dev/activities/page.tsx components/studylab/canvasNodes.tsx lib/studylab/lessonRun.ts app/api/studylab/tutor/route.ts
git commit -m "fix(studylab): a dragged piece tracks the cursor

framer-motion's layout prop animates on any bounding-box change, and
React Flow transforms an ancestor on every pan — so every piece sprang
on every frame. One cause behind both reported symptoms. Balance and
compare pans now grow instead of hiding content behind a scrollbar."
```

---

### Task 4: The dimension vocabulary

`isolates` has to name something from a closed set, or the check degenerates into comparing two pieces of free text.

**Files:**
- Create: `lib/studylab/activities/dimensions.ts`
- Test: `lib/studylab/activities/dimensions.test.ts`

**Interfaces:**
- Consumes: `ActivitySpec` (Task 1).
- Produces: `type Dimension`, `DIMENSIONS: readonly Dimension[]`, `dimensionsOf(spec: ActivitySpec): Dimension[]`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/studylab/activities/dimensions.test.ts
import { describe, it, expect } from 'vitest'
import { DIMENSIONS, dimensionsOf } from './dimensions'
import type { ActivitySpec } from './types'

const spec = (pattern: string, payload: unknown): ActivitySpec =>
  ({ pattern, prompt: 'p', payload, success: { kind: 'exactSet', itemIds: [] } }) as ActivitySpec

describe('dimensionsOf', () => {
  it('names what a sorting frame varies', () => {
    expect(
      dimensionsOf(spec('sort', {
        bins: [{ id: 'b1', label: 'Metal' }, { id: 'b2', label: 'Non-metal' }],
        items: [{ id: 'i1', label: 'Iron', binId: 'b1' }, { id: 'i2', label: 'Sulfur', binId: 'b2' }],
      })),
    ).toEqual(['category'])
  })

  it('names what a balance varies', () => {
    expect(
      dimensionsOf(spec('balance', {
        left: [], right: [], mode: 'weights',
        pool: [{ id: 'p1', label: '3', weight: 3 }, { id: 'p2', label: '5', weight: 5 }],
      })),
    ).toEqual(['quantity'])
  })

  it('reads the balance mode, because an equation varies structure not quantity', () => {
    expect(
      dimensionsOf(spec('balance', { left: [], right: [], pool: [], mode: 'equation' })),
    ).toEqual(['structure'])
  })

  it('names what a two-set comparison varies', () => {
    expect(
      dimensionsOf(spec('compare', {
        sets: [{ id: 'a', label: 'Plant' }, { id: 'b', label: 'Animal' }],
        items: [
          { id: 'i1', label: 'Cell wall', belongs: 'left' },
          { id: 'i2', label: 'Nucleus', belongs: 'both' },
        ],
      })),
    ).toEqual(['membership'])
  })

  it('says a sorting frame with one bin varies nothing', () => {
    // The degenerate material: every item goes in the same place, so there is
    // no decision to make. Without this it would pass the intent check on the
    // strength of its pattern name alone.
    expect(
      dimensionsOf(spec('sort', {
        bins: [{ id: 'b1', label: 'Metal' }],
        items: [{ id: 'i1', label: 'Iron', binId: 'b1' }, { id: 'i2', label: 'Tin', binId: 'b1' }],
      })),
    ).toEqual([])
  })

  it('says a balance whose weights are all equal varies nothing', () => {
    expect(
      dimensionsOf(spec('balance', {
        left: [], right: [], mode: 'weights',
        pool: [{ id: 'p1', label: '4', weight: 4 }, { id: 'p2', label: '4', weight: 4 }],
      })),
    ).toEqual([])
  })

  it('says a slider that cannot move varies nothing', () => {
    expect(
      dimensionsOf(spec('vary', { variable: { id: 'v', label: 'x', min: 5, max: 5, step: 1 } })),
    ).toEqual([])
  })

  it('says a single card names nothing', () => {
    expect(dimensionsOf(spec('threePeriod', { items: [{ id: 'i1', label: 'Neuron' }] }))).toEqual([])
  })

  it('covers every registered pattern when the payload is non-degenerate', () => {
    // A pattern with no dimension could never state what it isolates, so it
    // could never pass the intent check and would be silently unusable.
    const two = [{ id: 'a' }, { id: 'b' }]
    const payloads: Record<string, unknown> = {
      threePeriod: { items: two },
      sort: { bins: two, items: [{ id: 'i1', binId: 'a' }, { id: 'i2', binId: 'b' }] },
      label: { hotspots: two },
      sequence: { items: two },
      vary: { variable: { min: 0, max: 10 } },
      balance: { mode: 'weights', pool: [{ weight: 1 }, { weight: 2 }], left: [], right: [] },
      compare: { items: [{ belongs: 'left' }, { belongs: 'right' }] },
      scenario: { choices: two },
      compose: { parts: two },
    }
    for (const [pattern, payload] of Object.entries(payloads)) {
      expect(dimensionsOf(spec(pattern, payload)).length, pattern).toBe(1)
    }
  })

  it('only ever returns names from the closed vocabulary', () => {
    for (const pattern of ['sort', 'balance', 'vary', 'compose']) {
      for (const d of dimensionsOf(spec(pattern, { mode: 'equation' }))) {
        expect(DIMENSIONS).toContain(d)
      }
    }
  })

  it('never throws on a malformed payload', () => {
    expect(dimensionsOf(spec('sort', null))).toEqual([])
    expect(dimensionsOf({} as never)).toEqual([])
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/studylab/activities/dimensions`

Expected: FAIL — `Failed to resolve import "./dimensions"`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/studylab/activities/dimensions.ts
import type { ActivitySpec } from './types'

/**
 * What a material can vary, as a closed vocabulary.
 *
 * The Montessori principle this serves is isolation of a single quality: the
 * pink tower varies size and nothing else — not colour, not shape, not
 * material. Enforcing that needs both halves of the comparison to be drawn
 * from the same fixed set, or checking "what you said you isolate" against
 * "what this material varies" is just comparing two pieces of free text.
 */
export type Dimension =
  | 'identity'     // which thing this is — naming
  | 'category'     // which group it belongs to
  | 'order'        // where it comes in a sequence
  | 'position'     // where it sits in space
  | 'quantity'     // how much
  | 'magnitude'    // how much, continuously varied by the student
  | 'membership'   // which set, or both
  | 'consequence'  // what follows from a choice
  | 'structure'    // how parts join

export const DIMENSIONS: readonly Dimension[] = [
  'identity', 'category', 'order', 'position',
  'quantity', 'magnitude', 'membership', 'consequence', 'structure',
]

const list = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object') : []

/** How many different values a field takes across a list of pieces. */
const spread = (items: Record<string, unknown>[], field: string): number =>
  new Set(items.map((i) => i[field])).size

/**
 * What this material actually varies, read off the payload rather than from
 * anything the tutor claimed.
 *
 * Nine patterns each vary one thing by construction — that is what made them
 * teachable in the first place. `balance` is the exception: it varies quantity
 * when weighing and structure when balancing an equation, and `mode` says which.
 *
 * A pattern only counts as varying its dimension if the payload genuinely
 * does. A sorting frame whose items all go in one bin varies nothing, and a
 * three-period card with a single item names nothing — both are degenerate
 * materials that would otherwise sail through the intent check by virtue of
 * their pattern name alone. Returning `[]` makes them unjustifiable.
 */
export function dimensionsOf(spec: ActivitySpec): Dimension[] {
  const p = (spec?.payload ?? {}) as Record<string, unknown>
  switch (spec?.pattern) {
    case 'threePeriod':
      return list(p.items).length >= 2 ? ['identity'] : []
    case 'sort':
      return list(p.bins).length >= 2 && spread(list(p.items), 'binId') >= 2 ? ['category'] : []
    case 'label':
      return list(p.hotspots).length >= 2 ? ['position'] : []
    case 'sequence':
      return list(p.items).length >= 2 ? ['order'] : []
    case 'compare':
      return spread(list(p.items), 'belongs') >= 2 ? ['membership'] : []
    case 'scenario':
      return list(p.choices).length >= 2 ? ['consequence'] : []
    case 'compose':
      return list(p.parts).length >= 2 ? ['structure'] : []
    case 'vary': {
      const v = (p.variable ?? {}) as Record<string, unknown>
      return Number(v.max) > Number(v.min) ? ['magnitude'] : []
    }
    case 'balance': {
      if (p.mode === 'equation') return ['structure']
      const pool = [...list(p.pool), ...list(p.left), ...list(p.right)]
      return spread(pool, 'weight') >= 2 ? ['quantity'] : []
    }
    default:
      return []
  }
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run lib/studylab/activities/dimensions`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/studylab/activities/dimensions.ts lib/studylab/activities/dimensions.test.ts
git commit -m "feat(studylab): name what a material varies, from a closed set

Isolation of a single quality only becomes checkable when both halves of
the comparison come from the same fixed vocabulary."
```

---

### Task 5: The teaching intent, and checking it against the material

**Files:**
- Create: `lib/studylab/activities/intent.ts`
- Test: `lib/studylab/activities/intent.test.ts`

**Interfaces:**
- Consumes: `dimensionsOf`, `Dimension`, `DIMENSIONS` (Task 4); `ActivitySpec` (Task 1).
- Produces: `interface TeachingIntent { goal: string; isolates: Dimension; apparatus: string; why: string }`; `parseIntent(raw: unknown): TeachingIntent | null`; `checkIntent(intent: TeachingIntent, spec: ActivitySpec): { ok: true } | { ok: false; reason: string }`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/studylab/activities/intent.test.ts
import { describe, it, expect } from 'vitest'
import { parseIntent, checkIntent } from './intent'
import type { ActivitySpec } from './types'

const sortSpec = {
  pattern: 'sort',
  prompt: 'Sort the elements',
  payload: {
    bins: [{ id: 'b1', label: 'Metal' }, { id: 'b2', label: 'Non-metal' }],
    items: [{ id: 'i1', label: 'Iron', binId: 'b1' }],
  },
  success: { kind: 'binAssignment', assign: { i1: 'b1' } },
} as unknown as ActivitySpec

const intent = {
  goal: 'Tell metals from non-metals by their properties.',
  isolates: 'category',
  apparatus: 'sorting-frame',
  why: 'Sorting makes the grouping decision the whole of the work.',
}

describe('parseIntent', () => {
  it('reads a well-formed intent', () => {
    expect(parseIntent(intent)?.isolates).toBe('category')
  })

  it('refuses a dimension outside the vocabulary', () => {
    // "understanding" is not a quality a material can vary.
    expect(parseIntent({ ...intent, isolates: 'understanding' })).toBeNull()
  })

  it('refuses a goal or a reason that says nothing', () => {
    expect(parseIntent({ ...intent, goal: '' })).toBeNull()
    expect(parseIntent({ ...intent, why: '   ' })).toBeNull()
  })

  it('never throws on whatever the model sent', () => {
    expect(parseIntent(null)).toBeNull()
    expect(parseIntent('category')).toBeNull()
    expect(parseIntent({})).toBeNull()
  })
})

describe('checkIntent', () => {
  it('passes when the claim matches the material', () => {
    expect(checkIntent(parseIntent(intent)!, sortSpec)).toEqual({ ok: true })
  })

  it('refuses a claim the material does not support', () => {
    // Claiming to teach quantity with a sorting frame is the exact failure this
    // exists to catch: the material is fine, the teaching reason is invented.
    const wrong = parseIntent({ ...intent, isolates: 'quantity' })!
    const result = checkIntent(wrong, sortSpec)
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.reason).toContain('category')
  })

  it('names both sides in the reason, so the tutor can act on it', () => {
    const wrong = parseIntent({ ...intent, isolates: 'order' })!
    const result = checkIntent(wrong, sortSpec)
    expect(result.ok === false && result.reason).toContain('order')
    expect(result.ok === false && result.reason).toContain('sort')
  })

  it('refuses a pattern with no dimensions at all', () => {
    const unknown = { ...sortSpec, pattern: 'nonsense' } as unknown as ActivitySpec
    expect(checkIntent(parseIntent(intent)!, unknown).ok).toBe(false)
  })

  it('refuses a material where nothing actually varies', () => {
    // A sorting frame with one bin: correctly shaped, correctly named, and
    // there is no decision in it. The pattern name alone must not carry it.
    const degenerate = {
      ...sortSpec,
      payload: {
        bins: [{ id: 'b1', label: 'Metal' }],
        items: [{ id: 'i1', label: 'Iron', binId: 'b1' }, { id: 'i2', label: 'Tin', binId: 'b1' }],
      },
    } as unknown as ActivitySpec
    const result = checkIntent(parseIntent(intent)!, degenerate)
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.reason).toMatch(/varies nothing/)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/studylab/activities/intent`

Expected: FAIL — `Failed to resolve import "./intent"`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/studylab/activities/intent.ts
import type { ActivitySpec } from './types'
import { DIMENSIONS, dimensionsOf, type Dimension } from './dimensions'

/**
 * What the tutor is trying to teach, stated before the material is built.
 *
 * The nine patterns gave the tutor no reasoning step at all — it picked a name
 * and filled the blanks, which is why it reached for `sort` and `threePeriod`
 * regardless of topic. Requiring the reason first is cheap; requiring it to be
 * *true of the material* is what makes it more than a comment.
 */
export interface TeachingIntent {
  /** What the student should be able to do afterwards, in one sentence. */
  goal: string
  /** The single quality this material varies. */
  isolates: Dimension
  /** Which apparatus, by name. */
  apparatus: string
  /** Why this apparatus suits this goal. */
  why: string
}

const said = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

/** Narrows model output to an intent, without trusting its shape. */
export function parseIntent(raw: unknown): TeachingIntent | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>

  const goal = said(r.goal)
  const apparatus = said(r.apparatus)
  const why = said(r.why)
  const isolates = said(r.isolates) as Dimension

  if (!goal || !apparatus || !why) return null
  if (!DIMENSIONS.includes(isolates)) return null

  return { goal: goal.slice(0, 300), isolates, apparatus: apparatus.slice(0, 60), why: why.slice(0, 300) }
}

/**
 * Whether the stated intent is true of the material that was actually built.
 *
 * A refusal is a value carrying a reason the tutor can act on, matching
 * `lib/studylab/lessonRun.ts`. Telling it only that the turn failed produces
 * the same turn again.
 */
export function checkIntent(
  intent: TeachingIntent,
  spec: ActivitySpec,
): { ok: true } | { ok: false; reason: string } {
  const varies = dimensionsOf(spec)

  if (varies.length === 0) {
    return {
      ok: false,
      reason:
        `This "${spec.pattern}" material varies nothing the student can act on — every piece ` +
        `takes the same value, so there is no decision to make. Give it at least two that differ.`,
    }
  }
  if (!varies.includes(intent.isolates)) {
    return {
      ok: false,
      reason:
        `You said this isolates ${intent.isolates}, but a "${spec.pattern}" material varies ` +
        `${varies.join(' and ')}. Either build a material that varies ${intent.isolates}, ` +
        `or say what this one actually teaches.`,
    }
  }
  return { ok: true }
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run lib/studylab/activities/intent`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/studylab/activities/intent.ts lib/studylab/activities/intent.test.ts
git commit -m "feat(studylab): the tutor states what it is teaching, and is held to it

A stated reason that nothing checks is a comment. This one is compared
against the material actually built, and a mismatch is refused with a
reason specific enough to retry against."
```

---

### Task 6: Close the two authoring faults that produce a dead material

Two of the four outstanding bugs are cases where a student meets material that cannot work. Both become structural checks here rather than prompt requests — a soft prompt preference has lost to surrounding instructions every time in this codebase.

**Files:**
- Create: `lib/studylab/activities/artMatch.ts`
- Test: `lib/studylab/activities/artMatch.test.ts`
- Modify: `lib/studylab/activities/patterns/compose.ts`
- Modify: `lib/studylab/activities/patterns/compose.test.ts`

**Interfaces:**
- Consumes: `assetNames()` from `assetCatalog.ts` (Task 1); `ActivitySpec` (Task 1).
- Produces: `unmatchedArt(spec: ActivitySpec): string[]`; a hardened `composeModule.isPayload`.

- [ ] **Step 1: Write the failing test for the art gap**

```ts
// lib/studylab/activities/artMatch.test.ts
import { describe, it, expect } from 'vitest'
import { unmatchedArt } from './artMatch'
import type { ActivitySpec } from './types'

const threePeriod = (items: { id: string; label: string; imageUrl?: string }[]) =>
  ({ pattern: 'threePeriod', prompt: 'p', payload: { items, phases: ['present'] },
     success: { kind: 'exactSet', itemIds: [] } }) as unknown as ActivitySpec

describe('unmatchedArt', () => {
  it('catches a word where the catalogue holds a picture', () => {
    // The reported bug: a threePeriod lesson showed the WORD "Neuron" and then
    // asked the student to pick the WORD "Neuron", though `neuron` is in the
    // catalogue. Words-to-words is not a Montessori material.
    expect(unmatchedArt(threePeriod([{ id: 'i1', label: 'Neuron' }]))).toContain('Neuron')
  })

  it('is quiet when the art is already there', () => {
    expect(unmatchedArt(threePeriod([{ id: 'i1', label: 'Neuron', imageUrl: 'neuron' }]))).toEqual([])
  })

  it('is quiet when the catalogue genuinely has nothing', () => {
    // Rejecting a material because we lack art for it would make whole topics
    // unteachable. Only an exact catalogue match counts.
    expect(unmatchedArt(threePeriod([{ id: 'i1', label: 'Marginal propensity to consume' }]))).toEqual([])
  })

  it('matches case and plural insensitively', () => {
    expect(unmatchedArt(threePeriod([{ id: 'i1', label: 'neurons' }]))).toContain('neurons')
  })

  it('never throws on a malformed payload', () => {
    expect(unmatchedArt({ pattern: 'sort', payload: null } as unknown as ActivitySpec)).toEqual([])
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/studylab/activities/artMatch`

Expected: FAIL — `Failed to resolve import "./artMatch"`.

- [ ] **Step 3: Write the art-gap implementation**

```ts
// lib/studylab/activities/artMatch.ts
import type { ActivitySpec } from './types'
import { assetNames } from './assetCatalog'

/**
 * Items shown as bare words that the catalogue could have illustrated.
 *
 * A threePeriod lesson showed the WORD "Neuron" and asked the student to pick
 * the WORD "Neuron", while `neuron` sat unused in the catalogue. That is a
 * matching game, not a Montessori material: the whole method is concrete
 * before abstract, and a word is not concrete.
 *
 * Deliberately conservative — only an exact match after normalising counts.
 * Rejecting a material because we happen to lack art for its topic would make
 * whole subjects unteachable, which is a worse failure than a plain label.
 */
const normalise = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '').replace(/s$/, '')

export function unmatchedArt(spec: ActivitySpec): string[] {
  const payload = spec?.payload as Record<string, unknown> | null | undefined
  if (!payload || typeof payload !== 'object') return []

  const catalogue = new Set(assetNames().map(normalise))
  const gaps: string[] = []

  for (const key of ['items', 'pool', 'parts']) {
    const list = payload[key]
    if (!Array.isArray(list)) continue
    for (const raw of list) {
      if (!raw || typeof raw !== 'object') continue
      const item = raw as { label?: unknown; imageUrl?: unknown }
      if (typeof item.imageUrl === 'string' && item.imageUrl.trim()) continue
      const label = typeof item.label === 'string' ? item.label : ''
      if (label && catalogue.has(normalise(label))) gaps.push(label)
    }
  }
  return gaps
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run lib/studylab/activities/artMatch`

Expected: PASS.

- [ ] **Step 5: Write the failing test for compose's unresolvable joins**

Append to `lib/studylab/activities/patterns/compose.test.ts`:

```ts
describe('composeModule.isPayload — joins that can never happen', () => {
  it('refuses a validJoins entry naming a part that does not exist', () => {
    // `validJoins` names part ids. Nothing checked that they resolve, so one
    // mistyped id meant no bond was ever legal — the student sat in front of a
    // material that could not be completed, with no feedback at all.
    expect(
      composeModule.isPayload({
        parts: [{ id: 'h1', label: 'H', slots: 1 }, { id: 'o1', label: 'O', slots: 2 }],
        validJoins: [{ a: 'h1', b: 'o2' }],
      }),
    ).toBe(false)
  })

  it('accepts joins whose ids all resolve', () => {
    expect(
      composeModule.isPayload({
        parts: [{ id: 'h1', label: 'H', slots: 1 }, { id: 'o1', label: 'O', slots: 2 }],
        validJoins: [{ a: 'h1', b: 'o1' }],
      }),
    ).toBe(true)
  })

  it('refuses a payload with no legal join at all', () => {
    expect(
      composeModule.isPayload({
        parts: [{ id: 'h1', label: 'H', slots: 1 }],
        validJoins: [],
      }),
    ).toBe(false)
  })
})
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npx vitest run lib/studylab/activities/patterns/compose`

Expected: FAIL — the mistyped-id payload is currently accepted.

- [ ] **Step 7: Harden `isPayload` in `lib/studylab/activities/patterns/compose.ts`**

Inside `composeModule.isPayload`, after the existing structural checks on `parts` and `validJoins`, add:

```ts
    // Every join must name parts that exist. Nothing checked this, so a single
    // mistyped id produced a material where no bond was ever legal and nothing
    // said so — the student cannot finish and cannot tell why.
    const ids = new Set(p.parts.map((part) => part.id))
    if (!p.validJoins.every((j) => ids.has(j.a) && ids.has(j.b))) return false
    // A material with no legal join cannot be completed either.
    if (p.validJoins.length === 0) return false
```

- [ ] **Step 8: Run the compose tests**

Run: `npx vitest run lib/studylab/activities/patterns/compose`

Expected: PASS.

- [ ] **Step 9: Run the whole suite**

Run: `npx tsc --noEmit && npx vitest run`

Expected: both PASS.

- [ ] **Step 10: Commit**

```bash
git add lib/studylab/activities/artMatch.ts lib/studylab/activities/artMatch.test.ts lib/studylab/activities/patterns/compose.ts lib/studylab/activities/patterns/compose.test.ts
git commit -m "fix(studylab): two materials a student could never complete

compose accepted validJoins naming parts that do not exist, so one typo
meant no bond was ever legal and nothing reported it. And a word where
the catalogue holds a picture is a matching game, not a material — both
are now structural checks, because a prompt preference has lost to the
surrounding instructions every time."
```

---

### Task 7: Refuse a material the tutor cannot justify

The checks exist; this is where they stand between the model and the student.

**Files:**
- Modify: `app/api/studylab/tutor/dispatch.ts`
- Test: `app/api/studylab/tutor/dispatch.intent.test.ts`

**Interfaces:**
- Consumes: `parseIntent`, `checkIntent` (Task 5); `unmatchedArt` (Task 6); `validateSpec` (Task 1).
- Produces: `refuseUnjustifiedActivities(actions: unknown[]): { kept: unknown[]; refused: string[] }`, exported from `dispatch.ts` for testing and called inside `fitCardsToLesson`.

- [ ] **Step 1: Write the failing test**

```ts
// app/api/studylab/tutor/dispatch.intent.test.ts
import { describe, it, expect } from 'vitest'
import { refuseUnjustifiedActivities } from './dispatch'

const spec = {
  pattern: 'sort',
  prompt: 'Sort the elements',
  payload: {
    bins: [{ id: 'b1', label: 'Metal' }, { id: 'b2', label: 'Non-metal' }],
    items: [{ id: 'i1', label: 'Iron', binId: 'b1', imageUrl: 'iron' }],
  },
  success: { kind: 'binAssignment', assign: { i1: 'b1' } },
}

const intent = {
  goal: 'Tell metals from non-metals.',
  isolates: 'category',
  apparatus: 'sorting-frame',
  why: 'Sorting makes the grouping decision the whole of the work.',
}

describe('refuseUnjustifiedActivities', () => {
  it('lets a justified material through', () => {
    const { kept, refused } = refuseUnjustifiedActivities([{ type: 'createActivity', id: 'a1', intent, spec }])
    expect(kept).toHaveLength(1)
    expect(refused).toEqual([])
  })

  it('refuses a material with no intent at all', () => {
    const { kept, refused } = refuseUnjustifiedActivities([{ type: 'createActivity', id: 'a1', spec }])
    expect(kept).toEqual([])
    expect(refused[0]).toMatch(/intent/i)
  })

  it('refuses a reason the material does not support', () => {
    const { kept, refused } = refuseUnjustifiedActivities([
      { type: 'createActivity', id: 'a1', intent: { ...intent, isolates: 'quantity' }, spec },
    ])
    expect(kept).toEqual([])
    expect(refused[0]).toContain('quantity')
  })

  it('refuses a structurally invalid spec before it reaches the intent check', () => {
    const { kept, refused } = refuseUnjustifiedActivities([
      { type: 'createActivity', id: 'a1', intent, spec: { pattern: 'sort' } },
    ])
    expect(kept).toEqual([])
    expect(refused[0]).toMatch(/spec/i)
  })

  it('refuses words where the catalogue holds pictures', () => {
    const wordy = {
      ...spec,
      pattern: 'threePeriod',
      payload: { items: [{ id: 'i1', label: 'Neuron' }], phases: ['present'] },
      success: { kind: 'exactSet', itemIds: ['i1'] },
    }
    const { kept, refused } = refuseUnjustifiedActivities([
      { type: 'createActivity', id: 'a1', intent: { ...intent, isolates: 'identity' }, spec: wordy },
    ])
    expect(kept).toEqual([])
    expect(refused[0]).toContain('Neuron')
  })

  it('leaves every other action untouched', () => {
    const others = [{ type: 'createCard', card: 'concept', id: 'c1' }, { type: 'connect', source: 'a', target: 'b' }]
    expect(refuseUnjustifiedActivities(others).kept).toEqual(others)
  })

  it('strips the intent before the action reaches the board', () => {
    // The intent is why the material exists, not part of it. Leaving it on the
    // action would put it in the node's data and eventually on screen.
    const { kept } = refuseUnjustifiedActivities([{ type: 'createActivity', id: 'a1', intent, spec }])
    expect(kept[0]).not.toHaveProperty('intent')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run app/api/studylab/tutor/dispatch.intent`

Expected: FAIL — `refuseUnjustifiedActivities` is not exported.

- [ ] **Step 3: Implement it in `app/api/studylab/tutor/dispatch.ts`**

Add the imports beside the existing ones:

```ts
import { validateSpec } from '@/lib/studylab/activities/validate'
import { parseIntent, checkIntent } from '@/lib/studylab/activities/intent'
import { unmatchedArt } from '@/lib/studylab/activities/artMatch'
```

Add the function beside `coerceCardAction`:

```ts
/**
 * Drops any material the tutor could not justify, and says why.
 *
 * Every other check in this chain repairs what the model got wrong. This one
 * cannot: a material whose stated reason does not match what it varies is not
 * a formatting fault, it is the tutor reaching for the apparatus it always
 * reaches for and inventing a rationale afterwards. The refusal carries the
 * mismatch so the next turn has something to act on — telling it only that the
 * turn failed produces the same turn again.
 */
export function refuseUnjustifiedActivities(actions: unknown[]): {
  kept: unknown[]
  refused: string[]
} {
  const kept: unknown[] = []
  const refused: string[] = []

  for (const raw of actions) {
    if (!raw || typeof raw !== 'object' || (raw as Record<string, unknown>).type !== 'createActivity') {
      kept.push(raw)
      continue
    }
    const a = raw as Record<string, unknown>

    if (!validateSpec(a.spec)) {
      refused.push('The activity spec was malformed, so nothing was built.')
      continue
    }
    const intent = parseIntent(a.intent)
    if (!intent) {
      refused.push(
        'Every material needs an intent: goal, the single quality it isolates, the apparatus, and why.',
      )
      continue
    }
    const verdict = checkIntent(intent, a.spec)
    if (!verdict.ok) {
      refused.push(verdict.reason)
      continue
    }
    const wordy = unmatchedArt(a.spec)
    if (wordy.length > 0) {
      refused.push(
        `These are shown as words but the catalogue has pictures for them: ${wordy.join(', ')}. ` +
          `Set imageUrl to the catalogue name — a word matched against a word is not a material.`,
      )
      continue
    }
    // The intent is why the material exists, not part of it; keeping it on the
    // action would carry it into the node's data and onto the screen.
    const { intent: _dropped, ...action } = a
    kept.push(action)
  }
  return { kept, refused }
}
```

Call it in `applyAction` on the output of `fitCardsToLesson` — **not inside**
`fitCardsToLesson`, whose signature is `(actions, run) => unknown[]` and so has
nowhere to put a refusal. Surfacing them on the result is also what gives this
phase its evidence: which apparatus the tutor chose, and the reason it gave.

Extend `DispatchResult` (line 84):

```ts
  /**
   * What the tutor said it was teaching, for each material it built.
   *
   * Surfaced rather than swallowed because the whole question this phase asks
   * is whether the tutor reasons about the material or reaches for the same
   * apparatus every time, and that is invisible from the board alone.
   */
  intents?: TeachingIntent[]
  /** Materials refused, with the reason each was refused. */
  materialRefusals?: string[]
```

At the point in `applyAction` where the teaching turn's actions are finalised:

```ts
    const fitted = fitCardsToLesson(rawActions, run)
    const intents = fitted
      .map((a) => (a && typeof a === 'object' ? parseIntent((a as Record<string, unknown>).intent) : null))
      .filter((i): i is TeachingIntent => i !== null)
    const { kept, refused } = refuseUnjustifiedActivities(fitted)
    for (const reason of refused) console.log(`Refused a material: ${reason}`)
```

Return `kept` as `actions`, and `intents` / `materialRefusals: refused` alongside
it. Add `TeachingIntent` to the `intent.ts` import added above.

- [ ] **Step 4: Run the test**

Run: `npx vitest run app/api/studylab/tutor/dispatch.intent`

Expected: PASS.

- [ ] **Step 5: Run the whole suite**

Run: `npx tsc --noEmit && npx vitest run`

Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
git add app/api/studylab/tutor/dispatch.ts app/api/studylab/tutor/dispatch.intent.test.ts
git commit -m "feat(studylab): a material the tutor cannot justify never reaches a student

The refusal names the mismatch rather than reporting a failed turn, so
the next attempt has something to act on."
```

---

### Task 8: Make the reasoning mandatory in the prompt

The checks refuse bad material; the prompt is what stops the tutor producing it in the first place. A soft preference has lost to the surrounding instructions every time in this codebase — the zero-activities bug and the words-to-words bug were both this — so this is written as a hard requirement with the vocabulary spelled out.

**Files:**
- Modify: `app/api/studylab/tutor/dispatch.ts` (the teaching prompt for `montessori` mode)

**Interfaces:**
- Consumes: `DIMENSIONS` (Task 4), `assetCatalogPromptBlock()` (Task 1).
- Produces: no new exports.

- [ ] **Step 1: Add the montessori teaching block to `buildTeachPrompt`**

`buildTeachPrompt` at `app/api/studylab/tutor/dispatch.ts:1208` assembles the
teaching turn. Add this block to the prompt it returns, included only when the
lesson's mode is `montessori`:

```ts
const montessoriBlock = `**BUILDING A MATERIAL — NON-NEGOTIABLE:**

Emit a "createActivity" action with BOTH an "intent" and a "spec". A material
without an intent is discarded and the turn is wasted.

"intent": {
  "goal":      "<what the student can do afterwards, one sentence>",
  "isolates":  "<EXACTLY ONE of: ${DIMENSIONS.join(' | ')}>",
  "apparatus": "<the pattern you chose>",
  "why":       "<why this apparatus suits this goal, one sentence>"
}

- "isolates" must be true of the material you built. A "sort" varies category.
  A "sequence" varies order. A "balance" varies quantity, or structure when its
  mode is "equation". Claiming anything else is refused and you will be told so.
- ONE quality at a time. A material that varies two things teaches neither —
  this is the whole method. If the topic needs two, build two materials.
- CONCRETE BEFORE ABSTRACT. Where the catalogue below has a picture for an
  item, you MUST set its "imageUrl" to that catalogue name. Showing the WORD
  "Neuron" and asking the student to pick the WORD "Neuron" is a word-matching
  game, and it is refused.
- Choose the apparatus for the goal, not for convenience. "sort" and
  "threePeriod" fit almost anything badly; reach for them only when category or
  naming genuinely IS the thing being learned.

${assetCatalogPromptBlock()}`
```

- [ ] **Step 2: Type check and run the suite**

Run: `npx tsc --noEmit && npx vitest run`

Expected: both PASS. No test asserts prompt wording — a prompt is verified by what the model does with it, which is Task 9.

- [ ] **Step 3: Commit**

```bash
git add app/api/studylab/tutor/dispatch.ts
git commit -m "feat(studylab): ask the tutor to justify the material before it builds one

Written as a hard requirement with the dimension vocabulary spelled out.
A soft preference lost to the surrounding instructions every previous
time — the zero-activities bug and the words-to-words bug were both that."
```

---

### Task 9: Prove it against a real model, and against a real lesson

Mocked tests prove the wiring. Every bug that reached a learner — repeated cards, narration with nothing behind it, montessori emitting zero activities — passed the mocked tests. Only a real call proves the teaching.

**Files:**
- Create: `scripts/live/liveMontessoriIntent.test.ts`

**Interfaces:**
- Consumes: everything above.
- Produces: nothing importable.

- [ ] **Step 1: Write the live test**

```ts
/**
 * Does the tutor actually reason about the material, or does it still reach
 * for a sorting frame?
 *
 * Run with: npx vitest run --config vitest.live.config.ts liveMontessoriIntent
 */
import { describe, it, expect } from 'vitest'
import fs from 'fs'

// No dotenv in this project; the .env is a flat KEY=value file.
for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

import { applyAction } from '@/app/api/studylab/tutor/dispatch'
import { policyFor } from '@/lib/studylab/lessonPolicy'
import { emptyRun, proposePlan, type LessonRun } from '@/lib/studylab/lessonRun'
import { boardSummary } from '@/lib/studylab/boardSummary'
import type { CanvasState } from '@/lib/studylab/types'
import { applyActions } from '@/lib/studylab/actions'

const POLICY = policyFor('scratch')

/**
 * Teach the first step of a one-step lesson on `topic`, in montessori mode,
 * and hand back what the turn produced.
 *
 * Drives the real dispatcher exactly as `liveLesson.test.ts` does, rather than
 * calling the model directly — the filtering and refusing under test only
 * happen on this path.
 */
async function runMontessoriTurn(topic: string) {
  const planned = proposePlan(emptyRun(POLICY), [
    { id: 's1', title: topic, goal: topic, status: 'pending', cardIds: [] },
  ])
  if (!planned.ok) throw new Error(`could not plan ${topic}: ${planned.reason}`)

  let canvas: CanvasState = { nodes: [], edges: [] }
  const result = await applyAction({
    run: { ...planned.run, mode: 'montessori' } as LessonRun,
    policy: POLICY,
    userId: null,
    action: { type: 'next_beat' },
    context: { title: topic, subject: null, board: boardSummary(canvas) },
  })
  if (result.actions.length > 0) {
    const applied = applyActions(canvas, result.actions as never)
    canvas = { ...canvas, nodes: applied.nodes, edges: applied.edges }
  }
  return { result, canvas }
}

/** Topics chosen so that a sorting frame is the WRONG answer for most of them. */
const TOPICS = [
  'The order of events in mitosis',
  'Why a balanced equation must have equal atoms on both sides',
  'Naming the parts of a flower',
  'How interest rate changes feed through to inflation',
  'Telling igneous from sedimentary rock',
]

describe('a Montessori turn on five different topics', () => {
  it('states an intent that survives the check, and varies the apparatus', async () => {
    const chosen: string[] = []

    for (const topic of TOPICS) {
      const { result, canvas } = await runMontessoriTurn(topic)

      console.log(`\n  ${topic}`)
      ;(result.materialRefusals ?? []).forEach((r) => console.log(`    REFUSED: ${r}`))
      for (const intent of result.intents ?? []) {
        chosen.push(intent.apparatus)
        console.log(`    -> ${intent.apparatus} isolating ${intent.isolates}`)
        console.log(`       ${intent.why}`)
      }

      // A turn where everything was refused teaches nothing, which is worse
      // than the sorting frame it replaced.
      const materials = canvas.nodes.filter((n) => n.type === 'activity')
      expect(materials.length, `${topic}: no material survived the turn`).toBeGreaterThan(0)
      expect(result.intents?.length, `${topic}: no intent stated`).toBeGreaterThan(0)
    }

    // The fault this phase exists to fix: one apparatus for every topic.
    const distinct = new Set(chosen)
    console.log(`\napparatus used: ${[...distinct].join(', ')}`)
    expect(distinct.size, 'the tutor reached for the same apparatus every time').toBeGreaterThan(2)
  }, 300_000)
})
```

- [ ] **Step 2: Run it**

Run: `npx vitest run --config vitest.live.config.ts liveMontessoriIntent`

Expected: PASS. If the apparatus assertion fails, the prompt in Task 8 is not winning against the surrounding instructions — strengthen it there rather than weakening the assertion.

- [ ] **Step 3: Drive a real lesson in the browser**

Start the dev server and launch an isolated Chrome:

```bash
npx next dev
```

```bash
"C:/Program Files/Google/Chrome/Application/chrome.exe" --user-data-dir="C:/Users/Stephen/AppData/Local/Temp/claude-chrome-montessori" --remote-debugging-port=9333 "http://localhost:3000/studylab"
```

Open a Montessori LearnSpace and teach a full lesson to the end. Confirm, with the mouse:

1. A material appears for each step, and it is not a sorting frame every time.
2. Pieces track the cursor exactly, including while the canvas is panned.
3. Items the catalogue can illustrate show pictures, not words.
4. Solving a material closes its step and moves the lesson on.
5. A material can always be completed — no dead board.

Shut down only the Chrome PID you started. Never `taskkill`.

- [ ] **Step 4: Commit**

```bash
git add scripts/live/liveMontessoriIntent.test.ts
git commit -m "test(studylab): does the tutor reason, or still reach for a sorting frame

Five topics chosen so that a sorting frame is the wrong answer for most.
Asserts the apparatus varies, because that is the fault this phase exists
to fix and it is invisible to a mocked test."
```

---

## What this phase is for

At the end of Task 9 there is an answer to the question the spec gates Phase 2 on:

- If the tutor now chooses apparatus that suit their topics, and the nine start to feel limiting **because a topic genuinely needs an arrangement none of them can express**, the composable engine is justified by evidence.
- If it still teaches badly, the engine would have scaled the badness, and the next work is here rather than there.

Record which topics defeated the nine, and how. That list is the input to Phase 2's plan.
