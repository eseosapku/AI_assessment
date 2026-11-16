// lib/studylab/material/sortLayout.ts
// Two pure decisions the material board makes for sorting: how to lay the
// bins out (from the length of what is being sorted), and what a tap does.
import type { MaterialSpec } from './types'

/** A label longer than this cannot be read in a third-width column. */
export const COMPACT_LABEL_MAX = 16

export type GroupLayout = 'columns' | 'rows'

/**
 * Short items (words, numbers, symbols) keep the compact side-by-side bins.
 * Sentences stack the bins as full-width rows. Chosen from the item length,
 * never from the bin count. Only a plain sort (every bin unordered, one slot
 * each, no displays or controls) is eligible: ordered tracks and the like
 * keep their own geometry.
 */
export function isPlainSort(spec: MaterialSpec): boolean {
  return (
    spec.groups.length > 0 &&
    spec.groups.every((g) => !g.ordered) &&
    spec.slots.length === spec.groups.length &&
    !spec.displays?.length &&
    !spec.controls?.length
  )
}

export function chooseGroupLayout(spec: MaterialSpec): GroupLayout {
  if (!isPlainSort(spec)) return 'columns'
  return spec.pieces.some((p) => p.label.length > COMPACT_LABEL_MAX) ? 'rows' : 'columns'
}

export type TapTarget =
  | { kind: 'piece'; id: string; placed: boolean }
  | { kind: 'slot'; id: string }

export type TapResult =
  | { type: 'select'; pieceId: string | null }
  | { type: 'place'; pieceId: string; slotId: string }
  | { type: 'unplace'; pieceId: string }
  | { type: 'none' }

/**
 * Tap to place. Tap an item to pick it up (tap it again to put it down);
 * tap a bin to drop the held item there. With nothing held, tapping a placed
 * item sends it back to the pool. Tapping another item while holding one
 * switches to that item.
 */
export function resolveTap(selectedId: string | null, target: TapTarget): TapResult {
  if (target.kind === 'piece') {
    if (selectedId === target.id) return { type: 'select', pieceId: null }
    if (selectedId === null && target.placed) return { type: 'unplace', pieceId: target.id }
    return { type: 'select', pieceId: target.id }
  }
  if (selectedId === null) return { type: 'none' }
  return { type: 'place', pieceId: selectedId, slotId: target.id }
}
