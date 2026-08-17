'use client'

import { useState } from 'react'
import { Flag, Check } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { REPORT_REASONS, DETAIL_MAX_LENGTH } from '@/lib/question-report'

/**
 * "Report a problem" on a reviewed question.
 *
 * Sits quietly on each question in the review, not in the player: mid-attempt
 * a student is trying to answer, and inviting them to critique the paper then
 * is a distraction. Afterwards, looking at what they got wrong, is exactly when
 * they know whether the question was unfair.
 *
 * The submitted state is deliberately warm and final — a student who has taken
 * the trouble to tell us something should not be left wondering whether it
 * went anywhere.
 */
export default function ReportQuestionButton({
  questionIndex,
  question,
  assessmentId,
  resultId,
  userId,
}: {
  questionIndex: number
  question: unknown
  assessmentId?: string | null
  resultId?: string | null
  userId?: string | null
}) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<string>('')
  const [detail, setDetail] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    setError('')
    setSending(true)
    try {
      const res = await fetch('/api/question-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId ?? null,
          assessment_id: assessmentId ?? null,
          result_id: resultId ?? null,
          question_index: questionIndex,
          reason,
          detail,
          question,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || 'Could not send your report.')
      setSent(true)
      setOpen(false)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not send your report.')
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-ss-good">
        <Check className="h-3.5 w-3.5" />
        Thanks — we&apos;ll look at this one
      </span>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] font-bold text-ss-slate transition-colors hover:bg-ss-chip hover:text-ss-ink"
      >
        <Flag className="h-3.5 w-3.5" aria-hidden />
        Report a problem
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Report a problem with question ${questionIndex + 1}`}
        className="max-w-md"
      >
        <div className="p-6">
          <h3 className="text-lg font-extrabold text-ss-ink">
            What&apos;s wrong with question {questionIndex + 1}?
          </h3>
          <p className="mt-1 text-[13px] font-medium text-ss-slate">
            This goes to the people who build the quizzes. It won&apos;t change your score.
          </p>

          <fieldset className="mt-4">
            <legend className="sr-only">Reason</legend>
            <div className="space-y-1.5">
              {REPORT_REASONS.map((r) => (
                <label
                  key={r.id}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-xl border-2 p-3 text-[13.5px] transition-colors ${
                    reason === r.id
                      ? 'border-ss-accent bg-[color:var(--ss-accent)]/8 font-semibold text-ss-ink'
                      : 'border-ss-line text-ss-ink hover:border-ss-accent/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="report-reason"
                    value={r.id}
                    checked={reason === r.id}
                    onChange={() => setReason(r.id)}
                    className="h-4 w-4 accent-[color:var(--ss-accent)]"
                  />
                  {r.label}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="mt-4 block">
            <span className="text-[12.5px] font-bold text-ss-ink">
              Anything else? {reason === 'other' && <span className="text-ss-bad">Required</span>}
            </span>
            <textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              maxLength={DETAIL_MAX_LENGTH}
              rows={3}
              placeholder="Optional — what did you expect instead?"
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white p-3 text-[13px] text-ss-ink outline-none placeholder:text-ss-slate focus:border-ss-accent dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />
          </label>

          {error && <p className="mt-2 text-[12.5px] font-semibold text-ss-bad">{error}</p>}

          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={submit}
              disabled={!reason || sending}
              className="flex-1 rounded-xl bg-ss-accent px-5 py-3 text-[14px] font-extrabold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {sending ? 'Sending…' : 'Send report'}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-xl border border-ss-line px-5 py-3 text-[14px] font-bold text-ss-ink hover:border-ss-accent"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}
