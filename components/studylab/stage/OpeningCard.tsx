'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { Inky } from '../inky/Inky'
import { PlanOpening } from './PlanOpening'
import { QuestionPicker } from '../QuestionPicker'
import { motionFor } from '@/lib/studylab/motionPresets'
import type { ChatMessage } from '@/lib/studylab/types'
import type { Pace } from '@/lib/studylab/lessonPolicy'

/**
 * The lesson's opening, on the board: the path it proposes, the questions the
 * tutor wants answered, and the way to start.
 *
 * It used to be a card in the chat column. The chat is a drawer now, and the
 * moment a lesson begins is the one moment everything else on the screen is
 * waiting on this, so it takes the stage. A homework space gets its page of
 * questions here instead, to choose from.
 */
export function OpeningCard({
  title,
  subject,
  messages,
  busy,
  defaultPace,
  onAcceptPlan,
  onAnswerPlan,
  onStartHomework,
}: {
  title: string
  subject?: string | null
  messages: ChatMessage[]
  busy: boolean
  defaultPace?: Pace
  onAcceptPlan?: (pace: Pace) => void
  onAnswerPlan?: (answer: string) => void
  onStartHomework?: (ids: string[]) => void
}) {
  const reduced = useReducedMotion() ?? false
  const planMsg = [...messages].reverse().find((m) => m.kind === 'plan')
  const plan = planMsg?.plan?.live ? planMsg.plan : null
  const sheetMsg = [...messages].reverse().find((m) => m.kind === 'homework')
  const sheet = sheetMsg?.sheet?.live ? sheetMsg.sheet : null
  if (!plan && !sheet) return null

  const rise = motionFor('rise', reduced)
  const count = plan ? plan.steps.length : sheet!.questions.length

  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex justify-center overflow-y-auto px-4 pb-28 pt-16">
      <motion.section
        data-tour="lesson-plan-card"
        data-stage-avoid
        aria-label={plan ? 'Your lesson plan' : 'Your homework questions'}
        initial={rise.initial}
        animate={rise.animate}
        transition={rise.transition}
        className="pointer-events-auto h-max w-full max-w-[560px] overflow-hidden rounded-[28px] border border-ss-line bg-ss-panel shadow-[0_28px_60px_-28px_rgba(20,60,90,0.5)]"
      >
        {plan ? (
          <PlanOpening
            title={title}
            subject={subject}
            plan={plan}
            busy={busy}
            onStart={() => onAcceptPlan?.('step')}
            onAnswer={(answer) => onAnswerPlan?.(answer)}
          />
        ) : (
        <>
        <header
          className="flex items-start gap-4 px-6 pb-5 pt-6"
          style={{ backgroundColor: 'color-mix(in srgb, var(--subject) 12%, var(--ss-panel))' }}
        >
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-ss-subject-ink">
              {plan ? 'Your lesson' : 'Your homework'}
            </p>
            <h2 className="mt-1 text-[22px] font-extrabold leading-tight tracking-tight text-ss-ink [text-wrap:balance]">{title}</h2>
            <p className="mt-1.5 text-[13px] font-semibold text-ss-slate">
              {plan ? `${count} ${count === 1 ? 'station' : 'stations'}` : `${count} ${count === 1 ? 'question' : 'questions'} on the page`}
              {subject ? ` · ${subject}` : ''}
            </p>
          </div>
          {/* The hero art lands here (Phase 5); until then, Inky greets. */}
          <Inky size={64} mood="happy" className="shrink-0" title="Inky, ready to start" />
        </header>
        <div className="px-6 py-5">
          {sheetMsg?.content && <p className="mb-3 text-[14px] font-medium leading-relaxed text-ss-ink">{sheetMsg.content}</p>}
          <QuestionPicker questions={sheet!.questions} live busy={busy} onStart={(ids) => onStartHomework?.(ids)} />
        </div>
        </>
        )}
      </motion.section>
    </div>
  )
}
