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
//
// The two numbers describe the same box from opposite ends, and must not be
// confused for each other: `headroomPx` is the WHOLE box's budget (what the
// CSS `max-height` gets, chrome included), while `maxItems` counts only the
// chip rows that fit in what is left of that budget AFTER the box spends
// some of it on its own border, padding and label. Deriving `maxItems` from
// the undiscounted `headroomPx` is what made earlier caps promise more rows
// than the box could show.

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
 * Height of the one-line zone label (`text-[12px]`) both patterns render
 * above their chips. Tailwind 3's arbitrary `text-[12px]` sets `font-size`
 * only, so the line box takes the inherited `line-height: 1.5` from
 * preflight's `html` rule (nothing in `app/globals.css`, `ActivityFrame.tsx`
 * or either renderer overrides it on this subtree) — 12 * 1.5 = 18px.
 */
const LABEL_LINE_PX = Math.round(12 * 1.5)

/**
 * A chip's own vertical padding: `py-1` on the `motion.span` in each
 * renderer's `Chip`, 4px top + 4px bottom. The chip sets no border, and its
 * `text-[12px] leading-tight` label (15px) is shorter than either icon, so
 * the icon alone sets the chip's content height.
 */
const CHIP_VERTICAL_PADDING_PX = 8

/**
 * Everything a drop zone spends its own height budget on before a single
 * chip row is drawn. Measured off the rendered markup, per zone, because
 * the two are NOT the same box: a balance pan has `border-2` and `mb-1`
 * under its label, a compare zone has `border` (1px) and `mb-0.5`.
 *
 * - `borderPx` / `paddingPx` are per side (both are doubled below).
 * - `labelMarginPx` is the label `<p>`'s own `mb-*`, sitting below the label
 *   text before the container's own gap is spent.
 * - `labelGapPx` is the outer container's `gap-2`. The outer box is a
 *   `flex flex-col` with exactly two children — the label `<p>` and the
 *   chip-wrap `<div>` — so the label unconditionally occupies its own line
 *   above the chips (this is a two-item column stack, not a wrap that
 *   happens to land that way), and `gap-2` is the single vertical gap the
 *   column spends between those two items.
 */
interface ZoneChrome {
  borderPx: number
  paddingPx: number
  labelMarginPx: number
  labelGapPx: number
}

function chromeHeightPx(chrome: ZoneChrome): number {
  return (
    2 * chrome.borderPx +
    2 * chrome.paddingPx +
    LABEL_LINE_PX +
    chrome.labelMarginPx +
    chrome.labelGapPx
  )
}

/**
 * Vertical headroom below a drop target's `top` anchor to the bottom of the
 * shared `relative` box, and the item-count cap that headroom supports at
 * one chip per row — every drop target this covers is narrow enough (see
 * each export below) that an average item label rarely shares a row with a
 * second one.
 *
 * `maxItems` means "this many rows are fully visible without scrolling", so:
 * the zone's own chrome comes off the budget first, and the division rounds
 * DOWN. N rows occupy `N*chipHeight + (N-1)*rowGap` — the last row is not
 * followed by a gap — which rearranges to the `+ rowGapPx` on both sides of
 * the division below. Rounding up, or dividing the undiscounted headroom,
 * would let `isPayload` accept a material whose own authored items scroll
 * the moment a student meets it — the exact thing the cap exists to reject.
 */
function deriveGeometry(
  aspectRatio: number,
  topFraction: number,
  iconPx: number,
  rowGapPx: number,
  chrome: ZoneChrome,
) {
  const boxHeightPx = CONTENT_WIDTH_PX / aspectRatio
  // The whole box's budget, chrome included — this is the CSS `max-height`.
  const headroomPx = Math.round(boxHeightPx * (1 - topFraction))
  // What is left of that budget for chip rows once the box pays for itself.
  const chipSpacePx = headroomPx - chromeHeightPx(chrome)
  const chipHeightPx = iconPx + CHIP_VERTICAL_PADDING_PX
  const maxItems = Math.max(
    0,
    Math.floor((chipSpacePx + rowGapPx) / (chipHeightPx + rowGapPx)),
  )
  return { headroomPx, maxItems }
}

/**
 * A balance pan: `absolute`, anchored at `top: 50%` inside the beam's
 * 300:190 viewBox, 33%-wide (~119px, too narrow for two 20px-icon chips per
 * row). Chrome read from BalanceActivity.tsx's pan containers —
 * `border-2 ... p-2` on a `flex flex-col gap-2` outer box, and a label `<p>`
 * with `mb-1`; chips wrap inside the pan's inner `flex flex-wrap ... gap-1`
 * div, so the row gap is 4px, not the outer 8px. See balance.ts
 * (`MAX_ITEMS_PER_GROUP`).
 *
 * 360 / (300/190) = 228px box; 228 * 0.5 = 114px headroom; chrome is
 * 2*2 + 2*8 + 18 + 4 + 8 = 50px, leaving 64px for chips at a 28px row
 * (20px icon + 8px `py-1`) and a 4px gap — 2 rows.
 */
export const BALANCE_PAN = deriveGeometry(300 / 190, 0.5, 20, 4, {
  borderPx: 2,
  paddingPx: 8,
  labelMarginPx: 4,
  labelGapPx: 8,
})

/**
 * A compare zone: `absolute`, all three anchored at the same `top: 31.8%`
 * inside the Venn diagram's 300:220 viewBox; even the widest ("both") zone
 * is only ~127px wide, too narrow for two 22px-icon chips per row. Chrome
 * read from CompareActivity.tsx's zone containers — a 1px `border ... p-2`
 * on a `flex flex-col gap-2` outer box, and a label `<p>` with `mb-0.5`; as
 * with a pan, chips wrap inside an inner `gap-1` div, so the row gap is
 * 4px. See
 * compare.ts (`MAX_ITEMS_PER_BUCKET`).
 *
 * 360 / (300/220) = 264px box; 264 * 0.682 = 180px headroom; chrome is
 * 2*1 + 2*8 + 18 + 2 + 8 = 46px, leaving 134px for chips at a 30px row
 * (22px icon + 8px `py-1`) and a 4px gap — 4 rows.
 */
export const COMPARE_ZONE = deriveGeometry(300 / 220, 0.318, 22, 4, {
  borderPx: 1,
  paddingPx: 8,
  labelMarginPx: 2,
  labelGapPx: 8,
})
