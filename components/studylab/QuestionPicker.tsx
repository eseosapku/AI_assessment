'use client'

import { useState } from 'react'
import { Check, ArrowRight } from 'lucide-react'
import { SafeLatex } from './canvasShared'

/**
 * The questions read off a homework sheet, for the learner to pick from.
 *
 * This is what a homework space has instead of a proposed syllabus. The sheet
 * is already a plan somebody set them, so the only decision left is which of it
 * they want help with — and that decision is worth asking for. Taking all eight
 * questions on a page without asking commits someone to an hour of work they
 * came for one question's worth of, and carries eight questions into every turn
 * afterwards.
 */
export function QuestionPicker({
  questions,
  live,
  busy,
  onStart,
}: {
  questions: { id: string; label: string; text: string }[]
  live: boolean
  busy: boolean
  onStart: (ids: string[]) => void
}) {
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const chosen = questions.filter((q) => picked.has(q.id))

  return (
    <div className="w-full rounded-2xl border border-ss-line bg-ss-panel p-3.5">
      <p className="text-[12px] font-extrabold uppercase tracking-wide text-ss-slate">
        On your sheet
      </p>

      <ul className="mt-2 space-y-1.5">
        {questions.map((q) => {
          const on = picked.has(q.id)
          return (
            <li key={q.id}>
              <button
                type="button"
                disabled={!live || busy}
                onClick={() => toggle(q.id)}
                aria-pressed={on}
                className={`flex w-full items-start gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors disabled:cursor-default ${
                  on ? 'border-ss-accent bg-[color:var(--ss-accent)]/[0.07]' : 'border-ss-line hover:border-ss-accent'
                }`}
              >
                <span
                  aria-hidden
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                    on ? 'border-transparent bg-ss-accent text-white' : 'border-ss-line'
                  }`}
                >
                  {on && <Check className="h-3 w-3" strokeWidth={3} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12px] font-bold text-ss-accent">{q.label}</span>
                  {/* Two lines of it. The whole question goes on the board as a
                      card the moment they start; this is only enough to tell
                      one from another. */}
                  <span className="mt-0.5 block text-[13px] font-medium leading-snug text-ss-ink line-clamp-2">
                    <SafeLatex>{q.text}</SafeLatex>
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      {live && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || chosen.length === 0}
            onClick={() => onStart(chosen.map((q) => q.id))}
            className="inline-flex items-center gap-1.5 rounded-xl bg-ss-accent px-3.5 py-2 text-[13px] font-bold text-white transition-[filter] hover:brightness-95 disabled:opacity-40"
          >
            {chosen.length <= 1 ? 'Start on this one' : `Work through these ${chosen.length}`}
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onStart(questions.map((q) => q.id))}
            className="rounded-xl border border-ss-line px-3.5 py-2 text-[13px] font-semibold text-ss-ink transition-colors hover:border-ss-accent disabled:opacity-40"
          >
            All of them
          </button>
        </div>
      )}
    </div>
  )
}
