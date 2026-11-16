'use client'

import type { ReactNode } from 'react'

/**
 * The conversation with Kana, out of the way until it is wanted. On a desktop it
 * is a column on the left, so the board narrows beside it and the camera
 * re-frames; on a phone it is a full-screen sheet. Closed, it is inert.
 */
export function TrailChatPanel({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  // Next vendors React 19, which takes `inert` as a boolean; the installed
  // @types/react is 18's and does not list it, hence the spread.
  const inert = open ? {} : ({ inert: true } as Record<string, boolean>)
  return (
    <aside
      aria-label="Chat with Kana"
      {...inert}
      className={`fixed inset-0 z-50 overflow-hidden ss-trail-chat-panel transition-transform duration-[250ms] ease-out motion-reduce:transition-none md:relative md:z-auto md:h-full md:shrink-0 md:transition-[width] ${
        open ? 'translate-y-0 md:w-[min(540px,48vw)]' : 'invisible translate-y-full md:w-0'
      } md:translate-y-0`}
    >
      <div className="h-full md:w-[min(540px,48vw)]">{children}</div>
      <button type="button" onClick={onClose} aria-label="Close the chat" title="Close the chat" className="ss-trail-drawer-handle" />
    </aside>
  )
}
