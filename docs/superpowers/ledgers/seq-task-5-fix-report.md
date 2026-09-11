# Task 5 fix report: capacity-1 swap for sequence reorder

## Status

FIXED. Capacity-1 occupied drops now swap instead of refusing, so a shuffled
full `ordering-track` can be reordered and correct-order **Check** works.

## Code change

`lib/studylab/material/interpreter.ts`:

- `allowsMove` still refuses when a slot is full, **except** when
  `slot.capacity === 1` and there is exactly one other occupant (valid swap).
- `applyMove` on that path places the mover and either moves the displaced
  piece to the mover’s previous slot, or removes it from placement (pool) if
  the mover was unplaced. No `rejectedMoves` entry.
- Capacity > 1 full slots unchanged (still refuse + record rejection).

## Tests

Added `capacity-1 swap` cases in `interpreter.test.ts`:

1. Empty capacity-1 placement still works
2. Placed A on s-1 → s-0 occupied by B → swap
3. Unplaced A onto full capacity-1 → B returns to pool
4. Capacity-2 full slot still refuses

Focused: `interpreter.test.ts` — 18 passed.

Full gate: `npx tsc --noEmit && npx vitest run` — PASS (122 files / 1574 tests).

## Browser re-check

Route: `http://localhost:3000/dev/activities` (`n-sequence`).

- Shuffled start: Third / First / Second on Positions 1–3.
- Pointer-drag First → `s-0`, then Second → `s-1` via swap → order
  `one`, `two`, `three`.
- **Check** solved (no `wrongIds` red chips; Solved UI present).

## Docs / commit

- Updated `docs/HANDOVER.md`: reorder blocker noted as fixed via capacity-1 swap;
  removed Stage 3b sequence follow-up from Not done.
- This fix report.

## Concerns / remaining work

- Remaining seven live pattern cutovers + Stage 4 unchanged.
