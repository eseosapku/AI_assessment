'use client'

import { Lightbulb } from 'lucide-react'

interface LongformHintPanelProps {
  hints: string[]
  revealedCount: number
  onRevealNext: () => void
}

/**
 * Collapsed by default. Student taps View hint / Show next hint to reveal
 * progressive scaffolding tips — never auto-shown.
 */
export default function LongformHintPanel({
  hints,
  revealedCount,
  onRevealNext,
}: LongformHintPanelProps) {
  if (!hints.length) return null

  const revealed = hints.slice(0, revealedCount)
  const hasMore = revealedCount < hints.length
  const allRevealed = revealedCount >= hints.length && revealedCount > 0

  return (
    <div className="mt-3 space-y-2">
      {revealed.length > 0 && (
        <ul className="space-y-2">
          {revealed.map((hint, i) => (
            <li
              key={i}
              className="flex gap-2 text-sm text-ss-ink bg-ss-panel border border-ss-line rounded-xl px-3 py-2.5"
            >
              <Lightbulb className="w-4 h-4 mt-0.5 flex-shrink-0 text-ss-accent" aria-hidden />
              <span>
                <span className="text-xs uppercase tracking-wider text-ss-accent font-semibold mr-1.5">
                  Hint {i + 1}
                </span>
                {hint}
              </span>
            </li>
          ))}
        </ul>
      )}

      {hasMore && (
        <button
          type="button"
          onClick={onRevealNext}
          className="inline-flex items-center gap-2 text-sm font-semibold text-ss-accent hover:text-ss-ink transition-colors"
        >
          <Lightbulb className="w-4 h-4" />
          {revealedCount === 0 ? 'View hint' : 'Show next hint'}
          <span className="text-xs font-normal text-ss-slate">
            ({Math.min(revealedCount + 1, hints.length)} of {hints.length})
          </span>
        </button>
      )}

      {allRevealed && (
        <p className="text-xs text-ss-slate">All hints revealed ({hints.length})</p>
      )}
    </div>
  )
}
