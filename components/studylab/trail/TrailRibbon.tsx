'use client'

/**
 * Hangs from the top while the learner is away from their card: blue looking
 * back, orange on a detour. Back is always in it, and it is announced.
 */
export function TrailRibbon({ kind, text, onBack }: { kind: 'lookBack' | 'detour'; text: string; onBack: () => void }) {
  return (
    <div role="status" aria-live="polite" className={`ss-trail-ribbon ss-trail-ribbon-${kind}`}>
      <span className="min-w-0 truncate">{text}</span>
      <span aria-hidden>·</span>
      <button type="button" onClick={onBack}>
        Back
      </button>
    </div>
  )
}
