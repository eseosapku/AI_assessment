# Stage 3 Task 6 Report — Bench Integration

**Date:** 2026-09-10  
**Base:** `de14971`  
**Commit:** `31db218`  
**Branch:** `aws_deploy` (local only, not pushed)

## Summary

Added a dev-only React Flow node wrapper for `MaterialRenderer` and extended
`/dev/activities` with a controlled composed-material node. The absolute picker
loads every canon base from `apparatusNames()` and two explicit
`fromLegacy(payload, success)` samples: acid/base sorting and a tiny numeric
balance.

The existing sort, balance, compare, and compose nodes remain in place.
Production still calls `notFound()`. No production node registry, block type,
activity node, or activity pattern module was changed.

## Verification

```text
npx tsc --noEmit && npx vitest run
```

- `tsc`: pass
- `vitest`: 120 files, 1560 tests — all pass
- IDE diagnostics on both implementation files: none
- `git diff --check`: pass

The first suite run caught the brief's 10px sample label against the repository
12px accessibility floor. The label was raised to `text-xs`, after which the
full gate passed.

## Concerns

No blocking concerns. Real mouse drag, pan/zoom ghost tracking, refusal motion,
and apparatus reset behavior remain the separate Task 7 browser gate.
