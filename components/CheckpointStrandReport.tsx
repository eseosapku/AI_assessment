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
  /** 'paper' is the whole component; 'practice' is a single-strand drill. */
  mode?: 'paper' | 'practice'
  /** The strand drilled, when this was a practice run. */
  strand?: string
  totalMarks?: number
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
  const isDrill = meta.mode === 'practice'
  // 50 marks is Cambridge's reporting scale as well as the paper's total, so a
  // full component's mark IS the reported number. A 12-mark drill is not, and
  // saying so would misrepresent a practice run as a Checkpoint result.
  const onCambridgeScale = !isDrill && report.outOf === 50

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
          {isDrill && meta.strand && (
            <p className="mt-0.5 text-[12.5px] font-semibold text-ss-slate">{meta.strand} drill</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-[32px] font-extrabold leading-none text-ss-ink dark:text-white">
            {Math.round(report.score * 10) / 10}
            <span className="text-[18px] font-bold text-ss-slate"> / {report.outOf}</span>
          </p>
          {/* Naming the scale matters: 0-50 is Cambridge's, not ours, and a
              reader who assumes it is a percentage reads 38 as a failure. A
              drill is not on that scale and must not borrow its authority. */}
          <p className="mt-1 text-[12px] font-semibold text-ss-slate">
            {onCambridgeScale ? 'Marks, on Cambridge’s 0–50 scale' : 'Marks'}
          </p>
        </div>
      </header>

      {report.weakest && (
        /* The tokens carry the retune; a hardcoded amber does not, which is
           how this card kept failing contrast after the palette was fixed. */
        <p
          className="mb-4 flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-[13px] font-semibold"
          style={{
            // Set inline: Tailwind's alpha modifiers cannot resolve a var() to
            // a colour, so `border-ss-warn/30` renders nothing at all.
            borderColor: 'color-mix(in srgb, var(--ss-warn) 35%, transparent)',
            backgroundColor: 'color-mix(in srgb, var(--ss-warn) 10%, transparent)',
            color: 'var(--ss-warn)',
          }}
        >
          <TrendingDown className="h-4 w-4 shrink-0" />
          Weakest strand in this paper: <strong>{report.weakest}</strong>
        </p>
      )}

      <ul className="space-y-2">
        {report.strands.map((s) => {
          const share = s.assessed && s.available > 0 ? s.earned / s.available : 0
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
                <span className="shrink-0 text-right text-[13px] font-bold tabular-nums text-ss-slate">
                  {Math.round(s.earned * 10) / 10}/{s.available}
                  <span className="block text-[12px] font-semibold">
                    {s.questions} question{s.questions === 1 ? '' : 's'}
                  </span>
                </span>
              )}
            </li>
          )
        })}
      </ul>

      <p className="mt-4 text-[12px] font-medium text-ss-slate">
        {isDrill
          ? 'This was a single-strand drill, so the other strands are untouched — sit the full paper for a result that covers the subject.'
          : `${assessed.length} of ${report.strands.length} strands came up here. Cambridge draws on all of them across both components, so sit ${meta.component === '01' ? 'Paper 02' : 'Paper 01'} too for the full picture.`}
      </p>
    </section>
  )
}
