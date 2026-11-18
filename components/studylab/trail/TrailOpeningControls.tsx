'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { SendHorizontal } from 'lucide-react'
import { usePopoverBehavior } from '@/components/ui/Modal'
import { ADJUSTMENTS } from '../stage/PlanOpening'

/** "Change the plan", beside Start: the three things people want to change, or their own words. */
export function TrailOpeningControls({ onAnswer }: { onAnswer: (answer: string) => void }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const root = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  usePopoverBehavior({ open, onClose: close })
  useEffect(() => {
    if (!open) return
    const outside = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) close()
    }
    window.addEventListener('pointerdown', outside)
    return () => window.removeEventListener('pointerdown', outside)
  }, [open, close])

  const send = (answer: string) => {
    const said = answer.trim()
    if (!said) return
    onAnswer(said)
    setText('')
    setOpen(false)
  }

  return (
    <div ref={root} data-tour="lesson-plan" className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="ss-press inline-flex min-h-[64px] items-center rounded-2xl border border-ss-line bg-ss-panel px-5 text-[16px] font-bold text-ss-ink shadow-ss-panel"
      >
        Change the plan
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-[340px] max-w-[85vw] rounded-2xl border border-ss-line bg-ss-panel p-3 shadow-xl">
          <div className="flex flex-wrap gap-2">
            {ADJUSTMENTS.map(({ label, instruction }) => (
              <button key={label} type="button" onClick={() => send(instruction)} className="ss-press min-h-[44px] rounded-full border border-ss-line px-4 text-[16px] font-bold text-ss-ink hover:border-[color:var(--subject)]">
                {label}
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-ss-line py-1 pl-3 pr-1 focus-within:border-[color:var(--subject)]">
            <input
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  send(text)
                }
              }}
              placeholder="Or say what to change…"
              aria-label="What to change"
              className="min-w-0 flex-1 bg-transparent py-2 text-[16px] text-ss-ink outline-none placeholder:text-ss-slate"
            />
            <button
              type="button"
              onClick={() => send(text)}
              disabled={!text.trim()}
              aria-label="Send"
              className="ss-press grid h-10 w-10 shrink-0 place-items-center rounded-lg disabled:opacity-40"
              style={{ backgroundColor: 'var(--subject)', color: 'var(--ss-panel)' }}
            >
              <SendHorizontal className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
