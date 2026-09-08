# A composable material engine for LearnSpace

**Status:** designed, not built
**Date:** 2026-09-07
**Supersedes:** the pattern-registry half of
`2026-07-30-studylab-montessori-activity-engine-design.md`. That engine's
security work, asset catalogue and renderers are kept; its nine closed payload
types are what this replaces.

## The problem

Montessori mode gives the tutor nine activity patterns — `threePeriod`, `sort`,
`label`, `sequence`, `vary`, `balance`, `compare`, `scenario`, `compose`. Each
is a closed payload type plus a renderer plus a declarative success rule. The
tutor's entire creative act is to pick one of nine names and fill in its blanks.

Two consequences, both observed:

- **It reaches for the same two.** With no reasoning step in front of the
  choice, `sort` and `threePeriod` fit everything badly and get picked
  constantly.
- **A topic outside the nine gets a bad fit or plain text.** There is no way to
  express a titration, a circuit, a pendulum or a food web, so the tutor either
  forces one into a sorting frame or falls back to prose.

The nine are not too few. They are the wrong *kind* of unit: whole finished
apparatus rather than parts that combine.

## What changes: familiar parts, novel combinations

The unit of composition drops below the apparatus. The tutor gets a small,
stable vocabulary of pieces and rules, and builds material out of it — the way
Scratch gives you the same blocks forever and every program is new.

The generativity is aimed carefully:

> **The vocabulary is generative. The child's encounter is familiar.**

A real Montessori environment is a small, deeply-known canon: the same golden
beads for two years, the same pink tower. Familiarity is load-bearing — because
the apparatus is already known, the child spends their whole attention on the
mathematics rather than on the interface. A system that invents a novel
contraption every lesson is an endless parade of new UIs, none ever mastered,
and is *further* from Montessori than the nine patterns are.

So the rule language exists to let a **recognisable apparatus do new work** — a
balance that weighs numbers, then chemical equations, then musical note values,
then supply and demand — not to invent a new device each time.

## Scope

**Phase 1 — the pedagogy layer.** The tutor reasons about what to teach and
what to isolate *before* it chooses material, and that reasoning is validated
rather than decorative. Built against the nine patterns that already exist.
Ships and is worth shipping alone.

**Phase 2 — the composable engine.** The vocabulary, the interpreter, the
canon, and the two validations. The nine become the canon's first entries.

Phase 1 earns Phase 2. If better reasoning over nine patterns teaches well and
the nine start to feel limiting *for the right reasons*, the engine is
justified by evidence rather than by assumption. If the tutor still teaches
badly, the engine would only have scaled the badness.

**Out of scope, deliberately:**

- **Rules that create or destroy pieces.** Real expressiveness (cell division, a
  reaction yielding products), but it makes the state space unbounded and the
  solvability proof below impossible. Revisit only with a different validation
  story.
- **Generated artwork.** A separate pipeline problem. Raster generation cannot
  happen inside a lesson turn — seconds of latency mid-lesson is not viable — so
  it is an offline catalogue-growing job, specced separately.
- **Model-authored component code.** The sandbox exists
  (`components/studylab/WebSandboxCard.tsx`, `sandbox="allow-scripts"`, no
  `allow-same-origin`), so this is buildable later as an *exploratory* card that
  can never close a step. Not built until a real topic defeats the vocabulary.

## Phase 1 — the pedagogy layer

Every material-producing turn must first state its teaching intent, as a typed
field the dispatcher validates:

```ts
interface TeachingIntent {
  /** What the student should be able to do after this, in one sentence. */
  goal: string
  /** The single quality this material varies. A trait name, not prose. */
  isolates: string
  /** Which apparatus, by canon name. */
  apparatus: string
  /** Why this apparatus suits this goal. One sentence, for the log and review. */
  why: string
}
```

`isolates` is the load-bearing field, and it is checked rather than trusted: the
named trait must actually be a trait that varies across the pieces the student
manipulates. An intent claiming to isolate `mass` on a set of pieces that all
share one mass — or that vary mass, colour and size together — is rejected and
the tutor is told which.

In Phase 1 this validates against the nine existing payloads. In Phase 2 the
same check runs against the composed piece set, unchanged. That continuity is
the point: Phase 1 is not scaffolding to be thrown away.

## Phase 2 — the composable engine

### The vocabulary

Five nouns, four verbs. Small on purpose — the power is combination, not count.

```ts
/** A thing the student can move. Traits are the topic's own vocabulary. */
interface Piece {
  id: string
  label: string
  /** Catalogue name, never a URL. Resolved via assetUrl(); unknown → text label. */
  art?: string
  traits: Record<string, number | string>
}

/** Somewhere a piece can sit. */
interface Slot {
  id: string
  groupId: string
  /** Board position, in the group's local frame. */
  x: number
  y: number
  capacity: number
  /** Position within an ordered group; absent when the group is unordered. */
  index?: number
}

/** A named set of slots: a bin, a pan, a track, a diagram's hotspots. */
interface Group {
  id: string
  label: string
  ordered: boolean
}

/** Something the student moves that is not a piece. */
interface Control {
  id: string
  label: string
  min: number
  max: number
  step: number
  unit?: string
}

/** Driven entirely by a bound expression; never by the student directly. */
interface Display {
  id: string
  kind: 'beam' | 'bar' | 'gauge' | 'tank' | 'plot'
  label?: string
  /** Bounds for the drawn range. */
  min: number
  max: number
}
```

The verbs are the active blocks:

```ts
type Rule =
  /** A named value read off the board. */
  | { op: 'derive'; name: string; expr: string }
  /** A continuous relationship. */
  | { op: 'bind'; target: string; expr: string }
  /** A discrete change. */
  | { op: 'when'; predicate: Predicate; then: Effect[] }
  /** What may go where — control of error at the moment of action. */
  | { op: 'allow'; selector: Selector; groupId: string }

/** Comparisons only; no boolean algebra beyond and/or, no negation of groups. */
type Predicate =
  | { cmp: '<' | '<=' | '>' | '>=' | '==' | '!='; left: string; right: string }
  | { all: Predicate[] }
  | { any: Predicate[] }

type Effect =
  | { set: string; expr: string }
  | { say: string }

/** Matches pieces by trait, never by arbitrary code. */
type Selector =
  | { trait: string; equals: number | string }
  | { trait: string; between: [number, number] }
  | { anyOf: Selector[] }
```

Every `expr` is a string evaluated by the existing hardened parser,
`lib/studylab/activities/expr.ts` — recursive descent, closed token set, no
`eval`, no `new Function`, fails closed. It was written to avoid the
parser-escape RCEs in mathjs (CVE-2026-41139) and expr-eval (CVE-2025-12735),
and it is reused here unchanged. **No new evaluation surface is introduced.**

Expressions read from a flat scope built by the interpreter each tick: derived
names, control values, display values, and aggregates over groups
(`sum_weight_leftPan`, `count_leftPan`). Aggregate names are *generated by the
engine* from the declared traits and groups, so an expression naming something
that does not exist fails validation rather than evaluating to zero.

### Evaluation

One tick, run after every student move and every control change:

1. Apply the move if an `allow` rule permits it; otherwise refuse it, spring the
   piece back, and record it in `rejectedMoves`.
2. Recompute aggregates from the board.
3. Evaluate `derive` rules in declaration order.
4. Evaluate `bind` rules.
5. Evaluate `when` rules once, in declaration order, applying effects.
6. Re-run 2–4 once so bindings see the effects.
7. Evaluate the goal.

Two passes, not to a fixed point. A rule set whose meaning depends on further
iteration is rejected at validation as cyclic — this keeps a tick O(rules) and
makes the solver below tractable.

### The canon

The tutor does not build from nothing. It instantiates a **named apparatus**
from a canon and extends it with content and rules:

`balance-beam` · `sorting-frame` · `number-line` · `labelled-diagram` ·
`three-period-cards` · `matching-pairs` · `ordering-track` · `venn-sets` ·
`decision-branch` · `variable-model`

Each canon entry is itself written in the vocabulary above — there is no second,
privileged mechanism. An entry declares its groups, its displays, its base rules,
and:

```ts
interface Apparatus {
  name: string
  /** How many traits may vary across manipulable pieces. Default 1. */
  maxVaryingTraits: number
  /** Base scene and rules, extended by the tutor. */
  base: MaterialSpec
}
```

The nine existing patterns become the first nine entries. They keep working
while the vocabulary grows underneath them, which is both the canon and the
migration path.

### Worked example

The student already knows the balance from weighing numbers. For conservation of
mass the tutor reuses it — same apparatus, same drag, same tilt feedback, new
work:

```
apparatus: balance-beam
pieces:    H₂  (h:2, o:0) · O₂ (h:0, o:2) · H₂O (h:2, o:1)
derive:    leftH  = sum_h_leftPan     rightH = sum_h_rightPan
           leftO  = sum_o_leftPan     rightO = sum_o_rightPan
bind:      beam.tilt = (leftH + leftO) - (rightH + rightO)
goal:      leftH == rightH and leftO == rightO
```

Nobody shipped a "chemical equation balancer". It is a recombination of parts
the student already recognises.

## Validation before a student sees it

Both checks are possible only because the language is closed and deterministic.
Neither is possible over generated code.

### Solvable

Search the legal moves against the goal; confirm at least one sequence reaches
it. State is the assignment of pieces to slots plus discretised control values,
so the space is finite. Breadth-first with a visited set, and a hard cap:

**An activity whose reachable state space exceeds 50,000 states is rejected.**

The cap is not only a performance bound. A Montessori material with an
astronomically large state space is a bad material — the child cannot hold it —
so the limit is doing pedagogical work as well as computational.

This closes a known live fault. Item 4 of the paused backlog: `compose` declares
its legal bonds as `validJoins: { a, b }[]`, and `accepts()` matches those
against part **labels**, not ids. Nothing checks that a label named there is a
label any part actually carries, so a single typo means no join is ever legal —
nothing can ever bond, **with no feedback**. A student sits in front of a
material that cannot be completed. That should be impossible to ship, not a bug
to be found later.

### Isolates one quality

Count the traits that vary across the pieces the student manipulates. If more
than `maxVaryingTraits` vary, reject and name them.

This is the deepest Montessori principle and the most violated: the pink tower
varies size only — not colour, not shape, not material. It is also, in a closed
vocabulary, a static check. Apparatus that genuinely need two dimensions
(`venn-sets`, `compare`) declare `maxVaryingTraits: 2`; the default is 1.

### Retained from the existing engine

Non-negotiable, carried over unchanged:

- **Model-authored SVG is never rendered.** `script`, `foreignObject` and bare
  `onload` make `dangerouslySetInnerHTML` an XSS vector. Art is referenced by
  catalogue name and resolved through `assetUrl()`; unknown names fall back to
  the piece's text label.
- **Art is a name, never a URL.** An unvalidated `src` from model output is a
  broken-image, tracking-pixel and SSRF risk at once.
- **Registry lookups use a `Map`, not an object literal.** Names originate in
  model output; indexing an object literal reaches `Object.prototype`, so
  `__proto__` and `constructor` resolve to truthy non-modules and sail past a
  `if (!mod)` guard.

## How it reaches the board

A material is a board node, like the homework `question` node and for the same
reason: it must be visible to the tutor without being writable by it.

`material` is **not** added to `CARD_KINDS` (`lib/studylab/blocks.ts:76`), so no
`createCard` can produce one. It is built by a dedicated dispatcher path that
validates the spec first — exactly the precedent set by `questionCards()` in
`lib/studylab/homework.ts`.

One new action on the union in `app/api/studylab/tutor/dispatch.ts`:

```ts
| { type: 'build_material'; intent: TeachingIntent; spec: MaterialSpec }
```

It is refused, with a reason, when the intent fails its check, when the spec
fails validation, when it is unsolvable, or when it varies too much. Refusals
are values — `{ ok: false, reason }` — consistent with `lib/studylab/lessonRun.ts`.

Solving a material resolves its `satisfiesCheckpoint` and closes the step
through `passCheck`, unchanged. The board summary lists materials so the next
turn can see what is already on the board.

## Data model

`MaterialSpec` and the student's `MaterialState` are stored in the lesson's
existing `canvas_state` JSON. No migration is needed for the engine itself.

`migrations/add-learnspace-mode.sql` — the `classic | montessori` column — is
still unapplied and is still required before either phase ships, or the StudyLab
hub 500s for every user.

## Error handling

- **Invalid spec** → refused at dispatch with the field named. Never rendered.
- **Unsolvable or over-varied** → refused with the reason, so the tutor can
  retry rather than the student meeting a dead material.
- **An expression naming something that does not exist** → validation failure,
  not a silent zero.
- **A refused move at runtime** → the piece springs back and the move is
  recorded in `rejectedMoves`. This is control of error, and the record is the
  clearest misconception signal available; without it, moves blocked by `allow`
  could never be reported to the tutor.
- **A rule set that would need more than two passes** → rejected as cyclic.

## Testing

The suite is vitest, **node environment only — no jsdom, no `.test.tsx`**. So
the engine is written as pure `lib/` logic and carries its own tests:

- **Interpreter** — one tick over hand-built scenes; declaration order; the
  two-pass rule; cyclic detection.
- **Solver** — solvable and unsolvable materials, including a reconstruction of
  the `compose` label-mismatch fault, which must now be rejected.
- **Isolation check** — one varying trait passes, three fail, `maxVaryingTraits: 2`
  apparatus pass on two.
- **Canon** — every entry validates, is solvable in its base form, and round-trips.
- **Migration** — each of the nine patterns, expressed in the vocabulary,
  produces the same success verdicts as its original module for the same work.

Renderers cannot be unit-tested here, and the paused work's hardest-won lesson
says they should not be trusted anyway: *verifying a component in isolation
proves nothing — two Criticals and the "montessori emits zero activities"
failure only appeared when driving a real tutor lesson.* Renderer verification
is a browser pass driving a real lesson, using the mouse path rather than the
keyboard path, which once gave a false pass on drag while the mouse path was
entirely dead.

## Migration

1. The vocabulary, interpreter and validators land with no renderer and no
   tutor access. Pure `lib/`, fully tested.
2. Each of the nine patterns is re-expressed as a canon entry and pinned by the
   equivalence test above. The old modules stay until their entry passes.
3. The renderer draws from the vocabulary; the nine renderers are deleted as
   their entries take over.
4. `build_material` opens to the tutor behind the existing `montessori` mode
   flag.

No flag day. At every step the nine keep working.

## Known limits

- **A trait the vocabulary cannot express** forces prose, exactly as today. The
  escape hatch is the sandboxed exploratory card, deliberately unbuilt.
- **The 50,000-state cap will reject some legitimate materials** — a large
  ordering task, for instance. Treated as a signal that the material is too big
  to hold, but worth watching for false rejections.
- **`maxVaryingTraits` is declared per apparatus, not derived.** A canon entry
  can lie about itself. The canon is ours, not the model's, so this is a review
  question rather than a runtime one.
- **The pedagogy layer is only as good as its own judgment.** Phase 1 exists to
  find out whether that judgment is any good before the engine is built for it.
