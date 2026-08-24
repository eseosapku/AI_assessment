'use client'

import { useEffect, useState } from 'react'
import { Lightbulb } from 'lucide-react'

/**
 * Hints stay behind a button. Opening reveals the first; further clicks
 * reveal the next, so a student can take one nudge at a time.
 *
 * Colours come from --ss-warn rather than Tailwind's amber scale. The token is
 * already dark-aware, so every `dark:` pair here collapsed into a single class
 * — and a future palette retune reaches this panel instead of skipping it,
 * which is the failure that kept the report card under contrast long after the
 * palette was fixed.
 *
 * Note the tokens are named in the `bg-[color:var(--ss-warn)]` form wherever an
 * alpha is applied: Tailwind's `/40` shorthand emits nothing for these CSS
 * variables and fails silently, rendering the element fully transparent.
 */
export default function LongformHintPanel({
  hints,
  questionKey,
}: {
  hints: string[]
  questionKey: string | number
}) {
  const [open, setOpen] = useState(false)
  const [revealed, setRevealed] = useState(0)

  useEffect(() => {
    setOpen(false)
    setRevealed(0)
  }, [questionKey])

  if (!hints.length) return null

  const shown = hints.slice(0, revealed)
  const remaining = hints.length - revealed

  return (
    <div className="mt-3">
      {!open ? (
        <button
          type="button"
          onClick={() => {
            setOpen(true)
            setRevealed((n) => (n > 0 ? n : 1))
          }}
          className="inline-flex items-center gap-2 rounded-full border border-[color:var(--ss-warn)]/40 bg-[color:var(--ss-warn)]/10 px-3.5 py-2 text-[13px] font-bold text-ss-warn hover:bg-[color:var(--ss-warn)]/20"
        >
          <Lightbulb className="h-4 w-4" strokeWidth={2} />
          View hint
        </button>
      ) : (
        <div className="rounded-2xl border border-[color:var(--ss-warn)]/35 bg-[color:var(--ss-warn)]/10 p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[12px] font-bold uppercase tracking-wider text-ss-warn">Hints</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[12px] font-bold text-ss-warn hover:underline"
            >
              Hide
            </button>
          </div>
          <p className="mb-3 text-[12px] font-medium text-ss-slate">
            These point at the kind of mark a marker wants. They do not give the answer.
          </p>
          <ol className="space-y-2">
            {shown.map((hint, i) => (
              <li
                key={`${questionKey}-hint-${i}`}
                className="rounded-xl bg-ss-panel px-3 py-2.5 text-[13.5px] font-medium leading-relaxed text-ss-ink"
              >
                <span className="mr-2 font-extrabold text-ss-warn">{i + 1}.</span>
                {hint}
              </li>
            ))}
          </ol>
          {remaining > 0 && (
            <button
              type="button"
              onClick={() => setRevealed((n) => Math.min(hints.length, n + 1))}
              className="mt-3 inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[12.5px] font-bold text-white hover:opacity-90"
              style={{ backgroundColor: 'var(--ss-warn)' }}
            >
              <Lightbulb className="h-3.5 w-3.5" />
              {revealed === 0 ? 'View hint' : `Show another hint (${remaining} left)`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
