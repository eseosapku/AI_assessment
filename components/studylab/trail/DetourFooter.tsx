'use client'

export interface DetourFooterModel {
  /** The card the learner goes back to, or "my card" if it has gone. */
  backTo: string
  onBack: () => void
  onStillNotSure: () => void
  onAnother: () => void
}

/** How a detour card ends: three answers where the button would be. */
export function DetourFooter({ backTo, onBack, onStillNotSure, onAnother }: DetourFooterModel) {
  return (
    <div className="ss-trail-footer">
      <p>Did that clear it up?</p>
      <button type="button" className="ss-press ss-trail-footer-primary" onClick={onBack}>
        Back to {backTo}
      </button>
      <button type="button" className="ss-press" onClick={onStillNotSure}>
        Still not sure
      </button>
      <button type="button" className="ss-press" onClick={onAnother}>
        I have another question
      </button>
    </div>
  )
}
