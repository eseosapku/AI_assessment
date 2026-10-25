'use client'

import { forwardRef } from 'react'
import { Loader2 } from 'lucide-react'
import type { CheckFlowState } from '@/lib/studylab/checkFlow'
import { barModel, type BarAction, type BarButton, type BarModel, type BarOptions } from '@/lib/studylab/checkBarModel'
import { moodForCheck } from '@/lib/studylab/inkyMood'
import { InkyLine } from './InkyLine'

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
  return (
    <div className="nodrag flex flex-col gap-2.5">
      {(text || state.phase !== 'idle') && (
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
          />
        )}
      </div>
    </div>
  )
})

const BarButtonView = forwardRef<HTMLButtonElement, {
  button: BarButton
  onAction: (action: BarAction) => void
  variant: 'primary' | 'secondary'
  fill?: string
}>(function BarButtonView({ button, onAction, variant, fill }, ref) {
  const primary = variant === 'primary'
  return (
    <button
      ref={ref}
      type="button"
      disabled={button.disabled}
      aria-busy={button.busy || undefined}
      onClick={() => onAction(button.action)}
      className={
        primary
          ? `ss-press inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl px-4 text-[13.5px] font-bold ${
              button.disabled && !button.busy ? 'cursor-not-allowed bg-ss-chip text-ss-slate shadow-none' : ''
            }`
          : 'ss-press inline-flex min-h-[44px] items-center justify-center rounded-xl bg-ss-chip px-4 text-[13.5px] font-bold text-ss-ink disabled:opacity-45'
      }
      // Waiting for an answer: a quiet grey, not a faded version of the colour.
      // Text takes the panel colour, which flips with the theme: white on the
      // darker light-mode fills, near-black on the brighter dark-mode ones.
      style={primary && !(button.disabled && !button.busy) ? { backgroundColor: fill, color: 'var(--ss-panel)' } : undefined}
    >
      {button.busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {button.label}
    </button>
  )
})
