'use client'

import { useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { ArrowRight, Lock, SendHorizontal } from 'lucide-react'
import { Inky } from '../inky/Inky'
import type { ChatPlan } from '@/lib/studylab/types'
import { motionFor } from '@/lib/studylab/motionPresets'

/** About how long a station takes, for the line under the title. */
const MINUTES_A_STEP = 4

/** The three things people actually want to change about a plan, said as instructions the redraft can act on. */
const ADJUSTMENTS: { label: string; instruction: string }[] = [
  { label: 'Shorter', instruction: 'Make it shorter — fewer steps, just the essentials.' },
  { label: 'Deeper', instruction: 'Go deeper. I want the detail and the why, not an overview.' },
  { label: 'I know the basics', instruction: 'Skip the introductory material, I already know it. Start from the harder parts.' },
]

/**
 * The lesson's opening, Brilliant-style: one calm card with one obvious thing
 * to do. The subject, the title large, how long it is, the steps as a short
 * numbered path, the tutor's question if it has one -- and Start. Changing the
 * plan is there, one quiet link away, not laid out beside Start.
 *
 * Every lesson is step by step now, so there is no pace to choose.
 */
export function PlanOpening({
  title,
  subject,
  plan,
  busy,
  onStart,
  onAnswer,
}: {
  title: string
  subject?: string | null
  plan: ChatPlan
  busy: boolean
  onStart: () => void
  onAnswer: (answer: string) => void
}) {
  const reduced = useReducedMotion() ?? false
  const [changing, setChanging] = useState(false)
  const [text, setText] = useState('')
  const live = plan.live !== false
  const n = plan.steps.length
  const send = () => {
    const said = text.trim()
    if (!said || busy) return
    onAnswer(said)
    setText('')
    setChanging(false)
  }

  return (
    <div className="flex flex-col items-center px-6 pb-7 pt-8 text-center sm:px-10">
      <Inky size={60} mood="happy" title="Inky, ready to start" />
      {subject && (
        <span
          className="mt-4 rounded-full px-3 py-1 text-[12px] font-bold uppercase tracking-[0.12em]"
          style={{ backgroundColor: 'var(--subject-soft)', color: 'var(--subject-ink)' }}
        >
          {subject}
        </span>
      )}
      <h2 className="mt-3 text-[26px] font-extrabold leading-[1.15] tracking-tight text-ss-ink [text-wrap:balance]">{title}</h2>
      <p className="mt-2 text-[14px] font-semibold text-ss-slate">
        {n} {n === 1 ? 'step' : 'steps'} · about {n * MINUTES_A_STEP} minutes
      </p>

      {/* The steps: a short numbered path, titles only. */}
      <ol className="relative mt-7 w-full max-w-[400px] list-none text-left">
        {plan.steps.map((step, i) => (
          <li key={step.id} className="relative flex gap-3.5 pb-4 last:pb-0">
            {i < n - 1 && <span aria-hidden className="absolute bottom-0 left-[15px] top-8 w-0.5 rounded-full bg-ss-line" />}
            <span
              className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full text-[13px] font-extrabold tabular-nums"
              style={
                i === 0
                  ? { backgroundColor: 'var(--subject)', color: 'var(--ss-panel)' }
                  : { boxShadow: 'inset 0 0 0 2px var(--ss-line)', backgroundColor: 'var(--ss-panel)', color: 'var(--ss-slate)' }
              }
            >
              {i + 1}
            </span>
            <span className="min-w-0 pt-1">
              <span className={`block text-[15px] leading-snug ${i === 0 ? 'font-extrabold text-ss-ink' : 'font-bold text-ss-ink'}`}>{step.title}</span>
              {step.measured !== null && (
                <span className="mt-0.5 block text-[12.5px] font-bold text-ss-warn">
                  {step.locked && <Lock className="mr-1 inline h-3 w-3 -translate-y-px" aria-hidden />}
                  You scored {step.measured}% on this{step.locked ? ' — so we’ll cover it' : ''}
                </span>
              )}
            </span>
          </li>
        ))}
      </ol>

      {live && plan.questions.length > 0 && (
        <div className="mt-7 w-full max-w-[420px] rounded-2xl bg-ss-chip p-4 text-left">
          <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-ss-slate">Before we start</p>
          {plan.questions.map((q) => (
            <p key={q} className="mt-1.5 text-[14px] font-semibold leading-snug text-ss-ink">{q}</p>
          ))}
          <AnswerBox value={text} onChange={setText} onSend={send} busy={busy} placeholder="Your answer…" label="Your answer" />
        </div>
      )}

      {live && (
        <>
          <button
            type="button"
            onClick={onStart}
            disabled={busy}
            className="ss-press mt-7 inline-flex min-h-[52px] w-full max-w-[420px] items-center justify-center gap-2 rounded-2xl text-[16px] font-extrabold shadow-[0_10px_24px_-12px_rgba(0,0,0,0.45)] disabled:opacity-50"
            style={{ backgroundColor: 'var(--subject)', color: 'var(--ss-panel)' }}
          >
            Start
            <ArrowRight className="h-4.5 w-4.5" aria-hidden />
          </button>

          {!changing ? (
            <button
              type="button"
              onClick={() => setChanging(true)}
              disabled={busy}
              aria-expanded={false}
              className="mt-3 rounded-lg px-2 py-1 text-[13.5px] font-bold text-ss-slate underline-offset-4 hover:text-ss-ink hover:underline disabled:opacity-50"
            >
              Change the plan
            </button>
          ) : null}
          <AnimatePresence>
            {changing && (
              <motion.div {...motionFor('rise', reduced)} className="mt-4 w-full max-w-[420px] text-left">
                <div className="flex flex-wrap justify-center gap-2">
                  {ADJUSTMENTS.map(({ label, instruction }) => (
                    <button
                      key={label}
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        onAnswer(instruction)
                        setChanging(false)
                      }}
                      className="rounded-full border border-ss-line bg-ss-panel px-3.5 py-1.5 text-[13px] font-bold text-ss-ink transition-colors hover:border-[color:var(--subject)] hover:text-ss-subject-ink disabled:opacity-50"
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <AnswerBox value={text} onChange={setText} onSend={send} busy={busy} placeholder="Or say what to change…" label="What to change" autoFocus />
                <div className="mt-2 text-center">
                  <button type="button" onClick={() => setChanging(false)} className="rounded-lg px-2 py-1 text-[13px] font-bold text-ss-slate hover:text-ss-ink">
                    Keep it as it is
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  )
}

function AnswerBox({
  value,
  onChange,
  onSend,
  busy,
  placeholder,
  label,
  autoFocus = false,
}: {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  busy: boolean
  placeholder: string
  label: string
  autoFocus?: boolean
}) {
  return (
    <div className="mt-3 flex items-center gap-2 rounded-xl border border-ss-line bg-ss-panel py-1 pl-3 pr-1 focus-within:border-[color:var(--subject)] focus-within:ring-2 focus-within:ring-[color:var(--subject)]">
      <input
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            onSend()
          }
        }}
        placeholder={placeholder}
        aria-label={label}
        className="min-w-0 flex-1 bg-transparent py-2 text-[14px] text-ss-ink outline-none focus-visible:outline-none placeholder:text-ss-slate"
      />
      <button
        type="button"
        onClick={onSend}
        disabled={busy || !value.trim()}
        aria-label="Send"
        className="ss-press grid h-9 w-9 shrink-0 place-items-center rounded-lg disabled:opacity-40"
        style={{ backgroundColor: 'var(--subject)', color: 'var(--ss-panel)' }}
      >
        <SendHorizontal className="h-4 w-4" aria-hidden />
      </button>
    </div>
  )
}
