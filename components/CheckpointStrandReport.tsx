'use client'

/**
 * How a Checkpoint paper actually reads back.
 *
 * Cambridge reports on a 0-50 scale AND at strand level — that second half is
 * the whole reason a missed paper cannot be made up, because scoring the
 * biology strand needs every biology question across both components. A result
 * screen that shows only a percentage turns Checkpoint practice into a quiz
 * with a syllabus code on it: "68%" is not something a student can act on,
 * "you are weak on Earth and Space" is.
 *
 * A strand the paper never reached says so, rather than showing zero. Zero is a
 * finding about the learner; silence is a fact about the paper, and printing
 * one as the other is the same class of lie as a citation that is not true.
 */
import { CheckCircle2, CircleSlash, TrendingDown } from 'lucide-react'
import type { CheckpointResult } from '@/lib/checkpoint-report'

export interface CheckpointPaperMeta {
  programme: 'primary' | 'lower-secondary'
  subject: string
  code: string
  component: string
}

export default function CheckpointStrandReport({
  meta,
  report,
}: {
  meta: CheckpointPaperMeta
  report: CheckpointResult
}) {
  const assessed = report.strands.filter((s) => s.assessed)
  const programmeLabel = meta.programme === 'primary' ? 'Primary' : 'Lower Secondary'

  return (
    <section className="rounded-2xl border border-ss-line bg-ss-panel p-6 dark:border-white/10">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-ss-accent">
            Cambridge {programmeLabel} Checkpoint
          </p>
          <h2 className="mt-1 text-[20px] font-extrabold text-ss-ink dark:text-white">
            {meta.subject} {meta.code}/{meta.component}
          </h2>
        </div>
        <div className="text-right">
          <p className="text-[32px] font-extrabold leading-none text-ss-ink dark:text-white">
            {report.score}
            <span className="text-[18px] font-bold text-ss-slate"> / {report.outOf}</span>
          </p>
          {/* Naming the scale matters: 0-50 is Cambridge's, not ours, and a
              reader who assumes it is a percentage reads 38 as a failure. */}
          <p className="mt-1 text-[12px] font-semibold text-ss-slate">Cambridge reporting scale</p>
        </div>
      </header>

      {report.weakest && (
        <p className="mb-4 flex items-center gap-2 rounded-xl border border-amber-200/70 bg-amber-50/60 px-3.5 py-2.5 text-[13px] font-semibold text-amber-900 dark:border-amber-800/40 dark:bg-amber-900/10 dark:text-amber-200">
          <TrendingDown className="h-4 w-4 shrink-0" />
          Weakest strand in this paper: <strong>{report.weakest}</strong>
        </p>
      )}

      <ul className="space-y-2">
        {report.strands.map((s) => {
          const share = s.assessed ? s.correct / s.total : 0
          return (
            <li
              key={s.strand}
              className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 ${
                s.assessed ? 'border-ss-line dark:border-white/10' : 'border-dashed border-ss-line/70 dark:border-white/5'
              }`}
            >
              <span className="shrink-0">
                {s.assessed ? (
                  <CheckCircle2 className="h-4 w-4" style={{ color: share >= 0.7 ? 'var(--ss-good)' : 'var(--ss-slate)' }} />
                ) : (
                  <CircleSlash className="h-4 w-4 text-ss-slate" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-bold text-ss-ink dark:text-white">{s.strand}</span>
                {s.assessed ? (
                  <span className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-ss-line/60 dark:bg-white/10">
                    {/* Token colours are set inline: Tailwind cannot resolve a
                        var() to a colour, so an alpha class renders nothing. */}
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${Math.round(share * 100)}%`, backgroundColor: 'var(--ss-accent)' }}
                    />
                  </span>
                ) : (
                  <span className="block text-[12px] font-semibold text-ss-slate">Not assessed in this paper</span>
                )}
              </span>
              {s.assessed && (
                <span className="shrink-0 text-[13px] font-bold tabular-nums text-ss-slate">
                  {s.correct}/{s.total}
                </span>
              )}
            </li>
          )
        })}
      </ul>

      <p className="mt-4 text-[12px] font-medium text-ss-slate">
        {assessed.length} of {report.strands.length} strands appeared in this paper. The real Checkpoint
        draws on all of them across both components, so sit Paper 01 and Paper 02 to see the full picture.
      </p>
    </section>
  )
}
