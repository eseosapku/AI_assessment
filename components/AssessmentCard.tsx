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
      className="card p-4 sm:p-6 relative"
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-base sm:text-lg font-semibold mb-2 truncate">{assessment.subject}</h3>
          <p className="text-xs sm:text-sm text-apple-dark-gray mb-3 line-clamp-2">{assessment.topic}</p>
          
          <div className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm text-apple-dark-gray">
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              <span>{assessment.date}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 sm:gap-2 ml-2">
          <div className={`text-2xl sm:text-3xl font-bold ${getGradeColor(assessment.grade)}`}>
            {assessment.grade}
          </div>
          <span className="text-xs sm:text-sm text-apple-dark-gray">{assessment.score}%</span>
        </div>
      </div>

      {/* Eye Icon for Feedback */}
      <div className="flex justify-end">
        <motion.button
          onClick={() => setShowFeedback(!showFeedback)}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className="p-2 rounded-full hover:bg-apple-blue hover:bg-opacity-10 transition-colors"
        >
          <Eye className="w-5 h-5 text-apple-blue" />
        </motion.button>
      </div>

      {/* Glassmorphic Feedback Dropdown */}
      {showFeedback && (
        <motion.div
          initial={{ opacity: 0, y: -10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          className="absolute top-full left-0 right-0 mt-2 p-4 glass dark:glass-dark rounded-apple z-10 shadow-apple-lg"
        >
          <h4 className="font-semibold mb-2 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-apple-blue" />
            AI Feedback
          </h4>
          <p className="text-sm text-apple-dark-gray leading-relaxed">
            {assessment.feedback}
          </p>
        </motion.div>
      )}
    </motion.div>
  )
}
