'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  TOURS,
  hasSeenTour,
  markTourSeen,
  clampStep,
  choosePlacement,
  type Placement,
  type TourId,
} from '@/lib/product-tour'

const PANEL_W = 348
const GAP = 18

/**
 * First-run coach marks.
 *
 * Anchored to real controls through explicit `data-tour` attributes. The
 * previous version matched on the shell's markup (`aside a[href=...]`), so an
 * unrelated structural change — making the sidebar a div, for landmark reasons
 * — silently unhooked every step and the tour became four cards in the middle
 * of the screen pointing at nothing. That is worse than no tour, because it
 * makes the product look broken on a student's first visit.
 *
 * Two rules follow. A step whose anchor is missing is skipped rather than shown
 * adrift, and if nothing at all can be anchored the tour does not run.
 */
export default function ProductTour({ id = 'home', enabled = true }: { id?: TourId; enabled?: boolean }) {
  const steps = TOURS[id].steps
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [placement, setPlacement] = useState<Placement>('right')
  const panelRef = useRef<HTMLDivElement>(null)

  const findAnchor = (i: number) => {
    const s = steps[i]
    if (!s) return null
    const el = document.querySelector<HTMLElement>(`[data-tour="${CSS.escape(s.anchor)}"]`)
    // getClientRects is empty for display:none — the mobile/desktop nav swap.
    return el && el.getClientRects().length > 0 ? el : null
  }

  /** The next step in `dir` that actually has something to point at. */
  const nextAnchored = useCallback(
    (from: number, dir: 1 | -1): number => {
      for (let i = from; i >= 0 && i < steps.length; i += dir) {
        if (findAnchor(i)) return i
      }
      return -1
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [steps],
  )

  useEffect(() => {
    if (!enabled || hasSeenTour(id)) return
    // Let the shell paint before measuring anything.
    const t = window.setTimeout(() => {
      const first = nextAnchored(0, 1)
      if (first < 0) return // nothing to point at, so say nothing
      setStep(first)
      setOpen(true)
    }, 700)
    return () => window.clearTimeout(t)
  }, [enabled, id, nextAnchored])

  const current = steps[clampStep(step, steps.length)]

  // Measure after paint, and keep measuring. A coach mark on stale coordinates
  // is the failure this rewrite exists to prevent.
  useLayoutEffect(() => {
    if (!open) return
    const measure = () => {
      const el = findAnchor(step)
      if (!el) {
        setRect(null)
        return
      }
      const r = el.getBoundingClientRect()
      setRect(r)
      const h = panelRef.current?.offsetHeight ?? 240
      setPlacement(
        choosePlacement(
          r,
          { width: PANEL_W, height: h },
          { width: window.innerWidth, height: window.innerHeight },
          GAP,
        ),
      )
    }
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [open, step])

  const finish = useCallback(() => {
    markTourSeen(id)
    setOpen(false)
  }, [id])

  const go = useCallback(
    (dir: 1 | -1) => {
      const target = nextAnchored(step + dir, dir)
      if (target < 0) {
        if (dir === 1) finish()
        return
      }
      setStep(target)
    },
    [step, nextAnchored, finish],
  )

  useEffect(() => {
    if (!open) return
    panelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish()
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, finish, go])

  if (!open || !current) return null

  const isLast = nextAnchored(step + 1, 1) < 0
  const isFirst = nextAnchored(step - 1, -1) < 0
  const shownIndex = steps.filter((_, i) => i <= step && findAnchor(i)).length
  const shownTotal = steps.filter((_, i) => findAnchor(i)).length

  const panelHeight = panelRef.current?.offsetHeight ?? 240
  const style: React.CSSProperties = { position: 'fixed', width: PANEL_W, zIndex: 82 }
  if (rect && placement !== 'center') {
    if (placement === 'right') {
      Object.assign(style, { left: rect.right + GAP, top: clampY(rect.top - 12, panelHeight) })
    } else if (placement === 'left') {
      Object.assign(style, { left: rect.left - PANEL_W - GAP, top: clampY(rect.top - 12, panelHeight) })
    } else if (placement === 'below') {
      Object.assign(style, { top: rect.bottom + GAP, left: clampX(rect.left) })
    } else {
      Object.assign(style, { top: Math.max(12, rect.top - panelHeight - GAP), left: clampX(rect.left) })
    }
  } else {
    Object.assign(style, { top: '50%', left: '50%', transform: 'translate(-50%,-50%)' })
  }

  return (
    <div className="fixed inset-0 z-[80]">
      {/* The dim is painted by the spotlight's own outsized box-shadow, so the
          highlighted control stays fully lit instead of dimmed and outlined. */}
      <div className="absolute inset-0" onClick={finish} aria-hidden />

      {rect && (
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-[16px] transition-all duration-300 ease-out"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            boxShadow:
              '0 0 0 9999px rgba(9,20,28,0.62), 0 0 0 3px var(--ss-accent), 0 0 24px 5px rgba(12,111,174,0.5)',
          }}
        />
      )}

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        tabIndex={-1}
        style={style}
        className="rounded-[20px] border border-ss-line bg-ss-panel p-5 shadow-2xl outline-none"
      >
        {rect && placement !== 'center' && <Pointer placement={placement} />}

        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[color:var(--ss-accent)]/12 px-2.5 py-1 text-[12px] font-black uppercase tracking-[0.12em] text-ss-accent">
            {current.eyebrow}
          </span>
          <span className="ml-auto text-[12px] font-bold tabular-nums text-ss-slate">
            {shownIndex} / {shownTotal}
          </span>
        </div>

        <h2 id="tour-title" className="mt-3 text-[18px] font-extrabold leading-snug text-ss-ink">
          {current.title}
        </h2>
        <p id="tour-body" className="mt-2 text-[13.5px] font-medium leading-relaxed text-ss-slate">
          {current.body}
        </p>
        {current.action && (
          <p className="mt-2.5 rounded-xl bg-ss-chip px-3 py-2 text-[12.5px] font-semibold text-ss-ink">
            {current.action}
          </p>
        )}

        {/* Dots rather than "Step 3 of 4": the eye reads them without parsing. */}
        <div className="mt-4 flex items-center gap-1.5" aria-hidden>
          {Array.from({ length: shownTotal }).map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i < shownIndex ? 'w-5 bg-ss-accent' : 'w-1.5 bg-ss-line'
              }`}
            />
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={finish}
            className="text-[13px] font-bold text-ss-slate hover:text-ss-ink"
          >
            Skip the tour
          </button>
          <div className="flex items-center gap-2">
            {!isFirst && (
              <button
                type="button"
                onClick={() => go(-1)}
                className="rounded-xl border border-ss-line px-3.5 py-2 text-[13px] font-bold text-ss-ink hover:border-ss-accent"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={() => go(1)}
              className="rounded-xl bg-ss-accent px-4 py-2 text-[13px] font-extrabold text-white transition-opacity hover:opacity-90"
            >
              {isLast ? 'Got it' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Small triangle joining the panel to the thing it is talking about. */
function Pointer({ placement }: { placement: Placement }) {
  const at: Record<string, string> = {
    right: 'left-[-7px] top-8 border-b border-l',
    left: 'right-[-7px] top-8 border-r border-t',
    below: 'left-8 top-[-7px] border-l border-t',
    above: 'bottom-[-7px] left-8 border-b border-r',
  }
  return (
    <span
      aria-hidden
      className={`absolute h-3 w-3 rotate-45 border-ss-line bg-ss-panel ${at[placement] ?? ''}`}
    />
  )
}

function clampY(y: number, h: number) {
  return Math.max(12, Math.min(y, window.innerHeight - h - 12))
}

function clampX(x: number) {
  return Math.max(12, Math.min(x, window.innerWidth - PANEL_W - 12))
}
