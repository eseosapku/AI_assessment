'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from './AuthProvider'

interface FlowFormProps {
  onClose: () => void
}

export default function FlowForm({ onClose }: FlowFormProps) {
  const router = useRouter()
  const { user } = useAuth()
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({
    subject: '',
    topics: [] as string[],
    count: 0,
    style: '',
    time: 'Calculated by AI'
  })

  const subjects = [
    'Mathematics',
    'Physics',
    'Chemistry',
    'Biology',
    'Computer Science',
    'English',
    'History'
  ]

  const topicsBySubject: Record<string, string[]> = {
    'Mathematics': ['Calculus', 'Algebra', 'Trigonometry', 'Statistics', 'Geometry'],
    'Physics': ['Mechanics', 'Electromagnetism', 'Thermodynamics', 'Optics', 'Modern Physics'],
    'Chemistry': ['Organic Chemistry', 'Inorganic Chemistry', 'Physical Chemistry', 'Analytical Chemistry'],
    'Biology': ['Cell Biology', 'Genetics', 'Evolution', 'Ecology', 'Human Anatomy'],
    'Computer Science': ['Data Structures', 'Algorithms', 'OOP', 'Databases', 'Web Development']
  }

  const handleSubjectSelect = (subject: string) => {
    setFormData({ ...formData, subject, topics: [] })
    setStep(2)
  }

  const handleTopicToggle = (topic: string) => {
    const newTopics = formData.topics.includes(topic)
      ? formData.topics.filter(t => t !== topic)
      : [...formData.topics, topic]
    setFormData({ ...formData, topics: newTopics })
    
    if (newTopics.length > 0 && step === 2) {
      setTimeout(() => setStep(3), 300)
    }
  }

  const handleCountSelect = (count: number) => {
    setFormData({ ...formData, count })
    setTimeout(() => setStep(4), 300)
  }

  const handleStyleSelect = (style: string) => {
    setFormData({ ...formData, style })
    setTimeout(() => setStep(5), 300)
  }

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleStartAssessment = async () => {
    setIsLoading(true)
    setError('')
    
    try {
      // Call API to generate assessment
      const response = await fetch('/api/generate-assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, className: user?.class, user_id: user?.id })
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate assessment')
      }
      
      // Store assessment data and navigate to assessment page
      sessionStorage.setItem('currentAssessment', JSON.stringify(data))
      router.push('/assessment')
    } catch (err: any) {
      setError(err.message)
      console.error('Assessment generation error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-2xl glass dark:glass-dark rounded-apple p-8 max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex justify-between items-center mb-6 sm:mb-8">
            <h2 className="text-xl sm:text-2xl font-bold">Create Assessment</h2>
            <motion.button
              onClick={onClose}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              <X className="w-5 h-5" />
            </motion.button>
          </div>

          {/* Progress Indicator */}
          <div className="flex gap-1 sm:gap-2 mb-6 sm:mb-8">
            {[1, 2, 3, 4, 5].map((s) => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                  s <= step ? 'bg-apple-blue' : 'bg-gray-300 dark:bg-gray-700'
                }`}
              />
            ))}
          </div>

          {/* Step 1: Subject Selection */}
          {step >= 1 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="mb-6"
            >
              <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Select Subject</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                {subjects.map((subject) => (
                  <motion.button
                    key={subject}
                    onClick={() => handleSubjectSelect(subject)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`p-3 sm:p-4 rounded-apple border-2 transition-all text-sm sm:text-base ${
                      formData.subject === subject
                        ? 'border-apple-blue bg-apple-blue bg-opacity-10'
                        : 'border-gray-200 dark:border-gray-700 hover:border-apple-blue'
                    }`}
                  >
                    {subject}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Step 2: Topic Selection */}
          {step >= 2 && formData.subject && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="mb-6 smooth-appear"
            >
              <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Select Topics (Multiple)</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                {topicsBySubject[formData.subject]?.map((topic) => (
                  <motion.button
                    key={topic}
                    onClick={() => handleTopicToggle(topic)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`p-3 sm:p-4 rounded-apple border-2 transition-all text-sm sm:text-base ${
                      formData.topics.includes(topic)
                        ? 'border-apple-blue bg-apple-blue bg-opacity-10'
                        : 'border-gray-200 dark:border-gray-700 hover:border-apple-blue'
                    }`}
                  >
                    {topic}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Step 3: Question Count */}
          {step >= 3 && formData.topics.length > 0 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="mb-6 smooth-appear"
            >
              <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Question Count</h3>
              <div className="grid grid-cols-3 gap-3">
                {[10, 20, 40].map((count) => (
                  <motion.button
                    key={count}
                    onClick={() => handleCountSelect(count)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`p-4 sm:p-6 rounded-apple border-2 transition-all text-xl sm:text-2xl font-bold ${
                      formData.count === count
                        ? 'border-apple-blue bg-apple-blue bg-opacity-10'
                        : 'border-gray-200 dark:border-gray-700 hover:border-apple-blue'
                    }`}
                  >
                    {count}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Step 4: Style Selection */}
          {step >= 4 && formData.count > 0 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="mb-6 smooth-appear"
            >
              <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Assessment Style</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                {['Exam Style (Past Papers)', 'Test Style (Textbooks)'].map((style) => (
                  <motion.button
                    key={style}
                    onClick={() => handleStyleSelect(style)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`p-3 sm:p-4 rounded-apple border-2 transition-all text-sm sm:text-base ${
                      formData.style === style
                        ? 'border-apple-blue bg-apple-blue bg-opacity-10'
                        : 'border-gray-200 dark:border-gray-700 hover:border-apple-blue'
                    }`}
                  >
                    {style}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Step 5: Summary & Start */}
          {step >= 5 && formData.style && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="smooth-appear"
            >
              <div className="p-4 sm:p-6 rounded-apple bg-apple-gray dark:bg-gray-800 mb-6">
                <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Assessment Summary</h3>
                <div className="space-y-2 text-sm">
                  <p><span className="text-apple-dark-gray">Subject:</span> <span className="font-medium">{formData.subject}</span></p>
                  <p><span className="text-apple-dark-gray">Topics:</span> <span className="font-medium">{formData.topics.join(', ')}</span></p>
                  <p><span className="text-apple-dark-gray">Questions:</span> <span className="font-medium">{formData.count}</span></p>
                  <p><span className="text-apple-dark-gray">Style:</span> <span className="font-medium">{formData.style}</span></p>
                  <p><span className="text-apple-dark-gray">Time:</span> <span className="font-medium italic text-apple-blue">{formData.time}</span></p>
                </div>
              </div>

              <motion.button
                onClick={handleStartAssessment}
                disabled={isLoading}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>{isLoading ? 'Generating AI Assessment...' : 'Start Assessment'}</span>
                {!isLoading && <ChevronRight className="w-5 h-5" />}
              </motion.button>

              {error && (
                <div className="mt-4 p-3 rounded-apple bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-600 dark:text-red-400 text-center">
                  {error}
                </div>
              )}
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
