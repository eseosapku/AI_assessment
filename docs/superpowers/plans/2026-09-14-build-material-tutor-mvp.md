# Stage 4 — Build Material Tutor MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Open montessori `build_material` so the tutor can place validated free-form `MaterialSpec` nodes on the LearnSpace board, with vocabulary advertised from `MATERIAL_BOX` + canon.

**Architecture:** Action on `TutorAction` → filter gate in dispatch → `applyActions` creates `material` nodes → `MaterialBoardNode` + controlled `MaterialRenderer`. Prompt lists the action and a generated advertise block. `createActivity` unchanged.

**Tech Stack:** TypeScript strict, existing validateMaterial/canon/MaterialRenderer, vitest node-only. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-14-build-material-tutor-mvp-design.md`

## Global Constraints

- **Montessori only** for prompt listing / filter use; classic prompt must not advertise `build_material`.
- **Do not break** `createActivity` or nine live cutovers.
- **Not in CARD_KINDS** — dedicated node type `material`.
- **Gate:** intent + canon apparatus + `validateMaterial` + isolates match; refuse with reason.
- **Advertise from source:** `MATERIAL_BOX` + `apparatusNames()` — no hand-copied numeric caps.
- **Never create `.test.tsx`.**
- **Local commits only. NEVER push** (`aws_deploy` deploys).
- Work in `c:\Users\Stephen\AI_assessment` — not a worktree.

## File Structure

| Path | Responsibility |
|---|---|
| `lib/studylab/material/apparatusDimension.ts` | Canon name → Dimension |
| `lib/studylab/material/apparatusDimension.test.ts` | Mapping coverage |
| `lib/studylab/material/advertiseVocabulary.ts` | Generated prompt fragment |
| `lib/studylab/material/advertiseVocabulary.test.ts` | Contains MATERIAL_BOX numbers + apparatus names |
| `lib/studylab/activities/intent.ts` | `checkMaterialIntent` |
| `lib/studylab/types.ts` | TutorAction + StudyNode / StudyNodeData material fields |
| `lib/studylab/actions.ts` | isValidAction + apply build_material |
| `lib/studylab/actions.material.test.ts` | Apply / reject tests |
| `lib/studylab/checkpointState.ts` | Solved material nodes settle checkpoints |
| `components/studylab/material/MaterialBoardNode.tsx` | Lesson node UI |
| `components/studylab/canvasNodes.tsx` | Register `material` |
| `app/api/studylab/tutor/route.ts` | ACTION TYPES line for build_material |
| `app/api/studylab/tutor/dispatch.ts` | filterBuildMaterial + board list + prompt advertise |
| `docs/HANDOVER.md` | Record Stage 4 MVP |

---

### Task 1: Apparatus dimension map + checkMaterialIntent

**Files:**
- Create: `lib/studylab/material/apparatusDimension.ts` + `.test.ts`
- Modify: `lib/studylab/activities/intent.ts` + extend `intent.test.ts`

```ts
// apparatusDimension.ts
import type { Dimension } from '@/lib/studylab/activities/dimensions'
import { apparatusNames, getApparatus } from './canon'

const MAP: Record<string, Dimension> = {
  'sorting-frame': 'category',
  'ordering-track': 'order',
  'three-period-cards': 'identity',
  'venn-sets': 'membership',
  'balance-beam': 'quantity', // weights default; equation is structure — see note
  'labelled-diagram': 'position',
  'variable-model': 'magnitude',
  'decision-branch': 'consequence',
  'bonding-ring': 'structure',
}

export function apparatusDimension(name: string): Dimension | null {
  if (!getApparatus(name)) return null
  return MAP[name] ?? null
}
```

**Note on balance-beam:** Free-form materials have no `mode` field. Use `quantity` as the advertised default in MAP; if the tutor needs equation-style structure, they still use `createActivity` with `pattern: 'balance'` + `mode: 'equation'`, or we later add a trait. Document in comment.

`checkMaterialIntent(intent, _spec): { ok: true } | { ok: false; reason }` — apparatus must resolve; isolates must equal `apparatusDimension(intent.apparatus)`.

- [ ] Tests: every `apparatusNames()` entry has a Dimension; unknown name null; checkMaterialIntent ok/fail
- [ ] Gate + commit

```
feat(studylab): map canon apparatus names to teaching dimensions

build_material intent must copy isolates from the apparatus, not invent them.
```

---

### Task 2: TutorAction + applyActions for `build_material`

**Files:**
- Modify: `lib/studylab/types.ts` — add action variant; extend StudyNode.type and StudyNodeData.kind with `'material'`; add `materialSpec?: MaterialSpec`, `materialState?: MaterialState` (import types)
- Modify: `lib/studylab/actions.ts` — validate + apply
- Create: `lib/studylab/actions.material.test.ts`

**isValidAction:** `type === 'build_material'` && string id && parseMaterialSpec-friendly check — prefer calling `parseMaterialSpec` or requiring object spec with string prompt; full validateMaterial runs in the filter, not isValidAction (mirror createActivity which only validateSpec). For build_material use `parseMaterialSpec(a.spec) !== null` OR a thin shape check. **Prefer:** isValidAction requires id + parseMaterialSpec(spec) non-null; filter runs validateMaterial with maxVarying.

**apply:** push node `{ type: 'material', data: { kind: 'material', title: spec.prompt, step, materialSpec: spec, materialState: createInitialMaterialState(spec) } }`; dedupe by prompt among material nodes (and/or activity); zoom on dupe.

- [ ] Tests: valid apply; duplicate zooms; invalid dropped
- [ ] Gate + commit

```
feat(studylab): apply build_material actions onto material canvas nodes

Free-form MaterialSpec becomes a board node outside CARD_KINDS.
```

---

### Task 3: MaterialBoardNode + canvas registration + checkpoints

**Files:**
- Create: `components/studylab/material/MaterialBoardNode.tsx`
- Modify: `components/studylab/canvasNodes.tsx`
- Modify: `lib/studylab/checkpointState.ts` (+ test if existing activity test file can gain a case)

**MaterialBoardNode:** Like MaterialActivity but no adapter — hydrate from `data.materialState`, persist via CanvasContext `onNodeDataChange`, Check = tick().solved → set status solved. No hints/reveal required for MVP (optional if easy).

**checkpointState:** also walk `n.type === 'material'` and `n.data.materialSpec?.satisfiesCheckpoint`.

- [ ] Unit test checkpoint summary with solved material node
- [ ] Gate + commit

```
feat(studylab): render material board nodes and settle checkpoints

Students work free-form materials; solved ones gate steps like activities.
```

---

### Task 4: Dispatch filter + prompt advertise + ACTION TYPES

**Files:**
- Create: `lib/studylab/material/advertiseVocabulary.ts` + `.test.ts`
- Modify: `app/api/studylab/tutor/route.ts` — `BUILD_MATERIAL_ACTION_TYPE` in montessori ACTION TYPES
- Modify: `app/api/studylab/tutor/dispatch.ts` — `filterBuildMaterial` (mirror createActivity filter); call it in the teach pipeline; append `advertiseVocabulary()` when montessori; list materials in board/card summary

**filterBuildMaterial:**
1. Skip non-build_material
2. parseIntent — refuse if null
3. getApparatus(intent.apparatus) — refuse if null
4. validateMaterial(spec, apparatus.maxVaryingTraits) — refuse with reason
5. checkMaterialIntent — refuse with reason
6. Strip intent; keep action for apply

**advertiseVocabulary:** include `MATERIAL_BOX.widthPx`, `heightPx`, slot caps, and bullet list of `apparatusNames()`.

**route.ts:** Add ACTION TYPES bullet for build_material (montessori), pointing at the generated vocabulary block / MATERIAL CONTRACT coexistence.

- [ ] Tests for advertiseVocabulary content
- [ ] Unit test filter if extractable; else exercise via existing dispatch test patterns
- [ ] Gate + commit

```
feat(studylab): advertise and gate build_material in montessori tutor

List the action in the contract and validate before the board updates.
```

---

### Task 5: HANDOVER

**Files:** `docs/HANDOVER.md`

Mark Stage 4 MVP done: build_material + material nodes; createActivity remains; Stage 4 follow-ups (live lesson drive, balance equation dimension, retire createActivity) listed under Not done as appropriate.

- [ ] Final gate + commit

```
docs(studylab): record Stage 4 build_material tutor MVP

Free-form materials reach the board behind montessori; nine patterns remain.
```

**Do not push.**

---

## Spec coverage

| Spec requirement | Task |
|---|---|
| apparatus → Dimension | 1 |
| TutorAction + apply material node | 2 |
| MaterialBoardNode + checkpoints | 3 |
| filter + ACTION TYPES + generated advertise | 4 |
| HANDOVER | 5 |
| createActivity unchanged | Global |
| No push / no .test.tsx | Global |
