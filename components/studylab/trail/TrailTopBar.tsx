'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import { Check, ChevronDown, MoreHorizontal, X } from 'lucide-react'
import { usePopoverBehavior } from '@/components/ui/Modal'
import { paletteItems } from '@/lib/studylab/blocks'
import { useMuted } from '@/lib/studylab/sound'
import { trailMenu, type MenuId, type PillTone } from '@/lib/studylab/trail/furniture'
import { markToolUsed } from '@/lib/studylab/tour/usage'
import type { PlotBox } from '@/lib/studylab/trail/types'

const PILL = 'pointer-events-auto rounded-full border border-ss-line bg-ss-panel shadow-ss-panel'
const ROW = 'flex min-h-[44px] w-full items-center gap-2 rounded-xl px-3 text-left text-[16px] font-semibold text-ss-ink hover:bg-ss-chip'
const ZOOM_MS = 200

const PILL_FILL: Record<PillTone, string> = { done: 'var(--ss-good)', current: 'var(--subject)', rest: 'var(--trail-rest)' }

/**
 * The lesson across the top: a way out, the journey with where you are, and the
 * Board menu. The station list flies the camera and nothing else.
 */
export function TrailTopBar({ pills, label, plots, onLeave, onStation, onWholeBoard, onBackToCard, onAddBlock, onMenuChange, onTour }: {
  pills: { tone: PillTone }[]
  label: string
  plots: PlotBox[]
  onLeave: () => void
  onStation: (plot: PlotBox) => void
  onWholeBoard: () => void
  onBackToCard: () => void
  onAddBlock: (type: string) => void
  /** So Esc closes this first and leaves the chat alone. */
  onMenuChange: (open: boolean) => void
  /** Replays the tour. */
  onTour?: () => void
}) {
  const rf = useReactFlow()
  const [muted, setMuted] = useMuted()
  const [menu, setMenu] = useState<'stations' | 'board' | null>(null)
  const [adding, setAdding] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  const close = useCallback(() => {
    setMenu(null)
    setAdding(false)
  }, [])
  usePopoverBehavior({ open: menu !== null, onClose: close })
  useEffect(() => onMenuChange(menu !== null), [menu, onMenuChange])
  useEffect(() => {
    if (!menu) return
    const outside = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) close()
    }
    window.addEventListener('pointerdown', outside)
    return () => window.removeEventListener('pointerdown', outside)
  }, [menu, close])

  const choose = (id: MenuId) => {
    if (id === 'add') {
      setAdding((a) => !a)
      return
    }
    close()
    if (id === 'whole') onWholeBoard()
    else if (id === 'back') onBackToCard()
    else if (id === 'zoomIn') void rf.zoomIn({ duration: ZOOM_MS })
    else if (id === 'zoomOut') void rf.zoomOut({ duration: ZOOM_MS })
    else if (id === 'sound') setMuted(!muted)
  }

  return (
    <div ref={root} className="pointer-events-none absolute inset-x-0 top-3 z-30 flex items-start justify-between gap-2 px-3 sm:px-4">
      <button type="button" data-tour="lesson-leave" onClick={onLeave} aria-label="Back to all LearnSpaces" className={`${PILL} ss-press flex h-11 w-11 shrink-0 items-center justify-center text-ss-ink`}>
        <X className="h-5 w-5" aria-hidden />
      </button>

      <div className="relative min-w-0">
        <button
          type="button"
          data-tour="lesson-stations"
          onClick={() => {
            if (menu !== 'stations') markToolUsed('lesson-stations')
            setMenu((m) => (m === 'stations' ? null : 'stations'))
          }}
          aria-expanded={menu === 'stations'}
          aria-haspopup="true"
          className={`${PILL} ss-press flex h-11 min-w-0 max-w-full items-center gap-3 px-4`}
        >
          <span className="flex shrink-0 items-center gap-1" aria-hidden>
            {pills.map((p, i) => (
              <span key={i} className="h-2 w-5 rounded-full sm:w-8" style={{ background: PILL_FILL[p.tone], opacity: p.tone === 'rest' ? 0.45 : 1 }} />
            ))}
          </span>
          <span className="hidden truncate font-display text-[16px] font-bold text-ss-ink sm:block">{label}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-ss-slate" aria-hidden />
          <span className="sr-only sm:hidden">{label}</span>
        </button>
        {menu === 'stations' && (
          <div role="menu" aria-label="Stations" className="pointer-events-auto absolute left-1/2 top-full mt-2 max-h-[70vh] w-80 max-w-[90vw] -translate-x-1/2 overflow-auto rounded-2xl border border-ss-line bg-ss-panel p-1.5 shadow-xl">
            {plots.map((p) => (
              <button
                key={p.id}
                type="button"
                role="menuitem"
                className={ROW}
                onClick={() => {
                  close()
                  onStation(p)
                }}
              >
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[14px] font-extrabold text-white"
                  style={{ background: p.state === 'done' ? 'var(--ss-good)' : p.state === 'current' || p.state === 'next' ? 'var(--subject)' : 'var(--trail-rest)' }}
                  aria-hidden
                >
                  {p.state === 'done' ? <Check className="h-4 w-4" /> : p.index + 1}
                </span>
                <span className="min-w-0 truncate">{p.title}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="relative shrink-0">
        <button
          type="button"
          data-tour="lesson-board-menu"
          onClick={() => setMenu((m) => (m === 'board' ? null : 'board'))}
          aria-expanded={menu === 'board'}
          aria-haspopup="menu"
          className={`${PILL} ss-press flex h-11 items-center gap-1.5 px-4 text-[16px] font-bold text-ss-ink`}
        >
          <MoreHorizontal className="h-5 w-5" aria-hidden />
          Board
        </button>
        {menu === 'board' && (
          <div role="menu" aria-label="Board" className="pointer-events-auto absolute right-0 top-full mt-2 max-h-[80vh] w-64 overflow-auto rounded-2xl border border-ss-line bg-ss-panel p-1.5 shadow-xl">
            {trailMenu({ muted }).map((item) => (
              <div key={item.id}>
                <button type="button" role="menuitem" aria-expanded={item.id === 'add' ? adding : undefined} className={ROW} onClick={() => choose(item.id)}>
                  {item.label}
                </button>
                {item.id === 'add' && adding && (
                  <div className="ml-3 border-l border-ss-line pl-2">
                    {paletteItems()
                      .filter((b) => b.type !== 'frame')
                      .map((b) => (
                        <button
                          key={b.type}
                          type="button"
                          role="menuitem"
                          className={ROW}
                          onClick={() => {
                            close()
                            markToolUsed('lesson-board-menu')
                            onAddBlock(b.type)
                          }}
                        >
                          {b.palette?.label ?? b.type}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            ))}
            {onTour && (
              <button
                type="button"
                role="menuitem"
                className={ROW}
                onClick={() => {
                  close()
                  onTour()
                }}
              >
                Show me around
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
