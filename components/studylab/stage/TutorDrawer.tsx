'use client'

import type { ReactNode } from 'react'

/**
 * The conversation with Inky, out of the way until it is wanted.
 *
 * On a desktop it is a column that grows in from the right, so the board
 * narrows beside it rather than being covered (the way Brilliant's help pane
 * does it). On a phone it is a sheet over the lower part of the screen. Closed,
 * it is inert: nothing in it can be tabbed to or read out.
 */
export function TutorDrawer({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  // Next vendors React 19, which takes `inert` as a boolean; the installed
  // @types/react is 18's and does not list it, hence the spread. React 18
  // would have needed '' -- and dropped `false` -- so this must stay `true`.
  const inert = open ? {} : ({ inert: true } as Record<string, boolean>)
  return (
    <>
      {open && (
        <div aria-hidden className="fixed inset-0 z-40 bg-black/30 md:hidden" onClick={onClose} />
      )}
      <aside
        aria-label="Chat with Inky"
        {...inert}
        className={`fixed inset-x-0 bottom-0 z-50 h-[72vh] overflow-hidden rounded-t-2xl border-t border-ss-line bg-ss-panel shadow-2xl transition-transform duration-[250ms] ease-out motion-reduce:transition-none md:static md:z-auto md:h-full md:shrink-0 md:rounded-none md:border-t-0 md:shadow-none md:transition-[width] ${
          open ? 'translate-y-0 md:w-[380px] md:border-l' : 'translate-y-full md:w-0 md:border-l-0'
        } md:translate-y-0`}
      >
        <div className="h-full md:w-[380px]">{children}</div>
      </aside>
    </>
  )
}
