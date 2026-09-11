# Task 3 report: MaterialActivity work adapters

## Status
Done

## Changes
- Created `components/studylab/material/adapters.ts` with `MaterialWorkAdapter`, `sortAdapter`, and `sequenceAdapter`.
- Refactored `MaterialActivity` to require `adapter`; seeds/persist/check/refusal go through the adapter.
- Preserved `activityRef` sync in `persistActivity` (refusal then state-change cannot wipe `rejectedMoves`).
- Preserved tick as sole solve authority; `wrongIdsWhenUnsolved` only when unsolved.
- Wired `adapter={sortAdapter}` on the sort `MaterialActivity` in `ActivityNode`. Sequence case unchanged.

## Tests
`npx tsc --noEmit && npx vitest run` — pass (122 files, 1570 tests).

## Commit
`refactor(studylab): MaterialActivity work adapters for sort and sequence`

## Concerns
- `sequenceAdapter.freshWork` needs `as unknown as Record<string, unknown>` because `SequenceWork` lacks an index signature.
- Sequence ActivityNode cutover still pending (Task 4); adapter is ready but unused in the tree.
