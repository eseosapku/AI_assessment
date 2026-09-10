# Stage 3b final fix: sorting-frame catalogue art

## Finding

`sortingFrame.convert()` built pieces as `{ id, label, traits }` only and
dropped legacy `item.imageUrl`, so live cutover lost SortActivity catalogue art.

## Fix

In `lib/studylab/material/canon/sortingFrame.ts`, `catalogueArt()`:

1. Takes `item.imageUrl`, trims, strips a leading `asset:` prefix
2. Sets `piece.art` only when the remainder matches `/^[a-z0-9-]+$/`
   (same rule as `parse.ts` `ART_NAME_RE` / `Piece.art`)
3. Never passes through raw `asset:…` (colon would fail parse and null
   the whole `fromLegacy`)

## Test

Added `sorting-frame fromLegacy preserves catalogue art` in
`equivalence.test.ts`: pins `asset:balance-scale` → `art: 'balance-scale'`,
bare legal names, and rejects illegal / missing URLs.

## Verification

```text
npx vitest run lib/studylab/material
npx tsc --noEmit
```

Result: PASS — 10 files / 96 tests; TypeScript clean.
