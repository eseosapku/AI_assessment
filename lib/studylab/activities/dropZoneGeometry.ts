// lib/studylab/activities/dropZoneGeometry.ts
// Shared layout geometry for the two patterns whose interactive drop targets
// are positioned `absolute` over hand-drawn SVG artwork (a balance's pans,
// a compare's zones) so they sit under/inside that artwork instead of
// falling into normal document flow — see BalanceActivity.tsx and
// CompareActivity.tsx.
//
// Both the pattern module (which derives an authoring-time item-count cap
// from this — see balance.ts's `MAX_ITEMS_PER_GROUP` / compare.ts's
// `MAX_ITEMS_PER_BUCKET`) and the renderer (which uses the same headroom as
// the CSS `max-height` backstop for whatever a drag still piles on beyond
// the cap) import the numbers below, rather than each declaring its own
// copy of the geometry — two independent declarations would silently
// desync the moment either box's chrome or artwork changes.

/**
 * Content width actually available to a pattern's own `relative w-full`
 * aspect-ratio box, once ActivityFrame's own chrome is subtracted from its
 * 420px card (`ActivityFrame.tsx`): a 1px border, then an outer `p-4`
 * (16px/side), then a second bordered (1px), `p-3`-padded (12px/side)
 * wrapper around `{children}` — 420 - 2*1 - 2*16 - 2*1 - 2*12 = 360px
 * (border-box sizing throughout).
 */
const CONTENT_WIDTH_PX = 360

/**
 * Height of one wrapped row of chips: the item icon (the tallest thing in a
 * chip), plus the chip's own vertical padding (`py-1`, 4px top + 4px
 * bottom), plus the `gap-2` (8px) to the next wrapped row.
 */
function rowHeightPx(iconPx: number): number {
  const chipVerticalPaddingPx = 8
  const rowGapPx = 8
  return iconPx + chipVerticalPaddingPx + rowGapPx
}

/**
 * Vertical headroom below a drop target's `top` anchor to the bottom of the
 * shared `relative` box, and the item-count cap that headroom supports at
 * one chip per row — every drop target this covers is narrow enough (see
 * each export below) that an average item label rarely shares a row with a
 * second one.
 */
function deriveGeometry(aspectRatio: number, topFraction: number, iconPx: number) {
  const boxHeightPx = CONTENT_WIDTH_PX / aspectRatio
  const headroomPx = Math.round(boxHeightPx * (1 - topFraction))
  const maxItems = Math.round(headroomPx / rowHeightPx(iconPx))
  return { headroomPx, maxItems }
}

/**
 * A balance pan: `absolute`, anchored at `top: 50%` inside the beam's
 * 300:190 viewBox, 33%-wide (~119px, too narrow for two 20px-icon chips per
 * row). See BalanceActivity.tsx (pan containers) and balance.ts
 * (`MAX_ITEMS_PER_GROUP`).
 */
export const BALANCE_PAN = deriveGeometry(300 / 190, 0.5, 20)

/**
 * A compare zone: `absolute`, all three anchored at the same `top: 31.8%`
 * inside the Venn diagram's 300:220 viewBox; even the widest ("both") zone
 * is only ~127px wide, too narrow for two 22px-icon chips per row. See
 * CompareActivity.tsx (zone containers) and compare.ts
 * (`MAX_ITEMS_PER_BUCKET`).
 */
export const COMPARE_ZONE = deriveGeometry(300 / 220, 0.318, 22)
