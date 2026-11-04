'use client'

import { useState } from 'react'
import { Lock, ArrowRight, Pencil } from 'lucide-react'
import { Kana } from './kana/Kana'
import type { ChatPlan } from '@/lib/studylab/types'
import type { Pace } from '@/lib/studylab/lessonPolicy'

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
/**
 * Reshapings offered on every plan, whether or not the tutor asked anything.
 *
 * The plan job is allowed to ask nothing when the plan genuinely does not turn
 * on anything, and often does — so the negotiation the card exists for appeared
 * on some lessons and not others, behind a button reading "Change something"
 * that named nothing in particular. Forcing a question instead would only
 * produce filler. These are the three things people actually want to change,
 * said as instructions the redraft can act on directly.
 */
const ADJUSTMENTS: { label: string; instruction: string }[] = [
  { label: 'Make it shorter', instruction: 'Make it shorter — fewer steps, just the essentials.' },
  { label: 'Go deeper', instruction: 'Go deeper. I want the detail and the why, not an overview.' },
  {
    label: 'I know the basics',
    instruction: 'Skip the introductory material, I already know it. Start from the harder parts.',
  },
]

export function PlanCard({
  plan,
  busy,
  onAccept,
  onAnswer,
  defaultPace = 'step',
  variant = 'chat',
}: {
  plan: ChatPlan
  busy: boolean
  onAccept: (pace: Pace) => void
  onAnswer: (answer: string) => void
  /** Where the toggle starts. The policy's, so the card and the rail agree. */
  defaultPace?: Pace
  /**
   * `stage`: the opening card on the board -- no frame of its own, the steps
   * drawn as the path the lesson will walk, Kana on the first.
   */
  variant?: 'chat' | 'stage'
}) {
  const [answering, setAnswering] = useState(false)
  const [text, setText] = useState('')

  const live = plan.live !== false
  const send = () => {
    const trimmed = text.trim()
    if (!trimmed || busy) return
    onAnswer(trimmed)
    setText('')
    setAnswering(false)
  }

  const stage = variant === 'stage'
  return (
    <div
      className={stage ? '' : 'rounded-2xl border p-3.5'}
      style={stage ? undefined : { borderColor: 'var(--subject)', backgroundColor: 'var(--subject-soft)' }}
    >
      {!stage && (
        <p className="text-[12px] font-extrabold uppercase tracking-wide text-ss-subject-ink">
          Proposed plan
        </p>
      )}

      {stage ? (
        <ol className="relative list-none">
          {plan.steps.map((step, i) => (
            <li key={step.id} className="relative flex gap-3 pb-3 last:pb-0">
              {i < plan.steps.length - 1 && (
                <span aria-hidden className="absolute bottom-0 left-[17px] top-9 w-0.5 rounded-full bg-ss-line" />
              )}
              <span className="relative grid h-9 w-9 shrink-0 place-items-center">
                {i === 0 ? (
                  <span className="grid h-9 w-9 place-items-center rounded-full border-2 bg-ss-panel" style={{ borderColor: 'var(--subject)' }}>
                    <Kana pose="happy" size={26}title="Kana starts here" />
                  </span>
                ) : (
                  <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-ss-line bg-ss-panel text-[12px] font-extrabold tabular-nums text-ss-slate">
                    {i + 1}
                  </span>
                )}
              </span>
              <div className="min-w-0 pt-1">
                {i === 0 && (
                  <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-ss-subject-ink">Start here</p>
                )}
                {i === 1 && <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-ss-slate">Later</p>}
                <p className="text-[14px] font-bold leading-snug text-ss-ink">{step.title}</p>
                {step.goal && <p className="mt-0.5 text-[13px] font-medium leading-snug text-ss-slate">{step.goal}</p>}
                {step.measured !== null && (
                  <p className="mt-1 text-[12px] font-bold leading-snug text-ss-warn">
                    {step.locked && <Lock className="mr-1 inline h-3 w-3 -translate-y-px" aria-hidden />}
                    {step.locked
                      ? `You scored ${step.measured}% on this — so we’ll cover it`
                      : `You scored ${step.measured}% on this`}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      ) : (
      <ol className="mt-2.5 space-y-2">
        {plan.steps.map((step, i) => (
          <li key={step.id} className="flex gap-2.5">
            <span
              className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md text-[12px] font-extrabold text-white"
              style={{ backgroundColor: 'var(--subject)' }}
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
              {/* One text node, not three. As flex items the pieces wrapped
                  independently and the line came out as "You scored 0% on
                  this — / so we    'll cover / it". */}
              {step.measured !== null && (
                <p className="mt-1 text-[12px] font-bold leading-snug text-ss-warn">
                  {step.locked && (
                    <Lock className="mr-1 inline h-3 w-3 -translate-y-px" aria-hidden />
                  )}
                  {step.locked
                    ? `You scored ${step.measured}% on this — so we’ll cover it`
                    : `You scored ${step.measured}% on this`}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
      )}

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
                className="w-full resize-none rounded-xl border border-ss-line bg-ss-panel px-3 py-2 text-[13px] text-ss-ink outline-none placeholder:text-ss-slate focus:border-[color:var(--subject)]"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={send}
                  disabled={busy || !text.trim()}
                  className="ss-press min-h-[40px] rounded-xl px-3.5 text-[13px] font-bold disabled:opacity-50"
                  style={{ backgroundColor: 'var(--subject)', color: 'var(--ss-panel)' }}
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
            <>
              <div className="mb-2.5">
                <p className="text-[12px] font-extrabold uppercase tracking-wide text-ss-slate">
                  Want it different?
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {ADJUSTMENTS.map(({ label, instruction }) => (
                    <button
                      key={label}
                      type="button"
                      disabled={busy}
                      onClick={() => onAnswer(instruction)}
                      className="rounded-full border border-ss-line bg-ss-panel px-3 py-1.5 text-[12.5px] font-bold text-ss-ink transition-colors hover:border-[color:var(--subject)] hover:text-ss-subject-ink disabled:opacity-50"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onAccept('step')}
                disabled={busy}
                className="ss-press inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-4 text-[13.5px] font-bold disabled:opacity-50"
                style={{ backgroundColor: 'var(--subject)', color: 'var(--ss-panel)' }}
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
                {plan.questions.length > 0 ? 'Answer in my own words' : 'Say what to change'}
              </button>
            </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
