'use client'

import { useReactFlow, useStore, useViewport } from '@xyflow/react'
import { Minus, Plus, Maximize2 } from 'lucide-react'

/**
 * Zoom you can read.
 *
 * React Flow's default `<Controls>` is three unlabelled icon buttons with no
 * indication of how far in you are — the same "what does this do" problem the
 * rest of this pass has been fixing, in miniature. Named buttons, a visible
 * percentage, and a fit control that says what it fits.
 */
export function ZoomControl() {
  const rf = useReactFlow()
  const { zoom } = useViewport()
  const minZoom = useStore((s) => s.minZoom)
  const maxZoom = useStore((s) => s.maxZoom)

  const pct = Math.round(zoom * 100)
  const btn =
    'grid h-8 w-8 place-items-center rounded-lg border border-ss-line text-ss-ink transition-colors hover:border-ss-accent hover:text-ss-accent disabled:cursor-not-allowed disabled:opacity-40'

  return (
    <div className="flex items-center gap-1.5 rounded-xl border border-ss-line bg-[color:var(--ss-panel)]/95 px-2.5 py-2 shadow-ss-panel backdrop-blur">
      <button
        type="button"
        onClick={() => rf.zoomOut({ duration: 200 })}
        disabled={zoom <= minZoom + 0.001}
        aria-label="Zoom out"
        className={btn}
      >
        <Minus className="h-4 w-4" aria-hidden />
      </button>

      {/* The number is the point: the icons never said how far in you were. */}
      <span className="min-w-[48px] text-center text-[12px] font-bold tabular-nums text-ss-ink">
        {pct}%
      </span>

      <button
        type="button"
        onClick={() => rf.zoomIn({ duration: 200 })}
        disabled={zoom >= maxZoom - 0.001}
        aria-label="Zoom in"
        className={btn}
      >
        <Plus className="h-4 w-4" aria-hidden />
      </button>

      <span className="mx-0.5 h-5 w-px bg-ss-line" aria-hidden />

      <button
        type="button"
        onClick={() => rf.fitView({ duration: 400, padding: 0.3, maxZoom: 1 })}
        aria-label="Fit the whole lesson on screen"
        className={btn}
      >
        <Maximize2 className="h-4 w-4" aria-hidden />
      </button>
    </div>
  )
}
