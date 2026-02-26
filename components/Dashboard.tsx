'use client'

import { motion } from 'framer-motion'
import { User, Plus, LogOut } from 'lucide-react'
import { useState } from 'react'
import ThemeToggle from './ThemeToggle'
import ProfileSidebar from './ProfileSidebar'
import AssessmentCard from './AssessmentCard'
import FlowForm from './FlowForm'
import { useAuth } from './AuthProvider'

export default function Dashboard() {
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const { user, logout } = useAuth()

  const recentAssessments = [
    {
      id: '1',
      date: 'Feb 24, 2026',
      subject: 'Mathematics',
      topic: 'Calculus - Derivatives',
      grade: 'A',
      score: 92,
      feedback: 'Excellent work! You demonstrated a strong understanding of derivative rules and applications. Focus on implicit differentiation for even better results.'
    },
    {
      id: '2',
      date: 'Feb 22, 2026',
      subject: 'Physics',
      topic: 'Electromagnetism',
      grade: 'B+',
      score: 87,
      feedback: 'Good grasp of electromagnetic concepts. Pay more attention to the right-hand rule applications and magnetic field calculations.'
    },
    {
      id: '3',
      date: 'Feb 20, 2026',
      subject: 'Chemistry',
      topic: 'Organic Chemistry - Alkanes',
      grade: 'A+',
      score: 98,
      feedback: 'Outstanding! Your understanding of IUPAC nomenclature and structural formulas is exceptional. Keep up the excellent work.'
    },
    {
      id: '4',
      date: 'Feb 18, 2026',
      subject: 'Biology',
      topic: 'Cell Biology - Mitosis',
      grade: 'A',
      score: 91,
      feedback: 'Strong understanding of cell division processes. Consider reviewing the regulatory checkpoints for even deeper comprehension.'
    },
    {
      id: '5',
      date: 'Feb 16, 2026',
      subject: 'Computer Science',
      topic: 'Data Structures - Binary Trees',
      grade: 'B+',
      score: 88,
      feedback: 'Good grasp of tree traversal algorithms. Work on balancing techniques for improved performance understanding.'
    },
    {
      id: '6',
      date: 'Feb 14, 2026',
      subject: 'English',
      topic: 'Literary Analysis - Shakespeare',
      grade: 'A',
      score: 93,
      feedback: 'Excellent critical analysis skills. Your interpretation of themes and symbolism shows deep literary understanding.'
    }
  ]

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
