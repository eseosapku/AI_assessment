# Composable Material Engine — Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the vocabulary, interpreter, three validators and canon that let a teaching material be composed from parts rather than chosen from nine fixed apparatus — as pure `lib/` logic, with nothing user-facing changed.

**Architecture:** A material is pieces in slots grouped into zones, plus controls and displays, plus four rules — `derive`, `bind`, `when`, `allow`. Every numeric expression evaluates through the existing hardened parser, so no new evaluation surface is introduced. Three static checks run before a material could ever reach a student: it must be solvable, it must isolate a single quality, and it must fit the box it is drawn in. The nine existing patterns are then re-expressed as canon entries and pinned by equivalence tests against their original modules, so the migration has no flag day.

**Tech Stack:** TypeScript strict, vitest (node environment), no new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-07-studylab-composable-material-engine-design.md` — read it, including the "What Phase 1 proved" section at the end, which is where four of this plan's constraints come from.

**How the implementations are specified.** Each task's tests are complete and
executable, and they are the contract — write the code that makes them pass, in
the order the steps give. Two places carry the algorithm rather than the tests:
the vocabulary's type declarations are in the spec's "The vocabulary" section
verbatim, and the interpreter's evaluation order and the prover's search are in
the spec's "Evaluation" and "Solvable" sections. Read those before Tasks 1, 3
and 6 rather than inferring them from the tests alone.

## Global Constraints

- **Scope is the engine core only** — the spec's migration stages 1 and 2. Stage 3 (a renderer drawing from the vocabulary) and stage 4 (opening `build_material` to the tutor) are a separate plan. Do not build them, do not stub them. Nothing in this plan is reachable from the tutor or the canvas when it is finished, and that is correct.
- **The nine existing patterns must keep working at every step.** No flag day. Nothing under `lib/studylab/activities/patterns/` is deleted or altered by this plan.
- vitest runs in the **node** environment only — no jsdom. **Never create a `.test.tsx` file.**
- Live/model tests go in `scripts/live/*.test.ts` under `vitest.live.config.ts`, excluded from the default suite. This plan needs none.
- `npx tsc --noEmit` clean and `npx vitest run` fully green at the end of every task. Baseline entering this plan: **111 test files, 1469 tests**.
- **Local commits only. NEVER push.**
- Work in the main repo at `c:\Users\Stephen\AI_assessment` — not a worktree. The user watches edits live.
- Every numeric expression evaluates through `evaluateExpr` from `lib/studylab/activities/expr.ts` — a recursive-descent parser over a closed token set, no `eval`, no `new Function`, failing closed. It exists because mathjs (CVE-2026-41139) and expr-eval (CVE-2025-12735) both had parser-escape RCEs. **Do not add another evaluator, and do not extend this one without saying why.**
- Art is referenced by catalogue name and resolved through `assetUrl()` from `lib/studylab/activities/assetCatalog.ts`. An unvalidated `src` from model output is a broken-image, tracking-pixel and SSRF risk. Model-authored SVG is never rendered.
- **Registry lookups use a `Map`, never an object literal.** Names originate in model output; indexing an object literal reaches `Object.prototype`, so `__proto__` and `constructor` resolve to truthy non-modules and sail past a `if (!mod)` guard.
- **One source for every constraint.** Where a limit is both enforced by a validator and advertised to the model, it comes from a single exported constant. Phase 1 shipped a cap the prompt never mentioned, so materials were refused as "malformed" with no reason the tutor could act on.

## File Structure

Everything new lives under `lib/studylab/material/`, beside — not inside — the existing `lib/studylab/activities/`. The two coexist for the whole of this plan.

| Path | Responsibility |
|---|---|
| `material/types.ts` | `Piece`, `Slot`, `Group`, `Control`, `Display`, `Rule`, `Predicate`, `Effect`, `Selector`, `MaterialSpec`, `MaterialState`, `Placement` |
| `material/parse.ts` | `parseMaterialSpec(raw)` — narrows untrusted model output, never throws |
| `material/scope.ts` | `buildScope(spec, state)` — the flat `Record<string, number>` every expression reads |
| `material/interpreter.ts` | `tick(spec, state)` — one evaluation pass; `applyMove` and its `allow` gate |
| `material/isolation.ts` | `varyingTraits(spec)`, `checkIsolation(spec, max)` |
| `material/fit.ts` | `MATERIAL_BOX`, `fitsInBox(spec)` — the single geometry source |
| `material/solvable.ts` | `isSolvable(spec)` — bounded breadth-first search over legal moves |
| `material/validate.ts` | `validateMaterial(spec, apparatus)` — the composite gate |
| `material/canon/index.ts` | The canon `Map`, `getApparatus(name)`, `apparatusNames()` |
| `material/canon/<name>.ts` | One entry per apparatus, each with `fromLegacy` for the equivalence test |

---

### Task 1: The vocabulary, and narrowing untrusted output into it

**Files:**
- Create: `lib/studylab/material/types.ts`
- Create: `lib/studylab/material/parse.ts`
- Test: `lib/studylab/material/parse.test.ts`

**Interfaces:**
- Consumes: `SuccessRule` from `@/lib/studylab/activities/types`.
- Produces: every type named in the File Structure table above, plus
  `parseMaterialSpec(raw: unknown): MaterialSpec | null`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/studylab/material/parse.test.ts
import { describe, it, expect } from 'vitest'
import { parseMaterialSpec } from './parse'

const MINIMAL = {
  prompt: 'Balance both sides.',
  pieces: [{ id: 'p1', label: 'H2', traits: { h: 2, o: 0 } }],
  groups: [{ id: 'g1', label: 'Left pan', ordered: false }],
  slots: [{ id: 's1', groupId: 'g1', x: 0, y: 0, capacity: 1 }],
  rules: [{ op: 'derive', name: 'leftH', expr: 'sum_h_g1' }],
  goal: { kind: 'exactSet', itemIds: ['p1'] },
}

describe('parseMaterialSpec', () => {
  it('reads a well-formed spec', () => {
    const spec = parseMaterialSpec(MINIMAL)
    expect(spec?.pieces[0].traits.h).toBe(2)
    expect(spec?.rules[0].op).toBe('derive')
  })

  it('refuses a slot pointing at a group that does not exist', () => {
    // The exact fault compose shipped: an id naming nothing, so the material
    // renders but can never be worked, and nothing says why.
    expect(parseMaterialSpec({ ...MINIMAL, slots: [{ id: 's1', groupId: 'nope', x: 0, y: 0, capacity: 1 }] })).toBeNull()
  })

  it('refuses duplicate ids anywhere', () => {
    expect(parseMaterialSpec({ ...MINIMAL, pieces: [MINIMAL.pieces[0], MINIMAL.pieces[0]] })).toBeNull()
  })

  it('refuses a rule op outside the four', () => {
    expect(parseMaterialSpec({ ...MINIMAL, rules: [{ op: 'exec', name: 'x', expr: '1' }] })).toBeNull()
  })

  it('refuses art that is a URL rather than a catalogue name', () => {
    // An unvalidated src is a broken-image, tracking-pixel and SSRF risk at once.
    const withUrl = { ...MINIMAL, pieces: [{ ...MINIMAL.pieces[0], art: 'https://example.com/x.png' }] }
    expect(parseMaterialSpec(withUrl)).toBeNull()
  })

  it('refuses a spec with no goal', () => {
    const { goal, ...noGoal } = MINIMAL
    expect(parseMaterialSpec(noGoal)).toBeNull()
  })

  it('never throws on whatever the model sent', () => {
    expect(parseMaterialSpec(null)).toBeNull()
    expect(parseMaterialSpec('a material')).toBeNull()
    expect(parseMaterialSpec({ pieces: 'three' })).toBeNull()
    expect(parseMaterialSpec({ ...MINIMAL, pieces: [null, 3] })).toBeNull()
  })

  it('caps a material nobody could hold in their head', () => {
    const many = { ...MINIMAL, pieces: Array.from({ length: 200 }, (_, i) => ({ id: `p${i}`, label: `${i}`, traits: {} })) }
    expect(parseMaterialSpec(many)).toBeNull()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/studylab/material/parse`
Expected: FAIL with `Failed to resolve import "./parse"`.

- [ ] **Step 3: Write `lib/studylab/material/types.ts`**

Copy the `Piece`, `Slot`, `Group`, `Control`, `Display`, `Rule`, `Predicate`, `Effect` and `Selector` declarations verbatim from the spec's "The vocabulary" section, then add:

```ts
import type { SuccessRule } from '@/lib/studylab/activities/types'

/** Where a piece currently sits. Absent from the map means "not yet placed". */
export type Placement = Record<string, string>   // pieceId -> slotId

/** A whole material, as composed. */
export interface MaterialSpec {
  /** One short instruction to the student. */
  prompt: string
  pieces: Piece[]
  groups: Group[]
  slots: Slot[]
  controls?: Control[]
  displays?: Display[]
  rules: Rule[]
  /** Reuses the existing algebra — see lib/studylab/activities/success.ts. */
  goal: SuccessRule
  /** Which checkpoint this material settles when solved. */
  satisfiesCheckpoint?: string
}

/** The student's progress. Everything else is derived by the interpreter. */
export interface MaterialState {
  placement: Placement
  /** Control id -> its current value. */
  controls: Record<string, number>
  attempts: number
  /** Moves the material refused. The clearest misconception signal there is. */
  rejectedMoves: { pieceId: string; slotId: string }[]
  status: 'untouched' | 'in_progress' | 'solved'
}
```

- [ ] **Step 4: Write `lib/studylab/material/parse.ts`**

A pure narrowing function. It must:
- return `null` rather than throw, for any input;
- reject when any `id` collides across pieces, groups, slots, controls or displays;
- reject when a `slot.groupId` names no group, or a rule references a group or control id that does not exist;
- reject `art` that is not a bare catalogue name — require `/^[a-z0-9-]+$/` and reject anything containing `:` or `/`;
- reject a `rules[].op` outside `derive | bind | when | allow`;
- cap the material at **24 pieces, 12 groups, 48 slots, 6 controls, 6 displays and 48 rules**, exported as named constants with a comment explaining that a material nobody can hold in their head is a bad material, which is the same reasoning behind the state-space cap in Task 6.

- [ ] **Step 5: Run the test**

Run: `npx vitest run lib/studylab/material/parse`
Expected: PASS.

- [ ] **Step 6: Run the whole suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: both PASS, total up by this file's test count.

- [ ] **Step 7: Commit**

```bash
git add lib/studylab/material/types.ts lib/studylab/material/parse.ts lib/studylab/material/parse.test.ts
git commit -m "feat(studylab): the vocabulary a material is composed from

Five nouns and four rules, and a narrowing pass that refuses an id
naming nothing — the fault compose shipped, where one mistyped label
meant no bond was ever legal and nothing said so.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: The scope every expression reads

Expressions cannot reach into the board directly. The interpreter builds a flat `Record<string, number>` each tick, and `evaluateExpr` sees only that. Aggregate names are **generated from the spec**, so an expression naming something that does not exist fails validation instead of quietly evaluating to zero.

**Files:**
- Create: `lib/studylab/material/scope.ts`
- Test: `lib/studylab/material/scope.test.ts`

**Interfaces:**
- Consumes: `MaterialSpec`, `MaterialState` (Task 1); `evaluateExpr` from `@/lib/studylab/activities/expr`.
- Produces: `buildScope(spec: MaterialSpec, state: MaterialState): Record<string, number>`, and `scopeNames(spec: MaterialSpec): string[]` — every name an expression is allowed to use.

- [ ] **Step 1: Write the failing test**

```ts
// lib/studylab/material/scope.test.ts
import { describe, it, expect } from 'vitest'
import { buildScope, scopeNames } from './scope'
import type { MaterialSpec, MaterialState } from './types'

const spec = {
  prompt: 'p',
  pieces: [
    { id: 'a', label: 'H2', traits: { h: 2, o: 0 } },
    { id: 'b', label: 'O2', traits: { h: 0, o: 2 } },
  ],
  groups: [{ id: 'left', label: 'Left', ordered: false }, { id: 'pool', label: 'Pool', ordered: false }],
  slots: [
    { id: 's1', groupId: 'left', x: 0, y: 0, capacity: 1 },
    { id: 's2', groupId: 'left', x: 1, y: 0, capacity: 1 },
    { id: 's3', groupId: 'pool', x: 0, y: 0, capacity: 4 },
  ],
  controls: [{ id: 'drops', label: 'Drops', min: 0, max: 50, step: 1 }],
  rules: [],
  goal: { kind: 'exactSet' as const, itemIds: [] },
} as MaterialSpec

const state = (placement: Record<string, string>, controls: Record<string, number> = {}): MaterialState => ({
  placement, controls, attempts: 0, rejectedMoves: [], status: 'in_progress',
})

describe('buildScope', () => {
  it('sums a trait over the pieces in a group', () => {
    const s = buildScope(spec, state({ a: 's1', b: 's2' }))
    expect(s.sum_h_left).toBe(2)
    expect(s.sum_o_left).toBe(2)
  })

  it('counts the pieces in a group', () => {
    expect(buildScope(spec, state({ a: 's1' })).count_left).toBe(1)
    expect(buildScope(spec, state({})).count_left).toBe(0)
  })

  it('ignores pieces that are not placed', () => {
    const s = buildScope(spec, state({ a: 's3' }))   // a is in the pool
    expect(s.sum_h_left).toBe(0)
    expect(s.sum_h_pool).toBe(2)
  })

  it('exposes each control by its id', () => {
    expect(buildScope(spec, state({}, { drops: 24 })).drops).toBe(24)
  })

  it('defaults a control the student has not touched to its minimum', () => {
    expect(buildScope(spec, state({})).drops).toBe(0)
  })

  it('lists every legal name, so an expression can be checked against it', () => {
    const names = scopeNames(spec)
    expect(names).toContain('sum_h_left')
    expect(names).toContain('count_pool')
    expect(names).toContain('drops')
    // A trait no piece carries is not a name, so naming it is a mistake worth
    // catching at validation rather than silently reading zero.
    expect(names).not.toContain('sum_mass_left')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/studylab/material/scope`
Expected: FAIL with `Failed to resolve import "./scope"`.

- [ ] **Step 3: Write `lib/studylab/material/scope.ts`**

`scopeNames(spec)` returns, for every group `g`: `count_<g>`, plus `sum_<trait>_<g>` for every **numeric** trait any piece carries. Plus every control id. Plus every `derive` rule's `name`. `buildScope` computes the same set of names to values, reading placement through `slots` to find each piece's group. A control absent from `state.controls` reads as its declared `min`.

String traits are deliberately not summed — they are for `Selector` matching only. Say so in a comment.

- [ ] **Step 4: Run the test**

Run: `npx vitest run lib/studylab/material/scope`
Expected: PASS.

- [ ] **Step 5: Run the whole suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/studylab/material/scope.ts lib/studylab/material/scope.test.ts
git commit -m "feat(studylab): the flat scope a material's expressions read

Aggregate names are generated from the spec, so an expression naming
something that does not exist can be refused at validation instead of
quietly evaluating to zero.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: The interpreter

One tick, run after every move and every control change. Two passes, not to a fixed point: a rule set whose meaning depends on further iteration is rejected as cyclic, which keeps a tick O(rules) and the Task 6 search tractable.

**Files:**
- Create: `lib/studylab/material/interpreter.ts`
- Test: `lib/studylab/material/interpreter.test.ts`

**Interfaces:**
- Consumes: `buildScope`, `scopeNames` (Task 2); `evaluateExpr`; `evaluateSuccess` and `SuccessInput` from `@/lib/studylab/activities/success`.
- Produces:
  - `tick(spec: MaterialSpec, state: MaterialState): TickResult` where
    `interface TickResult { scope: Record<string, number>; displays: Record<string, number>; says: string[]; solved: boolean }`
  - `allowsMove(spec: MaterialSpec, state: MaterialState, move: { pieceId: string; slotId: string }): boolean`
  - `applyMove(spec, state, move): MaterialState` — returns the state unchanged plus a `rejectedMoves` entry when the move is refused.
  - `hasCycle(spec: MaterialSpec): boolean`

- [ ] **Step 1: Write the failing test**

```ts
// lib/studylab/material/interpreter.test.ts
import { describe, it, expect } from 'vitest'
import { tick, allowsMove, applyMove, hasCycle } from './interpreter'
import type { MaterialSpec, MaterialState } from './types'

/** A balance that weighs a chemical equation — the spec's own worked example. */
const balance = {
  prompt: 'Balance both sides.',
  pieces: [
    { id: 'h2', label: 'H₂', traits: { h: 2, o: 0, kind: 'reactant' } },
    { id: 'o2', label: 'O₂', traits: { h: 0, o: 2, kind: 'reactant' } },
    { id: 'w', label: 'H₂O', traits: { h: 2, o: 1, kind: 'product' } },
  ],
  groups: [
    { id: 'left', label: 'Left', ordered: false },
    { id: 'right', label: 'Right', ordered: false },
  ],
  slots: [
    { id: 'l1', groupId: 'left', x: 0, y: 0, capacity: 2 },
    { id: 'r1', groupId: 'right', x: 0, y: 0, capacity: 2 },
  ],
  displays: [{ id: 'beam', kind: 'beam' as const, min: -10, max: 10 }],
  rules: [
    { op: 'derive' as const, name: 'diff', expr: '(sum_h_left + sum_o_left) - (sum_h_right + sum_o_right)' },
    { op: 'bind' as const, target: 'beam', expr: 'diff' },
    { op: 'when' as const, predicate: { cmp: '==' as const, left: 'diff', right: '0' }, then: [{ say: 'Both sides weigh the same.' }] },
    { op: 'allow' as const, selector: { trait: 'kind', equals: 'reactant' }, groupId: 'left' },
    { op: 'allow' as const, selector: { trait: 'kind', equals: 'product' }, groupId: 'right' },
  ],
  goal: { kind: 'numericWithin' as const, target: 0, tolerance: 0 },
} as MaterialSpec

const st = (placement: Record<string, string>): MaterialState => ({
  placement, controls: {}, attempts: 0, rejectedMoves: [], status: 'in_progress',
})

describe('tick', () => {
  it('derives a value from the board and binds a display to it', () => {
    const r = tick(balance, st({ h2: 'l1', w: 'r1' }))
    expect(r.scope.diff).toBe(2 - 3)          // (2+0) - (2+1)
    expect(r.displays.beam).toBe(-1)
  })

  it('fires a when-rule only while its predicate holds', () => {
    expect(tick(balance, st({ h2: 'l1', o2: 'l1' })).says).toEqual([])
    // 4 on the left against nothing is not equal; place nothing on the right.
    const balanced = tick(balance, st({}))     // 0 - 0 === 0
    expect(balanced.says).toEqual(['Both sides weigh the same.'])
  })

  it('reports solved through the existing success algebra', () => {
    expect(tick(balance, st({})).solved).toBe(true)
    expect(tick(balance, st({ h2: 'l1' })).solved).toBe(false)
  })

  it('reads an expression naming nothing as a failed evaluation, not zero', () => {
    const bad = { ...balance, rules: [{ op: 'derive' as const, name: 'x', expr: 'sum_mass_left' }] } as MaterialSpec
    expect(tick(bad, st({})).scope.x).toBeUndefined()
  })
})

describe('allowsMove — control of error at the moment of action', () => {
  it('permits a piece whose trait matches the group it is offered to', () => {
    expect(allowsMove(balance, st({}), { pieceId: 'h2', slotId: 'l1' })).toBe(true)
  })

  it('refuses a product onto the reactant side', () => {
    expect(allowsMove(balance, st({}), { pieceId: 'w', slotId: 'l1' })).toBe(false)
  })

  it('refuses a move into a slot already at capacity', () => {
    const full = st({ h2: 'l1', o2: 'l1' })    // l1 capacity is 2
    expect(allowsMove(balance, full, { pieceId: 'w', slotId: 'l1' })).toBe(false)
  })

  it('permits anything into a group with no allow rule naming it', () => {
    // A group nobody constrained is open. Silence is not a prohibition.
    const open = { ...balance, rules: balance.rules.filter((r) => r.op !== 'allow') } as MaterialSpec
    expect(allowsMove(open, st({}), { pieceId: 'w', slotId: 'l1' })).toBe(true)
  })
})

describe('applyMove', () => {
  it('records a refused move rather than discarding it', () => {
    // The piece springs back so the student self-corrects, but the attempt is
    // the clearest misconception signal available.
    const next = applyMove(balance, st({}), { pieceId: 'w', slotId: 'l1' })
    expect(next.placement.w).toBeUndefined()
    expect(next.rejectedMoves).toEqual([{ pieceId: 'w', slotId: 'l1' }])
  })

  it('places a legal move and counts the attempt', () => {
    const next = applyMove(balance, st({}), { pieceId: 'h2', slotId: 'l1' })
    expect(next.placement.h2).toBe('l1')
    expect(next.attempts).toBe(1)
  })
})

describe('hasCycle', () => {
  it('accepts rules that settle in one pass', () => {
    expect(hasCycle(balance)).toBe(false)
  })

  it('rejects a derive that reads its own output', () => {
    const looped = { ...balance, rules: [{ op: 'derive' as const, name: 'x', expr: 'x + 1' }] } as MaterialSpec
    expect(hasCycle(looped)).toBe(true)
  })

  it('rejects a pair of derives that read each other', () => {
    const pair = { ...balance, rules: [
      { op: 'derive' as const, name: 'x', expr: 'y + 1' },
      { op: 'derive' as const, name: 'y', expr: 'x + 1' },
    ] } as MaterialSpec
    expect(hasCycle(pair)).toBe(true)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/studylab/material/interpreter`
Expected: FAIL with `Failed to resolve import "./interpreter"`.

- [ ] **Step 3: Write `lib/studylab/material/interpreter.ts`**

`tick` runs the spec's Evaluation section in order: build the scope, evaluate `derive` rules in declaration order writing each result into the scope, evaluate `bind` rules into `displays`, evaluate `when` rules once applying their effects, then rebuild the scope and re-run `derive`/`bind` once so bindings see the effects. Then evaluate the goal through `evaluateSuccess`, converting the placement into a `SuccessInput` (`set` = placed piece ids; `assign` = pieceId → groupId; `order` = ordered groups' pieces by slot `index`; `value` = the sole `bind` target when the goal is `numericWithin`).

A `derive` whose `evaluateExpr` returns `null` leaves its name **absent** from the scope rather than writing `0` — the test pins this.

`hasCycle` builds a dependency graph from each `derive` name to the scope names its expression mentions, and reports a cycle by depth-first search. Detecting it here is what lets `tick` be two passes rather than a loop.

- [ ] **Step 4: Run the test**

Run: `npx vitest run lib/studylab/material/interpreter`
Expected: PASS.

- [ ] **Step 5: Run the whole suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/studylab/material/interpreter.ts lib/studylab/material/interpreter.test.ts
git commit -m "feat(studylab): the rules that make a material behave

derive, bind, when and allow, evaluated in two passes rather than to a
fixed point — a rule set needing a third pass is a cycle, and rejecting
it here is what keeps a tick cheap and the solvability search possible.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Isolation of a single quality

The deepest Montessori principle and the most violated: the pink tower varies size only, not colour, not shape, not material. In a closed vocabulary it is a static count.

**Files:**
- Create: `lib/studylab/material/isolation.ts`
- Test: `lib/studylab/material/isolation.test.ts`

**Interfaces:**
- Consumes: `MaterialSpec` (Task 1).
- Produces: `varyingTraits(spec: MaterialSpec): string[]`, and
  `checkIsolation(spec, maxVarying: number): { ok: true } | { ok: false; reason: string }`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/studylab/material/isolation.test.ts
import { describe, it, expect } from 'vitest'
import { varyingTraits, checkIsolation } from './isolation'
import type { MaterialSpec } from './types'

const of = (pieces: { id: string; label: string; traits: Record<string, number | string> }[]) =>
  ({ prompt: 'p', pieces, groups: [], slots: [], rules: [],
     goal: { kind: 'exactSet' as const, itemIds: [] } }) as MaterialSpec

describe('varyingTraits', () => {
  it('names the one trait that differs', () => {
    expect(varyingTraits(of([
      { id: 'a', label: 'A', traits: { size: 1, colour: 'red' } },
      { id: 'b', label: 'B', traits: { size: 2, colour: 'red' } },
    ]))).toEqual(['size'])
  })

  it('names all of them when a material varies several at once', () => {
    expect(varyingTraits(of([
      { id: 'a', label: 'A', traits: { size: 1, colour: 'red', shape: 'cube' } },
      { id: 'b', label: 'B', traits: { size: 2, colour: 'blue', shape: 'ball' } },
    ])).sort()).toEqual(['colour', 'shape', 'size'])
  })

  it('says a material where every piece is identical varies nothing', () => {
    expect(varyingTraits(of([
      { id: 'a', label: 'A', traits: { size: 1 } },
      { id: 'b', label: 'B', traits: { size: 1 } },
    ]))).toEqual([])
  })

  it('treats a trait missing from some pieces as varying', () => {
    expect(varyingTraits(of([
      { id: 'a', label: 'A', traits: { size: 1 } },
      { id: 'b', label: 'B', traits: {} },
    ]))).toEqual(['size'])
  })
})

describe('checkIsolation', () => {
  const twoTraits = of([
    { id: 'a', label: 'A', traits: { size: 1, colour: 'red' } },
    { id: 'b', label: 'B', traits: { size: 2, colour: 'blue' } },
  ])

  it('passes a material varying exactly what it is allowed to', () => {
    expect(checkIsolation(twoTraits, 2)).toEqual({ ok: true })
  })

  it('refuses one varying more than its apparatus allows, and names them', () => {
    const r = checkIsolation(twoTraits, 1)
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.reason).toContain('size')
    expect(r.ok === false && r.reason).toContain('colour')
  })

  it('refuses a material that varies nothing at all', () => {
    // Nothing to notice means nothing to learn — the same fault as a sorting
    // frame whose items all land in one bin.
    const r = checkIsolation(of([
      { id: 'a', label: 'A', traits: { size: 1 } },
      { id: 'b', label: 'B', traits: { size: 1 } },
    ]), 1)
    expect(r.ok).toBe(false)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/studylab/material/isolation`
Expected: FAIL with `Failed to resolve import "./isolation"`.

- [ ] **Step 3: Write `lib/studylab/material/isolation.ts`**

`varyingTraits` collects the union of every trait key across pieces, then keeps those whose value differs across pieces — a key absent from one piece counts as differing. `checkIsolation` refuses when the count exceeds `maxVarying`, naming every varying trait, and refuses when it is zero, saying the material offers no decision.

- [ ] **Step 4: Run the test**

Run: `npx vitest run lib/studylab/material/isolation`
Expected: PASS.

- [ ] **Step 5: Run the whole suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/studylab/material/isolation.ts lib/studylab/material/isolation.test.ts
git commit -m "feat(studylab): a material varies one thing, and that is checkable

The pink tower varies size and nothing else. In a closed vocabulary that
principle stops being advice and becomes a static count.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: The fit check, and one source for the geometry

Solvable is not the same as fits. Phase 1 spent four fix rounds on pieces growing out of a box whose parent could not expand, and a composed scene is worse because the tutor chooses how many slots a group has. The limits live in **one** exported object, so the validator and (later) the schema shown to the model cannot drift — the mistake Phase 1 made with the item caps.

**Files:**
- Create: `lib/studylab/material/fit.ts`
- Test: `lib/studylab/material/fit.test.ts`

**Interfaces:**
- Consumes: `MaterialSpec` (Task 1).
- Produces: `MATERIAL_BOX` (the single geometry source) and
  `fitsInBox(spec: MaterialSpec): { ok: true } | { ok: false; reason: string }`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/studylab/material/fit.test.ts
import { describe, it, expect } from 'vitest'
import { MATERIAL_BOX, fitsInBox } from './fit'
import type { MaterialSpec } from './types'

const withGroups = (groups: number, slotsPerGroup: number) => {
  const g = Array.from({ length: groups }, (_, i) => ({ id: `g${i}`, label: `G${i}`, ordered: false }))
  const slots = g.flatMap((grp, gi) =>
    Array.from({ length: slotsPerGroup }, (_, si) => ({ id: `s${gi}-${si}`, groupId: grp.id, x: si, y: 0, capacity: 1 })))
  return { prompt: 'p', pieces: [], groups: g, slots, rules: [],
           goal: { kind: 'exactSet' as const, itemIds: [] } } as MaterialSpec
}

describe('MATERIAL_BOX', () => {
  it('states the drawn box once, for everyone who needs it', () => {
    // The Phase 1 fault this exists to prevent: a cap enforced by a validator
    // and never mentioned to the model, so good material was refused as
    // "malformed" with no reason anyone could act on.
    expect(MATERIAL_BOX.widthPx).toBeGreaterThan(0)
    expect(MATERIAL_BOX.heightPx).toBeGreaterThan(0)
    expect(MATERIAL_BOX.maxSlotsPerRow).toBeGreaterThan(0)
    expect(MATERIAL_BOX.maxRows).toBeGreaterThan(0)
  })
})

describe('fitsInBox', () => {
  it('passes a scene the box can draw', () => {
    expect(fitsInBox(withGroups(2, 2))).toEqual({ ok: true })
  })

  it('refuses more groups than fit side by side, and says how many fit', () => {
    const r = fitsInBox(withGroups(MATERIAL_BOX.maxGroupsPerRow + 1, 1))
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.reason).toContain(String(MATERIAL_BOX.maxGroupsPerRow))
  })

  it('refuses a group with more slots than its zone can hold', () => {
    const tooMany = MATERIAL_BOX.maxSlotsPerRow * MATERIAL_BOX.maxRows + 1
    const r = fitsInBox(withGroups(1, tooMany))
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.reason).toContain('slots')
  })

  it('names the offending group so the tutor can shrink that one', () => {
    const spec = withGroups(2, 1)
    spec.slots.push(...Array.from({ length: 40 }, (_, i) => ({ id: `x${i}`, groupId: 'g1', x: i, y: 0, capacity: 1 })))
    const r = fitsInBox(spec)
    expect(r.ok === false && r.reason).toContain('g1')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/studylab/material/fit`
Expected: FAIL with `Failed to resolve import "./fit"`.

- [ ] **Step 3: Write `lib/studylab/material/fit.ts`**

Export a single frozen `MATERIAL_BOX` carrying `widthPx`, `heightPx`, `maxGroupsPerRow`, `maxSlotsPerRow` and `maxRows`, each derived from the card the material is drawn on — the activity card is 420px wide (`lib/studylab/blocks.ts`, `def('activity', 'ai', 420, 380)`) and `ActivityFrame` spends `p-4` plus a bordered `p-3` wrapper, leaving ~360px of content. Derive the slot counts from that width and a chip's size, in the style of `lib/studylab/activities/dropZoneGeometry.ts`, and comment each term with what it measures.

`fitsInBox` refuses when the group count exceeds `maxGroupsPerRow`, or any group's slot count exceeds `maxSlotsPerRow * maxRows`, naming the group and the limit.

- [ ] **Step 4: Run the test**

Run: `npx vitest run lib/studylab/material/fit`
Expected: PASS.

- [ ] **Step 5: Run the whole suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/studylab/material/fit.ts lib/studylab/material/fit.test.ts
git commit -m "feat(studylab): a material that cannot be drawn is refused too

Solvable and fits are different questions, and phase 1 only asked the
first. One frozen source for the geometry, so the check and whatever
later advertises it to the model cannot drift apart.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: The solvability prover

Search the legal moves against the goal and confirm at least one sequence reaches it. This is the check that makes a whole class of shipped bug impossible — the `compose` material where one mistyped label meant no bond was ever legal, and the student sat in front of something that could not be completed with nothing to tell them why.

**Files:**
- Create: `lib/studylab/material/solvable.ts`
- Test: `lib/studylab/material/solvable.test.ts`

**Interfaces:**
- Consumes: `allowsMove`, `applyMove`, `tick` (Task 3).
- Produces: `MAX_STATES` and
  `isSolvable(spec: MaterialSpec): { ok: true; moves: number } | { ok: false; reason: 'unreachable' | 'too-large' }`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/studylab/material/solvable.test.ts
import { describe, it, expect } from 'vitest'
import { isSolvable, MAX_STATES } from './solvable'
import type { MaterialSpec } from './types'

const sortInto = (bins: string[], items: { id: string; bin: string }[]): MaterialSpec => ({
  prompt: 'Sort them.',
  pieces: items.map((i) => ({ id: i.id, label: i.id, traits: { home: i.bin } })),
  groups: bins.map((b) => ({ id: b, label: b, ordered: false })),
  slots: bins.map((b) => ({ id: `s-${b}`, groupId: b, x: 0, y: 0, capacity: 4 })),
  rules: [],
  goal: { kind: 'binAssignment', assign: Object.fromEntries(items.map((i) => [i.id, i.bin])) },
})

describe('isSolvable', () => {
  it('finds the sequence that completes an ordinary material', () => {
    const r = isSolvable(sortInto(['acid', 'base'], [{ id: 'hcl', bin: 'acid' }, { id: 'koh', bin: 'base' }]))
    expect(r.ok).toBe(true)
    expect(r.ok === true && r.moves).toBe(2)
  })

  it('refuses a material whose goal names a group that does not exist', () => {
    // The compose fault, in the new vocabulary: a goal nothing can satisfy.
    const impossible = sortInto(['acid'], [{ id: 'hcl', bin: 'acid' }])
    impossible.goal = { kind: 'binAssignment', assign: { hcl: 'nowhere' } }
    expect(isSolvable(impossible)).toEqual({ ok: false, reason: 'unreachable' })
  })

  it('refuses a material whose allow rules forbid the only winning move', () => {
    const blocked = sortInto(['acid', 'base'], [{ id: 'hcl', bin: 'acid' }])
    blocked.rules = [{ op: 'allow', selector: { trait: 'home', equals: 'base' }, groupId: 'acid' }]
    expect(isSolvable(blocked)).toEqual({ ok: false, reason: 'unreachable' })
  })

  it('gives up on a material too large to hold, rather than hanging', () => {
    // A material with an astronomical state space is a bad material anyway —
    // the child cannot hold it. The cap does pedagogical work, not just
    // computational.
    const huge = sortInto(
      ['a', 'b', 'c', 'd', 'e', 'f'],
      Array.from({ length: 14 }, (_, i) => ({ id: `p${i}`, bin: 'a' })),
    )
    expect(isSolvable(huge)).toEqual({ ok: false, reason: 'too-large' })
  })

  it('states the cap as a number others can read', () => {
    expect(MAX_STATES).toBe(50_000)
  })

  it('finishes an ordinary material quickly', () => {
    const started = Date.now()
    isSolvable(sortInto(['a', 'b', 'c'], Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, bin: 'a' }))))
    expect(Date.now() - started).toBeLessThan(2000)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/studylab/material/solvable`
Expected: FAIL with `Failed to resolve import "./solvable"`.

- [ ] **Step 3: Write `lib/studylab/material/solvable.ts`**

Breadth-first over states, where a state is the placement map plus discretised control values, keyed for the visited set by a canonical string. Successors are every `(piece, slot)` pair `allowsMove` permits. Stop and return `{ ok: true, moves }` at the first state whose `tick(...).solved` is true; return `{ ok: false, reason: 'too-large' }` on exceeding `MAX_STATES = 50_000`; `{ ok: false, reason: 'unreachable' }` when the frontier empties.

Controls make the space continuous, so discretise each by its `step` and cap a control's sampled values at 20, commenting that a control a student must set to one of hundreds of values is not a material either.

- [ ] **Step 4: Run the test**

Run: `npx vitest run lib/studylab/material/solvable`
Expected: PASS.

- [ ] **Step 5: Run the whole suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/studylab/material/solvable.ts lib/studylab/material/solvable.test.ts
git commit -m "feat(studylab): prove a material can be finished before a child meets one

compose shipped a material where one mistyped label made every bond
illegal, and nothing said so. Searching a closed language settles that
question statically, which is the argument for composing material rather
than generating it.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: The composite gate

One function the rest of the system will call, so no caller has to remember the order or the three separate refusals.

**Files:**
- Create: `lib/studylab/material/validate.ts`
- Test: `lib/studylab/material/validate.test.ts`

**Interfaces:**
- Consumes: `parseMaterialSpec` (Task 1), `hasCycle` (Task 3), `checkIsolation` (Task 4), `fitsInBox` (Task 5), `isSolvable` (Task 6).
- Produces: `validateMaterial(raw: unknown, maxVarying?: number): { ok: true; spec: MaterialSpec } | { ok: false; reason: string }`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/studylab/material/validate.test.ts
import { describe, it, expect } from 'vitest'
import { validateMaterial } from './validate'

const sortSpec = {
  prompt: 'Sort them.',
  pieces: [
    { id: 'hcl', label: 'HCl', traits: { home: 'acid' } },
    { id: 'koh', label: 'KOH', traits: { home: 'base' } },
  ],
  groups: [{ id: 'acid', label: 'Acid', ordered: false }, { id: 'base', label: 'Base', ordered: false }],
  slots: [
    { id: 's-acid', groupId: 'acid', x: 0, y: 0, capacity: 4 },
    { id: 's-base', groupId: 'base', x: 1, y: 0, capacity: 4 },
  ],
  rules: [],
  goal: { kind: 'binAssignment', assign: { hcl: 'acid', koh: 'base' } },
}

describe('validateMaterial', () => {
  it('passes a material that is well formed, isolating, drawable and solvable', () => {
    const r = validateMaterial(sortSpec, 1)
    expect(r.ok).toBe(true)
    expect(r.ok === true && r.spec.pieces).toHaveLength(2)
  })

  it('refuses malformed output first, before the expensive checks', () => {
    const r = validateMaterial({ pieces: 'two' })
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.reason).toMatch(/could not be read/i)
  })

  it('refuses a cyclic rule set', () => {
    const cyclic = { ...sortSpec, rules: [{ op: 'derive', name: 'x', expr: 'x + 1' }] }
    const r = validateMaterial(cyclic, 1)
    expect(r.ok === false && r.reason).toMatch(/cycle/i)
  })

  it('refuses one that varies more than it claims to isolate, naming the traits', () => {
    const twoWay = { ...sortSpec, pieces: [
      { id: 'hcl', label: 'HCl', traits: { home: 'acid', colour: 'red' } },
      { id: 'koh', label: 'KOH', traits: { home: 'base', colour: 'blue' } },
    ] }
    const r = validateMaterial(twoWay, 1)
    expect(r.ok === false && r.reason).toContain('colour')
  })

  it('refuses one that cannot be finished, and says so in those words', () => {
    const stuck = { ...sortSpec, goal: { kind: 'binAssignment', assign: { hcl: 'nowhere' } } }
    const r = validateMaterial(stuck, 1)
    expect(r.ok === false && r.reason).toMatch(/cannot be completed/i)
  })

  it('gives a reason specific enough for the next attempt to act on', () => {
    // A refusal that only says "invalid" produces the same material again.
    const r = validateMaterial({ ...sortSpec, goal: { kind: 'binAssignment', assign: { hcl: 'nowhere' } } }, 1)
    expect(r.ok === false && r.reason.length).toBeGreaterThan(30)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/studylab/material/validate`
Expected: FAIL with `Failed to resolve import "./validate"`.

- [ ] **Step 3: Write `lib/studylab/material/validate.ts`**

Run the checks cheapest-first: parse, then cycle, then isolation, then fit, then solvability. Each refusal returns a sentence naming what is wrong and what would fix it, in the voice of `checkIntent` in `lib/studylab/activities/intent.ts`. Default `maxVarying` to 1.

- [ ] **Step 4: Run the test**

Run: `npx vitest run lib/studylab/material/validate`
Expected: PASS.

- [ ] **Step 5: Run the whole suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/studylab/material/validate.ts lib/studylab/material/validate.test.ts
git commit -m "feat(studylab): one gate a material passes before anyone sees it

Cheapest check first, and every refusal names what would fix it — a
refusal that only says invalid produces the same material again.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: The canon, and the first four apparatus

The canon is what makes the generativity safe: the tutor instantiates a *recognisable* apparatus and extends it, rather than inventing a new contraption each lesson. Each entry is written in the vocabulary — there is no second, privileged mechanism.

Each entry also carries `fromLegacy`, converting the corresponding old payload into a `MaterialSpec`. That is what the equivalence test uses, and later what migrates stored lessons.

**Files:**
- Create: `lib/studylab/material/canon/index.ts`
- Create: `lib/studylab/material/canon/{sortingFrame,orderingTrack,threePeriodCards,vennSets}.ts`
- Test: `lib/studylab/material/canon/equivalence.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 1-7; the nine pattern modules under `@/lib/studylab/activities/patterns/`.
- Produces:
  ```ts
  export interface Apparatus {
    name: string
    /** How many traits may vary across manipulable pieces. Default 1. */
    maxVaryingTraits: number
    /** Base scene and rules, which the tutor extends with content. */
    base: MaterialSpec
    /** The legacy pattern this replaces, and how to convert its payload. */
    legacy?: { pattern: ActivityPattern; fromLegacy(payload: unknown): MaterialSpec | null }
  }
  export function getApparatus(name: string): Apparatus | null
  export function apparatusNames(): string[]
  ```

- [ ] **Step 1: Write the failing equivalence test**

```ts
// lib/studylab/material/canon/equivalence.test.ts
import { describe, it, expect } from 'vitest'
import { getApparatus, apparatusNames } from './index'
import { validateMaterial } from '../validate'
import { tick } from '../interpreter'
import { getPatternModule } from '@/lib/studylab/activities/registry'
import type { MaterialState } from '../types'

const placed = (placement: Record<string, string>): MaterialState =>
  ({ placement, controls: {}, attempts: 0, rejectedMoves: [], status: 'in_progress' })

describe('the canon', () => {
  it('uses a Map, so a name out of model output cannot reach Object.prototype', () => {
    expect(getApparatus('__proto__')).toBeNull()
    expect(getApparatus('constructor')).toBeNull()
    expect(getApparatus('nope')).toBeNull()
  })

  it('every entry is itself a valid material', () => {
    // The canon is written in the vocabulary, not above it. An entry that
    // could not pass the gate would be a second, privileged mechanism.
    for (const name of apparatusNames()) {
      const a = getApparatus(name)!
      const r = validateMaterial(a.base, a.maxVaryingTraits)
      expect(r.ok, `${name}: ${r.ok === false ? r.reason : ''}`).toBe(true)
    }
  })
})

describe('a sorting frame agrees with the sort pattern it replaces', () => {
  const payload = {
    bins: [{ id: 'acid', label: 'Acid' }, { id: 'base', label: 'Base' }],
    items: [{ id: 'hcl', label: 'HCl', binId: 'acid' }, { id: 'koh', label: 'KOH', binId: 'base' }],
  }
  const success = { kind: 'binAssignment' as const, assign: { hcl: 'acid', koh: 'base' } }

  it('calls the same placements solved', () => {
    const spec = getApparatus('sorting-frame')!.legacy!.fromLegacy(payload)!
    const legacy = getPatternModule('sort')!

    const cases: Record<string, string>[] = [
      { hcl: 'acid', koh: 'base' },   // right
      { hcl: 'base', koh: 'acid' },   // swapped
      { hcl: 'acid' },                // half done
      {},                             // untouched
    ]
    for (const placement of cases) {
      const mine = tick(spec, placed(
        Object.fromEntries(Object.entries(placement).map(([p, g]) => [p, `s-${g}`])),
      )).solved
      const theirs = legacy.validate(payload as never, { assign: placement } as never, success).ok
      expect(mine, JSON.stringify(placement)).toBe(theirs)
    }
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/studylab/material/canon`
Expected: FAIL with `Failed to resolve import "./index"`.

- [ ] **Step 3: Write `lib/studylab/material/canon/index.ts`**

```ts
// A Map, NOT an object literal: `name` originates in model output, and
// indexing an object literal reaches Object.prototype — so '__proto__' and
// 'constructor' would resolve to truthy non-entries and sail past a null check.
const CANON = new Map<string, Apparatus>([
  ['sorting-frame', sortingFrame],
  ['ordering-track', orderingTrack],
  ['three-period-cards', threePeriodCards],
  ['venn-sets', vennSets],
])

export function getApparatus(name: string): Apparatus | null {
  return CANON.get(name) ?? null
}
export function apparatusNames(): string[] {
  return [...CANON.keys()]
}
```

- [ ] **Step 4: Write the four entries**

Each file exports one `Apparatus`. `sorting-frame` replaces `sort` (`maxVaryingTraits: 1`), `ordering-track` replaces `sequence` (ordered groups, `maxVaryingTraits: 1`), `three-period-cards` replaces `threePeriod` (`maxVaryingTraits: 1`), `venn-sets` replaces `compare` (`maxVaryingTraits: 2` — a Venn genuinely needs two dimensions, and the spec says so).

Each `fromLegacy` returns `null` rather than throwing when the payload does not fit its pattern.

- [ ] **Step 5: Run the test**

Run: `npx vitest run lib/studylab/material/canon`
Expected: PASS.

- [ ] **Step 6: Run the whole suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: both PASS. **The nine pattern modules must be untouched** — confirm with `git status` that nothing under `lib/studylab/activities/patterns/` is modified.

- [ ] **Step 7: Commit**

```bash
git add lib/studylab/material/canon
git commit -m "feat(studylab): the first four apparatus, written in the vocabulary

The canon is what keeps the generativity familiar: a recognisable
apparatus doing new work, rather than a new contraption every lesson.
Each entry is an ordinary material and passes the same gate, and each
agrees with the pattern it replaces on what counts as solved.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: The remaining five apparatus

**Files:**
- Create: `lib/studylab/material/canon/{balanceBeam,labelledDiagram,variableModel,decisionBranch,bondingRing}.ts`
- Modify: `lib/studylab/material/canon/index.ts`
- Modify: `lib/studylab/material/canon/equivalence.test.ts`

**Interfaces:**
- Consumes: `Apparatus`, `getApparatus`, `apparatusNames` (Task 8).
- Produces: five more canon entries, registered in the same `Map`.

- [ ] **Step 1: Extend the equivalence test to every entry**

Add a table-driven case covering all nine, so a later entry cannot land untested:

```ts
interface Case {
  apparatus: string
  pattern: string
  payload: unknown
  success: unknown
  /** pieceId -> groupId. Must include solved, wrong, partial and untouched. */
  placements: Record<string, string>[]
  /** How the legacy module's `work` is shaped for this pattern. */
  toWork(placement: Record<string, string>): unknown
}

const CASES: Case[] = [
  {
    apparatus: 'sorting-frame',
    pattern: 'sort',
    payload: {
      bins: [{ id: 'acid', label: 'Acid' }, { id: 'base', label: 'Base' }],
      items: [{ id: 'hcl', label: 'HCl', binId: 'acid' }, { id: 'koh', label: 'KOH', binId: 'base' }],
    },
    success: { kind: 'binAssignment', assign: { hcl: 'acid', koh: 'base' } },
    placements: [
      { hcl: 'acid', koh: 'base' },   // solved
      { hcl: 'base', koh: 'acid' },   // wrong
      { hcl: 'acid' },                // partial
      {},                             // untouched
    ],
    toWork: (placement) => ({ assign: placement }),
  },
  // …one row of exactly this shape for each of the other eight apparatus.
  // Read each pattern module's `validate` to see how its `work` is shaped —
  // `sort`/`compare` use `{ assign }`, `sequence` uses `{ order }`,
  // `compose` uses `{ joins }` — and write `toWork` to match.
]

describe('every apparatus that replaces a pattern agrees with it', () => {
  it('covers every apparatus that declares a legacy pattern', () => {
    // A later entry cannot land untested: this fails the moment the canon
    // grows an entry with no row here.
    const declared = apparatusNames().filter((n) => getApparatus(n)!.legacy)
    expect(CASES.map((c) => c.apparatus).sort()).toEqual(declared.sort())
  })

  for (const c of CASES) {
    it(`${c.apparatus} calls the same boards solved as ${c.pattern}`, () => {
      const spec = getApparatus(c.apparatus)!.legacy!.fromLegacy(c.payload)!
      const legacy = getPatternModule(c.pattern as never)!
      for (const placement of c.placements) {
        const mine = tick(spec, placed(
          Object.fromEntries(Object.entries(placement).map(([p, g]) => [p, `s-${g}`])),
        )).solved
        const theirs = legacy.validate(c.payload as never, c.toWork(placement) as never, c.success as never).ok
        expect(mine, `${c.apparatus} ${JSON.stringify(placement)}`).toBe(theirs)
      }
    })
  }
})
```

Write the eight remaining rows in exactly that shape — the three from Task 8 that are not already covered, plus the five added here. The coverage assertion is what forces it: it fails until every canon entry declaring a `legacy` pattern has a row.

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/studylab/material/canon`
Expected: FAIL — the coverage assertion lists five apparatus that do not exist yet.

- [ ] **Step 3: Write the five entries**

`balance-beam` replaces `balance` (two pans as groups, a `beam` display bound to the difference, `maxVaryingTraits: 1`). `labelled-diagram` replaces `label` (hotspots as single-capacity slots at their `x`/`y`, `maxVaryingTraits: 1`). `variable-model` replaces `vary` (a `Control` plus `bind` rules onto a `bar`/`tank`/`plot` display, `maxVaryingTraits: 1`). `decision-branch` replaces `scenario` (`maxVaryingTraits: 1`). `bonding-ring` replaces `compose` — and note in its comment that its legacy `validJoins` matches part **labels**, not ids, because `accepts()` compares labels; that mismatch was a real shipped fault.

Register all five in the `Map` in `index.ts`.

- [ ] **Step 4: Run the test**

Run: `npx vitest run lib/studylab/material/canon`
Expected: PASS, with all nine covered.

- [ ] **Step 5: Run the whole suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: both PASS. Confirm again that nothing under `lib/studylab/activities/patterns/` is modified.

- [ ] **Step 6: Commit**

```bash
git add lib/studylab/material/canon
git commit -m "feat(studylab): the nine, re-expressed as composed material

Every apparatus now agrees with the pattern it replaces on what counts
as solved, across a solved, wrong, partial and untouched board. That
agreement is what lets the renderer switch over later without a flag
day, and what will let the old modules be deleted one at a time.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## What this leaves for the next plan

At the end of Task 9 the engine exists, is proven against the nine patterns it replaces, and is reachable from nothing. Deliberately still to do:

- **Stage 3** — a renderer that draws a `MaterialSpec`, replacing the nine renderers one at a time as their canon entries take over. This is where `MATERIAL_BOX` stops being an assertion and becomes the actual layout, and it needs a browser pass: the suite is node-only, and Phase 1's two worst bugs were invisible to 1469 passing tests.
- **Stage 4** — `build_material` on the action union, the vocabulary advertised to the model **from `MATERIAL_BOX` and the canon rather than restated by hand**, and the schema listed in `systemPrompt(mode)`'s ACTION TYPES. Phase 1 proved a prompt block is inert unless the action contract lists the action.
- **The balance layout**, whose 2-item pan cap is carried debt. Stage 3 re-draws these boxes anyway, which is the moment to fix it.
