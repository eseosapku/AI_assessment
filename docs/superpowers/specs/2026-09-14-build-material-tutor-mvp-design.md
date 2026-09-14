# Stage 4 — Tutor `build_material` (MVP)

**Status:** Built 2026-09-14 (MVP on `aws_deploy`, local only)  
**Date:** 2026-09-14  
**Parent:** `docs/superpowers/specs/2026-09-07-studylab-composable-material-engine-design.md`  
**Depends on:** Stage 3b complete (all nine live cutovers); Phase 2 core (`validateMaterial`, canon, `MaterialRenderer`).

## The problem

The composable engine and live cutovers exist, but the tutor still can only
author the nine legacy `ActivitySpec` patterns via `createActivity`. Free-form
`MaterialSpec` composition — the point of the vocabulary — is not on the action
union, not on the canvas as its own node type, and not advertised from
`MATERIAL_BOX` / the canon. Opening that path is Stage 4.

## What this cut builds (MVP)

1. **`build_material` action** on `TutorAction`:
   `{ type: 'build_material'; id: string; step?: number; intent: TeachingIntent; spec: MaterialSpec }`
2. **Gate before apply:** parse intent → apparatus must be a canon name →
   `validateMaterial(spec, apparatus.maxVaryingTraits)` → intent `isolates`
   must match that apparatus’s fixed Dimension (same mapping as the nine
   patterns’ apparatus names, keyed by canon name).
3. **Canvas node** `type: 'material'` (not `CARD_KINDS`) storing
   `materialSpec` + `materialState`; rendered by a lesson `MaterialBoardNode`
   that drives controlled `MaterialRenderer` + Check via `tick().solved`.
4. **Montessori prompt:** list `build_material` in ACTION TYPES; append a
   **generated** vocabulary advertisement from `MATERIAL_BOX` +
   `apparatusNames()` (+ short schema summary). Keep `createActivity` +
   MATERIAL CONTRACT for the nine patterns.
5. **Checkpoint parity:** `summarizeCheckpoints` treats solved material nodes
   with `materialSpec.satisfiesCheckpoint` like activity nodes.
6. **Board listing:** existing-cards / board summary includes material prompts
   so the next turn does not recreate them.

Refusals are values with reasons (filter before `applyActions`), matching
`createActivity` intent filtering.

## Non-goals

- Deleting or retiring `createActivity` / nine activity components.
- Classic-mode `build_material`.
- Requiring the tutor to stop using the nine patterns.
- Full live tutor lesson verification in CI (browser/manual later).
- `.test.tsx` files.
- Extending `TeachingIntent` beyond apparatus = canon name.

## Architecture

```
Tutor JSON action build_material
        │
        ▼
filterBuildMaterial (dispatch)
  • parseIntent
  • getApparatus(intent.apparatus)
  • validateMaterial(spec, maxVaryingTraits)
  • isolates matches APPARATUS_DIMENSION[apparatus]
  • strip intent from action before apply
        │
        ▼
applyActions → StudyNode { type: 'material', data: { materialSpec, materialState, … } }
        │
        ▼
MaterialBoardNode → MaterialRenderer (controlled) + Check (tick)
```

### Intent ↔ apparatus

Reuse `TeachingIntent` / `parseIntent`. Add
`apparatusDimension(name: string): Dimension | null` keyed by canon names
(`sorting-frame` → `category`, …) mirroring the pattern table in
`materialContract`. `checkMaterialIntent(intent, spec)` confirms apparatus
exists and `intent.isolates === apparatusDimension(intent.apparatus)`.

Isolation of traits is already enforced by `validateMaterial` /
`checkIsolation` — do not reimplement `dimensionsOf` for free-form specs.

### Persistence

`materialState: MaterialState` on the node (placement, controls, status, …).
Initial state from `createInitialMaterialState(spec)`. No pattern adapter.

### Prompt generation

New pure helper e.g. `advertiseVocabulary(): string` that interpolates
`MATERIAL_BOX` numeric caps and `apparatusNames()` so prompt and validator
cannot drift. Listed in montessori ACTION TYPES beside (not instead of)
`createActivity`.

### Success criteria

1. Well-formed `build_material` creates a material node that renders and Check-solves.
2. Malformed / unsolvable / wrong isolates / unknown apparatus → refused with reason; nothing on board.
3. `createActivity` path unchanged.
4. `build_material` appears in `systemPrompt('montessori')` ACTION TYPES.
5. Vocabulary block is generated, not hand-copied caps.
6. Suite green; local commits only; no push without explicit decision.

## Risks

- **Two material authoring paths:** Document that nine-pattern `createActivity`
  remains default for familiar apparatus; `build_material` is free-form.
- **Prompt length:** Generated block must stay short (caps + names + schema
  outline), not dump every base MaterialSpec.
- **Missing board summary:** Without listing materials, the tutor recreates —
  extend the same list used for activities/cards.

## Migration relationship

Opens Stage 4. Retirement of `createActivity` is a later explicit decision
after free-form materials are driven in real montessori lessons.
