'use client'

import { useEffect, useId, useRef, type ReactNode } from 'react'

/**
 * Accessible dialog.
 *
 * Ten overlay surfaces in this product were plain `div`s: no dialog role, no
 * focus trap, no Escape, no focus restore. To assistive technology they simply
 * did not exist as dialogs — a screen-reader user was left reading the page
 * behind, and a keyboard user could Tab straight out of the modal into
 * controls they could not see. That is the "some modals aren't picked up at
 * all by accessibility functions" report.
 *
 * This centralises the behaviour so a new modal gets it by construction rather
 * than by remembering.
 */

/** Focusable descendants, in DOM order, ignoring anything inert. */
function focusables(root: HTMLElement): HTMLElement[] {
  const selector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',')
  return Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement,
  )
}

/**
 * The dialog behaviour on its own, for overlays that already have their own
 * markup and layout.
 *
 * Several surfaces here are not shaped like a generic modal — a side panel, a
 * notification popover, an animated two-column wizard. Rewriting each around a
 * shared wrapper would be a large, risky change for no user-visible gain, so
 * they adopt the behaviour and keep their markup. Point `ref` at the panel and
 * spread the returned props onto it.
 */
export function useDialogBehavior({
  open,
  onClose,
  labelledBy,
}: {
  open: boolean
  onClose: () => void
  labelledBy?: string
}) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const openedFrom = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    ;(panel ? focusables(panel)[0] ?? panel : null)?.focus()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key !== 'Tab' || !panel) return
      const items = focusables(panel)
      if (items.length === 0) {
        e.preventDefault()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (e.shiftKey && (active === first || !panel.contains(active))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      document.body.style.overflow = previousOverflow
      openedFrom?.focus?.()
    }
  }, [open, onClose])

  return {
    ref: panelRef,
    dialogProps: {
      role: 'dialog' as const,
      'aria-modal': true as const,
      'aria-labelledby': labelledBy,
      tabIndex: -1,
    },
  }
}

export function Modal({
  open,
  onClose,
  title,
  /** Set when the visible heading lives in `children`; the dialog points at it. */
  labelledBy,
  children,
  className = '',
  /** Some flows (a required choice) should not be dismissible by backdrop. */
  dismissOnBackdrop = true,
}: {
  open: boolean
  onClose: () => void
  title?: string
  labelledBy?: string
  children: ReactNode
  className?: string
  dismissOnBackdrop?: boolean
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const restoreTo = useRef<HTMLElement | null>(null)
  const generatedId = useId()
  const titleId = labelledBy ?? (title ? `${generatedId}-title` : undefined)

  useEffect(() => {
    if (!open) return

    // Remember who opened us so focus can go home on close — otherwise a
    // keyboard user is dumped at the top of the document.
    restoreTo.current = document.activeElement as HTMLElement | null

    const panel = panelRef.current
    const first = panel ? focusables(panel)[0] : null
    ;(first ?? panel)?.focus()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key !== 'Tab' || !panel) return

      // Trap: wrap at both ends rather than letting focus escape to the page
      // behind, which the user cannot see.
      const items = focusables(panel)
      if (items.length === 0) {
        e.preventDefault()
        return
      }
      const firstItem = items[0]
      const lastItem = items[items.length - 1]
      const active = document.activeElement

      if (e.shiftKey && (active === firstItem || !panel.contains(active))) {
        e.preventDefault()
        lastItem.focus()
      } else if (!e.shiftKey && active === lastItem) {
        e.preventDefault()
        firstItem.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)

    // Background scroll would otherwise move under the dialog.
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      document.body.style.overflow = previousOverflow
      restoreTo.current?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 backdrop-blur-sm sm:p-6"
      onClick={dismissOnBackdrop ? onClose : undefined}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={`max-h-[92vh] w-full overflow-hidden rounded-2xl bg-ss-panel shadow-2xl outline-none ${className}`}
      >
        {title && (
          <h2 id={titleId} className="sr-only">
            {title}
          </h2>
        )}
        {children}
      </div>
    </div>
  )
}

/**
 * Close button for a dialog header.
 *
 * Exists because the icon-only close in the quiz wizard shipped with no
 * accessible name at all — WAVE's "1 Empty button" error. A shared control
 * makes that impossible to repeat.
 */
export function ModalCloseButton({
  onClose,
  label = 'Close',
  className = '',
}: {
  onClose: () => void
  label?: string
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label={label}
      className={`flex h-9 w-9 items-center justify-center rounded-lg text-ss-slate transition-colors hover:bg-ss-chip hover:text-ss-ink ${className}`}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden focusable="false">
        <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </button>
  )
}
