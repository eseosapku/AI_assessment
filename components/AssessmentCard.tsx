'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, Calendar, RotateCcw } from 'lucide-react'
import { subjectArt } from '@/lib/studio/subjectArt'

interface Assessment {
  id: string
  date: string
  subject: string
  topic: string
  grade: string
  score: number
  percentage?: number
  feedback: string
  assessment_id?: string | null
  questions_data?: any[] | null
  answers?: Record<string, string> | null
  longform_grades?: Record<string, any> | null
}

// Per-grade header gradient, score-ring color, and grade-pill classes.
const GRADE_CONFIG: Record<string, { grad: string; ring: string; pill: string }> = {
  'A+': { grad: 'linear-gradient(120deg,#0E7A5A,#16B67A 60%,#3FD08F)', ring: '#16B67A', pill: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  'A': { grad: 'linear-gradient(120deg,#0E7A5A,#16B67A 60%,#3FD08F)', ring: '#16B67A', pill: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  'B+': { grad: 'linear-gradient(120deg,#0C74B4,#0E94D6 55%,#2ACBF2)', ring: '#0E8FD1', pill: 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300' },
  'B': { grad: 'linear-gradient(120deg,#0C74B4,#0E94D6 55%,#2ACBF2)', ring: '#0E8FD1', pill: 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300' },
  'C': { grad: 'linear-gradient(120deg,#C77B16,#F0A93E 60%,#FFC777)', ring: '#F0A93E', pill: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  'D': { grad: 'linear-gradient(120deg,#C2473F,#E2645F 60%,#F0978F)', ring: '#E2645F', pill: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
}

export default function AssessmentCard({ assessment }: { assessment: Assessment }) {
  const router = useRouter()
  const cfg = GRADE_CONFIG[assessment.grade] ?? GRADE_CONFIG['D']
  const pct = Math.max(0, Math.min(100, Math.round(assessment.percentage ?? assessment.score ?? 0)))

  // The card only carries a result id — the list endpoint deliberately doesn't
  // ship every paper's questions. The player fetches the paper itself from this
  // id, which keeps the dashboard payload small.
  const handleRetake = () => {
    router.push(`/assessment?retake=${encodeURIComponent(assessment.id)}`)
  }

  return (
    // Relative wrapper, not a Link: the card needs a real button inside it, and
    // a button nested in an anchor is invalid markup. A full-bleed overlay link
    // keeps the whole card clickable while the button sits above it.
    <div className="group relative overflow-hidden rounded-[22px] border border-ss-line bg-ss-panel shadow-[0_18px_40px_-30px_rgba(20,60,90,.45)] transition-all duration-200 hover:-translate-y-1 hover:shadow-ss-panel">
      <Link
        href={`/results/${assessment.id}`}
        className="absolute inset-0 z-0"
        aria-label={`View results for ${assessment.subject}`}
      />
      {/* Gradient header (colored by grade) with topic + subject art */}
      <div className="relative flex h-[68px] items-center px-4 text-white" style={{ background: cfg.grad }}>
        <span className="rounded-full bg-white/25 px-2.5 py-1 text-[12px] font-extrabold uppercase tracking-wide backdrop-blur-sm">
          {assessment.topic || 'Assessment'}
        </span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={subjectArt(assessment.subject)}
          alt=""
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 h-[58px] w-[58px] -translate-y-1/2 object-contain drop-shadow-[0_6px_10px_rgba(0,0,0,0.28)]"
        />
      </div>

      <div className="p-4">
        <h3 className="line-clamp-2 min-h-[2.4em] text-[14.5px] font-extrabold leading-snug text-ss-ink">{assessment.subject}</h3>
        <div className="mt-3 flex items-center gap-3">
          <div className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(${cfg.ring} ${pct}%, var(--ss-chip) 0)` }}>
            <div className="grid h-[42px] w-[42px] place-items-center rounded-full bg-ss-panel text-[13px] font-extrabold text-ss-ink">{pct}%</div>
          </div>
          <span className={`rounded-lg px-2.5 py-1.5 text-[15px] font-extrabold leading-none ${cfg.pill}`}>{assessment.grade}</span>
          <span className="flex items-center gap-1 text-[12px] font-semibold text-ss-slate">
            <Calendar className="h-3 w-3" />
            {assessment.date}
          </span>
          <span className="ml-auto inline-flex items-center gap-1 text-[12px] font-extrabold text-ss-accent">
            Review <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>

        <button
          type="button"
          onClick={handleRetake}
          // z-10 lifts it above the overlay link so the click retakes the quiz
          // instead of opening the review.
          className="relative z-10 mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-ss-line bg-ss-chip py-2 text-[12px] font-extrabold text-ss-ink transition-colors hover:border-ss-accent hover:text-ss-accent"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Retake quiz
        </button>
      </div>
    </div>
  )
}
