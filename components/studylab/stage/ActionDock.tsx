'use client'

import { forwardRef } from 'react'
import { ArrowRight, Loader2 } from 'lucide-react'
import type { ContinueTarget, DockView } from '@/lib/studylab/spotlight'

/**
 * The bar under the work: the one control that moves the lesson on.
 *
 * Screen space, docked to the foot of the board, so it never scrolls away with
 * the canvas. While a card is in the spotlight its own check bar is drawn into
 * the slot here (Check, then Why? and Continue). Otherwise the dock speaks for
 * the lesson: what the tutor is doing, or Continue.
 */
export const ActionDock = forwardRef<HTMLDivElement, {
  view: DockView
  /** A card's bar is in the slot; the lesson's own controls stand aside. */
  claimed: boolean
  onContinue: (target: ContinueTarget) => void
}>(function ActionDock({ view, claimed, onContinue }, slotRef) {
  return (
    <div
      data-tour="lesson-continue"
      className="pointer-events-none absolute inset-x-0 bottom-5 z-30 flex justify-center px-4"
    >
      <div className="pointer-events-auto flex w-full max-w-[560px] flex-col items-stretch gap-2">
        {/* Cards draw their bar in here. React never renders into it. */}
        <div
          ref={slotRef}
          className="rounded-2xl border border-ss-line bg-ss-panel p-3 shadow-[0_18px_44px_-18px_rgba(20,60,90,0.45)] empty:hidden"
        />
        {!claimed && <LessonBar view={view} onContinue={onContinue} />}
      </div>
    </div>
  )
})

function LessonBar({ view, onContinue }: { view: DockView; onContinue: (target: ContinueTarget) => void }) {
  if (view.kind === 'working') {
    return (
      <div role="status" aria-live="polite" className="flex justify-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-ss-line bg-ss-panel px-4 py-2 text-[13px] font-semibold text-ss-slate shadow-ss-panel">
          <Loader2 className="h-4 w-4 animate-spin text-ss-subject motion-reduce:animate-none" aria-hidden />
          {view.label}
        </span>
      </div>
    )
  }
  if (view.kind !== 'continue') return null
  const { target } = view
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-ss-line bg-ss-panel p-3 shadow-[0_18px_44px_-18px_rgba(20,60,90,0.45)]">
      {target.kind === 'focus' && (
        <p className="min-w-0 flex-1 text-[13px] font-semibold leading-snug text-ss-slate">{target.hint}</p>
      )}
      <button
        type="button"
        onClick={() => onContinue(target)}
        className={`ss-press inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl px-5 text-[14px] font-bold ${
          target.kind === 'focus' ? 'shrink-0' : 'flex-1'
        }`}
        style={{ backgroundColor: 'var(--subject)', color: 'var(--ss-panel)' }}
      >
        {target.label}
        <ArrowRight className="h-4 w-4" aria-hidden />
      </button>
    </div>
  )
}
