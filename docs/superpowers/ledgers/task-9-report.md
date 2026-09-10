# Task 9 report — The remaining five apparatus

## Status

Complete. The canon now contains all nine legacy-replacing apparatus, every
entry passes the composed-material gate, and the shared equivalence suite
checks solved, wrong, partial, and untouched states against each legacy
validator.

## Implementation

- Added `balance-beam` as weighted pieces across left/right/pool groups, with a
  beam display bound to `sum_weight_left - sum_weight_right` and a
  `numericWithin(0)` goal. Its untouched board intentionally agrees with the
  legacy zero-difference behavior.
- Added `labelled-diagram` with label text as each piece id, hotspot groups and
  `s-${hotspotId}` slots, and a bin assignment that inverts back to legacy
  `{ hotspotId: labelText }` work.
- Added `variable-model` with a slider control, model-kind display, bind rule,
  and numeric goal. Two legend pieces vary one trait because the isolation gate
  correctly refuses a control-only scene that varies nothing.
- Added `decision-branch` with one-capacity chosen placement and a bound
  defensible score. Its numeric goal avoids requiring every unchosen option to
  be placed.
- Added `bonding-ring` with ordinary movable bond tokens. Candidate bonds are
  derived by matching `validJoins` against part **labels**, exactly as legacy
  `compose.accepts()` does, rather than incorrectly matching part ids.
- Refactored `ordering-track` to position groups `0`, `1`, ... and slots
  `s-0`, `s-1`, ... while retaining unique order indices.
- Registered the five additions in the existing `Map`.

## TDD evidence

### Red

After replacing the sorting-only test with the nine-row table, ran:

`npx vitest run lib/studylab/material/canon`

Result: failed as intended — 8 failures. Coverage reported the five missing
apparatus, their test rows and hostile-input checks could not resolve registry
entries, and `ordering-track` failed the shared `s-${groupId}` slot convention.

### Green

After implementing and registering the entries and refactoring the track, ran:

`npx vitest run lib/studylab/material/canon`

Result: 1 test file passed, 13 tests passed.

### Full gate

Ran:

`npx tsc --noEmit && npx vitest run`

Result: TypeScript passed; 119 test files passed, 1553 tests passed.

Additional checks:

- IDE diagnostics: no errors in `lib/studylab/material/canon`.
- `git diff --check`: passed.
- `git diff --name-only -- lib/studylab/activities/patterns`: empty; protected
  legacy pattern modules were not modified.

## Constraints and limitations

`fromLegacy` receives only the payload, not the external success rule. The
decision converter therefore reads the payload's `defensible` flags, and the
bond converter treats every label-valid candidate bond as required. Payloads
that cannot form an isolating, solvable ordinary material return `null` through
`safeFromLegacy`; no separate grading mechanism was added.

## Review remediation

The controller ruling supersedes the limitation above. Every apparatus now
implements:

`fromLegacy(payload: unknown, success?: SuccessRule): MaterialSpec | null`

When supplied, `success` is the grading authority. Sort/compare/sequence,
balance, vary, and scenario narrow directly to success kinds their board state
can express. The two legacy pairing patterns translate pairing into ordinary
bin assignments rather than introducing unsupported interpreter pairing.
Payload hints remain fallback-only when success is omitted.

Bonding now selects only join ids named by `success.exactSet`, verifies each is
a label-valid legacy candidate, and rejects a target if any required part
degree exceeds that part's `slots`. Its numeric bound count permits a proper
subset of valid candidates without requiring unrelated bonds.

### Remediation TDD evidence

Red: after adding conflicting-metadata and slot-degree regressions, the canon
suite failed 4 tests. Variable-model followed the payload target,
decision-branch followed `defensible`, bonding required all valid candidates,
and an over-degree target was accepted.

Green:

- `npx vitest run lib/studylab/material/canon`: 1 file, 17 tests passed.
- `npx tsc --noEmit`: passed.
- `npx vitest run`: 119 files, 1557 tests passed.
- IDE diagnostics and `git diff --check`: clean.
- No file under `lib/studylab/activities/patterns/` was modified.
