'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { User, Plus, Brain, Clock, Zap, ChevronDown, Users, FileText, Target, Sparkles } from 'lucide-react'
import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import ThemeToggle from './ThemeToggle'
import ProfileSidebar from './ProfileSidebar'
import AssessmentCard from './AssessmentCard'
import FlowForm from './FlowForm'
import TeacherDashboard from './TeacherDashboard'
import { useAuth } from './AuthProvider'
import { useSubscription } from './SubscriptionProvider'

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20',
  average: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20',
  intermediate: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20',
  advanced: 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20',
}

const PAUSED_ASSESSMENT_KEY = 'pausedAssessmentState'
const RESUME_ASSESSMENT_KEY = 'resumeAssessment'

interface PausedAssessmentState {
  assessment: {
    subject: string
    topics: string[]
    questions: { id?: number }[]
    estimated_time: number
  }
  currentQuestion: number
  timeRemaining: number
  pausedAt: string
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isUuid(value: string | null | undefined) {
  return UUID_RE.test(String(value ?? ''))
}

export default function Dashboard() {
  const { user } = useAuth()

  // Route teachers to their own dashboard
  if (user?.role === 'teacher') return <TeacherDashboard />

  return <StudentDashboard />
}

function StudentDashboard() {
  const router = useRouter()
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [recentAssessments, setRecentAssessments] = useState<any[]>([])
  const [stats, setStats] = useState({ total: 0, avgScore: 0 })
  const [subjectAverages, setSubjectAverages] = useState<{ subject: string; avg: number; count: number }[]>([])
  const [showAvgDropdown, setShowAvgDropdown] = useState(false)
  const avgRef = useRef<HTMLDivElement>(null)
  const [dailyUsed, setDailyUsed] = useState(0)
  const [classrooms, setClassrooms] = useState<any[]>([])
  const [isLoadingClassrooms, setIsLoadingClassrooms] = useState(false)
  const [pausedAssessment, setPausedAssessment] = useState<PausedAssessmentState | null>(null)
  const DAILY_QUIZ_LIMIT = 7200
  const { user } = useAuth()
  const { snapshot, openPaywall } = useSubscription()

  const refreshClassrooms = useCallback(async () => {
    if (!user?.id && !user?.email) return
    setIsLoadingClassrooms(true)
    try {
      const params = new URLSearchParams()
      if (isUuid(user?.id)) params.set('student_id', user?.id ?? '')
      if (user?.email) params.set('student_email', user.email)
      const res = await fetch(`/api/classrooms?${params.toString()}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load classrooms')
      setClassrooms(json.data ?? [])
    } catch (err) {
      console.error('Classrooms fetch error:', err)
      setClassrooms([])
    } finally {
      setIsLoadingClassrooms(false)
    }
  }, [user])

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user?.id || !isUuid(user.id)) {
        setRecentAssessments([])
        setStats({ total: 0, avgScore: 0 })
        setSubjectAverages([])
        setDailyUsed(0)
        return
      }

      try {
        const res = await fetch(`/api/dashboard/student?user_id=${encodeURIComponent(user.id)}`)
        const json = await res.json()
        if (!res.ok) {
          console.error('Error fetching dashboard data:', json.error)
          return
        }

        setRecentAssessments(json.data?.recentAssessments ?? [])
        setStats(json.data?.stats ?? { total: 0, avgScore: 0 })
        setSubjectAverages(json.data?.subjectAverages ?? [])
        setDailyUsed(json.data?.dailyUsed ?? 0)
      } catch (err) {
        console.error('Error fetching dashboard data:', err)
      }
    }
    fetchDashboardData()

    refreshClassrooms()
  }, [user, refreshClassrooms])

  useEffect(() => {
    if (!user?.id || user?.role === 'teacher' || !isUuid(user.id)) return
    const intervalSeconds = 60
    const tick = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        await fetch('/api/activity/ping', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: user.id, seconds: intervalSeconds }),
        })
      } catch {
        // Ignore activity ping errors silently.
      }
    }

    const timer = window.setInterval(tick, intervalSeconds * 1000)
    return () => window.clearInterval(timer)
  }, [user])

  useEffect(() => {
    if (!showAvgDropdown) return
    const handleClick = (e: MouseEvent) => {
      if (avgRef.current && !avgRef.current.contains(e.target as Node)) setShowAvgDropdown(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showAvgDropdown])

  useEffect(() => {
    const loadPaused = () => {
      try {
        const raw = localStorage.getItem(PAUSED_ASSESSMENT_KEY)
        if (!raw) {
          setPausedAssessment(null)
          return
        }
        const parsed = JSON.parse(raw) as PausedAssessmentState
        if (!parsed?.assessment?.subject) {
          setPausedAssessment(null)
          return
        }
        setPausedAssessment(parsed)
      } catch {
        setPausedAssessment(null)
      }
    }

    loadPaused()
    const handleStorage = (event: StorageEvent) => {
      if (event.key === PAUSED_ASSESSMENT_KEY) loadPaused()
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  const quotaPct = Math.min((dailyUsed / DAILY_QUIZ_LIMIT) * 100, 100)
  const remaining = Math.max(DAILY_QUIZ_LIMIT - dailyUsed, 0)
  const quotaBarColor = quotaPct < 50 ? 'bg-emerald-400' : quotaPct < 80 ? 'bg-amber-400' : 'bg-red-400'
  const quotaTextColor = quotaPct < 50 ? 'text-emerald-300' : quotaPct < 80 ? 'text-amber-300' : 'text-red-300'
  const firstName = user?.name?.split(' ')[0] || 'Student'

  const formatRemaining = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.max(0, seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleResumePaused = () => {
    sessionStorage.setItem(RESUME_ASSESSMENT_KEY, 'true')
    router.push('/assessment')
  }

  const handleDiscardPaused = () => {
    localStorage.removeItem(PAUSED_ASSESSMENT_KEY)
    setPausedAssessment(null)
  }

  return (
    <div className="min-h-screen bg-[#F3F4F6] dark:bg-[#0C0C0E] transition-colors duration-300 flex flex-col">

      {/* ── Header ── */}
      <header className="sticky top-0 z-30 h-14 bg-white/75 dark:bg-[#0C0C0E]/80 backdrop-blur-xl header-fade">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 h-full flex items-center justify-between">
          <Image src="/logo2.png" alt="Brain Ink" width={140} height={80} className="h-10 w-auto object-contain" priority />
          <div className="flex items-center gap-2">
            {!snapshot.isSubscribed && (
              <button
                type="button"
                onClick={() => openPaywall('assessment')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-semibold hover:opacity-90 transition-opacity"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Subscribe
              </button>
            )}
            <ThemeToggle />
            <div className="w-px h-4 bg-gray-200 dark:bg-gray-800 mx-1" />
            <button
              onClick={() => setIsProfileOpen(true)}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center">
                <User className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 hidden sm:block">{firstName}</span>
              <ChevronDown className="w-3.5 h-3.5 text-ss-slate hidden sm:block" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-8 py-6 w-full space-y-4">

        {/* ── HERO PANEL ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl bg-[#0F172A] dark:bg-[#080B14] p-7 sm:p-10"
        >
          {/* Grid background */}
          <div className="absolute inset-0 pointer-events-none" style={{
            backgroundImage: 'linear-gradient(rgba(59,130,246,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.12) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }} />
          {/* Glow orbs */}
          <div className="absolute -top-20 -right-20 w-72 h-72 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-10 left-20 w-48 h-48 bg-violet-600/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative">
            <p className="text-[12px] font-bold uppercase tracking-[0.25em] text-blue-400 mb-3">Dashboard</p>
            <h1 className="text-4xl sm:text-5xl font-black text-white leading-none mb-8 tracking-tight">
              {firstName}<span className="text-blue-500">.</span>
            </h1>

            {/* Stats row */}
            <div className="flex flex-wrap items-end gap-x-8 gap-y-5">

              {/* Total */}
              <div>
                <p className="text-3xl sm:text-4xl font-black text-white tabular-nums leading-none">{stats.total}</p>
                <p className="text-[12px] font-semibold uppercase tracking-widest text-slate-500 mt-1.5">Tests done</p>
              </div>

              <div className="w-px h-10 bg-white/10 hidden sm:block self-end mb-2" />

              {/* Avg — clickable dropdown */}
              <div ref={avgRef} className="relative">
                <button
                  onClick={() => setShowAvgDropdown(v => !v)}
                  className="text-left group"
                >
                  <p className={`text-3xl sm:text-4xl font-black tabular-nums leading-none transition-colors ${showAvgDropdown ? 'text-blue-400' : 'text-white group-hover:text-blue-400'}`}>
                    {stats.avgScore}%
                  </p>
                  <p className="text-[12px] font-semibold uppercase tracking-widest text-slate-500 mt-1.5 flex items-center gap-1">
                    Avg score
                    <ChevronDown className={`w-3 h-3 text-slate-500 transition-transform duration-200 ${showAvgDropdown ? 'rotate-180 text-blue-400' : ''}`} />
                  </p>
                </button>

                <AnimatePresence>
                  {showAvgDropdown && subjectAverages.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.97 }}
                      transition={{ duration: 0.13 }}
                      onClick={e => e.stopPropagation()}
                      className="absolute top-full left-0 mt-3 w-72 z-50 rounded-2xl shadow-2xl shadow-black/40 border border-white/10 bg-[#151C2C] overflow-hidden"
                    >
                      <div className="px-4 py-3 border-b border-white/5">
                        <p className="text-[12px] font-bold uppercase tracking-widest text-slate-400">By Subject</p>
                      </div>
                      <div className="divide-y divide-white/5 max-h-52 overflow-y-auto">
                        {subjectAverages.map(({ subject, avg, count }) => (
                          <div key={subject} className="flex items-center gap-3 px-4 py-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-white truncate">{subject}</p>
                              <p className="text-[12px] text-slate-500 mt-0.5">{count} test{count !== 1 ? 's' : ''}</p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <div className="w-20 h-1 bg-white/10 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${avg >= 70 ? 'bg-emerald-400' : avg >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                                  style={{ width: `${avg}%` }}
                                />
                              </div>
                              <span className={`text-xs font-black tabular-nums w-9 text-right ${avg >= 70 ? 'text-emerald-400' : avg >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                                {avg}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="w-px h-10 bg-white/10 hidden sm:block self-end mb-2" />

              {/* Quota inline */}
              <div className="flex-1 min-w-[180px]">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[12px] font-semibold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                    <Zap className="w-3 h-3" />Daily quota
                  </p>
                  <p className={`text-[12px] font-black tabular-nums ${quotaTextColor}`}>{remaining.toLocaleString()} left</p>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${quotaPct}%` }}
                    transition={{ duration: 1.2, ease: 'easeOut' }}
                    className={`h-full rounded-full ${quotaBarColor}`}
                  />
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {pausedAssessment && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-amber-200/60 dark:border-amber-800/40 bg-amber-50/80 dark:bg-amber-900/10 p-5"
          >
            <div className="min-w-0">
              <p className="text-[12px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">Paused assessment</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                {pausedAssessment.assessment.subject}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {(pausedAssessment.assessment.topics?.length
                  ? pausedAssessment.assessment.topics.join(', ')
                  : 'General')}{' '}
                · Q{Math.min(pausedAssessment.currentQuestion + 1, pausedAssessment.assessment.questions.length)}/
                {pausedAssessment.assessment.questions.length} · {formatRemaining(pausedAssessment.timeRemaining)} left
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleResumePaused}
                className="px-5 py-2.5 rounded-xl text-base font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-sm"
              >
                Resume
              </button>
              <button
                onClick={handleDiscardPaused}
                className="px-5 py-2.5 rounded-xl text-base font-bold bg-white dark:bg-gray-900 border border-amber-200/60 dark:border-amber-800/40 text-amber-700 dark:text-amber-300 hover:bg-amber-50/60 dark:hover:bg-amber-900/20"
              >
                Discard
              </button>
            </div>
          </motion.div>
        )}

        {/* ── CTA ── */}
        <div className={`grid gap-4 ${user?.country === 'NG' ? 'sm:grid-cols-2' : ''}`}>
        <motion.button
          onClick={() => setIsFormOpen(true)}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          whileHover={{ scale: 1.005 }}
          whileTap={{ scale: 0.997 }}
          className="w-full group relative overflow-hidden rounded-2xl flex items-center justify-between px-8 py-7 sm:py-8 bg-gradient-to-r from-blue-600 via-blue-700 to-violet-700 shadow-xl shadow-blue-900/30 text-white"
        >
          {/* Shimmer sweep on hover */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />
          <div className="relative text-left">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-200/80 mb-1">AI-Powered</p>
            <h3 className="text-2xl sm:text-3xl font-black leading-tight">Start New Assessment</h3>
          </div>
          <div className="relative flex items-center gap-3 flex-shrink-0">
            <div className="hidden sm:block">
              <p className="text-base font-bold text-blue-200">Generate</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-white/15 flex items-center justify-center group-hover:bg-white/25 transition-colors">
              <Plus className="w-6 h-6 text-white" />
            </div>
          </div>
        </motion.button>

        {user?.country === 'NG' && (
          <motion.button
            onClick={() => router.push('/exam-prep')}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            whileHover={{ scale: 1.005 }}
            whileTap={{ scale: 0.997 }}
            className="w-full group relative overflow-hidden rounded-2xl flex items-center justify-between px-8 py-7 sm:py-8 bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-700 shadow-xl shadow-emerald-900/30 text-white"
          >
            <div className="relative text-left">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-200/80 mb-1">WAEC &amp; JAMB</p>
              <h3 className="text-2xl sm:text-3xl font-black leading-tight">Exam Prep Hub</h3>
              <p className="text-sm text-emerald-100/80 mt-1">Separate WASSCE &amp; UTME practice</p>
            </div>
            <div className="relative w-12 h-12 rounded-full bg-white/15 flex items-center justify-center group-hover:bg-white/25 transition-colors">
              <Target className="w-6 h-6 text-white" />
            </div>
          </motion.button>
        )}
        </div>

        {/* ── Report Card CTA ── */}
        <motion.button
          onClick={() => router.push('/report-card')}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          whileHover={{ scale: 1.005 }}
          whileTap={{ scale: 0.997 }}
          className="w-full group relative overflow-hidden rounded-2xl flex items-center justify-between px-8 py-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/5 shadow-sm text-gray-800 dark:text-white"
        >
          <div className="relative text-left">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-violet-500 mb-1">Official Document</p>
            <h3 className="text-xl sm:text-2xl font-black leading-tight">Generate Report Card</h3>
            <p className="text-sm text-ss-slate dark:text-gray-500 mt-0.5">Select assessments &amp; export a professional report card</p>
          </div>
          <div className="relative flex items-center gap-3 flex-shrink-0">
            <div className="w-12 h-12 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center group-hover:bg-violet-200 dark:group-hover:bg-violet-800/40 transition-colors">
              <FileText className="w-6 h-6 text-violet-600 dark:text-violet-400" />
            </div>
          </div>
        </motion.button>

        {/* ── Your Classes ── */}
        <div>
          <div className="flex items-center gap-2 mb-4 px-1">
            <Users className="w-3.5 h-3.5 text-violet-500" />
            <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-ss-slate dark:text-gray-500">
              Your Classes
            </p>
          </div>
          {isLoadingClassrooms ? (
            <div className="flex items-center justify-center py-12 rounded-2xl border border-gray-200/60 dark:border-gray-800/60 bg-white dark:bg-gray-900">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : classrooms.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {classrooms.map((room: any, i) => (
                <motion.button
                  key={room.classroom_id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.04 * i }}
                  onClick={() => router.push(`/classrooms/${room.classroom_id}`)}
                  className="text-left bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/60 dark:border-gray-800/60 p-5 flex flex-col gap-3 hover:border-blue-400/60 hover:shadow-sm transition-all"
                >
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{room.name}</p>
                    {room.description && (
                      <p className="text-xs text-ss-slate mt-1 line-clamp-2">{room.description}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/40 py-2">
                      <p className="text-xs text-blue-600 dark:text-blue-300 font-bold">{room.upcoming_count ?? 0}</p>
                      <p className="text-[12px] text-blue-500">Upcoming</p>
                    </div>
                    <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/40 py-2">
                      <p className="text-xs text-amber-600 dark:text-amber-300 font-bold">{room.open_count ?? 0}</p>
                      <p className="text-[12px] text-amber-500">Open</p>
                    </div>
                    <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/40 py-2">
                      <p className="text-xs text-emerald-600 dark:text-emerald-300 font-bold">{room.finished_count ?? 0}</p>
                      <p className="text-[12px] text-emerald-500">Finished</p>
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800/60 bg-white/60 dark:bg-white/[0.02]">
              <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
                <Users className="w-5 h-5 text-ss-slate" />
              </div>
              <p className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">No classes yet</p>
              <p className="text-xs text-ss-slate text-center max-w-[200px] leading-relaxed">
                Classes appear here after your teacher adds you.
              </p>
            </div>
          )}
        </div>

        {/* ── Recent Assessments ── */}
        <div>
          <div className="flex items-center justify-between mb-4 px-1">
            <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-ss-slate dark:text-gray-500">
              Recent Activity
            </p>
            <button className="text-[12px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 hover:underline underline-offset-2">
              View all
            </button>
          </div>

          {recentAssessments.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentAssessments.map((assessment, index) => (
                <motion.div
                  key={assessment.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.04 * index, duration: 0.3 }}
                >
                  <AssessmentCard assessment={assessment} />
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800/60 bg-white/60 dark:bg-white/[0.02]">
              <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
                <Clock className="w-5 h-5 text-ss-slate" />
              </div>
              <p className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">No assessments yet</p>
              <p className="text-xs text-ss-slate text-center max-w-[200px] leading-relaxed">
                Generate your first AI test above to get started.
              </p>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between pt-6 border-t border-gray-200/60 dark:border-white/[0.04]">
          <div className="flex items-center gap-1.5 text-xs text-ss-slate">
            <Brain className="w-3.5 h-3.5" />
            <span>Powered by Brain Ink AI</span>
          </div>
          <span className="text-xs text-ss-slate">© {new Date().getFullYear()} Brain Ink</span>
        </div>

      </main>

      <ProfileSidebar isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
      {isFormOpen && <FlowForm onClose={() => setIsFormOpen(false)} />}
    </div>
  )
}
