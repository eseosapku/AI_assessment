'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { User, Plus, Brain, Clock, Zap, ChevronDown, Send, Calendar, BookOpen, FileText } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import ThemeToggle from './ThemeToggle'
import ProfileSidebar from './ProfileSidebar'
import AssessmentCard from './AssessmentCard'
import FlowForm from './FlowForm'
import TeacherDashboard from './TeacherDashboard'
import { useAuth } from './AuthProvider'
import { supabase } from '@/lib/supabase'

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner:     'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20',
  average:      'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20',
  intermediate: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20',
  advanced:     'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20',
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
  const [assignedAssessments, setAssignedAssessments] = useState<any[]>([])
  const DAILY_QUIZ_LIMIT = 7200
  const { user } = useAuth()

  useEffect(() => {
    const fetchRecentAssessments = async () => {
      if (!user?.id) return
      const { data, error } = await supabase
        .from('results')
        .select('*, assessments(subject, difficulty)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) { console.error('Error fetching assessments:', error); return }
      if (!data) return

      const formattedData = data.slice(0, 6).map(item => ({
        id: item.id,
        date: new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        subject: item.assessments?.subject || 'Assessment',
        topic: item.assessments?.difficulty || 'General',
        grade: item.percentage >= 90 ? 'A+' : item.percentage >= 80 ? 'A' : item.percentage >= 70 ? 'B+' : item.percentage >= 60 ? 'B' : item.percentage >= 50 ? 'C' : 'D',
        score: item.score,
        percentage: item.percentage ?? item.score,
        feedback: item.feedback?.text || 'No feedback available.',
        questions_data: item.questions_data ?? null,
        answers: item.answers ?? null,
        longform_grades: item.longform_grades ?? null,
      }))
      setRecentAssessments(formattedData)

      if (data.length > 0) {
        const avg = data.reduce((acc, curr) => acc + curr.score, 0) / data.length
        setStats({ total: data.length, avgScore: Math.round(avg) })
        const subjectMap: Record<string, number[]> = {}
        data.forEach(item => {
          const subj = item.assessments?.subject || 'Assessment'
          if (!subjectMap[subj]) subjectMap[subj] = []
          subjectMap[subj].push(item.score)
        })
        setSubjectAverages(
          Object.entries(subjectMap)
            .map(([subject, scores]) => ({ subject, avg: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length), count: scores.length }))
            .sort((a, b) => b.avg - a.avg)
        )
      }
    }
    fetchRecentAssessments()

    const fetchDailyUsage = async () => {
      const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0)
      const { count } = await supabase.from('assessments').select('*', { count: 'exact', head: true }).gte('created_at', startOfDay.toISOString())
      setDailyUsed(count || 0)
    }
    fetchDailyUsage()

    const fetchAssignedAssessments = async () => {
      if (!user?.email) return
      try {
        const res = await fetch(`/api/assignments/student?email=${encodeURIComponent(user.email)}`)
        const d = await res.json()
        setAssignedAssessments(d.assignments ?? [])
      } catch { /* non-critical */ }
    }
    fetchAssignedAssessments()
  }, [user])

  useEffect(() => {
    if (!showAvgDropdown) return
    const handleClick = (e: MouseEvent) => {
      if (avgRef.current && !avgRef.current.contains(e.target as Node)) setShowAvgDropdown(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showAvgDropdown])

  const quotaPct = Math.min((dailyUsed / DAILY_QUIZ_LIMIT) * 100, 100)
  const remaining = Math.max(DAILY_QUIZ_LIMIT - dailyUsed, 0)
  const quotaBarColor = quotaPct < 50 ? 'bg-emerald-400' : quotaPct < 80 ? 'bg-amber-400' : 'bg-red-400'
  const quotaTextColor = quotaPct < 50 ? 'text-emerald-300' : quotaPct < 80 ? 'text-amber-300' : 'text-red-300'
  const firstName = user?.name?.split(' ')[0] || 'Student'

  return (
    <div className="min-h-screen bg-[#F3F4F6] dark:bg-[#0C0C0E] transition-colors duration-300 flex flex-col">

      {/* ── Header ── */}
      <header className="sticky top-0 z-30 h-14 bg-white/75 dark:bg-[#0C0C0E]/80 backdrop-blur-xl border-b border-black/[0.06] dark:border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 h-full flex items-center justify-between">
          <Image src="/logo.png" alt="Brain Ink" width={120} height={68} className="h-8 w-auto object-contain" priority />
          <div className="flex items-center gap-2">
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
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 hidden sm:block" />
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
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-blue-400 mb-3">Dashboard</p>
            <h1 className="text-4xl sm:text-5xl font-black text-white leading-none mb-8 tracking-tight">
              {firstName}<span className="text-blue-500">.</span>
            </h1>

            {/* Stats row */}
            <div className="flex flex-wrap items-end gap-x-8 gap-y-5">

              {/* Total */}
              <div>
                <p className="text-3xl sm:text-4xl font-black text-white tabular-nums leading-none">{stats.total}</p>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mt-1.5">Tests done</p>
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
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mt-1.5 flex items-center gap-1">
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
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">By Subject</p>
                      </div>
                      <div className="divide-y divide-white/5 max-h-52 overflow-y-auto">
                        {subjectAverages.map(({ subject, avg, count }) => (
                          <div key={subject} className="flex items-center gap-3 px-4 py-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-white truncate">{subject}</p>
                              <p className="text-[11px] text-slate-500 mt-0.5">{count} test{count !== 1 ? 's' : ''}</p>
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
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                    <Zap className="w-3 h-3" />Daily quota
                  </p>
                  <p className={`text-[11px] font-black tabular-nums ${quotaTextColor}`}>{remaining.toLocaleString()} left</p>
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

        {/* ── CTA ── */}
        <motion.button
          onClick={() => setIsFormOpen(true)}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          whileHover={{ scale: 1.005 }}
          whileTap={{ scale: 0.997 }}
          className="w-full group relative overflow-hidden rounded-2xl flex items-center justify-between px-7 py-6 sm:py-7 bg-gradient-to-r from-blue-600 via-blue-700 to-violet-700 shadow-xl shadow-blue-900/30 text-white"
        >
          {/* Shimmer sweep on hover */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />
          <div className="relative text-left">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-blue-200/80 mb-1">AI-Powered</p>
            <h3 className="text-xl sm:text-2xl font-black leading-tight">Start New Assessment</h3>
          </div>
          <div className="relative flex items-center gap-3 flex-shrink-0">
            <div className="hidden sm:block">
              <p className="text-sm font-semibold text-blue-200">Generate</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center group-hover:bg-white/25 transition-colors">
              <Plus className="w-5 h-5 text-white" />
            </div>
          </div>
        </motion.button>

        {/* ── Report Card CTA ── */}
        <motion.button
          onClick={() => router.push('/report-card')}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          whileHover={{ scale: 1.005 }}
          whileTap={{ scale: 0.997 }}
          className="w-full group relative overflow-hidden rounded-2xl flex items-center justify-between px-7 py-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/5 shadow-sm text-gray-800 dark:text-white"
        >
          <div className="relative text-left">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-violet-500 mb-1">Official Document</p>
            <h3 className="text-lg sm:text-xl font-black leading-tight">Generate Report Card</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Select assessments &amp; export a professional report card</p>
          </div>
          <div className="relative flex items-center gap-3 flex-shrink-0">
            <div className="w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center group-hover:bg-violet-200 dark:group-hover:bg-violet-800/40 transition-colors">
              <FileText className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            </div>
          </div>
        </motion.button>

        {/* ── Assigned Assessments ── */}
        {assignedAssessments.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4 px-1">
              <Send className="w-3.5 h-3.5 text-violet-500" />
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500">
                Assigned by Teacher
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {assignedAssessments.map((a, i) => {
                const isExpired = a.deadline && new Date(a.deadline) < new Date()
                return (
                  <motion.div
                    key={a.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.04 * i }}
                    className="bg-white dark:bg-gray-900 rounded-2xl border border-violet-200/60 dark:border-violet-800/40 p-5 flex flex-col gap-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{a.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{a.subject} · Grade {a.grade}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-lg capitalize flex-shrink-0 ${DIFFICULTY_COLORS[a.difficulty_level] ?? 'text-gray-500 bg-gray-100 dark:bg-gray-800'}`}>
                        {a.difficulty_level}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <BookOpen className="w-3.5 h-3.5" />
                        {a.question_count}q · {a.question_type}
                      </span>
                      {a.deadline && (
                        <span className={`flex items-center gap-1 ${isExpired ? 'text-red-500' : 'text-gray-400'}`}>
                          <Calendar className="w-3.5 h-3.5" />
                          {isExpired ? 'Expired' : `Due ${new Date(a.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                        </span>
                      )}
                    </div>
                    <button
                      disabled={isExpired}
                      onClick={() => {
                        sessionStorage.setItem('assignmentConfig', JSON.stringify(a))
                        router.push('/assessment?assigned=1')
                      }}
                      className="mt-auto w-full py-2 rounded-xl text-xs font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-violet-600 hover:bg-violet-700 text-white"
                    >
                      {isExpired ? 'Deadline passed' : 'Start Assessment'}
                    </button>
                  </motion.div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Recent Assessments ── */}
        <div>
          <div className="flex items-center justify-between mb-4 px-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500">
              Recent Activity
            </p>
            <button className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 hover:underline underline-offset-2">
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
                <Clock className="w-5 h-5 text-gray-400" />
              </div>
              <p className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">No assessments yet</p>
              <p className="text-xs text-gray-400 text-center max-w-[200px] leading-relaxed">
                Generate your first AI test above to get started.
              </p>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between pt-6 border-t border-gray-200/60 dark:border-white/[0.04]">
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <Brain className="w-3.5 h-3.5" />
            <span>Powered by Brain Ink AI</span>
          </div>
          <span className="text-xs text-gray-400">© {new Date().getFullYear()} Brain Ink</span>
        </div>

      </main>

      <ProfileSidebar isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
      {isFormOpen && <FlowForm onClose={() => setIsFormOpen(false)} />}
    </div>
  )
}
