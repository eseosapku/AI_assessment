'use client'

import { motion } from 'framer-motion'
import { Eye, Calendar, BookOpen, Trophy } from 'lucide-react'
import { useState } from 'react'

interface Assessment {
  id: string
  date: string
  subject: string
  topic: string
  grade: string
  score: number
  feedback: string
}

interface AssessmentCardProps {
  assessment: Assessment
}

export default function AssessmentCard({ assessment }: AssessmentCardProps) {
  const [showFeedback, setShowFeedback] = useState(false)

  const getGradeColor = (grade: string) => {
    if (grade === 'A' || grade === 'A+') return 'text-green-500'
    if (grade === 'B' || grade === 'B+') return 'text-blue-500'
    if (grade === 'C') return 'text-yellow-500'
    return 'text-red-500'
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      className="card p-5 sm:p-6 relative group"
    >
      <div className="flex justify-between items-start mb-5">
        <div className="flex-1 min-w-0 pr-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-base sm:text-lg font-semibold truncate text-gray-900 dark:text-white">{assessment.subject}</h3>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 line-clamp-2 pl-10">{assessment.topic}</p>
          
          <div className="flex items-center gap-2 text-xs font-medium text-gray-400 dark:text-gray-500 pl-10">
            <Calendar className="w-3.5 h-3.5" />
            <span>{assessment.date}</span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          <div className={`text-2xl sm:text-3xl font-bold tracking-tight ${getGradeColor(assessment.grade)}`}>
            {assessment.grade}
          </div>
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-md">
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{assessment.score}%</span>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px w-full bg-gray-100 dark:bg-gray-800/60 mb-4"></div>

      {/* Action Area */}
      <div className="flex justify-between items-center">
        <span className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
          AI Analysis
        </span>
        <motion.button
          onClick={() => setShowFeedback(!showFeedback)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            showFeedback 
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' 
              : 'bg-gray-50 text-gray-600 hover:bg-blue-50 hover:text-blue-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-blue-900/20 dark:hover:text-blue-400'
          }`}
        >
          <Eye className="w-4 h-4" />
          {showFeedback ? 'Hide Feedback' : 'View Feedback'}
        </motion.button>
      </div>

      {/* Glassmorphic Feedback Dropdown */}
      {showFeedback && (
        <motion.div
          initial={{ opacity: 0, y: -10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.98 }}
          className="absolute top-full left-0 right-0 mt-3 p-5 glass dark:glass-dark rounded-2xl z-20 shadow-xl border border-gray-200/50 dark:border-gray-700/50"
        >
          <h4 className="font-semibold mb-3 flex items-center gap-2 text-gray-900 dark:text-white">
            <Trophy className="w-4 h-4 text-yellow-500" />
            Performance Insights
          </h4>
          <div className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed space-y-1">
            {assessment.feedback.split('\n').map((line, i) => {
              if (!line.trim()) return <div key={i} className="h-2"></div>
              const parts = line.split(/(\*\*.*?\*\*)/g)
              return (
                <div key={i}>
                  {parts.map((part, j) => {
                    if (part.startsWith('**') && part.endsWith('**')) {
                      return <strong key={j} className="font-bold text-gray-900 dark:text-white">{part.slice(2, -2)}</strong>
                    }
                    return part
                  })}
                </div>
              )
            })}
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}
