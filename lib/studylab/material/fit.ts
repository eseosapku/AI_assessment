// lib/studylab/material/fit.ts
// Solvable is not the same as fits. The interpreter (Task 3) proves a
// material can be *completed*; it says nothing about whether it can be
// *drawn*. Phase 1 spent four fix rounds on exactly that gap — pieces
// growing out of an absolutely-positioned box whose parent could not
// expand — and a composed scene is worse, because the tutor chooses how
// many slots a group has.
//
// `MATERIAL_BOX` is the one place that geometry is stated. Phase 1's other
// standing fault was an item cap enforced by a validator that the prompt
// shown to the model never mentioned, so good material was refused as
// "malformed" for a reason nobody could act on
// (docs/superpowers/specs/2026-09-07-studylab-composable-material-engine-design.md,
// "What the prompt advertises must match what the validator enforces").
// `fitsInBox` and whatever later advertises the limits to the model both
// read the same frozen object, the way `dropZoneGeometry.ts` already feeds
// both a cap and the CSS backstop for it from one set of numbers.
import type { MaterialSpec } from './types'

/**
 * The activity card this material renders inside, whatever renderer this
 * phase eventually builds — `lib/studylab/blocks.ts`,
 * `def('activity', 'ai', 420, 380)`.
 */
const CARD_WIDTH_PX = 420
const CARD_HEIGHT_PX = 380

/**
 * Chrome `ActivityFrame.tsx` spends before a material gets to draw
 * anything, read off its rendered markup: a 1px border around the outer
 * `w-[420px]` card, that card's own `p-4` (16px/side), a second 1px border
 * on the bordered wrapper drawn around `{children}`, and that wrapper's own
 * `p-3` (12px/side). Width: 420 - 2*1 - 2*16 - 2*1 - 2*12 = 360 — the same
 * arithmetic `dropZoneGeometry.ts`'s `CONTENT_WIDTH_PX` documents for this
 * same card.
 */
const OUTER_BORDER_PX = 1
const OUTER_PADDING_PX = 16 // p-4
const INNER_BORDER_PX = 1
const INNER_PADDING_PX = 12 // p-3
const CONTENT_WIDTH_PX =
  CARD_WIDTH_PX - 2 * OUTER_BORDER_PX - 2 * OUTER_PADDING_PX - 2 * INNER_BORDER_PX - 2 * INNER_PADDING_PX // 360

/**
 * Height the outer flex column spends OUTSIDE the children wrapper, before
 * the wrapper's own border/padding are even considered:
 * - the prompt row — its `h-6` icon span is 24px tall, taller than one
 *   line of the `text-[13px] leading-snug` label beside it, so the icon
 *   sets the row;
 * - the button row — `px-4 py-1.5 text-[12px]`, a 12px line at the
 *   inherited `line-height: 1.5` (18px) plus 2*6px `py-1.5` = 30px;
 * - two `gap-3` (12px) gaps, the outer `flex flex-col`'s spacing between
 *   its three always-present children (prompt row, children wrapper,
 *   button row) — the hint/reveal blocks are conditional
 *   (`AnimatePresence`) and excluded, the same "count only guaranteed
 *   chrome" rule `dropZoneGeometry.ts` applies to its own headroom.
 */
const PROMPT_ROW_PX = 24
const BUTTON_ROW_PX = 30
const OUTER_GAP_PX = 12 // gap-3, two gaps between three stacked children
const CHROME_OUTSIDE_WRAPPER_PX =
  2 * OUTER_BORDER_PX + 2 * OUTER_PADDING_PX + PROMPT_ROW_PX + BUTTON_ROW_PX + 2 * OUTER_GAP_PX

/**
 * What is left inside the bordered, `p-3`-padded children wrapper once its
 * own border/padding come off the card's remaining height — the vertical
 * room a material's own group/slot grid actually has to draw in.
 * 380 - (2 + 32 + 24 + 30 + 24) - (2 + 24) = 242.
 */
const CONTENT_HEIGHT_PX = CARD_HEIGHT_PX - CHROME_OUTSIDE_WRAPPER_PX - 2 * INNER_BORDER_PX - 2 * INNER_PADDING_PX

/**
 * A single slot's own footprint: room for a piece chip carrying the
 * largest icon already drawn for a piece anywhere in Studylab (22px —
 * `SortActivity.tsx`'s `ItemArt`, `CompareActivity.tsx`'s icon), plus the
 * same 8px vertical chip padding `dropZoneGeometry.ts` documents
 * (`CHIP_VERTICAL_PADDING_PX`, a chip's `py-1`). Treated as square: a slot
 * is a drop target sized to its piece, not to a variable-length label.
 */
const ICON_PX = 22
const CHIP_PADDING_PX = 8
const SLOT_PX = ICON_PX + CHIP_PADDING_PX // 30

/** Spacing between slots and between group zones — Tailwind `gap-2`, the
 * same gap `SortActivity.tsx` already uses for its own bin grid. */
const GRID_GAP_PX = 8
/** Spacing between chips inside one zone — Tailwind `gap-1.5`, the gap
 * `SortActivity.tsx` uses inside a single bin's chip wrap. */
const SLOT_GAP_PX = 6

/**
 * A group zone's own chrome, before any slot is drawn inside it: a 2px
 * (`border-2`) frame plus `p-2` (8px/side) padding — `SortActivity.tsx`'s
 * bin (`border-2 ... p-2`), the closest existing precedent in this
 * codebase for "a labelled zone holding a grid of chips."
 */
const GROUP_BORDER_PX = 2
const GROUP_PADDING_PX = 8
const GROUP_CHROME_PX = 2 * GROUP_BORDER_PX + 2 * GROUP_PADDING_PX // 20

/**
 * A group's own label row, above its slot grid: 12px text at the inherited
 * 1.5 line-height (18px) plus the `mb-1.5` (6px) margin under it —
 * `SortActivity.tsx`'s bin label (`text-[12px] ... mb-1.5`).
 */
const GROUP_LABEL_PX = Math.round(12 * 1.5) + 6 // 24

/**
 * How many `SLOT_PX` cells, each trailed by one `gapPx` (the very last one
 * excepted), fit across a budget — "+gap on both sides, divide, floor", the
 * same shape `dropZoneGeometry.ts`'s `deriveGeometry` uses for chip rows,
 * so that N cells' actual footprint (`N*SLOT_PX + (N-1)*gapPx`) never
 * exceeds the stated budget.
 */
function fitCount(budgetPx: number, cellPx: number, gapPx: number): number {
  return Math.max(0, Math.floor((budgetPx + gapPx) / (cellPx + gapPx)))
}

/** A group zone's own content box, once its border/padding come off the
 * card's content box — what its label and slot grid actually have to
 * share. */
const GROUP_CONTENT_WIDTH_PX = CONTENT_WIDTH_PX - GROUP_CHROME_PX
const GROUP_CONTENT_HEIGHT_PX = CONTENT_HEIGHT_PX - GROUP_CHROME_PX - GROUP_LABEL_PX

/**
 * The single frozen source for the box a composed material is drawn in.
 * Every number here is derived above from the card and its chrome, never
 * hand-picked — see the constants this object is built from for what each
 * one measures.
 */
export const MATERIAL_BOX = Object.freeze({
  /** Content width available to the material as a whole (all its groups
   * side by side), once `ActivityFrame`'s chrome is subtracted. */
  widthPx: CONTENT_WIDTH_PX,
  /** Content height available to the material as a whole, once
   * `ActivityFrame`'s chrome is subtracted. */
  heightPx: CONTENT_HEIGHT_PX,
  /** How many group zones fit side by side across `widthPx`, each needing
   * at minimum its own chrome plus one slot's width. */
  maxGroupsPerRow: fitCount(CONTENT_WIDTH_PX, GROUP_CHROME_PX + SLOT_PX, GRID_GAP_PX),
  /** How many slots fit across a single group's own row, inside that
   * group's own chrome — independent of how many other groups share the
   * card, since a composed scene lets the tutor size one group at a time. */
  maxSlotsPerRow: fitCount(GROUP_CONTENT_WIDTH_PX, SLOT_PX, SLOT_GAP_PX),
  /** How many rows of slots fit down a single group's own zone, below its
   * label. */
  maxRows: fitCount(GROUP_CONTENT_HEIGHT_PX, SLOT_PX, SLOT_GAP_PX),
})

/**
 * Refuses a material whose groups cannot be laid out side by side within
 * the box, or whose any single group carries more slots than its own zone
 * can hold — naming the offending group so the tutor knows which one to
 * shrink, not just that the scene as a whole overflowed.
 */
export function fitsInBox(spec: MaterialSpec): { ok: true } | { ok: false; reason: string } {
  if (spec.groups.length > MATERIAL_BOX.maxGroupsPerRow) {
    return {
      ok: false,
      reason: `This material has ${spec.groups.length} groups, but at most ${MATERIAL_BOX.maxGroupsPerRow} fit side by side in the box.`,
    }
  }

  const maxSlotsPerGroup = MATERIAL_BOX.maxSlotsPerRow * MATERIAL_BOX.maxRows
  const slotsByGroup = new Map<string, number>()
  for (const slot of spec.slots) {
    slotsByGroup.set(slot.groupId, (slotsByGroup.get(slot.groupId) ?? 0) + 1)
  }

  for (const group of spec.groups) {
    const count = slotsByGroup.get(group.id) ?? 0
    if (count > maxSlotsPerGroup) {
      return {
        ok: false,
        reason: `Group "${group.id}" has ${count} slots, but its zone holds at most ${maxSlotsPerGroup} (${MATERIAL_BOX.maxSlotsPerRow} per row × ${MATERIAL_BOX.maxRows} rows).`,
      }
    }
  }

  return { ok: true }
}
