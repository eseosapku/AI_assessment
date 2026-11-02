'use client'

import type { ReactNode } from 'react'

/**
 * The conversation with Kana, out of the way until it is wanted. On a desktop it
 * is a column on the left, so the board narrows beside it and the camera
 * re-frames; on a phone it is a full-screen sheet. Closed, it is inert.
 */
export function TrailChatPanel({ open, children }: { open: boolean; children: ReactNode }) {
  // Next vendors React 19, which takes `inert` as a boolean; the installed
  // @types/react is 18's and does not list it, hence the spread.
  const inert = open ? {} : ({ inert: true } as Record<string, boolean>)
  return (
    <aside
      aria-label="Chat with Kana"
      {...inert}
      className={`fixed inset-0 z-50 overflow-hidden bg-ss-panel transition-transform duration-[250ms] ease-out motion-reduce:transition-none md:static md:z-auto md:h-full md:shrink-0 md:transition-[width] ${
        open ? 'translate-y-0 md:w-[460px] md:border-r md:border-ss-line' : 'translate-y-full md:w-0'
      } md:translate-y-0`}
    >
      <div className="h-full md:w-[460px]">{children}</div>
    </aside>
  )
}
