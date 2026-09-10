# Stage 3 — Material renderer (dev bench cut)

**Status:** Designed 2026-09-10; not built  
**Date:** 2026-09-10  
**Parent:** `docs/superpowers/specs/2026-09-07-studylab-composable-material-engine-design.md`  
**Depends on:** Phase 2 core (Tasks 1–9) under `lib/studylab/material/` — vocabulary, interpreter, validators, canon.  
**Handover traps:** `docs/HANDOVER.md` sections 3–4 (height allowance, fixed containing block, Tailwind `ss-*` alpha, no `.test.tsx`).

## The problem

Phase 2 proved a material can be composed, checked, and shown to agree with the
nine legacy patterns on what counts as solved — as pure `lib/` logic. Nothing
draws a `MaterialSpec` yet. Until something does:

- `MATERIAL_BOX.heightPx` remains a budget, not a CSS constraint (`ActivityFrame`
  is `height: auto`), so the height half of `fitsInBox` is decorative.
- Drag, allow/refuse, controls, and bound displays exist only as functions a
  student never meets.
- Switching LearnSpace over without a browser-proven renderer would repeat
  Phase 1's lesson: two worst bugs were invisible to a green node-only suite.

## What this cut builds

One vocabulary renderer, exercised only on the existing `/dev/activities` bench,
fully interactive, with `MATERIAL_BOX` enforced as real layout.

> **The vocabulary is generative. The child's encounter is familiar.**

This cut does not invent nine new UIs. It draws the same nouns the child will
meet later — pieces in slots, groups, controls, displays — from the closed
spec the tutor will eventually author.

## Non-goals (this plan)

- No LearnSpace / `ActivityNode` wiring — production still uses the nine pattern
  components.
- No deletion of those nine components.
- No `build_material` on the tutor action union (Stage 4).
- No `.test.tsx` files — vitest stays node-only; verification is a browser pass
  on the mouse path.
- No second expression evaluator; no model-authored SVG; no raw art URLs.

## Architecture

```
MaterialSpec + MaterialState
        │
        ▼
┌───────────────────┐     applyMove / tick / allowsMove
│  MaterialRenderer │ ◄── lib/studylab/material/interpreter
│  (client React)   │
└─────────┬─────────┘
          │ geometry from MATERIAL_BOX only
          ▼
┌───────────────────┐
│ MaterialFrame     │  max-width/height = box; overflow policy below
└─────────┬─────────┘
          │
          ▼
   /dev/activities  (React Flow + picker of canon fixtures)
```

**One renderer, not nine wrappers.** Apparatus differences live in the spec
(groups, rules, displays), not in parallel component trees. Shared drag comes
from `useActivityDrag` + `fixedContainingBlock` — the same path that fixed the
185px ghost drift.

### Layout and the real box

`MATERIAL_BOX` in `lib/studylab/material/fit.ts` is the single geometry source.

| Dimension | Today | This cut |
|---|---|---|
| Width | Real — `ActivityFrame` `w-[420px]` | Keep; material content uses `MATERIAL_BOX.widthPx` |
| Height | Decorative — card `height: auto` | **Enforce** `MATERIAL_BOX.heightPx` as `max-height` on the material content shell |

**Overflow policy:**

- The material content shell is capped at `MATERIAL_BOX.heightPx` with
  `overflow: hidden` (or equivalent) so the card cannot grow past the budget
  `fitsInBox` assumed.
- Individual group zones that would exceed their share of the budget become
  scrollable (`overflow-y: auto`, `nowheel` so React Flow does not zoom), same
  idea as `CompareActivity`'s `ZONE_MAX_HEIGHT`.
- Slot grid metrics (chip size, gaps, max slots per row / rows) are derived from
  the same constants `fit.ts` already documents — do not invent a second set of
  magic numbers in the component.

`ActivityFrame` itself may gain an optional height-constrained content path used
by the material renderer, or the material shell may sit inside the existing
frame with its own capped inner div. Prefer the inner shell if changing
`ActivityFrame` would alter the nine live pattern cards' layout unexpectedly.

### Interaction

Initial state: empty placement, controls at each control's `min`,
`status: 'untouched'`, `attempts: 0`, `rejectedMoves: []`.

| Student action | Engine call | UI |
|---|---|---|
| Drag piece onto slot | `allowsMove` then `applyMove` | Legal: place chip; illegal: spring back, keep `rejectedMoves` |
| Change control | update `state.controls`, then `tick` | Displays and `says` refresh |
| (Derived) | `tick` after every successful move / control change | `displays`, `says`, `solved` |

Drop targets are **slots** (slot id), not abstract group ids — matching
`allowsMove` / `applyMove`. Unplaced pieces live in a pool strip outside the
group zones (or an unassigned area the layout reserves), still inside the box.

Displays:

- `beam` — tilt / numeric readout bound from `tick().displays[id]`
- `bar` / `tank` / `plot` — read the bound value; plot may be a minimal line or
  stub that still shows the numeric binding until Stage 3 cut 2, but must not
  ignore `tick` (no frozen fake numbers)

Art: piece `art` is a catalogue name → `assetUrl()` only. Missing art → label
chip. Never render model SVG.

Colours: set `ss-*` tokens inline (`style={{ backgroundColor: 'var(--ss-…)' }}`
or SVG `fill`). Do not use Tailwind alpha modifiers on those tokens — they emit
no rule.

### Dev bench

Extend `app/dev/activities/page.tsx` (still `notFound()` outside development):

1. Keep the existing legacy pattern fixtures (sort / balance / compare / compose)
   so regressions against old drag behaviour remain findable.
2. Add a **Composed material** section:
   - Picker: every name from `apparatusNames()`.
   - Load `getApparatus(name)!.base` into `MaterialRenderer`.
   - Optional second picker: a small set of `fromLegacy(payload, success)` samples
     (at least sorting-frame and balance-beam) so conversion output is visible.
3. Mount inside the same React Flow instance as today — required for real pointer
   events and the fixed-containing-block ghost path.
4. Browser verification checklist (manual, mouse path — not keyboard-only):
   - Drag ghost tracks cursor (~5px), including after pan/zoom.
   - Illegal drop springs back; legal drop stays.
   - Control moves update bound display within one interaction.
   - Content shell does not grow past `MATERIAL_BOX.heightPx`.
   - Switching apparatus resets state cleanly.

### File map (intended)

| Path | Responsibility |
|---|---|
| `components/studylab/material/MaterialRenderer.tsx` | Spec + state → UI; wires drag and controls to interpreter |
| `components/studylab/material/MaterialFrame.tsx` | Box-capped shell; group layout; scrollable zones |
| `components/studylab/material/PieceChip.tsx` | One piece (label / art); `nodrag` / drag props |
| `components/studylab/material/SlotTarget.tsx` | Drop target for one slot |
| `components/studylab/material/DisplayView.tsx` | beam / bar / tank / plot from bound values |
| `components/studylab/material/ControlView.tsx` | Slider/stepper for one `Control` |
| `app/dev/activities/page.tsx` | Add composed fixtures + picker |
| `lib/studylab/material/fit.ts` | Already owns `MATERIAL_BOX` — comment updated when height becomes real |

No changes under `lib/studylab/activities/patterns/`. No tutor prompt changes.

### Testing

| Kind | What |
|---|---|
| Unit (node) | Pure helpers only if any layout math is extracted to `.ts` (e.g. slot grid). Prefer reusing `MATERIAL_BOX` so new math is unnecessary. |
| Forbidden | `.test.tsx`, jsdom |
| Gate before claiming done | `npx tsc --noEmit && npx vitest run` green **and** the browser checklist above on `/dev/activities` |

### Migration relationship

Parent design migration step 3: *"The renderer draws from the vocabulary; the
nine renderers are deleted as their entries take over."*

This cut is the first half of step 3 — draw from the vocabulary. Deletion and
LearnSpace cutover are a later Stage 3 cut (or Stage 3b), after the bench has
proven drag and the real box. No flag day.

## Risks carried in

- **Balance pan chrome** still caps authored items at 2 for layout reasons —
  redrawing pans inside `MaterialRenderer` is allowed to improve that, but is
  not required to finish this cut if the beam + two groups already teach.
- **`pairing` goals** remain unreachable in the interpreter; canon entries use
  placement goals. The renderer must not special-case pairing.
- **React Flow + `position: fixed`** — always use `ghostPosition` /
  `fixedContainingBlock`; never assume `fixed` means viewport.

## Success criteria

1. Every canon apparatus `base` can be selected on `/dev/activities` and worked
   with the mouse through to a solved or clearly refused state.
2. `MATERIAL_BOX.heightPx` is a real CSS cap on the material content; a tall
   fixture does not stretch the card without bound.
3. Production LearnSpace behaviour unchanged (nine pattern components still
   own live lessons).
4. Suite green; no new `.test.tsx`.
