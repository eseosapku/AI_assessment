# Handover — StudyLab / LearnSpace, as of 2026-09-10

Written to move this work between tools and people. Everything here was
previously scattered across an assistant's private memory, a git-ignored
ledger, and one long conversation — none of which travel. This file does.

**Branch:** `aws_deploy`. **Local only — never push without an explicit
decision.** `aws_deploy` is the deploy branch: pushing it deploys to the live
product, so it is always an explicit decision, never a default.

**Verification gate, run before claiming anything works:**

```bash
npx tsc --noEmit && npx vitest run
```

Currently **123 test files / 1579 tests green, tsc clean**.
`npm run lint` is broken project-wide (Next 16 removed `next lint`) — do not
treat its failure as a regression.

---

## 1. What this work is

Two efforts, one finished and one half-built.

### Phase 1 — the pedagogy layer (DONE, shipped locally)

LearnSpace has a "Montessori mode": instead of teaching with text cards, the
tutor builds **materials** — drag-and-drop apparatus a student works with their
hands, where the material itself shows them a wrong move rather than marking it
afterwards.

Nine activity patterns existed (`sort`, `threePeriod`, `label`, `sequence`,
`vary`, `balance`, `compare`, `scenario`, `compose`) but had been **orphaned by
a branch reset in August** — not on any branch, reachable only through the
reflog. They were recovered, re-landed on a tutor that had been rewritten
underneath them, and then given the thing they were missing: the tutor must now
state *what it is teaching* before it can build anything, and a material whose
stated reason does not match what it actually varies is refused rather than
shown to a student.

Spec: `docs/superpowers/specs/2026-09-07-studylab-composable-material-engine-design.md`
Plan: `docs/superpowers/plans/2026-09-07-learnspace-pedagogy-layer.md`

### Phase 2 — the composable engine (core done; live cutover 8 of 9)

The nine patterns are the wrong *kind* of unit — whole finished apparatus
rather than parts that combine. So the tutor can only ever pick from nine, never
invent. Phase 2 drops the unit of composition below the apparatus: a small
vocabulary of pieces, slots, groups, controls and displays, plus four rules
(`derive`, `bind`, `when`, `allow`), out of which a balance can be reassembled
to weigh chemical equations instead of numbers.

The guiding principle, which is easy to get wrong in the ambitious direction:

> **The vocabulary is generative. The child's encounter is familiar.**

A real Montessori environment is a small, deeply-known canon — the same beads
for two years. Inventing a novel contraption every lesson is *further* from
Montessori than nine fixed patterns, because the child spends their attention on
the interface instead of the mathematics. The rule language exists so a
*recognisable* apparatus can do new work.

Plan: `docs/superpowers/plans/2026-09-09-composable-material-engine-core.md`

---

## 2. Exactly where it stands

### Done and reviewed

| | |
|---|---|
| Phase 1, all 9 tasks | `docs/superpowers/plans/2026-09-07-learnspace-pedagogy-layer.md` |
| Phase 2 core, Tasks 1-9 | vocabulary through canon; all nine apparatus + equivalence |
| Montessori mode reachable | commit `286a002` |
| Composite gate + canon | commits `f94a690..a6a8bdb` (Tasks 7–9, this continuation) |

Phase 2's code lives in `lib/studylab/material/`:

| File | What it is |
|---|---|
| `types.ts` | `Piece`, `Slot`, `Group`, `Control`, `Display`, `Rule`, `MaterialSpec`, `MaterialState` |
| `parse.ts` | `parseMaterialSpec` — narrows untrusted model output, never throws |
| `scope.ts` | `buildScope` / `scopeNames` / `collidingNames` — the flat record expressions read |
| `interpreter.ts` | `tick`, `allowsMove`, `applyMove`, `hasCycle` |
| `isolation.ts` | `varyingTraits`, `checkIsolation` — one quality at a time |
| `fit.ts` | `MATERIAL_BOX`, `fitsInBox` — can it actually be drawn |
| `solvable.ts` | `isSolvable`, `MAX_STATES` — can it actually be finished |
| `validate.ts` | `validateMaterial` — composite gate, cheapest check first |
| `canon/` | nine apparatus in a `Map`, each with `fromLegacy(payload, success?)` |

The core is now reachable through eight live renderer cutovers: valid legacy
`sort` activities mount `sorting-frame`, valid legacy `sequence` activities
mount `ordering-track`, valid legacy `compare` activities mount `venn-sets`,
valid legacy `balance` activities mount `balance-beam`, valid legacy `label`
activities mount `labelled-diagram`, valid legacy `vary` activities mount
`variable-model`, valid legacy `scenario` activities mount `decision-branch`,
and valid legacy `compose` activities mount `bonding-ring`, all through
`ActivityNode`. The remaining pattern (`threePeriod`) still uses its legacy
renderer, and the tutor still cannot author free-form composed materials.

### Done in this continuation (Tasks 7–9 + Stage 3 + Stage 3b sort/sequence/compare/balance/label/vary/scenario/compose)

**Task 7 — composite gate** at `lib/studylab/material/validate.ts`: cheapest-first
parse → collidingNames → expression refs → hasCycle → isolation → fit →
solvability. Expression function names come from `EXPR_FUNCTION_NAMES` exported
by `expr.ts` (one source with the evaluator).

**Tasks 8–9 — the canon** under `lib/studylab/material/canon/`: nine apparatus in
a `Map`, each `base` passes the gate, each `fromLegacy(payload, success?)`
returns null rather than throwing. The optional `success` argument is a
deliberate extension beyond the plan’s one-arg signature — legacy grading needs
it for real equivalence. Equivalence suite covers solved/wrong/partial/untouched
plus conflicting payload-vs-success regressions.

**Stage 3 cut 1 — material renderer on the dev bench** (plan
`docs/superpowers/plans/2026-09-10-material-renderer-dev-bench.md`, spec
`docs/superpowers/specs/2026-09-10-material-renderer-dev-bench-design.md`):
`MaterialRenderer` + `MaterialFrame` enforce `MATERIAL_BOX` as real CSS;
`/dev/activities` mounts every canon base plus two `fromLegacy` samples.
The uncontrolled bench remains available for renderer regressions. Browser
mouse-path checklist passed.

**Stage 3b — live sort cutover:** `ActivityNode` converts valid legacy `sort`
specs through the `sorting-frame` canon and mounts controlled
`MaterialActivity` / `MaterialRenderer`. Browser mouse-path verification on
`/dev/activities` confirmed material chips and slots, immediate wrong-drop
refusal, full assignment remaining unsolved until **Check**, and **Check**
solving the activity. The uncontrolled `MaterialBenchNode` also retained its
match, mismatch-shake-and-spring-back, and automatic solved behavior.
`SortActivity` remains in place as the fallback when legacy conversion returns
`null`.

**Stage 3b — live sequence cutover:** `ActivityNode` converts valid legacy
`sequence` specs through the `ordering-track` canon and mounts controlled
`MaterialActivity` with `sequenceAdapter`. Browser verification on
`/dev/activities` (`n-sequence`) confirmed: material prompt and Position
slots; pieces appear already on the track in a shuffled full order (not an
empty pool); wrong-order **Check** stays unsolved and paints `wrongIds`.
**Capacity-1 swap** is implemented in `allowsMove`/`applyMove`: dropping onto
a full capacity-1 slot exchanges with the sole occupant (or returns them to
the pool if the mover was unplaced), so a shuffled full order can be
reordered without clear-to-pool. Capacity > 1 still refuses when full.
Uncontrolled bench `ordering-track` still works (pool → empty slots →
auto-Solved). `n-sort` smoke still shows material chips/slots + **Check**.
`SequenceActivity` remains the fallback when `fromLegacy` returns `null`.

**Stage 3b — live compare cutover:** `ActivityNode` converts valid legacy
`compare` specs through the `venn-sets` canon and mounts controlled
`MaterialActivity` with `compareAdapter`. Browser verification on
`/dev/activities` (`n-compare`) confirmed: material chips and three labeled
slots (Mitosis / Both / Meiosis) — **not** the legacy SVG Venn crescents
(slots-not-crescents is intentional); empty pool at start; drag into
left/both/right; wrong full assign stays unsolved on **Check** and paints
`wrongIds`; correct assign **Check** solves. Smoke on `n-sort` and
`n-sequence` still material path. Bench material picker still mounts
`venn-sets` (canon base). `CompareActivity` remains the fallback when
`fromLegacy` returns `null`.

**Stage 3b — live balance cutover:** `ActivityNode` converts valid legacy
`balance` specs through the `balance-beam` canon and mounts controlled
`MaterialActivity` with `balanceAdapter`. Browser verification on
`/dev/activities` (`n-balance`) confirmed: material Left/Right/Weights slots
plus numeric beam display (slots+beam is intentional — not a drawn SVG
balance); pool chips; drag to pans updates the beam (H2/w=2 left alone →
beam `2`; N2/w=2 on right → beam `0`); **Check** solves the balanced board.
Smoke on `n-sort`, `n-sequence`, and `n-compare` still material path. Bench
material picker still mounts `balance-beam` (canon base and fromLegacy
sample). `BalanceActivity` remains the fallback when `fromLegacy` returns
`null`.

**Stage 3b — live label cutover:** `ActivityNode` converts valid legacy
`label` specs through the `labelled-diagram` canon and mounts controlled
`MaterialActivity` with `labelAdapter`. Legacy `work.assign` stays
**hotspotId → label**; placement flips to **label → `s-${hotspot}`** via
`labelPlacement` helpers (do not reuse sort’s piece→bin helpers on raw label
work). Browser verification on `/dev/activities` (`n-label`, new bench
fixture) confirmed: material Nucleus/Membrane slots (slots-not-diagram is
intentional — no background SVG); pool chips; wrong hotspot refuses
(Nucleus→membrane stayed in pool); correct drops stick; **Check** solves and
shows reveal. Smoke on `n-sort`, `n-sequence`, `n-compare`, and `n-balance`
still material path. `LabelActivity` remains the fallback when `fromLegacy`
returns `null`.

**Stage 3b — live vary cutover:** `ActivityNode` converts valid legacy `vary`
specs through the `variable-model` canon and mounts controlled
`MaterialActivity` with `varyAdapter`. Persistence stays `{ value: number }`
mapped to `controls[variable.id]` via `varyControls` helpers and optional
adapter control hooks on `MaterialActivity` (placement stays empty). Browser
verification on `/dev/activities` (`n-vary`, new bench fixture) confirmed:
material Temperature slider + bound display (control+display-not-SVG is
intentional); slider starts at min; move to target 5; **Check** solves.
Smoke on prior cutovers still material path. `VaryActivity` remains the
fallback when `fromLegacy` returns `null`.

**Stage 3b — live scenario cutover:** `ActivityNode` converts valid legacy
`scenario` specs through the `decision-branch` canon and mounts controlled
`MaterialActivity` with `scenarioAdapter`. Persistence stays
`{ chosen: string | null }` mapped to piece on `s-chosen` via
`scenarioPlacement` helpers. Browser verification on `/dev/activities`
(`n-scenario`, new bench fixture) confirmed: material My choice / Choices
slots + gauge (drag+Check-not-auto-grade is intentional — not the legacy
click-list); drag safe → `s-chosen`; **Check** solves. Smoke on prior
cutovers still material path. `ScenarioActivity` remains the fallback when
`fromLegacy` returns `null`.

**Stage 3b — live compose cutover:** `ActivityNode` converts valid legacy
`compose` specs through the `bonding-ring` canon and mounts controlled
`MaterialActivity` with `composeAdapter`. Persistence stays
`{ joins: [string, string][] }` mapped to `bond-${joinId}` pieces on
`s-joined` via `composePlacement` helpers. Browser verification on
`/dev/activities` (`n-compose`) confirmed: material Bonding ring / Available
bonds + gauge (bond-chips-not-parts is intentional — not legacy part-onto-part);
drag both H—O chips onto the ring (gauge 0→3); **Check** solves. Smoke on
prior cutovers still material path. `ComposeActivity` remains the fallback
when `fromLegacy` returns `null`.

### Not done

**Stage 3b, remaining one cutover** — `threePeriod` still needs to move to
`three-period-cards` through `ActivityNode`. Retire a legacy renderer only when
its canon entry owns the live path and its fallback decision has been made
explicitly.

**Stage 4** — `build_material` on the action union, vocabulary advertised from
`MATERIAL_BOX` and the canon, action listed in `systemPrompt(mode)`.

---

## 3. Decisions that would be expensive to rediscover

Each of these cost real time to find. They are in the ledger under `Ruling:`
lines, reproduced here because the ledger is git-ignored.

**A prompt block is inert unless the action contract lists the action.** Phase 1
shipped a "NON-NEGOTIABLE" instruction to emit `createActivity` while the system
prompt's ACTION TYPES enumerated only `createCard` and friends. The tutor obeyed
the contract and built cards — **zero materials across five topics, with every
unit test passing.** It cost a full live model run to find, and it was the
second time that exact fault shipped here (the first was commit `1ce49cc`).
`build_material` must go in `systemPrompt(mode)`'s list, not only in a block
underneath it.

**What the prompt advertises must match what the validator enforces.** Item caps
(a balance pan holds 2, a compare zone 4) were derived from the drawn geometry
while fixing a layout bug; the prompt was written separately and never mentioned
them. Material with three chips on a pan was authored in good faith and refused
as "malformed" — a reason naming nothing anyone could act on.

**Solvable is not the same as fits.** The design proved a material could be
*completed* and said nothing about whether it could be *drawn*. Four fix rounds
went into pieces growing out of an absolutely-positioned box whose parent could
not expand. `fit.ts` exists because of that.

**`MATERIAL_BOX.heightPx` is an allowance, not a rendered cap.** `ActivityFrame`
sets `w-[420px]` literally — the width is real — but no `h-*` or `max-h-*` at
all, so the card is `height: auto` and grows with content. The 380 traces only
to `blocks.ts`'s `defaultSize.h`, used for canvas collision spacing, which
`actions.ts` explicitly pads because content is expected to exceed it. **Stage 3
must make it a real CSS cap or adopt an enforced scrollable-zone backstop like
`CompareActivity`'s `ZONE_MAX_HEIGHT`, or the height half of `fitsInBox` is
decorative.**

**`compose`'s `validJoins` names part LABELS, not ids** — `accepts()` compares
`j.a === from.label`. Inferring from the type declaration gets this wrong; read
`accepts()`. One mistyped label meant no bond was ever legal and nothing told
the student why, which is the fault the solvability prover exists to make
impossible.

**The `pairing` goal deliberately supplies no `pairs`.** The two existing
consumers (`label.ts`, `threePeriod.ts`) pair a piece id with a *content value*,
never a slot id, and the canon's `matching-pairs` will want piece-to-piece — three
different shapes. Whichever canon entry needs it first defines the mapping, with
a test. A `pairing` material coming back unreachable today is expected.
Labelled-diagram and three-period-cards therefore use `binAssignment` placement
in the canon, not `pairing`.

**`fromLegacy` needs the success rule.** The plan typed
`fromLegacy(payload: unknown)` only, but legacy `validate(payload, work, success)`
grades against a separate success rule. Converters that infer goals from payload
metadata alone (defensible flags, `target`, all label-valid bonds) can agree with
aligned fixtures and still mis-grade real lessons. The landed signature is
`fromLegacy(payload, success?)` — when `success` is present it wins.

**A failed expression leaves its name absent, never `0`.** `evaluateExpr`'s
fail-closed return is the sentinel `null`; turning it into a number lets a
material teach from a silent zero.

**The space owns its mode, not the request.** Read back off the `learnspaces.mode`
column each turn, so nothing a client sends mid-lesson can switch a lesson's
mode, and a run stored before the column existed reads as classic.

---

## 4. Traps in this codebase

**Renderers cannot be unit-tested here.** vitest is node-environment only, no
jsdom, and **`.test.tsx` files must never be created.** Two real bugs were
invisible to 1531 passing tests and were only found by driving a browser:

- The drag ghost used `position: fixed` inside React Flow's transformed
  viewport. A transformed ancestor becomes the containing block for `fixed`, so
  it resolved against the canvas rather than the screen — 185px from the cursor,
  drifting with every pan and zoom. Now ~5px. See
  `lib/studylab/activities/fixedContainingBlock.ts`.
- Pans laid out as a flex row put a group's label beside its first chip, so they
  collided.

`app/dev/activities` is the bench that made both findable — dev-gated, keep it.
**Test the mouse path**: keyboard testing once gave a false pass while mouse drag
was entirely dead.

**Tailwind alpha modifiers fail silently on the `ss-*` tokens.** They are plain
hex on `:root` in `app/globals.css`; Tailwind cannot resolve a `var()` to a
colour at build time, so `bg-ss-slate/40` and even
`bg-[color:var(--ss-slate)]/75` emit **no rule at all**. The element renders
fully transparent, which reads as a layout bug. Set token colours inline:
`style={{ backgroundColor: 'var(--ss-slate)' }}`, or `fill="var(--ss-good)"` for
SVG.

**Registry lookups use a `Map`, never an object literal.** Names come from model
output; indexing an object literal reaches `Object.prototype`, so `__proto__`
and `constructor` resolve to truthy non-modules and sail past a `if (!mod)`
guard. The same reasoning applies to `key in obj` versus
`Object.prototype.hasOwnProperty.call`.

**`lib/studylab/activities/expr.ts` is hardened and must not be extended.** It is
a recursive-descent parser over a closed token set — no `eval`, no
`new Function`, fails closed — written specifically to avoid the parser-escape
RCEs in mathjs (CVE-2026-41139) and expr-eval (CVE-2025-12735). Never add a
second evaluator.

**Model-authored SVG is never rendered**, and art is referenced by catalogue
name resolved through `assetUrl()`, never a URL — an unvalidated `src` is a
broken-image, tracking-pixel and SSRF risk at once.

**Work in the main repo, not a git worktree.** Beyond the preference: on
2026-08-18 a `node_modules` junction inside a worktree was deleted *through* by
`git worktree remove --force`, wiping 138 binaries from the main repo. On
2026-08-20 a worktree branch was reset to origin and lost committed work —
recovered only via `git reflog <branch>` and `git show <sha>:<path>`. **If work
vanishes, check the reflog before assuming it is gone.** That is exactly how the
nine Montessori patterns were recovered; they are anchored at branch
`montessori-recovered` and tag `montessori-snapshot-2026-08-20` (`e594f43`) —
**do not delete those refs.**

---

## 5. Carried debt, deliberately unfixed

- **A balance pan caps at 2 items** because 44% of its height is chrome. The cap
  is arithmetically honest; the *layout* is what should change (label onto the
  beam, or a higher anchor). Stage 3 redraws these boxes anyway.
- **The tutor attaches art that does not fit** — `asset:fern` on "Prophase".
  "Concrete before abstract" is beating "omit art when a word is clearer", and
  nothing refuses it.
- **A `vary` model can be a formula the model invented**, passing every check,
  with nothing asking it to be honest that the relationship is made up. In a
  vocabulary where `bind` expressions are the whole point, this gets sharper.
- `solvable.ts`'s comment cites `1/0.1 = 9.999999999999998` as the float wobble
  it guards. That is false — `1/0.1 === 10` exactly. The real case is
  `0.3/0.1 = 2.9999999999999996`. The fix is correct; only the cited example is
  wrong.
- No unit test pins `createActivity`'s presence in `systemPrompt('montessori')`
  — the live test covers it, a unit test would be cheaper.

---

## 6. How to pick this up

**Read first:** this file, then the Phase 2 spec, then the Phase 2 plan's Task 7.

**To run it:** `npx next dev`, then http://localhost:3000/studylab → New
LearnSpace → **"How it teaches" → Hands-on**. Try a topic where a sorting frame
is the *wrong* answer — the order of mitosis, why a balanced equation needs
equal atoms — because reaching for `sort` regardless was the original fault.

**To test the drag without model calls:** http://localhost:3000/dev/activities.

**Live model tests** (real cost, excluded from the default suite):

```bash
npx vitest run --config vitest.live.config.ts liveMontessoriIntent
```

**Working style that produced this:** each task ends with `tsc` clean and the
full suite green, one commit per task, commit messages that name the *fault
fixed* rather than the change made. Every non-obvious line carries a comment
saying which real failure it prevents — that convention is why this codebase can
be handed over at all, and it is worth keeping.
