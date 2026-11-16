'use client'
import type { ReactNode } from 'react'
import type { Slot } from '@/lib/studylab/material/types'
import { MATERIAL_BOX } from '@/lib/studylab/material/fit'

export function SlotTarget({
  slot,
  hot,
  roomy = false,
  stack = false,
  onTap,
  children,
}: {
  slot: Slot
  hot?: boolean
  /** A sort bin: the whole bin is the drop target, not just the chips in it. */
  roomy?: boolean
  /** Full-width items, one per line. */
  stack?: boolean
  onTap?: () => void
  children?: ReactNode
}) {
  const size = MATERIAL_BOX.slotPx
  return (
    <div
      data-drop-target={slot.id}
      data-part={`slot-${slot.id}`}
      onClick={onTap ? (e) => { e.stopPropagation(); onTap() } : undefined}
      className={`flex rounded-md border border-dashed ${stack ? 'w-full flex-col' : 'flex-wrap content-start items-start'}`}
      style={{
        minWidth: size,
        minHeight: roomy ? 52 : size,
        gap: MATERIAL_BOX.slotGapPx,
        borderColor: hot ? 'var(--ss-accent)' : 'var(--ss-line)',
        backgroundColor: hot ? 'var(--ss-canvas)' : 'transparent',
      }}
    >
      {children}
    </div>
  )
}
