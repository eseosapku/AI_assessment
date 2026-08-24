'use client'

import { useEffect, useState } from 'react'
import { Lightbulb } from 'lucide-react'

/**
 * Hints stay behind a button. Opening reveals the first; further clicks
 * reveal the next, so a student can take one nudge at a time.
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
          className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3.5 py-2 text-[13px] font-bold text-amber-900 hover:bg-amber-100 dark:border-amber-700/70 dark:bg-amber-900/20 dark:text-amber-100 dark:hover:bg-amber-900/35"
        >
          <Lightbulb className="h-4 w-4" strokeWidth={2} />
          View hint
        </button>
      ) : (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-800/60 dark:bg-amber-950/30">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[12px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-200">
              Hints
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[12px] font-bold text-amber-800 hover:underline dark:text-amber-200"
            >
              Hide
            </button>
          </div>
          <p className="mb-3 text-[12px] font-medium text-amber-900/80 dark:text-amber-100/80">
            These point at the kind of mark a marker wants. They do not give the answer.
          </p>
          <ol className="space-y-2">
            {shown.map((hint, i) => (
              <li
                key={`${questionKey}-hint-${i}`}
                className="rounded-xl bg-white/80 px-3 py-2.5 text-[13.5px] font-medium leading-relaxed text-gray-800 dark:bg-black/20 dark:text-gray-100"
              >
                <span className="mr-2 font-extrabold text-amber-800 dark:text-amber-200">{i + 1}.</span>
                {hint}
              </li>
            ))}
          </ol>
          {remaining > 0 && (
            <button
              type="button"
              onClick={() => setRevealed((n) => Math.min(hints.length, n + 1))}
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-amber-700 px-3.5 py-2 text-[12.5px] font-bold text-white hover:bg-amber-800"
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
