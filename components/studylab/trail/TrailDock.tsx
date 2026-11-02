'use client'

import { forwardRef } from 'react'
import { ArrowRight, RotateCcw, Trophy } from 'lucide-react'
import type { ContinueTarget } from '@/lib/studylab/spotlight'
import type { TrailAction } from '@/lib/studylab/trail/action'

/**
 * The one thing to press, bottom centre. A card with a check draws its bar into
 * the slot here and its primary button is this button; otherwise the dock speaks
 * for the lesson. What the tutor is doing is said by Kana's bubble, not here.
 */
export const TrailDock = forwardRef<HTMLDivElement, {
  action: TrailAction
  onContinue: (target: ContinueTarget) => void
  onGoToStation: (station: number) => void
  onStart?: () => void
  onTryAgain?: () => void
  onSummary?: () => void
  onProveIt?: () => void
  provingIt?: boolean
  /** Sends the failed turn again. */
  onRetry?: () => void
}>(function TrailDock({ action, onContinue, onGoToStation, onStart, onTryAgain, onSummary, onProveIt, provingIt, onRetry }, slotRef) {
  return (
    <div className="ss-trail-dock pointer-events-none absolute inset-x-0 bottom-5 z-30 flex justify-center px-4">
      <div className="pointer-events-auto flex w-full max-w-[560px] flex-col items-stretch gap-2">
        {/* Cards draw their bar in here, and it stays mounted while something
            else has the button. React never renders into it. */}
        <div ref={slotRef} className={`ss-trail-slot empty:hidden${action.kind === 'bar' ? '' : ' hidden'}`} />
        {action.kind === 'summary' ? (
          <div className="flex items-center gap-2">
            {onSummary && (
              <button type="button" onClick={onSummary} className="ss-press inline-flex min-h-[64px] items-center gap-2 rounded-2xl bg-ss-chip px-5 text-[16px] font-bold text-ss-ink">
                <Trophy className="h-5 w-5" aria-hidden />
                Lesson summary
              </button>
            )}
            {onProveIt && (
              <button type="button" onClick={onProveIt} disabled={provingIt} className="ss-trail-go flex-1">
                {provingIt ? 'Building your quiz…' : 'Prove it — take the quiz'}
              </button>
            )}
          </div>
        ) : (
          <MainButton action={action} onContinue={onContinue} onGoToStation={onGoToStation} onStart={onStart} onTryAgain={onTryAgain} onRetry={onRetry} />
        )}
      </div>
    </div>
  )
})

function MainButton({ action, onContinue, onGoToStation, onStart, onTryAgain, onRetry }: {
  action: TrailAction
  onContinue: (target: ContinueTarget) => void
  onGoToStation: (station: number) => void
  onStart?: () => void
  onTryAgain?: () => void
  onRetry?: () => void
}) {
  const press = (): void => {
    if (action.kind === 'continue') onContinue(action.target)
    else if (action.kind === 'goToStation') onGoToStation(action.station)
    else if (action.kind === 'start') onStart?.()
    else if (action.kind === 'tryAgain') onTryAgain?.()
    else if (action.kind === 'retry') onRetry?.()
  }
  if (action.kind === 'none' || action.kind === 'bar' || action.kind === 'summary') return null
  const working = action.kind === 'working'
  const label = action.kind === 'start' ? 'Start' : working ? '' : action.label
  // One button for all of these: pressing it turns it into the working state in
  // place, because swapping it for another element would drop the keyboard focus.
  return (
    <button type="button" aria-disabled={working || undefined} aria-label={working ? 'Working' : undefined} onClick={press} className={`ss-trail-go${working ? ' ss-trail-go-working' : ''}`}>
      {working ? (
        <span className="ss-trail-dots" aria-hidden>
          <i />
          <i />
          <i />
        </span>
      ) : (
        <>
          {action.kind === 'retry' && label === 'Try again' && <RotateCcw className="h-5 w-5" aria-hidden />}
          {label}
          {action.kind !== 'retry' && <ArrowRight className="h-5 w-5" aria-hidden />}
        </>
      )}
    </button>
  )
}
