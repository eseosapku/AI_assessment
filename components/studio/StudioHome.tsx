'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  BookOpen,
  Clock,
  GraduationCap,
  Pause,
  Play,
  Sparkles,
  TrendingDown,
  Zap,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import AssessmentCard from '@/components/AssessmentCard'
import FlowForm from '@/components/FlowForm'
import { Marker } from '@/components/StudioPrimitives'
import { useAuth } from '@/components/AuthProvider'
import { useStudentDashboard } from '@/lib/hooks/useStudentDashboard'
import { openLearnSpace } from '@/lib/studylab/openSpace'
import type { PersonaSnapshot, WeakArea } from '@/lib/studylab/persona'

const DAILY_QUIZ_LIMIT = 7200
const RESUME_ASSESSMENT_KEY = 'resumeAssessment'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const STATUS_DOT: Record<string, string> = {
  gap: 'bg-red-500',
  developing: 'bg-amber-500',
  mastered: 'bg-brand-blue',
  not_assessed: 'bg-gray-400',
}

function formatRemaining(seconds: number) {
  const mins = Math.floor(seconds / 60)
  const secs = Math.max(0, seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export default function StudioHome() {
  const { user } = useAuth()
  const router = useRouter()
  const [formOpen, setFormOpen] = useState(false)
  const [persona, setPersona] = useState<PersonaSnapshot | null>(null)
  const {
    recentAssessments,
    stats,
    subjectAverages,
    classrooms,
    dailyUsed,
    loading,
    pausedAssessment,
    discardPaused,
  } = useStudentDashboard(user)

  // Pull the persona snapshot (weak areas + weekly summary) so Home can surface
  // what the gap map already computed.
  useEffect(() => {
    if (!user?.id || !UUID_RE.test(user.id)) {
      setPersona(null)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/studylab/persona?user_id=${encodeURIComponent(user.id)}`)
        const json = await res.json()
        if (!cancelled && res.ok) setPersona(json.data ?? null)
      } catch {
        if (!cancelled) setPersona(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user?.id])

  const firstName = user?.name?.split(' ')[0] ?? 'Student'
  const quotaPct = Math.min((dailyUsed / DAILY_QUIZ_LIMIT) * 100, 100)
  const latestGrade = recentAssessments[0]?.grade ?? '—'
  const isNG = user?.country === 'NG'

  const activeClasses = (classrooms as any[]).filter(
    (c) => (c.open_count ?? 0) > 0 || (c.upcoming_count ?? 0) > 0
  )
  const weakAreas = persona?.weakAreas ?? []
  const topSubjects = subjectAverages.slice(0, 5)

  const personaLine =
    persona?.hasHistory
      ? [
          `${persona.weekQuizzes} ${persona.weekQuizzes === 1 ? 'quiz' : 'quizzes'} this week`,
          persona.weekAvg != null ? `${persona.weekAvg}% avg` : null,
          persona.summary.gaps > 0
            ? `${persona.summary.gaps} ${persona.summary.gaps === 1 ? 'topic' : 'topics'} to work on`
            : null,
        ]
          .filter(Boolean)
          .join(' · ')
      : "Build a quiz when you're ready — everything else lives in Practice, Progress, and StudyLab."

  const handleResume = () => {
    sessionStorage.setItem(RESUME_ASSESSMENT_KEY, 'true')
    router.push('/assessment')
  }

  const startStudy = async (area: WeakArea) => {
    if (!user?.id) return
    try {
      const res = await fetch('/api/studylab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          title: `Mastering ${area.label}`,
          subject: area.subjectName,
          origin: 'gap',
          textbook_id: area.textbook_id,
          topic_id: area.topic_id,
          subtopic_id: area.subtopic_id ?? null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to start study')
      openLearnSpace(json.data.id, router)
    } catch (err) {
      console.error('Start study failed:', err)
    }
  }

  return (
    <div className="relative mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-10">
      {/* ── Hero: Create assessment stays the headline action ── */}
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
            <p className="mt-3 text-sm font-semibold text-white/70">{personaLine}</p>
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

      {/* ── Stat tiles ── */}
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

      {/* ── From your classes: teacher-assigned work ── */}
      {activeClasses.length > 0 && (
        <section className="mt-10">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-brand-slate">From your classes</p>
            <Link href="/classrooms" className="inline-flex items-center gap-1 text-xs font-black text-brand-blue hover:underline">
              All classes
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activeClasses.slice(0, 3).map((room: any) => (
              <button
                key={room.classroom_id}
                type="button"
                onClick={() => router.push(`/classrooms/${room.classroom_id}`)}
                className="group rounded-2xl border border-black/[0.06] bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-studio"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-sky/50">
                    <BookOpen className="h-5 w-5 text-brand-blue" />
                  </div>
                  <p className="min-w-0 flex-1 truncate font-display font-black text-brand-ink">{room.name}</p>
                </div>
                <div className="mt-4 flex items-center gap-3 text-xs font-bold">
                  <span className="text-brand-orange">{room.open_count ?? 0} open</span>
                  <span className="text-brand-slate">{room.upcoming_count ?? 0} upcoming</span>
                  <ArrowRight className="ml-auto h-4 w-4 text-brand-blue transition-transform group-hover:translate-x-0.5" />
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ── Focus areas + By subject ── */}
      {(weakAreas.length > 0 || topSubjects.length > 0) && (
        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          {weakAreas.length > 0 && (
            <section className="rounded-2xl border border-black/[0.06] bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-brand-blue" />
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-brand-slate">Focus areas</p>
              </div>
              <ul className="divide-y divide-black/[0.05]">
                {weakAreas.slice(0, 4).map((area) => (
                  <li key={`${area.kind}-${area.topic_id}-${area.subtopic_id ?? 't'}`} className="flex items-center gap-3 py-3">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_DOT[area.status] ?? STATUS_DOT.not_assessed}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-brand-ink">{area.label}</p>
                      <p className="truncate text-xs font-semibold text-brand-slate">
                        {area.subjectName}
                        {typeof area.accuracy === 'number' ? ` · ${area.accuracy}%` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => startStudy(area)}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-blue/10 px-3 py-1.5 text-xs font-bold text-brand-blue transition-colors hover:bg-brand-blue/15"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Study
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {topSubjects.length > 0 && (
            <section className="rounded-2xl border border-black/[0.06] bg-white p-5 shadow-sm">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.25em] text-brand-slate">By subject</p>
              <div className="space-y-3">
                {topSubjects.map((s) => {
                  const pct = Math.max(0, Math.min(100, Math.round(s.avg)))
                  const tone = pct >= 70 ? 'bg-emerald-500' : pct >= 45 ? 'bg-brand-orange' : 'bg-red-500'
                  return (
                    <div key={s.subject}>
                      <div className="mb-1 flex items-center justify-between gap-2 text-xs font-bold">
                        <span className="min-w-0 truncate text-brand-ink">{s.subject}</span>
                        <span className="shrink-0 tabular-nums text-brand-slate">{pct}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-brand-paper">
                        <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
              <Link href="/progress" className="mt-4 inline-flex items-center gap-1 text-xs font-black text-brand-blue hover:underline">
                Full progress
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </section>
          )}
        </div>
      )}

      {/* ── Exam prep (countries that have it) ── */}
      {isNG && (
        <Link
          href="/exam-prep"
          className="group mt-10 flex items-center gap-4 rounded-2xl border border-black/[0.06] bg-gradient-to-r from-brand-ink to-brand-blue p-5 text-white shadow-sm transition-transform hover:-translate-y-0.5"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15">
            <GraduationCap className="h-6 w-6 text-brand-sky" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-black">WAEC & JAMB prep</p>
            <p className="text-sm font-semibold text-white/70">Past-paper style practice for your national exams.</p>
          </div>
          <ArrowRight className="h-5 w-5 shrink-0 text-brand-sky transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}

      {/* ── Recent results ── */}
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
