'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  Clock,
  Pause,
  Play,
  Sparkles,
  Zap,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import AssessmentCard from '@/components/AssessmentCard'
import FlowForm from '@/components/FlowForm'
import { Marker } from '@/components/StudioPrimitives'
import { useAuth } from '@/components/AuthProvider'
import { useStudentDashboard } from '@/lib/hooks/useStudentDashboard'

const DAILY_QUIZ_LIMIT = 7200
const RESUME_ASSESSMENT_KEY = 'resumeAssessment'

function formatRemaining(seconds: number) {
  const mins = Math.floor(seconds / 60)
  const secs = Math.max(0, seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export default function StudioHome() {
  const { user } = useAuth()
  const router = useRouter()
  const [formOpen, setFormOpen] = useState(false)
  const {
    recentAssessments,
    stats,
    dailyUsed,
    loading,
    pausedAssessment,
    discardPaused,
  } = useStudentDashboard(user)

  const firstName = user?.name?.split(' ')[0] ?? 'Student'
  const quotaPct = Math.min((dailyUsed / DAILY_QUIZ_LIMIT) * 100, 100)
  const latestGrade = recentAssessments[0]?.grade ?? '—'

  const handleResume = () => {
    sessionStorage.setItem(RESUME_ASSESSMENT_KEY, 'true')
    router.push('/assessment')
  }

  return (
    <div className="relative mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-10">
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-brand-ink via-[#1a2744] to-brand-blue p-8 sm:p-12 shadow-studio text-white"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              'linear-gradient(rgba(77,124,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(77,124,255,0.15) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
            <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-brand-sky">Home</p>
            <h1 className="mt-2 font-display text-4xl font-black leading-tight tracking-[-0.04em] sm:text-5xl">
              Hey <Marker tone="blue">{firstName}</Marker>
            </h1>
            <p className="mt-3 text-sm font-semibold text-white/70">
              Build a quiz when you&apos;re ready — everything else lives in Practice, Progress, and StudyLab.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="group inline-flex w-full items-center justify-center gap-2.5 rounded-2xl bg-white px-7 py-4 text-base font-black text-brand-ink shadow-sm ring-1 ring-black/5 transition-colors hover:bg-brand-sky/40 lg:w-auto"
          >
            <Sparkles className="h-5 w-5 text-brand-blue" />
            <span>Create assessment</span>
            <ArrowRight className="h-4 w-4 text-brand-blue transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      </motion.section>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Tests done', value: loading ? '—' : String(stats.total) },
          { label: 'Avg score', value: loading ? '—' : `${stats.avgScore}%`, accent: true },
          { label: 'Latest grade', value: latestGrade },
          {
            label: 'Daily quota',
            value: loading ? '—' : `${Math.max(DAILY_QUIZ_LIMIT - dailyUsed, 0).toLocaleString()}`,
            sub: 'left today',
          },
        ].map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 * i }}
            className="rounded-2xl border border-black/[0.06] bg-white p-4 shadow-sm sm:p-5"
          >
            <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-brand-slate">
              {item.label === 'Daily quota' && <Zap className="h-3 w-3 text-brand-blue" />}
              {item.label}
            </p>
            <p className={`mt-1 font-display text-2xl font-black tabular-nums sm:text-3xl ${item.accent ? 'text-brand-blue' : 'text-brand-ink'}`}>
              {item.value}
            </p>
            {item.sub && <p className="text-[10px] font-semibold text-brand-slate">{item.sub}</p>}
            {item.label === 'Daily quota' && (
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-brand-paper">
                <div className="h-full rounded-full bg-brand-blue" style={{ width: `${quotaPct}%` }} />
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {pausedAssessment && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 flex flex-col gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-amber-700">
              <Pause className="h-3.5 w-3.5" />
              Paused assessment
            </p>
            <p className="mt-1 truncate font-display text-xl font-black text-brand-ink">{pausedAssessment.assessment.subject}</p>
            <p className="mt-1 text-xs font-semibold text-brand-slate">
              {formatRemaining(pausedAssessment.timeRemaining)} left · Q{pausedAssessment.currentQuestion + 1}
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={handleResume} className="btn-primary !py-2.5 !px-5">
              <Play className="h-4 w-4" />
              Resume
            </button>
            <button type="button" onClick={discardPaused} className="rounded-xl border border-amber-300 px-4 py-2.5 text-sm font-bold text-amber-800">
              Discard
            </button>
          </div>
        </motion.div>
      )}

      <section className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-brand-slate">Recent results</p>
          <Link href="/progress" className="inline-flex items-center gap-1 text-xs font-black text-brand-blue hover:underline">
            All progress
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {recentAssessments.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recentAssessments.slice(0, 6).map((assessment, i) => (
              <motion.div
                key={assessment.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.03 * i }}
              >
                <AssessmentCard assessment={assessment} />
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-black/10 bg-white/60 py-16">
            <Clock className="mb-3 h-8 w-8 text-brand-slate" />
            <p className="text-sm font-black text-brand-ink">No assessments yet</p>
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="mt-3 text-xs font-black text-brand-blue underline underline-offset-2"
            >
              Create your first assessment
            </button>
          </div>
        )}
      </section>

      {formOpen && <FlowForm onClose={() => setFormOpen(false)} />}
    </div>
  )
}
