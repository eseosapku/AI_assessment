'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, ClipboardCheck, Clock, GraduationCap, Medal, Pause, Play, Target, TrendingUp, Zap } from 'lucide-react'
import { useState, useEffect } from 'react'
import AssessmentCard from '@/components/AssessmentCard'
import FlowForm from '@/components/FlowForm'
import { useAuth } from '@/components/AuthProvider'
import { useStudentDashboard } from '@/lib/hooks/useStudentDashboard'
import { openLearnSpace } from '@/lib/studylab/openSpace'
import { subjectArt } from '@/lib/studio/subjectArt'
import { getFocus, type FocusId } from '@/lib/onboarding'
import type { PersonaSnapshot, WeakArea } from '@/lib/studylab/persona'
import {
  HeroBanner,
  ListPanel,
  ProgressRow,
  RingStat,
  SectionHeader,
  SparkButton,
  StatChip,
} from '@/components/studio/ui'

const DAILY_QUIZ_LIMIT = 7200
const RESUME_ASSESSMENT_KEY = 'resumeAssessment'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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
  const { recentAssessments, stats, subjectAverages, classrooms, dailyUsed, loading, pausedAssessment, discardPaused } =
    useStudentDashboard(user)

  // Pull the persona snapshot (weak areas + weekly summary) the gap map computed.
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
  const latestGrade = recentAssessments[0]?.grade ?? '—'
  const isNG = user?.country === 'NG'

  // Onboarding focus drives the hero's framing + primary action (read client-side).
  const [focus, setFocusState] = useState<FocusId | null>(null)
  useEffect(() => {
    setFocusState(getFocus(user?.id))
  }, [user?.id])

  type HeroCfg = { kicker: string; title: string; cta: string; tone: 'accent' | 'exam' | 'studylab'; action: () => void }
  const heroByFocus: Record<FocusId, HeroCfg> = {
    grades: { kicker: 'BOOST YOUR GRADES', title: 'Build an assessment and find your gaps', cta: 'Create assessment', tone: 'accent', action: () => setFormOpen(true) },
    exams: {
      kicker: 'EXAM READY',
      title: isNG ? 'Sharpen up for WAEC & JAMB' : 'Practice in real exam conditions',
      cta: isNG ? 'Start exam prep' : 'Start practice',
      tone: 'exam',
      action: () => router.push(isNG ? '/exam-prep' : '/practice'),
    },
    explore: { kicker: 'EXPLORE & LEARN', title: 'Learn any topic on a living canvas', cta: 'Open LearnSpace', tone: 'studylab', action: () => router.push('/studylab') },
  }
  const hero: HeroCfg = focus ? heroByFocus[focus] : { kicker: 'YOUR CURRICULUM, YOUR PACE', title: 'Build an assessment and find your gaps', cta: 'Create assessment', tone: 'accent', action: () => setFormOpen(true) }

  const activeClasses = (classrooms as any[]).filter((c) => (c.open_count ?? 0) > 0 || (c.upcoming_count ?? 0) > 0)
  const weakAreas = persona?.weakAreas ?? []
  const topSubjects = subjectAverages.slice(0, 5)
  const weekScores = recentAssessments
    .slice(0, 6)
    .map((a: any) => Number(a.percentage ?? a.score ?? 0))
    .reverse()

  const personaLine = persona?.hasHistory
    ? [
        `${persona.weekQuizzes} ${persona.weekQuizzes === 1 ? 'quiz' : 'quizzes'} this week`,
        persona.weekAvg != null ? `${persona.weekAvg}% avg` : null,
        persona.summary.gaps > 0 ? `${persona.summary.gaps} ${persona.summary.gaps === 1 ? 'topic' : 'topics'} to work on` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : null

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
    <div className="grid gap-6 xl:grid-cols-[1fr_312px]">
      {/* ── Main column ── */}
      <div className="flex min-w-0 flex-col gap-6">
        <HeroBanner
          kicker={hero.kicker}
          title={hero.title}
          ctaLabel={hero.cta}
          tone={hero.tone}
          onCta={hero.action}
        />
        {personaLine && <p className="-mt-3 text-[13px] font-semibold text-ss-slate">{personaLine}</p>}

        {/* First run. The most important moment in the product was also its
            emptiest screen: four zeros, an empty gap map and an empty deck,
            with nothing saying what would fill them. Statistics about nothing
            are worse than an invitation. */}
        {!loading && stats.total === 0 ? (
          <div className="rounded-[20px] border-2 border-dashed border-ss-line bg-ss-chip p-6 text-center sm:p-8">
            <h2 className="text-[18px] font-extrabold text-ss-ink">Nothing here yet — and that&apos;s the point</h2>
            <p className="mx-auto mt-2 max-w-md text-[14px] font-medium text-ss-slate">
              Take one quiz and this fills in: your score, the topics you found hard, and a gap map
              showing what to study next. It takes about five minutes.
            </p>
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-ss-accent px-6 py-3 text-[14px] font-extrabold text-white transition-opacity hover:opacity-90"
            >
              Take your first quiz
            </button>
          </div>
        ) : null}

        {/* Stat chips */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatChip icon={ClipboardCheck} value={loading ? '—' : String(stats.total)} label="Tests done" tone="accent" />
          <StatChip icon={TrendingUp} value={loading ? '—' : `${stats.avgScore}%`} label="Avg score" tone="good" />
          <StatChip icon={Medal} value={latestGrade} label="Latest grade" tone="warn" />
          <StatChip
            icon={Zap}
            value={loading ? '—' : `${Math.max(DAILY_QUIZ_LIMIT - dailyUsed, 0).toLocaleString()}`}
            label="Quota left"
            tone="neutral"
          />
        </div>

        {/* Resume paused */}
        {pausedAssessment && (
          <div className="flex flex-col gap-4 rounded-[20px] border border-[color:var(--ss-warn)]/40 bg-[color:var(--ss-warn)]/10 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-widest text-ss-warn">
                <Pause className="h-3.5 w-3.5" /> Paused assessment
              </p>
              <p className="mt-1 truncate text-[19px] font-extrabold text-ss-ink">{pausedAssessment.assessment.subject}</p>
              <p className="mt-1 text-xs font-semibold text-ss-slate">
                {formatRemaining(pausedAssessment.timeRemaining)} left · Q{pausedAssessment.currentQuestion + 1}
              </p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={handleResume} className="inline-flex items-center gap-2 rounded-full bg-ss-accent px-5 py-2.5 text-sm font-bold text-white">
                <Play className="h-4 w-4" /> Resume
              </button>
              <button type="button" onClick={discardPaused} className="rounded-xl border border-[color:var(--ss-warn)]/40 px-4 py-2.5 text-sm font-bold text-ss-warn">
                Discard
              </button>
            </div>
          </div>
        )}

        {/* From your classes */}
        {activeClasses.length > 0 && (
          <section>
            <SectionHeader title="From your classes" action={{ label: 'All classes', href: '/classrooms' }} />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {activeClasses.slice(0, 3).map((c) => (
                <button
                  key={c.classroom_id}
                  type="button"
                  onClick={() => router.push(`/classrooms/${c.classroom_id}`)}
                  className="group overflow-hidden rounded-[20px] border border-ss-line bg-ss-panel text-left transition-all hover:-translate-y-0.5 hover:shadow-ss-panel"
                >
                  <div className="relative h-20 overflow-hidden" style={{ background: 'linear-gradient(120deg,#0C74B4,#1AA0DC 55%,#3ED3F5)' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/art/classroom.png" alt="" aria-hidden className="absolute right-3 top-1/2 h-[92%] -translate-y-1/2 object-contain drop-shadow-lg" />
                    <span className="absolute left-3 top-3 rounded-full bg-white/25 px-2.5 py-1 text-[12px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
                      {(c.open_count ?? 0) > 0 ? `${c.open_count} open` : 'Upcoming'}
                    </span>
                  </div>
                  <div className="p-4">
                    <h3 className="truncate text-[14.5px] font-extrabold text-ss-ink">{c.name}</h3>
                    <p className="mt-1 text-[12px] font-semibold text-ss-slate">
                      {c.open_count ?? 0} open · {c.upcoming_count ?? 0} upcoming · {c.finished_count ?? 0} done
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* By subject */}
        {topSubjects.length > 0 && (
          <section>
            <SectionHeader title="By subject" action={{ label: 'Full progress', href: '/progress' }} />
            <div className="rounded-[20px] border border-ss-line bg-ss-panel px-5 py-1">
              {topSubjects.map((s) => (
                <ProgressRow key={s.subject} label={s.subject} pct={s.avg} trend={s.avg >= 50 ? 'up' : 'down'} art={subjectArt(s.subject)} />
              ))}
            </div>
          </section>
        )}

        {/* Exam prep (countries that have it) */}
        {isNG && (
          <Link
            href="/exam-prep"
            className="group flex items-center gap-4 rounded-[20px] border border-ss-line bg-ss-panel p-5 transition-all hover:-translate-y-0.5 hover:shadow-ss-panel"
          >
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-[color:var(--ss-warn)]/14 text-ss-warn">
              <GraduationCap className="h-6 w-6" strokeWidth={1.9} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-extrabold text-ss-ink">WAEC &amp; JAMB prep</p>
              <p className="text-[13px] font-semibold text-ss-slate">Past-paper style practice for your national exams.</p>
            </div>
            <ArrowRight className="h-5 w-5 shrink-0 text-ss-accent transition-transform group-hover:translate-x-0.5" />
          </Link>
        )}

        {/* Recent results */}
        <section>
          <SectionHeader title="Recent results" action={{ label: 'All progress', href: '/progress' }} />
          {recentAssessments.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {recentAssessments.slice(0, 6).map((assessment) => (
                <AssessmentCard key={assessment.id} assessment={assessment} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-[20px] border border-ss-line bg-ss-panel py-14 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/art/empty-state.png" alt="" className="mb-3 h-28 w-auto" />
              <p className="text-sm font-extrabold text-ss-ink">No assessments yet</p>
              <button type="button" onClick={() => setFormOpen(true)} className="mt-2 text-xs font-bold text-ss-accent underline underline-offset-2">
                Create your first assessment
              </button>
            </div>
          )}
        </section>
      </div>

      {/* ── Right rail ── */}
      <div className="flex flex-col gap-5">
        <RingStat pct={stats.avgScore} name={`Good work, ${firstName}`} sub={`${stats.avgScore}% average score`} userId={user?.id} />

        {weekScores.length > 0 && (
          <div className="rounded-[22px] border border-ss-line bg-ss-panel p-[18px]">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-extrabold text-ss-ink">Recent scores</p>
              <span className="text-[12px] font-semibold text-ss-slate">last {weekScores.length}</span>
            </div>
            <div className="mt-4 flex h-[120px] items-end gap-2.5">
              {weekScores.map((s, i) => {
                const v = Math.max(0, Math.min(100, s))
                const c = v >= 70 ? 'var(--ss-good)' : v >= 50 ? 'var(--ss-warn)' : 'var(--ss-bad)'
                const h = Math.max(4, Math.round((v / 100) * 92))
                return (
                  <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1.5">
                    <div className="w-full rounded-md" style={{ height: `${h}px`, background: c }} />
                    <span className="text-[12px] font-extrabold text-ss-slate">{s}%</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {weakAreas.length > 0 && (
          <ListPanel title="Focus areas" icon={Target}>
            {weakAreas.slice(0, 4).map((area) => (
              <div
                key={`${area.kind}-${area.topic_id}-${area.subtopic_id ?? 't'}`}
                className="flex items-center gap-3 border-b border-ss-line py-2.5 last:border-0"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={subjectArt(area.subjectName)} alt="" aria-hidden className="h-9 w-9 shrink-0 object-contain" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold text-ss-ink">{area.label}</p>
                  <p className="truncate text-[13px] font-semibold text-ss-slate">
                    {area.subjectName}
                    {typeof area.accuracy === 'number' ? ` · ${area.accuracy}%` : ''}
                  </p>
                </div>
                <SparkButton label="Study" onClick={() => startStudy(area)} />
              </div>
            ))}
          </ListPanel>
        )}
      </div>

      {formOpen && <FlowForm onClose={() => setFormOpen(false)} />}
    </div>
  )
}
