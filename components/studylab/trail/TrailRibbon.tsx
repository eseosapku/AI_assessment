'use client'

/**
 * Hangs from the top while the learner is away from their card: blue looking
 * back, orange on a detour. Back is always in it, and it is announced. While the
 * reply to a detour's question is on its way Back waits, or the reply would land
 * with the detour closed and take the learner off their card.
 */
import { SafeLatex } from '../canvasShared'
export function TrailRibbon({ kind, text, onBack, waiting = false }: { kind: 'lookBack' | 'detour'; text: string; onBack: () => void; waiting?: boolean }) {
  return (
    <div role="status" aria-live="polite" className={`ss-trail-ribbon ss-trail-ribbon-${kind}`}>
      <span className="min-w-0 truncate"><SafeLatex>{text}</SafeLatex></span>
      <span aria-hidden>·</span>
      <button type="button" onClick={onBack} disabled={waiting} style={waiting ? { opacity: 0.5 } : undefined}>
        Back
      </button>
    </div>
  )
}
