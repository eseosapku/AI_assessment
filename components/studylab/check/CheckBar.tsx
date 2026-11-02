'use client'

import { forwardRef, useContext, useEffect, useRef } from 'react'
import { Loader2 } from 'lucide-react'
import type { CheckFlowState } from '@/lib/studylab/checkFlow'
import { barModel, type BarAction, type BarButton, type BarModel, type BarOptions } from '@/lib/studylab/checkBarModel'
import { moodForCheck } from '@/lib/studylab/inkyMood'
import { InkyLine } from './InkyLine'
import { StageContext } from '../stage/StageContext'
import { SafeLatex } from '../canvasShared'

const PRIMARY_FILL: Record<BarModel['tone'], string> = {
  neutral: 'var(--subject)',
  good: 'var(--ss-good)',
  warn: 'var(--ss-warn)',
  // A missed test is not shouted in red on the button; the line says
  // "Incorrect". The button stays a quiet ink.
  bad: 'var(--ss-ink)',
}

/** The card's border for a tone, so the whole card reads the result. */
export function toneBorder(tone: BarModel['tone']): string {
  switch (tone) {
    case 'good':
      return 'var(--ss-good)'
    case 'warn':
      return 'var(--ss-warn)'
    case 'bad':
      return 'var(--ss-bad)'
    default:
      return 'var(--ss-line)'
  }
}

/**
 * One bar for every answerable card: Inky's line, then the buttons. The
 * buttons and their order come from `barModel`, so a quiz question, a practice
 * problem and a material all behave the same way.
 *
 * Inline at the foot of the card in Phase 1; Phase 2 docks it under the item in
 * the spotlight. The primary button takes a ref so a card can put focus back on
 * it after each result.
 */
export const CheckBar = forwardRef<HTMLButtonElement, {
  state: CheckFlowState
  options: BarOptions
  onAction: (action: BarAction) => void
  /** Overrides the model's line, e.g. feedback written for the option chosen. */
  line?: string
}>(function CheckBar({ state, options, onAction, line }, primaryRef) {
  const model = barModel(state, options)
  const text = line ?? model.line
  // On the Trail the feedback is Kana's to say, and the primary is the one button.
  const stage = useContext(StageContext)
  const trail = stage?.look === 'trail'
  const sayLine = stage?.sayLine
  const tone = model.tone
  // Only what changes while the bar is up is news: a bar coming back with its old
  // result must not talk over whatever the tutor has said since.
  const said = useRef(text)
  useEffect(() => {
    if (text === said.current) return
    said.current = text
    if (trail && text) sayLine?.(text, tone)
  }, [trail, text, tone, sayLine])
  return (
    <div className="nodrag flex flex-col gap-2.5">
      {/* The result, for screen readers, in a region mounted with the bar:
          a region inserted already holding its words is often skipped, and a
          multiple-choice answer is marked in the same click that shows it. */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {text ? <SafeLatex>{text}</SafeLatex> : null}
      </div>
      {/* Inky speaks when there is something to say, or while marking --
          not beside a Check waiting to be pressed. */}
      {/* On the Trail Kana says it; on a reopened card she has stepped back, so it stays here. */}
      {trail && !sayLine && text && (
        <p className="ss-trail-own-line">
          <SafeLatex>{text}</SafeLatex>
        </p>
      )}
      {!trail && (text || state.phase === 'checking') && (
        <InkyLine mood={moodForCheck(state.phase)} text={text} tone={model.tone} />
      )}
      <div className="flex items-center gap-2">
        {model.secondary && (
          <BarButtonView button={model.secondary} onAction={onAction} variant="secondary" />
        )}
        {model.primary && (
          <BarButtonView
            ref={primaryRef}
            button={model.primary}
            onAction={onAction}
            variant="primary"
            fill={PRIMARY_FILL[model.tone]}
            trailClass={trail ? `ss-trail-go${model.tone === 'good' ? ' ss-trail-go-good' : ''}` : undefined}
          />
        )}
      </div>
      {model.tertiary && (
        <button
          type="button"
          onClick={() => onAction(model.tertiary!.action)}
          className="ss-press min-h-[32px] self-center rounded-lg px-3 text-[12.5px] font-bold text-ss-subject-ink underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-[color:var(--subject)]"
        >
          {model.tertiary.label}
        </button>
      )}
    </div>
  )
})

const BarButtonView = forwardRef<HTMLButtonElement, {
  button: BarButton
  onAction: (action: BarAction) => void
  variant: 'primary' | 'secondary'
  fill?: string
  /** On the Trail the primary wears the one button's look instead of a fill. */
  trailClass?: string
}>(function BarButtonView({ button, onAction, variant, fill, trailClass }, ref) {
  const primary = variant === 'primary'
  return (
    <button
      ref={ref}
      type="button"
      disabled={button.disabled}
      aria-busy={button.busy || undefined}
      onClick={() => onAction(button.action)}
      className={
        trailClass
          ? trailClass
          : primary
          ? `ss-press inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl px-4 text-[13.5px] font-bold ${
              button.disabled && !button.busy ? 'cursor-not-allowed bg-ss-chip text-ss-slate shadow-none' : ''
            }`
          : 'ss-press inline-flex min-h-[44px] items-center justify-center rounded-xl bg-ss-chip px-4 text-[13.5px] font-bold text-ss-ink disabled:opacity-45'
      }
      // Waiting for an answer: a quiet grey, not a faded version of the colour.
      // Text takes the panel colour, which flips with the theme: white on the
      // darker light-mode fills, near-black on the brighter dark-mode ones.
      style={!trailClass && primary && !(button.disabled && !button.busy) ? { backgroundColor: fill, color: 'var(--ss-panel)' } : undefined}
    >
      {button.busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {button.label}
    </button>
  )
})
