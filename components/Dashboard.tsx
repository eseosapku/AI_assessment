'use client'

import { motion } from 'framer-motion'
import { User, Plus, LogOut } from 'lucide-react'
import { useState, useEffect } from 'react'
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
  const { user, logout } = useAuth()

  useEffect(() => {
    const fetchRecentAssessments = async () => {
      if (!user?.id) return

      const { data, error } = await supabase
        .from('results')
        .select('*, assessments(subject, difficulty)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(6)

      if (error) {
        console.error('Error fetching assessments:', error)
      } else if (data) {
        const formattedData = data.map(item => ({
          id: item.id,
          date: new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          subject: item.assessments?.subject || 'Assessment',
          topic: item.assessments?.difficulty || 'General',
          grade: item.percentage >= 90 ? 'A+' : item.percentage >= 80 ? 'A' : item.percentage >= 70 ? 'B+' : item.percentage >= 60 ? 'B' : item.percentage >= 50 ? 'C' : 'D',
          score: item.score,
          feedback: item.feedback?.text || 'No feedback available.'
        }))
        setRecentAssessments(formattedData)
      }
    }

    fetchRecentAssessments()
  }, [user])

  return (
    <div className="min-h-screen bg-apple-gray dark:bg-apple-black transition-colors duration-300 flex flex-col">
      {/* Header */}
      <header className="glass dark:glass-dark sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">AI Assessment</h1>
              <p className="text-xs sm:text-sm text-apple-dark-gray mt-1 hidden sm:block">
                Welcome back, {user?.name || 'Student'}
              </p>
            </div>

            <div className="flex items-center gap-2 sm:gap-4">
              <motion.button
                onClick={logout}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                title="Logout"
              >
                <LogOut className="w-5 h-5 text-apple-dark-gray" />
              </motion.button>
              <ThemeToggle />
              <motion.button
                onClick={() => setIsProfileOpen(true)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="w-10 h-10 rounded-full bg-gradient-to-br from-apple-blue to-blue-600 flex items-center justify-center"
              >
                <User className="w-5 h-5 text-white" />
              </motion.button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12 w-full">
        {/* Quick Action */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 sm:mb-8"
        >
          <motion.button
            onClick={() => setIsFormOpen(true)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full p-4 sm:p-6 lg:p-8 card flex items-center justify-center gap-2 sm:gap-3 text-apple-blue hover:bg-apple-blue hover:bg-opacity-5 transition-colors"
          >
            <Plus className="w-5 h-5 sm:w-6 sm:h-6" />
            <span className="text-base sm:text-lg font-semibold">Start New Assessment</span>
          </motion.button>
        </motion.div>

        {/* Recent Assessments */}
        <div className="pb-8">
          <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Recent Assessments</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {recentAssessments.map((assessment, index) => (
              <motion.div
                key={assessment.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <AssessmentCard assessment={assessment} />
              </motion.div>
            ))}
          </div>
        </div>

        {/* Footer Info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-800 text-center"
        >
          <p className="text-sm text-apple-dark-gray">
            Powered by AI • Total Assessments: {recentAssessments.length}
          </p>
        </motion.div>
      </div>

      {/* Profile Sidebar */}
      <ProfileSidebar isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />

      {/* Flow Form Modal */}
      {isFormOpen && <FlowForm onClose={() => setIsFormOpen(false)} />}
    </div>
  )
}
