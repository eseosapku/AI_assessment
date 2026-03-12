'use client'

import { motion } from 'framer-motion'
import { User, Plus, LogOut, Brain, TrendingUp, Award, Clock, Zap } from 'lucide-react'
import { useState, useEffect } from 'react'
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
  const [dailyUsed, setDailyUsed] = useState(0)
  const DAILY_QUIZ_LIMIT = 7200 // 14,400 Groq free requests / 2 per quiz
  const { user, logout } = useAuth()

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
          feedback: item.feedback?.text || 'No feedback available.'
        }))
        setRecentAssessments(formattedData)
        
        if (data.length > 0) {
          const avg = data.reduce((acc, curr) => acc + curr.score, 0) / data.length
          setStats({ total: data.length, avgScore: Math.round(avg) })
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

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0A0A0A] transition-colors duration-300 flex flex-col font-sans">
      {/* Premium Header */}
      <header className="glass dark:glass-dark sticky top-0 z-30 border-b border-gray-200/50 dark:border-gray-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0">
              {/* Brain Ink Logo */}
              <Image 
                src="/logo.png" 
                alt="Brain Ink Logo" 
                fill
                className="object-contain"
                priority
              />
            </div>
            <span className="text-lg sm:text-xl font-bold tracking-tight text-gray-900 dark:text-white">
              Brain Ink
            </span>
          </div>

          <div className="flex items-center gap-3 sm:gap-5">
            <ThemeToggle />
            <div className="h-6 w-px bg-gray-200 dark:bg-gray-800 hidden sm:block"></div>
            <motion.button
              onClick={() => setIsProfileOpen(true)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 sm:gap-3 pl-2 sm:pl-0"
            >
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-sm font-medium text-gray-900 dark:text-white">{user?.name || 'Student'}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">Pro Member</span>
              </div>
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-tr from-blue-600 to-blue-400 flex items-center justify-center shadow-sm border border-white/20">
                <User className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
            </motion.button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 w-full">
        
        {/* Welcome & Stats Section */}
        <div className="mb-10 sm:mb-12">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">
            Welcome back, {user?.name?.split(' ')[0] || 'Student'}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-base sm:text-lg mb-8">
            Ready to continue your learning journey?
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            <motion.div 
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="card p-6 flex items-center gap-4"
            >
              <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <Brain className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Assessments</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="card p-6 flex items-center gap-4"
            >
              <div className="w-12 h-12 rounded-2xl bg-green-50 dark:bg-green-900/20 flex items-center justify-center text-green-600 dark:text-green-400">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Average Score</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.avgScore}%</p>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              className="card p-6 flex items-center gap-4"
            >
              <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-purple-600 dark:text-purple-400">
                <Award className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Current Status</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">Active</p>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Daily AI Quota Bar */}
        {(() => {
          const pct = Math.min((dailyUsed / DAILY_QUIZ_LIMIT) * 100, 100)
          const remaining = Math.max(DAILY_QUIZ_LIMIT - dailyUsed, 0)
          const barColor = pct < 50 ? 'bg-green-500' : pct < 80 ? 'bg-amber-500' : 'bg-red-500'
          const textColor = pct < 50 ? 'text-green-600 dark:text-green-400' : pct < 80 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'
          return (
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
              className="card p-5 sm:p-6 mb-6 sm:mb-8"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Daily AI Quota</span>
                </div>
                <span className={`text-sm font-bold ${textColor}`}>
                  {remaining.toLocaleString()} quizzes left today
                </span>
              </div>
              <div className="w-full h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                  className={`h-full rounded-full ${barColor}`}
                />
              </div>
              <div className="flex justify-between mt-2">
                <span className="text-xs text-gray-400">{dailyUsed.toLocaleString()} used</span>
                <span className="text-xs text-gray-400">{DAILY_QUIZ_LIMIT.toLocaleString()} daily limit (Groq free tier)</span>
              </div>
            </motion.div>
          )
        })()}

        {/* Quick Action */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mb-10 sm:mb-12"
        >
          <motion.button
            onClick={() => setIsFormOpen(true)}
            whileHover={{ scale: 1.01, y: -2 }}
            whileTap={{ scale: 0.99 }}
            className="w-full p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-blue-600 to-blue-800 text-white shadow-lg shadow-blue-900/20 flex items-center justify-between group transition-all"
          >
            <div className="flex items-center gap-4 sm:gap-6 text-left">
              <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center group-hover:scale-110 transition-transform">
                <Plus className="w-7 h-7 text-white" />
              </div>
              <div>
                <h3 className="text-xl sm:text-2xl font-bold mb-1">Start New Assessment</h3>
                <p className="text-blue-100 text-sm sm:text-base">Generate a personalized AI test in seconds</p>
              </div>
            </div>
            <div className="hidden sm:flex items-center justify-center w-10 h-10 rounded-full bg-white/10 group-hover:bg-white/20 transition-colors">
              <span className="text-xl">→</span>
            </div>
          </motion.button>
        </motion.div>

        {/* Recent Assessments */}
        <div className="pb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Recent Activity</h2>
            <button className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline">View All</button>
          </div>
          
          {recentAssessments.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
              {recentAssessments.map((assessment, index) => (
                <motion.div
                  key={assessment.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + (index * 0.1) }}
                >
                  <AssessmentCard assessment={assessment} />
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 card border-dashed border-2 border-gray-300 dark:border-gray-700 bg-transparent shadow-none">
              <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No assessments yet</h3>
              <p className="text-gray-500 dark:text-gray-400">Start your first assessment to see your progress here.</p>
            </div>
          )}
        </div>

        {/* Footer Info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-8 pt-8 border-t border-gray-200/60 dark:border-gray-800/60 flex flex-col sm:flex-row items-center justify-between gap-4"
        >
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <Brain className="w-4 h-4" />
            <span>Powered by Brain Ink AI</span>
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            © {new Date().getFullYear()} Brain Ink. All rights reserved.
          </div>
        </motion.div>
      </div>

      {/* Profile Sidebar */}
      <ProfileSidebar isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />

      {/* Flow Form Modal */}
      {isFormOpen && <FlowForm onClose={() => setIsFormOpen(false)} />}
    </div>
  )
}
