'use client'

import { useEffect, useRef, useState } from 'react'
import { TOUR_STEPS, hasSeenTour, markTourSeen, clampStep } from '@/lib/product-tour'

/**
 * First-run coach marks over the sidebar.
 *
 * N1: every tester was lost at some point, and one abandoned the search for
 * the assessment builder and ended up somewhere else entirely. The labels do
 * not say what a section is for.
 *
 * Anchored to the real nav links rather than drawn at fixed coordinates, so it
 * cannot drift out of alignment when the sidebar changes. If a step's link is
 * not on screen — narrow viewport, mobile nav — that step is skipped rather
 * than pointing at nothing.
 */
export default function ProductTour({ enabled = true }: { enabled?: boolean }) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!enabled) return
    if (hasSeenTour()) return
    // Let the shell paint before measuring anything.
    const t = window.setTimeout(() => setOpen(true), 600)
    return () => window.clearTimeout(t)
  }, [enabled])

  const current = TOUR_STEPS[clampStep(step)]

  // Re-measure on step change and on resize: a coach mark pinned to stale
  // coordinates is worse than none.
  useEffect(() => {
    if (!open) return
    const measure = () => {
      const link = document.querySelector<HTMLElement>(`aside a[href="${current.href}"]`)
      setRect(link ? link.getBoundingClientRect() : null)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [open, current])

  useEffect(() => {
    if (!open) return
    panelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish()
      if (e.key === 'ArrowRight') next()
      if (e.key === 'ArrowLeft') setStep((s) => clampStep(s - 1))
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  const finish = () => {
    markTourSeen()
    setOpen(false)
  }

  const next = () => {
    if (step >= TOUR_STEPS.length - 1) finish()
    else setStep((s) => s + 1)
  }

  if (!open) return null

  // With no anchor (mobile nav, or a hidden sidebar) the tour still runs as a
  // centred card — the words are the point, the pointing is a bonus.
  const anchored = rect !== null
  const panelStyle: React.CSSProperties = anchored
    ? { position: 'fixed', top: Math.max(12, rect.top - 8), left: rect.right + 16, maxWidth: 320 }
    : { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', maxWidth: 360 }

  return (
    <div className="fixed inset-0 z-[80]">
      <div className="absolute inset-0 bg-black/45" onClick={finish} aria-hidden />

      {anchored && (
        // Cut-out ring around the real link, so the words point at something.
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-[15px] ring-4 ring-white"
          style={{
            top: rect.top - 4,
            left: rect.left - 4,
            width: rect.width + 8,
            height: rect.height + 8,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
          }}
        />
      )}

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        tabIndex={-1}
        style={panelStyle}
        className="rounded-2xl bg-ss-panel p-5 shadow-2xl outline-none"
      >
        <p className="text-[12px] font-bold uppercase tracking-widest text-ss-accent">
          Step {step + 1} of {TOUR_STEPS.length}
        </p>
        <h2 id="tour-title" className="mt-1 text-[17px] font-extrabold text-ss-ink">{current.title}</h2>
        <p className="mt-1.5 text-[13.5px] font-medium text-ss-slate">{current.body}</p>

        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={finish}
            className="text-[13px] font-bold text-ss-slate hover:text-ss-ink"
          >
            Skip
          </button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((s) => clampStep(s - 1))}
                className="rounded-xl border border-ss-line px-3.5 py-2 text-[13px] font-bold text-ss-ink hover:border-ss-accent"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={next}
              className="rounded-xl bg-ss-accent px-4 py-2 text-[13px] font-extrabold text-white hover:opacity-90"
            >
              {step >= TOUR_STEPS.length - 1 ? 'Got it' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
