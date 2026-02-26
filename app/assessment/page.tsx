'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Clock, ChevronLeft, ChevronRight, Check } from 'lucide-react'

interface Question {
  id: number
  question: string
  options: string[]
  correct_answer: number
  feedback_text: string
}

interface Assessment {
  assessment_id: string
  estimated_time: number
  questions_array: Question[]
  subject: string
  topics: string[]
}

export default function AssessmentPage() {
  const router = useRouter()
  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({})
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [isSubmitted, setIsSubmitted] = useState(false)

  useEffect(() => {
    const data = sessionStorage.getItem('currentAssessment')
    if (data) {
      const assessmentData = JSON.parse(data)
      setAssessment(assessmentData)
      setTimeRemaining(assessmentData.estimated_time * 60) // Convert to seconds
    } else {
      router.push('/')
    }
  }, [router])

  useEffect(() => {
    if (timeRemaining > 0 && !isSubmitted) {
      const timer = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            handleSubmit()
            return 0
          }
          return prev - 1
        })
      }, 1000)

      return () => clearInterval(timer)
    }
  }, [timeRemaining, isSubmitted])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getTimerColor = () => {
    if (timeRemaining < 120) return 'text-orange-500'
    return 'text-apple-blue'
  }

  const handleAnswerSelect = (optionIndex: number) => {
    setSelectedAnswers({
      ...selectedAnswers,
      [currentQuestion]: optionIndex
    })
  }

  const handleSubmit = async () => {
    setIsSubmitted(true)
    
    // Calculate score
    let correct = 0
    assessment?.questions_array.forEach((q, idx) => {
      if (selectedAnswers[idx] === q.correct_answer) {
        correct++
      }
    })

    const score = Math.round((correct / (assessment?.questions_array.length || 1)) * 100)
    const grade = score >= 90 ? 'A+' : score >= 80 ? 'A' : score >= 70 ? 'B+' : score >= 60 ? 'B' : score >= 50 ? 'C' : 'D'

    // Save results (would normally save to database)
    const result = {
      assessment_id: assessment?.assessment_id,
      score,
      grade,
      answers: selectedAnswers,
      completed_at: new Date().toISOString()
    }

    await fetch('/api/save-result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result)
    })

    // Show results or redirect
    setTimeout(() => {
      router.push('/')
    }, 2000)
  }

  if (!assessment) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-apple-blue mx-auto mb-4"></div>
          <p className="text-apple-dark-gray">Loading assessment...</p>
        </div>
      </div>
    )
  }

  const question = assessment.questions_array[currentQuestion]
  const progress = ((currentQuestion + 1) / assessment.questions_array.length) * 100

  return (
    <div className="min-h-screen bg-apple-gray dark:bg-apple-black flex flex-col">
      {/* Header */}
      <div className="glass dark:glass-dark sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex justify-between items-center gap-2">
            <div className="flex-1 min-w-0">
              <h1 className="text-base sm:text-lg font-semibold truncate">{assessment.subject}</h1>
              <p className="text-xs sm:text-sm text-apple-dark-gray truncate">{assessment.topics.join(', ')}</p>
            </div>

            <motion.div
              className={`flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 rounded-full glass dark:glass-dark ${getTimerColor()}`}
              animate={timeRemaining < 120 ? { scale: [1, 1.05, 1] } : {}}
              transition={{ repeat: Infinity, duration: 1 }}
            >
              <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="font-mono font-semibold text-sm sm:text-base">{formatTime(timeRemaining)}</span>
            </motion.div>
          </div>

          {/* Progress Bar */}
          <div className="mt-4 h-1 bg-gray-300 dark:bg-gray-700 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-apple-blue"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      </div>

      {/* Question Content */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-3xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentQuestion}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.3 }}
              className="card p-4 sm:p-6 lg:p-8"
            >
              {/* Question Number */}
              <div className="text-xs sm:text-sm text-apple-dark-gray mb-3 sm:mb-4">
                Question {currentQuestion + 1} of {assessment.questions_array.length}
              </div>

              {/* Question Text */}
              <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold mb-6 sm:mb-8 leading-relaxed">
                {question.question}
              </h2>

              {/* Options */}
              <div className="space-y-3 sm:space-y-4">
                {question.options.map((option, index) => (
                  <motion.button
                    key={index}
                    onClick={() => handleAnswerSelect(index)}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    className={`mcq-option w-full text-left ${
                      selectedAnswers[currentQuestion] === index ? 'selected' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        selectedAnswers[currentQuestion] === index
                          ? 'border-apple-blue bg-apple-blue'
                          : 'border-gray-300 dark:border-gray-600'
                      }`}>
                        {selectedAnswers[currentQuestion] === index && (
                          <Check className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                        )}
                      </div>
                      <span className="flex-1 text-sm sm:text-base">{option}</span>
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="flex justify-between items-center mt-4 sm:mt-6 gap-2">
            <motion.button
              onClick={() => setCurrentQuestion(Math.max(0, currentQuestion - 1))}
              disabled={currentQuestion === 0}
              whileHover={{ scale: currentQuestion === 0 ? 1 : 1.05 }}
              whileTap={{ scale: currentQuestion === 0 ? 1 : 0.95 }}
              className="btn-secondary flex items-center gap-1 sm:gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base px-3 sm:px-6 py-2 sm:py-3"
            >
              <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Previous</span>
              <span className="sm:hidden">Prev</span>
            </motion.button>

            {currentQuestion === assessment.questions_array.length - 1 ? (
              <motion.button
                onClick={handleSubmit}
                disabled={Object.keys(selectedAnswers).length !== assessment.questions_array.length}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base px-3 sm:px-6 py-2 sm:py-3"
              >
                <span className="hidden sm:inline">Submit Assessment</span>
                <span className="sm:hidden">Submit</span>
              </motion.button>
            ) : (
              <motion.button
                onClick={() => setCurrentQuestion(Math.min(assessment.questions_array.length - 1, currentQuestion + 1))}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="btn-primary flex items-center gap-1 sm:gap-2 text-sm sm:text-base px-3 sm:px-6 py-2 sm:py-3"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
              </motion.button>
            )}
          </div>

          {/* Answer Status */}
          <div className="flex gap-1 sm:gap-2 justify-center mt-4 sm:mt-6 flex-wrap">
            {assessment.questions_array.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentQuestion(idx)}
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full text-xs sm:text-sm font-medium transition-all ${
                  idx === currentQuestion
                    ? 'bg-apple-blue text-white'
                    : selectedAnswers[idx] !== undefined
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}
              >
                {idx + 1}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Submit Confirmation */}
      {isSubmitted && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50"
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className="glass dark:glass-dark p-6 sm:p-8 rounded-apple text-center max-w-sm mx-4"
          >
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
              <Check className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
            </div>
            <h3 className="text-xl sm:text-2xl font-bold mb-2">Assessment Submitted!</h3>
            <p className="text-sm sm:text-base text-apple-dark-gray">Calculating your results...</p>
          </motion.div>
        </motion.div>
      )}
    </div>
  )
}
