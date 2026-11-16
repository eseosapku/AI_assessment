'use client'
import { SafeLatex } from '../canvasShared'
import { useRef, useState, type CSSProperties } from 'react'
import { assetUrl } from '@/lib/studylab/activities/assetCatalog'
import type { Piece } from '@/lib/studylab/material/types'
import { MATERIAL_BOX } from '@/lib/studylab/material/fit'

/** The dragged item keeps at least this much width, so a sentence stays a card. */
const GHOST_MIN_PX = 220
const GHOST_MAX_PX = 300
/** A click that ends this far from where it began was a drag, not a tap. */
const TAP_SLOP_PX = 6

export function PieceChip({
  piece,
  dragging,
  dragProps,
  wrong = false,
  wide = false,
  selected = false,
  onTap,
}: {
  piece: Piece
  dragging?: boolean
  /** Spread from useActivityDrag(...).itemProps(piece.id, ...). */
  dragProps?: Record<string, unknown>
  wrong?: boolean
  /** A sentence: fills its bin's width and wraps, rather than shrink-wrapping. */
  wide?: boolean
  /** Picked up by tap, waiting for a bin. */
  selected?: boolean
  onTap?: () => void
}) {
  const src = piece.art ? assetUrl(piece.art) : null
  const size = MATERIAL_BOX.slotPx
  const { style: dragStyle, ...restDragProps } = dragProps ?? {}
  // Where the grab began and how big the chip was then: the ghost keeps a
  // readable width, and a same-sized hole holds its place so nothing reflows.
  const down = useRef<{ x: number; y: number } | null>(null)
  const [box, setBox] = useState<{ w: number; h: number } | null>(null)
  const ghostWidth = wide && box ? Math.min(GHOST_MAX_PX, Math.max(GHOST_MIN_PX, box.w)) : undefined
  const userDown = (restDragProps as { onPointerDown?: (e: React.PointerEvent) => void }).onPointerDown
  return (
    <span
      className={wide ? 'block w-full' : 'inline-flex'}
      style={dragging && box ? { width: wide ? undefined : box.w, height: box.h, display: wide ? 'block' : 'inline-flex' } : undefined}
    >
      <span
        data-item={piece.id}
        data-part={`piece-${piece.id}`}
        {...restDragProps}
        aria-pressed={selected}
        onPointerDown={(e) => {
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
          down.current = { x: e.clientX, y: e.clientY }
          setBox({ w: r.width, h: r.height })
          userDown?.(e)
        }}
        onClick={(e) => {
          const d = down.current
          down.current = null
          if (!onTap || !d) return
          if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > TAP_SLOP_PX) return
          e.stopPropagation()
          onTap()
        }}
        className={`nodrag flex cursor-grab items-center gap-1.5 active:cursor-grabbing touch-none rounded-lg border px-2 text-[13px] font-semibold shadow-sm transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--ss-accent)] ${
          wide ? 'w-full justify-start py-2 text-left leading-snug' : 'justify-center'
        } ${selected ? 'border-[color:var(--ss-accent)] ring-2 ring-[color:var(--ss-accent)]' : 'border-ss-line'} ${
          wrong ? 'bg-red-500/10 text-red-600 dark:text-red-400' : 'text-ss-ink'
        } ${dragging ? 'shadow-lg' : ''}`}
        style={{
          minWidth: size,
          minHeight: size,
          backgroundColor: wrong ? undefined : 'var(--ss-panel)',
          ...(dragStyle as CSSProperties | undefined),
          ...(dragging && ghostWidth ? { width: ghostWidth } : {}),
          ...(dragging ? { opacity: 0.92 } : {}),
        }}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={piece.label} width={22} height={22} style={{ width: 22, height: 22 }} className="shrink-0 object-contain" />
        ) : null}
        <span className="min-w-0"><SafeLatex>{piece.label}</SafeLatex></span>
      </span>
    </span>
  )
}
