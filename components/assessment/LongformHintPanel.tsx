'use client'

import { useEffect, useState } from 'react'
import { Lightbulb } from 'lucide-react'

/**
 * One comprehensive hint behind a button.
 *
 * Colours come from --ss-warn rather than Tailwind's amber scale. The token is
 * already dark-aware. Use `bg-[color:var(--ss-warn)]` wherever alpha is applied:
 * Tailwind's `/40` shorthand emits nothing for these CSS variables.
 */
export default function LongformHintPanel({
  hints,
  questionKey,
}: {
  hints: string[]
  questionKey: string | number
}) {
  const [open, setOpen] = useState(false)
  const hint = hints.map((h) => String(h ?? '').trim()).find(Boolean) ?? ''

  useEffect(() => {
    setOpen(false)
  }, [questionKey])

  if (!hint) return null

  return (
    <div className="mt-3">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-full border border-[color:var(--ss-warn)]/40 bg-[color:var(--ss-warn)]/10 px-3.5 py-2 text-[13px] font-bold text-ss-warn hover:bg-[color:var(--ss-warn)]/20"
        >
          <Lightbulb className="h-4 w-4" strokeWidth={2} />
          View hint
        </button>
      ) : (
        <div className="rounded-2xl border border-[color:var(--ss-warn)]/35 bg-[color:var(--ss-warn)]/10 p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[12px] font-bold uppercase tracking-wider text-ss-warn">Hint</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[12px] font-bold text-ss-warn hover:underline"
            >
              Hide
            </button>
          </div>
          <p className="rounded-xl bg-ss-panel px-3 py-2.5 text-[13.5px] font-medium leading-relaxed text-ss-ink">
            {hint}
          </p>
        </div>
      )}
    </div>
  )
}
