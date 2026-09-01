'use client'

import { useState } from 'react'
import { Lock, ArrowRight, Pencil } from 'lucide-react'
import type { ChatPlan } from '@/lib/studylab/types'
import type { Pace } from '@/lib/studylab/lessonPolicy'
import { PACES } from './paceOptions'

/**
 * The plan, in the conversation, where the learner is already looking.
 *
 * It used to live only in the sidebar, announced by a single line telling the
 * learner to go and look at it. Nobody did — and a plan you cannot answer is
 * not a plan you agreed to. So the outline, the questions the tutor wants
 * answered, how it should be taught, and the two things you can do about it are
 * all in one card, in the place the conversation is happening.
 *
 * A step the learner has been measured weak on says so on its face. In a
 * lesson built from that measurement it also says it is not up for
 * negotiation, because it is the reason the lesson exists.
 */
export function PlanCard({
  plan,
  busy,
  onAccept,
  onAnswer,
  defaultPace = 'step',
}: {
  plan: ChatPlan
  busy: boolean
  onAccept: (pace: Pace) => void
  onAnswer: (answer: string) => void
  /** Where the toggle starts. The policy's, so the card and the rail agree. */
  defaultPace?: Pace
}) {
  const [answering, setAnswering] = useState(false)
  const [text, setText] = useState('')
  const [pace, setPace] = useState<Pace>(defaultPace)

  const live = plan.live !== false
  const send = () => {
    const trimmed = text.trim()
    if (!trimmed || busy) return
    onAnswer(trimmed)
    setText('')
    setAnswering(false)
  }

  return (
    <div
      className="rounded-2xl border p-3.5"
      style={{ borderColor: 'var(--ss-accent)', backgroundColor: 'var(--ss-accent-soft)' }}
    >
      <p className="text-[12px] font-extrabold uppercase tracking-wide text-ss-accent">
        Proposed plan
      </p>

      <ol className="mt-2.5 space-y-2">
        {plan.steps.map((step, i) => (
          <li key={step.id} className="flex gap-2.5">
            <span
              className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md text-[12px] font-extrabold text-white"
              style={{ backgroundColor: 'var(--ss-accent)' }}
            >
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="text-[13.5px] font-bold leading-snug text-ss-ink">{step.title}</p>
              {step.goal && (
                <p className="mt-0.5 text-[12.5px] font-medium leading-snug text-ss-slate">
                  {step.goal}
                </p>
              )}
              {step.measured !== null && (
                <p className="mt-1 inline-flex items-center gap-1 text-[12px] font-bold text-ss-warn">
                  {step.locked && <Lock className="h-3 w-3" aria-hidden />}
                  You scored {step.measured}% on this
                  {step.locked && ' — so we'}
                  {step.locked && <span>&rsquo;ll cover it</span>}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>

      {live && plan.questions.length > 0 && (
        <div className="mt-3 rounded-xl bg-ss-panel p-3">
          <p className="text-[12.5px] font-bold text-ss-ink">
            {plan.questions.length === 1 ? 'One thing first:' : 'Two things first:'}
          </p>
          <ul className="mt-1.5 space-y-1">
            {plan.questions.map((q) => (
              <li key={q} className="text-[13px] font-medium leading-snug text-ss-slate">
                • {q}
              </li>
            ))}
          </ul>
        </div>
      )}

      {live && !answering && (
        <div className="mt-3">
          <p className="text-[12px] font-extrabold uppercase tracking-wide text-ss-slate">
            How should I teach it?
          </p>
          <div className="mt-1.5 grid gap-1.5">
            {PACES.map(({ id, icon: Icon, title, blurb }) => {
              const on = pace === id
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setPace(id)}
                  disabled={busy}
                  // The selected tint is set inline: an alpha modifier on a
                  // token colour emits no rule, so the "chosen" state would be
                  // invisible and both options would look unselected.
                  style={on ? { borderColor: 'var(--ss-accent)', backgroundColor: 'var(--ss-accent-soft)' } : undefined}
                  className={`flex items-start gap-2.5 rounded-xl border p-2.5 text-left transition-colors disabled:opacity-50 ${
                    on ? '' : 'border-ss-line bg-ss-panel hover:border-ss-accent'
                  }`}
                >
                  <Icon
                    className="mt-0.5 h-4 w-4 shrink-0"
                    style={{ color: on ? 'var(--ss-accent)' : 'var(--ss-slate)' }}
                    aria-hidden
                  />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-bold text-ss-ink">{title}</span>
                    <span className="mt-0.5 block text-[12.5px] font-medium leading-snug text-ss-slate">
                      {blurb}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
          <p className="mt-1.5 text-[12px] font-medium text-ss-slate">
            You can switch this at any point from the plan panel.
          </p>
        </div>
      )}

      {live && (
        <div className="mt-3">
          {answering ? (
            <div className="flex flex-col gap-2">
              <textarea
                autoFocus
                rows={2}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    send()
                  }
                }}
                placeholder={plan.questions[0] ?? 'What would you change?'}
                className="w-full resize-none rounded-xl border border-ss-line bg-ss-panel px-3 py-2 text-[13px] text-ss-ink outline-none placeholder:text-ss-slate focus:border-[color:var(--ss-accent)]"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={send}
                  disabled={busy || !text.trim()}
                  className="rounded-xl bg-ss-accent px-3.5 py-2 text-[13px] font-bold text-white disabled:opacity-50"
                >
                  Redo the plan
                </button>
                <button
                  type="button"
                  onClick={() => setAnswering(false)}
                  className="rounded-xl px-3 py-2 text-[13px] font-bold text-ss-slate hover:text-ss-ink"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onAccept(pace)}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-xl bg-ss-accent px-3.5 py-2 text-[13px] font-bold text-white disabled:opacity-50"
              >
                Looks good, start
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => setAnswering(true)}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-xl border border-ss-line bg-ss-panel px-3.5 py-2 text-[13px] font-bold text-ss-ink disabled:opacity-50"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden />
                {plan.questions.length > 0 ? 'Answer / change it' : 'Change something'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
