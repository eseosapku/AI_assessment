'use client'

import { motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, BookOpen, ClipboardCheck, FileText, Medal, TrendingUp } from 'lucide-react'
import AssessmentCard from '@/components/AssessmentCard'
import { useAuth } from '@/components/AuthProvider'
import { useStudentDashboard } from '@/lib/hooks/useStudentDashboard'
import { StatChip } from '@/components/studio/ui'
import { subjectArt } from '@/lib/studio/subjectArt'
import ProductTour from '@/components/studio/ProductTour'

const GRADE_RING: Record<string, string> = {
  'A+': 'text-emerald-600 bg-emerald-50 border-emerald-200',
  A: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  'B+': 'text-blue-600 bg-blue-50 border-blue-200',
  B: 'text-blue-600 bg-blue-50 border-blue-200',
  C: 'text-amber-600 bg-amber-50 border-amber-200',
  D: 'text-red-600 bg-red-50 border-red-200',
}

function scoreTone(avg: number) {
  if (avg >= 70) return 'from-emerald-400 to-ss-accent'
  if (avg >= 50) return 'from-amber-300 to-ss-accent'
  return 'from-red-300 to-amber-400'
}

export default function ProgressStudio() {
  const { user } = useAuth()
  const { recentAssessments, stats, subjectAverages, loading } = useStudentDashboard(user)
  const sorted = [...subjectAverages].sort((a, b) => b.avg - a.avg)
  const strong = sorted.filter((s) => s.avg >= 60).slice(0, 4)
  const focus = sorted.filter((s) => s.avg < 60).slice(0, 4)

  // Subjects present in the results list, most-tested first. Counted from the
  // results themselves rather than from subjectAverages, so a filter chip can
  // never select a subject with nothing behind it.
  const [subjectFilter, setSubjectFilter] = useState<string | null>(null)
  const resultSubjects = useMemo(() => {
    const counts = new Map<string, number>()
    for (const a of recentAssessments) {
      const name = String(a?.subject ?? '').trim()
      if (!name) continue
      counts.set(name, (counts.get(name) ?? 0) + 1)
    }
    return [...counts.entries()]
      .map(([subject, count]) => ({ subject, count }))
      .sort((x, y) => y.count - x.count || x.subject.localeCompare(y.subject))
  }, [recentAssessments])

  const visibleAssessments = useMemo(
    () => (subjectFilter ? recentAssessments.filter((a) => a?.subject === subjectFilter) : recentAssessments),
    [recentAssessments, subjectFilter],
  )

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
      <header className="relative mb-8 overflow-hidden rounded-[24px] px-9 py-8 text-white" style={{ background: 'linear-gradient(115deg,#0C74B4,#0E94D6 52%,#2ACBF2)' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/art/trophy.png" alt="" aria-hidden className="pointer-events-none absolute bottom-0 right-8 hidden h-[88%] object-contain object-bottom drop-shadow-xl sm:block" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-white/85">Progress</p>
            <h1 className="mt-2 text-[32px] font-extrabold tracking-tight">Your results</h1>
            <p className="mt-1 text-sm font-semibold text-white/85">Every test, subject and grade in one place.</p>
          </div>
          <Link href="/report-card" className="relative inline-flex items-center gap-2 self-start rounded-full bg-[#13202A] px-5 py-2.5 text-sm font-bold text-white">
            <FileText className="h-4 w-4" />
            Build report card
          </Link>
        </div>
      </header>

      <div data-tour="progress-overall" className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatChip icon={ClipboardCheck} value={loading ? '—' : String(stats.total)} label="Total tests" tone="accent" />
        <div className="flex items-center gap-4 rounded-[18px] border border-ss-line bg-ss-panel p-4">
          <div
            className="grid h-16 w-16 shrink-0 place-items-center rounded-full"
            style={{ background: `conic-gradient(var(--ss-accent) ${stats.avgScore * 3.6}deg, var(--ss-chip) 0deg)` }}
          >
            <div className="grid h-12 w-12 place-items-center rounded-full bg-ss-panel text-sm font-extrabold text-ss-ink">
              {loading ? '—' : `${stats.avgScore}%`}
            </div>
          </div>
          <div>
            <div className="text-[13px] font-bold uppercase tracking-wide text-ss-slate">Average</div>
            <div className="mt-0.5 text-xs font-semibold text-ss-slate">Across all subjects</div>
          </div>
        </div>
        <StatChip icon={BookOpen} value={loading ? '—' : String(subjectAverages.length)} label="Subjects tracked" tone="good" />
        <StatChip icon={Medal} value={recentAssessments[0]?.grade ?? '—'} label="Latest grade" tone="warn" />
      </div>

      {subjectAverages.length > 0 && (
        <section data-tour="progress-subjects" className="mb-10 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-ss-line bg-ss-panel p-6">
            <p className="mb-4 text-[12px] font-bold uppercase tracking-widest text-ss-good">Going well</p>
            <div className="space-y-2.5">
              {(strong.length > 0 ? strong : sorted.slice(0, 3)).map((s) => (
                <div key={s.subject} className="flex items-center gap-3 rounded-xl border border-ss-line bg-[color:var(--ss-chip)]/60 p-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={subjectArt(s.subject)} alt="" aria-hidden className="h-10 w-10 shrink-0 object-contain" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-extrabold text-ss-ink">{s.subject}</p>
                    <p className="text-[12px] font-semibold text-ss-slate">{s.count} test{s.count !== 1 ? 's' : ''}</p>
                  </div>
                  <span className="text-[16px] font-extrabold" style={{ color: s.avg >= 60 ? 'var(--ss-good)' : 'var(--ss-warn)' }}>{s.avg}%</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-ss-line bg-ss-panel p-6">
            <p className="mb-1 text-[12px] font-bold uppercase tracking-widest text-ss-bad">Needs work</p>
            {/* This used to offer "Practice this subject" — another quiz on the
                thing the student already knows they are failing. Testing is
                diagnosis; the answer to a bad score is to be taught, then
                retested. Study first, and the retake follows from the lesson. */}
            <p className="mb-4 text-[12.5px] font-medium text-ss-slate">
              Get taught these before you test them again.
            </p>
            <div className="space-y-2.5">
              {(focus.length > 0 ? focus : sorted.slice(-3).reverse()).map((s) => (
                <div key={s.subject} className="flex items-center gap-3 rounded-xl border border-ss-line bg-[color:var(--ss-chip)]/60 p-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={subjectArt(s.subject)} alt="" aria-hidden className="h-10 w-10 shrink-0 object-contain" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-extrabold text-ss-ink">{s.subject}</p>
                    <Link
                      href={`/studylab?study=${encodeURIComponent(s.subject)}`}
                      className="text-[12px] font-bold text-ss-accent hover:underline"
                    >
                      Study this
                    </Link>
                  </div>
                  <span className="text-[16px] font-extrabold text-ss-bad">{s.avg}%</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section data-tour="progress-recent">
        <div className="mb-4 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-ss-accent" />
          <p className="text-[12px] font-bold uppercase tracking-[0.25em] text-ss-slate">Recent results</p>
        </div>

        {/* Subject filter. With every subject mixed into one list, checking how
            you're doing in one of them meant reading every card. */}
        {resultSubjects.length > 1 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setSubjectFilter(null)}
              className={`rounded-full border px-3 py-1.5 text-[12px] font-bold transition-colors ${
                subjectFilter === null
                  ? 'border-ss-accent bg-ss-accent text-white'
                  : 'border-ss-line bg-ss-panel text-ss-slate hover:border-ss-accent hover:text-ss-accent'
              }`}
            >
              All ({recentAssessments.length})
            </button>
            {resultSubjects.map(({ subject, count }) => (
              <button
                key={subject}
                type="button"
                onClick={() => setSubjectFilter(subject)}
                className={`max-w-[220px] truncate rounded-full border px-3 py-1.5 text-[12px] font-bold transition-colors ${
                  subjectFilter === subject
                    ? 'border-ss-accent bg-ss-accent text-white'
                    : 'border-ss-line bg-ss-panel text-ss-slate hover:border-ss-accent hover:text-ss-accent'
                }`}
              >
                {subject} ({count})
              </button>
            ))}
          </div>
        )}

        {visibleAssessments.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleAssessments.map((a, i) => (
              <motion.div key={a.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 * i }}>
                <AssessmentCard assessment={a} />
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-dashed border-black/10 py-16 text-center">
            <p className="text-sm font-black text-ss-ink">No results yet</p>
            <Link href="/practice" className="mt-2 inline-flex items-center gap-1 text-xs font-black text-ss-accent">
              Start practicing <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
      </section>

      <ProductTour id="progress" />
    </div>
  )
}
