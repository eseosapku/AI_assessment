'use client'
import { assetUrl } from '@/lib/studylab/activities/assetCatalog'
import type { Piece } from '@/lib/studylab/material/types'
import { MATERIAL_BOX } from '@/lib/studylab/material/fit'

export function PieceChip({
  piece,
  dragging,
  dragProps,
}: {
  piece: Piece
  dragging?: boolean
  /** Spread from useActivityDrag(...).itemProps(piece.id, ...). */
  dragProps?: Record<string, unknown>
}) {
  const src = piece.art ? assetUrl(piece.art) : null
  const size = MATERIAL_BOX.slotPx
  return (
    <span
      data-item={piece.id}
      {...dragProps}
      className={`nodrag flex cursor-grab items-center justify-center gap-1 active:cursor-grabbing touch-none rounded-lg border border-ss-line px-1.5 text-[12px] font-semibold text-ss-ink shadow-sm ${dragging ? 'opacity-50' : ''}`}
      style={{
        minWidth: size,
        minHeight: size,
        backgroundColor: 'var(--ss-panel)',
      }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={piece.label} width={22} height={22} style={{ width: 22, height: 22 }} className="object-contain" />
      ) : null}
      <span>{piece.label}</span>
    </span>
  )
}
