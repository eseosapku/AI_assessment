'use client'

import { forwardRef } from 'react'
import { ArrowRight, Loader2, RotateCcw, Trophy } from 'lucide-react'
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
  /** The lesson is over: reopen its summary, and take the quiz. */
  onSummary?: () => void
  onProveIt?: () => void
  provingIt?: boolean
  /** Sends the failed turn again. */
  onRetry?: () => void
}>(function ActionDock({ view, claimed, onContinue, onSummary, onProveIt, provingIt, onRetry }, slotRef) {
  return (
    <div
      // Inky and its buttons own the bottom-left corner; the bar centres in
      // the width that is left. A phone has no width to spare, so there the
      // bar stands on top of them instead (DOCK_LIFT_PHONE in spotlight.ts).
      className="pointer-events-none absolute inset-x-0 bottom-[126px] z-30 flex justify-center pl-4 pr-4 sm:bottom-5 sm:pl-[140px]"
    >
      <div data-tour="lesson-continue" className="pointer-events-auto flex w-full max-w-[560px] flex-col items-stretch gap-2">
        {/* Cards draw their bar in here. React never renders into it. */}
        <div
          ref={slotRef}
          className="rounded-2xl border border-ss-line bg-ss-panel p-3 shadow-[0_18px_44px_-18px_rgba(20,60,90,0.45)] empty:hidden"
        />
        {view.kind === 'retry' && onRetry ? (
          // Shown even beside a card's bar: the turn that failed is what the
          // lesson is waiting on.
          <button
            type="button"
            onClick={onRetry}
            className="ss-press inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl px-5 text-[14px] font-bold shadow-[0_18px_44px_-18px_rgba(20,60,90,0.45)]"
            style={{ backgroundColor: 'var(--subject)', color: 'var(--ss-panel)' }}
          >
            {view.label === 'Try again' ? <RotateCcw className="h-4 w-4" aria-hidden /> : null}
            {view.label}
            {view.label === 'Try again' ? null : <ArrowRight className="h-4 w-4" aria-hidden />}
          </button>
        ) : !claimed && view.kind === 'done' ? (
          <div className="flex items-center gap-2 rounded-2xl border border-ss-line bg-ss-panel p-3 shadow-[0_18px_44px_-18px_rgba(20,60,90,0.45)]">
            {onSummary && (
              <button
                type="button"
                onClick={onSummary}
                className="ss-press inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-ss-chip px-4 text-[13.5px] font-bold text-ss-ink"
              >
                <Trophy className="h-4 w-4" aria-hidden />
                Lesson summary
              </button>
            )}
            {onProveIt && (
              <button
                type="button"
                onClick={onProveIt}
                disabled={provingIt}
                className="ss-press inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl px-5 text-[14px] font-bold disabled:opacity-60"
                style={{ backgroundColor: 'var(--subject)', color: 'var(--ss-panel)' }}
              >
                {provingIt ? 'Building your quiz…' : 'Prove it — take the quiz'}
                {!provingIt && <ArrowRight className="h-4 w-4" aria-hidden />}
              </button>
            )}
          </div>
        ) : (
          // What the tutor is doing shows even beside a card's bar: an answer
          // was just handed in, and the next thing is on its way.
          (!claimed || view.kind === 'working') && <LessonBar view={view} onContinue={onContinue} />
        )}
      </div>
    </div>
  )
})

function LessonBar({ view, onContinue }: { view: DockView; onContinue: (target: ContinueTarget) => void }) {
  if (view.kind !== 'working' && view.kind !== 'continue') return null
  // One button for both: pressing Continue turns it into the working state in
  // place. Swapping it for a pill took the keyboard focus with it, to the top
  // of the page. What the tutor is doing is said by Inky's bubble, so this is
  // not a second live region.
  const working = view.kind === 'working'
  const target = view.kind === 'continue' ? view.target : null
  const hint = target && 'hint' in target ? target.hint : null
  return (
    <div
      className={
        working
          ? 'flex justify-center'
          : 'flex items-center gap-3 rounded-2xl border border-ss-line bg-ss-panel p-3 shadow-[0_18px_44px_-18px_rgba(20,60,90,0.45)]'
      }
    >
      {hint && <p className="min-w-0 flex-1 text-[13px] font-semibold leading-snug text-ss-slate">{hint}</p>}
      <button
        type="button"
        aria-disabled={working || undefined}
        onClick={() => target && onContinue(target)}
        className={
          working
            ? 'inline-flex cursor-default items-center gap-2 rounded-full border border-ss-line bg-ss-panel px-4 py-2 text-[13px] font-semibold text-ss-slate shadow-ss-panel'
            : `ss-press inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl px-5 text-[14px] font-bold ${hint ? 'shrink-0' : 'flex-1'}`
        }
        style={working ? undefined : { backgroundColor: 'var(--subject)', color: 'var(--ss-panel)' }}
      >
        {working && <Loader2 className="h-4 w-4 animate-spin text-ss-subject motion-reduce:animate-none" aria-hidden />}
        {view.kind === 'working' ? view.label : view.target.label}
        {!working && <ArrowRight className="h-4 w-4" aria-hidden />}
      </button>
    </div>
  )
}
