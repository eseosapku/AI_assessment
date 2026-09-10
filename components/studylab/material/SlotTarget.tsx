'use client'
import type { ReactNode } from 'react'
import type { Slot } from '@/lib/studylab/material/types'
import { MATERIAL_BOX } from '@/lib/studylab/material/fit'

export function SlotTarget({
  slot,
  hot,
  children,
}: {
  slot: Slot
  hot?: boolean
  children?: ReactNode
}) {
  const size = MATERIAL_BOX.slotPx
  return (
    <div
      data-drop-target={slot.id}
      className="flex flex-wrap content-start items-start rounded-md border border-dashed"
      style={{
        minWidth: size,
        minHeight: size,
        gap: MATERIAL_BOX.slotGapPx,
        borderColor: hot ? 'var(--ss-accent)' : 'var(--ss-line)',
        backgroundColor: hot ? 'var(--ss-canvas)' : 'transparent',
      }}
    >
      {children}
    </div>
  )
}
