'use client'

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { motionFor } from '@/lib/studylab/motionPresets'

/**
 * A key term with its definition one tap away.
 *
 * The definition opens in a small card below the word (above it, near the
 * bottom of the screen), drawn in a portal so a card's rounded, clipped frame
 * cannot cut it off. It closes on Escape, on a tap anywhere else, or when the
 * board moves underneath it.
 */
export function GlossaryTerm({
  term,
  definition,
  label,
}: {
  /** The term as rendered (maths already typeset). */
  term: ReactNode
  /** The definition as rendered. */
  definition: ReactNode
  /** The term as plain text, for the button's accessible name. */
  label: string
}) {
  const [open, setOpen] = useState(false)
  const [place, setPlace] = useState<{ left: number; top: number; above: boolean; vars: Record<string, string> } | null>(null)
  const button = useRef<HTMLButtonElement>(null)
  const card = useRef<HTMLDivElement>(null)
  const id = useId()
  const reduced = useReducedMotion() ?? false

  useLayoutEffect(() => {
    if (!open || !button.current) return
    const r = button.current.getBoundingClientRect()
    const above = r.bottom + 140 > window.innerHeight
    // The card is drawn at the page root, outside the lesson's colour scope,
    // so it carries the lesson's colours with it.
    const computed = getComputedStyle(button.current)
    const vars = Object.fromEntries(
      ['--subject', '--subject-soft', '--subject-ink'].map((v) => [v, computed.getPropertyValue(v).trim()]),
    )
    setPlace({ left: Math.min(Math.max(8, r.left), window.innerWidth - 280), top: above ? r.top - 8 : r.bottom + 8, above, vars })
  }, [open])

  useEffect(() => {
    if (!open) return
    const close = (e: Event) => {
      if (e.type === 'keydown' && (e as KeyboardEvent).key !== 'Escape') return
      if (e.type === 'pointerdown' && (card.current?.contains(e.target as Node) || button.current?.contains(e.target as Node))) return
      setOpen(false)
      if (e.type === 'keydown') button.current?.focus()
    }
    window.addEventListener('keydown', close, true)
    window.addEventListener('pointerdown', close, true)
    window.addEventListener('wheel', close, { passive: true })
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('keydown', close, true)
      window.removeEventListener('pointerdown', close, true)
      window.removeEventListener('wheel', close)
      window.removeEventListener('resize', close)
    }
  }, [open])

  const m = motionFor('rise', reduced)
  return (
    <>
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={`${label}: show what it means`}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
        className="nodrag inline cursor-help rounded-sm px-0.5 font-semibold text-ss-subject-ink underline decoration-[color:var(--subject)] decoration-dotted decoration-2 underline-offset-[3px] hover:bg-[color:var(--subject-soft)] focus-visible:outline-2 focus-visible:outline-[color:var(--subject)]"
      >
        {term}
      </button>
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {open && place && (
              <motion.div
                ref={card}
                id={id}
                role="tooltip"
                initial={m.initial}
                animate={m.animate}
                exit={m.exit}
                transition={m.transition}
                className="fixed z-[1000] w-[272px] rounded-xl border border-ss-line bg-ss-panel px-3.5 py-3 text-[13px] leading-relaxed text-ss-ink shadow-[0_18px_40px_-16px_rgba(20,60,90,0.45)]"
                style={{ left: place.left, top: place.top, transform: place.above ? 'translateY(-100%)' : undefined, ...place.vars }}
              >
                <p className="mb-1 text-[12px] font-bold uppercase tracking-wide text-ss-subject-ink">{term}</p>
                <div>{definition}</div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  )
}
