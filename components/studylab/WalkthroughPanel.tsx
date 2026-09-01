'use client'

import { useEffect, useState } from 'react'
import { Check, ChevronLeft, GraduationCap, X } from 'lucide-react'
import {
  WALKTHROUGHS,
  walkthroughById,
  progressFor,
  loadWalkthrough,
  saveWalkthrough,
  type WalkthroughEvent,
} from '@/lib/studylab/walkthroughs'

/**
 * A guided run through the LearnSpace, done on the learner's own lesson.
 *
 * The coach marks say what each control is. This says what to do with them,
 * and — the part that makes it a walkthrough rather than a list — each step
 * ticks off only when the learner actually performs it. Nothing is simulated
 * and nothing is faked: the events come from the workspace as the real actions
 * happen.
 *
 * Deliberately dockable and always dismissible. A panel that follows you around
 * a workspace you are trying to use is worse than no help at all.
 */
export default function WalkthroughPanel({
  events,
  onHighlight,
}: {
  /** Every walkthrough-relevant thing that has happened this session. */
  events: WalkthroughEvent[]
  /** The `data-tour` anchor the current step points at, or null. */
  onHighlight?: (anchor: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [chosen, setChosen] = useState<string | null>(null)
  // Events from before the walkthrough started must not tick its steps off, so
  // progress is measured against what happened after it was picked.
  const [from, setFrom] = useState(0)

  useEffect(() => {
    const saved = loadWalkthrough()
    if (saved) {
      setChosen(saved.id)
      setOpen(true)
    }
  }, [])

  const walkthrough = chosen ? walkthroughById(chosen) : undefined
  const since = events.slice(from)
  const done = walkthrough ? progressFor(walkthrough.steps, since) : 0
  const finished = walkthrough ? done >= walkthrough.steps.length : false
  const current = walkthrough && !finished ? walkthrough.steps[done] : undefined

  useEffect(() => {
    onHighlight?.(open && current?.anchor ? current.anchor : null)
  }, [open, current?.anchor, onHighlight])

  useEffect(() => {
    if (chosen) saveWalkthrough({ id: chosen, events: since })
  }, [chosen, since])

  const start = (id: string) => {
    setFrom(events.length)
    setChosen(id)
  }

  const leave = () => {
    setChosen(null)
    saveWalkthrough(null)
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="pointer-events-auto flex items-center gap-2 rounded-xl border border-ss-line bg-ss-panel px-3 py-2 text-[13px] font-bold text-ss-ink shadow-lg transition-colors hover:border-ss-accent"
      >
        <GraduationCap className="h-4 w-4 text-ss-accent" aria-hidden />
        Show me how
      </button>
    )
  }

  return (
    <section
      aria-label="Guided walkthrough"
      className="pointer-events-auto w-[19rem] rounded-2xl border border-ss-line bg-ss-panel shadow-2xl"
    >
      <header className="flex items-center gap-2 border-b border-ss-line px-3.5 py-2.5">
        {walkthrough && (
          <button
            type="button"
            onClick={leave}
            aria-label="Back to all walkthroughs"
            className="-ml-1 rounded-lg p-1 text-ss-slate hover:text-ss-ink"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
        <GraduationCap className="h-4 w-4 shrink-0 text-ss-accent" aria-hidden />
        <h2 className="min-w-0 flex-1 truncate text-[13px] font-extrabold text-ss-ink">
          {walkthrough ? walkthrough.title : 'Show me how'}
        </h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close the walkthrough"
          className="rounded-lg p-1 text-ss-slate hover:text-ss-ink"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      {!walkthrough ? (
        <div className="flex flex-col gap-1.5 p-2.5">
          <p className="px-1 pb-0.5 text-[12.5px] font-medium leading-snug text-ss-slate">
            Pick what you are trying to do. Each one walks you through it on this lesson — the
            steps tick off as you actually do them.
          </p>
          {WALKTHROUGHS.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => start(w.id)}
              className="rounded-xl border border-ss-line bg-ss-chip px-3 py-2.5 text-left transition-colors hover:border-ss-accent"
            >
              <span className="block text-[13px] font-bold text-ss-ink">{w.title}</span>
              <span className="mt-0.5 block text-[12px] font-medium leading-snug text-ss-slate">
                {w.blurb}
              </span>
              <span className="mt-1 block text-[12px] font-bold uppercase tracking-wide text-ss-slate">
                {w.steps.length} steps
              </span>
            </button>
          ))}
        </div>
      ) : finished ? (
        <div className="flex flex-col gap-2.5 p-3.5">
          <p className="text-[13px] font-bold text-ss-ink">That’s the whole thing. Nicely done.</p>
          <p className="text-[12.5px] font-medium leading-snug text-ss-slate">
            Everything you just did works at any point in any lesson — there is nothing special
            about this one.
          </p>
          <button
            type="button"
            onClick={leave}
            className="rounded-xl bg-ss-accent px-3.5 py-2 text-[13px] font-extrabold text-white transition-opacity hover:opacity-90"
          >
            Try another
          </button>
        </div>
      ) : (
        <div className="p-2.5">
          <ol className="flex flex-col gap-0.5 list-none">
            {walkthrough.steps.map((step, i) => {
              const isDone = i < done
              const isNow = i === done
              return (
                <li
                  key={step.action}
                  className={`rounded-xl px-2.5 py-2 ${isNow ? 'bg-ss-chip' : ''}`}
                >
                  <div className="flex items-start gap-2">
                    <span
                      aria-hidden
                      className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border"
                      style={
                        isDone
                          ? { backgroundColor: 'var(--ss-good)', borderColor: 'var(--ss-good)' }
                          : isNow
                            ? { borderColor: 'var(--ss-accent)' }
                            : { borderColor: 'var(--ss-line)' }
                      }
                    >
                      {isDone && <Check className="h-2.5 w-2.5 text-white" strokeWidth={4} />}
                    </span>
                    <span
                      className={`text-[12.5px] font-bold leading-snug ${
                        isDone ? 'text-ss-slate line-through decoration-1' : 'text-ss-ink'
                      }`}
                    >
                      {step.action}
                    </span>
                  </div>
                  {/* Only the step in hand explains itself. Showing every reason
                      at once turns a walkthrough back into a wall of text. */}
                  {isNow && (
                    <p className="mt-1 pl-6 text-[12px] font-medium leading-snug text-ss-slate">
                      {step.why}
                    </p>
                  )}
                </li>
              )
            })}
          </ol>
          <p className="px-2.5 pt-1.5 text-[12px] font-bold uppercase tracking-wide text-ss-slate">
            {done} of {walkthrough.steps.length} done
          </p>
        </div>
      )}
    </section>
  )
}
