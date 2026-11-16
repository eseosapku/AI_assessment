'use client'
import { useRef, type KeyboardEvent } from 'react'
import type { CheckpointQuestion } from '@/lib/studylab/types'
import type { CheckFlowState } from '@/lib/studylab/checkFlow'
import { SafeLatex } from '../canvasShared'
import { ResultBadge } from './ResultBadge'

export function McqOptions({
  q, chosen, phase, mode, showAnswer, locked, onChoose, onSubmit,
}: {
  q: Extract<CheckpointQuestion, { format: 'mcq' }>
  chosen: number | undefined
  phase: CheckFlowState['phase']
  mode: 'learn' | 'test'
  showAnswer: boolean
  locked: boolean
  onChoose: (i: number) => void
  /** Enter on the chosen option checks it, as the Check button would. */
  onSubmit: () => void
}) {
  const marked = phase === 'correct' || phase === 'retry' || phase === 'wrong' || phase === 'revealed'
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  // Arrow keys move through the options and choose as they go, the way a
  // radio group does.
  const onKey = (e: KeyboardEvent) => {
    if (locked) return
    if (e.key === 'Enter' && chosen !== undefined && document.activeElement === buttons.current[chosen] && phase === 'ready') {
      e.preventDefault()
      e.stopPropagation()
      onSubmit()
      return
    }
    const step = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0
    if (!step) return
    e.preventDefault()
    // The board moves a selected card with the arrow keys; here they choose.
    e.stopPropagation()
    // From the chosen option, or -- before any is chosen -- the one with focus.
    const from = chosen ?? buttons.current.findIndex((b) => b === document.activeElement)
    const next = (from + step + q.options.length) % q.options.length
    onChoose(next)
    buttons.current[next]?.focus()
  }
  return (
    <div role="radiogroup" aria-label="Options" className="flex flex-col gap-2" onKeyDown={onKey}>
      {q.options.map((opt, i) => {
        const isChosen = chosen === i
        const isAnswer = i === q.answer
        const faded = marked && !isChosen && !(showAnswer && isAnswer)
        // Inline, not Tailwind's /10: opacity modifiers render nothing on
        // these CSS-variable colours.
        const toneVar =
          !marked ? null
          : phase === 'correct' ? 'var(--ss-good)'
          : mode === 'learn' ? 'var(--ss-warn)'
          : 'var(--ss-bad)'
        const chosenStyle = !isChosen
          ? undefined
          : toneVar
            ? { borderColor: toneVar, backgroundColor: `color-mix(in srgb, ${toneVar} 10%, transparent)` }
            : { borderColor: 'var(--subject)', backgroundColor: 'var(--subject-soft)' }
        return (
          <button
            key={i}
            ref={(el) => { buttons.current[i] = el }}
            type="button"
            role="radio"
            data-part={`option-${i + 1}`}
            aria-checked={isChosen}
            tabIndex={isChosen || (chosen === undefined && i === 0) ? 0 : -1}
            disabled={locked}
            onClick={() => onChoose(i)}
            className={`nodrag relative w-full rounded-xl border-2 px-3 py-2.5 text-left text-[13.5px] transition-[opacity,border-color,background-color] duration-200 motion-reduce:transition-none ${
              isChosen ? '' : 'border-ss-line hover:border-[color:var(--subject)]'
            } ${faded ? 'opacity-45' : ''} disabled:cursor-default`}
            style={chosenStyle}
          >
            <SafeLatex>{opt}</SafeLatex>
            {marked && isChosen && <ResultBadge kind={phase === 'correct' ? 'correct' : 'wrong'} tone={mode === 'learn' ? 'warn' : 'bad'} />}
            {showAnswer && isAnswer && !isChosen && <ResultBadge kind="answer" />}
          </button>
        )
      })}
    </div>
  )
}
