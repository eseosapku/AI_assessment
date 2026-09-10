'use client'
import type { CSSProperties } from 'react'
import { assetUrl } from '@/lib/studylab/activities/assetCatalog'
import type { Piece } from '@/lib/studylab/material/types'
import { MATERIAL_BOX } from '@/lib/studylab/material/fit'

export function PieceChip({
  piece,
  dragging,
  dragProps,
  wrong = false,
}: {
  piece: Piece
  dragging?: boolean
  /** Spread from useActivityDrag(...).itemProps(piece.id, ...). */
  dragProps?: Record<string, unknown>
  wrong?: boolean
}) {
  const src = piece.art ? assetUrl(piece.art) : null
  const size = MATERIAL_BOX.slotPx
  const { style: dragStyle, ...restDragProps } = dragProps ?? {}
  return (
    <span
      data-item={piece.id}
      {...restDragProps}
      className={`nodrag flex cursor-grab items-center justify-center gap-1 active:cursor-grabbing touch-none rounded-lg border border-ss-line px-1.5 text-[12px] font-semibold shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--ss-accent)] ${
        wrong ? 'bg-red-500/10 text-red-600 dark:text-red-400' : 'text-ss-ink'
      } ${dragging ? 'opacity-50' : ''}`}
      style={{
        minWidth: size,
        minHeight: size,
        backgroundColor: wrong ? undefined : 'var(--ss-panel)',
        ...(dragStyle as CSSProperties | undefined),
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
