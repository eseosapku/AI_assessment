'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from './AuthProvider'
import {
  AVAILABLE_CURRICULA,
  RWANDAN_CURRICULUM,
  getSubjectsForGrade,
  getTopicsForGradeAndSubject,
  type GradeLevel,
} from '@/lib/rwanda-curriculum'

interface FlowFormProps {
  onClose: () => void
}

const GRADES: GradeLevel[] = [7, 8, 9, 10, 11, 12]
const TOTAL_STEPS = 7

export default function FlowForm({ onClose }: FlowFormProps) {
  const router = useRouter()
  const { user } = useAuth()
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({
    grade: null as GradeLevel | null,
    curriculum: '',
    subject: '',
    topics: [] as string[],
    count: 0,
    style: '',
    time: 'Calculated by AI',
  })

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  // Derived data from curriculum
  const subjects = formData.grade ? getSubjectsForGrade(formData.grade) : []
  const availableTopics =
    formData.grade && formData.subject
      ? getTopicsForGradeAndSubject(formData.grade, formData.subject)
      : []

  const gradeLabel = (g: GradeLevel) => {
    const info = RWANDAN_CURRICULUM[g]
    return `Grade ${g} (${info.rwandaLevel})`
  }

  const gradeSublabel = (g: GradeLevel) => {
    return g <= 9 ? 'O-Level' : 'A-Level'
  }

  // Step handlers
  const handleGradeSelect = (grade: GradeLevel) => {
    setFormData({ ...formData, grade, subject: '', topics: [] })
    setTimeout(() => setStep(2), 300)
  }

  const handleCurriculumSelect = (curriculumId: string) => {
    setFormData({ ...formData, curriculum: curriculumId, subject: '', topics: [] })
    setTimeout(() => setStep(3), 300)
  }

  const handleSubjectSelect = (subject: string) => {
    setFormData({ ...formData, subject, topics: [] })
    setStep(4)
  }

  const handleTopicToggle = (topic: string) => {
    const newTopics = formData.topics.includes(topic)
      ? formData.topics.filter((t) => t !== topic)
      : [...formData.topics, topic]
    setFormData({ ...formData, topics: newTopics })
    if (newTopics.length > 0 && step === 4) {
      setTimeout(() => setStep(5), 300)
    }
  }

  const handleCountSelect = (count: number) => {
    setFormData({ ...formData, count })
    setTimeout(() => setStep(6), 300)
  }

  const handleStyleSelect = (style: string) => {
    setFormData({ ...formData, style })
    setTimeout(() => setStep(7), 300)
  }

  const handleStartAssessment = async () => {
    setIsLoading(true)
    setError('')

    try {
      const response = await fetch('/api/generate-assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          className: user?.class,
          user_id: user?.id,
        }),
      })

      const text = await response.text()
      if (!text) throw new Error('Server returned an empty response. Please try again.')
      const data = JSON.parse(text)

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate assessment')
      }

      sessionStorage.setItem('currentAssessment', JSON.stringify(data))
      router.push('/assessment')
    } catch (err: any) {
      setError(err.message)
      console.error('Assessment generation error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const selectedCurriculum = AVAILABLE_CURRICULA.find(
    (c) => c.id === formData.curriculum
  )

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 backdrop-blur-md z-50 flex items-center justify-center p-4 sm:p-6"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-2xl bg-white dark:bg-[#1c1c1e] rounded-3xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200/50 dark:border-gray-800/50"
        >
          {/* Header */}
          <div className="flex justify-between items-center mb-6 sm:mb-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                New Assessment
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Configure your AI-generated test
              </p>
            </div>
            <motion.button
              onClick={onClose}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <X className="w-6 h-6 text-gray-500" />
            </motion.button>
          </div>

          {/* Progress Indicator */}
          <div className="flex gap-1.5 mb-8">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((s) => (
              <div
                key={s}
                className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
                  s <= step ? 'bg-blue-600' : 'bg-gray-100 dark:bg-gray-800'
                }`}
              />
            ))}
          </div>

          {/* Step 1: Grade Selection */}
          {step >= 1 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="mb-6"
            >
              <h3 className="text-base sm:text-lg font-semibold mb-1">
                Select Your Grade
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 sm:mb-4">
                Choose the grade level for your assessment
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                {GRADES.map((grade) => (
                  <motion.button
                    key={grade}
                    onClick={() => handleGradeSelect(grade)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`p-3 sm:p-4 rounded-apple border-2 transition-all text-left ${
                      formData.grade === grade
                        ? 'border-apple-blue bg-apple-blue bg-opacity-10'
                        : 'border-gray-200 dark:border-gray-700 hover:border-apple-blue'
                    }`}
                  >
                    <div className="font-semibold text-sm sm:text-base">
                      {gradeLabel(grade)}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {gradeSublabel(grade)}
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Step 2: Curriculum Selection */}
          {step >= 2 && formData.grade && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="mb-6"
            >
              <h3 className="text-base sm:text-lg font-semibold mb-1">
                Select Curriculum
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 sm:mb-4">
                Choose the national curriculum your test will be based on
              </p>
              <div className="flex flex-col gap-3">
                {AVAILABLE_CURRICULA.map((curriculum) => (
                  <motion.button
                    key={curriculum.id}
                    onClick={() => handleCurriculumSelect(curriculum.id)}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    className={`p-4 rounded-apple border-2 transition-all text-left ${
                      formData.curriculum === curriculum.id
                        ? 'border-apple-blue bg-apple-blue bg-opacity-10'
                        : 'border-gray-200 dark:border-gray-700 hover:border-apple-blue'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{curriculum.flag}</span>
                      <div>
                        <div className="font-semibold text-sm sm:text-base">
                          {curriculum.name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {curriculum.description}
                        </div>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Step 3: Subject Selection */}
          {step >= 3 && formData.curriculum && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="mb-6 smooth-appear"
            >
              <h3 className="text-base sm:text-lg font-semibold mb-1">
                Select Subject
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 sm:mb-4">
                Grade {formData.grade} subjects from the REB curriculum
              </p>
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

          {/* Step 4: Topic Selection */}
          {step >= 4 && formData.subject && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="mb-6 smooth-appear"
            >
              <h3 className="text-base sm:text-lg font-semibold mb-1">
                Select Topics
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 sm:mb-4">
                Choose one or more topics from the REB {formData.subject} syllabus
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                {availableTopics.map((topic) => (
                  <motion.button
                    key={topic}
                    onClick={() => handleTopicToggle(topic)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`p-3 sm:p-4 rounded-apple border-2 transition-all text-sm sm:text-base text-left ${
                      formData.topics.includes(topic)
                        ? 'border-apple-blue bg-apple-blue bg-opacity-10'
                        : 'border-gray-200 dark:border-gray-700 hover:border-apple-blue'
                    }`}
                  >
                    {topic}
                  </motion.button>
                ))}
              </div>
              {formData.topics.length > 0 && step === 4 && (
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={() => setStep(5)}
                  className="mt-4 w-full py-3 rounded-apple border-2 border-apple-blue text-apple-blue font-medium text-sm hover:bg-apple-blue hover:bg-opacity-10 transition-all"
                >
                  Continue with {formData.topics.length} topic
                  {formData.topics.length > 1 ? 's' : ''} selected →
                </motion.button>
              )}
            </motion.div>
          )}

          {/* Step 5: Question Count */}
          {step >= 5 && formData.topics.length > 0 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="mb-6 smooth-appear"
            >
              <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">
                Question Count
              </h3>
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

          {/* Step 6: Style Selection */}
          {step >= 6 && formData.count > 0 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="mb-6 smooth-appear"
            >
              <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">
                Assessment Style
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                {['Exam Style (Past Papers)', 'Test Style (Textbooks)'].map(
                  (style) => (
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
                  )
                )}
              </div>
            </motion.div>
          )}

          {/* Step 7: Summary & Start */}
          {step >= 7 && formData.style && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="smooth-appear"
            >
              <div className="p-4 sm:p-6 rounded-apple bg-apple-gray dark:bg-gray-800 mb-6">
                <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">
                  Assessment Summary
                </h3>
                <div className="space-y-2 text-sm">
                  <p>
                    <span className="text-apple-dark-gray">Grade:</span>{' '}
                    <span className="font-medium">
                      Grade {formData.grade} ({RWANDAN_CURRICULUM[formData.grade!]?.rwandaLevel})
                    </span>
                  </p>
                  <p>
                    <span className="text-apple-dark-gray">Curriculum:</span>{' '}
                    <span className="font-medium">
                      {selectedCurriculum?.name ?? formData.curriculum}
                    </span>
                  </p>
                  <p>
                    <span className="text-apple-dark-gray">Subject:</span>{' '}
                    <span className="font-medium">{formData.subject}</span>
                  </p>
                  <p>
                    <span className="text-apple-dark-gray">Topics:</span>{' '}
                    <span className="font-medium">
                      {formData.topics.join(', ')}
                    </span>
                  </p>
                  <p>
                    <span className="text-apple-dark-gray">Questions:</span>{' '}
                    <span className="font-medium">{formData.count}</span>
                  </p>
                  <p>
                    <span className="text-apple-dark-gray">Style:</span>{' '}
                    <span className="font-medium">{formData.style}</span>
                  </p>
                  <p>
                    <span className="text-apple-dark-gray">Time:</span>{' '}
                    <span className="font-medium italic text-apple-blue">
                      {formData.time}
                    </span>
                  </p>
                </div>
              </div>

              <motion.button
                onClick={handleStartAssessment}
                disabled={isLoading}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>
                  {isLoading ? 'Generating AI Assessment...' : 'Start Assessment'}
                </span>
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
