'use client'

import { useCallback, useEffect, useState } from 'react'
import { Flag, Loader2 } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import { figureSrc } from '@/lib/figure-src'
import { REPORT_REASONS } from '@/lib/question-report'

/**
 * The question-report review queue.
 *
 * Students could report a bad question, but the reports landed in a table
 * nobody could read without SQL — so the cheapest quality signal in the
 * product was accumulating unseen. This is the smallest thing that makes it
 * actionable: read what was reported, see the question as the student saw it,
 * and record what was done about it.
 *
 * Teacher-only, and deliberately one screen rather than an admin console.
 */

type Report = {
  id: string
  assessment_id: string | null
  question_index: number
  reason: string
  detail: string | null
  question_snapshot: Record<string, unknown> | null
  status: string
  created_at: string
}

const STATUSES = ['open', 'reviewed', 'actioned', 'dismissed'] as const

const reasonLabel = (id: string) => REPORT_REASONS.find((r) => r.id === id)?.label ?? id

export default function ReportsPage() {
  const { user } = useAuth()
  const [status, setStatus] = useState<string>('open')
  const [reports, setReports] = useState<Report[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/question-report?status=${encodeURIComponent(status)}`)
      const json = await res.json()
      setReports(json?.reports ?? [])
      setCounts(json?.counts ?? {})
    } catch {
      setReports([])
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => { load() }, [load])

  const setReportStatus = async (id: string, next: string) => {
    // Optimistic: the row leaves the current filter at once. A queue is worked
    // through in a rhythm, and a round trip per item breaks it.
    setReports((rs) => rs.filter((r) => r.id !== id))
    try {
      await fetch('/api/question-report', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: next }),
      })
    } finally {
      load()
    }
  }

  if (user && user.role !== 'teacher') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-[15px] font-bold text-ss-ink">This page is for teachers.</p>
        <p className="mt-1 text-[13.5px] font-medium text-ss-slate">
          If you spotted a problem with a question, use the report control on the question itself.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <p className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.25em] text-ss-accent">
          <Flag className="h-3.5 w-3.5" /> Reported questions
        </p>
        <h1 className="mt-2 text-[28px] font-extrabold tracking-tight text-ss-ink">What students flagged</h1>
        <p className="mt-1 text-[14px] font-medium text-ss-slate">
          Each one is a question a student thought was wrong. Worth reading before the next change to
          how questions are generated.
        </p>
      </header>

      <div className="mb-5 flex flex-wrap gap-1.5">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            aria-pressed={status === s}
            className={`rounded-full border px-3.5 py-2 text-[13px] font-bold capitalize transition-colors ${
              status === s
                ? 'border-ss-accent bg-ss-accent text-white'
                : 'border-ss-line bg-ss-panel text-ss-slate hover:border-ss-accent hover:text-ss-accent'
            }`}
          >
            {s}{counts[s] ? ` (${counts[s]})` : ''}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-ss-accent" /></div>
      ) : reports.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-ss-line p-10 text-center">
          <p className="text-[14px] font-bold text-ss-ink">Nothing {status}</p>
          <p className="mt-1 text-[13px] font-medium text-ss-slate">
            {status === 'open' ? 'No open reports — the papers are holding up.' : `No reports marked ${status}.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => {
            const snap = r.question_snapshot ?? {}
            const options = Array.isArray(snap.options) ? (snap.options as string[]) : []
            const correct = Number(snap.correct_answer)
            return (
              <article key={r.id} className="rounded-2xl border border-ss-line bg-ss-panel p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="rounded-full bg-[color:var(--ss-accent)]/12 px-2.5 py-1 text-[12px] font-extrabold text-ss-accent">
                    {reasonLabel(r.reason)}
                  </span>
                  <span className="text-[12px] font-semibold text-ss-slate">
                    Question {r.question_index + 1} · {new Date(r.created_at).toLocaleDateString()}
                  </span>
                </div>

                {r.detail && (
                  <p className="mt-2.5 rounded-xl bg-ss-chip p-3 text-[13.5px] font-medium text-ss-ink">
                    {r.detail}
                  </p>
                )}

                {/* The question as the student saw it. Without this a report is
                    unusable once the paper has been regenerated. */}
                {typeof snap.question === 'string' && (
                  <div className="mt-3 rounded-xl border border-ss-line p-3">
                    <p className="text-[13.5px] font-bold text-ss-ink">{snap.question}</p>
                    {options.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {options.map((opt, i) => (
                          <li
                            key={i}
                            className={`text-[13px] ${i === correct ? 'font-extrabold text-ss-good' : 'text-ss-slate'}`}
                          >
                            {opt}{i === correct ? '  (marked correct)' : ''}
                          </li>
                        ))}
                      </ul>
                    )}
                    {typeof snap.image_url === 'string' && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={figureSrc(snap.image_url)} alt="" className="mt-2 max-h-40 rounded-lg border border-ss-line" />
                    )}
                  </div>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  {STATUSES.filter((s) => s !== r.status).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setReportStatus(r.id, s)}
                      className="rounded-xl border border-ss-line px-3 py-1.5 text-[12.5px] font-bold capitalize text-ss-ink transition-colors hover:border-ss-accent hover:text-ss-accent"
                    >
                      Mark {s}
                    </button>
                  ))}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
