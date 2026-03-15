'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { User, Plus, Brain, TrendingUp, Clock, Zap, ChevronDown, BookOpen, BarChart2 } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import ThemeToggle from './ThemeToggle'
import ProfileSidebar from './ProfileSidebar'
import AssessmentCard from './AssessmentCard'
import FlowForm from './FlowForm'
import { useAuth } from './AuthProvider'
import { supabase } from '@/lib/supabase'

export default function Dashboard() {
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [recentAssessments, setRecentAssessments] = useState<any[]>([])
  const [stats, setStats] = useState({ total: 0, avgScore: 0 })
  const [subjectAverages, setSubjectAverages] = useState<{ subject: string; avg: number; count: number }[]>([])
  const [showAvgDropdown, setShowAvgDropdown] = useState(false)
  const avgRef = useRef<HTMLDivElement>(null)
  const [dailyUsed, setDailyUsed] = useState(0)
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

      if (error) {
        console.error('Error fetching assessments:', error)
      } else if (data) {
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
          const avgs = Object.entries(subjectMap)
            .map(([subject, scores]) => ({
              subject,
              avg: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
              count: scores.length,
            }))
            .sort((a, b) => b.avg - a.avg)
          setSubjectAverages(avgs)
        }
      }
    }

    fetchRecentAssessments()

    const fetchDailyUsage = async () => {
      const startOfDay = new Date()
      startOfDay.setHours(0, 0, 0, 0)
      const { count } = await supabase
        .from('assessments')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startOfDay.toISOString())
      setDailyUsed(count || 0)
    }

    fetchDailyUsage()
  }, [user])

  useEffect(() => {
    if (!showAvgDropdown) return
    function handleClick(e: MouseEvent) {
      if (avgRef.current && !avgRef.current.contains(e.target as Node)) {
        setShowAvgDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showAvgDropdown])

  const pct = Math.min((dailyUsed / DAILY_QUIZ_LIMIT) * 100, 100)
  const remaining = Math.max(DAILY_QUIZ_LIMIT - dailyUsed, 0)
  const quotaColor = pct < 50 ? 'bg-emerald-500' : pct < 80 ? 'bg-amber-500' : 'bg-red-500'
  const quotaTextColor = pct < 50 ? 'text-emerald-600 dark:text-emerald-400' : pct < 80 ? 'text-amber-600 dark:text-amber-400' : 'text-red-500'

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#0A0A0B] transition-colors duration-300 flex flex-col">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 h-14 bg-white/80 dark:bg-[#111113]/80 backdrop-blur-xl border-b border-gray-200/70 dark:border-gray-800/70">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-full flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="relative w-7 h-7 flex-shrink-0">
              <Image src="/logo.png" alt="Brain Ink" fill className="object-contain" priority />
            </div>
            <span className="text-sm font-bold tracking-tight text-gray-900 dark:text-white">Brain Ink</span>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <div className="h-4 w-px bg-gray-200 dark:bg-gray-700 mx-1" />
            <button
              onClick={() => setIsProfileOpen(true)}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800/60 transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-600 to-blue-400 flex items-center justify-center shadow-sm">
                <User className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 hidden sm:block">
                {user?.name?.split(' ')[0] || 'Student'}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 hidden sm:block" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Main ───────────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl mx-auto px-5 sm:px-8 py-8 w-full">

        {/* Welcome + Stat Pills */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5 mb-8">
          <div>
            <p className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1.5">
              Overview
            </p>
            <h1 className="text-2xl sm:text-[28px] font-bold text-gray-900 dark:text-white tracking-tight leading-none">
              {user?.name?.split(' ')[0] || 'Student'}&apos;s Dashboard
            </h1>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Total pill */}
            <div className="flex items-center gap-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-full px-3 py-1.5 shadow-sm">
              <BookOpen className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 tabular-nums">
                {stats.total} assessment{stats.total !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Avg score pill — dropdown */}
            <div ref={avgRef} className="relative">
              <button
                onClick={() => setShowAvgDropdown(v => !v)}
                className={`flex items-center gap-1.5 bg-white dark:bg-gray-900 border rounded-full px-3 py-1.5 shadow-sm transition-colors ${
                  showAvgDropdown
                    ? 'border-blue-400 dark:border-blue-600'
                    : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 tabular-nums">
                  {stats.avgScore}% avg
                </span>
                <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform duration-200 ${showAvgDropdown ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {showAvgDropdown && subjectAverages.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.97 }}
                    transition={{ duration: 0.13 }}
                    className="absolute top-full right-0 mt-2 w-72 z-40 rounded-2xl shadow-xl ring-1 ring-black/5 dark:ring-white/10 bg-white dark:bg-gray-900 overflow-hidden"
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
                      <BarChart2 className="w-3.5 h-3.5 text-gray-400" />
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Score by Subject
                      </p>
                    </div>
                    <div className="divide-y divide-gray-100 dark:divide-gray-800/60 max-h-56 overflow-y-auto">
                      {subjectAverages.map(({ subject, avg, count }) => (
                        <div key={subject} className="flex items-center gap-3 px-4 py-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{subject}</p>
                            <p className="text-[11px] text-gray-400 mt-0.5">{count} test{count !== 1 ? 's' : ''}</p>
                          </div>
                          <div className="flex items-center gap-2.5 flex-shrink-0">
                            <div className="w-20 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${avg >= 70 ? 'bg-emerald-500' : avg >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                                style={{ width: `${avg}%` }}
                              />
                            </div>
                            <span className={`text-xs font-bold tabular-nums w-9 text-right ${avg >= 70 ? 'text-emerald-600 dark:text-emerald-400' : avg >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-500'}`}>
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
          </div>
        </div>

        {/* Daily AI Quota */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800/80 rounded-2xl px-5 py-4 mb-5 flex items-center gap-4"
        >
          <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
            <Zap className="w-4 h-4 text-blue-500" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Daily AI Quota</span>
              <span className={`text-xs font-bold tabular-nums ${quotaTextColor}`}>
                {remaining.toLocaleString()} remaining
              </span>
            </div>
            <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
                className={`h-full rounded-full ${quotaColor}`}
              />
            </div>
          </div>
          <span className="text-[11px] text-gray-400 flex-shrink-0 tabular-nums hidden sm:block">
            {dailyUsed.toLocaleString()} / {DAILY_QUIZ_LIMIT.toLocaleString()}
          </span>
        </motion.div>

        {/* CTA */}
        <motion.button
          onClick={() => setIsFormOpen(true)}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          whileHover={{ scale: 1.005 }}
          whileTap={{ scale: 0.998 }}
          className="w-full mb-10 group relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 p-5 sm:p-6 flex items-center justify-between shadow-lg shadow-blue-900/25 text-white"
        >
          {/* Subtle dot grid texture */}
          <div className="absolute inset-0 opacity-[0.07]" style={{
            backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
            backgroundSize: '20px 20px'
          }} />
          <div className="flex items-center gap-4 text-left relative">
            <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center group-hover:bg-white/20 transition-colors flex-shrink-0">
              <Plus className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold leading-tight">Start New Assessment</h3>
              <p className="text-blue-200/90 text-sm mt-0.5">Generate a personalised AI test in seconds</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 relative flex-shrink-0">
            <span className="text-sm font-medium text-blue-200">Generate</span>
            <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center group-hover:bg-white/25 transition-colors">
              <span className="text-white text-base">→</span>
            </div>
          </div>
        </motion.button>

        {/* Recent Assessments */}
        <div>
          <div className="flex items-end justify-between mb-5">
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">Recent Assessments</h2>
              {recentAssessments.length > 0 && (
                <p className="text-xs text-gray-400 mt-0.5">
                  Last {recentAssessments.length} completed test{recentAssessments.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>
            <button className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline underline-offset-2">
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
                  transition={{ delay: 0.05 * index, duration: 0.3 }}
                >
                  <AssessmentCard assessment={assessment} />
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-gray-200 dark:border-gray-800/80 rounded-2xl bg-white/50 dark:bg-gray-900/30">
              <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
                <Clock className="w-5 h-5 text-gray-400" />
              </div>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">No assessments yet</p>
              <p className="text-xs text-gray-400 text-center max-w-[220px]">
                Hit &quot;Start New Assessment&quot; above to generate your first AI test.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-14 pt-6 border-t border-gray-200/60 dark:border-gray-800/60 flex items-center justify-between">
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
