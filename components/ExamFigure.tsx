'use client'

import { useEffect, useState } from 'react'
import { figureSrc } from '@/lib/figure-src'

interface ExamFigureProps {
  src: string
  alt?: string
  className?: string
  /**
   * Defaults to eager: in the paged assessment/study views the figure
   * belongs to the question currently on screen, so deferring its load
   * only delays the very image the student needs right now. Pass `true`
   * explicitly for list/results views where a figure is genuinely below
   * the fold (e.g. results review, flashcard decks rendered as a list).
   */
  lazy?: boolean
}

export default function ExamFigure({ src, alt = 'Exam diagram', className = '', lazy = false }: ExamFigureProps) {
  /**
   * Tap to enlarge.
   *
   * A past-paper crop is a labelled line drawing — a ruler against a tray of
   * sand, a circuit with an ammeter marked A1 — and it is capped at 45vh so
   * it does not push the question off the screen. On a laptop that leaves
   * the labels at the edge of legible, and the labels are the part the
   * question asks about. Every other exam reader on earth lets you zoom the
   * figure; this one made you squint.
   */
  const [zoomed, setZoomed] = useState(false)

  useEffect(() => {
    if (!zoomed) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setZoomed(false) }
    document.addEventListener('keydown', onKey)
    // The page behind must not scroll under the overlay.
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [zoomed])

  if (!src) return null
  const url = figureSrc(src)

  return (
    <>
      <div
        className={`bg-ss-panel rounded-xl p-3 mb-3 border border-ss-line min-h-[120px] flex items-center justify-center overflow-hidden ${className}`}
      >
        <button
          type="button"
          onClick={() => setZoomed(true)}
          aria-label="Enlarge the diagram"
          className="group relative min-w-0 cursor-zoom-in rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ss-accent"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={alt}
            // Capped in viewport height, not just width. A tall portrait figure —
            // a digestive system, a river profile — otherwise fills the screen and
            // pushes the question it belongs to below the fold, so the student
            // scrolls past a picture to find out what they are being asked.
            //
            // `min-w-0` is load-bearing and was missing. A flex item defaults to
            // `min-width: auto`, which refuses to shrink below the image's own
            // intrinsic width — so a 1420px past-paper crop inside a ~900px card
            // did not scale down, it hung over the edge and was clipped. Learners
            // saw diagrams with their right-hand labels sliced off.
            className="min-w-0 max-w-full h-auto max-h-[45vh] w-auto object-contain mx-auto rounded-lg"
            loading={lazy ? 'lazy' : 'eager'}
            // Decode off the main thread so a large figure cannot jank the page
            // while the student is already reading the question.
            decoding="async"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-1.5 right-1.5 rounded-md px-1.5 py-0.5 text-[12px] font-semibold text-ss-panel opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
            // The badge sits over the figure itself, so it needs its own
            // ground. The ss-* tokens are CSS variables and Tailwind's alpha
            // modifiers do not apply to them, so the tint is set here.
            style={{ background: 'color-mix(in srgb, var(--ss-ink) 72%, transparent)' }}
          >
            Enlarge
          </span>
        </button>
      </div>

      {zoomed && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Enlarged diagram"
          onClick={() => setZoomed(false)}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-sm"
          style={{ background: 'color-mix(in srgb, var(--ss-ink) 88%, transparent)' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={alt}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[92vh] max-w-[95vw] cursor-zoom-out rounded-xl bg-ss-panel object-contain p-2 shadow-ss-panel"
          />
          <button
            type="button"
            onClick={() => setZoomed(false)}
            className="absolute right-4 top-4 rounded-full bg-ss-panel px-3.5 py-2 text-sm font-bold text-ss-ink shadow-ss-panel"
          >
            Close
          </button>
          <p className="pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2 text-[12px] font-medium text-ss-panel">
            Click anywhere or press Esc to close
          </p>
        </div>
      )}
    </>
  )
}
